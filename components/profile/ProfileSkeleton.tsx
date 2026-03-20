import React from 'react';

const ProfileSkeleton = () => (
    <div className="bg-invox-dark-accent rounded-lg border border-gray-800 animate-pulse">
        {/* Cover */}
        <div className="h-48 bg-gray-700 rounded-t-lg"></div>
        <div className="p-4">
            <div className="flex justify-between items-start">
                {/* Avatar */}
                <div className="-mt-24 w-32 h-32 rounded-full border-4 border-invox-dark-accent bg-gray-600"></div>
                {/* Edit button */}
                <div className="mt-4 h-10 w-36 bg-gray-700 rounded-full"></div>
            </div>

            {/* User Info */}
            <div className="mt-4 space-y-3">
                <div className="h-7 w-1/3 bg-gray-700 rounded"></div>
                <div className="h-4 w-1/2 bg-gray-700 rounded"></div>
                <div className="h-4 w-full bg-gray-700 rounded"></div>
                <div className="h-4 w-3/4 bg-gray-700 rounded"></div>
                <div className="flex gap-4 mt-2">
                    <div className="h-4 w-24 bg-gray-700 rounded"></div>
                    <div className="h-4 w-24 bg-gray-700 rounded"></div>
                </div>
            </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-800 mt-4 px-4 flex space-x-4">
            <div className="h-10 w-16 bg-gray-700 rounded-t-md"></div>
            <div className="h-10 w-16 bg-gray-700 rounded-t-md"></div>
            <div className="h-10 w-16 bg-gray-700 rounded-t-md"></div>
            <div className="h-10 w-16 bg-gray-700 rounded-t-md"></div>
        </div>
        
        {/* Tab Content */}
        <div className="p-4 min-h-[300px]">
            <div className="flex flex-col items-center justify-center text-center py-16">
                 <div className="h-7 w-1/2 bg-gray-700 rounded"></div>
                 <div className="h-4 w-2/3 bg-gray-700 rounded mt-4"></div>
            </div>
        </div>
    </div>
);

export default ProfileSkeleton;
