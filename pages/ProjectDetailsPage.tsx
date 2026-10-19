import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link, useOutletContext } from 'react-router-dom';
import type { Project, PostComment, CollabRole, CollabApplication } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { 
    fetchProjectById, 
    fetchRelatedProjects 
} from '../services/projectDetailService';
import { 
    toggleLikePost, 
    toggleBookmarkPost, 
    incrementPostView, 
    isPostViewRecorded, 
    markPostViewRecorded,
    getUserLikedPostIds,
    getUserSavedPostIds
} from '../services/postService';
import { 
    toggleFollowCreator, 
    getProjectCreatorId,
    checkConnectionStatus
} from '../services/connectionService';
import { 
    subscribeToPostComments, 
    createPostComment 
} from '../services/commentService';
import { formatNumber } from '../utils/formatters';
import { formatRelativeTime } from '../utils/dateUtils';
import { handleImageError } from '../components/utils/imageUtils';
import { useFullscreen } from '../components/hooks/useFullscreen';
import { ImageZoomModal } from '../components/ui/ImageZoomModal';
import { CollabApplicationModal } from '../components/spotlight/CollabApplicationModal';
import { SuggestionCard } from '../components/spotlight/SuggestionCard';
import { 
    CheckBadgeIcon, 
    ArrowUpIcon, 
    BookmarkIcon, 
    ForwardIcon, 
    PlayIcon, 
    PauseIcon, 
    VolumeUpIcon, 
    VolumeOffIcon, 
    ArrowsPointingOutIcon, 
    ArrowsPointingInIcon, 
    GlobeAltIcon, 
    CodeBracketIcon, 
    DocumentTextIcon, 
    ChatBubbleBottomCenterTextIcon,
    SparklesIcon,
    BriefcaseIcon,
    CheckCircleIcon,
    UserPlusIcon,
    UserMinusIcon,
    FireIcon
} from '../components/ui/Icons';

