import React, { useState } from 'react';
import type { Post, ProposalStatus } from '../../../types';
import { CloseIcon, ShieldCheckIcon, CheckBadgeIcon } from '../../ui/Icons';

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
            <div className="bg-[#0c0c0e] border border-zinc-800 w-full max-w-xl text-white shadow-2xl relative flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ShieldCheckIcon className="w-5 h-5 text-indigo-400" />
                        <div>
                            <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono block">
                                GOVERNANCE // STATUS_TRANSITION
                            </span>
                            <h3 className="text-sm sm:text-base font-bold text-white uppercase tracking-wider">
                                Manage Proposal Status
                            </h3>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-zinc-500 hover:text-white p-1 transition-colors cursor-pointer"
                    >
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 font-mono text-xs">
                    <div>
                        <div className="text-[11px] text-zinc-400 font-bold mb-1">PROPOSAL</div>
                        <div className="p-2.5 bg-zinc-950 border border-zinc-800 text-zinc-300 font-sans text-sm line-clamp-2">
                            {post.title}
                        </div>
                    </div>

                    <div>
                        <label className="text-[11px] text-zinc-400 font-bold uppercase block mb-2">
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
                                        className={`p-2.5 text-left border transition-all cursor-pointer ${
                                            isSelected
                                                ? 'bg-zinc-900 border-white text-white shadow-inner'
                                                : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-bold uppercase text-[11px]">{opt.label}</span>
                                            {isSelected && <span className="text-emerald-400 text-xs">●</span>}
                                        </div>
                                        <p className="text-[10px] text-zinc-500 leading-tight font-sans">
                                            {opt.desc}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Governance Note */}
                    <div>
                        <label className="text-[11px] text-zinc-400 font-bold uppercase block mb-1">
                            Governance Audit Note / Review Feedback
                        </label>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Add reason for status transition, quorum numbers, or review notes..."
                            rows={2}
                            className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-sans text-xs"
                        />
                    </div>

                    {/* Decision Outcome Recording for Approved / Implemented */}
                    {isApprovalOrImplementation && (
                        <div className="p-3 bg-emerald-950/20 border border-emerald-900/60 space-y-3">
                            <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px] uppercase">
                                <CheckBadgeIcon className="w-4 h-4" />
                                <span>Record Formal Community Decision</span>
                            </div>
                            <div>
                                <label className="text-[10px] text-zinc-400 uppercase block mb-1">
                                    Official Decision Resolution Outcome
                                </label>
                                <textarea
                                    value={decisionOutcome}
                                    onChange={(e) => setDecisionOutcome(e.target.value)}
                                    placeholder="State the enacted collective resolution and binding commitments..."
                                    rows={2}
                                    required
                                    className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 font-sans text-xs"
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                                        className="w-full bg-zinc-950 border border-zinc-800 px-3 py-1.5 text-zinc-200 text-xs focus:outline-none focus:border-emerald-500"
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
                                        className="w-full accent-emerald-500"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="p-2.5 bg-red-950/40 border border-red-800/80 text-red-300 text-xs font-sans">
                            {error}
                        </div>
                    )}

                    {/* Footer */}
                    <div className="pt-2 flex items-center justify-end gap-2 border-t border-zinc-800">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="px-4 py-2 border border-zinc-800 text-zinc-400 hover:text-white uppercase font-bold text-xs transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-5 py-2 bg-white text-black hover:bg-zinc-200 uppercase font-bold text-xs tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
                        >
                            {submitting ? 'Updating...' : 'Commit Status'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
