import React from 'react';
import { isInvoxAppUrl, parseTeamInvitationUrl } from '../../utils/urlUtils';
import { TeamInvitationCard } from './TeamInvitationCard';

// Regex to detect http://, https://, and in-app hash routes
const URL_REGEX = /(https?:\/\/[^\s<>"']+|#\/[^\s<>"']+)/g;

interface ClickableMessageTextProps {
    text: string;
    className?: string;
    searchTerm?: string;
    timestamp?: string;
    isSender?: boolean;
}

export const ClickableMessageText: React.FC<ClickableMessageTextProps> = ({
    text,
    className,
    searchTerm,
    timestamp,
    isSender = false,
}) => {
    if (!text) return null;

    const highlightText = (rawStr: string, query?: string) => {
        if (!query || !query.trim() || !rawStr) {
            return rawStr;
        }
        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        const textParts = rawStr.split(regex);
        return (
            <>
                {textParts.map((tPart, tIdx) =>
                    tPart.toLowerCase() === query.toLowerCase() ? (
                        <mark key={tIdx} className="bg-white text-black font-bold px-1">
                            {tPart}
                        </mark>
                    ) : (
                        tPart
                    )
                )}
            </>
        );
    };

    const parts = text.split(URL_REGEX);

    return (
        <div className={className}>
            {parts.map((part, index) => {
                if (/^(https?:\/\/|#\/)/i.test(part)) {
                    let url = part;
                    let trailing = '';

                    // Separate trailing punctuation that isn't part of the URL (e.g. .,!?);:)
                    const match = url.match(/([.,!?:;)\]}]+)$/);
                    if (match) {
                        trailing = match[1];
                        url = url.slice(0, -trailing.length);
                    }

                    // 1. Check if this is an INVOX team invitation URL
                    const teamInvite = parseTeamInvitationUrl(url);
                    if (teamInvite) {
                        return (
                            <div key={index} className="my-1.5 not-prose max-w-full min-w-0 overflow-hidden">
                                <TeamInvitationCard
                                    inviteUrl={teamInvite.originalUrl}
                                    token={teamInvite.token}
                                    teamId={teamInvite.teamId}
                                    targetHash={teamInvite.targetHash}
                                    timestamp={timestamp}
                                    isSender={isSender}
                                    className="max-w-full"
                                />
                                {trailing && <span className="inline">{trailing}</span>}
                            </div>
                        );
                    }

                    // 2. Normal URL handling (internal navigation or external link)
                    let isInternal = false;
                    let targetHash = '';
                    try {
                        if (typeof window !== 'undefined') {
                            if (url.startsWith('#/')) {
                                isInternal = true;
                                targetHash = url;
                            } else {
                                const parsed = new URL(url);
                                if (parsed.host === window.location.host || isInvoxAppUrl(url)) {
                                    isInternal = true;
                                    if (parsed.hash) {
                                        targetHash = parsed.hash;
                                    } else if (parsed.pathname && parsed.pathname !== '/') {
                                        targetHash = '#' + parsed.pathname + parsed.search;
                                    } else if (parsed.search) {
                                        targetHash = '#/spotlight' + parsed.search;
                                    }
                                }
                            }
                        }
                    } catch {
                        // ignore malformed URLs
                    }

                    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
                        // If same-origin and clicked normally without modifier keys, update hash smoothly
                        if (isInternal && targetHash && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && e.button === 0) {
                            e.preventDefault();
                            window.location.hash = targetHash;
                        }
                    };

                    return (
                        <React.Fragment key={index}>
                            <a
                                href={url}
                                target={isInternal ? '_self' : '_blank'}
                                rel="noopener noreferrer"
                                onClick={handleClick}
                                className="underline decoration-blue-400/70 hover:decoration-blue-300 text-blue-400 hover:text-blue-300 break-all transition-colors cursor-pointer"
                                title={url}
                            >
                                {url}
                            </a>
                            {trailing}
                        </React.Fragment>
                    );
                }

                return (
                    <React.Fragment key={index}>
                        {highlightText(part, searchTerm)}
                    </React.Fragment>
                );
            })}
        </div>
    );
};

export default ClickableMessageText;
