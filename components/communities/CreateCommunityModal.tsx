import React, { useState, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
    createCommunity, 
    updateCommunity,
    sanitizeHandle, 
    checkHandleAvailability,
    COMMUNITY_DOMAINS,
    validateCollectiveIdentity,
    normalizeCoreValues,
    normalizeGuidelines,
    CreateCommunityInput,
    UpdateCommunityInput 
} from '../../services/communityService';
import type { Community, CommunityCoreValue, CommunityGuideline } from '../../types';
import { 
    CloseIcon, 
    SparklesIcon, 
    UsersIcon, 
    ShieldCheckIcon, 
    GlobeAltIcon, 
    CheckCircleIcon,
    PencilSquareIcon,
    CheckIcon,
    PlusIcon,
    TrashIcon,
    ChevronUpIcon,
    ChevronDownIcon
} from '../ui/Icons';
import { CoreValuesEditor } from './CollectiveIdentityFormFields';

export interface CreateCommunityModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated?: (communityId: string) => void;
    community?: Community | null;
    onUpdated?: (updatedCommunity: Community) => void;
    mode?: 'create' | 'edit';
}

export type EstablishmentStep = 1 | 2 | 3 | 4 | 5 | 6;

export const EXPECTED_BEHAVIOUR_PRESETS = [
    {
        title: 'Respectful Engagement',
        description: 'Treat every collective member with professional courtesy, intellectual goodwill, and mutual respect.',
    },
    {
        title: 'Constructive Participation',
        description: 'Offer peer feedback, verifiable arguments, reproducible code examples, and signal-rich technical contributions.',
    },
    {
        title: 'Collaboration & Inclusivity',
        description: 'Foster an open, welcoming environment for builders across all technical disciplines and experience levels.',
    },
    {
        title: 'Intellectual Property & Attribution',
        description: 'Always credit authors, upstream repositories, and respect open source licenses and private operational boundaries.',
    },
];

export const PROHIBITED_CONDUCT_PRESETS = [
    {
        title: 'Zero Harassment & Personal Attacks',
        description: 'Strict prohibition on hostility, ad hominem insults, trolling, harassment, or targeted discrimination of any kind.',
    },
    {
        title: 'No Commercial Spam or Unsolicited Pitching',
        description: 'Commercial solicitations, unsolicited DM mass-outreach, and predatory affiliate marketing will lead to immediate sanction.',
    },
    {
        title: 'No Impersonation or Deceptive Identity',
        description: 'Misrepresenting identity, authority, credentials, or affiliations within the collective is strictly forbidden.',
    },
    {
        title: 'No Malicious Payloads or Data Leaks',
        description: 'Sharing unverified exploit scripts, malicious code, or exposing confidential production secrets is grounds for immediate expulsion.',
    },
];

export const MODERATION_POLICY_OPTIONS = [
    {
        id: 'tiered_warning',
        label: 'Tiered Warning & Strike System',
        summary: '3-tier escalation: Informal guidance → Official written warning → Temporary suspension / mute → Sovereign expulsion.',
    },
    {
        id: 'immediate_revocation',
        label: 'Immediate Revocation for Zero-Tolerance Violations',
        summary: 'Harassment, spam bots, and security breaches result in immediate irreversible removal by moderators.',
    },
    {
        id: 'council_consensus',
        label: 'Council Consensus Moderation',
        summary: 'Sanctions, warnings, and appeals are reviewed collectively by appointed council administrators before permanent enforcement.',
    },
];

