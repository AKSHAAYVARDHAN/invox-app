import React, { useState, useEffect, useMemo } from 'react';
import type { StreamLoop, Post } from '../../types';
import { PostType } from '../../types';
import { 
    EllipsisVerticalIcon, 
    HeartIcon, 
    TrendingUpIcon, 
    ChatBubbleBottomCenterTextIcon, 
    ForwardIcon, 
    BookmarkIcon, 
    CheckBadgeIcon, 
    ArrowUpRightIcon,
    TrashIcon,
    PencilSquareIcon,
    SparklesIcon
} from '../ui/Icons';
import { handleImageError } from '../utils/imageUtils';
import ImageZoomModal from '../ui/ImageZoomModal';
import { toggleLikePost, toggleBookmarkPost, incrementPostView, toggleStrikeLoop } from '../../services/postService';
import { CommentSection } from '../feed/CommentSection';
import { formatRelativeTime } from '../../utils/dateUtils';
import { useAuth } from '../../contexts/AuthContext';

interface LoopCardProps {
    loop: StreamLoop;
    userLiked?: boolean;
    userSaved?: boolean;
    userStruck?: boolean;
    onEdit?: (loop: StreamLoop) => void;
    onDelete?: (loopId: string) => void;
}

const formatNumber = (num: number) => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num;
};

