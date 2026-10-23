import React from 'react';
import { handleImageError } from '../utils/imageUtils';
import { MagnifyingGlassIcon, SendIcon, PaperClipIcon } from '../ui/Icons';

export interface ConversationItemData {
    id: string;
    name: string;
    avatarUrl?: string | null;
    isTeam?: boolean;
    lastMessage?: string | null;
    lastMessageSender?: string | null;
    timestampStr?: string;
    unreadCount?: number;
    isSelected: boolean;
    subtitle?: string;
    isOnline?: boolean;
}

interface ConversationCardProps {
    data: ConversationItemData;
    onClick: () => void;
}

/**
 * Clean, compact conversation row component based on modern chat interfaces (Screenshot 2).
 * Highlights:
 * - Fixed height, clean alignment
 * - Crisp avatar with subtle border
 * - Top row: Name + relative timestamp
 * - Bottom row: Last message preview (truncated with ellipsis) + unread badge
 * - Subtle border-l selected state rather than large distracting background
 */
export const ConversationCard: React.FC<ConversationCardProps> = ({ data, onClick }) => {
    const {
        name,
        avatarUrl,
        isTeam,
        lastMessage,
        lastMessageSender,
        timestampStr,
        unreadCount = 0,
        isSelected,
        subtitle,
        isOnline,
    } = data;

    const hasUnread = unreadCount > 0 && !isSelected;

    return (
        <button
            type="button"
            onClick={onClick}
            className={`w-full h-[68px] px-3.5 py-2.5 text-left transition-colors flex items-center gap-3 border-l-2 cursor-pointer font-mono select-none outline-none focus-visible:bg-zinc-900/60 ${
                isSelected
                    ? 'bg-zinc-900/80 border-emerald-400 text-white'
                    : hasUnread
                    ? 'bg-zinc-900/30 border-emerald-500/80 text-zinc-100 hover:bg-zinc-900/50'
                    : 'bg-transparent border-transparent text-zinc-300 hover:bg-zinc-900/40 hover:border-zinc-700'
            }`}
        >
            {/* Conversation Avatar (Sharp, compact rectangular box) */}
            <div className="relative flex-shrink-0">
                <div
                    className={`w-9 h-9 sm:w-10 sm:h-10 bg-zinc-900 border flex items-center justify-center text-xs font-bold text-white overflow-hidden transition-colors ${
                        hasUnread ? 'border-emerald-700/80 ring-1 ring-emerald-500/30' : isSelected ? 'border-zinc-600' : 'border-zinc-800'
                    }`}
                >
                    {avatarUrl ? (
                        <img
                            src={avatarUrl}
                            alt={name}
                            className="w-full h-full object-cover"
                            onError={handleImageError}
                        />
                    ) : isTeam ? (
                        <span className="text-emerald-400 font-bold text-sm tracking-tighter">//</span>
                    ) : (
                        <span className="text-zinc-300">{name ? name.charAt(0).toUpperCase() : '?'}</span>
                    )}
                </div>
                {isOnline && (
                    <span
                        className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border border-black z-10"
                        title="Online"
                    />
                )}
            </div>

            {/* Conversation Content Details */}
            <div className="min-w-0 flex-1 flex flex-col justify-center gap-0.5">
                {/* Top Row: Name + Timestamp */}
                <div className="flex items-center justify-between gap-2">
                    <span
                        className={`text-xs truncate tracking-wide ${
                            isSelected || hasUnread ? 'font-bold text-white' : 'font-semibold text-zinc-200'
                        }`}
                    >
                        {name}
                    </span>
                    {timestampStr && (
                        <span
                            className={`text-[10px] font-mono flex-shrink-0 tabular-nums ${
                                hasUnread ? 'text-emerald-400 font-bold' : 'text-zinc-500'
                            }`}
                        >
                            {timestampStr}
                        </span>
                    )}
                </div>

                {/* Bottom Row: Latest message preview (with sender prefix) + Unread count */}
                <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p
                        className={`text-[11px] truncate leading-tight ${
                            hasUnread
                                ? 'text-zinc-200 font-medium'
                                : lastMessage
                                ? isSelected
                                    ? 'text-zinc-300'
                                    : 'text-zinc-400'
                                : subtitle
                                ? 'text-zinc-500'
                                : 'text-zinc-600 italic'
                        }`}
                    >
                        {lastMessage ? (
                            <>
                                {lastMessageSender && (
                                    <span className="text-zinc-400 font-normal">{lastMessageSender}: </span>
                                )}
                                <span>{lastMessage}</span>
                            </>
                        ) : subtitle ? (
                            <span>{subtitle}</span>
                        ) : (
                            <span>No messages yet</span>
                        )}
                    </p>

                    {hasUnread && (
                        <span className="font-mono font-bold text-[10px] px-1.5 py-0.2 bg-emerald-500 text-black flex-shrink-0 leading-tight">
                            {unreadCount}
                        </span>
                    )}
                </div>
            </div>
        </button>
    );
};

