import React from 'react';

const QuickCollabCardSkeleton = () => (
    <div className="bg-[#0c0c0e] border border-zinc-800 p-4 w-80 flex-shrink-0 flex relative overflow-hidden h-44 animate-pulse">
        <div className="flex-1 flex flex-col justify-between z-10">
            <div>
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 bg-zinc-800"></div>
                    <div className="h-3 w-20 bg-zinc-800"></div>
                </div>
                <div className="space-y-1.5">
                    <div className="h-2.5 w-full bg-zinc-850"></div>
                    <div className="h-2.5 w-5/6 bg-zinc-850"></div>
                </div>
            </div>
            <div className="w-20 h-7 bg-zinc-800 mt-2"></div>
        </div>
        <div className="absolute inset-y-0 right-0 w-2/5 bg-zinc-900 border-l border-zinc-800"></div>
    </div>
);

export default QuickCollabCardSkeleton;
