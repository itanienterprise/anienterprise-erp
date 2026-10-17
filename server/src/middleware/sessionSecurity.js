const crypto = require('crypto');

/**
 * Constant-time safe string comparison to prevent timing attacks
 */
function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Extract clean client IP address
 */
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first) return first.replace(/^::ffff:/, '');
  }
  return (req.socket?.remoteAddress || req.ip || '').replace(/^::ffff:/, '');
}

/**
 * Get IP Subnet (IPv4 /24 or IPv6 /48 or 'local')
 * Allows minor cellular/DHCP lease shifts while detecting cross-network hijacking
 */
function getIpSubnet(ip) {
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip === 'unknown') {
    return 'local';
  }
  if (ip.includes('.')) {
    // IPv4: take first 3 octets (e.g. 192.168.1)
    const parts = ip.split('.');
    if (parts.length >= 3) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
    }
  } else if (ip.includes(':')) {
    // IPv6: take first 3 segments
    const parts = ip.split(':');
    if (parts.length >= 3) {
      return `${parts[0]}:${parts[1]}:${parts[2]}::/48`;
    }
  }
  return ip;
}

/**
 * Compute cryptographic session fingerprint from client headers
 */
function generateSessionFingerprint(req) {
  const ua = req.headers['user-agent'] || 'unknown';
  const cleanIp = getClientIp(req);
  const subnet = getIpSubnet(cleanIp);
  const secret = process.env.SESSION_SECRET || 'ani_enterprise_erp_secret_key';
  return crypto.createHash('sha256').update(`${ua}|${subnet}|${secret}`).digest('hex');
}

/**
 * Generate a cryptographically secure 256-bit anti-hijacking token
 */
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Session Hijacking Protection Middleware
 * Continuous integrity verification for all requests with active session
 */
const sessionSecurityMiddleware = (req, res, next) => {
  // If no user session, skip integrity checks (unauthenticated request)
  if (!req.session || !req.session.user) {
    return next();
  }

  const currentUa = req.headers['user-agent'] || 'unknown';
  const currentIp = getClientIp(req);
  const currentSubnet = getIpSubnet(currentIp);
  const sessionTokenHeader = req.headers['x-session-token'];

  // 1. User-Agent Binding Check
  // Stolen cookies replayed from a different browser or tool (Postman, curl, attacker PC)
  if (req.session.userAgent && req.session.userAgent !== currentUa) {
    console.warn(`[SECURITY ALERT] 🛑 Session Hijacking Attempt Blocked! (User-Agent Mismatch)`);
    console.warn(`User: ${req.session.user.username}`);
    console.warn(`Expected UA: ${req.session.userAgent}`);
    console.warn(`Received UA: ${currentUa}`);
    console.warn(`Attacker IP: ${currentIp}`);

    req.session.destroy(() => {});
    res.clearCookie('erp_session', { path: '/' });
    req.session = null;

    return res.status(401).json({
      message: 'Session integrity violation: Device signature mismatch. Potential session hijacking detected. Please log in again.',
      code: 'SESSION_HIJACK_DETECTED'
    });
  }

  // 2. IP Subnet & Anti-Hijacking Token Validation
  // If IP subnet changes (e.g. attacker from a different network using stolen cookie):
  // A legitimate user switching networks (e.g. Wi-Fi to 4G) will possess the valid X-Session-Token.
  // An attacker who only stole the cookie will NOT have the X-Session-Token.
  if (
    req.session.ipSubnet &&
    req.session.ipSubnet !== 'local' &&
    currentSubnet !== 'local' &&
    req.session.ipSubnet !== currentSubnet
  ) {
    const hasValidToken = req.session.sessionToken &&
      sessionTokenHeader &&
      safeCompare(sessionTokenHeader, req.session.sessionToken);

    if (!hasValidToken) {
      console.warn(`[SECURITY ALERT] 🛑 Session Hijacking Attempt Blocked! (Unauthorized IP Network Shift without Session Token)`);
      console.warn(`User: ${req.session.user.username}`);
      console.warn(`Original Subnet: ${req.session.ipSubnet} (IP: ${req.session.clientIp})`);
      console.warn(`Attacker Subnet: ${currentSubnet} (IP: ${currentIp})`);

      req.session.destroy(() => {});
      res.clearCookie('erp_session', { path: '/' });
      req.session = null;

      return res.status(401).json({
        message: 'Session integrity violation: Network shift without valid security token. Potential session hijacking detected. Please log in again.',
        code: 'SESSION_HIJACK_DETECTED'
      });
    }

    // Legitimate roaming user with valid cryptographic token: safely update IP tracking
    console.log(`[Session Security] Verified roaming network update for user ${req.session.user.username}: ${req.session.clientIp} -> ${currentIp}`);
    req.session.clientIp = currentIp;
    req.session.ipSubnet = currentSubnet;
    req.session.fingerprint = generateSessionFingerprint(req);
  }

  // 3. State-Mutating Request Token Check (POST, PUT, DELETE, PATCH)
  // Protects against CSRF and cookie-only hijacking on sensitive operations
  // Gateway requests (/v) wrap real method and path in req.body.m and req.body.p
  const effectivePath = (req.path === '/v' && req.body && req.body.p)
    ? String(req.body.p).split('?')[0]
    : String(req.path || '').split('?')[0];

  const effectiveMethod = (req.path === '/v' && req.body && req.body.m)
    ? String(req.body.m).toUpperCase()
    : String(req.method || '').toUpperCase();

  const isMutating = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(effectiveMethod);
  const isExcludedPath = [
    '/api/auth/login',
    '/api/auth/logout',
    '/api/auth/check',
    '/api/health',
    '/api/logs/client-action',
    '/api/logs/heartbeat'
  ].includes(effectivePath);

  if (isMutating && !isExcludedPath && req.session.sessionToken) {
    if (!sessionTokenHeader || !safeCompare(sessionTokenHeader, req.session.sessionToken)) {
      console.warn(`[SECURITY ALERT] 🛑 Mutating Request Blocked! (Missing or Invalid Session Token)`);
      console.warn(`User: ${req.session.user.username}`);
      console.warn(`Method: ${effectiveMethod}, Path: ${effectivePath}`);
      console.warn(`Client IP: ${currentIp}`);

      return res.status(403).json({
        message: 'Security token invalid or missing. Action rejected to protect against session hijacking.',
        code: 'INVALID_SESSION_TOKEN'
      });
    }
  }

  // 4. Inactivity & Absolute Lifetime Check
  const now = Date.now();
  if (req.session.rememberMe) {
    // 30 days absolute maxAge
    if (req.session.createdAt && (now - req.session.createdAt > 30 * 24 * 60 * 60 * 1000)) {
      req.session.destroy(() => {});
      res.clearCookie('erp_session', { path: '/' });
      req.session = null;
      return res.status(401).json({ message: 'Session expired (30-day limit reached). Please log in again.' });
    }
  } else {
    // Non-remembered session: 8 hours inactivity timeout
    if (req.session.lastActivity && (now - req.session.lastActivity > 8 * 60 * 60 * 1000)) {
      req.session.destroy(() => {});
      res.clearCookie('erp_session', { path: '/' });
      req.session = null;
      return res.status(401).json({ message: 'Session expired due to inactivity. Please log in again.' });
    }
  }

  req.session.lastActivity = now;
  next();
};

module.exports = {
  sessionSecurityMiddleware,
  generateSessionToken,
  generateSessionFingerprint,
  getClientIp,
  getIpSubnet,
  safeCompare
};
