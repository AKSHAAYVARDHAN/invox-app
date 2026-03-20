import React from 'react';

const LoopCardSkeleton = () => (
    <div className="bg-invox-dark-accent rounded-lg border border-gray-800 flex flex-col h-full p-3 animate-pulse">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gray-700"></div>
                <div className="h-4 w-20 bg-gray-700 rounded"></div>
            </div>
            <div className="w-5 h-5 bg-gray-700 rounded-md"></div>
        </div>
        <div className="pt-8 flex-grow flex flex-col justify-between">
            <div className="space-y-2">
                <div className="h-5 w-3/4 bg-gray-700 rounded"></div>
                <div className="h-4 w-full bg-gray-700 rounded"></div>
            </div>
            <div className="mt-4 w-full h-32 bg-gray-700 rounded-lg"></div>
        </div>
    </div>
);

export default LoopCardSkeleton;
