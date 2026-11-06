import React, { useState } from 'react';
import type { CollectiveMemory } from '../../../services/collectiveMemoryTypes';
import { MEMORY_CATEGORIES } from '../../../services/collectiveMemoryTypes';
import { MemoryCategoryBadge, SignificanceBadge, MemoryStatusBadge } from './MemoryCategoryBadge';
import {
    CloseIcon,
    CalendarDaysIcon,
    UsersIcon,
    PencilSquareIcon,
    TrashIcon,
    GlobeAltIcon,
    MapPinIcon,
    DocumentTextIcon,
    ArrowUpRightIcon,
    ShieldCheckIcon,
    AlertTriangleIcon,
    PinIcon,
    PinSolidIcon,
} from '../../ui/Icons';
import { handleImageError } from '../../utils/imageUtils';

interface MemoryDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    memory: CollectiveMemory | null;
    canManage: boolean;
    onEdit?: (memory: CollectiveMemory) => void;
    onDelete?: (memoryId: string) => Promise<void>;
    onStatusChange?: (memoryId: string, status: 'published' | 'draft' | 'archived') => Promise<void>;
    onOpenConclave?: (conclaveId: string) => void;
    onTogglePin?: (memory: CollectiveMemory) => Promise<void>;
}

export const MemoryDetailModal: React.FC<MemoryDetailModalProps> = ({
    isOpen,
    onClose,
    memory,
    canManage,
    onEdit,
    onDelete,
    onStatusChange,
    onOpenConclave,
    onTogglePin,
}) => {
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    if (!isOpen || !memory) return null;

    const categoryMeta = MEMORY_CATEGORIES[memory.category] || MEMORY_CATEGORIES.milestones;

    const formatDateDisplay = (dateStr: string) => {
        try {
            const [y, m, d] = dateStr.split('-');
            if (y && m && d) {
                const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
                return date.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                }).toUpperCase();
            }
        } catch {
            // Fallback
        }
        return dateStr;
    };

    const handleDelete = async () => {
        if (!onDelete) return;
        setIsDeleting(true);
        try {
            await onDelete(memory.id);
            setConfirmDelete(false);
            onClose();
        } catch (err) {
            console.error('Failed to delete memory:', err);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleToggleArchive = async () => {
        if (!onStatusChange) return;
        setActionLoading(true);
        try {
            const nextStatus = memory.status === 'archived' ? 'published' : 'archived';
            await onStatusChange(memory.id, nextStatus);
        } catch (err) {
            console.error('Failed to update status:', err);
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto font-mono">
            <div
                className="relative w-full max-w-3xl bg-[#0c0c0e] border border-zinc-800 shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="shrink-0 p-4 sm:p-5 bg-[#0e0f12] border-b border-zinc-800 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                        {memory.isFeatured && (
                            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest bg-amber-950/60 px-2 py-0.5 border border-amber-500/40 flex items-center gap-1">
                                <PinSolidIcon className="w-3 h-3 text-amber-400" />
                                <span>PINNED FEATURED</span>
                            </span>
                        )}
                        <MemoryCategoryBadge category={memory.category} size="md" />
                        <SignificanceBadge significance={memory.significance} size="md" />
                        <MemoryStatusBadge status={memory.status} />
                    </div>

                    <div className="flex items-center gap-2">
                        {canManage && onEdit && (
                            <button
                                type="button"
                                onClick={() => {
                                    onClose();
                                    onEdit(memory);
                                }}
                                className="px-2.5 py-1 bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                                title="Edit Memory Record"
                            >
                                <PencilSquareIcon className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">EDIT</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-white cursor-pointer transition-colors"
                            title="Close modal (Esc)"
                        >
                            <CloseIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Modal Scrollable Body */}
                <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-5">
                    {/* Cover Image Banner if present */}
                    {memory.coverImageUrl && (
                        <div className="relative w-full h-48 sm:h-64 border border-zinc-800 bg-black overflow-hidden">
                            <img
                                src={memory.coverImageUrl}
                                alt={memory.title}
                                onError={handleImageError}
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent"></div>
                            <div className="absolute bottom-3 left-3 flex items-center gap-2 text-[10px] text-zinc-300 bg-black/80 px-2.5 py-1 border border-zinc-700">
                                <CalendarDaysIcon className="w-3.5 h-3.5 text-zinc-400" />
                                <span>{formatDateDisplay(memory.date)}</span>
                            </div>
                        </div>
                    )}

                    {/* Title & Date Metadata */}
                    <div className="space-y-2">
                        {!memory.coverImageUrl && (
                            <div className="flex items-center gap-2 text-xs text-zinc-400">
                                <CalendarDaysIcon className="w-4 h-4 text-zinc-400" />
                                <span>{formatDateDisplay(memory.date)}</span>
                            </div>
                        )}
                        <h2 className="text-lg sm:text-2xl font-bold text-white uppercase tracking-wide leading-tight">
                            {memory.title}
                        </h2>
                    </div>

                    {/* Historical Context & Narrative Description */}
                    <div className="p-4 sm:p-5 bg-black/70 border border-zinc-850 space-y-3 font-sans text-sm leading-relaxed text-zinc-300">
                        <div className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest border-b border-zinc-800 pb-2 flex items-center gap-2">
                            <ShieldCheckIcon className="w-3.5 h-3.5 text-zinc-400" />
                            <span>HISTORICAL CONTEXT & NARRATIVE</span>
                        </div>
                        <div className="whitespace-pre-line break-words space-y-3 pt-1">
                            {memory.description}
                        </div>
                    </div>

                    {/* Related Conclave Gathering Bridge */}
                    {memory.relatedConclave && (
                        <div className="p-4 bg-zinc-950 border border-zinc-800 space-y-3">
                            <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
                                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                                    <GlobeAltIcon className="w-3.5 h-3.5" />
                                    <span>ARCHIVED CONCLAVE RECORD</span>
                                </span>
                                <span className="text-[10px] text-zinc-500 uppercase">
                                    {memory.relatedConclave.eventType} GATHERING
                                </span>
                            </div>

                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="space-y-1">
                                    <h4 className="text-white font-bold text-xs uppercase">
                                        {memory.relatedConclave.title}
                                    </h4>
                                    <div className="flex items-center gap-3 text-[11px] text-zinc-400 flex-wrap">
                                        {memory.relatedConclave.venueOrPlatform && (
                                            <span className="flex items-center gap-1">
                                                <MapPinIcon className="w-3 h-3 text-zinc-500" />
                                                <span>{memory.relatedConclave.venueOrPlatform}</span>
                                            </span>
                                        )}
                                        {typeof memory.relatedConclave.attendeeCount === 'number' && (
                                            <span className="flex items-center gap-1">
                                                <UsersIcon className="w-3 h-3 text-zinc-500" />
                                                <span>{memory.relatedConclave.attendeeCount} PARTICIPANTS</span>
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {onOpenConclave && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onClose();
                                            onOpenConclave(memory.relatedConclave!.id);
                                        }}
                                        className="px-3 py-1.5 bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-zinc-200 hover:text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shrink-0"
                                    >
                                        <span>VIEW CONCLAVE</span>
                                        <ArrowUpRightIcon className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Associated Members & Contributors */}
                    {memory.contributors && memory.contributors.length > 0 && (
                        <div className="space-y-3">
                            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                                <UsersIcon className="w-4 h-4 text-zinc-500" />
                                <span>KEY CONTRIBUTORS & PARTICIPANTS ({memory.contributors.length})</span>
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {memory.contributors.map((c, idx) => (
                                    <div
                                        key={c.uid || idx}
                                        className="p-2.5 bg-black border border-zinc-850 flex items-center gap-3"
                                    >
                                        <div className="w-8 h-8 rounded-none bg-zinc-900 border border-zinc-700 overflow-hidden flex items-center justify-center shrink-0">
                                            {c.avatarUrl ? (
                                                <img
                                                    src={c.avatarUrl}
                                                    alt={c.name}
                                                    onError={handleImageError}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <span className="text-[10px] font-bold text-zinc-400">
                                                    {c.name.slice(0, 2).toUpperCase()}
                                                </span>
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-bold text-white uppercase truncate">
                                                {c.name}
                                            </p>
                                            {c.role && (
                                                <p className="text-[10px] text-zinc-400 truncate">
                                                    {c.role}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Media Attachments Gallery */}
                    {memory.attachments && memory.attachments.length > 0 && (
                        <div className="space-y-3">
                            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                                <DocumentTextIcon className="w-4 h-4 text-zinc-500" />
                                <span>RECORDED ATTACHMENTS & ASSETS ({memory.attachments.length})</span>
                            </h4>
                            <div className="space-y-2">
                                {memory.attachments.map((att) => (
                                    <a
                                        key={att.id}
                                        href={att.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-3 bg-black border border-zinc-800 hover:border-zinc-500 transition-colors flex items-center justify-between gap-3 text-xs text-zinc-300 hover:text-white cursor-pointer group"
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <DocumentTextIcon className="w-4 h-4 text-zinc-500 group-hover:text-white shrink-0" />
                                            <span className="truncate">{att.name}</span>
                                        </div>
                                        <span className="text-[10px] text-zinc-500 uppercase shrink-0 flex items-center gap-1">
                                            <span>OPEN</span>
                                            <ArrowUpRightIcon className="w-3 h-3" />
                                        </span>
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Record Attribution & Audit Log */}
                    <div className="pt-3 border-t border-zinc-850 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[10px] text-zinc-500">
                        <div>
                            <span>ARCHIVED BY: </span>
                            <span className="text-zinc-300 font-bold uppercase">{memory.creatorInfo?.displayName || 'COLLECTIVE'}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span>RECORD ID: #{memory.id.slice(0, 8)}</span>
                        </div>
                    </div>

                    {/* Delete Confirmation Warning */}
                    {confirmDelete && (
                        <div className="p-4 bg-rose-950/60 border border-rose-800 space-y-3">
                            <div className="flex items-center gap-2 text-rose-300 text-xs font-bold uppercase">
                                <AlertTriangleIcon className="w-4 h-4 text-rose-400" />
                                <span>CONFIRM PERMANENT DELETION OF THIS MEMORY</span>
                            </div>
                            <p className="text-xs text-rose-200/80 leading-relaxed font-sans">
                                This will permanently remove this record from the collective's historical archive. This action cannot be reversed.
                            </p>
                            <div className="flex items-center gap-2 pt-1">
                                <button
                                    type="button"
                                    disabled={isDeleting}
                                    onClick={handleDelete}
                                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase cursor-pointer"
                                >
                                    {isDeleting ? 'DELETING...' : 'YES, DELETE MEMORY'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setConfirmDelete(false)}
                                    className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white text-xs uppercase cursor-pointer"
                                >
                                    CANCEL
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Modal Footer Actions */}
                <div className="shrink-0 p-4 bg-[#0e0f12] border-t border-zinc-800 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        {canManage && onDelete && !confirmDelete && (
                            <button
                                type="button"
                                onClick={() => setConfirmDelete(true)}
                                className="px-3 py-1.5 bg-zinc-950 border border-zinc-800 hover:border-rose-800 text-zinc-400 hover:text-rose-400 text-xs uppercase font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                            >
                                <TrashIcon className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">DELETE</span>
                            </button>
                        )}
                        {canManage && onStatusChange && (
                            <button
                                type="button"
                                disabled={actionLoading}
                                onClick={handleToggleArchive}
                                className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-300 hover:text-white text-xs uppercase font-bold transition-colors cursor-pointer"
                            >
                                {memory.status === 'archived' ? 'UNARCHIVE TO TIMELINE' : 'ARCHIVE RECORD'}
                            </button>
                        )}
                        {canManage && onTogglePin && memory.status === 'published' && (
                            <button
                                type="button"
                                disabled={actionLoading}
                                onClick={async () => {
                                    if (!onTogglePin) return;
                                    setActionLoading(true);
                                    try {
                                        await onTogglePin(memory);
                                    } finally {
                                        setActionLoading(false);
                                    }
                                }}
                                className={`px-3 py-1.5 border text-xs uppercase font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                                    memory.isFeatured
                                        ? 'bg-amber-950/60 border-amber-500/60 text-amber-300 hover:bg-amber-900/60 hover:text-white'
                                        : 'bg-zinc-900 border-zinc-700 hover:border-amber-500/60 text-zinc-300 hover:text-amber-200'
                                }`}
                                title={memory.isFeatured ? 'Unpin this memory from Featured Spotlight' : 'Pin this memory as the Featured Spotlight'}
                            >
                                <PinIcon className="w-3.5 h-3.5 text-amber-400" />
                                <span>{memory.isFeatured ? 'UNPIN FROM FEATURED' : 'PIN AS FEATURED'}</span>
                            </button>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-white hover:bg-zinc-200 text-black font-bold text-xs uppercase transition-colors cursor-pointer"
                    >
                        CLOSE
                    </button>
                </div>
            </div>
        </div>
    );
};
