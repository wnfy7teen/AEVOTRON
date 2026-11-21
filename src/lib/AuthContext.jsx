import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { currentUrl } from "@/lib/authReturnTo";

export const authQuery = queryOptions({
  queryKey: ["auth", "me"],
  queryFn: async () => {
    if (!base44.auth.hasToken()) return { user: null, error: null };
    try {
      return { user: await base44.auth.me(), error: null };
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
    logout: () => {
      queryClient.setQueryData(authQuery.queryKey, { user: null, error: null });
      return base44.auth.logout();
    },
    navigateToLogin: () => base44.auth.redirectToLogin(currentUrl()),
  }), [data, error, isPending, queryClient]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
