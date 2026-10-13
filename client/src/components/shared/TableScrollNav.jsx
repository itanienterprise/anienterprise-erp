import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '../Icons';

const TableScrollNav = ({ containerRef, count, className = '' }) => {
    const internalNavRef = useRef(null);
    const [scrollProgress, setScrollProgress] = useState(0);

    const getTargetElement = () => {
        if (containerRef && containerRef.current) {
            return containerRef.current;
        }
        if (internalNavRef.current && internalNavRef.current.previousElementSibling) {
            return internalNavRef.current.previousElementSibling;
        }
        return null;
    };

    const updateScrollProgress = () => {
        const el = getTargetElement();
        if (!el) return;
        const { scrollLeft, scrollWidth, clientWidth } = el;
        const maxScroll = scrollWidth - clientWidth;
        if (maxScroll > 1) {
            setScrollProgress(Math.min(100, Math.max(0, (scrollLeft / maxScroll) * 100)));
        } else {
            setScrollProgress(0);
        }
    };

    useEffect(() => {
        const el = getTargetElement();
        if (!el) return;

        updateScrollProgress();

        const handleScroll = () => updateScrollProgress();
        const handleResize = () => updateScrollProgress();

        el.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('resize', handleResize);

        let resizeObserver;
        if (window.ResizeObserver) {
            resizeObserver = new ResizeObserver(() => {
                updateScrollProgress();
            });
            resizeObserver.observe(el);
            if (el.firstElementChild) {
                resizeObserver.observe(el.firstElementChild);
            }
        }

        return () => {
            el.removeEventListener('scroll', handleScroll);
            window.removeEventListener('resize', handleResize);
            if (resizeObserver) {
                resizeObserver.disconnect();
            }
        };
    }, [containerRef, count]);

    const handleScrollStep = (direction) => {
        const el = getTargetElement();
        if (!el) return;
        const step = 350;
        el.scrollBy({
            left: direction === 'left' ? -step : step,
            behavior: 'smooth'
        });
    };

    const displayCount = typeof count === 'number' ? count : null;

    return (
        <div
            ref={internalNavRef}
            className={`border-t border-gray-100 bg-gray-50/60 px-4 py-1.5 flex items-center justify-between select-none ${className}`}
        >
            <span className="text-[11px] font-medium text-gray-400">
                {displayCount !== null ? `${displayCount} ${displayCount === 1 ? 'record' : 'records'}` : ''}
            </span>
            <div className="inline-flex items-center bg-white border border-gray-200/90 shadow-2xs rounded-full p-0.5">
                <button
                    type="button"
                    onClick={() => handleScrollStep('left')}
                    disabled={scrollProgress <= 0}
                    className="p-1 px-3 rounded-full text-gray-600 hover:text-blue-600 hover:bg-blue-50/80 disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-gray-400 transition-all cursor-pointer disabled:cursor-not-allowed active:scale-90 flex items-center justify-center shrink-0"
                    title="Scroll Left"
                >
                    <ChevronLeftIcon className="w-4 h-4 stroke-[2.5]" />
                </button>

                <div className="h-3.5 w-px bg-gray-200/90 mx-0.5 shrink-0"></div>

                <button
                    type="button"
                    onClick={() => handleScrollStep('right')}
                    disabled={scrollProgress >= 100}
                    className="p-1 px-3 rounded-full text-gray-600 hover:text-blue-600 hover:bg-blue-50/80 disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-gray-400 transition-all cursor-pointer disabled:cursor-not-allowed active:scale-90 flex items-center justify-center shrink-0"
                    title="Scroll Right"
                >
                    <ChevronRightIcon className="w-4 h-4 stroke-[2.5]" />
                </button>
            </div>
            <div className="w-[60px]"></div>
        </div>
    );
};

export default TableScrollNav;
