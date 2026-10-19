import type { Project, Post } from '../types';
import { 
    getPostById, 
    getCollabPosts, 
    getShowcasePosts, 
    postToProject, 
    postToShowcaseProject, 
    isCollabSignal 
} from './postService';
import { suggestionProjects, mockProjects, mockForYouProjects } from '../pages/Spotlight';

/**
 * Fetches project details by ID with comprehensive fallback support across:
 * 1. Live Firestore post document (Showcase or Collab)
 * 2. Static suggestion catalog projects
 * 3. Seed/Mock showcase projects
 * 4. Seed/Mock collab projects
 */
export async function fetchProjectById(projectId: string): Promise<Project | null> {
    if (!projectId) return null;

    // 1. Check live Firestore
    try {
        const post = await getPostById(projectId);
        if (post) {
            if (isCollabSignal(post)) {
                return postToProject(post);
            }
            return postToShowcaseProject(post);
        }
    } catch (e) {
        console.warn(`[FETCH_PROJECT_FIRESTORE_WARN] Project ${projectId}:`, e);
    }

    // 2. Check Suggestion catalog
    const suggestionMatch = suggestionProjects.find(p => p.id === projectId);
    if (suggestionMatch) {
        return suggestionMatch;
    }

    // 3. Check mock showcase projects
    const mockShowcaseMatch = mockProjects.find(p => p.id === projectId);
    if (mockShowcaseMatch) {
        return mockShowcaseMatch;
    }

    // 4. Check mock collab projects
    const mockCollabMatch = mockForYouProjects.find(p => p.id === projectId);
    if (mockCollabMatch) {
        return mockCollabMatch;
    }

    // 5. Check if ID matches with prefix variations (e.g. seed_ or proj-)
    const cleanId = projectId.trim().toLowerCase();
    const fuzzyMatch = 
        suggestionProjects.find(p => p.id.toLowerCase() === cleanId) ||
        mockProjects.find(p => p.id.toLowerCase() === cleanId) ||
        mockForYouProjects.find(p => p.id.toLowerCase() === cleanId);

    if (fuzzyMatch) {
        return fuzzyMatch;
    }

    return null;
}

/**
 * Fetches similar projects based on:
 * - Matching project type (Showcase recommends Showcase; Collab recommends Collab)
 * - Matching category and domain
 * - Shared tags and technologies
 * - Contextual keyword relevance
 * Strictly excludes the current project being viewed and deduplicates results.
 */
export async function fetchRelatedProjects(currentProject: Project): Promise<Project[]> {
    if (!currentProject || !currentProject.id) return [];

    const isCollab = Boolean(
        currentProject.collabDetails || 
        currentProject.category === 'Collabs' || 
        (currentProject as any).type === 'collab'
    );

    const candidates: Project[] = [];
    const seenIds = new Set<string>([currentProject.id]);

    if (isCollab) {
        // Pool of Collabs projects
        try {
            const liveCollabPosts = await getCollabPosts();
            for (const post of liveCollabPosts) {
                if (!seenIds.has(post.id)) {
                    seenIds.add(post.id);
                    candidates.push(postToProject(post));
                }
            }
        } catch (e) {
            console.warn('[RELATED_COLLABS_FIRESTORE_WARN]', e);
        }

        for (const p of mockForYouProjects) {
            if (!seenIds.has(p.id)) {
                seenIds.add(p.id);
                candidates.push(p);
            }
        }
    } else {
        // Pool of Showcase projects
        try {
            const liveShowcasePosts = await getShowcasePosts();
            for (const post of liveShowcasePosts) {
                if (!seenIds.has(post.id)) {
                    seenIds.add(post.id);
                    candidates.push(postToShowcaseProject(post));
                }
            }
        } catch (e) {
            console.warn('[RELATED_SHOWCASE_FIRESTORE_WARN]', e);
        }

        for (const p of mockProjects) {
            if (!seenIds.has(p.id)) {
                seenIds.add(p.id);
                candidates.push(p);
            }
        }

        for (const p of suggestionProjects) {
            if (!seenIds.has(p.id)) {
                seenIds.add(p.id);
                candidates.push(p);
            }
        }
    }

    // Scoring engine
    const currentCat = (currentProject.category || '').toLowerCase().trim();
    const currentDomain = (currentProject.domain || '').toLowerCase().trim();
    const currentTags = new Set(
        (currentProject.tags || []).map(t => t.toLowerCase().trim())
    );
    const titleWords = new Set(
        (currentProject.title || currentProject.name || '')
            .toLowerCase()
            .split(/[\s\-_]+/)
            .filter(w => w.length >= 4)
    );

    const scored = candidates.map(cand => {
        let score = 0;
        const candCat = (cand.category || '').toLowerCase().trim();
        const candDomain = (cand.domain || '').toLowerCase().trim();

        if (candCat && candCat === currentCat) score += 12;
        if (candDomain && candDomain === currentDomain) score += 10;
        
        // Tags overlap
        if (cand.tags && cand.tags.length > 0) {
            for (const t of cand.tags) {
                if (currentTags.has(t.toLowerCase().trim())) {
                    score += 6;
                }
            }
        }

        // Title keyword overlap
        const candWords = (cand.title || cand.name || '').toLowerCase().split(/[\s\-_]+/);
        for (const w of candWords) {
            if (w.length >= 4 && titleWords.has(w)) {
                score += 3;
            }
        }

        // Quality/Engagement tie-breaker
        const upvotes = (cand as any).upvotes ?? cand.stats?.likes ?? cand.likeCount ?? 0;
        score += Math.min(4, Math.floor(upvotes / 10000));

        return { project: cand, score };
    });

    // Sort by relevance score descending
    scored.sort((a, b) => b.score - a.score);

    // Return top 6 distinct recommendations
    return scored.slice(0, 6).map(item => item.project);
}
