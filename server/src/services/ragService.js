import crypto from "node:crypto";
import { env } from "../config/env.js";

export const VECTOR_SIZE = 384;
export const MIN_SIMILARITY = 0.14;

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "are",
  "but",
  "with",
  "you",
  "your",
  "about",
  "from",
  "this",
  "that",
  "into",
  "what",
  "when",
  "does",
  "did",
  "do",
  "where",
  "which",
  "how",
  "will",
  "can",
  "has",
  "have",
  "been",
  "was",
  "were",
  "they",
  "their",
  "all",
  "any",
  "not",
  "college",
  "please"
]);

export function tokenize(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map(normalizeToken)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function normalizeToken(token) {
  if (token.length > 5 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 5 && token.endsWith("ing")) return token.slice(0, -3);
  if (token.length > 5 && token.endsWith("ses")) return token.slice(0, -1);
  if (token.length > 4 && token.endsWith("es")) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith("s")) return token.slice(0, -1);
  return token;
}

function hashTerm(term) {
  return crypto.createHash("sha256").update(term).digest().readUInt32BE(0);
}

export function embed(text) {
  const vector = Array(VECTOR_SIZE).fill(0);
  const tokens = tokenize(text);
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    vector[hashTerm(token) % VECTOR_SIZE] += 1;
    if (i < tokens.length - 1) vector[hashTerm(`${token}_${tokens[i + 1]}`) % VECTOR_SIZE] += 1.4;
  }
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => Number((value / magnitude).toFixed(6)));
}

function cosine(a, b) {
  let sum = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) sum += a[i] * b[i];
  return sum;
}

export function cleanText(text) {
  return (text || "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function chunkText(pages, maxWords = 190, overlapWords = 35) {
  const chunks = [];
  for (const page of pages) {
    const cleaned = cleanText(page.text);
    const segments = cleaned
      .split(/\n+|(?<=[.!?])\s+(?=[A-Z0-9])/)
      .map((segment) => segment.trim())
      .filter(Boolean);

    if (segments.length > 1) {
      for (const segment of segments) {
        const words = segment.split(/\s+/).filter(Boolean);
        if (words.length < 4) continue;
        if (words.length <= maxWords) {
          chunks.push({ text: segment, pageNumber: page.pageNumber || null });
          continue;
        }
        chunks.push(...chunkWords(words, page.pageNumber, maxWords, overlapWords));
      }
      continue;
    }

    const words = cleaned.split(/\s+/).filter(Boolean);
    chunks.push(...chunkWords(words, page.pageNumber, maxWords, overlapWords));
  }
  return chunks;
}

function chunkWords(words, pageNumber, maxWords, overlapWords) {
  const chunks = [];
  if (!words.length) return chunks;
  let start = 0;
  while (start < words.length) {
    const end = Math.min(start + maxWords, words.length);
    chunks.push({ text: words.slice(start, end).join(" "), pageNumber: pageNumber || null });
    if (end === words.length) break;
    start = Math.max(0, end - overlapWords);
  }
  return chunks;
}

export function searchChunks(db, question, limit = 5, filters = {}) {
  const queryEmbedding = embed(question);
  const queryTerms = new Set(tokenize(question));
  const allowedDocuments = db.documents.filter((document) => documentMatchesFilters(document, filters));
  const allowedIds = new Set(allowedDocuments.map((document) => document.id));
  return db.chunks
    .filter((chunk) => allowedIds.has(chunk.documentId))
    .map((chunk) => {
      const document = db.documents.find((item) => item.id === chunk.documentId);
      const lexicalOverlap = tokenize(chunk.chunkText).filter((term) => queryTerms.has(term)).length;
      return {
        ...chunk,
        documentTitle: document?.title || "Unknown document",
        lexicalOverlap,
        score: cosine(queryEmbedding, chunk.embedding)
      };
    })
    .sort((a, b) => b.lexicalOverlap + b.score - (a.lexicalOverlap + a.score))
    .slice(0, limit);
}

function documentMatchesFilters(document, filters) {
  if (filters.collection && filters.collection !== "All" && document.collection !== filters.collection) return false;
  if (filters.department && filters.department !== "All" && document.department !== filters.department) return false;
  if (filters.category && filters.category !== "All" && document.category !== filters.category) return false;
  return true;
}

function extractSentences(text) {
  return cleanText(text)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 30);
}

function buildFallbackAnswer(question, results) {
  const terms = new Set(tokenize(question));
  const scored = [];
  const seen = new Set();
  for (const result of results) {
    for (const sentence of extractSentences(result.chunkText)) {
      const key = sentence.toLowerCase().replace(/\s+/g, " ");
      if (seen.has(key)) continue;
      seen.add(key);
      const overlap = tokenize(sentence).filter((term) => terms.has(term)).length;
      scored.push({ sentence, overlap, score: result.score });
    }
  }
  const candidates = scored.some((item) => item.overlap > 0) ? scored.filter((item) => item.overlap > 0) : scored;
  const answerLines = candidates
    .sort((a, b) => b.overlap + b.score - (a.overlap + a.score))
    .slice(0, 2)
    .map((item) => item.sentence);
  if (!answerLines.length) {
    return "I found related college documents, but they do not contain a clear answer to this exact question. Please check the listed sources or ask the administration for confirmation.";
  }
  return answerLines.join(" ");
}

