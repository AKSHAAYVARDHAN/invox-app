import type { TrendSourceProviderSummary } from '../../types';
import type { TrendzDomainSlug } from '../../utils/trendzDomains';
import { SERVER_TRENDZ_DOMAIN_SLUGS, getServerDomainMeta } from './domainCatalog';
import {
  canonicalizeSourceUrl,
  decodeHtmlEntities,
  safeFetchTextWithSsrfProtection,
  sanitizePlainText,
} from './sourceValidation';
import { sanitizeExternalUrl } from '../../utils/urlSanitizer';

export interface DiscoveredSourceCandidate {
  providerId: string;
  providerName: string;
  domainSlug: TrendzDomainSlug;
  title: string;
  url: string;
  publisherName: string;
  publishedAtIso: string;
  excerpt: string;
  ogImageUrl?: string;
  discoveredAtIso: string;
}

export interface SourceDiscoveryRequest {
  domains: TrendzDomainSlug[];
  windowHours: number;
  maxItemsPerDomain: number;
  requestTimeoutMs?: number;
  maxTransientRetries?: number;
  retryBaseDelayMs?: number;
}

export interface SourceDiscoveryResult {
  providerId: string;
  providerName: string;
  candidates: DiscoveredSourceCandidate[];
  errors: string[];
  durationMs: number;
  attempts: number;
  requestCount: number;
  rateLimited: boolean;
}

export interface TrendSourceProvider {
  readonly id: string;
  readonly name: string;
  readonly type: 'rss' | 'api';
  readonly description: string;
  readonly requiredEnvVars: string[];
  readonly supportedDomains: readonly TrendzDomainSlug[];
  readonly rateLimitPerMinute: number;
  isConfigured(): boolean;
  discover(req: SourceDiscoveryRequest): Promise<SourceDiscoveryResult>;
}

interface CuratedRssFeed {
  url: string;
  publisher: string;
  domainSlug: TrendzDomainSlug;
}

/**
 * Reputable, publicly accessible RSS/Atom feeds organized across all canonical Trendz domains.
 * Requires zero external API keys while providing genuine, verifiable source material.
 */
