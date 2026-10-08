import { createContext, useContext, useEffect, useState } from "react";
import { authApi } from "../api/authApi";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On app start, restore the session from the stored JWT (if still valid).
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then((res) => setUser(res.data))
      .catch(() => localStorage.removeItem("token"))
      .finally(() => setLoading(false));
  }, []);

  const _applyAuth = (data) => {
    localStorage.setItem("token", data.access_token);
    setUser(data.user);
    return data.user;
  };

  const login = async (email, password) => {
    const res = await authApi.login({ email, password });
    return _applyAuth(res.data);
  };

  const register = async (name, email, password, avatar) => {
    const res = await authApi.register({ name, email, password, avatar });
    return _applyAuth(res.data);
  };

  const loginWithGoogle = async (credential) => {
    const res = await authApi.googleLogin(credential);
    return _applyAuth(res.data);
  };

  /** Replace the current user object (e.g. after an avatar change). */
  const updateUser = (updated) => setUser(updated);

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        register,
        loginWithGoogle,
        updateUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
