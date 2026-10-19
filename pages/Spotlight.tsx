import React, { useState, useEffect, useRef } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import type { Project, QuickCollab, ActivePing, Offer, Post, CollabApplication } from '../types';
import { PostType } from '../types';
import { EditPostModal } from '../components/feed/EditPostModal';
import { CollabApplicationModal } from '../components/spotlight/CollabApplicationModal';
import { subscribeToCollabApplications, getRoleCapacity } from '../services/collabApplicationService';
import { 
    HeartIcon, 
    TrendingUpIcon, 
    ChatBubbleBottomCenterTextIcon, 
    ForwardIcon, 
    BookmarkIcon, 
    EllipsisVerticalIcon,
    SparklesIcon, 
    CheckBadgeIcon,
    LockClosedIcon,
    ProfileIcon,
    PlayIcon,
    PauseIcon,
    VolumeUpIcon,
    VolumeOffIcon,
    ArrowUpIcon,
    MagnifyingGlassIcon,
    FilterIcon,
    FireIcon,
    ChevronDownIcon,
    ArrowLeftIcon,
    CloseIcon,
    InformationCircleIcon,
    ArrowsPointingOutIcon,
    ArrowsPointingInIcon,
    BriefcaseIcon,
    MapPinIcon,
    BuildingOffice2Icon,
    CubeIcon,
    BookmarkIconSolid,
    SendIcon,
    CheckCircleIcon,
    XCircleIcon,
    EnvelopeIcon,
    ChatIcon,
    CalendarDaysIcon,
    AcademicCapIcon,
    CodeBracketIcon,
    CurrencyDollarIcon,
    LinkIcon,
    PencilSquareIcon,
    PencilSwooshIcon,
    ShieldCheckIcon
} from '../components/ui/Icons';
import DomainFilter from '../components/ui/DomainFilter';
import ProjectCardSkeleton from '../components/spotlight/ProjectCardSkeleton';
import QuickCollabCardSkeleton from '../components/spotlight/QuickCollabCardSkeleton';
import PingCardSkeleton from '../components/spotlight/PingCardSkeleton';
import { handleImageError } from '../components/utils/imageUtils';
import { useAuth } from '../contexts/AuthContext';
import { useFullscreen } from '../components/hooks/useFullscreen';
import { useLazyLoad } from '../components/hooks/useLazyLoad';
import AspectRatioBox from '../components/ui/AspectRatioBox';
import SegmentedSlideBar from '../components/ui/SegmentedSlideBar';
import ImageZoomModal from '../components/ui/ImageZoomModal';
import GoForItOpportunityCard from '../components/spotlight/GoForItOpportunityCard';
import GoForItOpportunityCardSkeleton from '../components/spotlight/GoForItOpportunityCardSkeleton';
import { useAIAssistant } from '../contexts/AIAssistantContext';
import { useFilters } from '../contexts/AIAssistantContext';
import { 
    subscribeToCollabPosts, 
    getCollabPosts, 
    postToProject,
    subscribeToShowcasePosts,
    getShowcasePosts,
    seedInitialShowcasePostsIfEmpty,
    postToShowcaseProject,
    getUserLikedPostIds,
    getUserSavedPostIds,
    subscribeToUserSavedPostIds,
    getShowcaseProjectById,
    isCollabSignal
} from '../services/postService';
import { subscribeFollowedUserIds, toggleFollowCreator, getProjectCreatorId } from '../services/connectionService';
import { CollabManagementHub } from '../components/spotlight/CollabManagementHub';
import { CollabMessageBoardView } from '../components/spotlight/CollabMessageBoardView';
import { CollabTeamsView } from '../components/spotlight/CollabTeamsView';
import { ShowcaseCard } from '../components/spotlight/ShowcaseCard';
import { CreateShowcaseModal } from '../components/uploads/CreateShowcaseModal';
import { SuggestionCard } from '../components/spotlight/SuggestionCard';

export { getProjectCreatorId };

const formatNumber = (num: number) => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000)}k`;
    return num;
};

export const mockProjects: Project[] = [
    {
        id: 'proj-new-4',
        authorId: 'seed_abello',
        author: { name: 'Aisha Bello', username: 'abello', id: 'seed_abello', uid: 'seed_abello', avatarUrl: 'https://picsum.photos/id/22/200/200', isVerified: true },
        title: 'Deepfake Sentinel',
        name: 'Deepfake Sentinel',
        aiSummary: 'Open-source toolkit for detecting deepfakes.',
        oneLine: 'Open-source toolkit for detecting deepfakes.',
        hook: 'Open-source toolkit for detecting deepfakes.',
        description: 'A powerful and accessible library for developers and researchers to detect and analyze manipulated media. Using advanced deep learning models, our toolkit aims to combat misinformation by providing reliable deepfake detection capabilities.',
        mediaUrl: 'https://images.unsplash.com/photo-1504639725590-34d0984388bd?q=80&w=1974&auto=format&fit=crop',
        mediaType: 'image',
        stats: { likes: 132000, views: 52000000, comments: 24000 },
        category: 'Cybersecurity',
        createdAt: new Date(),
    },
    {
        id: 'proj-new-3',
        authorId: 'seed_ktanaka',
        author: { name: 'Kenji Tanaka', username: 'ktanaka', id: 'seed_ktanaka', uid: 'seed_ktanaka', avatarUrl: 'https://picsum.photos/id/21/200/200', isVerified: true },
        title: 'VR Lingo Explorer',
        name: 'VR Lingo Explorer',
        aiSummary: 'Gamified language learning app using VR.',
        oneLine: 'Gamified language learning app using VR.',
        hook: 'Gamified language learning app using VR.',
        description: 'An immersive virtual reality experience that makes learning a new language feel like playing a game. Users can explore virtual worlds, interact with AI-powered native speakers, and complete quests to master vocabulary and grammar.',
        mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
        mediaType: 'video',
        thumbnailUrl: 'https://images.unsplash.com/photo-1535016120720-40c646be5580?q=80&w=1280&h=720&auto=format&fit=crop',
        stats: { likes: 115000, views: 48000000, comments: 19000 },
        category: 'App Development',
        createdAt: new Date(),
    },
    {
        id: 'proj1',
        authorId: 'seed_cadams',
        author: { name: 'Crash Adams', username: 'cadams', id: 'seed_cadams', uid: 'seed_cadams', avatarUrl: 'https://picsum.photos/id/10/200/200', isVerified: true },
        title: 'Ethical Net',
        name: 'Ethical Net',
        aiSummary: 'A decentralised social network with ethical AI.',
        oneLine: 'A decentralised social network with ethical AI.',
        hook: 'A decentralised social network with ethical AI.',
        description: 'Building a next-gen social platform on Web3 principles, ensuring user data privacy and content moderation powered by a transparent, ethical AI framework.',
        mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
        mediaType: 'video',
        thumbnailUrl: 'https://i.ytimg.com/vi/eRsGyueVLvQ/maxresdefault.jpg',
        stats: { likes: 87200, views: 42300000, comments: 11200 },
        category: 'Machine Learning',
        createdAt: new Date(),
    },
    {
        id: 'proj3',
        authorId: 'seed_mrossi',
        author: { name: 'Marco Rossi', username: 'mrossi', id: 'seed_mrossi', uid: 'seed_mrossi', avatarUrl: 'https://picsum.photos/id/12/200/200' },
        title: 'NativeFlow Framework',
        name: 'NativeFlow Framework',
        aiSummary: 'Next-gen mobile app development framework.',
        oneLine: 'Next-gen mobile app development framework.',
        hook: 'Next-gen mobile app development framework.',
        description: 'A cross-platform framework designed for speed, performance, and a seamless developer experience. Build beautiful, native apps with a single codebase.',
        mediaUrl: 'https://images.unsplash.com/photo-1551650975-87deedd944c3?q=80&w=1974&auto=format&fit=crop',
        mediaType: 'image',
        stats: { likes: 72000, views: 28000000, comments: 8000 },
        category: 'App Development',
        createdAt: new Date(),
    },
    {
        id: 'proj4',
        authorId: 'seed_ereed',
        author: { name: 'Dr. Evelyn Reed', username: 'ereed', id: 'seed_ereed', uid: 'seed_ereed', avatarUrl: 'https://picsum.photos/id/13/200/200' },
        title: 'BiasLens AI',
        name: 'BiasLens AI',
        aiSummary: 'Ethical AI: Bias Detection in Language Models.',
        oneLine: 'Ethical AI: Bias Detection in Language Models.',
        hook: 'Ethical AI: Bias Detection in Language Models.',
        description: 'This project introduces a novel framework for identifying and mitigating biases in large-scale language models, ensuring fairer and more equitable AI systems.',
        mediaUrl: 'https://images.unsplash.com/photo-1620712943543-95fc6ih-p962453a?q=80&w=2070&auto=format&fit=crop',
        mediaType: 'image',
        stats: { likes: 150000, views: 45000000, comments: 22000 },
        category: 'Machine Learning',
        createdAt: new Date(),
    },
    {
        id: 'proj6',
        authorId: 'seed_chloeb',
        author: { name: 'Chloe Bennet', username: 'chloeb', id: 'seed_chloeb', uid: 'seed_chloeb', avatarUrl: 'https://picsum.photos/id/15/200/200', isVerified: true },
        title: 'Aura Design System',
        name: 'Aura Design System',
        aiSummary: 'A dynamic design system for modern web apps.',
        oneLine: 'A dynamic design system for modern web apps.',
        hook: 'A dynamic design system for modern web apps.',
        description: 'An open-source design system built with accessibility and scalability in mind. It includes a comprehensive set of React components and design tokens.',
        mediaUrl: 'https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?q=80&w=2070&auto=format&fit=crop',
        mediaType: 'image',
        stats: { likes: 89000, views: 12000000, comments: 16000 },
        category: 'Design',
        createdAt: new Date(),
    },
    {
        id: 'proj7',
        authorId: 'seed_ljohnson',
        author: { name: 'Liam Johnson', username: 'ljohnson', id: 'seed_ljohnson', uid: 'seed_ljohnson', avatarUrl: 'https://picsum.photos/id/16/200/200' },
        title: 'CodeSync Live',
        name: 'CodeSync Live',
        aiSummary: 'A real-time collaboration tool for developers.',
        oneLine: 'A real-time collaboration tool for developers.',
        hook: 'A real-time collaboration tool for developers.',
        description: 'A platform that allows developers to code, chat, and debug together in a shared environment, boosting productivity for remote teams.',
        mediaUrl: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?q=80&w=2070&auto=format&fit=crop',
        mediaType: 'image',
        stats: { likes: 110000, views: 19000000, comments: 14000 },
        category: 'App Development',
        createdAt: new Date(),
    }
];

export const mockForYouProjects: Project[] = [
    {
        id: 'collab1',
        author: { name: 'Mc Benny', avatarUrl: 'https://picsum.photos/id/25/200/200', isVerified: true },
        title: 'CollabFlow Studio',
        name: 'CollabFlow Studio',
        aiSummary: 'Help design the future of collaborative workflows.',
        oneLine: 'Help design the future of collaborative workflows.',
        hook: 'Help design the future of collaborative workflows.',
        description: 'We are creating a new project management tool that integrates AI to streamline tasks and improve team communication. Seeking a senior product designer.',
        mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
        mediaType: 'video',
        thumbnailUrl: 'https://images.unsplash.com/photo-1500534623283-312aade485b7?q=80&w=1280&h=720&auto=format&fit=crop',
        stats: { likes: 87200, views: 42300000, comments: 11200 },
        category: 'Design',
        createdAt: new Date(),
        collabDetails: {
            roles: [
                {
                    title: 'Frontend Developer',
                    count: 1,
                    skills: ['React', 'TypeScript', 'Tailwind'],
                    responsibilities: 'Implement collaborative interfaces, canvas rendering, and responsive controls.'
                },
                {
                    title: 'Product Designer',
                    count: 1,
                    skills: ['Figma', 'UI/UX', 'Design Systems'],
                    responsibilities: 'Design intuitive workflows for real-time team collaboration.'
                }
            ],
            experience: 'Intermediate',
            background: 'Professional',
            availability: 'Flexible',
            location: 'Remote',
            collabTypes: ['Open Collaboration', 'Equity'],
            projectStatus: 'MVP',
        }
    },
    {
        id: 'collab2',
        author: { name: 'Julia Chen', avatarUrl: 'https://picsum.photos/id/26/200/200', isVerified: true },
        title: 'Decentralized Social Nexus',
        name: 'Decentralized Social Nexus',
        aiSummary: 'Seeking a Backend Dev for a new Social App.',
        oneLine: 'Seeking a Backend Dev for a new Social App.',
        hook: 'Seeking a Backend Dev for a new Social App.',
        description: 'We are building a decentralized social media platform and need a skilled backend developer to help us with API design and database architecture. Join our mission to reshape social networking.',
        mediaUrl: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?q=80&w=1974&auto=format&fit=crop',
        mediaType: 'image',
        stats: { likes: 45000, views: 15000000, comments: 6500 },
        category: 'App Development',
        createdAt: new Date(),
        collabDetails: {
            roles: [
                {
                    title: 'Backend Developer',
                    count: 1,
                    skills: ['Go', 'PostgreSQL', 'Distributed Systems'],
                    responsibilities: 'Architect high-throughput event queues, database sharding, and API endpoints.'
                }
            ],
            experience: 'Advanced',
            background: 'Professional',
            availability: 'Part-Time',
            location: 'Remote',
            collabTypes: ['Equity', 'Open Collaboration'],
            projectStatus: 'Prototype',
        }
    },
    {
        id: 'collab3',
        author: { name: 'QuantumLeap AI', avatarUrl: 'https://picsum.photos/id/27/200/200', isVerified: true },
        title: 'Quantum Alpha Predictor',
        name: 'Quantum Alpha Predictor',
        aiSummary: 'Data Scientist needed for an ML project.',
        oneLine: 'Data Scientist needed for an ML project.',
        hook: 'Data Scientist needed for an ML project.',
        description: 'Join QuantumLeap AI to work on a cutting-edge project involving predictive modeling for financial markets. We are looking for an experienced data scientist with a passion for machine learning.',
        mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
        mediaType: 'video',
        thumbnailUrl: 'https://images.unsplash.com/photo-1589762179979-0d8312d13b5a?q=80&w=1280&h=720&auto=format&fit=crop',
        stats: { likes: 125000, views: 62000000, comments: 21000 },
        category: 'Machine Learning',
        createdAt: new Date(),
        collabDetails: {
            roles: [
                {
                    title: 'ML Engineer',
                    count: 1,
                    skills: ['Python', 'PyTorch', 'Time Series', 'Financial Modeling'],
                    responsibilities: 'Fine-tune predictive algorithms on high-frequency time series data.'
                }
            ],
            experience: 'Advanced',
            background: 'Researcher',
            availability: 'Full-Time',
            location: 'Remote',
            collabTypes: ['Paid'],
            projectStatus: 'Active Project',
        }
    },
    {
        id: 'collab4',
        author: { name: 'Creative Studio', avatarUrl: 'https://picsum.photos/id/28/200/200' },
        title: 'LuxeCart Commerce',
        name: 'LuxeCart Commerce',
        aiSummary: 'UI/UX Designer for an exciting e-commerce platform.',
        oneLine: 'UI/UX Designer for an exciting e-commerce platform.',
        hook: 'UI/UX Designer for an exciting e-commerce platform.',
        description: 'We are looking for a creative UI/UX designer to revamp our e-commerce platform. You will be responsible for creating a visually appealing and user-friendly experience for millions of users.',
        mediaUrl: 'https://images.unsplash.com/photo-1487017159836-4e23ece2e4cf?q=80&w=2071&auto=format&fit=crop',
        mediaType: 'image',
        stats: { likes: 68000, views: 28000000, comments: 9800 },
        category: 'Design',
        createdAt: new Date(),
        collabDetails: {
            roles: [
                {
                    title: 'UI/UX Designer',
                    count: 1,
                    skills: ['Figma', 'Design Systems', 'Responsive Web'],
                    responsibilities: 'Design modern, conversion-optimized storefront interfaces and checkout flows.'
                }
            ],
            experience: 'Intermediate',
            background: 'Creator',
            availability: 'Flexible',
            location: 'Anywhere',
            collabTypes: ['Open Collaboration'],
            projectStatus: 'Early Concept',
        }
    }
];

const mockActivePings: ActivePing[] = [
    { id: 'p1', name: 'Apple Company', avatarUrl: 'https://picsum.photos/seed/apple/200', message: 'Hello, we are impressed with your profile.', timestamp: 'Yesterday', unreadCount: 1, type: 'Full-Time' },
    { id: 'p2', name: 'Mia Morris', avatarUrl: 'https://picsum.photos/seed/mia/200', message: 'Invitation to connect.', timestamp: 'Yesterday', unreadCount: 1, type: 'Invites' },
    { id: 'p3', name: 'Joe Root', avatarUrl: 'https://picsum.photos/seed/joe/200', message: 'Quick gig for you.', timestamp: 'Yesterday', unreadCount: 1, type: 'Gigs' },
    { id: 'p4', name: 'Facebook', avatarUrl: 'https://picsum.photos/seed/facebook/200', message: 'Regarding your application...', timestamp: 'Yesterday', unreadCount: 1, type: 'Others' },
    { id: 'p5', name: 'Google', avatarUrl: 'https://picsum.photos/seed/google/200', message: 'Re: Project X - Follow up', timestamp: '2 days ago', unreadCount: 3, type: 'Full-Time' },
    { id: 'p6', name: 'Netflix', avatarUrl: 'https://picsum.photos/seed/netflix/200', message: 'Your profile caught our eye.', timestamp: '3 days ago', unreadCount: 0, type: 'Full-Time' },
    { id: 'p7', name: 'OpenAI', avatarUrl: 'https://picsum.photos/seed/openai/200', message: 'Collaboration opportunity', timestamp: '3 days ago', unreadCount: 2, type: 'Gigs' },
    { id: 'p8', name: 'Chris Lattner', avatarUrl: 'https://picsum.photos/seed/chris/200', message: 'Let\'s talk about Mojo.', timestamp: '4 days ago', unreadCount: 0, type: 'Invites' },
    { id: 'p9', name: 'Stripe', avatarUrl: 'https://picsum.photos/seed/stripe/200', message: 'We have an opening for a Senior Engineer.', timestamp: '4 days ago', unreadCount: 1, type: 'Full-Time' },
    { id: 'p10', name: 'Figma', avatarUrl: 'https://picsum.photos/seed/figma/200', message: 'Design Gigs Available', timestamp: '5 days ago', unreadCount: 0, type: 'Gigs' },
    { id: 'p11', name: 'Vercel', avatarUrl: 'https://picsum.photos/seed/vercel/200', message: 'Next.js Conf Invite', timestamp: '5 days ago', unreadCount: 1, type: 'Invites' },
    { id: 'p12', name: 'Amazon', avatarUrl: 'https://picsum.photos/seed/amazon/200', message: 'Interview Schedule', timestamp: '6 days ago', unreadCount: 0, type: 'Full-Time' },
    { id: 'p13', name: 'Community Bot', avatarUrl: 'https://picsum.photos/seed/bot/200', message: 'Welcome to the AI ClubTech community!', timestamp: '1 week ago', unreadCount: 0, type: 'Others' },
];

const mockOffers: Offer[] = [
    { id: 'ft-new-1', companyName: 'Google', companyAvatarUrl: 'https://picsum.photos/seed/google/200', title: 'Senior Frontend Engineer', description: 'Join the team building the next generation of web applications that will be used by billions of users worldwide. We are looking for a passionate engineer with experience in React, TypeScript, and modern web technologies. You will be responsible for designing, developing, and deploying user-facing features for one of our flagship products. This is a unique opportunity to make a massive impact and work with a world-class team of engineers and designers. This is a unique opportunity to make a massive impact and work with a world-class team of engineers and designers.', status: 'New', type: 'Full-Time', createdAt: '2 days ago', location: 'Mountain View, CA', skills: ['React', 'TypeScript', 'JavaScript', 'CSS', 'HTML'], category: 'Web Development', experienceLevel: 'Senior' },
    { id: 'ft-new-2', companyName: 'Stripe', companyAvatarUrl: 'https://picsum.photos/seed/stripe/200', title: 'Senior Backend Engineer', description: 'We are looking for a skilled backend engineer to join our core payments infrastructure team. Help us build the future of online commerce. You will be working with a highly scalable and resilient system that processes billions of dollars in transactions every year. Experience with distributed systems, reliability, and high-performance computing is highly valued.', status: 'New', type: 'Full-Time', createdAt: '4 days ago', location: 'Remote', skills: ['Go', 'Ruby', 'Distributed Systems', 'API Design'], category: 'Backend', experienceLevel: 'Senior' },
    { id: 'ft-active-1', companyName: 'Facebook', companyAvatarUrl: 'https://picsum.photos/seed/facebook/200', title: 'Product Manager, AI', description: 'Lead the product vision for our new AI-powered tools that will connect the world.', status: 'Active', type: 'Full-Time', createdAt: '1 week ago', acceptedAt: '6 days ago', location: 'Menlo Park, CA', skills: ['Product Management', 'AI/ML', 'User Research'], category: 'Product Management', experienceLevel: 'Mid', hasNewMessage: true },
    { id: 'ft-expired-1', companyName: 'Amazon', companyAvatarUrl: 'https://picsum.photos/seed/amazon/200', title: 'Cloud Solutions Architect', description: 'Design and implement scalable cloud infrastructure for our top-tier clients.', status: 'Expired', type: 'Full-Time', createdAt: '1 month ago', location: 'Seattle, WA', skills: ['AWS', 'Architecture', 'Cloud Computing'], category: 'Cloud Computing', experienceLevel: 'Senior' },
    { id: 'inv-new-1', companyName: 'Ada Lovelace', companyAvatarUrl: 'https://picsum.photos/seed/ada/200', title: 'Invitation to Connect', description: 'Would love to connect and discuss your work in ethical AI.', status: 'New', type: 'Invites', createdAt: '1 day ago', location: 'Collaboration', skills: ['Ethical AI', 'Research', 'Speaking'], category: 'Ethical AI', experienceLevel: 'Senior' },
    { id: 'inv-active-1', companyName: 'Vercel', companyAvatarUrl: 'https://picsum.photos/seed/vercel/200', title: 'Next.js Conf Invite', description: 'We would like to invite you as a speaker to our upcoming conference.', status: 'Active', type: 'Invites', createdAt: '5 days ago', acceptedAt: '4 days ago', location: 'Online', skills: ['Next.js', 'Public Speaking'], category: 'Web Development', experienceLevel: 'Mid' },
    { id: 'gig-new-1', companyName: 'OpenAI', companyAvatarUrl: 'https://picsum.photos/seed/openai/200', title: 'Short-term ML Contract', description: 'We need an expert to help fine-tune a language model for a specific domain. 3-month contract.', status: 'New', type: 'Gigs', createdAt: '4 days ago', location: 'Remote', skills: ['PyTorch', 'Fine-tuning', 'NLP'], category: 'Machine Learning', experienceLevel: 'Senior' },
    { id: 'gig-active-1', companyName: 'Figma', companyAvatarUrl: 'https://picsum.photos/seed/figma/200', title: 'UI/UX Design for a new feature', description: 'Design the user flow and interface for our upcoming collaboration feature.', status: 'Active', type: 'Gigs', createdAt: '2 weeks ago', acceptedAt: '12 days ago', location: 'Remote', skills: ['Figma', 'UI Design', 'UX Design'], category: 'Design', experienceLevel: 'Mid', hasNewMessage: true },
    { id: 'oth-new-1', companyName: 'Community Bot', companyAvatarUrl: 'https://picsum.photos/seed/bot/200', title: 'Community Guideline Update', description: 'Please review the updated community guidelines for AI ClubTech.', status: 'New', type: 'Others', createdAt: '6 hours ago', location: 'Community', skills: ['Community Management'], category: 'Community Management', experienceLevel: 'Entry' },
];

const categoryFilters = ['All', 'Machine Learning', 'App Development', 'Design', 'Web3', 'Cybersecurity', 'Fintech', 'Hardware', 'Gaming', 'UI/UX'];

const spotlightDomains = [
    { name: 'Machine Learning', icon: SparklesIcon },
    { name: 'App Development', icon: CodeBracketIcon },
    { name: 'Design', icon: PencilSquareIcon },
    { name: 'Web3', icon: LinkIcon },
    { name: 'Cybersecurity', icon: ShieldCheckIcon },
    { name: 'Fintech', icon: CurrencyDollarIcon },
    { name: 'Hardware', icon: CubeIcon },
    { name: 'Gaming', icon: CubeIcon },
    { name: 'UI/UX', icon: PencilSwooshIcon },
];

interface Suggestion {
  id: string;
  author: {
    name: string;
    isVerified?: boolean;
    avatarUrl?: string;
    id?: string;
    uid?: string;
    username?: string;
  };
  title?: string;
  name?: string;
  hook?: string;
  oneLine?: string;
  description: string;
  imageUrl: string;
  upvotes: number;
}

interface SuggestionCategory {
  category: string;
  projects: Suggestion[];
}

const suggestionData: SuggestionCategory[] = [
    {
        category: 'UI & UX Design',
        projects: [
            {
                id: 'mux-1',
                author: { name: 'Music Haze', isVerified: true },
                title: 'Music Haze Streaming UI',
                hook: 'A visually stunning and modern UI for next-generation music streaming.',
                description: 'A visually stunning and modern UI for a music streaming app.',
                imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=2070&auto=format&fit=crop',
                upvotes: 15200,
            },
            {
                id: 'fin-1',
                author: { name: 'Fintech Solutions' },
                title: 'Apex Fintech Dashboard',
                hook: 'Sleek and professional dashboard for a modern fintech platform.',
                description: 'Sleek and professional dashboard for a new fintech platform.',
                imageUrl: 'https://images.unsplash.com/photo-1642139425433-e38000413346?q=80&w=1974&auto=format&fit=crop',
                upvotes: 12500,
            },
            {
                id: 'travel-1',
                author: { name: 'Wanderlust UI', isVerified: true },
                title: 'Wanderlust UI Explorer',
                hook: 'An inviting and user-friendly interface design for global travel planning.',
                description: 'An inviting and user-friendly design for a travel planning app.',
                imageUrl: 'https://images.unsplash.com/photo-1522199755839-a2bacb67c546?q=80&w=2072&auto=format&fit=crop',
                upvotes: 18900,
            },
            {
                id: 'health-1',
                author: { name: 'FitTrack', isVerified: true },
                title: 'FitTrack Pro Interface',
                hook: 'A clean and motivating UI for health, biometric, and fitness tracking.',
                description: 'A clean and motivating UI for a health and fitness tracking app.',
                imageUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?q=80&w=2070&auto=format&fit=crop',
                upvotes: 16400,
            },
            {
                id: 'realestate-1',
                author: { name: 'PropDash' },
                title: 'PropDash Analytics',
                hook: 'An intuitive dashboard for real estate analytics and property management.',
                description: 'An intuitive dashboard for real estate analytics and property management.',
                imageUrl: 'https://images.unsplash.com/photo-1560518883-ce09059ee41F?q=80&w=1973&auto=format&fit=crop',
                upvotes: 11800,
            },
        ],
    },
    {
        category: 'Graphic Design',
        projects: [
            {
                id: 'egd-1',
                author: { name: 'Elegant Mind', isVerified: true },
                title: 'Elegant Mind Surreal Series',
                hook: 'A surreal and elegant digital artwork series exploring human perception.',
                description: 'A surreal and elegant artwork for a project named Elegant Mind.',
                imageUrl: 'https://images.unsplash.com/photo-1535378620166-273708d44e4c?q=80&w=1964&auto=format&fit=crop',
                upvotes: 21000,
            },
            {
                id: 'brand-1',
                author: { name: 'Urban Coffee Co.' },
                title: 'Urban Coffee Identity System',
                hook: 'A comprehensive branding identity system for a modern specialty coffee shop.',
                description: 'A comprehensive branding identity for a modern coffee shop.',
                imageUrl: 'https://images.unsplash.com/photo-1511920183234-52d34ba2d781?q=80&w=1974&auto=format&fit=crop',
                upvotes: 9800,
            },
            {
                id: 'poster-1',
                author: { name: 'Abstract Forms', isVerified: true },
                title: 'Abstract Geometric Forms',
                hook: 'Minimalist poster designs exploring geometric tension and negative space.',
                description: 'A series of abstract and minimalist poster designs exploring geometric forms.',
                imageUrl: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=2070&auto=format&fit=crop',
                upvotes: 11300,
            },
            {
                id: 'album-1',
                author: { name: 'Vinyl Dreams', isVerified: true },
                title: 'Vinyl Dreams Album Art',
                hook: 'Vibrant and retro-inspired album cover artwork for an indie music collective.',
                description: 'Vibrant and retro-inspired album cover art for an indie band.',
                imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1974&auto=format&fit=crop',
                upvotes: 14500,
            },
            {
                id: 'book-1',
                author: { name: 'Page Turner' },
                title: 'Page Turner Fantasy Cover',
                hook: 'A captivating and immersive book cover design for an epic fantasy novel.',
                description: 'A captivating book cover design for a fantasy novel.',
                imageUrl: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=1974&auto=format&fit=crop',
                upvotes: 8900,
            },
        ],
    },
    {
        category: '3D Art',
        projects: [
            {
                id: 'scifi-1',
                author: { name: 'Cyber Visions', isVerified: true },
                title: 'Cyber Visions Cyborg Explorer',
                hook: 'A highly detailed 3D sci-fi character model crafted with real-time shaders.',
                description: 'A highly detailed 3D model of a sci-fi character, a cyborg explorer.',
                imageUrl: 'https://images.unsplash.com/photo-1690575317136-234288b8e0a2?q=80&w=1964&auto=format&fit=crop',
                upvotes: 25600,
            },
            {
                id: 'arch-1',
                author: { name: 'Modern Structures' },
                title: 'Modern Villa ArchViz',
                hook: 'Photorealistic architectural visualization of a modern minimalist villa.',
                description: 'A photorealistic architectural visualization of a modern house.',
                imageUrl: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?q=80&w=1974&auto=format&fit=crop',
                upvotes: 19400,
            },
            {
                id: 'fantasy-1',
                author: { name: 'DreamScapes' },
                title: 'Floating Isles of DreamScapes',
                hook: 'An enchanting 3D procedural render of mythical floating island geography.',
                description: 'An enchanting 3D render of a magical, floating island landscape.',
                imageUrl: 'https://images.unsplash.com/photo-16179354493866-df529a6d4b29?q=80&w=2070&auto=format&fit=crop',
                upvotes: 22300,
            },
            {
                id: 'product-1',
                author: { name: 'Precision Renders', isVerified: true },
                title: 'Chronos Luxury Timepiece',
                hook: 'A luxury 3D product render showcasing precision horology and material physics.',
                description: 'A stunning 3D product visualization of a luxury timepiece.',
                imageUrl: 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?q=80&w=2080&auto=format&fit=crop',
                upvotes: 18700,
            },
             {
                id: 'char-1',
                author: { name: 'Creature Forge' },
                title: 'Creature Forge Animated Hero',
                hook: 'A whimsical 3D stylized character design created for an animated feature.',
                description: 'A whimsical 3D character design for an animated short film.',
                imageUrl: 'https://images.unsplash.com/photo-1534723452862-4c874018d66d?q=80&w=1964&auto=format&fit=crop',
                upvotes: 17200,
            },
        ],
    },
    {
        category: 'Web Development',
        projects: [
             {
                id: 'ecom-1',
                author: { name: 'SustainaWear', isVerified: true },
                title: 'SustainaWear Fashion Store',
                hook: 'A clean and sustainable fashion e-commerce storefront with fluid checkout.',
                description: 'A clean website design for an e-commerce store selling sustainable fashion.',
                imageUrl: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=2070&auto=format&fit=crop',
                upvotes: 16700,
            },
            {
                id: 'portfolio-1',
                author: { name: 'Digital Artist X' },
                title: 'Digital Artist Spatial Portfolio',
                hook: 'An interactive, WebGL-enhanced portfolio website for creative artists.',
                description: 'An interactive and visually engaging portfolio website for a digital artist.',
                imageUrl: 'https://images.unsplash.com/photo-1496171367470-9ed9a91ea931?q=80&w=2070&auto=format&fit=crop',
                upvotes: 14200,
            },
            {
                id: 'blog-1',
                author: { name: 'The Scribe' },
                title: 'The Scribe Editorial Platform',
                hook: 'A modern, distraction-free front-end for thoughtful long-form publishing.',
                description: 'A modern, minimalist front-end for a new blogging platform.',
                imageUrl: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?q=80&w=2070&auto=format&fit=crop',
                upvotes: 11500,
            },
            {
                id: 'saas-1',
                author: { name: 'CloudFlow', isVerified: true },
                title: 'CloudFlow Infrastructure Portal',
                hook: 'A high-converting landing page and cloud orchestration interface.',
                description: 'A compelling and high-converting landing page for a SaaS product.',
                imageUrl: 'https://images.unsplash.com/photo-1559028006-44d08c21a488?q=80&w=1974&auto=format&fit=crop',
                upvotes: 19800,
            },
            {
                id: 'corp-1',
                author: { name: 'Innovate Corp' },
                title: 'Innovate Corp Enterprise Web',
                hook: 'A sleek corporate digital experience highlighting brand narrative.',
                description: 'A professional and sleek corporate website with a focus on brand storytelling.',
                imageUrl: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?q=80&w=2232&auto=format&fit=crop',
                upvotes: 13500,
            },
        ],
    },
];

export const suggestionProjects: Project[] = suggestionData.flatMap(cat => 
    cat.projects.map(p => ({
        id: p.id,
        authorId: `author_${p.id}`,
        author: {
            name: p.author.name,
            avatarUrl: p.imageUrl || `https://picsum.photos/seed/${p.id}/200`,
            isVerified: Boolean(p.author.isVerified),
            id: `author_${p.id}`,
            uid: `author_${p.id}`,
            username: p.author.name.toLowerCase().replace(/[^a-z0-9]/g, ''),
        },
        title: p.title || p.author.name,
        name: p.title || p.author.name,
        aiSummary: p.hook || p.description,
        oneLine: p.hook || p.description,
        hook: p.hook || p.description,
        description: p.description,
        mediaUrl: p.imageUrl,
        mediaType: 'image' as const,
        thumbnailUrl: p.imageUrl,
        category: cat.category,
        domain: cat.category,
        tags: [cat.category.replace(/[^a-zA-Z0-9]/g, '')],
        stats: {
            likes: p.upvotes,
            views: p.upvotes * 3,
            comments: Math.round(p.upvotes * 0.05),
        },
        likeCount: p.upvotes,
        viewCount: p.upvotes * 3,
        commentCount: Math.round(p.upvotes * 0.05),
        createdAt: new Date(),
    }))
);

