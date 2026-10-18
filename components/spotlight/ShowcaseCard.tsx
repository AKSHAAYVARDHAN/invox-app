import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Project, Post } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { 
    toggleLikePost, 
    toggleBookmarkPost, 
    incrementPostView, 
    isPostViewRecorded,
    deletePost 
} from '../../services/postService';
import { 
    CheckBadgeIcon, 
    ArrowUpIcon, 
    TrendingUpIcon, 
    ChatBubbleBottomCenterTextIcon, 
    BookmarkIcon, 
    ForwardIcon, 
    EllipsisVerticalIcon, 
    PencilSquareIcon, 
    TrashIcon, 
    PlayIcon, 
    PauseIcon, 
    VolumeUpIcon, 
    VolumeOffIcon, 
    ArrowsPointingOutIcon, 
    ArrowsPointingInIcon, 
    GlobeAltIcon, 
    CodeBracketIcon, 
    DocumentTextIcon, 
    SparklesIcon,
    CloseIcon
} from '../ui/Icons';
import { AspectRatioBox } from '../ui/AspectRatioBox';
import { ImageZoomModal } from '../ui/ImageZoomModal';
import { CommentSection } from '../feed/CommentSection';
import { EditShowcaseModal } from '../uploads/EditShowcaseModal';
import { handleImageError } from '../utils/imageUtils';
import { formatTime } from '../utils/fullscreenUtils';
import { useFullscreen } from '../hooks/useFullscreen';
import { useLazyLoad } from '../hooks/useLazyLoad';
import { formatNumber } from '../../utils/formatters';

interface ShowcaseCardProps {
    project: Project;
    initialLiked?: boolean;
    initialSaved?: boolean;
    onDeleted?: (projectId: string) => void;
    onUpdated?: (updated: Project) => void;
    onFilterByTag?: (tag: string) => void;
    onFilterByCategory?: (category: string) => void;
}

