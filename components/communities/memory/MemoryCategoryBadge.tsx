import React from 'react';
import type { MemoryCategory, MemorySignificance, MemoryStatus } from '../../../services/collectiveMemoryTypes';
import { MEMORY_CATEGORIES } from '../../../services/collectiveMemoryTypes';

export const CategoryIcon = ({
    category,
    className = 'w-3.5 h-3.5',
}: {
    category: MemoryCategory;
    className?: string;
}) => {
    switch (category) {
        case 'milestones':
            // Flag / Landmark
            return (
                <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                </svg>
            );
        case 'achievements':
            // Trophy / Award
            return (
                <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.504-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.004 0V9.75a3.75 3.75 0 00-7.5 0v4.5m7.5 0H9.5m7.5-6.75h2.625c.621 0 1.125.504 1.125 1.125v1.5a3 3 0 01-3 3h-.75M7.5 7.5H4.875C4.254 7.5 3.75 8.004 3.75 8.625v1.5a3 3 0 003 3h.75" />
                </svg>
            );
        case 'gatherings':
            // Calendar / Assembly
            return (
                <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
                </svg>
            );
        case 'decisions':
            // Scale / Resolution / Shield
            return (
                <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0l-4-4m4 4l4-4M3.75 7.5h16.5M6 10.5l-2.25 4.5h4.5L6 10.5zm12 0l-2.25 4.5h4.5L18 10.5z" />
                </svg>
            );
        case 'traditions':
            // Flame / Continuity torch
            return (
                <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 3.75 3.75 0 001.43 3.921z" />
                </svg>
            );
        case 'contributions':
            // Puzzle / Building block
            return (
                <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.46 3.59.837 5.753.303 1.745.69 3.568 1.15 5.378a.64.64 0 00.627.48h10.772a.64.64 0 00.627-.48 57.94 57.94 0 001.15-5.378c.377-2.163.65-4.14.837-5.753-1.38.16-2.77.262-4.163.3a.64.64 0 01-.657-.643v0z" />
                </svg>
            );
        default:
            return null;
    }
};

export const MemoryCategoryBadge: React.FC<{
    category: MemoryCategory;
    size?: 'sm' | 'md';
    className?: string;
}> = ({ category, size = 'sm', className = '' }) => {
    const meta = MEMORY_CATEGORIES[category] || MEMORY_CATEGORIES.milestones;

    const sizeClasses = size === 'sm'
        ? 'px-2 py-0.5 text-[10px] gap-1.5'
        : 'px-2.5 py-1 text-xs gap-2';

    return (
        <span
            className={`inline-flex items-center font-bold font-mono uppercase tracking-wider border shadow-sm ${meta.badgeBg} ${meta.badgeBorder} ${meta.badgeText} ${sizeClasses} ${className}`}
        >
            <CategoryIcon category={category} className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
            <span>{meta.shortLabel}</span>
        </span>
    );
};

export const SignificanceBadge: React.FC<{
    significance: MemorySignificance;
    size?: 'sm' | 'md';
}> = ({ significance, size = 'sm' }) => {
    if (significance === 'standard') return null;

    const isPivotal = significance === 'pivotal';
    const text = isPivotal ? 'PIVOTAL MOMENT' : 'MAJOR EVENT';

    const classes = isPivotal
        ? 'bg-amber-950/70 border-amber-500 text-amber-200'
        : 'bg-zinc-900 border-zinc-600 text-zinc-200';

    const sizeClasses = size === 'sm'
        ? 'px-1.5 py-0.5 text-[9px]'
        : 'px-2 py-0.5 text-[10px]';

    return (
        <span
            className={`inline-flex items-center font-mono font-bold uppercase tracking-widest border ${classes} ${sizeClasses}`}
        >
            <span className="w-1.5 h-1.5 rounded-full mr-1 bg-current animate-pulse"></span>
            <span>{text}</span>
        </span>
    );
};

export const MemoryStatusBadge: React.FC<{
    status: MemoryStatus;
}> = ({ status }) => {
    if (status === 'published') return null;

    const isDraft = status === 'draft';
    return (
        <span
            className={`inline-flex items-center font-mono font-bold uppercase tracking-wider text-[9px] px-1.5 py-0.5 border ${
                isDraft
                    ? 'bg-zinc-900 border-zinc-700 text-zinc-400'
                    : 'bg-rose-950/40 border-rose-800 text-rose-400'
            }`}
        >
            {isDraft ? '// DRAFT' : '// ARCHIVED'}
        </span>
    );
};
