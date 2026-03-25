import axios from 'axios';
import { encryptData, decryptData, generateSignature } from './encryption';

const API_BASE_URL = ''; // Relative path, handled by Vite proxy

// Configure Axios defaults
axios.defaults.withCredentials = true;

/**
 * Request Interceptor: Automatically encrypts the body and adds security headers.
 */
axios.interceptors.request.use((config) => {
    // skip non-api requests or health checks
    if (!config.url.includes('/api') || config.url.includes('/health')) {
        return config;
    }

    const timestamp = Date.now().toString();
    config.headers['X-Timestamp'] = timestamp;

    // Capture original details for the gateway
    const originalUrl = config.url;
    const originalMethod = config.method.toUpperCase();
    const originalData = config.data || {};

    // Transform to Gateway Request
    config.url = '/v';
    config.method = 'post';
    const gatewayPayload = {
        p: originalUrl,
        m: originalMethod,
        d: originalData
    };

    // Generate signature for the gateway payload
    const signature = generateSignature(gatewayPayload, timestamp);
    config.headers['X-Signature'] = signature;

    // Encrypt the full gateway payload
    config.data = { payload: encryptData(gatewayPayload) };

    return config;
}, (error) => {
    return Promise.reject(error);
});

/**
 * Response Interceptor: Automatically decrypts the payload.
 */
axios.interceptors.response.use((response) => {
    if (response.data && response.data.payload) {
        const decrypted = decryptData(response.data.payload);
        response.data = decrypted;
    }
    return response;
}, (error) => {
    // If it's a security error (403), we might want to handle it globally
    if (error.response && error.response.status === 403) {
        console.error('Security verification failed:', error.response.data.message);
    }
    return Promise.reject(error);
});

const originalFetch = window.fetch;

// Original fetch wrapper for cases where axios isn't used
const secureFetch = async (url, options = {}) => {
    // skip non-api requests or health checks
    if (!url.includes('/api') || url.includes('/health')) {
        return originalFetch(url, options);
    }

    const timestamp = Date.now().toString();
    
    // Capture original details for the gateway
    const originalMethod = (options.method || 'GET').toUpperCase();
    const originalData = options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : {};

    // Transform to Gateway Request
    const gatewayPayload = {
        p: url,
        m: originalMethod,
        d: originalData
    };

    const headers = {
        ...options.headers,
        'Content-Type': 'application/json',
        'X-Timestamp': timestamp,
        'X-Signature': generateSignature(gatewayPayload, timestamp),
    };

    const body = JSON.stringify({ payload: encryptData(gatewayPayload) });

    const response = await originalFetch('/v', { ...options, method: 'POST', headers, body });
    
    // We need to return something that looks like a Response object
    // because components call .json(), .ok, etc. on it.
    const originalJson = response.json.bind(response);
    
    // Override json() to automatically decrypt if a payload is present
    response.json = async () => {
        const data = await originalJson();
        if (data && data.payload) {
            return decryptData(data.payload);
        }
        return data;
    };

    return response;
};

// Global Shadowing: This ensures all native fetch() calls are secured
window.fetch = secureFetch;

export const api = {
    get: (url, options) => axios.get(url, options).then(res => res.data),
    post: (url, data, options) => axios.post(url, data, options).then(res => res.data),
    put: (url, data, options) => axios.put(url, data, options).then(res => res.data),
    delete: (url, options) => axios.delete(url, options).then(res => res.data),
    fetch: secureFetch
};

export default axios;
