import React, { useState, useEffect, useMemo } from 'react';
import type { Community, Post, CollectiveVoiceType, ProposalStatus } from '../../../types';
import { 
    subscribeCommunityVoicePosts, 
    castPollVote, 
    updateProposalStatus, 
    submitConsultationResponse, 
    concludeConsultation 
} from '../../../services/collectiveVoiceService';
import { CollectiveVoiceCard } from './CollectiveVoiceCard';
import { CreateCollectiveVoiceModal } from './CreateCollectiveVoiceModal';
import { ProposalStatusModal } from './ProposalStatusModal';
import { ConsultationResponseModal } from './ConsultationResponseModal';
import { ConcludeConsultationModal } from './ConcludeConsultationModal';
import { 
    ShieldCheckIcon, 
    TrendingUpIcon, 
    ChatIcon, 
    SparklesIcon, 
    CheckBadgeIcon 
} from '../../ui/Icons';
import { useAuth } from '../../../contexts/AuthContext';

interface CollectiveVoiceViewProps {
    community: Community;
    canManage: boolean;
    isMember: boolean;
}

type FilterCategory = 'ALL' | 'DISCUSSIONS' | 'PROPOSALS' | 'POLLS' | 'CONSULTATIONS' | 'DECISIONS';
type SortOption = 'LATEST' | 'MOST_ACTIVE' | 'MOST_VOTED';

