import React, { useState, useRef, useEffect, useMemo } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import type { Post } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { 
    HeartIcon, 
    TrendingUpIcon, 
    ChatBubbleBottomCenterTextIcon, 
    ForwardIcon, 
    BookmarkIcon, 
    CheckBadgeIcon, 
    PlayIcon, 
    PauseIcon, 
    VolumeUpIcon, 
    VolumeOffIcon, 
    ArrowsPointingOutIcon, 
    ArrowsPointingInIcon,
    EllipsisVerticalIcon,
    UsersIcon,
    PlusIcon,
    CheckIcon
} from '../ui/Icons';
import { handleImageError } from '../utils/imageUtils';
import { useFullscreen } from '../hooks/useFullscreen';
import { ImageZoomModal } from '../ui/ImageZoomModal';
import { CommentSection } from '../feed/CommentSection';
import { toggleLikePost, toggleBookmarkPost, incrementPostView } from '../../services/postService';

const formatNumber = (num: number): string => {
    if (!num || isNaN(num)) return '0';
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toString();
};

const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const formatTimestamp = (dateInput: any): string => {
    if (!dateInput) return 'Recently';
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) return 'Recently';
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

interface CommunityFeedCardProps {
    post: Post;
    onPostUpdated?: (updated: Post) => void;
    onOpenCommunity?: (communityId: string) => void;
    initialLiked?: boolean;
    initialSaved?: boolean;
    isMember?: boolean;
    onToggleMembership?: (community: { id: string; name: string; category?: string; avatarUrl?: string }) => void;
    isMembershipLoading?: boolean;
    showMembershipAction?: boolean;
}

