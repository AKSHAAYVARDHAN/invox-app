import crypto from 'crypto';
import dns from 'dns/promises';
import net from 'net';
import type { TrendSourceCredibilityTier } from '../../types';
import { sanitizeExternalUrl } from '../../utils/urlSanitizer';

export const DEFAULT_SOURCE_FETCH_TIMEOUT_MS = 10_000;
export const MAX_SOURCE_BODY_BYTES = 1_500_000; // 1.5 MB cap
export const MAX_SOURCE_REDIRECTS = 3;

const TRACKING_QUERY_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'fbclid',
  'gclid',
  'dclid',
  'msclkid',
  'mc_cid',
  'mc_eid',
  'yclid',
  'igshid',
  'si',
  'ref',
  'ref_src',
  'ref_url',
  'spm',
  'guccounter',
  'guce_referrer',
  'guce_referrer_sig',
]);

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata',
  'instance-data',
]);

const PRIMARY_PUBLISHER_DOMAINS = new Set([
  'nature.com',
  'science.org',
  'nasa.gov',
  'nih.gov',
  'who.int',
  'federalreserve.gov',
  'sec.gov',
  'arxiv.org',
  'reuters.com',
  'apnews.com',
  'bloomberg.com',
  'ft.com',
  'wsj.com',
  'economist.com',
]);

const REPUTABLE_PUBLISHER_DOMAINS = new Set([
  'arstechnica.com',
  'techcrunch.com',
  'technologyreview.com',
  'theverge.com',
  'wired.com',
  'cnbc.com',
  'sciencedaily.com',
  'statnews.com',
  'dezeen.com',
  'polygon.com',
  'electrek.co',
  'spacenews.com',
  'hyperallergic.com',
  'coindesk.com',
  'marketwatch.com',
  'finance.yahoo.com',
]);

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
  'from', 'up', 'about', 'into', 'over', 'after', 'is', 'are', 'was', 'were', 'be', 'been',
  'has', 'have', 'had', 'its', 'it', 'that', 'this', 'as', 'will', 'can', 'new', 'how', 'why',
  'what', 'when', 'where', 'who', 'says', 'said', 'could', 'would', 'should', 'may', 'more',
]);

export interface UrlValidationResult {
  valid: boolean;
  canonicalUrl?: string;
  hostname?: string;
  reason?: string;
}

export interface ValidatedSourceContent {
  originalUrl: string;
  canonicalUrl: string;
  urlHash: string;
  domain: string;
  publisherName: string;
  credibilityTier: TrendSourceCredibilityTier;
  author?: string;
  publishedAtIso: string;
  retrievedAtIso: string;
  rawTitle: string;
  description: string;
  sanitizedExcerpt: string;
  contentHash: string;
  ogImageUrl?: string;
  httpStatus: number;
}

export interface DuplicateCheckCandidate {
  id: string;
  kind: 'published_trend' | 'ingestion_item';
  urlHash: string;
  canonicalUrl?: string;
  title: string;
  contentHash?: string;
  excerpt?: string;
}

export interface DuplicateMatchResult {
  isDuplicate: boolean;
  matchType?: 'url_hash' | 'content_hash' | 'title_exact' | 'title_similarity' | 'content_similarity';
  matchedId?: string;
  matchedKind?: 'published_trend' | 'ingestion_item';
  similarityScore?: number;
}

/**
 * Checks whether an IPv4 or IPv6 literal belongs to a private, loopback, link-local,
 * multicast, or cloud-metadata address space (SSRF protection).
 */
