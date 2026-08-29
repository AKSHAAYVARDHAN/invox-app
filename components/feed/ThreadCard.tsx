

import React, { useState, useRef, useEffect } from 'react';
import type { Post } from '../../types';
import { 
    SparklesIcon,
    CheckBadgeIcon,
    EllipsisVerticalIcon,
    PlayIcon,
    PauseIcon,
    VolumeUpIcon,
    VolumeOffIcon,
    ArrowUpIcon,
    TrendingUpIcon,
    PresentationChartBarIcon,
    ForwardIcon,
    BookmarkIcon,
    ArrowsPointingOutIcon,
    ArrowsPointingInIcon
} from '../ui/Icons';
import { handleImageError } from '../utils/imageUtils';
import { useFullscreen } from '../hooks/useFullscreen';
import { useLazyLoad } from '../hooks/useLazyLoad';
import AspectRatioBox from '../ui/AspectRatioBox';
import ImageZoomModal from '../ui/ImageZoomModal';
import { useAIAssistant } from '../../contexts/AIAssistantContext';
import { useAuth } from '../../contexts/AuthContext';
import { toggleLikePost, toggleBookmarkPost, incrementPostView } from '../../services/postService';

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
    return <div className="w-full h-full bg-gray-700"></div>;
};

export const ThreadCard: React.FC<{ post: Post }> = ({ post }) => {
    const { openModal } = useAIAssistant();
    const isVideo = post.mediaType === 'video';
    const videoRef = useRef<HTMLVideoElement>(null);
    const videoContainerRef = useRef<HTMLDivElement>(null);

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

    const { currentUser } = useAuth();
    const [isLiked, setIsLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(post.stats.likes);
    const [isSaved, setIsSaved] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (isVisible) {
            incrementPostView(post.id);
        }
    }, [isVisible, post.id]);

    const handleLikeClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!currentUser) return;
        const nextLiked = !isLiked;
        setIsLiked(nextLiked);
        setLikeCount(prev => nextLiked ? prev + 1 : Math.max(0, prev - 1));
        try {
            await toggleLikePost(post.id);
        } catch (err) {
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
            await toggleBookmarkPost(post.id);
        } catch (err) {
            setIsSaved(!nextSaved);
        }
    };

    const handleShareClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (navigator.share) {
            try {
                await navigator.share({
                    title: post.aiSummary || 'Invox Thread',
                    text: post.content,
                    url: window.location.href,
                });
            } catch (err) {}
        } else {
            try {
                await navigator.clipboard.writeText(`${post.aiSummary}\n\n${post.content}`);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            } catch (err) {}
        }
    };

    const handleAIAssistantClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        openModal({
            id: post.id,
            title: post.aiSummary,
            content: post.content,
            author: post.author.name
        });
    };
    
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
            const duration = videoRef.current.duration;
            if (duration > 0) {
                const seekTime = (clickX / width) * duration;
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
            if (!newMutedState && volume === 0) {
                setVolume(1); // Unmute to full volume if it was 0
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

    return (
        <>
            <div className="bg-[#0c0c0e] border border-zinc-800/90 hover:border-zinc-700/80 p-4 mb-4 transition-all duration-150">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
                    <div className="flex items-center gap-3">
                        <img 
                            src={post.author.avatarUrl} 
                            onError={handleImageError} 
                            alt={post.author.name} 
                            className="w-9 h-9 rounded-none object-cover border border-zinc-700" 
                        />
                        <div>
                            <div className="flex items-center gap-1.5">
                                <p className="font-mono text-xs font-bold text-white uppercase tracking-wider">{post.author.name}</p>
                                {post.author.isVerified && <CheckBadgeIcon className="w-3.5 h-3.5 text-zinc-400" />}
                            </div>
                            <p className="text-[10px] font-mono text-zinc-500 mt-0.5">// TYPE: THREAD</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-zinc-400">
                        <button 
                            onClick={handleAIAssistantClick} 
                            className="p-1.5 border border-zinc-800/80 bg-zinc-900/40 hover:bg-zinc-800 hover:text-white transition-colors" 
                            aria-label="Ask AI about this post"
                        >
                            <SparklesIcon className="w-4 h-4" />
                        </button>
                        <button 
                            className="p-1.5 border border-zinc-800/80 bg-zinc-900/40 hover:bg-zinc-800 hover:text-white transition-colors" 
                            aria-label="More options"
                        >
                            <EllipsisVerticalIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="mt-3.5">
                    <p className="text-base font-semibold font-mono text-white tracking-tight">"{post.aiSummary}"</p>
                    <p className="text-zinc-400 text-xs sm:text-sm mt-2 leading-relaxed font-sans">{post.content}</p>
                </div>

                {/* Media */}
                {post.mediaUrl && (
                    <AspectRatioBox
                        ref={mediaContainerRef}
                        ratio="video"
                        className={`mt-3.5 border border-zinc-800 bg-black group ${!isVisible || (!isVideo ? 'cursor-zoom-in' : 'cursor-pointer')}`}
                        onMouseEnter={() => setIsControlsVisible(true)}
                        onMouseLeave={() => setIsControlsVisible(false)}
                        onClick={isVisible ? (isVideo ? togglePlayPause : () => setZoomedImageUrl(post.mediaUrl || null)) : undefined}
                    >
                        {isVisible ? (
                            isVideo ? (
                                <>
                                    <video
                                        ref={videoRef}
                                        src={post.mediaUrl}
                                        poster={post.thumbnailUrl}
                                        onTimeUpdate={handleTimeUpdate}
                                        onLoadedMetadata={handleLoadedMetadata}
                                        onPlay={() => setIsPlaying(true)}
                                        onPause={() => setIsPlaying(false)}
                                        onEnded={() => setIsPlaying(false)}
                                        muted={isMuted}
                                        playsInline
                                        title={post.aiSummary}
                                        className="w-full h-full object-cover"
                                    />
                                    
                                    <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${!isPlaying ? 'opacity-100' : 'opacity-0'} bg-black/40 pointer-events-none`}>
                                        <div className="w-14 h-14 bg-black/80 border border-white/20 flex items-center justify-center backdrop-blur-sm">
                                            <PlayIcon className="w-6 h-6 text-white" />
                                        </div>
                                    </div>
                                    
                                    <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-2.5 transition-opacity duration-200 ${isControlsVisible || !isPlaying ? 'opacity-100' : 'opacity-0'}`} onClick={(e) => e.stopPropagation()}>
                                        <div className="w-full mb-2">
                                            <input
                                                type="range"
                                                min="0"
                                                max={duration || 0}
                                                value={progress}
                                                onChange={handleSeek}
                                                onPointerDown={handleProgressPointerDown}
                                                aria-label="Video progress"
                                                className="w-full h-1 bg-zinc-700 appearance-none cursor-pointer accent-white"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between gap-3 text-white">
                                            <div className="flex items-center gap-2">
                                                <button onClick={togglePlayPause} className="p-1 border border-zinc-700 bg-black/60 hover:bg-zinc-800 transition-colors" aria-label={isPlaying ? 'Pause video' : 'Play video'}>
                                                    {isPlaying ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />}
                                                </button>
                                                <div className="flex items-center gap-1 group/volume">
                                                    <button onClick={toggleMute} className="p-1 border border-zinc-700 bg-black/60 hover:bg-zinc-800 transition-colors" aria-label={isMuted ? 'Unmute video' : 'Mute video'}>
                                                        {isMuted || volume === 0 ? <VolumeOffIcon className="w-4 h-4" /> : <VolumeUpIcon className="w-4 h-4" />}
                                                    </button>
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="1"
                                                        step="0.01"
                                                        value={isMuted ? 0 : volume}
                                                        onChange={handleVolumeChange}
                                                        aria-label="Volume control"
                                                        className="w-0 h-1 bg-zinc-700 appearance-none cursor-pointer accent-white transition-all duration-200 opacity-0 group-hover/volume:opacity-100 group-hover/volume:w-16"
                                                    />
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-2 font-mono text-[11px]">
                                                <span className="text-zinc-300 tracking-wider">[{formatTime(progress)} / {formatTime(duration)}]</span>
                                                <button onClick={cyclePlaybackRate} className="px-1.5 py-0.5 border border-zinc-700 bg-black/60 hover:bg-zinc-800 text-[10px] font-bold" aria-label="Change playback speed">
                                                    {playbackRate.toFixed(2)}x
                                                </button>
                                                <button onClick={toggleFullScreen} className="p-1 border border-zinc-700 bg-black/60 hover:bg-zinc-800" aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
                                                    {isFullscreen ? <ArrowsPointingInIcon className="w-4 h-4" /> : <ArrowsPointingOutIcon className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <img src={post.mediaUrl} onError={handleImageError} alt="Post content" className="w-full h-full object-cover" />
                            )
                        ) : (
                             <MediaPlaceholder thumbnailUrl={post.thumbnailUrl} isVideo={isVideo} />
                        )}
                    </AspectRatioBox>
                )}

                {/* Stats Bar */}
                <div className="mt-4 border-t border-zinc-800/80 pt-3 flex justify-between items-center font-mono text-xs text-zinc-400">
                    <button 
                        onClick={handleLikeClick}
                        className={`flex items-center gap-1.5 px-2 py-1 border border-transparent hover:border-zinc-800 transition-colors ${
                            isLiked ? 'text-rose-500 font-bold border-zinc-800 bg-zinc-900/60' : 'hover:text-white'
                        }`}
                        aria-label="Upvote thread"
                    >
                        <ArrowUpIcon className={`w-4 h-4 ${isLiked ? 'stroke-[2.5]' : ''}`} />
                        <span>{formatNumber(likeCount)}</span>
                    </button>
                    <div className="flex items-center gap-1.5 px-2 py-1 text-zinc-500" role="status" aria-label={`${formatNumber(post.stats.views)} views`}>
                        <TrendingUpIcon className="w-4 h-4" />
                        <span>{formatNumber(post.stats.views)}</span>
                    </div>
                    <button 
                        onClick={handleAIAssistantClick}
                        className="flex items-center gap-1.5 px-2 py-1 border border-transparent hover:border-zinc-800 hover:text-white transition-colors" 
                        aria-label="View comments"
                    >
                        <PresentationChartBarIcon className="w-4 h-4" />
                        <span>{formatNumber(post.stats.comments)}</span>
                    </button>
                    <button 
                        onClick={handleShareClick}
                        className={`p-1 border border-transparent hover:border-zinc-800 transition-colors relative ${
                            copied ? 'text-emerald-400 border-zinc-800 bg-zinc-900' : 'hover:text-white'
                        }`}
                        aria-label="Share thread"
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
                        aria-label="Save thread"
                    >
                        <BookmarkIcon className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
                    </button>
                </div>

                {/* Action Button */}
                <div className="mt-3">
                    <button 
                        onClick={handleAIAssistantClick}
                        className="w-full bg-zinc-900/60 border border-zinc-700/80 text-white font-mono text-xs uppercase tracking-wider py-2.5 hover:bg-zinc-800 hover:border-zinc-500 transition-all duration-150 flex items-center justify-center gap-2"
                    >
                        <span>// COMMENT</span>
                    </button>
                </div>
            </div>
            <ImageZoomModal 
                isOpen={!!zoomedImageUrl} 
                onClose={() => setZoomedImageUrl(null)} 
                imageUrl={zoomedImageUrl || ''}
            />
        </>
    );
};