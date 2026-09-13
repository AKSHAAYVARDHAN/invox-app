import React from 'react';
import type { CollabApplication, CollabRole, Post } from '../../types';
import { CheckBadgeIcon } from '../ui/Icons';
import { handleImageError } from '../utils/imageUtils';
import { CollapsibleText } from './CollapsibleText';

interface MyApplicationCardProps {
    application: CollabApplication;
    targetCollab?: Post | null;
    onViewDetails: (app: CollabApplication, collab?: Post | null) => void;
    onWithdraw?: (app: CollabApplication) => void;
    isActionLoading?: boolean;
}

export const MyApplicationCard: React.FC<MyApplicationCardProps> = ({
    application,
    targetCollab,
    onViewDetails,
    onWithdraw,
    isActionLoading = false,
}) => {
    // 1. CANONICAL RESOLUTION: Target Collab data with fallback to application snapshot
    const hookTitle = targetCollab?.aiSummary || targetCollab?.oneLine || application.collabTitle || 'Untitled Collab Project';
    const overview = targetCollab?.content || targetCollab?.description || application.collabOverview;
    const domain = (targetCollab?.domain || targetCollab?.category || application.collabDomain || '').trim();

    // Creator info
    const creatorName = targetCollab?.author?.name || application.collabCreatorName || 'Creator';
    const creatorAvatar = targetCollab?.author?.avatarUrl || application.collabCreatorAvatar || `https://picsum.photos/seed/${targetCollab?.id || application.collabId}/200`;
    const creatorUsername = targetCollab?.author?.username;
    const isCreatorVerified = Boolean(targetCollab?.author?.isVerified);

    // Collab metadata
    const collabDetails = targetCollab?.collabDetails;
    const projectStatus = collabDetails?.projectStatus?.trim();
    const collabTypes = Array.isArray(collabDetails?.collabTypes) ? collabDetails.collabTypes.filter(Boolean) : [];
    const locationStr = collabDetails?.location === 'Specific Location' && collabDetails?.specificLocation
        ? `Specific Location (${collabDetails.specificLocation})`
        : collabDetails?.location;
    const collaborationDetails = [...collabTypes, locationStr].filter(Boolean).join(' · ');

    const availability = collabDetails?.availability?.trim();
    const experience = collabDetails?.experience?.trim();
    const background = collabDetails?.background?.trim();

    // 2. ROLE RESOLUTION: Find the exact role the user applied for
    const rawRoles = collabDetails?.roles || [];
    const normalizedRoles: CollabRole[] = Array.isArray(rawRoles)
        ? rawRoles
        : (rawRoles && typeof rawRoles === 'object' ? Object.values(rawRoles) : []);

    const appliedRole = normalizedRoles.find(r => r.id === application.roleId)
        || normalizedRoles.find(r => r.title.toLowerCase() === application.roleTitle.toLowerCase());

    const roleTitle = appliedRole?.title || application.roleTitle;
    const roleSkills = Array.isArray(appliedRole?.skills) ? appliedRole.skills.filter(Boolean) : [];
    const peopleNeeded = appliedRole?.count !== undefined && appliedRole?.count !== null ? appliedRole.count : null;
    const roleResponsibilities = appliedRole?.responsibilities?.trim();

    // 3. APPLICATION METADATA
    const appStatus = application.status;
    const formattedDate = application.createdAt
        ? (typeof application.createdAt?.toDate === 'function'
            ? application.createdAt.toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
            : new Date(application.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }))
        : 'Recently';

    return (
        <article
            id={`my-app-${application.id}`}
            className="p-4 sm:p-5 bg-[#0c0c0e] border border-zinc-800 hover:border-zinc-700 transition-all font-mono text-zinc-300 space-y-4 shadow-sm"
        >
            {/* 1. CARD HEADER: TARGET PROJECT & APPLICATION STATUS */}
            <div className="pb-3 border-b border-zinc-800/80 space-y-2.5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1 max-w-xl">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">
                            // TARGET PROJECT
                        </span>
                        <h2 className="text-base sm:text-lg font-bold text-white leading-snug tracking-tight">
                            "{hookTitle}"
                        </h2>
                    </div>

                    {/* Application Status Badge */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <span
                            className={`px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider border ${
                                appStatus === 'ACCEPTED'
                                    ? 'bg-emerald-950/50 text-emerald-400 border-emerald-700'
                                    : appStatus === 'PENDING'
                                    ? 'bg-amber-950/40 text-amber-400 border-amber-800'
                                    : appStatus === 'DECLINED'
                                    ? 'bg-zinc-900 text-zinc-400 border-zinc-750'
                                    : 'bg-zinc-950 text-zinc-500 border-zinc-800'
                            }`}
                        >
                            // {appStatus}
                        </span>
                    </div>
                </div>

                {/* CREATED BY & DOMAIN */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-zinc-900">
                    <div className="flex items-center gap-2.5">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">
                            // CREATED BY:
                        </span>
                        <div className="flex items-center gap-2">
                            <img
                                src={creatorAvatar}
                                onError={handleImageError}
                                alt={creatorName}
                                className="w-6 h-6 border border-zinc-700 object-cover bg-zinc-900 flex-shrink-0"
                            />
                            <div className="flex items-center gap-1.5 text-xs">
                                <span className="font-bold text-white">{creatorName}</span>
                                {isCreatorVerified && <CheckBadgeIcon className="w-3.5 h-3.5 text-zinc-400" />}
                                {creatorUsername && (
                                    <span className="text-zinc-500 text-[11px]">@{creatorUsername}</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {domain && (
                        <div className="flex items-center gap-1.5 text-[11px]">
                            <span className="text-zinc-500 text-[10px] uppercase font-bold">// DOMAIN:</span>
                            <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-200 uppercase font-semibold">
                                {domain}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* 2. PROJECT INFORMATION BLOCK (CANONICAL COLLAB DATA) */}
            <div className="p-3.5 bg-black/60 border border-zinc-850 space-y-3">
                {overview && (
                    <div className="space-y-1">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">
                            // PROJECT OVERVIEW
                        </span>
                        <CollapsibleText
                            text={overview}
                            lines={3}
                            className="text-xs text-zinc-300 leading-relaxed"
                        />
                    </div>
                )}

                {/* METADATA GRID: ONLY FIELDS THAT ACTUALLY EXIST */}
                {(projectStatus || collaborationDetails || availability || experience || background) && (
                    <div className="pt-2.5 border-t border-zinc-850/80 space-y-2">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">
                            // PROJECT DETAILS
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                        {projectStatus && (
                            <div>
                                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block mb-1">
                                    // PROJECT STATUS
                                </span>
                                <span className="px-2 py-0.5 text-[11px] font-bold text-white bg-zinc-900 border border-zinc-750 inline-block uppercase">
                                    {projectStatus}
                                </span>
                            </div>
                        )}

                        {collaborationDetails && (
                            <div>
                                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block mb-1">
                                    // COLLABORATION
                                </span>
                                <span className="text-xs text-zinc-200">
                                    {collaborationDetails}
                                </span>
                            </div>
                        )}

                        {availability && (
                            <div>
                                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block mb-1">
                                    // AVAILABILITY
                                </span>
                                <span className="text-xs text-zinc-200">
                                    {availability}
                                </span>
                            </div>
                        )}

                        {experience && (
                            <div>
                                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block mb-1">
                                    // EXPERIENCE
                                </span>
                                <span className="text-xs text-zinc-300">
                                    {experience}
                                </span>
                            </div>
                        )}

                        {background && (
                            <div>
                                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block mb-1">
                                    // BACKGROUND
                                </span>
                                <span className="text-xs text-zinc-300">
                                    {background}
                                </span>
                            </div>
                        )}
                        </div>
                    </div>
                )}
            </div>

            {/* 3. ROLE APPLIED FOR (EXACT APPLIED ROLE FOCUS) */}
            <div className="p-3.5 bg-zinc-950 border border-zinc-850 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-1">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">
                            // APPLIED ROLE
                        </span>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-white bg-zinc-900 border border-zinc-750 px-2.5 py-1">
                                {roleTitle}
                            </span>
                            {peopleNeeded !== null && (
                                <span className="text-[11px] text-zinc-400 font-bold bg-zinc-900/60 border border-zinc-800 px-2 py-1">
                                    PEOPLE NEEDED: <span className="text-white">×{peopleNeeded}</span>
                                </span>
                            )}
                        </div>
                    </div>

                    {appStatus === 'ACCEPTED' && (
                        <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-800 px-2 py-0.5">
                            // CONFIRMED COLLABORATOR
                        </span>
                    )}
                </div>

                {/* REQUIRED SKILLS */}
                {roleSkills.length > 0 && (
                    <div className="pt-2 border-t border-zinc-900 space-y-1">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">
                            // REQUIRED SKILLS
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                            {roleSkills.map((skill, sIdx) => (
                                <span
                                    key={sIdx}
                                    className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-300 text-[11px] font-mono"
                                >
                                    {skill}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* RESPONSIBILITIES */}
                {roleResponsibilities && (
                    <div className="pt-2 border-t border-zinc-900 space-y-1">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">
                            // RESPONSIBILITIES
                        </span>
                        <div className="bg-black/40 p-2.5 border border-zinc-900">
                            <CollapsibleText
                                text={roleResponsibilities}
                                lines={3}
                                className="text-xs text-zinc-300 leading-relaxed"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* 4. YOUR APPLICATION INFORMATION */}
            <div className="p-3.5 bg-black/80 border border-zinc-850 space-y-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-zinc-850">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">
                        // YOUR APPLICATION
                    </span>
                    <div className="flex items-center gap-3 text-[11px] text-zinc-400">
                        <span>
                            <span className="text-zinc-500 font-bold mr-1">// APPLIED:</span>
                            <span className="text-zinc-200">{formattedDate}</span>
                        </span>
                        <span>
                            <span className="text-zinc-500 font-bold mr-1">// STATUS:</span>
                            <span className={
                                appStatus === 'ACCEPTED'
                                    ? 'text-emerald-400 font-bold'
                                    : appStatus === 'PENDING'
                                    ? 'text-amber-400 font-bold'
                                    : 'text-zinc-400 font-bold'
                            }>
                                {appStatus}
                            </span>
                        </span>
                    </div>
                </div>

                {/* SUBMITTED MESSAGE */}
                <div className="space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">
                        // YOUR MESSAGE
                    </span>
                    {application.message?.trim() ? (
                        <div className="bg-zinc-950 p-2.5 border border-zinc-900">
                            <CollapsibleText
                                text={application.message}
                                lines={3}
                                className="text-xs text-zinc-300 leading-relaxed"
                            />
                        </div>
                    ) : (
                        <p className="text-xs text-zinc-500 italic bg-zinc-950 p-2 border border-zinc-900">
                            No custom message provided with application.
                        </p>
                    )}
                </div>

                {/* ATTACHED DOCUMENT */}
                {application.supportingDocument?.url && (
                    <div className="pt-2 border-t border-zinc-850 space-y-1.5">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">
                            // ATTACHED DOCUMENT
                        </span>
                        <div className="flex items-center justify-between gap-3 bg-zinc-950 p-2 border border-zinc-850">
                            <div className="flex items-center gap-2 min-w-0">
                                <svg className="w-4 h-4 text-zinc-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span className="truncate text-xs text-zinc-200">
                                    {application.supportingDocument.name || 'Application Attachment'}
                                </span>
                            </div>
                            <a
                                href={application.supportingDocument.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-[10px] text-white uppercase tracking-wider transition-colors inline-flex items-center gap-1 flex-shrink-0"
                            >
                                // VIEW DOCUMENT
                            </a>
                        </div>
                    </div>
                )}
            </div>

            {/* 5. ACTIONS: VIEW DETAILS & OPTIONAL WITHDRAW */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-850/80">
                <div>
                    {appStatus === 'PENDING' && onWithdraw && (
                        <button
                            type="button"
                            onClick={() => onWithdraw(application)}
                            disabled={isActionLoading}
                            className="px-3 py-1.5 bg-black hover:bg-red-950/40 border border-zinc-800 hover:border-red-800/80 text-zinc-400 hover:text-red-400 text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
                        >
                            {isActionLoading ? '...' : '// WITHDRAW APPLICATION'}
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => onViewDetails(application, targetCollab)}
                        className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-500 text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                    >
                        // VIEW DETAILS
                    </button>
                </div>
            </div>
        </article>
    );
};
