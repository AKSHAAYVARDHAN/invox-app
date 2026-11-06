import React, { useState, useEffect, useMemo } from 'react';
import type { Community } from '../../../types';
import { useAuth } from '../../../contexts/AuthContext';
import type {
    CollectiveMemory,
    CreateCollectiveMemoryInput,
    MemoryCategory,
    MemoryStatus,
} from '../../../services/collectiveMemoryTypes';
import { MEMORY_CATEGORIES } from '../../../services/collectiveMemoryTypes';
import {
    subscribeCommunityMemories,
    createCollectiveMemory,
    updateCollectiveMemory,
    deleteCollectiveMemory,
    calculateMemoryStats,
    getFeaturedMemory,
    groupMemoriesByTimeline,
    canUserCreateMemory,
    canUserManageMemory,
    extractYearAndMonth,
    pinMemoryAsFeatured,
    unpinFeaturedMemory,
} from '../../../services/collectiveMemoryService';
import { MemoryCategoryBadge, SignificanceBadge, MemoryStatusBadge, CategoryIcon } from './MemoryCategoryBadge';
import { MemoryDetailModal } from './MemoryDetailModal';
import { CreateMemoryModal } from './CreateMemoryModal';
import {
    CalendarDaysIcon,
    UsersIcon,
    SparklesIcon,
    PlusIcon,
    MagnifyingGlassIcon,
    ArrowUpRightIcon,
    CloseIcon,
    ShieldCheckIcon,
    DocumentTextIcon,
    GlobeAltIcon,
    MapPinIcon,
    PinIcon,
    PinSolidIcon,
    EllipsisVerticalIcon,
    PencilSquareIcon,
    TrashIcon,
} from '../../ui/Icons';
import { handleImageError } from '../../utils/imageUtils';

interface CollectiveMemoryViewProps {
    community: Community;
    canManage: boolean;
    isMember: boolean;
    onOpenConclaveTab?: () => void;
}

