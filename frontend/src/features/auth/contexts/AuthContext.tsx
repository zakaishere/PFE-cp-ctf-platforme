"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { login as apiLogin, setToken, clearToken, type LoginRequest, type LoginResponse } from "@/lib/api";

interface AuthState {
  token: string | null;
  role: string | null;
  userId: string | null;
  email: string | null;
  firstName: string | null;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  login: (data: LoginRequest) => Promise<LoginResponse>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>(() => {
    if (typeof window === "undefined") {
      return { token: null, role: null, userId: null, email: null, firstName: null, isAuthenticated: false };
    }
    const token = localStorage.getItem("autograde_token");
    const role = localStorage.getItem("autograde_role");
    const userId = localStorage.getItem("autograde_userId");
    const email = localStorage.getItem("autograde_email");
    const firstName = localStorage.getItem("autograde_firstName");
    return { token, role, userId, email, firstName, isAuthenticated: !!token };
  });

  const login = useCallback(async (data: LoginRequest) => {
    const res = await apiLogin(data);
    setToken(res.token);
    localStorage.setItem("autograde_role", res.role);
    localStorage.setItem("autograde_userId", res.userId);
    localStorage.setItem("autograde_email", res.email);
    localStorage.setItem("autograde_firstName", res.firstName);
    document.cookie = `token=${res.token}; path=/; max-age=86400; SameSite=Strict`;
    document.cookie = `role=${res.role}; path=/; max-age=86400; SameSite=Strict`;
    setState({ token: res.token, role: res.role, userId: res.userId, email: res.email, firstName: res.firstName, isAuthenticated: true });
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
    setState({ token: null, role: null, userId: null, email: null, firstName: null, isAuthenticated: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
