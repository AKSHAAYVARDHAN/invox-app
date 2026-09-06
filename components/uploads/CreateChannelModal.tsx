import React, { useState, useEffect } from 'react';
import { CloseIcon, SparklesIcon, PlusIcon } from '../ui/Icons';
import { useAuth } from '../../contexts/AuthContext';
import { createChannel } from '../../services/channelService';
import type { Channel } from '../../types';

interface CreateChannelModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated?: (channel: Channel) => void;
}

const DOMAINS = [
    'Technology',
    'Artificial Intelligence',
    'Start Up',
    'Coding',
    'Design',
    'Science',
    'Business',
    'Healthcare',
    'Robotics',
];

export const CreateChannelModal: React.FC<CreateChannelModalProps> = ({
    isOpen,
    onClose,
    onCreated,
}) => {
    const { currentUser, userProfile } = useAuth();
    const [name, setName] = useState('');
    const [handle, setHandle] = useState('');
    const [domain, setDomain] = useState('Technology');
    const [description, setDescription] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Auto-derive handle when name changes
    useEffect(() => {
        if (name) {
            const clean = name.toLowerCase().replace(/[^a-z0-9]/g, '');
            setHandle(`@${clean}`);
        } else {
            setHandle('');
        }
    }, [name]);

    if (!isOpen) return null;

    const resetForm = () => {
        setName('');
        setHandle('');
        setDomain('Technology');
        setDescription('');
        setAvatarUrl('');
        setErrorMsg(null);
        setIsSubmitting(false);
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = name.trim();
        if (!trimmedName) {
            setErrorMsg('Channel name is required.');
            return;
        }

        if (!currentUser) {
            setErrorMsg('You must be authenticated to create a channel.');
            return;
        }

        setIsSubmitting(true);
        setErrorMsg(null);

        try {
            const seed = trimmedName.toLowerCase().replace(/\s+/g, '-');
            const defaultAvatar = avatarUrl.trim() || `https://picsum.photos/seed/${seed}/200`;

            const newChannel = await createChannel({
                name: trimmedName,
                handle: handle.trim() || `@${trimmedName.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
                domain,
                category: domain,
                description: description.trim(),
                avatarUrl: defaultAvatar,
                authorProfile: {
                    displayName: userProfile?.displayName || currentUser.displayName || 'Invox Member',
                    username: userProfile?.username || undefined,
                    photoURL: userProfile?.photoURL || currentUser.photoURL || undefined,
                },
            });

            onCreated?.(newChannel);
            handleClose();
        } catch (err: any) {
            console.error('[CREATE_CHANNEL_ERROR]', err);
            setErrorMsg(err?.message || 'Failed to create channel. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
            <div 
                className="relative w-full max-w-lg bg-[#0c0c0e] border border-zinc-800 shadow-2xl overflow-hidden font-mono"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-black">
                    <div className="flex items-center gap-2">
                        <span className="text-zinc-500 text-xs">// SYSTEM:</span>
                        <h3 className="text-xs font-bold text-white uppercase tracking-wider">Initialize_Channel</h3>
                    </div>
                    <button 
                        onClick={handleClose} 
                        className="text-zinc-500 hover:text-white transition-colors p-1"
                        aria-label="Close modal"
                    >
                        <CloseIcon className="w-4 h-4" />
                    </button>
                </div>

                {/* Body Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {errorMsg && (
                        <div className="p-3 bg-red-950/40 border border-red-800 text-red-400 text-xs flex items-center gap-2">
                            <span>[ERROR]</span>
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {/* Channel Name */}
                    <div>
                        <label className="block text-[10px] uppercase tracking-wider text-zinc-400 mb-1.5 font-bold">
                            Channel Name <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Neural Networks & AI"
                            maxLength={50}
                            required
                            className="w-full bg-black border border-zinc-800 p-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
                        />
                    </div>

                    {/* Handle & Domain Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] uppercase tracking-wider text-zinc-400 mb-1.5 font-bold">
                                Handle
                            </label>
                            <input
                                type="text"
                                value={handle}
                                onChange={(e) => setHandle(e.target.value)}
                                placeholder="@neuralai"
                                className="w-full bg-black border border-zinc-800 p-2.5 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] uppercase tracking-wider text-zinc-400 mb-1.5 font-bold">
                                Domain / Sector
                            </label>
                            <select
                                value={domain}
                                onChange={(e) => setDomain(e.target.value)}
                                className="w-full bg-black border border-zinc-800 p-2.5 text-xs text-white focus:outline-none focus:border-zinc-500 transition-colors cursor-pointer"
                            >
                                {DOMAINS.map(d => (
                                    <option key={d} value={d} className="bg-zinc-900 text-white">
                                        {d}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-[10px] uppercase tracking-wider text-zinc-400 mb-1.5 font-bold">
                            Description
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            placeholder="Describe what feeds and broadcasts will be transmitted on this channel..."
                            maxLength={300}
                            className="w-full bg-black border border-zinc-800 p-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors resize-none"
                        />
                    </div>

                    {/* Avatar URL (Optional) */}
                    <div>
                        <label className="block text-[10px] uppercase tracking-wider text-zinc-400 mb-1.5 font-bold">
                            Avatar URL (Optional)
                        </label>
                        <input
                            type="url"
                            value={avatarUrl}
                            onChange={(e) => setAvatarUrl(e.target.value)}
                            placeholder="https://images.unsplash.com/..."
                            className="w-full bg-black border border-zinc-800 p-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
                        />
                        <p className="text-[10px] text-zinc-600 mt-1">
                            Leave empty to automatically generate a unique visual avatar.
                        </p>
                    </div>

                    {/* Notice */}
                    <div className="p-3 bg-zinc-900/40 border border-zinc-800/80 text-[11px] text-zinc-400 leading-relaxed">
                        <span className="text-white font-bold">// BROADCAST_RULE:</span> Feeds published on Invox require an active channel. You will be set as the owner and administrator of this channel.
                    </div>

                    {/* Actions */}
                    <div className="pt-2 flex items-center justify-end gap-3 border-t border-zinc-800/80">
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={isSubmitting}
                            className="px-4 py-2 text-xs uppercase tracking-wider text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-600 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !name.trim()}
                            className="flex items-center gap-1.5 px-5 py-2 text-xs uppercase tracking-wider font-bold bg-white text-black hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                                    <span>Initializing...</span>
                                </>
                            ) : (
                                <>
                                    <PlusIcon className="w-3.5 h-3.5" />
                                    <span>Create Channel</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateChannelModal;
