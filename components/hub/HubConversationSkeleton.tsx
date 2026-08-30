import React from 'react';

const HubConversationSkeleton = () => (
    <div className="bg-[#0c0c0e] p-3 border border-zinc-800 flex items-center justify-between gap-3 animate-pulse">
        <div className="flex items-center gap-3 overflow-hidden w-full">
            <div className="w-10 h-10 bg-zinc-800 border border-zinc-700 flex-shrink-0"></div>
            <div className="overflow-hidden w-full space-y-2">
                <div className="h-3.5 w-3/4 bg-zinc-800"></div>
                <div className="h-3 w-full bg-zinc-900"></div>
            </div>
        </div>
        <div className="flex flex-col items-end flex-shrink-0 w-16">
            <div className="h-2.5 w-12 bg-zinc-800"></div>
            <div className="h-4 w-4 bg-zinc-800 mt-2"></div>
        </div>
    </div>
);

export default HubConversationSkeleton;
