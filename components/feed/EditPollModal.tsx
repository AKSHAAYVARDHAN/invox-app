import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    XMarkIcon, 
    ArrowUpTrayIcon, 
    TrashIcon, 
    PlusIcon, 
    CheckIcon,
    ClockIcon
} from '../ui/Icons';
import { TargetDomainSelector } from '../ui/TargetDomainSelector';
import { updatePoll } from '../../services/pollService';
import type { Poll, PollDuration } from '../../types';

interface EditPollModalProps {
    isOpen: boolean;
    poll: Poll | null;
    onClose: () => void;
    onUpdated?: (updatedPoll: Poll) => void;
}

const POLL_DURATIONS: { label: string; value: PollDuration }[] = [
    { label: '24 Hours', value: '1d' },
    { label: '3 Days', value: '3d' },
    { label: '7 Days', value: '7d' },
    { label: '30 Days', value: '30d' },
    { label: 'Never Expires', value: 'never' },
];

export const EditPollModal: React.FC<EditPollModalProps> = ({
    isOpen,
    poll,
    onClose,
    onUpdated,
}) => {
    // Form fields
    const [question, setQuestion] = useState('');
    const [description, setDescription] = useState('');
    const [domain, setDomain] = useState('Technology');
    const [isDomainValid, setIsDomainValid] = useState(true);
    const [duration, setDuration] = useState<PollDuration>('7d');
    const [options, setOptions] = useState<{ id?: string; text: string; voteCount?: number }[]>([]);

    // Media
    const [existingMediaUrl, setExistingMediaUrl] = useState<string | null>(null);
    const [existingMediaType, setExistingMediaType] = useState<'image' | 'video' | null>(null);
    const [mediaFile, setMediaFile] = useState<File | null>(null);
    const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
    const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
    const [isMediaRemoved, setIsMediaRemoved] = useState(false);

    // UI state
    const [isSaving, setIsSaving] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
    const [notificationMessage, setNotificationMessage] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initialize from poll data
    useEffect(() => {
        if (isOpen && poll) {
            setQuestion(poll.question || '');
            setDescription(poll.description || '');
            setDomain(poll.domain || poll.category || 'Technology');
            setDuration(poll.duration || '7d');
            
            const initialOptions = Array.isArray(poll.options) && poll.options.length > 0
                ? poll.options.map(o => ({ id: o.id, text: o.text, voteCount: o.voteCount || 0 }))
                : [
                    { id: 'opt-1', text: '', voteCount: 0 },
                    { id: 'opt-2', text: '', voteCount: 0 }
                ];
            setOptions(initialOptions);

            setExistingMediaUrl(poll.mediaUrl || null);
            setExistingMediaType(poll.mediaType || null);
            setMediaFile(null);
            setMediaPreviewUrl(null);
            setMediaType(null);
            setIsMediaRemoved(false);

            setErrorMessage(null);
            setShowDiscardConfirm(false);
            setNotificationMessage(null);
        }
    }, [isOpen, poll]);

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

    // Dirty check
    const isDirty = useMemo(() => {
        if (!poll) return false;
        if (question.trim() !== (poll.question || '').trim()) return true;
        if (description.trim() !== (poll.description || '').trim()) return true;
        if (domain.trim() !== (poll.domain || poll.category || 'Technology').trim()) return true;
        if (duration !== (poll.duration || PollDuration.OneDay)) return true;
        if (mediaFile !== null) return true;
        if (isMediaRemoved && Boolean(poll.mediaUrl)) return true;

        const originalOpts = poll.options || [];
        if (options.length !== originalOpts.length) return true;
        for (let i = 0; i < options.length; i++) {
            if (options[i].text.trim() !== (originalOpts[i]?.text || '').trim()) return true;
        }
        return false;
    }, [poll, question, description, domain, duration, mediaFile, isMediaRemoved, options]);

    // Handle close with confirmation
    const handleAttemptClose = () => {
        if (isSaving) return;
        if (isDirty) {
            setShowDiscardConfirm(true);
        } else {
            onClose();
        }
    };

    // Keyboard escape listener
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (showDiscardConfirm) {
                    setShowDiscardConfirm(false);
                } else if (isOpen) {
                    handleAttemptClose();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, showDiscardConfirm, isDirty, isSaving]);

    // File handler
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 50 * 1024 * 1024) {
            setErrorMessage('File exceeds 50MB limit.');
            return;
        }

        setMediaFile(file);
        setIsMediaRemoved(false);
        const objectUrl = URL.createObjectURL(file);
        setMediaPreviewUrl(objectUrl);
        setMediaType(file.type.startsWith('video') ? 'video' : 'image');
    };

    const handleRemoveMedia = () => {
        setMediaFile(null);
        if (mediaPreviewUrl) {
            URL.revokeObjectURL(mediaPreviewUrl);
            setMediaPreviewUrl(null);
        }
        setExistingMediaUrl(null);
        setExistingMediaType(null);
        setMediaType(null);
        setIsMediaRemoved(true);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Option handlers
    const handleAddOption = () => {
        if (options.length >= 6) return;
        setOptions(prev => [
            ...prev,
            { id: `opt-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`, text: '', voteCount: 0 }
        ]);
    };

    const handleRemoveOption = (index: number) => {
        if (options.length <= 2) return;
        setOptions(prev => prev.filter((_, i) => i !== index));
    };

    const handleOptionTextChange = (index: number, text: string) => {
        setOptions(prev => prev.map((opt, i) => i === index ? { ...opt, text } : opt));
    };

    // Save handler
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!poll) return;

        const trimmedQuestion = question.trim();
        if (!trimmedQuestion) {
            setErrorMessage('Poll question cannot be empty.');
            return;
        }

        const validOptions = options.map(o => ({ ...o, text: o.text.trim() })).filter(o => Boolean(o.text));
        if (validOptions.length < 2) {
            setErrorMessage('A poll must have at least 2 non-empty options.');
            return;
        }

        if (!isDomainValid || !domain.trim()) {
            setErrorMessage('Please select or specify a target domain.');
            return;
        }

        setIsSaving(true);
        setErrorMessage(null);

        try {
            const updatePayload: any = {
                question: trimmedQuestion,
                description: description.trim(),
                category: domain.trim(),
                domain: domain.trim(),
                duration,
                options: validOptions.map(o => ({
                    id: o.id,
                    text: o.text,
                })),
            };

            if (mediaFile) {
                updatePayload.mediaFile = mediaFile;
            } else if (isMediaRemoved) {
                updatePayload.mediaUrl = null;
                updatePayload.mediaType = null;
            }

            const updated = await updatePoll(poll.id, updatePayload, (progress) => {
                setUploadProgress(progress);
            });

            setNotificationMessage('// POLL UPDATED SUCCESSFULLY');
            onUpdated?.(updated);

            setTimeout(() => {
                onClose();
            }, 500);
        } catch (err: any) {
            console.error('[POLL_EDIT_ERROR]', err);
            setErrorMessage(err.message || 'Failed to update poll.');
            setIsSaving(false);
        }
    };

    if (!isOpen || !poll) return null;

    const currentDisplayMedia = mediaPreviewUrl || (!isMediaRemoved ? existingMediaUrl : null);
    const currentDisplayMediaType = mediaType || (!isMediaRemoved ? existingMediaType : null);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
            {/* Modal Box */}
            <div 
                className="bg-[#0c0c0e] border border-zinc-800 w-full max-w-xl max-h-[90vh] flex flex-col font-mono text-xs shadow-2xl relative"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/70">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-white inline-block"></span>
                        <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                            // EDIT TRANSMISSION · POLL
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={handleAttemptClose}
                        className="text-zinc-400 hover:text-white p-1 transition-colors"
                        aria-label="Close"
                    >
                        <XMarkIcon className="w-4 h-4" />
                    </button>
                </div>

                {/* Notification toast if saved */}
                {notificationMessage && (
                    <div className="bg-emerald-950/90 border-b border-emerald-700/80 px-4 py-2 flex items-center gap-2 text-emerald-300 text-xs font-bold">
                        <CheckIcon className="w-4 h-4 text-emerald-400" />
                        <span>{notificationMessage}</span>
                    </div>
                )}

                {/* Error Banner */}
                {errorMessage && (
                    <div className="bg-red-950/80 border-b border-red-800 px-4 py-2 text-red-300 text-xs flex items-center justify-between">
                        <span>{errorMessage}</span>
                        <button type="button" onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-white">
                            <XMarkIcon className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}

                {/* Scrollable Form Body */}
                <form id="edit-poll-form" onSubmit={handleSave} className="overflow-y-auto p-4 sm:p-6 space-y-5 flex-1 custom-scrollbar">
                    {/* Poll Question */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
                                // POLL QUESTION <span className="text-red-400">*</span>
                            </label>
                            <span className="text-[10px] text-zinc-500">{question.length}/280</span>
                        </div>
                        <input
                            type="text"
                            maxLength={280}
                            value={question}
                            onChange={e => setQuestion(e.target.value)}
                            placeholder="What would you like to poll the network about?"
                            className="w-full bg-zinc-900/60 border border-zinc-800 text-white p-2.5 text-xs focus:border-white focus:outline-none transition-colors"
                            required
                        />
                    </div>

                    {/* Context / Description */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
                                // CONTEXT / BACKGROUND
                            </label>
                            <span className="text-[10px] text-zinc-500">{description.length} chars</span>
                        </div>
                        <textarea
                            rows={3}
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Provide any additional nuances, assumptions, or voting context..."
                            className="w-full bg-zinc-900/60 border border-zinc-800 text-white p-2.5 text-xs focus:border-white focus:outline-none transition-colors resize-y"
                        />
                    </div>

                    {/* Poll Options */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <div>
                                <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block">
                                    // POLL OPTIONS (2 TO 6) <span className="text-red-400">*</span>
                                </label>
                                <span className="text-[10px] text-zinc-500">Existing votes on retained options are preserved.</span>
                            </div>
                            {options.length < 6 && (
                                <button
                                    type="button"
                                    onClick={handleAddOption}
                                    className="flex items-center gap-1 text-[11px] text-zinc-300 hover:text-white border border-zinc-800 hover:border-zinc-600 px-2 py-1 bg-zinc-900/60"
                                >
                                    <PlusIcon className="w-3.5 h-3.5" />
                                    <span>Add Option</span>
                                </button>
                            )}
                        </div>

                        <div className="space-y-2">
                            {options.map((option, idx) => (
                                <div key={option.id || idx} className="flex items-center gap-2">
                                    <span className="w-6 text-[10px] text-zinc-500 text-center font-bold">0{idx + 1}</span>
                                    <input
                                        type="text"
                                        maxLength={80}
                                        value={option.text}
                                        onChange={e => handleOptionTextChange(idx, e.target.value)}
                                        placeholder={`Option ${idx + 1}`}
                                        className="flex-1 bg-zinc-900/60 border border-zinc-800 text-white p-2 text-xs focus:border-white focus:outline-none"
                                        required
                                    />
                                    {option.voteCount !== undefined && option.voteCount > 0 && (
                                        <span className="text-[10px] text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-1 flex-shrink-0">
                                            {option.voteCount} vote{option.voteCount === 1 ? '' : 's'}
                                        </span>
                                    )}
                                    {options.length > 2 && (
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveOption(idx)}
                                            className="p-1.5 text-zinc-500 hover:text-red-400 border border-transparent hover:border-zinc-800"
                                            aria-label="Remove option"
                                        >
                                            <TrashIcon className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Target Domain */}
                    <div>
                        <TargetDomainSelector
                            value={domain}
                            onChange={(val, valid) => {
                                setDomain(val);
                                setIsDomainValid(valid);
                            }}
                            label="// TARGET DOMAIN"
                            subLabel="Classification category"
                        />
                    </div>

                    {/* Duration */}
                    <div>
                        <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1.5">
                            // POLL DURATION
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {POLL_DURATIONS.map(d => (
                                <button
                                    key={d.value}
                                    type="button"
                                    onClick={() => setDuration(d.value)}
                                    className={`p-2 border text-[11px] uppercase tracking-wider transition-all text-center ${
                                        duration === d.value
                                            ? 'bg-white text-black border-white font-bold'
                                            : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:border-zinc-600 hover:text-white'
                                    }`}
                                >
                                    {d.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Media Attachments */}
                    <div>
                        <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1.5">
                            // ATTACHED MEDIA
                        </label>
                        {currentDisplayMedia ? (
                            <div className="relative border border-zinc-800 bg-black p-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                                <div className="flex items-center gap-3 overflow-hidden w-full sm:w-auto">
                                    {currentDisplayMediaType === 'video' ? (
                                        <video src={currentDisplayMedia} className="w-16 h-16 object-cover border border-zinc-800 flex-shrink-0" />
                                    ) : (
                                        <img src={currentDisplayMedia} alt="Media" className="w-16 h-16 object-cover border border-zinc-800 flex-shrink-0" />
                                    )}
                                    <div className="truncate">
                                        <span className="text-zinc-200 font-bold block truncate">
                                            {mediaFile ? mediaFile.name : 'Current Poll Media'}
                                        </span>
                                        <span className="text-[10px] text-zinc-500 uppercase">
                                            {mediaFile ? `${(mediaFile.size / 1024 / 1024).toFixed(2)} MB` : 'Cloud Stored'}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 hover:text-white text-[11px] uppercase tracking-wider transition-colors"
                                    >
                                        Replace
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleRemoveMedia}
                                        className="px-2.5 py-1.5 bg-red-950/40 hover:bg-red-950 border border-red-800 text-red-400 hover:text-red-300 text-[11px] uppercase tracking-wider transition-colors flex items-center gap-1"
                                    >
                                        <TrashIcon className="w-3.5 h-3.5" />
                                        <span>Remove</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div 
                                onClick={() => fileInputRef.current?.click()}
                                className="border border-dashed border-zinc-800 hover:border-zinc-600 bg-zinc-950/40 p-4 text-center cursor-pointer transition-colors"
                            >
                                <ArrowUpTrayIcon className="w-5 h-5 mx-auto mb-1 text-zinc-500" />
                                <span className="text-zinc-300 block font-bold">// ATTACH IMAGE OR VIDEO</span>
                                <span className="text-zinc-500 text-[10px]">JPG, PNG, WebP, MP4 up to 50MB</span>
                            </div>
                        )}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*,video/*"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                    </div>
                </form>

                {/* Footer Controls */}
                <div className="p-4 border-t border-zinc-800 bg-zinc-950/70 flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={handleAttemptClose}
                        disabled={isSaving}
                        className="px-4 py-2 text-xs uppercase tracking-wider text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-600 transition-colors"
                    >
                        // DISCARD / CANCEL
                    </button>

                    <button
                        type="submit"
                        form="edit-poll-form"
                        disabled={isSaving}
                        className="px-6 py-2 bg-white text-black hover:bg-zinc-200 text-xs uppercase font-bold tracking-wider transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        {isSaving ? (
                            <>
                                <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                                <span>SAVING CHANGES...</span>
                            </>
                        ) : (
                            <span>// SAVE CHANGES</span>
                        )}
                    </button>
                </div>
            </div>

            {/* Discard Confirmation Dialog */}
            {showDiscardConfirm && (
                <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-[#0c0c0e] border border-zinc-700 p-5 max-w-sm w-full font-mono shadow-2xl space-y-4">
                        <div className="space-y-1">
                            <span className="text-[10px] text-amber-400 uppercase font-bold">// WARNING: UNSAVED MODIFICATIONS</span>
                            <h3 className="text-sm font-bold text-white uppercase">Discard unsaved changes?</h3>
                            <p className="text-xs text-zinc-400 leading-relaxed">
                                Any modifications made to this poll will be permanently lost.
                            </p>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                            <button
                                type="button"
                                onClick={() => setShowDiscardConfirm(false)}
                                className="px-3 py-1.5 text-xs uppercase tracking-wider text-zinc-300 hover:text-white border border-zinc-800 hover:border-zinc-600 transition-colors"
                            >
                                Keep Editing
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowDiscardConfirm(false);
                                    onClose();
                                }}
                                className="px-3 py-1.5 text-xs uppercase font-bold tracking-wider bg-red-950/60 hover:bg-red-900 border border-red-700 text-red-200 transition-colors"
                            >
                                // DISCARD
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
