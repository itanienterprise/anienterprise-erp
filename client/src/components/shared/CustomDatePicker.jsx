import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from '../Icons';
import './CustomDatePicker.css';

const formatDate = (dateString) => {
    if (!dateString) return '';
    if (typeof dateString === 'string') {
        const parts = dateString.split('-');
        if (parts.length === 3 && parts[0].length === 4 && parts[1].length <= 2 && parts[2].length <= 2) {
            const day = parts[2].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            const year = parts[0];
            return `${day}/${month}/${year}`;
        }
        if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(dateString)) {
            return dateString;
        }
    }
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
        return typeof dateString === 'string' ? dateString : '';
    }
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

const parseDateInput = (str) => {
    if (!str) return null;
    const s = str.trim();
    if (!s) return null;

    // 1. DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY (with 2 or 4 digit year)
    const dmyMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
    if (dmyMatch) {
        const day = parseInt(dmyMatch[1], 10);
        const month = parseInt(dmyMatch[2], 10);
        let year = parseInt(dmyMatch[3], 10);
        if (year < 100) {
            year = 2000 + year;
        }
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
            const daysInMonth = new Date(year, month, 0).getDate();
            if (day <= daysInMonth) {
                return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            }
        }
    }

    // 2. YYYY-MM-DD or YYYY/MM/DD
    const ymdMatch = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (ymdMatch) {
        const year = parseInt(ymdMatch[1], 10);
        const month = parseInt(ymdMatch[2], 10);
        const day = parseInt(ymdMatch[3], 10);
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
            const daysInMonth = new Date(year, month, 0).getDate();
            if (day <= daysInMonth) {
                return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            }
        }
    }

    // 3. 8 continuous digits: DDMMYYYY
    if (/^\d{8}$/.test(s)) {
        const day = parseInt(s.slice(0, 2), 10);
        const month = parseInt(s.slice(2, 4), 10);
        const year = parseInt(s.slice(4, 8), 10);
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
            const daysInMonth = new Date(year, month, 0).getDate();
            if (day <= daysInMonth) {
                return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            }
        }
    }

    // 4. 6 continuous digits: DDMMYY
    if (/^\d{6}$/.test(s)) {
        const day = parseInt(s.slice(0, 2), 10);
        const month = parseInt(s.slice(2, 4), 10);
        const year = 2000 + parseInt(s.slice(4, 6), 10);
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            const daysInMonth = new Date(year, month, 0).getDate();
            if (day <= daysInMonth) {
                return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            }
        }
    }

    return null;
};