export function isBlockedIpAddress(ip: string): boolean {
  const cleaned = ip.trim().toLowerCase();
  if (!cleaned) return true;

  // Handle IPv4-mapped IPv6 addresses like ::ffff:127.0.0.1 or ::ffff:7f00:1
  if (cleaned.startsWith('::ffff:')) {
    const mapped = cleaned.slice('::ffff:'.length);
    if (net.isIPv4(mapped)) {
      return isBlockedIpAddress(mapped);
    }
    const hexMatch = mapped.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hexMatch) {
      const hi = parseInt(hexMatch[1], 16);
      const lo = parseInt(hexMatch[2], 16);
      const ipv4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
      return isBlockedIpAddress(ipv4);
    }
    return true;
  }

  if (net.isIPv4(cleaned)) {
    const parts = cleaned.split('.').map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
      return true;
    }
    const [a, b] = parts;
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8 private
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local & AWS/GCP metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
    if (a === 192 && b === 0 && parts[2] === 0) return true;
    if (a === 192 && b === 168) return true; // 192.168.0.0/16 private
    if (a === 198 && (b === 18 || b === 19)) return true; // benchmark
    if (a >= 224) return true; // multicast & reserved
    return false;
  }

  if (net.isIPv6(cleaned)) {
    if (cleaned === '::' || cleaned === '::1') return true; // unspecified / loopback
    if (cleaned.startsWith('fc') || cleaned.startsWith('fd')) return true; // unique local fc00::/7
    if (cleaned.startsWith('fe8') || cleaned.startsWith('fe9') || cleaned.startsWith('fea') || cleaned.startsWith('feb')) {
      return true; // link-local fe80::/10
    }
    if (cleaned.startsWith('ff')) return true; // multicast
    return false;
  }

  return true;
}

/**
 * Strips tracking query parameters, normalizes host casing and trailing slashes, and removes hash fragments.
 */
export function canonicalizeSourceUrl(rawUrl: string): string | null {
  const safe = sanitizeExternalUrl(rawUrl);
  if (!safe) return null;

  try {
    const parsed = new URL(safe);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    if (parsed.username || parsed.password) {
      return null;
    }

    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    parsed.hash = '';

    // Remove tracking query params and sort remaining keys for deterministic canonicalization
    const keptEntries: Array<[string, string]> = [];
    for (const [k, v] of parsed.searchParams.entries()) {
      const lower = k.toLowerCase();
      if (lower.startsWith('utm_') || TRACKING_QUERY_PARAMS.has(lower)) {
        continue;
      }
      keptEntries.push([k, v]);
    }
    keptEntries.sort(([a], [b]) => a.localeCompare(b));
    parsed.search = '';
    for (const [k, v] of keptEntries) {
      parsed.searchParams.append(k, v);
    }

    // Normalize trailing slash on non-root paths
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Synchronous structural & SSRF hostname/IP validation.
 */
export function validateSourceUrlSyntax(rawUrl: string): UrlValidationResult {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return { valid: false, reason: 'Source URL is required.' };
  }
  if (rawUrl.trim().length > 2048) {
    return { valid: false, reason: 'Source URL exceeds maximum allowed length (2048).' };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { valid: false, reason: 'Malformed URL.' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, reason: `Unsupported URL protocol '${parsed.protocol}'. Only http/https allowed.` };
  }
  if (parsed.username || parsed.password) {
    return { valid: false, reason: 'Embedded credentials in URL are not permitted.' };
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!hostname) {
    return { valid: false, reason: 'URL hostname is missing.' };
  }
  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.localhost')
  ) {
    return { valid: false, reason: `Hostname '${hostname}' is blocked by SSRF policy.` };
  }

  if (net.isIP(hostname)) {
    if (isBlockedIpAddress(hostname)) {
      return { valid: false, reason: `IP address '${hostname}' is blocked by SSRF policy.` };
    }
  } else if (!hostname.includes('.')) {
    return { valid: false, reason: `Single-label hostname '${hostname}' is not permitted.` };
  }

  const canonicalUrl = canonicalizeSourceUrl(rawUrl);
  if (!canonicalUrl) {
    return { valid: false, reason: 'URL failed canonicalization.' };
  }

  return { valid: true, canonicalUrl, hostname };
}

/**
 * Asynchronous SSRF validation including DNS resolution checks to prevent DNS rebinding
 * to loopback, private, link-local, or cloud metadata IP addresses.
 */
