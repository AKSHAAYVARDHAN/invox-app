import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
    subscribeToSpotlightInboxConversations,
    subscribeToUserConversations,
    subscribeToConversationMessages,
    subscribeToUserUnreadMessages,
    sendCollabMessage,
    markConversationAsRead,
    getConversationUnreadCount,
    isSpotlightConversation,
    type CollabConversation,
    type CollabChatMessage,
} from '../../services/collabMessageService';
import {
    EllipsisVerticalIcon,
    Maximize2Icon,
    Minimize2Icon,
    SparklesIcon,
    MagnifyingGlassIcon,
} from '../ui/Icons';
import { ClickableMessageText } from '../ui/ClickableMessageText';
import {
    ConversationCard,
    SearchInput,
    ChatHeader,
    MessageComposer,
    EmptyMessagingState,
} from './MessagingComponents';
import { ConversationSummaryModal } from './ConversationSummaryModal';
import { ConversationSearchBar } from './ConversationSearchBar';

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
    const [searchQuery, setSearchQuery] = useState<string>('');

    const urlConvId = searchParams.get('conversationId') || initialConversationId || null;
    const [selectedConvId, setSelectedConvId] = useState<string | null>(urlConvId);

    // Messages state for selected conversation
    const [messages, setMessages] = useState<CollabChatMessage[]>([]);
    const [messagesLoading, setMessagesLoading] = useState<boolean>(false);
    const [inputText, setInputText] = useState<string>('');
    const [isSending, setIsSending] = useState<boolean>(false);

    // Three-dot dropdown menu state
    const [showMenu, setShowMenu] = useState<boolean>(false);

    // Conversation Search state
    const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
    const [chatSearchQuery, setChatSearchQuery] = useState<string>('');
    const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(0);

    // AI Summary Modal state
    const [showSummaryModal, setShowSummaryModal] = useState<boolean>(false);

    // Full-screen expand state
    const [isExpanded, setIsExpanded] = useState<boolean>(false);

    // Smart scrolling state
    const timelineRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const menuButtonRef = useRef<HTMLButtonElement>(null);
    const [isNearBottom, setIsNearBottom] = useState<boolean>(true);
    const [hasUnreadBelow, setHasUnreadBelow] = useState<boolean>(false);

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
            if (event.key === 'Escape' && isExpanded && !showMenu && !isSearchOpen && !showSummaryModal) {
                setIsExpanded(false);
            }
        };

        if (isExpanded) {
            document.addEventListener('keydown', handleExpandEscape);
            return () => {
                document.removeEventListener('keydown', handleExpandEscape);
            };
        }
    }, [isExpanded, showMenu, isSearchOpen, showSummaryModal]);

    // Reset menu, search, and summary when switching conversations
    useEffect(() => {
        setShowMenu(false);
        setIsSearchOpen(false);
        setChatSearchQuery('');
        setCurrentMatchIndex(0);
        setShowSummaryModal(false);
    }, [selectedConvId]);

    // Compute search matches within the active conversation only
    const matchingMessages = useMemo(() => {
        if (!isSearchOpen || !chatSearchQuery.trim()) return [];
        const q = chatSearchQuery.toLowerCase().trim();
        return messages.filter((m) => {
            const textMatch = typeof m.text === 'string' && m.text.toLowerCase().includes(q);
            const senderMatch = typeof m.senderName === 'string' && m.senderName.toLowerCase().includes(q);
            return textMatch || senderMatch;
        });
    }, [messages, isSearchOpen, chatSearchQuery]);

    const activeMatchedMessageId = matchingMessages[currentMatchIndex]?.id || null;

    const scrollToMessage = (msgId: string) => {
        const el = document.getElementById(`inbox-msg-${msgId}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };

    const handleNextMatch = () => {
        if (matchingMessages.length === 0) return;
        const nextIndex = (currentMatchIndex + 1) % matchingMessages.length;
        setCurrentMatchIndex(nextIndex);
        scrollToMessage(matchingMessages[nextIndex].id);
    };

    const handlePrevMatch = () => {
        if (matchingMessages.length === 0) return;
        const prevIndex = (currentMatchIndex - 1 + matchingMessages.length) % matchingMessages.length;
        setCurrentMatchIndex(prevIndex);
        scrollToMessage(matchingMessages[prevIndex].id);
    };

    const handleCloseSearch = () => {
        setIsSearchOpen(false);
        setChatSearchQuery('');
        setCurrentMatchIndex(0);
    };

    useEffect(() => {
        if (matchingMessages.length > 0) {
            setCurrentMatchIndex(0);
            scrollToMessage(matchingMessages[0].id);
        } else {
            setCurrentMatchIndex(0);
        }
    }, [chatSearchQuery]);

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
            selectedConvId,
            'spotlight'
        );

        return () => {
            unsubUnread();
        };
    }, [currentUser?.uid, selectedConvId]);

    // Subscribe to Spotlight Inbox conversations (guarantees Hub Comrades exclusion)
    useEffect(() => {
        if (!currentUser?.uid) {
            setConversations([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const unsub = subscribeToSpotlightInboxConversations(
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
    const inboxConversations = useMemo(
        () => conversations.filter((c) => isSpotlightConversation(c) && !c.isTeam && c.type !== 'team'),
        [conversations]
    );
    const teamConversations = useMemo(
        () => conversations.filter((c) => c.isTeam || c.type === 'team'),
        [conversations]
    );
    const activeList = useMemo(
        () => (view === 'inbox' ? inboxConversations : teamConversations),
        [view, inboxConversations, teamConversations]
    );

    // Filter conversations by search query
    const filteredActiveList = useMemo(() => {
        if (!searchQuery.trim()) return activeList;
        const q = searchQuery.toLowerCase().trim();
        return activeList.filter((convo) => {
            const other = getOtherParticipant(convo);
            return (
                other.displayName?.toLowerCase().includes(q) ||
                convo.collabTitle?.toLowerCase().includes(q) ||
                convo.collabHook?.toLowerCase().includes(q) ||
                convo.roleTitle?.toLowerCase().includes(q) ||
                convo.lastMessage?.toLowerCase().includes(q)
            );
        });
    }, [activeList, searchQuery]);

    // Sort conversations by most recent activity timestamp
    const sortedActiveList = useMemo(() => {
        const copy = [...filteredActiveList];
        copy.sort((a, b) => {
            const getTime = (val: any) => {
                if (!val) return 0;
                if (typeof val.toDate === 'function') return val.toDate().getTime();
                if (val instanceof Date) return val.getTime();
                return new Date(val).getTime() || 0;
            };
            const timeA = getTime(a.lastMessageTimestamp || a.updatedAt || a.createdAt);
            const timeB = getTime(b.lastMessageTimestamp || b.updatedAt || b.createdAt);
            return timeB - timeA;
        });
        return copy;
    }, [filteredActiveList]);

    const hasData = activeList.length > 0;

    // Synchronize selected conversation with URL parameter
    useEffect(() => {
        if (urlConvId) {
            if (activeList.some((c) => c.id === urlConvId)) {
                setSelectedConvId(urlConvId);
            }
        } else {
            setSelectedConvId(null);
        }
    }, [urlConvId, activeList]);

    // Find the currently selected conversation object
    const selectedConversation = activeList.find((c) => c.id === selectedConvId) || null;

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
                if (currentUser?.uid && newMessages.length > 0) {
                    const hasUnreadIncoming = newMessages.some(
                        (m) =>
                            m.senderId !== currentUser.uid &&
                            (!m.read || (Array.isArray(m.readBy) && !m.readBy.includes(currentUser.uid)))
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

    // Handle scroll events on message timeline
    const handleTimelineScroll = () => {
        if (!timelineRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = timelineRef.current;
        const nearBottom = scrollHeight - scrollTop - clientHeight < 100;
        setIsNearBottom(nearBottom);
        if (nearBottom) {
            setHasUnreadBelow(false);
        }
    };

    // Smart auto-scroll: only scrolls to bottom if near bottom or if user sent the message
    useEffect(() => {
        if (messages.length === 0) return;
        const lastMsg = messages[messages.length - 1];
        const isMyMessage = lastMsg?.senderId === currentUser?.uid;

        if (isNearBottom || isMyMessage) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            setHasUnreadBelow(false);
        } else {
            setHasUnreadBelow(true);
        }
    }, [messages, currentUser?.uid, isNearBottom]);

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
                (selectedConversation.participants || []).find((p) => p && p !== currentUser.uid) ||
                (selectedConversation.ownerId && selectedConversation.ownerId !== currentUser.uid
                    ? selectedConversation.ownerId
                    : null) ||
                (selectedConversation.applicantId && selectedConversation.applicantId !== currentUser.uid
                    ? selectedConversation.applicantId
                    : null) ||
                (selectedConversation.ownerDetails?.uid && selectedConversation.ownerDetails.uid !== currentUser.uid
                    ? selectedConversation.ownerDetails.uid
                    : null) ||
                (selectedConversation.applicantDetails?.uid && selectedConversation.applicantDetails.uid !== currentUser.uid
                    ? selectedConversation.applicantDetails.uid
                    : null);
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

    // Format timestamps compactly
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
        const isOwner =
            currentUser?.uid &&
            (convo.ownerId === currentUser.uid || convo.ownerDetails?.uid === currentUser.uid);
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
        setSearchParams((prev) => {
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
            {/* View Header: Clean INVOX layout with aligned actions */}
            <div
                className={`flex items-center justify-between border-b border-zinc-800 ${
                    isExpanded ? 'flex-shrink-0 px-4 sm:px-6 py-3.5 bg-[#0c0c0e]' : 'px-0 pb-3'
                }`}
            >
                {/* Left: Section Label and Title */}
                <div className="flex flex-col justify-center gap-0.5">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest block font-bold leading-none">
                        // MESSAGE BOARD
                    </span>
                    <h2 className="text-sm sm:text-base font-bold text-white uppercase tracking-wider leading-tight">
                        {view === 'inbox' ? 'INBOX' : 'TEAMS'}
                    </h2>
                </div>

                {/* Right: Actions */}
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
                <div
                    className={`p-12 text-center border border-zinc-800 bg-[#0c0c0e] ${
                        isExpanded ? 'flex-1 flex flex-col items-center justify-center border-0' : 'h-[640px] flex items-center justify-center'
                    }`}
                >
                    <div>
                        <div className="w-5 h-5 border-2 border-zinc-600 border-t-white rounded-full animate-spin mx-auto mb-2" />
                        <p className="text-xs text-zinc-500 uppercase tracking-wider font-mono">
                            // SYNCHRONIZING CONVERSATIONS...
                        </p>
                    </div>
                </div>
            ) : !hasData ? (
                /* Empty State Display */
                <div
                    className={`border border-zinc-800 bg-[#0c0c0e] p-12 sm:p-16 text-center font-mono my-4 ${
                        isExpanded ? 'flex-1 flex items-center justify-center border-0 m-0' : 'h-[640px] flex items-center justify-center'
                    }`}
                >
                    <div className="max-w-md mx-auto space-y-1.5">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">
                            {view === 'inbox' ? '// NO CONVERSATIONS' : '// NO TEAM CONVERSATIONS'}
                        </span>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                            {view === 'inbox'
                                ? 'No direct collaborative conversations yet.'
                                : "You don't have any team conversations yet."}
                        </p>
                    </div>
                </div>
            ) : (
                /* Two-Column Messaging Workspace: Compact Sidebar + Large Active Chat */
                <div
                    className={`bg-[#0c0c0e] font-mono flex flex-col md:flex-row overflow-hidden ${
                        isExpanded ? 'flex-1 min-h-0 border-0' : 'border border-zinc-800 h-[640px] sm:h-[700px]'
                    }`}
                >
                    {/* LEFT PANEL: Compact Conversation Sidebar */}
                    <aside
                        className={`w-full md:w-80 lg:w-84 flex-shrink-0 border-b md:border-b-0 md:border-r border-zinc-800 flex flex-col h-full bg-[#0b0b0d] overflow-hidden ${
                            selectedConvId ? 'hidden md:flex' : 'flex'
                        }`}
                    >
                        {/* Section Header */}
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

                        {/* Search Bar */}
                        <SearchInput
                            value={searchQuery}
                            onChange={setSearchQuery}
                            placeholder={view === 'inbox' ? 'SEARCH INBOX...' : 'SEARCH CHANNELS...'}
                        />

                        {/* Conversation Cards List */}
                        <div className="flex-1 overflow-y-auto divide-y divide-zinc-850/60">
                            {sortedActiveList.length === 0 ? (
                                <div className="p-6 text-center text-xs text-zinc-500 font-mono">
                                    No conversations matching "{searchQuery}"
                                </div>
                            ) : (
                                sortedActiveList.map((convo) => {
                                    const other = getOtherParticipant(convo);
                                    const isSelected = convo.id === selectedConvId;
                                    const unreadCount = isSelected
                                        ? 0
                                        : convUnreadMap[convo.id] !== undefined
                                        ? convUnreadMap[convo.id]
                                        : getConversationUnreadCount(convo, currentUser?.uid);
                                    const timestampStr = formatTimestamp(
                                        convo.lastMessageTimestamp || convo.updatedAt || convo.createdAt
                                    );

                                    return (
                                        <ConversationCard
                                            key={convo.id}
                                            data={{
                                                id: convo.id,
                                                name: other.displayName,
                                                avatarUrl: other.photoURL,
                                                isTeam: other.isTeam,
                                                lastMessage: convo.lastMessage,
                                                timestampStr,
                                                unreadCount,
                                                isSelected,
                                                subtitle: other.username
                                                    ? `@${other.username}${convo.roleTitle ? ` • [${convo.roleTitle}]` : convo.collabHook ? ` • ${convo.collabHook}` : ''}`
                                                    : convo.roleTitle
                                                    ? `[${convo.roleTitle}]`
                                                    : convo.collabHook || convo.collabTitle,
                                            }}
                                            onClick={() => {
                                                setSelectedConvId(convo.id);
                                                if (currentUser?.uid && unreadCount > 0) {
                                                    markConversationAsRead(convo.id, currentUser.uid);
                                                }
                                                setSearchParams((prev) => {
                                                    const next = new URLSearchParams(prev);
                                                    next.set('tab', 'Collabs');
                                                    next.set('collabView', view);
                                                    next.set('conversationId', convo.id);
                                                    return next;
                                                });
                                            }}
                                        />
                                    );
                                })
                            )}
                        </div>
                    </aside>

                    {/* RIGHT PANEL: Large Active Chat Panel */}
                    <main
                        className={`flex-1 min-w-0 flex flex-col bg-[#08080a] overflow-hidden relative h-full ${
                            !selectedConvId ? 'hidden md:flex' : 'flex'
                        }`}
                    >
                        {selectedConversation ? (
                            <>
                                {/* Active Conversation Header */}
                                {(() => {
                                    const other = getOtherParticipant(selectedConversation);
                                    const handleTag = other.username ? `@${other.username}` : '';
                                    const projectTag = selectedConversation.collabHook || selectedConversation.collabTitle
                                        ? `// ${selectedConversation.collabHook || selectedConversation.collabTitle}${
                                              selectedConversation.roleTitle
                                                  ? ` • [${selectedConversation.roleTitle}]`
                                                  : ''
                                          }`
                                        : '';
                                    const subtitleText = [handleTag, projectTag].filter(Boolean).join(' • ') || undefined;

                                    return (
                                        <ChatHeader
                                            title={other.displayName}
                                            subtitle={subtitleText}
                                            avatarUrl={other.photoURL}
                                            isTeam={other.isTeam}
                                            onBackMobile={() => setSelectedConvId(null)}
                                        >
                                            {/* 1. AI Summary Action Button */}
                                            <button
                                                type="button"
                                                onClick={() => setShowSummaryModal(true)}
                                                className="h-8 px-2 sm:px-2.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-850 text-zinc-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-mono flex-shrink-0 cursor-pointer"
                                                aria-label="Generate AI summary"
                                                title="Generate AI summary of conversation"
                                            >
                                                <SparklesIcon className="w-3.5 h-3.5 text-zinc-300" />
                                                <span className="hidden sm:inline text-[10px] font-bold tracking-wider uppercase whitespace-nowrap">
                                                    // AI SUMMARY
                                                </span>
                                            </button>

                                            {/* 2. Conversation Search Icon Button */}
                                            <button
                                                type="button"
                                                onClick={() => setIsSearchOpen((prev) => !prev)}
                                                aria-label="Search messages"
                                                title="Search messages in this conversation"
                                                className={`h-8 w-8 border transition-colors cursor-pointer flex items-center justify-center text-xs font-mono flex-shrink-0 ${
                                                    isSearchOpen
                                                        ? 'bg-zinc-800 border-zinc-600 text-white'
                                                        : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white'
                                                }`}
                                            >
                                                <MagnifyingGlassIcon className="w-3.5 h-3.5" />
                                            </button>

                                            {/* 3. Overflow Menu */}
                                            <div className="relative">
                                                <button
                                                    ref={menuButtonRef}
                                                    type="button"
                                                    onClick={() => setShowMenu((prev) => !prev)}
                                                    aria-label="Conversation options"
                                                    aria-expanded={showMenu}
                                                    aria-haspopup="true"
                                                    className={`w-8 h-8 border transition-colors cursor-pointer flex items-center justify-center text-xs ${
                                                        showMenu
                                                            ? 'bg-zinc-800 border-zinc-600 text-white'
                                                            : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white'
                                                    }`}
                                                >
                                                    <EllipsisVerticalIcon className="w-4 h-4" />
                                                </button>

                                                {/* Overflow Dropdown */}
                                                {showMenu && (
                                                    <div
                                                        ref={menuRef}
                                                        role="menu"
                                                        aria-orientation="vertical"
                                                        className="absolute right-0 top-full mt-1.5 w-56 bg-[#0c0c0e] border border-zinc-800 shadow-2xl z-30 font-mono text-xs divide-y divide-zinc-850/80"
                                                    >
                                                        {/* Context Details */}
                                                        {(selectedConversation.collabTitle ||
                                                            selectedConversation.collabHook ||
                                                            selectedConversation.roleTitle) && (
                                                            <div className="px-3.5 py-2.5 text-[10px] text-zinc-400 bg-zinc-950/60 space-y-1">
                                                                <div className="truncate">
                                                                    <span className="text-zinc-500 font-bold uppercase mr-1">
                                                                        PROJECT:
                                                                    </span>
                                                                    <span className="text-zinc-300">
                                                                        "{selectedConversation.collabHook || selectedConversation.collabTitle}"
                                                                    </span>
                                                                </div>
                                                                {selectedConversation.roleTitle && (
                                                                    <div className="truncate">
                                                                        <span className="text-zinc-500 font-bold uppercase mr-1">
                                                                            ROLE:
                                                                        </span>
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

                                                        {/* Action 2: View Profile */}
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
                                        </ChatHeader>
                                    );
                                })()}

                                {/* Active Conversation Search Bar */}
                                <ConversationSearchBar
                                    isOpen={isSearchOpen}
                                    searchQuery={chatSearchQuery}
                                    onQueryChange={setChatSearchQuery}
                                    onClose={handleCloseSearch}
                                    totalMatches={matchingMessages.length}
                                    currentMatchIndex={currentMatchIndex}
                                    onPrevMatch={handlePrevMatch}
                                    onNextMatch={handleNextMatch}
                                    placeholder="Search messages in this inbox thread..."
                                />

                                {/* Message Thread Timeline */}
                                <div
                                    ref={timelineRef}
                                    onScroll={handleTimelineScroll}
                                    className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 min-h-0 relative"
                                >
                                    {messagesLoading ? (
                                        <div className="py-12 text-center my-auto">
                                            <div className="w-5 h-5 border-2 border-zinc-600 border-t-white rounded-full animate-spin mx-auto mb-2" />
                                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">
                                                // LOADING MESSAGES...
                                            </p>
                                        </div>
                                    ) : messages.length === 0 ? (
                                        <EmptyMessagingState
                                            title="// NO MESSAGES YET"
                                            description="Start communicating with your collaborator below."
                                        />
                                    ) : (
                                        messages.map((msg) => {
                                            const isMe = msg.senderId === currentUser?.uid;
                                            const timeStr = formatTimestamp(msg.createdAt);
                                            const isMatchActive = isSearchOpen && activeMatchedMessageId === msg.id;

                                            return (
                                                <div
                                                    id={`inbox-msg-${msg.id}`}
                                                    key={msg.id}
                                                    className={`flex flex-col transition-all duration-200 ${isMe ? 'items-end' : 'items-start'}`}
                                                >
                                                    {!isMe && msg.senderName && (
                                                        <span className="text-[10px] text-zinc-400 mb-1 px-1 font-semibold font-mono tracking-wide">
                                                            {msg.senderName}
                                                        </span>
                                                    )}
                                                    <div
                                                        className={`max-w-[85%] sm:max-w-[70%] px-3.5 py-2.5 text-xs border shadow-sm transition-all duration-200 ${
                                                            isMatchActive
                                                                ? 'ring-2 ring-emerald-400 border-emerald-400 bg-zinc-850 text-white shadow-lg'
                                                                : isMe
                                                                ? 'bg-zinc-850 border-zinc-750 text-zinc-100'
                                                                : 'bg-[#131317] border-zinc-800 text-zinc-200'
                                                        }`}
                                                    >
                                                        <div className="whitespace-pre-wrap break-words leading-relaxed font-mono">
                                                            <ClickableMessageText
                                                                text={msg.text}
                                                                isSender={isMe}
                                                                timestamp={timeStr}
                                                                searchTerm={isSearchOpen ? chatSearchQuery : undefined}
                                                            />
                                                        </div>
                                                        {timeStr && (
                                                            <div
                                                                className={`mt-1.5 text-[10px] font-mono tabular-nums ${
                                                                    isMe
                                                                        ? 'text-zinc-500 text-right'
                                                                        : 'text-zinc-600 text-left'
                                                                }`}
                                                            >
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

                                {/* Floating Jump to Latest Button */}
                                {hasUnreadBelow && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                                            setHasUnreadBelow(false);
                                        }}
                                        className="absolute bottom-16 right-6 z-10 px-3 py-1 bg-zinc-900 border border-emerald-500 text-emerald-400 text-[10px] font-bold font-mono uppercase tracking-wider shadow-lg hover:bg-zinc-850 cursor-pointer animate-bounce"
                                    >
                                        ↓ NEW MESSAGES BELOW
                                    </button>
                                )}

                                {/* Bottom Message Composer */}
                                <MessageComposer
                                    value={inputText}
                                    onChange={setInputText}
                                    onSend={handleSendMessage}
                                    disabled={isSending}
                                    isSending={isSending}
                                    placeholder="// TYPE A MESSAGE (ENTER TO SEND)..."
                                    textareaRef={textareaRef}
                                />
                            </>
                        ) : (
                            /* Initial / No Selected Conversation */
                            <div className="h-full flex items-center justify-center p-8 text-center bg-[#09090c] font-mono select-none">
                                <div className="space-y-2 max-w-sm">
                                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest block">
                                        // SPOTLIGHT INBOX
                                    </span>
                                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                                        NO CONVERSATION SELECTED
                                    </h4>
                                    <p className="text-xs text-zinc-400 leading-relaxed">
                                        Select a conversation from the sidebar to view direct collaboration messages and application threads.
                                    </p>
                                </div>
                            </div>
                        )}
                    </main>
                </div>
            )}

            {/* AI Summary Modal for active inbox conversation */}
            {selectedConversation && (
                <ConversationSummaryModal
                    isOpen={showSummaryModal}
                    onClose={() => setShowSummaryModal(false)}
                    conversationId={selectedConversation.id}
                    conversationTitle={getOtherParticipant(selectedConversation).displayName}
                    conversationType="inbox"
                    messages={messages}
                    currentUser={currentUser}
                />
            )}
        </div>
    );

    return isExpanded && typeof document !== 'undefined'
        ? createPortal(workspaceContent, document.body)
        : workspaceContent;
};
