import React from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
    ArrowLeftIcon, 
    ProfileIcon, 
    MapPinIcon, 
    ShieldCheckIcon,
    SparklesIcon,
    CheckBadgeIcon,
    CheckCircleIcon
} from '../ui/Icons';
import { handleImageError } from '../utils/imageUtils';
import { computeProfileCompletion } from '../../pages/Settings';

interface SettingsSidebarProps {
    activeTab?: string;
    onSelectTab?: (tabId: string) => void;
}

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
    activeTab = 'personal',
    onSelectTab,
}) => {
    const navigate = ReactRouterDOM.useNavigate();
    const { currentUser, userProfile } = useAuth();

    const userAvatar = userProfile?.photoURL || currentUser?.photoURL || null;
    const displayName = userProfile?.displayName || currentUser?.displayName || 'Invox Member';
    const username = userProfile?.username ? `@${userProfile.username}` : (currentUser?.email || '');
    const headline = userProfile?.headline || 'No headline set';
    const location = userProfile?.location || '';

    // Calculate current completion percentage
    const completionPct = computeProfileCompletion({
        displayName: userProfile?.displayName,
        headline: userProfile?.headline,
        bio: userProfile?.bio,
        skills: userProfile?.skills,
        interests: userProfile?.interests,
        location: userProfile?.location,
        website: (userProfile as any)?.website,
        photoURL: userProfile?.photoURL,
        coverPhotoURL: userProfile?.coverPhotoURL,
    });

    const categories = [
        { id: 'personal',     code: '01', label: 'Personal Info', desc: 'Identity & Bio' },
        { id: 'professional', code: '02', label: 'Professional',  desc: 'Skills, City, Links' },
        { id: 'media',        code: '03', label: 'Profile Media', desc: 'Avatar & Banner' },
        { id: 'account',      code: '04', label: 'Account',       desc: 'Credentials' },
        { id: 'privacy',      code: '05', label: 'Privacy',       desc: 'Telemetry & Visibility' },
    ];

    const handleBackToProfile = () => {
        // Navigates cleanly to the user's own profile within My Space
        navigate('/profile');
    };

    return (
        <aside className="hidden lg:block w-80 xl:w-[340px] flex-shrink-0 border-l border-zinc-800 bg-[#09090b] h-screen sticky top-0 py-6 overflow-y-auto no-scrollbar">
            <div className="flex flex-col gap-4">
                {/* ── Back to My Profile Primary Action ── */}
                <div className="px-4">
                    <button
                        type="button"
                        onClick={handleBackToProfile}
                        className="w-full flex items-center gap-2.5 p-3 font-mono text-xs uppercase tracking-wider bg-black border border-zinc-800 hover:border-zinc-500 text-zinc-200 hover:text-white hover:bg-zinc-900 transition-all group cursor-pointer shadow-sm select-none"
                        aria-label="Back to My Profile"
                    >
                        <ArrowLeftIcon className="w-4 h-4 text-zinc-400 group-hover:text-white group-hover:-translate-x-1 transition-transform shrink-0" />
                        <span className="font-bold tracking-wider">Back to My Profile</span>
                        <span className="ml-auto text-[10px] text-zinc-600 font-mono group-hover:text-zinc-400">ESC</span>
                    </button>
                </div>

                {/* ── Profile Summary Card ── */}
                <div className="bg-[#0c0c0e] border border-zinc-800 p-4 mx-4 font-mono">
                    <div className="flex items-center gap-3 pb-3 border-b border-zinc-900">
                        {userAvatar ? (
                            <img
                                src={userAvatar}
                                alt="Profile Avatar"
                                onError={handleImageError}
                                className="w-11 h-11 object-cover border border-zinc-700 shrink-0"
                            />
                        ) : (
                            <div className="w-11 h-11 bg-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-400 shrink-0">
                                <ProfileIcon className="w-5 h-5" />
                            </div>
                        )}
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                                <p className="text-white text-xs font-bold truncate">{displayName}</p>
                                {userProfile?.emailVerified && (
                                    <CheckBadgeIcon className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                )}
                            </div>
                            <p className="text-zinc-500 text-[11px] truncate">{username}</p>
                        </div>
                    </div>

                    <div className="pt-2.5 space-y-1.5 text-[11px]">
                        <p className="text-zinc-300 truncate" title={headline}>
                            {headline}
                        </p>
                        {location && (
                            <div className="flex items-center gap-1.5 text-zinc-500 truncate">
                                <MapPinIcon className="w-3 h-3 text-emerald-400 shrink-0" />
                                <span className="truncate">{location}</span>
                            </div>
                        )}
                    </div>

                    {/* Profile Completion Meter */}
                    <div className="mt-4 pt-3 border-t border-zinc-900">
                        <div className="flex justify-between items-center text-[10px] uppercase text-zinc-400 mb-1.5">
                            <span className="flex items-center gap-1 font-medium text-zinc-300">
                                <SparklesIcon className="w-3 h-3 text-emerald-400" />
                                Profile Completion
                            </span>
                            <span className="font-bold text-white">{completionPct}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-zinc-900 border border-zinc-800 overflow-hidden">
                            <div
                                className="h-full bg-emerald-500 transition-all duration-300"
                                style={{ width: `${completionPct}%` }}
                            />
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-1.5">
                            {completionPct === 100
                                ? 'Profile fully completed'
                                : `${100 - completionPct}% remaining to complete`}
                        </p>
                    </div>
                </div>

                {/* ── Settings Categories Quick Overview ── */}
                <div className="bg-[#0c0c0e] border border-zinc-800 p-3 mx-4 font-mono">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-2 px-1">
                        Categories
                    </span>
                    <div className="space-y-1">
                        {categories.map((cat) => {
                            const isActive = activeTab === cat.id;
                            return (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => onSelectTab?.(cat.id)}
                                    className={`w-full text-left p-2 border text-xs transition-colors flex items-center justify-between ${
                                        isActive
                                            ? 'bg-zinc-900 border-zinc-700 text-white font-bold'
                                            : 'bg-black/60 border-zinc-900 text-zinc-400 hover:text-white hover:border-zinc-750'
                                    }`}
                                >
                                    <div className="flex items-center gap-2 truncate">
                                        <span className={`text-[10px] ${isActive ? 'text-emerald-400' : 'text-zinc-600'}`}>
                                            [{cat.code}]
                                        </span>
                                        <span className="truncate">{cat.label}</span>
                                    </div>
                                    {isActive ? (
                                        <span className="w-1.5 h-1.5 bg-emerald-400 shrink-0"></span>
                                    ) : (
                                        <span className="text-[10px] text-zinc-600 font-mono">›</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ── Account Status Card ── */}
                <div className="bg-[#0c0c0e] border border-zinc-800 p-4 mx-4 font-mono">
                    <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                        <ShieldCheckIcon className="w-3.5 h-3.5 text-emerald-400" />
                        Account Status
                    </h4>
                    <div className="space-y-2 text-[11px]">
                        <div className="flex justify-between items-center">
                            <span className="text-zinc-500">Status</span>
                            <span className="text-emerald-400 font-bold">Active</span>
                        </div>
                        <div className="flex justify-between items-center border-t border-zinc-900 pt-1.5">
                            <span className="text-zinc-500">Email Verification</span>
                            <span className={userProfile?.emailVerified || currentUser?.emailVerified ? "text-emerald-400 font-bold" : "text-zinc-400 font-medium"}>
                                {userProfile?.emailVerified || currentUser?.emailVerified ? 'Verified' : 'Pending'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </aside>
    );
};

export default SettingsSidebar;
