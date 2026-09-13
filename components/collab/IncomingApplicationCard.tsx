import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { CollabApplication, Post } from '../../types';
import { getRoleCapacity } from '../../services/collabApplicationService';
import { CheckIcon, CloseIcon, CheckBadgeIcon } from '../ui/Icons';
import { handleImageError } from '../utils/imageUtils';
import { CollapsibleText } from './CollapsibleText';

export interface IncomingApplicationCardProps {
    application: CollabApplication;
    targetCollab?: Post | null;
    allApplications?: CollabApplication[];
    onOpenOverview?: (app: CollabApplication, collab?: Post | null) => void;
    onAccept?: (app: CollabApplication) => void;
    onDecline?: (app: CollabApplication) => void;
    isActionLoading?: boolean;
}

export const IncomingApplicationCard: React.FC<IncomingApplicationCardProps> = ({
    application,
    targetCollab,
    allApplications = [],
    onOpenOverview,
    onAccept,
    onDecline,
    isActionLoading = false,
}) => {
    const navigate = useNavigate();

    // 1. PROJECT DATA EXTRACTION
    const hookTitle = targetCollab?.aiSummary || targetCollab?.oneLine || application.collabTitle || 'Untitled Collab';
    const domain = (targetCollab?.domain || targetCollab?.category || application.collabDomain || '').toUpperCase();
    const overview = targetCollab?.content || targetCollab?.oneLine || application.collabOverview || '';

    const projectStatus = targetCollab?.collabDetails?.projectStatus
        ? targetCollab.collabDetails.projectStatus.toUpperCase()
        : undefined;

    const collaborationDetails = (() => {
        const types = targetCollab?.collabDetails?.collabTypes;
        const loc = targetCollab?.collabDetails?.location;
        const parts = [];
        if (types && types.length > 0) parts.push(types.join(', ').toUpperCase());
        if (loc) parts.push(loc.toUpperCase());
        return parts.length > 0 ? parts.join(' · ') : undefined;
    })();

    const availability = targetCollab?.collabDetails?.availability
        ? targetCollab.collabDetails.availability.toUpperCase()
        : undefined;

    const experience = targetCollab?.collabDetails?.experienceLevel
        ? targetCollab.collabDetails.experienceLevel.toUpperCase()
        : undefined;

    const background = targetCollab?.collabDetails?.preferredBackground
        ? targetCollab.collabDetails.preferredBackground.toUpperCase()
        : undefined;

    // 2. ROLE & CAPACITY RESOLUTION
    const rawRoles = targetCollab?.collabDetails?.roles || [];
    const role = rawRoles.find(r => r.id === application.roleId);
    const roleCapacity = role ? getRoleCapacity(role, allApplications) : null;
    const isFilled = Boolean(roleCapacity?.isFilled);

    // 3. APPLICANT DATA
    const applicantUid = application.applicantId || application.applicant?.uid || '';
    const applicantName = application.applicant?.displayName || 'Applicant';
    const applicantUsername = application.applicant?.username;
    const applicantPhoto = application.applicant?.photoURL;
    const applicantHeadline = application.applicant?.headline;
    const applicantBio = application.applicant?.bio;
    const applicantSkills = application.applicant?.skills;

    // 4. DATE FORMATTING
    const formatAppliedDate = (date: any) => {
        if (!date) return 'RECENT';
        try {
            const d = typeof date?.toDate === 'function' ? date.toDate() : new Date(date);
            return isNaN(d.getTime()) ? 'RECENT' : d.toLocaleDateString('en-GB');
        } catch {
            return 'RECENT';
        }
    };

    return (
        <article
            id={`incoming-app-${application.id}`}
            className="p-4 sm:p-5 bg-[#0c0c0e] border border-zinc-800 hover:border-zinc-700 transition-all font-mono text-zinc-300 space-y-4 shadow-sm"
        >
            {/* 1. PROJECT SECTION */}
            <div className="space-y-3 pb-3 border-b border-zinc-850">
                <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">
                        // PROJECT
                    </span>
                    {onOpenOverview && (
                        <button
                            type="button"
                            onClick={() => onOpenOverview(application, targetCollab)}
                            className="text-[10px] text-zinc-400 hover:text-white uppercase tracking-wider transition-colors px-2 py-1 bg-black/60 border border-zinc-800 hover:border-zinc-700 flex items-center gap-1 cursor-pointer"
                            title="View Collab Post Details"
                        >
                            <span>// VIEW POST</span>
                        </button>
                    )}
                </div>

                {/* Project Hook Title */}
                <h2 className="text-base sm:text-lg font-bold text-white leading-snug tracking-tight">
                    "{hookTitle}"
                </h2>

                {/* Structured Project Details Grid (Only active canonical values) */}
                {(domain || projectStatus || collaborationDetails || availability || experience || background) && (
                    <div className="p-3 bg-black/60 border border-zinc-850 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                        {domain && (
                            <div>
                                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block mb-1">
                                    // DOMAIN
                                </span>
                                <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-200 text-[11px] uppercase font-semibold inline-block">
                                    {domain}
                                </span>
                            </div>
                        )}
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
                                <span className="text-xs text-zinc-200">
                                    {experience}
                                </span>
                            </div>
                        )}
                        {background && (
                            <div>
                                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block mb-1">
                                    // BACKGROUND
                                </span>
                                <span className="text-xs text-zinc-200">
                                    {background}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {/* Project Overview with CollapsibleText lines={3} */}
                {overview && (
                    <div className="p-3 bg-black/60 border border-zinc-850 space-y-1">
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
            </div>

            {/* 2. APPLICANT SECTION */}
            <div className="space-y-3 pb-3 border-b border-zinc-850">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">
                        // APPLICANT
                    </span>
                    {applicantUid && (
                        <button
                            type="button"
                            onClick={() => navigate(`/profile/${applicantUid}`)}
                            className="text-[10px] text-zinc-300 hover:text-white uppercase tracking-wider transition-colors px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-750 hover:border-zinc-500 flex items-center gap-1.5 cursor-pointer"
                            title={`View ${applicantName}'s INVOX profile`}
                        >
                            <span>// VIEW PROFILE</span>
                            <span>↗</span>
                        </button>
                    )}
                </div>

                {/* Applicant Identity Card */}
                <div className="p-3.5 bg-black/60 border border-zinc-850 space-y-3">
                    <div className="flex items-start gap-3.5">
                        <button
                            type="button"
                            onClick={() => applicantUid && navigate(`/profile/${applicantUid}`)}
                            disabled={!applicantUid}
                            className="w-11 h-11 bg-zinc-900 border border-zinc-700 hover:border-zinc-500 flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors disabled:cursor-default"
                            title={`View ${applicantName}'s Profile`}
                        >
                            {applicantPhoto ? (
                                <img
                                    src={applicantPhoto}
                                    alt={applicantName}
                                    className="w-full h-full object-cover"
                                    onError={handleImageError}
                                />
                            ) : (
                                <span className="font-bold text-white text-sm">
                                    {applicantName.charAt(0).toUpperCase()}
                                </span>
                            )}
                        </button>

                        <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline gap-2">
                                <button
                                    type="button"
                                    onClick={() => applicantUid && navigate(`/profile/${applicantUid}`)}
                                    disabled={!applicantUid}
                                    className="font-bold text-white text-sm hover:underline text-left cursor-pointer disabled:no-underline"
                                >
                                    {applicantName}
                                </button>
                                {applicantUsername && (
                                    <span className="text-zinc-500 text-xs">
                                        @{applicantUsername}
                                    </span>
                                )}
                            </div>

                            {(applicantHeadline || applicantBio) && (
                                <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                                    {applicantHeadline || applicantBio}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Applied For Role & Role Capacity Status */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2.5 border-t border-zinc-800/80">
                        <div>
                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block mb-1">
                                // APPLIED FOR ROLE
                            </span>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="bg-zinc-900 border border-zinc-700 px-2 py-0.5 text-xs text-white font-bold">
                                    {application.roleTitle}
                                </span>
                                {roleCapacity ? (
                                    <span className={`text-[10px] px-1.5 py-0.5 border font-bold ${
                                        isFilled
                                            ? 'bg-zinc-900 text-zinc-500 border-zinc-800'
                                            : 'bg-emerald-950/40 text-emerald-400 border-emerald-800/80'
                                    }`}>
                                        {isFilled ? '// FILLED' : `// ${roleCapacity.remaining} OF ${roleCapacity.total} OPEN`}
                                    </span>
                                ) : (
                                    <span className="text-[10px] px-1.5 py-0.5 border bg-zinc-900 text-zinc-400 border-zinc-800">
                                        // 1 POSITION
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Applicant Skills if available */}
                        {applicantSkills && applicantSkills.length > 0 && (
                            <div>
                                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block mb-1">
                                    // APPLICANT SKILLS
                                </span>
                                <div className="flex flex-wrap gap-1">
                                    {applicantSkills.map((sk: string, idx: number) => (
                                        <span
                                            key={idx}
                                            className="text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-300 px-1.5 py-0.5"
                                        >
                                            {sk}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* WHY YOU? with CollapsibleText lines={3} */}
                <div className="p-3.5 bg-black/60 border border-zinc-850 space-y-2">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">
                        // WHY YOU?
                    </span>
                    {application.message?.trim() ? (
                        <CollapsibleText
                            text={application.message}
                            lines={3}
                            className="text-xs text-zinc-300 leading-relaxed"
                        />
                    ) : (
                        <p className="text-xs text-zinc-600 italic">
                            // NO MESSAGE PROVIDED
                        </p>
                    )}

                    {application.supportingDocument?.url && (
                        <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 text-xs text-zinc-400 truncate max-w-xs">
                                <span className="text-[10px] text-zinc-500 font-bold uppercase">// DOCUMENT:</span>
                                <span className="truncate text-zinc-300">{application.supportingDocument.name}</span>
                            </div>
                            <a
                                href={application.supportingDocument.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-750 hover:border-zinc-500 px-2.5 py-1 uppercase tracking-wider transition-colors inline-flex items-center gap-1 font-bold cursor-pointer"
                            >
                                <span>// VIEW DOCUMENT</span>
                                <span>↗</span>
                            </a>
                        </div>
                    )}
                </div>
            </div>

            {/* 3. APPLICATION FOOTER */}
            <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono">
                <div className="flex items-center gap-3">
                    <span className="text-[10px] text-zinc-500 tracking-wider">
                        APPLIED: <span className="text-zinc-300 font-bold">{formatAppliedDate(application.createdAt)}</span>
                    </span>
                    <span className="text-zinc-700">•</span>
                    <span className="text-[10px] text-zinc-500 tracking-wider">STATUS:</span>
                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                        application.status === 'ACCEPTED'
                            ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800'
                            : application.status === 'PENDING'
                            ? 'bg-amber-950/40 text-amber-400 border-amber-800'
                            : application.status === 'DECLINED'
                            ? 'bg-zinc-900 text-zinc-500 border-zinc-800'
                            : 'bg-zinc-950 text-zinc-600 border-zinc-850'
                    }`}>
                        // {application.status}
                    </span>
                </div>

                {application.status === 'PENDING' ? (
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => onAccept?.(application)}
                            disabled={isActionLoading || isFilled}
                            className="px-4 py-1.5 bg-white text-black hover:bg-zinc-200 border border-white text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
                            title={isFilled ? 'Role is already filled' : 'Accept Applicant'}
                        >
                            {isActionLoading ? (
                                <span className="animate-pulse">PROCESSING...</span>
                            ) : (
                                <>
                                    <CheckIcon className="w-3.5 h-3.5" />
                                    <span>// ACCEPT</span>
                                </>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() => onDecline?.(application)}
                            disabled={isActionLoading}
                            className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-750 hover:border-zinc-500 text-zinc-300 hover:text-white text-xs uppercase tracking-wider transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
                            title="Decline Applicant"
                        >
                            {isActionLoading ? '...' : (
                                <>
                                    <CloseIcon className="w-3.5 h-3.5" />
                                    <span>// DECLINE</span>
                                </>
                            )}
                        </button>
                    </div>
                ) : (
                    <div className="text-xs">
                        {application.status === 'ACCEPTED' ? (
                            <span className="text-emerald-400 font-bold">// APPLICANT CONFIRMED</span>
                        ) : (
                            <span className="text-zinc-500 italic">// APPLICATION ARCHIVED</span>
                        )}
                    </div>
                )}
            </div>
        </article>
    );
};
