import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
    subscribeToUserConversations,
    subscribeToConversationMessages,
    subscribeToUserUnreadMessages,
    sendCollabMessage,
    markConversationAsRead,
    getConversationUnreadCount,
    type CollabConversation,
    type CollabChatMessage,
} from '../../services/collabMessageService';
import { handleImageError } from '../utils/imageUtils';
import { EllipsisVerticalIcon, Maximize2Icon, Minimize2Icon } from '../ui/Icons';

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
    const [convUnreadMap, setConvUnreadMap] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState<boolean>(true);

    const urlConvId = searchParams.get('conversationId') || initialConversationId || null;
    const [selectedConvId, setSelectedConvId] = useState<string | null>(urlConvId);

    // Messages state for selected conversation
    const [messages, setMessages] = useState<CollabChatMessage[]>([]);
    const [messagesLoading, setMessagesLoading] = useState<boolean>(false);
    const [inputText, setInputText] = useState<string>('');
    const [isSending, setIsSending] = useState<boolean>(false);

    // Three-dot dropdown menu state
    const [showMenu, setShowMenu] = useState<boolean>(false);

    // Full-screen expand state
    const [isExpanded, setIsExpanded] = useState<boolean>(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const menuButtonRef = useRef<HTMLButtonElement>(null);

    // Prevent background scrolling when chat is expanded
    useEffect(() => {
        if (isExpanded) {
            const originalOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = originalOverflow;
            };
        }
    }, [isExpanded]);

    // Scroll to bottom when expanded or when messages update
    useEffect(() => {
        if (isExpanded && messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
        }
    }, [isExpanded]);

    // Close three-dot menu on outside click or Escape key
    useEffect(() => {
        if (!showMenu) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (
                menuRef.current &&
                !menuRef.current.contains(event.target as Node) &&
                menuButtonRef.current &&
                !menuButtonRef.current.contains(event.target as Node)
            ) {
                setShowMenu(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setShowMenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [showMenu]);

    // Escape key handler to exit expanded mode when not interacting with open dropdown
    useEffect(() => {
        const handleExpandEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && isExpanded && !showMenu) {
                setIsExpanded(false);
            }
        };

        if (isExpanded) {
            document.addEventListener('keydown', handleExpandEscape);
            return () => {
                document.removeEventListener('keydown', handleExpandEscape);
            };
        }
    }, [isExpanded, showMenu]);

    // Reset menu when switching conversations
    useEffect(() => {
        setShowMenu(false);
    }, [selectedConvId]);

    // Subscribe to real-time message unread counts per conversation
    useEffect(() => {
        if (!currentUser?.uid) {
            setConvUnreadMap({});
            return;
        }

        const unsubUnread = subscribeToUserUnreadMessages(
            currentUser.uid,
            (result) => {
                setConvUnreadMap(result.convUnreadMap);
            },
            selectedConvId
        );

        return () => {
            unsubUnread();
        };
    }, [currentUser?.uid, selectedConvId]);

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
    const inboxConversations = useMemo(() => conversations.filter(c => !c.isTeam && c.type !== 'team'), [conversations]);
    const teamConversations = useMemo(() => conversations.filter(c => c.isTeam || c.type === 'team'), [conversations]);
    const activeList = useMemo(() => view === 'inbox' ? inboxConversations : teamConversations, [view, inboxConversations, teamConversations]);
    const hasData = activeList.length > 0;

    // Synchronize selected conversation with URL parameter
    useEffect(() => {
        if (urlConvId) {
            if (activeList.some(c => c.id === urlConvId)) {
                setSelectedConvId(urlConvId);
            }
        } else {
            setSelectedConvId(null);
        }
    }, [urlConvId, activeList]);

    // Find the currently selected conversation object
    const selectedConversation = activeList.find(c => c.id === selectedConvId) || null;

    // Automatically mark the currently viewed conversation as read
    useEffect(() => {
        if (!selectedConvId || !currentUser?.uid) return;
        markConversationAsRead(selectedConvId, currentUser.uid);
    }, [selectedConvId, currentUser?.uid]);

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
                // If user is actively viewing this conversation and unread incoming messages exist, mark as read
                if (currentUser?.uid && newMessages.length > 0) {
                    const hasUnreadIncoming = newMessages.some(
                        (m) => m.senderId !== currentUser.uid && (!m.read || (Array.isArray(m.readBy) && !m.readBy.includes(currentUser.uid)))
                    );
                    if (hasUnreadIncoming) {
                        markConversationAsRead(selectedConvId, currentUser.uid);
                    }
                }
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
    }, [selectedConvId, currentUser?.uid]);

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
            const otherParticipantId =
                (selectedConversation.participants || []).find(p => p && p !== currentUser.uid)
                || (selectedConversation.ownerId && selectedConversation.ownerId !== currentUser.uid ? selectedConversation.ownerId : null)
                || (selectedConversation.applicantId && selectedConversation.applicantId !== currentUser.uid ? selectedConversation.applicantId : null)
                || (selectedConversation.ownerDetails?.uid && selectedConversation.ownerDetails.uid !== currentUser.uid ? selectedConversation.ownerDetails.uid : null)
                || (selectedConversation.applicantDetails?.uid && selectedConversation.applicantDetails.uid !== currentUser.uid ? selectedConversation.applicantDetails.uid : null);
            const senderName = userProfile?.displayName || currentUser.displayName || 'You';
            const senderAvatar = userProfile?.photoURL || currentUser.photoURL || null;

            await sendCollabMessage({
                conversationId: selectedConversation.id,
                senderId: currentUser.uid,
                senderName,
                senderAvatar,
                text: textToSend,
                recipientId: otherParticipantId || undefined,
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
                userId: null,
            };
        }
        const isOwner = currentUser?.uid && (convo.ownerId === currentUser.uid || convo.ownerDetails?.uid === currentUser.uid);
        if (isOwner) {
            return {
                displayName: convo.applicantDetails?.displayName || 'Applicant',
                username: convo.applicantDetails?.username || '',
                photoURL: convo.applicantDetails?.photoURL || null,
                isApplicant: true,
                isTeam: false,
                userId: convo.applicantId || convo.applicantDetails?.uid || null,
            };
        }
        return {
            displayName: convo.ownerDetails?.displayName || 'Project Owner',
            username: convo.ownerDetails?.username || '',
            photoURL: convo.ownerDetails?.photoURL || null,
            isApplicant: false,
            isTeam: false,
            userId: convo.ownerId || convo.ownerDetails?.uid || null,
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

    const workspaceContent = (
        <div
            className={`font-mono ${
                isExpanded
                    ? 'fixed inset-0 w-screen h-screen h-[100dvh] z-[100] bg-[#0c0c0e] flex flex-col m-0 p-0 overflow-hidden'
                    : 'space-y-4'
            }`}
        >
            {/* View Header: Matches existing INVOX layout with polished alignment */}
            <div className={`flex items-center justify-between border-b border-zinc-800 ${isExpanded ? 'flex-shrink-0 px-4 sm:px-6 py-3.5 bg-[#0c0c0e]' : 'px-0 pb-3'}`}>
                {/* Left: Section Label and Title */}
                <div className="flex flex-col justify-center gap-0.5">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest block font-bold leading-none">
                        // MESSAGE BOARD
                    </span>
                    <h2 className="text-sm sm:text-base font-bold text-white uppercase tracking-wider leading-tight">
                        {view === 'inbox' ? 'INBOX' : 'TEAMS'}
                    </h2>
                </div>

                {/* Right: Action buttons in a single aligned row */}
                <div className="flex items-center gap-2">
                    {onBack && (
                        <button
                            type="button"
                            onClick={onBack}
                            className="h-8 px-2.5 sm:px-3 bg-transparent hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white text-xs uppercase tracking-wider transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer font-mono whitespace-nowrap"
                            title="Back to Collabs"
                        >
                            <span>←</span>
                            <span>// BACK TO COLLABS</span>
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => setIsExpanded((prev) => !prev)}
                        aria-label={isExpanded ? 'Restore message board' : 'Expand message board'}
                        title={isExpanded ? 'Restore message board' : 'Expand message board'}
                        className={`h-8 w-8 border transition-colors cursor-pointer inline-flex items-center justify-center text-xs font-mono flex-shrink-0 ${
                            isExpanded
                                ? 'bg-zinc-800 border-zinc-600 text-white'
                                : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white'
                        }`}
                    >
                        {isExpanded ? (
                            <Minimize2Icon className="w-3.5 h-3.5" />
                        ) : (
                            <Maximize2Icon className="w-3.5 h-3.5" />
                        )}
                    </button>
                </div>
            </div>

            {/* Content Display */}
            {loading ? (
                <div className={`p-12 text-center border border-zinc-800 bg-[#0c0c0e] ${isExpanded ? 'flex-1 flex flex-col items-center justify-center border-0' : ''}`}>
                    <div className="w-5 h-5 border-2 border-zinc-600 border-t-white rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-xs text-zinc-500 uppercase tracking-wider font-mono">// SYNCHRONIZING...</p>
                </div>
            ) : !hasData ? (
                /* Empty State Display */
                <div className={`border border-zinc-800 bg-[#0c0c0e] p-12 sm:p-16 text-center font-mono my-4 ${isExpanded ? 'flex-1 flex items-center justify-center border-0 m-0' : ''}`}>
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
                <div
                    className={`bg-[#0c0c0e] font-mono grid grid-cols-1 md:grid-cols-[30%_70%] overflow-hidden ${
                        isExpanded ? 'flex-1 min-h-0 border-0' : 'border border-zinc-800 h-[600px] sm:h-[640px]'
                    }`}
                >
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
                                const unreadCount = isSelected
                                    ? 0
                                    : (convUnreadMap[convo.id] !== undefined
                                        ? convUnreadMap[convo.id]
                                        : getConversationUnreadCount(convo, currentUser?.uid));
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
                                        <div className="px-4 py-3 border-b border-zinc-800 bg-[#0c0c0e] flex items-center justify-between gap-3 flex-shrink-0 relative z-20">
                                            {/* Left side: Avatar, Display Name, Username */}
                                            <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
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
                                                <div className="w-8 h-8 sm:w-9 sm:h-9 bg-zinc-900 border border-zinc-750 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white overflow-hidden">
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

                                                {/* Display Name */}
                                                <div className="min-w-0 flex items-center gap-2">
                                                    <span className="text-xs sm:text-sm font-bold text-white truncate">
                                                        {other.displayName}
                                                    </span>
                                                    {other.isTeam && (
                                                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-1.5 py-0.2 flex-shrink-0">
                                                            TEAM
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Right side: Three-dot overflow menu */}
                                            <div className="relative flex-shrink-0">
                                                <button
                                                    ref={menuButtonRef}
                                                    type="button"
                                                    onClick={() => setShowMenu((prev) => !prev)}
                                                    aria-label="Conversation options"
                                                    aria-expanded={showMenu}
                                                    aria-haspopup="true"
                                                    className={`p-2 border transition-colors cursor-pointer flex items-center justify-center text-xs ${
                                                        showMenu
                                                            ? 'bg-zinc-800 border-zinc-600 text-white'
                                                            : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white'
                                                    }`}
                                                >
                                                    <EllipsisVerticalIcon className="w-4 h-4" />
                                                </button>

                                                {/* Overflow Dropdown Menu */}
                                                {showMenu && (
                                                    <div
                                                        ref={menuRef}
                                                        role="menu"
                                                        aria-orientation="vertical"
                                                        className="absolute right-0 top-full mt-1.5 w-56 bg-[#0c0c0e] border border-zinc-800 shadow-2xl z-30 font-mono text-xs divide-y divide-zinc-850/80"
                                                    >
                                                        {/* Conversation Context Details (Project and Role) */}
                                                        {(selectedConversation.collabTitle || selectedConversation.collabHook || selectedConversation.roleTitle) && (
                                                            <div className="px-3.5 py-2.5 text-[10px] text-zinc-400 bg-zinc-950/60 space-y-1">
                                                                <div className="truncate">
                                                                    <span className="text-zinc-500 font-bold uppercase mr-1">PROJECT:</span>
                                                                    <span className="text-zinc-300">
                                                                        "{selectedConversation.collabHook || selectedConversation.collabTitle}"
                                                                    </span>
                                                                </div>
                                                                {selectedConversation.roleTitle && (
                                                                    <div className="truncate">
                                                                        <span className="text-zinc-500 font-bold uppercase mr-1">ROLE:</span>
                                                                        <span className="text-zinc-300 font-bold">
                                                                            [{selectedConversation.roleTitle}]
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Action 1: View Application */}
                                                        {selectedConversation.applicationId && (
                                                            <button
                                                                type="button"
                                                                role="menuitem"
                                                                onClick={() => {
                                                                    setShowMenu(false);
                                                                    handleReturnToApplication();
                                                                }}
                                                                className="w-full text-left px-3.5 py-2.5 text-zinc-300 hover:text-white hover:bg-zinc-900/90 transition-colors flex items-center justify-between cursor-pointer"
                                                            >
                                                                <span>// VIEW APPLICATION</span>
                                                                <span className="text-[10px] text-zinc-600">↗</span>
                                                            </button>
                                                        )}

                                                        {/* Action 2: View Profile (if user id available) */}
                                                        {other.userId && (
                                                            <button
                                                                type="button"
                                                                role="menuitem"
                                                                onClick={() => {
                                                                    setShowMenu(false);
                                                                    navigate(`/profile/${other.userId}`);
                                                                }}
                                                                className="w-full text-left px-3.5 py-2.5 text-zinc-300 hover:text-white hover:bg-zinc-900/90 transition-colors flex items-center justify-between cursor-pointer"
                                                            >
                                                                <span>// VIEW PROFILE</span>
                                                                <span className="text-[10px] text-zinc-600">↗</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
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

    return isExpanded && typeof document !== 'undefined'
        ? createPortal(workspaceContent, document.body)
        : workspaceContent;
};
