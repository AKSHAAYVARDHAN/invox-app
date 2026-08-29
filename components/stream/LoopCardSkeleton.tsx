import React from 'react';

const LoopCardSkeleton = () => (
    <div className="bg-[#0c0c0e] border border-zinc-800 flex flex-col h-full p-3 animate-pulse">
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
            <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-zinc-800 border border-zinc-700"></div>
                <div className="h-3 w-20 bg-zinc-800"></div>
            </div>
            <div className="w-4 h-4 bg-zinc-800"></div>
        </div>
        <div className="p-3 flex-grow flex flex-col justify-between">
            <div className="space-y-2">
                <div className="h-4 w-3/4 bg-zinc-800"></div>
                <div className="h-3 w-full bg-zinc-900"></div>
            </div>
            <div className="mt-3 w-full h-36 bg-zinc-900 border border-zinc-800"></div>
        </div>
    </div>
);

export default LoopCardSkeleton;
