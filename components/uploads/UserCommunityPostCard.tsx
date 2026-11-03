import React, { useState } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import type { Post } from '../../types';
import { handleImageError } from '../utils/imageUtils';
import {
    HeartIcon,
    ChatBubbleBottomCenterTextIcon,
    TrendingUpIcon,
    BookmarkIcon,
    EllipsisVerticalIcon,
    PencilSquareIcon,
    TrashIcon,
    ArrowUpRightIcon,
    PlayIcon,
    SparklesIcon,
} from '../ui/Icons';

interface UserCommunityPostCardProps {
    post: Post;
    onEdit: (post: Post) => void;
    onDelete: (postId: string, postTitle: string) => void;
    onImageClick?: (imageUrl: string) => void;
}

const formatPostDateTime = (dateVal: any): string => {
    if (!dateVal) return 'Recently';
    const date = dateVal instanceof Date ? dateVal : (dateVal?.toDate ? dateVal.toDate() : new Date(dateVal));
    if (isNaN(date.getTime())) return 'Recently';

    const month = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    const day = date.getDate();
    const year = date.getFullYear();
    const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${month} ${day}, ${year} · ${time}`;
};

export const UserCommunityPostCard: React.FC<UserCommunityPostCardProps> = ({
    post,
    onEdit,
    onDelete,
    onImageClick,
}) => {
    const navigate = ReactRouterDOM.useNavigate();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    // Resolve community details
    const commId = post.communityId || '';
    const commName = post.communityName || 'Community Collective';
    const commAvatar = post.communityAvatarUrl || `https://picsum.photos/seed/${commId || 'comm'}/200`;
    const commDomain = (post.domain || post.category || 'General').toUpperCase();

    // Resolve post title and content
    const postTitle = post.title && post.title !== post.content ? post.title : (post.oneLine && post.oneLine !== post.content ? post.oneLine : '');
    const content = post.content || '';
    const isLongContent = content.length > 240;
    const displayContent = isExpanded || !isLongContent ? content : `${content.slice(0, 240)}...`;

    // Resolve media
    const mediaUrls = Array.isArray(post.mediaUrls) && post.mediaUrls.length > 0
        ? post.mediaUrls
        : (post.mediaUrl ? [post.mediaUrl] : []);
    const isVideo = post.mediaType === 'video' || mediaUrls.some(u => u.includes('.mp4') || u.includes('video'));

    // Real engagement metrics (no fabricated data)
    const likes = post.stats?.likes ?? post.likeCount ?? 0;
    const comments = post.stats?.comments ?? post.commentCount ?? 0;
    const views = post.stats?.views ?? post.viewCount ?? 0;
    const saves = post.saveCount ?? 0;

    const formattedDate = formatPostDateTime(post.createdAt);

    return (
        <article
            className="bg-[#0c0c0e] border border-zinc-800 hover:border-zinc-700 p-5 font-mono space-y-4 transition-all shadow-sm relative group"
        >
            {/* 1. Header: Community Identity & Domain Badge & Context Menu */}
            <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-zinc-850">
                <div className="flex items-center gap-3 min-w-0">
                    <button
                        type="button"
                        onClick={() => commId && navigate(`/communities?communityId=${commId}`)}
                        className="w-10 h-10 bg-zinc-900 border border-zinc-700 hover:border-zinc-500 flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors"
                        title={`View ${commName} feed`}
                    >
                        <img
                            src={commAvatar}
                            alt={commName}
                            onError={handleImageError}
                            className="w-full h-full object-cover"
                        />
                    </button>
                    <div className="min-w-0">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">
                            // COLLECTIVE
                        </span>
                        <button
                            type="button"
                            onClick={() => commId && navigate(`/communities?communityId=${commId}`)}
                            className="font-bold text-white text-sm hover:underline text-left cursor-pointer truncate block max-w-full"
                        >
                            {commName}
                        </button>
                        {post.communityHandle && (
                            <span className="text-[11px] text-zinc-500 block truncate">
                                @{post.communityHandle.replace(/^@/, '')}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-300">
                        {commDomain}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-emerald-950/70 border border-emerald-800 text-emerald-400 hidden sm:inline-block">
                        // PUBLISHED
                    </span>

                    {/* 3-dots Context Menu */}
                    <div className="relative">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsMenuOpen(prev => !prev);
                            }}
                            className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                            title="Post Actions"
                        >
                            <EllipsisVerticalIcon className="w-4 h-4" />
                        </button>

                        {isMenuOpen && (
                            <>
                                <div 
                                    className="fixed inset-0 z-40" 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsMenuOpen(false);
                                    }} 
                                />
                                <div className="absolute right-0 mt-1 w-36 bg-[#0c0c0e] border border-zinc-700 shadow-2xl py-1 z-50 text-xs">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsMenuOpen(false);
                                            onEdit(post);
                                        }}
                                        className="w-full text-left px-3 py-1.5 text-zinc-200 hover:bg-zinc-800 hover:text-white uppercase tracking-wider flex items-center gap-2"
                                    >
                                        <PencilSquareIcon className="w-3.5 h-3.5 text-zinc-400" />
                                        <span>// EDIT</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsMenuOpen(false);
                                            onDelete(post.id, postTitle || 'Community Post');
                                        }}
                                        className="w-full text-left px-3 py-1.5 text-red-400 hover:bg-red-950/40 hover:text-red-300 uppercase tracking-wider flex items-center gap-2 border-t border-zinc-850 mt-0.5"
                                    >
                                        <TrashIcon className="w-3.5 h-3.5" />
                                        <span>// DELETE</span>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* 2. Post Title (Hook) */}
            {postTitle && (
                <div>
                    <h3 className="text-base sm:text-lg font-bold text-white leading-snug">
                        "{postTitle}"
                    </h3>
                </div>
            )}

            {/* 3. Post Content Preview with Sensible Truncation */}
            {content && (
                <div className="space-y-1.5">
                    <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-line">
                        {displayContent}
                    </p>
                    {isLongContent && (
                        <button
                            type="button"
                            onClick={() => setIsExpanded(prev => !prev)}
                            className="text-[11px] text-zinc-400 hover:text-white underline font-bold uppercase tracking-wider pt-0.5"
                        >
                            {isExpanded ? '[- SHOW LESS]' : '[+ SHOW MORE]'}
                        </button>
                    )}
                </div>
            )}

            {/* 4. Media Previews (Video or Multi-Image Grid) */}
            {isVideo && mediaUrls[0] && (
                <div className="border border-zinc-800 bg-black overflow-hidden">
                    <video
                        src={mediaUrls[0]}
                        controls
                        className="w-full max-h-80 object-contain bg-black"
                    />
                </div>
            )}

            {!isVideo && mediaUrls.length > 0 && (
                <div className="overflow-hidden border border-zinc-850 bg-black/40">
                    {mediaUrls.length === 1 && (
                        <div
                            onClick={() => onImageClick?.(mediaUrls[0])}
                            className="cursor-pointer max-h-80 overflow-hidden group/img relative"
                        >
                            <img
                                src={mediaUrls[0]}
                                alt="Post attachment"
                                onError={handleImageError}
                                className="w-full h-auto max-h-80 object-cover hover:opacity-95 transition-opacity"
                            />
                        </div>
                    )}

                    {mediaUrls.length === 2 && (
                        <div className="grid grid-cols-2 gap-1">
                            {mediaUrls.map((url, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => onImageClick?.(url)}
                                    className="cursor-pointer h-48 overflow-hidden bg-black"
                                >
                                    <img
                                        src={url}
                                        alt={`Attachment ${idx + 1}`}
                                        onError={handleImageError}
                                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                                    />
                                </div>
                            ))}
                        </div>
                    )}

                    {mediaUrls.length === 3 && (
                        <div className="grid grid-cols-2 gap-1 h-64">
                            <div
                                onClick={() => onImageClick?.(mediaUrls[0])}
                                className="cursor-pointer h-full overflow-hidden bg-black"
                            >
                                <img
                                    src={mediaUrls[0]}
                                    alt="Attachment 1"
                                    onError={handleImageError}
                                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                                />
                            </div>
                            <div className="grid grid-rows-2 gap-1 h-full">
                                {mediaUrls.slice(1, 3).map((url, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() => onImageClick?.(url)}
                                        className="cursor-pointer h-full overflow-hidden bg-black"
                                    >
                                        <img
                                            src={url}
                                            alt={`Attachment ${idx + 2}`}
                                            onError={handleImageError}
                                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {mediaUrls.length >= 4 && (
                        <div className="grid grid-cols-2 gap-1">
                            {mediaUrls.slice(0, 4).map((url, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => onImageClick?.(url)}
                                    className="cursor-pointer h-36 overflow-hidden bg-black"
                                >
                                    <img
                                        src={url}
                                        alt={`Attachment ${idx + 1}`}
                                        onError={handleImageError}
                                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* 5. Topic Tags */}
            {Array.isArray(post.tags) && post.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                    {post.tags.map((tag, tIdx) => (
                        <span
                            key={tIdx}
                            className="bg-zinc-900 border border-zinc-800 text-zinc-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                        >
                            #{tag.replace(/^#/, '')}
                        </span>
                    ))}
                </div>
            )}

            {/* 6. Footer: Publication Date + Authentic Engagement Metrics + View In Community Link */}
            <div className="pt-3 border-t border-zinc-850 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-zinc-400">
                <div className="flex flex-wrap items-center gap-4">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
                        {formattedDate}
                    </span>
                    <div className="flex items-center gap-3 text-[11px]">
                        <span className="flex items-center gap-1.5" title={`${likes} Reactions`}>
                            <HeartIcon className="w-3.5 h-3.5 text-zinc-500" />
                            <span className="text-zinc-300 font-bold">{likes}</span>
                        </span>
                        <span className="flex items-center gap-1.5" title={`${comments} Comments`}>
                            <ChatBubbleBottomCenterTextIcon className="w-3.5 h-3.5 text-zinc-500" />
                            <span className="text-zinc-300 font-bold">{comments}</span>
                        </span>
                        <span className="flex items-center gap-1.5" title={`${views} Views`}>
                            <TrendingUpIcon className="w-3.5 h-3.5 text-zinc-500" />
                            <span className="text-zinc-300 font-bold">{views}</span>
                        </span>
                        {saves > 0 && (
                            <span className="flex items-center gap-1.5" title={`${saves} Bookmarks`}>
                                <BookmarkIcon className="w-3.5 h-3.5 text-zinc-500" />
                                <span className="text-zinc-300 font-bold">{saves}</span>
                            </span>
                        )}
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => commId && navigate(`/communities?communityId=${commId}`)}
                    className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white uppercase font-bold tracking-wider group-hover:text-emerald-400 transition-colors self-start sm:self-auto"
                >
                    <span>VIEW IN COMMUNITY</span>
                    <ArrowUpRightIcon className="w-3.5 h-3.5" />
                </button>
            </div>
        </article>
    );
};

export default UserCommunityPostCard;
