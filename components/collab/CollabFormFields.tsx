import React, { useState, useRef, useImperativeHandle, forwardRef } from 'react';
import { 
    CloseIcon, 
    PlusIcon, 
    TrashIcon, 
    PencilSquareIcon, 
    CheckBadgeIcon, 
    DocumentTextIcon, 
    InformationCircleIcon 
} from '../ui/Icons';
import { TargetDomainSelector } from '../ui/TargetDomainSelector';
import { CollabRole } from '../../types';
import {
    EXPERIENCE_OPTIONS,
    BACKGROUND_OPTIONS,
    AVAILABILITY_OPTIONS,
    LOCATION_OPTIONS,
    COLLAB_TYPES,
    PROJECT_STATUSES,
    COMMON_SKILL_SUGGESTIONS
} from './collabConstants';

export interface CollabFormFieldsRef {
    getEffectiveRoles: () => CollabRole[];
    isRoleEditorClean: () => boolean;
}

export interface CollabFormFieldsProps {
    // 1. Target Domain
    domain: string;
    onDomainChange: (domain: string, isValid: boolean) => void;

    // 2. The Hook
    hook: string;
    onHookChange: (hook: string) => void;

    // 3. Project Overview
    projectOverview: string;
    onProjectOverviewChange: (overview: string) => void;

    // 4. What We Need (Roles)
    roles: CollabRole[];
    onRolesChange: (roles: CollabRole[]) => void;

    // 5. Who Can Collaborate (Optional)
    experience: string;
    onExperienceChange: (exp: string) => void;

    background: string;
    onBackgroundChange: (bg: string) => void;

    availability: string;
    onAvailabilityChange: (avail: string) => void;

    locationType: string;
    onLocationTypeChange: (loc: string) => void;

    specificLocation: string;
    onSpecificLocationChange: (specLoc: string) => void;

    // 6. Collaboration Type
    collabTypes: string[];
    onToggleCollabType: (type: string) => void;

    // 7. Project Status
    projectStatus: string;
    onProjectStatusChange: (status: string) => void;

    // 8. Visual Attachment
    mediaFile?: File | null;
    previewUrl?: string | null;
    existingMediaUrl?: string | null;
    existingMediaType?: 'image' | 'video' | null;
    isMediaRemoved?: boolean;
    onFileSelect: (file: File) => void;
    onRemoveMedia: () => void;

    errorMessage?: string | null;
}

export const CollabFormFields = forwardRef<CollabFormFieldsRef, CollabFormFieldsProps>(({
    domain,
    onDomainChange,
    hook,
    onHookChange,
    projectOverview,
    onProjectOverviewChange,
    roles,
    onRolesChange,
    experience,
    onExperienceChange,
    background,
    onBackgroundChange,
    availability,
    onAvailabilityChange,
    locationType,
    onLocationTypeChange,
    specificLocation,
    onSpecificLocationChange,
    collabTypes,
    onToggleCollabType,
    projectStatus,
    onProjectStatusChange,
    mediaFile,
    previewUrl,
    existingMediaUrl,
    existingMediaType,
    isMediaRemoved,
    onFileSelect,
    onRemoveMedia,
    errorMessage,
}, ref) => {
    // Active Role Editor State
    const [isEditingRole, setIsEditingRole] = useState<boolean>(roles.length === 0);
    const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
    const [roleTitle, setRoleTitle] = useState<string>('');
    const [roleCount, setRoleCount] = useState<number | string>(1);
    const [roleSkills, setRoleSkills] = useState<string[]>([]);
    const [skillInput, setSkillInput] = useState<string>('');
    const [roleResponsibilities, setRoleResponsibilities] = useState<string>('');
    const [roleError, setRoleError] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Compute effective roles including pending editor if valid
    const getEffectiveRoles = (): CollabRole[] => {
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
        return effectiveRoles;
    };

    useImperativeHandle(ref, () => ({
        getEffectiveRoles,
        isRoleEditorClean: () => !roleTitle.trim(),
    }));

    // Skill handling
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

    // Role saving / updating
    const handleSaveRole = () => {
        if (!roleTitle.trim()) {
            setRoleError('Role title is required');
            return;
        }

        const countNum = parseInt(String(roleCount), 10) || 1;

        if (editingRoleId) {
            // Update existing
            const updated = roles.map(r => r.id === editingRoleId ? {
                id: editingRoleId,
                title: roleTitle.trim(),
                count: countNum,
                skills: roleSkills,
                responsibilities: roleResponsibilities.trim(),
            } : r);
            onRolesChange(updated);
        } else {
            // Add new
            const newRole: CollabRole = {
                id: `role_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                title: roleTitle.trim(),
                count: countNum,
                skills: roleSkills,
                responsibilities: roleResponsibilities.trim(),
            };
            onRolesChange([...roles, newRole]);
        }

        // Reset editor
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
        onRolesChange(updated);
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

    // File handling
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            onFileSelect(file);
        }
    };

    // Current displayed media logic (new upload or existing)
    const currentMediaDisplayUrl = previewUrl || (!isMediaRemoved ? existingMediaUrl : null);
    const currentMediaIsVideo = (mediaFile && mediaFile.type.startsWith('video')) || 
        (!mediaFile && existingMediaType === 'video') || 
        Boolean(currentMediaDisplayUrl && currentMediaDisplayUrl.match(/\.(mp4|webm|mov)$/i));

    return (
        <div className="space-y-6 text-zinc-300 font-mono text-xs">
            {/* Error Notification */}
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
                    onChange={onDomainChange}
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
                    onChange={(e) => onHookChange(e.target.value)}
                    placeholder="A concise one-line description of what you’re building or looking for..."
                    className="w-full bg-black/60 border border-zinc-800 px-3.5 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 text-xs font-mono transition-colors"
                    maxLength={160}
                    required
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
                    onChange={(e) => onProjectOverviewChange(e.target.value)}
                    placeholder="Describe the project, the problem you’re solving, your current progress, and what you want to achieve..."
                    className="w-full bg-black/60 border border-zinc-800 p-3.5 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 text-xs font-mono min-h-[100px] resize-none transition-colors leading-relaxed"
                    rows={4}
                    required
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
                        <p className="text-[10px] text-zinc-500 mt-0.5">At least one collaboration role is required</p>
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
                                    onClick={() => onExperienceChange(experience === opt ? '' : opt)}
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
                                    onClick={() => onBackgroundChange(background === opt ? '' : opt)}
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
                                    onClick={() => onAvailabilityChange(availability === opt ? '' : opt)}
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
                                    onClick={() => onLocationTypeChange(locationType === opt ? '' : opt)}
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
                                onChange={(e) => onSpecificLocationChange(e.target.value)}
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
                                onClick={() => onToggleCollabType(type)}
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
                                onClick={() => onProjectStatusChange(isSelected ? '' : status)}
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

                {currentMediaDisplayUrl ? (
                    <div className="relative border border-zinc-800 bg-black overflow-hidden group">
                        {currentMediaIsVideo ? (
                            <video src={currentMediaDisplayUrl} controls className="w-full max-h-56 object-contain" />
                        ) : (
                            <img src={currentMediaDisplayUrl} alt="Project Attachment Preview" className="w-full max-h-56 object-contain" />
                        )}
                        <div className="absolute top-2 right-2 flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="p-1.5 bg-black/80 text-zinc-300 hover:text-white border border-zinc-700 transition-colors text-[10px] uppercase font-bold"
                                title="Replace media"
                            >
                                Replace
                            </button>
                            <button
                                type="button"
                                onClick={onRemoveMedia}
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
    );
});
