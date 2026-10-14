import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
    createTeam,
    subscribeToUserTeams,
    subscribeToTeam,
    subscribeToTeamMembers,
    subscribeToTeamMessages,
    sendTeamMessage,
    markTeamAsRead,
    createTeamInvitation,
    getTeamInvitation,
    getTeam,
    subscribeToTeamInvitations,
    revokeTeamInvitation,
    joinTeamViaInvitation,
    subscribeToUserTeamUnreadCounts,
    getProjectAcceptedCollaborators,
    deleteTeamMessage,
    leaveTeam,
    removeTeamMember,
    deleteTeam,
    type Team,
    type TeamMember,
    type TeamMessage,
    type TeamInvitation,
} from '../../services/teamService';
import { subscribeToUserPosts } from '../../services/postService';
import { handleImageError } from '../utils/imageUtils';
import { EllipsisVerticalIcon, Maximize2Icon, Minimize2Icon, TrashIcon, LogoutIcon } from '../ui/Icons';
import { ClickableMessageText } from '../ui/ClickableMessageText';
import { TeamInvitationCard } from '../ui/TeamInvitationCard';
import { getTeamInvitationUrl } from '../../utils/urlUtils';
import type { Post, CollabApplication } from '../../types';

interface CollabTeamsViewProps {
    onBack?: () => void;
    initialTeamId?: string | null;
}

