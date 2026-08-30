import React, { useState, useRef, useEffect } from 'react';
import { 
    SparklesIcon, 
    CloseIcon, 
    SendIcon, 
    ArrowsPointingOutIcon, 
    ArrowsPointingInIcon, 
    MenuIcon, 
    PencilSquareIcon, 
    CubeIcon, 
    InformationCircleIcon, 
    PencilSwooshIcon, 
    EllipsisVerticalIcon, 
    MapPinIcon, 
    PencilIcon, 
    TrashIcon, 
    StopIcon, 
    ChatBubbleIcon, 
    MicrophoneIcon, 
    ClipboardIcon, 
    CheckIcon, 
    ThumbsUpIcon, 
    ThumbsDownIcon, 
    RegenerateIcon, 
    ShareIcon, 
    MagnifyingGlassIcon, 
    GlobeAltIcon,
    CodeBracketIcon,
    WrenchScrewdriverIcon
} from './Icons';
import { getAIChatResponseStream } from '../../services/geminiService';
import { useAIAssistant, type ChatMessage, type Conversation } from '../../contexts/AIAssistantContext';
import { useFullscreen } from '../hooks/useFullscreen';
import { useAuth } from '../../contexts/AuthContext';

declare global {
    interface Window {
        hljs: any;
    }
}

const SmoothStream: React.FC<{
  fullText: string;
  renderContent: (text: string) => React.ReactNode;
  typingSpeed?: number;
  onAnimationComplete?: () => void;
}> = ({ fullText, renderContent, typingSpeed = 10, onAnimationComplete }) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    if (displayedText.length < fullText.length) {
      const timeoutId = setTimeout(() => {
        setDisplayedText(fullText.slice(0, displayedText.length + 1));
      }, typingSpeed);
      return () => clearTimeout(timeoutId);
    } else {
      onAnimationComplete?.();
    }
  }, [displayedText, fullText, typingSpeed, onAnimationComplete]);

  return <>{renderContent(displayedText)}</>;
};

const CopyButton: React.FC<{ textToCopy: string }> = ({ textToCopy }) => {
    const [isCopied, setIsCopied] = useState(false);

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!navigator.clipboard) {
            console.error('Clipboard API not available');
            return;
        }
        navigator.clipboard.writeText(textToCopy).then(() => {
            setIsCopied(true);
            setTimeout(() => {
                setIsCopied(false);
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
        });
    };

    return (
        <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 text-[10px] font-mono uppercase tracking-wider transition-all"
            aria-label={isCopied ? 'Copied to clipboard' : 'Copy code to clipboard'}
        >
            {isCopied ? (
                <>
                    <CheckIcon className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">COPIED</span>
                </>
            ) : (
                <>
                    <ClipboardIcon className="w-3 h-3 text-zinc-400" />
                    <span>COPY</span>
                </>
            )}
        </button>
    );
};

const ActionButtons: React.FC<{ message: ChatMessage; onRegenerate: () => void; }> = ({ message, onRegenerate }) => {
    const [feedback, setFeedback] = useState<'like' | 'dislike' | null>(null);
    const [isCopied, setIsCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(message.parts[0].text).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        });
    };

    const handleShare = () => {
         if (navigator.share) {
            navigator.share({
                title: 'Spark AI Response',
                text: message.parts[0].text,
            }).catch(console.error);
        } else {
            handleCopy();
        }
    };

    const actionButtonClass = "p-1.5 border border-zinc-800 bg-[#121215] text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors";
    
    return (
        <div className="flex items-center gap-1.5 mt-3 font-mono">
            <button 
                title="Good response" 
                className={`${actionButtonClass} ${feedback === 'like' ? 'text-emerald-400 border-emerald-800/80 bg-emerald-950/30' : ''}`} 
                onClick={() => setFeedback(f => f === 'like' ? null : 'like')}
            >
                <ThumbsUpIcon className="w-3.5 h-3.5" />
            </button>
            <button 
                title="Bad response" 
                className={`${actionButtonClass} ${feedback === 'dislike' ? 'text-red-400 border-red-800/80 bg-red-950/30' : ''}`} 
                onClick={() => setFeedback(f => f === 'dislike' ? null : 'dislike')}
            >
                <ThumbsDownIcon className="w-3.5 h-3.5" />
            </button>
            <button title="Regenerate" className={actionButtonClass} onClick={onRegenerate}>
                <RegenerateIcon className="w-3.5 h-3.5" />
            </button>
            <button title="Share" className={actionButtonClass} onClick={handleShare}>
                <ShareIcon className="w-3.5 h-3.5" />
            </button>
            <button title={isCopied ? "Copied!" : "Copy"} className={actionButtonClass} onClick={handleCopy}>
                {isCopied ? <CheckIcon className="w-3.5 h-3.5 text-emerald-400" /> : <ClipboardIcon className="w-3.5 h-3.5" />}
            </button>
        </div>
    );
};


