import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { lookupUserByInvoxId, normalizeInvoxId, isValidInvoxIdFormat } from '../../services/invoxIdService';
import { useAuth } from '../../contexts/AuthContext';
import { checkConnectionStatus, connectWithUser, disconnectFromUser } from '../../services/connectionService';
import { handleImageError } from '../utils/imageUtils';
import { ProfileIcon, CheckBadgeIcon, CloseIcon, MagnifyingGlassIcon } from './Icons';
import type { InvoxIdLookupResult, InvoxUser } from '../../types';

interface FindByInvoxIdModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialQuery?: string;
}

export const FindByInvoxIdModal: React.FC<FindByInvoxIdModalProps> = ({ isOpen, onClose, initialQuery = '' }) => {
    const navigate = useNavigate();
    const { currentUser, userProfile } = useAuth();

    const [inputId, setInputId] = useState(initialQuery);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<InvoxIdLookupResult | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<{ isConnected: boolean; isFollowedBy: boolean } | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [copied, setCopied] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setInputId(initialQuery);
            setResult(null);
            setConnectionStatus(null);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen, initialQuery]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Check connection status when a target user is resolved
    useEffect(() => {
        if (!result?.user?.uid || !currentUser?.uid) {
            setConnectionStatus(null);
            return;
        }

        if (result.user.uid === currentUser.uid) {
            // Own profile
            setConnectionStatus(null);
            return;
        }

        let isMounted = true;
        checkConnectionStatus(currentUser.uid, result.user.uid).then(status => {
            if (isMounted) setConnectionStatus(status);
        }).catch(err => {
            console.warn('[LOOKUP_CONN_CHECK]', err);
        });

        return () => {
            isMounted = false;
        };
    }, [result, currentUser?.uid]);

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const trimmed = inputId.trim();
        if (!trimmed) return;

        setLoading(true);
        setResult(null);
        setConnectionStatus(null);

        try {
            const lookupRes = await lookupUserByInvoxId(trimmed);
            setResult(lookupRes);
        } catch (err: any) {
            setResult({
                success: false,
                error: 'LOOKUP_FAILED',
                message: err?.message || 'An unexpected lookup error occurred.',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleToggleConnect = async () => {
        if (!currentUser || !result?.user?.uid || isConnecting) return;
        const targetUserId = result.user.uid;
        setIsConnecting(true);

        try {
            if (connectionStatus?.isConnected) {
                await disconnectFromUser(currentUser.uid, targetUserId);
                setConnectionStatus(prev => prev ? { ...prev, isConnected: false } : null);
            } else {
                await connectWithUser({
                    currentUser,
                    currentUserProfile: userProfile,
                    targetUserId,
                });
                setConnectionStatus(prev => prev ? { ...prev, isConnected: true } : null);
            }
        } catch (err) {
            console.error('[LOOKUP_TOGGLE_CONNECT_ERROR]', err);
        } finally {
            setIsConnecting(false);
        }
    };

    const handleCopyId = (id: string) => {
        navigator.clipboard.writeText(id).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const handleNavigateToProfile = (uid: string) => {
        onClose();
        navigate(`/profile/${uid}`);
    };

    if (!isOpen) return null;

    const normalizedPreview = normalizeInvoxId(inputId);
    const isValidFormat = Boolean(normalizedPreview && isValidInvoxIdFormat(normalizedPreview));

    return (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-mono transition-opacity"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="find-by-invox-id-title"
        >
            <div
                className="bg-[#0c0c0e] border border-zinc-800 w-full max-w-lg shadow-2xl overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-[#09090b]">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-white"></span>
                        <h2 id="find-by-invox-id-title" className="text-xs font-bold text-white tracking-widest uppercase">
                            // FIND_BY_INVOX_ID
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-zinc-500 hover:text-white p-1 border border-zinc-800 hover:border-zinc-700 transition-colors"
                        aria-label="Close modal"
                    >
                        <CloseIcon />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-5 space-y-4">
                    <p className="text-xs text-zinc-400 leading-relaxed">
                        Enter any member&apos;s permanent 6-character INVOX ID (e.g. <span className="text-white font-bold">IVX-7K9P2M</span>).
                    </p>

                    {/* Search Form */}
                    <form onSubmit={handleSearch} className="space-y-3">
                        <div className="relative">
                            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={inputId}
                                onChange={e => {
                                    setInputId(e.target.value);
                                    if (result) setResult(null);
                                }}
                                placeholder="IVX-XXXXXX"
                                autoCapitalize="characters"
                                spellCheck={false}
                                className="w-full bg-black border border-zinc-800 focus:border-zinc-500 focus:outline-none p-2.5 pl-9 text-xs text-white placeholder-zinc-600 font-mono tracking-wider uppercase transition-colors"
                            />
                            {inputId && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setInputId('');
                                        setResult(null);
                                    }}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-xs"
                                >
                                    ×
                                </button>
                            )}
                        </div>

                        {/* Format validation status hint */}
                        <div className="flex items-center justify-between text-[10px]">
                            {inputId.trim() ? (
                                isValidFormat ? (
                                    <span className="text-emerald-400 flex items-center gap-1">
                                        <span>✓</span> Normalized: {normalizedPreview}
                                    </span>
                                ) : (
                                    <span className="text-zinc-500">
                                        Expected: IVX- followed by 6 alphanumeric characters
                                    </span>
                                )
                            ) : (
                                <span className="text-zinc-600">Case-insensitive · Spaces & prefixes normalized</span>
                            )}
                            <button
                                type="submit"
                                disabled={loading || !inputId.trim()}
                                className={`px-4 py-1.5 uppercase font-bold text-xs tracking-wider transition-colors border ${
                                    loading || !inputId.trim()
                                        ? 'bg-zinc-900 border-zinc-800 text-zinc-600 cursor-not-allowed'
                                        : 'bg-white hover:bg-zinc-200 border-white text-black'
                                }`}
                            >
                                {loading ? '// SEARCHING...' : 'RESOLVE_ID'}
                            </button>
                        </div>
                    </form>

                    {/* Lookup Result Section */}
                    {result && (
                        <div className="pt-2 border-t border-zinc-800">
                            {result.success && result.user ? (
                                <div className="bg-[#09090b] border border-zinc-800 p-4 space-y-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-12 h-12 flex-shrink-0 bg-zinc-900 border border-zinc-800 overflow-hidden flex items-center justify-center">
                                                {result.user.photoURL ? (
                                                    <img
                                                        src={result.user.photoURL}
                                                        onError={handleImageError}
                                                        alt={result.user.displayName || 'User'}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <ProfileIcon className="w-6 h-6 text-zinc-600" />
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <h3 className="font-bold text-white text-xs truncate">
                                                        {result.user.displayName || 'Invox Member'}
                                                    </h3>
                                                    {result.user.role === 'admin' && (
                                                        <CheckBadgeIcon className="w-3.5 h-3.5 text-white flex-shrink-0" />
                                                    )}
                                                </div>
                                                <p className="text-[11px] text-zinc-500 truncate">@{result.user.username}</p>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className="text-[10px] text-zinc-400 bg-black px-1.5 py-0.5 border border-zinc-800 font-bold select-all">
                                                        {result.user.invoxId}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => result.user?.invoxId && handleCopyId(result.user.invoxId)}
                                                        className="text-[9px] text-zinc-500 hover:text-white uppercase transition-colors"
                                                    >
                                                        {copied ? '✓ COPIED' : 'COPY'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action buttons */}
                                        <div className="flex flex-col gap-1.5 flex-shrink-0">
                                            {result.user.uid !== currentUser?.uid && connectionStatus !== null && (
                                                <button
                                                    onClick={handleToggleConnect}
                                                    disabled={isConnecting}
                                                    className={`px-3 py-1 font-mono text-[10px] uppercase tracking-wider font-bold border transition-colors ${
                                                        connectionStatus.isConnected
                                                            ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300 hover:bg-rose-950/40 hover:text-rose-300 hover:border-rose-800'
                                                            : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-white'
                                                    }`}
                                                >
                                                    {isConnecting
                                                        ? 'SYNCING...'
                                                        : connectionStatus.isConnected
                                                            ? 'CONNECTED'
                                                            : '+ CONNECT'}
                                                </button>
                                            )}
                                            <button
                                                onClick={() => result.user?.uid && handleNavigateToProfile(result.user.uid)}
                                                className="px-3 py-1 bg-white hover:bg-zinc-200 text-black font-mono text-[10px] uppercase font-bold tracking-wider transition-colors"
                                            >
                                                VIEW_PROFILE &gt;
                                            </button>
                                        </div>
                                    </div>

                                    {/* Headline / Bio */}
                                    {result.user.headline && (
                                        <p className="text-xs text-zinc-300 line-clamp-2">{result.user.headline}</p>
                                    )}

                                    {/* Skills snippet */}
                                    {result.user.skills && result.user.skills.length > 0 && (
                                        <div className="flex flex-wrap gap-1 pt-1">
                                            {result.user.skills.slice(0, 4).map((skill, idx) => (
                                                <span
                                                    key={idx}
                                                    className="text-[9px] uppercase px-1.5 py-0.5 bg-black border border-zinc-800 text-zinc-400"
                                                >
                                                    {skill}
                                                </span>
                                            ))}
                                            {result.user.skills.length > 4 && (
                                                <span className="text-[9px] px-1 text-zinc-600">
                                                    +{result.user.skills.length - 4} more
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="bg-red-950/30 border border-red-900/60 p-4 text-center space-y-1">
                                    <p className="text-xs text-red-200 font-bold uppercase tracking-wider">
                                        // LOOKUP_ERROR
                                    </p>
                                    <p className="text-xs text-red-300/90">{result.message}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-zinc-800 bg-[#09090b] flex items-center justify-between text-[10px] text-zinc-500">
                    <span>INVOX DIRECTORY PROTOCOL v1.0</span>
                    <button onClick={onClose} className="hover:text-zinc-300 uppercase">
                        [CLOSE]
                    </button>
                </div>
            </div>
        </div>
    );
};

/**
 * Compact Inline Search Bar for Find by INVOX ID.
 * Usable directly inside sidebars or page feeds.
 */
export const FindByInvoxIdInlineBar: React.FC<{
    onResolved?: (user: Partial<InvoxUser> & { uid: string; invoxId: string }) => void;
    placeholder?: string;
}> = ({ onResolved, placeholder = 'FIND BY INVOX ID (IVX-XXXXXX)...' }) => {
    const navigate = useNavigate();
    const [idInput, setIdInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const handleLookup = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = idInput.trim();
        if (!trimmed) return;

        setLoading(true);
        setErrorMsg(null);

        try {
            const res = await lookupUserByInvoxId(trimmed);
            if (res.success && res.user) {
                if (onResolved) {
                    onResolved(res.user);
                } else {
                    navigate(`/profile/${res.user.uid}`);
                }
                setIdInput('');
            } else {
                setErrorMsg(res.message || 'No member found.');
            }
        } catch (err: any) {
            setErrorMsg(err?.message || 'Lookup failed.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full font-mono">
            <form onSubmit={handleLookup} className="relative flex items-center">
                <MagnifyingGlassIcon className="absolute left-3 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
                <input
                    type="search"
                    placeholder={placeholder}
                    value={idInput}
                    onChange={e => {
                        setIdInput(e.target.value);
                        if (errorMsg) setErrorMsg(null);
                    }}
                    autoCapitalize="characters"
                    className="w-full bg-[#0c0c0e] border border-zinc-800 p-2.5 pl-8 pr-16 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors uppercase font-mono tracking-wider"
                />
                <button
                    type="submit"
                    disabled={loading || !idInput.trim()}
                    className="absolute right-1.5 px-2 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white text-[10px] font-bold uppercase transition-colors"
                >
                    {loading ? '...' : 'FIND'}
                </button>
            </form>
            {errorMsg && (
                <p className="mt-1.5 text-[10px] text-red-400 bg-red-950/40 border border-red-900/60 p-1.5 font-mono">
                    {errorMsg}
                </p>
            )}
        </div>
    );
};
