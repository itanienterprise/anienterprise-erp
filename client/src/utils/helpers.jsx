import React from 'react';
import axios from './api';
import { ChevronUpIcon, ChevronDownIcon } from '../components/Icons';

// Set axios defaults for session handling
axios.defaults.withCredentials = true;

// API Base URL - In development Vite proxies this; in production Nginx proxies this.
export const API_BASE_URL = '';

// Date Formatting Utilities
export const formatDate = (dateString) => {
    if (!dateString) return '-';
    
    // If it's a string in YYYY-MM-DD format, handle it directly
    if (typeof dateString === 'string' && dateString.split('-').length === 3) {
        const parts = dateString.split('-');
        const day = parts[2].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[0];
        return `${day}/${month}/${year}`;
    }
    
    // Otherwise, try to create a Date object and format it
    const date = dateString instanceof Date ? dateString : new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

export const parseDate = (dateString) => {
    if (!dateString) return new Date();
    if (typeof dateString === 'string' && dateString.includes('-')) {
        const [y, m, d] = dateString.split('-').map(Number);
        return new Date(y, m - 1, d);
    }
    return new Date(dateString);
};

// Sort Icon Component
export const SortIcon = ({ config, columnKey }) => {
    if (!config || config.key !== columnKey) {
        return <div className="w-4 h-4 ml-1 opacity-20"><ChevronDownIcon className="w-4 h-4" /></div>;
    }
    return config.direction === 'asc'
        ? <ChevronUpIcon className="w-4 h-4 ml-1 text-blue-600" />
        : <ChevronDownIcon className="w-4 h-4 ml-1 text-blue-600" />;
};
