import api from "./axios";

export const analyticsApi = {
  summary: (pageId) =>
    api.get("/analytics/summary", { params: pageId ? { page_id: pageId } : {} }),
};
