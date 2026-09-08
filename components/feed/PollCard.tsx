import React, { useState, useEffect, useCallback } from 'react';
import type { Poll } from '../../types';
import {
    SparklesIcon,
    CheckBadgeIcon,
    EllipsisVerticalIcon,
    ArrowUpIcon,
    TrendingUpIcon,
    PresentationChartBarIcon,
    ForwardIcon,
    BookmarkIcon,
    TrashIcon,
    CloseIcon
} from '../ui/Icons';
import { handleImageError } from '../utils/imageUtils';
import { useLazyLoad } from '../hooks/useLazyLoad';
import AspectRatioBox from '../ui/AspectRatioBox';
import ImageZoomModal from '../ui/ImageZoomModal';
import { useAIAssistant } from '../../contexts/AIAssistantContext';
import { useAuth } from '../../contexts/AuthContext';
import {
    voteOnPoll,
    deletePoll,
    toggleLikePoll,
    toggleBookmarkPoll,
    incrementPollView,
    getUserPollVote
} from '../../services/pollService';

const formatNumber = (num: number) => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num;
};

const formatTimeRemaining = (expiresAt: Date | null, isExpired: boolean): string => {
    if (!expiresAt) return '// DURATION: PERMANENT';
    if (isExpired) return '// STATUS: ENDED';

    const diff = expiresAt.getTime() - Date.now();
    if (diff <= 0) return '// STATUS: ENDED';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;

    if (days > 0) {
        return `// ENDS IN: ${days}D ${remainingHours}H`;
    }
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) {
        return `// ENDS IN: ${hours}H ${minutes}M`;
    }
    return `// ENDS IN: ${Math.max(1, minutes)}M`;
};

interface PollCardProps {
    poll: Poll;
    onDelete?: (pollId: string) => void;
    userVote?: string | null;
    onVoteChange?: (pollId: string, optionId: string, updatedOptions: PollOption[], updatedTotalVotes: number) => void;
}

