import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
    CloseIcon, 
    ArrowUpTrayIcon, 
    DocumentTextIcon, 
    PlusIcon,
    InformationCircleIcon
} from '../ui/Icons';
import { handleImageError } from '../utils/imageUtils';

interface CreateFeedModalProps {
    isOpen: boolean;
    onClose: () => void;
    onPublish: (data: { oneLine: string; description: string; previewUrl: string | null; type: string }) => void;
    contextName: string;
}

const CreateFeedModal: React.FC<CreateFeedModalProps> = ({ isOpen, onClose, onPublish, contextName }) => {
    const [oneLine, setOneLine] = useState('');
    const [description, setDescription] = useState('');
    const [media, setMedia] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Draft persistence key
    const draftKey = `invox-draft-${contextName.toLowerCase()}`;

    // Load draft when modal opens or context changes
    useEffect(() => {
        if (isOpen) {
            const savedDraft = localStorage.getItem(draftKey);
            if (savedDraft) {
                try {
                    const { oneLine: savedOneLine, description: savedDescription } = JSON.parse(savedDraft);
                    setOneLine(savedOneLine || '');
                    setDescription(savedDescription || '');
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
        // If there is any content, show custom confirmation UI instead of native alert
        if (oneLine.trim() || description.trim() || media) {
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

    const handleFileChange = (file: File) => {
        setMedia(file);
        setPreviewUrl(URL.createObjectURL(file));
        setUploadProgress(0);
        const interval = setInterval(() => {
            setUploadProgress(prev => {
                if (prev >= 100) {
                    clearInterval(interval);
                    return 100;
                }
                return prev + 20;
            });
        }, 150);
    };

    const handleSaveDraft = () => {
        const draft = { oneLine, description };
        localStorage.setItem(draftKey, JSON.stringify(draft));
        onClose();
    };

    const handlePublish = async () => {
        if (!oneLine.trim()) return;
        setIsSubmitting(true);
        // Simulate network latency
        await new Promise(r => setTimeout(r, 1200));
        
        onPublish({ oneLine, description, previewUrl, type: contextName });
        
        // Clear draft on successful publish
        localStorage.removeItem(draftKey);
        resetForm();
        setIsSubmitting(false);
    };

    const resetForm = () => {
        setOneLine('');
        setDescription('');
        setMedia(null);
        setPreviewUrl(null);
        setUploadProgress(0);
        setShowDiscardConfirm(false);
    };

    // Render the modal using a Portal to ensure it covers the entire app (sidebars included)
    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop: Covers everything, including sidebars */}
            <div 
                className="absolute inset-0 bg-black/70 backdrop-blur-md animate-fadeIn"
                onClick={handleCloseWithConfirm}
            />

            {/* Modal Card: Floating, centered, and structured */}
            <div className="relative w-full max-w-3xl bg-invox-dark-accent border border-gray-700 rounded-3xl shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col animate-fadeInUp max-h-[85vh]">
                
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-700 flex-shrink-0 bg-invox-dark-accent">
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tighter uppercase leading-none">New {contextName}</h2>
                        <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.2em] mt-2">Global Broadcast Signal</p>
                    </div>
                    <button 
                        onClick={handleCloseWithConfirm} 
                        className="p-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-full transition-all"
                        aria-label="Close"
                    >
                        <CloseIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* Content Body - Scrollable but hidden scrollbars */}
                <div className="p-8 space-y-8 flex-grow overflow-y-auto no-scrollbar relative">
                    {/* Discard Confirmation Overlay (The custom alert) */}
                    {showDiscardConfirm && (
                        <div className="absolute inset-0 z-50 flex items-center justify-center p-8 bg-invox-dark/95 backdrop-blur-sm animate-fadeIn">
                            <div className="w-full max-w-sm bg-invox-dark-accent border border-gray-700 rounded-3xl p-8 shadow-2xl text-center flex flex-col items-center">
                                <div className="p-4 rounded-full bg-invox-red/10 mb-6">
                                    <InformationCircleIcon className="w-10 h-10 text-invox-red" />
                                </div>
                                <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-2">Discard Changes?</h3>
                                <p className="text-gray-400 text-sm mb-8 leading-relaxed">
                                    Your progress will be lost. To keep your changes for later, use the <strong>Save as Draft</strong> option instead.
                                </p>
                                <div className="flex flex-col w-full gap-3">
                                    <button 
                                        onClick={handleConfirmDiscard}
                                        className="w-full py-4 rounded-2xl bg-invox-red text-white text-[11px] font-black uppercase tracking-[0.2em] hover:bg-invox-red-hover transition-all active:scale-95"
                                    >
                                        Discard Signal
                                    </button>
                                    <button 
                                        onClick={() => setShowDiscardConfirm(false)}
                                        className="w-full py-4 rounded-2xl bg-gray-800 text-white text-[11px] font-black uppercase tracking-[0.2em] hover:bg-gray-700 transition-all active:scale-95"
                                    >
                                        Keep Editing
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* The Hook */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">The Hook</label>
                            <span className="text-[10px] font-black text-invox-red uppercase tracking-widest">Required</span>
                        </div>
                        <input 
                            type="text"
                            placeholder="A powerful one-liner for your idea"
                            value={oneLine}
                            onChange={(e) => setOneLine(e.target.value)}
                            className="w-full bg-invox-dark border border-gray-700 rounded-2xl p-4 text-white text-lg font-bold placeholder-[#4B5563] focus:outline-none focus:ring-1 focus:ring-invox-red/50 transition-all shadow-inner"
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Description</label>
                        <textarea 
                            placeholder="Expand on your vision, provide context, or share key insights..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full bg-invox-dark border border-gray-700 rounded-2xl p-4 text-gray-300 min-h-[160px] text-base placeholder-[#4B5563] focus:outline-none focus:ring-1 focus:ring-invox-red/50 transition-all resize-none shadow-inner leading-relaxed"
                        />
                    </div>

                    {/* Asset Upload */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Visual Asset</label>
                        <div 
                            className={`relative border-2 border-dashed rounded-3xl transition-all duration-300 ${isDragging ? 'border-invox-red bg-invox-red/5' : 'border-gray-700 hover:border-invox-light-gray/30'} bg-invox-dark/50`}
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files?.[0]) handleFileChange(e.dataTransfer.files[0]); }}
                        >
                            {!previewUrl ? (
                                <button onClick={() => fileInputRef.current?.click()} className="w-full h-48 flex flex-col items-center justify-center gap-4 group">
                                    <div className="p-4 rounded-2xl bg-gray-700/30 group-hover:bg-invox-red/10 group-hover:scale-110 transition-all duration-300 border border-white/5">
                                        <ArrowUpTrayIcon className="w-8 h-8 text-gray-500 group-hover:text-invox-red" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm font-bold text-gray-400 group-hover:text-white transition-colors">Select media asset</p>
                                        <p className="text-[10px] text-gray-600 uppercase font-black tracking-widest mt-1">MP4 / JPG / PNG</p>
                                    </div>
                                </button>
                            ) : (
                                <div className="p-4 flex flex-col gap-4">
                                    <div className="relative aspect-video bg-black rounded-2xl overflow-hidden flex items-center justify-center border border-white/5 shadow-2xl">
                                        {media?.type.startsWith('video') ? (
                                            <video src={previewUrl} className="max-h-full" controls />
                                        ) : (
                                            <img src={previewUrl} onError={handleImageError} className="max-h-full object-contain" />
                                        )}
                                        <button 
                                            onClick={() => { setPreviewUrl(null); setMedia(null); }} 
                                            className="absolute top-4 right-4 bg-black/60 p-2 rounded-full hover:bg-invox-red transition-all backdrop-blur-md shadow-lg border border-white/10"
                                        >
                                            <CloseIcon className="w-4 h-4 text-white" />
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between px-2">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <DocumentTextIcon className="w-4 h-4 text-invox-red" />
                                            <span className="text-[10px] font-black text-gray-400 truncate max-w-[240px] tracking-wider">{media?.name}</span>
                                        </div>
                                        <span className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em]">
                                            {uploadProgress < 100 ? `Syncing ${uploadProgress}%` : 'Asset Linked'}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept="image/*,video/*" 
                            onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])} 
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 bg-invox-dark border-t border-gray-700 flex items-center justify-between flex-shrink-0">
                    <button 
                        onClick={handleSaveDraft} 
                        className="px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 hover:text-white transition-all hover:bg-white/5 rounded-xl"
                    >
                        Save as Draft
                    </button>
                    <button 
                        disabled={!oneLine.trim() || isSubmitting}
                        onClick={handlePublish}
                        className="flex items-center gap-3 bg-invox-red hover:bg-invox-red-hover disabled:bg-gray-800 disabled:text-gray-600 px-10 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all active:scale-95"
                    >
                        {isSubmitting ? (
                            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <PlusIcon className="w-4 h-4" />
                        )}
                        <span>Publish</span>
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default CreateFeedModal;