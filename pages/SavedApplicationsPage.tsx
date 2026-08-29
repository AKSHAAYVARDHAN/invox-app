
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

    const isSaved = savedOfferIds.includes(offer.id);

    return (
        <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-50 p-4 animate-fadeIn" 
            onClick={onClose}
            aria-modal="true"
            role="dialog"
        >
            <div 
                className="bg-[#0c0c0e] border border-zinc-800 w-full max-w-2xl flex flex-col shadow-2xl max-h-[90vh] overflow-hidden animate-fadeInUp font-mono" 
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-start p-4 border-b border-zinc-800 bg-zinc-950 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <img src={offer.companyAvatarUrl} onError={handleImageError} alt={offer.companyName} className="w-12 h-12 border border-zinc-700 object-cover" />
                        <div>
                            <span className="text-[10px] text-zinc-500 uppercase tracking-widest block">// {offer.companyName}</span>
                            <h2 className="text-sm font-bold text-white uppercase tracking-wider">{offer.title}</h2>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 text-zinc-400 hover:text-white transition-colors" aria-label="Close opportunity details">
                        <CloseIcon className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 overflow-y-auto text-zinc-300 space-y-5 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 border border-zinc-700 bg-black text-white text-[10px] uppercase font-bold">{offer.type}</span>
                        {offer.location && (
                            <div className="flex items-center gap-1 text-zinc-400 text-[10px]">
                                <MapPinIcon className="w-3.5 h-3.5" />
                                <span>{offer.location}</span>
                            </div>
                        )}
                        {offer.experienceLevel && (
                            <div className="flex items-center gap-1 text-zinc-400 text-[10px]">
                                <BriefcaseIcon className="w-3.5 h-3.5" />
                                <span>{offer.experienceLevel}</span>
                            </div>
                        )}
                        {offer.category && (
                            <div className="flex items-center gap-1 text-zinc-400 text-[10px]">
                                <CubeIcon className="w-3.5 h-3.5" />
                                <span>{offer.category}</span>
                            </div>
                        )}
                    </div>

                    <div>
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-2">// SPECIFICATION</span>
                        <p className="whitespace-pre-wrap leading-relaxed text-zinc-300 bg-zinc-950 p-3.5 border border-zinc-800/80">{offer.description}</p>
                    </div>

                    {offer.skills && offer.skills.length > 0 && (
                        <div>
                            <span className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-2">// CORE_REQUIREMENTS</span>
                            <div className="flex flex-wrap gap-1.5">
                                {offer.skills.map(skill => (
                                    <span key={skill} className="bg-black text-zinc-400 px-2 py-0.5 text-[10px] uppercase border border-zinc-800">
                                        {skill}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 flex justify-between items-center gap-4 p-4 border-t border-zinc-800 bg-zinc-950">
                    <span className="text-[10px] text-zinc-500 uppercase">LOGGED: {offer.createdAt}</span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => toggleSaveOffer(offer.id)}
                            className="flex items-center gap-1.5 border border-zinc-700 bg-[#0c0c0e] px-4 py-2 text-xs font-mono uppercase text-white hover:bg-zinc-900 transition-colors"
                        >
                            {isSaved ? <BookmarkIconSolid className="w-3.5 h-3.5 text-white" /> : <BookmarkIcon className="w-3.5 h-3.5 text-zinc-400" />}
                            <span>{isSaved ? 'Saved' : 'Save'}</span>
                        </button>
                        <button 
                            onClick={handleApply} 
                            className="bg-white text-black px-6 py-2 text-xs font-mono uppercase font-bold hover:bg-zinc-200 transition-colors"
                        >
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
        }, 300);
    };

    return (
        <div className="w-full">
            {/* Sub-Header */}
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
                        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block leading-none">// BOOKMARKS</span>
                        <h1 className="text-xs font-bold font-mono text-white tracking-wider uppercase mt-0.5">Saved Opportunities</h1>
                    </div>
                </div>
            </div>

            <div className="p-4 space-y-3">
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
                    <div className="border border-zinc-800 bg-[#0c0c0e] p-8 text-center font-mono">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-1">// NULL_BOOKMARKS</span>
                        <p className="text-zinc-400 text-xs uppercase tracking-wider">You haven't saved any opportunities yet.</p>
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
