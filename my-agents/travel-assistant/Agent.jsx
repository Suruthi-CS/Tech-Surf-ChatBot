import React, { useState } from 'react';

const travelassistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const agentConfig = {
    "provider": "openrouter",
    "model": "",
    "temperature": 0.7,
    "maxTokens": 1000,
    "enhanceWithContent": true,
    "contentType": "tour"
};

  const sendMessage = async (content) => {
    if (!content.trim()) return;
    
    const userMessage = { role: 'user', content, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:7001/api/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          provider: agentConfig.provider,
          model: agentConfig.model,
          temperature: agentConfig.temperature,
          enhance_with_content: agentConfig.enhanceWithContent,
        }),
      });

      const data = await response.json();
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.message.content,
        timestamp: new Date().toISOString()
      }]);
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Chat widget UI (simplified)
  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center"
        >
          💬
        </button>
      ) : (
        <div className="w-80 h-96 bg-white border rounded-lg shadow-xl">
          <div className="flex items-center justify-between p-4 border-b bg-blue-600 text-white rounded-t-lg">
            <h3 className="font-semibold">travel assistant</h3>
            <button onClick={() => setIsOpen(false)}>×</button>
          </div>
          
          <div className="h-64 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="bg-gray-100 p-3 rounded-lg mb-4">
                <div className="text-sm">Hi! I'm travel assistant. I can help you plan amazing trips and find the best travel experiences. Where would you like to go?</div>
              </div>
            )}
            
            {messages.map((msg, idx) => (
              <div key={idx} className={`mb-4 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-900'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start mb-4">
                <div className="bg-gray-100 px-3 py-2 rounded-lg">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <form onSubmit={(e) => { e.preventDefault(); sendMessage(inputValue); }} className="p-4 border-t">
            <div className="flex space-x-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask about destinations, tours, or travel tips..."
                className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                →
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default travelassistant;