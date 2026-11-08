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
    CheckBadgeIcon,
    MagnifyingGlassIcon
} from '../../ui/Icons';
import { useAuth } from '../../../contexts/AuthContext';

interface CollectiveVoiceViewProps {
    community: Community;
    canManage: boolean;
    isMember: boolean;
}

type FilterCategory = 'ALL' | 'PROPOSALS' | 'POLLS' | 'CONSULTATIONS' | 'DECISIONS' | 'DISCUSSIONS';
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

    // Real-time subscription to voice posts
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

    // Calculate metrics and counts for tabs
    const metrics = useMemo(() => {
        const total = posts.length;
        const proposalsCount = posts.filter(p => p.voiceType === 'proposal' || Boolean(p.proposalMeta)).length;
        const openProposals = posts.filter(
            (p) => (p.voiceType === 'proposal' || p.proposalMeta) && p.proposalMeta?.status === 'open'
        ).length;
        const pollsCount = posts.filter(p => p.voiceType === 'poll' || Boolean(p.pollMeta)).length;
        const activePolls = posts.filter((p) => {
            const poll = p.pollMeta;
            if (!poll && p.voiceType !== 'poll') return false;
            if (!poll?.expiresAt) return true;
            return new Date(poll.expiresAt) > new Date();
        }).length;
        const consultationsCount = posts.filter(p => p.voiceType === 'consultation' || Boolean(p.consultationMeta)).length;
        const ratifiedDecisions = posts.filter(
            (p) => p.decisionMeta?.isRecorded || p.proposalMeta?.status === 'approved' || p.proposalMeta?.status === 'implemented'
        ).length;
        const discussionsCount = posts.filter(
            p => p.voiceType === 'discussion' || (!p.proposalMeta && !p.pollMeta && !p.consultationMeta)
        ).length;

        return {
            total,
            proposalsCount,
            openProposals,
            pollsCount,
            activePolls,
            consultationsCount,
            ratifiedDecisions,
            discussionsCount,
        };
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
            {/* =========================================================================
                1. REDESIGNED MAIN HEADER & INTEGRATED DASHBOARD BANNER
               ========================================================================= */}
            <div className="bg-[#0c0c0e] border border-zinc-800 w-full overflow-hidden">
                {/* Top Section: Title, Description, and Structured Actions */}
                <div className="p-5 sm:p-6 pb-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                    {/* Title & Description */}
                    <div className="space-y-1.5 max-w-2xl">
                        <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-amber-400"></span>
                            <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-zinc-400">
                                // 04. COLLECTIVE VOICE
                            </span>
                            <span className="text-zinc-600 font-mono text-[10px]">·</span>
                            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                                SOVEREIGN GOVERNANCE
                            </span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight font-sans">
                            Collective Voice
                        </h2>
                        <p className="text-xs sm:text-sm text-zinc-400 font-sans leading-relaxed">
                            Deliberate on community initiatives, vote on active polls, submit feedback to stakeholder consultations, and track formal decisions.
                        </p>
                    </div>

                    {/* Structured Action Toolbar */}
                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                        <button
                            type="button"
                            onClick={() => openCreateWithFormat('proposal')}
                            className="h-9 px-3 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 text-xs font-mono uppercase font-semibold text-zinc-300 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                            <ShieldCheckIcon className="w-3.5 h-3.5 text-amber-400" />
                            <span>+ Proposal</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => openCreateWithFormat('poll')}
                            className="h-9 px-3 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 text-xs font-mono uppercase font-semibold text-zinc-300 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                            <TrendingUpIcon className="w-3.5 h-3.5 text-sky-400" />
                            <span>+ Poll</span>
                        </button>

                        {canManage && (
                            <button
                                type="button"
                                onClick={() => openCreateWithFormat('consultation')}
                                className="h-9 px-3 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 text-xs font-mono uppercase font-semibold text-zinc-300 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                                <SparklesIcon className="w-3.5 h-3.5 text-purple-400" />
                                <span>+ Consultation</span>
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={() => openCreateWithFormat('discussion')}
                            className="h-9 px-4 bg-white hover:bg-zinc-200 text-black font-mono text-xs uppercase font-bold tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                        >
                            <ChatIcon className="w-3.5 h-3.5" />
                            <span>Broadcast Voice</span>
                        </button>
                    </div>
                </div>

                {/* Bottom Strip: Compact, Integrated Dashboard Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 border-t border-zinc-850 bg-zinc-950/50 divide-x divide-zinc-850">
                    <div className="px-4 sm:px-5 py-3">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block">
                            Total Records
                        </span>
                        <div className="flex items-baseline gap-2 mt-0.5">
                            <span className="text-base sm:text-lg font-bold text-white font-mono">
                                {metrics.total}
                            </span>
                            <span className="text-[11px] text-zinc-600 font-sans hidden sm:inline">
                                published
                            </span>
                        </div>
                    </div>

                    <div className="px-4 sm:px-5 py-3">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400/90 block">
                            Open Proposals
                        </span>
                        <div className="flex items-baseline gap-2 mt-0.5">
                            <span className="text-base sm:text-lg font-bold text-amber-300 font-mono">
                                {metrics.openProposals}
                            </span>
                            <span className="text-[11px] text-zinc-600 font-sans hidden sm:inline">
                                of {metrics.proposalsCount} total
                            </span>
                        </div>
                    </div>

                    <div className="px-4 sm:px-5 py-3">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-sky-400/90 block">
                            Active Polls
                        </span>
                        <div className="flex items-baseline gap-2 mt-0.5">
                            <span className="text-base sm:text-lg font-bold text-sky-300 font-mono">
                                {metrics.activePolls}
                            </span>
                            <span className="text-[11px] text-zinc-600 font-sans hidden sm:inline">
                                open votes
                            </span>
                        </div>
                    </div>

                    <div className="px-4 sm:px-5 py-3">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400/90 block">
                            Ratified Decisions
                        </span>
                        <div className="flex items-baseline gap-2 mt-0.5">
                            <span className="text-base sm:text-lg font-bold text-emerald-300 font-mono">
                                {metrics.ratifiedDecisions}
                            </span>
                            <span className="text-[11px] text-zinc-600 font-sans hidden sm:inline">
                                enacted
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Non-member observer notice */}
            {!isMember && !canManage && (
                <div className="p-3 bg-zinc-950 border border-zinc-800 text-zinc-400 text-xs font-mono flex items-center justify-between gap-3">
                    <span>
                        // You are observing public voice records. Join {community.name} to cast votes, propose initiatives, and participate in consultations.
                    </span>
                </div>
            )}

            {/* =========================================================================
                2. REFINED NAVIGATION, FILTERING & UNIFIED CONTROLS
               ========================================================================= */}
            <div className="space-y-3">
                {/* Main Filter Tabs */}
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar border-b border-zinc-800 font-mono">
                    {[
                        { id: 'ALL' as FilterCategory, label: 'All Activity', count: metrics.total },
                        { id: 'PROPOSALS' as FilterCategory, label: 'Proposals', count: metrics.proposalsCount },
                        { id: 'POLLS' as FilterCategory, label: 'Polls & Votes', count: metrics.pollsCount },
                        { id: 'CONSULTATIONS' as FilterCategory, label: 'Consultations', count: metrics.consultationsCount },
                        { id: 'DECISIONS' as FilterCategory, label: 'Ratified Decisions', count: metrics.ratifiedDecisions },
                        { id: 'DISCUSSIONS' as FilterCategory, label: 'Discussions', count: metrics.discussionsCount },
                    ].map((tab) => {
                        const isActive = activeFilter === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => {
                                    setActiveFilter(tab.id);
                                    if (tab.id !== 'PROPOSALS') setProposalStatusFilter('ALL');
                                }}
                                className={`px-3.5 py-2.5 text-xs uppercase tracking-wider transition-all border-b-2 -mb-[1px] whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                                    isActive
                                        ? 'border-white text-white font-bold bg-zinc-900/30'
                                        : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/20 font-medium'
                                }`}
                            >
                                <span>{tab.label}</span>
                                <span className={`text-[10px] font-mono ${isActive ? 'text-zinc-400' : 'text-zinc-600'}`}>
                                    {tab.count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Subfilter for Proposals */}
                {activeFilter === 'PROPOSALS' && (
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 font-mono text-[11px]">
                        <span className="text-zinc-500 text-[10px] uppercase tracking-wider mr-1">Status:</span>
                        {[
                            { id: 'ALL', label: 'All' },
                            { id: 'open', label: 'Open' },
                            { id: 'under_review', label: 'Under Review' },
                            { id: 'approved', label: 'Approved' },
                            { id: 'implemented', label: 'Implemented' },
                            { id: 'rejected', label: 'Rejected' },
                        ].map((st) => {
                            const isSelected = proposalStatusFilter === st.id;
                            return (
                                <button
                                    key={st.id}
                                    type="button"
                                    onClick={() => setProposalStatusFilter(st.id)}
                                    className={`px-2.5 py-1 uppercase transition-colors cursor-pointer text-[10px] font-mono ${
                                        isSelected
                                            ? 'bg-zinc-800 text-white font-bold border border-zinc-700'
                                            : 'bg-zinc-950/80 text-zinc-400 hover:text-zinc-200 border border-zinc-850'
                                    }`}
                                >
                                    {st.label}
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Unified Search and Sort Toolbar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                    {/* Search Field */}
                    <div className="w-full sm:w-80 relative flex items-center">
                        <div className="absolute left-3 text-zinc-500 pointer-events-none">
                            <MagnifyingGlassIcon className="w-3.5 h-3.5" />
                        </div>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search proposals, polls, topics..."
                            className="w-full h-9 bg-[#0c0c0e] border border-zinc-800 pl-8 pr-8 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 font-sans"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2.5 text-zinc-500 hover:text-white text-xs p-1 cursor-pointer"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Sort Selector */}
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end font-mono text-xs">
                        <span className="text-zinc-500 text-[10px] uppercase tracking-wider shrink-0">
                            Sort:
                        </span>
                        <select
                            value={sortOption}
                            onChange={(e) => setSortOption(e.target.value as SortOption)}
                            className="h-9 bg-[#0c0c0e] border border-zinc-800 px-3 text-zinc-300 text-xs focus:outline-none focus:border-zinc-600 cursor-pointer font-sans"
                        >
                            <option value="LATEST">Latest Activity</option>
                            <option value="MOST_ACTIVE">Most Active</option>
                            <option value="MOST_VOTED">Most Voted / Engaged</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* =========================================================================
                3. FEED OF REFINED POST CARDS
               ========================================================================= */}
            <div className="space-y-4 w-full">
                {loading ? (
                    <div className="p-12 text-center text-zinc-500 font-mono text-xs border border-zinc-800 bg-[#0c0c0e]">
                        Synchronizing Collective Voice records...
                    </div>
                ) : filteredPosts.length === 0 ? (
                    <div className="p-12 text-center space-y-3 border border-zinc-800 bg-[#0c0c0e]">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono block">
                            // NO_MATCHING_VOICE_RECORDS
                        </span>
                        <h4 className="text-base font-semibold text-zinc-300 font-sans">
                            No Collective Voice records found
                        </h4>
                        <p className="text-zinc-500 text-xs max-w-md mx-auto font-sans leading-relaxed">
                            {searchQuery
                                ? `No voice records match "${searchQuery}". Try broadening your search or switching categories.`
                                : `Be the first to submit a proposal, launch a community poll, or start a discussion for ${community.name}.`}
                        </p>
                        <div className="pt-2">
                            <button
                                type="button"
                                onClick={() => setIsCreateModalOpen(true)}
                                className="px-4 py-2 bg-white text-black hover:bg-zinc-200 text-xs uppercase font-bold tracking-wider font-mono cursor-pointer"
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
