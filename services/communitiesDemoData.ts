import type { 
    Community, 
    CommunityMembership, 
    ConclaveGathering, 
    Event, 
    MyCommunity,
    Post
} from '../types';
import { PostType } from '../types';

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
 * Clearly distinguishes On-Site Conclaves (physical venues) and Virtual Conclaves (remote sessions).
 */
export const MOCK_COMMUNITY_EVENTS: ConclaveGathering[] = [
    {
        id: 'conclave-demo-onsite-1',
        communityId: 'startup-1',
        communityName: 'Startup Grind',
        communityAvatarUrl: 'https://picsum.photos/seed/startup-grind/200',
        title: 'Founder Conclave: Seed Stage Demo & Capital Round Table',
        description: 'Physical gathering for technical founders and angel operators. Live architecture pitch deck reviews, term sheet breakdowns, and in-person founder networking.',
        format: 'in-person',
        date: 'FRI, NOV 14',
        time: '18:30 PST',
        timezone: 'PST',
        location: 'The Foundry Hub • 550 Howard St, San Francisco, CA',
        hostId: 'founder-alex',
        hostName: 'Alex Vance (Founding Partner)',
        capacity: 80,
        attendeeCount: 64,
        attendeeIds: ['founder-alex', 'demo-user-1'],
        status: 'scheduled',
        createdAt: new Date(NOW - 3 * ONE_DAY),
    },
    {
        id: 'conclave-demo-virtual-1',
        communityId: 'startup-1',
        communityName: 'Startup Grind',
        communityAvatarUrl: 'https://picsum.photos/seed/startup-grind/200',
        title: 'Global Founder Assembly & Product Metrics Masterclass',
        description: 'High-frequency remote knowledge session analyzing unit economics, customer acquisition telemetry, and zero-churn onboarding pipelines with active Q&A.',
        format: 'online',
        date: 'TUE, NOV 18',
        time: '16:00 UTC',
        timezone: 'UTC',
        location: 'Google Meet',
        virtualUrl: 'https://meet.google.com/invox-founder-sync',
        hostId: 'founder-elena',
        hostName: 'Elena Rostova (Growth Lead)',
        capacity: 250,
        attendeeCount: 198,
        attendeeIds: ['founder-elena'],
        status: 'scheduled',
        createdAt: new Date(NOW - 2 * ONE_DAY),
    },
    {
        id: 'conclave-demo-onsite-2',
        communityId: 'coding-4',
        communityName: 'Pythonic Geeks',
        communityAvatarUrl: 'https://picsum.photos/seed/pythonic-geeks/200',
        title: 'PyData & Async Architecture Physical Workshop',
        description: 'In-person hands-on lab profiling asyncio coroutine bottlenecks, memory pinning in Polars DataFrames, and multi-threaded CPython extensions.',
        format: 'in-person',
        date: 'SAT, NOV 22',
        time: '14:00 GMT',
        timezone: 'GMT',
        location: 'Turing Lecture Hall • Tech City Centre, London',
        hostId: 'lead-dev-marcus',
        hostName: 'Marcus Sterling',
        capacity: 60,
        attendeeCount: 52,
        attendeeIds: ['lead-dev-marcus'],
        status: 'scheduled',
        createdAt: new Date(NOW - 4 * ONE_DAY),
    },
    {
        id: 'conclave-demo-virtual-2',
        communityId: 'coding-4',
        communityName: 'Pythonic Geeks',
        communityAvatarUrl: 'https://picsum.photos/seed/pythonic-geeks/200',
        title: 'Distributed Ray Clusters & Vector Search Virtual Conclave',
        description: 'Deep-dive remote session deploying distributed Ray pipelines on Kubernetes with real-time vector search index benchmarking.',
        format: 'online',
        date: 'THU, NOV 27',
        time: '18:00 UTC',
        timezone: 'UTC',
        location: 'Google Meet',
        virtualUrl: 'https://meet.google.com/invox-python-cluster',
        hostId: 'dev-sophia',
        hostName: 'Sophia Lin',
        capacity: 300,
        attendeeCount: 245,
        attendeeIds: ['dev-sophia'],
        status: 'scheduled',
        createdAt: new Date(NOW - 1 * ONE_DAY),
    },
    {
        id: 'conclave-demo-onsite-3',
        communityId: 'design-1',
        communityName: 'UI/UX Guild',
        communityAvatarUrl: 'https://picsum.photos/seed/ui-ux-guild/200',
        title: 'Spatial UI & Token Architecture In-Person Critique',
        description: 'Physical workshop analyzing live design tokens, component variant matrices, and tactile spatial feedback in modern web applications.',
        format: 'in-person',
        date: 'WED, DEC 03',
        time: '17:30 CET',
        timezone: 'CET',
        location: 'Kesselhaus Studio • Schönhauser Allee 36, Berlin',
        hostId: 'design-lead-kaelen',
        hostName: 'Kaelen Richter',
        capacity: 45,
        attendeeCount: 39,
        attendeeIds: ['design-lead-kaelen'],
        status: 'scheduled',
        createdAt: new Date(NOW - 5 * ONE_DAY),
    },
    {
        id: 'conclave-demo-virtual-3',
        communityId: 'design-1',
        communityName: 'UI/UX Guild',
        communityAvatarUrl: 'https://picsum.photos/seed/ui-ux-guild/200',
        title: 'High-Frequency Kinetic Micro-Interactions Live Stream',
        description: 'Interactive online design session exploring spring physics curves, GPU shader transition animations, and dark-mode color balance.',
        format: 'online',
        date: 'MON, DEC 08',
        time: '19:00 UTC',
        timezone: 'UTC',
        location: 'Google Meet',
        virtualUrl: 'https://meet.google.com/invox-spatial-ui',
        hostId: 'design-nadia',
        hostName: 'Nadia Volkova',
        capacity: 200,
        attendeeCount: 168,
        attendeeIds: ['design-nadia'],
        status: 'scheduled',
        createdAt: new Date(NOW - 3 * ONE_DAY),
    },
    {
        id: 'conclave-demo-onsite-4',
        communityId: 'coding-3',
        communityName: 'JS Junkies',
        communityAvatarUrl: 'https://picsum.photos/seed/js-junkies/200',
        title: 'React Server Actions & V8 Optimization Physical Hack-Session',
        description: 'Hands-on hacking gathering targeting micro-benchmarks on V8 TurboFan deopts, hydration performance, and streaming SSR edge runtime deployment.',
        format: 'in-person',
        date: 'FRI, DEC 12',
        time: '18:00 EST',
        timezone: 'EST',
        location: 'Manhattan Tech Co-op • 120 Broadway, New York, NY',
        hostId: 'js-dan',
        hostName: 'Daniel Vance',
        capacity: 75,
        attendeeCount: 68,
        attendeeIds: ['js-dan'],
        status: 'scheduled',
        createdAt: new Date(NOW - 2 * ONE_DAY),
    },
    {
        id: 'conclave-demo-virtual-4',
        communityId: 'ai-1',
        communityName: 'AI ClubTech',
        communityAvatarUrl: 'https://picsum.photos/seed/ai-clubtech/200',
        title: 'Quantized LLM Inference on Edge Hardware Virtual Summit',
        description: 'Remote technical conference exploring 4-bit and 2-bit weight quantization, FlashAttention-3 GPU optimizations, and speculative decoding on consumer hardware.',
        format: 'online',
        date: 'SAT, DEC 20',
        time: '15:00 UTC',
        timezone: 'UTC',
        location: 'Google Meet',
        virtualUrl: 'https://meet.google.com/invox-ai-edge-summit',
        hostId: 'ai-lead-clara',
        hostName: 'Dr. Clara Weiss',
        capacity: 500,
        attendeeCount: 412,
        attendeeIds: ['ai-lead-clara'],
        status: 'scheduled',
        createdAt: new Date(NOW - 4 * ONE_DAY),
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

/**
 * Preserved sample public community posts for aggregated public feed testing.
 * Strictly separate from production Firestore.
 */
export const MOCK_COMMUNITY_PUBLIC_POSTS: Post[] = [
    {
        id: 'comm-post-mock-1',
        communityId: 'startup-1',
        communityName: 'Startup Grind',
        communityAvatarUrl: 'https://picsum.photos/seed/startup-grind/200',
        communityHandle: 'startupgrind',
        authorId: 'user_sg_elena',
        author: {
            name: 'Elena Rostova',
            avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&h=200&auto=format&fit=crop',
            username: 'elenarostova',
            isVerified: true
        },
        title: 'Zero-Burn Growth Strategy for Early-Stage Founders',
        aiSummary: 'Practical framework for scaling engineering without venture capital debt.',
        content: 'We recently ran an empirical analysis across 42 bootstrapped technical startups. Founders prioritizing high customer gross margins and lean edge-distributed compute reached profitability 3.2x faster than those spending heavily on upfront ad acquisitions. Here are the core metrics we tracked:\n\n1. Net Revenue Retention > 115%\n2. Organic Developer Referrals > 40%\n3. Cloud compute spend capped below 8% of ARR.',
        mediaUrl: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?q=80&w=1200&auto=format&fit=crop',
        mediaType: 'image',
        category: 'Startup',
        domain: 'Startup',
        tags: ['Startups', 'Bootstrapping', 'Growth', 'Metrics'],
        visibility: 'public',
        type: PostType.Feed,
        stats: { likes: 142, views: 3200, comments: 28 },
        likeCount: 142,
        viewCount: 3200,
        commentCount: 28,
        createdAt: new Date(NOW - 3 * ONE_HOUR),
    },
    {
        id: 'comm-post-mock-2',
        communityId: 'coding-4',
        communityName: 'Pythonic Geeks',
        communityAvatarUrl: 'https://picsum.photos/seed/pythonic-geeks/200',
        communityHandle: 'pythonicgeeks',
        authorId: 'user_py_marcus',
        author: {
            name: 'Marcus Vance',
            avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&h=200&auto=format&fit=crop',
            username: 'marcus_vance',
            isVerified: false
        },
        title: 'AsyncIO Internals: Avoiding Event Loop Blocking in Python 3.13',
        aiSummary: 'Deep dive into GIL-free concurrency and free-threaded CPython benchmarks.',
        content: 'With Python 3.13 experimental free-threading, we benchmarked CPU-bound tasks versus traditional multiprocessing. For mixed I/O and cryptographic hashing pipelines, eliminating the global interpreter lock yielded a 2.8x throughput increase across 16 worker cores without socket deadlock.',
        mediaUrls: [
            'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=800&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=800&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=800&auto=format&fit=crop'
        ],
        mediaType: 'image',
        category: 'Coding',
        domain: 'Coding',
        tags: ['Python', 'AsyncIO', 'Concurrency', 'Performance'],
        visibility: 'public',
        type: PostType.Feed,
        stats: { likes: 98, views: 2450, comments: 19 },
        likeCount: 98,
        viewCount: 2450,
        commentCount: 19,
        createdAt: new Date(NOW - 6 * ONE_HOUR),
    },
    {
        id: 'comm-post-mock-3',
        communityId: 'design-1',
        communityName: 'UI/UX Guild',
        communityAvatarUrl: 'https://picsum.photos/seed/ui-ux-guild/200',
        communityHandle: 'uiuxguild',
        authorId: 'user_des_sarah',
        author: {
            name: 'Sarah Lindqvist',
            avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&h=200&auto=format&fit=crop',
            username: 'sarah_ui',
            isVerified: true
        },
        title: 'Design Systems at Scale: Kinetic Micro-Interactions in Dark UI',
        aiSummary: 'Principles for dark-mode terminal ergonomics and typographic legibility.',
        content: 'When designing interfaces for technical operators, density is not the enemy — visual clutter is. By anchoring all components to a 4px modular grid, restricting chromatic contrast to semantic badges, and enforcing monospaced data alignment, cognitive load drops significantly during long sessions.',
        mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        thumbnailUrl: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?q=80&w=800&auto=format&fit=crop',
        mediaType: 'video',
        category: 'Design',
        domain: 'Design',
        tags: ['DesignSystems', 'Typography', 'Ergonomics', 'DarkUI'],
        visibility: 'public',
        type: PostType.Feed,
        stats: { likes: 215, views: 4800, comments: 34 },
        likeCount: 215,
        viewCount: 4800,
        commentCount: 34,
        createdAt: new Date(NOW - 14 * ONE_HOUR),
    },
    {
        id: 'comm-post-mock-4',
        communityId: 'coding-3',
        communityName: 'JS Junkies',
        communityAvatarUrl: 'https://picsum.photos/seed/js-junkies/200',
        communityHandle: 'jsjunkies',
        authorId: 'user_js_tariq',
        author: {
            name: 'Tariq Al-Mansoor',
            avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200&h=200&auto=format&fit=crop',
            username: 'tariq_dev',
            isVerified: false
        },
        title: 'Fine-Grained Reactivity in TypeScript: Signals vs State Reducers',
        aiSummary: 'Comparative benchmark of memory consumption and virtual DOM reconciliation.',
        content: 'We migrated an interactive canvas benchmark to signal-based fine-grained dependency graphs. Frame rates remained locked at 60fps with 5,000 updating nodes, reducing unnecessary component rerenders by over 80%. What is your team strategy for state management in 2026?',
        category: 'Coding',
        domain: 'Coding',
        tags: ['JavaScript', 'TypeScript', 'React', 'Architecture'],
        visibility: 'public',
        type: PostType.Feed,
        stats: { likes: 176, views: 3900, comments: 42 },
        likeCount: 176,
        viewCount: 3900,
        commentCount: 42,
        createdAt: new Date(NOW - 22 * ONE_HOUR),
    },
    {
        id: 'comm-post-mock-5',
        communityId: 'ai-1',
        communityName: 'AI ClubTech',
        communityAvatarUrl: 'https://picsum.photos/seed/ai-clubtech/200',
        communityHandle: 'aiclubtech',
        authorId: 'user_ai_dr_chen',
        author: {
            name: 'Dr. Aaron Chen',
            avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=200&h=200&auto=format&fit=crop',
            username: 'dr_chen_ai',
            isVerified: true
        },
        title: 'Quantized LLM Inference on Edge Hardware: 4-bit vs 8-bit Accuracy',
        aiSummary: 'Empirical perplexity analysis of local open-weights models running on Apple Silicon & Snapdragon.',
        content: 'Testing Llama-3 and Mistral quantized via AWQ and GGUF: 4-bit quantization preserves 96.4% of benchmark reasoning capability while cutting memory bandwidth by more than half. Edge inference is now fast enough for offline sub-100ms conversational loops.',
        mediaUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200&auto=format&fit=crop',
        mediaType: 'image',
        category: 'Artificial Intelligence',
        domain: 'Artificial Intelligence',
        tags: ['AI', 'LLM', 'EdgeCompute', 'Quantization'],
        visibility: 'public',
        type: PostType.Feed,
        stats: { likes: 310, views: 7100, comments: 56 },
        likeCount: 310,
        viewCount: 7100,
        commentCount: 56,
        createdAt: new Date(NOW - 28 * ONE_HOUR),
    },
    {
        id: 'comm-post-mock-6',
        communityId: 'business-1',
        communityName: 'Market Movers',
        communityAvatarUrl: 'https://picsum.photos/seed/market-movers/200',
        communityHandle: 'marketmovers',
        authorId: 'user_biz_valeria',
        author: {
            name: 'Valeria Santos',
            avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=200&h=200&auto=format&fit=crop',
            username: 'valeria_biz',
            isVerified: true
        },
        title: 'B2B SaaS Margin Expansion: Pricing Architecture in High-Interest Climates',
        aiSummary: 'Strategic financial playbook for tier re-bundling and usage-based monetization.',
        content: 'Analyzing fiscal performance across 60 enterprise tech companies: shifting from per-seat subscriptions to hybrid consumption tiers reduced churn by 22% while expanding annual net retention. Operators must tie variable billing directly to tangible business outcomes.',
        mediaUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=1200&auto=format&fit=crop',
        mediaType: 'image',
        category: 'Business',
        domain: 'Business',
        tags: ['Business', 'SaaS', 'Monetization', 'Finance'],
        visibility: 'public',
        type: PostType.Feed,
        stats: { likes: 184, views: 4200, comments: 31 },
        likeCount: 184,
        viewCount: 4200,
        commentCount: 31,
        createdAt: new Date(NOW - 34 * ONE_HOUR),
    },
    {
        id: 'comm-post-mock-7',
        communityId: 'idea-1',
        communityName: 'Idea Circle',
        communityAvatarUrl: 'https://picsum.photos/seed/idea-circle/200',
        communityHandle: 'ideacircule',
        authorId: 'user_idea_liam',
        author: {
            name: 'Liam Sterling',
            avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200&h=200&auto=format&fit=crop',
            username: 'liam_sterling',
            isVerified: false
        },
        title: 'Concept Validation Framework: Zero-Code Prototype Testing in 48 Hours',
        aiSummary: 'Rapid ideation hypothesis testing without writing a line of production code.',
        content: 'Before writing architecture specs or spinning up databases, we tested 5 prospective consumer utility concepts using landing pages with simulated interactions. By measuring click-through intent on specific core features, only the highest-converting hypothesis was selected for development.',
        mediaUrl: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?q=80&w=1200&auto=format&fit=crop',
        mediaType: 'image',
        category: 'Idea Exchange',
        domain: 'Idea Exchange',
        tags: ['IdeaExchange', 'Ideation', 'Validation', 'ProductDesign'],
        visibility: 'public',
        type: PostType.Feed,
        stats: { likes: 129, views: 3100, comments: 24 },
        likeCount: 129,
        viewCount: 3100,
        commentCount: 24,
        createdAt: new Date(NOW - 42 * ONE_HOUR),
    }
];


