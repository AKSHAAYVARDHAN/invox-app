import type { 
    Community, 
    CommunityMembership, 
    ConclaveGathering, 
    Event, 
    MyCommunity 
} from '../types';

/**
 * Storage key to toggle development/demo data source mode.
 * Options: 'auto' (default, falls back to mock if Firestore is empty), 'mock', or 'real'.
 */
export const COMMUNITIES_DATA_SOURCE_KEY = 'invox_communities_data_source';

export type CommunitiesDataSourceMode = 'auto' | 'mock' | 'real';

/**
 * Gets the active Communities data source mode.
 * Default is 'auto' to ensure the mockup remains populated if Firestore is empty.
 */
export const getCommunitiesDataSource = (): CommunitiesDataSourceMode => {
    try {
        const stored = localStorage.getItem(COMMUNITIES_DATA_SOURCE_KEY);
        if (stored === 'mock' || stored === 'real' || stored === 'auto') {
            return stored;
        }
        return 'auto';
    } catch {
        return 'auto';
    }
};

/**
 * Sets the active Communities data source mode.
 */
export const setCommunitiesDataSource = (mode: CommunitiesDataSourceMode): void => {
    try {
        localStorage.setItem(COMMUNITIES_DATA_SOURCE_KEY, mode);
        window.dispatchEvent(new CustomEvent('invox_communities_data_source_changed', { detail: { mode } }));
    } catch (e) {
        console.warn('[COMMUNITIES_DEMO_STORAGE_WARN]', e);
    }
};

/**
 * Helper to determine if mock data should be displayed given the real data length.
 */
export const shouldUseMockData = (realDataCount: number): boolean => {
    const mode = getCommunitiesDataSource();
    if (mode === 'mock') return true;
    if (mode === 'real') return false;
    // 'auto' mode: use mock if real database is empty
    return realDataCount === 0;
};

const NOW = Date.now();
const ONE_HOUR = 3600 * 1000;
const ONE_DAY = 24 * ONE_HOUR;

/**
 * High-fidelity, preserved sample communities for UI testing, layout evaluation,
 * and reviewing the complete INVOX Communities interface.
 * 
 * NOTE: Purely in-memory and NEVER written into production Firestore collections.
 */