interface ProfileSuggestion {
  id: string;
  author: {
    name: string;
    isVerified?: boolean;
    avatarUrl: string;
  };
  description: string;
  stats: {
    projects: number;
    links: number;
  };
}

interface ProfileSuggestionCategory {
  category: string;
  profiles: ProfileSuggestion[];
}

const profileSuggestionData: ProfileSuggestionCategory[] = [
    {
        category: 'Machine Learning & AI',
        profiles: [
            {
                id: 'p-ml-1',
                author: { name: 'Michael', isVerified: true, avatarUrl: 'https://picsum.photos/seed/michael/200' },
                description: 'Here Comes The Description Of The Profile Lorem Ipsum Dolor Sit Amet, Consectetur',
                stats: { projects: 150, links: 11000 },
            },
            {
                id: 'p-ml-2',
                author: { name: 'Sarah Lee', isVerified: true, avatarUrl: 'https://picsum.photos/seed/sarah/200' },
                description: 'AI Ethicist & Researcher. Focused on building fair and transparent machine learning models.',
                stats: { projects: 42, links: 23000 },
            },
            {
                id: 'p-ml-3',
                author: { name: 'David Chen', isVerified: false, avatarUrl: 'https://picsum.photos/seed/david/200' },
                description: 'Data Scientist specializing in NLP and large language models. Always learning.',
                stats: { projects: 88, links: 8500 },
            },
            {
                id: 'p-ml-4',
                author: { name: 'Alex Johnson', isVerified: false, avatarUrl: 'https://picsum.photos/seed/alexj/200' },
                description: 'Computer Vision Engineer working on autonomous systems and image recognition.',
                stats: { projects: 65, links: 7200 },
            },
            {
                id: 'p-ml-5',
                author: { name: 'Maria Rodriguez', isVerified: true, avatarUrl: 'https://picsum.photos/seed/maria/200' },
                description: 'MLOps expert, streamlining the deployment and monitoring of machine learning models at scale.',
                stats: { projects: 110, links: 19000 },
            },
        ],
    },
    {
        category: 'Web Development',
        profiles: [
            {
                id: 'p-wd-1',
                author: { name: 'Jessica Wang', isVerified: true, avatarUrl: 'https://picsum.photos/seed/jessica/200' },
                description: 'Full-stack developer with a passion for creating beautiful and functional web applications.',
                stats: { projects: 210, links: 15000 },
            },
            {
                id: 'p-wd-2',
                author: { name: 'Tom Smith', isVerified: false, avatarUrl: 'https://picsum.photos/seed/tom/200' },
                description: 'Frontend wizard. React, Vue, and Svelte enthusiast. Making the web a better place, one component at a time.',
                stats: { projects: 125, links: 5400 },
            },
            {
                id: 'p-wd-3',
                author: { name: 'Chris Green', isVerified: false, avatarUrl: 'https://picsum.photos/seed/chrisg/200' },
                description: 'DevOps & Backend Engineer specializing in cloud infrastructure and scalability.',
                stats: { projects: 150, links: 12000 },
            },
            {
                id: 'p-wd-4',
                author: { name: 'Patricia Miller', isVerified: true, avatarUrl: 'https://picsum.photos/seed/patricia/200' },
                description: 'Specialist in Web Accessibility (a11y) and inclusive design practices.',
                stats: { projects: 80, links: 25000 },
            },
            {
                id: 'p-wd-5',
                author: { name: 'Kevin White', isVerified: false, avatarUrl: 'https://picsum.photos/seed/kevinw/200' },
                description: 'Building immersive 3D experiences on the web with WebGL and Three.js.',
                stats: { projects: 55, links: 9800 },
            },
        ],
    },
    {
        category: 'Design & UX',
        profiles: [
            {
                id: 'p-ds-1',
                author: { name: 'Emily Carter', isVerified: true, avatarUrl: 'https://picsum.photos/seed/emily/200' },
                description: 'Product Designer focused on user-centered design and creating intuitive digital experiences.',
                stats: { projects: 95, links: 32000 },
            },
            {
                id: 'p-ds-2',
                author: { name: 'Ben Adams', isVerified: false, avatarUrl: 'https://picsum.photos/seed/ben/200' },
                description: 'UI/UX Designer who loves crafting pixel-perfect interfaces and seamless user flows.',
                stats: { projects: 73, links: 18000 },
            },
            {
                id: 'p-ds-3',
                author: { name: 'Laura Wilson', isVerified: true, avatarUrl: 'https://picsum.photos/seed/lauraw/200' },
                description: 'UX Researcher with a focus on qualitative user studies and product strategy.',
                stats: { projects: 50, links: 15000 },
            },
            {
                id: 'p-ds-4',
                author: { name: 'James Taylor', isVerified: false, avatarUrl: 'https://picsum.photos/seed/jamest/200' },
                description: 'Motion Designer crafting engaging animations and micro-interactions for digital products.',
                stats: { projects: 120, links: 22000 },
            },
            {
                id: 'p-ds-5',
                author: { name: 'Sophia Martinez', isVerified: true, avatarUrl: 'https://picsum.photos/seed/sophiam/200' },
                description: 'Design Systems Architect, building scalable and consistent UI libraries.',
                stats: { projects: 65, links: 29000 },
            },
        ],
    },
    {
        category: 'Cybersecurity',
        profiles: [
            {
                id: 'p-cs-1',
                author: { name: 'Robert Moore', isVerified: true, avatarUrl: 'https://picsum.photos/seed/robertm/200' },
                description: 'Ethical Hacker and Security Analyst. Protecting digital assets from threats.',
                stats: { projects: 130, links: 45000 },
            },
            {
                id: 'p-cs-2',
                author: { name: 'Linda Jackson', isVerified: false, avatarUrl: 'https://picsum.photos/seed/lindaj/200' },
                description: 'Cryptography expert focusing on secure communication protocols.',
                stats: { projects: 35, links: 18000 },
            },
            {
                id: 'p-cs-3',
                author: { name: 'William Hill', isVerified: true, avatarUrl: 'https://picsum.photos/seed/williamh/200' },
                description: 'Cloud Security Architect. Securing infrastructure on AWS, Azure, and GCP.',
                stats: { projects: 95, links: 31000 },
            },
            {
                id: 'p-cs-4',
                author: { name: 'Barbara Harris', isVerified: false, avatarUrl: 'https://picsum.photos/seed/barbarah/200' },
                description: 'Digital Forensics Investigator, uncovering evidence from digital trails.',
                stats: { projects: 75, links: 11000 },
            },
            {
                id: 'p-cs-5',
                author: { name: 'Charles Clark', isVerified: true, avatarUrl: 'https://picsum.photos/seed/charlesc/200' },
                description: 'Application Security Engineer, finding and fixing vulnerabilities in software.',
                stats: { projects: 155, links: 24000 },
            },
        ],
    },
    {
        category: 'Fintech',
        profiles: [
            {
                id: 'p-ft-1',
                author: { name: 'Nancy Lewis', isVerified: true, avatarUrl: 'https://picsum.photos/seed/nancyl/200' },
                description: 'Building the future of finance with blockchain and decentralized applications.',
                stats: { projects: 80, links: 50000 },
            },
            {
                id: 'p-ft-2',
                author: { name: 'Paul Walker', isVerified: false, avatarUrl: 'https://picsum.photos/seed/paulw/200' },
                description: 'Quantitative Analyst developing algorithmic trading strategies.',
                stats: { projects: 60, links: 22000 },
            },
            {
                id: 'p-ft-3',
                author: { name: 'Karen Allen', isVerified: true, avatarUrl: 'https://picsum.photos/seed/karena/200' },
                description: 'Product Manager for a leading digital banking platform.',
                stats: { projects: 115, links: 38000 },
            },
            {
                id: 'p-ft-4',
                author: { name: 'Mark Young', isVerified: false, avatarUrl: 'https://picsum.photos/seed/marky/200' },
                description: 'Developing secure and scalable payment gateway solutions.',
                stats: { projects: 140, links: 19000 },
            },
            {
                id: 'p-ft-5',
                author: { name: 'Betty Wright', isVerified: true, avatarUrl: 'https://picsum.photos/seed/bettyw/200' },
                description: 'Compliance and RegTech specialist, navigating the complex world of financial regulations.',
                stats: { projects: 45, links: 33000 },
            },
        ],
    },
];

const pinnedUserNames = [
    'Elon Musk',
    'Satya Nadella',
    'Ada Lovelace',
    'Crash Adams',
    'Marco Rossi',
    'Dr. Evelyn Reed',
    'Chloe Bennet',
    'Liam Johnson',
    'Mc Benny',
    'Julia Chen',
];

const SuggestionCardSkeleton = () => (
    <div className="bg-[#0c0c0e] p-4 border border-zinc-800 flex gap-4 min-h-48 animate-pulse">
        <div className="flex-1 flex flex-col">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-zinc-800"></div>
                <div className="h-4 w-24 bg-zinc-800"></div>
            </div>
            <div className="mt-3 space-y-2 flex-grow">
                <div className="h-4 w-full bg-zinc-800"></div>
                <div className="h-4 w-5/6 bg-zinc-800"></div>
            </div>
            <div className="h-4 w-20 bg-zinc-800 mt-3"></div>
        </div>
        <div className="w-40 h-40 bg-zinc-800 self-center"></div>
    </div>
);

const ProfileSuggestionCardSkeleton = () => (
    <div className="bg-[#0c0c0e] p-4 border border-zinc-800 flex flex-col min-h-48 animate-pulse">
        <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-zinc-800"></div>
                <div className="h-6 w-24 bg-zinc-800"></div>
            </div>
            <div className="w-24 h-8 bg-zinc-800"></div>
        </div>
        <div className="flex-grow space-y-2">
            <div className="h-4 w-full bg-zinc-800"></div>
            <div className="h-4 w-5/6 bg-zinc-800"></div>
        </div>
        <div className="flex justify-between items-center mt-auto pt-3">
            <div className="h-4 w-20 bg-zinc-800"></div>
            <div className="h-4 w-20 bg-zinc-800"></div>
        </div>
    </div>
);

const MediaPlaceholder: React.FC<{ thumbnailUrl?: string; isVideo: boolean }> = ({ thumbnailUrl, isVideo }) => {
    if (isVideo && thumbnailUrl) {
        return (
            <>
                <img src={thumbnailUrl} onError={handleImageError} alt="Video poster" className="w-full h-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
                     <div className="w-16 h-16 bg-black/80 border border-zinc-700 flex items-center justify-center backdrop-blur-sm">
                        <PlayIcon className="w-8 h-8 text-white" />
                    </div>
                </div>
            </>
        );
    }
    return <div className="w-full h-full bg-zinc-900"></div>;
};

