import React, { useEffect, useRef } from 'react';
import { MagnifyingGlassIcon, CloseIcon } from '../ui/Icons';

interface ConversationSearchBarProps {
    isOpen: boolean;
    searchQuery: string;
    onQueryChange: (query: string) => void;
    onClose: () => void;
    totalMatches: number;
    currentMatchIndex: number;
    onPrevMatch: () => void;
    onNextMatch: () => void;
    placeholder?: string;
    maxWidth?: string;
}

export const ConversationSearchBar: React.FC<ConversationSearchBarProps> = ({
    isOpen,
    searchQuery,
    onQueryChange,
    onClose,
    totalMatches,
    currentMatchIndex,
    onPrevMatch,
    onNextMatch,
    placeholder = 'Search messages in this conversation...',
    maxWidth,
}) => {
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-focus input when opened
    useEffect(() => {
        if (isOpen) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [isOpen]);

    // Keyboard navigation handlers
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (e.shiftKey) {
                onPrevMatch();
            } else {
                onNextMatch();
            }
        }
    };

    if (!isOpen) return null;

    const hasQuery = searchQuery.trim().length > 0;

    return (
        <div className="h-11 border-b border-zinc-800 bg-[#0c0d10] flex-shrink-0 font-mono text-xs z-10 transition-all">
            <div
                className={`w-full h-full flex items-center justify-between gap-2.5 ${
                    maxWidth ? `${maxWidth} mx-auto px-4 sm:px-6 lg:px-8` : 'px-3 sm:px-4'
                }`}
            >
                {/* Search Input Container */}
                <div className="relative flex items-center flex-1 h-8 bg-[#121315] hover:bg-[#151619] border border-zinc-700 hover:border-zinc-500 focus-within:border-emerald-400 focus-within:ring-1 focus-within:ring-emerald-400/20 px-2.5 transition-colors">
                <MagnifyingGlassIcon className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0 mr-2 pointer-events-none" />
                <input
                    ref={inputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => onQueryChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    className="w-full bg-transparent text-xs text-white placeholder:text-zinc-500 focus:outline-none font-mono"
                    aria-label="Search conversation messages"
                />
                {searchQuery && (
                    <button
                        type="button"
                        onClick={() => onQueryChange('')}
                        className="text-zinc-400 hover:text-white px-1.5 py-0.5 hover:bg-zinc-800 transition-colors cursor-pointer flex-shrink-0 font-mono text-xs"
                        title="Clear query"
                        aria-label="Clear query"
                    >
                        ✕
                    </button>
                )}
            </div>

            {/* Match Counter & Next/Prev Navigation */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
                {hasQuery && (
                    totalMatches > 0 ? (
                        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-750 px-2 py-1 text-[11px] text-zinc-300 tabular-nums">
                            <span>
                                {currentMatchIndex + 1}/{totalMatches}
                            </span>
                            <div className="flex items-center gap-0.5 ml-1 border-l border-zinc-700 pl-1">
                                <button
                                    type="button"
                                    onClick={onPrevMatch}
                                    disabled={totalMatches <= 1}
                                    className="p-0.5 hover:text-white text-zinc-400 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                    title="Previous match (Shift+Enter)"
                                    aria-label="Previous match"
                                >
                                    ↑
                                </button>
                                <button
                                    type="button"
                                    onClick={onNextMatch}
                                    disabled={totalMatches <= 1}
                                    className="p-0.5 hover:text-white text-zinc-400 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                    title="Next match (Enter)"
                                    aria-label="Next match"
                                >
                                    ↓
                                </button>
                            </div>
                        </div>
                    ) : (
                        <span className="text-[10px] text-zinc-400 bg-zinc-900/80 px-2 py-1 border border-zinc-800">
                            No messages found
                        </span>
                    )
                )}

                {/* Close Search Button */}
                <button
                    type="button"
                    onClick={onClose}
                    className="h-8 px-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white text-[11px] uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1"
                    title="Close search"
                    aria-label="Close search"
                >
                    <CloseIcon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">DONE</span>
                </button>
            </div>
            </div>
        </div>
    );
};
