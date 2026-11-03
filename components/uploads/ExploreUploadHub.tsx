import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import type { User } from 'firebase/auth';
import type { Post, UserProfile, Channel } from '../../types';
import { PostType } from '../../types';
import { FeedCard } from '../feed/FeedCard';
import { QueryCard } from '../feed/QueryCard';
import { ThreadCard } from '../feed/ThreadCard';
import { PollCard } from '../feed/PollCard';
import FeedCardSkeleton from '../feed/FeedCardSkeleton';
import ErrorBoundary from '../utils/ErrorBoundary';
import { subscribeToUserPosts, deletePost } from '../../services/postService';
import {
    PlusIcon,
    MagnifyingGlassIcon,
    CloseIcon,
    TrashIcon,
    CheckIcon,
    SparklesIcon,
    FilterIcon,
} from '../ui/Icons';

interface ExploreUploadHubProps {
    currentUser: User | null;
    userProfile: UserProfile | null;
    userChannels: Channel[];
    channelsLoading: boolean;
    onCreatePost: () => void;
    onPostUpdated?: (updated: Post) => void;
    onDeletePost?: (postId: string) => void;
}

export const ExploreUploadHub: React.FC<ExploreUploadHubProps> = ({
    currentUser,
    userProfile,
    userChannels,
    channelsLoading,
    onCreatePost,
    onPostUpdated,
    onDeletePost,
}) => {
    // Real-time Firestore user explore posts
    const [userExplorePosts, setUserExplorePosts] = useState<Post[]>([]);
    const [postsLoading, setPostsLoading] = useState(true);
    const [postsError, setPostsError] = useState<string | null>(null);

    // Filtering, sorting & search state
    const [selectedDomainFilter, setSelectedDomainFilter] = useState<string | 'ALL'>('ALL');
    const [selectedTypeFilter, setSelectedTypeFilter] = useState<string | 'ALL'>('ALL');
    const [sortOption, setSortOption] = useState<'RECENT' | 'OLDEST' | 'ENGAGED'>('RECENT');
    const [searchQuery, setSearchQuery] = useState('');

    // Delete confirmation modal state
    const [postToDelete, setPostToDelete] = useState<{ id: string; title: string } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

    // 1. Real-time subscription to user's authored posts in Firestore
    const subscribeToPosts = useCallback(() => {
        if (!currentUser?.uid) {
            setPostsLoading(false);
            setUserExplorePosts([]);
            return () => {};
        }

        setPostsLoading(true);
        setPostsError(null);

        const unsubscribe = subscribeToUserPosts(
            currentUser.uid,
            (posts) => {
                // Filter strictly for Explore posts:
                // Exclude Community posts, Spotlight Collabs, Spotlight Showcases, Hub Moments, Hub Loops
                const explorePosts = posts.filter(p => {
                    if (!p || !p.id) return false;
                    if (Boolean(p.communityId)) return false;
                    if (p.type === PostType.Collab || Boolean(p.collabDetails)) return false;
                    if (p.type === PostType.Showcase || Boolean((p as any).isProject)) return false;
                    if (p.type === PostType.Moment || Boolean(p.momentType) || Boolean(p.isHub && p.hubType === 'moment')) return false;
                    if (p.type === PostType.Loop || Boolean(p.isLoop)) return false;
                    return true;
                });

                setUserExplorePosts(explorePosts);
                setPostsLoading(false);
                setPostsError(null);
            },
            (err) => {
                console.error('[USER_EXPLORE_POSTS_SUB_ERROR]', err);
                setPostsError('Failed to synchronize published explore broadcasts.');
                setPostsLoading(false);
            }
        );

        return unsubscribe;
    }, [currentUser?.uid]);

    useEffect(() => {
        const unsubscribe = subscribeToPosts();
        return () => unsubscribe();
    }, [subscribeToPosts]);

    // Handle post update (e.g. from FeedCard's edit modal)
    const handlePostUpdated = (updated: Post) => {
        setUserExplorePosts(prev => prev.map(p => p.id === updated.id ? updated : p));
        onPostUpdated?.(updated);
        setActionSuccessMessage('Broadcast updated successfully.');
        setTimeout(() => setActionSuccessMessage(null), 4000);
    };

    // Prompt deletion modal
    const requestDeletePost = (postId: string) => {
        const target = userExplorePosts.find(p => p.id === postId);
        const title = target?.aiSummary || target?.title || target?.oneLine || 'Explore Broadcast';
        setPostToDelete({ id: postId, title });
    };

    // Confirm and execute deletion
    const confirmDelete = async () => {
        if (!postToDelete) return;
        setIsDeleting(true);
        setDeleteError(null);

        try {
            await deletePost(postToDelete.id);
            setUserExplorePosts(prev => prev.filter(p => p.id !== postToDelete.id));
            onDeletePost?.(postToDelete.id);
            setPostToDelete(null);
            setActionSuccessMessage('Explore broadcast deleted successfully.');
            setTimeout(() => setActionSuccessMessage(null), 4000);
        } catch (err: any) {
            console.error('[DELETE_EXPLORE_POST_ERROR]', err);
            setDeleteError(err?.message || 'Failed to delete broadcast.');
        } finally {
            setIsDeleting(false);
        }
    };

    // Extract distinct domains present in the user's published Explore posts
    const distinctDomains = useMemo(() => {
        const map = new Map<string, number>();
        for (const p of userExplorePosts) {
            const domain = p.domain || p.category || 'General';
            map.set(domain, (map.get(domain) || 0) + 1);
        }
        return Array.from(map.entries()).map(([domain, count]) => ({ domain, count }));
    }, [userExplorePosts]);

    // Distinct post types
    const distinctTypes = useMemo(() => {
        const map = new Map<string, number>();
        for (const p of userExplorePosts) {
            const typeStr = (p.type || 'Feed').toUpperCase();
            map.set(typeStr, (map.get(typeStr) || 0) + 1);
        }
        return Array.from(map.entries()).map(([type, count]) => ({ type, count }));
    }, [userExplorePosts]);

    // Computed filtered and sorted posts list
    const displayedPosts = useMemo(() => {
        let list = [...userExplorePosts];

        // 1. Domain filter
        if (selectedDomainFilter !== 'ALL') {
            list = list.filter(p => (p.domain || p.category || 'General').toLowerCase() === selectedDomainFilter.toLowerCase());
        }

        // 2. Type filter
        if (selectedTypeFilter !== 'ALL') {
            list = list.filter(p => (p.type || 'Feed').toUpperCase() === selectedTypeFilter.toUpperCase());
        }

        // 3. Search query
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            list = list.filter(p =>
                (p.title && p.title.toLowerCase().includes(q)) ||
                (p.aiSummary && p.aiSummary.toLowerCase().includes(q)) ||
                (p.oneLine && p.oneLine.toLowerCase().includes(q)) ||
                (p.content && p.content.toLowerCase().includes(q)) ||
                (p.domain && p.domain.toLowerCase().includes(q)) ||
                (p.category && p.category.toLowerCase().includes(q)) ||
                (p.channelName && p.channelName.toLowerCase().includes(q))
            );
        }

        // 4. Sorting
        if (sortOption === 'OLDEST') {
            list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        } else if (sortOption === 'ENGAGED') {
            list.sort((a, b) => {
                const scoreA = (a.stats?.likes ?? a.likeCount ?? 0) + (a.stats?.comments ?? a.commentCount ?? 0) + (a.stats?.views ?? a.viewCount ?? 0) + (a.saveCount ?? 0);
                const scoreB = (b.stats?.likes ?? b.likeCount ?? 0) + (b.stats?.comments ?? b.commentCount ?? 0) + (b.stats?.views ?? b.viewCount ?? 0) + (b.saveCount ?? 0);
                return scoreB - scoreA;
            });
        } else {
            // Default RECENT: newest first
            list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }

        return list;
    }, [userExplorePosts, selectedDomainFilter, selectedTypeFilter, searchQuery, sortOption]);

    return (
        <div className="space-y-4 font-mono">
            {/* Global Success Banner */}
            {actionSuccessMessage && (
                <div className="p-3.5 bg-emerald-950/50 border border-emerald-800 text-emerald-300 text-xs flex items-center justify-between animate-fadeIn">
                    <div className="flex items-center gap-2">
                        <CheckIcon className="w-4 h-4 text-emerald-400" />
                        <span className="font-bold uppercase tracking-wider">{actionSuccessMessage}</span>
                    </div>
                    <button
                        onClick={() => setActionSuccessMessage(null)}
                        className="text-emerald-400 hover:text-white ml-2"
                    >
                        <CloseIcon className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Header: Title, Description & Action */}
            <div className="bg-[#0c0c0e] border border-zinc-800 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <span className="text-zinc-500 uppercase tracking-widest text-[10px] block mb-0.5">
                        // MY_SPACE_UPLOADS
                    </span>
                    <h1 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider">
                        MY EXPLORE POSTS
                    </h1>
                    <p className="text-xs text-zinc-400 mt-1">
                        Your published showcases, broadcasts, and discoveries across the INVOX network.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={onCreatePost}
                        className="flex items-center gap-2 bg-white text-black hover:bg-zinc-200 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all shadow-sm"
                    >
                        <PlusIcon className="w-4 h-4 text-black" />
                        <span>CREATE POST</span>
                    </button>
                </div>
            </div>

            {/* Filter, Sort & Search Toolbar (shown when user has posts) */}
            {userExplorePosts.length > 0 && (
                <div className="bg-[#0c0c0e] border border-zinc-800 p-3 sm:p-3.5 space-y-3">
                    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                        {/* Left: Domain & Type Selectors */}
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">
                                // DOMAIN:
                            </span>
                            <select
                                value={selectedDomainFilter}
                                onChange={(e) => setSelectedDomainFilter(e.target.value)}
                                className="bg-black border border-zinc-800 text-white text-xs px-2.5 py-1.5 outline-none focus:border-zinc-600 font-mono uppercase"
                            >
                                <option value="ALL">ALL DOMAINS ({userExplorePosts.length})</option>
                                {distinctDomains.map(({ domain, count }) => (
                                    <option key={domain} value={domain}>
                                        {domain.toUpperCase()} ({count})
                                    </option>
                                ))}
                            </select>

                            {distinctTypes.length > 1 && (
                                <>
                                    <span className="text-zinc-700 mx-1">|</span>
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">
                                        // TYPE:
                                    </span>
                                    <select
                                        value={selectedTypeFilter}
                                        onChange={(e) => setSelectedTypeFilter(e.target.value)}
                                        className="bg-black border border-zinc-800 text-white text-xs px-2.5 py-1.5 outline-none focus:border-zinc-600 font-mono uppercase"
                                    >
                                        <option value="ALL">ALL TYPES</option>
                                        {distinctTypes.map(({ type, count }) => (
                                            <option key={type} value={type}>
                                                {type} ({count})
                                            </option>
                                        ))}
                                    </select>
                                </>
                            )}
                        </div>

                        {/* Right: Sort & Search */}
                        <div className="flex flex-wrap items-center gap-2.5">
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">
                                    // SORT:
                                </span>
                                <select
                                    value={sortOption}
                                    onChange={(e) => setSortOption(e.target.value as any)}
                                    className="bg-black border border-zinc-800 text-white text-xs px-2.5 py-1.5 outline-none focus:border-zinc-600 font-mono uppercase"
                                >
                                    <option value="RECENT">MOST RECENT</option>
                                    <option value="OLDEST">OLDEST FIRST</option>
                                    <option value="ENGAGED">MOST ENGAGED</option>
                                </select>
                            </div>

                            {/* Search keyword */}
                            <div className="relative flex-1 sm:w-48 md:w-56">
                                <MagnifyingGlassIcon className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search broadcasts..."
                                    className="w-full bg-black border border-zinc-800 text-white text-xs pl-8 pr-2 py-1.5 outline-none focus:border-zinc-600 placeholder:text-zinc-600"
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                                    >
                                        <CloseIcon className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Summary count */}
                    <div className="flex items-center justify-between pt-2 border-t border-zinc-850 text-[10px] text-zinc-500 uppercase tracking-wider">
                        <span>
                            SHOWING {displayedPosts.length} OF {userExplorePosts.length} BROADCASTS
                        </span>
                        {(selectedDomainFilter !== 'ALL' || selectedTypeFilter !== 'ALL' || searchQuery) && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedDomainFilter('ALL');
                                    setSelectedTypeFilter('ALL');
                                    setSearchQuery('');
                                }}
                                className="text-zinc-400 hover:text-white underline font-bold"
                            >
                                RESET FILTERS
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* --- FEED STATE: LOADING / ERROR / EMPTY / COMPLETE FEED CARDS --- */}
            {postsLoading ? (
                <div className="space-y-4">
                    <FeedCardSkeleton />
                    <FeedCardSkeleton />
                </div>
            ) : postsError ? (
                <div className="py-14 px-4 bg-[#0c0c0e] border border-red-900/60 text-center space-y-3">
                    <span className="text-[10px] text-red-500 uppercase tracking-widest block">// SYNC_ERROR</span>
                    <p className="text-xs text-red-300">{postsError}</p>
                    <button
                        type="button"
                        onClick={() => subscribeToPosts()}
                        className="px-4 py-2 bg-zinc-900 border border-zinc-700 text-white text-xs uppercase font-bold tracking-wider hover:bg-zinc-800 transition-colors"
                    >
                        RETRY SYNC
                    </button>
                </div>
            ) : userExplorePosts.length === 0 ? (
                /* --- EMPTY STATE (Exact specification) --- */
                <div className="flex flex-col items-center justify-center py-16 px-4 bg-[#0c0c0e] border border-zinc-800 text-center space-y-4">
                    <div className="max-w-md w-full space-y-3">
                        <span className="text-[10px] uppercase tracking-widest text-zinc-500 block">
                            // NO_EXPLORE_POSTS
                        </span>
                        <h2 className="text-base sm:text-lg font-bold text-white tracking-wider uppercase">
                            NO EXPLORE POSTS YET
                        </h2>
                        <p className="text-zinc-400 text-xs leading-relaxed">
                            Your published showcases and discoveries will appear here. Share your first post with the INVOX community.
                        </p>
                        <div className="pt-2">
                            <button
                                type="button"
                                onClick={onCreatePost}
                                className="inline-flex items-center gap-2 bg-white text-black hover:bg-zinc-200 px-6 py-2.5 text-xs font-bold uppercase tracking-wider transition-all shadow-sm"
                            >
                                <PlusIcon className="w-4 h-4 text-black" />
                                <span>CREATE YOUR FIRST POST</span>
                            </button>
                        </div>
                    </div>
                </div>
            ) : displayedPosts.length === 0 ? (
                /* No search/filter match */
                <div className="py-14 px-4 bg-[#0c0c0e] border border-zinc-800 text-center space-y-2">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest block">// NO_MATCHING_POSTS</span>
                    <p className="text-xs text-zinc-400">No published explore posts match your current filter or search criteria.</p>
                    <button
                        type="button"
                        onClick={() => {
                            setSelectedDomainFilter('ALL');
                            setSelectedTypeFilter('ALL');
                            setSearchQuery('');
                        }}
                        className="text-xs text-white underline font-bold uppercase tracking-wider pt-1"
                    >
                        Clear all filters
                    </button>
                </div>
            ) : (
                /* --- COMPLETE EXPLORE POST CARDS (Reusing FeedCard, QueryCard, ThreadCard) --- */
                <div className="space-y-4">
                    {displayedPosts.map((post) => {
                        const uniqueKey = `explore-post-${post.id}`;

                        if (post.type === PostType.Query) {
                            return (
                                <ErrorBoundary key={uniqueKey}>
                                    <QueryCard post={post} isMySpaceContext={true} />
                                </ErrorBoundary>
                            );
                        }

                        if (post.type === PostType.Thread) {
                            return (
                                <ErrorBoundary key={uniqueKey}>
                                    <ThreadCard
                                        post={post}
                                        isMySpaceContext={true}
                                        onPostUpdated={handlePostUpdated}
                                    />
                                </ErrorBoundary>
                            );
                        }

                        if ((post as any).type === PostType.Poll) {
                            return (
                                <ErrorBoundary key={uniqueKey}>
                                    <PollCard
                                        poll={post as any}
                                        isMySpaceContext={true}
                                        onDelete={requestDeletePost}
                                    />
                                </ErrorBoundary>
                            );
                        }

                        // Canonical Explore Feed Card (Used in Explore feed)
                        return (
                            <ErrorBoundary key={uniqueKey}>
                                <FeedCard
                                    post={post}
                                    isMySpaceContext={true}
                                    onPostUpdated={handlePostUpdated}
                                    onDelete={requestDeletePost}
                                />
                            </ErrorBoundary>
                        );
                    })}
                </div>
            )}

            {/* --- DELETE CONFIRMATION MODAL --- */}
            {postToDelete && (
                <div
                    className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 font-mono"
                    onClick={() => {
                        if (!isDeleting) setPostToDelete(null);
                    }}
                >
                    <div
                        className="bg-[#0c0c0e] border border-zinc-800 max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                            <span className="text-xs font-bold text-red-400 uppercase tracking-wider">
                                // CONFIRM DELETION
                            </span>
                            <button
                                type="button"
                                onClick={() => setPostToDelete(null)}
                                disabled={isDeleting}
                                className="text-zinc-500 hover:text-white"
                            >
                                <CloseIcon className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-2">
                            <p className="text-xs text-zinc-300 leading-relaxed">
                                Are you sure you want to delete this broadcast?
                            </p>
                            {postToDelete.title && (
                                <div className="p-2.5 bg-black border border-zinc-850 text-xs text-white font-bold truncate">
                                    "{postToDelete.title}"
                                </div>
                            )}
                            <p className="text-[11px] text-zinc-500">
                                This action is permanent and will remove the post from both your My Space dashboard and the Explore feed.
                            </p>
                        </div>

                        {deleteError && (
                            <div className="p-2.5 bg-red-950/40 border border-red-800 text-red-300 text-xs">
                                {deleteError}
                            </div>
                        )}

                        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
                            <button
                                type="button"
                                onClick={() => setPostToDelete(null)}
                                disabled={isDeleting}
                                className="px-4 py-2 bg-transparent hover:bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white text-xs font-bold uppercase tracking-wider transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmDelete}
                                disabled={isDeleting}
                                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {isDeleting ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        <span>DELETING...</span>
                                    </>
                                ) : (
                                    <>
                                        <TrashIcon className="w-3.5 h-3.5" />
                                        <span>// CONFIRM DELETE</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExploreUploadHub;
