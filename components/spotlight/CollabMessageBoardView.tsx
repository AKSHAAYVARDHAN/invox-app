import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
    subscribeToUserConversations,
    subscribeToConversationMessages,
    sendCollabMessage,
    markConversationAsRead,
    getConversationUnreadCount,
    type CollabConversation,
    type CollabChatMessage,
} from '../../services/collabMessageService';
import { handleImageError } from '../utils/imageUtils';

interface CollabMessageBoardViewProps {
    view: 'inbox' | 'teams';
    onBack: () => void;
    initialConversationId?: string | null;
}

export const CollabMessageBoardView: React.FC<CollabMessageBoardViewProps> = ({
    view,
    onBack,
    initialConversationId,
}) => {
    const { currentUser, userProfile } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();

    const [conversations, setConversations] = useState<CollabConversation[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    const urlConvId = searchParams.get('conversationId') || initialConversationId || null;
    const [selectedConvId, setSelectedConvId] = useState<string | null>(urlConvId);

    // Messages state for selected conversation
    const [messages, setMessages] = useState<CollabChatMessage[]>([]);
    const [messagesLoading, setMessagesLoading] = useState<boolean>(false);
    const [inputText, setInputText] = useState<string>('');
    const [isSending, setIsSending] = useState<boolean>(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Subscribe to all conversations the user is a participant of
    useEffect(() => {
        if (!currentUser?.uid) {
            setConversations([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const unsub = subscribeToUserConversations(
            currentUser.uid,
            (list) => {
                setConversations(list);
                setLoading(false);
            },
            (err) => {
                console.error('[COLLAB_CONVERSATIONS_ERROR]', err);
                setConversations([]);
                setLoading(false);
            }
        );

        return () => {
            unsub();
        };
    }, [currentUser?.uid]);

    // Data partitioning: Inbox (direct collab applications) vs Teams
    const inboxConversations = conversations.filter(c => !c.isTeam && c.type !== 'team');
    const teamConversations = conversations.filter(c => c.isTeam || c.type === 'team');
    const activeList = view === 'inbox' ? inboxConversations : teamConversations;
    const hasData = activeList.length > 0;

    // Synchronize selected conversation with URL parameter or default
    useEffect(() => {
        if (urlConvId && activeList.some(c => c.id === urlConvId)) {
            setSelectedConvId(urlConvId);
        } else if (activeList.length > 0) {
            if (!selectedConvId || !activeList.some(c => c.id === selectedConvId)) {
                // Auto-select first conversation on desktop if none specified
                if (window.innerWidth >= 768) {
                    setSelectedConvId(activeList[0].id);
                } else {
                    setSelectedConvId(null);
                }
            }
        } else {
            setSelectedConvId(null);
        }
    }, [urlConvId, activeList, view]);

    // Find the currently selected conversation object
    const selectedConversation = activeList.find(c => c.id === selectedConvId) || null;

    // Automatically mark the currently viewed conversation as read
    useEffect(() => {
        if (!selectedConvId || !currentUser?.uid) return;

        const currentConv = activeList.find(c => c.id === selectedConvId);
        if (currentConv) {
            const unread = getConversationUnreadCount(currentConv, currentUser.uid);
            if (unread > 0) {
                markConversationAsRead(selectedConvId, currentUser.uid);
            }
        }
    }, [selectedConvId, activeList, currentUser?.uid]);

    // Subscribe to messages in the active conversation
    useEffect(() => {
        if (!selectedConvId) {
            setMessages([]);
            setMessagesLoading(false);
            return;
        }

        setMessagesLoading(true);
        const unsubMessages = subscribeToConversationMessages(
            selectedConvId,
            (newMessages) => {
                setMessages(newMessages);
                setMessagesLoading(false);
            },
            (err) => {
                console.error('[SUBSCRIBE_CONV_MESSAGES_ERROR]', err);
                setMessages([]);
                setMessagesLoading(false);
            }
        );

        return () => {
            unsubMessages();
        };
    }, [selectedConvId]);

    // Auto-scroll to bottom of message thread
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    // Handle sending a message
    const handleSendMessage = async () => {
        if (!inputText.trim() || !selectedConversation || !currentUser?.uid || isSending) {
            return;
        }

        const textToSend = inputText.trim();
        setInputText('');
        setIsSending(true);

        try {
            const otherParticipantId = selectedConversation.participants.find(p => p !== currentUser.uid);
            const senderName = userProfile?.displayName || currentUser.displayName || 'You';
            const senderAvatar = userProfile?.photoURL || currentUser.photoURL || null;

            await sendCollabMessage({
                conversationId: selectedConversation.id,
                senderId: currentUser.uid,
                senderName,
                senderAvatar,
                text: textToSend,
                recipientId: otherParticipantId,
            });
        } catch (err) {
            console.error('[SEND_COLLAB_MESSAGE_ERROR]', err);
            setInputText(textToSend);
        } finally {
            setIsSending(false);
            textareaRef.current?.focus();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    // Helper to format timestamps compactly
    const formatTimestamp = (val: any) => {
        if (!val) return '';
        try {
            const d = typeof val?.toDate === 'function' ? val.toDate() : new Date(val);
            if (isNaN(d.getTime())) return '';
            const now = new Date();
            const diffMs = now.getTime() - d.getTime();
            if (diffMs >= 0 && diffMs < 60000) {
                return 'just now';
            }
            const isToday = d.toDateString() === now.toDateString();
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            const isYesterday = d.toDateString() === yesterday.toDateString();

            if (isToday) {
                return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
            if (isYesterday) {
                return 'Yesterday';
            }
            return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        } catch {
            return '';
        }
    };

    // Helper to determine the other party's profile info
    const getOtherParticipant = (convo: CollabConversation) => {
        if (convo.isTeam || convo.type === 'team') {
            return {
                displayName: convo.collabTitle || 'Team Conversation',
                username: '',
                photoURL: null,
                isApplicant: false,
                isTeam: true,
            };
        }
        if (currentUser?.uid && convo.ownerId === currentUser.uid) {
            return {
                displayName: convo.applicantDetails?.displayName || 'Applicant',
                username: convo.applicantDetails?.username || '',
                photoURL: convo.applicantDetails?.photoURL || null,
                isApplicant: true,
                isTeam: false,
            };
        }
        return {
            displayName: convo.ownerDetails?.displayName || 'Project Owner',
            username: convo.ownerDetails?.username || '',
            photoURL: convo.ownerDetails?.photoURL || null,
            isApplicant: false,
            isTeam: false,
        };
    };

    // Return to the application in Incoming Applications or My Applications
    const handleReturnToApplication = () => {
        if (!selectedConversation?.applicationId) return;
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('tab', 'Collabs');
            if (currentUser?.uid === selectedConversation.ownerId) {
                next.set('collabView', 'incoming');
            } else {
                next.set('collabView', 'my_applications');
            }
            next.delete('conversationId');
            return next;
        });
    };

    return (
        <div className="space-y-4">
            {/* View Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 font-mono">
                <div>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest block font-bold">// MESSAGE BOARD</span>
                    <h2 className="text-sm sm:text-base font-bold text-white uppercase tracking-wider">
                        {view === 'inbox' ? 'INBOX' : 'TEAMS'}
                    </h2>
                </div>

                {onBack && (
                    <button
                        type="button"
                        onClick={onBack}
                        className="px-2.5 py-1 bg-transparent hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer font-mono"
                        title="Back to Collabs"
                    >
                        <span>←</span>
                        <span>// BACK TO COLLABS</span>
                    </button>
                )}
            </div>

            {/* Content Display */}
            {loading ? (
                <div className="p-12 text-center border border-zinc-800 bg-[#0c0c0e]">
                    <div className="w-5 h-5 border-2 border-zinc-600 border-t-white rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-xs text-zinc-500 uppercase tracking-wider font-mono">// SYNCHRONIZING...</p>
                </div>
            ) : !hasData ? (
                /* Empty State Display */
                <div className="border border-zinc-800 bg-[#0c0c0e] p-12 sm:p-16 text-center font-mono my-4">
                    <div className="max-w-md mx-auto space-y-1.5">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">
                            {view === 'inbox' ? '// NO CONVERSATIONS' : '// NO TEAM CONVERSATIONS'}
                        </span>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                            {view === 'inbox'
                                ? 'No conversations yet.'
                                : 'You don\'t have any team conversations yet.'}
                        </p>
                    </div>
                </div>
            ) : (
                /* Two-Column Messaging Workspace for INBOX & TEAMS */
                <div className="border border-zinc-800 bg-[#0c0c0e] font-mono grid grid-cols-1 md:grid-cols-[30%_70%] h-[600px] sm:h-[640px] overflow-hidden">
                    {/* LEFT: Conversation List (~28-32%) */}
                    <aside
                        className={`border-b md:border-b-0 md:border-r border-zinc-800 flex flex-col h-full overflow-hidden ${
                            selectedConvId ? 'hidden md:flex' : 'flex'
                        }`}
                    >
                        {/* Section Label Header */}
                        <div className="px-3.5 py-3 border-b border-zinc-800 flex items-center justify-between bg-black/40 flex-shrink-0">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                                {view === 'inbox' ? '// CONVERSATIONS' : '// TEAM_CHANNELS'}
                            </span>
                            {activeList.length > 0 && (
                                <span className="text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-400 px-1.5 py-0.2 font-mono">
                                    {activeList.length}
                                </span>
                            )}
                        </div>

                        {/* Clean Compact Messaging Rows */}
                        <div className="flex-1 overflow-y-auto divide-y divide-zinc-850/60">
                            {activeList.map((convo) => {
                                const other = getOtherParticipant(convo);
                                const isSelected = convo.id === selectedConvId;
                                const unreadCount = isSelected ? 0 : getConversationUnreadCount(convo, currentUser?.uid);
                                const hasUnread = unreadCount > 0;
                                const timestampStr = formatTimestamp(convo.lastMessageTimestamp || convo.updatedAt || convo.createdAt);

                                return (
                                    <button
                                        key={convo.id}
                                        type="button"
                                        onClick={() => {
                                            setSelectedConvId(convo.id);
                                            if (currentUser?.uid && hasUnread) {
                                                markConversationAsRead(convo.id, currentUser.uid);
                                            }
                                            setSearchParams(prev => {
                                                const next = new URLSearchParams(prev);
                                                next.set('tab', 'Collabs');
                                                next.set('collabView', view);
                                                next.set('conversationId', convo.id);
                                                return next;
                                            });
                                        }}
                                        className={`w-full px-3 py-2.5 text-left transition-colors flex items-start gap-2.5 border-l-2 cursor-pointer ${
                                            isSelected
                                                ? 'bg-zinc-900 border-emerald-400 text-white'
                                                : hasUnread
                                                ? 'bg-zinc-900/40 border-emerald-500/80 text-zinc-200 hover:bg-zinc-900/60'
                                                : 'bg-transparent border-transparent text-zinc-400 hover:bg-zinc-900/40 hover:text-zinc-200'
                                        }`}
                                    >
                                        {/* Avatar (Sharp rectangular) */}
                                        <div className={`w-8 h-8 bg-zinc-900 border flex items-center justify-center flex-shrink-0 text-xs font-bold text-white overflow-hidden mt-0.5 ${
                                            hasUnread && !isSelected ? 'border-emerald-700/60' : 'border-zinc-750'
                                        }`}>
                                            {other.photoURL ? (
                                                <img
                                                    src={other.photoURL}
                                                    alt={other.displayName}
                                                    className="w-full h-full object-cover"
                                                    onError={handleImageError}
                                                />
                                            ) : other.isTeam ? (
                                                <span className="text-emerald-400 font-bold">//</span>
                                            ) : (
                                                <span>{other.displayName.charAt(0).toUpperCase()}</span>
                                            )}
                                        </div>

                                        {/* Row Content */}
                                        <div className="min-w-0 flex-1 space-y-0.5">
                                            <div className="flex items-center justify-between gap-1">
                                                <span className={`text-xs truncate ${
                                                    isSelected || hasUnread ? 'font-bold text-white' : 'font-semibold text-zinc-300'
                                                }`}>
                                                    {other.displayName}
                                                </span>
                                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                                    {timestampStr && (
                                                        <span className={`text-[10px] font-mono ${
                                                            hasUnread ? 'text-emerald-400 font-semibold' : 'text-zinc-500'
                                                        }`}>
                                                            {timestampStr}
                                                        </span>
                                                    )}
                                                    {hasUnread && (
                                                        <span className="font-mono font-bold px-1.5 py-0.2 bg-emerald-950/80 text-emerald-400 border border-emerald-700 text-[10px] leading-tight">
                                                            [{unreadCount}]
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Project name / Team info */}
                                            <p className={`text-[11px] truncate ${
                                                hasUnread ? 'text-zinc-200 font-medium' : 'text-zinc-500'
                                            }`}>
                                                {other.isTeam
                                                    ? (convo.collabHook || `${convo.participants?.length || 0} members`)
                                                    : (convo.collabHook || convo.collabTitle)}
                                            </p>

                                            {/* Short latest-message preview */}
                                            <p className={`text-[11px] truncate ${
                                                hasUnread
                                                    ? 'text-zinc-200 font-medium'
                                                    : convo.lastMessage
                                                    ? (isSelected ? 'text-zinc-300' : 'text-zinc-400')
                                                    : 'text-zinc-600 italic'
                                            }`}>
                                                {convo.lastMessage || 'No messages yet'}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </aside>

                    {/* RIGHT: Active Conversation (~68-72%) */}
                    <main
                        className={`flex flex-col h-full overflow-hidden bg-[#0a0a0c] ${
                            !selectedConvId ? 'hidden md:flex' : 'flex'
                        }`}
                    >
                        {selectedConversation ? (
                            <>
                                {/* Active Conversation Header */}
                                {(() => {
                                    const other = getOtherParticipant(selectedConversation);
                                    return (
                                        <div className="px-4 py-3 border-b border-zinc-800 bg-[#0c0c0e] flex items-center justify-between gap-3 flex-shrink-0">
                                            <div className="flex items-center gap-3 min-w-0">
                                                {/* Mobile back button to conversation list */}
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedConvId(null)}
                                                    className="md:hidden text-xs text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer pr-1 flex-shrink-0 font-mono"
                                                    title="Back to conversations"
                                                >
                                                    <span>←</span>
                                                </button>

                                                {/* Avatar */}
                                                <div className="w-9 h-9 bg-zinc-900 border border-zinc-750 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white overflow-hidden">
                                                    {other.photoURL ? (
                                                        <img
                                                            src={other.photoURL}
                                                            alt={other.displayName}
                                                            className="w-full h-full object-cover"
                                                            onError={handleImageError}
                                                        />
                                                    ) : other.isTeam ? (
                                                        <span className="text-emerald-400 font-bold">//</span>
                                                    ) : (
                                                        <span>{other.displayName.charAt(0).toUpperCase()}</span>
                                                    )}
                                                </div>

                                                {/* Names + Compact Project/Role Metadata */}
                                                <div className="min-w-0 space-y-0.5">
                                                    <div className="flex items-baseline gap-2 truncate">
                                                        <span className="text-xs sm:text-sm font-bold text-white truncate">
                                                            {other.displayName}
                                                        </span>
                                                        {other.username && (
                                                            <span className="text-[11px] text-zinc-500 truncate">
                                                                @{other.username}
                                                            </span>
                                                        )}
                                                        {other.isTeam && (
                                                            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-1.5 py-0.2">
                                                                TEAM
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Compact metadata */}
                                                    <div className="flex items-center gap-2 text-[11px] text-zinc-400 truncate">
                                                        {other.isTeam ? (
                                                            <span className="truncate">
                                                                <span className="text-zinc-500 font-bold uppercase text-[10px] mr-1">MEMBERS:</span>
                                                                <span className="text-zinc-300 font-mono">[{selectedConversation.participants?.length || 0}]</span>
                                                                {selectedConversation.collabHook && (
                                                                    <span className="text-zinc-400 ml-2">"{selectedConversation.collabHook}"</span>
                                                                )}
                                                            </span>
                                                        ) : (
                                                            <>
                                                                <span className="truncate max-w-[200px] sm:max-w-[320px]">
                                                                    <span className="text-zinc-500 font-bold uppercase text-[10px] mr-1">PROJECT:</span>
                                                                    <span className="text-zinc-300">"{selectedConversation.collabHook || selectedConversation.collabTitle}"</span>
                                                                </span>
                                                                {selectedConversation.roleTitle && (
                                                                    <>
                                                                        <span className="text-zinc-700">|</span>
                                                                        <span className="flex items-center gap-1 flex-shrink-0">
                                                                            <span className="text-zinc-500 font-bold uppercase text-[10px]">ROLE:</span>
                                                                            <span className="text-zinc-300 font-bold">[{selectedConversation.roleTitle}]</span>
                                                                        </span>
                                                                    </>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Action on the right */}
                                            {selectedConversation.applicationId && (
                                                <button
                                                    type="button"
                                                    onClick={handleReturnToApplication}
                                                    className="px-2.5 py-1.5 bg-transparent hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white text-[11px] uppercase tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer flex-shrink-0 font-mono"
                                                    title="View original application"
                                                >
                                                    <span>// VIEW APPLICATION</span>
                                                    <span>↗</span>
                                                </button>
                                            )}
                                        </div>
                                    );
                                })()}

                                {/* Message Thread (Occupies majority of vertical space) */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                                    {messagesLoading ? (
                                        <div className="py-12 text-center">
                                            <div className="w-5 h-5 border-2 border-zinc-600 border-t-white rounded-full animate-spin mx-auto mb-2" />
                                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">
                                                // LOADING MESSAGES...
                                            </p>
                                        </div>
                                    ) : messages.length === 0 ? (
                                        <div className="h-full flex items-center justify-center p-8 text-center">
                                            <div className="space-y-1">
                                                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest block">
                                                    // NO MESSAGES YET
                                                </span>
                                                <p className="text-xs text-zinc-400">
                                                    Start the conversation below.
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        messages.map((msg) => {
                                            const isMe = msg.senderId === currentUser?.uid;
                                            const timeStr = formatTimestamp(msg.createdAt);

                                            return (
                                                <div
                                                    key={msg.id}
                                                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                                                >
                                                    {!isMe && msg.senderName && (
                                                        <span className="text-[10px] text-zinc-400 mb-0.5 px-1 font-semibold font-mono">
                                                            {msg.senderName}
                                                        </span>
                                                    )}
                                                    <div
                                                        className={`max-w-[85%] sm:max-w-[70%] px-3 py-2 text-xs border ${
                                                            isMe
                                                                ? 'bg-zinc-900 border-zinc-750 text-zinc-100'
                                                                : 'bg-[#131316] border-zinc-800 text-zinc-200'
                                                        }`}
                                                    >
                                                        <p className="whitespace-pre-wrap break-words leading-relaxed">
                                                            {msg.text}
                                                        </p>
                                                        {timeStr && (
                                                            <div className={`mt-1 text-[10px] ${
                                                                isMe ? 'text-zinc-500 text-right' : 'text-zinc-600 text-left'
                                                            }`}>
                                                                {timeStr}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Message Composer (Permanently anchored to bottom) */}
                                <div className="p-3 border-t border-zinc-800 bg-[#0c0c0e] flex-shrink-0">
                                    <form
                                        onSubmit={(e) => {
                                            e.preventDefault();
                                            handleSendMessage();
                                        }}
                                        className="flex items-center gap-2"
                                    >
                                        <textarea
                                            ref={textareaRef}
                                            rows={1}
                                            value={inputText}
                                            onChange={(e) => setInputText(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            placeholder="Type a message..."
                                            disabled={isSending}
                                            className="flex-1 bg-black/70 border border-zinc-800 focus:border-zinc-600 text-xs text-white px-3 py-2 resize-none focus:outline-none placeholder:text-zinc-600 leading-relaxed font-mono disabled:opacity-50 h-[38px]"
                                        />

                                        <button
                                            type="submit"
                                            disabled={!inputText.trim() || isSending}
                                            className="px-4 h-[38px] bg-white text-black hover:bg-zinc-200 border border-white text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex-shrink-0 flex items-center justify-center font-mono"
                                            title="Send message"
                                        >
                                            {isSending ? '// SENDING...' : '// SEND'}
                                        </button>
                                    </form>
                                </div>
                            </>
                        ) : (
                            /* When a conversation is not selected */
                            <div className="h-full flex items-center justify-center p-8 text-center">
                                <div className="space-y-1">
                                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest block">
                                        // SELECT A CONVERSATION
                                    </span>
                                    <p className="text-xs text-zinc-400">
                                        Select a conversation to start messaging.
                                    </p>
                                </div>
                            </div>
                        )}
                    </main>
                </div>
            )}
        </div>
    );
};
