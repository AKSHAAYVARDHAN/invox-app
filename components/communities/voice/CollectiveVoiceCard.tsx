import React, { useState } from 'react';
import type { Post, ProposalStatus } from '../../../types';
import { 
    HeartIcon, 
    ChatIcon, 
    ShieldCheckIcon, 
    TrendingUpIcon, 
    SparklesIcon, 
    CheckBadgeIcon,
    BookmarkIcon,
    ForwardIcon,
    EllipsisVerticalIcon
} from '../../ui/Icons';
import { handleImageError } from '../../utils/imageUtils';
import { toggleLikePost, toggleBookmarkPost } from '../../../services/postService';
import { useAuth } from '../../../contexts/AuthContext';

interface CollectiveVoiceCardProps {
    post: Post;
    canManage: boolean;
    isMember: boolean;
    onVote: (postId: string, optionId: string) => Promise<void>;
    onOpenStatusModal: (post: Post) => void;
    onOpenConsultationResponse: (post: Post) => void;
    onOpenConcludeConsultation: (post: Post) => void;
}

const formatNumber = (num?: number): string => {
    if (!num || isNaN(num)) return '0';
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toLocaleString();
};

const formatTimeAgo = (date?: Date | string): string => {
    if (!date) return 'Recently';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return 'Recently';
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 2) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export const CollectiveVoiceCard: React.FC<CollectiveVoiceCardProps> = ({
    post,
    canManage,
    isMember,
    onVote,
    onOpenStatusModal,
    onOpenConsultationResponse,
    onOpenConcludeConsultation,
}) => {
    const { currentUser } = useAuth();
    const [isLiked, setIsLiked] = useState(Boolean(post.userLiked));
    const [likeCount, setLikeCount] = useState(post.stats?.likes ?? post.likeCount ?? 0);
    const [isSaved, setIsSaved] = useState(Boolean(post.userSaved));
    const [copied, setCopied] = useState(false);
    const [expandedContent, setExpandedContent] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showResponses, setShowResponses] = useState(false);
    const [votingOptionId, setVotingOptionId] = useState<string | null>(null);

    const voiceType = post.voiceType || (post.proposalMeta ? 'proposal' : post.pollMeta ? 'poll' : post.consultationMeta ? 'consultation' : 'discussion');
    const proposal = post.proposalMeta;
    const poll = post.pollMeta;
    const consultation = post.consultationMeta;
    const decision = post.decisionMeta;

    const handleLike = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!currentUser) return;
        const prevLiked = isLiked;
        const prevCount = likeCount;
        setIsLiked(!prevLiked);
        setLikeCount(prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1);

        try {
            await toggleLikePost(post.id);
        } catch (err) {
            // Revert on error
            setIsLiked(prevLiked);
            setLikeCount(prevCount);
        }
    };

    const handleBookmark = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!currentUser) return;
        setIsSaved(!isSaved);
        try {
            await toggleBookmarkPost(post.id);
        } catch {
            setIsSaved(isSaved);
        }
    };

    const handleShare = (e: React.MouseEvent) => {
        e.stopPropagation();
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const handleVoteOption = async (optionId: string) => {
        if (!isMember && !canManage) return;
        setVotingOptionId(optionId);
        try {
            await onVote(post.id, optionId);
        } finally {
            setVotingOptionId(null);
        }
    };

    const renderProposalStatusBadge = (status: ProposalStatus) => {
        switch (status) {
            case 'approved':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-950/80 border border-emerald-700/80 text-emerald-300 text-[10px] font-bold tracking-wider uppercase">
                        <CheckBadgeIcon className="w-3 h-3" />
                        Approved / Ratified
                    </span>
                );
            case 'implemented':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-cyan-950/80 border border-cyan-700/80 text-cyan-300 text-[10px] font-bold tracking-wider uppercase">
                        ★ Implemented
                    </span>
                );
            case 'under_review':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-950/80 border border-indigo-700/80 text-indigo-300 text-[10px] font-bold tracking-wider uppercase">
                        ● Under Council Review
                    </span>
                );
            case 'rejected':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-950/80 border border-rose-800/80 text-rose-300 text-[10px] font-bold tracking-wider uppercase">
                        ✕ Rejected
                    </span>
                );
            case 'withdrawn':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-900 border border-zinc-700 text-zinc-400 text-[10px] font-bold tracking-wider uppercase">
                        ⊘ Withdrawn
                    </span>
                );
            case 'draft':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-500 text-[10px] font-bold tracking-wider uppercase">
                        Draft
                    </span>
                );
            case 'open':
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-950/80 border border-amber-700/80 text-amber-300 text-[10px] font-bold tracking-wider uppercase">
                        ● Open for Discussion
                    </span>
                );
        }
    };

    // Poll calculations
    const pollTotalVotes = poll?.totalVotes || (poll?.options?.reduce((a, b) => a + b.votes, 0) ?? 0);
    const userHasVoted = Boolean(
        poll?.userVotedOptionId ||
        (currentUser && poll?.voterUids?.includes(currentUser.uid))
    );
    const shouldShowPollResults = userHasVoted || !poll?.hideResultsUntilVoted;

    return (
        <article className="bg-[#0c0c0e] border border-zinc-800 text-white font-mono transition-all hover:border-zinc-700 shadow-sm flex flex-col w-full">
            {/* Header Strip */}
            <div className="p-3.5 sm:p-4 border-b border-zinc-800/80 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5">
                    <img
                        src={post.author?.avatarUrl || `https://picsum.photos/seed/${post.authorId || post.id}/200`}
                        alt={post.author?.name || 'Author'}
                        onError={(e) => handleImageError(e, `https://picsum.photos/seed/${post.authorId || post.id}/200`)}
                        className="w-8 h-8 rounded-full object-cover border border-zinc-700"
                    />
                    <div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-white font-sans hover:underline cursor-pointer">
                                {post.author?.name || 'Collective Member'}
                            </span>
                            {post.author?.isVerified && (
                                <CheckBadgeIcon className="w-3.5 h-3.5 text-blue-400" />
                            )}
                            {post.author?.username && (
                                <span className="text-[11px] text-zinc-500">
                                    @{post.author.username}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
                            <span>{formatTimeAgo(post.createdAt)}</span>
                            {post.category && (
                                <>
                                    <span>•</span>
                                    <span className="uppercase text-zinc-400">[{post.category}]</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Format Badge */}
                    {voiceType === 'proposal' && (
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-300 font-bold uppercase tracking-wider">
                                🏛️ PROPOSAL
                            </span>
                            {proposal && renderProposalStatusBadge(proposal.status)}
                        </div>
                    )}
                    {voiceType === 'poll' && (
                        <span className="text-[10px] px-2 py-0.5 bg-cyan-950/60 border border-cyan-800/80 text-cyan-300 font-bold uppercase tracking-wider">
                            📊 POLL
                        </span>
                    )}
                    {voiceType === 'consultation' && (
                        <span className="text-[10px] px-2 py-0.5 bg-purple-950/60 border border-purple-800/80 text-purple-300 font-bold uppercase tracking-wider">
                            📋 CONSULTATION
                        </span>
                    )}
                    {voiceType === 'discussion' && (
                        <span className="text-[10px] px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-400 font-bold uppercase tracking-wider">
                            💬 DISCUSSION
                        </span>
                    )}

                    {/* Admin Actions */}
                    {canManage && voiceType === 'proposal' && (
                        <button
                            onClick={() => onOpenStatusModal(post)}
                            className="px-2.5 py-1 bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 text-[10px] uppercase font-bold tracking-wider transition-colors cursor-pointer"
                        >
                            Manage Status
                        </button>
                    )}
                    {canManage && voiceType === 'consultation' && !consultation?.isClosed && (
                        <button
                            onClick={() => onOpenConcludeConsultation(post)}
                            className="px-2.5 py-1 bg-purple-950 border border-purple-700 text-purple-200 hover:bg-purple-900 text-[10px] uppercase font-bold tracking-wider transition-colors cursor-pointer"
                        >
                            Conclude
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="p-4 sm:p-5 space-y-4">
                {/* Title */}
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug font-sans">
                    {post.title}
                </h3>

                {/* Proposal Summary Callout */}
                {voiceType === 'proposal' && proposal?.summary && (
                    <div className="p-3 bg-zinc-950 border-l-2 border-amber-500 border-y border-r border-zinc-800/80 text-xs">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono block mb-1">
                            EXECUTIVE_SUMMARY //
                        </span>
                        <p className="text-zinc-300 font-sans leading-relaxed">
                            {proposal.summary}
                        </p>
                    </div>
                )}

                {/* Ratified Formal Decision Banner */}
                {decision?.isRecorded && (
                    <div className="p-3.5 bg-emerald-950/25 border border-emerald-700/60 text-xs space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 text-emerald-400 font-bold uppercase tracking-wider text-[11px]">
                                <CheckBadgeIcon className="w-4 h-4 text-emerald-400" />
                                <span>Ratified Community Decision</span>
                            </div>
                            <span className="text-[10px] text-zinc-400 font-mono">
                                Ratified: {new Date(decision.decisionDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                        </div>
                        <p className="text-emerald-100 font-sans text-xs sm:text-sm leading-relaxed font-medium">
                            {decision.outcome}
                        </p>
                        <div className="pt-1 flex items-center justify-between text-[11px] text-zinc-400 flex-wrap gap-2">
                            <span>
                                <strong className="text-zinc-300 font-mono">Responsible Authority:</strong> {decision.responsibleAuthority}
                            </span>
                            {decision.implementationProgress !== undefined && (
                                <div className="flex items-center gap-2">
                                    <span className="text-zinc-300 font-mono text-[10px]">
                                        Progress: {decision.implementationProgress}%
                                    </span>
                                    <div className="w-24 h-1.5 bg-zinc-900 border border-zinc-800 overflow-hidden">
                                        <div
                                            className="h-full bg-emerald-500 transition-all duration-500"
                                            style={{ width: `${Math.min(100, Math.max(0, decision.implementationProgress))}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Poll Interactive Options */}
                {voiceType === 'poll' && poll && (
                    <div className="space-y-2 pt-1">
                        <div className="space-y-2">
                            {poll.options.map((opt) => {
                                const percent = pollTotalVotes > 0
                                    ? Math.round((opt.votes / pollTotalVotes) * 100)
                                    : 0;
                                const isUserChoice = poll.userVotedOptionId === opt.id ||
                                    (currentUser && poll.votesByOption?.[opt.id]?.includes(currentUser.uid));
                                const isVotingThis = votingOptionId === opt.id;

                                return (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => handleVoteOption(opt.id)}
                                        disabled={!isMember && !canManage}
                                        className={`w-full relative overflow-hidden text-left p-3 border transition-all text-xs cursor-pointer ${
                                            isUserChoice
                                                ? 'border-cyan-500/80 bg-cyan-950/20'
                                                : 'border-zinc-800 bg-zinc-950/80 hover:border-zinc-700'
                                        }`}
                                    >
                                        {/* Background percentage fill bar */}
                                        {shouldShowPollResults && (
                                            <div
                                                className={`absolute inset-y-0 left-0 transition-all duration-500 ${
                                                    isUserChoice ? 'bg-cyan-900/30' : 'bg-zinc-800/40'
                                                }`}
                                                style={{ width: `${percent}%` }}
                                            />
                                        )}

                                        <div className="relative z-10 flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2 font-sans font-medium text-zinc-200">
                                                <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0 ${
                                                    isUserChoice ? 'border-cyan-400 bg-cyan-500' : 'border-zinc-600'
                                                }`}>
                                                    {isUserChoice && <span className="w-1.5 h-1.5 rounded-full bg-black" />}
                                                </span>
                                                <span>{opt.text}</span>
                                                {isUserChoice && (
                                                    <span className="text-[10px] text-cyan-400 font-mono font-bold uppercase ml-1">
                                                        [Your Vote]
                                                    </span>
                                                )}
                                            </div>

                                            {shouldShowPollResults && (
                                                <div className="text-right flex-shrink-0 font-mono text-[11px]">
                                                    <span className="font-bold text-white">{percent}%</span>
                                                    <span className="text-zinc-500 ml-1.5">({opt.votes})</span>
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono pt-1">
                            <span>Total Votes: <strong className="text-zinc-300">{pollTotalVotes}</strong></span>
                            {poll.expiresAt ? (
                                <span>
                                    {new Date(poll.expiresAt) > new Date()
                                        ? `Voting closes ${new Date(poll.expiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                                        : 'Voting Concluded'}
                                </span>
                            ) : (
                                <span>Open Quorum</span>
                            )}
                        </div>
                    </div>
                )}

                {/* Consultation Details & Prompts */}
                {voiceType === 'consultation' && consultation && (
                    <div className="space-y-3 pt-1">
                        <div className="space-y-2">
                            <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono block">
                                CONSULTATION_PROMPTS // ({consultation.prompts.length} Core Questions)
                            </span>
                            {consultation.prompts.map((prompt, idx) => (
                                <div key={idx} className="p-2.5 bg-zinc-950 border border-zinc-800 text-xs font-sans text-zinc-300">
                                    <span className="text-purple-400 font-mono font-bold mr-1.5">Q{idx + 1}.</span>
                                    {prompt}
                                </div>
                            ))}
                        </div>

                        {/* Synthesis outcome if concluded */}
                        {consultation.isClosed && consultation.summaryOutcome && (
                            <div className="p-3 bg-purple-950/20 border border-purple-700/60 space-y-1.5">
                                <span className="text-[10px] text-purple-400 uppercase font-mono font-bold block">
                                    ✓ CONSENSUS SYNTHESIS REPORT (Concluded by {consultation.closedBy || 'Council'})
                                </span>
                                <p className="text-zinc-200 font-sans text-xs leading-relaxed">
                                    {consultation.summaryOutcome}
                                </p>
                            </div>
                        )}

                        <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-zinc-800/60">
                            <div className="flex items-center gap-3 text-[11px] text-zinc-500 font-mono">
                                <span>Submissions: <strong className="text-purple-400">{consultation.responseCount || 0}</strong></span>
                                {consultation.deadline && (
                                    <span>Deadline: {new Date(consultation.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                {consultation.responses && consultation.responses.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setShowResponses(!showResponses)}
                                        className="text-zinc-400 hover:text-white text-[11px] uppercase font-bold underline cursor-pointer"
                                    >
                                        {showResponses ? 'Hide Submissions' : `View Submissions (${consultation.responses.length})`}
                                    </button>
                                )}
                                {!consultation.isClosed && (
                                    <button
                                        type="button"
                                        onClick={() => onOpenConsultationResponse(post)}
                                        className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white text-[11px] uppercase font-bold tracking-wider transition-colors cursor-pointer"
                                    >
                                        Submit Feedback
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Expandable Submissions Drawer */}
                        {showResponses && consultation.responses && (
                            <div className="p-3 bg-zinc-950 border border-zinc-800 space-y-3 animate-fadeIn">
                                <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono block">
                                    MEMBER_SUBMISSIONS //
                                </span>
                                {consultation.responses.map((resp) => (
                                    <div key={resp.id} className="p-2.5 bg-zinc-900/60 border border-zinc-800/80 space-y-2">
                                        <div className="flex items-center justify-between text-[11px]">
                                            <span className="font-bold text-white font-sans">{resp.userName}</span>
                                            <span className="text-zinc-500 font-mono text-[10px]">
                                                {formatTimeAgo(resp.submittedAt)}
                                            </span>
                                        </div>
                                        <div className="space-y-1.5 text-xs font-sans text-zinc-300">
                                            {resp.answers.map((ans, aIdx) => (
                                                <div key={aIdx} className="border-l-2 border-purple-500 pl-2">
                                                    <span className="text-[10px] text-zinc-500 font-mono block">{ans.promptText}</span>
                                                    <p className="text-zinc-200 mt-0.5">{ans.answerText}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Body Text */}
                {post.content && (
                    <div className="text-xs sm:text-sm text-zinc-300 font-sans leading-relaxed whitespace-pre-wrap">
                        {expandedContent || post.content.length <= 320 ? (
                            post.content
                        ) : (
                            <>
                                {post.content.slice(0, 320)}...
                                <button
                                    onClick={() => setExpandedContent(true)}
                                    className="ml-2 text-white underline font-bold uppercase text-[11px] cursor-pointer"
                                >
                                    Read Full Record
                                </button>
                            </>
                        )}
                        {expandedContent && post.content.length > 320 && (
                            <button
                                onClick={() => setExpandedContent(false)}
                                className="block mt-2 text-zinc-500 hover:text-white underline uppercase text-[10px] cursor-pointer"
                            >
                                Show Less
                            </button>
                        )}
                    </div>
                )}

                {/* Media Image if present */}
                {post.mediaUrl && (
                    <div className="border border-zinc-800 overflow-hidden max-h-96">
                        <img
                            src={post.mediaUrl}
                            alt={post.title}
                            onError={(e) => handleImageError(e, 'https://picsum.photos/seed/voice/800/450')}
                            className="w-full h-auto object-cover"
                        />
                    </div>
                )}

                {/* Tags */}
                {post.tags && post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                        {post.tags.map((tag, idx) => (
                            <span
                                key={idx}
                                className="text-[10px] px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono uppercase"
                            >
                                #{tag}
                            </span>
                        ))}
                    </div>
                )}

                {/* Status Audit History toggle for Proposals */}
                {voiceType === 'proposal' && proposal?.statusHistory && proposal.statusHistory.length > 0 && (
                    <div className="pt-2 border-t border-zinc-800/60">
                        <button
                            type="button"
                            onClick={() => setShowHistory(!showHistory)}
                            className="text-[10px] text-zinc-500 hover:text-zinc-300 uppercase tracking-widest font-mono flex items-center gap-1 cursor-pointer"
                        >
                            <span>GOVERNANCE_AUDIT_LOG ({proposal.statusHistory.length})</span>
                            <span>{showHistory ? '▲' : '▼'}</span>
                        </button>
                        {showHistory && (
                            <div className="mt-2 p-2.5 bg-zinc-950 border border-zinc-800 space-y-2 text-[11px]">
                                {proposal.statusHistory.map((h, i) => (
                                    <div key={i} className="flex items-start justify-between gap-2 border-b border-zinc-900 pb-1.5 last:border-0 last:pb-0">
                                        <div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-bold text-white uppercase text-[10px]">
                                                    Status: {h.status}
                                                </span>
                                                <span className="text-zinc-500 font-mono text-[10px]">
                                                    by {h.changedByName || h.changedBy}
                                                </span>
                                            </div>
                                            {h.note && (
                                                <p className="text-zinc-400 font-sans text-[11px] mt-0.5">
                                                    "{h.note}"
                                                </p>
                                            )}
                                        </div>
                                        <span className="text-[10px] text-zinc-600 font-mono flex-shrink-0">
                                            {formatTimeAgo(h.changedAt)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Bottom Actions Bar */}
            <div className="px-4 py-2.5 sm:px-5 border-t border-zinc-800/80 bg-zinc-950/60 flex items-center justify-between text-zinc-400 text-xs">
                <div className="flex items-center gap-4">
                    {/* Like / Signal */}
                    <button
                        onClick={handleLike}
                        className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
                            isLiked ? 'text-red-500' : 'hover:text-white'
                        }`}
                    >
                        <HeartIcon className="w-4 h-4" />
                        <span className="font-mono text-[11px]">{formatNumber(likeCount)}</span>
                    </button>

                    {/* Comments */}
                    <div className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer">
                        <ChatIcon className="w-4 h-4" />
                        <span className="font-mono text-[11px]">{formatNumber(post.commentCount ?? post.stats?.comments ?? 0)}</span>
                    </div>

                    {/* Views */}
                    <span className="text-zinc-600 font-mono text-[10px] hidden sm:inline">
                        {formatNumber(post.viewCount ?? post.stats?.views ?? 0)} views
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    {/* Share / Copy link */}
                    <button
                        onClick={handleShare}
                        className="p-1 hover:text-white transition-colors cursor-pointer"
                        title="Copy record link"
                    >
                        <ForwardIcon className="w-4 h-4" />
                    </button>
                    {copied && (
                        <span className="text-[10px] text-emerald-400 font-mono">Copied!</span>
                    )}

                    {/* Bookmark */}
                    <button
                        onClick={handleBookmark}
                        className={`p-1 transition-colors cursor-pointer ${
                            isSaved ? 'text-yellow-400' : 'hover:text-white'
                        }`}
                        title="Save to bookmarks"
                    >
                        <BookmarkIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </article>
    );
};