export const CURATED_RSS_FEEDS: readonly CuratedRssFeed[] = [
  // Technology
  { url: 'https://feeds.arstechnica.com/arstechnica/technology-lab', publisher: 'Ars Technica', domainSlug: 'technology' },
  { url: 'https://techcrunch.com/feed/', publisher: 'TechCrunch', domainSlug: 'technology' },
  // Health Care
  { url: 'https://www.statnews.com/feed/', publisher: 'STAT News', domainSlug: 'health-care' },
  { url: 'https://www.sciencedaily.com/rss/health_medicine.xml', publisher: 'ScienceDaily', domainSlug: 'health-care' },
  // Trading
  { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', publisher: 'CoinDesk', domainSlug: 'trading' },
  { url: 'https://feeds.marketwatch.com/marketwatch/topstories/', publisher: 'MarketWatch', domainSlug: 'trading' },
  // Stock Market
  { url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664', publisher: 'CNBC Finance', domainSlug: 'stock-market' },
  { url: 'https://feeds.marketwatch.com/marketwatch/marketpulse/', publisher: 'MarketWatch Pulse', domainSlug: 'stock-market' },
  // Design
  { url: 'https://www.dezeen.com/feed/', publisher: 'Dezeen', domainSlug: 'design' },
  // Finance
  { url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10001147', publisher: 'CNBC Business', domainSlug: 'finance' },
  // Science
  { url: 'https://www.nature.com/nature.rss', publisher: 'Nature', domainSlug: 'science' },
  { url: 'https://www.sciencedaily.com/rss/top/science.xml', publisher: 'ScienceDaily', domainSlug: 'science' },
  // Gaming
  { url: 'https://www.polygon.com/rss/index.xml', publisher: 'Polygon', domainSlug: 'gaming' },
  // Art
  { url: 'https://hyperallergic.com/feed/', publisher: 'Hyperallergic', domainSlug: 'art' },
  // Automotive
  { url: 'https://electrek.co/feed/', publisher: 'Electrek', domainSlug: 'automotive' },
  // Space
  { url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss', publisher: 'NASA', domainSlug: 'space' },
  { url: 'https://spacenews.com/feed/', publisher: 'SpaceNews', domainSlug: 'space' },
];

// Simple in-memory per-provider rate window + Retry-After cooldown tracker
const providerRequestTimestamps = new Map<string, number[]>();
const providerCooldownUntilMs = new Map<string, number>();

export function isProviderInRateLimitCooldown(providerId: string): boolean {
  const until = providerCooldownUntilMs.get(providerId) || 0;
  return Date.now() < until;
}

export function setProviderRateLimitCooldown(providerId: string, cooldownMs: number): void {
  const clampedMs = Math.min(5 * 60_000, Math.max(1_000, cooldownMs));
  providerCooldownUntilMs.set(providerId, Date.now() + clampedMs);
}

function consumeProviderQuota(providerId: string, limitPerMinute: number): boolean {
  if (isProviderInRateLimitCooldown(providerId)) {
    return false;
  }
  const now = Date.now();
  const cutoff = now - 60_000;
  const recent = (providerRequestTimestamps.get(providerId) || []).filter((ts) => ts > cutoff);
  if (recent.length >= limitPerMinute) {
    providerRequestTimestamps.set(providerId, recent);
    return false;
  }
  recent.push(now);
  providerRequestTimestamps.set(providerId, recent);
  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isTransientFetchFailure(res: {
  ok: false;
  status?: number;
  error: string;
  blockedByPolicy?: boolean;
}): boolean {
  if (res.blockedByPolicy) return false;
  if (res.status === 429 || res.status === 408) return true;
  if (res.status !== undefined && res.status >= 500 && res.status < 600) return true;
  if (res.status === undefined) {
    return /timed out|network|fetch failed|econnreset|etimedout|socket/i.test(res.error);
  }
  return false;
}

/**
 * Performs an SSRF-protected outbound fetch with bounded exponential backoff on transient failures
 * (HTTP 429, 5xx, timeouts, transient network errors) while honoring Retry-After rate-limit hints.
 */
export async function fetchWithControlledBackoff(
  providerId: string,
  url: string,
  options: {
    timeoutMs?: number;
    maxBytes?: number;
    accept?: string;
    maxRetries?: number;
    baseDelayMs?: number;
    fetcher?: typeof safeFetchTextWithSsrfProtection;
  } = {}
): Promise<{
  result: Awaited<ReturnType<typeof safeFetchTextWithSsrfProtection>>;
  attempts: number;
  rateLimited: boolean;
}> {
  const maxRetries = Math.min(3, Math.max(0, Math.trunc(options.maxRetries ?? 2)));
  const baseDelayMs = Math.min(5_000, Math.max(50, Math.trunc(options.baseDelayMs ?? 450)));
  const fetcher = options.fetcher || safeFetchTextWithSsrfProtection;

  let attempts = 0;
  let rateLimited = false;
  let lastResult: Awaited<ReturnType<typeof safeFetchTextWithSsrfProtection>> = {
    ok: false,
    error: 'Fetch not attempted.',
  };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    attempts++;
    lastResult = await fetcher(url, {
      timeoutMs: options.timeoutMs ?? 8_000,
      maxBytes: options.maxBytes ?? 1_000_000,
      accept: options.accept,
    });

    if (lastResult.ok) {
      return { result: lastResult, attempts, rateLimited };
    }

    const fail = lastResult as {
      ok: false;
      status?: number;
      error: string;
      blockedByPolicy?: boolean;
      retryAfterSeconds?: number;
    };

    if (fail.status === 429) {
      rateLimited = true;
      const cooldownMs = (fail.retryAfterSeconds ?? 30) * 1000;
      setProviderRateLimitCooldown(providerId, cooldownMs);
      // If upstream explicitly asked us to wait >5s, stop retrying immediately to respect rate limits
      if ((fail.retryAfterSeconds ?? 0) > 5) {
        return { result: lastResult, attempts, rateLimited };
      }
    }

    if (attempt >= maxRetries || !isTransientFetchFailure(fail)) {
      return { result: lastResult, attempts, rateLimited };
    }

    const retryAfterWaitMs =
      fail.retryAfterSeconds !== undefined ? Math.min(5_000, fail.retryAfterSeconds * 1000) : 0;
    const expDelayMs = Math.min(5_000, baseDelayMs * Math.pow(2, attempt));
    const jitterMs = Math.floor(Math.random() * 120);
    await sleep(Math.max(retryAfterWaitMs, expDelayMs + jitterMs));
  }

  return { result: lastResult, attempts, rateLimited };
}

function extractXmlTag(block: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = block.match(regex);
  return match?.[1] ? match[1].trim() : '';
}

function extractAtomLink(block: string): string {
  const alt = block.match(/<link[^>]+rel=["']alternate["'][^>]+href=["']([^"']+)["'][^>]*\/?>/i);
  if (alt?.[1]) return alt[1].trim();
  const href = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*\/?>/i);
  if (href?.[1]) return href[1].trim();
  return extractXmlTag(block, 'link');
}

function extractMediaImageFromXml(block: string): string | undefined {
  const media =
    block.match(/<media:(?:content|thumbnail)[^>]+url=["']([^"']+)["']/i)?.[1] ||
    block.match(/<enclosure[^>]+type=["']image\/[^"']+["'][^>]+url=["']([^"']+)["']/i)?.[1] ||
    block.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]+type=["']image\/[^"']+["']/i)?.[1];
  return media ? sanitizeExternalUrl(decodeHtmlEntities(media)) || undefined : undefined;
}

/**
 * Lightweight zero-dependency RSS 2.0 and Atom XML parser.
 */
export function parseRssOrAtomFeed(
  xml: string,
  meta: { providerId: string; providerName: string; publisher: string; domainSlug: TrendzDomainSlug }
): DiscoveredSourceCandidate[] {
  const discoveredAtIso = new Date().toISOString();
  const results: DiscoveredSourceCandidate[] = [];

  const rssItems = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  const atomEntries = rssItems.length === 0 ? xml.match(/<entry\b[\s\S]*?<\/entry>/gi) || [] : [];
  const blocks = rssItems.length > 0 ? rssItems : atomEntries;

  for (const block of blocks) {
    const rawTitle = extractXmlTag(block, 'title');
    const title = sanitizePlainText(rawTitle, 260);
    const rawLink = rssItems.length > 0 ? extractXmlTag(block, 'link') || extractXmlTag(block, 'guid') : extractAtomLink(block);
    const decodedLink = decodeHtmlEntities(rawLink).trim();
    const safeUrl = sanitizeExternalUrl(decodedLink);
    if (!title || !safeUrl) continue;

    const rawPubDate =
      extractXmlTag(block, 'pubDate') ||
      extractXmlTag(block, 'published') ||
      extractXmlTag(block, 'updated') ||
      extractXmlTag(block, 'dc:date');

    let publishedAtIso = discoveredAtIso;
    if (rawPubDate) {
      const parsedMs = Date.parse(decodeHtmlEntities(rawPubDate));
      if (!Number.isNaN(parsedMs)) {
        publishedAtIso = new Date(parsedMs).toISOString();
      }
    }

    const rawExcerpt =
      extractXmlTag(block, 'description') ||
      extractXmlTag(block, 'summary') ||
      extractXmlTag(block, 'content:encoded') ||
      extractXmlTag(block, 'content');
    const excerpt = sanitizePlainText(rawExcerpt, 1200);
    const ogImageUrl = extractMediaImageFromXml(block);

    results.push({
      providerId: meta.providerId,
      providerName: meta.providerName,
      domainSlug: meta.domainSlug,
      title,
      url: safeUrl,
      publisherName: meta.publisher,
      publishedAtIso,
      excerpt,
      ogImageUrl,
      discoveredAtIso,
    });
  }

  return results;
}

/**
 * Built-in curated RSS/Atom news provider (active out of the box with zero API keys).
 */
export class RssFeedSourceProvider implements TrendSourceProvider {
  readonly id = 'curated_rss';
  readonly name = 'Curated Reputable RSS/Atom Feeds';
  readonly type = 'rss' as const;
  readonly description = 'Direct RSS/Atom discovery from curated reputable journalism, research, and trade feeds across all 11 Trendz domains.';
  readonly requiredEnvVars: string[] = [];
  readonly supportedDomains = SERVER_TRENDZ_DOMAIN_SLUGS;
  readonly rateLimitPerMinute = 30;

  isConfigured(): boolean {
    return true;
  }

  async discover(req: SourceDiscoveryRequest): Promise<SourceDiscoveryResult> {
    const startMs = Date.now();
    const candidates: DiscoveredSourceCandidate[] = [];
    const errors: string[] = [];
    const cutoffMs = Date.now() - req.windowHours * 3_600_000;
    let totalAttempts = 0;
    let requestCount = 0;
    let rateLimited = false;

    for (const domainSlug of req.domains) {
      const feeds = CURATED_RSS_FEEDS.filter((f) => f.domainSlug === domainSlug);
      const domainCandidates: DiscoveredSourceCandidate[] = [];
      const seenUrls = new Set<string>();

      for (const feed of feeds) {
        if (domainCandidates.length >= req.maxItemsPerDomain * 2) break;
        if (!consumeProviderQuota(this.id, this.rateLimitPerMinute)) {
          rateLimited = true;
          errors.push(`Provider '${this.id}' rate limit or cooldown active; skipped ${feed.publisher}.`);
          break;
        }

        requestCount++;
        const { result: fetched, attempts, rateLimited: hitLimit } = await fetchWithControlledBackoff(
          this.id,
          feed.url,
          {
            timeoutMs: req.requestTimeoutMs ?? 8_000,
            maxBytes: 1_000_000,
            accept: 'application/rss+xml,application/atom+xml,application/xml,text/xml;q=0.9,*/*;q=0.8',
            maxRetries: req.maxTransientRetries ?? 1,
            baseDelayMs: req.retryBaseDelayMs ?? 450,
          }
        );
        totalAttempts += attempts;
        if (hitLimit) rateLimited = true;

        if (!fetched.ok) {
          const errMsg = 'error' in fetched ? fetched.error : 'Unknown fetch error';
          errors.push(`RSS fetch failed (${feed.publisher}): ${errMsg}`);
          continue;
        }

        const parsed = parseRssOrAtomFeed(fetched.text, {
          providerId: this.id,
          providerName: this.name,
          publisher: feed.publisher,
          domainSlug,
        });

        for (const item of parsed) {
          const publishedMs = Date.parse(item.publishedAtIso);
          if (!Number.isNaN(publishedMs) && publishedMs < cutoffMs) {
            continue;
          }
          const canonical = canonicalizeSourceUrl(item.url) || item.url;
          if (seenUrls.has(canonical)) continue;
          seenUrls.add(canonical);
          domainCandidates.push(item);
          if (domainCandidates.length >= req.maxItemsPerDomain * 2) break;
        }
      }

      // Sort newest first and cap per domain (leaving headroom for validation/dedupe)
      domainCandidates.sort((a, b) => Date.parse(b.publishedAtIso) - Date.parse(a.publishedAtIso));
      candidates.push(...domainCandidates.slice(0, req.maxItemsPerDomain * 2));
    }

    return {
      providerId: this.id,
      providerName: this.name,
      candidates,
      errors,
      durationMs: Date.now() - startMs,
      attempts: totalAttempts,
      requestCount,
      rateLimited,
    };
  }
}

/**
 * Optional GNews external news API provider (activated only when process.env.GNEWS_API_KEY is set).
 */
export class GNewsApiProvider implements TrendSourceProvider {
  readonly id = 'gnews_api';
  readonly name = 'GNews News API';
  readonly type = 'api' as const;
  readonly description = 'Live external news discovery via GNews REST API (requires server-side GNEWS_API_KEY).';
  readonly requiredEnvVars = ['GNEWS_API_KEY'];
  readonly supportedDomains = SERVER_TRENDZ_DOMAIN_SLUGS;
  readonly rateLimitPerMinute = 15;

  isConfigured(): boolean {
    return Boolean(process.env.GNEWS_API_KEY && process.env.GNEWS_API_KEY.trim());
  }

  async discover(req: SourceDiscoveryRequest): Promise<SourceDiscoveryResult> {
    const startMs = Date.now();
    const apiKey = process.env.GNEWS_API_KEY?.trim();
    if (!apiKey) {
      return {
        providerId: this.id,
        providerName: this.name,
        candidates: [],
        errors: ['GNEWS_API_KEY is not configured on the server.'],
        durationMs: Date.now() - startMs,
        attempts: 0,
        requestCount: 0,
        rateLimited: false,
      };
    }

    const candidates: DiscoveredSourceCandidate[] = [];
    const errors: string[] = [];
    const fromIso = new Date(Date.now() - req.windowHours * 3_600_000).toISOString();
    const discoveredAtIso = new Date().toISOString();
    let totalAttempts = 0;
    let requestCount = 0;
    let rateLimited = false;

    for (const domainSlug of req.domains) {
      if (!consumeProviderQuota(this.id, this.rateLimitPerMinute)) {
        rateLimited = true;
        errors.push(`Provider '${this.id}' rate limit or cooldown active.`);
        break;
      }
      const meta = getServerDomainMeta(domainSlug);
      const endpoint = new URL('https://gnews.io/api/v4/search');
      endpoint.searchParams.set('q', meta.name);
      endpoint.searchParams.set('lang', 'en');
      endpoint.searchParams.set('max', String(Math.min(10, req.maxItemsPerDomain)));
      endpoint.searchParams.set('from', fromIso);
      endpoint.searchParams.set('apikey', apiKey);

      requestCount++;
      const { result: fetched, attempts, rateLimited: hitLimit } = await fetchWithControlledBackoff(
        this.id,
        endpoint.toString(),
        {
          timeoutMs: req.requestTimeoutMs ?? 8_000,
          maxBytes: 500_000,
          accept: 'application/json',
          maxRetries: req.maxTransientRetries ?? 2,
          baseDelayMs: req.retryBaseDelayMs ?? 500,
        }
      );
      totalAttempts += attempts;
      if (hitLimit) {
        rateLimited = true;
      }
      if (!fetched.ok) {
        const errMsg = 'error' in fetched ? fetched.error : 'Unknown fetch error';
        errors.push(`GNews API failed for '${domainSlug}': ${errMsg}`);
        if (hitLimit) break;
        continue;
      }

      try {
        const json = JSON.parse(fetched.text);
        const articles = Array.isArray(json?.articles) ? json.articles : [];
        for (const art of articles) {
          const safeUrl = sanitizeExternalUrl(art?.url);
          const title = sanitizePlainText(art?.title || '', 260);
          if (!safeUrl || !title) continue;
          candidates.push({
            providerId: this.id,
            providerName: this.name,
            domainSlug,
            title,
            url: safeUrl,
            publisherName: sanitizePlainText(art?.source?.name || 'GNews Source', 140),
            publishedAtIso:
              typeof art?.publishedAt === 'string' && !Number.isNaN(Date.parse(art.publishedAt))
                ? new Date(Date.parse(art.publishedAt)).toISOString()
                : discoveredAtIso,
            excerpt: sanitizePlainText(art?.description || art?.content || '', 1200),
            ogImageUrl: sanitizeExternalUrl(art?.image) || undefined,
            discoveredAtIso,
          });
        }
      } catch {
        errors.push(`GNews API returned malformed JSON for '${domainSlug}'.`);
      }
    }

    return {
      providerId: this.id,
      providerName: this.name,
      candidates,
      errors,
      durationMs: Date.now() - startMs,
      attempts: totalAttempts,
      requestCount,
      rateLimited,
    };
  }
}

/**
 * Optional NewsData.io API provider (activated only when process.env.NEWSDATA_API_KEY is set).
 */
export class NewsDataApiProvider implements TrendSourceProvider {
  readonly id = 'newsdata_api';
  readonly name = 'NewsData.io API';
  readonly type = 'api' as const;
  readonly description = 'Live external news discovery via NewsData.io API (requires server-side NEWSDATA_API_KEY).';
  readonly requiredEnvVars = ['NEWSDATA_API_KEY'];
  readonly supportedDomains = SERVER_TRENDZ_DOMAIN_SLUGS;
  readonly rateLimitPerMinute = 15;

  isConfigured(): boolean {
    return Boolean(process.env.NEWSDATA_API_KEY && process.env.NEWSDATA_API_KEY.trim());
  }

  async discover(req: SourceDiscoveryRequest): Promise<SourceDiscoveryResult> {
    const startMs = Date.now();
    const apiKey = process.env.NEWSDATA_API_KEY?.trim();
    if (!apiKey) {
      return {
        providerId: this.id,
        providerName: this.name,
        candidates: [],
        errors: ['NEWSDATA_API_KEY is not configured on the server.'],
        durationMs: Date.now() - startMs,
        attempts: 0,
        requestCount: 0,
        rateLimited: false,
      };
    }

    const candidates: DiscoveredSourceCandidate[] = [];
    const errors: string[] = [];
    const discoveredAtIso = new Date().toISOString();
    let totalAttempts = 0;
    let requestCount = 0;
    let rateLimited = false;

    for (const domainSlug of req.domains) {
      if (!consumeProviderQuota(this.id, this.rateLimitPerMinute)) {
        rateLimited = true;
        errors.push(`Provider '${this.id}' rate limit or cooldown active.`);
        break;
      }
      const meta = getServerDomainMeta(domainSlug);
      const endpoint = new URL('https://newsdata.io/api/1/latest');
      endpoint.searchParams.set('q', meta.name);
      endpoint.searchParams.set('language', 'en');
      endpoint.searchParams.set('apikey', apiKey);

      requestCount++;
      const { result: fetched, attempts, rateLimited: hitLimit } = await fetchWithControlledBackoff(
        this.id,
        endpoint.toString(),
        {
          timeoutMs: req.requestTimeoutMs ?? 8_000,
          maxBytes: 500_000,
          accept: 'application/json',
          maxRetries: req.maxTransientRetries ?? 2,
          baseDelayMs: req.retryBaseDelayMs ?? 500,
        }
      );
      totalAttempts += attempts;
      if (hitLimit) {
        rateLimited = true;
      }
      if (!fetched.ok) {
        const errMsg = 'error' in fetched ? fetched.error : 'Unknown fetch error';
        errors.push(`NewsData API failed for '${domainSlug}': ${errMsg}`);
        if (hitLimit) break;
        continue;
      }

      try {
        const json = JSON.parse(fetched.text);
        const results = Array.isArray(json?.results) ? json.results.slice(0, req.maxItemsPerDomain) : [];
        for (const item of results) {
          const safeUrl = sanitizeExternalUrl(item?.link);
          const title = sanitizePlainText(item?.title || '', 260);
          if (!safeUrl || !title) continue;
          candidates.push({
            providerId: this.id,
            providerName: this.name,
            domainSlug,
            title,
            url: safeUrl,
            publisherName: sanitizePlainText(item?.source_name || item?.source_id || 'NewsData Source', 140),
            publishedAtIso:
              typeof item?.pubDate === 'string' && !Number.isNaN(Date.parse(item.pubDate))
                ? new Date(Date.parse(item.pubDate)).toISOString()
                : discoveredAtIso,
            excerpt: sanitizePlainText(item?.description || item?.content || '', 1200),
            ogImageUrl: sanitizeExternalUrl(item?.image_url) || undefined,
            discoveredAtIso,
          });
        }
      } catch {
        errors.push(`NewsData API returned malformed JSON for '${domainSlug}'.`);
      }
    }

    return {
      providerId: this.id,
      providerName: this.name,
      candidates,
      errors,
      durationMs: Date.now() - startMs,
      attempts: totalAttempts,
      requestCount,
      rateLimited,
    };
  }
}

const DEFAULT_PROVIDERS: TrendSourceProvider[] = [
  new RssFeedSourceProvider(),
  new GNewsApiProvider(),
  new NewsDataApiProvider(),
];

export function getRegisteredSourceProviders(): TrendSourceProvider[] {
  return DEFAULT_PROVIDERS;
}

export function listSourceProviderSummaries(): TrendSourceProviderSummary[] {
  return DEFAULT_PROVIDERS.map((p) => {
    const configured = p.isConfigured();
    return {
      id: p.id,
      name: p.name,
      type: p.type,
      configured,
      status: configured ? 'ready' : 'needs_configuration',
      requiredEnvVars: [...p.requiredEnvVars],
      supportedDomains: [...p.supportedDomains],
      rateLimitPerMinute: p.rateLimitPerMinute,
      description: p.description,
    };
  });
}

export function getActiveSourceProviders(requestedProviderIds?: string[]): TrendSourceProvider[] {
  const configured = DEFAULT_PROVIDERS.filter((p) => p.isConfigured());
  if (!requestedProviderIds || requestedProviderIds.length === 0) {
    return configured;
  }
  const wanted = new Set(requestedProviderIds);
  return configured.filter((p) => wanted.has(p.id));
}
