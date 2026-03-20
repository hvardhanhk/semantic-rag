# Semantic — RAG Document Intelligence

> Upload any document, ask questions in natural language, and get AI answers with inline source citations — highlighted live in the document panel.

![Semantic RAG](https://img.shields.io/badge/AI-Anthropic%20Claude-amber?style=flat-square) ![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react) ![RAG](https://img.shields.io/badge/Pattern-RAG-orange?style=flat-square)

## Overview

Semantic demonstrates a **Retrieval-Augmented Generation (RAG)** pipeline built entirely in the frontend. Documents are chunked and indexed client-side. Questions are answered by sending all chunks alongside the query to Claude, which retrieves and cites the relevant ones inline.

**What makes it interesting:**
- Cited source IDs (`[2]`, `[5]`) parse and highlight in real time as the AI streams
- Document panel auto-scrolls to the first cited chunk
- Multi-turn conversation — the AI maintains context across questions
- Hover any chunk to preview it; cited chunks glow amber

## Technical Highlights

| Skill | Implementation |
|---|---|
| **RAG Pipeline** | Client-side chunking → context injection → LLM retrieval |
| **Chunking Strategy** | Paragraph-based splitting with minimum length filter |
| **Citation Parsing** | Regex `[N]` extraction synchronized with streaming tokens |
| **Scroll Sync** | `useRef` map of chunk DOM nodes + programmatic scroll-to |
| **Conversation Memory** | Full message history sent on each turn for multi-turn Q&A |
| **AbortController** | Clean cancellation when new questions interrupt ongoing streams |

## Getting Started

```bash
git clone https://github.com/YOUR_USERNAME/semantic-rag.git
cd semantic-rag
npm install
echo "VITE_ANTHROPIC_API_KEY=sk-ant-..." > .env.local
npm run dev
```

## How the RAG Pipeline Works

```
Document Text
     │
     ▼
┌─────────────┐
│   Chunker   │  Splits on \n\n, filters < 40 chars
└──────┬──────┘
       │  [{id: 1, text: "..."}, ...]
       ▼
┌─────────────────────────────────┐
│   Context Builder               │
│   "[1] chunk text               │
│    [2] chunk text ..."          │
└──────────────┬──────────────────┘
               │
               ▼
      Anthropic Claude API
      system: "Cite sources with [N]"
               │
               ▼  streaming tokens
┌──────────────────────────────────┐
│  Citation Parser (real-time)     │
│  Extracts [N] → highlights chunk │
└──────────────────────────────────┘
```

## Project Structure

```
semantic-rag/
├── src/
│   ├── App.jsx    # RAG pipeline, chunker, citation parser, chat UI
│   └── main.jsx
├── index.html
├── vite.config.js
└── package.json
```

## Resume Talking Points

- *"Implemented a client-side RAG pipeline with paragraph chunking, context injection, and real-time citation extraction synchronized with LLM streaming output"*
- *"Built a document highlighting system that parses citation markers as tokens stream in and auto-scrolls to the referenced source chunk"*
- *"Designed a multi-turn conversational interface that maintains full history context across LLM requests"*

## License

MIT
