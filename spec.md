# RAG-Based College Chatbot Specification

## 1. Project Overview

The RAG-Based College Chatbot is an AI-powered college information assistant that helps students, faculty, and administrators quickly find accurate answers from official college documents. The system uses Retrieval-Augmented Generation (RAG) to answer questions based on uploaded PDFs, notices, FAQs, academic calendars, policies, fee structures, department documents, placement information, scholarship details, and other college resources.

Instead of relying only on a general-purpose chatbot, the platform first searches the college knowledge base, retrieves the most relevant document content, and then generates a grounded answer using an LLM. Each answer includes source references so users can verify where the information came from.

This project is suitable for a BTech final-year project because it demonstrates full-stack development, authentication, document processing, vector search, AI integration, database design, and practical deployment.

### Project Idea

Build an **AI-powered college information assistant** that answers student questions using **Retrieval-Augmented Generation (RAG)**. The chatbot retrieves relevant information from uploaded college documents, PDFs, notices, FAQs, and other resources before generating an answer.

### Topics Covered

- Admissions
- Departments
- Courses
- Fees
- Exams
- Academic calendar
- Hostel
- Library
- Clubs
- Placements
- Scholarships
- Policies
- Events

### Example RAG Flow

```text
User Question -> Embedding -> Vector Database Search -> Relevant Context -> LLM -> Answer + Source
```

## 2. Objectives

- Build a working AI chatbot for college-related queries.
- Allow admins to upload and manage college documents.
- Extract text from uploaded PDFs and documents.
- Convert document text into smaller searchable chunks.
- Generate embeddings for document chunks.
- Store embeddings in a vector database.
- Retrieve relevant chunks using semantic search.
- Generate answers using retrieved college context.
- Display document sources or references with each answer.
- Handle unknown or unavailable information clearly.
- Maintain chat history for users.
- Provide a complete deployed full-stack application.

## 3. Users and Roles

### Student

- Ask questions about college information.
- View AI-generated answers.
- View sources used for each answer.
- Access previous chat history.

### Admin

- Upload college PDFs, notices, FAQs, and policy documents.
- View uploaded documents.
- Update or delete documents.
- Trigger document processing.
- Manage the college knowledge base.

### Optional Faculty/Staff

- Upload department-specific documents.
- Answer or review unresolved queries.
- Manage information related to their department.

## 4. Core Features

The following must-have features define the minimum working scope of the project:

- **Chat Interface** - Students can ask college-related questions.
- **User Authentication** - Users can register, login, and access protected pages.
- **Document Upload** - Admin can upload PDFs and college documents.
- **Document Processing** - System extracts text and chunks it for retrieval.
- **Embedding Generation** - System converts chunks and questions into vector embeddings.
- **Vector Database / Semantic Search** - System stores and searches document embeddings.
- **RAG Pipeline** - System retrieves relevant context and passes it to the LLM.
- **AI-Generated Answers** - Answers are based on the uploaded knowledge base.
- **Source/Reference Display** - System shows the document/source used for the answer.
- **Unknown Question Handling** - System clearly responds when relevant information is unavailable.
- **Chat History / Conversation Context** - System stores previous user conversations.
- **Admin Document Management** - Admin can upload, update, and delete documents.
- **Database/Storage Integration** - System stores users, documents, chunks, chats, and files.
- **Working Frontend-Backend Integration** - Frontend and backend are connected through APIs.
- **Working Deployed Application** - Final project is deployed and usable online.

### Chat Interface

- Students can ask natural-language questions.
- Chatbot responds with concise, relevant answers.
- Conversation history is displayed in a chat-style UI.

### User Authentication

- Register and login functionality.
- Role-based access for students and admins.
- Protected routes for admin-only features.

### Document Upload

- Admin can upload PDFs, notices, FAQs, and other college documents.
- Each document stores metadata such as title, category, department, upload date, and status.

### Document Processing

- Extract text from uploaded documents.
- Clean extracted text.
- Split text into chunks suitable for retrieval.
- Store chunks with document references.

### Embedding Generation

- Generate vector embeddings for each text chunk.
- Generate query embeddings when a user asks a question.

### Vector Database and Semantic Search

- Store embeddings in a vector database.
- Search for the most relevant chunks based on semantic similarity.
- Return top matching chunks for the RAG pipeline.

### RAG-Based Answer Generation

- Pass retrieved chunks as context to the LLM.
- Generate answers based only on the retrieved college information.
- Avoid unsupported or hallucinated answers.

### Source Display

- Show source document names with each answer.
- Optionally show page number, section title, or matched text snippet.

