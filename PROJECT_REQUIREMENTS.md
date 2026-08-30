# Project Requirements Checklist

This project follows the submitted requirements for the RAG-Based College Chatbot.

## Frontend

- Responsive user interface: `client/src/styles.css` uses responsive grid layouts and mobile breakpoints.
- Navigation: `client/src/app.js` provides Overview, Chat, History, Profile, and Admin navigation.
- Forms: login, register, chat question, and admin document upload forms are implemented in `client/src/app.js`.
- Loading states: submit buttons are disabled during login/register, chat requests, and document uploads.
- Error handling: API failures are shown through toast messages.
- User-friendly design: the UI includes a clean app shell, admin dashboard, chat layout, badges, source cards, and empty states.

## Backend

- API endpoints: implemented in `server/src/routes/authRoutes.js`, `server/src/routes/documentRoutes.js`, and `server/src/routes/chatRoutes.js`.
- Business logic: authentication, document processing, and RAG logic live in `server/src/services/`.
- Input validation: registration, login, chat questions, upload file type, and upload size are validated.
- Error handling: centralized request error handling is implemented in `server/src/app.js`.
- Environment-variable configuration: `.env` loading and configuration are handled in `server/src/config/env.js`.

## Database

- Database structure: MongoDB collections are used for users, documents, chunks, chat sessions, and chat messages.
- CRUD operations: document create/read/delete/reprocess and chat session create/read/delete are implemented.
- Data validation: required fields, roles, file types, file size, and ownership checks are enforced.
- Relationships: documents link to chunks by `documentId`, chat messages link to sessions by `sessionId`, and sessions/messages link to users by `userId`.

## Authentication

- Login: `POST /api/auth/login`
- Signup: `POST /api/auth/register`
- Logout: `POST /api/auth/logout`
- Protected pages/routes: the frontend checks login state, and backend APIs enforce JWT-based auth.
- Role handling: admin-only document routes are protected with `requireAdmin`.

## RAG Flow

```text
User Question
  -> Embedding
  -> MongoDB Vector Chunk Search
  -> Relevant Context
  -> LLM or Local Grounded Answerer
  -> Answer + Source
```

The main RAG implementation is in `server/src/services/ragService.js`.

