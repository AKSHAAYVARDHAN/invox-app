import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
    subscribeToUserConversations,
    subscribeToConversationMessages,
    sendCollabMessage,
    markConversationAsRead,
    getConversationUnreadCount,
    getOrCreateDirectConversation,
    type CollabConversation,
    type CollabChatMessage,
} from '../../services/collabMessageService';
import {
    subscribeToUserTeams,
    subscribeToTeam,
    subscribeToTeamMembers,
    subscribeToTeamMessages,
    sendTeamMessage,
    markTeamAsRead,
    createCrewGroup,
    addMemberToCrew,
    leaveTeam,
    deleteTeam,
    type Team,
    type TeamMember,
    type TeamMessage,
} from '../../services/teamService';
import { subscribeFollowedProfiles } from '../../services/connectionService';
import type { InvoxUser } from '../../types';
import {
    SparklesIcon,
    MagnifyingGlassIcon,
    UsersIcon,
    PlusIcon,
    ArrowUpRightIcon,
    CloseIcon,
    TrashIcon,
    LogoutIcon,
    CheckIcon,
} from '../ui/Icons';
import { ClickableMessageText } from '../ui/ClickableMessageText';
import {
    ConversationCard,
    SearchInput,
    ChatHeader,
    MessageComposer,
    EmptyMessagingState,
} from '../spotlight/MessagingComponents';
import { ConversationSummaryModal } from '../spotlight/ConversationSummaryModal';
import { ConversationSearchBar } from '../spotlight/ConversationSearchBar';
import { handleImageError } from '../utils/imageUtils';

