import api from "./axios";

export const aiApi = {
  parseTask: (text) => api.post("/ai/parse-task", { text }),
  suggestPriority: (title, description) =>
    api.post("/ai/suggest-priority", { title, description }),
  nextTask: (pageId) =>
    api.get("/ai/next-task", { params: pageId ? { page_id: pageId } : {} }),
  // Conversational: questions get answers, task statements get parsed.
  assistant: (text, pageId) =>
    api.post("/ai/assistant", { text, page_id: pageId || null }),
};
