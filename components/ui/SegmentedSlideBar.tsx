import React from 'react';

export interface SegmentedSlideBarProps<T extends string> {
    tabs: readonly T[] | T[];
    activeTab: T;
    onChange: (tab: T) => void;
    className?: string;
}

export function SegmentedSlideBar<T extends string>({
    tabs,
    activeTab,
    onChange,
    className = 'mb-4',
}: SegmentedSlideBarProps<T>) {
    return (
        <div className={`flex space-x-1 border border-zinc-800 bg-[#0c0c0e] p-1 ${className}`}>
            {tabs.map((tab) => {
                const isActive = activeTab === tab;
                return (
                    <button
                        key={tab}
                        type="button"
                        onClick={() => onChange(tab)}
                        className={`flex-1 py-1.5 sm:py-2 rounded-none font-mono text-xs uppercase tracking-wider transition-all duration-150 ${
                            isActive
                                ? 'bg-zinc-800 text-white font-bold border border-zinc-700'
                                : 'text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent'
                        }`}
                    >
                        {tab}
                    </button>
                );
            })}
        </div>
    );
}

export default SegmentedSlideBar;
