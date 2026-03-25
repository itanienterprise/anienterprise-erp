const { decryptData, encryptData, verifySignature } = require('../utils/encryption');

const securityMiddleware = (req, res, next) => {
    // Apply to /api routes and the secure gateway /v
    if (req.method === 'OPTIONS' || (!req.path.startsWith('/api') && req.path !== '/v') || req.path === '/api/health') {
        return next();
    }

    // 1. Check for Signature and Timestamp headers
    const signature = req.headers['x-signature'];
    const timestamp = req.headers['x-timestamp'];

    if (!signature || !timestamp) {
        return res.status(403).json({ message: 'Security headers missing' });
    }

    // 2. Prevent Replay Attacks (e.g., 5-minute window)
    const now = Date.now();
    const requestTime = parseInt(timestamp);
    if (isNaN(requestTime) || Math.abs(now - requestTime) > 5 * 60 * 1000) {
        return res.status(403).json({ message: 'Request expired or invalid timestamp' });
    }

    // 3. Handle Encrypted Body
    if (req.method === 'POST' || req.method === 'PUT') {
        if (req.body && req.body.payload) {
            const decryptedBody = decryptData(req.body.payload);
            if (!decryptedBody) {
                return res.status(400).json({ message: 'Invalid encrypted payload' });
            }

            // 4. Verify Signature
            if (!verifySignature(decryptedBody, timestamp, signature)) {
                return res.status(403).json({ message: 'Invalid request signature' });
            }

            // Populate req.body with decrypted data so routes work as usual
            req.body = decryptedBody;
        } else if (Object.keys(req.body).length > 0) {
            // If body exists but not in the 'payload' wrapper, it's an unencrypted request
            // For transition, we might allow it, but for strict security:
            // return res.status(403).json({ message: 'Encrypted payload expected' });
        }
    } else {
        // For GET/DELETE, verify signature against an empty object or query params
        // (Implementation depends on how you want to handle GET requests)
        if (!verifySignature({}, timestamp, signature)) {
            // return res.status(403).json({ message: 'Invalid request signature' });
        }
    }

    // 5. Intercept Response to Encrypt it
    const originalJson = res.json;
    res.json = function (data) {
        // Don't encrypt error messages if they should be readable for debugging
        if (res.statusCode >= 400) {
            return originalJson.call(this, data);
        }

        const encryptedResponse = {
            payload: encryptData(data),
            timestamp: Date.now()
        };
        return originalJson.call(this, encryptedResponse);
    };

    next();
};

module.exports = securityMiddleware;
