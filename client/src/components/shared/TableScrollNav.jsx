import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeftIcon, ChevronRightIcon } from '../Icons';

const TableScrollNav = ({ containerRef, count, className = '' }) => {
    const placeholderRef = useRef(null);
    const scrollIntervalRef = useRef(null);
    const [scrollProgress, setScrollProgress] = useState(0);
    const [canScroll, setCanScroll] = useState(false);
    const [isFloating, setIsFloating] = useState(false);
    const [floatBounds, setFloatBounds] = useState({ left: 0, width: 0, bottom: 0, inModal: false });

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

    const getScrollParent = (node) => {
        if (!node) return null;
        let parent = node.parentElement;
        while (parent && parent !== document.body && parent !== document.documentElement) {
            const style = window.getComputedStyle(parent);
            const overflowY = style.overflowY;
            if (overflowY === 'auto' || overflowY === 'scroll') {
                return parent;
            }
            parent = parent.parentElement;
        }
        return window;
    };

    const updateLayout = useCallback(() => {
        const tableEl = getTargetElement();
        const anchorEl = placeholderRef.current;
        if (!tableEl || !anchorEl) return;

        // Check horizontal scroll capability
        const maxScroll = tableEl.scrollWidth - tableEl.clientWidth;
        const canScrollX = maxScroll > 2;
        setCanScroll(canScrollX);

        if (canScrollX) {
            const progress = Math.min(100, Math.max(0, (tableEl.scrollLeft / maxScroll) * 100));
            setScrollProgress(progress);
        } else {
            setScrollProgress(0);
        }

        // Measure viewports
        const scrollParent = getScrollParent(tableEl);
        const tableRect = tableEl.getBoundingClientRect();
        const anchorRect = anchorEl.getBoundingClientRect();

        let viewTop = 0;
        let viewBottom = window.innerHeight;
        let viewLeft = 0;
        let viewRight = window.innerWidth;

        if (scrollParent && scrollParent !== window) {
            const parentRect = scrollParent.getBoundingClientRect();
            viewTop = Math.max(0, parentRect.top);
            viewBottom = Math.min(window.innerHeight, parentRect.bottom);
            viewLeft = Math.max(0, parentRect.left);
            viewRight = Math.min(window.innerWidth, parentRect.right);
        }

        const isTableVisible =
            tableRect.width > 50 &&
            tableRect.height > 20 &&
            tableRect.top < viewBottom - 40 &&
            tableRect.bottom > viewTop + 40;

        // Anchor is the natural bottom of the table. If it's below viewBottom - 10, it's off-screen
        const isAnchorBelowView = anchorRect.top > viewBottom - 10;

        if (canScrollX && isTableVisible && isAnchorBelowView) {
            const left = Math.max(tableRect.left, viewLeft);
            const right = Math.min(tableRect.right, viewRight);
            const width = Math.max(0, right - left);
            const bottom = Math.max(0, window.innerHeight - viewBottom);
            const inModal = Boolean(tableEl.closest('.fixed.inset-0, [role="dialog"]'));

            if (width > 50) {
                setFloatBounds({ left, width, bottom, inModal });
                setIsFloating(true);
                return;
            }
        }

        setIsFloating(false);
    }, [getTargetElement]);

    useEffect(() => {
        const tableEl = getTargetElement();
        if (!tableEl) return;

        let rafId = null;
        const scheduleUpdate = () => {
            if (rafId) return;
            rafId = requestAnimationFrame(() => {
                rafId = null;
                updateLayout();
            });
        };

        scheduleUpdate();

        tableEl.addEventListener('scroll', scheduleUpdate, { passive: true });
        window.addEventListener('resize', scheduleUpdate);
        window.addEventListener('scroll', scheduleUpdate, { capture: true, passive: true });

        let resizeObserver;
        if (window.ResizeObserver) {
            resizeObserver = new ResizeObserver(() => {
                scheduleUpdate();
            });
            resizeObserver.observe(tableEl);
            if (tableEl.firstElementChild) {
                resizeObserver.observe(tableEl.firstElementChild);
            }
            if (placeholderRef.current) {
                resizeObserver.observe(placeholderRef.current);
            }
        }

        return () => {
            tableEl.removeEventListener('scroll', scheduleUpdate);
            window.removeEventListener('resize', scheduleUpdate);
            window.removeEventListener('scroll', scheduleUpdate, { capture: true });
            if (resizeObserver) resizeObserver.disconnect();
            if (rafId) cancelAnimationFrame(rafId);
            if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
        };
    }, [getTargetElement, updateLayout, count]);

    const handleScrollStep = (direction) => {
        const el = getTargetElement();
        if (!el) return;
        const step = 350;
        el.scrollBy({
            left: direction === 'left' ? -step : step,
            behavior: 'smooth'
        });
    };

    const startContinuousScroll = (direction) => {
        handleScrollStep(direction);
        if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = setInterval(() => {
            handleScrollStep(direction);
        }, 140);
    };

    const stopContinuousScroll = () => {
        if (scrollIntervalRef.current) {
            clearInterval(scrollIntervalRef.current);
            scrollIntervalRef.current = null;
        }
    };

    const handleProgressBarClick = (e) => {
        const el = getTargetElement();
        if (!el) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const ratio = Math.max(0, Math.min(1, clickX / rect.width));
        const maxScroll = el.scrollWidth - el.clientWidth;
        el.scrollTo({
            left: ratio * maxScroll,
            behavior: 'smooth'
        });
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
                    onMouseDown={() => startContinuousScroll('left')}
                    onMouseUp={stopContinuousScroll}
                    onMouseLeave={stopContinuousScroll}
                    onTouchStart={() => startContinuousScroll('left')}
                    onTouchEnd={stopContinuousScroll}
                    disabled={scrollProgress <= 0}
                    className="p-1 px-3 rounded-full text-gray-600 hover:text-blue-600 hover:bg-blue-50/80 disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-gray-400 transition-all cursor-pointer disabled:cursor-not-allowed active:scale-90 flex items-center justify-center shrink-0"
                    title="Scroll Left (Click or hold)"
                >
                    <ChevronLeftIcon className="w-4 h-4 stroke-[2.5]" />
                </button>

                <div className="h-3.5 w-px bg-gray-200/90 mx-0.5 shrink-0"></div>

                <button
                    type="button"
                    onClick={() => handleScrollStep('right')}
                    onMouseDown={() => startContinuousScroll('right')}
                    onMouseUp={stopContinuousScroll}
                    onMouseLeave={stopContinuousScroll}
                    onTouchStart={() => startContinuousScroll('right')}
                    onTouchEnd={stopContinuousScroll}
                    disabled={scrollProgress >= 100}
                    className="p-1 px-3 rounded-full text-gray-600 hover:text-blue-600 hover:bg-blue-50/80 disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-gray-400 transition-all cursor-pointer disabled:cursor-not-allowed active:scale-90 flex items-center justify-center shrink-0"
                    title="Scroll Right (Click or hold)"
                >
                    <ChevronRightIcon className="w-4 h-4 stroke-[2.5]" />
                </button>
            </div>

            <div className="flex items-center justify-end gap-2 min-w-[70px]">
                {canScroll && (
                    <>
                        <div
                            onClick={handleProgressBarClick}
                            className="w-14 h-1.5 bg-gray-200/80 rounded-full overflow-hidden hidden sm:block cursor-pointer hover:bg-gray-300 transition-colors"
                            title="Click anywhere to jump"
                        >
                            <div
                                className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-150 pointer-events-none"
                                style={{ width: `${scrollProgress}%` }}
                            ></div>
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 font-mono w-7 text-right">
                            {Math.round(scrollProgress)}%
                        </span>
                    </>
                )}
            </div>
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
                        bottom: `${floatBounds.bottom}px`,
                        zIndex: floatBounds.inModal ? 60 : 25,
                    }}
                    className={`border-t border-gray-200/90 bg-white/95 backdrop-blur-md shadow-[0_-4px_16px_rgba(0,0,0,0.08)] px-4 py-1.5 flex items-center justify-between select-none rounded-b-2xl transition-all duration-150 ${className}`}
                >
                    {renderInnerContent()}
                </div>,
                portalTarget
            )}
        </>
    );
};

export default TableScrollNav;

