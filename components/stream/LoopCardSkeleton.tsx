import React from 'react';

const LoopCardSkeleton = () => (
    <div className="bg-[#0c0c0e] border border-zinc-800 flex flex-col h-full animate-pulse font-mono">
        {/* Header */}
        <div className="flex items-center justify-between p-3.5 border-b border-zinc-800/80">
            <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 bg-zinc-800 border border-zinc-700"></div>
                <div className="space-y-1">
                    <div className="h-3 w-24 bg-zinc-800"></div>
                    <div className="h-2 w-16 bg-zinc-900"></div>
                </div>
            </div>
            <div className="h-5 w-14 bg-zinc-900 border border-zinc-800"></div>
        </div>

        {/* Body */}
        <div className="p-4 flex-grow flex flex-col justify-between space-y-3">
            <div className="space-y-2">
                <div className="h-4 w-3/4 bg-zinc-800"></div>
                <div className="h-3 w-full bg-zinc-900"></div>
                <div className="h-3 w-4/5 bg-zinc-900"></div>
            </div>
            <div className="mt-2 w-full h-44 bg-zinc-900/70 border border-zinc-800"></div>
        </div>

        {/* Engagement Row */}
        <div className="border-t border-zinc-800/80 px-4 py-3 flex justify-between items-center bg-[#09090b]">
            <div className="flex items-center gap-4">
                <div className="h-4 w-10 bg-zinc-900"></div>
                <div className="h-4 w-10 bg-zinc-900"></div>
                <div className="h-4 w-10 bg-zinc-900"></div>
            </div>
            <div className="flex items-center gap-2">
                <div className="h-4 w-4 bg-zinc-900"></div>
                <div className="h-4 w-4 bg-zinc-900"></div>
            </div>
        </div>
    </div>
);

export default LoopCardSkeleton;
