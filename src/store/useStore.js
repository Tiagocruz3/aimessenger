import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { aiModels } from '../data/aiModels';

const env = import.meta.env || {};

const getTrimmedEnv = (key) => {
  const value = env?.[key];
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : '';
};

const normalizeProvider = (value) => {
  if (typeof value !== 'string') return '';
  const normalized = value.trim().toLowerCase();
  return ['openrouter', 'n8n', 'lmstudio'].includes(normalized) ? normalized : '';
};

const shortenSummary = (text, maxLength = 320) => {
  if (typeof text !== 'string') return '';
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  const sentences = normalized.match(/[^.!?]+[.!?]+/g) || [];
  let trimmed = '';

  for (const sentence of sentences) {
    const next = (trimmed + ' ' + sentence).trim();
    if (!trimmed && next.length > maxLength) {
      break;
    }
    if (next.length > maxLength) {
      break;
    }
    trimmed = next;
  }

  if (!trimmed) {
    return normalized.slice(0, maxLength - 1).trimEnd() + '…';
  }

  return trimmed.endsWith('.') || trimmed.endsWith('!') || trimmed.endsWith('?')
    ? trimmed
    : `${trimmed}…`;
};

const extractImageSearchQuery = (input) => {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  const commandMatch = trimmed.match(/^(?:\/imgsearch|\/image-search|\/imagesearch|\/images)\s+(.+)/i);
  if (commandMatch) {
    return commandMatch[1].trim();
  }

  const imageSearchForMatch = trimmed.match(/^image\s+search(?:\s+for)?\s+(.+)/i);
  if (imageSearchForMatch) {
    return imageSearchForMatch[1].trim();
  }

  const searchForImagesMatch = trimmed.match(/^search(?:\s+the\s+web)?(?:\s+for)?\s+(.+?)\s+(?:images?|pictures?|photos?)$/i);
  if (searchForImagesMatch) {
    return searchForImagesMatch[1].trim();
  }

  const searchImagesOfMatch = trimmed.match(/^search(?:\s+the\s+web)?(?:\s+for)?(?:\s+an?)?\s*(?:images?|pictures?|photos?)\s+(?:of|for)?\s+(.+)/i);
  if (searchImagesOfMatch) {
    return searchImagesOfMatch[1].trim();
  }

  const containsSearchAndImages = /\bsearch\b/i.test(trimmed) && /\bimages?|pictures?|photos?\b/i.test(trimmed);
  if (containsSearchAndImages) {
    return trimmed
      .replace(/^search(?:\s+the\s+web)?(?:\s+for)?/i, '')
      .replace(/(?:images?|pictures?|photos?)$/i, '')
      .replace(/(?:images?|pictures?|photos?)\s+(?:of|for)\s*/i, '')
      .trim();
  }

  return null;
};

const envOpenRouterApiKey = getTrimmedEnv('VITE_OPENROUTER_API_KEY');
const envOpenAIApiKey = getTrimmedEnv('VITE_OPENAI_API_KEY');
const envN8nWebhookUrl = getTrimmedEnv('VITE_N8N_WEBHOOK_URL');
const envLmstudioUrl = getTrimmedEnv('VITE_LMSTUDIO_URL');
const envSearchUrl = getTrimmedEnv('VITE_SEARCH_URL');
const envDefaultImageModel = getTrimmedEnv('VITE_DEFAULT_IMAGE_MODEL');
const envDefaultOcrModel = getTrimmedEnv('VITE_DEFAULT_OCR_MODEL');

const resolvedProvider =
  normalizeProvider(env?.VITE_DEFAULT_PROVIDER) ||
  (envOpenRouterApiKey ? 'openrouter' : '') ||
  (envN8nWebhookUrl ? 'n8n' : '') ||
  (envLmstudioUrl ? 'lmstudio' : '') ||
  'openrouter';

const initialApiSettings = {
  provider: resolvedProvider,
  openrouterApiKey: envOpenRouterApiKey,
  openaiApiKey: envOpenAIApiKey,
  n8nWebhookUrl: envN8nWebhookUrl,
  lmstudioUrl: envLmstudioUrl || 'http://localhost:1234/v1',
  searchUrl: envSearchUrl || 'https://search.brainstormnodes.org/',
  imageGenerationModel: envDefaultImageModel || 'dall-e-3',
  ocrModel: envDefaultOcrModel || 'gpt-4o',
};

