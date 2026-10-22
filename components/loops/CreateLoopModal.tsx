import React, { useState, useEffect, useRef } from 'react';
import type { StreamLoop, LoopCategory } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { createLoopPost, updateLoopPost } from '../../services/postService';
import { 
    CloseIcon, 
    SparklesIcon, 
    PencilSwooshIcon, 
    HeartIcon, 
    TrendingUpIcon, 
    ChatBubbleBottomCenterTextIcon, 
    ForwardIcon, 
    BookmarkIcon, 
    CheckBadgeIcon,
    ArrowUpRightIcon,
    RadioIcon
} from '../ui/Icons';
import { handleImageError } from '../utils/imageUtils';

interface CreateLoopModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: (loop: StreamLoop) => void;
    initialData?: StreamLoop | null;
    isEditMode?: boolean;
}

const LOOP_TYPES: { id: LoopCategory; label: string; icon: string; tag: string; description: string }[] = [
    {
        id: 'Zaps',
        label: 'ZAPS',
        icon: '⚡',
        tag: '// DISCOVERY_SIGNAL',
        description: 'Quick discoveries, useful links, technical finds, and short telemetry updates.'
    },
    {
        id: 'Thoughts',
        label: 'THOUGHTS',
        icon: '✦',
        tag: '// NEURAL_REFLECTION',
        description: 'Opinions, technical reflections, questions, and conceptual architecture ideas.'
    },
    {
        id: 'Music',
        label: 'MUSIC',
        icon: '♪',
        tag: '// AUDIO_RESONANCE',
        description: 'Music discoveries, track releases, sound design, and listening recommendations.'
    },
    {
        id: 'Mood',
        label: 'MOOD',
        icon: '◈',
        tag: '// ATMOSPHERE_VIBE',
        description: 'Short expressive vibe, aesthetic atmosphere, late-night flow state, or visual ambience.'
    }
];