export const CollectiveMemoryView: React.FC<CollectiveMemoryViewProps> = ({
    community,
    canManage,
    isMember,
    onOpenConclaveTab,
}) => {
    const { currentUser } = useAuth();

    // Data State
    const [memories, setMemories] = useState<CollectiveMemory[]>([]);
    const [loading, setLoading] = useState(true);

    // Active Category Filter: 'all' or one of the 6 MemoryCategory
    const [activeCategory, setActiveCategory] = useState<MemoryCategory | 'all'>('all');

    // Search Query
    const [searchQuery, setSearchQuery] = useState('');

    // Year Filter
    const [selectedYear, setSelectedYear] = useState<string>('all');

    // Chronological Sort Order
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

    // Manager Status Filter: 'all' | 'published' | 'draft' | 'archived'
    const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft' | 'archived'>('published');

    // Modals
    const [selectedMemory, setSelectedMemory] = useState<CollectiveMemory | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingMemory, setEditingMemory] = useState<CollectiveMemory | null>(null);

    // Pin as Featured Management State
    const [pinningMemoryId, setPinningMemoryId] = useState<string | null>(null);
    const [activeMenuMemoryId, setActiveMenuMemoryId] = useState<string | null>(null);
    const [pinFeedback, setPinFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Real-time subscription to community memories
    useEffect(() => {
        if (!community?.id) {
            setMemories([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const unsubscribe = subscribeCommunityMemories(community.id, (loadedMemories) => {
            setMemories(loadedMemories);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [community?.id]);

    // Check user creation permissions
    const canCreate = useMemo(() => {
        return canUserCreateMemory(community, currentUser, isMember);
    }, [community, currentUser, isMember]);

    // Overview Statistics
    const stats = useMemo(() => {
        return calculateMemoryStats(memories);
    }, [memories]);

    // Featured Memory for Hero Spotlight Banner
    const featuredMemory = useMemo(() => {
        return getFeaturedMemory(memories);
    }, [memories]);

    // Available Years for filter dropdown
    const availableYears = useMemo(() => {
        const yearsSet = new Set<number>();
        for (const m of memories) {
            const y = m.year || extractYearAndMonth(m.date).year;
            if (y) yearsSet.add(y);
        }
        return Array.from(yearsSet).sort((a, b) => b - a);
    }, [memories]);

    // Filtered memories according to Category, Search, Year, and Status
    const filteredMemories = useMemo(() => {
        return memories.filter((m) => {
            // Category filter
            if (activeCategory !== 'all' && m.category !== activeCategory) {
                return false;
            }

            // Status filter (non-managers only see published)
            if (!canManage) {
                if (m.status !== 'published') return false;
            } else if (statusFilter !== 'all') {
                if (m.status !== statusFilter) return false;
            }

            // Year filter
            if (selectedYear !== 'all') {
                const y = m.year || extractYearAndMonth(m.date).year;
                if (String(y) !== selectedYear) return false;
            }

            // Keyword / Search filter
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const titleMatch = m.title.toLowerCase().includes(q);
                const descMatch = m.description.toLowerCase().includes(q);
                const conclaveMatch = m.relatedConclave?.title.toLowerCase().includes(q);
                const contributorMatch = m.contributors?.some((c) => c.name.toLowerCase().includes(q));
                if (!titleMatch && !descMatch && !conclaveMatch && !contributorMatch) {
                    return false;
                }
            }

            return true;
        });
    }, [memories, activeCategory, canManage, statusFilter, selectedYear, searchQuery]);

    // Timeline Groups
    const timelineGroups = useMemo(() => {
        return groupMemoriesByTimeline(filteredMemories, sortOrder);
    }, [filteredMemories, sortOrder]);

    // Handlers
    const handleCreateOrUpdateMemory = async (
        input: CreateCollectiveMemoryInput,
        editingId?: string
    ) => {
        if (!currentUser) return;
        if (editingId) {
            await updateCollectiveMemory(editingId, input);
        } else {
            await createCollectiveMemory(input, currentUser);
        }
    };

    const handleDeleteMemory = async (memoryId: string) => {
        await deleteCollectiveMemory(memoryId);
        if (selectedMemory?.id === memoryId) {
            setSelectedMemory(null);
        }
    };

    const handleStatusChange = async (memoryId: string, newStatus: MemoryStatus) => {
        await updateCollectiveMemory(memoryId, { status: newStatus });
        if (selectedMemory?.id === memoryId) {
            setSelectedMemory((prev) => prev ? { ...prev, status: newStatus } : null);
        }
    };

    // Toggle Pin as Featured handler for Community Owners / Admins
    const handleTogglePin = async (memory: CollectiveMemory) => {
        if (!canManage) {
            setPinFeedback({
                type: 'error',
                message: 'Only community owners and authorized administrators can pin memories.',
            });
            return;
        }

        setPinningMemoryId(memory.id);
        setActiveMenuMemoryId(null);
        const wasFeatured = Boolean(memory.isFeatured);

        try {
            if (wasFeatured) {
                await unpinFeaturedMemory(community.id, memory.id, memories);
                setMemories((prev) =>
                    prev.map((m) => (m.id === memory.id ? { ...m, isFeatured: false } : m))
                );
                if (selectedMemory?.id === memory.id) {
                    setSelectedMemory((prev) => (prev ? { ...prev, isFeatured: false } : null));
                }
                setPinFeedback({
                    type: 'success',
                    message: `Unpinned "${memory.title}" from Featured Memory.`,
                });
            } else {
                await pinMemoryAsFeatured(community.id, memory.id, memories);
                setMemories((prev) =>
                    prev.map((m) =>
                        m.id === memory.id
                            ? { ...m, isFeatured: true }
                            : m.isFeatured
                            ? { ...m, isFeatured: false }
                            : m
                    )
                );
                if (selectedMemory) {
                    setSelectedMemory((prev) =>
                        prev
                            ? prev.id === memory.id
                                ? { ...prev, isFeatured: true }
                                : { ...prev, isFeatured: false }
                            : null
                    );
                }
                setPinFeedback({
                    type: 'success',
                    message: `Pinned "${memory.title}" as Community Featured Memory.`,
                });
            }
        } catch (err: any) {
            console.error('[TOGGLE_PIN_ERROR]', err);
            setPinFeedback({
                type: 'error',
                message: err?.message || 'Failed to update featured memory status.',
            });
        } finally {
            setPinningMemoryId(null);
        }
    };

    // Close active dropdown menu when clicking outside
    useEffect(() => {
        if (!activeMenuMemoryId) return;
        const handleClickOutside = () => setActiveMenuMemoryId(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [activeMenuMemoryId]);

    // Auto dismiss feedback banner after 4 seconds
    useEffect(() => {
        if (!pinFeedback) return;
        const timer = setTimeout(() => setPinFeedback(null), 4000);
        return () => clearTimeout(timer);
    }, [pinFeedback]);

    const formatDateDisplay = (dateStr: string) => {
        try {
            const [y, m, d] = dateStr.split('-');
            if (y && m && d) {
                const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
                return date.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                }).toUpperCase();
            }
        } catch {
            // fallback
        }
        return dateStr;
    };

    return (
        <div className="w-full max-w-full min-w-0 flex flex-col space-y-6 font-mono">
            {/* =========================================================================
                1. HEADER & OVERVIEW METRICS (FULL WIDTH)
               ========================================================================= */}
            <div className="w-full space-y-4">
                {/* Header Strip */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-zinc-850">
                    <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-amber-400"></span>
                            <h3 className="font-bold text-white uppercase tracking-wider text-xs sm:text-sm">
                                // 03. COLLECTIVE MEMORY ARCHIVE
                            </h3>
                        </div>
                        <p className="text-[11px] text-zinc-400 font-sans">
                            Sovereign historical journey, foundational milestones, and collective accomplishments of {community.name}.
                        </p>
                    </div>

                    {/* Record Memory Action */}
                    {canCreate && (
                        <button
                            type="button"
                            onClick={() => {
                                setEditingMemory(null);
                                setIsCreateModalOpen(true);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-white text-black font-bold uppercase hover:bg-zinc-200 transition-colors text-xs whitespace-nowrap shadow-sm cursor-pointer self-start sm:self-auto shrink-0"
                        >
                            <PlusIcon className="w-3.5 h-3.5" />
                            <span>RECORD MEMORY</span>
                        </button>
                    )}
                </div>

                {/* 4 Overview Metric Cards - Full Width Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full">
                    <div className="p-4 bg-[#0c0c0e] border border-zinc-800 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-zinc-500 uppercase text-[10px] tracking-wider font-bold">TOTAL MEMORIES</span>
                            <DocumentTextIcon className="w-4 h-4 text-zinc-500" />
                        </div>
                        <div className="mt-3 text-2xl sm:text-3xl font-bold text-white tracking-tight">
                            {stats.total.toLocaleString()}
                        </div>
                        <span className="text-[10px] text-zinc-600 mt-1 uppercase">Historical Records</span>
                    </div>

                    <div className="p-4 bg-[#0c0c0e] border border-zinc-800 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-amber-400/90 uppercase text-[10px] tracking-wider font-bold">MILESTONES</span>
                            <CategoryIcon category="milestones" className="w-4 h-4 text-amber-400" />
                        </div>
                        <div className="mt-3 text-2xl sm:text-3xl font-bold text-amber-300 tracking-tight">
                            {stats.milestones.toLocaleString()}
                        </div>
                        <span className="text-[10px] text-zinc-600 mt-1 uppercase">Turning Points</span>
                    </div>

                    <div className="p-4 bg-[#0c0c0e] border border-zinc-800 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-indigo-400/90 uppercase text-[10px] tracking-wider font-bold">ACHIEVEMENTS</span>
                            <CategoryIcon category="achievements" className="w-4 h-4 text-indigo-400" />
                        </div>
                        <div className="mt-3 text-2xl sm:text-3xl font-bold text-indigo-300 tracking-tight">
                            {stats.achievements.toLocaleString()}
                        </div>
                        <span className="text-[10px] text-zinc-600 mt-1 uppercase">Honors & Accolades</span>
                    </div>

                    <div className="p-4 bg-[#0c0c0e] border border-zinc-800 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-emerald-400/90 uppercase text-[10px] tracking-wider font-bold">GATHERINGS</span>
                            <CategoryIcon category="gatherings" className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div className="mt-3 text-2xl sm:text-3xl font-bold text-emerald-300 tracking-tight">
                            {stats.gatherings.toLocaleString()}
                        </div>
                        <span className="text-[10px] text-zinc-600 mt-1 uppercase">Conclaves & Summits</span>
                    </div>
                </div>
            </div>

            {/* Pin / Unpin Status Feedback Notification Banner */}
            {pinFeedback && (
                <div
                    className={`p-3 border flex items-center justify-between gap-3 text-xs uppercase tracking-wider font-mono shadow-md ${
                        pinFeedback.type === 'success'
                            ? 'bg-amber-950/40 border-amber-500/50 text-amber-300'
                            : 'bg-rose-950/40 border-rose-500/50 text-rose-300'
                    }`}
                >
                    <div className="flex items-center gap-2">
                        <PinSolidIcon className="w-4 h-4 shrink-0 text-amber-400" />
                        <span>{pinFeedback.message}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setPinFeedback(null)}
                        className="text-zinc-400 hover:text-white cursor-pointer"
                    >
                        <CloseIcon className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {/* =========================================================================
                2. FEATURED MEMORY EDITORIAL SPOTLIGHT (FULL WIDTH HORIZONTAL CARD)
               ========================================================================= */}
            {featuredMemory && (
                <div className="w-full bg-[#0c0c0e] border border-zinc-800 hover:border-zinc-700 transition-colors shadow-lg overflow-hidden group">
                    <div className="flex flex-col md:flex-row items-stretch w-full min-h-[220px]">
                        {/* Image / Graphic Column */}
                        <div className="w-full md:w-80 lg:w-96 shrink-0 bg-black border-b md:border-b-0 md:border-r border-zinc-800 relative overflow-hidden flex items-center justify-center min-h-[190px] md:min-h-full">
                            {featuredMemory.coverImageUrl ? (
                                <img
                                    src={featuredMemory.coverImageUrl}
                                    alt={featuredMemory.title}
                                    onError={handleImageError}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                            ) : (
                                <div className="w-full h-full min-h-[190px] bg-gradient-to-br from-zinc-950 via-[#0e0f12] to-black flex flex-col items-center justify-center p-6 text-center space-y-2">
                                    <CategoryIcon category={featuredMemory.category} className="w-10 h-10 text-amber-400/80" />
                                    <span className="text-[10px] text-zinc-500 uppercase font-mono tracking-widest">
                                        {featuredMemory.category.toUpperCase()}
                                    </span>
                                </div>
                            )}

                            {/* Occurrence Date Stamp */}
                            <div className="absolute top-3 left-3 flex items-center gap-1.5 text-[10px] text-zinc-300 bg-black/85 px-2.5 py-1 border border-zinc-700 backdrop-blur-sm">
                                <CalendarDaysIcon className="w-3.5 h-3.5 text-zinc-400" />
                                <span>{formatDateDisplay(featuredMemory.date)}</span>
                            </div>
                        </div>

                        {/* Narrative Editorial Column */}
                        <div className="flex-1 p-5 sm:p-6 flex flex-col justify-between space-y-3.5 min-w-0">
                            <div className="space-y-2.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest bg-amber-950/60 px-2.5 py-0.5 border border-amber-500/40 flex items-center gap-1.5 shadow-sm">
                                        <PinSolidIcon className="w-3.5 h-3.5 text-amber-400" />
                                        <span>FEATURED MEMORY</span>
                                    </span>
                                    <MemoryCategoryBadge category={featuredMemory.category} size="sm" />
                                    <SignificanceBadge significance={featuredMemory.significance} size="sm" />
                                    <MemoryStatusBadge status={featuredMemory.status} />
                                </div>

                                <h4 className="text-base sm:text-lg lg:text-xl font-bold text-white uppercase tracking-wide leading-snug line-clamp-2">
                                    {featuredMemory.title}
                                </h4>

                                <p className="text-xs sm:text-sm text-zinc-400 font-sans line-clamp-3 leading-relaxed">
                                    {featuredMemory.description}
                                </p>
                            </div>

                            {/* Footer attribution and action */}
                            <div className="pt-3 border-t border-zinc-850 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                                {featuredMemory.contributors && featuredMemory.contributors.length > 0 ? (
                                    <div className="flex items-center gap-2 text-[11px] text-zinc-400 truncate">
                                        <UsersIcon className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                                        <span className="truncate">
                                            {featuredMemory.contributors[0].name}
                                            {featuredMemory.contributors.length > 1 && ` +${featuredMemory.contributors.length - 1} contributors`}
                                        </span>
                                    </div>
                                ) : (
                                    <span className="text-[11px] text-zinc-500 uppercase tracking-wider">
                                        COMMUNITY HISTORICAL ARCHIVE
                                    </span>
                                )}

                                <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
                                    {canManage && (
                                        <button
                                            type="button"
                                            disabled={pinningMemoryId === featuredMemory.id}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleTogglePin(featuredMemory);
                                            }}
                                            className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-amber-500/60 text-amber-300 hover:text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                                            title="Unpin this memory from Featured Spotlight"
                                        >
                                            <PinIcon className="w-3.5 h-3.5 text-amber-400" />
                                            <span>{pinningMemoryId === featuredMemory.id ? 'UNPINNING...' : 'UNPIN FROM FEATURED'}</span>
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => setSelectedMemory(featuredMemory)}
                                        className="px-4 py-2 bg-white hover:bg-zinc-200 text-black text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-sm"
                                    >
                                        <span>EXPLORE DOSSIER</span>
                                        <ArrowUpRightIcon className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* =========================================================================
                3. CATEGORY NAVIGATION & COMPACT TOOLBAR
               ========================================================================= */}
            <div className="w-full space-y-3">
                {/* Category Navigation Pills (Full Width Responsive Scroll) */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full pb-1">
                    <button
                        type="button"
                        onClick={() => setActiveCategory('all')}
                        className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors border cursor-pointer shrink-0 flex items-center gap-1.5 ${
                            activeCategory === 'all'
                                ? 'bg-white text-black border-white shadow-sm'
                                : 'bg-[#0c0c0e] border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                        }`}
                    >
                        <span>ALL MEMORIES</span>
                        <span className={`text-[10px] px-1.5 py-0.2 ${activeCategory === 'all' ? 'bg-zinc-200 text-black font-bold' : 'bg-zinc-900 text-zinc-400'}`}>
                            {stats.total}
                        </span>
                    </button>

                    {(['milestones', 'achievements', 'gatherings', 'decisions', 'traditions', 'contributions'] as MemoryCategory[]).map((catKey) => {
                        const meta = MEMORY_CATEGORIES[catKey];
                        const isSelected = activeCategory === catKey;
                        const count = stats[catKey] || 0;

                        return (
                            <button
                                key={catKey}
                                type="button"
                                onClick={() => setActiveCategory(catKey)}
                                className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors border cursor-pointer shrink-0 flex items-center gap-1.5 ${
                                    isSelected
                                        ? `${meta.badgeBg} ${meta.badgeBorder} ${meta.badgeText} shadow-sm`
                                        : 'bg-[#0c0c0e] border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                                }`}
                            >
                                <CategoryIcon category={catKey} className="w-3 h-3" />
                                <span>{meta.label}</span>
                                <span className={`text-[10px] px-1.5 py-0.2 bg-black/60 border border-zinc-800 text-zinc-400`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Filter and Search Bar Controls (Full Width Responsive Toolbar) */}
                <div className="p-3 bg-[#0c0c0e] border border-zinc-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 w-full">
                    {/* Search Input */}
                    <div className="relative flex-1 min-w-[220px]">
                        <MagnifyingGlassIcon className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search archive by keyword, contributor, title..."
                            className="w-full pl-9 pr-8 py-1.5 bg-black border border-zinc-800 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2.5 top-2.5 text-zinc-500 hover:text-white cursor-pointer"
                            >
                                <CloseIcon className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Filter Dropdowns */}
                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                        {/* Year Selector */}
                        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                            <span className="text-[10px] text-zinc-500 uppercase hidden md:inline">YEAR:</span>
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(e.target.value)}
                                className="px-2.5 py-1.5 bg-black border border-zinc-800 text-zinc-300 text-xs focus:outline-none focus:border-zinc-500 cursor-pointer"
                            >
                                <option value="all">ALL YEARS</option>
                                {availableYears.map((yr) => (
                                    <option key={yr} value={String(yr)}>
                                        {yr}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Chronological Sort Toggle */}
                        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                            <select
                                value={sortOrder}
                                onChange={(e) => setSortOrder(e.target.value as 'desc' | 'asc')}
                                className="px-2.5 py-1.5 bg-black border border-zinc-800 text-zinc-300 text-xs focus:outline-none focus:border-zinc-500 cursor-pointer"
                            >
                                <option value="desc">NEWEST FIRST</option>
                                <option value="asc">CHRONOLOGICAL</option>
                            </select>
                        </div>

                        {/* Status Filter for Managers */}
                        {canManage && (
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value as any)}
                                className="px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs focus:outline-none focus:border-zinc-500 cursor-pointer"
                            >
                                <option value="published">PUBLISHED</option>
                                <option value="draft">DRAFTS</option>
                                <option value="archived">ARCHIVED</option>
                                <option value="all">ALL STATUSES</option>
                            </select>
                        )}
                    </div>
                </div>
            </div>

            {/* =========================================================================
                4. HISTORICAL ARCHIVE: 2-COLUMN RESPONSIVE CARD GRID (FULL WIDTH)
               ========================================================================= */}
            <div className="w-full space-y-6">
                {loading ? (
                    /* Loading State */
                    <div className="p-12 text-center border border-zinc-850 bg-[#0c0c0e] space-y-3 w-full">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent animate-spin mx-auto"></div>
                        <p className="text-xs text-zinc-400 uppercase tracking-wider">
                            SYNCHRONIZING HISTORICAL ARCHIVE...
                        </p>
                    </div>
                ) : timelineGroups.length === 0 ? (
                    /* Empty State */
                    <div className="p-8 sm:p-12 text-center border border-dashed border-zinc-800 bg-[#0c0c0e] space-y-4 w-full">
                        <div className="w-12 h-12 bg-black border border-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
                            <DocumentTextIcon className="w-6 h-6" />
                        </div>
                        <div className="space-y-1">
                            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                                // NO HISTORICAL MEMORIES MATCHING FILTER
                            </h4>
                            <p className="text-xs text-zinc-400 max-w-md mx-auto font-sans leading-relaxed">
                                {searchQuery || activeCategory !== 'all' || selectedYear !== 'all'
                                    ? 'Try broadening your search keyword or switching category filters to discover earlier records.'
                                    : 'Collective Memory preserves the story of your community. Start recording key milestones, achievements, and gatherings.'}
                            </p>
                        </div>

                        {canCreate && (
                            <div className="pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditingMemory(null);
                                        setIsCreateModalOpen(true);
                                    }}
                                    className="px-4 py-2 bg-white text-black font-bold uppercase text-xs hover:bg-zinc-200 transition-colors cursor-pointer"
                                >
                                    + RECORD FIRST MEMORY
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    /* Responsive Chronological Year and Month Groups */
                    timelineGroups.map((yearGroup) => (
                        <div key={yearGroup.year} className="w-full space-y-5">
                            {/* Year Divider Banner */}
                            <div className="flex items-center gap-3 w-full">
                                <span className="text-xs font-bold text-white uppercase tracking-widest bg-zinc-900 border border-zinc-700 px-3 py-1 shrink-0">
                                    YEAR {yearGroup.year}
                                </span>
                                <div className="flex-1 border-t border-zinc-800"></div>
                                <span className="text-[10px] text-zinc-500 uppercase tracking-widest shrink-0">
                                    {yearGroup.totalCount} {yearGroup.totalCount === 1 ? 'RECORD' : 'RECORDS'}
                                </span>
                            </div>

                            {/* Month Sections within Year */}
                            {yearGroup.months.map((monthGroup) => (
                                <div key={`${monthGroup.year}-${monthGroup.month}`} className="w-full space-y-3">
                                    {/* Month Section Heading */}
                                    <div className="flex items-center gap-2 pt-1 text-zinc-400 text-xs font-bold uppercase tracking-wider">
                                        <span className="w-1.5 h-1.5 bg-amber-400/80 inline-block"></span>
                                        <span>{monthGroup.monthName} {monthGroup.year}</span>
                                        <span className="text-[10px] text-zinc-500 font-normal">
                                            ({monthGroup.memories.length} {monthGroup.memories.length === 1 ? 'record' : 'records'})
                                        </span>
                                    </div>

                                    {/* Full-Width Vertical Archive: Single-Column Stack */}
                                    <div className="w-full flex flex-col space-y-4">
                                        {monthGroup.memories.map((mem) => {
                                            const isPivotal = mem.significance === 'pivotal';
                                            const isMajor = mem.significance === 'major';
                                            const catMeta = MEMORY_CATEGORIES[mem.category] || MEMORY_CATEGORIES.milestones;

                                            return (
                                                <div
                                                    key={mem.id}
                                                    onClick={() => setSelectedMemory(mem)}
                                                    className={`w-full bg-[#0c0c0e] border transition-all duration-200 cursor-pointer flex flex-col sm:flex-row group hover:border-zinc-500 hover:bg-zinc-950/90 shadow-sm overflow-hidden ${
                                                        isPivotal
                                                            ? 'border-amber-500/50 hover:border-amber-400'
                                                            : isMajor
                                                            ? 'border-zinc-700 hover:border-zinc-500'
                                                            : 'border-zinc-850 hover:border-zinc-600'
                                                    }`}
                                                >
                                                    {/* Left Section: Cover Image or Architectural Category Emblem */}
                                                    {mem.coverImageUrl ? (
                                                        <div className="w-full sm:w-60 md:w-72 lg:w-80 shrink-0 bg-black border-b sm:border-b-0 sm:border-r border-zinc-850 relative overflow-hidden min-h-[190px] sm:min-h-full flex items-center justify-center">
                                                            <img
                                                                src={mem.coverImageUrl}
                                                                alt={mem.title}
                                                                onError={handleImageError}
                                                                className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500 min-h-[190px] sm:min-h-full sm:absolute sm:inset-0"
                                                            />
                                                            {/* Mobile-only date overlay stamp */}
                                                            <div className="sm:hidden absolute top-2.5 left-2.5 flex items-center gap-1 text-[10px] text-zinc-300 bg-black/85 px-2 py-0.5 border border-zinc-700 backdrop-blur-sm">
                                                                <CalendarDaysIcon className="w-3 h-3 text-zinc-400" />
                                                                <span>{formatDateDisplay(mem.date)}</span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="w-full sm:w-60 md:w-72 lg:w-80 shrink-0 bg-gradient-to-br from-[#0c0c0e] via-black to-[#09090b] border-b sm:border-b-0 sm:border-r border-zinc-850/80 p-5 flex flex-col items-center justify-center text-center space-y-2 relative overflow-hidden min-h-[140px] sm:min-h-full">
                                                            <div className="w-12 h-12 rounded-full bg-zinc-900/80 border border-zinc-800 flex items-center justify-center group-hover:border-zinc-600 transition-colors">
                                                                <CategoryIcon category={mem.category} className="w-6 h-6 text-zinc-400 group-hover:text-amber-400 transition-colors" />
                                                            </div>
                                                            <div className="space-y-0.5">
                                                                <span className="text-[10px] text-zinc-300 uppercase tracking-widest font-mono font-bold block">
                                                                    // {catMeta.shortLabel}
                                                                </span>
                                                                <span className="text-[9px] text-zinc-500 font-mono tracking-wider block">
                                                                    HISTORICAL RECORD
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Right Section: Structured Information & Actions */}
                                                    <div className="flex-1 p-4 sm:p-5 flex flex-col justify-between space-y-3.5 min-w-0">
                                                        <div className="space-y-2.5">
                                                            {/* Badges + Date Header + Management Menu */}
                                                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                                                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                                                    {mem.isFeatured && (
                                                                        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest bg-amber-950/60 px-2 py-0.5 border border-amber-500/40 flex items-center gap-1 shadow-sm">
                                                                            <PinSolidIcon className="w-3 h-3 text-amber-400" />
                                                                            <span>FEATURED</span>
                                                                        </span>
                                                                    )}
                                                                    <MemoryCategoryBadge category={mem.category} size="sm" />
                                                                    <SignificanceBadge significance={mem.significance} size="sm" />
                                                                    <MemoryStatusBadge status={mem.status} />
                                                                </div>

                                                                <div className="flex items-center gap-2 shrink-0">
                                                                    <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-zinc-400 font-mono">
                                                                        <CalendarDaysIcon className="w-3 h-3 text-zinc-500" />
                                                                        <span>{formatDateDisplay(mem.date)}</span>
                                                                    </div>

                                                                    {/* Management Action Menu for Community Owners / Admins */}
                                                                    {canManage && (
                                                                        <div className="relative" onClick={(e) => e.stopPropagation()}>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setActiveMenuMemoryId(activeMenuMemoryId === mem.id ? null : mem.id)}
                                                                                className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-transparent hover:border-zinc-700 transition-colors cursor-pointer"
                                                                                title="Memory Management Actions"
                                                                            >
                                                                                <EllipsisVerticalIcon className="w-4 h-4" />
                                                                            </button>

                                                                            {activeMenuMemoryId === mem.id && (
                                                                                <div className="absolute right-0 top-full mt-1 w-52 bg-black border border-zinc-700 shadow-2xl py-1 z-30 font-mono text-xs">
                                                                                    {mem.status === 'published' && (
                                                                                        <button
                                                                                            type="button"
                                                                                            disabled={pinningMemoryId === mem.id}
                                                                                            onClick={() => handleTogglePin(mem)}
                                                                                            className="w-full text-left px-3 py-2 text-xs font-bold uppercase tracking-wider hover:bg-zinc-900 transition-colors flex items-center gap-2 text-zinc-200 hover:text-amber-300 cursor-pointer"
                                                                                        >
                                                                                            <PinIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                                                                            <span>
                                                                                                {pinningMemoryId === mem.id
                                                                                                    ? 'UPDATING...'
                                                                                                    : mem.isFeatured
                                                                                                    ? 'UNPIN FROM FEATURED'
                                                                                                    : 'PIN AS FEATURED'}
                                                                                            </span>
                                                                                        </button>
                                                                                    )}
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            setActiveMenuMemoryId(null);
                                                                                            setEditingMemory(mem);
                                                                                            setIsCreateModalOpen(true);
                                                                                        }}
                                                                                        className="w-full text-left px-3 py-2 text-xs font-bold uppercase tracking-wider hover:bg-zinc-900 transition-colors flex items-center gap-2 text-zinc-300 hover:text-white cursor-pointer"
                                                                                    >
                                                                                        <PencilSquareIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                                                                        <span>EDIT DOSSIER</span>
                                                                                    </button>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            setActiveMenuMemoryId(null);
                                                                                            handleDeleteMemory(mem.id);
                                                                                        }}
                                                                                        className="w-full text-left px-3 py-2 text-xs font-bold uppercase tracking-wider hover:bg-zinc-900 transition-colors flex items-center gap-2 text-rose-400 hover:text-rose-300 cursor-pointer border-t border-zinc-850"
                                                                                    >
                                                                                        <TrashIcon className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                                                                        <span>DELETE RECORD</span>
                                                                                    </button>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Title */}
                                                            <h4 className="text-sm sm:text-base font-bold text-white uppercase tracking-wide group-hover:text-amber-200 transition-colors line-clamp-2 leading-snug">
                                                                {mem.title}
                                                            </h4>

                                                            {/* Description */}
                                                            <p className="text-xs sm:text-[13px] text-zinc-400 font-sans line-clamp-2 sm:line-clamp-3 leading-relaxed">
                                                                {mem.description}
                                                            </p>

                                                            {/* Conclave Tag if linked */}
                                                            {mem.relatedConclave && (
                                                                <div className="pt-0.5">
                                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold uppercase truncate max-w-full">
                                                                        <GlobeAltIcon className="w-3 h-3 text-emerald-400 shrink-0" />
                                                                        <span className="truncate">CONCLAVE: {mem.relatedConclave.title}</span>
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Footer: Contributor Info + View Action */}
                                                        <div className="pt-3 border-t border-zinc-850/80 flex items-center justify-between gap-3 text-xs mt-auto">
                                                            {mem.contributors && mem.contributors.length > 0 ? (
                                                                <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 truncate">
                                                                    <UsersIcon className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                                                                    <span className="truncate">
                                                                        {mem.contributors[0].name}
                                                                        {mem.contributors.length > 1 && ` +${mem.contributors.length - 1} contributors`}
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">
                                                                    COMMUNITY RECORD
                                                                </span>
                                                            )}

                                                            <span className="text-xs font-bold text-zinc-300 group-hover:text-white uppercase tracking-wider flex items-center gap-1.5 shrink-0 transition-colors">
                                                                <span>VIEW MEMORY</span>
                                                                <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))
                )}
            </div>

            {/* =========================================================================
                5. MODALS
               ========================================================================= */}
            {/* Individual Memory Detail Dossier Modal */}
            <MemoryDetailModal
                isOpen={Boolean(selectedMemory)}
                onClose={() => setSelectedMemory(null)}
                memory={selectedMemory}
                canManage={canManage}
                onEdit={(mem) => {
                    setSelectedMemory(null);
                    setEditingMemory(mem);
                    setIsCreateModalOpen(true);
                }}
                onDelete={handleDeleteMemory}
                onStatusChange={handleStatusChange}
                onTogglePin={handleTogglePin}
                onOpenConclave={(conclaveId) => {
                    if (onOpenConclaveTab) {
                        onOpenConclaveTab();
                    }
                }}
            />

            {/* Create / Edit Memory Modal */}
            <CreateMemoryModal
                isOpen={isCreateModalOpen}
                onClose={() => {
                    setIsCreateModalOpen(false);
                    setEditingMemory(null);
                }}
                community={community}
                editingMemory={editingMemory}
                onSubmit={handleCreateOrUpdateMemory}
            />
        </div>
    );
};
