

import React from 'react';
import type { Community } from '../../types';
import { CommunityIcon, StarIcon, ShieldCheckIcon } from '../ui/Icons';
import { getAdjustedMemberCount } from '../../services/communityService';

interface CommunityCardProps {
    community: Community;
    isMember?: boolean;
    isLoading?: boolean;
    onToggleMembership?: (community: Community) => void;
}

const formatNumber = (num: number) => {
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num;
};

const CommunityCard: React.FC<CommunityCardProps> = ({ community, isMember, isLoading, onToggleMembership }) => {
    const displayedMembers = getAdjustedMemberCount(community.members, !!isMember);

    return (
        <div className="bg-[#0c0c0e] border border-zinc-800 p-4 w-64 flex-shrink-0 hover:border-zinc-700 transition-colors">
            <div className="flex items-start justify-between">
                <div className="p-2 bg-black border border-zinc-800 text-zinc-400">
                    <CommunityIcon className="w-5 h-5" />
                </div>
                <button 
                    onClick={() => onToggleMembership?.(community)}
                    disabled={isLoading}
                    className={`px-3 py-1 font-mono text-xs font-bold uppercase transition-colors border ${
                        isMember
                            ? 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:border-rose-700 hover:text-rose-400 hover:bg-rose-950/30'
                            : 'bg-white text-black border-white hover:bg-zinc-200'
                    }`}
                >
                    {isLoading ? '...' : isMember ? 'JOINED' : 'JOIN'}
                </button>
            </div>
            <div className="mt-3.5">
                <div className="flex items-center gap-1.5">
                    <h3 className="font-mono font-bold text-white text-sm truncate">{community.name}</h3>
                    {community.isVerified && <ShieldCheckIcon className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />}
                </div>
                <p className="font-mono text-xs text-zinc-400 mt-1.5 h-8 overflow-hidden line-clamp-2">
                    {community.description}
                </p>
                <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-zinc-850 font-mono text-xs">
                    <span className="text-zinc-500">
                        MEMBERS: <span className="font-bold text-white">{formatNumber(displayedMembers)}</span>
                    </span>
                    <div className="flex items-center gap-1 text-zinc-300">
                        <StarIcon className="w-3.5 h-3.5" />
                        <span className="font-bold">{community.rating.toFixed(1)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommunityCard;