# AI Messenger

A unique LLM messenger chat interface inspired by Facebook Messenger. Chat with AI models from various providers including OpenRouter, n8n webhooks, and LM Studio.

![AI Messenger](https://img.shields.io/badge/AI-Messenger-blue)

## Features

- **Facebook Messenger-style UI** - Familiar and intuitive chat interface
- **Multiple LLM Providers** - Support for OpenRouter API, n8n webhooks, and LM Studio
- **Persistent Chat History** - All conversations are saved locally
- **Multiple Conversations** - Chat with different AI models simultaneously
- **Customizable Settings** - Configure system prompts, temperature, and max tokens for each LLM
- **Real-time Messaging** - Smooth chat experience with loading indicators

## Supported LLM Providers

### 1. OpenRouter API
Access 100+ AI models through a single API:
- GPT-4, GPT-3.5
- Claude 3 (Opus, Sonnet, Haiku)
- Llama 2, Mistral, and more

### 2. n8n Webhook
Integrate with your custom n8n workflows:
- Connect to any AI service via n8n
- Custom preprocessing/postprocessing
- Advanced automation workflows

### 3. LM Studio
Use local AI models:
- Run models locally on your machine
- Complete privacy and control
- No API costs

## Installation

### Prerequisites

- Node.js 18+ and npm
- (Optional) OpenRouter API key
- (Optional) n8n instance with webhook
- (Optional) LM Studio running locally

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd aimessenger
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment (optional)**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` if you want to set default API keys (you can also configure per-LLM in the UI)

4. **Start the application**
   ```bash
   npm run dev
   ```

   This will start:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001

## Usage

### Adding Your First LLM

1. Click the **+** button in the top-right of the chat list
2. Fill in the LLM details:
   - **Name**: Give your LLM a friendly name (e.g., "GPT-4", "Claude")
   - **Avatar**: Optional emoji or text (e.g., "🤖", "AI")
   - **Provider**: Select from OpenRouter, n8n, or LM Studio
3. Configure provider-specific settings:

#### OpenRouter
- **API Key**: Your OpenRouter API key (get one at https://openrouter.ai)
- **Model**: Model identifier (e.g., `openai/gpt-4`, `anthropic/claude-3-opus`)

#### n8n Webhook
- **Webhook URL**: Your n8n webhook URL
- The webhook should accept a POST request with:
  ```json
  {
    "message": "user message",
    "systemPrompt": "optional system prompt",
    "temperature": 0.7,
    "maxTokens": 2000,
    "conversationHistory": []
  }
  ```
- And return a response with the AI's message

#### LM Studio
- **Endpoint URL**: LM Studio API endpoint (default: `http://localhost:1234/v1/chat/completions`)
- Make sure LM Studio is running and has a model loaded

4. (Optional) Configure advanced settings:
   - **System Prompt**: Customize the AI's behavior
   - **Temperature**: Control randomness (0-2)
   - **Max Tokens**: Maximum response length

5. Click **Add LLM**

### Chatting

1. Click on an LLM in the chat list to start a conversation
2. Type your message in the input box at the bottom
3. Press Enter or click the send button
4. The AI will respond, and the conversation is saved automatically

### Managing Chats

- **Clear Chat**: Click the trash icon in the chat header to clear all messages
- **Multiple Chats**: Each LLM has its own separate chat history
- **Persistent Storage**: All chats are saved in your browser's local storage

## Configuration

### System Prompts

System prompts allow you to customize how the AI behaves. Examples:

- **Helpful Assistant**: "You are a helpful AI assistant."
- **Code Expert**: "You are an expert programmer who provides clear, concise code examples."
- **Creative Writer**: "You are a creative writer who helps with storytelling and creative writing."

### Temperature

Controls randomness in responses:
- **0.0-0.3**: More focused and deterministic
- **0.7-0.9**: Balanced (default)
- **1.0-2.0**: More creative and random

### Max Tokens

Limits the length of responses:
- Lower values: Shorter, more concise responses
- Higher values: Longer, more detailed responses

## Development

### Project Structure

```
aimessenger/
├── src/                    # Frontend source
│   ├── components/         # React components
│   │   ├── ChatList.tsx   # Sidebar with LLM list
│   │   ├── ChatWindow.tsx # Main chat interface
│   │   └── AddLLMModal.tsx # Modal for adding LLMs
│   ├── store.ts           # Zustand state management
│   ├── types.ts           # TypeScript types
│   ├── App.tsx            # Main app component
│   └── main.tsx           # Entry point
├── server/                # Backend API
│   └── index.ts           # Express server
├── index.html             # HTML template
├── package.json           # Dependencies
└── vite.config.ts         # Vite configuration
```

### Scripts

- `npm run dev` - Start both frontend and backend in development mode
- `npm run dev:client` - Start only the frontend
- `npm run dev:server` - Start only the backend
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### Adding New Providers

To add a new LLM provider:

1. Add the provider type to `src/types.ts`:
   ```typescript
   export type LLMProvider = 'openrouter' | 'n8n' | 'lmstudio' | 'yournewprovider';
   ```

2. Add the provider option in `src/components/AddLLMModal.tsx`

3. Implement the handler in `server/index.ts`:
   ```typescript
   async function handleYourNewProvider(llm: any, messages: any[]): Promise<string> {
     // Implementation
   }
   ```

4. Add the case in the switch statement in `/api/chat` endpoint

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **State Management**: Zustand
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Backend**: Express.js + TypeScript
- **HTTP Client**: Axios
- **Date Formatting**: date-fns

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

If you encounter any issues or have questions, please open an issue on GitHub.

---

Made with ❤️ for the AI community
