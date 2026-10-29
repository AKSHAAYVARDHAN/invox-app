import React, { useState } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
    createCommunity, 
    sanitizeHandle, 
    COMMUNITY_DOMAINS,
    CreateCommunityInput 
} from '../../services/communityService';
import { 
    CloseIcon, 
    SparklesIcon, 
    UsersIcon, 
    ShieldCheckIcon, 
    GlobeAltIcon, 
    LockClosedIcon,
    CheckCircleIcon 
} from '../ui/Icons';

interface CreateCommunityModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated?: (communityId: string) => void;
}

export const CreateCommunityModal: React.FC<CreateCommunityModalProps> = ({
    isOpen,
    onClose,
    onCreated,
}) => {
    const { currentUser, userProfile } = useAuth();
    const navigate = ReactRouterDOM.useNavigate();

    const [step, setStep] = useState<1 | 2>(1);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [createdCommunityId, setCreatedCommunityId] = useState<string | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [handle, setHandle] = useState('');
    const [description, setDescription] = useState('');
    const [purpose, setPurpose] = useState('');
    const [category, setCategory] = useState<string>(COMMUNITY_DOMAINS[0].name);
    const [topicsInput, setTopicsInput] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [bannerUrl, setBannerUrl] = useState('');
    const [foundingStory, setFoundingStory] = useState('');
    const [valuesInput, setValuesInput] = useState('');
    const [guidelinesInput, setGuidelinesInput] = useState('');
    const [visibility, setVisibility] = useState<'public' | 'private'>('public');
    const [joinPolicy, setJoinPolicy] = useState<'open' | 'approval_required'>('open');

    if (!isOpen) return null;

    const handleNameChange = (val: string) => {
        setName(val);
        if (!handle || handle === sanitizeHandle(name)) {
            setHandle(sanitizeHandle(val));
        }
    };

    const handleNext = () => {
        setError(null);
        if (!name.trim()) {
            setError("Please provide a name for the collective.");
            return;
        }
        if (!handle.trim()) {
            setError("Please provide a unique handle.");
            return;
        }
        if (!description.trim() || description.trim().length < 20) {
            setError("Please provide an informative description (at least 20 characters).");
            return;
        }
        setStep(2);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!currentUser) {
            setError("You must be signed in to create a collective.");
            return;
        }

        setSubmitting(true);
        try {
            const topics = topicsInput
                .split(',')
                .map(t => t.trim())
                .filter(Boolean);

            const values = valuesInput
                .split('\n')
                .map(v => v.trim())
                .filter(Boolean);

            const guidelines = guidelinesInput
                .split('\n')
                .map(g => g.trim())
                .filter(Boolean);

            const payload: CreateCommunityInput = {
                name: name.trim(),
                handle: sanitizeHandle(handle),
                description: description.trim(),
                purpose: purpose.trim() || description.trim(),
                category,
                topics,
                avatarUrl: avatarUrl.trim() || undefined,
                bannerUrl: bannerUrl.trim() || undefined,
                foundingStory: foundingStory.trim() || undefined,
                values: values.length > 0 ? values : undefined,
                guidelines: guidelines.length > 0 ? guidelines : undefined,
                visibility,
                joinPolicy,
            };

            const userActor = userProfile || currentUser;
            const created = await createCommunity(payload, userActor);

            setCreatedCommunityId(created.id);
            if (onCreated) {
                onCreated(created.id);
            }
        } catch (err: any) {
            console.error('[CREATE_COMMUNITY_FAILED]', err);
            setError(err?.message || "Failed to establish community collective. Please check your network.");
        } finally {
            setSubmitting(false);
        }
    };

    const resetAndClose = () => {
        setStep(1);
        setName('');
        setHandle('');
        setDescription('');
        setPurpose('');
        setTopicsInput('');
        setAvatarUrl('');
        setBannerUrl('');
        setFoundingStory('');
        setValuesInput('');
        setGuidelinesInput('');
        setVisibility('public');
        setJoinPolicy('open');
        setError(null);
        setCreatedCommunityId(null);
        onClose();
    };

    const handleViewCommunity = () => {
        if (createdCommunityId) {
            const targetId = createdCommunityId;
            resetAndClose();
            navigate(`/communities/${targetId}`);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
            <div className="bg-[#0c0c0e] border border-zinc-800 w-full max-w-2xl max-h-[90vh] flex flex-col font-mono text-xs shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-black/60">
                    <div className="flex items-center gap-2">
                        <UsersIcon className="w-4 h-4 text-emerald-400" />
                        <h2 className="font-bold text-white uppercase tracking-wider text-sm">
                            // ESTABLISH_COMMUNITY_COLLECTIVE
                        </h2>
                    </div>
                    <button
                        onClick={resetAndClose}
                        className="text-zinc-500 hover:text-white transition-colors p-1"
                        aria-label="Close"
                    >
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto no-scrollbar flex-1 space-y-6">
                    {createdCommunityId ? (
                        <div className="text-center py-8 space-y-4">
                            <div className="w-12 h-12 bg-emerald-950/60 border border-emerald-500 text-emerald-400 flex items-center justify-center mx-auto">
                                <CheckCircleIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-white font-bold text-base uppercase">// COLLECTIVE_ESTABLISHED</h3>
                                <p className="text-zinc-400 text-xs mt-1 max-w-md mx-auto">
                                    Your community collective has been initialized with verified ownership and membership records.
                                </p>
                            </div>
                            <div className="p-3 bg-black border border-zinc-800 max-w-md mx-auto text-left">
                                <div className="text-zinc-500 text-[10px] uppercase">// CANONICAL_HANDLE</div>
                                <div className="text-emerald-400 font-bold mt-0.5">@{sanitizeHandle(handle)}</div>
                                <div className="text-zinc-400 text-[11px] mt-1">{name}</div>
                            </div>
                            <div className="pt-4 flex justify-center gap-3">
                                <button
                                    type="button"
                                    onClick={resetAndClose}
                                    className="px-4 py-2 bg-zinc-900 border border-zinc-800 text-zinc-300 uppercase hover:text-white hover:border-zinc-700 transition-colors"
                                >
                                    Dismiss
                                </button>
                                <button
                                    type="button"
                                    onClick={handleViewCommunity}
                                    className="px-6 py-2 bg-white text-black font-bold uppercase hover:bg-zinc-200 transition-colors"
                                >
                                    Open Community Profile →
                                </button>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Progress Indicator */}
                            <div className="flex items-center justify-between border-b border-zinc-850 pb-3 text-[11px]">
                                <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 border ${step === 1 ? 'border-white text-white font-bold bg-zinc-900' : 'border-zinc-800 text-zinc-500'}`}>
                                        01. FOUNDATIONAL_DETAILS
                                    </span>
                                    <span className="text-zinc-700">/</span>
                                    <span className={`px-2 py-0.5 border ${step === 2 ? 'border-white text-white font-bold bg-zinc-900' : 'border-zinc-800 text-zinc-500'}`}>
                                        02. COLLECTIVE_IDENTITY
                                    </span>
                                </div>
                                <span className="text-zinc-500">STEP {step} OF 2</span>
                            </div>

                            {error && (
                                <div className="p-3 bg-red-950/40 border border-red-800 text-red-300 text-xs">
                                    [VALIDATION_ERROR]: {error}
                                </div>
                            )}

                            {step === 1 && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-zinc-400 uppercase text-[10px] tracking-wider mb-1.5">
                                            Collective Name *
                                        </label>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => handleNameChange(e.target.value)}
                                            placeholder="e.g. Systems Architecture Collective"
                                            className="w-full bg-black border border-zinc-800 p-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
                                            maxLength={80}
                                            required
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-zinc-400 uppercase text-[10px] tracking-wider mb-1.5">
                                                Unique Handle / Slug *
                                            </label>
                                            <div className="flex items-center bg-black border border-zinc-800 focus-within:border-zinc-600">
                                                <span className="px-2.5 text-zinc-500">@</span>
                                                <input
                                                    type="text"
                                                    value={handle}
                                                    onChange={(e) => setHandle(sanitizeHandle(e.target.value))}
                                                    placeholder="systems-arch"
                                                    className="w-full bg-transparent p-2 text-white placeholder-zinc-600 focus:outline-none"
                                                    maxLength={40}
                                                    required
                                                />
                                            </div>
                                            <span className="text-[10px] text-zinc-600 mt-1 block">Used for collective URL routing</span>
                                        </div>

                                        <div>
                                            <label className="block text-zinc-400 uppercase text-[10px] tracking-wider mb-1.5">
                                                Domain Category *
                                            </label>
                                            <select
                                                value={category}
                                                onChange={(e) => setCategory(e.target.value)}
                                                className="w-full bg-black border border-zinc-800 p-2.5 text-white focus:outline-none focus:border-zinc-600"
                                            >
                                                {COMMUNITY_DOMAINS.map(d => (
                                                    <option key={d.slug} value={d.name}>{d.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-zinc-400 uppercase text-[10px] tracking-wider mb-1.5">
                                            Description & Purpose *
                                        </label>
                                        <textarea
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            placeholder="Describe the shared identity, belonging, and core activities of this collective..."
                                            rows={3}
                                            className="w-full bg-black border border-zinc-800 p-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 resize-none"
                                            maxLength={400}
                                            required
                                        />
                                        <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
                                            <span>Explain why members gather and what binds them together.</span>
                                            <span>{description.length}/400</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                        <div className="border border-zinc-800 p-3 bg-black/40">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-[10px] uppercase font-bold text-zinc-400 flex items-center gap-1.5">
                                                    <GlobeAltIcon className="w-3.5 h-3.5" /> Discovery Visibility
                                                </span>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="visibility"
                                                        value="public"
                                                        checked={visibility === 'public'}
                                                        onChange={() => setVisibility('public')}
                                                        className="text-white"
                                                    />
                                                    <span className="text-zinc-300">Public (Discoverable)</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="visibility"
                                                        value="private"
                                                        checked={visibility === 'private'}
                                                        onChange={() => setVisibility('private')}
                                                        className="text-white"
                                                    />
                                                    <span className="text-zinc-300">Private (Restricted)</span>
                                                </label>
                                            </div>
                                        </div>

                                        <div className="border border-zinc-800 p-3 bg-black/40">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-[10px] uppercase font-bold text-zinc-400 flex items-center gap-1.5">
                                                    <ShieldCheckIcon className="w-3.5 h-3.5" /> Joining Policy
                                                </span>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="joinPolicy"
                                                        value="open"
                                                        checked={joinPolicy === 'open'}
                                                        onChange={() => setJoinPolicy('open')}
                                                        className="text-white"
                                                    />
                                                    <span className="text-zinc-300">Direct Joining (Open)</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="joinPolicy"
                                                        value="approval_required"
                                                        checked={joinPolicy === 'approval_required'}
                                                        onChange={() => setJoinPolicy('approval_required')}
                                                        className="text-white"
                                                    />
                                                    <span className="text-zinc-300">Approval Required (Vetted)</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {step === 2 && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-zinc-400 uppercase text-[10px] tracking-wider mb-1.5">
                                            Emblem / Avatar URL (Optional)
                                        </label>
                                        <input
                                            type="url"
                                            value={avatarUrl}
                                            onChange={(e) => setAvatarUrl(e.target.value)}
                                            placeholder="https://images.unsplash.com/..."
                                            className="w-full bg-black border border-zinc-800 p-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
                                        />
                                        <span className="text-[10px] text-zinc-600 mt-1 block">A square insignia or emblem representing this collective.</span>
                                    </div>

                                    <div>
                                        <label className="block text-zinc-400 uppercase text-[10px] tracking-wider mb-1.5">
                                            Topic Tags (Optional, comma-separated)
                                        </label>
                                        <input
                                            type="text"
                                            value={topicsInput}
                                            onChange={(e) => setTopicsInput(e.target.value)}
                                            placeholder="Distributed Systems, Compilers, Peer-to-Peer"
                                            className="w-full bg-black border border-zinc-800 p-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-zinc-400 uppercase text-[10px] tracking-wider mb-1.5">
                                            Founding Story & Origin Narrative (Optional)
                                        </label>
                                        <textarea
                                            value={foundingStory}
                                            onChange={(e) => setFoundingStory(e.target.value)}
                                            placeholder="How this collective was conceived, the problem it was created to solve..."
                                            rows={2}
                                            className="w-full bg-black border border-zinc-800 p-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 resize-none"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-zinc-400 uppercase text-[10px] tracking-wider mb-1.5">
                                                Core Values & Principles (One per line)
                                            </label>
                                            <textarea
                                                value={valuesInput}
                                                onChange={(e) => setValuesInput(e.target.value)}
                                                placeholder="Rigorous peer validation&#10;Transparency by default&#10;Zero technical debt"
                                                rows={3}
                                                className="w-full bg-black border border-zinc-800 p-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 resize-none"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-zinc-400 uppercase text-[10px] tracking-wider mb-1.5">
                                                Community Guidelines (One per line)
                                            </label>
                                            <textarea
                                                value={guidelinesInput}
                                                onChange={(e) => setGuidelinesInput(e.target.value)}
                                                placeholder="Provide evidence for benchmarks&#10;Be constructive in code reviews&#10;Maintain professional ethics"
                                                rows={3}
                                                className="w-full bg-black border border-zinc-800 p-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 resize-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="border-t border-zinc-800 pt-4 flex justify-between items-center">
                                {step === 1 ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={resetAndClose}
                                            className="px-4 py-2 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 uppercase"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleNext}
                                            className="px-6 py-2 bg-white text-black font-bold uppercase hover:bg-zinc-200 transition-colors"
                                        >
                                            Proceed to Identity Details →
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => setStep(1)}
                                            className="px-4 py-2 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 uppercase"
                                            disabled={submitting}
                                        >
                                            ← Back to Essentials
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            className="px-6 py-2 bg-emerald-500 text-black font-bold uppercase hover:bg-emerald-400 transition-colors disabled:opacity-50"
                                        >
                                            {submitting ? 'ESTABLISHING COLLECTIVE...' : 'ESTABLISH COLLECTIVE'}
                                        </button>
                                    </>
                                )}
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};
