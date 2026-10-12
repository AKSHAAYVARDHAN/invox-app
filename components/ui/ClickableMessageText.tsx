import React from 'react';
import { isInvoxAppUrl } from '../../utils/urlUtils';

// Regex to detect http:// and https:// URLs
const URL_REGEX = /(https?:\/\/[^\s<>"']+)/g;

interface ClickableMessageTextProps {
    text: string;
    className?: string;
}

export const ClickableMessageText: React.FC<ClickableMessageTextProps> = ({ text, className }) => {
    if (!text) return null;

    const parts = text.split(URL_REGEX);

    return (
        <span className={className}>
            {parts.map((part, index) => {
                if (/^https?:\/\//i.test(part)) {
                    let url = part;
                    let trailing = '';

                    // Separate trailing punctuation that isn't part of the URL (e.g. .,!?);:)
                    const match = url.match(/([.,!?:;)\]}]+)$/);
                    if (match) {
                        trailing = match[1];
                        url = url.slice(0, -trailing.length);
                    }

                    // Check if the URL is on the same host or canonical app URL (internal app link)
                    let isInternal = false;
                    let targetHash = '';
                    try {
                        if (typeof window !== 'undefined') {
                            const parsed = new URL(url);
                            if (parsed.host === window.location.host || isInvoxAppUrl(url)) {
                                isInternal = true;
                                if (parsed.hash) {
                                    targetHash = parsed.hash;
                                } else if (parsed.search && parsed.search.includes('invite=')) {
                                    const sp = new URLSearchParams(parsed.search);
                                    if (!sp.has('tab')) sp.set('tab', 'Collabs');
                                    if (!sp.has('collabView')) sp.set('collabView', 'teams');
                                    targetHash = '#/spotlight?' + sp.toString();
                                } else if (parsed.pathname && parsed.pathname !== '/') {
                                    targetHash = '#' + parsed.pathname + parsed.search;
                                } else if (parsed.search) {
                                    targetHash = '#/spotlight' + parsed.search;
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

                return <React.Fragment key={index}>{part}</React.Fragment>;
            })}
        </span>
    );
};

export default ClickableMessageText;