const LoopCard: React.FC<LoopCardProps> = ({ 
    loop, 
    userLiked = false, 
    userSaved = false,
    userStruck = false,
    onEdit,
    onDelete,
}) => {
    const { currentUser } = useAuth();
    const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);

    // Engagement state
    const [isLiked, setIsLiked] = useState<boolean>(Boolean(userLiked || loop.userLiked));
    const [likesCount, setLikesCount] = useState<number>(Number(loop.stats?.likes ?? loop.likes ?? 0));
    const [isSaved, setIsSaved] = useState<boolean>(Boolean(userSaved || loop.userSaved));
    const [viewsCount, setViewsCount] = useState<number>(Number(loop.stats?.views ?? loop.views ?? 0));
    const [commentsCount, setCommentsCount] = useState<number>(Number(loop.stats?.comments ?? loop.comments ?? 0));
    const [isStruck, setIsStruck] = useState<boolean>(Boolean(userStruck || loop.userStruck));
    const [strikesCount, setStrikesCount] = useState<number>(Number(loop.stats?.strikes ?? loop.strikes ?? 0));
    const [showComments, setShowComments] = useState<boolean>(false);
    const [shareFeedback, setShareFeedback] = useState<string | null>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [showMore, setShowMore] = useState(false);
    const [strikeAnimation, setStrikeAnimation] = useState(false);

    // Sync state if props change
    useEffect(() => {
        setIsLiked(Boolean(userLiked || loop.userLiked));
    }, [userLiked, loop.userLiked]);

    useEffect(() => {
        setIsSaved(Boolean(userSaved || loop.userSaved));
    }, [userSaved, loop.userSaved]);

    useEffect(() => {
        setIsStruck(Boolean(userStruck || loop.userStruck));
    }, [userStruck, loop.userStruck]);

    // View tracking deduplication
    useEffect(() => {
        if (!loop.id || loop.id.startsWith('loop-mock')) return;
        incrementPostView(loop.id).then(counted => {
            if (counted) {
                setViewsCount(prev => prev + 1);
            }
        });
    }, [loop.id]);

    const isAuthor = Boolean(
        currentUser?.uid && (
            loop.authorId === currentUser.uid ||
            loop.author?.uid === currentUser.uid
        )
    );

    const headlineText = loop.headline || loop.title || '';
    const contentText = loop.description || loop.content || '';
    const isLongContent = contentText.length > 180;
    const mediaSource = loop.imageUrl || loop.mediaUrl || '';

    // Handle like toggle
    const handleLike = async () => {
        if (!currentUser) return;
        const newLikedState = !isLiked;
        setIsLiked(newLikedState);
        setLikesCount(prev => Math.max(0, newLikedState ? prev + 1 : prev - 1));

        if (!loop.id.startsWith('loop-mock')) {
            try {
                await toggleLikePost(loop.id);
            } catch (err) {
                console.warn('[LOOP_LIKE_ERROR]', err);
                setIsLiked(!newLikedState);
                setLikesCount(prev => (newLikedState ? prev - 1 : prev + 1));
            }
        }
    };

    // Handle bookmark toggle
    const handleBookmark = async () => {
        if (!currentUser) return;
        const newSavedState = !isSaved;
        setIsSaved(newSavedState);

        if (!loop.id.startsWith('loop-mock')) {
            try {
                await toggleBookmarkPost(loop.id);
            } catch (err) {
                console.warn('[LOOP_BOOKMARK_ERROR]', err);
                setIsSaved(!newSavedState);
            }
        }
    };

    // Handle Strike action (PencilSwoosh)
    const handleStrike = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!currentUser) return;

        setStrikeAnimation(true);
        setTimeout(() => setStrikeAnimation(false), 600);

        const newStruckState = !isStruck;
        setIsStruck(newStruckState);
        setStrikesCount(prev => Math.max(0, newStruckState ? prev + 1 : prev - 1));

        if (!loop.id.startsWith('loop-mock')) {
            try {
                const res = await toggleStrikeLoop(loop.id);
                setStrikesCount(res.strikeCount);
                setIsStruck(res.struck);
            } catch (err) {
                console.warn('[LOOP_STRIKE_ERROR]', err);
                setIsStruck(!newStruckState);
                setStrikesCount(prev => (newStruckState ? prev - 1 : prev + 1));
            }
        }
    };

    // Handle share copy
    const handleShare = (e: React.MouseEvent) => {
        e.stopPropagation();
        const loopUrl = `${window.location.origin}/#/hub?tab=stream&loopId=${loop.id}`;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(loopUrl).then(() => {
                setShareFeedback('COPIED');
                setTimeout(() => setShareFeedback(null), 2500);
            }).catch(() => {
                setShareFeedback('COPIED');
                setTimeout(() => setShareFeedback(null), 2500);
            });
        }
    };

    // Adapter for comment section
    const postForComment: Post = useMemo(() => ({
        id: loop.id,
        authorId: loop.authorId || loop.author?.uid,
        author: {
            name: loop.author?.name || 'Invox Member',
            avatarUrl: loop.author?.avatarUrl || '',
            username: loop.author?.username,
            isVerified: loop.author?.isVerified,
            uid: loop.author?.uid,
        },
        title: headlineText,
        aiSummary: headlineText,
        oneLine: headlineText,
        hook: headlineText,
        content: contentText,
        mediaUrl: mediaSource || undefined,
        stats: {
            likes: likesCount,
            views: viewsCount,
            comments: commentsCount,
        },
        likeCount: likesCount,
        viewCount: viewsCount,
        commentCount: commentsCount,
        type: PostType.Loop,
        category: loop.category,
        createdAt: loop.createdAt instanceof Date ? loop.createdAt : new Date(loop.createdAt || Date.now()),
    }), [loop, headlineText, contentText, mediaSource, likesCount, viewsCount, commentsCount]);

    const formattedDate = useMemo(() => {
        if (!loop.createdAt) return 'RECENT';
        const d = loop.createdAt instanceof Date ? loop.createdAt : new Date(loop.createdAt);
        return formatRelativeTime(d);
    }, [loop.createdAt]);

    // Category styling badge
    const categoryBadgeStyle = useMemo(() => {
        const cat = loop.category.toLowerCase();
        if (cat === 'zaps') return 'text-amber-400 border-amber-900/80 bg-amber-950/20';
        if (cat === 'thoughts' || cat === 'thought') return 'text-sky-400 border-sky-900/80 bg-sky-950/20';
        if (cat === 'music') return 'text-violet-400 border-violet-900/80 bg-violet-950/20';
        return 'text-emerald-400 border-emerald-900/80 bg-emerald-950/20';
    }, [loop.category]);

    return (
        <>
            <div className="bg-[#0c0c0e] border border-zinc-800 flex flex-col h-full hover:border-zinc-700 transition-colors group/card relative font-mono">
                {/* Header Row */}
                <div className="flex items-center justify-between p-3.5 border-b border-zinc-800/80 bg-[#0a0a0c]">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <img 
                            src={loop.author.avatarUrl} 
                            onError={handleImageError} 
                            alt={loop.author.name} 
                            className="w-7 h-7 object-cover border border-zinc-700 flex-shrink-0" 
                        />
                        <div className="min-w-0 truncate">
                            <div className="flex items-center gap-1.5 truncate">
                                <p className="font-bold text-white text-xs uppercase tracking-wider truncate">
                                    {loop.author.name}
                                </p>
                                {loop.author.isVerified && (
                                    <CheckBadgeIcon className="w-3.5 h-3.5 text-zinc-300 flex-shrink-0" />
                                )}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-zinc-500 tracking-wider">
                                <span>{loop.author.username ? `@${loop.author.username.replace(/^@/, '')}` : '@node'}</span>
                                <span>•</span>
                                <span>{formattedDate}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-[10px] uppercase px-2 py-0.5 border font-bold tracking-widest ${categoryBadgeStyle}`}>
                            // {loop.category.toUpperCase()}
                        </span>

                        {/* Author/Options Menu */}
                        <div className="relative">
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsMenuOpen(!isMenuOpen);
                                }}
                                className="text-zinc-500 hover:text-white transition-colors p-1"
                                title="Options"
                            >
                                <EllipsisVerticalIcon className="w-4 h-4" />
                            </button>

                            {isMenuOpen && (
                                <div 
                                    className="absolute right-0 mt-1 w-36 bg-[#0c0c0e] border border-zinc-800 shadow-2xl py-1 z-30 font-mono text-xs"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {isAuthor && onEdit && (
                                        <button
                                            onClick={() => {
                                                setIsMenuOpen(false);
                                                onEdit(loop);
                                            }}
                                            className="w-full text-left px-3 py-1.5 text-zinc-300 hover:text-white hover:bg-zinc-900 uppercase flex items-center gap-2"
                                        >
                                            <PencilSquareIcon className="w-3.5 h-3.5 text-zinc-400" />
                                            <span>// EDIT</span>
                                        </button>
                                    )}
                                    {isAuthor && onDelete && (
                                        <button
                                            onClick={() => {
                                                setIsMenuOpen(false);
                                                onDelete(loop.id);
                                            }}
                                            className="w-full text-left px-3 py-1.5 text-red-400 hover:text-red-300 hover:bg-red-950/30 uppercase flex items-center gap-2 border-t border-zinc-850 mt-1"
                                        >
                                            <TrashIcon className="w-3.5 h-3.5" />
                                            <span>// DELETE</span>
                                        </button>
                                    )}
                                    <button
                                        onClick={(e) => {
                                            setIsMenuOpen(false);
                                            handleShare(e);
                                        }}
                                        className="w-full text-left px-3 py-1.5 text-zinc-400 hover:text-white hover:bg-zinc-900 uppercase flex items-center gap-2"
                                    >
                                        <ForwardIcon className="w-3.5 h-3.5" />
                                        <span>// SHARE</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Card Body */}
                <div className="p-4 flex flex-col justify-between flex-grow space-y-3">
                    <div>
                        {/* Prominent Hook / Headline */}
                        {headlineText && (
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2 leading-snug">
                                {headlineText}
                            </h3>
                        )}

                        {/* Content Body */}
                        {contentText && (
                            <p className="text-zinc-400 text-xs leading-relaxed whitespace-pre-wrap">
                                {isLongContent ? (
                                    <>
                                        {showMore ? contentText : `${contentText.substring(0, 180)}...`}
                                        <button
                                            onClick={() => setShowMore(!showMore)}
                                            className="text-white underline font-bold ml-1.5 hover:text-zinc-300"
                                        >
                                            {showMore ? 'LESS' : 'MORE'}
                                        </button>
                                    </>
                                ) : (
                                    contentText
                                )}
                            </p>
                        )}

                        {/* Music-Specific Metadata Card */}
                        {loop.category === 'Music' && loop.musicMeta?.trackTitle && (
                            <div className="mt-3 p-3 bg-black/70 border border-zinc-800 text-xs space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-violet-400">♪</span>
                                        <span className="text-white font-bold uppercase truncate">
                                            {loop.musicMeta.trackTitle}
                                        </span>
                                    </div>
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest">
                                        AUDIO_SIGNAL
                                    </span>
                                </div>
                                {loop.musicMeta.artist && (
                                    <p className="text-[11px] text-zinc-400 pl-4 truncate">
                                        Artist: <span className="text-zinc-200">{loop.musicMeta.artist}</span>
                                    </p>
                                )}
                                {(loop.musicMeta.streamUrl || loop.externalUrl) && (
                                    <div className="pl-4 pt-1">
                                        <a
                                            href={loop.musicMeta.streamUrl || loop.externalUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 text-[10px] text-violet-300 hover:text-white underline font-bold uppercase tracking-wider"
                                        >
                                            <span>Stream Audio Link</span>
                                            <ArrowUpRightIcon className="w-3 h-3" />
                                        </a>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* External URL Chip (Zaps or others) */}
                        {loop.externalUrl && loop.category !== 'Music' && (
                            <div className="mt-2.5">
                                <a
                                    href={loop.externalUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-black/60 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white text-[11px] transition-colors"
                                >
                                    <span className="text-zinc-500">↗</span>
                                    <span className="truncate max-w-[260px] sm:max-w-xs">{loop.externalUrl.replace(/^https?:\/\//, '')}</span>
                                </a>
                            </div>
                        )}
                    </div>

                    {/* Media Display */}
                    {mediaSource && (
                        <div className="relative mt-2 border border-zinc-800 bg-black overflow-hidden group">
                            <img 
                                src={mediaSource} 
                                onError={handleImageError} 
                                alt={headlineText || 'Loop Media'} 
                                className="w-full h-44 object-cover cursor-zoom-in group-hover:scale-[1.01] transition-transform duration-300"
                                onClick={() => setZoomedImageUrl(mediaSource)}
                            />
                        </div>
                    )}
                </div>

                {/* Bottom Engagement Bar */}
                <div className="border-t border-zinc-800/80 px-4 py-3 flex justify-between items-center text-xs text-zinc-400 bg-[#09090b]">
                    {/* 1. Like */}
                    <button 
                        onClick={handleLike}
                        className={`flex items-center gap-1.5 px-2 py-1 border border-transparent hover:border-zinc-800 transition-colors ${
                            isLiked ? 'text-rose-500 font-bold border-zinc-800 bg-zinc-900/60' : 'hover:text-white'
                        }`}
                        title={isLiked ? 'Unlike' : 'Like'}
                    >
                        <HeartIcon className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                        <span>{formatNumber(likesCount)}</span>
                    </button>

                    {/* 2. Views */}
                    <div className="flex items-center gap-1.5 px-2 py-1 text-zinc-500" title="Total Views">
                        <TrendingUpIcon className="w-4 h-4" />
                        <span>{formatNumber(viewsCount)}</span>
                    </div>

                    {/* 3. Comments */}
                    <button 
                        onClick={() => setShowComments(!showComments)}
                        className={`flex items-center gap-1.5 px-2 py-1 border border-transparent hover:border-zinc-800 transition-colors ${
                            showComments ? 'text-white border-zinc-800 bg-zinc-900/60' : 'hover:text-white'
                        }`}
                        title="Comments"
                    >
                        <ChatBubbleBottomCenterTextIcon className="w-4 h-4" />
                        <span>{formatNumber(commentsCount)}</span>
                    </button>

                    {/* 4. Share */}
                    <button 
                        onClick={handleShare}
                        className={`p-1 border border-transparent hover:border-zinc-800 transition-colors relative ${
                            shareFeedback ? 'text-emerald-400 border-zinc-800 bg-zinc-900' : 'hover:text-white'
                        }`}
                        title={shareFeedback ? 'Copied to clipboard!' : 'Share Loop'}
                    >
                        <ForwardIcon className="w-4 h-4" />
                        {shareFeedback && (
                            <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black border border-emerald-500 text-emerald-400 text-[9px] px-1 py-0.5 uppercase font-mono whitespace-nowrap z-20">
                                Copied
                            </span>
                        )}
                    </button>

                    {/* 5. Save/Bookmark */}
                    <button 
                        onClick={handleBookmark}
                        className={`p-1 border border-transparent hover:border-zinc-800 transition-colors ${
                            isSaved ? 'text-white border-zinc-700 bg-zinc-800' : 'hover:text-white'
                        }`}
                        title={isSaved ? 'Remove Bookmark' : 'Save to My Space'}
                    >
                        <BookmarkIcon className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
                    </button>
                </div>

                {/* Inline Real-time Comments Section */}
                {showComments && (
                    <div className="border-t border-zinc-800 bg-black/60 p-3">
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

            {/* Media Zoom Modal */}
            <ImageZoomModal 
                isOpen={!!zoomedImageUrl} 
                onClose={() => setZoomedImageUrl(null)} 
                imageUrl={zoomedImageUrl || ''}
            />
        </>
    );
};

export default LoopCard;
