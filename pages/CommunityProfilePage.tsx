import React, { useState, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
    subscribeCommunity, 
    subscribeCommunityMembers, 
    subscribeConclaveGatherings,
    joinCommunity, 
    leaveCommunity, 
    updateCommunityIdentity,
    createConclaveGathering,
    ConclaveCreateInput
} from '../services/communityService';
import type { 
    Community, 
    CommunityMembership, 
    ConclaveGathering 
} from '../types';
import { 
    UsersIcon, 
    ShieldCheckIcon, 
    GlobeAltIcon, 
    LockClosedIcon, 
    ArrowLeftIcon,
    CalendarDaysIcon,
    ClockIcon,
    MapPinIcon,
    SparklesIcon,
    PlusIcon,
    CloseIcon,
    PencilSquareIcon,
    CheckCircleIcon
} from '../components/ui/Icons';
import { handleImageError } from '../components/utils/imageUtils';

type CommunityPillarTab = 'identity' | 'conclave' | 'memory' | 'influence' | 'health';

export const CommunityProfilePage: React.FC = () => {
    const { communityId } = ReactRouterDOM.useParams<{ communityId: string }>();
    const navigate = ReactRouterDOM.useNavigate();
    const { currentUser, userProfile } = useAuth();

    const [community, setCommunity] = useState<Community | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<CommunityPillarTab>('identity');

    const [members, setMembers] = useState<CommunityMembership[]>([]);
    const [gatherings, setGatherings] = useState<ConclaveGathering[]>([]);
    const [myMembership, setMyMembership] = useState<CommunityMembership | null>(null);

    const [actionLoading, setActionLoading] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isScheduleConclaveOpen, setIsScheduleConclaveOpen] = useState(false);

    // Edit modal state
    const [editName, setEditName] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editPurpose, setEditPurpose] = useState('');
    const [editFoundingStory, setEditFoundingStory] = useState('');
    const [editValues, setEditValues] = useState('');
    const [editGuidelines, setEditGuidelines] = useState('');

    // Schedule conclave state
    const [conclaveTitle, setConclaveTitle] = useState('');
    const [conclaveDesc, setConclaveDesc] = useState('');
    const [conclaveFormat, setConclaveFormat] = useState<'online' | 'offline' | 'hybrid'>('online');
    const [conclaveDate, setConclaveDate] = useState('');
    const [conclaveTime, setConclaveTime] = useState('');
    const [conclaveLocation, setConclaveLocation] = useState('');
    const [conclaveVirtualUrl, setConclaveVirtualUrl] = useState('');

    useEffect(() => {
        if (!communityId) return;

        setLoading(true);
        const unsubscribeComm = subscribeCommunity(
            communityId,
            (comm) => {
                setCommunity(comm);
                setLoading(false);
                if (comm) {
                    setEditName(comm.name);
                    setEditDescription(comm.description);
                    setEditPurpose(comm.purpose || comm.description);
                    setEditFoundingStory(comm.foundingStory || '');
                    setEditValues(comm.values ? comm.values.join('\n') : '');
                    setEditGuidelines(comm.guidelines ? comm.guidelines.join('\n') : '');
                }
            },
            (err) => {
                console.error('[COMMUNITY_PROFILE_ERROR]', err);
                setError("Failed to load community profile.");
                setLoading(false);
            }
        );

        const unsubscribeMembers = subscribeCommunityMembers(
            communityId,
            (mList) => {
                setMembers(mList);
                if (currentUser?.uid) {
                    const found = mList.find(m => m.userId === currentUser.uid);
                    setMyMembership(found || null);
                }
            }
        );

        const unsubscribeConclaves = subscribeConclaveGatherings(
            communityId,
            (gList) => {
                setGatherings(gList);
            }
        );

        return () => {
            unsubscribeComm();
            unsubscribeMembers();
            unsubscribeConclaves();
        };
    }, [communityId, currentUser?.uid]);

    const isOwner = currentUser?.uid && community?.ownerId === currentUser.uid;
    const isMember = Boolean(myMembership && myMembership.status === 'active');
    const isPending = Boolean(myMembership && myMembership.status === 'pending');
    const canManage = isOwner || (myMembership && (myMembership.role === 'organizer' || myMembership.role === 'moderator'));

    const isMockCommunity = Boolean(communityId && communityId.startsWith('mock-'));

    const handleJoinClick = async () => {
        if (!currentUser && !isMockCommunity) {
            navigate('/login');
            return;
        }
        if (!community) return;

        if (isMockCommunity) {
            setMyMembership({
                id: `mock-m-${communityId}-user`,
                communityId,
                communityName: community.name,
                userId: currentUser?.uid || 'guest-user',
                userName: currentUser?.displayName || 'Reviewer',
                role: 'member',
                status: 'active',
                joinedAt: new Date(),
            });
            return;
        }

        try {
            setActionLoading(true);
            const res = await joinCommunity(community, userProfile || currentUser!);
            if (res.status === 'pending') {
                alert("Your membership request has been submitted to the community organizers for review.");
            }
        } catch (err: any) {
            alert(err?.message || "Failed to join collective.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleLeaveClick = async () => {
        if (!community) return;
        if (isOwner) {
            alert("Collective founders cannot leave their collective without transferring ownership.");
            return;
        }
        if (!window.confirm("Leave this community collective?")) return;

        if (isMockCommunity) {
            setMyMembership(null);
            return;
        }

        if (!currentUser) return;

        try {
            setActionLoading(true);
            await leaveCommunity(community.id, currentUser.uid);
            setMyMembership(null);
        } catch (err: any) {
            alert(err?.message || "Failed to leave collective.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleSaveIdentity = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!communityId) return;

        const values = editValues.split('\n').map(v => v.trim()).filter(Boolean);
        const guidelines = editGuidelines.split('\n').map(g => g.trim()).filter(Boolean);

        if (isMockCommunity) {
            setCommunity(prev => prev ? ({
                ...prev,
                name: editName.trim(),
                description: editDescription.trim(),
                purpose: editPurpose.trim(),
                foundingStory: editFoundingStory.trim(),
                values,
                guidelines,
            }) : null);
            setIsEditModalOpen(false);
            return;
        }

        try {
            setActionLoading(true);
            await updateCommunityIdentity(communityId, {
                name: editName.trim(),
                description: editDescription.trim(),
                purpose: editPurpose.trim(),
                foundingStory: editFoundingStory.trim(),
                values,
                guidelines,
            });

            setIsEditModalOpen(false);
        } catch (err: any) {
            alert(err?.message || "Failed to update collective identity.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleScheduleConclave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!communityId || !community) return;

        if (!conclaveTitle.trim() || !conclaveDate || !conclaveTime) {
            alert("Title, date, and time are required to schedule a gathering.");
            return;
        }

        if (isMockCommunity) {
            const newMockConclave: ConclaveGathering = {
                id: `mock-gathering-${Date.now()}`,
                communityId,
                communityName: community.name,
                communityAvatarUrl: community.avatarUrl,
                title: conclaveTitle.trim(),
                description: conclaveDesc.trim(),
                format: conclaveFormat,
                date: conclaveDate,
                time: conclaveTime,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
                location: conclaveLocation.trim() || undefined,
                virtualUrl: conclaveVirtualUrl.trim() || undefined,
                hostId: currentUser?.uid || 'guest-host',
                hostName: currentUser?.displayName || 'Host Organizer',
                capacity: 100,
                attendeeCount: 1,
                attendeeIds: [currentUser?.uid || 'guest-host'],
                status: 'scheduled',
                createdAt: new Date(),
            };
            setGatherings(prev => [newMockConclave, ...prev]);
            setIsScheduleConclaveOpen(false);
            setConclaveTitle('');
            setConclaveDesc('');
            setConclaveLocation('');
            setConclaveVirtualUrl('');
            return;
        }

        if (!currentUser) {
            navigate('/login');
            return;
        }

        try {
            setActionLoading(true);
            const input: ConclaveCreateInput = {
                communityId,
                communityName: community.name,
                communityAvatarUrl: community.avatarUrl,
                title: conclaveTitle.trim(),
                description: conclaveDesc.trim(),
                format: conclaveFormat,
                date: conclaveDate,
                time: conclaveTime,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
                location: conclaveLocation.trim() || undefined,
                virtualUrl: conclaveVirtualUrl.trim() || undefined,
            };

            await createConclaveGathering(input, userProfile || currentUser);
            setIsScheduleConclaveOpen(false);
            setConclaveTitle('');
            setConclaveDesc('');
            setConclaveLocation('');
            setConclaveVirtualUrl('');
        } catch (err: any) {
            alert(err?.message || "Failed to schedule gathering.");
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="py-20 text-center font-mono text-xs text-zinc-500 space-y-3">
                <div className="w-8 h-8 border border-zinc-700 border-t-white animate-spin mx-auto" />
                <p className="uppercase tracking-widest">// LOADING_COLLECTIVE_RECORD...</p>
            </div>
        );
    }

    if (error || !community) {
        return (
            <div className="py-16 text-center font-mono text-xs space-y-4 border border-dashed border-zinc-800 bg-[#0c0c0e]">
                <p className="text-zinc-400 font-bold uppercase">// COLLECTIVE_NOT_FOUND</p>
                <p className="text-zinc-500 max-w-md mx-auto">
                    The requested collective record does not exist or may have restricted privacy parameters.
                </p>
                <button
                    onClick={() => navigate('/communities')}
                    className="px-4 py-2 bg-white text-black font-bold uppercase hover:bg-zinc-200 transition-colors"
                >
                    ← Return to Discover
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6 font-mono text-xs pb-12">
            {/* Top Navigation */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => navigate('/communities')}
                    className="flex items-center gap-2 text-zinc-400 hover:text-white uppercase transition-colors"
                >
                    <ArrowLeftIcon className="w-4 h-4" />
                    <span>// BACK_TO_DISCOVERY</span>
                </button>
                <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                    <span>HANDLE:</span>
                    <span className="text-emerald-400 font-bold">@{community.handle || community.id}</span>
                </div>
            </div>

            {isMockCommunity && (
                <div className="p-3 bg-amber-950/20 border border-amber-800/60 text-amber-300 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        <span className="font-bold">// DEMONSTRATION_MODE: PRESERVED SAMPLE COMMUNITY FOR UI REVIEW</span>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-amber-400/80 border border-amber-900 bg-black/40 px-2 py-0.5">
                        SAMPLE MOCK DATA
                    </span>
                </div>
            )}

            {/* Collective Hero Card */}
            <div className="bg-[#0c0c0e] border border-zinc-800 relative overflow-hidden">
                {/* Banner backdrop if available */}
                {community.bannerUrl ? (
                    <div className="h-32 w-full overflow-hidden border-b border-zinc-850">
                        <img
                            src={community.bannerUrl}
                            onError={handleImageError}
                            alt=""
                            className="w-full h-full object-cover opacity-40 filter saturate-50"
                        />
                    </div>
                ) : (
                    <div className="h-16 w-full bg-gradient-to-r from-zinc-950 via-zinc-900 to-black border-b border-zinc-850" />
                )}

                <div className="p-6 relative">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-start gap-4">
                            {community.avatarUrl ? (
                                <img
                                    src={community.avatarUrl}
                                    onError={handleImageError}
                                    alt={community.name}
                                    className="w-16 h-16 border-2 border-zinc-700 object-cover flex-shrink-0 bg-black"
                                />
                            ) : (
                                <div className="w-16 h-16 bg-black border-2 border-zinc-700 flex items-center justify-center text-zinc-400 flex-shrink-0">
                                    <UsersIcon className="w-8 h-8" />
                                </div>
                            )}

                            <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h1 className="text-lg md:text-xl font-bold text-white tracking-wide uppercase">
                                        {community.name}
                                    </h1>
                                    {community.isVerified && (
                                        <ShieldCheckIcon className="w-4 h-4 text-emerald-400" />
                                    )}
                                    <span className="text-[10px] uppercase px-2 py-0.5 border border-zinc-800 bg-black text-zinc-400">
                                        {community.category}
                                    </span>
                                    <span className="text-[10px] uppercase px-2 py-0.5 border border-zinc-800 bg-black text-zinc-500">
                                        {community.visibility === 'private' ? 'PRIVATE' : 'PUBLIC'}
                                    </span>
                                </div>

                                <p className="text-zinc-300 text-xs max-w-2xl leading-relaxed">
                                    {community.purpose || community.description}
                                </p>

                                <div className="flex items-center gap-4 pt-1 text-[11px] text-zinc-500">
                                    <span>
                                        VERIFIED MEMBERS: <strong className="text-white">{community.memberCount || 1}</strong>
                                    </span>
                                    <span>•</span>
                                    <span>
                                        FOUNDER: <strong className="text-zinc-300">{community.ownerName || 'Verified Founder'}</strong>
                                    </span>
                                    <span>•</span>
                                    <span>
                                        JOIN POLICY: <strong className="text-zinc-400 uppercase">{community.joinPolicy === 'approval_required' ? 'Approval Required' : 'Direct Join'}</strong>
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* CTA / Membership Buttons */}
                        <div className="flex items-center gap-3 flex-shrink-0">
                            {canManage && (
                                <button
                                    onClick={() => setIsEditModalOpen(true)}
                                    className="px-3 py-2 border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 uppercase flex items-center gap-1.5 transition-colors"
                                >
                                    <PencilSquareIcon className="w-3.5 h-3.5" />
                                    <span>Edit Collective</span>
                                </button>
                            )}

                            {isOwner ? (
                                <span className="px-4 py-2 bg-amber-950/40 border border-amber-800 text-amber-300 uppercase font-bold tracking-wider">
                                    // FOUNDER_OWNER
                                </span>
                            ) : isMember ? (
                                <div className="flex items-center gap-2">
                                    <span className="px-3 py-2 bg-emerald-950/40 border border-emerald-800 text-emerald-400 uppercase font-bold">
                                        // MEMBER
                                    </span>
                                    <button
                                        onClick={handleLeaveClick}
                                        disabled={actionLoading}
                                        className="px-3 py-2 border border-zinc-800 text-zinc-500 hover:text-rose-400 uppercase transition-colors"
                                    >
                                        Leave
                                    </button>
                                </div>
                            ) : isPending ? (
                                <span className="px-4 py-2 bg-amber-950/30 border border-amber-800/80 text-amber-400 uppercase font-bold tracking-wider">
                                    // MEMBERSHIP_PENDING
                                </span>
                            ) : (
                                <button
                                    onClick={handleJoinClick}
                                    disabled={actionLoading}
                                    className="px-6 py-2.5 bg-white text-black font-bold uppercase hover:bg-zinc-200 transition-colors shadow-sm disabled:opacity-50"
                                >
                                    {actionLoading ? 'PROCESSING...' : community.joinPolicy === 'approval_required' ? 'REQUEST TO JOIN' : 'JOIN COLLECTIVE'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Topics / Tags Bar */}
                {community.topics && community.topics.length > 0 && (
                    <div className="px-6 pb-4 flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] text-zinc-600 uppercase">// DOMAINS:</span>
                        {community.topics.map(t => (
                            <span key={t} className="px-2 py-0.5 bg-black border border-zinc-850 text-zinc-400 text-[10px]">
                                #{t}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Five Pillars Navigation Tabs */}
            <div className="flex items-center gap-1 border-b border-zinc-800 overflow-x-auto no-scrollbar">
                {[
                    { id: 'identity', label: '01. COLLECTIVE IDENTITY', subtitle: 'Who We Are' },
                    { id: 'conclave', label: '02. CONCLAVE', subtitle: 'How We Gather' },
                    { id: 'memory', label: '03. COLLECTIVE MEMORY', subtitle: 'What We Preserve' },
                    { id: 'influence', label: '04. MEMBER INFLUENCE', subtitle: 'How We Evolve' },
                    { id: 'health', label: '05. COMMUNITY HEALTH', subtitle: 'Health Indicators' },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as CommunityPillarTab)}
                        className={`px-4 py-3 font-bold uppercase tracking-wider text-xs whitespace-nowrap transition-all border-b-2 -mb-[1px] ${
                            activeTab === tab.id
                                ? 'border-white text-white bg-zinc-900/40'
                                : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/20'
                        }`}
                    >
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Pillar Content Panels */}
            <div className="mt-6">
                {/* ─── PILLAR 01: COLLECTIVE IDENTITY ────────────────────────────── */}
                {activeTab === 'identity' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-2 space-y-6">
                                {/* Founding Story */}
                                <div className="bg-[#0c0c0e] border border-zinc-800 p-5 space-y-3">
                                    <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
                                        <h3 className="font-bold text-white uppercase tracking-wider">
                                            // FOUNDING_ORIGIN_STORY
                                        </h3>
                                        <span className="text-[10px] text-zinc-500">CANONICAL RECORD</span>
                                    </div>
                                    <p className="text-zinc-300 leading-relaxed text-xs">
                                        {community.foundingStory || "This collective was formed by foundational members to cultivate open dialogue, shared domain practices, and persistent collaboration around common challenges."}
                                    </p>
                                </div>

                                {/* Core Values & Principles */}
                                <div className="bg-[#0c0c0e] border border-zinc-800 p-5 space-y-3">
                                    <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
                                        <h3 className="font-bold text-white uppercase tracking-wider">
                                            // CORE_VALUES_AND_PRINCIPLES
                                        </h3>
                                        <span className="text-[10px] text-zinc-500">MEMBER CHARTER</span>
                                    </div>
                                    {community.values && community.values.length > 0 ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                            {community.values.map((val, idx) => (
                                                <div key={idx} className="p-3 bg-black border border-zinc-850 flex items-start gap-2.5">
                                                    <span className="text-emerald-400 font-bold">#{(idx + 1).toString().padStart(2, '0')}</span>
                                                    <span className="text-zinc-300">{val}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-zinc-500 italic py-2">
                                            Principles are currently established through organic consensus.
                                        </p>
                                    )}
                                </div>

                                {/* Community Guidelines */}
                                <div className="bg-[#0c0c0e] border border-zinc-800 p-5 space-y-3">
                                    <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
                                        <h3 className="font-bold text-white uppercase tracking-wider">
                                            // COLLECTIVE_GUIDELINES
                                        </h3>
                                        <span className="text-[10px] text-zinc-500">STANDARDS</span>
                                    </div>
                                    {community.guidelines && community.guidelines.length > 0 ? (
                                        <ul className="space-y-2 pt-1 text-zinc-300 list-disc list-inside">
                                            {community.guidelines.map((rule, idx) => (
                                                <li key={idx} className="leading-relaxed">
                                                    <span className="text-zinc-200">{rule}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <ul className="space-y-1.5 text-zinc-400 pt-1">
                                            <li>1. Provide reproducible arguments and citations for technical assertions.</li>
                                            <li>2. Constructive engagement; focus critique on systems rather than individuals.</li>
                                            <li>3. Adhere to zero spam and high signal-to-noise collective standards.</li>
                                        </ul>
                                    )}
                                </div>
                            </div>

                            {/* Sidebar: Verified Members & Governance Structure */}
                            <div className="space-y-6">
                                <div className="bg-[#0c0c0e] border border-zinc-800 p-5 space-y-4">
                                    <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
                                        <h3 className="font-bold text-white uppercase tracking-wider">
                                            // MEMBERSHIP_STRUCTURE
                                        </h3>
                                        <span className="text-[10px] text-zinc-500">{members.length} VERIFIED</span>
                                    </div>

                                    <div className="space-y-2.5">
                                        {members.slice(0, 8).map(member => (
                                            <div key={member.id} className="flex items-center justify-between p-2 bg-black border border-zinc-900">
                                                <div className="flex items-center gap-2.5 overflow-hidden">
                                                    {member.userAvatar ? (
                                                        <img
                                                            src={member.userAvatar}
                                                            onError={handleImageError}
                                                            alt={member.userName}
                                                            className="w-6 h-6 border border-zinc-800 object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-6 h-6 bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
                                                            <UsersIcon className="w-3.5 h-3.5" />
                                                        </div>
                                                    )}
                                                    <span className="text-white font-bold truncate">
                                                        {member.userName}
                                                    </span>
                                                </div>
                                                <span className={`text-[9px] uppercase px-1.5 py-0.2 border ${
                                                    member.role === 'owner' ? 'text-amber-400 border-amber-900 bg-amber-950/40' : 'text-zinc-500 border-zinc-850'
                                                }`}>
                                                    {member.role}
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    {members.length > 8 && (
                                        <p className="text-[10px] text-zinc-600 text-center pt-1">
                                            + {members.length - 8} more verified members
                                        </p>
                                    )}
                                </div>

                                <div className="bg-[#0c0c0e] border border-zinc-800 p-4 space-y-2 text-[11px] text-zinc-400">
                                    <div className="text-zinc-500 uppercase text-[10px] font-bold">
                                        // GOVERNANCE_POLICY
                                    </div>
                                    <p>
                                        Membership decisions and identity updates are safeguarded by cryptographic Firestore authorization gates.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── PILLAR 02: CONCLAVE GATHERINGS ────────────────────────────── */}
                {activeTab === 'conclave' && (
                    <div className="space-y-6">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#0c0c0e] border border-zinc-800 p-4">
                            <div>
                                <h3 className="font-bold text-white uppercase tracking-wider">
                                    // CONCLAVE_GATHERINGS: HOW_WE_GATHER
                                </h3>
                                <p className="text-zinc-400 text-xs mt-0.5">
                                    Structured online, offline, and hybrid gatherings organized by and for the collective.
                                </p>
                            </div>
                            {canManage && (
                                <button
                                    onClick={() => setIsScheduleConclaveOpen(true)}
                                    className="px-4 py-2 bg-white text-black font-bold uppercase hover:bg-zinc-200 transition-colors flex items-center gap-1.5"
                                >
                                    <PlusIcon className="w-4 h-4" />
                                    <span>Schedule Conclave</span>
                                </button>
                            )}
                        </div>

                        {gatherings.length === 0 ? (
                            <div className="py-16 text-center border border-dashed border-zinc-800 bg-[#0c0c0e] p-6 space-y-3">
                                <CalendarDaysIcon className="w-8 h-8 text-zinc-600 mx-auto" />
                                <h4 className="font-bold text-white uppercase">// NO_UPCOMING_CONCLAVES_SCHEDULED</h4>
                                <p className="text-zinc-500 text-xs max-w-md mx-auto">
                                    This collective has not published an active gathering. As the conclave system evolves, members and organizers will be able to propose and confirm sessions.
                                </p>
                                {canManage && (
                                    <div className="pt-2">
                                        <button
                                            onClick={() => setIsScheduleConclaveOpen(true)}
                                            className="px-4 py-2 bg-zinc-900 border border-zinc-700 text-white uppercase hover:bg-zinc-800 transition-colors"
                                        >
                                            Schedule First Conclave Gathering →
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {gatherings.map(g => (
                                    <div key={g.id} className="bg-[#0c0c0e] border border-zinc-800 p-5 space-y-3">
                                        <div className="flex justify-between items-start gap-2">
                                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 border border-zinc-800 bg-black text-emerald-400">
                                                {g.format} GATHERING
                                            </span>
                                            <span className="text-[10px] text-zinc-500 uppercase">{g.status}</span>
                                        </div>

                                        <div>
                                            <h4 className="font-bold text-white text-sm">{g.title}</h4>
                                            <p className="text-zinc-400 text-xs mt-1 line-clamp-2 leading-relaxed">
                                                {g.description}
                                            </p>
                                        </div>

                                        <div className="border-t border-zinc-850 pt-3 flex items-center justify-between text-[11px] text-zinc-400">
                                            <div className="flex items-center gap-2">
                                                <CalendarDaysIcon className="w-3.5 h-3.5 text-zinc-500" />
                                                <span>{g.date}</span>
                                                <ClockIcon className="w-3.5 h-3.5 text-zinc-500 ml-1" />
                                                <span>{g.time} {g.timezone}</span>
                                            </div>
                                            <span>
                                                Host: <strong className="text-zinc-300">{g.hostName}</strong>
                                            </span>
                                        </div>

                                        {g.virtualUrl && (
                                            <div className="pt-2">
                                                <a
                                                    href={g.virtualUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="w-full block text-center py-1.5 bg-zinc-900 border border-zinc-800 text-white uppercase hover:bg-zinc-800 transition-colors"
                                                >
                                                    Access Virtual Room ↗
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ─── PILLAR 03: COLLECTIVE MEMORY ────────────────────────────── */}
                {activeTab === 'memory' && (
                    <div className="space-y-6">
                        <div className="bg-[#0c0c0e] border border-zinc-800 p-4">
                            <h3 className="font-bold text-white uppercase tracking-wider">
                                // COLLECTIVE_MEMORY: WHAT_WE_PRESERVE
                            </h3>
                            <p className="text-zinc-400 text-xs mt-0.5">
                                Curated community history of founding milestones, traditions, and consequential collective choices.
                            </p>
                        </div>

                        <div className="bg-[#0c0c0e] border border-zinc-800 p-6 space-y-6">
                            <div className="relative border-l border-zinc-800 pl-6 space-y-6">
                                {/* Milestone 1: Founding */}
                                <div className="relative">
                                    <div className="absolute -left-[31px] top-0 w-3 h-3 bg-white border border-zinc-900"></div>
                                    <span className="text-[10px] text-zinc-500 uppercase font-mono">
                                        FOUNDING_MILESTONE • {community.createdAt ? new Date(community.createdAt).toLocaleDateString() : 'ESTABLISHED'}
                                    </span>
                                    <h4 className="text-white font-bold text-sm mt-0.5">Genesis of {community.name}</h4>
                                    <p className="text-zinc-400 text-xs mt-1 leading-relaxed">
                                        Formally chartered with primary domain focus on {community.category}. Initial membership authorized under founding stewardship.
                                    </p>
                                </div>

                                {community.milestones && community.milestones.map((m, idx) => (
                                    <div key={idx} className="relative">
                                        <div className="absolute -left-[31px] top-0 w-3 h-3 bg-zinc-700 border border-zinc-900"></div>
                                        <span className="text-[10px] text-zinc-500 uppercase font-mono">
                                            CANONICAL_RECORD • {m.date}
                                        </span>
                                        <h4 className="text-white font-bold text-sm mt-0.5">{m.title}</h4>
                                        <p className="text-zinc-400 text-xs mt-1 leading-relaxed">
                                            {m.description}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            <div className="border-t border-zinc-850 pt-4 text-center text-zinc-500 text-xs">
                                <p>// END OF CURRENT HISTORICAL LEDGER // Subsequent entries are curated through member consensus.</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── PILLAR 04: MEMBER INFLUENCE ────────────────────────────── */}
                {activeTab === 'influence' && (
                    <div className="space-y-6">
                        <div className="bg-[#0c0c0e] border border-zinc-800 p-4">
                            <h3 className="font-bold text-white uppercase tracking-wider">
                                // MEMBER_INFLUENCE: HOW_WE_EVOLVE
                            </h3>
                            <p className="text-zinc-400 text-xs mt-0.5">
                                Member consultations, architectural proposals, and governance steering.
                            </p>
                        </div>

                        <div className="border border-dashed border-zinc-800 bg-[#0c0c0e] p-8 text-center space-y-3">
                            <SparklesIcon className="w-8 h-8 text-zinc-600 mx-auto" />
                            <h4 className="font-bold text-white uppercase text-xs">
                                // NO_ACTIVE_CONSULTATIONS_OPEN
                            </h4>
                            <p className="text-zinc-500 text-xs max-w-md mx-auto">
                                There are no active member proposals requiring deliberation at this time. Routine administrative decisions remain distinct from consequential charter revisions.
                            </p>
                        </div>
                    </div>
                )}

                {/* ─── PILLAR 05: COMMUNITY HEALTH ────────────────────────────── */}
                {activeTab === 'health' && (
                    <div className="space-y-6">
                        <div className="bg-[#0c0c0e] border border-zinc-800 p-4">
                            <h3 className="font-bold text-white uppercase tracking-wider">
                                // COMMUNITY_HEALTH: HOW_WELL_WE_SERVE_MEMBERS
                            </h3>
                            <p className="text-zinc-400 text-xs mt-0.5">
                                Real indicators assessing belonging, inclusion, gathering quality, and sustainability.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="bg-[#0c0c0e] border border-zinc-800 p-4 space-y-1">
                                <span className="text-[10px] text-zinc-500 uppercase">VERIFIED MEMBERS</span>
                                <div className="text-xl font-bold text-white tabular-nums">
                                    {community.memberCount || 1}
                                </div>
                                <span className="text-[10px] text-zinc-500">100% Verified DB Records</span>
                            </div>

                            <div className="bg-[#0c0c0e] border border-zinc-800 p-4 space-y-1">
                                <span className="text-[10px] text-zinc-500 uppercase">GATHERING SESSIONS</span>
                                <div className="text-xl font-bold text-white tabular-nums">
                                    {gatherings.length}
                                </div>
                                <span className="text-[10px] text-zinc-500">Conclaves Hosted</span>
                            </div>

                            <div className="bg-[#0c0c0e] border border-zinc-800 p-4 space-y-1">
                                <span className="text-[10px] text-zinc-500 uppercase">COLLECTIVE AGE</span>
                                <div className="text-xl font-bold text-white tabular-nums">
                                    {community.createdAt ? Math.max(1, Math.floor((Date.now() - new Date(community.createdAt).getTime()) / (1000 * 60 * 60 * 24))) : 1}d
                                </div>
                                <span className="text-[10px] text-zinc-500">Active Operational Days</span>
                            </div>
                        </div>

                        <div className="p-4 bg-zinc-950 border border-zinc-850 text-zinc-400 text-xs space-y-1.5">
                            <strong className="text-white block uppercase">// TRANSPARENCY_INTEGRITY_NOTICE</strong>
                            <p>
                                INVOX Communities operates without manufactured scores or simulated engagement metrics. Communities of all sizes are evaluated on genuine member satisfaction, respectful moderation, and gathering consistency.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal: Edit Collective Identity */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-[#0c0c0e] border border-zinc-800 w-full max-w-xl max-h-[90vh] flex flex-col font-mono text-xs shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-black/60">
                            <h3 className="font-bold text-white uppercase tracking-wider">// EDIT_COLLECTIVE_IDENTITY</h3>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-zinc-500 hover:text-white">
                                <CloseIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveIdentity} className="p-6 overflow-y-auto no-scrollbar space-y-4">
                            <div>
                                <label className="block text-zinc-400 uppercase text-[10px] mb-1">Name</label>
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                    className="w-full bg-black border border-zinc-800 p-2 text-white"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-zinc-400 uppercase text-[10px] mb-1">Purpose & Mission</label>
                                <textarea
                                    value={editPurpose}
                                    onChange={e => setEditPurpose(e.target.value)}
                                    rows={2}
                                    className="w-full bg-black border border-zinc-800 p-2 text-white resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-zinc-400 uppercase text-[10px] mb-1">Founding Story</label>
                                <textarea
                                    value={editFoundingStory}
                                    onChange={e => setEditFoundingStory(e.target.value)}
                                    rows={3}
                                    className="w-full bg-black border border-zinc-800 p-2 text-white resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-zinc-400 uppercase text-[10px] mb-1">Core Values (One per line)</label>
                                <textarea
                                    value={editValues}
                                    onChange={e => setEditValues(e.target.value)}
                                    rows={3}
                                    className="w-full bg-black border border-zinc-800 p-2 text-white resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-zinc-400 uppercase text-[10px] mb-1">Guidelines (One per line)</label>
                                <textarea
                                    value={editGuidelines}
                                    onChange={e => setEditGuidelines(e.target.value)}
                                    rows={3}
                                    className="w-full bg-black border border-zinc-800 p-2 text-white resize-none"
                                />
                            </div>
                            <div className="pt-2 flex justify-end gap-3 border-t border-zinc-800">
                                <button
                                    type="button"
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="px-4 py-2 border border-zinc-800 text-zinc-400 uppercase"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionLoading}
                                    className="px-6 py-2 bg-white text-black font-bold uppercase hover:bg-zinc-200"
                                >
                                    {actionLoading ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Schedule Conclave Gathering */}
            {isScheduleConclaveOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-[#0c0c0e] border border-zinc-800 w-full max-w-lg max-h-[90vh] flex flex-col font-mono text-xs shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-black/60">
                            <h3 className="font-bold text-white uppercase tracking-wider">// SCHEDULE_CONCLAVE_GATHERING</h3>
                            <button onClick={() => setIsScheduleConclaveOpen(false)} className="text-zinc-500 hover:text-white">
                                <CloseIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleScheduleConclave} className="p-6 space-y-4">
                            <div>
                                <label className="block text-zinc-400 uppercase text-[10px] mb-1">Gathering Title *</label>
                                <input
                                    type="text"
                                    value={conclaveTitle}
                                    onChange={e => setConclaveTitle(e.target.value)}
                                    placeholder="e.g. Q4 Distributed Consensus Sprint"
                                    className="w-full bg-black border border-zinc-800 p-2 text-white"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-zinc-400 uppercase text-[10px] mb-1">Description</label>
                                <textarea
                                    value={conclaveDesc}
                                    onChange={e => setConclaveDesc(e.target.value)}
                                    placeholder="Agenda and topics to be discussed..."
                                    rows={2}
                                    className="w-full bg-black border border-zinc-800 p-2 text-white resize-none"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-zinc-400 uppercase text-[10px] mb-1">Date *</label>
                                    <input
                                        type="date"
                                        value={conclaveDate}
                                        onChange={e => setConclaveDate(e.target.value)}
                                        className="w-full bg-black border border-zinc-800 p-2 text-white"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-zinc-400 uppercase text-[10px] mb-1">Time *</label>
                                    <input
                                        type="time"
                                        value={conclaveTime}
                                        onChange={e => setConclaveTime(e.target.value)}
                                        className="w-full bg-black border border-zinc-800 p-2 text-white"
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-zinc-400 uppercase text-[10px] mb-1">Format</label>
                                <select
                                    value={conclaveFormat}
                                    onChange={e => setConclaveFormat(e.target.value as any)}
                                    className="w-full bg-black border border-zinc-800 p-2 text-white"
                                >
                                    <option value="online">Online (Virtual Room)</option>
                                    <option value="offline">Offline (In-Person Venue)</option>
                                    <option value="hybrid">Hybrid</option>
                                </select>
                            </div>
                            {conclaveFormat !== 'offline' && (
                                <div>
                                    <label className="block text-zinc-400 uppercase text-[10px] mb-1">Virtual URL / Meeting Link</label>
                                    <input
                                        type="url"
                                        value={conclaveVirtualUrl}
                                        onChange={e => setConclaveVirtualUrl(e.target.value)}
                                        placeholder="https://meet.google.com/..."
                                        className="w-full bg-black border border-zinc-800 p-2 text-white"
                                    />
                                </div>
                            )}
                            {conclaveFormat !== 'online' && (
                                <div>
                                    <label className="block text-zinc-400 uppercase text-[10px] mb-1">Venue / Physical Location</label>
                                    <input
                                        type="text"
                                        value={conclaveLocation}
                                        onChange={e => setConclaveLocation(e.target.value)}
                                        placeholder="Building 4, Node Room B"
                                        className="w-full bg-black border border-zinc-800 p-2 text-white"
                                    />
                                </div>
                            )}
                            <div className="pt-2 flex justify-end gap-3 border-t border-zinc-800">
                                <button
                                    type="button"
                                    onClick={() => setIsScheduleConclaveOpen(false)}
                                    className="px-4 py-2 border border-zinc-800 text-zinc-400 uppercase"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionLoading}
                                    className="px-6 py-2 bg-emerald-500 text-black font-bold uppercase hover:bg-emerald-400"
                                >
                                    {actionLoading ? 'Scheduling...' : 'Schedule Conclave'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
