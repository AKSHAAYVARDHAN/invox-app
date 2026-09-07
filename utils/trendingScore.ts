import { Post, Poll } from '../types';

export interface TrendingWeights {
    likeWeight: number;
    commentWeight: number;
    shareWeight: number;
    saveWeight: number;
    pollVoteWeight: number;
    viewsWeight: number;
    gravity: number; // Exponent for time decay
    timeOffsetHours: number; // Halflife smoother
}

export const DEFAULT_TRENDING_WEIGHTS: TrendingWeights = {
    likeWeight: 3.5,
    commentWeight: 5.0,
    shareWeight: 4.0,
    saveWeight: 4.5,
    pollVoteWeight: 4.0,
    viewsWeight: 0.25,
    gravity: 1.35,
    timeOffsetHours: 2.0,
};

/**
 * Extracts normalized milliseconds timestamp from various date representations
 * (Date object, string, number, Firestore Timestamp)
 */
export function getNormalizedTimestamp(dateInput: any): number {
    if (!dateInput) return Date.now();
    if (dateInput instanceof Date) return dateInput.getTime();
    if (typeof dateInput === 'number') return dateInput;
    if (typeof dateInput === 'string') {
        const parsed = new Date(dateInput).getTime();
        return isNaN(parsed) ? Date.now() : parsed;
    }
    if (typeof dateInput === 'object') {
        if (typeof dateInput.toDate === 'function') {
            try {
                return dateInput.toDate().getTime();
            } catch {
                // ignore and fall through
            }
        }
        if (typeof dateInput.seconds === 'number') {
            return dateInput.seconds * 1000 + Math.floor((dateInput.nanoseconds || 0) / 1000000);
        }
    }
    return Date.now();
}

/**
 * Calculates a composite raw engagement score for posts, queries, threads, or polls.
 */
export function calculateRawEngagement(
    item: any, 
    weights: TrendingWeights = DEFAULT_TRENDING_WEIGHTS
): number {
    if (!item) return 0;

    const likes = Number(item.stats?.likes ?? item.likeCount ?? 0) || 0;
    const comments = Number(item.stats?.comments ?? item.commentCount ?? 0) || 0;
    const views = Number(item.stats?.views ?? item.viewCount ?? 0) || 0;
    const saves = Number(item.saveCount ?? 0) || 0;
    const shares = Number(item.shareCount ?? 0) || 0;

    // Poll participation signals
    let pollVotes = 0;
    if (typeof item.totalVotes === 'number') {
        pollVotes += item.totalVotes;
    }
    if (Array.isArray(item.options)) {
        for (const opt of item.options) {
            if (typeof opt?.voteCount === 'number') {
                pollVotes += opt.voteCount;
            }
        }
    }

    // Sub-linear view score so high-view items don't dwarf active engagement
    const logViews = views > 0 ? Math.log10(views + 1) * 10 : 0;

    const score = 
        (likes * weights.likeWeight) +
        (comments * weights.commentWeight) +
        (shares * weights.shareWeight) +
        (saves * weights.saveWeight) +
        (pollVotes * weights.pollVoteWeight) +
        (logViews * weights.viewsWeight);

    return Math.max(0, score);
}

/**
 * Calculates trending score with recency time decay:
 * Score = (RawEngagement + baseline) / (AgeInHours + timeOffset)^gravity
 */
export function calculateTrendingScore(
    item: any,
    nowMs: number = Date.now(),
    weights: TrendingWeights = DEFAULT_TRENDING_WEIGHTS
): number {
    if (!item) return 0;

    const rawEngagement = calculateRawEngagement(item, weights);
    const createdMs = getNormalizedTimestamp(item.createdAt);
    
    // Age in hours, minimum 0.05 hr (3 minutes) to avoid zero division or infinite spikes
    const ageHours = Math.max(0.05, (nowMs - createdMs) / (1000 * 60 * 60));
    const decay = Math.pow(ageHours + weights.timeOffsetHours, weights.gravity);

    // Baseline 0.5 allows fresh content to rank smoothly even with 0 initial engagement
    return (rawEngagement + 0.5) / decay;
}

/**
 * Sorts any list of items (Posts, Polls, etc.) by trending score in descending order.
 * Falls back gracefully to recency if scores are tied or engagement is low.
 */
export function sortItemsByTrending<T extends { createdAt?: any }>(
    items: T[],
    nowMs: number = Date.now(),
    weights: TrendingWeights = DEFAULT_TRENDING_WEIGHTS
): T[] {
    if (!Array.isArray(items) || items.length <= 1) return items;

    const scored = items.map((item, index) => {
        const score = calculateTrendingScore(item, nowMs, weights);
        const timestamp = getNormalizedTimestamp(item.createdAt);
        return { item, score, timestamp, originalIndex: index };
    });

    scored.sort((a, b) => {
        // Higher trending score first
        if (Math.abs(b.score - a.score) > 0.0001) {
            return b.score - a.score;
        }
        // Fallback to recency
        if (b.timestamp !== a.timestamp) {
            return b.timestamp - a.timestamp;
        }
        return a.originalIndex - b.originalIndex;
    });

    return scored.map(s => s.item);
}