export const MOCK_COMMUNITIES: Community[] = [
    {
        id: 'mock-comm-tech-enthusiasts',
        name: 'Tech Enthusiasts',
        handle: 'techenthusiasts',
        description: 'A global network of technologists, engineers, and researchers exploring frontier architectures, decentralized protocols, and modern computing.',
        purpose: 'Fostering deep technical dialogue, reproducible benchmarks, and collaborative experiments in next-generation computing systems.',
        avatarUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=200&h=200&auto=format&fit=crop',
        bannerUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1200&auto=format&fit=crop',
        category: 'Technology & AI',
        domain: 'tech-ai',
        topics: ['Artificial Intelligence', 'Edge Computing', 'Distributed Systems', 'Hardware'],
        ownerId: 'mock-user-alex',
        ownerName: 'Alex Mercer',
        ownerAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=100&h=100&auto=format&fit=crop',
        visibility: 'public',
        joinPolicy: 'open',
        memberCount: 2840,
        members: 2840,
        rating: 4.9,
        isVerified: true,
        foundingStory: 'Founded in 2024 to provide an uncompromised forum for open-source engineering and empirical technology reviews.',
        values: ['Empirical Rigor', 'Zero Speculation', 'Open Source Commitment', 'Knowledge Sharing'],
        guidelines: [
            'Ground claims with reproducible benchmarks or code',
            'Constructive critique only; respect architectural diversity',
            'No promotional spam or token shilling'
        ],
        milestones: [
            { id: 'm1', title: 'Global Collective Charter Established', date: '2024-01-15', description: 'Published foundational collective principles with 100 initial founding contributors.' },
            { id: 'm2', title: 'Distributed Compute Conclave #1', date: '2024-06-20', description: 'Hosted 400+ simultaneous engineering nodes benchmarking quantized inference.' }
        ],
        createdAt: new Date(NOW - 120 * ONE_DAY),
        updatedAt: new Date(NOW - 2 * ONE_HOUR),
    },
    {
        id: 'mock-comm-design-systems',
        name: 'Design Systems Collective',
        handle: 'designsystems',
        description: 'Design architects, UI engineers, and craft purists creating scalable token systems, accessible typography, and distinctive spatial experiences.',
        purpose: 'Advancing the state of digital craftsmanship by balancing systematic consistency with evocative visual artistry.',
        avatarUrl: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?q=80&w=200&h=200&auto=format&fit=crop',
        bannerUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=1200&auto=format&fit=crop',
        category: 'Design & Creativity',
        domain: 'design-creativity',
        topics: ['Design Tokens', 'Micro-interactions', 'WebGL', 'Accessibility', 'Typography'],
        ownerId: 'mock-user-elena',
        ownerName: 'Elena Rostova',
        ownerAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=100&h=100&auto=format&fit=crop',
        visibility: 'public',
        joinPolicy: 'open',
        memberCount: 1920,
        members: 1920,
        rating: 4.8,
        isVerified: true,
        foundingStory: 'Originated from product designers and frontend craftsmen who rebelled against flat, commoditized template aesthetics.',
        values: ['Obsessive Craft', 'Micro-interaction Intent', 'Inclusive Accessibility', 'Zero Slop'],
        guidelines: [
            'Share interactive demos and code sandboxes alongside designs',
            'Provide accessibility audit notes with submitted components',
            'Critique constructively focused on user ergonomics'
        ],
        milestones: [
            { id: 'ds-m1', title: 'Token Spec v1 Published', date: '2024-03-10', description: 'Standardized cross-framework token schemas adopted across 40+ collectives.' }
        ],
        createdAt: new Date(NOW - 90 * ONE_DAY),
        updatedAt: new Date(NOW - 6 * ONE_HOUR),
    },
    {
        id: 'mock-comm-ai-innovators',
        name: 'AI Innovators Hub',
        handle: 'aiinnovators',
        description: 'Researchers, builders, and applied ML engineers deploying multimodal models, autonomous agents, and grounded neural architectures.',
        purpose: 'Accelerating responsible machine intelligence applications through shared dataset benchmarks and peer review.',
        avatarUrl: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?q=80&w=200&h=200&auto=format&fit=crop',
        bannerUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200&auto=format&fit=crop',
        category: 'Technology & AI',
        domain: 'tech-ai',
        topics: ['Multimodal LLMs', 'Agent Runtimes', 'Neural Tool Use', 'Evaluation'],
        ownerId: 'mock-user-marcus',
        ownerName: 'Marcus Vance',
        ownerAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=100&h=100&auto=format&fit=crop',
        visibility: 'public',
        joinPolicy: 'approval_required',
        memberCount: 1680,
        members: 1680,
        rating: 4.9,
        isVerified: true,
        foundingStory: 'Formed during the generative intelligence transition to connect applied research directly with high-signal engineering teams.',
        values: ['Ground Truth Verification', 'Safety by Design', 'Transparent Benchmarks'],
        guidelines: [
            'All benchmark assertions must cite evaluation datasets',
            'Disclose inference latency, parameters, and temperature configurations',
            'Protect user privacy and sanitize sample corpora'
        ],
        createdAt: new Date(NOW - 60 * ONE_DAY),
        updatedAt: new Date(NOW - 1 * ONE_DAY),
    },
    {
        id: 'mock-comm-rust-systems',
        name: 'Rust & Systems Guild',
        handle: 'rustsystems',
        description: 'Memory safety, fearless concurrency, and bare-metal performance. Dedicated to low-level systems programming and WASM runtimes.',
        purpose: 'Cultivating uncompromising software resilience, zero-cost abstractions, and high-throughput network engines.',
        avatarUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=200&h=200&auto=format&fit=crop',
        bannerUrl: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=1200&auto=format&fit=crop',
        category: 'Software Development',
        domain: 'software-dev',
        topics: ['Rust', 'WebAssembly', 'Kernel Architecture', 'Concurrency', 'Distributed Nodes'],
        ownerId: 'mock-user-kaelen',
        ownerName: 'Kaelen Chen',
        ownerAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=100&h=100&auto=format&fit=crop',
        visibility: 'public',
        joinPolicy: 'open',
        memberCount: 1450,
        members: 1450,
        rating: 4.8,
        isVerified: true,
        foundingStory: 'Started by systems engineers seeking a dedicated sanctuary away from generic scripting discussions.',
        values: ['Zero Cost Abstractions', 'Fearless Concurrency', 'Predictable Latency'],
        guidelines: [
            'Provide compiler playground links for syntax or borrow checker queries',
            'Benchmark allocations before making algorithmic claims'
        ],
        createdAt: new Date(NOW - 45 * ONE_DAY),
        updatedAt: new Date(NOW - 12 * ONE_HOUR),
    },
    {
        id: 'mock-comm-startup-foundry',
        name: 'Startup Foundry',
        handle: 'startupfoundry',
        description: 'Pragmatic founders, technical operators, and bootstrapping builders exchanging product lessons, traction tactics, and venture insights.',
        purpose: 'Supporting early-stage creators from 0 to 1 with peer feedback, customer discovery frameworks, and investor readiness.',
        avatarUrl: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?q=80&w=200&h=200&auto=format&fit=crop',
        bannerUrl: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?q=80&w=1200&auto=format&fit=crop',
        category: 'Startups & Entrepreneurship',
        domain: 'startups',
        topics: ['Bootstrapping', 'Venture Capital', 'Product Market Fit', 'GTM Strategy', 'Unit Economics'],
        ownerId: 'mock-user-sarah',
        ownerName: 'Sarah Jenkins',
        ownerAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=100&h=100&auto=format&fit=crop',
        visibility: 'public',
        joinPolicy: 'open',
        memberCount: 1220,
        members: 1220,
        rating: 4.7,
        isVerified: true,
        foundingStory: 'Formed by serial entrepreneurs who wanted authentic, behind-the-scenes discussions of product failures and scaling bottlenecks.',
        values: ['Radical Transparency', 'Execution Over Ideation', 'Peer Camaraderie'],
        guidelines: [
            'Share real conversion metrics and growth hurdles',
            'No cold sales pitches or unsolicited direct solicitations'
        ],
        createdAt: new Date(NOW - 30 * ONE_DAY),
        updatedAt: new Date(NOW - 4 * ONE_HOUR),
    },
    {
        id: 'mock-comm-deep-science',
        name: 'Deep Science & Quantum',
        handle: 'deepscience',
        description: 'Biologists, computational chemists, and quantum computing researchers analyzing complex systems, molecular dynamics, and physics simulation.',
        purpose: 'Democratizing computational discovery through interdisciplinary papers, open datasets, and shared lab protocols.',
        avatarUrl: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?q=80&w=200&h=200&auto=format&fit=crop',
        bannerUrl: 'https://images.unsplash.com/photo-1507413245164-6160d8298b31?q=80&w=1200&auto=format&fit=crop',
        category: 'Science & Research',
        domain: 'science-research',
        topics: ['Computational Biology', 'Quantum Computing', 'Molecular Simulation', 'Open Science'],
        ownerId: 'mock-user-dr-arun',
        ownerName: 'Dr. Arun Patel',
        ownerAvatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=100&h=100&auto=format&fit=crop',
        visibility: 'public',
        joinPolicy: 'approval_required',
        memberCount: 980,
        members: 980,
        rating: 4.9,
        isVerified: true,
        foundingStory: 'Established to bridge theoretical research papers with practical computational notebooks and open peer review.',
        values: ['Scientific Rigor', 'Open Data', 'Reproducibility'],
        guidelines: [
            'Cite peer-reviewed DOIs or preprint links when discussing literature',
            'Include computational hardware configurations with simulation benchmarks'
        ],
        createdAt: new Date(NOW - 25 * ONE_DAY),
        updatedAt: new Date(NOW - 8 * ONE_HOUR),
    },
    {
        id: 'mock-comm-spatial-web',
        name: 'Spatial Web & 3D Lab',
        handle: 'spatialweb',
        description: 'Three.js specialists, WebGPU developers, and shader artists building interactive 3D spaces, data visualizations, and spatial audio.',
        purpose: 'Pioneering evocative 3D web environments that run smoothly across modern desktop and mobile browsers.',
        avatarUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=200&h=200&auto=format&fit=crop',
        bannerUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200&auto=format&fit=crop',
        category: 'Design & Creativity',
        domain: 'design-creativity',
        topics: ['Three.js', 'WebGPU', 'GLSL Shaders', 'Volumetric Audio', 'Procedural Generation'],
        ownerId: 'mock-user-kai',
        ownerName: 'Kai Tanaka',
        ownerAvatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=100&h=100&auto=format&fit=crop',
        visibility: 'public',
        joinPolicy: 'open',
        memberCount: 840,
        members: 840,
        rating: 4.8,
        isVerified: true,
        foundingStory: 'Started to share GLSL shaders, lighting math, and draw call optimizations for web-based spatial experiences.',
        values: ['60FPS Fluidity', 'Visual Poetry', 'Hardware Awareness'],
        guidelines: [
            'Always provide live WebGL / WebGPU links with fps counters',
            'Credit asset and math formula origins'
        ],
        createdAt: new Date(NOW - 15 * ONE_DAY),
        updatedAt: new Date(NOW - 3 * ONE_HOUR),
    },
    {
        id: 'mock-comm-cyber-defense',
        name: 'Cyber Defense & Cryptography',
        handle: 'cyberdefense',
        description: 'Security researchers, zero-knowledge cryptographers, and red-team practitioners analyzing threat intelligence, zero-days, and formal verification.',
        purpose: 'Strengthening global infrastructure security through transparent vulnerability disclosure and cryptographic proofs.',
        avatarUrl: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?q=80&w=200&h=200&auto=format&fit=crop',
        bannerUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=1200&auto=format&fit=crop',
        category: 'Software Development',
        domain: 'software-dev',
        topics: ['Cryptography', 'Zero Knowledge', 'Formal Verification', 'Application Security'],
        ownerId: 'mock-user-maya',
        ownerName: 'Maya Lin',
        ownerAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=100&h=100&auto=format&fit=crop',
        visibility: 'public',
        joinPolicy: 'open',
        memberCount: 790,
        members: 790,
        rating: 4.9,
        isVerified: true,
        foundingStory: 'Formed by cryptographic engineers to study post-quantum algorithms and zk-SNARK verifiers.',
        values: ['Verifiable Proofs', 'Responsible Disclosure', 'Defense in Depth'],
        guidelines: [
            'Strict adherence to responsible vulnerability disclosure',
            'No weaponized exploits without sanitized proof-of-concepts'
        ],
        createdAt: new Date(NOW - 10 * ONE_DAY),
        updatedAt: new Date(NOW - 5 * ONE_HOUR),
    },
    {
        id: 'mock-comm-product-philosophy',
        name: 'Product Philosophy & Mind',
        handle: 'productphilosophy',
        description: 'Thinkers and product leaders discussing humane technology, digital well-being, cognitive ergonomics, and long-term tech stewardship.',
        purpose: 'Questioning attention-extractive paradigms and architecting digital spaces that foster genuine human focus.',
        avatarUrl: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?q=80&w=200&h=200&auto=format&fit=crop',
        bannerUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1200&auto=format&fit=crop',
        category: 'Idea Exchange',
        domain: 'idea-exchange',
        topics: ['Humane Technology', 'Cognitive Ergonomics', 'Attention Economy', 'Ethics'],
        ownerId: 'mock-user-david',
        ownerName: 'David Sorensen',
        ownerAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=100&h=100&auto=format&fit=crop',
        visibility: 'public',
        joinPolicy: 'open',
        memberCount: 650,
        members: 650,
        rating: 4.7,
        isVerified: false,
        foundingStory: 'Chartered to explore how software interfaces impact human attention, cognition, and democratic discourse.',
        values: ['Humane By Default', 'Intention Over Engagement', 'Thoughtful Debate'],
        guidelines: [
            'Focus discussions on systemic design rather than hot takes',
            'Cultivate high-empathy listening and nuance'
        ],
        createdAt: new Date(NOW - 5 * ONE_DAY),
        updatedAt: new Date(NOW - 30 * 60 * 1000), // 30m ago (Daily timeframe populated!)
    },
    {
        id: 'mock-comm-venture-operators',
        name: 'Venture & Growth Guild',
        handle: 'ventureoperators',
        description: 'Venture capitalists, angel investors, and growth leaders dissecting deal structures, syndicates, and macroeconomic tech cycles.',
        purpose: 'Providing unvarnished insights into funding mechanics, cap table governance, and durable scale.',
        avatarUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=200&h=200&auto=format&fit=crop',
        bannerUrl: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?q=80&w=1200&auto=format&fit=crop',
        category: 'Business & Leadership',
        domain: 'business-leadership',
        topics: ['Venture Capital', 'Growth Metrics', 'Cap Tables', 'Mergers & Acquisitions'],
        ownerId: 'mock-user-claire',
        ownerName: 'Claire Adams',
        ownerAvatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=100&h=100&auto=format&fit=crop',
        visibility: 'public',
        joinPolicy: 'open',
        memberCount: 520,
        members: 520,
        rating: 4.6,
        isVerified: false,
        foundingStory: 'Originated from syndicate leads looking for collaborative co-investment diligence and transparent portfolio support.',
        values: ['Founders First', 'Intellectual Candor', 'Long-Horizon Value'],
        guidelines: [
            'Maintain strict confidentiality on non-public cap table records',
            'Constructive financial feedback grounded in benchmark data'
        ],
        createdAt: new Date(NOW - 2 * ONE_DAY),
        updatedAt: new Date(NOW - 45 * 60 * 1000), // 45m ago (Daily timeframe populated!)
    }
];

