import React, { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { updateUserEmail, updateUserPassword, updateUserAuthProfile } from '../services/authService';
import { COLLECTIONS, updateDocument } from '../services/firestoreService';
import { getFriendlyErrorMessage } from '../utils/errorHandler';
import { uploadFile } from '../services/storageService';
import { handleImageError } from '../components/utils/imageUtils';
import { ProfileIcon } from '../components/ui/Icons';

/* ─── Profile Completion Calculator ──────────────────────────────────────── */

/**
 * Centralised computation of profile completion percentage.
 * Called both in-memory (UI) and written to Firestore on every save.
 */
export const computeProfileCompletion = (p: {
    displayName?: string | null;
    headline?: string;
    bio?: string;
    skills?: string[];
    interests?: string[];
    location?: string;
    website?: string;
    photoURL?: string | null;
    coverPhotoURL?: string | null;
}): number => {
    const checks = [
        !!(p.displayName),
        !!(p.headline),
        !!(p.bio),
        !!(p.skills?.length),
        !!(p.interests?.length),
        !!(p.location),
        !!(p.website),
        !!(p.photoURL),
        !!(p.coverPhotoURL),
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
};

/* ─── Chip Input Component ────────────────────────────────────────────────── */

interface ChipInputProps {
    label: string;
    chips: string[];
    onChange: (chips: string[]) => void;
    placeholder?: string;
    color?: 'default' | 'blue';
}

const ChipInput: React.FC<ChipInputProps> = ({
    label, chips, onChange, placeholder = 'Type and press Enter', color = 'default',
}) => {
    const [inputValue, setInputValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const addChip = (value: string) => {
        const trimmed = value.trim();
        if (trimmed && !chips.includes(trimmed)) {
            onChange([...chips, trimmed]);
        }
        setInputValue('');
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addChip(inputValue);
        } else if (e.key === 'Backspace' && !inputValue && chips.length > 0) {
            onChange(chips.slice(0, -1));
        }
    };

    const removeChip = (idx: number) => onChange(chips.filter((_, i) => i !== idx));

    return (
        <div>
            <label className="block text-zinc-400 mb-1.5 text-xs font-mono uppercase tracking-wider">// {label}</label>
            <div
                className="min-h-[42px] w-full bg-[#0c0c0e] border border-zinc-800 p-2 cursor-text flex flex-wrap gap-1.5 focus-within:border-zinc-500 font-mono text-xs"
                onClick={() => inputRef.current?.focus()}
            >
                {chips.map((chip, idx) => (
                    <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-0.5 border border-zinc-700 bg-zinc-900 text-zinc-200 text-[10px] uppercase"
                    >
                        {chip}
                        <button
                            type="button"
                            onClick={e => { e.stopPropagation(); removeChip(idx); }}
                            className="text-zinc-500 hover:text-white ml-0.5 leading-none"
                        >
                            ×
                        </button>
                    </span>
                ))}
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={() => { if (inputValue) addChip(inputValue); }}
                    placeholder={chips.length === 0 ? placeholder : ''}
                    className="flex-1 min-w-[120px] bg-transparent outline-none text-white text-xs placeholder-zinc-600 font-mono"
                />
            </div>
            <p className="mt-1 text-[10px] text-zinc-600 font-mono uppercase">Press Enter or comma to add</p>
        </div>
    );
};

/* ─── Shared small components ────────────────────────────────────────────── */

const SectionHeader = ({ title, description }: { title: string; description?: string }) => (
    <div className="mb-5 pb-3 border-b border-zinc-800 font-mono">
        <span className="text-[10px] text-zinc-500 uppercase tracking-widest block">// SECTION_CONFIG</span>
        <h2 className="text-sm font-bold text-white uppercase tracking-wider mt-0.5">{title}</h2>
        {description && <p className="text-xs text-zinc-400 mt-1">{description}</p>}
    </div>
);

const FormField = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="font-mono">
        <label className="block text-zinc-400 mb-1.5 text-xs uppercase tracking-wider">// {label}</label>
        {children}
    </div>
);

const inputClass = 'w-full bg-[#0c0c0e] border border-zinc-800 p-2.5 text-xs text-white placeholder-zinc-600 font-mono focus:outline-none focus:border-zinc-500 transition-colors';
const textareaClass = `${inputClass} resize-none`;

const StatusMessage = ({ msg }: { msg: { type: string; text: string } }) =>
    msg.text ? (
        <div className={`mb-4 p-3 font-mono text-xs border ${
            msg.type === 'success'
                ? 'bg-zinc-900 border-zinc-700 text-white'
                : 'bg-red-950/40 border-red-900/60 text-red-300'
        }`}>
            {msg.type === 'success' ? '// SUCCESS: ' : '// ERROR: '} {msg.text}
        </div>
    ) : null;

const SaveButton = ({ loading, label = 'Save Changes' }: { loading: boolean; label?: string }) => (
    <button
        type="submit"
        disabled={loading}
        className="bg-white text-black px-5 py-2 font-mono text-xs font-bold uppercase hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed transition-colors"
    >
        {loading ? 'PROCESSING…' : label}
    </button>
);

/* ─── Tab config ─────────────────────────────────────────────────────────── */

const TABS = [
    { id: 'personal',      label: 'Personal Info',  code: '01' },
    { id: 'professional',  label: 'Professional',   code: '02' },
    { id: 'media',         label: 'Profile Media',  code: '03' },
    { id: 'account',       label: 'Account',        code: '04' },
    { id: 'privacy',       label: 'Privacy',        code: '05' },
];

/* ─── Main Component ─────────────────────────────────────────────────────── */

const SettingsPage = () => {
    const { currentUser, userProfile } = useAuth();
    const [activeTab, setActiveTab] = useState('personal');

    /* ── Personal fields ── */
    const [displayName, setDisplayName]   = useState('');
    const [username,    setUsername]       = useState('');
    const [headline,    setHeadline]       = useState('');
    const [bio,         setBio]            = useState('');
    const [personalLoading, setPersonalLoading] = useState(false);
    const [personalMessage, setPersonalMessage] = useState({ type: '', text: '' });

    /* ── Professional fields ── */
    const [skills,       setSkills]       = useState<string[]>([]);
    const [interests,    setInterests]    = useState<string[]>([]);
    const [website,      setWebsite]      = useState('');
    const [portfolioURL, setPortfolioURL] = useState('');
    const [location,     setLocation]     = useState('');
    const [professionalLoading, setProfessionalLoading] = useState(false);
    const [professionalMessage, setProfessionalMessage] = useState({ type: '', text: '' });

    /* ── Media fields ── */
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [uploadingCover,  setUploadingCover]  = useState(false);
    const [avatarProgress,  setAvatarProgress]  = useState(0);
    const [coverProgress,   setCoverProgress]   = useState(0);
    // Local preview URLs for immediate display after upload
    const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(null);
    const [localCoverUrl,  setLocalCoverUrl]  = useState<string | null>(null);
    const [mediaMessage, setMediaMessage] = useState({ type: '', text: '' });

    /* ── Account fields ── */
    const [newEmail,       setNewEmail]       = useState('');
    const [newPassword,    setNewPassword]    = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [accountLoading, setAccountLoading] = useState(false);
    const [accountMessage, setAccountMessage] = useState({ type: '', text: '' });

    /* ── BUG FIX: Sync form state from userProfile whenever it arrives/changes ──
     *
     *  Problem: useState(userProfile?.x) runs once at mount. If userProfile is still
     *  null (AuthContext still loading), all inputs initialise as ''. The real data
     *  from Firestore arrives later via subscribeUserProfile but useState ignores it.
     *
     *  Fix: useEffect re-syncs every field when userProfile becomes available.
     *  We only overwrite if the user has NOT started editing (tracked per-form with
     *  the "touched" refs), so typing is never interrupted by a context refresh.
     */
    const personalTouched = useRef(false);
    const professionalTouched = useRef(false);

    useEffect(() => {
        if (!userProfile) return;

        // Only pre-fill personal fields if the user has not started editing them
        if (!personalTouched.current) {
            setDisplayName(userProfile.displayName || '');
            setUsername(userProfile.username || '');
            setHeadline(userProfile.headline || '');
            setBio(userProfile.bio || '');
        }

        // Only pre-fill professional fields if the user has not started editing them
        if (!professionalTouched.current) {
            setSkills(userProfile.skills || []);
            setInterests(userProfile.interests || []);
            setWebsite((userProfile as any).website || '');
            setPortfolioURL((userProfile as any).portfolioURL || '');
            setLocation((userProfile as any).location || '');
        }
    }, [userProfile]);

    /* ── Derived display values ── */
    const userAvatar  = localAvatarUrl || userProfile?.photoURL    || currentUser?.photoURL || null;
    const coverImage  = localCoverUrl  || userProfile?.coverPhotoURL || null;

    /* ── Helpers ── */

    /** Write profileCompletion to Firestore using the current merged state */
    const persistCompletion = async (overrides: Record<string, any> = {}) => {
        if (!currentUser) return;
        const merged = {
            displayName:   overrides.displayName   ?? displayName,
            headline:      overrides.headline      ?? headline,
            bio:           overrides.bio           ?? bio,
            skills:        overrides.skills        ?? skills,
            interests:     overrides.interests     ?? interests,
            location:      overrides.location      ?? location,
            website:       overrides.website       ?? website,
            photoURL:      overrides.photoURL      ?? userAvatar,
            coverPhotoURL: overrides.coverPhotoURL ?? coverImage,
        };
        const pct = computeProfileCompletion(merged);
        await updateDocument(COLLECTIONS.users, currentUser.uid, { profileCompletion: pct });
    };

    /* ── Handlers ── */

    const handlePersonalSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;
        setPersonalLoading(true);
        setPersonalMessage({ type: '', text: '' });
        try {
            const payload = { displayName, username, headline, bio };
            console.log(`[FIRESTORE_WRITE] Personal info — users/${currentUser.uid}:`, payload);
            await updateDocument(COLLECTIONS.users, currentUser.uid, payload);
            console.log(`[PROFILE_SAVE_SUCCESS] Personal info saved for users/${currentUser.uid}`);
            await persistCompletion({ displayName, headline, bio });
            setPersonalMessage({ type: 'success', text: 'Personal information updated successfully.' });
            personalTouched.current = false; // allow future context refreshes to sync
        } catch (err: any) {
            console.error(`[PROFILE_SAVE_ERROR] Personal info failed for users/${currentUser.uid}:`, err);
            setPersonalMessage({ type: 'error', text: getFriendlyErrorMessage(err) });
        }
        setPersonalLoading(false);
    };

    const handleProfessionalSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;
        setProfessionalLoading(true);
        setProfessionalMessage({ type: '', text: '' });
        try {
            const payload = { skills, interests, website, portfolioURL, location };
            console.log(`[FIRESTORE_WRITE] Professional info — users/${currentUser.uid}:`, payload);
            await updateDocument(COLLECTIONS.users, currentUser.uid, payload);
            console.log(`[PROFILE_SAVE_SUCCESS] Professional info saved for users/${currentUser.uid}`);
            await persistCompletion({ skills, interests, location, website });
            setProfessionalMessage({ type: 'success', text: 'Professional information updated successfully.' });
            professionalTouched.current = false;
        } catch (err: any) {
            console.error(`[PROFILE_SAVE_ERROR] Professional info failed for users/${currentUser.uid}:`, err);
            setProfessionalMessage({ type: 'error', text: getFriendlyErrorMessage(err) });
        }
        setProfessionalLoading(false);
    };

    const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'profile' | 'cover') => {
        if (!e.target.files || !e.target.files[0] || !currentUser) return;
        const file = e.target.files[0];
        setMediaMessage({ type: '', text: '' });

        if (type === 'profile') setUploadingAvatar(true);
        else setUploadingCover(true);

        // Show instant local preview while uploading
        const objectUrl = URL.createObjectURL(file);
        if (type === 'profile') setLocalAvatarUrl(objectUrl);
        else setLocalCoverUrl(objectUrl);

        const logTag = type === 'profile' ? '[AVATAR_UPLOAD]' : '[COVER_UPLOAD]';

        try {
            // Storage path: /profileMedia/{userId}/{fileName}
            // Auth gate: userId path segment == request.auth.uid (enforced by storage.rules)
            const path = `profileMedia/${currentUser.uid}/${type}_${Date.now()}_${file.name}`;
            console.log(`${logTag} Starting upload. Path: ${path}`);

            const uploaded = await uploadFile(path, file, {
                allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
                maxSizeBytes: 5 * 1024 * 1024,
                onProgress: p => type === 'profile' ? setAvatarProgress(p) : setCoverProgress(p),
            });

            console.log(`${logTag} Upload success. Download URL: ${uploaded.url}`);

            // Update Firebase Auth photoURL for avatar uploads
            if (type === 'profile') {
                await updateUserAuthProfile(currentUser, { photoURL: uploaded.url });
                setLocalAvatarUrl(uploaded.url); // replace blob URL with permanent URL
            } else {
                setLocalCoverUrl(uploaded.url);
            }

            // Persist to Firestore — triggers subscribeUserProfile → AuthContext update
            const firestoreField = type === 'profile' ? 'photoURL' : 'coverPhotoURL';
            console.log(`${logTag} [FIRESTORE_WRITE] users/${currentUser.uid} → { ${firestoreField}: "${uploaded.url}" }`);
            await updateDocument(COLLECTIONS.users, currentUser.uid, {
                [firestoreField]: uploaded.url,
            });
            console.log(`${logTag} [PROFILE_SAVE_SUCCESS] Firestore updated: ${firestoreField}`);

            // Recompute and persist profile completion score
            await persistCompletion({ [firestoreField]: uploaded.url });

            setMediaMessage({
                type: 'success',
                text: `${type === 'profile' ? 'Profile photo' : 'Cover photo'} updated successfully.`,
            });
        } catch (err: any) {
            // Revert optimistic local preview on any failure
            console.error(`${logTag} [PROFILE_SAVE_ERROR] Upload/save failed:`, err);
            if (type === 'profile') setLocalAvatarUrl(null);
            else setLocalCoverUrl(null);
            setMediaMessage({ type: 'error', text: getFriendlyErrorMessage(err) });
        }

        if (type === 'profile') { setUploadingAvatar(false); setAvatarProgress(0); }
        else { setUploadingCover(false); setCoverProgress(0); }
    };

    const handleRemoveCover = async () => {
        if (!currentUser) return;
        setLocalCoverUrl(null);
        try {
            console.log(`[COVER_UPLOAD] [FIRESTORE_WRITE] Removing cover — users/${currentUser.uid}`);
            await updateDocument(COLLECTIONS.users, currentUser.uid, { coverPhotoURL: null });
            await persistCompletion({ coverPhotoURL: null });
            setMediaMessage({ type: 'success', text: 'Cover photo removed.' });
            console.log('[COVER_UPLOAD] [PROFILE_SAVE_SUCCESS] Cover removed.');
        } catch (err: any) {
            console.error('[COVER_UPLOAD] [PROFILE_SAVE_ERROR] Remove cover failed:', err);
            setMediaMessage({ type: 'error', text: getFriendlyErrorMessage(err) });
        }
    };

    const handleAccountSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;
        if (newPassword && newPassword !== confirmPassword) {
            setAccountMessage({ type: 'error', text: 'Passwords do not match.' });
            return;
        }
        setAccountLoading(true);
        setAccountMessage({ type: '', text: '' });
        try {
            if (newEmail) await updateUserEmail(currentUser, newEmail);
            if (newPassword) {
                const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
                if (!passwordRegex.test(newPassword)) {
                    throw new Error('Password must be at least 8 characters and include a number and special character.');
                }
                await updateUserPassword(currentUser, newPassword);
            }
            setAccountMessage({ type: 'success', text: 'Account updated successfully.' });
            setNewEmail(''); setNewPassword(''); setConfirmPassword('');
        } catch (err: any) {
            const msg = err.code === 'auth/requires-recent-login'
                ? 'This action requires recent login. Please log out and log back in, then try again.'
                : getFriendlyErrorMessage(err);
            setAccountMessage({ type: 'error', text: msg });
        }
        setAccountLoading(false);
    };

    /* ── Render ─────────────────────────────────────────────────────────── */

    return (
        <div className="w-full">
            {/* Sub-Header */}
            <div className="border-b border-zinc-800 bg-zinc-950 px-4 py-3">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block leading-none">// PREFERENCES_AND_CONFIG</span>
                <h1 className="text-xs font-bold font-mono text-white tracking-wider uppercase mt-0.5">Settings</h1>
            </div>

            <div className="flex flex-col md:flex-row border-b border-zinc-800">

                {/* ── Sidebar Tabs ── */}
                <div className="md:w-56 flex-shrink-0 border-b md:border-b-0 md:border-r border-zinc-800 bg-[#0c0c0e]">
                    <nav className="flex flex-row md:flex-col overflow-x-auto">
                        {TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`text-left py-3 px-4 font-mono text-xs uppercase tracking-wider transition-colors flex items-center gap-2 whitespace-nowrap ${
                                    activeTab === tab.id
                                        ? 'bg-zinc-900/80 text-white font-bold border-l-2 md:border-l-2 md:border-b-0 border-b-2 border-white'
                                        : 'text-zinc-500 hover:bg-zinc-900/40 hover:text-zinc-300'
                                }`}
                            >
                                <span className="text-zinc-600 font-normal">[{tab.code}]</span>
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </nav>
                </div>

                {/* ── Content Panel ── */}
                <div className="flex-1 bg-[#0c0c0e] p-5 md:p-6 min-w-0">

                    {/* ── Personal Info ── */}
                    {activeTab === 'personal' && (
                        <div>
                            <SectionHeader
                                title="Personal Information"
                                description="Update your identity parameters across the platform."
                            />
                            <StatusMessage msg={personalMessage} />
                            <form
                                onSubmit={handlePersonalSubmit}
                                className="space-y-4"
                                onChange={() => { personalTouched.current = true; }}
                            >
                                <FormField label="Display Name">
                                    <input
                                        type="text"
                                        value={displayName}
                                        onChange={e => setDisplayName(e.target.value)}
                                        placeholder="Full Name"
                                        className={inputClass}
                                    />
                                </FormField>

                                <FormField label="Username Handle">
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-mono">@</span>
                                        <input
                                            type="text"
                                            value={username}
                                            onChange={e => setUsername(e.target.value)}
                                            placeholder="handle"
                                            className={`${inputClass} pl-7`}
                                        />
                                    </div>
                                </FormField>

                                <FormField label="Professional Headline">
                                    <input
                                        type="text"
                                        value={headline}
                                        onChange={e => setHeadline(e.target.value)}
                                        placeholder="e.g. Full-Stack Developer // Systems Architect"
                                        className={inputClass}
                                    />
                                </FormField>

                                <FormField label="Bio / Dossier">
                                    <textarea
                                        value={bio}
                                        onChange={e => setBio(e.target.value)}
                                        rows={4}
                                        placeholder="Enter background, technical expertise, and active focus areas…"
                                        className={textareaClass}
                                        maxLength={500}
                                    />
                                    <p className="mt-1 text-[10px] text-zinc-600 font-mono uppercase">{bio.length} / 500 characters</p>
                                </FormField>

                                <div className="pt-2">
                                    <SaveButton loading={personalLoading} />
                                </div>
                            </form>
                        </div>
                    )}

                    {/* ── Professional ── */}
                    {activeTab === 'professional' && (
                        <div>
                            <SectionHeader
                                title="Professional Parameters"
                                description="Configure skills, industry focus, and portfolio links."
                            />
                            <StatusMessage msg={professionalMessage} />
                            <form
                                onSubmit={handleProfessionalSubmit}
                                className="space-y-4"
                                onChange={() => { professionalTouched.current = true; }}
                            >
                                <ChipInput
                                    label="Skills & Competencies"
                                    chips={skills}
                                    onChange={chips => { professionalTouched.current = true; setSkills(chips); }}
                                    placeholder="e.g. React, TypeScript, Rust…"
                                />
                                <ChipInput
                                    label="Interests & Domains"
                                    chips={interests}
                                    onChange={chips => { professionalTouched.current = true; setInterests(chips); }}
                                    placeholder="e.g. Distributed Systems, AI, Cryptography…"
                                />

                                <FormField label="Location">
                                    <input
                                        type="text"
                                        value={location}
                                        onChange={e => setLocation(e.target.value)}
                                        placeholder="e.g. San Francisco, CA // Remote"
                                        className={inputClass}
                                    />
                                </FormField>

                                <FormField label="Website">
                                    <input
                                        type="text"
                                        value={website}
                                        onChange={e => setWebsite(e.target.value)}
                                        placeholder="https://domain.com"
                                        className={inputClass}
                                    />
                                </FormField>

                                <FormField label="Portfolio URL">
                                    <input
                                        type="text"
                                        value={portfolioURL}
                                        onChange={e => setPortfolioURL(e.target.value)}
                                        placeholder="https://portfolio.dev"
                                        className={inputClass}
                                    />
                                </FormField>

                                <div className="pt-2">
                                    <SaveButton loading={professionalLoading} />
                                </div>
                            </form>
                        </div>
                    )}

                    {/* ── Media ── */}
                    {activeTab === 'media' && (
                        <div>
                            <SectionHeader
                                title="Profile Media"
                                description="Manage avatar and banner assets. Changes sync immediately."
                            />
                            <StatusMessage msg={mediaMessage} />
                            <div className="space-y-6 font-mono">

                                {/* Profile Photo */}
                                <div>
                                    <label className="block text-zinc-400 mb-2 text-xs uppercase tracking-wider">// AVATAR_ASSET</label>
                                    <div className="flex items-center gap-4">
                                        <div className="w-20 h-20 border border-zinc-700 bg-zinc-950 overflow-hidden flex items-center justify-center flex-shrink-0 relative">
                                            {userAvatar ? (
                                                <img src={userAvatar} onError={handleImageError} alt="Avatar" className="w-full h-full object-cover" />
                                            ) : (
                                                <ProfileIcon className="w-10 h-10 text-zinc-600" />
                                            )}
                                            {uploadingAvatar && (
                                                <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                                                    <span className="text-white text-xs font-bold">{avatarProgress}%</span>
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <label className="cursor-pointer inline-flex items-center gap-2 bg-white text-black text-xs font-mono font-bold uppercase px-4 py-2 hover:bg-zinc-200 transition-colors">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                                </svg>
                                                {uploadingAvatar ? `Uploading ${avatarProgress}%` : 'Upload Avatar'}
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    accept="image/jpeg,image/png,image/gif,image/webp"
                                                    onChange={e => handleMediaUpload(e, 'profile')}
                                                    disabled={uploadingAvatar}
                                                />
                                            </label>
                                            <p className="text-[10px] text-zinc-600 mt-1 uppercase">JPG, PNG, WebP · Max 5MB</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t border-zinc-850" />

                                {/* Cover Photo */}
                                <div>
                                    <label className="block text-zinc-400 mb-2 text-xs uppercase tracking-wider">// BANNER_ASSET</label>

                                    {/* Preview */}
                                    <div
                                        className="w-full h-32 border border-zinc-800 bg-zinc-950 bg-cover bg-center mb-3 overflow-hidden relative"
                                        style={coverImage ? { backgroundImage: `url(${coverImage})` } : {}}
                                    >
                                        {!coverImage && (
                                            <div className="h-full flex flex-col items-center justify-center text-zinc-600 text-xs gap-1">
                                                <span className="text-[10px] uppercase">// NO BANNER CONFIGURED</span>
                                            </div>
                                        )}
                                        {uploadingCover && (
                                            <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                                                <div className="text-center">
                                                    <div className="w-32 h-1 bg-zinc-800 overflow-hidden mb-2">
                                                        <div
                                                            className="h-full bg-white transition-all"
                                                            style={{ width: `${coverProgress}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-white text-xs font-bold">{coverProgress}%</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 flex-wrap">
                                        <label className="cursor-pointer inline-flex items-center gap-2 border border-zinc-700 bg-zinc-900 text-zinc-200 text-xs font-mono uppercase px-4 py-2 hover:bg-zinc-800 transition-colors">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                            </svg>
                                            {uploadingCover ? `Uploading ${coverProgress}%` : 'Upload Banner'}
                                            <input
                                                type="file"
                                                className="hidden"
                                                accept="image/jpeg,image/png,image/gif,image/webp"
                                                onChange={e => handleMediaUpload(e, 'cover')}
                                                disabled={uploadingCover}
                                            />
                                        </label>
                                        {coverImage && (
                                            <button
                                                type="button"
                                                onClick={handleRemoveCover}
                                                className="inline-flex items-center gap-1 border border-red-900/60 bg-red-950/20 text-red-400 hover:text-red-300 text-xs font-mono uppercase px-3 py-2 transition-colors"
                                            >
                                                Remove Banner
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-zinc-600 mt-1 uppercase">Recommended: 1200 × 400px · Max 5MB</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Account ── */}
                    {activeTab === 'account' && (
                        <div>
                            <SectionHeader
                                title="Account Credentials"
                                description="Manage credentials and authentication parameters."
                            />
                            <div className="mb-4 p-3 border border-zinc-800 bg-zinc-950 font-mono text-xs">
                                <span className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-0.5">// ACTIVE_AUTHENTICATION_EMAIL</span>
                                <p className="text-white font-bold">{currentUser?.email}</p>
                            </div>
                            <StatusMessage msg={accountMessage} />
                            <form onSubmit={handleAccountSubmit} className="space-y-4">
                                <FormField label="New Email Address">
                                    <input
                                        type="email"
                                        value={newEmail}
                                        onChange={e => setNewEmail(e.target.value)}
                                        placeholder="Leave blank to retain current email"
                                        className={inputClass}
                                    />
                                </FormField>
                                <FormField label="New Password">
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                        placeholder="Min 8 chars, 1 number & 1 symbol"
                                        className={inputClass}
                                    />
                                </FormField>
                                <FormField label="Confirm Password">
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        placeholder="Repeat new password"
                                        className={inputClass}
                                    />
                                </FormField>
                                <div className="pt-2">
                                    <SaveButton loading={accountLoading} label="Update Credentials" />
                                </div>
                            </form>
                        </div>
                    )}

                    {/* ── Privacy ── */}
                    {activeTab === 'privacy' && (
                        <div>
                            <SectionHeader
                                title="Privacy & Telemetry"
                                description="Manage visibility preferences and direct access permissions."
                            />
                            <div className="space-y-2 font-mono">
                                {[
                                    { title: 'Profile Visibility',  desc: 'Control public discovery vs restricted access.' },
                                    { title: 'Activity Telemetry',  desc: 'Broadcast online state and active streams.' },
                                    { title: 'Direct Transmission', desc: 'Manage inbound peer-to-peer messages.' },
                                    { title: 'Data Processing',     desc: 'Telemetry parameters for feed optimization.' },
                                ].map(item => (
                                    <div key={item.title} className="flex items-center justify-between p-3 border border-zinc-800 bg-zinc-950">
                                        <div>
                                            <p className="text-xs font-bold text-white uppercase">{item.title}</p>
                                            <p className="text-[10px] text-zinc-500 mt-0.5">{item.desc}</p>
                                        </div>
                                        <span className="text-[10px] text-zinc-500 border border-zinc-800 bg-zinc-900 px-2 py-0.5 uppercase">
                                            LOCKED_DEFAULT
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
