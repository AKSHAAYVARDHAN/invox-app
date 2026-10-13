/**
 * Canonical URL utilities for INVOX.
 * Ensures consistent public application URLs across development,
 * preview (Google AI Studio), and production (Vercel / deployed domain).
 */

/**
 * Returns true if the hostname is a temporary/preview environment from Google AI Studio.
 */
export const isAiStudioPreviewHostname = (hostname: string): boolean => {
    if (!hostname) return false;
    const lower = hostname.toLowerCase();
    return (
        lower.includes('ais-dev-') ||
        lower.includes('ais-pre-') ||
        lower.endsWith('.run.app') ||
        lower.includes('googleusercontent.com')
    );
};

/**
 * Default canonical production URL for INVOX.
 * Configured through VITE_PUBLIC_APP_URL, VITE_APP_URL, or defaults to the deployed production Vercel app.
 */
export const DEFAULT_PRODUCTION_URL = 'https://invox.vercel.app';

/**
 * Gets the canonical base URL for public links (invitations, shares, etc.).
 *
 * Guaranteed invariants:
 * 1. Never uses temporary Google AI Studio preview URLs (*.run.app, ais-dev-*, ais-pre-*).
 * 2. Uses VITE_PUBLIC_APP_URL or VITE_APP_URL if defined in environment variables.
 * 3. When accessed directly on a deployed production host (e.g. on Vercel, Firebase Hosting, or custom domain),
 *    uses that deployed host's origin so links are natural to where the user is using the app.
 * 4. Fallback is the canonical deployed production URL (DEFAULT_PRODUCTION_URL).
 * 5. Trailing slash is always stripped for uniform URL assembly.
 */
export const getPublicAppBaseUrl = (): string => {
    // 1. Check explicit environment variable
    const envUrl =
        (typeof import.meta !== 'undefined' &&
            (import.meta.env?.VITE_PUBLIC_APP_URL || import.meta.env?.VITE_APP_URL)) ||
        '';

    if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
        return envUrl.trim().replace(/\/+$/, '');
    }

    // 2. Check window origin if available
    if (typeof window !== 'undefined' && window.location) {
        const { hostname, origin } = window.location;

        // If running in a Google AI Studio preview environment, NEVER use its temporary run.app URL.
        if (isAiStudioPreviewHostname(hostname)) {
            return DEFAULT_PRODUCTION_URL;
        }

        // If running on a deployed domain (Vercel, Firebase Hosting, custom domain, etc.)
        if (origin && origin !== 'null' && origin !== 'file://') {
            return origin.replace(/\/+$/, '');
        }
    }

    return DEFAULT_PRODUCTION_URL;
};

/**
 * Constructs a canonical team invitation URL that works in any external browser.
 *
 * Example:
 * https://invox.vercel.app/#/spotlight?tab=Collabs&collabView=teams&teamId=team_123&invite=token_xyz
 */
export const getTeamInvitationUrl = (token: string, teamId?: string): string => {
    const baseUrl = getPublicAppBaseUrl();
    const cleanToken = encodeURIComponent((token || '').trim());
    const teamParam = teamId ? `&teamId=${encodeURIComponent(teamId.trim())}` : '';
    return `${baseUrl}/#/spotlight?tab=Collabs&collabView=teams${teamParam}&invite=${cleanToken}`;
};

/**
 * Checks if a given host or URL belongs to the INVOX application (same host, localhost, preview, or production domain).
 */
export const isInvoxAppUrl = (urlString: string): boolean => {
    try {
        if (!urlString) return false;
        if (urlString.startsWith('#') || urlString.startsWith('/')) {
            return true;
        }
        const parsed = new URL(urlString);
        if (typeof window !== 'undefined' && parsed.host === window.location.host) {
            return true;
        }
        const canonical = new URL(getPublicAppBaseUrl());
        return (
            parsed.host === canonical.host ||
            parsed.host === 'invox.vercel.app' ||
            parsed.host === 'invox-7.web.app' ||
            parsed.host === 'invox-7.firebaseapp.com' ||
            parsed.hostname === 'localhost' ||
            parsed.hostname === '127.0.0.1' ||
            isAiStudioPreviewHostname(parsed.hostname)
        );
    } catch {
        return false;
    }
};