const AVATAR_PRESETS = [
    { label: 'Dark Hex', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=240&h=240&auto=format&fit=crop' },
    { label: 'Neon Cyber', url: 'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?q=80&w=240&h=240&auto=format&fit=crop' },
    { label: 'Matrix Terminal', url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=240&h=240&auto=format&fit=crop' },
    { label: 'Monolith Core', url: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=240&h=240&auto=format&fit=crop' },
    { label: 'Systems Lab', url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=240&h=240&auto=format&fit=crop' },
];

const BANNER_PRESETS = [
    { label: 'Circuit Matrix', url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1200&h=400&auto=format&fit=crop' },
    { label: 'Space Deep Field', url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1200&h=400&auto=format&fit=crop' },
    { label: 'Cyber Synthwave', url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=1200&h=400&auto=format&fit=crop' },
    { label: 'Obsidian Mesh', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200&h=400&auto=format&fit=crop' },
];

const SUGGESTED_TOPICS = [
    'Systems Architecture', 'Distributed Systems', 'Applied AI', 'Rust', 'Compilers',
    'Open Source', 'Privacy Tech', 'Web3 & Cryptography', 'Autonomous Agents', 'Robotics'
];

export const CreateCommunityModal: React.FC<CreateCommunityModalProps> = ({
    isOpen,
    onClose,
    onCreated,
    community = null,
    onUpdated,
    mode,
}) => {
    const { currentUser, userProfile } = useAuth();
    const navigate = ReactRouterDOM.useNavigate();

    const isEditMode = mode === 'edit' || Boolean(community);

    // Step state: 1: Foundation, 2: Identity, 3: Guidelines, 4: Governance, 5: Appearance, 6: Review
    const [step, setStep] = useState<EstablishmentStep>(1);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [createdCommunityId, setCreatedCommunityId] = useState<string | null>(null);
    const [updatedCommunity, setUpdatedCommunity] = useState<Community | null>(null);

    // STEP 01: Foundation
    const [name, setName] = useState('');
    const [handle, setHandle] = useState('');
    const [handleAvailability, setHandleAvailability] = useState<{ checked: boolean; available: boolean; reason?: string }>({
        checked: false,
        available: false,
    });
    const [checkingHandle, setCheckingHandle] = useState(false);
    const [category, setCategory] = useState<string>(COMMUNITY_DOMAINS[0].name);
    const [description, setDescription] = useState('');
    const [purpose, setPurpose] = useState('');
    const [visibility, setVisibility] = useState<'public' | 'private'>('public');
    const [joinPolicy, setJoinPolicy] = useState<'open' | 'approval_required'>('open');

    // STEP 02: Collective Identity
    const [identityTab, setIdentityTab] = useState<'purpose' | 'values' | 'story'>('purpose');
    const [mission, setMission] = useState('');
    const [foundingStory, setFoundingStory] = useState('');
    const [values, setValues] = useState<CommunityCoreValue[]>([]);

    // STEP 03: Community Guidelines
    const [guidelines, setGuidelines] = useState<CommunityGuideline[]>([]);
    const [moderationPolicy, setModerationPolicy] = useState<string>('Tiered Warning & Strike System');
    const [customModerationNote, setCustomModerationNote] = useState('');
    const [ruleTitleInput, setRuleTitleInput] = useState('');
    const [ruleDescInput, setRuleDescInput] = useState('');
    const [editingRuleIdx, setEditingRuleIdx] = useState<number | null>(null);

    // STEP 04: Governance & Membership
    const [governanceModel, setGovernanceModel] = useState<string>('Sovereign Founder');
    const [postPermission, setPostPermission] = useState<'all' | 'admins_only'>('all');
    const [gatheringPermission, setGatheringPermission] = useState<'all' | 'admins_only'>('all');
    const [adminInput, setAdminInput] = useState('');

    // STEP 05: Appearance & Discovery
    const [avatarUrl, setAvatarUrl] = useState('');
    const [bannerUrl, setBannerUrl] = useState('');
    const [topics, setTopics] = useState<string[]>(['Systems Architecture']);
    const [newTagInput, setNewTagInput] = useState('');

    // Authorization check
    const isUserAuthorized = (): boolean => {
        if (!isEditMode || !community) return true;
        if (!currentUser) return false;
        const isOwner = community.ownerId === currentUser.uid || community.creatorId === currentUser.uid;
        const isAdmin = Array.isArray(community.adminIds) && community.adminIds.includes(currentUser.uid);
        return isOwner || isAdmin;
    };

    // Pre-population effect when opening modal
    useEffect(() => {
        if (!isOpen) return;

        if (isEditMode && community) {
            // Check authorization
            if (currentUser) {
                const isOwner = community.ownerId === currentUser.uid || community.creatorId === currentUser.uid;
                const isAdmin = Array.isArray(community.adminIds) && community.adminIds.includes(currentUser.uid);
                if (!isOwner && !isAdmin) {
                    setError('UNAUTHORIZED: You do not possess sovereign ownership or administrative authorization for this collective.');
                } else {
                    setError(null);
                }
            }

            setStep(1);
            setName(community.name || '');
            const commHandle = community.handle || sanitizeHandle(community.name || '');
            setHandle(commHandle);
            setHandleAvailability({ checked: true, available: true });
            setCategory(community.category || COMMUNITY_DOMAINS[0].name);
            setDescription(community.description || '');
            setPurpose(community.purpose || community.description || '');
            setVisibility(community.visibility || 'public');
            setJoinPolicy(community.joinPolicy || 'open');
            setMission(community.mission || '');
            setFoundingStory(community.foundingStory || '');
            setValues(normalizeCoreValues(community.values) || []);

            // Normalize guidelines: if guidelines exists use it, else check legacy rules
            if (community.guidelines && community.guidelines.length > 0) {
                setGuidelines(normalizeGuidelines(community.guidelines));
            } else if (community.rules && community.rules.length > 0) {
                setGuidelines(community.rules.map((r, i) => ({
                    id: `rule_legacy_${i}`,
                    title: `Rule ${(i + 1).toString().padStart(2, '0')}`,
                    description: r,
                })));
            } else {
                setGuidelines([]);
            }

            setModerationPolicy(
                community.governanceModel?.includes('Council') 
                    ? 'Council Consensus Moderation' 
                    : 'Tiered Warning & Strike System'
            );
            setCustomModerationNote('');
            setGovernanceModel(community.governanceModel || 'Sovereign Founder');
            setPostPermission(community.postPermission || 'all');
            setGatheringPermission(community.gatheringPermission || 'all');
            setAdminInput(Array.isArray(community.adminIds) ? community.adminIds.join(', ') : '');
            setAvatarUrl(community.avatarUrl || '');
            setBannerUrl(community.bannerUrl || '');
            setTopics(
                Array.isArray(community.topics) && community.topics.length > 0
                    ? community.topics
                    : [community.category || 'Systems Architecture']
            );
            setCreatedCommunityId(null);
            setUpdatedCommunity(null);
        } else {
            // Reset to clean Create Mode defaults
            setStep(1);
            setName('');
            setHandle('');
            setHandleAvailability({ checked: false, available: false });
            setCategory(COMMUNITY_DOMAINS[0].name);
            setDescription('');
            setPurpose('');
            setVisibility('public');
            setJoinPolicy('open');
            setIdentityTab('purpose');
            setMission('');
            setFoundingStory('');
            setValues([]);
            setGuidelines([]);
            setModerationPolicy('Tiered Warning & Strike System');
            setCustomModerationNote('');
            setRuleTitleInput('');
            setRuleDescInput('');
            setEditingRuleIdx(null);
            setGovernanceModel('Sovereign Founder');
            setPostPermission('all');
            setGatheringPermission('all');
            setAdminInput('');
            setAvatarUrl('');
            setBannerUrl('');
            setTopics(['Systems Architecture']);
            setNewTagInput('');
            setError(null);
            setCreatedCommunityId(null);
            setUpdatedCommunity(null);
        }
    }, [isOpen, community?.id]);

    // Synchronize handle derivation
    const handleNameChange = (val: string) => {
        setName(val);
        // In Create mode only: auto-derive handle if user hasn't typed a custom handle
        if (!isEditMode && (!handle || handle === sanitizeHandle(name))) {
            const nextHandle = sanitizeHandle(val);
            setHandle(nextHandle);
            setHandleAvailability({ checked: false, available: false });
        }
    };

    // Live Handle Verification Check
    const verifyHandle = async (targetHandle: string) => {
        const clean = sanitizeHandle(targetHandle);
        if (!clean || clean.length < 3) {
            setHandleAvailability({
                checked: true,
                available: false,
                reason: 'Handle must be at least 3 characters.',
            });
            return;
        }

        // If in Edit mode and handle is unchanged from original community record
        if (isEditMode && community && clean === sanitizeHandle(community.handle || '')) {
            setHandleAvailability({
                checked: true,
                available: true,
            });
            return;
        }

        setCheckingHandle(true);
        try {
            const res = await checkHandleAvailability(clean, isEditMode ? community?.id : undefined);
            setHandleAvailability({
                checked: true,
                available: res.available,
                reason: res.reason,
            });
        } catch {
            setHandleAvailability({ checked: true, available: true });
        } finally {
            setCheckingHandle(false);
        }
    };

    // Check handle with debounce
    useEffect(() => {
        if (!handle) {
            setHandleAvailability({ checked: false, available: false });
            return;
        }
        const timer = setTimeout(() => {
            verifyHandle(handle);
        }, 350);
        return () => clearTimeout(timer);
    }, [handle]);

    // Field modification detection for Edit Mode
    const isFieldModified = (fieldName: 'foundation' | 'identity' | 'guidelines' | 'governance' | 'appearance'): boolean => {
        if (!isEditMode || !community) return false;
        switch (fieldName) {
            case 'foundation':
                return (
                    name.trim() !== (community.name || '').trim() ||
                    sanitizeHandle(handle) !== sanitizeHandle(community.handle || '') ||
                    category !== (community.category || COMMUNITY_DOMAINS[0].name) ||
                    description.trim() !== (community.description || '').trim() ||
                    (purpose.trim() || description.trim()) !== (community.purpose || community.description || '').trim() ||
                    visibility !== (community.visibility || 'public') ||
                    joinPolicy !== (community.joinPolicy || 'open')
                );
            case 'identity':
                return (
                    mission.trim() !== (community.mission || '').trim() ||
                    foundingStory.trim() !== (community.foundingStory || '').trim() ||
                    values.length !== (community.values?.length || 0) ||
                    JSON.stringify(values.map(v => v.title)) !== JSON.stringify(normalizeCoreValues(community.values).map(v => v.title))
                );
            case 'guidelines':
                return (
                    guidelines.length !== (community.guidelines?.length || 0) ||
                    JSON.stringify(guidelines.map(g => g.title)) !== JSON.stringify(normalizeGuidelines(community.guidelines).map(g => g.title))
                );
            case 'governance':
                return (
                    governanceModel !== (community.governanceModel || 'Sovereign Founder') ||
                    postPermission !== (community.postPermission || 'all') ||
                    gatheringPermission !== (community.gatheringPermission || 'all') ||
                    adminInput.trim() !== (community.adminIds || []).join(', ').trim()
                );
            case 'appearance':
                return (
                    avatarUrl.trim() !== (community.avatarUrl || '').trim() ||
                    bannerUrl.trim() !== (community.bannerUrl || '').trim() ||
                    topics.join(',') !== (community.topics || []).join(',')
                );
            default:
                return false;
        }
    };

    if (!isOpen) return null;

    // Reset and close
    const resetAndClose = () => {
        setStep(1);
        setName('');
        setHandle('');
        setHandleAvailability({ checked: false, available: false });
        setDescription('');
        setPurpose('');
        setMission('');
        setFoundingStory('');
        setValues([]);
        setGuidelines([]);
        setModerationPolicy('Tiered Warning & Strike System');
        setCustomModerationNote('');
        setRuleTitleInput('');
        setRuleDescInput('');
        setEditingRuleIdx(null);
        setGovernanceModel('Sovereign Founder');
        setPostPermission('all');
        setGatheringPermission('all');
        setAdminInput('');
        setAvatarUrl('');
        setBannerUrl('');
        setTopics(['Systems Architecture']);
        setNewTagInput('');
        setVisibility('public');
        setJoinPolicy('open');
        setError(null);
        setCreatedCommunityId(null);
        setUpdatedCommunity(null);
        onClose();
    };

    // Rule management in Step 03
    const handleSaveRule = () => {
        setError(null);
        const title = ruleTitleInput.trim();
        const desc = ruleDescInput.trim();
        if (!title) {
            setError('Guideline or rule title is required.');
            return;
        }
        if (!desc) {
            setError('Guideline description or behavioral standard is required.');
            return;
        }

        if (editingRuleIdx !== null) {
            setGuidelines(prev => prev.map((g, idx) =>
                idx === editingRuleIdx
                    ? { ...g, title, description: desc }
                    : g
            ));
            setEditingRuleIdx(null);
        } else {
            const newRule: CommunityGuideline = {
                id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                title,
                description: desc,
            };
            setGuidelines(prev => [...prev, newRule]);
        }
        setRuleTitleInput('');
        setRuleDescInput('');
    };

    const handleEditRule = (idx: number) => {
        setEditingRuleIdx(idx);
        setRuleTitleInput(guidelines[idx].title);
        setRuleDescInput(guidelines[idx].description || '');
    };

    const handleCancelRuleEdit = () => {
        setEditingRuleIdx(null);
        setRuleTitleInput('');
        setRuleDescInput('');
    };

    const handleRemoveRule = (idx: number) => {
        if (editingRuleIdx === idx) handleCancelRuleEdit();
        setGuidelines(prev => prev.filter((_, i) => i !== idx));
    };

    const handleMoveRule = (idx: number, direction: 'up' | 'down') => {
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= guidelines.length) return;
        setGuidelines(prev => {
            const copy = [...prev];
            const temp = copy[idx];
            copy[idx] = copy[targetIdx];
            copy[targetIdx] = temp;
            return copy;
        });
    };

    const handleApplyGuidelinePreset = (preset: { title: string; description: string }) => {
        setError(null);
        if (guidelines.some(g => g.title.toLowerCase() === preset.title.toLowerCase())) {
            setError(`Rule "${preset.title}" is already included in guidelines.`);
            return;
        }
        const newRule: CommunityGuideline = {
            id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            title: preset.title,
            description: preset.description,
        };
        setGuidelines(prev => [...prev, newRule]);
    };

    // Tag management
    const handleAddTopic = (tagToAdd: string) => {
        const clean = tagToAdd.trim();
        if (!clean) return;
        if (topics.some(t => t.toLowerCase() === clean.toLowerCase())) return;
        if (topics.length >= 8) {
            setError('Maximum 8 discovery topic tags allowed.');
            return;
        }
        setTopics(prev => [...prev, clean]);
        setNewTagInput('');
    };

    const handleRemoveTopic = (index: number) => {
        setTopics(prev => prev.filter((_, i) => i !== index));
    };

    // Step 01 validation
    const validateStep01 = (): boolean => {
        setError(null);
        if (!name.trim()) {
            setError('Please provide a collective name.');
            return false;
        }
        if (!handle.trim() || handle.trim().length < 3) {
            setError('Please provide a valid unique handle (at least 3 alphanumeric characters).');
            return false;
        }
        if (handleAvailability.checked && !handleAvailability.available) {
            setError(handleAvailability.reason || 'This handle is unavailable. Please choose another.');
            return false;
        }
        if (!description.trim() || description.trim().length < 20) {
            setError('Please provide a concise description of at least 20 characters.');
            return false;
        }
        if (!purpose.trim()) {
            // Auto-populate purpose from description if empty
            setPurpose(description.trim());
        }
        return true;
    };

    // Step 02 validation (Purpose, Mission, Story, Values)
    const validateStep02 = (): boolean => {
        setError(null);
        const valRes = validateCollectiveIdentity({
            purpose: purpose.trim() || description.trim(),
            mission: mission.trim() || undefined,
            foundingStory: foundingStory.trim() || undefined,
            values,
        });

        if (!valRes.valid) {
            setError(valRes.error || 'Collective Identity validation failed.');
            return false;
        }
        return true;
    };

    // Step 05 validation (Appearance & Discovery)
    const validateStep05 = (): boolean => {
        setError(null);
        if (avatarUrl.trim() && !avatarUrl.startsWith('http://') && !avatarUrl.startsWith('https://')) {
            setError('Please enter a valid image URL for the emblem starting with https://');
            return false;
        }
        if (bannerUrl.trim() && !bannerUrl.startsWith('http://') && !bannerUrl.startsWith('https://')) {
            setError('Please enter a valid banner image URL starting with https://');
            return false;
        }
        if (topics.length === 0) {
            setTopics([category]);
        }
        return true;
    };

    // Step navigation
    const handleNext = (e?: React.SyntheticEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        setError(null);
        if (isEditMode && !isUserAuthorized()) {
            setError('Unauthorized: Only community owner or administrator can modify this collective.');
            return;
        }
        if (step === 1) {
            if (!validateStep01()) return;
            setStep(2);
        } else if (step === 2) {
            if (!validateStep02()) return;
            setStep(3);
        } else if (step === 3) {
            setStep(4);
        } else if (step === 4) {
            setStep(5);
        } else if (step === 5) {
            if (!validateStep05()) return;
            // Navigate strictly to Step 06 Review without creating anything
            setStep(6);
        }
    };

    const handleBack = (e?: React.SyntheticEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        setError(null);
        if (step > 1) {
            setStep((prev) => (prev - 1) as EstablishmentStep);
        }
    };

    // Final Submission strictly at Step 06
    const handleFinalEstablish = async (e?: React.FormEvent | React.MouseEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        setError(null);

        // STRICT GUARD: Must only execute on Step 6
        if (step !== 6) {
            console.warn('[ABORT] Cannot establish or save collective outside of Step 06 review.');
            return;
        }

        // Prevent duplicate concurrent creations or saves
        if (submitting || createdCommunityId || updatedCommunity) {
            return;
        }

        if (!currentUser) {
            setError('Authentication required to manage a collective.');
            return;
        }

        if (isEditMode && !isUserAuthorized()) {
            setError('Unauthorized: Only community owner or administrator can modify this collective.');
            return;
        }

        if (!validateStep01() || !validateStep02() || !validateStep05()) {
            return;
        }

        setSubmitting(true);
        try {
            const adminIdsList = adminInput
                .split(',')
                .map(s => s.trim())
                .filter(Boolean);

            if (isEditMode && community) {
                // EDIT MODE: Update existing document strictly via updateCommunity
                const updatePayload: UpdateCommunityInput = {
                    name: name.trim(),
                    handle: sanitizeHandle(handle),
                    description: description.trim(),
                    purpose: purpose.trim() || description.trim(),
                    mission: mission.trim() || undefined,
                    category,
                    topics: topics.length > 0 ? topics : [category],
                    avatarUrl: avatarUrl.trim() || community.avatarUrl || AVATAR_PRESETS[0].url,
                    bannerUrl: bannerUrl.trim() || community.bannerUrl || BANNER_PRESETS[0].url,
                    foundingStory: foundingStory.trim() || undefined,
                    values: values.length > 0 ? values : undefined,
                    guidelines: guidelines.length > 0 ? guidelines : undefined,
                    visibility,
                    joinPolicy,
                    governanceModel,
                    postPermission,
                    gatheringPermission,
                    adminIds: adminIdsList,
                };

                const res = await updateCommunity(
                    community.id,
                    updatePayload,
                    { uid: currentUser.uid, displayName: currentUser.displayName }
                );

                if (!res.success) {
                    setError(res.error || 'Failed to update community configuration.');
                    return;
                }

                const savedComm = res.community || {
                    ...community,
                    ...updatePayload,
                };

                setUpdatedCommunity(savedComm);
                if (onUpdated) {
                    onUpdated(savedComm);
                }
            } else {
                // CREATE MODE: Create new community document strictly via createCommunity
                const createPayload: CreateCommunityInput = {
                    name: name.trim(),
                    handle: sanitizeHandle(handle),
                    description: description.trim(),
                    purpose: purpose.trim() || description.trim(),
                    mission: mission.trim() || undefined,
                    category,
                    topics: topics.length > 0 ? topics : [category],
                    avatarUrl: avatarUrl.trim() || AVATAR_PRESETS[0].url,
                    bannerUrl: bannerUrl.trim() || BANNER_PRESETS[0].url,
                    foundingStory: foundingStory.trim() || undefined,
                    values: values.length > 0 ? values : undefined,
                    guidelines: guidelines.length > 0 ? guidelines : undefined,
                    visibility,
                    joinPolicy,
                    governanceModel,
                    postPermission,
                    gatheringPermission,
                    adminIds: adminIdsList,
                };

                const userActor = {
                    uid: currentUser.uid,
                    displayName: userProfile?.displayName || currentUser.displayName || 'Sovereign Founder',
                    photoURL: userProfile?.photoURL || currentUser.photoURL || undefined,
                };

                const created = await createCommunity(createPayload, userActor);

                setCreatedCommunityId(created.id);
                if (onCreated) {
                    onCreated(created.id);
                }
            }
        } catch (err: any) {
            console.error('[COMMUNITY_ACTION_FAILED]', err);
            setError(err?.message || 'Operation failed. Please check network and permissions.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleViewCommunity = () => {
        const targetId = createdCommunityId || updatedCommunity?.id || community?.id;
        if (targetId) {
            resetAndClose();
            navigate(`/communities/${targetId}`);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
            <div className="bg-[#0c0c0e] border border-zinc-800 w-full max-w-3xl max-h-[92vh] flex flex-col font-mono text-xs shadow-2xl overflow-hidden">
                {/* Modal Header */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-black/80">
                    <div className="flex items-center gap-2.5">
                        <div className={`p-1.5 border ${
                            isEditMode
                                ? 'bg-cyan-950/60 border-cyan-500/50 text-cyan-400'
                                : 'bg-emerald-950/60 border-emerald-500/50 text-emerald-400'
                        }`}>
                            <UsersIcon className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-zinc-500 tracking-wider uppercase font-bold">// INVOX COLLECTIVE FOUNDRY</span>
                                <span className="text-zinc-700">|</span>
                                <span className={`text-[10px] uppercase font-semibold ${
                                    isEditMode ? 'text-cyan-400' : 'text-emerald-400'
                                }`}>
                                    {isEditMode ? 'EDIT_MODE // CONFIGURATION' : 'SOVEREIGN WORKSPACE'}
                                </span>
                            </div>
                            <h2 className="font-bold text-white uppercase tracking-wider text-sm mt-0.5">
                                {isEditMode ? `MANAGE IDENTITY: ${community?.name || name || 'COMMUNITY COLLECTIVE'}` : 'ESTABLISH COMMUNITY COLLECTIVE'}
                            </h2>
                        </div>
                    </div>
                    <button
                        onClick={resetAndClose}
                        className="text-zinc-500 hover:text-white transition-colors p-1.5 border border-transparent hover:border-zinc-800"
                        aria-label="Close"
                    >
                        <CloseIcon className="w-4 h-4" />
                    </button>
                </div>

                {/* 6-Step Process Indicator Header */}
                {!createdCommunityId && !updatedCommunity && (
                    <div className="bg-zinc-950 border-b border-zinc-800 px-3 sm:px-4 py-2 sm:py-2.5">
                        <div className="grid grid-cols-6 gap-1 sm:gap-1.5 text-[9px] sm:text-[10px]">
                            {[
                                { num: 1, label: '01 FOUNDATION' },
                                { num: 2, label: '02 IDENTITY' },
                                { num: 3, label: '03 GUIDELINES' },
                                { num: 4, label: '04 GOVERNANCE' },
                                { num: 5, label: '05 APPEARANCE' },
                                { num: 6, label: '06 REVIEW' },
                            ].map((s) => {
                                const isActive = step === s.num;
                                const isPassed = step > s.num;
                                return (
                                    <button
                                        key={s.num}
                                        type="button"
                                        onClick={() => {
                                            if (isEditMode) {
                                                setStep(s.num as EstablishmentStep);
                                                setError(null);
                                            } else {
                                                if (s.num < step) {
                                                    setStep(s.num as EstablishmentStep);
                                                    setError(null);
                                                } else if (s.num === 2 && validateStep01()) {
                                                    setStep(2);
                                                } else if (s.num === 3 && validateStep01() && validateStep02()) {
                                                    setStep(3);
                                                } else if (s.num === 4 && validateStep01() && validateStep02()) {
                                                    setStep(4);
                                                } else if (s.num === 5 && validateStep01() && validateStep02()) {
                                                    setStep(5);
                                                } else if (s.num === 6 && validateStep01() && validateStep02() && validateStep05()) {
                                                    setStep(6);
                                                }
                                            }
                                        }}
                                        className={`py-1.5 px-1.5 sm:px-2 uppercase tracking-wider transition-all border text-left truncate flex items-center justify-between ${
                                            isActive
                                                ? (isEditMode ? 'border-cyan-400 bg-cyan-950/40 text-cyan-300 font-bold' : 'border-white bg-zinc-900 text-white font-bold')
                                                : isPassed
                                                ? (isEditMode ? 'border-cyan-900/60 bg-cyan-950/20 text-cyan-400 hover:border-cyan-600' : 'border-emerald-800/60 bg-emerald-950/20 text-emerald-400 hover:border-emerald-600')
                                                : (isEditMode ? 'border-zinc-800 bg-black/60 text-zinc-400 hover:border-zinc-700' : 'border-zinc-850 bg-black/40 text-zinc-600')
                                        }`}
                                    >
                                        <span className="truncate">{s.label}</span>
                                        {isPassed && <span className={`${isEditMode ? 'text-cyan-400' : 'text-emerald-400'} font-bold ml-0.5 sm:ml-1`}>✓</span>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Scrollable Body Content */}
                <div className="p-4 sm:p-6 overflow-y-auto no-scrollbar flex-1 space-y-5">
                    {/* Success State View */}
                    {createdCommunityId ? (
                        <div className="text-center py-8 space-y-5 animate-fadeIn">
                            <div className="w-14 h-14 bg-emerald-950/80 border border-emerald-500 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-950/50">
                                <CheckCircleIcon className="w-8 h-8" />
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] text-emerald-400 uppercase tracking-widest font-mono font-bold">
                                    // SOVEREIGNTY INITIALIZED & RECORDED
                                </span>
                                <h3 className="text-white font-bold text-lg uppercase tracking-wider">
                                    COLLECTIVE_ESTABLISHED
                                </h3>
                                <p className="text-zinc-400 text-xs max-w-md mx-auto leading-relaxed pt-1">
                                    Your collective has been successfully established in the INVOX network. You hold verified Sovereign Founder authority with full governance control.
                                </p>
                            </div>

                            {/* Collective Dossier Card */}
                            <div className="p-4 bg-black border border-zinc-800 max-w-lg mx-auto text-left space-y-3">
                                <div className="flex items-center gap-3">
                                    <img
                                        src={avatarUrl || AVATAR_PRESETS[0].url}
                                        alt={name}
                                        className="w-12 h-12 object-cover border border-zinc-700 bg-zinc-900"
                                        onError={(e) => {
                                            (e.currentTarget as HTMLImageElement).src = AVATAR_PRESETS[0].url;
                                        }}
                                    />
                                    <div className="min-w-0">
                                        <div className="text-emerald-400 font-bold text-sm tracking-wide">@{sanitizeHandle(handle)}</div>
                                        <div className="text-white font-bold text-xs truncate">{name}</div>
                                        <div className="text-zinc-500 text-[10px] mt-0.5">{category} • {visibility.toUpperCase()} • {joinPolicy.toUpperCase()}</div>
                                    </div>
                                </div>
                                <div className="text-zinc-400 text-[11px] border-t border-zinc-850 pt-2 line-clamp-2">
                                    {description}
                                </div>
                            </div>

                            <div className="pt-4 flex justify-center gap-3">
                                <button
                                    type="button"
                                    onClick={resetAndClose}
                                    className="px-5 py-2.5 bg-zinc-900 border border-zinc-800 text-zinc-300 uppercase hover:text-white hover:border-zinc-700 transition-colors"
                                >
                                    Return to My Space
                                </button>
                                <button
                                    type="button"
                                    onClick={handleViewCommunity}
                                    className="px-6 py-2.5 bg-white text-black font-bold uppercase hover:bg-zinc-200 transition-colors shadow-lg"
                                >
                                    Open Community Profile →
                                </button>
                            </div>
                        </div>
                    ) : updatedCommunity ? (
                        <div className="text-center py-8 space-y-5 animate-fadeIn">
                            <div className="w-14 h-14 bg-cyan-950/80 border border-cyan-500 text-cyan-400 flex items-center justify-center mx-auto shadow-lg shadow-cyan-950/50">
                                <CheckCircleIcon className="w-8 h-8" />
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] text-cyan-400 uppercase tracking-widest font-mono font-bold">
                                    // SOVEREIGN CONFIGURATION SYNCHRONIZED
                                </span>
                                <h3 className="text-white font-bold text-lg uppercase tracking-wider">
                                    COLLECTIVE_CONFIGURATION_SAVED
                                </h3>
                                <p className="text-zinc-400 text-xs max-w-md mx-auto leading-relaxed pt-1">
                                    All six configuration pillars have been updated for <strong className="text-white">{updatedCommunity.name}</strong>. Existing memberships, conclave records, and canonical identifiers remain preserved.
                                </p>
                            </div>

                            {/* Collective Dossier Card */}
                            <div className="p-4 bg-black border border-zinc-800 max-w-lg mx-auto text-left space-y-3">
                                <div className="flex items-center gap-3">
                                    <img
                                        src={updatedCommunity.avatarUrl || avatarUrl || AVATAR_PRESETS[0].url}
                                        alt={updatedCommunity.name}
                                        className="w-12 h-12 object-cover border border-zinc-700 bg-zinc-900"
                                        onError={(e) => {
                                            (e.currentTarget as HTMLImageElement).src = AVATAR_PRESETS[0].url;
                                        }}
                                    />
                                    <div className="min-w-0">
                                        <div className="text-cyan-400 font-bold text-sm tracking-wide">@{sanitizeHandle(updatedCommunity.handle || handle)}</div>
                                        <div className="text-white font-bold text-xs truncate">{updatedCommunity.name}</div>
                                        <div className="text-zinc-500 text-[10px] mt-0.5">{updatedCommunity.category || category} • {(updatedCommunity.visibility || visibility).toUpperCase()} • {(updatedCommunity.joinPolicy || joinPolicy).toUpperCase()}</div>
                                    </div>
                                </div>
                                <div className="text-zinc-400 text-[11px] border-t border-zinc-850 pt-2 line-clamp-2">
                                    {updatedCommunity.description || description}
                                </div>
                            </div>

                            <div className="pt-4 flex justify-center gap-3">
                                <button
                                    type="button"
                                    onClick={resetAndClose}
                                    className="px-5 py-2.5 bg-zinc-900 border border-zinc-800 text-zinc-300 uppercase hover:text-white hover:border-zinc-700 transition-colors"
                                >
                                    Return to Community Manager
                                </button>
                                <button
                                    type="button"
                                    onClick={handleViewCommunity}
                                    className="px-6 py-2.5 bg-white text-black font-bold uppercase hover:bg-zinc-200 transition-colors shadow-lg"
                                >
                                    View Updated Collective →
                                </button>
                            </div>
                        </div>
                    ) : (
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (step === 6) {
                                    handleFinalEstablish(e);
                                } else {
                                    handleNext(e);
                                }
                            }}
                            className="space-y-5"
                        >
                            {/* Error Banner */}
                            {error && (
                                <div className="p-3 bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-start gap-2">
                                    <span className="font-bold text-rose-400">[VALIDATION_FAULT]:</span>
                                    <span>{error}</span>
                                </div>
                            )}

                            {/* ==================== STEP 01: FOUNDATION ==================== */}
                            {step === 1 && (
                                <div className="space-y-4 animate-fadeIn">
                                    <div className="border-b border-zinc-850 pb-2 flex items-center justify-between">
                                        <div>
                                            <h3 className="text-white font-bold uppercase text-xs tracking-wider">
                                                // STEP 01: FOUNDATIONAL ESSENTIALS
                                            </h3>
                                            <p className="text-zinc-500 text-[11px] mt-0.5">
                                                Define canonical identifier, core purpose, discovery visibility, and entry criteria.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Name Input */}
                                    <div>
                                        <label className="block text-zinc-300 uppercase text-[10px] tracking-wider mb-1 font-bold">
                                            Collective Name *
                                        </label>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => handleNameChange(e.target.value)}
                                            placeholder="e.g. Distributed Systems Architecture Guild"
                                            className="w-full bg-black border border-zinc-800 px-3 py-2 text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-400 text-xs font-mono"
                                            maxLength={80}
                                            required
                                        />
                                    </div>

                                    {/* Handle & Category */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                        <div>
                                            <label className="block text-zinc-300 uppercase text-[10px] tracking-wider mb-1 font-bold">
                                                Canonical Handle / Slug *
                                            </label>
                                            <div className="flex items-center bg-black border border-zinc-800 focus-within:border-emerald-400">
                                                <span className="px-2.5 text-zinc-500 font-bold">@</span>
                                                <input
                                                    type="text"
                                                    value={handle}
                                                    onChange={(e) => {
                                                        const clean = sanitizeHandle(e.target.value);
                                                        setHandle(clean);
                                                    }}
                                                    placeholder="dist-systems"
                                                    className="w-full bg-transparent py-2 pr-2 text-white placeholder-zinc-600 focus:outline-none text-xs font-mono"
                                                    maxLength={30}
                                                    required
                                                />
                                                {checkingHandle && (
                                                    <span className="text-[10px] text-zinc-500 px-2 animate-pulse">CHECKING</span>
                                                )}
                                                {!checkingHandle && handleAvailability.checked && (
                                                    <span className={`text-[10px] px-2 font-bold ${handleAvailability.available ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                        {handleAvailability.available ? 'AVAILABLE' : 'TAKEN'}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-[10px] text-zinc-500 mt-1 block">
                                                Lowercase, alphanumeric, underscores, hyphens (used for routing: /communities/@{handle || 'handle'})
                                            </span>
                                        </div>

                                        <div>
                                            <label className="block text-zinc-300 uppercase text-[10px] tracking-wider mb-1 font-bold">
                                                Domain Category *
                                            </label>
                                            <select
                                                value={category}
                                                onChange={(e) => setCategory(e.target.value)}
                                                className="w-full bg-black border border-zinc-800 px-3 py-2 text-white focus:outline-none focus:border-emerald-400 text-xs font-mono"
                                            >
                                                {COMMUNITY_DOMAINS.map((d) => (
                                                    <option key={d.slug} value={d.name}>{d.name}</option>
                                                ))}
                                            </select>
                                            <span className="text-[10px] text-zinc-500 mt-1 block">Primary platform indexing category</span>
                                        </div>
                                    </div>

                                    {/* Short Description */}
                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="text-zinc-300 uppercase text-[10px] tracking-wider font-bold">
                                                Short Description * (Min 20 characters)
                                            </label>
                                            <span className="text-[10px] text-zinc-500">{description.length}/400</span>
                                        </div>
                                        <textarea
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            placeholder="A succinct summary of who gathers here and what problem space this collective explores..."
                                            rows={2}
                                            className="w-full bg-black border border-zinc-800 p-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-400 text-xs font-mono resize-none"
                                            maxLength={400}
                                            required
                                        />
                                    </div>

                                    {/* Primary Purpose */}
                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="text-zinc-300 uppercase text-[10px] tracking-wider font-bold">
                                                Primary Purpose * (Why this collective exists)
                                            </label>
                                            <span className="text-[10px] text-zinc-500">{purpose.length}/400</span>
                                        </div>
                                        <textarea
                                            value={purpose}
                                            onChange={(e) => setPurpose(e.target.value)}
                                            placeholder="The existential raison d'être that unites all members (e.g. Advancing fault-tolerant consensus systems through reproducible research)..."
                                            rows={2}
                                            className="w-full bg-black border border-zinc-800 p-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-400 text-xs font-mono resize-none"
                                            maxLength={400}
                                        />
                                    </div>

                                    {/* Discovery Visibility & Joining Policy */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                                        <div className="border border-zinc-800 p-3 bg-black/50">
                                            <div className="flex items-center gap-1.5 text-zinc-300 font-bold text-[10px] uppercase mb-2">
                                                <GlobeAltIcon className="w-3.5 h-3.5 text-cyan-400" />
                                                <span>Discovery Visibility</span>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="flex items-center gap-2 cursor-pointer text-zinc-300 hover:text-white">
                                                    <input
                                                        type="radio"
                                                        name="visibility"
                                                        value="public"
                                                        checked={visibility === 'public'}
                                                        onChange={() => setVisibility('public')}
                                                        className="text-white"
                                                    />
                                                    <span>Public (Listed on Global Discovery & Search)</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer text-zinc-300 hover:text-white">
                                                    <input
                                                        type="radio"
                                                        name="visibility"
                                                        value="private"
                                                        checked={visibility === 'private'}
                                                        onChange={() => setVisibility('private')}
                                                        className="text-white"
                                                    />
                                                    <span>Private (Direct Invite Link Only)</span>
                                                </label>
                                            </div>
                                        </div>

                                        <div className="border border-zinc-800 p-3 bg-black/50">
                                            <div className="flex items-center gap-1.5 text-zinc-300 font-bold text-[10px] uppercase mb-2">
                                                <ShieldCheckIcon className="w-3.5 h-3.5 text-emerald-400" />
                                                <span>Joining Policy</span>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="flex items-center gap-2 cursor-pointer text-zinc-300 hover:text-white">
                                                    <input
                                                        type="radio"
                                                        name="joinPolicy"
                                                        value="open"
                                                        checked={joinPolicy === 'open'}
                                                        onChange={() => setJoinPolicy('open')}
                                                        className="text-white"
                                                    />
                                                    <span>Open (Immediate Membership)</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer text-zinc-300 hover:text-white">
                                                    <input
                                                        type="radio"
                                                        name="joinPolicy"
                                                        value="approval_required"
                                                        checked={joinPolicy === 'approval_required'}
                                                        onChange={() => setJoinPolicy('approval_required')}
                                                        className="text-white"
                                                    />
                                                    <span>Approval Required (Application Vetting)</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ==================== STEP 02: COLLECTIVE IDENTITY ==================== */}
                            {step === 2 && (
                                <div className="space-y-4 animate-fadeIn">
                                    <div className="border-b border-zinc-850 pb-2 flex items-center justify-between">
                                        <div>
                                            <h3 className="text-white font-bold uppercase text-xs tracking-wider">
                                                // STEP 02: COLLECTIVE IDENTITY ARCHITECTURE
                                            </h3>
                                            <p className="text-zinc-500 text-[11px] mt-0.5">
                                                Establish mission, core values, origin narrative, and binding code of conduct.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Subtabs for Identity Pillars */}
                                    <div className="flex items-center border border-zinc-800 bg-zinc-950 p-1 gap-1">
                                        {[
                                            { id: 'purpose', label: '1. Purpose & Mission' },
                                            { id: 'values', label: `2. Core Values (${values.length})` },
                                            { id: 'story', label: '3. Founding Story' },
                                        ].map((t) => (
                                            <button
                                                key={t.id}
                                                type="button"
                                                onClick={() => setIdentityTab(t.id as any)}
                                                className={`flex-1 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider transition-colors border ${
                                                    identityTab === t.id
                                                        ? 'bg-zinc-850 text-white border-zinc-600'
                                                        : 'bg-transparent text-zinc-400 hover:text-zinc-200 border-transparent'
                                                }`}
                                            >
                                                {t.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Tab 1: Purpose & Mission */}
                                    {identityTab === 'purpose' && (
                                        <div className="space-y-3.5 bg-zinc-950/60 border border-zinc-800 p-4">
                                            <div>
                                                <div className="flex justify-between items-center mb-1">
                                                    <label className="text-zinc-300 uppercase text-[10px] tracking-wider font-bold">
                                                        Collective Purpose (Why we exist)
                                                    </label>
                                                    <span className="text-[10px] text-zinc-500">{purpose.length}/600</span>
                                                </div>
                                                <textarea
                                                    value={purpose}
                                                    onChange={(e) => setPurpose(e.target.value)}
                                                    placeholder="Define the deeper rationale and imperative driving this collective..."
                                                    rows={3}
                                                    className="w-full bg-black border border-zinc-800 p-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-400 text-xs font-mono resize-none"
                                                    maxLength={600}
                                                />
                                            </div>

                                            <div>
                                                <div className="flex justify-between items-center mb-1">
                                                    <label className="text-zinc-300 uppercase text-[10px] tracking-wider font-bold">
                                                        Collective Mission (What we aim to achieve)
                                                    </label>
                                                    <span className="text-[10px] text-zinc-500">{mission.length}/600</span>
                                                </div>
                                                <textarea
                                                    value={mission}
                                                    onChange={(e) => setMission(e.target.value)}
                                                    placeholder="The tangible goals, outputs, or technological milestones this collective strives toward..."
                                                    rows={3}
                                                    className="w-full bg-black border border-zinc-800 p-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-400 text-xs font-mono resize-none"
                                                    maxLength={600}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Tab 2: Core Values Editor */}
                                    {identityTab === 'values' && (
                                        <div className="bg-zinc-950/60 border border-zinc-800 p-4">
                                            <CoreValuesEditor
                                                values={values}
                                                onChange={setValues}
                                                onError={setError}
                                            />
                                        </div>
                                    )}

                                    {/* Tab 3: Founding Story */}
                                    {identityTab === 'story' && (
                                        <div className="bg-zinc-950/60 border border-zinc-800 p-4 space-y-2">
                                            <div className="flex justify-between items-center mb-1">
                                                <div>
                                                    <label className="text-zinc-300 uppercase text-[10px] tracking-wider font-bold block">
                                                        Founding Story & Origin Narrative
                                                    </label>
                                                    <span className="text-[10px] text-zinc-500">
                                                        How was this collective conceived? What breakdown or breakthrough led to its inception?
                                                    </span>
                                                </div>
                                                <span className="text-[10px] text-zinc-500">{foundingStory.length}/2000</span>
                                            </div>
                                            <textarea
                                                value={foundingStory}
                                                onChange={(e) => setFoundingStory(e.target.value)}
                                                placeholder="In early 2026, after experiencing repetitive breakdowns in conventional monolithic networks, we convened an experimental working group..."
                                                rows={6}
                                                className="w-full bg-black border border-zinc-800 p-3 text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-400 text-xs font-mono leading-relaxed"
                                                maxLength={2000}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ==================== STEP 03: COMMUNITY GUIDELINES ==================== */}
                            {step === 3 && (
                                <div className="space-y-4 animate-fadeIn">
                                    <div className="border-b border-zinc-850 pb-2 flex items-center justify-between">
                                        <div>
                                            <h3 className="text-white font-bold uppercase text-xs tracking-wider">
                                                // STEP 03: COMMUNITY GUIDELINES & CONDUCT STANDARDS
                                            </h3>
                                            <p className="text-zinc-500 text-[11px] mt-0.5">
                                                Define codes of conduct, expected member behaviors, prohibited violations, and moderation philosophy.
                                            </p>
                                        </div>
                                        <span className="text-[10px] text-emerald-400 border border-emerald-800/60 bg-emerald-950/20 px-2 py-0.5">
                                            {guidelines.length} Rules Active
                                        </span>
                                    </div>

                                    {/* Suggested Quick-Add Presets Sections */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {/* Expected Member Behaviour */}
                                        <div className="bg-zinc-950/80 border border-zinc-800 p-3 space-y-2">
                                            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                                                <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-400" />
                                                <span>Expected Member Behaviour</span>
                                            </div>
                                            <p className="text-[10px] text-zinc-400">
                                                Click to add suggested constructive behaviors:
                                            </p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {EXPECTED_BEHAVIOUR_PRESETS.map((preset) => {
                                                    const isAdded = guidelines.some(g => g.title.toLowerCase() === preset.title.toLowerCase());
                                                    return (
                                                        <button
                                                            key={preset.title}
                                                            type="button"
                                                            disabled={isAdded}
                                                            onClick={() => handleApplyGuidelinePreset(preset)}
                                                            className={`text-[10px] px-2 py-1 border transition-colors text-left ${
                                                                isAdded
                                                                    ? 'border-zinc-850 bg-black text-zinc-600 line-through cursor-not-allowed'
                                                                    : 'border-zinc-700 bg-black text-zinc-300 hover:text-white hover:border-emerald-400'
                                                            }`}
                                                            title={preset.description}
                                                        >
                                                            + {preset.title}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Prohibited Conduct */}
                                        <div className="bg-zinc-950/80 border border-zinc-800 p-3 space-y-2">
                                            <div className="text-[10px] font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                                                <ShieldCheckIcon className="w-3.5 h-3.5 text-rose-400" />
                                                <span>Prohibited Conduct</span>
                                            </div>
                                            <p className="text-[10px] text-zinc-400">
                                                Click to add explicit boundary and anti-abuse rules:
                                            </p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {PROHIBITED_CONDUCT_PRESETS.map((preset) => {
                                                    const isAdded = guidelines.some(g => g.title.toLowerCase() === preset.title.toLowerCase());
                                                    return (
                                                        <button
                                                            key={preset.title}
                                                            type="button"
                                                            disabled={isAdded}
                                                            onClick={() => handleApplyGuidelinePreset(preset)}
                                                            className={`text-[10px] px-2 py-1 border transition-colors text-left ${
                                                                isAdded
                                                                    ? 'border-zinc-850 bg-black text-zinc-600 line-through cursor-not-allowed'
                                                                    : 'border-zinc-700 bg-black text-zinc-300 hover:text-white hover:border-rose-400'
                                                            }`}
                                                            title={preset.description}
                                                        >
                                                            + {preset.title}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Add / Edit Rule Form */}
                                    <div className="bg-zinc-900/60 border border-zinc-700 p-3 space-y-2.5">
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-300 flex items-center justify-between">
                                            <span>{editingRuleIdx !== null ? `// EDIT COMMUNITY RULE #${editingRuleIdx + 1}` : '// DEFINE CUSTOM COMMUNITY RULE'}</span>
                                            <span className="text-zinc-500 font-normal">Rules can be reordered, edited, or removed</span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                            <div className="sm:col-span-1">
                                                <input
                                                    type="text"
                                                    value={ruleTitleInput}
                                                    onChange={(e) => setRuleTitleInput(e.target.value)}
                                                    placeholder="Rule Title (e.g. Respectful Dissent)"
                                                    maxLength={100}
                                                    className="w-full bg-black border border-zinc-800 px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-400 font-mono"
                                                />
                                            </div>
                                            <div className="sm:col-span-2">
                                                <input
                                                    type="text"
                                                    value={ruleDescInput}
                                                    onChange={(e) => setRuleDescInput(e.target.value)}
                                                    placeholder="Standard description or enforced behavioral boundary..."
                                                    maxLength={500}
                                                    className="w-full bg-black border border-zinc-800 px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-400 font-mono"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex justify-end gap-2 pt-1">
                                            {editingRuleIdx !== null && (
                                                <button
                                                    type="button"
                                                    onClick={handleCancelRuleEdit}
                                                    className="px-3 py-1 text-xs border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800 uppercase"
                                                >
                                                    Cancel
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={handleSaveRule}
                                                className="px-3.5 py-1 text-xs font-bold uppercase border border-emerald-500/80 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500 hover:text-black flex items-center gap-1 transition-colors"
                                            >
                                                {editingRuleIdx !== null ? (
                                                    <>
                                                        <CheckIcon className="w-3.5 h-3.5" />
                                                        <span>Update Rule</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <PlusIcon className="w-3.5 h-3.5" />
                                                        <span>Add Rule</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* List of Configured Community Rules */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-[10px] text-zinc-400 uppercase font-bold px-1">
                                            <span>Configured Collective Rules ({guidelines.length})</span>
                                            <span>Use arrows to reorder precedence</span>
                                        </div>

                                        {guidelines.length === 0 ? (
                                            <div className="text-center py-6 border border-dashed border-zinc-800 bg-zinc-950/40 text-zinc-500 text-xs">
                                                No community rules added yet. Select recommended behavior or conduct chips above, or create custom rules.
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {guidelines.map((rule, idx) => (
                                                    <div
                                                        key={rule.id || idx}
                                                        className="bg-zinc-950/90 border border-zinc-800 p-3 flex items-start justify-between gap-3 group hover:border-zinc-700 transition-colors"
                                                    >
                                                        <div className="space-y-1 flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-mono text-emerald-400 font-bold">
                                                                    {(idx + 1).toString().padStart(2, '0')}.
                                                                </span>
                                                                <span className="text-xs font-bold text-white uppercase tracking-wider">
                                                                    {rule.title}
                                                                </span>
                                                            </div>
                                                            {rule.description && (
                                                                <p className="text-[11px] text-zinc-400 leading-relaxed pl-6">
                                                                    {rule.description}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-1 flex-shrink-0">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleMoveRule(idx, 'up')}
                                                                disabled={idx === 0}
                                                                className="p-1 text-zinc-500 hover:text-white disabled:opacity-20 border border-zinc-850 hover:border-zinc-700"
                                                                title="Move rule up"
                                                            >
                                                                <ChevronUpIcon className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleMoveRule(idx, 'down')}
                                                                disabled={idx === guidelines.length - 1}
                                                                className="p-1 text-zinc-500 hover:text-white disabled:opacity-20 border border-zinc-850 hover:border-zinc-700"
                                                                title="Move rule down"
                                                            >
                                                                <ChevronDownIcon className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleEditRule(idx)}
                                                                className="p-1 text-zinc-400 hover:text-emerald-400 border border-zinc-850 hover:border-zinc-700"
                                                                title="Edit rule"
                                                            >
                                                                <PencilSquareIcon className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveRule(idx)}
                                                                className="p-1 text-zinc-400 hover:text-rose-400 border border-zinc-850 hover:border-rose-900"
                                                                title="Remove rule"
                                                            >
                                                                <TrashIcon className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Moderation & Enforcement Policy Section */}
                                    <div className="bg-zinc-950/70 border border-zinc-800 p-3.5 space-y-3">
                                        <div className="flex items-center gap-1.5 text-zinc-300 font-bold text-[10px] uppercase">
                                            <ShieldCheckIcon className="w-3.5 h-3.5 text-amber-400" />
                                            <span>Moderation & Enforcement Framework</span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                            {MODERATION_POLICY_OPTIONS.map((opt) => (
                                                <button
                                                    key={opt.id}
                                                    type="button"
                                                    onClick={() => setModerationPolicy(opt.label)}
                                                    className={`p-2.5 text-left border transition-all ${
                                                        moderationPolicy === opt.label
                                                            ? 'border-amber-400 bg-amber-950/20 text-white'
                                                            : 'border-zinc-850 bg-black/60 text-zinc-400 hover:border-zinc-700'
                                                    }`}
                                                >
                                                    <div className="font-bold text-[11px] text-amber-300">{opt.label}</div>
                                                    <div className="text-[10px] text-zinc-400 mt-1 line-clamp-3">{opt.summary}</div>
                                                </button>
                                            ))}
                                        </div>
                                        <div>
                                            <input
                                                type="text"
                                                value={customModerationNote}
                                                onChange={(e) => setCustomModerationNote(e.target.value)}
                                                placeholder="Optional custom escalation or appeal instructions..."
                                                maxLength={300}
                                                className="w-full bg-black border border-zinc-800 px-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-400 font-mono"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ==================== STEP 04: GOVERNANCE & SOVEREIGNTY ==================== */}
                            {step === 4 && (
                                <div className="space-y-4 animate-fadeIn">
                                    <div className="border-b border-zinc-850 pb-2">
                                        <h3 className="text-white font-bold uppercase text-xs tracking-wider">
                                            // STEP 04: GOVERNANCE & SOVEREIGNTY ARCHITECTURE
                                        </h3>
                                        <p className="text-zinc-500 text-[11px] mt-0.5">
                                            Establish sovereign ownership boundaries, administrator roles, and participation permissions.
                                        </p>
                                    </div>

                                    {/* Sovereign Authority Clarification Box */}
                                    {/* Sovereign Authority Clarification Box */}
                                    <div className="bg-zinc-950 border border-amber-500/40 p-3.5 space-y-2.5">
                                        <div className="flex items-center gap-2 text-amber-300 font-bold text-xs uppercase">
                                            <span className="w-2 h-2 bg-amber-400 rounded-full animate-ping" />
                                            <span>
                                                {isEditMode 
                                                    ? 'SOVEREIGN GOVERNANCE & AUTHORITY STATUS' 
                                                    : 'SOVEREIGN FOUNDER AUTHORITY CONFIRMATION'
                                                }
                                            </span>
                                        </div>
                                        <div className="text-[11px] text-zinc-300 space-y-2 leading-relaxed">
                                            {isEditMode && community ? (
                                                <div className="bg-black/60 border border-zinc-800 p-2.5 space-y-1.5">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-zinc-400 uppercase text-[10px] font-bold">SOVEREIGN REGISTERED OWNER (IMMUTABLE):</span>
                                                        <span className="text-amber-400 font-mono text-[10px]">
                                                            {community.ownerId || community.creatorId || 'ESTABLISHED'}
                                                        </span>
                                                    </div>
                                                    <div className="text-zinc-300 text-[11px]">
                                                        Current Session Authority: <strong className="text-emerald-400">
                                                            {currentUser?.uid === (community.ownerId || community.creatorId) 
                                                                ? 'SOVEREIGN OWNER' 
                                                                : 'APPOINTED ADMINISTRATOR'
                                                            }
                                                        </strong> ({currentUser?.displayName || currentUser?.email})
                                                    </div>
                                                    <p className="text-[10px] text-zinc-500">
                                                        Sovereign founder ownership is permanent and cannot be reassigned via this identity interface.
                                                    </p>
                                                </div>
                                            ) : (
                                                <p>
                                                    You (<strong className="text-white">{currentUser?.displayName || currentUser?.email || 'Authenticated User'}</strong>) will automatically be registered as the irrevocable <strong className="text-amber-300">COMMUNITY OWNER</strong>.
                                                </p>
                                            )}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] pt-1">
                                                <div className="bg-black/60 border border-zinc-800 p-2.5">
                                                    <div className="font-bold text-amber-400 uppercase">// OWNER POWERS</div>
                                                    <ul className="list-disc list-inside text-zinc-400 mt-1 space-y-0.5">
                                                        <li>Full sovereign authority</li>
                                                        <li>Appoint or revoke Administrators</li>
                                                        <li>Transfer ownership or delete collective</li>
                                                        <li>Modify all collective identity facets</li>
                                                    </ul>
                                                </div>
                                                <div className="bg-black/60 border border-zinc-800 p-2.5">
                                                    <div className="font-bold text-cyan-400 uppercase">// ADMINISTRATOR POWERS</div>
                                                    <ul className="list-disc list-inside text-zinc-400 mt-1 space-y-0.5">
                                                        <li>Manage community identity & conclaves</li>
                                                        <li>Approve or decline membership requests</li>
                                                        <li>Moderate threads and discussions</li>
                                                        <li><span className="text-rose-400">Cannot</span> remove owner or delete collective</li>
                                                    </ul>
                                                </div>
                                            </div>
                                            <div className="bg-zinc-900/80 border border-zinc-800 p-2 text-[10px] text-zinc-400 flex items-center gap-1.5">
                                                <span className="text-amber-400 font-bold">[NOTE]:</span>
                                                <span>Community governance is collective-specific. Global platform administrator roles do not grant automatic rights over this collective.</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Governance Settings Form */}
                                    <div className="space-y-3.5">
                                        <div>
                                            <label className="block text-zinc-300 uppercase text-[10px] tracking-wider mb-1 font-bold">
                                                Initial Governance Structure
                                            </label>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setGovernanceModel('Sovereign Founder')}
                                                    className={`p-3 text-left border transition-all ${
                                                        governanceModel === 'Sovereign Founder'
                                                            ? 'border-white bg-zinc-900 text-white'
                                                            : 'border-zinc-850 bg-black text-zinc-500 hover:border-zinc-700'
                                                    }`}
                                                >
                                                    <div className="font-bold text-xs uppercase">Sovereign Founder</div>
                                                    <div className="text-[10px] text-zinc-400 mt-1">
                                                        Direct founder oversight. Owner maintains unilateral approval over identity and guidelines.
                                                    </div>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => setGovernanceModel('Council / Delegated Administration')}
                                                    className={`p-3 text-left border transition-all ${
                                                        governanceModel === 'Council / Delegated Administration'
                                                            ? 'border-white bg-zinc-900 text-white'
                                                            : 'border-zinc-850 bg-black text-zinc-500 hover:border-zinc-700'
                                                    }`}
                                                >
                                                    <div className="font-bold text-xs uppercase">Council / Delegated</div>
                                                    <div className="text-[10px] text-zinc-400 mt-1">
                                                        Collaborative administration. Appointed council members can execute collective adjustments.
                                                    </div>
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                            <div className="border border-zinc-800 p-3 bg-black/40">
                                                <label className="block text-zinc-300 uppercase text-[10px] tracking-wider mb-2 font-bold">
                                                    Discussions & Queries
                                                </label>
                                                <div className="space-y-1.5 text-[11px]">
                                                    <label className="flex items-center gap-2 cursor-pointer text-zinc-300 hover:text-white">
                                                        <input
                                                            type="radio"
                                                            name="postPermission"
                                                            checked={postPermission === 'all'}
                                                            onChange={() => setPostPermission('all')}
                                                        />
                                                        <span>All active members can publish</span>
                                                    </label>
                                                    <label className="flex items-center gap-2 cursor-pointer text-zinc-300 hover:text-white">
                                                        <input
                                                            type="radio"
                                                            name="postPermission"
                                                            checked={postPermission === 'admins_only'}
                                                            onChange={() => setPostPermission('admins_only')}
                                                        />
                                                        <span>Admins & moderators only</span>
                                                    </label>
                                                </div>
                                            </div>

                                            <div className="border border-zinc-800 p-3 bg-black/40">
                                                <label className="block text-zinc-300 uppercase text-[10px] tracking-wider mb-2 font-bold">
                                                    Conclave Gatherings
                                                </label>
                                                <div className="space-y-1.5 text-[11px]">
                                                    <label className="flex items-center gap-2 cursor-pointer text-zinc-300 hover:text-white">
                                                        <input
                                                            type="radio"
                                                            name="gatheringPermission"
                                                            checked={gatheringPermission === 'all'}
                                                            onChange={() => setGatheringPermission('all')}
                                                        />
                                                        <span>Any member can host a conclave</span>
                                                    </label>
                                                    <label className="flex items-center gap-2 cursor-pointer text-zinc-300 hover:text-white">
                                                        <input
                                                            type="radio"
                                                            name="gatheringPermission"
                                                            checked={gatheringPermission === 'admins_only'}
                                                            onChange={() => setGatheringPermission('admins_only')}
                                                        />
                                                        <span>Admins only can schedule</span>
                                                    </label>
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-zinc-300 uppercase text-[10px] tracking-wider mb-1 font-bold">
                                                Initial Appointed Administrators (Optional UIDs)
                                            </label>
                                            <input
                                                type="text"
                                                value={adminInput}
                                                onChange={(e) => setAdminInput(e.target.value)}
                                                placeholder="Optional comma-separated Firebase UIDs (can also be appointed later)"
                                                className="w-full bg-black border border-zinc-800 px-3 py-2 text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-400 text-xs font-mono"
                                            />
                                            <span className="text-[10px] text-zinc-500 mt-1 block">
                                                You can appoint trusted peers as administrators at any time from your Collective Management dashboard.
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ==================== STEP 05: APPEARANCE & DISCOVERY ==================== */}
                            {step === 5 && (
                                <div className="space-y-4 animate-fadeIn">
                                    <div className="border-b border-zinc-850 pb-2">
                                        <h3 className="text-white font-bold uppercase text-xs tracking-wider">
                                            // STEP 05: APPEARANCE & DISCOVERY CUSTOMIZATION
                                        </h3>
                                        <p className="text-zinc-500 text-[11px] mt-0.5">
                                            Select iconography, header atmosphere, and searchable taxonomy tags.
                                        </p>
                                    </div>

                                    {/* Emblem / Avatar */}
                                    <div className="space-y-2">
                                        <label className="block text-zinc-300 uppercase text-[10px] tracking-wider font-bold">
                                            Emblem / Avatar Insignia
                                        </label>
                                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                                            <span className="text-[10px] text-zinc-500 uppercase">Presets:</span>
                                            {AVATAR_PRESETS.map((p) => (
                                                <button
                                                    key={p.label}
                                                    type="button"
                                                    onClick={() => setAvatarUrl(p.url)}
                                                    className={`px-2 py-1 text-[10px] border transition-colors ${
                                                        avatarUrl === p.url
                                                            ? 'border-emerald-400 bg-emerald-950/30 text-emerald-300 font-bold'
                                                            : 'border-zinc-800 bg-black text-zinc-400 hover:text-white'
                                                    }`}
                                                >
                                                    {p.label}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="flex gap-3 items-center">
                                            <img
                                                src={avatarUrl || AVATAR_PRESETS[0].url}
                                                alt="Emblem Preview"
                                                className="w-12 h-12 object-cover border border-zinc-700 bg-zinc-900 flex-shrink-0"
                                                onError={(e) => {
                                                    (e.currentTarget as HTMLImageElement).src = AVATAR_PRESETS[0].url;
                                                }}
                                            />
                                            <input
                                                type="url"
                                                value={avatarUrl}
                                                onChange={(e) => setAvatarUrl(e.target.value)}
                                                placeholder="Or paste custom image URL (https://...)"
                                                className="flex-1 bg-black border border-zinc-800 px-3 py-2 text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-400 text-xs font-mono"
                                            />
                                        </div>
                                    </div>

                                    {/* Cover Banner */}
                                    <div className="space-y-2">
                                        <label className="block text-zinc-300 uppercase text-[10px] tracking-wider font-bold">
                                            Cover Atmosphere Banner
                                        </label>
                                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                                            <span className="text-[10px] text-zinc-500 uppercase">Presets:</span>
                                            {BANNER_PRESETS.map((b) => (
                                                <button
                                                    key={b.label}
                                                    type="button"
                                                    onClick={() => setBannerUrl(b.url)}
                                                    className={`px-2 py-1 text-[10px] border transition-colors ${
                                                        bannerUrl === b.url
                                                            ? 'border-emerald-400 bg-emerald-950/30 text-emerald-300 font-bold'
                                                            : 'border-zinc-800 bg-black text-zinc-400 hover:text-white'
                                                    }`}
                                                >
                                                    {b.label}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="space-y-2">
                                            <div className="h-16 w-full border border-zinc-800 bg-zinc-950 overflow-hidden relative">
                                                <img
                                                    src={bannerUrl || BANNER_PRESETS[0].url}
                                                    alt="Banner Preview"
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        (e.currentTarget as HTMLImageElement).src = BANNER_PRESETS[0].url;
                                                    }}
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                                            </div>
                                            <input
                                                type="url"
                                                value={bannerUrl}
                                                onChange={(e) => setBannerUrl(e.target.value)}
                                                placeholder="Or paste custom banner image URL (https://...)"
                                                className="w-full bg-black border border-zinc-800 px-3 py-2 text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-400 text-xs font-mono"
                                            />
                                        </div>
                                    </div>

                                    {/* Topic Tags */}
                                    <div className="space-y-2">
                                        <label className="block text-zinc-300 uppercase text-[10px] tracking-wider font-bold">
                                            Discovery Topic Tags ({topics.length}/8)
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={newTagInput}
                                                onChange={(e) => setNewTagInput(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        handleAddTopic(newTagInput);
                                                    }
                                                }}
                                                placeholder="Add custom keyword (press Enter)..."
                                                className="flex-1 bg-black border border-zinc-800 px-3 py-2 text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-400 text-xs font-mono"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleAddTopic(newTagInput)}
                                                className="px-3 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-white uppercase text-[11px] font-bold"
                                            >
                                                + Add
                                            </button>
                                        </div>

                                        {/* Current Selected Topics */}
                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                            {topics.map((t, idx) => (
                                                <span
                                                    key={t}
                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900 border border-zinc-700 text-zinc-200 text-[10px]"
                                                >
                                                    #{t}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveTopic(idx)}
                                                        className="text-zinc-500 hover:text-rose-400 ml-1"
                                                    >
                                                        ×
                                                    </button>
                                                </span>
                                            ))}
                                        </div>

                                        {/* Suggested Topics */}
                                        <div className="pt-1">
                                            <span className="text-[10px] text-zinc-500 uppercase block mb-1.5">Suggested Tags:</span>
                                            <div className="flex flex-wrap gap-1.5">
                                                {SUGGESTED_TOPICS.map((tag) => {
                                                    const isAdded = topics.some(t => t.toLowerCase() === tag.toLowerCase());
                                                    return (
                                                        <button
                                                            key={tag}
                                                            type="button"
                                                            disabled={isAdded}
                                                            onClick={() => handleAddTopic(tag)}
                                                            className={`text-[10px] px-2 py-0.5 border ${
                                                                isAdded
                                                                    ? 'border-zinc-850 text-zinc-700 cursor-not-allowed bg-black'
                                                                    : 'border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600 bg-zinc-950'
                                                            }`}
                                                        >
                                                            + #{tag}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ==================== STEP 06: REVIEW & ESTABLISH ==================== */}
                            {step === 6 && (
                                <div className="space-y-4 animate-fadeIn">
                                    <div className="border-b border-zinc-850 pb-2 flex items-center justify-between">
                                        <div>
                                            <h3 className="text-white font-bold uppercase text-xs tracking-wider">
                                                {isEditMode ? '// STEP 06: CONFIGURATION CHANGE AUDIT' : '// STEP 06: COMPREHENSIVE DOSSIER REVIEW'}
                                            </h3>
                                            <p className="text-zinc-500 text-[11px] mt-0.5">
                                                {isEditMode
                                                    ? 'Verify all modified parameters before committing sovereign updates to Firestore.'
                                                    : 'Verify all five governance pillars before writing sovereign records to Firestore.'
                                                }
                                            </p>
                                        </div>
                                        <span className={`px-2 py-0.5 border text-[10px] font-bold uppercase ${
                                            isEditMode
                                                ? 'border-cyan-500/60 bg-cyan-950/40 text-cyan-400'
                                                : 'border-emerald-500/60 bg-emerald-950/40 text-emerald-400'
                                        }`}>
                                            {isEditMode ? 'READY TO SAVE CHANGES' : 'READY FOR ESTABLISHMENT'}
                                        </span>
                                    </div>

                                    {/* Pillar 1: Foundation Summary */}
                                    <div className="bg-zinc-950 border border-zinc-800 p-3.5 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-emerald-400 font-bold">01.</span>
                                                <span className="text-white font-bold uppercase text-[11px] tracking-wider">FOUNDATION DOSSIER</span>
                                                {isEditMode && (
                                                    isFieldModified('foundation') ? (
                                                        <span className="text-[9px] px-1.5 py-0.2 bg-amber-950/60 border border-amber-600/70 text-amber-300 font-bold uppercase tracking-wider">[MODIFIED]</span>
                                                    ) : (
                                                        <span className="text-[9px] px-1.5 py-0.2 bg-zinc-900 border border-zinc-800 text-zinc-500 font-mono uppercase">[UNCHANGED]</span>
                                                    )
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setStep(1)}
                                                className="text-[10px] px-2 py-1 border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-white uppercase flex items-center gap-1"
                                            >
                                                <PencilSquareIcon className="w-3 h-3 text-emerald-400" />
                                                <span>[EDIT STEP 1]</span>
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] border-t border-zinc-850 pt-2 text-zinc-400">
                                            <div>
                                                <span className="text-zinc-600 block uppercase">COLLECTIVE NAME</span>
                                                <strong className="text-white text-xs">{name || 'Unnamed'}</strong>
                                            </div>
                                            <div>
                                                <span className="text-zinc-600 block uppercase">HANDLE</span>
                                                <strong className="text-emerald-400">@{sanitizeHandle(handle)}</strong>
                                            </div>
                                            <div>
                                                <span className="text-zinc-600 block uppercase">CATEGORY</span>
                                                <strong className="text-zinc-200">{category}</strong>
                                            </div>
                                            <div>
                                                <span className="text-zinc-600 block uppercase">VISIBILITY / JOIN</span>
                                                <strong className="text-zinc-200 uppercase">{visibility} / {joinPolicy}</strong>
                                            </div>
                                        </div>
                                        <div className="text-[11px] text-zinc-300 border-t border-zinc-850 pt-2 line-clamp-2">
                                            {description}
                                        </div>
                                    </div>

                                    {/* Pillar 2: Identity Summary */}
                                    <div className="bg-zinc-950 border border-zinc-800 p-3.5 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-amber-400 font-bold">02.</span>
                                                <span className="text-white font-bold uppercase text-[11px] tracking-wider">COLLECTIVE IDENTITY</span>
                                                {isEditMode && (
                                                    isFieldModified('identity') ? (
                                                        <span className="text-[9px] px-1.5 py-0.2 bg-amber-950/60 border border-amber-600/70 text-amber-300 font-bold uppercase tracking-wider">[MODIFIED]</span>
                                                    ) : (
                                                        <span className="text-[9px] px-1.5 py-0.2 bg-zinc-900 border border-zinc-800 text-zinc-500 font-mono uppercase">[UNCHANGED]</span>
                                                    )
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setStep(2)}
                                                className="text-[10px] px-2 py-1 border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-white uppercase flex items-center gap-1"
                                            >
                                                <PencilSquareIcon className="w-3 h-3 text-amber-400" />
                                                <span>[EDIT STEP 2]</span>
                                            </button>
                                        </div>
                                        <div className="space-y-2 border-t border-zinc-850 pt-2 text-[11px]">
                                            {purpose && (
                                                <div>
                                                    <span className="text-zinc-500 text-[10px] block uppercase">PURPOSE:</span>
                                                    <p className="text-zinc-300 line-clamp-2">{purpose}</p>
                                                </div>
                                            )}
                                            {mission && (
                                                <div>
                                                    <span className="text-zinc-500 text-[10px] block uppercase">MISSION:</span>
                                                    <p className="text-zinc-300 line-clamp-2">{mission}</p>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-4 text-[10px] text-zinc-400 pt-1">
                                                <span>Core Values: <strong className="text-amber-300">{values.length} configured</strong></span>
                                                <span>Origin Story: <strong className="text-zinc-200">{foundingStory ? 'Provided' : 'Drafted empty'}</strong></span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Pillar 3: Community Guidelines Summary */}
                                    <div className="bg-zinc-950 border border-zinc-800 p-3.5 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-emerald-400 font-bold">03.</span>
                                                <span className="text-white font-bold uppercase text-[11px] tracking-wider">COMMUNITY GUIDELINES & CONDUCT</span>
                                                {isEditMode && (
                                                    isFieldModified('guidelines') ? (
                                                        <span className="text-[9px] px-1.5 py-0.2 bg-amber-950/60 border border-amber-600/70 text-amber-300 font-bold uppercase tracking-wider">[MODIFIED]</span>
                                                    ) : (
                                                        <span className="text-[9px] px-1.5 py-0.2 bg-zinc-900 border border-zinc-800 text-zinc-500 font-mono uppercase">[UNCHANGED]</span>
                                                    )
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setStep(3)}
                                                className="text-[10px] px-2 py-1 border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-white uppercase flex items-center gap-1"
                                            >
                                                <PencilSquareIcon className="w-3 h-3 text-emerald-400" />
                                                <span>[EDIT STEP 3]</span>
                                            </button>
                                        </div>
                                        <div className="space-y-2 border-t border-zinc-850 pt-2 text-[11px]">
                                            <div className="flex items-center gap-4 text-[10px] text-zinc-400">
                                                <span>Rules: <strong className="text-emerald-300">{guidelines.length} defined</strong></span>
                                                <span>Framework: <strong className="text-amber-300">{moderationPolicy}</strong></span>
                                            </div>
                                            {guidelines.length > 0 ? (
                                                <div className="space-y-1.5 pt-1">
                                                    {guidelines.slice(0, 4).map((g, idx) => (
                                                        <div key={g.id || idx} className="text-[10px] bg-black/60 border border-zinc-850 px-2.5 py-1 flex items-center justify-between">
                                                            <div className="truncate mr-2">
                                                                <span className="text-emerald-400 font-bold mr-1.5">{idx + 1}.</span>
                                                                <span className="text-zinc-200 font-bold">{g.title}</span>
                                                                {g.description && <span className="text-zinc-500 ml-1.5 hidden sm:inline">— {g.description}</span>}
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {guidelines.length > 4 && (
                                                        <span className="text-[10px] text-zinc-500 block pt-0.5">
                                                             + {guidelines.length - 4} additional rules configured
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="text-[10px] text-zinc-500 italic">
                                                    No specific rules defined yet. Standard INVOX network conduct policies will apply by default.
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Pillar 4: Governance Summary */}
                                    <div className="bg-zinc-950 border border-zinc-800 p-3.5 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-cyan-400 font-bold">04.</span>
                                                <span className="text-white font-bold uppercase text-[11px] tracking-wider">GOVERNANCE & SOVEREIGNTY</span>
                                                {isEditMode && (
                                                    isFieldModified('governance') ? (
                                                        <span className="text-[9px] px-1.5 py-0.2 bg-amber-950/60 border border-amber-600/70 text-amber-300 font-bold uppercase tracking-wider">[MODIFIED]</span>
                                                    ) : (
                                                        <span className="text-[9px] px-1.5 py-0.2 bg-zinc-900 border border-zinc-800 text-zinc-500 font-mono uppercase">[UNCHANGED]</span>
                                                    )
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setStep(4)}
                                                className="text-[10px] px-2 py-1 border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-white uppercase flex items-center gap-1"
                                            >
                                                <PencilSquareIcon className="w-3 h-3 text-cyan-400" />
                                                <span>[EDIT STEP 4]</span>
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] border-t border-zinc-850 pt-2 text-zinc-400">
                                            <div>
                                                <span className="text-zinc-600 block uppercase">SOVEREIGN OWNER</span>
                                                <strong className="text-amber-400 truncate block">
                                                    {isEditMode && community?.ownerId ? community.ownerId : (currentUser?.displayName || 'Current User')}
                                                </strong>
                                            </div>
                                            <div>
                                                <span className="text-zinc-600 block uppercase">STRUCTURE</span>
                                                <strong className="text-zinc-200">{governanceModel}</strong>
                                            </div>
                                            <div>
                                                <span className="text-zinc-600 block uppercase">POSTING</span>
                                                <strong className="text-zinc-200 uppercase">{postPermission}</strong>
                                            </div>
                                            <div>
                                                <span className="text-zinc-600 block uppercase">GATHERINGS</span>
                                                <strong className="text-zinc-200 uppercase">{gatheringPermission}</strong>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Pillar 5: Appearance & Discovery Summary */}
                                    <div className="bg-zinc-950 border border-zinc-800 p-3.5 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-purple-400 font-bold">05.</span>
                                                <span className="text-white font-bold uppercase text-[11px] tracking-wider">APPEARANCE & DISCOVERY</span>
                                                {isEditMode && (
                                                    isFieldModified('appearance') ? (
                                                        <span className="text-[9px] px-1.5 py-0.2 bg-amber-950/60 border border-amber-600/70 text-amber-300 font-bold uppercase tracking-wider">[MODIFIED]</span>
                                                    ) : (
                                                        <span className="text-[9px] px-1.5 py-0.2 bg-zinc-900 border border-zinc-800 text-zinc-500 font-mono uppercase">[UNCHANGED]</span>
                                                    )
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setStep(5)}
                                                className="text-[10px] px-2 py-1 border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-white uppercase flex items-center gap-1"
                                            >
                                                <PencilSquareIcon className="w-3 h-3 text-purple-400" />
                                                <span>[EDIT STEP 5]</span>
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-3 border-t border-zinc-850 pt-2">
                                            <img
                                                src={avatarUrl || AVATAR_PRESETS[0].url}
                                                alt="Emblem"
                                                className="w-10 h-10 object-cover border border-zinc-700 bg-zinc-900"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[10px] text-zinc-500 uppercase">Tags ({topics.length}):</div>
                                                <div className="flex flex-wrap gap-1 mt-0.5">
                                                    {topics.map(t => (
                                                        <span key={t} className="text-[10px] text-zinc-300 bg-black px-1.5 py-0.5 border border-zinc-850">
                                                            #{t}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Modal Bottom Actions Bar */}
                            <div className="border-t border-zinc-800 pt-4 flex justify-between items-center bg-black/40">
                                {step === 1 ? (
                                    <>
                                        <button
                                            key="btn-step-1-cancel"
                                            type="button"
                                            onClick={resetAndClose}
                                            className="px-4 py-2 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 uppercase"
                                        >
                                            {isEditMode ? 'Close' : 'Cancel'}
                                        </button>
                                        <button
                                            key="btn-step-1-next"
                                            type="button"
                                            onClick={(e) => handleNext(e)}
                                            className="px-6 py-2 bg-white text-black font-bold uppercase hover:bg-zinc-200 transition-colors shadow-sm"
                                        >
                                            Next: Collective Identity →
                                        </button>
                                    </>
                                ) : step === 6 ? (
                                    <>
                                        <button
                                            key="btn-step-6-back"
                                            type="button"
                                            onClick={(e) => handleBack(e)}
                                            disabled={submitting}
                                            className="px-4 py-2 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 uppercase"
                                        >
                                            ← Back to Appearance
                                        </button>
                                        {isEditMode ? (
                                            <button
                                                key="btn-step-6-submit-edit"
                                                type="button"
                                                onClick={(e) => handleFinalEstablish(e)}
                                                disabled={submitting}
                                                className="px-6 py-2 bg-cyan-500 text-black font-bold uppercase hover:bg-cyan-400 transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-lg shadow-cyan-950/40"
                                            >
                                                {submitting ? (
                                                    <>
                                                        <span className="w-2.5 h-2.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                                        <span>SAVING CHANGES...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <CheckIcon className="w-4 h-4" />
                                                        <span>SAVE CHANGES</span>
                                                    </>
                                                )}
                                            </button>
                                        ) : (
                                            <button
                                                key="btn-step-6-submit-create"
                                                type="button"
                                                onClick={(e) => handleFinalEstablish(e)}
                                                disabled={submitting}
                                                className="px-6 py-2 bg-emerald-500 text-black font-bold uppercase hover:bg-emerald-400 transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-lg shadow-emerald-950/40"
                                            >
                                                {submitting ? (
                                                    <>
                                                        <span className="w-2.5 h-2.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                                        <span>ESTABLISHING COMMUNITY...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <CheckIcon className="w-4 h-4" />
                                                        <span>ESTABLISH COMMUNITY</span>
                                                    </>
                                                )}
                                            </button>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <button
                                            key={`btn-step-${step}-back`}
                                            type="button"
                                            onClick={(e) => handleBack(e)}
                                            disabled={submitting}
                                            className="px-4 py-2 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 uppercase"
                                        >
                                            ← Previous Step
                                        </button>
                                        <button
                                            key={`btn-step-${step}-next`}
                                            type="button"
                                            onClick={(e) => handleNext(e)}
                                            className="px-6 py-2 bg-white text-black font-bold uppercase hover:bg-zinc-200 transition-colors"
                                        >
                                            {step === 2 && 'Next: Community Guidelines →'}
                                            {step === 3 && 'Next: Governance & Sovereignty →'}
                                            {step === 4 && 'Next: Appearance & Discovery →'}
                                            {step === 5 && 'PROCEED TO FINAL REVIEW →'}
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