export async function validateOutboundSourceUrl(rawUrl: string): Promise<UrlValidationResult> {
  const syntax = validateSourceUrlSyntax(rawUrl);
  if (!syntax.valid || !syntax.hostname) {
    return syntax;
  }

  if (!net.isIP(syntax.hostname)) {
    try {
      const addresses = await dns.lookup(syntax.hostname, { all: true, verbatim: true });
      if (!addresses || addresses.length === 0) {
        return { valid: false, reason: `DNS lookup returned no addresses for '${syntax.hostname}'.` };
      }
      for (const entry of addresses) {
        if (isBlockedIpAddress(entry.address)) {
          return {
            valid: false,
            reason: `Resolved address for '${syntax.hostname}' is blocked by SSRF policy.`,
          };
        }
      }
    } catch {
      return { valid: false, reason: `Unable to resolve hostname '${syntax.hostname}'.` };
    }
  }

  return syntax;
}

export function computeUrlHash(canonicalUrl: string): string {
  return crypto.createHash('sha256').update(canonicalUrl.trim()).digest('hex');
}

export function computeContentHash(title: string, excerpt: string): string {
  const normalized = `${normalizeTitleForDedupe(title)}||${normalizeTitleForDedupe(excerpt.slice(0, 1200))}`;
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

export function stripPromptInjectionDelimiters(text: string): string {
  return text
    .replace(/<\/?untrusted_source_material>/gi, '')
    .replace(/<\/?untrusted_article_context>/gi, '')
    .replace(/<\/?system_instruction>/gi, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

export function decodeHtmlEntities(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_m, dec) => {
      const code = Number(dec);
      return Number.isFinite(code) && code >= 32 && code <= 0x10ffff ? String.fromCodePoint(code) : ' ';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) && code >= 32 && code <= 0x10ffff ? String.fromCodePoint(code) : ' ';
    });
}

export function sanitizePlainText(input: string, maxLength = 4000): string {
  if (typeof input !== 'string' || !input) return '';
  const noScripts = input
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const strippedTags = noScripts.replace(/<[^>]+>/g, ' ');
  const decoded = decodeHtmlEntities(strippedTags);
  const cleaned = stripPromptInjectionDelimiters(decoded).replace(/\s+/g, ' ').trim();
  return cleaned.slice(0, maxLength);
}

export function resolveCredibilityTier(hostname: string): TrendSourceCredibilityTier {
  const clean = hostname.toLowerCase().replace(/^www\./, '');
  for (const d of PRIMARY_PUBLISHER_DOMAINS) {
    if (clean === d || clean.endsWith(`.${d}`)) return 'primary';
  }
  for (const d of REPUTABLE_PUBLISHER_DOMAINS) {
    if (clean === d || clean.endsWith(`.${d}`)) return 'reputable';
  }
  return 'trade';
}

export type SourceVerificationStatus = 'verified' | 'unavailable' | 'unverified';
export type SourceExcerptCompleteness = 'full_excerpt' | 'truncated' | 'unavailable';

export interface SourceVerificationResult {
  status: SourceVerificationStatus;
  scope: 'url_reachability_only';
  checkedAtIso: string;
  originalUrl: string;
  finalUrl?: string;
  canonicalUrl?: string;
  redirected: boolean;
  redirectCount: number;
  httpStatus?: number;
  publisherName?: string;
  sourceDomain?: string;
  author?: string;
  sourceThumbnailUrl?: string;
  publishedAtIso?: string;
  excerpt?: string;
  excerptTruncated?: boolean;
  excerptCompleteness: SourceExcerptCompleteness;
  failureReason?: string;
  cached?: boolean;
}

