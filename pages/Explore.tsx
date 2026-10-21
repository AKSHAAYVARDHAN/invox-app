import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { FeedCard } from '../components/feed/FeedCard';
import { QueryCard } from '../components/feed/QueryCard';
import { ThreadCard } from '../components/feed/ThreadCard';
import { PollCard } from '../components/feed/PollCard';
import DomainFilter from '../components/ui/DomainFilter';
import type { Post, Poll, PollOption } from '../types';
import { PostType } from '../types';
import ErrorBoundary from '../components/utils/ErrorBoundary';
import FeedCardSkeleton from '../components/feed/FeedCardSkeleton';
import { useFilters } from '../contexts/AIAssistantContext';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToFeed, getUserLikedPostIds, getUserSavedPostIds, toggleLikePost, toggleBookmarkPost } from '../services/postService';
import { subscribeToPolls, getUserVotedPolls } from '../services/pollService';
import { applyDomainAndSearchFilter, calculateContentCounts } from '../utils/domainFilter';
import { sortItemsByTrending } from '../utils/trendingScore';
import {
    CodeBracketIcon,
    GlobeAltIcon,
    BriefcaseIcon,
    FireIcon,
    PencilSquareIcon,
    SparklesIcon,
    ShieldCheckIcon,
    AcademicCapIcon,
    CurrencyDollarIcon,
    UsersIcon,
    MagnifyingGlassIcon,
    XMarkIcon
} from '../components/ui/Icons';
import { searchUsersByUsername } from '../services/usernameService';

