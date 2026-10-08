import api from "./axios";

export const pageApi = {
  list: () => api.get("/pages"),
  create: (data) => api.post("/pages", data),
  get: (pageId) => api.get(`/pages/${pageId}`),
  rename: (pageId, data) => api.patch(`/pages/${pageId}`, data),
  remove: (pageId) => api.delete(`/pages/${pageId}`),
  members: (pageId) => api.get(`/pages/${pageId}/members`),
  addMember: (pageId, email) => api.post(`/pages/${pageId}/members`, { email }),
  removeMember: (pageId, userId) =>
    api.delete(`/pages/${pageId}/members/${userId}`),
};
