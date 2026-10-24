import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
    subscribeToHubComradeConversations,
    subscribeToUserConversations,
    subscribeToConversationMessages,
    sendCollabMessage,
    updateCollabMessage,
    deleteCollabMessage,
    markConversationAsRead,
    getConversationUnreadCount,
    getOrCreateDirectConversation,
    type CollabConversation,
    type CollabChatMessage,
} from '../../services/collabMessageService';
import {
    subscribeToHubCrews,
    subscribeToUserTeams,
    subscribeToTeam,
    getTeam,
    subscribeToTeamMembers,
    subscribeToTeamMessages,
    sendTeamMessage,
    updateTeamMessage,
    deleteTeamMessage,
    updateCrewDetails,
    getOrCreateCrewInviteToken,
    regenerateCrewInvitation,
    revokeTeamInvitation,
    getTeamInvitation,
    subscribeToTeamInvitations,
    updateTeamJoinPolicy,
    createTeamJoinRequest,
    getTeamJoinRequest,
    subscribeToTeamJoinRequests,
    approveTeamJoinRequest,
    rejectTeamJoinRequest,
    joinTeamViaInvitation,
    markTeamAsRead,
    createCrewGroup,
    addMemberToCrew,
    leaveTeam,
    deleteTeam,
    type Team,
    type TeamMember,
    type TeamMessage,
    type TeamInvitation,
    type TeamJoinPolicy,
    type TeamJoinRequest,
} from '../../services/teamService';
import { 
    subscribeFollowedProfiles,
    isUserAcceptedConnection,
    subscribeAcceptedConnectionUserIds
} from '../../services/connectionService';
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
    EllipsisVerticalIcon,
    PaperClipIcon,
    ShieldCheckIcon,
    ChatBubbleBottomCenterTextIcon,
    InformationCircleIcon,
    CogIcon,
    PencilSquareIcon,
    ClipboardIcon,
    ClockIcon,
    LinkIcon,
    RegenerateIcon,
    CheckCircleIcon,
    XCircleIcon,
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
import { getCrewInvitationUrl } from '../../utils/urlUtils';

export interface HubConversationsViewProps {
    initialSection?: 'comrades' | 'crew';
    activeSection?: 'comrades' | 'crew';
    onSectionChange?: (section: 'comrades' | 'crew') => void;
    onBack?: () => void;
}