export const useStore = create((set, get) => ({
  // State
  aiModels: [],
  conversations: [],
  activeConversationId: null,
  messages: {},
  apiSettings: { ...initialApiSettings },
  userProfile: {
    name: 'You',
    avatarUrl: '',
    email: '',
    hobbies: ['chatting with AIs'],
    bio: 'Curious human exploring AI conversations.',
  },
  openRouterModels: [],
  isLoadingModels: false,
  modelsError: null,
  apiConnectionStatus: {
    status: 'unknown', // 'connected', 'disconnected', 'checking', 'unknown'
    lastChecked: null,
    error: null,
  },
  imageApiConnectionStatus: {
    status: 'unknown', // 'connected', 'disconnected', 'checking', 'unknown'
    lastChecked: null,
    error: null,
  },
  ocrApiConnectionStatus: {
    status: 'unknown', // 'connected', 'disconnected', 'checking', 'unknown'
    lastChecked: null,
    error: null,
  },
  
  // Actions
  updateUserProfile: (updates) => {
    set(state => ({
      userProfile: { ...state.userProfile, ...(updates || {}) }
    }));
  },
  initializeAIModels: () => {
    const models = aiModels.map(model => ({
      ...model,
      id: uuidv4(),
      isOnline: Math.random() > 0.3,
      lastSeen: new Date(Date.now() - Math.random() * 86400000).toISOString(),
    }));
    
    set({ aiModels: models });
    
    // Create initial conversations
    const conversations = models.slice(0, 5).map(model => ({
      id: uuidv4(),
      modelId: model.id,
      lastMessage: model.lastMessage || 'Click to start chatting',
      timestamp: new Date(Date.now() - Math.random() * 3600000).toISOString(),
      unread: Math.random() > 0.5 ? Math.floor(Math.random() * 5) : 0,
      extraModelIds: [],
    }));
    
    set({ conversations });
  },
  
  fetchOpenRouterModels: async () => {
    const { apiSettings } = get();
    
    if (!apiSettings.openrouterApiKey) {
      set({ modelsError: 'OpenRouter API key not configured' });
      return;
    }
    
    set({ isLoadingModels: true, modelsError: null });
    
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiSettings.openrouterApiKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'AI Messenger'
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Transform ALL OpenRouter models without filtering
      const openRouterModels = data.data.map(model => {
        // Extract only the values we need, avoiding nested objects
        const contextLength = typeof model.context_length === 'number' ? model.context_length : null;
        const topProvider = typeof model.top_provider === 'string' ? model.top_provider : null;
        
        // Safely extract pricing values
        let promptPrice = 0;
        let completionPrice = 0;
        if (model.pricing && typeof model.pricing === 'object') {
          promptPrice = typeof model.pricing.prompt === 'number' ? model.pricing.prompt : 0;
          completionPrice = typeof model.pricing.completion === 'number' ? model.pricing.completion : 0;
        }
        
        return {
          id: uuidv4(),
          name: model.name || model.id.split('/').pop().replace(/-/g, ' '),
          avatar: `https://robohash.org/${encodeURIComponent(model.id)}.png?size=200x200&set=set1`,
          personality: model.description || `AI model: ${model.id}`,
          status: contextLength ? `Context: ${contextLength.toLocaleString()} tokens` : 'Ready to chat',
          apiModel: model.id,
          systemPrompt: `You are ${model.name || model.id}. ${model.description || 'Be helpful and informative.'}`,
          lastMessage: 'Ready to assist you!',
          provider: 'openrouter',
          isOnline: true,
          lastSeen: new Date().toISOString(),
          pricing: promptPrice > 0 || completionPrice > 0 ? {
            prompt: promptPrice,
            completion: completionPrice
          } : null,
          contextLength: contextLength,
          topProvider: topProvider,
        };
      });
      
      // Merge with existing models without removing any, preserving existing IDs
      // to keep sidebar conversations intact. Avoid duplicates by apiModel.
      const existing = get().aiModels || [];
      const existingByApiModel = new Map(
        existing
          .filter(m => !!m.apiModel)
          .map(m => [m.apiModel, m])
      );
      const appended = openRouterModels.filter(m => !existingByApiModel.has(m.apiModel));
      set({ 
        aiModels: [...existing, ...appended],
        openRouterModels,
        isLoadingModels: false 
      });
      
    } catch (error) {
      console.error('Error fetching OpenRouter models:', error);
      set({ 
        modelsError: error.message,
        isLoadingModels: false 
      });
    }
  },
  
  setActiveConversation: (conversationId) => {
    set({ activeConversationId: conversationId });
    
    // Mark messages as read
    const conversations = get().conversations.map(conv => 
      conv.id === conversationId ? { ...conv, unread: 0 } : conv
    );
    set({ conversations });
  },
  
  createConversation: (modelId) => {
    const model = get().aiModels.find(m => m.id === modelId);
    if (!model) return;
    
    const existingConv = get().conversations.find(c => c.modelId === modelId);
    if (existingConv) {
      get().setActiveConversation(existingConv.id);
      return;
    }
    
    const conversation = {
      id: uuidv4(),
      modelId,
      lastMessage: 'New conversation',
      timestamp: new Date().toISOString(),
      unread: 0,
      extraModelIds: [],
    };
    
    set(state => ({
      conversations: [conversation, ...state.conversations],
      activeConversationId: conversation.id,
    }));
  },
  
  removeConversation: (conversationId) => {
    set(state => {
      const remainingConversations = state.conversations.filter(conv => conv.id !== conversationId);
      const { [conversationId]: _removedMessages, ...remainingMessages } = state.messages;

      let newActiveId = state.activeConversationId;
      if (state.activeConversationId === conversationId) {
        newActiveId = remainingConversations.length > 0 ? remainingConversations[0].id : null;
      }

      return {
        conversations: remainingConversations,
        messages: remainingMessages,
        activeConversationId: newActiveId,
      };
    });
  },

  addExtraModelToConversation: (conversationId, modelId) => {
    set(state => {
      const conversations = state.conversations.map(conv => {
        if (conv.id !== conversationId) return conv;
        if (conv.modelId === modelId) return conv;
        const existing = conv.extraModelIds || [];
        if (existing.includes(modelId)) return conv;
        if (existing.length >= 2) return conv;
        return {
          ...conv,
          extraModelIds: [...existing, modelId],
        };
      });

      return { conversations };
    });
  },

  removeExtraModelFromConversation: (conversationId, modelId) => {
    set(state => ({
      conversations: state.conversations.map(conv => {
        if (conv.id !== conversationId) return conv;
        const existing = conv.extraModelIds || [];
        if (!existing.includes(modelId)) return conv;
        return {
          ...conv,
          extraModelIds: existing.filter(id => id !== modelId),
        };
      }),
    }));
  },

  sendMessage: async (content) => {
    const { activeConversationId, conversations, messages, apiSettings, userProfile } = get();
    if (!activeConversationId || !content.trim()) return;
    
    const conversation = conversations.find(c => c.id === activeConversationId);
    if (!conversation) return;
    
    const model = get().aiModels.find(m => m.id === conversation.modelId);
    if (!model) return;

    const extraModelIds = Array.isArray(conversation.extraModelIds) ? conversation.extraModelIds : [];
    const extraModels = extraModelIds
      .map(id => get().aiModels.find(m => m.id === id))
      .filter(Boolean);
    const targetModels = [model, ...extraModels].filter((candidate, index, array) =>
      candidate && array.findIndex(other => other.id === candidate.id) === index
    );
    
    const userProfileContext = formatUserProfileAsSystemContext(userProfile);

    const runSearchFlow = async (query) => {
      const trimmedQuery = query.trim();
      if (!trimmedQuery) {
        return;
      }

      const searchingMsg = {
        id: uuidv4(),
        content: 'Searching the web...\n',
        sender: 'ai',
        modelId: model.id,
        timestamp: new Date().toISOString(),
        isTyping: true,
      };

      set(state => ({
        messages: {
          ...state.messages,
          [activeConversationId]: [
            ...(state.messages[activeConversationId] || []),
            searchingMsg,
          ],
        },
      }));

      try {
        const data = await fetchSearxResults(trimmedQuery, apiSettings.searchUrl);
        const results = Array.isArray(data.results) ? data.results : [];

        if (results.length === 0) {
          set(state => ({
            messages: {
              ...state.messages,
              [activeConversationId]: state.messages[activeConversationId].map(msg =>
                msg.id === searchingMsg.id
                  ? { ...msg, content: `No web results found for "${trimmedQuery}".`, isTyping: false }
                  : msg
              ),
            },
          }));
          return;
        }

        if (apiSettings.provider !== 'openrouter' || !apiSettings.openrouterApiKey) {
          throw new Error('OpenRouter not configured. Set OpenRouter as the provider with a valid API key to enable web search summaries.');
        }

        const top = results.slice(0, 5);
        const contextLines = top.map((r, i) => `(${i + 1}) ${r.title || r.url}\nURL: ${r.url}\n${r.content ? r.content.slice(0, 300) : ''}`).join('\n\n');

        const answer = await callOpenRouterWithContext(
          trimmedQuery,
          contextLines,
          model,
          apiSettings.openrouterApiKey,
          userProfileContext
        );

        const summary = shortenSummary(answer) || 'No summary available.';

        const formattedResults = top.map((r, i) => {
          const title = r.title || r.url || `Result ${i + 1}`;
          const url = r.url || '#';
          const snippet = (r.content || r.description || '').trim();
          const truncatedSnippet = snippet ? snippet.slice(0, 280) + (snippet.length > 280 ? '…' : '') : 'No preview available.';
          const thumbnail = r.img_src || r.thumbnail || r.image || null;
          return {
            title,
            url,
            snippet: truncatedSnippet,
            thumbnail,
            index: i + 1,
          };
        });

        set(state => ({
          messages: {
            ...state.messages,
            [activeConversationId]: state.messages[activeConversationId].map(msg =>
              msg.id === searchingMsg.id
                ? { 
                    ...msg, 
                    content: summary,
                    type: 'search_results',
                    searchResults: formattedResults,
                    searchQuery: trimmedQuery,
                    isTyping: false 
                  }
                : msg
            ),
          },
          conversations: state.conversations.map(conv =>
            conv.id === activeConversationId
              ? { ...conv, lastMessage: `Search: ${trimmedQuery}`, timestamp: new Date().toISOString() }
              : conv
          ),
        }));
      } catch (error) {
        console.error('Web search error:', error);
        const friendly = error.message || 'Unknown error';
        set(state => ({
          messages: {
            ...state.messages,
            [activeConversationId]: state.messages[activeConversationId].map(msg =>
              msg.id === searchingMsg.id
                ? { 
                    ...msg, 
                    content: `Sorry, web search failed: ${friendly}`, 
                    type: undefined,
                    searchResults: undefined,
                    searchQuery: trimmedQuery,
                    isTyping: false 
                  }
                : msg
            ),
          },
        }));
      }
    };

    const runImageSearchFlow = async (query) => {
      const trimmedQuery = query.trim();
      if (!trimmedQuery) {
        return;
      }

      const searchingMsg = {
        id: uuidv4(),
        content: 'Searching for images...\n',
        sender: 'ai',
        modelId: model.id,
        timestamp: new Date().toISOString(),
        isTyping: true,
      };

      set(state => ({
        messages: {
          ...state.messages,
          [activeConversationId]: [
            ...(state.messages[activeConversationId] || []),
            searchingMsg,
          ],
        },
      }));

      try {
        const data = await fetchSearxResults(trimmedQuery, apiSettings.searchUrl, {
          categories: 'images',
          engines: 'google_images,bing_images,duckduckgo_images',
        });

        const results = Array.isArray(data.results) ? data.results : [];
        const top = results
          .filter(r => r?.img_src || r?.thumbnail || r?.url)
          .slice(0, 12);

        if (top.length === 0) {
          set(state => ({
            messages: {
              ...state.messages,
              [activeConversationId]: state.messages[activeConversationId].map(msg =>
                msg.id === searchingMsg.id
                  ? {
                      ...msg,
                      content: `No image results found for "${trimmedQuery}".`,
                      type: 'image_search_results',
                      searchResults: [],
                      searchQuery: trimmedQuery,
                      isTyping: false,
                    }
                  : msg
              ),
            },
          }));
          return;
        }

        const formattedResults = top.map((r, i) => {
          const imageUrl = r.img_src || r.thumbnail || r.url;
          if (!imageUrl) {
            return null;
          }

          const pageUrl = r.url || r.source || imageUrl;
          let source = r.source || '';
          if (!source && pageUrl) {
            try {
              const hostname = new URL(pageUrl).hostname.replace(/^www\./i, '');
              source = hostname;
            } catch (error) {
              source = '';
            }
          }

          return {
            title: r.title || `Image ${i + 1}`,
            url: pageUrl,
            imageUrl,
            thumbnail: r.thumbnail || imageUrl,
            source,
            index: i + 1,
          };
        }).filter(Boolean);

        set(state => ({
          messages: {
            ...state.messages,
            [activeConversationId]: state.messages[activeConversationId].map(msg =>
              msg.id === searchingMsg.id
                ? {
                    ...msg,
                    content: `Top image results for "${trimmedQuery}"`,
                    type: 'image_search_results',
                    searchResults: formattedResults,
                    searchQuery: trimmedQuery,
                    isTyping: false,
                  }
                : msg
            ),
          },
          conversations: state.conversations.map(conv =>
            conv.id === activeConversationId
              ? { ...conv, lastMessage: `Image search: ${trimmedQuery}`, timestamp: new Date().toISOString() }
              : conv
          ),
        }));
      } catch (error) {
        console.error('Image search error:', error);
        const friendly = error.message || 'Unknown error';
        set(state => ({
          messages: {
            ...state.messages,
            [activeConversationId]: state.messages[activeConversationId].map(msg =>
              msg.id === searchingMsg.id
                ? {
                    ...msg,
                    content: `Image search failed: ${friendly}`,
                    type: 'image_search_results',
                    searchResults: [],
                    searchQuery: trimmedQuery,
                    isTyping: false,
                  }
                : msg
            ),
          },
        }));
      }
    };

    // Prepare normalized content
    const lowerContent = content.toLowerCase();
    const imageSearchQuery = extractImageSearchQuery(content);
    
    // Check if this is a web search command first
    const webCmdMatch = content.trim().match(/^\s*(?:\/web|\/search)\s+(.+)/i);
    if (webCmdMatch) {
      const query = webCmdMatch[1].trim();

      const userMessage = {
        id: uuidv4(),
        content,
        sender: 'user',
        timestamp: new Date().toISOString(),
      };

      set(state => ({
        messages: {
          ...state.messages,
          [activeConversationId]: [
            ...(state.messages[activeConversationId] || []),
            userMessage,
          ],
        },
        conversations: state.conversations.map(conv =>
          conv.id === activeConversationId
            ? { ...conv, lastMessage: content, timestamp: userMessage.timestamp }
            : conv
        ),
      }));

      await runSearchFlow(query);
      return;
    }

    // Auto web search for time-sensitive queries
    const autoWebRegex = /(\b(latest|news|today|current|recent|update|updates|breaking|headline|score|scores|weather|price|prices|market|trend|trending)\b|\b(did|is)\b.*\b(die|passed away|dead)\b)/i;
    const shouldAutoWebSearch = autoWebRegex.test(lowerContent);
    if (shouldAutoWebSearch) {
      const query = content.trim();
      const userMessage = {
        id: uuidv4(),
        content,
        sender: 'user',
        timestamp: new Date().toISOString(),
      };

      set(state => ({
        messages: {
          ...state.messages,
          [activeConversationId]: [
            ...(state.messages[activeConversationId] || []),
            userMessage,
          ],
        },
        conversations: state.conversations.map(conv =>
          conv.id === activeConversationId
            ? { ...conv, lastMessage: content, timestamp: userMessage.timestamp }
            : conv
        ),
      }));
      await runSearchFlow(query);
      return;
    }

    if (imageSearchQuery) {
      const query = imageSearchQuery.trim();
      if (query) {
        const userMessage = {
          id: uuidv4(),
          content,
          sender: 'user',
          timestamp: new Date().toISOString(),
        };

        set(state => ({
          messages: {
            ...state.messages,
            [activeConversationId]: [
              ...(state.messages[activeConversationId] || []),
              userMessage,
            ],
          },
          conversations: state.conversations.map(conv =>
            conv.id === activeConversationId
              ? { ...conv, lastMessage: content, timestamp: userMessage.timestamp }
              : conv
          ),
        }));

        await runImageSearchFlow(query);
      }
      return;
    }

    // Check if this is an image generation request
    const hasImageCommand = lowerContent.startsWith('/img ') || lowerContent.startsWith('/image ') || lowerContent.startsWith('!img ') || lowerContent.startsWith('!image ');
    const imageKeywords = [
      'generate image', 'create image', 'make an image', 'draw', 'picture of', 'image of', 
      'generate a picture', 'create a picture', 'make a picture', 'show me', 'show an image',
      'show a picture', 'show a photo', 'photo of', 'photograph of', 'draw me', 'create a photo',
      'generate a photo', 'make a photo', 'image', 'picture', 'photo', 'drawing', 'illustration',
      'visual', 'depiction', 'render', 'sketch', 'portrait', 'graphic', 'painting', 'art'
    ];
    
    // Check for explicit image keywords
    const hasImageKeywords = imageKeywords.some(keyword => lowerContent.includes(keyword));
    
    // Check if message seems like an image request (short messages with common patterns)
    const startsWithExplicitVisual = /^(show|draw|paint|illustrate|sketch|display|render)/i.test(lowerContent);
    const startsWithGeneralCreate = /^(generate|create|make|give me|i want|can i see|i need|i'd like)/i.test(lowerContent);
    const isQuestion = /^(how|what|why|when|where|who|explain|tell|describe|can you|could you)/i.test(lowerContent);
    const isShortMessage = lowerContent.length < 100;
    const isVeryShortSubject = !/[?.!]/.test(lowerContent) && lowerContent.trim().split(/\s+/).length <= 6 && !isQuestion;
    const containsVisualLanguage = /(image|picture|photo|drawing|illustration|visual|depiction|art|sketch|render|portrait|graphic|painting)/i.test(lowerContent);
    
    const isLikelyImageRequest = (
      (startsWithExplicitVisual && isShortMessage && !isQuestion) ||
      (startsWithGeneralCreate && containsVisualLanguage && isShortMessage && !isQuestion) ||
      (isVeryShortSubject && containsVisualLanguage)
    );
    
    // Only treat as image request when user explicitly asks for an image
    // via command, clear image-related keywords, or likely phrasing.
    // Do NOT trigger on very short generic messages like "hi".
    const isImageRequest = (!imageSearchQuery) && (hasImageCommand || hasImageKeywords || isLikelyImageRequest);
    
    const userMessage = {
      id: uuidv4(),
      content,
      sender: 'user',
      timestamp: new Date().toISOString(),
    };
    
    // Add user message
    set(state => ({
      messages: {
        ...state.messages,
        [activeConversationId]: [
          ...(state.messages[activeConversationId] || []),
          userMessage,
        ],
      },
      conversations: state.conversations.map(conv =>
        conv.id === activeConversationId
          ? { ...conv, lastMessage: content, timestamp: userMessage.timestamp }
          : conv
      ),
    }));
    
    // Handle image generation
    if (isImageRequest) {
      // Check if we have a valid API key for image generation (OpenAI key takes priority)
      const imageApiKey = apiSettings.openaiApiKey || apiSettings.openrouterApiKey;
      
      if (!imageApiKey) {
        // Show error message about needing API key
        const errorMessage = {
          id: uuidv4(),
          content: "I can't generate images without an API key. Please go to Settings > Image Generation and configure either an OpenAI API key (recommended) or ensure your OpenRouter API key has credits.",
          sender: 'ai',
          modelId: model.id,
          timestamp: new Date().toISOString(),
          isTyping: false,
        };
        
        set(state => ({
          messages: {
            ...state.messages,
            [activeConversationId]: [
              ...(state.messages[activeConversationId] || []),
              errorMessage,
            ],
          },
        }));
        return;
      }
      // Simulate AI response for image generation
      const aiMessage = {
        id: uuidv4(),
        content: 'Generating image...',
        sender: 'ai',
        modelId: model.id,
        timestamp: new Date().toISOString(),
        isTyping: true,
        isGeneratingImage: true,
      };
      
      set(state => ({
        messages: {
          ...state.messages,
          [activeConversationId]: [
            ...(state.messages[activeConversationId] || []),
            aiMessage,
          ],
        },
      }));
      
      try {
        // Extract prompt from user message (remove image generation keywords and commands)
        let imagePrompt = content;
        if (hasImageCommand) {
          imagePrompt = imagePrompt.replace(/^\s*(?:\/img|\/image|!img|!image)\s+/i, '');
        }
        // Clean up common phrases at the start
        imagePrompt = imagePrompt.replace(/^(generate|create|make|draw|show me|show|give me|i want|can i see|i need)\s+(an?\s+)?(image|picture|photo|drawing|illustration|visual|depiction)?\s+(of\s+)?/i, '');
        // Clean up common phrases in the middle
        imagePrompt = imagePrompt.replace(/\s+(image|picture|photo|drawing|illustration|visual|depiction)\s+(of|with|in|on)\s+/gi, ' ');
        // Clean up trailing phrases
        imagePrompt = imagePrompt.replace(/\s+(image|picture|photo|drawing|illustration|visual|depiction)[\s\.]*$/i, '');
        imagePrompt = imagePrompt.trim();
        if (!imagePrompt) {
          imagePrompt = content; // Fallback to original if cleanup removed everything
        }
        
        // Use OpenAI API key if available, otherwise use OpenRouter key
        const imageApiKey = apiSettings.openaiApiKey || apiSettings.openrouterApiKey;
        const useOpenAI = !!apiSettings.openaiApiKey;
        
        // Handle default model selection
        let modelToUse = apiSettings.imageGenerationModel;
        if (modelToUse === 'default' || !modelToUse) {
          modelToUse = 'dall-e-3'; // Use dall-e-3 as default fallback
        }
        
        const imageUrl = await generateImage(imagePrompt, modelToUse, imageApiKey, useOpenAI);
        
        // Update AI message with image
        set(state => ({
          messages: {
            ...state.messages,
            [activeConversationId]: state.messages[activeConversationId].map(msg =>
              msg.id === aiMessage.id
                ? { 
                    ...msg, 
                    content: `Here's the generated image:\n\n![Generated Image](${imageUrl})`,
                    isTyping: false,
                    isGeneratingImage: false,
                    imageUrl: imageUrl
                  }
                : msg
            ),
          },
          conversations: state.conversations.map(conv =>
            conv.id === activeConversationId
              ? { ...conv, lastMessage: 'Generated an image', timestamp: new Date().toISOString() }
              : conv
          ),
        }));
      } catch (error) {
        console.error('Error generating image:', error);
        
        const friendlyError = error.message || 'Image generation failed. Please verify your API key and selected model.';
        set(state => ({
          messages: {
            ...state.messages,
            [activeConversationId]: state.messages[activeConversationId].map(msg =>
              msg.id === aiMessage.id
                ? { 
                    ...msg, 
                    content: friendlyError, 
                    isTyping: false,
                    isGeneratingImage: false
                  }
                : msg
            ),
          },
        }));
      }
      return;
    }
    
    // Regular text response (single or multi-model)
    const responseGroupId = targetModels.length > 1 ? uuidv4() : null;

    const aiMessages = targetModels.map(targetModel => ({
      id: uuidv4(),
      content: '',
      sender: 'ai',
      modelId: targetModel.id,
      timestamp: new Date().toISOString(),
      isTyping: true,
      responseGroupId,
    }));

    set(state => ({
      messages: {
        ...state.messages,
        [activeConversationId]: [
          ...(state.messages[activeConversationId] || []),
          ...aiMessages,
        ],
      },
    }));

    const finalizeResponse = (messageId, responseContent, isPrimary) => {
      set(state => ({
        messages: {
          ...state.messages,
          [activeConversationId]: state.messages[activeConversationId].map(msg =>
            msg.id === messageId
              ? { ...msg, content: responseContent, isTyping: false }
              : msg
          ),
        },
        conversations: isPrimary
          ? state.conversations.map(conv =>
              conv.id === activeConversationId
                ? { ...conv, lastMessage: responseContent, timestamp: new Date().toISOString() }
                : conv
            )
          : state.conversations,
      }));
    };

    const processModelResponse = async (targetModel, messageId, isPrimary) => {
      try {
        const effectiveProvider = (targetModel.provider || apiSettings.provider || '').toLowerCase();
        let response = '';

        // Build last 20-message history (user/assistant only, no typing)
        const rawHistory = (get().messages[activeConversationId] || [])
          .filter(m => !m.isTyping && typeof m.content === 'string' && m.content.trim().length > 0)
          .slice(-20)
          .map(m => ({
            role: m.sender === 'user' ? 'user' : 'assistant',
            content: m.content,
          }));

        if (effectiveProvider === 'openrouter') {
          if (!apiSettings.openrouterApiKey) {
            throw new Error('OpenRouter API key not configured');
          }
          response = await callOpenRouter(content, targetModel, apiSettings.openrouterApiKey, userProfileContext, rawHistory);
        } else if (effectiveProvider === 'n8n') {
          if (!apiSettings.n8nWebhookUrl) {
            throw new Error('n8n webhook URL not configured');
          }
          response = await callN8nWebhook(content, targetModel, apiSettings.n8nWebhookUrl, userProfile, rawHistory);
        } else if (effectiveProvider === 'lmstudio') {
          if (!apiSettings.lmstudioUrl) {
            throw new Error('LM Studio URL not configured');
          }
          response = await callLMStudio(content, targetModel, apiSettings.lmstudioUrl, userProfileContext, rawHistory);
        } else if (apiSettings.provider === 'openrouter' && apiSettings.openrouterApiKey) {
          response = await callOpenRouter(content, targetModel, apiSettings.openrouterApiKey, userProfileContext, rawHistory);
        } else if (apiSettings.provider === 'n8n' && apiSettings.n8nWebhookUrl) {
          response = await callN8nWebhook(content, targetModel, apiSettings.n8nWebhookUrl, userProfile, rawHistory);
        } else if (apiSettings.provider === 'lmstudio' && apiSettings.lmstudioUrl) {
          response = await callLMStudio(content, targetModel, apiSettings.lmstudioUrl, userProfileContext, rawHistory);
        } else {
          response = generateMockResponse(content, targetModel);
        }

        finalizeResponse(messageId, response, isPrimary);
      } catch (error) {
        console.error('Error getting AI response:', error);
        const friendlyError = error?.message
          ? `Error: ${error.message}`
          : "Sorry, I couldn't process that request. Please check your API settings.";
        finalizeResponse(messageId, friendlyError, isPrimary);
      }
    };

    await Promise.all(
      targetModels.map((targetModel, index) =>
        processModelResponse(targetModel, aiMessages[index].id, index === 0)
      )
    );
  },
  
  updateApiSettings: (settings) => {
    set(state => ({
      apiSettings: { ...state.apiSettings, ...settings },
    }));
  },
  
  updateAIModel: (modelId, updates) => {
    set(state => ({
      aiModels: state.aiModels.map(model =>
        model.id === modelId ? { ...model, ...updates } : model
      ),
    }));
  },
  
  checkApiConnection: async () => {
    const { apiSettings } = get();
    set(state => ({
      apiConnectionStatus: {
        ...state.apiConnectionStatus,
        status: 'checking',
        error: null,
      },
    }));
    
    try {
      let isConnected = false;
      let error = null;
      
      if (apiSettings.provider === 'openrouter' && apiSettings.openrouterApiKey) {
        // Test OpenRouter connection
        try {
          const response = await fetch('https://openrouter.ai/api/v1/models', {
            headers: {
              'Authorization': `Bearer ${apiSettings.openrouterApiKey}`,
              'HTTP-Referer': window.location.origin,
              'X-Title': 'AI Messenger'
            },
          });
          isConnected = response.ok;
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            error = errorData.error?.message || `HTTP ${response.status}`;
          }
        } catch (err) {
          error = err.message;
        }
      } else if (apiSettings.provider === 'lmstudio' && apiSettings.lmstudioUrl) {
        // Test LM Studio connection
        try {
          const response = await fetch(`${apiSettings.lmstudioUrl}/models`, {
            method: 'GET',
          });
          isConnected = response.ok;
          if (!response.ok) {
            error = `HTTP ${response.status}`;
          }
        } catch (err) {
          error = err.message || 'Connection failed';
        }
      } else if (apiSettings.provider === 'n8n' && apiSettings.n8nWebhookUrl) {
        // Test n8n webhook (just check if URL is reachable)
        try {
          const response = await fetch(apiSettings.n8nWebhookUrl, {
            method: 'OPTIONS',
          });
          isConnected = true; // If we can reach it, consider it connected
        } catch (err) {
          error = err.message || 'Webhook unreachable';
        }
      } else {
        error = 'No API key or URL configured';
      }
      
      set(state => ({
        apiConnectionStatus: {
          status: isConnected ? 'connected' : 'disconnected',
          lastChecked: new Date().toISOString(),
          error: error,
        },
      }));
    } catch (error) {
      set(state => ({
        apiConnectionStatus: {
          status: 'disconnected',
          lastChecked: new Date().toISOString(),
          error: error.message || 'Connection test failed',
        },
      }));
    }
  },
  
  checkImageApiConnection: async () => {
    const { apiSettings } = get();
    set(state => ({
      imageApiConnectionStatus: {
        ...state.imageApiConnectionStatus,
        status: 'checking',
        error: null,
      },
    }));
    
    try {
      const hasOpenAIKey = !!apiSettings.openaiApiKey;
      const imageApiKey = apiSettings.openaiApiKey || apiSettings.openrouterApiKey;
      let isConnected = false;
      let error = null;
      
      if (!imageApiKey) {
        set(state => ({
          imageApiConnectionStatus: {
            status: 'not_configured',
            lastChecked: new Date().toISOString(),
            error: 'OpenAI image API key not set',
          },
        }));
        return;
      }

      if (hasOpenAIKey) {
        try {
          const response = await fetch('https://api.openai.com/v1/models', {
            headers: {
              'Authorization': `Bearer ${apiSettings.openaiApiKey}`,
              'Content-Type': 'application/json',
            },
          });
          isConnected = response.ok;
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            error = errorData.error?.message || `HTTP ${response.status}`;
          }
        } catch (err) {
          error = err.message || 'OpenAI connection failed';
        }
      } else {
        // Fallback to OpenRouter connectivity (legacy behavior)
        try {
          const response = await fetch('https://openrouter.ai/api/v1/models', {
            headers: {
              'Authorization': `Bearer ${apiSettings.openrouterApiKey}`,
              'HTTP-Referer': window.location.origin,
              'X-Title': 'AI Messenger'
            },
          });
          isConnected = response.ok;
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            error = errorData.error?.message || `HTTP ${response.status}`;
          }
        } catch (err) {
          error = err.message || 'OpenRouter connection failed';
        }
      }
      
      set(state => ({
        imageApiConnectionStatus: {
          status: isConnected ? 'connected' : 'disconnected',
          lastChecked: new Date().toISOString(),
          error: error,
        },
      }));
    } catch (error) {
      set(state => ({
        imageApiConnectionStatus: {
          status: 'disconnected',
          lastChecked: new Date().toISOString(),
          error: error.message || 'Connection test failed',
        },
      }));
    }
  },
  
  checkOcrApiConnection: async () => {
    const { apiSettings } = get();
    set(state => ({
      ocrApiConnectionStatus: {
        ...state.ocrApiConnectionStatus,
        status: 'checking',
        error: null,
      },
    }));
    
    try {
      // Use OpenRouter only
      const ocrApiKey = apiSettings.openrouterApiKey;
      let isConnected = false;
      let error = null;
      
      if (!ocrApiKey) {
        set(state => ({
          ocrApiConnectionStatus: {
            status: 'not_configured',
            lastChecked: new Date().toISOString(),
            error: 'OpenRouter API key not set',
          },
        }));
        return;
      } else {
        // Test OpenRouter connectivity (vision support depends on selected model at inference time)
        try {
          const response = await fetch('https://openrouter.ai/api/v1/models', {
            headers: {
              'Authorization': `Bearer ${ocrApiKey}`,
              'HTTP-Referer': window.location.origin,
              'X-Title': 'AI Messenger'
            },
          });
          isConnected = response.ok;
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            error = errorData.error?.message || `HTTP ${response.status}`;
          }
        } catch (err) {
          error = err.message || 'Connection failed';
        }
      }
      
      set(state => ({
        ocrApiConnectionStatus: {
          status: isConnected ? 'connected' : 'disconnected',
          lastChecked: new Date().toISOString(),
          error: error,
        },
      }));
    } catch (error) {
      set(state => ({
        ocrApiConnectionStatus: {
          status: 'disconnected',
          lastChecked: new Date().toISOString(),
          error: error.message || 'Connection test failed',
        },
      }));
    }
  },

  // OCR: analyze an uploaded image using the configured OCR model (OpenRouter-based)
  analyzeDocument: async (file) => {
    const { activeConversationId, conversations, apiSettings } = get();
    if (!activeConversationId || !file) return;
    const conversation = conversations.find(c => c.id === activeConversationId);
    if (!conversation) return;
    const model = get().aiModels.find(m => m.id === conversation.modelId);
    if (!model) return;

    if (!apiSettings.openrouterApiKey) {
      // Surface an AI message explaining configuration needed
      const errorMsg = {
        id: uuidv4(),
        content: 'OCR is not configured. Please set your OpenRouter API key in Settings > OCR Model.',
        sender: 'ai',
        modelId: model.id,
        timestamp: new Date().toISOString(),
        isTyping: false,
      };
      set(state => ({
        messages: {
          ...state.messages,
          [activeConversationId]: [
            ...(state.messages[activeConversationId] || []),
            errorMsg,
          ],
        },
      }));
      return;
    }

    const userMsg = {
      id: uuidv4(),
      content: `Uploaded image for OCR: ${file.name}`,
      sender: 'user',
      timestamp: new Date().toISOString(),
    };
    const aiTyping = {
      id: uuidv4(),
      content: 'Analyzing the document...',
      sender: 'ai',
      modelId: model.id,
      timestamp: new Date().toISOString(),
      isTyping: true,
    };

    set(state => ({
      messages: {
        ...state.messages,
        [activeConversationId]: [
          ...(state.messages[activeConversationId] || []),
          userMsg,
          aiTyping,
        ],
      },
      conversations: state.conversations.map(conv =>
        conv.id === activeConversationId
          ? { ...conv, lastMessage: userMsg.content, timestamp: userMsg.timestamp }
          : conv
      ),
    }));

    try {
      const dataUrl = await fileToDataUrl(file);
      const ocrModel = get().apiSettings.ocrModel || 'gpt-4o';
      const result = await callOpenRouterVision(dataUrl, ocrModel, get().apiSettings.openrouterApiKey);
      set(state => ({
        messages: {
          ...state.messages,
          [activeConversationId]: state.messages[activeConversationId].map(msg =>
            msg.id === aiTyping.id ? { ...msg, content: result, isTyping: false } : msg
          ),
        },
        conversations: state.conversations.map(conv =>
          conv.id === activeConversationId
            ? { ...conv, lastMessage: result, timestamp: new Date().toISOString() }
            : conv
        ),
      }));
    } catch (error) {
      const friendly = error?.message || 'OCR failed. Please try another image.';
      set(state => ({
        messages: {
          ...state.messages,
          [activeConversationId]: state.messages[activeConversationId].map(msg =>
            msg.id === aiTyping.id ? { ...msg, content: friendly, isTyping: false } : msg
          ),
        },
      }));
    }
  },
}));

