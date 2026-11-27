import type { TrendMediaOrigin, TrendSourceCredibilityTier, TrendStatus } from '../types';
import type { TrendzDomainSlug } from './trendzDomains';

export type FallbackSourceExcerptCompleteness = 'full_excerpt' | 'truncated' | 'unavailable';

export interface FallbackAdditionalSourceData {
  name: string;
  url: string;
  publishedOn?: string;
}

/**
 * Pure, framework-agnostic serializable representation of DEV_FALLBACK sample Trendz records.
 * Shared across client UI (`services/trendzService.ts`) and server-side contextual AI
 * (`server/trendz/contextualAiService.ts`) so sample metadata never drifts and never mixes
 * with production Firestore records.
 */
export interface FallbackSampleTrendData {
  id: string;
  domainName: string;
  domainSlug: TrendzDomainSlug;
  isFollowedDefault: boolean;
  category: string;
  title: string;
  summary: string;
  fullContent: string;
  whyItMatters: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  thumbnailUrl?: string;
  mediaOverlayUrl: string;
  mediaOrigin: TrendMediaOrigin;
  sourceThumbnailUrl?: string;
  mediaAttribution?: string;
  publishedBy: string;
  publishedOn: string;
  sourceUrl: string;
  sourceAuthor?: string;
  sourceDomain: string;
  sourceCredibilityTier: TrendSourceCredibilityTier;
  canonicalUrl: string;
  groundingStatus: 'verified' | 'needs_review';
  aiModel: string;
  sourceExcerpt?: string;
  sourceExcerptTruncated?: boolean;
  sourceExcerptCompleteness: FallbackSourceExcerptCompleteness;
  additionalSources?: FallbackAdditionalSourceData[];
  publishedAtIso: string;
  discoveredAtIso: string;
  tags: string[];
  searchKeywords: string[];
  momentumScore: number;
  relatedTrendIds: string[];
  keyTakeaways: string[];
  status: TrendStatus;
}

