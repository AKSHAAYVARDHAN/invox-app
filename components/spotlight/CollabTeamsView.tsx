import React, { useState, useEffect, useRef, useMemo } from 'react';
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
    subscribeToTeamInvitations,
    revokeTeamInvitation,
    joinTeamViaInvitation,
    subscribeToUserTeamUnreadCounts,
    getProjectAcceptedCollaborators,
    type Team,
    type TeamMember,
    type TeamMessage,
    type TeamInvitation,
} from '../../services/teamService';
import { subscribeToUserPosts } from '../../services/postService';
import { handleImageError } from '../utils/imageUtils';
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
    const [inviteLoading, setInviteLoading] = useState<boolean>(Boolean(urlInviteToken));
    const [inviteError, setInviteError] = useState<string | null>(null);
    const [isJoining, setIsJoining] = useState<boolean>(false);
    const [joinSuccess, setJoinSuccess] = useState<boolean>(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

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
            setActiveTeam(team);
        });

        return () => {
            unsubTeam();
        };
    }, [selectedTeamId]);

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
            () => {
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
            setInviteLoading(false);
            return;
        }

        setInviteLoading(true);
        setInviteError(null);

        getTeamInvitation(urlInviteToken)
            .then((inv) => {
                if (!inv) {
                    setInviteError('Invalid invitation: This invitation link does not exist.');
                } else if (inv.status === 'revoked') {
                    setInviteError('Invitation revoked: This invitation link has been revoked by the project owner.');
                } else if (inv.expiresAt) {
                    const expTime = typeof inv.expiresAt?.toDate === 'function'
                        ? inv.expiresAt.toDate().getTime()
                        : new Date(inv.expiresAt).getTime();
                    if (expTime > 0 && Date.now() > expTime) {
                        setInviteError('Invitation expired: This invitation link has expired.');
                    } else {
                        setInviteData(inv);
                    }
                } else if (inv.maxUses && inv.maxUses > 0 && inv.usedCount >= inv.maxUses) {
                    setInviteError('Invitation limit reached: This link has reached maximum allowed uses.');
                } else {
                    setInviteData(inv);
                }
                setInviteLoading(false);
            })
            .catch((err) => {
                setInviteError(err?.message || 'Failed to inspect invitation.');
                setInviteLoading(false);
            });
    }, [urlInviteToken]);

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
                t.name.toLowerCase().includes(q) ||
                t.projectTitle.toLowerCase().includes(q) ||
                t.ownerName.toLowerCase().includes(q)
        );
    }, [teams, searchQuery]);

    // Helper: Select a team
    const handleSelectTeam = (teamId: string) => {
        setSelectedTeamId(teamId);
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set('tab', 'Collabs');
            next.set('collabView', 'teams');
            next.set('teamId', teamId);
            next.delete('invite');
            return next;
        });
    };

    // Helper: Back to teams list
    const handleBackToList = () => {
        setSelectedTeamId(null);
        setActiveTeam(null);
        setShowMembersDrawer(false);
        setShowInviteModal(false);
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set('tab', 'Collabs');
            next.set('collabView', 'teams');
            next.delete('teamId');
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
            const { team, invitationToken } = await createTeam({
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

    // Helper: Generate new invite token
    const handleGenerateNewInvite = async () => {
        if (!activeTeam || !currentUser || isGeneratingInvite) return;
        setIsGeneratingInvite(true);
        try {
            await createTeamInvitation({
                teamId: activeTeam.id,
                teamName: activeTeam.name,
                projectId: activeTeam.projectId,
                projectTitle: activeTeam.projectTitle,
                ownerId: activeTeam.ownerId,
                ownerName: activeTeam.ownerName,
                user: currentUser,
            });
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
    const getInviteUrl = (token: string) => {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        return `${origin}/spotlight?tab=Collabs&collabView=teams&invite=${token}`;
    };

    const handleCopyToken = (token: string) => {
        const url = getInviteUrl(token);
        if (navigator?.clipboard) {
            navigator.clipboard.writeText(url);
            setCopiedToken(token);
            setTimeout(() => setCopiedToken(null), 2500);
        }
    };

    // Helper: Join Team via Invitation
    const handleJoinTeam = async () => {
        if (!inviteData || !currentUser || isJoining) return;
        setIsJoining(true);
        try {
            const res = await joinTeamViaInvitation({
                token: inviteData.token,
                user: currentUser,
                userProfile,
            });
            setJoinSuccess(true);
            setTimeout(() => {
                // Navigate to the joined team chat
                setSearchParams((prev) => {
                    const next = new URLSearchParams(prev);
                    next.set('tab', 'Collabs');
                    next.set('collabView', 'teams');
                    next.set('teamId', res.team.id);
                    next.delete('invite');
                    return next;
                });
            }, 800);
        } catch (err: any) {
            setInviteError(err?.message || 'Failed to join team.');
        } finally {
            setIsJoining(false);
        }
    };

    // Helper: Timestamp formatter
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
                        onClick={handleBackToList}
                        className="px-2.5 py-1 bg-transparent hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer font-mono"
                    >
                        <span>←</span>
                        <span>// ALL TEAMS</span>
                    </button>
                </div>

                {inviteLoading ? (
                    <div className="p-12 text-center border border-zinc-800 bg-[#0c0c0e]">
                        <div className="w-5 h-5 border-2 border-zinc-600 border-t-white rounded-full animate-spin mx-auto mb-2" />
                        <p className="text-xs text-zinc-500 uppercase tracking-wider">// VERIFYING INVITATION TOKEN...</p>
                    </div>
                ) : inviteError ? (
                    <div className="border border-red-900/60 bg-red-950/20 p-8 text-center font-mono">
                        <span className="text-xs font-bold text-red-400 uppercase tracking-widest block mb-2">
                            // INVITATION INVALID
                        </span>
                        <p className="text-xs text-zinc-300 mb-6">{inviteError}</p>
                        <button
                            type="button"
                            onClick={handleBackToList}
                            className="px-4 py-2 bg-zinc-900 border border-zinc-750 text-white text-xs uppercase tracking-wider hover:border-zinc-500 transition-colors cursor-pointer"
                        >
                            // GO TO TEAMS
                        </button>
                    </div>
                ) : inviteData ? (
                    <div className="border border-zinc-800 bg-[#0c0c0e] p-6 sm:p-8 max-w-xl mx-auto space-y-6">
                        <div className="space-y-1 text-center sm:text-left">
                            <span className="text-[10px] text-emerald-400 uppercase tracking-widest font-bold block">
                                // VALID INVITATION
                            </span>
                            <h3 className="text-lg sm:text-xl font-bold text-white uppercase tracking-wider">
                                {inviteData.teamName}
                            </h3>
                            <p className="text-xs text-zinc-400">
                                Project: <span className="text-zinc-200 font-bold">{inviteData.projectTitle}</span>
                            </p>
                        </div>

                        <div className="border border-zinc-800/80 bg-zinc-900/30 p-4 space-y-3 text-xs">
                            <div className="flex justify-between items-center text-zinc-400">
                                <span>INVITED BY:</span>
                                <span className="text-white font-bold">{inviteData.ownerName}</span>
                            </div>
                            <div className="flex justify-between items-center text-zinc-400">
                                <span>COMMUNICATION:</span>
                                <span className="text-emerald-400 font-bold">SHARED TEAM CHAT</span>
                            </div>
                            {inviteData.expiresAt && (
                                <div className="flex justify-between items-center text-zinc-400">
                                    <span>EXPIRES:</span>
                                    <span className="text-zinc-300">{formatTimestamp(inviteData.expiresAt)}</span>
                                </div>
                            )}
                        </div>

                        {joinSuccess ? (
                            <div className="p-4 bg-emerald-950/50 border border-emerald-700 text-center">
                                <span className="text-xs text-emerald-300 font-bold uppercase tracking-wider block">
                                    // MEMBERSHIP CONFIRMED! OPENING TEAM...
                                </span>
                            </div>
                        ) : !currentUser ? (
                            <div className="space-y-3 text-center">
                                <p className="text-xs text-zinc-400">You must sign in to accept this invitation and join the team.</p>
                                <button
                                    type="button"
                                    onClick={() => navigate('/login')}
                                    className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                                >
                                    // SIGN IN TO JOIN
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                disabled={isJoining}
                                onClick={handleJoinTeam}
                                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer"
                            >
                                {isJoining ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                        <span>JOINING TEAM...</span>
                                    </>
                                ) : (
                                    <span>// JOIN TEAM</span>
                                )}
                            </button>
                        )}
                    </div>
                ) : null}
            </div>
        );
    }

    // -------------------------------------------------------------
    // RENDER: SINGLE TEAM CHAT VIEW (when selectedTeamId is active)
    // -------------------------------------------------------------
    if (selectedTeamId && activeTeam) {
        const activeInvite = invitations.find((i) => i.status === 'active') || invitations[0];
        const activeInviteUrl = activeInvite ? getInviteUrl(activeInvite.token) : '';

        return (
            <div className="space-y-3 font-mono">
                {/* 1. TEAM HEADER */}
                <div className="border border-zinc-800 bg-[#0c0c0e] p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <button
                            type="button"
                            onClick={handleBackToList}
                            className="p-1.5 border border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 text-zinc-400 hover:text-white text-xs uppercase tracking-wider transition-colors cursor-pointer flex-shrink-0"
                            title="Back to All Teams"
                        >
                            <span>←</span>
                        </button>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-sm sm:text-base font-bold text-white uppercase tracking-wider truncate">
                                    {activeTeam.name}
                                </h2>
                                <span className="text-[10px] bg-zinc-900 text-zinc-400 border border-zinc-800 px-1.5 py-0.5">
                                    {activeTeam.memberCount || members.length || 1} MEMBERS
                                </span>
                            </div>
                            <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                                // Project: <span className="text-zinc-200">{activeTeam.projectTitle}</span>
                                <span className="text-zinc-600 mx-1.5">|</span>
                                Lead: <span className="text-zinc-300">{activeTeam.ownerName}</span>
                            </p>
                        </div>
                    </div>

                    {/* Actions Header */}
                    <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                        <button
                            type="button"
                            onClick={() => setShowProjectModal(true)}
                            className="px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white text-[11px] uppercase tracking-wider transition-colors cursor-pointer"
                        >
                            // VIEW PROJECT
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowMembersDrawer((prev) => !prev)}
                            className={`px-2.5 py-1.5 border text-[11px] uppercase tracking-wider transition-colors cursor-pointer ${
                                showMembersDrawer
                                    ? 'bg-zinc-800 border-zinc-600 text-white font-bold'
                                    : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white'
                            }`}
                        >
                            // TEAM MEMBERS ({members.length})
                        </button>
                        {isOwner && (
                            <button
                                type="button"
                                onClick={() => setShowInviteModal(true)}
                                className="px-2.5 py-1.5 bg-emerald-950/70 border border-emerald-700/80 hover:border-emerald-500 text-emerald-300 hover:text-white text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                            >
                                // INVITE MEMBERS
                            </button>
                        )}
                    </div>
                </div>

                {/* 2. CHAT WORKSPACE & MEMBERS DRAWER */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
                    {/* Conversation Area (3 or 4 cols) */}
                    <div className={`border border-zinc-800 bg-[#0c0c0e] flex flex-col h-[600px] overflow-hidden ${showMembersDrawer ? 'lg:col-span-3' : 'lg:col-span-4'}`}>
                        {/* Messages Thread */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {messagesLoading ? (
                                <div className="h-full flex flex-col items-center justify-center text-center">
                                    <div className="w-5 h-5 border-2 border-zinc-600 border-t-white rounded-full animate-spin mb-2" />
                                    <span className="text-xs text-zinc-500 uppercase tracking-wider">// LOADING TEAM CHAT...</span>
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-1">
                                        // TEAM CHAT EMPTY
                                    </span>
                                    <p className="text-xs text-zinc-500 max-w-sm">
                                        Start the conversation with your team. Share project updates, assign tasks, and build together.
                                    </p>
                                </div>
                            ) : (
                                messages.map((msg) => {
                                    const isMe = msg.senderId === currentUser?.uid;
                                    const timeStr = formatTimestamp(msg.createdAt);

                                    return (
                                        <div
                                            key={msg.id}
                                            className={`flex items-start gap-2.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                                        >
                                            {/* Avatar */}
                                            <div className="w-7 h-7 bg-zinc-900 border border-zinc-800 flex items-center justify-center flex-shrink-0 text-xs font-bold text-zinc-300 overflow-hidden">
                                                {msg.senderAvatar ? (
                                                    <img
                                                        src={msg.senderAvatar}
                                                        alt={msg.senderName}
                                                        className="w-full h-full object-cover"
                                                        onError={handleImageError}
                                                    />
                                                ) : (
                                                    <span>{msg.senderName.charAt(0).toUpperCase()}</span>
                                                )}
                                            </div>

                                            {/* Message Content Bubble */}
                                            <div className={`max-w-[78%] sm:max-w-[70%] space-y-1 ${isMe ? 'items-end' : 'items-start'}`}>
                                                <div className={`flex items-center gap-2 text-[10px] text-zinc-500 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                                    <span className={`font-bold ${isMe ? 'text-emerald-400' : 'text-zinc-300'}`}>
                                                        {isMe ? 'You' : msg.senderName}
                                                    </span>
                                                    <span>{timeStr}</span>
                                                </div>
                                                <div
                                                    className={`p-3 text-xs leading-relaxed whitespace-pre-wrap break-words border ${
                                                        isMe
                                                            ? 'bg-zinc-900/90 border-emerald-800/60 text-white'
                                                            : 'bg-zinc-950/70 border-zinc-800 text-zinc-200'
                                                    }`}
                                                >
                                                    {msg.text}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Message Composer */}
                        <div className="p-3 border-t border-zinc-800 bg-[#09090b] flex items-end gap-2">
                            <textarea
                                ref={textareaRef}
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                onKeyDown={handleKeyDown}
                                rows={2}
                                placeholder="Write a message to team members... (Enter to send, Shift+Enter for new line)"
                                className="flex-1 bg-zinc-900/60 border border-zinc-800 focus:border-zinc-600 focus:outline-none p-2.5 text-xs text-white placeholder-zinc-500 resize-none font-mono"
                            />
                            <button
                                type="button"
                                disabled={!inputText.trim() || isSending}
                                onClick={handleSendMessage}
                                className="px-4 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer flex-shrink-0 flex items-center gap-1.5"
                            >
                                {isSending ? (
                                    <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <span>// SEND</span>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Members Drawer Panel */}
                    {showMembersDrawer && (
                        <div className="lg:col-span-1 border border-zinc-800 bg-[#0c0c0e] p-3 flex flex-col h-[600px] overflow-hidden">
                            <div className="pb-2.5 border-b border-zinc-800 flex items-center justify-between">
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">
                                    // TEAM MEMBERS ({members.length})
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setShowMembersDrawer(false)}
                                    className="text-zinc-500 hover:text-white text-xs cursor-pointer"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto divide-y divide-zinc-850/60 mt-2">
                                {members.map((m) => (
                                    <div key={m.userId} className="py-2.5 flex items-center justify-between gap-2">
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
                                                    {m.userId === currentUser?.uid && <span className="text-zinc-500 text-[10px] font-normal ml-1">(you)</span>}
                                                </p>
                                                <p className="text-[10px] text-zinc-500 truncate">
                                                    {m.projectRole || (m.role === 'owner' ? 'Project Lead' : 'Collaborator')}
                                                </p>
                                            </div>
                                        </div>
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 border flex-shrink-0 ${
                                            m.role === 'owner'
                                                ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300'
                                                : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                                        }`}>
                                            {m.role === 'owner' ? 'OWNER' : 'MEMBER'}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {isOwner && (
                                <button
                                    type="button"
                                    onClick={() => setShowInviteModal(true)}
                                    className="mt-3 w-full py-2 bg-zinc-900 border border-zinc-750 hover:border-zinc-500 text-white text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                                >
                                    + // INVITE MORE MEMBERS
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* 3. INVITE MEMBERS MODAL */}
                {showInviteModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-mono">
                        <div className="border border-zinc-800 bg-[#0c0c0e] max-w-lg w-full p-5 sm:p-6 space-y-5">
                            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                                <div>
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest block font-bold">// INVITATIONS</span>
                                    <h3 className="text-sm sm:text-base font-bold text-white uppercase tracking-wider">
                                        INVITE TEAM MEMBERS
                                    </h3>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowInviteModal(false)}
                                    className="text-zinc-500 hover:text-white text-sm cursor-pointer"
                                >
                                    ✕
                                </button>
                            </div>

                            {/* Active Link Box */}
                            <div className="space-y-2">
                                <label className="text-[11px] text-zinc-400 block font-bold">
                                    // SHAREABLE INVITATION LINK
                                </label>
                                {activeInvite ? (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            readOnly
                                            value={activeInviteUrl}
                                            className="flex-1 bg-zinc-900 border border-zinc-800 p-2 text-xs text-zinc-300 select-all font-mono"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleCopyToken(activeInvite.token)}
                                            className="px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer flex-shrink-0"
                                        >
                                            {copiedToken === activeInvite.token ? '// COPIED!' : '// COPY LINK'}
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        disabled={isGeneratingInvite}
                                        onClick={handleGenerateNewInvite}
                                        className="w-full py-2 bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-white text-xs uppercase tracking-wider transition-colors cursor-pointer"
                                    >
                                        // GENERATE INVITE LINK
                                    </button>
                                )}
                            </div>

                            {/* Accepted Collaborators Quick-Invite */}
                            {acceptedCollabs.length > 0 && (
                                <div className="space-y-2 border-t border-zinc-800/80 pt-3">
                                    <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest block">
                                        // ACCEPTED COLLABORATORS READY TO INVITE ({acceptedCollabs.length})
                                    </span>
                                    <div className="max-h-36 overflow-y-auto divide-y divide-zinc-850/60 border border-zinc-800 bg-zinc-900/30 p-2">
                                        {acceptedCollabs.map((app) => (
                                            <div key={app.id} className="py-1.5 flex items-center justify-between text-xs">
                                                <div>
                                                    <span className="text-white font-bold">{app.applicantName}</span>
                                                    <span className="text-zinc-500 text-[10px] ml-1.5">({app.roleNeededTitle || 'Role'})</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => activeInvite && handleCopyToken(activeInvite.token)}
                                                    className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-300 hover:text-white text-[10px] uppercase transition-colors cursor-pointer"
                                                >
                                                    // COPY LINK
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Active Invitations List */}
                            {invitations.length > 0 && (
                                <div className="space-y-2 border-t border-zinc-800/80 pt-3">
                                    <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest block">
                                        // MANAGE INVITATION LINKS
                                    </span>
                                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                        {invitations.map((inv) => (
                                            <div
                                                key={inv.token}
                                                className="p-2 border border-zinc-800 bg-zinc-900/40 flex items-center justify-between text-xs"
                                            >
                                                <div className="truncate mr-2">
                                                    <span className="text-zinc-400 font-mono text-[11px] truncate">...{inv.token.slice(-8)}</span>
                                                    <span className="text-zinc-500 text-[10px] ml-2">used: {inv.usedCount || 0}</span>
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    {inv.status === 'active' ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRevokeInvite(inv.token)}
                                                            className="text-red-400 hover:text-red-300 text-[10px] uppercase font-bold cursor-pointer"
                                                        >
                                                            // REVOKE
                                                        </button>
                                                    ) : (
                                                        <span className="text-zinc-600 text-[10px] uppercase">// REVOKED</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="pt-2 flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => setShowInviteModal(false)}
                                    className="px-4 py-2 bg-zinc-900 border border-zinc-750 text-white text-xs uppercase tracking-wider hover:border-zinc-500 cursor-pointer"
                                >
                                    // CLOSE
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 4. VIEW PROJECT MODAL */}
                {showProjectModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-mono">
                        <div className="border border-zinc-800 bg-[#0c0c0e] max-w-lg w-full p-5 sm:p-6 space-y-4">
                            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                                <div>
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest block font-bold">// ASSOCIATED PROJECT</span>
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
                                        <span className="text-emerald-400 font-bold">{activeTeam.memberCount || members.length}</span>
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
            </div>
        );
    }

    // -------------------------------------------------------------
    // RENDER: TEAMS LANDING PAGE (List of Teams + Create Action)
    // -------------------------------------------------------------
    return (
        <div className="space-y-4 font-mono">
            {/* 1. Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-zinc-800 gap-3">
                <div>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest block font-bold">// MESSAGE BOARD</span>
                    <h2 className="text-sm sm:text-base font-bold text-white uppercase tracking-wider">
                        TEAMS
                    </h2>
                    <p className="text-xs text-zinc-400 mt-0.5">
                        Project teams and shared communication spaces.
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {onBack && (
                        <button
                            type="button"
                            onClick={onBack}
                            className="px-2.5 py-1.5 bg-transparent hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer font-mono"
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
                        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                    >
                        // CREATE TEAM
                    </button>
                </div>
            </div>

            {/* 2. Search Bar */}
            {teams.length > 0 && (
                <div className="flex items-center gap-2 border border-zinc-800 bg-[#0c0c0e] px-3 py-2">
                    <span className="text-zinc-500 text-xs font-bold">//</span>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search teams by name or project title..."
                        className="bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none w-full font-mono"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="text-zinc-500 hover:text-white text-xs cursor-pointer"
                        >
                            ✕
                        </button>
                    )}
                </div>
            )}

            {/* 3. Teams List Content */}
            {loadingTeams ? (
                <div className="p-12 text-center border border-zinc-800 bg-[#0c0c0e]">
                    <div className="w-5 h-5 border-2 border-zinc-600 border-t-white rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-xs text-zinc-500 uppercase tracking-wider">// SYNCHRONIZING TEAMS...</p>
                </div>
            ) : teams.length === 0 ? (
                /* Empty state */
                <div className="border border-zinc-800 bg-[#0c0c0e] p-12 sm:p-16 text-center font-mono my-4 space-y-3">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">
                        // NO TEAMS YET
                    </span>
                    <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                        You haven't joined any project teams yet.
                        Join a team through an invitation link or create one for your project.
                    </p>
                    <div className="pt-2">
                        <button
                            type="button"
                            onClick={() => setShowCreateModal(true)}
                            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                        >
                            // CREATE TEAM
                        </button>
                    </div>
                </div>
            ) : filteredTeams.length === 0 ? (
                <div className="border border-zinc-800 bg-[#0c0c0e] p-12 text-center text-xs text-zinc-500">
                    No teams matched "{searchQuery}".
                </div>
            ) : (
                /* Grid of Teams */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {filteredTeams.map((team) => {
                        const unreadCount = teamUnreadMap[team.id] || 0;
                        const hasUnread = unreadCount > 0;
                        const timeStr = formatTimestamp(team.lastMessageTimestamp || team.updatedAt || team.createdAt);

                        return (
                            <div
                                key={team.id}
                                onClick={() => handleSelectTeam(team.id)}
                                className={`border p-4 bg-[#0c0c0e] hover:border-zinc-700 transition-all cursor-pointer flex flex-col justify-between gap-4 group ${
                                    hasUnread ? 'border-emerald-600/70 bg-zinc-950/80' : 'border-zinc-800'
                                }`}
                            >
                                <div className="space-y-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="text-sm font-bold text-white uppercase tracking-wider group-hover:text-emerald-400 transition-colors truncate">
                                                    {team.name}
                                                </h3>
                                                {hasUnread && (
                                                    <span className="bg-emerald-950 border border-emerald-700 text-emerald-300 text-[10px] font-bold px-1.5 py-0.2">
                                                        {unreadCount} NEW
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                                                // {team.projectTitle}
                                            </p>
                                        </div>
                                        <span className="text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-400 px-1.5 py-0.5 flex-shrink-0">
                                            {team.memberCount || 1} MEMBERS
                                        </span>
                                    </div>

                                    {/* Preview of latest message */}
                                    <div className="border border-zinc-850 bg-zinc-900/30 p-2.5 text-xs">
                                        <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1">
                                            <span>
                                                {team.lastMessageSenderName ? `${team.lastMessageSenderName}:` : '// LATEST MSG:'}
                                            </span>
                                            <span>{timeStr}</span>
                                        </div>
                                        <p className="text-zinc-300 text-xs truncate">
                                            {team.lastMessage || 'Team initialized.'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-zinc-850/60 text-[11px] text-zinc-500">
                                    <div className="flex items-center gap-1.5 truncate">
                                        <span>Owner:</span>
                                        <span className="text-zinc-300 font-bold truncate">{team.ownerName}</span>
                                    </div>
                                    <span className="text-emerald-400 font-bold group-hover:underline">
                                        // OPEN TEAM →
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* 4. CREATE TEAM MODAL */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-mono">
                    <div className="border border-zinc-800 bg-[#0c0c0e] max-w-lg w-full p-5 sm:p-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                            <div>
                                <span className="text-[10px] text-zinc-500 uppercase tracking-widest block font-bold">// CREATE NEW TEAM</span>
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
                                            const title = (p as any).aiSummary || (p as any).oneLine || p.title || 'Untitled Project';
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
                                <label className="text-zinc-400 font-bold block">// TEAM DESCRIPTION (OPTIONAL)</label>
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
                                    className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-bold uppercase transition-colors cursor-pointer flex items-center gap-1.5"
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
        </div>
    );
};
