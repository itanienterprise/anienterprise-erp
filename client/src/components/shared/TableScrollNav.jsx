import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeftIcon, ChevronRightIcon } from '../Icons';

const TableScrollNav = ({ containerRef, count, className = '' }) => {
    const placeholderRef = useRef(null);
    const [scrollProgress, setScrollProgress] = useState(0);
    const [isFloating, setIsFloating] = useState(false);
    const [floatBounds, setFloatBounds] = useState({ left: 0, width: 0, inModal: false });

    // Target horizontally scrollable element
    const getTargetElement = useCallback(() => {
        if (containerRef && containerRef.current) {
            return containerRef.current;
        }
        const anchor = placeholderRef.current;
        if (anchor) {
            let prev = anchor.previousElementSibling;
            while (prev) {
                if (
                    prev.tagName === 'TABLE' ||
                    prev.querySelector('table') ||
                    prev.classList.contains('overflow-x-auto') ||
                    prev.scrollWidth > prev.clientWidth
                ) {
                    return prev;
                }
                prev = prev.previousElementSibling;
            }
            if (anchor.previousElementSibling) {
                return anchor.previousElementSibling;
            }
        }
        return null;
    }, [containerRef]);

    // Measure horizontal bounds ONLY on mount/resize (NEVER during scroll)
    const updateBounds = useCallback(() => {
        const tableEl = getTargetElement();
        if (!tableEl) return;
        const rect = tableEl.getBoundingClientRect();
        if (rect.width > 50) {
            const inModal = Boolean(tableEl.closest('.fixed.inset-0, [role="dialog"]'));
            setFloatBounds({
                left: rect.left,
                width: rect.width,
                inModal
            });
        }
    }, [getTargetElement]);

    // 1. Observe resize ONLY (no scroll listeners for bounds)
    useEffect(() => {
        const tableEl = getTargetElement();
        if (!tableEl) return;

        updateBounds();

        let ro;
        if (window.ResizeObserver) {
            ro = new ResizeObserver(() => updateBounds());
            ro.observe(tableEl);
        }

        window.addEventListener('resize', updateBounds);
        return () => {
            if (ro) ro.disconnect();
            window.removeEventListener('resize', updateBounds);
        };
    }, [getTargetElement, updateBounds, count]);

    // 2. High-performance IntersectionObserver for visibility (zero CPU during scrolling)
    useEffect(() => {
        const tableEl = getTargetElement();
        const anchorEl = placeholderRef.current;
        if (!tableEl || !anchorEl || !window.IntersectionObserver) return;

        let tableVisible = false;
        let anchorVisible = false;
        let anchorTop = 0;

        const evaluateDocking = () => {
            const maxScroll = tableEl.scrollWidth - tableEl.clientWidth;
            const hasHScroll = maxScroll > 2;
            const shouldDock = hasHScroll && tableVisible && !anchorVisible && anchorTop > 0;
            setIsFloating(shouldDock);
        };

        const tableObserver = new IntersectionObserver(
            ([entry]) => {
                if (!entry) return;
                tableVisible = entry.isIntersecting;
                evaluateDocking();
            },
            { threshold: [0, 0.05] }
        );

        const anchorObserver = new IntersectionObserver(
            ([entry]) => {
                if (!entry) return;
                anchorVisible = entry.isIntersecting;
                anchorTop = entry.boundingClientRect.top;
                evaluateDocking();
            },
            { threshold: [0, 0.5] }
        );

        tableObserver.observe(tableEl);
        anchorObserver.observe(anchorEl);

        return () => {
            tableObserver.disconnect();
            anchorObserver.disconnect();
        };
    }, [getTargetElement]);

    // 3. Track horizontal scroll progress purely to enable/disable buttons
    useEffect(() => {
        const tableEl = getTargetElement();
        if (!tableEl) return;

        let rafId = null;
        const handleTableScroll = () => {
            if (rafId) return;
            rafId = requestAnimationFrame(() => {
                rafId = null;
                const maxScroll = tableEl.scrollWidth - tableEl.clientWidth;
                if (maxScroll > 2) {
                    const progress = Math.min(100, Math.max(0, (tableEl.scrollLeft / maxScroll) * 100));
                    setScrollProgress(progress);
                } else {
                    setScrollProgress(0);
                }
            });
        };

        handleTableScroll();
        tableEl.addEventListener('scroll', handleTableScroll, { passive: true });

        return () => {
            tableEl.removeEventListener('scroll', handleTableScroll);
            if (rafId) cancelAnimationFrame(rafId);
        };
    }, [getTargetElement]);

    // One-click smooth navigation to last end or first
    const handleScrollStep = (direction) => {
        const el = getTargetElement();
        if (!el) return;
        const maxScroll = el.scrollWidth - el.clientWidth;
        if (maxScroll <= 0) return;

        if (direction === 'right') {
            // Smoothly glide to the last end of the row in 1 click
            el.scrollTo({
                left: maxScroll,
                behavior: 'smooth'
            });
        } else {
            // Smoothly glide to the first of the row in 1 click
            el.scrollTo({
                left: 0,
                behavior: 'smooth'
            });
        }
    };

    const displayCount = typeof count === 'number' ? count : null;

    const renderInnerContent = () => (
        <>
            <span className="text-[11px] font-medium text-gray-500 flex items-center gap-1.5 min-w-[70px]">
                {displayCount !== null ? (
                    <>
                        <span className="font-semibold text-gray-700">{displayCount}</span>
                        <span>{displayCount === 1 ? 'record' : 'records'}</span>
                    </>
                ) : null}
            </span>

            <div className="inline-flex items-center bg-white border border-gray-200/90 shadow-2xs rounded-full p-0.5">
                <button
                    type="button"
                    onClick={() => handleScrollStep('left')}
                    disabled={scrollProgress <= 1}
                    className="p-1 px-3.5 rounded-full text-gray-600 hover:text-blue-600 hover:bg-blue-50/80 disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-gray-400 transition-all cursor-pointer disabled:cursor-not-allowed active:scale-90 flex items-center justify-center shrink-0"
                    title="Go to First"
                >
                    <ChevronLeftIcon className="w-4 h-4 stroke-[2.5]" />
                </button>

                <div className="h-3.5 w-px bg-gray-200/90 mx-0.5 shrink-0"></div>

                <button
                    type="button"
                    onClick={() => handleScrollStep('right')}
                    disabled={scrollProgress >= 99}
                    className="p-1 px-3.5 rounded-full text-gray-600 hover:text-blue-600 hover:bg-blue-50/80 disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-gray-400 transition-all cursor-pointer disabled:cursor-not-allowed active:scale-90 flex items-center justify-center shrink-0"
                    title="Go to Last"
                >
                    <ChevronRightIcon className="w-4 h-4 stroke-[2.5]" />
                </button>
            </div>

            <div className="min-w-[70px]"></div>
        </>
    );

    const portalTarget = typeof document !== 'undefined' ? document.body : null;

    return (
        <>
            <div
                ref={placeholderRef}
                className={`border-t border-gray-100 bg-gray-50/60 px-4 py-1.5 flex items-center justify-between select-none ${className} ${isFloating ? 'opacity-0 pointer-events-none' : ''}`}
                aria-hidden={isFloating}
            >
                {renderInnerContent()}
            </div>

            {isFloating && portalTarget && createPortal(
                <div
                    style={{
                        position: 'fixed',
                        left: `${floatBounds.left}px`,
                        width: `${floatBounds.width}px`,
                        bottom: 0,
                        zIndex: floatBounds.inModal ? 60 : 25,
                    }}
                    className={`border-t border-gray-200 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.06)] px-4 py-1.5 flex items-center justify-between select-none rounded-t-lg md:rounded-b-2xl transition-all duration-150 ${className}`}
                >
                    {renderInnerContent()}
                </div>,
                portalTarget
            )}
        </>
    );
};

export default TableScrollNav;


