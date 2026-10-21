import type { StreamMoment } from '../types';

/**
 * Storage key to toggle development/demo moments on or off.
 * Can be controlled programmatically or via the UI toggle button.
 */
export const MOMENTS_DEMO_STORAGE_KEY = 'invox_moments_demo_mode';

/**
 * Checks whether Moments demo mode is currently enabled.
 * Default is true in development/review environments to allow design testing,
 * and can be toggled off at any time.
 */
export const isMomentsDemoModeEnabled = (): boolean => {
    try {
        const stored = localStorage.getItem(MOMENTS_DEMO_STORAGE_KEY);
        if (stored !== null) {
            return stored === 'true';
        }
        // If an explicit environment flag is provided, respect it
        if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_MOMENTS_DEMO_MODE !== undefined) {
            return import.meta.env.VITE_MOMENTS_DEMO_MODE === 'true';
        }
        // Default to true for previewing and reviewing the UI
        return true;
    } catch {
        return true;
    }
};

/**
 * Enables or disables Moments demo mode.
 */
export const setMomentsDemoMode = (enabled: boolean): void => {
    try {
        localStorage.setItem(MOMENTS_DEMO_STORAGE_KEY, enabled ? 'true' : 'false');
        window.dispatchEvent(new CustomEvent('invox_moments_demo_changed', { detail: { enabled } }));
    } catch (e) {
        console.warn('[DEMO_MODE_STORAGE_WARN]', e);
    }
};

/**
 * Toggles Moments demo mode and returns the new state.
 */
export const toggleMomentsDemoMode = (): boolean => {
    const nextState = !isMomentsDemoModeEnabled();
    setMomentsDemoMode(nextState);
    return nextState;
};

/**
 * High-quality, varied realistic mock moments for testing and reviewing
 * Hub -> Stream -> Moments across All, Stills, Tapes, and Knacks categories.
 * 
 * NOTE: These mock items are purely in-memory and NEVER inserted into Firestore.
 */
