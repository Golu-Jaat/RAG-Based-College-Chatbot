# RAG-Based College Chatbot

A full-stack project built from `spec.md`. It provides authentication, role-based admin access, document upload and processing, chunking, embedding generation, MongoDB-backed vector similarity search, grounded answer generation, source references, and chat history.

## Features

- Student registration and login.
- Seeded demo admin and student accounts.
- Admin-only document upload, delete, and reprocess actions.
- PDF, TXT, Markdown, CSV, JSON, and HTML ingestion.
- Text cleaning, chunking, embedding generation, and local vector search.
- RAG chatbot that answers from retrieved chunks and cites sources.
- Unknown-question fallback when similarity is too low.
- Per-user chat sessions and history.
- MongoDB collections for users, documents, chunks, chat sessions, and messages.
- Optional OpenAI answer generation when `OPENAI_API_KEY` is configured.

See `PROJECT_REQUIREMENTS.md` for the submission requirements checklist.
See `BONUS_FEATURES.md` for the bonus features checklist.

## Folder Structure

```text
client/
└── src/
    ├── main.jsx
    └── style.css
└── index.html
└── vite.config.js

server/
└── src/
    ├── app.js
    ├── config/
    │   ├── db.js
    │   └── env.js
    ├── middleware/
    │   ├── guards.js
    │   └── rateLimit.js
    ├── routes/
    │   ├── adminRoutes.js
    │   ├── authRoutes.js
    │   ├── chatRoutes.js
    │   └── documentRoutes.js
    ├── services/
    │   ├── authService.js
    │   ├── documentService.js
    │   └── ragService.js
    └── utils/
        └── http.js
```

## Run Locally

Start MongoDB first. You can use a local MongoDB service, MongoDB Atlas, or Docker:

```bash
docker compose up -d
```

```bash
npm install
npm run check:mongo
npm run dev
```

Open `http://localhost:3000`.

For production-style local serving:

```bash
npm run build:client
npm start
```

Demo accounts:

- Admin: `admin@college.edu` / `Admin@12345`
- Student: `student@college.edu` / `Student@12345`

The app creates MongoDB collections and `storage/` on first run. If an old `data/db.json` exists, it is migrated into MongoDB automatically when the MongoDB database is empty.

## Environment

Copy `.env.example` to `.env` before adding your MongoDB Atlas URI or custom settings.

```bash
PORT=3000
JWT_SECRET=replace-with-a-long-random-secret
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=college_rag_chatbot
ADMIN_NAME=College Admin
ADMIN_EMAIL=admin@college.edu
ADMIN_PASSWORD=Admin@12345
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
PYTHON_BIN=
```

`OPENAI_API_KEY` is optional. Without it, the app still performs retrieval and returns a concise grounded answer from the highest-scoring source chunks.

`PYTHON_BIN` is optional. It can point to a Python installation with `pypdf` for PDF text extraction. In this Codex workspace, the bundled Python runtime includes `pypdf`.

## RAG Pipeline

```text
Admin Upload
  -> Text Extraction
  -> Text Cleaning
  -> Chunking
  -> Embedding Generation
  -> MongoDB Chunk + Vector Storage

User Question
  -> Question Embedding
  -> Vector Database Search
  -> Relevant Context
  -> LLM or Local Grounded Answerer
  -> Answer + Source References
  -> Chat History Save
```

## API Surface

Authentication:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

Documents:

- `POST /api/documents/upload`
- `GET /api/documents`
- `GET /api/documents/:id`
- `DELETE /api/documents/:id`
- `POST /api/documents/:id/process`

Chat:

- `POST /api/chat/ask`
- `GET /api/chat/sessions`
- `GET /api/chat/sessions/:id`
- `DELETE /api/chat/sessions/:id`

## Production Notes

For production deployment, use MongoDB Atlas, move files to cloud storage, set a strong `JWT_SECRET`, configure HTTPS, and consider MongoDB Atlas Vector Search or a managed vector database for larger document collections.
