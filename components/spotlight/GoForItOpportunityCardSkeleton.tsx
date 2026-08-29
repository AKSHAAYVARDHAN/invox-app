
import React from 'react';

const GoForItOpportunityCardSkeleton: React.FC = () => (
    <div className="bg-[#0c0c0e] p-4 border border-zinc-800 flex flex-col sm:flex-row gap-4 animate-pulse">
        <div className="w-14 h-14 bg-zinc-800 flex-shrink-0"></div>
        <div className="flex-1">
            <div className="flex justify-between items-start">
                <div className="space-y-2">
                    <div className="h-3 w-24 bg-zinc-800"></div>
                    <div className="h-4 w-48 bg-zinc-800"></div>
                    <div className="h-3 w-32 bg-zinc-850"></div>
                </div>
                <div className="w-4 h-4 bg-zinc-800"></div>
            </div>
            <div className="space-y-1.5 mt-3">
                <div className="h-3 w-full bg-zinc-850"></div>
                <div className="h-3 w-5/6 bg-zinc-850"></div>
            </div>
            <div className="flex gap-1.5 mt-3">
                <div className="h-5 w-16 bg-zinc-800"></div>
                <div className="h-5 w-20 bg-zinc-800"></div>
                <div className="h-5 w-14 bg-zinc-800"></div>
            </div>
             <div className="flex justify-between items-center mt-4 pt-3 border-t border-zinc-850">
                <div className="h-3 w-20 bg-zinc-800"></div>
                <div className="h-7 w-24 bg-zinc-800"></div>
             </div>
        </div>
    </div>
);

export default GoForItOpportunityCardSkeleton;
