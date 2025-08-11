# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

berget-gpt - A modern ChatGPT clone powered by Berget AI's API, featuring real-time streaming responses and support for multiple LLM models.

## Tech Stack

- **Framework**: Next.js 15.4.6 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **AI Integration**: Berget AI API (OpenAI-compatible)
- **Icons**: Lucide React

## Development Commands

```bash
cd berget-chat
npm install          # Install dependencies
npm run dev         # Start development server (http://localhost:3000)
npm run build       # Build for production
npm run start       # Start production server
```

## Project Structure

```
berget-chat/
├── app/
│   ├── api/
│   │   └── chat/route.ts    # Server-side API endpoint for Berget AI
│   ├── globals.css           # Global styles with Tailwind
│   ├── layout.tsx            # Root layout
│   └── page.tsx              # Main chat page
├── components/
│   ├── ChatInterface.tsx     # Main chat component with streaming
│   ├── MessageList.tsx       # Message display component
│   ├── ModelSelector.tsx     # Model selection dropdown
│   └── Sidebar.tsx           # Conversation sidebar
├── lib/
│   ├── api.ts               # Client-side API functions
│   └── types.ts             # TypeScript type definitions
└── .env.local               # Environment variables (contains API key)
```

## Berget AI Integration

The app uses Berget AI's OpenAI-compatible API with:
- Base URL: `https://api.berget.ai/v1`
- API Key: Stored in `.env.local` as `BERGET_API_KEY`

### Supported Models

1. **GPT-OSS 120B** (`openai/gpt-oss-120b`) - Open source GPT model
2. **Llama 3.3 70B** (`meta-llama/Llama-3.3-70B-Instruct`) - Meta's latest Llama model
3. **Mistral Small 3.1 24B** (`mistralai/Mistral-Small-3.1-24B-Instruct-2503`) - Efficient Mistral model

## Key Features

- Real-time streaming responses using Server-Sent Events
- Conversation history management
- Model switching between 3 Berget AI models
- Dark mode support
- Responsive design
- Placeholder UI for future features (voice chat, profile, login)

## API Architecture

- Client sends requests to `/api/chat` endpoint
- Server-side route handles Berget AI communication
- Streaming responses sent back via Server-Sent Events
- API key kept secure on server side

## Git Workflow

- Main branch: `main`
- `.gitignore` configured to exclude sensitive files (`.env.local`, `node_modules`, `.next/`)