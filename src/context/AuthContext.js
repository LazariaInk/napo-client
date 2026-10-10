import { createContext, useContext, useMemo, useState } from 'react';
import * as api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(false);

  const value = useMemo(
    () => ({
      user,
      accessToken,
      loading,
      isAuthenticated: Boolean(accessToken),
      async loginWithEmail(email, password) {
        setLoading(true);
        try {
          const response = await api.login(email, password);
          setUser(response);
          setAccessToken(response.accessToken);
          return response;
        } finally {
          setLoading(false);
        }
      },
      async registerWithEmail(email, password, displayName) {
        setLoading(true);
        try {
          const response = await api.register(email, password, displayName);
          setUser(response);
          setAccessToken(response.accessToken);
          return response;
        } finally {
          setLoading(false);
        }
      },
      logout() {
        setUser(null);
        setAccessToken(null);
      },
    }),
    [accessToken, loading, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}