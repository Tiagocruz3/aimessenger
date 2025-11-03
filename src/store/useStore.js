import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { aiModels } from '../data/aiModels';

export const useStore = create((set, get) => ({
  // State
  aiModels: [],
  conversations: [],
  activeConversationId: null,
  messages: {},
  apiSettings: {
    provider: 'openrouter', // openrouter, n8n, lmstudio
    openrouterApiKey: '',
    openaiApiKey: '', // Separate OpenAI API key for image generation
    n8nWebhookUrl: '',
    lmstudioUrl: 'http://localhost:1234/v1',
    searchUrl: 'https://search.brainstormnodes.org/',
    imageGenerationModel: 'dall-e-3', // dall-e-3, nano-banana
    ocrModel: 'gpt-4o', // OpenAI OCR/Vision models
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
    };
    
    set(state => ({
      conversations: [conversation, ...state.conversations],
      activeConversationId: conversation.id,
    }));
  },
  
  sendMessage: async (content) => {
    const { activeConversationId, conversations, messages, apiSettings } = get();
    if (!activeConversationId || !content.trim()) return;
    
    const conversation = conversations.find(c => c.id === activeConversationId);
    if (!conversation) return;
    
    const model = get().aiModels.find(m => m.id === conversation.modelId);
    if (!model) return;
    
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
          apiSettings.openrouterApiKey
        );

        const sourcesMd = top.map((r, i) => `- [${r.title || r.url}](${r.url})`).join('\n') || '_No sources returned_';
        const finalContent = `${answer}\n\nSources:\n${sourcesMd}`;

        set(state => ({
          messages: {
            ...state.messages,
            [activeConversationId]: state.messages[activeConversationId].map(msg =>
              msg.id === searchingMsg.id
                ? { ...msg, content: finalContent, isTyping: false }
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
                ? { ...msg, content: `Sorry, web search failed: ${friendly}`, isTyping: false }
                : msg
            ),
          },
        }));
      }
    };

    // Prepare normalized content
    const lowerContent = content.toLowerCase();
    
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

    // Check if this is an image generation request
    const hasImageCommand = lowerContent.startsWith('/img ') || lowerContent.startsWith('/image ') || lowerContent.startsWith('!img ') || lowerContent.startsWith('!image ');
    const imageKeywords = [
      'generate image', 'create image', 'make an image', 'draw', 'picture of', 'image of', 
      'generate a picture', 'create a picture', 'make a picture', 'show me', 'show an image',
      'show a picture', 'show a photo', 'photo of', 'photograph of', 'draw me', 'create a photo',
      'generate a photo', 'make a photo', 'image', 'picture', 'photo', 'drawing', 'illustration',
      'visual', 'depiction', 'render', 'sketch', 'portrait', 'graphic'
    ];
    
    // Check for explicit image keywords
    const hasImageKeywords = imageKeywords.some(keyword => lowerContent.includes(keyword));
    
    // Check if message seems like an image request (short messages with common patterns)
    const startsWithImageRequest = /^(show|generate|create|make|draw|give me|i want|can i see|i need|i'd like|display)/i.test(lowerContent);
    const isQuestion = /^(how|what|why|when|where|who|explain|tell|describe|can you|could you)/i.test(lowerContent);
    const isShortMessage = lowerContent.length < 100;
    const isVeryShortSubject = !/[?.!]/.test(lowerContent) && lowerContent.trim().split(/\s+/).length <= 6 && !isQuestion;
    
    const isLikelyImageRequest = 
      startsWithImageRequest &&
      isShortMessage &&
      !isQuestion;
    
    // Only treat as image request when user explicitly asks for an image
    // via command, clear image-related keywords, or likely phrasing.
    // Do NOT trigger on very short generic messages like "hi".
    const isImageRequest = hasImageCommand || hasImageKeywords || isLikelyImageRequest;
    
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
    
    // Regular text response
    const aiMessage = {
      id: uuidv4(),
      content: '',
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
          aiMessage,
        ],
      },
    }));
    
    try {
      let response = '';
      
      if (apiSettings.provider === 'openrouter' && apiSettings.openrouterApiKey) {
        // Call OpenRouter API
        response = await callOpenRouter(content, model, apiSettings.openrouterApiKey);
      } else if (apiSettings.provider === 'n8n' && apiSettings.n8nWebhookUrl) {
        // Call n8n webhook
        response = await callN8nWebhook(content, model, apiSettings.n8nWebhookUrl);
      } else if (apiSettings.provider === 'lmstudio') {
        // Call LM Studio
        response = await callLMStudio(content, model, apiSettings.lmstudioUrl);
      } else {
        // Fallback to mock response
        response = generateMockResponse(content, model);
      }
      
      // Update AI message with response
      set(state => ({
        messages: {
          ...state.messages,
          [activeConversationId]: state.messages[activeConversationId].map(msg =>
            msg.id === aiMessage.id
              ? { ...msg, content: response, isTyping: false }
              : msg
          ),
        },
        conversations: state.conversations.map(conv =>
          conv.id === activeConversationId
            ? { ...conv, lastMessage: response, timestamp: new Date().toISOString() }
            : conv
        ),
      }));
    } catch (error) {
      console.error('Error getting AI response:', error);
      
      // Update with error message
      set(state => ({
        messages: {
          ...state.messages,
          [activeConversationId]: state.messages[activeConversationId].map(msg =>
            msg.id === aiMessage.id
              ? { ...msg, content: "Sorry, I couldn't process that request. Please check your API settings.", isTyping: false }
              : msg
          ),
        },
      }));
    }
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
      // Use OpenRouter only
      const imageApiKey = apiSettings.openrouterApiKey;
      let isConnected = false;
      let error = null;
      
      if (!imageApiKey) {
        set(state => ({
          imageApiConnectionStatus: {
            status: 'not_configured',
            lastChecked: new Date().toISOString(),
            error: 'OpenRouter API key not set',
          },
        }));
        return;
      } else {
        // Test OpenRouter connectivity (no direct image endpoint)
        try {
          const response = await fetch('https://openrouter.ai/api/v1/models', {
            headers: {
              'Authorization': `Bearer ${imageApiKey}`,
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
}));

// API Helper Functions
async function callOpenRouter(message, model, apiKey) {
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
        { role: 'user', content: message }
      ],
    }),
  });
  
  const data = await response.json();
  return data.choices[0].message.content;
}

async function callOpenRouterWithContext(message, context, model, apiKey) {
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
        { role: 'system', content: `Search Results Context (may be incomplete):\n\n${context}` },
        { role: 'user', content: message }
      ],
    }),
  });
  const data = await response.json();
  return data.choices[0].message.content;
}

async function fetchSearxResults(query, searchUrl) {
  const base = (searchUrl || '').trim();
  if (!base) {
    throw new Error('Search URL not configured in Settings');
  }

  const normalized = base.endsWith('/') ? base : `${base}/`;
  const searchEndpoint = `${normalized}search?format=json&q=${encodeURIComponent(query)}&language=en-US&safe=1&categories=general&engines=google,bing,duckduckgo`;

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

async function callN8nWebhook(message, model, webhookUrl) {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      model: model.name,
      personality: model.personality,
    }),
  });
  
  const data = await response.json();
  return data.response || data.message || 'No response from webhook';
}

async function callLMStudio(message, model, baseUrl) {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: model.systemPrompt || model.personality },
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
