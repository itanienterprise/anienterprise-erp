import React, { useState } from 'react';
import { API_BASE_URL } from '../../utils/helpers';
import { getBaseServerUrl, sanitizeServerUrl } from '../../utils/api';
import { safeStorage } from '../../utils/storageHelper';
import './LoginPage.css';

const LoginPage = ({ onLogin }) => {
    const [username, setUsername] = useState(() => {
        return localStorage.getItem('savedUsername') || '';
    });
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(() => {
        return localStorage.getItem('rememberMe') === 'true';
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Dynamic Server Connection Settings for Mobile APK testing
    const [showServerConfig, setShowServerConfig] = useState(false);
    const [serverUrlInput, setServerUrlInput] = useState(() => {
        return localStorage.getItem('erp_server_url') || getBaseServerUrl() || 'http://192.168.0.243:3000';
    });
    const [testStatus, setTestStatus] = useState(null);
    const [isTesting, setIsTesting] = useState(false);

    const handleTestServer = async (testUrl) => {
        const raw = testUrl || serverUrlInput;
        const target = sanitizeServerUrl(raw);
        if (!target) return;
        setIsTesting(true);
        setTestStatus({ type: 'info', text: `Testing connection to ${target}...` });
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 4000);
            const res = await fetch(`${target}/api/health`, { method: 'GET', signal: controller.signal });
            clearTimeout(timer);
            if (res && (res.ok || res.status === 200 || res.status === 401)) {
                setTestStatus({ type: 'success', text: `Connected successfully to ${target}!` });
            } else {
                setTestStatus({ type: 'error', text: `Server returned HTTP status ${res ? res.status : 'offline'}.` });
            }
        } catch (err) {
            setTestStatus({ type: 'error', text: `Cannot reach ${target}. Ensure phone is on the same Wi-Fi and server is active.` });
        } finally {
            setIsTesting(false);
        }
    };

    const handleApplyServer = (urlToSave) => {
        const raw = urlToSave || serverUrlInput;
        const clean = sanitizeServerUrl(raw);
        if (clean) {
            localStorage.setItem('erp_server_url', clean);
        } else {
            localStorage.removeItem('erp_server_url');
        }
        window.location.reload();
    };

    const handleResetServer = () => {
        localStorage.removeItem('erp_server_url');
        window.location.reload();
    };

    // Prompt for required permissions on mobile APK launch
    React.useEffect(() => {
        const isNative = typeof window !== 'undefined' && (
            !!window.AndroidBridge ||
            (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform())
        );
        if (isNative) {
            import('@capacitor/geolocation').then(({ Geolocation }) => {
                Geolocation.requestPermissions().catch(() => {});
            }).catch(() => {});
        }
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        let activeBase = getBaseServerUrl() || (typeof window !== 'undefined' ? localStorage.getItem('erp_server_url') : '') || API_BASE_URL || '';
        try {
            let response;
            try {
                response = await fetch(`${activeBase}/api/auth/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({ username, password, rememberMe })
                });
            } catch (initialErr) {
                // If LAN dev on port 3000 failed to connect, automatically attempt fallback to direct port 5000
                if (activeBase.includes(':3000') && (activeBase.includes('192.168.') || activeBase.includes('127.0.0.1') || activeBase.includes('localhost'))) {
                    const fallbackBase = activeBase.replace(':3000', ':5000');
                    console.warn(`[Login] ${activeBase} unreachable, automatically falling back to ${fallbackBase}...`);
                    activeBase = fallbackBase;
                    response = await fetch(`${fallbackBase}/api/auth/login`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        credentials: 'include',
                        body: JSON.stringify({ username, password, rememberMe })
                    });
                    localStorage.setItem('erp_server_url', fallbackBase);
                } else {
                    throw initialErr;
                }
            }

            const data = await response.json();

            if (response.ok && data.success) {
                const userRole = (data.user?.role || '').toLowerCase();
                if (userRole === 'general staff') {
                    setError('Access denied. General staff are not allowed to log in to this system.');
                } else {
                    const isRemember = data.rememberMe ?? rememberMe;
                    if (data.sessionToken) {
                        safeStorage.setItem(sessionStorage, 'erp_session_token', data.sessionToken);
                        if (isRemember) {
                            safeStorage.setItem(localStorage, 'erp_session_token', data.sessionToken);
                        } else {
                            safeStorage.removeItem(localStorage, 'erp_session_token');
                        }
                    }
                    if (data.sessionId) {
                        safeStorage.setItem(sessionStorage, 'erp_session_id', data.sessionId);
                        if (isRemember) {
                            safeStorage.setItem(localStorage, 'erp_session_id', data.sessionId);
                        } else {
                            safeStorage.removeItem(localStorage, 'erp_session_id');
                        }
                    }
                    if (isRemember) {
                        safeStorage.setItem(localStorage, 'savedUsername', username);
                        safeStorage.setItem(localStorage, 'rememberMe', 'true');
                    } else {
                        safeStorage.removeItem(localStorage, 'savedUsername');
                        safeStorage.removeItem(localStorage, 'rememberMe');
                    }
                    onLogin(data.user, isRemember, data.sessionToken, data.sessionId);
                }
            } else {
                setError(data.message || 'Invalid username or password');
            }
        } catch (err) {
            console.error('Login error:', err);
            const targetHost = activeBase || window.location.origin;
            const detail = err && err.message ? `: ${err.message}` : '';
            setError(`Cannot reach backend server (${targetHost})${detail}. Please check your connection or server status.`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="lp-bg">
            {/* Animated logistics background scene */}
            <div className="lp-scene" aria-hidden="true">
                <div className="lp-scene-canvas">
                    <img src="/login-bg-scenery.jpg" alt="" className="lp-scene-bg" />
                    <img src="/plane.png" alt="" className="lp-anim-plane" />
                    <img src="/ship.png" alt="" className="lp-anim-ship" />
                    <img src="/truck.png" alt="" className="lp-anim-truck" />
                </div>
            </div>

            <div className="lp-card">
                {/* Logo section */}
                <div className="lp-logo-section">
                    <img src="/logo.png" alt="ANI Enterprise Logo" className="lp-logo" />
                    <p className="lp-tagline">Enterprise Resource Planning</p>
                </div>

                <div className="lp-divider" />

                {/* Form section */}
                <div className="lp-form-section">
                    <h2 className="lp-title">Welcome back</h2>
                    <p className="lp-subtitle">Sign in to your account to continue</p>

                    <form onSubmit={handleSubmit} className="lp-form">
                        <div className="lp-field">
                            <span className="lp-field-icon">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                </svg>
                            </span>
                            <input
                                id="login-username"
                                name="username"
                                type="text"
                                placeholder="Username"
                                autoComplete="username"
                                value={username}
                                onChange={(e) => { setUsername(e.target.value); setError(''); }}
                                required
                                className="lp-input"
                            />
                        </div>

                        <div className="lp-field">
                            <span className="lp-field-icon">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                            </span>
                            <input
                                id="login-password"
                                name="password"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Password"
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                                required
                                className="lp-input"
                            />
                            <button
                                type="button"
                                className="lp-password-toggle"
                                onClick={() => setShowPassword(!showPassword)}
                                tabIndex="-1"
                            >
                                {showPassword ? (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                        <line x1="1" y1="1" x2="23" y2="23" />
                                    </svg>
                                ) : (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                        <circle cx="12" cy="12" r="3" />
                                    </svg>
                                )}
                            </button>
                        </div>

                        <div className="lp-options">
                            <label className="lp-checkbox-label" htmlFor="login-rememberMe">
                                <input
                                    id="login-rememberMe"
                                    name="rememberMe"
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    className="lp-checkbox"
                                />
                                <span className="lp-checkmark"></span>
                                Remember me
                            </label>
                            <a href="#" className="lp-forgot">Forgot Password?</a>
                        </div>

                        {error && (
                            <div className="lp-error">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="8" x2="12" y2="12" />
                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                                <div style={{ flex: 1 }}>
                                    <div>{error}</div>
                                    <button
                                        type="button"
                                        onClick={() => setShowServerConfig(!showServerConfig)}
                                        style={{ marginTop: '6px', fontSize: '11px', color: '#dc2626', textDecoration: 'underline', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 600, display: 'block' }}
                                    >
                                        {showServerConfig ? '▲ Hide Server Settings' : '⚙ Change / Test Server URL'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {showServerConfig && (
                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', marginBottom: '16px', fontSize: '12px', textAlign: 'left' }}>
                                <div style={{ fontWeight: '600', color: '#1e293b', marginBottom: '6px' }}>Backend Server Connection</div>
                                <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                                    <input
                                        type="text"
                                        value={serverUrlInput}
                                        onChange={(e) => { setServerUrlInput(e.target.value); setTestStatus(null); }}
                                        placeholder="http://192.168.0.243:3000"
                                        style={{ flex: 1, padding: '7px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', background: 'white' }}
                                    />
                                </div>

                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '10px' }}>
                                    <button
                                        type="button"
                                        onClick={() => { setServerUrlInput('http://192.168.0.243:3000'); handleTestServer('http://192.168.0.243:3000'); }}
                                        style={{ fontSize: '10px', padding: '4px 8px', borderRadius: '6px', background: '#e2e8f0', border: 'none', cursor: 'pointer' }}
                                    >
                                        Dev (:3000)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setServerUrlInput('http://192.168.0.243:5000'); handleTestServer('http://192.168.0.243:5000'); }}
                                        style={{ fontSize: '10px', padding: '4px 8px', borderRadius: '6px', background: '#e2e8f0', border: 'none', cursor: 'pointer' }}
                                    >
                                        Dev Direct (:5000)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setServerUrlInput('http://189.31.39.166:3000'); handleTestServer('http://189.31.39.166:3000'); }}
                                        style={{ fontSize: '10px', padding: '4px 8px', borderRadius: '6px', background: '#e2e8f0', border: 'none', cursor: 'pointer' }}
                                    >
                                        Main Cloud
                                    </button>
                                </div>

                                {testStatus && (
                                    <div style={{
                                        padding: '6px 10px',
                                        borderRadius: '6px',
                                        fontSize: '11px',
                                        marginBottom: '10px',
                                        fontWeight: 500,
                                        color: testStatus.type === 'success' ? '#15803d' : testStatus.type === 'error' ? '#b91c1c' : '#1d4ed8',
                                        background: testStatus.type === 'success' ? '#f0fdf4' : testStatus.type === 'error' ? '#fef2f2' : '#eff6ff'
                                    }}>
                                        {testStatus.text}
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: '6px' }}>
                                    <button
                                        type="button"
                                        onClick={() => handleTestServer()}
                                        disabled={isTesting}
                                        style={{ flex: 1, padding: '6px 10px', borderRadius: '8px', background: '#f1f5f9', border: '1px solid #cbd5e1', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                                    >
                                        {isTesting ? 'Testing...' : 'Test Connection'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleApplyServer()}
                                        style={{ flex: 1, padding: '6px 10px', borderRadius: '8px', background: '#2563eb', color: 'white', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                                    >
                                        Save & Apply
                                    </button>
                                    {localStorage.getItem('erp_server_url') && (
                                        <button
                                            type="button"
                                            onClick={handleResetServer}
                                            style={{ padding: '6px 10px', borderRadius: '8px', background: '#fee2e2', color: '#991b1b', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                                        >
                                            Reset
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        <button type="submit" className={`lp-btn${loading ? ' lp-btn-loading' : ''}`} disabled={loading}>
                            {loading ? (
                                <span className="lp-spinner" />
                            ) : 'Login'}
                        </button>

                        <div style={{ textAlign: 'center', marginTop: '14px' }}>
                            <button
                                type="button"
                                onClick={() => setShowServerConfig(!showServerConfig)}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '11px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                                <span>⚙</span> Server: {(localStorage.getItem('erp_server_url') || getBaseServerUrl() || serverUrlInput).replace(/^https?:\/\//i, '')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