/**
 * Categorized Suggested Networks preserved from the mockup
 */
export const MOCK_SUGGESTED_NETWORKS = [
    {
        category: 'Technology & AI',
        communities: [
            MOCK_COMMUNITIES[0], // Tech Enthusiasts
            MOCK_COMMUNITIES[2], // AI Innovators Hub
        ]
    },
    {
        category: 'Design & Creativity',
        communities: [
            MOCK_COMMUNITIES[1], // Design Systems Collective
            MOCK_COMMUNITIES[6], // Spatial Web & 3D Lab
        ]
    },
    {
        category: 'Software Development',
        communities: [
            MOCK_COMMUNITIES[3], // Rust & Systems Guild
            MOCK_COMMUNITIES[7], // Cyber Defense & Cryptography
        ]
    },
    {
        category: 'Startups & Business',
        communities: [
            MOCK_COMMUNITIES[4], // Startup Foundry
            MOCK_COMMUNITIES[9], // Venture & Growth Guild
        ]
    }
];

/**
 * Preserved events & Conclave gatherings for UI testing and layout evaluation
 */
export const MOCK_COMMUNITY_EVENTS: ConclaveGathering[] = [
    {
        id: 'event-mock-1',
        communityId: 'mock-comm-tech-enthusiasts',
        communityName: 'Tech Enthusiasts',
        communityAvatarUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=200&h=200&auto=format&fit=crop',
        title: 'Decentralized Intelligence & Edge Nodes Summit',
        description: 'A deep-dive technical conclave exploring local on-device neural inference, WebGPU shader execution, and peer-to-peer telemetry synchronization.',
        format: 'online',
        date: 'TOMORROW, 18:00',
        time: '18:00 UTC',
        timezone: 'UTC',
        location: 'Virtual Conclave Room #4',
        virtualUrl: 'https://meet.google.com/invox-edge-conclave',
        hostId: 'mock-user-alex',
        hostName: 'Alex Mercer',
        capacity: 250,
        attendeeCount: 184,
        attendeeIds: ['mock-user-alex', 'mock-user-elena'],
        status: 'scheduled',
        createdAt: new Date(NOW - 3 * ONE_DAY),
    },
    {
        id: 'event-mock-2',
        communityId: 'mock-comm-design-systems',
        communityName: 'Design Systems Collective',
        communityAvatarUrl: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?q=80&w=200&h=200&auto=format&fit=crop',
        title: 'Micro-Interactions & Spatial UI Lab Session',
        description: 'Hands-on live breakdown of high-frequency kinetic animations, WebGL displacement filters, and token architecture in complex dashboards.',
        format: 'hybrid',
        date: 'FRI, NOV 07',
        time: '15:30 CET',
        timezone: 'CET',
        location: 'Berlin Hub & Global Stream',
        virtualUrl: 'https://meet.google.com/invox-spatial-lab',
        hostId: 'mock-user-elena',
        hostName: 'Elena Rostova',
        capacity: 100,
        attendeeCount: 88,
        attendeeIds: ['mock-user-elena'],
        status: 'scheduled',
        createdAt: new Date(NOW - 5 * ONE_DAY),
    },
    {
        id: 'event-mock-3',
        communityId: 'mock-comm-rust-systems',
        communityName: 'Rust & Systems Guild',
        communityAvatarUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=200&h=200&auto=format&fit=crop',
        title: 'Bare-Metal WASM Runtimes Hackathon',
        description: '48-hour asynchronous hackathon building high-throughput message serialization libraries in Rust with zero memory allocations.',
        format: 'online',
        date: 'SAT, NOV 15',
        time: '10:00 EST',
        timezone: 'EST',
        location: 'Global Virtual Terminal',
        virtualUrl: 'https://github.com/invox/rust-wasm-hackathon',
        hostId: 'mock-user-kaelen',
        hostName: 'Kaelen Chen',
        capacity: 500,
        attendeeCount: 340,
        attendeeIds: ['mock-user-kaelen'],
        status: 'scheduled',
        createdAt: new Date(NOW - 2 * ONE_DAY),
    }
];

