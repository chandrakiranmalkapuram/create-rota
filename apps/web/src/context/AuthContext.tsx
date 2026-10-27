import React, { createContext, useContext, useState, useEffect } from "react";
import { User, Workspace, AuthResponse, MeResponse } from "../types/auth";

interface AuthContextType {
  user: User | null;
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { first_name: string; last_name: string; email: string; password: string }) => Promise<void>;
  logout: () => void;
  verifyEmail: (token: string) => Promise<string>;
  resendVerification: (email: string) => Promise<string>;
  forgotPassword: (email: string) => Promise<string>;
  resetPassword: (token: string, new_password: string) => Promise<string>;
  switchWorkspace: (workspaceId: string) => void;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("create_rota_token"));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshMe = async () => {
    const storedToken = localStorage.getItem("create_rota_token");
    if (!storedToken) {
      setUser(null);
      setWorkspaces([]);
      setCurrentWorkspace(null);
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/v1/auth/me", {
        headers: {
          Authorization: `Bearer ${storedToken}`,
        },
      });

      if (res.ok) {
        const data: MeResponse = await res.json();
        setUser(data.user);
        setWorkspaces(data.workspaces);
        if (data.workspaces.length > 0) {
          // Keep current or select first
          setCurrentWorkspace((prev) => {
            if (prev && data.workspaces.some((w) => w.id === prev.id)) {
              return prev;
            }
            return data.workspaces[0];
          });
        }
      } else {
        // Token expired or invalid
        localStorage.removeItem("create_rota_token");
        setToken(null);
        setUser(null);
        setWorkspaces([]);
        setCurrentWorkspace(null);
      }
    } catch {
      // Offline / network failure
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshMe();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || "Login failed. Please check your credentials.");
    }

    const data: AuthResponse = await res.json();
    localStorage.setItem("create_rota_token", data.access_token);
    setToken(data.access_token);
    await refreshMe();
  };

  const register = async (data: { first_name: string; last_name: string; email: string; password: string }) => {
    const res = await fetch("/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || "Registration failed. Please check your details.");
    }

    const authData: AuthResponse = await res.json();
    localStorage.setItem("create_rota_token", authData.access_token);
    setToken(authData.access_token);
    await refreshMe();
  };

  const logout = () => {
    fetch("/api/v1/auth/logout", { method: "POST" }).catch(() => {});
    localStorage.removeItem("create_rota_token");
    setToken(null);
    setUser(null);
    setWorkspaces([]);
    setCurrentWorkspace(null);
  };

  const verifyEmail = async (verifyToken: string): Promise<string> => {
    const res = await fetch("/api/v1/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: verifyToken }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || "Email verification failed or token expired.");
    }
    await refreshMe();
    return data.message || "Email verified successfully.";
  };

  const resendVerification = async (email: string): Promise<string> => {
    const res = await fetch("/api/v1/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    return data.message || "Verification link sent.";
  };

  const forgotPassword = async (email: string): Promise<string> => {
    const res = await fetch("/api/v1/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    return data.message || "Password reset instructions sent.";
  };

  const resetPassword = async (resetToken: string, new_password: string): Promise<string> => {
    const res = await fetch("/api/v1/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: resetToken, new_password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || "Password reset failed. Link may be expired.");
    }
    return data.message || "Password reset successfully.";
  };

  const switchWorkspace = (workspaceId: string) => {
    const found = workspaces.find((w) => w.id === workspaceId);
    if (found) {
      setCurrentWorkspace(found);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        workspaces,
        currentWorkspace,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        register,
        logout,
        verifyEmail,
        resendVerification,
        forgotPassword,
        resetPassword,
        switchWorkspace,
        refreshMe,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
