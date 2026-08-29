import React from 'react';

const ApplicationCardSkeleton = () => (
    <div className="bg-[#0c0c0e] p-4 border border-zinc-800 animate-pulse">
        <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-zinc-800 flex-shrink-0"></div>
            <div className="flex-1 space-y-2">
                <div className="h-4 w-1/3 bg-zinc-800"></div>
                <div className="h-3.5 w-3/4 bg-zinc-800"></div>
                <div className="h-2.5 w-1/4 bg-zinc-800 mt-1"></div>
            </div>
        </div>
        <div className="mt-4 pt-4 border-t border-zinc-800">
            <div className="h-3 w-1/4 bg-zinc-800 mb-3"></div>
            <div className="h-10 w-full bg-zinc-900 border border-zinc-800"></div>
        </div>
    </div>
);

export default ApplicationCardSkeleton;