// API Helper Functions
async function callOpenRouter(message, model, apiKey, userProfileContext, history) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'AI Messenger'
    },
    body: JSON.stringify({
      model: model.apiModel || 'openai/gpt-3.5-turbo',
      messages: [
        { role: 'system', content: model.systemPrompt || model.personality },
        ...(userProfileContext ? [{ role: 'system', content: userProfileContext }] : []),
        ...Array.isArray(history) ? history : [],
        { role: 'user', content: message }
      ],
    }),
  });
  
  const data = await response.json();
  return data.choices[0].message.content;
}

async function callOpenRouterWithContext(message, context, model, apiKey, userProfileContext) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'AI Messenger'
    },
    body: JSON.stringify({
      model: model.apiModel || 'openai/gpt-3.5-turbo',
      messages: [
        { role: 'system', content: (model.systemPrompt || model.personality || 'You are a helpful assistant.') + '\nUse the provided search results as evidence. Cite sources at the end.' },
        ...(userProfileContext ? [{ role: 'system', content: userProfileContext }] : []),
        { role: 'system', content: `Search Results Context (may be incomplete):\n\n${context}` },
        { role: 'user', content: message }
      ],
    }),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errMessage = data.error?.message || data.message || `OpenRouter request failed (HTTP ${response.status})`;
    throw new Error(errMessage);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenRouter returned an empty response for this query. Try a different model or check your API usage limits.');
  }

  return content;
}