export const CollectiveVoiceView: React.FC<CollectiveVoiceViewProps> = ({
    community,
    canManage,
    isMember,
}) => {
    const { currentUser } = useAuth();
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);

    // Filtering & Sorting
    const [activeFilter, setActiveFilter] = useState<FilterCategory>('ALL');
    const [proposalStatusFilter, setProposalStatusFilter] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOption, setSortOption] = useState<SortOption>('LATEST');

    // Modals
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [initialVoiceType, setInitialVoiceType] = useState<CollectiveVoiceType>('discussion');
    const [statusModalPost, setStatusModalPost] = useState<Post | null>(null);
    const [consultationResponsePost, setConsultationResponsePost] = useState<Post | null>(null);
    const [concludeConsultationPost, setConcludeConsultationPost] = useState<Post | null>(null);

    // Subscribe to voice posts in real-time
    useEffect(() => {
        setLoading(true);
        const unsubscribe = subscribeCommunityVoicePosts(
            community.id,
            community.name,
            (updatedPosts) => {
                setPosts(updatedPosts);
                setLoading(false);
            }
        );
        return () => unsubscribe();
    }, [community.id, community.name]);

    // Handlers
    const handleVote = async (postId: string, optionId: string) => {
        if (!currentUser) return;
        try {
            await castPollVote(community.id, postId, optionId, {
                uid: currentUser.uid,
                displayName: currentUser.displayName,
            });
        } catch (err) {
            console.error('[POLL_VOTE_ERR]', err);
        }
    };

    const handleConfirmStatus = async (
        newStatus: ProposalStatus,
        options: {
            note?: string;
            decisionOutcome?: string;
            responsibleAuthority?: string;
            implementationProgress?: number;
        }
    ) => {
        if (!statusModalPost || !currentUser) return;
        await updateProposalStatus(
            community.id,
            statusModalPost.id,
            newStatus,
            { uid: currentUser.uid, displayName: currentUser.displayName },
            options
        );
    };

    const handleSubmitConsultation = async (
        answers: { promptIndex: number; promptText: string; answerText: string }[]
    ) => {
        if (!consultationResponsePost || !currentUser) return;
        await submitConsultationResponse(
            community.id,
            consultationResponsePost.id,
            answers,
            {
                uid: currentUser.uid,
                displayName: currentUser.displayName,
                photoURL: currentUser.photoURL,
            }
        );
    };

    const handleConcludeConsultation = async (summaryOutcome: string) => {
        if (!concludeConsultationPost || !currentUser) return;
        await concludeConsultation(
            community.id,
            concludeConsultationPost.id,
            summaryOutcome,
            { uid: currentUser.uid, displayName: currentUser.displayName }
        );
    };

    const openCreateWithFormat = (type: CollectiveVoiceType) => {
        setInitialVoiceType(type);
        setIsCreateModalOpen(true);
    };

    // Calculate metrics
    const metrics = useMemo(() => {
        const total = posts.length;
        const openProposals = posts.filter(
            (p) => (p.voiceType === 'proposal' || p.proposalMeta) && p.proposalMeta?.status === 'open'
        ).length;
        const activePolls = posts.filter((p) => {
            const poll = p.pollMeta;
            if (!poll && p.voiceType !== 'poll') return false;
            if (!poll?.expiresAt) return true;
            return new Date(poll.expiresAt) > new Date();
        }).length;
        const ratifiedDecisions = posts.filter(
            (p) => p.decisionMeta?.isRecorded || p.proposalMeta?.status === 'approved' || p.proposalMeta?.status === 'implemented'
        ).length;

        return { total, openProposals, activePolls, ratifiedDecisions };
    }, [posts]);

    // Filter and Sort
    const filteredPosts = useMemo(() => {
        let result = [...posts];

        // Filter Category
        if (activeFilter === 'DISCUSSIONS') {
            result = result.filter(
                (p) => p.voiceType === 'discussion' || (!p.proposalMeta && !p.pollMeta && !p.consultationMeta)
            );
        } else if (activeFilter === 'PROPOSALS') {
            result = result.filter((p) => p.voiceType === 'proposal' || Boolean(p.proposalMeta));
            if (proposalStatusFilter !== 'ALL') {
                result = result.filter((p) => p.proposalMeta?.status === proposalStatusFilter);
            }
        } else if (activeFilter === 'POLLS') {
            result = result.filter((p) => p.voiceType === 'poll' || Boolean(p.pollMeta));
        } else if (activeFilter === 'CONSULTATIONS') {
            result = result.filter((p) => p.voiceType === 'consultation' || Boolean(p.consultationMeta));
        } else if (activeFilter === 'DECISIONS') {
            result = result.filter(
                (p) => p.decisionMeta?.isRecorded || p.proposalMeta?.status === 'approved' || p.proposalMeta?.status === 'implemented'
            );
        }

        // Search Query
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            result = result.filter((p) => {
                const matchTitle = p.title?.toLowerCase().includes(q);
                const matchContent = p.content?.toLowerCase().includes(q);
                const matchSummary = (p.proposalMeta?.summary || p.aiSummary || p.oneLine || '').toLowerCase().includes(q);
                const matchAuthor = p.author?.name?.toLowerCase().includes(q);
                const matchTag = p.tags?.some((t) => t.toLowerCase().includes(q));
                return matchTitle || matchContent || matchSummary || matchAuthor || matchTag;
            });
        }

        // Sort
        result.sort((a, b) => {
            if (sortOption === 'MOST_ACTIVE') {
                const aComments = a.commentCount ?? a.stats?.comments ?? 0;
                const bComments = b.commentCount ?? b.stats?.comments ?? 0;
                return bComments - aComments;
            }
            if (sortOption === 'MOST_VOTED') {
                const aVotes = a.pollMeta?.totalVotes ?? a.likeCount ?? a.stats?.likes ?? 0;
                const bVotes = b.pollMeta?.totalVotes ?? b.likeCount ?? b.stats?.likes ?? 0;
                return bVotes - aVotes;
            }
            // LATEST default
            const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
            const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
            return bTime - aTime;
        });

        return result;
    }, [posts, activeFilter, proposalStatusFilter, searchQuery, sortOption]);

    return (
        <section className="space-y-6 w-full min-w-0 max-w-full">
            {/* Header & Hero */}
            <div className="bg-[#0c0c0e] border border-zinc-800 p-5 sm:p-7 relative overflow-hidden">
                <div className="relative z-10 space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">
                                    04. COLLECTIVE VOICE // SOVEREIGN_DELIBERATION
                                </span>
                                <span className="text-[9px] px-1.5 py-0.2 bg-emerald-950/80 border border-emerald-800 text-emerald-400 font-mono font-bold">
                                    LIVE PILLAR
                                </span>
                            </div>
                            <h2 className="text-xl sm:text-2xl font-bold text-white uppercase tracking-wider font-mono">
                                Collective Voice
                            </h2>
                            <p className="text-zinc-400 text-xs sm:text-sm font-sans max-w-2xl mt-1 leading-relaxed">
                                Formulate proposals, gather instant quorum through polls, participate in structured stakeholder consultations, and track ratified community decisions.
                            </p>
                        </div>

                        {/* Quick Action Button */}
                        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                            <button
                                onClick={() => openCreateWithFormat('proposal')}
                                className="px-3.5 py-2 bg-zinc-900 border border-zinc-700 text-zinc-200 hover:text-white hover:border-zinc-500 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5"
                            >
                                <ShieldCheckIcon className="w-3.5 h-3.5 text-amber-400" />
                                <span>+ Proposal</span>
                            </button>
                            <button
                                onClick={() => openCreateWithFormat('poll')}
                                className="px-3.5 py-2 bg-zinc-900 border border-zinc-700 text-zinc-200 hover:text-white hover:border-zinc-500 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5"
                            >
                                <TrendingUpIcon className="w-3.5 h-3.5 text-cyan-400" />
                                <span>+ Poll</span>
                            </button>
                            {canManage && (
                                <button
                                    onClick={() => openCreateWithFormat('consultation')}
                                    className="px-3.5 py-2 bg-zinc-900 border border-purple-800/80 text-purple-300 hover:bg-purple-950 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5"
                                >
                                    <SparklesIcon className="w-3.5 h-3.5 text-purple-400" />
                                    <span>+ Consultation</span>
                                </button>
                            )}
                            <button
                                onClick={() => openCreateWithFormat('discussion')}
                                className="px-4 py-2 bg-white text-black hover:bg-zinc-200 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer"
                            >
                                Broadcast Voice
                            </button>
                        </div>
                    </div>

                    {/* Metric Indicators Strip */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-zinc-800/80 font-mono">
                        <div className="p-2.5 bg-zinc-950/60 border border-zinc-800/80">
                            <span className="text-[10px] text-zinc-500 uppercase block">Total Records</span>
                            <span className="text-base sm:text-lg font-bold text-white">{metrics.total}</span>
                        </div>
                        <div className="p-2.5 bg-zinc-950/60 border border-zinc-800/80">
                            <span className="text-[10px] text-amber-400 uppercase block">Open Proposals</span>
                            <span className="text-base sm:text-lg font-bold text-amber-300">{metrics.openProposals}</span>
                        </div>
                        <div className="p-2.5 bg-zinc-950/60 border border-zinc-800/80">
                            <span className="text-[10px] text-cyan-400 uppercase block">Active Polls</span>
                            <span className="text-base sm:text-lg font-bold text-cyan-300">{metrics.activePolls}</span>
                        </div>
                        <div className="p-2.5 bg-zinc-950/60 border border-zinc-800/80">
                            <span className="text-[10px] text-emerald-400 uppercase block">Ratified Decisions</span>
                            <span className="text-base sm:text-lg font-bold text-emerald-300">{metrics.ratifiedDecisions}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Non-member participation notice */}
            {!isMember && !canManage && (
                <div className="p-3 bg-zinc-950 border border-zinc-800 text-zinc-400 text-xs font-mono flex items-center justify-between gap-3">
                    <span>
                        // You are currently viewing public voice records as an observer. Join the collective to propose, vote, and submit consultation feedback.
                    </span>
                </div>
            )}

            {/* Controls Bar: Filters, Search, Sort */}
            <div className="space-y-3 font-mono">
                {/* Main Filter Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-zinc-800 pb-2">
                    {[
                        { id: 'ALL' as FilterCategory, label: 'All Activity' },
                        { id: 'PROPOSALS' as FilterCategory, label: 'Proposals' },
                        { id: 'POLLS' as FilterCategory, label: 'Polls & Votes' },
                        { id: 'CONSULTATIONS' as FilterCategory, label: 'Consultations' },
                        { id: 'DECISIONS' as FilterCategory, label: 'Ratified Decisions' },
                        { id: 'DISCUSSIONS' as FilterCategory, label: 'Discussions' },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => {
                                setActiveFilter(tab.id);
                                if (tab.id !== 'PROPOSALS') setProposalStatusFilter('ALL');
                            }}
                            className={`px-3 py-1.5 text-xs uppercase font-bold tracking-wider transition-all border whitespace-nowrap cursor-pointer ${
                                activeFilter === tab.id
                                    ? 'bg-zinc-900 border-white text-white'
                                    : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/40'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Subfilter for Proposals if active */}
                {activeFilter === 'PROPOSALS' && (
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1 text-[11px]">
                        <span className="text-zinc-500 text-[10px] uppercase tracking-wider mr-1">Status:</span>
                        {['ALL', 'open', 'under_review', 'approved', 'implemented', 'rejected'].map((st) => (
                            <button
                                key={st}
                                onClick={() => setProposalStatusFilter(st)}
                                className={`px-2 py-0.5 border uppercase transition-colors cursor-pointer ${
                                    proposalStatusFilter === st
                                        ? 'bg-white text-black border-white font-bold'
                                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                                }`}
                            >
                                {st.replace('_', ' ')}
                            </button>
                        ))}
                    </div>
                )}

                {/* Search & Sort Row */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                    {/* Search */}
                    <div className="w-full sm:w-80 relative">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search discussions, proposals, polls..."
                            className="w-full bg-[#0c0c0e] border border-zinc-800 px-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-sans"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-xs"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Sort */}
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end text-xs">
                        <span className="text-zinc-500 text-[10px] uppercase tracking-wider">Sort by:</span>
                        <select
                            value={sortOption}
                            onChange={(e) => setSortOption(e.target.value as SortOption)}
                            className="bg-[#0c0c0e] border border-zinc-800 px-2.5 py-1.5 text-zinc-200 text-xs focus:outline-none focus:border-zinc-500 cursor-pointer"
                        >
                            <option value="LATEST">Latest Activity</option>
                            <option value="MOST_ACTIVE">Most Active</option>
                            <option value="MOST_VOTED">Most Voted / Engaged</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Posts Stream */}
            <div className="space-y-4 w-full">
                {loading ? (
                    <div className="p-12 text-center text-zinc-500 font-mono text-xs border border-zinc-800 bg-[#0c0c0e]">
                        Synchronizing Collective Voice records...
                    </div>
                ) : filteredPosts.length === 0 ? (
                    <div className="p-12 text-center space-y-3 border border-zinc-800 bg-[#0c0c0e] font-mono">
                        <span className="text-[10px] text-zinc-600 uppercase tracking-widest block">
                            // NO_MATCHING_VOICE_RECORDS
                        </span>
                        <h4 className="text-base font-bold text-zinc-300 uppercase">
                            No Collective Voice records found
                        </h4>
                        <p className="text-zinc-500 text-xs max-w-md mx-auto font-sans">
                            {searchQuery
                                ? `No voice records match "${searchQuery}". Try broadening your search.`
                                : `Be the first to propose an initiative, launch a poll, or begin a discussion for ${community.name}.`}
                        </p>
                        <div className="pt-2">
                            <button
                                onClick={() => setIsCreateModalOpen(true)}
                                className="px-4 py-2 bg-white text-black hover:bg-zinc-200 text-xs uppercase font-bold tracking-wider cursor-pointer"
                            >
                                + Publish Voice Record
                            </button>
                        </div>
                    </div>
                ) : (
                    filteredPosts.map((post) => (
                        <CollectiveVoiceCard
                            key={post.id}
                            post={post}
                            canManage={canManage}
                            isMember={isMember}
                            onVote={handleVote}
                            onOpenStatusModal={(p) => setStatusModalPost(p)}
                            onOpenConsultationResponse={(p) => setConsultationResponsePost(p)}
                            onOpenConcludeConsultation={(p) => setConcludeConsultationPost(p)}
                        />
                    ))
                )}
            </div>

            {/* Modals */}
            <CreateCollectiveVoiceModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                community={community}
                canManage={canManage}
                initialVoiceType={initialVoiceType}
                onCreated={(newPost) => {
                    setPosts((prev) => [newPost, ...prev]);
                }}
            />

            {statusModalPost && (
                <ProposalStatusModal
                    isOpen={Boolean(statusModalPost)}
                    onClose={() => setStatusModalPost(null)}
                    post={statusModalPost}
                    onConfirm={handleConfirmStatus}
                />
            )}

            {consultationResponsePost && (
                <ConsultationResponseModal
                    isOpen={Boolean(consultationResponsePost)}
                    onClose={() => setConsultationResponsePost(null)}
                    post={consultationResponsePost}
                    currentUserId={currentUser?.uid}
                    onSubmit={handleSubmitConsultation}
                />
            )}

            {concludeConsultationPost && (
                <ConcludeConsultationModal
                    isOpen={Boolean(concludeConsultationPost)}
                    onClose={() => setConcludeConsultationPost(null)}
                    post={concludeConsultationPost}
                    onConclude={handleConcludeConsultation}
                />
            )}
        </section>
    );
};
