import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckBadgeIcon } from '../ui/Icons';
import { handleImageError } from '../utils/imageUtils';
import { formatNumber } from '../../utils/formatters';
import type { DiscoverableProfile } from '../../services/profileService';

export interface ProfileSuggestion {
    id: string;
    username?: string;
    author: {
        name: string;
        isVerified?: boolean;
        avatarUrl: string;
        id?: string;
        uid?: string;
        username?: string;
    };
    headline?: string;
    bio?: string;
    description?: string;
    stats: {
        projects: number;
        links: number;
    };
}

export interface ProfileSuggestionCardProps {
    profile: DiscoverableProfile | ProfileSuggestion;
    className?: string;
}

export const ProfileSuggestionCard: React.FC<ProfileSuggestionCardProps> = ({ profile, className = '' }) => {
    const navigate = useNavigate();
    const profileTarget =
        (profile as any).username ||
        (profile as any).author?.username ||
        (profile as any).author?.uid ||
        profile.id;

    const handleOpenProfile = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (profileTarget) {
            navigate(`/profile/${encodeURIComponent(profileTarget)}`);
        }
    };

    const rawHeadline = (profile as any).headline;
    const rawBio = (profile as any).bio;
    const headline = typeof rawHeadline === 'string' ? rawHeadline.trim() : '';
    const bio = typeof rawBio === 'string' ? rawBio.trim() : '';
    const hasHeadline = headline.length > 0;
    const hasBio = bio.length > 0;

    return (
        <div className={`bg-[#0c0c0e] p-4 border border-zinc-800 flex flex-col min-h-48 hover:border-zinc-700 transition-colors ${className}`}>
            <div className="flex justify-between items-start mb-3 gap-2">
                <div
                    onClick={handleOpenProfile}
                    className="flex items-center gap-3 cursor-pointer group/creator min-w-0"
                    title={`View ${profile.author.name}'s profile`}
                >
                    <img
                        src={profile.author.avatarUrl}
                        onError={handleImageError}
                        alt={profile.author.name}
                        className="w-10 h-10 border border-zinc-700 object-cover group-hover/creator:border-zinc-500 transition-colors flex-shrink-0"
                    />
                    <div className="flex items-center gap-1.5 min-w-0">
                        <p className="font-bold text-white font-mono text-sm truncate group-hover/creator:text-zinc-300 transition-colors">
                            {profile.author.name}
                        </p>
                        {profile.author.isVerified && <CheckBadgeIcon className="w-4 h-4 text-zinc-400 flex-shrink-0" />}
                    </div>
                </div>
                <button
                    type="button"
                    onClick={handleOpenProfile}
                    className="bg-zinc-900 border border-zinc-800 text-white px-4 py-1.5 font-mono text-xs uppercase font-bold hover:bg-zinc-800 hover:border-zinc-600 transition-colors cursor-pointer flex-shrink-0"
                >
                    View
                </button>
            </div>

            {/* Profile headline & bio / dossier section */}
            <div className="flex-grow min-w-0">
                {(hasHeadline || hasBio) && (
                    <div className="space-y-1.5 min-w-0 mb-3">
                        {hasHeadline && (
                            <p
                                className="text-xs font-mono font-medium text-zinc-200 line-clamp-2 leading-relaxed break-words"
                                title={headline}
                            >
                                {headline}
                            </p>
                        )}
                        {hasBio && (
                            <p
                                className="text-xs font-mono text-zinc-400 line-clamp-2 leading-relaxed break-words"
                                title={bio}
                            >
                                {bio}
                            </p>
                        )}
                    </div>
                )}
            </div>

            <div className="mt-auto">
                <div className="border-t border-zinc-800 my-3" />
                <div className="flex justify-between items-center font-mono text-xs">
                    <p className="text-zinc-400">
                        PROJECTS : <span className="text-white font-bold">{profile.stats.projects}</span>
                    </p>
                    <p className="text-zinc-400">
                        LINKS : <span className="text-white font-bold">{formatNumber(profile.stats.links)}</span>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ProfileSuggestionCard;