export function extractArticleMetadataFromHtml(
  html: string,
  baseUrl: string
): {
  title: string;
  description: string;
  siteName?: string;
  author?: string;
  publishedAtIso?: string;
  ogImageUrl?: string;
  canonicalUrl?: string;
  bodyExcerpt: string;
  excerptSource: 'article_paragraphs' | 'meta_description' | 'none';
  bodyExcerptTruncated: boolean;
} {
  const getMetaContent = (attr: 'property' | 'name', value: string): string | undefined => {
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex1 = new RegExp(
      `<meta[^>]+${attr}=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      'i'
    );
    const regex2 = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${escaped}["'][^>]*>`,
      'i'
    );
    const match = html.match(regex1) || html.match(regex2);
    return match?.[1] ? sanitizePlainText(match[1], 600) : undefined;
  };

  const titleTagMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title =
    getMetaContent('property', 'og:title') ||
    getMetaContent('name', 'twitter:title') ||
    (titleTagMatch?.[1] ? sanitizePlainText(titleTagMatch[1], 300) : '');

  const description =
    getMetaContent('property', 'og:description') ||
    getMetaContent('name', 'description') ||
    getMetaContent('name', 'twitter:description') ||
    '';

  const siteName = getMetaContent('property', 'og:site_name');
  const author =
    getMetaContent('name', 'author') ||
    getMetaContent('property', 'article:author') ||
    getMetaContent('name', 'parsely-author');

  const rawDate =
    getMetaContent('property', 'article:published_time') ||
    getMetaContent('name', 'pubdate') ||
    getMetaContent('name', 'publishdate') ||
    getMetaContent('name', 'date') ||
    html.match(/<time[^>]+datetime=["']([^"']+)["']/i)?.[1];

  let publishedAtIso: string | undefined;
  if (rawDate) {
    const ms = Date.parse(rawDate);
    if (!Number.isNaN(ms) && ms > Date.UTC(2000, 0, 1) && ms <= Date.now() + 86_400_000) {
      publishedAtIso = new Date(ms).toISOString();
    }
  }

  let ogImageUrl: string | undefined;
  const rawOgImg =
    getMetaContent('property', 'og:image') ||
    getMetaContent('property', 'og:image:secure_url') ||
    getMetaContent('name', 'twitter:image');
  if (rawOgImg) {
    try {
      const resolved = new URL(rawOgImg, baseUrl).toString();
      const safe = sanitizeExternalUrl(resolved);
      if (safe) {
        ogImageUrl = safe;
      }
    } catch {
      // ignore invalid image URL
    }
  }

  // Extract declared <link rel="canonical" href="..."> when present and valid HTTP(S)
  let canonicalUrl: string | undefined;
  const canonicalMatch =
    html.match(/<link[^>]+rel=["'][^"']*\bcanonical\b[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/i) ||
    html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*\bcanonical\b[^"']*["'][^>]*>/i);
  if (canonicalMatch?.[1]) {
    try {
      const resolvedCanonical = new URL(decodeHtmlEntities(canonicalMatch[1].trim()), baseUrl).toString();
      const normalizedCanonical = canonicalizeSourceUrl(resolvedCanonical);
      if (normalizedCanonical) {
        canonicalUrl = normalizedCanonical;
      }
    } catch {
      // ignore malformed canonical link tag
    }
  }

  // Extract paragraph text preferentially from <article> or <main>, falling back to whole document
  const articleMatch =
    html.match(/<article[\s\S]*?<\/article>/i)?.[0] ||
    html.match(/<main[\s\S]*?<\/main>/i)?.[0] ||
    html;

  const paragraphs: string[] = [];
  const pRegex = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let m: RegExpExecArray | null;
  let hitParagraphCap = false;
  while ((m = pRegex.exec(articleMatch)) !== null) {
    const text = sanitizePlainText(m[1], 1000);
    if (text.length >= 40) {
      paragraphs.push(text);
    }
    if (paragraphs.join(' ').length >= 4500) {
      hitParagraphCap = true;
      break;
    }
  }

  const rawBody = paragraphs.length > 0 ? paragraphs.join('\n\n') : description;
  const bodyExcerpt = rawBody.slice(0, 4500);
  const excerptSource: 'article_paragraphs' | 'meta_description' | 'none' =
    paragraphs.length > 0
      ? 'article_paragraphs'
      : description.trim().length > 0
        ? 'meta_description'
        : 'none';
  const bodyExcerptTruncated = hitParagraphCap || rawBody.length > 4500;

  return {
    title,
    description,
    siteName,
    author,
    publishedAtIso,
    ogImageUrl,
    canonicalUrl,
    bodyExcerpt,
    excerptSource,
    bodyExcerptTruncated,
  };
}

/**
 * Fetches an outbound URL with strict SSRF checks on initial and redirected targets,
 * size caps, and timeouts. Never returns unverified content on HTTP error.
 */
export async function safeFetchTextWithSsrfProtection(
  rawUrl: string,
  options?: { timeoutMs?: number; maxBytes?: number; accept?: string }
): Promise<
  | {
      ok: true;
      finalUrl: string;
      status: number;
      contentType: string;
      text: string;
      redirectCount: number;
      truncated: boolean;
    }
  | { ok: false; status?: number; error: string; blockedByPolicy?: boolean; redirectCount?: number }
> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_SOURCE_FETCH_TIMEOUT_MS;
  const maxBytes = options?.maxBytes ?? MAX_SOURCE_BODY_BYTES;
  let currentUrl = rawUrl;

  for (let redirectCount = 0; redirectCount <= MAX_SOURCE_REDIRECTS; redirectCount++) {
    const validation = await validateOutboundSourceUrl(currentUrl);
    if (!validation.valid) {
      const reason = validation.reason || 'Source URL blocked by validation.';
      const blockedByPolicy = /blocked|protocol|credentials|single-label|malformed/i.test(reason);
      return { ok: false, error: reason, blockedByPolicy, redirectCount };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': 'INVOX-Trendz-Intelligence/1.0 (+https://invox.app)',
          Accept: options?.accept || 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          return {
            ok: false,
            status: response.status,
            error: 'Redirect missing Location header.',
            redirectCount,
          };
        }
        if (redirectCount >= MAX_SOURCE_REDIRECTS) {
          return {
            ok: false,
            status: response.status,
            error: 'Too many redirects.',
            redirectCount,
          };
        }
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }

      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          error: `Source returned HTTP ${response.status}.`,
          redirectCount,
        };
      }

      const contentType = response.headers.get('content-type') || '';
      const contentLengthHeader = Number(response.headers.get('content-length') || '0');
      if (contentLengthHeader > maxBytes * 2) {
        return {
          ok: false,
          status: response.status,
          error: 'Source document exceeds size cap.',
          redirectCount,
        };
      }

      const reader = response.body?.getReader();
      if (!reader) {
        const rawText = await response.text();
        const truncated = rawText.length > maxBytes;
        const text = rawText.slice(0, maxBytes);
        return {
          ok: true,
          finalUrl: currentUrl,
          status: response.status,
          contentType,
          text,
          redirectCount,
          truncated,
        };
      }

      const chunks: Uint8Array[] = [];
      let totalBytes = 0;
      let truncated = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          totalBytes += value.byteLength;
          if (totalBytes > maxBytes) {
            chunks.push(value.slice(0, Math.max(0, value.byteLength - (totalBytes - maxBytes))));
            truncated = true;
            await reader.cancel().catch(() => {});
            break;
          }
          chunks.push(value);
        }
      }

      const combined = Buffer.concat(chunks);
      const text = combined.toString('utf8');
      return {
        ok: true,
        finalUrl: currentUrl,
        status: response.status,
        contentType,
        text,
        redirectCount,
        truncated,
      };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return {
          ok: false,
          error: `Source request timed out after ${timeoutMs}ms.`,
          redirectCount,
        };
      }
      return {
        ok: false,
        error: err?.message || 'Network failure retrieving source.',
        redirectCount,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  return { ok: false, error: 'Exceeded maximum redirect count.', redirectCount: MAX_SOURCE_REDIRECTS };
}

