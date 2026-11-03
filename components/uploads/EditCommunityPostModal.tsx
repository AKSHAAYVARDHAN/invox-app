import React, { useState, useEffect } from 'react';
import type { Post } from '../../types';
import { updatePost } from '../../services/postService';
import { CloseIcon, SparklesIcon, CheckIcon } from '../ui/Icons';
import { handleImageError } from '../utils/imageUtils';

interface EditCommunityPostModalProps {
    isOpen: boolean;
    post: Post | null;
    onClose: () => void;
    onSaved: (updated: Post) => void;
}

export const EditCommunityPostModal: React.FC<EditCommunityPostModalProps> = ({
    isOpen,
    post,
    onClose,
    onSaved,
}) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [tagsInput, setTagsInput] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (post && isOpen) {
            setTitle(post.title || post.oneLine || '');
            setContent(post.content || '');
            setTagsInput(Array.isArray(post.tags) ? post.tags.join(', ') : '');
            setError(null);
        }
    }, [post, isOpen]);

    if (!isOpen || !post) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim()) {
            setError('Post message content cannot be empty.');
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            const tags = tagsInput
                .split(',')
                .map(t => t.trim().replace(/^#/, ''))
                .filter(Boolean);

            const trimmedTitle = title.trim();
            const trimmedContent = content.trim();

            const updated = await updatePost(post.id, {
                title: trimmedTitle || undefined,
                oneLine: trimmedTitle || trimmedContent.slice(0, 60),
                content: trimmedContent,
                tags,
                category: post.category || 'General',
                domain: post.domain || 'General',
            });

            onSaved(updated);
            onClose();
        } catch (err: any) {
            console.error('[EDIT_COMMUNITY_POST_ERROR]', err);
            setError(err?.message || 'Failed to update community post.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div 
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto font-mono"
            onClick={(e) => {
                if (e.target === e.currentTarget && !isSaving) onClose();
            }}
        >
            <div 
                className="bg-[#0c0c0e] border border-zinc-800 max-w-xl w-full p-5 sm:p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 my-6"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest">// EDIT_COMMUNITY_POST</span>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSaving}
                        className="text-zinc-500 hover:text-white p-1 transition-colors"
                        title="Close"
                    >
                        <CloseIcon className="w-4 h-4" />
                    </button>
                </div>

                {/* Target Community Info */}
                <div className="p-3 bg-zinc-950 border border-zinc-850 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <img
                            src={post.communityAvatarUrl || `https://picsum.photos/seed/${post.communityId || 'comm'}/200`}
                            alt={post.communityName || 'Community'}
                            onError={handleImageError}
                            className="w-8 h-8 object-cover border border-zinc-700 flex-shrink-0"
                        />
                        <div className="min-w-0">
                            <span className="text-[9px] text-zinc-500 uppercase font-bold block">// PUBLISHED TO</span>
                            <span className="text-xs font-bold text-white truncate block">
                                {post.communityName || 'Community Collective'}
                            </span>
                        </div>
                    </div>
                    {post.category && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-400">
                            {post.category}
                        </span>
                    )}
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="p-3 bg-red-950/40 border border-red-800 text-red-300 text-xs">
                        {error}
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-[11px] uppercase tracking-wider text-zinc-300 mb-1.5 font-bold">
                            Post Title <span className="text-zinc-500 text-[10px] font-normal">(Optional)</span>
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g., Scaling B2B architecture lessons..."
                            maxLength={120}
                            className="w-full bg-black border border-zinc-800 focus:border-zinc-500 text-white text-xs px-3 py-2.5 outline-none transition-colors"
                        />
                    </div>

                    <div>
                        <label className="block text-[11px] uppercase tracking-wider text-zinc-300 mb-1.5 font-bold">
                            Message Content <span className="text-emerald-400">*</span>
                        </label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Share technical insights, findings, or questions with the collective..."
                            rows={6}
                            required
                            className="w-full bg-black border border-zinc-800 focus:border-zinc-500 text-white text-xs p-3 outline-none transition-colors leading-relaxed resize-y"
                        />
                    </div>

                    <div>
                        <label className="block text-[11px] uppercase tracking-wider text-zinc-300 mb-1.5 font-bold">
                            Topic Tags <span className="text-zinc-500 text-[10px] font-normal">(Comma separated)</span>
                        </label>
                        <input
                            type="text"
                            value={tagsInput}
                            onChange={(e) => setTagsInput(e.target.value)}
                            placeholder="React, TypeScript, CloudSQL, Architecture"
                            className="w-full bg-black border border-zinc-800 focus:border-zinc-500 text-white text-xs px-3 py-2 outline-none transition-colors"
                        />
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSaving}
                            className="px-4 py-2 bg-transparent hover:bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white text-xs font-bold uppercase tracking-wider transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="px-5 py-2 bg-white text-black hover:bg-zinc-200 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors disabled:opacity-50"
                        >
                            {isSaving ? (
                                <>
                                    <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                    <span>SAVING...</span>
                                </>
                            ) : (
                                <>
                                    <CheckIcon className="w-3.5 h-3.5 text-black" />
                                    <span>SAVE CHANGES</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditCommunityPostModal;
