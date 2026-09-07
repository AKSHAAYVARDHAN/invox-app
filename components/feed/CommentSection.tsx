import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Post, PostComment } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeToPostComments, createPostComment } from '../../services/commentService';
import { formatRelativeTime } from '../../utils/dateUtils';
import { handleImageError } from '../utils/imageUtils';
import { CloseIcon, ChatIcon } from '../ui/Icons';

interface CommentSectionProps {
    post: Post;
    isOpen: boolean;
    onClose: () => void;
    onCommentAdded?: (postId: string) => void;
}

export const CommentSection: React.FC<CommentSectionProps> = ({
    post,
    isOpen,
    onClose,
    onCommentAdded,
}) => {
    const { currentUser, userProfile } = useAuth();
    const navigate = useNavigate();

    const [comments, setComments] = useState<PostComment[]>([]);
    const [loading, setLoading] = useState(true);
    const [text, setText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Subscribe to real-time comments for this specific thread
    useEffect(() => {
        if (!isOpen) return;

        setLoading(true);
        const unsubscribe = subscribeToPostComments(
            post.id,
            (items) => {
                setComments(items);
                setLoading(false);
            },
            (err) => {
                console.warn(`[THREAD_COMMENTS_ERR] for ${post.id}:`, err);
                setLoading(false);
            }
        );

        return () => {
            unsubscribe();
        };
    }, [post.id, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

        const trimmed = text.trim();
        if (!trimmed) {
            setErrorMessage('Comment cannot be empty.');
            return;
        }

        if (!currentUser) {
            navigate('/login');
            return;
        }

        setIsSubmitting(true);
        setErrorMessage(null);

        try {
            const author = {
                id: currentUser.uid,
                name: userProfile?.displayName || currentUser.displayName || 'Invox Member',
                avatarUrl: userProfile?.photoURL || currentUser.photoURL || `https://picsum.photos/seed/${currentUser.uid}/200`,
                username: userProfile?.username || '',
            };

            const newComment = await createPostComment({
                postId: post.id,
                postType: post.type,
                type: 'comment',
                text: trimmed,
                author,
            });

            // Optimistic instant addition to local state if not already caught by subscription
            setComments(prev => {
                if (prev.some(c => c.id === newComment.id)) return prev;
                return [newComment, ...prev];
            });

            setText('');
            onCommentAdded?.(post.id);
        } catch (err: any) {
            console.error('[COMMENT_SUBMIT_FAILED]', err);
            setErrorMessage(err.message || 'Failed to publish comment. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="mt-3 border-t border-zinc-800/80 pt-3 text-zinc-300 font-mono transition-all">
            {/* Header bar */}
            <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-zinc-800/60">
                <div className="flex items-center gap-2 text-xs">
                    <ChatIcon className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="text-white font-bold tracking-wider uppercase">// COMMENTS</span>
                    <span className="text-zinc-500 text-[11px]">[{comments.length}]</span>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="text-zinc-500 hover:text-white transition-colors text-[10px] uppercase font-mono tracking-wider flex items-center gap-1"
                    aria-label="Collapse comment area"
                >
                    <span>// COLLAPSE</span>
                    <CloseIcon className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Existing Comments List */}
            {loading ? (
                <div className="py-5 text-center text-zinc-600 text-xs">
                    <span className="animate-pulse">// RETRIEVING COMMENTS STREAM...</span>
                </div>
            ) : comments.length === 0 ? (
                <div className="py-4 text-center text-zinc-600 text-[11px] uppercase tracking-wider border border-dashed border-zinc-800/60 bg-black/30 my-2">
                    // NO COMMENTS YET. BE THE FIRST TO RESPOND.
                </div>
            ) : (
                <div className="space-y-2.5 mb-3 max-h-80 overflow-y-auto pr-1">
                    {comments.map((comment) => (
                        <div
                            key={comment.id}
                            className="bg-black/50 border border-zinc-800/70 p-2.5 text-xs transition-colors hover:border-zinc-700/80"
                        >
                            <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                    <img
                                        src={comment.authorAvatar}
                                        onError={handleImageError}
                                        alt={comment.authorName}
                                        className="w-5 h-5 rounded-none object-cover border border-zinc-700 shrink-0"
                                    />
                                    <div className="flex items-center gap-1.5">
                                        <span className="font-bold text-white uppercase tracking-wider text-[11px]">
                                            {comment.authorName}
                                        </span>
                                        {comment.authorUsername && (
                                            <span className="text-zinc-500 text-[10px]">
                                                @{comment.authorUsername}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <span className="text-[10px] text-zinc-500 shrink-0">
                                    {formatRelativeTime(comment.createdAt)}
                                </span>
                            </div>
                            <p className="text-zinc-300 text-xs leading-relaxed pl-7 break-words whitespace-pre-wrap">
                                {comment.text}
                            </p>
                        </div>
                    ))}
                </div>
            )}

            {/* Error Message */}
            {errorMessage && (
                <div className="mb-2.5 px-3 py-2 bg-rose-950/40 border border-rose-800/60 text-rose-400 text-xs flex items-center justify-between">
                    <span>// ERROR: {errorMessage}</span>
                    <button
                        type="button"
                        onClick={() => setErrorMessage(null)}
                        className="text-zinc-400 hover:text-white text-xs ml-2"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Comment Composer */}
            {currentUser ? (
                <form onSubmit={handleSubmit} className="border-t border-zinc-800/60 pt-2.5 space-y-2">
                    <textarea
                        value={text}
                        onChange={(e) => {
                            setText(e.target.value);
                            if (errorMessage) setErrorMessage(null);
                        }}
                        placeholder="// Write a comment..."
                        rows={2}
                        disabled={isSubmitting}
                        className="w-full bg-black/60 border border-zinc-800 focus:border-zinc-500 text-white font-mono text-xs p-2.5 outline-none resize-none placeholder:text-zinc-600 transition-colors disabled:opacity-50"
                    />
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-zinc-600">
                            {text.trim().length > 0 ? `// ${text.trim().length} CHARACTERS` : '// PARTICIPATE IN THREAD'}
                        </span>
                        <button
                            type="submit"
                            disabled={!text.trim() || isSubmitting}
                            className="bg-white text-black font-mono text-xs uppercase tracking-wider px-4 py-1.5 hover:bg-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                        >
                            {isSubmitting ? (
                                <span className="animate-pulse">// TRANSMITTING...</span>
                            ) : (
                                <span>[COMMENT]</span>
                            )}
                        </button>
                    </div>
                </form>
            ) : (
                <div className="border-t border-zinc-800/60 pt-2.5">
                    <div className="border border-dashed border-zinc-800 bg-zinc-950/60 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                        <div className="flex items-center gap-2 text-zinc-400">
                            <span className="text-zinc-600">//</span>
                            <span>Sign in to submit a comment on this thread</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate('/login')}
                            className="px-3 py-1.5 bg-zinc-900 border border-zinc-700 text-white hover:bg-zinc-800 text-[11px] font-mono uppercase tracking-wider transition-colors shrink-0 text-center"
                        >
                            // SIGN IN
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
