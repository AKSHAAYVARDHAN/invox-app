import React from 'react';

const ProfileSkeleton = () => {
    const shimmer = "bg-gray-800 animate-pulse rounded";

    return (
        <div className="text-white">
            {/* Cover */}
            <div className={`h-48 rounded-t-xl ${shimmer}`} />

            <div className="bg-invox-dark-accent rounded-b-xl border border-gray-800 border-t-0 px-4 pb-4">
                {/* Avatar + actions row */}
                <div className="flex justify-between items-end -mt-12 mb-4">
                    <div className={`w-28 h-28 rounded-full border-4 border-invox-dark-accent ${shimmer}`} />
                    <div className={`h-9 w-32 rounded-full ${shimmer} mt-4`} />
                </div>

                {/* Name / headline / meta */}
                <div className="space-y-2 mb-4">
                    <div className={`h-7 w-48 ${shimmer}`} />
                    <div className={`h-4 w-32 ${shimmer}`} />
                    <div className={`h-4 w-64 ${shimmer}`} />
                    <div className="flex gap-4 mt-1">
                        <div className={`h-4 w-24 ${shimmer}`} />
                        <div className={`h-4 w-32 ${shimmer}`} />
                    </div>
                </div>

                {/* Profile completion */}
                <div className={`rounded-xl p-4 mb-4 border border-gray-800 ${shimmer} h-20`} />

                {/* Two column: About + Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className={`rounded-xl h-32 ${shimmer}`} />
                    <div className="grid grid-cols-2 gap-3">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className={`rounded-xl h-14 ${shimmer}`} />
                        ))}
                    </div>
                </div>

                {/* Skills */}
                <div className={`rounded-xl h-20 mb-4 ${shimmer}`} />

                {/* Tabs */}
                <div className="flex gap-4 border-b border-gray-800 mb-4 pb-2">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className={`h-4 w-14 ${shimmer}`} />
                    ))}
                </div>

                {/* Content placeholder */}
                <div className={`h-32 ${shimmer}`} />
            </div>
        </div>
    );
};

export default ProfileSkeleton;
