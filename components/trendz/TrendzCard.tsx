

import React, { useState, useRef, useEffect } from 'react';
import type { Trend } from '../../types';
import {
    ArrowUpIcon,
    TrendingUpIcon,
    ChatBubbleBottomCenterTextIcon,
    SoundWaveIcon,
    ForwardIcon,
    BookmarkIcon,
    SparklesIcon,
    EllipsisVerticalIcon,
    PlayIcon,
    PauseIcon,
    VolumeUpIcon,
    VolumeOffIcon,
    ArrowsPointingInIcon,
    ArrowsPointingOutIcon,
    InformationCircleIcon,
} from '../ui/Icons';
import { handleImageError } from '../utils/imageUtils';
import { useFullscreen } from '../hooks/useFullscreen';
import { useLazyLoad } from '../hooks/useLazyLoad';
import AspectRatioBox from '../ui/AspectRatioBox';
import ImageZoomModal from '../ui/ImageZoomModal';
import { useAIAssistant } from '../../contexts/AIAssistantContext';

interface TrendzCardProps {
    trend: Trend;
    onClick: () => void;
}

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

const TrendzCard: React.FC<TrendzCardProps> = ({ trend, onClick }) => {
    const { openModal } = useAIAssistant();
    const isVideo = trend.mediaType === 'video';
    const videoRef = useRef<HTMLVideoElement>(null);
    const videoContainerRef = useRef<HTMLDivElement>(null);

    const [showFullContent, setShowFullContent] = useState(false);
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
    
    const handleAIAssistantClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        openModal({
            id: trend.id,
            title: trend.title,
            content: trend.fullContent,
            author: trend.details.publishedBy
        });
    };

    const togglePlayPause = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (videoRef.current) {
            if (videoRef.current.paused) {
                videoRef.current.play().catch(console.error);
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

    return (
        <>
            <div className="bg-invox-dark-accent rounded-lg border border-gray-800 p-4 mb-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-invox-dark flex items-center justify-center border border-gray-800">
                            <trend.domain.icon className="w-6 h-6 text-invox-light-gray" />
                        </div>
                        <div className="flex items-center gap-1">
                            <p className="font-bold text-white">{trend.details.publishedBy}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-invox-light-gray">
                        <button onClick={onClick} className="hover:text-white transition-transform duration-200 transform hover:scale-110 active:scale-100" aria-label="View trend details">
                            <InformationCircleIcon className="w-6 h-6" />
                        </button>
                        <button onClick={handleAIAssistantClick} className="hover:text-white transition-transform duration-200 transform hover:scale-110 active:scale-100" aria-label="AI summary">
                            <SparklesIcon className="w-6 h-6" />
                        </button>
                        <button className="hover:text-white transition-transform duration-200 transform hover:scale-110 active:scale-100" aria-label="More options">
                            <EllipsisVerticalIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="mt-4">
                    <h2 className="text-xl font-semibold italic text-white">"{trend.title}"</h2>
                    <p className="text-invox-light-gray mt-2">
                        {showFullContent ? trend.fullContent : trend.summary}
                        {' '}
                        <button onClick={() => setShowFullContent(prev => !prev)} className="text-invox-red font-semibold ml-1 hover:underline">
                            {showFullContent ? 'Show less' : 'Show more'}
                        </button>
                    </p>
                </div>

                {/* Media */}
                <AspectRatioBox
                    ref={mediaContainerRef}
                    ratio="video"
                    className={`mt-4 rounded-2xl border border-gray-800 group bg-invox-dark ${!isVisible || (isVideo ? 'cursor-pointer' : 'cursor-zoom-in')}`}
                    onMouseEnter={() => setIsControlsVisible(true)}
                    onMouseLeave={() => setIsControlsVisible(false)}
                    onClick={isVisible ? (isVideo ? togglePlayPause : () => setZoomedImageUrl(trend.mediaUrl)) : undefined}
                >
                    {isVisible ? (
                        isVideo ? (
                            <>
                                <video
                                    ref={videoRef}
                                    src={trend.mediaUrl}
                                    poster={trend.thumbnailUrl}
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
                                
                                <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 transition-opacity duration-300 ${isControlsVisible || !isPlaying ? 'opacity-100' : 'opacity-0'}`} onClick={(e) => e.stopPropagation()}>
                                    <div className="w-full mb-2">
                                        <input
                                            type="range"
                                            min="0"
                                            max={duration || 0}
                                            value={progress}
                                            onChange={handleSeek}
                                            onPointerDown={handleProgressPointerDown}
                                            className="w-full h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer accent-invox-red"
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
                                                    className="w-0 h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer accent-invox-red transition-all duration-300 opacity-0 group-hover/volume:opacity-100 group-hover/volume:w-20"
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
                            <img src={trend.mediaUrl} onError={handleImageError} alt={trend.title} className="w-full h-full object-cover" />
                        )
                    ) : (
                         <MediaPlaceholder thumbnailUrl={trend.thumbnailUrl} isVideo={isVideo} />
                    )}
                </AspectRatioBox>


                {/* Action Bar */}
                <div className="mt-4 border border-gray-800 rounded-lg px-4 py-2 flex justify-around items-center">
                    <button className="flex items-center gap-1.5 text-invox-light-gray hover:text-invox-red transition-all duration-200 transform hover:scale-110 active:scale-100">
                        <ArrowUpIcon className="w-5 h-5" />
                        <span className="text-sm font-semibold">{formatNumber(trend.stats.likes)}</span>
                    </button>
                    <div className="flex items-center gap-1.5 text-invox-light-gray">
                        <TrendingUpIcon className="w-5 h-5" />
                        <span className="text-sm font-semibold">{formatNumber(trend.stats.views)}</span>
                    </div>
                    <button className="flex items-center gap-1.5 text-invox-light-gray hover:text-white transition-all duration-200 transform hover:scale-110 active:scale-100">
                        <ChatBubbleBottomCenterTextIcon className="w-5 h-5" />
                        <span className="text-sm font-semibold">{formatNumber(trend.stats.comments)}</span>
                    </button>
                    <button className="text-invox-light-gray hover:text-white transition-all duration-200 transform hover:scale-110 active:scale-100"><SoundWaveIcon className="w-5 h-5" /></button>
                    <button className="text-invox-light-gray hover:text-white transition-all duration-200 transform hover:scale-110 active:scale-100"><ForwardIcon className="w-5 h-5" /></button>
                    <button className="text-invox-light-gray hover:text-white transition-all duration-200 transform hover:scale-110 active:scale-100"><BookmarkIcon className="w-5 h-5" /></button>
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

export default TrendzCard;