import React, { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { createPost } from '../../../services/postService';
import type { 
    Community, 
    Post, 
    CollectiveVoiceType, 
    ProposalMeta, 
    PollMeta, 
    ConsultationMeta 
} from '../../../types';
import { PostType } from '../../../types';
import { 
    CloseIcon, 
    ChatIcon, 
    ShieldCheckIcon, 
    TrendingUpIcon, 
    SparklesIcon,
    TrashIcon
} from '../../ui/Icons';

interface CreateCollectiveVoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    community: Community;
    canManage: boolean;
    initialVoiceType?: CollectiveVoiceType;
    onCreated: (newPost: Post) => void;
}

const PROPOSAL_CATEGORIES = [
    'Governance & Bylaws',
    'Treasury & Grants',
    'Protocol & Standards',
    'Infrastructure & Nodes',
    'Community Events & Conclave',
    'Moderation & Safety',
    'General Initiative',
];

const POLL_DURATIONS = [
    { label: '24 Hours', days: 1 },
    { label: '3 Days', days: 3 },
    { label: '7 Days', days: 7 },
    { label: '14 Days', days: 14 },
    { label: 'No Expiration', days: 0 },
];

export const CreateCollectiveVoiceModal: React.FC<CreateCollectiveVoiceModalProps> = ({
    isOpen,
    onClose,
    community,
    canManage,
    initialVoiceType = 'discussion',
    onCreated,
}) => {
    const { currentUser, userProfile } = useAuth();
    const [voiceType, setVoiceType] = useState<CollectiveVoiceType>(initialVoiceType);

    // Common fields
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [tagsInput, setTagsInput] = useState('');
    const [mediaUrl, setMediaUrl] = useState('');

    // Proposal-specific fields
    const [proposalCategory, setProposalCategory] = useState(PROPOSAL_CATEGORIES[0]);
    const [proposalSummary, setProposalSummary] = useState('');
    const [proposalAsDraft, setProposalAsDraft] = useState(false);

    // Poll-specific fields
    const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
    const [pollDurationDays, setPollDurationDays] = useState<number>(7);
    const [hideResultsUntilVoted, setHideResultsUntilVoted] = useState<boolean>(false);

    // Consultation-specific fields
    const [consultationPrompts, setConsultationPrompts] = useState<string[]>([
        '',
        ''
    ]);
    const [consultationDeadlineDays, setConsultationDeadlineDays] = useState<number>(7);

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleAddPollOption = () => {
        if (pollOptions.length < 8) {
            setPollOptions([...pollOptions, '']);
        }
    };

    const handleRemovePollOption = (idx: number) => {
        if (pollOptions.length > 2) {
            setPollOptions(pollOptions.filter((_, i) => i !== idx));
        }
    };

    const handlePollOptionChange = (idx: number, val: string) => {
        const next = [...pollOptions];
        next[idx] = val;
        setPollOptions(next);
    };

    const handleAddPrompt = () => {
        if (consultationPrompts.length < 5) {
            setConsultationPrompts([...consultationPrompts, '']);
        }
    };

    const handleRemovePrompt = (idx: number) => {
        if (consultationPrompts.length > 1) {
            setConsultationPrompts(consultationPrompts.filter((_, i) => i !== idx));
        }
    };

    const handlePromptChange = (idx: number, val: string) => {
        const next = [...consultationPrompts];
        next[idx] = val;
        setConsultationPrompts(next);
    };

    const resetForm = () => {
        setTitle('');
        setContent('');
        setTagsInput('');
        setMediaUrl('');
        setProposalSummary('');
        setPollOptions(['', '']);
        setConsultationPrompts(['', '']);
        setError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!title.trim()) {
            setError('Title or question statement is required.');
            return;
        }

        if (!content.trim() && voiceType !== 'poll') {
            setError('Please provide detailed body content or rationale.');
            return;
        }

        const tags = tagsInput
            .split(',')
            .map((t) => t.trim().replace(/^#/, ''))
            .filter((t) => t.length > 0);

        let proposalMeta: ProposalMeta | undefined;
        let pollMeta: PollMeta | undefined;
        let consultationMeta: ConsultationMeta | undefined;

        if (voiceType === 'proposal') {
            proposalMeta = {
                status: proposalAsDraft ? 'draft' : 'open',
                category: proposalCategory,
                summary: proposalSummary.trim() || title.trim(),
                statusHistory: [
                    {
                        status: proposalAsDraft ? 'draft' : 'open',
                        changedBy: currentUser?.uid || 'author',
                        changedByName: userProfile?.displayName || currentUser?.displayName || 'Member',
                        changedAt: new Date().toISOString(),
                        note: proposalAsDraft ? 'Saved as private draft' : 'Submitted for open deliberation',
                    },
                ],
            };
            if (!tags.includes('Proposal')) tags.unshift('Proposal');
        } else if (voiceType === 'poll') {
            const validOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
            if (validOptions.length < 2) {
                setError('Poll must contain at least 2 non-empty options.');
                return;
            }

            const expiresAt = pollDurationDays > 0
                ? new Date(Date.now() + pollDurationDays * 24 * 60 * 60 * 1000).toISOString()
                : undefined;

            pollMeta = {
                options: validOptions.map((text, i) => ({
                    id: `opt-${Date.now()}-${i}`,
                    text,
                    votes: 0,
                })),
                totalVotes: 0,
                expiresAt,
                hideResultsUntilVoted,
                voterUids: [],
                votesByOption: {},
            };
            if (!tags.includes('Poll')) tags.unshift('Poll');
        } else if (voiceType === 'consultation') {
            const validPrompts = consultationPrompts.map((p) => p.trim()).filter(Boolean);
            if (validPrompts.length === 0) {
                setError('Please provide at least one feedback prompt question for the consultation.');
                return;
            }

            const deadline = new Date(Date.now() + consultationDeadlineDays * 24 * 60 * 60 * 1000).toISOString();

            consultationMeta = {
                prompts: validPrompts,
                deadline,
                isClosed: false,
                responseCount: 0,
                responses: [],
            };
            if (!tags.includes('Consultation')) tags.unshift('Consultation');
        } else {
            if (!tags.includes('Discussion')) tags.unshift('Discussion');
        }

        setSubmitting(true);
        try {
            const created = await createPost({
                communityId: community.id,
                communityName: community.name,
                communityAvatarUrl: community.avatarUrl,
                communityHandle: community.handle,
                title: title.trim(),
                oneLine: proposalSummary.trim() || title.trim(),
                content: (content.trim() || title.trim()),
                mediaUrl: mediaUrl.trim() || undefined,
                tags,
                category: voiceType === 'proposal' ? 'Proposal' : voiceType === 'poll' ? 'Poll' : voiceType === 'consultation' ? 'Consultation' : 'Discussion',
                domain: community.category || 'Collective Voice',
                visibility: 'public',
                type: 'feed',
                voiceType,
                proposalMeta,
                pollMeta,
                consultationMeta,
                authorProfile: {
                    displayName: userProfile?.displayName || currentUser?.displayName || 'Member',
                    username: userProfile?.username || '',
                    photoURL: userProfile?.photoURL || currentUser?.photoURL || '',
                    role: canManage ? 'admin' : 'user',
                },
            });

            onCreated(created);
            resetForm();
            onClose();
        } catch (err: any) {
            console.error('[CREATE_VOICE_POST_ERR]', err);
            setError(err?.message || 'Failed to create voice record.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
            <div className="bg-[#0c0c0e] border border-zinc-800 w-full max-w-2xl text-white shadow-2xl relative flex flex-col max-h-[92vh]">
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between">
                    <div>
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono block">
                            04. COLLECTIVE VOICE // NEW_RECORD
                        </span>
                        <h3 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider">
                            Broadcast to {community.name}
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-zinc-500 hover:text-white p-1 transition-colors cursor-pointer"
                    >
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Format Selector Tabs */}
                <div className="grid grid-cols-4 border-b border-zinc-800 bg-zinc-950 font-mono text-xs">
                    {[
                        { type: 'discussion' as CollectiveVoiceType, label: 'Discussion', icon: ChatIcon },
                        { type: 'proposal' as CollectiveVoiceType, label: 'Proposal', icon: ShieldCheckIcon },
                        { type: 'poll' as CollectiveVoiceType, label: 'Poll / Vote', icon: TrendingUpIcon },
                        { type: 'consultation' as CollectiveVoiceType, label: 'Consultation', icon: SparklesIcon, adminOnly: !canManage },
                    ].map((tab) => {
                        const Icon = tab.icon;
                        const isSelected = voiceType === tab.type;
                        return (
                            <button
                                key={tab.type}
                                type="button"
                                onClick={() => setVoiceType(tab.type)}
                                className={`py-3 px-2 sm:px-3 text-center border-b-2 font-bold uppercase transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 cursor-pointer ${
                                    isSelected
                                        ? 'border-white text-white bg-zinc-900/60'
                                        : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/20'
                                }`}
                            >
                                <Icon className="w-4 h-4 flex-shrink-0" />
                                <span className="text-[11px] sm:text-xs truncate">{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 font-mono text-xs">
                    {/* Notice if consultation without admin */}
                    {voiceType === 'consultation' && !canManage && (
                        <div className="p-2.5 bg-amber-950/30 border border-amber-800/60 text-amber-300 text-[11px] font-sans">
                            Consultations are standardly launched by community stewards or authorized working groups.
                        </div>
                    )}

                    {/* Format Description Pill */}
                    <div className="text-[11px] text-zinc-400 font-sans bg-zinc-950/80 border border-zinc-800/80 p-2.5">
                        {voiceType === 'discussion' && (
                            <span>💡 <strong>Standard Discussion:</strong> Share questions, research findings, architectural trade-offs, and ideas with the collective.</span>
                        )}
                        {voiceType === 'proposal' && (
                            <span>🏛️ <strong>Formal Proposal:</strong> Submit a binding proposal for governance, budget allocation, protocol standards, or collective action.</span>
                        )}
                        {voiceType === 'poll' && (
                            <span>📊 <strong>Community Poll:</strong> Gather instantaneous quorum and sentiment through single-choice voting with duplicate-prevention.</span>
                        )}
                        {voiceType === 'consultation' && (
                            <span>📋 <strong>Stakeholder Consultation:</strong> Publish structured prompt questions to gather qualitative submissions from members prior to codifying policy.</span>
                        )}
                    </div>

                    {/* Title */}
                    <div>
                        <label className="text-[11px] text-zinc-400 font-bold uppercase block mb-1">
                            {voiceType === 'poll' ? 'Poll Question / Statement *' : voiceType === 'proposal' ? 'Proposal Title / Designation *' : voiceType === 'consultation' ? 'Consultation Theme *' : 'Discussion Topic *'}
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder={
                                voiceType === 'proposal'
                                    ? 'e.g. CIP-24: Establish Community Open-Source Grant Treasury'
                                    : voiceType === 'poll'
                                    ? 'e.g. Which programming language should anchor our Q3 Hackathon?'
                                    : voiceType === 'consultation'
                                    ? 'e.g. INVOX Node Verification & Hardware Standards'
                                    : 'e.g. Trade-offs in Rust vs Zig for low-latency telemetry'
                            }
                            required
                            className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2 text-white placeholder-zinc-600 focus:outline-none focus:border-white font-sans text-xs"
                        />
                    </div>

                    {/* Proposal-specific category & summary */}
                    {voiceType === 'proposal' && (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] text-zinc-400 font-bold uppercase block mb-1">
                                        Proposal Scope / Category
                                    </label>
                                    <select
                                        value={proposalCategory}
                                        onChange={(e) => setProposalCategory(e.target.value)}
                                        className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2 text-zinc-200 text-xs focus:outline-none focus:border-white"
                                    >
                                        {PROPOSAL_CATEGORIES.map((cat) => (
                                            <option key={cat} value={cat}>
                                                {cat}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[11px] text-zinc-400 font-bold uppercase block mb-1">
                                        Initial Status
                                    </label>
                                    <div className="flex items-center gap-3 pt-2">
                                        <label className="flex items-center gap-1.5 cursor-pointer text-zinc-300">
                                            <input
                                                type="radio"
                                                name="initialStatus"
                                                checked={!proposalAsDraft}
                                                onChange={() => setProposalAsDraft(false)}
                                                className="accent-white"
                                            />
                                            <span>Open for Deliberation</span>
                                        </label>
                                        <label className="flex items-center gap-1.5 cursor-pointer text-zinc-400">
                                            <input
                                                type="radio"
                                                name="initialStatus"
                                                checked={proposalAsDraft}
                                                onChange={() => setProposalAsDraft(true)}
                                                className="accent-white"
                                            />
                                            <span>Private Draft</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="text-[11px] text-zinc-400 font-bold uppercase block mb-1">
                                    Executive Summary (One-liner)
                                </label>
                                <input
                                    type="text"
                                    value={proposalSummary}
                                    onChange={(e) => setProposalSummary(e.target.value)}
                                    placeholder="Brief, high-impact summary of what this proposal achieves..."
                                    className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2 text-white placeholder-zinc-600 focus:outline-none focus:border-white font-sans text-xs"
                                />
                            </div>
                        </>
                    )}

                    {/* Poll-specific options and settings */}
                    {voiceType === 'poll' && (
                        <div className="p-3 bg-zinc-950 border border-zinc-800 space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-[11px] text-zinc-400 font-bold uppercase">
                                    Poll Options ({pollOptions.length} of 8)
                                </label>
                                {pollOptions.length < 8 && (
                                    <button
                                        type="button"
                                        onClick={handleAddPollOption}
                                        className="text-cyan-400 hover:text-cyan-300 text-[11px] uppercase font-bold cursor-pointer"
                                    >
                                        + Add Option
                                    </button>
                                )}
                            </div>

                            <div className="space-y-2">
                                {pollOptions.map((opt, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <span className="text-zinc-500 text-xs w-4">{idx + 1}.</span>
                                        <input
                                            type="text"
                                            value={opt}
                                            onChange={(e) => handlePollOptionChange(idx, e.target.value)}
                                            placeholder={`Option ${idx + 1}`}
                                            className="flex-1 bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500 font-sans text-xs"
                                        />
                                        {pollOptions.length > 2 && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemovePollOption(idx)}
                                                className="text-zinc-500 hover:text-red-400 p-1"
                                            >
                                                <TrashIcon className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-zinc-800/80">
                                <div>
                                    <label className="text-[10px] text-zinc-400 uppercase block mb-1">
                                        Voting Duration
                                    </label>
                                    <select
                                        value={pollDurationDays}
                                        onChange={(e) => setPollDurationDays(Number(e.target.value))}
                                        className="w-full bg-zinc-900 border border-zinc-800 px-2.5 py-1.5 text-zinc-200 text-xs"
                                    >
                                        {POLL_DURATIONS.map((dur) => (
                                            <option key={dur.days} value={dur.days}>
                                                {dur.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex items-center gap-2 pt-4">
                                    <input
                                        type="checkbox"
                                        id="hideResultsToggle"
                                        checked={hideResultsUntilVoted}
                                        onChange={(e) => setHideResultsUntilVoted(e.target.checked)}
                                        className="accent-cyan-500 cursor-pointer"
                                    />
                                    <label htmlFor="hideResultsToggle" className="text-[11px] text-zinc-300 font-sans cursor-pointer">
                                        Hide results until member votes
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Consultation-specific prompts */}
                    {voiceType === 'consultation' && (
                        <div className="p-3 bg-zinc-950 border border-zinc-800 space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-[11px] text-zinc-400 font-bold uppercase">
                                    Prompt Questions For Members ({consultationPrompts.length} of 5)
                                </label>
                                {consultationPrompts.length < 5 && (
                                    <button
                                        type="button"
                                        onClick={handleAddPrompt}
                                        className="text-cyan-400 hover:text-cyan-300 text-[11px] uppercase font-bold cursor-pointer"
                                    >
                                        + Add Question
                                    </button>
                                )}
                            </div>

                            <div className="space-y-2">
                                {consultationPrompts.map((prompt, idx) => (
                                    <div key={idx} className="flex items-start gap-2">
                                        <span className="text-zinc-500 text-xs mt-2 w-4">Q{idx + 1}.</span>
                                        <input
                                            type="text"
                                            value={prompt}
                                            onChange={(e) => handlePromptChange(idx, e.target.value)}
                                            placeholder={`Prompt Question ${idx + 1} (e.g. What uptime threshold is acceptable?)`}
                                            className="flex-1 bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500 font-sans text-xs"
                                        />
                                        {consultationPrompts.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemovePrompt(idx)}
                                                className="text-zinc-500 hover:text-red-400 p-1 mt-1.5"
                                            >
                                                <TrashIcon className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="pt-2 border-t border-zinc-800/80">
                                <label className="text-[10px] text-zinc-400 uppercase block mb-1">
                                    Consultation Deadline
                                </label>
                                <select
                                    value={consultationDeadlineDays}
                                    onChange={(e) => setConsultationDeadlineDays(Number(e.target.value))}
                                    className="w-full sm:w-1/2 bg-zinc-900 border border-zinc-800 px-2.5 py-1.5 text-zinc-200 text-xs"
                                >
                                    <option value={3}>3 Days</option>
                                    <option value={7}>7 Days (Recommended)</option>
                                    <option value={14}>14 Days</option>
                                    <option value={30}>30 Days</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {/* Main Content Body */}
                    <div>
                        <label className="text-[11px] text-zinc-400 font-bold uppercase block mb-1">
                            {voiceType === 'proposal' ? 'Proposal Specification & Motivation *' : voiceType === 'poll' ? 'Background Context (Optional)' : voiceType === 'consultation' ? 'Consultation Background & Objective *' : 'Discussion Content *'}
                        </label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder={
                                voiceType === 'proposal'
                                    ? 'Detail the problem statement, proposed solution, resources needed, and milestone timeline...'
                                    : voiceType === 'poll'
                                    ? 'Explain the context or considerations behind this vote...'
                                    : voiceType === 'consultation'
                                    ? 'Provide the architectural context, requirements, and background for these questions...'
                                    : 'Share your thoughts, insights, benchmarks, or discussion points...'
                            }
                            rows={voiceType === 'poll' ? 3 : 6}
                            required={voiceType !== 'poll'}
                            className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2 text-white placeholder-zinc-600 focus:outline-none focus:border-white font-sans text-xs leading-relaxed"
                        />
                    </div>

                    {/* Media URL & Tags */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="text-[11px] text-zinc-400 font-bold uppercase block mb-1">
                                Optional Media / Reference URL
                            </label>
                            <input
                                type="url"
                                value={mediaUrl}
                                onChange={(e) => setMediaUrl(e.target.value)}
                                placeholder="https://example.com/spec.png"
                                className="w-full bg-zinc-950 border border-zinc-800 px-3 py-1.5 text-white placeholder-zinc-600 focus:outline-none focus:border-white font-sans text-xs"
                            />
                        </div>
                        <div>
                            <label className="text-[11px] text-zinc-400 font-bold uppercase block mb-1">
                                Tags (comma-separated)
                            </label>
                            <input
                                type="text"
                                value={tagsInput}
                                onChange={(e) => setTagsInput(e.target.value)}
                                placeholder="Governance, Treasury, Rust"
                                className="w-full bg-zinc-950 border border-zinc-800 px-3 py-1.5 text-white placeholder-zinc-600 focus:outline-none focus:border-white font-sans text-xs"
                            />
                        </div>
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
                            className="px-6 py-2 bg-white text-black hover:bg-zinc-200 uppercase font-bold text-xs tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
                        >
                            {submitting ? 'Publishing...' : `Publish ${voiceType === 'proposal' ? 'Proposal' : voiceType === 'poll' ? 'Poll' : voiceType === 'consultation' ? 'Consultation' : 'Discussion'}`}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
