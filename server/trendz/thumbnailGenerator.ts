import { GoogleGenAI } from '@google/genai';
import type { TrendMedia } from '../../types';
import type { TrendzDomainSlug } from '../../utils/trendzDomains';
import { sanitizeExternalUrl } from '../../utils/urlSanitizer';
import { getServerDomainMeta } from './domainCatalog';

export interface ThumbnailResolutionResult {
  media: TrendMedia;
  fallbackUsed: boolean;
  note: string;
}

export interface ResolveTrendMediaOptions {
  domainSlug: TrendzDomainSlug;
  title: string;
  publisherName: string;
  sourceOgImageUrl?: string;
  /** Optional custom AI image generator hook for testing graceful failure fallback */
  customAiImageGenerator?: (prompt: string) => Promise<{ imageUrl?: string; storagePath?: string } | null>;
}

/**
 * Resolves editorial thumbnail media for a Trendz item with graceful non-blocking fallback:
 * 1. Optional AI-generated abstract editorial visual ONLY when explicitly enabled via
 *    `TRENDZ_ENABLE_AI_THUMBNAILS=true` (and never failing a valid trend if generation errors).
 * 2. Verified source `og:image` metadata URL with explicit publisher attribution (never rehosting
 *    copyrighted images without permission).
 * 3. Deterministic domain-specific visual fallback (`origin: 'domain_fallback'`).
 */
export async function resolveTrendEditorialMedia(
  options: ResolveTrendMediaOptions
): Promise<ThumbnailResolutionResult> {
  const domainMeta = getServerDomainMeta(options.domainSlug);
  const aiThumbnailsEnabled =
    process.env.TRENDZ_ENABLE_AI_THUMBNAILS === 'true' || Boolean(options.customAiImageGenerator);

  if (aiThumbnailsEnabled) {
    const visualPrompt = `Minimal monochrome editorial illustration symbolizing ${domainMeta.name}: ${options.title.slice(0, 120)}. Dark obsidian background, sharp geometric architectural light lines, high-contrast magazine aesthetic, no text, no logos, no watermarks.`;
    try {
      if (options.customAiImageGenerator) {
        const customResult = await options.customAiImageGenerator(visualPrompt);
        const safeUrl = sanitizeExternalUrl(customResult?.imageUrl);
        if (safeUrl) {
          return {
            media: {
              type: 'image',
              url: safeUrl,
              thumbnailUrl: safeUrl,
              origin: 'ai_generated',
              attribution: 'INVOX Editorial AI Visual',
              ...(customResult?.storagePath ? { storagePath: customResult.storagePath } : {}),
            },
            fallbackUsed: false,
            note: 'Resolved via configured editorial visual generator.',
          };
        }
      } else if (process.env.GEMINI_API_KEY) {
        // Opt-in editorial image generation using verified Gemini image model (requires billing-enabled key)
        const ai = new GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
        });
        const response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite-image',
          contents: visualPrompt,
          config: {
            responseModalities: ['IMAGE'],
            imageConfig: { aspectRatio: '16:9' },
          },
        });
        const parts = response.candidates?.[0]?.content?.parts || [];
        const hasImageData = parts.some((p: any) => Boolean(p?.inlineData?.data));
        if (hasImageData) {
          // Inline data URIs exceed Firestore URL rules; require Storage upload path when Storage Admin IAM is configured.
          // Fall through gracefully to source OG or domain fallback so no trend is lost or rejected by rules.
          console.info('[TRENDZ_MEDIA] AI image generated; falling back to HTTP-verified URL until Storage bucket upload is configured.');
        }
      }
    } catch (err: any) {
      console.warn(
        `[TRENDZ_MEDIA_FALLBACK] Editorial AI thumbnail generation failed (${err?.message || 'unknown error'}); applying safe fallback.`
      );
    }
  }

  // Fallback 1: Sanitized source OpenGraph preview image with explicit publisher attribution
  const safeOgUrl = sanitizeExternalUrl(options.sourceOgImageUrl);
  if (safeOgUrl) {
    return {
      media: {
        type: 'image',
        url: safeOgUrl,
        thumbnailUrl: safeOgUrl,
        origin: 'source_og',
        attribution: `Source preview via ${options.publisherName.slice(0, 120)}`,
      },
      fallbackUsed: aiThumbnailsEnabled,
      note: aiThumbnailsEnabled
        ? 'AI thumbnail unavailable; fell back cleanly to attributed source OpenGraph image.'
        : 'Using attributed source OpenGraph preview image.',
    };
  }

  // Fallback 2: Deterministic verified domain editorial visual (guaranteed HTTP URL valid in Firestore rules)
  return {
    media: {
      type: 'image',
      url: domainMeta.fallbackImageUrl,
      thumbnailUrl: domainMeta.fallbackImageUrl,
      origin: 'domain_fallback',
      attribution: domainMeta.fallbackAttribution,
    },
    fallbackUsed: true,
    note: 'Applied verified domain fallback visual.',
  };
}
