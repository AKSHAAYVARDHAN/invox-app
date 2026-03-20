import React from 'react';

const ApplicationCardSkeleton = () => (
    <div className="bg-invox-dark-accent p-4 rounded-lg border border-gray-800 animate-pulse">
        <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-gray-700 flex-shrink-0"></div>
            <div className="flex-1 space-y-2">
                <div className="h-5 w-1/3 bg-gray-700 rounded"></div>
                <div className="h-4 w-3/4 bg-gray-700 rounded"></div>
                <div className="h-3 w-1/4 bg-gray-700 rounded mt-1"></div>
            </div>
        </div>
        <div className="mt-4 pt-4 border-t border-gray-700/50">
            <div className="h-4 w-1/2 bg-gray-700 rounded mb-3"></div>
            <div className="h-12 w-full bg-gray-700 rounded"></div>
        </div>
    </div>
);

export default ApplicationCardSkeleton;
