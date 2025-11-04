import React, { useState } from 'react';
import { Search, Bot, MessageSquarePlus, Trash2, AlertTriangle } from 'lucide-react';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'framer-motion';
import ConversationItem from './ConversationItem';
import AIModelsModal from './AIModelsModal';

function Sidebar() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAIModelsModal, setShowAIModelsModal] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState(null);
  const { conversations, aiModels, activeConversationId, removeConversation } = useStore();

  const filteredConversations = conversations.filter(conv => {
    const model = aiModels.find(m => m.id === conv.modelId);
    return model?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           conv.lastMessage.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const openRemoveConversationModal = (conversation) => {
    const model = aiModels.find(m => m.id === conversation.modelId);
    setPendingRemoval({
      id: conversation.id,
      name: model?.name || 'AI Assistant',
      avatar: model?.avatar,
      lastMessage: conversation.lastMessage,
    });
  };

  const closeRemoveConversationModal = () => {
    setPendingRemoval(null);
  };

  const confirmRemoveConversation = () => {
    if (!pendingRemoval) return;
    removeConversation(pendingRemoval.id);
    setPendingRemoval(null);
  };

  return (
    <>
      <div className="w-80 bg-surface border-r border-border flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Bot className="w-6 h-6 text-primary" />
              AI Chats
            </h2>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowAIModelsModal(true)}
              className="p-2 rounded-lg bg-white hover:bg-gray-200 transition-colors group"
              title="Start new chat"
            >
              <MessageSquarePlus className="w-5 h-5 text-black group-hover:rotate-12 transition-transform" />
            </motion.button>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-surface-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <AnimatePresence>
            {filteredConversations.length > 0 ? (
              <div className="divide-y divide-border">
                {filteredConversations.map((conversation) => (
                  <ConversationItem
                    key={conversation.id}
                    conversation={conversation}
                    isActive={activeConversationId === conversation.id}
                    onRemove={() => openRemoveConversationModal(conversation)}
                  />
                ))}
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-8 text-center text-text-secondary"
              >
                <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No conversations yet</p>
                <p className="text-sm mt-1">Click the + button to start chatting</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Quick Stats */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center justify-between text-sm text-text-secondary">
            <span>{conversations.length} conversations</span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
              {aiModels.filter(m => m.isOnline).length} AI online
            </span>
          </div>
        </div>
      </div>

      {/* AI Models Modal */}
      {showAIModelsModal && (
        <AIModelsModal onClose={() => setShowAIModelsModal(false)} />
      )}

      <AnimatePresence>
        {pendingRemoval && (
          <motion.div
            key="remove-conversation-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={closeRemoveConversationModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-border bg-surface shadow-2xl"
            >
              <div className="p-6">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-error/10 text-error">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-text">
                  Remove {pendingRemoval.name}?
                </h3>
                <p className="mt-2 text-sm text-text-secondary">
                  This will permanently delete the conversation history with this assistant. This action cannot be undone.
                </p>

                {pendingRemoval.lastMessage && (
                  <div className="mt-4 rounded-lg border border-border bg-surface-light p-4 text-xs text-text-secondary">
                    <p className="font-semibold text-text mb-1">Most recent message</p>
                    <p className="line-clamp-3">{pendingRemoval.lastMessage}</p>
                  </div>
                )}

                <div className="mt-6 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeRemoveConversationModal}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary hover:text-text hover:bg-surface-light transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmRemoveConversation}
                    className="inline-flex items-center gap-2 rounded-lg bg-error px-4 py-2 text-sm font-semibold text-white hover:bg-error/90 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default Sidebar;
