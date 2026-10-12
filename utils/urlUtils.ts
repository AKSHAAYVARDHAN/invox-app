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
 * Checks if a given host or URL belongs to the INVOX application (same host, localhost, or production domain).
 */
export const isInvoxAppUrl = (urlString: string): boolean => {
    try {
        const parsed = new URL(urlString);
        if (typeof window !== 'undefined' && parsed.host === window.location.host) {
            return true;
        }
        const canonical = new URL(getPublicAppBaseUrl());
        return (
            parsed.host === canonical.host ||
            parsed.host === 'invox.vercel.app' ||
            parsed.host === 'invox-7.web.app' ||
            parsed.host === 'invox-7.firebaseapp.com'
        );
    } catch {
        return false;
    }
};
