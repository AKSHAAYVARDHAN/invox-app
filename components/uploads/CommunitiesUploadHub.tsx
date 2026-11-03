import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import type { User } from 'firebase/auth';
import type { Post, UserProfile } from '../../types';
import { PostType } from '../../types';
import type { JoinedCommunityRecord } from '../../services/communityService';
import { createPost, deletePost, subscribeToUserPosts } from '../../services/postService';
import { handleImageError } from '../utils/imageUtils';
import {
    PlusIcon,
    UsersIcon,
    PhotoIcon,
    VideoCameraIcon,
    PlayIcon,
    TrashIcon,
    CloseIcon,
    MagnifyingGlassIcon,
    ChevronDownIcon,
    CheckIcon,
    ArrowUpRightIcon,
    SparklesIcon,
    FilterIcon,
} from '../ui/Icons';
import { EditCommunityPostModal } from './EditCommunityPostModal';
import { UserCommunityPostCard } from './UserCommunityPostCard';

interface SelectedMediaItem {
    id: string;
    file: File;
    previewUrl: string;
    type: 'image' | 'video';
    name: string;
    sizeFormatted: string;
}

const MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB
const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
const MAX_IMAGES_COUNT = 4;

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/ogg'];

const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

interface CommunitiesUploadHubProps {
    currentUser: User | null;
    userProfile: UserProfile | null;
    joinedCommunities: JoinedCommunityRecord[];
    joinedLoading: boolean;
    onPostCreated?: (newPost: Post) => void;
    initialPublishingOpen?: boolean;
    initialCommunityId?: string;
    fromOrigin?: string;
    returnDestination?: string;
    onReturn?: () => void;
}