async function fetchSearxResults(query, searchUrl, options = {}) {
  const base = (searchUrl || '').trim();
  if (!base) {
    throw new Error('Search URL not configured in Settings');
  }

  const normalized = base.endsWith('/') ? base : `${base}/`;
  const {
    categories = 'general',
    engines = 'google,bing,duckduckgo',
    language = 'en-US',
    safe = '1',
    format = 'json',
    extraParams = {},
  } = options || {};

  const params = new URLSearchParams({
    format,
    q: query,
    language,
    safe,
  });

  if (categories) {
    params.set('categories', categories);
  }

  if (engines) {
    params.set('engines', engines);
  }

  Object.entries(extraParams || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  });

  const searchEndpoint = `${normalized}search?${params.toString()}`;

  try {
    const response = await fetch(searchEndpoint, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Search HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.warn('Direct SearXNG request failed, trying proxy', error);
    const proxyUrl = `/api/search-proxy?target=${encodeURIComponent(searchEndpoint)}`;
    const proxyResponse = await fetch(proxyUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!proxyResponse.ok) {
      const errorData = await proxyResponse.json().catch(() => ({}));
      throw new Error(errorData.error || `Proxy HTTP ${proxyResponse.status}`);
    }

    return await proxyResponse.json();
  }
}

