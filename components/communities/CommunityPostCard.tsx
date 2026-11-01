import React, { useState, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import type { Post } from '../../types';
import { 
    HeartIcon, 
    ChatBubbleBottomCenterTextIcon, 
    ForwardIcon, 
    BookmarkIcon, 
    SoundWaveIcon, 
    TrendingUpIcon, 
    ShieldCheckIcon, 
    CheckBadgeIcon,
    UsersIcon,
    LockClosedIcon,
    GlobeAltIcon,
    EllipsisVerticalIcon,
    SparklesIcon
} from '../ui/Icons';
import { handleImageError } from '../utils/imageUtils';
import { toggleLikePost, toggleBookmarkPost, incrementPostView } from '../../services/postService';
import { useAuth } from '../../contexts/AuthContext';
import { useAIAssistant } from '../../contexts/AIAssistantContext';
import ImageZoomModal from '../ui/ImageZoomModal';
import AspectRatioBox from '../ui/AspectRatioBox';

const formatNumber = (num?: number): string => {
    if (!num || isNaN(num)) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
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

interface CommunityPostCardProps {
    post: Post;
    onCommentClick?: (post: Post) => void;
    onCommunityClick?: (communityId: string) => void;
}

export const CommunityPostCard: React.FC<CommunityPostCardProps> = ({
    post,
    onCommentClick,
    onCommunityClick,
}) => {
    const navigate = ReactRouterDOM.useNavigate();
    const { currentUser } = useAuth();
    const { openModal } = useAIAssistant();

    const [isLiked, setIsLiked] = useState<boolean>(Boolean(post.userLiked));
    const [likeCount, setLikeCount] = useState<number>(post.stats?.likes ?? post.likeCount ?? 0);
    const [isSaved, setIsSaved] = useState<boolean>(Boolean(post.userSaved));
    const [copied, setCopied] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);

    // Sync state if post prop changes
    useEffect(() => {
        setIsLiked(Boolean(post.userLiked));
        setLikeCount(post.stats?.likes ?? post.likeCount ?? 0);
        setIsSaved(Boolean(post.userSaved));
    }, [post.id, post.userLiked, post.stats?.likes, post.likeCount, post.userSaved]);

    // Track view once
    useEffect(() => {
        if (post.id && !post.id.startsWith('cp-')) {
            incrementPostView(post.id);
        }
    }, [post.id]);

    const isPrivate = post.visibility === 'private' || post.visibility === 'member-only';

    const handleCommunityNavigate = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (post.communityId) {
            if (onCommunityClick) {
                onCommunityClick(post.communityId);
            } else {
                navigate(`/communities/${post.communityId}`);
            }
        }
    };

    const handleAuthorNavigate = (e: React.MouseEvent) => {
        e.stopPropagation();
        const profileKey = post.author?.username || post.authorId;
        if (profileKey) {
            navigate(`/profile/${profileKey}`);
        }
    };

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
        } catch (err) {
            console.warn('Like toggle error:', err);
            // Rollback
            setIsLiked(!nextLiked);
            setLikeCount(prev => nextLiked ? Math.max(0, prev - 1) : prev + 1);
        }
    };

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
        } catch (err) {
            console.warn('Bookmark toggle error:', err);
            setIsSaved(!nextSaved);
        }
    };

    const handleShareClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const shareData = {
            title: post.title || post.aiSummary || 'Invox Community Post',
            text: post.content,
            url: window.location.href,
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch {
                // Ignore cancel
            }
        } else {
            try {
                await navigator.clipboard.writeText(`${post.title || post.aiSummary}\n\n${post.content}\n\n${window.location.origin}/#/communities/${post.communityId || ''}`);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            } catch (err) {
                console.warn('Clipboard write failed:', err);
            }
        }
    };

    const handleToggleSpeech = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!('speechSynthesis' in window)) return;

        if (isSpeaking) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
        } else {
            window.speechSynthesis.cancel();
            const textToSpeak = `${post.title || ''}. ${post.content}`;
            const utterance = new SpeechSynthesisUtterance(textToSpeak);
            utterance.onend = () => setIsSpeaking(false);
            utterance.onerror = () => setIsSpeaking(false);
            window.speechSynthesis.speak(utterance);
            setIsSpeaking(true);
        }
    };

    const handleAIAssistantClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        openModal({
            id: post.id,
            title: post.title || post.aiSummary,
            content: post.content,
            author: post.author.name
        });
    };

    const communityHandle = post.communityHandle 
        ? `@${post.communityHandle.replace(/^@/, '')}`
        : post.communityName 
        ? `@${post.communityName.toLowerCase().replace(/\s+/g, '')}`
        : null;

    return (
        <article className="bg-[#0c0c0e] border border-zinc-800 hover:border-zinc-700 transition-colors p-4 sm:p-5 font-mono text-xs space-y-3.5 relative group">
            {/* 1. POST HEADER */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-zinc-850">
                {/* Community and Author identities */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Community Avatar */}
                    <div 
                        onClick={handleCommunityNavigate}
                        className="cursor-pointer flex-shrink-0 relative group/avatar"
                        title={`View ${post.communityName || 'Community'}`}
                    >
                        {post.communityAvatarUrl ? (
                            <img
                                src={post.communityAvatarUrl}
                                alt={post.communityName || 'Community'}
                                onError={handleImageError}
                                className="w-10 h-10 object-cover border border-zinc-700 bg-zinc-950 group-hover/avatar:border-white transition-colors"
                            />
                        ) : (
                            <div className="w-10 h-10 bg-zinc-950 border border-zinc-700 flex items-center justify-center text-zinc-400 group-hover/avatar:border-white transition-colors">
                                <UsersIcon className="w-5 h-5" />
                            </div>
                        )}
                    </div>

                    {/* Community & Author Metadata */}
                    <div className="min-w-0 flex-1">
                        {/* Community line */}
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <button
                                onClick={handleCommunityNavigate}
                                className="font-bold text-white text-xs sm:text-sm hover:underline hover:text-zinc-200 transition-colors truncate text-left"
                            >
                                {post.communityName || 'Joined Collective'}
                            </button>
                            {communityHandle && (
                                <span className="text-[10px] text-zinc-500 truncate">
                                    {communityHandle}
                                </span>
                            )}
                        </div>

                        {/* Author line */}
                        <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5 min-w-0 flex-wrap">
                            <span className="text-zinc-600">// BY</span>
                            <div 
                                onClick={handleAuthorNavigate} 
                                className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors truncate"
                            >
                                {post.author.avatarUrl && (
                                    <img 
                                        src={post.author.avatarUrl} 
                                        alt={post.author.name}
                                        onError={handleImageError}
                                        className="w-4 h-4 rounded-full border border-zinc-700 object-cover inline-block"
                                    />
                                )}
                                <span className="font-semibold text-zinc-300 hover:text-white">{post.author.name}</span>
                                {post.author.isVerified && (
                                    <CheckBadgeIcon className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                                )}
                            </div>
                            <span className="text-zinc-700">•</span>
                            <span className="text-zinc-500 text-[10px] whitespace-nowrap">
                                {formatTimeAgo(post.createdAt)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Visibility Badge & Meta */}
                <div className="flex items-center gap-2 flex-shrink-0 self-start sm:self-center">
                    {isPrivate ? (
                        <span 
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] uppercase font-bold tracking-wider bg-amber-950/40 text-amber-300 border border-amber-800"
                            title="Visible exclusively to verified members of this community"
                        >
                            <LockClosedIcon className="w-2.5 h-2.5" />
                            <span>MEMBER ONLY</span>
                        </span>
                    ) : (
                        <span 
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] uppercase font-bold tracking-wider bg-emerald-950/30 text-emerald-400 border border-emerald-500/30"
                            title="Public Community Broadcast"
                        >
                            <GlobeAltIcon className="w-2.5 h-2.5" />
                            <span>PUBLIC</span>
                        </span>
                    )}

                    <button
                        onClick={handleAIAssistantClick}
                        className="p-1 text-zinc-500 hover:text-white border border-transparent hover:border-zinc-800 transition-colors"
                        title="Analyze with AI Assistant"
                    >
                        <SparklesIcon className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* 2. POST CONTENT */}
            <div className="space-y-2">
                {/* Title */}
                {post.title && (
                    <h3 className="text-sm sm:text-base font-bold text-white tracking-wide uppercase leading-snug">
                        {post.title}
                    </h3>
                )}

                {/* Text Content */}
                <p className="text-zinc-300 text-xs sm:text-[13px] leading-relaxed whitespace-pre-line break-words font-sans">
                    {post.content}
                </p>

                {/* Topic Tags */}
                {Array.isArray(post.tags) && post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                        {post.tags.map(tag => (
                            <span 
                                key={tag} 
                                className="text-[10px] text-zinc-400 bg-zinc-950 border border-zinc-850 px-2 py-0.5 hover:border-zinc-700 transition-colors"
                            >
                                #{tag.replace(/^#/, '')}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* 3. MEDIA ATTACHMENT */}
            {post.mediaUrl && (
                <div className="pt-1">
                    <AspectRatioBox
                        ratio="video"
                        className="border border-zinc-800 bg-black cursor-zoom-in overflow-hidden"
                        onClick={() => setZoomedImageUrl(post.mediaUrl || null)}
                    >
                        {post.mediaType === 'video' ? (
                            <video
                                src={post.mediaUrl}
                                poster={post.thumbnailUrl}
                                controls
                                playsInline
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <img
                                src={post.mediaUrl}
                                alt="Post media attachment"
                                onError={handleImageError}
                                className="w-full h-full object-cover hover:scale-[1.01] transition-transform duration-300"
                            />
                        )}
                    </AspectRatioBox>
                </div>
            )}

            {/* 4. POST INTERACTIONS BAR */}
            <div className="pt-3 border-t border-zinc-850 flex items-center justify-between text-zinc-400 text-xs">
                {/* Like Button */}
                <button
                    onClick={handleLikeClick}
                    className={`flex items-center gap-1.5 px-2.5 py-1 border transition-colors ${
                        isLiked 
                            ? 'bg-rose-950/30 border-rose-500/40 text-rose-400 font-bold' 
                            : 'border-transparent hover:border-zinc-800 hover:text-white'
                    }`}
                    title={isLiked ? 'Unlike post' : 'Like post'}
                >
                    <HeartIcon className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
                    <span>{formatNumber(likeCount)}</span>
                </button>

                {/* Comment Button */}
                <button
                    onClick={() => onCommentClick ? onCommentClick(post) : handleAIAssistantClick(undefined as any)}
                    className="flex items-center gap-1.5 px-2.5 py-1 border border-transparent hover:border-zinc-800 hover:text-white transition-colors"
                    title="View Comments & Discussion"
                >
                    <ChatBubbleBottomCenterTextIcon className="w-3.5 h-3.5" />
                    <span>{formatNumber(post.stats?.comments ?? post.commentCount ?? 0)}</span>
                </button>

                {/* Total Views */}
                <div 
                    className="flex items-center gap-1.5 px-2 py-1 text-zinc-500 text-[11px]"
                    title="Total Post Views"
                >
                    <TrendingUpIcon className="w-3.5 h-3.5 text-zinc-600" />
                    <span>{formatNumber(post.stats?.views ?? post.viewCount ?? 0)}</span>
                </div>

                {/* Speech Audio Voice */}
                <button
                    onClick={handleToggleSpeech}
                    className={`p-1.5 border transition-colors ${
                        isSpeaking 
                            ? 'text-white border-zinc-600 bg-zinc-800 animate-pulse' 
                            : 'border-transparent hover:border-zinc-800 hover:text-white'
                    }`}
                    title={isSpeaking ? 'Stop Audio Readout' : 'Listen to Post Content'}
                >
                    <SoundWaveIcon className="w-3.5 h-3.5" />
                </button>

                {/* Share Button */}
                <button
                    onClick={handleShareClick}
                    className={`p-1.5 border transition-colors relative ${
                        copied ? 'text-emerald-400 border-emerald-500/40 bg-emerald-950/30' : 'border-transparent hover:border-zinc-800 hover:text-white'
                    }`}
                    title={copied ? 'Link copied to clipboard!' : 'Share Post Link'}
                >
                    <ForwardIcon className="w-3.5 h-3.5" />
                    {copied && (
                        <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black border border-emerald-500 text-emerald-400 text-[9px] px-1 py-0.5 uppercase whitespace-nowrap">
                            Copied
                        </span>
                    )}
                </button>

                {/* Bookmark Button */}
                <button
                    onClick={handleSaveClick}
                    className={`p-1.5 border transition-colors ${
                        isSaved ? 'text-white border-zinc-600 bg-zinc-800' : 'border-transparent hover:border-zinc-800 hover:text-white'
                    }`}
                    title={isSaved ? 'Remove Bookmark' : 'Save Post'}
                >
                    <BookmarkIcon className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
                </button>
            </div>

            {/* Media Zoom Modal */}
            <ImageZoomModal
                isOpen={Boolean(zoomedImageUrl)}
                imageUrl={zoomedImageUrl || ''}
                onClose={() => setZoomedImageUrl(null)}
            />
        </article>
    );
};

export default CommunityPostCard;