const initialMockPosts: Post[] = [
    {
        id: 'mock-1',
        author: { name: 'Galaxies', avatarUrl: 'https://picsum.photos/id/1/200/200', isVerified: true },
        aiSummary: "A mesmerizing view of the cosmos.",
        content: "Exploring the vastness of space, this stunning capture of a distant galaxy reminds us of the universe's beauty and mystery. Billions of stars, each a potential sun for other worlds.",
        mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
        mediaType: 'video',
        thumbnailUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1280&h=720&auto=format&fit=crop',
        stats: { likes: 87200, views: 42300000, comments: 11200 },
        type: PostType.Feed,
        category: 'Science',
        domain: 'Science',
        createdAt: new Date(Date.now() - 3600000 * 24),
    },
    {
        id: 'mock-2',
        author: { name: 'Albert Darwin', avatarUrl: 'https://picsum.photos/id/2/200/200', isVerified: true },
        aiSummary: "A thread on the world's largest forest.",
        content: "The Amazon isn't just a forest; it's the lungs of our planet. This thread dives into its incredible biodiversity, the indigenous communities that protect it, and the threats it faces.",
        mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
        mediaType: 'video',
        thumbnailUrl: 'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?q=80&w=1280&h=720&auto=format&fit=crop',
        stats: { likes: 87200, views: 42300000, comments: 11200 },
        type: PostType.Thread,
        category: 'Society',
        domain: 'Society & Ideas',
        createdAt: new Date(Date.now() - 3600000 * 48),
        userCommented: true,
    },
    {
        id: 'mock-3',
        author: { name: 'Wozniak', avatarUrl: 'https://picsum.photos/id/3/200/200', isVerified: true },
        aiSummary: "Query: What will be the next true innovation?",
        content: "Beyond AI and blockchain, what emerging technology do you believe will fundamentally reshape our society in the next two decades? Share your most forward-thinking ideas.",
        mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        mediaType: 'video',
        thumbnailUrl: 'https://images.unsplash.com/photo-1533758-542159882a88?q=80&w=1280&h=720&auto=format&fit=crop',
        stats: { likes: 87200, views: 42300000, comments: 11200 },
        type: PostType.Query,
        category: 'Technology',
        domain: 'Technology',
        createdAt: new Date(Date.now() - 3600000 * 72),
        userSharedInsight: true,
    },
    {
        id: 'mock-4',
        author: { name: 'TechCrunch', avatarUrl: 'https://picsum.photos/id/4/200/200', isVerified: true },
        aiSummary: "The Future of Quantum Computing is Now",
        content: "Exploring the latest breakthroughs in quantum supremacy and how it will revolutionize industries from medicine to finance. The implications are vast and the progress is accelerating.",
        mediaUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=2070&auto=format&fit=crop',
        mediaType: 'image',
        stats: { likes: 95000, views: 5000000, comments: 18000 },
        type: PostType.Feed,
        category: 'Technology',
        domain: 'Technology',
        createdAt: new Date(Date.now() - 3600000 * 96),
    },
    {
        id: 'mock-5',
        author: { name: 'Sports Illustrated', avatarUrl: 'https://picsum.photos/id/5/200/200' },
        aiSummary: "Underdog Story: The Champion Nobody Saw Coming",
        content: "A deep dive into the incredible journey of the team that defied all odds. From rigorous training to their final victory, this is a story of perseverance and spirit.",
        mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        mediaType: 'video',
        thumbnailUrl: 'https://peach.blender.org/wp-content/uploads/title_anouncement.jpg?x11217',
        stats: { likes: 120000, views: 8000000, comments: 25000 },
        type: PostType.Feed,
        category: 'Health',
        domain: 'Health & Medicine',
        createdAt: new Date(Date.now() - 3600000 * 120),
    },
    {
        id: 'mock-6',
        author: { name: 'Y Combinator', avatarUrl: 'https://picsum.photos/id/6/200/200', isVerified: true },
        aiSummary: "Building a Billion-Dollar Company from a Garage",
        content: "This thread breaks down the essential steps for aspiring entrepreneurs. From idea validation to securing your first round of funding, we cover it all. What are the key metrics you should be tracking?",
        mediaUrl: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=2070&auto=format&fit=crop',
        mediaType: 'image',
        stats: { likes: 250000, views: 15000000, comments: 40000 },
        type: PostType.Thread,
        category: 'Start Up',
        domain: 'Startups & Entrepreneurship',
        createdAt: new Date(Date.now() - 3600000 * 140),
    },
    {
        id: 'mock-7',
        author: { name: 'MusicNotes', avatarUrl: 'https://picsum.photos/id/7/200/200' },
        aiSummary: "What's the most influential album of the last decade?",
        content: "Looking for opinions from music lovers. Which album changed the game in terms of sound, production, or cultural impact? Drop your thoughts and justifications below.",
        mediaUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=2070&auto=format&fit=crop',
        mediaType: 'image',
        stats: { likes: 45000, views: 2000000, comments: 8000 },
        type: PostType.Query,
        category: 'Music',
        domain: 'Arts & Culture',
        createdAt: new Date(Date.now() - 3600000 * 160),
    },
    {
        id: 'mock-8',
        author: { name: 'Art Today', avatarUrl: 'https://picsum.photos/id/8/200/200', isVerified: true },
        aiSummary: "The Resurgence of Renaissance Techniques in Modern Art",
        content: "Contemporary artists are increasingly drawing inspiration from the old masters. This post explores how techniques like chiaroscuro and sfumato are being reinterpreted in the digital age.",
        mediaUrl: 'https://images.unsplash.com/photo-1547891654-e66ed7110189?q=80&w=1974&auto=format&fit=crop',
        mediaType: 'image',
        stats: { likes: 78000, views: 3500000, comments: 12000 },
        type: PostType.Feed,
        category: 'Art',
        domain: 'Arts & Culture',
        createdAt: new Date(Date.now() - 3600000 * 180),
    },
    {
        id: 'mock-9',
        author: { name: 'SaaS Pulse', avatarUrl: 'https://picsum.photos/id/15/200/200', isVerified: true },
        aiSummary: "B2B Outbound Sales Playbook for High-ACV Software",
        content: "Breaking down how developer-focused software companies scale from $1M to $10M ARR. When should you hire your first forward-deployed engineer or technical account executive?",
        stats: { likes: 42100, views: 1800000, comments: 6400 },
        type: PostType.Thread,
        category: 'Business',
        domain: 'Business',
        createdAt: new Date(Date.now() - 3600000 * 36),
    },
    {
        id: 'mock-10',
        author: { name: 'Enterprise Hub', avatarUrl: 'https://picsum.photos/id/16/200/200', isVerified: true },
        aiSummary: "Query: PLG vs Enterprise Sales motions in 2026",
        content: "How is your engineering or revenue organization navigating the transition between product-led user acquisition and enterprise annual contract values?",
        stats: { likes: 31000, views: 1200000, comments: 4500 },
        type: PostType.Query,
        category: 'Finance',
        domain: 'Finance',
        createdAt: new Date(Date.now() - 3600000 * 60),
    },
    {
        id: 'mock-11',
        author: { name: 'DevRel Daily', avatarUrl: 'https://picsum.photos/id/17/200/200', isVerified: true },
        aiSummary: "Query: Developer marketing in the post-search era",
        content: "With generative engines summarizing technical documentation, how are developer relations and growth teams measuring technical audience mindshare?",
        stats: { likes: 58000, views: 2400000, comments: 7200 },
        type: PostType.Query,
        category: 'Education',
        domain: 'Education & Research',
        createdAt: new Date(Date.now() - 3600000 * 80),
    },
    {
        id: 'mock-12',
        author: { name: 'Product Forge', avatarUrl: 'https://picsum.photos/id/18/200/200', isVerified: true },
        aiSummary: "Query: Defining North Star metrics for autonomous background agents",
        content: "Traditional active user metrics fail when background agents execute operations without direct human clicks. What retention and velocity KPIs are product leaders adopting?",
        stats: { likes: 49000, views: 1950000, comments: 6100 },
        type: PostType.Query,
        category: 'Start Up',
        domain: 'Startups & Entrepreneurship',
        createdAt: new Date(Date.now() - 3600000 * 100),
    },
    {
        id: 'mock-13',
        author: { name: 'Figma Lab', avatarUrl: 'https://picsum.photos/id/19/200/200', isVerified: true },
        aiSummary: "Spatial UI design principles for next-generation canvas interfaces",
        content: "A detailed breakdown of optical hierarchy, contrast ratios, and spatial typography in canvas-first application design. How density and negative space define readability.",
        stats: { likes: 64000, views: 2800000, comments: 8900 },
        type: PostType.Thread,
        category: 'Design',
        domain: 'Design',
        createdAt: new Date(Date.now() - 3600000 * 110),
    },
    // ── ADDITIONAL FEEDS POSTS: LISTEN MODE (Podcasts, recorded interviews, audio tapes, video explainers) ──
    {
        id: 'mock-feed-listen-tech',
        author: { name: 'Silicon Tape', avatarUrl: 'https://picsum.photos/id/21/200/200', isVerified: true },
        aiSummary: "Recorded Interview: Next-Gen Wafer-Scale Accelerators with Dr. Lin",
        content: "In this recorded podcast episode and hardware teardown, we sit down with Dr. Elena Lin to discuss wafer-scale integration, sub-nanosecond interconnects, and why conventional Von Neumann architectures are bottlenecking trillion-parameter models.",
        mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
        mediaType: 'video',
        thumbnailUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1280&h=720&auto=format&fit=crop',
        stats: { likes: 52100, views: 2400000, comments: 8400 },
        type: PostType.Feed,
        category: 'Technology',
        domain: 'Technology',
        tags: ['podcast', 'interview', 'hardware', 'technology'],
        createdAt: new Date(Date.now() - 3600000 * 18),
    },
    {
        id: 'mock-feed-listen-startup',
        author: { name: 'Venture Voices', avatarUrl: 'https://picsum.photos/id/22/200/200', isVerified: true },
        aiSummary: "Podcast Dispatch: How 3-Person Teams Reach $10M ARR in 2026",
        content: "A recorded executive session examining autonomous workflow deployment, AI-augmented developer leverage, and why high-margin lean agencies are outcompeting traditional venture-backed scaleups.",
        mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
        mediaType: 'video',
        thumbnailUrl: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?q=80&w=1280&h=720&auto=format&fit=crop',
        stats: { likes: 64500, views: 3100000, comments: 9200 },
        type: PostType.Feed,
        category: 'Start Up',
        domain: 'Startups & Entrepreneurship',
        tags: ['podcast', 'interview', 'startup'],
        createdAt: new Date(Date.now() - 3600000 * 28),
    },
    {
        id: 'mock-feed-listen-science',
        author: { name: 'Quantum Radio', avatarUrl: 'https://picsum.photos/id/23/200/200', isVerified: true },
        aiSummary: "Audio Tape & Explainer: Deep Space Interstellar Probe Trajectories",
        content: "Recorded radio transmission and visual analysis of the latest gravitational assist maneuvers. Hear real electromagnetic telemetry captured from the heliopause boundary.",
        mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
        mediaType: 'video',
        thumbnailUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1280&h=720&auto=format&fit=crop',
        stats: { likes: 78000, views: 3900000, comments: 11400 },
        type: PostType.Feed,
        category: 'Science',
        domain: 'Science',
        tags: ['audio', 'recording', 'tape', 'science'],
        createdAt: new Date(Date.now() - 3600000 * 32),
    },
    {
        id: 'mock-feed-listen-finance',
        author: { name: 'Algorithmic Pulse', avatarUrl: 'https://picsum.photos/id/28/200/200', isVerified: true },
        aiSummary: "Video Explainer: Order Book Microstructure & Cross-Venue Arbitrage",
        content: "A visual and audio explainer demonstrating nanosecond liquidity shifts across fragmented order books and automated hedging algorithms in volatile macroeconomic regimes.",
        mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
        mediaType: 'video',
        thumbnailUrl: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?q=80&w=1280&h=720&auto=format&fit=crop',
        stats: { likes: 41200, views: 1890000, comments: 5300 },
        type: PostType.Feed,
        category: 'Finance',
        domain: 'Finance',
        tags: ['video', 'explainer', 'finance'],
        createdAt: new Date(Date.now() - 3600000 * 50),
    },
    {
        id: 'mock-feed-listen-art',
        author: { name: 'Acoustic Forms', avatarUrl: 'https://picsum.photos/id/29/200/200', isVerified: true },
        aiSummary: "Sound Tape: Generative Audio Landscapes and Spatial Modular Synthesis",
        content: "Listen to this recorded studio session exploring microtonal tunings, algorithmic patch cables, and spatial acoustics in contemporary sound design.",
        mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4',
        mediaType: 'video',
        thumbnailUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1280&h=720&auto=format&fit=crop',
        stats: { likes: 36700, views: 1450000, comments: 4800 },
        type: PostType.Feed,
        category: 'Art',
        domain: 'Arts & Culture',
        tags: ['audio', 'tape', 'music', 'art'],
        createdAt: new Date(Date.now() - 3600000 * 62),
    },
    {
        id: 'mock-feed-listen-health',
        author: { name: 'NeuroSystems', avatarUrl: 'https://picsum.photos/id/30/200/200', isVerified: true },
        aiSummary: "Podcast Episode: Synaptic Plasticity and Deep Rest Protocols",
        content: "Recorded neurobiology interview diving into slow-wave sleep architecture, glymphatic clearance, and metabolic optimization for cognitive resilience.",
        mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
        mediaType: 'video',
        thumbnailUrl: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?q=80&w=1280&h=720&auto=format&fit=crop',
        stats: { likes: 58900, views: 2750000, comments: 7600 },
        type: PostType.Feed,
        category: 'Health',
        domain: 'Health & Medicine',
        tags: ['podcast', 'interview', 'health'],
        createdAt: new Date(Date.now() - 3600000 * 76),
    },
    // ── ADDITIONAL FEEDS POSTS: READ MODE (Articles, long-form posts, text-based posts & discussions, written summaries & insights) ──
    {
        id: 'mock-feed-read-startup',
        author: { name: 'Founders Ledger', avatarUrl: 'https://picsum.photos/id/31/200/200', isVerified: true },
        aiSummary: "The Architecture of Capital-Efficient Software in 2026",
        content: "An in-depth article exploring unit economics, automated customer success workflows, and why modern founders prioritize cash-flow breakeven before Series A fundraising. As AI infrastructure commoditizes development cycles, the actual moat shifts toward proprietary distribution channels and verifiable domain workflows.",
        mediaUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1280&h=720&auto=format&fit=crop',
        mediaType: 'image',
        stats: { likes: 62000, views: 2900000, comments: 8100 },
        type: PostType.Feed,
        category: 'Start Up',
        domain: 'Startups & Entrepreneurship',
        createdAt: new Date(Date.now() - 3600000 * 14),
    },
    {
        id: 'mock-feed-read-science',
        author: { name: 'BioSystems Review', avatarUrl: 'https://picsum.photos/id/32/200/200', isVerified: true },
        aiSummary: "Breakthrough Summary: Cryo-EM Visualization of Protein Folding Kinetics",
        content: "Written synthesis of the latest peer-reviewed findings in structural biology. Dynamic conformational mapping at sub-angstrom resolution enables targeted small-molecule therapeutics that lock aberrant allosteric sites before pathological misfolding occurs.",
        mediaUrl: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?q=80&w=1280&h=720&auto=format&fit=crop',
        mediaType: 'image',
        stats: { likes: 71000, views: 3300000, comments: 9400 },
        type: PostType.Feed,
        category: 'Science',
        domain: 'Science',
        createdAt: new Date(Date.now() - 3600000 * 22),
    },
    {
        id: 'mock-feed-read-tech',
        author: { name: 'Kernel Dispatch', avatarUrl: 'https://picsum.photos/id/33/200/200', isVerified: true },
        aiSummary: "Long-Form Analysis: Memory Hierarchies in Post-Transformer Architectures",
        content: "A detailed technical post exploring State Space Models, linear attention mechanisms, and the trade-offs between context caching and associative retrieval overhead in distributed clusters. Why recurrent memory states may permanently replace quadratic attention for long-horizon agent planning.",
        stats: { likes: 84000, views: 4200000, comments: 12500 },
        type: PostType.Feed,
        category: 'Technology',
        domain: 'Technology',
        createdAt: new Date(Date.now() - 3600000 * 30),
    },
    {
        id: 'mock-feed-read-finance',
        author: { name: 'Macro Ledger', avatarUrl: 'https://picsum.photos/id/34/200/200', isVerified: true },
        aiSummary: "Written Analysis: Sovereign Debt Tokenization & Global Liquidity Cycles",
        content: "An analytical breakdown of yield spread compression, automated liquidity provision, and collateralization frameworks across decentralized clearinghouses. How institutional tokenized treasury bills are providing risk-free benchmark yields for cross-border settlements.",
        stats: { likes: 51000, views: 2100000, comments: 6700 },
        type: PostType.Feed,
        category: 'Finance',
        domain: 'Finance',
        createdAt: new Date(Date.now() - 3600000 * 44),
    },
    {
        id: 'mock-feed-read-health',
        author: { name: 'Cellular Digest', avatarUrl: 'https://picsum.photos/id/35/200/200', isVerified: true },
        aiSummary: "Clinical Insight: Mitochondrial Biomarkers in Long-Term Longevity Studies",
        content: "A comprehensive written summary of recent human trials investigating NAD+ precursors, caloric restriction mimetics, and metabolic elasticity in aging cohorts. What the data actually proves regarding cellular respiration rates in middle-aged populations.",
        stats: { likes: 49000, views: 2300000, comments: 7200 },
        type: PostType.Feed,
        category: 'Health',
        domain: 'Health & Medicine',
        createdAt: new Date(Date.now() - 3600000 * 58),
    },
    {
        id: 'mock-feed-read-design',
        author: { name: 'Spatial Forms', avatarUrl: 'https://picsum.photos/id/36/200/200', isVerified: true },
        aiSummary: "Design Essay: Optical Weight & Hierarchy on Multi-Resolution Canvases",
        content: "Examining typographic scaling, contrast constraints, and adaptive spatial grids for modern product designers working on dense, high-throughput interfaces. Why monochromatic high-contrast designs improve operator speed in mission-critical environments.",
        stats: { likes: 57000, views: 2600000, comments: 8800 },
        type: PostType.Feed,
        category: 'Design',
        domain: 'Design',
        createdAt: new Date(Date.now() - 3600000 * 70),
    }
];

