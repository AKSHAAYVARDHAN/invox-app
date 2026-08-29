import React from 'react';

const MyCommunityCardSkeleton = () => (
    <div className="bg-[#0c0c0e] p-2.5 flex items-center justify-between border border-zinc-800 animate-pulse">
        <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-zinc-800"></div>
            <div>
                <div className="h-3 w-24 bg-zinc-800 mb-1.5"></div>
                <div className="h-2.5 w-32 bg-zinc-850"></div>
            </div>
        </div>
        <div className="flex flex-col items-end">
            <div className="h-2.5 w-12 bg-zinc-800 mb-1.5"></div>
            <div className="h-3 w-3 bg-zinc-800"></div>
        </div>
    </div>
);

export default MyCommunityCardSkeleton;