const ChatHistorySidebar = () => {
    const { 
        conversations, 
        activeConversation, 
        selectConversation, 
        startNewChat,
        deleteConversation,
        renameConversation,
        pinConversation
    } = useAIAssistant();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState("");
    const menuRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const visibleConversations = conversations.filter(c => !c.isUnsaved);

    const filteredConversations = visibleConversations.filter(convo => {
        if (!searchTerm.trim()) return true;
        const lowerCaseSearch = searchTerm.toLowerCase();
        const titleMatch = convo.title.toLowerCase().includes(lowerCaseSearch);
        const messageMatch = convo.messages.some(msg => msg.parts[0].text.toLowerCase().includes(lowerCaseSearch));
        return titleMatch || messageMatch;
    });

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setMenuOpenId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (renamingId && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [renamingId]);

    const handleRenameSubmit = () => {
        if (renamingId && renameValue.trim()) {
            renameConversation(renamingId, renameValue.trim());
        }
        setRenamingId(null);
    };

    const handleDelete = (id: string, title: string) => {
        if (window.confirm(`Delete chat session "${title}"? This action cannot be undone.`)) {
            deleteConversation(id);
        }
    };
    
    const pinnedConversations = filteredConversations.filter(c => c.isPinned).sort((a, b) => (a.title > b.title ? 1 : -1));
    const recentConversations = filteredConversations.filter(c => !c.isPinned);

    const renderConvoItem = (convo: Conversation) => {
        const isActive = activeConversation?.id === convo.id;
        return (
            <div key={convo.id} className={`relative group ${menuOpenId === convo.id ? 'z-40' : ''}`}>
                {renamingId === convo.id ? (
                    <input
                        ref={inputRef}
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={handleRenameSubmit}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSubmit(); if (e.key === 'Escape') setRenamingId(null); }}
                        className="w-full text-left p-2 bg-[#09090b] text-white text-xs font-mono border border-zinc-600 focus:outline-none"
                    />
                ) : (
                    <button
                        onClick={() => selectConversation(convo.id)}
                        className={`w-full text-left p-2.5 transition-all text-xs font-mono pr-7 flex items-center gap-2 border ${
                            isActive
                                ? 'bg-[#18181b] border-zinc-700 text-white font-bold'
                                : 'bg-transparent border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-[#121215] hover:border-zinc-800'
                        }`}
                    >
                        <ChatBubbleIcon className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-white' : 'text-zinc-500'}`} />
                        <span className="truncate">{convo.title}</span>
                    </button>
                )}

                {renamingId !== convo.id && (
                    <div className="absolute right-1 top-1/2 -translate-y-1/2">
                        <button
                            onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === convo.id ? null : convo.id); }}
                            className={`p-1 text-zinc-500 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity hover:text-white`}
                            aria-label={`Options for chat: ${convo.title}`}
                        >
                            <EllipsisVerticalIcon className="w-4 h-4" />
                        </button>
                        {menuOpenId === convo.id && (
                            <div ref={menuRef} className="absolute right-0 top-6 w-36 bg-[#09090b] border border-zinc-800 shadow-2xl z-30 py-1 font-mono text-xs">
                                 <button onClick={() => { pinConversation(convo.id); setMenuOpenId(null); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-zinc-300 hover:bg-zinc-900 hover:text-white">
                                    <MapPinIcon className={`w-3.5 h-3.5 ${convo.isPinned ? 'fill-current text-white' : 'text-zinc-500'}`} />
                                    <span>{convo.isPinned ? 'UNPIN' : 'PIN'}</span>
                                </button>
                                <button onClick={() => { setRenamingId(convo.id); setRenameValue(convo.title); setMenuOpenId(null); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-zinc-300 hover:bg-zinc-900 hover:text-white">
                                    <PencilIcon className="w-3.5 h-3.5 text-zinc-500" />
                                    <span>RENAME</span>
                                </button>
                                <button onClick={() => { handleDelete(convo.id, convo.title); setMenuOpenId(null); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-red-400 hover:bg-red-950/40">
                                    <TrashIcon className="w-3.5 h-3.5" />
                                    <span>DELETE</span>
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="bg-[#09090b] p-3 flex flex-col h-full border-r border-zinc-800/90 font-mono">
            <button
                onClick={() => startNewChat()}
                className="flex items-center justify-center w-full gap-2 text-left p-2.5 mb-2 text-white font-mono text-xs font-bold uppercase tracking-wider bg-zinc-900 border border-zinc-700/80 hover:border-zinc-500 hover:bg-zinc-800 transition-colors"
            >
                <PencilSwooshIcon className="w-4 h-4" />
                <span>// NEW_SESSION</span>
            </button>
            <div className="relative mb-3">
                <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
                <input
                    type="search"
                    placeholder="Search logs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-[#0c0c0e] border border-zinc-800 p-2 pl-8 focus:outline-none focus:border-zinc-600 text-xs text-white placeholder-zinc-600 font-mono"
                />
            </div>
            <div className={`flex-grow no-scrollbar pr-1 ${visibleConversations.length === 0 ? 'overflow-y-hidden' : 'overflow-y-auto'}`}>
                {visibleConversations.length === 0 ? (
                    <div className="text-center text-zinc-500 text-xs mt-8 px-2 flex flex-col items-center h-full justify-center font-mono">
                        <ChatBubbleIcon className="w-8 h-8 mb-2 text-zinc-700" />
                        <p className="font-bold text-zinc-400 uppercase tracking-wider">// NO_HISTORY</p>
                        <p className="mt-1 text-[11px] text-zinc-600">Click New Session to start.</p>
                    </div>
                ) : filteredConversations.length === 0 && searchTerm ? (
                    <div className="text-center text-zinc-500 text-xs mt-6 px-2 font-mono">
                        <p>No matches for <span className="font-bold text-zinc-300">"{searchTerm}"</span></p>
                    </div>
                ) : (
                    <>
                        {pinnedConversations.length > 0 && (
                        <>
                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 px-1 mt-1">// PINNED_SESSIONS</p>
                            <div className="space-y-1 mb-3">
                            {pinnedConversations.map(renderConvoItem)}
                            </div>
                        </>
                        )}
                        {recentConversations.length > 0 && (
                            <>
                                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 px-1">// RECENT_SESSIONS</p>
                                <div className="space-y-1">
                                {recentConversations.map(renderConvoItem)}
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};


export const AIChatModal = ({ onClose }: { onClose: () => void; }) => {
    const { 
        activeConversation, 
        updateActiveConversation,
        startNewChat,
        appendChunkToLastMessage
    } = useAIAssistant();
    const { currentUser } = useAuth();

    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const [streamController, setStreamController] = useState<{ cancel: () => void } | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const modalRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const { isFullscreen, toggleFullscreen } = useFullscreen(modalRef);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [recognitionError, setRecognitionError] = useState<string | null>(null);
    const recognitionRef = useRef<any>(null);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [useSearch, setUseSearch] = useState(false);
    const [promptCategory, setPromptCategory] = useState<'ALL' | 'CODE' | 'IDEATION' | 'ANALYSIS' | 'DESIGN'>('ALL');

    const promptCategories = [
        { id: 'ALL', label: 'All Presets' },
        { id: 'CODE', label: 'Dev & Code' },
        { id: 'IDEATION', label: 'Ideation' },
        { id: 'ANALYSIS', label: 'Analysis' },
        { id: 'DESIGN', label: 'UI / UX' },
    ] as const;

    const allPresets = [
        { category: 'CODE', text: "Generate a TypeScript architectural pattern for high-throughput state syncing", icon: CodeBracketIcon, tag: 'TYPESCRIPT' },
        { category: 'IDEATION', text: "Brainstorm three high-impact developer tooling startups for 2026", icon: CubeIcon, tag: 'VENTURE' },
        { category: 'ANALYSIS', text: "Explain quantum error mitigation techniques in straightforward systems terms", icon: InformationCircleIcon, tag: 'RESEARCH' },
        { category: 'DESIGN', text: "What are the core technical principles of modern high-contrast monospace UI design?", icon: PencilSwooshIcon, tag: 'DESIGN_SYSTEM' },
        { category: 'CODE', text: "Draft an optimized React 18 custom hook for debounced streaming search input", icon: WrenchScrewdriverIcon, tag: 'REACT' },
        { category: 'ANALYSIS', text: "Synthesize the latest technical trade-offs between Cloud SQL and Firestore databases", icon: InformationCircleIcon, tag: 'ARCHITECTURE' },
    ];

    const filteredPresets = promptCategory === 'ALL'
        ? allPresets
        : allPresets.filter(p => p.category === promptCategory);

    const allSuggestions = [
        "Help me draft a technical specification for real-time state sync",
        "Brainstorm three startup ideas in the developer infrastructure space",
        "Explain quantum computing in technical but accessible terms",
        "What are modern typography and spatial design rules for engineering dashboards?",
        "How do I optimize WebSockets for low-latency collaboration?",
        "Summarize the performance implications of React 19 server actions",
        "Generate a clean REST-to-GraphQL schema conversion strategy",
        "Write a prompt system instruction for structured code generation",
    ];

    useEffect(() => {
        if (!isLoading && modalRef.current) {
            const blocks = modalRef.current.querySelectorAll('pre code:not(.hljs)');
            blocks.forEach((block) => {
                try {
                    if (window.hljs) {
                        window.hljs.highlightElement(block);
                    }
                } catch (e) {
                    console.error('highlight.js error', e);
                }
            });
        }
    }, [activeConversation?.messages, isLoading]);

    useEffect(() => {
        if (input.trim()) {
            const filtered = allSuggestions.filter(s => 
                s.toLowerCase().includes(input.toLowerCase())
            ).slice(0, 3);
            setSuggestions(filtered);
        } else {
            setSuggestions([]);
        }
    }, [input]);
    
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            const scrollHeight = textareaRef.current.scrollHeight;
            textareaRef.current.style.height = `${scrollHeight}px`;
        }
    }, [input]);

    // Setup Speech Recognition
    useEffect(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

        if (!SpeechRecognition) {
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
            const transcript = Array.from(event.results)
              .map((result: any) => result[0])
              .map((result) => result.transcript)
              .join('');
            setInput(transcript);
            setRecognitionError(null);
        };
        
        recognition.onend = () => {
            setIsListening(false);
        };

        recognition.onerror = (event: any) => {
            console.error("Speech recognition error", event.error);
            if (event.error === 'not-allowed') {
                setRecognitionError("Microphone permission denied. Enable microphone access in browser settings.");
            } else if (event.error === 'no-speech') {
                setRecognitionError("No speech detected. Verify microphone hardware.");
            } else if (event.error === 'aborted') {
                // Ignore aborted
            } else {
                setRecognitionError("Speech recognition error encountered.");
            }
            setIsListening(false);
        };
        
        recognitionRef.current = recognition;

    }, []);

    const handleToggleListening = () => {
        setRecognitionError(null);

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setRecognitionError("Speech recognition API not supported in this browser.");
            return;
        }
        
        if (!recognitionRef.current) return;

        if (isListening) {
            recognitionRef.current.stop();
        } else {
            setInput('');
            try {
                recognitionRef.current.start();
                setIsListening(true);
            } catch(e) {
                console.error("Could not start recognition", e);
                setIsListening(false);
                setRecognitionError("Could not initialize microphone.");
            }
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [activeConversation?.messages, isLoading]);

    useEffect(() => {
        if (!isFullscreen) {
            setIsSidebarOpen(false);
        }
    }, [isFullscreen]);

    useEffect(() => {
        const mainAppWrapper = document.getElementById('main-app-wrapper');
        if (!mainAppWrapper) return;

        if (!isFullscreen) {
            mainAppWrapper.classList.add('blur-background');
        } else {
            mainAppWrapper.classList.remove('blur-background');
        }

        return () => {
            mainAppWrapper.classList.remove('blur-background');
        };
    }, [isFullscreen]);

    const handleSend = (messageOverride?: string) => {
        const messageToSend = messageOverride || input.trim();
        if (!activeConversation || messageToSend === '' || isLoading) return;

        setSuggestions([]);

        const userMessage: ChatMessage = { role: 'user', parts: [{ text: messageToSend }] };
        const newMessages = [...activeConversation.messages, userMessage];
        
        const placeholderModelMessage: ChatMessage = { role: 'model', parts: [{ text: '' }], sources: [] };
        const messagesWithPlaceholder = [...newMessages, placeholderModelMessage];
        
        const isNewChat = activeConversation.isUnsaved;
        const newTitle = isNewChat ? messageToSend.substring(0, 45) : activeConversation.title;
        
        updateActiveConversation(messagesWithPlaceholder, newTitle);
        
        if (!messageOverride) {
          setInput('');
        }
        
        setIsLoading(true);
        setIsAnimating(true);

        const controller = getAIChatResponseStream(
            newMessages,
            activeConversation.context,
            useSearch,
            (chunk) => {
                appendChunkToLastMessage(chunk);
            },
            (error) => {
                appendChunkToLastMessage({ text: error });
            },
            () => {
                setIsLoading(false);
                setStreamController(null);
            }
        );
        setStreamController(controller);
    };
    
    const handleStop = () => {
        streamController?.cancel();
    };

    const handleRegenerate = () => {
        if (!activeConversation || isLoading || activeConversation.messages.length < 2) return;

        const lastModelMessageIndex = activeConversation.messages.length - 1;
        const lastUserMessageIndex = lastModelMessageIndex - 1;

        if (
            activeConversation.messages[lastModelMessageIndex].role === 'model' &&
            activeConversation.messages[lastUserMessageIndex].role === 'user'
        ) {
            const historyForRegeneration = activeConversation.messages.slice(0, lastUserMessageIndex + 1);
            
            const placeholderModelMessage: ChatMessage = { role: 'model', parts: [{ text: '' }], sources: [] };
            const messagesWithPlaceholder = [...historyForRegeneration, placeholderModelMessage];
            
            updateActiveConversation(messagesWithPlaceholder, activeConversation.title);
            
            setIsLoading(true);
            setIsAnimating(true);

            const controller = getAIChatResponseStream(
                historyForRegeneration,
                activeConversation.context,
                false,
                (chunk) => appendChunkToLastMessage(chunk),
                (error) => appendChunkToLastMessage({ text: error }),
                () => {
                    setIsLoading(false);
                    setStreamController(null);
                }
            );
            setStreamController(controller);
        } else {
            console.warn("Regeneration condition not met.");
        }
    };

    const handleSuggestionClick = (suggestion: string) => {
        if (isLoading) return;
        setInput(suggestion);
        setSuggestions([]);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const parseInlineMarkdown = (text: string): React.ReactNode => {
        const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`|\[.*?\]\(.*?\)|#[\w-]+)/g;
        const parts = text.split(regex);

        return parts.map((part, index) => {
            if (!part) return null;

            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={index} className="font-bold text-white tracking-wide">{part.slice(2, -2)}</strong>;
            }
            if (part.startsWith('*') && part.endsWith('*')) {
                return <em key={index} className="italic text-zinc-300">{part.slice(1, -1)}</em>;
            }
            if (part.startsWith('`') && part.endsWith('`')) {
                return <code key={index} className="bg-black border border-zinc-800 text-zinc-200 px-1.5 py-0.5 text-xs font-mono">{part.slice(1, -1)}</code>;
            }
            const linkMatch = part.match(/\[(.*?)\]\((.*?)\)/);
            if (linkMatch) {
                const linkText = linkMatch[1];
                const url = linkMatch[2];
                return <a key={index} href={url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">{linkText}</a>;
            }
            if (part.startsWith('#')) {
                return (
                    <span key={index} className="bg-[#18181b] border border-zinc-800 text-zinc-300 px-1.5 py-0.5 text-[11px] font-mono mx-1">
                        {part}
                    </span>
                );
            }
            return part;
        });
    };

    const renderMessageContent = (text: string) => {
        const lines = text.split('\n');
        const elements: React.ReactNode[] = [];
        let currentList: {type: 'ul' | 'ol', items: React.ReactNode[]} | null = null;
        let inCodeBlock = false;
        let codeBlockContent: string[] = [];
        let codeBlockLanguage = '';

        const flushList = () => {
            if (currentList) {
                const ListTag = currentList.type;
                elements.push(<ListTag key={`list-${elements.length}`} className={`${ListTag === 'ul' ? 'list-disc' : 'list-decimal'} list-outside pl-5 space-y-1.5 my-2.5 text-zinc-300 font-mono text-xs leading-relaxed`}>{currentList.items}</ListTag>);
                currentList = null;
            }
        };

        const flushCodeBlock = () => {
            if (codeBlockContent.length > 0) {
                const codeString = codeBlockContent.join('\n');
                elements.push(
                    <div key={`codeblock-${elements.length}`} className="relative border border-zinc-800 my-3 font-mono">
                        <div className="flex items-center justify-between px-3 py-1.5 bg-[#09090b] border-b border-zinc-800 text-[10px] text-zinc-400 uppercase tracking-widest font-mono">
                            <span className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 bg-emerald-500"></span>
                                <span>// {codeBlockLanguage || 'CODE'}</span>
                            </span>
                            <CopyButton textToCopy={codeString} />
                        </div>
                        <pre className="bg-black p-3.5 text-xs text-zinc-200 overflow-x-auto font-mono leading-relaxed">
                            <code className={`language-${codeBlockLanguage}`}>
                                {codeString}
                            </code>
                        </pre>
                    </div>
                );
                codeBlockContent = [];
            }
        };

        lines.forEach((line, index) => {
            if (line.trim().startsWith('```')) {
                if (inCodeBlock) {
                    flushCodeBlock();
                    inCodeBlock = false;
                    codeBlockLanguage = '';
                } else {
                    flushList();
                    inCodeBlock = true;
                    codeBlockLanguage = line.trim().substring(3);
                }
                return;
            }

            if (inCodeBlock) {
                codeBlockContent.push(line);
                return;
            }

            const trimmedLine = line.trim();
            if (trimmedLine === '') {
                flushList();
                return;
            }

            const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.*)/);
            if (headingMatch) {
                flushList();
                const level = headingMatch[1].length;
                const content = headingMatch[2];
                const tag = `h${level}` as keyof React.JSX.IntrinsicElements;
                const classNames = [
                    "text-base font-bold mt-5 mb-2 pb-1.5 border-b border-zinc-800 text-white font-mono uppercase tracking-wider", // h1
                    "text-sm font-bold mt-4 mb-2 text-white font-mono uppercase tracking-wider",  // h2
                    "text-xs font-bold mt-3 mb-1.5 text-zinc-200 font-mono uppercase tracking-wider",  // h3
                    "text-xs font-bold mt-3 mb-1 text-zinc-300 font-mono", // h4
                    "text-xs font-semibold mt-2 mb-1 text-zinc-400 font-mono",  // h5
                    "text-[11px] font-semibold mt-2 mb-1 text-zinc-400 font-mono", // h6
                ];
                elements.push(<tag key={`h${level}-${index}`} className={classNames[level - 1]}>{parseInlineMarkdown(content)}</tag>);
                return;
            }

            const hrMatch = trimmedLine.match(/^(---|___|\*\*\*)\s*$/);
            if (hrMatch) {
                flushList();
                elements.push(<hr key={`hr-${index}`} className="border-zinc-800 my-4" />);
                return;
            }

            const blockquoteMatch = trimmedLine.match(/^>\s?(.*)/);
            if (blockquoteMatch) {
                flushList();
                const content = blockquoteMatch[1];
                elements.push(
                    <blockquote key={`bq-${index}`} className="border-l-2 border-zinc-600 bg-[#09090b] pl-3 py-1 text-zinc-400 my-2 font-mono text-xs italic">
                        {parseInlineMarkdown(content)}
                    </blockquote>
                );
                return;
            }

            const unorderedMatch = trimmedLine.match(/^([*-])\s+(.*)/);
            const orderedMatch = trimmedLine.match(/^(\d+)\.\s+(.*)/);

            if (unorderedMatch) {
                if (currentList?.type !== 'ul') {
                    flushList();
                    currentList = { type: 'ul', items: [] };
                }
                currentList.items.push(<li key={`li-${index}`} className="leading-relaxed">{parseInlineMarkdown(unorderedMatch[2] || '')}</li>);
            } else if (orderedMatch) {
                if (currentList?.type !== 'ol') {
                    flushList();
                    currentList = { type: 'ol', items: [] };
                }
                currentList.items.push(<li key={`li-${index}`} className="leading-relaxed">{parseInlineMarkdown(orderedMatch[2] || '')}</li>);
            } else {
                flushList();
                elements.push(<p key={`p-${index}`} className="leading-relaxed text-zinc-300 font-mono text-xs my-1.5">{parseInlineMarkdown(trimmedLine)}</p>);
            }
        });

        flushList();
        flushCodeBlock();
        return <div className="space-y-1">{elements}</div>;
    };

    const sidebarClass = isFullscreen ? 'w-64' : `absolute top-0 left-0 h-full w-64 z-20 transform transition-transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`;
    const isWelcomeState = !activeConversation || (activeConversation.isUnsaved && !activeConversation.context && activeConversation.messages.length <= 1);
    
    return (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex justify-center items-center z-50 p-2 sm:p-4">
            <div ref={modalRef} className="bg-[#0c0c0e] border border-zinc-800/90 shadow-2xl w-full max-w-5xl h-[85vh] flex overflow-hidden font-mono">
                <div className={sidebarClass}>
                    <ChatHistorySidebar />
                </div>

                <div className="flex-1 flex flex-col p-3 sm:p-5 overflow-hidden bg-[#0c0c0e]">
                    {/* Header */}
                    <div className="flex justify-between items-center pb-3 border-b border-zinc-800">
                        <div className="flex items-center gap-2.5 truncate">
                           {!isFullscreen && (
                                <button 
                                    onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
                                    className="p-1.5 border border-zinc-800 bg-[#09090b] text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
                                    title="Toggle Sessions History"
                                >
                                    <MenuIcon className="w-4 h-4" />
                                </button>
                           )}
                           <div className="flex items-center gap-2 truncate font-mono">
                                <div className="w-6 h-6 bg-zinc-900 border border-zinc-700 flex items-center justify-center text-white">
                                    <SparklesIcon className="w-3.5 h-3.5" />
                                </div>
                                <h2 className="text-xs sm:text-sm font-bold text-white tracking-wider truncate uppercase">
                                    {activeConversation?.context ? `// CONTEXT: ${activeConversation.context.title}` : '// SPARK_INTELLIGENCE'}
                                </h2>
                                <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono font-bold bg-[#18181b] border border-zinc-800 text-zinc-400">
                                    GEMINI_FLASH
                                </span>
                           </div>
                        </div>

                        <div className="flex items-center gap-1.5 font-mono">
                            <button 
                                onClick={toggleFullscreen} 
                                className="p-1.5 border border-zinc-800 bg-[#09090b] text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
                                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                            >
                                {isFullscreen ? <ArrowsPointingInIcon className="w-4 h-4" /> : <ArrowsPointingOutIcon className="w-4 h-4" />}
                            </button>
                            <button 
                                onClick={onClose} 
                                className="p-1.5 border border-zinc-800 bg-[#09090b] text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
                                title="Close Modal"
                            >
                                <CloseIcon className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Messages Container / Welcome */}
                    <div className="flex-grow overflow-y-auto py-4 pr-1 sm:pr-2">
                        <div className={isFullscreen ? "max-w-5xl mx-auto" : "w-full"}>
                           {isWelcomeState ? (
                                <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-2 sm:p-4 font-mono">
                                    <div className="w-14 h-14 bg-[#09090b] border border-zinc-800 flex items-center justify-center mb-4 text-white">
                                        <SparklesIcon className="w-7 h-7" />
                                    </div>
                                    <h2 className="text-base sm:text-lg font-bold text-white uppercase tracking-widest">
                                        // SPARK_AI: {currentUser?.displayName?.split(' ')[0] || 'ENGINEER'}
                                    </h2>
                                    <p className="text-xs text-zinc-500 mt-1 max-w-md font-mono">
                                        Select a prompt preset below or type a command to initialize reasoning and distillation.
                                    </p>
                                    
                                    {/* Segmented Preset Category Filter Bar */}
                                    <div className="w-full max-w-2xl bg-[#09090b] border border-zinc-800/90 p-1 grid grid-cols-5 gap-1 mt-6 mb-4">
                                        {promptCategories.map(cat => {
                                            const isActive = promptCategory === cat.id;
                                            return (
                                                <button
                                                    key={cat.id}
                                                    onClick={() => setPromptCategory(cat.id)}
                                                    className={`py-1.5 px-1 text-center font-mono text-[11px] uppercase tracking-wider transition-all duration-150 flex items-center justify-center truncate ${
                                                        isActive
                                                            ? 'bg-[#18181b] border border-zinc-700 text-white font-bold'
                                                            : 'bg-transparent border border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30'
                                                    }`}
                                                >
                                                    <span className="truncate">{cat.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Presets Grid */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-2xl text-left">
                                        {filteredPresets.map((preset, index) => (
                                            <button
                                                key={index}
                                                onClick={() => handleSend(preset.text)}
                                                className="bg-[#09090b] border border-zinc-800/90 hover:border-zinc-600 p-3 text-left transition-all group flex flex-col justify-between gap-2.5 font-mono"
                                            >
                                                <div className="flex items-center justify-between w-full">
                                                    <span className="text-[10px] px-1.5 py-0.5 bg-[#18181d] border border-zinc-800 text-zinc-400 group-hover:text-white uppercase tracking-widest">
                                                        // {preset.tag}
                                                    </span>
                                                    <preset.icon className="w-3.5 h-3.5 text-zinc-600 group-hover:text-white transition-colors" />
                                                </div>
                                                <p className="text-xs text-zinc-300 group-hover:text-white font-mono leading-relaxed line-clamp-2">
                                                    {preset.text}
                                                </p>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                           ) : (
                            <div className="space-y-4 font-mono">
                                {activeConversation?.messages.map((msg, index) => {
                                    const isLastMessage = index === activeConversation.messages.length - 1;
                                    const isStreamingMessage = (isLoading || isAnimating) && isLastMessage;

                                    return (
                                        <div key={index} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                            <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1 px-1">
                                                {msg.role === 'user' ? '// USER_INPUT' : '// SPARK_INTELLIGENCE'}
                                            </div>
                                            <div className={`p-3.5 border ${
                                                msg.role === 'user' 
                                                    ? 'bg-[#18181b] border-zinc-700 text-white max-w-xl text-xs font-mono leading-relaxed' 
                                                    : 'bg-[#09090b] border-zinc-800/90 text-zinc-200 w-full max-w-3xl text-xs font-mono leading-relaxed'
                                            }`}>
                                                {msg.role === 'user' ? (
                                                    <p className="whitespace-pre-wrap">{msg.parts[0].text}</p>
                                                ) : (
                                                    <div>
                                                        {isStreamingMessage ? (
                                                            <SmoothStream
                                                                fullText={msg.parts[0].text}
                                                                renderContent={renderMessageContent}
                                                                onAnimationComplete={() => setIsAnimating(false)}
                                                            />
                                                        ) : (
                                                            renderMessageContent(msg.parts[0].text)
                                                        )}
                                                        
                                                        {isStreamingMessage && (
                                                            <span className="inline-block w-2 h-3.5 bg-emerald-400 animate-pulse ml-1 align-middle"></span>
                                                        )}
                                                         {msg.sources && msg.sources.length > 0 && (
                                                            <div className="mt-3.5 pt-3 border-t border-zinc-800">
                                                                <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 font-mono">// SOURCES_RETRIEVED</h4>
                                                                <ol className="text-xs space-y-1 font-mono">
                                                                    {msg.sources.map((source, idx) => (
                                                                        source && (
                                                                            <li key={source.uri || idx} className="flex items-start gap-1.5 text-zinc-400">
                                                                                <span className="text-zinc-600">{idx + 1}.</span>
                                                                                <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline truncate" title={source.uri}>
                                                                                    {source.title || (source.uri && new URL(source.uri).hostname)}
                                                                                </a>
                                                                            </li>
                                                                        )
                                                                    ))}
                                                                </ol>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            {msg.role === 'model' && !isStreamingMessage && msg.parts[0].text && (
                                                 <ActionButtons message={msg} onRegenerate={handleRegenerate} />
                                            )}
                                        </div>
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </div>
                           )}
                        </div>
                    </div>
                    
                    {/* Command Input Area */}
                    <div className="mt-2 pt-2 border-t border-zinc-800 font-mono relative">
                        {suggestions.length > 0 && (
                            <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#09090b] p-1.5 border border-zinc-800 space-y-1 shadow-2xl z-30 font-mono">
                                <div className="px-2 py-1 text-[10px] text-zinc-500 uppercase tracking-wider">// AUTOCOMPLETE</div>
                                {suggestions.map(s => (
                                    <button 
                                        key={s} 
                                        onClick={() => handleSuggestionClick(s)}
                                        className="w-full text-left text-xs p-2 bg-[#121215] hover:bg-[#18181d] hover:text-white text-zinc-300 border border-transparent hover:border-zinc-700 transition-colors"
                                    >
                                        &gt; {s}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Top action flags row */}
                        <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1.5 px-1 font-mono uppercase tracking-wider">
                            <span className="flex items-center gap-2">
                                <span>// PROMPT_INPUT</span>
                                {useSearch && <span className="text-blue-400">[WEB_SEARCH_ACTIVE]</span>}
                                {isListening && <span className="text-emerald-400 animate-pulse">[MIC_LISTENING]</span>}
                            </span>
                            <span>SHIFT+ENTER = NEWLINE</span>
                        </div>

                        <div className="flex items-end bg-[#09090b] border border-zinc-800 p-2 focus-within:border-zinc-600 transition-colors">
                            <span className="text-zinc-600 font-mono text-sm px-1.5 pb-1">&gt;</span>
                            <textarea
                                ref={textareaRef}
                                rows={1}
                                value={input}
                                onChange={(e) => {
                                    setInput(e.target.value);
                                    if (recognitionError) setRecognitionError(null);
                                }}
                                onKeyDown={handleKeyDown}
                                placeholder={isListening ? "Listening to voice audio..." : "Enter prompt or command..."}
                                className="flex-grow bg-transparent p-1.5 text-white placeholder-zinc-600 focus:outline-none resize-none overflow-y-auto max-h-40 text-xs font-mono"
                                disabled={isLoading}
                            />
                            <div className="flex items-center gap-1.5 pl-2 font-mono">
                                <button
                                    onClick={() => setUseSearch(prev => !prev)}
                                    disabled={isLoading}
                                    className={`p-1.5 border text-xs transition-colors ${
                                        useSearch 
                                            ? 'bg-blue-950/40 border-blue-800 text-blue-400' 
                                            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                                    }`}
                                    aria-label={useSearch ? 'Web search enabled' : 'Web search disabled'}
                                    title={useSearch ? "Web Search: Enabled" : "Web Search: Disabled"}
                                >
                                    <GlobeAltIcon className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={handleToggleListening}
                                    disabled={isLoading}
                                    className={`p-1.5 border text-xs transition-colors ${
                                        isListening 
                                            ? 'bg-red-950/40 border-red-800 text-red-400 animate-pulse' 
                                            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                                    }`}
                                    aria-label={isListening ? 'Stop listening' : 'Start voice input'}
                                    title="Voice Input"
                                >
                                    <MicrophoneIcon className="w-4 h-4" />
                                </button>
                                {isLoading ? (
                                    <button
                                        onClick={handleStop}
                                        className="bg-red-950/50 border border-red-800 text-red-300 px-3 py-1.5 text-xs font-mono uppercase tracking-wider hover:bg-red-900/60 flex items-center gap-1.5 transition-colors"
                                        aria-label="Stop generating response"
                                    >
                                        <StopIcon className="w-3.5 h-3.5" />
                                        <span>STOP</span>
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleSend()}
                                        disabled={isListening || !input.trim()}
                                        className="bg-zinc-900 border border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800 text-white disabled:opacity-40 disabled:hover:border-zinc-800 disabled:hover:bg-zinc-900 px-3 py-1.5 text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 transition-colors font-bold"
                                    >
                                        <span>SEND</span>
                                        <SendIcon className="w-3.5 h-3.5"/>
                                    </button>
                                )}
                            </div>
                        </div>
                        {recognitionError && (
                            <p className="text-red-400 text-[11px] mt-1.5 font-mono text-center">{recognitionError}</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};


export const AIAssistantButton = () => {
    const { openModal } = useAIAssistant();

    return (
        <button
            onClick={() => openModal()}
            className="fixed bottom-6 right-6 bg-[#09090b] border border-zinc-700/90 hover:border-zinc-400 text-white p-3.5 shadow-2xl hover:bg-zinc-900 transition-all z-40 font-mono group flex items-center gap-2"
            aria-label="Open AI Assistant"
        >
            <SparklesIcon className="w-5 h-5 text-zinc-300 group-hover:text-white transition-colors" />
            <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline-block">// SPARK_AI</span>
        </button>
    );
};
