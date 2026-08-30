import React from 'react';

const HubContactSkeleton = () => (
    <div className="flex flex-col items-center flex-shrink-0 w-16 animate-pulse">
        <div className="w-12 h-12 bg-zinc-800 border border-zinc-700"></div>
        <div className="h-2.5 w-10 bg-zinc-800 mt-2"></div>
    </div>
);

export default HubContactSkeleton;
