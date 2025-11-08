import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { Send, Plus, Sliders, RotateCcw, MoreVertical, Bot, ChevronDown, ArrowUp, User, MessageSquare, UserPlus, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Message from './Message';
import TypingIndicator from './TypingIndicator';
import AIProfileModal from './AIProfileModal';
import ChatHistoryModal from './ChatHistoryModal';

function ChatWindow() {
  const [message, setMessage] = useState('');
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showMenuDropdown, setShowMenuDropdown] = useState(false);
  const [showMultiModelDropdown, setShowMultiModelDropdown] = useState(false);
  const [showAIProfile, setShowAIProfile] = useState(false);
  const [showChatHistory, setShowChatHistory] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const menuDropdownRef = useRef(null);
  const multiModelDropdownRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);
  
  const { 
    activeConversationId, 
    conversations, 
    messages, 
    aiModels, 
    sendMessage,
    addExtraModelToConversation,
    removeExtraModelFromConversation
  } = useStore();

  const activeConversation = conversations.find(c => c.id === activeConversationId);
  const activeModel = activeConversation 
    ? aiModels.find(m => m.id === activeConversation.modelId)
    : null;
  
  const conversationMessages = messages[activeConversationId] || [];
  const modelsById = useMemo(() => {
    const map = {};
    aiModels.forEach(model => {
      map[model.id] = model;
    });
    return map;
  }, [aiModels]);

  // Check if user is near bottom of scroll container
  const checkIfNearBottom = () => {
    const container = messagesContainerRef.current;
    if (!container) return true;
    
    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    // Consider "near bottom" if within 150px
    return distanceFromBottom < 150;
  };

  // Scroll to bottom function
  const scrollToBottom = (smooth = false) => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const scroll = () => {
      container.scrollTop = container.scrollHeight;
    };

    if (smooth) {
      // Use smooth scrolling with animation
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      });
    } else {
      // Instant scroll
      requestAnimationFrame(scroll);
    }
  };

  // Handle scroll events to track if user has manually scrolled up
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    let scrollTimeout;
    const handleScroll = () => {
      // Debounce scroll detection
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        shouldAutoScrollRef.current = checkIfNearBottom();
      }, 100);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, [activeConversationId]);

  // Track if any message is typing to trigger scroll updates
  const hasTypingMessage = conversationMessages.some(msg => msg.isTyping);
  const messageIds = conversationMessages.map(msg => msg.id).join(',');
  const lastMessageContent = conversationMessages[conversationMessages.length - 1]?.content || '';

  // Auto-scroll to bottom when new messages arrive or content updates (only if user hasn't scrolled up)
  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      // Wait for DOM to update, then scroll smoothly
      const timeoutId = setTimeout(() => {
        scrollToBottom(true);
      }, 50);
      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageIds, hasTypingMessage, lastMessageContent, activeConversationId]);

  // Reset auto-scroll when conversation changes
  useEffect(() => {
    shouldAutoScrollRef.current = true;
    requestAnimationFrame(() => {
      scrollToBottom(false);
    });
  }, [activeConversationId]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowModelDropdown(false);
      }
      if (menuDropdownRef.current && !menuDropdownRef.current.contains(event.target)) {
        setShowMenuDropdown(false);
      }
      if (multiModelDropdownRef.current && !multiModelDropdownRef.current.contains(event.target)) {
        setShowMultiModelDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSend = () => {
    if (message.trim() && activeConversationId) {
      shouldAutoScrollRef.current = true; // Force scroll when sending
      sendMessage(message);
      setMessage('');
      // Scroll immediately when sending
      requestAnimationFrame(() => {
        scrollToBottom(true);
      });
      // Focus input after sending
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  /* Early return moved below to keep hooks order consistent across renders */

  const selectedExtraModelIds = Array.isArray(activeConversation?.extraModelIds)
    ? activeConversation.extraModelIds
    : [];
  const extraModels = selectedExtraModelIds
    .map(id => aiModels.find(model => model.id === id))
    .filter(Boolean);
  const multiModeActive = extraModels.length > 0;
  const maxExtraModels = 2;
  const canAddMoreModels = selectedExtraModelIds.length < maxExtraModels;
  const availableMultiModels = (activeModel
    ? aiModels.filter(model => model.id !== activeModel.id)
    : [...aiModels])
    .sort((a, b) => {
      const aSelected = selectedExtraModelIds.includes(a.id);
      const bSelected = selectedExtraModelIds.includes(b.id);
      if (aSelected === bSelected) return a.name.localeCompare(b.name);
      return aSelected ? -1 : 1;
    });

  const participatingModels = useMemo(() => {
    const base = activeModel ? [activeModel, ...extraModels] : [];
    const unique = [];
    const seen = new Set();

    base.forEach(modelEntry => {
      if (modelEntry && !seen.has(modelEntry.id)) {
        seen.add(modelEntry.id);
        unique.push(modelEntry);
      }
    });

    return unique;
  }, [activeModel, extraModels]);

  const messagesByModel = useMemo(() => {
    const map = {};

    if (participatingModels.length === 0) {
      return map;
    }

    participatingModels.forEach(modelEntry => {
      map[modelEntry.id] = [];
    });

    const primaryModelId = participatingModels[0]?.id;

    conversationMessages.forEach(msg => {
      if (msg.sender === 'user') {
        participatingModels.forEach(modelEntry => {
          map[modelEntry.id].push({
            message: msg,
            isShared: true,
          });
        });
        return;
      }

      if (msg.sender === 'ai' && map[msg.modelId]) {
        map[msg.modelId].push({
          message: msg,
          isShared: false,
        });
        return;
      }

      if (msg.sender === 'ai' && primaryModelId && map[primaryModelId]) {
        map[primaryModelId].push({
          message: msg,
          isShared: false,
        });
      }
    });

    return map;
  }, [conversationMessages, participatingModels]);

  const columnGridClass = useMemo(() => {
    const count = participatingModels.length;
    if (count >= 3) return 'md:grid-cols-3';
    if (count === 2) return 'md:grid-cols-2';
    return 'md:grid-cols-1';
  }, [participatingModels]);

  if (!activeConversation || !activeModel) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Bot className="w-16 h-16 mx-auto mb-4 text-primary opacity-50" />
          <h3 className="text-xl font-semibold mb-2">Welcome to AI Messenger</h3>
          <p className="text-text-secondary">Select an AI model to start chatting</p>
        </div>
      </div>
    );
  }

  const handleToggleExtraModel = (modelId) => {
    if (!activeConversation) return;
    if (selectedExtraModelIds.includes(modelId)) {
      removeExtraModelFromConversation(activeConversation.id, modelId);
    } else if (selectedExtraModelIds.length < maxExtraModels) {
      addExtraModelToConversation(activeConversation.id, modelId);
    }
  };

  const nonTypingMessages = useMemo(() => (
    conversationMessages.filter(msg => !msg.isTyping)
  ), [conversationMessages]);

  const renderItems = useMemo(() => {
    const items = [];
    let index = 0;
    let lastUserMessage = null;

    while (index < nonTypingMessages.length) {
      const current = nonTypingMessages[index];

      if (current.sender === 'user') {
        items.push({
          type: 'single',
          message: current,
          originalIndex: index,
          previousUserMessage: lastUserMessage,
          key: current.id,
        });
        lastUserMessage = current;
        index += 1;
        continue;
      }

      if (current.sender === 'ai' && current.responseGroupId) {
        const groupId = current.responseGroupId;
        const groupMessages = [];
        const startIndex = index;

        while (index < nonTypingMessages.length) {
          const candidate = nonTypingMessages[index];
          if (candidate.sender === 'ai' && candidate.responseGroupId === groupId) {
            groupMessages.push(candidate);
            index += 1;
          } else {
            break;
          }
        }

        if (groupMessages.length > 1) {
          items.push({
            type: 'group',
            messages: groupMessages,
            previousUserMessage: lastUserMessage,
            key: `group-${groupId || groupMessages[0].id}`,
          });
          continue;
        }

        const singleMessage = groupMessages[0];
        items.push({
          type: 'single',
          message: singleMessage,
          originalIndex: startIndex,
          previousUserMessage: lastUserMessage,
          key: singleMessage.id,
        });
        continue;
      }

      items.push({
        type: 'single',
        message: current,
        originalIndex: index,
        previousUserMessage: lastUserMessage,
        key: current.id,
      });

      index += 1;
    }

    return items;
  }, [nonTypingMessages]);

  const MultiModelResponseGroup = ({ responses, onRetry }) => {
    const count = responses.length;
    const gridCols = count >= 3 ? 'md:grid-cols-3' : count === 2 ? 'md:grid-cols-2' : 'md:grid-cols-1';

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="my-6"
      >
        <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.35em] text-text-secondary/70 mb-4">
          <span className="flex-1 h-px bg-border/40" />
          <span>Multi-model responses</span>
          <span className="flex-1 h-px bg-border/40" />
        </div>
        <div className={`grid grid-cols-1 gap-4 ${gridCols}`}>
          {responses.map((response) => {
            const responseModel = modelsById[response.modelId] || activeModel;
            return (
              <div key={response.id} className="flex">
                <Message
                  message={response}
                  model={responseModel}
                  onRetry={onRetry}
                  showModelLabel
                  isGrouped
                />
              </div>
            );
          })}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Chat Header */}
      <div className="flex-shrink-0 p-4 border-b border-border glass-effect">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={activeModel.avatar}
                alt={activeModel.name}
                className="w-10 h-10 rounded-full object-cover"
                onError={(e) => {
                  const seed = encodeURIComponent(activeModel.apiModel || activeModel.name || 'aimessenger');
                  e.currentTarget.src = `https://robohash.org/${seed}.png?size=200x200&set=set1`;
                }}
              />
              {activeModel.isOnline && (
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-success rounded-full border-2 border-surface" />
              )}
            </div>
            <div>
              <h3 className="font-semibold">{activeModel.name}</h3>
              <p className="text-xs text-text-secondary">
                {activeModel.isOnline ? activeModel.status : 'Offline'}
              </p>
              {multiModeActive && (
                <div className="flex items-center gap-2 mt-3 text-[11px] text-text-secondary">
                  {[activeModel, ...extraModels].map((modelEntry, index) => (
                    <React.Fragment key={modelEntry.id}>
                      {index > 0 && <span className="h-px w-6 bg-border/50" />}
                      <span className="flex items-center gap-1">
                        <span className="inline-flex h-2 w-2 rounded-full bg-primary/80" />
                        {modelEntry.name}
                      </span>
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative" ref={multiModelDropdownRef}>
              <button
                onClick={() => {
                  setShowMultiModelDropdown(!showMultiModelDropdown);
                  setShowMenuDropdown(false);
                }}
                className="p-2 hover:bg-surface rounded-lg transition-colors"
                title="Add models to multi-chat"
              >
                <UserPlus className="w-5 h-5" />
              </button>
              {multiModeActive && (
                <span className="absolute -top-1 -right-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-black">
                  {selectedExtraModelIds.length + 1}
                </span>
              )}

              <AnimatePresence>
                {showMultiModelDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute right-0 top-full mt-2 w-64 bg-surface rounded-xl border border-border shadow-xl overflow-hidden z-50"
                  >
                    <div className="p-2">
                      <p className="text-xs text-text-secondary px-3 py-2">Multi-chat models</p>
                      {availableMultiModels.map(modelOption => {
                        const isSelected = selectedExtraModelIds.includes(modelOption.id);
                        const disabled = !isSelected && !canAddMoreModels;
                        return (
                          <button
                            key={modelOption.id}
                            onClick={() => handleToggleExtraModel(modelOption.id)}
                            disabled={disabled}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
                              isSelected ? 'bg-primary/15 border border-primary/30' : 'hover:bg-surface-light'
                            } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                          >
                            <img
                              src={modelOption.avatar}
                              alt={modelOption.name}
                              className="w-8 h-8 rounded-full object-cover"
                              onError={(e) => {
                                const seed = encodeURIComponent(modelOption.apiModel || modelOption.name || 'aimessenger');
                                e.currentTarget.src = `https://robohash.org/${seed}.png?size=200x200&set=set1`;
                              }}
                            />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-text">{modelOption.name}</p>
                              <p className="text-xs text-text-secondary">{modelOption.provider}</p>
                            </div>
                            {isSelected ? (
                              <Check className="w-4 h-4 text-primary" />
                            ) : (
                              <span className="text-[11px] text-text-secondary">Add</span>
                            )}
                          </button>
                        );
                      })}
                      {selectedExtraModelIds.length >= maxExtraModels && (
                        <p className="mt-2 px-3 text-[11px] text-text-secondary/80">
                          Maximum of three models per conversation.
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="relative" ref={menuDropdownRef}>
              <button 
                onClick={() => {
                  setShowMenuDropdown(!showMenuDropdown);
                  setShowMultiModelDropdown(false);
                }}
                className="p-2 hover:bg-surface rounded-lg transition-colors"
              >
                <MoreVertical className="w-5 h-5" />
              </button>

              {/* Dropdown Menu */}
              <AnimatePresence>
                {showMenuDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute right-0 top-full mt-2 w-56 bg-surface rounded-xl border border-border shadow-xl overflow-hidden z-50"
                  >
                    <div className="p-1">
                      <button
                        onClick={() => {
                          setShowAIProfile(true);
                          setShowMenuDropdown(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-surface-light transition-colors text-left"
                      >
                        <User className="w-4 h-4 text-text-secondary" />
                        <span className="text-sm">AI Profile</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowChatHistory(true);
                          setShowMenuDropdown(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-surface-light transition-colors text-left"
                      >
                        <MessageSquare className="w-4 h-4 text-text-secondary" />
                        <span className="text-sm">Chat History</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto min-h-0 p-4"
      >
        <div className={`mx-auto w-full ${multiModeActive ? 'max-w-6xl' : 'max-w-3xl'}`}>
          {multiModeActive ? (
            <div className={`grid grid-cols-1 gap-6 ${columnGridClass}`}>
              {participatingModels.map((modelEntry) => {
                const columnEntries = messagesByModel[modelEntry.id] || [];
                let lastUserMessage = null;
                const modelTyping = conversationMessages.some(
                  (msg) => msg.isTyping && msg.modelId === modelEntry.id
                );

                return (
                  <div
                    key={modelEntry.id}
                    className="flex flex-col rounded-3xl border border-border/40 bg-surface/30 backdrop-blur-sm min-h-[240px]"
                  >
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 bg-surface/60">
                      <img
                        src={modelEntry.avatar}
                        alt={modelEntry.name}
                        className="w-9 h-9 rounded-full object-cover"
                        onError={(e) => {
                          const seed = encodeURIComponent(modelEntry.apiModel || modelEntry.name || 'aimessenger');
                          e.currentTarget.src = `https://robohash.org/${seed}.png?size=200x200&set=set1`;
                        }}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text truncate">{modelEntry.name}</p>
                        <p className="text-[11px] text-text-secondary/80 truncate">
                          {modelEntry.provider || 'Custom model'}
                        </p>
                      </div>
                    </div>
                    <div className="flex-1 p-4 space-y-4">
                      {columnEntries.length === 0 ? (
                        <p className="text-sm text-text-secondary/70">
                          No messages yet for this model.
                        </p>
                      ) : (
                        columnEntries.map(({ message }) => {
                          if (message.sender === 'user') {
                            lastUserMessage = message;
                            return (
                              <Message
                                key={`${message.id}-${modelEntry.id}-user`}
                                message={message}
                              />
                            );
                          }

                          const previousUserMessage = lastUserMessage;
                          const handleRetry = previousUserMessage
                            ? () => sendMessage(previousUserMessage.content)
                            : undefined;

                          return (
                            <Message
                              key={`${message.id}-${modelEntry.id}`}
                              message={message}
                              model={modelEntry}
                              onRetry={handleRetry}
                            />
                          );
                        })
                      )}

                      {modelTyping && (
                        <div className="pt-2">
                          <TypingIndicator model={modelEntry} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <>
              <AnimatePresence initial={false}>
                {renderItems.map((item) => {
                  if (item.type === 'group') {
                    const retryHandler = item.previousUserMessage && activeConversation
                      ? () => sendMessage(item.previousUserMessage.content)
                      : undefined;

                    return (
                      <MultiModelResponseGroup
                        key={item.key}
                        responses={item.messages}
                        onRetry={retryHandler}
                      />
                    );
                  }

                  const msg = item.message;
                  const previousUserMessage = item.previousUserMessage;
                  const handleRetry = previousUserMessage && msg.sender === 'ai'
                    ? () => sendMessage(previousUserMessage.content)
                    : undefined;

                  const previousMessage = item.originalIndex > 0 ? nonTypingMessages[item.originalIndex - 1] : null;
                  const showModelLabel =
                    msg.sender === 'ai' && (
                      selectedExtraModelIds.length > 0 ||
                      (previousMessage && previousMessage.sender === 'ai')
                    );

                  const messageModel =
                    msg.sender === 'ai'
                      ? modelsById[msg.modelId] || activeModel
                      : null;

                  return (
                    <Message 
                      key={item.key} 
                      message={msg} 
                      model={messageModel}
                      onRetry={handleRetry}
                      showModelLabel={showModelLabel}
                    />
                  );
                })}
              </AnimatePresence>

              {conversationMessages.some(msg => msg.isTyping) && activeModel && (
                <TypingIndicator model={activeModel} />
              )}
            </>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area - Narrower and Centered */}
      <div className="flex-shrink-0 p-4">
        <div className="max-w-3xl mx-auto">
          <div className="relative flex items-center gap-2 bg-surface-light rounded-full px-2 py-1 border border-border/50">
            {/* Left Icons */}
            <div className="flex items-center gap-1">
              <button className="p-2 hover:bg-surface rounded-full transition-colors">
                <Plus className="w-5 h-5 text-text-secondary" />
              </button>
              <button className="p-2 hover:bg-surface rounded-full transition-colors">
                <Sliders className="w-5 h-5 text-text-secondary" />
              </button>
              <button className="p-2 hover:bg-surface rounded-full transition-colors">
                <RotateCcw className="w-5 h-5 text-text-secondary" />
              </button>
            </div>

            {/* Input Field */}
            <input
              ref={inputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="How can I help you today?"
              className="flex-1 bg-transparent px-2 py-2 focus:outline-none text-text placeholder-text-secondary"
            />

            {/* Right Side - Model Selector and Send */}
            <div className="flex items-center gap-2">
              {/* Model Selector */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowModelDropdown(!showModelDropdown)}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface rounded-full transition-colors text-sm"
                >
                  <span className="text-text-secondary">{activeModel.name}</span>
                  <ChevronDown className="w-4 h-4 text-text-secondary" />
                </button>

                {/* Model Dropdown */}
                <AnimatePresence>
                  {showModelDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute bottom-full right-0 mb-2 w-64 bg-surface rounded-xl border border-border shadow-xl overflow-hidden"
                    >
                      <div className="p-2">
                        <p className="text-xs text-text-secondary px-3 py-2">Available Models</p>
                        {aiModels.map((model) => (
                          <button
                            key={model.id}
                            onClick={() => {
                              // In a real app, this would switch the model for the conversation
                              setShowModelDropdown(false);
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-light transition-colors ${
                              model.id === activeModel.id ? 'bg-surface-light' : ''
                            }`}
                          >
                            <img
                              src={model.avatar}
                              alt={model.name}
                              className="w-8 h-8 rounded-full object-cover"
                              onError={(e) => {
                                const seed = encodeURIComponent(model.apiModel || model.name || 'aimessenger');
                                e.currentTarget.src = `https://robohash.org/${seed}.png?size=200x200&set=set1`;
                              }}
                            />
                            <div className="flex-1 text-left">
                              <p className="text-sm font-medium">{model.name}</p>
                              <p className="text-xs text-text-secondary">{model.provider}</p>
                            </div>
                            {model.id === activeModel.id && (
                              <div className="w-2 h-2 bg-primary rounded-full" />
                            )}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Send Button */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleSend}
                disabled={!message.trim()}
                className={`p-2.5 rounded-full transition-all ${
                  message.trim() 
                    ? 'bg-white hover:bg-gray-200 text-black' 
                    : 'bg-black text-white'
                }`}
              >
                <ArrowUp className="w-5 h-5" />
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      {/* AI Profile Modal */}
      {showAIProfile && (
        <AIProfileModal
          model={activeModel}
          onClose={() => setShowAIProfile(false)}
        />
      )}

      {/* Chat History Modal */}
      {showChatHistory && (
        <ChatHistoryModal
          messages={conversationMessages}
          model={activeModel}
          onClose={() => setShowChatHistory(false)}
        />
      )}
    </div>
  );
}

export default ChatWindow;