export async function generateAnswer(question, results, options = {}) {
  const usable = results.filter((result) => result.score >= MIN_SIMILARITY && result.lexicalOverlap > 0);
  if (!usable.length) {
    return {
      answer: localizeUnknown(options.language),
      sources: []
    };
  }
  const maxOverlap = Math.max(...usable.map((result) => result.lexicalOverlap));
  const focused = maxOverlap >= 2 ? usable.filter((result) => result.lexicalOverlap === maxOverlap) : usable;

  const sourceKeys = new Set();
  const sources = focused
    .filter((result) => {
      const key = `${result.documentTitle}:${result.pageNumber}:${result.chunkText.slice(0, 140)}`;
      if (sourceKeys.has(key)) return false;
      sourceKeys.add(key);
      return true;
    })
    .slice(0, 4)
    .map((result) => ({
      documentId: result.documentId,
      documentTitle: result.documentTitle,
      pageNumber: result.pageNumber,
      snippet: result.chunkText.slice(0, 260),
      similarityScore: Number(result.score.toFixed(3))
    }));

  if (env.openaiApiKey) {
    try {
      const context = focused
        .slice(0, 5)
        .map((item, index) => `Source ${index + 1}: ${item.documentTitle}, page ${item.pageNumber || "N/A"}\n${item.chunkText}`)
        .join("\n\n");
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { authorization: `Bearer ${env.openaiApiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: env.openaiModel,
          input: [
            {
              role: "system",
              content:
                `You are a college information assistant. Answer only from the supplied sources. If the sources do not answer the question, say the knowledge base does not contain the information. Be concise and include no unsupported claims. Answer language: ${languageName(options.language)}.`
            },
            { role: "user", content: `Question: ${question}\n\nSources:\n${context}` }
          ]
        })
      });
      if (response.ok) {
        const payload = await response.json();
        const text =
          payload.output_text ||
          payload.output?.flatMap((item) => item.content || []).find((item) => item.text)?.text ||
          "";
        if (text.trim()) return { answer: text.trim(), sources };
      }
    } catch {
      // Fall through to the local grounded answerer.
    }
  }

  return { answer: localizeAnswer(buildFallbackAnswer(question, focused), options.language), sources };
}

export function summarizeText(text, sentenceLimit = 3) {
  const sentences = extractSentences(text);
  if (!sentences.length) return cleanText(text).slice(0, 360);
  return sentences.slice(0, sentenceLimit).join(" ");
}

export function generateFaqsFromChunks(chunks, limit = 5) {
  const faqs = [];
  for (const chunk of chunks) {
    const text = chunk.text || chunk.chunkText || "";
    const topic = text.split(":")[0]?.trim();
    if (!topic || topic.length > 42 || faqs.some((faq) => faq.question.includes(topic))) continue;
    faqs.push({
      question: `What does the ${topic.toLowerCase()} document say?`,
      answer: summarizeText(text, 1)
    });
    if (faqs.length >= limit) break;
  }
  return faqs;
}

export function buildSuggestedQuestions(db, filters = {}, limit = 8) {
  const seen = new Set();
  const suggestions = [];
  const documents = db.documents.filter((document) => documentMatchesFilters(document, filters));
  const allowedIds = new Set(documents.map((document) => document.id));
  for (const chunk of db.chunks.filter((item) => allowedIds.has(item.documentId))) {
    const text = chunk.chunkText || "";
    const topic = text.split(":")[0]?.trim();
    if (!topic || seen.has(topic.toLowerCase())) continue;
    seen.add(topic.toLowerCase());
    suggestions.push(questionForTopic(topic));
    if (suggestions.length >= limit) break;
  }
  return suggestions;
}

function questionForTopic(topic) {
  const lower = topic.toLowerCase();
  if (lower.includes("fee")) return "What is the application fee?";
  if (lower.includes("hostel")) return "When does hostel registration close?";
  if (lower.includes("placement")) return "When does placement training start?";
  if (lower.includes("scholarship")) return "When do scholarship applications close?";
  if (lower.includes("department")) return "What departments are available?";
  if (lower.includes("attendance") || lower.includes("polic")) return "What is the attendance policy?";
  if (lower.includes("event")) return "When is the annual cultural fest?";
  return `What information is available about ${lower}?`;
}

function localizeUnknown(language) {
  if (language === "hi") {
    return "Uploaded college documents me is sawal ka jawab nahi mila. Kripya college administration se contact karein ya relevant document upload karein.";
  }
  return "I could not find this information in the uploaded college documents. Please contact the college administration or upload the relevant document.";
}

function localizeAnswer(answer, language) {
  if (language === "hi") return `Uploaded sources ke anusaar: ${answer}`;
  return answer;
}

function languageName(language) {
  return { en: "English", hi: "Hindi", auto: "same language as the user question" }[language] || "English";
}
