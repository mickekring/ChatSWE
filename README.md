# ChatSWE - An AI Chat Application

A modern ChatGPT-like interface built to demonstrate how generative AI can be implemented in a secure, privacy-compliant manner for Swedish organizations.

## 🇸🇪 Swedish AI Compliance Showcase

This application demonstrates how to deploy AI solutions that comply with:
- **GDPR** (General Data Protection Regulation)
- **EU AI Act** requirements
- **Swedish data sovereignty** principles

All infrastructure and AI inference runs on Swedish servers to ensure data remains within national borders.

## 🏗️ Architecture

**Frontend & Backend:**
- Next.js 15 with TypeScript
- Real-time streaming responses
- User authentication & conversation history

**Infrastructure (Swedish VPS):**
- **Docker deployment** via Coolify
- **NocoDB** for database management  
- **n8n** as MCP (Model Context Protocol) server
- **Berget.ai** for AI model hosting


## 🐳 Docker Deployment
The application is containerized and deployed using Coolify on Swedish infrastructure:

