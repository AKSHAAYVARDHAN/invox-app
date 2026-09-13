import React, { useState, useRef, useEffect } from 'react';

interface CollapsibleTextProps {
    text: string;
    lines?: 3 | 4;
    className?: string;
}

/**
 * CollapsibleText
 * Renders a visual preview (approx 3-4 lines) for long text blocks with
 * // SHOW MORE and // SHOW LESS toggle buttons in INVOX aesthetic.
 * Preserves complete original text in memory without modifying the data.
 */
export const CollapsibleText: React.FC<CollapsibleTextProps> = ({
    text,
    lines = 3,
    className = '',
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isOverflowing, setIsOverflowing] = useState(() => {
        if (!text) return false;
        const newlineCount = (text.match(/\n/g) || []).length;
        return text.length > 250 || newlineCount >= lines;
    });
    const textRef = useRef<HTMLParagraphElement>(null);

    const clampClass = lines === 4 ? 'line-clamp-4' : 'line-clamp-3';

    useEffect(() => {
        const el = textRef.current;
        if (!el) return;

        const checkOverflow = () => {
            if (!el) return;
            // Only update overflow detection while collapsed
            if (!isExpanded) {
                const hasOverflow = el.scrollHeight > el.clientHeight + 1;
                setIsOverflowing(hasOverflow);
            }
        };

        checkOverflow();
        window.addEventListener('resize', checkOverflow);
        const raf = requestAnimationFrame(checkOverflow);

        return () => {
            window.removeEventListener('resize', checkOverflow);
            cancelAnimationFrame(raf);
        };
    }, [text, lines, isExpanded]);

    if (!text) return null;

    return (
        <div className="space-y-1">
            <p
                ref={textRef}
                className={`${className} ${!isExpanded ? `${clampClass} overflow-hidden` : ''} whitespace-pre-wrap break-words`}
            >
                {text}
            </p>
            {isOverflowing && (
                <div className="pt-0.5">
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsExpanded(prev => !prev);
                        }}
                        className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-mono text-zinc-400 hover:text-zinc-200 uppercase font-bold tracking-wider transition-colors cursor-pointer select-none"
                    >
                        <span>{isExpanded ? '// SHOW LESS' : '// SHOW MORE'}</span>
                        <span className="text-zinc-500 text-[9px] font-normal leading-none">
                            {isExpanded ? '▴' : '▾'}
                        </span>
                    </button>
                </div>
            )}
        </div>
    );
};
