import React, { useState, useEffect, useRef } from 'react';
import { 
    CloseIcon, 
    ArrowUpTrayIcon, 
    TrashIcon, 
    GlobeAltIcon, 
    CodeBracketIcon, 
    DocumentTextIcon, 
    TagIcon,
    SparklesIcon
} from '../ui/Icons';
import { updatePost } from '../../services/postService';
import type { Post, Project } from '../../types';

interface EditShowcaseModalProps {
    isOpen: boolean;
    post: Post | Project | null;
    onClose: () => void;
    onUpdated?: (updated: Post) => void;
}

const SHOWCASE_DOMAINS = [
    'Technology',
    'AI & Machine Learning',
    'App Development',
    'Design & UI/UX',
    'Research & Science',
    'Cybersecurity',
    'Web3 & Blockchain',
    'Gaming',
    'Hardware & IoT',
    'Creative Arts'
];

export const EditShowcaseModal: React.FC<EditShowcaseModalProps> = ({
    isOpen,
    post,
    onClose,
    onUpdated,
}) => {
    // Form fields
    const [title, setTitle] = useState('');
    const [oneLine, setOneLine] = useState('');
    const [content, setContent] = useState('');
    const [domain, setDomain] = useState('Technology');
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');

    // Links
    const [demoUrl, setDemoUrl] = useState('');
    const [githubUrl, setGithubUrl] = useState('');
    const [articleUrl, setArticleUrl] = useState('');

    // Media
    const [existingMediaUrl, setExistingMediaUrl] = useState<string | null>(null);
    const [newMediaFile, setNewMediaFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
    const [isMediaRemoved, setIsMediaRemoved] = useState(false);

    // Status
    const [status, setStatus] = useState<'published' | 'draft'>('published');

    // UI state
    const [isSaving, setIsSaving] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Populate form from target post/project
    useEffect(() => {
        if (isOpen && post) {
            const p = post as any;
            setTitle(p.title || p.name || p.oneLine || p.aiSummary || '');
            setOneLine(p.oneLine || p.aiSummary || p.title || '');
            setContent(p.content || p.description || '');
            setDomain(p.domain || p.category || 'Technology');
            setTags(Array.isArray(p.tags) ? [...p.tags] : []);
            setDemoUrl(p.demoUrl || '');
            setGithubUrl(p.githubUrl || p.repoUrl || '');
            setArticleUrl(p.articleUrl || '');
            setStatus(p.status === 'draft' ? 'draft' : 'published');

            setExistingMediaUrl(p.mediaUrl || null);
            setMediaType(p.mediaType || (p.mediaUrl?.includes('.mp4') ? 'video' : 'image'));
            setNewMediaFile(null);
            setPreviewUrl(null);
            setIsMediaRemoved(false);
            setUploadProgress(0);
            setErrorMessage(null);
        }
    }, [isOpen, post]);

    // Lock body scroll
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen || !post) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 20 * 1024 * 1024) {
            setErrorMessage('Media exceeds 20MB limit.');
            return;
        }

        setNewMediaFile(file);
        setIsMediaRemoved(false);
        const objUrl = URL.createObjectURL(file);
        setPreviewUrl(objUrl);
        setMediaType(file.type.startsWith('video') ? 'video' : 'image');
    };

    const handleRemoveMedia = () => {
        setNewMediaFile(null);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        setExistingMediaUrl(null);
        setIsMediaRemoved(true);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleAddTag = () => {
        const cleaned = tagInput.trim().replace(/^#/, '');
        if (cleaned && !tags.includes(cleaned) && tags.length < 8) {
            setTags(prev => [...prev, cleaned]);
            setTagInput('');
        }
    };

    const handleRemoveTag = (tagToRemove: string) => {
        setTags(prev => prev.filter(t => t !== tagToRemove));
    };

    const validateUrl = (urlStr: string): boolean => {
        if (!urlStr.trim()) return true;
        try {
            const u = new URL(urlStr);
            return u.protocol === 'http:' || u.protocol === 'https:';
        } catch {
            return false;
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedTitle = title.trim();
        const trimmedOneLine = oneLine.trim();
        const trimmedContent = content.trim();

        if (!trimmedTitle) {
            setErrorMessage('Title cannot be empty.');
            return;
        }
        if (!trimmedOneLine) {
            setErrorMessage('Short summary cannot be empty.');
            return;
        }
        if (!trimmedContent) {
            setErrorMessage('Description cannot be empty.');
            return;
        }

        if (demoUrl && !validateUrl(demoUrl)) {
            setErrorMessage('Please enter a valid Demo URL.');
            return;
        }
        if (githubUrl && !validateUrl(githubUrl)) {
            setErrorMessage('Please enter a valid Repository URL.');
            return;
        }
        if (articleUrl && !validateUrl(articleUrl)) {
            setErrorMessage('Please enter a valid Article URL.');
            return;
        }

        setIsSaving(true);
        setErrorMessage(null);

        try {
            const updates: any = {
                title: trimmedTitle,
                oneLine: trimmedOneLine,
                content: trimmedContent,
                category: domain,
                domain: domain,
                tags,
                demoUrl: demoUrl.trim() || undefined,
                githubUrl: githubUrl.trim() || undefined,
                repoUrl: githubUrl.trim() || undefined,
                articleUrl: articleUrl.trim() || undefined,
                status,
                isPublished: status !== 'draft',
            };

            if (newMediaFile) {
                updates.mediaFile = newMediaFile;
                updates.mediaType = mediaType;
            } else if (isMediaRemoved) {
                updates.mediaUrl = null;
                updates.mediaType = null;
            }

            const updated = await updatePost(post.id, updates, (progress) => {
                setUploadProgress(progress);
            });

            onUpdated?.(updated);
            onClose();
        } catch (err: any) {
            console.error('[EDIT_SHOWCASE_ERROR]', err);
            setErrorMessage(err?.message || 'Failed to update Showcase project.');
        } finally {
            setIsSaving(false);
        }
    };

    const displayMediaUrl = previewUrl || (!isMediaRemoved ? existingMediaUrl : null);

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn overflow-y-auto">
            <div className="relative w-full max-w-3xl bg-[#0c0c0e] border border-zinc-800 shadow-2xl text-white font-mono my-6 flex flex-col max-h-[92vh]">
                
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between flex-shrink-0 bg-black/60">
                    <div className="flex items-center gap-2.5">
                        <div className="w-2.5 h-2.5 bg-amber-400"></div>
                        <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white">
                            // EDIT_SHOWCASE_PROJECT : {title.slice(0, 24)}...
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isSaving}
                        className="p-1 text-zinc-400 hover:text-white transition-colors"
                        aria-label="Close"
                    >
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSave} className="overflow-y-auto p-4 sm:p-6 space-y-5 flex-1 no-scrollbar">
                    {errorMessage && (
                        <div className="p-3 bg-red-950/40 border border-red-800/80 text-red-300 text-xs font-mono flex items-start gap-2">
                            <span className="font-bold text-red-400">// ERROR:</span>
                            <span>{errorMessage}</span>
                        </div>
                    )}

                    {/* Title */}
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-[11px] uppercase font-bold text-zinc-300 tracking-wider">
                                // PROJECT_TITLE <span className="text-red-400">*</span>
                            </label>
                            <span className="text-[10px] text-zinc-500">{title.length}/100</span>
                        </div>
                        <input
                            type="text"
                            maxLength={100}
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-black/80 border border-zinc-800 p-2.5 text-xs text-white focus:outline-none focus:border-zinc-500"
                            required
                        />
                    </div>

                    {/* Domain & Status */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-[11px] uppercase font-bold text-zinc-300 tracking-wider block mb-1">
                                // DOMAIN_CATEGORY
                            </label>
                            <select
                                value={domain}
                                onChange={(e) => setDomain(e.target.value)}
                                className="w-full bg-black/80 border border-zinc-800 p-2.5 text-xs text-white focus:outline-none focus:border-zinc-500"
                            >
                                {SHOWCASE_DOMAINS.map(d => (
                                    <option key={d} value={d} className="bg-zinc-950 text-white">
                                        {d}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-[11px] uppercase font-bold text-zinc-300 tracking-wider block mb-1">
                                // STATUS
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setStatus('published')}
                                    className={`py-2 px-3 text-xs uppercase tracking-wider font-bold border text-center transition-all ${
                                        status === 'published'
                                            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-600'
                                            : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-white'
                                    }`}
                                >
                                    ● Published
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setStatus('draft')}
                                    className={`py-2 px-3 text-xs uppercase tracking-wider font-bold border text-center transition-all ${
                                        status === 'draft'
                                            ? 'bg-amber-950/60 text-amber-300 border-amber-600'
                                            : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-white'
                                    }`}
                                >
                                    Draft Only
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Short Summary */}
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-[11px] uppercase font-bold text-zinc-300 tracking-wider">
                                // SHORT_SUMMARY / HOOK <span className="text-red-400">*</span>
                            </label>
                            <span className="text-[10px] text-zinc-500">{oneLine.length}/180</span>
                        </div>
                        <input
                            type="text"
                            maxLength={180}
                            value={oneLine}
                            onChange={(e) => setOneLine(e.target.value)}
                            className="w-full bg-black/80 border border-zinc-800 p-2.5 text-xs text-white focus:outline-none focus:border-zinc-500"
                            required
                        />
                    </div>

                    {/* Content */}
                    <div>
                        <label className="text-[11px] uppercase font-bold text-zinc-300 tracking-wider block mb-1">
                            // DETAILED_DESCRIPTION <span className="text-red-400">*</span>
                        </label>
                        <textarea
                            rows={4}
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="w-full bg-black/80 border border-zinc-800 p-3 text-xs text-white focus:outline-none focus:border-zinc-500 leading-relaxed"
                            required
                        />
                    </div>

                    {/* Tags */}
                    <div>
                        <label className="text-[11px] uppercase font-bold text-zinc-300 tracking-wider block mb-1">
                            // TAGS
                        </label>
                        <div className="flex gap-2 mb-2">
                            <input
                                type="text"
                                placeholder="Add tag and press Enter..."
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ',') {
                                        e.preventDefault();
                                        handleAddTag();
                                    }
                                }}
                                className="flex-1 bg-black/80 border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-500"
                            />
                            <button
                                type="button"
                                onClick={handleAddTag}
                                className="px-3 py-2 bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-xs uppercase text-white"
                            >
                                + Add
                            </button>
                        </div>
                        {tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {tags.map(t => (
                                    <span key={t} className="inline-flex items-center gap-1.5 bg-zinc-900 border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-200">
                                        <span>#{t}</span>
                                        <button type="button" onClick={() => handleRemoveTag(t)} className="text-zinc-400 hover:text-white">×</button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Media */}
                    <div>
                        <label className="text-[11px] uppercase font-bold text-zinc-300 tracking-wider block mb-1">
                            // ATTACHED_MEDIA
                        </label>
                        {displayMediaUrl ? (
                            <div className="relative border border-zinc-800 bg-black aspect-video overflow-hidden">
                                {mediaType === 'video' ? (
                                    <video src={displayMediaUrl} controls className="w-full h-full object-cover" />
                                ) : (
                                    <img src={displayMediaUrl} alt="Cover" className="w-full h-full object-cover" />
                                )}
                                <div className="absolute top-2 right-2 flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleRemoveMedia}
                                        className="bg-black/80 border border-red-500/80 text-red-300 p-1.5 hover:bg-red-950 transition-colors"
                                        title="Remove media"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full border-2 border-dashed border-zinc-800 hover:border-zinc-600 bg-black/40 p-5 text-center text-zinc-400 hover:text-white transition-colors"
                            >
                                <ArrowUpTrayIcon className="w-6 h-6 mx-auto mb-1 text-zinc-500" />
                                <span className="text-xs uppercase font-bold tracking-wider">Click to attach new image or video</span>
                            </button>
                        )}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*,video/mp4,video/webm"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                    </div>

                    {/* Links */}
                    <div className="space-y-3 pt-2 border-t border-zinc-800/80">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">// EXTERNAL_LINKS</span>
                        <div className="flex items-center gap-2">
                            <GlobeAltIcon className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                            <input
                                type="url"
                                placeholder="Live Demo URL"
                                value={demoUrl}
                                onChange={(e) => setDemoUrl(e.target.value)}
                                className="flex-1 bg-black/80 border border-zinc-800 p-2 text-xs text-white focus:outline-none focus:border-zinc-500"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <CodeBracketIcon className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                            <input
                                type="url"
                                placeholder="Repository URL"
                                value={githubUrl}
                                onChange={(e) => setGithubUrl(e.target.value)}
                                className="flex-1 bg-black/80 border border-zinc-800 p-2 text-xs text-white focus:outline-none focus:border-zinc-500"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <DocumentTextIcon className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                            <input
                                type="url"
                                placeholder="Article or Paper URL"
                                value={articleUrl}
                                onChange={(e) => setArticleUrl(e.target.value)}
                                className="flex-1 bg-black/80 border border-zinc-800 p-2 text-xs text-white focus:outline-none focus:border-zinc-500"
                            />
                        </div>
                    </div>

                    {uploadProgress > 0 && uploadProgress < 100 && (
                        <div className="p-3 bg-zinc-950 border border-zinc-800">
                            <div className="flex justify-between text-[11px] mb-1">
                                <span className="text-zinc-400 font-bold">// UPLOADING_NEW_MEDIA...</span>
                                <span className="text-white font-mono">{uploadProgress}%</span>
                            </div>
                            <div className="w-full bg-zinc-900 h-1.5 overflow-hidden">
                                <div className="bg-white h-full transition-all duration-200" style={{ width: `${uploadProgress}%` }}></div>
                            </div>
                        </div>
                    )}
                </form>

                {/* Footer */}
                <div className="p-4 border-t border-zinc-800 flex items-center justify-between flex-shrink-0 bg-black/60">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSaving}
                        className="px-4 py-2 border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-5 py-2 bg-white hover:bg-zinc-200 text-black font-bold text-xs uppercase tracking-wider transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        {isSaving ? (
                            <>
                                <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                                <span>Saving Changes...</span>
                            </>
                        ) : (
                            <span>Save Changes</span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
