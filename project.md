Create a production-grade Next.js application. 
Do not use any business logic for now. Focus on the UI and architecture and creating api routes (GET and POST requests for now) and database schemas. 
For each feature, create a folder and a file for the api route and link it to the UI. User Server Components where appropriate.
Use best practices for file organization and naming conventions.

## Project Structure

- app
- features
  - chat
  - documents
  - projects
  - agents
  - users
- services
- repositories
- ai
  - prompts
  - agents
  - retrieval
  - memory
  - tools
- utils
- types

## Tech Requirements

- Next.js latest
- App Router
- Typescript
- TailwindCSS
- Shadcn UI
- Prisma
- Supabase
- Authentication
- Repository pattern
- Feature-based folder structure
- Service layer
- Depencency injection pattern

## Build UI

- ChatGPT-style
- Streaming responses
- Message persistence
- Conversation list
- Thread switching

## Tables
- users
- projects
- conversations
- messages

## Features

### Authentication
- Sign up
- Sign in
- Sign out
- Password reset

### Upload
- PDF
- Markdown
- Text
- DOCX