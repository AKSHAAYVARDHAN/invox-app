import type { StreamLoop } from '../types';

export const INITIAL_MOCK_LOOPS: StreamLoop[] = [
    {
        id: 'loop-mock-zap-1',
        authorId: 'author-kaelen',
        author: {
            name: 'Kaelen Chen',
            username: 'kaelenchen',
            avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&h=200&auto=format&fit=crop',
            isVerified: true,
        },
        category: 'Zaps',
        headline: 'Local LLM Inference on Embedded RISC-V Silicon',
        title: 'Local LLM Inference on Embedded RISC-V Silicon',
        description: 'Achieved 18 tok/sec quantized 4-bit Llama-3.2 running on edge TPU accelerators with under 4W draw. Open-source firmware and benchmarks released.',
        content: 'Achieved 18 tok/sec quantized 4-bit Llama-3.2 running on edge TPU accelerators with under 4W draw. Open-source firmware and benchmarks released.',
        externalUrl: 'https://github.com/kaelenchen/riscv-llm-edge',
        imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=800&auto=format&fit=crop',
        mediaUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=800&auto=format&fit=crop',
        mediaType: 'image',
        stats: { likes: 142, views: 3200, comments: 19, shares: 34, saves: 45, strikes: 48 },
        likes: 142,
        views: 3200,
        comments: 19,
        strikes: 48,
        createdAt: new Date(Date.now() - 35 * 60 * 1000), // 35m ago
    },
    {
        id: 'loop-mock-thought-1',
        authorId: 'author-elena',
        author: {
            name: 'Elena Vance',
            username: 'elenavance',
            avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=200&h=200&auto=format&fit=crop',
            isVerified: true,
        },
        category: 'Thoughts',
        headline: 'The Architecture of Capital-Efficient Software in 2026',
        title: 'The Architecture of Capital-Efficient Software in 2026',
        description: 'The pendulum is swinging back hard. Teams spending 60% of their sprints debugging distributed tracing and network serialization issues are discovering that modular monoliths deploy faster, run 4x cheaper, and fail predictably. Complexity belongs inside domain boundaries, not across network hops.',
        content: 'The pendulum is swinging back hard. Teams spending 60% of their sprints debugging distributed tracing and network serialization issues are discovering that modular monoliths deploy faster, run 4x cheaper, and fail predictably. Complexity belongs inside domain boundaries, not across network hops.',
        imageUrl: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=800&auto=format&fit=crop',
        mediaUrl: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=800&auto=format&fit=crop',
        mediaType: 'image',
        stats: { likes: 289, views: 5600, comments: 45, shares: 62, saves: 89, strikes: 84 },
        likes: 289,
        views: 5600,
        comments: 45,
        strikes: 84,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h ago
    },
    {
        id: 'loop-mock-music-1',
        authorId: 'author-marcus',
        author: {
            name: 'Marcus Thorne',
            username: 'mthorne',
            avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=200&h=200&auto=format&fit=crop',
            isVerified: false,
        },
        category: 'Music',
        headline: 'Midnight Protocol // 132 BPM Minimal Wave',
        title: 'Midnight Protocol // 132 BPM Minimal Wave',
        description: 'Recorded live straight from the analog rack through vintage tape saturation. Cold basslines, crisp 808 rimshots, and drifting Juno-106 chorus pads.',
        content: 'Recorded live straight from the analog rack through vintage tape saturation. Cold basslines, crisp 808 rimshots, and drifting Juno-106 chorus pads.',
        musicMeta: {
            trackTitle: 'Subsurface Echoes (Live Tape Cut)',
            artist: 'Marcus Thorne ft. Vector 7',
            streamUrl: 'https://soundcloud.com',
        },
        externalUrl: 'https://soundcloud.com',
        imageUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=800&auto=format&fit=crop',
        mediaUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=800&auto=format&fit=crop',
        mediaType: 'image',
        stats: { likes: 310, views: 4800, comments: 38, shares: 41, saves: 98, strikes: 92 },
        likes: 310,
        views: 4800,
        comments: 38,
        strikes: 92,
        createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5h ago
    },
    {
        id: 'loop-mock-mood-1',
        authorId: 'author-sora',
        author: {
            name: 'Sora Takahashi',
            username: 'sorat',
            avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&h=200&auto=format&fit=crop',
            isVerified: true,
        },
        category: 'Mood',
        headline: 'Rain Over Shinjuku Neon Grid',
        title: 'Rain Over Shinjuku Neon Grid',
        description: 'Midnight drizzle, reflection off wet asphalt, terminal font glow at 3 AM. Deep focus flow state unlocked.',
        content: 'Midnight drizzle, reflection off wet asphalt, terminal font glow at 3 AM. Deep focus flow state unlocked.',
        imageUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=800&auto=format&fit=crop',
        mediaUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=800&auto=format&fit=crop',
        mediaType: 'image',
        stats: { likes: 520, views: 7900, comments: 62, shares: 73, saves: 140, strikes: 130 },
        likes: 520,
        views: 7900,
        comments: 62,
        strikes: 130,
        createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8h ago
    },
];

export const getFilteredMockLoops = (categoryFilter?: string): StreamLoop[] => {
    if (!categoryFilter || categoryFilter.toLowerCase() === 'all') {
        return INITIAL_MOCK_LOOPS;
    }
    const filterLower = categoryFilter.toLowerCase();
    return INITIAL_MOCK_LOOPS.filter(loop => {
        const cat = loop.category.toLowerCase();
        if (filterLower === 'thoughts' || filterLower === 'thought') {
            return cat === 'thoughts' || cat === 'thought';
        }
        return cat === filterLower;
    });
};
