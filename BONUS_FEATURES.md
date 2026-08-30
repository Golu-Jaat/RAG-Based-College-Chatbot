# Bonus Features Checklist

The project now includes practical implementations for the requested bonus features.

| Bonus Feature | Status | Implementation |
| --- | --- | --- |
| Multiple document collections | Done | Documents include a `collection` field; chat and document APIs support collection filters. |
| Department-wise knowledge bases | Done | Documents include `department`; chat retrieval can be scoped by department. |
| Admin dashboard | Done | Admin page shows uploads, document controls, summaries, FAQs, OCR status, and analytics. |
| Document version management | Done | Uploading the same title in the same collection/department increments `version`. |
| Source highlighting | Done | Source snippets highlight query terms in the chat UI. |
| Confidence/relevance score | Done | Source cards show similarity scores. |
| Multilingual chatbot | Done | Chat supports English, Hindi, and auto language modes; OpenAI prompts receive language instructions. |
| Voice input and responses | Done | Browser speech recognition and speech synthesis are available from the chat UI when supported. |
| Conversation export | Done | Chat sessions can be exported as JSON. |
| Suggested questions | Done | Suggestions are generated from processed document chunks. |
| Answer feedback | Done | Users can submit thumbs-up or thumbs-down feedback per answer. |
| Admin analytics | Done | Admin analytics API reports users, documents, chunks, questions, unanswered count, and feedback. |
| Automatic document summarization | Done | Processed documents store a generated summary. |
| OCR for scanned documents | Done as OCR-aware processing | Text PDFs are extracted; scanned/no-text PDFs are marked with OCR status so admins know OCR tooling is needed. |
| Hybrid keyword + semantic search | Done | Retrieval combines cosine vector similarity and lexical overlap. |
| Document re-ranking | Done | Retrieved chunks are ranked by overlap plus vector score, then focused by strongest overlap. |
| Role-based access | Done | Student/admin roles are enforced by protected routes. |
| AI-generated FAQs | Done | FAQs are generated from processed document chunks. |
| Streaming AI responses | Done | `/api/chat/stream` streams answer tokens through server-sent events. |

