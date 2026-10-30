import React, { useState } from 'react';
import type { CommunityCoreValue, CommunityGuideline } from '../../types';
import { PlusIcon, TrashIcon, PencilSquareIcon, CheckIcon, CloseIcon, SparklesIcon, ShieldCheckIcon } from '../ui/Icons';

export const PRESET_CORE_VALUES: { title: string; description: string }[] = [
    { title: 'Radical Transparency', description: 'Open communication, public roadmaps, and uncompromised intellectual honesty.' },
    { title: 'Engineering Rigor', description: 'Deep technical craftsmanship, test-backed execution, and relentless pursuit of elegance.' },
    { title: 'Autonomous Execution', description: 'Bias towards shipping, peer accountability, and self-directed sovereignty.' },
    { title: 'Open Source First', description: 'Contributing upstream, sharing knowledge, and building on open-access primitives.' },
    { title: 'Constructive Dissent', description: 'Welcoming respectful counter-perspectives to strengthen community consensus.' },
    { title: 'Signal Over Noise', description: 'High-density insights, verifiable research, and zero tolerance for low-effort fluff.' },
];

export const PRESET_GUIDELINES: { title: string; description: string }[] = [
    { title: 'Respectful Engagement', description: 'Treat every collective member with professional courtesy, intellectual goodwill, and mutual respect.' },
    { title: 'No Spam or Unsolicited Promotion', description: 'Commercial solicitations, unsolicited DM spam, and affiliate links will result in immediate sanction.' },
    { title: 'Signal & Grounded Dialogue', description: 'Support technical debates and arguments with citations, reproducible examples, or verifiable logic.' },
    { title: 'Constructive Code & Design Critique', description: 'Critique architectural decisions and concepts, never the identity or persona of the creator.' },
    { title: 'Privacy & Operational Security', description: 'Never expose sensitive production credentials, private user data, or confidential telemetry in conclaves.' },
];

// --- Core Values Editor Component ---
interface CoreValuesEditorProps {
    values: CommunityCoreValue[];
    onChange: (values: CommunityCoreValue[]) => void;
    error?: string | null;
    onError?: (err: string | null) => void;
}

