
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ProfileIcon, PencilIcon } from '../components/ui/Icons';
import ProfileSkeleton from '../components/profile/ProfileSkeleton';
import { handleImageError } from '../components/utils/imageUtils';
import ImageZoomModal from '../components/ui/ImageZoomModal';

const ProfilePage = () => {
    const { currentUser, loading } = useAuth();
    const [activeTab, setActiveTab] = useState('Posts');
    const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);

    if (loading) {
        return <ProfileSkeleton />;
    }

    if (!currentUser) {
        return <div className="p-4 text-white">User not found.</div>;
    }

    // Use a placeholder if photoURL is not available
    const userAvatar = currentUser.photoURL || <ProfileIcon className="w-32 h-32 text-gray-400" />;
    const coverImageUrl = 'https://picsum.photos/seed/cover/1200/400';

    return (
        <>
            <div className="text-white bg-invox-dark-accent rounded-lg border border-gray-800">
                {/* Cover and Profile Image */}
                <div>
                    <div 
                        className="h-48 bg-gray-700 bg-cover bg-center rounded-t-lg cursor-zoom-in" 
                        style={{ backgroundImage: `url(${coverImageUrl})` }}
                        onClick={() => setZoomedImageUrl(coverImageUrl)}
                    ></div>
                    <div className="p-4">
                        <div className="flex justify-between items-start">
                            <div className="relative">
                                <div 
                                    className="-mt-24 w-32 h-32 rounded-full border-4 border-invox-dark-accent bg-invox-dark-accent flex items-center justify-center cursor-zoom-in"
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
                                </div>
                            </div>
                            <button className="mt-4 flex items-center gap-2 border border-gray-600 px-4 py-2 rounded-full font-semibold hover:bg-gray-800 transition-all duration-200 transform hover:scale-105 active:scale-95">
                                <PencilIcon className="w-5 h-5" />
                                Edit Profile
                            </button>
                        </div>

                        {/* User Info */}
                        <div className="mt-4">
                            <h1 className="text-2xl font-bold">{currentUser.displayName || 'Anonymous User'}</h1>
                            <p className="text-gray-400">{currentUser.email}</p>
                            <p className="text-gray-300 mt-2">Bio goes here. Passionate about technology, innovation, and connecting brilliant minds. Fueling curiosity on Invox.</p>
                            <div className="mt-3 flex gap-4 text-sm text-gray-400">
                                <span><span className="font-bold text-white">123</span> Following</span>
                                <span><span className="font-bold text-white">456K</span> Followers</span>
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
