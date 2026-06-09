// Auth context — admin JWT persisted via @/src/utils/storage.

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

import {
  adminLogin as apiLogin,
  adminLogout as apiLogout,
  getStoredToken,
} from "@/src/utils/api";

type AuthState = {
  ready: boolean;
  token: string | null;
  email: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const t = await getStoredToken();
      if (t) setToken(t);
      setReady(true);
    })();
  }, []);

  const login = useCallback(async (e: string, p: string) => {
    const t = await apiLogin(e, p);
    setToken(t);
    setEmail(e);
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setToken(null);
    setEmail(null);
  }, []);

  return (
    <AuthContext.Provider value={{ ready, token, email, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
