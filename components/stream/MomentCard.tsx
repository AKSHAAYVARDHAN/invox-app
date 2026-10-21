import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { StreamMoment, Post } from '../../types';
import { PostType } from '../../types';
import { 
    HeartIcon, 
    TrendingUpIcon, 
    ChatBubbleBottomCenterTextIcon, 
    ForwardIcon, 
    BookmarkIcon, 
    EllipsisVerticalIcon,
    CheckBadgeIcon,
    PlayIcon,
    PauseIcon,
    VolumeUpIcon,
    VolumeOffIcon,
    ArrowsPointingOutIcon,
    ArrowsPointingInIcon,
    ChevronLeftIcon,
    ChevronRightIcon
} from '../ui/Icons';
import { handleImageError } from '../utils/imageUtils';
import { useFullscreen } from '../hooks/useFullscreen';
import { useLazyLoad } from '../hooks/useLazyLoad';
import AspectRatioBox from '../ui/AspectRatioBox';
import ImageZoomModal from '../ui/ImageZoomModal';
import { toggleLikePost, toggleBookmarkPost, incrementPostView } from '../../services/postService';
import { CommentSection } from '../feed/CommentSection';
import { formatRelativeTime } from '../../utils/dateUtils';
import { useAuth } from '../../contexts/AuthContext';

const formatNumber = (num: number) => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num;
};

const MediaPlaceholder: React.FC<{ thumbnailUrl?: string; isVideo: boolean }> = ({ thumbnailUrl, isVideo }) => {
    if (isVideo && thumbnailUrl) {
        return (
            <>
                <img src={thumbnailUrl} onError={handleImageError} alt="Video poster" className="w-full h-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                     <div className="w-20 h-20 bg-black/50 rounded-full flex items-center justify-center backdrop-blur-sm">
                        <PlayIcon className="w-10 h-10 text-white" />
                    </div>
                </div>
            </>
        );
    }
    return <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-700 font-mono text-xs">// MEDIA_UNAVAILABLE</div>;
};

interface MomentCardProps {
    moment: StreamMoment;
    userLiked?: boolean;
    userSaved?: boolean;
}

