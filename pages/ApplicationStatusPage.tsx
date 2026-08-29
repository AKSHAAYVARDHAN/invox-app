import React, { useState, useEffect, useRef } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import type { Offer } from '../types';
import { handleImageError } from '../components/utils/imageUtils';
import { ArrowLeftIcon, CheckIcon, XCircleIcon, ChevronDownIcon } from '../components/ui/Icons';
import ApplicationCardSkeleton from '../components/applications/ApplicationCardSkeleton';

// Copied from Spotlight.tsx for mock data consistency
const mockOffers: Offer[] = [
    { id: 'ft-new-1', companyName: 'Google', companyAvatarUrl: 'https://picsum.photos/seed/google/200', title: 'Senior Frontend Engineer', description: 'Join the team building the next generation of web applications that will be used by billions of users worldwide. We are looking for a passionate engineer with experience in React, TypeScript, and modern web technologies. You will be responsible for designing, developing, and deploying user-facing features for one of our flagship products. This is a unique opportunity to make a massive impact and work with a world-class team of engineers and designers.', status: 'New', type: 'Full-Time', createdAt: '2 days ago', location: 'Mountain View, CA', skills: ['React', 'TypeScript', 'JavaScript', 'CSS', 'HTML'], category: 'Web Development', experienceLevel: 'Senior' },
    { id: 'ft-new-2', companyName: 'Stripe', companyAvatarUrl: 'https://picsum.photos/seed/stripe/200', title: 'Senior Backend Engineer', description: 'We are looking for a skilled backend engineer to join our core payments infrastructure team. Help us build the future of online commerce. You will be working with a highly scalable and resilient system that processes billions of dollars in transactions every year. Experience with distributed systems, reliability, and high-performance computing is highly valued.', status: 'New', type: 'Full-Time', createdAt: '4 days ago', location: 'Remote', skills: ['Go', 'Ruby', 'Distributed Systems', 'API Design'], category: 'Backend', experienceLevel: 'Senior' },
    { id: 'ft-active-1', companyName: 'Facebook', companyAvatarUrl: 'https://picsum.photos/seed/facebook/200', title: 'Product Manager, AI', description: 'Lead the product vision for our new AI-powered tools that will connect the world.', status: 'Active', type: 'Full-Time', createdAt: '1 week ago', location: 'Menlo Park, CA', skills: ['Product Management', 'AI/ML', 'User Research'], category: 'Product Management', experienceLevel: 'Mid' },
    { id: 'ft-expired-1', companyName: 'Amazon', companyAvatarUrl: 'https://picsum.photos/seed/amazon/200', title: 'Cloud Solutions Architect', description: 'Design and implement scalable cloud infrastructure for our top-tier clients.', status: 'Expired', type: 'Full-Time', createdAt: '1 month ago', location: 'Seattle, WA', skills: ['AWS', 'Architecture', 'Cloud Computing'], category: 'Cloud Computing', experienceLevel: 'Senior' },
    { id: 'gig-new-1', companyName: 'OpenAI', companyAvatarUrl: 'https://picsum.photos/seed/openai/200', title: 'Short-term ML Contract', description: 'We need an expert to help fine-tune a language model for a specific domain. 3-month contract.', status: 'New', type: 'Gigs', createdAt: '4 days ago', location: 'Remote', skills: ['PyTorch', 'Fine-tuning', 'NLP'], category: 'Machine Learning', experienceLevel: 'Senior' },
];

type ApplicationStatus = 'Applied' | 'Under Review' | 'Interviewing' | 'Offer Received' | 'Rejected';

interface AppliedApplication {
    id: string;
    offerId: string;
    appliedDate: string;
    appliedOn: Date;
    status: ApplicationStatus;
    offer?: Offer;
}