function buildDisplayExcerpt(
  bodyExcerpt: string,
  description: string,
  excerptSource: 'article_paragraphs' | 'meta_description' | 'none',
  bodyTruncated: boolean,
  responseTruncated: boolean,
  maxChars = 540
): {
  excerpt?: string;
  excerptTruncated: boolean;
  excerptCompleteness: SourceExcerptCompleteness;
} {
  const candidate = (bodyExcerpt || description || '').trim();
  if (candidate.length < 24) {
    return {
      excerpt: undefined,
      excerptTruncated: false,
      excerptCompleteness: 'unavailable',
    };
  }

  let text = candidate;
  let clipped = false;
  if (text.length > maxChars) {
    const cut = text.slice(0, maxChars);
    const lastSpace = cut.lastIndexOf(' ');
    text = `${(lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut).trim()}…`;
    clipped = true;
  }

  const isPartial =
    clipped ||
    bodyTruncated ||
    responseTruncated ||
    excerptSource === 'meta_description';

  return {
    excerpt: text,
    excerptTruncated: isPartial,
    excerptCompleteness: isPartial ? 'truncated' : 'full_excerpt',
  };
}

/**
 * Verifies live reachability and extracts provenance metadata for a single Trendz source URL.
 * Strictly checks URL reachability and publisher metadata only (never claims factual verification).
 */
