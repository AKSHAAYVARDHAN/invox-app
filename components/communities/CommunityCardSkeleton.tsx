import React from 'react';

const CommunityCardSkeleton = () => {
    return (
        <div className="bg-invox-dark-accent rounded-lg border border-gray-800 p-4 w-64 flex-shrink-0 animate-pulse">
            <div className="flex items-start justify-between">
                <div className="w-10 h-10 bg-gray-700 rounded-full"></div>
                <div className="w-20 h-8 bg-gray-700 rounded-full"></div>
            </div>
            <div className="mt-3 space-y-2">
                <div className="h-4 w-3/4 bg-gray-700 rounded"></div>
                <div className="h-3 w-full bg-gray-700 rounded"></div>
                <div className="h-3 w-4/5 bg-gray-700 rounded"></div>
                <div className="flex items-center justify-between mt-2">
                    <div className="h-4 w-1/3 bg-gray-700 rounded"></div>
                    <div className="h-4 w-1/4 bg-gray-700 rounded"></div>
                </div>
            </div>
        </div>
    );
};

export default CommunityCardSkeleton;
