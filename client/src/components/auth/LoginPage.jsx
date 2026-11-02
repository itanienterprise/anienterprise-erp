import React, { useState } from 'react';
import { API_BASE_URL } from '../../utils/helpers';
import { getBaseServerUrl, sanitizeServerUrl } from '../../utils/api';
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

    // Dynamic Server IP Configuration
    const [showServerConfig, setShowServerConfig] = useState(false);
    const [serverIpInput, setServerIpInput] = useState(() => {
        return localStorage.getItem('erp_server_url') || getBaseServerUrl() || '';
    });
    const [testStatus, setTestStatus] = useState(null);
    const [isTesting, setIsTesting] = useState(false);

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

    const handleTestConnection = async () => {
        const raw = serverIpInput.trim();
        if (!raw) {
            setTestStatus({ type: 'error', text: 'Please enter an IP address or hostname.' });
            return;
        }
        const target = sanitizeServerUrl(raw);
        setIsTesting(true);
        setTestStatus({ type: 'info', text: `Testing connection to ${target}...` });
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);
            const res = await fetch(`${target}/api/health`, {
                method: 'GET',
                signal: controller.signal
            }).catch(async () => {
                // Fallback test on /health
                return await fetch(`${target}/health`, {
                    method: 'GET',
                    signal: controller.signal
                });
            });
            clearTimeout(timeoutId);
            if (res && (res.ok || res.status === 200 || res.status === 401 || res.status === 404)) {
                setTestStatus({ type: 'success', text: `Connected successfully to ${target}!` });
            } else {
                setTestStatus({ type: 'error', text: `Server returned HTTP status ${res ? res.status : 'offline'}.` });
            }
        } catch (err) {
            setTestStatus({
                type: 'error',
                text: `Cannot reach ${target}. Ensure phone is on same Wi-Fi and server is running.`
            });
        } finally {
            setIsTesting(false);
        }
    };

    const handleSaveServerIp = () => {
        const raw = serverIpInput.trim();
        if (!raw) {
            localStorage.removeItem('erp_server_url');
        } else {
            const clean = sanitizeServerUrl(raw);
            localStorage.setItem('erp_server_url', clean);
        }
        setTestStatus({ type: 'success', text: 'IP saved! Reloading application...' });
        setTimeout(() => {
            window.location.reload();
        }, 500);
    };

    const handleResetServerIp = () => {
        localStorage.removeItem('erp_server_url');
        setServerIpInput(getBaseServerUrl());
        setTestStatus({ type: 'info', text: 'Reset to default! Reloading application...' });
        setTimeout(() => {
            window.location.reload();
        }, 500);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const activeBase = getBaseServerUrl() || API_BASE_URL || '';
        try {
            const response = await fetch(`${activeBase}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ username, password, rememberMe })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                const userRole = (data.user?.role || '').toLowerCase();
                if (userRole === 'general staff') {
                    setError('Access denied. General staff are not allowed to log in to this system.');
                } else {
                    const isRemember = data.rememberMe ?? rememberMe;
                    if (data.sessionToken) {
                        sessionStorage.setItem('erp_session_token', data.sessionToken);
                        if (isRemember) {
                            localStorage.setItem('erp_session_token', data.sessionToken);
                        } else {
                            localStorage.removeItem('erp_session_token');
                        }
                    }
                    if (data.sessionId) {
                        sessionStorage.setItem('erp_session_id', data.sessionId);
                        if (isRemember) {
                            localStorage.setItem('erp_session_id', data.sessionId);
                        } else {
                            localStorage.removeItem('erp_session_id');
                        }
                    }
                    if (isRemember) {
                        localStorage.setItem('savedUsername', username);
                        localStorage.setItem('rememberMe', 'true');
                    } else {
                        localStorage.removeItem('savedUsername');
                        localStorage.removeItem('rememberMe');
                    }
                    onLogin(data.user, isRemember, data.sessionToken, data.sessionId);
                }
            } else {
                setError(data.message || 'Invalid username or password');
            }
        } catch (err) {
            console.error('Login error:', err);
            const targetHost = activeBase || window.location.origin;
            setError(`Cannot reach backend server (${targetHost}). If your computer's IP changed, tap "Server IP Settings" below.`);
        } finally {
            setLoading(false);
        }
    };

    const currentSavedIp = localStorage.getItem('erp_server_url') || getBaseServerUrl();

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
                                <span>{error}</span>
                            </div>
                        )}

                        <button type="submit" className={`lp-btn${loading ? ' lp-btn-loading' : ''}`} disabled={loading}>
                            {loading ? (
                                <span className="lp-spinner" />
                            ) : 'Login'}
                        </button>

                        {/* Option to Change IP (Configurable & Easy to Remove Later) */}
                        <div className="lp-server-section">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowServerConfig(!showServerConfig);
                                    setTestStatus(null);
                                }}
                                className="lp-server-toggle-btn"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="3" />
                                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                                </svg>
                                <span>Change Server IP</span>
                                <span className="lp-server-current-pill" title={currentSavedIp}>
                                    {currentSavedIp ? currentSavedIp.replace(/^https?:\/\//i, '') : 'Default IP'}
                                </span>
                            </button>

                            {showServerConfig && (
                                <div className="lp-server-box">
                                    <div className="lp-server-box-header">
                                        <span className="lp-server-box-title">ERP Backend Server IP</span>
                                        <span className="lp-server-box-sub">Enter your computer's IP (e.g. 192.168.0.27 or 192.168.0.27:5000)</span>
                                    </div>
                                    <div className="lp-server-input-group">
                                        <input
                                            type="text"
                                            value={serverIpInput}
                                            onChange={(e) => {
                                                setServerIpInput(e.target.value);
                                                setTestStatus(null);
                                            }}
                                            placeholder="192.168.0.27:5000"
                                            className="lp-server-input"
                                        />
                                    </div>
                                    {testStatus && (
                                        <div className={`lp-server-msg lp-server-msg-${testStatus.type}`}>
                                            {testStatus.text}
                                        </div>
                                    )}
                                    <div className="lp-server-actions">
                                        <button
                                            type="button"
                                            onClick={handleTestConnection}
                                            disabled={isTesting}
                                            className="lp-server-btn-test"
                                        >
                                            {isTesting ? 'Testing...' : 'Test'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSaveServerIp}
                                            className="lp-server-btn-save"
                                        >
                                            Save & Apply
                                        </button>
                                        {localStorage.getItem('erp_server_url') && (
                                            <button
                                                type="button"
                                                onClick={handleResetServerIp}
                                                className="lp-server-btn-reset"
                                            >
                                                Reset
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
