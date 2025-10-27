export type LLMProvider = 'openrouter' | 'n8n' | 'lmstudio';

export interface LLMConfig {
  id: string;
  name: string;
  provider: LLMProvider;
  avatar?: string;
  config: {
    // OpenRouter specific
    apiKey?: string;
    model?: string;

    // n8n specific
    webhookUrl?: string;

    // LM Studio specific
    endpoint?: string;

    // Common
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
  };
  createdAt: number;
}

export interface Message {
  id: string;
  chatId: string;
  content: string;
  sender: 'user' | 'llm';
  timestamp: number;
  isStreaming?: boolean;
}

export interface Chat {
  id: string;
  llmId: string;
  messages: Message[];
  lastMessageTime: number;
  unread: number;
}

export interface ChatState {
  llms: LLMConfig[];
  chats: Chat[];
  activeChat: string | null;

  // LLM actions
  addLLM: (llm: Omit<LLMConfig, 'id' | 'createdAt'>) => void;
  updateLLM: (id: string, updates: Partial<LLMConfig>) => void;
  removeLLM: (id: string) => void;

  // Chat actions
  createChat: (llmId: string) => string;
  setActiveChat: (chatId: string | null) => void;
  addMessage: (chatId: string, message: Omit<Message, 'id' | 'timestamp' | 'chatId'>) => void;
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  clearChat: (chatId: string) => void;

  // Send message to LLM
  sendMessage: (chatId: string, content: string) => Promise<void>;
}
