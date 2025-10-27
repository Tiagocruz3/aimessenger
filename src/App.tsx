import { useState } from 'react';
import { ChatList } from './components/ChatList';
import { ChatWindow } from './components/ChatWindow';
import { AddLLMModal } from './components/AddLLMModal';

function App() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  return (
    <div className="flex h-screen bg-white">
      <ChatList onAddLLM={() => setIsAddModalOpen(true)} />
      <ChatWindow />
      <AddLLMModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
    </div>
  );
}

export default App;
