const MAX_URL_LENGTH = 2048;

/**
 * Validates and normalizes an external URL, permitting strictly http: and https: schemes.
 * Rejects javascript:, data:, vbscript:, file:, protocol-relative URLs, control characters,
 * and malformed inputs. Returns null if the URL is not safe.
 */
export function sanitizeExternalUrl(rawUrl: unknown): string | null {
    if (typeof rawUrl !== 'string') {
        return null;
    }

    const trimmed = rawUrl.trim();
    if (!trimmed || trimmed.length > MAX_URL_LENGTH) {
        return null;
    }

    // Reject ASCII control characters, whitespace inside URLs, or protocol-relative URLs
    if (/[\u0000-\u001F\u007F\s]/.test(trimmed) || trimmed.startsWith('//')) {
        return null;
    }

    try {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return null;
        }
        if (!parsed.hostname) {
            return null;
        }
        return parsed.toString();
    } catch {
        return null;
    }
}

/**
 * Type guard indicating whether a value is a safe http/https URL string.
 */
export function isSafeHttpUrl(rawUrl: unknown): rawUrl is string {
    return sanitizeExternalUrl(rawUrl) !== null;
}

/**
 * Safely extracts the hostname from a validated http/https URL.
 */
export function getSafeHostname(rawUrl: unknown): string | null {
    const safeUrl = sanitizeExternalUrl(rawUrl);
    if (!safeUrl) {
        return null;
    }
    try {
        return new URL(safeUrl).hostname;
    } catch {
        return null;
    }
}
