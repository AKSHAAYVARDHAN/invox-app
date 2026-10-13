import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
    getTeamInvitation,
    getTeam,
    checkTeamMembership,
    joinTeamViaInvitation,
    type TeamInvitation,
    type Team,
} from '../../services/teamService';
import {
    UsersIcon,
    CheckIcon,
    ClipboardIcon,
    ArrowUpRightIcon,
} from './Icons';

export interface TeamInvitationCardProps {
    inviteUrl: string;
    token: string;
    teamId?: string | null;
    targetHash: string;
    className?: string;
    timestamp?: string;
    isSender?: boolean;
    onJoined?: (team: Team) => void;
    onOpenTeamChat?: (teamId: string) => void;
}

export type InvitationLifecycleState =
    | 'loading'
    | 'invited'
    | 'joining'
    | 'member'
    | 'expired'
    | 'revoked'
    | 'limit_reached'
    | 'invalid';

export const TeamInvitationCard: React.FC<TeamInvitationCardProps> = ({
    inviteUrl,
    token,
    teamId: propTeamId,
    targetHash,
    className = '',
    timestamp,
    isSender = false,
    onJoined,
    onOpenTeamChat,
}) => {
    const { currentUser, userProfile } = useAuth();
    const navigate = useNavigate();

    const [invitation, setInvitation] = useState<TeamInvitation | null>(null);
    const [team, setTeam] = useState<Team | null>(null);
    const [lifecycleState, setLifecycleState] = useState<InvitationLifecycleState>('loading');
    const [statusErrorMessage, setStatusErrorMessage] = useState<string | null>(null);
    const [copied, setCopied] = useState<boolean>(false);
    const isJoiningRef = useRef<boolean>(false);

    // Load invitation and determine authentic membership state
    const syncInvitationData = useCallback(async (isMountedRef: { current: boolean }) => {
        if (!token) {
            if (isMountedRef.current) {
                setLifecycleState('invalid');
                setStatusErrorMessage('Invalid invitation token');
            }
            return;
        }

        try {
            const inv = await getTeamInvitation(token);
            if (!isMountedRef.current) return;

            if (!inv) {
                setLifecycleState('invalid');
                setStatusErrorMessage('Invitation not found or removed');
                return;
            }

            setInvitation(inv);

            // 1. Check revocation
            if (inv.status === 'revoked') {
                setLifecycleState('revoked');
                setStatusErrorMessage('Invitation revoked by team owner');
                return;
            }

            // 2. Check expiration
            if (inv.expiresAt) {
                const expTime =
                    typeof inv.expiresAt?.toDate === 'function'
                        ? inv.expiresAt.toDate().getTime()
                        : new Date(inv.expiresAt).getTime();
                if (expTime > 0 && Date.now() > expTime) {
                    setLifecycleState('expired');
                    setStatusErrorMessage('Invitation has expired');
                    return;
                }
            }

            // 3. Check usage limit
            if (inv.maxUses && inv.maxUses > 0 && inv.usedCount >= inv.maxUses) {
                setLifecycleState('limit_reached');
                setStatusErrorMessage('Invitation usage limit reached');
                return;
            }

            // 4. Fetch team and verify trusted membership
            const resolvedTeamId = inv.teamId || propTeamId;
            if (resolvedTeamId) {
                const teamData = await getTeam(resolvedTeamId);
                if (isMountedRef.current && teamData) {
                    setTeam(teamData);

                    // Verify if current user is an authentic member
                    if (currentUser?.uid) {
                        const isMember = await checkTeamMembership(resolvedTeamId, currentUser.uid);
                        if (isMountedRef.current) {
                            if (isMember) {
                                setLifecycleState('member');
                                setStatusErrorMessage(null);
                                return;
                            }
                        }
                    }
                }
            }

            // Not yet a member -> State A: Invited
            if (isMountedRef.current) {
                setLifecycleState('invited');
                setStatusErrorMessage(null);
            }
        } catch (err: any) {
            console.warn('[TEAM_INVITATION_CARD_SYNC_WARN]', err);
            if (isMountedRef.current) {
                setLifecycleState('invited');
                setStatusErrorMessage(null);
            }
        }
    }, [token, propTeamId, currentUser?.uid]);

    useEffect(() => {
        const isMountedRef = { current: true };
        setLifecycleState('loading');
        syncInvitationData(isMountedRef);

        return () => {
            isMountedRef.current = false;
        };
    }, [syncInvitationData]);

    // Handle primary action: JOIN TEAM vs OPEN TEAM CHAT
    const handlePrimaryAction = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (
            lifecycleState === 'loading' ||
            lifecycleState === 'joining' ||
            lifecycleState === 'invalid' ||
            lifecycleState === 'expired' ||
            lifecycleState === 'revoked' ||
            lifecycleState === 'limit_reached'
        ) {
            return;
        }

        // Action when already a member: OPEN TEAM CHAT
        if (lifecycleState === 'member') {
            const effectiveTeamId = invitation?.teamId || team?.id || propTeamId;
            if (onOpenTeamChat && effectiveTeamId) {
                onOpenTeamChat(effectiveTeamId);
                return;
            }
            if (effectiveTeamId) {
                const teamRoute = `/spotlight?tab=Collabs&collabView=teams&teamId=${encodeURIComponent(effectiveTeamId)}`;
                if (typeof window !== 'undefined') {
                    window.location.hash = `#${teamRoute}`;
                }
                navigate(teamRoute);
            } else if (targetHash) {
                const cleanHash = targetHash.startsWith('#') ? targetHash : `#${targetHash}`;
                if (typeof window !== 'undefined') {
                    window.location.hash = cleanHash;
                }
                const routePath = cleanHash.startsWith('#') ? cleanHash.slice(1) : cleanHash;
                navigate(routePath);
            }
            return;
        }

        // Action when not yet a member: JOIN TEAM
        if (!currentUser) {
            // Unauthenticated: preserve invitation in sessionStorage & redirect to login
            const targetRedirect = targetHash.startsWith('#') ? targetHash.slice(1) : targetHash;
            if (typeof window !== 'undefined') {
                sessionStorage.setItem('invox_redirect', targetRedirect);
            }
            navigate('/login', { state: { from: targetRedirect } });
            return;
        }

        // Prevent duplicate submissions
        if (isJoiningRef.current) return;
        isJoiningRef.current = true;

        // State B: Joining in progress
        setLifecycleState('joining');
        setStatusErrorMessage(null);

        try {
            const result = await joinTeamViaInvitation({
                token,
                user: currentUser,
                userProfile,
            });

            // State C: Successfully joined verified by backend
            if (result && result.team) {
                setTeam(result.team);
                setLifecycleState('member');
                setStatusErrorMessage(null);
                if (onJoined) {
                    onJoined(result.team);
                }
            } else {
                setLifecycleState('invited');
                setStatusErrorMessage('Could not verify team membership. Please retry.');
            }
        } catch (err: any) {
            console.error('[JOIN_TEAM_ERROR]', err);
            const msg = err?.message || 'Failed to accept invitation.';
            setStatusErrorMessage(msg);
            setLifecycleState('invited');
        } finally {
            isJoiningRef.current = false;
        }
    };

    const handleCopyLink = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const urlToCopy =
            inviteUrl ||
            (typeof window !== 'undefined'
                ? `${window.location.origin}/${targetHash}`
                : targetHash);

        if (typeof navigator !== 'undefined' && navigator.clipboard) {
            navigator.clipboard
                .writeText(urlToCopy)
                .then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                })
                .catch(() => {});
        }
    };

    // Extract domain or short indicator
    const hostLabel = (() => {
        try {
            if (inviteUrl.startsWith('http')) {
                const u = new URL(inviteUrl);
                return u.host;
            }
        } catch {
            // fallback
        }
        return 'invox.vercel.app';
    })();

    const teamTitle = invitation?.teamName || team?.name || 'Project Team';
    const projectTitle = invitation?.projectTitle || team?.projectTitle || 'Collaborative Workspace';
    const inviterName = invitation?.ownerName || team?.ownerName || 'Team Lead';

    return (
        <div
            className={`w-full max-w-[340px] sm:max-w-[380px] min-h-[250px] my-2 bg-[#0c0c0e] border border-zinc-800 flex flex-col justify-between font-mono select-none transition-all shadow-xl hover:border-zinc-700 rounded-none ${className}`}
        >
            {/* Header: Fixed top bar with status badge */}
            <div className="h-8 px-3.5 border-b border-zinc-800/90 bg-black/60 flex items-center justify-between text-[10px] flex-shrink-0">
                <div className="flex items-center gap-2 truncate">
                    <span
                        className={`w-1.5 h-1.5 rounded-none flex-shrink-0 ${
                            lifecycleState === 'member'
                                ? 'bg-emerald-400 animate-pulse'
                                : lifecycleState === 'joining'
                                ? 'bg-amber-400 animate-pulse'
                                : lifecycleState === 'expired' || lifecycleState === 'revoked' || lifecycleState === 'invalid'
                                ? 'bg-red-500'
                                : 'bg-blue-400 animate-pulse'
                        }`}
                    />
                    <span className="font-bold text-zinc-300 uppercase tracking-widest truncate">
                        // TEAM INVITATION
                    </span>
                </div>

                <div className="flex items-center flex-shrink-0 pl-2">
                    {lifecycleState === 'loading' ? (
                        <span className="text-zinc-500 uppercase tracking-wider text-[9px]">
                            // SYNCING
                        </span>
                    ) : lifecycleState === 'member' ? (
                        <span className="text-emerald-400 font-bold uppercase tracking-wider text-[9px] bg-emerald-950/60 border border-emerald-800 px-1.5 py-0.5">
                            MEMBER
                        </span>
                    ) : lifecycleState === 'joining' ? (
                        <span className="text-amber-400 font-bold uppercase tracking-wider text-[9px] bg-amber-950/60 border border-amber-800 px-1.5 py-0.5">
                            JOINING
                        </span>
                    ) : lifecycleState === 'expired' ? (
                        <span className="text-amber-400 font-bold uppercase tracking-wider text-[9px] bg-amber-950/60 border border-amber-800 px-1.5 py-0.5">
                            EXPIRED
                        </span>
                    ) : lifecycleState === 'revoked' ? (
                        <span className="text-red-400 font-bold uppercase tracking-wider text-[9px] bg-red-950/60 border border-red-800 px-1.5 py-0.5">
                            REVOKED
                        </span>
                    ) : lifecycleState === 'limit_reached' ? (
                        <span className="text-amber-400 font-bold uppercase tracking-wider text-[9px] bg-amber-950/60 border border-amber-800 px-1.5 py-0.5">
                            FULL
                        </span>
                    ) : lifecycleState === 'invalid' ? (
                        <span className="text-red-400 font-bold uppercase tracking-wider text-[9px] bg-red-950/60 border border-red-800 px-1.5 py-0.5">
                            INVALID
                        </span>
                    ) : (
                        <span className="text-blue-400 font-bold uppercase tracking-wider text-[9px] bg-blue-950/60 border border-blue-800 px-1.5 py-0.5">
                            INVITED
                        </span>
                    )}
                </div>
            </div>

            {/* Body: Standard fixed-slot metadata structure */}
            <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between space-y-3">
                {/* Heading & Users Icon */}
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-emerald-950/40 border border-emerald-800/80 text-emerald-400 flex items-center justify-center flex-shrink-0 shadow-sm rounded-none">
                        <UsersIcon className="w-5 h-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                        <span className="block font-bold text-white text-xs sm:text-sm uppercase tracking-wide truncate">
                            TEAM INVITATION
                        </span>
                        <span className="block text-zinc-400 text-xs mt-0.5 leading-snug line-clamp-1">
                            You've been invited to collaborate.
                        </span>
                    </div>
                </div>

                {/* Team & Project Metadata Slots */}
                <div className="pt-2 border-t border-zinc-850 space-y-1 text-[11px]">
                    <div className="flex items-center gap-1.5 text-zinc-300">
                        <span className="text-zinc-500 font-bold text-[9px] uppercase tracking-wider flex-shrink-0">
                            // TEAM:
                        </span>
                        <span className="font-semibold text-white truncate" title={teamTitle}>
                            {teamTitle}
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-zinc-400">
                        <span className="text-zinc-500 font-bold text-[9px] uppercase tracking-wider flex-shrink-0">
                            // PROJECT:
                        </span>
                        <span className="truncate text-zinc-300" title={projectTitle}>
                            {projectTitle}
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-zinc-500 text-[10px]">
                        <span className="font-bold uppercase tracking-wider flex-shrink-0">
                            BY:
                        </span>
                        <span className="text-zinc-400 truncate" title={inviterName}>
                            {inviterName}
                        </span>
                    </div>
                </div>

                {/* Status Notice for errors or warnings */}
                {statusErrorMessage && (
                    <div className="px-2.5 py-1 bg-zinc-950 border border-zinc-800 text-[10px] text-amber-400 flex items-center gap-1.5">
                        <span className="font-bold flex-shrink-0">// NOTE:</span>
                        <span className="truncate">{statusErrorMessage}</span>
                    </div>
                )}

                {/* Pinned Bottom Actions */}
                <div className="mt-auto pt-2.5 border-t border-zinc-850/80 space-y-2">
                    <button
                        type="button"
                        onClick={handlePrimaryAction}
                        disabled={
                            lifecycleState === 'loading' ||
                            lifecycleState === 'joining' ||
                            lifecycleState === 'invalid' ||
                            lifecycleState === 'expired' ||
                            lifecycleState === 'revoked' ||
                            lifecycleState === 'limit_reached'
                        }
                        className={`w-full h-9 py-2 px-3 text-xs uppercase tracking-wider font-bold transition-all flex items-center justify-center gap-2 font-mono rounded-none ${
                            lifecycleState === 'member'
                                ? 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-600 cursor-pointer active:scale-[0.99]'
                                : lifecycleState === 'joining'
                                ? 'bg-zinc-900 border border-zinc-700 text-zinc-300 cursor-wait'
                                : lifecycleState === 'invalid' ||
                                  lifecycleState === 'expired' ||
                                  lifecycleState === 'revoked' ||
                                  lifecycleState === 'limit_reached'
                                ? 'bg-zinc-950 border border-zinc-850 text-zinc-600 cursor-not-allowed'
                                : 'bg-white hover:bg-zinc-200 text-black border border-white cursor-pointer active:scale-[0.99]'
                        }`}
                    >
                        {lifecycleState === 'loading' ? (
                            <>
                                <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                <span>VERIFYING INVITATION...</span>
                            </>
                        ) : lifecycleState === 'joining' ? (
                            <>
                                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                <span>JOINING TEAM...</span>
                            </>
                        ) : lifecycleState === 'member' ? (
                            <>
                                <span>OPEN TEAM CHAT</span>
                                <span>→</span>
                            </>
                        ) : lifecycleState === 'expired' ? (
                            <span>INVITATION EXPIRED</span>
                        ) : lifecycleState === 'revoked' ? (
                            <span>INVITATION REVOKED</span>
                        ) : lifecycleState === 'limit_reached' ? (
                            <span>USES LIMIT REACHED</span>
                        ) : lifecycleState === 'invalid' ? (
                            <span>INVALID INVITATION</span>
                        ) : (
                            <>
                                <span>JOIN TEAM</span>
                                <span>→</span>
                            </>
                        )}
                    </button>

                    {/* Subtle Invitation Link Indicator & Copy Action */}
                    <div className="h-4 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                        <div className="flex items-center gap-1.5 truncate max-w-[70%]">
                            <ArrowUpRightIcon className="w-3 h-3 text-zinc-600 flex-shrink-0" />
                            <span className="truncate text-zinc-400 hover:text-zinc-300" title={inviteUrl}>
                                {hostLabel}
                            </span>
                            <span className="text-zinc-600 flex-shrink-0">#{token.slice(0, 6)}</span>
                        </div>

                        <button
                            type="button"
                            onClick={handleCopyLink}
                            className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-white px-1.5 py-0.5 bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 transition-colors cursor-pointer rounded-none"
                            title="Copy invitation URL"
                        >
                            {copied ? (
                                <>
                                    <CheckIcon className="w-3 h-3 text-emerald-400" />
                                    <span className="text-emerald-400 font-bold">COPIED</span>
                                </>
                            ) : (
                                <>
                                    <ClipboardIcon className="w-3 h-3 text-zinc-500" />
                                    <span>COPY</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TeamInvitationCard;
