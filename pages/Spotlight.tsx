import React, { useState, useEffect, useRef } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import type { Project, QuickCollab, ActivePing, Offer } from '../types';
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
import ImageZoomModal from '../components/ui/ImageZoomModal';
import GoForItOpportunityCard from '../components/spotlight/GoForItOpportunityCard';
import GoForItOpportunityCardSkeleton from '../components/spotlight/GoForItOpportunityCardSkeleton';
import { useAIAssistant } from '../contexts/AIAssistantContext';
import { useFilters } from '../contexts/AIAssistantContext';


const formatNumber = (num: number) => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000)}k`;
    return num;
};

const mockProjects: Project[] = [
    {
        id: 'proj-new-4',
        author: { name: 'Aisha Bello', avatarUrl: 'https://picsum.photos/id/22/200/200' },
        aiSummary: 'Open-source toolkit for detecting deepfakes.',
        description: 'A powerful and accessible library for developers and researchers to detect and analyze manipulated media. Using advanced deep learning models, our toolkit aims to combat misinformation by providing reliable deepfake detection capabilities.',
        mediaUrl: 'https://images.unsplash.com/photo-1504639725590-34d0984388bd?q=80&w=1974&auto=format&fit=crop',
        mediaType: 'image',
        stats: { likes: 132000, views: 52000000, comments: 24000 },
        category: 'Cybersecurity',
        createdAt: new Date(),
    },
    {
        id: 'proj-new-3',
        author: { name: 'Kenji Tanaka', avatarUrl: 'https://picsum.photos/id/21/200/200', isVerified: true },
        aiSummary: 'Gamified language learning app using VR.',
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
        author: { name: 'Crash Adams', avatarUrl: 'https://picsum.photos/id/10/200/200', isVerified: true },
        aiSummary: 'A decentralised social network with ethical AI.',
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
        author: { name: 'Marco Rossi', avatarUrl: 'https://picsum.photos/id/12/200/200' },
        aiSummary: 'Next-gen mobile app development framework.',
        description: 'A cross-platform framework designed for speed, performance, and a seamless developer experience. Build beautiful, native apps with a single codebase.',
        mediaUrl: 'https://images.unsplash.com/photo-1551650975-87deedd944c3?q=80&w=1974&auto=format&fit=crop',
        mediaType: 'image',
        stats: { likes: 72000, views: 28000000, comments: 8000 },
        category: 'App Development',
        createdAt: new Date(),
    },
    {
        id: 'proj4',
        author: { name: 'Dr. Evelyn Reed', avatarUrl: 'https://picsum.photos/id/13/200/200' },
        aiSummary: 'Ethical AI: Bias Detection in Language Models.',
        description: 'This project introduces a novel framework for identifying and mitigating biases in large-scale language models, ensuring fairer and more equitable AI systems.',
        mediaUrl: 'https://images.unsplash.com/photo-1620712943543-95fc6ih-p962453a?q=80&w=2070&auto=format&fit=crop',
        mediaType: 'image',
        stats: { likes: 150000, views: 45000000, comments: 22000 },
        category: 'Machine Learning',
        createdAt: new Date(),
    },
    {
        id: 'proj6',
        author: { name: 'Chloe Bennet', avatarUrl: 'https://picsum.photos/id/15/200/200', isVerified: true },
        aiSummary: 'A dynamic design system for modern web apps.',
        description: 'An open-source design system built with accessibility and scalability in mind. It includes a comprehensive set of React components and design tokens.',
        mediaUrl: 'https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?q=80&w=2070&auto=format&fit=crop',
        mediaType: 'image',
        stats: { likes: 89000, views: 12000000, comments: 16000 },
        category: 'Design',
        createdAt: new Date(),
    },
    {
        id: 'proj7',
        author: { name: 'Liam Johnson', avatarUrl: 'https://picsum.photos/id/16/200/200' },
        aiSummary: 'A real-time collaboration tool for developers.',
        description: 'A platform that allows developers to code, chat, and debug together in a shared environment, boosting productivity for remote teams.',
        mediaUrl: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?q=80&w=2070&auto=format&fit=crop',
        mediaType: 'image',
        stats: { likes: 110000, views: 19000000, comments: 14000 },
        category: 'App Development',
        createdAt: new Date(),
    }
];

const mockForYouProjects: Project[] = [
    {
        id: 'collab1',
        author: { name: 'Mc Benny', avatarUrl: 'https://picsum.photos/id/25/200/200', isVerified: true },
        aiSummary: 'Help design the future of collaborative workflows.',
        description: 'We are creating a new project management tool that integrates AI to streamline tasks and improve team communication. Seeking a senior product designer.',
        mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
        mediaType: 'video',
        thumbnailUrl: 'https://images.unsplash.com/photo-1500534623283-312aade485b7?q=80&w=1280&h=720&auto=format&fit=crop',
        stats: { likes: 87200, views: 42300000, comments: 11200 },
        category: 'Design',
        createdAt: new Date(),
    },
    {
        id: 'collab2',
        author: { name: 'Julia Chen', avatarUrl: 'https://picsum.photos/id/26/200/200', isVerified: true },
        aiSummary: 'Seeking a Backend Dev for a new Social App.',
        description: 'We are building a decentralized social media platform and need a skilled backend developer to help us with API design and database architecture. Join our mission to reshape social networking.',
        mediaUrl: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?q=80&w=1974&auto=format&fit=crop',
        mediaType: 'image',
        stats: { likes: 45000, views: 15000000, comments: 6500 },
        category: 'App Development',
        createdAt: new Date(),
    },
    {
        id: 'collab3',
        author: { name: 'QuantumLeap AI', avatarUrl: 'https://picsum.photos/id/27/200/200', isVerified: true },
        aiSummary: 'Data Scientist needed for an ML project.',
        description: 'Join QuantumLeap AI to work on a cutting-edge project involving predictive modeling for financial markets. We are looking for an experienced data scientist with a passion for machine learning.',
        mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
        mediaType: 'video',
        thumbnailUrl: 'https://images.unsplash.com/photo-1589762179979-0d8312d13b5a?q=80&w=1280&h=720&auto=format&fit=crop',
        stats: { likes: 125000, views: 62000000, comments: 21000 },
        category: 'Machine Learning',
        createdAt: new Date(),
    },
    {
        id: 'collab4',
        author: { name: 'Creative Studio', avatarUrl: 'https://picsum.photos/id/28/200/200' },
        aiSummary: 'UI/UX Designer for an exciting e-commerce platform.',
        description: 'We are looking for a creative UI/UX designer to revamp our e-commerce platform. You will be responsible for creating a visually appealing and user-friendly experience for millions of users.',
        mediaUrl: 'https://images.unsplash.com/photo-1487017159836-4e23ece2e4cf?q=80&w=2071&auto=format&fit=crop',
        mediaType: 'image',
        stats: { likes: 68000, views: 28000000, comments: 9800 },
        category: 'Design',
        createdAt: new Date(),
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
  };
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
                description: 'A visually stunning and modern UI for a music streaming app.',
                imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=2070&auto=format&fit=crop',
                upvotes: 15200,
            },
            {
                id: 'fin-1',
                author: { name: 'Fintech Solutions' },
                description: 'Sleek and professional dashboard for a new fintech platform.',
                imageUrl: 'https://images.unsplash.com/photo-1642139425433-e38000413346?q=80&w=1974&auto=format&fit=crop',
                upvotes: 12500,
            },
            {
                id: 'travel-1',
                author: { name: 'Wanderlust UI', isVerified: true },
                description: 'An inviting and user-friendly design for a travel planning app.',
                imageUrl: 'https://images.unsplash.com/photo-1522199755839-a2bacb67c546?q=80&w=2072&auto=format&fit=crop',
                upvotes: 18900,
            },
            {
                id: 'health-1',
                author: { name: 'FitTrack', isVerified: true },
                description: 'A clean and motivating UI for a health and fitness tracking app.',
                imageUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?q=80&w=2070&auto=format&fit=crop',
                upvotes: 16400,
            },
            {
                id: 'realestate-1',
                author: { name: 'PropDash' },
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
                description: 'A surreal and elegant artwork for a project named Elegant Mind.',
                imageUrl: 'https://images.unsplash.com/photo-1535378620166-273708d44e4c?q=80&w=1964&auto=format&fit=crop',
                upvotes: 21000,
            },
            {
                id: 'brand-1',
                author: { name: 'Urban Coffee Co.' },
                description: 'A comprehensive branding identity for a modern coffee shop.',
                imageUrl: 'https://images.unsplash.com/photo-1511920183234-52d34ba2d781?q=80&w=1974&auto=format&fit=crop',
                upvotes: 9800,
            },
            {
                id: 'poster-1',
                author: { name: 'Abstract Forms', isVerified: true },
                description: 'A series of abstract and minimalist poster designs exploring geometric forms.',
                imageUrl: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=2070&auto=format&fit=crop',
                upvotes: 11300,
            },
            {
                id: 'album-1',
                author: { name: 'Vinyl Dreams', isVerified: true },
                description: 'Vibrant and retro-inspired album cover art for an indie band.',
                imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1974&auto=format&fit=crop',
                upvotes: 14500,
            },
            {
                id: 'book-1',
                author: { name: 'Page Turner' },
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
                description: 'A highly detailed 3D model of a sci-fi character, a cyborg explorer.',
                imageUrl: 'https://images.unsplash.com/photo-1690575317136-234288b8e0a2?q=80&w=1964&auto=format&fit=crop',
                upvotes: 25600,
            },
            {
                id: 'arch-1',
                author: { name: 'Modern Structures' },
                description: 'A photorealistic architectural visualization of a modern house.',
                imageUrl: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?q=80&w=1974&auto=format&fit=crop',
                upvotes: 19400,
            },
            {
                id: 'fantasy-1',
                author: { name: 'DreamScapes' },
                description: 'An enchanting 3D render of a magical, floating island landscape.',
                imageUrl: 'https://images.unsplash.com/photo-16179354493866-df529a6d4b29?q=80&w=2070&auto=format&fit=crop',
                upvotes: 22300,
            },
            {
                id: 'product-1',
                author: { name: 'Precision Renders', isVerified: true },
                description: 'A stunning 3D product visualization of a luxury timepiece.',
                imageUrl: 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?q=80&w=2080&auto=format&fit=crop',
                upvotes: 18700,
            },
             {
                id: 'char-1',
                author: { name: 'Creature Forge' },
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
                description: 'A clean website design for an e-commerce store selling sustainable fashion.',
                imageUrl: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=2070&auto=format&fit=crop',
                upvotes: 16700,
            },
            {
                id: 'portfolio-1',
                author: { name: 'Digital Artist X' },
                description: 'An interactive and visually engaging portfolio website for a digital artist.',
                imageUrl: 'https://images.unsplash.com/photo-1496171367470-9ed9a91ea931?q=80&w=2070&auto=format&fit=crop',
                upvotes: 14200,
            },
            {
                id: 'blog-1',
                author: { name: 'The Scribe' },
                description: 'A modern, minimalist front-end for a new blogging platform.',
                imageUrl: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?q=80&w=2070&auto=format&fit=crop',
                upvotes: 11500,
            },
            {
                id: 'saas-1',
                author: { name: 'CloudFlow', isVerified: true },
                description: 'A compelling and high-converting landing page for a SaaS product.',
                imageUrl: 'https://images.unsplash.com/photo-1559028006-44d08c21a488?q=80&w=1974&auto=format&fit=crop',
                upvotes: 19800,
            },
            {
                id: 'corp-1',
                author: { name: 'Innovate Corp' },
                description: 'A professional and sleek corporate website with a focus on brand storytelling.',
                imageUrl: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?q=80&w=2232&auto=format&fit=crop',
                upvotes: 13500,
            },
        ],
    },
];

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
    <div className="bg-invox-dark-accent p-4 rounded-lg border border-gray-800 flex gap-4 min-h-48 animate-pulse">
        <div className="flex-1 flex flex-col">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gray-700"></div>
                <div className="h-4 w-24 bg-gray-700 rounded"></div>
            </div>
            <div className="mt-3 space-y-2 flex-grow">
                <div className="h-4 w-full bg-gray-700 rounded"></div>
                <div className="h-4 w-5/6 bg-gray-700 rounded"></div>
            </div>
            <div className="h-4 w-20 bg-gray-700 rounded mt-3"></div>
        </div>
        <div className="w-40 h-40 rounded-md bg-gray-700 self-center"></div>
    </div>
);

const ProfileSuggestionCardSkeleton = () => (
    <div className="bg-invox-dark-accent p-4 rounded-lg border border-gray-800 flex flex-col min-h-48 animate-pulse">
        <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-700"></div>
                <div className="h-6 w-24 bg-gray-700 rounded"></div>
            </div>
            <div className="w-24 h-8 bg-gray-700 rounded-lg"></div>
        </div>
        <div className="flex-grow space-y-2">
            <div className="h-4 w-full bg-gray-700 rounded"></div>
            <div className="h-4 w-5/6 bg-gray-700 rounded"></div>
        </div>
        <div className="flex justify-between items-center mt-auto pt-3">
            <div className="h-4 w-20 bg-gray-700 rounded"></div>
            <div className="h-4 w-20 bg-gray-700 rounded"></div>
        </div>
    </div>
);

const MediaPlaceholder: React.FC<{ thumbnailUrl?: string; isVideo: boolean }> = ({ thumbnailUrl, isVideo }) => {
    if (isVideo && thumbnailUrl) {
        return (
            <>
                <img src={thumbnailUrl} onError={handleImageError} alt="Video poster" className="w-full h-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                     <div className="w-20 h-20 bg-black/50 rounded-full flex items-center justify-center backdrop-blur-sm">
                        <PlayIcon className="w-10 h-10 text-white" />
                    </div>
                </div>
            </>
        );
    }
    return <div className="w-full h-full bg-gray-700"></div>;
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

        // Simulate a reply for demonstration purposes
        setTimeout(() => {
            const replyMessage: ChatMessage = { role: 'recipient', text: "Thank you for your message. We have received it and a representative will get back to you shortly." };
            setMessages(prev => [...prev, replyMessage]);
            setIsReplying(false);
        }, 1500);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-invox-dark-accent rounded-lg shadow-xl w-full max-w-2xl h-[80vh] flex flex-col p-4 border border-gray-800">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <img src={offer.companyAvatarUrl} onError={handleImageError} alt={offer.companyName} className="w-10 h-10 rounded-lg object-cover" />
                        <h2 className="text-xl font-bold text-white">{isInfoVisible ? "Offer Information" : offer.companyName}</h2>
                    </div>
                    <div className="flex items-center gap-4">
                        {showViewButton && (
                            <button
                                onClick={() => setIsInfoVisible(!isInfoVisible)}
                                className="p-2 rounded-full text-gray-300 hover:bg-gray-700 hover:text-white transition-all duration-200 transform hover:scale-105 active:scale-95"
                                aria-label={isInfoVisible ? "Back to chat" : "View offer information"}
                            >
                               {isInfoVisible ? <ChatIcon className="w-6 h-6" /> : <InformationCircleIcon className="w-6 h-6" />}
                            </button>
                        )}
                        <button onClick={onClose} className="text-gray-400 hover:text-white transition-transform duration-200 transform hover:scale-110 active:scale-100">
                            <CloseIcon />
                        </button>
                    </div>
                </div>
                <hr className="border-gray-800 my-4" />

                {isInfoVisible ? (
                    <div className="flex-grow overflow-y-auto pr-2 space-y-6 text-gray-300 p-4 bg-invox-dark rounded-lg border border-gray-800">
                        {/* Main Role Info */}
                        <div className="pb-4 border-b border-gray-800">
                            <div className="flex items-start gap-4">
                                <img src={offer.companyAvatarUrl} onError={handleImageError} alt={offer.companyName} className="w-14 h-14 rounded-lg object-cover" />
                                <div>
                                    <h3 className="text-2xl font-bold text-white leading-tight">{offer.title}</h3>
                                    <p className="text-gray-300 text-lg">{offer.companyName}</p>
                                </div>
                            </div>
                        </div>

                        {/* Job Details Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                            <div className="flex items-start gap-3">
                                <CubeIcon className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
                                <div>
                                    <p className="text-sm text-gray-400">Job Type</p>
                                    <p className="font-semibold text-white">{offer.type}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <MapPinIcon className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
                                <div>
                                    <p className="text-sm text-gray-400">Location</p>
                                    <p className="font-semibold text-white">{offer.location || 'N/A'}</p>
                                </div>
                            </div>
                             <div className="flex items-start gap-3">
                                <AcademicCapIcon className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
                                <div>
                                    <p className="text-sm text-gray-400">Experience Level</p>
                                    <p className="font-semibold text-white">{offer.experienceLevel || 'N/A'}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <CubeIcon className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
                                <div>
                                    <p className="text-sm text-gray-400">Category</p>
                                    <p className="font-semibold text-white">{offer.category || 'N/A'}</p>
                                </div>
                            </div>
                        </div>
                        
                        <hr className="border-gray-800" />

                        {/* Description */}
                        <div>
                            <h3 className="text-lg font-semibold text-white mb-2">Job Description</h3>
                            <p className="whitespace-pre-wrap leading-relaxed">{offer.description}</p>
                        </div>

                        {/* Skills */}
                        {offer.skills && offer.skills.length > 0 && (
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-2">Skills Required</h3>
                                <div className="flex flex-wrap gap-2">
                                    {offer.skills.map(skill => (
                                        <span key={skill} className="bg-gray-800/50 text-gray-300 px-3 py-1.5 rounded-md text-sm font-medium border border-gray-800">
                                            {skill}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        {(offer.createdAt || offer.acceptedAt) && <hr className="border-gray-800" />}

                        {/* Timeline */}
                        {(offer.createdAt || offer.acceptedAt) && (
                            <div>
                                <h4 className="font-semibold text-white mb-3 text-base">Timeline</h4>
                                <div className="space-y-4">
                                    {offer.createdAt && (
                                        <div className="flex items-center gap-3">
                                            <CalendarDaysIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                            <div>
                                                <p className="text-sm text-gray-400">Offer Received</p>
                                                <p className="font-semibold text-white">{offer.createdAt}</p>
                                            </div>
                                        </div>
                                    )}
                                    {offer.acceptedAt && (
                                        <div className="flex items-center gap-3">
                                            <CalendarDaysIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                            <div>
                                                <p className="text-sm text-gray-400">Offer Accepted</p>
                                                <p className="font-semibold text-white">{offer.acceptedAt}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                        {messages.map((msg, index) => (
                            <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-md p-3 rounded-lg ${msg.role === 'user' ? 'bg-invox-red text-white' : 'bg-gray-700 text-invox-light-gray'}`}>
                                    <p>{msg.text}</p>
                                </div>
                            </div>
                        ))}
                        {isReplying && (
                            <div className="flex justify-start">
                                <div className="max-w-md p-3 rounded-lg bg-gray-700 text-invox-light-gray">
                                    <div className="flex items-center space-x-2">
                                        <div className="w-2 h-2 bg-invox-light-gray rounded-full animate-pulse delay-75"></div>
                                        <div className="w-2 h-2 bg-invox-light-gray rounded-full animate-pulse delay-150"></div>
                                        <div className="w-2 h-2 bg-invox-light-gray rounded-full animate-pulse delay-300"></div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                )}
                
                {!isInfoVisible && (
                    <div className="mt-4 flex">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Type your message..."
                            className="flex-grow bg-gray-700 border border-gray-800 rounded-l-md p-3 focus:outline-none focus:ring-2 focus:ring-invox-red text-white"
                            disabled={isReplying}
                        />
                        <button onClick={handleSend} disabled={isReplying} className="bg-invox-red text-white px-4 rounded-r-md hover:bg-invox-red-hover disabled:bg-gray-500 flex items-center justify-center transition-transform duration-200 transform hover:scale-105 active:scale-95">
                            <SendIcon className="w-5 h-5"/>
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

    return (
        <>
            <div className="bg-invox-dark-accent rounded-lg border border-gray-800 p-4 mb-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <img src={project.author.avatarUrl} onError={handleImageError} alt={project.author.name} className="w-10 h-10 rounded-full object-cover" />
                        <div className="flex items-center gap-1">
                            <p className="font-bold text-white">{project.author.name}</p>
                            {project.author.isVerified && <CheckBadgeIcon className="w-5 h-5 text-blue-500" />}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-invox-light-gray">
                        <button onClick={handleAIAssistantClick} className="hover:text-white transition-transform duration-200 transform hover:scale-110 active:scale-100"><SparklesIcon className="w-6 h-6" /></button>
                        <button className="hover:text-white transition-transform duration-200 transform hover:scale-110 active:scale-100"><EllipsisVerticalIcon className="w-6 h-6" /></button>
                    </div>
                </div>
    
                {/* Content */}
                <div className="mt-4">
                    <p className="text-xl font-semibold italic text-white">"{project.aiSummary}"</p>
                    <p className="text-invox-light-gray mt-2">
                        {showMore ? project.description : `${project.description.substring(0, 150)}...`}
                        <button onClick={() => setShowMore(!showMore)} className="text-invox-red font-semibold ml-1 hover:underline">
                            {showMore ? 'Show Less' : 'Show More'}
                        </button>
                    </p>
                </div>
    
                {/* Media */}
                {project.mediaUrl && (
                     <div className="mt-4">
                        <AspectRatioBox
                            ref={mediaContainerRef}
                            ratio="video"
                            className={`rounded-2xl border border-gray-800 bg-invox-dark group ${!isVisible || (!isVideo ? 'cursor-zoom-in' : 'cursor-pointer')}`}
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
                                        
                                        <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${!isPlaying ? 'opacity-100' : 'opacity-0'} bg-black/30 pointer-events-none`}>
                                            <div className="w-20 h-20 bg-black/50 rounded-full flex items-center justify-center backdrop-blur-sm">
                                                <PlayIcon className="w-10 h-10 text-white" />
                                            </div>
                                        </div>
                                        
                                        <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 transition-opacity duration-300 ${isControlsVisible || !isPlaying ? 'opacity-100' : 'opacity-0'}`} onClick={(e) => e.stopPropagation()}>
                                            <div className="w-full mb-2">
                                                 <input
                                                    type="range"
                                                    min="0"
                                                    max={duration || 0}
                                                    value={progress}
                                                    onChange={handleSeek}
                                                    onPointerDown={handleProgressPointerDown}
                                                    className="w-full h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer accent-invox-red"
                                                />
                                            </div>
                                            <div className="flex items-center justify-between gap-4 text-white">
                                                <div className="flex items-center gap-3">
                                                    <button onClick={togglePlayPause} className="p-1.5 rounded-full hover:bg-white/25 transition-all duration-200 transform hover:scale-110 active:scale-100">
                                                        {isPlaying ? <PauseIcon className="w-6 h-6" /> : <PlayIcon className="w-6 h-6" />}
                                                    </button>
                                                    <div className="flex items-center gap-2 group/volume">
                                                        <button onClick={toggleMute} className="p-1.5 rounded-full hover:bg-white/25 transition-all duration-200 transform hover:scale-110 active:scale-100">
                                                            {isMuted || volume === 0 ? <VolumeOffIcon className="w-6 h-6" /> : <VolumeUpIcon className="w-6 h-6" />}
                                                        </button>
                                                        <input
                                                            type="range"
                                                            min="0"
                                                            max="1"
                                                            step="0.01"
                                                            value={isMuted ? 0 : volume}
                                                            onChange={handleVolumeChange}
                                                            className="w-0 h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer accent-invox-red transition-all duration-300 opacity-0 group-hover/volume:opacity-100 group-hover/volume:w-20"
                                                        />
                                                    </div>
                                                </div>
                                                
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-mono w-24 text-center">{formatTime(progress)} / {formatTime(duration)}</span>
                                                    <button onClick={cyclePlaybackRate} className="text-xs font-bold w-14 text-center p-1.5 rounded-full hover:bg-white/25 transition-all duration-200 transform hover:scale-110 active:scale-100">
                                                        {playbackRate.toFixed(2)}x
                                                    </button>
                                                    <button onClick={toggleFullScreen} className="p-1.5 rounded-full hover:bg-white/25 transition-all duration-200 transform hover:scale-110 active:scale-100">
                                                        {isFullscreen ? <ArrowsPointingInIcon className="w-6 h-6" /> : <ArrowsPointingOutIcon className="w-6 h-6" />}
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
                        <div className="flex justify-center items-center gap-1.5 mt-2">
                            <div className="w-2 h-2 bg-white rounded-full"></div>
                            <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                            <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                        </div>
                    </div>
                )}
                
                {/* Action Bar */}
                <div className="mt-4 border border-gray-800 rounded-lg px-4 py-2 flex justify-around items-center">
                    <button className="flex items-center gap-1.5 text-invox-light-gray hover:text-invox-red transition-all duration-200 transform hover:scale-110 active:scale-100">
                        <HeartIcon className="w-5 h-5" />
                        <span className="text-sm font-semibold">{formatNumber(project.stats.likes)}</span>
                    </button>
                    <div className="flex items-center gap-1.5 text-invox-light-gray">
                        <TrendingUpIcon className="w-5 h-5" />
                        <span className="text-sm font-semibold">{formatNumber(project.stats.views)}</span>
                    </div>
                    <button className="flex items-center gap-1.5 text-invox-light-gray hover:text-white transition-all duration-200 transform hover:scale-110 active:scale-100">
                        <ChatBubbleBottomCenterTextIcon className="w-5 h-5" />
                        <span className="text-sm font-semibold">{formatNumber(project.stats.comments)}</span>
                    </button>
                    <button className="text-invox-light-gray hover:text-white transition-all duration-200 transform hover:scale-110 active:scale-100"><ForwardIcon className="w-5 h-5" /></button>
                    <button className="text-invox-light-gray hover:text-white transition-all duration-200 transform hover:scale-110 active:scale-100"><BookmarkIcon className="w-5 h-5" /></button>
                </div>
    
                 {/* Connect Button */}
                <div className="mt-2">
                    <button className="w-full bg-invox-dark-accent border border-gray-800 text-white font-semibold py-2.5 rounded-lg hover:bg-gray-700 transition-all duration-200 transform hover:scale-[1.02] active:scale-100">
                        Connect
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

const PinnedHighlightsView: React.FC<{ loading: boolean }> = ({ loading }) => {
    const { domainSelections, setDomainSelection } = useFilters();
    const highlightedProjects = mockProjects.filter(project =>
        pinnedUserNames.includes(project.author.name)
    );
    return (
        <div>
            <div className="relative mb-4">
                <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input 
                    type="search" 
                    placeholder="Search Profiles You Follow" 
                    className="w-full bg-invox-dark-accent border border-gray-800 rounded-lg p-3 pl-11 focus:outline-none text-white" 
                />
            </div>
            <DomainFilter 
                domains={spotlightDomains}
                selectedDomains={domainSelections['spotlight-pinned'] || []}
                onSelectionChange={(domains) => setDomainSelection('spotlight-pinned', domains)}
            />
            <h2 className="text-2xl font-bold text-white mb-4">Pinned Highlights</h2>
            <p className="text-invox-light-gray mb-6">Showing projects from your pinned profiles.</p>
            {loading ? (
                <>
                    <ProjectCardSkeleton />
                    <ProjectCardSkeleton />
                </>
            ) : highlightedProjects.length > 0 ? (
                highlightedProjects.map(project => <ProjectCard key={project.id} project={project} />)
            ) : (
                <div className="text-center py-16 text-gray-400">
                    <p>No projects found from your pinned profiles.</p>
                </div>
            )}
        </div>
    );
};


export const SpotlightPage = () => {
    const { openModal } = useAIAssistant();
    const [searchParams, setSearchParams] = ReactRouterDOM.useSearchParams();
    const { domainSelections, setDomainSelection } = useFilters();

    const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'Showcase');
    const [activeLeapTab, setActiveLeapTab] = useState(() => searchParams.get('subTab') || 'GoForIt');
    const [activeCategory, setActiveCategory] = useState('All');
    const [loading, setLoading] = useState(true);
    const [offers, setOffers] = useState(mockOffers);
    const [selectedOfferType, setSelectedOfferType] = useState<'Full-Time' | 'Invites' | 'Gigs' | 'Others' | null>(null);
    const [initialOfferStatus, setInitialOfferStatus] = useState<'New' | 'Active' | 'Expired'>('New');
    const { currentUser } = useAuth();
    const [viewedOfferIds, setViewedOfferIds] = useState<string[]>([]);
    const [messagingOffer, setMessagingOffer] = useState<Offer | null>(null);
    const mainTabs = ['Showcase', 'Collabs', 'Leap'];
    const sectionKey = `spotlight-${activeTab.toLowerCase()}`;

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
                className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex justify-center items-center z-50 transition-opacity duration-300" 
                onClick={onClose}
                aria-modal="true"
                role="dialog"
                aria-labelledby="opportunity-detail-title"
            >
                <div 
                    className="bg-invox-dark-accent rounded-xl shadow-2xl w-full max-w-3xl flex flex-col border border-gray-800 m-4 max-h-[90vh]" 
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex justify-between items-start p-6 border-b border-gray-800 flex-shrink-0">
                        <div className="flex items-center gap-4">
                            <img src={offer.companyAvatarUrl} onError={handleImageError} alt={offer.companyName} className="w-16 h-16 rounded-lg object-cover" />
                            <div>
                                <h2 id="opportunity-detail-title" className="text-2xl font-bold text-white">{offer.title}</h2>
                                <p className="text-gray-400 text-lg">{offer.companyName}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="text-gray-400 hover:text-white transition-transform duration-200 transform hover:scale-110 active:scale-100" aria-label="Close opportunity details">
                            <CloseIcon />
                        </button>
                    </div>
    
                    {/* Body */}
                    <div className="p-6 overflow-y-auto text-gray-300 space-y-6">
                        {/* Job Details Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                            <div className="flex items-start gap-3">
                                <CubeIcon className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
                                <div>
                                    <p className="text-sm text-gray-400">Job Type</p>
                                    <p className="font-semibold text-white">{offer.type}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <MapPinIcon className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
                                <div>
                                    <p className="text-sm text-gray-400">Location</p>
                                    <p className="font-semibold text-white">{offer.location || 'N/A'}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <AcademicCapIcon className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
                                <div>
                                    <p className="text-sm text-gray-400">Experience Level</p>
                                    <p className="font-semibold text-white">{offer.experienceLevel || 'N/A'}</p>
                                </div>
                            </div>
                             <div className="flex items-start gap-3">
                                <CubeIcon className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
                                <div>
                                    <p className="text-sm text-gray-400">Category</p>
                                    <p className="font-semibold text-white">{offer.category || 'N/A'}</p>
                                </div>
                            </div>
                        </div>
                        
                        <hr className="border-gray-800" />
                        
                        {/* Description */}
                        <div>
                            <h3 className="text-lg font-semibold text-white mb-2">Job Description</h3>
                            <p className="whitespace-pre-wrap leading-relaxed">{offer.description}</p>
                        </div>
    
                        {/* Skills */}
                        {offer.skills && offer.skills.length > 0 && (
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-2">Skills Required</h3>
                                 <div className="flex flex-wrap gap-2">
                                    {offer.skills.map(skill => (
                                        <span key={skill} className="bg-gray-800/50 text-gray-300 px-3 py-1.5 rounded-md text-sm font-medium border border-gray-800">
                                            {skill}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        {(offer.createdAt || offer.acceptedAt) && <hr className="border-gray-800" />}

                        {/* Timeline */}
                        {(offer.createdAt || offer.acceptedAt) && (
                            <div>
                                <h4 className="font-semibold text-white mb-3 text-base">Timeline</h4>
                                <div className="space-y-4">
                                    {offer.createdAt && (
                                        <div className="flex items-center gap-3">
                                            <CalendarDaysIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                            <div>
                                                <p className="text-sm text-gray-400">Offer Received</p>
                                                <p className="font-semibold text-white">{offer.createdAt}</p>
                                            </div>
                                        </div>
                                    )}
                                    {offer.acceptedAt && (
                                        <div className="flex items-center gap-3">
                                            <CalendarDaysIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                            <div>
                                                <p className="text-sm text-gray-400">Offer Accepted</p>
                                                <p className="font-semibold text-white">{offer.acceptedAt}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
    
                    {/* Footer */}
                    <div className="flex-shrink-0 flex justify-between items-center gap-4 p-4 border-t border-gray-800 bg-invox-dark rounded-b-xl">
                        <span className="text-sm text-gray-500">Posted {offer.createdAt}</span>
                        {showActions && (
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => toggleSaveOffer(offer.id)}
                                    className={`flex items-center gap-2 border px-6 py-2.5 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 active:scale-95 ${
                                        isSaved
                                        ? 'bg-invox-dark-accent border-gray-800 text-white hover:bg-gray-700'
                                        : 'bg-invox-dark-accent border-gray-800 text-white hover:bg-gray-700'
                                    }`}
                                >
                                    {isSaved ? <BookmarkIconSolid className="w-5 h-5" /> : <BookmarkIcon className="w-5 h-5" />}
                                    {isSaved ? 'Saved' : 'Save'}
                                </button>
                                <button onClick={handleApply} className="bg-green-600 px-8 py-2.5 rounded-lg font-semibold text-white text-center hover:bg-green-700 transition-all duration-200 transform hover:scale-105 active:scale-95 inline-block">
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

    const outletContext = ReactRouterDOM.useOutletContext<{
        setRightSidebarVariant: (variant: string) => void;
        spotlightBrowseState: string | null;
        setSpotlightBrowseState: (filter: string | null) => void;
        showPinnedHighlights: boolean;
        setShowPinnedHighlights: (show: boolean) => void;
        goforitFilters: { company: string, skills: string, location: string, opportunityType: string, category: string, experienceLevel: string, searchTerm: string };
        refreshKey: number;
        savedOfferIds: string[];
        toggleSaveOffer: (offerId: string) => void;
    }>();

    const { setRightSidebarVariant, spotlightBrowseState, setSpotlightBrowseState, showPinnedHighlights, goforitFilters, refreshKey, savedOfferIds, toggleSaveOffer } = outletContext || {};

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

        // Sync state to URL
        const newSearchParams = new URLSearchParams();
        newSearchParams.set('tab', activeTab);
        if (activeTab === 'Leap') {
            newSearchParams.set('subTab', activeLeapTab);
        }
        // Use replace: true to avoid adding a new entry to the history stack for tab changes.
        setSearchParams(newSearchParams, { replace: true });

        return () => {
            if (setRightSidebarVariant) {
                setRightSidebarVariant('default');
            }
            if (setSpotlightBrowseState) {
                setSpotlightBrowseState(null);
            }
        };
    }, [activeTab, activeLeapTab, setRightSidebarVariant, setSpotlightBrowseState, setSearchParams]);

    useEffect(() => {
        setLoading(true);
        const timer = setTimeout(() => {
            setLoading(false);
        }, 1500);
        return () => clearTimeout(timer);
    }, [activeTab, activeCategory, spotlightBrowseState, showPinnedHighlights, activeLeapTab, refreshKey]);

    useEffect(() => {
        // Scroll to top whenever tabs, filters, or view states change
        document.querySelector('main')?.scrollTo(0, 0);
    }, [activeTab, activeCategory, selectedOfferType, spotlightBrowseState, showPinnedHighlights, activeLeapTab]);

    const filteredShowcaseProjects = mockProjects.filter(project =>
        activeCategory === 'All' || project.category === activeCategory
    );

    const filteredCollabProjects = mockForYouProjects.filter(project =>
        activeCategory === 'All' || project.category === activeCategory
    );
    
    const Showcase = ({ projects }: { projects: Project[] }) => (
        <div>
            {loading ? (
                <>
                    <ProjectCardSkeleton />
                    <ProjectCardSkeleton />
                </>
            ) : projects.length > 0 ? (
                projects.map(project => <ProjectCard key={project.id} project={project} />)
            ) : (
                <div className="text-center py-16 text-gray-400">
                    <p>No projects found for this category.</p>
                </div>
            )}
        </div>
    );
    
    const Collabs = () => (
        <div className="text-white">
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
    
    const SuggestionCard: React.FC<{ project: Suggestion }> = ({ project }) => {
      const [imageRef, isVisible] = useLazyLoad<HTMLImageElement>();
      return (
        <div className="bg-invox-dark-accent p-4 rounded-lg border border-gray-800 flex gap-4 min-h-48">
          <div className="flex-1 flex flex-col">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center border border-gray-800">
                <ProfileIcon className="w-5 h-5 text-gray-400" />
              </div>
              <p className="font-bold text-white text-base">{project.author.name}</p>
              {project.author.isVerified && <CheckBadgeIcon className="w-5 h-5 text-blue-500" />}
            </div>
            <p className="text-sm text-invox-light-gray mt-3 flex-grow">{project.description}</p>
            <hr className="border-gray-800 my-3" />
            <p className="text-base font-semibold text-invox-light-gray">
              Upvotes : <span className="text-yellow-400">{formatNumber(project.upvotes)}</span>
            </p>
          </div>
          <div ref={imageRef} className="w-40 h-40 rounded-md bg-gray-700 self-center">
            {isVisible && <img src={project.imageUrl} onError={handleImageError} alt={project.author.name} className="w-full h-full object-cover" />}
          </div>
        </div>
      );
    };
    
    const ProfileSuggestionCard: React.FC<{ profile: ProfileSuggestion }> = ({ profile }) => (
        <div className="bg-invox-dark-accent p-4 rounded-lg border border-gray-800 flex flex-col min-h-48">
            <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                    <img src={profile.author.avatarUrl} onError={handleImageError} alt={profile.author.name} className="w-10 h-10 rounded-full object-cover" />
                    <div className="flex items-center gap-2">
                        <p className="font-bold text-white text-lg">{profile.author.name}</p>
                        {profile.author.isVerified && <CheckBadgeIcon className="w-5 h-5 text-blue-500" />}
                    </div>
                </div>
                <button className="bg-invox-dark text-white px-6 py-1.5 rounded-lg text-sm font-semibold hover:bg-gray-700 self-start transition-all transform hover:scale-105 active:scale-95">
                    View
                </button>
            </div>
            <div className="flex-grow">
                <p className="text-sm text-invox-light-gray line-clamp-3">{profile.description}</p>
            </div>
            <div className="mt-auto">
                <hr className="border-gray-800 mb-3" />
                <div className="flex justify-between items-center">
                    <p className="font-semibold text-white">
                        Projects : <span className="text-yellow-400">{profile.stats.projects}</span>
                    </p>
                    <p className="font-semibold text-white">
                        Links : <span className="text-yellow-400">{formatNumber(profile.stats.links)}</span>
                    </p>
                </div>
            </div>
        </div>
    );
    
    const CollaborationCard: React.FC<{ project: Project }> = ({ project }) => {
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
    
        return (
            <>
                <div className="bg-invox-dark-accent rounded-lg border border-gray-800 p-4 mb-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <img src={project.author.avatarUrl} onError={handleImageError} alt={project.author.name} className="w-10 h-10 rounded-full object-cover" />
                            <div className="flex items-center gap-1">
                                <p className="font-bold text-white">{project.author.name}</p>
                                {project.author.isVerified && <CheckBadgeIcon className="w-5 h-5 text-blue-500" />}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-invox-light-gray">
                            <button onClick={handleAIAssistantClick} className="hover:text-white transition-transform duration-200 transform hover:scale-110 active:scale-100"><SparklesIcon className="w-6 h-6" /></button>
                            <button className="hover:text-white transition-transform duration-200 transform hover:scale-110 active:scale-100"><EllipsisVerticalIcon className="w-6 h-6" /></button>
                        </div>
                    </div>
        
                    {/* Content */}
                    <div className="mt-4">
                        <p className="text-xl font-semibold italic text-white">"{project.aiSummary}"</p>
                        <p className="text-invox-light-gray mt-2">
                            {showMore ? project.description : `${project.description.substring(0, 150)}...`}
                            <button onClick={() => setShowMore(!showMore)} className="text-invox-red font-semibold ml-1 hover:underline">
                                {showMore ? 'Show Less' : 'Show More'}
                            </button>
                        </p>
                    </div>
                    
                    {/* Media */}
                    {project.mediaUrl && (
                        <div className="mt-4">
                            <AspectRatioBox
                                ref={mediaContainerRef}
                                ratio="video"
                                className={`rounded-2xl border border-gray-800 bg-invox-dark group ${!isVisible || (!isVideo ? 'cursor-zoom-in' : 'cursor-pointer')}`}
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
                                            
                                            <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${!isPlaying ? 'opacity-100' : 'opacity-0'} bg-black/30 pointer-events-none`}>
                                                <div className="w-20 h-20 bg-black/50 rounded-full flex items-center justify-center backdrop-blur-sm">
                                                    <PlayIcon className="w-10 h-10 text-white" />
                                                </div>
                                            </div>
                                            
                                            <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 transition-opacity duration-300 ${isControlsVisible || !isPlaying ? 'opacity-100' : 'opacity-0'}`} onClick={(e) => e.stopPropagation()}>
                                                <div className="w-full mb-2">
                                                     <input
                                                        type="range"
                                                        min="0"
                                                        max={duration || 0}
                                                        value={progress}
                                                        onChange={handleSeek}
                                                        onPointerDown={handleProgressPointerDown}
                                                        className="w-full h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer accent-invox-red"
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between gap-4 text-white">
                                                    <div className="flex items-center gap-3">
                                                        <button onClick={togglePlayPause} className="p-1.5 rounded-full hover:bg-white/25 transition-all duration-200 transform hover:scale-110 active:scale-100">
                                                            {isPlaying ? <PauseIcon className="w-6 h-6" /> : <PlayIcon className="w-6 h-6" />}
                                                        </button>
                                                        <div className="flex items-center gap-2 group/volume">
                                                            <button onClick={toggleMute} className="p-1.5 rounded-full hover:bg-white/25 transition-all duration-200 transform hover:scale-110 active:scale-100">
                                                                {isMuted || volume === 0 ? <VolumeOffIcon className="w-6 h-6" /> : <VolumeUpIcon className="w-6 h-6" />}
                                                            </button>
                                                            <input
                                                                type="range"
                                                                min="0"
                                                                max="1"
                                                                step="0.01"
                                                                value={isMuted ? 0 : volume}
                                                                onChange={handleVolumeChange}
                                                                className="w-0 h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer accent-invox-red transition-all duration-300 opacity-0 group-hover/volume:opacity-100 group-hover/volume:w-20"
                                                            />
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-mono w-24 text-center">{formatTime(progress)} / {formatTime(duration)}</span>
                                                        <button onClick={cyclePlaybackRate} className="text-xs font-bold w-14 text-center p-1.5 rounded-full hover:bg-white/25 transition-all duration-200 transform hover:scale-110 active:scale-100">
                                                            {playbackRate.toFixed(2)}x
                                                        </button>
                                                        <button onClick={toggleFullScreen} className="p-1.5 rounded-full hover:bg-white/25 transition-all duration-200 transform hover:scale-110 active:scale-100">
                                                            {isFullscreen ? <ArrowsPointingInIcon className="w-6 h-6" /> : <ArrowsPointingOutIcon className="w-6 h-6" />}
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
                            <div className="flex justify-center items-center gap-1.5 mt-2">
                                <div className="w-2 h-2 bg-white rounded-full"></div>
                                <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                                <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                            </div>
                        </div>
                    )}
                    
                    {/* Action Bar */}
                    <div className="mt-4 border border-gray-800 rounded-lg px-4 py-2 flex justify-around items-center">
                        <button className="flex items-center gap-1.5 text-invox-light-gray hover:text-invox-red transition-all duration-200 transform hover:scale-110 active:scale-100">
                            <ArrowUpIcon className="w-5 h-5" />
                            <span className="text-sm font-semibold">{formatNumber(project.stats.likes)}</span>
                        </button>
                        <div className="flex items-center gap-1.5 text-invox-light-gray">
                            <TrendingUpIcon className="w-5 h-5" />
                            <span className="text-sm font-semibold">{formatNumber(project.stats.views)}</span>
                        </div>
                        <button className="flex items-center gap-1.5 text-invox-light-gray hover:text-white transition-all duration-200 transform hover:scale-110 active:scale-100">
                            <ChatBubbleBottomCenterTextIcon className="w-5 h-5" />
                            <span className="text-sm font-semibold">{formatNumber(project.stats.comments)}</span>
                        </button>
                        <button className="text-invox-light-gray hover:text-white transition-all duration-200 transform hover:scale-110 active:scale-100"><ForwardIcon className="w-5 h-5" /></button>
                        <button className="text-invox-light-gray hover:text-white transition-all duration-200 transform hover:scale-110 active:scale-100"><BookmarkIcon className="w-5 h-5" /></button>
                    </div>
        
                     {/* Collaborate Button */}
                    <div className="mt-2">
                        <button className="w-full bg-invox-dark-accent border border-gray-800 text-white font-semibold py-2.5 rounded-lg hover:bg-gray-700 transition-all duration-200 transform hover:scale-[1.02] active:scale-100">
                            Collaborate
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
                        className="bg-invox-dark border border-gray-800 px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-all duration-200 transform hover:scale-105 active:scale-95"
                    >
                        View Letter
                    </button>
                );
        
                switch (offer.status) {
                    case 'New':
                        return (
                            <>
                                <button onClick={() => onView(offer)} className="bg-invox-red px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-invox-red-hover transition-transform duration-200 transform hover:scale-105 active:scale-95">View Offer</button>
                            </>
                        );
                    case 'Active':
                        return (
                            <>
                                <span className="bg-green-900/50 text-green-400 px-3 py-1 rounded-full text-xs font-medium">Accepted</span>
                                {viewLetterButton}
                                <button
                                    onClick={() => onOpenMessageModal(offer)}
                                    className="bg-invox-dark border border-gray-800 px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-all duration-200 transform hover:scale-105 active:scale-95"
                                >
                                    Message
                                </button>
                            </>
                        );
                    case 'Expired':
                         return (
                            <>
                                <span className="bg-gray-700 text-gray-400 px-3 py-1 rounded-full text-xs font-medium">Expired</span>
                                {viewLetterButton}
                            </>
                         );
                    default:
                        return null;
                }
            };
            
            return (
              <div className={`bg-invox-dark-accent p-4 rounded-lg border transition-all duration-300 ${
                offer.status === 'New' && !isViewed ? 'border-invox-red/50' : 'border-gray-800'
              }`}>
                <div className="flex items-start gap-4">
                  <img src={offer.companyAvatarUrl} onError={handleImageError} alt={offer.companyName} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-bold text-white">{offer.companyName}</p>
                    <h4 className="font-semibold text-lg text-gray-200 mt-1">{offer.title}</h4>
                  </div>
                  <button
                      onClick={() => setInfoModalOffer(offer)}
                      className="p-1 text-gray-400 hover:text-white transition-colors flex-shrink-0"
                      aria-label="View offer details"
                  >
                      <InformationCircleIcon className="w-6 h-6" />
                  </button>
                </div>
                <p className="text-sm text-gray-400 mt-2 line-clamp-2">
                    {offer.description}
                </p>
                <div className="flex justify-end items-center gap-3 mt-4 pt-4 border-t border-gray-800">
                   <span className="text-xs text-gray-500 mr-auto">Received {offer.createdAt}</span>
                   {renderButtons()}
                </div>
              </div>
            );
        };

        return (
          <div className="text-white">
            <div className="flex items-center gap-4 mb-4">
                <button onClick={onBack} className="text-invox-light-gray hover:text-white transition-transform duration-200 transform hover:scale-105 active:scale-100">
                    <ArrowLeftIcon className="w-6 h-6" />
                </button>
                <h2 className="text-2xl font-bold">{offerType}</h2>
            </div>
            <hr className="border-gray-800 mb-4" />
      
            <div className="flex space-x-2 border border-gray-800 rounded-lg p-1 bg-invox-dark-accent mb-6">
                {offerStatuses.map(status => (
                    <button
                        key={status}
                        onClick={() => setActiveOfferStatusTab(status as 'New' | 'Active' | 'Expired')}
                        className={`flex-1 py-2 rounded-md transition-all duration-200 ${
                            activeOfferStatusTab === status ? 'bg-invox-red text-white font-semibold' : 'text-gray-400 hover:text-white hover:bg-gray-700'
                        }`}
                    >
                        {status}
                    </button>
                ))}
            </div>
      
            <div className="space-y-4">
                {loading ? (
                    <>
                        <OfferCardSkeleton />
                        <OfferCardSkeleton />
                    </>
                ) : filteredOffers.length > 0 ? (
                    filteredOffers.map(offer => <OfferCard key={offer.id} offer={offer} onView={openOfferModal} isViewed={viewedOfferIds.includes(offer.id)} />)
                ) : (
                    <div className="text-center py-16 text-gray-400">
                        <p>No {activeOfferStatusTab.toLowerCase()} offers found in {offerType}.</p>
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
            <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex justify-center items-center z-50 transition-opacity duration-300" onClick={onClose}>
                <div className="bg-invox-dark-accent rounded-xl shadow-xl w-full max-w-3xl flex flex-col border border-gray-800 mx-4" onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div className="flex justify-between items-center p-4 border-b border-gray-800">
                        <div className="flex items-center gap-4">
                            <img src={offer.companyAvatarUrl} onError={handleImageError} alt={offer.companyName} className="w-12 h-12 rounded-lg object-cover" />
                            <div>
                                <h2 className="text-xl font-bold text-white">{offer.title}</h2>
                                <p className="text-gray-400">{offer.companyName}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="text-gray-400 hover:text-white transition-transform duration-200 transform hover:scale-110 active:scale-100">
                            <CloseIcon />
                        </button>
                    </div>
    
                    {/* Body */}
                    <div className="p-8 overflow-y-auto max-h-[70vh] text-gray-300 font-serif">
                        <p className="mb-6">Dear {userName || 'User'},</p>
                        
                        <p className="mb-1 font-sans font-bold text-white">Subject: An Invitation to Collaboration: {offer.title} at {offer.companyName}</p>
                        <div className="w-full border-t border-gray-800 mb-6"></div>

                        <p className="mb-6 leading-relaxed">
                            We've been following your work on Invox and are particularly impressed with the projects you've showcased. Your skills and creativity seem like a perfect match for an opportunity we have.
                        </p>
    
                        <p className="mb-6 leading-relaxed whitespace-pre-wrap">{offer.description}</p>
                        
                        <p className="mb-4">
                            We believe you would be a great asset to our team for this role. If this opportunity interests you, please accept this offer to proceed to the next steps. We are excited about the possibility of collaborating with you.
                        </p>
                        
                        <p className="mt-10 mb-1">Sincerely,</p>
                        <p className="font-sans font-semibold text-white">{offer.companyName}</p>
                    </div>
                    
                    {/* Footer */}
                    <div className="flex justify-end items-center gap-4 p-4 border-t border-gray-800 bg-invox-dark rounded-b-xl min-h-[72px]">
                        <span className="text-xs text-gray-500 mr-auto">Received {offer.createdAt}</span>
                        {offer.status === 'Active' ? (
                            <div className="flex items-center gap-2 text-green-400">
                                <CheckCircleIcon className="w-6 h-6"/>
                                <span className="font-semibold">Offer Accepted!</span>
                            </div>
                        ) : offer.status === 'Expired' ? (
                            <div className="flex items-center gap-2 text-gray-500">
                                <XCircleIcon className="w-6 h-6" />
                                <span className="font-semibold">Offer Expired</span>
                            </div>
                        ) : isAccepted ? (
                            <div className="flex items-center gap-2 text-green-400 animate-pulse">
                                <CheckBadgeIcon className="w-6 h-6"/>
                                <span className="font-semibold">Offer Accepted!</span>
                            </div>
                        ) : isDeclined ? (
                            <div className="flex items-center gap-2 text-red-400 animate-pulse">
                                <InformationCircleIcon className="w-6 h-6"/>
                                <span className="font-semibold">Offer Declined.</span>
                            </div>
                        ) : confirmationAction ? (
                            <div className="w-full flex justify-between items-center">
                                <p className="text-sm text-white">
                                    Are you sure you want to {confirmationAction} this offer?
                                </p>
                                <div className="flex items-center gap-3">
                                    <button onClick={handleCancel} className="bg-invox-dark border border-gray-800 px-4 py-1.5 rounded-lg font-semibold hover:bg-gray-700 transition-all duration-200 transform hover:scale-105 active:scale-95">
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleConfirm}
                                        className={`px-4 py-1.5 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 active:scale-95 ${
                                            confirmationAction === 'accept' ? 'bg-green-600 hover:bg-green-700' : 'bg-invox-red hover:bg-invox-red-hover'
                                        }`}
                                    >
                                        Yes, {confirmationAction === 'accept' ? 'Accept' : 'Decline'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <button onClick={handleDeclineClick} className="bg-invox-dark border border-gray-800 px-6 py-2 rounded-lg font-semibold hover:bg-gray-700 transition-all duration-200 transform hover:scale-105 active:scale-95">Decline</button>
                                <button onClick={handleAcceptClick} className="bg-green-600 px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200 transform hover:scale-105 active:scale-95">Accept</button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    };
    
    
    const OfferCardSkeleton = () => (
        <div className="bg-invox-dark-accent p-4 rounded-lg border border-gray-800 animate-pulse">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-gray-700 flex-shrink-0"></div>
            <div className="flex-1 space-y-2">
              <div className="h-5 w-1/3 bg-gray-700 rounded"></div>
              <div className="h-4 w-3/4 bg-gray-700 rounded"></div>
              <div className="h-3 w-1/4 bg-gray-700 rounded"></div>
            </div>
          </div>
          <div className="flex justify-end items-center gap-3 mt-4 pt-4 border-t border-gray-800">
             <div className="h-3 w-16 bg-gray-700 rounded mr-auto"></div>
             <div className="h-8 w-20 bg-gray-700 rounded-lg"></div>
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
            <div className="text-white">
                {/* Offers section */}
                <h3 className="text-xl font-bold mb-2">Offers</h3>
                <div className="w-full border-t border-gray-800 mb-4"></div>
    
                <div className="bg-invox-dark-accent p-3 rounded-2xl border border-gray-800 mb-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {offersData.map(offer => (
                            <button
                                key={offer.name}
                                onClick={() => {
                                    setSelectedOfferType(offer.name as 'Full-Time' | 'Invites' | 'Gigs' | 'Others');
                                    setInitialOfferStatus('New');
                                }}
                                className={`w-full text-left relative bg-invox-dark rounded-xl border p-4 flex items-center justify-between h-24 overflow-hidden hover:border-invox-red/50 transition-all duration-200 group transform hover:scale-[1.02] ${
                                    offer.hasNotification ? 'border-invox-red/50' : 'border-gray-800'
                                }`}
                            >
                                <div className="flex items-center">
                                    <div className="flex-shrink-0 relative w-16 h-16 flex items-center justify-center">
                                        <div className="absolute inset-0 bg-red-800/30 rounded-full blur-lg opacity-70"></div>
                                        <img src={offer.imageUrl} onError={handleImageError} alt={offer.name} className="relative z-10 w-12 h-12 object-contain rounded-full" />
                                    </div>
                                    <span className="text-lg font-semibold text-white ml-4">{offer.name}</span>
                                </div>
                                {offer.hasNotification && (
                                    <div className="flex items-end gap-1.5 h-6">
                                        <span className="w-1.5 h-3 bg-invox-red rounded-full wave-bar" style={{ animationDelay: '0s' }}></span>
                                        <span className="w-1.5 h-5 bg-invox-red rounded-full wave-bar" style={{ animationDelay: '0.2s' }}></span>
                                        <span className="w-1.5 h-2 bg-invox-red rounded-full wave-bar" style={{ animationDelay: '0.4s' }}></span>
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
    
                {/* Actives section */}
                <h3 className="text-xl font-bold mb-2">Actives</h3>
                <div className="w-full border-t border-gray-800 mb-4"></div>
    
                <div className="relative mb-4">
                    <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                        type="search" 
                        placeholder="Search Accepted Offers" 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-invox-dark-accent border border-gray-800 rounded-lg p-3 pl-11 focus:outline-none text-white" 
                    />
                </div>
                
                <div className="grid gap-2 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))' }}>
                    {offerTypeFilters.map(filter => (
                        <button
                            key={filter}
                            onClick={() => setActiveOfferFilter(filter)}
                            className={`text-center px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all duration-200 transform hover:scale-105 active:scale-95 ${
                                activeOfferFilter === filter
                                    ? 'bg-invox-red text-white'
                                    : 'bg-invox-dark-accent text-gray-300 hover:bg-gray-700 border border-gray-800'
                            }`}
                        >
                            {filter}
                        </button>
                    ))}
                </div>
    
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 no-scrollbar">
                    {loading ? (
                        <>
                           <PingCardSkeleton />
                           <PingCardSkeleton />
                           <PingCardSkeleton />
                           <PingCardSkeleton />
                        </>
                    ) : filteredActiveOffers.map(offer => (
                        <div 
                            key={offer.id} 
                            onClick={() => handleOpenMessageModal(offer)}
                            className="bg-invox-dark-accent p-3 rounded-lg border border-gray-800 flex items-center justify-between gap-3 transition-colors duration-200 cursor-pointer hover:bg-gray-700/50"
                        >
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className="w-12 h-12 rounded-lg bg-gray-700 flex items-center justify-center border border-gray-800 flex-shrink-0">
                                    <img src={offer.companyAvatarUrl} onError={handleImageError} alt={offer.companyName} className="w-12 h-12 rounded-lg object-cover" />
                                </div>
                                <div className="overflow-hidden">
                                    <p className="font-semibold truncate text-lg leading-tight">{offer.companyName}</p>
                                    <p className="text-base text-gray-400 truncate leading-snug mt-1">{offer.title}</p>
                                </div>
                            </div>
                            <div className="flex flex-col items-end flex-shrink-0">
                                <p className="text-sm text-invox-light-gray mb-1.5 whitespace-nowrap">{offer.createdAt}</p>
                                <div className="flex items-center justify-end h-7 w-16">
                                    {offer.hasNewMessage && (
                                        <span className="w-3 h-3 bg-invox-red rounded-full animate-pulse"></span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };
    
    const BrowseProjectsView = () => (
        <div>
            <div className="relative mb-6">
                <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input 
                    type="search" 
                    placeholder="Search Projects by name, category, or creator" 
                    className="w-full bg-invox-dark-accent border border-gray-800 rounded-lg p-3 pl-11 focus:outline-none text-white" 
                />
            </div>
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white">Suggestions</h3>
                    <button className="flex items-center gap-2 bg-invox-dark-accent border border-gray-800 rounded-lg px-4 py-2 text-sm text-white font-semibold hover:bg-gray-700 transition-all duration-200 transform hover:scale-105 active:scale-95">
                        <FilterIcon className="w-5 h-5 text-gray-400" />
                        <span>Filter by</span>
                        <ChevronDownIcon className="w-5 h-5 text-gray-400" />
                    </button>
                </div>
                
                <div>
                  {loading ? (
                    <div className="space-y-6">
                        {[...Array(3)].map((_, index) => (
                            <div key={index}>
                                <div className="h-6 w-1/3 bg-gray-700 rounded mb-3 animate-pulse"></div>
                                <div className="flex overflow-x-auto space-x-4 pb-2 no-scrollbar items-center">
                                    <div className="w-96 flex-shrink-0"><SuggestionCardSkeleton /></div>
                                    <div className="w-96 flex-shrink-0"><SuggestionCardSkeleton /></div>
                                    <div className="flex-shrink-0 w-40 h-48 bg-invox-dark-accent border border-gray-800 rounded-lg flex flex-col items-center justify-center">
                                        <div className="w-8 h-8 bg-gray-700 rounded-lg mb-2"></div>
                                        <div className="h-4 w-20 bg-gray-700 rounded"></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                  ) : (
                    suggestionData.map((categoryData, index) => (
                      <div key={`${categoryData.category}-${index}`} className="mb-6">
                        <h4 className="text-lg font-semibold text-invox-light-gray mb-3 border-b border-gray-800 pb-2">{categoryData.category}</h4>
                        <div className="flex overflow-x-auto space-x-4 pb-2 no-scrollbar items-center">
                          {categoryData.projects.map(project => (
                            <div key={project.id} className="w-96 flex-shrink-0">
                                <SuggestionCard project={project} />
                            </div>
                          ))}
                           <button className="flex-shrink-0 w-40 h-48 bg-invox-dark-accent border border-gray-800 rounded-lg flex flex-col items-center justify-center text-invox-light-gray hover:bg-gray-700 hover:text-white transition-all duration-200 transform hover:scale-105 active:scale-95">
                              <ForwardIcon className="w-8 h-8 mb-2" />
                              <span className="font-semibold">Load More</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
            </div>
        </div>
    );
    
    const BrowseProfilesView = () => (
        <div>
            <div className="relative mb-6">
                <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input 
                    type="search" 
                    placeholder="Search Profiles by name or domain" 
                    className="w-full bg-invox-dark-accent border border-gray-800 rounded-lg p-3 pl-11 focus:outline-none text-white" 
                />
            </div>
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white">Suggestions</h3>
                    <button className="flex items-center gap-2 bg-invox-dark-accent border border-gray-800 rounded-lg px-4 py-2 text-sm text-white font-semibold hover:bg-gray-700 transition-all duration-200 transform hover:scale-105 active:scale-95">
                        <FilterIcon className="w-5 h-5 text-gray-400" />
                        <span>Filter by</span>
                        <ChevronDownIcon className="w-5 h-5 text-gray-400" />
                    </button>
                </div>
                
                <div>
                  {loading ? (
                    <div className="space-y-6">
                        {[...Array(2)].map((_, index) => (
                            <div key={index}>
                                <div className="h-6 w-1/3 bg-gray-700 rounded mb-3 animate-pulse"></div>
                                <div className="flex overflow-x-auto space-x-4 pb-2 no-scrollbar items-center">
                                    <div className="w-96 flex-shrink-0"><ProfileSuggestionCardSkeleton /></div>
                                    <div className="w-96 flex-shrink-0"><ProfileSuggestionCardSkeleton /></div>
                                    <div className="flex-shrink-0 w-40 h-48 bg-invox-dark-accent border border-gray-800 rounded-lg flex flex-col items-center justify-center">
                                        <div className="w-8 h-8 bg-gray-700 rounded-lg mb-2"></div>
                                        <div className="h-4 w-20 bg-gray-700 rounded"></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                  ) : (
                    profileSuggestionData.map((categoryData, index) => (
                      <div key={`${categoryData.category}-${index}`} className="mb-6">
                        <h4 className="text-lg font-semibold text-invox-light-gray mb-3 border-b border-gray-800 pb-2">{categoryData.category}</h4>
                        <div className="flex overflow-x-auto space-x-4 pb-2 no-scrollbar items-center">
                          {categoryData.profiles.map(profile => (
                            <div key={profile.id} className="w-96 flex-shrink-0">
                                <ProfileSuggestionCard profile={profile} />
                            </div>
                          ))}
                          <button className="flex-shrink-0 w-40 h-48 bg-invox-dark-accent border border-gray-800 rounded-lg flex flex-col items-center justify-center text-invox-light-gray hover:bg-gray-700 hover:text-white transition-all duration-200 transform hover:scale-105 active:scale-95">
                              <ForwardIcon className="w-8 h-8 mb-2" />
                              <span className="font-semibold">Load More</span>
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
                    <div className="text-center py-16 text-gray-400">
                        <p>No opportunities match your current filters.</p>
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
        if (showPinnedHighlights) return <PinnedHighlightsView loading={loading} />;
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
                <div>
                    <Showcase projects={filteredShowcaseProjects} />
                </div>
            );
        }
    
        if (activeTab === 'Collabs') {
            return <Collabs />;
        }
    
        return null;
    };
    

    return (
        <div className="p-4">
            {/* Conditional Filters & Main Tabs */}
            {!selectedOfferType && !showPinnedHighlights && (
                <>
                    {activeTab !== 'Leap' && !spotlightBrowseState && (
                        <>
                             <div className="flex items-center space-x-2 overflow-x-auto pb-3 mb-4 no-scrollbar">
                                {categoryFilters.map(category => (
                                    <button
                                        key={category}
                                        onClick={() => setActiveCategory(category)}
                                        className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-200 transform hover:scale-105 active:scale-95 ${
                                            activeCategory === category
                                                ? 'bg-invox-red text-white'
                                                : 'bg-invox-dark-accent text-gray-300 hover:bg-gray-700'
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
    
                    {!spotlightBrowseState && (
                        <div className="flex space-x-2 border border-gray-800 rounded-lg p-1 bg-invox-dark-accent mb-4">
                            {mainTabs.map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`flex-1 py-2 rounded-md transition-all duration-200 ${activeTab === tab ? 'bg-invox-red text-white font-semibold' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                    )}
                </>
            )}
           
            {/* Sub-tabs for Leap */}
            {activeTab === 'Leap' && !selectedOfferType && !showPinnedHighlights && (
                <div className="flex border-b border-gray-800 mb-4">
                    <button
                        onClick={() => setActiveLeapTab('GoForIt')}
                        className={`w-1/2 text-center py-3 font-semibold transition-all duration-200 transform hover:-translate-y-px ${activeLeapTab === 'GoForIt' ? 'border-b-2 border-invox-red text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                        GoForIt
                    </button>
                    <button
                        onClick={() => setActiveLeapTab('Pings')}
                        className={`w-1/2 text-center py-3 font-semibold transition-all duration-200 transform hover:-translate-y-px ${activeLeapTab === 'Pings' ? 'border-b-2 border-invox-red text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                        Pings
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
        </div>
    );
};

export default SpotlightPage;