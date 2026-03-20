import React from 'react';

const TrendzCardSkeleton = () => {
    return (
        <div className="bg-invox-dark-accent rounded-lg border border-gray-800 p-4 mb-4 animate-pulse">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-700"></div>
                    <div className="h-4 w-24 bg-gray-700 rounded"></div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-gray-700 rounded-md"></div>
                    <div className="w-6 h-6 bg-gray-700 rounded-md"></div>
                </div>
            </div>

            {/* Content */}
            <div className="mt-4 space-y-3">
                <div className="h-5 w-3/4 bg-gray-700 rounded"></div>
                <div className="h-4 w-full bg-gray-700 rounded"></div>
            </div>

            {/* Media */}
            <div className="mt-4 h-64 bg-gray-700 rounded-2xl"></div>
            
            {/* Action Bar */}
            <div className="mt-4 border border-gray-700 rounded-lg h-10 flex justify-around items-center">
                <div className="h-6 w-12 bg-gray-700 rounded-md"></div>
                <div className="h-6 w-12 bg-gray-700 rounded-md"></div>
                <div className="h-6 w-12 bg-gray-700 rounded-md"></div>
                <div className="h-6 w-6 bg-gray-700 rounded-md"></div>
                <div className="h-6 w-6 bg-gray-700 rounded-md"></div>
                <div className="h-6 w-6 bg-gray-700 rounded-md"></div>
            </div>
        </div>
    );
};

export default TrendzCardSkeleton;
