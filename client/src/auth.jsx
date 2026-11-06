import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .me()
      .then((r) => setUser(r.user))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const r = await api.login(email, password);
    setUser(r.user);
  };
  const logout = async () => {
    await api.logout().catch(() => {});
    setUser(null);
  };
  const refresh = async () => {
    try {
      const r = await api.me();
      setUser(r.user);
    } catch {
      /* keep the current user; the next request will surface a real sign-out */
    }
  };
  return <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>{children}</AuthContext.Provider>;
}
