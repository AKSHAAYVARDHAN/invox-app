import React, { useState, useEffect, useRef } from 'react';
import { 
    CloseIcon, 
    PlusIcon, 
    TrashIcon, 
    PencilSquareIcon, 
    ArrowUpTrayIcon, 
    CheckBadgeIcon, 
    DocumentTextIcon, 
    InformationCircleIcon, 
    ChevronDownIcon 
} from '../ui/Icons';
import { TargetDomainSelector } from '../ui/TargetDomainSelector';
import { CollabRole, CollabDetails } from '../../types';

interface CreateCollabModalProps {
    isOpen: boolean;
    onClose: () => void;
    onPublish: (data: {
        domain: string;
        oneLine: string;
        description: string;
        mediaFile?: File | null;
        previewUrl?: string | null;
        type: string;
        collabDetails: CollabDetails;
    }) => Promise<void>;
}

const STORAGE_DRAFT_KEY = 'invox-draft-collab';

const EXPERIENCE_OPTIONS = ['Any', 'Beginner', 'Intermediate', 'Advanced'];
const BACKGROUND_OPTIONS = ['Student', 'Professional', 'Researcher', 'Creator', 'Anyone'];
const AVAILABILITY_OPTIONS = ['Flexible', 'Part-Time', 'Full-Time'];
const LOCATION_OPTIONS = ['Remote', 'Specific Location', 'Anywhere'];

const COLLAB_TYPES = [
    'Open Collaboration',
    'Paid',
    'Equity',
    'Volunteer',
    'Academic / Research',
    'Internship',
    'Flexible / To Be Discussed',
];

const PROJECT_STATUSES = [
    'Idea',
    'Early Concept',
    'Prototype',
    'MVP',
    'Active Project',
    'Scaling',
];

const COMMON_SKILL_SUGGESTIONS = [
    'React', 'TypeScript', 'Python', 'PyTorch', 'Node.js', 
    'Figma', 'UI/UX', 'Go', 'Next.js', 'Tailwind', 'Rust', 'GraphQL'
];

