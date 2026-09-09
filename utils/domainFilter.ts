import { Post, Poll, PostType } from '../types';

/**
 * Normalization dictionary for common domain sectors and synonyms
 * Allows cross-matching between domain classifications and category tags.
 */
const DOMAIN_SYNONYMS: Record<string, string[]> = {
    // 10 Top-Level Domains
    'technology': ['technology', 'tech', 'development', 'coding', 'software', 'engineering', 'dev', 'ai', 'artificial intelligence', 'robotics', 'code', 'hardware', 'cybersecurity', 'web3', 'it'],
    'science': ['science', 'scientific', 'physics', 'astronomy', 'space', 'cosmos', 'biology', 'chemistry', 'laboratory', 'quantum', 'nature', 'genetics', 'ecology', 'neuroscience'],
    'business': ['business', 'commerce', 'sales', 'deals', 'marketing', 'enterprise', 'management', 'corporate', 'strategy', 'contracts', 'b2b', 'crm', 'procurement', 'advertising', 'pr', 'brand'],
    'startups & entrepreneurship': ['startups & entrepreneurship', 'startup', 'start up', 'startups', 'entrepreneurship', 'founder', 'product', 'venture', 'growth', 'incubator', 'pitch', 'mvp', 'scaleup', 'vc', 'bootstrapping'],
    'design': ['design', 'ui', 'ux', 'product design', 'creative', 'graphics', 'visual', 'figma', 'prototype', 'typography', 'spatial', 'wireframe', 'art direction', 'interface'],
    'arts & culture': ['arts & culture', 'art', 'arts', 'culture', 'music', 'creative', 'entertainment', 'film', 'photography', 'writing', 'literature', 'museum', 'painting', 'media', 'heritage'],
    'health & medicine': ['health & medicine', 'health', 'medicine', 'healthcare', 'health care', 'medical', 'wellness', 'biotech', 'fitness', 'mental health', 'clinical', 'pharma', 'sports'],
    'education & research': ['education & research', 'education', 'research', 'academic', 'learning', 'school', 'university', 'study', 'teaching', 'content', 'editorial', 'benchmarks', 'whitepapers', 'edtech', 'curriculum'],
    'finance': ['finance', 'financial', 'fintech', 'trading', 'stock market', 'investing', 'crypto', 'revenue', 'money', 'banking', 'venture capital', 'arr', 'valuation', 'capital', 'economics'],
    'society & ideas': ['society & ideas', 'society', 'ideas', 'community', 'culture', 'philosophy', 'social', 'policy', 'humanities', 'governance', 'opinion', 'discussions', 'ethics', 'future', 'sociology', 'public'],

    // Legacy domain synonym fallbacks (backward compatibility)
    'development': ['development', 'coding', 'technology', 'tech', 'software', 'engineering', 'dev', 'ai'],
    'product': ['product', 'start up', 'startup', 'startups & entrepreneurship', 'business', 'venture'],
    'marketing': ['marketing', 'growth', 'advertising', 'brand', 'business', 'pr'],
    'sales': ['sales', 'revenue', 'business', 'deals', 'finance', 'b2b'],
    'content': ['content', 'editorial', 'writing', 'education & research', 'science', 'research', 'media'],
};

/**
 * Checks whether an item matches one or more selected domains using OR logic.
 * If selectedDomains is empty, returns true (All Domains).
 */
export function matchesDomain(
    item: {
        domain?: string;
        category?: string;
        tags?: string[];
        channelName?: string;
    },
    selectedDomains: string[]
): boolean {
    if (!selectedDomains || selectedDomains.length === 0) {
        return true;
    }

    // Treat 'All' or 'All Domains' as no domain filter
    const activeDomains = selectedDomains.filter(d => {
        const lower = d.trim().toLowerCase();
        return lower !== 'all' && lower !== 'all domains';
    });

    if (activeDomains.length === 0) {
        return true;
    }

    const itemDomain = (item.domain || '').trim().toLowerCase();
    const itemCategory = (item.category || '').trim().toLowerCase();
    const itemTags = (item.tags || []).map(t => t.trim().toLowerCase());

    return activeDomains.some(selected => {
        const selLower = selected.trim().toLowerCase();
        const synonyms = DOMAIN_SYNONYMS[selLower] || [selLower];

        // 1. Direct domain match
        if (itemDomain && (itemDomain === selLower || itemDomain.includes(selLower) || selLower.includes(itemDomain))) {
            return true;
        }

        // 2. Direct category match
        if (itemCategory && (itemCategory === selLower || itemCategory.includes(selLower) || selLower.includes(itemCategory))) {
            return true;
        }

        // 3. Synonym matching against domain, category, tags
        return synonyms.some(syn => 
            (itemDomain && (itemDomain === syn || itemDomain.includes(syn) || syn.includes(itemDomain))) ||
            (itemCategory && (itemCategory === syn || itemCategory.includes(syn) || syn.includes(itemCategory))) ||
            itemTags.some(tag => tag === syn || tag.includes(syn) || syn.includes(tag))
        );
    });
}

/**
 * Checks whether an item matches a search term across text corpus
 */
export function matchesContentSearch(
    item: {
        content?: string;
        aiSummary?: string;
        question?: string;
        description?: string;
        category?: string;
        domain?: string;
        tags?: string[];
        author?: { name?: string; username?: string };
        options?: Array<{ text: string }>;
    },
    searchTerm: string
): boolean {
    if (!searchTerm || !searchTerm.trim()) {
        return true;
    }

    const term = searchTerm.trim().toLowerCase();

    const corpus = [
        item.content,
        item.aiSummary,
        item.question,
        item.description,
        item.category,
        item.domain,
        ...(item.tags || []),
        item.author?.name,
        item.author?.username,
        ...(item.options?.map(o => o.text) || [])
    ].filter(Boolean).join(' ').toLowerCase();

    return corpus.includes(term);
}

/**
 * Reusable domain filtering function for any collection of items.
 */
export function applyDomainFilter<T extends { domain?: string; category?: string; tags?: string[]; channelName?: string }>(
    items: T[],
    selectedDomains: string[]
): T[] {
    if (!selectedDomains || selectedDomains.length === 0) {
        return items;
    }
    return items.filter(item => matchesDomain(item, selectedDomains));
}

/**
 * Reusable domain + search filter for content items.
 */
export function applyDomainAndSearchFilter<T extends {
    domain?: string;
    category?: string;
    tags?: string[];
    channelName?: string;
    content?: string;
    aiSummary?: string;
    question?: string;
    description?: string;
    author?: { name?: string; username?: string };
    options?: Array<{ text: string }>;
}>(
    items: T[],
    selectedDomains: string[],
    searchTerm: string
): T[] {
    return items.filter(item => 
        matchesDomain(item, selectedDomains) && 
        matchesContentSearch(item, searchTerm)
    );
}

export interface ContentCounts {
    all: number;
    threads: number;
    queries: number;
    polls: number;
    feeds: number;
}

/**
 * Calculates dynamic counts based on filtered items
 */
export function calculateContentCounts(
    posts: Post[],
    polls: Poll[]
): ContentCounts {
    let threads = 0;
    let queries = 0;
    let feeds = 0;

    for (const p of posts) {
        if (p.type === PostType.Thread) threads++;
        else if (p.type === PostType.Query) queries++;
        else if (p.type === PostType.Feed || !p.type) feeds++;
    }

    const pollsCount = polls.length;
    // In Discover "All" combines threads, queries, and polls
    const all = threads + queries + pollsCount;

    return {
        all,
        threads,
        queries,
        polls: pollsCount,
        feeds,
    };
}
