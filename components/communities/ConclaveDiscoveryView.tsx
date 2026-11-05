import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
    useUserJoinedCommunities,
    JoinedCommunityRecord
} from '../../services/communityService';
import { 
    subscribeUserCommunitiesConclaveEvents,
    registerUserForConclave,
    cancelUserConclaveRegistration,
    getUserConclaveRegistration,
    isConclaveRegistrationAvailable,
    canUserCreateConclave
} from '../../services/conclaveService';
import type { 
    ConclaveEvent,
    ConclaveRegistration
} from '../../services/conclaveTypes';
import type { Community } from '../../types';
import { 
    ArrowLeftIcon,
    MagnifyingGlassIcon,
    MapPinIcon,
    GlobeAltIcon,
    CalendarDaysIcon,
    ClockIcon,
    UsersIcon,
    CheckIcon,
    LockClosedIcon,
    CloseIcon,
    PlayIcon,
    FilterIcon,
    ChevronDownIcon,
    SparklesIcon,
    ShieldCheckIcon,
    PlusIcon
} from '../ui/Icons';
import { handleImageError } from '../utils/imageUtils';
import { MOCK_COMMUNITIES } from '../../services/communitiesDemoData';

interface ConclaveDiscoveryViewProps {
    onBack?: () => void;
}

