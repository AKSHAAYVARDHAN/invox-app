import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
    subscribeToUserConversations,
    subscribeToConversationMessages,
    sendCollabMessage,
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
    const navigate = useNavigate();

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
        if (urlConvId) {
            setSelectedConvId(urlConvId);
        } else if (view === 'inbox' && inboxConversations.length > 0 && !selectedConvId) {
            // Auto-select first conversation on desktop if none specified
            if (window.innerWidth >= 768) {
                setSelectedConvId(inboxConversations[0].id);
            }
        }
    }, [urlConvId, inboxConversations, view, selectedConvId]);

    // Find the currently selected conversation object
    const selectedConversation = inboxConversations.find(c => c.id === selectedConvId) || null;

    // Subscribe to messages in the active conversation
    useEffect(() => {
        if (!selectedConvId || view !== 'inbox') {
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
    }, [selectedConvId, view]);

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
            // Determine other participant
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
            // Restore text if sending failed
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

    // Helper to format timestamps
    const formatTimestamp = (val: any) => {
        if (!val) return '';
        try {
            const d = typeof val?.toDate === 'function' ? val.toDate() : new Date(val);
            if (isNaN(d.getTime())) return '';
            const now = new Date();
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
        if (currentUser?.uid && convo.ownerId === currentUser.uid) {
            return {
                displayName: convo.applicantDetails?.displayName || 'Applicant',
                username: convo.applicantDetails?.username || '',
                photoURL: convo.applicantDetails?.photoURL || null,
                headline: convo.applicantDetails?.headline || '',
                isApplicant: true,
            };
        }
        return {
            displayName: convo.ownerDetails?.displayName || 'Project Owner',
            username: convo.ownerDetails?.username || '',
            photoURL: convo.ownerDetails?.photoURL || null,
            headline: '',
            isApplicant: false,
        };
    };

    // Return to the application in Incoming Applications or My Applications
    const handleReturnToApplication = () => {
        if (!selectedConversation?.applicationId) return;
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('tab', 'Collabs');
            // If owner, return to incoming applications; if applicant, return to my_applications
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
                        className="px-2.5 py-1 bg-transparent hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer"
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
                    <div className="w-6 h-6 border-2 border-zinc-600 border-t-white rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-xs text-zinc-500 uppercase tracking-wider font-mono">// SYNCHRONIZING...</p>
                </div>
            ) : !hasData ? (
                /* Empty State Display (Exact specification) */
                <div className="border border-zinc-800 bg-[#0c0c0e] p-12 sm:p-16 text-center font-mono my-4">
                    <div className="max-w-md mx-auto space-y-2">
                        <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest block">
                            {view === 'inbox' ? '// INBOX EMPTY' : '// NO TEAM CONVERSATIONS'}
                        </span>
                        <h3 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider">
                            {view === 'inbox' ? 'INBOX IS EMPTY' : 'NO TEAM CONVERSATIONS YET'}
                        </h3>
                        <p className="text-xs text-zinc-400 leading-relaxed pt-1">
                            {view === 'inbox'
                                ? "You don't have any messages or conversations yet."
                                : "You don't have any team conversations yet."}
                        </p>
                    </div>
                </div>
            ) : view === 'teams' ? (
                /* Teams View Display (Reserved for future teams handling) */
                <div className="space-y-3 font-mono text-xs">
                    {teamConversations.map((convo) => (
                        <div
                            key={convo.id}
                            className="p-4 bg-[#0c0c0e] border border-zinc-800 flex items-center justify-between"
                        >
                            <div className="space-y-1">
                                <p className="font-bold text-white uppercase">
                                    {convo.collabTitle || 'Team Conversation'}
                                </p>
                                <p className="text-zinc-400 text-[11px]">
                                    {convo.lastMessage || 'No messages yet'}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                /* Two-Panel Messaging Layout for INBOX */
                <div className="border border-zinc-800 bg-[#0c0c0e] font-mono grid grid-cols-1 md:grid-cols-12 min-h-[620px] max-h-[760px] shadow-sm">
                    {/* LEFT PANEL: Conversation List / Inbox */}
                    <aside
                        className={`md:col-span-4 lg:col-span-4 border-r border-zinc-800 flex flex-col h-[620px] md:h-auto ${
                            selectedConvId && 'hidden md:flex'
                        }`}
                    >
                        {/* Conversations Header */}
                        <div className="p-3.5 border-b border-zinc-800 flex items-center justify-between bg-black/40 flex-shrink-0">
                            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                                // CONVERSATIONS
                            </span>
                            <span className="text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-400 px-1.5 py-0.5 font-bold">
                                {inboxConversations.length}
                            </span>
                        </div>

                        {/* Conversation Items List */}
                        <div className="flex-1 overflow-y-auto divide-y divide-zinc-850">
                            {inboxConversations.map((convo) => {
                                const other = getOtherParticipant(convo);
                                const isSelected = convo.id === selectedConvId;
                                const timestampStr = formatTimestamp(convo.lastMessageTimestamp || convo.updatedAt || convo.createdAt);

                                return (
                                    <button
                                        key={convo.id}
                                        type="button"
                                        onClick={() => {
                                            setSelectedConvId(convo.id);
                                            setSearchParams(prev => {
                                                const next = new URLSearchParams(prev);
                                                next.set('tab', 'Collabs');
                                                next.set('collabView', 'inbox');
                                                next.set('conversationId', convo.id);
                                                return next;
                                            });
                                        }}
                                        className={`w-full p-3.5 text-left transition-colors flex items-start gap-3 cursor-pointer ${
                                            isSelected
                                                ? 'bg-zinc-900/90 text-white border-l-2 border-l-emerald-400'
                                                : 'bg-transparent text-zinc-300 hover:bg-zinc-900/40'
                                        }`}
                                    >
                                        {/* Avatar */}
                                        <div className="w-9 h-9 bg-zinc-900 border border-zinc-700 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white overflow-hidden">
                                            {other.photoURL ? (
                                                <img
                                                    src={other.photoURL}
                                                    alt={other.displayName}
                                                    className="w-full h-full object-cover"
                                                    onError={handleImageError}
                                                />
                                            ) : (
                                                <span>{other.displayName.charAt(0).toUpperCase()}</span>
                                            )}
                                        </div>

                                        {/* Details */}
                                        <div className="min-w-0 flex-1 space-y-0.5">
                                            <div className="flex items-baseline justify-between gap-1">
                                                <span className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-zinc-200'}`}>
                                                    {other.displayName}
                                                </span>
                                                {timestampStr && (
                                                    <span className="text-[10px] text-zinc-500 flex-shrink-0">
                                                        {timestampStr}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Project Hook Title */}
                                            <p className="text-[11px] text-zinc-400 truncate italic">
                                                "{convo.collabHook || convo.collabTitle}"
                                            </p>

                                            {/* Latest Message Preview */}
                                            <p className={`text-[11px] truncate pt-0.5 ${
                                                convo.lastMessage ? 'text-zinc-400' : 'text-zinc-600 italic'
                                            }`}>
                                                {convo.lastMessage || 'Conversation started'}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </aside>

                    {/* RIGHT PANEL: Selected Conversation View */}
                    <main
                        className={`md:col-span-8 lg:col-span-8 flex flex-col h-[620px] md:h-auto bg-[#0a0a0c] ${
                            !selectedConvId && 'hidden md:flex'
                        }`}
                    >
                        {selectedConversation ? (
                            <>
                                {/* Conversation Header */}
                                {(() => {
                                    const other = getOtherParticipant(selectedConversation);
                                    return (
                                        <div className="p-4 border-b border-zinc-800 bg-[#0c0c0e] flex flex-col gap-3 flex-shrink-0">
                                            {/* Mobile Back to List Button */}
                                            <div className="flex md:hidden items-center justify-between pb-2 border-b border-zinc-850">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedConvId(null)}
                                                    className="text-xs text-zinc-400 hover:text-white flex items-center gap-1.5 cursor-pointer uppercase tracking-wider"
                                                >
                                                    <span>←</span>
                                                    <span>// ALL CONVERSATIONS</span>
                                                </button>
                                            </div>

                                            <div className="flex items-start justify-between gap-4 flex-wrap">
                                                {/* Left: Applicant / Owner Identity */}
                                                <div className="flex items-start gap-3 min-w-0">
                                                    <div className="w-10 h-10 bg-zinc-900 border border-zinc-700 flex items-center justify-center flex-shrink-0 text-sm font-bold text-white overflow-hidden">
                                                        {other.photoURL ? (
                                                            <img
                                                                src={other.photoURL}
                                                                alt={other.displayName}
                                                                className="w-full h-full object-cover"
                                                                onError={handleImageError}
                                                            />
                                                        ) : (
                                                            <span>{other.displayName.charAt(0).toUpperCase()}</span>
                                                        )}
                                                    </div>

                                                    <div className="space-y-0.5 min-w-0">
                                                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold block">
                                                            // CONVERSATION
                                                        </span>
                                                        <div className="flex items-baseline gap-2 flex-wrap">
                                                            <h3 className="text-sm font-bold text-white truncate">
                                                                {other.displayName}
                                                            </h3>
                                                            {other.username && (
                                                                <span className="text-xs text-zinc-500">
                                                                    @{other.username}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Right: Return to Application Action */}
                                                {selectedConversation.applicationId && (
                                                    <button
                                                        type="button"
                                                        onClick={handleReturnToApplication}
                                                        className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-750 hover:border-zinc-500 text-zinc-300 hover:text-white text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer"
                                                        title="Return to the application to accept or decline"
                                                    >
                                                        <span>// VIEW APPLICATION</span>
                                                        <span>↗</span>
                                                    </button>
                                                )}
                                            </div>

                                            {/* Context Row: PROJECT & ROLE */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-zinc-850 text-xs">
                                                <div>
                                                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">
                                                        PROJECT
                                                    </span>
                                                    <p className="text-zinc-200 font-bold truncate">
                                                        "{selectedConversation.collabHook || selectedConversation.collabTitle}"
                                                    </p>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">
                                                        ROLE
                                                    </span>
                                                    <span className="inline-block bg-zinc-900 border border-zinc-750 px-2 py-0.5 text-zinc-200 font-bold mt-0.5">
                                                        {selectedConversation.roleTitle}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Chronological Messages Stream */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                    {messagesLoading ? (
                                        <div className="py-12 text-center">
                                            <div className="w-5 h-5 border-2 border-zinc-600 border-t-white rounded-full animate-spin mx-auto mb-2" />
                                            <p className="text-[11px] text-zinc-500 uppercase tracking-wider font-mono">
                                                // LOADING MESSAGES...
                                            </p>
                                        </div>
                                    ) : messages.length === 0 ? (
                                        <div className="py-12 text-center text-zinc-500 space-y-1">
                                            <p className="text-xs uppercase tracking-wider font-bold">
                                                // CONVERSATION OPENED
                                            </p>
                                            <p className="text-xs text-zinc-600">
                                                Send a message below to begin communicating regarding this collaboration.
                                            </p>
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
                                                    <div
                                                        className={`p-3 text-xs max-w-[85%] sm:max-w-[75%] border transition-all ${
                                                            isMe
                                                                ? 'bg-zinc-900 border-zinc-750 text-zinc-100'
                                                                : 'bg-[#121214] border-zinc-800 text-zinc-200'
                                                        }`}
                                                    >
                                                        {/* Message Header */}
                                                        <div className="flex items-center gap-2 mb-1 text-[10px]">
                                                            <span className={isMe ? 'text-zinc-400 font-bold' : 'text-zinc-500 font-bold'}>
                                                                {isMe ? 'YOU' : (msg.senderName || 'USER')}
                                                            </span>
                                                            {timeStr && (
                                                                <span className="text-zinc-600 font-normal">
                                                                    · {timeStr}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Message Body */}
                                                        <div className="whitespace-pre-wrap break-words leading-relaxed">
                                                            {msg.text}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Fixed Message Composer */}
                                <div className="p-3.5 border-t border-zinc-800 bg-[#0c0c0e] flex-shrink-0">
                                    <form
                                        onSubmit={(e) => {
                                            e.preventDefault();
                                            handleSendMessage();
                                        }}
                                        className="flex items-end gap-2"
                                    >
                                        <textarea
                                            ref={textareaRef}
                                            rows={2}
                                            value={inputText}
                                            onChange={(e) => setInputText(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            placeholder="Type a message... (Press Enter to send)"
                                            disabled={isSending}
                                            className="flex-1 bg-black/60 border border-zinc-800 focus:border-zinc-500 text-xs text-white p-2.5 resize-none focus:outline-none placeholder:text-zinc-600 leading-relaxed font-mono disabled:opacity-50"
                                        />

                                        <button
                                            type="submit"
                                            disabled={!inputText.trim() || isSending}
                                            className="px-4 py-2.5 bg-white text-black hover:bg-zinc-200 border border-white text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex-shrink-0 h-[46px]"
                                            title="Send message"
                                        >
                                            {isSending ? '// SENDING...' : '// SEND'}
                                        </button>
                                    </form>
                                </div>
                            </>
                        ) : (
                            /* No conversation selected state */
                            <div className="h-full flex items-center justify-center p-8 text-center">
                                <div className="space-y-1.5 max-w-sm">
                                    <span className="text-[11px] text-zinc-500 font-bold uppercase tracking-widest block">
                                        // SELECT A CONVERSATION
                                    </span>
                                    <p className="text-xs text-zinc-400">
                                        Choose a conversation from the left panel to begin messaging.
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
