import { useState } from 'react';
import { useChatStore } from '../store';
import { X } from 'lucide-react';
import { LLMProvider } from '../types';

interface AddLLMModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddLLMModal({ isOpen, onClose }: AddLLMModalProps) {
  const { addLLM } = useChatStore();
  const [provider, setProvider] = useState<LLMProvider>('openrouter');
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('');

  // OpenRouter
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');

  // n8n
  const [webhookUrl, setWebhookUrl] = useState('');

  // LM Studio
  const [endpoint, setEndpoint] = useState('http://localhost:1234/v1/chat/completions');

  // Common
  const [systemPrompt, setSystemPrompt] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2000);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const config: any = {
      systemPrompt,
      temperature,
      maxTokens,
    };

    if (provider === 'openrouter') {
      config.apiKey = apiKey;
      config.model = model;
    } else if (provider === 'n8n') {
      config.webhookUrl = webhookUrl;
    } else if (provider === 'lmstudio') {
      config.endpoint = endpoint;
    }

    addLLM({
      name: name.trim(),
      provider,
      avatar: avatar.trim() || undefined,
      config,
    });

    // Reset form
    setName('');
    setAvatar('');
    setApiKey('');
    setModel('');
    setWebhookUrl('');
    setEndpoint('http://localhost:1234/v1/chat/completions');
    setSystemPrompt('');
    setTemperature(0.7);
    setMaxTokens(2000);
    setProvider('openrouter');

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-messenger-border p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Add New LLM</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-messenger-gray transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Basic Info */}
          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-messenger-blue"
              placeholder="e.g., GPT-4, Claude, Local Llama"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Avatar (emoji or text)</label>
            <input
              type="text"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-messenger-blue"
              placeholder="e.g., 🤖, AI, 🦙"
              maxLength={2}
            />
          </div>

          {/* Provider Selection */}
          <div>
            <label className="block text-sm font-medium mb-1">Provider *</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as LLMProvider)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-messenger-blue"
            >
              <option value="openrouter">OpenRouter API</option>
              <option value="n8n">n8n Webhook</option>
              <option value="lmstudio">LM Studio</option>
            </select>
          </div>

          {/* Provider-specific fields */}
          {provider === 'openrouter' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">API Key *</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-messenger-blue"
                  placeholder="sk-or-..."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Model</label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-messenger-blue"
                  placeholder="e.g., openai/gpt-4, anthropic/claude-3-opus"
                />
              </div>
            </>
          )}

          {provider === 'n8n' && (
            <div>
              <label className="block text-sm font-medium mb-1">Webhook URL *</label>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-messenger-blue"
                placeholder="https://your-n8n.com/webhook/..."
                required
              />
            </div>
          )}

          {provider === 'lmstudio' && (
            <div>
              <label className="block text-sm font-medium mb-1">Endpoint URL *</label>
              <input
                type="url"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-messenger-blue"
                placeholder="http://localhost:1234/v1/chat/completions"
                required
              />
            </div>
          )}

          {/* Common Settings */}
          <div>
            <label className="block text-sm font-medium mb-1">System Prompt</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-messenger-blue"
              rows={3}
              placeholder="Optional system prompt to customize the LLM's behavior"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Temperature: {temperature}
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Max Tokens</label>
              <input
                type="number"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-messenger-blue"
                min="1"
                max="100000"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-messenger-gray transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-messenger-blue text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Add LLM
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