export async function verifySourceUrlMetadata(params: {
  url: string;
  timeoutMs?: number;
  maxBytes?: number;
}): Promise<SourceVerificationResult> {
  const checkedAtIso = new Date().toISOString();
  const trimmedUrl = typeof params.url === 'string' ? params.url.trim() : '';

  const syntax = validateSourceUrlSyntax(trimmedUrl);
  if (!syntax.valid) {
    return {
      status: 'unverified',
      scope: 'url_reachability_only',
      checkedAtIso,
      originalUrl: trimmedUrl,
      redirected: false,
      redirectCount: 0,
      excerptCompleteness: 'unavailable',
      failureReason: 'Source URL is missing, malformed, or uses a disallowed address.',
    };
  }

  const fetchResult = await safeFetchTextWithSsrfProtection(trimmedUrl, {
    timeoutMs: params.timeoutMs ?? 8_000,
    maxBytes: params.maxBytes ?? 512_000,
  });

  if (fetchResult.ok === false || 'error' in fetchResult) {
    const fail = fetchResult as {
      ok: false;
      status?: number;
      error: string;
      blockedByPolicy?: boolean;
      redirectCount?: number;
    };
    const isBlocked = Boolean(fail.blockedByPolicy);
    const safeReason = isBlocked
      ? 'Source address cannot be checked by the verification service.'
      : fail.status
        ? `Source returned HTTP ${fail.status}.`
        : /timed out/i.test(fail.error)
          ? 'Source verification request timed out.'
          : /too many redirects|redirect/i.test(fail.error)
            ? 'Source redirect chain could not be resolved.'
            : /size cap/i.test(fail.error)
              ? 'Source response exceeded verification size limit.'
              : 'Source could not be reached from the verification service.';

    return {
      status: isBlocked ? 'unverified' : 'unavailable',
      scope: 'url_reachability_only',
      checkedAtIso,
      originalUrl: trimmedUrl,
      canonicalUrl: syntax.canonicalUrl,
      redirected: (fail.redirectCount ?? 0) > 0,
      redirectCount: fail.redirectCount ?? 0,
      httpStatus: fail.status,
      sourceDomain: syntax.hostname?.replace(/^www\./, ''),
      excerptCompleteness: 'unavailable',
      failureReason: safeReason,
    };
  }

  const normalizedFinalUrl =
    canonicalizeSourceUrl(fetchResult.finalUrl) || syntax.canonicalUrl || fetchResult.finalUrl;

  const isHtmlLike =
    !fetchResult.contentType ||
    /text\/html|application\/xhtml\+xml|application\/xml|text\/plain/i.test(fetchResult.contentType);

  const extracted = isHtmlLike
    ? extractArticleMetadataFromHtml(fetchResult.text, fetchResult.finalUrl)
    : null;

  const resolvedCanonicalUrl = extracted?.canonicalUrl || normalizedFinalUrl;
  const redirected =
    fetchResult.redirectCount > 0 ||
    Boolean(syntax.canonicalUrl && normalizedFinalUrl && syntax.canonicalUrl !== normalizedFinalUrl);

  let sourceDomain = syntax.hostname?.replace(/^www\./, '');
  try {
    sourceDomain = new URL(resolvedCanonicalUrl).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    // retain syntax hostname
  }

  const publisherName = extracted?.siteName
    ? sanitizePlainText(extracted.siteName, 140)
    : undefined;

  const excerptInfo = extracted
    ? buildDisplayExcerpt(
        extracted.bodyExcerpt,
        extracted.description,
        extracted.excerptSource,
        extracted.bodyExcerptTruncated,
        fetchResult.truncated
      )
    : {
        excerpt: undefined,
        excerptTruncated: false,
        excerptCompleteness: 'unavailable' as SourceExcerptCompleteness,
      };

  return {
    status: 'verified',
    scope: 'url_reachability_only',
    checkedAtIso,
    originalUrl: trimmedUrl,
    finalUrl: fetchResult.finalUrl,
    canonicalUrl: resolvedCanonicalUrl,
    redirected,
    redirectCount: fetchResult.redirectCount,
    httpStatus: fetchResult.status,
    publisherName,
    sourceDomain,
    author: extracted?.author || undefined,
    sourceThumbnailUrl: extracted?.ogImageUrl,
    publishedAtIso: extracted?.publishedAtIso,
    excerpt: excerptInfo.excerpt,
    excerptTruncated: excerptInfo.excerptTruncated,
    excerptCompleteness: excerptInfo.excerptCompleteness,
  };
}