### Unknown Question Handling

- If no relevant information is found, the chatbot should clearly say that the answer is not available in the uploaded knowledge base.
- The system should avoid guessing.

### Chat History

- Store user questions, answers, timestamps, and sources.
- Allow users to view previous conversations.

### Admin Document Management

- View uploaded documents.
- Delete outdated documents.
- Re-upload updated documents.
- Track document processing status.

### Frontend-Backend Integration

- The frontend communicates with backend APIs for authentication, chat, documents, and admin actions.
- The system should be fully functional end to end.

## 5. Required RAG Pipeline

The project must include a real retrieval pipeline. Simply connecting a chatbot to an LLM is not sufficient.

**Important:** Simply connecting a chatbot to an LLM does **not** count as a RAG project. A working retrieval pipeline with a vector database/semantic search is mandatory.

Short required pipeline:

```text
College Documents -> Text Extraction -> Chunking -> Embeddings -> Vector Database -> Similarity Search -> Relevant Context -> LLM -> Final Answer
```

Detailed required pipeline:

```text
College Documents
      ↓
Text Extraction
      ↓
Text Cleaning
      ↓
Chunking
      ↓
Embedding Generation
      ↓
Vector Database Storage
      ↓
User Question
      ↓
Question Embedding
      ↓
Similarity Search
      ↓
Relevant Context Retrieval
      ↓
LLM Answer Generation
      ↓
Final Answer + Sources
```

## 6. Recommended Tech Stack

### Frontend

- Next.js or React
- TypeScript
- Tailwind CSS
- Axios or Fetch API
- React Markdown for rendering answers

### Backend

- Node.js with Express or Next.js API routes
- REST APIs for authentication, chat, and document management
- JWT-based authentication

### Database and Storage

- Supabase PostgreSQL or MongoDB for application data
- Supabase Storage, Firebase Storage, or local/cloud storage for uploaded documents
- pgvector, Pinecone, ChromaDB, Weaviate, or FAISS for vector search

### AI and RAG

- OpenAI, Gemini, OpenRouter, or another LLM provider
- Embedding model for document chunks and user queries
- LangChain or custom RAG pipeline implementation

### Deployment

- Vercel or Netlify for frontend
- Render, Railway, Fly.io, or VPS for backend
- Supabase, MongoDB Atlas, or managed PostgreSQL for database
- Managed vector database or PostgreSQL with pgvector

## 7. High-Level Architecture

```text
                Student / Admin
                      │
                      ▼
              Frontend Web App
        Chat UI / Admin Dashboard
                      │
                      ▼
               Backend API Server
     Auth / Documents / Chat / RAG APIs
          │           │             │
          ▼           ▼             ▼
   App Database   File Storage   AI Services
          │           │             │
          ▼           ▼             ▼
 User Data and   Uploaded PDFs   Embeddings and
 Chat History    and Notices     LLM Responses
                      │
                      ▼
              Vector Database
          Document Chunks + Embeddings
```

## 8. Database and Main Entities

### User

- id
- name
- email
- passwordHash
- role: student or admin
- createdAt

### Document

- id
- title
- description
- category
- department
- fileUrl
- fileType
- uploadedBy
- processingStatus: pending, processing, completed, failed
- createdAt
- updatedAt

### DocumentChunk

- id
- documentId
- chunkText
- chunkIndex
- pageNumber
- embedding
- metadata
- createdAt

### ChatSession

- id
- userId
- title
- createdAt
- updatedAt

### ChatMessage

- id
- sessionId
- userId
- question
- answer
- sources
- createdAt

### SourceReference

- id
- messageId
- documentId
- documentTitle
- pageNumber
- snippet
- similarityScore

## 9. Main Pages

### Public Pages

- Landing page with project introduction.
- Login page.
- Register page.

### Student Pages

- Chat page.
- Chat history page.
- Profile page.

### Admin Pages

- Admin dashboard.
- Upload document page.
- Document management page.
- Document details page.
- Processing status page.

## 10. API and Modules

### Authentication APIs

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

### Document APIs

- `POST /api/documents/upload`
- `GET /api/documents`
- `GET /api/documents/:id`
- `DELETE /api/documents/:id`
- `POST /api/documents/:id/process`

### Chat APIs

- `POST /api/chat/ask`
- `GET /api/chat/sessions`
- `GET /api/chat/sessions/:id`
- `DELETE /api/chat/sessions/:id`

### RAG Modules

- Document text extractor
- Text cleaner
- Text chunker
- Embedding generator
- Vector database service
- Similarity search service
- Prompt builder
- LLM answer generator
- Source citation formatter

