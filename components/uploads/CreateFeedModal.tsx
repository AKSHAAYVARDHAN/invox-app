import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
    CloseIcon, 
    ArrowUpTrayIcon, 
    DocumentTextIcon, 
    PlusIcon,
    InformationCircleIcon,
    SparklesIcon,
    CheckBadgeIcon,
    ChevronDownIcon
} from '../ui/Icons';
import { handleImageError } from '../utils/imageUtils';
import { useAuth } from '../../contexts/AuthContext';
import { getUserChannels, createChannel } from '../../services/channelService';
import type { Channel } from '../../types';
import { TargetDomainSelector } from '../ui/TargetDomainSelector';

interface CreateFeedModalProps {
    isOpen: boolean;
    onClose: () => void;
    onPublish: (data: { 
        oneLine: string; 
        description: string; 
        previewUrl: string | null; 
        mediaFile?: File | null; 
        mediaFiles?: File[] | null;
        mediaUrls?: string[];
        type: string;
        channelId?: string;
        channelName?: string;
        channelAvatarUrl?: string;
        category?: string;
        domain?: string;
    }) => Promise<void> | void;
    contextName: string;
    preselectedChannelId?: string;
}

const CreateFeedModal: React.FC<CreateFeedModalProps> = ({ isOpen, onClose, onPublish, contextName, preselectedChannelId }) => {
    const { currentUser, userProfile } = useAuth();
    const [oneLine, setOneLine] = useState('');
    const [description, setDescription] = useState('');
    const [media, setMedia] = useState<File | null>(null);
    const [mediaFiles, setMediaFiles] = useState<File[]>([]);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);
    const [selectedPreviewIndex, setSelectedPreviewIndex] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const isInitialStill = contextName.toLowerCase() === 'still' || contextName.toLowerCase() === 'stills';
    const isInitialTape = contextName.toLowerCase() === 'tape' || contextName.toLowerCase() === 'tapes';
    const isInitialKnack = contextName.toLowerCase() === 'knack' || contextName.toLowerCase() === 'knacks';
    const isMomentContext = isInitialStill || isInitialTape || isInitialKnack || contextName.toLowerCase() === 'moment';

    const [selectedMomentType, setSelectedMomentType] = useState<'Still' | 'Tape' | 'Knack'>(() => {
        if (isInitialTape) return 'Tape';
        if (isInitialKnack) return 'Knack';
        return 'Still';
    });

    useEffect(() => {
        if (isInitialTape) setSelectedMomentType('Tape');
        else if (isInitialKnack) setSelectedMomentType('Knack');
        else if (isInitialStill) setSelectedMomentType('Still');
    }, [contextName, isInitialTape, isInitialKnack, isInitialStill]);

    const isStill = isMomentContext ? selectedMomentType === 'Still' : isInitialStill;
    const isTape = isMomentContext ? selectedMomentType === 'Tape' : isInitialTape;
    const isKnack = isMomentContext ? selectedMomentType === 'Knack' : isInitialKnack;

    // Target domain state
    const [targetDomain, setTargetDomain] = useState('Technology');
    const [isTargetDomainValid, setIsTargetDomainValid] = useState(true);

    // Channel state
    const [userChannels, setUserChannels] = useState<Channel[]>([]);
    const [selectedChannelId, setSelectedChannelId] = useState<string>('');
    const [isLoadingChannels, setIsLoadingChannels] = useState(false);
    const [isCreatingChannelMode, setIsCreatingChannelMode] = useState(false);
    const [newChannelName, setNewChannelName] = useState('');
    const [newChannelDescription, setNewChannelDescription] = useState('');
    const [newChannelDomain, setNewChannelDomain] = useState('Technology');
    const [isCreatingChannel, setIsCreatingChannel] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Draft persistence key
    const draftKey = `invox-draft-${contextName.toLowerCase()}`;

    // Load user channels whenever modal opens
    useEffect(() => {
        if (isOpen && currentUser?.uid) {
            setIsLoadingChannels(true);
            getUserChannels(currentUser.uid)
                .then(channels => {
                    setUserChannels(channels);
                    if (channels.length > 0) {
                        if (preselectedChannelId && channels.some(c => c.id === preselectedChannelId)) {
                            setSelectedChannelId(preselectedChannelId);
                        } else {
                            setSelectedChannelId(prev => prev && channels.some(c => c.id === prev) ? prev : channels[0].id);
                        }
                        setIsCreatingChannelMode(false);
                    } else if (contextName.toLowerCase() === 'feed') {
                        // User has no channel yet and is creating a Feed post -> prompt channel setup
                        setIsCreatingChannelMode(true);
                    }
                })
                .catch(err => {
                    console.warn('Failed to load user channels:', err);
                })
                .finally(() => {
                    setIsLoadingChannels(false);
                });
        }
    }, [isOpen, currentUser?.uid, contextName]);

    // Load draft when modal opens or context changes
    useEffect(() => {
        if (isOpen) {
            const savedDraft = localStorage.getItem(draftKey);
            if (savedDraft) {
                try {
                    const { oneLine: savedOneLine, description: savedDescription, targetDomain: savedDomain } = JSON.parse(savedDraft);
                    setOneLine(savedOneLine || '');
                    setDescription(savedDescription || '');
                    if (savedDomain) {
                        setTargetDomain(savedDomain);
                    }
                } catch (e) {
                    console.error("Failed to parse draft", e);
                }
            }
        }
    }, [isOpen, draftKey]);

    // Lock body scroll when modal is open
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

    // Handle Escape key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (showDiscardConfirm) {
                    setShowDiscardConfirm(false);
                } else {
                    handleCloseWithConfirm();
                }
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [oneLine, description, media, showDiscardConfirm]); 

    if (!isOpen) return null;

    const handleCloseWithConfirm = () => {
        if (oneLine.trim() || description.trim() || media || newChannelName.trim()) {
            setShowDiscardConfirm(true);
        } else {
            onClose();
        }
    };

    const handleConfirmDiscard = () => {
        resetForm();
        setShowDiscardConfirm(false);
        onClose();
    };

    const handleFilesChange = (filesList: FileList | File[] | null) => {
        if (!filesList || (filesList as any).length === 0) return;
        const incoming = Array.from(filesList as any) as File[];

        // Validation for Moment categories
        for (const file of incoming) {
            if (isStill && file.type.startsWith('video')) {
                setErrorMsg('Stills only support photo and image media (JPG, PNG, WEBP).');
                return;
            }
            if (isTape && file.type.startsWith('image')) {
                setErrorMsg('Tapes only support video media (MP4, WEBM, MOV).');
                return;
            }
        }
        setErrorMsg(null);

        const newFiles = [...mediaFiles, ...incoming];
        setMediaFiles(newFiles);
        setMedia(newFiles[0] || null);

        const newUrls = incoming.map(f => URL.createObjectURL(f));
        const allUrls = [...previewUrls, ...newUrls];
        setPreviewUrls(allUrls);
        setPreviewUrl(allUrls[0] || null);
        setSelectedPreviewIndex(0);

        setUploadProgress(0);
        const interval = setInterval(() => {
            setUploadProgress(prev => {
                if (prev >= 100) {
                    clearInterval(interval);
                    return 100;
                }
                return prev + 25;
            });
        }, 120);
    };

    const handleSaveDraft = () => {
        const draft = { oneLine, description, targetDomain };
        localStorage.setItem(draftKey, JSON.stringify(draft));
        onClose();
    };

    const handleCreateChannelSubmit = async () => {
        if (!newChannelName.trim()) {
            setErrorMsg('Please enter a channel name.');
            return;
        }
        setIsCreatingChannel(true);
        setErrorMsg(null);
        try {
            const channel = await createChannel({
                name: newChannelName.trim(),
                description: newChannelDescription.trim(),
                domain: newChannelDomain,
                category: newChannelDomain,
                authorProfile: userProfile ? {
                    displayName: userProfile.displayName || currentUser?.displayName || undefined,
                    username: userProfile.username || undefined,
                    photoURL: userProfile.photoURL || currentUser?.photoURL || undefined,
                } : undefined,
            });
            setUserChannels(prev => [channel, ...prev]);
            setSelectedChannelId(channel.id);
            setIsCreatingChannelMode(false);
            setNewChannelName('');
            setNewChannelDescription('');
        } catch (err: any) {
            console.error('[CREATE_CHANNEL_ERROR]', err);
            setErrorMsg(err?.message || 'Failed to create channel.');
        } finally {
            setIsCreatingChannel(false);
        }
    };

    const handlePublish = async () => {
        if (!oneLine.trim()) return;

        if (!isTargetDomainValid || !targetDomain.trim()) {
            setErrorMsg('A valid target domain is required.');
            return;
        }

        // If in Feed context and user has no channels / is creating channel
        let finalChannelId = selectedChannelId;
        let finalChannelName = '';
        let finalChannelAvatar = '';

        if (contextName.toLowerCase() === 'feed') {
            if (isCreatingChannelMode && newChannelName.trim()) {
                setIsSubmitting(true);
                setErrorMsg(null);
                try {
                    const channel = await createChannel({
                        name: newChannelName.trim(),
                        description: newChannelDescription.trim(),
                        domain: targetDomain.trim() || newChannelDomain,
                        category: targetDomain.trim() || newChannelDomain,
                        authorProfile: userProfile ? {
                            displayName: userProfile.displayName || currentUser?.displayName || undefined,
                            username: userProfile.username || undefined,
                            photoURL: userProfile.photoURL || currentUser?.photoURL || undefined,
                        } : undefined,
                    });
                    finalChannelId = channel.id;
                    finalChannelName = channel.name;
                    finalChannelAvatar = channel.avatarUrl || '';
                    setUserChannels(prev => [channel, ...prev]);
                    setSelectedChannelId(channel.id);
                    setIsCreatingChannelMode(false);
                } catch (err: any) {
                    setIsSubmitting(false);
                    setErrorMsg(err?.message || 'Failed to auto-create channel before publishing.');
                    return;
                }
            } else if (userChannels.length === 0) {
                setIsCreatingChannelMode(true);
                setErrorMsg('A Channel is required before publishing a Feed broadcast. Please create your channel below.');
                return;
            } else if (selectedChannelId) {
                const selected = userChannels.find(c => c.id === selectedChannelId);
                if (selected) {
                    finalChannelName = selected.name;
                    finalChannelAvatar = selected.avatarUrl || '';
                }
            }
        }

        setIsSubmitting(true);
        setErrorMsg(null);
        try {
            await onPublish({
                oneLine: oneLine.trim(),
                description: description.trim(),
                previewUrl: previewUrls[0] || previewUrl,
                mediaFile: mediaFiles[0] || media,
                mediaFiles: mediaFiles.length > 0 ? mediaFiles : (media ? [media] : []),
                type: isMomentContext ? selectedMomentType : contextName,
                channelId: finalChannelId || undefined,
                channelName: finalChannelName || undefined,
                channelAvatarUrl: finalChannelAvatar || undefined,
                category: targetDomain.trim(),
                domain: targetDomain.trim(),
            });
            // Clear draft on successful publish
            localStorage.removeItem(draftKey);
            resetForm();
        } catch (err: any) {
            console.error('[PUBLISH_ERROR]', err);
            setErrorMsg(err?.message || 'Failed to publish post. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setOneLine('');
        setDescription('');
        setTargetDomain('Technology');
        setIsTargetDomainValid(true);
        setMedia(null);
        setMediaFiles([]);
        setPreviewUrl(null);
        setPreviewUrls([]);
        setSelectedPreviewIndex(0);
        setUploadProgress(0);
        setShowDiscardConfirm(false);
        setErrorMsg(null);
        setIsCreatingChannelMode(false);
        setNewChannelName('');
        setNewChannelDescription('');
    };

    const isFeedContext = contextName.toLowerCase() === 'feed';

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fadeIn"
                onClick={handleCloseWithConfirm}
            />

            {/* Modal Card */}
            <div className="relative w-full max-w-2xl bg-[#0c0c0e] border border-zinc-800 shadow-2xl overflow-hidden flex flex-col animate-fadeInUp max-h-[90vh]">
                
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-800 flex-shrink-0 bg-zinc-950">
                    <div>
                        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block">// TRANSMISSION_CREATOR</span>
                        <h2 className="text-sm font-bold font-mono text-white tracking-wider uppercase leading-none mt-1">
                            New {isMomentContext ? `${selectedMomentType} (Moment)` : contextName} Signal
                        </h2>
                    </div>
                    <button 
                        onClick={handleCloseWithConfirm} 
                        className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
                        aria-label="Close"
                    >
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Content Body */}
                <div className="p-5 space-y-4 flex-grow overflow-y-auto no-scrollbar relative">
                    {/* Moment Type Selector (When in Moments context) */}
                    {isMomentContext && (
                        <div className="bg-zinc-950 border border-zinc-800 p-3 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">// MOMENT_CONTENT_TYPE</span>
                                <span className="text-[10px] font-mono text-zinc-300 font-bold uppercase">{selectedMomentType}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {(['Still', 'Tape', 'Knack'] as const).map((mType) => {
                                    const isActive = selectedMomentType === mType;
                                    return (
                                        <button
                                            key={mType}
                                            type="button"
                                            onClick={() => setSelectedMomentType(mType)}
                                            className={`py-2 px-2 text-center font-mono text-xs uppercase tracking-wider transition-all border ${
                                                isActive
                                                    ? 'bg-white text-black font-bold border-white shadow-sm'
                                                    : 'bg-[#0c0c0e] text-zinc-400 border-zinc-800 hover:text-white hover:border-zinc-700'
                                            }`}
                                        >
                                            {mType === 'Still' ? '// STILLS' : mType === 'Tape' ? '// TAPES' : '// KNACKS'}
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="text-[10px] font-mono text-zinc-500 leading-normal">
                                {selectedMomentType === 'Still' && 'High-resolution still imagery, photography, and visual captures.'}
                                {selectedMomentType === 'Tape' && 'Short-form motion recordings, video transmissions, and network clips.'}
                                {selectedMomentType === 'Knack' && 'Demonstrations of technical crafts, specialized skillsets, and creative talents.'}
                            </p>
                        </div>
                    )}
                    {errorMsg && (
                        <div className="p-3 bg-red-950/40 border border-red-800 text-red-300 text-xs font-mono flex items-center justify-between">
                            <span>{errorMsg}</span>
                            <button onClick={() => setErrorMsg(null)} className="text-zinc-400 hover:text-white ml-2">
                                <CloseIcon className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    {/* Discard Confirmation Overlay */}
                    {showDiscardConfirm && (
                        <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-sm animate-fadeIn">
                            <div className="w-full max-w-sm bg-[#0c0c0e] border border-zinc-700 p-6 text-center flex flex-col items-center">
                                <div className="p-3 bg-zinc-900 border border-zinc-800 mb-4">
                                    <InformationCircleIcon className="w-6 h-6 text-white" />
                                </div>
                                <h3 className="text-sm font-bold font-mono text-white uppercase tracking-wider mb-2">Discard Changes?</h3>
                                <p className="text-zinc-400 text-xs font-mono mb-6 leading-relaxed">
                                    Your progress will be lost. To keep your changes for later, use the <strong>Save as Draft</strong> option instead.
                                </p>
                                <div className="flex flex-col w-full gap-2 font-mono text-xs">
                                    <button 
                                        onClick={handleConfirmDiscard}
                                        className="w-full py-2.5 bg-red-600 text-white font-bold uppercase tracking-wider hover:bg-red-700 transition-all"
                                    >
                                        Discard Signal
                                    </button>
                                    <button 
                                        onClick={() => setShowDiscardConfirm(false)}
                                        className="w-full py-2.5 bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white uppercase tracking-wider transition-all"
                                    >
                                        Keep Editing
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Channel Selection / Setup (Required for Feed posts) */}
                    {isFeedContext && (
                        <div className="bg-zinc-950 border border-zinc-800 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block">// CHANNEL_SOURCE</span>
                                    <span className="text-xs font-mono text-zinc-400">Content identity for Feeds</span>
                                </div>
                                {userChannels.length > 0 && !isCreatingChannelMode && (
                                    <button
                                        onClick={() => setIsCreatingChannelMode(true)}
                                        className="text-[10px] font-mono text-white uppercase tracking-wider hover:underline flex items-center gap-1"
                                    >
                                        <PlusIcon className="w-3.5 h-3.5" />
                                        <span>New Channel</span>
                                    </button>
                                )}
                            </div>

                            {isCreatingChannelMode ? (
                                <div className="space-y-3 pt-2 border-t border-zinc-800 animate-fadeIn">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">Create New Channel</span>
                                        {userChannels.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setIsCreatingChannelMode(false)}
                                                className="text-[10px] font-mono text-zinc-400 hover:text-white"
                                            >
                                                Use Existing Channel
                                            </button>
                                        )}
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Channel Name (e.g. Technology & Innovation)"
                                        value={newChannelName}
                                        onChange={(e) => setNewChannelName(e.target.value)}
                                        className="w-full bg-[#0c0c0e] border border-zinc-700 p-2.5 text-white text-xs font-mono focus:outline-none focus:border-zinc-500"
                                    />
                                    <div className="grid grid-cols-2 gap-3">
                                        <select
                                            value={newChannelDomain}
                                            onChange={(e) => setNewChannelDomain(e.target.value)}
                                            className="bg-[#0c0c0e] border border-zinc-700 p-2.5 text-white text-xs font-mono focus:outline-none focus:border-zinc-500"
                                        >
                                            <option value="Technology">Technology</option>
                                            <option value="Science">Science</option>
                                            <option value="Business">Business</option>
                                            <option value="Startups & Entrepreneurship">Startups & Entrepreneurship</option>
                                            <option value="Design">Design</option>
                                            <option value="Arts & Culture">Arts & Culture</option>
                                            <option value="Health & Medicine">Health & Medicine</option>
                                            <option value="Education & Research">Education & Research</option>
                                            <option value="Finance">Finance</option>
                                            <option value="Society & Ideas">Society & Ideas</option>
                                            <option value="General">General</option>
                                        </select>
                                        <button
                                            type="button"
                                            onClick={handleCreateChannelSubmit}
                                            disabled={!newChannelName.trim() || isCreatingChannel}
                                            className="flex items-center justify-center gap-2 bg-white hover:bg-zinc-200 disabled:opacity-50 text-black text-xs font-mono font-bold uppercase tracking-wider p-2.5 transition-colors"
                                        >
                                            {isCreatingChannel ? (
                                                <div className="w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
                                            ) : (
                                                <PlusIcon className="w-3.5 h-3.5 text-black" />
                                            )}
                                            <span>Save Channel</span>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3">
                                    <select
                                        value={selectedChannelId}
                                        onChange={(e) => setSelectedChannelId(e.target.value)}
                                        className="w-full bg-[#0c0c0e] border border-zinc-700 p-2.5 text-white text-xs font-mono focus:outline-none focus:border-zinc-500"
                                    >
                                        {userChannels.map(channel => (
                                            <option key={channel.id} value={channel.id}>
                                                {channel.name} ({channel.domain || channel.category || 'General'})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Target Domain */}
                    <TargetDomainSelector
                        value={targetDomain}
                        label="Target Domain"
                        subLabel="// DOMAIN"
                        onChange={(domainVal, isValid) => {
                            setTargetDomain(domainVal);
                            setIsTargetDomainValid(isValid);
                            if (isValid && errorMsg?.toLowerCase().includes('domain')) {
                                setErrorMsg(null);
                            }
                        }}
                        disabled={isSubmitting}
                    />

                    {/* The Hook */}
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                            <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">// THE_HOOK</label>
                            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">*Required</span>
                        </div>
                        <input 
                            type="text"
                            placeholder="A concise one-liner for your idea"
                            value={oneLine}
                            onChange={(e) => setOneLine(e.target.value)}
                            className="w-full bg-[#0c0c0e] border border-zinc-700 p-3 text-white text-sm font-mono placeholder-zinc-600 focus:outline-none focus:border-white transition-all"
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">// DETAILS_AND_INSIGHTS</label>
                        <textarea 
                            placeholder="Expand on your vision, provide context, or share key insights..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full bg-[#0c0c0e] border border-zinc-700 p-3 text-zinc-300 min-h-[120px] text-xs font-mono placeholder-zinc-600 focus:outline-none focus:border-white transition-all resize-none leading-relaxed"
                        />
                    </div>

                    {/* Asset Upload */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                            // VISUAL_ATTACHMENT {isMomentContext && `[${contextName.toUpperCase()}]`}
                        </label>
                        <div 
                            className={`relative border border-dashed transition-all duration-200 ${isDragging ? 'border-white bg-zinc-900/50' : 'border-zinc-700 hover:border-zinc-500'} bg-zinc-950`}
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={(e) => { 
                                e.preventDefault(); 
                                setIsDragging(false); 
                                if (e.dataTransfer.files) handleFilesChange(e.dataTransfer.files); 
                            }}
                        >
                            {!previewUrl && previewUrls.length === 0 ? (
                                <button onClick={() => fileInputRef.current?.click()} className="w-full h-32 flex flex-col items-center justify-center gap-2 group">
                                    <div className="p-2.5 bg-zinc-900 group-hover:bg-zinc-800 transition-colors border border-zinc-800">
                                        <ArrowUpTrayIcon className="w-5 h-5 text-zinc-400 group-hover:text-white" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xs font-mono text-zinc-300 group-hover:text-white transition-colors">
                                            {isStill ? 'Select photo / image assets' : isTape ? 'Select video asset' : 'Select media asset(s)'}
                                        </p>
                                        <p className="text-[10px] text-zinc-500 font-mono tracking-widest mt-0.5">
                                            {isStill ? '// JPG / PNG / WEBP' : isTape ? '// MP4 / WEBM / MOV' : '// MP4 / JPG / PNG'}
                                        </p>
                                    </div>
                                </button>
                            ) : (
                                <div className="p-3 flex flex-col gap-3">
                                    <div className="relative aspect-video bg-black overflow-hidden flex items-center justify-center border border-zinc-800">
                                        {(mediaFiles[selectedPreviewIndex]?.type.startsWith('video') || (previewUrls[selectedPreviewIndex] || previewUrl || '').match(/\.(mp4|webm|mov)/i)) ? (
                                            <video src={previewUrls[selectedPreviewIndex] || previewUrl || ''} className="max-h-full" controls />
                                        ) : (
                                            <img src={previewUrls[selectedPreviewIndex] || previewUrl || ''} onError={handleImageError} className="max-h-full object-contain" alt="Media preview" />
                                        )}
                                        <button 
                                            onClick={() => { 
                                                setPreviewUrl(null); 
                                                setPreviewUrls([]);
                                                setMedia(null); 
                                                setMediaFiles([]);
                                            }} 
                                            className="absolute top-2 right-2 bg-black/80 p-1.5 hover:bg-zinc-800 transition-all border border-zinc-700 z-10"
                                            title="Clear attachments"
                                        >
                                            <CloseIcon className="w-3.5 h-3.5 text-white" />
                                        </button>
                                    </div>

                                    {/* Multiple Media Thumbnails Carousel Bar */}
                                    {previewUrls.length > 1 && (
                                        <div className="flex items-center gap-2 overflow-x-auto py-1">
                                            {previewUrls.map((url, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => setSelectedPreviewIndex(idx)}
                                                    className={`relative w-12 h-12 flex-shrink-0 border overflow-hidden ${
                                                        idx === selectedPreviewIndex ? 'border-white ring-1 ring-white' : 'border-zinc-800 opacity-60 hover:opacity-100'
                                                    }`}
                                                >
                                                    <img src={url} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" onError={handleImageError} />
                                                    <span className="absolute bottom-0 right-0 bg-black/80 text-[8px] font-mono text-zinc-300 px-1">
                                                        {idx + 1}
                                                    </span>
                                                </button>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={() => fileInputRef.current?.click()}
                                                className="w-12 h-12 flex-shrink-0 border border-dashed border-zinc-700 hover:border-white flex items-center justify-center text-zinc-400 hover:text-white text-xs font-mono bg-zinc-900/50"
                                                title="Add more media"
                                            >
                                                +
                                            </button>
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between px-1">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <DocumentTextIcon className="w-4 h-4 text-white" />
                                            <span className="text-[10px] font-mono text-zinc-400 truncate max-w-[240px]">
                                                {mediaFiles.length > 1 ? `${mediaFiles.length} media files selected` : (media?.name || 'attachment')}
                                            </span>
                                        </div>
                                        <span className="text-[10px] font-mono text-zinc-500">
                                            {uploadProgress < 100 ? `SYNC: ${uploadProgress}%` : '// ATTACHED'}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept={isStill ? "image/*" : isTape ? "video/*" : "image/*,video/*"} 
                            multiple={!isTape}
                            onChange={(e) => e.target.files && handleFilesChange(e.target.files)} 
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between flex-shrink-0">
                    <button 
                        onClick={handleSaveDraft} 
                        className="px-4 py-2 text-xs font-mono uppercase tracking-wider text-zinc-400 hover:text-white transition-all hover:bg-zinc-900 border border-transparent hover:border-zinc-800"
                    >
                        Save as Draft
                    </button>
                    <button 
                        disabled={!oneLine.trim() || isSubmitting || !isTargetDomainValid || !targetDomain.trim()}
                        onClick={handlePublish}
                        className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-850 disabled:bg-zinc-950 disabled:text-zinc-700 disabled:border-zinc-850 px-6 py-2 text-xs font-mono uppercase font-bold tracking-wider text-white border border-zinc-700/80 hover:border-zinc-500 transition-all shadow-sm"
                    >
                        {isSubmitting ? (
                            <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <PlusIcon className="w-3.5 h-3.5 text-zinc-400" />
                        )}
                        <span>// PUBLISH</span>
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default CreateFeedModal;
