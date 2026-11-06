import React, { useState, useEffect } from 'react';
import type { Community } from '../../../types';
import type {
    CollectiveMemory,
    CreateCollectiveMemoryInput,
    MemoryCategory,
    MemorySignificance,
    MemoryStatus,
    MemoryContributor,
    RelatedConclaveSummary,
} from '../../../services/collectiveMemoryTypes';
import { MEMORY_CATEGORIES } from '../../../services/collectiveMemoryTypes';
import { CategoryIcon } from './MemoryCategoryBadge';
import {
    CloseIcon,
    CalendarDaysIcon,
    UsersIcon,
    SparklesIcon,
    GlobeAltIcon,
    PlusIcon,
    TrashIcon,
    AlertTriangleIcon,
    CheckIcon,
    PhotoIcon,
} from '../../ui/Icons';
import type { ConclaveEvent } from '../../../services/conclaveTypes';
import { subscribeCommunityConclaveEvents, getDefaultDemoConclaveEvents } from '../../../services/conclaveService';

interface CreateMemoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    community: Community;
    editingMemory?: CollectiveMemory | null;
    initialCategory?: MemoryCategory;
    initialConclave?: ConclaveEvent | null;
    onSubmit: (input: CreateCollectiveMemoryInput, editingId?: string) => Promise<void>;
}

