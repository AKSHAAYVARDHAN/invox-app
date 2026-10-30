import React, { useState, useEffect, useMemo } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
    subscribeCommunity, 
    useCommunityMemberships, 
    getAdjustedMemberCount,
    canUserManageCommunity,
    isCommunityOwner,
    isCommunityAdmin,
    normalizeCoreValues,
    normalizeGuidelines
} from '../services/communityService';
import type { Community } from '../types';
import { mockCommunities } from './Communities';
import { MOCK_COMMUNITIES } from '../services/communitiesDemoData';
import { 
    UsersIcon, 
    ShieldCheckIcon, 
    StarIcon, 
    ArrowLeftIcon,
    PencilSquareIcon
} from '../components/ui/Icons';
import { handleImageError } from '../components/utils/imageUtils';
import { EditCollectiveIdentityModal } from '../components/communities/EditCollectiveIdentityModal';

type CommunityTab = 'overview' | 'conclave' | 'memory' | 'influence' | 'health';

const formatNumber = (num?: number): string => {
    if (!num || isNaN(num)) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toLocaleString();
};

export const CommunityProfilePage: React.FC = () => {
    const { communityId } = ReactRouterDOM.useParams<{ communityId: string }>();
    const navigate = ReactRouterDOM.useNavigate();
    const { currentUser, userProfile } = useAuth();

    // Connect to parent layout's context sidebar
    const outletContext = ReactRouterDOM.useOutletContext<{
        setRightSidebarVariant?: (variant: string) => void;
    }>();
    const setRightSidebarVariant = outletContext?.setRightSidebarVariant;

    useEffect(() => {
        if (setRightSidebarVariant) {
            setRightSidebarVariant('communities');
        }
        return () => {
            if (setRightSidebarVariant) {
                setRightSidebarVariant('default');
            }
        };
    }, [setRightSidebarVariant]);

    // Fast resolution from known mock records
    const initialCommunity = useMemo(() => {
        if (!communityId) return null;
        return (
            mockCommunities.find((c) => c.id === communityId) ||
            MOCK_COMMUNITIES.find((c) => c.id === communityId) ||
            null
        );
    }, [communityId]);

    const [community, setCommunity] = useState<Community | null>(initialCommunity);
    const [loading, setLoading] = useState<boolean>(!initialCommunity);
    const [activeTab, setActiveTab] = useState<CommunityTab>('overview');
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    // Existing community membership system integration
    const { isMember, memberships, toggleMembership, leaveCommunity: hookLeaveCommunity, actionLoadingId } = useCommunityMemberships(currentUser);
    const membershipActive = community ? isMember(community.id) : false;
    const isActionLoading = community ? actionLoadingId === community.id : false;

    // Authorized administrator check strictly limited to Community Creator/Owner or explicit Community Administrator
    const canManage = useMemo(() => {
        return canUserManageCommunity(community, currentUser);
    }, [community, currentUser]);

    // Normalized collective identity structures (must be called before early returns)
    const normalizedValues = useMemo(() => {
        return community?.values ? normalizeCoreValues(community.values) : [];
    }, [community?.values]);

    const normalizedGuidelines = useMemo(() => {
        return community?.guidelines ? normalizeGuidelines(community.guidelines) : [];
    }, [community?.guidelines]);

    useEffect(() => {
        if (!communityId) {
            setCommunity(null);
            setLoading(false);
            return;
        }

        if (initialCommunity) {
            setCommunity(initialCommunity);
            setLoading(false);
        } else {
            setLoading(true);
        }

        const unsubscribe = subscribeCommunity(
            communityId,
            (loadedCommunity) => {
                if (loadedCommunity) {
                    setCommunity(loadedCommunity);
                } else if (!initialCommunity) {
                    setCommunity(null);
                }
                setLoading(false);
            },
            (err) => {
                console.warn('[COMMUNITY_PROFILE_LOAD_ERROR]', err);
                if (!initialCommunity) {
                    setCommunity(null);
                }
                setLoading(false);
            },
            mockCommunities
        );

        return () => unsubscribe();
    }, [communityId, initialCommunity]);

    const handleJoinClick = async () => {
        if (!community || isActionLoading) return;
        if (!currentUser) {
            navigate('/login');
            return;
        }
        await toggleMembership(community);
    };

    const handleLeaveClick = async () => {
        if (!community || isActionLoading) return;
        if (!currentUser) {
            navigate('/login');
            return;
        }
        if (hookLeaveCommunity) {
            await hookLeaveCommunity(community.id);
        } else {
            await toggleMembership(community);
        }
    };

    // Loading State
    if (loading) {
        return (
            <div className="py-24 text-center font-mono text-xs text-zinc-500 space-y-3 w-full">
                <div className="w-8 h-8 border border-zinc-700 border-t-white animate-spin mx-auto" />
                <p className="uppercase tracking-widest">// ACCESSING_COMMUNITY_DOSSIER...</p>
            </div>
        );
    }

    // Graceful Unknown / Not Found State
    if (!community) {
        return (
            <div className="space-y-6 font-mono text-xs w-full min-w-0 max-w-full py-6">
                <button
                    onClick={() => navigate('/communities')}
                    className="flex items-center gap-2 text-zinc-400 hover:text-white uppercase transition-colors text-xs"
                >
                    <ArrowLeftIcon className="w-4 h-4 flex-shrink-0" />
                    <span>← Return to Communities</span>
                </button>

                <div className="py-16 px-6 text-center space-y-4 border border-dashed border-zinc-800 bg-[#0c0c0e] w-full min-w-0">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest block">
                        // COMMUNITY_NOT_FOUND
                    </span>
                    <h2 className="text-base sm:text-lg font-bold text-white uppercase tracking-wide">
                        COLLECTIVE RECORD NOT LOCATED
                    </h2>
                    <p className="text-zinc-400 max-w-md mx-auto leading-relaxed break-words">
                        No community collective matching identifier <span className="text-white font-bold">"{communityId}"</span> was found in the network registry.
                    </p>
                    <div className="pt-2">
                        <button
                            onClick={() => navigate('/communities')}
                            className="px-5 py-2 bg-white text-black font-bold uppercase hover:bg-zinc-200 transition-colors text-xs"
                        >
                            Return to Discover
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Member count calculation using existing safe adjustment
    const baselineMembers = community.members || (community as any).memberCount || 0;
    const displayedMembers = getAdjustedMemberCount(baselineMembers, membershipActive);

    // Additional metadata with normalized collective identity structures
    const topics: string[] = (community as any).topics || [];
    const purpose = community.purpose?.trim();
    const mission = community.mission?.trim();
    const foundingStory = community.foundingStory?.trim();
    const hasPurposeOrMission = Boolean(purpose || mission);
    const hasValues = normalizedValues.length > 0;
    const hasStory = Boolean(foundingStory);
    const hasGuidelines = normalizedGuidelines.length > 0;
    const bannerUrl = (community as any).bannerUrl;

    return (
        <div className="space-y-5 sm:space-y-6 font-mono text-xs pb-16 w-full min-w-0 max-w-full">
            {/* Community Header Card */}
            <div className="bg-[#0c0c0e] border border-zinc-800 relative overflow-hidden w-full min-w-0">
                {/* Banner backdrop if available */}
                {bannerUrl ? (
                    <div className="h-24 sm:h-32 w-full overflow-hidden border-b border-zinc-850 relative">
                        <img
                            src={bannerUrl}
                            onError={handleImageError}
                            alt=""
                            className="w-full h-full object-cover opacity-35 filter saturate-50"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0c0c0e] via-transparent to-transparent" />
                    </div>
                ) : (
                    <div className="h-12 sm:h-16 w-full bg-gradient-to-r from-zinc-950 via-zinc-900 to-black border-b border-zinc-850" />
                )}

                <div className="p-4 sm:p-5 md:p-6 relative w-full min-w-0">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 md:gap-6 w-full min-w-0">
                        {/* Identity & Main Info */}
                        <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
                            {community.avatarUrl ? (
                                <img
                                    src={community.avatarUrl}
                                    onError={handleImageError}
                                    alt={community.name}
                                    className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 border-2 border-zinc-700 object-cover flex-shrink-0 bg-black"
                                />
                            ) : (
                                <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 bg-zinc-950 border-2 border-zinc-700 flex items-center justify-center text-zinc-500 flex-shrink-0">
                                    <UsersIcon className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10" />
                                </div>
                            )}

                            <div className="space-y-2 min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap min-w-0">
                                    <h1 className="text-base sm:text-xl md:text-2xl font-bold text-white tracking-wide uppercase break-words leading-tight">
                                        {community.name}
                                    </h1>
                                    {community.isVerified && (
                                        <ShieldCheckIcon className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                    )}
                                    <span className="text-[10px] uppercase px-2 py-0.5 border border-zinc-800 bg-black text-zinc-400 font-bold whitespace-nowrap">
                                        {community.category}
                                    </span>
                                </div>

                                <p className="text-zinc-300 text-xs sm:text-sm leading-relaxed break-words">
                                    {community.description}
                                </p>

                                {/* Metadata Strip */}
                                <div className="flex items-center gap-3 sm:gap-4 pt-1 text-[11px] text-zinc-400 flex-wrap">
                                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                                        <UsersIcon className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                                        <span>MEMBERS:</span>
                                        <strong className="text-white font-bold">{formatNumber(displayedMembers)}</strong>
                                    </div>

                                    {community.rating !== undefined && (
                                        <>
                                            <span className="text-zinc-700 hidden sm:inline">•</span>
                                            <div className="flex items-center gap-1 whitespace-nowrap">
                                                <StarIcon className="w-3.5 h-3.5 text-white flex-shrink-0" />
                                                <strong className="text-white font-bold">{community.rating.toFixed(1)}</strong>
                                                <span className="text-zinc-500">/ 5.0</span>
                                            </div>
                                        </>
                                    )}

                                    <span className="text-zinc-700 hidden sm:inline">•</span>
                                    <div className="flex items-center gap-1 whitespace-nowrap">
                                        <span>DOMAIN:</span>
                                        <span className="text-zinc-200 uppercase font-semibold">{community.category}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Membership Action Button & Role Indicator */}
                        <div className="flex items-center gap-2 flex-shrink-0 self-start sm:self-auto pt-2 md:pt-0">
                            {membershipActive ? (
                                <div className="flex items-center gap-2 flex-wrap">
                                    {isCommunityOwner(community, currentUser?.uid) ? (
                                        <span className="px-3 py-1.5 sm:px-4 sm:py-2 bg-amber-950/40 border border-amber-800 text-amber-300 uppercase font-bold tracking-wider flex items-center gap-1.5 text-xs whitespace-nowrap">
                                            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
                                            OWNER / CREATOR
                                        </span>
                                    ) : isCommunityAdmin(community, currentUser?.uid) ? (
                                        <span className="px-3 py-1.5 sm:px-4 sm:py-2 bg-emerald-950/40 border border-emerald-800 text-emerald-300 uppercase font-bold tracking-wider flex items-center gap-1.5 text-xs whitespace-nowrap">
                                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                                            ADMINISTRATOR
                                        </span>
                                    ) : (
                                        <span className="px-3 py-1.5 sm:px-4 sm:py-2 bg-zinc-900 border border-zinc-700 text-zinc-300 uppercase font-bold tracking-wider flex items-center gap-1.5 text-xs whitespace-nowrap">
                                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                                            JOINED
                                        </span>
                                    )}
                                    {!isCommunityOwner(community, currentUser?.uid) && (
                                        <button
                                            onClick={handleLeaveClick}
                                            disabled={isActionLoading}
                                            className="px-3 py-1.5 sm:py-2 border border-zinc-800 text-zinc-400 hover:text-rose-400 hover:border-rose-900 uppercase transition-colors disabled:opacity-50 text-xs whitespace-nowrap"
                                        >
                                            {isActionLoading ? '...' : 'Leave'}
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <button
                                    onClick={handleJoinClick}
                                    disabled={isActionLoading}
                                    className="px-5 py-2 sm:px-6 sm:py-2.5 bg-white text-black font-bold uppercase hover:bg-zinc-200 transition-colors shadow-sm disabled:opacity-50 tracking-wider text-xs whitespace-nowrap"
                                >
                                    {isActionLoading ? 'PROCESSING...' : 'JOIN COMMUNITY'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Topics / Tags Bar if present */}
                {topics.length > 0 && (
                    <div className="px-4 sm:px-6 pb-3 pt-2 flex items-center gap-2 flex-wrap border-t border-zinc-850/60 w-full min-w-0">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider flex-shrink-0">// TOPICS:</span>
                        {topics.map((t) => (
                            <span key={t} className="px-2 py-0.5 bg-black border border-zinc-800 text-zinc-400 text-[10px] break-all">
                                #{t}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Pillars Navigation Header: structured for future expansion */}
            <div className="border-b border-zinc-800 flex items-center gap-1 overflow-x-auto no-scrollbar w-full min-w-0 max-w-full">
                {[
                    { id: 'overview', label: '01. OVERVIEW & IDENTITY', active: true },
                    { id: 'conclave', label: '02. CONCLAVE', staged: true },
                    { id: 'memory', label: '03. COLLECTIVE MEMORY', staged: true },
                    { id: 'influence', label: '04. MEMBER INFLUENCE', staged: true },
                    { id: 'health', label: '05. COMMUNITY HEALTH', staged: true },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as CommunityTab)}
                        className={`px-3 sm:px-4 py-2.5 sm:py-3 font-bold uppercase tracking-wider text-xs whitespace-nowrap transition-all border-b-2 -mb-[1px] flex items-center gap-1.5 sm:gap-2 flex-shrink-0 ${
                            activeTab === tab.id
                                ? 'border-white text-white bg-zinc-900/40'
                                : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/20'
                        }`}
                    >
                        <span>{tab.label}</span>
                        {tab.staged && (
                            <span className="text-[9px] px-1.5 py-0.2 bg-zinc-900 border border-zinc-800 text-zinc-500 font-normal">
                                UPCOMING
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' ? (
                <div className="flex flex-col space-y-5 sm:space-y-6 w-full min-w-0">
                    {/* Administrator Governance Bar (Only visible to creators/authorized administrators) */}
                    {canManage && (
                        <div className="bg-[#0c0c0e] border border-zinc-800 p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gradient-to-r from-zinc-950 via-[#0c0c0e] to-black">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse flex-shrink-0" />
                                <span className="text-[10px] text-zinc-300 uppercase tracking-wider font-bold">
                                    // COLLECTIVE_GOVERNANCE <span className="text-zinc-600">|</span> <span className="text-emerald-400">ADMINISTRATOR_ACCESS</span>
                                </span>
                            </div>
                            <button
                                onClick={() => setIsEditModalOpen(true)}
                                className="flex items-center gap-2 px-3.5 py-1.5 bg-white text-black font-bold uppercase hover:bg-zinc-200 transition-colors text-xs whitespace-nowrap shadow-sm"
                            >
                                <PencilSquareIcon className="w-3.5 h-3.5" />
                                <span>Edit Collective Identity</span>
                            </button>
                        </div>
                    )}

                    {/* 1. Purpose & Mission (Displayed when either purpose or mission exists) */}
                    {hasPurposeOrMission && (
                        <div className="bg-[#0c0c0e] border border-zinc-800 p-4 sm:p-5 space-y-3 w-full min-w-0">
                            <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
                                <h3 className="font-bold text-white uppercase tracking-wider text-xs sm:text-sm">
                                    // 01. PURPOSE & MISSION
                                </h3>
                                <span className="text-[10px] text-zinc-500 uppercase flex-shrink-0">COLLECTIVE CHARTER</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                                {purpose && (
                                    <div className={`p-4 bg-black border border-zinc-850 space-y-2 min-w-0 ${!mission ? 'md:col-span-2' : ''}`}>
                                        <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider block">
                                            // PURPOSE // WHY THIS COLLECTIVE EXISTS
                                        </span>
                                        <p className="text-zinc-300 leading-relaxed text-xs break-words">
                                            {purpose}
                                        </p>
                                    </div>
                                )}
                                {mission && (
                                    <div className={`p-4 bg-black border border-zinc-850 space-y-2 min-w-0 ${!purpose ? 'md:col-span-2' : ''}`}>
                                        <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider block">
                                            // MISSION // WHAT WE AIM TO ACHIEVE
                                        </span>
                                        <p className="text-zinc-300 leading-relaxed text-xs break-words">
                                            {mission}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* 2. Core Values & Principles (Displayed when values exist) */}
                    {hasValues && (
                        <div className="bg-[#0c0c0e] border border-zinc-800 p-4 sm:p-5 space-y-3 w-full min-w-0">
                            <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
                                <h3 className="font-bold text-white uppercase tracking-wider text-xs sm:text-sm">
                                    // 02. CORE VALUES & PRINCIPLES
                                </h3>
                                <span className="text-[10px] text-zinc-500 uppercase flex-shrink-0">GUIDING PILLARS</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                {normalizedValues.map((val, idx) => (
                                    <div key={val.id || idx} className="p-3.5 bg-black border border-zinc-850 flex items-start gap-3 min-w-0">
                                        <span className="text-emerald-400 font-bold flex-shrink-0 text-xs">
                                            #{(idx + 1).toString().padStart(2, '0')}
                                        </span>
                                        <div className="space-y-1 min-w-0 flex-1">
                                            <h4 className="text-white font-bold uppercase text-xs break-words">
                                                {val.title}
                                            </h4>
                                            {val.description && (
                                                <p className="text-zinc-400 text-xs leading-relaxed break-words">
                                                    {val.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 3. Founding Story (Displayed when founding story exists) */}
                    {hasStory && (
                        <div className="bg-[#0c0c0e] border border-zinc-800 p-4 sm:p-5 space-y-3 w-full min-w-0">
                            <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
                                <h3 className="font-bold text-white uppercase tracking-wider text-xs sm:text-sm">
                                    // 03. FOUNDING STORY
                                </h3>
                                <span className="text-[10px] text-zinc-500 uppercase flex-shrink-0">ORIGINS & GENESIS</span>
                            </div>
                            <div className="p-4 bg-black border border-zinc-850 border-l-2 border-l-emerald-400 text-zinc-300 leading-relaxed text-xs break-words whitespace-pre-line">
                                {foundingStory}
                            </div>
                        </div>
                    )}

                    {/* 4. Community Guidelines (Displayed when guidelines exist) */}
                    {hasGuidelines && (
                        <div className="bg-[#0c0c0e] border border-zinc-800 p-4 sm:p-5 space-y-3 w-full min-w-0">
                            <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
                                <h3 className="font-bold text-white uppercase tracking-wider text-xs sm:text-sm">
                                    // 04. COMMUNITY GUIDELINES
                                </h3>
                                <span className="text-[10px] text-zinc-500 uppercase flex-shrink-0">STANDARDS & CODE OF CONDUCT</span>
                            </div>
                            <div className="space-y-2.5 pt-1">
                                {normalizedGuidelines.map((guide, idx) => (
                                    <div key={guide.id || idx} className="p-3.5 bg-black border border-zinc-850 flex items-start gap-3 min-w-0">
                                        <span className="text-zinc-500 font-bold flex-shrink-0 text-xs mt-0.5">
                                            {(idx + 1).toString().padStart(2, '0')}.
                                        </span>
                                        <div className="space-y-1 min-w-0 flex-1">
                                            <h4 className="text-white font-bold uppercase text-xs break-words">
                                                {guide.title}
                                            </h4>
                                            {guide.description && (
                                                <p className="text-zinc-400 text-xs leading-relaxed break-words">
                                                    {guide.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 2. Dossier Metrics (placed below Overview) */}
                    <div className="bg-[#0c0c0e] border border-zinc-800 p-4 sm:p-5 space-y-4 w-full min-w-0">
                        <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
                            <h3 className="font-bold text-white uppercase tracking-wider text-xs sm:text-sm">
                                // DOSSIER_METRICS
                            </h3>
                            <span className="text-[10px] text-zinc-500 uppercase flex-shrink-0">STATUS & SPECIFICATIONS</span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
                            <div className="p-3 bg-black border border-zinc-850 flex flex-col min-w-0">
                                <span className="text-zinc-500 uppercase text-[10px]">Identifier</span>
                                <span className="text-white font-bold truncate text-xs mt-1">{community.id}</span>
                            </div>
                            <div className="p-3 bg-black border border-zinc-850 flex flex-col min-w-0">
                                <span className="text-zinc-500 uppercase text-[10px]">Domain</span>
                                <span className="text-white font-bold uppercase truncate text-xs mt-1">{community.category}</span>
                            </div>
                            <div className="p-3 bg-black border border-zinc-850 flex flex-col min-w-0">
                                <span className="text-zinc-500 uppercase text-[10px]">Verification</span>
                                <span className={`font-bold truncate text-xs mt-1 ${community.isVerified ? 'text-emerald-400' : 'text-zinc-400'}`}>
                                    {community.isVerified ? 'VERIFIED' : 'STANDARD'}
                                </span>
                            </div>
                            <div className="p-3 bg-black border border-zinc-850 flex flex-col min-w-0">
                                <span className="text-zinc-500 uppercase text-[10px]">Active Members</span>
                                <span className="text-white font-bold truncate text-xs mt-1">{formatNumber(displayedMembers)}</span>
                            </div>
                            <div className="p-3 bg-black border border-zinc-850 flex flex-col min-w-0">
                                <span className="text-zinc-500 uppercase text-[10px]">Collective Rating</span>
                                <span className="text-white font-bold flex items-center gap-1 truncate text-xs mt-1">
                                    {community.rating !== undefined ? community.rating.toFixed(1) : '—'}
                                    {community.rating !== undefined && <StarIcon className="w-3.5 h-3.5 text-white" />}
                                </span>
                            </div>
                        </div>

                        {/* Membership state notification */}
                        <div className="pt-1">
                            <div className="p-3 bg-black border border-zinc-850 text-[11px] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 w-full min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-zinc-500 uppercase flex-shrink-0">Your Status:</span>
                                    <span className={`font-bold uppercase ${membershipActive ? 'text-emerald-400' : 'text-zinc-400'}`}>
                                        {membershipActive ? 'Active Member' : 'Not Joined'}
                                    </span>
                                </div>
                                <p className="text-zinc-500 text-[10px] leading-tight">
                                    {membershipActive
                                        ? 'You have full access to participate in this collective.'
                                        : 'Explore this collective and join when ready.'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* 3. Discover More (placed below Dossier Metrics) */}
                    <div className="bg-[#0c0c0e] border border-zinc-800 p-4 sm:p-5 space-y-3 w-full min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div className="space-y-1">
                                <h4 className="font-bold text-white uppercase text-xs">
                                    // DISCOVER_MORE
                                </h4>
                                <p className="text-zinc-400 text-xs leading-relaxed break-words">
                                    Explore other technical ecosystems and top-ranked collectives on the discovery leaderboard.
                                </p>
                            </div>
                            <button
                                onClick={() => navigate('/communities')}
                                className="sm:flex-shrink-0 px-4 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-white font-bold uppercase transition-colors text-xs whitespace-nowrap"
                            >
                                Back to Communities
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                /* Staged Pillars Placeholder: Clean architectural slot ready for future tasks */
                <div className="bg-[#0c0c0e] border border-zinc-800 p-6 sm:p-10 text-center space-y-4 w-full min-w-0">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest block">
                        // PILLAR_STAGED_FOR_FUTURE_CYCLE
                    </span>
                    <h3 className="text-base sm:text-lg font-bold text-white uppercase tracking-wide">
                        {activeTab === 'conclave' && '02. CONCLAVE GATHERINGS'}
                        {activeTab === 'memory' && '03. COLLECTIVE MEMORY'}
                        {activeTab === 'influence' && '04. MEMBER INFLUENCE & PROPOSALS'}
                        {activeTab === 'health' && '05. COMMUNITY HEALTH INDICATORS'}
                    </h3>
                    <p className="text-zinc-400 text-xs max-w-lg mx-auto leading-relaxed break-words">
                        This pillar is architected for this community collective and will be implemented in a dedicated upcoming development task without requiring any page redesign.
                    </p>
                    <div className="pt-2">
                        <button
                            onClick={() => setActiveTab('overview')}
                            className="px-4 py-2 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white uppercase font-bold text-xs transition-colors"
                        >
                            Return to Overview
                        </button>
                    </div>
                </div>
            )}

            {/* Collective Identity Editor Modal */}
            {community && (
                <EditCollectiveIdentityModal
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    community={community}
                />
            )}
        </div>
    );
};

export default CommunityProfilePage;
