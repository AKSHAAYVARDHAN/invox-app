
import React, { useState, useRef, useEffect } from 'react';
import type { HubConversation, Message } from '../../types';
import { handleImageError } from '../utils/imageUtils';
import { generateChatSummary } from '../../services/geminiService';
import { 
    EllipsisVerticalIcon, 
    ArrowLeftIcon,
    PaperClipIcon,
    MicrophoneIcon,
    SendIcon,
    SparklesIcon,
    CheckIcon,
    FaceSmileIcon,
    DocumentTextIcon,
    SoundWaveIcon,
    StopCircleIcon,
    PlayIcon,
    TrashIcon,
    UsersIcon,
    ProfileIcon,
    BellIcon,
    DoubleCheckIcon,
    MagnifyingGlassIcon,
    CloseIcon,
    ArrowUpIcon,
    ArrowDownIcon,
    ChevronDownIcon,
    ArrowUturnLeftIcon,
    ClipboardIcon,
    ForwardIcon,
    StarOutlineIcon,
    MapPinIcon,
    PencilIcon,
    ShareIcon,
    InformationCircleIcon,
    PlusIcon,
    CalendarDaysIcon,
    ClockIcon,
} from '../ui/Icons';

const cannedResponses = [ "That's interesting! Tell me more.", "I see. What are your thoughts on that?", "Got it, thanks for the update.", "Let me think about that for a moment.", "Haha, that's a good one!", "Okay, I'll check it out." ];
const getRandomReply = () => cannedResponses[Math.floor(Math.random() * cannedResponses.length)];

// Sub-components for ChatInterface

interface HeaderProps {
    conversation: HubConversation;
    onBack: () => void;
    userStatus: { text: string; color: string } | null;
    menuRef: React.RefObject<HTMLDivElement>;
    isMenuOpen: boolean;
    setIsMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
    isSearchOpen: boolean;
    setIsSearchOpen: React.Dispatch<React.SetStateAction<boolean>>;
    searchTerm: string;
    setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
    searchResultCount: number;
    currentResultIndex: number;
    onPrevResult: () => void;
    onNextResult: () => void;
    onSummarize: () => void;
}

const Header: React.FC<HeaderProps> = ({ conversation, onBack, userStatus, menuRef, isMenuOpen, setIsMenuOpen, isSearchOpen, setIsSearchOpen, searchTerm, setSearchTerm, searchResultCount, currentResultIndex, onPrevResult, onNextResult, onSummarize }) => {
    const searchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isSearchOpen) {
            searchInputRef.current?.focus();
        } else {
            setSearchTerm(''); // Clear search term when closing
        }
    }, [isSearchOpen, setSearchTerm]);
    
    return (
        <div className="flex items-center justify-between p-4 border-b border-gray-800/60 bg-invox-dark/80 backdrop-blur-md flex-shrink-0 sticky top-0 z-20">
            <div className="flex items-center gap-3 flex-grow min-w-0">
                <button onClick={onBack} className="p-2 rounded-full hover:bg-white/5 transition-colors" aria-label="Back to conversations"><ArrowLeftIcon className="w-6 h-6 text-white" /></button>
                {isSearchOpen ? (
                     <input
                        ref={searchInputRef}
                        type="search"
                        placeholder="Search in chat..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-transparent focus:outline-none text-white text-lg"
                    />
                ) : (
                    <>
                        <img src={conversation.avatarUrl} onError={handleImageError} alt={conversation.name} className="w-11 h-11 rounded-full object-cover shadow-lg border border-gray-800" />
                        <div className="overflow-hidden">
                            <p className="font-bold text-white text-lg truncate">{conversation.name}</p>
                            {userStatus && <p className={`text-xs font-medium tracking-wide uppercase ${userStatus.color}`}>{userStatus.text}</p>}
                        </div>
                    </>
                )}
            </div>
            <div className="flex items-center gap-2">
                {isSearchOpen ? (
                    <>
                        {searchResultCount > 0 && (
                            <div className="flex items-center gap-2 text-sm text-gray-400 font-mono bg-gray-900/50 px-3 py-1 rounded-full">
                                <span>{currentResultIndex + 1} / {searchResultCount}</span>
                                <div className="flex items-center gap-1 ml-2 border-l border-gray-700 pl-2">
                                    <button onClick={onPrevResult} disabled={searchResultCount <= 1} className="p-1 rounded-full hover:bg-gray-700 disabled:opacity-30"><ArrowUpIcon className="w-4 h-4" /></button>
                                    <button onClick={onNextResult} disabled={searchResultCount <= 1} className="p-1 rounded-full hover:bg-gray-700 disabled:opacity-30"><ArrowDownIcon className="w-4 h-4" /></button>
                                </div>
                            </div>
                        )}
                        <button onClick={() => setIsSearchOpen(false)} className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/5"><CloseIcon className="w-6 h-6" /></button>
                    </>
                ) : (
                    <>
                        <button onClick={onSummarize} className="text-gray-400 hover:text-invox-red p-2 rounded-full hover:bg-white/5 transition-colors" aria-label="Summarize Chat">
                            <SparklesIcon className="w-6 h-6" />
                        </button>
                        <button onClick={() => setIsSearchOpen(true)} className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/5 transition-colors" aria-label="Search Chat">
                            <MagnifyingGlassIcon className="w-6 h-6" />
                        </button>
                    </>
                )}

                <div className="relative" ref={menuRef}>
                    <button onClick={() => setIsMenuOpen(prev => !prev)} className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/5 transition-colors"><EllipsisVerticalIcon className="w-6 h-6" /></button>
                    {isMenuOpen && <HeaderMenu onBack={onBack} conversationName={conversation.name} />}
                </div>
            </div>
        </div>
    );
};