const ShowcaseCardComponent: React.FC<ShowcaseCardProps> = ({
    project,
    initialLiked = false,
    initialSaved = false,
    onDeleted,
    onUpdated,
    onFilterByTag,
    onFilterByCategory,
}) => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();

    // Local reactive project state
    const [currentProject, setCurrentProject] = useState<Project>(project);
    const [isLiked, setIsLiked] = useState(initialLiked);
    const [likeCount, setLikeCount] = useState(project.stats?.likes || 0);
    const [isSaved, setIsSaved] = useState(initialSaved);
    const [showMore, setShowMore] = useState(false);

    // Modals & Menu
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isCommentsOpen, setIsCommentsOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);
    const [shareToast, setShareToast] = useState(false);

    // Video controls
    const mediaContainerRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [volume, setVolume] = useState(1);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [isControlsVisible, setIsControlsVisible] = useState(false);
    const isVideo = currentProject.mediaType === 'video' || (currentProject.mediaUrl?.match(/\.(mp4|webm|mov)$/i) !== null);

    const { isFullscreen, toggleFullscreen } = useFullscreen(mediaContainerRef);
    const cardRef = useRef<HTMLDivElement>(null);
    const [hasBeenVisible, setHasBeenVisible] = useState(false);
    const dwellTimerRef = useRef<NodeJS.Timeout | null>(null);
    const hasRecordedViewRef = useRef(false);

    const isOwner = currentUser?.uid && currentProject.authorId === currentUser.uid;

    // Synchronize props when parent updates without resetting media
    useEffect(() => {
        setCurrentProject(prev => {
            if (
                prev.id === project.id &&
                prev.stats?.views === project.stats?.views &&
                prev.stats?.likes === project.stats?.likes &&
                prev.stats?.comments === project.stats?.comments &&
                prev.mediaUrl === project.mediaUrl &&
                prev.title === project.title &&
                prev.description === project.description
            ) {
                return prev;
            }
            return project;
        });
        setLikeCount(project.stats?.likes || 0);
    }, [project]);

    // Initial check for deduplication
    useEffect(() => {
        if (project.id && isPostViewRecorded(project.id)) {
            hasRecordedViewRef.current = true;
        }
    }, [project.id]);

    // View dwell-time observer: requires at least 1000ms continuous visibility to count as a genuine view
    useEffect(() => {
        const el = cardRef.current;
        if (!el || typeof IntersectionObserver === 'undefined') {
            setHasBeenVisible(true);
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    // Mark as loaded once and KEEP loaded
                    setHasBeenVisible(true);

                    // If not yet counted in this session or window, initiate dwell countdown
                    if (!hasRecordedViewRef.current && project.id && !isPostViewRecorded(project.id)) {
                        if (!dwellTimerRef.current) {
                            dwellTimerRef.current = setTimeout(() => {
                                hasRecordedViewRef.current = true;
                                incrementPostView(project.id).catch(() => {});
                                dwellTimerRef.current = null;
                            }, 1000);
                        }
                    }
                } else {
                    // Canceled if scrolled away before 1-second dwell threshold
                    if (dwellTimerRef.current) {
                        clearTimeout(dwellTimerRef.current);
                        dwellTimerRef.current = null;
                    }
                }
            },
            {
                threshold: [0.15, 0.4],
                rootMargin: '100px 0px',
            }
        );

        observer.observe(el);

        return () => {
            if (dwellTimerRef.current) {
                clearTimeout(dwellTimerRef.current);
                dwellTimerRef.current = null;
            }
            observer.disconnect();
        };
    }, [project.id]);

    // Handle Like toggle
    const handleLikeToggle = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!currentUser) {
            navigate('/login');
            return;
        }

        // Optimistic update
        const nextLiked = !isLiked;
        setIsLiked(nextLiked);
        setLikeCount(prev => prev + (nextLiked ? 1 : -1));

        try {
            await toggleLikePost(currentProject.id);
        } catch (err) {
            // Revert on error
            setIsLiked(!nextLiked);
            setLikeCount(prev => prev + (nextLiked ? -1 : 1));
            console.error('[LIKE_POST_ERROR]', err);
        }
    };

    // Handle Bookmark toggle
    const handleBookmarkToggle = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!currentUser) {
            navigate('/login');
            return;
        }

        const nextSaved = !isSaved;
        setIsSaved(nextSaved);

        try {
            await toggleBookmarkPost(currentProject.id);
        } catch (err) {
            setIsSaved(!nextSaved);
            console.error('[BOOKMARK_POST_ERROR]', err);
        }
    };

    // Handle Share
    const handleShare = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const shareUrl = `${window.location.origin}/#/spotlight?tab=Showcase&project=${currentProject.id}`;
        const shareData = {
            title: currentProject.title || currentProject.name || currentProject.oneLine || 'INVOX Showcase Project',
            text: currentProject.oneLine || currentProject.aiSummary || currentProject.description,
            url: shareUrl,
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
                return;
            } catch {
                // Fall back to clipboard
            }
        }

        try {
            await navigator.clipboard.writeText(shareUrl);
            setShareToast(true);
            setTimeout(() => setShareToast(false), 3000);
        } catch (err) {
            console.warn('[CLIPBOARD_COPY_ERROR]', err);
        }
    };

    // Handle Deletion
    const handleConfirmDelete = async () => {
        if (!isOwner) return;
        setIsDeleting(true);
        try {
            await deletePost(currentProject.id);
            setIsDeleteModalOpen(false);
            onDeleted?.(currentProject.id);
        } catch (err) {
            console.error('[DELETE_POST_ERROR]', err);
            alert('Failed to delete post: ' + (err as any)?.message);
        } finally {
            setIsDeleting(false);
        }
    };

    // Video play/pause
    const togglePlayPause = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (!videoRef.current) return;
        if (isPlaying) {
            videoRef.current.pause();
        } else {
            videoRef.current.play().catch(console.warn);
        }
    };

    const toggleMute = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (!videoRef.current) return;
        videoRef.current.muted = !isMuted;
        setIsMuted(!isMuted);
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

    // Convert Project to Post format for CommentSection & EditPostModal
    const postEquivalent: Post = {
        id: currentProject.id,
        authorId: currentProject.authorId,
        author: {
            name: currentProject.author?.name || 'Invox Member',
            avatarUrl: currentProject.author?.avatarUrl || '',
            username: currentProject.author?.username,
            isVerified: currentProject.author?.isVerified,
            id: currentProject.authorId,
            uid: currentProject.authorId,
        },
        title: currentProject.title || currentProject.name || currentProject.oneLine,
        aiSummary: currentProject.aiSummary || currentProject.oneLine || '',
        oneLine: currentProject.oneLine || currentProject.aiSummary || '',
        content: currentProject.description,
        mediaUrl: currentProject.mediaUrl,
        mediaType: currentProject.mediaType,
        thumbnailUrl: currentProject.thumbnailUrl,
        demoUrl: currentProject.demoUrl,
        githubUrl: currentProject.githubUrl || currentProject.repoUrl,
        repoUrl: currentProject.repoUrl || currentProject.githubUrl,
        articleUrl: currentProject.articleUrl,
        status: currentProject.status || 'published',
        isPublished: currentProject.isPublished !== false,
        stats: currentProject.stats,
        likeCount: likeCount,
        viewCount: currentProject.stats?.views || 0,
        commentCount: currentProject.stats?.comments || 0,
        type: 'Showcase' as any,
        category: currentProject.category,
        domain: currentProject.domain || currentProject.category,
        tags: currentProject.tags || [],
        createdAt: currentProject.createdAt instanceof Date ? currentProject.createdAt : new Date(currentProject.createdAt || Date.now()),
    };

    const projectTitle = currentProject.title || currentProject.name || currentProject.oneLine || 'Untitled Project';
    const projectDomain = currentProject.domain || currentProject.category || 'Technology';
    const displayTags = currentProject.tags && currentProject.tags.length > 0 ? currentProject.tags : [];

    return (
        <div ref={cardRef} className="bg-[#0c0c0e] border border-zinc-800 p-5 mb-5 hover:border-zinc-700 transition-all font-mono relative">
            
            {/* Header: Author & Options */}
            <div className="flex items-center justify-between pb-3.5 border-b border-zinc-800/80">
                <div 
                    onClick={() => {
                        if (currentProject.authorId) {
                            navigate(`/profile/${currentProject.authorId}`);
                        }
                    }}
                    className="flex items-center gap-3 cursor-pointer group"
                >
                    <img 
                        src={currentProject.author?.avatarUrl || `https://picsum.photos/seed/${currentProject.id}/200`} 
                        onError={handleImageError} 
                        alt={currentProject.author?.name || 'Author'} 
                        className="w-10 h-10 border border-zinc-700 object-cover group-hover:border-zinc-500 transition-colors" 
                    />
                    <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-bold text-white text-xs sm:text-sm group-hover:text-zinc-200 transition-colors">
                                {currentProject.author?.name || 'Anonymous Creator'}
                            </p>
                            {currentProject.author?.isVerified && (
                                <CheckBadgeIcon className="w-4 h-4 text-emerald-400" title="Verified Creator" />
                            )}
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onFilterByCategory?.(projectDomain);
                                }}
                                className="text-[10px] uppercase font-mono px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-600 transition-colors"
                            >
                                {projectDomain}
                            </button>
                            {currentProject.status === 'draft' && (
                                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 bg-amber-950/80 border border-amber-600 text-amber-300">
                                    [DRAFT]
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-500 mt-0.5">
                            {currentProject.author?.username && <span>@{currentProject.author.username}</span>}
                            <span>•</span>
                            <span>{new Date(currentProject.createdAt).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>

                {/* Top Actions */}
                <div className="flex items-center gap-1 text-zinc-400">
                    <button
                        onClick={handleShare}
                        className="p-1.5 hover:text-white border border-transparent hover:border-zinc-800 transition-colors"
                        title="Share Project"
                    >
                        <ForwardIcon className="w-4 h-4" />
                    </button>

                    <div className="relative">
                        <button 
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="p-1.5 hover:text-white border border-transparent hover:border-zinc-800 transition-colors"
                            title="More options"
                        >
                            <EllipsisVerticalIcon className="w-5 h-5" />
                        </button>

                        {isMenuOpen && (
                            <div className="absolute right-0 mt-1 w-44 bg-[#0c0c0e] border border-zinc-800 shadow-2xl py-1 z-30 font-mono text-xs">
                                <button 
                                    onClick={(e) => {
                                        setIsMenuOpen(false);
                                        handleShare(e);
                                    }}
                                    className="w-full text-left px-3 py-2 text-zinc-300 hover:bg-zinc-900 hover:text-white uppercase tracking-wider flex items-center gap-2"
                                >
                                    <ForwardIcon className="w-3.5 h-3.5" />
                                    <span>Share Project</span>
                                </button>

                                {isOwner && (
                                    <>
                                        <button 
                                            onClick={() => {
                                                setIsMenuOpen(false);
                                                setIsEditModalOpen(true);
                                            }}
                                            className="w-full text-left px-3 py-2 text-white hover:bg-zinc-900 uppercase tracking-wider flex items-center gap-2 border-t border-zinc-800/80 mt-1"
                                        >
                                            <PencilSquareIcon className="w-3.5 h-3.5 text-zinc-400" />
                                            <span>// EDIT</span>
                                        </button>
                                        <button 
                                            onClick={() => {
                                                setIsMenuOpen(false);
                                                setIsDeleteModalOpen(true);
                                            }}
                                            className="w-full text-left px-3 py-2 text-red-400 hover:bg-red-950/40 hover:text-red-300 uppercase tracking-wider flex items-center gap-2 border-t border-zinc-800/80 mt-1"
                                        >
                                            <TrashIcon className="w-3.5 h-3.5" />
                                            <span>// DELETE</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Project Title & Hook */}
            <div className="mt-4 space-y-2">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-wide uppercase leading-tight">
                    {projectTitle}
                </h3>
                {currentProject.oneLine && currentProject.oneLine !== projectTitle && (
                    <p className="text-zinc-300 text-xs sm:text-sm font-medium leading-relaxed italic">
                        "{currentProject.oneLine}"
                    </p>
                )}
            </div>

            {/* Project Description (Expandable) */}
            <div className="mt-3">
                <p className="text-zinc-400 text-xs leading-relaxed whitespace-pre-line">
                    {showMore 
                        ? currentProject.description 
                        : `${currentProject.description.substring(0, 220)}${currentProject.description.length > 220 ? '...' : ''}`
                    }
                </p>
                {currentProject.description.length > 220 && (
                    <button 
                        onClick={() => setShowMore(!showMore)} 
                        className="text-white font-bold text-[11px] uppercase tracking-wider underline hover:text-zinc-300 transition-colors mt-1.5 block"
                    >
                        {showMore ? '// SHOW LESS' : '// VIEW DETAILS'}
                    </button>
                )}
            </div>

            {/* Tags */}
            {displayTags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                    {displayTags.map((tag, idx) => (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => onFilterByTag?.(tag)}
                            className="text-[10px] bg-zinc-900 border border-zinc-800 hover:border-zinc-600 px-2 py-0.5 text-zinc-400 hover:text-white transition-colors"
                        >
                            #{tag}
                        </button>
                    ))}
                </div>
            )}

            {/* External Links / Action Bar for Links */}
            {(currentProject.demoUrl || currentProject.githubUrl || currentProject.repoUrl || currentProject.articleUrl) && (
                <div className="mt-4 p-2.5 bg-black/60 border border-zinc-800 flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold block w-full sm:w-auto mr-1">
                        // ARTIFACTS:
                    </span>
                    {currentProject.demoUrl && (
                        <a 
                            href={currentProject.demoUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-white text-black font-bold text-[11px] uppercase tracking-wider hover:bg-zinc-200 transition-all"
                        >
                            <GlobeAltIcon className="w-3.5 h-3.5" />
                            <span>Live Demo ↗</span>
                        </a>
                    )}
                    {(currentProject.githubUrl || currentProject.repoUrl) && (
                        <a 
                            href={currentProject.githubUrl || currentProject.repoUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-900 border border-zinc-700 text-zinc-200 font-bold text-[11px] uppercase tracking-wider hover:border-zinc-500 hover:text-white transition-all"
                        >
                            <CodeBracketIcon className="w-3.5 h-3.5" />
                            <span>Repository ↗</span>
                        </a>
                    )}
                    {currentProject.articleUrl && (
                        <a 
                            href={currentProject.articleUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-900 border border-zinc-700 text-zinc-200 font-bold text-[11px] uppercase tracking-wider hover:border-zinc-500 hover:text-white transition-all"
                        >
                            <DocumentTextIcon className="w-3.5 h-3.5" />
                            <span>Article / Paper ↗</span>
                        </a>
                    )}
                </div>
            )}

            {/* Media Box */}
            {currentProject.mediaUrl && (
                <div className="mt-4">
                    <AspectRatioBox
                        ref={mediaContainerRef}
                        ratio="video"
                        className={`border border-zinc-800 bg-black group relative ${!hasBeenVisible || (!isVideo ? 'cursor-zoom-in' : 'cursor-pointer')}`}
                        onMouseEnter={() => setIsControlsVisible(true)}
                        onMouseLeave={() => setIsControlsVisible(false)}
                        onClick={hasBeenVisible ? (isVideo ? () => togglePlayPause() : () => setZoomedImageUrl(currentProject.mediaUrl || null)) : undefined}
                    >
                        {hasBeenVisible ? (
                            isVideo ? (
                                <>
                                    <video
                                        ref={videoRef}
                                        src={currentProject.mediaUrl}
                                        poster={currentProject.thumbnailUrl}
                                        onTimeUpdate={handleTimeUpdate}
                                        onLoadedMetadata={handleLoadedMetadata}
                                        onPlay={() => setIsPlaying(true)}
                                        onPause={() => setIsPlaying(false)}
                                        onEnded={() => setIsPlaying(false)}
                                        muted={isMuted}
                                        playsInline
                                        className="w-full h-full object-cover"
                                    />
                                    {/* Play Overlay */}
                                    <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${!isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'} bg-black/40`}>
                                        <div className="w-14 h-14 bg-black/80 border border-zinc-700 flex items-center justify-center backdrop-blur-sm shadow-xl">
                                            <PlayIcon className="w-7 h-7 text-white ml-1" />
                                        </div>
                                    </div>
                                    {/* Video Controls Bar */}
                                    <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 to-transparent p-3 transition-opacity duration-300 ${isControlsVisible || !isPlaying ? 'opacity-100' : 'opacity-0'}`} onClick={(e) => e.stopPropagation()}>
                                        <div className="w-full mb-2">
                                            <input
                                                type="range"
                                                min="0"
                                                max={duration || 0}
                                                value={progress}
                                                onChange={(e) => {
                                                    const newTime = parseFloat(e.target.value);
                                                    setProgress(newTime);
                                                    if (videoRef.current) videoRef.current.currentTime = newTime;
                                                }}
                                                className="w-full h-1 bg-zinc-800 appearance-none cursor-pointer accent-white"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between text-white text-xs">
                                            <div className="flex items-center gap-3">
                                                <button onClick={togglePlayPause} className="hover:text-zinc-300 p-1">
                                                    {isPlaying ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />}
                                                </button>
                                                <button onClick={toggleMute} className="hover:text-zinc-300 p-1">
                                                    {isMuted ? <VolumeOffIcon className="w-4 h-4" /> : <VolumeUpIcon className="w-4 h-4" />}
                                                </button>
                                                <span className="text-[10px] text-zinc-400">
                                                    {formatTime(progress)} / {formatTime(duration)}
                                                </span>
                                            </div>
                                            <button onClick={toggleFullscreen} className="hover:text-zinc-300 p-1">
                                                {isFullscreen ? <ArrowsPointingInIcon className="w-4 h-4" /> : <ArrowsPointingOutIcon className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <img 
                                    src={currentProject.mediaUrl} 
                                    onError={handleImageError} 
                                    alt="Project Visual" 
                                    className="w-full h-full object-cover" 
                                />
                            )
                        ) : (
                            <div className="w-full h-full bg-zinc-900/50 flex items-center justify-center text-zinc-600 text-xs">
                                // LOADING_MEDIA...
                            </div>
                        )}
                    </AspectRatioBox>
                </div>
            )}

            {/* Action Bar (Real Persistent Interactions) */}
            <div className="mt-4 border border-zinc-800 px-4 py-2.5 flex justify-around items-center bg-black font-mono text-xs">
                {/* Like / Upvote */}
                <button 
                    onClick={handleLikeToggle}
                    className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
                        isLiked ? 'text-emerald-400 font-bold' : 'text-zinc-400 hover:text-white'
                    }`}
                    title={isLiked ? "Upvoted" : "Upvote Project"}
                >
                    <ArrowUpIcon className={`w-4 h-4 ${isLiked ? 'text-emerald-400 stroke-2' : ''}`} />
                    <span>{formatNumber(likeCount)}</span>
                </button>

                {/* Views */}
                <div className="flex items-center gap-1.5 text-zinc-500" title="Project views">
                    <TrendingUpIcon className="w-4 h-4" />
                    <span>{formatNumber(currentProject.stats?.views || 0)}</span>
                </div>

                {/* Comments */}
                <button 
                    onClick={() => setIsCommentsOpen(true)}
                    className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    title="View & Post Comments"
                >
                    <ChatBubbleBottomCenterTextIcon className="w-4 h-4" />
                    <span>{formatNumber(currentProject.stats?.comments || 0)}</span>
                </button>

                {/* Share */}
                <button 
                    onClick={handleShare}
                    className="text-zinc-400 hover:text-white transition-colors cursor-pointer p-1"
                    title="Share Project"
                >
                    <ForwardIcon className="w-4 h-4" />
                </button>

                {/* Bookmark */}
                <button 
                    onClick={handleBookmarkToggle}
                    className={`transition-colors cursor-pointer p-1 ${
                        isSaved ? 'text-white font-bold' : 'text-zinc-400 hover:text-white'
                    }`}
                    title={isSaved ? "Saved to Bookmarks" : "Bookmark Project"}
                >
                    <BookmarkIcon className={`w-4 h-4 ${isSaved ? 'fill-current text-white' : ''}`} />
                </button>
            </div>

            {/* Share Copied Toast */}
            {shareToast && (
                <div className="absolute bottom-16 right-5 bg-zinc-900 border border-emerald-500 text-emerald-300 text-xs px-3 py-1.5 shadow-xl animate-fadeIn flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                    <span>Link copied to clipboard!</span>
                </div>
            )}

            {/* Image Zoom Modal */}
            <ImageZoomModal 
                isOpen={Boolean(zoomedImageUrl)} 
                onClose={() => setZoomedImageUrl(null)} 
                imageUrl={zoomedImageUrl || ''} 
            />

            {/* Comment Section Modal */}
            <CommentSection
                post={postEquivalent}
                isOpen={isCommentsOpen}
                onClose={() => setIsCommentsOpen(false)}
                onCommentAdded={() => {
                    setCurrentProject(prev => ({
                        ...prev,
                        stats: {
                            ...prev.stats,
                            comments: (prev.stats?.comments || 0) + 1,
                        }
                    }));
                }}
            />

            {/* Edit Modal */}
            {isEditModalOpen && (
                <EditShowcaseModal
                    isOpen={isEditModalOpen}
                    post={postEquivalent}
                    onClose={() => setIsEditModalOpen(false)}
                    onUpdated={(updatedPost) => {
                        const updatedProj: Project = {
                            ...currentProject,
                            title: updatedPost.title || updatedPost.oneLine,
                            oneLine: updatedPost.oneLine,
                            description: updatedPost.content,
                            category: updatedPost.category,
                            domain: updatedPost.domain,
                            tags: updatedPost.tags,
                            demoUrl: updatedPost.demoUrl,
                            githubUrl: updatedPost.githubUrl,
                            repoUrl: updatedPost.repoUrl,
                            articleUrl: updatedPost.articleUrl,
                            mediaUrl: updatedPost.mediaUrl,
                            mediaType: updatedPost.mediaType,
                            status: updatedPost.status,
                            isPublished: updatedPost.isPublished,
                        };
                        setCurrentProject(updatedProj);
                        onUpdated?.(updatedProj);
                    }}
                />
            )}

            {/* Delete Confirmation Modal */}
            {isDeleteModalOpen && (
                <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
                    <div className="relative w-full max-w-md bg-[#0c0c0e] border border-zinc-800 shadow-2xl p-6 text-white font-mono">
                        <div className="flex items-center justify-between mb-4 border-b border-zinc-800/80 pb-3">
                            <span className="text-xs font-bold text-red-400 uppercase tracking-widest flex items-center gap-2">
                                <TrashIcon className="w-3.5 h-3.5 text-red-400" />
                                // CONFIRM_PROJECT_DELETION
                            </span>
                            <button
                                onClick={() => setIsDeleteModalOpen(false)}
                                disabled={isDeleting}
                                className="text-zinc-500 hover:text-zinc-300 p-1"
                            >
                                <CloseIcon className="w-4 h-4" />
                            </button>
                        </div>

                        <p className="text-xs text-zinc-300 mb-3 leading-relaxed">
                            Are you sure you want to permanently delete this Showcase project? All associated network records will be purged. This action cannot be undone.
                        </p>

                        <div className="p-3 bg-black/60 border border-zinc-800 mb-4">
                            <p className="text-xs font-mono font-bold text-white line-clamp-1 uppercase">
                                {projectTitle}
                            </p>
                            <p className="text-[10px] text-zinc-500 mt-1">
                                TARGET: posts/{currentProject.id}
                            </p>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                onClick={() => setIsDeleteModalOpen(false)}
                                disabled={isDeleting}
                                className="px-4 py-2 border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmDelete}
                                disabled={isDeleting}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs uppercase tracking-wider font-bold transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {isDeleting ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>Deleting...</span>
                                    </>
                                ) : (
                                    <span>Delete Project</span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export const ShowcaseCard = React.memo(ShowcaseCardComponent);
export default ShowcaseCard;
