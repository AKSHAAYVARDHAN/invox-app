import React from 'react';

const QuickCollabCardSkeleton = () => (
    <div className="bg-invox-dark-accent rounded-2xl border border-gray-800 p-4 w-80 flex-shrink-0 flex relative overflow-hidden h-48 animate-pulse">
        <div className="flex-1 flex flex-col justify-between z-10">
            <div>
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-gray-700"></div>
                    <div className="h-4 w-20 bg-gray-700 rounded"></div>
                </div>
                <div className="space-y-2">
                    <div className="h-3 w-full bg-gray-700 rounded"></div>
                    <div className="h-3 w-5/6 bg-gray-700 rounded"></div>
                </div>
            </div>
            <div className="w-24 h-8 bg-gray-700 rounded-lg mt-2"></div>
        </div>
        <div className="absolute inset-y-0 right-0 w-2/5 bg-gray-700"></div>
    </div>
);

export default QuickCollabCardSkeleton;