export const HubConversationsView: React.FC<HubConversationsViewProps> = ({
    initialSection = 'comrades',
    activeSection: controlledSection,
    onSectionChange,
    onBack,
}) => {
    const { currentUser, userProfile } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // Primary subsections: // COMRADES or // CREW
    const [internalSection, setInternalSection] = useState<'comrades' | 'crew'>(initialSection);
    const activeSection = controlledSection || internalSection;

    useEffect(() => {
        if (controlledSection && controlledSection !== internalSection) {
            setInternalSection(controlledSection);
        }
    }, [controlledSection]);

    const handleSwitchSection = (sec: 'comrades' | 'crew') => {
        setInternalSection(sec);
        if (onSectionChange) onSectionChange(sec);
    };

    // Followed connections / comrades for starting new chats or inviting to crew
    const [followedProfiles, setFollowedProfiles] = useState<InvoxUser[]>([]);
    const [acceptedConnectionIds, setAcceptedConnectionIds] = useState<Set<string>>(new Set());

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

    // Message Actions (Editing & Deletion) for Crew
    const [editingCrewMsgId, setEditingCrewMsgId] = useState<string | null>(null);
    const [editingCrewMsgText, setEditingCrewMsgText] = useState<string>('');
    const [isSavingMsgEdit, setIsSavingMsgEdit] = useState<boolean>(false);
    const [crewMsgEditError, setCrewMsgEditError] = useState<string | null>(null);
    const [activeMsgMenuId, setActiveMsgMenuId] = useState<string | null>(null);
    const activeMsgMenuRef = useRef<HTMLDivElement>(null);
    const [crewMsgToDelete, setCrewMsgToDelete] = useState<TeamMessage | null>(null);
    const [isDeletingMsg, setIsDeletingMsg] = useState<boolean>(false);
    const [deleteMsgError, setDeleteMsgError] = useState<string | null>(null);

    // Message Actions (Editing & Deletion) for Comrade
    const [editingComradeMsgId, setEditingComradeMsgId] = useState<string | null>(null);
    const [editingComradeMsgText, setEditingComradeMsgText] = useState<string>('');
    const [isSavingComradeMsgEdit, setIsSavingComradeMsgEdit] = useState<boolean>(false);
    const [comradeMsgEditError, setComradeMsgEditError] = useState<string | null>(null);
    const [activeComradeMsgMenuId, setActiveComradeMsgMenuId] = useState<string | null>(null);
    const activeComradeMsgMenuRef = useRef<HTMLDivElement>(null);
    const [comradeMsgToDelete, setComradeMsgToDelete] = useState<CollabChatMessage | null>(null);
    const [isDeletingComradeMsg, setIsDeletingComradeMsg] = useState<boolean>(false);
    const [deleteComradeMsgError, setDeleteComradeMsgError] = useState<string | null>(null);

    // Crew Info Modal
    const [showCrewInfoModal, setShowCrewInfoModal] = useState<boolean>(false);
    const [crewInfoMemberFilter, setCrewInfoMemberFilter] = useState<string>('');

    // Crew Settings Modal (Admin Only)
    const [showCrewSettingsModal, setShowCrewSettingsModal] = useState<boolean>(false);
    const [crewSettingsTab, setCrewSettingsTab] = useState<'general' | 'invitation' | 'join_policy'>('general');
    const [settingsCrewName, setSettingsCrewName] = useState<string>('');
    const [settingsCrewDesc, setSettingsCrewDesc] = useState<string>('');
    const [settingsCrewAvatarUrl, setSettingsCrewAvatarUrl] = useState<string>('');
    const [settingsJoinPolicy, setSettingsJoinPolicy] = useState<TeamJoinPolicy>('open');
    const [isSavingCrewSettings, setIsSavingCrewSettings] = useState<boolean>(false);
    const [crewSettingsFeedback, setCrewSettingsFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Invitations State for Crew
    const [crewInvitations, setCrewInvitations] = useState<TeamInvitation[]>([]);
    const [isRegeneratingInvite, setIsRegeneratingInvite] = useState<boolean>(false);
    const [isRevokingInvite, setIsRevokingInvite] = useState<boolean>(false);
    const [inviteCopied, setInviteCopied] = useState<boolean>(false);

    // Join Requests State for Crew (Admin Only)
    const [showJoinRequestsModal, setShowJoinRequestsModal] = useState<boolean>(false);
    const [crewJoinRequests, setCrewJoinRequests] = useState<TeamJoinRequest[]>([]);
    const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(null);
    const [rejectionReasonText, setRejectionReasonText] = useState<string>('');
    const [isProcessingJoinReq, setIsProcessingJoinReq] = useState<boolean>(false);

    // Disband Confirmation Modal
    const [showDisbandConfirmModal, setShowDisbandConfirmModal] = useState<boolean>(false);
    const [isDisbanding, setIsDisbanding] = useState<boolean>(false);

    // Incoming Invitation via URL param
    const [incomingInviteModal, setIncomingInviteModal] = useState<{
        isOpen: boolean;
        token: string;
        invitation: TeamInvitation | null;
        team: Team | null;
        isAlreadyMember: boolean;
        existingRequest: TeamJoinRequest | null;
        status: 'idle' | 'loading' | 'valid' | 'invalid' | 'submitting' | 'submitted' | 'joined' | 'error';
        errorMsg?: string;
    }>({
        isOpen: false,
        token: '',
        invitation: null,
        team: null,
        isAlreadyMember: false,
        existingRequest: null,
        status: 'idle',
    });

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

    // References for file attachments and menus
    const comradeFileInputRef = useRef<HTMLInputElement>(null);
    const crewFileInputRef = useRef<HTMLInputElement>(null);
    const [isComradeMenuOpen, setIsComradeMenuOpen] = useState<boolean>(false);
    const comradeMenuRef = useRef<HTMLDivElement>(null);
    const [isCrewMenuOpen, setIsCrewMenuOpen] = useState<boolean>(false);
    const crewMenuRef = useRef<HTMLDivElement>(null);

    // Close menus on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (comradeMenuRef.current && !comradeMenuRef.current.contains(e.target as Node)) {
                setIsComradeMenuOpen(false);
            }
            if (crewMenuRef.current && !crewMenuRef.current.contains(e.target as Node)) {
                setIsCrewMenuOpen(false);
            }
            if (activeMsgMenuRef.current && !activeMsgMenuRef.current.contains(e.target as Node)) {
                setActiveMsgMenuId(null);
            }
            if (activeComradeMsgMenuRef.current && !activeComradeMsgMenuRef.current.contains(e.target as Node)) {
                setActiveComradeMsgMenuId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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

    // Subscribe to accepted connection IDs (mutual connections only)
    useEffect(() => {
        if (!currentUser?.uid) return;
        const unsub = subscribeAcceptedConnectionUserIds(
            currentUser.uid,
            (ids) => setAcceptedConnectionIds(ids),
            (err) => console.warn('[ACCEPTED_CONNECTION_IDS_ERROR]', err)
        );
        return () => unsub();
    }, [currentUser?.uid]);

    // Comrades restricted exclusively to verified mutual accepted connections
    const eligibleAcceptedComrades = useMemo(() => {
        return followedProfiles.filter((p) => acceptedConnectionIds.has(p.uid));
    }, [followedProfiles, acceptedConnectionIds]);

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
        const unsub = subscribeToHubComradeConversations(
            currentUser.uid,
            (directs) => {
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
    // CREW Subscriptions (Hub Crews only, Spotlight teams excluded)
    // ----------------------------------------------------
    useEffect(() => {
        if (!currentUser?.uid) {
            setCrews([]);
            setLoadingCrews(false);
            return;
        }

        setLoadingCrews(true);
        const unsub = subscribeToHubCrews(
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

    // Subscribe to selected Crew details, invitations, and join requests
    useEffect(() => {
        if (!selectedCrewId) {
            setActiveCrew(null);
            setCrewMembers([]);
            setCrewMessages([]);
            setCrewInvitations([]);
            setCrewJoinRequests([]);
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

        // Real-time invitations for this crew
        const unsubInvs = subscribeToTeamInvitations(
            selectedCrewId,
            (invs) => setCrewInvitations(invs),
            (err) => console.warn('[SUBSCRIBE_CREW_INVITATIONS_WARN]', err)
        );

        // Real-time join requests for this crew (for admin/lead)
        const unsubReqs = subscribeToTeamJoinRequests(
            selectedCrewId,
            (reqs) => setCrewJoinRequests(reqs),
            (err) => console.warn('[SUBSCRIBE_CREW_JOIN_REQUESTS_WARN]', err)
        );

        return () => {
            unsubTeam();
            unsubMembers();
            unsubMsgs();
            unsubInvs();
            unsubReqs();
        };
    }, [selectedCrewId, currentUser?.uid]);

    // Active invitation link for currently selected crew
    const activeCrewInvite = useMemo(() => {
        return crewInvitations.find((i) => i.status === 'active') || crewInvitations[0] || null;
    }, [crewInvitations]);

    // Pending join requests count for badge
    const pendingJoinRequests = useMemo(() => {
        return crewJoinRequests.filter((r) => r.status === 'PENDING');
    }, [crewJoinRequests]);

    // Synchronize crewId from URL params if specified
    const urlCrewId = searchParams.get('crewId');
    const urlInviteToken = searchParams.get('invite');

    useEffect(() => {
        if (urlCrewId && urlCrewId !== selectedCrewId) {
            setSelectedCrewId(urlCrewId);
        }
    }, [urlCrewId]);

    // Handle incoming invitation link from URL
    useEffect(() => {
        if (!urlInviteToken || !currentUser?.uid) return;

        let isCancelled = false;
        const resolveInvite = async () => {
            setIncomingInviteModal({
                isOpen: true,
                token: urlInviteToken,
                invitation: null,
                team: null,
                isAlreadyMember: false,
                existingRequest: null,
                status: 'loading',
            });

            try {
                const inv = await getTeamInvitation(urlInviteToken);
                if (isCancelled) return;
                if (!inv) {
                    setIncomingInviteModal(prev => ({
                        ...prev,
                        status: 'invalid',
                        errorMsg: 'This invitation does not exist or has expired.',
                    }));
                    return;
                }

                if (inv.status === 'revoked') {
                    setIncomingInviteModal(prev => ({
                        ...prev,
                        invitation: inv,
                        status: 'invalid',
                        errorMsg: 'This invitation link has been revoked by the crew lead.',
                    }));
                    return;
                }

                // Check expiration
                if (inv.expiresAt) {
                    const expTime = typeof inv.expiresAt?.toDate === 'function'
                        ? inv.expiresAt.toDate().getTime()
                        : new Date(inv.expiresAt).getTime();
                    if (expTime > 0 && Date.now() > expTime) {
                        setIncomingInviteModal(prev => ({
                            ...prev,
                            invitation: inv,
                            status: 'invalid',
                            errorMsg: 'This invitation link has expired.',
                        }));
                        return;
                    }
                }

                // Check usage limits
                if (inv.maxUses && inv.maxUses > 0 && inv.usedCount >= inv.maxUses) {
                    setIncomingInviteModal(prev => ({
                        ...prev,
                        invitation: inv,
                        status: 'invalid',
                        errorMsg: 'This invitation link has reached its maximum allowed uses.',
                    }));
                    return;
                }

                // Retrieve team details
                const targetTeam = await getTeam(inv.teamId);
                if (isCancelled) return;
                if (!targetTeam) {
                    setIncomingInviteModal(prev => ({
                        ...prev,
                        status: 'invalid',
                        errorMsg: 'The associated crew squad was not found or has been disbanded.',
                    }));
                    return;
                }

                // Check if user is already a member
                const isMember = targetTeam.memberIds?.includes(currentUser.uid) || targetTeam.ownerId === currentUser.uid;
                if (isMember) {
                    setSelectedCrewId(targetTeam.id);
                    setIncomingInviteModal({
                        isOpen: true,
                        token: urlInviteToken,
                        invitation: inv,
                        team: targetTeam,
                        isAlreadyMember: true,
                        existingRequest: null,
                        status: 'valid',
                    });
                    return;
                }

                // Check existing join request
                let existingReq: TeamJoinRequest | null = null;
                if (targetTeam.joinPolicy === 'approval_required') {
                    existingReq = await getTeamJoinRequest(targetTeam.id, currentUser.uid);
                }

                setIncomingInviteModal({
                    isOpen: true,
                    token: urlInviteToken,
                    invitation: inv,
                    team: targetTeam,
                    isAlreadyMember: false,
                    existingRequest: existingReq,
                    status: 'valid',
                });
            } catch (err: any) {
                if (isCancelled) return;
                console.error('[RESOLVE_INVITE_ERROR]', err);
                setIncomingInviteModal(prev => ({
                    ...prev,
                    status: 'error',
                    errorMsg: err?.message || 'Failed to validate invitation.',
                }));
            }
        };

        resolveInvite();
        return () => { isCancelled = true; };
    }, [urlInviteToken, currentUser?.uid]);

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
    // File / Image Attachment Upload Handlers
    // ----------------------------------------------------
    const handleComradeFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedComradeConv || !currentUser?.uid) return;
        try {
            const isImage = file.type.startsWith('image/');
            const other = getOtherComradeParticipant(selectedComradeConv);
            const senderName = userProfile?.displayName || currentUser.displayName || 'You';
            const senderAvatar = userProfile?.photoURL || currentUser.photoURL || null;
            const text = isImage
                ? `[IMAGE TRANSMISSION: ${file.name}]`
                : `[FILE TRANSMISSION: ${file.name} (${(file.size / 1024).toFixed(1)} KB)]`;

            await sendCollabMessage({
                conversationId: selectedComradeConv.id,
                senderId: currentUser.uid,
                senderName,
                senderAvatar,
                text,
                recipientId: other.userId || undefined,
            });
        } catch (err) {
            console.error('[ATTACH_FILE_COMRADE_ERROR]', err);
        } finally {
            e.target.value = '';
        }
    };

    const handleCrewFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedCrewId || !currentUser?.uid) return;
        try {
            const isImage = file.type.startsWith('image/');
            const senderName = userProfile?.displayName || currentUser.displayName || 'Crew Member';
            const senderAvatar = userProfile?.photoURL || currentUser.photoURL || null;
            const text = isImage
                ? `[IMAGE TRANSMISSION: ${file.name}]`
                : `[FILE TRANSMISSION: ${file.name} (${(file.size / 1024).toFixed(1)} KB)]`;

            await sendTeamMessage({
                teamId: selectedCrewId,
                senderId: currentUser.uid,
                senderName,
                senderAvatar,
                text,
            });
        } catch (err) {
            console.error('[ATTACH_FILE_CREW_ERROR]', err);
        } finally {
            e.target.value = '';
        }
    };

    // ----------------------------------------------------
    // Start Direct Conversation with a Connection
    // ----------------------------------------------------
    const handleStartDirectChat = async (targetUser: InvoxUser) => {
        if (!currentUser) return;
        try {
            // Enforce accepted-connection authorization policy
            const isAccepted = await isUserAcceptedConnection(currentUser.uid, targetUser.uid);
            if (!isAccepted && !acceptedConnectionIds.has(targetUser.uid)) {
                alert('Comrade transmissions require an accepted mutual connection between both nodes.');
                return;
            }

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

    // Message Editing Handler (Own messages only)
    const handleSaveCrewMsgEdit = async (messageId: string) => {
        if (!activeCrew || !currentUser?.uid) return;
        const clean = editingCrewMsgText.trim();
        if (!clean) {
            setCrewMsgEditError('Message content cannot be empty.');
            return;
        }

        setIsSavingMsgEdit(true);
        setCrewMsgEditError(null);
        try {
            await updateTeamMessage({
                teamId: activeCrew.id,
                messageId,
                userId: currentUser.uid,
                newText: clean,
            });
            setEditingCrewMsgId(null);
            setEditingCrewMsgText('');
        } catch (err: any) {
            console.error('[EDIT_CREW_MESSAGE_ERROR]', err);
            setCrewMsgEditError(err?.message || 'Failed to update message.');
        } finally {
            setIsSavingMsgEdit(false);
        }
    };

    // Message Deletion Handler (Own messages only)
    const handleConfirmDeleteCrewMsg = async () => {
        if (!activeCrew || !crewMsgToDelete || !currentUser?.uid) return;
        setIsDeletingMsg(true);
        setDeleteMsgError(null);
        try {
            await deleteTeamMessage({
                teamId: activeCrew.id,
                messageId: crewMsgToDelete.id,
                userId: currentUser.uid,
            });
            setCrewMsgToDelete(null);
        } catch (err: any) {
            console.error('[DELETE_CREW_MESSAGE_ERROR]', err);
            setDeleteMsgError(err?.message || 'Failed to delete message.');
        } finally {
            setIsDeletingMsg(false);
        }
    };

    // Comrade Message Editing Handler (Own messages only)
    const handleSaveComradeMsgEdit = async (messageId: string) => {
        if (!selectedComradeId || !currentUser?.uid) return;
        const clean = editingComradeMsgText.trim();
        if (!clean) {
            setComradeMsgEditError('Message content cannot be empty.');
            return;
        }

        setIsSavingComradeMsgEdit(true);
        setComradeMsgEditError(null);
        try {
            await updateCollabMessage({
                conversationId: selectedComradeId,
                messageId,
                userId: currentUser.uid,
                newText: clean,
            });
            setEditingComradeMsgId(null);
            setEditingComradeMsgText('');
        } catch (err: any) {
            console.error('[EDIT_COMRADE_MESSAGE_ERROR]', err);
            setComradeMsgEditError(err?.message || 'Failed to update message.');
        } finally {
            setIsSavingComradeMsgEdit(false);
        }
    };

    // Comrade Message Deletion Handler (Own messages only)
    const handleConfirmDeleteComradeMsg = async () => {
        if (!selectedComradeId || !comradeMsgToDelete || !currentUser?.uid) return;
        setIsDeletingComradeMsg(true);
        setDeleteComradeMsgError(null);
        try {
            await deleteCollabMessage({
                conversationId: selectedComradeId,
                messageId: comradeMsgToDelete.id,
                userId: currentUser.uid,
            });
            setComradeMsgToDelete(null);
        } catch (err: any) {
            console.error('[DELETE_COMRADE_MESSAGE_ERROR]', err);
            setDeleteComradeMsgError(err?.message || 'Failed to delete message.');
        } finally {
            setIsDeletingComradeMsg(false);
        }
    };

    // Crew General Settings Save Handler (Admin Only)
    const handleSaveCrewGeneralSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeCrew || !currentUser?.uid) return;
        if (activeCrew.ownerId !== currentUser.uid) {
            setCrewSettingsFeedback({ type: 'error', message: 'Unauthorized: Only the crew lead can update settings.' });
            return;
        }

        const cleanName = settingsCrewName.trim();
        if (!cleanName) {
            setCrewSettingsFeedback({ type: 'error', message: 'Crew name cannot be blank.' });
            return;
        }

        setIsSavingCrewSettings(true);
        setCrewSettingsFeedback(null);
        try {
            await updateCrewDetails({
                teamId: activeCrew.id,
                userId: currentUser.uid,
                name: cleanName,
                description: settingsCrewDesc.trim(),
                avatarUrl: settingsCrewAvatarUrl.trim() || null,
            });
            setCrewSettingsFeedback({ type: 'success', message: 'Crew intelligence parameters saved successfully.' });
        } catch (err: any) {
            console.error('[SAVE_CREW_SETTINGS_ERROR]', err);
            setCrewSettingsFeedback({ type: 'error', message: err?.message || 'Failed to save crew parameters.' });
        } finally {
            setIsSavingCrewSettings(false);
        }
    };

    // Crew Join Policy Save Handler (Admin Only)
    const handleSaveCrewJoinPolicy = async (policy: TeamJoinPolicy) => {
        if (!activeCrew || !currentUser?.uid) return;
        if (activeCrew.ownerId !== currentUser.uid) return;

        setIsSavingCrewSettings(true);
        setCrewSettingsFeedback(null);
        try {
            await updateTeamJoinPolicy({
                teamId: activeCrew.id,
                userId: currentUser.uid,
                policy,
            });
            setSettingsJoinPolicy(policy);
            setCrewSettingsFeedback({ type: 'success', message: `Join policy updated to "${policy === 'open' ? 'Anyone with link' : 'Approval Required'}".` });
        } catch (err: any) {
            console.error('[SAVE_CREW_JOIN_POLICY_ERROR]', err);
            setCrewSettingsFeedback({ type: 'error', message: err?.message || 'Failed to update join policy.' });
        } finally {
            setIsSavingCrewSettings(false);
        }
    };

    // Generate or Regenerate Invitation Link (Admin Only)
    const handleGenerateOrRegenerateInvite = async () => {
        if (!activeCrew || !currentUser?.uid) return;
        if (activeCrew.ownerId !== currentUser.uid) return;

        setIsRegeneratingInvite(true);
        try {
            await regenerateCrewInvitation({
                teamId: activeCrew.id,
                user: currentUser,
                userProfile,
                crewName: activeCrew.name,
            });
            setCrewSettingsFeedback({ type: 'success', message: 'Fresh invitation token generated.' });
        } catch (err: any) {
            console.error('[REGENERATE_CREW_INVITE_ERROR]', err);
            setCrewSettingsFeedback({ type: 'error', message: err?.message || 'Failed to generate invitation link.' });
        } finally {
            setIsRegeneratingInvite(false);
        }
    };

    // Revoke Invitation Link (Admin Only)
    const handleRevokeCrewInvite = async () => {
        if (!activeCrew || !activeCrewInvite || !currentUser?.uid) return;
        if (activeCrew.ownerId !== currentUser.uid) return;

        if (!window.confirm('Revoke this invitation link? Users with this URL will no longer be able to join.')) return;

        setIsRevokingInvite(true);
        try {
            await revokeTeamInvitation(activeCrewInvite.token, currentUser.uid);
            setCrewSettingsFeedback({ type: 'success', message: 'Invitation link revoked.' });
        } catch (err: any) {
            console.error('[REVOKE_CREW_INVITE_ERROR]', err);
            setCrewSettingsFeedback({ type: 'error', message: err?.message || 'Failed to revoke invitation link.' });
        } finally {
            setIsRevokingInvite(false);
        }
    };

    // Copy Crew Invitation Link to Clipboard
    const handleCopyCrewInviteLink = async () => {
        if (!activeCrew || !activeCrewInvite) return;
        const link = getCrewInvitationUrl(activeCrewInvite.token, activeCrew.id);
        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(link);
            } else {
                const ta = document.createElement('textarea');
                ta.value = link;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }
            setInviteCopied(true);
            setTimeout(() => setInviteCopied(false), 2500);
        } catch (err) {
            console.error('[COPY_CREW_INVITE_ERROR]', err);
        }
    };

    // Approve Join Request (Admin Only)
    const handleApproveJoinRequest = async (req: TeamJoinRequest) => {
        if (!activeCrew || !currentUser?.uid) return;
        if (activeCrew.ownerId !== currentUser.uid) return;

        setIsProcessingJoinReq(true);
        try {
            await approveTeamJoinRequest({
                teamId: activeCrew.id,
                requestId: req.userId || req.id,
                adminUser: currentUser,
                adminProfile: userProfile,
            });
        } catch (err: any) {
            console.error('[APPROVE_JOIN_REQUEST_ERROR]', err);
            alert(err?.message || 'Failed to approve request.');
        } finally {
            setIsProcessingJoinReq(false);
        }
    };

    // Reject Join Request (Admin Only)
    const handleRejectJoinRequest = async (req: TeamJoinRequest) => {
        if (!activeCrew || !currentUser?.uid) return;
        if (activeCrew.ownerId !== currentUser.uid) return;

        setIsProcessingJoinReq(true);
        try {
            await rejectTeamJoinRequest({
                teamId: activeCrew.id,
                requestId: req.userId || req.id,
                adminUser: currentUser,
                adminProfile: userProfile,
                reason: rejectionReasonText.trim() || undefined,
            });
            setRejectingRequestId(null);
            setRejectionReasonText('');
        } catch (err: any) {
            console.error('[REJECT_JOIN_REQUEST_ERROR]', err);
            alert(err?.message || 'Failed to reject request.');
        } finally {
            setIsProcessingJoinReq(false);
        }
    };

    // Accept Incoming Invite (Direct Join)
    const handleAcceptIncomingInvite = async () => {
        if (!incomingInviteModal.invitation || !currentUser) return;
        setIncomingInviteModal(prev => ({ ...prev, status: 'submitting' }));
        try {
            await joinTeamViaInvitation({
                token: incomingInviteModal.invitation.token,
                user: currentUser,
                userProfile,
                projectRole: 'Crew Member',
            });
            const teamId = incomingInviteModal.invitation.teamId;
            setSelectedCrewId(teamId);
            setIncomingInviteModal(prev => ({ ...prev, status: 'joined' }));

            // Clean URL search param so invitation modal is not reopened on page refresh
            searchParams.delete('invite');
            setSearchParams(searchParams, { replace: true });
            setTimeout(() => {
                setIncomingInviteModal(prev => ({ ...prev, isOpen: false }));
            }, 1200);
        } catch (err: any) {
            console.error('[ACCEPT_INCOMING_INVITE_ERROR]', err);
            setIncomingInviteModal(prev => ({
                ...prev,
                status: 'error',
                errorMsg: err?.message || 'Failed to join crew squad.',
            }));
        }
    };

    // Request Access to Crew (When Mode B Approval Required)
    const handleRequestIncomingInviteAccess = async () => {
        if (!incomingInviteModal.invitation || !currentUser) return;
        setIncomingInviteModal(prev => ({ ...prev, status: 'submitting' }));
        try {
            const req = await createTeamJoinRequest({
                token: incomingInviteModal.invitation.token,
                user: currentUser,
                userProfile,
            });
            setIncomingInviteModal(prev => ({
                ...prev,
                status: 'submitted',
                existingRequest: req,
            }));
        } catch (err: any) {
            console.error('[REQUEST_INCOMING_INVITE_ACCESS_ERROR]', err);
            setIncomingInviteModal(prev => ({
                ...prev,
                status: 'error',
                errorMsg: err?.message || 'Failed to submit join request.',
            }));
        }
    };

    // Leave Crew (Non-Owner Members)
    const handleLeaveCrew = async () => {
        if (!activeCrew || !currentUser?.uid) return;
        if (activeCrew.ownerId === currentUser.uid) {
            setShowDisbandConfirmModal(true);
            return;
        }

        if (!window.confirm(`Are you sure you want to leave squad "${activeCrew.name}"?`)) return;

        try {
            await leaveTeam({
                teamId: activeCrew.id,
                userId: currentUser.uid,
                userName: userProfile?.displayName || currentUser.displayName || 'Member',
            });
            setSelectedCrewId(null);
            setShowCrewMembersDrawer(false);
        } catch (err: any) {
            console.error('[LEAVE_CREW_ERROR]', err);
            alert(err?.message || 'Failed to leave squad.');
        }
    };

    // Disband Crew (Owner Only)
    const handleConfirmDisbandCrew = async () => {
        if (!activeCrew || !currentUser?.uid) return;
        if (activeCrew.ownerId !== currentUser.uid) return;

        setIsDisbanding(true);
        try {
            await deleteTeam(activeCrew.id, currentUser.uid);
            setSelectedCrewId(null);
            setShowDisbandConfirmModal(false);
            setShowCrewMembersDrawer(false);
        } catch (err: any) {
            console.error('[DISBAND_CREW_ERROR]', err);
            alert(err?.message || 'Failed to disband crew squad.');
        } finally {
            setIsDisbanding(false);
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
        <div className="w-full font-mono flex flex-col flex-1 min-h-0 text-zinc-100">
            {/* Card-based Messaging Container */}
            <div className="w-full bg-[#0c0c0e] border border-zinc-800 shadow-2xl flex flex-col md:flex-row overflow-hidden flex-1 h-[calc(100dvh-5.25rem)] md:h-[calc(100dvh-6.25rem)] lg:h-[calc(100dvh-3rem)] min-h-[480px] relative">
                {/* ---------------------------------------------------- */}
                {/* SUBSECTION 1: COMRADES (1-on-1 Direct Messaging)     */}
                {/* ---------------------------------------------------- */}
                {activeSection === 'comrades' && (
                    <>
                        {/* LEFT PANEL: Comrade Conversations Inbox */}
                        <aside
                            className={`w-full md:w-80 lg:w-84 flex-shrink-0 border-b md:border-b-0 md:border-r border-zinc-800 flex flex-col h-full bg-[#0b0b0d] overflow-hidden ${
                                selectedComradeId ? 'hidden md:flex' : 'flex'
                            }`}
                        >
                        {/* Panel Header - Aligned with ChatHeader h-14 height */}
                        <div className="h-14 px-4 border-b border-zinc-800 bg-[#0c0c0e] flex items-center justify-between flex-shrink-0 font-mono">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-white uppercase tracking-wider">// COMRADES</span>
                                <span className="text-[10px] text-zinc-500 border border-zinc-800 px-1.5 py-0.5">
                                    {filteredComrades.length}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowNewComradeModal(true)}
                                    className="h-7 px-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-750 hover:border-zinc-500 text-zinc-200 hover:text-white text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer"
                                    title="Start direct conversation with an accepted connection"
                                >
                                    <PlusIcon className="w-3 h-3 text-zinc-400" />
                                    <span>NEW</span>
                                </button>
                            </div>
                        </div>

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
                                    <div className="p-8 text-center space-y-3 font-mono">
                                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">
                                            // NO CONVERSATIONS YET
                                        </span>
                                        <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
                                            {comradeSearch
                                                ? 'No conversations match your search filter.'
                                                : 'Start a private conversation with your connections.'}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => setShowNewComradeModal(true)}
                                            className="px-3.5 py-1.5 bg-white text-black text-xs font-bold uppercase tracking-wider hover:bg-zinc-200 transition-colors cursor-pointer"
                                        >
                                            + New Conversation
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
                                                    isOnline: true,
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
                            className={`flex-1 min-w-0 flex flex-col bg-[#0c0c0e] h-full overflow-hidden relative ${
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
                                                subtitle={other.username ? `@${other.username} • [ONLINE]` : '// Comrade • [ONLINE]'}
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


                                                {/* Contextual Menu */}
                                                <div className="relative" ref={comradeMenuRef}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsComradeMenuOpen((prev) => !prev)}
                                                        className="h-8 w-8 border border-zinc-800 bg-zinc-900 hover:border-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer flex items-center justify-center text-xs"
                                                        title="Transmission Options"
                                                    >
                                                        <EllipsisVerticalIcon className="w-3.5 h-3.5" />
                                                    </button>
                                                    {isComradeMenuOpen && (
                                                        <div className="absolute right-0 top-full mt-1 w-48 bg-[#0c0c0e] border border-zinc-800 shadow-2xl z-30 py-1 font-mono text-xs">
                                                            {other.userId && (
                                                                <button
                                                                    onClick={() => {
                                                                        setIsComradeMenuOpen(false);
                                                                        navigate(`/profile/${other.userId}`);
                                                                    }}
                                                                    className="w-full text-left px-3 py-2 text-zinc-300 hover:bg-zinc-900 hover:text-white flex items-center justify-between"
                                                                >
                                                                    <span>VIEW PROFILE</span>
                                                                    <ArrowUpRightIcon className="w-3 h-3 text-zinc-500" />
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => {
                                                                    setIsComradeMenuOpen(false);
                                                                    setShowComradeSummaryModal(true);
                                                                }}
                                                                className="w-full text-left px-3 py-2 text-zinc-300 hover:bg-zinc-900 hover:text-white"
                                                            >
                                                                GENERATE SUMMARY
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setIsComradeMenuOpen(false);
                                                                    alert('Channel notifications muted.');
                                                                }}
                                                                className="w-full text-left px-3 py-2 text-zinc-300 hover:bg-zinc-900 hover:text-white"
                                                            >
                                                                MUTE CHANNEL
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setIsComradeMenuOpen(false);
                                                                    setSelectedComradeId(null);
                                                                }}
                                                                className="w-full text-left px-3 py-2 text-zinc-300 hover:bg-zinc-900 hover:text-white border-t border-zinc-800"
                                                            >
                                                                CLOSE SESSION
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
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
                                        className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 min-h-0 relative no-scrollbar"
                                    >
                                        {loadingComradeMsgs ? (
                                            <div className="py-12 text-center my-auto font-mono">
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
                                                            <div className="flex items-center justify-center my-3 sm:my-4 font-mono select-none">
                                                                <span className="text-[9px] text-zinc-500 bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 tracking-widest uppercase">
                                                                    {formatDaySeparator(msg.createdAt)}
                                                                </span>
                                                            </div>
                                                        )}
                                                        <div
                                                            className={`flex flex-col ${
                                                                isMe ? 'items-end' : 'items-start'
                                                            } max-w-full group/msg relative`}
                                                        >
                                                            {!isMe && msg.senderName && (
                                                                <span className="text-[10px] text-zinc-400 mb-1 px-1 font-semibold font-mono tracking-wide">
                                                                    {msg.senderName}
                                                                </span>
                                                            )}
                                                            {/* Message Bubble with independent contextual actions trigger */}
                                                            <div
                                                                className={`relative min-w-0 px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs border shadow-sm ${
                                                                    editingComradeMsgId === msg.id
                                                                        ? 'w-full min-w-[280px] sm:min-w-[360px] bg-[#141418] border-zinc-650'
                                                                        : isMe
                                                                        ? 'bg-zinc-850 border-zinc-750 text-zinc-100 max-w-[85%] sm:max-w-[72%]'
                                                                        : 'bg-[#131317] border-zinc-800 text-zinc-200 max-w-[85%] sm:max-w-[72%]'
                                                                }`}
                                                            >
                                                                {/* Action button: positioned independently immediately to the left of the bubble */}
                                                                {isMe && editingComradeMsgId !== msg.id && (
                                                                    <div
                                                                        className="absolute right-full top-1/2 -translate-y-1/2 mr-1.5 z-20 flex-shrink-0"
                                                                        ref={activeComradeMsgMenuId === msg.id ? activeComradeMsgMenuRef : null}
                                                                    >
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setActiveComradeMsgMenuId(activeComradeMsgMenuId === msg.id ? null : msg.id);
                                                                            }}
                                                                            className={`p-1 text-zinc-400 hover:text-white bg-zinc-900/90 border border-zinc-750 hover:border-zinc-500 transition-all cursor-pointer ${
                                                                                activeComradeMsgMenuId === msg.id
                                                                                    ? 'opacity-100 bg-zinc-800 text-white border-zinc-600'
                                                                                    : 'opacity-0 [@media(hover:none)]:opacity-70 group-hover/msg:opacity-100 hover:opacity-100 focus:opacity-100 focus-visible:opacity-100'
                                                                            }`}
                                                                            title="Message options"
                                                                            aria-label="Message options"
                                                                            aria-haspopup="true"
                                                                            aria-expanded={activeComradeMsgMenuId === msg.id}
                                                                        >
                                                                            <EllipsisVerticalIcon className="w-3.5 h-3.5" />
                                                                        </button>

                                                                        {activeComradeMsgMenuId === msg.id && (
                                                                            <div
                                                                                className="absolute right-0 top-full mt-1 w-36 bg-[#0c0c0e] border border-zinc-800 shadow-2xl py-1 z-30 font-mono text-xs"
                                                                                onClick={(e) => e.stopPropagation()}
                                                                            >
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        setActiveComradeMsgMenuId(null);
                                                                                        setEditingComradeMsgId(msg.id);
                                                                                        setEditingComradeMsgText(msg.text);
                                                                                        setComradeMsgEditError(null);
                                                                                    }}
                                                                                    className="w-full text-left px-3 py-1.5 text-zinc-300 hover:bg-zinc-900 hover:text-white flex items-center gap-2 cursor-pointer"
                                                                                >
                                                                                    <PencilSquareIcon className="w-3.5 h-3.5 text-zinc-400" />
                                                                                    <span>Edit Message</span>
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        setActiveComradeMsgMenuId(null);
                                                                                        setComradeMsgToDelete(msg);
                                                                                        setDeleteComradeMsgError(null);
                                                                                    }}
                                                                                    className="w-full text-left px-3 py-1.5 text-red-400 hover:bg-red-950/30 hover:text-red-300 border-t border-zinc-850 flex items-center gap-2 cursor-pointer"
                                                                                >
                                                                                    <TrashIcon className="w-3.5 h-3.5 text-red-400" />
                                                                                    <span>Delete Message</span>
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {editingComradeMsgId === msg.id ? (
                                                                    <div className="space-y-2">
                                                                        <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono uppercase tracking-wider pb-1 border-b border-zinc-800">
                                                                            <span className="flex items-center gap-1 text-emerald-400">
                                                                                <PencilSquareIcon className="w-3 h-3" />
                                                                                Edit Transmission
                                                                            </span>
                                                                            <span className="text-zinc-600">ESC to cancel</span>
                                                                        </div>
                                                                        <textarea
                                                                            value={editingComradeMsgText}
                                                                            onChange={(e) => setEditingComradeMsgText(e.target.value)}
                                                                            onKeyDown={(e) => {
                                                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                                                    e.preventDefault();
                                                                                    handleSaveComradeMsgEdit(msg.id);
                                                                                } else if (e.key === 'Escape') {
                                                                                    setEditingComradeMsgId(null);
                                                                                    setEditingComradeMsgText('');
                                                                                    setComradeMsgEditError(null);
                                                                                }
                                                                            }}
                                                                            autoFocus
                                                                            rows={3}
                                                                            className="w-full bg-[#0a0a0c] border border-zinc-700 p-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 font-mono resize-none leading-relaxed"
                                                                            placeholder="Edit your transmission..."
                                                                        />
                                                                        {comradeMsgEditError && (
                                                                            <div className="text-[11px] text-red-400 font-mono flex items-center gap-1">
                                                                                <span>!</span> {comradeMsgEditError}
                                                                            </div>
                                                                        )}
                                                                        <div className="flex items-center justify-end gap-2 pt-1">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setEditingComradeMsgId(null);
                                                                                    setEditingComradeMsgText('');
                                                                                    setComradeMsgEditError(null);
                                                                                }}
                                                                                disabled={isSavingComradeMsgEdit}
                                                                                className="px-2.5 py-1 text-[11px] font-mono border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors cursor-pointer"
                                                                            >
                                                                                Cancel
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleSaveComradeMsgEdit(msg.id)}
                                                                                disabled={isSavingComradeMsgEdit || !editingComradeMsgText.trim()}
                                                                                className="px-3 py-1 text-[11px] font-mono bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center gap-1.5 disabled:opacity-50 transition-colors cursor-pointer"
                                                                            >
                                                                                {isSavingComradeMsgEdit ? (
                                                                                    <>
                                                                                        <div className="w-2.5 h-2.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                                                        <span>Saving...</span>
                                                                                    </>
                                                                                ) : (
                                                                                    <span>Save Changes</span>
                                                                                )}
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <>
                                                                        <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] leading-relaxed font-mono min-w-0">
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
                                                                        <div
                                                                            className={`mt-1.5 flex items-center gap-1.5 text-[10px] font-mono tabular-nums ${
                                                                                isMe
                                                                                    ? 'text-zinc-500 justify-end'
                                                                                    : 'text-zinc-600 justify-start'
                                                                            }`}
                                                                        >
                                                                            {timeStr && <span>{timeStr}</span>}
                                                                            {msg.editedAt && (
                                                                                <span
                                                                                    className="text-[9px] uppercase tracking-wider text-zinc-500 bg-zinc-900/80 px-1 py-0.5 border border-zinc-800"
                                                                                    title={`Edited ${formatTimestamp(msg.editedAt)}`}
                                                                                >
                                                                                    edited
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </React.Fragment>
                                                );
                                            })
                                        )}
                                    </div>

                                    {/* Hidden file attachment input */}
                                    <input
                                        type="file"
                                        ref={comradeFileInputRef}
                                        onChange={handleComradeFileSelect}
                                        className="hidden"
                                    />

                                    {/* Bottom Message Composer */}
                                    <MessageComposer
                                        value={comradeInput}
                                        onChange={setComradeInput}
                                        onSend={handleSendComradeMessage}
                                        placeholder="// TRANSMIT MESSAGE TO COMRADE..."
                                        disabled={loadingComradeMsgs}
                                        isSending={sendingComrade}
                                        textareaRef={comradeComposerRef}
                                        onAttachFile={() => comradeFileInputRef.current?.click()}
                                    />
                                </>
                            ) : (
                                <div className="flex-1 flex flex-col bg-[#0c0c0e] h-full">
                                    {/* Aligned placeholder header row sharing the top edge */}
                                    <div className="h-14 px-4 sm:px-6 border-b border-zinc-800 bg-[#0c0c0e] flex items-center justify-between flex-shrink-0 font-mono">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                                                // CONVERSATION_WORKSPACE
                                            </span>
                                        </div>
                                        <span className="text-[10px] text-zinc-600 font-mono">// IDLE</span>
                                    </div>
                                    <div className="flex-1 flex items-center justify-center p-6 sm:p-8 text-center font-mono">
                                        <div className="bg-[#0b0b0d] border border-zinc-800 p-6 sm:p-8 max-w-md w-full shadow-xl">
                                            <div className="w-12 h-12 bg-zinc-900 border border-zinc-700 flex items-center justify-center mx-auto mb-4 text-zinc-400">
                                                <ChatBubbleBottomCenterTextIcon className="w-6 h-6" />
                                            </div>
                                            <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">
                                                // CONVERSATION
                                            </span>
                                            <h2 className="text-base font-bold uppercase tracking-wider text-white mb-2">
                                                No Comrade Selected
                                            </h2>
                                            <p className="text-xs text-zinc-400 leading-relaxed mb-6 font-mono">
                                                Select a conversation from your inbox or start a new conversation with one of your connections.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => setShowNewComradeModal(true)}
                                                className="px-4 py-2 bg-white hover:bg-zinc-200 text-black font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                                            >
                                                + New Conversation
                                            </button>
                                        </div>
                                    </div>
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
                        {/* LEFT PANEL: Crew Groups Inbox */}
                        <aside
                            className={`w-full md:w-80 lg:w-84 flex-shrink-0 border-b md:border-b-0 md:border-r border-zinc-800 flex flex-col h-full bg-[#0b0b0d] overflow-hidden ${
                                selectedCrewId ? 'hidden md:flex' : 'flex'
                            }`}
                        >
                            {/* Panel Header - Aligned with ChatHeader h-14 height */}
                            <div className="h-14 px-4 border-b border-zinc-800 bg-[#0c0c0e] flex items-center justify-between flex-shrink-0 font-mono">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-white uppercase tracking-wider">// CREW</span>
                                    <span className="text-[10px] text-zinc-500 border border-zinc-800 px-1.5 py-0.5">
                                        {filteredCrews.length}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateCrewModal(true)}
                                        className="h-7 px-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-750 hover:border-zinc-500 text-zinc-200 hover:text-white text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer"
                                        title="Form a new Crew group"
                                    >
                                        <PlusIcon className="w-3 h-3 text-zinc-400" />
                                        <span>NEW</span>
                                    </button>
                                </div>
                            </div>

                            <SearchInput
                                value={crewSearch}
                                onChange={setCrewSearch}
                                placeholder="Search crew..."
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
                            className={`flex-1 min-w-0 flex flex-col bg-[#0c0c0e] h-full overflow-hidden relative ${
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

                                        {/* Contextual Menu */}
                                        <div className="relative" ref={crewMenuRef}>
                                            <button
                                                type="button"
                                                onClick={() => setIsCrewMenuOpen((prev) => !prev)}
                                                className="h-8 w-8 border border-zinc-800 bg-zinc-900 hover:border-zinc-700 hover:bg-zinc-850 text-zinc-400 hover:text-white transition-colors flex items-center justify-center cursor-pointer"
                                                title="Crew actions"
                                            >
                                                <EllipsisVerticalIcon className="w-4 h-4" />
                                            </button>

                                            {isCrewMenuOpen && (
                                                <div className="absolute right-0 mt-1 w-52 bg-[#0c0c0e] border border-zinc-800 shadow-2xl py-1 z-30 font-mono text-xs">
                                                    {/* ALL MEMBERS: Crew Info */}
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setIsCrewMenuOpen(false);
                                                            setShowCrewInfoModal(true);
                                                        }}
                                                        className="w-full text-left px-3 py-2 text-zinc-200 hover:bg-zinc-900 hover:text-white flex items-center gap-2 cursor-pointer"
                                                    >
                                                        <InformationCircleIcon className="w-3.5 h-3.5 text-zinc-400" />
                                                        <span>CREW INFO</span>
                                                    </button>

                                                    {/* ALL MEMBERS: View Members */}
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setIsCrewMenuOpen(false);
                                                            setShowCrewMembersDrawer(true);
                                                        }}
                                                        className="w-full text-left px-3 py-2 text-zinc-200 hover:bg-zinc-900 hover:text-white flex items-center gap-2 cursor-pointer"
                                                    >
                                                        <UsersIcon className="w-3.5 h-3.5 text-zinc-400" />
                                                        <span>VIEW MEMBERS</span>
                                                    </button>

                                                    {/* ALL MEMBERS: Add Comrade */}
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setIsCrewMenuOpen(false);
                                                            setShowAddMemberModal(true);
                                                        }}
                                                        className="w-full text-left px-3 py-2 text-zinc-200 hover:bg-zinc-900 hover:text-white flex items-center gap-2 cursor-pointer"
                                                    >
                                                        <PlusIcon className="w-3.5 h-3.5 text-zinc-400" />
                                                        <span>ADD COMRADE</span>
                                                    </button>

                                                    {/* ALL MEMBERS: Generate Summary */}
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setIsCrewMenuOpen(false);
                                                            setShowCrewSummaryModal(true);
                                                        }}
                                                        className="w-full text-left px-3 py-2 text-zinc-200 hover:bg-zinc-900 hover:text-white flex items-center gap-2 cursor-pointer"
                                                    >
                                                        <SparklesIcon className="w-3.5 h-3.5 text-zinc-400" />
                                                        <span>GENERATE SUMMARY</span>
                                                    </button>

                                                    {/* ADMIN ONLY CONTROLS */}
                                                    {activeCrew.ownerId === currentUser?.uid && (
                                                        <>
                                                            <div className="border-t border-zinc-800 my-1" />
                                                            <div className="px-3 py-1 text-[9px] text-zinc-500 font-bold uppercase tracking-widest">
                                                                // ADMIN CONTROLS
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setIsCrewMenuOpen(false);
                                                                    setCrewSettingsTab('general');
                                                                    setSettingsCrewName(activeCrew.name || '');
                                                                    setSettingsCrewDesc(activeCrew.description || '');
                                                                    setSettingsCrewAvatarUrl(activeCrew.avatarUrl || activeCrew.ownerAvatar || '');
                                                                    setSettingsJoinPolicy(activeCrew.joinPolicy || 'open');
                                                                    setCrewSettingsFeedback(null);
                                                                    setShowCrewSettingsModal(true);
                                                                }}
                                                                className="w-full text-left px-3 py-2 text-zinc-200 hover:bg-zinc-900 hover:text-white flex items-center gap-2 cursor-pointer"
                                                            >
                                                                <CogIcon className="w-3.5 h-3.5 text-zinc-400" />
                                                                <span>CREW SETTINGS</span>
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setIsCrewMenuOpen(false);
                                                                    setShowJoinRequestsModal(true);
                                                                }}
                                                                className="w-full text-left px-3 py-2 text-zinc-200 hover:bg-zinc-900 hover:text-white flex items-center justify-between cursor-pointer"
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <ShieldCheckIcon className="w-3.5 h-3.5 text-zinc-400" />
                                                                    <span>JOIN REQUESTS</span>
                                                                </div>
                                                                {pendingJoinRequests.length > 0 && (
                                                                    <span className="px-1.5 py-0.2 bg-amber-500 text-black text-[9px] font-bold">
                                                                        {pendingJoinRequests.length}
                                                                    </span>
                                                                )}
                                                            </button>
                                                        </>
                                                    )}

                                                    {/* LEAVE / DISBAND ACTIONS */}
                                                    <div className="border-t border-zinc-800 my-1" />
                                                    {activeCrew.ownerId === currentUser?.uid ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setIsCrewMenuOpen(false);
                                                                setShowDisbandConfirmModal(true);
                                                            }}
                                                            className="w-full text-left px-3 py-2 text-red-400 hover:bg-red-950/30 hover:text-red-300 flex items-center gap-2 cursor-pointer"
                                                        >
                                                            <TrashIcon className="w-3.5 h-3.5 text-red-400" />
                                                            <span>DISBAND CREW</span>
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setIsCrewMenuOpen(false);
                                                                handleLeaveCrew();
                                                            }}
                                                            className="w-full text-left px-3 py-2 text-red-400 hover:bg-red-950/30 hover:text-red-300 flex items-center gap-2 cursor-pointer"
                                                        >
                                                            <LogoutIcon className="w-3.5 h-3.5 text-red-400" />
                                                            <span>LEAVE SQUAD</span>
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
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
                                            className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 min-h-0 relative no-scrollbar"
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
                                                                <div className="flex items-center justify-center my-3 sm:my-4 font-mono select-none">
                                                                    <span className="text-[9px] font-mono text-zinc-500 bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 tracking-widest uppercase">
                                                                        {formatDaySeparator(msg.createdAt)}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            <div
                                                                className={`flex flex-col ${
                                                                    isMe ? 'items-end' : 'items-start'
                                                                } max-w-full group/msg relative`}
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
                                                                {/* Message Bubble with independent contextual actions trigger */}
                                                                <div
                                                                    className={`relative min-w-0 px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs border shadow-sm ${
                                                                        editingCrewMsgId === msg.id
                                                                            ? 'w-full min-w-[280px] sm:min-w-[360px] bg-[#141418] border-zinc-650'
                                                                            : isMe
                                                                            ? 'bg-zinc-850 border-zinc-750 text-zinc-100 max-w-[85%] sm:max-w-[72%]'
                                                                            : 'bg-[#131317] border-zinc-800 text-zinc-200 max-w-[85%] sm:max-w-[72%]'
                                                                    }`}
                                                                >
                                                                    {/* Action button: positioned independently immediately to the left of the bubble */}
                                                                    {isMe && editingCrewMsgId !== msg.id && (
                                                                        <div
                                                                            className="absolute right-full top-1/2 -translate-y-1/2 mr-1.5 z-20 flex-shrink-0"
                                                                            ref={activeMsgMenuId === msg.id ? activeMsgMenuRef : null}
                                                                        >
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setActiveMsgMenuId(activeMsgMenuId === msg.id ? null : msg.id);
                                                                                }}
                                                                                className={`p-1 text-zinc-400 hover:text-white bg-zinc-900/90 border border-zinc-750 hover:border-zinc-500 transition-all cursor-pointer ${
                                                                                    activeMsgMenuId === msg.id
                                                                                        ? 'opacity-100 bg-zinc-800 text-white border-zinc-600'
                                                                                        : 'opacity-0 [@media(hover:none)]:opacity-70 group-hover/msg:opacity-100 hover:opacity-100 focus:opacity-100 focus-visible:opacity-100'
                                                                                }`}
                                                                                title="Message options"
                                                                                aria-label="Message options"
                                                                                aria-haspopup="true"
                                                                                aria-expanded={activeMsgMenuId === msg.id}
                                                                            >
                                                                                <EllipsisVerticalIcon className="w-3.5 h-3.5" />
                                                                            </button>

                                                                            {activeMsgMenuId === msg.id && (
                                                                                <div
                                                                                    className="absolute right-0 top-full mt-1 w-36 bg-[#0c0c0e] border border-zinc-800 shadow-2xl py-1 z-30 font-mono text-xs"
                                                                                    onClick={(e) => e.stopPropagation()}
                                                                                >
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            setActiveMsgMenuId(null);
                                                                                            setEditingCrewMsgId(msg.id);
                                                                                            setEditingCrewMsgText(msg.text);
                                                                                            setCrewMsgEditError(null);
                                                                                        }}
                                                                                        className="w-full text-left px-3 py-1.5 text-zinc-300 hover:bg-zinc-900 hover:text-white flex items-center gap-2 cursor-pointer"
                                                                                    >
                                                                                        <PencilSquareIcon className="w-3.5 h-3.5 text-zinc-400" />
                                                                                        <span>Edit Message</span>
                                                                                    </button>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            setActiveMsgMenuId(null);
                                                                                            setCrewMsgToDelete(msg);
                                                                                            setDeleteMsgError(null);
                                                                                        }}
                                                                                        className="w-full text-left px-3 py-1.5 text-red-400 hover:bg-red-950/30 hover:text-red-300 border-t border-zinc-850 flex items-center gap-2 cursor-pointer"
                                                                                        >
                                                                                            <TrashIcon className="w-3.5 h-3.5 text-red-400" />
                                                                                            <span>Delete Message</span>
                                                                                        </button>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        )}

                                                                        {editingCrewMsgId === msg.id ? (
                                                                            <div className="space-y-2">
                                                                                <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono uppercase tracking-wider pb-1 border-b border-zinc-800">
                                                                                    <span className="flex items-center gap-1 text-emerald-400">
                                                                                        <PencilSquareIcon className="w-3 h-3" />
                                                                                        Edit Transmission
                                                                                    </span>
                                                                                    <span className="text-zinc-600">ESC to cancel</span>
                                                                                </div>
                                                                                <textarea
                                                                                    value={editingCrewMsgText}
                                                                                    onChange={(e) => setEditingCrewMsgText(e.target.value)}
                                                                                    onKeyDown={(e) => {
                                                                                        if (e.key === 'Enter' && !e.shiftKey) {
                                                                                            e.preventDefault();
                                                                                            handleSaveCrewMsgEdit(msg.id);
                                                                                        } else if (e.key === 'Escape') {
                                                                                            setEditingCrewMsgId(null);
                                                                                            setEditingCrewMsgText('');
                                                                                            setCrewMsgEditError(null);
                                                                                        }
                                                                                    }}
                                                                                    autoFocus
                                                                                    rows={3}
                                                                                    className="w-full bg-[#0a0a0c] border border-zinc-700 p-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 font-mono resize-none leading-relaxed"
                                                                                    placeholder="Edit your transmission..."
                                                                                />
                                                                                {crewMsgEditError && (
                                                                                    <div className="text-[11px] text-red-400 font-mono flex items-center gap-1">
                                                                                        <span>!</span> {crewMsgEditError}
                                                                                    </div>
                                                                                )}
                                                                                <div className="flex items-center justify-end gap-2 pt-1">
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            setEditingCrewMsgId(null);
                                                                                            setEditingCrewMsgText('');
                                                                                            setCrewMsgEditError(null);
                                                                                        }}
                                                                                        disabled={isSavingMsgEdit}
                                                                                        className="px-2.5 py-1 text-[11px] font-mono border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors"
                                                                                    >
                                                                                        Cancel
                                                                                    </button>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => handleSaveCrewMsgEdit(msg.id)}
                                                                                        disabled={isSavingMsgEdit || !editingCrewMsgText.trim()}
                                                                                        className="px-3 py-1 text-[11px] font-mono bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                                                                                    >
                                                                                        {isSavingMsgEdit ? (
                                                                                            <>
                                                                                                <div className="w-2.5 h-2.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                                                                <span>Saving...</span>
                                                                                            </>
                                                                                        ) : (
                                                                                            <span>Save Changes</span>
                                                                                        )}
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            <>
                                                                                <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] leading-relaxed font-mono min-w-0">
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
                                                                                <div
                                                                                    className={`mt-1.5 flex items-center gap-1.5 text-[10px] font-mono tabular-nums ${
                                                                                        isMe
                                                                                            ? 'text-zinc-500 justify-end'
                                                                                            : 'text-zinc-600 justify-start'
                                                                                    }`}
                                                                                >
                                                                                    {timeStr && <span>{timeStr}</span>}
                                                                                    {msg.editedAt && (
                                                                                        <span
                                                                                            className="text-[9px] uppercase tracking-wider text-zinc-500 bg-zinc-900/80 px-1 py-0.5 border border-zinc-800"
                                                                                            title={`Edited ${formatTimestamp(msg.editedAt)}`}
                                                                                        >
                                                                                            edited
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </>
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
                                    onAttachFile={() => crewFileInputRef.current?.click()}
                                    placeholder="// BROADCAST TO CREW SQUAD..."
                                    disabled={loadingCrewMsgs}
                                    isSending={sendingCrew}
                                    textareaRef={crewComposerRef}
                                />
                                <input
                                    type="file"
                                    ref={crewFileInputRef}
                                    onChange={handleCrewFileSelect}
                                    className="hidden"
                                />
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col bg-[#0c0c0e] h-full">
                                {/* Aligned placeholder header row sharing the top edge */}
                                <div className="h-14 px-4 sm:px-6 border-b border-zinc-800 bg-[#0c0c0e] flex items-center justify-between flex-shrink-0 font-mono">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                                            // SQUAD_WORKSPACE
                                        </span>
                                    </div>
                                    <span className="text-[10px] text-zinc-600 font-mono">// IDLE</span>
                                </div>
                                <div className="flex-1 flex items-center justify-center p-6 sm:p-8 text-center bg-[#0c0c0e]">
                                    <div className="max-w-md w-full border border-zinc-800 bg-[#0b0b0d] p-6 sm:p-8 space-y-4 font-mono shadow-xl">
                                        <div className="w-12 h-12 bg-zinc-900 border border-zinc-700 flex items-center justify-center mx-auto text-zinc-400">
                                            <UsersIcon className="w-6 h-6" />
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-[10px] text-zinc-500 uppercase tracking-widest">// SQUAD_TRANSMISSION</div>
                                            <h3 className="text-sm font-bold uppercase tracking-wider text-white">No Crew Selected</h3>
                                            <p className="text-xs text-zinc-400 leading-relaxed font-mono">
                                                Select a crew squadron from the left inbox or initialize a new group collaboration.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setShowCreateCrewModal(true)}
                                            className="px-4 py-2 bg-white hover:bg-zinc-200 text-black font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                                        >
                                            + Form Crew
                                        </button>
                                    </div>
                                </div>
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
                        {eligibleAcceptedComrades.length === 0 ? (
                            <div className="p-6 text-center text-zinc-500 text-xs">
                                <div className="font-bold text-zinc-400 mb-1 tracking-wider uppercase">// NO ACCEPTED CONNECTIONS</div>
                                <p className="text-[11px] text-zinc-400 leading-relaxed max-w-xs mx-auto">
                                    Direct comrade messaging is strictly authorized for mutual accepted connections. Connect with creators via the Network to initiate direct transmissions.
                                </p>
                            </div>
                        ) : (
                            eligibleAcceptedComrades
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

        {/* ---------------------------------------------------- */}
        {/* CREW INFO MODAL (All Members)                       */}
        {/* ---------------------------------------------------- */}
        {showCrewInfoModal && activeCrew && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                <div className="w-full max-w-2xl bg-[#0c0c0e] border border-zinc-800 shadow-2xl flex flex-col max-h-[90vh]">
                    {/* Header */}
                    <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-[#0e0e12]">
                        <div className="flex items-center gap-2">
                            <InformationCircleIcon className="w-4 h-4 text-emerald-400" />
                            <h2 className="text-sm font-bold uppercase tracking-wider text-white font-mono">
                                // SQUAD INTELLIGENCE [INFO]
                            </h2>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setShowCrewInfoModal(false);
                                setCrewInfoMemberFilter('');
                            }}
                            className="text-zinc-500 hover:text-white p-1 transition-colors cursor-pointer"
                        >
                            <CloseIcon className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Scrollable Body */}
                    <div className="p-5 overflow-y-auto space-y-6">
                        {/* Squad Identity Header Card */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 bg-[#111116] border border-zinc-800">
                            <div className="w-16 h-16 bg-zinc-900 border border-zinc-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                {activeCrew.avatarUrl ? (
                                    <img
                                        src={activeCrew.avatarUrl}
                                        alt={activeCrew.name}
                                        onError={handleImageError}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <span className="text-2xl font-bold font-mono text-emerald-400">
                                        {activeCrew.name.charAt(0).toUpperCase()}
                                    </span>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-base font-bold text-white font-mono">
                                        {activeCrew.name}
                                    </h3>
                                    <span className="text-[10px] font-mono px-2 py-0.5 bg-zinc-800 text-zinc-300 border border-zinc-700 uppercase tracking-wider">
                                        {crewMembers.length || activeCrew.memberCount || 1} Operatives
                                    </span>
                                    <span className={`text-[10px] font-mono px-2 py-0.5 uppercase tracking-wider border ${
                                        activeCrew.joinPolicy === 'approval_required'
                                            ? 'bg-amber-950/40 text-amber-300 border-amber-800'
                                            : 'bg-emerald-950/40 text-emerald-300 border-emerald-800'
                                    }`}>
                                        {activeCrew.joinPolicy === 'approval_required' ? 'Approval Required' : 'Direct Join Link'}
                                    </span>
                                </div>
                                <p className="text-xs text-zinc-400 mt-2 font-mono whitespace-pre-wrap leading-relaxed">
                                    {activeCrew.description || '(No squad operational directive recorded.)'}
                                </p>
                                <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] font-mono text-zinc-500">
                                    <span className="flex items-center gap-1.5">
                                        <ClockIcon className="w-3.5 h-3.5 text-zinc-600" />
                                        Created: {formatTimestamp(activeCrew.createdAt) || 'Unknown date'}
                                    </span>
                                    <span>•</span>
                                    <span className="flex items-center gap-1.5">
                                        <ShieldCheckIcon className="w-3.5 h-3.5 text-zinc-600" />
                                        Lead: <span className="text-zinc-300 font-semibold">{activeCrew.ownerName || 'Squad Lead'}</span>
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Crew Lead Highlight */}
                        <div className="p-3 bg-[#0a0a0d] border border-zinc-850 flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 bg-zinc-800 border border-zinc-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                                    {activeCrew.ownerPhotoURL ? (
                                        <img
                                            src={activeCrew.ownerPhotoURL}
                                            alt={activeCrew.ownerName || 'Lead'}
                                            onError={handleImageError}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <span className="text-xs font-bold font-mono text-zinc-300">
                                            {(activeCrew.ownerName || 'L').charAt(0)}
                                        </span>
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <div className="text-xs font-bold font-mono text-white flex items-center gap-1.5">
                                        <span>{activeCrew.ownerName || 'Squad Lead'}</span>
                                        <span className="text-[9px] px-1 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 uppercase font-mono">
                                            CREW LEAD
                                        </span>
                                    </div>
                                    <div className="text-[10px] font-mono text-zinc-500">
                                        {activeCrew.ownerUsername ? `@${activeCrew.ownerUsername}` : 'Command Node'}
                                    </div>
                                </div>
                            </div>
                            {activeCrew.ownerId && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCrewInfoModal(false);
                                        navigate(`/profile/${activeCrew.ownerId}`);
                                    }}
                                    className="px-2.5 py-1 text-[10px] font-mono border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white uppercase tracking-wider transition-colors"
                                >
                                    View Dossier
                                </button>
                            )}
                        </div>

                        {/* Members Section */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300 font-mono flex items-center gap-1.5">
                                    <UsersIcon className="w-3.5 h-3.5 text-zinc-400" />
                                    Operatives Roster ({crewMembers.length || 1})
                                </h4>
                                <div className="w-48">
                                    <input
                                        type="text"
                                        value={crewInfoMemberFilter}
                                        onChange={(e) => setCrewInfoMemberFilter(e.target.value)}
                                        placeholder="Filter operatives..."
                                        className="w-full px-2.5 py-1 bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-700"
                                    />
                                </div>
                            </div>

                            <div className="border border-zinc-800 divide-y divide-zinc-850 max-h-60 overflow-y-auto">
                                {crewMembers
                                    .filter((m) => {
                                        if (!crewInfoMemberFilter.trim()) return true;
                                        const query = crewInfoMemberFilter.toLowerCase();
                                        return (
                                            (m.displayName || '').toLowerCase().includes(query) ||
                                            (m.role || '').toLowerCase().includes(query)
                                        );
                                    })
                                    .map((member) => (
                                        <div
                                            key={member.id || member.userId}
                                            className="p-2.5 flex items-center justify-between hover:bg-zinc-900/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="w-7 h-7 bg-zinc-800 border border-zinc-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                                                    {member.photoURL ? (
                                                        <img
                                                            src={member.photoURL}
                                                            alt={member.displayName || 'Member'}
                                                            onError={handleImageError}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <span className="text-[10px] font-mono text-zinc-300">
                                                            {(member.displayName || '?').charAt(0)}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-xs font-mono font-medium text-zinc-200 truncate flex items-center gap-1.5">
                                                        <span>{member.displayName || 'Operative'}</span>
                                                        {member.userId === activeCrew.ownerId && (
                                                            <span className="text-[9px] px-1 py-0.2 bg-emerald-950/60 text-emerald-400 border border-emerald-800 font-mono">
                                                                LEAD
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[10px] font-mono text-zinc-500">
                                                        Role: {member.role || 'Operative'}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {member.userId && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setShowCrewInfoModal(false);
                                                            navigate(`/profile/${member.userId}`);
                                                        }}
                                                        className="px-2 py-0.5 text-[10px] font-mono text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-750 transition-colors"
                                                    >
                                                        Dossier
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-3 border-t border-zinc-800 bg-[#09090b] flex items-center justify-end">
                        <button
                            type="button"
                            onClick={() => {
                                setShowCrewInfoModal(false);
                                setCrewInfoMemberFilter('');
                            }}
                            className="px-4 py-1.5 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white text-xs font-mono uppercase tracking-wider transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* CREW SETTINGS MODAL (Admin / Owner Only)            */}
        {/* ---------------------------------------------------- */}
        {showCrewSettingsModal && activeCrew && activeCrew.ownerId === currentUser?.uid && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                <div className="w-full max-w-xl bg-[#0c0c0e] border border-zinc-800 shadow-2xl flex flex-col max-h-[90vh]">
                    {/* Header */}
                    <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-[#0e0e12]">
                        <div className="flex items-center gap-2">
                            <CogIcon className="w-4 h-4 text-emerald-400" />
                            <h2 className="text-sm font-bold uppercase tracking-wider text-white font-mono">
                                // CREW SETTINGS [ADMIN CONTROL]
                            </h2>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setShowCrewSettingsModal(false);
                                setCrewSettingsFeedback(null);
                            }}
                            className="text-zinc-500 hover:text-white p-1 transition-colors cursor-pointer"
                        >
                            <CloseIcon className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Tabs Bar */}
                    <div className="flex border-b border-zinc-800 bg-[#09090b] text-xs font-mono">
                        <button
                            type="button"
                            onClick={() => {
                                setCrewSettingsTab('general');
                                setCrewSettingsFeedback(null);
                            }}
                            className={`flex-1 py-2.5 px-3 uppercase tracking-wider font-semibold border-b-2 transition-colors ${
                                crewSettingsTab === 'general'
                                    ? 'border-emerald-500 text-emerald-400 bg-zinc-900/40'
                                    : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/20'
                            }`}
                        >
                            // General
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setCrewSettingsTab('invitation');
                                setCrewSettingsFeedback(null);
                            }}
                            className={`flex-1 py-2.5 px-3 uppercase tracking-wider font-semibold border-b-2 transition-colors ${
                                crewSettingsTab === 'invitation'
                                    ? 'border-emerald-500 text-emerald-400 bg-zinc-900/40'
                                    : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/20'
                            }`}
                        >
                            // Invitation Link
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setCrewSettingsTab('join_policy');
                                setCrewSettingsFeedback(null);
                            }}
                            className={`flex-1 py-2.5 px-3 uppercase tracking-wider font-semibold border-b-2 transition-colors ${
                                crewSettingsTab === 'join_policy'
                                    ? 'border-emerald-500 text-emerald-400 bg-zinc-900/40'
                                    : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/20'
                            }`}
                        >
                            // Join Policy
                        </button>
                    </div>

                    {/* Feedback Toast */}
                    {crewSettingsFeedback && (
                        <div className={`p-3 text-xs font-mono flex items-center gap-2 border-b ${
                            crewSettingsFeedback.type === 'success'
                                ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                                : 'bg-red-950/60 border-red-800 text-red-300'
                        }`}>
                            {crewSettingsFeedback.type === 'success' ? (
                                <CheckCircleIcon className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                            ) : (
                                <XCircleIcon className="w-4 h-4 text-red-400 flex-shrink-0" />
                            )}
                            <span>{crewSettingsFeedback.message}</span>
                        </div>
                    )}

                    {/* Tab Body */}
                    <div className="p-5 overflow-y-auto space-y-5">
                        {/* TAB A: GENERAL */}
                        {crewSettingsTab === 'general' && (
                            <form onSubmit={handleSaveCrewGeneralSettings} className="space-y-4">
                                <div>
                                    <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                                        Squad Designation / Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={settingsCrewName}
                                        onChange={(e) => setSettingsCrewName(e.target.value)}
                                        placeholder="Enter squad name..."
                                        required
                                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                                        Squad Operational Directive / Description
                                    </label>
                                    <textarea
                                        value={settingsCrewDesc}
                                        onChange={(e) => setSettingsCrewDesc(e.target.value)}
                                        rows={3}
                                        placeholder="Describe squad objective, domain, or mission..."
                                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 resize-none leading-relaxed"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                                        Squad Avatar URL (Optional)
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 bg-zinc-900 border border-zinc-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                            {settingsCrewAvatarUrl.trim() ? (
                                                <img
                                                    src={settingsCrewAvatarUrl.trim()}
                                                    alt="Avatar preview"
                                                    onError={handleImageError}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <span className="text-sm font-mono text-zinc-500">
                                                    {(settingsCrewName || 'C').charAt(0)}
                                                </span>
                                            )}
                                        </div>
                                        <input
                                            type="url"
                                            value={settingsCrewAvatarUrl}
                                            onChange={(e) => setSettingsCrewAvatarUrl(e.target.value)}
                                            placeholder="https://example.com/avatar.jpg"
                                            className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
                                        />
                                    </div>
                                    <p className="text-[10px] text-zinc-500 font-mono mt-1">
                                        Provide a direct URL to an avatar image asset.
                                    </p>
                                </div>

                                <div className="pt-2 flex items-center justify-end gap-2 border-t border-zinc-800">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSettingsCrewName(activeCrew.name || '');
                                            setSettingsCrewDesc(activeCrew.description || '');
                                            setSettingsCrewAvatarUrl(activeCrew.avatarUrl || '');
                                            setCrewSettingsFeedback(null);
                                        }}
                                        className="px-3 py-1.5 text-xs font-mono border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
                                    >
                                        Reset
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSavingCrewSettings || !settingsCrewName.trim()}
                                        className="px-4 py-1.5 text-xs font-mono bg-emerald-600 hover:bg-emerald-500 text-white font-medium uppercase tracking-wider flex items-center gap-2 transition-colors disabled:opacity-50"
                                    >
                                        {isSavingCrewSettings ? (
                                            <>
                                                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                <span>Saving...</span>
                                            </>
                                        ) : (
                                            <span>Save Parameters</span>
                                        )}
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* TAB B: INVITATION LINK */}
                        {crewSettingsTab === 'invitation' && (
                            <div className="space-y-5">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                                            Squad Invitation Link
                                        </label>
                                        {activeCrewInvite && (
                                            <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 border ${
                                                activeCrewInvite.status === 'active'
                                                    ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                                                    : 'bg-red-950 text-red-300 border-red-800'
                                            }`}>
                                                {activeCrewInvite.status === 'active' ? '[ACTIVE]' : '[REVOKED]'}
                                            </span>
                                        )}
                                    </div>

                                    {activeCrewInvite ? (
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs font-mono text-zinc-200 select-all truncate">
                                                    {getCrewInvitationUrl(activeCrewInvite.token, activeCrew.id)}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={handleCopyCrewInviteLink}
                                                    disabled={activeCrewInvite.status !== 'active'}
                                                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 transition-colors disabled:opacity-40"
                                                >
                                                    {inviteCopied ? (
                                                        <>
                                                            <CheckIcon className="w-3.5 h-3.5" />
                                                            <span>Copied!</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ClipboardIcon className="w-3.5 h-3.5" />
                                                            <span>Copy Link</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>

                                            {/* Link Metadata */}
                                            <div className="p-3 bg-[#0a0a0d] border border-zinc-850 space-y-1.5 text-[11px] font-mono text-zinc-400">
                                                <div className="flex justify-between">
                                                    <span className="text-zinc-500">Total Uses:</span>
                                                    <span className="text-zinc-200">{activeCrewInvite.usesCount || 0} accepted</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-zinc-500">Created:</span>
                                                    <span className="text-zinc-200">{formatTimestamp(activeCrewInvite.createdAt) || 'Active'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-zinc-500">Link Status:</span>
                                                    <span className={activeCrewInvite.status === 'active' ? 'text-emerald-400' : 'text-red-400'}>
                                                        {activeCrewInvite.status === 'active' ? 'Operational & accepting operatives' : 'Revoked — incoming connections blocked'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Link Actions */}
                                            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-800">
                                                <button
                                                    type="button"
                                                    onClick={handleGenerateOrRegenerateInvite}
                                                    disabled={isRegeneratingInvite}
                                                    className="px-3 py-1.5 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 transition-colors disabled:opacity-50"
                                                >
                                                    <RegenerateIcon className={`w-3.5 h-3.5 ${isRegeneratingInvite ? 'animate-spin' : ''}`} />
                                                    <span>Regenerate Link</span>
                                                </button>

                                                {activeCrewInvite.status === 'active' && (
                                                    <button
                                                        type="button"
                                                        onClick={handleRevokeCrewInvite}
                                                        disabled={isRevokingInvite}
                                                        className="px-3 py-1.5 border border-red-900/60 hover:border-red-700 text-red-400 hover:text-red-300 text-xs font-mono uppercase tracking-wider transition-colors disabled:opacity-50"
                                                    >
                                                        Revoke Link
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-4 bg-[#111116] border border-zinc-800 text-center space-y-3">
                                            <p className="text-xs font-mono text-zinc-400">
                                                No invitation link currently exists for this squad.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={handleGenerateOrRegenerateInvite}
                                                disabled={isRegeneratingInvite}
                                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono uppercase tracking-wider font-semibold transition-colors flex items-center justify-center gap-2 mx-auto disabled:opacity-50"
                                            >
                                                <LinkIcon className="w-3.5 h-3.5" />
                                                <span>Generate Squad Link</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* TAB C: JOIN SETTINGS */}
                        {crewSettingsTab === 'join_policy' && (
                            <div className="space-y-4">
                                <p className="text-xs font-mono text-zinc-400">
                                    Configure how new operatives join squad <strong className="text-zinc-200">{activeCrew.name}</strong> when using an active invitation link.
                                </p>

                                <div className="space-y-3">
                                    {/* Option 1: Open */}
                                    <label
                                        onClick={() => setSettingsJoinPolicy('open')}
                                        className={`p-3.5 border block cursor-pointer transition-all ${
                                            settingsJoinPolicy === 'open'
                                                ? 'bg-[#14141c] border-emerald-500 shadow-sm'
                                                : 'bg-[#0f0f13] border-zinc-800 hover:border-zinc-700'
                                        }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <input
                                                type="radio"
                                                name="crew_join_policy"
                                                checked={settingsJoinPolicy === 'open'}
                                                onChange={() => setSettingsJoinPolicy('open')}
                                                className="mt-1 accent-emerald-500 cursor-pointer"
                                            />
                                            <div className="space-y-1">
                                                <div className="text-xs font-bold font-mono text-white flex items-center gap-2">
                                                    <span>Anyone with the invitation link</span>
                                                    <span className="text-[9px] font-mono px-1.5 py-0.2 bg-emerald-950 text-emerald-300 border border-emerald-800 uppercase">
                                                        DIRECT ACCESS
                                                    </span>
                                                </div>
                                                <p className="text-[11px] font-mono text-zinc-400 leading-relaxed">
                                                    Operatives who navigate to a valid invitation link are admitted directly into the squad conversation without requiring manual lead approval.
                                                </p>
                                            </div>
                                        </div>
                                    </label>

                                    {/* Option 2: Approval Required */}
                                    <label
                                        onClick={() => setSettingsJoinPolicy('approval_required')}
                                        className={`p-3.5 border block cursor-pointer transition-all ${
                                            settingsJoinPolicy === 'approval_required'
                                                ? 'bg-[#14141c] border-emerald-500 shadow-sm'
                                                : 'bg-[#0f0f13] border-zinc-800 hover:border-zinc-700'
                                        }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <input
                                                type="radio"
                                                name="crew_join_policy"
                                                checked={settingsJoinPolicy === 'approval_required'}
                                                onChange={() => setSettingsJoinPolicy('approval_required')}
                                                className="mt-1 accent-emerald-500 cursor-pointer"
                                            />
                                            <div className="space-y-1">
                                                <div className="text-xs font-bold font-mono text-white flex items-center gap-2">
                                                    <span>Approval Required</span>
                                                    <span className="text-[9px] font-mono px-1.5 py-0.2 bg-amber-950 text-amber-300 border border-amber-800 uppercase">
                                                        GATED ACCESS
                                                    </span>
                                                </div>
                                                <p className="text-[11px] font-mono text-zinc-400 leading-relaxed">
                                                    Operatives who open the invitation link must submit a formal access request. The squad lead will review each request and manually grant or deny squad entry.
                                                </p>
                                            </div>
                                        </div>
                                    </label>
                                </div>

                                <div className="pt-3 flex items-center justify-between border-t border-zinc-800">
                                    <div className="text-[11px] font-mono text-zinc-500">
                                        Current Policy: <span className="text-zinc-300 font-bold uppercase">{activeCrew.joinPolicy === 'approval_required' ? 'Approval Required' : 'Direct Join Link'}</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleSaveCrewJoinPolicy(settingsJoinPolicy)}
                                        disabled={isSavingCrewSettings}
                                        className="px-4 py-1.5 text-xs font-mono bg-emerald-600 hover:bg-emerald-500 text-white font-medium uppercase tracking-wider flex items-center gap-2 transition-colors disabled:opacity-50"
                                    >
                                        {isSavingCrewSettings ? (
                                            <>
                                                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                <span>Updating...</span>
                                            </>
                                        ) : (
                                            <span>Apply Join Policy</span>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-3 border-t border-zinc-800 bg-[#09090b] flex items-center justify-end">
                        <button
                            type="button"
                            onClick={() => {
                                setShowCrewSettingsModal(false);
                                setCrewSettingsFeedback(null);
                            }}
                            className="px-4 py-1.5 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white text-xs font-mono uppercase tracking-wider transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* CREW JOIN REQUESTS MODAL (Admin / Owner Only)       */}
        {/* ---------------------------------------------------- */}
        {showJoinRequestsModal && activeCrew && activeCrew.ownerId === currentUser?.uid && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                <div className="w-full max-w-xl bg-[#0c0c0e] border border-zinc-800 shadow-2xl flex flex-col max-h-[85vh]">
                    {/* Header */}
                    <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-[#0e0e12]">
                        <div className="flex items-center gap-2">
                            <UsersIcon className="w-4 h-4 text-emerald-400" />
                            <h2 className="text-sm font-bold uppercase tracking-wider text-white font-mono">
                                // SQUAD JOIN REQUESTS [PENDING: {crewJoinRequests.length}]
                            </h2>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setShowJoinRequestsModal(false);
                                setRejectingRequestId(null);
                                setRejectionReasonText('');
                            }}
                            className="text-zinc-500 hover:text-white p-1 transition-colors cursor-pointer"
                        >
                            <CloseIcon className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Requests List */}
                    <div className="p-4 overflow-y-auto space-y-3">
                        {crewJoinRequests.length === 0 ? (
                            <div className="p-8 text-center border border-dashed border-zinc-800 bg-[#0a0a0d] space-y-2">
                                <UsersIcon className="w-8 h-8 text-zinc-700 mx-auto" />
                                <div className="text-xs font-mono text-zinc-400">
                                    No pending join requests for this squad.
                                </div>
                                <div className="text-[10px] font-mono text-zinc-600">
                                    When operatives request access via invitation link, their dossiers will appear here.
                                </div>
                            </div>
                        ) : (
                            crewJoinRequests.map((req) => (
                                <div
                                    key={req.id}
                                    className="p-3.5 bg-[#101015] border border-zinc-800 space-y-3"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-9 h-9 bg-zinc-800 border border-zinc-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                                                {req.userPhotoURL ? (
                                                    <img
                                                        src={req.userPhotoURL}
                                                        alt={req.userDisplayName}
                                                        onError={handleImageError}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <span className="text-xs font-bold font-mono text-zinc-300">
                                                        {(req.userDisplayName || 'O').charAt(0)}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-xs font-bold font-mono text-white truncate">
                                                    {req.userDisplayName}
                                                </div>
                                                <div className="text-[10px] font-mono text-zinc-400">
                                                    {req.username ? `@${req.username}` : req.userEmail || 'Operative'}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="text-[10px] font-mono text-zinc-500 flex-shrink-0">
                                            {formatTimestamp(req.createdAt)}
                                        </div>
                                    </div>

                                    {req.userHeadline && (
                                        <p className="text-[11px] font-mono text-zinc-400 bg-zinc-950/60 p-2 border border-zinc-850">
                                            {req.userHeadline}
                                        </p>
                                    )}

                                    {/* Reject Reason input if active */}
                                    {rejectingRequestId === req.id && (
                                        <div className="space-y-2 p-2.5 bg-red-950/20 border border-red-900/40">
                                            <label className="block text-[10px] font-mono uppercase tracking-wider text-red-300">
                                                Reason for Rejection (Optional)
                                            </label>
                                            <input
                                                type="text"
                                                value={rejectionReasonText}
                                                onChange={(e) => setRejectionReasonText(e.target.value)}
                                                placeholder="e.g. Squad capacity reached, or role mismatch..."
                                                className="w-full px-2.5 py-1.5 bg-black border border-red-900/60 text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-red-500"
                                            />
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setRejectingRequestId(null);
                                                        setRejectionReasonText('');
                                                    }}
                                                    className="px-2.5 py-1 text-[10px] font-mono border border-zinc-700 text-zinc-400 hover:text-white"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRejectJoinRequest(req)}
                                                    disabled={isProcessingJoinReq}
                                                    className="px-3 py-1 text-[10px] font-mono bg-red-600 hover:bg-red-500 text-white font-semibold uppercase tracking-wider disabled:opacity-50"
                                                >
                                                    Confirm Rejection
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {rejectingRequestId !== req.id && (
                                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-zinc-850">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setRejectingRequestId(req.id);
                                                    setRejectionReasonText('');
                                                }}
                                                disabled={isProcessingJoinReq}
                                                className="px-3 py-1 text-[11px] font-mono border border-zinc-700 hover:border-red-800 text-zinc-400 hover:text-red-400 uppercase tracking-wider transition-colors disabled:opacity-50"
                                            >
                                                Reject
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleApproveJoinRequest(req)}
                                                disabled={isProcessingJoinReq}
                                                className="px-3.5 py-1 text-[11px] font-mono bg-emerald-600 hover:bg-emerald-500 text-white font-medium uppercase tracking-wider flex items-center gap-1.5 transition-colors disabled:opacity-50"
                                            >
                                                <CheckIcon className="w-3.5 h-3.5" />
                                                <span>Admit Operative</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-3 border-t border-zinc-800 bg-[#09090b] flex items-center justify-end">
                        <button
                            type="button"
                            onClick={() => {
                                setShowJoinRequestsModal(false);
                                setRejectingRequestId(null);
                                setRejectionReasonText('');
                            }}
                            className="px-4 py-1.5 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white text-xs font-mono uppercase tracking-wider transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* CREW MESSAGE DELETE CONFIRMATION MODAL               */}
        {/* ---------------------------------------------------- */}
        {crewMsgToDelete && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
                <div className="w-full max-w-md bg-[#0e0e12] border border-zinc-800 shadow-2xl p-5 space-y-4">
                    <div className="flex items-center gap-2 text-red-400 border-b border-zinc-800 pb-2.5">
                        <TrashIcon className="w-4 h-4 flex-shrink-0" />
                        <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-white">
                            // PERMANENT DELETION
                        </h3>
                    </div>

                    <p className="text-xs font-mono text-zinc-300 leading-relaxed">
                        Are you sure you want to permanently delete this message from squad transmissions? This operation cannot be undone.
                    </p>

                    <div className="p-3 bg-[#08080a] border border-zinc-800 text-xs font-mono text-zinc-400 italic line-clamp-3">
                        "{crewMsgToDelete.text}"
                    </div>

                    {deleteMsgError && (
                        <div className="text-xs font-mono text-red-400 bg-red-950/40 p-2 border border-red-900">
                            {deleteMsgError}
                        </div>
                    )}

                    <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-800">
                        <button
                            type="button"
                            onClick={() => {
                                setCrewMsgToDelete(null);
                                setDeleteMsgError(null);
                            }}
                            disabled={isDeletingMsg}
                            className="px-3 py-1.5 text-xs font-mono border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirmDeleteCrewMsg}
                            disabled={isDeletingMsg}
                            className="px-4 py-1.5 text-xs font-mono bg-red-600 hover:bg-red-500 text-white font-medium uppercase tracking-wider transition-colors disabled:opacity-50 flex items-center gap-1.5"
                        >
                            {isDeletingMsg ? (
                                <>
                                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Deleting...</span>
                                </>
                            ) : (
                                <span>Delete Transmission</span>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* COMRADE MESSAGE DELETE CONFIRMATION MODAL            */}
        {/* ---------------------------------------------------- */}
        {comradeMsgToDelete && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
                <div className="w-full max-w-md bg-[#0e0e12] border border-zinc-800 shadow-2xl p-5 space-y-4">
                    <div className="flex items-center gap-2 text-red-400 border-b border-zinc-800 pb-2.5">
                        <TrashIcon className="w-4 h-4 flex-shrink-0" />
                        <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-white">
                            // PERMANENT DELETION
                        </h3>
                    </div>

                    <p className="text-xs font-mono text-zinc-300 leading-relaxed">
                        Are you sure you want to permanently delete this message from comrade transmissions? This operation cannot be undone.
                    </p>

                    <div className="p-3 bg-[#08080a] border border-zinc-800 text-xs font-mono text-zinc-400 italic line-clamp-3">
                        "{comradeMsgToDelete.text}"
                    </div>

                    {deleteComradeMsgError && (
                        <div className="text-xs font-mono text-red-400 bg-red-950/40 p-2 border border-red-900">
                            {deleteComradeMsgError}
                        </div>
                    )}

                    <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-800">
                        <button
                            type="button"
                            onClick={() => {
                                setComradeMsgToDelete(null);
                                setDeleteComradeMsgError(null);
                            }}
                            disabled={isDeletingComradeMsg}
                            className="px-3 py-1.5 text-xs font-mono border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirmDeleteComradeMsg}
                            disabled={isDeletingComradeMsg}
                            className="px-4 py-1.5 text-xs font-mono bg-red-600 hover:bg-red-500 text-white font-medium uppercase tracking-wider transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                        >
                            {isDeletingComradeMsg ? (
                                <>
                                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Deleting...</span>
                                </>
                            ) : (
                                <span>Delete Transmission</span>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* CREW DISBAND CONFIRMATION MODAL                      */}
        {/* ---------------------------------------------------- */}
        {showDisbandConfirmModal && activeCrew && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
                <div className="w-full max-w-md bg-[#0e0e12] border border-red-900/60 shadow-2xl p-5 space-y-4">
                    <div className="flex items-center gap-2 text-red-400 border-b border-red-900/40 pb-2.5">
                        <TrashIcon className="w-4 h-4 flex-shrink-0" />
                        <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-red-400">
                            // DISBAND CREW SQUAD
                        </h3>
                    </div>

                    <p className="text-xs font-mono text-zinc-300 leading-relaxed">
                        Warning: Disbanding squad <strong className="text-white">"{activeCrew.name}"</strong> will permanently delete all message history, remove all operative links, and revoke all active invitation tokens.
                    </p>

                    <div className="p-3 bg-red-950/20 border border-red-900/40 text-[11px] font-mono text-red-300">
                        This action is irreversible and executes immediate terminal decommission.
                    </div>

                    <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-800">
                        <button
                            type="button"
                            onClick={() => setShowDisbandConfirmModal(false)}
                            disabled={isDisbanding}
                            className="px-3 py-1.5 text-xs font-mono border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirmDisbandCrew}
                            disabled={isDisbanding}
                            className="px-4 py-1.5 text-xs font-mono bg-red-600 hover:bg-red-500 text-white font-medium uppercase tracking-wider transition-colors disabled:opacity-50 flex items-center gap-1.5"
                        >
                            {isDisbanding ? (
                                <>
                                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Decommissioning...</span>
                                </>
                            ) : (
                                <span>Disband Squad</span>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* INCOMING CREW INVITATION MODAL (Via URL parameter)  */}
        {/* ---------------------------------------------------- */}
        {incomingInviteModal.isOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
                <div className="w-full max-w-md bg-[#0c0c0e] border border-zinc-800 shadow-2xl p-6 space-y-5">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                        <div className="flex items-center gap-2">
                            <LinkIcon className="w-4 h-4 text-emerald-400" />
                            <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-white">
                                // SQUAD INVITATION
                            </h3>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                searchParams.delete('invite');
                                setSearchParams(searchParams, { replace: true });
                                setIncomingInviteModal(prev => ({ ...prev, isOpen: false }));
                            }}
                            className="text-zinc-500 hover:text-white transition-colors"
                        >
                            <CloseIcon className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Content Based on Status */}
                    {incomingInviteModal.status === 'loading' && (
                        <div className="py-8 text-center space-y-3">
                            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                            <p className="text-xs font-mono text-zinc-400">
                                Verifying squad invitation token credentials...
                            </p>
                        </div>
                    )}

                    {incomingInviteModal.status === 'invalid' && (
                        <div className="py-4 text-center space-y-3">
                            <div className="w-10 h-10 bg-red-950/60 border border-red-800 flex items-center justify-center mx-auto text-red-400">
                                <XCircleIcon className="w-6 h-6" />
                            </div>
                            <div className="text-xs font-bold font-mono text-white uppercase">
                                Invalid or Expired Invitation
                            </div>
                            <p className="text-[11px] font-mono text-zinc-400">
                                {incomingInviteModal.errorMsg || 'This squad invitation link is no longer operational, has expired, or was revoked by the squad lead.'}
                            </p>
                            <button
                                type="button"
                                onClick={() => {
                                    searchParams.delete('invite');
                                    setSearchParams(searchParams, { replace: true });
                                    setIncomingInviteModal(prev => ({ ...prev, isOpen: false }));
                                }}
                                className="px-4 py-2 border border-zinc-700 text-xs font-mono text-zinc-300 hover:text-white uppercase tracking-wider transition-colors"
                            >
                                Close Window
                            </button>
                        </div>
                    )}

                    {(incomingInviteModal.status === 'valid' ||
                      incomingInviteModal.status === 'submitting' ||
                      incomingInviteModal.status === 'submitted' ||
                      incomingInviteModal.status === 'joined' ||
                      incomingInviteModal.status === 'error') && incomingInviteModal.team && (
                        <div className="space-y-4">
                            {/* Squad Info Preview */}
                            <div className="p-4 bg-[#111116] border border-zinc-800 flex items-center gap-3.5">
                                <div className="w-12 h-12 bg-zinc-900 border border-zinc-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                    {incomingInviteModal.team.avatarUrl ? (
                                        <img
                                            src={incomingInviteModal.team.avatarUrl}
                                            alt={incomingInviteModal.team.name}
                                            onError={handleImageError}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <span className="text-lg font-mono font-bold text-emerald-400">
                                            {incomingInviteModal.team.name.charAt(0).toUpperCase()}
                                        </span>
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <h4 className="text-sm font-bold font-mono text-white truncate">
                                        {incomingInviteModal.team.name}
                                    </h4>
                                    <div className="text-[10px] font-mono text-zinc-500">
                                        Lead: {incomingInviteModal.team.ownerName || 'Squad Lead'} • {incomingInviteModal.team.memberCount || 1} Operatives
                                    </div>
                                </div>
                            </div>

                            {incomingInviteModal.team.description && (
                                <p className="text-xs font-mono text-zinc-400 bg-zinc-950/40 p-2.5 border border-zinc-850">
                                    {incomingInviteModal.team.description}
                                </p>
                            )}

                            {/* Error notification if any */}
                            {incomingInviteModal.status === 'error' && (
                                <div className="p-2.5 text-xs font-mono text-red-300 bg-red-950/40 border border-red-900">
                                    {incomingInviteModal.errorMsg || 'Action failed.'}
                                </div>
                            )}

                            {/* Already Member Case */}
                            {incomingInviteModal.isAlreadyMember ? (
                                <div className="space-y-3 pt-2 text-center">
                                    <p className="text-xs font-mono text-emerald-400">
                                        ✓ You are already an operative in squad "{incomingInviteModal.team.name}".
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            searchParams.delete('invite');
                                            setSearchParams(searchParams, { replace: true });
                                            setSelectedCrewId(incomingInviteModal.team!.id);
                                            setIncomingInviteModal(prev => ({ ...prev, isOpen: false }));
                                        }}
                                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs uppercase tracking-wider font-semibold transition-colors"
                                    >
                                        Open Squad Transmissions
                                    </button>
                                </div>
                            ) : incomingInviteModal.status === 'submitted' || incomingInviteModal.existingRequest ? (
                                <div className="space-y-3 pt-2 text-center">
                                    <div className="p-3 bg-amber-950/30 border border-amber-900 text-xs font-mono text-amber-300 space-y-1">
                                        <div className="font-bold uppercase tracking-wider">Access Request Pending</div>
                                        <p className="text-[11px] text-zinc-400">
                                            Your request has been delivered to squad lead <strong>{incomingInviteModal.team.ownerName || 'Admin'}</strong>. You will gain access once approved.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            searchParams.delete('invite');
                                            setSearchParams(searchParams, { replace: true });
                                            setIncomingInviteModal(prev => ({ ...prev, isOpen: false }));
                                        }}
                                        className="w-full py-2 border border-zinc-700 text-zinc-300 hover:text-white font-mono text-xs uppercase tracking-wider transition-colors"
                                    >
                                        Acknowledge & Close
                                    </button>
                                </div>
                            ) : incomingInviteModal.status === 'joined' ? (
                                <div className="space-y-3 pt-2 text-center">
                                    <p className="text-xs font-mono text-emerald-400 font-bold uppercase tracking-wider">
                                        ✓ Squad Entry Authorized! Transmitting...
                                    </p>
                                </div>
                            ) : (
                                <div className="pt-2 space-y-2">
                                    {incomingInviteModal.invitation?.joinPolicy === 'approval_required' ? (
                                        <button
                                            type="button"
                                            onClick={handleRequestIncomingInviteAccess}
                                            disabled={incomingInviteModal.status === 'submitting'}
                                            className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-mono text-xs uppercase tracking-wider font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            {incomingInviteModal.status === 'submitting' ? (
                                                <>
                                                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    <span>Submitting Request...</span>
                                                </>
                                            ) : (
                                                <span>Request Squad Access</span>
                                            )}
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={handleAcceptIncomingInvite}
                                            disabled={incomingInviteModal.status === 'submitting'}
                                            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs uppercase tracking-wider font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            {incomingInviteModal.status === 'submitting' ? (
                                                <>
                                                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    <span>Entering Squad...</span>
                                                </>
                                            ) : (
                                                <span>Join Squad Transmissions</span>
                                            )}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        )}
    </div>
);
};

export default HubConversationsView;
