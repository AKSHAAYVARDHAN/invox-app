

import React, { useState, useRef, useEffect } from 'react';
import type { Trend } from '../../types';
import { 
    ArrowLeftIcon, 
    PlayIcon, 
    BookmarkIcon, 
    ArrowUpIcon, 
    TrendingUpIcon, 
    EqualsInCircleIcon, 
    SoundWaveIcon, 
    ForwardIcon,
    PauseIcon,
    VolumeUpIcon,
    VolumeOffIcon,
    ArrowsPointingOutIcon,
    ArrowsPointingInIcon
} from '../ui/Icons';
import { handleImageError } from '../utils/imageUtils';
import { useFullscreen } from '../hooks/useFullscreen';
import AspectRatioBox from '../ui/AspectRatioBox';
import ImageZoomModal from '../ui/ImageZoomModal';

interface TrendzDetailProps {
    trend: Trend;
    onBack: () => void;
}

const formatNumber = (num: number) => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num;
};

const TrendzDetail: React.FC<TrendzDetailProps> = ({ trend, onBack }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const videoContainerRef = useRef<HTMLDivElement>(null);
    const isVideo = trend.mediaType === 'video';

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
            <div className="bg-[#0c0c0e] border border-zinc-800 p-4 sm:p-6">
                <button onClick={onBack} className="flex items-center gap-2 mb-4 text-zinc-400 hover:text-white font-mono text-xs uppercase tracking-wider transition-colors">
                    <ArrowLeftIcon className="w-4 h-4" />
                    <span>// BACK_TO_TRENDZ</span>
                </button>
                
                <AspectRatioBox
                    ref={videoContainerRef}
                    ratio="video"
                    className={`mb-4 bg-black border border-zinc-800 group ${isVideo ? 'cursor-pointer' : 'cursor-zoom-in'}`}
                    onMouseEnter={() => setIsControlsVisible(true)}
                    onMouseLeave={() => setIsControlsVisible(false)}
                    onClick={isVideo ? togglePlayPause : () => setZoomedImageUrl(trend.mediaUrl)}
                >
                    {trend.mediaType === 'video' ? (
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
                                title={trend.title}
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
                        <img 
                            src={trend.mediaUrl} 
                            onError={handleImageError} 
                            alt={trend.title} 
                            className="w-full h-full object-cover" 
                        />
                    )}
                </AspectRatioBox>

                <h1 className="text-xl sm:text-2xl font-bold font-mono text-white mb-3 uppercase tracking-tight">{trend.title}</h1>
                <p className="text-zinc-400 text-sm sm:text-base leading-relaxed mb-6 font-sans">{trend.fullContent}</p>

                <div className="border border-zinc-800 bg-zinc-900/30 px-4 py-2.5 flex justify-between items-center mb-6 font-mono text-xs text-zinc-400">
                    <button className="flex items-center gap-1.5 hover:text-white transition-colors" aria-label="Upvote trend">
                        <ArrowUpIcon className="w-4 h-4" />
                        <span>{formatNumber(trend.stats.likes)}</span>
                    </button>
                    <div className="flex items-center gap-1.5 text-zinc-500" role="status" aria-label={`${formatNumber(trend.stats.views)} views`}>
                        <TrendingUpIcon className="w-4 h-4" />
                        <span>{formatNumber(trend.stats.views)}</span>
                    </div>
                    <button className="flex items-center gap-1.5 hover:text-white transition-colors" aria-label="View comments">
                        <EqualsInCircleIcon className="w-4 h-4" />
                        <span>{formatNumber(trend.stats.comments)}</span>
                    </button>
                    <button className="p-1 hover:text-white transition-colors" aria-label="Listen">
                        <SoundWaveIcon className="w-4 h-4" />
                    </button>
                    <button className="p-1 hover:text-white transition-colors" aria-label="Share trend">
                        <ForwardIcon className="w-4 h-4" />
                    </button>
                    <button className="p-1 hover:text-white transition-colors" aria-label="Save trend">
                        <BookmarkIcon className="w-4 h-4" />
                    </button>
                </div>

                <div className="bg-black border border-zinc-800 p-4">
                    <h3 className="font-mono text-xs font-bold text-white uppercase tracking-wider mb-3">// TELEMETRY_DETAILS</h3>
                    <div className="space-y-2.5 font-mono text-xs">
                        <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                            <span className="text-zinc-500">PUBLISHED_BY:</span>
                            <span className="text-white font-semibold">{trend.details.publishedBy}</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                            <span className="text-zinc-500">DATE:</span>
                            <span className="text-white font-semibold">{trend.details.publishedOn}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-zinc-500">SOURCE:</span>
                            <a href={trend.details.link} target="_blank" rel="noopener noreferrer" className="text-zinc-300 underline hover:text-white truncate max-w-[200px] sm:max-w-xs">{trend.details.link}</a>
                        </div>
                    </div>
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

export default TrendzDetail;