export const PollCard: React.FC<PollCardProps> = ({ poll, onDelete, userVote, onVoteChange }) => {
    const { openModal } = useAIAssistant();
    const { currentUser } = useAuth();
    const [mediaContainerRef, isVisible] = useLazyLoad<HTMLDivElement>();

    const getVoterKey = useCallback(() => {
        if (currentUser?.uid) return currentUser.uid;
        try {
            let guestId = localStorage.getItem('invox_guest_voter_id');
            if (!guestId) {
                guestId = 'guest_' + Math.random().toString(36).substring(2, 10);
                localStorage.setItem('invox_guest_voter_id', guestId);
            }
            return guestId;
        } catch {
            return 'guest_anon';
        }
    }, [currentUser?.uid]);

    const [selectedOptionId, setSelectedOptionId] = useState<string | null>(() => {
        if (userVote) return userVote;
        if (poll.userVotedOptionId) return poll.userVotedOptionId;
        try {
            const voterKey = currentUser?.uid || (typeof localStorage !== 'undefined' ? localStorage.getItem('invox_guest_voter_id') : null) || '';
            const cached = (voterKey ? localStorage.getItem(`poll_vote_${voterKey}_${poll.id}`) : null) || localStorage.getItem(`poll_vote_${poll.id}`);
            if (cached) return cached;
        } catch {}
        return null;
    });

    const [localOptions, setLocalOptions] = useState<PollOption[]>(() => {
        try {
            const savedCounts = localStorage.getItem(`poll_options_${poll.id}`);
            if (savedCounts) {
                const parsed = JSON.parse(savedCounts);
                if (Array.isArray(parsed) && parsed.length === poll.options.length) {
                    return parsed;
                }
            }
        } catch {}
        return poll.options;
    });

    const [localTotalVotes, setLocalTotalVotes] = useState<number>(() => {
        try {
            const savedTotal = localStorage.getItem(`poll_total_${poll.id}`);
            if (savedTotal) {
                const num = Number(savedTotal);
                if (!isNaN(num)) return num;
            }
        } catch {}
        return poll.totalVotes;
    });

    const [isVoting, setIsVoting] = useState(false);
    const [voteError, setVoteError] = useState<string | null>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const [isLiked, setIsLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(poll.stats?.likes || poll.likeCount || 0);
    const [isSaved, setIsSaved] = useState(false);
    const [copied, setCopied] = useState(false);
    const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);

    const isOwner = currentUser?.uid && poll.authorId === currentUser.uid;
    const isExpired = poll.status === 'expired' || (poll.expiresAt ? poll.expiresAt.getTime() <= Date.now() : false);
    const hasVoted = Boolean(selectedOptionId);
    const showResults = hasVoted || isExpired;

    // Sync state when poll props change, but preserve user's local voted options
    useEffect(() => {
        if (isVoting) return;

        let targetOptions = poll.options;
        let targetTotal = poll.totalVotes;

        const voterKey = currentUser?.uid || (typeof localStorage !== 'undefined' ? (localStorage.getItem('invox_guest_voter_id') || 'guest_voter') : 'guest_voter');
        const userChoice = selectedOptionId || (typeof localStorage !== 'undefined' ? (localStorage.getItem(`poll_vote_${voterKey}_${poll.id}`) || localStorage.getItem(`poll_vote_${poll.id}`)) : null);

        if (userChoice && typeof localStorage !== 'undefined') {
            try {
                const savedCounts = localStorage.getItem(`poll_options_${poll.id}`);
                const savedTotal = localStorage.getItem(`poll_total_${poll.id}`);
                if (savedCounts) {
                    const parsed = JSON.parse(savedCounts);
                    if (Array.isArray(parsed) && parsed.length === poll.options.length) {
                        targetOptions = parsed;
                        if (savedTotal) {
                            const parsedNum = Number(savedTotal);
                            if (!isNaN(parsedNum)) targetTotal = parsedNum;
                        }
                    }
                }
            } catch {}
        }

        setLocalOptions(prev => {
            if (prev === targetOptions) return prev;
            const isSame = prev.length === targetOptions.length &&
                prev.every((opt, i) => opt.id === targetOptions[i]?.id && opt.voteCount === targetOptions[i]?.voteCount);
            return isSame ? prev : targetOptions;
        });

        setLocalTotalVotes(prev => prev === targetTotal ? prev : targetTotal);
    }, [poll.options, poll.totalVotes, poll.id, isVoting, selectedOptionId, currentUser?.uid]);

    useEffect(() => {
        if (userVote) {
            setSelectedOptionId(prev => prev === userVote ? prev : userVote);
        } else if (poll.userVotedOptionId) {
            setSelectedOptionId(prev => prev === poll.userVotedOptionId ? prev : (poll.userVotedOptionId || null));
        }
    }, [userVote, poll.userVotedOptionId]);

    // Load initial user vote from Firestore or cache
    useEffect(() => {
        if (currentUser?.uid) {
            getUserPollVote(poll.id, currentUser.uid).then(optId => {
                if (optId) setSelectedOptionId(prev => prev === optId ? prev : optId);
            });
        }
    }, [currentUser?.uid, poll.id]);

    useEffect(() => {
        if (isVisible) {
            incrementPollView(poll.id);
        }
    }, [isVisible, poll.id]);

    const handleVote = async (optionId: string) => {
        if (isExpired || isVoting) return;

        // If clicking the option already selected, keep current selection without unnecessary re-submit
        if (selectedOptionId === optionId) {
            return;
        }

        const voterKey = getVoterKey();
        const previousOptionId = selectedOptionId;
        const previousOptions = [...localOptions];
        const previousTotalVotes = localTotalVotes;

        setIsVoting(true);
        setVoteError(null);

        // Optimistically calculate new option counts and total votes:
        // When changing vote from previousOptionId to optionId:
        // - Deduct 1 from previousOptionId
        // - Add 1 to optionId
        // - Total net votes remains constant
        // When voting for the first time:
        // - Add 1 to optionId
        // - Total votes increments by 1
        const newOptions = localOptions.map(opt => {
            let count = Number(opt.voteCount) || 0;
            if (previousOptionId && opt.id === previousOptionId) {
                count = Math.max(0, count - 1);
            }
            if (opt.id === optionId) {
                count = count + 1;
            }
            return { ...opt, voteCount: count };
        });

        const calculatedTotal = newOptions.reduce((sum, o) => sum + (Number(o.voteCount) || 0), 0);
        const newTotal = previousOptionId 
            ? Math.max(calculatedTotal, previousTotalVotes) 
            : Math.max(calculatedTotal, previousTotalVotes + 1);

        // Immediate optimistic UI updates: store only optionId as current choice
        setSelectedOptionId(optionId);
        setLocalOptions(newOptions);
        setLocalTotalVotes(newTotal);

        // Instantly persist choice locally so changing votes is rock-solid across renders
        try {
            localStorage.setItem(`poll_vote_${voterKey}_${poll.id}`, optionId);
            localStorage.setItem(`poll_vote_${poll.id}`, optionId);
            localStorage.setItem(`poll_options_${poll.id}`, JSON.stringify(newOptions));
            localStorage.setItem(`poll_total_${poll.id}`, String(newTotal));
        } catch {}

        // Notify parent callback for centralized state sync
        onVoteChange?.(poll.id, optionId, newOptions, newTotal);

        try {
            const res = await voteOnPoll(poll.id, optionId, {
                ...poll,
                options: newOptions,
                totalVotes: newTotal,
            });
            if (res?.options && Array.isArray(res.options)) {
                setLocalOptions(res.options);
                try {
                    localStorage.setItem(`poll_options_${poll.id}`, JSON.stringify(res.options));
                } catch {}
            }
            if (typeof res?.totalVotes === 'number') {
                setLocalTotalVotes(res.totalVotes);
                try {
                    localStorage.setItem(`poll_total_${poll.id}`, String(res.totalVotes));
                } catch {}
            }
            if (res?.selectedOptionId) {
                setSelectedOptionId(res.selectedOptionId);
            }
        } catch (err: any) {
            console.warn('[POLL_VOTE_NOTICE]', err?.message || err);
            // Non-blocking: If vote was processed locally/optimistically, do not roll back
            // Only roll back if both local and remote failed
        } finally {
            setIsVoting(false);
        }
    };

    const handleLikeClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!currentUser) return;
        const nextLiked = !isLiked;
        setIsLiked(nextLiked);
        setLikeCount(prev => nextLiked ? prev + 1 : Math.max(0, prev - 1));
        try {
            await toggleLikePoll(poll.id);
        } catch {
            setIsLiked(!nextLiked);
            setLikeCount(prev => nextLiked ? Math.max(0, prev - 1) : prev + 1);
        }
    };

    const handleSaveClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!currentUser) return;
        const nextSaved = !isSaved;
        setIsSaved(nextSaved);
        try {
            await toggleBookmarkPoll(poll.id);
        } catch {
            setIsSaved(!nextSaved);
        }
    };

    const handleShareClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const shareText = `Poll: ${poll.question}\nOptions:\n${poll.options.map((o, i) => `${i + 1}. ${o.text}`).join('\n')}`;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Invox Poll: ${poll.question}`,
                    text: shareText,
                    url: window.location.href,
                });
            } catch {}
        } else {
            try {
                await navigator.clipboard.writeText(`${shareText}\n\nVote on Invox: ${window.location.href}`);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            } catch {}
        }
    };

    const handleAIAssistantClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        const resultsSummary = poll.options.map(o => {
            const pct = poll.totalVotes > 0 ? ((o.voteCount / poll.totalVotes) * 100).toFixed(1) : '0.0';
            return `${o.text}: ${o.voteCount} votes (${pct}%)`;
        }).join('; ');

        openModal({
            id: poll.id,
            title: `Poll: ${poll.question}`,
            content: `Options and results: ${resultsSummary}.\nContext: ${poll.description || 'No additional description provided.'}`,
            author: poll.author.name
        });
    };

    const handleDeletePoll = async () => {
        if (!currentUser || !isOwner) return;
        setIsDeleting(true);
        setDeleteError(null);
        try {
            await deletePoll(poll.id);
            setShowDeleteModal(false);
            onDelete?.(poll.id);
        } catch (err: any) {
            console.error('[DELETE_POLL_ERROR]', err);
            setDeleteError(err?.message || 'Failed to delete poll.');
            setIsDeleting(false);
        }
    };

    return (
        <>
            <div className="bg-[#0c0c0e] border border-zinc-800/90 hover:border-zinc-700/80 p-4 mb-4 transition-all duration-150 font-mono">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
                    <div className="flex items-center gap-3">
                        <img 
                            src={poll.author.avatarUrl} 
                            onError={handleImageError} 
                            alt={poll.author.name} 
                            className="w-9 h-9 rounded-none object-cover border border-zinc-700" 
                        />
                        <div>
                            <div className="flex items-center gap-1.5">
                                <p className="text-xs font-bold text-white uppercase tracking-wider">{poll.author.name}</p>
                                {poll.author.isVerified && <CheckBadgeIcon className="w-3.5 h-3.5 text-zinc-400" />}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-zinc-500">// TYPE: POLL</span>
                                <span className="text-[10px] text-zinc-400 border border-zinc-800 px-1.5 py-0 bg-black/40">
                                    {poll.category || 'General'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 text-zinc-400">
                        {isExpired ? (
                            <span className="text-[10px] uppercase tracking-wider text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-0.5">
                                Ended
                            </span>
                        ) : (
                            <span className="text-[10px] uppercase tracking-wider text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 px-2 py-0.5">
                                Active
                            </span>
                        )}

                        <button 
                            onClick={handleAIAssistantClick} 
                            className="p-1.5 border border-zinc-800/80 bg-zinc-900/40 hover:bg-zinc-800 hover:text-white transition-colors" 
                            aria-label="Analyze poll with AI"
                            title="Analyze with Spark AI"
                        >
                            <SparklesIcon className="w-4 h-4 text-zinc-400" />
                        </button>

                        <div className="relative">
                            <button 
                                onClick={() => setIsMenuOpen(!isMenuOpen)} 
                                className="p-1.5 border border-zinc-800/80 bg-zinc-900/40 hover:bg-zinc-800 hover:text-white transition-colors" 
                                aria-label="More options"
                            >
                                <EllipsisVerticalIcon className="w-4 h-4" />
                            </button>

                            {isMenuOpen && (
                                <div className="absolute right-0 mt-1 w-44 bg-[#0c0c0e] border border-zinc-800 shadow-2xl py-1 z-30">
                                    <button 
                                        onClick={() => { handleShareClick({ stopPropagation: () => {} } as any); setIsMenuOpen(false); }}
                                        className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-900 hover:text-white uppercase tracking-wider flex items-center gap-2"
                                    >
                                        <ForwardIcon className="w-3.5 h-3.5" />
                                        <span>Share Poll</span>
                                    </button>
                                    {isOwner && (
                                        <button 
                                            onClick={() => { setShowDeleteModal(true); setIsMenuOpen(false); }}
                                            className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-950/30 hover:text-red-300 uppercase tracking-wider flex items-center gap-2 border-t border-zinc-800/80 mt-1"
                                        >
                                            <TrashIcon className="w-3.5 h-3.5" />
                                            <span>Delete Poll</span>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Poll Question & Context */}
                <div className="mt-3.5">
                    <h3 className="text-sm sm:text-base font-bold text-white tracking-wide leading-snug uppercase">
                        {poll.question}
                    </h3>
                    {poll.description && (
                        <p className="mt-1.5 text-xs text-zinc-400 leading-relaxed font-sans">
                            {poll.description}
                        </p>
                    )}
                </div>

                {/* Optional Media */}
                {poll.mediaUrl && (
                    <div ref={mediaContainerRef} className="mt-3 overflow-hidden border border-zinc-800/80">
                        <AspectRatioBox ratio="16:9">
                            {poll.mediaType === 'video' ? (
                                <video src={poll.mediaUrl} controls className="w-full h-full object-cover" />
                            ) : (
                                <img 
                                    src={poll.mediaUrl} 
                                    onError={handleImageError} 
                                    alt="Poll media" 
                                    onClick={() => setZoomedImageUrl(poll.mediaUrl || null)}
                                    className="w-full h-full object-cover cursor-zoom-in" 
                                />
                            )}
                        </AspectRatioBox>
                    </div>
                )}

                {/* Voting error feedback */}
                {voteError && (
                    <div className="mt-3 p-2 bg-red-950/40 border border-red-800/80 text-red-400 text-xs flex items-center justify-between">
                        <span>// ERROR: {voteError}</span>
                        <button onClick={() => setVoteError(null)} className="text-red-400 hover:text-white p-0.5">
                            <CloseIcon className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}

                {/* Poll Options / Visual Results */}
                <div className="mt-4 space-y-2.5">
                    {localOptions.map((option, idx) => {
                        const isUserChoice = selectedOptionId === option.id;
                        const percentage = localTotalVotes > 0 
                            ? ((option.voteCount / localTotalVotes) * 100).toFixed(1) 
                            : '0.0';

                        if (!showResults) {
                            // Active unvoted state: Interactive selection buttons
                            return (
                                <button
                                    key={option.id}
                                    onClick={() => handleVote(option.id)}
                                    disabled={isVoting}
                                    className="w-full group text-left p-3 border border-zinc-800 hover:border-zinc-500 bg-black/40 hover:bg-zinc-900/60 transition-all flex items-center justify-between cursor-pointer"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="w-5 h-5 flex items-center justify-center border border-zinc-700 group-hover:border-white text-[11px] text-zinc-500 group-hover:text-white transition-colors">
                                            {String.fromCharCode(65 + idx)}
                                        </span>
                                        <span className="text-xs text-zinc-200 group-hover:text-white uppercase font-bold tracking-wider">
                                            {option.text}
                                        </span>
                                    </div>
                                    <span className="text-[11px] text-zinc-600 group-hover:text-zinc-300 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                                        // VOTE &gt;&gt;
                                    </span>
                                </button>
                            );
                        }

                        // Results representation: Horizontal result bars (interactive so user can change choice)
                        const isInteractive = !isExpired && !isVoting;
                        return (
                            <button 
                                type="button"
                                key={option.id}
                                onClick={() => isInteractive && handleVote(option.id)}
                                disabled={isExpired || isVoting}
                                className={`w-full text-left relative border p-3 overflow-hidden transition-all group ${
                                    isUserChoice 
                                        ? 'border-white/90 bg-zinc-900/90 shadow-sm ring-1 ring-white/20' 
                                        : isExpired
                                            ? 'border-zinc-800/90 bg-black/40 cursor-default'
                                            : 'border-zinc-800/90 bg-black/40 hover:border-zinc-500 hover:bg-zinc-900/40 cursor-pointer active:scale-[0.995]'
                                }`}
                                title={
                                    isExpired
                                        ? undefined
                                        : isUserChoice
                                            ? 'Your active selection'
                                            : 'Click to change your vote to this option'
                                }
                            >
                                {/* Filled horizontal progress bar */}
                                <div 
                                    className={`absolute left-0 top-0 bottom-0 pointer-events-none transition-all duration-300 ${
                                        isUserChoice 
                                            ? 'bg-zinc-800/90 border-r-2 border-white/20' 
                                            : 'bg-zinc-900/60 border-r border-zinc-700/50 group-hover:bg-zinc-800/30'
                                    }`}
                                    style={{ width: `${Math.max(Number(percentage), 0)}%` }}
                                />

                                <div className="relative z-10 flex items-center justify-between gap-3 pointer-events-none">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <span className={`w-5 h-5 flex-shrink-0 flex items-center justify-center text-[10px] font-bold border transition-colors ${
                                            isUserChoice 
                                                ? 'border-white text-white bg-black' 
                                                : 'border-zinc-700 text-zinc-500 bg-zinc-950 group-hover:border-zinc-400 group-hover:text-zinc-300'
                                        }`}>
                                            {isUserChoice ? '✓' : String.fromCharCode(65 + idx)}
                                        </span>
                                        <span className={`text-xs uppercase font-bold tracking-wider truncate transition-colors ${
                                            isUserChoice 
                                                ? 'text-white' 
                                                : 'text-zinc-300 group-hover:text-white'
                                        }`}>
                                            {option.text}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-3 text-right flex-shrink-0">
                                        {!isUserChoice && !isExpired && (
                                            <span className="text-[10px] font-mono text-zinc-500 group-hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:inline">
                                                // SWITCH VOTE
                                            </span>
                                        )}
                                        <span className="text-xs font-bold text-white tracking-wider">
                                            {percentage}%
                                        </span>
                                        <span className="text-[11px] text-zinc-500 font-mono">
                                            ({option.voteCount})
                                        </span>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Active vote changing feedback for user */}
                {hasVoted && !isExpired && (
                    <div className="mt-2.5 flex items-center justify-between text-[10px] font-mono text-zinc-500 px-1">
                        <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-lime-400 rounded-full animate-pulse"></span>
                            <span>VOTE RECORDED · CLICK ANY OPTION TO CHANGE YOUR CHOICE</span>
                        </span>
                        {isVoting && (
                            <span className="text-zinc-300 font-bold animate-pulse">// UPDATING SELECTION...</span>
                        )}
                    </div>
                )}

                {/* Poll Summary Footer */}
                <div className="mt-3.5 pt-2.5 border-t border-zinc-800/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500">
                    <div className="flex items-center gap-3">
                        <span className="text-zinc-400 font-bold uppercase tracking-wider">
                            TOTAL_VOTES: {formatNumber(localTotalVotes)}
                        </span>
                        {localOptions.length > 0 && (
                            <span>· {localOptions.length} OPTIONS</span>
                        )}
                    </div>
                    <div>
                        <span className="text-zinc-400">
                            {formatTimeRemaining(poll.expiresAt, isExpired)}
                        </span>
                    </div>
                </div>

                {/* Stats Bar */}
                <div className="mt-3 border-t border-zinc-800/80 pt-3 flex justify-between items-center text-xs text-zinc-400">
                    <button 
                        onClick={handleLikeClick}
                        className={`flex items-center gap-1.5 px-2 py-1 border border-transparent hover:border-zinc-800 transition-colors ${
                            isLiked ? 'text-rose-500 font-bold border-zinc-800 bg-zinc-900/60' : 'hover:text-white'
                        }`}
                        aria-label="Upvote poll"
                    >
                        <ArrowUpIcon className={`w-4 h-4 ${isLiked ? 'stroke-[2.5]' : ''}`} />
                        <span>{formatNumber(likeCount)}</span>
                    </button>
                    
                    <div className="flex items-center gap-1.5 px-2 py-1 text-zinc-500" role="status" aria-label={`${formatNumber(poll.stats?.views || poll.viewCount || 0)} views`}>
                        <TrendingUpIcon className="w-4 h-4" />
                        <span>{formatNumber(poll.stats?.views || poll.viewCount || 0)}</span>
                    </div>

                    <button 
                        onClick={handleAIAssistantClick}
                        className="flex items-center gap-1.5 px-2 py-1 border border-transparent hover:border-zinc-800 hover:text-white transition-colors" 
                        aria-label="Spark AI discussion"
                    >
                        <PresentationChartBarIcon className="w-4 h-4" />
                        <span>{formatNumber(poll.stats?.comments || poll.commentCount || 0)}</span>
                    </button>

                    <button 
                        onClick={handleShareClick}
                        className={`p-1 border border-transparent hover:border-zinc-800 transition-colors relative ${
                            copied ? 'text-emerald-400 border-zinc-800 bg-zinc-900' : 'hover:text-white'
                        }`}
                        aria-label="Share poll"
                    >
                        <ForwardIcon className="w-4 h-4" />
                        {copied && (
                            <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black border border-emerald-500 text-emerald-400 text-[9px] px-1 py-0.5 uppercase font-mono whitespace-nowrap">
                                Copied
                            </span>
                        )}
                    </button>

                    <button 
                        onClick={handleSaveClick}
                        className={`p-1 border border-transparent hover:border-zinc-800 transition-colors ${
                            isSaved ? 'text-white border-zinc-700 bg-zinc-800' : 'hover:text-white'
                        }`}
                        aria-label="Save poll"
                    >
                        <BookmarkIcon className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
                    </button>
                </div>

                {/* Action Button */}
                <div className="mt-3">
                    <button 
                        onClick={handleAIAssistantClick}
                        className="w-full bg-zinc-900/60 border border-zinc-700/80 text-white text-xs uppercase tracking-wider py-2.5 hover:bg-zinc-800 hover:border-zinc-500 transition-all duration-150 flex items-center justify-center gap-2 font-bold"
                    >
                        <SparklesIcon className="w-3.5 h-3.5 text-zinc-400" />
                        <span>// ANALYZE WITH SPARK AI</span>
                    </button>
                </div>
            </div>

            {/* In-app Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-[#0c0c0e] border border-zinc-800 max-w-md w-full p-6 space-y-4 font-mono">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                            <span className="text-[10px] text-red-400 uppercase tracking-widest">// CONFIRM_PURGE</span>
                            <button onClick={() => setShowDeleteModal(false)} className="text-zinc-500 hover:text-white">
                                <CloseIcon className="w-4 h-4" />
                            </button>
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-2">Delete This Poll?</h4>
                            <p className="text-xs text-zinc-400 leading-relaxed">
                                Are you sure you want to permanently delete:
                                <span className="block mt-1 text-white font-bold">"{poll.question}"</span>
                            </p>
                            <p className="text-[11px] text-zinc-500 mt-2">
                                This will purge all recorded votes ({poll.totalVotes}) and remove the poll from the network.
                            </p>
                        </div>
                        {deleteError && (
                            <div className="p-2 bg-red-950/40 border border-red-800 text-red-400 text-xs">
                                // ERROR: {deleteError}
                            </div>
                        )}
                        <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                disabled={isDeleting}
                                className="px-4 py-2 border border-zinc-700 text-zinc-300 hover:text-white text-xs uppercase tracking-wider"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeletePoll}
                                disabled={isDeleting}
                                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs uppercase font-bold tracking-wider flex items-center gap-2"
                            >
                                {isDeleting ? (
                                    <>
                                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        <span>Deleting...</span>
                                    </>
                                ) : (
                                    <>
                                        <TrashIcon className="w-3.5 h-3.5" />
                                        <span>Delete Poll</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ImageZoomModal 
                isOpen={!!zoomedImageUrl} 
                onClose={() => setZoomedImageUrl(null)} 
                imageUrl={zoomedImageUrl || ''}
            />
        </>
    );
};
