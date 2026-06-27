"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { authApi, type MeResponse } from "@/lib/api/auth";

type AuthState = {
  token: string | null;
  user: MeResponse | null;
  loading: boolean;
  login: (token: string) => Promise<MeResponse>;
  refresh: () => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("token");
    const settle = stored
      ? authApi
          .me(stored)
          .then((u) => {
            setToken(stored);
            setUser(u);
          })
          .catch(() => localStorage.removeItem("token"))
      : Promise.resolve();

    void settle.finally(() => setLoading(false));
  }, []);

  async function login(newToken: string) {
    const u = await authApi.me(newToken);
    localStorage.setItem("token", newToken);
    setToken(newToken);
    setUser(u);
    return u;
  }

  async function refresh() {
    const stored = localStorage.getItem("token");
    if (!stored) return;
    const u = await authApi.me(stored);
    setUser(u);
  }

  function logout() {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{ token, user, loading, login, refresh, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
