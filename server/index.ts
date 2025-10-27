import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { llm, messages } = req.body;

    if (!llm || !messages) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    let response: string;

    switch (llm.provider) {
      case 'openrouter':
        response = await handleOpenRouter(llm, messages);
        break;
      case 'n8n':
        response = await handleN8n(llm, messages);
        break;
      case 'lmstudio':
        response = await handleLMStudio(llm, messages);
        break;
      default:
        return res.status(400).json({ error: 'Invalid provider' });
    }

    res.json({ response });
  } catch (error) {
    console.error('Error in /api/chat:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// OpenRouter handler
async function handleOpenRouter(llm: any, messages: any[]): Promise<string> {
  const apiKey = llm.config.apiKey;
  const model = llm.config.model || 'openai/gpt-3.5-turbo';

  if (!apiKey) {
    throw new Error('OpenRouter API key not configured');
  }

  const chatMessages = [];

  // Add system prompt if configured
  if (llm.config.systemPrompt) {
    chatMessages.push({
      role: 'system',
      content: llm.config.systemPrompt,
    });
  }

  // Add conversation messages
  chatMessages.push(...messages);

  const response = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model,
      messages: chatMessages,
      temperature: llm.config.temperature || 0.7,
      max_tokens: llm.config.maxTokens || 2000,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'AI Messenger',
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data.choices[0].message.content;
}

// n8n webhook handler
async function handleN8n(llm: any, messages: any[]): Promise<string> {
  const webhookUrl = llm.config.webhookUrl;

  if (!webhookUrl) {
    throw new Error('n8n webhook URL not configured');
  }

  const lastMessage = messages[messages.length - 1];

  const payload = {
    message: lastMessage.content,
    systemPrompt: llm.config.systemPrompt,
    temperature: llm.config.temperature || 0.7,
    maxTokens: llm.config.maxTokens || 2000,
    conversationHistory: messages,
  };

  const response = await axios.post(webhookUrl, payload, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // n8n response format can vary, try to extract the message
  if (typeof response.data === 'string') {
    return response.data;
  } else if (response.data.response) {
    return response.data.response;
  } else if (response.data.message) {
    return response.data.message;
  } else if (response.data.output) {
    return response.data.output;
  } else {
    return JSON.stringify(response.data);
  }
}

// LM Studio handler
async function handleLMStudio(llm: any, messages: any[]): Promise<string> {
  const endpoint = llm.config.endpoint || 'http://localhost:1234/v1/chat/completions';

  const chatMessages = [];

  // Add system prompt if configured
  if (llm.config.systemPrompt) {
    chatMessages.push({
      role: 'system',
      content: llm.config.systemPrompt,
    });
  }

  // Add conversation messages
  chatMessages.push(...messages);

  const response = await axios.post(
    endpoint,
    {
      messages: chatMessages,
      temperature: llm.config.temperature || 0.7,
      max_tokens: llm.config.maxTokens || 2000,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data.choices[0].message.content;
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
