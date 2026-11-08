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
    ForwardIcon
} from '../../ui/Icons';
import { handleImageError } from '../../utils/imageUtils';
import { toggleLikePost, toggleBookmarkPost } from '../../../services/postService';
import { useAuth } from '../../../contexts/AuthContext';
import { MarkdownRenderer, parseInlineMarkdown } from '../../ui/MarkdownRenderer';

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
        } catch {
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
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-950/40 border border-emerald-700/60 text-emerald-300 text-[10px] font-mono font-semibold tracking-wider uppercase">
                        <CheckBadgeIcon className="w-3 h-3 text-emerald-400" />
                        Approved
                    </span>
                );
            case 'implemented':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal-950/40 border border-teal-700/60 text-teal-300 text-[10px] font-mono font-semibold tracking-wider uppercase">
                        ★ Implemented
                    </span>
                );
            case 'under_review':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-sky-950/40 border border-sky-700/60 text-sky-300 text-[10px] font-mono font-semibold tracking-wider uppercase">
                        ● Under Review
                    </span>
                );
            case 'rejected':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-950/40 border border-rose-800/60 text-rose-300 text-[10px] font-mono font-semibold tracking-wider uppercase">
                        ✕ Rejected
                    </span>
                );
            case 'withdrawn':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-500 text-[10px] font-mono font-semibold tracking-wider uppercase">
                        ⊘ Withdrawn
                    </span>
                );
            case 'draft':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-400 text-[10px] font-mono font-semibold tracking-wider uppercase">
                        Draft
                    </span>
                );
            case 'open':
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-950/40 border border-amber-700/60 text-amber-300 text-[10px] font-mono font-semibold tracking-wider uppercase">
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
        <article className="bg-[#0c0c0e] border border-zinc-800/90 text-white transition-all hover:border-zinc-700/80 shadow-sm flex flex-col w-full">
            {/* =========================================================================
                CARD HEADER: Author identity, unboxed metadata, type/status indicators
               ========================================================================= */}
            <div className="p-4 sm:p-5 pb-3 sm:pb-3.5 border-b border-zinc-850 flex items-center justify-between gap-3 flex-wrap">
                {/* Author Info */}
                <div className="flex items-center gap-3">
                    <img
                        src={post.author?.avatarUrl || `https://picsum.photos/seed/${post.authorId || post.id}/200`}
                        alt={post.author?.name || 'Author'}
                        onError={(e) => handleImageError(e, `https://picsum.photos/seed/${post.authorId || post.id}/200`)}
                        className="w-8 h-8 rounded-full object-cover border border-zinc-800"
                    />
                    <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-semibold text-white font-sans hover:underline cursor-pointer">
                                {post.author?.name || 'Collective Member'}
                            </span>
                            {post.author?.isVerified && (
                                <CheckBadgeIcon className="w-3.5 h-3.5 text-sky-400" />
                            )}
                            {post.author?.username && (
                                <span className="text-[11px] text-zinc-500 font-sans">
                                    @{post.author.username}
                                </span>
                            )}
                        </div>
                        {/* Unboxed text metadata with typographic separators */}
                        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 font-mono">
                            <span>{formatTimeAgo(post.createdAt)}</span>
                            {post.category && (
                                <>
                                    <span className="text-zinc-650">·</span>
                                    <span className="text-zinc-400 font-mono uppercase text-[10px]">
                                        {post.category}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Side: Type Tag, Status Badge, Admin Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Post Format Indicator */}
                    {voiceType === 'proposal' && (
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono uppercase tracking-wider font-semibold">
                                PROPOSAL
                            </span>
                            {proposal && renderProposalStatusBadge(proposal.status)}
                        </div>
                    )}
                    {voiceType === 'poll' && (
                        <span className="text-[10px] px-2 py-0.5 bg-sky-950/40 border border-sky-800/60 text-sky-300 font-mono uppercase tracking-wider font-semibold">
                            POLL
                        </span>
                    )}
                    {voiceType === 'consultation' && (
                        <span className="text-[10px] px-2 py-0.5 bg-purple-950/40 border border-purple-800/60 text-purple-300 font-mono uppercase tracking-wider font-semibold">
                            CONSULTATION
                        </span>
                    )}
                    {voiceType === 'discussion' && (
                        <span className="text-[10px] px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-500 font-mono uppercase tracking-wider font-semibold">
                            DISCUSSION
                        </span>
                    )}

                    {/* Secondary Management Button for Admins */}
                    {canManage && voiceType === 'proposal' && (
                        <button
                            type="button"
                            onClick={() => onOpenStatusModal(post)}
                            className="px-2.5 py-0.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white text-[10px] font-mono uppercase font-semibold tracking-wider transition-colors cursor-pointer"
                        >
                            Manage Status
                        </button>
                    )}
                    {canManage && voiceType === 'consultation' && !consultation?.isClosed && (
                        <button
                            type="button"
                            onClick={() => onOpenConcludeConsultation(post)}
                            className="px-2.5 py-0.5 bg-purple-950 hover:bg-purple-900 border border-purple-800/80 text-purple-300 hover:text-white text-[10px] font-mono uppercase font-semibold tracking-wider transition-colors cursor-pointer"
                        >
                            Conclude
                        </button>
                    )}
                </div>
            </div>

            {/* =========================================================================
                CARD CONTENT AREA: Title, Summary/Outcome, Poll/Consultation, Body
               ========================================================================= */}
            <div className="p-4 sm:p-5 space-y-4">
                {/* Title */}
                <h3 className="text-base sm:text-lg font-semibold text-white tracking-tight leading-snug font-sans">
                    {parseInlineMarkdown(post.title)}
                </h3>

                {/* Proposal Executive Summary: Clean, quiet editorial callout */}
                {voiceType === 'proposal' && proposal?.summary && (
                    <div className="bg-zinc-950/60 border-l-2 border-amber-500/80 border-y border-r border-zinc-850/60 p-3.5 space-y-1">
                        <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 block">
                            EXECUTIVE SUMMARY //
                        </span>
                        <div className="text-xs sm:text-[13px] text-zinc-300 font-sans leading-relaxed">
                            {parseInlineMarkdown(proposal.summary)}
                        </div>
                    </div>
                )}

                {/* Ratified Decision Callout Banner */}
                {decision?.isRecorded && (
                    <div className="bg-emerald-950/15 border border-emerald-800/40 p-4 space-y-2.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 text-emerald-400 font-mono font-semibold uppercase tracking-wider text-[11px]">
                                <CheckBadgeIcon className="w-4 h-4 text-emerald-400" />
                                <span>// RATIFIED COMMUNITY DECISION</span>
                            </div>
                            <span className="text-[10px] text-zinc-500 font-mono">
                                Ratified: {new Date(decision.decisionDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                        </div>
                        <div className="text-xs sm:text-sm text-zinc-200 font-sans leading-relaxed">
                            {parseInlineMarkdown(decision.outcome)}
                        </div>
                        <div className="pt-1.5 flex items-center justify-between text-[11px] text-zinc-400 flex-wrap gap-2 border-t border-emerald-900/40">
                            <span className="font-sans">
                                <strong className="text-zinc-300 font-mono text-[10px] uppercase">Responsible:</strong> {decision.responsibleAuthority}
                            </span>
                            {decision.implementationProgress !== undefined && (
                                <div className="flex items-center gap-2">
                                    <span className="text-zinc-400 font-mono text-[10px]">
                                        Progress: {decision.implementationProgress}%
                                    </span>
                                    <div className="w-24 h-1 bg-zinc-900 border border-zinc-800 overflow-hidden">
                                        <div
                                            className="h-full bg-emerald-400 transition-all duration-500"
                                            style={{ width: `${Math.min(100, Math.max(0, decision.implementationProgress))}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Interactive Poll Options */}
                {voiceType === 'poll' && poll && (
                    <div className="space-y-2.5 pt-0.5">
                        <div className="space-y-2">
                            {poll.options.map((opt) => {
                                const percent = pollTotalVotes > 0
                                    ? Math.round((opt.votes / pollTotalVotes) * 100)
                                    : 0;
                                const isUserChoice = poll.userVotedOptionId === opt.id ||
                                    (currentUser && poll.votesByOption?.[opt.id]?.includes(currentUser.uid));

                                return (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => handleVoteOption(opt.id)}
                                        disabled={!isMember && !canManage}
                                        className={`w-full relative overflow-hidden text-left p-3 border transition-all text-xs cursor-pointer ${
                                            isUserChoice
                                                ? 'border-sky-500/60 bg-sky-950/20'
                                                : 'border-zinc-800/90 bg-zinc-950/60 hover:border-zinc-700'
                                        }`}
                                    >
                                        {/* Background percentage fill bar */}
                                        {shouldShowPollResults && (
                                            <div
                                                className={`absolute inset-y-0 left-0 transition-all duration-500 ${
                                                    isUserChoice ? 'bg-sky-900/30' : 'bg-zinc-850/60'
                                                }`}
                                                style={{ width: `${percent}%` }}
                                            />
                                        )}

                                        <div className="relative z-10 flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2.5 font-sans text-zinc-200">
                                                <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                                                    isUserChoice ? 'border-sky-400 bg-sky-500' : 'border-zinc-650'
                                                }`}>
                                                    {isUserChoice && <span className="w-1.5 h-1.5 rounded-full bg-black" />}
                                                </span>
                                                <span className="font-normal sm:font-medium">{parseInlineMarkdown(opt.text)}</span>
                                                {isUserChoice && (
                                                    <span className="text-[10px] text-sky-400 font-mono font-semibold uppercase">
                                                        [Your Vote]
                                                    </span>
                                                )}
                                            </div>

                                            {shouldShowPollResults && (
                                                <div className="text-right shrink-0 font-mono text-[11px]">
                                                    <span className="font-bold text-white">{percent}%</span>
                                                    <span className="text-zinc-500 ml-1.5">({opt.votes})</span>
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Quiet Poll Metadata */}
                        <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono pt-1 border-t border-zinc-850">
                            <span>Total Votes: <strong className="text-zinc-300 font-semibold">{pollTotalVotes}</strong></span>
                            {poll.expiresAt ? (
                                <span>
                                    {new Date(poll.expiresAt) > new Date()
                                        ? `Closes ${new Date(poll.expiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                                        : 'Voting Concluded'}
                                </span>
                            ) : (
                                <span>Open Quorum</span>
                            )}
                        </div>
                    </div>
                )}

                {/* Structured Consultation Prompts & Submissions */}
                {voiceType === 'consultation' && consultation && (
                    <div className="space-y-3 pt-0.5">
                        <div className="space-y-2">
                            <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono block">
                                CONSULTATION PROMPTS // ({consultation.prompts.length} Core Questions)
                            </span>
                            {consultation.prompts.map((prompt, idx) => (
                                <div key={idx} className="p-3 bg-zinc-950/60 border border-zinc-850 text-xs font-sans text-zinc-300">
                                    <span className="text-purple-400 font-mono font-semibold mr-1.5">Q{idx + 1}.</span>
                                    {parseInlineMarkdown(prompt)}
                                </div>
                            ))}
                        </div>

                        {/* Synthesis outcome if concluded */}
                        {consultation.isClosed && consultation.summaryOutcome && (
                            <div className="p-3.5 bg-purple-950/15 border border-purple-800/40 space-y-1.5">
                                <span className="text-[10px] text-purple-400 uppercase font-mono font-semibold block">
                                    ✓ CONSENSUS SYNTHESIS REPORT (Concluded by {consultation.closedBy || 'Council'})
                                </span>
                                <div className="text-zinc-200 font-sans text-xs leading-relaxed">
                                    <MarkdownRenderer content={consultation.summaryOutcome} />
                                </div>
                            </div>
                        )}

                        {/* Action Row */}
                        <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-zinc-850">
                            <div className="flex items-center gap-2 text-[11px] text-zinc-500 font-mono">
                                <span>Submissions: <strong className="text-purple-400 font-semibold">{consultation.responseCount || 0}</strong></span>
                                {consultation.deadline && (
                                    <>
                                        <span>·</span>
                                        <span>Deadline: {new Date(consultation.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                    </>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                {consultation.responses && consultation.responses.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setShowResponses(!showResponses)}
                                        className="text-zinc-400 hover:text-white text-[11px] font-mono uppercase underline cursor-pointer"
                                    >
                                        {showResponses ? 'Hide Submissions' : `View Submissions (${consultation.responses.length})`}
                                    </button>
                                )}
                                {!consultation.isClosed && (
                                    <button
                                        type="button"
                                        onClick={() => onOpenConsultationResponse(post)}
                                        className="px-3 py-1 bg-purple-600/90 hover:bg-purple-600 text-white text-[11px] font-mono uppercase font-semibold tracking-wider transition-colors cursor-pointer"
                                    >
                                        Submit Feedback
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Expandable Submissions Drawer */}
                        {showResponses && consultation.responses && (
                            <div className="p-3 bg-zinc-950/80 border border-zinc-850 space-y-2.5 animate-fadeIn">
                                <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono block">
                                    MEMBER SUBMISSIONS //
                                </span>
                                {consultation.responses.map((resp) => (
                                    <div key={resp.id} className="p-3 bg-zinc-900/40 border border-zinc-850 space-y-2">
                                        <div className="flex items-center justify-between text-[11px]">
                                            <span className="font-semibold text-white font-sans">{resp.userName}</span>
                                            <span className="text-zinc-500 font-mono text-[10px]">
                                                {formatTimeAgo(resp.submittedAt)}
                                            </span>
                                        </div>
                                        <div className="space-y-1.5 text-xs font-sans text-zinc-300">
                                            {resp.answers.map((ans, aIdx) => (
                                                <div key={aIdx} className="border-l-2 border-purple-500/60 pl-2.5 py-0.5">
                                                    <span className="text-[10px] text-zinc-500 font-mono block">{parseInlineMarkdown(ans.promptText)}</span>
                                                    <div className="text-zinc-200 mt-0.5 leading-relaxed font-sans text-xs">
                                                        {parseInlineMarkdown(ans.answerText)}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Body Text: Rendered with safe, high-fidelity MarkdownRenderer */}
                {post.content && (
                    <MarkdownRenderer
                        content={post.content}
                        isCollapsed={!expandedContent}
                        maxPreviewChars={340}
                        onToggleExpand={() => setExpandedContent(!expandedContent)}
                    />
                )}

                {/* Optional Media */}
                {post.mediaUrl && (
                    <div className="border border-zinc-850 overflow-hidden max-h-96 bg-zinc-950">
                        <img
                            src={post.mediaUrl}
                            alt={post.title}
                            onError={(e) => handleImageError(e, 'https://picsum.photos/seed/voice/800/450')}
                            className="w-full h-auto object-cover"
                        />
                    </div>
                )}

                {/* Quiet Unboxed Tags */}
                {post.tags && post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-0.5">
                        {post.tags.map((tag, idx) => (
                            <span
                                key={idx}
                                className="text-[11px] text-zinc-500 hover:text-zinc-400 font-mono transition-colors"
                            >
                                #{tag}
                            </span>
                        ))}
                    </div>
                )}

                {/* Expandable Governance Audit Log for Proposals */}
                {voiceType === 'proposal' && proposal?.statusHistory && proposal.statusHistory.length > 0 && (
                    <div className="pt-2 border-t border-zinc-850">
                        <button
                            type="button"
                            onClick={() => setShowHistory(!showHistory)}
                            className="text-[10px] text-zinc-500 hover:text-zinc-300 uppercase tracking-widest font-mono flex items-center gap-1.5 cursor-pointer"
                        >
                            <span>GOVERNANCE AUDIT LOG ({proposal.statusHistory.length})</span>
                            <span className="text-[9px]">{showHistory ? '▲' : '▼'}</span>
                        </button>
                        {showHistory && (
                            <div className="mt-2.5 p-3 bg-zinc-950/80 border border-zinc-850 space-y-2 text-[11px] font-mono animate-fadeIn">
                                {proposal.statusHistory.map((h, i) => (
                                    <div key={i} className="flex items-start justify-between gap-3 border-b border-zinc-900 pb-2 last:border-0 last:pb-0">
                                        <div className="space-y-0.5">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-white uppercase text-[10px]">
                                                    Status: {h.status.replace('_', ' ')}
                                                </span>
                                                <span className="text-zinc-500 text-[10px]">
                                                    by {h.changedByName || h.changedBy}
                                                </span>
                                            </div>
                                            {h.note && (
                                                <p className="text-zinc-400 font-sans text-xs mt-0.5 leading-normal">
                                                    "{h.note}"
                                                </p>
                                            )}
                                        </div>
                                        <span className="text-[10px] text-zinc-550 shrink-0">
                                            {formatTimeAgo(h.changedAt)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* =========================================================================
                CARD FOOTER: Standardized engagement toolbar
               ========================================================================= */}
            <div className="px-4 sm:px-5 py-2.5 border-t border-zinc-850 bg-zinc-950/40 flex items-center justify-between text-zinc-400 text-xs font-mono">
                {/* Engagement signals */}
                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={handleLike}
                        className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
                            isLiked ? 'text-red-500' : 'text-zinc-400 hover:text-white'
                        }`}
                        title="Signal support"
                    >
                        <HeartIcon className="w-4 h-4" />
                        <span className="text-[11px]">{formatNumber(likeCount)}</span>
                    </button>

                    <div className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors cursor-pointer">
                        <ChatIcon className="w-4 h-4" />
                        <span className="text-[11px]">{formatNumber(post.commentCount ?? post.stats?.comments ?? 0)}</span>
                    </div>

                    <span className="text-zinc-600 text-[11px] hidden sm:inline">
                        {formatNumber(post.viewCount ?? post.stats?.views ?? 0)} views
                    </span>
                </div>

                {/* Secondary tools */}
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleShare}
                        className="p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                        title="Copy record link"
                    >
                        <ForwardIcon className="w-4 h-4" />
                    </button>
                    {copied && (
                        <span className="text-[10px] text-emerald-400">Copied!</span>
                    )}

                    <button
                        type="button"
                        onClick={handleBookmark}
                        className={`p-1 transition-colors cursor-pointer ${
                            isSaved ? 'text-yellow-400' : 'text-zinc-400 hover:text-white'
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
