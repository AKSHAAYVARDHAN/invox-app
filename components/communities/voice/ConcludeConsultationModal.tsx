import React, { useState } from 'react';
import type { Post } from '../../../types';
import { CloseIcon, CheckBadgeIcon } from '../../ui/Icons';

interface ConcludeConsultationModalProps {
    isOpen: boolean;
    onClose: () => void;
    post: Post;
    onConclude: (summaryOutcome: string) => Promise<void>;
}

export const ConcludeConsultationModal: React.FC<ConcludeConsultationModalProps> = ({
    isOpen,
    onClose,
    post,
    onConclude,
}) => {
    const [summaryOutcome, setSummaryOutcome] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!summaryOutcome.trim()) {
            setError('Please provide a consensus synthesis or summary report.');
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            await onConclude(summaryOutcome.trim());
            onClose();
        } catch (err: any) {
            setError(err?.message || 'Failed to conclude consultation.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
            <div className="bg-[#0c0c0e] border border-zinc-800 w-full max-w-xl text-white shadow-2xl relative flex flex-col">
                <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CheckBadgeIcon className="w-5 h-5 text-emerald-400" />
                        <div>
                            <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono block">
                                CONSULTATION // CONCLUDE_AND_SYNTHESIZE
                            </span>
                            <h3 className="text-sm sm:text-base font-bold text-white uppercase tracking-wider">
                                Conclude Consultation
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

                <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 font-mono text-xs">
                    <div className="p-2.5 bg-zinc-950 border border-zinc-800 text-zinc-300 font-sans text-xs line-clamp-2">
                        {post.title}
                    </div>

                    <div>
                        <label className="text-[11px] text-zinc-400 font-bold uppercase block mb-1">
                            Consensus Synthesis Report & Outcome Summary
                        </label>
                        <p className="text-[10px] text-zinc-500 font-sans mb-2">
                            Summarize the core takeaways, member consensus, trade-offs identified, and next steps for the collective.
                        </p>
                        <textarea
                            value={summaryOutcome}
                            onChange={(e) => setSummaryOutcome(e.target.value)}
                            placeholder="State the consensus reached across member submissions..."
                            rows={5}
                            required
                            className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2 text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 font-sans text-xs leading-relaxed"
                        />
                    </div>

                    {error && (
                        <div className="p-2.5 bg-red-950/40 border border-red-800/80 text-red-300 text-xs font-sans">
                            {error}
                        </div>
                    )}

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
                            className="px-5 py-2 bg-emerald-500 text-black hover:bg-emerald-400 uppercase font-bold text-xs tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
                        >
                            {submitting ? 'Concluding...' : 'Publish Synthesis & Close'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
