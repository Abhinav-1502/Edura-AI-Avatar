# Azure AI Avatar - React UI

This is a modern React + TypeScript implementation of the Azure AI Avatar frontend.

## Features
- **Modern UI**: Glassmorphism design, responsive layout, animations.
- **Type Safety**: Full TypeScript implementation.
- **Modular Code**: Separated concerns via Hooks (`useAvatarSession`, `useChat`) and Components.
- **Azure Integration**: Direct integration with `microsoft-cognitiveservices-speech-sdk`.

## Prerequisites
- Node.js (v16+)
- Backend service running on port 8000 (standard FastAPI server)

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run development server:
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```

## Configuration
The application proxies `/api` requests to `http://localhost:8000`. 
To change this, edit `vite.config.ts`.