/**
 * Validates an external article URL, fetches its live content, extracts clean metadata,
 * and returns a verified ValidatedSourceContent snapshot. Rejects inaccessible sources.
 */
export async function fetchAndValidateSource(params: {
  url: string;
  fallbackTitle?: string;
  fallbackPublisher?: string;
  fallbackPublishedAtIso?: string;
  fallbackExcerpt?: string;
  fallbackOgImageUrl?: string;
  timeoutMs?: number;
}): Promise<{ ok: true; source: ValidatedSourceContent } | { ok: false; error: string; httpStatus?: number }> {
  const retrievedAtIso = new Date().toISOString();
  const fetchResult = await safeFetchTextWithSsrfProtection(params.url, {
    timeoutMs: params.timeoutMs ?? DEFAULT_SOURCE_FETCH_TIMEOUT_MS,
  });

  if (fetchResult.ok === false || 'error' in fetchResult) {
    const fail = fetchResult as { ok: false; status?: number; error: string };
    return {
      ok: false,
      error: fail.error,
      httpStatus: fail.status,
    };
  }

  const canonicalUrl = canonicalizeSourceUrl(fetchResult.finalUrl) || canonicalizeSourceUrl(params.url);
  if (!canonicalUrl) {
    return { ok: false, error: 'Resolved source URL could not be canonicalized.' };
  }

  const parsedFinal = new URL(canonicalUrl);
  const domain = parsedFinal.hostname.toLowerCase().replace(/^www\./, '');
  const urlHash = computeUrlHash(canonicalUrl);
  const extracted = extractArticleMetadataFromHtml(fetchResult.text, canonicalUrl);

  const rawTitle = sanitizePlainText(extracted.title || params.fallbackTitle || '', 260);
  if (rawTitle.length < 5) {
    return { ok: false, error: 'Retrieved source did not contain a valid article title.' };
  }

  const mergedExcerpt = sanitizePlainText(
    extracted.bodyExcerpt.length >= 120
      ? extracted.bodyExcerpt
      : [extracted.description, params.fallbackExcerpt, extracted.bodyExcerpt]
          .filter(Boolean)
          .join('\n\n'),
    4500
  );

  if (mergedExcerpt.length < 30) {
    return { ok: false, error: 'Retrieved source lacked extractable text content.' };
  }

  const publisherName = sanitizePlainText(
    extracted.siteName || params.fallbackPublisher || domain,
    140
  );

  let publishedAtIso = extracted.publishedAtIso || params.fallbackPublishedAtIso;
  if (!publishedAtIso || Number.isNaN(Date.parse(publishedAtIso))) {
    publishedAtIso = retrievedAtIso;
  } else {
    publishedAtIso = new Date(Date.parse(publishedAtIso)).toISOString();
  }

  const ogImageUrl =
    extracted.ogImageUrl ||
    (params.fallbackOgImageUrl ? sanitizeExternalUrl(params.fallbackOgImageUrl) || undefined : undefined);

  return {
    ok: true,
    source: {
      originalUrl: params.url,
      canonicalUrl,
      urlHash,
      domain,
      publisherName,
      credibilityTier: resolveCredibilityTier(domain),
      author: extracted.author || undefined,
      publishedAtIso,
      retrievedAtIso,
      rawTitle,
      description: extracted.description || mergedExcerpt.slice(0, 320),
      sanitizedExcerpt: mergedExcerpt,
      contentHash: computeContentHash(rawTitle, mergedExcerpt),
      ogImageUrl,
      httpStatus: fetchResult.status,
    },
  };
}