const mockAppliedApplications: AppliedApplication[] = [
    { id: 'app-1', offerId: 'ft-new-1', appliedDate: '3 days ago', appliedOn: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), status: 'Under Review' },
    { id: 'app-2', offerId: 'ft-new-2', appliedDate: '5 days ago', appliedOn: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), status: 'Applied' },
    { id: 'app-3', offerId: 'gig-new-1', appliedDate: '1 week ago', appliedOn: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), status: 'Interviewing' },
    { id: 'app-4', offerId: 'ft-active-1', appliedDate: '2 weeks ago', appliedOn: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), status: 'Offer Received' },
    { id: 'app-5', offerId: 'ft-expired-1', appliedDate: '1 month ago', appliedOn: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), status: 'Rejected' },
];

const ApplicationTracker: React.FC<{ status: ApplicationStatus }> = ({ status }) => {
    const stages: ApplicationStatus[] = ['Applied', 'Under Review', 'Interviewing', 'Offer Received'];
    const currentStageIndex = stages.indexOf(status);

    if (status === 'Rejected') {
        return (
            <div className="flex items-center gap-2 text-red-400 bg-red-950/30 p-3 border border-red-900/50 font-mono text-xs">
                <XCircleIcon className="w-4 h-4 flex-shrink-0" />
                <span className="font-bold tracking-wider uppercase">// PIPELINE_STATUS: APPLICATION REJECTED</span>
            </div>
        );
    }

    return (
        <div className="flex items-center w-full font-mono">
            {stages.map((stage, index) => (
                <React.Fragment key={stage}>
                    <div className="flex flex-col items-center text-center">
                        <div className={`w-6 h-6 flex items-center justify-center border text-[10px] transition-colors ${
                            index <= currentStageIndex 
                                ? 'bg-white text-black border-white font-bold' 
                                : 'bg-zinc-950 border-zinc-800 text-zinc-600'
                        }`}>
                            {index < currentStageIndex ? (
                                <CheckIcon className="w-3.5 h-3.5 text-black" />
                            ) : (
                                <span>0{index + 1}</span>
                            )}
                        </div>
                        <p className={`mt-1.5 text-[9px] uppercase tracking-wider max-w-[70px] ${index <= currentStageIndex ? 'text-white font-bold' : 'text-zinc-600'}`}>{stage}</p>
                    </div>
                    {index < stages.length - 1 && (
                        <div className={`flex-1 h-px mx-2 transition-colors ${index < currentStageIndex ? 'bg-white' : 'bg-zinc-800'}`}></div>
                    )}
                </React.Fragment>
            ))}
        </div>
    );
};


const ApplicationCard: React.FC<{ application: AppliedApplication }> = ({ application }) => {
    const { offer } = application;
    if (!offer) return null;

    return (
        <div className="bg-[#0c0c0e] p-4 border border-zinc-800 font-mono">
            <div className="flex items-start gap-4">
                <img src={offer.companyAvatarUrl} onError={handleImageError} alt={offer.companyName} className="w-11 h-11 border border-zinc-700 object-cover flex-shrink-0" />
                <div className="flex-1 min-w-0">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest block">// {offer.companyName}</span>
                    <h4 className="font-bold text-sm text-white uppercase tracking-wider truncate">{offer.title}</h4>
                    <p className="text-[10px] text-zinc-500 mt-0.5">LOGGED: {application.appliedDate}</p>
                </div>
            </div>
            <div className="mt-4 pt-3 border-t border-zinc-800">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block mb-2">// PIPELINE_PROGRESS</span>
                <ApplicationTracker status={application.status} />
            </div>
        </div>
    );
};