export const CreateCollabModal: React.FC<CreateCollabModalProps> = ({
    isOpen,
    onClose,
    onPublish,
}) => {
    // 1. Target Domain
    const [domain, setDomain] = useState<string>('Technology');
    const [isDomainValid, setIsDomainValid] = useState<boolean>(true);

    // 2. The Hook
    const [hook, setHook] = useState<string>('');

    // 3. Project Overview
    const [projectOverview, setProjectOverview] = useState<string>('');

    // 4. What We Need (Roles)
    const [roles, setRoles] = useState<CollabRole[]>([]);
    
    // Active Role Editor State
    const [isEditingRole, setIsEditingRole] = useState<boolean>(true);
    const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
    const [roleTitle, setRoleTitle] = useState<string>('');
    const [roleCount, setRoleCount] = useState<number | string>(1);
    const [roleSkills, setRoleSkills] = useState<string[]>([]);
    const [skillInput, setSkillInput] = useState<string>('');
    const [roleResponsibilities, setRoleResponsibilities] = useState<string>('');
    const [roleError, setRoleError] = useState<string | null>(null);

    // 5. Who Can Collaborate (Optional)
    const [experience, setExperience] = useState<string>('');
    const [background, setBackground] = useState<string>('');
    const [availability, setAvailability] = useState<string>('');
    const [locationType, setLocationType] = useState<string>('');
    const [specificLocation, setSpecificLocation] = useState<string>('');

    // 6. Collaboration Type (Multi-select)
    const [collabTypes, setCollabTypes] = useState<string[]>([]);

    // 7. Project Status (Single-select)
    const [projectStatus, setProjectStatus] = useState<string>('');

    // 8. Visual Attachment
    const [mediaFile, setMediaFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // UI & Action States
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [draftStatus, setDraftStatus] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [showDiscardConfirm, setShowDiscardConfirm] = useState<boolean>(false);

    // Load draft when opened
    useEffect(() => {
        if (!isOpen) return;
        try {
            const rawDraft = localStorage.getItem(STORAGE_DRAFT_KEY);
            if (rawDraft) {
                const parsed = JSON.parse(rawDraft);
                if (parsed.domain) setDomain(parsed.domain);
                if (parsed.hook) setHook(parsed.hook);
                if (parsed.projectOverview) setProjectOverview(parsed.projectOverview);
                if (Array.isArray(parsed.roles) && parsed.roles.length > 0) {
                    setRoles(parsed.roles);
                    setIsEditingRole(false);
                }
                if (parsed.experience) setExperience(parsed.experience);
                if (parsed.background) setBackground(parsed.background);
                if (parsed.availability) setAvailability(parsed.availability);
                if (parsed.locationType) setLocationType(parsed.locationType);
                if (parsed.specificLocation) setSpecificLocation(parsed.specificLocation);
                if (Array.isArray(parsed.collabTypes)) setCollabTypes(parsed.collabTypes);
                if (parsed.projectStatus) setProjectStatus(parsed.projectStatus);
            }
        } catch (e) {
            console.warn('[COLLAB_DRAFT_LOAD_ERROR]', e);
        }
    }, [isOpen]);

    // Cleanup object URL
    useEffect(() => {
        return () => {
            if (previewUrl && previewUrl.startsWith('blob:')) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [previewUrl]);

    if (!isOpen) return null;

    // Check if form is dirty
    const isDirty = Boolean(
        hook.trim() || 
        projectOverview.trim() || 
        roles.length > 0 || 
        mediaFile || 
        experience || 
        background || 
        collabTypes.length > 0 || 
        projectStatus
    );

    const hasRoles = roles.length > 0 || Boolean(roleTitle.trim());

    // Validation
    const isPublishable = Boolean(
        domain.trim() &&
        isDomainValid &&
        hook.trim() &&
        projectOverview.trim() &&
        hasRoles &&
        !isSubmitting
    );

    const handleCloseAttempt = () => {
        if (isDirty) {
            setShowDiscardConfirm(true);
        } else {
            onClose();
        }
    };

    const handleSaveDraft = () => {
        try {
            let draftRoles = [...roles];
            if (roleTitle.trim()) {
                const countNum = parseInt(String(roleCount), 10) || 1;
                draftRoles.push({
                    id: editingRoleId || `role_${Date.now()}`,
                    title: roleTitle.trim(),
                    count: countNum,
                    skills: roleSkills,
                    responsibilities: roleResponsibilities.trim(),
                });
            }
            const draft = {
                domain,
                hook,
                projectOverview,
                roles: draftRoles,
                experience,
                background,
                availability,
                locationType,
                specificLocation,
                collabTypes,
                projectStatus,
                savedAt: new Date().toISOString(),
            };
            localStorage.setItem(STORAGE_DRAFT_KEY, JSON.stringify(draft));
            setDraftStatus('DRAFT_SAVED');
            setTimeout(() => setDraftStatus(null), 2500);
        } catch (e) {
            console.error('Failed to save draft:', e);
            setDraftStatus('FAILED_TO_SAVE');
        }
    };

    // Role Management
    const handleAddSkill = (skill: string) => {
        const cleaned = skill.trim();
        if (!cleaned) return;
        if (!roleSkills.includes(cleaned)) {
            setRoleSkills([...roleSkills, cleaned]);
        }
        setSkillInput('');
    };

    const handleRemoveSkill = (skillToRemove: string) => {
        setRoleSkills(roleSkills.filter(s => s !== skillToRemove));
    };

    const handleSkillKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            handleAddSkill(skillInput);
        }
    };

    const handleSaveRole = () => {
        if (!roleTitle.trim()) {
            setRoleError('Role title is required');
            return;
        }

        const countNum = parseInt(String(roleCount), 10) || 1;

        if (editingRoleId) {
            // Update existing
            setRoles(roles.map(r => r.id === editingRoleId ? {
                id: editingRoleId,
                title: roleTitle.trim(),
                count: countNum,
                skills: roleSkills,
                responsibilities: roleResponsibilities.trim(),
            } : r));
        } else {
            // Add new
            const newRole: CollabRole = {
                id: `role_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                title: roleTitle.trim(),
                count: countNum,
                skills: roleSkills,
                responsibilities: roleResponsibilities.trim(),
            };
            setRoles([...roles, newRole]);
        }

        // Reset role editor state
        setRoleTitle('');
        setRoleCount(1);
        setRoleSkills([]);
        setSkillInput('');
        setRoleResponsibilities('');
        setEditingRoleId(null);
        setIsEditingRole(false);
        setRoleError(null);
    };

    const handleEditRole = (role: CollabRole) => {
        setEditingRoleId(role.id);
        setRoleTitle(role.title);
        setRoleCount(role.count);
        setRoleSkills(role.skills || []);
        setRoleResponsibilities(role.responsibilities || '');
        setIsEditingRole(true);
        setRoleError(null);
    };

    const handleRemoveRole = (roleId: string) => {
        const updated = roles.filter(r => r.id !== roleId);
        setRoles(updated);
        if (editingRoleId === roleId) {
            setEditingRoleId(null);
            setRoleTitle('');
            setRoleCount(1);
            setRoleSkills([]);
            setRoleResponsibilities('');
            setIsEditingRole(updated.length === 0);
        }
        if (updated.length === 0) {
            setIsEditingRole(true);
        }
    };

    const handleCancelRoleEdit = () => {
        setEditingRoleId(null);
        setRoleTitle('');
        setRoleCount(1);
        setRoleSkills([]);
        setRoleResponsibilities('');
        setRoleError(null);
        if (roles.length > 0) {
            setIsEditingRole(false);
        }
    };

    // Collab Type toggle
    const handleToggleCollabType = (type: string) => {
        if (collabTypes.includes(type)) {
            setCollabTypes(collabTypes.filter(t => t !== type));
        } else {
            setCollabTypes([...collabTypes, type]);
        }
    };

    // Media handlers
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 50 * 1024 * 1024) {
            setErrorMessage('Attachment must be smaller than 50MB');
            return;
        }

        if (previewUrl && previewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(previewUrl);
        }

        const url = URL.createObjectURL(file);
        setMediaFile(file);
        setPreviewUrl(url);
        setMediaType(file.type.startsWith('video') ? 'video' : 'image');
        setErrorMessage(null);
    };

    const handleRemoveMedia = () => {
        if (previewUrl && previewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(previewUrl);
        }
        setMediaFile(null);
        setPreviewUrl(null);
        setMediaType(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Final Publish
    const handleSubmit = async () => {
        if (!isPublishable) return;

        setIsSubmitting(true);
        setErrorMessage(null);

        try {
            // Auto-commit active role in editor if user filled in a role title
            let effectiveRoles = [...roles];
            if (roleTitle.trim()) {
                const countNum = parseInt(String(roleCount), 10) || 1;
                if (editingRoleId) {
                    effectiveRoles = effectiveRoles.map(r => r.id === editingRoleId ? {
                        id: editingRoleId,
                        title: roleTitle.trim(),
                        count: countNum,
                        skills: roleSkills,
                        responsibilities: roleResponsibilities.trim(),
                    } : r);
                } else {
                    effectiveRoles.push({
                        id: `role_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                        title: roleTitle.trim(),
                        count: countNum,
                        skills: roleSkills,
                        responsibilities: roleResponsibilities.trim(),
                    });
                }
            }

            // Sanitize roles to ensure valid clean values
            const cleanRoles = effectiveRoles.map(r => {
                const roleItem: any = {
                    id: r.id,
                    title: r.title.trim(),
                    count: Number(r.count) || 1,
                    skills: Array.isArray(r.skills) ? r.skills : [],
                };
                if (r.responsibilities && r.responsibilities.trim()) {
                    roleItem.responsibilities = r.responsibilities.trim();
                }
                return roleItem;
            });

            const collabDetails: CollabDetails = {
                roles: cleanRoles,
            };

            if (experience && experience.trim()) {
                collabDetails.experience = experience.trim();
            }
            if (background && background.trim()) {
                collabDetails.background = background.trim();
            }
            if (availability && availability.trim()) {
                collabDetails.availability = availability.trim();
            }
            if (locationType && locationType.trim()) {
                collabDetails.location = locationType.trim();
            }
            if (locationType === 'Specific Location' && specificLocation && specificLocation.trim()) {
                collabDetails.specificLocation = specificLocation.trim();
            }
            if (collabTypes && collabTypes.length > 0) {
                collabDetails.collabTypes = collabTypes;
            }
            if (projectStatus && projectStatus.trim()) {
                collabDetails.projectStatus = projectStatus.trim();
            }

            await onPublish({
                domain,
                oneLine: hook.trim(),
                description: projectOverview.trim(),
                mediaFile,
                previewUrl,
                type: 'Collab',
                collabDetails,
            });

            // Clear draft upon successful publish
            localStorage.removeItem(STORAGE_DRAFT_KEY);

            // Reset form state cleanly
            setHook('');
            setProjectOverview('');
            setRoles([]);
            setRoleTitle('');
            setRoleCount(1);
            setRoleSkills([]);
            setRoleResponsibilities('');
            setEditingRoleId(null);
            setIsEditingRole(true);
            setExperience('');
            setBackground('');
            setAvailability('');
            setLocationType('');
            setSpecificLocation('');
            setCollabTypes([]);
            setProjectStatus('');
            setMediaFile(null);
            setPreviewUrl(null);
            setMediaType(null);

            onClose();
        } catch (err: any) {
            console.error('[COLLAB_PUBLISH_ERROR]', err);
            setErrorMessage(err.message || 'Failed to publish collaboration signal.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in font-mono">
            {/* Modal Container */}
            <div className="bg-[#0c0c0e] border border-zinc-800 w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl relative">
                
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-black/60 shrink-0">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">// NEW_COLLAB_SIGNAL</span>
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider">PROJECT COLLABORATION SIGNAL</h2>
                    </div>
                    <button
                        onClick={handleCloseAttempt}
                        className="text-zinc-500 hover:text-white p-1 transition-colors border border-transparent hover:border-zinc-800"
                        title="Close"
                    >
                        <CloseIcon className="w-4 h-4" />
                    </button>
                </div>

                {/* Form Content Scrollable */}
                <div className="p-5 overflow-y-auto space-y-6 flex-grow custom-scrollbar text-xs">
                    
                    {/* Error Banner */}
                    {errorMessage && (
                        <div className="p-3 bg-red-950/40 border border-red-900/80 text-red-300 flex items-start gap-2">
                            <InformationCircleIcon className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                            <span className="leading-relaxed">{errorMessage}</span>
                        </div>
                    )}

                    {/* 1. TARGET DOMAIN */}
                    <div className="space-y-2">
                        <TargetDomainSelector
                            value={domain}
                            onChange={(val, isValid) => {
                                setDomain(val);
                                setIsDomainValid(isValid);
                            }}
                            label="// TARGET_DOMAIN"
                            subLabel="Single primary domain required"
                        />
                    </div>

                    {/* 2. THE HOOK */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-white uppercase tracking-wider">
                                // THE_HOOK <span className="text-white font-normal text-[11px]">*</span>
                            </label>
                            <span className="text-[10px] text-zinc-500">ONE-LINE PITCH</span>
                        </div>
                        <input
                            type="text"
                            value={hook}
                            onChange={(e) => setHook(e.target.value)}
                            placeholder="A concise one-line description of what you’re building or looking for..."
                            className="w-full bg-black/60 border border-zinc-800 px-3.5 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 text-xs font-mono transition-colors"
                            maxLength={160}
                        />
                    </div>

                    {/* 3. PROJECT OVERVIEW */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-white uppercase tracking-wider">
                                // PROJECT_OVERVIEW <span className="text-white font-normal text-[11px]">*</span>
                            </label>
                            <span className="text-[10px] text-zinc-500">PROBLEM & VISION</span>
                        </div>
                        <textarea
                            value={projectOverview}
                            onChange={(e) => setProjectOverview(e.target.value)}
                            placeholder="Describe the project, the problem you’re solving, your current progress, and what you want to achieve..."
                            className="w-full bg-black/60 border border-zinc-800 p-3.5 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 text-xs font-mono min-h-[100px] resize-none transition-colors leading-relaxed"
                            rows={4}
                        />
                    </div>

                    {/* 4. WHAT WE NEED (ROLES) */}
                    <div className="space-y-3 pt-1 border-t border-zinc-800/80">
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                                    <span>// WHAT_WE_NEED</span>
                                    <span className="text-white font-normal text-[11px]">*</span>
                                </label>
                                <p className="text-[10px] text-zinc-500 mt-0.5">At least one collaboration role is required before publishing</p>
                            </div>
                            {roles.length > 0 && !isEditingRole && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditingRoleId(null);
                                        setRoleTitle('');
                                        setRoleCount(1);
                                        setRoleSkills([]);
                                        setRoleResponsibilities('');
                                        setIsEditingRole(true);
                                    }}
                                    className="flex items-center gap-1 text-[11px] font-bold text-white bg-zinc-900 border border-zinc-700 hover:border-zinc-500 px-2.5 py-1 transition-colors"
                                >
                                    <PlusIcon className="w-3 h-3" />
                                    <span>ADD ROLE</span>
                                </button>
                            )}
                        </div>

                        {/* Existing Roles Cards */}
                        {roles.length > 0 && (
                            <div className="space-y-2">
                                {roles.map((role) => (
                                    <div 
                                        key={role.id} 
                                        className="p-3 bg-[#0f0f13] border border-zinc-800 hover:border-zinc-700 transition-colors flex flex-col gap-2"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-bold text-white text-xs uppercase tracking-wider">{role.title}</span>
                                                <span className="text-[10px] font-bold text-zinc-400 bg-zinc-800/90 border border-zinc-700 px-1.5 py-0.5">
                                                    × {role.count} {Number(role.count) === 1 ? 'person' : 'people'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => handleEditRole(role)}
                                                    className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
                                                    title="Edit role"
                                                >
                                                    <PencilSquareIcon className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveRole(role.id)}
                                                    className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
                                                    title="Remove role"
                                                >
                                                    <TrashIcon className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Skills Pills */}
                                        {role.skills && role.skills.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 mt-0.5">
                                                {role.skills.map((s, idx) => (
                                                    <span 
                                                        key={`${role.id}-skill-${idx}`}
                                                        className="text-[10px] bg-zinc-900 border border-zinc-700/80 px-2 py-0.5 text-zinc-300"
                                                    >
                                                        {s}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {/* Responsibilities */}
                                        {role.responsibilities && (
                                            <p className="text-[11px] text-zinc-400 leading-relaxed bg-black/40 p-2 border border-zinc-800/60 mt-1">
                                                <span className="text-zinc-500 font-bold uppercase text-[9px] block mb-0.5">RESPONSIBILITIES:</span>
                                                {role.responsibilities}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Active Role Creator / Editor */}
                        {isEditingRole && (
                            <div className="p-3.5 bg-black/60 border border-zinc-700/90 space-y-3.5 relative">
                                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                                    <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider">
                                        // {editingRoleId ? 'EDIT_ROLE' : 'DEFINE_NEW_ROLE'}
                                    </span>
                                    {roles.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={handleCancelRoleEdit}
                                            className="text-[10px] text-zinc-500 hover:text-zinc-300"
                                        >
                                            CANCEL
                                        </button>
                                    )}
                                </div>

                                {roleError && (
                                    <p className="text-[11px] text-red-400 font-mono">{roleError}</p>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                                    <div className="sm:col-span-3 space-y-1">
                                        <label className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">ROLE TITLE *</label>
                                        <input
                                            type="text"
                                            value={roleTitle}
                                            onChange={(e) => {
                                                setRoleTitle(e.target.value);
                                                if (roleError) setRoleError(null);
                                            }}
                                            placeholder="e.g. Frontend Developer, ML Engineer..."
                                            className="w-full bg-[#0c0c0e] border border-zinc-800 px-3 py-2 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 text-xs font-mono"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">PEOPLE NEEDED</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="50"
                                            value={roleCount}
                                            onChange={(e) => setRoleCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                            className="w-full bg-[#0c0c0e] border border-zinc-800 px-3 py-2 text-white focus:outline-none focus:border-zinc-500 text-xs font-mono text-center"
                                        />
                                    </div>
                                </div>

                                {/* Skills */}
                                <div className="space-y-2">
                                    <label className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">REQUIRED SKILLS</label>
                                    
                                    {/* Active skills pills */}
                                    <div className="flex flex-wrap gap-1.5 min-h-[28px] p-2 bg-[#0c0c0e] border border-zinc-800">
                                        {roleSkills.map((skill) => (
                                            <span 
                                                key={skill} 
                                                className="inline-flex items-center gap-1.5 bg-zinc-900 border border-zinc-700 text-zinc-200 text-[11px] px-2 py-0.5"
                                            >
                                                <span>{skill}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveSkill(skill)}
                                                    className="hover:text-red-400 transition-colors"
                                                >
                                                    <CloseIcon className="w-3 h-3" />
                                                </button>
                                            </span>
                                        ))}
                                        <input
                                            type="text"
                                            value={skillInput}
                                            onChange={(e) => setSkillInput(e.target.value)}
                                            onKeyDown={handleSkillKeyDown}
                                            placeholder={roleSkills.length === 0 ? "Type skill & press Enter (e.g. React, TypeScript)..." : "Add more..."}
                                            className="bg-transparent border-none text-xs text-white placeholder-zinc-600 focus:outline-none flex-grow min-w-[140px]"
                                        />
                                    </div>

                                    {/* Suggested skills */}
                                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                                        <span className="text-[9px] text-zinc-500 uppercase tracking-wider">SUGGESTED:</span>
                                        {COMMON_SKILL_SUGGESTIONS.filter(s => !roleSkills.includes(s)).slice(0, 6).map((skill) => (
                                            <button
                                                type="button"
                                                key={`sugg-${skill}`}
                                                onClick={() => handleAddSkill(skill)}
                                                className="text-[10px] text-zinc-400 hover:text-white bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-600 px-1.5 py-0.5 transition-colors"
                                            >
                                                + {skill}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Responsibilities */}
                                <div className="space-y-1">
                                    <label className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">RESPONSIBILITIES</label>
                                    <textarea
                                        value={roleResponsibilities}
                                        onChange={(e) => setRoleResponsibilities(e.target.value)}
                                        placeholder="Describe what this collaborator will work on..."
                                        rows={2}
                                        className="w-full bg-[#0c0c0e] border border-zinc-800 p-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 text-xs font-mono resize-none leading-relaxed"
                                    />
                                </div>

                                {/* Save Role Button */}
                                <div className="flex items-center justify-end gap-2 pt-1">
                                    {roles.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={handleCancelRoleEdit}
                                            className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700 transition-colors"
                                        >
                                            CANCEL
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={handleSaveRole}
                                        className="px-4 py-1.5 text-xs font-bold text-black bg-white hover:bg-zinc-200 transition-colors flex items-center gap-1.5"
                                    >
                                        <CheckBadgeIcon className="w-3.5 h-3.5" />
                                        <span>{editingRoleId ? 'UPDATE ROLE' : '+ SAVE ROLE'}</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 5. WHO CAN COLLABORATE? (Optional) */}
                    <div className="space-y-3.5 pt-1 border-t border-zinc-800/80">
                        <div>
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-white uppercase tracking-wider">
                                    // WHO_CAN_COLLABORATE?
                                </label>
                                <span className="text-[10px] text-zinc-500 uppercase tracking-widest">OPTIONAL</span>
                            </div>
                            <p className="text-[10px] text-zinc-500 mt-0.5">Define your ideal collaborator's background and availability</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            {/* Experience */}
                            <div className="space-y-1.5">
                                <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider block">EXPERIENCE</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {EXPERIENCE_OPTIONS.map((opt) => (
                                        <button
                                            key={`exp-${opt}`}
                                            type="button"
                                            onClick={() => setExperience(experience === opt ? '' : opt)}
                                            className={`text-[10px] px-2.5 py-1 border transition-all ${
                                                experience === opt 
                                                    ? 'bg-white text-black font-bold border-white' 
                                                    : 'bg-black/50 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200'
                                            }`}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Background */}
                            <div className="space-y-1.5">
                                <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider block">BACKGROUND</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {BACKGROUND_OPTIONS.map((opt) => (
                                        <button
                                            key={`bg-${opt}`}
                                            type="button"
                                            onClick={() => setBackground(background === opt ? '' : opt)}
                                            className={`text-[10px] px-2.5 py-1 border transition-all ${
                                                background === opt 
                                                    ? 'bg-white text-black font-bold border-white' 
                                                    : 'bg-black/50 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200'
                                            }`}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Availability */}
                            <div className="space-y-1.5">
                                <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider block">AVAILABILITY</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {AVAILABILITY_OPTIONS.map((opt) => (
                                        <button
                                            key={`avail-${opt}`}
                                            type="button"
                                            onClick={() => setAvailability(availability === opt ? '' : opt)}
                                            className={`text-[10px] px-2.5 py-1 border transition-all ${
                                                availability === opt 
                                                    ? 'bg-white text-black font-bold border-white' 
                                                    : 'bg-black/50 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200'
                                            }`}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Location */}
                            <div className="space-y-1.5">
                                <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider block">LOCATION</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {LOCATION_OPTIONS.map((opt) => (
                                        <button
                                            key={`loc-${opt}`}
                                            type="button"
                                            onClick={() => setLocationType(locationType === opt ? '' : opt)}
                                            className={`text-[10px] px-2.5 py-1 border transition-all ${
                                                locationType === opt 
                                                    ? 'bg-white text-black font-bold border-white' 
                                                    : 'bg-black/50 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200'
                                            }`}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                                {locationType === 'Specific Location' && (
                                    <input
                                        type="text"
                                        value={specificLocation}
                                        onChange={(e) => setSpecificLocation(e.target.value)}
                                        placeholder="e.g. San Francisco, London, UTC-5..."
                                        className="w-full mt-1.5 bg-[#0c0c0e] border border-zinc-800 px-2.5 py-1 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 text-[11px]"
                                    />
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 6. COLLABORATION TYPE (Multi-select) */}
                    <div className="space-y-2 pt-1 border-t border-zinc-800/80">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-white uppercase tracking-wider">
                                // COLLABORATION_TYPE
                            </label>
                            <span className="text-[10px] text-zinc-500 uppercase tracking-widest">MULTI-SELECT</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {COLLAB_TYPES.map((type) => {
                                const isSelected = collabTypes.includes(type);
                                return (
                                    <button
                                        key={`ctype-${type}`}
                                        type="button"
                                        onClick={() => handleToggleCollabType(type)}
                                        className={`text-xs px-3 py-1.5 border transition-all ${
                                            isSelected 
                                                ? 'bg-zinc-200 text-black font-bold border-white' 
                                                : 'bg-black/50 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-white'
                                        }`}
                                    >
                                        {type}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* 7. PROJECT STATUS (Single-select) */}
                    <div className="space-y-2 pt-1 border-t border-zinc-800/80">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-white uppercase tracking-wider">
                                // PROJECT_STATUS
                            </label>
                            <span className="text-[10px] text-zinc-500 uppercase tracking-widest">CURRENT STAGE</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {PROJECT_STATUSES.map((status) => {
                                const isSelected = projectStatus === status;
                                return (
                                    <button
                                        key={`pstatus-${status}`}
                                        type="button"
                                        onClick={() => setProjectStatus(isSelected ? '' : status)}
                                        className={`text-xs px-3 py-1.5 border transition-all ${
                                            isSelected 
                                                ? 'bg-white text-black font-bold border-white' 
                                                : 'bg-black/50 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-white'
                                        }`}
                                    >
                                        {status}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* 8. VISUAL ATTACHMENT */}
                    <div className="space-y-2 pt-1 border-t border-zinc-800/80">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-white uppercase tracking-wider">
                                // PROJECT_ATTACHMENT
                            </label>
                            <span className="text-[10px] text-zinc-500 uppercase tracking-widest">MEDIA ATTACHMENT</span>
                        </div>
                        <p className="text-[10px] text-zinc-500">
                            Upload project screenshots, architecture diagrams, prototypes, or demo video (max 50MB)
                        </p>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*,video/*"
                            onChange={handleFileChange}
                            className="hidden"
                        />

                        {previewUrl ? (
                            <div className="relative border border-zinc-800 bg-black overflow-hidden group">
                                {mediaType === 'video' ? (
                                    <video src={previewUrl} controls className="w-full max-h-56 object-contain" />
                                ) : (
                                    <img src={previewUrl} alt="Project Attachment Preview" className="w-full max-h-56 object-contain" />
                                )}
                                <div className="absolute top-2 right-2">
                                    <button
                                        type="button"
                                        onClick={handleRemoveMedia}
                                        className="p-1.5 bg-black/80 text-zinc-400 hover:text-red-400 border border-zinc-700 transition-colors"
                                        title="Remove attachment"
                                    >
                                        <TrashIcon className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="border border-dashed border-zinc-800 hover:border-zinc-600 bg-black/40 p-5 text-center cursor-pointer transition-colors flex flex-col items-center justify-center gap-2"
                            >
                                <div className="flex items-center gap-2 text-zinc-500">
                                    <DocumentTextIcon className="w-5 h-5" />
                                </div>
                                <span className="text-xs text-zinc-400">Click to upload image or demo video</span>
                                <span className="text-[10px] text-zinc-600">PNG, JPG, WEBP, MP4, WEBM</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 9. FORM ACTIONS (Sticky Footer) */}
                <div className="p-4 border-t border-zinc-800 bg-black/90 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleSaveDraft}
                            className="px-3.5 py-2 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white text-xs uppercase tracking-wider font-bold transition-colors"
                        >
                            SAVE AS DRAFT
                        </button>
                        {draftStatus && (
                            <span className="text-[10px] text-zinc-400 font-bold tracking-wider animate-fade-in">
                                // {draftStatus}
                            </span>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!isPublishable}
                        className={`px-5 py-2 text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
                            isPublishable
                                ? 'bg-white text-black hover:bg-zinc-200 cursor-pointer shadow-lg'
                                : 'bg-zinc-900 text-zinc-600 border border-zinc-800 cursor-not-allowed'
                        }`}
                    >
                        {isSubmitting ? (
                            <>
                                <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                                <span>PUBLISHING...</span>
                            </>
                        ) : (
                            <>
                                <PlusIcon className="w-3.5 h-3.5" />
                                <span>PUBLISH</span>
                            </>
                        )}
                    </button>
                </div>

                {/* Discard Confirmation Modal */}
                {showDiscardConfirm && (
                    <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-6">
                        <div className="bg-[#0c0c0e] border border-zinc-800 p-5 max-w-sm w-full space-y-4 shadow-2xl">
                            <h3 className="text-xs font-bold text-white uppercase tracking-wider">// DISCARD_CHANGES?</h3>
                            <p className="text-xs text-zinc-400 leading-relaxed">
                                You have unsaved collaboration data. Do you want to save as draft before leaving or discard?
                            </p>
                            <div className="flex items-center justify-end gap-2 pt-2">
                                <button
                                    onClick={() => setShowDiscardConfirm(false)}
                                    className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white border border-zinc-800"
                                >
                                    CONTINUE EDITING
                                </button>
                                <button
                                    onClick={() => {
                                        handleSaveDraft();
                                        setShowDiscardConfirm(false);
                                        onClose();
                                    }}
                                    className="px-3 py-1.5 text-xs text-zinc-300 hover:text-white border border-zinc-700 bg-zinc-900"
                                >
                                    SAVE & EXIT
                                </button>
                                <button
                                    onClick={() => {
                                        setShowDiscardConfirm(false);
                                        onClose();
                                    }}
                                    className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 border border-red-900/50 bg-red-950/20"
                                >
                                    DISCARD
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
