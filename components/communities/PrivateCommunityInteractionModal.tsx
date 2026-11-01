import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
    subscribeCommunityPrivateMessages, 
    sendCommunityPrivateMessage,
    CommunityPrivateMessage,
    JoinedCommunityRecord 
} from '../../services/communityService';
import { CloseIcon, SendIcon, ShieldCheckIcon, UsersIcon, LockClosedIcon } from '../ui/Icons';
import { handleImageError } from '../utils/imageUtils';

interface PrivateCommunityInteractionModalProps {
    isOpen: boolean;
    onClose: () => void;
    communityRecord: JoinedCommunityRecord | null;
}

export const PrivateCommunityInteractionModal: React.FC<PrivateCommunityInteractionModalProps> = ({
    isOpen,
    onClose,
    communityRecord,
}) => {
    const { currentUser, userProfile } = useAuth();
    const [messages, setMessages] = useState<CommunityPrivateMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const communityId = communityRecord?.id || '';

    // Subscribe to isolated private messages for this specific community
    useEffect(() => {
        if (!isOpen || !communityId) {
            setMessages([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const unsubscribe = subscribeCommunityPrivateMessages(
            communityId,
            (list) => {
                setMessages(list);
                setLoading(false);
            },
            (err) => {
                console.warn('[COMMUNITY_INBOX_ERR]', err);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [isOpen, communityId]);

    // Auto-scroll to bottom of conversation
    useEffect(() => {
        if (messages.length > 0) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    if (!isOpen || !communityRecord) return null;

    const { community, role, isOwner, isAdmin } = communityRecord;

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!text.trim() || !currentUser?.uid || sending) return;

        const payloadText = text.trim();
        setText('');
        setSending(true);

        try {
            await sendCommunityPrivateMessage(
                communityId,
                {
                    uid: currentUser.uid,
                    displayName: userProfile?.displayName || currentUser.displayName || 'Member',
                    photoURL: userProfile?.photoURL || currentUser.photoURL || null,
                },
                payloadText
            );
        } catch (err) {
            console.error('[SEND_MSG_ERR]', err);
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
            <div className="bg-[#0c0c0e] border border-zinc-800 max-w-2xl w-full h-[85vh] max-h-[700px] flex flex-col font-mono shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-[#09090b]">
                    <div className="flex items-center gap-3 min-w-0">
                        {community.avatarUrl ? (
                            <img
                                src={community.avatarUrl}
                                alt={community.name}
                                onError={handleImageError}
                                className="w-10 h-10 object-cover border border-zinc-800 flex-shrink-0"
                            />
                        ) : (
                            <div className="w-10 h-10 bg-zinc-950 border border-zinc-800 flex items-center justify-center flex-shrink-0">
                                <UsersIcon className="w-5 h-5 text-zinc-500" />
                            </div>
                        )}
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h2 className="font-bold text-white text-sm uppercase truncate">
                                    {community.name}
                                </h2>
                                <span className="text-[10px] text-zinc-500 font-mono">
                                    // PRIVATE_INBOX
                                </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-400">
                                <span className={`px-1.5 py-0.2 text-[9px] uppercase font-bold tracking-wider ${
                                    isOwner 
                                        ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30' 
                                        : isAdmin 
                                        ? 'bg-cyan-950/60 text-cyan-400 border border-cyan-500/30'
                                        : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                                }`}>
                                    {role.toUpperCase()}
                                </span>
                                <span className="text-zinc-600">•</span>
                                <span className="text-zinc-500 truncate">Member-only confidential enclave</span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-1.5 text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700 transition-colors ml-2"
                        aria-label="Close inbox"
                    >
                        <CloseIcon className="w-4 h-4" />
                    </button>
                </div>

                {/* Notice banner */}
                <div className="bg-zinc-950 px-4 py-2 border-b border-zinc-850 flex items-center justify-between text-[11px] text-zinc-400">
                    <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 bg-emerald-400 inline-block animate-pulse"></span>
                        <span>ISOLATED CHANNEL • ENCRYPTED CONVERSATION HISTORY</span>
                    </span>
                    <span className="text-zinc-600 uppercase text-[10px]">
                        ID: {communityId.slice(0, 12)}
                    </span>
                </div>

                {/* Messages body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0a0a0c]">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="w-6 h-6 border-2 border-zinc-700 border-t-white animate-spin"></div>
                        </div>
                    ) : messages.length > 0 ? (
                        messages.map((msg) => {
                            const isMe = msg.authorId === currentUser?.uid;
                            return (
                                <div
                                    key={msg.id}
                                    className={`flex gap-2.5 max-w-[85%] ${isMe ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                                >
                                    {msg.authorAvatar ? (
                                        <img
                                            src={msg.authorAvatar}
                                            alt={msg.authorName}
                                            onError={handleImageError}
                                            className="w-7 h-7 object-cover border border-zinc-800 flex-shrink-0"
                                        />
                                    ) : (
                                        <div className="w-7 h-7 bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[10px] text-zinc-400 flex-shrink-0 font-bold">
                                            {msg.authorName.slice(0, 2).toUpperCase()}
                                        </div>
                                    )}

                                    <div className="space-y-1">
                                        <div className={`flex items-center gap-2 text-[10px] text-zinc-500 ${isMe ? 'justify-end' : ''}`}>
                                            <span className="font-bold text-zinc-300">
                                                {isMe ? 'YOU' : msg.authorName}
                                            </span>
                                            <span>
                                                {msg.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <div className={`p-3 text-xs leading-relaxed border ${
                                            isMe 
                                                ? 'bg-zinc-900 border-zinc-700 text-white' 
                                                : 'bg-[#0f0f12] border-zinc-800 text-zinc-300'
                                        }`}>
                                            {msg.content}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                            <div className="w-12 h-12 bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
                                <UsersIcon className="w-6 h-6" />
                            </div>
                            <div className="space-y-1 max-w-sm">
                                <p className="text-xs font-bold text-white uppercase tracking-wider">
                                    // CHANNEL_ONLINE
                                </p>
                                <p className="text-[11px] text-zinc-500 leading-relaxed">
                                    Welcome to the private member enclave for <strong className="text-zinc-300">{community.name}</strong>. Only verified members can view and transmit communications here.
                                </p>
                                <p className="text-[10px] text-zinc-600 pt-1">
                                    No messages transmitted yet. Dispatch the first private communication below.
                                </p>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input composer */}
                <form onSubmit={handleSendMessage} className="p-3 border-t border-zinc-800 bg-[#09090b] flex items-center gap-2">
                    <input
                        type="text"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder={`Transmit private message in ${community.name}...`}
                        className="flex-1 bg-black border border-zinc-800 p-2.5 font-mono text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
                    />
                    <button
                        type="submit"
                        disabled={!text.trim() || sending}
                        className="px-4 py-2.5 font-mono text-xs uppercase font-bold bg-white text-black hover:bg-zinc-200 disabled:opacity-50 disabled:hover:bg-white transition-colors border border-white flex items-center gap-1.5 flex-shrink-0"
                    >
                        {sending ? (
                            <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent animate-spin inline-block"></span>
                        ) : (
                            <SendIcon className="w-3.5 h-3.5" />
                        )}
                        <span className="hidden sm:inline">SEND</span>
                    </button>
                </form>
            </div>
        </div>
    );
};