const ApplicationStatusPage = () => {
    const [loading, setLoading] = useState(true);
    const [sortMenuOpen, setSortMenuOpen] = useState(false);
    const [sortBy, setSortBy] = useState('date-desc');
    const navigate = ReactRouterDOM.useNavigate();
    const sortDropdownRef = useRef<HTMLDivElement>(null);
    const outletContext = ReactRouterDOM.useOutletContext<{
        setRightSidebarVariant: (variant: string) => void;
    }>();
    const { setRightSidebarVariant } = outletContext || {};

    const sortOptions = [
        { value: 'date-desc', label: 'Date (Newest)' },
        { value: 'date-asc', label: 'Date (Oldest)' },
        { value: 'role-asc', label: 'Role (A-Z)' },
        { value: 'company-asc', label: 'Company (A-Z)' },
    ];

    useEffect(() => {
        if (setRightSidebarVariant) {
            setRightSidebarVariant('goforit');
        }
        return () => {
            if (setRightSidebarVariant) {
                setRightSidebarVariant('default');
            }
        };
    }, [setRightSidebarVariant]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
                setSortMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        setLoading(true);
        const timer = setTimeout(() => setLoading(false), 1500);
        return () => clearTimeout(timer);
    }, []);

    const applicationsWithDetails = mockAppliedApplications.map(app => {
        const offer = mockOffers.find(o => o.id === app.offerId);
        return { ...app, offer };
    }).filter((app): app is AppliedApplication & { offer: Offer } => !!app.offer);

    const sortedApplications = [...applicationsWithDetails].sort((a, b) => {
        switch (sortBy) {
            case 'date-asc':
                return a.appliedOn.getTime() - b.appliedOn.getTime();
            case 'role-asc':
                return a.offer.title.localeCompare(b.offer.title);
            case 'company-asc':
                return a.offer.companyName.localeCompare(b.offer.companyName);
            case 'date-desc':
            default:
                return b.appliedOn.getTime() - a.appliedOn.getTime();
        }
    });

    return (
        <div className="w-full">
            {/* Header / Sub-nav */}
            <div className="border-b border-zinc-800 bg-zinc-950 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => navigate('/spotlight?tab=Leap&subTab=GoForIt')} 
                        className="text-zinc-400 hover:text-white transition-colors"
                        aria-label="Back"
                    >
                        <ArrowLeftIcon className="w-4 h-4" />
                    </button>
                    <div>
                        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block leading-none">// PIPELINE_TRACKER</span>
                        <h1 className="text-xs font-bold font-mono text-white tracking-wider uppercase mt-0.5">Application Status</h1>
                    </div>
                </div>
                
                {/* Sort Dropdown */}
                <div className="relative" ref={sortDropdownRef}>
                    <button 
                        onClick={() => setSortMenuOpen(!sortMenuOpen)}
                        className="flex items-center gap-2 bg-[#0c0c0e] border border-zinc-700 px-3 py-1.5 text-xs font-mono text-zinc-300 hover:text-white transition-all uppercase tracking-wider"
                    >
                        <span>Sort</span>
                        <ChevronDownIcon className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${sortMenuOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {sortMenuOpen && (
                        <div className="absolute right-0 mt-1 w-44 bg-[#0c0c0e] border border-zinc-800 shadow-xl z-20 font-mono text-xs">
                            <ul className="py-1">
                                {sortOptions.map(option => (
                                    <li key={option.value}>
                                        <button
                                            onClick={() => {
                                                setSortBy(option.value);
                                                setSortMenuOpen(false);
                                            }}
                                            className={`w-full text-left px-3 py-1.5 uppercase tracking-wider hover:bg-zinc-900 ${sortBy === option.value ? 'text-white font-bold bg-zinc-900/60' : 'text-zinc-400'}`}
                                        >
                                            {option.label}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>

            <div className="p-4 space-y-3">
                {loading ? (
                    <>
                        <ApplicationCardSkeleton />
                        <ApplicationCardSkeleton />
                        <ApplicationCardSkeleton />
                    </>
                ) : sortedApplications.length > 0 ? (
                    sortedApplications.map(app => (
                        <ApplicationCard key={app.id} application={app} />
                    ))
                ) : (
                    <div className="border border-zinc-800 bg-[#0c0c0e] p-8 text-center font-mono">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-1">// NULL_RECORDS</span>
                        <p className="text-zinc-400 text-xs uppercase tracking-wider">No active applications in pipeline</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ApplicationStatusPage;