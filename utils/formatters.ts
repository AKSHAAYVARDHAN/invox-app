/**
 * Utility functions for formatting numbers, dates, and currency across the application.
 */

export const formatNumber = (num: number | undefined | null): string => {
    if (num === undefined || num === null || isNaN(Number(num))) return '0';
    const n = Number(num);
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
    return n.toString();
};

export const formatDate = (date: Date | string | number | undefined | null): string => {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
};