const MessagingModal: React.FC<{
  onClose: () => void;
  offer: Offer;
  onView: () => void;
  showViewButton: boolean;
}> = ({ onClose, offer, onView, showViewButton }) => {
    interface ChatMessage {
        role: 'user' | 'recipient';
        text: string;
    }

    const [messages, setMessages] = useState<ChatMessage[]>([
        { role: 'recipient', text: `Hello from ${offer.companyName}! How can we assist you today?` }
    ]);
    const [input, setInput] = useState('');
    const [isReplying, setIsReplying] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [isInfoVisible, setIsInfoVisible] = useState(false);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    const handleSend = async () => {
        if (input.trim() === '' || isReplying) return;

        const userMessage: ChatMessage = { role: 'user', text: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsReplying(true);

        setTimeout(() => {
            const replyMessage: ChatMessage = { role: 'recipient', text: "Thank you for your message. We have received it and a representative will get back to you shortly." };
            setMessages(prev => [...prev, replyMessage]);
            setIsReplying(false);
        }, 1500);
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-[#0c0c0e] border border-zinc-800 shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col p-5" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center pb-3 border-b border-zinc-800">
                    <div className="flex items-center gap-3">
                        <img src={offer.companyAvatarUrl} onError={handleImageError} alt={offer.companyName} className="w-9 h-9 border border-zinc-700 object-cover" />
                        <div>
                            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 block">// DIRECT_COMMS</span>
                            <h2 className="text-base font-bold font-mono text-white">{isInfoVisible ? "OFFER_SPECIFICATION" : offer.companyName}</h2>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {showViewButton && (
                            <button
                                onClick={() => setIsInfoVisible(!isInfoVisible)}
                                className="p-1.5 text-zinc-400 hover:text-white hover:border-zinc-600 border border-zinc-800 transition-colors"
                                aria-label={isInfoVisible ? "Back to chat" : "View offer information"}
                            >
                               {isInfoVisible ? <ChatIcon className="w-5 h-5" /> : <InformationCircleIcon className="w-5 h-5" />}
                            </button>
                        )}
                        <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-600 transition-colors" aria-label="Close modal">
                            <CloseIcon />
                        </button>
                    </div>
                </div>

                {isInfoVisible ? (
                    <div className="flex-grow overflow-y-auto pr-2 space-y-6 text-zinc-300 p-4 bg-black border border-zinc-800 my-4">
                        {/* Main Role Info */}
                        <div className="pb-4 border-b border-zinc-800">
                            <div className="flex items-start gap-4">
                                <img src={offer.companyAvatarUrl} onError={handleImageError} alt={offer.companyName} className="w-12 h-12 border border-zinc-700 object-cover" />
                                <div>
                                    <h3 className="text-xl font-bold font-mono text-white leading-tight">{offer.title}</h3>
                                    <p className="text-zinc-400 font-mono text-sm">{offer.companyName}</p>
                                </div>
                            </div>
                        </div>

                        {/* Job Details Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
                            <div className="flex items-start gap-3 bg-zinc-950 p-3 border border-zinc-800/80">
                                <CubeIcon className="w-4 h-4 text-zinc-500 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-[10px] uppercase text-zinc-500 tracking-wider">Job Type</p>
                                    <p className="font-semibold text-white mt-0.5">{offer.type}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 bg-zinc-950 p-3 border border-zinc-800/80">
                                <MapPinIcon className="w-4 h-4 text-zinc-500 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-[10px] uppercase text-zinc-500 tracking-wider">Location</p>
                                    <p className="font-semibold text-white mt-0.5">{offer.location || 'N/A'}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 bg-zinc-950 p-3 border border-zinc-800/80">
                                <AcademicCapIcon className="w-4 h-4 text-zinc-500 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-[10px] uppercase text-zinc-500 tracking-wider">Experience Level</p>
                                    <p className="font-semibold text-white mt-0.5">{offer.experienceLevel || 'N/A'}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 bg-zinc-950 p-3 border border-zinc-800/80">
                                <CubeIcon className="w-4 h-4 text-zinc-500 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-[10px] uppercase text-zinc-500 tracking-wider">Category</p>
                                    <p className="font-semibold text-white mt-0.5">{offer.category || 'N/A'}</p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="border-t border-zinc-800" />

                        {/* Description */}
                        <div>
                            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 block mb-2">// DESCRIPTION</span>
                            <p className="whitespace-pre-wrap leading-relaxed text-xs text-zinc-300 font-mono">{offer.description}</p>
                        </div>

                        {/* Skills */}
                        {offer.skills && offer.skills.length > 0 && (
                            <div>
                                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 block mb-2">// REQUIRED_SKILLS</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {offer.skills.map(skill => (
                                        <span key={skill} className="bg-zinc-900 text-zinc-300 px-2.5 py-1 text-[11px] font-mono border border-zinc-800">
                                            {skill}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        {(offer.createdAt || offer.acceptedAt) && (
                            <div>
                                <div className="border-t border-zinc-800 my-3" />
                                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 block mb-2">// TIMELINE</span>
                                <div className="space-y-2 font-mono text-xs">
                                    {offer.createdAt && (
                                        <div className="flex items-center gap-2 text-zinc-400">
                                            <CalendarDaysIcon className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                                            <span>Received: <span className="text-white">{offer.createdAt}</span></span>
                                        </div>
                                    )}
                                    {offer.acceptedAt && (
                                        <div className="flex items-center gap-2 text-zinc-400">
                                            <CalendarDaysIcon className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                                            <span>Accepted: <span className="text-white">{offer.acceptedAt}</span></span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex-grow overflow-y-auto pr-2 space-y-3 my-4">
                        {messages.map((msg, index) => (
                            <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-md p-3 font-mono text-xs ${msg.role === 'user' ? 'bg-white text-black font-semibold' : 'bg-zinc-900 border border-zinc-800 text-zinc-300'}`}>
                                    <p>{msg.text}</p>
                                </div>
                            </div>
                        ))}
                        {isReplying && (
                            <div className="flex justify-start">
                                <div className="p-3 bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono text-xs flex items-center gap-2">
                                    <span>Incoming</span>
                                    <div className="flex items-center space-x-1">
                                        <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-pulse"></div>
                                        <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-pulse delay-150"></div>
                                        <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-pulse delay-300"></div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                )}
                
                {!isInfoVisible && (
                    <div className="pt-3 border-t border-zinc-800 flex gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Type a message..."
                            className="flex-grow bg-black border border-zinc-800 p-2.5 font-mono text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                            disabled={isReplying}
                        />
                        <button 
                            onClick={handleSend} 
                            disabled={isReplying || !input.trim()} 
                            className="bg-white text-black px-4 font-mono text-xs font-bold uppercase hover:bg-zinc-200 disabled:opacity-40 disabled:hover:bg-white flex items-center justify-center transition-colors"
                        >
                            <SendIcon className="w-4 h-4"/>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const ProjectCard: React.FC<{ project: Project }> = ({ project }) => {
    const { openModal } = useAIAssistant();
    const [showMore, setShowMore] = useState(false);
    const isVideo = project.mediaType === 'video';
    const videoRef = useRef<HTMLVideoElement>(null);
    const videoContainerRef = useRef<HTMLDivElement>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isControlsVisible, setIsControlsVisible] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    const playbackRates = [0.75, 1, 1.25, 1.5];
    const { isFullscreen, toggleFullscreen } = useFullscreen(videoContainerRef);
    const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);
    const [mediaContainerRef, isVisible] = useLazyLoad<HTMLDivElement>();
    
    const handleAIAssistantClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        openModal({
            id: project.id,
            title: project.aiSummary,
            content: project.description,
            author: project.author.name
        });
    };

    const togglePlayPause = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (videoRef.current) {
            if (videoRef.current.paused) {
                videoRef.current.play();
            } else {
                videoRef.current.pause();
            }
        }
    };
    
    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.playbackRate = playbackRate;
        }
    }, [playbackRate]);

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            setProgress(videoRef.current.currentTime);
        }
    };

    const handleLoadedMetadata = () => {
        if (videoRef.current) {
            setDuration(videoRef.current.duration);
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (videoRef.current) {
            videoRef.current.currentTime = Number(e.target.value);
            setProgress(Number(e.target.value));
        }
    };

    const handleProgressPointerDown = (e: React.PointerEvent<HTMLInputElement>) => {
        e.stopPropagation();
        if (videoRef.current) {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const width = rect.width;
            const duration = videoRef.current.duration;
            if (duration > 0) {
                const seekTime = (clickX / width) * duration;
                videoRef.current.currentTime = seekTime;
                setProgress(seekTime);
            }
        }
    };
    
    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = Number(e.target.value);
        if (videoRef.current) {
            videoRef.current.muted = false;
            setIsMuted(false);
            videoRef.current.volume = newVolume;
            setVolume(newVolume);
            if (newVolume === 0) {
                setIsMuted(true);
            }
        }
    };
    
    const toggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (videoRef.current) {
            const newMutedState = !videoRef.current.muted;
            videoRef.current.muted = newMutedState;
            if (!newMutedState && volume === 0) {
                setVolume(1);
                videoRef.current.volume = 1;
            }
        }
    };

    const formatTime = (timeInSeconds: number) => {
        if (isNaN(timeInSeconds) || timeInSeconds <= 0) return '00:00';
        const minutes = Math.floor(timeInSeconds / 60);
        const seconds = Math.floor(timeInSeconds % 60);
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    const toggleFullScreen = (e: React.MouseEvent) => {
        e.stopPropagation();
        toggleFullscreen();
    };

    const cyclePlaybackRate = (e: React.MouseEvent) => {
        e.stopPropagation();
        const currentIndex = playbackRates.indexOf(playbackRate);
        const nextIndex = (currentIndex + 1) % playbackRates.length;
        setPlaybackRate(playbackRates[nextIndex]);
    };

    return (
        <>
            <div className="bg-[#0c0c0e] border border-zinc-800 p-5 mb-4 hover:border-zinc-700 transition-colors">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <img src={project.author.avatarUrl} onError={handleImageError} alt={project.author.name} className="w-10 h-10 border border-zinc-750 object-cover" />
                        <div>
                            <div className="flex items-center gap-1.5">
                                <span className="font-mono font-bold text-sm text-white uppercase">{project.author.name}</span>
                                {project.author.isVerified && <CheckBadgeIcon className="w-4 h-4 text-zinc-400" />}
                            </div>
                            <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 block">{project.category}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-zinc-500">
                        <button onClick={handleAIAssistantClick} className="p-1.5 hover:text-white hover:border-zinc-600 border border-transparent transition-colors" title="AI Summary"><SparklesIcon className="w-5 h-5" /></button>
                        <button className="p-1.5 hover:text-white hover:border-zinc-600 border border-transparent transition-colors"><EllipsisVerticalIcon className="w-5 h-5" /></button>
                    </div>
                </div>
    
                {/* Content */}
                <div className="mt-3.5">
                    <p className="text-base font-mono text-zinc-100 font-semibold leading-snug">"{project.aiSummary}"</p>
                    <p className="text-xs font-mono text-zinc-400 mt-2 leading-relaxed">
                        {showMore ? project.description : `${project.description.substring(0, 150)}...`}
                        <button onClick={() => setShowMore(!showMore)} className="text-white font-mono text-xs underline ml-1.5 hover:text-zinc-300 cursor-pointer">
                            {showMore ? '[less]' : '[more]'}
                        </button>
                    </p>
                </div>
    
                {/* Media */}
                {project.mediaUrl && (
                     <div className="mt-4">
                        <AspectRatioBox
                            ref={mediaContainerRef}
                            ratio="video"
                            className={`border border-zinc-800 bg-black group ${!isVisible || (!isVideo ? 'cursor-zoom-in' : 'cursor-pointer')}`}
                            onMouseEnter={() => setIsControlsVisible(true)}
                            onMouseLeave={() => setIsControlsVisible(false)}
                            onClick={isVisible ? (isVideo ? togglePlayPause : () => setZoomedImageUrl(project.mediaUrl || null)) : undefined}
                        >
                            {isVisible ? (
                                isVideo ? (
                                    <>
                                        <video
                                            ref={videoRef}
                                            src={project.mediaUrl}
                                            poster={project.thumbnailUrl}
                                            onTimeUpdate={handleTimeUpdate}
                                            onLoadedMetadata={handleLoadedMetadata}
                                            onPlay={() => setIsPlaying(true)}
                                            onPause={() => setIsPlaying(false)}
                                            onEnded={() => setIsPlaying(false)}
                                            muted={isMuted}
                                            playsInline
                                            className="w-full h-full object-cover"
                                        />
                                        
                                        <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${!isPlaying ? 'opacity-100' : 'opacity-0'} bg-black/40 pointer-events-none`}>
                                            <div className="w-14 h-14 bg-black/80 border border-zinc-700 flex items-center justify-center backdrop-blur-sm">
                                                <PlayIcon className="w-7 h-7 text-white" />
                                            </div>
                                        </div>
                                        
                                        <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-3 transition-opacity duration-300 ${isControlsVisible || !isPlaying ? 'opacity-100' : 'opacity-0'}`} onClick={(e) => e.stopPropagation()}>
                                            <div className="w-full mb-2">
                                                 <input
                                                    type="range"
                                                    min="0"
                                                    max={duration || 0}
                                                    value={progress}
                                                    onChange={handleSeek}
                                                    onPointerDown={handleProgressPointerDown}
                                                    className="w-full h-1 bg-zinc-800 appearance-none cursor-pointer accent-white"
                                                />
                                            </div>
                                            <div className="flex items-center justify-between gap-4 text-white">
                                                <div className="flex items-center gap-3">
                                                    <button onClick={togglePlayPause} className="p-1 hover:text-zinc-300 transition-colors">
                                                        {isPlaying ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
                                                    </button>
                                                    <div className="flex items-center gap-2 group/volume">
                                                        <button onClick={toggleMute} className="p-1 hover:text-zinc-300 transition-colors">
                                                            {isMuted || volume === 0 ? <VolumeOffIcon className="w-5 h-5" /> : <VolumeUpIcon className="w-5 h-5" />}
                                                        </button>
                                                        <input
                                                            type="range"
                                                            min="0"
                                                            max="1"
                                                            step="0.01"
                                                            value={isMuted ? 0 : volume}
                                                            onChange={handleVolumeChange}
                                                            className="w-0 h-1 bg-zinc-800 appearance-none cursor-pointer accent-white transition-all duration-300 opacity-0 group-hover/volume:opacity-100 group-hover/volume:w-20"
                                                        />
                                                    </div>
                                                </div>
                                                
                                                <div className="flex items-center gap-2 font-mono text-xs">
                                                    <span className="text-zinc-400 w-24 text-center">{formatTime(progress)} / {formatTime(duration)}</span>
                                                    <button onClick={cyclePlaybackRate} className="font-bold w-12 text-center p-1 border border-zinc-800 bg-black/60 hover:border-zinc-600 transition-colors">
                                                        {playbackRate.toFixed(2)}x
                                                    </button>
                                                    <button onClick={toggleFullScreen} className="p-1 hover:text-zinc-300 transition-colors">
                                                        {isFullscreen ? <ArrowsPointingInIcon className="w-5 h-5" /> : <ArrowsPointingOutIcon className="w-5 h-5" />}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <img src={project.mediaUrl} onError={handleImageError} alt="Project visual" className="w-full h-full object-cover" />
                                )
                            ) : (
                                <MediaPlaceholder thumbnailUrl={project.thumbnailUrl} isVideo={isVideo} />
                            )}
                        </AspectRatioBox>
                    </div>
                )}
                
                {/* Action Bar */}
                <div className="mt-4 border border-zinc-800 bg-black/60 px-4 py-2 flex justify-around items-center font-mono text-xs text-zinc-400">
                    <button className="flex items-center gap-1.5 hover:text-white transition-colors">
                        <HeartIcon className="w-4 h-4" />
                        <span className="font-bold">{formatNumber(project.stats.likes)}</span>
                    </button>
                    <div className="flex items-center gap-1.5">
                        <TrendingUpIcon className="w-4 h-4 text-zinc-500" />
                        <span>{formatNumber(project.stats.views)}</span>
                    </div>
                    <button className="flex items-center gap-1.5 hover:text-white transition-colors">
                        <ChatBubbleBottomCenterTextIcon className="w-4 h-4" />
                        <span>{formatNumber(project.stats.comments)}</span>
                    </button>
                    <button className="hover:text-white transition-colors"><ForwardIcon className="w-4 h-4" /></button>
                    <button className="hover:text-white transition-colors"><BookmarkIcon className="w-4 h-4" /></button>
                </div>
    
                 {/* Connect Button */}
                <div className="mt-3">
                    <button className="w-full bg-zinc-900/60 border border-zinc-700/80 text-white font-mono text-xs uppercase tracking-wider py-2.5 font-bold hover:bg-zinc-800 hover:border-zinc-500 transition-all duration-150 flex items-center justify-center gap-2">
                        <span>// CONNECT</span>
                    </button>
                </div>
            </div>
            <ImageZoomModal 
                isOpen={!!zoomedImageUrl} 
                onClose={() => setZoomedImageUrl(null)} 
                imageUrl={zoomedImageUrl || ''}
            />
        </>
    );
}

interface PinnedHighlightsViewProps {
    loading: boolean;
    allProjects: Project[];
    userSavedIds: Set<string>;
    userLikedIds: Set<string>;
    userFollowingIds?: Set<string>;
    onBackToShowcase: () => void;
    onBrowseShowcase: () => void;
    onToggleFollowCreator?: (creatorId: string, willFollow: boolean) => Promise<void> | void;
    onBookmarkToggle: (saved: boolean, projectId: string) => void;
    onProjectDeleted: (id: string) => void;
    onProjectUpdated: (proj: Project) => void;
}

const PinnedHighlightsView: React.FC<PinnedHighlightsViewProps> = ({
    loading: initialLoading,
    allProjects,
    userSavedIds,
    userLikedIds,
    userFollowingIds = new Set(),
    onBackToShowcase,
    onBrowseShowcase,
    onToggleFollowCreator,
    onBookmarkToggle,
    onProjectDeleted,
    onProjectUpdated,
}) => {
    const { currentUser } = useAuth();
    const navigate = ReactRouterDOM.useNavigate();
    const { domainSelections, setDomainSelection } = useFilters();
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState('All');
    const [extraProjects, setExtraProjects] = useState<Record<string, Project>>({});
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [isFetchingMissing, setIsFetchingMissing] = useState(false);
    const [retryCount, setRetryCount] = useState(0);

    const categoryFilters = [
        'All',
        'Design',
        'App Development',
        'Machine Learning',
        'Cybersecurity',
        'Web3',
        'Hardware',
        'Gaming',
        'Fintech'
    ];

    // Asynchronously retrieve any saved project IDs that aren't yet in allProjects or extraProjects
    useEffect(() => {
        if (!currentUser?.uid || userSavedIds.size === 0) return;

        let isMounted = true;
        const missingIds = Array.from(userSavedIds).filter(
            id => !allProjects.some(p => p.id === id) && !extraProjects[id]
        );

        if (missingIds.length === 0) {
            setFetchError(null);
            return;
        }

        setIsFetchingMissing(true);
        setFetchError(null);

        Promise.all(missingIds.map(id => getShowcaseProjectById(id)))
            .then(fetched => {
                if (!isMounted) return;
                const newExtras: Record<string, Project> = {};
                fetched.forEach(p => {
                    if (p) newExtras[p.id] = p;
                });
                setExtraProjects(prev => ({ ...prev, ...newExtras }));
                setIsFetchingMissing(false);
            })
            .catch(err => {
                if (!isMounted) return;
                console.error('[FETCH_SAVED_PROJECTS_ERROR]', err);
                setFetchError('Unable to load saved projects from Firestore. Check your connection.');
                setIsFetchingMissing(false);
            });

        return () => {
            isMounted = false;
        };
    }, [userSavedIds, allProjects, currentUser?.uid, retryCount]);

    // Build array of all saved projects
    const savedProjects = React.useMemo(() => {
        if (!currentUser?.uid || userSavedIds.size === 0) return [];

        const list: Project[] = [];
        const seen = new Set<string>();

        // Maintain order of userSavedIds
        for (const id of userSavedIds) {
            if (seen.has(id)) continue;
            const fromAll = allProjects.find(p => p.id === id);
            if (fromAll) {
                seen.add(id);
                list.push(fromAll);
                continue;
            }
            const fromExtras = extraProjects[id];
            if (fromExtras) {
                seen.add(id);
                list.push(fromExtras);
            }
        }
        return list;
    }, [userSavedIds, allProjects, extraProjects, currentUser?.uid]);

    // Filter saved projects by search and category
    const filteredSavedProjects = React.useMemo(() => {
        const selectedDomains = domainSelections['spotlight-pinned'] || [];
        return savedProjects.filter(project => {
            // Category filter
            if (activeCategory !== 'All') {
                const catLower = activeCategory.toLowerCase();
                const projCat = (project.category || '').toLowerCase();
                const projDom = ((project as any).domain || '').toLowerCase();
                if (!projCat.includes(catLower) && !projDom.includes(catLower)) {
                    return false;
                }
            }

            // Domain filter
            if (selectedDomains.length > 0) {
                const projCat = (project.category || '').toLowerCase();
                const projDom = ((project as any).domain || '').toLowerCase();
                const matchesDomain = selectedDomains.some(d => {
                    const dl = d.toLowerCase();
                    return projCat.includes(dl) || projDom.includes(dl);
                });
                if (!matchesDomain) return false;
            }

            // Search filter
            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase();
                const title = (project.title || project.name || '').toLowerCase();
                const summary = (project.aiSummary || project.oneLine || '').toLowerCase();
                const desc = (project.description || '').toLowerCase();
                const authorName = (project.author?.name || '').toLowerCase();
                const tags = Array.isArray(project.tags) ? project.tags.join(' ').toLowerCase() : '';

                return (
                    title.includes(term) ||
                    summary.includes(term) ||
                    desc.includes(term) ||
                    authorName.includes(term) ||
                    tags.includes(term)
                );
            }

            return true;
        });
    }, [savedProjects, activeCategory, domainSelections, searchTerm]);

    const isLoading = initialLoading || (isFetchingMissing && savedProjects.length === 0);

    return (
        <div className="space-y-4">
            {/* Header banner */}
            <div className="bg-[#0c0c0e] border border-zinc-800 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <button
                        onClick={onBackToShowcase}
                        className="text-zinc-400 hover:text-white font-mono text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors mb-2.5 cursor-pointer"
                    >
                        <ArrowLeftIcon className="w-3.5 h-3.5" />
                        <span>// BACK TO SHOWCASE</span>
                    </button>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 block">// PINNED_FEED</span>
                    <h2 className="text-xl font-bold font-mono text-white tracking-wide mt-0.5">PINNED_HIGHLIGHTS</h2>
                    <p className="text-xs font-mono text-zinc-400 mt-1">Your saved projects, collected in one place for easy access.</p>
                </div>
                {currentUser && savedProjects.length > 0 && (
                    <div className="sm:self-end">
                        <span className="font-mono text-xs text-zinc-300 bg-black border border-zinc-800 px-3 py-1.5 inline-block">
                            // {savedProjects.length} SAVED {savedProjects.length === 1 ? 'PROJECT' : 'PROJECTS'}
                        </span>
                    </div>
                )}
            </div>

            {/* Controls only shown if user is authenticated and has projects */}
            {currentUser && (savedProjects.length > 0 || searchTerm || activeCategory !== 'All') && (
                <>
                    {/* Search Bar */}
                    <div className="relative">
                        <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input
                            type="search"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="SEARCH SAVED PROJECTS BY TITLE, TECH, OR CREATOR..."
                            className="w-full bg-[#0c0c0e] border border-zinc-800 py-2.5 pl-10 pr-8 font-mono text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-xs px-1 cursor-pointer"
                                title="Clear search"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Category Filter Bar */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-2 no-scrollbar">
                        {categoryFilters.map(category => (
                            <button
                                key={category}
                                onClick={() => setActiveCategory(category)}
                                className={`px-3 py-1.5 rounded-none font-mono text-xs uppercase tracking-wider whitespace-nowrap transition-all duration-150 border cursor-pointer ${
                                    activeCategory === category
                                        ? 'bg-[#18181d] text-white border-zinc-700 font-bold'
                                        : 'bg-[#0c0c0e] text-zinc-400 border-zinc-800/90 hover:border-zinc-700 hover:text-white'
                                }`}
                            >
                                {category}
                            </button>
                        ))}
                    </div>

                    <DomainFilter
                        domains={spotlightDomains}
                        selectedDomains={domainSelections['spotlight-pinned'] || []}
                        onSelectionChange={(domains) => setDomainSelection('spotlight-pinned', domains)}
                    />
                </>
            )}

            {/* Content states */}
            {!currentUser ? (
                /* Unauthenticated state */
                <div className="text-center py-16 text-zinc-400 font-mono text-xs border border-zinc-800 bg-[#0c0c0e] p-8 space-y-4">
                    <p className="text-zinc-200 text-sm font-semibold tracking-wide">// AUTHENTICATION REQUIRED</p>
                    <p className="text-zinc-500 max-w-md mx-auto leading-relaxed">
                        Please sign in to view and manage your saved Showcase projects across sessions and devices.
                    </p>
                    <div className="pt-2">
                        <button
                            onClick={() => navigate('/login')}
                            className="px-6 py-2.5 bg-white text-black font-mono text-xs font-bold uppercase tracking-wider hover:bg-zinc-200 transition-colors shadow-sm cursor-pointer"
                        >
                            SIGN IN
                        </button>
                    </div>
                </div>
            ) : fetchError && savedProjects.length === 0 ? (
                /* Error state */
                <div className="text-center py-16 text-zinc-400 font-mono text-xs border border-rose-900/60 bg-[#0c0c0e] p-8 space-y-4">
                    <p className="text-rose-400 text-sm font-semibold tracking-wide">// ERROR LOADING SAVED PROJECTS</p>
                    <p className="text-zinc-500 max-w-md mx-auto leading-relaxed">
                        {fetchError}
                    </p>
                    <div className="pt-2">
                        <button
                            onClick={() => setRetryCount(prev => prev + 1)}
                            className="px-6 py-2.5 bg-zinc-900 border border-zinc-700 text-white font-mono text-xs font-bold uppercase tracking-wider hover:bg-zinc-800 transition-colors cursor-pointer"
                        >
                            RETRY
                        </button>
                    </div>
                </div>
            ) : isLoading ? (
                /* Loading state */
                <div className="space-y-4">
                    <ProjectCardSkeleton />
                    <ProjectCardSkeleton />
                </div>
            ) : savedProjects.length === 0 ? (
                /* Empty state: No projects saved yet */
                <div className="text-center py-16 text-zinc-400 font-mono text-xs border border-zinc-800 bg-[#0c0c0e] p-8 space-y-3">
                    <p className="text-zinc-200 text-sm font-semibold tracking-wide">// NO SAVED PROJECTS YET</p>
                    <p className="text-zinc-500 max-w-md mx-auto leading-relaxed">
                        Projects you bookmark in Showcase will appear here. Save projects you find interesting to build your personal collection.
                    </p>
                    <div className="pt-3">
                        <button
                            onClick={onBrowseShowcase}
                            className="px-5 py-2.5 bg-white text-black font-mono text-xs font-bold uppercase tracking-wider hover:bg-zinc-200 transition-colors shadow-sm active:scale-[0.99] cursor-pointer"
                        >
                            BROWSE SHOWCASE
                        </button>
                    </div>
                </div>
            ) : filteredSavedProjects.length === 0 ? (
                /* Empty state: Search / filter yielded 0 results */
                <div className="text-center py-16 text-zinc-400 font-mono text-xs border border-zinc-800 bg-[#0c0c0e] p-8 space-y-3">
                    <p className="text-zinc-200 text-sm font-semibold tracking-wide">// NO MATCHING SAVED PROJECTS</p>
                    <p className="text-zinc-500 max-w-md mx-auto leading-relaxed">
                        No saved projects match your search query or selected category filter.
                    </p>
                    <div className="flex items-center justify-center gap-3 pt-3">
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="px-4 py-2 border border-zinc-700 bg-zinc-900 text-white font-mono text-xs hover:bg-zinc-800 transition-colors cursor-pointer"
                            >
                                Clear Search
                            </button>
                        )}
                        {activeCategory !== 'All' && (
                            <button
                                onClick={() => setActiveCategory('All')}
                                className="px-4 py-2 border border-zinc-700 bg-zinc-900 text-white font-mono text-xs hover:bg-zinc-800 transition-colors cursor-pointer"
                            >
                                Show All Categories
                            </button>
                        )}
                    </div>
                </div>
            ) : (
                /* Populated list */
                <div className="space-y-4">
                    {filteredSavedProjects.map(project => {
                        const creatorId = getProjectCreatorId(project);
                        return (
                            <ShowcaseCard
                                key={project.id}
                                project={project}
                                initialLiked={userLikedIds.has(project.id)}
                                initialSaved={true}
                                initialFollowingCreator={creatorId ? userFollowingIds.has(creatorId) : false}
                                onToggleFollowCreator={onToggleFollowCreator}
                                onBookmarkToggle={onBookmarkToggle}
                                onDeleted={onProjectDeleted}
                                onUpdated={onProjectUpdated}
                                onFilterByCategory={setActiveCategory}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
};

interface PinnedProfilesFeedViewProps {
    loading: boolean;
    allProjects: Project[];
    userFollowingIds: Set<string>;
    userLikedIds: Set<string>;
    userSavedIds: Set<string>;
    onBackToShowcase: () => void;
    onBrowseShowcase: () => void;
    onToggleFollowCreator: (creatorId: string, willFollow: boolean) => Promise<void> | void;
    onBookmarkToggle: (saved: boolean, projectId: string) => void;
    onProjectDeleted: (id: string) => void;
    onProjectUpdated: (proj: Project) => void;
}

const PinnedProfilesFeedView: React.FC<PinnedProfilesFeedViewProps> = ({
    loading: initialLoading,
    allProjects,
    userFollowingIds,
    userLikedIds,
    userSavedIds,
    onBackToShowcase,
    onBrowseShowcase,
    onToggleFollowCreator,
    onBookmarkToggle,
    onProjectDeleted,
    onProjectUpdated,
}) => {
    const { currentUser } = useAuth();
    const navigate = ReactRouterDOM.useNavigate();
    const { domainSelections, setDomainSelection } = useFilters();
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState('All');

    const categoryFilters = [
        'All',
        'Design',
        'App Development',
        'Machine Learning',
        'Cybersecurity',
        'Web3',
        'Hardware',
        'Gaming',
        'Fintech'
    ];

    // Filter projects strictly authored by creators the current user follows
    const followedProjects = React.useMemo(() => {
        if (!currentUser?.uid || userFollowingIds.size === 0) return [];

        return allProjects.filter(project => {
            const creatorId = getProjectCreatorId(project);
            return creatorId && userFollowingIds.has(creatorId);
        }).sort((a, b) => {
            const timeA = new Date(a.createdAt || 0).getTime();
            const timeB = new Date(b.createdAt || 0).getTime();
            return timeB - timeA;
        });
    }, [allProjects, userFollowingIds, currentUser?.uid]);

    // Apply category, domain, and search filters
    const filteredFollowedProjects = React.useMemo(() => {
        const selectedDomains = domainSelections['spotlight-pinned-profiles'] || [];
        return followedProjects.filter(project => {
            // Category filter
            if (activeCategory !== 'All') {
                const catLower = activeCategory.toLowerCase();
                const projCat = (project.category || '').toLowerCase();
                const projDom = ((project as any).domain || '').toLowerCase();
                if (!projCat.includes(catLower) && !projDom.includes(catLower)) {
                    return false;
                }
            }

            // Domain filter
            if (selectedDomains.length > 0) {
                const projCat = (project.category || '').toLowerCase();
                const projDom = ((project as any).domain || '').toLowerCase();
                const matchesDomain = selectedDomains.some(d => {
                    const dl = d.toLowerCase();
                    return projCat.includes(dl) || projDom.includes(dl);
                });
                if (!matchesDomain) return false;
            }

            // Search filter
            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase();
                const title = (project.title || project.name || '').toLowerCase();
                const summary = (project.aiSummary || project.oneLine || '').toLowerCase();
                const desc = (project.description || '').toLowerCase();
                const authorName = (project.author?.name || '').toLowerCase();
                const tags = Array.isArray(project.tags) ? project.tags.join(' ').toLowerCase() : '';

                return (
                    title.includes(term) ||
                    summary.includes(term) ||
                    desc.includes(term) ||
                    authorName.includes(term) ||
                    tags.includes(term)
                );
            }

            return true;
        });
    }, [followedProjects, activeCategory, domainSelections, searchTerm]);

    return (
        <div className="space-y-4">
            {/* Header banner */}
            <div className="bg-[#0c0c0e] border border-zinc-800 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <button
                        onClick={onBackToShowcase}
                        className="text-zinc-400 hover:text-white font-mono text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors mb-2.5 cursor-pointer"
                    >
                        <ArrowLeftIcon className="w-3.5 h-3.5" />
                        <span>// BACK TO SHOWCASE</span>
                    </button>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 block">// PINNED_FEED</span>
                    <h2 className="text-xl font-bold font-mono text-white tracking-wide mt-0.5">PINNED_PROFILES</h2>
                    <p className="text-xs font-mono text-zinc-400 mt-1">Showcase projects authored by creators you follow.</p>
                </div>
                {currentUser && userFollowingIds.size > 0 && (
                    <div className="sm:self-end flex items-center gap-2">
                        <span className="font-mono text-xs text-zinc-300 bg-black border border-zinc-800 px-3 py-1.5 inline-block">
                            // FOLLOWING {userFollowingIds.size} {userFollowingIds.size === 1 ? 'CREATOR' : 'CREATORS'}
                        </span>
                    </div>
                )}
            </div>

            {/* Controls only shown if user is authenticated and follows creators */}
            {currentUser && userFollowingIds.size > 0 && (
                <>
                    {/* Search Bar */}
                    <div className="relative">
                        <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input
                            type="search"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="SEARCH PROJECTS FROM FOLLOWED CREATORS..."
                            className="w-full bg-[#0c0c0e] border border-zinc-800 py-2.5 pl-10 pr-8 font-mono text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-xs px-1 cursor-pointer"
                                title="Clear search"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Category Filter Bar */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-2 no-scrollbar">
                        {categoryFilters.map(category => (
                            <button
                                key={category}
                                onClick={() => setActiveCategory(category)}
                                className={`px-3 py-1.5 rounded-none font-mono text-xs uppercase tracking-wider whitespace-nowrap transition-all duration-150 border cursor-pointer ${
                                    activeCategory === category
                                        ? 'bg-[#18181d] text-white border-zinc-700 font-bold'
                                        : 'bg-[#0c0c0e] text-zinc-400 border-zinc-800/90 hover:border-zinc-700 hover:text-white'
                                }`}
                            >
                                {category}
                            </button>
                        ))}
                    </div>

                    <DomainFilter
                        domains={spotlightDomains}
                        selectedDomains={domainSelections['spotlight-pinned-profiles'] || []}
                        onSelectionChange={(domains) => setDomainSelection('spotlight-pinned-profiles', domains)}
                    />
                </>
            )}

            {/* Content states */}
            {!currentUser ? (
                /* Unauthenticated state */
                <div className="text-center py-16 text-zinc-400 font-mono text-xs border border-zinc-800 bg-[#0c0c0e] p-8 space-y-4">
                    <p className="text-zinc-200 text-sm font-semibold tracking-wide">// AUTHENTICATION REQUIRED</p>
                    <p className="text-zinc-500 max-w-md mx-auto leading-relaxed">
                        Please sign in to view projects from creators you follow.
                    </p>
                    <div className="pt-2">
                        <button
                            onClick={() => navigate('/login')}
                            className="px-6 py-2.5 bg-white text-black font-mono text-xs font-bold uppercase tracking-wider hover:bg-zinc-200 transition-colors shadow-sm cursor-pointer"
                        >
                            SIGN IN
                        </button>
                    </div>
                </div>
            ) : initialLoading ? (
                /* Loading state */
                <div className="space-y-4">
                    <ProjectCardSkeleton />
                    <ProjectCardSkeleton />
                </div>
            ) : userFollowingIds.size === 0 ? (
                /* Empty state: User follows nobody */
                <div className="text-center py-16 text-zinc-400 font-mono text-xs border border-zinc-800 bg-[#0c0c0e] p-8 space-y-3">
                    <p className="text-zinc-200 text-sm font-semibold tracking-wide">// NO FOLLOWED CREATORS YET</p>
                    <p className="text-zinc-400 max-w-md mx-auto leading-relaxed">
                        Your network starts here. Follow creators whose work interests you.
                    </p>
                    <div className="pt-3">
                        <button
                            onClick={onBrowseShowcase}
                            className="px-5 py-2.5 bg-white text-black font-mono text-xs font-bold uppercase tracking-wider hover:bg-zinc-200 transition-colors shadow-sm active:scale-[0.99] cursor-pointer"
                        >
                            BROWSE SHOWCASE
                        </button>
                    </div>
                </div>
            ) : followedProjects.length === 0 ? (
                /* Empty state: Follows creators, but they haven't posted projects */
                <div className="text-center py-16 text-zinc-400 font-mono text-xs border border-zinc-800 bg-[#0c0c0e] p-8 space-y-3">
                    <p className="text-zinc-200 text-sm font-semibold tracking-wide">// NO PROJECTS FROM FOLLOWED CREATORS</p>
                    <p className="text-zinc-500 max-w-md mx-auto leading-relaxed">
                        None of the creators you follow have published Showcase projects yet. Explore Showcase to discover more creators.
                    </p>
                    <div className="pt-3">
                        <button
                            onClick={onBrowseShowcase}
                            className="px-5 py-2.5 bg-white text-black font-mono text-xs font-bold uppercase tracking-wider hover:bg-zinc-200 transition-colors shadow-sm active:scale-[0.99] cursor-pointer"
                        >
                            BROWSE SHOWCASE
                        </button>
                    </div>
                </div>
            ) : filteredFollowedProjects.length === 0 ? (
                /* Empty state: Search / Category yielded 0 results */
                <div className="text-center py-16 text-zinc-400 font-mono text-xs border border-zinc-800 bg-[#0c0c0e] p-8 space-y-3">
                    <p className="text-zinc-200 text-sm font-semibold tracking-wide">// NO MATCHING PROJECTS</p>
                    <p className="text-zinc-500 max-w-md mx-auto leading-relaxed">
                        No projects from followed creators match your search query or selected category.
                    </p>
                    <div className="flex items-center justify-center gap-3 pt-3">
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="px-4 py-2 border border-zinc-700 bg-zinc-900 text-white font-mono text-xs hover:bg-zinc-800 transition-colors cursor-pointer"
                            >
                                Clear Search
                            </button>
                        )}
                        {activeCategory !== 'All' && (
                            <button
                                onClick={() => setActiveCategory('All')}
                                className="px-4 py-2 border border-zinc-700 bg-zinc-900 text-white font-mono text-xs hover:bg-zinc-800 transition-colors cursor-pointer"
                            >
                                Show All Categories
                            </button>
                        )}
                    </div>
                </div>
            ) : (
                /* Populated list */
                <div className="space-y-4">
                    {filteredFollowedProjects.map(project => {
                        const creatorId = getProjectCreatorId(project);
                        return (
                            <ShowcaseCard
                                key={project.id}
                                project={project}
                                initialLiked={userLikedIds.has(project.id)}
                                initialSaved={userSavedIds.has(project.id)}
                                initialFollowingCreator={creatorId ? userFollowingIds.has(creatorId) : true}
                                onToggleFollowCreator={onToggleFollowCreator}
                                onBookmarkToggle={onBookmarkToggle}
                                onDeleted={onProjectDeleted}
                                onUpdated={onProjectUpdated}
                                onFilterByCategory={setActiveCategory}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
};

interface ShowcaseViewProps {
    projects: Project[];
    loading: boolean;
    searchTerm: string;
    onSearchChange: (term: string) => void;
    sortOrder: 'recent' | 'popular';
    onSortChange: (sort: 'recent' | 'popular') => void;
    onOpenCreate: () => void;
    userLikedIds: Set<string>;
    userSavedIds: Set<string>;
    userFollowingIds?: Set<string>;
    onToggleFollowCreator?: (creatorId: string, willFollow: boolean) => Promise<void> | void;
    onProjectDeleted: (id: string) => void;
    onProjectUpdated: (proj: Project) => void;
    onFilterByCategory: (cat: string) => void;
    onBookmarkToggle?: (saved: boolean, projectId: string) => void;
}

const ShowcaseView: React.FC<ShowcaseViewProps> = React.memo(({
    projects,
    loading,
    searchTerm,
    onSearchChange,
    sortOrder,
    onSortChange,
    onOpenCreate,
    userLikedIds,
    userSavedIds,
    userFollowingIds,
    onToggleFollowCreator,
    onProjectDeleted,
    onProjectUpdated,
    onFilterByCategory,
    onBookmarkToggle,
}) => {
    return (
        <div className="space-y-4">
            {/* Top Discovery & Action Header */}
            <div className="bg-[#0c0c0e] border border-zinc-800 p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-grow max-w-xl">
                    <div className="relative flex-grow">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input
                            type="search"
                            value={searchTerm}
                            onChange={(e) => onSearchChange(e.target.value)}
                            placeholder="Search showcase by title, summary, tech, or creator..."
                            className="w-full bg-black border border-zinc-800 py-2 pl-9 pr-8 font-mono text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => onSearchChange('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-xs px-1 cursor-pointer"
                                title="Clear search"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap justify-between sm:justify-end">
                    {/* Sort Order Toggle */}
                    <div className="flex items-center border border-zinc-800 bg-black p-0.5 font-mono text-[11px]">
                        <button
                            onClick={() => onSortChange('recent')}
                            className={`px-3 py-1.5 uppercase tracking-wider transition-colors cursor-pointer ${
                                sortOrder === 'recent'
                                    ? 'bg-zinc-800 text-white font-bold'
                                    : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                        >
                            // RECENT
                        </button>
                        <button
                            onClick={() => onSortChange('popular')}
                            className={`px-3 py-1.5 uppercase tracking-wider transition-colors cursor-pointer ${
                                sortOrder === 'popular'
                                    ? 'bg-zinc-800 text-white font-bold'
                                    : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                        >
                            // POPULAR
                        </button>
                    </div>

                    {/* Publish Showcase Action */}
                    <button
                        onClick={onOpenCreate}
                        className="bg-white hover:bg-zinc-200 text-black px-4 py-1.5 font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm active:scale-[0.99] cursor-pointer"
                    >
                        <SparklesIcon className="w-3.5 h-3.5 text-black" />
                        <span>+ PUBLISH SHOWCASE</span>
                    </button>
                </div>
            </div>

            {/* Sub-header status bar */}
            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 px-1">
                <span>
                    // SHOWCASE_PORTFOLIO {projects.length > 0 ? `(${projects.length} PROJECTS)` : ''}
                </span>
                {searchTerm && (
                    <span className="text-zinc-400">
                        Query: "{searchTerm}"
                    </span>
                )}
            </div>

            {/* Projects List */}
            {loading ? (
                <>
                    <ProjectCardSkeleton />
                    <ProjectCardSkeleton />
                </>
            ) : projects.length > 0 ? (
                projects.map(project => {
                    const creatorId = getProjectCreatorId(project);
                    return (
                        <ShowcaseCard
                            key={project.id}
                            project={project}
                            initialLiked={userLikedIds.has(project.id)}
                            initialSaved={userSavedIds.has(project.id)}
                            initialFollowingCreator={creatorId ? (userFollowingIds?.has(creatorId) ?? false) : false}
                            onToggleFollowCreator={onToggleFollowCreator}
                            onDeleted={onProjectDeleted}
                            onUpdated={onProjectUpdated}
                            onFilterByCategory={onFilterByCategory}
                            onBookmarkToggle={onBookmarkToggle}
                        />
                    );
                })
            ) : (
                <div className="text-center py-16 text-zinc-400 font-mono text-xs border border-zinc-800 bg-[#0c0c0e] p-8 space-y-3">
                    <p className="text-zinc-200 text-sm font-semibold tracking-wide">// NO_SHOWCASE_PROJECTS_FOUND</p>
                    <p className="text-zinc-500 max-w-md mx-auto leading-relaxed">
                        No projects match the selected category filters or search query. Publish a new portfolio project or clear your search filters to browse all projects.
                    </p>
                    <div className="flex items-center justify-center gap-3 pt-3">
                        {searchTerm && (
                            <button
                                onClick={() => onSearchChange('')}
                                className="px-4 py-2 border border-zinc-700 bg-zinc-900 text-white font-mono text-xs hover:bg-zinc-800 transition-colors cursor-pointer"
                            >
                                Clear Search
                            </button>
                        )}
                        <button
                            onClick={onOpenCreate}
                            className="px-4 py-2 bg-white text-black font-mono text-xs font-bold uppercase tracking-wider hover:bg-zinc-200 transition-colors cursor-pointer"
                        >
                            + Publish New Showcase
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
});
ShowcaseView.displayName = 'ShowcaseView';

export const SpotlightPage = () => {
    const { openModal } = useAIAssistant();
    const [searchParams, setSearchParams] = ReactRouterDOM.useSearchParams();
    const outletContext = ReactRouterDOM.useOutletContext<{
        setRightSidebarVariant: (variant: string) => void;
        spotlightBrowseState: string | null;
        setSpotlightBrowseState: (filter: string | null) => void;
        spotlightIsBrowsing?: boolean;
        setSpotlightIsBrowsing?: (value: boolean) => void;
        showPinnedHighlights: boolean;
        setShowPinnedHighlights: (show: boolean) => void;
        showPinnedProfiles?: boolean;
        setShowPinnedProfiles?: (show: boolean) => void;
        goforitFilters: { company: string, skills: string, location: string, opportunityType: string, category: string, experienceLevel: string, searchTerm: string };
        refreshKey: number;
        savedOfferIds: string[];
        toggleSaveOffer: (offerId: string) => void;
    }>();

    const {
        setRightSidebarVariant,
        spotlightBrowseState,
        setSpotlightBrowseState,
        setSpotlightIsBrowsing,
        showPinnedHighlights,
        setShowPinnedHighlights,
        showPinnedProfiles = false,
        setShowPinnedProfiles,
        goforitFilters,
        refreshKey,
        savedOfferIds = [],
        toggleSaveOffer
    } = outletContext || {};
    const { domainSelections, setDomainSelection } = useFilters();

    const collabViewParam = searchParams.get('collabView');
    const openCollabDashboardParam = searchParams.get('openCollabDashboard');
    const isCollabManagementView = Boolean(
        collabViewParam === 'incoming' || 
        collabViewParam === 'active' || 
        collabViewParam === 'my_applications' || 
        collabViewParam === 'inbox' || 
        collabViewParam === 'teams' || 
        searchParams.has('invite') || 
        openCollabDashboardParam === 'true'
    );

    const urlTab = searchParams.get('tab');
    const activeTab: 'Showcase' | 'Collabs' | 'Leap' = isCollabManagementView
        ? 'Collabs'
        : (urlTab === 'Collabs' || urlTab === 'Leap' ? urlTab : 'Showcase');

    const urlSubTab = searchParams.get('subTab');
    const activeLeapTab: 'GoForIt' | 'Pings' = urlSubTab === 'Pings' ? 'Pings' : 'GoForIt';

    const handleTabChange = (newTab: 'Showcase' | 'Collabs' | 'Leap') => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('tab', newTab);
            if (newTab !== 'Collabs') {
                next.delete('collabView');
                next.delete('openCollabDashboard');
            }
            if (newTab !== 'Leap') {
                next.delete('subTab');
            }
            return next;
        });
    };

    const handleLeapTabChange = (newSubTab: 'GoForIt' | 'Pings') => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('tab', 'Leap');
            next.set('subTab', newSubTab);
            return next;
        });
    };

    const [activeCategory, setActiveCategory] = useState('All');
    const [loading, setLoading] = useState(true);
    const [offers, setOffers] = useState(mockOffers);
    const [selectedOfferType, setSelectedOfferType] = useState<'Full-Time' | 'Invites' | 'Gigs' | 'Others' | null>(null);
    const [initialOfferStatus, setInitialOfferStatus] = useState<'New' | 'Active' | 'Expired'>('New');
    const { currentUser } = useAuth();
    const [viewedOfferIds, setViewedOfferIds] = useState<string[]>([]);
    const [messagingOffer, setMessagingOffer] = useState<Offer | null>(null);
    const [liveCollabProjects, setLiveCollabProjects] = useState<Project[]>([]);
    const isCollabManagement = activeTab === 'Collabs' && isCollabManagementView;
    const collabManagementTab: 'applications' | 'active' | 'my_applications' = (collabViewParam === 'active') ? 'active' : (collabViewParam === 'my_applications' ? 'my_applications' : 'applications');

    const handleBackToCollabs = () => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('tab', 'Collabs');
            next.delete('collabView');
            next.delete('openCollabDashboard');
            return next;
        });
    };

    const mainTabs = ['Showcase', 'Collabs', 'Leap'];
    const sectionKey = `spotlight-${activeTab.toLowerCase()}`;

    useEffect(() => {
        let isMounted = true;

        // Immediate snapshot fetch
        getCollabPosts().then(posts => {
            if (isMounted && posts.length > 0) {
                setLiveCollabProjects(posts.map(postToProject));
            }
        }).catch(err => console.warn('[SPOTLIGHT_COLLABS_INITIAL_WARN]', err));

        const unsubscribe = subscribeToCollabPosts(
            (collabPosts) => {
                if (isMounted) {
                    const projects = collabPosts.map(postToProject);
                    setLiveCollabProjects(projects);
                }
            },
            (err) => {
                console.warn('[SPOTLIGHT_COLLABS_FEED_WARN]', err);
            }
        );

        return () => {
            isMounted = false;
            unsubscribe();
        };
    }, [currentUser?.uid, refreshKey]);

    // Showcase Real-time Firestore State
    const [liveShowcaseProjects, setLiveShowcaseProjects] = useState<Project[]>([]);
    const [showcaseLoading, setShowcaseLoading] = useState(true);
    const [isCreateShowcaseOpen, setIsCreateShowcaseOpen] = useState(false);
    const [showcaseSortOrder, setShowcaseSortOrder] = useState<'recent' | 'popular'>('recent');
    const [showcaseSearchTerm, setShowcaseSearchTerm] = useState('');
    const [userLikedIds, setUserLikedIds] = useState<Set<string>>(new Set());
    const [userSavedIds, setUserSavedIds] = useState<Set<string>>(new Set());
    const [userFollowingIds, setUserFollowingIds] = useState<Set<string>>(new Set());

    const handleShowcaseDeleted = React.useCallback((deletedId: string) => {
        setLiveShowcaseProjects(prev => prev.filter(p => p.id !== deletedId));
    }, []);

    const handleShowcaseUpdated = React.useCallback((updatedProj: Project) => {
        setLiveShowcaseProjects(prev => prev.map(p => p.id === updatedProj.id ? updatedProj : p));
    }, []);

    useEffect(() => {
        let isMounted = true;

        // Seed initial showcase if empty
        seedInitialShowcasePostsIfEmpty().catch(console.warn);

        // Realtime live subscription (serves initial snapshot + live updates)
        const unsubscribe = subscribeToShowcasePosts(
            (posts) => {
                if (!isMounted) return;
                const nextProjects = posts.map(postToShowcaseProject);
                setLiveShowcaseProjects(prev => {
                    if (prev.length === nextProjects.length) {
                        let hasChanges = false;
                        const merged = nextProjects.map((next, idx) => {
                            const current = prev[idx];
                            if (!current || current.id !== next.id) {
                                hasChanges = true;
                                return next;
                            }
                            if (
                                current.stats?.views !== next.stats?.views ||
                                current.stats?.likes !== next.stats?.likes ||
                                current.stats?.comments !== next.stats?.comments ||
                                current.mediaUrl !== next.mediaUrl ||
                                current.title !== next.title ||
                                current.description !== next.description ||
                                current.status !== next.status
                            ) {
                                hasChanges = true;
                                return next;
                            }
                            return current;
                        });
                        return hasChanges ? merged : prev;
                    }
                    return nextProjects;
                });
                setShowcaseLoading(false);
            },
            (err) => {
                console.warn('[SPOTLIGHT_SHOWCASE_FEED_WARN]', err);
                if (isMounted) setShowcaseLoading(false);
            }
        );

        // Real-time subscription for user saved bookmarks, likes, and followed creators
        let unsubscribeSaved: (() => void) | undefined;
        let unsubscribeFollowing: (() => void) | undefined;
        if (currentUser?.uid) {
            getUserLikedPostIds(currentUser.uid).then(ids => {
                if (isMounted) setUserLikedIds(ids);
            }).catch(console.warn);

            unsubscribeSaved = subscribeToUserSavedPostIds(
                currentUser.uid,
                (ids) => {
                    if (isMounted) setUserSavedIds(ids);
                },
                (err) => {
                    console.warn('[SPOTLIGHT_SAVED_POSTS_WARN]', err);
                }
            );

            unsubscribeFollowing = subscribeFollowedUserIds(
                currentUser.uid,
                (ids) => {
                    if (isMounted) setUserFollowingIds(ids);
                },
                (err) => {
                    console.warn('[SPOTLIGHT_FOLLOWED_USERS_WARN]', err);
                }
            );
        } else {
            setUserLikedIds(new Set());
            setUserSavedIds(new Set());
            setUserFollowingIds(new Set());
        }

        return () => {
            isMounted = false;
            unsubscribe();
            unsubscribeSaved?.();
            unsubscribeFollowing?.();
        };
    }, [currentUser?.uid, refreshKey]);

    const handleBookmarkToggle = React.useCallback((saved: boolean, projectId: string) => {
        setUserSavedIds(prev => {
            const next = new Set(prev);
            if (saved) {
                next.add(projectId);
            } else {
                next.delete(projectId);
            }
            return next;
        });
    }, []);

    const handleToggleFollowCreator = React.useCallback(async (creatorId: string, willFollow: boolean) => {
        if (!currentUser?.uid || !creatorId || creatorId === currentUser.uid) return;

        // Optimistic UI update across all showcase cards & pinned feeds
        setUserFollowingIds(prev => {
            const next = new Set(prev);
            if (willFollow) {
                next.add(creatorId);
            } else {
                next.delete(creatorId);
            }
            return next;
        });

        try {
            await toggleFollowCreator({
                currentUser,
                currentUserProfile: null,
                targetCreatorId: creatorId,
            });
        } catch (err) {
            console.error('[TOGGLE_FOLLOW_CREATOR_ERROR]', err);
            // Revert state on error
            setUserFollowingIds(prev => {
                const next = new Set(prev);
                if (willFollow) {
                    next.delete(creatorId);
                } else {
                    next.add(creatorId);
                }
                return next;
            });
            throw err;
        }
    }, [currentUser]);

    const OpportunityDetailModal: React.FC<{
        offer: Offer;
        onClose: () => void;
        savedOfferIds: string[];
        toggleSaveOffer: (offerId: string) => void;
        showActions?: boolean;
    }> = ({ offer, onClose, savedOfferIds, toggleSaveOffer, showActions = true }) => {
        const navigate = ReactRouterDOM.useNavigate();
    
        const handleApply = () => {
            navigate(`/apply/${offer.id}`, { state: { offer } });
        };
        
        const isSaved = savedOfferIds.includes(offer.id);
    
        return (
            <div 
                className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-50 p-4 transition-opacity duration-300" 
                onClick={onClose}
                aria-modal="true"
                role="dialog"
                aria-labelledby="opportunity-detail-title"
            >
                <div 
                    className="bg-[#0c0c0e] border border-zinc-800 shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]" 
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex justify-between items-start p-5 border-b border-zinc-800 flex-shrink-0">
                        <div className="flex items-center gap-4">
                            <img src={offer.companyAvatarUrl} onError={handleImageError} alt={offer.companyName} className="w-14 h-14 border border-zinc-700 object-cover" />
                            <div>
                                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 block">// OPPORTUNITY_DETAILS</span>
                                <h2 id="opportunity-detail-title" className="text-xl font-bold font-mono text-white">{offer.title}</h2>
                                <p className="text-zinc-400 font-mono text-sm">{offer.companyName}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-600 transition-colors" aria-label="Close opportunity details">
                            <CloseIcon />
                        </button>
                    </div>
    
                    {/* Body */}
                    <div className="p-6 overflow-y-auto text-zinc-300 space-y-6">
                        {/* Job Details Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
                            <div className="flex items-start gap-3 bg-zinc-950 p-3 border border-zinc-800/80">
                                <CubeIcon className="w-4 h-4 text-zinc-500 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-[10px] uppercase text-zinc-500 tracking-wider">Job Type</p>
                                    <p className="font-semibold text-white mt-0.5">{offer.type}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 bg-zinc-950 p-3 border border-zinc-800/80">
                                <MapPinIcon className="w-4 h-4 text-zinc-500 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-[10px] uppercase text-zinc-500 tracking-wider">Location</p>
                                    <p className="font-semibold text-white mt-0.5">{offer.location || 'N/A'}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 bg-zinc-950 p-3 border border-zinc-800/80">
                                <AcademicCapIcon className="w-4 h-4 text-zinc-500 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-[10px] uppercase text-zinc-500 tracking-wider">Experience Level</p>
                                    <p className="font-semibold text-white mt-0.5">{offer.experienceLevel || 'N/A'}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 bg-zinc-950 p-3 border border-zinc-800/80">
                                <CubeIcon className="w-4 h-4 text-zinc-500 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-[10px] uppercase text-zinc-500 tracking-wider">Category</p>
                                    <p className="font-semibold text-white mt-0.5">{offer.category || 'N/A'}</p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="border-t border-zinc-800" />
                        
                        {/* Description */}
                        <div>
                            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 block mb-2">// JOB_DESCRIPTION</span>
                            <p className="whitespace-pre-wrap leading-relaxed font-mono text-xs text-zinc-300">{offer.description}</p>
                        </div>
    
                        {/* Skills */}
                        {offer.skills && offer.skills.length > 0 && (
                            <div>
                                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 block mb-2">// REQUIRED_SKILLS</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {offer.skills.map(skill => (
                                        <span key={skill} className="bg-zinc-900 text-zinc-300 px-2.5 py-1 text-[11px] font-mono border border-zinc-800">
                                            {skill}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        {(offer.createdAt || offer.acceptedAt) && (
                            <div>
                                <div className="border-t border-zinc-800 my-3" />
                                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 block mb-2">// TIMELINE</span>
                                <div className="space-y-2 font-mono text-xs">
                                    {offer.createdAt && (
                                        <div className="flex items-center gap-2 text-zinc-400">
                                            <CalendarDaysIcon className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                                            <span>Offer Received: <span className="text-white">{offer.createdAt}</span></span>
                                        </div>
                                    )}
                                    {offer.acceptedAt && (
                                        <div className="flex items-center gap-2 text-zinc-400">
                                            <CalendarDaysIcon className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                                            <span>Offer Accepted: <span className="text-white">{offer.acceptedAt}</span></span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
    
                    {/* Footer */}
                    <div className="flex-shrink-0 flex justify-between items-center gap-4 p-4 border-t border-zinc-800 bg-black">
                        <span className="text-xs font-mono text-zinc-500">Posted {offer.createdAt}</span>
                        {showActions && (
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => toggleSaveOffer(offer.id)}
                                    className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 text-white font-mono text-xs uppercase px-5 py-2.5 hover:bg-zinc-800 transition-colors"
                                >
                                    {isSaved ? <BookmarkIconSolid className="w-4 h-4" /> : <BookmarkIcon className="w-4 h-4" />}
                                    {isSaved ? 'Saved' : 'Save'}
                                </button>
                                <button onClick={handleApply} className="bg-white text-black font-mono text-xs uppercase font-bold hover:bg-zinc-200 px-7 py-2.5 transition-colors">
                                    Apply Now
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const handleOpenMessageModal = (selectedOffer: Offer) => {
        setMessagingOffer(selectedOffer);
        // If the offer has a new message, mark it as "read" by updating its state
        if (selectedOffer.hasNewMessage) {
            setOffers(currentOffers =>
                currentOffers.map(o =>
                    o.id === selectedOffer.id ? { ...o, hasNewMessage: false } : o
                )
            );
        }
    };

    const handleMarkOfferViewed = (offerId: string) => {
        if (!viewedOfferIds.includes(offerId)) {
            // FIX: Corrected typo 'BirdOfferIds' to 'offerId'.
            setViewedOfferIds(prev => [...prev, offerId]);
        }
    };

    const handleAcceptOffer = (offerId: string) => {
        setOffers(currentOffers =>
            currentOffers.map(offer =>
                offer.id === offerId ? { ...offer, status: 'Active' } : offer
            )
        );
    };

    const handleDeclineOffer = (offerId: string) => {
        setOffers(currentOffers =>
            currentOffers.map(offer =>
                offer.id === offerId ? { ...offer, status: 'Expired' } : offer
            )
        );
    };

    useEffect(() => {
        if (setRightSidebarVariant) {
            if (activeTab === 'Leap' && activeLeapTab === 'GoForIt') {
                setRightSidebarVariant('goforit');
            } else if (activeTab === 'Showcase') {
                setRightSidebarVariant('spotlight-showcase');
            } else if (activeTab === 'Collabs') {
                setRightSidebarVariant('spotlight-collabs');
            } else {
                setRightSidebarVariant('spotlight');
            }
        }
    }, [activeTab, activeLeapTab, setRightSidebarVariant]);

    useEffect(() => {
        return () => {
            if (setRightSidebarVariant) {
                setRightSidebarVariant('default');
            }
            if (setSpotlightBrowseState) {
                setSpotlightBrowseState(null);
            }
            if (setSpotlightIsBrowsing) {
                setSpotlightIsBrowsing(false);
            }
        };
    }, [setRightSidebarVariant, setSpotlightBrowseState, setSpotlightIsBrowsing]);

    // Handle ?browse=projects navigation from project detail page
    useEffect(() => {
        const browseParam = searchParams.get('browse');
        if (browseParam === 'projects' || browseParam === 'profiles') {
            if (setSpotlightBrowseState) setSpotlightBrowseState(browseParam);
            if (setSpotlightIsBrowsing) setSpotlightIsBrowsing(true);
            // Remove the param from the URL so it doesn't persist on refresh
            setSearchParams(prev => {
                const next = new URLSearchParams(prev);
                next.delete('browse');
                return next;
            }, { replace: true });
        }
    // Only run on mount (searchParams identity may change, but we only want the initial value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        setLoading(true);
        const timer = setTimeout(() => {
            setLoading(false);
        }, 1500);
        return () => clearTimeout(timer);
    }, [activeTab, activeCategory, spotlightBrowseState, showPinnedHighlights, showPinnedProfiles, activeLeapTab, refreshKey]);

    useEffect(() => {
        // Scroll to top whenever tabs, filters, or view states change
        document.querySelector('main')?.scrollTo(0, 0);
    }, [activeTab, activeCategory, selectedOfferType, spotlightBrowseState, showPinnedHighlights, showPinnedProfiles, activeLeapTab]);

    const matchesProjectCategoryOrDomain = (project: Project, targetFilter: string): boolean => {
        if (!targetFilter || targetFilter === 'All') return true;
        const tf = targetFilter.trim().toLowerCase();

        // 1. Direct match with project category or domain
        const projCat = (project.category || '').toLowerCase();
        const projDom = ((project as any).domain || '').toLowerCase();
        if (projCat === tf || projDom === tf) return true;

        // 2. Cross-domain / semantic matching for domains like Figma -> Design, UI/UX
        const DOMAIN_ALIASES: Record<string, string[]> = {
            'design': ['figma', 'ui/ux', 'ui design', 'ux design', 'graphic design', 'product design', 'design systems'],
            'ui/ux': ['figma', 'design', 'ui design', 'ux design', 'user experience', 'user interface'],
            'app development': ['mobile', 'react', 'react native', 'flutter', 'ios', 'android', 'frontend', 'backend', 'fullstack', 'web development', 'typescript', 'javascript'],
            'machine learning': ['ai', 'data science', 'deep learning', 'nlp', 'computer vision', 'python', 'pytorch', 'tensorflow'],
            'web3': ['blockchain', 'crypto', 'solidity', 'ethereum', 'smart contracts', 'decentralized'],
            'cybersecurity': ['security', 'infosec', 'pentesting', 'ethical hacking'],
            'fintech': ['finance', 'payments', 'crypto', 'banking', 'trading'],
            'gaming': ['game dev', 'unity', 'unreal', 'godot'],
            'hardware': ['iot', 'embedded', 'robotics', 'arduino', 'raspberry pi'],
        };

        const aliases = DOMAIN_ALIASES[tf] || [];
        if (aliases.some(a => projCat.includes(a) || projDom.includes(a))) return true;

        for (const [parentCategory, childAliases] of Object.entries(DOMAIN_ALIASES)) {
            if (childAliases.includes(projCat) || childAliases.includes(projDom)) {
                if (parentCategory === tf || tf.includes(parentCategory)) return true;
            }
        }

        // 3. Check tags
        if (Array.isArray((project as any).tags)) {
            if ((project as any).tags.some((t: string) => t && t.toLowerCase().includes(tf))) return true;
        }

        // 4. Check roles & skills in collabDetails
        if (project.collabDetails?.roles) {
            const rolesArr = Array.isArray(project.collabDetails.roles)
                ? project.collabDetails.roles
                : Object.values(project.collabDetails.roles);

            for (const role of rolesArr as any[]) {
                if (role.title && role.title.toLowerCase().includes(tf)) return true;
                const skillsArr = Array.isArray(role.skills) ? role.skills : (role.skills ? [role.skills] : []);
                if (skillsArr.some((s: string) => s && (s.toLowerCase() === tf || s.toLowerCase().includes(tf) || (aliases.length > 0 && aliases.some(a => s.toLowerCase().includes(a)))))) {
                    return true;
                }
            }
        }

        return false;
    };

    const allShowcaseProjects = React.useMemo(() => {
        const seen = new Set<string>();
        const list: Project[] = [];
        // First prioritize live showcase projects from Firestore
        for (const p of liveShowcaseProjects) {
            if (!seen.has(p.id)) {
                seen.add(p.id);
                list.push(p);
            }
        }
        // Then mock projects as sample fallback showcases
        for (const p of mockProjects) {
            if (!seen.has(p.id)) {
                seen.add(p.id);
                list.push(p);
            }
        }
        return list;
    }, [liveShowcaseProjects]);

    const filteredShowcaseProjects = React.useMemo(() => {
        const selectedDomains = domainSelections[sectionKey] || [];
        let result = allShowcaseProjects.filter(project => {
            // Category filter
            const matchesCat = activeCategory === 'All' || matchesProjectCategoryOrDomain(project, activeCategory);
            if (!matchesCat) return false;

            // Domain filter (if any domains explicitly selected)
            if (selectedDomains.length > 0) {
                const matchesDomain = selectedDomains.some(d => matchesProjectCategoryOrDomain(project, d));
                if (!matchesDomain) return false;
            }

            // Search term filter
            if (showcaseSearchTerm.trim()) {
                const term = showcaseSearchTerm.toLowerCase();
                const titleMatch = (project.title || project.name || '').toLowerCase().includes(term);
                const summaryMatch = (project.aiSummary || project.oneLine || '').toLowerCase().includes(term);
                const descMatch = (project.description || '').toLowerCase().includes(term);
                const authorMatch = (project.author?.name || '').toLowerCase().includes(term);
                const tagsMatch = Array.isArray(project.tags) && project.tags.some(t => t.toLowerCase().includes(term));
                if (!titleMatch && !summaryMatch && !descMatch && !authorMatch && !tagsMatch) return false;
            }

            return true;
        });

        // Sort order
        if (showcaseSortOrder === 'popular') {
            result = [...result].sort((a, b) => (b.stats?.likes ?? 0) - (a.stats?.likes ?? 0));
        } else {
            result = [...result].sort((a, b) => {
                const timeA = new Date(a.createdAt || 0).getTime();
                const timeB = new Date(b.createdAt || 0).getTime();
                return timeB - timeA;
            });
        }

        return result;
    }, [allShowcaseProjects, activeCategory, domainSelections, sectionKey, showcaseSearchTerm, showcaseSortOrder]);

    const allCollabProjects = React.useMemo(() => {
        const seen = new Set<string>();
        const list: Project[] = [];
        for (const p of liveCollabProjects) {
            if (!seen.has(p.id)) {
                seen.add(p.id);
                list.push(p);
            }
        }
        for (const p of mockForYouProjects) {
            if (!seen.has(p.id)) {
                seen.add(p.id);
                list.push(p);
            }
        }
        return list;
    }, [liveCollabProjects]);

    const browseShowcaseProjects = React.useMemo(() => {
        const seen = new Set<string>();
        const list: Project[] = [];
        for (const p of liveShowcaseProjects) {
            if (!seen.has(p.id) && !p.collabDetails) {
                seen.add(p.id);
                list.push(p);
            }
        }
        for (const p of mockProjects) {
            if (!seen.has(p.id) && !p.collabDetails) {
                seen.add(p.id);
                list.push(p);
            }
        }
        for (const p of suggestionProjects) {
            if (!seen.has(p.id) && !p.collabDetails) {
                seen.add(p.id);
                list.push(p);
            }
        }
        return list;
    }, [liveShowcaseProjects]);

    const browseCollabProjects = React.useMemo(() => {
        const seen = new Set<string>();
        const list: Project[] = [];
        for (const p of liveCollabProjects) {
            if (!seen.has(p.id)) {
                seen.add(p.id);
                list.push(p);
            }
        }
        for (const p of mockForYouProjects) {
            if (!seen.has(p.id)) {
                seen.add(p.id);
                list.push(p);
            }
        }
        return list;
    }, [liveCollabProjects]);

    const filteredCollabProjects = React.useMemo(() => {
        const selectedDomains = domainSelections[sectionKey] || [];
        return allCollabProjects.filter(project => {
            // 1. Check category filter
            const matchesCategory = activeCategory === 'All' || matchesProjectCategoryOrDomain(project, activeCategory);
            if (!matchesCategory) return false;

            // 2. Check domain filter (if any domains explicitly selected)
            if (selectedDomains.length > 0) {
                const matchesAnyDomain = selectedDomains.some(d => matchesProjectCategoryOrDomain(project, d));
                if (!matchesAnyDomain) return false;
            }

            return true;
        });
    }, [allCollabProjects, activeCategory, domainSelections, sectionKey]);
    

    
    const Collabs = () => (
        <div className="text-white space-y-4">
            {loading ? (
                 <>
                    <div className="animate-pulse">
                        <div className="h-8 w-1/4 bg-gray-700 rounded mb-4"></div>
                        <ProjectCardSkeleton />
                        <ProjectCardSkeleton />
                    </div>
                </>
            ) : (
                <>
                    <h3 className="text-xl font-bold mb-4">For You</h3>
                    {filteredCollabProjects.length > 0 ? (
                        filteredCollabProjects.map(project => (
                            <CollaborationCard key={project.id} project={project} />
                        ))
                    ) : (
                        <div className="text-center py-16 text-gray-400">
                            <p>No collaboration projects found for this category.</p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
    

    
    const ProfileSuggestionCard: React.FC<{ profile: ProfileSuggestion }> = ({ profile }) => (
        <div className="bg-[#0c0c0e] p-4 border border-zinc-800 flex flex-col min-h-48 hover:border-zinc-700 transition-colors">
            <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                    <img src={profile.author.avatarUrl} onError={handleImageError} alt={profile.author.name} className="w-10 h-10 border border-zinc-700 object-cover" />
                    <div className="flex items-center gap-1.5">
                        <p className="font-bold text-white font-mono text-sm">{profile.author.name}</p>
                        {profile.author.isVerified && <CheckBadgeIcon className="w-4 h-4 text-zinc-400" />}
                    </div>
                </div>
                <button className="bg-zinc-900 border border-zinc-800 text-white px-4 py-1.5 font-mono text-xs uppercase font-bold hover:bg-zinc-800 transition-colors">
                    View
                </button>
            </div>
            <div className="flex-grow">
                <p className="text-xs font-mono text-zinc-400 line-clamp-3 leading-relaxed">{profile.description}</p>
            </div>
            <div className="mt-auto">
                <div className="border-t border-zinc-800 my-3" />
                <div className="flex justify-between items-center font-mono text-xs">
                    <p className="text-zinc-400">
                        PROJECTS : <span className="text-white font-bold">{profile.stats.projects}</span>
                    </p>
                    <p className="text-zinc-400">
                        LINKS : <span className="text-white font-bold">{formatNumber(profile.stats.links)}</span>
                    </p>
                </div>
            </div>
        </div>
    );
    
    const CollaborationCard: React.FC<{ project: Project }> = ({ project }) => {
        const { currentUser } = useAuth();
        const [currentProject, setCurrentProject] = useState<Project>(project);
        const [isMenuOpen, setIsMenuOpen] = useState(false);
        const [isEditModalOpen, setIsEditModalOpen] = useState(false);
        const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
        const [collabApps, setCollabApps] = useState<CollabApplication[]>([]);

        useEffect(() => {
            if (!currentProject?.id) return;
            const unsubscribe = subscribeToCollabApplications(
                currentProject.id,
                (apps) => setCollabApps(apps)
            );
            return () => unsubscribe();
        }, [currentProject?.id]);

        useEffect(() => {
            setCurrentProject(project);
        }, [project]);

        const location = ReactRouterDOM.useLocation();
        const isMySpaceContext = location.pathname.startsWith('/myspace');
        const isOwner = Boolean(
            currentUser && (
                (currentProject.authorId && currentProject.authorId === currentUser.uid) ||
                (currentUser.displayName && currentProject.author?.name === currentUser.displayName)
            )
        );
        const canEdit = Boolean(isOwner && isMySpaceContext);

        const [showMore, setShowMore] = useState(false);
        const isVideo = currentProject.mediaType === 'video';
        const videoRef = useRef<HTMLVideoElement>(null);
        const videoContainerRef = useRef<HTMLDivElement>(null);
    
        const [isPlaying, setIsPlaying] = useState(false);
        const [volume, setVolume] = useState(1);
        const [isMuted, setIsMuted] = useState(false);
        const [progress, setProgress] = useState(0);
        const [duration, setDuration] = useState(0);
        const [isControlsVisible, setIsControlsVisible] = useState(false);
        const [playbackRate, setPlaybackRate] = useState(1);
        const playbackRates = [0.75, 1, 1.25, 1.5];
        const { isFullscreen, toggleFullscreen } = useFullscreen(videoContainerRef);
        const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);
        const [mediaContainerRef, isVisible] = useLazyLoad<HTMLDivElement>();

        const handleAIAssistantClick = (e: React.MouseEvent) => {
            e.stopPropagation();
            openModal({
                id: project.id,
                title: project.aiSummary,
                content: project.description,
                author: project.author.name
            });
        };
        
        const togglePlayPause = (e?: React.MouseEvent) => {
            e?.stopPropagation();
            if (videoRef.current) {
                if (videoRef.current.paused) {
                    videoRef.current.play();
                } else {
                    videoRef.current.pause();
                }
            }
        };
        
        useEffect(() => {
            if (videoRef.current) {
                videoRef.current.playbackRate = playbackRate;
            }
        }, [playbackRate]);
    
        const handleTimeUpdate = () => {
            if (videoRef.current) {
                setProgress(videoRef.current.currentTime);
            }
        };
    
        const handleLoadedMetadata = () => {
            if (videoRef.current) {
                setDuration(videoRef.current.duration);
            }
        };
    
        const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
            if (videoRef.current) {
                videoRef.current.currentTime = Number(e.target.value);
                setProgress(Number(e.target.value));
            }
        };
    
         const handleProgressPointerDown = (e: React.PointerEvent<HTMLInputElement>) => {
            e.stopPropagation();
            if (videoRef.current) {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const width = rect.width;
                const duration = videoRef.current.duration;
                if (duration > 0) {
                    const seekTime = (clickX / width) * duration;
                    videoRef.current.currentTime = seekTime;
                    setProgress(seekTime);
                }
            }
        };
        
        const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const newVolume = Number(e.target.value);
            if (videoRef.current) {
                videoRef.current.muted = false;
                setIsMuted(false);
                videoRef.current.volume = newVolume;
                setVolume(newVolume);
                if (newVolume === 0) {
                    setIsMuted(true);
                }
            }
        };
        
        const toggleMute = (e: React.MouseEvent) => {
            e.stopPropagation();
            if (videoRef.current) {
                const newMutedState = !videoRef.current.muted;
                videoRef.current.muted = newMutedState;
                if (!newMutedState && volume === 0) {
                    setVolume(1); // Unmute to full volume if it was 0
                    videoRef.current.volume = 1;
                }
            }
        };
    
        const formatTime = (timeInSeconds: number) => {
            if (isNaN(timeInSeconds) || timeInSeconds <= 0) return '00:00';
            const minutes = Math.floor(timeInSeconds / 60);
            const seconds = Math.floor(timeInSeconds % 60);
            return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        };
    
        const toggleFullScreen = (e: React.MouseEvent) => {
            e.stopPropagation();
            toggleFullscreen();
        };
    
        const cyclePlaybackRate = (e: React.MouseEvent) => {
            e.stopPropagation();
            const currentIndex = playbackRates.indexOf(playbackRate);
            const nextIndex = (currentIndex + 1) % playbackRates.length;
            setPlaybackRate(playbackRates[nextIndex]);
        };
    
        const rawRoles = currentProject.collabDetails?.roles;
        const normalizedRoles: any[] = Array.isArray(rawRoles)
            ? rawRoles
            : (rawRoles && typeof rawRoles === 'object' ? Object.values(rawRoles) : []);

        const allSkills = Array.from(new Set(
            normalizedRoles.flatMap((r: any) => Array.isArray(r?.skills) ? r.skills : (typeof r?.skills === 'string' ? [r.skills] : []))
        ));

        const collabDomain = currentProject.domain || currentProject.category;

        const postForEditing: Post = {
            id: currentProject.id,
            authorId: currentProject.authorId,
            author: currentProject.author,
            aiSummary: currentProject.aiSummary,
            content: currentProject.description,
            mediaUrl: currentProject.mediaUrl,
            mediaType: currentProject.mediaType,
            thumbnailUrl: currentProject.thumbnailUrl,
            stats: currentProject.stats,
            type: PostType.Collab,
            category: currentProject.category,
            domain: currentProject.domain,
            createdAt: currentProject.createdAt,
            collabDetails: currentProject.collabDetails,
        };
    
        return (
            <>
                <div className="bg-[#0c0c0e] border border-zinc-800 p-5 mb-4 hover:border-zinc-700 transition-colors">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <img src={currentProject.author?.avatarUrl || `https://picsum.photos/seed/${currentProject.id}/200`} onError={handleImageError} alt={currentProject.author?.name || 'Author'} className="w-10 h-10 border border-zinc-700 object-cover" />
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="font-bold text-white font-mono text-sm">{currentProject.author?.name || 'Anonymous'}</p>
                                {currentProject.author?.isVerified && <CheckBadgeIcon className="w-4 h-4 text-zinc-400" />}
                                {collabDomain && (
                                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-300">
                                        {collabDomain}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-1 text-zinc-400">
                            <button onClick={handleAIAssistantClick} className="p-1.5 hover:text-white border border-transparent hover:border-zinc-800 transition-colors"><SparklesIcon className="w-5 h-5" /></button>
                            <div className="relative">
                                <button 
                                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                                    className="p-1.5 hover:text-white border border-transparent hover:border-zinc-800 transition-colors"
                                >
                                    <EllipsisVerticalIcon className="w-5 h-5" />
                                </button>
                                {isMenuOpen && (
                                    <div className="absolute right-0 mt-1 w-44 bg-[#0c0c0e] border border-zinc-800 shadow-2xl py-1 z-30 font-mono">
                                        <button 
                                            onClick={() => {
                                                if (navigator.share) {
                                                    navigator.share({ title: currentProject.name, url: window.location.href });
                                                } else {
                                                    navigator.clipboard.writeText(window.location.href);
                                                }
                                                setIsMenuOpen(false);
                                            }}
                                            className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-900 hover:text-white uppercase tracking-wider flex items-center gap-2"
                                        >
                                            <ForwardIcon className="w-3.5 h-3.5" />
                                            <span>Share Collab</span>
                                        </button>
                                        {canEdit && (
                                            <button 
                                                onClick={() => { setIsEditModalOpen(true); setIsMenuOpen(false); }}
                                                className="w-full text-left px-3 py-2 text-xs text-white hover:bg-zinc-900 uppercase tracking-wider flex items-center gap-2 border-t border-zinc-800/80 mt-1"
                                            >
                                                <PencilSquareIcon className="w-3.5 h-3.5 text-zinc-400" />
                                                <span>// EDIT</span>
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
        
                    {/* Content */}
                    <div className="mt-4 space-y-2.5 font-mono">
                        {/* Hook */}
                        <p className="text-base font-semibold text-white leading-snug">"{currentProject.aiSummary}"</p>

                        {/* Project Overview */}
                        <p className="text-zinc-300 text-xs leading-relaxed">
                            {showMore ? currentProject.description : `${currentProject.description.substring(0, 160)}${currentProject.description.length > 160 ? '...' : ''}`}
                        </p>

                        {/* Structured Collaboration Details */}
                        {currentProject.collabDetails && (
                            <div className="p-3.5 bg-black/60 border border-zinc-800 space-y-2.5 text-xs">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {/* LOOKING FOR */}
                                    {normalizedRoles.length > 0 && (
                                        <div>
                                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block mb-1">// LOOKING FOR</span>
                                            <div className="space-y-1">
                                                {normalizedRoles.map((r: any, idx: number) => (
                                                    <div key={idx} className="text-xs text-white font-medium flex items-center justify-between bg-zinc-900/80 px-2 py-1 border border-zinc-800">
                                                        <span>{r.title}</span>
                                                        <span className="text-[10px] text-zinc-400 font-bold">×{r.count || 1}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* SKILLS */}
                                    {allSkills.length > 0 && (
                                        <div>
                                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block mb-1">// SKILLS</span>
                                            <div className="flex flex-wrap gap-1 text-xs">
                                                {allSkills.slice(0, 8).map((s, idx) => (
                                                    <span key={idx} className="text-[10px] bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 text-zinc-300">
                                                        {s}
                                                    </span>
                                                ))}
                                                {allSkills.length > 8 && (
                                                    <span className="text-[10px] text-zinc-500 px-1">+{allSkills.length - 8}</span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Status & Collaboration */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-zinc-800/80">
                                    {project.collabDetails.projectStatus && (
                                        <div>
                                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block mb-0.5">// PROJECT STATUS</span>
                                            <span className="text-xs text-white font-bold bg-zinc-900 border border-zinc-700 px-2 py-0.5 inline-block">
                                                {project.collabDetails.projectStatus}
                                            </span>
                                        </div>
                                    )}

                                    {(project.collabDetails.collabTypes || project.collabDetails.location) && (
                                        <div>
                                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block mb-0.5">// COLLABORATION</span>
                                            <span className="text-xs text-zinc-300">
                                                {[
                                                    ...(project.collabDetails.collabTypes || []),
                                                    project.collabDetails.location === 'Specific Location' 
                                                        ? project.collabDetails.specificLocation 
                                                        : project.collabDetails.location
                                                ].filter(Boolean).join(' • ') || 'Open Collaboration • Remote'}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Extended Details (Role responsibilities, who can collaborate) */}
                                {showMore && (
                                    <div className="pt-2.5 border-t border-zinc-800/80 space-y-2.5">
                                        {/* Detailed Role Responsibilities */}
                                        {normalizedRoles.some((r: any) => r.responsibilities) && (
                                            <div className="space-y-1.5">
                                                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">// ROLE RESPONSIBILITIES</span>
                                                {normalizedRoles.map((r: any, idx: number) => r.responsibilities ? (
                                                    <div key={`resp-${idx}`} className="bg-zinc-950 p-2 border border-zinc-800/80">
                                                        <span className="text-white font-bold text-[11px] block">{r.title}:</span>
                                                        <p className="text-zinc-400 text-[11px] leading-relaxed mt-0.5">{r.responsibilities}</p>
                                                    </div>
                                                ) : null)}
                                            </div>
                                        )}

                                        {/* Who Can Collaborate Snapshot */}
                                        {(project.collabDetails.experience || project.collabDetails.background || project.collabDetails.availability) && (
                                            <div className="space-y-1">
                                                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">// WHO CAN COLLABORATE</span>
                                                <div className="flex flex-wrap gap-2 text-[11px] text-zinc-400 bg-zinc-950 p-2 border border-zinc-800/80">
                                                    {project.collabDetails.experience && (
                                                        <div><span className="text-zinc-500 font-bold">EXPERIENCE:</span> <span className="text-zinc-200">{project.collabDetails.experience}</span></div>
                                                    )}
                                                    {project.collabDetails.background && (
                                                        <div><span className="text-zinc-500 font-bold">BACKGROUND:</span> <span className="text-zinc-200">{project.collabDetails.background}</span></div>
                                                    )}
                                                    {project.collabDetails.availability && (
                                                        <div><span className="text-zinc-500 font-bold">AVAILABILITY:</span> <span className="text-zinc-200">{project.collabDetails.availability}</span></div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* View Details / Show Less button */}
                        <div className="flex justify-end pt-1">
                            <button 
                                onClick={() => setShowMore(!showMore)} 
                                className="text-white font-bold text-xs uppercase tracking-wider underline hover:text-zinc-300 transition-colors"
                            >
                                {showMore ? '// SHOW LESS' : '// VIEW DETAILS'}
                            </button>
                        </div>
                    </div>
                    
                    {/* Media */}
                    {project.mediaUrl && (
                        <div className="mt-4">
                            <AspectRatioBox
                                ref={mediaContainerRef}
                                ratio="video"
                                className={`border border-zinc-800 bg-black group ${!isVisible || (!isVideo ? 'cursor-zoom-in' : 'cursor-pointer')}`}
                                onMouseEnter={() => setIsControlsVisible(true)}
                                onMouseLeave={() => setIsControlsVisible(false)}
                                onClick={isVisible ? (isVideo ? togglePlayPause : () => setZoomedImageUrl(project.mediaUrl || null)) : undefined}
                            >
                                {isVisible ? (
                                    isVideo ? (
                                       <>
                                            <video
                                                ref={videoRef}
                                                src={project.mediaUrl}
                                                poster={project.thumbnailUrl}
                                                onTimeUpdate={handleTimeUpdate}
                                                onLoadedMetadata={handleLoadedMetadata}
                                                onPlay={() => setIsPlaying(true)}
                                                onPause={() => setIsPlaying(false)}
                                                onEnded={() => setIsPlaying(false)}
                                                muted={isMuted}
                                                playsInline
                                                className="w-full h-full object-cover"
                                            />
                                            
                                            <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${!isPlaying ? 'opacity-100' : 'opacity-0'} bg-black/40 pointer-events-none`}>
                                                <div className="w-16 h-16 bg-black/80 border border-zinc-700 flex items-center justify-center backdrop-blur-sm">
                                                    <PlayIcon className="w-8 h-8 text-white" />
                                                </div>
                                            </div>
                                            
                                            <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-3 transition-opacity duration-300 ${isControlsVisible || !isPlaying ? 'opacity-100' : 'opacity-0'}`} onClick={(e) => e.stopPropagation()}>
                                                <div className="w-full mb-2">
                                                     <input
                                                        type="range"
                                                        min="0"
                                                        max={duration || 0}
                                                        value={progress}
                                                        onChange={handleSeek}
                                                        onPointerDown={handleProgressPointerDown}
                                                        className="w-full h-1 bg-zinc-800 appearance-none cursor-pointer accent-white"
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between gap-4 text-white font-mono">
                                                    <div className="flex items-center gap-3">
                                                        <button onClick={togglePlayPause} className="p-1 hover:text-zinc-300 transition-colors">
                                                            {isPlaying ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
                                                        </button>
                                                        <div className="flex items-center gap-2 group/volume">
                                                            <button onClick={toggleMute} className="p-1 hover:text-zinc-300 transition-colors">
                                                                {isMuted || volume === 0 ? <VolumeOffIcon className="w-5 h-5" /> : <VolumeUpIcon className="w-5 h-5" />}
                                                            </button>
                                                            <input
                                                                type="range"
                                                                min="0"
                                                                max="1"
                                                                step="0.01"
                                                                value={isMuted ? 0 : volume}
                                                                onChange={handleVolumeChange}
                                                                className="w-0 h-1 bg-zinc-800 appearance-none cursor-pointer accent-white transition-all duration-300 opacity-0 group-hover/volume:opacity-100 group-hover/volume:w-20"
                                                            />
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-2 text-xs">
                                                        <span className="font-mono text-[11px] text-zinc-400 w-24 text-center">{formatTime(progress)} / {formatTime(duration)}</span>
                                                        <button onClick={cyclePlaybackRate} className="text-[11px] font-bold w-12 text-center p-1 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-colors">
                                                            {playbackRate.toFixed(2)}x
                                                        </button>
                                                        <button onClick={toggleFullScreen} className="p-1 hover:text-zinc-300 transition-colors">
                                                            {isFullscreen ? <ArrowsPointingInIcon className="w-5 h-5" /> : <ArrowsPointingOutIcon className="w-5 h-5" />}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <img src={project.mediaUrl} onError={handleImageError} alt="Project visual" className="w-full h-full object-cover" />
                                    )
                                ) : (
                                    <MediaPlaceholder thumbnailUrl={project.thumbnailUrl} isVideo={isVideo} />
                                )}
                            </AspectRatioBox>
                            <div className="flex justify-center items-center gap-1 mt-2">
                                <div className="w-1.5 h-1.5 bg-white"></div>
                                <div className="w-1.5 h-1.5 bg-zinc-700"></div>
                                <div className="w-1.5 h-1.5 bg-zinc-700"></div>
                            </div>
                        </div>
                    )}
                    
                    {/* Action Bar */}
                    <div className="mt-4 border border-zinc-800 px-4 py-2 flex justify-around items-center bg-black font-mono text-xs">
                        <button className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors">
                            <ArrowUpIcon className="w-4 h-4" />
                            <span className="font-semibold">{formatNumber(project.stats.likes)}</span>
                        </button>
                        <div className="flex items-center gap-1.5 text-zinc-400">
                            <TrendingUpIcon className="w-4 h-4" />
                            <span className="font-semibold">{formatNumber(project.stats.views)}</span>
                        </div>
                        <button className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors">
                            <ChatBubbleBottomCenterTextIcon className="w-4 h-4" />
                            <span className="font-semibold">{formatNumber(project.stats.comments)}</span>
                        </button>
                        <button className="text-zinc-400 hover:text-white transition-colors"><ForwardIcon className="w-4 h-4" /></button>
                        <button className="text-zinc-400 hover:text-white transition-colors"><BookmarkIcon className="w-4 h-4" /></button>
                    </div>
        
                     {/* Collaborate Button */}
                    <div className="mt-3">
                        {isOwner ? (
                            <div className="w-full bg-zinc-950 border border-zinc-800 text-zinc-500 font-mono text-xs uppercase font-bold py-2.5 text-center flex items-center justify-center gap-2">
                                <span>// YOUR COLLAB (CREATOR)</span>
                            </div>
                        ) : (() => {
                            const userCollabApps = collabApps.filter(a => a.applicantId === currentUser?.uid);
                            const acceptedApp = userCollabApps.find(a => a.status === 'ACCEPTED');
                            const pendingApp = userCollabApps.find(a => a.status === 'PENDING');
                            const allRolesFilled = normalizedRoles.length > 0 && normalizedRoles.every((r: any) => {
                                const cap = getRoleCapacity(r, collabApps);
                                return cap.isFilled;
                            });

                            if (acceptedApp) {
                                return (
                                    <div className="w-full bg-emerald-950/40 border border-emerald-800/80 text-emerald-400 font-mono text-xs uppercase font-bold py-2.5 px-3 text-center flex items-center justify-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                        <span>// ACCEPTED • {acceptedApp.roleTitle}</span>
                                    </div>
                                );
                            }

                            if (pendingApp) {
                                return (
                                    <div className="w-full bg-amber-950/30 border border-amber-800/80 text-amber-400 font-mono text-xs uppercase font-bold py-2.5 px-3 text-center flex items-center justify-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                        <span>// APPLICATION SENT • {pendingApp.roleTitle} (PENDING)</span>
                                    </div>
                                );
                            }

                            if (allRolesFilled) {
                                return (
                                    <button disabled className="w-full bg-zinc-950 border border-zinc-800 text-zinc-600 font-mono text-xs uppercase font-bold py-2.5 cursor-not-allowed text-center">
                                        // ROLES FILLED
                                    </button>
                                );
                            }

                            return (
                                <button 
                                    onClick={() => setIsApplyModalOpen(true)}
                                    className="w-full bg-zinc-900 border border-zinc-800 text-white font-mono text-xs uppercase font-bold py-2.5 hover:bg-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer"
                                >
                                    // COLLABORATE
                                </button>
                            );
                        })()}
                    </div>
        
                </div>
                <ImageZoomModal 
                    isOpen={!!zoomedImageUrl} 
                    onClose={() => setZoomedImageUrl(null)} 
                    imageUrl={zoomedImageUrl || ''}
                />
                <EditPostModal
                    isOpen={isEditModalOpen}
                    post={postForEditing}
                    onClose={() => setIsEditModalOpen(false)}
                    onUpdated={(updatedPost) => {
                        setCurrentProject(prev => ({
                            ...prev,
                            aiSummary: updatedPost.aiSummary,
                            description: updatedPost.content,
                            collabDetails: updatedPost.collabDetails,
                            domain: updatedPost.domain,
                            category: updatedPost.category,
                            mediaUrl: updatedPost.mediaUrl,
                            mediaType: updatedPost.mediaType,
                        }));
                    }}
                />
                <CollabApplicationModal
                    isOpen={isApplyModalOpen}
                    collab={currentProject}
                    onClose={() => setIsApplyModalOpen(false)}
                    onApplied={(newApp) => {
                        setCollabApps(prev => [...prev.filter(a => a.id !== newApp.id), newApp]);
                    }}
                />
            </>
        );
    };

    const OfferDetailsView: React.FC<{ 
        offerType: string, 
        onBack: () => void, 
        userName: string | null | undefined,
        viewedOfferIds: string[],
        onViewOffer: (offerId: string) => void,
        offers: Offer[],
        onAcceptOffer: (offerId: string) => void,
        onDeclineOffer: (offerId: string) => void,
        initialStatus: 'New' | 'Active' | 'Expired',
        onOpenMessageModal: (offer: Offer) => void,
        savedOfferIds: string[],
        toggleSaveOffer: (offerId: string) => void
    }> = ({ offerType, onBack, userName, viewedOfferIds, onViewOffer, offers, onAcceptOffer, onDeclineOffer, initialStatus, onOpenMessageModal, savedOfferIds, toggleSaveOffer }) => {
        const [activeOfferStatusTab, setActiveOfferStatusTab] = useState<'New' | 'Active' | 'Expired'>(initialStatus);
        const [loading, setLoading] = useState(true);
        const [viewingOffer, setViewingOffer] = useState<Offer | null>(null);
        const [infoModalOffer, setInfoModalOffer] = useState<Offer | null>(null);
        const offerStatuses = ['New', 'Active', 'Expired'];

        const openOfferModal = (offer: Offer) => {
            setViewingOffer(offer);
        };

        const handleCloseOfferModal = () => {
            if (viewingOffer && viewingOffer.status === 'New') {
                onViewOffer(viewingOffer.id);
            }
            setViewingOffer(null);
        };
    
        useEffect(() => {
            setLoading(true);
            const timer = setTimeout(() => {
                setLoading(false);
            }, 500);
            return () => clearTimeout(timer);
        }, [activeOfferStatusTab]);
    
        useEffect(() => {
            setActiveOfferStatusTab(initialStatus);
        }, [initialStatus, offerType]);
    
        const handleAccept = (offerId: string) => {
            onAcceptOffer(offerId);
        };
    
        const handleDecline = (offerId: string) => {
            onDeclineOffer(offerId);
        };
    
        const filteredOffers = offers.filter(offer =>
            offer.type === offerType && offer.status === activeOfferStatusTab
        );
      
        const OfferCard: React.FC<{ offer: Offer, onView: (offer: Offer) => void, isViewed: boolean }> = ({ offer, onView, isViewed }) => {
            const renderButtons = () => {
                const viewLetterButton = (
                    <button 
                        onClick={() => onView(offer)} 
                        className="bg-zinc-900 border border-zinc-800 text-white font-mono text-xs uppercase px-4 py-1.5 hover:bg-zinc-800 transition-colors"
                    >
                        View Letter
                    </button>
                );
        
                switch (offer.status) {
                    case 'New':
                        return (
                            <>
                                <button onClick={() => onView(offer)} className="bg-white text-black font-mono text-xs font-bold uppercase px-4 py-1.5 hover:bg-zinc-200 transition-colors">View Offer</button>
                            </>
                        );
                    case 'Active':
                        return (
                            <>
                                <span className="bg-zinc-900 border border-zinc-700 text-zinc-300 font-mono text-[10px] uppercase px-2.5 py-1">Accepted</span>
                                {viewLetterButton}
                                <button
                                    onClick={() => onOpenMessageModal(offer)}
                                    className="bg-zinc-900 border border-zinc-800 text-white font-mono text-xs uppercase px-4 py-1.5 hover:bg-zinc-800 transition-colors"
                                >
                                    Message
                                </button>
                            </>
                        );
                    case 'Expired':
                         return (
                            <>
                                <span className="bg-zinc-950 border border-zinc-800 text-zinc-500 font-mono text-[10px] uppercase px-2.5 py-1">Expired</span>
                                {viewLetterButton}
                            </>
                         );
                    default:
                        return null;
                }
            };
            
            return (
              <div className={`bg-[#0c0c0e] p-4 border transition-all duration-300 ${
                offer.status === 'New' && !isViewed ? 'border-zinc-500' : 'border-zinc-800'
              } hover:border-zinc-700`}>
                <div className="flex items-start gap-4">
                  <img src={offer.companyAvatarUrl} onError={handleImageError} alt={offer.companyName} className="w-12 h-12 border border-zinc-700 object-cover flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-bold text-white font-mono text-sm">{offer.companyName}</p>
                    <h4 className="font-mono font-semibold text-base text-zinc-200 mt-0.5">{offer.title}</h4>
                  </div>
                  <button
                      onClick={() => setInfoModalOffer(offer)}
                      className="p-1 text-zinc-500 hover:text-white transition-colors flex-shrink-0"
                      aria-label="View offer details"
                  >
                      <InformationCircleIcon className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-xs font-mono text-zinc-400 mt-2 line-clamp-2 leading-relaxed">
                    {offer.description}
                </p>
                <div className="flex justify-end items-center gap-3 mt-4 pt-3 border-t border-zinc-800">
                   <span className="text-[11px] font-mono text-zinc-500 mr-auto">Received {offer.createdAt}</span>
                   {renderButtons()}
                </div>
              </div>
            );
        };

        return (
          <div className="text-white">
            <div className="flex items-center gap-4 mb-4">
                <button onClick={onBack} className="p-1.5 text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-600 transition-colors">
                    <ArrowLeftIcon className="w-5 h-5" />
                </button>
                <h2 className="text-xl font-bold font-mono uppercase tracking-wide">{offerType}</h2>
            </div>
            <div className="border-t border-zinc-800 mb-4" />
      
            <div className="flex space-x-1 border border-zinc-800 p-1 bg-black mb-6">
                {offerStatuses.map(status => (
                    <button
                        key={status}
                        onClick={() => setActiveOfferStatusTab(status as 'New' | 'Active' | 'Expired')}
                        className={`flex-1 py-2 font-mono text-xs uppercase transition-colors ${
                            activeOfferStatusTab === status ? 'bg-white text-black font-bold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                        }`}
                    >
                        {status}
                    </button>
                ))}
            </div>
      
            <div className="space-y-3">
                {loading ? (
                    <>
                        <OfferCardSkeleton />
                        <OfferCardSkeleton />
                    </>
                ) : filteredOffers.length > 0 ? (
                    filteredOffers.map(offer => <OfferCard key={offer.id} offer={offer} onView={openOfferModal} isViewed={viewedOfferIds.includes(offer.id)} />)
                ) : (
                    <div className="text-center py-16 text-zinc-500 font-mono text-xs">
                        <p>NO {activeOfferStatusTab.toUpperCase()} OFFERS FOUND IN {offerType.toUpperCase()}.</p>
                    </div>
                )}
            </div>
            
            {viewingOffer && (
                <OfferLetterModal
                    offer={viewingOffer}
                    userName={currentUser?.displayName}
                    onClose={handleCloseOfferModal}
                    onAccept={handleAccept}
                    onDecline={handleDecline}
                />
            )}
            {infoModalOffer && (
                <OpportunityDetailModal
                    offer={infoModalOffer}
                    onClose={() => setInfoModalOffer(null)}
                    savedOfferIds={savedOfferIds}
                    toggleSaveOffer={toggleSaveOffer}
                    showActions={false}
                />
            )}
          </div>
        );
    };
    
    
    const OfferLetterModal: React.FC<{
        offer: Offer;
        userName: string | null | undefined;
        onClose: () => void;
        onAccept: (id: string) => void;
        onDecline: (id: string) => void;
    }> = ({ offer, userName, onClose, onAccept, onDecline }) => {
        const [isAccepted, setIsAccepted] = useState(false);
        const [isDeclined, setIsDeclined] = useState(false);
        const [confirmationAction, setConfirmationAction] = useState<'accept' | 'decline' | null>(null);
    
        const handleAcceptClick = () => {
            setConfirmationAction('accept');
        };
    
        const handleDeclineClick = () => {
            setConfirmationAction('decline');
        };
        
        const handleConfirm = () => {
            if (confirmationAction === 'accept') {
                setIsAccepted(true);
                setTimeout(() => {
                    onAccept(offer.id);
                    onClose();
                }, 1500);
            } else if (confirmationAction === 'decline') {
                setIsDeclined(true);
                setTimeout(() => {
                    onDecline(offer.id);
                    onClose();
                }, 1500);
            }
            setConfirmationAction(null);
        };
    
        const handleCancel = () => {
            setConfirmationAction(null);
        };
    
        return (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-50 p-4 transition-opacity duration-300" onClick={onClose}>
                <div className="bg-[#0c0c0e] border border-zinc-800 shadow-2xl w-full max-w-3xl flex flex-col mx-4" onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div className="flex justify-between items-center p-5 border-b border-zinc-800">
                        <div className="flex items-center gap-4">
                            <img src={offer.companyAvatarUrl} onError={handleImageError} alt={offer.companyName} className="w-12 h-12 border border-zinc-700 object-cover" />
                            <div>
                                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 block">// OFFER_LETTER</span>
                                <h2 className="text-lg font-bold font-mono text-white">{offer.title}</h2>
                                <p className="text-zinc-400 font-mono text-xs">{offer.companyName}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-600 transition-colors">
                            <CloseIcon />
                        </button>
                    </div>
    
                    {/* Body */}
                    <div className="p-8 overflow-y-auto max-h-[65vh] text-zinc-300 font-mono text-xs leading-relaxed space-y-4">
                        <p>DEAR {userName ? userName.toUpperCase() : 'CANDIDATE'},</p>
                        
                        <p className="font-bold text-white text-sm">SUBJECT: INVITATION TO COLLABORATION: {offer.title.toUpperCase()} AT {offer.companyName.toUpperCase()}</p>
                        <div className="w-full border-t border-zinc-800" />

                        <p>
                            We have been following your work on Invox and are particularly impressed with the projects you have showcased. Your skills and technical background seem like a strong match for an active opportunity we have available.
                        </p>
    
                        <p className="whitespace-pre-wrap bg-zinc-950 p-4 border border-zinc-800/80 text-zinc-300">{offer.description}</p>
                        
                        <p>
                            We believe you would be an exceptional asset to our team for this role. If this opportunity interests you, please accept this offer to proceed to the next technical steps.
                        </p>
                        
                        <div className="pt-4 border-t border-zinc-800">
                            <p className="text-zinc-500">SINCERELY,</p>
                            <p className="font-bold text-white mt-1">{offer.companyName.toUpperCase()}</p>
                        </div>
                    </div>
                    
                    {/* Footer */}
                    <div className="flex justify-end items-center gap-3 p-4 border-t border-zinc-800 bg-black min-h-[64px]">
                        <span className="text-[11px] font-mono text-zinc-500 mr-auto">Received {offer.createdAt}</span>
                        {offer.status === 'Active' ? (
                            <div className="flex items-center gap-2 text-zinc-300 font-mono text-xs">
                                <CheckCircleIcon className="w-5 h-5 text-white"/>
                                <span className="font-bold">OFFER ACCEPTED</span>
                            </div>
                        ) : offer.status === 'Expired' ? (
                            <div className="flex items-center gap-2 text-zinc-500 font-mono text-xs">
                                <XCircleIcon className="w-5 h-5" />
                                <span>OFFER EXPIRED</span>
                            </div>
                        ) : isAccepted ? (
                            <div className="flex items-center gap-2 text-white font-mono text-xs animate-pulse">
                                <CheckBadgeIcon className="w-5 h-5"/>
                                <span className="font-bold">OFFER ACCEPTED</span>
                            </div>
                        ) : isDeclined ? (
                            <div className="flex items-center gap-2 text-zinc-400 font-mono text-xs animate-pulse">
                                <InformationCircleIcon className="w-5 h-5"/>
                                <span>OFFER DECLINED</span>
                            </div>
                        ) : confirmationAction ? (
                            <div className="w-full flex justify-between items-center font-mono text-xs">
                                <p className="text-zinc-300">
                                    Confirm {confirmationAction} offer?
                                </p>
                                <div className="flex items-center gap-2">
                                    <button onClick={handleCancel} className="bg-zinc-900 border border-zinc-800 px-4 py-1.5 text-zinc-300 uppercase hover:text-white transition-colors">
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleConfirm}
                                        className={`px-4 py-1.5 uppercase font-bold transition-colors ${
                                            confirmationAction === 'accept' ? 'bg-white text-black hover:bg-zinc-200' : 'bg-zinc-800 text-white hover:bg-zinc-700'
                                        }`}
                                    >
                                        Yes, {confirmationAction}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <button onClick={handleDeclineClick} className="bg-black border border-zinc-800 text-zinc-400 font-mono text-xs uppercase px-5 py-2 hover:text-white hover:border-zinc-600 transition-colors">Decline</button>
                                <button onClick={handleAcceptClick} className="bg-white text-black font-mono text-xs uppercase font-bold px-6 py-2 hover:bg-zinc-200 transition-colors">Accept</button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    };
    
    
    const OfferCardSkeleton = () => (
        <div className="bg-[#0c0c0e] p-4 border border-zinc-800 animate-pulse">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-zinc-800 flex-shrink-0"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 bg-zinc-800"></div>
              <div className="h-4 w-3/4 bg-zinc-800"></div>
              <div className="h-3 w-1/4 bg-zinc-800"></div>
            </div>
          </div>
          <div className="flex justify-end items-center gap-3 mt-4 pt-4 border-t border-zinc-800">
             <div className="h-3 w-16 bg-zinc-800 mr-auto"></div>
             <div className="h-7 w-20 bg-zinc-800"></div>
          </div>
        </div>
    );
    
    const Pings = ({ setSelectedOfferType, offers }: { 
        setSelectedOfferType: (type: 'Full-Time' | 'Invites' | 'Gigs' | 'Others') => void,
        offers: Offer[],
    }) => {
        const [activeOfferFilter, setActiveOfferFilter] = useState('All');
        const [loading, setLoading] = useState(true);
        const [searchTerm, setSearchTerm] = useState('');
        const offerTypeFilters = ['All', 'Full-Time', 'Invites', 'Gigs', 'Others'];

        const baseOffersData = [
            { name: 'Full-Time', imageUrl: 'https://picsum.photos/seed/megaphone/100' },
            { name: 'Invites', imageUrl: 'https://picsum.photos/seed/envelope/100' },
            { name: 'Gigs', imageUrl: 'https://picsum.photos/seed/workbox/100' },
            { name: 'Others', imageUrl: 'https://picsum.photos/seed/piechart/100' },
        ];
    
        const offersData = baseOffersData.map(offerType => ({
            ...offerType,
            hasNotification: offers.some(o => o.type === offerType.name && o.status === 'New'),
        }));
    
        useEffect(() => {
            setLoading(true);
            const timer = setTimeout(() => {
                setLoading(false);
            }, 1500);
            return () => clearTimeout(timer);
        }, [activeOfferFilter]);
    
        const filteredActiveOffers = offers.filter(offer => {
            if (offer.status !== 'Active') {
                return false;
            }
    
            const typeMatch = activeOfferFilter === 'All' || offer.type === activeOfferFilter;
    
            const searchTermLower = searchTerm.toLowerCase().trim();
            const searchMatch = !searchTermLower ||
                offer.companyName.toLowerCase().includes(searchTermLower) ||
                offer.title.toLowerCase().includes(searchTermLower);
    
            return typeMatch && searchMatch;
        });
    
        return (
            <div className="text-white space-y-6">
                {/* Offers section */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">// INBOUND_OFFERS</span>
                        <h3 className="text-sm font-bold font-mono uppercase tracking-wide">Category Directives</h3>
                    </div>
                    <div className="w-full border-t border-zinc-800 mb-4" />
        
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {offersData.map(offer => (
                            <button
                                key={offer.name}
                                onClick={() => {
                                    setSelectedOfferType(offer.name as 'Full-Time' | 'Invites' | 'Gigs' | 'Others');
                                    setInitialOfferStatus('New');
                                }}
                                className={`w-full text-left relative bg-[#0c0c0e] border p-4 flex items-center justify-between h-20 transition-all duration-200 group ${
                                    offer.hasNotification ? 'border-zinc-500 hover:border-zinc-300' : 'border-zinc-800 hover:border-zinc-600'
                                }`}
                            >
                                <div className="flex items-center">
                                    <div className="flex-shrink-0 relative w-12 h-12 flex items-center justify-center border border-zinc-800 bg-zinc-950">
                                        <img src={offer.imageUrl} onError={handleImageError} alt={offer.name} className="relative z-10 w-9 h-9 object-contain" />
                                    </div>
                                    <div className="ml-3">
                                        <span className="text-sm font-mono font-bold text-white uppercase block">{offer.name}</span>
                                        <span className="text-[10px] font-mono text-zinc-500 uppercase">View Status</span>
                                    </div>
                                </div>
                                {offer.hasNotification && (
                                    <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-900 border border-zinc-700">
                                        <span className="w-1.5 h-1.5 bg-white animate-ping"></span>
                                        <span className="text-[9px] font-mono font-bold text-white uppercase tracking-wider">NEW</span>
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
    
                {/* Actives section */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">// ACTIVE_ENGAGEMENTS</span>
                        <h3 className="text-sm font-bold font-mono uppercase tracking-wide">Accepted Pipeline</h3>
                    </div>
                    <div className="w-full border-t border-zinc-800 mb-4" />
        
                    <div className="relative mb-3">
                        <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input 
                            type="search" 
                            placeholder="SEARCH ACCEPTED OFFERS..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-[#0c0c0e] border border-zinc-800 p-2.5 pl-10 font-mono text-xs focus:border-zinc-500 focus:outline-none text-white placeholder:text-zinc-600" 
                        />
                    </div>
                    
                    <div className="w-full bg-[#09090b] border border-zinc-800/90 p-1 grid grid-cols-5 gap-1 mb-4">
                        {offerTypeFilters.map(filter => {
                            const isActive = activeOfferFilter === filter;
                            return (
                                <button
                                    key={filter}
                                    onClick={() => setActiveOfferFilter(filter)}
                                    className={`py-2 px-1 sm:px-3 text-center font-mono text-[11px] sm:text-xs uppercase tracking-wider transition-all duration-150 flex items-center justify-center ${
                                        isActive
                                            ? 'bg-[#18181b] border border-zinc-700 text-white font-bold shadow-sm'
                                            : 'bg-transparent border border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30'
                                    }`}
                                >
                                    <span>{filter}</span>
                                </button>
                            );
                        })}
                    </div>
        
                    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 no-scrollbar">
                        {loading ? (
                            <>
                               <PingCardSkeleton />
                               <PingCardSkeleton />
                               <PingCardSkeleton />
                               <PingCardSkeleton />
                            </>
                        ) : filteredActiveOffers.length > 0 ? (
                            filteredActiveOffers.map(offer => (
                                <div 
                                    key={offer.id} 
                                    onClick={() => handleOpenMessageModal(offer)}
                                    className="bg-[#0c0c0e] p-3 border border-zinc-800 flex items-center justify-between gap-3 transition-colors cursor-pointer hover:border-zinc-600 hover:bg-zinc-950"
                                >
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="w-10 h-10 bg-zinc-900 flex items-center justify-center border border-zinc-800 flex-shrink-0">
                                            <img src={offer.companyAvatarUrl} onError={handleImageError} alt={offer.companyName} className="w-10 h-10 object-cover" />
                                        </div>
                                        <div className="overflow-hidden">
                                            <p className="font-mono font-bold text-xs truncate text-white uppercase">{offer.companyName}</p>
                                            <p className="font-mono text-xs text-zinc-400 truncate mt-0.5">{offer.title}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end flex-shrink-0">
                                        <p className="text-[10px] font-mono text-zinc-500 mb-1 whitespace-nowrap">{offer.createdAt}</p>
                                        <div className="flex items-center justify-end h-5">
                                            {offer.hasNewMessage && (
                                                <span className="w-2 h-2 bg-white animate-pulse"></span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-12 text-zinc-500 font-mono text-xs border border-dashed border-zinc-800">
                                <p>NO ACTIVE ENGAGEMENTS MATCHING CRITERIA.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };
    
    const BrowseProjectsView = () => {
        const [browseSearchTerm, setBrowseSearchTerm] = useState('');
        const [selectedCategory, setSelectedCategory] = useState('All');
        const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
        const [visiblePerCategory, setVisiblePerCategory] = useState<Record<string, number>>({});
        const filterDropdownRef = useRef<HTMLDivElement>(null);

        // Close dropdown when clicking outside
        useEffect(() => {
            if (!isFilterDropdownOpen) return;
            const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
                if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) {
                    setIsFilterDropdownOpen(false);
                }
            };
            document.addEventListener('mousedown', handleOutsideClick);
            document.addEventListener('touchstart', handleOutsideClick);
            return () => {
                document.removeEventListener('mousedown', handleOutsideClick);
                document.removeEventListener('touchstart', handleOutsideClick);
            };
        }, [isFilterDropdownOpen]);

        // Section isolation: Showcase vs Collabs
        const sectionProjects = React.useMemo(() => {
            if (activeTab === 'Collabs') {
                return browseCollabProjects.filter(p => Boolean(p.collabDetails) || isCollabSignal(p as any));
            } else {
                return browseShowcaseProjects.filter(p => !p.collabDetails && !isCollabSignal(p as any));
            }
        }, [activeTab, browseCollabProjects, browseShowcaseProjects]);

        // Available categories for the active section
        const availableCategories = React.useMemo(() => {
            const set = new Set<string>();
            sectionProjects.forEach(p => {
                const cat = p.category || p.domain;
                if (cat && typeof cat === 'string' && cat.trim()) {
                    set.add(cat.trim());
                }
            });
            const sorted = Array.from(set).sort((a, b) => a.localeCompare(b));
            return ['All', ...sorted];
        }, [sectionProjects]);

        // Reset category filter if selected category is not in the active section
        useEffect(() => {
            if (selectedCategory !== 'All' && !availableCategories.includes(selectedCategory)) {
                setSelectedCategory('All');
            }
        }, [availableCategories, selectedCategory]);

        // Filter projects by search and category
        const filteredProjects = React.useMemo(() => {
            const query = browseSearchTerm.trim().toLowerCase();
            return sectionProjects.filter(project => {
                // Category match
                if (selectedCategory !== 'All') {
                    const cat = (project.category || project.domain || '').toLowerCase().trim();
                    const filter = selectedCategory.toLowerCase().trim();
                    if (cat !== filter && !matchesProjectCategoryOrDomain(project, selectedCategory)) {
                        return false;
                    }
                }

                // Search match: name/title, category/domain, creator display name or username
                if (query) {
                    const title = (project.title || project.name || '').toLowerCase();
                    const summary = (project.aiSummary || project.oneLine || '').toLowerCase();
                    const hook = ((project as any).hook || '').toLowerCase();
                    const description = (project.description || '').toLowerCase();
                    const category = (project.category || '').toLowerCase();
                    const domain = (project.domain || '').toLowerCase();
                    const authorName = (project.author?.name || '').toLowerCase();
                    const authorUsername = (project.author?.username || '').toLowerCase();
                    const tags = Array.isArray(project.tags) ? project.tags.map(t => t.toLowerCase()).join(' ') : '';
                    const roleTitles = project.collabDetails?.roles?.map(r => (r.title || '').toLowerCase()).join(' ') || '';

                    const matches = 
                        title.includes(query) ||
                        hook.includes(query) ||
                        summary.includes(query) ||
                        description.includes(query) ||
                        category.includes(query) ||
                        domain.includes(query) ||
                        authorName.includes(query) ||
                        authorUsername.includes(query) ||
                        tags.includes(query) ||
                        roleTitles.includes(query);

                    if (!matches) return false;
                }

                return true;
            });
        }, [sectionProjects, selectedCategory, browseSearchTerm]);

        // Group into category buckets
        const groupedCategories = React.useMemo(() => {
            if (filteredProjects.length === 0) return [];

            const map = new Map<string, Project[]>();
            filteredProjects.forEach(proj => {
                const cat = (proj.category || proj.domain || 'Technology').trim();
                const list = map.get(cat) || [];
                list.push(proj);
                map.set(cat, list);
            });

            return Array.from(map.entries()).map(([category, projects]) => ({
                category,
                projects,
            }));
        }, [filteredProjects]);

        const isSectionLoading = activeTab === 'Collabs' ? loading : showcaseLoading;

        const handleLoadMore = (category: string) => {
            setVisiblePerCategory(prev => ({
                ...prev,
                [category]: (prev[category] || 5) + 5,
            }));
        };

        return (
            <div className="space-y-4">
                <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input 
                        type="search" 
                        value={browseSearchTerm}
                        onChange={(e) => setBrowseSearchTerm(e.target.value)}
                        placeholder="SEARCH PROJECTS BY NAME, CATEGORY, OR CREATOR..." 
                        className="w-full bg-[#0c0c0e] border border-zinc-800 p-2.5 pl-10 pr-10 font-mono text-xs focus:border-zinc-500 focus:outline-none text-white placeholder:text-zinc-600 transition-colors" 
                    />
                    {browseSearchTerm && (
                        <button
                            type="button"
                            onClick={() => setBrowseSearchTerm('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors cursor-pointer"
                            title="Clear search"
                        >
                            <CloseIcon className="w-4 h-4" />
                        </button>
                    )}
                </div>
                <div>
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-bold font-mono uppercase tracking-wide text-zinc-300">EXPLORE_SUGGESTIONS</span>
                        <div className="relative" ref={filterDropdownRef}>
                            <button 
                                type="button"
                                onClick={() => setIsFilterDropdownOpen(prev => !prev)}
                                className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-xs text-zinc-300 font-mono uppercase hover:text-white hover:border-zinc-600 transition-colors cursor-pointer"
                                aria-expanded={isFilterDropdownOpen}
                            >
                                <FilterIcon className="w-4 h-4 text-zinc-500" />
                                <span>{selectedCategory === 'All' ? 'Filter by' : `Filter: ${selectedCategory}`}</span>
                                <ChevronDownIcon className={`w-4 h-4 text-zinc-500 transition-transform duration-150 ${isFilterDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isFilterDropdownOpen && (
                                <div className="absolute right-0 mt-1.5 w-52 bg-[#0c0c0e] border border-zinc-800 shadow-2xl z-40 py-1 max-h-64 overflow-y-auto no-scrollbar">
                                    <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest text-zinc-500 border-b border-zinc-800/80 mb-1">
                                        // SELECT CATEGORY
                                    </div>
                                    {availableCategories.map(cat => {
                                        const isSelected = selectedCategory === cat;
                                        return (
                                            <button
                                                key={cat}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedCategory(cat);
                                                    setIsFilterDropdownOpen(false);
                                                }}
                                                className={`w-full text-left px-3 py-1.5 font-mono text-xs uppercase tracking-wider flex items-center justify-between transition-colors cursor-pointer ${
                                                    isSelected 
                                                        ? 'bg-[#18181d] text-white font-bold' 
                                                        : 'text-zinc-400 hover:text-white hover:bg-zinc-900/60'
                                                }`}
                                            >
                                                <span>{cat}</span>
                                                {isSelected && <span className="w-1.5 h-1.5 bg-white"></span>}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div>
                      {isSectionLoading ? (
                        <div className="space-y-6">
                            {[...Array(3)].map((_, index) => (
                                <div key={index}>
                                    <div className="h-4 w-1/4 bg-zinc-800 mb-3 animate-pulse"></div>
                                    <div className="flex overflow-x-auto space-x-3 pb-2 no-scrollbar items-center">
                                        <div className="w-96 flex-shrink-0"><SuggestionCardSkeleton /></div>
                                        <div className="w-96 flex-shrink-0"><SuggestionCardSkeleton /></div>
                                        <div className="flex-shrink-0 w-36 h-48 bg-[#0c0c0e] border border-zinc-800 flex flex-col items-center justify-center">
                                            <div className="w-6 h-6 bg-zinc-800 mb-2"></div>
                                            <div className="h-3 w-16 bg-zinc-800"></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                      ) : groupedCategories.length > 0 ? (
                        groupedCategories.map((categoryData, index) => {
                          const visibleLimit = visiblePerCategory[categoryData.category] || 5;
                          const visibleProjects = categoryData.projects.slice(0, visibleLimit);
                          const hasMore = categoryData.projects.length > visibleLimit;

                          return (
                            <div key={`${categoryData.category}-${index}`} className="mb-6">
                              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400 mb-3 border-b border-zinc-800 pb-1.5">
                                {categoryData.category}
                              </h4>
                              <div className="flex overflow-x-auto space-x-3 pb-2 no-scrollbar items-center">
                                {visibleProjects.map(project => (
                                  <div key={project.id} className="w-96 flex-shrink-0">
                                      <SuggestionCard project={project} />
                                  </div>
                                ))}
                                {hasMore && (
                                  <button 
                                      onClick={() => handleLoadMore(categoryData.category)}
                                      className="flex-shrink-0 w-36 h-48 bg-[#0c0c0e] border border-zinc-800 flex flex-col items-center justify-center text-zinc-400 hover:border-zinc-600 hover:text-white transition-colors cursor-pointer"
                                  >
                                      <ForwardIcon className="w-6 h-6 mb-2 text-zinc-500" />
                                      <span className="font-mono text-xs uppercase font-semibold">Load More</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center py-16 text-zinc-400 font-mono text-xs border border-zinc-800 bg-[#0c0c0e] p-8 space-y-3">
                            <p className="text-zinc-200 text-sm font-semibold tracking-wide">// NO_PROJECTS_FOUND</p>
                            <p className="text-zinc-500 max-w-md mx-auto leading-relaxed">
                                {browseSearchTerm 
                                    ? `No ${activeTab.toLowerCase()} projects match "${browseSearchTerm}"${selectedCategory !== 'All' ? ` in ${selectedCategory}` : ''}.`
                                    : `No ${activeTab.toLowerCase()} projects found${selectedCategory !== 'All' ? ` for category "${selectedCategory}"` : ''}.`}
                            </p>
                            {(browseSearchTerm || selectedCategory !== 'All') && (
                                <div className="flex items-center justify-center gap-3 pt-3">
                                    {browseSearchTerm && (
                                        <button
                                            onClick={() => setBrowseSearchTerm('')}
                                            className="px-4 py-2 border border-zinc-700 bg-zinc-900 text-white font-mono text-xs hover:bg-zinc-800 transition-colors cursor-pointer uppercase tracking-wider"
                                        >
                                            Clear Search
                                        </button>
                                    )}
                                    {selectedCategory !== 'All' && (
                                        <button
                                            onClick={() => setSelectedCategory('All')}
                                            className="px-4 py-2 border border-zinc-700 bg-zinc-900 text-white font-mono text-xs hover:bg-zinc-800 transition-colors cursor-pointer uppercase tracking-wider"
                                        >
                                            Reset Category
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                      )}
                    </div>
                </div>
            </div>
        );
    };
    
    const BrowseProfilesView = () => (
        <div className="space-y-4">
            <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input 
                    type="search" 
                    placeholder="SEARCH PROFILES BY NAME OR DOMAIN..." 
                    className="w-full bg-[#0c0c0e] border border-zinc-800 p-2.5 pl-10 font-mono text-xs focus:border-zinc-500 focus:outline-none text-white placeholder:text-zinc-600" 
                />
            </div>
            <div>
                <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-bold font-mono uppercase tracking-wide text-zinc-300">EXPLORE_PROFILES</span>
                    <button className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-xs text-zinc-300 font-mono uppercase hover:text-white hover:border-zinc-600 transition-colors">
                        <FilterIcon className="w-4 h-4 text-zinc-500" />
                        <span>Filter by</span>
                        <ChevronDownIcon className="w-4 h-4 text-zinc-500" />
                    </button>
                </div>
                
                <div>
                  {loading ? (
                    <div className="space-y-6">
                        {[...Array(2)].map((_, index) => (
                            <div key={index}>
                                <div className="h-4 w-1/4 bg-zinc-800 mb-3 animate-pulse"></div>
                                <div className="flex overflow-x-auto space-x-3 pb-2 no-scrollbar items-center">
                                    <div className="w-96 flex-shrink-0"><ProfileSuggestionCardSkeleton /></div>
                                    <div className="w-96 flex-shrink-0"><ProfileSuggestionCardSkeleton /></div>
                                    <div className="flex-shrink-0 w-36 h-48 bg-[#0c0c0e] border border-zinc-800 flex flex-col items-center justify-center">
                                        <div className="w-6 h-6 bg-zinc-800 mb-2"></div>
                                        <div className="h-3 w-16 bg-zinc-800"></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                  ) : (
                    profileSuggestionData.map((categoryData, index) => (
                      <div key={`${categoryData.category}-${index}`} className="mb-6">
                        <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400 mb-3 border-b border-zinc-800 pb-1.5">{categoryData.category}</h4>
                        <div className="flex overflow-x-auto space-x-3 pb-2 no-scrollbar items-center">
                          {categoryData.profiles.map(profile => (
                            <div key={profile.id} className="w-96 flex-shrink-0">
                                <ProfileSuggestionCard profile={profile} />
                            </div>
                          ))}
                          <button className="flex-shrink-0 w-36 h-48 bg-[#0c0c0e] border border-zinc-800 flex flex-col items-center justify-center text-zinc-400 hover:border-zinc-600 hover:text-white transition-colors">
                              <ForwardIcon className="w-6 h-6 mb-2 text-zinc-500" />
                              <span className="font-mono text-xs uppercase font-semibold">Load More</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
            </div>
        </div>
    );

    const GoForItView: React.FC<{ goforitFilters: { company: string, skills: string, location: string, opportunityType: string, category: string, experienceLevel: string, searchTerm: string } }> = ({ goforitFilters }) => {
        const [loading, setLoading] = useState(true);
        const [viewingOffer, setViewingOffer] = useState<Offer | null>(null);
        
        const outletContext = ReactRouterDOM.useOutletContext<{
            savedOfferIds: string[];
            toggleSaveOffer: (offerId: string) => void;
        }>();
        const { savedOfferIds, toggleSaveOffer } = outletContext || { savedOfferIds: [], toggleSaveOffer: () => {} };
        
        useEffect(() => {
            setLoading(true);
            const timer = setTimeout(() => {
                setLoading(false);
            }, 1000);
            return () => clearTimeout(timer);
        }, [goforitFilters]);
    
        const filteredOffers = mockOffers.filter(offer => {
            if (offer.status === 'Expired') return false;
    
            const searchTermMatch = (() => {
                if (!goforitFilters.searchTerm?.trim()) return true;
                const searchTermLower = goforitFilters.searchTerm.toLowerCase();
                return offer.title.toLowerCase().includes(searchTermLower) ||
                       offer.description.toLowerCase().includes(searchTermLower) ||
                       offer.companyName.toLowerCase().includes(searchTermLower);
            })();
    
            const typeMatch = goforitFilters.opportunityType === 'All' || offer.type === goforitFilters.opportunityType;
            const categoryMatch = goforitFilters.category === 'All' || offer.category === goforitFilters.category;
            const experienceMatch = goforitFilters.experienceLevel === 'All' || offer.experienceLevel === goforitFilters.experienceLevel;
            const companyMatch = !goforitFilters.company || offer.companyName.toLowerCase().includes(goforitFilters.company.toLowerCase());
            const locationMatch = !goforitFilters.location || (offer.location || '').toLowerCase().includes(goforitFilters.location.toLowerCase());
    
            const skillsMatch = (() => {
                if (!goforitFilters.skills.trim()) return true;
                const requiredSkills = goforitFilters.skills.toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
                if (requiredSkills.length === 0) return true;
                const offerSkills = (offer.skills || []).map(s => s.toLowerCase());
                return requiredSkills.every(reqSkill => offerSkills.some(offerSkill => offerSkill.includes(reqSkill)));
            })();
            
            return searchTermMatch && typeMatch && categoryMatch && experienceMatch && companyMatch && locationMatch && skillsMatch;
        });

        return (
            <div className="space-y-4">
                {loading ? (
                    <>
                       <GoForItOpportunityCardSkeleton />
                       <GoForItOpportunityCardSkeleton />
                       <GoForItOpportunityCardSkeleton />
                    </>
                ) : filteredOffers.length > 0 ? (
                    filteredOffers.map(offer => (
                        <GoForItOpportunityCard 
                            key={offer.id} 
                            offer={offer}
                            savedOfferIds={savedOfferIds}
                            toggleSaveOffer={toggleSaveOffer}
                            onViewDetails={() => setViewingOffer(offer)}
                        />
                    ))
                ) : (
                    <div className="text-center py-16 text-zinc-500 font-mono text-xs border border-dashed border-zinc-800">
                        <p>NO OPPORTUNITIES MATCH CURRENT FILTER CONSTRAINTS.</p>
                    </div>
                )}
                {viewingOffer && (
                    <OpportunityDetailModal
                        offer={viewingOffer}
                        onClose={() => setViewingOffer(null)}
                        savedOfferIds={savedOfferIds}
                        toggleSaveOffer={toggleSaveOffer}
                    />
                )}
            </div>
        );
    };

    const renderContent = () => {
        if (showPinnedHighlights) {
            return (
                <PinnedHighlightsView
                    loading={loading || showcaseLoading}
                    allProjects={allShowcaseProjects}
                    userSavedIds={userSavedIds}
                    userLikedIds={userLikedIds}
                    userFollowingIds={userFollowingIds}
                    onBackToShowcase={() => setShowPinnedHighlights?.(false)}
                    onBrowseShowcase={() => {
                        setShowPinnedHighlights?.(false);
                        handleTabChange('Showcase');
                    }}
                    onToggleFollowCreator={handleToggleFollowCreator}
                    onBookmarkToggle={handleBookmarkToggle}
                    onProjectDeleted={handleShowcaseDeleted}
                    onProjectUpdated={handleShowcaseUpdated}
                />
            );
        }

        if (showPinnedProfiles) {
            return (
                <PinnedProfilesFeedView
                    loading={loading || showcaseLoading}
                    allProjects={allShowcaseProjects}
                    userFollowingIds={userFollowingIds}
                    userLikedIds={userLikedIds}
                    userSavedIds={userSavedIds}
                    onBackToShowcase={() => setShowPinnedProfiles?.(false)}
                    onBrowseShowcase={() => {
                        setShowPinnedProfiles?.(false);
                        handleTabChange('Showcase');
                    }}
                    onToggleFollowCreator={handleToggleFollowCreator}
                    onBookmarkToggle={handleBookmarkToggle}
                    onProjectDeleted={handleShowcaseDeleted}
                    onProjectUpdated={handleShowcaseUpdated}
                />
            );
        }

        if (spotlightBrowseState === 'projects') return <BrowseProjectsView />;
        if (spotlightBrowseState === 'profiles') return <BrowseProfilesView />;

        if (activeTab === 'Leap') {
             if (selectedOfferType) {
                return <OfferDetailsView 
                    offerType={selectedOfferType} 
                    onBack={() => setSelectedOfferType(null)} 
                    userName={currentUser?.displayName} 
                    viewedOfferIds={viewedOfferIds}
                    onViewOffer={handleMarkOfferViewed}
                    offers={offers}
                    onAcceptOffer={handleAcceptOffer}
                    onDeclineOffer={handleDeclineOffer}
                    initialStatus={initialOfferStatus}
                    onOpenMessageModal={handleOpenMessageModal}
                    savedOfferIds={savedOfferIds || []}
                    toggleSaveOffer={toggleSaveOffer || (() => {})}
                />;
            }
            switch (activeLeapTab) {
                case 'Pings':
                    return <Pings setSelectedOfferType={setSelectedOfferType} offers={offers} />;
                case 'GoForIt':
                    return <GoForItView goforitFilters={goforitFilters || { company: '', skills: '', location: '', opportunityType: 'All', category: 'All', experienceLevel: 'All', searchTerm: '' }} />;
                default:
                    return <p>Select a tab</p>;
            }
        }
    
        if (activeTab === 'Showcase') {
            return (
                <ShowcaseView
                    projects={filteredShowcaseProjects}
                    loading={loading}
                    searchTerm={showcaseSearchTerm}
                    onSearchChange={setShowcaseSearchTerm}
                    sortOrder={showcaseSortOrder}
                    onSortChange={setShowcaseSortOrder}
                    onOpenCreate={() => setIsCreateShowcaseOpen(true)}
                    userLikedIds={userLikedIds}
                    userSavedIds={userSavedIds}
                    userFollowingIds={userFollowingIds}
                    onToggleFollowCreator={handleToggleFollowCreator}
                    onProjectDeleted={handleShowcaseDeleted}
                    onProjectUpdated={handleShowcaseUpdated}
                    onFilterByCategory={setActiveCategory}
                    onBookmarkToggle={handleBookmarkToggle}
                />
            );
        }
    
        if (activeTab === 'Collabs') {
            if (isCollabManagement) {
                if (collabViewParam === 'inbox') {
                    return (
                        <CollabMessageBoardView
                            view="inbox"
                            onBack={handleBackToCollabs}
                            initialConversationId={searchParams.get('conversationId')}
                        />
                    );
                }
                if (collabViewParam === 'teams' || searchParams.has('invite')) {
                    return (
                        <CollabTeamsView
                            onBack={handleBackToCollabs}
                            initialTeamId={searchParams.get('teamId')}
                        />
                    );
                }
                return (
                    <CollabManagementHub
                        initialTab={collabManagementTab}
                        viewMode="spotlight"
                        onClose={handleBackToCollabs}
                        onTabChange={(tab) => {
                            setSearchParams(prev => {
                                const next = new URLSearchParams(prev);
                                next.set('tab', 'Collabs');
                                next.set('collabView', tab === 'active' ? 'active' : (tab === 'my_applications' ? 'my_applications' : 'incoming'));
                                next.delete('openCollabDashboard');
                                return next;
                            });
                        }}
                        isModal={false}
                    />
                );
            }
            return <Collabs />;
        }
    
        return null;
    };
    

    return (
        <div className="space-y-4">
            {/* Top Navigation Bar: Exact Segmented Slide-Bar UI System from My Space / Explore */}
            {!selectedOfferType && !showPinnedHighlights && !spotlightBrowseState && !isCollabManagement && (
                <SegmentedSlideBar
                    tabs={mainTabs}
                    activeTab={activeTab}
                    onChange={(tab) => handleTabChange(tab as 'Showcase' | 'Collabs' | 'Leap')}
                />
            )}

            {/* Conditional Category & Domain Filters for Showcase / Collabs */}
            {!selectedOfferType && !showPinnedHighlights && activeTab !== 'Leap' && !spotlightBrowseState && !isCollabManagement && (
                <>
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-3 no-scrollbar">
                        {categoryFilters.map(category => (
                            <button
                                key={category}
                                onClick={() => setActiveCategory(category)}
                                className={`px-3 py-1.5 rounded-none font-mono text-xs uppercase tracking-wider whitespace-nowrap transition-all duration-150 border ${
                                    activeCategory === category
                                        ? 'bg-[#18181d] text-white border-zinc-700 font-bold'
                                        : 'bg-[#0c0c0e] text-zinc-400 border-zinc-800/90 hover:border-zinc-700 hover:text-white'
                                }`}
                            >
                                {category}
                            </button>
                        ))}
                    </div>

                    <DomainFilter 
                        domains={spotlightDomains}
                        selectedDomains={domainSelections[sectionKey] || []}
                        onSelectionChange={(domains) => setDomainSelection(sectionKey, domains)}
                    />
                </>
            )}
           
            {/* Sub-tabs for Leap */}
            {activeTab === 'Leap' && !selectedOfferType && !showPinnedHighlights && (
                <div className="flex border-b border-zinc-800 mb-5">
                    <button
                        onClick={() => handleLeapTabChange('GoForIt')}
                        className={`w-1/2 text-center py-2.5 text-xs font-mono uppercase tracking-widest transition-all duration-150 flex items-center justify-center gap-2 ${
                            activeLeapTab === 'GoForIt' 
                                ? 'border-b-2 border-zinc-400 text-white font-bold bg-zinc-900/40' 
                                : 'text-zinc-500 hover:text-zinc-300 border-b-2 border-transparent'
                        }`}
                    >
                        <span className="w-1.5 h-1.5 bg-zinc-300 opacity-0 transition-opacity" style={{ opacity: activeLeapTab === 'GoForIt' ? 1 : 0 }}></span>
                        <span>// Opportunities (GoForIt)</span>
                    </button>
                    <button
                        onClick={() => handleLeapTabChange('Pings')}
                        className={`w-1/2 text-center py-2.5 text-xs font-mono uppercase tracking-widest transition-all duration-150 flex items-center justify-center gap-2 ${
                            activeLeapTab === 'Pings' 
                                ? 'border-b-2 border-zinc-400 text-white font-bold bg-zinc-900/40' 
                                : 'text-zinc-500 hover:text-zinc-300 border-b-2 border-transparent'
                        }`}
                    >
                        <span className="w-1.5 h-1.5 bg-zinc-300 opacity-0 transition-opacity" style={{ opacity: activeLeapTab === 'Pings' ? 1 : 0 }}></span>
                        <span>// Inbound Pings</span>
                    </button>
                </div>
            )}
            
            {renderContent()}

            {messagingOffer && (
                <MessagingModal 
                    offer={messagingOffer} 
                    onClose={() => setMessagingOffer(null)} 
                    onView={() => {
                        // This logic could be more complex, e.g., opening a specific offer detail view
                        setMessagingOffer(null); 
                        setSelectedOfferType(messagingOffer.type);
                        setInitialOfferStatus(messagingOffer.status as 'New' | 'Active' | 'Expired');
                    }}
                    showViewButton={messagingOffer.type !== 'Invites' && messagingOffer.type !== 'Others'}
                />
            )}

            {/* Create Showcase Portfolio Modal */}
            <CreateShowcaseModal
                isOpen={isCreateShowcaseOpen}
                onClose={() => setIsCreateShowcaseOpen(false)}
                onPublished={() => {
                    setIsCreateShowcaseOpen(false);
                }}
            />
        </div>
    );
};

export default SpotlightPage;