export interface ParsedTeamInvitation {
    originalUrl: string;
    token: string;
    teamId: string | null;
    tab: string;
    collabView: string;
    targetHash: string;
    allParams: Record<string, string>;
}

/**
 * Parses a potential INVOX team invitation URL.
 * Supports production, staging, localhost, and preview URLs with HashRouter or standard query parameters.
 * Validates that the URL contains a non-empty invitation token and team invitation parameters.
 * Does not classify ordinary URLs or general app URLs as team invitations.
 * Preserves all original tokens, parameters, and fragments.
 */
export const parseTeamInvitationUrl = (rawUrl: string): ParsedTeamInvitation | null => {
    if (!rawUrl || typeof rawUrl !== 'string') return null;

    let trimmed = rawUrl.trim();
    // Separate trailing punctuation that is not part of the URL (e.g. .,!?:;)
    const punctMatch = trimmed.match(/([.,!?:;)\]}]+)$/);
    if (punctMatch) {
        trimmed = trimmed.slice(0, -punctMatch[1].length);
    }

    if (!trimmed) return null;

    let parsed: URL;
    const isRelative = trimmed.startsWith('#') || trimmed.startsWith('/');
    try {
        if (isRelative) {
            const dummyBase = typeof window !== 'undefined' && window.location?.origin
                ? window.location.origin
                : DEFAULT_PRODUCTION_URL;
            parsed = new URL(trimmed.startsWith('#') ? '/' + trimmed : trimmed, dummyBase);
        } else {
            parsed = new URL(trimmed);
        }
    } catch {
        return null;
    }

    // Must be an INVOX app URL or relative link
    if (!isRelative && !isInvoxAppUrl(trimmed)) {
        return null;
    }

    // Collect query parameters from both search and hash
    const params = new URLSearchParams(parsed.search);
    if (parsed.hash && parsed.hash.includes('?')) {
        const hashQuery = parsed.hash.substring(parsed.hash.indexOf('?') + 1);
        const hashParams = new URLSearchParams(hashQuery);
        hashParams.forEach((val, key) => {
            if (!params.has(key)) {
                params.set(key, val);
            }
        });
    }

    // An invitation URL must have a non-empty `invite` token parameter
    const inviteToken = params.get('invite');
    if (!inviteToken || !inviteToken.trim()) {
        return null;
    }

    const token = inviteToken.trim();
    const teamId = params.get('teamId') || null;
    const tab = params.get('tab') || 'Collabs';
    const collabView = params.get('collabView') || 'teams';

    // Must match INVOX team invitation format (either collabView=teams, tab=Collabs, teamId parameter, or path containing spotlight)
    const hasSpotlight = parsed.pathname.includes('spotlight') || parsed.hash.includes('spotlight');
    const isTeamCollab =
        collabView === 'teams' ||
        tab === 'Collabs' ||
        Boolean(teamId) ||
        hasSpotlight;

    if (!isTeamCollab) {
        return null;
    }

    // Build the preserved internal HashRouter target route
    const targetParams = new URLSearchParams();
    const allParams: Record<string, string> = {};
    params.forEach((val, key) => {
        targetParams.set(key, val);
        allParams[key] = val;
    });

    // Ensure required navigation params exist
    if (!targetParams.has('tab')) targetParams.set('tab', 'Collabs');
    if (!targetParams.has('collabView')) targetParams.set('collabView', 'teams');
    if (!targetParams.has('invite')) targetParams.set('invite', token);
    if (teamId && !targetParams.has('teamId')) targetParams.set('teamId', teamId);

    const targetHash = `#/spotlight?${targetParams.toString()}`;

    return {
        originalUrl: trimmed,
        token,
        teamId,
        tab,
        collabView,
        targetHash,
        allParams,
    };
};

/**
 * Returns true if the given URL is a valid INVOX team invitation link.
 */
export const isTeamInvitationUrl = (urlString: string): boolean => {
    return Boolean(parseTeamInvitationUrl(urlString));
};
