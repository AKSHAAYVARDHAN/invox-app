import React from 'react';

const MomentCardSkeleton = () => {
    return (
        <div className="bg-[#0c0c0e] border border-zinc-800 p-4 mb-4 animate-pulse">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-zinc-800 border border-zinc-700"></div>
                    <div className="flex flex-col gap-1.5">
                        <div className="h-3 w-20 bg-zinc-800"></div>
                        <div className="h-2.5 w-14 bg-zinc-900"></div>
                    </div>
                </div>
                <div className="w-5 h-5 bg-zinc-800"></div>
            </div>

            {/* Media */}
            <div className="h-64 bg-zinc-900 border border-zinc-800 mb-3"></div>
            
            {/* Action Bar */}
            <div className="border border-zinc-800 px-4 py-2 flex justify-between items-center bg-zinc-950 mb-3">
                <div className="h-4 w-12 bg-zinc-800"></div>
                <div className="h-4 w-12 bg-zinc-800"></div>
                <div className="h-4 w-12 bg-zinc-800"></div>
                <div className="h-4 w-5 bg-zinc-800"></div>
            </div>

            {/* Content */}
            <div className="space-y-2">
                <div className="h-3 w-full bg-zinc-800"></div>
                <div className="h-3 w-3/4 bg-zinc-900"></div>
            </div>
        </div>
    );
};

export default MomentCardSkeleton;