export const ConclaveDiscoveryView: React.FC<ConclaveDiscoveryViewProps> = ({ onBack }) => {
    const { currentUser, userProfile } = useAuth();
    const navigate = ReactRouterDOM.useNavigate();
    const [searchParams, setSearchParams] = ReactRouterDOM.useSearchParams();

    // 1. Authoritative joined communities of the user
    const { joinedCommunities, loading: membershipsLoading } = useUserJoinedCommunities(currentUser);

    // Compute effective community IDs for querying gatherings
    const userCommunityIds = useMemo(() => {
        if (joinedCommunities && joinedCommunities.length > 0) {
            return joinedCommunities.map(c => c.id);
        }
        // Fallback for demo mode / testing when user hasn't joined communities in Firestore
        return [
            'coding-4', // Pythonic Geeks
            'design-1', // UI/UX Guild
            'coding-3', // JS Junkies
            'ai-1',     // AI ClubTech
            'startup-1',// Startup Grind
            'mock-comm-tech-enthusiasts'
        ];
    }, [joinedCommunities]);

    // Map of community metadata for fast identity lookups
    const communityMap = useMemo(() => {
        const map = new Map<string, { name: string; avatarUrl?: string; handle?: string; category?: string }>();
        for (const item of joinedCommunities) {
            map.set(item.id.toLowerCase(), {
                name: item.community.name,
                avatarUrl: item.community.avatarUrl,
                handle: item.community.handle,
                category: item.community.category
            });
        }
        for (const mc of MOCK_COMMUNITIES) {
            if (!map.has(mc.id.toLowerCase())) {
                map.set(mc.id.toLowerCase(), {
                    name: mc.name,
                    avatarUrl: mc.avatarUrl,
                    handle: mc.handle,
                    category: mc.category
                });
            }
        }
        return map;
    }, [joinedCommunities]);

    // 2. Communities where current user has permission to create Conclaves
    const eligibleCommunities = useMemo(() => {
        if (!currentUser?.uid) return [];

        const list: {
            id: string;
            name: string;
            category: string;
            avatarUrl?: string;
            handle?: string;
            role: 'OWNER' | 'ADMIN' | 'MEMBER';
            community: Community;
        }[] = [];

        // 1. Check real joined communities from Firestore
        for (const item of joinedCommunities) {
            const isMember = item.status === 'active';
            if (canUserCreateConclave(item.community, currentUser.uid, isMember)) {
                list.push({
                    id: item.community.id,
                    name: item.community.name,
                    category: item.community.category || 'General',
                    avatarUrl: item.community.avatarUrl,
                    handle: item.community.handle,
                    role: item.isOwner ? 'OWNER' : item.isAdmin ? 'ADMIN' : 'MEMBER',
                    community: item.community,
                });
            }
        }

        // 2. If no Firestore communities yet, check demo communities for fallback testing
        if (list.length === 0) {
            for (const c of MOCK_COMMUNITIES) {
                const isOwner = c.ownerId === currentUser.uid || c.ownerId === 'mock-user-alex';
                const isAdmin = Array.isArray(c.adminIds) && c.adminIds.includes(currentUser.uid);
                const isMember = true;
                if (canUserCreateConclave(c, currentUser.uid, isMember) || isOwner || isAdmin) {
                    list.push({
                        id: c.id,
                        name: c.name,
                        category: c.category || 'General',
                        avatarUrl: c.avatarUrl,
                        handle: c.handle,
                        role: isOwner ? 'OWNER' : isAdmin ? 'ADMIN' : 'MEMBER',
                        community: c,
                    });
                }
            }
        }

        return list;
    }, [currentUser?.uid, joinedCommunities]);

    const canCreateInAnyCommunity = Boolean(currentUser?.uid && eligibleCommunities.length > 0);

    // Modal state for centralized Community Selection
    const [isCommunitySelectModalOpen, setIsCommunitySelectModalOpen] = useState(false);
    const [communitySearchModalQuery, setCommunitySearchModalQuery] = useState('');

    const filteredEligibleCommunities = useMemo(() => {
        if (!communitySearchModalQuery.trim()) return eligibleCommunities;
        const q = communitySearchModalQuery.trim().toLowerCase();
        return eligibleCommunities.filter(c => 
            c.name.toLowerCase().includes(q) ||
            c.category.toLowerCase().includes(q) ||
            (c.handle && c.handle.toLowerCase().includes(q))
        );
    }, [eligibleCommunities, communitySearchModalQuery]);

    const handleSelectCommunityForConclave = (item: typeof eligibleCommunities[0]) => {
        // Re-verify permission
        if (!canUserCreateConclave(item.community, currentUser?.uid, true)) {
            setFeedbackBanner({
                type: 'error',
                message: `UNAUTHORIZED: You do not have permission to create Conclaves in ${item.name}.`
            });
            setIsCommunitySelectModalOpen(false);
            return;
        }

        setIsCommunitySelectModalOpen(false);
        setCommunitySearchModalQuery('');

        // Navigate to the selected community's profile page, opening the 02. CONCLAVE tab and launching Create workflow
        navigate(`/communities/${item.id}?tab=02_conclave&create=true`);
    };

    // 3. Real-time gathering events across user communities
    const [allEvents, setAllEvents] = useState<ConclaveEvent[]>([]);
    const [loadingEvents, setLoadingEvents] = useState(true);

    useEffect(() => {
        setLoadingEvents(true);
        const unsubscribe = subscribeUserCommunitiesConclaveEvents(
            userCommunityIds,
            (events) => {
                setAllEvents(events);
                setLoadingEvents(false);
            }
        );
        return () => unsubscribe();
    }, [userCommunityIds]);

    // 3. User registrations for real-time button state
    const [userRegistrations, setUserRegistrations] = useState<Record<string, ConclaveRegistration | null>>({});
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
    const [feedbackBanner, setFeedbackBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    useEffect(() => {
        if (!currentUser?.uid || allEvents.length === 0) return;

        let isMounted = true;
        const fetchRegs = async () => {
            const results: Record<string, ConclaveRegistration | null> = {};
            for (const ev of allEvents) {
                if (ev.attendeeIds?.includes(currentUser.uid)) {
                    results[ev.id] = {
                        id: `${ev.id}_${currentUser.uid}`,
                        eventId: ev.id,
                        communityId: ev.communityId,
                        userId: currentUser.uid,
                        userInfo: { uid: currentUser.uid, displayName: currentUser.displayName || 'Member' },
                        registeredAt: new Date(),
                        status: 'CONFIRMED',
                        attendanceStatus: 'REGISTERED'
                    };
                } else {
                    const reg = await getUserConclaveRegistration(ev.id, currentUser.uid);
                    if (reg) {
                        results[ev.id] = reg;
                    }
                }
            }
            if (isMounted) {
                setUserRegistrations(results);
            }
        };

        fetchRegs();
        return () => { isMounted = false; };
    }, [currentUser?.uid, allEvents]);

    // 4. Filters & Search State
    const [searchTerm, setSearchTerm] = useState('');
    const [formatFilter, setFormatFilter] = useState<'ALL' | 'ONSITE' | 'VIRTUAL'>('ALL');
    const [timeframeFilter, setTimeframeFilter] = useState<'UPCOMING' | 'ARCHIVE'>('UPCOMING');
    const [selectedCommunityFilter, setSelectedCommunityFilter] = useState<string>('ALL');

    // Community filter dropdown toggle
    const [isCommunityDropdownOpen, setIsCommunityDropdownOpen] = useState(false);
    const communityDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (communityDropdownRef.current && !communityDropdownRef.current.contains(e.target as Node)) {
                setIsCommunityDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // 5. Selected Dossier Modal State
    const [selectedDossierEvent, setSelectedDossierEvent] = useState<ConclaveEvent | null>(null);

    // Check URL parameters for direct eventId linking
    useEffect(() => {
        const eventIdParam = searchParams.get('eventId');
        if (eventIdParam && allEvents.length > 0 && !selectedDossierEvent) {
            const match = allEvents.find(e => e.id === eventIdParam);
            if (match) {
                setSelectedDossierEvent(match);
            }
        }
    }, [searchParams, allEvents, selectedDossierEvent]);

    // 6. Chronological Sorting & Filtering
    const now = Date.now();

    const filteredEvents = useMemo(() => {
        return allEvents.filter(event => {
            // Exclude drafts unconditionally from discovery
            if (event.eventStatus === 'DRAFT') return false;

            // Timeframe filter: UPCOMING vs ARCHIVE
            const isCompleted = event.eventStatus === 'COMPLETED';
            const isCancelled = event.eventStatus === 'CANCELLED';
            const isPast = event.endTimestamp ? event.endTimestamp < now : (event.startTimestamp ? event.startTimestamp < now - 24 * 3600 * 1000 : false);

            if (timeframeFilter === 'UPCOMING') {
                if (isCompleted || isCancelled) return false;
                if (isPast && event.eventStatus !== 'ONGOING') return false;
            } else if (timeframeFilter === 'ARCHIVE') {
                // Archive includes completed, cancelled or concluded gatherings
                if (!isCompleted && !isCancelled && !isPast) return false;
            }

            // Format filter
            if (formatFilter === 'ONSITE' && event.eventType !== 'ONSITE') return false;
            if (formatFilter === 'VIRTUAL' && event.eventType !== 'VIRTUAL') return false;

            // Community filter
            if (selectedCommunityFilter !== 'ALL' && event.communityId.toLowerCase() !== selectedCommunityFilter.toLowerCase()) {
                return false;
            }

            // Search filter
            if (searchTerm.trim()) {
                const q = searchTerm.trim().toLowerCase();
                const titleMatch = event.title.toLowerCase().includes(q);
                const descMatch = (event.description || '').toLowerCase().includes(q);
                const commNameMatch = (event.communityName || '').toLowerCase().includes(q);
                const locationMatch = (event.onSite?.venueName || event.onSite?.city || event.virtual?.platform || '').toLowerCase().includes(q);
                if (!titleMatch && !descMatch && !commNameMatch && !locationMatch) return false;
            }

            return true;
        }).sort((a, b) => {
            // Live sessions first
            if (a.eventStatus === 'ONGOING' && b.eventStatus !== 'ONGOING') return -1;
            if (b.eventStatus === 'ONGOING' && a.eventStatus !== 'ONGOING') return 1;

            if (timeframeFilter === 'UPCOMING') {
                // Nearest upcoming gathering first
                const timeA = a.startTimestamp || 0;
                const timeB = b.startTimestamp || 0;
                if (timeA && timeB) return timeA - timeB;
                return (a.startDate || '').localeCompare(b.startDate || '');
            } else {
                // Most recent archived gathering first
                const timeA = a.startTimestamp || 0;
                const timeB = b.startTimestamp || 0;
                if (timeA && timeB) return timeB - timeA;
                return (b.startDate || '').localeCompare(a.startDate || '');
            }
        });
    }, [allEvents, formatFilter, timeframeFilter, selectedCommunityFilter, searchTerm, now]);

    // 7. Summary Metrics
    const metrics = useMemo(() => {
        let upcomingTotal = 0;
        let onsiteTotal = 0;
        let virtualTotal = 0;
        const communitiesSet = new Set<string>();

        for (const ev of allEvents) {
            if (ev.eventStatus === 'DRAFT' || ev.eventStatus === 'CANCELLED' || ev.eventStatus === 'COMPLETED') continue;
            const isPast = ev.endTimestamp ? ev.endTimestamp < now : false;
            if (isPast && ev.eventStatus !== 'ONGOING') continue;

            upcomingTotal++;
            if (ev.eventType === 'ONSITE') onsiteTotal++;
            if (ev.eventType === 'VIRTUAL') virtualTotal++;
            if (ev.communityId) communitiesSet.add(ev.communityId.toLowerCase());
        }

        return {
            upcomingTotal,
            onsiteTotal,
            virtualTotal,
            communitiesCount: communitiesSet.size
        };
    }, [allEvents, now]);

    // 8. Registration Handler
    const handleToggleRegistration = async (event: ConclaveEvent) => {
        if (!currentUser?.uid) {
            navigate('/login');
            return;
        }

        setActionLoadingId(event.id);
        setFeedbackBanner(null);

        const currentReg = userRegistrations[event.id];
        const isRegistered = currentReg && currentReg.status === 'CONFIRMED';

        if (isRegistered) {
            // Cancel registration
            const res = await cancelUserConclaveRegistration(event.id, currentUser.uid);
            if (res.success) {
                setUserRegistrations(prev => ({ ...prev, [event.id]: null }));
                setFeedbackBanner({ type: 'success', message: `Registration cancelled for "${event.title}".` });
            } else {
                setFeedbackBanner({ type: 'error', message: res.error || 'Failed to cancel registration.' });
            }
        } else {
            // Register for conclave
            const matchingCommunity = joinedCommunities.find(c => c.id.toLowerCase() === event.communityId.toLowerCase())?.community;
            const mockMatch = MOCK_COMMUNITIES.find(c => c.id.toLowerCase() === event.communityId.toLowerCase());
            const communityObj = matchingCommunity || mockMatch || {
                id: event.communityId,
                name: event.communityName,
                visibility: 'public'
            } as any;

            const res = await registerUserForConclave(
                event.id,
                {
                    uid: currentUser.uid,
                    displayName: currentUser.displayName || userProfile?.displayName || 'Community Member',
                    email: currentUser.email || undefined,
                    photoURL: currentUser.photoURL || undefined
                },
                communityObj,
                true
            );

            if (res.success && res.registration) {
                setUserRegistrations(prev => ({ ...prev, [event.id]: res.registration! }));
                setFeedbackBanner({ type: 'success', message: `Registration confirmed for "${event.title}".` });
            } else {
                setFeedbackBanner({ type: 'error', message: res.error || 'Failed to complete registration.' });
            }
        }

        setActionLoadingId(null);
    };

    return (
        <div className="space-y-6 font-mono pb-12">
            {/* Top Navigation & Breadcrumb */}
            <div className="flex items-center justify-between gap-4">
                <button
                    onClick={() => {
                        if (onBack) {
                            onBack();
                        } else {
                            navigate('/communities');
                        }
                    }}
                    className="flex items-center gap-2 p-2 bg-[#0c0c0e] border border-zinc-800 hover:border-zinc-600 text-zinc-300 hover:text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer group"
                >
                    <ArrowLeftIcon className="w-4 h-4 text-zinc-400 group-hover:text-white group-hover:-translate-x-0.5 transition-transform" />
                    <span>// BACK TO COMMUNITIES</span>
                </button>

                <div className="text-[10px] text-zinc-500 uppercase tracking-widest hidden sm:block">
                    CONCLAVE EVENT DISCOVERY ENGINE
                </div>
            </div>

            {/* Header Card */}
            <div className="p-5 sm:p-6 bg-[#0c0c0e] border border-zinc-800 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-850 pb-4">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h1 className="text-lg sm:text-xl font-bold text-white uppercase tracking-wider">
                                // CONCLAVE DISCOVERY
                            </h1>
                            <span className="w-2 h-2 bg-emerald-500 inline-block animate-pulse"></span>
                        </div>
                        <p className="text-xs text-zinc-400 uppercase tracking-wider mt-1">
                            UPCOMING GATHERINGS ACROSS YOUR COMMUNITIES
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-zinc-500 uppercase font-bold hidden sm:inline">
                                MEMBERSHIP SCOPE:
                            </span>
                            <span className="px-2.5 py-1 bg-zinc-900 border border-zinc-800 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                                {joinedCommunities.length > 0 ? `${joinedCommunities.length} JOINED COMMUNITIES` : 'DEMO COLLECTIVES'}
                            </span>
                        </div>

                        {canCreateInAnyCommunity && (
                            <button
                                type="button"
                                onClick={() => {
                                    setCommunitySearchModalQuery('');
                                    setIsCommunitySelectModalOpen(true);
                                }}
                                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold uppercase tracking-wider text-xs transition-colors cursor-pointer shadow-sm active:translate-y-px"
                            >
                                <PlusIcon className="w-3.5 h-3.5" />
                                <span>CREATE CONCLAVE</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Overview Metrics Strip */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 bg-black/60 border border-zinc-850 space-y-1">
                        <span className="text-[10px] uppercase text-zinc-500 font-bold block">
                            TOTAL UPCOMING
                        </span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-xl font-bold text-white">{metrics.upcomingTotal}</span>
                            <span className="text-[10px] text-zinc-500 uppercase">GATHERINGS</span>
                        </div>
                    </div>

                    <div className="p-3 bg-black/60 border border-zinc-850 space-y-1">
                        <span className="text-[10px] uppercase text-zinc-500 font-bold block">
                            COLLECTIVES
                        </span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-xl font-bold text-white">{metrics.communitiesCount}</span>
                            <span className="text-[10px] text-zinc-500 uppercase">REPRESENTED</span>
                        </div>
                    </div>

                    <div className="p-3 bg-black/60 border border-amber-950/60 space-y-1">
                        <span className="text-[10px] uppercase text-amber-500 font-bold block">
                            ON-SITE CONCLAVES
                        </span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-xl font-bold text-amber-400">{metrics.onsiteTotal}</span>
                            <span className="text-[10px] text-amber-500/80 uppercase">PHYSICAL</span>
                        </div>
                    </div>

                    <div className="p-3 bg-black/60 border border-cyan-950/60 space-y-1">
                        <span className="text-[10px] uppercase text-cyan-400 font-bold block">
                            VIRTUAL CONCLAVES
                        </span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-xl font-bold text-cyan-300">{metrics.virtualTotal}</span>
                            <span className="text-[10px] text-cyan-500/80 uppercase">REMOTE</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Action Feedback Banner */}
            {feedbackBanner && (
                <div className={`p-3.5 border flex items-center justify-between text-xs font-mono ${
                    feedbackBanner.type === 'success'
                        ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                        : 'bg-rose-950/40 border-rose-800 text-rose-300'
                }`}>
                    <div className="flex items-center gap-2">
                        {feedbackBanner.type === 'success' ? (
                            <CheckIcon className="w-4 h-4 text-emerald-400" />
                        ) : (
                            <span className="w-2 h-2 bg-rose-500"></span>
                        )}
                        <span>{feedbackBanner.message}</span>
                    </div>
                    <button
                        onClick={() => setFeedbackBanner(null)}
                        className="text-zinc-500 hover:text-white transition-colors"
                    >
                        <CloseIcon className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Controls Bar: Search & Filtering */}
            <div className="p-4 bg-[#0c0c0e] border border-zinc-800 space-y-3.5">
                {/* Search Row */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="relative flex-1">
                        <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="SEARCH GATHERINGS BY TITLE, VENUE, OR KEYWORD..."
                            className="w-full bg-black border border-zinc-800 p-2.5 pl-10 pr-9 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                            >
                                <CloseIcon className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Community Filter Dropdown */}
                    <div className="relative" ref={communityDropdownRef}>
                        <button
                            type="button"
                            onClick={() => setIsCommunityDropdownOpen(!isCommunityDropdownOpen)}
                            className="w-full sm:w-auto h-10 px-3.5 bg-black border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white text-xs font-bold uppercase tracking-wider flex items-center justify-between gap-2.5 transition-colors cursor-pointer"
                        >
                            <span className="truncate max-w-[180px]">
                                {selectedCommunityFilter === 'ALL'
                                    ? 'ALL COMMUNITIES'
                                    : (communityMap.get(selectedCommunityFilter.toLowerCase())?.name || selectedCommunityFilter).toUpperCase()
                                }
                            </span>
                            <ChevronDownIcon className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        </button>

                        {isCommunityDropdownOpen && (
                            <div className="absolute right-0 top-full mt-1.5 w-64 bg-[#0c0c0e] border border-zinc-800 shadow-2xl z-30 py-1 text-xs">
                                <div className="px-3 py-1.5 text-[9px] uppercase text-zinc-500 font-bold border-b border-zinc-850">
                                    // SELECT COMMUNITY
                                </div>
                                <button
                                    onClick={() => {
                                        setSelectedCommunityFilter('ALL');
                                        setIsCommunityDropdownOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-2 hover:bg-zinc-900 transition-colors ${
                                        selectedCommunityFilter === 'ALL' ? 'text-white font-bold bg-zinc-900/60' : 'text-zinc-400'
                                    }`}
                                >
                                    ALL COMMUNITIES
                                </button>
                                {userCommunityIds.map(cId => {
                                    const meta = communityMap.get(cId.toLowerCase());
                                    const name = meta?.name || cId;
                                    return (
                                        <button
                                            key={cId}
                                            onClick={() => {
                                                setSelectedCommunityFilter(cId);
                                                setIsCommunityDropdownOpen(false);
                                            }}
                                            className={`w-full text-left px-3 py-2 hover:bg-zinc-900 flex items-center gap-2 transition-colors ${
                                                selectedCommunityFilter.toLowerCase() === cId.toLowerCase()
                                                    ? 'text-white font-bold bg-zinc-900/60'
                                                    : 'text-zinc-400'
                                            }`}
                                        >
                                            {meta?.avatarUrl && (
                                                <img src={meta.avatarUrl} alt={name} className="w-4 h-4 object-cover border border-zinc-800 shrink-0" onError={handleImageError} />
                                            )}
                                            <span className="truncate">{name}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Filter Tabs Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-zinc-850">
                    {/* Format Filter Tabs */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-zinc-500 uppercase font-bold mr-1">FORMAT:</span>
                        {(['ALL', 'ONSITE', 'VIRTUAL'] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setFormatFilter(f)}
                                className={`px-3 py-1 text-xs font-bold uppercase tracking-wider border transition-colors cursor-pointer ${
                                    formatFilter === f
                                        ? 'bg-zinc-900 border-white text-white'
                                        : 'bg-black border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                                }`}
                            >
                                {f === 'ALL' ? 'ALL FORMATS' : f === 'ONSITE' ? 'ON-SITE' : 'VIRTUAL'}
                            </button>
                        ))}
                    </div>

                    {/* Timeframe Toggle */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-zinc-500 uppercase font-bold mr-1">TIMEFRAME:</span>
                        <button
                            onClick={() => setTimeframeFilter('UPCOMING')}
                            className={`px-3 py-1 text-xs font-bold uppercase tracking-wider border transition-colors cursor-pointer ${
                                timeframeFilter === 'UPCOMING'
                                    ? 'bg-white text-black border-white'
                                    : 'bg-black border-zinc-800 text-zinc-400 hover:text-white'
                            }`}
                        >
                            UPCOMING
                        </button>
                        <button
                            onClick={() => setTimeframeFilter('ARCHIVE')}
                            className={`px-3 py-1 text-xs font-bold uppercase tracking-wider border transition-colors cursor-pointer ${
                                timeframeFilter === 'ARCHIVE'
                                    ? 'bg-white text-black border-white'
                                    : 'bg-black border-zinc-800 text-zinc-400 hover:text-white'
                            }`}
                        >
                            ALL / ARCHIVE
                        </button>
                    </div>
                </div>
            </div>

            {/* Event Count Bar */}
            <div className="flex items-center justify-between px-1 text-xs text-zinc-500">
                <span className="uppercase">
                    SHOWING <strong>{filteredEvents.length}</strong> {filteredEvents.length === 1 ? 'CONCLAVE GATHERING' : 'CONCLAVE GATHERINGS'}
                </span>
                {(searchTerm || formatFilter !== 'ALL' || selectedCommunityFilter !== 'ALL' || timeframeFilter !== 'UPCOMING') && (
                    <button
                        onClick={() => {
                            setSearchTerm('');
                            setFormatFilter('ALL');
                            setSelectedCommunityFilter('ALL');
                            setTimeframeFilter('UPCOMING');
                        }}
                        className="text-zinc-400 hover:text-white underline uppercase text-[11px] cursor-pointer"
                    >
                        RESET ALL FILTERS
                    </button>
                )}
            </div>

            {/* Event Cards Stream */}
            <div className="space-y-4">
                {loadingEvents ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="p-6 bg-[#0c0c0e] border border-zinc-800 space-y-3 animate-pulse">
                                <div className="h-4 bg-zinc-800/80 w-1/3"></div>
                                <div className="h-5 bg-zinc-800/60 w-3/4"></div>
                                <div className="h-16 bg-zinc-800/40 w-full"></div>
                            </div>
                        ))}
                    </div>
                ) : filteredEvents.length === 0 ? (
                    <div className="text-center py-16 px-4 bg-[#0c0c0e] border border-dashed border-zinc-800 space-y-3">
                        <div className="w-10 h-10 mx-auto bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
                            <CalendarDaysIcon className="w-5 h-5" />
                        </div>
                        <p className="text-xs font-bold text-white uppercase tracking-wider">
                            // NO_CONCLAVE_GATHERINGS_MATCHED
                        </p>
                        <p className="text-xs text-zinc-500 max-w-md mx-auto leading-relaxed">
                            No Conclave gatherings found matching the active search or format filters across your communities.
                        </p>
                        <button
                            type="button"
                            onClick={() => {
                                setSearchTerm('');
                                setFormatFilter('ALL');
                                setSelectedCommunityFilter('ALL');
                                setTimeframeFilter('UPCOMING');
                            }}
                            className="px-4 py-2 bg-white text-black font-bold uppercase text-xs hover:bg-zinc-200 transition-colors cursor-pointer mt-2"
                        >
                            Reset Discovery Filters
                        </button>
                    </div>
                ) : (
                    filteredEvents.map(event => {
                        const isOnsite = event.eventType === 'ONSITE';
                        const isOngoing = event.eventStatus === 'ONGOING';
                        const isCompleted = event.eventStatus === 'COMPLETED';
                        const isCancelled = event.eventStatus === 'CANCELLED';

                        const registration = userRegistrations[event.id];
                        const isUserRegistered = registration && registration.status === 'CONFIRMED';
                        const isActionLoading = actionLoadingId === event.id;

                        const registeredCount = event.registeredCount ?? event.attendeeCount ?? 0;
                        const capacity = event.capacity || 100;
                        const capacityPercentage = Math.min(100, Math.round((registeredCount / capacity) * 100));

                        const dateDisplay = event.startDate || event.date || 'TBD';
                        const timeDisplay = event.startTime || event.time || '';
                        const timezoneDisplay = event.timezone || 'UTC';
                        const coverThumb = event.coverImageUrl || event.communityAvatarUrl;

                        const regAvailability = isConclaveRegistrationAvailable(event);
                        const canRegister = regAvailability.eligible && !isCancelled && !isCompleted;

                        const communityMeta = communityMap.get(event.communityId.toLowerCase());
                        const communityName = event.communityName || communityMeta?.name || 'Community Collective';

                        return (
                            <div
                                key={event.id}
                                className={`bg-[#0c0c0e] border transition-all duration-200 p-5 sm:p-6 space-y-4 ${
                                    isOngoing
                                        ? 'border-emerald-800/80 bg-emerald-950/5'
                                        : isCancelled
                                        ? 'border-rose-950/60 opacity-80'
                                        : 'border-zinc-800 hover:border-zinc-700'
                                }`}
                            >
                                {/* Card Header Row */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-850 pb-3.5">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {/* Format Tag */}
                                        <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border ${
                                            isOnsite
                                                ? 'bg-amber-950/40 border-amber-600/70 text-amber-300'
                                                : 'bg-cyan-950/40 border-cyan-600/70 text-cyan-300'
                                        }`}>
                                            {isOnsite ? (
                                                <MapPinIcon className="w-3.5 h-3.5 text-amber-400" />
                                            ) : (
                                                <GlobeAltIcon className="w-3.5 h-3.5 text-cyan-400" />
                                            )}
                                            <span>{isOnsite ? 'ON-SITE CONCLAVE' : 'VIRTUAL CONCLAVE'}</span>
                                        </span>

                                        {/* Status Tag */}
                                        {isOngoing ? (
                                            <span className="px-2 py-0.5 bg-emerald-950/60 border border-emerald-500 text-emerald-300 text-[10px] uppercase font-bold tracking-wider flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 bg-emerald-400 animate-pulse"></span>
                                                LIVE NOW
                                            </span>
                                        ) : isCompleted ? (
                                            <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-500 text-[10px] uppercase font-bold tracking-wider">
                                                CONCLUDED
                                            </span>
                                        ) : isCancelled ? (
                                            <span className="px-2 py-0.5 bg-rose-950/60 border border-rose-800 text-rose-400 text-[10px] uppercase font-bold tracking-wider">
                                                CANCELLED
                                            </span>
                                        ) : (
                                            <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-400 text-[10px] uppercase font-bold tracking-wider">
                                                SCHEDULED
                                            </span>
                                        )}

                                        {event.category && (
                                            <span className="px-2 py-0.5 bg-zinc-950 border border-zinc-850 text-zinc-400 text-[10px] uppercase">
                                                {event.category}
                                            </span>
                                        )}
                                    </div>

                                    {/* Date & Time Header */}
                                    <div className="flex items-center gap-2 text-xs text-zinc-300">
                                        <CalendarDaysIcon className="w-4 h-4 text-zinc-500" />
                                        <span className="font-bold">
                                            {dateDisplay}
                                        </span>
                                        {timeDisplay && (
                                            <>
                                                <span className="text-zinc-600">//</span>
                                                <ClockIcon className="w-3.5 h-3.5 text-zinc-500" />
                                                <span>{timeDisplay} ({timezoneDisplay})</span>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Main Content: Thumbnail & Details */}
                                <div className="flex flex-col md:flex-row items-start gap-4">
                                    {/* Thumbnail */}
                                    <div className="relative w-full md:w-48 h-32 flex-shrink-0 bg-black border border-zinc-800 overflow-hidden flex items-center justify-center">
                                        {coverThumb ? (
                                            <img
                                                src={coverThumb}
                                                onError={handleImageError}
                                                alt={event.title}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                            />
                                        ) : (
                                            <div className={`w-full h-full flex flex-col items-center justify-center ${
                                                isOnsite ? 'bg-amber-950/20 text-amber-500' : 'bg-cyan-950/20 text-cyan-400'
                                            }`}>
                                                {isOnsite ? (
                                                    <MapPinIcon className="w-8 h-8 text-amber-500/80" />
                                                ) : (
                                                    <GlobeAltIcon className="w-8 h-8 text-cyan-400/80" />
                                                )}
                                                <span className="font-mono text-[9px] font-bold mt-1 tracking-wider uppercase">
                                                    {isOnsite ? 'ON-SITE GATHERING' : 'VIRTUAL GATHERING'}
                                                </span>
                                            </div>
                                        )}
                                        <div className="absolute top-2 left-2 bg-black/85 backdrop-blur-[2px] px-2 py-0.5 border border-zinc-800 text-[9px] font-bold uppercase tracking-wider text-zinc-300">
                                            {isOnsite ? 'PHYSICAL' : 'ONLINE'}
                                        </div>
                                    </div>

                                    {/* Text Info */}
                                    <div className="flex-1 min-w-0 space-y-2.5">
                                        {/* Community Identifier */}
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => navigate(`/communities/${event.communityId}`)}
                                                className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer group"
                                            >
                                                {communityMeta?.avatarUrl && (
                                                    <img src={communityMeta.avatarUrl} alt={communityName} className="w-4 h-4 object-cover border border-zinc-800" onError={handleImageError} />
                                                )}
                                                <span className="font-bold underline decoration-zinc-700 underline-offset-2 group-hover:decoration-white">
                                                    {communityName}
                                                </span>
                                            </button>
                                            <span className="text-zinc-600">•</span>
                                            <span className="text-[10px] text-zinc-500 uppercase">
                                                ORGANIZER: {event.organizerInfo?.displayName || event.hostName || 'Council'}
                                            </span>
                                        </div>

                                        {/* Event Title */}
                                        <h3
                                            onClick={() => setSelectedDossierEvent(event)}
                                            className="text-base font-bold text-white uppercase hover:text-emerald-400 transition-colors cursor-pointer leading-snug"
                                        >
                                            {event.title}
                                        </h3>

                                        {/* Description Snippet */}
                                        <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed">
                                            {event.description}
                                        </p>

                                        {/* Venue or Platform Preview */}
                                        <div className="p-2.5 bg-black/60 border border-zinc-850 text-xs">
                                            {isOnsite ? (
                                                <div className="flex items-center gap-2 text-amber-300">
                                                    <MapPinIcon className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                                                    <span className="font-bold truncate">
                                                        VENUE: {event.onSite?.venueName || event.location || 'Pending Venue'}
                                                    </span>
                                                    {event.onSite?.city && (
                                                        <span className="text-zinc-400 font-normal">
                                                            • {event.onSite.city}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 text-cyan-300">
                                                    <GlobeAltIcon className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
                                                    <span className="font-bold truncate">
                                                        PLATFORM: {event.virtual?.platform || 'Virtual Meeting'}
                                                    </span>
                                                    <span className="text-zinc-500 font-normal text-[11px] ml-auto">
                                                        [LINK PROTECTED]
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Capacity Bar */}
                                {!isCancelled && (
                                    <div className="space-y-1.5 bg-black/40 border border-zinc-850 p-2.5 text-xs">
                                        <div className="flex items-center justify-between text-[11px]">
                                            <div className="flex items-center gap-1.5 text-zinc-400">
                                                <UsersIcon className="w-3.5 h-3.5 text-zinc-500" />
                                                <span className="uppercase text-[10px] text-zinc-500">ATTENDEES:</span>
                                                <strong className="text-white font-bold">{registeredCount}</strong>
                                                <span className="text-zinc-600">/</span>
                                                <span className="text-zinc-400">{capacity}</span>
                                                <span className="text-zinc-500 text-[10px]">({capacityPercentage}%)</span>
                                            </div>
                                            <span className={`text-[10px] font-bold uppercase tracking-wider ${
                                                registeredCount >= capacity ? 'text-rose-400' : 'text-emerald-400'
                                            }`}>
                                                {registeredCount >= capacity
                                                    ? 'CAPACITY REACHED'
                                                    : `${capacity - registeredCount} SPOTS REMAINING`}
                                            </span>
                                        </div>
                                        <div className="w-full bg-zinc-900 h-1 overflow-hidden border border-zinc-800">
                                            <div
                                                className={`h-full transition-all duration-300 ${
                                                    capacityPercentage >= 100 ? 'bg-rose-500' : capacityPercentage >= 75 ? 'bg-amber-400' : 'bg-emerald-500'
                                                }`}
                                                style={{ width: `${capacityPercentage}%` }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="pt-3 border-t border-zinc-850 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        {isUserRegistered && (
                                            <span className="px-2 py-0.5 bg-emerald-950/60 border border-emerald-500/80 text-emerald-300 text-[10px] uppercase font-bold tracking-wider flex items-center gap-1">
                                                <CheckIcon className="w-3 h-3 text-emerald-400" />
                                                REGISTERED PARTICIPANT
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2.5 flex-wrap justify-end">
                                        {/* Register Action */}
                                        {canRegister && (
                                            <button
                                                type="button"
                                                onClick={() => handleToggleRegistration(event)}
                                                disabled={isActionLoading}
                                                className={`h-8 px-4 text-xs font-bold uppercase tracking-wider border transition-colors cursor-pointer flex items-center gap-1.5 ${
                                                    isUserRegistered
                                                        ? 'bg-rose-950/40 border-rose-800 hover:border-rose-600 text-rose-300 hover:text-white'
                                                        : 'bg-white text-black border-white hover:bg-zinc-200'
                                                } disabled:opacity-50`}
                                            >
                                                {isActionLoading ? (
                                                    <span>UPDATING...</span>
                                                ) : isUserRegistered ? (
                                                    <span>CANCEL REGISTRATION</span>
                                                ) : (
                                                    <>
                                                        <CheckIcon className="w-3.5 h-3.5" />
                                                        <span>REGISTER</span>
                                                    </>
                                                )}
                                            </button>
                                        )}

                                        {/* View Details Action */}
                                        <button
                                            type="button"
                                            onClick={() => setSelectedDossierEvent(event)}
                                            className="h-8 px-4 bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-zinc-200 hover:text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5"
                                        >
                                            <span>VIEW DETAILS</span>
                                            <span className="text-zinc-500">→</span>
                                        </button>

                                        {/* Collective Conclave Deep Link */}
                                        <button
                                            type="button"
                                            onClick={() => navigate(`/communities/${event.communityId}?tab=02_conclave&eventId=${event.id}`)}
                                            className="h-8 px-3 bg-black border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                                            title="Open Gathering in Collective Profile"
                                        >
                                            <span>COLLECTIVE HUB</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Event Dossier Modal */}
            {selectedDossierEvent && (
                <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto font-mono">
                    <div className="bg-[#0c0c0e] border border-zinc-800 w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl">
                        {/* Header */}
                        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                            <div>
                                <span className="text-[10px] text-zinc-500 uppercase tracking-widest block font-bold">
                                    CONCLAVE GATHERING DOSSIER
                                </span>
                                <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                                    {selectedDossierEvent.title}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedDossierEvent(null)}
                                className="p-1.5 text-zinc-500 hover:text-white transition-colors cursor-pointer"
                            >
                                <CloseIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
                            {/* Cover image if available */}
                            {selectedDossierEvent.coverImageUrl && (
                                <div className="relative aspect-video max-h-52 w-full overflow-hidden bg-black border border-zinc-800">
                                    <img
                                        src={selectedDossierEvent.coverImageUrl}
                                        alt={selectedDossierEvent.title}
                                        className="w-full h-full object-cover"
                                        onError={handleImageError}
                                    />
                                </div>
                            )}

                            {/* Format and Schedule */}
                            <div className="flex items-center justify-between border-b border-zinc-850 pb-2.5 flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                    <span className={`px-2.5 py-1 text-xs font-bold uppercase border ${
                                        selectedDossierEvent.eventType === 'ONSITE'
                                            ? 'bg-amber-950/40 border-amber-500 text-amber-300'
                                            : 'bg-cyan-950/40 border-cyan-500 text-cyan-300'
                                    }`}>
                                        {selectedDossierEvent.eventType === 'ONSITE' ? 'ON-SITE CONCLAVE' : 'VIRTUAL CONCLAVE'}
                                    </span>
                                    {selectedDossierEvent.category && (
                                        <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-300 text-[11px] uppercase">
                                            {selectedDossierEvent.category}
                                        </span>
                                    )}
                                </div>
                                <div className="text-zinc-300 font-bold">
                                    {selectedDossierEvent.startDate || selectedDossierEvent.date} · {selectedDossierEvent.startTime || selectedDossierEvent.time} ({selectedDossierEvent.timezone || 'UTC'})
                                </div>
                            </div>

                            {/* Community & Organizer */}
                            <div className="p-3 bg-black border border-zinc-850 space-y-1">
                                <div className="flex items-center justify-between text-[11px]">
                                    <span className="text-zinc-500 uppercase">COLLECTIVE:</span>
                                    <strong className="text-white uppercase">{selectedDossierEvent.communityName}</strong>
                                </div>
                                <div className="flex items-center justify-between text-[11px]">
                                    <span className="text-zinc-500 uppercase">ORGANIZER:</span>
                                    <span className="text-zinc-300 uppercase">{selectedDossierEvent.organizerInfo?.displayName || selectedDossierEvent.hostName || 'Council'}</span>
                                </div>
                            </div>

                            {/* Description */}
                            <div className="space-y-1.5">
                                <h4 className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">
                                    GATHERING OVERVIEW & SYNOPSIS:
                                </h4>
                                <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">
                                    {selectedDossierEvent.description}
                                </p>
                            </div>

                            {/* Video teaser */}
                            {selectedDossierEvent.promoVideoUrl && (
                                <div className="p-3 bg-black border border-zinc-850 space-y-1">
                                    <p className="text-[10px] text-zinc-400 uppercase font-bold">PROMOTIONAL VIDEO TEASER:</p>
                                    <div className="aspect-video max-h-44 overflow-hidden bg-black">
                                        <video src={selectedDossierEvent.promoVideoUrl} controls className="w-full h-full object-contain" />
                                    </div>
                                </div>
                            )}

                            {/* Venue / Meeting Specs */}
                            <div className="p-3 bg-black border border-zinc-850 space-y-2">
                                {selectedDossierEvent.eventType === 'ONSITE' ? (
                                    <div className="space-y-1">
                                        <p className="text-amber-300 font-bold">VENUE: {selectedDossierEvent.onSite?.venueName || selectedDossierEvent.location || 'Pending Venue Specification'}</p>
                                        {selectedDossierEvent.onSite?.address && (
                                            <p className="text-zinc-400">
                                                ADDRESS: {selectedDossierEvent.onSite.address} {selectedDossierEvent.onSite.city ? `(${selectedDossierEvent.onSite.city})` : ''}
                                            </p>
                                        )}
                                        {selectedDossierEvent.onSite?.venueInstructions && (
                                            <p className="text-zinc-500 italic">NOTE: {selectedDossierEvent.onSite.venueInstructions}</p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        <p className="text-cyan-300 font-bold">PLATFORM: {selectedDossierEvent.virtual?.platform || 'Virtual Meeting Platform'}</p>
                                        {userRegistrations[selectedDossierEvent.id]?.status === 'CONFIRMED' && selectedDossierEvent.virtual?.meetingUrl ? (
                                            <div className="pt-1">
                                                <a
                                                    href={selectedDossierEvent.virtual.meetingUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-950/80 border border-cyan-500 text-cyan-200 hover:text-white text-xs font-bold uppercase transition-colors"
                                                >
                                                    <PlayIcon className="w-3.5 h-3.5 text-cyan-400" />
                                                    <span>LAUNCH VIRTUAL MEETING ROOM</span>
                                                </a>
                                            </div>
                                        ) : (
                                            <p className="text-zinc-500 italic">
                                                Direct virtual meeting link is protected and unlocks upon confirmed registration.
                                            </p>
                                        )}
                                        {selectedDossierEvent.virtual?.accessInstructions && (
                                            <p className="text-zinc-400">INSTRUCTIONS: {selectedDossierEvent.virtual.accessInstructions}</p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Capacity Info */}
                            <div className="p-3 bg-black/40 border border-zinc-850 flex items-center justify-between text-xs">
                                <span>
                                    CAPACITY: <strong>{selectedDossierEvent.capacity || 100}</strong> PARTICIPANTS
                                </span>
                                <span className="text-emerald-400 font-bold uppercase">
                                    {(selectedDossierEvent.capacity || 100) - (selectedDossierEvent.registeredCount || 0)} SPOTS AVAILABLE
                                </span>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-zinc-850 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <button
                                type="button"
                                onClick={() => setSelectedDossierEvent(null)}
                                className="px-4 py-2 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white uppercase font-bold text-xs"
                            >
                                CLOSE DOSSIER
                            </button>

                            <div className="flex items-center gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const commId = selectedDossierEvent.communityId;
                                        const evId = selectedDossierEvent.id;
                                        setSelectedDossierEvent(null);
                                        navigate(`/communities/${commId}?tab=02_conclave&eventId=${evId}`);
                                    }}
                                    className="px-4 py-2 bg-black border border-zinc-700 hover:border-zinc-500 text-white font-bold uppercase text-xs transition-colors"
                                >
                                    OPEN IN COLLECTIVE PROFILE
                                </button>

                                {isConclaveRegistrationAvailable(selectedDossierEvent).eligible && (
                                    <button
                                        type="button"
                                        onClick={() => handleToggleRegistration(selectedDossierEvent)}
                                        disabled={actionLoadingId === selectedDossierEvent.id}
                                        className={`px-5 py-2 font-bold uppercase text-xs transition-colors ${
                                            userRegistrations[selectedDossierEvent.id]?.status === 'CONFIRMED'
                                                ? 'bg-rose-950/60 border border-rose-800 text-rose-300 hover:text-white'
                                                : 'bg-white text-black hover:bg-zinc-200'
                                        }`}
                                    >
                                        {userRegistrations[selectedDossierEvent.id]?.status === 'CONFIRMED'
                                            ? 'CANCEL REGISTRATION'
                                            : 'REGISTER NOW'
                                        }
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Community Selection Modal for Centralized Conclave Creation */}
            {isCommunitySelectModalOpen && (
                <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto font-mono">
                    <div className="bg-[#0c0c0e] border border-zinc-800 w-full max-w-lg flex flex-col shadow-2xl animate-in fade-in duration-150">
                        {/* Header */}
                        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                            <div>
                                <span className="text-[10px] text-emerald-500 uppercase tracking-widest block font-bold">
                                    // INITIATE CONCLAVE
                                </span>
                                <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                                    SELECT HOST COMMUNITY
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsCommunitySelectModalOpen(false)}
                                className="p-1.5 text-zinc-500 hover:text-white transition-colors cursor-pointer"
                                aria-label="Close modal"
                            >
                                <CloseIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Search Filter Bar */}
                        <div className="p-3 border-b border-zinc-850 bg-black/40">
                            <div className="relative">
                                <MagnifyingGlassIcon className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={communitySearchModalQuery}
                                    onChange={(e) => setCommunitySearchModalQuery(e.target.value)}
                                    placeholder="SEARCH AUTHORIZED COMMUNITIES..."
                                    className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs pl-9 pr-3 py-2 uppercase placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
                                    autoFocus
                                />
                                {communitySearchModalQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setCommunitySearchModalQuery('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-[10px] uppercase font-bold cursor-pointer"
                                    >
                                        CLEAR
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Community List */}
                        <div className="p-3 max-h-80 overflow-y-auto space-y-2">
                            {filteredEligibleCommunities.length === 0 ? (
                                <div className="p-8 text-center border border-dashed border-zinc-850 bg-black/20 space-y-2">
                                    <ShieldCheckIcon className="w-8 h-8 text-zinc-600 mx-auto" />
                                    <p className="text-xs text-zinc-400 font-bold uppercase">
                                        NO AUTHORIZED COMMUNITIES FOUND
                                    </p>
                                    <p className="text-[11px] text-zinc-600 max-w-sm mx-auto leading-relaxed">
                                        {communitySearchModalQuery.trim()
                                            ? `No communities match "${communitySearchModalQuery}". Try a different search term.`
                                            : "You do not have permission to create Conclaves in your joined communities. Permissions are determined by each community's governance settings."
                                        }
                                    </p>
                                </div>
                            ) : (
                                filteredEligibleCommunities.map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => handleSelectCommunityForConclave(item)}
                                        className="w-full p-3 bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 hover:border-emerald-500/70 transition-all text-left flex items-center justify-between gap-3 group cursor-pointer"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            {/* Avatar */}
                                            <div className="w-9 h-9 shrink-0 bg-zinc-900 border border-zinc-800 flex items-center justify-center overflow-hidden">
                                                {item.avatarUrl ? (
                                                    <img
                                                        src={item.avatarUrl}
                                                        alt={item.name}
                                                        className="w-full h-full object-cover"
                                                        onError={handleImageError}
                                                    />
                                                ) : (
                                                    <span className="text-xs font-bold text-zinc-400">
                                                        {item.name.slice(0, 2).toUpperCase()}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Community Info */}
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors uppercase truncate">
                                                        {item.name}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-zinc-500 uppercase">
                                                    <span>{item.category}</span>
                                                    {item.handle && (
                                                        <>
                                                            <span>•</span>
                                                            <span className="text-zinc-600 truncate">{item.handle}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* User Role Badge & Action Arrow */}
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className={`px-2 py-0.5 text-[10px] font-bold uppercase border ${
                                                item.role === 'OWNER'
                                                    ? 'bg-amber-950/40 border-amber-600/50 text-amber-300'
                                                    : item.role === 'ADMIN'
                                                    ? 'bg-indigo-950/40 border-indigo-600/50 text-indigo-300'
                                                    : 'bg-emerald-950/40 border-emerald-600/50 text-emerald-300'
                                            }`}>
                                                {item.role}
                                            </span>
                                            <span className="text-zinc-600 group-hover:text-white transition-colors text-xs">
                                                →
                                            </span>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-3 border-t border-zinc-800 bg-black/60 flex items-center justify-between text-[11px] text-zinc-500">
                            <span className="truncate pr-2">
                                CREATES GATHERING UNDER COMMUNITY GOVERNANCE
                            </span>
                            <button
                                type="button"
                                onClick={() => setIsCommunitySelectModalOpen(false)}
                                className="px-3 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white uppercase font-bold text-[10px] transition-colors shrink-0 cursor-pointer"
                            >
                                CANCEL
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