export const CoreValuesEditor: React.FC<CoreValuesEditorProps> = ({
    values,
    onChange,
    error,
    onError,
}) => {
    const [titleInput, setTitleInput] = useState('');
    const [descInput, setDescInput] = useState('');
    const [editingIdx, setEditingIdx] = useState<number | null>(null);

    const handleSave = () => {
        if (onError) onError(null);
        const trimmedTitle = titleInput.trim();
        if (!trimmedTitle) {
            if (onError) onError('Core value title cannot be empty.');
            return;
        }

        // Check for duplicates
        const exists = values.some(
            (v, idx) => idx !== editingIdx && v.title.toLowerCase() === trimmedTitle.toLowerCase()
        );
        if (exists) {
            if (onError) onError(`Core value "${trimmedTitle}" already exists in this collective.`);
            return;
        }

        if (editingIdx !== null) {
            const updated = values.map((v, idx) =>
                idx === editingIdx
                    ? { ...v, title: trimmedTitle, description: descInput.trim() }
                    : v
            );
            onChange(updated);
            setEditingIdx(null);
        } else {
            const newItem: CommunityCoreValue = {
                id: `val_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                title: trimmedTitle,
                description: descInput.trim(),
            };
            onChange([...values, newItem]);
        }

        setTitleInput('');
        setDescInput('');
    };

    const handleEdit = (idx: number) => {
        setEditingIdx(idx);
        setTitleInput(values[idx].title);
        setDescInput(values[idx].description || '');
    };

    const handleCancel = () => {
        setEditingIdx(null);
        setTitleInput('');
        setDescInput('');
    };

    const handleRemove = (idx: number) => {
        if (editingIdx === idx) handleCancel();
        onChange(values.filter((_, i) => i !== idx));
    };

    const handleApplyPreset = (preset: { title: string; description: string }) => {
        if (onError) onError(null);
        if (values.some(v => v.title.toLowerCase() === preset.title.toLowerCase())) {
            if (onError) onError(`Core value "${preset.title}" is already added.`);
            return;
        }
        onChange([
            ...values,
            {
                id: `val_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                title: preset.title,
                description: preset.description,
            }
        ]);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300">
                        Core Values ({values.length})
                    </label>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                        Foundational tenets that define culture, ethical codes, and decision-making standards.
                    </p>
                </div>
            </div>

            {/* Quick Preset Recommendations */}
            <div className="bg-zinc-950/70 border border-zinc-800/80 p-3 rounded-none">
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1.5">
                    <SparklesIcon className="w-3.5 h-3.5 text-amber-400" />
                    <span>Quick Add Recommended Tenets</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {PRESET_CORE_VALUES.map((preset) => {
                        const isSelected = values.some(v => v.title.toLowerCase() === preset.title.toLowerCase());
                        return (
                            <button
                                key={preset.title}
                                type="button"
                                disabled={isSelected}
                                onClick={() => handleApplyPreset(preset)}
                                className={`text-[10px] px-2.5 py-1 border transition-all ${
                                    isSelected
                                        ? 'bg-zinc-900 border-zinc-800 text-zinc-600 line-through cursor-not-allowed'
                                        : 'bg-black border-zinc-700 hover:border-amber-400 text-zinc-300 hover:text-white'
                                }`}
                            >
                                + {preset.title}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Add / Edit Form */}
            <div className="bg-zinc-900/60 border border-zinc-700 p-3 space-y-2.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    {editingIdx !== null ? `// EDIT CORE VALUE #${editingIdx + 1}` : '// DEFINE NEW CORE VALUE'}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="sm:col-span-1">
                        <input
                            type="text"
                            value={titleInput}
                            onChange={(e) => setTitleInput(e.target.value)}
                            placeholder="Value Title (e.g. Radical Candor)"
                            maxLength={100}
                            className="w-full bg-black border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                        />
                    </div>
                    <div className="sm:col-span-2">
                        <input
                            type="text"
                            value={descInput}
                            onChange={(e) => setDescInput(e.target.value)}
                            placeholder="What does this value mean in daily practice? (Optional)"
                            maxLength={500}
                            className="w-full bg-black border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                    {editingIdx !== null && (
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="px-3 py-1 text-xs border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800 uppercase"
                        >
                            Cancel
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleSave}
                        className="px-3.5 py-1 text-xs font-bold uppercase border border-amber-500/80 bg-amber-500/10 text-amber-300 hover:bg-amber-500 hover:text-black flex items-center gap-1 transition-colors"
                    >
                        {editingIdx !== null ? (
                            <>
                                <CheckIcon className="w-3.5 h-3.5" />
                                <span>Update Value</span>
                            </>
                        ) : (
                            <>
                                <PlusIcon className="w-3.5 h-3.5" />
                                <span>Add Core Value</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* List of Defined Values */}
            {values.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-zinc-800 bg-zinc-950/40 text-zinc-500 text-xs">
                    No core values defined yet. Add custom tenets or click any recommended preset above.
                </div>
            ) : (
                <div className="space-y-2">
                    {values.map((val, idx) => (
                        <div
                            key={val.id || idx}
                            className="bg-zinc-950/90 border border-zinc-800 p-3 flex items-start justify-between gap-3 group hover:border-zinc-700 transition-colors"
                        >
                            <div className="space-y-1 flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono text-amber-400 font-bold">
                                        {(idx + 1).toString().padStart(2, '0')}.
                                    </span>
                                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                                        {val.title}
                                    </span>
                                </div>
                                {val.description && (
                                    <p className="text-[11px] text-zinc-400 leading-relaxed pl-6">
                                        {val.description}
                                    </p>
                                )}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                    type="button"
                                    onClick={() => handleEdit(idx)}
                                    className="p-1.5 text-zinc-400 hover:text-amber-400 border border-transparent hover:border-zinc-700 bg-zinc-900/60"
                                    title="Edit Value"
                                >
                                    <PencilSquareIcon className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleRemove(idx)}
                                    className="p-1.5 text-zinc-400 hover:text-rose-400 border border-transparent hover:border-rose-900/60 bg-zinc-900/60"
                                    title="Remove Value"
                                >
                                    <TrashIcon className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- Guidelines Editor Component ---
interface GuidelinesEditorProps {
    guidelines: CommunityGuideline[];
    onChange: (guidelines: CommunityGuideline[]) => void;
    error?: string | null;
    onError?: (err: string | null) => void;
}

export const GuidelinesEditor: React.FC<GuidelinesEditorProps> = ({
    guidelines,
    onChange,
    error,
    onError,
}) => {
    const [titleInput, setTitleInput] = useState('');
    const [descInput, setDescInput] = useState('');
    const [editingIdx, setEditingIdx] = useState<number | null>(null);

    const handleSave = () => {
        if (onError) onError(null);
        const trimmedTitle = titleInput.trim();
        const trimmedDesc = descInput.trim();

        if (!trimmedTitle) {
            if (onError) onError('Guideline title or rule heading is required.');
            return;
        }
        if (!trimmedDesc) {
            if (onError) onError('Guideline description or rule standard is required.');
            return;
        }

        if (editingIdx !== null) {
            const updated = guidelines.map((g, idx) =>
                idx === editingIdx
                    ? { ...g, title: trimmedTitle, description: trimmedDesc }
                    : g
            );
            onChange(updated);
            setEditingIdx(null);
        } else {
            const newItem: CommunityGuideline = {
                id: `guide_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                title: trimmedTitle,
                description: trimmedDesc,
            };
            onChange([...guidelines, newItem]);
        }

        setTitleInput('');
        setDescInput('');
    };

    const handleEdit = (idx: number) => {
        setEditingIdx(idx);
        setTitleInput(guidelines[idx].title);
        setDescInput(guidelines[idx].description || '');
    };

    const handleCancel = () => {
        setEditingIdx(null);
        setTitleInput('');
        setDescInput('');
    };

    const handleRemove = (idx: number) => {
        if (editingIdx === idx) handleCancel();
        onChange(guidelines.filter((_, i) => i !== idx));
    };

    const handleApplyPreset = (preset: { title: string; description: string }) => {
        if (onError) onError(null);
        onChange([
            ...guidelines,
            {
                id: `guide_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                title: preset.title,
                description: preset.description,
            }
        ]);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300">
                        Community Guidelines ({guidelines.length})
                    </label>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                        Rules of engagement, code of conduct, and boundaries enforced across conclaves and threads.
                    </p>
                </div>
            </div>

            {/* Quick Preset Recommendations */}
            <div className="bg-zinc-950/70 border border-zinc-800/80 p-3 rounded-none">
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1.5">
                    <ShieldCheckIcon className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Recommended Standard Rules</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {PRESET_GUIDELINES.map((preset) => (
                        <button
                            key={preset.title}
                            type="button"
                            onClick={() => handleApplyPreset(preset)}
                            className="text-[10px] px-2.5 py-1 border bg-black border-zinc-700 hover:border-emerald-400 text-zinc-300 hover:text-white transition-all"
                        >
                            + {preset.title}
                        </button>
                    ))}
                </div>
            </div>

            {/* Add / Edit Form */}
            <div className="bg-zinc-900/60 border border-zinc-700 p-3 space-y-2.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    {editingIdx !== null ? `// EDIT GUIDELINE #${editingIdx + 1}` : '// ADD NEW GUIDELINE'}
                </div>
                <div className="space-y-2">
                    <input
                        type="text"
                        value={titleInput}
                        onChange={(e) => setTitleInput(e.target.value)}
                        placeholder="Guideline Title (e.g. Constructive Peer Critique)"
                        maxLength={150}
                        className="w-full bg-black border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400 font-mono"
                    />
                    <textarea
                        value={descInput}
                        onChange={(e) => setDescInput(e.target.value)}
                        placeholder="Detailed standard or consequence (e.g. Respect author intent and keep reviews focused on code quality)..."
                        rows={2}
                        maxLength={1500}
                        className="w-full bg-black border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400 font-mono resize-none"
                    />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                    {editingIdx !== null && (
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="px-3 py-1 text-xs border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800 uppercase"
                        >
                            Cancel
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleSave}
                        className="px-3.5 py-1 text-xs font-bold uppercase border border-emerald-500/80 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500 hover:text-black flex items-center gap-1 transition-colors"
                    >
                        {editingIdx !== null ? (
                            <>
                                <CheckIcon className="w-3.5 h-3.5" />
                                <span>Update Guideline</span>
                            </>
                        ) : (
                            <>
                                <PlusIcon className="w-3.5 h-3.5" />
                                <span>Add Guideline</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* List of Defined Guidelines */}
            {guidelines.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-zinc-800 bg-zinc-950/40 text-zinc-500 text-xs">
                    No guidelines configured yet. Add guidelines or click recommended standards above.
                </div>
            ) : (
                <div className="space-y-2">
                    {guidelines.map((guide, idx) => (
                        <div
                            key={guide.id || idx}
                            className="bg-zinc-950/90 border border-zinc-800 p-3 flex items-start justify-between gap-3 group hover:border-zinc-700 transition-colors"
                        >
                            <div className="space-y-1 flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono text-emerald-400 font-bold">
                                        §{(idx + 1).toString().padStart(2, '0')}
                                    </span>
                                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                                        {guide.title}
                                    </span>
                                </div>
                                <p className="text-[11px] text-zinc-400 leading-relaxed pl-6">
                                    {guide.description}
                                </p>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                    type="button"
                                    onClick={() => handleEdit(idx)}
                                    className="p-1.5 text-zinc-400 hover:text-emerald-400 border border-transparent hover:border-zinc-700 bg-zinc-900/60"
                                    title="Edit Guideline"
                                >
                                    <PencilSquareIcon className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleRemove(idx)}
                                    className="p-1.5 text-zinc-400 hover:text-rose-400 border border-transparent hover:border-rose-900/60 bg-zinc-900/60"
                                    title="Remove Guideline"
                                >
                                    <TrashIcon className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
