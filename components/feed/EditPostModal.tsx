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

    // Determine post kind
    const postType = post?.type || PostType.Feed;
    const isCollab = postType === PostType.Collab || Boolean(post?.collabDetails);
    const isThread = postType === PostType.Thread;
    const isQuery = postType === PostType.Query;
    const isFeed = !isCollab && !isThread && !isQuery;

    // Fields
    const [oneLine, setOneLine] = useState('');
    const [content, setContent] = useState('');
    const [domain, setDomain] = useState('Technology');
    const [isDomainValid, setIsDomainValid] = useState(true);

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
            setOneLine(post.oneLine || post.aiSummary || '');
            setContent(post.content || '');
            setDomain(post.domain || post.category || 'Technology');
            setSelectedChannelId(post.channelId || '');
            
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
                setCollabTypes(Array.isArray(post.collabDetails.collabTypes) ? [...post.collabDetails.collabTypes] : ['Side-project']);
                setProjectStatus(post.collabDetails.projectStatus || 'MVP');
            } else {
                setRoles([{ id: 'role-1', title: 'Developer', count: 1, skills: [], responsibilities: '' }]);
                setExperience('');
                setBackground('');
                setAvailability('');
                setLocation('Remote');
                setSpecificLocation('');
                setCollabTypes(['Side-project']);
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

    // Collab Roles handlers
    const handleAddRole = () => {
        setRoles(prev => [
            ...prev,
            { id: `role-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`, title: '', count: 1, skills: [], responsibilities: '' }
        ]);
    };

    const handleRemoveRole = (idx: number) => {
        if (roles.length <= 1) return;
        setRoles(prev => prev.filter((_, i) => i !== idx));
    };

    const handleRoleChange = (idx: number, field: keyof CollabRole, val: any) => {
        setRoles(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r));
    };

    const handleRoleSkillsChange = (idx: number, skillsStr: string) => {
        const parsed = skillsStr.split(',').map(s => s.trim()).filter(Boolean);
        handleRoleChange(idx, 'skills', parsed);
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

        if (isCollab) {
            const hasInvalidRole = roles.some(r => !r.title.trim());
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
                    roles: roles.map(r => ({
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
                    {/* Header / Hook */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
                                {isQuery ? '// QUERY HOOK · QUESTION' : '// TRANSMISSION HOOK · ONE-LINER'} <span className="text-red-400">*</span>
                            </label>
                            <span className="text-[10px] text-zinc-500">{oneLine.length}/140</span>
                        </div>
                        <input
                            type="text"
                            maxLength={140}
                            value={oneLine}
                            onChange={e => setOneLine(e.target.value)}
                            placeholder={isQuery ? "Ask an architectural or technical question..." : "Enter punchy transmission title / hook..."}
                            className="w-full bg-zinc-900/60 border border-zinc-800 text-white p-2.5 text-xs focus:border-white focus:outline-none transition-colors"
                            required
                        />
                    </div>

                    {/* Detailed Content */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
                                {isCollab ? '// PROJECT OVERVIEW' : isQuery ? '// DETAILED EXPLANATION' : '// TRANSMISSION CONTENT'} <span className="text-red-400">*</span>
                            </label>
                            <span className="text-[10px] text-zinc-500">{content.length} chars</span>
                        </div>
                        <textarea
                            rows={isCollab ? 4 : 5}
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            placeholder="Write complete transmission details..."
                            className="w-full bg-zinc-900/60 border border-zinc-800 text-white p-2.5 text-xs focus:border-white focus:outline-none transition-colors resize-y"
                            required
                        />
                    </div>

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

                    {/* Collab-Specific Form Sections */}
                    {isCollab && (
                        <div className="pt-4 border-t border-zinc-800 space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-white uppercase tracking-wider">// COLLABORATION ROLES</span>
                                <button
                                    type="button"
                                    onClick={handleAddRole}
                                    className="flex items-center gap-1 text-[11px] text-zinc-300 hover:text-white border border-zinc-800 hover:border-zinc-600 px-2 py-1 bg-zinc-900/60"
                                >
                                    <PlusIcon className="w-3.5 h-3.5" />
                                    <span>Add Role</span>
                                </button>
                            </div>

                            {roles.map((role, idx) => (
                                <div key={role.id || idx} className="p-3 bg-black/60 border border-zinc-800/80 space-y-2.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] text-zinc-500 uppercase font-bold">// ROLE #{idx + 1}</span>
                                        {roles.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveRole(idx)}
                                                className="text-zinc-500 hover:text-red-400"
                                            >
                                                <TrashIcon className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        <div className="sm:col-span-2">
                                            <input
                                                type="text"
                                                placeholder="Role Title (e.g. Frontend Architect)"
                                                value={role.title}
                                                onChange={e => handleRoleChange(idx, 'title', e.target.value)}
                                                className="w-full bg-zinc-900 border border-zinc-800 p-1.5 text-xs text-white focus:outline-none"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <input
                                                type="number"
                                                min={1}
                                                max={20}
                                                placeholder="Count"
                                                value={role.count}
                                                onChange={e => handleRoleChange(idx, 'count', e.target.value)}
                                                className="w-full bg-zinc-900 border border-zinc-800 p-1.5 text-xs text-white focus:outline-none"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <input
                                            type="text"
                                            placeholder="Required Skills (comma separated: React, TypeScript, GraphQL)"
                                            value={role.skills?.join(', ') || ''}
                                            onChange={e => handleRoleSkillsChange(idx, e.target.value)}
                                            className="w-full bg-zinc-900 border border-zinc-800 p-1.5 text-xs text-white focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <input
                                            type="text"
                                            placeholder="Role Responsibilities (brief summary)"
                                            value={role.responsibilities || ''}
                                            onChange={e => handleRoleChange(idx, 'responsibilities', e.target.value)}
                                            className="w-full bg-zinc-900 border border-zinc-800 p-1.5 text-xs text-white focus:outline-none"
                                        />
                                    </div>
                                </div>
                            ))}

                            {/* Project Status & Location */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                                <div>
                                    <label className="text-[10px] text-zinc-400 uppercase font-bold block mb-1">// PROJECT STATUS</label>
                                    <select
                                        value={projectStatus}
                                        onChange={e => setProjectStatus(e.target.value)}
                                        className="w-full bg-zinc-900 border border-zinc-800 text-white p-2 text-xs focus:outline-none"
                                    >
                                        {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[10px] text-zinc-400 uppercase font-bold block mb-1">// LOCATION</label>
                                    <select
                                        value={location}
                                        onChange={e => setLocation(e.target.value)}
                                        className="w-full bg-zinc-900 border border-zinc-800 text-white p-2 text-xs focus:outline-none"
                                    >
                                        {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                                    </select>
                                </div>
                            </div>

                            {location === 'Specific Location' && (
                                <div>
                                    <label className="text-[10px] text-zinc-400 uppercase font-bold block mb-1">// CITY / REGION</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. San Francisco, CA"
                                        value={specificLocation}
                                        onChange={e => setSpecificLocation(e.target.value)}
                                        className="w-full bg-zinc-900 border border-zinc-800 text-white p-2 text-xs focus:outline-none"
                                    />
                                </div>
                            )}

                            {/* Collaboration Types */}
                            <div>
                                <label className="text-[10px] text-zinc-400 uppercase font-bold block mb-1.5">// COLLABORATION FORMAT</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {COLLAB_TYPES.map(t => {
                                        const isSelected = collabTypes.includes(t);
                                        return (
                                            <button
                                                key={t}
                                                type="button"
                                                onClick={() => toggleCollabType(t)}
                                                className={`px-2.5 py-1 text-[11px] uppercase border transition-all ${
                                                    isSelected
                                                        ? 'bg-white text-black border-white font-bold'
                                                        : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-600 hover:text-white'
                                                }`}
                                            >
                                                {t}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Additional background / requirements */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <div>
                                    <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">// EXPERIENCE</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. 2+ yrs"
                                        value={experience}
                                        onChange={e => setExperience(e.target.value)}
                                        className="w-full bg-zinc-900 border border-zinc-800 p-2 text-xs text-white focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">// BACKGROUND</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. CS / Design"
                                        value={background}
                                        onChange={e => setBackground(e.target.value)}
                                        className="w-full bg-zinc-900 border border-zinc-800 p-2 text-xs text-white focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">// AVAILABILITY</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. 10 hrs/wk"
                                        value={availability}
                                        onChange={e => setAvailability(e.target.value)}
                                        className="w-full bg-zinc-900 border border-zinc-800 p-2 text-xs text-white focus:outline-none"
                                    />
                                </div>
                            </div>
                        </div>
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
