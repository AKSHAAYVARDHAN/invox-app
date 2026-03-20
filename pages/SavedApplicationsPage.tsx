
import React, { useState, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import type { Offer } from '../types';
import { ArrowLeftIcon, CloseIcon, MapPinIcon, BriefcaseIcon, CubeIcon, BookmarkIcon, BookmarkIconSolid } from '../components/ui/Icons';
import GoForItOpportunityCard from '../components/spotlight/GoForItOpportunityCard';
import GoForItOpportunityCardSkeleton from '../components/spotlight/GoForItOpportunityCardSkeleton';
import { handleImageError } from '../components/utils/imageUtils';

const mockOffers: Offer[] = [
    { id: 'ft-new-1', companyName: 'Google', companyAvatarUrl: 'https://picsum.photos/seed/google/200', title: 'Senior Frontend Engineer', description: 'Join the team building the next generation of web applications that will be used by billions of users worldwide. We are looking for a passionate engineer with experience in React, TypeScript, and modern web technologies. You will be responsible for designing, developing, and deploying user-facing features for one of our flagship products. This is a unique opportunity to make a massive impact and work with a world-class team of engineers and designers.', status: 'New', type: 'Full-Time', createdAt: '2 days ago', location: 'Mountain View, CA', skills: ['React', 'TypeScript', 'JavaScript', 'CSS', 'HTML'], category: 'Web Development', experienceLevel: 'Senior' },
    { id: 'ft-new-2', companyName: 'Stripe', companyAvatarUrl: 'https://picsum.photos/seed/stripe/200', title: 'Senior Backend Engineer', description: 'We are looking for a skilled backend engineer to join our core payments infrastructure team. Help us build the future of online commerce. You will be working with a highly scalable and resilient system that processes billions of dollars in transactions every year. Experience with distributed systems, reliability, and high-performance computing is highly valued.', status: 'New', type: 'Full-Time', createdAt: '4 days ago', location: 'Remote', skills: ['Go', 'Ruby', 'Distributed Systems', 'API Design'], category: 'Backend', experienceLevel: 'Senior' },
    { id: 'ft-active-1', companyName: 'Facebook', companyAvatarUrl: 'https://picsum.photos/seed/facebook/200', title: 'Product Manager, AI', description: 'Lead the product vision for our new AI-powered tools that will connect the world.', status: 'Active', type: 'Full-Time', createdAt: '1 week ago', location: 'Menlo Park, CA', skills: ['Product Management', 'AI/ML', 'User Research'], category: 'Product Management', experienceLevel: 'Mid' },
    { id: 'ft-expired-1', companyName: 'Amazon', companyAvatarUrl: 'https://picsum.photos/seed/amazon/200', title: 'Cloud Solutions Architect', description: 'Design and implement scalable cloud infrastructure for our top-tier clients.', status: 'Expired', type: 'Full-Time', createdAt: '1 month ago', location: 'Seattle, WA', skills: ['AWS', 'Architecture', 'Cloud Computing'], category: 'Cloud Computing', experienceLevel: 'Senior' },
    { id: 'inv-new-1', companyName: 'Ada Lovelace', companyAvatarUrl: 'https://picsum.photos/seed/ada/200', title: 'Invitation to Connect', description: 'Would love to connect and discuss your work in ethical AI.', status: 'New', type: 'Invites', createdAt: '1 day ago', location: 'Collaboration', skills: ['Ethical AI', 'Research', 'Speaking'], category: 'Ethical AI', experienceLevel: 'Senior' },
    { id: 'inv-active-1', companyName: 'Vercel', companyAvatarUrl: 'https://picsum.photos/seed/vercel/200', title: 'Next.js Conf Invite', description: 'We would like to invite you as a speaker to our upcoming conference.', status: 'Active', type: 'Invites', createdAt: '5 days ago', location: 'Online', skills: ['Next.js', 'Public Speaking'], category: 'Web Development', experienceLevel: 'Mid' },
    { id: 'gig-new-1', companyName: 'OpenAI', companyAvatarUrl: 'https://picsum.photos/seed/openai/200', title: 'Short-term ML Contract', description: 'We need an expert to help fine-tune a language model for a specific domain. 3-month contract.', status: 'New', type: 'Gigs', createdAt: '4 days ago', location: 'Remote', skills: ['PyTorch', 'Fine-tuning', 'NLP'], category: 'Machine Learning', experienceLevel: 'Senior' },
    { id: 'gig-active-1', companyName: 'Figma', companyAvatarUrl: 'https://picsum.photos/seed/figma/200', title: 'UI/UX Design for a new feature', description: 'Design the user flow and interface for our upcoming collaboration feature.', status: 'Active', type: 'Gigs', createdAt: '2 weeks ago', location: 'Remote', skills: ['Figma', 'UI Design', 'UX Design'], category: 'Design', experienceLevel: 'Mid' },
    { id: 'oth-new-1', companyName: 'Community Bot', companyAvatarUrl: 'https://picsum.photos/seed/bot/200', title: 'Community Guideline Update', description: 'Please review the updated community guidelines for AI ClubTech.', status: 'New', type: 'Others', createdAt: '6 hours ago', location: 'Community', skills: ['Community Management'], category: 'Community Management', experienceLevel: 'Entry' }
];

const OpportunityDetailModal: React.FC<{
    offer: Offer;
    onClose: () => void;
    savedOfferIds: string[];
    toggleSaveOffer: (offerId: string) => void;
}> = ({ offer, onClose, savedOfferIds, toggleSaveOffer }) => {
    const navigate = ReactRouterDOM.useNavigate();

    const handleApply = () => {
        navigate(`/apply/${offer.id}`, { state: { offer } });
    };
    
    const typeColors: { [key: string]: string } = {
        'Full-Time': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        'Gigs': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
        'Invites': 'bg-green-500/20 text-green-400 border-green-500/30',
        'Others': 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    };

    const isSaved = savedOfferIds.includes(offer.id);

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex justify-center items-center z-50 transition-opacity duration-300" 
            onClick={onClose}
            aria-modal="true"
            role="dialog"
        >
            <div 
                className="bg-invox-dark-accent rounded-xl shadow-2xl w-full max-w-3xl flex flex-col border border-gray-700 m-4 max-h-[90vh]" 
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-start p-6 border-b border-gray-700 flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <img src={offer.companyAvatarUrl} onError={handleImageError} alt={offer.companyName} className="w-16 h-16 rounded-lg object-cover" />
                        <div>
                            <h2 className="text-2xl font-bold text-white">{offer.title}</h2>
                            <p className="text-gray-400 text-lg">{offer.companyName}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-transform duration-200 transform hover:scale-110 active:scale-100" aria-label="Close opportunity details">
                        <CloseIcon />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto text-gray-300 space-y-6">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${typeColors[offer.type] || typeColors['Others']}`}>{offer.type}</span>
                        {offer.location && (
                            <div className="flex items-center gap-1.5 text-gray-300">
                                <MapPinIcon className="w-5 h-5" />
                                <span>{offer.location}</span>
                            </div>
                        )}
                         {offer.experienceLevel && (
                            <div className="flex items-center gap-1.5 text-gray-300">
                                <BriefcaseIcon className="w-5 h-5" />
                                <span>{offer.experienceLevel}</span>
                            </div>
                        )}
                        {offer.category && (
                            <div className="flex items-center gap-1.5 text-gray-300">
                                <CubeIcon className="w-5 h-5" />
                                <span>{offer.category}</span>
                            </div>
                        )}
                    </div>

                    <div>
                        <h3 className="text-lg font-semibold text-white mb-2">Job Description</h3>
                        <p className="whitespace-pre-wrap leading-relaxed">{offer.description}</p>
                    </div>

                    {offer.skills && offer.skills.length > 0 && (
                        <div>
                            <h3 className="text-lg font-semibold text-white mb-2">Skills Required</h3>
                             <div className="flex flex-wrap gap-2">
                                {offer.skills.map(skill => (
                                    <span key={skill} className="bg-gray-700/50 text-gray-300 px-3 py-1.5 rounded-md text-sm font-medium border border-gray-600/50">
                                        {skill}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 flex justify-between items-center gap-4 p-4 border-t border-gray-700 bg-invox-dark rounded-b-xl">
                    <span className="text-sm text-gray-500">Posted {offer.createdAt}</span>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => toggleSaveOffer(offer.id)}
                            className={`flex items-center gap-2 border px-6 py-2.5 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 active:scale-95 ${
                                isSaved
                                ? 'bg-invox-dark-accent border-gray-600 text-white hover:bg-gray-800'
                                : 'bg-invox-dark-accent border-gray-600 text-white hover:bg-gray-800'
                            }`}
                        >
                            {isSaved ? <BookmarkIconSolid className="w-5 h-5" /> : <BookmarkIcon className="w-5 h-5" />}
                            {isSaved ? 'Saved' : 'Save'}
                        </button>
                        <button onClick={handleApply} className="bg-green-600 px-8 py-2.5 rounded-lg font-semibold text-white text-center hover:bg-green-700 transition-all duration-200 transform hover:scale-105 active:scale-95 inline-block">
                            Apply Now
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const SavedApplicationsPage = () => {
    const [loading, setLoading] = useState(true);
    const [unsavingIds, setUnsavingIds] = useState<string[]>([]);
    const [viewingOffer, setViewingOffer] = useState<Offer | null>(null);
    const navigate = ReactRouterDOM.useNavigate();
    const outletContext = ReactRouterDOM.useOutletContext<{
        setRightSidebarVariant: (variant: string) => void;
        savedOfferIds: string[];
        toggleSaveOffer: (offerId: string) => void;
    }>();

    const { setRightSidebarVariant, savedOfferIds, toggleSaveOffer } = outletContext || { savedOfferIds: [], toggleSaveOffer: () => {} };

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
        setLoading(true);
        const timer = setTimeout(() => setLoading(false), 1500);
        return () => clearTimeout(timer);
    }, []);

    const savedOffers = mockOffers.filter(offer => savedOfferIds.includes(offer.id));
    
    const handleUnsave = (offerId: string) => {
        if (!savedOfferIds.includes(offerId)) return;

        setUnsavingIds(prev => [...prev, offerId]);

        setTimeout(() => {
            toggleSaveOffer(offerId);
            setUnsavingIds(prev => prev.filter(id => id !== offerId));
        }, 300); // Duration matches the CSS transition
    };

    return (
        <div className="p-4">
            <div className="flex items-center gap-4 mb-4">
                <button onClick={() => navigate('/spotlight?tab=Leap&subTab=GoForIt')} className="text-invox-light-gray hover:text-white transition-transform duration-200 transform hover:scale-105 active:scale-100">
                    <ArrowLeftIcon className="w-6 h-6" />
                </button>
                <h1 className="text-2xl font-bold text-white">Saved Opportunities</h1>
            </div>
            <hr className="border-gray-700 mb-6" />

            <div className="space-y-4">
                {loading ? (
                    <>
                        <GoForItOpportunityCardSkeleton />
                        <GoForItOpportunityCardSkeleton />
                        <GoForItOpportunityCardSkeleton />
                    </>
                ) : savedOffers.length > 0 ? (
                    savedOffers.map(offer => (
                        <div
                            key={offer.id}
                            className={`transition-all duration-300 ease-out overflow-hidden ${
                                unsavingIds.includes(offer.id)
                                    ? 'opacity-0 max-h-0 scale-95 !mt-0'
                                    : 'max-h-[500px] opacity-100 scale-100'
                            }`}
                        >
                            <GoForItOpportunityCard
                                offer={offer}
                                savedOfferIds={savedOfferIds}
                                toggleSaveOffer={handleUnsave}
                                onViewDetails={() => setViewingOffer(offer)}
                            />
                        </div>
                    ))
                ) : (
                    <div className="text-center py-16 text-gray-400">
                        <p>You haven't saved any opportunities yet.</p>
                    </div>
                )}
            </div>
             {viewingOffer && (
                <OpportunityDetailModal
                    offer={viewingOffer}
                    onClose={() => setViewingOffer(null)}
                    savedOfferIds={savedOfferIds}
                    toggleSaveOffer={handleUnsave}
                />
            )}
        </div>
    );
};

export default SavedApplicationsPage;
