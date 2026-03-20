import React from 'react';

const HubContactSkeleton = () => (
    <div className="flex flex-col items-center flex-shrink-0 w-20 animate-pulse">
        <div className="w-16 h-16 rounded-full bg-gray-700"></div>
        <div className="h-3 w-12 bg-gray-700 rounded mt-2"></div>
    </div>
);

export default HubContactSkeleton;
