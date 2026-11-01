import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { createPost } from '../../services/postService';
import type { JoinedCommunityRecord } from '../../services/communityService';
import type { Post } from '../../types';
import { PostType } from '../../types';
import { 
    CloseIcon, 
    SparklesIcon, 
    UsersIcon, 
    PhotoIcon, 
    VideoCameraIcon, 
    PlayIcon,
    TrashIcon 
} from '../ui/Icons';
import { handleImageError } from '../utils/imageUtils';

interface SelectedMediaItem {
    id: string;
    file: File;
    previewUrl: string;
    type: 'image' | 'video';
    name: string;
    sizeFormatted: string;
}

interface CreateCommunityPostModalProps {
    isOpen: boolean;
    onClose: () => void;
    joinedCommunities: JoinedCommunityRecord[];
    preselectedCommunityId?: string;
    onPostCreated: (newPost: Post) => void;
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

export const CreateCommunityPostModal: React.FC<CreateCommunityPostModalProps> = ({
    isOpen,
    onClose,
    joinedCommunities,
    preselectedCommunityId,
    onPostCreated,
}) => {
    const { currentUser, userProfile } = useAuth();
    const [selectedCommunityId, setSelectedCommunityId] = useState<string>('');
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [tagsInput, setTagsInput] = useState('');
    const [selectedMedia, setSelectedMedia] = useState<SelectedMediaItem[]>([]);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    const imageInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (preselectedCommunityId) {
            setSelectedCommunityId(preselectedCommunityId);
        } else if (joinedCommunities.length > 0 && !selectedCommunityId) {
            setSelectedCommunityId(joinedCommunities[0].id);
        }
    }, [preselectedCommunityId, joinedCommunities, selectedCommunityId]);

    // Clean up created object URLs on unmount or media removal
    const clearMedia = useCallback(() => {
        selectedMedia.forEach(item => {
            if (item.previewUrl.startsWith('blob:')) {
                URL.revokeObjectURL(item.previewUrl);
            }
        });
        setSelectedMedia([]);
    }, [selectedMedia]);

    const handleClose = () => {
        if (submitting) return;
        clearMedia();
        setError(null);
        setUploadProgress(null);
        setTitle('');
        setContent('');
        setTagsInput('');
        onClose();
    };

    if (!isOpen) return null;

    const selectedCommunity = joinedCommunities.find(c => c.id === selectedCommunityId) || joinedCommunities[0];

    // Validate and process selected files
    const processFiles = (files: FileList | File[]) => {
        setError(null);
        const fileArray = Array.from(files);
        if (fileArray.length === 0) return;

        const newItems: SelectedMediaItem[] = [];

        for (const file of fileArray) {
            const isImg = ALLOWED_IMAGE_TYPES.includes(file.type) || file.type.startsWith('image/');
            const isVid = ALLOWED_VIDEO_TYPES.includes(file.type) || file.type.startsWith('video/');

            if (!isImg && !isVid) {
                setError(`Unsupported file format "${file.name}". Please select PNG, JPG, WEBP, or MP4.`);
                return;
            }

            if (isVid) {
                // If a video is already selected or we already have images, prevent mixing video with other files
                if (file.size > MAX_VIDEO_SIZE_BYTES) {
                    setError(`Video file "${file.name}" exceeds the 50MB size threshold.`);
                    return;
                }

                // If adding video, replace any existing attachments
                clearMedia();
                const previewUrl = URL.createObjectURL(file);
                setSelectedMedia([{
                    id: `vid-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                    file,
                    previewUrl,
                    type: 'video',
                    name: file.name,
                    sizeFormatted: formatBytes(file.size)
                }]);
                return;
            }

            if (isImg) {
                if (file.size > MAX_IMAGE_SIZE_BYTES) {
                    setError(`Image "${file.name}" exceeds the 15MB size limit.`);
                    return;
                }

                // If existing selection contains a video, replace it with image
                const existingImages = selectedMedia.filter(m => m.type === 'image');
                if (existingImages.length + newItems.length >= MAX_IMAGES_COUNT) {
                    setError(`Maximum of ${MAX_IMAGES_COUNT} images can be attached to a community post.`);
                    break;
                }

                const previewUrl = URL.createObjectURL(file);
                newItems.push({
                    id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                    file,
                    previewUrl,
                    type: 'image',
                    name: file.name,
                    sizeFormatted: formatBytes(file.size)
                });
            }
        }

        if (newItems.length > 0) {
            setSelectedMedia(prev => {
                const filtered = prev.filter(m => m.type === 'image');
                const combined = [...filtered, ...newItems].slice(0, MAX_IMAGES_COUNT);
                return combined;
            });
        }
    };

    const handleImageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            processFiles(e.target.files);
            e.target.value = '';
        }
    };

    const handleVideoInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            processFiles(e.target.files);
            e.target.value = '';
        }
    };

    const removeMediaItem = (id: string) => {
        setSelectedMedia(prev => {
            const item = prev.find(m => m.id === id);
            if (item && item.previewUrl.startsWith('blob:')) {
                URL.revokeObjectURL(item.previewUrl);
            }
            return prev.filter(m => m.id !== id);
        });
    };

    // Drag and drop handlers
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processFiles(e.dataTransfer.files);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser?.uid) {
            setError('Authentication required to dispatch public communication.');
            return;
        }

        if (!selectedCommunity) {
            setError('Please select an active collective to publish into.');
            return;
        }

        if (!content.trim() && selectedMedia.length === 0) {
            setError('Post must contain written technical content or media attachment.');
            return;
        }

        setSubmitting(true);
        setError(null);
        setUploadProgress(0);

        try {
            const tags = tagsInput
                .split(',')
                .map(t => t.trim().replace(/^#/, ''))
                .filter(Boolean);

            const comm = selectedCommunity.community;
            const mediaFiles = selectedMedia.map(m => m.file);
            const isVideoPost = selectedMedia.length > 0 && selectedMedia[0].type === 'video';

            // Also prepare fallback data URLs or preview URLs in case Storage uploads are constrained
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

            onPostCreated(newPost);
            handleClose();
        } catch (err: any) {
            console.error('[CREATE_COMMUNITY_POST_ERROR]', err);
            setError(err?.message || 'Failed to dispatch post to collective feed.');
        } finally {
            setSubmitting(false);
            setUploadProgress(null);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div 
                className={`bg-[#0c0c0e] border ${
                    isDragging ? 'border-emerald-500 bg-emerald-950/10' : 'border-zinc-800'
                } max-w-xl w-full p-5 sm:p-6 space-y-5 font-mono shadow-2xl animate-in fade-in zoom-in-95 duration-150 my-6`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                    <div>
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest block">
                            // DISPATCH_SIGNAL
                        </span>
                        <h3 className="text-sm font-bold text-white uppercase">
                            CREATE COMMUNITY POST
                        </h3>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={submitting}
                        className="p-1 text-zinc-500 hover:text-white transition-colors cursor-pointer"
                        aria-label="Close dialog"
                    >
                        <CloseIcon className="w-4 h-4" />
                    </button>
                </div>

                {error && (
                    <div className="p-3 bg-rose-950/40 border border-rose-500/50 text-rose-300 text-xs">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                    {/* Collective Selection */}
                    <div>
                        <label className="block text-zinc-400 uppercase text-[10px] tracking-wider mb-1.5">
                            TARGET COLLECTIVE *
                        </label>
                        <select
                            value={selectedCommunityId}
                            onChange={(e) => setSelectedCommunityId(e.target.value)}
                            disabled={submitting}
                            className="w-full bg-black border border-zinc-800 p-2.5 font-mono text-xs text-white focus:outline-none focus:border-zinc-600 cursor-pointer"
                        >
                            {joinedCommunities.map(item => (
                                <option key={item.id} value={item.id}>
                                    {item.community.name} [{item.community.category || 'General'}]
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Title */}
                    <div>
                        <label className="block text-zinc-400 uppercase text-[10px] tracking-wider mb-1.5">
                            TOPIC / HEADLINE (OPTIONAL)
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            disabled={submitting}
                            placeholder="Brief technical topic or thesis..."
                            className="w-full bg-black border border-zinc-800 p-2.5 font-mono text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
                        />
                    </div>

                    {/* Content */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-zinc-400 uppercase text-[10px] tracking-wider">
                                COMMUNICATION CONTENT *
                            </label>
                            <span className="text-[10px] text-zinc-600">
                                {content.length} CHARS
                            </span>
                        </div>
                        <textarea
                            rows={5}
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            disabled={submitting}
                            placeholder="Share architectural insights, reproducible benchmarks, questions, or ideas with your collective..."
                            className="w-full bg-black border border-zinc-800 p-2.5 font-mono text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 resize-none leading-relaxed"
                        />
                    </div>

                    {/* Media Attachments Preview Gallery */}
                    {selectedMedia.length > 0 && (
                        <div className="space-y-2 border border-zinc-800/80 bg-black/60 p-3">
                            <div className="flex items-center justify-between text-[10px] text-zinc-400 uppercase tracking-wider">
                                <span>
                                    // ATTACHMENTS ({selectedMedia.length})
                                </span>
                                <button
                                    type="button"
                                    onClick={clearMedia}
                                    disabled={submitting}
                                    className="text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                                >
                                    REMOVE ALL
                                </button>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {selectedMedia.map(item => (
                                    <div
                                        key={item.id}
                                        className="relative group border border-zinc-800 bg-zinc-950 aspect-video sm:aspect-square overflow-hidden"
                                    >
                                        {item.type === 'video' ? (
                                            <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 p-2 text-center">
                                                <PlayIcon className="w-6 h-6 text-emerald-400 mb-1" />
                                                <span className="text-[9px] text-zinc-300 truncate max-w-full">
                                                    {item.name}
                                                </span>
                                                <span className="text-[8px] text-zinc-500 font-mono">
                                                    {item.sizeFormatted}
                                                </span>
                                            </div>
                                        ) : (
                                            <img
                                                src={item.previewUrl}
                                                alt={item.name}
                                                onError={handleImageError}
                                                className="w-full h-full object-cover"
                                            />
                                        )}

                                        {/* Remove button */}
                                        <button
                                            type="button"
                                            onClick={() => removeMediaItem(item.id)}
                                            disabled={submitting}
                                            className="absolute top-1 right-1 p-1 bg-black/80 text-zinc-400 hover:text-white hover:bg-rose-900/80 transition-colors border border-zinc-700"
                                            title="Remove attachment"
                                        >
                                            <CloseIcon className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Media Attachment Control Buttons */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                        {/* Hidden file inputs */}
                        <input
                            ref={imageInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/gif"
                            multiple
                            onChange={handleImageInputChange}
                            className="hidden"
                        />
                        <input
                            ref={videoInputRef}
                            type="file"
                            accept="video/mp4,video/webm,video/quicktime"
                            onChange={handleVideoInputChange}
                            className="hidden"
                        />

                        {/* Image Button */}
                        <button
                            type="button"
                            onClick={() => imageInputRef.current?.click()}
                            disabled={submitting || (selectedMedia.length > 0 && selectedMedia[0].type === 'video') || selectedMedia.length >= MAX_IMAGES_COUNT}
                            className="px-3 py-1.5 bg-black border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white text-xs font-mono flex items-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer"
                        >
                            <PhotoIcon className="w-4 h-4 text-emerald-400" />
                            <span>ATTACH IMAGE(S)</span>
                        </button>

                        {/* Video Button */}
                        <button
                            type="button"
                            onClick={() => videoInputRef.current?.click()}
                            disabled={submitting || (selectedMedia.length > 0 && selectedMedia[0].type === 'image')}
                            className="px-3 py-1.5 bg-black border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white text-xs font-mono flex items-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer"
                        >
                            <VideoCameraIcon className="w-4 h-4 text-cyan-400" />
                            <span>ATTACH VIDEO</span>
                        </button>

                        <span className="text-[10px] text-zinc-500 font-mono ml-auto">
                            Drag & drop supported
                        </span>
                    </div>

                    {/* Upload Progress Bar */}
                    {uploadProgress !== null && (
                        <div className="space-y-1.5 pt-2">
                            <div className="flex justify-between items-center text-[10px] text-zinc-400 font-mono">
                                <span>TRANSMITTING ASSETS TO CLUSTER...</span>
                                <span className="text-emerald-400 font-bold">{uploadProgress}%</span>
                            </div>
                            <div className="w-full bg-zinc-900 border border-zinc-800 h-1.5 overflow-hidden">
                                <div
                                    className="bg-emerald-400 h-full transition-all duration-150"
                                    style={{ width: `${uploadProgress}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Topic Tags */}
                    <div>
                        <label className="block text-zinc-400 uppercase text-[10px] tracking-wider mb-1.5">
                            TOPIC TAGS (COMMA-SEPARATED)
                        </label>
                        <input
                            type="text"
                            value={tagsInput}
                            onChange={(e) => setTagsInput(e.target.value)}
                            disabled={submitting}
                            placeholder="Architecture, Rust, Scaling, Benchmarks"
                            className="w-full bg-black border border-zinc-800 p-2.5 font-mono text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
                        />
                    </div>

                    {/* Actions */}
                    <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-3">
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={submitting}
                            className="px-4 py-2 font-mono text-xs uppercase font-bold text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700 bg-transparent transition-colors cursor-pointer"
                        >
                            CANCEL
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-4 py-2 font-mono text-xs uppercase font-bold bg-white text-black hover:bg-zinc-200 transition-colors border border-white flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                            {submitting ? (
                                <>
                                    <span className="w-3 h-3 border-2 border-black border-t-transparent animate-spin inline-block"></span>
                                    <span>TRANSMITTING...</span>
                                </>
                            ) : (
                                <span>PUBLISH TO COLLECTIVE</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateCommunityPostModal;