## 11. Admin Flow

1. Admin logs in.
2. Admin opens the dashboard.
3. Admin uploads a college PDF, notice, FAQ, or policy document.
4. System stores the file in storage.
5. System extracts text from the document.
6. System splits the text into chunks.
7. System generates embeddings for each chunk.
8. System stores chunks and embeddings in the vector database.
9. Document status changes to completed.
10. Students can now ask questions based on that document.

## 12. Student Flow

1. Student logs in.
2. Student opens the chatbot page.
3. Student asks a college-related question.
4. System converts the question into an embedding.
5. System searches the vector database for relevant chunks.
6. System sends the retrieved context and question to the LLM.
7. LLM generates an answer based on the retrieved context.
8. System displays the answer with source references.
9. Chat history is saved for future viewing.

## 13. Unknown Question Handling

The chatbot must not answer from general assumptions when the knowledge base does not contain relevant information.

Example response:

> I could not find this information in the uploaded college documents. Please contact the college administration or upload the relevant document.

Unknown question handling should use:

- Minimum similarity score threshold.
- Empty retrieval result detection.
- Prompt instruction to avoid unsupported answers.
- Clear fallback message.

## 14. Source Citations

Every answer should include source references whenever possible.

Example:

```text
Answer:
The admission form submission deadline is 15 July 2026.

Sources:
1. Admission Notice 2026.pdf, Page 2
2. Academic Calendar 2026.pdf, Page 1
```

Source citations may include:

- Document title
- Page number
- Section name
- Short text snippet
- Similarity score

## 15. Security Requirements

- Hash passwords before storing them.
- Use JWT or secure session handling.
- Protect admin routes using role-based access control.
- Validate uploaded file types.
- Limit file size for uploads.
- Sanitize extracted document text where needed.
- Store API keys in environment variables.
- Prevent users from accessing unauthorized chat history.
- Use HTTPS in production.
- Apply rate limits to chat and upload endpoints.

## 16. Deployment Requirements

- Frontend should be deployed and publicly accessible.
- Backend APIs should be deployed and connected to the frontend.
- Database should be hosted on a managed service.
- File storage should be available in production.
- Vector search should work in the deployed environment.
- Environment variables should be configured securely.
- The final deployed application should support login, document upload, document processing, chat, retrieval, answer generation, and source display.

## 17. Bonus Features

- Multiple document collections.
- Department-wise knowledge bases.
- Admin analytics dashboard.
- Document version management.
- Source highlighting inside document previews.
- Confidence/relevance score.
- Multilingual support.
- Voice input and responses.
- Conversation export.
- Suggested questions.
- Answer feedback.
- Admin analytics.
- Automatic document summarization.
- OCR for scanned documents.
- Hybrid keyword + semantic search.
- Document re-ranking.
- Role-based access.
- AI-generated FAQs.
- Streaming AI responses.
- Frequently asked questions auto-generation.
- Feedback buttons for answers.
- Escalation of unanswered questions to admin.
- Scheduled re-processing for updated documents.
- Role for faculty document reviewers.

## 18. Development Phases

### Phase 1: Project Setup

- Set up frontend and backend.
- Configure database.
- Create authentication system.
- Create basic protected routes.

### Phase 2: Document Management

- Build admin upload interface.
- Store uploaded documents.
- Save document metadata.
- Display uploaded document list.

### Phase 3: Document Processing

- Extract text from PDFs.
- Clean and chunk document text.
- Store chunks in the database.

### Phase 4: Vector Search

- Generate embeddings for chunks.
- Store embeddings in vector database.
- Implement similarity search.

### Phase 5: RAG Chatbot

- Build chat interface.
- Convert user questions into embeddings.
- Retrieve relevant chunks.
- Generate answers using the LLM.
- Display sources.

### Phase 6: Chat History and Admin Controls

- Save chat sessions and messages.
- Add chat history page.
- Add document delete and reprocess options.

### Phase 7: Testing and Deployment

- Test authentication, upload, processing, search, and chat.
- Test unknown question handling.
- Deploy frontend, backend, database, and storage.
- Prepare final demo and documentation.

## 19. Final Expected Outcome

The final project should be a working full-stack RAG-Based College Chatbot where an admin can upload college documents and students can ask questions based on those documents. The system should retrieve relevant content from the knowledge base, generate accurate AI answers, show source references, save chat history, and clearly respond when information is unavailable.

The completed application should demonstrate practical use of AI, semantic search, vector databases, authentication, document processing, and real-world frontend-backend integration, making it suitable for a BTech final-year project submission and demonstration.