export const CollabTeamsView: React.FC<CollabTeamsViewProps> = ({
    onBack,
    initialTeamId,
}) => {
    const { currentUser, userProfile } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    // Query parameters
    const urlTeamId = searchParams.get('teamId') || initialTeamId || null;
    const urlInviteToken = searchParams.get('invite') || null;

    // Local state
    const [teams, setTeams] = useState<Team[]>([]);
    const [loadingTeams, setLoadingTeams] = useState<boolean>(true);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [teamUnreadMap, setTeamUnreadMap] = useState<Record<string, number>>({});

    // Selected Team state
    const [selectedTeamId, setSelectedTeamId] = useState<string | null>(urlTeamId);
    const [activeTeam, setActiveTeam] = useState<Team | null>(null);
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [messages, setMessages] = useState<TeamMessage[]>([]);
    const [messagesLoading, setMessagesLoading] = useState<boolean>(false);
    const [inputText, setInputText] = useState<string>('');
    const [isSending, setIsSending] = useState<boolean>(false);

    // Panels & Modals
    const [showMembersDrawer, setShowMembersDrawer] = useState<boolean>(false);
    const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
    const [showInviteModal, setShowInviteModal] = useState<boolean>(false);
    const [showProjectModal, setShowProjectModal] = useState<boolean>(false);
    const [showMenu, setShowMenu] = useState<boolean>(false);

    // Message actions & deletion state
    const [activeMessageMenuId, setActiveMessageMenuId] = useState<string | null>(null);
    const [messageToDelete, setMessageToDelete] = useState<TeamMessage | null>(null);
    const [isDeletingMessage, setIsDeletingMessage] = useState<boolean>(false);
    const [deleteMessageError, setDeleteMessageError] = useState<string | null>(null);

    // Leave / Disband Team state
    const [showLeaveModal, setShowLeaveModal] = useState<boolean>(false);
    const [isLeavingTeam, setIsLeavingTeam] = useState<boolean>(false);
    const [leaveTeamError, setLeaveTeamError] = useState<string | null>(null);

    // Remove Member state
    const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);
    const [isRemovingMember, setIsRemovingMember] = useState<boolean>(false);
    const [removeMemberError, setRemoveMemberError] = useState<string | null>(null);

    // Create Team form state
    const [createName, setCreateName] = useState<string>('');
    const [createDesc, setCreateDesc] = useState<string>('');
    const [createProjectId, setCreateProjectId] = useState<string>('');
    const [userProjects, setUserProjects] = useState<Post[]>([]);
    const [isCreatingTeam, setIsCreatingTeam] = useState<boolean>(false);
    const [createError, setCreateError] = useState<string | null>(null);

    // Invitations management state
    const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
    const [acceptedCollabs, setAcceptedCollabs] = useState<CollabApplication[]>([]);
    const [copiedToken, setCopiedToken] = useState<string | null>(null);
    const [isGeneratingInvite, setIsGeneratingInvite] = useState<boolean>(false);

    // Join Invitation state
    const [inviteData, setInviteData] = useState<TeamInvitation | null>(null);
    const [inviteTeam, setInviteTeam] = useState<Team | null>(null);
    const [isAlreadyMember, setIsAlreadyMember] = useState<boolean>(false);
    const [inviteLoading, setInviteLoading] = useState<boolean>(Boolean(urlInviteToken));
    const [inviteError, setInviteError] = useState<string | null>(null);
    const [isJoining, setIsJoining] = useState<boolean>(false);
    const [joinSuccess, setJoinSuccess] = useState<boolean>(false);

    // Expand / collapse chat workspace state
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

    // Close active message menu on outside click or Escape key
    useEffect(() => {
        if (!activeMessageMenuId) return;

        const handleOutsideMessageClick = () => {
            setActiveMessageMenuId(null);
        };

        const handleMessageKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setActiveMessageMenuId(null);
            }
        };

        document.addEventListener('click', handleOutsideMessageClick);
        document.addEventListener('keydown', handleMessageKeyDown);

        return () => {
            document.removeEventListener('click', handleOutsideMessageClick);
            document.removeEventListener('keydown', handleMessageKeyDown);
        };
    }, [activeMessageMenuId]);

    // Close active modal, drawer, or collapse expanded chat on Escape key
    useEffect(() => {
        const handleModalEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                if (messageToDelete && !isDeletingMessage) setMessageToDelete(null);
                else if (showLeaveModal && !isLeavingTeam) setShowLeaveModal(false);
                else if (memberToRemove && !isRemovingMember) setMemberToRemove(null);
                else if (showInviteModal) setShowInviteModal(false);
                else if (showProjectModal) setShowProjectModal(false);
                else if (showCreateModal) setShowCreateModal(false);
                else if (showMembersDrawer) setShowMembersDrawer(false);
                else if (isExpanded) setIsExpanded(false);
            }
        };

        if (
            messageToDelete ||
            showLeaveModal ||
            memberToRemove ||
            showInviteModal ||
            showProjectModal ||
            showCreateModal ||
            showMembersDrawer ||
            isExpanded
        ) {
            document.addEventListener('keydown', handleModalEscape);
            return () => {
                document.removeEventListener('keydown', handleModalEscape);
            };
        }
    }, [
        messageToDelete,
        isDeletingMessage,
        showLeaveModal,
        isLeavingTeam,
        memberToRemove,
        isRemovingMember,
        showInviteModal,
        showProjectModal,
        showCreateModal,
        showMembersDrawer,
        isExpanded,
    ]);

    // Reset menu when switching teams
    useEffect(() => {
        setShowMenu(false);
        setActiveMessageMenuId(null);
    }, [selectedTeamId]);

    // 1. Sync URL teamId with local state
    useEffect(() => {
        if (urlTeamId) {
            setSelectedTeamId(urlTeamId);
        } else {
            setSelectedTeamId(null);
        }
    }, [urlTeamId]);

    // 2. Fetch user's teams
    useEffect(() => {
        if (!currentUser?.uid) {
            setTeams([]);
            setLoadingTeams(false);
            return;
        }

        setLoadingTeams(true);
        const unsub = subscribeToUserTeams(
            currentUser.uid,
            (userTeams) => {
                setTeams(userTeams);
                setLoadingTeams(false);
            },
            (err) => {
                console.error('[TEAMS_LOAD_ERROR]', err);
                setTeams([]);
                setLoadingTeams(false);
            }
        );

        return () => {
            unsub();
        };
    }, [currentUser?.uid]);

    // 3. Track real-time unread counts
    useEffect(() => {
        if (!currentUser?.uid) {
            setTeamUnreadMap({});
            return;
        }

        const unsubUnread = subscribeToUserTeamUnreadCounts(
            currentUser.uid,
            (res) => {
                setTeamUnreadMap(res.teamUnreadMap);
            },
            selectedTeamId
        );

        return () => {
            unsubUnread();
        };
    }, [currentUser?.uid, selectedTeamId]);

    // 4. Fetch user's owned collabs for the Create Team selector
    useEffect(() => {
        if (!currentUser?.uid) {
            setUserProjects([]);
            return;
        }

        const unsubPosts = subscribeToUserPosts(
            currentUser.uid,
            (posts) => {
                const collabs = posts.filter(
                    (p) => p.category === 'collab' || p.type === 'collab' || Boolean(p.collabDetails)
                );
                setUserProjects(collabs);
                if (collabs.length > 0 && !createProjectId) {
                    setCreateProjectId(collabs[0].id);
                }
            },
            (err) => {
                console.warn('[USER_POSTS_FOR_TEAMS_WARN]', err);
            }
        );

        return () => {
            unsubPosts();
        };
    }, [currentUser?.uid]);

    // 5. Subscribe to selected team details
    useEffect(() => {
        if (!selectedTeamId) {
            setActiveTeam(null);
            return;
        }

        const unsubTeam = subscribeToTeam(selectedTeamId, (team) => {
            if (!team) {
                // Team was deleted or not found
                setActiveTeam(null);
                setSelectedTeamId(null);
                setSearchParams((prev) => {
                    const next = new URLSearchParams(prev);
                    next.delete('teamId');
                    return next;
                });
                return;
            }

            // Verify current user still has membership access
            if (currentUser?.uid) {
                const isMemberOrOwner =
                    team.ownerId === currentUser.uid ||
                    (Array.isArray(team.memberIds) && team.memberIds.includes(currentUser.uid));

                if (!isMemberOrOwner) {
                    // Former member no longer has access; immediately clear active chat
                    setActiveTeam(null);
                    setSelectedTeamId(null);
                    setMessages([]);
                    setMembers([]);
                    setSearchParams((prev) => {
                        const next = new URLSearchParams(prev);
                        next.delete('teamId');
                        return next;
                    });
                    return;
                }
            }

            setActiveTeam(team);
        });

        return () => {
            unsubTeam();
        };
    }, [selectedTeamId, currentUser?.uid, setSearchParams]);

    // 6. Subscribe to members of selected team
    useEffect(() => {
        if (!selectedTeamId) {
            setMembers([]);
            return;
        }

        const unsubMembers = subscribeToTeamMembers(selectedTeamId, (mList) => {
            setMembers(mList);
        });

        return () => {
            unsubMembers();
        };
    }, [selectedTeamId]);

    // 7. Subscribe to messages of selected team & mark as read
    useEffect(() => {
        if (!selectedTeamId) {
            setMessages([]);
            setMessagesLoading(false);
            return;
        }

        setMessagesLoading(true);
        const unsubMsgs = subscribeToTeamMessages(
            selectedTeamId,
            (newMsgs) => {
                setMessages(newMsgs);
                setMessagesLoading(false);
                // Mark team as read
                if (currentUser?.uid) {
                    markTeamAsRead(selectedTeamId, currentUser.uid);
                }
            },
            (err) => {
                console.warn('[SUBSCRIBE_TEAM_MESSAGES_ERROR]', err);
                setMessages([]);
                setMessagesLoading(false);
            }
        );

        return () => {
            unsubMsgs();
        };
    }, [selectedTeamId, currentUser?.uid]);

    // 8. Auto-scroll on new messages
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    // 9. Subscribe to invitations for selected team
    useEffect(() => {
        if (!selectedTeamId) {
            setInvitations([]);
            return;
        }

        const unsubInvites = subscribeToTeamInvitations(selectedTeamId, (invs) => {
            setInvitations(invs);
        });

        return () => {
            unsubInvites();
        };
    }, [selectedTeamId]);

    // 10. Fetch accepted collaborators for the project
    useEffect(() => {
        if (!activeTeam?.projectId) {
            setAcceptedCollabs([]);
            return;
        }

        getProjectAcceptedCollaborators(activeTeam.projectId).then((apps) => {
            setAcceptedCollabs(apps);
        });
    }, [activeTeam?.projectId]);

    // 11. Handle Invite Token inspection if URL has `invite` param
    useEffect(() => {
        if (!urlInviteToken) {
            setInviteData(null);
            setInviteTeam(null);
            setIsAlreadyMember(false);
            setInviteLoading(false);
            return;
        }

        setInviteLoading(true);
        setInviteError(null);
        setIsAlreadyMember(false);

        getTeamInvitation(urlInviteToken)
            .then(async (inv) => {
                if (!inv) {
                    setInviteError('Invalid invitation: This invitation link does not exist or has been removed.');
                    setInviteLoading(false);
                    return;
                }
                if (inv.status === 'revoked') {
                    setInviteError('Invitation revoked: This invitation link has been revoked by the project owner.');
                    setInviteLoading(false);
                    return;
                }
                if (inv.expiresAt) {
                    const expTime = typeof inv.expiresAt?.toDate === 'function'
                        ? inv.expiresAt.toDate().getTime()
                        : new Date(inv.expiresAt).getTime();
                    if (expTime > 0 && Date.now() > expTime) {
                        setInviteError('Invitation expired: This invitation link has expired.');
                        setInviteLoading(false);
                        return;
                    }
                }
                if (inv.maxUses && inv.maxUses > 0 && inv.usedCount >= inv.maxUses) {
                    setInviteError('Invitation limit reached: This invitation link has already reached its maximum allowed uses.');
                    setInviteLoading(false);
                    return;
                }

                setInviteData(inv);

                // Identify team & check whether user is already a member
                try {
                    const team = await getTeam(inv.teamId);
                    if (team) {
                        setInviteTeam(team);
                        if (currentUser?.uid) {
                            const isMember =
                                (Array.isArray(team.memberIds) && team.memberIds.includes(currentUser.uid)) ||
                                team.ownerId === currentUser.uid;
                            setIsAlreadyMember(Boolean(isMember));
                        }
                    } else {
                        setInviteError('Team not found: The project team for this invitation no longer exists.');
                    }
                } catch (teamErr) {
                    console.warn('[CHECK_TEAM_INVITE_WARN]', teamErr);
                }

                setInviteLoading(false);
            })
            .catch((err) => {
                setInviteError(err?.message || 'Failed to inspect invitation.');
                setInviteLoading(false);
            });
    }, [urlInviteToken, currentUser?.uid]);

    // Check if current user is owner of active team
    const isOwner = Boolean(
        currentUser?.uid && activeTeam && (activeTeam.ownerId === currentUser.uid)
    );

    // Filter teams by search query
    const filteredTeams = useMemo(() => {
        if (!searchQuery.trim()) return teams;
        const q = searchQuery.toLowerCase().trim();
        return teams.filter(
            (t) =>
                t.name?.toLowerCase().includes(q) ||
                t.projectTitle?.toLowerCase().includes(q) ||
                t.ownerName?.toLowerCase().includes(q)
        );
    }, [teams, searchQuery]);

    // Helper: Select a team
    const handleSelectTeam = (teamId: string) => {
        setSelectedTeamId(teamId || null);
        if (!teamId) {
            setIsExpanded(false);
        }
        if (currentUser?.uid && teamId) {
            markTeamAsRead(teamId, currentUser.uid);
        }
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set('tab', 'Collabs');
            next.set('collabView', 'teams');
            if (teamId) {
                next.set('teamId', teamId);
            } else {
                next.delete('teamId');
            }
            next.delete('invite');
            return next;
        });
    };

    // Helper: Create a new Team
    const handleCreateTeamSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;

        const cleanName = createName.trim();
        if (!cleanName) {
            setCreateError('Team name is required.');
            return;
        }

        const project = userProjects.find((p) => p.id === createProjectId);
        if (!project) {
            setCreateError('Please select a valid project you own.');
            return;
        }

        setIsCreatingTeam(true);
        setCreateError(null);

        try {
            const { team } = await createTeam({
                name: cleanName,
                description: createDesc,
                project,
                user: currentUser,
                userProfile,
            });

            setShowCreateModal(false);
            setCreateName('');
            setCreateDesc('');
            // Open the new team directly
            handleSelectTeam(team.id);
            // Open invite modal so owner can immediately share the link
            setShowInviteModal(true);
        } catch (err: any) {
            console.error('[CREATE_TEAM_ERROR]', err);
            setCreateError(err?.message || 'Failed to create team. Please try again.');
        } finally {
            setIsCreatingTeam(false);
        }
    };

    // Helper: Send message
    const handleSendMessage = async () => {
        if (!inputText.trim() || !selectedTeamId || !currentUser?.uid || isSending) {
            return;
        }

        const text = inputText.trim();
        setInputText('');
        setIsSending(true);

        try {
            await sendTeamMessage({
                teamId: selectedTeamId,
                senderId: currentUser.uid,
                senderName: userProfile?.displayName || currentUser.displayName || 'Team Member',
                senderAvatar: userProfile?.photoURL || currentUser.photoURL || null,
                text,
            });
        } catch (err) {
            console.error('[SEND_TEAM_MSG_ERROR]', err);
            setInputText(text); // Restore text on error
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

    // Helper: Confirm Delete Message
    const handleConfirmDeleteMessage = async () => {
        if (!messageToDelete || !activeTeam || !currentUser?.uid) return;
        setIsDeletingMessage(true);
        setDeleteMessageError(null);

        try {
            await deleteTeamMessage({
                teamId: activeTeam.id,
                messageId: messageToDelete.id,
                userId: currentUser.uid,
            });

            // Optimistically update message list locally
            setMessages((prev) => prev.filter((m) => m.id !== messageToDelete.id));
            setMessageToDelete(null);
        } catch (err: any) {
            console.error('[DELETE_TEAM_MESSAGE_ERROR]', err);
            setDeleteMessageError(err?.message || 'Failed to delete message. Please try again.');
        } finally {
            setIsDeletingMessage(false);
        }
    };

    // Helper: Confirm Leave or Disband Team
    const handleConfirmLeaveOrDisband = async () => {
        if (!activeTeam || !currentUser?.uid) return;
        setIsLeavingTeam(true);
        setLeaveTeamError(null);

        const teamToLeaveId = activeTeam.id;

        try {
            await leaveTeam({
                teamId: teamToLeaveId,
                userId: currentUser.uid,
                userName: userProfile?.displayName || currentUser.displayName || 'Collaborator',
            });

            // 1. Immediately reset active team state
            setActiveTeam(null);
            setSelectedTeamId(null);
            setMessages([]);
            setMembers([]);
            setShowLeaveModal(false);
            setShowMembersDrawer(false);
            setIsExpanded(false);

            // 2. Remove teamId from URL
            setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.delete('teamId');
                return next;
            });

            // 3. Remove from local teams list
            setTeams((prev) => prev.filter((t) => t.id !== teamToLeaveId));
        } catch (err: any) {
            console.error('[LEAVE_TEAM_ERROR]', err);
            setLeaveTeamError(err?.message || 'Failed to process team leave request.');
        } finally {
            setIsLeavingTeam(false);
        }
    };

    // Helper: Confirm Remove Team Member (Owner Moderation)
    const handleConfirmRemoveMember = async () => {
        if (!memberToRemove || !activeTeam || !currentUser?.uid) return;
        setIsRemovingMember(true);
        setRemoveMemberError(null);

        try {
            await removeTeamMember({
                teamId: activeTeam.id,
                memberUserId: memberToRemove.userId,
                requesterUserId: currentUser.uid,
                memberName: memberToRemove.displayName,
            });

            setMembers((prev) => prev.filter((m) => m.userId !== memberToRemove.userId));
            setMemberToRemove(null);
        } catch (err: any) {
            console.error('[REMOVE_MEMBER_ERROR]', err);
            setRemoveMemberError(err?.message || 'Failed to remove member.');
        } finally {
            setIsRemovingMember(false);
        }
    };

    // Helper: Generate / Regenerate invite token
    const handleGenerateNewInvite = async () => {
        if (!activeTeam || !currentUser || isGeneratingInvite) return;
        setIsGeneratingInvite(true);
        try {
            if (activeInvite?.token) {
                await revokeTeamInvitation(activeInvite.token, currentUser.uid).catch(() => {});
            }
            await createTeamInvitation({
                teamId: activeTeam.id,
                teamName: activeTeam.name,
                projectId: activeTeam.projectId,
                projectTitle: activeTeam.projectTitle,
                ownerId: activeTeam.ownerId,
                ownerName: activeTeam.ownerName,
                user: currentUser,
            });
            setCopiedToken(null);
        } catch (err) {
            console.error('[GENERATE_INVITE_ERROR]', err);
        } finally {
            setIsGeneratingInvite(false);
        }
    };

    // Helper: Revoke invite
    const handleRevokeInvite = async (token: string) => {
        if (!currentUser?.uid) return;
        try {
            await revokeTeamInvitation(token, currentUser.uid);
        } catch (err) {
            console.error('[REVOKE_INVITE_ERROR]', err);
        }
    };

    // Helper: Copy invite URL
    const getInviteUrl = (token: string, teamId?: string) => {
        return getTeamInvitationUrl(token, teamId || activeTeam?.id);
    };

    const handleCopyToken = async (token: string, teamId?: string) => {
        const url = getInviteUrl(token, teamId || activeTeam?.id);
        if (!url) return;
        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(url);
            } else {
                const textArea = document.createElement('textarea');
                textArea.value = url;
                textArea.style.position = 'fixed';
                textArea.style.left = '-9999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }
            setCopiedToken(token);
            setTimeout(() => setCopiedToken(null), 2500);
        } catch (err) {
            console.error('[COPY_INVITE_TOKEN_ERROR]', err);
        }
    };

    // Helper: Join Team via Invitation
    const handleJoinTeam = async () => {
        if (!inviteData || !currentUser || isJoining) return;
        setIsJoining(true);
        setInviteError(null);
        try {
            const res = await joinTeamViaInvitation({
                token: inviteData.token,
                user: currentUser,
                userProfile,
            });
            setJoinSuccess(true);
            setTimeout(() => {
                // Navigate directly into the joined team chat
                setSelectedTeamId(res.team.id);
                setSearchParams((prev) => {
                    const next = new URLSearchParams(prev);
                    next.set('tab', 'Collabs');
                    next.set('collabView', 'teams');
                    next.set('teamId', res.team.id);
                    next.delete('invite');
                    return next;
                });
            }, 600);
        } catch (err: any) {
            setInviteError(err?.message || 'Failed to join team.');
        } finally {
            setIsJoining(false);
        }
    };

    // Helper: Timestamp formatter matching Inbox compact format
    const formatTimestamp = (val: any) => {
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

    // -------------------------------------------------------------
    // RENDER: INVITATION REVIEW VIEW (if urlInviteToken is present)
    // -------------------------------------------------------------
    if (urlInviteToken) {
        const inviteUrl = getInviteUrl(urlInviteToken, urlTeamId);
        return (
            <div className="space-y-4 font-mono">
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                    <div>
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest block font-bold">// TEAM INVITATION</span>
                        <h2 className="text-sm sm:text-base font-bold text-white uppercase tracking-wider">
                            PROJECT TEAM INVITATION
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={() => handleSelectTeam('')}
                        className="px-2.5 py-1 bg-transparent hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer font-mono"
                    >
                        <span>←</span>
                        <span>// ALL TEAMS</span>
                    </button>
                </div>

                <div className="flex flex-col items-center justify-center py-6 sm:py-12">
                    <TeamInvitationCard
                        inviteUrl={inviteUrl}
                        token={urlInviteToken}
                        teamId={urlTeamId}
                        targetHash={`#/spotlight?tab=Collabs&collabView=teams${urlTeamId ? `&teamId=${urlTeamId}` : ''}&invite=${urlInviteToken}`}
                        onOpenTeamChat={(tId) => {
                            handleSelectTeam(tId);
                        }}
                        onJoined={(joinedTeam) => {
                            setSelectedTeamId(joinedTeam.id);
                            setSearchParams((prev) => {
                                const next = new URLSearchParams(prev);
                                next.set('tab', 'Collabs');
                                next.set('collabView', 'teams');
                                next.set('teamId', joinedTeam.id);
                                next.delete('invite');
                                return next;
                            });
                        }}
                    />
                </div>
            </div>
        );
    }

    const activeInvite = invitations.find((i) => i.status === 'active') || invitations[0];
    const activeInviteUrl = activeInvite ? getInviteUrl(activeInvite.token, activeTeam?.id) : '';

    // -------------------------------------------------------------
    // RENDER: UNIFIED TWO-PANEL TEAMS MESSAGING INTERFACE
    // -------------------------------------------------------------
    const workspaceContent = (
        <div
            className={`font-mono ${
                isExpanded
                    ? 'fixed inset-0 w-screen h-screen h-[100dvh] z-[100] bg-[#0c0c0e] flex flex-col m-0 p-0 overflow-hidden'
                    : 'space-y-4'
            }`}
        >
            {/* 1. View Header: Matches existing INVOX layout with polished alignment */}
            <div className={`flex items-center justify-between border-b border-zinc-800 ${isExpanded ? 'flex-shrink-0 px-4 sm:px-6 py-3.5 bg-[#0c0c0e]' : 'px-0 pb-3'}`}>
                {/* Left: Section Label and Title */}
                <div className="flex flex-col justify-center gap-0.5">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest block font-bold leading-none">
                        // MESSAGE BOARD
                    </span>
                    <h2 className="text-sm sm:text-base font-bold text-white uppercase tracking-wider leading-tight">
                        TEAMS
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
                        onClick={() => {
                            setCreateError(null);
                            setShowCreateModal(true);
                        }}
                        className="h-8 px-3 sm:px-3.5 bg-white hover:bg-zinc-200 text-black font-bold text-xs uppercase tracking-wider transition-colors inline-flex items-center justify-center cursor-pointer font-mono whitespace-nowrap"
                    >
                        // CREATE TEAM
                    </button>
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

            {/* 2. Two-Panel Messaging Workspace (Proportions: ~32% Left, ~68% Right) */}
            <div
                className={`bg-[#0c0c0e] font-mono grid grid-cols-1 md:grid-cols-[32%_68%] overflow-hidden ${
                    isExpanded ? 'flex-1 min-h-0 border-0' : 'border border-zinc-800 h-[600px] sm:h-[640px]'
                }`}
            >
                {/* ─────────────────────────────────────────────────────────── */}
                {/* LEFT PANEL: YOUR TEAMS LIST (~32%)                          */}
                {/* ─────────────────────────────────────────────────────────── */}
                <aside
                    className={`border-b md:border-b-0 md:border-r border-zinc-800 flex flex-col h-full overflow-hidden ${
                        selectedTeamId ? 'hidden md:flex' : 'flex'
                    }`}
                >
                    {/* Header: // YOUR TEAMS */}
                    <div className="px-3.5 py-3 border-b border-zinc-800 flex items-center justify-between bg-black/40 flex-shrink-0">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                                // YOUR TEAMS
                            </span>
                            {teams.length > 0 && (
                                <span className="text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-400 px-1.5 py-0.2 font-mono">
                                    {teams.length}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Compact Search Field: // SEARCH TEAMS... */}
                    <div className="px-3 py-2 border-b border-zinc-800 bg-[#09090b] flex items-center gap-2 flex-shrink-0">
                        <span className="text-zinc-600 text-xs font-bold font-mono">//</span>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="SEARCH TEAMS..."
                            className="w-full bg-transparent text-xs text-white placeholder-zinc-600 focus:outline-none font-mono"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="text-zinc-500 hover:text-white text-xs cursor-pointer font-mono"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Team List Scroll Area */}
                    <div className="flex-1 overflow-y-auto divide-y divide-zinc-850/60">
                        {loadingTeams ? (
                            <div className="py-12 text-center">
                                <div className="w-5 h-5 border-2 border-zinc-600 border-t-white rounded-full animate-spin mx-auto mb-2" />
                                <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">
                                    // SYNCHRONIZING TEAMS...
                                </p>
                            </div>
                        ) : teams.length === 0 ? (
                            /* No Teams Joined Empty State */
                            <div className="p-6 text-center space-y-2">
                                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">
                                    // NO TEAMS YET
                                </span>
                                <p className="text-xs text-zinc-400 leading-relaxed">
                                    You haven't joined any project teams yet.
                                </p>
                                <div className="pt-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setCreateError(null);
                                            setShowCreateModal(true);
                                        }}
                                        className="px-3 py-1.5 bg-white hover:bg-zinc-200 text-black font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                                    >
                                        // CREATE TEAM
                                    </button>
                                </div>
                            </div>
                        ) : filteredTeams.length === 0 ? (
                            <div className="p-6 text-center text-xs text-zinc-500">
                                No teams matching "{searchQuery}"
                            </div>
                        ) : (
                            filteredTeams.map((team) => {
                                const isSelected = team.id === selectedTeamId;
                                const unreadCount = isSelected ? 0 : (teamUnreadMap[team.id] || 0);
                                const hasUnread = unreadCount > 0;
                                const timestampStr = formatTimestamp(
                                    team.lastMessageTimestamp || team.updatedAt || team.createdAt
                                );

                                return (
                                    <button
                                        key={team.id}
                                        type="button"
                                        onClick={() => handleSelectTeam(team.id)}
                                        className={`w-full px-3 py-2.5 text-left transition-colors flex items-start gap-2.5 border-l-2 cursor-pointer ${
                                            isSelected
                                                ? 'bg-zinc-900 border-emerald-400 text-white'
                                                : hasUnread
                                                ? 'bg-zinc-900/40 border-emerald-500/80 text-zinc-200 hover:bg-zinc-900/60'
                                                : 'bg-transparent border-transparent text-zinc-400 hover:bg-zinc-900/40 hover:text-zinc-200'
                                        }`}
                                    >
                                        {/* Avatar (Sharp rectangular box) */}
                                        <div
                                            className={`w-8 h-8 bg-zinc-900 border flex items-center justify-center flex-shrink-0 text-xs font-bold text-white overflow-hidden mt-0.5 ${
                                                hasUnread && !isSelected ? 'border-emerald-700/60' : 'border-zinc-750'
                                            }`}
                                        >
                                            {team.ownerAvatar ? (
                                                <img
                                                    src={team.ownerAvatar}
                                                    alt={team.name}
                                                    className="w-full h-full object-cover"
                                                    onError={handleImageError}
                                                />
                                            ) : (
                                                <span className="text-emerald-400 font-bold">//</span>
                                            )}
                                        </div>

                                        {/* Compact Row Content */}
                                        <div className="min-w-0 flex-1 space-y-0.5">
                                            <div className="flex items-center justify-between gap-1">
                                                <span
                                                    className={`text-xs truncate ${
                                                        isSelected || hasUnread
                                                            ? 'font-bold text-white'
                                                            : 'font-semibold text-zinc-300'
                                                    }`}
                                                >
                                                    {team.name}
                                                </span>
                                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                                    {timestampStr && (
                                                        <span
                                                            className={`text-[10px] font-mono ${
                                                                hasUnread ? 'text-emerald-400 font-semibold' : 'text-zinc-500'
                                                            }`}
                                                        >
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

                                            {/* Project Title & Member Count */}
                                            <div className="flex items-center justify-between gap-1 text-[11px] truncate">
                                                <span
                                                    className={`truncate ${
                                                        hasUnread ? 'text-zinc-200 font-medium' : 'text-zinc-500'
                                                    }`}
                                                >
                                                    // {team.projectTitle}
                                                </span>
                                                <span className="text-[10px] text-zinc-500 font-mono flex-shrink-0">
                                                    [{team.memberCount || 1} members]
                                                </span>
                                            </div>

                                            {/* Short latest-message preview */}
                                            <p
                                                className={`text-[11px] truncate ${
                                                    hasUnread
                                                        ? 'text-zinc-200 font-medium'
                                                        : team.lastMessage
                                                        ? isSelected
                                                            ? 'text-zinc-300'
                                                            : 'text-zinc-400'
                                                        : 'text-zinc-600 italic'
                                                }`}
                                            >
                                                {team.lastMessageSenderName ? `${team.lastMessageSenderName}: ` : ''}
                                                {team.lastMessage || 'Team initialized.'}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </aside>

                {/* ─────────────────────────────────────────────────────────── */}
                {/* RIGHT PANEL: SELECTED TEAM GROUP CHAT (~68%)                */}
                {/* ─────────────────────────────────────────────────────────── */}
                <main
                    className={`flex flex-col bg-[#0a0a0c] overflow-hidden relative h-full ${
                        !selectedTeamId ? 'hidden md:flex' : 'flex'
                    }`}
                >
                    {activeTeam ? (
                        <>
                            {/* Chat Header */}
                            <div className="px-4 py-3 border-b border-zinc-800 bg-[#0c0c0e] flex items-center justify-between gap-3 flex-shrink-0 relative z-20">
                                <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                                    {/* Mobile back button to teams list */}
                                    <button
                                        type="button"
                                        onClick={() => handleSelectTeam('')}
                                        className="md:hidden text-xs text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer pr-1 flex-shrink-0 font-mono"
                                        title="Back to teams list"
                                    >
                                        <span>←</span>
                                    </button>

                                    {/* Avatar */}
                                    <div className="w-8 h-8 sm:w-9 sm:h-9 bg-zinc-900 border border-zinc-750 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white overflow-hidden">
                                        {activeTeam.ownerAvatar ? (
                                            <img
                                                src={activeTeam.ownerAvatar}
                                                alt={activeTeam.name}
                                                className="w-full h-full object-cover"
                                                onError={handleImageError}
                                            />
                                        ) : (
                                            <span className="text-emerald-400 font-bold">//</span>
                                        )}
                                    </div>

                                    {/* Team name + TEAM indicator */}
                                    <div className="min-w-0 flex items-center gap-2">
                                        <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider truncate">
                                            {activeTeam.name}
                                        </h3>
                                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-1.5 py-0.2 flex-shrink-0">
                                            TEAM
                                        </span>
                                    </div>
                                </div>

                                {/* Right Side Actions: Three-Dot Overflow Menu */}
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                    {/* Three-Dot Overflow Menu */}
                                    <div className="relative">
                                        <button
                                            ref={menuButtonRef}
                                            type="button"
                                            onClick={() => setShowMenu((prev) => !prev)}
                                            aria-label="Team options"
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

                                        {/* Overflow Dropdown Menu */}
                                        {showMenu && (
                                            <div
                                                ref={menuRef}
                                                role="menu"
                                                aria-orientation="vertical"
                                                className="absolute right-0 top-full mt-1.5 w-48 bg-[#0c0c0e] border border-zinc-800 shadow-2xl z-30 font-mono text-xs divide-y divide-zinc-850/80"
                                            >
                                                <button
                                                    type="button"
                                                    role="menuitem"
                                                    onClick={() => {
                                                        setShowMenu(false);
                                                        setShowProjectModal(true);
                                                    }}
                                                    className="w-full text-left px-3.5 py-2.5 text-zinc-300 hover:text-white hover:bg-zinc-900/90 transition-colors flex items-center justify-between cursor-pointer"
                                                >
                                                    <span>// PROJECT</span>
                                                    <span className="text-[10px] text-zinc-600">↗</span>
                                                </button>

                                                <button
                                                    type="button"
                                                    role="menuitem"
                                                    onClick={() => {
                                                        setShowMenu(false);
                                                        setShowMembersDrawer(true);
                                                    }}
                                                    className="w-full text-left px-3.5 py-2.5 text-zinc-300 hover:text-white hover:bg-zinc-900/90 transition-colors flex items-center justify-between cursor-pointer"
                                                >
                                                    <span>// TEAM MEMBERS</span>
                                                    <span className="text-[10px] text-zinc-500 font-mono">
                                                        [{members.length || activeTeam.memberCount || 1}]
                                                    </span>
                                                </button>

                                                <button
                                                    type="button"
                                                    role="menuitem"
                                                    onClick={() => {
                                                        setShowMenu(false);
                                                        setShowInviteModal(true);
                                                    }}
                                                    className="w-full text-left px-3.5 py-2.5 text-zinc-300 hover:text-white hover:bg-zinc-900/90 transition-colors flex items-center justify-between cursor-pointer"
                                                >
                                                    <span>// INVITE MEMBERS</span>
                                                    <span className="text-[10px] text-emerald-400 font-bold">+</span>
                                                </button>

                                                <button
                                                    type="button"
                                                    role="menuitem"
                                                    onClick={() => {
                                                        setShowMenu(false);
                                                        setLeaveTeamError(null);
                                                        setShowLeaveModal(true);
                                                    }}
                                                    className="w-full text-left px-3.5 py-2.5 text-red-400 hover:text-red-300 hover:bg-red-950/20 transition-colors flex items-center justify-between cursor-pointer"
                                                >
                                                    <span>{isOwner && members.length <= 1 ? '// DISBAND SQUAD' : '// LEAVE SQUAD'}</span>
                                                    <LogoutIcon className="w-3.5 h-3.5 text-red-400" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Chat Content Body (Chat thread + Message composer, with optional side-by-side / overlay Members Panel confined to workspace) */}
                            <div className="flex-1 flex overflow-hidden min-h-0 relative">
                                {/* Left/Main chat column: messages + composer */}
                                <div className="flex-1 flex flex-col min-w-0 overflow-hidden h-full">
                                    {/* Message History Thread */}
                                    <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                                        {messagesLoading ? (
                                            <div className="py-12 text-center">
                                                <div className="w-5 h-5 border-2 border-zinc-600 border-t-white rounded-full animate-spin mx-auto mb-2" />
                                                <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">
                                                    // LOADING TEAM CHAT...
                                                </p>
                                            </div>
                                        ) : messages.length === 0 ? (
                                            /* No messages in selected team */
                                            <div className="h-full flex items-center justify-center p-8 text-center">
                                                <div className="space-y-1">
                                                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest block">
                                                        // TEAM CHAT EMPTY
                                                    </span>
                                                    <p className="text-xs text-zinc-400">
                                                        Start the conversation with your team.
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            messages.map((msg) => {
                                                const isMe = msg.senderId === currentUser?.uid;
                                                const canDelete = isMe || (activeTeam && activeTeam.ownerId === currentUser?.uid);
                                                const timeStr = formatTimestamp(msg.createdAt);
                                                const isMenuOpen = activeMessageMenuId === msg.id;

                                                return (
                                                    <div
                                                        key={msg.id}
                                                        className={`flex flex-col group relative ${isMe ? 'items-end' : 'items-start'}`}
                                                    >
                                                        {!isMe && (
                                                            <div className="flex items-center gap-1.5 mb-1 px-1">
                                                                <span className="text-[10px] text-zinc-300 font-semibold font-mono">
                                                                    {msg.senderName}
                                                                </span>
                                                                {msg.senderId === activeTeam.ownerId && (
                                                                    <span className="text-[8px] bg-zinc-900 border border-zinc-750 text-zinc-400 px-1 py-0 font-mono">
                                                                        LEAD
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                        <div
                                                            className={`relative max-w-[85%] sm:max-w-[70%] flex items-start gap-1.5 ${
                                                                isMe ? 'flex-row-reverse' : 'flex-row'
                                                            }`}
                                                        >
                                                            <div
                                                                className={`px-3 py-2 text-xs border ${
                                                                    isMe
                                                                        ? 'bg-zinc-900 border-zinc-750 text-zinc-100'
                                                                        : 'bg-[#131316] border-zinc-800 text-zinc-200'
                                                                }`}
                                                            >
                                                                <div className="whitespace-pre-wrap break-words leading-relaxed font-mono">
                                                                    <ClickableMessageText text={msg.text} isSender={isMe} timestamp={timeStr} />
                                                                </div>
                                                                {timeStr && (
                                                                    <div
                                                                        className={`mt-1 text-[10px] ${
                                                                            isMe
                                                                                ? 'text-zinc-500 text-right'
                                                                                : 'text-zinc-600 text-left'
                                                                        }`}
                                                                    >
                                                                        {timeStr}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Contextual message options (hover or menu open) */}
                                                            {canDelete && (
                                                                <div className="relative self-center flex-shrink-0">
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setActiveMessageMenuId(isMenuOpen ? null : msg.id);
                                                                        }}
                                                                        className={`w-6 h-6 flex items-center justify-center text-zinc-500 hover:text-white bg-black/60 hover:bg-zinc-850 border border-zinc-800/80 hover:border-zinc-700 transition-all cursor-pointer ${
                                                                            isMenuOpen
                                                                                ? 'opacity-100 bg-zinc-800 text-white'
                                                                                : 'opacity-0 group-hover:opacity-100'
                                                                        }`}
                                                                        title="Message options"
                                                                        aria-label="Message options"
                                                                    >
                                                                        <EllipsisVerticalIcon className="w-3.5 h-3.5" />
                                                                    </button>

                                                                    {/* Contextual Dropdown */}
                                                                    {isMenuOpen && (
                                                                        <div
                                                                            className={`absolute z-30 top-full mt-1 w-44 bg-[#0e0e11] border border-zinc-800 shadow-2xl font-mono text-xs py-1 divide-y divide-zinc-850 ${
                                                                                isMe ? 'right-0' : 'left-0'
                                                                            }`}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                        >
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setActiveMessageMenuId(null);
                                                                                    if (navigator?.clipboard?.writeText) {
                                                                                        navigator.clipboard.writeText(msg.text);
                                                                                    }
                                                                                }}
                                                                                className="w-full text-left px-3 py-1.5 text-zinc-400 hover:text-white hover:bg-zinc-900 flex items-center justify-between cursor-pointer"
                                                                            >
                                                                                <span>// COPY TEXT</span>
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setActiveMessageMenuId(null);
                                                                                    setMessageToDelete(msg);
                                                                                    setDeleteMessageError(null);
                                                                                }}
                                                                                className="w-full text-left px-3 py-1.5 text-red-400 hover:text-red-300 hover:bg-red-950/30 flex items-center justify-between cursor-pointer"
                                                                            >
                                                                                <span>
                                                                                    {isMe ? '// DELETE MESSAGE' : '// MODERATE (DEL)'}
                                                                                </span>
                                                                                <TrashIcon className="w-3.5 h-3.5" />
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                        <div ref={messagesEndRef} />
                                    </div>

                                    {/* Message Composer (Anchored to bottom of chat column) */}
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
                                                placeholder="// MESSAGE YOUR TEAM..."
                                                disabled={isSending}
                                                className="flex-1 bg-black/70 border border-zinc-800 focus:border-zinc-600 text-xs text-white px-3 py-2 resize-none focus:outline-none placeholder:text-zinc-600 placeholder:whitespace-nowrap placeholder:truncate leading-relaxed font-mono disabled:opacity-50 h-[38px]"
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
                                </div>

                                {/* Team Members Panel: Confined entirely within Teams workspace */}
                                {showMembersDrawer && (
                                    <>
                                        {/* Mobile overlay backdrop confined to the Teams chat pane */}
                                        <div
                                            className="absolute inset-0 bg-black/50 z-20 md:hidden"
                                            onClick={() => setShowMembersDrawer(false)}
                                            aria-hidden="true"
                                        />

                                        <aside
                                            className="absolute right-0 top-0 bottom-0 z-30 w-full sm:w-72 md:relative md:w-64 lg:w-72 md:z-10 h-full bg-[#0c0c0e] border-l border-zinc-800 flex flex-col shadow-2xl flex-shrink-0 font-mono transition-all"
                                            role="region"
                                            aria-label="Team Members"
                                        >
                                            <div className="px-3.5 py-3 border-b border-zinc-800 flex items-center justify-between bg-black/40 flex-shrink-0">
                                                <div>
                                                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold block leading-none">
                                                        // ROSTER
                                                    </span>
                                                    <h4 className="text-xs font-bold text-white uppercase tracking-wider mt-1">
                                                        TEAM MEMBERS ({members.length})
                                                    </h4>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowMembersDrawer(false)}
                                                    className="w-6 h-6 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-900 border border-transparent hover:border-zinc-800 text-xs cursor-pointer font-mono transition-colors"
                                                    title="Close team members"
                                                >
                                                    ✕
                                                </button>
                                            </div>

                                            <div className="flex-1 overflow-y-auto divide-y divide-zinc-850/60 p-3 space-y-1">
                                                {members.map((m) => (
                                                    <div
                                                        key={m.userId}
                                                        className="py-2.5 flex items-center justify-between gap-2"
                                                    >
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <div className="w-7 h-7 bg-zinc-900 border border-zinc-800 flex items-center justify-center flex-shrink-0 text-xs font-bold text-zinc-300 overflow-hidden">
                                                                {m.photoURL ? (
                                                                    <img
                                                                        src={m.photoURL}
                                                                        alt={m.displayName}
                                                                        className="w-full h-full object-cover"
                                                                        onError={handleImageError}
                                                                    />
                                                                ) : (
                                                                    <span>{m.displayName.charAt(0).toUpperCase()}</span>
                                                                )}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-xs text-white font-bold truncate">
                                                                    {m.displayName}
                                                                    {m.userId === currentUser?.uid && (
                                                                        <span className="text-zinc-500 text-[10px] font-normal ml-1">
                                                                            (you)
                                                                        </span>
                                                                    )}
                                                                </p>
                                                                <p className="text-[10px] text-zinc-500 truncate">
                                                                    {m.projectRole ||
                                                                        (m.role === 'owner' ? 'Project Lead' : 'Collaborator')}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                                            <span
                                                                className={`text-[9px] font-bold px-1.5 py-0.5 border ${
                                                                    m.role === 'owner'
                                                                        ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300'
                                                                        : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                                                                }`}
                                                            >
                                                                {m.role === 'owner' ? 'OWNER' : 'MEMBER'}
                                                            </span>

                                                            {/* Team Lead moderation: remove collaborator */}
                                                            {isOwner && m.userId !== currentUser?.uid && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setMemberToRemove(m);
                                                                        setRemoveMemberError(null);
                                                                    }}
                                                                    className="w-5 h-5 flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-red-950/30 border border-transparent hover:border-red-900/40 text-[10px] transition-colors cursor-pointer"
                                                                    title={`Remove ${m.displayName} from squad`}
                                                                    aria-label={`Remove ${m.displayName}`}
                                                                >
                                                                    ✕
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="p-3 border-t border-zinc-800 bg-[#09090b] flex-shrink-0 space-y-2">
                                                {isOwner ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setShowMembersDrawer(false);
                                                            setShowInviteModal(true);
                                                        }}
                                                        className="w-full py-2 bg-zinc-900 border border-zinc-750 hover:border-zinc-500 text-white text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer font-mono"
                                                    >
                                                        + // INVITE MORE MEMBERS
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setShowMembersDrawer(false);
                                                            setLeaveTeamError(null);
                                                            setShowLeaveModal(true);
                                                        }}
                                                        className="w-full py-2 bg-red-950/20 border border-red-900/60 hover:bg-red-950/40 text-red-400 hover:text-red-300 text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5 font-mono"
                                                    >
                                                        <LogoutIcon className="w-3.5 h-3.5" />
                                                        <span>// LEAVE SQUAD</span>
                                                    </button>
                                                )}
                                            </div>
                                        </aside>
                                    </>
                                )}
                            </div>
                        </>
                    ) : (
                        /* Initial State: When no Team is selected */
                        <div className="h-full flex items-center justify-center p-8 text-center bg-[#0a0a0c]">
                            <div className="space-y-1.5 max-w-sm">
                                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest block">
                                    // SELECT A TEAM
                                </span>
                                <p className="text-xs text-zinc-400 leading-relaxed">
                                    Choose a team from the left panel to start collaborating.
                                </p>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );

    return (
        <>
            {/* Render workspace: if expanded, portal to document.body for true full viewport coverage */}
            {isExpanded && typeof document !== 'undefined'
                ? createPortal(workspaceContent, document.body)
                : workspaceContent}

            {/* 3. INVITE MEMBERS MODAL */}
            {showInviteModal && activeTeam && (
                <div
                    className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 backdrop-blur-[5px] p-4 font-mono"
                    onClick={() => setShowInviteModal(false)}
                    role="dialog"
                    aria-modal="true"
                >
                    <div
                        className="border border-zinc-800 bg-[#0c0c0e] max-w-lg w-full p-5 sm:p-6 space-y-5 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-start justify-between border-b border-zinc-800 pb-3">
                            <div>
                                <span className="text-[10px] text-zinc-500 uppercase tracking-widest block font-bold">
                                    // TEAM SETTINGS
                                </span>
                                <h3 className="text-sm sm:text-base font-bold text-white uppercase tracking-wider mt-0.5">
                                    INVITE TEAM MEMBERS
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowInviteModal(false)}
                                className="text-zinc-500 hover:text-white text-base leading-none p-1 cursor-pointer font-mono"
                                title="Close"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Main Section: // TEAM INVITATION LINK */}
                        <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">
                                    // TEAM INVITATION LINK
                                </span>
                                {activeInvite && activeInvite.status === 'active' && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-950/80 border border-emerald-700 text-emerald-300 uppercase tracking-wider font-mono">
                                        ACTIVE
                                    </span>
                                )}
                            </div>

                            <p className="text-xs text-zinc-400 leading-relaxed">
                                Share this link with eligible collaborators to invite them to your team.
                            </p>

                            {activeInvite && activeInvite.status === 'active' ? (
                                <div className="flex items-center gap-2 pt-1">
                                    <input
                                        type="text"
                                        readOnly
                                        value={activeInviteUrl}
                                        className="flex-1 bg-black/70 border border-zinc-800 p-2.5 text-xs text-zinc-300 truncate select-all font-mono focus:outline-none focus:border-zinc-700"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleCopyToken(activeInvite.token)}
                                        className="px-4 py-2.5 bg-white hover:bg-zinc-200 text-black font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer flex-shrink-0 font-mono"
                                    >
                                        {copiedToken === activeInvite.token ? '// COPIED!' : '// COPY LINK'}
                                    </button>
                                </div>
                            ) : (
                                <div className="p-3 border border-zinc-800 bg-zinc-900/30 flex items-center justify-between gap-3">
                                    <span className="text-xs text-zinc-400">No active invitation link currently.</span>
                                    {isOwner && (
                                        <button
                                            type="button"
                                            disabled={isGeneratingInvite}
                                            onClick={handleGenerateNewInvite}
                                            className="px-3.5 py-2 bg-white hover:bg-zinc-200 text-black font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50 font-mono"
                                        >
                                            {isGeneratingInvite ? '// GENERATING...' : '// GENERATE LINK'}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="pt-2 flex justify-end border-t border-zinc-800/80">
                            <button
                                type="button"
                                onClick={() => setShowInviteModal(false)}
                                className="px-4 py-2 bg-zinc-900 border border-zinc-750 text-white text-xs uppercase tracking-wider hover:border-zinc-500 cursor-pointer font-mono"
                            >
                                // CLOSE
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 4. VIEW PROJECT MODAL */}
            {showProjectModal && activeTeam && (
                <div
                    className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 backdrop-blur-[5px] p-4 font-mono"
                    onClick={() => setShowProjectModal(false)}
                    role="dialog"
                    aria-modal="true"
                >
                    <div
                        className="border border-zinc-800 bg-[#0c0c0e] max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                            <div>
                                <span className="text-[10px] text-zinc-500 uppercase tracking-widest block font-bold">
                                    // ASSOCIATED PROJECT
                                </span>
                                <h3 className="text-sm sm:text-base font-bold text-white uppercase tracking-wider">
                                    {activeTeam.projectTitle}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowProjectModal(false)}
                                className="text-zinc-500 hover:text-white text-sm cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-3 text-xs">
                            <div className="border border-zinc-800 bg-zinc-900/30 p-3 space-y-1.5">
                                <div className="flex justify-between text-zinc-400">
                                    <span>DOMAIN:</span>
                                    <span className="text-white font-bold">{activeTeam.projectDomain || 'General'}</span>
                                </div>
                                <div className="flex justify-between text-zinc-400">
                                    <span>PROJECT LEAD:</span>
                                    <span className="text-white font-bold">{activeTeam.ownerName}</span>
                                </div>
                                <div className="flex justify-between text-zinc-400">
                                    <span>TEAM MEMBERS:</span>
                                    <span className="text-emerald-400 font-bold">
                                        {activeTeam.memberCount || members.length}
                                    </span>
                                </div>
                            </div>

                            {activeTeam.description && (
                                <div className="space-y-1">
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">
                                        // TEAM MISSION & DESCRIPTION
                                    </span>
                                    <p className="text-zinc-300 leading-relaxed bg-zinc-900/40 p-3 border border-zinc-800">
                                        {activeTeam.description}
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="pt-2 flex justify-between">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowProjectModal(false);
                                    navigate(`/spotlight?tab=Collabs`);
                                }}
                                className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white text-xs uppercase tracking-wider cursor-pointer"
                            >
                                // BROWSE IN COLLABS
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowProjectModal(false)}
                                className="px-4 py-1.5 bg-zinc-900 border border-zinc-750 text-white text-xs uppercase tracking-wider hover:border-zinc-500 cursor-pointer"
                            >
                                // CLOSE
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 5. CREATE TEAM MODAL */}
            {showCreateModal && (
                <div
                    className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 backdrop-blur-[5px] p-4 font-mono"
                    onClick={() => setShowCreateModal(false)}
                    role="dialog"
                    aria-modal="true"
                >
                    <div
                        className="border border-zinc-800 bg-[#0c0c0e] max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                            <div>
                                <span className="text-[10px] text-zinc-500 uppercase tracking-widest block font-bold">
                                    // CREATE NEW TEAM
                                </span>
                                <h3 className="text-sm sm:text-base font-bold text-white uppercase tracking-wider">
                                    CREATE PROJECT TEAM
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowCreateModal(false)}
                                className="text-zinc-500 hover:text-white text-sm cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {createError && (
                            <div className="p-2.5 bg-red-950/40 border border-red-800 text-red-300 text-xs">
                                {createError}
                            </div>
                        )}

                        <form onSubmit={handleCreateTeamSubmit} className="space-y-4 text-xs">
                            {/* Team Name */}
                            <div className="space-y-1">
                                <label className="text-zinc-400 font-bold block">// TEAM NAME *</label>
                                <input
                                    type="text"
                                    required
                                    value={createName}
                                    onChange={(e) => setCreateName(e.target.value)}
                                    placeholder="e.g. Core Engineering Team"
                                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-600 focus:outline-none p-2.5 text-white font-mono text-xs"
                                />
                            </div>

                            {/* Associated Project */}
                            <div className="space-y-1">
                                <label className="text-zinc-400 font-bold block">// ASSOCIATED PROJECT *</label>
                                {userProjects.length === 0 ? (
                                    <div className="p-3 bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs">
                                        No published projects found for your account. You can publish a Collab project in Spotlight to create a team for it.
                                    </div>
                                ) : (
                                    <select
                                        value={createProjectId}
                                        onChange={(e) => setCreateProjectId(e.target.value)}
                                        className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-600 focus:outline-none p-2.5 text-white font-mono text-xs cursor-pointer"
                                    >
                                        {userProjects.map((p) => {
                                            const title =
                                                (p as any).aiSummary ||
                                                (p as any).oneLine ||
                                                p.title ||
                                                'Untitled Project';
                                            return (
                                                <option key={p.id} value={p.id}>
                                                    {title}
                                                </option>
                                            );
                                        })}
                                    </select>
                                )}
                            </div>

                            {/* Optional Team Description */}
                            <div className="space-y-1">
                                <label className="text-zinc-400 font-bold block">
                                    // TEAM DESCRIPTION (OPTIONAL)
                                </label>
                                <textarea
                                    rows={3}
                                    value={createDesc}
                                    onChange={(e) => setCreateDesc(e.target.value)}
                                    placeholder="Describe team goals, roles, or guidelines..."
                                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-600 focus:outline-none p-2.5 text-white font-mono text-xs resize-none"
                                />
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-4 py-2 bg-transparent border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white uppercase transition-colors cursor-pointer"
                                >
                                    // CANCEL
                                </button>
                                <button
                                    type="submit"
                                    disabled={isCreatingTeam || !createName.trim() || userProjects.length === 0}
                                    className="px-5 py-2 bg-white hover:bg-zinc-200 disabled:opacity-40 text-black font-bold uppercase transition-colors cursor-pointer flex items-center gap-1.5"
                                >
                                    {isCreatingTeam ? (
                                        <>
                                            <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                            <span>CREATING...</span>
                                        </>
                                    ) : (
                                        <span>// CREATE TEAM</span>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 5. DELETE MESSAGE CONFIRMATION MODAL */}
            {messageToDelete && (
                <div
                    className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-[5px] p-4 font-mono"
                    onClick={() => {
                        if (!isDeletingMessage) setMessageToDelete(null);
                    }}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="delete-message-title"
                >
                    <div
                        className="border border-zinc-800 bg-[#0c0c0e] max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-start justify-between border-b border-zinc-800 pb-3">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-red-500 inline-block animate-pulse" />
                                <h3 id="delete-message-title" className="text-sm font-bold text-white uppercase tracking-wider">
                                    Delete this message?
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    if (!isDeletingMessage) setMessageToDelete(null);
                                }}
                                disabled={isDeletingMessage}
                                className="text-zinc-500 hover:text-white text-base leading-none p-1 cursor-pointer font-mono disabled:opacity-40"
                                title="Close"
                            >
                                ✕
                            </button>
                        </div>

                        <p className="text-xs text-zinc-400 leading-relaxed">
                            This action cannot be undone. The message will be permanently removed for all squad members.
                        </p>

                        {messageToDelete.senderId !== currentUser?.uid && (
                            <div className="p-2.5 bg-amber-950/40 border border-amber-800/60 text-amber-300 text-[11px] leading-relaxed">
                                // TEAM LEAD MODERATION: You are deleting a message sent by {messageToDelete.senderName}.
                            </div>
                        )}

                        {/* Message Preview Box */}
                        <div className="p-3 bg-black/60 border border-zinc-850 text-xs text-zinc-300 max-h-32 overflow-y-auto whitespace-pre-wrap break-words border-l-2 border-l-zinc-600">
                            <span className="text-[10px] text-zinc-500 block mb-1">
                                {messageToDelete.senderName} • {formatTimestamp(messageToDelete.createdAt)}
                            </span>
                            "{messageToDelete.text}"
                        </div>

                        {deleteMessageError && (
                            <div className="p-2.5 bg-red-950/60 border border-red-800 text-red-200 text-xs flex items-center gap-2">
                                <span className="text-red-400 font-bold">!</span>
                                <span>{deleteMessageError}</span>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="pt-2 flex items-center justify-end gap-3 border-t border-zinc-800/80">
                            <button
                                type="button"
                                onClick={() => setMessageToDelete(null)}
                                disabled={isDeletingMessage}
                                className="px-4 py-2 bg-transparent border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white uppercase transition-colors text-xs font-bold cursor-pointer disabled:opacity-40 font-mono"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDeleteMessage}
                                disabled={isDeletingMessage}
                                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-2 font-mono"
                            >
                                {isDeletingMessage ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>DELETING...</span>
                                    </>
                                ) : (
                                    <span>Delete message</span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 6. LEAVE / DISBAND TEAM CONFIRMATION MODAL */}
            {showLeaveModal && activeTeam && (
                <div
                    className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-[5px] p-4 font-mono"
                    onClick={() => {
                        if (!isLeavingTeam) setShowLeaveModal(false);
                    }}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="leave-team-title"
                >
                    <div
                        className="border border-zinc-800 bg-[#0c0c0e] max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-start justify-between border-b border-zinc-800 pb-3">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-red-500 inline-block" />
                                <h3 id="leave-team-title" className="text-sm font-bold text-white uppercase tracking-wider">
                                    {isOwner && members.length > 1
                                        ? 'Cannot Leave Team'
                                        : isOwner && members.length <= 1
                                        ? 'Disband this team?'
                                        : 'Leave this team?'}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    if (!isLeavingTeam) setShowLeaveModal(false);
                                }}
                                disabled={isLeavingTeam}
                                className="text-zinc-500 hover:text-white text-base leading-none p-1 cursor-pointer font-mono disabled:opacity-40"
                                title="Close"
                            >
                                ✕
                            </button>
                        </div>

                        {isOwner && members.length > 1 ? (
                            /* Case 1: Team Owner with remaining members cannot abandon squad */
                            <div className="space-y-4">
                                <p className="text-xs text-zinc-300 leading-relaxed">
                                    As the team lead, you cannot abandon an active squad while other collaborators are assigned to "{activeTeam.name}".
                                </p>
                                <div className="p-3 bg-amber-950/40 border border-amber-800 text-amber-300 text-xs leading-relaxed">
                                    // SQUAD RESTRICTION: To leave, remove other collaborators or transfer ownership of the project first.
                                </div>
                                <div className="pt-2 flex justify-end border-t border-zinc-800/80">
                                    <button
                                        type="button"
                                        onClick={() => setShowLeaveModal(false)}
                                        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold uppercase tracking-wider cursor-pointer font-mono"
                                    >
                                        Understood
                                    </button>
                                </div>
                            </div>
                        ) : isOwner && members.length <= 1 ? (
                            /* Case 2: Team Owner and sole member can disband/delete the team */
                            <div className="space-y-4">
                                <p className="text-xs text-zinc-300 leading-relaxed">
                                    You are the creator and sole member of "{activeTeam.name}". Leaving will permanently disband and delete this team workspace.
                                </p>
                                {leaveTeamError && (
                                    <div className="p-2.5 bg-red-950/60 border border-red-800 text-red-200 text-xs">
                                        {leaveTeamError}
                                    </div>
                                )}
                                <div className="pt-2 flex items-center justify-end gap-3 border-t border-zinc-800/80">
                                    <button
                                        type="button"
                                        onClick={() => setShowLeaveModal(false)}
                                        disabled={isLeavingTeam}
                                        className="px-4 py-2 bg-transparent border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white uppercase transition-colors text-xs font-bold cursor-pointer disabled:opacity-40 font-mono"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleConfirmLeaveOrDisband}
                                        disabled={isLeavingTeam}
                                        className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-2 font-mono"
                                    >
                                        {isLeavingTeam ? (
                                            <>
                                                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                <span>DISBANDING...</span>
                                            </>
                                        ) : (
                                            <span>Disband & Delete</span>
                                        )}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* Case 3: Regular team member leaving voluntarily */
                            <div className="space-y-4">
                                <p className="text-xs text-zinc-300 leading-relaxed">
                                    You'll lose access to this team's chat and collaboration space. You may need a new invitation to rejoin.
                                </p>
                                <div className="p-2.5 bg-black/60 border border-zinc-800 text-xs text-zinc-400 space-y-0.5">
                                    <div>Squad: <span className="text-white font-bold">{activeTeam.name}</span></div>
                                    {activeTeam.projectTitle && (
                                        <div className="text-[11px] text-zinc-500">Project: {activeTeam.projectTitle}</div>
                                    )}
                                </div>
                                {leaveTeamError && (
                                    <div className="p-2.5 bg-red-950/60 border border-red-800 text-red-200 text-xs">
                                        {leaveTeamError}
                                    </div>
                                )}
                                <div className="pt-2 flex items-center justify-end gap-3 border-t border-zinc-800/80">
                                    <button
                                        type="button"
                                        onClick={() => setShowLeaveModal(false)}
                                        disabled={isLeavingTeam}
                                        className="px-4 py-2 bg-transparent border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white uppercase transition-colors text-xs font-bold cursor-pointer disabled:opacity-40 font-mono"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleConfirmLeaveOrDisband}
                                        disabled={isLeavingTeam}
                                        className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-2 font-mono"
                                    >
                                        {isLeavingTeam ? (
                                            <>
                                                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                <span>LEAVING...</span>
                                            </>
                                        ) : (
                                            <span>Leave Team</span>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 7. REMOVE MEMBER CONFIRMATION MODAL (LEAD MODERATION) */}
            {memberToRemove && activeTeam && (
                <div
                    className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-[5px] p-4 font-mono"
                    onClick={() => {
                        if (!isRemovingMember) setMemberToRemove(null);
                    }}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="remove-member-title"
                >
                    <div
                        className="border border-zinc-800 bg-[#0c0c0e] max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-start justify-between border-b border-zinc-800 pb-3">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-amber-500 inline-block" />
                                <h3 id="remove-member-title" className="text-sm font-bold text-white uppercase tracking-wider">
                                    Remove collaborator?
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    if (!isRemovingMember) setMemberToRemove(null);
                                }}
                                disabled={isRemovingMember}
                                className="text-zinc-500 hover:text-white text-base leading-none p-1 cursor-pointer font-mono disabled:opacity-40"
                                title="Close"
                            >
                                ✕
                            </button>
                        </div>

                        <p className="text-xs text-zinc-300 leading-relaxed">
                            Are you sure you want to remove <span className="text-white font-bold">{memberToRemove.displayName}</span> from "{activeTeam.name}"?
                        </p>
                        <p className="text-[11px] text-zinc-500 leading-relaxed">
                            They will immediately lose access to this team's chat and collaborative workspace.
                        </p>

                        {removeMemberError && (
                            <div className="p-2.5 bg-red-950/60 border border-red-800 text-red-200 text-xs">
                                {removeMemberError}
                            </div>
                        )}

                        <div className="pt-2 flex items-center justify-end gap-3 border-t border-zinc-800/80">
                            <button
                                type="button"
                                onClick={() => setMemberToRemove(null)}
                                disabled={isRemovingMember}
                                className="px-4 py-2 bg-transparent border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white uppercase transition-colors text-xs font-bold cursor-pointer disabled:opacity-40 font-mono"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmRemoveMember}
                                disabled={isRemovingMember}
                                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-2 font-mono"
                            >
                                {isRemovingMember ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>REMOVING...</span>
                                    </>
                                ) : (
                                    <span>Remove Member</span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