export const CreateMemoryModal: React.FC<CreateMemoryModalProps> = ({
    isOpen,
    onClose,
    community,
    editingMemory,
    initialCategory,
    initialConclave,
    onSubmit,
}) => {
    const isEdit = Boolean(editingMemory);

    const [title, setTitle] = useState('');
    const [category, setCategory] = useState<MemoryCategory>('milestones');
    const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [significance, setSignificance] = useState<MemorySignificance>('standard');
    const [description, setDescription] = useState('');
    const [coverImageUrl, setCoverImageUrl] = useState('');
    const [isFeatured, setIsFeatured] = useState(false);
    const [status, setStatus] = useState<MemoryStatus>('published');

    // Contributors
    const [contributors, setContributors] = useState<MemoryContributor[]>([]);
    const [newContributorName, setNewContributorName] = useState('');
    const [newContributorRole, setNewContributorRole] = useState('');

    // Conclave Linking
    const [availableConclaves, setAvailableConclaves] = useState<ConclaveEvent[]>([]);
    const [selectedConclaveId, setSelectedConclaveId] = useState<string>('');
    const [relatedConclave, setRelatedConclave] = useState<RelatedConclaveSummary | null>(null);

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch completed Conclaves for the community to allow archiving
    useEffect(() => {
        if (!isOpen || !community.id) return;

        const unsub = subscribeCommunityConclaveEvents(community.id, (events) => {
            if (events && events.length > 0) {
                setAvailableConclaves(events);
            } else {
                setAvailableConclaves(getDefaultDemoConclaveEvents(community.id));
            }
        });

        return () => unsub();
    }, [isOpen, community.id]);

    // Populate state on open or edit
    useEffect(() => {
        if (!isOpen) return;

        setError(null);
        if (editingMemory) {
            setTitle(editingMemory.title || '');
            setCategory(editingMemory.category || 'milestones');
            setDate(editingMemory.date || new Date().toISOString().split('T')[0]);
            setSignificance(editingMemory.significance || 'standard');
            setDescription(editingMemory.description || '');
            setCoverImageUrl(editingMemory.coverImageUrl || '');
            setIsFeatured(Boolean(editingMemory.isFeatured));
            setStatus(editingMemory.status || 'published');
            setContributors(editingMemory.contributors || []);
            setRelatedConclave(editingMemory.relatedConclave || null);
            setSelectedConclaveId(editingMemory.relatedConclaveId || '');
        } else if (initialConclave) {
            // Pre-fill from an explicit conclave archiving action
            setTitle(`Conclave: ${initialConclave.title}`);
            setCategory('gatherings');
            setDate(initialConclave.startDate || new Date().toISOString().split('T')[0]);
            setSignificance('major');
            setDescription(initialConclave.description || '');
            setCoverImageUrl(initialConclave.coverImageUrl || '');
            setStatus('published');
            setSelectedConclaveId(initialConclave.id);
            setRelatedConclave({
                id: initialConclave.id,
                title: initialConclave.title,
                eventType: initialConclave.eventType,
                startDate: initialConclave.startDate,
                venueOrPlatform: initialConclave.eventType === 'ONSITE' ? initialConclave.onSite?.venueName : initialConclave.virtual?.platform,
                attendeeCount: initialConclave.registeredCount,
                organizerName: initialConclave.organizerInfo?.displayName,
            });
            setContributors([
                {
                    name: initialConclave.organizerInfo?.displayName || 'Conclave Organizer',
                    role: 'Organizer / Host',
                    avatarUrl: initialConclave.organizerInfo?.avatarUrl,
                }
            ]);
        } else {
            // Fresh form
            setTitle('');
            setCategory(initialCategory || 'milestones');
            setDate(new Date().toISOString().split('T')[0]);
            setSignificance('standard');
            setDescription('');
            setCoverImageUrl('');
            setIsFeatured(false);
            setStatus('published');
            setContributors([]);
            setSelectedConclaveId('');
            setRelatedConclave(null);
        }
    }, [isOpen, editingMemory, initialCategory, initialConclave]);

    if (!isOpen) return null;

    // Handle importing data from selected completed Conclave
    const handleSelectConclave = (conclaveId: string) => {
        setSelectedConclaveId(conclaveId);
        if (!conclaveId) {
            setRelatedConclave(null);
            return;
        }

        const found = availableConclaves.find((c) => c.id === conclaveId);
        if (found) {
            setRelatedConclave({
                id: found.id,
                title: found.title,
                eventType: found.eventType,
                startDate: found.startDate,
                venueOrPlatform: found.eventType === 'ONSITE' ? found.onSite?.venueName : found.virtual?.platform,
                attendeeCount: found.registeredCount,
                organizerName: found.organizerInfo?.displayName,
            });
            // Auto-fill title and description if empty
            if (!title) {
                setTitle(`Conclave: ${found.title}`);
            }
            if (!description) {
                setDescription(found.description);
            }
            if (!coverImageUrl && found.coverImageUrl) {
                setCoverImageUrl(found.coverImageUrl);
            }
            if (found.startDate) {
                setDate(found.startDate);
            }
            if (category !== 'gatherings') {
                setCategory('gatherings');
            }
        }
    };

    const handleAddContributor = () => {
        if (!newContributorName.trim()) return;
        setContributors((prev) => [
            ...prev,
            {
                name: newContributorName.trim(),
                role: newContributorRole.trim() || 'Contributor',
            },
        ]);
        setNewContributorName('');
        setNewContributorRole('');
    };

    const handleRemoveContributor = (idx: number) => {
        setContributors((prev) => prev.filter((_, i) => i !== idx));
    };

    const handleSubmit = async (submitStatus: MemoryStatus = status) => {
        if (!title.trim()) {
            setError('Please enter a memory title.');
            return;
        }
        if (!description.trim()) {
            setError('Please provide the historical description or context.');
            return;
        }
        if (!date) {
            setError('Please specify the date of occurrence.');
            return;
        }

        setError(null);
        setSubmitting(true);

        try {
            const input: CreateCollectiveMemoryInput = {
                communityId: community.id,
                communityName: community.name,
                title: title.trim(),
                description: description.trim(),
                category,
                date,
                significance,
                status: submitStatus,
                isFeatured,
                coverImageUrl: coverImageUrl.trim(),
                contributors,
                relatedConclave: relatedConclave || undefined,
                relatedConclaveId: selectedConclaveId || undefined,
            };

            await onSubmit(input, editingMemory?.id);
            onClose();
        } catch (err: any) {
            setError(err?.message || 'Failed to record collective memory.');
        } finally {
            setSubmitting(false);
        }
    };

    const categoryList = Object.values(MEMORY_CATEGORIES);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto font-mono">
            <div
                className="relative w-full max-w-2xl bg-[#0c0c0e] border border-zinc-800 shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="shrink-0 p-4 sm:p-5 bg-[#0e0f12] border-b border-zinc-800 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-amber-400"></span>
                        <h2 className="text-sm sm:text-base font-bold text-white uppercase tracking-wider">
                            {isEdit ? '// EDIT COLLECTIVE MEMORY' : '// RECORD COLLECTIVE MEMORY'}
                        </h2>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-white cursor-pointer transition-colors"
                        title="Close modal (Esc)"
                    >
                        <CloseIcon className="w-4 h-4" />
                    </button>
                </div>

                {/* Form Body */}
                <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-5">
                    {/* Error Banner */}
                    {error && (
                        <div className="p-3 bg-rose-950/70 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                            <AlertTriangleIcon className="w-4 h-4 text-rose-400 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* 1. Category Selection */}
                    <div className="space-y-2">
                        <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                            1. Select Memory Category <span className="text-rose-400">*</span>
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {categoryList.map((cat) => {
                                const isSelected = category === cat.id;
                                return (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => setCategory(cat.id)}
                                        className={`p-2.5 text-left border transition-all cursor-pointer flex flex-col gap-1 ${
                                            isSelected
                                                ? `${cat.badgeBg} ${cat.badgeBorder} ${cat.badgeText} shadow-md`
                                                : 'bg-black/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                                        }`}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <CategoryIcon category={cat.id} className="w-3.5 h-3.5" />
                                            <span className="text-xs font-bold uppercase">{cat.label}</span>
                                        </div>
                                        <span className="text-[9px] text-zinc-400 line-clamp-1 font-sans">
                                            {cat.tagline}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* 2. Title & Date */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2 space-y-1.5">
                            <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                                2. Memory Title <span className="text-rose-400">*</span>
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="E.g., Ratification of Collective Charter"
                                className="w-full px-3 py-2 bg-black border border-zinc-800 text-zinc-100 text-xs placeholder:text-zinc-600 focus:outline-none focus:border-zinc-400"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                                Date of Occurrence <span className="text-rose-400">*</span>
                            </label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full px-3 py-2 bg-black border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-zinc-400"
                            />
                        </div>
                    </div>

                    {/* 3. Significance & Prominence */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                                3. Significance Level
                            </label>
                            <select
                                value={significance}
                                onChange={(e) => setSignificance(e.target.value as MemorySignificance)}
                                className="w-full px-3 py-2 bg-black border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-zinc-400"
                            >
                                <option value="standard">Standard Historical Record</option>
                                <option value="major">Major Turning Point</option>
                                <option value="pivotal">Pivotal Defining Moment</option>
                            </select>
                        </div>

                        <div className="space-y-1.5 flex flex-col justify-end">
                            <label className="flex items-center gap-2 p-2 bg-black border border-zinc-800 cursor-pointer hover:border-zinc-700">
                                <input
                                    type="checkbox"
                                    checked={isFeatured}
                                    onChange={(e) => setIsFeatured(e.target.checked)}
                                    className="w-4 h-4 bg-zinc-950 border-zinc-700 text-amber-500 rounded-none focus:ring-0"
                                />
                                <span className="text-xs text-zinc-300 uppercase font-bold flex items-center gap-1.5">
                                    <SparklesIcon className="w-3.5 h-3.5 text-amber-400" />
                                    <span>FEATURE ON SPOTLIGHT BANNER</span>
                                </span>
                            </label>
                        </div>
                    </div>

                    {/* 4. Conclave Integration */}
                    {availableConclaves.length > 0 && (
                        <div className="p-3 bg-zinc-950 border border-zinc-800 space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <GlobeAltIcon className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>LINK COMPLETED CONCLAVE GATHERING</span>
                                </label>
                                <span className="text-[9px] text-zinc-500 uppercase">OPTIONAL INTEGRATION</span>
                            </div>

                            <select
                                value={selectedConclaveId}
                                onChange={(e) => handleSelectConclave(e.target.value)}
                                className="w-full px-3 py-2 bg-black border border-zinc-800 text-zinc-200 text-xs focus:outline-none focus:border-zinc-400"
                            >
                                <option value="">-- No linked Conclave --</option>
                                {availableConclaves.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        [{c.eventType}] {c.title} ({c.startDate})
                                    </option>
                                ))}
                            </select>
                            {selectedConclaveId && (
                                <p className="text-[10px] text-emerald-400/90 font-sans">
                                    ✓ Conclave details and organizer metadata have been linked to this memory record.
                                </p>
                            )}
                        </div>
                    )}

                    {/* 5. Historical Description / Narrative */}
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                            4. Historical Context & Narrative <span className="text-rose-400">*</span>
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={5}
                            placeholder="Detail what happened, why it matters to the collective, key discussions, decisions, and long-term impact..."
                            className="w-full px-3 py-2.5 bg-black border border-zinc-800 text-zinc-100 text-xs leading-relaxed font-sans placeholder:text-zinc-600 focus:outline-none focus:border-zinc-400 resize-y"
                        />
                    </div>

                    {/* 6. Cover Image URL */}
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block flex items-center gap-1.5">
                            <PhotoIcon className="w-3.5 h-3.5 text-zinc-500" />
                            <span>5. Cover Image URL (Optional)</span>
                        </label>
                        <input
                            type="url"
                            value={coverImageUrl}
                            onChange={(e) => setCoverImageUrl(e.target.value)}
                            placeholder="https://images.unsplash.com/..."
                            className="w-full px-3 py-2 bg-black border border-zinc-800 text-zinc-100 text-xs placeholder:text-zinc-600 focus:outline-none focus:border-zinc-400"
                        />
                        {coverImageUrl && (
                            <div className="mt-2 w-full h-28 border border-zinc-850 overflow-hidden bg-black">
                                <img
                                    src={coverImageUrl}
                                    alt="Preview"
                                    className="w-full h-full object-cover"
                                    onError={(e) => (e.currentTarget.style.display = 'none')}
                                />
                            </div>
                        )}
                    </div>

                    {/* 7. Key Contributors / Participants */}
                    <div className="space-y-2">
                        <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block flex items-center gap-1.5">
                            <UsersIcon className="w-3.5 h-3.5 text-zinc-500" />
                            <span>6. Associated Members & Key Contributors</span>
                        </label>

                        {/* Existing Contributors List */}
                        {contributors.length > 0 && (
                            <div className="space-y-1.5 mb-2">
                                {contributors.map((c, idx) => (
                                    <div
                                        key={idx}
                                        className="p-2 bg-black border border-zinc-850 flex items-center justify-between gap-2 text-xs"
                                    >
                                        <div className="flex items-center gap-2 truncate">
                                            <span className="text-white font-bold">{c.name}</span>
                                            {c.role && <span className="text-zinc-500 text-[10px]">({c.role})</span>}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveContributor(idx)}
                                            className="text-zinc-500 hover:text-rose-400 cursor-pointer"
                                        >
                                            <TrashIcon className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Add contributor row */}
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={newContributorName}
                                onChange={(e) => setNewContributorName(e.target.value)}
                                placeholder="Member name or handle"
                                className="flex-1 px-3 py-1.5 bg-black border border-zinc-800 text-zinc-100 text-xs placeholder:text-zinc-600 focus:outline-none focus:border-zinc-400"
                            />
                            <input
                                type="text"
                                value={newContributorRole}
                                onChange={(e) => setNewContributorRole(e.target.value)}
                                placeholder="Role (e.g. Lead Author)"
                                className="w-36 px-3 py-1.5 bg-black border border-zinc-800 text-zinc-100 text-xs placeholder:text-zinc-600 focus:outline-none focus:border-zinc-400"
                            />
                            <button
                                type="button"
                                onClick={handleAddContributor}
                                className="px-3 py-1.5 bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white text-xs font-bold uppercase transition-colors cursor-pointer shrink-0"
                            >
                                + ADD
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="shrink-0 p-4 bg-[#0e0f12] border-t border-zinc-800 flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="px-3.5 py-2 bg-zinc-950 border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-white text-xs uppercase font-bold transition-colors cursor-pointer"
                    >
                        CANCEL
                    </button>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            disabled={submitting}
                            onClick={() => handleSubmit('draft')}
                            className="px-3.5 py-2 bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white text-xs uppercase font-bold transition-colors cursor-pointer"
                        >
                            SAVE AS DRAFT
                        </button>
                        <button
                            type="button"
                            disabled={submitting}
                            onClick={() => handleSubmit('published')}
                            className="px-4 py-2 bg-white hover:bg-zinc-200 text-black text-xs uppercase font-bold transition-colors cursor-pointer shadow-md"
                        >
                            {submitting
                                ? 'COMMITTING ARCHIVE...'
                                : isEdit
                                ? 'UPDATE RECORD'
                                : 'PUBLISH TO MEMORY'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
