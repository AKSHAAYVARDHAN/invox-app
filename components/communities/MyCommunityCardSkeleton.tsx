import React from 'react';

const MyCommunityCardSkeleton = () => (
    <div className="bg-invox-dark-accent p-3 rounded-lg flex items-center justify-between border border-gray-800 animate-pulse">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-700"></div>
            <div>
                <div className="h-4 w-24 bg-gray-700 rounded mb-2"></div>
                <div className="h-3 w-32 bg-gray-700 rounded"></div>
            </div>
        </div>
        <div className="flex flex-col items-end">
            <div className="h-3 w-16 bg-gray-700 rounded mb-2"></div>
            <div className="h-5 w-5 bg-gray-700 rounded-full mt-1"></div>
        </div>
    </div>
);

export default MyCommunityCardSkeleton;
