


import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import type { Content } from "@google/genai";

export interface CardContext {
    id: string;
    title: string;
    content: string;
    author: string;
}

export interface ChatMessage extends Content {
    role: 'user' | 'model';
    parts: { text: string }[];
    sources?: any[];
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  context: CardContext | null;
  isPinned?: boolean;
  isUnsaved?: boolean;
}

interface AIAssistantContextType {
  isModalOpen: boolean;
  openModal: (context?: CardContext) => void;
  closeModal: () => void;
  
  conversations: Conversation[];
  activeConversation: Conversation | null;
  selectConversation: (id: string) => void;
  startNewChat: () => void;
  updateActiveConversation: (messages: ChatMessage[], newTitle?: string) => void;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, newTitle: string) => void;
  pinConversation: (id: string) => void;
  appendChunkToLastMessage: (chunk: { text: string; sources?: any[] }) => void;
}

const AIAssistantContext = createContext<AIAssistantContextType | undefined>(undefined);

export const useAIAssistant = () => {
  const context = useContext(AIAssistantContext);
  if (!context) {
    throw new Error('useAIAssistant must be used within an AIAssistantProvider');
  }
  return context;
};

export const AIAssistantProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  // Load from local storage on initial mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('spark-ai-conversations');
      const loaded = saved ? JSON.parse(saved) : [];
      if (loaded.length > 0) {
        setConversations(loaded);
        setActiveConversationId(loaded[0].id); // Most recent is at the top
      }
    } catch (error) {
      console.error("Failed to parse conversations from localStorage", error);
    }
  }, []);

  // Save to local storage whenever conversations change
  useEffect(() => {
    try {
      const visibleConversations = conversations.filter(c => !c.isUnsaved);
      if (visibleConversations.length > 0) {
        localStorage.setItem('spark-ai-conversations', JSON.stringify(visibleConversations));
      } else {
        localStorage.removeItem('spark-ai-conversations');
      }
    } catch (error) {
      console.error("Failed to save conversations to localStorage", error);
    }
  }, [conversations]);

  const startNewChat = (contextData?: CardContext) => {
    const newId = `conv-${Date.now()}`;
    const title = contextData ? `On "${contextData.title}"` : 'New Chat';
    const initialMessageText = contextData
        ? `I see you're looking at "${contextData.title}" by ${contextData.author}. I'm ready to help you brainstorm or answer questions about it. What's on your mind?`
        : "Hello! I'm Spark AI. How can I help you fuel your curiosity today?";

    const newConvo: Conversation = {
        id: newId,
        title: title,
        messages: [{ role: 'model', parts: [{ text: initialMessageText }] }],
        context: contextData || null,
        isUnsaved: true,
    };

    // Replace any existing unsaved chat with this new one at the top.
    setConversations(prev => [newConvo, ...prev.filter(c => !c.isUnsaved)]);
    setActiveConversationId(newId);
    return newId;
  };
  
  const selectConversation = (id: string) => {
    setActiveConversationId(id);
  };

  const deleteConversation = (id: string) => {
    setConversations(prevConversations => {
      const isDeletingActive = activeConversationId === id;
      const remainingConversations = prevConversations.filter(c => c.id !== id);

      if (isDeletingActive) {
        // If the deleted chat was active, create a new "welcome screen" chat.
        // This is done here to avoid race conditions with separate state updates.
        const newId = `conv-${Date.now()}`;
        const newWelcomeConvo: Conversation = {
            id: newId,
            title: 'New Chat',
            messages: [{ role: 'model', parts: [{ text: "Hello! I'm Spark AI. How can I help you fuel your curiosity today?" }] }],
            context: null,
            isUnsaved: true,
        };

        // We need to update the active ID. This is a side effect, but it's a state setter
        // from the same component, so React will batch it correctly with the conversations update.
        setActiveConversationId(newId);
        
        // New state is the welcome chat + remaining saved chats. This mirrors `startNewChat`.
        return [newWelcomeConvo, ...remainingConversations.filter(c => !c.isUnsaved)];
      } else {
        // If not deleting the active chat, just return the filtered list.
        return remainingConversations;
      }
    });
  };

  const renameConversation = (id: string, newTitle: string) => {
    setConversations(prev => 
        prev.map(c => c.id === id ? { ...c, title: newTitle } : c)
    );
  };

  const pinConversation = (id: string) => {
     setConversations(prev => 
        prev.map(c => c.id === id ? { ...c, isPinned: !c.isPinned } : c)
     );
  };

  const updateActiveConversation = (messages: ChatMessage[], newTitle?: string) => {
    if (!activeConversationId) return;

    setConversations(prev => {
        const convos = [...prev];
        const index = convos.findIndex(c => c.id === activeConversationId);
        if (index === -1) return prev;

        const currentConvo = convos[index];

        // Update the conversation
        convos[index] = {
            ...currentConvo,
            messages,
            title: newTitle && (currentConvo.title === 'New Chat' || currentConvo.isUnsaved) ? newTitle : currentConvo.title,
            isUnsaved: false, // Mark as saved
        };

        // Move the updated conversation to the top of its section
        const updatedConvo = convos.splice(index, 1)[0];
        if (updatedConvo.isPinned) {
            // Move to top of all conversations (since pinned are first)
            convos.unshift(updatedConvo);
        } else {
            // Move to top of recent conversations
            const firstRecentIndex = convos.findIndex(c => !c.isPinned && !c.isUnsaved);
            convos.splice(firstRecentIndex === -1 ? convos.length : firstRecentIndex, 0, updatedConvo);
        }
        
        return convos;
    });
  };

  const appendChunkToLastMessage = (chunk: { text: string; sources?: any[] }) => {
    if (!activeConversationId) return;
    setConversations(prev => 
        prev.map(convo => {
            if (convo.id === activeConversationId) {
                const newMessages = [...convo.messages];
                const lastMessageIndex = newMessages.length - 1;
                
                if (lastMessageIndex >= 0 && newMessages[lastMessageIndex].role === 'model') {
                    const updatedLastMessage = { ...newMessages[lastMessageIndex] };
                    
                    // Append text
                    updatedLastMessage.parts = [{ text: (updatedLastMessage.parts[0]?.text || '') + chunk.text }];
                    
                    // Append sources, avoiding duplicates
                    if (chunk.sources && chunk.sources.length > 0) {
                        const existingSources = updatedLastMessage.sources || [];
                        const existingUris = new Set(existingSources.map(s => s.uri));
                        const newSources = chunk.sources.filter(s => s && s.uri && !existingUris.has(s.uri));
                        
                        if (newSources.length > 0) {
                            updatedLastMessage.sources = [...existingSources, ...newSources];
                        }
                    }
                    
                    newMessages[lastMessageIndex] = updatedLastMessage;
                    return { ...convo, messages: newMessages };
                }
            }
            return convo;
        })
    );
  };
  
  const openModal = (contextData?: CardContext) => {
    if (contextData) {
      // This is for card buttons. Check if a chat for this context already exists.
      const existingConvo = conversations.find(
        c => c.context?.id === contextData.id
      );

      if (existingConvo) {
        // If it exists, select it.
        selectConversation(existingConvo.id);
      } else {
        // Otherwise, create a new chat with context.
        startNewChat(contextData);
      }
    } else {
      // This is for the main FAB button, always start a new chat.
      startNewChat();
    }
    setIsModalOpen(true);
  };
  
  const closeModal = () => {
    setIsModalOpen(false);
  };

  const activeConversation = conversations.find(c => c.id === activeConversationId) || null;

  const value = { 
    isModalOpen, 
    openModal, 
    closeModal,
    conversations,
    activeConversation,
    selectConversation,
    startNewChat: () => startNewChat(), // Expose a non-context version
    updateActiveConversation,
    deleteConversation,
    renameConversation,
    pinConversation,
    appendChunkToLastMessage,
  };

  return (
    <AIAssistantContext.Provider value={value}>
      {children}
    </AIAssistantContext.Provider>
  );
};

// --- FILTER CONTEXT ---

interface FilterContextType {
  domainSelections: Record<string, string[]>;
  setDomainSelection: (section: string, domains: string[]) => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export const useFilters = () => {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilters must be used within a FilterProvider');
  }
  return context;
};

export const FilterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [domainSelections, setDomainSelections] = useState<Record<string, string[]>>({});

  const setDomainSelection = (section: string, domains: string[]) => {
    setDomainSelections(prev => ({
      ...prev,
      [section]: domains,
    }));
  };

  const value = {
    domainSelections,
    setDomainSelection,
  };

  return (
    <FilterContext.Provider value={value}>
      {children}
    </FilterContext.Provider>
  );
};