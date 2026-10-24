import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ProfileIcon, PencilIcon, GlobeAltIcon, CometIcon } from '../components/ui/Icons';
import ProfileSkeleton from '../components/profile/ProfileSkeleton';
import { handleImageError } from '../components/utils/imageUtils';
import ImageZoomModal from '../components/ui/ImageZoomModal';
import { useNavigate, useParams, useLocation, useOutletContext } from 'react-router-dom';
import { uploadFile } from '../services/storageService';
import { COLLECTIONS, updateDocument } from '../services/firestoreService';
import { getFriendlyErrorMessage } from '../utils/errorHandler';
import { updateUserAuthProfile, subscribeUserProfile } from '../services/authService';
import { subscribeConnectionStatus, connectWithUser, disconnectFromUser, subscribeUserRelationships } from '../services/connectionService';
import { ConnectionsListModal, type RelationshipTab } from '../components/profile/ConnectionsListModal';
import { computeProfileCompletion } from './Settings';
import type { InvoxUser } from '../types';

import { resolveUsernameToUid, normalizeUsername } from '../services/usernameService';
import { getFallbackUserProfile, fetchDiscoverableProfiles, getSimilarProfiles, type DiscoverableProfile } from '../services/profileService';
import { ProfileSuggestionCard } from '../components/spotlight/ProfileSuggestionCard';

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
    <div className="flex flex-col items-center justify-center bg-[#09090b] border border-zinc-800/90 p-3.5 gap-1 font-mono hover:border-zinc-700 transition-colors">
        <span className="text-xl font-bold text-white tracking-tight">{value}</span>
        <span className="text-[10px] text-zinc-500 uppercase tracking-widest text-center">{label}</span>
    </div>
);

interface ChipProps { label: string; color?: 'default' | 'blue' }
const Chip: React.FC<ChipProps> = ({ label, color = 'default' }) => (
    <span className={`inline-flex items-center px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider border transition-colors ${
        color === 'blue'
            ? 'bg-[#121826] border-blue-900/60 text-blue-400'
            : 'bg-[#18181d] border-zinc-800 text-zinc-300'
    }`}>
        {label}
    </span>
);

/* ─── main component ──────────────────────────────────────────────────────── */

