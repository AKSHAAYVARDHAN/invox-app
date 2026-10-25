import React, { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { updateUserEmail, updateUserPassword, updateUserAuthProfile } from '../services/authService';
import { COLLECTIONS, updateDocument } from '../services/firestoreService';
import { getFriendlyErrorMessage } from '../utils/errorHandler';
import { uploadFile } from '../services/storageService';
import { handleImageError } from '../components/utils/imageUtils';
import { 
    ProfileIcon, 
    ArrowLeftIcon, 
    CheckIcon, 
    SparklesIcon, 
    ShieldCheckIcon,
    MapPinIcon,
    GlobeAltIcon,
    LockClosedIcon,
    KeyIcon,
    BellIcon,
    CheckBadgeIcon
} from '../components/ui/Icons';
import {
    normalizeUsername,
    validateUsernameFormat,
    isUsernameReserved,
    checkUsernameAvailability,
    suggestAlternativeUsernames,
    claimUsername,
    type UsernameValidationStatus,
} from '../services/usernameService';
import LocationSelector, { type LocationData } from '../components/settings/LocationSelector';

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
}

const ChipInput: React.FC<ChipInputProps> = ({
    label,
    chips,
    onChange,
    placeholder = 'Type competency and press Enter',
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
        <div className="font-mono">
            <div className="flex items-center justify-between mb-1.5">
                <label className="block text-zinc-300 text-xs tracking-wider">{label}</label>
                <span className="text-[10px] text-zinc-500 font-mono">{chips.length} {chips.length === 1 ? 'tag' : 'tags'}</span>
            </div>
            <div
                className="min-h-[46px] w-full bg-[#09090b] border border-zinc-800 p-2 cursor-text flex flex-wrap gap-1.5 focus-within:border-zinc-500 transition-colors font-mono text-xs"
                onClick={() => inputRef.current?.focus()}
            >
                {chips.map((chip, idx) => (
                    <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-zinc-700 bg-zinc-900 text-zinc-200 text-xs uppercase transition-colors hover:border-zinc-500"
                    >
                        <span>{chip}</span>
                        <button
                            type="button"
                            onClick={e => {
                                e.stopPropagation();
                                removeChip(idx);
                            }}
                            className="text-zinc-500 hover:text-white transition-colors ml-0.5 leading-none"
                            title="Remove tag"
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
                    onBlur={() => {
                        if (inputValue) addChip(inputValue);
                    }}
                    placeholder={chips.length === 0 ? placeholder : 'Add another tag…'}
                    className="flex-1 min-w-[140px] bg-transparent outline-none text-white text-xs placeholder-zinc-600 font-mono py-1"
                />
            </div>
            <p className="mt-1.5 text-[10px] text-zinc-500 font-mono">
                Press Enter or comma to add a tag · Click × to remove
            </p>
        </div>
    );
};

/* ─── Shared UI Helpers ──────────────────────────────────────────────────── */

const SectionHeader = ({ 
    title, 
    description,
}: { 
    code?: string;
    title: string; 
    description?: string;
    badge?: string;
}) => (
    <div className="mb-6 pb-4 border-b border-zinc-800/80 font-mono">
        <h2 className="text-base font-bold text-white tracking-wider">{title}</h2>
        {description && <p className="text-xs text-zinc-400 mt-1 max-w-2xl leading-relaxed font-sans">{description}</p>}
    </div>
);

const FormField = ({ 
    label, 
    hint, 
    children 
}: { 
    label: string; 
    hint?: string; 
    children: React.ReactNode 
}) => (
    <div className="font-mono">
        <div className="flex items-center justify-between mb-1.5">
            <label className="block text-zinc-300 text-xs tracking-wider">{label}</label>
            {hint && <span className="text-[10px] text-zinc-500 font-mono">{hint}</span>}
        </div>
        {children}
    </div>
);

const inputClass = 'w-full bg-[#09090b] border border-zinc-800 p-2.5 text-xs text-white placeholder-zinc-600 font-mono focus:outline-none focus:border-zinc-500 transition-colors';
const textareaClass = `${inputClass} resize-none leading-relaxed`;

const StatusMessage = ({ msg }: { msg: { type: string; text: string } }) =>
    msg.text ? (
        <div
            className={`mb-6 p-3.5 font-mono text-xs border flex items-center justify-between gap-3 animate-fadeInUp ${
                msg.type === 'success'
                    ? 'bg-emerald-950/20 border-emerald-800/60 text-emerald-300'
                    : 'bg-red-950/40 border-red-900/60 text-red-300'
            }`}
        >
            <div className="flex items-center gap-2">
                <span className="font-bold">{msg.type === 'success' ? 'Success:' : 'Error:'}</span>
                <span>{msg.text}</span>
            </div>
        </div>
    ) : null;

const SaveButton = ({ 
    loading, 
    label = 'Save Changes' 
}: { 
    loading: boolean; 
    label?: string 
}) => (
    <button
        type="submit"
        disabled={loading}
        className="bg-white text-black px-6 py-2.5 font-mono text-xs font-bold uppercase tracking-wider hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed transition-all shadow-sm flex items-center gap-2 cursor-pointer"
    >
        {loading ? (
            <>
                <span className="w-3 h-3 border-2 border-black border-t-transparent animate-spin inline-block"></span>
                <span>Processing…</span>
            </>
        ) : (
            <>
                <CheckIcon className="w-3.5 h-3.5" />
                <span>{label}</span>
            </>
        )}
    </button>
);

/* ─── Tabs Configuration ─────────────────────────────────────────────────── */

const TABS = [
    { id: 'personal',     code: '01', label: 'Personal Info',  desc: 'Name, handle, and biography' },
    { id: 'professional', code: '02', label: 'Professional',   desc: 'Skills, location, and portfolio' },
    { id: 'media',        code: '03', label: 'Profile Media',  desc: 'Avatar and cover banner' },
    { id: 'account',      code: '04', label: 'Account',        desc: 'Security credentials and email' },
    { id: 'privacy',      code: '05', label: 'Privacy',        desc: 'Visibility and message preferences' },
];

/* ─── Main Component ─────────────────────────────────────────────────────── */

const SettingsPage = () => {
    const navigate = useNavigate();
    const { currentUser, userProfile } = useAuth();
    const [activeTab, setActiveTab] = useState('personal');

    // Notify RightSidebar to switch to settings variant
    const outletContext = useOutletContext<{
        setRightSidebarVariant?: (variant: string) => void;
    } | null>() ?? {};
    const { setRightSidebarVariant } = outletContext;

    useEffect(() => {
        setRightSidebarVariant?.('settings');
        return () => {
            setRightSidebarVariant?.('default');
        };
    }, [setRightSidebarVariant]);

    /* ── Personal Info fields ── */
    const [displayName, setDisplayName] = useState('');
    const [username, setUsername] = useState('');
    const [headline, setHeadline] = useState('');
    const [bio, setBio] = useState('');
    const [personalLoading, setPersonalLoading] = useState(false);
    const [personalMessage, setPersonalMessage] = useState({ type: '', text: '' });

    /* ── Username verification states ── */
    const [usernameStatus, setUsernameStatus] = useState<UsernameValidationStatus>('idle');
    const [usernameStatusMessage, setUsernameStatusMessage] = useState('');
    const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const usernameCheckTimerRef = useRef<NodeJS.Timeout | null>(null);

    /* ── Professional fields ── */
    const [skills, setSkills] = useState<string[]>([]);
    const [interests, setInterests] = useState<string[]>([]);
    const [website, setWebsite] = useState('');
    const [portfolioURL, setPortfolioURL] = useState('');
    const [location, setLocation] = useState('');
    const [countryName, setCountryName] = useState('');
    const [countryIsoCode, setCountryIsoCode] = useState('');
    const [cityName, setCityName] = useState('');
    const [professionalLoading, setProfessionalLoading] = useState(false);
    const [professionalMessage, setProfessionalMessage] = useState({ type: '', text: '' });

    /* ── Media fields ── */
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [uploadingCover, setUploadingCover] = useState(false);
    const [avatarProgress, setAvatarProgress] = useState(0);
    const [coverProgress, setCoverProgress] = useState(0);
    const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(null);
    const [localCoverUrl, setLocalCoverUrl] = useState<string | null>(null);
    const [mediaMessage, setMediaMessage] = useState({ type: '', text: '' });

    /* ── Account fields ── */
    const [newEmail, setNewEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [accountLoading, setAccountLoading] = useState(false);
    const [accountMessage, setAccountMessage] = useState({ type: '', text: '' });

    /* ── Privacy & Telemetry fields ── */
    const [profileVisibility, setProfileVisibility] = useState<'public' | 'connections_only' | 'private'>('public');
    const [showOnlineStatus, setShowOnlineStatus] = useState(true);
    const [directMessages, setDirectMessages] = useState<'everyone' | 'connections' | 'disabled'>('everyone');
    const [allowIndexing, setAllowIndexing] = useState(true);
    const [privacyLoading, setPrivacyLoading] = useState(false);
    const [privacyMessage, setPrivacyMessage] = useState({ type: '', text: '' });

    /* ── Synchronisation refs ── */
    const personalTouched = useRef(false);
    const professionalTouched = useRef(false);
    const privacyTouched = useRef(false);

    useEffect(() => {
        if (!userProfile) return;

        // Pre-fill personal info if untouched
        if (!personalTouched.current) {
            setDisplayName(userProfile.displayName || '');
            const initialUsername = userProfile.username ? normalizeUsername(userProfile.username) : '';
            setUsername(initialUsername);
            setUsernameStatus(initialUsername ? 'unchanged' : 'idle');
            setUsernameStatusMessage(initialUsername ? 'Current username' : '');
            setHeadline(userProfile.headline || '');
            setBio(userProfile.bio || '');
        }

        // Pre-fill professional info if untouched
        if (!professionalTouched.current) {
            setSkills(userProfile.skills || []);
            setInterests(userProfile.interests || []);
            setWebsite((userProfile as any).website || '');
            setPortfolioURL((userProfile as any).portfolioURL || '');
            const loc = (userProfile as any).location || '';
            setLocation(loc);
            setCountryName((userProfile as any).country || '');
            setCountryIsoCode((userProfile as any).countryCode || '');
            setCityName((userProfile as any).city || '');
        }

        // Pre-fill privacy settings if untouched
        if (!privacyTouched.current && (userProfile as any).privacySettings) {
            const p = (userProfile as any).privacySettings;
            if (p.profileVisibility) setProfileVisibility(p.profileVisibility);
            if (p.showOnlineStatus !== undefined) setShowOnlineStatus(p.showOnlineStatus);
            if (p.directMessages) setDirectMessages(p.directMessages);
            if (p.allowIndexing !== undefined) setAllowIndexing(p.allowIndexing);
        }
    }, [userProfile]);

    /* ── Derived display values ── */
    const userAvatar = localAvatarUrl || userProfile?.photoURL || currentUser?.photoURL || null;
    const coverImage = localCoverUrl || userProfile?.coverPhotoURL || null;

    // Profile completion metric
    const completionPercentage = computeProfileCompletion({
        displayName: displayName || userProfile?.displayName,
        headline: headline || userProfile?.headline,
        bio: bio || userProfile?.bio,
        skills: skills?.length ? skills : userProfile?.skills,
        interests: interests?.length ? interests : userProfile?.interests,
        location: location || (userProfile as any)?.location,
        website: website || (userProfile as any)?.website,
        photoURL: userAvatar,
        coverPhotoURL: coverImage,
    });

    /* ── Persist profile completion helper ── */
    const persistCompletion = async (overrides: Record<string, any> = {}) => {
        if (!currentUser) return;
        const merged = {
            displayName: overrides.displayName ?? displayName,
            headline: overrides.headline ?? headline,
            bio: overrides.bio ?? bio,
            skills: overrides.skills ?? skills,
            interests: overrides.interests ?? interests,
            location: overrides.location ?? location,
            website: overrides.website ?? website,
            photoURL: overrides.photoURL ?? userAvatar,
            coverPhotoURL: overrides.coverPhotoURL ?? coverImage,
        };
        const pct = computeProfileCompletion(merged);
        await updateDocument(COLLECTIONS.users, currentUser.uid, { profileCompletion: pct });
    };

    /* ── Handlers ── */

    const loadSuggestions = async (baseName: string) => {
        setLoadingSuggestions(true);
        try {
            const suggestions = await suggestAlternativeUsernames(baseName, 4);
            setUsernameSuggestions(suggestions);
        } catch (e) {
            console.warn('[SUGGESTIONS_ERROR]', e);
        } finally {
            setLoadingSuggestions(false);
        }
    };

    const handleUsernameChange = (val: string) => {
        personalTouched.current = true;
        setUsername(val);

        const normalized = normalizeUsername(val);
        const currentNormalized = userProfile?.username ? normalizeUsername(userProfile.username) : '';

        if (usernameCheckTimerRef.current) {
            clearTimeout(usernameCheckTimerRef.current);
        }

        if (!val.trim()) {
            setUsernameStatus('invalid_format');
            setUsernameStatusMessage('Username cannot be empty');
            setUsernameSuggestions([]);
            return;
        }

        if (normalized === currentNormalized) {
            setUsernameStatus('unchanged');
            setUsernameStatusMessage('Current username');
            setUsernameSuggestions([]);
            return;
        }

        const formatCheck = validateUsernameFormat(normalized);
        if (!formatCheck.isValid) {
            setUsernameStatus('invalid_format');
            setUsernameStatusMessage(formatCheck.error || 'Invalid username format');
            setUsernameSuggestions([]);
            return;
        }

        if (isUsernameReserved(normalized)) {
            setUsernameStatus('reserved');
            setUsernameStatusMessage('This username is reserved');
            setUsernameSuggestions([]);
            return;
        }

        setUsernameStatus('checking');
        setUsernameStatusMessage('Checking availability...');
        setUsernameSuggestions([]);

        usernameCheckTimerRef.current = setTimeout(async () => {
            try {
                const res = await checkUsernameAvailability(val, currentUser?.uid, userProfile?.username);
                setUsernameStatus(res.status);
                setUsernameStatusMessage(res.message);

                if (res.status === 'taken') {
                    loadSuggestions(val);
                } else {
                    setUsernameSuggestions([]);
                }
            } catch (err) {
                console.warn('[LIVE_USERNAME_CHECK_ERROR]', err);
            }
        }, 350);
    };

    const handleSelectSuggestion = (suggestion: string) => {
        handleUsernameChange(suggestion);
    };

    const handlePersonalSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;
        setPersonalLoading(true);
        setPersonalMessage({ type: '', text: '' });
        try {
            const normalized = normalizeUsername(username);

            const formatCheck = validateUsernameFormat(normalized);
            if (!formatCheck.isValid) {
                throw new Error(formatCheck.error || 'Invalid username format.');
            }
            if (isUsernameReserved(normalized)) {
                throw new Error(`The username '${normalized}' is reserved.`);
            }

            console.log(`[FIRESTORE_WRITE] Claiming username and personal info for ${currentUser.uid}`);
            const claimResult = await claimUsername(currentUser.uid, normalized, {
                displayName,
                headline,
                bio,
            });

            setUsername(claimResult.username);
            setUsernameStatus('unchanged');
            setUsernameStatusMessage('Current username');
            setUsernameSuggestions([]);

            await persistCompletion({ displayName, headline, bio });
            setPersonalMessage({ type: 'success', text: 'Personal information updated and synced.' });
            personalTouched.current = false;
        } catch (err: any) {
            console.error('[PROFILE_SAVE_ERROR] Personal info failed:', err);
            const errorMsg = err?.message || getFriendlyErrorMessage(err);
            setPersonalMessage({ type: 'error', text: errorMsg });

            if (errorMsg.includes('already taken')) {
                setUsernameStatus('taken');
                setUsernameStatusMessage('Username already taken');
                loadSuggestions(username);
            }
        }
        setPersonalLoading(false);
    };

    const handleLocationChange = (data: LocationData) => {
        professionalTouched.current = true;
        setLocation(data.location);
        setCountryName(data.country);
        setCountryIsoCode(data.countryCode);
        setCityName(data.city);
    };

    const handleProfessionalSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;
        setProfessionalLoading(true);
        setProfessionalMessage({ type: '', text: '' });
        try {
            const payload = { 
                skills, 
                interests, 
                website, 
                portfolioURL, 
                location,
                country: countryName,
                countryCode: countryIsoCode,
                city: cityName
            };
            console.log(`[FIRESTORE_WRITE] Professional info — users/${currentUser.uid}:`, payload);
            await updateDocument(COLLECTIONS.users, currentUser.uid, payload);
            await persistCompletion({ skills, interests, location, website });
            setProfessionalMessage({ type: 'success', text: 'Professional parameters updated successfully.' });
            professionalTouched.current = false;
        } catch (err: any) {
            console.error('[PROFILE_SAVE_ERROR] Professional info failed:', err);
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

        const objectUrl = URL.createObjectURL(file);
        if (type === 'profile') setLocalAvatarUrl(objectUrl);
        else setLocalCoverUrl(objectUrl);

        try {
            const path = `profileMedia/${currentUser.uid}/${type}_${Date.now()}_${file.name}`;
            const uploaded = await uploadFile(path, file, {
                allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
                maxSizeBytes: 5 * 1024 * 1024,
                onProgress: p => type === 'profile' ? setAvatarProgress(p) : setCoverProgress(p),
            });

            if (type === 'profile') {
                await updateUserAuthProfile(currentUser, { photoURL: uploaded.url });
                setLocalAvatarUrl(uploaded.url);
            } else {
                setLocalCoverUrl(uploaded.url);
            }

            const firestoreField = type === 'profile' ? 'photoURL' : 'coverPhotoURL';
            await updateDocument(COLLECTIONS.users, currentUser.uid, {
                [firestoreField]: uploaded.url,
            });

            await persistCompletion({ [firestoreField]: uploaded.url });
            setMediaMessage({
                type: 'success',
                text: `${type === 'profile' ? 'Avatar asset' : 'Cover banner asset'} updated successfully.`,
            });
        } catch (err: any) {
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
            await updateDocument(COLLECTIONS.users, currentUser.uid, { coverPhotoURL: null });
            await persistCompletion({ coverPhotoURL: null });
            setMediaMessage({ type: 'success', text: 'Cover banner removed.' });
        } catch (err: any) {
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
            if (newEmail && newEmail !== currentUser.email) {
                await updateUserEmail(currentUser, newEmail);
            }
            if (newPassword) {
                const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
                if (!passwordRegex.test(newPassword)) {
                    throw new Error('Password must be at least 8 characters and include a number and special character.');
                }
                await updateUserPassword(currentUser, newPassword);
            }
            setAccountMessage({ type: 'success', text: 'Account credentials successfully updated.' });
            setNewEmail(''); 
            setNewPassword(''); 
            setConfirmPassword('');
        } catch (err: any) {
            const msg = err.code === 'auth/requires-recent-login'
                ? 'This sensitive action requires recent authentication. Please sign out, log back in, and retry.'
                : getFriendlyErrorMessage(err);
            setAccountMessage({ type: 'error', text: msg });
        }
        setAccountLoading(false);
    };

    const handlePrivacySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;
        setPrivacyLoading(true);
        setPrivacyMessage({ type: '', text: '' });
        try {
            const privacySettings = {
                profileVisibility,
                showOnlineStatus,
                directMessages,
                allowIndexing,
                updatedAt: new Date().toISOString(),
            };
            await updateDocument(COLLECTIONS.users, currentUser.uid, { privacySettings });
            setPrivacyMessage({ type: 'success', text: 'Privacy & telemetry preferences persisted.' });
            privacyTouched.current = false;
        } catch (err: any) {
            setPrivacyMessage({ type: 'error', text: getFriendlyErrorMessage(err) });
        }
        setPrivacyLoading(false);
    };

    const currentTabObj = TABS.find(t => t.id === activeTab) || TABS[0];

    return (
        <div className="w-full flex-1 flex flex-col min-h-0 pb-6">
            {/* ── Main Unified Settings Frame ── */}
            <div className="border border-zinc-800 bg-[#0c0c0e] flex-1 flex flex-col min-h-[620px] md:min-h-[700px] shadow-2xl">
                
                {/* ── Header Toolbar ── */}
                <div className="border-b border-zinc-800 bg-zinc-950 px-4 md:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        {/* Mobile quick Back to My Profile button */}
                        <button
                            type="button"
                            onClick={() => navigate('/profile')}
                            className="lg:hidden flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono bg-black border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-600 transition-colors"
                            aria-label="Back to My Profile"
                        >
                            <ArrowLeftIcon className="w-3.5 h-3.5" />
                            <span>PROFILE</span>
                        </button>

                        <div>
                            <h1 className="text-base font-bold font-mono text-white tracking-wider flex items-center gap-2">
                                <span>Settings</span>
                                <span className="text-zinc-600 font-normal">/</span>
                                <span className="text-zinc-400 font-normal text-xs">{currentTabObj.label}</span>
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 font-mono text-xs">
                        <span className="text-zinc-400 hidden sm:inline text-xs">
                            Profile Completion:
                        </span>
                        <div className="flex items-center gap-2 bg-black border border-zinc-800 px-3 py-1 text-xs">
                            <span className="w-2 h-2 bg-emerald-500 inline-block"></span>
                            <span className="text-white font-bold">{completionPercentage}%</span>
                        </div>
                    </div>
                </div>

                {/* ── Body: Left Nav + Central Workspace ── */}
                <div className="flex-1 flex flex-col md:flex-row min-h-0">

                    {/* ── A. Left Navigation Panel ── */}
                    <div className="w-full md:w-64 flex-shrink-0 border-b md:border-b-0 md:border-r border-zinc-800 bg-[#09090b] flex flex-col justify-between">
                        <div>
                            <div className="hidden md:block px-4 py-3 border-b border-zinc-900 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                                Categories
                            </div>
                            <nav className="flex flex-row md:flex-col overflow-x-auto no-scrollbar">
                                {TABS.map(tab => {
                                    const isActive = activeTab === tab.id;
                                    return (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`text-left py-3.5 px-4 font-mono text-xs uppercase tracking-wider transition-all flex flex-col gap-0.5 whitespace-nowrap md:whitespace-normal group border-b md:border-b-0 border-r md:border-r-0 md:border-l-2 ${
                                                isActive
                                                    ? 'bg-zinc-900/90 text-white font-bold border-b-2 md:border-b-0 md:border-l-2 border-emerald-500 shadow-inner'
                                                    : 'text-zinc-400 hover:bg-zinc-900/40 hover:text-zinc-200 border-transparent hover:border-zinc-700'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] ${isActive ? 'text-emerald-400 font-bold' : 'text-zinc-600'}`}>
                                                    [{tab.code}]
                                                </span>
                                                <span className="truncate">{tab.label}</span>
                                            </div>
                                            <span className="text-[10px] text-zinc-500 normal-case tracking-normal hidden md:block pl-6 font-sans">
                                                {tab.desc}
                                            </span>
                                        </button>
                                    );
                                })}
                            </nav>
                        </div>
                    </div>

                    {/* ── B. Central Content Workspace ── */}
                    <div className="flex-1 bg-[#0c0c0e] p-5 sm:p-6 md:p-8 min-w-0 overflow-y-auto no-scrollbar flex flex-col justify-between">
                        
                        <div className="space-y-6 max-w-3xl">

                            {/* ── 01: Personal Info ── */}
                            {activeTab === 'personal' && (
                                <div>
                                    <SectionHeader
                                        title="Personal Information"
                                        description="Update your display name, username handle, headline, and bio."
                                    />
                                    <StatusMessage msg={personalMessage} />
                                    <form
                                        onSubmit={handlePersonalSubmit}
                                        className="space-y-5"
                                        onChange={() => { personalTouched.current = true; }}
                                    >
                                        <FormField label="Display Name" hint="Public Name">
                                            <input
                                                type="text"
                                                value={displayName}
                                                onChange={e => setDisplayName(e.target.value)}
                                                placeholder="e.g. Alex Morgan"
                                                className={inputClass}
                                                required
                                            />
                                        </FormField>

                                        <FormField label="Username Handle" hint="Unique Handle (@)">
                                            <div className="space-y-2">
                                                <div className="relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-mono select-none">
                                                        @
                                                    </span>
                                                    <input
                                                        type="text"
                                                        value={username}
                                                        onChange={e => handleUsernameChange(e.target.value)}
                                                        placeholder="username"
                                                        autoCapitalize="none"
                                                        autoCorrect="off"
                                                        spellCheck="false"
                                                        className={`${inputClass} pl-7 ${
                                                            usernameStatus === 'taken' || usernameStatus === 'reserved'
                                                                ? 'border-rose-900 focus:border-rose-600'
                                                                : usernameStatus === 'available'
                                                                ? 'border-emerald-800 focus:border-emerald-500'
                                                                : ''
                                                        }`}
                                                    />
                                                    {usernameStatus === 'checking' && (
                                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-zinc-500 text-[10px] font-mono">
                                                            <span className="w-3 h-3 border border-zinc-500 border-t-transparent animate-spin inline-block"></span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Live Status Feedback */}
                                                {usernameStatus !== 'idle' && (
                                                    <div className="flex items-center gap-2 text-xs font-mono transition-all">
                                                        {usernameStatus === 'checking' && (
                                                            <span className="text-zinc-400">Checking availability…</span>
                                                        )}
                                                        {usernameStatus === 'available' && (
                                                            <span className="text-emerald-400 flex items-center gap-1.5">
                                                                <span className="w-1.5 h-1.5 bg-emerald-500 inline-block"></span>
                                                                Username is available
                                                            </span>
                                                        )}
                                                        {usernameStatus === 'unchanged' && (
                                                            <span className="text-zinc-500">Current username</span>
                                                        )}
                                                        {usernameStatus === 'taken' && (
                                                            <span className="text-rose-400 flex items-center gap-1.5">
                                                                <span className="w-1.5 h-1.5 bg-rose-500 inline-block"></span>
                                                                Username already registered
                                                            </span>
                                                        )}
                                                        {usernameStatus === 'reserved' && (
                                                            <span className="text-rose-400 flex items-center gap-1.5">
                                                                <span className="w-1.5 h-1.5 bg-rose-500 inline-block"></span>
                                                                This username is reserved
                                                            </span>
                                                        )}
                                                        {usernameStatus === 'invalid_format' && (
                                                            <span className="text-amber-400 flex items-center gap-1.5">
                                                                <span className="w-1.5 h-1.5 bg-amber-500 inline-block"></span>
                                                                {usernameStatusMessage || 'Invalid username format'}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Suggestions when taken */}
                                                {usernameStatus === 'taken' && (
                                                    <div className="p-3.5 bg-zinc-950 border border-zinc-800 font-mono space-y-2 mt-2">
                                                        <p className="text-xs text-zinc-300">
                                                            This username is already taken. Try one of these suggested handles:
                                                        </p>
                                                        <div>
                                                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-2">
                                                                Suggested Alternatives
                                                            </span>
                                                            {loadingSuggestions ? (
                                                                <div className="flex items-center gap-2 text-zinc-500 text-xs py-1">
                                                                    <span className="w-2.5 h-2.5 border border-zinc-500 border-t-transparent animate-spin inline-block"></span>
                                                                    <span>Generating available handles…</span>
                                                                </div>
                                                            ) : usernameSuggestions.length > 0 ? (
                                                                <div className="flex flex-wrap gap-2">
                                                                    {usernameSuggestions.map(suggestion => (
                                                                        <button
                                                                            key={suggestion}
                                                                            type="button"
                                                                            onClick={() => handleSelectSuggestion(suggestion)}
                                                                            className="px-2.5 py-1 text-xs border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 hover:border-zinc-500 text-zinc-200 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                                                                            title={`Choose @${suggestion}`}
                                                                        >
                                                                            <span className="text-zinc-500">@</span>
                                                                            <span className="font-bold">{suggestion}</span>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <p className="text-[11px] text-zinc-500">
                                                                    No alternatives generated. Try adding an underscore or numerical suffix.
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                <p className="text-[10px] text-zinc-500 font-mono">
                                                    3–24 characters · Lowercase letters, numbers, and underscores
                                                </p>
                                            </div>
                                        </FormField>

                                        <FormField 
                                            label="Professional Headline" 
                                            hint={`${headline.length} / 120 characters`}
                                        >
                                            <input
                                                type="text"
                                                value={headline}
                                                onChange={e => setHeadline(e.target.value.slice(0, 120))}
                                                maxLength={120}
                                                placeholder="e.g. Distributed Systems Engineer · Open Source Contributor"
                                                className={inputClass}
                                            />
                                        </FormField>

                                        <FormField 
                                            label="Bio" 
                                            hint={`${bio.length} / 500 characters`}
                                        >
                                            <textarea
                                                value={bio}
                                                onChange={e => setBio(e.target.value.slice(0, 500))}
                                                rows={4}
                                                placeholder="Summarize your background, core technical focus, and areas of interest…"
                                                className={textareaClass}
                                                maxLength={500}
                                            />
                                        </FormField>

                                        <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-end">
                                            <SaveButton loading={personalLoading} />
                                        </div>
                                    </form>
                                </div>
                            )}

                            {/* ── 02: Professional ── */}
                            {activeTab === 'professional' && (
                                <div>
                                    <SectionHeader
                                        title="Professional Parameters"
                                        description="Add your skills, interests, location, and portfolio links."
                                    />
                                    <StatusMessage msg={professionalMessage} />
                                    <form
                                        onSubmit={handleProfessionalSubmit}
                                        className="space-y-5"
                                        onChange={() => { professionalTouched.current = true; }}
                                    >
                                        <ChipInput
                                            label="Skills & Competencies"
                                            chips={skills}
                                            onChange={chips => {
                                                professionalTouched.current = true;
                                                setSkills(chips);
                                            }}
                                            placeholder="Type skill (e.g. React, Rust, Go) and press Enter"
                                        />

                                        <ChipInput
                                            label="Interests & Domains"
                                            chips={interests}
                                            onChange={chips => {
                                                professionalTouched.current = true;
                                                setInterests(chips);
                                            }}
                                            placeholder="Type domain (e.g. AI/ML, Cloud Infra, Web3) and press Enter"
                                        />

                                        {/* ── Searchable Cascading Country & City Selector ── */}
                                        <div className="p-4 bg-zinc-950/60 border border-zinc-800 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold tracking-wider text-white font-mono flex items-center gap-1.5">
                                                    <MapPinIcon className="w-3.5 h-3.5 text-emerald-400" />
                                                    Location
                                                </span>
                                            </div>
                                            <LocationSelector
                                                value={location}
                                                initialCountryCode={countryIsoCode}
                                                initialCity={cityName}
                                                onChange={handleLocationChange}
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <FormField label="Website" hint="Primary URL">
                                                <div className="relative">
                                                    <input
                                                        type="url"
                                                        value={website}
                                                        onChange={e => setWebsite(e.target.value)}
                                                        placeholder="https://example.dev"
                                                        className={inputClass}
                                                    />
                                                </div>
                                            </FormField>

                                            <FormField label="Portfolio URL" hint="Work Showcase">
                                                <div className="relative">
                                                    <input
                                                        type="url"
                                                        value={portfolioURL}
                                                        onChange={e => setPortfolioURL(e.target.value)}
                                                        placeholder="https://portfolio.dev"
                                                        className={inputClass}
                                                    />
                                                </div>
                                            </FormField>
                                        </div>

                                        <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between">
                                            <SaveButton loading={professionalLoading} />
                                            <span className="text-[10px] text-zinc-500 font-mono">
                                                Helps match you with relevant projects and collaborators
                                            </span>
                                        </div>
                                    </form>
                                </div>
                            )}

                            {/* ── 03: Profile Media ── */}
                            {activeTab === 'media' && (
                                <div>
                                    <SectionHeader
                                        title="Profile Media"
                                        description="Upload and customize your avatar and cover banner."
                                    />
                                    <StatusMessage msg={mediaMessage} />
                                    
                                    <div className="space-y-6 font-mono">
                                        {/* Avatar Card */}
                                        <div className="p-4 md:p-5 bg-zinc-950/60 border border-zinc-800 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <label className="block text-zinc-300 text-xs font-bold uppercase tracking-wider">
                                                    Profile Avatar
                                                </label>
                                                <span className="text-[10px] text-zinc-500 uppercase">
                                                    Square · 1:1 ratio recommended
                                                </span>
                                            </div>

                                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                                                <div className="w-24 h-24 border-2 border-zinc-700 bg-zinc-950 overflow-hidden flex items-center justify-center flex-shrink-0 relative shadow-md">
                                                    {userAvatar ? (
                                                        <img
                                                            src={userAvatar}
                                                            onError={handleImageError}
                                                            alt="Avatar Preview"
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <ProfileIcon className="w-12 h-12 text-zinc-600" />
                                                    )}
                                                    {uploadingAvatar && (
                                                        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-1">
                                                            <span className="w-4 h-4 border-2 border-white border-t-transparent animate-spin inline-block"></span>
                                                            <span className="text-white text-[11px] font-bold">{avatarProgress}%</span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="space-y-2">
                                                    <label className="cursor-pointer inline-flex items-center gap-2 bg-white text-black text-xs font-mono font-bold uppercase px-4 py-2.5 hover:bg-zinc-200 transition-colors shadow-sm">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                                        </svg>
                                                        {uploadingAvatar ? `Uploading ${avatarProgress}%` : 'Upload New Avatar'}
                                                        <input
                                                            type="file"
                                                            className="hidden"
                                                            accept="image/jpeg,image/png,image/gif,image/webp"
                                                            onChange={e => handleMediaUpload(e, 'profile')}
                                                            disabled={uploadingAvatar}
                                                        />
                                                    </label>
                                                    <p className="text-[10px] text-zinc-500 uppercase">
                                                        JPG, PNG, WebP or GIF · Maximum file size: 5MB
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Cover Banner Card */}
                                        <div className="p-4 md:p-5 bg-zinc-950/60 border border-zinc-800 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <label className="block text-zinc-300 text-xs font-bold uppercase tracking-wider">
                                                    Cover Banner
                                                </label>
                                                <span className="text-[10px] text-zinc-500 uppercase">
                                                    Landscape · Recommended 1200×400px
                                                </span>
                                            </div>

                                            {/* Banner Preview Frame */}
                                            <div
                                                className="w-full h-36 md:h-44 border border-zinc-800 bg-zinc-950 bg-cover bg-center overflow-hidden relative shadow-inner"
                                                style={coverImage ? { backgroundImage: `url(${coverImage})` } : {}}
                                            >
                                                {!coverImage && (
                                                    <div className="h-full flex flex-col items-center justify-center text-zinc-600 text-xs gap-1.5 p-4 text-center">
                                                        <span className="text-[11px] tracking-wider text-zinc-500">No banner uploaded</span>
                                                        <span className="text-[10px] text-zinc-600">Upload a banner image to customize your profile header</span>
                                                    </div>
                                                )}
                                                {uploadingCover && (
                                                    <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                                                        <div className="text-center space-y-2">
                                                            <div className="w-40 h-1.5 bg-zinc-800 overflow-hidden border border-zinc-700">
                                                                <div
                                                                    className="h-full bg-white transition-all duration-200"
                                                                    style={{ width: `${coverProgress}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-white text-xs font-bold block">{coverProgress}% uploaded</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-3 flex-wrap">
                                                <label className="cursor-pointer inline-flex items-center gap-2 border border-zinc-700 bg-zinc-900 text-zinc-200 text-xs font-mono uppercase px-4 py-2.5 hover:bg-zinc-800 hover:text-white transition-colors">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                                                        className="inline-flex items-center gap-1.5 border border-rose-900/60 bg-rose-950/20 text-rose-400 hover:text-rose-300 text-xs font-mono uppercase px-3.5 py-2.5 transition-colors"
                                                    >
                                                        Remove Banner
                                                    </button>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-zinc-500 uppercase">
                                                Recommended resolution: 1200 × 400px · Max 5MB
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── 04: Account ── */}
                            {activeTab === 'account' && (
                                <div>
                                    <SectionHeader
                                        title="Account & Security"
                                        description="Manage your login email and password credentials."
                                    />
                                    
                                    <div className="mb-5 p-4 border border-zinc-800 bg-zinc-950 font-mono text-xs space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-zinc-400">Signed in as</span>
                                            <span className="text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 px-2 py-0.5 uppercase font-medium">
                                                Account Status: Active
                                            </span>
                                        </div>
                                        <p className="text-white font-bold text-sm">{currentUser?.email}</p>
                                    </div>

                                    <StatusMessage msg={accountMessage} />

                                    <form onSubmit={handleAccountSubmit} className="space-y-5">
                                        <FormField label="Update Email Address" hint="Optional">
                                            <input
                                                type="email"
                                                value={newEmail}
                                                onChange={e => setNewEmail(e.target.value)}
                                                placeholder="Enter new email address (leave blank to keep current)"
                                                className={inputClass}
                                            />
                                        </FormField>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <FormField label="New Password" hint="Min 8 chars, 1 num, 1 symbol">
                                                <input
                                                    type="password"
                                                    value={newPassword}
                                                    onChange={e => setNewPassword(e.target.value)}
                                                    placeholder="Enter new password"
                                                    className={inputClass}
                                                />
                                            </FormField>

                                            <FormField label="Confirm Password" hint="Must match">
                                                <input
                                                    type="password"
                                                    value={confirmPassword}
                                                    onChange={e => setConfirmPassword(e.target.value)}
                                                    placeholder="Repeat new password"
                                                    className={inputClass}
                                                />
                                            </FormField>
                                        </div>

                                        <div className="p-3 bg-zinc-950 border border-zinc-800 font-mono text-[10px] text-zinc-400 space-y-1">
                                            <p className="font-bold text-zinc-300">Password Requirements:</p>
                                            <ul className="list-disc list-inside space-y-0.5 text-zinc-500">
                                                <li className={newPassword.length >= 8 ? 'text-emerald-400' : ''}>
                                                    Minimum 8 characters
                                                </li>
                                                <li className={/\d/.test(newPassword) ? 'text-emerald-400' : ''}>
                                                    At least one numerical digit (0–9)
                                                </li>
                                                <li className={/[@$!%*#?&]/.test(newPassword) ? 'text-emerald-400' : ''}>
                                                    At least one special character (@$!%*#?&)
                                                </li>
                                            </ul>
                                        </div>

                                        <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between">
                                            <SaveButton loading={accountLoading} label="Update Credentials" />
                                            <span className="text-[10px] text-zinc-500 font-mono">
                                                You may need to sign in again after updating credentials
                                            </span>
                                        </div>
                                    </form>
                                </div>
                            )}

                            {/* ── 05: Privacy & Visibility ── */}
                            {activeTab === 'privacy' && (
                                <div>
                                    <SectionHeader
                                        title="Privacy & Visibility"
                                        description="Manage your profile visibility, online status, and messaging preferences."
                                    />
                                    <StatusMessage msg={privacyMessage} />

                                    <form
                                        onSubmit={handlePrivacySubmit}
                                        className="space-y-4 font-mono"
                                        onChange={() => { privacyTouched.current = true; }}
                                    >
                                        {/* Profile Visibility */}
                                        <div className="p-4 border border-zinc-800 bg-zinc-950/80 space-y-3">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                <div>
                                                    <p className="text-xs font-bold text-white uppercase">Profile Visibility</p>
                                                    <p className="text-[11px] text-zinc-500 mt-0.5">
                                                        Control how your profile appears across Explore, Spotlight, and directory searches.
                                                    </p>
                                                </div>
                                                <select
                                                    value={profileVisibility}
                                                    onChange={e => {
                                                        privacyTouched.current = true;
                                                        setProfileVisibility(e.target.value as any);
                                                    }}
                                                    className="bg-black border border-zinc-700 text-white text-xs px-3 py-1.5 font-mono focus:outline-none focus:border-zinc-500 shrink-0"
                                                >
                                                    <option value="public">Public (Visible to all)</option>
                                                    <option value="connections_only">Connections Only</option>
                                                    <option value="private">Private</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* Activity Telemetry */}
                                        <div className="p-4 border border-zinc-800 bg-zinc-950/80 flex items-center justify-between gap-4">
                                            <div>
                                                <p className="text-xs font-bold text-white uppercase">Online Status</p>
                                                <p className="text-[11px] text-zinc-500 mt-0.5">
                                                    Show when you are active on the platform.
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    privacyTouched.current = true;
                                                    setShowOnlineStatus(!showOnlineStatus);
                                                }}
                                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer border transition-colors duration-200 ease-in-out focus:outline-none ${
                                                    showOnlineStatus
                                                        ? 'bg-emerald-600 border-emerald-500'
                                                        : 'bg-zinc-900 border-zinc-700'
                                                }`}
                                            >
                                                <span
                                                    className={`pointer-events-none inline-block h-5 w-5 transform bg-white shadow transition duration-200 ease-in-out ${
                                                        showOnlineStatus ? 'translate-x-5' : 'translate-x-0'
                                                    }`}
                                                />
                                            </button>
                                        </div>

                                        {/* Direct Transmission Access */}
                                        <div className="p-4 border border-zinc-800 bg-zinc-950/80 space-y-3">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                <div>
                                                    <p className="text-xs font-bold text-white uppercase">Direct Messages</p>
                                                    <p className="text-[11px] text-zinc-500 mt-0.5">
                                                        Control who can send you direct messages in Hub.
                                                    </p>
                                                </div>
                                                <select
                                                    value={directMessages}
                                                    onChange={e => {
                                                        privacyTouched.current = true;
                                                        setDirectMessages(e.target.value as any);
                                                    }}
                                                    className="bg-black border border-zinc-700 text-white text-xs px-3 py-1.5 font-mono focus:outline-none focus:border-zinc-500 shrink-0"
                                                >
                                                    <option value="everyone">Everyone</option>
                                                    <option value="connections">Approved Connections Only</option>
                                                    <option value="disabled">Disabled</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* External Discovery */}
                                        <div className="p-4 border border-zinc-800 bg-zinc-950/80 flex items-center justify-between gap-4">
                                            <div>
                                                <p className="text-xs font-bold text-white uppercase">Search Engine Indexing</p>
                                                <p className="text-[11px] text-zinc-500 mt-0.5">
                                                    Allow your public showcases and creations to be indexed in external search results.
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    privacyTouched.current = true;
                                                    setAllowIndexing(!allowIndexing);
                                                }}
                                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer border transition-colors duration-200 ease-in-out focus:outline-none ${
                                                    allowIndexing
                                                        ? 'bg-emerald-600 border-emerald-500'
                                                        : 'bg-zinc-900 border-zinc-700'
                                                }`}
                                            >
                                                <span
                                                    className={`pointer-events-none inline-block h-5 w-5 transform bg-white shadow transition duration-200 ease-in-out ${
                                                        allowIndexing ? 'translate-x-5' : 'translate-x-0'
                                                    }`}
                                                />
                                            </button>
                                        </div>

                                        <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-end">
                                            <SaveButton loading={privacyLoading} label="Save Privacy Preferences" />
                                        </div>
                                    </form>
                                </div>
                            )}

                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
