

import React, { useState, useRef, useEffect } from 'react';
import { SparklesIcon, CloseIcon, SendIcon, ArrowsPointingOutIcon, ArrowsPointingInIcon, MenuIcon, PencilSquareIcon, CubeIcon, InformationCircleIcon, PencilSwooshIcon, EllipsisVerticalIcon, MapPinIcon, PencilIcon, TrashIcon, StopIcon, ChatBubbleIcon, MicrophoneIcon, ClipboardIcon, CheckIcon, ThumbsUpIcon, ThumbsDownIcon, RegenerateIcon, ShareIcon, MagnifyingGlassIcon, GlobeAltIcon } from './Icons';
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
            className="absolute top-2 right-2 p-1.5 bg-gray-900/80 rounded-md text-gray-300 hover:text-white hover:bg-gray-800/80 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
            aria-label={isCopied ? 'Copied to clipboard' : 'Copy code to clipboard'}
        >
            {isCopied ? (
                <CheckIcon className="w-4 h-4 text-green-400" />
            ) : (
                <ClipboardIcon className="w-4 h-4" />
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
            alert('Response copied to clipboard. Sharing not supported on this browser.');
        }
    };

    const actionButtonClass = "p-1.5 rounded-md text-gray-400 hover:bg-gray-800 hover:text-white transition-colors";
    
    return (
        <div className="flex items-center gap-2 mt-2">
            <button title="Good response" className={`${actionButtonClass} ${feedback === 'like' ? 'text-blue-500 bg-gray-800' : ''}`} onClick={() => setFeedback(f => f === 'like' ? null : 'like')}>
                <ThumbsUpIcon className="w-4 h-4" />
            </button>
            <button title="Bad response" className={`${actionButtonClass} ${feedback === 'dislike' ? 'text-red-500 bg-gray-800' : ''}`} onClick={() => setFeedback(f => f === 'dislike' ? null : 'dislike')}>
                <ThumbsDownIcon className="w-4 h-4" />
            </button>
            <button title="Regenerate" className={actionButtonClass} onClick={onRegenerate}>
                <RegenerateIcon className="w-4 h-4" />
            </button>
            <button title="Share" className={actionButtonClass} onClick={handleShare}>
                <ShareIcon className="w-4 h-4" />
            </button>
            <button title={isCopied ? "Copied!" : "Copy"} className={actionButtonClass} onClick={handleCopy}>
                {isCopied ? <CheckIcon className="w-4 h-4 text-green-400" /> : <ClipboardIcon className="w-4 h-4" />}
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
        if (window.confirm(`Are you sure you want to delete the chat "${title}"? This action cannot be undone.`)) {
            deleteConversation(id);
        }
    };
    
    const pinnedConversations = filteredConversations.filter(c => c.isPinned).sort((a, b) => (a.title > b.title ? 1 : -1));
    const recentConversations = filteredConversations.filter(c => !c.isPinned);

    const renderConvoItem = (convo: Conversation) => (
        <div key={convo.id} className={`relative group ${menuOpenId === convo.id ? 'z-40' : ''}`}>
            {renamingId === convo.id ? (
                <input
                    ref={inputRef}
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={handleRenameSubmit}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSubmit(); if (e.key === 'Escape') setRenamingId(null); }}
                    className="w-full text-left p-2.5 rounded-md bg-invox-dark-accent text-white text-sm font-medium focus:outline-none ring-1 ring-inset ring-gray-800 focus:ring-gray-700"
                />
            ) : (
                <button
                    onClick={() => selectConversation(convo.id)}
                    className={`w-full text-left p-2.5 rounded-md truncate transition-all text-sm font-medium pr-8 flex items-center gap-3 ${
                        activeConversation?.id === convo.id
                            ? 'bg-gradient-to-r from-invox-red to-invox-blue text-white'
                            : 'text-gray-300 hover:bg-gray-800'
                    }`}
                >
                    <ChatBubbleIcon className="w-4 h-4 flex-shrink-0"/>
                    <span className="truncate">{convo.title}</span>
                </button>
            )}

            {renamingId !== convo.id && (
                <div className="absolute right-1 top-1/2 -translate-y-1/2">
                    <button
                        onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === convo.id ? null : convo.id); }}
                        className={`p-1 rounded-full text-gray-400 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity ${activeConversation?.id === convo.id ? 'text-white' : 'hover:text-white'}`}
                        aria-label={`Options for chat: ${convo.title}`}
                    >
                        <EllipsisVerticalIcon className="w-5 h-5" />
                    </button>
                    {menuOpenId === convo.id && (
                        <div ref={menuRef} className="absolute right-0 top-6 w-40 bg-invox-dark-accent border border-gray-800 rounded-lg shadow-xl z-30 py-1">
                             <button onClick={() => { pinConversation(convo.id); setMenuOpenId(null); }} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800">
                                <MapPinIcon className={`w-4 h-4 ${convo.isPinned ? 'fill-current text-white' : ''}`} />
                                <span>{convo.isPinned ? 'Unpin' : 'Pin'}</span>
                            </button>
                            <button onClick={() => { setRenamingId(convo.id); setRenameValue(convo.title); setMenuOpenId(null); }} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800">
                                <PencilIcon className="w-4 h-4" />
                                <span>Rename</span>
                            </button>
                            <button onClick={() => { handleDelete(convo.id, convo.title); setMenuOpenId(null); }} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:bg-gray-800">
                                <TrashIcon className="w-4 h-4" />
                                <span>Delete</span>
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    return (
        <div className="bg-invox-dark p-3 flex flex-col h-full border-r border-gray-800">
            <button
                onClick={() => startNewChat()}
                className="flex items-center justify-center w-full gap-2 text-left p-3 mb-1 rounded-lg text-white font-semibold bg-invox-dark-accent border border-gray-800 hover:bg-gray-700 transition-colors duration-200"
            >
                <PencilSwooshIcon className="w-5 h-5" />
                <span>New Chat</span>
            </button>
            <div className="relative my-2">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                    type="search"
                    placeholder="Search history..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-invox-dark-accent border border-gray-800 rounded-lg p-2 pl-9 focus:outline-none focus:ring-1 focus:ring-gray-700 text-sm text-white"
                />
            </div>
            <div className={`flex-grow no-scrollbar pr-1 ${visibleConversations.length === 0 ? 'overflow-y-hidden' : 'overflow-y-auto'}`}>
                {visibleConversations.length === 0 ? (
                    <div className="text-center text-gray-500 text-sm mt-8 px-2 flex flex-col items-center h-full justify-center">
                        <ChatBubbleIcon className="w-10 h-10 mb-3 text-gray-600" />
                        <p className="font-semibold text-gray-400">Your chat history is empty.</p>
                        <p className="mt-1">Click 'New Chat' to get started!</p>
                    </div>
                ) : filteredConversations.length === 0 && searchTerm ? (
                    <div className="text-center text-gray-500 text-sm mt-6 px-2">
                        <p>No results for <span className="font-semibold text-gray-400">"{searchTerm}"</span></p>
                    </div>
                ) : (
                    <>
                        {pinnedConversations.length > 0 && (
                        <>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2 mt-2">Pinned</p>
                            <div className="space-y-1 mb-4">
                            {pinnedConversations.map(renderConvoItem)}
                            </div>
                        </>
                        )}
                        {recentConversations.length > 0 && (
                            <>
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2">Recent</p>
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
        conversations,
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

    const allSuggestions = [
        "Help me draft a post about AI in cinematography",
        "Brainstorm three startup ideas in the fintech space",
        "Explain quantum computing in simple terms",
        "What are some good UI/UX design principles?",
        "How do I get started with machine learning?",
        "Summarize the latest trends in renewable energy",
        "Give me a recipe for a healthy dinner",
        "Write a short poem about space exploration",
    ];

    useEffect(() => {
        if (!isLoading && modalRef.current) {
            // Find all `pre code` blocks that have not been highlighted yet.
            // highlight.js adds the `hljs` class to the `code` element.
            const blocks = modalRef.current.querySelectorAll('pre code:not(.hljs)');
            blocks.forEach((block) => {
                try {
                    window.hljs.highlightElement(block);
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
            textareaRef.current.style.height = 'auto'; // Reset height
            const scrollHeight = textareaRef.current.scrollHeight;
            textareaRef.current.style.height = `${scrollHeight}px`; // Set to content height
        }
    }, [input]);

    // Setup Speech Recognition
    useEffect(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

        if (!SpeechRecognition) {
            console.warn("Speech recognition not supported in this browser.");
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
                setRecognitionError("Microphone permission denied. Please enable it in your browser settings to use voice input.");
            } else if (event.error === 'no-speech') {
                setRecognitionError("No speech was detected. Please make sure your microphone is working and try again.");
            } else if (event.error === 'aborted') {
                console.log("Speech recognition aborted by user.");
            } else {
                setRecognitionError("An error occurred during speech recognition. Please try again.");
            }
            setIsListening(false);
        };
        
        recognitionRef.current = recognition;

    }, []);

    const handleToggleListening = () => {
        setRecognitionError(null);

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setRecognitionError("Speech recognition is not supported in this browser.");
            return;
        }
        
        if (!recognitionRef.current) return;

        if (isListening) {
            recognitionRef.current.stop();
        } else {
            setInput(''); // Clear input before starting
            try {
                recognitionRef.current.start();
                setIsListening(true);
            } catch(e) {
                console.error("Could not start recognition", e);
                setIsListening(false); // Ensure state is correct on error
                setRecognitionError("Could not start listening. Please try again.");
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

        // Cleanup function to remove blur when modal closes
        return () => {
            mainAppWrapper.classList.remove('blur-background');
        };
    }, [isFullscreen]);

    const handleSend = (messageOverride?: string) => {
        const messageToSend = messageOverride || input.trim();
        if (!activeConversation || messageToSend === '' || isLoading) return;

        setSuggestions([]); // Clear suggestions on send

        const userMessage: ChatMessage = { role: 'user', parts: [{ text: messageToSend }] };
        const newMessages = [...activeConversation.messages, userMessage];
        
        const placeholderModelMessage: ChatMessage = { role: 'model', parts: [{ text: '' }], sources: [] };
        const messagesWithPlaceholder = [...newMessages, placeholderModelMessage];
        
        const isNewChat = activeConversation.isUnsaved;
        const newTitle = isNewChat ? messageToSend.substring(0, 50) : activeConversation.title;
        
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
                false, // Regeneration doesn't use search by default
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
        setSuggestions([]); // Clear suggestions after selection
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const initialSuggestions = [
        { text: 'Help me draft a post about AI in cinematography', icon: PencilSquareIcon },
        { text: 'Brainstorm three startup ideas in the fintech space', icon: CubeIcon },
        { text: 'Explain quantum computing in simple terms', icon: InformationCircleIcon },
        { text: 'What are some good UI/UX design principles?', icon: PencilSwooshIcon },
    ];

    const parseInlineMarkdown = (text: string): React.ReactNode => {
        // Regex to capture: bold, italics, inline code, links, hashtags. Order matters.
        const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`|\[.*?\]\(.*?\)|#[\w-]+)/g;
        const parts = text.split(regex);

        return parts.map((part, index) => {
            if (!part) return null;

            // Bold
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={index} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
            }
            // Italic
            if (part.startsWith('*') && part.endsWith('*')) {
                return <em key={index} className="italic text-gray-300">{part.slice(1, -1)}</em>;
            }
            // Inline Code
            if (part.startsWith('`') && part.endsWith('`')) {
                return <code key={index} className="bg-gray-900 text-invox-red px-1.5 py-0.5 rounded text-sm font-mono">{part.slice(1, -1)}</code>;
            }
            // Link
            const linkMatch = part.match(/\[(.*?)\]\((.*?)\)/);
            if (linkMatch) {
                const text = linkMatch[1];
                const url = linkMatch[2];
                return <a key={index} href={url} target="_blank" rel="noopener noreferrer" className="text-invox-red hover:underline">{text}</a>;
            }
            // Hashtag
            if (part.startsWith('#')) {
                return (
                    <button key={index} className="bg-gray-700 text-sky-400 px-2 py-0.5 rounded text-sm font-semibold hover:bg-gray-600 hover:text-sky-300 transition-colors mx-1">
                        {part}
                    </button>
                );
            }
            // Plain text
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
                elements.push(<ListTag key={`list-${elements.length}`} className={`${ListTag === 'ul' ? 'list-disc' : 'list-decimal'} list-outside pl-6 space-y-2 my-3`}>{currentList.items}</ListTag>);
                currentList = null;
            }
        };

        const flushCodeBlock = () => {
            if (codeBlockContent.length > 0) {
                const codeString = codeBlockContent.join('\n');
                elements.push(
                    <div key={`codeblock-${elements.length}`} className="relative group my-4">
                        <CopyButton textToCopy={codeString} />
                        <pre className="bg-invox-dark rounded-md p-4 pt-10 text-sm text-white overflow-x-auto font-mono">
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
                    "text-2xl font-bold mt-8 mb-4 pb-3 border-b border-gray-800 text-white", // h1
                    "text-xl font-bold mt-7 mb-3 text-white",  // h2
                    "text-lg font-semibold mt-6 mb-2 text-gray-200",  // h3
                    "text-base font-semibold mt-5 mb-2 text-white", // h4
                    "text-sm font-semibold mt-4 mb-1 text-white",  // h5
                    "text-xs font-semibold mt-4 mb-1 text-gray-300", // h6
                ];
                elements.push(<tag key={`h${level}-${index}`} className={classNames[level - 1]}>{parseInlineMarkdown(content)}</tag>);
                return;
            }

            const hrMatch = trimmedLine.match(/^(---|___|\*\*\*)\s*$/);
            if (hrMatch) {
                flushList();
                elements.push(<hr key={`hr-${index}`} className="border-gray-800 my-6" />);
                return;
            }

            const blockquoteMatch = trimmedLine.match(/^>\s?(.*)/);
            if (blockquoteMatch) {
                flushList();
                const content = blockquoteMatch[1];
                elements.push(
                    <blockquote key={`bq-${index}`} className="border-l-4 border-gray-800 pl-4 italic text-gray-400 my-4">
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
                currentList.items.push(<li key={`li-${index}`} className="leading-7">{parseInlineMarkdown(unorderedMatch[2] || '')}</li>);
            } else if (orderedMatch) {
                if (currentList?.type !== 'ol') {
                    flushList();
                    currentList = { type: 'ol', items: [] };
                }
                currentList.items.push(<li key={`li-${index}`} className="leading-7">{parseInlineMarkdown(orderedMatch[2] || '')}</li>);
            } else {
                flushList();
                elements.push(<p key={`p-${index}`} className="leading-7">{parseInlineMarkdown(trimmedLine)}</p>);
            }
        });

        flushList();
        flushCodeBlock();
        return <div className="space-y-4 text-gray-300">{elements}</div>;
    };

    const sidebarClass = isFullscreen ? 'w-64' : `absolute top-0 left-0 h-full w-64 z-20 transform transition-transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`;
    const isWelcomeState = !activeConversation || (activeConversation.isUnsaved && !activeConversation.context);
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div ref={modalRef} className="bg-invox-dark-accent rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex overflow-hidden border border-gray-800">
                <div className={sidebarClass}>
                    <ChatHistorySidebar />
                </div>

                <div className="flex-1 flex flex-col p-4">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                           {!isFullscreen && (
                                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-gray-400 hover:text-white transition-transform duration-200 transform hover:scale-110 active:scale-100">
                                    <MenuIcon className="w-6 h-6" />
                                </button>
                           )}
                           <h2 className="text-xl font-bold text-white flex items-center truncate">
                                <SparklesIcon useGradient className="w-6 h-6 mr-2 flex-shrink-0" />
                                <span className="truncate">{activeConversation?.context ? `On "${activeConversation.context.title}"` : 'Spark AI'}</span>
                           </h2>
                        </div>
                        <div className="flex items-center gap-4">
                            <button onClick={toggleFullscreen} className="text-gray-400 hover:text-white transition-transform duration-200 transform hover:scale-110 active:scale-100">
                                {isFullscreen ? <ArrowsPointingInIcon className="w-6 h-6" /> : <ArrowsPointingOutIcon className="w-6 h-6" />}
                            </button>
                            <button onClick={onClose} className="text-gray-400 hover:text-white transition-transform duration-200 transform hover:scale-110 active:scale-100">
                                <CloseIcon />
                            </button>
                        </div>
                    </div>
                    <hr className="border-gray-800 my-4" />
                    <div className="flex-grow overflow-y-auto pr-2">
                        <div className={isFullscreen ? "max-w-5xl mx-auto" : ""}>
                           {isWelcomeState ? (
                                <div className="flex flex-col items-center justify-center h-full text-center p-4">
                                    <SparklesIcon useGradient className="w-20 h-20 mb-6" />
                                    <h2 className="text-4xl font-bold text-gray-200">
                                        Hello, {currentUser?.displayName?.split(' ')[0] || 'Explorer'}
                                    </h2>
                                    <p className="text-xl text-gray-500 mt-2">How can I help you today?</p>
                                    
                                    <div className={`grid grid-cols-1 sm:grid-cols-2 mt-12 w-full ${isFullscreen ? 'gap-6 max-w-4xl' : 'gap-4 max-w-2xl'}`}>
                                        {initialSuggestions.map((s, index) => (
                                            <button
                                                key={s.text}
                                                onClick={() => handleSend(s.text)}
                                                className="relative animated-gradient-border bg-invox-dark p-4 rounded-xl text-left transition-all duration-300 group flex items-center gap-4 opacity-0 animate-fadeInUp hover:-translate-y-1"
                                                style={{ animationDelay: `${index * 100}ms` }}
                                            >
                                                <div className="bg-gray-800 p-3 rounded-full transition-colors duration-300 group-hover:bg-gradient-to-br group-hover:from-invox-red/20 group-hover:to-invox-blue/20">
                                                    <s.icon className="w-5 h-5 text-gray-300 transition-colors duration-300 group-hover:text-white" />
                                                </div>
                                                <p className="text-sm font-medium text-gray-300 flex-1 transition-colors duration-300 group-hover:bg-gradient-to-r group-hover:from-invox-red group-hover:to-invox-blue group-hover:text-transparent group-hover:bg-clip-text">{s.text}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                           ) : (
                            <div className="space-y-4">
                                {activeConversation?.messages.map((msg, index) => {
                                    const isLastMessage = index === activeConversation.messages.length - 1;
                                    const isStreamingMessage = (isLoading || isAnimating) && isLastMessage;

                                    return (
                                        <div key={index} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                            <div className={`p-3 rounded-lg ${msg.role === 'user' ? 'bg-gray-800 text-white' : 'bg-[#262626] text-white'} ${(msg.role === 'model' && isFullscreen) ? 'max-w-3xl' : 'max-w-md'}`}>
                                                {msg.role === 'user' ? (
                                                    <p>{msg.parts[0].text}</p>
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
                                                            <span className="inline-block w-2 h-5 bg-white animate-pulse ml-1 translate-y-1"></span>
                                                        )}
                                                         {msg.sources && msg.sources.length > 0 && (
                                                            <div className="mt-4 pt-3 border-t border-gray-800/50">
                                                                <h4 className="font-semibold text-sm text-gray-400 mb-2">Sources</h4>
                                                                <ol className="text-sm space-y-2">
                                                                    {msg.sources.map((source, idx) => (
                                                                        source && (
                                                                            <li key={source.uri || idx} className="flex items-start gap-2 animate-fadeInUp" style={{ animationDelay: `${idx * 50}ms`, opacity: 0 }}>
                                                                                <span className="text-gray-500 font-medium">{idx + 1}.</span>
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
                    
                    <div className="mt-4 relative">
                        {suggestions.length > 0 && (
                            <div className="absolute bottom-full left-0 right-0 mb-2 bg-invox-dark p-2 rounded-lg border border-gray-800 space-y-1">
                                {suggestions.map(s => (
                                    <button 
                                        key={s} 
                                        onClick={() => handleSuggestionClick(s)}
                                        className="w-full text-left text-sm p-2 rounded hover:bg-gray-700 text-gray-300"
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        )}
                        <div className={`flex items-end bg-invox-dark border border-gray-800 rounded-xl transition-all duration-300 focus-within:ring-2 focus-within:ring-gray-800 focus-within:border-transparent ${isFullscreen ? 'py-4 px-3' : 'p-1.5'}`}>
                            <textarea
                                ref={textareaRef}
                                rows={1}
                                value={input}
                                onChange={(e) => {
                                    setInput(e.target.value)
                                    if (recognitionError) setRecognitionError(null);
                                }}
                                onKeyDown={handleKeyDown}
                                placeholder={isListening ? "Listening..." : "Ask me anything... (Shift+Enter for new line)"}
                                className="flex-grow bg-transparent p-2 text-white placeholder-gray-500 focus:outline-none resize-none overflow-y-auto max-h-52"
                                disabled={isLoading}
                            />
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => setUseSearch(prev => !prev)}
                                    disabled={isLoading}
                                    className={`p-2 text-gray-400 rounded-lg transition-colors duration-200 hover:bg-invox-dark-accent hover:text-white focus:outline-none focus:ring-2 focus:ring-gray-800 ${useSearch ? 'text-white bg-gray-800' : ''}`}
                                    aria-label={useSearch ? 'Web search enabled' : 'Web search disabled'}
                                    title="Web search"
                                >
                                    <GlobeAltIcon className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={handleToggleListening}
                                    disabled={isLoading}
                                    className={`p-2 text-gray-400 rounded-lg transition-colors duration-200 hover:bg-invox-dark-accent hover:text-white focus:outline-none focus:ring-2 focus:ring-gray-800 ${isListening ? 'text-white bg-gray-800' : ''}`}
                                    aria-label={isListening ? 'Stop listening' : 'Start voice input'}
                                >
                                    {isListening ? (
                                        <div className="w-5 h-5 relative flex justify-center items-center">
                                            <div className="absolute w-full h-full bg-invox-red rounded-lg animate-ping opacity-75"></div>
                                            <MicrophoneIcon className="relative w-5 h-5 text-white" />
                                        </div>
                                    ) : (
                                        <MicrophoneIcon className="w-5 h-5" />
                                    )}
                                </button>
                                {isLoading ? (
                                    <button
                                        onClick={handleStop}
                                        className="bg-gray-800 text-white p-2 rounded-lg hover:bg-gray-700 flex items-center justify-center transition-colors duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-gray-800"
                                        aria-label="Stop generating response"
                                    >
                                        <div className="w-5 h-5 relative flex items-center justify-center">
                                            <div className="absolute w-full h-full rounded-full border-2 border-t-white/80 border-r-white/80 border-b-transparent border-l-transparent animate-spin"></div>
                                            <StopIcon className="w-2.5 h-2.5 text-white" />
                                        </div>
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleSend()}
                                        disabled={isListening || !input.trim()}
                                        className="bg-gray-800 text-white p-2 rounded-lg hover:bg-gray-700 disabled:bg-transparent disabled:text-gray-600 disabled:cursor-not-allowed flex items-center justify-center transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-gray-800"
                                    >
                                        <SendIcon className="w-5 h-5"/>
                                    </button>
                                )}
                            </div>
                        </div>
                        {recognitionError && (
                            <p className="text-red-500 text-xs mt-2 text-center animate-fadeInUp">{recognitionError}</p>
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
            className="fixed bottom-8 right-8 bg-gradient-to-br from-invox-red to-invox-blue p-4 rounded-full shadow-lg transform hover:scale-110 active:scale-100 transition-transform duration-200 z-40"
            aria-label="Open AI Assistant"
        >
            <SparklesIcon className="w-8 h-8 text-white" />
        </button>
    );
};