const initialMockPolls: Poll[] = [
    {
        id: 'mock-poll-1',
        authorId: 'system-research',
        author: { name: 'Invox Research', avatarUrl: 'https://picsum.photos/id/10/200/200', isVerified: true },
        question: "Which LLM deployment architecture will dominate enterprise production by 2026?",
        description: "Evaluating balance between inference latency, data sovereignty constraints, and hardware CapEx.",
        options: [
            { id: 'opt-1', text: 'Hybrid Edge + Cloud Orchestration', voteCount: 142 },
            { id: 'opt-2', text: 'Fully Localized On-Premise SLMs', voteCount: 98 },
            { id: 'opt-3', text: 'Centralized Frontier APIs Only', voteCount: 46 },
            { id: 'opt-4', text: 'Decentralized P2P Inference Networks', voteCount: 29 },
        ],
        createdAt: new Date(Date.now() - 3600000 * 12),
        expiresAt: new Date(Date.now() + 3600000 * 24 * 6),
        duration: '7d',
        totalVotes: 315,
        status: 'active',
        category: 'Technology',
        domain: 'Technology',
        stats: { likes: 340, views: 12500, comments: 52 },
        type: PostType.Poll,
    },
    {
        id: 'mock-poll-2',
        authorId: 'system-startup',
        author: { name: 'Venture Metrics', avatarUrl: 'https://picsum.photos/id/24/200/200', isVerified: true },
        question: "For early-stage startups in 2026: Bootstrap to profitability or accelerate with VC debt?",
        description: "Given the current cost of compute and seed valuation environment.",
        options: [
            { id: 'opt-1', text: 'Bootstrap to positive unit economics', voteCount: 218 },
            { id: 'opt-2', text: 'Aggressive Venture Seed Round', voteCount: 84 },
            { id: 'opt-3', text: 'Venture Debt + Grant Capital', voteCount: 41 },
        ],
        createdAt: new Date(Date.now() - 3600000 * 40),
        expiresAt: new Date(Date.now() + 3600000 * 24 * 3),
        duration: '7d',
        totalVotes: 343,
        status: 'active',
        category: 'Start Up',
        domain: 'Startups & Entrepreneurship',
        stats: { likes: 412, views: 18900, comments: 76 },
        type: PostType.Poll,
    },
    {
        id: 'mock-poll-3',
        authorId: 'system-design',
        author: { name: 'Design Tokens Hub', avatarUrl: 'https://picsum.photos/id/25/200/200', isVerified: true },
        question: "Design systems in 2026: Token-driven automated sync vs Code-first headless components?",
        description: "Assessing workflow integration between product designers and frontend systems engineers.",
        options: [
            { id: 'opt-1', text: 'Token-driven automated Figma sync', voteCount: 165 },
            { id: 'opt-2', text: 'Code-first headless primitives', voteCount: 198 },
            { id: 'opt-3', text: 'AI-generated component variants', voteCount: 74 },
        ],
        createdAt: new Date(Date.now() - 3600000 * 55),
        expiresAt: new Date(Date.now() + 3600000 * 24 * 5),
        duration: '7d',
        totalVotes: 437,
        status: 'active',
        category: 'Design',
        domain: 'Design',
        stats: { likes: 289, views: 9800, comments: 41 },
        type: PostType.Poll,
    },
    {
        id: 'mock-poll-4',
        authorId: 'system-education',
        author: { name: 'Academic Signal', avatarUrl: 'https://picsum.photos/id/26/200/200', isVerified: true },
        question: "Primary growth lever for technical research platforms in 2026?",
        description: "Evaluating open reproducibility and community citation networks.",
        options: [
            { id: 'opt-1', text: 'Open-access peer reproduction datasets', voteCount: 312 },
            { id: 'opt-2', text: 'Interactive runnable benchmark papers', voteCount: 220 },
            { id: 'opt-3', text: 'Decentralized preprint governance', voteCount: 145 },
        ],
        createdAt: new Date(Date.now() - 3600000 * 70),
        expiresAt: new Date(Date.now() + 3600000 * 24 * 4),
        duration: '7d',
        totalVotes: 677,
        status: 'active',
        category: 'Education',
        domain: 'Education & Research',
        stats: { likes: 512, views: 15400, comments: 63 },
        type: PostType.Poll,
    },
    {
        id: 'mock-poll-5',
        authorId: 'system-finance',
        author: { name: 'Capital Matrix', avatarUrl: 'https://picsum.photos/id/27/200/200', isVerified: true },
        question: "Fintech treasury management: Multi-currency digital assets vs Centralized yield vaults?",
        description: "Evaluating corporate treasury diversification in modern high-interest regimes.",
        options: [
            { id: 'opt-1', text: 'Centralized Tier-1 yield vaults', voteCount: 280 },
            { id: 'opt-2', text: 'Multi-currency tokenized T-bills', voteCount: 195 },
            { id: 'opt-3', text: 'Autonomous algorithmic treasury hedging', voteCount: 110 },
        ],
        createdAt: new Date(Date.now() - 3600000 * 85),
        expiresAt: new Date(Date.now() + 3600000 * 24 * 6),
        duration: '7d',
        totalVotes: 585,
        status: 'active',
        category: 'Finance',
        domain: 'Finance',
        stats: { likes: 380, views: 11200, comments: 49 },
        type: PostType.Poll,
    },
    {
        id: 'mock-poll-6',
        authorId: 'system-science',
        author: { name: 'Science Frontiers', avatarUrl: 'https://picsum.photos/id/28/200/200', isVerified: true },
        question: "Which medium best communicates breakthrough scientific discoveries to practitioners?",
        description: "Assessing interdisciplinary comprehension and knowledge transfer.",
        options: [
            { id: 'opt-1', text: 'Interactive data models + runnable simulations', voteCount: 340 },
            { id: 'opt-2', text: 'Condensed visual video walkthroughs', voteCount: 185 },
            { id: 'opt-3', text: 'Structured narrative whitepaper threads', voteCount: 215 },
        ],
        createdAt: new Date(Date.now() - 3600000 * 95),
        expiresAt: new Date(Date.now() + 3600000 * 24 * 5),
        duration: '7d',
        totalVotes: 740,
        status: 'active',
        category: 'Science',
        domain: 'Science',
        stats: { likes: 490, views: 16800, comments: 58 },
        type: PostType.Poll,
    },
    {
        id: 'mock-poll-7',
        authorId: 'system-business',
        author: { name: 'Executive Operations', avatarUrl: 'https://picsum.photos/id/29/200/200', isVerified: true },
        question: "Enterprise operating model: Async-first distributed teams vs Synchronous campus hubs?",
        description: "Balancing velocity, institutional knowledge retention, and cross-functional focus.",
        options: [
            { id: 'opt-1', text: 'Async-first globally distributed', voteCount: 324 },
            { id: 'opt-2', text: 'Hybrid 3-day regional hubs', voteCount: 241 },
            { id: 'opt-3', text: 'Fully co-located headquarters', voteCount: 88 },
        ],
        createdAt: new Date(Date.now() - 3600000 * 105),
        expiresAt: new Date(Date.now() + 3600000 * 24 * 5),
        duration: '7d',
        totalVotes: 653,
        status: 'active',
        category: 'Business',
        domain: 'Business',
        stats: { likes: 375, views: 13200, comments: 44 },
        type: PostType.Poll,
    },
    {
        id: 'mock-poll-8',
        authorId: 'system-health',
        author: { name: 'BioMetrics Lab', avatarUrl: 'https://picsum.photos/id/30/200/200', isVerified: true },
        question: "Next leap in preventative medicine: Continuous multi-analyte monitors vs Epigenetic age clocks?",
        description: "Assessing clinical utility and accessible preventive wellness technology.",
        options: [
            { id: 'opt-1', text: 'Continuous multi-analyte wearable sensors', voteCount: 412 },
            { id: 'opt-2', text: 'Longitudinal epigenetic methylation testing', voteCount: 198 },
            { id: 'opt-3', text: 'AI-driven full-body MRI diagnostics', voteCount: 231 },
        ],
        createdAt: new Date(Date.now() - 3600000 * 115),
        expiresAt: new Date(Date.now() + 3600000 * 24 * 6),
        duration: '7d',
        totalVotes: 841,
        status: 'active',
        category: 'Health',
        domain: 'Health & Medicine',
        stats: { likes: 462, views: 17400, comments: 68 },
        type: PostType.Poll,
    },
    {
        id: 'mock-poll-9',
        authorId: 'system-arts',
        author: { name: 'Culture Nexus', avatarUrl: 'https://picsum.photos/id/31/200/200', isVerified: true },
        question: "Generative tools in cinematic and musical composition: Amplification or commoditization?",
        description: "Evaluating artistic authorship and creative expression in digital media.",
        options: [
            { id: 'opt-1', text: 'Empowering multiplier for solo creators', voteCount: 388 },
            { id: 'opt-2', text: 'Over-saturation of formulaic content', voteCount: 310 },
            { id: 'opt-3', text: 'New hybrid collaborative medium', voteCount: 245 },
        ],
        createdAt: new Date(Date.now() - 3600000 * 125),
        expiresAt: new Date(Date.now() + 3600000 * 24 * 4),
        duration: '7d',
        totalVotes: 943,
        status: 'active',
        category: 'Art',
        domain: 'Arts & Culture',
        stats: { likes: 528, views: 20100, comments: 85 },
        type: PostType.Poll,
    },
    {
        id: 'mock-poll-10',
        authorId: 'system-society',
        author: { name: 'Civic Futures', avatarUrl: 'https://picsum.photos/id/32/200/200', isVerified: true },
        question: "Digital commons in 2026: Open interoperable protocols vs Platform-governed safety enclaves?",
        description: "How public discourse and digital freedom of information should be structured.",
        options: [
            { id: 'opt-1', text: 'Open decentralized verifiable protocols', voteCount: 460 },
            { id: 'opt-2', text: 'Curated safety-moderated networks', voteCount: 184 },
            { id: 'opt-3', text: 'Community-governed sovereign DAOs', voteCount: 219 },
        ],
        createdAt: new Date(Date.now() - 3600000 * 135),
        expiresAt: new Date(Date.now() + 3600000 * 24 * 7),
        duration: '7d',
        totalVotes: 863,
        status: 'active',
        category: 'Society',
        domain: 'Society & Ideas',
        stats: { likes: 590, views: 22800, comments: 92 },
        type: PostType.Poll,
    }
];