/**
 * Preserved sample "My Communities" records for the right sidebar when reviewing UI
 */
export const MOCK_MY_COMMUNITIES: CommunityMembership[] = [
    {
        id: 'mock-membership-1',
        communityId: 'mock-comm-tech-enthusiasts',
        communityName: 'Tech Enthusiasts',
        communityAvatarUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=200&h=200&auto=format&fit=crop',
        communityCategory: 'Technology & AI',
        userId: 'current-user',
        userName: 'You',
        role: 'owner',
        status: 'active',
        joinedAt: new Date(NOW - 60 * ONE_DAY),
    },
    {
        id: 'mock-membership-2',
        communityId: 'mock-comm-design-systems',
        communityName: 'Design Systems Collective',
        communityAvatarUrl: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?q=80&w=200&h=200&auto=format&fit=crop',
        communityCategory: 'Design & Creativity',
        userId: 'current-user',
        userName: 'You',
        role: 'moderator',
        status: 'active',
        joinedAt: new Date(NOW - 45 * ONE_DAY),
    },
    {
        id: 'mock-membership-3',
        communityId: 'mock-comm-rust-systems',
        communityName: 'Rust & Systems Guild',
        communityAvatarUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=200&h=200&auto=format&fit=crop',
        communityCategory: 'Software Development',
        userId: 'current-user',
        userName: 'You',
        role: 'member',
        status: 'active',
        joinedAt: new Date(NOW - 20 * ONE_DAY),
    }
];
