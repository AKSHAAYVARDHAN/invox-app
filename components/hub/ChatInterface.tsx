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

const cannedResponses = [ 
    "Transmission confirmed. Analyzing telemetry data.", 
    "Acknowledged. Synchronizing node parameters.", 
    "Signal received loud and clear. Proceeding with protocol.", 
    "Data logged in buffer. Standby for output.", 
    "Node calibrated. Status remains operational.", 
    "Understood. Relaying packet across network." 
];
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

const Header: React.FC<HeaderProps> = ({ 
    conversation, 
    onBack, 
    userStatus, 
    menuRef, 
    isMenuOpen, 
    setIsMenuOpen, 
    isSearchOpen, 
    setIsSearchOpen, 
    searchTerm, 
    setSearchTerm, 
    searchResultCount, 
    currentResultIndex, 
    onPrevResult, 
    onNextResult, 
    onSummarize 
}) => {
    const searchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isSearchOpen) {
            searchInputRef.current?.focus();
        } else {
            setSearchTerm('');
        }
    }, [isSearchOpen, setSearchTerm]);
    
    return (
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-[#0c0c0e] flex-shrink-0 sticky top-0 z-20 font-mono">
            <div className="flex items-center gap-3 flex-grow min-w-0">
                <button 
                    onClick={onBack} 
                    className="p-2 border border-zinc-800 hover:border-zinc-700 bg-zinc-900/60 text-zinc-400 hover:text-white transition-colors" 
                    aria-label="Back to conversations"
                >
                    <ArrowLeftIcon className="w-4 h-4" />
                </button>
                {isSearchOpen ? (
                     <div className="flex items-center flex-grow bg-zinc-950 border border-zinc-800 px-3 py-1 mr-2">
                        <MagnifyingGlassIcon className="w-4 h-4 text-zinc-500 mr-2 flex-shrink-0" />
                        <input
                            ref={searchInputRef}
                            type="search"
                            placeholder="SEARCH_PACKET_STREAM..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-transparent focus:outline-none text-white text-xs font-mono uppercase placeholder-zinc-600"
                        />
                    </div>
                ) : (
                    <>
                        <div className="relative">
                            <img 
                                src={conversation.avatarUrl} 
                                onError={handleImageError} 
                                alt={conversation.name} 
                                className="w-9 h-9 border border-zinc-700 object-cover" 
                            />
                            <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 border border-black"></div>
                        </div>
                        <div className="overflow-hidden">
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] text-zinc-500 uppercase tracking-widest">// NODE</span>
                                <p className="font-bold text-white text-xs uppercase tracking-wider truncate">{conversation.name}</p>
                            </div>
                            {userStatus && (
                                <p className={`text-[10px] uppercase tracking-widest ${userStatus.color}`}>
                                    [{userStatus.text}]
                                </p>
                            )}
                        </div>
                    </>
                )}
            </div>
            <div className="flex items-center gap-1.5">
                {isSearchOpen ? (
                    <>
                        {searchResultCount > 0 && (
                            <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-mono bg-zinc-900 border border-zinc-800 px-2 py-1">
                                <span>{currentResultIndex + 1}/{searchResultCount}</span>
                                <div className="flex items-center gap-1 border-l border-zinc-700 pl-1.5 ml-1">
                                    <button onClick={onPrevResult} disabled={searchResultCount <= 1} className="p-0.5 hover:text-white disabled:opacity-30"><ArrowUpIcon className="w-3.5 h-3.5" /></button>
                                    <button onClick={onNextResult} disabled={searchResultCount <= 1} className="p-0.5 hover:text-white disabled:opacity-30"><ArrowDownIcon className="w-3.5 h-3.5" /></button>
                                </div>
                            </div>
                        )}
                        <button onClick={() => setIsSearchOpen(false)} className="text-zinc-400 hover:text-white p-1.5 border border-zinc-800 bg-zinc-900/60"><CloseIcon className="w-4 h-4" /></button>
                    </>
                ) : (
                    <>
                        <button 
                            onClick={onSummarize} 
                            className="text-zinc-400 hover:text-white p-2 border border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 transition-colors flex items-center gap-1.5 text-xs" 
                            aria-label="Summarize Chat"
                            title="Generate AI Protocol Summary"
                        >
                            <SparklesIcon className="w-4 h-4 text-zinc-300" />
                            <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-wider">// AI_SUMMARY</span>
                        </button>
                        <button 
                            onClick={() => setIsSearchOpen(true)} 
                            className="text-zinc-400 hover:text-white p-2 border border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 transition-colors" 
                            aria-label="Search Chat"
                        >
                            <MagnifyingGlassIcon className="w-4 h-4" />
                        </button>
                    </>
                )}

                <div className="relative" ref={menuRef}>
                    <button 
                        onClick={() => setIsMenuOpen(prev => !prev)} 
                        className="text-zinc-400 hover:text-white p-2 border border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 transition-colors"
                    >
                        <EllipsisVerticalIcon className="w-4 h-4" />
                    </button>
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
            // Action handled
        }
    };
    const menuItems = [ 
        { label: 'VIEW PROFILE', icon: ProfileIcon, action: 'view' }, 
        { label: 'MUTE CHANNEL', icon: BellIcon, action: 'mute' }, 
        { label: 'ISOLATE NODE', icon: UsersIcon, action: 'block' }, 
        { label: 'PURGE SESSION', icon: TrashIcon, action: 'delete', isDestructive: true } 
    ];
    return (
        <div className="absolute right-0 top-full mt-1 w-52 bg-[#0c0c0e] border border-zinc-800 shadow-2xl z-30 py-1 font-mono animate-fadeInUp">
            <div className="px-3 py-1.5 border-b border-zinc-800 text-[9px] text-zinc-500 uppercase tracking-widest">// CHANNEL_OPTIONS</div>
            {menuItems.map(item => (
                <button 
                    key={item.action} 
                    onClick={() => handleAction(item.action)} 
                    className={`w-full flex items-center gap-3 px-3 py-2 text-xs text-left transition-colors ${item.isDestructive ? 'text-red-400 hover:bg-red-950/40 hover:text-red-300' : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'}`}
                >
                    <item.icon className="w-4 h-4" />
                    <span className="font-bold tracking-wider">{item.label}</span>
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

const MessageArea: React.FC<MessageAreaProps> = ({ 
    messageContainerRef, 
    onScroll, 
    groupedMessages, 
    messagesEndRef, 
    isTyping, 
    searchTerm, 
    searchResults, 
    currentResultIndex, 
    messageRefs, 
    menuForMessage, 
    setMenuForMessage 
}) => (
    <div ref={messageContainerRef} onScroll={onScroll} className="flex-grow px-4 md:px-8 py-6 overflow-y-auto no-scrollbar bg-[#08080a] font-mono">
        <div className="max-w-4xl mx-auto w-full space-y-4">
            {Object.entries(groupedMessages).map(([dateStr, msgs]: [string, Message[]]) => (
                <div key={dateStr} className="space-y-3">
                    <DateSeparator date={new Date(dateStr)} />
                    {msgs.map(msg => (
                        <MessageBubble 
                            key={msg.id} 
                            ref={el => messageRefs.current.set(msg.id, el)}
                            msg={msg} 
                            searchTerm={searchTerm}
                            isCurrent={searchResults[currentResultIndex] === msg.id}
                            isMenuOpen={menuForMessage === msg.id}
                            onMenuToggle={() => setMenuForMessage(currentId => (currentId === msg.id ? null : msg.id))}
                        />
                    ))}
                </div>
            ))}
            {isTyping && <TypingIndicator />}
            <div ref={messagesEndRef} />
        </div>
    </div>
);

const TypingIndicator = () => (
    <div className="flex items-center gap-2 mb-4 justify-start font-mono animate-fadeInUp">
        <div className="bg-[#0c0c0e] border border-zinc-800 px-3.5 py-2 flex items-center gap-2">
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest">// RECEIVING_TRANSMISSION</span>
            <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-zinc-400 animate-pulse" style={{ animationDelay: '0s' }}></div>
                <div className="w-1.5 h-1.5 bg-zinc-400 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-1.5 h-1.5 bg-zinc-400 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
            </div>
        </div>
    </div>
);

const DateSeparator = ({ date }: { date: Date }) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const label = date.toDateString() === today.toDateString() ? 'TODAY' : date.toDateString() === yesterday.toDateString() ? 'YESTERDAY' : date.toLocaleDateString([], { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }).toUpperCase();
    return (
        <div className="text-center text-[10px] font-bold text-zinc-600 my-6 uppercase tracking-widest flex items-center gap-3 font-mono">
            <div className="h-px bg-zinc-800/80 flex-grow"></div>
            <span className="bg-[#0c0c0e] border border-zinc-800 px-2.5 py-0.5">// {label}</span>
            <div className="h-px bg-zinc-800/80 flex-grow"></div>
        </div>
    );
};

const StatusIndicator: React.FC<{ status: Message['status'] }> = ({ status }) => {
    switch (status) {
        case 'read':
            return <DoubleCheckIcon className="w-3.5 h-3.5 text-white" />;
        case 'delivered':
            return <DoubleCheckIcon className="w-3.5 h-3.5 text-zinc-500" />;
        case 'sent':
            return <CheckIcon className="w-3.5 h-3.5 text-zinc-500" />;
        default:
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
        { label: 'Bookmark', icon: StarOutlineIcon },
        { label: 'Pin Node', icon: MapPinIcon },
        isSender && { label: 'Edit Payload', icon: PencilIcon },
        { label: isSender ? 'Delete' : 'Purge Local', icon: TrashIcon },
        { label: 'Select', icon: CheckIcon },
        { label: 'Share', icon: ShareIcon },
        isSender && { label: 'Metadata', icon: InformationCircleIcon }
    ].filter(Boolean) as {label: string, icon: React.FC<any>}[];

    const reactions = ['👍', '❤️', '🔥', '⚡', '🤖', '🛰️'];

    return (
        <div ref={menuRef} className="w-64 bg-[#0c0c0e] border border-zinc-800 shadow-2xl flex flex-col font-mono animate-fadeInUp z-40">
            <div className="py-1">
                {menuItems.map(item => (
                    <button 
                        key={item.label} 
                        onClick={() => onClose()} 
                        className="w-full flex items-center gap-3 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900 hover:text-white transition-colors"
                    >
                        <item.icon className="w-3.5 h-3.5 text-zinc-500" />
                        <span className="uppercase tracking-wider">{item.label}</span>
                    </button>
                ))}
            </div>
            <div className="border-t border-zinc-800 p-2 flex items-center justify-between bg-zinc-950">
                {reactions.map(emoji => (
                    <button key={emoji} onClick={() => onClose()} className="text-base p-1 hover:bg-zinc-800 transition-transform active:scale-95">{emoji}</button>
                ))}
                <button className="p-1 text-zinc-500 hover:text-white">
                    <PlusIcon className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

const MessageBubble = React.forwardRef<HTMLDivElement, { 
    msg: Message; 
    searchTerm: string; 
    isCurrent: boolean; 
    isMenuOpen: boolean; 
    onMenuToggle: () => void; 
}>(({ msg, searchTerm, isCurrent, isMenuOpen, onMenuToggle }, ref) => {
    
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
                        <mark key={index} className="bg-white text-black font-bold px-1">
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
        case 'image': 
            content = <img src={msg.mediaUrl} alt="attachment" className="border border-zinc-800 max-w-xs cursor-pointer shadow-lg my-1" />; 
            break;
        case 'file': 
            content = <FileMessage fileInfo={msg.fileInfo!} />; 
            break;
        case 'voice': 
            content = <VoiceMessage duration={msg.voiceDuration!} />; 
            break;
        default: 
            content = <p className="whitespace-pre-wrap break-words text-xs leading-relaxed font-mono">{highlightText(msg.text!, searchTerm)}</p>;
    }

    const isMe = msg.sender === 'me';

    return (
        <div ref={ref} className={`relative flex items-start group ${isMe ? 'justify-end' : 'justify-start'} ${isMenuOpen ? 'z-20' : ''}`}>
            <div className="flex items-start max-w-lg">
                {isMe && (
                    <div className="relative flex-shrink-0 self-center mr-2">
                        <button onClick={onMenuToggle} className="p-1 text-zinc-500 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity hover:text-white">
                            <ChevronDownIcon className="w-3.5 h-3.5" />
                        </button>
                        {isMenuOpen && (
                            <div className="absolute top-0 right-full mr-2 z-30">
                                <MessageContextMenu onClose={onMenuToggle} context="sender" />
                            </div>
                        )}
                    </div>
                )}
                
                <div className={`p-3.5 transition-all duration-200 border ${
                    isCurrent 
                        ? 'border-white bg-zinc-900 shadow-xl' 
                        : isMe 
                            ? 'bg-[#15151a] border-zinc-700/80 text-zinc-100' 
                            : 'bg-[#0c0c0e] border-zinc-800 text-zinc-300'
                }`}>
                    <div className="flex items-center justify-between gap-3 mb-1 text-[9px] uppercase tracking-widest text-zinc-500 border-b border-zinc-800/60 pb-1">
                        <span>{isMe ? '// OUTBOUND' : '// INBOUND'}</span>
                        <span>#{msg.id.slice(-4)}</span>
                    </div>

                    {content}

                    <div className={`text-[9px] mt-2 flex items-center gap-1.5 font-mono tracking-wider ${isMe ? 'text-zinc-400 justify-end' : 'text-zinc-500'}`}>
                        <span>{msg.timestamp}</span>
                        {isMe && <StatusIndicator status={msg.status} />}
                    </div>
                </div>

                {!isMe && (
                    <div className="relative flex-shrink-0 self-center ml-2">
                        <button onClick={onMenuToggle} className="p-1 text-zinc-500 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity hover:text-white">
                            <ChevronDownIcon className="w-3.5 h-3.5" />
                        </button>
                        {isMenuOpen && (
                            <div className="absolute top-0 left-full ml-2 z-30">
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
    <div className="flex items-center gap-3 p-2.5 bg-zinc-950 border border-zinc-800 font-mono">
        <DocumentTextIcon className="w-6 h-6 text-white flex-shrink-0" />
        <div className="overflow-hidden">
            <p className="font-bold truncate text-xs text-white uppercase">{fileInfo.name}</p>
            <p className="text-[9px] text-zinc-500 tracking-wider">SIZE: {fileInfo.size}</p>
        </div>
    </div>
);

const VoiceMessage: React.FC<{ duration: string }> = ({ duration }) => (
    <div className="flex items-center gap-3 p-2 bg-zinc-950 border border-zinc-800 font-mono">
        <button className="p-2 border border-zinc-700 bg-zinc-900 text-white hover:bg-white hover:text-black transition-colors">
            <PlayIcon className="w-3.5 h-3.5" />
        </button>
        <div className="flex items-center gap-2 flex-grow">
            <SoundWaveIcon className="w-10 h-5 text-zinc-400" />
            <div className="w-24 h-1 bg-zinc-800 overflow-hidden">
                <div className="h-full bg-white w-1/3"></div>
            </div>
        </div>
        <span className="text-[10px] font-mono text-zinc-400 tabular-nums">{duration}</span>
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

const InputBar: React.FC<InputBarProps> = ({ 
    newMessage, 
    setNewMessage, 
    handleSend, 
    isRecording, 
    toggleRecording, 
    recordingTime, 
    fileInputRef, 
    handleFileSelect, 
    emojiPickerRef, 
    isEmojiPickerOpen, 
    setIsEmojiPickerOpen, 
    textareaRef 
}) => {
    const [isSuggestionsExpanded, setIsSuggestionsExpanded] = useState(true);
    const smartReplies = ["TRANSMISSION_ACK", "STANDBY_FOR_DATA", "ALL_NODES_ACTIVE"];

    return (
        <div className="px-4 py-3 border-t border-zinc-800 bg-[#0c0c0e] flex-shrink-0 font-mono">
            <div className="max-w-4xl mx-auto w-full">
                {!isRecording && (
                    <div className="flex items-center gap-2 mb-2">
                        <button
                            onClick={() => setIsSuggestionsExpanded(!isSuggestionsExpanded)}
                            className="p-1 border border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:text-white transition-colors"
                            aria-label={isSuggestionsExpanded ? "Hide suggestions" : "Show suggestions"}
                            title="Toggle fast protocol responses"
                        >
                            <SparklesIcon className="w-3.5 h-3.5" />
                        </button>
                        <div className={`flex items-center gap-1.5 transition-all duration-200 overflow-hidden ${isSuggestionsExpanded ? 'max-w-xl opacity-100' : 'max-w-0 opacity-0'}`}>
                            {smartReplies.map(reply => (
                                <button
                                    key={reply}
                                    onClick={() => {
                                        handleSend(reply);
                                        setIsSuggestionsExpanded(false);
                                    }}
                                    className="px-2.5 py-1 text-[10px] font-mono font-bold bg-zinc-900 border border-zinc-800 hover:border-white hover:text-white text-zinc-400 transition-colors whitespace-nowrap uppercase tracking-wider"
                                >
                                    [{reply}]
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                
                <div className={`flex items-center bg-zinc-950 border border-zinc-800 px-2 py-1 transition-all ${isRecording ? 'justify-between' : ''}`}>
                    {isRecording ? (
                        <RecordingIndicator time={recordingTime} onStop={toggleRecording} />
                    ) : (
                        <>
                            <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
                            <button 
                                onClick={() => fileInputRef.current?.click()} 
                                className="p-2 text-zinc-500 hover:text-white transition-colors" 
                                title="Attach Telemetry / File"
                            >
                                <PaperClipIcon className="w-4 h-4" />
                            </button>
                            <div className="relative" ref={emojiPickerRef}>
                                <button 
                                    onClick={() => setIsEmojiPickerOpen(prev => !prev)} 
                                    className="p-2 text-zinc-500 hover:text-white transition-colors" 
                                    title="Glyph / Emoji"
                                >
                                    <FaceSmileIcon className="w-4 h-4" />
                                </button>
                                {isEmojiPickerOpen && <EmojiPicker onSelect={(emoji) => setNewMessage(prev => prev + emoji)} />}
                            </div>
                            <textarea 
                                ref={textareaRef} 
                                rows={1} 
                                value={newMessage} 
                                onChange={(e) => setNewMessage(e.target.value)} 
                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(newMessage); } }} 
                                placeholder="TYPE_TRANSMISSION_PAYLOAD..." 
                                className="flex-grow bg-transparent py-1.5 px-3 text-xs text-white placeholder-zinc-600 focus:outline-none resize-none font-mono max-h-36 min-h-[36px] no-scrollbar" 
                            />
                            <button 
                                onClick={toggleRecording} 
                                className="p-2 text-zinc-500 hover:text-white transition-colors" 
                                title="Record Voice Stream"
                            >
                                <MicrophoneIcon className="w-4 h-4" />
                            </button>
                            <button 
                                onClick={() => handleSend(newMessage)} 
                                disabled={!newMessage.trim()} 
                                className="bg-white text-black p-2 font-mono font-bold hover:bg-zinc-200 disabled:bg-zinc-900 disabled:text-zinc-600 disabled:cursor-not-allowed flex items-center justify-center transition-colors border border-white disabled:border-zinc-800"
                            >
                                <SendIcon className="w-3.5 h-3.5" />
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const RecordingIndicator: React.FC<{ time: number; onStop: () => void; }> = ({ time, onStop }) => (
    <div className="flex items-center justify-between w-full px-3 py-1 font-mono">
        <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 bg-red-500 animate-pulse"></div>
            <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">RECORDING_STREAM: [{new Date(time * 1000).toISOString().substr(14, 5)}]</span>
        </div>
        <button onClick={onStop} className="p-1 text-red-400 hover:text-red-300 transition-colors" title="Stop Recording">
            <StopCircleIcon className="w-5 h-5" />
        </button>
    </div>
);

const EmojiPicker: React.FC<{ onSelect: (emoji: string) => void }> = ({ onSelect }) => {
    const emojis = ['👍', '😂', '❤️', '🔥', '⚡', '🚀', '🤖', '🛰️', '💡', '⚠️', '🎯', '💯'];
    return (
        <div className="absolute bottom-full mb-2 bg-[#0c0c0e] border border-zinc-800 shadow-2xl p-2.5 grid grid-cols-4 gap-1.5 w-max animate-fadeInUp z-30 font-mono">
            <div className="col-span-4 text-[9px] text-zinc-500 uppercase tracking-widest border-b border-zinc-800 pb-1 mb-1">// GLYPH_SELECTOR</div>
            {emojis.map(emoji => (
                <button key={emoji} onClick={() => onSelect(emoji)} className="text-lg p-1.5 hover:bg-zinc-800 transition-colors">{emoji}</button>
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
            elements.push(<ul key={`list-${elements.length}`} className="list-disc list-outside pl-5 space-y-1.5 my-3 text-zinc-300 text-xs font-mono">{currentList}</ul>);
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
                elements.push(<p key={`p-${index}`} className="leading-relaxed text-zinc-300 text-xs font-mono">{parseInline(trimmedLine)}</p>);
            }
        }
    });

    flushList();
    return <div className="space-y-3">{elements}</div>;
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
                if (msg.type === 'image') content = '[Image Attachment]';
                if (msg.type === 'file') content = `[File: ${msg.fileInfo?.name}]`;
                if (msg.type === 'voice') content = '[Audio Stream]';
                return `${senderName}: ${content}`;
            })
            .join('\n');

        const summaryText = await generateChatSummary(transcript);
        
        setGeneratedSummary(summaryText);
        setIsGenerating(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-mono" onClick={onClose}>
            <div className="bg-[#0c0c0e] border border-zinc-800 shadow-2xl w-full max-w-xl flex flex-col max-h-[85vh] overflow-hidden animate-fadeInUp" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b border-zinc-800 bg-zinc-950">
                    <div>
                        <span className="text-[9px] uppercase tracking-widest text-zinc-500 block">// TELEMETRY_ANALYZER</span>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider">
                            <SparklesIcon className="w-4 h-4 text-white" />
                            {view === 'date_select' ? 'Transmission Protocol Summary' : 'Intelligence Briefing'}
                        </h3>
                    </div>
                    <div className="flex items-center gap-2">
                        {view === 'summary_view' && (
                            <button 
                                onClick={() => setView('date_select')} 
                                className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 hover:text-white flex items-center gap-1.5 bg-zinc-900 px-3 py-1.5 border border-zinc-800 hover:border-zinc-700 transition-colors"
                            >
                                <CalendarDaysIcon className="w-3.5 h-3.5" />
                                <span>Adjust Bounds</span>
                            </button>
                        )}
                        <button onClick={onClose} className="p-1 text-zinc-500 hover:text-white border border-zinc-800 bg-zinc-900/60">
                            <CloseIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                <div className="p-6 overflow-y-auto no-scrollbar">
                    {view === 'date_select' ? (
                        <div className="space-y-4">
                            <p className="text-zinc-400 text-xs leading-relaxed">Select timestamps below to instruct the Spark intelligence model to distill conversation packets into actionable summaries.</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1">// START_DATE</label>
                                    <div className="relative">
                                        <CalendarDaysIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none" />
                                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 p-2 pl-9 text-xs text-white focus:outline-none focus:border-white" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1">// START_TIME</label>
                                    <div className="relative">
                                        <ClockIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none" />
                                        <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 p-2 pl-9 text-xs text-white focus:outline-none focus:border-white" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1">// END_DATE</label>
                                    <div className="relative">
                                        <CalendarDaysIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none" />
                                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 p-2 pl-9 text-xs text-white focus:outline-none focus:border-white" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1">// END_TIME</label>
                                    <div className="relative">
                                        <ClockIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none" />
                                        <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 p-2 pl-9 text-xs text-white focus:outline-none focus:border-white" />
                                    </div>
                                </div>
                            </div>
                            <button onClick={handleGenerate} className="w-full mt-4 bg-white text-black font-bold uppercase tracking-wider py-3 text-xs hover:bg-zinc-200 transition-colors border border-white">
                                Execute Summary Synthesis
                            </button>
                        </div>
                    ) : isGenerating ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="w-8 h-8 border-2 border-zinc-700 border-t-white animate-spin"></div>
                            <p className="text-zinc-400 mt-4 text-xs tracking-wider uppercase">// PARSING_DATA_BUFFERS...</p>
                        </div>
                    ) : (
                        <div className="animate-fadeInUp space-y-3">
                            <div className="inline-block bg-zinc-900 border border-zinc-800 px-2.5 py-1 text-[9px] uppercase tracking-widest text-zinc-400">
                                // EXECUTIVE_SYNTHESIS_REPORT
                            </div>
                            {renderSummaryMarkdown(generatedSummary)}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const ChatInterface: React.FC<{ 
    conversation: HubConversation; 
    onBack: () => void; 
    onConversationUpdate: (conversation: HubConversation) => void; 
}> = ({ conversation, onBack, onConversationUpdate }) => {
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
            setUserStatus({ text: `${members} NODES CONNECTED`, color: 'text-zinc-400' });
        } else {
            const generateUserStatus = () => {
                const rand = Math.random();
                if (rand < 0.35) {
                    return { text: 'ONLINE // ACTIVE', color: 'text-green-400' };
                } else if (rand < 0.75) {
                    const minutes = Math.floor(Math.random() * 59) + 1;
                    return { text: `LAST SYNC: ${minutes}M AGO`, color: 'text-zinc-500' };
                } else {
                    const hours = Math.floor(Math.random() * 12) + 1;
                    return { text: `LAST SYNC: ${hours}H AGO`, color: 'text-zinc-500' };
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
            textareaRef.current.style.height = `${Math.min(scrollHeight, 160)}px`;
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

        // 1. Optimistic Update
        const updatedMessagesWithNew = [...conversation.messages, fullMessage];
        onConversationUpdate({ ...conversation, messages: updatedMessagesWithNew });
        
        setTimeout(scrollToBottom, 0);

        // 2. Lifecycle Updates
        setTimeout(() => {
            const currentMessages = [...updatedMessagesWithNew];
            const updatedMessagesWithSent = currentMessages.map(m => m.id === fullMessage.id ? { ...m, status: 'sent' } : m);
            onConversationUpdate({ ...conversation, messages: updatedMessagesWithSent });
            
            setIsTyping(true);

            setTimeout(() => {
                const updatedMessagesWithDelivered = updatedMessagesWithSent.map(m => m.id === fullMessage.id ? { ...m, status: 'delivered' } : m);
                onConversationUpdate({ ...conversation, messages: updatedMessagesWithDelivered });
                
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
        <div className="bg-[#08080a] flex flex-col h-full overflow-hidden font-mono">
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
                     <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
                        <button
                            onClick={scrollToBottom}
                            className="bg-white text-black px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider shadow-2xl flex items-center gap-2 border border-white hover:bg-zinc-200 transition-colors animate-fadeInUp"
                        >
                            <ChevronDownIcon className="w-4 h-4" />
                            <span>INBOUND_PACKET_DETECTED</span>
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