export function normalizeTitleForDedupe(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeForSimilarity(text: string): Set<string> {
  const words = normalizeTitleForDedupe(text)
    .split(' ')
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  return new Set(words);
}

export function computeTokenJaccardSimilarity(a: string, b: string): number {
  const setA = tokenizeForSimilarity(a);
  const setB = tokenizeForSimilarity(b);
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Multi-signal duplicate detector checking canonical URL hash, content hash,
 * normalized title match, and title/content token Jaccard similarity.
 */
export function findDuplicateOrCorroboratingMatch(
  incoming: { urlHash: string; contentHash: string; title: string; excerpt?: string },
  existing: DuplicateCheckCandidate[]
): DuplicateMatchResult {
  const incomingNormTitle = normalizeTitleForDedupe(incoming.title);

  for (const candidate of existing) {
    if (candidate.urlHash && candidate.urlHash === incoming.urlHash) {
      return {
        isDuplicate: true,
        matchType: 'url_hash',
        matchedId: candidate.id,
        matchedKind: candidate.kind,
        similarityScore: 1,
      };
    }

    if (candidate.contentHash && incoming.contentHash && candidate.contentHash === incoming.contentHash) {
      return {
        isDuplicate: true,
        matchType: 'content_hash',
        matchedId: candidate.id,
        matchedKind: candidate.kind,
        similarityScore: 1,
      };
    }

    const candidateNormTitle = normalizeTitleForDedupe(candidate.title);
    if (incomingNormTitle && candidateNormTitle && incomingNormTitle === candidateNormTitle) {
      return {
        isDuplicate: true,
        matchType: 'title_exact',
        matchedId: candidate.id,
        matchedKind: candidate.kind,
        similarityScore: 1,
      };
    }

    const titleSim = computeTokenJaccardSimilarity(incoming.title, candidate.title);
    if (titleSim >= 0.72) {
      return {
        isDuplicate: true,
        matchType: 'title_similarity',
        matchedId: candidate.id,
        matchedKind: candidate.kind,
        similarityScore: Number(titleSim.toFixed(3)),
      };
    }

    if (incoming.excerpt && candidate.excerpt) {
      const contentSim = computeTokenJaccardSimilarity(
        `${incoming.title} ${incoming.excerpt.slice(0, 600)}`,
        `${candidate.title} ${candidate.excerpt.slice(0, 600)}`
      );
      if (contentSim >= 0.65) {
        return {
          isDuplicate: true,
          matchType: 'content_similarity',
          matchedId: candidate.id,
          matchedKind: candidate.kind,
          similarityScore: Number(contentSim.toFixed(3)),
        };
      }
    }
  }

  return { isDuplicate: false };
}
