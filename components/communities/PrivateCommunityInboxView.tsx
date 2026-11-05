import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
    subscribeCommunityPrivateMessages, 
    sendCommunityPrivateMessage,
    CommunityPrivateMessage,
    JoinedCommunityRecord 
} from '../../services/communityService';
import { 
    ArrowLeftIcon,
    SendIcon, 
    ShieldCheckIcon, 
    UsersIcon, 
    LockClosedIcon,
    ChatBubbleBottomCenterTextIcon,
    ClockIcon,
    AlertTriangleIcon,
    CheckIcon,
    GlobeAltIcon,
    ArrowUpRightIcon
} from '../ui/Icons';
import { handleImageError } from '../utils/imageUtils';

interface PrivateCommunityInboxViewProps {
    communityRecord: JoinedCommunityRecord;
    onBack: () => void;
    onOpenCommunityProfile?: (communityId: string) => void;
}

const formatMessageTime = (date: Date): string => {
    try {
        return new Intl.DateTimeFormat('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        }).format(date);
    } catch {
        return '';
    }
};

const formatMessageDateGroup = (date: Date): string => {
    try {
        const now = new Date();
        const isToday = now.toDateString() === date.toDateString();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const isYesterday = yesterday.toDateString() === date.toDateString();

        if (isToday) return '// TODAY';
        if (isYesterday) return '// YESTERDAY';

        return `// ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}`;
    } catch {
        return '// TRANSMISSION LOG';
    }
};

export const PrivateCommunityInboxView: React.FC<PrivateCommunityInboxViewProps> = ({
    communityRecord,
    onBack,
    onOpenCommunityProfile,
}) => {
    const { currentUser, userProfile } = useAuth();
    const [messages, setMessages] = useState<CommunityPrivateMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const [sendError, setSendError] = useState<string | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const { community, role, isOwner, isAdmin } = communityRecord;
    const communityId = communityRecord.id || community.id;

    // 1. Subscribe to isolated real-time private messages for this specific community
    useEffect(() => {
        if (!communityId) {
            setMessages([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setSendError(null);

        const unsubscribe = subscribeCommunityPrivateMessages(
            communityId,
            (list) => {
                setMessages(list);
                setLoading(false);
            },
            (err) => {
                console.warn('[COMMUNITY_INBOX_ERR]', err);
                setSendError('Unable to synchronize real-time transmissions. Reconnecting...');
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [communityId]);

    // 2. Auto-scroll to bottom of conversation on message updates
    const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
        messagesEndRef.current?.scrollIntoView({ behavior });
    };

    useEffect(() => {
        scrollToBottom('smooth');
    }, [messages.length]);

    // Initial scroll on load
    useEffect(() => {
        if (!loading) {
            scrollToBottom('auto');
        }
    }, [loading]);

    // 3. Message sending handler with draft preservation and error handling
    const handleSendMessage = async () => {
        if (!text.trim() || !currentUser?.uid || sending) return;

        const payloadText = text.trim();
        setSending(true);
        setSendError(null);

        try {
            const res = await sendCommunityPrivateMessage(
                communityId,
                {
                    uid: currentUser.uid,
                    displayName: userProfile?.displayName || currentUser.displayName || 'Member',
                    photoURL: userProfile?.photoURL || currentUser.photoURL || null,
                },
                payloadText
            );

            if (res.success) {
                setText('');
                if (textareaRef.current) {
                    textareaRef.current.style.height = 'auto';
                }
            } else {
                setSendError(res.error || 'Failed to dispatch transmission. Draft preserved.');
            }
        } catch (err: any) {
            console.error('[SEND_MSG_ERR]', err);
            setSendError(err?.message || 'Transmission failed. Your draft has been preserved.');
        } finally {
            setSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setText(e.target.value);
        if (sendError) setSendError(null);

        // Auto-resize textarea height
        const el = e.target;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    };

    // 4. Group messages chronologically by date
    const groupedMessages = useMemo(() => {
        const groups: { dateKey: string; dateLabel: string; items: CommunityPrivateMessage[] }[] = [];

        for (const msg of messages) {
            const dateObj = msg.createdAt instanceof Date ? msg.createdAt : new Date(msg.createdAt);
            const dateKey = dateObj.toDateString();
            let group = groups.find((g) => g.dateKey === dateKey);
            if (!group) {
                group = {
                    dateKey,
                    dateLabel: formatMessageDateGroup(dateObj),
                    items: [],
                };
                groups.push(group);
            }
            group.items.push(msg);
        }
        return groups;
    }, [messages]);

    return (
        <div className="font-mono flex flex-col space-y-4 pb-8">
            {/* Top Navigation & Breadcrumb */}
            <div className="flex items-center justify-between gap-4">
                <button
                    type="button"
                    onClick={onBack}
                    className="flex items-center gap-2 p-2 bg-[#0c0c0e] border border-zinc-800 hover:border-zinc-600 text-zinc-300 hover:text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer group"
                >
                    <ArrowLeftIcon className="w-4 h-4 text-zinc-400 group-hover:text-white group-hover:-translate-x-0.5 transition-transform" />
                    <span>// BACK TO MY COLLECTIVE FEED</span>
                </button>

                <div className="flex items-center gap-2 text-[10px] text-zinc-500 uppercase tracking-widest hidden sm:flex">
                    <span className="w-2 h-2 bg-emerald-500 inline-block animate-pulse"></span>
                    <span>PRIVATE ENCLAVE · END-TO-END VERIFIED</span>
                </div>
            </div>

            {/* Conversation Header Card */}
            <div className="p-4 sm:p-5 bg-[#0c0c0e] border border-zinc-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                        {/* Community Avatar */}
                        <div className="w-11 h-11 shrink-0 bg-black border border-zinc-700 overflow-hidden flex items-center justify-center">
                            {community.avatarUrl ? (
                                <img
                                    src={community.avatarUrl}
                                    alt={community.name}
                                    onError={handleImageError}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <UsersIcon className="w-5 h-5 text-zinc-500" />
                            )}
                        </div>

                        {/* Title & Metadata */}
                        <div className="min-w-0">
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <h1 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider truncate">
                                    {community.name}
                                </h1>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase bg-cyan-950/40 border border-cyan-500/40 text-cyan-300">
                                    <LockClosedIcon className="w-3 h-3" />
                                    <span>PRIVATE INBOX</span>
                                </span>
                            </div>

                            <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-400 flex-wrap">
                                {community.category && (
                                    <>
                                        <span className="text-zinc-400 uppercase font-bold">{community.category}</span>
                                        <span className="text-zinc-600">•</span>
                                    </>
                                )}
                                <span className="flex items-center gap-1.5">
                                    <span className="text-zinc-500 uppercase">YOUR ROLE:</span>
                                    <span
                                        className={`px-1.5 py-0.2 text-[10px] font-bold uppercase tracking-wider ${
                                            isOwner
                                                ? 'text-amber-400 bg-amber-950/40 border border-amber-500/30'
                                                : isAdmin
                                                ? 'text-indigo-400 bg-indigo-950/40 border border-indigo-500/30'
                                                : 'text-emerald-400 bg-emerald-950/40 border border-emerald-500/30'
                                        }`}
                                    >
                                        {role.toUpperCase()}
                                    </span>
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Header Action: View Profile */}
                    {onOpenCommunityProfile && (
                        <button
                            type="button"
                            onClick={() => onOpenCommunityProfile(community.id)}
                            className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 bg-black border border-zinc-800 hover:border-zinc-600 text-zinc-300 hover:text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                        >
                            <span>COLLECTIVE PROFILE</span>
                            <ArrowUpRightIcon className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                {/* Subtitle / Status strip */}
                <div className="pt-2 border-t border-zinc-850 flex items-center justify-between text-[10px] text-zinc-500 uppercase flex-wrap gap-2">
                    <span className="flex items-center gap-1.5">
                        <ShieldCheckIcon className="w-3.5 h-3.5 text-emerald-400" />
                        <span>MEMBER-ONLY CHANNEL · CONVERSATIONS RESTRICTED TO VERIFIED COLLECTIVE MEMBERS</span>
                    </span>
                    <span className="text-zinc-600">
                        {messages.length} {messages.length === 1 ? 'TRANSMISSION' : 'TRANSMISSIONS'} LOGGED
                    </span>
                </div>
            </div>

            {/* Dedicated Conversation Workspace Container */}
            <div className="bg-[#0c0c0e] border border-zinc-800 flex flex-col h-[650px] max-h-[75vh] shadow-xl overflow-hidden">
                {/* Scrollable Message History Area */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-black/40">
                    {loading ? (
                        <div className="h-full flex flex-col items-center justify-center gap-3 text-zinc-500">
                            <div className="w-6 h-6 border-2 border-zinc-800 border-t-emerald-400 animate-spin"></div>
                            <span className="text-xs uppercase tracking-widest">// SYNCHRONIZING_ENCLAVE_TRANSMISSIONS...</span>
                        </div>
                    ) : messages.length === 0 ? (
                        /* Empty State */
                        <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                            <div className="w-12 h-12 bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
                                <ChatBubbleBottomCenterTextIcon className="w-6 h-6" />
                            </div>
                            <div className="space-y-1 max-w-md">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                                    // ZERO_COMMUNITY_TRANSMISSIONS_RECORDED
                                </h3>
                                <p className="text-xs text-zinc-500 leading-relaxed">
                                    This is the private member enclave for <strong className="text-zinc-300">{community.name}</strong>.
                                    Only verified active members have transmission clearance in this channel.
                                </p>
                            </div>
                            <p className="text-[11px] text-emerald-400/80 uppercase font-bold tracking-wider">
                                INITIATE THE FIRST DISCUSSION WITH YOUR FELLOW MEMBERS BELOW
                            </p>
                        </div>
                    ) : (
                        /* Chronological Messages Stream */
                        groupedMessages.map((group) => (
                            <div key={group.dateKey} className="space-y-4">
                                {/* Date Separator */}
                                <div className="flex items-center gap-3 py-1">
                                    <div className="flex-1 border-t border-zinc-850"></div>
                                    <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase bg-[#0c0c0e] px-2.5 py-0.5 border border-zinc-850">
                                        {group.dateLabel}
                                    </span>
                                    <div className="flex-1 border-t border-zinc-850"></div>
                                </div>

                                {/* Message Items in Group */}
                                <div className="space-y-3.5">
                                    {group.items.map((msg) => {
                                        const isCurrentUser = msg.authorId === currentUser?.uid;
                                        const timeStr = formatMessageTime(
                                            msg.createdAt instanceof Date ? msg.createdAt : new Date(msg.createdAt)
                                        );

                                        return (
                                            <div
                                                key={msg.id}
                                                className={`flex items-start gap-2.5 ${
                                                    isCurrentUser ? 'justify-end' : 'justify-start'
                                                }`}
                                            >
                                                {/* Author Avatar (for received messages) */}
                                                {!isCurrentUser && (
                                                    <div className="w-7 h-7 shrink-0 bg-zinc-900 border border-zinc-800 overflow-hidden flex items-center justify-center mt-0.5">
                                                        {msg.authorAvatar ? (
                                                            <img
                                                                src={msg.authorAvatar}
                                                                alt={msg.authorName}
                                                                onError={handleImageError}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        ) : (
                                                            <span className="text-[10px] font-bold text-zinc-400">
                                                                {msg.authorName.slice(0, 2).toUpperCase()}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Message Bubble Container */}
                                                <div
                                                    className={`max-w-[85%] sm:max-w-[72%] p-3.5 space-y-1.5 shadow-sm ${
                                                        isCurrentUser
                                                            ? 'bg-zinc-900 border border-emerald-500/40 text-zinc-100'
                                                            : 'bg-black/90 border border-zinc-800 text-zinc-200'
                                                    }`}
                                                >
                                                    {/* Message Header (Author & Time) */}
                                                    <div className="flex items-baseline justify-between gap-3 text-[10px]">
                                                        <span
                                                            className={`font-bold uppercase tracking-wider truncate ${
                                                                isCurrentUser ? 'text-emerald-400' : 'text-zinc-300'
                                                            }`}
                                                        >
                                                            {isCurrentUser ? `YOU (${role.toUpperCase()})` : msg.authorName}
                                                        </span>
                                                        <span className="text-zinc-500 shrink-0 flex items-center gap-1">
                                                            <ClockIcon className="w-2.5 h-2.5" />
                                                            <span>{timeStr}</span>
                                                        </span>
                                                    </div>

                                                    {/* Message Content */}
                                                    <div className="text-xs leading-relaxed break-words whitespace-pre-wrap font-sans">
                                                        {msg.content}
                                                    </div>
                                                </div>

                                                {/* Current User Avatar (for sent messages) */}
                                                {isCurrentUser && (
                                                    <div className="w-7 h-7 shrink-0 bg-emerald-950 border border-emerald-800 overflow-hidden flex items-center justify-center mt-0.5">
                                                        {currentUser?.photoURL || userProfile?.photoURL ? (
                                                            <img
                                                                src={(currentUser?.photoURL || userProfile?.photoURL) as string}
                                                                alt="You"
                                                                onError={handleImageError}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        ) : (
                                                            <span className="text-[10px] font-bold text-emerald-300">
                                                                {(userProfile?.displayName || currentUser?.displayName || 'ME')
                                                                    .slice(0, 2)
                                                                    .toUpperCase()}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Error Banner if transmission fails */}
                {sendError && (
                    <div className="px-4 py-2.5 bg-rose-950/60 border-t border-b border-rose-800 text-rose-300 text-xs flex items-center justify-between gap-2 shrink-0">
                        <div className="flex items-center gap-2">
                            <AlertTriangleIcon className="w-4 h-4 text-rose-400 shrink-0" />
                            <span>{sendError}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSendError(null)}
                            className="text-rose-400 hover:text-white text-[10px] uppercase font-bold"
                        >
                            DISMISS
                        </button>
                    </div>
                )}

                {/* Fixed Message Composer */}
                <div className="p-3 sm:p-4 bg-black/90 border-t border-zinc-850 shrink-0 space-y-2">
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleSendMessage();
                        }}
                        className="flex items-end gap-2.5"
                    >
                        {/* Multiline Textarea */}
                        <div className="flex-1 relative">
                            <textarea
                                ref={textareaRef}
                                value={text}
                                onChange={handleTextChange}
                                onKeyDown={handleKeyDown}
                                placeholder={`TRANSMIT PRIVATE ADVISORY TO ${community.name.toUpperCase()}...`}
                                rows={2}
                                disabled={sending}
                                className="w-full bg-zinc-950 border border-zinc-800 p-2.5 text-zinc-100 text-xs placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors resize-none overflow-y-auto leading-relaxed"
                            />
                        </div>

                        {/* Send Action Button */}
                        <button
                            type="submit"
                            disabled={!text.trim() || sending}
                            className={`h-[42px] px-4 sm:px-5 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
                                text.trim() && !sending
                                    ? 'bg-emerald-500 hover:bg-emerald-400 text-black active:translate-y-px shadow-sm'
                                    : 'bg-zinc-900 border border-zinc-800 text-zinc-500 cursor-not-allowed opacity-60'
                            }`}
                            title="Send transmission (Enter)"
                        >
                            {sending ? (
                                <div className="flex items-center gap-2">
                                    <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent animate-spin"></span>
                                    <span className="hidden sm:inline">TRANSMITTING...</span>
                                </div>
                            ) : (
                                <>
                                    <span>TRANSMIT</span>
                                    <SendIcon className="w-3.5 h-3.5" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Composer Helper Hints */}
                    <div className="flex items-center justify-between text-[10px] text-zinc-500 tracking-wider">
                        <span className="hidden sm:inline">
                            PRESS <strong className="text-zinc-400">[ENTER]</strong> TO TRANSMIT · <strong className="text-zinc-400">[SHIFT + ENTER]</strong> FOR NEW LINE
                        </span>
                        <span className="flex items-center gap-1.5 ml-auto text-zinc-500">
                            <LockClosedIcon className="w-2.5 h-2.5 text-emerald-400" />
                            <span>ISOLATED CHANNEL #{communityId.slice(0, 8)}</span>
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrivateCommunityInboxView;