interface SearchInputProps {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
}

/**
 * Compact, polished search input for conversation sidebars.
 */
export const SearchInput: React.FC<SearchInputProps> = ({
    value,
    onChange,
    placeholder = 'Search conversations...',
}) => {
    return (
        <div className="h-[52px] px-3.5 py-2 border-b border-zinc-800 bg-[#0c0d10] flex items-center flex-shrink-0 font-mono">
            <div className="relative flex items-center w-full h-9 bg-[#121315] hover:bg-[#151619] border border-zinc-700 hover:border-zinc-500 focus-within:border-emerald-400 focus-within:ring-1 focus-within:ring-emerald-400/20 px-3 transition-colors duration-150 rounded-none">
                <MagnifyingGlassIcon className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0 mr-2.5 transition-colors pointer-events-none" />
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="w-full bg-transparent text-xs text-white placeholder:text-zinc-400 focus:outline-none font-mono tracking-wide h-full leading-none"
                />
                {value && (
                    <button
                        type="button"
                        onClick={() => onChange('')}
                        className="ml-1.5 text-zinc-400 hover:text-white px-1.5 py-0.5 hover:bg-zinc-800 transition-colors cursor-pointer flex-shrink-0 flex items-center justify-center font-mono text-xs leading-none"
                        title="Clear search"
                        aria-label="Clear search"
                    >
                        ✕
                    </button>
                )}
            </div>
        </div>
    );
};

interface ChatHeaderProps {
    title: string;
    subtitle?: string;
    avatarUrl?: string | null;
    isTeam?: boolean;
    onBackMobile?: () => void;
    children?: React.ReactNode;
    maxWidth?: string;
}

/**
 * Unified Chat Header component with compact alignment and consistent height.
 */
export const ChatHeader: React.FC<ChatHeaderProps> = ({
    title,
    subtitle,
    avatarUrl,
    isTeam,
    onBackMobile,
    children,
    maxWidth,
}) => {
    return (
        <div className="h-14 border-b border-zinc-800 bg-[#0c0c0e] flex-shrink-0 relative z-20 font-mono">
            <div
                className={`w-full h-full flex items-center justify-between gap-3 ${
                    maxWidth ? `${maxWidth} mx-auto px-4 sm:px-6 lg:px-8` : 'px-4'
                }`}
            >
                <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                    {onBackMobile && (
                        <button
                            type="button"
                            onClick={onBackMobile}
                            className="md:hidden text-xs text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer pr-1 flex-shrink-0 font-mono"
                            title="Back to conversation list"
                        >
                            <span>←</span>
                        </button>
                    )}

                    {/* Avatar */}
                    <div className="w-8 h-8 sm:w-9 sm:h-9 bg-zinc-900 border border-zinc-750 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white overflow-hidden">
                        {avatarUrl ? (
                            <img
                                src={avatarUrl}
                                alt={title}
                                className="w-full h-full object-cover"
                                onError={handleImageError}
                            />
                        ) : isTeam ? (
                            <span className="text-emerald-400 font-bold">//</span>
                        ) : (
                            <span>{title ? title.charAt(0).toUpperCase() : '?'}</span>
                        )}
                    </div>

                    {/* Title and Subtitle */}
                    <div className="min-w-0 flex flex-col justify-center">
                        <div className="flex items-center gap-2">
                            <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider truncate">
                                {title}
                            </h3>
                            {isTeam && (
                                <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-1 py-0.2 flex-shrink-0">
                                    TEAM
                                </span>
                            )}
                        </div>
                        {subtitle && (
                            <span className="text-[10px] text-zinc-400 font-mono truncate mt-0.5">
                                {subtitle}
                            </span>
                        )}
                    </div>
                </div>

                {/* Right-side Action slot */}
                {children && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {children}
                    </div>
                )}
            </div>
        </div>
    );
};