const HeaderMenu: React.FC<{ onBack: () => void, conversationName: string }> = ({ onBack, conversationName }) => {
    const handleAction = (action: string) => {
        if (action === 'delete') {
            if (window.confirm(`Are you sure you want to delete this chat with ${conversationName}?`)) onBack();
        } else {
            alert(`Action: ${action}`);
        }
    };
    const menuItems = [ { label: 'View Profile', icon: ProfileIcon, action: 'view' }, { label: 'Mute Notifications', icon: BellIcon, action: 'mute' }, { label: 'Block User', icon: UsersIcon, action: 'block' }, { label: 'Delete Chat', icon: TrashIcon, action: 'delete', isDestructive: true } ];
    return (
        <div className="absolute right-0 top-full mt-2 w-56 bg-invox-dark-accent border border-gray-700 shadow-2xl z-30 py-1 rounded-xl animate-fadeInUp">
            {menuItems.map(item => (
                <button key={item.action} onClick={() => handleAction(item.action)} className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors ${item.isDestructive ? 'text-red-400 hover:bg-red-500/10' : 'text-gray-200 hover:bg-gray-700'}`}>
                    <item.icon className="w-5 h-5" />
                    <span>{item.label}</span>
                </button>
            ))}
        </div>
    );
};

interface MessageAreaProps {
    messageContainerRef: React.RefObject<HTMLDivElement>;
    onScroll: () => void;
    groupedMessages: Record<string, Message[]>;
    messagesEndRef: React.RefObject<HTMLDivElement>;
    isTyping: boolean;
    searchTerm: string;
    searchResults: string[];
    currentResultIndex: number;
    messageRefs: React.MutableRefObject<Map<string, HTMLDivElement | null>>;
    menuForMessage: string | null;
    setMenuForMessage: (id: string | null) => void;
}

const MessageArea: React.FC<MessageAreaProps> = ({ messageContainerRef, onScroll, groupedMessages, messagesEndRef, isTyping, searchTerm, searchResults, currentResultIndex, messageRefs, menuForMessage, setMenuForMessage }) => (
    <div ref={messageContainerRef} onScroll={onScroll} className="flex-grow px-4 md:px-8 py-6 overflow-y-auto no-scrollbar bg-invox-dark">
        <div className="max-w-7xl mx-auto w-full">
            {Object.entries(groupedMessages).map(([dateStr, msgs]: [string, Message[]]) => (
                <div key={dateStr}>
                    <DateSeparator date={new Date(dateStr)} />
                    {msgs.map(msg => <MessageBubble 
                        key={msg.id} 
                        ref={el => messageRefs.current.set(msg.id, el)}
                        msg={msg} 
                        searchTerm={searchTerm}
                        isCurrent={searchResults[currentResultIndex] === msg.id}
                        isMenuOpen={menuForMessage === msg.id}
                        onMenuToggle={() => setMenuForMessage(currentId => (currentId === msg.id ? null : msg.id))}
                    />)}
                </div>
            ))}
            {isTyping && <TypingIndicator />}
            <div ref={messagesEndRef} />
        </div>
    </div>
);

const TypingIndicator = () => (
    <div className="flex items-end gap-2 mb-4 justify-start animate-message-in">
        <div className="max-w-md p-4 rounded-2xl bg-invox-dark-accent rounded-bl-none shadow-sm">
            <div className="flex items-center gap-1.5 h-5">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
            </div>
        </div>
    </div>
);

const DateSeparator = ({ date }: { date: Date }) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const label = date.toDateString() === today.toDateString() ? 'Today' : date.toDateString() === yesterday.toDateString() ? 'Yesterday' : date.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    return <div className="text-center text-xs font-bold text-gray-500 my-8 uppercase tracking-widest flex items-center gap-4">
        <div className="h-px bg-gray-800 flex-grow"></div>
        <span>{label}</span>
        <div className="h-px bg-gray-800 flex-grow"></div>
    </div>;
};

const StatusIndicator: React.FC<{ status: Message['status'] }> = ({ status }) => {
    switch (status) {
        case 'read':
            return <DoubleCheckIcon className="w-4 h-4 text-blue-400" />;
        case 'delivered':
            return <DoubleCheckIcon className="w-4 h-4 text-gray-500" />;
        case 'sent':
            return <CheckIcon className="w-4 h-4 text-gray-500" />;
        default: // 'sending' or undefined
            return null;
    }
};

const MessageContextMenu: React.FC<{ onClose: () => void; context: 'sender' | 'receiver' }> = ({ onClose, context }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);
    
    const isSender = context === 'sender';

    const menuItems = [
        { label: 'Reply', icon: ArrowUturnLeftIcon },
        { label: 'Copy', icon: ClipboardIcon },
        { label: 'Forward', icon: ForwardIcon },
        { label: 'Star', icon: StarOutlineIcon },
        { label: 'Pin', icon: MapPinIcon },
        isSender && { label: 'Edit', icon: PencilIcon },
        { label: isSender ? 'Delete' : 'Delete for me', icon: TrashIcon },
        { label: 'Select', icon: CheckIcon },
        { label: 'Share', icon: ShareIcon },
        isSender && { label: 'Info', icon: InformationCircleIcon }
    ].filter(Boolean) as {label: string, icon: React.FC<any>}[];

    const reactions = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

    return (
        <div ref={menuRef} className="w-72 bg-invox-dark-accent rounded-xl shadow-2xl border border-gray-800 flex flex-col animate-fadeInUp">
            <div className="py-1">
                {menuItems.map(item => (
                    <button key={item.label} onClick={() => { alert(item.label); onClose(); }} className="w-full flex items-center gap-4 px-4 py-3 text-sm text-gray-200 hover:bg-gray-700 transition-colors">
                        <item.icon className="w-5 h-5" />
                        <span>{item.label}</span>
                    </button>
                ))}
            </div>
            <div className="border-t border-gray-700/50 my-1"></div>
            <div className="flex items-center justify-between px-3 py-2">
                {reactions.map(emoji => (
                    <button key={emoji} className="text-2xl p-1 rounded-md hover:bg-gray-700 transition-all transform hover:scale-125 active:scale-95">{emoji}</button>
                ))}
                <button className="p-1 rounded-md hover:bg-gray-700 text-gray-400">
                    <PlusIcon className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};

const MessageBubble = React.forwardRef<HTMLDivElement, { msg: Message; searchTerm: string; isCurrent: boolean; isMenuOpen: boolean; onMenuToggle: () => void; }>(({ msg, searchTerm, isCurrent, isMenuOpen, onMenuToggle }, ref) => {
    
    const highlightText = (text: string, highlight: string) => {
        if (!highlight.trim() || !text) {
            return text;
        }
        const regex = new RegExp(`(${highlight})`, 'gi');
        const parts = text.split(regex);
        return (
            <>
                {parts.map((part, index) =>
                    part.toLowerCase() === highlight.toLowerCase() ? (
                        <mark key={index} className="bg-yellow-400 text-black rounded px-0.5">
                            {part}
                        </mark>
                    ) : (
                        part
                    )
                )}
            </>
        );
    };

    let content;
    switch(msg.type) {
        case 'image': content = <img src={msg.mediaUrl} alt="attachment" className="rounded-xl max-w-xs cursor-pointer shadow-lg" />; break;
        case 'file': content = <FileMessage fileInfo={msg.fileInfo!} />; break;
        case 'voice': content = <VoiceMessage duration={msg.voiceDuration!} />; break;
        default: content = <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{highlightText(msg.text!, searchTerm)}</p>;
    }

    return (
        <div ref={ref} className={`relative flex items-start mb-6 group animate-message-in ${msg.sender === 'me' ? 'justify-end' : 'justify-start'} ${isMenuOpen ? 'z-10' : ''}`}>
            <div className={`flex items-start`}>
                {msg.sender === 'me' && (
                    <div className="relative flex-shrink-0 self-center mr-3">
                        <button onClick={onMenuToggle} className="p-1.5 rounded-full text-gray-500 bg-transparent opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity z-10 hover:text-white">
                            <ChevronDownIcon className="w-4 h-4" />
                        </button>
                        {isMenuOpen && (
                            <div className="absolute top-0 right-full mr-2 z-20">
                                <MessageContextMenu onClose={onMenuToggle} context="sender" />
                            </div>
                        )}
                    </div>
                )}
                
                <div className={`max-w-xl p-4 rounded-2xl transition-all duration-300 ring-2 shadow-sm ${isCurrent ? 'ring-invox-red ring-offset-2 ring-offset-invox-dark scale-[1.02]' : 'ring-transparent'} ${msg.sender === 'me' ? 'bg-invox-red text-white rounded-br-none' : 'bg-invox-dark-accent text-gray-200 rounded-bl-none'}`}>
                    {content}
                    <div className={`text-[10px] mt-2 flex items-center gap-1.5 font-medium tracking-tight ${msg.sender === 'me' ? 'text-white/70 justify-end' : 'text-gray-500'}`}>
                        <span>{msg.timestamp}</span>
                        {msg.sender === 'me' && <StatusIndicator status={msg.status} />}
                    </div>
                </div>

                {msg.sender === 'other' && (
                    <div className="relative flex-shrink-0 self-center ml-3">
                        <button onClick={onMenuToggle} className="p-1.5 rounded-full text-gray-500 bg-transparent opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity z-10 hover:text-white">
                            <ChevronDownIcon className="w-4 h-4" />
                        </button>
                        {isMenuOpen && (
                            <div className="absolute top-0 left-full ml-2 z-20">
                                <MessageContextMenu onClose={onMenuToggle} context="receiver" />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
});

const FileMessage: React.FC<{ fileInfo: { name: string; size: string; } }> = ({ fileInfo }) => (
    <div className="flex items-center gap-3 p-3 bg-black/30 rounded-xl border border-white/5">
        <DocumentTextIcon className="w-9 h-9 text-invox-red flex-shrink-0" />
        <div className="overflow-hidden">
            <p className="font-bold truncate text-sm">{fileInfo.name}</p>
            <p className="text-[10px] text-gray-400 uppercase font-black tracking-wider">{fileInfo.size}</p>
        </div>
    </div>
);

const VoiceMessage: React.FC<{ duration: string }> = ({ duration }) => (
    <div className="flex items-center gap-4 p-1">
        <button className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors shadow-sm"><PlayIcon className="w-5 h-5 text-white" /></button>
        <div className="flex items-center gap-1.5 flex-grow">
            <SoundWaveIcon className="w-14 h-7 text-white/40" />
            <div className="w-32 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-white/40 w-0"></div>
            </div>
        </div>
        <span className="text-xs font-mono text-white/80 tabular-nums">{duration}</span>
    </div>
);

interface InputBarProps {
    newMessage: string;
    setNewMessage: React.Dispatch<React.SetStateAction<string>>;
    handleSend: (text: string) => void;
    isRecording: boolean;
    toggleRecording: () => void;
    recordingTime: number;
    fileInputRef: React.RefObject<HTMLInputElement>;
    handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
    emojiPickerRef: React.RefObject<HTMLDivElement>;
    isEmojiPickerOpen: boolean;
    setIsEmojiPickerOpen: React.Dispatch<React.SetStateAction<boolean>>;
    textareaRef: React.RefObject<HTMLTextAreaElement>;
}

const InputBar: React.FC<InputBarProps> = ({ newMessage, setNewMessage, handleSend, isRecording, toggleRecording, recordingTime, fileInputRef, handleFileSelect, emojiPickerRef, isEmojiPickerOpen, setIsEmojiPickerOpen, textareaRef }) => {
    const [isSuggestionsExpanded, setIsSuggestionsExpanded] = useState(true);
    const smartReplies = ["Sounds good!", "I'll take a look.", "Thanks for sharing."];

    return (
        <div className="px-4 md:px-8 py-2.5 border-t border-gray-800/60 bg-invox-dark/95 backdrop-blur-md flex-shrink-0">
            <div className="max-w-7xl mx-auto w-full">
                {!isRecording && (
                    <div className="flex items-center gap-2 mb-2">
                        <button
                            onClick={() => setIsSuggestionsExpanded(!isSuggestionsExpanded)}
                            className="p-1.5 rounded-full text-invox-red hover:bg-white/5 transition-all flex-shrink-0"
                            aria-label={isSuggestionsExpanded ? "Hide AI suggestions" : "Show AI suggestions"}
                            title={isSuggestionsExpanded ? "Hide suggestions" : "Show suggestions"}
                        >
                            <SparklesIcon className="w-5 h-5" />
                        </button>
                        <div className={`flex items-center gap-2 transition-all duration-300 ease-in-out overflow-hidden ${isSuggestionsExpanded ? 'max-w-xl opacity-100' : 'max-w-0 opacity-0'}`}>
                            {smartReplies.map(reply => (
                                <button
                                    key={reply}
                                    onClick={() => {
                                        handleSend(reply);
                                        setIsSuggestionsExpanded(false);
                                    }}
                                    className="px-4 py-2 text-xs font-bold bg-invox-dark-accent rounded-full text-gray-300 border border-gray-800 hover:border-invox-red hover:text-white transition-all whitespace-nowrap"
                                >
                                    {reply}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                {/* FIX: Removed focus-within:border-gray-600 and focus-within:shadow-lg as requested */}
                <div className={`flex items-center bg-invox-dark-accent border border-gray-800 rounded-2xl px-2 py-0.5 transition-all duration-300 ${isRecording ? 'justify-between' : ''}`}>
                    {isRecording ? (
                        <RecordingIndicator time={recordingTime} onStop={toggleRecording} />
                    ) : (
                        <>
                            <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
                            <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-400 hover:text-white transition-colors" title="Attach"><PaperClipIcon className="w-5 h-5" /></button>
                            <div className="relative" ref={emojiPickerRef}>
                                <button onClick={() => setIsEmojiPickerOpen(prev => !prev)} className="p-2 text-gray-400 hover:text-white transition-colors" title="Emoji"><FaceSmileIcon className="w-5 h-5" /></button>
                                {isEmojiPickerOpen && <EmojiPicker onSelect={(emoji) => setNewMessage(prev => prev + emoji)} />}
                            </div>
                            <textarea 
                                ref={textareaRef} 
                                rows={1} 
                                value={newMessage} 
                                onChange={(e) => setNewMessage(e.target.value)} 
                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(newMessage); } }} 
                                placeholder="Write your message..." 
                                className="flex-grow bg-transparent py-1.5 px-3 text-[15px] leading-6 text-white placeholder-gray-500 focus:outline-none resize-none overflow-y-auto max-h-40 min-h-[38px] no-scrollbar" 
                            />
                            <button onClick={toggleRecording} className="p-2 text-gray-400 hover:text-invox-red transition-colors" title="Voice Message"><MicrophoneIcon className="w-5 h-5" /></button>
                            <button onClick={() => handleSend(newMessage)} disabled={!newMessage.trim()} className="bg-invox-red text-white p-2.5 rounded-xl hover:bg-invox-red-hover disabled:bg-transparent disabled:text-gray-700 disabled:cursor-not-allowed flex items-center justify-center transition-all shadow-md active:scale-90"><SendIcon className="w-5 h-5" /></button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const RecordingIndicator: React.FC<{ time: number; onStop: () => void; }> = ({ time, onStop }) => (
    <div className="flex items-center justify-between w-full px-4 py-1">
        <div className="flex items-center gap-4">
            <div className="w-3 h-3 bg-invox-red rounded-full animate-ping"></div>
            <span className="text-base font-mono font-bold text-white tabular-nums">{new Date(time * 1000).toISOString().substr(14, 5)}</span>
        </div>
        <button onClick={onStop} className="p-2 text-invox-red hover:text-red-400 transition-all transform hover:scale-110 active:scale-90" title="Stop Recording"><StopCircleIcon className="w-7 h-7" /></button>
    </div>
);

const EmojiPicker: React.FC<{ onSelect: (emoji: string) => void }> = ({ onSelect }) => {
    const emojis = ['👍', '😂', '❤️', '🙏', '🎉', '🔥', '🤔', '😊', '😢', '😮', '🚀', '💯'];
    return (
        <div className="absolute bottom-full mb-3 bg-invox-dark-accent border border-gray-700 rounded-xl shadow-2xl p-3 grid grid-cols-4 gap-2 w-max animate-fadeInUp backdrop-blur-xl">
            {emojis.map(emoji => (
                <button key={emoji} onClick={() => onSelect(emoji)} className="text-2xl p-2 rounded-lg hover:bg-white/10 transition-all transform hover:scale-125">{emoji}</button>
            ))}
        </div>
    );
};

const renderSummaryMarkdown = (text: string): React.ReactNode => {
    if (!text) return null;
    
    const parseInline = (line: string) => {
        const parts = line.split(/(\*\*.*?\*\*)/g);
        return parts.map((part, index) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={index} className="text-white font-bold">{part.slice(2, -2)}</strong>;
            }
            return part;
        });
    };

    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let currentList: React.ReactNode[] = [];

    const flushList = () => {
        if (currentList.length > 0) {
            elements.push(<ul key={`list-${elements.length}`} className="list-disc list-outside pl-6 space-y-2 my-4 text-gray-300">{currentList}</ul>);
            currentList = [];
        }
    };

    lines.forEach((line, index) => {
        const trimmedLine = line.trim();
        const isListItem = trimmedLine.startsWith('* ') || trimmedLine.startsWith('- ');
        
        if (isListItem) {
            currentList.push(<li key={`li-${index}`} className="leading-relaxed">{parseInline(trimmedLine.substring(2))}</li>);
        } else {
            flushList();
            if (trimmedLine) {
                elements.push(<p key={`p-${index}`} className="leading-relaxed text-gray-300">{parseInline(trimmedLine)}</p>);
            }
        }
    });

    flushList();
    return <div className="space-y-4">{elements}</div>;
};

const SummaryModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    conversation: HubConversation;
}> = ({ isOpen, onClose, conversation }) => {
    const [view, setView] = useState<'date_select' | 'summary_view'>('date_select');
    const [startDate, setStartDate] = useState('');
    const [startTime, setStartTime] = useState('00:00');
    const [endDate, setEndDate] = useState('');
    const [endTime, setEndTime] = useState('23:59');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedSummary, setGeneratedSummary] = useState('');

    useEffect(() => {
        if (isOpen) {
            setView('date_select');
            setGeneratedSummary('');
            if (conversation.messages.length > 0) {
                const dates = conversation.messages.map(m => m.date.getTime());
                const minDate = new Date(Math.min(...dates));
                const maxDate = new Date(Math.max(...dates));
                setStartDate(minDate.toISOString().split('T')[0]);
                setEndDate(maxDate.toISOString().split('T')[0]);
                setStartTime('00:00');
                setEndTime('23:59');
            }
        }
    }, [isOpen, conversation.messages]);
    
    const handleGenerate = async () => {
        setIsGenerating(true);
        setView('summary_view');

        const startDateTime = new Date(`${startDate}T${startTime}`);
        const endDateTime = new Date(`${endDate}T${endTime}`);

        const filteredMessages = conversation.messages.filter(msg => {
            const msgDate = new Date(msg.date);
            return msgDate >= startDateTime && msgDate <= endDateTime;
        });

        const transcript = filteredMessages
            .map(msg => {
                const senderName = msg.sender === 'me' ? 'You' : conversation.name;
                let content = msg.text || '';
                if (msg.type === 'image') content = '[Image]';
                if (msg.type === 'file') content = `[File: ${msg.fileInfo?.name}]`;
                if (msg.type === 'voice') content = '[Voice Message]';
                return `${senderName}: ${content}`;
            })
            .join('\n');

        const summaryText = await generateChatSummary(transcript);
        
        setGeneratedSummary(summaryText);
        setIsGenerating(false);
    };


    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 transition-all" onClick={onClose}>
            <div className="bg-invox-dark-accent rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-800 m-4 flex flex-col max-h-[85vh] overflow-hidden animate-fadeInUp" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-5 border-b border-gray-800">
                    <h3 className="text-xl font-black text-white flex items-center gap-3 uppercase tracking-tighter">
                        <SparklesIcon className="w-6 h-6 text-invox-red" />
                        {view === 'date_select' ? 'History Insight' : 'Chat Intelligence'}
                    </h3>
                    <div className="flex items-center gap-2">
                         {view === 'summary_view' && (
                            <button 
                                onClick={() => setView('date_select')} 
                                className="text-xs font-black uppercase tracking-widest text-gray-400 hover:text-white flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/5 hover:bg-white/10 transition-all"
                            >
                                <CalendarDaysIcon className="w-4 h-4" />
                                <span>Adjust Range</span>
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 rounded-full text-gray-500 hover:text-white hover:bg-white/5 transition-colors">
                            <CloseIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>
                <div className="p-8 overflow-y-auto no-scrollbar">
                    {view === 'date_select' ? (
                        <div className="space-y-6">
                            <p className="text-gray-400 text-sm font-medium leading-relaxed">Select a timeframe below to let Spark AI analyze your conversation history and generate a condensed summary of key takeaways.</p>
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Start Date</label>
                                    <div className="relative">
                                        <CalendarDaysIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600 pointer-events-none" />
                                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-invox-dark border border-gray-800 rounded-xl p-3 pl-12 focus:outline-none focus:ring-1 focus:ring-invox-red text-white transition-all" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Start Time</label>
                                    <div className="relative">
                                        <ClockIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600 pointer-events-none" />
                                        <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full bg-invox-dark border border-gray-800 rounded-xl p-3 pl-12 focus:outline-none focus:ring-1 focus:ring-invox-red text-white transition-all" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">End Date</label>
                                    <div className="relative">
                                        <CalendarDaysIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600 pointer-events-none" />
                                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-invox-dark border border-gray-800 rounded-xl p-3 pl-12 focus:outline-none focus:ring-1 focus:ring-invox-red text-white transition-all" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">End Time</label>
                                    <div className="relative">
                                        <ClockIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600 pointer-events-none" />
                                        <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full bg-invox-dark border border-gray-800 rounded-xl p-3 pl-12 focus:outline-none focus:ring-1 focus:ring-invox-red text-white transition-all" />
                                    </div>
                                </div>
                            </div>
                            <button onClick={handleGenerate} className="w-full mt-8 bg-invox-red text-white font-black uppercase tracking-widest py-4 rounded-xl hover:bg-invox-red-hover transition-all shadow-xl shadow-invox-red/10 active:scale-[0.98]">
                                Analyze Conversation
                            </button>
                        </div>
                    ) : isGenerating ? (
                        <div className="flex flex-col items-center justify-center h-full py-16">
                            <div className="w-12 h-12 border-4 border-white/10 border-t-invox-red rounded-full animate-spin"></div>
                            <p className="text-gray-400 mt-6 font-bold tracking-tight">Spark AI is parsing your messages...</p>
                        </div>
                    ) : (
                        <div className="animate-fadeInUp">
                            <h4 className="text-xs font-black uppercase tracking-widest text-invox-red mb-4">Executive Summary</h4>
                            {renderSummaryMarkdown(generatedSummary)}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};


const ChatInterface: React.FC<{ conversation: HubConversation; onBack: () => void; onConversationUpdate: (conversation: HubConversation) => void; }> = ({ conversation, onBack, onConversationUpdate }) => {
    const [newMessage, setNewMessage] = useState('');
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [isTyping, setIsTyping] = useState(false);
    const [menuForMessage, setMenuForMessage] = useState<string | null>(null);
    const [isScrolledUp, setIsScrolledUp] = useState(false);
    const [showNewMessageToast, setShowNewMessageToast] = useState(false);
    
    // Summary State
    const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);

    // Search state
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<string[]>([]);
    const [currentResultIndex, setCurrentResultIndex] = useState(-1);

    const [userStatus, setUserStatus] = useState<{ text: string; color: string } | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const emojiPickerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const recordingTimerRef = useRef<number | null>(null);
    const messageRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
    const messageContainerRef = useRef<HTMLDivElement>(null);
    const isScrolledUpRef = useRef(false);

    useEffect(() => { isScrolledUpRef.current = isScrolledUp; }, [isScrolledUp]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        setShowNewMessageToast(false);
    };

    const handleScroll = () => {
        const container = messageContainerRef.current;
        if (container) {
            const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
            setIsScrolledUp(!atBottom);
            if (atBottom) {
                setShowNewMessageToast(false);
            }
        }
    };

    useEffect(() => {
        // Reset local state when conversation changes
        setNewMessage('');
        setIsMenuOpen(false);
        setIsEmojiPickerOpen(false);
        setIsRecording(false);
        setRecordingTime(0);
        setIsTyping(false);
        setMenuForMessage(null);
        setIsScrolledUp(false);
        setShowNewMessageToast(false);
        setIsSummaryModalOpen(false);
        setIsSearchOpen(false);
        setSearchTerm('');
        setSearchResults([]);
        setCurrentResultIndex(-1);

        if (conversation.isGroup) {
            const members = Math.floor(Math.random() * (100 - 5 + 1)) + 5;
            setUserStatus({ text: `${members} members`, color: 'text-gray-400' });
        } else {
            const generateUserStatus = () => {
                const rand = Math.random();
                if (rand < 0.35) {
                    return { text: 'Online', color: 'text-green-400' };
                } else if (rand < 0.75) {
                    const minutes = Math.floor(Math.random() * 59) + 1;
                    return { text: `Active ${minutes}m ago`, color: 'text-gray-400' };
                } else {
                    const hours = Math.floor(Math.random() * 12) + 1;
                    return { text: `Last seen ${hours}h ago`, color: 'text-gray-400' };
                }
            };
            setUserStatus(generateUserStatus());
        }
    }, [conversation.id]);

    useEffect(() => {
        if (!isScrolledUp && !isSearchOpen) {
            scrollToBottom();
        }
    }, [conversation.messages, isTyping, isScrolledUp, isSearchOpen]);
    
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            const scrollHeight = textareaRef.current.scrollHeight;
            textareaRef.current.style.height = `${Math.min(scrollHeight, 160)}px`; // Max height
        }
    }, [newMessage]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) setIsMenuOpen(false);
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) setIsEmojiPickerOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (isRecording) {
            recordingTimerRef.current = window.setInterval(() => setRecordingTime(prev => prev + 1), 1000);
        } else {
            if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
            setRecordingTime(0);
        }
        return () => {
            if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        };
    }, [isRecording]);

    useEffect(() => {
        if (isSearchOpen && searchTerm.trim()) {
            const results = conversation.messages
                .filter(msg => msg.type === 'text' && msg.text?.toLowerCase().includes(searchTerm.toLowerCase()))
                .map(msg => msg.id);
            setSearchResults(results);
            setCurrentResultIndex(results.length > 0 ? 0 : -1);
        } else {
            setSearchResults([]);
            setCurrentResultIndex(-1);
        }
    }, [searchTerm, conversation.messages, isSearchOpen]);

    useEffect(() => {
        if (currentResultIndex !== -1 && searchResults.length > 0) {
            const currentMsgId = searchResults[currentResultIndex];
            const targetElement = messageRefs.current.get(currentMsgId);
            targetElement?.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            });
        }
    }, [currentResultIndex, searchResults]);

    const handleNextResult = () => {
        if (searchResults.length === 0) return;
        setCurrentResultIndex(prev => (prev + 1) % searchResults.length);
    };

    const handlePrevResult = () => {
        if (searchResults.length === 0) return;
        setCurrentResultIndex(prev => (prev - 1 + searchResults.length) % searchResults.length);
    };

    const handleOpenSummaryModal = () => {
        setIsSummaryModalOpen(true);
    };

    const sendMessage = (messageData: Omit<Message, 'id' | 'sender' | 'timestamp' | 'date'>) => {
        const fullMessage: Message = {
            ...messageData,
            id: Date.now().toString(),
            sender: 'me',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            date: new Date(),
            status: 'sending'
        };

        // 1. Optimistic Update - Immediately commit the new message to UI
        const updatedMessagesWithNew = [...conversation.messages, fullMessage];
        onConversationUpdate({ ...conversation, messages: updatedMessagesWithNew });
        
        // Ensure UI scrolls to the new message instantly
        setTimeout(scrollToBottom, 0);

        // 2. Lifecycle Updates (Simulated)
        setTimeout(() => {
            // Update to 'sent'
            const currentMessages = [...updatedMessagesWithNew]; // Local fresh copy
            const updatedMessagesWithSent = currentMessages.map(m => m.id === fullMessage.id ? { ...m, status: 'sent' } : m);
            onConversationUpdate({ ...conversation, messages: updatedMessagesWithSent });
            
            // Start AI typing indicator quickly
            setIsTyping(true);

            setTimeout(() => {
                // Update to 'delivered'
                const updatedMessagesWithDelivered = updatedMessagesWithSent.map(m => m.id === fullMessage.id ? { ...m, status: 'delivered' } : m);
                onConversationUpdate({ ...conversation, messages: updatedMessagesWithDelivered });
                
                // Finalize AI response
                setTimeout(() => {
                    setIsTyping(false);
                    const replyMessage: Message = { 
                        id: (Date.now() + 1).toString(), 
                        sender: 'other', 
                        text: getRandomReply(), 
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
                        date: new Date(), 
                        type: 'text' 
                    };
                    const updatedMessagesWithRead = updatedMessagesWithDelivered.map(m => m.sender === 'me' ? { ...m, status: 'read' } : m);
                    
                    onConversationUpdate({ ...conversation, messages: [...updatedMessagesWithRead, replyMessage] });
                    
                    if (isScrolledUpRef.current) {
                        setShowNewMessageToast(true);
                    }
                }, 800 + Math.random() * 400); 
            }, 300);
        }, 150);
    };

    const handleSendText = (text: string) => {
        if (text.trim() === '') return;
        sendMessage({ type: 'text', text });
        setNewMessage('');
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (loadEvent) => {
                sendMessage({ type: 'image', mediaUrl: loadEvent.target?.result as string });
            };
            reader.readAsDataURL(file);
        } else {
             sendMessage({ type: 'file', fileInfo: { name: file.name, size: (file.size / 1024).toFixed(1) + ' KB' }});
        }
    };
    
    const toggleRecording = () => {
        if (isRecording) {
            setIsRecording(false);
            const duration = new Date(recordingTime * 1000).toISOString().substr(14, 5);
            sendMessage({ type: 'voice', voiceDuration: duration });
        } else {
            setIsRecording(true);
        }
    };

    const groupedMessages = conversation.messages.reduce((acc, msg) => {
        const dateKey = msg.date.toDateString();
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(msg);
        return acc;
    }, {} as Record<string, Message[]>);

    return (
        <div className="bg-invox-dark flex flex-col h-full overflow-hidden">
            <Header 
                conversation={conversation} 
                onBack={onBack} 
                userStatus={userStatus} 
                menuRef={menuRef} 
                isMenuOpen={isMenuOpen} 
                setIsMenuOpen={setIsMenuOpen}
                isSearchOpen={isSearchOpen}
                setIsSearchOpen={setIsSearchOpen}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                searchResultCount={searchResults.length}
                currentResultIndex={currentResultIndex}
                onPrevResult={handlePrevResult}
                onNextResult={handleNextResult}
                onSummarize={handleOpenSummaryModal}
            />
            <div className="relative flex-1 flex flex-col min-h-0">
                <MessageArea 
                    messageContainerRef={messageContainerRef}
                    onScroll={handleScroll}
                    groupedMessages={groupedMessages} 
                    messagesEndRef={messagesEndRef} 
                    isTyping={isTyping} 
                    searchTerm={searchTerm}
                    searchResults={searchResults}
                    currentResultIndex={currentResultIndex}
                    messageRefs={messageRefs}
                    menuForMessage={menuForMessage}
                    setMenuForMessage={setMenuForMessage}
                />
                {showNewMessageToast && (
                     <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
                        <button
                            onClick={scrollToBottom}
                            className="bg-invox-red text-white px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2 text-sm font-black uppercase tracking-widest animate-fadeInUp border border-white/20 backdrop-blur-md"
                        >
                            <ChevronDownIcon className="w-5 h-5" />
                            New Signal
                        </button>
                    </div>
                )}
            </div>
            <InputBar 
                newMessage={newMessage} 
                setNewMessage={setNewMessage} 
                handleSend={handleSendText}
                isRecording={isRecording}
                toggleRecording={toggleRecording}
                recordingTime={recordingTime}
                fileInputRef={fileInputRef}
                handleFileSelect={handleFileSelect}
                emojiPickerRef={emojiPickerRef}
                isEmojiPickerOpen={isEmojiPickerOpen}
                setIsEmojiPickerOpen={setIsEmojiPickerOpen}
                textareaRef={textareaRef}
            />
            <SummaryModal
                isOpen={isSummaryModalOpen}
                onClose={() => setIsSummaryModalOpen(false)}
                conversation={conversation}
            />
        </div>
    );
};

export default ChatInterface;
