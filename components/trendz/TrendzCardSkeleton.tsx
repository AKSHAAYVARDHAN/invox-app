import React from 'react';

const TrendzCardSkeleton = () => {
    return (
        <div className="bg-[#0c0c0e] border border-zinc-800 p-4 mb-4 animate-pulse">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-zinc-800"></div>
                    <div className="flex flex-col gap-1.5">
                        <div className="h-3 w-28 bg-zinc-800"></div>
                        <div className="h-2 w-20 bg-zinc-850"></div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-zinc-800"></div>
                    <div className="w-6 h-6 bg-zinc-800"></div>
                </div>
            </div>

            {/* Content */}
            <div className="mt-3.5 space-y-2">
                <div className="h-4 w-3/4 bg-zinc-800"></div>
                <div className="h-3 w-full bg-zinc-850"></div>
            </div>

            {/* Media */}
            <div className="mt-3.5 h-60 bg-zinc-900 border border-zinc-800"></div>
            
            {/* Action Bar */}
            <div className="mt-4 border-t border-zinc-800/80 pt-3 flex justify-between items-center">
                <div className="h-4 w-12 bg-zinc-800"></div>
                <div className="h-4 w-12 bg-zinc-800"></div>
                <div className="h-4 w-12 bg-zinc-800"></div>
                <div className="h-4 w-6 bg-zinc-800"></div>
                <div className="h-4 w-6 bg-zinc-800"></div>
                <div className="h-4 w-6 bg-zinc-800"></div>
            </div>
        </div>
    );
};

export default TrendzCardSkeleton;
