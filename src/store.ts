import { create } from 'zustand';
import { ChatState, LLMConfig, Chat, Message } from './types';

// Load from localStorage
const loadState = () => {
  try {
    const llms = localStorage.getItem('aimessenger_llms');
    const chats = localStorage.getItem('aimessenger_chats');
    return {
      llms: llms ? JSON.parse(llms) : [],
      chats: chats ? JSON.parse(chats) : [],
    };
  } catch (error) {
    console.error('Error loading state:', error);
    return { llms: [], chats: [] };
  }
};

// Save to localStorage
const saveState = (llms: LLMConfig[], chats: Chat[]) => {
  try {
    localStorage.setItem('aimessenger_llms', JSON.stringify(llms));
    localStorage.setItem('aimessenger_chats', JSON.stringify(chats));
  } catch (error) {
    console.error('Error saving state:', error);
  }
};

const generateId = () => Math.random().toString(36).substr(2, 9);

export const useChatStore = create<ChatState>((set, get) => ({
  ...loadState(),
  activeChat: null,

  // LLM actions
  addLLM: (llm) => {
    const newLLM: LLMConfig = {
      ...llm,
      id: generateId(),
      createdAt: Date.now(),
    };
    set((state) => {
      const newState = { llms: [...state.llms, newLLM] };
      saveState(newState.llms, state.chats);
      return newState;
    });
  },

  updateLLM: (id, updates) => {
    set((state) => {
      const newState = {
        llms: state.llms.map((llm) =>
          llm.id === id ? { ...llm, ...updates } : llm
        ),
      };
      saveState(newState.llms, state.chats);
      return newState;
    });
  },

  removeLLM: (id) => {
    set((state) => {
      const newState = {
        llms: state.llms.filter((llm) => llm.id !== id),
        chats: state.chats.filter((chat) => chat.llmId !== id),
      };
      saveState(newState.llms, newState.chats);
      return newState;
    });
  },

  // Chat actions
  createChat: (llmId) => {
    const chatId = generateId();
    const newChat: Chat = {
      id: chatId,
      llmId,
      messages: [],
      lastMessageTime: Date.now(),
      unread: 0,
    };
    set((state) => {
      const newState = { chats: [...state.chats, newChat] };
      saveState(state.llms, newState.chats);
      return newState;
    });
    return chatId;
  },

  setActiveChat: (chatId) => {
    set({ activeChat: chatId });
    if (chatId) {
      // Mark as read
      set((state) => {
        const newState = {
          chats: state.chats.map((chat) =>
            chat.id === chatId ? { ...chat, unread: 0 } : chat
          ),
        };
        saveState(state.llms, newState.chats);
        return newState;
      });
    }
  },

  addMessage: (chatId, message) => {
    const newMessage: Message = {
      ...message,
      id: generateId(),
      chatId,
      timestamp: Date.now(),
    };
    set((state) => {
      const newState = {
        chats: state.chats.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                messages: [...chat.messages, newMessage],
                lastMessageTime: newMessage.timestamp,
                unread: state.activeChat === chatId ? 0 : chat.unread + 1,
              }
            : chat
        ),
      };
      saveState(state.llms, newState.chats);
      return newState;
    });
  },

  updateMessage: (messageId, updates) => {
    set((state) => {
      const newState = {
        chats: state.chats.map((chat) => ({
          ...chat,
          messages: chat.messages.map((msg) =>
            msg.id === messageId ? { ...msg, ...updates } : msg
          ),
        })),
      };
      saveState(state.llms, newState.chats);
      return newState;
    });
  },

  clearChat: (chatId) => {
    set((state) => {
      const newState = {
        chats: state.chats.map((chat) =>
          chat.id === chatId
            ? { ...chat, messages: [], lastMessageTime: Date.now() }
            : chat
        ),
      };
      saveState(state.llms, newState.chats);
      return newState;
    });
  },

  // Send message to LLM
  sendMessage: async (chatId, content) => {
    const state = get();
    const chat = state.chats.find((c) => c.id === chatId);
    if (!chat) return;

    const llm = state.llms.find((l) => l.id === chat.llmId);
    if (!llm) return;

    // Add user message
    state.addMessage(chatId, { content, sender: 'user' });

    // Create placeholder for LLM response
    const placeholderMessage: Message = {
      id: generateId(),
      chatId,
      content: '',
      sender: 'llm',
      timestamp: Date.now(),
      isStreaming: true,
    };

    set((s) => ({
      chats: s.chats.map((c) =>
        c.id === chatId
          ? { ...c, messages: [...c.messages, placeholderMessage] }
          : c
      ),
    }));

    try {
      // Get conversation history
      const messages = chat.messages.map((msg) => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.content,
      }));

      // Add new user message
      messages.push({ role: 'user', content });

      // Call backend API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          llm,
          messages,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Update placeholder message with response
      set((s) => {
        const newState = {
          chats: s.chats.map((c) =>
            c.id === chatId
              ? {
                  ...c,
                  messages: c.messages.map((msg) =>
                    msg.id === placeholderMessage.id
                      ? { ...msg, content: data.response, isStreaming: false }
                      : msg
                  ),
                }
              : c
          ),
        };
        saveState(s.llms, newState.chats);
        return newState;
      });
    } catch (error) {
      console.error('Error sending message:', error);
      // Update placeholder with error
      set((s) => ({
        chats: s.chats.map((c) =>
          c.id === chatId
            ? {
                ...c,
                messages: c.messages.map((msg) =>
                  msg.id === placeholderMessage.id
                    ? {
                        ...msg,
                        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                        isStreaming: false,
                      }
                    : msg
                ),
              }
            : c
        ),
      }));
    }
  },
}));
