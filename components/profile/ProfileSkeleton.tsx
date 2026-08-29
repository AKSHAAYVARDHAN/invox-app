import React from 'react';

const ProfileSkeleton = () => {
    const shimmer = "bg-zinc-850 animate-pulse";

    return (
        <div className="text-white">
            {/* Cover */}
            <div className={`h-44 border border-zinc-800 ${shimmer}`} />

            <div className="bg-[#0c0c0e] border border-zinc-800 border-t-0 p-4">
                {/* Avatar + actions row */}
                <div className="flex justify-between items-end -mt-10 mb-4">
                    <div className={`w-24 h-24 border-2 border-zinc-800 ${shimmer}`} />
                    <div className={`h-8 w-28 border border-zinc-800 ${shimmer} mt-4`} />
                </div>

                {/* Name / headline / meta */}
                <div className="space-y-2 mb-4">
                    <div className={`h-5 w-48 ${shimmer}`} />
                    <div className={`h-3 w-32 ${shimmer}`} />
                    <div className={`h-3 w-64 ${shimmer}`} />
                    <div className="flex gap-4 mt-1">
                        <div className={`h-3 w-24 ${shimmer}`} />
                        <div className={`h-3 w-32 ${shimmer}`} />
                    </div>
                </div>

                {/* Profile completion */}
                <div className={`p-4 mb-4 border border-zinc-800 ${shimmer} h-16`} />

                {/* Two column: About + Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className={`border border-zinc-800 h-28 ${shimmer}`} />
                    <div className="grid grid-cols-2 gap-2.5">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className={`border border-zinc-800 h-12 ${shimmer}`} />
                        ))}
                    </div>
                </div>

                {/* Skills */}
                <div className={`border border-zinc-800 h-16 mb-4 ${shimmer}`} />

                {/* Tabs */}
                <div className="flex gap-4 border-b border-zinc-800 mb-4 pb-2">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className={`h-3.5 w-14 ${shimmer}`} />
                    ))}
                </div>

                {/* Content placeholder */}
                <div className={`border border-zinc-800 h-28 ${shimmer}`} />
            </div>
        </div>
    );
};

export default ProfileSkeleton;
