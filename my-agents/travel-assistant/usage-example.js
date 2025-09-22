// Usage Example for travel assistant

import React from 'react';
import travelassistant from './travelassistant';

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-center mb-8">
          travel assistant Demo
        </h1>
        
        <div className="max-w-4xl mx-auto">
          <p className="text-lg text-gray-600 text-center mb-8">
            Specialized AI assistant for travel recommendation
          </p>
          
          {/* Your app content here */}
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-semibold mb-4">Welcome!</h2>
            <p className="text-gray-600 mb-4">
              Click the chat button in the bottom right to start talking with your travel assistant.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 border rounded-lg">
                <h3 className="font-medium mb-2">Quick Actions</h3>
                <p className="text-gray-600 text-sm">
                  Try asking about travel recommendation related topics.
                </p>
              </div>
              
              <div className="p-4 border rounded-lg">
                <h3 className="font-medium mb-2">AI-Powered</h3>
                <p className="text-gray-600 text-sm">
                  Powered by  with content from Contentstack.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Chat Agent */}
      <travelassistant />
    </div>
  );
}

export default App;