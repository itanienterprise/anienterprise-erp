import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from '../Icons';
import './CustomDatePicker.css';

const formatDate = (dateString) => {
    if (!dateString) return '-';
    const parts = dateString.split('-');
    if (parts.length === 3) {
        const day = parts[2].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[0];
        return `${day}/${month}/${year}`;
    }
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
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

    const [viewDate, setViewDate] = useState(() => {
        if (value && value.includes('-')) {
            const [y, m] = value.split('-').map(Number);
            return new Date(y, m - 1, 1);
        }
        return new Date();
    });
    const containerRef = useRef(null);

    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const years = useMemo(() => {
        const currentYear = new Date().getFullYear();
        const startYear = currentYear - 30;
        const endYear = currentYear + 10;
        const list = [];
        for (let y = startYear; y <= endYear; y++) {
            list.push(y);
        }
        return list;
    }, []);

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

        onChange({ target: { name, value: formatted } });
        setIsOpen(false);
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
                    readOnly
                    value={value ? formatDate(value) : ''}
                    onMouseDown={(e) => {
                        if (readOnly) return;
                        e.preventDefault();
                        setIsOpen(!isOpen);
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
                            onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onChange({ target: { name, value: '' } });
                            }}
                            className="date-picker-clear-btn"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    )}
                    <CalendarIcon className={`date-picker-icon ${readOnly ? 'opacity-50' : ''}`} />
                </div>
            </div>

            {isOpen && (
                <div className={`date-picker-dropdown ${compact ? 'compact' : ''} ${rightAlign ? 'right-align' : ''} ${dropUp ? 'drop-up' : ''}`}>
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
                        <div className="date-picker-month-year flex items-center justify-center gap-1">
                            <select
                                value={viewDate.getMonth()}
                                onChange={(e) => {
                                    setViewDate(new Date(viewDate.getFullYear(), parseInt(e.target.value), 1));
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="date-picker-header-select"
                            >
                                {months.map((m, idx) => (
                                    <option key={m} value={idx}>{m.slice(0, 3)}</option>
                                ))}
                            </select>
                            <select
                                value={viewDate.getFullYear()}
                                onChange={(e) => {
                                    setViewDate(new Date(parseInt(e.target.value), viewDate.getMonth(), 1));
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="date-picker-header-select"
                            >
                                {years.map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
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
                </div>
            )}
        </div>
    );
};

export default CustomDatePicker;
