import React from 'react';
import { BellIcon, XIcon } from '../../Icons';
import './NotificationMenu.css';

// Fallback: map notification title keywords → view name
// Used for older notifications that don't have a stored `link` field.
const TITLE_TO_VIEW = [
    // Document Code Matches (Highest Precision)
    { pattern: /\bRC-[0-9]+/i, view: 'payment-collection-section' },
    { pattern: /\bPTC-[0-9]+/i, view: 'pay-to-customer-section' },
    { pattern: /\bPL-[0-9]+/i, view: 'packing-list-section' },
    { pattern: /\bPI-[0-9]+/i, view: 'pi-section' },
    { pattern: /\bORD-?[0-9]+/i, view: 'order-sale-section' },
    { pattern: /\bPR-REC-?[0-9]+/i, view: 'purchase-receive-sale-section' },
    { pattern: /\bPUR-[0-9]+/i, view: 'purchase-sale-section' },
    { pattern: /\bSAL-[0-9]+/i, view: 'general-sale-section' },

    // Packing List (place BEFORE general sale to prevent 'Invoice No' from matching sale)
    { pattern: /\bpacking(?:\s+list)?\b/i, view: 'packing-list-section' },

    // Insurance Payment (place BEFORE LC to prevent 'plc' from matching 'lc')
    { pattern: /\b(?:insurance|gross premium|net premium)\b/i, view: 'insurance-payment-section' },

    // Proforma Invoice / PI
    { pattern: /\b(?:pi|proforma)\b/i, view: 'pi-section' },

    // IP Record
    { pattern: /\bip\b/i, view: 'ip-section' },

    // LC Receive
    { pattern: /\blc\s+receive\b/i, view: 'lc-entry-section' },

    // LC Management / Open
    { pattern: /\blc\b/i, view: 'lc-management-section' },

    // Border Sale
    { pattern: /\bborder\s+sale\b/i, view: 'border-sale-section' },

    // Payout to Customer
    { pattern: /\b(?:payout|pay\s+to\s+customer)\b/i, view: 'pay-to-customer-section' },

    // Payment Collection & Receipt
    { pattern: /\b(?:payment|receipt|collection)\b/i, view: 'payment-collection-section' },

    // Purchase Receive
    { pattern: /\bpurchase\s+receive\b/i, view: 'purchase-receive-sale-section' },

    // Purchase
    { pattern: /\bpurchase\b/i, view: 'purchase-sale-section' },

    // Order
    { pattern: /\border\b/i, view: 'order-sale-section' },

    // General Sale (place LAST so generic 'invoice' doesn't hijack packing lists or PIs)
    { pattern: /\b(?:general\s+sale|sale)\b/i, view: 'general-sale-section' },

    // Stock Transfer
    { pattern: /\btransfer\b/i, view: 'transfer-section' },

    // Backup & Restore
    { pattern: /\b(?:backup|restore)\b/i, view: 'backup-restore-section' },
];

function resolveLink(notif) {
    if (notif.link) return notif.link;

    let text = '';
    if (typeof notif.title === 'string') text += notif.title + ' ';
    else if (notif.title && typeof notif.title === 'object') text += (notif.title.title || notif.title.message || '') + ' ';

    if (typeof notif.message === 'string') text += notif.message + ' ';
    else if (notif.message && typeof notif.message === 'object') text += (notif.message.message || '') + ' ';

    text = text.toLowerCase();

    for (const item of TITLE_TO_VIEW) {
        if (item.pattern.test(text)) return item.view;
    }
    return null;
}

