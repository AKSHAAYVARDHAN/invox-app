

import React from 'react';
import type { Community } from '../../types';
import { CommunityIcon, StarIcon, ShieldCheckIcon } from '../ui/Icons';

interface CommunityCardProps {
    community: Community;
}

const formatNumber = (num: number) => {
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num;
};

const CommunityCard: React.FC<CommunityCardProps> = ({ community }) => {
    return (
        <div className="bg-invox-dark-accent rounded-lg border border-gray-800 p-4 w-64 flex-shrink-0">
            <div className="flex items-start justify-between">
                <div className="p-2 bg-gray-700 rounded-full">
                    <CommunityIcon className="w-6 h-6 text-invox-light-gray" />
                </div>
                <button className="bg-invox-red text-white px-4 py-1 rounded-full text-sm font-semibold hover:bg-invox-red-hover transition-colors duration-200">
                    Join
                </button>
            </div>
            <div className="mt-3">
                <div className="flex items-center">
                    <h3 className="font-bold text-white mr-1">{community.name}</h3>
                    {community.isVerified && <ShieldCheckIcon className="w-4 h-4 text-blue-500" />}
                </div>
                <p className="text-xs text-gray-400 mt-1 h-8 overflow-hidden">
                    {community.description}
                </p>
                <div className="flex items-center justify-between mt-3 text-sm">
                    <span className="text-invox-light-gray">
                        Members : <span className="font-bold text-white">{formatNumber(community.members)}</span>
                    </span>
                    <div className="flex items-center gap-1 text-yellow-400">
                        <StarIcon className="w-4 h-4" />
                        <span className="font-bold">{community.rating.toFixed(1)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommunityCard;