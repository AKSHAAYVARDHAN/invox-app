import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
    CloseIcon, 
    PlusIcon, 
    TrashIcon, 
    SparklesIcon, 
    ArrowUpTrayIcon 
} from '../ui/Icons';
import { useAuth } from '../../contexts/AuthContext';
import { createPoll } from '../../services/pollService';
import type { Poll, PollDuration } from '../../types';
import { TargetDomainSelector } from '../ui/TargetDomainSelector';

interface CreatePollModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated?: (poll: Poll) => void;
}

const DURATION_OPTIONS: { label: string; value: PollDuration }[] = [
    { label: '1 Day', value: '1d' },
    { label: '3 Days', value: '3d' },
    { label: '7 Days', value: '7d' },
    { label: '30 Days', value: '30d' },
    { label: 'No Limit', value: 'never' },
];

export const CreatePollModal: React.FC<CreatePollModalProps> = ({
    isOpen,
    onClose,
    onCreated,
}) => {
    const { currentUser, userProfile } = useAuth();
    const [question, setQuestion] = useState('');
    const [description, setDescription] = useState('');
    const [options, setOptions] = useState<string[]>(['', '']);
    const [duration, setDuration] = useState<PollDuration>('7d');
    const [category, setCategory] = useState('Technology');
    const [isDomainValid, setIsDomainValid] = useState(true);
    const [mediaFile, setMediaFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen && !isSubmitting) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, isSubmitting, onClose]);

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

    if (!isOpen) return null;

    const resetForm = () => {
        setQuestion('');
        setDescription('');
        setOptions(['', '']);
        setDuration('7d');
        setCategory('Technology');
        setIsDomainValid(true);
        setMediaFile(null);
        setPreviewUrl(null);
        setErrorMsg(null);
        setIsSubmitting(false);
        setUploadProgress(0);
    };

    const handleAddOption = () => {
        if (options.length < 6) {
            setOptions(prev => [...prev, '']);
        }
    };

    const handleRemoveOption = (index: number) => {
        if (options.length > 2) {
            setOptions(prev => prev.filter((_, i) => i !== index));
        }
    };

    const handleOptionChange = (index: number, val: string) => {
        setOptions(prev => {
            const next = [...prev];
            next[index] = val;
            return next;
        });
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 25 * 1024 * 1024) {
                setErrorMsg('Media file exceeds maximum size limit of 25MB.');
                return;
            }
            setMediaFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleRemoveMedia = () => {
        setMediaFile(null);
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);

        if (!currentUser) {
            setErrorMsg('Authentication required: Sign in to broadcast a poll.');
            return;
        }

        const trimmedQ = question.trim();
        if (!trimmedQ) {
            setErrorMsg('Please enter a poll question.');
            return;
        }

        const cleanedOptions = options.map(o => o.trim()).filter(Boolean);
        if (cleanedOptions.length < 2) {
            setErrorMsg('At least 2 non-empty options are required.');
            return;
        }

        const uniqueCheck = new Set(cleanedOptions.map(o => o.toLowerCase()));
        if (uniqueCheck.size !== cleanedOptions.length) {
            setErrorMsg('Duplicate options detected. Each option must be distinct.');
            return;
        }

        if (!isDomainValid || !category.trim()) {
            setErrorMsg('A valid target domain is required.');
            return;
        }

        setIsSubmitting(true);
        try {
            const created = await createPoll(
                {
                    question: trimmedQ,
                    description: description.trim() || undefined,
                    options: cleanedOptions,
                    duration,
                    category: category.trim(),
                    domain: category.trim(),
                    mediaFile,
                    authorProfile: userProfile ? {
                        displayName: userProfile.displayName || currentUser.displayName || undefined,
                        username: userProfile.username || undefined,
                        photoURL: userProfile.photoURL || currentUser.photoURL || undefined,
                        role: userProfile.role,
                    } : undefined,
                },
                (progress) => setUploadProgress(progress)
            );

            onCreated?.(created);
            resetForm();
            onClose();
        } catch (err: any) {
            console.error('[POLL_CREATE_ERROR]', err);
            setErrorMsg(err?.message || 'Failed to publish poll. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const modalContent = (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn font-mono">
            <div className="relative w-full max-w-xl bg-[#0c0c0e] border border-zinc-800 shadow-2xl max-h-[92vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-black/60">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white uppercase tracking-wider">// NEW_TRANSMISSION</span>
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest border border-zinc-800 px-1.5 py-0.5">POLL</span>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="p-1 text-zinc-400 hover:text-white transition-colors"
                    >
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs flex-1 no-scrollbar">
                    {errorMsg && (
                        <div className="p-3 bg-red-950/40 border border-red-800 text-red-400 flex items-center justify-between">
                            <span>// ERROR: {errorMsg}</span>
                            <button type="button" onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-white">
                                <CloseIcon className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    {/* Question */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-zinc-400 uppercase tracking-wider font-bold">
                                Poll Question *
                            </label>
                            <span className="text-[10px] text-zinc-600">{question.length}/280</span>
                        </div>
                        <input
                            type="text"
                            value={question}
                            onChange={(e) => setQuestion(e.target.value.slice(0, 280))}
                            placeholder="e.g., Which LLM architecture will dominate production in 2026?"
                            className="w-full bg-black/60 border border-zinc-800 focus:border-zinc-500 text-white px-3.5 py-2.5 outline-none tracking-wide text-xs"
                            required
                        />
                    </div>

                    {/* Context / Description */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-zinc-400 uppercase tracking-wider">
                                Context / Background (Optional)
                            </label>
                            <span className="text-[10px] text-zinc-600">{description.length}/500</span>
                        </div>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value.slice(0, 500))}
                            placeholder="Provide any hypothesis, research context, or criteria..."
                            rows={2}
                            className="w-full bg-black/60 border border-zinc-800 focus:border-zinc-500 text-white px-3.5 py-2 outline-none text-xs leading-relaxed"
                        />
                    </div>

                    {/* Options (Min 2, Max 6) */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-zinc-400 uppercase tracking-wider font-bold">
                                Poll Options ({options.length}/6) *
                            </label>
                            {options.length < 6 && (
                                <button
                                    type="button"
                                    onClick={handleAddOption}
                                    className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-600 px-2 py-0.5 bg-zinc-900/60 transition-all uppercase"
                                >
                                    <PlusIcon className="w-3 h-3" />
                                    <span>Add Option</span>
                                </button>
                            )}
                        </div>

                        <div className="space-y-2">
                            {options.map((opt, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                    <span className="w-6 h-8 flex items-center justify-center bg-black border border-zinc-800 text-zinc-500 text-[11px] font-bold">
                                        {String.fromCharCode(65 + idx)}
                                    </span>
                                    <input
                                        type="text"
                                        value={opt}
                                        onChange={(e) => handleOptionChange(idx, e.target.value.slice(0, 100))}
                                        placeholder={`Option ${idx + 1}`}
                                        className="flex-1 bg-black/60 border border-zinc-800 focus:border-zinc-500 text-white px-3 py-2 outline-none text-xs"
                                        required
                                    />
                                    {options.length > 2 && (
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveOption(idx)}
                                            className="p-2 border border-zinc-800 text-zinc-600 hover:text-red-400 hover:border-red-900 bg-black/40 transition-colors"
                                            title="Remove option"
                                        >
                                            <TrashIcon className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Duration Selector */}
                    <div>
                        <label className="block text-zinc-400 uppercase tracking-wider mb-2 font-bold">
                            Duration / Expiration
                        </label>
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                            {DURATION_OPTIONS.map((d) => (
                                <button
                                    key={d.value}
                                    type="button"
                                    onClick={() => setDuration(d.value)}
                                    className={`py-2 px-1 text-center border text-[11px] uppercase tracking-wider transition-all ${
                                        duration === d.value
                                            ? 'border-white bg-white text-black font-bold'
                                            : 'border-zinc-800 bg-black/40 text-zinc-400 hover:text-white hover:border-zinc-600'
                                    }`}
                                >
                                    {d.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Domain / Category */}
                    <TargetDomainSelector
                        value={category}
                        onChange={(domainValue, isValid) => {
                            setCategory(domainValue);
                            setIsDomainValid(isValid);
                            if (isValid && errorMsg?.toLowerCase().includes('domain')) {
                                setErrorMsg(null);
                            }
                        }}
                        disabled={isSubmitting}
                    />

                    {/* Optional Media Upload */}
                    <div>
                        <label className="block text-zinc-400 uppercase tracking-wider mb-1.5">
                            Attach Media (Optional)
                        </label>
                        {previewUrl ? (
                            <div className="relative border border-zinc-800 bg-black p-2 flex items-center justify-between">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    {mediaFile?.type.startsWith('video') ? (
                                        <div className="w-12 h-12 bg-zinc-900 flex items-center justify-center text-zinc-400 border border-zinc-800 text-[10px]">
                                            VIDEO
                                        </div>
                                    ) : (
                                        <img src={previewUrl} alt="Preview" className="w-12 h-12 object-cover border border-zinc-800" />
                                    )}
                                    <div className="overflow-hidden">
                                        <p className="text-xs text-white truncate">{mediaFile?.name}</p>
                                        <p className="text-[10px] text-zinc-500">
                                            {((mediaFile?.size || 0) / (1024 * 1024)).toFixed(2)} MB
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleRemoveMedia}
                                    className="p-1.5 text-zinc-500 hover:text-red-400 border border-zinc-800 hover:border-zinc-700"
                                >
                                    <CloseIcon className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*,video/*"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full py-3 border border-dashed border-zinc-800 hover:border-zinc-600 bg-black/40 hover:bg-zinc-900/40 text-zinc-400 hover:text-white transition-all flex items-center justify-center gap-2 text-xs uppercase"
                                >
                                    <ArrowUpTrayIcon className="w-4 h-4 text-zinc-500" />
                                    <span>Upload Diagram / Evidence (Optional)</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Submission Progress */}
                    {isSubmitting && uploadProgress > 0 && uploadProgress < 100 && (
                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-zinc-500">
                                <span>Uploading Media...</span>
                                <span>{Math.round(uploadProgress)}%</span>
                            </div>
                            <div className="w-full h-1 bg-zinc-800 overflow-hidden">
                                <div className="h-full bg-white transition-all duration-150" style={{ width: `${uploadProgress}%` }} />
                            </div>
                        </div>
                    )}

                    {/* Footer Actions */}
                    <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2.5">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="px-4 py-2 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white text-xs uppercase tracking-wider transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !isDomainValid || !category.trim()}
                            className="flex items-center gap-2 px-5 py-2 bg-white text-black hover:bg-zinc-200 text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50"
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                    <span>Broadcasting...</span>
                                </>
                            ) : (
                                <>
                                    <SparklesIcon className="w-3.5 h-3.5 text-black" />
                                    <span>Broadcast Poll</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};
