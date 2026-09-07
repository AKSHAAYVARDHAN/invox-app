import { getNormalizedTimestamp } from './trendingScore';

/**
 * Formats a given date (Date, Timestamp, number, string) into a concise, relative time string
 * appropriate for the INVOX terminal aesthetic (e.g., 'just now', '5m ago', '2h ago', '3d ago').
 */
export function formatRelativeTime(dateInput: any): string {
    if (!dateInput) return 'recently';
    const timestamp = getNormalizedTimestamp(dateInput);
    const now = Date.now();
    const diff = Math.max(0, now - timestamp);
    const seconds = Math.floor(diff / 1000);

    if (seconds < 45) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    const years = Math.floor(days / 365);
    return `${years}y ago`;
}