export const ProjectDetailsPage: React.FC = () => {
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();
    const { currentUser, userProfile } = useAuth();

    // Outlet context — may be undefined if accessed outside the protected layout
    const outletContext = useOutletContext<{
        setRightSidebarVariant?: (variant: string) => void;
        setSpotlightBrowseState?: (state: string | null) => void;
        setSpotlightIsBrowsing?: (value: boolean) => void;
    } | null>() ?? {};
    const { setRightSidebarVariant, setSpotlightBrowseState, setSpotlightIsBrowsing } = outletContext;

    // Preserve Browse Projects sidebar panel while this page is mounted
    useEffect(() => {
        setRightSidebarVariant?.('spotlight');
        setSpotlightBrowseState?.('projects');
        setSpotlightIsBrowsing?.(true);
        return () => {
            setRightSidebarVariant?.('default');
            setSpotlightBrowseState?.(null);
            setSpotlightIsBrowsing?.(false);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


    // Core data states
    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Engagement states
    const [isLiked, setIsLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(0);
    const [isSaved, setIsSaved] = useState(false);
    const [viewCount, setViewCount] = useState(0);
    const [isFollowingCreator, setIsFollowingCreator] = useState(false);
    const [followFeedback, setFollowFeedback] = useState<string | null>(null);
    const [shareToast, setShareToast] = useState(false);

    // Related projects
    const [relatedProjects, setRelatedProjects] = useState<Project[]>([]);
    const [relatedLoading, setRelatedLoading] = useState(false);

    // Media & Modals
    const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);
    const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);

    // Video player state
    const videoRef = useRef<HTMLVideoElement>(null);
    const videoContainerRef = useRef<HTMLDivElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1);
    const playbackRates = [0.75, 1, 1.25, 1.5];
    const { isFullscreen, toggleFullscreen } = useFullscreen(videoContainerRef);

    // Comments state
    const [comments, setComments] = useState<PostComment[]>([]);
    const [commentText, setCommentText] = useState('');
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);
    const [commentError, setCommentError] = useState<string | null>(null);

    // 1. Fetch Project Details on Mount / ID Change
    useEffect(() => {
        let isMounted = true;

        async function loadProject() {
            if (!projectId) {
                setError('No project ID provided.');
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const found = await fetchProjectById(projectId);
                if (!isMounted) return;

                if (!found) {
                    setError('Project not found or was removed.');
                    setProject(null);
                    setLoading(false);
                    return;
                }

                setProject(found);
                setLikeCount(found.stats?.likes ?? (found as any).upvotes ?? found.likeCount ?? 0);
                setViewCount(found.stats?.views ?? found.viewCount ?? 1);

                // Record view deduplicated
                if (!isPostViewRecorded(found.id)) {
                    incrementPostView(found.id).catch(() => {});
                    markPostViewRecorded(found.id);
                    setViewCount(prev => prev + 1);
                }

                // Check initial like / save status for logged in user
                if (currentUser?.uid) {
                    getUserLikedPostIds(currentUser.uid).then(likedSet => {
                        if (isMounted) setIsLiked(likedSet.has(found.id));
                    }).catch(() => {});

                    getUserSavedPostIds(currentUser.uid).then(savedSet => {
                        if (isMounted) setIsSaved(savedSet.has(found.id));
                    }).catch(() => {});

                    const creatorId = getProjectCreatorId(found);
                    if (creatorId && creatorId !== currentUser.uid) {
                        checkConnectionStatus(currentUser.uid, creatorId).then(status => {
                            if (isMounted) setIsFollowingCreator(status.isConnected);
                        }).catch(() => {});
                    }
                }

                // Fetch related projects
                setRelatedLoading(true);
                fetchRelatedProjects(found).then(related => {
                    if (isMounted) {
                        setRelatedProjects(related);
                        setRelatedLoading(false);
                    }
                }).catch(err => {
                    console.warn('[RELATED_PROJECTS_ERR]', err);
                    if (isMounted) setRelatedLoading(false);
                });

            } catch (err: any) {
                console.error('[LOAD_PROJECT_ERR]', err);
                if (isMounted) {
                    setError(err?.message || 'Failed to load project details.');
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        loadProject();

        return () => {
            isMounted = false;
        };
    }, [projectId, currentUser?.uid]);

    // 2. Real-time Comments Subscription
    useEffect(() => {
        if (!projectId) return;

        const unsubscribe = subscribeToPostComments(
            projectId,
            (newComments) => {
                setComments(newComments);
            },
            (err) => {
                console.warn('[COMMENTS_SUB_ERR]', err);
            }
        );

        return () => {
            unsubscribe();
        };
    }, [projectId]);

    // Video Player Handlers
    const togglePlay = () => {
        if (videoRef.current) {
            if (videoRef.current.paused) {
                videoRef.current.play();
                setIsPlaying(true);
            } else {
                videoRef.current.pause();
                setIsPlaying(false);
            }
        }
    };

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            setProgress((videoRef.current.currentTime / videoRef.current.duration) * 100);
        }
    };

    const handleLoadedMetadata = () => {
        if (videoRef.current) {
            setDuration(videoRef.current.duration);
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (videoRef.current) {
            const time = (parseFloat(e.target.value) / 100) * duration;
            videoRef.current.currentTime = time;
            setProgress(parseFloat(e.target.value));
        }
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        setVolume(val);
        if (videoRef.current) {
            videoRef.current.volume = val;
            setIsMuted(val === 0);
        }
    };

    const toggleMute = () => {
        if (videoRef.current) {
            if (isMuted) {
                videoRef.current.muted = false;
                videoRef.current.volume = volume || 1;
                setIsMuted(false);
            } else {
                videoRef.current.muted = true;
                setIsMuted(true);
            }
        }
    };

    const changePlaybackRate = (rate: number) => {
        if (videoRef.current) {
            videoRef.current.playbackRate = rate;
            setPlaybackRate(rate);
        }
    };

    // Upvote / Like Action
    const handleToggleLike = async () => {
        if (!project) return;
        if (!currentUser) {
            navigate('/login');
            return;
        }

        const wasLiked = isLiked;
        setIsLiked(!wasLiked);
        setLikeCount(prev => wasLiked ? Math.max(0, prev - 1) : prev + 1);

        try {
            await toggleLikePost(project.id);
        } catch (e) {
            console.error('[LIKE_POST_ERR]', e);
            // Rollback on error
            setIsLiked(wasLiked);
            setLikeCount(prev => wasLiked ? prev + 1 : Math.max(0, prev - 1));
        }
    };

    // Save / Bookmark Action
    const handleToggleSave = async () => {
        if (!project) return;
        if (!currentUser) {
            navigate('/login');
            return;
        }

        const wasSaved = isSaved;
        setIsSaved(!wasSaved);

        try {
            await toggleBookmarkPost(project.id);
        } catch (e) {
            console.error('[SAVE_POST_ERR]', e);
            setIsSaved(wasSaved);
        }
    };

    // Follow Creator Action
    const handleToggleFollow = async () => {
        if (!project || !currentUser) {
            navigate('/login');
            return;
        }

        const creatorId = getProjectCreatorId(project);
        if (!creatorId || creatorId === currentUser.uid) return;

        const nextFollowState = !isFollowingCreator;
        setIsFollowingCreator(nextFollowState);
        setFollowFeedback(nextFollowState ? 'Following' : 'Unfollowed');
        setTimeout(() => setFollowFeedback(null), 2500);

        try {
            await toggleFollowCreator({
                currentUser,
                currentUserProfile: userProfile,
                targetCreatorId: creatorId
            });
        } catch (e) {
            console.error('[FOLLOW_CREATOR_ERR]', e);
            setIsFollowingCreator(!nextFollowState);
        }
    };

    // Share Project Action
    const handleShare = () => {
        if (!project) return;
        const currentUrl = window.location.href;
        navigator.clipboard.writeText(currentUrl).then(() => {
            setShareToast(true);
            setTimeout(() => setShareToast(false), 3000);
        }).catch(() => {
            setShareToast(true);
            setTimeout(() => setShareToast(false), 3000);
        });
    };

    // Submit Comment Action
    const handleCommentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!project || !currentUser) {
            navigate('/login');
            return;
        }

        const text = commentText.trim();
        if (!text) return;

        setIsSubmittingComment(true);
        setCommentError(null);

        try {
            await createPostComment({
                postId: project.id,
                targetId: project.id,
                targetType: 'post',
                text,
                type: 'comment',
                authorId: currentUser.uid,
                authorName: userProfile?.displayName || currentUser.displayName || 'Invox Member',
                authorAvatar: userProfile?.photoURL || currentUser.photoURL || `https://picsum.photos/seed/${currentUser.uid}/200`,
                authorUsername: userProfile?.username || currentUser.email?.split('@')[0] || undefined
            });

            setCommentText('');
        } catch (err: any) {
            console.error('[SUBMIT_COMMENT_ERR]', err);
            setCommentError('Could not post comment. Please try again.');
        } finally {
            setIsSubmittingComment(false);
        }
    };

    // Computed Properties
    const creatorId = useMemo(() => {
        if (!project) return undefined;
        return getProjectCreatorId(project) || project.author?.id || project.author?.uid;
    }, [project]);

    const isCollab = useMemo(() => {
        if (!project) return false;
        return Boolean(
            project.collabDetails || 
            project.category === 'Collabs' || 
            (project as any).type === 'collab'
        );
    }, [project]);

    const projectTitle = useMemo(() => {
        if (!project) return 'Untitled Project';
        const raw = project.title || (project as any).collabTitle || (project as any).projectTitle || project.name;
        return raw && raw.trim() && raw.trim().toLowerCase() !== 'undefined' ? raw.trim() : 'Untitled Project';
    }, [project]);

    const projectHook = useMemo(() => {
        if (!project) return '';
        const raw = project.hook || project.oneLine || (project as any).collabHook || project.aiSummary;
        if (raw && raw.trim() && raw.trim().toLowerCase() !== 'undefined') return raw.trim();
        if (project.description && project.description.trim()) return project.description.trim().slice(0, 160) + '...';
        return '';
    }, [project]);

    const isVideo = useMemo(() => {
        if (!project) return false;
        return project.mediaType === 'video' || (project.mediaUrl && project.mediaUrl.match(/\.(mp4|webm|mov)$/i));
    }, [project]);

    // Format helper for video duration
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    // Loading State
    if (loading) {
        return (
            <div className="min-h-[70vh] flex flex-col justify-center items-center py-12 px-4">
                <div className="w-12 h-12 border-2 border-zinc-800 border-t-white animate-spin mb-4" />
                <p className="font-mono text-xs uppercase tracking-widest text-zinc-500 animate-pulse">
                    // LOADING_PROJECT_ARCHIVE_{projectId}...
                </p>
            </div>
        );
    }

    // Error / 404 State
    if (error || !project) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 bg-[#0c0c0e] border border-zinc-800 my-8">
                <div className="w-16 h-16 border border-zinc-800 flex items-center justify-center text-zinc-600 mb-4 font-mono text-2xl font-bold">
                    !
                </div>
                <h2 className="text-xl font-bold font-mono text-white mb-2 uppercase tracking-wide">
                    // 404_PROJECT_NOT_FOUND
                </h2>
                <p className="text-zinc-400 font-mono text-xs max-w-md mb-6 leading-relaxed">
                    {error || 'The requested project could not be found or may have been archived.'}
                </p>
                <div className="flex gap-3">
                    <button
                        onClick={() => navigate('/spotlight')}
                        className="px-5 py-2.5 bg-white text-black font-mono text-xs uppercase font-bold tracking-wider hover:bg-zinc-200 transition-colors"
                    >
                        ← Return to Spotlight
                    </button>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-5 py-2.5 bg-zinc-900 border border-zinc-700 text-white font-mono text-xs uppercase font-semibold tracking-wider hover:border-zinc-500 transition-colors"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-16">
            {/* Main Project Details Card */}
            <article className="bg-[#0c0c0e] border border-zinc-800 p-6 md:p-8 space-y-8">
                {/* Header: Title + Hook + Creator Profile */}
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2.5">
                        {project.category && (
                            <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 bg-zinc-900 border border-zinc-800 px-3 py-1">
                                {project.category}
                            </span>
                        )}
                        {project.domain && project.domain !== project.category && (
                            <span className="text-xs font-mono uppercase tracking-wider text-zinc-500 bg-zinc-900 border border-zinc-800 px-3 py-1">
                                {project.domain}
                            </span>
                        )}
                    </div>

                    <h1 className="text-2xl md:text-4xl font-mono font-bold text-white uppercase tracking-tight leading-tight">
                        {projectTitle}
                    </h1>

                    {projectHook && (
                        <div className="p-4 bg-zinc-950/80 border-l-2 border-indigo-500 text-zinc-300 font-mono text-sm md:text-base leading-relaxed">
                            {projectHook}
                        </div>
                    )}

                    {/* Creator Identity Row */}
                    <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-zinc-800/80">
                        <div className="flex items-center gap-3">
                            <Link 
                                to={creatorId ? `/profile/${creatorId}` : '#'}
                                className="w-11 h-11 bg-zinc-900 border border-zinc-700 overflow-hidden flex-shrink-0 hover:border-zinc-400 transition-colors cursor-pointer group"
                            >
                                {project.author?.avatarUrl ? (
                                    <img 
                                        src={project.author.avatarUrl} 
                                        onError={handleImageError} 
                                        alt={project.author?.name || 'Creator'} 
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-zinc-500">
                                        <BriefcaseIcon className="w-5 h-5" />
                                    </div>
                                )}
                            </Link>
                            <div>
                                <div className="flex items-center gap-1.5">
                                    <Link 
                                        to={creatorId ? `/profile/${creatorId}` : '#'}
                                        className="text-sm font-mono font-bold text-white hover:text-zinc-300 transition-colors"
                                    >
                                        {project.author?.name || 'Invox Member'}
                                    </Link>
                                    {project.author?.isVerified && (
                                        <CheckBadgeIcon className="w-4 h-4 text-sky-400" />
                                    )}
                                </div>
                                <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
                                    {project.author?.username && (
                                        <span>@{project.author.username}</span>
                                    )}
                                    <span>•</span>
                                    <span>{formatRelativeTime(project.createdAt || new Date())}</span>
                                </div>
                            </div>
                        </div>

                        {/* Follow Creator Button (if not viewing self) */}
                        {currentUser && creatorId && creatorId !== currentUser.uid && (
                            <button
                                onClick={handleToggleFollow}
                                className={`flex items-center gap-2 px-3.5 py-1.5 font-mono text-xs uppercase tracking-wider font-semibold border transition-all ${
                                    isFollowingCreator 
                                        ? 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-red-800 hover:text-red-400' 
                                        : 'bg-white text-black border-white hover:bg-zinc-200'
                                }`}
                            >
                                {isFollowingCreator ? (
                                    <>
                                        <UserMinusIcon className="w-3.5 h-3.5" />
                                        <span>Following</span>
                                    </>
                                ) : (
                                    <>
                                        <UserPlusIcon className="w-3.5 h-3.5" />
                                        <span>Follow Creator</span>
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {/* Primary Media (Video or Image) */}
                {project.mediaUrl && (
                    <div className="border border-zinc-800 overflow-hidden bg-black">
                        {isVideo ? (
                            <div 
                                ref={videoContainerRef} 
                                className="relative group/video bg-black flex items-center justify-center min-h-[320px] max-h-[580px] w-full"
                            >
                                <video 
                                    ref={videoRef}
                                    src={project.mediaUrl}
                                    poster={project.thumbnailUrl}
                                    className="w-full max-h-[580px] object-contain cursor-pointer"
                                    onClick={togglePlay}
                                    onTimeUpdate={handleTimeUpdate}
                                    onLoadedMetadata={handleLoadedMetadata}
                                    playsInline
                                />

                                {/* Play/Pause Center Overlay */}
                                {!isPlaying && (
                                    <button 
                                        onClick={togglePlay} 
                                        className="absolute p-4 rounded-full bg-black/60 border border-white/20 text-white hover:scale-110 transition-transform cursor-pointer"
                                        aria-label="Play video"
                                    >
                                        <PlayIcon className="w-10 h-10 fill-current" />
                                    </button>
                                )}

                                {/* Video Controls Bar */}
                                <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 via-black/60 to-transparent flex flex-col gap-2 opacity-90 group-hover/video:opacity-100 transition-opacity">
                                    <input 
                                        type="range" 
                                        min="0" 
                                        max="100" 
                                        value={progress} 
                                        onChange={handleSeek}
                                        className="w-full h-1 bg-zinc-700 accent-white cursor-pointer" 
                                    />
                                    <div className="flex items-center justify-between text-xs font-mono text-zinc-300">
                                        <div className="flex items-center gap-3">
                                            <button onClick={togglePlay} className="hover:text-white cursor-pointer">
                                                {isPlaying ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />}
                                            </button>
                                            <div className="flex items-center gap-1.5">
                                                <button onClick={toggleMute} className="hover:text-white cursor-pointer">
                                                    {isMuted ? <VolumeOffIcon className="w-4 h-4" /> : <VolumeUpIcon className="w-4 h-4" />}
                                                </button>
                                                <input 
                                                    type="range" 
                                                    min="0" 
                                                    max="1" 
                                                    step="0.05"
                                                    value={isMuted ? 0 : volume} 
                                                    onChange={handleVolumeChange} 
                                                    className="w-16 h-1 bg-zinc-700 accent-white cursor-pointer" 
                                                />
                                            </div>
                                            <span>
                                                {videoRef.current ? formatTime(videoRef.current.currentTime) : '0:00'} / {formatTime(duration)}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {playbackRates.map(rate => (
                                                <button 
                                                    key={rate}
                                                    onClick={() => changePlaybackRate(rate)}
                                                    className={`px-1.5 py-0.5 rounded text-[10px] ${playbackRate === rate ? 'bg-white text-black font-bold' : 'text-zinc-400 hover:text-white'}`}
                                                >
                                                    {rate}x
                                                </button>
                                            ))}
                                            <button onClick={toggleFullscreen} className="hover:text-white ml-2 cursor-pointer">
                                                {isFullscreen ? <ArrowsPointingInIcon className="w-4 h-4" /> : <ArrowsPointingOutIcon className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div 
                                onClick={() => setZoomedImageUrl(project.mediaUrl!)} 
                                className="relative group/img cursor-zoom-in max-h-[580px] bg-zinc-950 flex items-center justify-center overflow-hidden"
                            >
                                <img 
                                    src={project.mediaUrl} 
                                    onError={handleImageError} 
                                    alt={projectTitle} 
                                    className="max-h-[580px] w-full object-contain group-hover/img:scale-[1.01] transition-transform duration-300"
                                />
                                <div className="absolute bottom-3 right-3 bg-black/70 border border-zinc-700 text-zinc-300 px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider flex items-center gap-1.5 opacity-0 group-hover/img:opacity-100 transition-opacity">
                                    <span>CLICK TO ZOOM</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Engagement & External Links Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-zinc-950 border border-zinc-800">
                    {/* Left: Engagement Stats & Triggers */}
                    <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
                        <button
                            onClick={handleToggleLike}
                            className={`flex items-center gap-2 px-3 py-2 border transition-all cursor-pointer ${
                                isLiked 
                                    ? 'bg-rose-950/40 border-rose-600 text-rose-400' 
                                    : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-600 hover:text-white'
                            }`}
                            title="Upvote Project"
                        >
                            <ArrowUpIcon className={`w-4 h-4 ${isLiked ? 'text-rose-400' : 'text-zinc-400'}`} />
                            <span className="font-bold">{formatNumber(likeCount)}</span>
                            <span className="text-[10px] text-zinc-500 uppercase">UPVOTES</span>
                        </button>

                        <button
                            onClick={handleToggleSave}
                            className={`flex items-center gap-2 px-3 py-2 border transition-all cursor-pointer ${
                                isSaved 
                                    ? 'bg-amber-950/40 border-amber-600 text-amber-400' 
                                    : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-600 hover:text-white'
                            }`}
                            title="Bookmark Project"
                        >
                            <BookmarkIcon className={`w-4 h-4 ${isSaved ? 'text-amber-400' : 'text-zinc-400'}`} />
                            <span className="text-[10px] uppercase font-semibold">{isSaved ? 'SAVED' : 'SAVE'}</span>
                        </button>

                        <button
                            onClick={handleShare}
                            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:border-zinc-600 hover:text-white transition-all cursor-pointer"
                            title="Share Project Link"
                        >
                            <ForwardIcon className="w-4 h-4 text-zinc-400" />
                            <span className="text-[10px] uppercase font-semibold">
                                {shareToast ? 'COPIED!' : 'SHARE'}
                            </span>
                        </button>

                        <div className="flex items-center gap-1.5 px-3 py-2 text-zinc-500 text-[11px]">
                            <span>VIEWS:</span>
                            <span className="text-zinc-300 font-bold">{formatNumber(viewCount)}</span>
                        </div>
                    </div>

                    {/* Right: External Project Links */}
                    <div className="flex flex-wrap items-center gap-2">
                        {project.demoUrl && (
                            <a 
                                href={project.demoUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-3.5 py-2 bg-white text-black font-mono text-xs uppercase font-bold tracking-wider hover:bg-zinc-200 transition-colors"
                            >
                                <GlobeAltIcon className="w-4 h-4" />
                                <span>Live Demo ↗</span>
                            </a>
                        )}

                        {(project.githubUrl || project.repoUrl) && (
                            <a 
                                href={project.githubUrl || project.repoUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-3.5 py-2 bg-zinc-900 border border-zinc-700 text-white font-mono text-xs uppercase font-semibold tracking-wider hover:border-zinc-500 transition-colors"
                            >
                                <CodeBracketIcon className="w-4 h-4" />
                                <span>Repository ↗</span>
                            </a>
                        )}

                        {project.articleUrl && (
                            <a 
                                href={project.articleUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-3.5 py-2 bg-zinc-900 border border-zinc-700 text-white font-mono text-xs uppercase font-semibold tracking-wider hover:border-zinc-500 transition-colors"
                            >
                                <DocumentTextIcon className="w-4 h-4" />
                                <span>Documentation ↗</span>
                            </a>
                        )}
                    </div>
                </div>

                {/* Project Description */}
                <div className="space-y-4">
                    <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-800 pb-2 flex items-center gap-2">
                        <span>// PROJECT_SPECIFICATION</span>
                    </h3>
                    <div className="text-sm font-mono text-zinc-300 leading-relaxed whitespace-pre-line space-y-4">
                        {project.description || 'No detailed specification provided.'}
                    </div>
                </div>

                {/* Collab Details / Open Roles (If Collab Project) */}
                {isCollab && project.collabDetails && (
                    <div className="border border-purple-900/60 bg-purple-950/20 p-6 space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-purple-900/40 pb-4">
                            <div>
                                <h3 className="font-mono text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                    <BriefcaseIcon className="w-4 h-4 text-purple-400" />
                                    <span>OPEN_COLLABORATION_ROLES</span>
                                </h3>
                                <p className="font-mono text-xs text-purple-300/70 mt-1">
                                    Contribute to this team project. Open roles and required proficiencies:
                                </p>
                            </div>
                            <button
                                onClick={() => setIsApplyModalOpen(true)}
                                className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs uppercase font-bold tracking-wider transition-colors cursor-pointer"
                            >
                                Apply to Collab
                            </button>
                        </div>

                        {/* Roles List */}
                        {project.collabDetails.roles && project.collabDetails.roles.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {project.collabDetails.roles.map((role: CollabRole, index: number) => (
                                    <div key={role.id || index} className="p-4 bg-black/60 border border-purple-900/50 space-y-2">
                                        <div className="flex justify-between items-start">
                                            <h4 className="font-mono font-bold text-sm text-purple-200 uppercase">
                                                {role.title}
                                            </h4>
                                            <span className="text-[11px] font-mono text-purple-400 bg-purple-950/80 px-2 py-0.5 border border-purple-800/60">
                                                {role.count} spot{Number(role.count) > 1 ? 's' : ''}
                                            </span>
                                        </div>
                                        {role.responsibilities && (
                                            <p className="text-xs font-mono text-zinc-400 leading-relaxed">
                                                {role.responsibilities}
                                            </p>
                                        )}
                                        {role.skills && role.skills.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 pt-2">
                                                {role.skills.map((skill: string, sIdx: number) => (
                                                    <span key={sIdx} className="text-[10px] font-mono text-zinc-300 bg-zinc-900 px-2 py-0.5 border border-zinc-800">
                                                        {skill}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Metadata pills */}
                        <div className="flex flex-wrap gap-4 text-xs font-mono text-zinc-400 pt-2 border-t border-purple-900/40">
                            {project.collabDetails.experience && (
                                <div><span className="text-purple-400">EXP:</span> {project.collabDetails.experience}</div>
                            )}
                            {project.collabDetails.availability && (
                                <div><span className="text-purple-400">TIME:</span> {project.collabDetails.availability}</div>
                            )}
                            {project.collabDetails.projectStatus && (
                                <div><span className="text-purple-400">STATUS:</span> {project.collabDetails.projectStatus}</div>
                            )}
                        </div>
                    </div>
                )}

                {/* Tags & Technologies */}
                {project.tags && project.tags.length > 0 && (
                    <div className="space-y-3 pt-2">
                        <h4 className="font-mono text-xs uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                            <span className="text-zinc-500 font-bold">#</span>
                            <span>TAGS & TECHNOLOGIES</span>
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {project.tags.map((tag, idx) => (
                                <span 
                                    key={idx}
                                    className="px-2.5 py-1 bg-zinc-950 border border-zinc-800 text-zinc-300 font-mono text-xs uppercase tracking-wider"
                                >
                                    #{tag}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Project Comments & Discussions Section */}
                <div className="space-y-6 pt-4 border-t border-zinc-800">
                    <div className="flex items-center justify-between">
                        <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                            <ChatBubbleBottomCenterTextIcon className="w-4 h-4 text-zinc-400" />
                            <span>// PROJECT_DISCUSSIONS ({comments.length})</span>
                        </h3>
                    </div>

                    {/* New Comment Form */}
                    {currentUser ? (
                        <form onSubmit={handleCommentSubmit} className="space-y-3">
                            <div className="relative">
                                <textarea
                                    value={commentText}
                                    onChange={(e) => setCommentText(e.target.value)}
                                    placeholder="Add feedback, ask a question, or share technical insight..."
                                    rows={3}
                                    className="w-full bg-zinc-950 border border-zinc-800 p-3 text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
                                />
                            </div>
                            {commentError && (
                                <p className="text-xs font-mono text-rose-500">{commentError}</p>
                            )}
                            <div className="flex justify-end">
                                <button
                                    type="submit"
                                    disabled={isSubmittingComment || !commentText.trim()}
                                    className="px-4 py-2 bg-white text-black font-mono text-xs uppercase font-bold tracking-wider hover:bg-zinc-200 disabled:opacity-50 transition-colors cursor-pointer"
                                >
                                    {isSubmittingComment ? 'Posting...' : 'Post Comment'}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div className="p-4 bg-zinc-950 border border-zinc-800 text-center text-xs font-mono text-zinc-500">
                            Please{' '}
                            <Link to="/login" className="text-white underline hover:text-zinc-300">
                                sign in
                            </Link>{' '}
                            to participate in project discussions.
                        </div>
                    )}

                    {/* Comment Stream */}
                    {comments.length > 0 ? (
                        <div className="space-y-3 max-h-96 overflow-y-auto no-scrollbar">
                            {comments.map((comment) => (
                                <div 
                                    key={comment.id}
                                    className="p-3.5 bg-zinc-950/70 border border-zinc-800/80 space-y-2"
                                >
                                    <div className="flex items-center justify-between text-xs font-mono">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 bg-zinc-800 border border-zinc-700 overflow-hidden flex-shrink-0">
                                                {comment.authorAvatar ? (
                                                    <img 
                                                        src={comment.authorAvatar} 
                                                        onError={handleImageError} 
                                                        alt={comment.authorName} 
                                                        className="w-full h-full object-cover" 
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-[10px] text-zinc-400 font-bold">
                                                        {comment.authorName?.charAt(0) || 'U'}
                                                    </div>
                                                )}
                                            </div>
                                            <span className="font-bold text-white">{comment.authorName}</span>
                                            {comment.authorUsername && (
                                                <span className="text-zinc-500">@{comment.authorUsername}</span>
                                            )}
                                        </div>
                                        <span className="text-zinc-500 text-[11px]">
                                            {formatRelativeTime(comment.createdAt || new Date())}
                                        </span>
                                    </div>
                                    <p className="text-xs font-mono text-zinc-300 leading-relaxed pl-8">
                                        {comment.text}
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-6 text-zinc-500 font-mono text-xs border border-dashed border-zinc-800">
                            No comments posted yet. Be the first to share an insight!
                        </div>
                    )}
                </div>
            </article>

            {/* Related Projects Section */}
            <section className="space-y-4 pt-4 border-t border-zinc-800">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                        <h2 className="text-lg md:text-xl font-mono font-bold text-white uppercase tracking-tight flex items-center gap-2">
                            <span>// RELATED_PROJECTS</span>
                            <span className="text-xs font-normal text-zinc-500">
                                ({relatedProjects.length})
                            </span>
                        </h2>
                        <p className="text-xs font-mono text-zinc-500 mt-1">
                            Curated {isCollab ? 'collaboration proposals' : 'showcase initiatives'} based on category, domain, and technical stack.
                        </p>
                    </div>
                </div>

                {relatedLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[1, 2].map((i) => (
                            <div key={i} className="h-48 bg-[#0c0c0e] border border-zinc-800 animate-pulse p-4">
                                <div className="h-4 w-28 bg-zinc-800 mb-3" />
                                <div className="h-3 w-48 bg-zinc-800 mb-4" />
                                <div className="h-16 w-full bg-zinc-900" />
                            </div>
                        ))}
                    </div>
                ) : relatedProjects.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {relatedProjects.map((relProj) => (
                            <SuggestionCard 
                                key={relProj.id} 
                                project={relProj} 
                                openInNewTab={false}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="p-8 text-center bg-[#0c0c0e] border border-zinc-800 text-zinc-500 font-mono text-xs">
                        No other related {isCollab ? 'collabs' : 'showcase projects'} found in this category right now.
                    </div>
                )}
            </section>

            {/* Modals */}
            {zoomedImageUrl && (
                <ImageZoomModal 
                    isOpen={Boolean(zoomedImageUrl)} 
                    imageUrl={zoomedImageUrl} 
                    onClose={() => setZoomedImageUrl(null)} 
                />
            )}

            {isApplyModalOpen && project && (
                <CollabApplicationModal
                    isOpen={isApplyModalOpen}
                    collab={project}
                    onClose={() => setIsApplyModalOpen(false)}
                    onApplied={() => {
                        setIsApplyModalOpen(false);
                    }}
                />
            )}
        </div>
    );
};

export default ProjectDetailsPage;
