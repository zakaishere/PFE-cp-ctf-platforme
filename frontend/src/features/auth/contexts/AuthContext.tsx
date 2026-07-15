"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { login as apiLogin, setToken, clearToken, getMyProfile, type LoginRequest, type LoginResponse } from "@/lib/api";

interface AuthState {
  token: string | null;
  role: string | null;
  userId: string | null;
  email: string | null;
  firstName: string | null;
  isAuthenticated: boolean;
  avatarId: string | null;
}

interface AuthContextType extends AuthState {
  login: (data: LoginRequest) => Promise<LoginResponse>;
  logout: () => void;
  setAvatarId: (id: string | null) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>(() => {
    if (typeof window === "undefined") {
      return { token: null, role: null, userId: null, email: null, firstName: null, isAuthenticated: false, avatarId: null };
    }
    const token = localStorage.getItem("autograde_token");
    const role = localStorage.getItem("autograde_role");
    const userId = localStorage.getItem("autograde_userId");
    const email = localStorage.getItem("autograde_email");
    const firstName = localStorage.getItem("autograde_firstName");
    return { token, role, userId, email, firstName, isAuthenticated: !!token, avatarId: null };
  });

  // Avatar isn't part of the login payload — fetch it once so the navbar
  // chip reflects the user's saved pick without waiting for a profile visit.
  useEffect(() => {
    if (!state.isAuthenticated) return;
    let cancelled = false;
    getMyProfile().then(p => { if (!cancelled) setState(s => ({ ...s, avatarId: p.avatarId })); }).catch(() => {});
    return () => { cancelled = true; };
  }, [state.isAuthenticated]);

  const setAvatarId = useCallback((id: string | null) => {
    setState(s => ({ ...s, avatarId: id }));
  }, []);

  const login = useCallback(async (data: LoginRequest) => {
    const res = await apiLogin(data);
    setToken(res.token);
    localStorage.setItem("autograde_role", res.role);
    localStorage.setItem("autograde_userId", res.userId);
    localStorage.setItem("autograde_email", res.email);
    localStorage.setItem("autograde_firstName", res.firstName);
    document.cookie = `token=${res.token}; path=/; max-age=86400; SameSite=Strict`;
    document.cookie = `role=${res.role}; path=/; max-age=86400; SameSite=Strict`;
    setState({ token: res.token, role: res.role, userId: res.userId, email: res.email, firstName: res.firstName, isAuthenticated: true, avatarId: null });
    return res;
  }, []);

  const logout = useCallback(() => {
    clearToken();
    localStorage.removeItem("autograde_role");
    localStorage.removeItem("autograde_userId");
    localStorage.removeItem("autograde_email");
    localStorage.removeItem("autograde_firstName");
    localStorage.removeItem("autograde_onboarded");
    document.cookie = `token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    document.cookie = `role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    setState({ token: null, role: null, userId: null, email: null, firstName: null, isAuthenticated: false, avatarId: null });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, setAvatarId }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
