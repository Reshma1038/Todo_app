import api from "./axios";

export const todoApi = {
  list: (pageId) => api.get(`/pages/${pageId}/todos`),
  create: (pageId, data) => api.post(`/pages/${pageId}/todos`, data),
  get: (todoId) => api.get(`/todos/${todoId}`),
  update: (todoId, data) => api.patch(`/todos/${todoId}`, data),
  remove: (todoId) => api.delete(`/todos/${todoId}`),
  reorder: (pageId, taskIds) =>
    api.patch(`/pages/${pageId}/todos/reorder`, { task_ids: taskIds }),
  // Incomplete tasks with due dates across all my pages (for reminders).
  due: () => api.get("/todos/due"),
};
