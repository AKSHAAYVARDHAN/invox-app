import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
    subscribeCommunityPrivateMessages, 
    sendCommunityPrivateMessage,
    CommunityPrivateMessage,
    CommunityPrivateAttachment,
    JoinedCommunityRecord 
} from '../../services/communityService';
import { uploadFile, getStoragePath } from '../../services/storageService';
import { 
    ArrowLeftIcon,
    SendIcon, 
    ShieldCheckIcon, 
    UsersIcon, 
    LockClosedIcon,
    ChatBubbleBottomCenterTextIcon,
    ClockIcon,
    AlertTriangleIcon,
    CheckIcon,
    GlobeAltIcon,
    ArrowUpRightIcon,
    PaperClipIcon,
    MicrophoneIcon,
    PhotoIcon,
    VideoCameraIcon,
    DocumentTextIcon,
    PauseIcon,
    PlayIcon,
    TrashIcon,
    CloseIcon,
    SoundWaveIcon,
    SparklesIcon,
    MagnifyingGlassIcon,
    EllipsisVerticalIcon
} from '../ui/Icons';
import { handleImageError } from '../utils/imageUtils';
import { ConversationSummaryModal, SummaryMessageItem } from '../spotlight/ConversationSummaryModal';
import { ConversationSearchBar } from '../spotlight/ConversationSearchBar';
import { ClickableMessageText } from '../ui/ClickableMessageText';

interface PrivateCommunityInboxViewProps {
    communityRecord: JoinedCommunityRecord;
    onBack: () => void;
    onOpenCommunityProfile?: (communityId: string) => void;
}

interface StagedAttachment {
    id: string;
    file: File;
    name: string;
    size: number;
    type: 'image' | 'video' | 'document';
    previewUrl: string;
}

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB limit

const formatFileSize = (bytes?: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const formatSeconds = (sec: number): string => {
    const mins = Math.floor(sec / 60);
    const remainder = Math.floor(sec % 60);
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
};

const formatMessageTime = (date: Date): string => {
    try {
        return new Intl.DateTimeFormat('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        }).format(date);
    } catch {
        return '';
    }
};

const formatMessageDateGroup = (date: Date): string => {
    try {
        const now = new Date();
        const isToday = now.toDateString() === date.toDateString();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const isYesterday = yesterday.toDateString() === date.toDateString();

        if (isToday) return '// TODAY';
        if (isYesterday) return '// YESTERDAY';

        return `// ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}`;
    } catch {
        return '// TRANSMISSION LOG';
    }
};

/**
 * Audio player bubble for voice transmissions in conversation history
 */
const VoiceMessageBubble: React.FC<{
    voiceUrl: string;
    duration?: number;
    isCurrentUser: boolean;
}> = ({ voiceUrl, duration = 0, isCurrentUser }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [audioDuration, setAudioDuration] = useState(duration);
    const audioRef = useRef<HTMLAudioElement>(null);

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            audioRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
        }
    };

    return (
        <div className="flex items-center gap-2.5 p-2 bg-black/80 border border-zinc-800 my-1 font-mono max-w-sm">
            <audio
                ref={audioRef}
                src={voiceUrl}
                preload="metadata"
                onLoadedMetadata={(e) => {
                    const dur = e.currentTarget.duration;
                    if (dur && !isNaN(dur) && isFinite(dur)) {
                        setAudioDuration(dur);
                    }
                }}
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                onEnded={() => {
                    setIsPlaying(false);
                    setCurrentTime(0);
                }}
            />
            <button
                type="button"
                onClick={togglePlay}
                className="w-8 h-8 rounded-none bg-white text-black hover:bg-zinc-200 flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                title={isPlaying ? 'Pause' : 'Play'}
            >
                {isPlaying ? <PauseIcon className="w-3.5 h-3.5" /> : <PlayIcon className="w-3.5 h-3.5 translate-x-0.5" />}
            </button>

            <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between text-[10px] text-zinc-400">
                    <span className="flex items-center gap-1 text-zinc-300">
                        <SoundWaveIcon className={`w-3 h-3 ${isPlaying ? 'text-white animate-pulse' : 'text-zinc-500'}`} />
                        <span>VOICE TRANSMISSION</span>
                    </span>
                    <span>{formatSeconds(isPlaying ? currentTime : audioDuration)}</span>
                </div>
                {/* Clickable Progress Bar */}
                <div 
                    className="h-1.5 bg-zinc-800 cursor-pointer overflow-hidden relative"
                    onClick={(e) => {
                        if (!audioRef.current || !audioDuration) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickX = e.clientX - rect.left;
                        const pct = Math.max(0, Math.min(1, clickX / rect.width));
                        audioRef.current.currentTime = pct * audioDuration;
                        setCurrentTime(pct * audioDuration);
                    }}
                >
                    <div 
                        className="h-full bg-white transition-all duration-100"
                        style={{ width: `${audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0}%` }}
                    />
                </div>
            </div>
        </div>
    );
};