export const TRENDZ_FALLBACK_SAMPLE_DATA: readonly FallbackSampleTrendData[] = [
  {
    id: '8',
    domainName: 'Technology',
    domainSlug: 'technology',
    isFollowedDefault: true,
    category: 'AI & Media',
    title: 'AI-Driven Cinematography: The Next Film Revolution',
    summary:
      'Discover how artificial intelligence is transforming filmmaking, from automated editing to generating entire scenes. This video showcases the cutting-edge tools changing Hollywood.',
    fullContent:
      'The film industry is on the brink of a new revolution, powered by artificial intelligence. Sophisticated AI algorithms are now capable of analyzing scripts to predict box office success, automating tedious editing processes, and even generating photorealistic scenes and characters. This trend explores how AI-driven cinematography and virtual production are enabling filmmakers to bring their most ambitious visions to life, while also raising questions about the future of creativity in an automated world.',
    whyItMatters:
      'Open-source 3D pipelines and AI-assisted virtual production lower pre-visualization costs for independent studios while reshaping visual effects workflows across major productions.',
    mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    mediaType: 'video',
    thumbnailUrl: 'https://mango.blender.org/wp-content/uploads/2013/05/01_thom_celia_bridge.jpg',
    mediaOverlayUrl: '',
    mediaOrigin: 'source_og',
    sourceThumbnailUrl: 'https://mango.blender.org/wp-content/uploads/2013/05/01_thom_celia_bridge.jpg',
    mediaAttribution: 'Blender Foundation / Mango Open Movie (CC-BY)',
    publishedBy: 'Blender Foundation',
    publishedOn: '12-03-2025',
    sourceUrl: 'https://www.blender.org/about/projects/',
    sourceAuthor: 'Blender Studio Production Desk',
    sourceDomain: 'blender.org',
    sourceCredibilityTier: 'primary',
    canonicalUrl: 'https://blender.org/about/projects',
    groundingStatus: 'verified',
    aiModel: 'gemini-2.5-flash',
    sourceExcerpt:
      'Blender Foundation open projects bring together artists and engineers to test real-time rendering, compositing, and open-source film production tools in production-grade short films.',
    sourceExcerptTruncated: true,
    sourceExcerptCompleteness: 'truncated',
    publishedAtIso: '2025-03-12T10:00:00Z',
    discoveredAtIso: '2025-03-12T11:15:00Z',
    tags: ['ai', 'cinematography', 'film', 'virtual-production'],
    searchKeywords: ['ai', 'cinematography', 'film', 'hollywood', 'blender', 'cinetech', 'technology'],
    momentumScore: 98.4,
    relatedTrendIds: ['3', '2'],
    keyTakeaways: [
      'AI tooling accelerates pre-visualization and virtual production pipelines.',
      'Automated editing and script analysis reduce post-production bottlenecks.',
    ],
    status: 'published',
  },
  {
    id: '1',
    domainName: 'Health Care',
    domainSlug: 'health-care',
    isFollowedDefault: true,
    category: 'Biotech',
    title: 'Super Skin Heals Wounds 90% In 4 Hours',
    summary:
      'Super skin, an advanced wound-healing technology, accelerates recovery by 90% within just 4 hours and fully repairs the tissue in 24, ensuring faster and more effective healing.',
    fullContent:
      'Super skin, an advanced wound-healing technology, accelerates recovery by 90% within just 4 hours and fully repairs the tissue in 24, ensuring faster and more effective healing. It enhances the natural healing process, repairing wounds up to 90% within just 4 hours. Whether for minor cuts, surgical recovery, or injuries, super skin promotes rapid repair, minimizes scarring, and promotes healthier skin regeneration in record time.',
    whyItMatters:
      'Rapid-acting bioengineered hydrogels could shorten post-surgical recovery windows and reduce infection risk in acute trauma and burn care once clinical trials validate long-term safety.',
    mediaUrl: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?q=80&w=2070&auto=format&fit=crop',
    mediaType: 'image',
    mediaOverlayUrl: 'https://images.unsplash.com/photo-1612536539035-1a8335aa8823?q=80&w=1974&auto=format&fit=crop',
    mediaOrigin: 'domain_fallback',
    publishedBy: 'National Institutes of Health',
    publishedOn: '11-03-2025',
    sourceUrl: 'https://www.nih.gov/news-events',
    sourceAuthor: 'NIH Biomedical Research Desk',
    sourceDomain: 'nih.gov',
    sourceCredibilityTier: 'primary',
    canonicalUrl: 'https://nih.gov/news-events',
    groundingStatus: 'verified',
    aiModel: 'gemini-2.5-flash',
    sourceExcerpt:
      'Biomedical researchers are advancing synthetic hydrogel matrices designed to mimic native extracellular scaffolds and support accelerated dermal closure in preclinical wound models.',
    sourceExcerptTruncated: true,
    sourceExcerptCompleteness: 'truncated',
    publishedAtIso: '2025-03-11T10:00:00Z',
    discoveredAtIso: '2025-03-11T12:05:00Z',
    tags: ['medtech', 'biotech', 'regenerative-medicine', 'healthcare'],
    searchKeywords: ['super', 'skin', 'wound', 'healing', 'medtech', 'nih', 'health', 'care'],
    momentumScore: 89.1,
    relatedTrendIds: ['2'],
    keyTakeaways: [
      'Bioengineered hydrogel matrix accelerates tissue regeneration within 4 hours.',
    ],
    status: 'published',
  },
  {
    id: '2',
    domainName: 'Health Care',
    domainSlug: 'health-care',
    isFollowedDefault: true,
    category: 'Medical AI',
    title: 'AI Achieved 99% Accuracy Detecting Cancer',
    summary:
      'A Global Team Of Scientist Created An AI Model That Can Now Detect Cancer With 99.2% Accuracy Beating Even Doctors And Current Tools. It was trained on thousands of microscope images, covering everything from normal tissue.',
    fullContent:
      'A Global Team Of Scientist Created An AI Model That Can Now Detect Cancer With 99.2% Accuracy Beating Even Doctors And Current Tools. It was trained on thousands of microscope images, covering everything from normal tissue to malignant cells. This breakthrough promises earlier diagnosis, more effective treatment planning, and a significant step forward in the fight against cancer.',
    whyItMatters:
      'High-sensitivity digital pathology models can serve as a second-reader triage layer for overworked oncology labs, accelerating early-stage detection across underserved hospital networks.',
    mediaUrl: 'https://images.unsplash.com/photo-1554734867-bf3c00a49371?q=80&w=2070&auto=format&fit=crop',
    mediaType: 'image',
    mediaOverlayUrl: 'https://images.unsplash.com/photo-1526253752538-345100688942?q=80&w=2070&auto=format&fit=crop',
    mediaOrigin: 'domain_fallback',
    publishedBy: 'Nature Portfolio',
    publishedOn: '10-03-2025',
    sourceUrl: 'https://www.nature.com/subjects/oncology',
    sourceAuthor: 'Nature Oncology Research Editors',
    sourceDomain: 'nature.com',
    sourceCredibilityTier: 'primary',
    canonicalUrl: 'https://nature.com/subjects/oncology',
    groundingStatus: 'verified',
    aiModel: 'gemini-2.5-flash',
    sourceExcerpt:
      'Peer-reviewed oncology studies highlight multimodal pathology foundation models evaluated on whole-slide biopsy datasets to assist clinicians in identifying malignant cellular morphology.',
    sourceExcerptTruncated: false,
    sourceExcerptCompleteness: 'full_excerpt',
    publishedAtIso: '2025-03-10T10:00:00Z',
    discoveredAtIso: '2025-03-10T13:20:00Z',
    tags: ['ai', 'oncology', 'diagnostics', 'healthcare'],
    searchKeywords: ['ai', 'cancer', 'detection', 'diagnostics', 'nature', 'forward', 'health', 'care'],
    momentumScore: 93.7,
    relatedTrendIds: ['1', '8'],
    keyTakeaways: [
      'Pathology vision model reaches 99.2% detection sensitivity across biopsy slides.',
    ],
    status: 'published',
  },
  {
    id: '3',
    domainName: 'Technology',
    domainSlug: 'technology',
    isFollowedDefault: true,
    category: 'Quantum Computing',
    title: 'Quantum Computing Achieves New Milestone',
    summary:
      'Researchers have successfully maintained quantum coherence for a record-breaking duration, paving the way for more stable and powerful quantum computers.',
    fullContent:
      'In a significant leap for quantum computing, researchers at a leading institute have successfully maintained quantum coherence in a qubit system for a record-breaking duration. This breakthrough addresses one of the primary obstacles in building functional quantum computers, paving the way for more stable, powerful, and error-resistant machines capable of solving problems far beyond the reach of classical computers.',
    whyItMatters:
      'Longer coherence times directly lower the physical-to-logical qubit overhead required for error correction, moving quantum chemistry and optimization workloads closer to commercial viability.',
    mediaUrl: 'https://images.unsplash.com/photo-1617854818583-09e7f077a156?q=80&w=2070&auto=format&fit=crop',
    mediaType: 'image',
    mediaOverlayUrl: 'https://images.unsplash.com/photo-1534723452862-4c874018d66d?q=80&w=1964&auto=format&fit=crop',
    mediaOrigin: 'domain_fallback',
    publishedBy: 'IBM Quantum',
    publishedOn: '09-03-2025',
    sourceUrl: 'https://www.ibm.com/quantum',
    sourceAuthor: 'IBM Quantum Hardware Team',
    sourceDomain: 'ibm.com',
    sourceCredibilityTier: 'reputable',
    canonicalUrl: 'https://ibm.com/quantum',
    groundingStatus: 'verified',
    aiModel: 'gemini-2.5-flash',
    sourceExcerpt:
      'Utility-scale quantum processors pair improved coherence times with modular error-mitigation architectures to execute deeper quantum circuits reliably.',
    sourceExcerptTruncated: true,
    sourceExcerptCompleteness: 'truncated',
    publishedAtIso: '2025-03-09T10:00:00Z',
    discoveredAtIso: '2025-03-09T11:45:00Z',
    tags: ['quantum', 'computing', 'qubits', 'technology'],
    searchKeywords: ['quantum', 'computing', 'coherence', 'qubit', 'ibm', 'frontiers', 'technology'],
    momentumScore: 96.2,
    relatedTrendIds: ['8'],
    keyTakeaways: [
      'Extended qubit coherence reduces logical error rates for fault-tolerant computing.',
    ],
    status: 'published',
  },
  {
    id: '4',
    domainName: 'Trading',
    domainSlug: 'trading',
    isFollowedDefault: false,
    category: 'Algorithmic Trading',
    title: 'AI-Powered Trading Bots Outperform Market',
    summary:
      'A new study reveals that advanced AI-powered trading bots are consistently outperforming traditional market benchmarks, leveraging real-time data analysis.',
    fullContent:
      'A new comprehensive study has revealed that advanced AI-powered trading bots are consistently outperforming traditional market benchmarks. By leveraging sophisticated algorithms and real-time data analysis, these bots can identify and act on market opportunities faster than human traders, marking a significant shift in the landscape of financial trading and investment strategies.',
    whyItMatters:
      'Rapid adoption of autonomous execution models increases intraday liquidity efficiency while prompting heightened scrutiny from financial regulators over correlated model risk.',
    mediaUrl: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?q=80&w=2070&auto=format&fit=crop',
    mediaType: 'image',
    mediaOverlayUrl: 'https://images.unsplash.com/photo-1640286599723-3a479a3243c2?q=80&w=1964&auto=format&fit=crop',
    mediaOrigin: 'domain_fallback',
    publishedBy: 'U.S. SEC Market Oversight',
    publishedOn: '08-03-2025',
    sourceUrl: 'https://www.sec.gov/spotlight/artificial-intelligence',
    sourceDomain: 'sec.gov',
    sourceCredibilityTier: 'primary',
    canonicalUrl: 'https://sec.gov/spotlight/artificial-intelligence',
    groundingStatus: 'needs_review',
    aiModel: 'gemini-2.5-flash',
    sourceExcerptCompleteness: 'unavailable',
    publishedAtIso: '2025-03-08T10:00:00Z',
    discoveredAtIso: '2025-03-08T14:10:00Z',
    tags: ['trading', 'fintech', 'ai', 'quant'],
    searchKeywords: ['trading', 'bots', 'fintech', 'sec', 'market', 'algorithms', 'ai'],
    momentumScore: 84.5,
    relatedTrendIds: ['5'],
    keyTakeaways: [
      'Real-time multi-signal models improve execution speed over legacy heuristics.',
    ],
    status: 'published',
  },
  {
    id: '5',
    domainName: 'Stock Market',
    domainSlug: 'stock-market',
    isFollowedDefault: false,
    category: 'Clean Energy Equities',
    title: 'Green Energy Stocks Surge on New Policy',
    summary:
      'Following the announcement of new global green energy policies, stocks in the renewable energy sector have seen an unprecedented surge, attracting significant investor interest.',
    fullContent:
      'Following the announcement of new global green energy policies, stocks in the renewable energy sector have experienced an unprecedented surge. This rally is attracting significant investor interest, as companies specializing in solar, wind, and other sustainable technologies are expected to see massive growth, signaling a major shift in market dynamics towards sustainability.',
    whyItMatters:
      'Multi-year grid modernization incentives and utility-scale solar deployment targets are re-pricing capital allocation across global renewable energy equities.',
    mediaUrl: 'https://images.unsplash.com/photo-1466611653911-95081537e5b7?q=80&w=2070&auto=format&fit=crop',
    mediaType: 'image',
    mediaOverlayUrl: 'https://images.unsplash.com/photo-1623352013854-a65c275a59a6?q=80&w=1965&auto=format&fit=crop',
    mediaOrigin: 'domain_fallback',
    publishedBy: 'International Energy Agency',
    publishedOn: '07-03-2025',
    sourceUrl: 'https://www.iea.org/topics/renewables',
    sourceAuthor: 'IEA Renewables Analysis',
    sourceDomain: 'iea.org',
    sourceCredibilityTier: 'primary',
    canonicalUrl: 'https://iea.org/topics/renewables',
    groundingStatus: 'verified',
    aiModel: 'gemini-2.5-flash',
    sourceExcerpt:
      'Global renewable power capacity additions continue to set records, led by utility-scale solar PV and wind projects backed by long-term policy frameworks and grid investment.',
    sourceExcerptTruncated: true,
    sourceExcerptCompleteness: 'truncated',
    additionalSources: [
      {
        name: 'IEA Energy System Overview',
        url: 'https://www.iea.org/energy-system/renewables',
        publishedOn: '07-03-2025',
      },
    ],
    publishedAtIso: '2025-03-07T10:00:00Z',
    discoveredAtIso: '2025-03-07T12:30:00Z',
    tags: ['stock-market', 'green-energy', 'renewables', 'policy'],
    searchKeywords: ['green', 'energy', 'stocks', 'renewable', 'iea', 'market', 'watch', 'policy'],
    momentumScore: 87.3,
    relatedTrendIds: ['4'],
    keyTakeaways: [
      'Clean-energy incentives drive broad institutional inflows across solar and wind equities.',
    ],
    status: 'published',
  },
];

export function getFallbackSampleTrendDataById(trendId: string): FallbackSampleTrendData | null {
  const clean = typeof trendId === 'string' ? trendId.trim() : '';
  if (!clean) return null;
  return TRENDZ_FALLBACK_SAMPLE_DATA.find((item) => item.id === clean) || null;
}
