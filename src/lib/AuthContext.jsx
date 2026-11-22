import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useMemo } from "react";
import { api } from "@/api/client";
import { currentUrl } from "@/lib/authReturnTo";

export const DEMO_AUTH_STORAGE_KEY = "aevotron-demo-auth";

export function readDemoUser() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(DEMO_AUTH_STORAGE_KEY);
    if (!raw) {
      // Cloudflare Workers Preview is intentionally a backend-free demo surface.
      // Provide a local demo identity so protected routes never call /api/v1/auth/me.
      if (!isDemoAuthEnabled()) return null;
      return {
        id: "demo-user",
        email: "demo@aevotron.local",
        display_name: "Preview User",
        role: "user",
        email_verified: true,
        demo: true,
      };
    }
    const saved = JSON.parse(raw);
    if (saved?.authenticated !== true) return null;
    return {
      id: "demo-user",
      email: saved.email || "demo@aevotron.local",
      display_name: saved.display_name || "Demo User",
      role: "user",
      email_verified: true,
      demo: true,
    };
  } catch {
    return null;
  }
}

export function isDemoAuthenticated() {
  return Boolean(readDemoUser());
}

export function isDemoAuthEnabled() {
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname;
  return import.meta.env.DEV
    || import.meta.env.VITE_DEMO_AUTH === "true"
    || (hostname.includes("preview") && hostname.endsWith(".workers.dev"));
}

export const authQuery = queryOptions({
  queryKey: ["auth", "me"],
  queryFn: async () => {
    const demoUser = readDemoUser();
    if (demoUser) return { user: demoUser, error: null };
    if (!api.auth.hasToken()) return { user: null, error: null };
    try {
      return { user: await api.auth.me(), error: null };
    } catch (err) {
      if (err?.status === 401 || err?.status === 403) return { user: null, error: null };
      throw err;
    }
  },
  staleTime: Infinity,
  retry: false,
  enabled: typeof window !== "undefined",
});

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const { data, error, isPending } = useQuery(authQuery);
  const value = useMemo(() => ({
    user: data?.user ?? null,
    isAuthenticated: Boolean(data?.user),
    isLoadingAuth: isPending,
    authError: error ? { type: "unknown", message: error.message ?? "Failed to load session" } : null,
    refresh: () => queryClient.fetchQuery({ ...authQuery, staleTime: 0 }),
    signInDemo: (email = "demo@aevotron.local") => {
      const normalizedEmail = String(email).trim().toLowerCase() || "demo@aevotron.local";
      const user = {
        id: "demo-user",
        email: normalizedEmail,
        display_name: normalizedEmail.split("@")[0] || "Demo User",
        role: "user",
        email_verified: true,
        demo: true,
      };
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(DEMO_AUTH_STORAGE_KEY, JSON.stringify({
          authenticated: true,
          email: user.email,
          display_name: user.display_name,
        }));
      }
      queryClient.setQueryData(authQuery.queryKey, { user, error: null });
      return user;
    },
    logout: () => {
      if (typeof window !== "undefined" && isDemoAuthenticated()) {
        window.sessionStorage.removeItem(DEMO_AUTH_STORAGE_KEY);
        queryClient.setQueryData(authQuery.queryKey, { user: null, error: null });
        window.location.assign("/");
        return Promise.resolve();
      }
      queryClient.setQueryData(authQuery.queryKey, { user: null, error: null });
      return api.auth.logout();
    },
    navigateToLogin: () => api.auth.redirectToLogin(currentUrl()),
  }), [data, error, isPending, queryClient]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