export const CommunityFeedCard: React.FC<CommunityFeedCardProps> = ({
    post,
    onPostUpdated,
    onOpenCommunity,
    initialLiked = false,
    initialSaved = false,
    isMember = false,
    onToggleMembership,
    isMembershipLoading = false,
    showMembershipAction = false,
}) => {
    const { currentUser } = useAuth();
    const navigate = ReactRouterDOM.useNavigate();

    // Content expansion state
    const [isExpanded, setIsExpanded] = useState(false);
    const CONTENT_TRUNCATE_LENGTH = 280;
    const isLongContent = (post.content || '').length > CONTENT_TRUNCATE_LENGTH;

    // Interaction states
    const [isLiked, setIsLiked] = useState(initialLiked || Boolean(post.userLiked));
    const baseLikes = Number(post.stats?.likes ?? post.likeCount ?? 0);
    const [likeCount, setLikeCount] = useState(baseLikes);

    const [isSaved, setIsSaved] = useState(initialSaved || Boolean(post.userSaved));
    const [commentsCount, setCommentsCount] = useState(Number(post.stats?.comments ?? post.commentCount ?? 0));
    const [isCommentsOpen, setIsCommentsOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Media states
    const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const videoContainerRef = useRef<HTMLDivElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isControlsVisible, setIsControlsVisible] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    const { isFullscreen, toggleFullscreen } = useFullscreen(videoContainerRef);

    // Normalize media attachments
    const mediaUrls: string[] = useMemo(() => {
        if (Array.isArray(post.mediaUrls) && post.mediaUrls.length > 0) {
            return post.mediaUrls;
        }
        if (post.mediaUrl) {
            return [post.mediaUrl];
        }
        return [];
    }, [post.mediaUrls, post.mediaUrl]);

    const isVideo = post.mediaType === 'video' || (mediaUrls.length === 1 && (mediaUrls[0].includes('.mp4') || mediaUrls[0].includes('.webm')));

    // Increment view once on mount
    useEffect(() => {
        if (post.id) {
            incrementPostView(post.id);
        }
    }, [post.id]);

    // Handle outside clicks for context menu
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Like handler with optimistic updates
    const handleLikeClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!currentUser) {
            navigate('/login');
            return;
        }

        const nextLiked = !isLiked;
        setIsLiked(nextLiked);
        setLikeCount(prev => nextLiked ? prev + 1 : Math.max(0, prev - 1));

        try {
            await toggleLikePost(post.id);
            if (onPostUpdated) {
                onPostUpdated({
                    ...post,
                    userLiked: nextLiked,
                    likeCount: nextLiked ? likeCount + 1 : Math.max(0, likeCount - 1),
                    stats: {
                        ...post.stats,
                        likes: nextLiked ? likeCount + 1 : Math.max(0, likeCount - 1),
                    }
                });
            }
        } catch (err) {
            console.error('[COMMUNITY_POST_LIKE_ERR]', err);
            // Revert on error
            setIsLiked(!nextLiked);
            setLikeCount(prev => nextLiked ? Math.max(0, prev - 1) : prev + 1);
        }
    };

    // Bookmark handler with optimistic updates
    const handleSaveClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!currentUser) {
            navigate('/login');
            return;
        }

        const nextSaved = !isSaved;
        setIsSaved(nextSaved);

        try {
            await toggleBookmarkPost(post.id);
            if (onPostUpdated) {
                onPostUpdated({
                    ...post,
                    userSaved: nextSaved,
                });
            }
        } catch (err) {
            console.error('[COMMUNITY_POST_SAVE_ERR]', err);
            setIsSaved(!nextSaved);
        }
    };

    // Share link handler
    const handleShareClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        const origin = window.location.origin;
        const targetUrl = post.communityId 
            ? `${origin}/communities/${post.communityId}?post=${post.id}`
            : `${origin}/communities?post=${post.id}`;

        if (navigator.clipboard) {
            navigator.clipboard.writeText(targetUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2200);
        }
    };

    // Video controls
    const togglePlayPause = (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (!videoRef.current) return;
        if (isPlaying) {
            videoRef.current.pause();
        } else {
            videoRef.current.play().catch(console.warn);
        }
    };

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
        const time = parseFloat(e.target.value);
        setProgress(time);
        if (videoRef.current) {
            videoRef.current.currentTime = time;
        }
    };

    const toggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!videoRef.current) return;
        const nextMuted = !isMuted;
        setIsMuted(nextMuted);
        videoRef.current.muted = nextMuted;
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.stopPropagation();
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
        if (videoRef.current) {
            videoRef.current.volume = newVolume;
            if (newVolume === 0) {
                setIsMuted(true);
                videoRef.current.muted = true;
            } else if (isMuted) {
                setIsMuted(false);
                videoRef.current.muted = false;
            }
        }
    };

    const cyclePlaybackRate = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!videoRef.current) return;
        const rates = [1, 1.25, 1.5, 2];
        const nextRate = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
        setPlaybackRate(nextRate);
        videoRef.current.playbackRate = nextRate;
    };

    const authorProfileKey = post.author?.username || post.authorId || post.author?.id;
    const domainCategory = post.category || post.domain || 'General';

    return (
        <article className="bg-[#0c0c0e] border border-zinc-800 hover:border-zinc-700 p-4 sm:p-5 transition-all space-y-4 font-mono shadow-sm">
            {/* Header: Author & Community Identity */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-zinc-850">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                    {/* Author Avatar */}
                    <button
                        type="button"
                        onClick={() => {
                            if (authorProfileKey) navigate(`/profile/${authorProfileKey}`);
                        }}
                        className="cursor-pointer flex-shrink-0 group focus:outline-none"
                        title={post.author?.name}
                    >
                        <img
                            src={post.author?.avatarUrl || `https://picsum.photos/seed/${authorProfileKey || 'author'}/200`}
                            alt={post.author?.name || 'Author'}
                            onError={handleImageError}
                            className="w-10 h-10 object-cover border border-zinc-800 group-hover:border-zinc-500 bg-zinc-950 transition-colors"
                        />
                    </button>

                    <div className="min-w-0 flex-1 space-y-1">
                        {/* Author Identity Line */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                                type="button"
                                onClick={() => {
                                    if (authorProfileKey) navigate(`/profile/${authorProfileKey}`);
                                }}
                                className="font-bold text-white text-xs uppercase tracking-wider hover:text-emerald-400 transition-colors truncate focus:outline-none cursor-pointer"
                            >
                                {post.author?.name || 'Invox Member'}
                            </button>
                            {post.author?.isVerified && (
                                <CheckBadgeIcon className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                            )}
                            {post.author?.username && (
                                <span className="text-[10px] text-zinc-500 font-mono">
                                    @{post.author.username.replace(/^@/, '')}
                                </span>
                            )}
                        </div>

                        {/* Originating Collective Badge */}
                        <div className="flex items-center gap-2 flex-wrap text-[10px]">
                            {post.communityName ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (post.communityId) {
                                            if (onOpenCommunity) onOpenCommunity(post.communityId);
                                            else navigate(`/communities/${post.communityId}`);
                                        }
                                    }}
                                    className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors cursor-pointer group/comm focus:outline-none"
                                >
                                    {post.communityAvatarUrl ? (
                                        <img
                                            src={post.communityAvatarUrl}
                                            alt={post.communityName}
                                            onError={handleImageError}
                                            className="w-3.5 h-3.5 object-cover border border-zinc-800 flex-shrink-0"
                                        />
                                    ) : (
                                        <UsersIcon className="w-3 h-3 text-zinc-500 flex-shrink-0" />
                                    )}
                                    <span className="font-mono uppercase font-bold text-emerald-400/90 group-hover/comm:text-emerald-300">
                                        // {post.communityName}
                                    </span>
                                </button>
                            ) : null}

                            {/* Domain Category Pill */}
                            <span className="px-1.5 py-0.2 text-[9px] uppercase tracking-wider bg-zinc-900 border border-zinc-800 text-zinc-400">
                                {domainCategory}
                            </span>

                            {/* Membership indicator / Join action */}
                            {showMembershipAction && post.communityId && (
                                isMember ? (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.2 text-[9px] font-mono font-bold uppercase tracking-wider bg-emerald-950/60 border border-emerald-500/40 text-emerald-400">
                                        <CheckIcon className="w-2.5 h-2.5" />
                                        <span>JOINED</span>
                                    </span>
                                ) : (
                                    <button
                                        type="button"
                                        disabled={isMembershipLoading}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (!currentUser) {
                                                navigate('/login');
                                                return;
                                            }
                                            if (onToggleMembership && post.communityId) {
                                                onToggleMembership({
                                                    id: post.communityId,
                                                    name: post.communityName || 'Community',
                                                    category: domainCategory,
                                                    avatarUrl: post.communityAvatarUrl
                                                });
                                            }
                                        }}
                                        className="inline-flex items-center gap-1 px-1.5 py-0.2 text-[9px] font-mono font-bold uppercase tracking-wider bg-white text-black hover:bg-zinc-200 border border-white transition-colors cursor-pointer disabled:opacity-50"
                                        title="Join this community to access member-only channels"
                                    >
                                        {isMembershipLoading ? (
                                            <span>JOINING...</span>
                                        ) : (
                                            <>
                                                <PlusIcon className="w-2.5 h-2.5 stroke-[3]" />
                                                <span>JOIN</span>
                                            </>
                                        )}
                                    </button>
                                )
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Header: Timestamp & Menu */}
                <div className="flex items-center gap-2 flex-shrink-0 text-zinc-500 text-[10px] font-mono">
                    <span className="whitespace-nowrap">
                        {formatTimestamp(post.createdAt)}
                    </span>

                    <div className="relative" ref={menuRef}>
                        <button
                            type="button"
                            onClick={() => setIsMenuOpen(prev => !prev)}
                            className="p-1 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white transition-colors focus:outline-none"
                            aria-label="More options"
                        >
                            <EllipsisVerticalIcon className="w-3.5 h-3.5" />
                        </button>

                        {isMenuOpen && (
                            <div className="absolute right-0 mt-1 w-44 bg-[#0c0c0e] border border-zinc-800 shadow-2xl py-1 z-30 font-mono text-xs animate-in fade-in zoom-in-95 duration-100">
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        handleShareClick(e);
                                        setIsMenuOpen(false);
                                    }}
                                    className="w-full text-left px-3 py-2 text-zinc-300 hover:bg-zinc-900 hover:text-white uppercase tracking-wider flex items-center gap-2 cursor-pointer"
                                >
                                    <ForwardIcon className="w-3.5 h-3.5 text-zinc-400" />
                                    <span>{copied ? 'Link Copied!' : 'Copy Link'}</span>
                                </button>
                                {post.communityId && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsMenuOpen(false);
                                            if (onOpenCommunity) onOpenCommunity(post.communityId!);
                                            else navigate(`/communities/${post.communityId}`);
                                        }}
                                        className="w-full text-left px-3 py-2 text-zinc-300 hover:bg-zinc-900 hover:text-white uppercase tracking-wider flex items-center gap-2 border-t border-zinc-800/80 cursor-pointer"
                                    >
                                        <UsersIcon className="w-3.5 h-3.5 text-zinc-400" />
                                        <span>View Collective</span>
                                    </button>
                                )}
                                {post.communityId && showMembershipAction && !isMember && (
                                    <button
                                        type="button"
                                        disabled={isMembershipLoading}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsMenuOpen(false);
                                            if (!currentUser) {
                                                navigate('/login');
                                                return;
                                            }
                                            if (onToggleMembership && post.communityId) {
                                                onToggleMembership({
                                                    id: post.communityId,
                                                    name: post.communityName || 'Community',
                                                    category: domainCategory,
                                                    avatarUrl: post.communityAvatarUrl
                                                });
                                            }
                                        }}
                                        className="w-full text-left px-3 py-2 text-emerald-400 hover:bg-zinc-900 uppercase tracking-wider flex items-center gap-2 border-t border-zinc-800/80 cursor-pointer disabled:opacity-50"
                                    >
                                        <PlusIcon className="w-3.5 h-3.5" />
                                        <span>Join Collective</span>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Post Content */}
            <div className="space-y-2.5">
                {post.title && (
                    <h2 className="text-sm sm:text-base font-bold text-white uppercase tracking-wide leading-snug font-mono">
                        {post.title}
                    </h2>
                )}

                <div className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-sans whitespace-pre-line">
                    {isLongContent && !isExpanded ? (
                        <>
                            {post.content.slice(0, CONTENT_TRUNCATE_LENGTH).trim()}...{' '}
                            <button
                                type="button"
                                onClick={() => setIsExpanded(true)}
                                className="font-mono text-xs uppercase font-bold text-emerald-400 hover:text-emerald-300 transition-colors ml-1 cursor-pointer focus:outline-none"
                            >
                                [SHOW MORE]
                            </button>
                        </>
                    ) : (
                        <>
                            {post.content}
                            {isLongContent && (
                                <button
                                    type="button"
                                    onClick={() => setIsExpanded(false)}
                                    className="font-mono text-xs uppercase font-bold text-zinc-500 hover:text-zinc-300 transition-colors ml-2 cursor-pointer focus:outline-none"
                                >
                                    [SHOW LESS]
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Media Attachments Section */}
            {mediaUrls.length > 0 && (
                <div className="pt-1">
                    {isVideo ? (
                        /* Video Player Layout */
                        <div
                            ref={videoContainerRef}
                            className="relative border border-zinc-800 bg-black overflow-hidden group/video select-none"
                            onMouseEnter={() => setIsControlsVisible(true)}
                            onMouseLeave={() => setIsControlsVisible(false)}
                        >
                            <video
                                ref={videoRef}
                                src={mediaUrls[0]}
                                poster={post.thumbnailUrl}
                                onTimeUpdate={handleTimeUpdate}
                                onLoadedMetadata={handleLoadedMetadata}
                                onPlay={() => setIsPlaying(true)}
                                onPause={() => setIsPlaying(false)}
                                onEnded={() => setIsPlaying(false)}
                                playsInline
                                preload="metadata"
                                className="w-full max-h-[460px] object-contain bg-black cursor-pointer"
                                onClick={togglePlayPause}
                            />

                            {/* Center Big Play Button when paused */}
                            {!isPlaying && (
                                <div
                                    onClick={togglePlayPause}
                                    className="absolute inset-0 flex items-center justify-center bg-black/40 cursor-pointer backdrop-blur-[1px] transition-opacity"
                                >
                                    <div className="w-14 h-14 bg-black/80 border border-white/30 hover:border-emerald-400 flex items-center justify-center transition-all group-hover/video:scale-105">
                                        <PlayIcon className="w-6 h-6 text-white ml-0.5" />
                                    </div>
                                </div>
                            )}

                            {/* Bottom Controls Bar */}
                            <div
                                className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-2.5 transition-opacity duration-200 ${
                                    isControlsVisible || !isPlaying ? 'opacity-100' : 'opacity-0'
                                }`}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Scrubber Timeline */}
                                <div className="w-full mb-2">
                                    <input
                                        type="range"
                                        min="0"
                                        max={duration || 0}
                                        step="0.1"
                                        value={progress}
                                        onChange={handleSeek}
                                        className="w-full h-1 bg-zinc-700 appearance-none cursor-pointer accent-emerald-400"
                                    />
                                </div>

                                <div className="flex items-center justify-between gap-3 text-white text-xs">
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={togglePlayPause}
                                            className="p-1 border border-zinc-700 bg-black/60 hover:bg-zinc-800 transition-colors"
                                            aria-label={isPlaying ? 'Pause' : 'Play'}
                                        >
                                            {isPlaying ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />}
                                        </button>

                                        {/* Volume & Mute */}
                                        <div className="flex items-center gap-1 group/volume">
                                            <button
                                                type="button"
                                                onClick={toggleMute}
                                                className="p-1 border border-zinc-700 bg-black/60 hover:bg-zinc-800 transition-colors"
                                                aria-label={isMuted ? 'Unmute' : 'Mute'}
                                            >
                                                {isMuted || volume === 0 ? (
                                                    <VolumeOffIcon className="w-4 h-4 text-rose-400" />
                                                ) : (
                                                    <VolumeUpIcon className="w-4 h-4 text-white" />
                                                )}
                                            </button>
                                            <input
                                                type="range"
                                                min="0"
                                                max="1"
                                                step="0.05"
                                                value={isMuted ? 0 : volume}
                                                onChange={handleVolumeChange}
                                                className="w-0 h-1 bg-zinc-700 appearance-none cursor-pointer accent-emerald-400 transition-all duration-200 opacity-0 group-hover/volume:opacity-100 group-hover/volume:w-16"
                                            />
                                        </div>
                                    </div>

                                    {/* Duration, Speed & Fullscreen */}
                                    <div className="flex items-center gap-2 font-mono text-[11px]">
                                        <span className="text-zinc-300">
                                            [{formatTime(progress)} / {formatTime(duration)}]
                                        </span>
                                        <button
                                            type="button"
                                            onClick={cyclePlaybackRate}
                                            className="px-1.5 py-0.5 border border-zinc-700 bg-black/60 hover:bg-zinc-800 text-[10px] font-bold"
                                        >
                                            {playbackRate}x
                                        </button>
                                        <button
                                            type="button"
                                            onClick={toggleFullscreen}
                                            className="p-1 border border-zinc-700 bg-black/60 hover:bg-zinc-800 transition-colors"
                                            aria-label="Toggle Fullscreen"
                                        >
                                            {isFullscreen ? (
                                                <ArrowsPointingInIcon className="w-4 h-4" />
                                            ) : (
                                                <ArrowsPointingOutIcon className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : mediaUrls.length === 1 ? (
                        /* Single Image Layout */
                        <div
                            onClick={() => setZoomedImageUrl(mediaUrls[0])}
                            className="border border-zinc-800 bg-black overflow-hidden relative cursor-zoom-in group max-h-[460px] flex items-center justify-center"
                        >
                            <img
                                src={mediaUrls[0]}
                                alt={post.title || 'Community post attachment'}
                                onError={handleImageError}
                                className="w-full max-h-[460px] object-contain group-hover:scale-[1.01] transition-transform duration-200"
                            />
                            <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/70 border border-zinc-700 text-zinc-300 text-[9px] font-mono opacity-0 group-hover:opacity-100 transition-opacity uppercase">
                                Zoom
                            </div>
                        </div>
                    ) : (
                        /* Multiple Images Gallery Grid */
                        <div className={`grid gap-1.5 border border-zinc-800 bg-black p-1.5 ${
                            mediaUrls.length === 2 ? 'grid-cols-2' : mediaUrls.length === 3 ? 'grid-cols-3' : 'grid-cols-2'
                        }`}>
                            {mediaUrls.slice(0, 4).map((url, idx) => {
                                const isFourthItem = idx === 3;
                                const remainingCount = mediaUrls.length - 4;
                                return (
                                    <div
                                        key={idx}
                                        onClick={() => setZoomedImageUrl(url)}
                                        className="relative aspect-video sm:aspect-square bg-zinc-950 overflow-hidden cursor-zoom-in group border border-zinc-800/80"
                                    >
                                        <img
                                            src={url}
                                            alt={`Attachment ${idx + 1}`}
                                            onError={handleImageError}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                        />
                                        {isFourthItem && remainingCount > 0 && (
                                            <div className="absolute inset-0 bg-black/75 flex items-center justify-center text-white font-mono font-bold text-xs">
                                                +{remainingCount} MORE
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Topic Tags */}
            {post.tags && post.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                    {post.tags.map((tag, idx) => (
                        <span
                            key={idx}
                            className="text-[10px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-0.5 uppercase tracking-wider"
                        >
                            #{tag.replace(/^#/, '')}
                        </span>
                    ))}
                </div>
            )}

            {/* Full-Width Engagement Toolbar */}
            <div className="pt-3 border-t border-zinc-800/80 w-full grid grid-cols-5 gap-1 font-mono text-xs text-zinc-400">
                {/* 1. Like / Upvote */}
                <button
                    type="button"
                    onClick={handleLikeClick}
                    className={`w-full flex items-center justify-center gap-1 sm:gap-1.5 py-2 px-1 text-xs font-mono border transition-all cursor-pointer focus:outline-none ${
                        isLiked
                            ? 'text-rose-400 font-bold border-rose-900/40 bg-rose-950/20'
                            : 'border-transparent hover:border-zinc-800 hover:text-white hover:bg-zinc-900/40'
                    }`}
                    title={isLiked ? 'Unlike' : 'Like'}
                >
                    <HeartIcon className={`w-4 h-4 flex-shrink-0 ${isLiked ? 'fill-current' : ''}`} />
                    <span className="truncate">{formatNumber(likeCount)}</span>
                </button>

                {/* 2. Comments */}
                <button
                    type="button"
                    onClick={() => setIsCommentsOpen(prev => !prev)}
                    className={`w-full flex items-center justify-center gap-1 sm:gap-1.5 py-2 px-1 text-xs font-mono border transition-all cursor-pointer focus:outline-none ${
                        isCommentsOpen
                            ? 'text-white border-zinc-700 bg-zinc-900 font-bold'
                            : 'border-transparent hover:border-zinc-800 hover:text-white hover:bg-zinc-900/40'
                    }`}
                    title={isCommentsOpen ? 'Hide Discussion' : 'View Discussion'}
                >
                    <ChatBubbleBottomCenterTextIcon className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{formatNumber(commentsCount)}</span>
                </button>

                {/* 3. Views */}
                <div
                    className="w-full flex items-center justify-center gap-1 sm:gap-1.5 py-2 px-1 text-xs font-mono text-zinc-500 border border-transparent select-none"
                    title="Total Views"
                >
                    <TrendingUpIcon className="w-4 h-4 flex-shrink-0 text-zinc-500" />
                    <span className="truncate">{formatNumber(post.stats?.views || post.viewCount || 0)}</span>
                </div>

                {/* 4. Share */}
                <button
                    type="button"
                    onClick={handleShareClick}
                    className={`w-full flex items-center justify-center gap-1 sm:gap-1.5 py-2 px-1 text-xs font-mono border transition-all relative cursor-pointer focus:outline-none ${
                        copied
                            ? 'text-emerald-400 border-emerald-500/40 bg-emerald-950/20 font-bold'
                            : 'border-transparent hover:border-zinc-800 hover:text-white hover:bg-zinc-900/40'
                    }`}
                    title="Share Post Link"
                >
                    <ForwardIcon className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{copied ? 'COPIED' : 'SHARE'}</span>
                    {copied && (
                        <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-black border border-emerald-500 text-emerald-400 text-[9px] px-1.5 py-0.5 uppercase font-mono whitespace-nowrap shadow-lg z-20">
                            Copied!
                        </span>
                    )}
                </button>

                {/* 5. Bookmark */}
                <button
                    type="button"
                    onClick={handleSaveClick}
                    className={`w-full flex items-center justify-center gap-1 sm:gap-1.5 py-2 px-1 text-xs font-mono border transition-all cursor-pointer focus:outline-none ${
                        isSaved
                            ? 'text-emerald-400 border-emerald-500/40 bg-emerald-950/20 font-bold'
                            : 'border-transparent hover:border-zinc-800 hover:text-white hover:bg-zinc-900/40'
                    }`}
                    title={isSaved ? 'Remove Bookmark' : 'Save Post'}
                >
                    <BookmarkIcon className={`w-4 h-4 flex-shrink-0 ${isSaved ? 'fill-current' : ''}`} />
                    <span className="truncate">{isSaved ? 'SAVED' : 'SAVE'}</span>
                </button>
            </div>

            {/* Inline Comment Section */}
            {isCommentsOpen && (
                <CommentSection
                    post={post}
                    isOpen={isCommentsOpen}
                    onClose={() => setIsCommentsOpen(false)}
                    onCommentAdded={() => {
                        setCommentsCount(c => c + 1);
                        if (onPostUpdated) {
                            onPostUpdated({
                                ...post,
                                commentCount: commentsCount + 1,
                                stats: {
                                    ...post.stats,
                                    comments: commentsCount + 1,
                                }
                            });
                        }
                    }}
                />
            )}

            {/* Image Zoom Modal */}
            <ImageZoomModal
                isOpen={Boolean(zoomedImageUrl)}
                onClose={() => setZoomedImageUrl(null)}
                imageUrl={zoomedImageUrl || ''}
            />
        </article>
    );
};

export default CommunityFeedCard;