const ProfilePage = () => {
    const { currentUser, userProfile, loading } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { userId } = useParams<{ userId?: string }>();
    
    // Outlet context for preserving Spotlight Browse Profiles sidebar
    const outletContext = useOutletContext<{
        setRightSidebarVariant?: (variant: string) => void;
        setSpotlightBrowseState?: (state: string | null) => void;
        setSpotlightIsBrowsing?: (value: boolean) => void;
    } | null>() ?? {};
    const { setRightSidebarVariant, setSpotlightBrowseState, setSpotlightIsBrowsing } = outletContext;

    const isFromBrowseProfiles = useMemo(() => {
        const search = new URLSearchParams(location.search);
        return search.get('browse') === 'profiles' || 
               search.get('from') === 'browse-profiles' || 
               (location.state as any)?.fromBrowse === 'profiles';
    }, [location.search, location.state]);

    const cameFromCollabs = useMemo(() => {
        const search = new URLSearchParams(location.search);
        return search.get('tab') === 'Collabs' || (location.state as any)?.fromTab === 'Collabs';
    }, [location.search, location.state]);

    // Preserve Browse Profiles sidebar panel while this page is mounted, context-aware of Showcase vs Collabs
    useEffect(() => {
        if (!isFromBrowseProfiles) return;
        const isCollabContext = cameFromCollabs;
        setRightSidebarVariant?.(isCollabContext ? 'spotlight-collabs' : 'spotlight-showcase');
        setSpotlightBrowseState?.('profiles');
        setSpotlightIsBrowsing?.(true);
        return () => {
            setRightSidebarVariant?.('default');
            setSpotlightBrowseState?.(null);
            setSpotlightIsBrowsing?.(false);
        };
    }, [isFromBrowseProfiles, cameFromCollabs, setRightSidebarVariant, setSpotlightBrowseState, setSpotlightIsBrowsing]);

    const [resolvedUid, setResolvedUid] = useState<string | null>(null);

    // Check if the param points to the logged-in user either by UID, raw username, or resolved UID
    const isOwnProfile = !userId || Boolean(
        currentUser && (
            userId === currentUser.uid ||
            (userProfile?.username && normalizeUsername(userProfile.username) === normalizeUsername(userId)) ||
            (resolvedUid && resolvedUid === currentUser.uid)
        )
    );
    const [targetProfile, setTargetProfile] = useState<InvoxUser | null>(null);
    const [targetLoading, setTargetLoading] = useState<boolean>(!isOwnProfile);
    const [targetError, setTargetError] = useState<string | null>(null);

    const [activeTab, setActiveTab] = useState('Posts');
    const profileTabs = ['Posts', 'Replies', 'Media', 'Likes'];
    const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [uploadingCover, setUploadingCover] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadError, setUploadError] = useState('');
    // Local preview URLs — shown instantly while upload is in-flight
    const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(null);
    const [localCoverUrl,  setLocalCoverUrl]  = useState<string | null>(null);

    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);

    // Relationship counts & modal state (Following, Followers, Connections)
    const [relationshipCounts, setRelationshipCounts] = useState<{
        followingCount: number;
        followerCount: number;
        connectionCount: number;
    }>({
        followingCount: 0,
        followerCount: 0,
        connectionCount: 0,
    });
    const [isConnectionsModalOpen, setIsConnectionsModalOpen] = useState(false);
    const [connectionsModalTab, setConnectionsModalTab] = useState<RelationshipTab>('connections');

    const handleOpenConnectionsModal = (tab: RelationshipTab) => {
        setConnectionsModalTab(tab);
        setIsConnectionsModalOpen(true);
    };

    // Similar Profiles state
    const [allDiscoverableProfiles, setAllDiscoverableProfiles] = useState<DiscoverableProfile[]>([]);
    const [similarProfiles, setSimilarProfiles] = useState<DiscoverableProfile[]>([]);
    const [similarLoading, setSimilarLoading] = useState<boolean>(true);

    // Resolve username to UID if param is not already own profile
    useEffect(() => {
        let isMounted = true;
        if (isOwnProfile || !userId) {
            setResolvedUid(currentUser?.uid || null);
            return;
        }

        const resolveTarget = async () => {
            setTargetLoading(true);
            setTargetError(null);
            try {
                // If starts with @ or is a username
                const candidateUid = await resolveUsernameToUid(userId);
                if (isMounted) {
                    if (candidateUid) {
                        setResolvedUid(candidateUid);
                    } else {
                        // Fall back to assuming userId is directly a Firebase Auth UID
                        setResolvedUid(userId);
                    }
                }
            } catch (err) {
                if (isMounted) setResolvedUid(userId);
            }
        };

        resolveTarget();
        return () => { isMounted = false; };
    }, [userId, isOwnProfile, currentUser?.uid]);

    useEffect(() => {
        const effectiveTargetUid = resolvedUid;
        if (isOwnProfile || !effectiveTargetUid || !currentUser?.uid) return;
        const unsub = subscribeConnectionStatus(currentUser.uid, effectiveTargetUid, (status) => {
            setIsConnected(status.isConnected);
        });
        return () => {
            unsub();
        };
    }, [isOwnProfile, resolvedUid, currentUser?.uid]);

    const effectiveProfileUid = isOwnProfile ? currentUser?.uid : (resolvedUid || targetProfile?.uid);

    // Real-time listener for relationship counts (Following, Followers, Connections)
    useEffect(() => {
        if (!effectiveProfileUid) return;

        const unsubscribe = subscribeUserRelationships(
            effectiveProfileUid,
            (rel) => {
                setRelationshipCounts({
                    followingCount: rel.followingCount,
                    followerCount: rel.followerCount,
                    connectionCount: rel.connectionCount,
                });
            },
            (err) => {
                console.error('[PROFILE_RELATIONSHIPS_SUBSCRIBE_ERROR]', err);
            }
        );

        return () => {
            unsubscribe();
        };
    }, [effectiveProfileUid]);

    // Fetch all discoverable profiles
    useEffect(() => {
        let isMounted = true;
        fetchDiscoverableProfiles()
            .then(profiles => {
                if (isMounted) {
                    setAllDiscoverableProfiles(profiles);
                }
            })
            .catch(err => {
                console.warn('[SIMILAR_PROFILES_LOAD_WARN]', err);
                if (isMounted) setSimilarLoading(false);
            });
        return () => { isMounted = false; };
    }, []);

    // Recompute similar profiles whenever the active profile or target user changes
    useEffect(() => {
        if (allDiscoverableProfiles.length === 0) return;
        setSimilarLoading(true);

        const currentActive = isOwnProfile ? userProfile : targetProfile;
        const recommendations = getSimilarProfiles(
            currentActive,
            allDiscoverableProfiles,
            userId || resolvedUid || undefined,
            3
        );

        setSimilarProfiles(recommendations);
        setSimilarLoading(false);
    }, [isOwnProfile, userProfile, targetProfile, allDiscoverableProfiles, userId, resolvedUid]);

    // Scroll to top on navigation to a new profile
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [userId]);

    const handleToggleConnect = async () => {
        const effectiveTargetUid = resolvedUid || targetProfile?.uid;
        if (!currentUser || isOwnProfile || !effectiveTargetUid || isConnecting) return;
        setIsConnecting(true);
        try {
            if (isConnected) {
                await disconnectFromUser(currentUser.uid, effectiveTargetUid);
            } else {
                await connectWithUser({
                    currentUser,
                    currentUserProfile: userProfile,
                    targetUserId: effectiveTargetUid,
                });
            }
        } catch (e) {
            console.error('Connection error', e);
        } finally {
            setIsConnecting(false);
        }
    };

    useEffect(() => {
        if (isOwnProfile || !resolvedUid) {
            if (isOwnProfile) {
                setTargetProfile(null);
                setTargetLoading(false);
                setTargetError(null);
            }
            return;
        }

        setTargetLoading(true);
        setTargetError(null);

        const unsubscribe = subscribeUserProfile(
            resolvedUid,
            (profile) => {
                if (profile) {
                    setTargetProfile(profile);
                    setTargetError(null);
                } else {
                    const fallback = getFallbackUserProfile(resolvedUid) || (userId ? getFallbackUserProfile(userId) : null);
                    if (fallback) {
                        setTargetProfile(fallback);
                        setTargetError(null);
                    } else {
                        setTargetProfile(null);
                        setTargetError('The requested INVOX profile does not exist.');
                    }
                }
                setTargetLoading(false);
            },
            (err) => {
                console.error('[PROFILE_SUBSCRIBE_ERROR] Failed to load user profile:', err);
                const fallback = getFallbackUserProfile(resolvedUid) || (userId ? getFallbackUserProfile(userId) : null);
                if (fallback) {
                    setTargetProfile(fallback);
                    setTargetError(null);
                } else {
                    setTargetError('Unable to load user profile.');
                }
                setTargetLoading(false);
            }
        );

        return () => {
            unsubscribe();
        };
    }, [resolvedUid, isOwnProfile, userId]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'profile' | 'cover') => {
        if (!e.target.files || !e.target.files[0] || !currentUser || !isOwnProfile) return;
        const file = e.target.files[0];
        setUploadError('');
        setUploadProgress(0);

        if (type === 'profile') setUploadingAvatar(true);
        else setUploadingCover(true);

        // Instant local preview while upload runs
        const objectUrl = URL.createObjectURL(file);
        if (type === 'profile') setLocalAvatarUrl(objectUrl);
        else setLocalCoverUrl(objectUrl);

        const logTag = type === 'profile' ? '[AVATAR_UPLOAD]' : '[COVER_UPLOAD]';

        try {
            // Storage path: /profileMedia/{userId}/{fileName}
            // Auth gate: userId path segment == request.auth.uid (enforced by storage.rules)
            const path = `profileMedia/${currentUser.uid}/${type}_${Date.now()}_${file.name}`;
            console.log(`${logTag} Starting upload. Path: ${path}`);

            const uploadedFile = await uploadFile(path, file, {
                allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
                maxSizeBytes: 5 * 1024 * 1024,
                onProgress: progress => setUploadProgress(progress),
            });

            console.log(`${logTag} Upload success. URL: ${uploadedFile.url}`);

            // Replace ephemeral blob URL with the permanent Firebase Storage URL
            if (type === 'profile') {
                await updateUserAuthProfile(currentUser, { photoURL: uploadedFile.url });
                setLocalAvatarUrl(uploadedFile.url);
            } else {
                setLocalCoverUrl(uploadedFile.url);
            }

            // Write to Firestore — triggers subscribeUserProfile → AuthContext refresh
            const firestoreField = type === 'profile' ? 'photoURL' : 'coverPhotoURL';
            console.log(`${logTag} [FIRESTORE_WRITE] users/${currentUser.uid} → { ${firestoreField}: "${uploadedFile.url}" }`);
            await updateDocument(COLLECTIONS.users, currentUser.uid, {
                [firestoreField]: uploadedFile.url,
            });
            console.log(`${logTag} [PROFILE_SAVE_SUCCESS] Firestore updated: ${firestoreField}`);

            // Recompute and persist profile completion score
            const pct = computeProfileCompletion({
                ...userProfile,
                [firestoreField]: uploadedFile.url,
            });
            await updateDocument(COLLECTIONS.users, currentUser.uid, { profileCompletion: pct });

        } catch (err: any) {
            // Revert optimistic preview on failure
            console.error(`${logTag} [PROFILE_SAVE_ERROR] Upload/save failed:`, err);
            if (type === 'profile') setLocalAvatarUrl(null);
            else setLocalCoverUrl(null);
            setUploadError(getFriendlyErrorMessage(err));
        }

        if (type === 'profile') { setUploadingAvatar(false); }
        else { setUploadingCover(false); }
        setUploadProgress(0);
    };

    if (isOwnProfile && loading) return <ProfileSkeleton />;
    if (!isOwnProfile && targetLoading) return <ProfileSkeleton />;
    if (isOwnProfile && !currentUser) return <div className="p-4 font-mono text-xs text-white">User not found.</div>;
    if (!isOwnProfile && (!targetProfile || targetError)) {
        return (
            <div className="font-mono text-zinc-300 p-6 bg-[#0c0c0e] border border-zinc-800">
                <button
                    onClick={() => navigate(-1)}
                    className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 bg-black hover:bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white text-xs uppercase tracking-wider transition-colors"
                >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    <span>// BACK</span>
                </button>
                <div className="p-8 text-center space-y-2">
                    <p className="text-sm font-bold text-white uppercase tracking-wider">// USER_PROFILE_NOT_FOUND</p>
                    <p className="text-xs text-zinc-500">The requested INVOX user profile does not exist or has been removed.</p>
                </div>
            </div>
        );
    }

    const activeProfile = isOwnProfile ? userProfile : targetProfile;

    // Local previews take precedence for owner; then Firestore data
    const userAvatar = isOwnProfile
        ? (localAvatarUrl || userProfile?.photoURL || currentUser?.photoURL || null)
        : (targetProfile?.photoURL || null);

    const coverImageUrl = isOwnProfile
        ? (localCoverUrl || userProfile?.coverPhotoURL || null)
        : (targetProfile?.coverPhotoURL || null);

    const displayName = activeProfile?.displayName || (isOwnProfile ? currentUser?.displayName : '') || 'Invox Member';
    const username = activeProfile?.username || (isOwnProfile ? currentUser?.email?.split('@')[0] : '') || 'member';
    const joinDate = formatJoinDate(activeProfile?.createdAt);

    // Completion — use centralized function (only evaluated for owner)
    const completion = computeProfileCompletion({
        displayName:   activeProfile?.displayName,
        headline:      activeProfile?.headline,
        bio:           activeProfile?.bio,
        skills:        activeProfile?.skills,
        interests:     activeProfile?.interests,
        location:      (activeProfile as any)?.location,
        website:       (activeProfile as any)?.website,
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
        if (s.key === 'skills')        return !(activeProfile?.skills?.length);
        if (s.key === 'photoURL')      return !userAvatar;
        if (s.key === 'coverPhotoURL') return !coverImageUrl;
        return !(activeProfile as any)?.[s.key];
    }).slice(0, 4);

    return (
        <div className="font-mono text-zinc-300">
            {!isOwnProfile && (
                <div className={`flex items-center ${isFromBrowseProfiles ? 'justify-end' : 'justify-between'} mb-3`}>
                    {!isFromBrowseProfiles && (
                        <button
                            onClick={() => navigate(-1)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#0c0c0e] hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white font-mono text-xs uppercase tracking-wider transition-colors"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            <span>// BACK</span>
                        </button>
                    )}
                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest border border-zinc-800/80 px-2.5 py-1 bg-black">
                        // INVOX_MEMBER_PROFILE
                    </span>
                </div>
            )}

            {uploadError && isOwnProfile && (
                <p className="bg-red-950/80 border border-red-800 text-red-200 text-center p-3 mb-3 text-xs uppercase tracking-wider font-mono">
                    {uploadError}
                </p>
            )}

            {/* ── Identity Block ─────────────────────────────────────────── */}
            <div className="bg-[#0c0c0e] border border-zinc-800/90 overflow-hidden mb-4">

                {/* Cover Photo */}
                <div className="relative group h-48 border-b border-zinc-800">
                    <div
                        className={`h-full w-full bg-zinc-900 bg-cover bg-center ${coverImageUrl ? 'cursor-zoom-in' : ''} transition-opacity`}
                        style={coverImageUrl ? { backgroundImage: `url(${coverImageUrl})` } : {}}
                        onClick={() => coverImageUrl && setZoomedImageUrl(coverImageUrl)}
                    >
                        {!coverImageUrl && (
                            <div className="h-full flex items-center justify-center">
                                <svg className="w-10 h-10 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>
                        )}
                    </div>

                    {/* Upload overlay only for owner */}
                    {isOwnProfile && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <label className="cursor-pointer bg-zinc-900 border border-zinc-700 px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider text-white hover:bg-zinc-800 transition-all flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                {uploadingCover ? `Uploading ${uploadProgress}%` : '// UPDATE_COVER'}
                                <input
                                    type="file"
                                    className="hidden"
                                    accept="image/jpeg,image/png,image/gif,image/webp"
                                    onChange={e => handleFileUpload(e, 'cover')}
                                    disabled={uploadingCover}
                                />
                            </label>
                        </div>
                    )}

                    {/* Upload progress bar */}
                    {isOwnProfile && uploadingCover && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-800">
                            <div
                                className="h-full bg-white transition-all"
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
                                className={`w-28 h-28 border-4 border-[#0c0c0e] bg-zinc-900 flex items-center justify-center ${userAvatar ? 'cursor-zoom-in' : ''} overflow-hidden`}
                                onClick={() => { if (userAvatar) setZoomedImageUrl(userAvatar); }}
                            >
                                {userAvatar ? (
                                    <img src={userAvatar} onError={handleImageError} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <ProfileIcon className="w-16 h-16 text-zinc-600" />
                                )}
                                {/* Uploading overlay */}
                                {isOwnProfile && uploadingAvatar && (
                                    <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                                        <span className="text-white text-xs font-bold">{uploadProgress}%</span>
                                    </div>
                                )}
                                {/* Hover change overlay */}
                                {isOwnProfile && !uploadingAvatar && (
                                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <label className="cursor-pointer text-[10px] font-mono uppercase tracking-wider text-center w-full h-full flex items-center justify-center text-white">
                                            // CHANGE
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
                            <span className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-[#0c0c0e]" />
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 mt-1">
                            {isOwnProfile ? (
                                <button
                                    onClick={() => navigate('/settings')}
                                    className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 hover:border-zinc-500 text-white px-4 py-2 font-mono text-xs uppercase tracking-wider transition-colors font-bold"
                                >
                                    <PencilIcon className="w-3.5 h-3.5" />
                                    <span>// EDIT_PROFILE</span>
                                </button>
                            ) : (
                                <button
                                    onClick={handleToggleConnect}
                                    disabled={isConnecting}
                                    className={`flex items-center gap-2 px-3.5 py-1.5 font-mono text-xs uppercase tracking-wider transition-colors font-bold border ${
                                        isConnected
                                            ? 'bg-emerald-950/40 text-emerald-300 border-emerald-700/80 hover:bg-rose-950/30 hover:text-rose-300 hover:border-rose-800'
                                            : 'bg-white text-black hover:bg-zinc-200 border-white'
                                    }`}
                                >
                                    {isConnecting
                                        ? '// SYNCING...'
                                        : isConnected
                                            ? '✓ CONNECTED // COMRADE'
                                            : '+ CONNECT // COMRADE'}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* User Info */}
                    <div>
                        <h1 className="text-xl font-bold font-mono text-white tracking-tight">{displayName}</h1>
                        <p className="text-zinc-500 text-xs font-mono mt-0.5">@{username}</p>

                        {activeProfile?.headline && (
                            <p className="text-zinc-300 font-mono text-xs mt-2">{activeProfile.headline}</p>
                        )}

                        {/* Meta row */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-xs text-zinc-400 font-mono">
                            {(activeProfile as any)?.location && (
                                <span className="flex items-center gap-1.5">
                                    <svg className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    {(activeProfile as any).location}
                                </span>
                            )}
                            {(activeProfile as any)?.website && (
                                <a
                                    href={(activeProfile as any).website.startsWith('http')
                                        ? (activeProfile as any).website
                                        : `https://${(activeProfile as any).website}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 text-zinc-300 hover:text-white hover:underline"
                                >
                                    <GlobeAltIcon className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                                    {(activeProfile as any).website.replace(/^https?:\/\//, '')}
                                </a>
                            )}
                            {(activeProfile as any)?.portfolioURL && (
                                <a
                                    href={(activeProfile as any).portfolioURL.startsWith('http')
                                        ? (activeProfile as any).portfolioURL
                                        : `https://${(activeProfile as any).portfolioURL}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 text-zinc-300 hover:text-white hover:underline"
                                >
                                    <CometIcon className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                                    Portfolio
                                </a>
                            )}
                            {joinDate && (
                                <span className="flex items-center gap-1.5 text-zinc-500">
                                    <svg className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    Joined {joinDate}
                                </span>
                            )}
                        </div>

                        {/* Relationship counts: Following, Followers, Connections */}
                        <div className="flex flex-wrap items-center gap-5 mt-3 text-xs font-mono">
                            <button
                                type="button"
                                onClick={() => handleOpenConnectionsModal('following')}
                                className="text-zinc-400 hover:text-white transition-colors cursor-pointer text-left group"
                            >
                                <span className="font-bold text-white group-hover:underline">
                                    {relationshipCounts.followingCount ?? activeProfile?.followingCount ?? 0}
                                </span> Following
                            </button>
                            <button
                                type="button"
                                onClick={() => handleOpenConnectionsModal('followers')}
                                className="text-zinc-400 hover:text-white transition-colors cursor-pointer text-left group"
                            >
                                <span className="font-bold text-white group-hover:underline">
                                    {relationshipCounts.followerCount ?? activeProfile?.followerCount ?? 0}
                                </span> Followers
                            </button>
                            <button
                                type="button"
                                onClick={() => handleOpenConnectionsModal('connections')}
                                className="text-zinc-400 hover:text-emerald-400 transition-colors cursor-pointer text-left group flex items-center gap-1.5"
                            >
                                <span className="font-bold text-emerald-400 group-hover:underline">
                                    {relationshipCounts.connectionCount ?? activeProfile?.connectionCount ?? 0}
                                </span>
                                <span className="text-zinc-300 group-hover:text-emerald-300">Connections</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Profile Completion Widget ─────────────────────────────── */}
            {completion < 100 && (
                <div className="bg-[#0c0c0e] border border-zinc-800/90 p-4 mb-4 font-mono">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-white uppercase tracking-wider">// PROFILE_COMPLETION</span>
                        <span className={`text-xs font-bold ${
                            completion >= 70 ? 'text-emerald-400' : completion >= 40 ? 'text-amber-400' : 'text-zinc-400'
                        }`}>
                            {completion}%
                        </span>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-900 border border-zinc-800 mb-3">
                        <div
                            className={`h-full transition-all duration-700 ${
                                completion >= 70 ? 'bg-emerald-500' : completion >= 40 ? 'bg-amber-500' : 'bg-zinc-400'
                            }`}
                            style={{ width: `${completion}%` }}
                        />
                    </div>
                    {suggestions.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] text-zinc-500 uppercase tracking-wider">Suggested:</span>
                            {suggestions.map(s => (
                                <button
                                    key={s.key}
                                    onClick={() => navigate('/settings')}
                                    className="text-[11px] px-2.5 py-1 border border-zinc-800 bg-[#18181d] text-zinc-300 hover:border-zinc-600 hover:text-white transition-all uppercase tracking-wider"
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
                <div className="md:col-span-3 bg-[#0c0c0e] border border-zinc-800/90 p-5 font-mono">
                    <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">// ABOUT</h2>
                    {activeProfile?.bio ? (
                        <p className="text-zinc-300 leading-relaxed text-xs whitespace-pre-line">{activeProfile.bio}</p>
                    ) : (
                        <p className="text-zinc-600 italic text-xs leading-relaxed">
                            {isOwnProfile
                                ? 'Tell the community about your expertise, interests, projects, and goals.'
                                : 'No bio provided yet.'}
                        </p>
                    )}
                    {isOwnProfile && !activeProfile?.bio && (
                        <button onClick={() => navigate('/settings')} className="mt-3 text-xs text-zinc-400 hover:text-white uppercase tracking-wider transition-colors">
                            + Add bio
                        </button>
                    )}
                </div>

                {/* Stats */}
                <div className="md:col-span-2 grid grid-cols-2 gap-2.5">
                    <StatCard label="Projects Published"  value={0} />
                    <StatCard label="Knowledge Posts"     value={0} />
                    <StatCard label="Communities Joined"  value={0} />
                    <StatCard label="Collaborations"      value={0} />
                </div>
            </div>

            {/* ── Skills & Interests ────────────────────────────────────── */}
            {((activeProfile?.skills?.length ?? 0) > 0 || (activeProfile?.interests?.length ?? 0) > 0) ? (
                <div className="bg-[#0c0c0e] border border-zinc-800/90 p-5 mb-4 font-mono">
                    {(activeProfile?.skills?.length ?? 0) > 0 && (
                        <div className="mb-4">
                            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">// SKILLS</h2>
                            <div className="flex flex-wrap gap-2">
                                {activeProfile!.skills.map((skill, idx) => <Chip key={idx} label={skill} />)}
                            </div>
                        </div>
                    )}
                    {(activeProfile?.interests?.length ?? 0) > 0 && (
                        <div>
                            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">// INTERESTS</h2>
                            <div className="flex flex-wrap gap-2">
                                {activeProfile!.interests.map((interest, idx) => <Chip key={idx} label={interest} color="blue" />)}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-[#0c0c0e] border border-zinc-800/90 p-5 mb-4 font-mono">
                    <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">// SKILLS & INTERESTS</h2>
                    <p className="text-zinc-600 italic text-xs mb-3">No skills or interests added yet.</p>
                    {isOwnProfile && (
                        <button onClick={() => navigate('/settings')} className="text-xs text-zinc-400 hover:text-white uppercase tracking-wider transition-colors">
                            + Add skills & interests
                        </button>
                    )}
                </div>
            )}

            {/* ── Activity Tabs (Segmented Slide Bar) ───────────────────────── */}
            <div className="w-full bg-[#09090b] border border-zinc-800/90 p-1 grid grid-cols-4 gap-1 mb-4">
                {profileTabs.map(tab => {
                    const isActive = activeTab === tab;
                    return (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`py-2 px-1 sm:px-3 text-center font-mono text-xs uppercase tracking-wider transition-all duration-150 flex items-center justify-center ${
                                isActive
                                    ? 'bg-[#18181b] border border-zinc-700 text-white font-bold shadow-sm'
                                    : 'bg-transparent border border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30'
                            }`}
                        >
                            <span>{tab}</span>
                        </button>
                    );
                })}
            </div>

            {/* ── Activity Tab Content ─────────────────────────────────────── */}
            <div className="bg-[#0c0c0e] border border-zinc-800/90 p-6 min-h-[220px]">
                <div className="flex flex-col items-center justify-center text-center py-12">
                    <div className="w-12 h-12 bg-black border border-zinc-800 flex items-center justify-center mb-3 text-zinc-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider mb-1">// NO_{activeTab.toUpperCase()}_FOUND</h3>
                    <p className="text-zinc-500 text-xs font-mono max-w-sm leading-relaxed">
                        {isOwnProfile ? (
                            activeTab === 'Posts'
                                ? 'Share knowledge, projects, and ideas with the community. Publish your first contribution and begin building your presence.'
                                : `When you create ${activeTab.toLowerCase()}, they will appear here in your activity log.`
                        ) : (
                            `No ${activeTab.toLowerCase()} published by this member yet.`
                        )}
                    </p>
                </div>
            </div>

            {/* ── Similar Profiles Section ─────────────────────────────────── */}
            <div className="mt-8 pt-6 border-t border-zinc-800/90 font-mono">
                <div className="mb-4">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest block leading-none mb-1">
                        // DISCOVER_CREATORS
                    </span>
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                        // SIMILAR_PROFILES
                    </h2>
                    <p className="text-xs text-zinc-400 mt-1 font-mono">
                        Discover more people with similar interests and skills.
                    </p>
                </div>

                {similarLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="bg-[#0c0c0e] border border-zinc-800 p-4 min-h-48 animate-pulse flex flex-col justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-zinc-800 flex-shrink-0" />
                                    <div className="space-y-1.5 flex-1 min-w-0">
                                        <div className="h-4 bg-zinc-800 w-1/2" />
                                        <div className="h-3 bg-zinc-800 w-1/3" />
                                    </div>
                                </div>
                                <div className="space-y-1.5 my-3">
                                    <div className="h-3 bg-zinc-800 w-3/4" />
                                    <div className="h-3 bg-zinc-800 w-1/2" />
                                </div>
                                <div className="border-t border-zinc-800 pt-3 flex justify-between">
                                    <div className="h-3 bg-zinc-800 w-16" />
                                    <div className="h-3 bg-zinc-800 w-16" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : similarProfiles.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {similarProfiles.map(p => (
                            <ProfileSuggestionCard 
                                key={p.id} 
                                profile={p} 
                                fromTab={isFromBrowseProfiles ? (cameFromCollabs ? 'Collabs' : 'Showcase') : undefined}
                                fromBrowse={isFromBrowseProfiles ? 'profiles' : undefined}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="bg-[#0c0c0e] border border-zinc-800 p-8 text-center text-zinc-500 text-xs">
                        // NO_SIMILAR_PROFILES_FOUND
                    </div>
                )}
            </div>

            {effectiveProfileUid && (
                <ConnectionsListModal
                    isOpen={isConnectionsModalOpen}
                    onClose={() => setIsConnectionsModalOpen(false)}
                    targetUserId={effectiveProfileUid}
                    targetUserName={displayName}
                    initialTab={connectionsModalTab}
                />
            )}

            <ImageZoomModal
                isOpen={!!zoomedImageUrl}
                onClose={() => setZoomedImageUrl(null)}
                imageUrl={zoomedImageUrl || ''}
            />
        </div>
    );
};

export default ProfilePage;
