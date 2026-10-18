import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    XMarkIcon, 
    ArrowUpTrayIcon, 
    TrashIcon, 
    PlusIcon, 
    CheckIcon,
    SparklesIcon
} from '../ui/Icons';
import { TargetDomainSelector } from '../ui/TargetDomainSelector';
import { CollabFormFields, CollabFormFieldsRef } from '../collab/CollabFormFields';
import { updatePost } from '../../services/postService';
import { getUserChannels } from '../../services/channelService';
import { useAuth } from '../../contexts/AuthContext';
import { Post, PostType, CollabRole, CollabDetails, Channel } from '../../types';

interface EditPostModalProps {
    isOpen: boolean;
    post: Post | null;
    onClose: () => void;
    onUpdated?: (updatedPost: Post) => void;
}

const COLLAB_TYPES = ['Mentorship', 'Brainstorming', 'Co-founding', 'Side-project', 'Hackathon', 'Open Source', 'Research'];
const PROJECT_STATUSES = ['Ideation', 'Prototype', 'MVP', 'Beta', 'Live / In Production'];
const LOCATIONS = ['Remote', 'Hybrid', 'Specific Location'];

export const EditPostModal: React.FC<EditPostModalProps> = ({
    isOpen,
    post,
    onClose,
    onUpdated,
}) => {
    const { currentUser } = useAuth();
    const collabFieldsRef = useRef<CollabFormFieldsRef>(null);

    // Determine post kind
    const postType = post?.type || PostType.Feed;
    const isCollab = postType === PostType.Collab || Boolean(post?.collabDetails);
    const isThread = postType === PostType.Thread;
    const isQuery = postType === PostType.Query;
    const isShowcase = postType === PostType.Showcase || Boolean((post as any)?.isProject) || ((post?.category || '').toLowerCase() === 'showcase') || Boolean(post?.demoUrl) || Boolean(post?.githubUrl);
    const isFeed = !isCollab && !isThread && !isQuery && !isShowcase;

    // Fields
    const [title, setTitle] = useState('');
    const [oneLine, setOneLine] = useState('');
    const [content, setContent] = useState('');
    const [domain, setDomain] = useState('Technology');
    const [isDomainValid, setIsDomainValid] = useState(true);

    // Showcase specific fields
    const [demoUrl, setDemoUrl] = useState('');
    const [githubUrl, setGithubUrl] = useState('');
    const [articleUrl, setArticleUrl] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');
    const [status, setStatus] = useState<'published' | 'draft'>('published');

    // Channel (Feeds only)
    const [userChannels, setUserChannels] = useState<Channel[]>([]);
    const [selectedChannelId, setSelectedChannelId] = useState<string>('');

    // Media
    const [existingMediaUrl, setExistingMediaUrl] = useState<string | null>(null);
    const [existingMediaType, setExistingMediaType] = useState<'image' | 'video' | null>(null);
    const [mediaFile, setMediaFile] = useState<File | null>(null);
    const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
    const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
    const [isMediaRemoved, setIsMediaRemoved] = useState(false);

    // Collab Details
    const [roles, setRoles] = useState<CollabRole[]>([]);
    const [experience, setExperience] = useState('');
    const [background, setBackground] = useState('');
    const [availability, setAvailability] = useState('');
    const [location, setLocation] = useState('Remote');
    const [specificLocation, setSpecificLocation] = useState('');
    const [collabTypes, setCollabTypes] = useState<string[]>([]);
    const [projectStatus, setProjectStatus] = useState('MVP');

    // UI states
    const [isSaving, setIsSaving] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
    const [notificationMessage, setNotificationMessage] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Populate initial data when modal opens
    useEffect(() => {
        if (isOpen && post) {
            setTitle(post.title || post.oneLine || post.aiSummary || '');
            setOneLine(post.oneLine || post.aiSummary || '');
            setContent(post.content || '');
            setDomain(post.domain || post.category || 'Technology');
            setSelectedChannelId(post.channelId || '');
            
            // Showcase fields
            setDemoUrl(post.demoUrl || '');
            setGithubUrl(post.githubUrl || post.repoUrl || '');
            setArticleUrl(post.articleUrl || '');
            setTags(Array.isArray(post.tags) ? [...post.tags] : []);
            setStatus(post.status === 'draft' ? 'draft' : 'published');

            setExistingMediaUrl(post.mediaUrl || null);
            setExistingMediaType(post.mediaType || null);
            setMediaFile(null);
            setMediaPreviewUrl(null);
            setMediaType(null);
            setIsMediaRemoved(false);

            if (post.collabDetails) {
                setRoles(
                    Array.isArray(post.collabDetails.roles) && post.collabDetails.roles.length > 0
                        ? post.collabDetails.roles.map(r => ({
                            id: r.id || `role-${Math.random().toString(36).substring(2, 7)}`,
                            title: r.title || '',
                            count: r.count || 1,
                            skills: Array.isArray(r.skills) ? [...r.skills] : [],
                            responsibilities: r.responsibilities || '',
                        }))
                        : [{ id: 'role-1', title: 'Developer', count: 1, skills: [], responsibilities: '' }]
                );
                setExperience(post.collabDetails.experience || '');
                setBackground(post.collabDetails.background || '');
                setAvailability(post.collabDetails.availability || '');
                setLocation(post.collabDetails.location || 'Remote');
                setSpecificLocation(post.collabDetails.specificLocation || '');
                setCollabTypes(Array.isArray(post.collabDetails.collabTypes) ? [...post.collabDetails.collabTypes] : ['Open Collaboration']);
                setProjectStatus(post.collabDetails.projectStatus || 'MVP');
            } else {
                setRoles([{ id: 'role-1', title: 'Developer', count: 1, skills: [], responsibilities: '' }]);
                setExperience('');
                setBackground('');
                setAvailability('');
                setLocation('Remote');
                setSpecificLocation('');
                setCollabTypes(['Open Collaboration']);
                setProjectStatus('MVP');
            }

            setErrorMessage(null);
            setShowDiscardConfirm(false);
            setNotificationMessage(null);
        }
    }, [isOpen, post]);

    // Load user channels for Feed broadcasts
    useEffect(() => {
        if (isOpen && isFeed && currentUser?.uid) {
            getUserChannels(currentUser.uid)
                .then(channels => {
                    setUserChannels(channels);
                    if (!selectedChannelId && channels.length > 0) {
                        setSelectedChannelId(channels[0].id);
                    }
                })
                .catch(err => {
                    console.warn('[EDIT_MODAL_CHANNELS_LOAD_WARN]', err);
                });
        }
    }, [isOpen, isFeed, currentUser?.uid]);

    // Lock body scroll
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    // Check if form is dirty
    const isDirty = useMemo(() => {
        if (!post) return false;
        if (oneLine.trim() !== (post.oneLine || post.aiSummary || '').trim()) return true;
        if (content.trim() !== (post.content || '').trim()) return true;
        if (domain.trim() !== (post.domain || post.category || 'Technology').trim()) return true;
        if (isFeed && selectedChannelId !== (post.channelId || '')) return true;
        if (mediaFile !== null) return true;
        if (isMediaRemoved && Boolean(post.mediaUrl)) return true;
        if (isCollab) {
            if (roles.length !== (post.collabDetails?.roles?.length || 0)) return true;
            if (experience !== (post.collabDetails?.experience || '')) return true;
            if (background !== (post.collabDetails?.background || '')) return true;
            if (availability !== (post.collabDetails?.availability || '')) return true;
            if (location !== (post.collabDetails?.location || 'Remote')) return true;
            if (specificLocation !== (post.collabDetails?.specificLocation || '')) return true;
            if (projectStatus !== (post.collabDetails?.projectStatus || 'MVP')) return true;
        }
        return false;
    }, [post, oneLine, content, domain, isFeed, selectedChannelId, mediaFile, isMediaRemoved, isCollab, roles, experience, background, availability, location, specificLocation, projectStatus]);

    // Handle close with discard check
    const handleAttemptClose = () => {
        if (isSaving) return;
        if (isDirty) {
            setShowDiscardConfirm(true);
        } else {
            onClose();
        }
    };

    // Handle escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (showDiscardConfirm) {
                    setShowDiscardConfirm(false);
                } else if (isOpen) {
                    handleAttemptClose();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, showDiscardConfirm, isDirty, isSaving]);

    // File input handler
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 50 * 1024 * 1024) {
            setErrorMessage('File exceeds 50MB limit.');
            return;
        }

        setMediaFile(file);
        setIsMediaRemoved(false);
        const objectUrl = URL.createObjectURL(file);
        setMediaPreviewUrl(objectUrl);
        setMediaType(file.type.startsWith('video') ? 'video' : 'image');
    };

    const handleRemoveMedia = () => {
        setMediaFile(null);
        if (mediaPreviewUrl) {
            URL.revokeObjectURL(mediaPreviewUrl);
            setMediaPreviewUrl(null);
        }
        setExistingMediaUrl(null);
        setExistingMediaType(null);
        setMediaType(null);
        setIsMediaRemoved(true);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const toggleCollabType = (t: string) => {
        setCollabTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
    };

    // Save handler
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!post) return;

        const trimmedOneLine = oneLine.trim();
        const trimmedContent = content.trim();

        if (!trimmedOneLine) {
            setErrorMessage('Header / Hook cannot be empty.');
            return;
        }
        if (!trimmedContent) {
            setErrorMessage('Content description cannot be empty.');
            return;
        }
        if (!isDomainValid || !domain.trim()) {
            setErrorMessage('Please select or enter a valid domain.');
            return;
        }

        let effectiveRoles = roles;
        if (isCollab) {
            effectiveRoles = collabFieldsRef.current?.getEffectiveRoles() || roles;
            if (effectiveRoles.length === 0) {
                setErrorMessage('At least one collaboration role is required.');
                return;
            }
            const hasInvalidRole = effectiveRoles.some(r => !r.title.trim());
            if (hasInvalidRole) {
                setErrorMessage('Every required role must have a specified title.');
                return;
            }
        }

        setIsSaving(true);
        setErrorMessage(null);

        try {
            const updatePayload: any = {
                oneLine: trimmedOneLine,
                content: trimmedContent,
                category: domain.trim(),
                domain: domain.trim(),
            };

            // Feeds channel
            if (isFeed && selectedChannelId) {
                updatePayload.channelId = selectedChannelId;
                const matchedChannel = userChannels.find(c => c.id === selectedChannelId);
                if (matchedChannel) {
                    updatePayload.channelName = matchedChannel.name;
                    updatePayload.channelAvatarUrl = matchedChannel.avatarUrl || null;
                }
            }

            // Media
            if (mediaFile) {
                updatePayload.mediaFile = mediaFile;
            } else if (isMediaRemoved) {
                updatePayload.mediaUrl = null;
                updatePayload.mediaType = null;
            }

            // Collab Details
            if (isCollab) {
                const cleanedCollab: CollabDetails = {
                    roles: effectiveRoles.map(r => ({
                        id: r.id,
                        title: r.title.trim(),
                        count: Number(r.count) || 1,
                        skills: r.skills || [],
                        responsibilities: (r.responsibilities || '').trim(),
                    })),
                    experience: experience.trim() || undefined,
                    background: background.trim() || undefined,
                    availability: availability.trim() || undefined,
                    location: location.trim() || undefined,
                    specificLocation: location === 'Specific Location' ? specificLocation.trim() : undefined,
                    collabTypes: collabTypes.length > 0 ? collabTypes : undefined,
                    projectStatus: projectStatus || undefined,
                };
                updatePayload.collabDetails = cleanedCollab;
            }

            // Showcase Details
            if (isShowcase) {
                updatePayload.title = title.trim() || trimmedOneLine;
                updatePayload.demoUrl = demoUrl.trim() || null;
                updatePayload.githubUrl = githubUrl.trim() || null;
                updatePayload.repoUrl = githubUrl.trim() || null;
                updatePayload.articleUrl = articleUrl.trim() || null;
                updatePayload.tags = tags;
                updatePayload.status = status;
                updatePayload.isPublished = status !== 'draft';
            }

            const updated = await updatePost(post.id, updatePayload, (progress) => {
                setUploadProgress(progress);
            });

            setNotificationMessage('// TRANSMISSION UPDATED SUCCESSFULLY');
            onUpdated?.(updated);

            setTimeout(() => {
                onClose();
            }, 500);
        } catch (err: any) {
            console.error('[POST_EDIT_ERROR]', err);
            setErrorMessage(err.message || 'Failed to update transmission.');
            setIsSaving(false);
        }
    };

    if (!isOpen || !post) return null;

    // Header label calculation
    let modalTitle = '// EDIT TRANSMISSION · FEED';
    if (isCollab) {
        modalTitle = '// EDIT TRANSMISSION · COLLAB';
    } else if (isShowcase) {
        modalTitle = '// EDIT TRANSMISSION · SHOWCASE';
    } else if (isThread) {
        modalTitle = '// EDIT TRANSMISSION · THREAD';
    } else if (isQuery) {
        modalTitle = '// EDIT TRANSMISSION · QUERY';
    }

    const currentDisplayMedia = mediaPreviewUrl || (!isMediaRemoved ? existingMediaUrl : null);
    const currentDisplayMediaType = mediaType || (!isMediaRemoved ? existingMediaType : null);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
            {/* Modal Box */}
            <div 
                className="bg-[#0c0c0e] border border-zinc-800 w-full max-w-2xl max-h-[90vh] flex flex-col font-mono text-xs shadow-2xl relative"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/70">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-white inline-block"></span>
                        <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                            {modalTitle}
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={handleAttemptClose}
                        className="text-zinc-400 hover:text-white p-1 transition-colors"
                        aria-label="Close"
                    >
                        <XMarkIcon className="w-4 h-4" />
                    </button>
                </div>

                {/* Notification toast if saved */}
                {notificationMessage && (
                    <div className="bg-emerald-950/90 border-b border-emerald-700/80 px-4 py-2 flex items-center gap-2 text-emerald-300 text-xs font-bold">
                        <CheckIcon className="w-4 h-4 text-emerald-400" />
                        <span>{notificationMessage}</span>
                    </div>
                )}

                {/* Error Banner */}
                {errorMessage && (
                    <div className="bg-red-950/80 border-b border-red-800 px-4 py-2 text-red-300 text-xs flex items-center justify-between">
                        <span>{errorMessage}</span>
                        <button type="button" onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-white">
                            <XMarkIcon className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}

                {/* Scrollable Form Body */}
                <form id="edit-post-form" onSubmit={handleSave} className="overflow-y-auto p-4 sm:p-6 space-y-5 flex-1 custom-scrollbar">
                    {isCollab ? (
                        <CollabFormFields
                            ref={collabFieldsRef}
                            domain={domain}
                            onDomainChange={(val, valid) => {
                                setDomain(val);
                                setIsDomainValid(valid);
                            }}
                            hook={oneLine}
                            onHookChange={setOneLine}
                            projectOverview={content}
                            onProjectOverviewChange={setContent}
                            roles={roles}
                            onRolesChange={setRoles}
                            experience={experience}
                            onExperienceChange={setExperience}
                            background={background}
                            onBackgroundChange={setBackground}
                            availability={availability}
                            onAvailabilityChange={setAvailability}
                            locationType={location}
                            onLocationTypeChange={setLocation}
                            specificLocation={specificLocation}
                            onSpecificLocationChange={setSpecificLocation}
                            collabTypes={collabTypes}
                            onToggleCollabType={toggleCollabType}
                            projectStatus={projectStatus}
                            onProjectStatusChange={setProjectStatus}
                            mediaFile={mediaFile}
                            previewUrl={mediaPreviewUrl}
                            existingMediaUrl={existingMediaUrl}
                            existingMediaType={existingMediaType}
                            isMediaRemoved={isMediaRemoved}
                            onFileSelect={(file) => {
                                if (file.size > 50 * 1024 * 1024) {
                                    setErrorMessage('Attachment must be smaller than 50MB');
                                    return;
                                }
                                if (mediaPreviewUrl && mediaPreviewUrl.startsWith('blob:')) {
                                    URL.revokeObjectURL(mediaPreviewUrl);
                                }
                                const url = URL.createObjectURL(file);
                                setMediaFile(file);
                                setMediaPreviewUrl(url);
                                setMediaType(file.type.startsWith('video') ? 'video' : 'image');
                                setIsMediaRemoved(false);
                                setErrorMessage(null);
                            }}
                            onRemoveMedia={handleRemoveMedia}
                            errorMessage={errorMessage}
                        />
                    ) : (
                        <>
                            {/* Project Title (Showcase only) */}
                            {isShowcase && (
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
                                            // PROJECT TITLE <span className="text-red-400">*</span>
                                        </label>
                                        <span className="text-[10px] text-zinc-500">{title.length}/100</span>
                                    </div>
                                    <input
                                        type="text"
                                        maxLength={100}
                                        value={title}
                                        onChange={e => setTitle(e.target.value)}
                                        placeholder="Enter project title..."
                                        className="w-full bg-zinc-900/60 border border-zinc-800 text-white p-2.5 text-xs focus:border-white focus:outline-none transition-colors"
                                        required={isShowcase}
                                    />
                                </div>
                            )}

                            {/* Header / Hook */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
                                        {isQuery ? '// QUERY HOOK · QUESTION' : isShowcase ? '// PROJECT SUMMARY · HOOK' : '// TRANSMISSION HOOK · ONE-LINER'} <span className="text-red-400">*</span>
                                    </label>
                                    <span className="text-[10px] text-zinc-500">{oneLine.length}/140</span>
                                </div>
                                <input
                                    type="text"
                                    maxLength={140}
                                    value={oneLine}
                                    onChange={e => setOneLine(e.target.value)}
                                    placeholder={isQuery ? "Ask an architectural or technical question..." : isShowcase ? "One-line project summary..." : "Enter punchy transmission title / hook..."}
                                    className="w-full bg-zinc-900/60 border border-zinc-800 text-white p-2.5 text-xs focus:border-white focus:outline-none transition-colors"
                                    required
                                />
                            </div>

                            {/* Detailed Content */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
                                        {isQuery ? '// DETAILED EXPLANATION' : isShowcase ? '// TECHNICAL DESCRIPTION & METHODOLOGY' : '// TRANSMISSION CONTENT'} <span className="text-red-400">*</span>
                                    </label>
                                    <span className="text-[10px] text-zinc-500">{content.length} chars</span>
                                </div>
                                <textarea
                                    rows={5}
                                    value={content}
                                    onChange={e => setContent(e.target.value)}
                                    placeholder={isShowcase ? "Technical breakdown, implementation details, features..." : "Write complete transmission details..."}
                                    className="w-full bg-zinc-900/60 border border-zinc-800 text-white p-2.5 text-xs focus:border-white focus:outline-none transition-colors resize-y"
                                    required
                                />
                            </div>

                            {/* External Links (Showcase only) */}
                            {isShowcase && (
                                <div className="space-y-2 p-3 bg-zinc-950 border border-zinc-800/80">
                                    <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block">
                                        // EXTERNAL PROJECT LINKS
                                    </label>
                                    <input
                                        type="url"
                                        value={demoUrl}
                                        onChange={e => setDemoUrl(e.target.value)}
                                        placeholder="Live Demo URL (https://...)"
                                        className="w-full bg-black border border-zinc-800 p-2 text-xs text-white placeholder-zinc-600 focus:border-white focus:outline-none"
                                    />
                                    <input
                                        type="url"
                                        value={githubUrl}
                                        onChange={e => setGithubUrl(e.target.value)}
                                        placeholder="Repository URL (https://github.com/...)"
                                        className="w-full bg-black border border-zinc-800 p-2 text-xs text-white placeholder-zinc-600 focus:border-white focus:outline-none"
                                    />
                                    <input
                                        type="url"
                                        value={articleUrl}
                                        onChange={e => setArticleUrl(e.target.value)}
                                        placeholder="Article / Paper URL (https://...)"
                                        className="w-full bg-black border border-zinc-800 p-2 text-xs text-white placeholder-zinc-600 focus:border-white focus:outline-none"
                                    />
                                </div>
                            )}

                            {/* Tags (Showcase only) */}
                            {isShowcase && (
                                <div>
                                    <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1">
                                        // PROJECT TAGS
                                    </label>
                                    <div className="flex gap-2 mb-2">
                                        <input
                                            type="text"
                                            value={tagInput}
                                            onChange={e => setTagInput(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    const trimmed = tagInput.trim().replace(/^#/, '');
                                                    if (trimmed && !tags.includes(trimmed)) {
                                                        setTags([...tags, trimmed]);
                                                        setTagInput('');
                                                    }
                                                }
                                            }}
                                            placeholder="Type tag and press enter..."
                                            className="flex-1 bg-black border border-zinc-800 p-2 text-xs text-white placeholder-zinc-600 focus:border-white focus:outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const trimmed = tagInput.trim().replace(/^#/, '');
                                                if (trimmed && !tags.includes(trimmed)) {
                                                    setTags([...tags, trimmed]);
                                                    setTagInput('');
                                                }
                                            }}
                                            className="px-3 bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white text-xs uppercase"
                                        >
                                            Add
                                        </button>
                                    </div>
                                    {tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5">
                                            {tags.map(t => (
                                                <span key={t} className="bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300 flex items-center gap-1">
                                                    #{t}
                                                    <button type="button" onClick={() => setTags(tags.filter(x => x !== t))} className="text-zinc-500 hover:text-white">×</button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Status (Showcase only) */}
                            {isShowcase && (
                                <div className="flex items-center justify-between p-2.5 bg-zinc-950 border border-zinc-800">
                                    <span className="text-xs font-bold text-zinc-300 uppercase">// PUBLICATION STATUS</span>
                                    <div className="flex border border-zinc-800">
                                        <button
                                            type="button"
                                            onClick={() => setStatus('published')}
                                            className={`px-3 py-1 text-xs uppercase font-bold ${status === 'published' ? 'bg-white text-black' : 'text-zinc-500'}`}
                                        >
                                            Live
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setStatus('draft')}
                                            className={`px-3 py-1 text-xs uppercase font-bold ${status === 'draft' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
                                        >
                                            Draft
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Channel Selection (Feeds only) */}
                            {isFeed && (
                                <div>
                                    <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1.5">
                                        // BROADCAST CHANNEL
                                    </label>
                                    {userChannels.length === 0 ? (
                                        <p className="text-[11px] text-zinc-500 italic p-2 bg-zinc-950 border border-zinc-900">
                                            No user channels found. Maintaining current transmission channel affiliations.
                                        </p>
                                    ) : (
                                        <select
                                            value={selectedChannelId}
                                            onChange={e => setSelectedChannelId(e.target.value)}
                                            className="w-full bg-zinc-900/60 border border-zinc-800 text-white p-2.5 text-xs focus:border-white focus:outline-none"
                                        >
                                            {userChannels.map(ch => (
                                                <option key={ch.id} value={ch.id}>
                                                    {ch.name} ({ch.handle || ch.domain || 'Channel'})
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            )}

                            {/* Target Domain */}
                            <div>
                                <TargetDomainSelector
                                    value={domain}
                                    onChange={(val, valid) => {
                                        setDomain(val);
                                        setIsDomainValid(valid);
                                    }}
                                    label="// TARGET DOMAIN"
                                    subLabel="Classify the transmission domain"
                                />
                            </div>

                            {/* Media Attachments (Replace or Keep) */}
                            <div>
                                <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1.5">
                                    // ATTACHED MEDIA
                                </label>
                                {currentDisplayMedia ? (
                                    <div className="relative border border-zinc-800 bg-black p-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 overflow-hidden w-full sm:w-auto">
                                            {currentDisplayMediaType === 'video' ? (
                                                <video src={currentDisplayMedia} className="w-16 h-16 object-cover border border-zinc-800 flex-shrink-0" />
                                            ) : (
                                                <img src={currentDisplayMedia} alt="Media" className="w-16 h-16 object-cover border border-zinc-800 flex-shrink-0" />
                                            )}
                                            <div className="truncate">
                                                <span className="text-zinc-200 font-bold block truncate">
                                                    {mediaFile ? mediaFile.name : 'Current Transmission Media'}
                                                </span>
                                                <span className="text-[10px] text-zinc-500 uppercase">
                                                    {mediaFile ? `${(mediaFile.size / 1024 / 1024).toFixed(2)} MB` : 'Stored in Cloud'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                                            <button
                                                type="button"
                                                onClick={() => fileInputRef.current?.click()}
                                                className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 hover:text-white text-[11px] uppercase tracking-wider transition-colors"
                                            >
                                                Replace
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleRemoveMedia}
                                                className="px-2.5 py-1.5 bg-red-950/40 hover:bg-red-950 border border-red-800 text-red-400 hover:text-red-300 text-[11px] uppercase tracking-wider transition-colors flex items-center gap-1"
                                            >
                                                <TrashIcon className="w-3.5 h-3.5" />
                                                <span>Remove</span>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="border border-dashed border-zinc-800 hover:border-zinc-600 bg-zinc-950/40 p-4 text-center cursor-pointer transition-colors"
                                    >
                                        <ArrowUpTrayIcon className="w-5 h-5 mx-auto mb-1 text-zinc-500" />
                                        <span className="text-zinc-300 block font-bold">// ATTACH IMAGE OR VIDEO</span>
                                        <span className="text-zinc-500 text-[10px]">JPG, PNG, WebP, MP4 up to 50MB</span>
                                    </div>
                                )}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*,video/*"
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                            </div>
                        </>
                    )}
                </form>

                {/* Footer Controls */}
                <div className="p-4 border-t border-zinc-800 bg-zinc-950/70 flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={handleAttemptClose}
                        disabled={isSaving}
                        className="px-4 py-2 text-xs uppercase tracking-wider text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-600 transition-colors"
                    >
                        // DISCARD / CANCEL
                    </button>

                    <button
                        type="submit"
                        form="edit-post-form"
                        disabled={isSaving}
                        className="px-6 py-2 bg-white text-black hover:bg-zinc-200 text-xs uppercase font-bold tracking-wider transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        {isSaving ? (
                            <>
                                <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                                <span>SAVING CHANGES...</span>
                            </>
                        ) : (
                            <span>// SAVE CHANGES</span>
                        )}
                    </button>
                </div>
            </div>

            {/* Discard Confirmation Dialog */}
            {showDiscardConfirm && (
                <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-[#0c0c0e] border border-zinc-700 p-5 max-w-sm w-full font-mono shadow-2xl space-y-4">
                        <div className="space-y-1">
                            <span className="text-[10px] text-amber-400 uppercase font-bold">// WARNING: UNSAVED MODIFICATIONS</span>
                            <h3 className="text-sm font-bold text-white uppercase">Discard unsaved changes?</h3>
                            <p className="text-xs text-zinc-400 leading-relaxed">
                                Any modifications made to this transmission will be permanently lost.
                            </p>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                            <button
                                type="button"
                                onClick={() => setShowDiscardConfirm(false)}
                                className="px-3 py-1.5 text-xs uppercase tracking-wider text-zinc-300 hover:text-white border border-zinc-800 hover:border-zinc-600 transition-colors"
                            >
                                Keep Editing
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowDiscardConfirm(false);
                                    onClose();
                                }}
                                className="px-3 py-1.5 text-xs uppercase font-bold tracking-wider bg-red-950/60 hover:bg-red-900 border border-red-700 text-red-200 transition-colors"
                            >
                                // DISCARD
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