export const PrivateCommunityInboxView: React.FC<PrivateCommunityInboxViewProps> = ({
    communityRecord,
    onBack,
    onOpenCommunityProfile,
}) => {
    const { currentUser, userProfile } = useAuth();
    const [messages, setMessages] = useState<CommunityPrivateMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const [sendError, setSendError] = useState<string | null>(null);

    // Media Attachments State
    const [stagedAttachments, setStagedAttachments] = useState<StagedAttachment[]>([]);
    const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);

    // Voice Message Recording State
    const [isRecording, setIsRecording] = useState(false);
    const [isRecordingPaused, setIsRecordingPaused] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
    const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
    const [recordedAudioDuration, setRecordedAudioDuration] = useState(0);
    const [isPlayingRecordedPreview, setIsPlayingRecordedPreview] = useState(false);

    // AI Summary Modal State
    const [showSummaryModal, setShowSummaryModal] = useState(false);

    // In-Chat Search State
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [chatSearchQuery, setChatSearchQuery] = useState('');
    const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

    // Context / Overflow Menu State
    const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
    const contextMenuRef = useRef<HTMLDivElement>(null);

    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const attachmentMenuRef = useRef<HTMLDivElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const docInputRef = useRef<HTMLInputElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const recordingTimerRef = useRef<any>(null);
    const durationCounterRef = useRef<number>(0);
    const previewAudioRef = useRef<HTMLAudioElement>(null);

    const { community, role, isOwner, isAdmin } = communityRecord;
    const communityId = communityRecord.id || community.id;

    // 1. Subscribe to isolated real-time private messages for this specific community
    useEffect(() => {
        if (!communityId) {
            setMessages([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setSendError(null);

        const unsubscribe = subscribeCommunityPrivateMessages(
            communityId,
            (list) => {
                setMessages(list);
                setLoading(false);
            },
            (err) => {
                console.warn('[COMMUNITY_INBOX_ERR]', err);
                setSendError('Unable to synchronize real-time transmissions. Reconnecting...');
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [communityId]);

    // 2. Auto-scroll to bottom of conversation on message updates
    const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
        messagesEndRef.current?.scrollIntoView({ behavior });
    };

    useEffect(() => {
        scrollToBottom('smooth');
    }, [messages.length]);

    // Initial scroll on load
    useEffect(() => {
        if (!loading) {
            scrollToBottom('auto');
        }
    }, [loading]);

    // Close attachment menu and overflow menu on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (attachmentMenuRef.current && !attachmentMenuRef.current.contains(e.target as Node)) {
                setIsAttachmentMenuOpen(false);
            }
            if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
                setIsContextMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Cleanup recording resources on unmount
    useEffect(() => {
        return () => {
            if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
            }
            if (recordedAudioUrl) {
                URL.revokeObjectURL(recordedAudioUrl);
            }
            stagedAttachments.forEach((att) => {
                if (att.previewUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(att.previewUrl);
                }
            });
        };
    }, []);

    // Helper: File Upload with Resilient Fallback
    const uploadFileWithFallback = async (file: File, folder: string): Promise<string> => {
        try {
            const path = getStoragePath(folder, currentUser?.uid || 'user', file.name);
            const result = await uploadFile(path, file);
            return result.url;
        } catch (storageErr) {
            console.warn('[STORAGE_FALLBACK] Live storage unreachable, encoding payload data URL:', storageErr);
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }
    };

    // 3. Message sending handler with media attachment and voice note dispatch
    const handleSendMessage = async () => {
        const hasText = Boolean(text.trim());
        const hasAttachments = stagedAttachments.length > 0;
        const hasVoice = Boolean(recordedAudioBlob);

        if ((!hasText && !hasAttachments && !hasVoice) || !currentUser?.uid || sending) return;

        const payloadText = text.trim();
        setSending(true);
        setSendError(null);

        try {
            // Upload attachments if present
            const uploadedAttachments: CommunityPrivateAttachment[] = [];
            for (const item of stagedAttachments) {
                const url = await uploadFileWithFallback(item.file, 'communityChat');
                uploadedAttachments.push({
                    id: item.id,
                    name: item.name,
                    size: item.size,
                    type: item.type,
                    mimeType: item.file.type,
                    url,
                });
            }

            // Upload voice note if present
            let voicePayload: { url: string; duration: number } | null = null;
            if (recordedAudioBlob) {
                const audioFile = new File(
                    [recordedAudioBlob], 
                    `voice_${Date.now()}.${recordedAudioBlob.type.includes('mp4') ? 'mp4' : 'webm'}`, 
                    { type: recordedAudioBlob.type || 'audio/webm' }
                );
                const voiceUrl = await uploadFileWithFallback(audioFile, 'communityVoice');
                voicePayload = {
                    url: voiceUrl,
                    duration: recordedAudioDuration,
                };
            }

            const res = await sendCommunityPrivateMessage(
                communityId,
                {
                    uid: currentUser.uid,
                    displayName: userProfile?.displayName || currentUser.displayName || 'Member',
                    photoURL: userProfile?.photoURL || currentUser.photoURL || null,
                },
                payloadText,
                {
                    attachments: uploadedAttachments,
                    voiceMessage: voicePayload,
                }
            );

            if (res.success) {
                // Clear text
                setText('');
                if (textareaRef.current) {
                    textareaRef.current.style.height = 'auto';
                }
                // Clear attachments
                stagedAttachments.forEach((att) => {
                    if (att.previewUrl.startsWith('blob:')) URL.revokeObjectURL(att.previewUrl);
                });
                setStagedAttachments([]);
                // Clear voice recording
                if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
                setRecordedAudioBlob(null);
                setRecordedAudioUrl(null);
                setRecordedAudioDuration(0);
                setIsPlayingRecordedPreview(false);
            } else {
                setSendError(res.error || 'Failed to dispatch transmission. Draft preserved.');
            }
        } catch (err: any) {
            console.error('[SEND_MSG_ERR]', err);
            setSendError(err?.message || 'Transmission failed. Your draft has been preserved.');
        } finally {
            setSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setText(e.target.value);
        if (sendError) setSendError(null);

        // Auto-resize textarea height up to 120px
        const el = e.target;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    };

    // File selection handling
    const handleFilesSelected = (files: FileList | null, type: 'image' | 'video' | 'document') => {
        if (!files || files.length === 0) return;
        setIsAttachmentMenuOpen(false);

        const newStaged: StagedAttachment[] = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.size > MAX_FILE_SIZE) {
                setSendError(`File "${file.name}" exceeds the 25MB transmission limit.`);
                continue;
            }
            const previewUrl = URL.createObjectURL(file);
            newStaged.push({
                id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                file,
                name: file.name,
                size: file.size,
                type,
                previewUrl,
            });
        }

        if (newStaged.length > 0) {
            setStagedAttachments((prev) => [...prev, ...newStaged]);
            if (sendError) setSendError(null);
        }
    };

    const removeAttachment = (id: string) => {
        setStagedAttachments((prev) => {
            const match = prev.find((item) => item.id === id);
            if (match && match.previewUrl.startsWith('blob:')) {
                URL.revokeObjectURL(match.previewUrl);
            }
            return prev.filter((item) => item.id !== id);
        });
    };

    // Voice Message Recording Logic
    const startRecording = async () => {
        setSendError(null);
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                setSendError('Voice recording is not supported in this browser.');
                return;
            }

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : (MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '');
            
            const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
            const chunks: Blob[] = [];

            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    chunks.push(e.data);
                }
            };

            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
                const url = URL.createObjectURL(blob);
                setRecordedAudioBlob(blob);
                setRecordedAudioUrl(url);
                setRecordedAudioDuration(durationCounterRef.current);
                if (streamRef.current) {
                    streamRef.current.getTracks().forEach((track) => track.stop());
                }
            };

            recorder.start(250);
            mediaRecorderRef.current = recorder;
            setIsRecording(true);
            setIsRecordingPaused(false);
            setRecordingDuration(0);
            durationCounterRef.current = 0;

            if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = setInterval(() => {
                durationCounterRef.current += 1;
                setRecordingDuration(durationCounterRef.current);
            }, 1000);
        } catch (err: any) {
            console.error('[VOICE_RECORD_ERROR]', err);
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                setSendError('Microphone permission was denied. Please allow microphone permissions in your browser.');
            } else {
                setSendError('Unable to access microphone: ' + (err.message || 'Unknown error'));
            }
        }
    };

    const pauseRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.pause();
            setIsRecordingPaused(true);
            if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        }
    };

    const resumeRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
            mediaRecorderRef.current.resume();
            setIsRecordingPaused(false);
            recordingTimerRef.current = setInterval(() => {
                durationCounterRef.current += 1;
                setRecordingDuration(durationCounterRef.current);
            }, 1000);
        }
    };

    const stopRecording = () => {
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
        setIsRecordingPaused(false);
    };

    const cancelRecording = () => {
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
        }
        setIsRecording(false);
        setIsRecordingPaused(false);
        setRecordingDuration(0);
        durationCounterRef.current = 0;
        setRecordedAudioBlob(null);
        if (recordedAudioUrl) {
            URL.revokeObjectURL(recordedAudioUrl);
            setRecordedAudioUrl(null);
        }
    };

    const toggleRecordedAudioPreview = () => {
        if (!previewAudioRef.current) return;
        if (isPlayingRecordedPreview) {
            previewAudioRef.current.pause();
            setIsPlayingRecordedPreview(false);
        } else {
            previewAudioRef.current.play().then(() => setIsPlayingRecordedPreview(true)).catch(console.error);
        }
    };

    const discardRecordedAudio = () => {
        if (previewAudioRef.current) {
            previewAudioRef.current.pause();
        }
        if (recordedAudioUrl) {
            URL.revokeObjectURL(recordedAudioUrl);
        }
        setRecordedAudioBlob(null);
        setRecordedAudioUrl(null);
        setRecordedAudioDuration(0);
        setIsPlayingRecordedPreview(false);
    };

    // 4. Group messages chronologically by date
    const groupedMessages = useMemo(() => {
        const groups: { dateKey: string; dateLabel: string; items: CommunityPrivateMessage[] }[] = [];

        for (const msg of messages) {
            const dateObj = msg.createdAt instanceof Date ? msg.createdAt : new Date(msg.createdAt);
            const dateKey = dateObj.toDateString();
            let group = groups.find((g) => g.dateKey === dateKey);
            if (!group) {
                group = {
                    dateKey,
                    dateLabel: formatMessageDateGroup(dateObj),
                    items: [],
                };
                groups.push(group);
            }
            group.items.push(msg);
        }

        return groups;
    }, [messages]);

    // 5. Format messages for AI Summary Service
    const summaryMessages: SummaryMessageItem[] = useMemo(() => {
        return messages.map((m) => {
            let msgText = m.content || '';
            if (m.attachments && m.attachments.length > 0) {
                const attList = m.attachments.map((a) => a.name).join(', ');
                msgText = msgText ? `${msgText} [Attachment: ${attList}]` : `[Attachment: ${attList}]`;
            }
            if (m.voiceMessage) {
                msgText = msgText ? `${msgText} [Voice transmission]` : '[Voice transmission]';
            }
            return {
                id: m.id,
                senderId: m.authorId,
                senderName: m.authorName,
                text: msgText,
                createdAt: m.createdAt,
            };
        });
    }, [messages]);

    // 6. In-chat search matching messages
    const matchingMessages = useMemo(() => {
        if (!isSearchOpen || !chatSearchQuery.trim()) return [];
        const q = chatSearchQuery.toLowerCase().trim();
        return messages.filter((m) => {
            const textMatch = typeof m.content === 'string' && m.content.toLowerCase().includes(q);
            const authorMatch = typeof m.authorName === 'string' && m.authorName.toLowerCase().includes(q);
            const attachmentMatch = m.attachments?.some((att) => att.name?.toLowerCase().includes(q));
            return textMatch || authorMatch || attachmentMatch;
        });
    }, [messages, isSearchOpen, chatSearchQuery]);

    const activeMatchedMessageId = matchingMessages[currentMatchIndex]?.id || null;

    const scrollToMessage = (msgId: string) => {
        const el = document.getElementById(`community-msg-${msgId}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };

    // Auto-scroll to first match when search query changes
    useEffect(() => {
        if (matchingMessages.length > 0 && matchingMessages[0]) {
            setCurrentMatchIndex(0);
            scrollToMessage(matchingMessages[0].id);
        } else {
            setCurrentMatchIndex(0);
        }
    }, [chatSearchQuery]);

    const handleNextMatch = () => {
        if (matchingMessages.length === 0) return;
        const nextIndex = (currentMatchIndex + 1) % matchingMessages.length;
        setCurrentMatchIndex(nextIndex);
        scrollToMessage(matchingMessages[nextIndex].id);
    };

    const handlePrevMatch = () => {
        if (matchingMessages.length === 0) return;
        const prevIndex = (currentMatchIndex - 1 + matchingMessages.length) % matchingMessages.length;
        setCurrentMatchIndex(prevIndex);
        scrollToMessage(matchingMessages[prevIndex].id);
    };

    const handleCloseSearch = () => {
        setIsSearchOpen(false);
        setChatSearchQuery('');
        setCurrentMatchIndex(0);
    };

    return (
        <div className="w-full flex-1 flex flex-col min-h-0 font-mono select-text">
            {/* Hidden File Inputs for Device Picker */}
            <input
                type="file"
                ref={imageInputRef}
                onChange={(e) => handleFilesSelected(e.target.files, 'image')}
                accept="image/*"
                multiple
                className="hidden"
            />
            <input
                type="file"
                ref={videoInputRef}
                onChange={(e) => handleFilesSelected(e.target.files, 'video')}
                accept="video/*"
                multiple
                className="hidden"
            />
            <input
                type="file"
                ref={docInputRef}
                onChange={(e) => handleFilesSelected(e.target.files, 'document')}
                accept=".pdf,.doc,.docx,.txt,.csv,.xlsx,.xls,.ppt,.pptx,.zip"
                multiple
                className="hidden"
            />

            {/* Hidden Audio Element for Recorded Voice Preview */}
            {recordedAudioUrl && (
                <audio
                    ref={previewAudioRef}
                    src={recordedAudioUrl}
                    onEnded={() => setIsPlayingRecordedPreview(false)}
                />
            )}

            {/* Back to Feed Navigation Bar */}
            <div className="flex items-center justify-between gap-4 mb-2.5 shrink-0">
                <button
                    type="button"
                    onClick={onBack}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#0c0c0e] border border-zinc-800 hover:border-zinc-600 text-zinc-300 hover:text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer group"
                >
                    <ArrowLeftIcon className="w-4 h-4 text-zinc-400 group-hover:text-white group-hover:-translate-x-0.5 transition-transform" />
                    <span>// BACK TO FEED</span>
                </button>

                <div className="flex items-center gap-2 text-[10px] text-zinc-500 uppercase tracking-widest hidden sm:flex">
                    <span className="w-1.5 h-1.5 bg-zinc-400 inline-block"></span>
                    <span>INTRA-COMMUNITY ENCLAVE</span>
                </div>
            </div>

            {/* 1. Main Unified Conversation Card (Expands to fill available middle-column vertical space) */}
            <div className="w-full flex-1 min-h-0 flex flex-col bg-[#0c0c0e] border border-zinc-800 shadow-2xl relative overflow-hidden h-[calc(100vh-130px)] md:h-[calc(100vh-92px)]">
                
                {/* 2. Conversation Header Section */}
                <div className="shrink-0 p-4 sm:p-4.5 bg-[#0e0f12] border-b border-zinc-800 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                        <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                            {/* Community Avatar */}
                            <div className="w-11 h-11 shrink-0 bg-black border border-zinc-700 overflow-hidden flex items-center justify-center">
                                {community.avatarUrl ? (
                                    <img
                                        src={community.avatarUrl}
                                        alt={community.name}
                                        onError={handleImageError}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <UsersIcon className="w-5 h-5 text-zinc-500" />
                                )}
                            </div>

                            {/* Community Title & Role Metadata */}
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2.5 flex-wrap">
                                    <h1 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider truncate">
                                        {community.name}
                                    </h1>
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold uppercase bg-zinc-900 border border-zinc-700 text-zinc-200">
                                        <LockClosedIcon className="w-3 h-3 text-zinc-300" />
                                        <span>PRIVATE INBOX</span>
                                    </span>
                                </div>

                                <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-400 flex-wrap">
                                    {community.category && (
                                        <>
                                            <span className="text-zinc-400 uppercase font-bold">{community.category}</span>
                                            <span className="text-zinc-600">•</span>
                                        </>
                                    )}
                                    <span className="flex items-center gap-1.5">
                                        <span className="text-zinc-500 uppercase">YOUR ROLE:</span>
                                        <span
                                            className={`px-1.5 py-0.2 text-[10px] font-bold uppercase tracking-wider ${
                                                isOwner
                                                    ? 'text-amber-400 bg-amber-950/40 border border-amber-500/30'
                                                    : isAdmin
                                                    ? 'text-indigo-400 bg-indigo-950/40 border border-indigo-500/30'
                                                    : 'text-zinc-300 bg-zinc-900 border border-zinc-700'
                                            }`}
                                        >
                                            {role.toUpperCase()}
                                        </span>
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Conversation Header Actions / Toolbar */}
                        <div className="flex items-center gap-2 shrink-0">
                            {/* AI Summary Button */}
                            <button
                                type="button"
                                onClick={() => setShowSummaryModal(true)}
                                className="px-2.5 sm:px-3 py-1.5 bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer group"
                                title="Generate AI Conversation Summary"
                            >
                                <SparklesIcon className="w-3.5 h-3.5 text-zinc-300 group-hover:text-white transition-colors" />
                                <span className="hidden sm:inline">// AI SUMMARY</span>
                                <span className="sm:hidden">SUMMARY</span>
                            </button>

                            {/* In-chat Search Toggle Button */}
                            <button
                                type="button"
                                onClick={() => {
                                    if (isSearchOpen) {
                                        handleCloseSearch();
                                    } else {
                                        setIsSearchOpen(true);
                                    }
                                }}
                                className={`p-1.5 sm:px-2.5 sm:py-1.5 border text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer ${
                                    isSearchOpen
                                        ? 'bg-zinc-800 border-zinc-500 text-white'
                                        : 'bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white'
                                }`}
                                title="Search through chat"
                            >
                                <MagnifyingGlassIcon className="w-3.5 h-3.5" />
                                <span className="hidden md:inline">SEARCH</span>
                            </button>

                            {/* Contextual Overflow Menu */}
                            <div className="relative" ref={contextMenuRef}>
                                <button
                                    type="button"
                                    onClick={() => setIsContextMenuOpen(!isContextMenuOpen)}
                                    className={`p-1.5 border text-xs transition-colors cursor-pointer ${
                                        isContextMenuOpen
                                            ? 'bg-zinc-800 border-zinc-500 text-white'
                                            : 'bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white'
                                    }`}
                                    title="Conversation Options"
                                >
                                    <EllipsisVerticalIcon className="w-4 h-4" />
                                </button>

                                {isContextMenuOpen && (
                                    <div className="absolute right-0 top-full mt-1.5 w-52 bg-[#0c0c0e] border border-zinc-700 shadow-2xl py-1 z-30 font-mono text-xs">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsContextMenuOpen(false);
                                                setShowSummaryModal(true);
                                            }}
                                            className="w-full px-3 py-2 text-left text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2 cursor-pointer"
                                        >
                                            <SparklesIcon className="w-3.5 h-3.5 text-zinc-400" />
                                            <span>GENERATE SUMMARY</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsContextMenuOpen(false);
                                                setIsSearchOpen(true);
                                            }}
                                            className="w-full px-3 py-2 text-left text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2 cursor-pointer"
                                        >
                                            <MagnifyingGlassIcon className="w-3.5 h-3.5 text-zinc-400" />
                                            <span>SEARCH MESSAGES</span>
                                        </button>
                                        {onOpenCommunityProfile && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsContextMenuOpen(false);
                                                    onOpenCommunityProfile(communityId);
                                                }}
                                                className="w-full px-3 py-2 text-left text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2 cursor-pointer"
                                            >
                                                <GlobeAltIcon className="w-3.5 h-3.5 text-zinc-400" />
                                                <span>COMMUNITY PROFILE</span>
                                            </button>
                                        )}
                                        <div className="border-t border-zinc-800 my-1"></div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsContextMenuOpen(false);
                                                scrollToBottom();
                                            }}
                                            className="w-full px-3 py-2 text-left text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 flex items-center gap-2 cursor-pointer text-[11px]"
                                        >
                                            <ClockIcon className="w-3 h-3 text-zinc-500" />
                                            <span>SCROLL TO LATEST</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Access Status Information */}
                    <div className="flex items-center justify-between text-[11px] px-3 py-1.5 bg-black/60 border border-zinc-800 text-zinc-400">
                        <div className="flex items-center gap-2">
                            <ShieldCheckIcon className="w-3.5 h-3.5 text-zinc-300" />
                            <span>ISOLATED INTRA-COMMUNITY ENCLAVE · RESTRICTED TO ACTIVE MEMBERS</span>
                        </div>
                        <span className="text-zinc-500 hidden md:inline">256-BIT SYNC</span>
                    </div>
                </div>

                {/* In-chat Search Bar (Mounted below header) */}
                <ConversationSearchBar
                    isOpen={isSearchOpen}
                    searchQuery={chatSearchQuery}
                    onQueryChange={setChatSearchQuery}
                    onClose={handleCloseSearch}
                    totalMatches={matchingMessages.length}
                    currentMatchIndex={currentMatchIndex}
                    onPrevMatch={handlePrevMatch}
                    onNextMatch={handleNextMatch}
                    placeholder="Search transmissions in this community inbox..."
                />

                {/* Error Banner if transmission fails */}
                {sendError && (
                    <div className="px-4 py-2 bg-rose-950/70 border-b border-rose-800 text-rose-300 text-xs flex items-center justify-between gap-2 shrink-0 font-mono">
                        <div className="flex items-center gap-2">
                            <AlertTriangleIcon className="w-4 h-4 text-rose-400 shrink-0" />
                            <span>{sendError}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSendError(null)}
                            className="text-rose-400 hover:text-white text-[10px] uppercase font-bold cursor-pointer"
                        >
                            DISMISS
                        </button>
                    </div>
                )}

                {/* 3. Message History Content Area (Independently Scrollable) */}
                <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4 bg-[#09090b]">
                    {loading ? (
                        /* Skeleton / Loading indicator */
                        <div className="space-y-4 py-8">
                            <div className="flex items-center justify-center gap-2 text-zinc-500 text-xs">
                                <span className="w-3.5 h-3.5 border-2 border-zinc-500 border-t-transparent animate-spin"></span>
                                <span>SYNCHRONIZING SECURE MESSAGES...</span>
                            </div>
                            {[...Array(3)].map((_, i) => (
                                <div
                                    key={i}
                                    className={`flex items-start gap-3 ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}
                                >
                                    <div className="w-8 h-8 bg-zinc-900 border border-zinc-800 animate-pulse"></div>
                                    <div className="w-64 h-16 bg-zinc-900/60 border border-zinc-800/60 animate-pulse"></div>
                                </div>
                            ))}
                        </div>
                    ) : messages.length === 0 ? (
                        /* Empty State */
                        <div className="flex flex-col items-center justify-center h-full min-h-[260px] text-center p-6 border border-dashed border-zinc-800 bg-zinc-950/40 my-auto">
                            <div className="w-12 h-12 bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-3">
                                <ChatBubbleBottomCenterTextIcon className="w-6 h-6 text-zinc-500" />
                            </div>
                            <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider mb-1">
                                // NO TRANSMISSIONS LOGGED
                            </h3>
                            <p className="text-xs text-zinc-500 max-w-sm mb-4 leading-relaxed font-sans">
                                This private inbox is dedicated exclusively to members of {community.name}. Initiate a transmission below to collaborate with community peers.
                            </p>
                            <div className="flex flex-wrap items-center justify-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setText('Greetings team. Let us coordinate the next community sprint.')}
                                    className="px-2.5 py-1 text-[11px] bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                                >
                                    "Coordinate Sprint"
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setText('Reviewing community updates and proposals.')}
                                    className="px-2.5 py-1 text-[11px] bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                                >
                                    "Review Proposals"
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Chronological Messages Stream */
                        groupedMessages.map((group) => (
                            <div key={group.dateKey} className="space-y-3.5">
                                {/* Date Separator */}
                                <div className="flex items-center gap-3 py-1">
                                    <div className="flex-1 border-t border-zinc-800"></div>
                                    <span className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase bg-[#0c0c0e] px-2.5 py-0.5 border border-zinc-800">
                                        {group.dateLabel}
                                    </span>
                                    <div className="flex-1 border-t border-zinc-800"></div>
                                </div>

                                {/* Message Items in Group */}
                                <div className="space-y-3">
                                    {group.items.map((msg) => {
                                        const isCurrentUser = msg.authorId === currentUser?.uid;
                                        const timeStr = formatMessageTime(
                                            msg.createdAt instanceof Date ? msg.createdAt : new Date(msg.createdAt)
                                        );

                                        const isMatched = matchingMessages.some((m) => m.id === msg.id);
                                        const isActiveMatch = msg.id === activeMatchedMessageId;

                                        return (
                                            <div
                                                key={msg.id}
                                                id={`community-msg-${msg.id}`}
                                                className={`flex items-start gap-2.5 transition-all duration-200 ${
                                                    isCurrentUser ? 'justify-end' : 'justify-start'
                                                } ${
                                                    isActiveMatch
                                                        ? 'p-1.5 -m-1.5 bg-zinc-800/40 border border-zinc-500/80 shadow-lg'
                                                        : isMatched
                                                        ? 'p-1 -m-1 bg-zinc-900/30 border border-zinc-700/50'
                                                        : ''
                                                }`}
                                            >
                                                {/* Author Avatar (for received messages) */}
                                                {!isCurrentUser && (
                                                    <div className="w-7 h-7 shrink-0 bg-zinc-900 border border-zinc-800 overflow-hidden flex items-center justify-center mt-0.5">
                                                        {msg.authorAvatar ? (
                                                            <img
                                                                src={msg.authorAvatar}
                                                                alt={msg.authorName}
                                                                onError={handleImageError}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        ) : (
                                                            <span className="text-[10px] font-bold text-zinc-400">
                                                                {msg.authorName.slice(0, 2).toUpperCase()}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Message Bubble Container */}
                                                <div
                                                    className={`max-w-[85%] sm:max-w-[75%] p-3 sm:p-3.5 space-y-2 shadow-sm ${
                                                        isActiveMatch
                                                            ? 'ring-1 ring-white/70'
                                                            : ''
                                                    } ${
                                                        isCurrentUser
                                                            ? 'bg-zinc-900 border border-zinc-700 text-zinc-100'
                                                            : 'bg-black/90 border border-zinc-800 text-zinc-200'
                                                    }`}
                                                >
                                                    {/* Message Header (Author & Time) */}
                                                    <div className="flex items-baseline justify-between gap-3 text-[10px]">
                                                        <span
                                                            className={`font-bold uppercase tracking-wider truncate ${
                                                                isCurrentUser ? 'text-white' : 'text-zinc-300'
                                                            }`}
                                                        >
                                                            {isCurrentUser ? `YOU (${role.toUpperCase()})` : msg.authorName}
                                                        </span>
                                                        <span className="text-zinc-500 shrink-0 flex items-center gap-1">
                                                            <ClockIcon className="w-2.5 h-2.5" />
                                                            <span>{timeStr}</span>
                                                        </span>
                                                    </div>

                                                    {/* Message Content */}
                                                    {msg.content && (
                                                        <div className="text-xs leading-relaxed break-words whitespace-pre-wrap font-sans">
                                                            <ClickableMessageText
                                                                text={msg.content}
                                                                searchTerm={isSearchOpen && chatSearchQuery.trim() ? chatSearchQuery.trim() : undefined}
                                                                isSender={isCurrentUser}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* Voice Message Player */}
                                                    {msg.voiceMessage?.url && (
                                                        <VoiceMessageBubble
                                                            voiceUrl={msg.voiceMessage.url}
                                                            duration={msg.voiceMessage.duration}
                                                            isCurrentUser={isCurrentUser}
                                                        />
                                                    )}

                                                    {/* Attachments List */}
                                                    {msg.attachments && msg.attachments.length > 0 && (
                                                        <div className="space-y-2 pt-1 border-t border-zinc-800">
                                                            {msg.attachments.map((att) => {
                                                                if (att.type === 'image') {
                                                                    return (
                                                                        <div key={att.id} className="relative group overflow-hidden border border-zinc-800 bg-black">
                                                                            <img
                                                                                src={att.url}
                                                                                alt={att.name}
                                                                                onError={handleImageError}
                                                                                className="max-h-72 w-full object-contain cursor-pointer bg-zinc-950"
                                                                                onClick={() => window.open(att.url, '_blank')}
                                                                            />
                                                                            <div className="p-1.5 bg-zinc-950 flex items-center justify-between text-[10px] font-mono text-zinc-400 border-t border-zinc-800">
                                                                                <span className="truncate max-w-[200px]">{att.name}</span>
                                                                                {att.size && <span>{formatFileSize(att.size)}</span>}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                }
                                                                if (att.type === 'video') {
                                                                    return (
                                                                        <div key={att.id} className="border border-zinc-800 bg-black overflow-hidden">
                                                                            <video src={att.url} controls className="max-h-60 w-full" />
                                                                            <div className="p-1.5 bg-zinc-950 flex items-center justify-between text-[10px] font-mono text-zinc-400 border-t border-zinc-800">
                                                                                <span className="truncate max-w-[200px]">{att.name}</span>
                                                                                {att.size && <span>{formatFileSize(att.size)}</span>}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                }
                                                                // Document
                                                                return (
                                                                    <a
                                                                        key={att.id}
                                                                        href={att.url}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="flex items-center justify-between gap-3 p-2.5 bg-zinc-950 border border-zinc-800 hover:border-zinc-500 transition-colors text-xs font-mono group"
                                                                    >
                                                                        <div className="flex items-center gap-2 min-w-0">
                                                                            <DocumentTextIcon className="w-4 h-4 text-zinc-400 group-hover:text-white shrink-0" />
                                                                            <div className="min-w-0">
                                                                                <p className="text-zinc-200 group-hover:text-white truncate font-medium">{att.name}</p>
                                                                                {att.size && <p className="text-[10px] text-zinc-500">{formatFileSize(att.size)}</p>}
                                                                            </div>
                                                                        </div>
                                                                        <ArrowUpRightIcon className="w-3.5 h-3.5 text-zinc-500 group-hover:text-white shrink-0" />
                                                                    </a>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Current User Avatar (for sent messages) */}
                                                {isCurrentUser && (
                                                    <div className="w-7 h-7 shrink-0 bg-zinc-900 border border-zinc-700 overflow-hidden flex items-center justify-center mt-0.5">
                                                        {currentUser?.photoURL || userProfile?.photoURL ? (
                                                            <img
                                                                src={(currentUser?.photoURL || userProfile?.photoURL) as string}
                                                                alt="You"
                                                                onError={handleImageError}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        ) : (
                                                            <span className="text-[10px] font-bold text-white">
                                                                {(userProfile?.displayName || currentUser?.displayName || 'ME')
                                                                    .slice(0, 2)
                                                                    .toUpperCase()}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* 4. Message Composer Section (Anchored to Bottom of Card) */}
                <div className="shrink-0 p-3 sm:p-3.5 bg-[#0e0f12] border-t border-zinc-800">
                    {/* Staged Attachments Preview Bar */}
                    {stagedAttachments.length > 0 && (
                        <div className="flex items-center gap-2 overflow-x-auto pb-2.5 mb-2.5 border-b border-zinc-800">
                            {stagedAttachments.map((item) => (
                                <div
                                    key={item.id}
                                    className="relative group shrink-0 flex items-center gap-2 p-1.5 bg-zinc-950 border border-zinc-800 text-xs font-mono max-w-[220px]"
                                >
                                    {item.type === 'image' && (
                                        <img src={item.previewUrl} alt={item.name} className="w-8 h-8 object-cover border border-zinc-800 shrink-0" />
                                    )}
                                    {item.type === 'video' && (
                                        <div className="w-8 h-8 bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
                                            <VideoCameraIcon className="w-4 h-4" />
                                        </div>
                                    )}
                                    {item.type === 'document' && (
                                        <div className="w-8 h-8 bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
                                            <DocumentTextIcon className="w-4 h-4" />
                                        </div>
                                    )}
                                    <div className="min-w-0 pr-4">
                                        <p className="text-[11px] text-zinc-200 truncate font-medium" title={item.name}>
                                            {item.name}
                                        </p>
                                        <p className="text-[9px] text-zinc-500 uppercase">{formatFileSize(item.size)}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeAttachment(item.id)}
                                        className="absolute top-1 right-1 p-0.5 text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 cursor-pointer"
                                        title="Remove attachment"
                                    >
                                        <CloseIcon className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Active Voice Recording Bar */}
                    {isRecording ? (
                        <div className="flex items-center justify-between gap-3 p-2 bg-zinc-950 border border-zinc-700 w-full font-mono text-xs">
                            <div className="flex items-center gap-2.5">
                                <span className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping"></span>
                                <span className="text-zinc-200 font-bold uppercase tracking-wider text-[11px] sm:text-xs">
                                    {isRecordingPaused ? 'RECORDING PAUSED' : 'RECORDING AUDIO'}
                                </span>
                                <span className="text-white bg-zinc-900 px-2 py-0.5 border border-zinc-800 font-bold text-xs">
                                    {formatSeconds(recordingDuration)}
                                </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                                {isRecordingPaused ? (
                                    <button
                                        type="button"
                                        onClick={resumeRecording}
                                        className="px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-zinc-200 hover:text-white text-xs cursor-pointer flex items-center gap-1"
                                        title="Resume Recording"
                                    >
                                        <PlayIcon className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">RESUME</span>
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={pauseRecording}
                                        className="px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-zinc-200 hover:text-white text-xs cursor-pointer flex items-center gap-1"
                                        title="Pause Recording"
                                    >
                                        <PauseIcon className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">PAUSE</span>
                                    </button>
                                )}

                                <button
                                    type="button"
                                    onClick={stopRecording}
                                    className="px-3 py-1.5 bg-white text-black font-bold hover:bg-zinc-200 text-xs cursor-pointer flex items-center gap-1"
                                    title="Finish & Review Recording"
                                >
                                    <CheckIcon className="w-3.5 h-3.5" />
                                    <span>DONE</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={cancelRecording}
                                    className="p-1.5 text-zinc-400 hover:text-rose-400 cursor-pointer"
                                    title="Discard Recording"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ) : recordedAudioBlob ? (
                        /* Recorded Audio Preview Bar */
                        <div className="flex items-center justify-between gap-3 p-2 bg-zinc-950 border border-zinc-700 w-full font-mono text-xs">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <button
                                    type="button"
                                    onClick={toggleRecordedAudioPreview}
                                    className="w-8 h-8 bg-white text-black hover:bg-zinc-200 flex items-center justify-center shrink-0 cursor-pointer"
                                    title={isPlayingRecordedPreview ? 'Pause preview' : 'Play preview'}
                                >
                                    {isPlayingRecordedPreview ? <PauseIcon className="w-3.5 h-3.5" /> : <PlayIcon className="w-3.5 h-3.5 translate-x-0.5" />}
                                </button>
                                <div className="flex items-center gap-2 min-w-0">
                                    <SoundWaveIcon className={`w-3.5 h-3.5 ${isPlayingRecordedPreview ? 'text-white animate-pulse' : 'text-zinc-500'}`} />
                                    <span className="text-zinc-200 font-bold uppercase text-[11px] truncate">
                                        VOICE ADVISORY READY
                                    </span>
                                    <span className="text-zinc-500 text-[10px]">
                                        ({formatSeconds(recordedAudioDuration)})
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    type="button"
                                    onClick={discardRecordedAudio}
                                    className="px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 hover:border-rose-900 text-zinc-400 hover:text-rose-400 text-xs cursor-pointer flex items-center gap-1"
                                    title="Discard voice recording"
                                >
                                    <TrashIcon className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">DISCARD</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSendMessage}
                                    disabled={sending}
                                    className="h-[36px] px-3.5 sm:px-4 bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs uppercase cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                                    title="Send voice transmission"
                                >
                                    {sending ? (
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-3 h-3 border-2 border-black border-t-transparent animate-spin"></span>
                                            <span>SENDING...</span>
                                        </div>
                                    ) : (
                                        <>
                                            <span>TRANSMIT</span>
                                            <SendIcon className="w-3.5 h-3.5" />
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Standard Horizontal Composer Layout: Attachment | Message input | Microphone | Send */
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                handleSendMessage();
                            }}
                            className="flex items-end gap-2.5 sm:gap-3"
                        >
                            {/* 1. Attachment Button with Dropdown Menu */}
                            <div className="relative shrink-0" ref={attachmentMenuRef}>
                                <button
                                    type="button"
                                    onClick={() => setIsAttachmentMenuOpen((prev) => !prev)}
                                    disabled={sending}
                                    className={`h-[40px] w-[40px] border flex items-center justify-center cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none ${
                                        isAttachmentMenuOpen
                                            ? 'bg-zinc-800 border-white text-white'
                                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600 active:bg-zinc-900'
                                    }`}
                                    title="Attach Media or Documents"
                                >
                                    <PaperClipIcon className="w-4 h-4" />
                                </button>

                                {/* Compact Attachment Popover Menu */}
                                {isAttachmentMenuOpen && (
                                    <div className="absolute bottom-full left-0 mb-2 w-52 bg-[#0c0c0e] border border-zinc-700 shadow-2xl py-1 z-30 font-mono text-xs">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsAttachmentMenuOpen(false);
                                                imageInputRef.current?.click();
                                            }}
                                            className="w-full px-3 py-2 text-left text-zinc-300 hover:text-white hover:bg-zinc-850 flex items-center gap-2.5 transition-colors cursor-pointer"
                                        >
                                            <PhotoIcon className="w-4 h-4 text-zinc-400" />
                                            <span>PHOTOS & IMAGES</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsAttachmentMenuOpen(false);
                                                videoInputRef.current?.click();
                                            }}
                                            className="w-full px-3 py-2 text-left text-zinc-300 hover:text-white hover:bg-zinc-850 flex items-center gap-2.5 transition-colors cursor-pointer"
                                        >
                                            <VideoCameraIcon className="w-4 h-4 text-zinc-400" />
                                            <span>VIDEOS</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsAttachmentMenuOpen(false);
                                                docInputRef.current?.click();
                                            }}
                                            className="w-full px-3 py-2 text-left text-zinc-300 hover:text-white hover:bg-zinc-850 flex items-center gap-2.5 transition-colors cursor-pointer"
                                        >
                                            <DocumentTextIcon className="w-4 h-4 text-zinc-400" />
                                            <span>DOCUMENTS</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* 2. Multiline Message Input with Understated Muted Focus Highlight */}
                            <div className="flex-1 relative min-w-0">
                                <textarea
                                    ref={textareaRef}
                                    value={text}
                                    onChange={handleTextChange}
                                    onKeyDown={handleKeyDown}
                                    placeholder={`TRANSMIT PRIVATE ADVISORY TO ${community.name.toUpperCase()}...`}
                                    rows={1}
                                    disabled={sending}
                                    className="w-full min-h-[40px] max-h-[120px] bg-zinc-950 border border-zinc-800 py-2.5 px-3 text-zinc-100 text-xs font-mono placeholder:text-zinc-600 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400/20 transition-colors duration-200 resize-none overflow-y-auto leading-relaxed block"
                                />
                            </div>

                            {/* 3. Microphone Button for Voice Recording */}
                            <button
                                type="button"
                                onClick={startRecording}
                                disabled={sending}
                                className="h-[40px] w-[40px] bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600 active:bg-zinc-900 transition-colors flex items-center justify-center cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:border-zinc-300"
                                title="Record Voice Advisory"
                            >
                                <MicrophoneIcon className="w-4 h-4" />
                            </button>

                            {/* 4. Send Action Button */}
                            <button
                                type="submit"
                                disabled={(!text.trim() && stagedAttachments.length === 0 && !recordedAudioBlob) || sending}
                                className={`h-[40px] px-3.5 sm:px-5 flex items-center justify-center gap-2 text-xs font-bold font-mono uppercase tracking-wider transition-colors shrink-0 focus:outline-none ${
                                    (text.trim() || stagedAttachments.length > 0 || recordedAudioBlob) && !sending
                                        ? 'bg-white hover:bg-zinc-200 active:bg-zinc-300 text-zinc-950 cursor-pointer shadow-sm focus:ring-1 focus:ring-zinc-400'
                                        : 'bg-zinc-900 border border-zinc-800 text-zinc-600 cursor-not-allowed opacity-75'
                                }`}
                                title="Send transmission (Enter)"
                            >
                                {sending ? (
                                    <div className="flex items-center gap-1.5 sm:gap-2">
                                        <span className="w-3.5 h-3.5 border-2 border-zinc-950 border-t-transparent animate-spin"></span>
                                        <span className="hidden sm:inline">TRANSMITTING...</span>
                                    </div>
                                ) : (
                                    <>
                                        <span className="hidden sm:inline">TRANSMIT</span>
                                        <SendIcon className="w-3.5 h-3.5" />
                                    </>
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </div>

            {/* AI Summary Modal */}
            <ConversationSummaryModal
                isOpen={showSummaryModal}
                onClose={() => setShowSummaryModal(false)}
                conversationId={communityId}
                conversationTitle={community.name}
                conversationType="community"
                messages={summaryMessages}
                currentUser={currentUser}
            />
        </div>
    );
};

export default PrivateCommunityInboxView;