export const CommunitiesUploadHub: React.FC<CommunitiesUploadHubProps> = ({
    currentUser,
    userProfile,
    joinedCommunities,
    joinedLoading,
    onPostCreated,
    initialPublishingOpen,
    initialCommunityId,
    fromOrigin,
    returnDestination,
    onReturn,
}) => {
    const navigate = ReactRouterDOM.useNavigate();
    const [searchParams] = ReactRouterDOM.useSearchParams();
    const location = ReactRouterDOM.useLocation();

    // Determine originating section and parameters
    const paramCommunityId = initialCommunityId || searchParams.get('communityId') || searchParams.get('community') || (location.state as any)?.communityId;
    const shouldOpenCreate = Boolean(initialPublishingOpen || searchParams.get('create') === 'true' || searchParams.get('action') === 'create' || (location.state as any)?.openCreate);
    const fromParam = fromOrigin || searchParams.get('from') || (location.state as any)?.from;
    const returnDest = returnDestination || searchParams.get('returnUrl') || (location.state as any)?.returnUrl;
    const isFromCommunities = fromParam === 'communities' || (typeof fromParam === 'string' && fromParam.includes('communities')) || Boolean((location.state as any)?.fromCommunities);

    // View mode: 'dashboard' (published posts) vs 'publish' (create post form)
    const [isPublishingOpen, setIsPublishingOpen] = useState(shouldOpenCreate);

    useEffect(() => {
        if (shouldOpenCreate) {
            setIsPublishingOpen(true);
        }
    }, [shouldOpenCreate]);

    // Real-time Firestore user community posts
    const [userCommunityPosts, setUserCommunityPosts] = useState<Post[]>([]);
    const [postsLoading, setPostsLoading] = useState(true);
    const [postsError, setPostsError] = useState<string | null>(null);

    // Filtering, sorting & search state
    const [selectedFilterCommunityId, setSelectedFilterCommunityId] = useState<string | 'ALL'>('ALL');
    const [sortOption, setSortOption] = useState<'RECENT' | 'OLDEST' | 'ENGAGED'>('RECENT');
    const [searchQuery, setSearchQuery] = useState('');

    // Actions state: Edit & Delete & Lightbox
    const [postToEdit, setPostToEdit] = useState<Post | null>(null);
    const [postToDelete, setPostToDelete] = useState<{ id: string; title: string } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
    const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

    // --- PUBLISHING FORM STATES ---
    const [selectedCommunityId, setSelectedCommunityId] = useState<string>('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [communitySearchQuery, setCommunitySearchQuery] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [tagsInput, setTagsInput] = useState('');
    const [selectedMedia, setSelectedMedia] = useState<SelectedMediaItem[]>([]);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    const imageInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);

    // 1. REAL-TIME SUBSCRIPTION TO USER'S PUBLISHED COMMUNITY POSTS
    const subscribeToPosts = useCallback(() => {
        if (!currentUser?.uid) {
            setPostsLoading(false);
            setUserCommunityPosts([]);
            return () => {};
        }

        setPostsLoading(true);
        setPostsError(null);

        const unsubscribe = subscribeToUserPosts(
            currentUser.uid,
            (posts) => {
                // Filter strictly for posts that belong to a community
                const commPosts = posts.filter(p => Boolean(p.communityId));
                setUserCommunityPosts(commPosts);
                setPostsLoading(false);
                setPostsError(null);
            },
            (err) => {
                console.error('[USER_COMMUNITY_POSTS_SUB_ERROR]', err);
                setPostsError('Failed to synchronize published community posts.');
                setPostsLoading(false);
            }
        );

        return unsubscribe;
    }, [currentUser?.uid]);

    useEffect(() => {
        const unsubscribe = subscribeToPosts();
        return () => unsubscribe();
    }, [subscribeToPosts]);

    const hasPreselectedRef = useRef(false);
    // Pre-select community if requested or auto-select first joined community
    useEffect(() => {
        if (paramCommunityId && !hasPreselectedRef.current && joinedCommunities.length > 0) {
            const found = joinedCommunities.find(c => c.id.toLowerCase() === paramCommunityId.toLowerCase());
            if (found) {
                setSelectedCommunityId(found.id);
                hasPreselectedRef.current = true;
                return;
            }
        }
        if (joinedCommunities.length > 0 && !selectedCommunityId) {
            setSelectedCommunityId(joinedCommunities[0].id);
        }
    }, [joinedCommunities, paramCommunityId, selectedCommunityId]);

    // Reset publishing composer form fields
    const handleResetForm = () => {
        setTitle('');
        setContent('');
        setTagsInput('');
        clearMedia();
        setFormError(null);
    };

    // Unified cancellation and return handler preserving originating navigation context
    const handleCancelOrBack = useCallback(() => {
        if (onReturn) {
            onReturn();
            return;
        }
        if (isFromCommunities) {
            const dest = returnDest || `/communities?view=my-communities${selectedCommunityId ? `&community=${encodeURIComponent(selectedCommunityId)}` : ''}`;
            navigate(dest);
        } else {
            setIsPublishingOpen(false);
            setFormError(null);
            if (searchParams.get('create') || searchParams.get('action')) {
                const nextParams = new URLSearchParams(searchParams);
                nextParams.delete('create');
                nextParams.delete('action');
                nextParams.delete('communityId');
                navigate(`/myspace/uploads?${nextParams.toString()}`, { replace: true });
            }
        }
    }, [onReturn, isFromCommunities, returnDest, selectedCommunityId, navigate, searchParams]);

    // Handle outside clicks for publisher community dropdown
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Clean up created object URLs
    const clearMedia = useCallback(() => {
        selectedMedia.forEach(item => {
            if (item.previewUrl.startsWith('blob:')) {
                URL.revokeObjectURL(item.previewUrl);
            }
        });
        setSelectedMedia([]);
    }, [selectedMedia]);

    // Process media files
    const processFiles = (files: FileList | File[]) => {
        setFormError(null);
        const fileArray = Array.from(files);
        const newItems: SelectedMediaItem[] = [];

        for (const file of fileArray) {
            const isImg = ALLOWED_IMAGE_TYPES.includes(file.type) || file.type.startsWith('image/');
            const isVid = ALLOWED_VIDEO_TYPES.includes(file.type) || file.type.startsWith('video/');

            if (!isImg && !isVid) {
                setFormError(`Unsupported format "${file.name}". Supported: PNG, JPG, WEBP, GIF, MP4.`);
                return;
            }

            if (isVid) {
                if (file.size > MAX_VIDEO_SIZE_BYTES) {
                    setFormError(`Video file "${file.name}" exceeds 50MB limit.`);
                    return;
                }
                clearMedia();
                const previewUrl = URL.createObjectURL(file);
                setSelectedMedia([{
                    id: `vid-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                    file,
                    previewUrl,
                    type: 'video',
                    name: file.name,
                    sizeFormatted: formatBytes(file.size),
                }]);
                return;
            }

            if (isImg) {
                if (file.size > MAX_IMAGE_SIZE_BYTES) {
                    setFormError(`Image "${file.name}" exceeds 15MB limit.`);
                    return;
                }

                const existingImages = selectedMedia.filter(m => m.type === 'image');
                if (existingImages.length + newItems.length >= MAX_IMAGES_COUNT) {
                    setFormError(`Maximum of ${MAX_IMAGES_COUNT} images can be attached.`);
                    break;
                }

                const previewUrl = URL.createObjectURL(file);
                newItems.push({
                    id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                    file,
                    previewUrl,
                    type: 'image',
                    name: file.name,
                    sizeFormatted: formatBytes(file.size),
                });
            }
        }

        if (newItems.length > 0) {
            const hasVideo = selectedMedia.some(m => m.type === 'video');
            if (hasVideo) {
                clearMedia();
                setSelectedMedia(newItems);
            } else {
                setSelectedMedia(prev => [...prev, ...newItems]);
            }
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            processFiles(e.target.files);
            e.target.value = '';
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processFiles(e.dataTransfer.files);
        }
    };

    // Filter joined communities inside dropdown search
    const filteredCommunities = useMemo(() => {
        if (!communitySearchQuery.trim()) return joinedCommunities;
        const q = communitySearchQuery.toLowerCase().trim();
        return joinedCommunities.filter(c =>
            c.community.name.toLowerCase().includes(q) ||
            (c.community.category && c.community.category.toLowerCase().includes(q))
        );
    }, [joinedCommunities, communitySearchQuery]);

    const selectedRecord = useMemo(() => {
        return joinedCommunities.find(c => c.id === selectedCommunityId) || null;
    }, [joinedCommunities, selectedCommunityId]);

    // Dispatch community post
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser?.uid) {
            setFormError('Authentication required to broadcast post.');
            return;
        }

        // 1. Validate that a community has been selected
        if (!selectedRecord) {
            setFormError('Please select a community to publish into.');
            return;
        }

        // 2. Validate that the current user has permission to post (user is a member/joined)
        const isPermitted = selectedRecord.role === 'owner' ||
                            selectedRecord.role === 'admin' ||
                            selectedRecord.role === 'member' ||
                            selectedRecord.isOwner ||
                            selectedRecord.isAdmin ||
                            selectedRecord.status === 'active';
        if (!isPermitted) {
            setFormError('Active community membership is required to publish posts.');
            return;
        }

        // 3. Validate that post content or media is not empty
        if (!content.trim() && selectedMedia.length === 0) {
            setFormError('Post must contain message content or media attachment.');
            return;
        }

        setIsSubmitting(true);
        setFormError(null);
        setUploadProgress(0);

        try {
            const tags = tagsInput
                .split(',')
                .map(t => t.trim().replace(/^#/, ''))
                .filter(Boolean);

            const comm = selectedRecord.community;
            const mediaFiles = selectedMedia.map(m => m.file);
            const isVideoPost = selectedMedia.length > 0 && selectedMedia[0].type === 'video';
            const fallbackMediaUrls = selectedMedia.map(m => m.previewUrl);

            const newPost = await createPost({
                communityId: comm.id,
                communityName: comm.name,
                communityAvatarUrl: comm.avatarUrl,
                communityHandle: comm.handle,
                title: title.trim() || undefined,
                oneLine: title.trim() || content.trim().slice(0, 60),
                content: content.trim(),
                tags,
                category: comm.category || 'General',
                domain: comm.category || 'General',
                visibility: 'public',
                type: PostType.Feed,
                mediaFiles: mediaFiles.length > 0 ? mediaFiles : null,
                mediaFile: mediaFiles.length === 1 ? mediaFiles[0] : null,
                mediaUrls: fallbackMediaUrls,
                mediaType: isVideoPost ? 'video' : (mediaFiles.length > 0 ? 'image' : undefined),
                authorProfile: {
                    displayName: userProfile?.displayName || currentUser.displayName || 'Invox Member',
                    username: userProfile?.username || '',
                    photoURL: userProfile?.photoURL || currentUser.photoURL || undefined,
                    role: userProfile?.role || 'user',
                }
            }, (progress) => {
                setUploadProgress(progress);
            });

            // Optimistically update list
            setUserCommunityPosts(prev => {
                if (prev.some(p => p.id === newPost.id)) return prev;
                return [newPost, ...prev];
            });

            // Reset form fields
            setTitle('');
            setContent('');
            setTagsInput('');
            clearMedia();

            // Notify parent
            if (onPostCreated) {
                onPostCreated(newPost);
            }

            if (isFromCommunities) {
                const dest = returnDest || `/communities?view=my-communities${comm.id ? `&community=${encodeURIComponent(comm.id)}` : ''}`;
                navigate(dest, {
                    state: {
                        publishedPostId: newPost.id,
                        communityId: comm.id,
                        successMessage: `Post published to ${comm.name} successfully.`
                    }
                });
            } else {
                // Return to dashboard and show success notification
                setIsPublishingOpen(false);
                setActionSuccessMessage(`Post published to ${comm.name} successfully.`);
                setTimeout(() => setActionSuccessMessage(null), 5000);
                if (searchParams.get('create') || searchParams.get('action')) {
                    const nextParams = new URLSearchParams(searchParams);
                    nextParams.delete('create');
                    nextParams.delete('action');
                    nextParams.delete('communityId');
                    navigate(`/myspace/uploads?${nextParams.toString()}`, { replace: true });
                }
            }
        } catch (err: any) {
            console.error('[PUBLISH_COMMUNITY_POST_ERROR]', err);
            setFormError(err?.message || 'Failed to publish post to community feed.');
        } finally {
            setIsSubmitting(false);
            setUploadProgress(null);
        }
    };

    // Handle post deletion with confirmation
    const confirmDeletePost = async () => {
        if (!postToDelete) return;
        setIsDeleting(true);
        setDeleteError(null);

        try {
            await deletePost(postToDelete.id);
            setUserCommunityPosts(prev => prev.filter(p => p.id !== postToDelete.id));
            setPostToDelete(null);
            setActionSuccessMessage('Community post deleted successfully.');
            setTimeout(() => setActionSuccessMessage(null), 4000);
        } catch (err: any) {
            console.error('[DELETE_COMMUNITY_POST_ERROR]', err);
            setDeleteError(err?.message || 'Failed to delete community post.');
        } finally {
            setIsDeleting(false);
        }
    };

    // Dynamic distinct communities where user has published posts
    const distinctPublishedCommunities = useMemo(() => {
        const map = new Map<string, { id: string; name: string; avatarUrl?: string; domain?: string; count: number }>();
        for (const p of userCommunityPosts) {
            if (!p.communityId) continue;
            const existing = map.get(p.communityId);
            if (existing) {
                existing.count++;
            } else {
                map.set(p.communityId, {
                    id: p.communityId,
                    name: p.communityName || 'Community Collective',
                    avatarUrl: p.communityAvatarUrl,
                    domain: p.domain || p.category,
                    count: 1,
                });
            }
        }
        return Array.from(map.values());
    }, [userCommunityPosts]);

    // Computed filtered and sorted posts list
    const displayedPosts = useMemo(() => {
        let list = [...userCommunityPosts];

        // 1. Community filter
        if (selectedFilterCommunityId !== 'ALL') {
            list = list.filter(p => p.communityId === selectedFilterCommunityId);
        }

        // 2. Search query filter
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            list = list.filter(p =>
                (p.title && p.title.toLowerCase().includes(q)) ||
                (p.content && p.content.toLowerCase().includes(q)) ||
                (p.communityName && p.communityName.toLowerCase().includes(q)) ||
                (Array.isArray(p.tags) && p.tags.some(t => t.toLowerCase().includes(q)))
            );
        }

        // 3. Sorting
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
    }, [userCommunityPosts, selectedFilterCommunityId, searchQuery, sortOption]);

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

            {/* --- VIEW 1: PUBLISHING COMPOSER INTERFACE --- */}
            {isPublishingOpen ? (
                <div
                    className={`bg-[#0c0c0e] border ${
                        isDragging ? 'border-emerald-500 bg-emerald-950/10' : 'border-zinc-800'
                    } p-5 sm:p-7 space-y-6 transition-all`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    {/* Header with Back button */}
                    <div className="border-b border-zinc-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">
                                // COMMUNITY_PUBLISHER
                            </span>
                            <h2 className="text-base font-bold text-white uppercase tracking-wider">
                                Create Community Post
                            </h2>
                            <p className="text-xs text-zinc-400 mt-1">
                                Select a joined collective and broadcast technical transmissions with media.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={handleCancelOrBack}
                            className="self-start sm:self-auto px-3.5 py-1.5 bg-transparent hover:bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white text-xs uppercase font-bold tracking-wider transition-colors"
                        >
                            {isFromCommunities ? '← BACK TO COMMUNITIES' : '← BACK TO POSTS'}
                        </button>
                    </div>

                    {/* Error Banner */}
                    {formError && (
                        <div className="p-3.5 bg-red-950/40 border border-red-800 text-red-300 text-xs flex items-center justify-between animate-fadeIn">
                            <span>{formError}</span>
                            <button onClick={() => setFormError(null)} className="text-red-400 hover:text-white ml-2">
                                <CloseIcon className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* 1. Community Selection Dropdown */}
                        <div className="relative" ref={dropdownRef}>
                            <label className="block text-[11px] uppercase tracking-wider text-zinc-300 mb-1.5 font-bold">
                                Select Community <span className="text-emerald-400">*</span>
                            </label>
                            <button
                                type="button"
                                onClick={() => setIsDropdownOpen(prev => !prev)}
                                className="w-full bg-black border border-zinc-800 hover:border-zinc-700 text-left p-3 flex items-center justify-between transition-colors group"
                            >
                                {selectedRecord ? (
                                    <div className="flex items-center gap-3 min-w-0">
                                        <img
                                            src={selectedRecord.community.avatarUrl || `https://picsum.photos/seed/${selectedRecord.community.id}/200`}
                                            alt={selectedRecord.community.name}
                                            onError={handleImageError}
                                            className="w-7 h-7 object-cover border border-zinc-700 flex-shrink-0"
                                        />
                                        <div className="min-w-0">
                                            <span className="font-bold text-white text-xs block truncate">
                                                {selectedRecord.community.name}
                                            </span>
                                            <span className="text-[10px] text-zinc-500 uppercase block truncate">
                                                {selectedRecord.community.category || 'General'} · Role: {selectedRecord.role}
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <span className="text-zinc-500 text-xs">// CHOOSE_JOINED_COMMUNITY...</span>
                                )}
                                <ChevronDownIcon className={`w-4 h-4 text-zinc-400 group-hover:text-white transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Dropdown Menu */}
                            {isDropdownOpen && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-[#0c0c0e] border border-zinc-700 shadow-2xl z-30 max-h-72 overflow-y-auto">
                                    <div className="p-2 border-b border-zinc-800 sticky top-0 bg-[#0c0c0e] z-10">
                                        <div className="relative">
                                            <MagnifyingGlassIcon className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                            <input
                                                type="text"
                                                value={communitySearchQuery}
                                                onChange={(e) => setCommunitySearchQuery(e.target.value)}
                                                placeholder="Filter joined communities..."
                                                className="w-full bg-black border border-zinc-800 text-white text-xs pl-8 pr-2 py-1.5 outline-none focus:border-zinc-600"
                                            />
                                        </div>
                                    </div>

                                    <div className="divide-y divide-zinc-900">
                                        {filteredCommunities.map((record) => {
                                            const comm = record.community;
                                            const isSelected = comm.id === selectedCommunityId;
                                            return (
                                                <button
                                                    key={comm.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedCommunityId(comm.id);
                                                        setIsDropdownOpen(false);
                                                        setCommunitySearchQuery('');
                                                    }}
                                                    className={`w-full text-left p-3 flex items-center justify-between transition-colors ${
                                                        isSelected ? 'bg-zinc-800 text-white' : 'hover:bg-zinc-900 text-zinc-300'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <img
                                                            src={comm.avatarUrl || `https://picsum.photos/seed/${comm.id}/200`}
                                                            alt={comm.name}
                                                            onError={handleImageError}
                                                            className="w-7 h-7 object-cover border border-zinc-700 flex-shrink-0"
                                                        />
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-xs truncate block">{comm.name}</span>
                                                                {record.isOwner && (
                                                                    <span className="text-[9px] uppercase px-1 py-0.2 bg-zinc-900 border border-zinc-750 text-emerald-400 font-bold">
                                                                        Owner
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="text-[10px] text-zinc-500 uppercase block truncate">
                                                                {comm.category || 'General'} · @{comm.handle || comm.name.toLowerCase().replace(/\s+/g, '')}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {isSelected && <CheckIcon className="w-4 h-4 text-emerald-400 flex-shrink-0 ml-2" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 2. Post Title */}
                        <div>
                            <label className="block text-[11px] uppercase tracking-wider text-zinc-300 mb-1.5 font-bold">
                                Post Title <span className="text-zinc-500 text-[10px] font-normal">(Optional)</span>
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="e.g., Scaling B2B SaaS ARR metrics across distributed collectives..."
                                maxLength={140}
                                className="w-full bg-black border border-zinc-800 focus:border-zinc-500 text-white text-xs px-3.5 py-2.5 outline-none transition-colors"
                            />
                        </div>

                        {/* 3. Post Content */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-[11px] uppercase tracking-wider text-zinc-300 font-bold">
                                    Message Content <span className="text-emerald-400">*</span>
                                </label>
                                <span className="text-[10px] text-zinc-500">{content.length} characters</span>
                            </div>
                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder="Share technical insights, findings, architectural decisions, benchmarks or questions with the collective..."
                                rows={6}
                                className="w-full bg-black border border-zinc-800 focus:border-zinc-500 text-white text-xs p-3 outline-none transition-colors leading-relaxed resize-y"
                            />
                        </div>

                        {/* 4. Media Upload (Images or Video) */}
                        <div>
                            <label className="block text-[11px] uppercase tracking-wider text-zinc-300 mb-1.5 font-bold">
                                Attach Media <span className="text-zinc-500 text-[10px] font-normal">(Up to 4 images, or 1 video up to 50MB)</span>
                            </label>

                            {/* Drag & Drop Area */}
                            <div
                                onClick={() => imageInputRef.current?.click()}
                                className={`border border-dashed ${
                                    isDragging ? 'border-emerald-500 bg-emerald-950/20' : 'border-zinc-800 hover:border-zinc-600 bg-black/40'
                                } p-4 sm:p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all`}
                            >
                                <div className="flex items-center gap-3 mb-2 text-zinc-400">
                                    <PhotoIcon className="w-5 h-5" />
                                    <span className="text-zinc-600">/</span>
                                    <VideoCameraIcon className="w-5 h-5" />
                                </div>
                                <span className="text-xs text-white font-bold uppercase tracking-wider block mb-1">
                                    Drag & drop media files, or click to browse
                                </span>
                                <span className="text-[10px] text-zinc-500 uppercase tracking-widest">
                                    PNG, JPG, WEBP, GIF (up to 15MB) · MP4, WEBM (up to 50MB)
                                </span>
                            </div>

                            <input
                                ref={imageInputRef}
                                type="file"
                                accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm"
                                multiple
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            <input
                                ref={videoInputRef}
                                type="file"
                                accept="video/mp4,video/webm"
                                onChange={handleFileChange}
                                className="hidden"
                            />

                            {/* Selected Media Previews */}
                            {selectedMedia.length > 0 && (
                                <div className="mt-3 space-y-2">
                                    <div className="flex items-center justify-between text-[11px] text-zinc-400">
                                        <span>ATTACHED ({selectedMedia.length}):</span>
                                        <button
                                            type="button"
                                            onClick={clearMedia}
                                            className="text-red-400 hover:text-red-300 uppercase font-bold text-[10px]"
                                        >
                                            // REMOVE ALL
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        {selectedMedia.map((item, idx) => (
                                            <div
                                                key={item.id}
                                                className="relative group bg-black border border-zinc-800 overflow-hidden aspect-video flex items-center justify-center"
                                            >
                                                {item.type === 'video' ? (
                                                    <div className="relative w-full h-full flex items-center justify-center bg-black">
                                                        <video src={item.previewUrl} className="w-full h-full object-cover" />
                                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                                            <PlayIcon className="w-6 h-6 text-white" />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <img src={item.previewUrl} alt={item.name} className="w-full h-full object-cover" />
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (item.previewUrl.startsWith('blob:')) {
                                                            URL.revokeObjectURL(item.previewUrl);
                                                        }
                                                        setSelectedMedia(prev => prev.filter(m => m.id !== item.id));
                                                    }}
                                                    className="absolute top-1 right-1 p-1 bg-black/80 hover:bg-red-950 text-white hover:text-red-300 transition-colors"
                                                    title="Remove media"
                                                >
                                                    <TrashIcon className="w-3.5 h-3.5" />
                                                </button>
                                                <span className="absolute bottom-1 left-1 px-1 py-0.2 bg-black/80 text-[9px] text-zinc-300 truncate max-w-[85%]">
                                                    #{idx + 1} {item.sizeFormatted}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 5. Topic Tags */}
                        <div>
                            <label className="block text-[11px] uppercase tracking-wider text-zinc-300 mb-1.5 font-bold">
                                Topic Tags <span className="text-zinc-500 text-[10px] font-normal">(Comma separated)</span>
                            </label>
                            <input
                                type="text"
                                value={tagsInput}
                                onChange={(e) => setTagsInput(e.target.value)}
                                placeholder="TypeScript, React, Performance, Distributed"
                                className="w-full bg-black border border-zinc-800 focus:border-zinc-500 text-white text-xs px-3.5 py-2.5 outline-none transition-colors"
                            />
                        </div>

                        {/* Upload Progress Bar */}
                        {uploadProgress !== null && (
                            <div className="space-y-1 pt-1">
                                <div className="flex justify-between text-[10px] text-zinc-400">
                                    <span>UPLOADING MEDIA TRANSFERS...</span>
                                    <span>{uploadProgress}%</span>
                                </div>
                                <div className="w-full h-1 bg-zinc-800 overflow-hidden">
                                    <div
                                        className="h-full bg-emerald-500 transition-all duration-150"
                                        style={{ width: `${uploadProgress}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="pt-3 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
                                BROADCASTS WILL APPEAR IN GLOBAL & MY COLLECTIVE FEEDS
                            </span>

                            <div className="flex items-center gap-2.5 w-full sm:w-auto">
                                <button
                                    type="button"
                                    onClick={handleResetForm}
                                    disabled={isSubmitting || (!title && !content && !tagsInput && selectedMedia.length === 0)}
                                    className="px-3.5 py-2.5 bg-transparent hover:bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    Reset
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCancelOrBack}
                                    disabled={isSubmitting}
                                    className="flex-1 sm:flex-none px-4 py-2.5 bg-transparent hover:bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white text-xs font-bold uppercase tracking-wider transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || (!content.trim() && selectedMedia.length === 0)}
                                    className="flex-1 sm:flex-none px-6 py-2.5 bg-white text-black hover:bg-zinc-200 text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                            <span>BROADCASTING...</span>
                                        </>
                                    ) : (
                                        <>
                                            <SparklesIcon className="w-3.5 h-3.5 text-black" />
                                            <span>PUBLISH POST</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            ) : (
                /* --- VIEW 2: PUBLISHED COMMUNITY POSTS DASHBOARD --- */
                <div className="space-y-4">
                    {/* Header Banner: Title, Description & Action */}
                    <div className="bg-[#0c0c0e] border border-zinc-800 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <span className="text-zinc-500 uppercase tracking-widest text-[10px] block mb-0.5">
                                // MY_SPACE_UPLOADS
                            </span>
                            <h1 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider">
                                MY COMMUNITY POSTS
                            </h1>
                            <p className="text-xs text-zinc-400 mt-1">
                                Your contributions across the collectives you belong to.
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsPublishingOpen(true);
                                    setFormError(null);
                                }}
                                className="flex items-center gap-2 bg-white text-black hover:bg-zinc-200 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all shadow-sm"
                            >
                                <PlusIcon className="w-4 h-4 text-black" />
                                <span>CREATE POST</span>
                            </button>
                        </div>
                    </div>

                    {/* Filter, Sort & Search Toolbar (shown when user has posts) */}
                    {userCommunityPosts.length > 0 && (
                        <div className="bg-[#0c0c0e] border border-zinc-800 p-3 sm:p-3.5 space-y-3">
                            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                                {/* Left: Community Selector Dropdown */}
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">
                                        // COMMUNITY:
                                    </span>
                                    <select
                                        value={selectedFilterCommunityId}
                                        onChange={(e) => setSelectedFilterCommunityId(e.target.value)}
                                        className="bg-black border border-zinc-800 text-white text-xs px-3 py-1.5 outline-none focus:border-zinc-600 font-mono uppercase"
                                    >
                                        <option value="ALL">
                                            ALL COLLECTIVES ({userCommunityPosts.length})
                                        </option>
                                        {distinctPublishedCommunities.map(comm => (
                                            <option key={comm.id} value={comm.id}>
                                                {comm.name.toUpperCase()} ({comm.count})
                                            </option>
                                        ))}
                                    </select>
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

                                    {/* Search keyword input */}
                                    <div className="relative flex-1 sm:w-48 md:w-56">
                                        <MagnifyingGlassIcon className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Search posts..."
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
                                    SHOWING {displayedPosts.length} OF {userCommunityPosts.length} TRANSMISSIONS
                                </span>
                                {selectedFilterCommunityId !== 'ALL' && (
                                    <button
                                        type="button"
                                        onClick={() => setSelectedFilterCommunityId('ALL')}
                                        className="text-zinc-400 hover:text-white underline font-bold"
                                    >
                                        RESET FILTER
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* --- FEED STATE: LOADING / ERROR / EMPTY / POSTS LIST --- */}
                    {postsLoading ? (
                        <div className="py-20 flex flex-col justify-center items-center gap-3 bg-[#0c0c0e] border border-zinc-800">
                            <div className="w-8 h-8 border-2 border-zinc-500 border-t-white rounded-full animate-spin" />
                            <span className="text-xs text-zinc-500 uppercase tracking-widest">// LOADING_COMMUNITY_POSTS...</span>
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
                    ) : userCommunityPosts.length === 0 ? (
                        /* --- EMPTY STATE (Exact specification) --- */
                        <div className="flex flex-col items-center justify-center py-16 px-4 bg-[#0c0c0e] border border-zinc-800 text-center space-y-4">
                            <div className="max-w-md w-full space-y-3">
                                <span className="text-[10px] uppercase tracking-widest text-zinc-500 block">
                                    // NO_COMMUNITY_POSTS
                                </span>
                                <h2 className="text-base sm:text-lg font-bold text-white tracking-wider uppercase">
                                    NO COMMUNITY POSTS YET
                                </h2>
                                <p className="text-zinc-400 text-xs leading-relaxed">
                                    Your community contributions will appear here. Share your first post with a collective you're part of.
                                </p>
                                <div className="pt-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsPublishingOpen(true);
                                            setFormError(null);
                                        }}
                                        className="inline-flex items-center gap-2 bg-white text-black hover:bg-zinc-200 px-6 py-2.5 text-xs font-bold uppercase tracking-wider transition-all shadow-sm"
                                    >
                                        <PlusIcon className="w-4 h-4 text-black" />
                                        <span>CREATE YOUR FIRST POST</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : displayedPosts.length === 0 ? (
                        /* No search / filter results */
                        <div className="py-14 px-4 bg-[#0c0c0e] border border-zinc-800 text-center space-y-2">
                            <span className="text-[10px] text-zinc-500 uppercase tracking-widest block">// NO_MATCHING_POSTS</span>
                            <p className="text-xs text-zinc-400">No community posts match your current filter or search criteria.</p>
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedFilterCommunityId('ALL');
                                    setSearchQuery('');
                                }}
                                className="text-xs text-white underline font-bold uppercase tracking-wider pt-1"
                            >
                                Clear all filters
                            </button>
                        </div>
                    ) : (
                        /* --- POSTS CARDS GRID --- */
                        <div className="space-y-4">
                            {displayedPosts.map((post) => (
                                <UserCommunityPostCard
                                    key={post.id}
                                    post={post}
                                    onEdit={(p) => setPostToEdit(p)}
                                    onDelete={(id, title) => setPostToDelete({ id, title })}
                                    onImageClick={(imgUrl) => setPreviewImageUrl(imgUrl)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* --- MODAL 1: EDIT COMMUNITY POST MODAL --- */}
            {postToEdit && (
                <EditCommunityPostModal
                    isOpen={Boolean(postToEdit)}
                    post={postToEdit}
                    onClose={() => setPostToEdit(null)}
                    onSaved={(updated) => {
                        setUserCommunityPosts(prev => prev.map(p => p.id === updated.id ? updated : p));
                        setPostToEdit(null);
                        setActionSuccessMessage('Community post updated successfully.');
                        setTimeout(() => setActionSuccessMessage(null), 4000);
                    }}
                />
            )}

            {/* --- MODAL 2: DELETE CONFIRMATION MODAL --- */}
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
                                Are you sure you want to delete this community transmission?
                            </p>
                            {postToDelete.title && (
                                <div className="p-2.5 bg-black border border-zinc-850 text-xs text-white font-bold truncate">
                                    "{postToDelete.title}"
                                </div>
                            )}
                            <p className="text-[11px] text-zinc-500">
                                This action is permanent and will remove the post from both your dashboard and the community collective feed.
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
                                onClick={confirmDeletePost}
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

            {/* --- MODAL 3: IMAGE LIGHTBOX PREVIEW --- */}
            {previewImageUrl && (
                <div
                    className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
                    onClick={() => setPreviewImageUrl(null)}
                >
                    <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
                        <button
                            type="button"
                            onClick={() => setPreviewImageUrl(null)}
                            className="absolute -top-10 right-0 text-zinc-400 hover:text-white flex items-center gap-1 font-mono text-xs uppercase"
                        >
                            <CloseIcon className="w-5 h-5" />
                            <span>CLOSE</span>
                        </button>
                        <img
                            src={previewImageUrl}
                            alt="Attachment preview"
                            onError={handleImageError}
                            className="max-w-full max-h-[85vh] object-contain border border-zinc-800 shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default CommunitiesUploadHub;
