import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { CloseIcon, CheckIcon } from '../ui/Icons';
import {
    submitCollabApplication,
    subscribeToCollabApplications,
    getRoleCapacity
} from '../../services/collabApplicationService';
import { uploadFile, getStoragePath } from '../../services/storageService';
import type { CollabApplication, CollabRole, Project } from '../../types';

interface CollabApplicationModalProps {
    isOpen: boolean;
    onClose: () => void;
    collab: Project;
    onApplied?: (application: CollabApplication) => void;
}

export const CollabApplicationModal: React.FC<CollabApplicationModalProps> = ({
    isOpen,
    onClose,
    collab,
    onApplied,
}) => {
    const { currentUser, userProfile } = useAuth();
    const [selectedRoleId, setSelectedRoleId] = useState<string>('');
    const [message, setMessage] = useState('');
    const [supportingFile, setSupportingFile] = useState<File | null>(null);
    const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [existingApps, setExistingApps] = useState<CollabApplication[]>([]);

    // Clean up file preview and form state on close
    useEffect(() => {
        if (!isOpen) {
            setSupportingFile(null);
            if (filePreviewUrl) {
                URL.revokeObjectURL(filePreviewUrl);
                setFilePreviewUrl(null);
            }
            setUploadProgress(null);
            setError(null);
            setMessage('');
            setSelectedRoleId('');
        }
    }, [isOpen]);

    // Subscribe to existing applications on this collab to know filled state and user's past applications
    useEffect(() => {
        if (!collab?.id) return;
        const unsubscribe = subscribeToCollabApplications(
            collab.id,
            (apps) => {
                setExistingApps(apps);
            },
            (err) => {
                console.warn('[COLLAB_APPS_SUBSCRIPTION_WARN]', err);
            }
        );
        return () => unsubscribe();
    }, [collab?.id]);

    const roles: CollabRole[] = useMemo(() => {
        const rawRoles = collab.collabDetails?.roles;
        const list: any[] = Array.isArray(rawRoles)
            ? rawRoles
            : (rawRoles && typeof rawRoles === 'object' ? Object.values(rawRoles) : []);

        if (list.length > 0) {
            return list.map((r, index) => ({
                id: r.id || `role-${index}-${(r.title || 'role').toLowerCase().replace(/\s+/g, '-')}`,
                title: r.title || 'Collaborator',
                count: r.count || 1,
                skills: Array.isArray(r.skills) ? r.skills : (typeof r.skills === 'string' ? [r.skills] : []),
                responsibilities: r.responsibilities || '',
            }));
        }
        // Fallback single default role if not explicitly structured
        return [{
            id: 'role-default',
            title: 'Collaborator',
            count: 1,
            skills: [],
            responsibilities: '',
        }];
    }, [collab.collabDetails?.roles]);

    // Map each role with its live capacity & user application status
    const rolesWithCapacity = useMemo(() => {
        return roles.map(role => {
            const capacity = getRoleCapacity(role, existingApps);
            const userApp = existingApps.find(
                a => a.applicantId === currentUser?.uid &&
                     a.roleId === role.id &&
                     (a.status === 'PENDING' || a.status === 'ACCEPTED')
            );
            return {
                role,
                ...capacity,
                userApp,
                isApplied: Boolean(userApp),
            };
        });
    }, [roles, existingApps, currentUser?.uid]);

    // Auto-select single available role if only one exists or pick first selectable
    useEffect(() => {
        if (!isOpen) return;
        setError(null);
        setSuccessMessage(null);
        setMessage('');

        if (rolesWithCapacity.length === 1) {
            const single = rolesWithCapacity[0];
            if (!single.isFilled && !single.isApplied) {
                setSelectedRoleId(single.role.id);
            } else {
                setSelectedRoleId('');
            }
        } else if (!selectedRoleId || !rolesWithCapacity.some(r => r.role.id === selectedRoleId)) {
            // Find first available role
            const firstAvailable = rolesWithCapacity.find(r => !r.isFilled && !r.isApplied);
            if (firstAvailable) {
                setSelectedRoleId(firstAvailable.role.id);
            }
        }
    }, [isOpen, rolesWithCapacity]);

    if (!isOpen) return null;

    const isCreator = Boolean(
        currentUser && (
            (collab.authorId && collab.authorId === currentUser.uid) ||
            (currentUser.displayName && collab.author?.name === currentUser.displayName)
        )
    );

    const selectedRoleData = rolesWithCapacity.find(r => r.role.id === selectedRoleId);

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const handleFileSelect = (file: File) => {
        setError(null);
        const validExtensions = ['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg'];
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        const validMimes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'image/png',
            'image/jpeg',
        ];

        if (!validExtensions.includes(ext) && !validMimes.includes(file.type)) {
            setError('Unsupported file format. Please upload PDF, DOC, DOCX, PNG, or JPG.');
            return;
        }

        const MAX_SIZE = 10 * 1024 * 1024; // 10MB
        if (file.size > MAX_SIZE) {
            setError('File size exceeds 10MB limit. Please upload a smaller document.');
            return;
        }

        setSupportingFile(file);

        // Create thumbnail if image
        if (file.type.startsWith('image/')) {
            const url = URL.createObjectURL(file);
            setFilePreviewUrl(url);
        } else {
            setFilePreviewUrl(null);
        }
    };

    const handleRemoveFile = () => {
        setSupportingFile(null);
        if (filePreviewUrl) {
            URL.revokeObjectURL(filePreviewUrl);
            setFilePreviewUrl(null);
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!currentUser) {
            setError('Authentication required. Please sign in to apply.');
            return;
        }

        if (isCreator) {
            setError('You cannot apply to your own collaboration project.');
            return;
        }

        if (!selectedRoleId || !selectedRoleData) {
            setError('Please select an available role to apply for.');
            return;
        }

        if (selectedRoleData.isFilled) {
            setError('The selected role has already been filled.');
            return;
        }

        if (selectedRoleData.isApplied) {
            setError('You have already submitted an active application for this role.');
            return;
        }

        setSubmitting(true);
        try {
            let uploadedDocMeta: {
                name: string;
                url: string;
                size?: number;
                type?: string;
                uploadedAt?: string;
            } | undefined = undefined;

            if (supportingFile) {
                try {
                    const storagePath = getStoragePath('collabApplications', currentUser.uid, supportingFile.name);
                    const uploaded = await uploadFile(storagePath, supportingFile, {
                        onProgress: (progress) => setUploadProgress(progress),
                    });
                    uploadedDocMeta = {
                        name: supportingFile.name,
                        url: uploaded.url,
                        size: supportingFile.size,
                        type: supportingFile.type || 'application/octet-stream',
                        uploadedAt: new Date().toISOString(),
                    };
                } catch (uploadErr) {
                    console.warn('[COLLAB_DOC_UPLOAD_WARN] Storage upload failed, attempting fallback:', uploadErr);
                    if (supportingFile.size <= 500 * 1024) {
                        const reader = new FileReader();
                        const dataUrl = await new Promise<string>((resolve, reject) => {
                            reader.onload = () => resolve(reader.result as string);
                            reader.onerror = reject;
                            reader.readAsDataURL(supportingFile);
                        });
                        uploadedDocMeta = {
                            name: supportingFile.name,
                            url: dataUrl,
                            size: supportingFile.size,
                            type: supportingFile.type || 'application/octet-stream',
                            uploadedAt: new Date().toISOString(),
                        };
                    } else {
                        throw new Error('Failed to upload supporting document. Please check file size or network connection.');
                    }
                }
            }

            const app = await submitCollabApplication({
                collab,
                role: selectedRoleData.role,
                applicantUser: currentUser,
                applicantProfile: userProfile,
                message,
                supportingDocument: uploadedDocMeta,
            });

            setSuccessMessage(`Application sent for ${selectedRoleData.role.title}`);
            if (onApplied) {
                onApplied(app);
            }

            setTimeout(() => {
                onClose();
            }, 1200);
        } catch (err: any) {
            console.error('[COLLAB_APPLICATION_ERROR]', err);
            setError(err.message || 'Failed to submit application. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
            <div 
                className="bg-[#0c0c0e] border border-zinc-800 w-full max-w-2xl max-h-[92vh] flex flex-col font-mono text-zinc-300 shadow-2xl animate-fadeIn my-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-black">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">// COLLAB_APPLICATION</span>
                            <span className="text-zinc-700">|</span>
                            <span className="text-[10px] text-zinc-400 uppercase tracking-wider">{collab.domain || collab.category || 'COLLABORATION'}</span>
                        </div>
                        <h2 className="text-sm sm:text-base font-bold text-white tracking-wider uppercase mt-0.5">
                            APPLY TO COLLABORATE
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-zinc-500 hover:text-white p-1 transition-colors border border-transparent hover:border-zinc-800"
                        title="Close modal"
                    >
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Modal Scrollable Body */}
                <div className="p-4 sm:p-5 overflow-y-auto space-y-5 text-xs">
                    {/* Feedback Messages */}
                    {error && (
                        <div className="p-3 bg-red-950/40 border border-red-800/80 text-red-300 text-xs">
                            <span className="font-bold">// ERROR:</span> {error}
                        </div>
                    )}
                    {successMessage && (
                        <div className="p-3 bg-emerald-950/40 border border-emerald-800/80 text-emerald-300 text-xs flex items-center gap-2">
                            <CheckIcon className="w-4 h-4 text-emerald-400" />
                            <span><span className="font-bold">// SUCCESS:</span> {successMessage}</span>
                        </div>
                    )}

                    {/* 1. Compact Collab Summary */}
                    <div className="p-3.5 bg-black border border-zinc-800 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-850 pb-2">
                            <div>
                                <span className="text-[9px] text-zinc-500 uppercase tracking-wider block font-bold">// TARGET_COLLAB</span>
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                                    "{collab.aiSummary || collab.oneLine || 'Collaborative Project'}"
                                </h3>
                            </div>
                            <div className="text-right">
                                <span className="text-[9px] text-zinc-500 uppercase tracking-wider block font-bold">// CREATOR</span>
                                <div className="flex items-center gap-1.5 text-zinc-300 text-xs">
                                    {collab.author?.avatarUrl && (
                                        <img 
                                            src={collab.author.avatarUrl} 
                                            alt={collab.author.name} 
                                            className="w-4 h-4 rounded-none border border-zinc-700 object-cover" 
                                        />
                                    )}
                                    <span className="font-bold">{collab.author?.name || 'Project Creator'}</span>
                                </div>
                            </div>
                        </div>

                        {collab.description && (
                            <p className="text-zinc-400 text-xs leading-relaxed line-clamp-2">
                                {collab.description}
                            </p>
                        )}

                        {/* Collab metadata tags */}
                        <div className="flex flex-wrap gap-2 text-[10px] text-zinc-400 pt-1">
                            {collab.collabDetails?.projectStatus && (
                                <span className="bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-zinc-300">
                                    STATUS: {collab.collabDetails.projectStatus}
                                </span>
                            )}
                            {(collab.collabDetails?.location || collab.collabDetails?.collabTypes) && (
                                <span className="bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-zinc-300">
                                    {[...(collab.collabDetails?.collabTypes || []), collab.collabDetails?.location === 'Specific Location' ? collab.collabDetails.specificLocation : collab.collabDetails?.location].filter(Boolean).join(' • ')}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Creator Warning */}
                    {isCreator && (
                        <div className="p-3 bg-amber-950/30 border border-amber-800/80 text-amber-300 text-xs">
                            <span className="font-bold">// NOTICE:</span> You created this Collab project. Project creators cannot apply to their own roles. You can manage incoming applications under <span className="text-white font-bold">MY SPACE → COLLABS</span>.
                        </div>
                    )}

                    {/* 2. Available Roles Selection */}
                    <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">// AVAILABLE_ROLES</span>
                            <span className="text-[10px] text-zinc-500 uppercase">
                                {rolesWithCapacity.length > 1 ? 'SELECT ONE ROLE TO APPLY' : 'OFFERED ROLE'}
                            </span>
                        </div>

                        <div className="space-y-2">
                            {rolesWithCapacity.map(({ role, total, remaining, isFilled, isApplied, userApp }, idx) => {
                                const isSelected = selectedRoleId === role.id;
                                const isDisabled = isFilled || isApplied || isCreator;
                                const roleKey = role.id || `role-${idx}-${role.title}`;

                                return (
                                    <div
                                        key={roleKey}
                                        onClick={() => {
                                            if (!isDisabled) {
                                                setSelectedRoleId(role.id);
                                            }
                                        }}
                                        className={`invox-role-card p-3 text-left relative ${
                                            isDisabled
                                                ? 'is-disabled bg-zinc-950/60 opacity-60 cursor-not-allowed border-[rgba(255,255,255,0.10)]'
                                                : isSelected
                                                ? 'is-selected bg-zinc-900/90 border-[rgba(255,255,255,0.60)] cursor-pointer shadow-md'
                                                : 'bg-[#0c0c0e] border-[rgba(255,255,255,0.18)] hover:border-[rgba(255,255,255,0.30)] cursor-pointer'
                                        }`}
                                    >
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                            <div className="flex items-center gap-2.5">
                                                <div className={`w-3.5 h-3.5 border flex items-center justify-center transition-colors ${
                                                    isSelected ? 'border-white bg-white text-black' : 'border-zinc-700 bg-black'
                                                }`}>
                                                    {isSelected && <div className="w-1.5 h-1.5 bg-black" />}
                                                </div>
                                                <div>
                                                    <span className="font-bold text-white text-xs uppercase tracking-wider">
                                                        {role.title}
                                                    </span>
                                                    <span className="text-zinc-400 ml-2 text-[11px] font-mono">
                                                        ×{total}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Status Badge */}
                                            <div className="flex items-center gap-2">
                                                {isApplied ? (
                                                    <span className="text-[10px] font-bold text-amber-400 bg-amber-950/40 border border-amber-800/80 px-2 py-0.5 uppercase tracking-wider">
                                                        // {userApp?.status === 'ACCEPTED' ? 'ACCEPTED' : 'ALREADY_APPLIED'}
                                                    </span>
                                                ) : isFilled ? (
                                                    <span className="text-[10px] font-bold text-zinc-500 bg-zinc-900 border border-zinc-800 px-2 py-0.5 uppercase tracking-wider">
                                                        // FILLED
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/30 border border-emerald-800/80 px-2 py-0.5 uppercase tracking-wider">
                                                        {remaining} {remaining === 1 ? 'POSITION REMAINING' : 'POSITIONS REMAINING'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Skills */}
                                        {role.skills && role.skills.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 mt-2.5">
                                                {role.skills.map((skill, sIdx) => (
                                                    <span
                                                        key={`${role.id || idx}-skill-${sIdx}-${skill}`}
                                                        className="text-[10px] bg-black border border-zinc-800 px-2 py-0.5 text-zinc-300"
                                                    >
                                                        {skill}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {/* Responsibilities */}
                                        {role.responsibilities && (
                                            <div className="mt-2 text-[11px] text-zinc-400 border-t border-zinc-850/80 pt-2">
                                                <span className="text-zinc-500 font-bold block">// RESPONSIBILITIES:</span>
                                                <p className="mt-0.5 leading-relaxed">{role.responsibilities}</p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* 3. Applicant Profile Snapshot Preview */}
                    <div className="p-3.5 bg-black border border-zinc-800 space-y-2.5">
                        <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
                            <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">// APPLICANT_PROFILE_SNAPSHOT</span>
                            <span className="text-[9px] text-zinc-500 uppercase">Visible to Collab Creator</span>
                        </div>

                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 bg-zinc-900 border border-zinc-700 flex items-center justify-center flex-shrink-0">
                                {userProfile?.photoURL || currentUser?.photoURL ? (
                                    <img
                                        src={userProfile?.photoURL || currentUser?.photoURL || ''}
                                        alt="Avatar"
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <span className="font-bold text-white text-xs">
                                        {(userProfile?.displayName || currentUser?.displayName || 'U').charAt(0).toUpperCase()}
                                    </span>
                                )}
                            </div>
                            <div className="flex-grow min-w-0 space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-white text-xs truncate">
                                        {userProfile?.displayName || currentUser?.displayName || 'Applicant User'}
                                    </span>
                                    <span className="text-zinc-500 text-[11px]">
                                        @{userProfile?.username || currentUser?.email?.split('@')[0] || 'applicant'}
                                    </span>
                                </div>
                                {userProfile?.headline && (
                                    <p className="text-[11px] text-zinc-400 truncate">{userProfile.headline}</p>
                                )}
                                {userProfile?.location && (
                                    <p className="text-[10px] text-zinc-500">{userProfile.location}</p>
                                )}
                            </div>
                        </div>

                        {/* Skills snapshot */}
                        {userProfile?.skills && userProfile.skills.length > 0 && (
                            <div className="pt-2 border-t border-zinc-850">
                                <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold block mb-1">// YOUR_VERIFIED_SKILLS</span>
                                <div className="flex flex-wrap gap-1">
                                    {userProfile.skills.map((sk, idx) => (
                                        <span key={`user-skill-${idx}-${sk}`} className="text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-300 px-1.5 py-0.5">
                                            {sk}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Links snapshot */}
                        {(userProfile?.portfolioURL || userProfile?.website) && (
                            <div className="pt-1.5 text-[10px] text-zinc-400">
                                <span className="text-zinc-500 font-bold">PORTFOLIO / SHOWCASE:</span>{' '}
                                <span className="text-zinc-200 underline">{userProfile.portfolioURL || userProfile.website}</span>
                            </div>
                        )}

                        <p className="text-[10px] text-zinc-500 italic pt-1">
                            Your INVOX profile telemetry is automatically attached to this application. No manual re-entry required.
                        </p>
                    </div>

                    {/* 4. Optional Application Message: // WHY_YOU? */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <label htmlFor="why-you-input" className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">
                                // WHY_YOU? <span className="text-zinc-500 font-normal">(OPTIONAL)</span>
                            </label>
                            <span className="text-[9px] text-zinc-500">{message.length}/500</span>
                        </div>
                        <textarea
                            id="why-you-input"
                            rows={3}
                            maxLength={500}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Tell the creator why you'd be a good fit for this role..."
                            className="w-full bg-black border border-zinc-800 p-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors resize-none leading-relaxed font-mono"
                        />
                    </div>

                    {/* 5. Optional Supporting Document */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">
                                // SUPPORTING_DOCUMENT <span className="text-zinc-500 font-normal">OPTIONAL</span>
                            </label>
                            <span className="text-[9px] text-zinc-500 uppercase tracking-wider">MAX 10MB</span>
                        </div>

                        {!supportingFile ? (
                            <div
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setIsDragging(true);
                                }}
                                onDragLeave={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setIsDragging(false);
                                }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setIsDragging(false);
                                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                                        handleFileSelect(e.dataTransfer.files[0]);
                                    }
                                }}
                                onClick={() => fileInputRef.current?.click()}
                                className={`border border-dashed transition-all p-4 text-center cursor-pointer bg-black ${
                                    isDragging
                                        ? 'border-white bg-zinc-900/50'
                                        : 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-950'
                                }`}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    className="hidden"
                                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg"
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                            handleFileSelect(e.target.files[0]);
                                        }
                                    }}
                                />
                                <div className="flex flex-col items-center justify-center gap-1.5 py-1">
                                    <div className="w-7 h-7 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-300">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                        </svg>
                                    </div>
                                    <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                                        ↑ ATTACH SUPPORTING DOCUMENT
                                    </span>
                                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                                        PDF / DOC / DOCX / PNG / JPG
                                    </span>
                                </div>
                                <p className="text-[10px] text-zinc-500 italic mt-2">
                                    Optional — add a resume, portfolio, case study, research work, or other relevant document.
                                </p>
                            </div>
                        ) : (
                            <div className="p-3 bg-black border border-zinc-800 space-y-2">
                                <div className="flex items-center justify-between border-b border-zinc-850 pb-1.5">
                                    <span className="text-[9px] text-zinc-400 uppercase tracking-widest font-bold">// ATTACHED_DOCUMENT</span>
                                    <span className="text-[9px] text-emerald-400 font-mono">READY_FOR_TRANSMISSION</span>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        {filePreviewUrl ? (
                                            <div className="w-8 h-8 bg-zinc-900 border border-zinc-700 flex-shrink-0 overflow-hidden">
                                                <img src={filePreviewUrl} alt="Preview" className="w-full h-full object-cover" />
                                            </div>
                                        ) : (
                                            <div className="w-8 h-8 bg-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-400 flex-shrink-0">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <div className="text-xs font-mono text-white truncate max-w-xs">{supportingFile.name}</div>
                                            <div className="text-[10px] font-mono text-zinc-500">{formatFileSize(supportingFile.size)}</div>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleRemoveFile}
                                        className="text-[11px] font-mono text-red-400 hover:text-red-300 bg-red-950/20 hover:bg-red-950/40 border border-red-900/60 px-2.5 py-1 uppercase tracking-wider transition-colors"
                                    >
                                        // REMOVE
                                    </button>
                                </div>
                                {uploadProgress !== null && (
                                    <div className="w-full bg-zinc-900 h-1 mt-2">
                                        <div
                                            className="bg-white h-1 transition-all duration-200"
                                            style={{ width: `${uploadProgress}%` }}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Modal Footer Actions */}
                <div className="p-4 border-t border-zinc-800 bg-black flex items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="px-4 py-2 bg-transparent text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700 text-xs font-mono uppercase tracking-wider transition-colors disabled:opacity-50"
                    >
                        CANCEL
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={submitting || isCreator || !selectedRoleId || selectedRoleData?.isFilled || selectedRoleData?.isApplied}
                        className="px-6 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-bold border border-zinc-700 hover:border-zinc-500 text-xs font-mono uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {submitting ? (
                            <>
                                <div className="w-3.5 h-3.5 border-2 border-zinc-500 border-t-white rounded-full animate-spin" />
                                <span>// TRANSMITTING...</span>
                            </>
                        ) : (
                            <span>// APPLY</span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