const CustomDatePicker = ({
    value,
    onChange,
    placeholder,
    label,
    required = false,
    name,
    labelClassName = "text-sm font-medium text-gray-700",
    compact = false,
    rightAlign = false,
    isOpen: externalIsOpen,
    onToggle: externalOnToggle,
    onOpen,
    onClose,
    readOnly = false,
    dropUp = false
}) => {
    const [internalIsOpen, setInternalIsOpen] = useState(false);
    const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;

    const setIsOpen = (val) => {
        if (readOnly) return;
        if (val === isOpen) return;
        if (externalOnToggle) {
            externalOnToggle(val);
        } else {
            setInternalIsOpen(val);
        }
        if (val && onOpen) onOpen();
        if (!val && onClose) onClose();
    };

    const [inputValue, setInputValue] = useState(() => value ? formatDate(value) : '');

    const [viewDate, setViewDate] = useState(() => {
        if (value && typeof value === 'string' && value.includes('-')) {
            const [y, m] = value.split('-').map(Number);
            if (!isNaN(y) && !isNaN(m)) {
                return new Date(y, m - 1, 1);
            }
        }
        return new Date();
    });
    const containerRef = useRef(null);
    const dropdownRef = useRef(null);
    const [coords, setCoords] = useState({ top: 0, left: 0 });

    const updatePosition = () => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const el = dropdownRef.current;
        const dropdownWidth = (el && el.offsetWidth) ? el.offsetWidth : (compact ? 260 : 350);
        const dropdownHeight = (el && el.offsetHeight) ? el.offsetHeight : (compact ? 285 : 390);

        // Auto determine whether to drop up or drop down
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        let top;
        if (dropUp || (spaceBelow < dropdownHeight && spaceAbove > spaceBelow)) {
            top = Math.max(8, rect.top - dropdownHeight - 6);
        } else {
            top = rect.bottom + 6;
            if (top + dropdownHeight > window.innerHeight - 8) {
                if (spaceAbove >= dropdownHeight) {
                    top = Math.max(8, rect.top - dropdownHeight - 6);
                } else {
                    top = Math.max(8, window.innerHeight - dropdownHeight - 8);
                }
            }
        }

        // Horizontal positioning: align right if explicitly set or if extending past right edge
        let left;
        if (rightAlign || (rect.left + dropdownWidth > window.innerWidth - 10)) {
            left = rect.right - dropdownWidth;
        } else {
            left = rect.left;
        }

        // Clamp horizontally so it stays within viewport
        if (left + dropdownWidth > window.innerWidth - 8) {
            left = window.innerWidth - dropdownWidth - 8;
        }
        if (left < 8) {
            left = 8;
        }

        setCoords({ top, left });
    };

    useLayoutEffect(() => {
        if (!isOpen) return;
        updatePosition();
    }, [isOpen, compact, rightAlign, dropUp, viewDate]);

    useEffect(() => {
        if (!isOpen) return;

        const handleScrollOrResize = () => {
            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            if (rect.bottom < 0 || rect.top > window.innerHeight) {
                setIsOpen(false);
                return;
            }
            updatePosition();
        };

        window.addEventListener('scroll', handleScrollOrResize, true);
        window.addEventListener('resize', handleScrollOrResize);
        return () => {
            window.removeEventListener('scroll', handleScrollOrResize, true);
            window.removeEventListener('resize', handleScrollOrResize);
        };
    }, [isOpen, compact, rightAlign, dropUp, viewDate]);

    useEffect(() => {
        setInputValue(value ? formatDate(value) : '');
        if (value && typeof value === 'string' && value.includes('-')) {
            const [y, m] = value.split('-').map(Number);
            if (!isNaN(y) && !isNaN(m)) {
                setViewDate(new Date(y, m - 1, 1));
            }
        }
    }, [value]);

    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event) => {
            if (
                containerRef.current && !containerRef.current.contains(event.target) &&
                dropdownRef.current && !dropdownRef.current.contains(event.target)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [isOpen]);

    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const getDaysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (month, year) => new Date(year, month, 1).getDay();

    const handlePrevMonth = () => {
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
    };

    const handleDateSelect = (day) => {
        const year = viewDate.getFullYear();
        const month = String(viewDate.getMonth() + 1).padStart(2, '0');
        const d = String(day).padStart(2, '0');
        const formatted = `${year}-${month}-${d}`;

        setInputValue(formatDate(formatted));
        onChange({ target: { name, value: formatted } });
        setIsOpen(false);
    };

    const handleInputChange = (e) => {
        if (readOnly) return;
        const text = e.target.value;
        setInputValue(text);

        if (!text.trim()) {
            onChange({ target: { name, value: '' } });
            return;
        }

        const parsed = parseDateInput(text);
        if (parsed) {
            onChange({ target: { name, value: parsed } });
            const [y, m] = parsed.split('-').map(Number);
            setViewDate(new Date(y, m - 1, 1));
        } else {
            // Allow typing custom text directly (e.g. 'N/A', 'Within 90 days', etc.)
            onChange({ target: { name, value: text } });
        }
    };

    const handleBlur = (e) => {
        if (containerRef.current && containerRef.current.contains(e.relatedTarget)) {
            return;
        }
        if (!inputValue.trim()) {
            if (value) onChange({ target: { name, value: '' } });
            setInputValue('');
            return;
        }
        const parsed = parseDateInput(inputValue);
        if (parsed) {
            if (parsed !== value) {
                onChange({ target: { name, value: parsed } });
            }
            setInputValue(formatDate(parsed));
            const [y, m] = parsed.split('-').map(Number);
            setViewDate(new Date(y, m - 1, 1));
        } else {
            // Keep custom text
            const trimmed = inputValue.trim();
            if (trimmed !== value) {
                onChange({ target: { name, value: trimmed } });
            }
            setInputValue(trimmed);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const parsed = parseDateInput(inputValue);
            if (parsed) {
                onChange({ target: { name, value: parsed } });
                setInputValue(formatDate(parsed));
                const [y, m] = parsed.split('-').map(Number);
                setViewDate(new Date(y, m - 1, 1));
            } else {
                const trimmed = inputValue.trim();
                onChange({ target: { name, value: trimmed } });
                setInputValue(trimmed);
            }
            setIsOpen(false);
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        }
    };

    const daysInMonth = getDaysInMonth(viewDate.getMonth(), viewDate.getFullYear());
    const firstDay = getFirstDayOfMonth(viewDate.getMonth(), viewDate.getFullYear());
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const blanks = Array.from({ length: firstDay }, (_, i) => i);

    return (
        <div className={`date-picker-container ${readOnly ? 'read-only' : ''}`} ref={containerRef}>
            {label && <label className={labelClassName}>{label}</label>}
            <div className="date-picker-input-wrapper">
                <input
                    type="text"
                    readOnly={readOnly}
                    value={inputValue}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    onClick={() => {
                        if (!readOnly && !isOpen) {
                            setIsOpen(true);
                        }
                    }}
                    placeholder={placeholder || 'Select Date'}
                    required={required}
                    autoComplete="off"
                    className={`date-picker-input ${value ? 'has-value' : ''} ${compact ? 'compact' : ''} ${readOnly ? 'read-only-input' : ''}`}
                />
                <div className="date-picker-icons-right">
                    {value && !readOnly && (
                        <button
                            type="button"
                            tabIndex={-1}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setInputValue('');
                                onChange({ target: { name, value: '' } });
                            }}
                            className="date-picker-clear-btn"
                            title="Clear Date"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    )}
                    <button
                        type="button"
                        tabIndex={-1}
                        onMouseDown={(e) => {
                            if (readOnly) return;
                            e.preventDefault();
                            e.stopPropagation();
                            setIsOpen(!isOpen);
                        }}
                        className="date-picker-icon-btn"
                        title="Toggle Calendar"
                    >
                        <CalendarIcon className={`date-picker-icon ${readOnly ? 'opacity-50' : ''}`} />
                    </button>
                </div>
            </div>

            {isOpen && typeof document !== 'undefined' && createPortal(
                <div
                    ref={dropdownRef}
                    style={{
                        position: 'fixed',
                        top: `${coords.top}px`,
                        left: `${coords.left}px`,
                        zIndex: 999999,
                        margin: 0
                    }}
                    className={`date-picker-dropdown ${compact ? 'compact' : ''}`}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <div className="date-picker-header">
                        <button
                            type="button"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handlePrevMonth();
                            }}
                            className="date-picker-nav-btn"
                        >
                            <ChevronLeftIcon className="w-5 h-5" />
                        </button>
                        <div className="date-picker-month-year flex items-center gap-1">
                            <select
                                value={viewDate.getMonth()}
                                onChange={(e) => {
                                    setViewDate(new Date(viewDate.getFullYear(), parseInt(e.target.value), 1));
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="date-picker-select"
                            >
                                {months.map((m, idx) => (
                                    <option key={m} value={idx}>{m}</option>
                                ))}
                            </select>
                            <select
                                value={viewDate.getFullYear()}
                                onChange={(e) => {
                                    setViewDate(new Date(parseInt(e.target.value), viewDate.getMonth(), 1));
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="date-picker-select"
                            >
                                {(() => {
                                    const currentYear = new Date().getFullYear();
                                    const yearsList = Array.from({ length: 60 }, (_, i) => currentYear - 40 + i);
                                    return yearsList.map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ));
                                })()}
                            </select>
                        </div>
                        <button
                            type="button"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleNextMonth();
                            }}
                            className="date-picker-nav-btn"
                        >
                            <ChevronRightIcon className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="date-picker-weekdays">
                        {['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].map(d => (
                            <div key={d} className="date-picker-weekday">{d}</div>
                        ))}
                    </div>

                    <div className="date-picker-days">
                        {blanks.map(b => <div key={`b-${b}`} className="date-picker-blank"></div>)}
                        {days.map(d => {
                            const today = new Date();
                            const isToday = today.getFullYear() === viewDate.getFullYear() &&
                                today.getMonth() === viewDate.getMonth() &&
                                today.getDate() === d;

                            let isSelected = false;
                            if (value && value.includes('-')) {
                                const [vY, vM, vD] = value.split('-').map(Number);
                                isSelected = vY === viewDate.getFullYear() &&
                                    vM === (viewDate.getMonth() + 1) &&
                                    vD === d;
                            }

                            return (
                                <button
                                    key={d}
                                    type="button"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleDateSelect(d);
                                    }}
                                    className={`date-picker-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
                                >
                                    {d}
                                </button>
                            );
                        })}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default CustomDatePicker;
