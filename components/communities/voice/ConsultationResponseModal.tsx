import React, { useState } from 'react';
import type { Post } from '../../../types';
import { CloseIcon, ChatIcon } from '../../ui/Icons';

interface ConsultationResponseModalProps {
    isOpen: boolean;
    onClose: () => void;
    post: Post;
    currentUserId?: string;
    onSubmit: (answers: { promptIndex: number; promptText: string; answerText: string }[]) => Promise<void>;
}

export const ConsultationResponseModal: React.FC<ConsultationResponseModalProps> = ({
    isOpen,
    onClose,
    post,
    currentUserId,
    onSubmit,
}) => {
    const consultation = post.consultationMeta;
    const prompts = consultation?.prompts || [];

    // Pre-populate if user has already responded
    const existingUserResponse = consultation?.responses?.find(r => r.userId === currentUserId);

    const [answers, setAnswers] = useState<Record<number, string>>(() => {
        const initial: Record<number, string> = {};
        if (existingUserResponse?.answers) {
            existingUserResponse.answers.forEach(a => {
                initial[a.promptIndex] = a.answerText;
            });
        }
        return initial;
    });

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen || !consultation) return null;

    const handleAnswerChange = (index: number, val: string) => {
        setAnswers(prev => ({ ...prev, [index]: val }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Ensure at least one prompt is answered
        const formatted = prompts.map((promptText, idx) => ({
            promptIndex: idx,
            promptText,
            answerText: (answers[idx] || '').trim(),
        })).filter(a => a.answerText.length > 0);

        if (formatted.length === 0) {
            setError('Please provide feedback for at least one prompt before submitting.');
            return;
        }

        setSubmitting(true);
        try {
            await onSubmit(formatted);
            onClose();
        } catch (err: any) {
            setError(err?.message || 'Failed to submit response.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
            <div className="bg-[#0c0c0e] border border-zinc-800 w-full max-w-2xl text-white shadow-2xl relative flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ChatIcon className="w-5 h-5 text-cyan-400" />
                        <div>
                            <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono block">
                                CONSULTATION // MEMBER_FEEDBACK_SUBMISSION
                            </span>
                            <h3 className="text-sm sm:text-base font-bold text-white uppercase tracking-wider">
                                Submit Consultation Input
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

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 font-mono text-xs">
                    <div className="p-3 bg-zinc-950 border border-zinc-800">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">
                            Consultation Topic
                        </span>
                        <h4 className="text-sm font-bold text-white font-sans">{post.title}</h4>
                    </div>

                    <div className="space-y-4">
                        {prompts.map((prompt, idx) => (
                            <div key={idx} className="p-3 bg-zinc-950/60 border border-zinc-800/80 space-y-2">
                                <label className="text-[11px] text-zinc-300 font-bold block leading-relaxed font-sans">
                                    <span className="text-cyan-400 font-mono mr-1.5">[{idx + 1}]</span>
                                    {prompt}
                                </label>
                                <textarea
                                    value={answers[idx] || ''}
                                    onChange={(e) => handleAnswerChange(idx, e.target.value)}
                                    placeholder="Type your perspective, observations, or trade-off analysis..."
                                    rows={3}
                                    className="w-full bg-zinc-900/60 border border-zinc-800 px-3 py-2 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-cyan-500 font-sans text-xs leading-relaxed"
                                />
                            </div>
                        ))}
                    </div>

                    {error && (
                        <div className="p-2.5 bg-red-950/40 border border-red-800/80 text-red-300 text-xs font-sans">
                            {error}
                        </div>
                    )}

                    {/* Footer */}
                    <div className="pt-3 flex items-center justify-end gap-2 border-t border-zinc-800">
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
                            className="px-5 py-2 bg-cyan-500 text-black hover:bg-cyan-400 uppercase font-bold text-xs tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
                        >
                            {submitting ? 'Submitting...' : 'Submit Member Feedback'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