interface MessageComposerProps {
    value: string;
    onChange: (val: string) => void;
    onSend: () => void;
    placeholder?: string;
    disabled?: boolean;
    isSending?: boolean;
    textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
    onAttachFile?: () => void;
    maxWidth?: string;
}

/**
 * Clean bottom-anchored message composer with Enter-to-send support.
 */
export const MessageComposer: React.FC<MessageComposerProps> = ({
    value,
    onChange,
    onSend,
    placeholder = '// WRITE A MESSAGE...',
    disabled = false,
    isSending = false,
    textareaRef,
    onAttachFile,
    maxWidth,
}) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (value.trim() && !disabled && !isSending) {
                onSend();
            }
        }
    };

    return (
        <div className="border-t border-zinc-800 bg-[#0c0c0e] flex-shrink-0 z-10 font-mono">
            <div
                className={`w-full ${
                    maxWidth ? `${maxWidth} mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-3.5` : 'p-3 sm:p-3.5'
                }`}
            >
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (value.trim() && !disabled && !isSending) {
                            onSend();
                        }
                    }}
                    className="flex items-end gap-2"
                >
                    {onAttachFile && (
                        <button
                            type="button"
                            onClick={onAttachFile}
                            disabled={disabled || isSending}
                            className="h-10 w-10 flex items-center justify-center border border-zinc-800 bg-black/60 hover:bg-zinc-900 text-zinc-400 hover:text-white transition-colors cursor-pointer disabled:opacity-40 flex-shrink-0"
                            title="Attach file or image"
                        >
                            <PaperClipIcon className="w-4 h-4" />
                        </button>
                    )}

                    <textarea
                        ref={textareaRef}
                        rows={1}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                        disabled={disabled || isSending}
                        className="flex-1 bg-black/60 border border-zinc-800 focus:border-zinc-600 text-xs text-white px-3.5 py-2.5 resize-none focus:outline-none placeholder:text-zinc-600 leading-relaxed font-mono disabled:opacity-50 min-h-[40px] max-h-[120px] transition-colors"
                    />

                    <button
                        type="submit"
                        disabled={!value.trim() || disabled || isSending}
                        className="h-10 px-4 bg-white text-black hover:bg-zinc-200 border border-white text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex-shrink-0 flex items-center justify-center gap-1.5 font-mono"
                        title="Send message (Enter)"
                    >
                        {isSending ? (
                            <>
                                <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                <span className="hidden sm:inline">SENDING...</span>
                            </>
                        ) : (
                            <>
                                <span>SEND</span>
                                <SendIcon className="w-3 h-3 text-black" />
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

interface EmptyStateProps {
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
}

/**
 * Clean empty state for conversation list or chat timeline.
 */
export const EmptyMessagingState: React.FC<EmptyStateProps> = ({
    title,
    description,
    actionLabel,
    onAction,
}) => {
    return (
        <div className="p-8 text-center space-y-2 font-mono my-auto">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">
                {title}
            </span>
            <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
                {description}
            </p>
            {actionLabel && onAction && (
                <div className="pt-2">
                    <button
                        type="button"
                        onClick={onAction}
                        className="px-3.5 py-1.5 bg-white hover:bg-zinc-200 text-black font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                    >
                        {actionLabel}
                    </button>
                </div>
            )}
        </div>
    );
};
