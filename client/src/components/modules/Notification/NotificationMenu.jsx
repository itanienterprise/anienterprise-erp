import React, { useState } from 'react';
import { BellIcon, XIcon } from '../../Icons';
import './NotificationMenu.css';

const NotificationMenu = ({ isOpen, onClose, notifications, onMarkAllAsRead, onClearAll, onMarkAsRead }) => {
    if (!isOpen) return null;

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
                            {notifications.length > 0 && (
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
                                {notifications.map((notif) => (
                                    <li
                                        key={notif._id}
                                        className={`notification-item ${notif.isUnread ? 'unread' : ''}`}
                                        onClick={() => onMarkAsRead(notif._id)}
                                    >
                                        <div className="flex items-start">
                                            {notif.isUnread && <div className="unread-dot" />}
                                            <div className={notif.isUnread ? 'ml-3 flex-1' : 'flex-1'}>
                                                <p className={`text-sm tracking-tight ${notif.isUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                                                    {notif.title}
                                                </p>
                                                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                                                    {notif.message}
                                                </p>
                                                <p className="notification-time">
                                                    {formatTime(notif.createdAt)}
                                                </p>
                                            </div>
                                        </div>
                                    </li>
                                ))}
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