async function callN8nWebhook(message, model, webhookUrl, userProfile) {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      model: model.name,
      personality: model.personality,
      userProfile,
      // Provide history to webhook; implement handling on the n8n side as needed
      // The history format: [{ role: 'user'|'assistant', content: string }]
      history: Array.isArray(arguments[4]) ? arguments[4] : undefined,
    }),
  });
  
  const data = await response.json();
  return data.response || data.message || 'No response from webhook';
}

async function callLMStudio(message, model, baseUrl, userProfileContext, history) {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: model.systemPrompt || model.personality },
        ...(userProfileContext ? [{ role: 'system', content: userProfileContext }] : []),
        ...Array.isArray(history) ? history : [],
        { role: 'user', content: message }
      ],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });
  
  const data = await response.json();
  return data.choices[0].message.content;
}

function generateMockResponse(message, model) {
  const responses = model.sampleResponses || [
    `That's an interesting point about "${message.slice(0, 30)}..."`,
    `I understand what you're saying. ${model.personality}`,
    `From my perspective as ${model.name}, I think...`,
    `Let me share my thoughts on that...`,
  ];
  
  return responses[Math.floor(Math.random() * responses.length)];
}

function formatUserProfileAsSystemContext(profile) {
  if (!profile || typeof profile !== 'object') return '';
  const name = profile.name || 'User';
  const email = profile.email || '';
  const hobbies = Array.isArray(profile.hobbies) ? profile.hobbies.filter(Boolean).join(', ') : '';
  const bio = profile.bio || '';
  const lines = [
    `User Profile Context:`,
    `- Name: ${name}`,
    email ? `- Email: ${email}` : null,
    hobbies ? `- Hobbies: ${hobbies}` : null,
    bio ? `- Bio: ${bio}` : null,
    `Use the user's name when addressing them naturally.`
  ].filter(Boolean);
  return lines.join('\n');
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (e) => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    } catch (err) {
      reject(err);
    }
  });
}

