import React, { useState, useEffect, useRef } from 'react';
import { 
    CloseIcon, 
    PlusIcon, 
    InformationCircleIcon 
} from '../ui/Icons';
import { CollabRole, CollabDetails } from '../../types';
import { CollabFormFields, CollabFormFieldsRef } from '../collab/CollabFormFields';

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

export const CreateCollabModal: React.FC<CreateCollabModalProps> = ({
    isOpen,
    onClose,
    onPublish,
}) => {
    const collabFieldsRef = useRef<CollabFormFieldsRef>(null);

    // 1. Target Domain
    const [domain, setDomain] = useState<string>('Technology');
    const [isDomainValid, setIsDomainValid] = useState<boolean>(true);

    // 2. The Hook
    const [hook, setHook] = useState<string>('');

    // 3. Project Overview
    const [projectOverview, setProjectOverview] = useState<string>('');

    // 4. What We Need (Roles)
    const [roles, setRoles] = useState<CollabRole[]>([]);

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

    const handleToggleCollabType = (t: string) => {
        setCollabTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
    };

    const handleFileSelect = (file: File) => {
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
        setErrorMessage(null);
    };

    const handleRemoveMedia = () => {
        if (previewUrl && previewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(previewUrl);
        }
        setMediaFile(null);
        setPreviewUrl(null);
    };

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

    const isPublishable = Boolean(
        domain.trim() &&
        isDomainValid &&
        hook.trim() &&
        projectOverview.trim() &&
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
            const draftRoles = collabFieldsRef.current?.getEffectiveRoles() || roles;
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

    // Final Publish
    const handleSubmit = async () => {
        const effectiveRoles = collabFieldsRef.current?.getEffectiveRoles() || roles;
        if (effectiveRoles.length === 0) {
            setErrorMessage('At least one role requirement is needed to publish.');
            return;
        }

        const hasEmptyTitle = effectiveRoles.some(r => !r.title.trim());
        if (hasEmptyTitle) {
            setErrorMessage('All roles must have a title.');
            return;
        }

        if (!domain.trim() || !isDomainValid) {
            setErrorMessage('Please select a valid domain.');
            return;
        }
        if (!hook.trim()) {
            setErrorMessage('The Hook cannot be empty.');
            return;
        }
        if (!projectOverview.trim()) {
            setErrorMessage('Project Overview cannot be empty.');
            return;
        }

        setIsSubmitting(true);
        setErrorMessage(null);

        try {
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
            setExperience('');
            setBackground('');
            setAvailability('');
            setLocationType('');
            setSpecificLocation('');
            setCollabTypes([]);
            setProjectStatus('');
            setMediaFile(null);
            setPreviewUrl(null);

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

                    <CollabFormFields
                        ref={collabFieldsRef}
                        domain={domain}
                        onDomainChange={(val, isValid) => {
                            setDomain(val);
                            setIsDomainValid(isValid);
                        }}
                        hook={hook}
                        onHookChange={setHook}
                        projectOverview={projectOverview}
                        onProjectOverviewChange={setProjectOverview}
                        roles={roles}
                        onRolesChange={setRoles}
                        experience={experience}
                        onExperienceChange={setExperience}
                        background={background}
                        onBackgroundChange={setBackground}
                        availability={availability}
                        onAvailabilityChange={setAvailability}
                        locationType={locationType}
                        onLocationTypeChange={setLocationType}
                        specificLocation={specificLocation}
                        onSpecificLocationChange={setSpecificLocation}
                        collabTypes={collabTypes}
                        onToggleCollabType={handleToggleCollabType}
                        projectStatus={projectStatus}
                        onProjectStatusChange={setProjectStatus}
                        mediaFile={mediaFile}
                        previewUrl={previewUrl}
                        onFileSelect={handleFileSelect}
                        onRemoveMedia={handleRemoveMedia}
                        errorMessage={errorMessage}
                    />
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