function extractHighlightId(notif) {
    if (notif.highlightId) return notif.highlightId;

    let text = '';
    if (typeof notif.message === 'string') text += notif.message + ' ';
    else if (notif.message && typeof notif.message === 'object') text += (notif.message.message || '') + ' ';

    if (typeof notif.title === 'string') text += notif.title;
    else if (notif.title && typeof notif.title === 'object') text += (notif.title.title || notif.title.message || '');

    if (!text.trim()) return null;

    // 1. Prefix match: e.g. "LC No: 087326010476", "PI No: PI-0012", "Invoice No: PL-001"
    const prefixMatch = text.match(/(?:PI|LC|IP|Invoice|Order|Receipt|Payout|Payment|Purchase|Sale|PL)\s*(?:No|Number|#)?\s*[:#]\s*([A-Za-z0-9\-_\/.]+)/i);
    if (prefixMatch) {
        return prefixMatch[1].trim();
    }

    // 2. Standard code formats: e.g. RC-0117, SAL-0042, PUR-0015, PTC-0023, PL-005, PI-0012
    const codeMatch = text.match(/\b([A-Za-z]{2,4}\-?[0-9]{2,})\b/);
    if (codeMatch) {
        return codeMatch[1].trim();
    }

    // 3. Long numeric LC number e.g. 087326010476 or 073926010078
    const numMatch = text.match(/\b([0-9]{6,})\b/);
    if (numMatch) {
        return numMatch[1].trim();
    }

    // 4. Parentheses format: only if inside parentheses there is an explicit code or number
    const parenMatch = text.match(/\(([^)]+)\)/);
    if (parenMatch) {
        const inner = parenMatch[1].trim();
        if (inner.includes(':')) {
            const afterColon = inner.split(':').slice(1).join(':').trim();
            const firstWord = afterColon.split(/\s+/)[0];
            if (firstWord) return firstWord.trim();
        }
        const tokens = inner.split(/\s+/);
        for (const t of tokens) {
            if (/[0-9]/.test(t) && t.length >= 3) {
                return t.trim();
            }
        }
    }

    // 5. Currency Amount figure e.g. ৳35,193.99 or ৳50,000
    const amountMatch = text.match(/৳\s*([0-9,]+(?:\.[0-9]+)?)/);
    if (amountMatch) {
        return amountMatch[1].trim();
    }

    // 6. Fallback for party/company name in text: "for <Name> was/has/is" or "from <Name> was/has/is"
    const forMatch = text.match(/(?:for|from)\s+([A-Za-z0-9\s\-_\/.]+?)\s+(?:was|has|is|been|submitted|created|updated|added|rejected|approved)/i);
    if (forMatch) {
        const val = forMatch[1].trim();
        if (val.length >= 3 && !val.toLowerCase().startsWith('a ')) {
            return val;
        }
    }

    return null;
}

const NotificationMenu = ({ isOpen, onClose, notifications, onMarkAllAsRead, onClearAll, onMarkAsRead, currentUser, onNavigate }) => {
    if (!isOpen) return null;

    const isAdmin = currentUser?.role === 'admin' || currentUser?.isAdmin === true;

    const formatTime = (dateString) => {
        if (!dateString) return 'Unknown time';
        const now = new Date();
        const date = new Date(dateString);
        const diffInSeconds = Math.floor((now - date) / 1000);

        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} mins ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;

        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const unreadCount = notifications.filter(n => n.isUnread).length;

    const renderTitle = (title) => {
        if (!title) return '';
        if (typeof title === 'object') {
            return title.title || title.message || JSON.stringify(title);
        }
        return title;
    };

    const renderMessage = (message, title) => {
        if (!message) {
            if (typeof title === 'object') {
                return title.message || '';
            }
            return '';
        }
        if (typeof message === 'object') {
            return message.message || JSON.stringify(message);
        }
        return message;
    };

    const handleItemClick = (notif) => {
        onMarkAsRead(notif._id);
        const view = resolveLink(notif);
        if (view && onNavigate) {
            const highlightId = extractHighlightId(notif);
            const titleStr = typeof notif.title === 'string' ? notif.title : (notif.title?.title || notif.title?.message || '');
            const msgStr = typeof notif.message === 'string' ? notif.message : (notif.message?.message || '');
            const titleMsg = (titleStr + ' ' + msgStr).toLowerCase();
            const isRequested = /request/i.test(titleMsg) || /created/i.test(titleMsg) || /new/i.test(titleMsg) || /pending/i.test(titleMsg) || /ord/i.test(titleMsg) || view === 'order-sale-section';
            onNavigate(view, highlightId, isRequested);
        }
    };

    return (
        <>
            <div
                className="notification-overlay"
                onClick={onClose}
                aria-hidden="true"
            />
            <div className="notification-container animate-notification">
                <div className="notification-glass">
                    {/* Header */}
                    <div className="notification-header">
                        <div className="flex items-center space-x-2">
                            <span className="font-semibold text-gray-800">Notifications</span>
                            {unreadCount > 0 && (
                                <span className="notification-badge">
                                    {unreadCount} New
                                </span>
                            )}
                        </div>
                        <div className="flex items-center space-x-2">
                            {isAdmin && notifications.length > 0 && (
                                <button
                                    onClick={onClearAll}
                                    className="text-xs font-medium text-red-500 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-md transition-all"
                                >
                                    Clear
                                </button>
                            )}
                            <button
                                onClick={onClose}
                                className="p-1 hover:bg-black/5 rounded-full transition-colors"
                            >
                                <XIcon className="w-4 h-4 text-gray-500" />
                            </button>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="notification-body">
                        {notifications.length > 0 ? (
                            <ul className="notification-list">
                                {notifications.map((notif) => {
                                    const targetView = resolveLink(notif);
                                    const isNavigable = !!targetView;
                                    return (
                                        <li
                                            key={notif._id}
                                            className={`notification-item ${notif.isUnread ? 'unread' : ''} ${isNavigable ? 'notification-item--navigable' : ''}`}
                                            onClick={() => handleItemClick(notif)}
                                            title={isNavigable ? 'Click to go to this entry' : undefined}
                                            style={{ cursor: isNavigable ? 'pointer' : 'default' }}
                                        >
                                            <div className="flex items-start">
                                                {notif.isUnread && <div className="unread-dot" />}
                                                <div className={notif.isUnread ? 'ml-3 flex-1' : 'flex-1'}>
                                                    <p className={`text-sm tracking-tight ${notif.isUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                                                        {renderTitle(notif.title)}
                                                    </p>
                                                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                                                        {renderMessage(notif.message, notif.title)}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <p className="notification-time">
                                                            {formatTime(notif.createdAt)}
                                                        </p>
                                                        {isNavigable && (
                                                            <span className="text-[10px] font-semibold text-blue-500">
                                                                View entry →
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-32 text-center px-4">
                                <BellIcon className="w-8 h-8 text-gray-300 mb-2" />
                                <p className="text-sm font-medium text-gray-500">No new notifications</p>
                                <p className="text-xs text-gray-400 mt-1">You're all caught up!</p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="notification-footer">
                        <button
                            className="notification-btn-all"
                            onClick={onMarkAllAsRead}
                            disabled={unreadCount === 0}
                            style={{ opacity: unreadCount === 0 ? 0.5 : 1, cursor: unreadCount === 0 ? 'default' : 'pointer' }}
                        >
                            Mark all as read
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default NotificationMenu;


