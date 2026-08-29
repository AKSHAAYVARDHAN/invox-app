import React from 'react';

const StreamCardSkeleton = () => {
    return (
        <div className="bg-[#0c0c0e] border border-zinc-800 p-4 mb-4 animate-pulse">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-zinc-800 border border-zinc-700"></div>
                    <div className="h-4 w-24 bg-zinc-800"></div>
                </div>
                <div className="w-5 h-5 bg-zinc-800"></div>
            </div>

            {/* Media */}
            <div className="h-64 bg-zinc-900 border border-zinc-800 mb-3"></div>
            
            {/* Action Bar */}
            <div className="flex justify-between items-center pt-3 border-t border-zinc-800/80">
                <div className="flex items-center space-x-4">
                    <div className="h-4 w-12 bg-zinc-800"></div>
                    <div className="h-4 w-12 bg-zinc-800"></div>
                    <div className="h-4 w-12 bg-zinc-800"></div>
                </div>
                <div className="flex items-center space-x-2">
                    <div className="h-4 w-4 bg-zinc-800"></div>
                    <div className="h-4 w-4 bg-zinc-800"></div>
                </div>
            </div>
        </div>
    );
};

export default StreamCardSkeleton;