export const HubConversationsView: React.FC = () => {
    const { currentUser, userProfile } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // Primary subsections: // COMRADES or // CREW
    const [activeSection, setActiveSection] = useState<'comrades' | 'crew'>('comrades');

    // Followed connections / comrades for starting new chats or inviting to crew
    const [followedProfiles, setFollowedProfiles] = useState<InvoxUser[]>([]);

    // ----------------------------------------------------
    // COMRADES (1-on-1 Direct Messaging) State
    // ----------------------------------------------------
    const [comradeConvs, setComradeConvs] = useState<CollabConversation[]>([]);
    const [loadingComrades, setLoadingComrades] = useState<boolean>(true);
    const [comradeSearch, setComradeSearch] = useState<string>('');
    const [selectedComradeId, setSelectedComradeId] = useState<string | null>(null);
    const [comradeMessages, setComradeMessages] = useState<CollabChatMessage[]>([]);
    const [loadingComradeMsgs, setLoadingComradeMsgs] = useState<boolean>(false);
    const [comradeInput, setComradeInput] = useState<string>('');
    const [sendingComrade, setSendingComrade] = useState<boolean>(false);
    const [showNewComradeModal, setShowNewComradeModal] = useState<boolean>(false);
    const [newComradeFilter, setNewComradeFilter] = useState<string>('');

    // In-chat search for comrades
    const [isComradeSearchOpen, setIsComradeSearchOpen] = useState<boolean>(false);
    const [comradeChatSearchQuery, setComradeChatSearchQuery] = useState<string>('');
    const [comradeMatchIndex, setComradeMatchIndex] = useState<number>(0);

    // AI Summary for comrades
    const [showComradeSummaryModal, setShowComradeSummaryModal] = useState<boolean>(false);

    // ----------------------------------------------------
    // CREW (Group Messaging) State
    // ----------------------------------------------------
    const [crews, setCrews] = useState<Team[]>([]);
    const [loadingCrews, setLoadingCrews] = useState<boolean>(true);
    const [crewSearch, setCrewSearch] = useState<string>('');
    const [selectedCrewId, setSelectedCrewId] = useState<string | null>(null);
    const [activeCrew, setActiveCrew] = useState<Team | null>(null);
    const [crewMembers, setCrewMembers] = useState<TeamMember[]>([]);
    const [crewMessages, setCrewMessages] = useState<TeamMessage[]>([]);
    const [loadingCrewMsgs, setLoadingCrewMsgs] = useState<boolean>(false);
    const [crewInput, setCrewInput] = useState<string>('');
    const [sendingCrew, setSendingCrew] = useState<boolean>(false);

    // Modals & Panels for Crew
    const [showCreateCrewModal, setShowCreateCrewModal] = useState<boolean>(false);
    const [newCrewName, setNewCrewName] = useState<string>('');
    const [newCrewDesc, setNewCrewDesc] = useState<string>('');
    const [selectedCrewMemberUids, setSelectedCrewMemberUids] = useState<Set<string>>(new Set());
    const [isSubmittingCrew, setIsSubmittingCrew] = useState<boolean>(false);
    const [showCrewMembersDrawer, setShowCrewMembersDrawer] = useState<boolean>(false);
    const [showAddMemberModal, setShowAddMemberModal] = useState<boolean>(false);

    // In-chat search for crew
    const [isCrewSearchOpen, setIsCrewSearchOpen] = useState<boolean>(false);
    const [crewChatSearchQuery, setCrewChatSearchQuery] = useState<string>('');
    const [crewMatchIndex, setCrewMatchIndex] = useState<number>(0);

    // AI Summary for crew
    const [showCrewSummaryModal, setShowCrewSummaryModal] = useState<boolean>(false);

    // References for scrolling
    const comradeTimelineRef = useRef<HTMLDivElement>(null);
    const crewTimelineRef = useRef<HTMLDivElement>(null);
    const comradeComposerRef = useRef<HTMLTextAreaElement>(null);
    const crewComposerRef = useRef<HTMLTextAreaElement>(null);

    // Format timestamps nicely
    const formatTimestamp = (val: any): string => {
        if (!val) return '';
        try {
            const d = typeof val?.toDate === 'function' ? val.toDate() : new Date(val);
            if (isNaN(d.getTime())) return '';
            const now = new Date();
            const diffMs = now.getTime() - d.getTime();
            if (diffMs >= 0 && diffMs < 60000) return 'just now';

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

    // Format date string for timeline separators
    const formatDaySeparator = (val: any): string => {
        if (!val) return '';
        try {
            const d = typeof val?.toDate === 'function' ? val.toDate() : new Date(val);
            if (isNaN(d.getTime())) return '';
            const now = new Date();
            if (d.toDateString() === now.toDateString()) return 'TODAY';
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            if (d.toDateString() === yesterday.toDateString()) return 'YESTERDAY';
            return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
        } catch {
            return '';
        }
    };

    // Fetch followed profiles for connection pickers
    useEffect(() => {
        if (!currentUser?.uid) return;
        const unsub = subscribeFollowedProfiles(
            currentUser.uid,
            (profiles) => setFollowedProfiles(profiles),
            (err) => console.warn('[FOLLOWED_PROFILES_ERROR]', err)
        );
        return () => unsub();
    }, [currentUser?.uid]);

    // ----------------------------------------------------
    // COMRADES Subscriptions
    // ----------------------------------------------------
    useEffect(() => {
        if (!currentUser?.uid) {
            setComradeConvs([]);
            setLoadingComrades(false);
            return;
        }

        setLoadingComrades(true);
        const unsub = subscribeToUserConversations(
            currentUser.uid,
            (allConvs) => {
                // Keep conversations that are direct comrades or applications
                const directs = allConvs.filter((c) => !c.isTeam && c.type !== 'team');
                setComradeConvs(directs);
                setLoadingComrades(false);

                // Auto-select first if none selected and on desktop
                if (!selectedComradeId && directs.length > 0 && window.innerWidth >= 768) {
                    setSelectedComradeId(directs[0].id);
                }
            },
            (err) => {
                console.error('[SUBSCRIBE_COMRADE_CONVS_ERROR]', err);
                setLoadingComrades(false);
            }
        );

        return () => unsub();
    }, [currentUser?.uid]);

    // Subscribe to messages in active comrade conversation
    useEffect(() => {
        if (!selectedComradeId) {
            setComradeMessages([]);
            return;
        }

        setLoadingComradeMsgs(true);
        if (currentUser?.uid) {
            markConversationAsRead(selectedComradeId, currentUser.uid).catch(() => {});
        }

        const unsub = subscribeToConversationMessages(
            selectedComradeId,
            (msgs) => {
                setComradeMessages(msgs);
                setLoadingComradeMsgs(false);
                setTimeout(() => {
                    if (comradeTimelineRef.current) {
                        comradeTimelineRef.current.scrollTop = comradeTimelineRef.current.scrollHeight;
                    }
                }, 50);
            },
            (err) => {
                console.error('[SUBSCRIBE_COMRADE_MSGS_ERROR]', err);
                setLoadingComradeMsgs(false);
            }
        );

        return () => unsub();
    }, [selectedComradeId, currentUser?.uid]);

    // ----------------------------------------------------
    // CREW Subscriptions
    // ----------------------------------------------------
    useEffect(() => {
        if (!currentUser?.uid) {
            setCrews([]);
            setLoadingCrews(false);
            return;
        }

        setLoadingCrews(true);
        const unsub = subscribeToUserTeams(
            currentUser.uid,
            (teamList) => {
                setCrews(teamList);
                setLoadingCrews(false);

                // Auto-select first crew if none selected on desktop
                if (!selectedCrewId && teamList.length > 0 && window.innerWidth >= 768) {
                    setSelectedCrewId(teamList[0].id);
                }
            },
            (err) => {
                console.error('[SUBSCRIBE_CREWS_ERROR]', err);
                setLoadingCrews(false);
            }
        );

        return () => unsub();
    }, [currentUser?.uid]);

    // Subscribe to selected Crew details
    useEffect(() => {
        if (!selectedCrewId) {
            setActiveCrew(null);
            return;
        }

        const unsubTeam = subscribeToTeam(selectedCrewId, (team) => {
            setActiveCrew(team);
        });

        const unsubMembers = subscribeToTeamMembers(selectedCrewId, (mems) => {
            setCrewMembers(mems);
        });

        setLoadingCrewMsgs(true);
        if (currentUser?.uid) {
            markTeamAsRead(selectedCrewId, currentUser.uid).catch(() => {});
        }

        const unsubMsgs = subscribeToTeamMessages(
            selectedCrewId,
            (msgs) => {
                setCrewMessages(msgs);
                setLoadingCrewMsgs(false);
                setTimeout(() => {
                    if (crewTimelineRef.current) {
                        crewTimelineRef.current.scrollTop = crewTimelineRef.current.scrollHeight;
                    }
                }, 50);
            },
            (err) => {
                console.error('[SUBSCRIBE_CREW_MSGS_ERROR]', err);
                setLoadingCrewMsgs(false);
            }
        );

        return () => {
            unsubTeam();
            unsubMembers();
            unsubMsgs();
        };
    }, [selectedCrewId, currentUser?.uid]);

    // ----------------------------------------------------
    // Comrade Participant Helper
    // ----------------------------------------------------
    const selectedComradeConv = useMemo(() => {
        return comradeConvs.find((c) => c.id === selectedComradeId) || null;
    }, [comradeConvs, selectedComradeId]);

    const getOtherComradeParticipant = (convo: CollabConversation) => {
        const isOwner = currentUser?.uid && (convo.ownerId === currentUser.uid || convo.ownerDetails?.uid === currentUser.uid);
        if (isOwner) {
            return {
                displayName: convo.applicantDetails?.displayName || 'Comrade',
                username: convo.applicantDetails?.username || '',
                photoURL: convo.applicantDetails?.photoURL || null,
                userId: convo.applicantId || convo.applicantDetails?.uid || null,
            };
        }
        return {
            displayName: convo.ownerDetails?.displayName || 'Comrade',
            username: convo.ownerDetails?.username || '',
            photoURL: convo.ownerDetails?.photoURL || null,
            userId: convo.ownerId || convo.ownerDetails?.uid || null,
        };
    };

    // ----------------------------------------------------
    // Sending Messages
    // ----------------------------------------------------
    const handleSendComradeMessage = async () => {
        if (!selectedComradeConv || !currentUser?.uid) return;
        const text = comradeInput.trim();
        if (!text || sendingComrade) return;

        setSendingComrade(true);
        setComradeInput('');
        try {
            const other = getOtherComradeParticipant(selectedComradeConv);
            const senderName = userProfile?.displayName || currentUser.displayName || 'You';
            const senderAvatar = userProfile?.photoURL || currentUser.photoURL || null;

            await sendCollabMessage({
                conversationId: selectedComradeConv.id,
                senderId: currentUser.uid,
                senderName,
                senderAvatar,
                text,
                recipientId: other.userId || undefined,
            });
        } catch (err) {
            console.error('[SEND_COMRADE_MESSAGE_ERROR]', err);
            setComradeInput(text);
        } finally {
            setSendingComrade(false);
            comradeComposerRef.current?.focus();
        }
    };

    const handleSendCrewMessage = async () => {
        if (!selectedCrewId || !currentUser?.uid) return;
        const text = crewInput.trim();
        if (!text || sendingCrew) return;

        setSendingCrew(true);
        setCrewInput('');
        try {
            const senderName = userProfile?.displayName || currentUser.displayName || 'Crew Member';
            const senderAvatar = userProfile?.photoURL || currentUser.photoURL || null;

            await sendTeamMessage({
                teamId: selectedCrewId,
                senderId: currentUser.uid,
                senderName,
                senderAvatar,
                text,
            });
        } catch (err) {
            console.error('[SEND_CREW_MESSAGE_ERROR]', err);
            setCrewInput(text);
        } finally {
            setSendingCrew(false);
            crewComposerRef.current?.focus();
        }
    };

    // ----------------------------------------------------
    // Start Direct Conversation with a Connection
    // ----------------------------------------------------
    const handleStartDirectChat = async (targetUser: InvoxUser) => {
        if (!currentUser) return;
        try {
            const convId = await getOrCreateDirectConversation({
                currentUser,
                userProfile,
                targetUser: {
                    uid: targetUser.uid,
                    displayName: targetUser.displayName || targetUser.name,
                    username: targetUser.username,
                    photoURL: targetUser.photoURL || targetUser.avatarUrl,
                    headline: targetUser.headline || targetUser.bio,
                },
            });
            setSelectedComradeId(convId);
            setShowNewComradeModal(false);
        } catch (err: any) {
            console.error('[START_DIRECT_CHAT_ERROR]', err);
            alert(err?.message || 'Could not start conversation');
        }
    };

    // ----------------------------------------------------
    // Create Crew Group Action
    // ----------------------------------------------------
    const handleCreateCrew = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser || !newCrewName.trim() || isSubmittingCrew) return;

        setIsSubmittingCrew(true);
        try {
            const selectedMembersList = followedProfiles
                .filter((p) => selectedCrewMemberUids.has(p.uid))
                .map((p) => ({
                    uid: p.uid,
                    displayName: p.displayName || p.name,
                    username: p.username,
                    photoURL: p.photoURL || p.avatarUrl,
                }));

            const createdCrew = await createCrewGroup({
                name: newCrewName.trim(),
                description: newCrewDesc.trim(),
                user: currentUser,
                userProfile,
                initialMemberIds: Array.from(selectedCrewMemberUids),
                initialMembers: selectedMembersList,
            });

            setSelectedCrewId(createdCrew.id);
            setNewCrewName('');
            setNewCrewDesc('');
            setSelectedCrewMemberUids(new Set());
            setShowCreateCrewModal(false);
        } catch (err: any) {
            console.error('[CREATE_CREW_ERROR]', err);
            alert(err?.message || 'Failed to create crew group');
        } finally {
            setIsSubmittingCrew(false);
        }
    };

    // Leave or Disband Crew
    const handleLeaveOrDisbandCrew = async () => {
        if (!activeCrew || !currentUser?.uid) return;
        const isOwner = activeCrew.ownerId === currentUser.uid;
        const confirmMsg = isOwner
            ? `Disband and delete crew "${activeCrew.name}" permanently?`
            : `Are you sure you want to leave crew "${activeCrew.name}"?`;

        if (!window.confirm(confirmMsg)) return;

        try {
            if (isOwner) {
                await deleteTeam(activeCrew.id, currentUser.uid);
            } else {
                await leaveTeam({
                    teamId: activeCrew.id,
                    userId: currentUser.uid,
                    userName: userProfile?.displayName || currentUser.displayName || 'Member',
                });
            }
            setSelectedCrewId(null);
            setShowCrewMembersDrawer(false);
        } catch (err: any) {
            console.error('[LEAVE_CREW_ERROR]', err);
            alert(err?.message || 'Action failed');
        }
    };

    // Add selected member to active crew
    const handleAddMemberToCrew = async (targetUser: InvoxUser) => {
        if (!activeCrew || !currentUser) return;
        try {
            await addMemberToCrew({
                teamId: activeCrew.id,
                user: currentUser,
                newMember: {
                    uid: targetUser.uid,
                    displayName: targetUser.displayName || targetUser.name,
                    username: targetUser.username,
                    photoURL: targetUser.photoURL || targetUser.avatarUrl,
                },
            });
            setShowAddMemberModal(false);
        } catch (err: any) {
            console.error('[ADD_CREW_MEMBER_ERROR]', err);
            alert(err?.message || 'Failed to add member to crew');
        }
    };

    // ----------------------------------------------------
    // Filtered Lists
    // ----------------------------------------------------
    const filteredComrades = useMemo(() => {
        return comradeConvs.filter((convo) => {
            const other = getOtherComradeParticipant(convo);
            const query = comradeSearch.toLowerCase();
            return (
                other.displayName.toLowerCase().includes(query) ||
                (other.username && other.username.toLowerCase().includes(query)) ||
                (convo.lastMessage && convo.lastMessage.toLowerCase().includes(query))
            );
        });
    }, [comradeConvs, comradeSearch, currentUser?.uid]);

    const filteredCrews = useMemo(() => {
        return crews.filter((crew) => {
            const query = crewSearch.toLowerCase();
            return (
                crew.name.toLowerCase().includes(query) ||
                (crew.description && crew.description.toLowerCase().includes(query)) ||
                (crew.lastMessage && crew.lastMessage.toLowerCase().includes(query))
            );
        });
    }, [crews, crewSearch]);

    // In-chat search matching messages for Comrade
    const comradeMatchingMessages = useMemo(() => {
        if (!isComradeSearchOpen || !comradeChatSearchQuery.trim()) return [];
        const q = comradeChatSearchQuery.toLowerCase();
        return comradeMessages.filter((m) => m.text?.toLowerCase().includes(q));
    }, [isComradeSearchOpen, comradeChatSearchQuery, comradeMessages]);

    // In-chat search matching messages for Crew
    const crewMatchingMessages = useMemo(() => {
        if (!isCrewSearchOpen || !crewChatSearchQuery.trim()) return [];
        const q = crewChatSearchQuery.toLowerCase();
        return crewMessages.filter((m) => m.text?.toLowerCase().includes(q));
    }, [isCrewSearchOpen, crewChatSearchQuery, crewMessages]);

    return (
        <div className="font-mono flex flex-col h-[calc(100vh-4.5rem)] md:h-[calc(100vh-5rem)] -mx-4 sm:-mx-6 lg:-mx-8 -mt-4 md:-mt-6 -mb-4 md:-mb-10 bg-[#09090b] text-zinc-100 overflow-hidden">
            {/* Top Primary Tabs Bar: // STREAM | // COMRADES & // CREW */}
            <div className="h-12 border-b border-zinc-800 bg-[#0c0c0e] px-4 sm:px-6 flex items-center justify-between flex-shrink-0 z-20">
                <div className="flex items-center gap-1 sm:gap-2 h-full">
                    <button
                        type="button"
                        onClick={() => {
                            navigate('/hub?tab=stream');
                        }}
                        className="h-full px-2.5 sm:px-3 text-zinc-400 hover:text-white flex items-center gap-1 text-xs font-mono uppercase tracking-wider transition-colors mr-1 sm:mr-2 border-r border-zinc-800 cursor-pointer"
                        title="Back to Hub Stream (Moments & Loops)"
                    >
                        <span>←</span>
                        <span className="hidden sm:inline">// STREAM</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveSection('comrades')}
                        className={`h-full px-3 sm:px-5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 cursor-pointer ${
                            activeSection === 'comrades'
                                ? 'border-white text-white bg-zinc-900/50'
                                : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/20'
                        }`}
                    >
                        <span className="text-[10px] text-zinc-500 font-mono">//</span>
                        <span>COMRADES</span>
                        {comradeConvs.some((c) => getConversationUnreadCount(c, currentUser?.uid) > 0) && (
                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveSection('crew')}
                        className={`h-full px-3 sm:px-5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 cursor-pointer ${
                            activeSection === 'crew'
                                ? 'border-white text-white bg-zinc-900/50'
                                : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/20'
                        }`}
                    >
                        <span className="text-[10px] text-zinc-500 font-mono">//</span>
                        <span>CREW</span>
                        {crews.length > 0 && (
                            <span className="text-[10px] text-zinc-500 font-mono px-1.5 py-0.2 bg-zinc-850">
                                {crews.length}
                            </span>
                        )}
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    {activeSection === 'comrades' ? (
                        <button
                            type="button"
                            onClick={() => setShowNewComradeModal(true)}
                            className="h-8 px-3 bg-white text-black hover:bg-zinc-200 border border-white text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                            title="Start new direct conversation with a connection"
                        >
                            <PlusIcon className="w-3.5 h-3.5 text-black" />
                            <span className="hidden sm:inline">NEW TRANSMISSION</span>
                            <span className="sm:hidden">NEW</span>
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setShowCreateCrewModal(true)}
                            className="h-8 px-3 bg-white text-black hover:bg-zinc-200 border border-white text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                            title="Create a new Crew group"
                        >
                            <PlusIcon className="w-3.5 h-3.5 text-black" />
                            <span className="hidden sm:inline">CREATE CREW</span>
                            <span className="sm:hidden">CREATE</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content Workspace (Split layout) */}
            <div className="flex-1 flex min-h-0 overflow-hidden relative">
                {/* ---------------------------------------------------- */}
                {/* SUBSECTION 1: COMRADES (1-on-1 Direct Messaging)     */}
                {/* ---------------------------------------------------- */}
                {activeSection === 'comrades' && (
                    <>
                        {/* LEFT SIDEBAR: Comrade Conversations List */}
                        <aside
                            className={`w-full md:w-80 lg:w-96 flex flex-col border-r border-zinc-800 bg-[#0c0d10] flex-shrink-0 ${
                                selectedComradeId ? 'hidden md:flex' : 'flex'
                            }`}
                        >
                            <SearchInput
                                value={comradeSearch}
                                onChange={setComradeSearch}
                                placeholder="Search comrades..."
                            />

                            <div className="flex-1 overflow-y-auto divide-y divide-zinc-850/60 no-scrollbar">
                                {loadingComrades ? (
                                    <div className="p-8 text-center">
                                        <div className="w-5 h-5 border-2 border-zinc-600 border-t-white rounded-full animate-spin mx-auto mb-2" />
                                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest block">
                                            // CONNECTING NODES...
                                        </span>
                                    </div>
                                ) : filteredComrades.length === 0 ? (
                                    <div className="p-8 text-center space-y-3">
                                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">
                                            // NO TRANSMISSIONS
                                        </span>
                                        <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
                                            {comradeSearch
                                                ? 'No conversations match your search filter.'
                                                : 'Connect and exchange transmissions with individual comrades.'}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => setShowNewComradeModal(true)}
                                            className="px-3.5 py-1.5 bg-white text-black text-xs font-bold uppercase tracking-wider hover:bg-zinc-200 transition-colors cursor-pointer"
                                        >
                                            + Transmit Signal
                                        </button>
                                    </div>
                                ) : (
                                    filteredComrades.map((convo) => {
                                        const other = getOtherComradeParticipant(convo);
                                        const isSelected = selectedComradeId === convo.id;
                                        const unreadCount = getConversationUnreadCount(convo, currentUser?.uid);
                                        const timestampStr = formatTimestamp(convo.lastMessageTimestamp || convo.updatedAt);

                                        return (
                                            <ConversationCard
                                                key={convo.id}
                                                data={{
                                                    id: convo.id,
                                                    name: other.displayName,
                                                    avatarUrl: other.photoURL,
                                                    isTeam: false,
                                                    lastMessage: convo.lastMessage,
                                                    lastMessageSender:
                                                        convo.lastSenderId === currentUser?.uid ? 'You' : undefined,
                                                    timestampStr,
                                                    unreadCount,
                                                    isSelected,
                                                    subtitle: other.username ? `@${other.username}` : '// Comrade',
                                                }}
                                                onClick={() => {
                                                    setSelectedComradeId(convo.id);
                                                    if (currentUser?.uid && unreadCount > 0) {
                                                        markConversationAsRead(convo.id, currentUser.uid);
                                                    }
                                                }}
                                            />
                                        );
                                    })
                                )}
                            </div>
                        </aside>

                        {/* RIGHT MAIN PANEL: Active Comrade Chat Timeline */}
                        <main
                            className={`flex-1 min-w-0 flex flex-col bg-[#08080a] overflow-hidden relative h-full ${
                                !selectedComradeId ? 'hidden md:flex' : 'flex'
                            }`}
                        >
                            {selectedComradeConv ? (
                                <>
                                    {/* Active Chat Header */}
                                    {(() => {
                                        const other = getOtherComradeParticipant(selectedComradeConv);
                                        return (
                                            <ChatHeader
                                                title={other.displayName}
                                                subtitle={other.username ? `@${other.username} • Comrade` : '// Comrade'}
                                                avatarUrl={other.photoURL}
                                                isTeam={false}
                                                onBackMobile={() => setSelectedComradeId(null)}
                                            >
                                                {/* AI Summary Action Button */}
                                                <button
                                                    type="button"
                                                    onClick={() => setShowComradeSummaryModal(true)}
                                                    className="h-8 px-2 sm:px-2.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-850 text-zinc-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-mono flex-shrink-0 cursor-pointer"
                                                    title="Generate AI summary of this conversation"
                                                >
                                                    <SparklesIcon className="w-3.5 h-3.5 text-zinc-300" />
                                                    <span className="hidden sm:inline text-[10px] font-bold tracking-wider uppercase">
                                                        // AI SUMMARY
                                                    </span>
                                                </button>

                                                {/* In-chat search toggle */}
                                                <button
                                                    type="button"
                                                    onClick={() => setIsComradeSearchOpen((prev) => !prev)}
                                                    className={`h-8 w-8 border transition-colors cursor-pointer flex items-center justify-center text-xs ${
                                                        isComradeSearchOpen
                                                            ? 'bg-zinc-800 border-zinc-600 text-white'
                                                            : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white'
                                                    }`}
                                                    title="Search messages in conversation"
                                                >
                                                    <MagnifyingGlassIcon className="w-3.5 h-3.5" />
                                                </button>

                                                {/* View Profile */}
                                                {other.userId && (
                                                    <button
                                                        type="button"
                                                        onClick={() => navigate(`/profile/${other.userId}`)}
                                                        className="h-8 px-2 sm:px-2.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-850 text-zinc-300 hover:text-white transition-colors flex items-center gap-1 text-xs cursor-pointer"
                                                        title="View Comrade Profile"
                                                    >
                                                        <span className="hidden lg:inline text-[10px] uppercase font-bold">PROFILE</span>
                                                        <ArrowUpRightIcon className="w-3 h-3 text-zinc-400" />
                                                    </button>
                                                )}
                                            </ChatHeader>
                                        );
                                    })()}

                                    {/* In-chat Search Bar */}
                                    <ConversationSearchBar
                                        isOpen={isComradeSearchOpen}
                                        searchQuery={comradeChatSearchQuery}
                                        onQueryChange={setComradeChatSearchQuery}
                                        onClose={() => {
                                            setIsComradeSearchOpen(false);
                                            setComradeChatSearchQuery('');
                                        }}
                                        totalMatches={comradeMatchingMessages.length}
                                        currentMatchIndex={comradeMatchIndex}
                                        onPrevMatch={() =>
                                            setComradeMatchIndex((prev) =>
                                                prev > 0 ? prev - 1 : Math.max(0, comradeMatchingMessages.length - 1)
                                            )
                                        }
                                        onNextMatch={() =>
                                            setComradeMatchIndex((prev) =>
                                                prev < comradeMatchingMessages.length - 1 ? prev + 1 : 0
                                            )
                                        }
                                        placeholder="Search in this direct message..."
                                    />

                                    {/* Message Timeline */}
                                    <div
                                        ref={comradeTimelineRef}
                                        className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 min-h-0 relative no-scrollbar"
                                    >
                                        {loadingComradeMsgs ? (
                                            <div className="py-12 text-center my-auto">
                                                <div className="w-5 h-5 border-2 border-zinc-600 border-t-white rounded-full animate-spin mx-auto mb-2" />
                                                <p className="text-[10px] text-zinc-500 uppercase tracking-wider">
                                                    // RETRIEVING MESSAGES...
                                                </p>
                                            </div>
                                        ) : comradeMessages.length === 0 ? (
                                            <EmptyMessagingState
                                                title="// TRANSMISSION READY"
                                                description="Say hello and initiate communications with your comrade below."
                                            />
                                        ) : (
                                            comradeMessages.map((msg, idx) => {
                                                const isMe = msg.senderId === currentUser?.uid;
                                                const timeStr = formatTimestamp(msg.createdAt);
                                                const prevMsg = comradeMessages[idx - 1];
                                                const showDateSeparator =
                                                    !prevMsg ||
                                                    formatDaySeparator(prevMsg.createdAt) !== formatDaySeparator(msg.createdAt);

                                                return (
                                                    <React.Fragment key={msg.id}>
                                                        {showDateSeparator && (
                                                            <div className="flex items-center justify-center my-4">
                                                                <span className="text-[9px] font-mono text-zinc-500 bg-zinc-900 border border-zinc-800 px-2 py-0.5 tracking-widest uppercase">
                                                                    {formatDaySeparator(msg.createdAt)}
                                                                </span>
                                                            </div>
                                                        )}
                                                        <div
                                                            className={`flex flex-col ${
                                                                isMe ? 'items-end' : 'items-start'
                                                            }`}
                                                        >
                                                            {!isMe && msg.senderName && (
                                                                <span className="text-[10px] text-zinc-400 mb-1 px-1 font-semibold font-mono tracking-wide">
                                                                    {msg.senderName}
                                                                </span>
                                                            )}
                                                            <div
                                                                className={`max-w-[85%] sm:max-w-[70%] px-3.5 py-2.5 text-xs border shadow-sm ${
                                                                    isMe
                                                                        ? 'bg-zinc-850 border-zinc-750 text-zinc-100'
                                                                        : 'bg-[#131317] border-zinc-800 text-zinc-200'
                                                                }`}
                                                            >
                                                                <div className="whitespace-pre-wrap break-words leading-relaxed font-mono">
                                                                    <ClickableMessageText
                                                                        text={msg.text}
                                                                        isSender={isMe}
                                                                        timestamp={timeStr}
                                                                        searchTerm={
                                                                            isComradeSearchOpen
                                                                                ? comradeChatSearchQuery
                                                                                : undefined
                                                                        }
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
                                                    </React.Fragment>
                                                );
                                            })
                                        )}
                                    </div>

                                    {/* Bottom Message Composer */}
                                    <MessageComposer
                                        value={comradeInput}
                                        onChange={setComradeInput}
                                        onSend={handleSendComradeMessage}
                                        placeholder="// TRANSMIT MESSAGE TO COMRADE..."
                                        disabled={loadingComradeMsgs}
                                        isSending={sendingComrade}
                                        textareaRef={comradeComposerRef}
                                    />
                                </>
                            ) : (
                                <div className="flex-1 flex items-center justify-center p-8 text-center">
                                    <EmptyMessagingState
                                        title="// SELECT COMRADE"
                                        description="Choose a direct communication stream from the sidebar or start a new transmission."
                                        actionLabel="+ New Transmission"
                                        onAction={() => setShowNewComradeModal(true)}
                                    />
                                </div>
                            )}
                        </main>
                    </>
                )}

                {/* ---------------------------------------------------- */}
                {/* SUBSECTION 2: CREW (Group Messaging)                */}
                {/* ---------------------------------------------------- */}
                {activeSection === 'crew' && (
                    <>
                        {/* LEFT SIDEBAR: Crew Groups List */}
                        <aside
                            className={`w-full md:w-80 lg:w-96 flex flex-col border-r border-zinc-800 bg-[#0c0d10] flex-shrink-0 ${
                                selectedCrewId ? 'hidden md:flex' : 'flex'
                            }`}
                        >
                            <SearchInput
                                value={crewSearch}
                                onChange={setCrewSearch}
                                placeholder="Search crew groups..."
                            />

                            <div className="flex-1 overflow-y-auto divide-y divide-zinc-850/60 no-scrollbar">
                                {loadingCrews ? (
                                    <div className="p-8 text-center">
                                        <div className="w-5 h-5 border-2 border-zinc-600 border-t-white rounded-full animate-spin mx-auto mb-2" />
                                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest block">
                                            // ASSEMBLING CREW SQUADS...
                                        </span>
                                    </div>
                                ) : filteredCrews.length === 0 ? (
                                    <div className="p-8 text-center space-y-3">
                                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">
                                            // NO CREW CHANNELS
                                        </span>
                                        <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
                                            {crewSearch
                                                ? 'No crew groups match your search filter.'
                                                : 'Collaborate with multiple comrades in shared Crew groups.'}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => setShowCreateCrewModal(true)}
                                            className="px-3.5 py-1.5 bg-white text-black text-xs font-bold uppercase tracking-wider hover:bg-zinc-200 transition-colors cursor-pointer"
                                        >
                                            + Form Crew
                                        </button>
                                    </div>
                                ) : (
                                    filteredCrews.map((crew) => {
                                        const isSelected = selectedCrewId === crew.id;
                                        const timestampStr = formatTimestamp(
                                            crew.lastMessageTimestamp || crew.updatedAt
                                        );

                                        return (
                                            <ConversationCard
                                                key={crew.id}
                                                data={{
                                                    id: crew.id,
                                                    name: crew.name,
                                                    avatarUrl: crew.ownerAvatar || null,
                                                    isTeam: true,
                                                    lastMessage: crew.lastMessage,
                                                    lastMessageSender: crew.lastMessageSenderName,
                                                    timestampStr,
                                                    unreadCount: 0,
                                                    isSelected,
                                                    subtitle: `${crew.memberCount || crew.memberIds?.length || 1} members • // Crew`,
                                                }}
                                                onClick={() => {
                                                    setSelectedCrewId(crew.id);
                                                }}
                                            />
                                        );
                                    })
                                )}
                            </div>
                        </aside>

                        {/* RIGHT MAIN PANEL: Active Crew Chat Timeline */}
                        <main
                            className={`flex-1 min-w-0 flex flex-col bg-[#08080a] overflow-hidden relative h-full ${
                                !selectedCrewId ? 'hidden md:flex' : 'flex'
                            }`}
                        >
                            {activeCrew ? (
                                <>
                                    {/* Active Crew Header */}
                                    <ChatHeader
                                        title={activeCrew.name}
                                        subtitle={`${activeCrew.memberCount || crewMembers.length || 1} members • // Crew`}
                                        avatarUrl={activeCrew.ownerAvatar}
                                        isTeam={true}
                                        onBackMobile={() => setSelectedCrewId(null)}
                                    >
                                        {/* AI Summary Action Button */}
                                        <button
                                            type="button"
                                            onClick={() => setShowCrewSummaryModal(true)}
                                            className="h-8 px-2 sm:px-2.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-850 text-zinc-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-mono flex-shrink-0 cursor-pointer"
                                            title="Generate AI summary of this crew conversation"
                                        >
                                            <SparklesIcon className="w-3.5 h-3.5 text-zinc-300" />
                                            <span className="hidden sm:inline text-[10px] font-bold tracking-wider uppercase">
                                                // AI SUMMARY
                                            </span>
                                        </button>

                                        {/* In-chat search toggle */}
                                        <button
                                            type="button"
                                            onClick={() => setIsCrewSearchOpen((prev) => !prev)}
                                            className={`h-8 w-8 border transition-colors cursor-pointer flex items-center justify-center text-xs ${
                                                isCrewSearchOpen
                                                    ? 'bg-zinc-800 border-zinc-600 text-white'
                                                    : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white'
                                            }`}
                                            title="Search messages in crew conversation"
                                        >
                                            <MagnifyingGlassIcon className="w-3.5 h-3.5" />
                                        </button>

                                        {/* Crew Members Drawer Toggle */}
                                        <button
                                            type="button"
                                            onClick={() => setShowCrewMembersDrawer((prev) => !prev)}
                                            className={`h-8 px-2 sm:px-2.5 border transition-colors flex items-center gap-1.5 text-xs cursor-pointer ${
                                                showCrewMembersDrawer
                                                    ? 'bg-zinc-800 border-zinc-600 text-white'
                                                    : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white'
                                            }`}
                                            title="View and manage Crew participants"
                                        >
                                            <UsersIcon className="w-3.5 h-3.5" />
                                            <span className="hidden lg:inline text-[10px] uppercase font-bold">
                                                ROSTER ({crewMembers.length || activeCrew.memberCount || 1})
                                            </span>
                                        </button>
                                    </ChatHeader>

                                    {/* In-chat Search Bar */}
                                    <ConversationSearchBar
                                        isOpen={isCrewSearchOpen}
                                        searchQuery={crewChatSearchQuery}
                                        onQueryChange={setCrewChatSearchQuery}
                                        onClose={() => {
                                            setIsCrewSearchOpen(false);
                                            setCrewChatSearchQuery('');
                                        }}
                                        totalMatches={crewMatchingMessages.length}
                                        currentMatchIndex={crewMatchIndex}
                                        onPrevMatch={() =>
                                            setCrewMatchIndex((prev) =>
                                                prev > 0 ? prev - 1 : Math.max(0, crewMatchingMessages.length - 1)
                                            )
                                        }
                                        onNextMatch={() =>
                                            setCrewMatchIndex((prev) =>
                                                prev < crewMatchingMessages.length - 1 ? prev + 1 : 0
                                            )
                                        }
                                        placeholder="Search in this crew thread..."
                                    />

                                    {/* Crew Messages Timeline & Members Drawer */}
                                    <div className="flex-1 flex min-h-0 overflow-hidden relative">
                                        <div
                                            ref={crewTimelineRef}
                                            className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 min-h-0 relative no-scrollbar"
                                        >
                                            {loadingCrewMsgs ? (
                                                <div className="py-12 text-center my-auto">
                                                    <div className="w-5 h-5 border-2 border-zinc-600 border-t-white rounded-full animate-spin mx-auto mb-2" />
                                                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">
                                                        // RETRIEVING CREW TRANSMISSIONS...
                                                    </p>
                                                </div>
                                            ) : crewMessages.length === 0 ? (
                                                <EmptyMessagingState
                                                    title="// CREW ESTABLISHED"
                                                    description="Broadcast a message to your squad members below."
                                                />
                                            ) : (
                                                crewMessages.map((msg, idx) => {
                                                    const isMe = msg.senderId === currentUser?.uid;
                                                    const timeStr = formatTimestamp(msg.createdAt);
                                                    const prevMsg = crewMessages[idx - 1];
                                                    const showDateSeparator =
                                                        !prevMsg ||
                                                        formatDaySeparator(prevMsg.createdAt) !== formatDaySeparator(msg.createdAt);

                                                    return (
                                                        <React.Fragment key={msg.id}>
                                                            {showDateSeparator && (
                                                                <div className="flex items-center justify-center my-4">
                                                                    <span className="text-[9px] font-mono text-zinc-500 bg-zinc-900 border border-zinc-800 px-2 py-0.5 tracking-widest uppercase">
                                                                        {formatDaySeparator(msg.createdAt)}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            <div
                                                                className={`flex flex-col ${
                                                                    isMe ? 'items-end' : 'items-start'
                                                                }`}
                                                            >
                                                                {!isMe && (
                                                                    <div className="flex items-center gap-1.5 mb-1 px-1">
                                                                        {msg.senderAvatar ? (
                                                                            <img
                                                                                src={msg.senderAvatar}
                                                                                alt={msg.senderName}
                                                                                onError={handleImageError}
                                                                                className="w-4 h-4 object-cover border border-zinc-700"
                                                                            />
                                                                        ) : (
                                                                            <div className="w-4 h-4 bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[9px] font-bold text-zinc-300">
                                                                                {msg.senderName?.charAt(0) || '?'}
                                                                            </div>
                                                                        )}
                                                                        <span className="text-[10px] text-zinc-400 font-semibold font-mono tracking-wide">
                                                                            {msg.senderName}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                <div
                                                                    className={`max-w-[85%] sm:max-w-[70%] px-3.5 py-2.5 text-xs border shadow-sm ${
                                                                        isMe
                                                                            ? 'bg-zinc-850 border-zinc-750 text-zinc-100'
                                                                            : 'bg-[#131317] border-zinc-800 text-zinc-200'
                                                                    }`}
                                                                >
                                                                    <div className="whitespace-pre-wrap break-words leading-relaxed font-mono">
                                                                        <ClickableMessageText
                                                                            text={msg.text}
                                                                            isSender={isMe}
                                                                            timestamp={timeStr}
                                                                            searchTerm={
                                                                                isCrewSearchOpen
                                                                                    ? crewChatSearchQuery
                                                                                    : undefined
                                                                        }
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
                                                    </React.Fragment>
                                                );
                                            })
                                        )}
                                    </div>

                                    {/* Slide-out / Side Crew Members Drawer */}
                                    {showCrewMembersDrawer && (
                                        <div className="w-72 border-l border-zinc-800 bg-[#0c0c0e] flex flex-col flex-shrink-0 z-20">
                                            <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
                                                <div className="flex items-center gap-1.5">
                                                    <UsersIcon className="w-3.5 h-3.5 text-zinc-400" />
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-white">
                                                        CREW ROSTER
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowCrewMembersDrawer(false)}
                                                    className="p-1 text-zinc-500 hover:text-white"
                                                    title="Close roster"
                                                >
                                                    <CloseIcon className="w-3.5 h-3.5" />
                                                </button>
                                            </div>

                                            {/* Roster Actions */}
                                            <div className="p-2.5 border-b border-zinc-800 bg-zinc-950/40">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowAddMemberModal(true)}
                                                    className="w-full py-1.5 px-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
                                                >
                                                    <PlusIcon className="w-3 h-3" />
                                                    <span>Add Comrade</span>
                                                </button>
                                            </div>

                                            {/* Members List */}
                                            <div className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-zinc-900">
                                                {crewMembers.map((member) => (
                                                    <div
                                                        key={member.id}
                                                        className="p-2 flex items-center justify-between gap-2 hover:bg-zinc-900/50 transition-colors"
                                                    >
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <div className="w-7 h-7 bg-zinc-900 border border-zinc-800 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                                                {member.photoURL ? (
                                                                    <img
                                                                        src={member.photoURL}
                                                                        alt={member.displayName}
                                                                        onError={handleImageError}
                                                                        className="w-full h-full object-cover"
                                                                    />
                                                                ) : (
                                                                    <span className="text-[10px] text-zinc-400">
                                                                        {member.displayName.charAt(0)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="text-xs font-bold text-white truncate">
                                                                    {member.displayName}
                                                                </div>
                                                                <div className="text-[10px] text-zinc-500 truncate">
                                                                    {member.role === 'owner' ? (
                                                                        <span className="text-emerald-400 font-bold uppercase">
                                                                            // CREW LEAD
                                                                        </span>
                                                                    ) : (
                                                                        'MEMBER'
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {member.userId && (
                                                            <button
                                                                type="button"
                                                                onClick={() => navigate(`/profile/${member.userId}`)}
                                                                className="text-zinc-500 hover:text-white p-1"
                                                                title="View profile"
                                                            >
                                                                <ArrowUpRightIcon className="w-3 h-3" />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Disband or Leave Squad */}
                                            <div className="p-3 border-t border-zinc-800 bg-zinc-950/60">
                                                <button
                                                    type="button"
                                                    onClick={handleLeaveOrDisbandCrew}
                                                    className="w-full py-1.5 px-3 border border-red-900/60 hover:border-red-600 bg-red-950/20 hover:bg-red-950/50 text-red-400 text-xs uppercase tracking-wider font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                                >
                                                    {activeCrew.ownerId === currentUser?.uid ? (
                                                        <>
                                                            <TrashIcon className="w-3 h-3" />
                                                            <span>Disband Crew</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <LogoutIcon className="w-3 h-3" />
                                                            <span>Leave Crew</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Bottom Message Composer */}
                                <MessageComposer
                                    value={crewInput}
                                    onChange={setCrewInput}
                                    onSend={handleSendCrewMessage}
                                    placeholder="// BROADCAST TO CREW SQUAD..."
                                    disabled={loadingCrewMsgs}
                                    isSending={sendingCrew}
                                    textareaRef={crewComposerRef}
                                />
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center p-8 text-center">
                                <EmptyMessagingState
                                    title="// SELECT CREW"
                                    description="Choose a crew group channel from the left sidebar or form a new squad."
                                    actionLabel="+ Create Crew"
                                    onAction={() => setShowCreateCrewModal(true)}
                                />
                            </div>
                        )}
                    </main>
                </>
            )}
        </div>

        {/* ---------------------------------------------------- */}
        {/* MODAL 1: New Comrade Transmission Modal              */}
        {/* ---------------------------------------------------- */}
        {showNewComradeModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                <div className="bg-[#0c0c0e] border border-zinc-800 w-full max-w-md flex flex-col max-h-[85vh] shadow-2xl">
                    <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                        <div>
                            <span className="text-[10px] text-zinc-500 uppercase tracking-widest block font-bold">
                                // DIRECT TRANSMISSION
                            </span>
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                                Select Comrade Node
                            </h3>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowNewComradeModal(false)}
                            className="p-1 text-zinc-400 hover:text-white"
                        >
                            <CloseIcon className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="p-3 border-b border-zinc-800 bg-[#09090b]">
                        <input
                            type="text"
                            value={newComradeFilter}
                            onChange={(e) => setNewComradeFilter(e.target.value)}
                            placeholder="FILTER_CONNECTIONS..."
                            className="w-full bg-[#121315] border border-zinc-750 p-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-white font-mono"
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-zinc-900 no-scrollbar">
                        {followedProfiles.length === 0 ? (
                            <div className="p-6 text-center text-zinc-500 text-xs">
                                // NO CONNECTED COMRADES FOUND
                                <p className="text-[11px] text-zinc-400 mt-1">
                                    Follow other creator nodes across Invox to open direct communications.
                                </p>
                            </div>
                        ) : (
                            followedProfiles
                                .filter((p) => {
                                    const q = newComradeFilter.toLowerCase();
                                    const name = (p.displayName || p.name || '').toLowerCase();
                                    const u = (p.username || '').toLowerCase();
                                    return name.includes(q) || u.includes(q);
                                })
                                .map((profile) => (
                                    <button
                                        key={profile.uid}
                                        type="button"
                                        onClick={() => handleStartDirectChat(profile)}
                                        className="w-full text-left p-2.5 flex items-center justify-between gap-3 hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition-colors cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-8 h-8 bg-zinc-900 border border-zinc-800 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                                {profile.photoURL || profile.avatarUrl ? (
                                                    <img
                                                        src={profile.photoURL || profile.avatarUrl}
                                                        alt={profile.displayName}
                                                        onError={handleImageError}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <span className="text-xs text-zinc-400 font-bold">
                                                        {(profile.displayName || profile.name || '?').charAt(0)}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-xs font-bold text-white truncate">
                                                    {profile.displayName || profile.name}
                                                </div>
                                                <div className="text-[10px] text-zinc-500 truncate">
                                                    {profile.username ? `@${profile.username}` : '// Connected Node'}
                                                </div>
                                            </div>
                                        </div>
                                        <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider px-2 py-1 bg-zinc-850 border border-zinc-750">
                                            TRANSMIT →
                                        </span>
                                    </button>
                                ))
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* MODAL 2: Create Crew Group Modal                     */}
        {/* ---------------------------------------------------- */}
        {showCreateCrewModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                <form
                    onSubmit={handleCreateCrew}
                    className="bg-[#0c0c0e] border border-zinc-800 w-full max-w-lg flex flex-col max-h-[90vh] shadow-2xl"
                >
                    <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                        <div>
                            <span className="text-[10px] text-zinc-500 uppercase tracking-widest block font-bold">
                                // SQUAD INITIATIVE
                            </span>
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                                Form New Crew Group
                            </h3>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowCreateCrewModal(false)}
                            className="p-1 text-zinc-400 hover:text-white"
                        >
                            <CloseIcon className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="p-5 space-y-4 overflow-y-auto no-scrollbar">
                        <div>
                            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                                CREW NAME *
                            </label>
                            <input
                                type="text"
                                required
                                value={newCrewName}
                                onChange={(e) => setNewCrewName(e.target.value)}
                                placeholder="e.g. Phoenix Collective, Audio Engineers, Core Squad"
                                className="w-full bg-[#121315] border border-zinc-750 p-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-white font-mono"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                                PURPOSE / DESCRIPTION
                            </label>
                            <textarea
                                rows={2}
                                value={newCrewDesc}
                                onChange={(e) => setNewCrewDesc(e.target.value)}
                                placeholder="Brief summary of this crew's mission and ongoing dialogues..."
                                className="w-full bg-[#121315] border border-zinc-750 p-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-white font-mono resize-none"
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                    SELECT COMRADES TO INVITE ({selectedCrewMemberUids.size})
                                </label>
                            </div>

                            <div className="max-h-48 overflow-y-auto border border-zinc-800 bg-[#09090b] p-2 space-y-1 divide-y divide-zinc-900 no-scrollbar">
                                {followedProfiles.length === 0 ? (
                                    <div className="p-4 text-center text-zinc-500 text-xs">
                                        No connections found. You can create the crew now and invite members later.
                                    </div>
                                ) : (
                                    followedProfiles.map((profile) => {
                                        const isSelected = selectedCrewMemberUids.has(profile.uid);
                                        return (
                                            <button
                                                key={profile.uid}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedCrewMemberUids((prev) => {
                                                        const next = new Set(prev);
                                                        if (next.has(profile.uid)) next.delete(profile.uid);
                                                        else next.add(profile.uid);
                                                        return next;
                                                    });
                                                }}
                                                className={`w-full text-left p-2 flex items-center justify-between transition-colors cursor-pointer ${
                                                    isSelected ? 'bg-zinc-850 text-white' : 'hover:bg-zinc-900/60 text-zinc-300'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <div className="w-6 h-6 bg-zinc-900 border border-zinc-800 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                                        {profile.photoURL || profile.avatarUrl ? (
                                                            <img
                                                                src={profile.photoURL || profile.avatarUrl}
                                                                alt={profile.displayName}
                                                                onError={handleImageError}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        ) : (
                                                            <span className="text-[10px] text-zinc-400 font-bold">
                                                                {(profile.displayName || profile.name || '?').charAt(0)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="text-xs font-bold truncate">
                                                            {profile.displayName || profile.name}
                                                        </div>
                                                        <div className="text-[9px] text-zinc-500 truncate">
                                                            {profile.username ? `@${profile.username}` : ''}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div
                                                    className={`w-4 h-4 border flex items-center justify-center ${
                                                        isSelected
                                                            ? 'bg-white border-white text-black'
                                                            : 'border-zinc-700 bg-black'
                                                    }`}
                                                >
                                                    {isSelected && <CheckIcon className="w-3 h-3 text-black" />}
                                                </div>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="p-4 border-t border-zinc-800 bg-[#09090b] flex items-center justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => setShowCreateCrewModal(false)}
                            className="px-4 py-2 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white text-xs uppercase tracking-wider transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!newCrewName.trim() || isSubmittingCrew}
                            className="px-5 py-2 bg-white text-black hover:bg-zinc-200 text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-2"
                        >
                            {isSubmittingCrew ? (
                                <>
                                    <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                    <span>CREATING...</span>
                                </>
                            ) : (
                                <span>INITIALIZE CREW</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* MODAL 3: Add Member to Active Crew Modal             */}
        {/* ---------------------------------------------------- */}
        {showAddMemberModal && activeCrew && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                <div className="bg-[#0c0c0e] border border-zinc-800 w-full max-w-md flex flex-col max-h-[85vh] shadow-2xl">
                    <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                        <div>
                            <span className="text-[10px] text-zinc-500 uppercase tracking-widest block font-bold">
                                // CREW RECRUITMENT
                            </span>
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                                Add Comrade to {activeCrew.name}
                            </h3>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowAddMemberModal(false)}
                            className="p-1 text-zinc-400 hover:text-white"
                        >
                            <CloseIcon className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-zinc-900 no-scrollbar">
                        {followedProfiles.filter(
                            (p) => !activeCrew.memberIds?.includes(p.uid) && p.uid !== currentUser?.uid
                        ).length === 0 ? (
                            <div className="p-6 text-center text-zinc-500 text-xs">
                                All your connected comrades are already in this crew squad.
                            </div>
                        ) : (
                            followedProfiles
                                .filter(
                                    (p) => !activeCrew.memberIds?.includes(p.uid) && p.uid !== currentUser?.uid
                                )
                                .map((profile) => (
                                    <button
                                        key={profile.uid}
                                        type="button"
                                        onClick={() => handleAddMemberToCrew(profile)}
                                        className="w-full text-left p-2.5 flex items-center justify-between gap-3 hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition-colors cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-7 h-7 bg-zinc-900 border border-zinc-800 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                                {profile.photoURL || profile.avatarUrl ? (
                                                    <img
                                                        src={profile.photoURL || profile.avatarUrl}
                                                        alt={profile.displayName}
                                                        onError={handleImageError}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <span className="text-xs text-zinc-400 font-bold">
                                                        {(profile.displayName || profile.name || '?').charAt(0)}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-xs font-bold text-white truncate">
                                                    {profile.displayName || profile.name}
                                                </div>
                                                <div className="text-[10px] text-zinc-500 truncate">
                                                    {profile.username ? `@${profile.username}` : ''}
                                                </div>
                                            </div>
                                        </div>
                                        <span className="text-[10px] text-zinc-300 font-bold uppercase tracking-wider px-2 py-1 bg-zinc-850 border border-zinc-750">
                                            + ADD
                                        </span>
                                    </button>
                                ))
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* AI SUMMARY MODAL FOR COMRADE                         */}
        {/* ---------------------------------------------------- */}
        {showComradeSummaryModal && selectedComradeConv && (
            <ConversationSummaryModal
                isOpen={showComradeSummaryModal}
                onClose={() => setShowComradeSummaryModal(false)}
                conversationId={selectedComradeConv.id}
                conversationTitle={getOtherComradeParticipant(selectedComradeConv).displayName}
                conversationType="inbox"
                messages={comradeMessages}
                currentUser={currentUser}
            />
        )}

        {/* ---------------------------------------------------- */}
        {/* AI SUMMARY MODAL FOR CREW                            */}
        {/* ---------------------------------------------------- */}
        {showCrewSummaryModal && activeCrew && (
            <ConversationSummaryModal
                isOpen={showCrewSummaryModal}
                onClose={() => setShowCrewSummaryModal(false)}
                conversationId={activeCrew.id}
                conversationTitle={activeCrew.name}
                conversationType="team"
                messages={crewMessages}
                currentUser={currentUser}
            />
        )}
    </div>
);
};

export default HubConversationsView;
