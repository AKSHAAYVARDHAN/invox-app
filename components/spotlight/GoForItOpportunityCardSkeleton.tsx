
import React from 'react';

const GoForItOpportunityCardSkeleton: React.FC = () => (
    <div className="bg-invox-dark-accent p-4 rounded-lg border border-gray-800 flex flex-col sm:flex-row gap-4 animate-pulse">
        <div className="w-16 h-16 rounded-lg bg-gray-700 flex-shrink-0"></div>
        <div className="flex-1">
            <div className="flex justify-between items-start">
                <div className="space-y-2">
                    <div className="h-5 w-24 bg-gray-700 rounded"></div>
                    <div className="h-6 w-48 bg-gray-700 rounded"></div>
                    <div className="h-4 w-32 bg-gray-700 rounded"></div>
                </div>
                <div className="w-5 h-5 bg-gray-700 rounded-full"></div>
            </div>
            <div className="space-y-2 mt-3">
                <div className="h-4 w-full bg-gray-700 rounded"></div>
                <div className="h-4 w-5/6 bg-gray-700 rounded"></div>
            </div>
            <div className="flex gap-2 mt-3">
                <div className="h-6 w-16 bg-gray-700 rounded-md"></div>
                <div className="h-6 w-20 bg-gray-700 rounded-md"></div>
                <div className="h-6 w-14 bg-gray-700 rounded-md"></div>
            </div>
             <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-800">
                <div className="h-4 w-20 bg-gray-700 rounded"></div>
                <div className="h-10 w-24 bg-gray-700 rounded-lg"></div>
             </div>
        </div>
    </div>
);

export default GoForItOpportunityCardSkeleton;