export const MOCK_MOMENTS: StreamMoment[] = [
    // 1. Stills #1: Multi-image Architectural brutalism study (Carousel test)
    {
        id: 'demo-moment-still-1',
        authorId: 'demo-user-elena',
        author: {
            name: 'Elena Rostova',
            avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=250&auto=format&fit=crop',
            avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=250&auto=format&fit=crop',
            handle: '@erostova',
            username: 'erostova',
            isVerified: true,
            uid: 'demo-user-elena',
        },
        category: 'Stills',
        domain: 'Architecture',
        aiSummary: 'Brutalist concrete geometry intersecting morning light in Berlin.',
        caption: 'Brutalist angles and monolithic shadows at the Berlin Kulturforum. The contrast between raw concrete textures and clean geometric lines is unmatched under early morning diffusion. Slide 2 and 3 capture the internal light well transitions.',
        mediaUrls: [
            'https://images.unsplash.com/photo-1513694203232-719a280e022f?q=80&w=1200&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=1200&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=1200&auto=format&fit=crop',
        ],
        mediaUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?q=80&w=1200&auto=format&fit=crop',
        mediaType: 'image',
        type: 'image',
        likes: 1420,
        views: 18900,
        comments: 84,
        userLiked: false,
        userSaved: false,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    },

    // 2. Still #2: Mountain Expedition / Alpine Photography
    {
        id: 'demo-moment-still-2',
        authorId: 'demo-user-marcus',
        author: {
            name: 'Marcus Vance',
            avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=250&auto=format&fit=crop',
            avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=250&auto=format&fit=crop',
            handle: '@marcusv',
            username: 'marcusv',
            isVerified: false,
            uid: 'demo-user-marcus',
        },
        category: 'Stills',
        domain: 'Photography',
        aiSummary: 'Alpine summit ridge illuminated during blue hour in the Dolomites.',
        caption: 'Sub-zero ascent along the Tre Cime ridge before dawn. Wind speeds reached 45 knots, but watching the blue hour dissolve into morning alpine glow made every kilometer of frozen scree worth it.',
        mediaUrls: [
            'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1200&auto=format&fit=crop',
        ],
        mediaUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1200&auto=format&fit=crop',
        mediaType: 'image',
        type: 'image',
        likes: 980,
        views: 14200,
        comments: 46,
        userLiked: false,
        userSaved: false,
        createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
    },

    // 3. Tape #1: High-Speed Cinematic Nightscape (Video)
    {
        id: 'demo-moment-tape-1',
        authorId: 'demo-user-kaito',
        author: {
            name: 'Kaito Tanaka',
            avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=250&auto=format&fit=crop',
            avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=250&auto=format&fit=crop',
            handle: '@kaitonoir',
            username: 'kaitonoir',
            isVerified: true,
            uid: 'demo-user-kaito',
        },
        category: 'Tapes',
        domain: 'Cinematography',
        aiSummary: 'Rain-soaked high-speed motion sequence captured in Shinjuku alleys.',
        caption: 'Late night camera rig test in Kabukicho under torrential downpour. Captured at 60fps with anamorphic lens simulation. The way neon reflections warp across wet asphalt provides incredible cinematic depth.',
        mediaUrls: [
            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        ],
        mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1200&auto=format&fit=crop',
        mediaType: 'video',
        type: 'video',
        likes: 3210,
        views: 48700,
        comments: 192,
        userLiked: false,
        userSaved: false,
        createdAt: new Date(Date.now() - 11 * 60 * 60 * 1000), // 11 hours ago
    },

    // 4. Tape #2: Fluid VFX & Particle Dynamics (Video)
    {
        id: 'demo-moment-tape-2',
        authorId: 'demo-user-aria',
        author: {
            name: 'Aria Chen',
            avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=250&auto=format&fit=crop',
            avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=250&auto=format&fit=crop',
            handle: '@ariachen_fx',
            username: 'ariachen_fx',
            isVerified: true,
            uid: 'demo-user-aria',
        },
        category: 'Tapes',
        domain: 'VFX & Motion',
        aiSummary: 'Real-time particle dynamics simulation testing fluid collision mesh.',
        caption: 'Procedural fluid dynamics study running at 120fps compute shader passes. Tuning surface tension coefficients and refraction indices for organic energy dissipation.',
        mediaUrls: [
            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
        ],
        mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
        thumbnailUrl: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?q=80&w=1200&auto=format&fit=crop',
        mediaType: 'video',
        type: 'video',
        likes: 2450,
        views: 31500,
        comments: 138,
        userLiked: false,
        userSaved: false,
        createdAt: new Date(Date.now() - 18 * 60 * 60 * 1000), // 18 hours ago
    },

    // 5. Knack #1: Modular Synthesizer Live Session (Video / Talent Showcase)
    {
        id: 'demo-moment-knack-1',
        authorId: 'demo-user-soren',
        author: {
            name: 'Soren Lindqvist',
            avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=250&auto=format&fit=crop',
            avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=250&auto=format&fit=crop',
            handle: '@sorensound',
            username: 'sorensound',
            isVerified: false,
            uid: 'demo-user-soren',
        },
        category: 'Knacks',
        domain: 'Sound Design',
        aiSummary: 'Generative ambient patch demonstration utilizing Eurorack oscillators and granular delay.',
        caption: 'Building a semi-generative clock-divided drone on the Eurorack system. Modulating wavefolded sine waves through stereo analog filters to create breathing harmonic overtones without digital post-processing.',
        mediaUrls: [
            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
        ],
        mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
        thumbnailUrl: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=1200&auto=format&fit=crop',
        mediaType: 'video',
        type: 'video',
        likes: 1890,
        views: 26400,
        comments: 115,
        userLiked: false,
        userSaved: false,
        createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000), // 1 day ago
    },

    // 6. Knack #2: Multi-step 3D Illustration Breakdown (Carousel test)
    {
        id: 'demo-moment-knack-2',
        authorId: 'demo-user-zainab',
        author: {
            name: 'Zainab Al-Mansoor',
            avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=250&auto=format&fit=crop',
            avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=250&auto=format&fit=crop',
            handle: '@zainab_art',
            username: 'zainab_art',
            isVerified: true,
            uid: 'demo-user-zainab',
        },
        category: 'Knacks',
        domain: 'Digital Art',
        aiSummary: 'Three-stage visual breakdown of an isometric sci-fi habitat illustration.',
        caption: 'Step-by-step evolution of the Neo-Babylon habitat dome piece. Swipe through to view: 1) Final atmospheric composite, 2) Base perspective geometry block-in, and 3) Color and lighting study palette.',
        mediaUrls: [
            'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?q=80&w=1200&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=1200&auto=format&fit=crop',
        ],
        mediaUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200&auto=format&fit=crop',
        mediaType: 'image',
        type: 'image',
        likes: 2740,
        views: 39100,
        comments: 164,
        userLiked: false,
        userSaved: false,
        createdAt: new Date(Date.now() - 34 * 60 * 60 * 1000), // 1 day ago
    },

    // 7. Still #3: Dual-photo Street Photography Study (Carousel test)
    {
        id: 'demo-moment-still-3',
        authorId: 'demo-user-leo',
        author: {
            name: 'Leo Mercer',
            avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=250&auto=format&fit=crop',
            avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=250&auto=format&fit=crop',
            handle: '@leomercer',
            username: 'leomercer',
            isVerified: false,
            uid: 'demo-user-leo',
        },
        category: 'Stills',
        domain: 'Street Photography',
        aiSummary: 'Dual-frame monochrome and neon contrast in Kyoto Gion district.',
        caption: 'Quiet reflections through Gion at 2 AM. Shot on 35mm f/1.4 prime lens. Dual slide study comparing dusk ambient temperature against artificial lantern diffusion.',
        mediaUrls: [
            'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=1200&auto=format&fit=crop',
        ],
        mediaUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200&auto=format&fit=crop',
        mediaType: 'image',
        type: 'image',
        likes: 1650,
        views: 22800,
        comments: 77,
        userLiked: false,
        userSaved: false,
        createdAt: new Date(Date.now() - 42 * 60 * 60 * 1000), // 2 days ago
    },

    // 8. Knack #3: Ceramic Artisan Wheel Demonstration
    {
        id: 'demo-moment-knack-3',
        authorId: 'demo-user-mira',
        author: {
            name: 'Mira Patel',
            avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=250&auto=format&fit=crop',
            avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=250&auto=format&fit=crop',
            handle: '@miraceramics',
            username: 'miraceramics',
            isVerified: true,
            uid: 'demo-user-mira',
        },
        category: 'Knacks',
        domain: 'Ceramics & Craft',
        aiSummary: 'Stoneware clay centering and vessel elevation demonstration on wheel.',
        caption: 'Pulling the walls of a 4kg stoneware vase. Centering clay requires equal pressure through the palm and core before starting the upward draw. Second firing with wood-ash reduction glaze scheduled for tomorrow.',
        mediaUrls: [
            'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?q=80&w=1200&auto=format&fit=crop',
        ],
        mediaUrl: 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?q=80&w=1200&auto=format&fit=crop',
        mediaType: 'image',
        type: 'image',
        likes: 1120,
        views: 17300,
        comments: 59,
        userLiked: false,
        userSaved: false,
        createdAt: new Date(Date.now() - 50 * 60 * 60 * 1000), // 2 days ago
    },
];

/**
 * Returns filtered mock moments for the given category filter.
 */
export const getFilteredMockMoments = (categoryFilter?: string): StreamMoment[] => {
    if (!categoryFilter || categoryFilter.toLowerCase() === 'all') {
        return MOCK_MOMENTS;
    }
    const filterLower = categoryFilter.toLowerCase();
    return MOCK_MOMENTS.filter(m => m.category.toLowerCase() === filterLower);
};
