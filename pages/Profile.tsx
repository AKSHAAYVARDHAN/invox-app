import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ProfileIcon, PencilIcon, GlobeAltIcon, CometIcon } from '../components/ui/Icons';
import ProfileSkeleton from '../components/profile/ProfileSkeleton';
import { handleImageError } from '../components/utils/imageUtils';
import ImageZoomModal from '../components/ui/ImageZoomModal';
import { useNavigate } from 'react-router-dom';
import { uploadFile } from '../services/storageService';
import { COLLECTIONS, updateDocument } from '../services/firestoreService';
import { getFriendlyErrorMessage } from '../utils/errorHandler';
import { updateProfile } from 'firebase/auth';
import { computeProfileCompletion } from './Settings';

/* ─── helpers ─────────────────────────────────────────────────────────────── */

/** Format a Firestore Timestamp or ISO string to "Month YYYY" */
const formatJoinDate = (ts: any): string => {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

/* ─── sub-components ──────────────────────────────────────────────────────── */

const StatCard = ({ label, value }: { label: string; value: number | string }) => (
    <div className="flex flex-col items-center justify-center bg-gray-800 rounded-xl border border-gray-700 p-4 gap-1">
        <span className="text-xl font-bold text-white">{value}</span>
        <span className="text-xs text-gray-400 text-center">{label}</span>
    </div>
);

interface ChipProps { label: string; color?: 'default' | 'blue' }
const Chip: React.FC<ChipProps> = ({ label, color = 'default' }) => (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
        color === 'blue'
            ? 'bg-blue-900/30 border-blue-700/50 text-blue-300'
            : 'bg-gray-800 border-gray-700 text-gray-300'
    }`}>
        {label}
    </span>
);

/* ─── main component ──────────────────────────────────────────────────────── */

const ProfilePage = () => {
    const { currentUser, userProfile, loading } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('Posts');
    const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [uploadingCover, setUploadingCover] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadError, setUploadError] = useState('');
    // Local preview URLs — shown instantly while upload is in-flight
    const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(null);
    const [localCoverUrl, setLocalCoverUrl]   = useState<string | null>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'profile' | 'cover') => {
        if (!e.target.files || !e.target.files[0] || !currentUser) return;
        const file = e.target.files[0];
        setUploadError('');
        setUploadProgress(0);

        if (type === 'profile') setUploadingAvatar(true);
        else setUploadingCover(true);

        // Instant local preview while upload runs
        const objectUrl = URL.createObjectURL(file);
        if (type === 'profile') setLocalAvatarUrl(objectUrl);
        else setLocalCoverUrl(objectUrl);

        try {
            /*
             * BUG FIX: Path must match storage.rules: /profileMedia/{userId}/{fileName}
             * Old path `users/{uid}/profile/…` had no matching rule → denied by catch-all.
             */
            const path = `profileMedia/${currentUser.uid}/${type}_${Date.now()}_${file.name}`;

            const uploadedFile = await uploadFile(path, file, {
                allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
                maxSizeBytes: 5 * 1024 * 1024,
                onProgress: progress => setUploadProgress(progress),
            });

            // Replace ephemeral object URL with the permanent Firebase URL
            if (type === 'profile') {
                await updateProfile(currentUser, { photoURL: uploadedFile.url });
                setLocalAvatarUrl(uploadedFile.url);
            } else {
                setLocalCoverUrl(uploadedFile.url);
            }

            // Write to Firestore — triggers subscribeUserProfile → AuthContext refresh
            const firestoreField = type === 'profile' ? 'photoURL' : 'coverPhotoURL';
            await updateDocument(COLLECTIONS.users, currentUser.uid, {
                [firestoreField]: uploadedFile.url,
            });

            // Persist updated completion score
            const pct = computeProfileCompletion({
                ...userProfile,
                [firestoreField]: uploadedFile.url,
            });
            await updateDocument(COLLECTIONS.users, currentUser.uid, { profileCompletion: pct });

        } catch (err: any) {
            // Revert preview on failure
            if (type === 'profile') setLocalAvatarUrl(null);
            else setLocalCoverUrl(null);
            setUploadError(getFriendlyErrorMessage(err));
        }

        if (type === 'profile') { setUploadingAvatar(false); }
        else { setUploadingCover(false); }
        setUploadProgress(0);
    };

    if (loading) return <ProfileSkeleton />;
    if (!currentUser) return <div className="p-4 text-white">User not found.</div>;

    // Local previews take precedence; then Firestore data from context
    const userAvatar    = localAvatarUrl || userProfile?.photoURL || currentUser?.photoURL || null;
    const coverImageUrl = localCoverUrl  || userProfile?.coverPhotoURL || null;

    const displayName = userProfile?.displayName || currentUser?.displayName || 'Anonymous User';
    const username    = userProfile?.username    || currentUser?.email?.split('@')[0] || '';
    const joinDate    = formatJoinDate(userProfile?.createdAt);

    // Completion — use centralized function
    const completion = computeProfileCompletion({
        displayName:   userProfile?.displayName,
        headline:      userProfile?.headline,
        bio:           userProfile?.bio,
        skills:        userProfile?.skills,
        interests:     userProfile?.interests,
        location:      (userProfile as any)?.location,
        website:       (userProfile as any)?.website,
        photoURL:      userAvatar,
        coverPhotoURL: coverImageUrl,
    });

    // Completion suggestions (max 4 shown)
    const suggestions: { label: string; key: string }[] = [
        { label: 'Add Headline',      key: 'headline'   },
        { label: 'Add Bio',           key: 'bio'        },
        { label: 'Add Skills',        key: 'skills'     },
        { label: 'Add Location',      key: 'location'   },
        { label: 'Add Website',       key: 'website'    },
        { label: 'Add Profile Photo', key: 'photoURL'   },
        { label: 'Add Cover Photo',   key: 'coverPhotoURL' },
    ].filter(s => {
        if (s.key === 'skills')        return !(userProfile?.skills?.length);
        if (s.key === 'photoURL')      return !userAvatar;
        if (s.key === 'coverPhotoURL') return !coverImageUrl;
        return !(userProfile as any)?.[s.key];
    }).slice(0, 4);

    return (
        <>
            {uploadError && (
                <p className="bg-red-900 text-white text-center p-3 rounded-md mb-3 text-sm">
                    {uploadError}
                </p>
            )}

            {/* ── Identity Block ─────────────────────────────────────────── */}
            <div className="bg-invox-dark-accent rounded-xl border border-gray-800 overflow-hidden mb-4">

                {/* Cover Photo */}
                <div className="relative group h-48">
                    <div
                        className="h-full w-full bg-gray-700 bg-cover bg-center cursor-zoom-in transition-opacity"
                        style={coverImageUrl ? { backgroundImage: `url(${coverImageUrl})` } : {}}
                        onClick={() => coverImageUrl && setZoomedImageUrl(coverImageUrl)}
                    >
                        {!coverImageUrl && (
                            <div className="h-full flex items-center justify-center">
                                <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>
                        )}
                    </div>

                    {/* Upload overlay */}
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <label className="cursor-pointer bg-gray-900/80 border border-gray-600 px-4 py-2 rounded-full text-sm font-semibold hover:bg-gray-800 transition-all flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {uploadingCover ? `Uploading ${uploadProgress}%` : 'Update Cover'}
                            <input
                                type="file"
                                className="hidden"
                                accept="image/jpeg,image/png,image/gif,image/webp"
                                onChange={e => handleFileUpload(e, 'cover')}
                                disabled={uploadingCover}
                            />
                        </label>
                    </div>

                    {/* Upload progress bar */}
                    {uploadingCover && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-800">
                            <div
                                className="h-full bg-invox-red transition-all"
                                style={{ width: `${uploadProgress}%` }}
                            />
                        </div>
                    )}
                </div>

                {/* Avatar + Actions Row */}
                <div className="px-5 pb-5">
                    <div className="flex justify-between items-end -mt-14 mb-4">

                        {/* Avatar */}
                        <div className="relative group">
                            <div
                                className="w-28 h-28 rounded-full border-4 border-invox-dark-accent bg-invox-dark-accent flex items-center justify-center cursor-zoom-in overflow-hidden"
                                onClick={() => { if (userAvatar) setZoomedImageUrl(userAvatar); }}
                            >
                                {userAvatar ? (
                                    <img src={userAvatar} onError={handleImageError} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <ProfileIcon className="w-16 h-16 text-gray-500" />
                                )}
                                {/* Uploading overlay */}
                                {uploadingAvatar && (
                                    <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
                                        <span className="text-white text-xs font-bold">{uploadProgress}%</span>
                                    </div>
                                )}
                                {/* Hover change overlay */}
                                {!uploadingAvatar && (
                                    <div className="absolute inset-0 bg-black/50 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <label className="cursor-pointer text-xs font-semibold text-center w-full h-full flex items-center justify-center">
                                            Change
                                            <input
                                                type="file"
                                                className="hidden"
                                                accept="image/jpeg,image/png,image/gif,image/webp"
                                                onChange={e => handleFileUpload(e, 'profile')}
                                                disabled={uploadingAvatar}
                                            />
                                        </label>
                                    </div>
                                )}
                            </div>
                            {/* Online indicator */}
                            <span className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-invox-dark-accent" />
                        </div>

                        {/* Edit Profile button */}
                        <div className="flex items-center gap-2 mt-1">
                            <button
                                onClick={() => navigate('/settings')}
                                className="flex items-center gap-2 border border-gray-600 px-4 py-2 rounded-full text-sm font-semibold hover:bg-gray-800 transition-all duration-200 hover:scale-105 active:scale-95"
                            >
                                <PencilIcon className="w-4 h-4" />
                                Edit Profile
                            </button>
                        </div>
                    </div>

                    {/* User Info */}
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">{displayName}</h1>
                        <p className="text-gray-400 text-sm mt-0.5">@{username}</p>

                        {userProfile?.headline && (
                            <p className="text-gray-200 font-medium mt-1.5">{userProfile.headline}</p>
                        )}

                        {/* Meta row */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-sm text-gray-400">
                            {(userProfile as any)?.location && (
                                <span className="flex items-center gap-1">
                                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    {(userProfile as any).location}
                                </span>
                            )}
                            {(userProfile as any)?.website && (
                                <a
                                    href={(userProfile as any).website.startsWith('http')
                                        ? (userProfile as any).website
                                        : `https://${(userProfile as any).website}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-invox-red-text hover:underline"
                                >
                                    <GlobeAltIcon className="w-4 h-4 flex-shrink-0" />
                                    {(userProfile as any).website.replace(/^https?:\/\//, '')}
                                </a>
                            )}
                            {(userProfile as any)?.portfolioURL && (
                                <a
                                    href={(userProfile as any).portfolioURL.startsWith('http')
                                        ? (userProfile as any).portfolioURL
                                        : `https://${(userProfile as any).portfolioURL}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-invox-blue hover:underline"
                                >
                                    <CometIcon className="w-4 h-4 flex-shrink-0" />
                                    Portfolio
                                </a>
                            )}
                            {joinDate && (
                                <span className="flex items-center gap-1">
                                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    Joined {joinDate}
                                </span>
                            )}
                        </div>

                        {/* Follower counts */}
                        <div className="flex gap-5 mt-3 text-sm">
                            <span className="text-gray-400">
                                <span className="font-bold text-white">{userProfile?.followingCount ?? 0}</span> Following
                            </span>
                            <span className="text-gray-400">
                                <span className="font-bold text-white">{userProfile?.followerCount ?? 0}</span> Followers
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Profile Completion Widget ─────────────────────────────── */}
            {completion < 100 && (
                <div className="bg-invox-dark-accent rounded-xl border border-gray-800 p-4 mb-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-white">Profile Completion</span>
                        <span className={`text-sm font-bold ${
                            completion >= 70 ? 'text-green-400' : completion >= 40 ? 'text-yellow-400' : 'text-invox-red-text'
                        }`}>
                            {completion}%
                        </span>
                    </div>
                    <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden mb-3">
                        <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                                width: `${completion}%`,
                                background: completion >= 70
                                    ? 'linear-gradient(90deg,#16a34a,#4ade80)'
                                    : completion >= 40
                                    ? 'linear-gradient(90deg,#ca8a04,#facc15)'
                                    : 'linear-gradient(90deg,#E50914,#FF4747)',
                            }}
                        />
                    </div>
                    {suggestions.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            <span className="text-xs text-gray-500 w-full">Suggested:</span>
                            {suggestions.map(s => (
                                <button
                                    key={s.key}
                                    onClick={() => navigate('/settings')}
                                    className="text-xs px-3 py-1.5 rounded-full border border-gray-700 bg-gray-800 text-gray-300 hover:border-invox-red hover:text-white transition-all duration-150"
                                >
                                    + {s.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── About + Stats ─────────────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                {/* About */}
                <div className="md:col-span-3 bg-invox-dark-accent rounded-xl border border-gray-800 p-5">
                    <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">About</h2>
                    {userProfile?.bio ? (
                        <p className="text-gray-200 leading-relaxed text-sm whitespace-pre-line">{userProfile.bio}</p>
                    ) : (
                        <p className="text-gray-500 italic text-sm leading-relaxed">
                            Tell the Invox community about your expertise, interests, projects, and goals.
                        </p>
                    )}
                    {!userProfile?.bio && (
                        <button onClick={() => navigate('/settings')} className="mt-3 text-xs text-invox-red-text hover:underline">
                            + Add bio
                        </button>
                    )}
                </div>

                {/* Stats */}
                <div className="md:col-span-2 grid grid-cols-2 gap-3">
                    <StatCard label="Projects Published"  value={0} />
                    <StatCard label="Knowledge Posts"     value={0} />
                    <StatCard label="Communities Joined"  value={0} />
                    <StatCard label="Collaborations"      value={0} />
                </div>
            </div>

            {/* ── Skills & Interests ────────────────────────────────────── */}
            {((userProfile?.skills?.length ?? 0) > 0 || (userProfile?.interests?.length ?? 0) > 0) ? (
                <div className="bg-invox-dark-accent rounded-xl border border-gray-800 p-5 mb-4">
                    {(userProfile?.skills?.length ?? 0) > 0 && (
                        <div className="mb-4">
                            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Skills</h2>
                            <div className="flex flex-wrap gap-2">
                                {userProfile!.skills.map((skill, idx) => <Chip key={idx} label={skill} />)}
                            </div>
                        </div>
                    )}
                    {(userProfile?.interests?.length ?? 0) > 0 && (
                        <div>
                            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Interests</h2>
                            <div className="flex flex-wrap gap-2">
                                {userProfile!.interests.map((interest, idx) => <Chip key={idx} label={interest} color="blue" />)}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-invox-dark-accent rounded-xl border border-gray-800 p-5 mb-4">
                    <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Skills & Interests</h2>
                    <p className="text-gray-500 italic text-sm">No skills or interests added yet.</p>
                    <button onClick={() => navigate('/settings')} className="mt-2 text-xs text-invox-red-text hover:underline">
                        + Add skills & interests
                    </button>
                </div>
            )}

            {/* ── Activity Tabs ──────────────────────────────────────────── */}
            <div className="bg-invox-dark-accent rounded-xl border border-gray-800 overflow-hidden">
                <div className="border-b border-gray-800">
                    <nav className="flex px-4 gap-1">
                        {['Posts', 'Replies', 'Media', 'Likes'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`py-3.5 px-4 text-sm font-semibold border-b-2 transition-all duration-200 hover:-translate-y-px ${
                                    activeTab === tab
                                        ? 'border-invox-red text-white'
                                        : 'border-transparent text-gray-400 hover:text-white'
                                }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="p-6 min-h-[220px]">
                    <div className="flex flex-col items-center justify-center text-center py-12">
                        <div className="w-14 h-14 rounded-2xl bg-gray-800 flex items-center justify-center mb-4">
                            <svg className="w-7 h-7 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-bold text-white mb-1">No {activeTab} Yet</h3>
                        <p className="text-gray-400 text-sm max-w-xs leading-relaxed">
                            {activeTab === 'Posts'
                                ? 'Share knowledge, projects, and ideas with the community. Publish your first contribution and begin building your professional presence.'
                                : `When you create ${activeTab.toLowerCase()}, they'll appear here.`
                            }
                        </p>
                    </div>
                </div>
            </div>

            <ImageZoomModal
                isOpen={!!zoomedImageUrl}
                onClose={() => setZoomedImageUrl(null)}
                imageUrl={zoomedImageUrl || ''}
            />
        </>
    );
};

export default ProfilePage;