async function callOpenRouterVision(imageDataUrl, modelId, apiKey) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'AI Messenger'
    },
    body: JSON.stringify({
      model: modelId || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an OCR assistant. Extract readable text from the provided image and provide a concise summary. If relevant, list key fields found.'
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract text and summarize the document briefly.' },
            { type: 'image_url', image_url: imageDataUrl }
          ]
        }
      ]
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error?.message || `OpenRouter vision failed (HTTP ${response.status})`);
  }
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('No OCR content returned');
  return content;
}

// Image Generation Function
async function generateImage(prompt, modelType, apiKey, useOpenAI = false) {
  const desiredModel = !modelType || modelType === 'default' ? 'dall-e-3' : modelType;

  try {
    if (useOpenAI) {
      const openaiPayload = {
        model: desiredModel,
        prompt,
        n: 1,
        size: '1024x1024',
      };

      if (desiredModel === 'dall-e-3') {
        openaiPayload.quality = 'hd';
      }

      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(openaiPayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `OpenAI image generation failed (HTTP ${response.status})`);
      }

      const data = await response.json();
      const imageData = data.data?.[0];
      if (!imageData) {
        throw new Error('OpenAI returned no image data');
      }

      if (imageData.url) return imageData.url;
      if (imageData.b64_json) return `data:image/png;base64,${imageData.b64_json}`;

      throw new Error('OpenAI returned an unsupported image format');
    }

    // OpenRouter image generation
    const openRouterModelMap = {
      'dall-e-3': 'openai/dall-e-3',
      'nano-banana': 'stabilityai/stable-diffusion-xl-base-1.0',
    };
    const openRouterModel = openRouterModelMap[desiredModel] || desiredModel || 'openai/dall-e-3';

    const response = await fetch('https://openrouter.ai/api/v1/images', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'AI Messenger',
      },
      body: JSON.stringify({
        model: openRouterModel,
        prompt,
        size: '1024x1024',
        n: 1,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `OpenRouter image generation failed (HTTP ${response.status})`);
    }

    const data = await response.json();
    const imageData = data.data?.[0];
    if (!imageData) {
      throw new Error('OpenRouter returned no image data');
    }

    if (imageData.url) return imageData.url;
    if (imageData.b64_json) return `data:image/png;base64,${imageData.b64_json}`;

    throw new Error('OpenRouter returned an unsupported image format');
  } catch (error) {
    console.error('Image generation error:', error);
    throw error;
  }
}
