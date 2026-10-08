import api from "./axios";

export const authApi = {
  register: (data) => api.post("/auth/register", data),
  login: (data) => api.post("/auth/login", data),
  googleLogin: (credential) => api.post("/auth/google", { credential }),
  me: () => api.get("/auth/me"),
  updateAvatar: (avatar) => api.patch("/auth/me/avatar", { avatar }),
};
