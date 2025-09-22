# travel assistant

AI-powered chat agent for travel recommendation.

## Features

- **Intelligent Responses**: Powered by 
- **Content Integration**: Enhanced with Contentstack content
- **Easy Integration**: Drop-in React component
- **Customizable**: Configurable theme and behavior

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install react
   ```

2. **Copy the Component**
   Copy `Agent.jsx` to your React project.

3. **Use in Your App**
   ```jsx
   import travelassistant from './Agent';
   
   function App() {
     return (
       <div>
         <h1>My App</h1>
         <travelassistant />
       </div>
     );
   }
   ```

## Configuration

The agent is configured with:

- **Provider**: openrouter
- **Model**: 
- **Content Type**: tour
- **Temperature**: 0.7

## Customization

You can customize the agent by modifying:

- **System Prompt**: Change the agent's personality and expertise
- **UI Theme**: Update colors and styling
- **Welcome Message**: Customize the greeting
- **Content Type**: Filter to specific content from Contentstack

## API Requirements

Make sure your Chat Agent Platform API is running on http://localhost:7001 with:

- Chat completions endpoint
- Contentstack integration
- openrouter provider configured

## Support

For help and documentation, visit the main Chat Agent Platform repository.
