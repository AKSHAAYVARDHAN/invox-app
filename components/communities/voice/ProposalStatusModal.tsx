import React, { useState } from 'react';
import type { Post, ProposalStatus } from '../../../types';
import { CloseIcon, ShieldCheckIcon, CheckBadgeIcon } from '../../ui/Icons';
import { parseInlineMarkdown } from '../../ui/MarkdownRenderer';

interface ProposalStatusModalProps {
    isOpen: boolean;
    onClose: () => void;
    post: Post;
    onConfirm: (
        newStatus: ProposalStatus,
        options: {
            note?: string;
            decisionOutcome?: string;
            responsibleAuthority?: string;
            implementationProgress?: number;
        }
    ) => Promise<void>;
}

const STATUS_OPTIONS: { status: ProposalStatus; label: string; desc: string }[] = [
    { status: 'open', label: 'Open for Deliberation', desc: 'Active community discussion and member feedback.' },
    { status: 'under_review', label: 'Under Council Review', desc: 'Being formally evaluated by community council or stewards.' },
    { status: 'approved', label: 'Approved / Ratified', desc: 'Proposal accepted by collective quorum. Creates or updates formal decision.' },
    { status: 'implemented', label: 'Implemented', desc: 'Fully realized or deployed within the community.' },
    { status: 'rejected', label: 'Rejected', desc: 'Declined with formal review reasoning recorded.' },
    { status: 'withdrawn', label: 'Withdrawn', desc: 'Withdrawn from consideration by author or stewards.' },
];

export const ProposalStatusModal: React.FC<ProposalStatusModalProps> = ({
    isOpen,
    onClose,
    post,
    onConfirm,
}) => {
    const currentStatus = post.proposalMeta?.status || 'open';
    const [selectedStatus, setSelectedStatus] = useState<ProposalStatus>(currentStatus);
    const [note, setNote] = useState('');
    const [decisionOutcome, setDecisionOutcome] = useState(
        post.decisionMeta?.outcome || post.proposalMeta?.summary || post.title || ''
    );
    const [responsibleAuthority, setResponsibleAuthority] = useState(
        post.decisionMeta?.responsibleAuthority || 'Community Council'
    );
    const [implementationProgress, setImplementationProgress] = useState<number>(
        post.decisionMeta?.implementationProgress ?? (currentStatus === 'implemented' ? 100 : 50)
    );
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const isApprovalOrImplementation = selectedStatus === 'approved' || selectedStatus === 'implemented';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSubmitting(true);
        try {
            await onConfirm(selectedStatus, {
                note: note.trim() || undefined,
                decisionOutcome: isApprovalOrImplementation ? decisionOutcome.trim() : undefined,
                responsibleAuthority: isApprovalOrImplementation ? responsibleAuthority.trim() : undefined,
                implementationProgress: isApprovalOrImplementation ? implementationProgress : undefined,
            });
            onClose();
        } catch (err: any) {
            setError(err?.message || 'Failed to update proposal status.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
            <div className="bg-[#0c0c0e] border border-zinc-800 w-full max-w-xl text-white shadow-2xl relative flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <ShieldCheckIcon className="w-5 h-5 text-sky-400" />
                        <div className="space-y-0.5">
                            <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-mono block">
                                GOVERNANCE // STATUS TRANSITION
                            </span>
                            <h3 className="text-base font-semibold text-white font-sans">
                                Manage Proposal Status
                            </h3>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-zinc-500 hover:text-white p-1 transition-colors cursor-pointer"
                    >
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-xs">
                    <div>
                        <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">PROPOSAL</div>
                        <div className="p-3 bg-zinc-950 border border-zinc-850 text-zinc-200 font-sans text-xs sm:text-sm line-clamp-2 leading-relaxed">
                            {parseInlineMarkdown(post.title)}
                        </div>
                    </div>

                    <div>
                        <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block mb-2">
                            Select New Lifecycle Status
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {STATUS_OPTIONS.map((opt) => {
                                const isSelected = selectedStatus === opt.status;
                                return (
                                    <button
                                        type="button"
                                        key={opt.status}
                                        onClick={() => setSelectedStatus(opt.status)}
                                        className={`p-3 text-left border transition-all cursor-pointer ${
                                            isSelected
                                                ? 'bg-zinc-900 border-white text-white'
                                                : 'bg-zinc-950/70 border-zinc-850 text-zinc-400 hover:text-zinc-200 hover:border-zinc-750'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-mono uppercase text-[11px] font-semibold">{opt.label}</span>
                                            {isSelected && <span className="text-emerald-400 text-xs">●</span>}
                                        </div>
                                        <p className="text-[11px] text-zinc-500 leading-normal font-sans">
                                            {opt.desc}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Governance Note */}
                    <div>
                        <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block mb-1">
                            Governance Audit Note / Review Feedback
                        </label>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Add reason for status transition, quorum numbers, or review notes..."
                            rows={2}
                            className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 font-sans text-xs leading-relaxed"
                        />
                    </div>

                    {/* Decision Outcome Recording for Approved / Implemented */}
                    {isApprovalOrImplementation && (
                        <div className="p-3.5 bg-emerald-950/15 border border-emerald-800/40 space-y-3">
                            <div className="flex items-center gap-1.5 text-emerald-400 font-mono font-semibold text-[11px] uppercase tracking-wider">
                                <CheckBadgeIcon className="w-4 h-4" />
                                <span>Record Formal Community Decision</span>
                            </div>
                            <div>
                                <label className="text-[10px] font-mono text-zinc-400 uppercase block mb-1">
                                    Official Decision Resolution Outcome
                                </label>
                                <textarea
                                    value={decisionOutcome}
                                    onChange={(e) => setDecisionOutcome(e.target.value)}
                                    placeholder="State the enacted collective resolution and binding commitments..."
                                    rows={2}
                                    required
                                    className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 font-sans text-xs leading-relaxed"
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
                                <div>
                                    <label className="text-[10px] text-zinc-400 uppercase block mb-1">
                                        Responsible Authority / Working Group
                                    </label>
                                    <input
                                        type="text"
                                        value={responsibleAuthority}
                                        onChange={(e) => setResponsibleAuthority(e.target.value)}
                                        placeholder="e.g., Security Council, Treasury WG"
                                        required
                                        className="w-full h-8 bg-zinc-950 border border-zinc-800 px-3 text-zinc-200 text-xs focus:outline-none focus:border-emerald-500 font-sans"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-zinc-400 uppercase block mb-1">
                                        Implementation Progress ({implementationProgress}%)
                                    </label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        step="5"
                                        value={implementationProgress}
                                        onChange={(e) => setImplementationProgress(Number(e.target.value))}
                                        className="w-full accent-emerald-500 mt-2"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="p-3 bg-rose-950/30 border border-rose-800/50 text-rose-300 text-xs font-sans">
                            {error}
                        </div>
                    )}

                    {/* Footer */}
                    <div className="pt-3 flex items-center justify-end gap-2 border-t border-zinc-850">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="px-4 py-2 border border-zinc-800 text-zinc-400 hover:text-white uppercase font-mono text-xs transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-5 py-2 bg-white text-black hover:bg-zinc-200 uppercase font-mono font-bold text-xs tracking-wider transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                        >
                            {submitting ? 'Updating...' : 'Commit Status'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