const MomentCard: React.FC<MomentCardProps> = ({ moment, userLiked = false, userSaved = false }) => {
    const { currentUser } = useAuth();

    // Media list & active index
    const mediaList = useMemo(() => {
        if (Array.isArray(moment.mediaUrls) && moment.mediaUrls.length > 0) {
            return moment.mediaUrls;
        }
        if (moment.mediaUrl) {
            return [moment.mediaUrl];
        }
        return [];
    }, [moment.mediaUrls, moment.mediaUrl]);

    const [activeMediaIndex, setActiveMediaIndex] = useState(0);
    const currentMediaUrl = mediaList[activeMediaIndex] || moment.mediaUrl || '';
    const isCurrentVideo = Boolean(
        moment.mediaType === 'video' ||
        moment.type === 'video' ||
        (currentMediaUrl && currentMediaUrl.match(/\.(mp4|webm|mov|m4v)/i))
    );

    const videoRef = useRef<HTMLVideoElement>(null);
    const videoContainerRef = useRef<HTMLDivElement>(null);

    // Engagement state
    const [isLiked, setIsLiked] = useState<boolean>(Boolean(userLiked || moment.userLiked));
    const [likesCount, setLikesCount] = useState<number>(Number(moment.stats?.likes ?? moment.likes ?? 0));
    const [isSaved, setIsSaved] = useState<boolean>(Boolean(userSaved || moment.userSaved));
    const [viewsCount, setViewsCount] = useState<number>(Number(moment.stats?.views ?? moment.views ?? 0));
    const [commentsCount, setCommentsCount] = useState<number>(Number(moment.stats?.comments ?? moment.comments ?? 0));
    const [showComments, setShowComments] = useState<boolean>(false);
    const [shareFeedback, setShareFeedback] = useState<string | null>(null);

    // Sync props with state
    useEffect(() => {
        setIsLiked(Boolean(userLiked || moment.userLiked));
    }, [userLiked, moment.userLiked]);

    useEffect(() => {
        setIsSaved(Boolean(userSaved || moment.userSaved));
    }, [userSaved, moment.userSaved]);

    // View tracking deduplication
    useEffect(() => {
        if (!moment.id) return;
        incrementPostView(moment.id).then(counted => {
            if (counted) {
                setViewsCount(prev => prev + 1);
            }
        });
    }, [moment.id]);

    const [showMore, setShowMore] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isControlsVisible, setIsControlsVisible] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    const playbackRates = [0.75, 1, 1.25, 1.5];
    const { isFullscreen, toggleFullscreen } = useFullscreen(videoContainerRef);
    const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);
    const [mediaContainerRef, isVisible] = useLazyLoad<HTMLDivElement>();
    
    const captionText = moment.caption || moment.content || '';
    const isLongContent = captionText.length > 150;

    const togglePlayPause = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (videoRef.current) {
            if (videoRef.current.paused) {
                videoRef.current.play();
            } else {
                videoRef.current.pause();
            }
        }
    };
    
    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.playbackRate = playbackRate;
        }
    }, [playbackRate]);

    // Reset video state when switching slides
    useEffect(() => {
        setIsPlaying(false);
        setProgress(0);
    }, [activeMediaIndex]);

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
        if (videoRef.current) {
            videoRef.current.currentTime = Number(e.target.value);
            setProgress(Number(e.target.value));
        }
    };
    
    const handleProgressPointerDown = (e: React.PointerEvent<HTMLInputElement>) => {
        e.stopPropagation();
        if (videoRef.current) {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const width = rect.width;
            const videoDuration = videoRef.current.duration;
            if (videoDuration > 0) {
                const seekTime = (clickX / width) * videoDuration;
                videoRef.current.currentTime = seekTime;
                setProgress(seekTime);
            }
        }
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = Number(e.target.value);
        if (videoRef.current) {
            videoRef.current.muted = false;
            setIsMuted(false);
            videoRef.current.volume = newVolume;
            setVolume(newVolume);
            if (newVolume === 0) {
                setIsMuted(true);
            }
        }
    };
    
    const toggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (videoRef.current) {
            const newMutedState = !videoRef.current.muted;
            videoRef.current.muted = newMutedState;
            setIsMuted(newMutedState);
            if (!newMutedState && volume === 0) {
                setVolume(1);
                videoRef.current.volume = 1;
            }
        }
    };

    const formatTime = (timeInSeconds: number) => {
        if (isNaN(timeInSeconds) || timeInSeconds <= 0) return '00:00';
        const minutes = Math.floor(timeInSeconds / 60);
        const seconds = Math.floor(timeInSeconds % 60);
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    const toggleFullScreen = (e: React.MouseEvent) => {
        e.stopPropagation();
        toggleFullscreen();
    };

    const cyclePlaybackRate = (e: React.MouseEvent) => {
        e.stopPropagation();
        const currentIndex = playbackRates.indexOf(playbackRate);
        const nextIndex = (currentIndex + 1) % playbackRates.length;
        setPlaybackRate(playbackRates[nextIndex]);
    };

    // Like Action Handler
    const handleLike = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!currentUser) return;
        const previousState = isLiked;
        const previousCount = likesCount;

        setIsLiked(!previousState);
        setLikesCount(previousState ? Math.max(0, previousCount - 1) : previousCount + 1);

        try {
            await toggleLikePost(moment.id);
        } catch (err) {
            console.error('Failed to toggle like:', err);
            setIsLiked(previousState);
            setLikesCount(previousCount);
        }
    };

    // Bookmark Action Handler
    const handleBookmark = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!currentUser) return;
        const previousState = isSaved;
        setIsSaved(!previousState);

        try {
            await toggleBookmarkPost(moment.id);
        } catch (err) {
            console.error('Failed to toggle bookmark:', err);
            setIsSaved(previousState);
        }
    };

    // Share Handler
    const handleShare = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const shareUrl = `${window.location.origin}/hub?tab=stream&moment=${moment.id}`;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `INVOX Moment: ${moment.author.name}`,
                    text: moment.caption || moment.aiSummary || 'Check out this moment on INVOX',
                    url: shareUrl,
                });
                return;
            } catch {
                // fall through to clipboard
            }
        }
        try {
            await navigator.clipboard.writeText(shareUrl);
            setShareFeedback('COPIED LINK');
            setTimeout(() => setShareFeedback(null), 2000);
        } catch {
            setShareFeedback('FAILED TO COPY');
            setTimeout(() => setShareFeedback(null), 2000);
        }
    };

    // Construct Post object for CommentSection
    const postForComment: Post = useMemo(() => ({
        id: moment.id,
        authorId: moment.authorId || moment.author.uid,
        author: {
            name: moment.author.name,
            avatarUrl: moment.author.avatarUrl || moment.author.avatar || `https://picsum.photos/seed/${moment.authorId || moment.id}/200`,
            username: moment.author.username || moment.author.handle?.replace(/^@/, ''),
            isVerified: moment.author.isVerified,
            id: moment.authorId || moment.author.uid,
            uid: moment.authorId || moment.author.uid,
        },
        title: moment.caption?.slice(0, 50) || 'Moment',
        oneLine: moment.aiSummary || '',
        content: captionText,
        mediaUrl: currentMediaUrl,
        mediaType: isCurrentVideo ? 'video' : 'image',
        stats: {
            likes: likesCount,
            views: viewsCount,
            comments: commentsCount,
        },
        likeCount: likesCount,
        viewCount: viewsCount,
        commentCount: commentsCount,
        type: PostType.Moment,
        postType: PostType.Moment,
        category: moment.category || 'Stills',
        domain: moment.domain || moment.category || 'General',
        tags: [],
        visibility: 'public',
        createdAt: moment.createdAt || new Date(),
    }), [moment, likesCount, viewsCount, commentsCount, captionText, currentMediaUrl, isCurrentVideo]);

    const authorAvatar = moment.author.avatarUrl || moment.author.avatar || `https://picsum.photos/seed/${moment.authorId || moment.id}/200`;

    return (
        <>
            <div className="bg-[#0c0c0e] border border-zinc-800 p-4 mb-4 relative transition-colors duration-200 hover:border-zinc-700/80">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <img 
                            src={authorAvatar} 
                            onError={handleImageError} 
                            alt={moment.author.name} 
                            className="w-9 h-9 object-cover border border-zinc-700 rounded-none bg-zinc-900" 
                        />
                        <div>
                            <div className="flex items-center gap-1.5">
                                <p className="font-bold text-white text-xs font-mono uppercase tracking-wider">{moment.author.name}</p>
                                {moment.author.isVerified && <CheckBadgeIcon className="w-4 h-4 text-blue-400" />}
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                                    // {moment.category || moment.type || 'STILLS'}
                                </span>
                                {moment.createdAt && (
                                    <span className="text-[10px] font-mono text-zinc-600">
                                        • {formatRelativeTime(moment.createdAt)}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-zinc-400 relative">
                        {shareFeedback && (
                            <span className="text-[10px] font-mono bg-zinc-800 text-amber-400 px-2 py-0.5 border border-zinc-700 animate-pulse">
                                {shareFeedback}
                            </span>
                        )}
                        <button 
                            onClick={handleShare}
                            className="hover:text-white transition-colors p-1"
                            title="Share Moment"
                        >
                            <EllipsisVerticalIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* AI Summary - only if real summary exists */}
                {moment.aiSummary && moment.aiSummary.trim().length > 0 && (
                    <div className="mt-3 bg-zinc-950 border border-zinc-800/80 p-2.5">
                        <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-500 block mb-1">// AI_SUMMARY</span>
                        <p className="text-xs font-mono text-zinc-300">"{moment.aiSummary}"</p>
                    </div>
                )}

                {/* Media Container */}
                {currentMediaUrl && (
                    <div className="mt-3 relative">
                        <AspectRatioBox
                            ref={mediaContainerRef}
                            ratio="video"
                            className={`border border-zinc-800 bg-black group relative overflow-hidden ${!isVisible || (!isCurrentVideo ? 'cursor-zoom-in' : 'cursor-pointer')}`}
                            onMouseEnter={() => setIsControlsVisible(true)}
                            onMouseLeave={() => setIsControlsVisible(false)}
                            onClick={isVisible ? (isCurrentVideo ? togglePlayPause : () => setZoomedImageUrl(currentMediaUrl)) : undefined}
                        >
                            {isVisible ? (
                                isCurrentVideo ? (
                                    <>
                                        <video
                                            ref={videoRef}
                                            src={currentMediaUrl}
                                            poster={moment.thumbnailUrl}
                                            onTimeUpdate={handleTimeUpdate}
                                            onLoadedMetadata={handleLoadedMetadata}
                                            onPlay={() => setIsPlaying(true)}
                                            onPause={() => setIsPlaying(false)}
                                            onEnded={() => setIsPlaying(false)}
                                            muted={isMuted}
                                            playsInline
                                            className="w-full h-full object-cover"
                                        />
                                        
                                        <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${!isPlaying ? 'opacity-100' : 'opacity-0'} bg-black/30 pointer-events-none`}>
                                            <div className="w-20 h-20 bg-black/50 rounded-full flex items-center justify-center backdrop-blur-sm">
                                                <PlayIcon className="w-10 h-10 text-white" />
                                            </div>
                                        </div>
                                        
                                        <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 transition-opacity duration-300 ${isControlsVisible || !isPlaying ? 'opacity-100' : 'opacity-0'}`} onClick={(e) => e.stopPropagation()}>
                                            <div className="w-full mb-2">
                                                 <input
                                                    type="range"
                                                    min="0"
                                                    max={duration || 0}
                                                    value={progress}
                                                    onChange={handleSeek}
                                                    onPointerDown={handleProgressPointerDown}
                                                    className="w-full h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer accent-red-600"
                                                />
                                            </div>
                                            <div className="flex items-center justify-between gap-4 text-white">
                                                <div className="flex items-center gap-3">
                                                    <button onClick={togglePlayPause} className="p-1.5 rounded-full hover:bg-white/25 transition-all duration-200 transform hover:scale-110 active:scale-100">
                                                        {isPlaying ? <PauseIcon className="w-6 h-6" /> : <PlayIcon className="w-6 h-6" />}
                                                    </button>
                                                    <div className="flex items-center gap-2 group/volume">
                                                        <button onClick={toggleMute} className="p-1.5 rounded-full hover:bg-white/25 transition-all duration-200 transform hover:scale-110 active:scale-100">
                                                            {isMuted || volume === 0 ? <VolumeOffIcon className="w-6 h-6" /> : <VolumeUpIcon className="w-6 h-6" />}
                                                        </button>
                                                        <input
                                                            type="range"
                                                            min="0"
                                                            max="1"
                                                            step="0.01"
                                                            value={isMuted ? 0 : volume}
                                                            onChange={handleVolumeChange}
                                                            className="w-0 h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer accent-red-600 transition-all duration-300 opacity-0 group-hover/volume:opacity-100 group-hover/volume:w-20"
                                                        />
                                                    </div>
                                                </div>
                                                
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-mono w-24 text-center">{formatTime(progress)} / {formatTime(duration)}</span>
                                                    <button onClick={cyclePlaybackRate} className="text-xs font-bold w-14 text-center p-1.5 rounded-full hover:bg-white/25 transition-all duration-200 transform hover:scale-110 active:scale-100">
                                                        {playbackRate.toFixed(2)}x
                                                    </button>
                                                    <button onClick={toggleFullScreen} className="p-1.5 rounded-full hover:bg-white/25 transition-all duration-200 transform hover:scale-110 active:scale-100">
                                                        {isFullscreen ? <ArrowsPointingInIcon className="w-6 h-6" /> : <ArrowsPointingOutIcon className="w-6 h-6" />}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                     <img src={currentMediaUrl} onError={handleImageError} alt="Post content" className="w-full h-full object-cover" />
                                )
                            ) : (
                                <MediaPlaceholder thumbnailUrl={moment.thumbnailUrl} isVideo={isCurrentVideo} />
                            )}

                            {/* Carousel Navigation Arrows if multiple media items */}
                            {mediaList.length > 1 && (
                                <>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveMediaIndex((prev) => (prev > 0 ? prev - 1 : mediaList.length - 1));
                                        }}
                                        className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/60 hover:bg-black/90 text-white flex items-center justify-center border border-zinc-700/60 transition-all z-10"
                                        aria-label="Previous Media"
                                    >
                                        <ChevronLeftIcon className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveMediaIndex((prev) => (prev < mediaList.length - 1 ? prev + 1 : 0));
                                        }}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/60 hover:bg-black/90 text-white flex items-center justify-center border border-zinc-700/60 transition-all z-10"
                                        aria-label="Next Media"
                                    >
                                        <ChevronRightIcon className="w-4 h-4" />
                                    </button>
                                    <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/75 border border-zinc-800 text-[10px] font-mono text-zinc-300 z-10">
                                        {activeMediaIndex + 1}/{mediaList.length}
                                    </div>
                                </>
                            )}
                        </AspectRatioBox>

                        {/* Carousel Indicator Dots */}
                        {mediaList.length > 1 && (
                            <div className="flex justify-center items-center gap-1.5 mt-2">
                                {mediaList.map((_, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setActiveMediaIndex(idx)}
                                        className={`transition-all duration-150 ${
                                            idx === activeMediaIndex 
                                                ? 'w-4 h-1.5 bg-white rounded-none' 
                                                : 'w-1.5 h-1.5 bg-zinc-700 hover:bg-zinc-500 rounded-none'
                                        }`}
                                        aria-label={`Go to slide ${idx + 1}`}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}
                
                {/* Action Bar */}
                <div className="mt-3 border-t border-zinc-800/80 pt-3 flex justify-between items-center text-zinc-400 font-mono text-xs">
                    <div className="flex items-center space-x-4">
                        <button 
                            onClick={handleLike}
                            className={`flex items-center space-x-1.5 transition-colors ${
                                isLiked ? 'text-red-500 hover:text-red-400' : 'hover:text-white'
                            }`}
                            title={isLiked ? 'Unlike' : 'Like'}
                        >
                            <HeartIcon className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                            <span>{formatNumber(likesCount)}</span>
                        </button>
                        <div className="flex items-center space-x-1.5 text-zinc-500" title="Total Views">
                            <TrendingUpIcon className="w-4 h-4" />
                            <span>{formatNumber(viewsCount)}</span>
                        </div>
                        <button 
                            onClick={() => setShowComments(!showComments)}
                            className={`flex items-center space-x-1.5 transition-colors ${
                                showComments ? 'text-white' : 'hover:text-white'
                            }`}
                            title="Comments"
                        >
                            <ChatBubbleBottomCenterTextIcon className="w-4 h-4" />
                            <span>{formatNumber(commentsCount)}</span>
                        </button>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button 
                            onClick={handleShare}
                            className="hover:text-white transition-colors p-1"
                            title="Share Link"
                        >
                            <ForwardIcon className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={handleBookmark}
                            className={`transition-colors p-1 ${
                                isSaved ? 'text-amber-400 hover:text-amber-300' : 'hover:text-white'
                            }`}
                            title={isSaved ? 'Remove Bookmark' : 'Bookmark Moment'}
                        >
                            <BookmarkIcon className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Content / Caption */}
                {captionText && (
                    <div className="mt-3">
                        <p className="text-zinc-300 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                            {isLongContent ? (
                                <>
                                    {showMore ? captionText : `${captionText.substring(0, 150)}...`}
                                    <button 
                                        onClick={() => setShowMore(!showMore)} 
                                        className="text-white underline font-bold ml-1.5 hover:text-zinc-300"
                                    >
                                        {showMore ? 'LESS' : 'MORE'}
                                    </button>
                                </>
                            ) : (
                                captionText
                            )}
                        </p>
                    </div>
                )}

                {/* Inline Comment Section */}
                {showComments && (
                    <div className="mt-4 pt-3 border-t border-zinc-800">
                        <CommentSection
                            post={postForComment}
                            isOpen={showComments}
                            onClose={() => setShowComments(false)}
                            onCommentAdded={() => {
                                setCommentsCount(prev => prev + 1);
                            }}
                        />
                    </div>
                )}
            </div>

            <ImageZoomModal 
                isOpen={!!zoomedImageUrl} 
                onClose={() => setZoomedImageUrl(null)} 
                imageUrl={zoomedImageUrl || ''}
            />
        </>
    );
};

export default MomentCard;