const categoryFilters = ['All', 'Technology', 'Start Up', 'Sports', 'Art', 'Music', 'Science', 'Health', 'Gaming', 'Finance', 'Food', 'Travel'];
const discoverFilters = ['All', 'Threads', 'Queries', 'Polls'];

const exploreDomains = [
    { name: 'Technology', icon: CodeBracketIcon },
    { name: 'Science', icon: GlobeAltIcon },
    { name: 'Business', icon: BriefcaseIcon },
    { name: 'Startups & Entrepreneurship', icon: FireIcon },
    { name: 'Design', icon: PencilSquareIcon },
    { name: 'Arts & Culture', icon: SparklesIcon },
    { name: 'Health & Medicine', icon: ShieldCheckIcon },
    { name: 'Education & Research', icon: AcademicCapIcon },
    { name: 'Finance', icon: CurrencyDollarIcon },
    { name: 'Society & Ideas', icon: UsersIcon },
];

/**
 * Evaluates whether a post belongs to LISTEN mode:
 * Audio or video content intended for listening or watching:
 * - Podcasts and recorded interviews
 * - Audio recordings and tapes
 * - Video-based discussions and explainers
 * - Any post with an attached video or audio player
 */
export const isListenPost = (post: Post): boolean => {
    if (!post) return false;

    // 1. Explicit video or audio mediaType
    if (post.mediaType === 'video' || (post as any).mediaType === 'audio') {
        return true;
    }

    // 2. Video or audio media URL
    if (post.mediaUrl) {
        const url = post.mediaUrl.toLowerCase();
        if (/\.(mp4|webm|mov|m4v|ogg|ogv|mp3|wav|m4a|aac|flac)($|\?)/i.test(url)) {
            return true;
        }
        if (
            url.includes('youtube.com') ||
            url.includes('youtu.be') ||
            url.includes('vimeo.com') ||
            url.includes('soundcloud.com') ||
            url.includes('spotify.com') ||
            url.includes('podcasts.apple.com') ||
            url.includes('anchor.fm') ||
            url.includes('transistor.fm')
        ) {
            return true;
        }
    }

    // 3. Category, postType, or type indicating media-first listen/watch content
    const cat = (post.category || '').toLowerCase();
    const pType = (post.postType || '').toLowerCase();
    const typeStr = (typeof post.type === 'string' ? post.type : '').toLowerCase();
    const mediaKeywords = [
        'podcast', 'podcasts', 'interview', 'interviews', 'tape', 'tapes',
        'audio', 'recording', 'recordings', 'video', 'video explainer', 'listen'
    ];

    if (mediaKeywords.includes(cat) || mediaKeywords.includes(pType) || mediaKeywords.includes(typeStr)) {
        return true;
    }

    // 4. Tags
    if (Array.isArray(post.tags)) {
        if (post.tags.some(t => {
            const tl = t.toLowerCase();
            return mediaKeywords.includes(tl) || tl.includes('podcast') || tl.includes('interview') || tl.includes('audio') || tl.includes('video') || tl.includes('listen');
        })) {
            return true;
        }
    }

    // 5. Title or summary tags / indicators
    const title = (post.title || '').toLowerCase();
    const summary = (post.aiSummary || '').toLowerCase();
    const badges = ['[podcast]', '[audio]', '[interview]', '[tape]', '[recording]', '[video]', '// podcast', '// interview', '// audio', '// tape'];
    if (badges.some(b => title.includes(b) || summary.includes(b))) {
        return true;
    }

    return false;
};

