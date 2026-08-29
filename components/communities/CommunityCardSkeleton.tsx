import React from 'react';

const CommunityCardSkeleton = () => {
    return (
        <div className="bg-[#0c0c0e] border border-zinc-800 p-4 w-64 flex-shrink-0 animate-pulse">
            <div className="flex items-start justify-between">
                <div className="w-9 h-9 bg-zinc-800"></div>
                <div className="w-16 h-7 bg-zinc-800"></div>
            </div>
            <div className="mt-3.5 space-y-2">
                <div className="h-3.5 w-3/4 bg-zinc-800"></div>
                <div className="h-2.5 w-full bg-zinc-850"></div>
                <div className="h-2.5 w-4/5 bg-zinc-850"></div>
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-zinc-850">
                    <div className="h-2.5 w-1/3 bg-zinc-800"></div>
                    <div className="h-2.5 w-1/4 bg-zinc-800"></div>
                </div>
            </div>
        </div>
    );
};

export default CommunityCardSkeleton;
