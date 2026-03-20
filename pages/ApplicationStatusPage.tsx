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
            <div className="flex items-center gap-2 text-invox-red bg-invox-red/10 p-3 rounded-lg border border-invox-red/20">
                <XCircleIcon className="w-6 h-6 flex-shrink-0" />
                <span className="font-semibold">Application Rejected</span>
            </div>
        );
    }

    return (
        <div className="flex items-center w-full">
            {stages.map((stage, index) => (
                <React.Fragment key={stage}>
                    <div className="flex flex-col items-center text-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${index <= currentStageIndex ? 'bg-green-500 border-green-500' : 'bg-gray-700 border-gray-600'}`}>
                            {index < currentStageIndex ? (
                                <CheckIcon className="w-5 h-5 text-white" />
                            ) : (
                                <div className={`w-3 h-3 rounded-full transition-colors ${index === currentStageIndex ? 'bg-white animate-pulse' : 'bg-gray-500'}`}></div>
                            )}
                        </div>
                        <p className={`mt-2 text-xs font-semibold max-w-[70px] ${index <= currentStageIndex ? 'text-white' : 'text-gray-500'}`}>{stage}</p>
                    </div>
                    {index < stages.length - 1 && (
                        <div className={`flex-1 h-1 mx-2 transition-colors ${index < currentStageIndex ? 'bg-green-500' : 'bg-gray-600'}`}></div>
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
        <div className="bg-invox-dark-accent p-4 rounded-lg border border-gray-800">
            <div className="flex items-start gap-4">
                <img src={offer.companyAvatarUrl} onError={handleImageError} alt={offer.companyName} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                <div className="flex-1">
                    <p className="font-bold text-white">{offer.companyName}</p>
                    <h4 className="font-semibold text-lg text-gray-200 mt-1">{offer.title}</h4>
                    <p className="text-sm text-gray-500 mt-1">Applied {application.appliedDate}</p>
                </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-700/50">
                <h5 className="text-sm font-semibold text-gray-400 mb-3">Status</h5>
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
        <div className="p-4">
            <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/spotlight?tab=Leap&subTab=GoForIt')} className="text-invox-light-gray hover:text-white transition-transform duration-200 transform hover:scale-105 active:scale-100">
                        <ArrowLeftIcon className="w-6 h-6" />
                    </button>
                    <h1 className="text-2xl font-bold text-white">Application Status</h1>
                </div>
                
                {/* Sort Dropdown */}
                <div className="relative" ref={sortDropdownRef}>
                    <button 
                        onClick={() => setSortMenuOpen(!sortMenuOpen)}
                        className="flex items-center gap-2 bg-invox-dark-accent border border-gray-700 rounded-lg px-4 py-2 text-sm text-white font-semibold hover:bg-gray-800 transition-all duration-200 transform hover:scale-105 active:scale-95"
                    >
                        <span>Sort by</span>
                        <ChevronDownIcon className={`w-5 h-5 text-gray-400 transition-transform ${sortMenuOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {sortMenuOpen && (
                        <div className="absolute right-0 mt-2 w-48 bg-invox-dark-accent border border-gray-700 rounded-lg shadow-lg z-10">
                            <ul className="py-1">
                                {sortOptions.map(option => (
                                    <li key={option.value}>
                                        <button
                                            onClick={() => {
                                                setSortBy(option.value);
                                                setSortMenuOpen(false);
                                            }}
                                            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-700/50 ${sortBy === option.value ? 'text-invox-red font-semibold' : 'text-white'}`}
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
            <hr className="border-gray-700 mb-6" />

            <div className="space-y-4">
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
                    <div className="text-center py-16 text-gray-400">
                        <p>You haven't applied to any opportunities yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ApplicationStatusPage;