const ExplorePage = () => {
    const { currentUser } = useAuth();
    const [firestorePosts, setFirestorePosts] = useState<Post[]>([]);
    const [firestorePolls, setFirestorePolls] = useState<Poll[]>([]);
    const [mockPolls, setMockPolls] = useState<Poll[]>(initialMockPolls);
    const [userPollVotes, setUserPollVotes] = useState<Record<string, string>>(() => {
        const initialVotes: Record<string, string> = {};
        try {
            if (typeof localStorage !== 'undefined') {
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith('poll_vote_')) {
                        const val = localStorage.getItem(key);
                        if (val) {
                            const parts = key.split('_');
                            const pollId = parts[parts.length - 1];
                            if (pollId && !initialVotes[pollId]) {
                                initialVotes[pollId] = val;
                            }
                        }
                    }
                }
            }
        } catch {}
        return initialVotes;
    });
    const [pollActivityError, setPollActivityError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Feeds');
    const [activeCategory, setActiveCategory] = useState('All');
    const [discoverFilter, setDiscoverFilter] = useState('All');
    const { domainSelections, setDomainSelection } = useFilters();
    const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
    const [savedPostIds, setSavedPostIds] = useState<Set<string>>(new Set());
    const [localSearch, setLocalSearch] = useState('');

    const [searchParams, setSearchParams] = ReactRouterDOM.useSearchParams();
    const domainParam = searchParams.get('domain') || '';
    const tabParam = searchParams.get('tab') || '';
    const filterParam = searchParams.get('filter') || '';

    const modeParam = searchParams.get('mode')?.toUpperCase();
    const [feedMode, setFeedMode] = useState<'ALL' | 'READ' | 'LISTEN'>(() => {
        if (searchParams.get('mode')?.toUpperCase() === 'LISTEN') return 'LISTEN';
        if (searchParams.get('mode')?.toUpperCase() === 'READ') return 'READ';
        return 'ALL';
    });

    // Synchronize mode state with URL parameter safely
    useEffect(() => {
        if (modeParam === 'LISTEN' && feedMode !== 'LISTEN') {
            setFeedMode('LISTEN');
        } else if (modeParam === 'READ' && feedMode !== 'READ') {
            setFeedMode('READ');
        } else if ((!modeParam || modeParam === 'ALL') && feedMode !== 'ALL') {
            setFeedMode('ALL');
        }
    }, [modeParam, feedMode]);

    const handleModeChange = useCallback((newMode: 'ALL' | 'READ' | 'LISTEN') => {
        setFeedMode(newMode);
        if (activeTab !== 'Feeds') {
            setActiveTab('Feeds');
        }
        const newParams = new URLSearchParams(searchParams);
        if (newMode === 'ALL') {
            newParams.delete('mode');
        } else {
            newParams.set('mode', newMode);
        }
        setSearchParams(newParams, { replace: true });
    }, [activeTab, searchParams, setSearchParams]);

    const outletContext = ReactRouterDOM.useOutletContext<{
        setRightSidebarVariant: (variant: string) => void;
        activityFilter: string | null;
        setActivityFilter: (filter: string | null) => void;
        refreshKey: number;
        discoverSearchTerm?: string;
        setDiscoverSearchTerm?: (term: string) => void;
    }>();

    const { 
        setRightSidebarVariant, 
        activityFilter, 
        setActivityFilter, 
        refreshKey,
        discoverSearchTerm,
        setDiscoverSearchTerm
    } = outletContext || {};

    const navigate = ReactRouterDOM.useNavigate();
    const [matchingUsers, setMatchingUsers] = useState<Array<{ uid: string; username: string; displayName?: string; photoURL?: string | null; headline?: string }>>([]);

    const activeSearch = (discoverSearchTerm !== undefined ? discoverSearchTerm : localSearch);

    const handleSearchChange = useCallback((val: string) => {
        setLocalSearch(val);
        setDiscoverSearchTerm?.(val);
    }, [setDiscoverSearchTerm]);

    // Live search for matching users by username
    useEffect(() => {
        let isCurrent = true;
        const cleanTerm = activeSearch.trim().replace(/^@/, '');
        if (cleanTerm.length >= 2) {
            searchUsersByUsername(cleanTerm, 6).then(users => {
                if (isCurrent) setMatchingUsers(users);
            }).catch(() => {
                if (isCurrent) setMatchingUsers([]);
            });
        } else {
            setMatchingUsers([]);
        }
        return () => { isCurrent = false; };
    }, [activeSearch]);

    // Synchronize domain filter with URL search params safely
    useEffect(() => {
        if (!domainParam) return;
        const domainsFromUrl = domainParam.split(',').map(s => s.trim()).filter(Boolean);
        const currentDomains = domainSelections.explore || [];
        const isSame = currentDomains.length === domainsFromUrl.length &&
            currentDomains.every((d, i) => d === domainsFromUrl[i]);
        if (!isSame && domainsFromUrl.length > 0) {
            setDomainSelection('explore', domainsFromUrl);
        }
    }, [domainParam, setDomainSelection, domainSelections.explore]);

    const activeDomains = useMemo(() => {
        return domainSelections.explore || [];
    }, [domainSelections.explore]);

    const handleDomainChange = useCallback((newDomains: string[]) => {
        setDomainSelection('explore', newDomains);
        const newParams = new URLSearchParams(searchParams);
        if (newDomains.length > 0) {
            newParams.set('domain', newDomains.join(','));
        } else {
            newParams.delete('domain');
        }
        setSearchParams(newParams, { replace: true });
    }, [searchParams, setSearchParams, setDomainSelection]);

    // Deep link query parameters handling safely
    useEffect(() => {
        if ((tabParam === 'Discover' || tabParam === 'Feeds') && tabParam !== activeTab) {
            setActiveTab(tabParam);
        }
        if (filterParam && discoverFilters.some(f => f.toLowerCase() === filterParam.toLowerCase())) {
            const matched = discoverFilters.find(f => f.toLowerCase() === filterParam.toLowerCase());
            if (matched && matched !== discoverFilter) {
                setDiscoverFilter(matched);
            }
        }
    }, [tabParam, filterParam, activeTab, discoverFilter]);

    // Load User interactions (likes and bookmarks)
    useEffect(() => {
        if (!currentUser?.uid) return;
        getUserLikedPostIds(currentUser.uid).then(setLikedPostIds).catch(console.warn);
        getUserSavedPostIds(currentUser.uid).then(setSavedPostIds).catch(console.warn);
    }, [currentUser?.uid]);

    // Real-time Firestore Feed Subscription
    useEffect(() => {
        setLoading(true);
        const unsubscribePosts = subscribeToFeed(
            { pageSize: 50 },
            (posts) => {
                setFirestorePosts(posts);
                setLoading(false);
            },
            (err) => {
                console.error('[EXPLORE_FEED_ERROR]', err);
                setLoading(false);
            }
        );

        const unsubscribePolls = subscribeToPolls(
            (polls) => {
                setFirestorePolls(polls);
            },
            (err) => {
                console.error('[EXPLORE_POLLS_ERROR]', err);
            }
        );

        return () => {
            unsubscribePosts();
            unsubscribePolls();
        };
    }, [refreshKey]);

    // Merge Firestore posts with baseline discovery items
    const combinedPosts = useMemo(() => {
        const seen = new Set<string>();
        const result: Post[] = [];
        for (const p of firestorePosts) {
            if (p && p.id && !seen.has(p.id)) {
                seen.add(p.id);
                result.push(p);
            }
        }
        for (const p of initialMockPosts) {
            if (p && p.id && !seen.has(p.id)) {
                seen.add(p.id);
                result.push(p);
            }
        }
        return result;
    }, [firestorePosts]);

    // Raw discovery and Firestore polls
    const rawPolls = useMemo(() => {
        const seen = new Set<string>();
        const result: Poll[] = [];
        for (const p of firestorePolls) {
            if (p && p.id && !seen.has(p.id)) {
                seen.add(p.id);
                result.push(p);
            }
        }
        for (const p of mockPolls) {
            if (p && p.id && !seen.has(p.id)) {
                seen.add(p.id);
                result.push(p);
            }
        }
        return result;
    }, [firestorePolls, mockPolls]);

    // Merge Firestore polls with baseline discovery polls and attach user votes
    const combinedPolls = useMemo(() => {
        return rawPolls.map(poll => {
            const votedOpt = poll.userVotedOptionId || userPollVotes[poll.id];
            return votedOpt ? { ...poll, userVotedOptionId: votedOpt } : poll;
        });
    }, [rawPolls, userPollVotes]);

    const refreshUserVotes = useCallback(async () => {
        if (!currentUser?.uid) return;
        try {
            setPollActivityError(null);
            const votes = await getUserVotedPolls(currentUser.uid, rawPolls);
            setUserPollVotes(prev => ({ ...prev, ...votes }));
        } catch (err: any) {
            console.warn('[LOAD_POLL_ACTIVITY_ERROR]', err);
            setPollActivityError(err?.message || 'Failed to load participated polls');
        }
    }, [currentUser?.uid, rawPolls]);

    useEffect(() => {
        refreshUserVotes();
    }, [refreshUserVotes]);

    useEffect(() => {
        if (activityFilter === 'polls' && currentUser?.uid) {
            refreshUserVotes();
        }
    }, [activityFilter, currentUser?.uid, refreshUserVotes]);

    const handleVoteChange = useCallback((pollId: string, optionId: string, updatedOptions: PollOption[], updatedTotalVotes: number) => {
        setUserPollVotes(prev => ({ ...prev, [pollId]: optionId }));
        setFirestorePolls(prev => prev.map(p => p.id === pollId ? { ...p, options: updatedOptions, totalVotes: updatedTotalVotes, userVotedOptionId: optionId } : p));
        setMockPolls(prev => prev.map(p => p.id === pollId ? { ...p, options: updatedOptions, totalVotes: updatedTotalVotes, userVotedOptionId: optionId } : p));
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && activityFilter) {
                setActivityFilter?.(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activityFilter, setActivityFilter]);

    useEffect(() => {
        if (setRightSidebarVariant) {
            if (activeTab === 'Feeds') {
                setRightSidebarVariant('feeds');
            } else if (activeTab === 'Discover') {
                setRightSidebarVariant('discover');
            } else {
                setRightSidebarVariant('default');
            }
        }
        
        if (setActivityFilter) {
            setActivityFilter(null);
        }

        return () => {
            if (setRightSidebarVariant) {
                setRightSidebarVariant('default');
            }
            if (setActivityFilter) {
                setActivityFilter(null);
            }
        };
    }, [activeTab, setRightSidebarVariant, setActivityFilter]);

    useEffect(() => {
        // Scroll to top whenever filters or tabs change
        if (!loading) {
             document.querySelector('main')?.scrollTo(0, 0);
        }
    }, [activeTab, activeCategory, discoverFilter, activityFilter, activeDomains, feedMode, loading]);

    // Step 1: Apply domain and search filters to combined posts and polls
    const domainFilteredPosts = useMemo(() => {
        return applyDomainAndSearchFilter(combinedPosts, activeDomains, activeSearch);
    }, [combinedPosts, activeDomains, activeSearch]);

    const domainFilteredPolls = useMemo(() => {
        return applyDomainAndSearchFilter(combinedPolls, activeDomains, activeSearch);
    }, [combinedPolls, activeDomains, activeSearch]);

    // Step 2: Calculate dynamic counts reflecting active domain filters
    const dynamicCounts = useMemo(() => {
        return calculateContentCounts(domainFilteredPosts, domainFilteredPolls);
    }, [domainFilteredPosts, domainFilteredPolls]);

    const handleToggleLike = useCallback(async (postId: string) => {
        if (!currentUser) return;
        try {
            const res = await toggleLikePost(postId);
            setLikedPostIds(prev => {
                const next = new Set(prev);
                if (res.liked) next.add(postId);
                else next.delete(postId);
                return next;
            });
        } catch (e) {
            console.error('Like action error:', e);
        }
    }, [currentUser]);

    const handleToggleBookmark = useCallback(async (postId: string) => {
        if (!currentUser) return;
        try {
            const res = await toggleBookmarkPost(postId);
            setSavedPostIds(prev => {
                const next = new Set(prev);
                if (res.saved) next.add(postId);
                else next.delete(postId);
                return next;
            });
        } catch (e) {
            console.error('Bookmark action error:', e);
        }
    }, [currentUser]);

    const filteredPosts = useMemo(() => {
        let result: (Post | Poll)[] = [];

        if (activeTab === 'Feeds') {
            result = domainFilteredPosts.filter(post => {
                if (activityFilter) {
                    if (activityFilter === 'threads') {
                        return post.type === PostType.Thread && post.userCommented;
                    }
                    if (activityFilter === 'queries') {
                        return post.type === PostType.Query && post.userSharedInsight;
                    }
                    return false;
                }
                const categoryMatch = activeCategory === 'All' || 
                    post.category?.toLowerCase() === activeCategory.toLowerCase();
                const typeMatch = post.type === PostType.Feed || !post.type;

                // Mode filtering: ALL vs READ vs LISTEN
                const isListen = isListenPost(post);
                const modeMatch = feedMode === 'ALL' ? true : feedMode === 'LISTEN' ? isListen : !isListen;

                return categoryMatch && typeMatch && modeMatch;
            });
        } else if (activeTab === 'Discover') {
            if (activityFilter) {
                if (activityFilter === 'threads') {
                    result = domainFilteredPosts.filter(p => p.type === PostType.Thread && p.userCommented);
                } else if (activityFilter === 'queries') {
                    result = domainFilteredPosts.filter(p => p.type === PostType.Query && p.userSharedInsight);
                } else if (activityFilter === 'polls') {
                    result = domainFilteredPolls.filter(poll => Boolean(poll.userVotedOptionId || userPollVotes[poll.id]));
                } else {
                    result = [];
                }
            } else {
                switch(discoverFilter) {
                    case 'All': {
                        const threadsAndQueries = domainFilteredPosts.filter(
                            post => post.type === PostType.Thread || post.type === PostType.Query
                        );
                        result = [...threadsAndQueries, ...domainFilteredPolls];
                        break;
                    }
                    case 'Threads':
                        result = domainFilteredPosts.filter(post => post.type === PostType.Thread);
                        break;
                    case 'Queries':
                        result = domainFilteredPosts.filter(post => post.type === PostType.Query);
                        break;
                    case 'Polls':
                        result = domainFilteredPolls;
                        break;
                    default:
                        result = [];
                        break;
                }
            }
        }

        // Strictly deduplicate result by ID to ensure unique items
        const seen = new Set<string>();
        const deduplicatedResult = result.filter(item => {
            if (!item || !item.id || seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
        });

        return [...deduplicatedResult].sort((a, b) => {
            const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
            const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
            return dateB - dateA;
        });
    }, [domainFilteredPosts, domainFilteredPolls, activityFilter, activeTab, activeCategory, discoverFilter, feedMode]);

    const allExploreDomains = useMemo(() => {
        const baseNames = new Set(exploreDomains.map(d => d.name.toLowerCase()));
        const customList: { name: string; icon: React.FC<{ className?: string }> }[] = [];
        const seenCustom = new Set<string>();

        for (const post of combinedPosts) {
            const d = post.domain?.trim();
            if (d && !baseNames.has(d.toLowerCase()) && !seenCustom.has(d.toLowerCase())) {
                seenCustom.add(d.toLowerCase());
                customList.push({ name: d, icon: GlobeAltIcon });
            }
        }
        for (const poll of combinedPolls) {
            const d = poll.domain?.trim();
            if (d && !baseNames.has(d.toLowerCase()) && !seenCustom.has(d.toLowerCase())) {
                seenCustom.add(d.toLowerCase());
                customList.push({ name: d, icon: GlobeAltIcon });
            }
        }
        for (const active of activeDomains) {
            const d = active.trim();
            if (d && !baseNames.has(d.toLowerCase()) && !seenCustom.has(d.toLowerCase())) {
                seenCustom.add(d.toLowerCase());
                customList.push({ name: d, icon: GlobeAltIcon });
            }
        }
        return [...exploreDomains, ...customList];
    }, [combinedPosts, combinedPolls, activeDomains]);

    return (
        <div className="py-2">
            {/* Conditional Header: Filters change based on active main tab */}
            {activeTab === 'Feeds' ? (
                <>
                    {/* Row 1: Category Buttons for Feeds */}
                    <div className="flex items-center space-x-1.5 overflow-x-auto pb-3 mb-3 no-scrollbar">
                        {categoryFilters.map(category => (
                            <button
                                key={category}
                                onClick={() => setActiveCategory(category)}
                                className={`px-3 py-1.5 rounded-none font-mono text-xs uppercase tracking-wider whitespace-nowrap transition-all duration-150 border ${
                                    activeCategory === category
                                        ? 'bg-white text-black border-white font-bold'
                                        : 'bg-[#0c0c0e] text-zinc-400 border-zinc-800/90 hover:border-zinc-700 hover:text-white'
                                }`}
                            >
                                {category}
                            </button>
                        ))}
                    </div>
                    {/* Row 2: Domain Dropdown */}
                    <DomainFilter 
                        domains={allExploreDomains}
                        selectedDomains={activeDomains}
                        onSelectionChange={handleDomainChange}
                        mode={feedMode}
                        onModeChange={handleModeChange}
                    />
                </>
            ) : (
                <>
                    {/* Row 1: Domain Dropdown for Discover */}
                    <DomainFilter 
                        domains={allExploreDomains}
                        selectedDomains={activeDomains}
                        onSelectionChange={handleDomainChange}
                        mode={feedMode}
                        onModeChange={handleModeChange}
                    />
                    {/* Row 2: Sub-filters for Discover */}
                    <div className="flex space-x-1 border border-zinc-800 bg-[#0c0c0e] p-1 mb-3">
                        {discoverFilters.map(filter => (
                            <button 
                                key={filter}
                                onClick={() => setDiscoverFilter(filter)}
                                className={`flex-1 py-1.5 rounded-none font-mono text-xs uppercase tracking-wider transition-all duration-150 flex items-center justify-center gap-1.5 ${
                                    discoverFilter === filter 
                                        ? 'bg-zinc-800 text-white font-bold border border-zinc-700' 
                                        : 'text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent'
                                }`}
                            >
                                <span>{filter}</span>
                            </button>
                        ))}
                    </div>
                </>
            )}

            {/* In-page Keyword Search Input (Bi-directionally synced with right sidebar & mobile) */}
            <div className="relative mb-4">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                <input
                    type="search"
                    placeholder="SEARCH_CONTENT_BY_KEYWORD..."
                    value={activeSearch}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="w-full bg-[#0c0c0e] border border-zinc-800 px-3.5 py-2 pl-9 pr-9 text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
                />
                {activeSearch && (
                    <button
                        type="button"
                        onClick={() => handleSearchChange('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                        aria-label="Clear search"
                    >
                        <XMarkIcon className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            {/* Matching Users from exact or prefix username search */}
            {matchingUsers.length > 0 && (
                <div className="mb-5 p-3.5 bg-[#0c0c0e] border border-zinc-800 font-mono">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest block font-bold">
                            // USERS_FOUND ({matchingUsers.length})
                        </span>
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">BY USERNAME</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {matchingUsers.map(user => (
                            <div
                                key={user.uid}
                                onClick={() => navigate(`/profile/${user.username}`)}
                                className="p-2.5 bg-black/60 border border-zinc-800 hover:border-zinc-600 transition-colors cursor-pointer flex items-center justify-between gap-3 group"
                            >
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-8 h-8 bg-zinc-900 border border-zinc-700 flex items-center justify-center shrink-0">
                                        {user.photoURL ? (
                                            <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-white text-xs font-bold">{user.displayName?.charAt(0) || 'U'}</span>
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-white truncate group-hover:text-zinc-200">{user.displayName}</p>
                                        <p className="text-[11px] text-zinc-400 font-mono truncate">@{user.username}</p>
                                    </div>
                                </div>
                                <span className="text-[10px] px-2 py-0.5 border border-zinc-700 bg-zinc-900 text-zinc-300 uppercase tracking-wider group-hover:border-zinc-500 group-hover:text-white shrink-0">
                                    PROFILE ↗
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Main Tabs: Feeds/Discover */}
            <div className="flex border-b border-zinc-800 mb-5">
                <button 
                    onClick={() => setActiveTab('Feeds')} 
                    className={`w-1/2 text-center py-2.5 text-xs font-mono uppercase tracking-widest transition-all duration-150 flex items-center justify-center gap-2 ${
                        activeTab === 'Feeds' 
                            ? 'border-b-2 border-white text-white font-bold bg-zinc-900/20' 
                            : 'text-zinc-500 hover:text-zinc-300 border-b-2 border-transparent'
                    }`}
                >
                    <span className="w-1.5 h-1.5 bg-white opacity-0 transition-opacity" style={{ opacity: activeTab === 'Feeds' ? 1 : 0 }}></span>
                    <span>// Feeds</span>
                </button>
                <button 
                    onClick={() => setActiveTab('Discover')}
                    className={`w-1/2 text-center py-2.5 text-xs font-mono uppercase tracking-widest transition-all duration-150 flex items-center justify-center gap-2 ${
                        activeTab === 'Discover' 
                            ? 'border-b-2 border-white text-white font-bold bg-zinc-900/20' 
                            : 'text-zinc-500 hover:text-zinc-300 border-b-2 border-transparent'
                    }`}
                >
                    <span className="w-1.5 h-1.5 bg-white opacity-0 transition-opacity" style={{ opacity: activeTab === 'Discover' ? 1 : 0 }}></span>
                    <span>// Discover</span>
                </button>
            </div>

            {activityFilter && (
                <div className="bg-[#0c0c0e] p-3 border border-zinc-800 mb-4 flex items-center justify-between">
                    <p className="font-mono text-xs text-zinc-300">
                        <span className="text-zinc-500">// ACTIVE_FILTER: </span>
                        {`Showing ${
                            activityFilter === 'threads' 
                                ? "threads you've commented on" 
                                : activityFilter === 'queries' 
                                    ? "queries you've shared insights on" 
                                    : "polls you've participated in"
                        }`}
                    </p>
                    <button 
                        onClick={() => setActivityFilter?.(null)} 
                        className="text-[10px] font-mono text-zinc-400 hover:text-white uppercase tracking-wider px-2 py-0.5 border border-zinc-800 hover:border-zinc-600"
                    >
                        Clear [ESC]
                    </button>
                </div>
            )}

            {pollActivityError && activityFilter === 'polls' && (
                <div className="bg-[#0c0c0e] border border-red-900/60 p-4 mb-4 font-mono">
                    <div className="flex items-center justify-between">
                        <span className="text-red-400 text-xs font-bold uppercase tracking-wider">// ERROR: FAILED_TO_LOAD_POLL_ACTIVITY</span>
                        <button 
                            onClick={refreshUserVotes} 
                            className="text-xs uppercase text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-600 px-2 py-0.5"
                        >
                            Retry
                        </button>
                    </div>
                    <p className="text-xs text-zinc-400 mt-2 font-mono">{pollActivityError}</p>
                </div>
            )}

            <div className="space-y-4">
                {loading ? (
                    <>
                        <FeedCardSkeleton />
                        <FeedCardSkeleton />
                        <FeedCardSkeleton />
                    </>
                ) : filteredPosts.length > 0 ? (
                    filteredPosts.map(post => {
                        const isLiked = likedPostIds.has(post.id);
                        const isSaved = savedPostIds.has(post.id);
                        const itemType = (post as any).type === PostType.Poll ? 'poll' : (post.type || 'post');
                        const uniqueKey = `${itemType}-${post.id}`;

                        if ((post as any).type === PostType.Poll) {
                            return (
                                <React.Fragment key={uniqueKey}>
                                    <ErrorBoundary>
                                        <PollCard 
                                            poll={post as any as Poll} 
                                            userVote={(post as any).userVotedOptionId || userPollVotes[post.id]}
                                            isMySpaceContext={false}
                                            onDelete={(pollId) => {
                                                setFirestorePolls(prev => prev.filter(p => p.id !== pollId));
                                            }}
                                            onVoteChange={handleVoteChange}
                                        />
                                    </ErrorBoundary>
                                </React.Fragment>
                            );
                        }
                        if (post.type === PostType.Query) {
                            return (
                                <React.Fragment key={uniqueKey}>
                                    <ErrorBoundary>
                                        <QueryCard post={post} isMySpaceContext={false} />
                                    </ErrorBoundary>
                                </React.Fragment>
                            );
                        }
                        if (post.type === PostType.Thread) {
                            return (
                                <React.Fragment key={uniqueKey}>
                                    <ErrorBoundary>
                                        <ThreadCard post={post} isMySpaceContext={false} />
                                    </ErrorBoundary>
                                </React.Fragment>
                            );
                        }
                        return (
                            <React.Fragment key={uniqueKey}>
                                <ErrorBoundary>
                                    <FeedCard 
                                        post={post} 
                                        isMySpaceContext={false}
                                    />
                                </ErrorBoundary>
                            </React.Fragment>
                        );
                    })
                ) : activityFilter === 'polls' ? (
                    <div className="text-center py-16 border border-dashed border-zinc-800 bg-[#0c0c0e] p-8 font-mono space-y-3">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest block">// POLL_ACTIVITY</span>
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                            NO POLL ACTIVITY YET
                        </h3>
                        <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
                            Vote in a poll to see it here.
                        </p>
                        <div className="pt-2 flex items-center justify-center">
                            <button
                                type="button"
                                onClick={() => {
                                    setActivityFilter?.(null);
                                    setActiveTab('Discover');
                                    setDiscoverFilter('Polls');
                                }}
                                className="px-3 py-1.5 bg-black hover:bg-zinc-900 text-xs text-white border border-zinc-700 hover:border-zinc-500 transition-colors uppercase tracking-wider font-mono"
                            >
                                Explore Polls &gt;&gt;
                            </button>
                        </div>
                    </div>
                ) : activityFilter === 'threads' ? (
                    <div className="text-center py-16 border border-dashed border-zinc-800 bg-[#0c0c0e] p-8 font-mono space-y-3">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest block">// THREAD_ACTIVITY</span>
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                            NO THREAD ACTIVITY YET
                        </h3>
                        <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
                            Comment on a thread to see it here.
                        </p>
                    </div>
                ) : activityFilter === 'queries' ? (
                    <div className="text-center py-16 border border-dashed border-zinc-800 bg-[#0c0c0e] p-8 font-mono space-y-3">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest block">// QUERY_ACTIVITY</span>
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                            NO QUERY ACTIVITY YET
                        </h3>
                        <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
                            Share insights on a query to see it here.
                        </p>
                    </div>
                ) : (
                    <div className="text-center py-16 border border-dashed border-zinc-800 bg-[#0c0c0e] p-8 font-mono space-y-3">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest block">
                            {activeTab === 'Feeds' && feedMode !== 'ALL' ? `// NO_${feedMode}_RESULTS` : '// NO_RESULTS'}
                        </span>
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                            {activeTab === 'Feeds' ? (
                                activeSearch 
                                    ? `NO ${feedMode !== 'ALL' ? `${feedMode} ` : ''}TRANSMISSIONS MATCHING "${activeSearch.toUpperCase()}"`
                                    : activeDomains.length > 0 
                                        ? `NO ${feedMode !== 'ALL' ? `${feedMode} ` : ''}TRANSMISSIONS FOUND FOR ${activeDomains.length === 1 ? `"${activeDomains[0].toUpperCase()}"` : `${activeDomains.length} SELECTED DOMAINS`}`
                                        : activeCategory !== 'All'
                                            ? `NO ${feedMode !== 'ALL' ? `${feedMode} ` : ''}TRANSMISSIONS IN "${activeCategory.toUpperCase()}"`
                                            : `NO ${feedMode !== 'ALL' ? `${feedMode} ` : ''}TRANSMISSIONS AVAILABLE FOR THIS FILTER`
                            ) : (
                                activeDomains.length > 0 
                                    ? `NO TRANSMISSIONS FOUND FOR ${activeDomains.length === 1 ? `"${activeDomains[0].toUpperCase()}"` : `${activeDomains.length} SELECTED DOMAINS`}`
                                    : activeSearch 
                                        ? `NO TRANSMISSIONS MATCHING "${activeSearch.toUpperCase()}"`
                                        : 'NO RECORDS FOUND FOR THIS FILTER'
                            )}
                        </h3>
                        <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
                            {activeTab === 'Feeds' ? (
                                feedMode === 'LISTEN'
                                    ? 'No audio, podcast, or video content found matching this filter. Switch to ALL or READ mode, or reset filters to view written transmissions.'
                                    : feedMode === 'READ'
                                        ? 'No written articles, summaries, or discussions found matching this filter. Switch to ALL or LISTEN mode, or reset filters to explore media transmissions.'
                                        : 'No transmissions found for this filter. Clear search or domain filters to explore more content.'
                            ) : (
                                activeDomains.length > 0 
                                    ? 'No transmissions found for this domain selection. Clear the filter to explore everything.'
                                    : 'No matching transmissions found. Adjust your search or filters to see content.'
                            )}
                        </p>
                        <div className="pt-2 flex items-center justify-center gap-2 flex-wrap">
                            {activeTab === 'Feeds' && feedMode !== 'ALL' && (
                                <button
                                    type="button"
                                    onClick={() => handleModeChange('ALL')}
                                    className="px-3 py-1.5 bg-white text-black font-bold text-xs uppercase tracking-wider font-mono hover:bg-zinc-200 transition-colors"
                                >
                                    Switch to ALL Mode
                                </button>
                            )}
                            {activeTab === 'Feeds' && activeCategory !== 'All' && (
                                <button
                                    type="button"
                                    onClick={() => setActiveCategory('All')}
                                    className="px-3 py-1.5 bg-black hover:bg-zinc-900 text-xs text-white border border-zinc-700 hover:border-zinc-500 transition-colors uppercase tracking-wider font-mono"
                                >
                                    All Categories
                                </button>
                            )}
                            {activeDomains.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => handleDomainChange([])}
                                    className="px-3 py-1.5 bg-black hover:bg-zinc-900 text-xs text-white border border-zinc-700 hover:border-zinc-500 transition-colors uppercase tracking-wider font-mono"
                                >
                                    Clear Domain Filter
                                </button>
                            )}
                            {activeSearch && (
                                <button
                                    type="button"
                                    onClick={() => handleSearchChange('')}
                                    className="px-3 py-1.5 bg-black hover:bg-zinc-900 text-xs text-zinc-300 hover:text-white border border-zinc-700 hover:border-zinc-500 transition-colors uppercase tracking-wider font-mono"
                                >
                                    Clear Search
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ExplorePage;
