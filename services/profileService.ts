import { collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from './firestoreService';
import type { InvoxUser, Project } from '../types';
import { normalizeUsername } from './usernameService';

export interface DiscoverableProfile {
    id: string; // uid or canonical handle
    username: string;
    author: {
        name: string;
        isVerified?: boolean;
        avatarUrl: string;
        id?: string;
        uid?: string;
        username?: string;
    };
    description: string;
    category: string;
    domain?: string;
    skills?: string[];
    stats: {
        projects: number;
        links: number;
    };
}

export interface DiscoverableCategoryGroup {
    category: string;
    profiles: DiscoverableProfile[];
}

/**
 * Curated public discoverable profiles across platform domains,
 * fully aligned with the platform's Showcase and Collab projects.
 */
export const BASE_DISCOVERABLE_PROFILES: DiscoverableProfile[] = [
    // ── MACHINE LEARNING & AI ────────────────────────────────────────────────
    {
        id: 'seed_cadams',
        username: 'cadams',
        author: {
            name: 'Crash Adams',
            username: 'cadams',
            isVerified: true,
            avatarUrl: 'https://picsum.photos/id/10/200/200',
            id: 'seed_cadams',
            uid: 'seed_cadams',
        },
        description: 'Decentralized social networking pioneer building verifiable ethical AI and zero-knowledge inference frameworks.',
        category: 'Machine Learning & AI',
        domain: 'Machine Learning',
        skills: ['Ethical AI', 'Machine Learning', 'Python', 'PyTorch', 'ZeroKnowledge', 'Web3'],
        stats: {
            projects: 2,
            links: 2,
        },
    },
    {
        id: 'seed_ereed',
        username: 'ereed',
        author: {
            name: 'Dr. Evelyn Reed',
            username: 'ereed',
            isVerified: true,
            avatarUrl: 'https://picsum.photos/id/13/200/200',
            id: 'seed_ereed',
            uid: 'seed_ereed',
        },
        description: 'AI Ethicist and researcher focusing on algorithmic bias detection, fairness, and transparency in large language models.',
        category: 'Machine Learning & AI',
        domain: 'Machine Learning',
        skills: ['NLP', 'Language Models', 'PyTorch', 'Data Science', 'AI Ethics'],
        stats: {
            projects: 1,
            links: 2,
        },
    },
    {
        id: 'seed_sarahlee',
        username: 'sarahlee',
        author: {
            name: 'Sarah Lee',
            username: 'sarahlee',
            isVerified: true,
            avatarUrl: 'https://picsum.photos/seed/sarah/200',
            id: 'seed_sarahlee',
            uid: 'seed_sarahlee',
        },
        description: 'AI Ethicist & Researcher. Focused on building fair, interpretable, and transparent machine learning models.',
        category: 'Machine Learning & AI',
        domain: 'Machine Learning',
        skills: ['Fair ML', 'Explainable AI', 'Python', 'TensorFlow', 'NLP'],
        stats: {
            projects: 1,
            links: 3,
        },
    },
    {
        id: 'seed_davidchen',
        username: 'davidchen',
        author: {
            name: 'David Chen',
            username: 'davidchen',
            isVerified: false,
            avatarUrl: 'https://picsum.photos/seed/david/200',
            id: 'seed_davidchen',
            uid: 'seed_davidchen',
        },
        description: 'Data Scientist specializing in NLP and large language models. Always learning and open-sourcing benchmarks.',
        category: 'Machine Learning & AI',
        domain: 'Machine Learning',
        skills: ['NLP', 'Transformers', 'HuggingFace', 'Python', 'PyTorch'],
        stats: {
            projects: 1,
            links: 2,
        },
    },
    {
        id: 'seed_maria_rodriguez',
        username: 'mrodriguez',
        author: {
            name: 'Maria Rodriguez',
            username: 'mrodriguez',
            isVerified: true,
            avatarUrl: 'https://picsum.photos/seed/maria/200',
            id: 'seed_maria_rodriguez',
            uid: 'seed_maria_rodriguez',
        },
        description: 'MLOps expert, streamlining automated deployment and observability of machine learning models at scale.',
        category: 'Machine Learning & AI',
        domain: 'Machine Learning',
        skills: ['MLOps', 'Kubernetes', 'Docker', 'MLflow', 'Python'],
        stats: {
            projects: 1,
            links: 2,
        },
    },

    // ── WEB DEVELOPMENT ──────────────────────────────────────────────────────
    {
        id: 'seed_ktanaka',
        username: 'ktanaka',
        author: {
            name: 'Kenji Tanaka',
            username: 'ktanaka',
            isVerified: true,
            avatarUrl: 'https://picsum.photos/id/21/200/200',
            id: 'seed_ktanaka',
            uid: 'seed_ktanaka',
        },
        description: 'Creative frontend developer and WebXR enthusiast crafting interactive 3D spatial language learning environments.',
        category: 'Web Development',
        domain: 'App Development',
        skills: ['WebXR', 'React', 'Three.js', 'TypeScript', 'Tailwind'],
        stats: {
            projects: 2,
            links: 2,
        },
    },
    {
        id: 'seed_mrossi',
        username: 'mrossi',
        author: {
            name: 'Marco Rossi',
            username: 'mrossi',
            isVerified: false,
            avatarUrl: 'https://picsum.photos/id/12/200/200',
            id: 'seed_mrossi',
            uid: 'seed_mrossi',
        },
        description: 'Systems engineer building ultra-fast reactive engines, cross-platform native frameworks, and high-throughput APIs.',
        category: 'Web Development',
        domain: 'App Development',
        skills: ['TypeScript', 'Compilers', 'React', 'Go', 'Native Frameworks'],
        stats: {
            projects: 2,
            links: 2,
        },
    },
    {
        id: 'seed_ljohnson',
        username: 'ljohnson',
        author: {
            name: 'Liam Johnson',
            username: 'ljohnson',
            isVerified: false,
            avatarUrl: 'https://picsum.photos/id/16/200/200',
            id: 'seed_ljohnson',
            uid: 'seed_ljohnson',
        },
        description: 'Full-stack software architect specializing in real-time developer collaboration, WebSockets, and distributed tooling.',
        category: 'Web Development',
        domain: 'App Development',
        skills: ['WebSockets', 'React', 'Go', 'Distributed Systems', 'PostgreSQL'],
        stats: {
            projects: 1,
            links: 2,
        },
    },
    {
        id: 'seed_jessica_wang',
        username: 'jessicawang',
        author: {
            name: 'Jessica Wang',
            username: 'jessicawang',
            isVerified: true,
            avatarUrl: 'https://picsum.photos/seed/jessica/200',
            id: 'seed_jessica_wang',
            uid: 'seed_jessica_wang',
        },
        description: 'Full-stack developer with a passion for creating accessible, high-performance web applications and design tokens.',
        category: 'Web Development',
        domain: 'App Development',
        skills: ['Next.js', 'React', 'TypeScript', 'Node.js', 'GraphQL'],
        stats: {
            projects: 1,
            links: 3,
        },
    },
    {
        id: 'seed_tom_smith',
        username: 'tomsmith',
        author: {
            name: 'Tom Smith',
            username: 'tomsmith',
            isVerified: false,
            avatarUrl: 'https://picsum.photos/seed/tom/200',
            id: 'seed_tom_smith',
            uid: 'seed_tom_smith',
        },
        description: 'Frontend wizard. React, Vue, and Svelte enthusiast. Making the web faster and more responsive, one component at a time.',
        category: 'Web Development',
        domain: 'App Development',
        skills: ['React', 'Vue', 'Svelte', 'Tailwind CSS', 'Vite'],
        stats: {
            projects: 1,
            links: 2,
        },
    },

    // ── DESIGN & UI ──────────────────────────────────────────────────────────
    {
        id: 'seed_chloeb',
        username: 'chloeb',
        author: {
            name: 'Chloe Bennet',
            username: 'chloeb',
            isVerified: true,
            avatarUrl: 'https://picsum.photos/id/15/200/200',
            id: 'seed_chloeb',
            uid: 'seed_chloeb',
        },
        description: 'Design Systems Architect creating WCAG AAA compliant design tokens, fluid UI libraries, and multi-tenant architectures.',
        category: 'Design & UI',
        domain: 'Design',
        skills: ['Figma', 'UI/UX', 'Design Systems', 'React', 'Accessibility'],
        stats: {
            projects: 2,
            links: 3,
        },
    },
    {
        id: 'seed_mcbenny',
        username: 'mcbenny',
        author: {
            name: 'Mc Benny',
            username: 'mcbenny',
            isVerified: true,
            avatarUrl: 'https://picsum.photos/id/25/200/200',
            id: 'seed_mcbenny',
            uid: 'seed_mcbenny',
        },
        description: 'Product Designer reimagining the future of real-time collaborative workflows, canvas rendering, and developer tooling.',
        category: 'Design & UI',
        domain: 'Design',
        skills: ['Product Design', 'UI/UX', 'Figma', 'Interactive Canvases', 'Design Systems'],
        stats: {
            projects: 1,
            links: 2,
        },
    },
    {
        id: 'seed_musichaze',
        username: 'musichaze',
        author: {
            name: 'Music Haze',
            username: 'musichaze',
            isVerified: true,
            avatarUrl: 'https://picsum.photos/seed/musichaze/200',
            id: 'seed_musichaze',
            uid: 'seed_musichaze',
        },
        description: 'Interaction designer specializing in high-contrast sonic streaming visualizers and dynamic responsive audio interfaces.',
        category: 'Design & UI',
        domain: 'Design',
        skills: ['UI/UX', 'Motion Design', 'Figma', 'Design Systems', 'Creative Direction'],
        stats: {
            projects: 1,
            links: 2,
        },
    },
    {
        id: 'seed_emily_carter',
        username: 'emilycarter',
        author: {
            name: 'Emily Carter',
            username: 'emilycarter',
            isVerified: true,
            avatarUrl: 'https://picsum.photos/seed/emily/200',
            id: 'seed_emily_carter',
            uid: 'seed_emily_carter',
        },
        description: 'Product Designer focused on user-centered research, intuitive digital ergonomics, and micro-interactions.',
        category: 'Design & UI',
        domain: 'Design',
        skills: ['UI/UX', 'User Research', 'Figma', 'Design Strategy', 'Wireframing'],
        stats: {
            projects: 1,
            links: 3,
        },
    },
    {
        id: 'seed_ben_adams',
        username: 'benadams',
        author: {
            name: 'Ben Adams',
            username: 'benadams',
            isVerified: false,
            avatarUrl: 'https://picsum.photos/seed/ben/200',
            id: 'seed_ben_adams',
            uid: 'seed_ben_adams',
        },
        description: 'UI/UX Designer who loves crafting pixel-perfect interfaces, dark-mode design systems, and seamless checkout flows.',
        category: 'Design & UI',
        domain: 'Design',
        skills: ['Figma', 'UI Design', 'Interaction Design', 'Prototyping'],
        stats: {
            projects: 1,
            links: 2,
        },
    },

    // ── CYBERSECURITY ────────────────────────────────────────────────────────
    {
        id: 'seed_abello',
        username: 'abello',
        author: {
            name: 'Aisha Bello',
            username: 'abello',
            isVerified: true,
            avatarUrl: 'https://picsum.photos/id/22/200/200',
            id: 'seed_abello',
            uid: 'seed_abello',
        },
        description: 'Security researcher and open-source engineer building vision transformer toolkits for synthetic and deepfake media detection.',
        category: 'Cybersecurity',
        domain: 'Cybersecurity',
        skills: ['Cybersecurity', 'Deep Learning', 'Computer Vision', 'Python', 'Spectrograms'],
        stats: {
            projects: 1,
            links: 3,
        },
    },
    {
        id: 'seed_robert_moore',
        username: 'robertmoore',
        author: {
            name: 'Robert Moore',
            username: 'robertmoore',
            isVerified: true,
            avatarUrl: 'https://picsum.photos/seed/robertm/200',
            id: 'seed_robert_moore',
            uid: 'seed_robert_moore',
        },
        description: 'Ethical hacker and security analyst protecting decentralized protocols, digital assets, and infrastructure from zero-day threats.',
        category: 'Cybersecurity',
        domain: 'Cybersecurity',
        skills: ['Penetration Testing', 'Network Security', 'Cryptography', 'Audit', 'Linux'],
        stats: {
            projects: 1,
            links: 2,
        },
    },
    {
        id: 'seed_william_hill',
        username: 'williamhill',
        author: {
            name: 'William Hill',
            username: 'williamhill',
            isVerified: true,
            avatarUrl: 'https://picsum.photos/seed/williamh/200',
            id: 'seed_william_hill',
            uid: 'seed_william_hill',
        },
        description: 'Cloud Security Architect. Securing multi-cloud infrastructure and zero-trust IAM frameworks across AWS, Azure, and GCP.',
        category: 'Cybersecurity',
        domain: 'Cybersecurity',
        skills: ['Cloud Security', 'AWS', 'GCP', 'Terraform', 'Zero-Trust'],
        stats: {
            projects: 1,
            links: 2,
        },
    },
    {
        id: 'seed_charles_clark',
        username: 'charlesclark',
        author: {
            name: 'Charles Clark',
            username: 'charlesclark',
            isVerified: true,
            avatarUrl: 'https://picsum.photos/seed/charlesc/200',
            id: 'seed_charles_clark',
            uid: 'seed_charles_clark',
        },
        description: 'Application security engineer finding and patching software vulnerabilities in automated CI/CD continuous delivery pipelines.',
        category: 'Cybersecurity',
        domain: 'Cybersecurity',
        skills: ['AppSec', 'DevSecOps', 'Docker', 'OWASP', 'Code Audit'],
        stats: {
            projects: 1,
            links: 2,
        },
    },

    // ── FINTECH ──────────────────────────────────────────────────────────────
    {
        id: 'seed_fintechsolutions',
        username: 'fintechsolutions',
        author: {
            name: 'Fintech Solutions',
            username: 'fintechsolutions',
            isVerified: false,
            avatarUrl: 'https://picsum.photos/seed/fintechsolutions/200',
            id: 'seed_fintechsolutions',
            uid: 'seed_fintechsolutions',
        },
        description: 'Engineering high-density institutional dashboards, automated FX treasury pipelines, and algorithmic market data terminals.',
        category: 'Fintech',
        domain: 'Fintech',
        skills: ['Fintech', 'Analytics', 'React', 'D3.js', 'Real-Time Data'],
        stats: {
            projects: 1,
            links: 2,
        },
    },
    {
        id: 'seed_nancy_lewis',
        username: 'nancylewis',
        author: {
            name: 'Nancy Lewis',
            username: 'nancylewis',
            isVerified: true,
            avatarUrl: 'https://picsum.photos/seed/nancyl/200',
            id: 'seed_nancy_lewis',
            uid: 'seed_nancy_lewis',
        },
        description: 'Building the next evolution of decentralized finance protocols with automated liquidity mechanisms and smart contract guarantees.',
        category: 'Fintech',
        domain: 'Fintech',
        skills: ['DeFi', 'Solidity', 'Smart Contracts', 'Web3', 'Ethereum'],
        stats: {
            projects: 1,
            links: 3,
        },
    },
    {
        id: 'seed_karen_allen',
        username: 'karenallen',
        author: {
            name: 'Karen Allen',
            username: 'karenallen',
            isVerified: true,
            avatarUrl: 'https://picsum.photos/seed/karena/200',
            id: 'seed_karen_allen',
            uid: 'seed_karen_allen',
        },
        description: 'Product Leader for enterprise digital banking platforms, driving secure transaction infrastructure and consumer payments UX.',
        category: 'Fintech',
        domain: 'Fintech',
        skills: ['Product Management', 'Banking', 'Payments', 'APIs', 'Security'],
        stats: {
            projects: 1,
            links: 2,
        },
    },
    {
        id: 'seed_mark_young',
        username: 'markyoung',
        author: {
            name: 'Mark Young',
            username: 'markyoung',
            isVerified: false,
            avatarUrl: 'https://picsum.photos/seed/marky/200',
            id: 'seed_mark_young',
            uid: 'seed_mark_young',
        },
        description: 'Developing resilient, fault-tolerant payment gateway settlement engines with high transactional concurrency.',
        category: 'Fintech',
        domain: 'Fintech',
        skills: ['Payment Gateways', 'Distributed Systems', 'Go', 'PostgreSQL', 'Redis'],
        stats: {
            projects: 1,
            links: 2,
        },
    },
];

/**
 * Maps a skill/domain tag to one of the canonical Spotlight category labels.
 */
export const mapSkillsToCategory = (skills: string[] = [], fallback = 'Web Development'): string => {
    const text = skills.join(' ').toLowerCase();
    if (text.includes('ai') || text.includes('machine learning') || text.includes('nlp') || text.includes('vision') || text.includes('data science') || text.includes('ethical ai')) {
        return 'Machine Learning & AI';
    }
    if (text.includes('design') || text.includes('ui') || text.includes('ux') || text.includes('figma') || text.includes('prototyp') || text.includes('system')) {
        return 'Design & UI';
    }
    if (text.includes('security') || text.includes('cyber') || text.includes('crypt') || text.includes('audit') || text.includes('hack')) {
        return 'Cybersecurity';
    }
    if (text.includes('fintech') || text.includes('finance') || text.includes('trading') || text.includes('payment') || text.includes('defi')) {
        return 'Fintech';
    }
    return fallback;
};

/**
 * Calculates actual project count for any given profile identifier using all available live & mock projects.
 */
export const countUserProjects = (
    profile: { id: string; username?: string; author?: { name: string } },
    allProjects: Project[]
): number => {
    if (!allProjects || allProjects.length === 0) return 0;

    const id = profile.id.toLowerCase();
    const uname = (profile.username || '').toLowerCase();
    const name = (profile.author?.name || '').toLowerCase();

    const matches = allProjects.filter(p => {
        const pAuthorId = (p.authorId || (p as any).userId || p.author?.id || p.author?.uid || '').toLowerCase();
        const pAuthorUsername = (p.author?.username || '').toLowerCase();
        const pAuthorName = (p.author?.name || '').toLowerCase();

        return (
            (pAuthorId && (pAuthorId === id || pAuthorId === uname || pAuthorId === `seed_${uname}`)) ||
            (uname && pAuthorUsername === uname) ||
            (name && pAuthorName === name)
        );
    });

    return matches.length;
};

/**
 * Loads all discoverable public profiles, dynamically merging Firestore users with curated creator profiles.
 * Eliminates duplicate profiles and updates actual project counts based on live Showcase and Collab data.
 */
export const fetchDiscoverableProfiles = async (allProjects: Project[] = []): Promise<DiscoverableProfile[]> => {
    const profileMap = new Map<string, DiscoverableProfile>();

    // 1. First add base discoverable profiles
    for (const p of BASE_DISCOVERABLE_PROFILES) {
        const canonicalKey = normalizeUsername(p.username) || p.id;
        const actualProjects = countUserProjects(p, allProjects);

        profileMap.set(canonicalKey, {
            ...p,
            stats: {
                ...p.stats,
                projects: Math.max(p.stats.projects, actualProjects),
            },
        });
    }

    // 2. Query Firestore users collection for real registered users (without exposing private fields)
    try {
        const usersRef = collection(db, COLLECTIONS.users);
        const usersSnap = await getDocs(query(usersRef, limit(50)));

        usersSnap.forEach(d => {
            const data = d.data() as Partial<InvoxUser>;
            const rawUsername = data.username || data.email?.split('@')[0];
            const normalized = normalizeUsername(rawUsername || '');

            // Skip invalid or private accounts
            if (!data.displayName && !normalized) return;

            const canonicalKey = normalized || d.id;
            const existing = profileMap.get(canonicalKey);

            const category = mapSkillsToCategory(
                data.skills,
                existing?.category || (data.headline ? mapSkillsToCategory([data.headline]) : 'Web Development')
            );

            const linkCount = (data.links?.length || 0) + (data.website ? 1 : 0) + (data.portfolioURL ? 1 : 0);
            const actualProjects = countUserProjects(
                { id: d.id, username: normalized, author: { name: data.displayName || normalized } },
                allProjects
            );

            const mergedProfile: DiscoverableProfile = {
                id: d.id,
                username: normalized || d.id,
                author: {
                    name: data.displayName || normalized || 'Invox Member',
                    username: normalized || d.id,
                    avatarUrl: data.photoURL || existing?.author.avatarUrl || `https://picsum.photos/seed/${d.id}/200`,
                    isVerified: Boolean(data.role === 'admin' || data.emailVerified || existing?.author.isVerified),
                    id: d.id,
                    uid: d.id,
                },
                description: data.headline || data.bio || existing?.description || (data.skills?.length ? `Specializing in ${data.skills.slice(0, 3).join(', ')}` : 'Invox platform builder'),
                category,
                domain: category,
                skills: data.skills || existing?.skills || [],
                stats: {
                    projects: Math.max(actualProjects, data.savedProjectCount || 0, existing?.stats.projects || 0),
                    links: linkCount > 0 ? linkCount : (existing?.stats.links || 1),
                },
            };

            profileMap.set(canonicalKey, mergedProfile);
        });
    } catch (err) {
        console.warn('[PROFILES_FIRESTORE_FETCH_WARN] Using curated discoverable profiles:', err);
    }

    return Array.from(profileMap.values());
};

/**
 * Returns a complete InvoxUser object for any creator or seed identifier,
 * ensuring Profile.tsx can render full user profiles without failing.
 */
export const getFallbackUserProfile = (identifier: string): InvoxUser | null => {
    if (!identifier) return null;
    const clean = identifier.toLowerCase().replace(/^seed_/, '').trim();

    const match = BASE_DISCOVERABLE_PROFILES.find(p => {
        const pId = p.id.toLowerCase();
        const pUname = p.username.toLowerCase();
        return pId === identifier.toLowerCase() || pUname === clean || pUname === identifier.toLowerCase();
    });

    if (!match) return null;

    return {
        uid: match.id,
        email: null, // Privacy: never expose fake or private emails
        displayName: match.author.name,
        username: match.username,
        photoURL: match.author.avatarUrl,
        coverPhotoURL: null,
        role: match.author.isVerified ? 'admin' : 'user',
        emailVerified: Boolean(match.author.isVerified),
        headline: match.description,
        bio: match.description,
        skills: match.skills || [],
        interests: [match.category],
        links: [
            { label: 'Website', url: `https://${match.username}.dev` },
            { label: 'GitHub', url: `https://github.com/${match.username}` },
        ],
        location: 'Remote',
        website: `https://${match.username}.dev`,
        portfolioURL: `https://${match.username}.dev`,
        followerCount: match.stats.links * 450,
        followingCount: 38,
        savedPostCount: 12,
        savedProjectCount: match.stats.projects,
        savedOpportunityCount: 4,
        reputation: {
            knowledge: 85,
            contribution: 92,
            innovation: 88,
            collaboration: 94,
        },
        onboardingCompleted: true,
        profileCompletion: 90,
        createdAt: new Date('2024-01-15'),
    };
};
