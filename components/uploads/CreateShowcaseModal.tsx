import React, { useState, useEffect, useRef } from 'react';
import { 
    CloseIcon, 
    ArrowUpTrayIcon, 
    SparklesIcon, 
    LinkIcon, 
    TrashIcon, 
    CheckBadgeIcon, 
    GlobeAltIcon, 
    CodeBracketIcon, 
    DocumentTextIcon, 
    XMarkIcon 
} from '../ui/Icons';
import { useAuth } from '../../contexts/AuthContext';
import { createPost } from '../../services/postService';
import { Post, PostType } from '../../types';
import { TargetDomainSelector } from '../ui/TargetDomainSelector';

interface CreateShowcaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onPublished?: (newPost: Post) => void;
}

const PRESET_DOMAINS = [
    'Machine Learning',
    'Cybersecurity',
    'App Development',
    'Design',
    'Fintech',
    'Web3',
    'Gaming',
    'Hardware',
    'Cloud Architecture',
    'Bioinformatics',
];

export const CreateShowcaseModal: React.FC<CreateShowcaseModalProps> = ({
    isOpen,
    onClose,
    onPublished,
}) => {
    const { currentUser, userProfile } = useAuth();

    // Form fields
    const [title, setTitle] = useState('');
    const [oneLine, setOneLine] = useState('');
    const [description, setDescription] = useState('');
    const [domain, setDomain] = useState('Machine Learning');
    const [customDomain, setCustomDomain] = useState('');
    const [tagInput, setTagInput] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    
    // Project Links
    const [demoUrl, setDemoUrl] = useState('');
    const [githubUrl, setGithubUrl] = useState('');
    const [articleUrl, setArticleUrl] = useState('');
    
    // Status
    const [status, setStatus] = useState<'published' | 'draft'>('published');

    // Media
    const [mediaFile, setMediaFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // State
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

    // Draft persistence
    const draftKey = `invox-draft-showcase-${currentUser?.uid || 'guest'}`;

    useEffect(() => {
        if (isOpen) {
            const savedDraft = localStorage.getItem(draftKey);
            if (savedDraft) {
                try {
                    const parsed = JSON.parse(savedDraft);
                    setTitle(parsed.title || '');
                    setOneLine(parsed.oneLine || '');
                    setDescription(parsed.description || '');
                    setDomain(parsed.domain || 'Machine Learning');
                    setTags(parsed.tags || []);
                    setDemoUrl(parsed.demoUrl || '');
                    setGithubUrl(parsed.githubUrl || '');
                    setArticleUrl(parsed.articleUrl || '');
                } catch (e) {
                    console.error('Failed to parse showcase draft', e);
                }
            }
        }
    }, [isOpen, draftKey]);

    useEffect(() => {
        if (!isOpen) return;
        const autoSaveTimer = setTimeout(() => {
            if (title || oneLine || description) {
                localStorage.setItem(draftKey, JSON.stringify({
                    title,
                    oneLine,
                    description,
                    domain,
                    tags,
                    demoUrl,
                    githubUrl,
                    articleUrl,
                }));
            }
        }, 800);
        return () => clearTimeout(autoSaveTimer);
    }, [title, oneLine, description, domain, tags, demoUrl, githubUrl, articleUrl, isOpen, draftKey]);

    // Handle body scroll locking
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

    // Escape listener
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                if (showDiscardConfirm) {
                    setShowDiscardConfirm(false);
                } else {
                    handleAttemptClose();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, showDiscardConfirm, title, oneLine, description, mediaFile]);

    if (!isOpen) return null;

    const handleAttemptClose = () => {
        if (isSubmitting) return;
        if (title.trim() || oneLine.trim() || description.trim() || mediaFile) {
            setShowDiscardConfirm(true);
        } else {
            onClose();
        }
    };

    const handleDiscard = () => {
        localStorage.removeItem(draftKey);
        resetForm();
        setShowDiscardConfirm(false);
        onClose();
    };

    const resetForm = () => {
        setTitle('');
        setOneLine('');
        setDescription('');
        setDomain('Machine Learning');
        setCustomDomain('');
        setTags([]);
        setTagInput('');
        setDemoUrl('');
        setGithubUrl('');
        setArticleUrl('');
        setStatus('published');
        setMediaFile(null);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        setMediaType(null);
        setErrorMessage(null);
        setSuccessMessage(null);
        setUploadProgress(0);
    };

    const handleFileSelect = (file: File) => {
        if (file.size > 20 * 1024 * 1024) {
            setErrorMessage('File size must not exceed 20MB.');
            return;
        }

        const isVideo = file.type.startsWith('video');
        const isImage = file.type.startsWith('image');

        if (!isVideo && !isImage) {
            setErrorMessage('Please upload a valid image or video file.');
            return;
        }

        setErrorMessage(null);
        setMediaFile(file);
        setMediaType(isVideo ? 'video' : 'image');

        if (previewUrl) URL.revokeObjectURL(previewUrl);
        const objUrl = URL.createObjectURL(file);
        setPreviewUrl(objUrl);
    };

    const handleRemoveMedia = () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setMediaFile(null);
        setPreviewUrl(null);
        setMediaType(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleAddTag = () => {
        const trimmed = tagInput.trim().replace(/^#/, '');
        if (trimmed && !tags.includes(trimmed)) {
            if (tags.length >= 8) {
                setErrorMessage('Maximum of 8 tags allowed.');
                return;
            }
            setTags([...tags, trimmed]);
            setTagInput('');
            setErrorMessage(null);
        }
    };

    const handleRemoveTag = (tagToRemove: string) => {
        setTags(tags.filter(t => t !== tagToRemove));
    };

    const validateUrl = (url: string, fieldName: string): boolean => {
        if (!url.trim()) return true;
        try {
            const parsed = new URL(url.trim());
            return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch {
            setErrorMessage(`Please enter a valid URL for ${fieldName} (include http:// or https://)`);
            return false;
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);

        if (!currentUser) {
            setErrorMessage('You must be signed in to publish to Showcase.');
            return;
        }

        if (!title.trim()) {
            setErrorMessage('Project title is required.');
            return;
        }

        if (!oneLine.trim()) {
            setErrorMessage('A short summary / hook is required.');
            return;
        }

        if (!description.trim()) {
            setErrorMessage('Detailed description is required.');
            return;
        }

        if (demoUrl && !validateUrl(demoUrl, 'Live Demo')) return;
        if (githubUrl && !validateUrl(githubUrl, 'Repository')) return;
        if (articleUrl && !validateUrl(articleUrl, 'Article')) return;

        const effectiveDomain = customDomain.trim() || domain;

        setIsSubmitting(true);
        setUploadProgress(0);

        try {
            const created = await createPost({
                title: title.trim(),
                oneLine: oneLine.trim(),
                content: description.trim(),
                category: effectiveDomain,
                domain: effectiveDomain,
                tags,
                mediaFile: mediaFile || undefined,
                mediaType: mediaType || undefined,
                demoUrl: demoUrl.trim() || undefined,
                githubUrl: githubUrl.trim() || undefined,
                repoUrl: githubUrl.trim() || undefined,
                articleUrl: articleUrl.trim() || undefined,
                status,
                type: PostType.Showcase,
                postType: PostType.Showcase,
                authorProfile: userProfile ? {
                    displayName: userProfile.displayName,
                    photoURL: userProfile.photoURL,
                    username: userProfile.username,
                    role: userProfile.role,
                } : undefined,
            }, (progress) => {
                setUploadProgress(progress);
            });

            setSuccessMessage('// PROJECT PUBLISHED TO SHOWCASE');
            localStorage.removeItem(draftKey);

            setTimeout(() => {
                onPublished?.(created);
                resetForm();
                onClose();
            }, 700);
        } catch (err: any) {
            console.error('[SHOWCASE_PUBLISH_ERROR]', err);
            setErrorMessage(err.message || 'Failed to publish project to Showcase. Please try again.');
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
            <div 
                className="relative w-full max-w-3xl max-h-[92vh] flex flex-col bg-[#0c0c0e] border border-zinc-800 shadow-2xl text-white font-mono overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-[#09090b]">
                    <div className="flex items-center gap-2.5">
                        <span className="w-2 h-2 bg-white animate-pulse"></span>
                        <span className="text-xs font-bold uppercase tracking-wider text-white">
                            // PUBLISH_SHOWCASE_PROJECT
                        </span>
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest hidden sm:inline">
                            · PORTFOLIO_BROADCAST
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={handleAttemptClose}
                        disabled={isSubmitting}
                        className="p-1 text-zinc-500 hover:text-white transition-colors border border-transparent hover:border-zinc-800"
                        title="Close"
                    >
                        <CloseIcon className="w-4 h-4" />
                    </button>
                </div>

                {/* Body Content */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5 no-scrollbar">
                    {/* Error Banner */}
                    {errorMessage && (
                        <div className="p-3 bg-red-950/40 border border-red-800/80 text-red-300 text-xs flex items-start gap-2 animate-fadeIn">
                            <span className="font-bold text-red-400 block">// ERROR:</span>
                            <span>{errorMessage}</span>
                        </div>
                    )}

                    {/* Success Banner */}
                    {successMessage && (
                        <div className="p-3 bg-emerald-950/40 border border-emerald-800/80 text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn">
                            <CheckBadgeIcon className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                            <span className="font-bold">{successMessage}</span>
                        </div>
                    )}

                    {/* Project Title */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                                Project Title <span className="text-red-400">*</span>
                            </label>
                            <span className="text-[10px] text-zinc-500">{title.length}/100</span>
                        </div>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            maxLength={100}
                            placeholder="e.g. Deepfake Sentinel Toolkit, Chronos Reactive Engine..."
                            className="w-full bg-black border border-zinc-800 px-3.5 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
                            disabled={isSubmitting}
                            required
                        />
                    </div>

                    {/* Short Summary / One-Liner */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                                Short Summary / Hook <span className="text-red-400">*</span>
                            </label>
                            <span className="text-[10px] text-zinc-500">{oneLine.length}/180</span>
                        </div>
                        <input
                            type="text"
                            value={oneLine}
                            onChange={(e) => setOneLine(e.target.value)}
                            maxLength={180}
                            placeholder="A concise, punchy description that appears in project cards and feeds..."
                            className="w-full bg-black border border-zinc-800 px-3.5 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
                            disabled={isSubmitting}
                            required
                        />
                    </div>

                    {/* Category / Domain Selection */}
                    <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 block mb-2">
                            Category / Domain <span className="text-red-400">*</span>
                        </label>
                        <div className="flex flex-wrap gap-1.5 mb-2.5">
                            {PRESET_DOMAINS.map(d => (
                                <button
                                    key={d}
                                    type="button"
                                    onClick={() => {
                                        setDomain(d);
                                        setCustomDomain('');
                                    }}
                                    className={`px-2.5 py-1 text-[11px] uppercase tracking-wider border transition-all ${
                                        domain === d && !customDomain
                                            ? 'bg-white text-black border-white font-bold'
                                            : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-600 hover:text-white'
                                    }`}
                                >
                                    {d}
                                </button>
                            ))}
                        </div>
                        <input
                            type="text"
                            value={customDomain}
                            onChange={(e) => setCustomDomain(e.target.value)}
                            placeholder="Or specify custom category/domain..."
                            className="w-full bg-black border border-zinc-800 px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                            disabled={isSubmitting}
                        />
                    </div>

                    {/* Detailed Description */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                                Detailed Description & Technical Overview <span className="text-red-400">*</span>
                            </label>
                            <span className="text-[10px] text-zinc-500">{description.length}/3000</span>
                        </div>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            maxLength={3000}
                            rows={5}
                            placeholder="Detail your solution, technical architecture, problem statement, key innovations, algorithms, benchmarks, or creative process..."
                            className="w-full bg-black border border-zinc-800 p-3 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 leading-relaxed font-mono"
                            disabled={isSubmitting}
                            required
                        />
                    </div>

                    {/* Media Upload Area */}
                    <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 block mb-1.5">
                            Project Media (Screenshot, Banner, or Video Demo)
                        </label>
                        <p className="text-[10px] text-zinc-500 mb-2 font-mono">
                            Supports PNG, JPG, WebP, MP4, WebM (Max 50MB). Stored securely via Firebase Storage.
                        </p>

                        {previewUrl ? (
                            <div className="relative border border-zinc-700 bg-black overflow-hidden group">
                                {mediaType === 'video' ? (
                                    <video src={previewUrl} controls className="w-full max-h-64 object-contain mx-auto" />
                                ) : (
                                    <img src={previewUrl} alt="Upload preview" className="w-full max-h-64 object-contain mx-auto" />
                                )}
                                <div className="absolute top-2 right-2 flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleRemoveMedia}
                                        disabled={isSubmitting}
                                        className="bg-black/80 hover:bg-red-900 border border-zinc-700 text-white p-1.5 transition-colors"
                                        title="Remove media"
                                    >
                                        <TrashIcon className="w-4 h-4 text-red-400" />
                                    </button>
                                </div>
                                <div className="p-2 bg-zinc-950 border-t border-zinc-800 text-[10px] text-zinc-400 flex justify-between items-center">
                                    <span>{mediaFile?.name}</span>
                                    <span>{(mediaFile ? (mediaFile.size / 1024 / 1024).toFixed(2) : 0)} MB</span>
                                </div>
                            </div>
                        ) : (
                            <div
                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setIsDragging(false);
                                    if (e.dataTransfer.files?.[0]) {
                                        handleFileSelect(e.dataTransfer.files[0]);
                                    }
                                }}
                                onClick={() => fileInputRef.current?.click()}
                                className={`border-2 border-dashed p-6 text-center cursor-pointer transition-colors bg-black/40 ${
                                    isDragging ? 'border-white bg-zinc-900/60' : 'border-zinc-800 hover:border-zinc-600'
                                }`}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*,video/*"
                                    onChange={(e) => {
                                        if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
                                    }}
                                    className="hidden"
                                />
                                <ArrowUpTrayIcon className="w-6 h-6 text-zinc-500 mx-auto mb-2" />
                                <p className="text-xs text-zinc-300 font-bold uppercase tracking-wider">
                                    Click or Drag & Drop Media Here
                                </p>
                                <p className="text-[10px] text-zinc-600 mt-1">
                                    Showcase high-resolution screenshots or video demonstration
                                </p>
                            </div>
                        )}

                        {/* Upload progress */}
                        {isSubmitting && uploadProgress > 0 && uploadProgress < 100 && (
                            <div className="mt-2 space-y-1">
                                <div className="flex justify-between text-[10px] text-zinc-400">
                                    <span>Uploading Media to Storage...</span>
                                    <span>{Math.round(uploadProgress)}%</span>
                                </div>
                                <div className="w-full bg-zinc-900 h-1.5 border border-zinc-800">
                                    <div 
                                        className="bg-white h-full transition-all duration-200"
                                        style={{ width: `${uploadProgress}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* External Project Links */}
                    <div className="space-y-3 pt-2 border-t border-zinc-800/80">
                        <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 block">
                            External Project Links (Optional)
                        </label>

                        {/* Live Demo */}
                        <div className="flex items-center gap-2">
                            <div className="p-2.5 bg-black border border-zinc-800 text-zinc-500 flex-shrink-0">
                                <GlobeAltIcon className="w-4 h-4 text-emerald-400" />
                            </div>
                            <input
                                type="url"
                                value={demoUrl}
                                onChange={(e) => setDemoUrl(e.target.value)}
                                placeholder="Live Demo URL (https://myproject.dev)"
                                className="w-full bg-black border border-zinc-800 px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                                disabled={isSubmitting}
                            />
                        </div>

                        {/* GitHub / Repo */}
                        <div className="flex items-center gap-2">
                            <div className="p-2.5 bg-black border border-zinc-800 text-zinc-500 flex-shrink-0">
                                <CodeBracketIcon className="w-4 h-4 text-zinc-300" />
                            </div>
                            <input
                                type="url"
                                value={githubUrl}
                                onChange={(e) => setGithubUrl(e.target.value)}
                                placeholder="Repository URL (https://github.com/username/project)"
                                className="w-full bg-black border border-zinc-800 px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                                disabled={isSubmitting}
                            />
                        </div>

                        {/* Article / Whitepaper */}
                        <div className="flex items-center gap-2">
                            <div className="p-2.5 bg-black border border-zinc-800 text-zinc-500 flex-shrink-0">
                                <DocumentTextIcon className="w-4 h-4 text-cyan-400" />
                            </div>
                            <input
                                type="url"
                                value={articleUrl}
                                onChange={(e) => setArticleUrl(e.target.value)}
                                placeholder="Article or Paper URL (https://arxiv.org/... or https://mirror.xyz/...)"
                                className="w-full bg-black border border-zinc-800 px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>

                    {/* Tags Input */}
                    <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                        <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 block">
                            Tags & Keywords
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddTag();
                                    }
                                }}
                                placeholder="Add keyword tag (e.g. PyTorch, Web3, React)..."
                                className="flex-1 bg-black border border-zinc-800 px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                                disabled={isSubmitting}
                            />
                            <button
                                type="button"
                                onClick={handleAddTag}
                                className="bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs uppercase font-bold text-zinc-300 hover:text-white hover:border-zinc-600 transition-colors"
                            >
                                Add Tag
                            </button>
                        </div>
                        {tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                                {tags.map(t => (
                                    <span
                                        key={t}
                                        className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-[11px] px-2.5 py-1 flex items-center gap-1.5"
                                    >
                                        <span>#{t}</span>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveTag(t)}
                                            className="text-zinc-500 hover:text-white"
                                        >
                                            <XMarkIcon className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Publishing Status Toggle */}
                    <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between">
                        <div>
                            <span className="text-xs font-bold uppercase tracking-wider text-zinc-300 block">
                                Broadcast Status
                            </span>
                            <span className="text-[10px] text-zinc-500">
                                {status === 'published' ? 'Live on Spotlight Showcase for the entire network' : 'Saved as private draft in My Space'}
                            </span>
                        </div>
                        <div className="flex border border-zinc-800 bg-black">
                            <button
                                type="button"
                                onClick={() => setStatus('published')}
                                className={`px-3 py-1.5 text-xs uppercase tracking-wider font-bold transition-colors ${
                                    status === 'published' ? 'bg-white text-black' : 'text-zinc-500 hover:text-white'
                                }`}
                            >
                                Publish Live
                            </button>
                            <button
                                type="button"
                                onClick={() => setStatus('draft')}
                                className={`px-3 py-1.5 text-xs uppercase tracking-wider font-bold transition-colors ${
                                    status === 'draft' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white'
                                }`}
                            >
                                Save Draft
                            </button>
                        </div>
                    </div>
                </form>

                {/* Modal Footer */}
                <div className="px-5 py-3.5 border-t border-zinc-800 bg-[#09090b] flex items-center justify-between">
                    <button
                        type="button"
                        onClick={handleAttemptClose}
                        disabled={isSubmitting}
                        className="px-4 py-2 border border-zinc-800 text-zinc-400 hover:text-white text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={isSubmitting || !title.trim() || !oneLine.trim()}
                            className="bg-white hover:bg-zinc-200 text-black px-6 py-2 text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-2 disabled:opacity-40 disabled:hover:bg-white"
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                                    <span>Transmitting...</span>
                                </>
                            ) : (
                                <span>{status === 'published' ? '// PUBLISH_PROJECT' : '// SAVE_DRAFT'}</span>
                            )}
                        </button>
                    </div>
                </div>

                {/* Discard Confirmation Modal */}
                {showDiscardConfirm && (
                    <div className="absolute inset-0 bg-black/90 z-20 flex items-center justify-center p-4">
                        <div className="bg-[#0c0c0e] border border-zinc-800 p-5 max-w-sm w-full space-y-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-white">// DISCARD_TRANSMISSION?</h4>
                            <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                                You have unsaved changes. Do you want to discard this project draft?
                            </p>
                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowDiscardConfirm(false)}
                                    className="px-3 py-1.5 border border-zinc-800 text-zinc-300 text-xs uppercase"
                                >
                                    Continue Editing
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDiscard}
                                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs uppercase font-bold"
                                >
                                    Discard
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
