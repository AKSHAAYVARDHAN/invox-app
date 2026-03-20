import React from 'react';

const StreamCardSkeleton = () => {
    return (
        <div className="bg-invox-dark-accent rounded-lg border border-gray-800 p-4 mb-4 animate-pulse">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-700"></div>
                    <div className="h-4 w-24 bg-gray-700 rounded"></div>
                </div>
                <div className="w-6 h-6 bg-gray-700 rounded-md"></div>
            </div>

            {/* Media */}
            <div className="h-80 bg-gray-700 rounded-lg mb-4"></div>
            
            {/* Action Bar */}
            <div className="flex justify-between items-center">
                <div className="flex items-center space-x-4">
                    <div className="h-6 w-12 bg-gray-700 rounded-md"></div>
                    <div className="h-6 w-12 bg-gray-700 rounded-md"></div>
                    <div className="h-6 w-12 bg-gray-700 rounded-md"></div>
                </div>
                 <div className="flex items-center space-x-2">
                    <div className="h-6 w-6 bg-gray-700 rounded-md"></div>
                    <div className="h-6 w-6 bg-gray-700 rounded-md"></div>
                </div>
            </div>
        </div>
    );
};

export default StreamCardSkeleton;