export const CreateLoopModal: React.FC<CreateLoopModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    initialData,
    isEditMode = false,
}) => {
    const { currentUser, userProfile } = useAuth();

    const [category, setCategory] = useState<LoopCategory>(initialData?.category || 'Zaps');
    const [headline, setHeadline] = useState<string>(initialData?.headline || initialData?.title || '');
    const [description, setDescription] = useState<string>(initialData?.description || initialData?.content || '');
    const [externalUrl, setExternalUrl] = useState<string>(initialData?.externalUrl || '');
    const [trackTitle, setTrackTitle] = useState<string>(initialData?.musicMeta?.trackTitle || '');
    const [artist, setArtist] = useState<string>(initialData?.musicMeta?.artist || '');
    const [streamUrl, setStreamUrl] = useState<string>(initialData?.musicMeta?.streamUrl || '');
    const [mediaFile, setMediaFile] = useState<File | null>(null);
    const [mediaPreview, setMediaPreview] = useState<string | null>(initialData?.mediaUrl || initialData?.imageUrl || null);
    const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initialize or reset form on open or data change
    useEffect(() => {
        if (initialData) {
            setCategory(initialData.category === 'Thought' ? 'Thoughts' : initialData.category);
            setHeadline(initialData.headline || initialData.title || '');
            setDescription(initialData.description || initialData.content || '');
            setExternalUrl(initialData.externalUrl || '');
            setTrackTitle(initialData.musicMeta?.trackTitle || '');
            setArtist(initialData.musicMeta?.artist || '');
            setStreamUrl(initialData.musicMeta?.streamUrl || '');
            setMediaPreview(initialData.mediaUrl || initialData.imageUrl || null);
            setMediaFile(null);
        } else {
            setCategory('Zaps');
            setHeadline('');
            setDescription('');
            setExternalUrl('');
            setTrackTitle('');
            setArtist('');
            setStreamUrl('');
            setMediaFile(null);
            setMediaPreview(null);
        }
        setErrorMessage(null);
        setIsSubmitting(false);
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 15 * 1024 * 1024) {
            setErrorMessage('File size exceeds 15MB limit.');
            return;
        }

        setMediaFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
            setMediaPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
        setErrorMessage(null);
    };

    const handleRemoveMedia = () => {
        setMediaFile(null);
        setMediaPreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);

        if (!headline.trim()) {
            setErrorMessage('A headline is required for your Loop.');
            return;
        }

        if (!description.trim() && category !== 'Mood') {
            setErrorMessage('Please provide a short description or reflection for this Loop.');
            return;
        }

        if (category === 'Music' && !trackTitle.trim()) {
            setErrorMessage('Please provide the track title for Music loops.');
            return;
        }

        if (!currentUser) {
            setErrorMessage('You must be signed in to broadcast a Loop.');
            return;
        }

        setIsSubmitting(true);

        try {
            if (isEditMode && initialData) {
                await updateLoopPost(initialData.id, {
                    category,
                    headline: headline.trim(),
                    description: description.trim(),
                    mediaFile,
                    mediaUrl: mediaPreview,
                    externalUrl: externalUrl.trim() || null,
                    musicMeta: category === 'Music' ? {
                        trackTitle: trackTitle.trim(),
                        artist: artist.trim(),
                        streamUrl: streamUrl.trim() || externalUrl.trim() || undefined,
                    } : undefined,
                });
                onSuccess?.({
                    ...initialData,
                    category,
                    title: headline.trim(),
                    headline: headline.trim(),
                    content: description.trim(),
                    description: description.trim(),
                    mediaUrl: mediaPreview || initialData.mediaUrl,
                    imageUrl: mediaPreview || initialData.imageUrl,
                    externalUrl: externalUrl.trim() || undefined,
                    musicMeta: category === 'Music' ? {
                        trackTitle: trackTitle.trim(),
                        artist: artist.trim(),
                        streamUrl: streamUrl.trim() || externalUrl.trim() || undefined,
                    } : undefined,
                });
            } else {
                const created = await createLoopPost({
                    category,
                    headline: headline.trim(),
                    description: description.trim(),
                    mediaFile,
                    mediaUrl: mediaPreview,
                    externalUrl: externalUrl.trim() || null,
                    musicMeta: category === 'Music' ? {
                        trackTitle: trackTitle.trim(),
                        artist: artist.trim(),
                        streamUrl: streamUrl.trim() || externalUrl.trim() || undefined,
                    } : undefined,
                    authorProfile: userProfile ? {
                        displayName: userProfile.displayName || currentUser.displayName || undefined,
                        username: userProfile.username || undefined,
                        photoURL: userProfile.photoURL || currentUser.photoURL || undefined,
                        role: userProfile.role,
                    } : undefined,
                });
                onSuccess?.(created);
            }
            onClose();
        } catch (err: any) {
            console.error('[CREATE_LOOP_ERROR]', err);
            setErrorMessage(err?.message || 'Failed to broadcast Loop. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const currentTypeConfig = LOOP_TYPES.find(t => t.id === category) || LOOP_TYPES[0];
    const authorName = userProfile?.displayName || currentUser?.displayName || 'Invox Node';
    const authorHandle = userProfile?.username ? `@${userProfile.username}` : (currentUser?.email ? `@${currentUser.email.split('@')[0]}` : '@node');
    const authorAvatar = userProfile?.photoURL || currentUser?.photoURL || `https://picsum.photos/seed/${currentUser?.uid || 'user'}/200`;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/85 backdrop-blur-sm" onClick={onClose} />

            {/* Modal Body */}
            <div className="relative w-full max-w-2xl bg-[#0c0c0e] border border-zinc-800 shadow-2xl z-10 flex flex-col max-h-[92vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 bg-[#09090b]">
                    <div className="flex items-center gap-2.5">
                        <span className="w-2 h-2 bg-emerald-500 rounded-none animate-pulse" />
                        <div>
                            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block leading-none">
                                {currentTypeConfig.tag}
                            </span>
                            <h2 className="text-sm font-bold font-mono text-white uppercase tracking-wider mt-1">
                                {isEditMode ? '// EDIT_LOOP_BROADCAST' : '// BROADCAST_NEW_LOOP'}
                            </h2>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {/* Tab Switcher: Editor vs Live Preview */}
                        <div className="hidden sm:flex border border-zinc-800 p-0.5 bg-black">
                            <button
                                type="button"
                                onClick={() => setActiveTab('editor')}
                                className={`px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider transition-colors ${
                                    activeTab === 'editor' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-500 hover:text-zinc-300'
                                }`}
                            >
                                Editor
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('preview')}
                                className={`px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider transition-colors ${
                                    activeTab === 'preview' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-500 hover:text-zinc-300'
                                }`}
                            >
                                Live Preview
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 text-zinc-400 hover:text-white border border-transparent hover:border-zinc-800 transition-colors"
                        >
                            <CloseIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Content Container */}
                <div className="overflow-y-auto p-5 space-y-5 no-scrollbar flex-1 font-mono">
                    {/* Error Display */}
                    {errorMessage && (
                        <div className="p-3 bg-red-950/40 border border-red-800 text-red-300 text-xs">
                            <span className="font-bold">// TRANSMISSION_ERROR:</span> {errorMessage}
                        </div>
                    )}

                    {/* Loop Type Selector */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold block">
                                // 1. SELECT LOOP TYPE
                            </label>
                            <span className="text-[10px] text-zinc-500 italic hidden sm:inline">
                                {currentTypeConfig.description}
                            </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {LOOP_TYPES.map(t => {
                                const isSelected = category === t.id;
                                return (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => setCategory(t.id)}
                                        className={`p-3 text-left border transition-all duration-150 flex flex-col justify-between ${
                                            isSelected
                                                ? 'bg-zinc-900 border-white text-white shadow-sm'
                                                : 'bg-black/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-base">{t.icon}</span>
                                            <span className={`text-[9px] uppercase px-1 py-0.2 border ${
                                                isSelected ? 'border-white/50 text-white' : 'border-zinc-800 text-zinc-600'
                                            }`}>
                                                ACTIVE
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-xs font-bold block uppercase tracking-wider">{t.label}</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {activeTab === 'editor' ? (
                        <form id="loop-form" onSubmit={handleSubmit} className="space-y-4">
                            {/* Headline */}
                            <div>
                                <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold block mb-1">
                                    // 2. {category === 'Music' ? 'TRACK TITLE / HEADLINE' : category === 'Mood' ? 'VIBE TITLE / HEADLINE' : 'HOOK / HEADLINE'} *
                                </label>
                                <input
                                    type="text"
                                    value={headline}
                                    onChange={(e) => setHeadline(e.target.value)}
                                    placeholder={
                                        category === 'Zaps' ? 'e.g. RISC-V LLM Inference on Edge Accelerators...' :
                                        category === 'Thoughts' ? 'e.g. The Architecture of Capital-Efficient Software...' :
                                        category === 'Music' ? 'e.g. Midnight Protocol // 132 BPM Minimal Wave...' :
                                        'e.g. Shinjuku Rain & Neon Grid Flow State...'
                                    }
                                    maxLength={120}
                                    className="w-full bg-black border border-zinc-800 p-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 uppercase tracking-wider"
                                />
                            </div>

                            {/* Music Specific Inputs */}
                            {category === 'Music' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-black/60 border border-zinc-800/90">
                                    <div>
                                        <label className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold block mb-1">
                                            // TRACK NAME *
                                        </label>
                                        <input
                                            type="text"
                                            value={trackTitle}
                                            onChange={(e) => setTrackTitle(e.target.value)}
                                            placeholder="e.g. Subsurface Echoes"
                                            className="w-full bg-[#0c0c0e] border border-zinc-800 p-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold block mb-1">
                                            // ARTIST NAME
                                        </label>
                                        <input
                                            type="text"
                                            value={artist}
                                            onChange={(e) => setArtist(e.target.value)}
                                            placeholder="e.g. Marcus Thorne ft. Vector 7"
                                            className="w-full bg-[#0c0c0e] border border-zinc-800 p-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
                                        />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold block mb-1">
                                            // STREAMING LINK (SPOTIFY, SOUNDCLOUD, YOUTUBE, ETC.)
                                        </label>
                                        <input
                                            type="url"
                                            value={streamUrl}
                                            onChange={(e) => setStreamUrl(e.target.value)}
                                            placeholder="https://soundcloud.com/artist/track..."
                                            className="w-full bg-[#0c0c0e] border border-zinc-800 p-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Description / Content Body */}
                            <div>
                                <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold block mb-1">
                                    // 3. {category === 'Thoughts' ? 'THOUGHT REFLECTION / BODY' : category === 'Mood' ? 'MOOD CAPTION / AMBIENCE' : 'DESCRIPTION & DETAILS'} *
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={category === 'Thoughts' ? 5 : 3}
                                    placeholder={
                                        category === 'Zaps' ? 'Detail the discovery, technical findings, or quick summary...' :
                                        category === 'Thoughts' ? 'Explain your viewpoint, architectural reflection, trade-offs, or questions...' :
                                        category === 'Music' ? 'Listening notes, genre tags, production gear used, or feelings...' :
                                        'Describe the aesthetic vibe, current mindset, or atmospheric notes...'
                                    }
                                    className="w-full bg-black border border-zinc-800 p-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 leading-relaxed resize-y"
                                />
                            </div>

                            {/* External URL (For Zaps or General) */}
                            {category !== 'Music' && (
                                <div>
                                    <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold block mb-1">
                                        // 4. EXTERNAL RESOURCE / GITHUB / ARTICLE URL (OPTIONAL)
                                    </label>
                                    <input
                                        type="url"
                                        value={externalUrl}
                                        onChange={(e) => setExternalUrl(e.target.value)}
                                        placeholder="https://github.com/..."
                                        className="w-full bg-black border border-zinc-800 p-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 font-mono"
                                    />
                                </div>
                            )}

                            {/* Media Attachment */}
                            <div>
                                <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold block mb-1">
                                    // 5. {category === 'Music' ? 'ALBUM / COVER ARTWORK' : 'VISUAL ATTACHMENT (IMAGE)'} (OPTIONAL)
                                </label>
                                
                                {mediaPreview ? (
                                    <div className="relative border border-zinc-800 bg-black p-2 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <img
                                                src={mediaPreview}
                                                onError={handleImageError}
                                                alt="Preview"
                                                className="w-16 h-16 object-cover border border-zinc-700"
                                            />
                                            <div>
                                                <p className="text-xs text-white font-bold uppercase truncate max-w-xs">
                                                    {mediaFile ? mediaFile.name : 'Image attached'}
                                                </p>
                                                <p className="text-[10px] text-zinc-500">
                                                    {mediaFile ? `${(mediaFile.size / 1024).toFixed(1)} KB` : 'Attached visual'}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleRemoveMedia}
                                            className="px-2.5 py-1 text-xs text-red-400 hover:text-red-300 border border-red-900/60 hover:bg-red-950/40 uppercase"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ) : (
                                    <div className="border border-dashed border-zinc-800 hover:border-zinc-600 p-4 text-center bg-black/40">
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            onChange={handleFileChange}
                                            className="hidden"
                                            id="loop-file-upload"
                                        />
                                        <label htmlFor="loop-file-upload" className="cursor-pointer block">
                                            <span className="text-xs text-zinc-400 hover:text-white uppercase font-bold tracking-wider block mb-1">
                                                + Upload Visual (Click to browse)
                                            </span>
                                            <span className="text-[10px] text-zinc-600 block">
                                                JPG, PNG, WebP or GIF up to 15MB
                                            </span>
                                        </label>
                                    </div>
                                )}
                            </div>
                        </form>
                    ) : (
                        /* Live Preview Mode */
                        <div className="space-y-3">
                            <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold block">
                                // LIVE FEED PREVIEW:
                            </span>
                            <div className="bg-[#0c0c0e] border border-zinc-800 p-4 shadow-xl">
                                <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                                    <div className="flex items-center gap-2.5">
                                        <img src={authorAvatar} onError={handleImageError} alt={authorName} className="w-7 h-7 object-cover border border-zinc-700" />
                                        <div>
                                            <div className="flex items-center gap-1">
                                                <span className="text-xs font-bold text-white uppercase">{authorName}</span>
                                                <CheckBadgeIcon className="w-3.5 h-3.5 text-zinc-400" />
                                            </div>
                                            <span className="text-[10px] text-zinc-500">{authorHandle}</span>
                                        </div>
                                    </div>
                                    <span className="text-[10px] px-2 py-0.5 border border-zinc-700 text-zinc-300 bg-zinc-900 uppercase">
                                        // {category}
                                    </span>
                                </div>

                                <div className="pt-3 space-y-2">
                                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                                        {headline || 'Your Headline Here...'}
                                    </h3>
                                    <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap">
                                        {description || 'Your loop content description will render here...'}
                                    </p>

                                    {category === 'Music' && trackTitle && (
                                        <div className="p-2.5 bg-black border border-zinc-800 text-xs text-zinc-300 space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span>♪</span>
                                                <span className="font-bold text-white">{trackTitle}</span>
                                                {artist && <span className="text-zinc-500">by {artist}</span>}
                                            </div>
                                            {(streamUrl || externalUrl) && (
                                                <a href={streamUrl || externalUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-zinc-400 hover:text-white underline flex items-center gap-1">
                                                    <span>Open Audio Stream</span>
                                                    <ArrowUpRightIcon className="w-3 h-3" />
                                                </a>
                                            )}
                                        </div>
                                    )}

                                    {externalUrl && category !== 'Music' && (
                                        <div className="pt-1">
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-black border border-zinc-800 text-[10px] text-zinc-400">
                                                <span>↗ {externalUrl.replace(/^https?:\/\//, '').split('/')[0]}</span>
                                            </span>
                                        </div>
                                    )}

                                    {mediaPreview && (
                                        <div className="relative mt-2 border border-zinc-800 aspect-video bg-black overflow-hidden">
                                            <img src={mediaPreview} alt="Preview" className="w-full h-full object-cover" />
                                            <div className="absolute bottom-2 right-2 bg-white text-black p-2 border border-white">
                                                <PencilSwooshIcon className="w-4 h-4" />
                                            </div>
                                        </div>
                                    )}

                                    {/* Action row preview */}
                                    <div className="mt-4 pt-3 border-t border-zinc-800 flex justify-between items-center text-xs text-zinc-500">
                                        <div className="flex items-center gap-4">
                                            <span className="flex items-center gap-1"><HeartIcon className="w-3.5 h-3.5" /> 0</span>
                                            <span className="flex items-center gap-1"><TrendingUpIcon className="w-3.5 h-3.5" /> 1</span>
                                            <span className="flex items-center gap-1"><ChatBubbleBottomCenterTextIcon className="w-3.5 h-3.5" /> 0</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <ForwardIcon className="w-3.5 h-3.5" />
                                            <BookmarkIcon className="w-3.5 h-3.5" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="p-4 border-t border-zinc-800 bg-[#09090b] flex items-center justify-between font-mono text-xs">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-4 py-2 text-zinc-400 hover:text-white uppercase transition-colors"
                    >
                        Cancel
                    </button>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveTab(activeTab === 'editor' ? 'preview' : 'editor')}
                            className="sm:hidden px-3 py-2 border border-zinc-800 text-zinc-300 uppercase"
                        >
                            {activeTab === 'editor' ? 'Preview' : 'Edit'}
                        </button>

                        <button
                            type="submit"
                            form="loop-form"
                            disabled={isSubmitting}
                            className="flex items-center gap-2 bg-white hover:bg-zinc-200 text-black px-5 py-2 font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                    <span>BROADCASTING...</span>
                                </>
                            ) : (
                                <>
                                    <SparklesIcon className="w-4 h-4 text-black" />
                                    <span>{isEditMode ? 'UPDATE LOOP' : 'BROADCAST LOOP'}</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
export default CreateLoopModal;
