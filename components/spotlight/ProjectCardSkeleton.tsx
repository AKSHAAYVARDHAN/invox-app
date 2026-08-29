
import React from 'react';

const ProjectCardSkeleton = () => {
    return (
        <div className="bg-[#0c0c0e] border border-zinc-800 p-4 mb-4 animate-pulse">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-zinc-800"></div>
                    <div className="h-3.5 w-24 bg-zinc-800"></div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 bg-zinc-800"></div>
                    <div className="w-5 h-5 bg-zinc-800"></div>
                </div>
            </div>

            {/* Content */}
            <div className="mt-4 space-y-2">
                <div className="h-4 w-3/4 bg-zinc-800"></div>
                <div className="h-3 w-full bg-zinc-850"></div>
                <div className="h-3 w-5/6 bg-zinc-850"></div>
            </div>

            {/* Media */}
            <div className="mt-4 h-64 bg-zinc-850 border border-zinc-800"></div>
            
            {/* Action Bar */}
            <div className="mt-4 border border-zinc-800 h-9 flex justify-around items-center bg-black">
                <div className="h-4 w-10 bg-zinc-800"></div>
                <div className="h-4 w-10 bg-zinc-800"></div>
                <div className="h-4 w-10 bg-zinc-800"></div>
                <div className="h-4 w-5 bg-zinc-800"></div>
                <div className="h-4 w-5 bg-zinc-800"></div>
            </div>

            {/* Connect Button */}
            <div className="mt-2 h-9 bg-zinc-800"></div>
        </div>
    );
};

export default ProjectCardSkeleton;
