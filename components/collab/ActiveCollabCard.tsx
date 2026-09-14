import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { CollabApplication, CollabRole, Post } from '../../types';
import { CheckBadgeIcon } from '../ui/Icons';
import { handleImageError } from '../utils/imageUtils';
import { CollapsibleText } from './CollapsibleText';

export interface ActiveCollabCardProps {
    application: CollabApplication;
    targetCollab?: Post | null;
    variant: 'my_collaborations' | 'my_offerings';
    otherAcceptedApplications?: CollabApplication[];
    onViewDetails: (app: CollabApplication, collab?: Post | null) => void;
}

export const ActiveCollabCard: React.FC<ActiveCollabCardProps> = ({
    application,
    targetCollab,
    variant,
    otherAcceptedApplications = [],
    onViewDetails,
}) => {
    const navigate = useNavigate();

    // 1. CANONICAL PROJECT METADATA
    const hookTitle = targetCollab?.aiSummary || targetCollab?.oneLine || application.collabTitle || 'Untitled Collab Project';
    const overview = targetCollab?.content || targetCollab?.description || application.collabOverview || '';
    const domain = (targetCollab?.domain || targetCollab?.category || application.collabDomain || 'Tech').toUpperCase();

    // Creator Metadata
    const isUserOffering = variant === 'my_offerings';
    const creatorName = targetCollab?.author?.name || application.collabCreatorName || (isUserOffering ? 'You (Creator)' : 'Project Lead');
    const creatorAvatar = targetCollab?.author?.avatarUrl || application.collabCreatorAvatar || `https://picsum.photos/seed/${targetCollab?.id || application.collabId}/200`;
    const creatorUsername = targetCollab?.author?.username;
    const isCreatorVerified = Boolean(targetCollab?.author?.isVerified);
    const creatorUid = targetCollab?.author?.uid || application.creatorId || application.ownerId;

    // Collab Details Specifications
    const collabDetails = targetCollab?.collabDetails;
    const projectStatus = collabDetails?.projectStatus?.toUpperCase() || 'ACTIVE PROJECT';

    const collaborationDetails = (() => {
        const types = collabDetails?.collabTypes;
        const loc = collabDetails?.location === 'Specific Location' && collabDetails?.specificLocation
            ? `Specific Location (${collabDetails.specificLocation})`
            : collabDetails?.location;
        const parts: string[] = [];
        if (Array.isArray(types) && types.length > 0) {
            parts.push(types.filter(Boolean).join(', ').toUpperCase());
        }
        if (loc) {
            parts.push(loc.toUpperCase());
        }
        return parts.length > 0 ? parts.join(' · ') : 'OPEN COLLABORATION';
    })();

    const availability = collabDetails?.availability?.toUpperCase() || 'FLEXIBLE';

    // 2. ROLE & SKILLS SPECIFICATIONS
    const rawRoles = collabDetails?.roles || [];
    const normalizedRoles: CollabRole[] = Array.isArray(rawRoles)
        ? rawRoles
        : (rawRoles && typeof rawRoles === 'object' ? Object.values(rawRoles) : []);

    const matchingRole = normalizedRoles.find(r => r.id === application.roleId)
        || normalizedRoles.find(r => r.title.toLowerCase() === (application.roleTitle || '').toLowerCase());

    const roleTitle = application.roleTitle || matchingRole?.title || 'Collaborator';
    const requiredSkills = Array.isArray(matchingRole?.skills) && matchingRole.skills.length > 0
        ? matchingRole.skills.filter(Boolean)
        : (Array.isArray(application.applicant?.skills) ? application.applicant.skills : []);

    // 3. COLLABORATOR (Applicant) METADATA
    const collaborator = application.applicant;
    const collaboratorName = collaborator?.displayName || 'Collaborator';
    const collaboratorUsername = collaborator?.username;
    const collaboratorAvatar = collaborator?.photoURL || `https://picsum.photos/seed/${application.applicantId}/200`;
    const collaboratorUid = application.applicantId || collaborator?.uid;

    // 4. CONFIRMED DATE
    const confirmedDate = application.updatedAt || application.createdAt;
    const formattedSince = confirmedDate
        ? (typeof confirmedDate.toDate === 'function'
            ? confirmedDate.toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
            : new Date(confirmedDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }))
        : 'Active';

    // 5. PARTICIPANTS LIST
    // In MY OFFERINGS: the current applicant + any other accepted applicants on this project
    // In MY COLLABORATIONS: other accepted applicants on this project (peers) + creator
    const peerParticipants = otherAcceptedApplications.filter(a => a.id !== application.id);

    return (
        <article
            id={`active-collab-${application.id}`}
            className="bg-[#0c0c0e] border border-zinc-800 hover:border-zinc-700 p-5 font-mono space-y-4 transition-all shadow-sm"
        >
            {/* 1. CREATOR / PROJECT OWNER + DOMAIN + ACTIVE BADGE */}
            <div className="space-y-3 pb-4 border-b border-zinc-850">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">
                            {isUserOffering ? '// YOU ARE THE CREATOR' : '// CREATOR / PROJECT OWNER'}
                        </span>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => creatorUid && navigate(`/profile/${creatorUid}`)}
                                disabled={!creatorUid}
                                className="w-10 h-10 bg-zinc-900 border border-zinc-700 hover:border-zinc-500 flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors disabled:cursor-default"
                                title={`View ${creatorName}'s Profile`}
                            >
                                <img
                                    src={creatorAvatar}
                                    alt={creatorName}
                                    onError={handleImageError}
                                    className="w-full h-full object-cover"
                                />
                            </button>
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <button
                                        type="button"
                                        onClick={() => creatorUid && navigate(`/profile/${creatorUid}`)}
                                        disabled={!creatorUid}
                                        className="font-bold text-white text-sm hover:underline text-left cursor-pointer disabled:no-underline"
                                    >
                                        {creatorName}
                                    </button>
                                    {isCreatorVerified && <CheckBadgeIcon className="w-3.5 h-3.5 text-zinc-400" />}
                                    {isUserOffering && (
                                        <span className="px-1.5 py-0.2 bg-zinc-900 border border-zinc-750 text-[9px] font-bold text-emerald-400 uppercase tracking-wider">
                                            // OWNER
                                        </span>
                                    )}
                                </div>
                                {creatorUsername && (
                                    <span className="text-[11px] text-zinc-500 block">
                                        @{creatorUsername}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-300">
                            {domain}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-emerald-950/70 border border-emerald-800 text-emerald-400">
                            // ACTIVE
                        </span>
                    </div>
                </div>

                {/* Project Hook Title */}
                <div className="pt-1">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block mb-1">
                        // PROJECT HOOK
                    </span>
                    <h3 className="text-base sm:text-lg font-bold text-white leading-snug">
                        "{hookTitle}"
                    </h3>
                </div>

                {/* Project Overview Preview */}
                {overview && (
                    <div className="pt-1">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block mb-1">
                            // PROJECT OVERVIEW
                        </span>
                        <div className="p-3 bg-black/60 border border-zinc-850 text-xs text-zinc-300 leading-relaxed">
                            <CollapsibleText text={overview} lines={3} />
                        </div>
                    </div>
                )}
            </div>

            {/* 2. PROJECT DETAILS SPECIFICATIONS */}
            <div className="space-y-2 pb-4 border-b border-zinc-850">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">
                    // PROJECT DETAILS
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                    <div className="p-2.5 bg-black/60 border border-zinc-850 space-y-1">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">
                            PROJECT STATUS
                        </span>
                        <span className="font-bold text-white text-xs block">
                            {projectStatus}
                        </span>
                    </div>
                    <div className="p-2.5 bg-black/60 border border-zinc-850 space-y-1">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">
                            COLLABORATION
                        </span>
                        <span className="font-bold text-zinc-200 text-xs block truncate" title={collaborationDetails}>
                            {collaborationDetails}
                        </span>
                    </div>
                    <div className="p-2.5 bg-black/60 border border-zinc-850 space-y-1">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">
                            AVAILABILITY
                        </span>
                        <span className="font-bold text-zinc-200 text-xs block">
                            {availability}
                        </span>
                    </div>
                </div>
            </div>

            {/* 3. COLLABORATION: CONTEXT-ADAPTED RELATIONSHIP (ROLE & SKILLS) */}
            <div className="space-y-2 pb-4 border-b border-zinc-850">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">
                    // COLLABORATION
                </span>

                <div className="p-3.5 bg-black/60 border border-zinc-850 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <span className="text-zinc-500 text-xs font-bold">
                                {isUserOffering ? 'CONFIRMED ROLE FOR COLLABORATOR:' : 'YOUR ROLE:'}
                            </span>
                            <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-emerald-400 font-bold text-xs">
                                {roleTitle}
                            </span>
                        </div>
                    </div>

                    {/* Role Responsibilities if specified */}
                    {matchingRole?.responsibilities && (
                        <div className="text-xs text-zinc-300">
                            <span className="text-zinc-500 font-bold mr-1">// ROLE SCOPE:</span>
                            {matchingRole.responsibilities}
                        </div>
                    )}

                    {/* Required Skills */}
                    {requiredSkills.length > 0 && (
                        <div className="space-y-1">
                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">
                                // REQUIRED SKILLS:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                                {requiredSkills.map((sk, idx) => (
                                    <span
                                        key={idx}
                                        className="text-[10px] bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-zinc-300"
                                    >
                                        {sk}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 4. PARTICIPANTS */}
            <div className="space-y-2 pb-4 border-b border-zinc-850">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">
                        // PARTICIPANTS
                    </span>
                    <span className="text-[10px] text-zinc-500">
                        {isUserOffering
                            ? `${1 + peerParticipants.length} CONFIRMED COLLABORATOR${1 + peerParticipants.length === 1 ? '' : 'S'}`
                            : 'CREATOR & CONFIRMED TEAM'}
                    </span>
                </div>

                <div className="space-y-2">
                    {/* Primary Collaborator in this application */}
                    <div className="p-2.5 bg-black/60 border border-zinc-850 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <button
                                type="button"
                                onClick={() => collaboratorUid && navigate(`/profile/${collaboratorUid}`)}
                                disabled={!collaboratorUid}
                                className="w-8 h-8 bg-zinc-900 border border-zinc-700 hover:border-zinc-500 flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors disabled:cursor-default"
                                title={`View ${collaboratorName}'s profile`}
                            >
                                <img
                                    src={collaboratorAvatar}
                                    alt={collaboratorName}
                                    onError={handleImageError}
                                    className="w-full h-full object-cover"
                                />
                            </button>
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => collaboratorUid && navigate(`/profile/${collaboratorUid}`)}
                                        disabled={!collaboratorUid}
                                        className="font-bold text-white text-xs truncate hover:underline text-left cursor-pointer disabled:no-underline"
                                    >
                                        {collaboratorName}
                                    </button>
                                    {!isUserOffering && (
                                        <span className="text-[9px] text-zinc-400 font-bold">// YOU</span>
                                    )}
                                </div>
                                {collaboratorUsername && (
                                    <span className="text-[10px] text-zinc-500 block truncate">
                                        @{collaboratorUsername}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-[10px] px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-300 font-bold">
                                {roleTitle}
                            </span>
                            {collaboratorUid && (
                                <button
                                    type="button"
                                    onClick={() => navigate(`/profile/${collaboratorUid}`)}
                                    className="text-[10px] text-zinc-400 hover:text-white uppercase px-2 py-0.5 border border-zinc-800 hover:border-zinc-700 bg-zinc-950 transition-colors"
                                >
                                    VIEW PROFILE
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Other Accepted Peer Collaborators on this project (if any) */}
                    {peerParticipants.map((peer) => {
                        const peerName = peer.applicant?.displayName || 'Collaborator';
                        const peerUsername = peer.applicant?.username;
                        const peerAvatar = peer.applicant?.photoURL || `https://picsum.photos/seed/${peer.applicantId}/200`;
                        const peerUid = peer.applicantId || peer.applicant?.uid;

                        return (
                            <div key={peer.id} className="p-2.5 bg-black/40 border border-zinc-850 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <button
                                        type="button"
                                        onClick={() => peerUid && navigate(`/profile/${peerUid}`)}
                                        disabled={!peerUid}
                                        className="w-8 h-8 bg-zinc-900 border border-zinc-700 hover:border-zinc-500 flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors disabled:cursor-default"
                                        title={`View ${peerName}'s profile`}
                                    >
                                        <img
                                            src={peerAvatar}
                                            alt={peerName}
                                            onError={handleImageError}
                                            className="w-full h-full object-cover"
                                        />
                                    </button>
                                    <div className="min-w-0">
                                        <button
                                            type="button"
                                            onClick={() => peerUid && navigate(`/profile/${peerUid}`)}
                                            disabled={!peerUid}
                                            className="font-bold text-white text-xs truncate hover:underline text-left cursor-pointer disabled:no-underline block"
                                        >
                                            {peerName}
                                        </button>
                                        {peerUsername && (
                                            <span className="text-[10px] text-zinc-500 block truncate">
                                                @{peerUsername}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className="text-[10px] px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-300 font-bold">
                                        {peer.roleTitle}
                                    </span>
                                    {peerUid && (
                                        <button
                                            type="button"
                                            onClick={() => navigate(`/profile/${peerUid}`)}
                                            className="text-[10px] text-zinc-400 hover:text-white uppercase px-2 py-0.5 border border-zinc-800 hover:border-zinc-700 bg-zinc-950 transition-colors"
                                        >
                                            VIEW PROFILE
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 5. FOOTER: SINCE + ACTIVE + VIEW DETAILS */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-3">
                    <span className="text-[11px] text-zinc-500 font-bold">
                        SINCE: <span className="text-zinc-300 font-normal">{formattedSince}</span>
                    </span>
                    <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                        // ACTIVE
                    </span>
                </div>

                <div>
                    <button
                        type="button"
                        onClick={() => onViewDetails(application, targetCollab)}
                        className="px-3.5 py-1.5 bg-white text-black hover:bg-zinc-200 text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1 cursor-pointer"
                    >
                        <span>// VIEW DETAILS</span>
                        <span>→</span>
                    </button>
                </div>
            </div>
        </article>
    );
};
