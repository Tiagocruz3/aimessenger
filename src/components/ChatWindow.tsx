import { useState, useRef, useEffect } from 'react';
import { useChatStore } from '../store';
import { Send, Loader2, Trash2, Info } from 'lucide-react';
import { format } from 'date-fns';

export function ChatWindow() {
  const { chats, activeChat, llms, addMessage, sendMessage, clearChat } = useChatStore();
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chat = chats.find((c) => c.id === activeChat);
  const llm = chat ? llms.find((l) => l.id === chat.llmId) : null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat?.messages]);

  const handleSend = async () => {
    if (!input.trim() || !activeChat || isSending) return;

    const message = input.trim();
    setInput('');
    setIsSending(true);

    try {
      await sendMessage(activeChat, message);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!activeChat || !chat || !llm) {
    return (
      <div className="flex-1 flex items-center justify-center bg-messenger-gray">
        <div className="text-center text-gray-500">
          <svg
            className="mx-auto mb-4 w-24 h-24 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <p className="text-lg">Select a chat to start messaging</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white h-full">
      {/* Header */}
      <div className="p-4 border-b border-messenger-border flex items-center justify-between bg-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold">
            {llm.avatar || llm.name.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h2 className="font-semibold">{llm.name}</h2>
            <p className="text-xs text-gray-500 capitalize">{llm.provider}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (confirm('Clear all messages in this chat?')) {
                clearChat(activeChat);
              }
            }}
            className="p-2 rounded-full hover:bg-messenger-gray transition-colors"
            title="Clear chat"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {chat.messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-12">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          chat.messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                  message.sender === 'user'
                    ? 'bg-messenger-blue text-white'
                    : 'bg-messenger-gray text-gray-900'
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
                {message.isStreaming && (
                  <div className="flex items-center gap-1 mt-1">
                    <Loader2 size={12} className="animate-spin" />
                    <span className="text-xs opacity-70">Thinking...</span>
                  </div>
                )}
                <span
                  className={`text-xs mt-1 block ${
                    message.sender === 'user' ? 'text-blue-100' : 'text-gray-500'
                  }`}
                >
                  {format(message.timestamp, 'HH:mm')}
                </span>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-messenger-border bg-white">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 resize-none rounded-full px-4 py-2 bg-messenger-gray focus:outline-none focus:ring-2 focus:ring-messenger-blue"
            style={{ maxHeight: '120px' }}
            disabled={isSending}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isSending}
            className={`p-3 rounded-full transition-colors ${
              input.trim() && !isSending
                ? 'bg-messenger-blue text-white hover:bg-blue-600'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
}
