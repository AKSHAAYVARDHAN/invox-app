
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ProfileIcon, PencilIcon } from '../components/ui/Icons';
import ProfileSkeleton from '../components/profile/ProfileSkeleton';
import { handleImageError } from '../components/utils/imageUtils';
import ImageZoomModal from '../components/ui/ImageZoomModal';
import { useNavigate } from 'react-router-dom';
import { getStoragePath, uploadFile } from '../services/storageService';
import { COLLECTIONS, updateDocument } from '../services/firestoreService';
import { getFriendlyErrorMessage } from '../utils/errorHandler';
import { updateProfile } from 'firebase/auth';

const ProfilePage = () => {
    const { currentUser, userProfile, loading } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('Posts');
    const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [uploadingCover, setUploadingCover] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadError, setUploadError] = useState('');
    
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'profile' | 'cover') => {
        if (!e.target.files || !e.target.files[0] || !currentUser) return;
        const file = e.target.files[0];
        setUploadError('');
        setUploadProgress(0);
        
        console.log(`[Upload] Starting upload for ${type}`);
        console.log(`[Upload] File details: ${file.name} (${file.size} bytes)`);

        if (type === 'profile') setUploadingAvatar(true);
        else setUploadingCover(true);

        try {
            const path = `users/${currentUser.uid}/${type}/${Date.now()}_${file.name}`;
            console.log(`[Upload] Storage path generated: ${path}`);

            const uploadedFile = await uploadFile(path, file, {
                allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
                maxSizeBytes: 5 * 1024 * 1024, // 5MB limit
                onProgress: (progress) => {
                    setUploadProgress(progress);
                }
            });

            console.log(`[Upload] Upload success for ${type}. Download URL generated:`, uploadedFile.url);

            // Update Firebase Auth context so `ensureUserProfile` doesn't overwrite it on next refresh
            if (type === 'profile') {
                console.log(`[Upload] Updating Firebase Auth profile.photoURL...`);
                await updateProfile(currentUser, { photoURL: uploadedFile.url });
            }

            console.log(`[Upload] Updating Firestore document...`);
            await updateDocument(COLLECTIONS.users, currentUser.uid, {
                [type === 'profile' ? 'photoURL' : 'coverPhotoURL']: uploadedFile.url
            });
            console.log(`[Upload] Firestore update complete for ${type}.`);

        } catch (err: any) {
            console.error(`[Upload] Upload Error:`, err);
            setUploadError(getFriendlyErrorMessage(err));
        }

        if (type === 'profile') setUploadingAvatar(false);
        else setUploadingCover(false);
    };

    React.useEffect(() => {
        console.log('[Profile] User profile context refreshed:', userProfile);
    }, [userProfile]);

    if (loading) {
        return <ProfileSkeleton />;
    }

    if (!currentUser) {
        return <div className="p-4 text-white">User not found.</div>;
    }

    // Use a placeholder if photoURL is not available
    const userAvatar = userProfile?.photoURL || currentUser?.photoURL || <ProfileIcon className="w-32 h-32 text-gray-400" />;
    const coverImageUrl = userProfile?.coverPhotoURL || 'https://picsum.photos/seed/cover/1200/400';
    
    console.log('[Profile] Rendered Avatar:', typeof userAvatar === 'string' ? userAvatar : 'Icon Component');
    console.log('[Profile] Rendered Cover URL:', coverImageUrl);

    return (
        <>
            <div className="text-white bg-invox-dark-accent rounded-lg border border-gray-800">
                {uploadError && <p className="bg-red-900 text-white text-center p-3 rounded-md m-4">{uploadError}</p>}
                
                {/* Cover and Profile Image */}
                <div>
                    <div className="relative group">
                        <div 
                            className="h-48 bg-gray-700 bg-cover bg-center rounded-t-lg cursor-zoom-in" 
                            style={{ backgroundImage: `url(${coverImageUrl})` }}
                            onClick={() => setZoomedImageUrl(coverImageUrl)}
                        ></div>
                        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <label className="cursor-pointer bg-gray-800 bg-opacity-80 px-4 py-2 rounded-full font-semibold hover:bg-gray-700 transition-all flex flex-col items-center">
                                {uploadingCover ? `Uploading ${uploadProgress}%` : 'Update Cover'}
                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'cover')} disabled={uploadingCover} />
                            </label>
                        </div>
                    </div>
                    <div className="p-4">
                        <div className="flex justify-between items-start">
                            <div className="relative group">
                                <div 
                                    className="-mt-24 w-32 h-32 rounded-full border-4 border-invox-dark-accent bg-invox-dark-accent flex items-center justify-center cursor-zoom-in overflow-hidden relative"
                                    onClick={() => {
                                        if (typeof userAvatar === 'string') {
                                            setZoomedImageUrl(userAvatar);
                                        }
                                    }}
                                >
                                    {typeof userAvatar === 'string' ? (
                                        <img src={userAvatar} onError={handleImageError} alt="Profile" className="w-full h-full rounded-full object-cover" />
                                    ) : (
                                        userAvatar
                                    )}
                                    <div className="absolute inset-0 bg-black bg-opacity-50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <label className="cursor-pointer text-xs font-semibold hover:text-gray-300 w-full h-full flex items-center justify-center">
                                            {uploadingAvatar ? `${uploadProgress}%` : 'Change'}
                                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'profile')} disabled={uploadingAvatar} />
                                        </label>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => navigate('/settings')} className="mt-4 flex items-center gap-2 border border-gray-600 px-4 py-2 rounded-full font-semibold hover:bg-gray-800 transition-all duration-200 transform hover:scale-105 active:scale-95">
                                <PencilIcon className="w-5 h-5" />
                                Edit Profile
                            </button>
                        </div>

                        {/* User Info */}
                        <div className="mt-4">
                            <h1 className="text-2xl font-bold">{userProfile?.displayName || currentUser?.displayName || 'Anonymous User'}</h1>
                            <p className="text-gray-400">@{userProfile?.username || currentUser?.email?.split('@')[0]}</p>
                            <p className="text-white font-semibold mt-1">{userProfile?.headline}</p>
                            <p className="text-gray-300 mt-2">{userProfile?.bio || 'No bio provided yet.'}</p>
                            
                            {userProfile?.skills && userProfile.skills.length > 0 && (
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {userProfile.skills.map((skill, idx) => (
                                        <span key={idx} className="bg-gray-800 text-gray-300 px-3 py-1 rounded-full text-sm">{skill}</span>
                                    ))}
                                </div>
                            )}

                            <div className="mt-4 flex gap-4 text-sm text-gray-400">
                                <span><span className="font-bold text-white">{userProfile?.followingCount || 0}</span> Following</span>
                                <span><span className="font-bold text-white">{userProfile?.followerCount || 0}</span> Followers</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="border-b border-gray-800 mt-4">
                    <nav className="flex space-x-4 px-4">
                        {['Posts', 'Replies', 'Media', 'Likes'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`py-3 px-1 font-semibold border-b-2 transition-all duration-200 transform hover:-translate-y-px ${
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
                
                {/* Tab Content */}
                <div className="p-4 min-h-[300px]">
                    <div className="flex flex-col items-center justify-center text-center py-16">
                        <h2 className="text-2xl font-bold">No {activeTab} Yet</h2>
                        <p className="text-gray-400 mt-2">When you create {activeTab.toLowerCase()}, they'll show up here.</p>
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
