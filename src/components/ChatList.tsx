import { useChatStore } from '../store';
import { MessageSquare, Plus, Settings } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { LLMConfig } from '../types';

interface ChatListProps {
  onAddLLM: () => void;
}

export function ChatList({ onAddLLM }: ChatListProps) {
  const { llms, chats, activeChat, setActiveChat, createChat } = useChatStore();

  const handleLLMClick = (llm: LLMConfig) => {
    // Find or create chat for this LLM
    let chat = chats.find((c) => c.llmId === llm.id);
    if (!chat) {
      const chatId = createChat(llm.id);
      setActiveChat(chatId);
    } else {
      setActiveChat(chat.id);
    }
  };

  const getLastMessage = (llmId: string) => {
    const chat = chats.find((c) => c.llmId === llmId);
    if (!chat || chat.messages.length === 0) return 'No messages yet';
    const lastMsg = chat.messages[chat.messages.length - 1];
    return lastMsg.content.substring(0, 50) + (lastMsg.content.length > 50 ? '...' : '');
  };

  const getLastMessageTime = (llmId: string) => {
    const chat = chats.find((c) => c.llmId === llmId);
    if (!chat || chat.messages.length === 0) return null;
    return chat.lastMessageTime;
  };

  const getUnreadCount = (llmId: string) => {
    const chat = chats.find((c) => c.llmId === llmId);
    return chat?.unread || 0;
  };

  const getActiveLLMId = () => {
    if (!activeChat) return null;
    const chat = chats.find((c) => c.id === activeChat);
    return chat?.llmId || null;
  };

  return (
    <div className="w-80 bg-white border-r border-messenger-border flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-messenger-border flex items-center justify-between">
        <h1 className="text-2xl font-bold">Chats</h1>
        <button
          onClick={onAddLLM}
          className="p-2 rounded-full hover:bg-messenger-gray transition-colors"
          title="Add new LLM"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {llms.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <MessageSquare size={48} className="mx-auto mb-4 opacity-50" />
            <p className="mb-2">No LLMs added yet</p>
            <button
              onClick={onAddLLM}
              className="px-4 py-2 bg-messenger-blue text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Add Your First LLM
            </button>
          </div>
        ) : (
          llms.map((llm) => {
            const isActive = getActiveLLMId() === llm.id;
            const unread = getUnreadCount(llm.id);
            const lastMessageTime = getLastMessageTime(llm.id);

            return (
              <div
                key={llm.id}
                onClick={() => handleLLMClick(llm)}
                className={`p-4 border-b border-messenger-border cursor-pointer hover:bg-messenger-gray transition-colors ${
                  isActive ? 'bg-messenger-gray' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                    {llm.avatar || llm.name.substring(0, 2).toUpperCase()}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold truncate">{llm.name}</h3>
                      {lastMessageTime && (
                        <span className="text-xs text-gray-500">
                          {formatDistanceToNow(lastMessageTime, { addSuffix: true })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-600 truncate">
                        {getLastMessage(llm.id)}
                      </p>
                      {unread > 0 && (
                        <span className="ml-2 px-2 py-0.5 bg-messenger-blue text-white text-xs rounded-full">
                          {unread}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 capitalize mt-1 inline-block">
                      {llm.provider}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
