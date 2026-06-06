import React, { useState, useRef, KeyboardEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { updateUserEmail, updateUserPassword } from '../services/authService';
import { COLLECTIONS, updateDocument } from '../services/firestoreService';
import { getFriendlyErrorMessage } from '../utils/errorHandler';
import { uploadFile } from '../services/storageService';
import { updateProfile } from 'firebase/auth';
import { handleImageError } from '../components/utils/imageUtils';
import { ProfileIcon } from '../components/ui/Icons';

/* ─── Chip Input Component ────────────────────────────────────────────────── */

interface ChipInputProps {
    label: string;
    chips: string[];
    onChange: (chips: string[]) => void;
    placeholder?: string;
    color?: 'default' | 'blue';
}

const ChipInput: React.FC<ChipInputProps> = ({ label, chips, onChange, placeholder = 'Type and press Enter', color = 'default' }) => {
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

    const removeChip = (idx: number) => {
        onChange(chips.filter((_, i) => i !== idx));
    };

    return (
        <div>
            <label className="block text-invox-light-gray mb-2 text-sm font-medium">{label}</label>
            <div
                className="min-h-[48px] w-full bg-gray-700 border border-gray-600 rounded-lg p-2 focus-within:ring-2 focus-within:ring-invox-red focus-within:border-invox-red cursor-text flex flex-wrap gap-2"
                onClick={() => inputRef.current?.focus()}
            >
                {chips.map((chip, idx) => (
                    <span
                        key={idx}
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            color === 'blue'
                                ? 'bg-blue-900/40 border border-blue-700/50 text-blue-300'
                                : 'bg-gray-600 border border-gray-500 text-gray-200'
                        }`}
                    >
                        {chip}
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); removeChip(idx); }}
                            className="text-gray-400 hover:text-white ml-0.5 leading-none"
                        >
                            ×
                        </button>
                    </span>
                ))}
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={() => { if (inputValue) addChip(inputValue); }}
                    placeholder={chips.length === 0 ? placeholder : ''}
                    className="flex-1 min-w-[120px] bg-transparent outline-none text-white text-sm placeholder-gray-500"
                />
            </div>
            <p className="mt-1 text-xs text-gray-500">Press Enter or comma to add a tag</p>
        </div>
    );
};

/* ─── Section Header Component ────────────────────────────────────────────── */

const SectionHeader = ({ title, description }: { title: string; description?: string }) => (
    <div className="mb-6 pb-4 border-b border-gray-800">
        <h2 className="text-xl font-bold text-white">{title}</h2>
        {description && <p className="text-sm text-gray-400 mt-1">{description}</p>}
    </div>
);

/* ─── Form Field Component ────────────────────────────────────────────────── */

const FormField = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
        <label className="block text-invox-light-gray mb-2 text-sm font-medium">{label}</label>
        {children}
    </div>
);

const inputClass = "w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-invox-red focus:border-invox-red text-white placeholder-gray-500 transition-all";
const textareaClass = `${inputClass} resize-none`;

/* ─── Tab config ──────────────────────────────────────────────────────────── */

const TABS = [
    { id: 'personal', label: 'Personal Info', icon: '👤' },
    { id: 'professional', label: 'Professional', icon: '💼' },
    { id: 'media', label: 'Profile Media', icon: '🖼️' },
    { id: 'account', label: 'Account', icon: '🔑' },
    { id: 'privacy', label: 'Privacy', icon: '🔒' },
];

/* ─── Main Component ──────────────────────────────────────────────────────── */

const SettingsPage = () => {
    const { currentUser, userProfile } = useAuth();
    const [activeTab, setActiveTab] = useState('personal');

    /* ── Personal form state ── */
    const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
    const [username, setUsername] = useState(userProfile?.username || '');
    const [headline, setHeadline] = useState(userProfile?.headline || '');
    const [bio, setBio] = useState(userProfile?.bio || '');
    const [personalLoading, setPersonalLoading] = useState(false);
    const [personalMessage, setPersonalMessage] = useState({ type: '', text: '' });

    /* ── Professional form state ── */
    const [skills, setSkills] = useState<string[]>(userProfile?.skills || []);
    const [interests, setInterests] = useState<string[]>(userProfile?.interests || []);
    const [website, setWebsite] = useState((userProfile as any)?.website || '');
    const [portfolioURL, setPortfolioURL] = useState((userProfile as any)?.portfolioURL || '');
    const [location, setLocation] = useState((userProfile as any)?.location || '');
    const [professionalLoading, setProfessionalLoading] = useState(false);
    const [professionalMessage, setProfessionalMessage] = useState({ type: '', text: '' });

    /* ── Media form state ── */
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [uploadingCover, setUploadingCover] = useState(false);
    const [avatarProgress, setAvatarProgress] = useState(0);
    const [coverProgress, setCoverProgress] = useState(0);
    const [mediaMessage, setMediaMessage] = useState({ type: '', text: '' });

    /* ── Account form state ── */
    const [newEmail, setNewEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [accountLoading, setAccountLoading] = useState(false);
    const [accountMessage, setAccountMessage] = useState({ type: '', text: '' });

    const userAvatar = userProfile?.photoURL || currentUser?.photoURL || null;
    const coverImageUrl = userProfile?.coverPhotoURL || null;

    /* ── Handlers ── */

    const handlePersonalSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;
        setPersonalLoading(true);
        setPersonalMessage({ type: '', text: '' });
        try {
            await updateDocument(COLLECTIONS.users, currentUser.uid, {
                displayName, username, headline, bio,
            });
            setPersonalMessage({ type: 'success', text: 'Personal information updated.' });
        } catch (err: any) {
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
            await updateDocument(COLLECTIONS.users, currentUser.uid, {
                skills, interests, website, portfolioURL, location,
            });
            setProfessionalMessage({ type: 'success', text: 'Professional information updated.' });
        } catch (err: any) {
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

        try {
            const path = `users/${currentUser.uid}/${type}/${Date.now()}_${file.name}`;
            const uploaded = await uploadFile(path, file, {
                allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
                maxSizeBytes: 5 * 1024 * 1024,
                onProgress: (p) => type === 'profile' ? setAvatarProgress(p) : setCoverProgress(p),
            });
            if (type === 'profile') {
                await updateProfile(currentUser, { photoURL: uploaded.url });
            }
            await updateDocument(COLLECTIONS.users, currentUser.uid, {
                [type === 'profile' ? 'photoURL' : 'coverPhotoURL']: uploaded.url,
            });
            setMediaMessage({ type: 'success', text: `${type === 'profile' ? 'Profile photo' : 'Cover photo'} updated successfully.` });
        } catch (err: any) {
            setMediaMessage({ type: 'error', text: getFriendlyErrorMessage(err) });
        }

        if (type === 'profile') setUploadingAvatar(false);
        else setUploadingCover(false);
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
                    throw new Error('Password must be at least 8 characters long and include a number and a special character.');
                }
                await updateUserPassword(currentUser, newPassword);
            }
            setAccountMessage({ type: 'success', text: 'Account updated successfully.' });
            setNewEmail('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            const msg = err.code === 'auth/requires-recent-login'
                ? 'This operation requires recent authentication. Please log out and log in again before trying this request.'
                : getFriendlyErrorMessage(err);
            setAccountMessage({ type: 'error', text: msg });
        }
        setAccountLoading(false);
    };

    /* ── StatusMessage helper ── */
    const StatusMessage = ({ msg }: { msg: { type: string; text: string } }) =>
        msg.text ? (
            <div className={`mb-5 p-3 rounded-lg text-sm font-medium ${msg.type === 'success' ? 'bg-green-900/60 border border-green-700 text-green-300' : 'bg-red-900/60 border border-red-700 text-red-300'}`}>
                {msg.text}
            </div>
        ) : null;

    const SaveButton = ({ loading, label = 'Save Changes' }: { loading: boolean; label?: string }) => (
        <button
            type="submit"
            disabled={loading}
            className="bg-invox-red text-white px-6 py-2.5 rounded-lg text-sm font-bold hover:bg-invox-red-hover disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 active:scale-95"
        >
            {loading ? 'Saving…' : label}
        </button>
    );

    return (
        <div className="text-white">
            <h1 className="text-3xl font-bold mb-6">Settings</h1>

            <div className="flex flex-col md:flex-row gap-6">
                {/* ── Sidebar ── */}
                <div className="md:w-56 flex-shrink-0">
                    <nav className="flex flex-col gap-1">
                        {TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`text-left py-3 px-4 rounded-xl font-medium text-sm transition-all duration-200 flex items-center gap-3 ${
                                    activeTab === tab.id
                                        ? 'bg-invox-dark-accent border border-gray-700 text-white'
                                        : 'text-gray-400 hover:bg-gray-800/60 hover:text-white'
                                }`}
                            >
                                <span>{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* ── Content ── */}
                <div className="flex-1 bg-invox-dark-accent rounded-xl border border-gray-800 p-6 md:p-8">

                    {/* ── Personal Info ── */}
                    {activeTab === 'personal' && (
                        <div>
                            <SectionHeader
                                title="Personal Information"
                                description="Update how your name and identity appear on Invox."
                            />
                            <StatusMessage msg={personalMessage} />
                            <form onSubmit={handlePersonalSubmit} className="space-y-5">
                                <FormField label="Display Name">
                                    <input
                                        type="text"
                                        value={displayName}
                                        onChange={e => setDisplayName(e.target.value)}
                                        placeholder="Your full name"
                                        className={inputClass}
                                    />
                                </FormField>
                                <FormField label="Username">
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">@</span>
                                        <input
                                            type="text"
                                            value={username}
                                            onChange={e => setUsername(e.target.value)}
                                            placeholder="yourhandle"
                                            className={`${inputClass} pl-7`}
                                        />
                                    </div>
                                </FormField>
                                <FormField label="Professional Headline">
                                    <input
                                        type="text"
                                        value={headline}
                                        onChange={e => setHeadline(e.target.value)}
                                        placeholder="e.g. Full-Stack Developer · AI Enthusiast"
                                        className={inputClass}
                                    />
                                </FormField>
                                <FormField label="Bio">
                                    <textarea
                                        value={bio}
                                        onChange={e => setBio(e.target.value)}
                                        rows={5}
                                        placeholder="Tell the community about yourself, your expertise, and what you're building…"
                                        className={textareaClass}
                                    />
                                    <p className="mt-1 text-xs text-gray-500">{bio.length} / 500 characters</p>
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
                                title="Professional Information"
                                description="Showcase your skills, interests, and professional links."
                            />
                            <StatusMessage msg={professionalMessage} />
                            <form onSubmit={handleProfessionalSubmit} className="space-y-5">
                                <ChipInput
                                    label="Skills"
                                    chips={skills}
                                    onChange={setSkills}
                                    placeholder="e.g. React, TypeScript, Firebase…"
                                />
                                <ChipInput
                                    label="Interests"
                                    chips={interests}
                                    onChange={setInterests}
                                    placeholder="e.g. AI, Space, Startups…"
                                    color="blue"
                                />
                                <FormField label="Location">
                                    <input
                                        type="text"
                                        value={location}
                                        onChange={e => setLocation(e.target.value)}
                                        placeholder="e.g. Bangalore, India"
                                        className={inputClass}
                                    />
                                </FormField>
                                <FormField label="Website">
                                    <input
                                        type="url"
                                        value={website}
                                        onChange={e => setWebsite(e.target.value)}
                                        placeholder="https://yourwebsite.com"
                                        className={inputClass}
                                    />
                                </FormField>
                                <FormField label="Portfolio URL">
                                    <input
                                        type="url"
                                        value={portfolioURL}
                                        onChange={e => setPortfolioURL(e.target.value)}
                                        placeholder="https://yourportfolio.com"
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
                                description="Upload your profile photo and cover image."
                            />
                            <StatusMessage msg={mediaMessage} />
                            <div className="space-y-8">
                                {/* Profile Photo */}
                                <div>
                                    <p className="text-sm font-medium text-invox-light-gray mb-4">Profile Photo</p>
                                    <div className="flex items-center gap-6">
                                        <div className="w-24 h-24 rounded-full border-2 border-gray-700 overflow-hidden flex items-center justify-center bg-gray-800 flex-shrink-0">
                                            {userAvatar ? (
                                                <img src={userAvatar} onError={handleImageError} alt="Avatar" className="w-full h-full object-cover" />
                                            ) : (
                                                <ProfileIcon className="w-12 h-12 text-gray-500" />
                                            )}
                                        </div>
                                        <div>
                                            <label className="cursor-pointer inline-flex items-center gap-2 bg-invox-red hover:bg-invox-red-hover text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                                {uploadingAvatar ? `Uploading ${avatarProgress}%` : 'Upload Photo'}
                                                <input type="file" className="hidden" accept="image/*" onChange={e => handleMediaUpload(e, 'profile')} disabled={uploadingAvatar} />
                                            </label>
                                            <p className="text-xs text-gray-500 mt-2">JPG, PNG, GIF, WebP · Max 5MB</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t border-gray-800" />

                                {/* Cover Photo */}
                                <div>
                                    <p className="text-sm font-medium text-invox-light-gray mb-4">Cover Photo</p>
                                    <div
                                        className="w-full h-32 rounded-xl border-2 border-gray-700 bg-gray-800 bg-cover bg-center mb-4 overflow-hidden"
                                        style={coverImageUrl ? { backgroundImage: `url(${coverImageUrl})` } : {}}
                                    >
                                        {!coverImageUrl && (
                                            <div className="h-full flex items-center justify-center text-gray-600 text-sm">
                                                No cover photo set
                                            </div>
                                        )}
                                    </div>
                                    <label className="cursor-pointer inline-flex items-center gap-2 border border-gray-600 bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                        {uploadingCover ? `Uploading ${coverProgress}%` : 'Upload Cover'}
                                        <input type="file" className="hidden" accept="image/*" onChange={e => handleMediaUpload(e, 'cover')} disabled={uploadingCover} />
                                    </label>
                                    <p className="text-xs text-gray-500 mt-2">Recommended: 1200 × 400px · JPG, PNG · Max 5MB</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Account ── */}
                    {activeTab === 'account' && (
                        <div>
                            <SectionHeader
                                title="Account Settings"
                                description="Update your login credentials."
                            />
                            <div className="mb-5 p-4 rounded-xl bg-gray-800/60 border border-gray-700">
                                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Current Email</p>
                                <p className="text-white font-semibold">{currentUser?.email}</p>
                            </div>
                            <StatusMessage msg={accountMessage} />
                            <form onSubmit={handleAccountSubmit} className="space-y-5">
                                <FormField label="New Email Address">
                                    <input
                                        type="email"
                                        value={newEmail}
                                        onChange={e => setNewEmail(e.target.value)}
                                        placeholder="Leave blank to keep current email"
                                        className={inputClass}
                                    />
                                </FormField>
                                <FormField label="New Password">
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                        placeholder="At least 8 characters, include number & symbol"
                                        className={inputClass}
                                    />
                                </FormField>
                                <FormField label="Confirm New Password">
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        placeholder="Repeat your new password"
                                        className={inputClass}
                                    />
                                </FormField>
                                <div className="pt-2">
                                    <SaveButton
                                        loading={accountLoading}
                                        label="Update Account"
                                    />
                                </div>
                            </form>
                        </div>
                    )}

                    {/* ── Privacy ── */}
                    {activeTab === 'privacy' && (
                        <div>
                            <SectionHeader
                                title="Privacy & Security"
                                description="Manage how your data is shared and who can see your activity."
                            />
                            <div className="space-y-4">
                                {[
                                    { title: 'Profile Visibility', desc: 'Control who can view your full profile.' },
                                    { title: 'Activity Status', desc: 'Show or hide your online status.' },
                                    { title: 'Direct Messages', desc: 'Manage who can send you direct messages.' },
                                    { title: 'Data & Analytics', desc: 'Control how your data is used to personalize your experience.' },
                                ].map(item => (
                                    <div key={item.title} className="flex items-center justify-between p-4 rounded-xl bg-gray-800/40 border border-gray-800">
                                        <div>
                                            <p className="text-sm font-semibold text-white">{item.title}</p>
                                            <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
                                        </div>
                                        <span className="text-xs text-gray-500 bg-gray-800 border border-gray-700 px-3 py-1 rounded-full">Coming Soon</span>
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
