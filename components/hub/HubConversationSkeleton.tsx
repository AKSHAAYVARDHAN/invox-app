
import React from 'react';

const HubConversationSkeleton = () => (
    <div className="bg-invox-dark-accent p-3 rounded-lg border border-gray-800 flex items-center justify-between gap-3 animate-pulse">
        <div className="flex items-center gap-3 overflow-hidden w-full">
            <div className="w-12 h-12 rounded-full bg-gray-700 flex-shrink-0"></div>
            <div className="overflow-hidden w-full space-y-2">
                <div className="h-5 w-3/4 bg-gray-700 rounded"></div>
                <div className="h-4 w-full bg-gray-700 rounded"></div>
            </div>
        </div>
        <div className="flex flex-col items-end flex-shrink-0 w-20">
            <div className="h-3 w-16 bg-gray-700 rounded"></div>
            <div className="h-6 w-6 bg-gray-700 rounded-full mt-2"></div>
        </div>
    </div>
);

export default HubConversationSkeleton;
