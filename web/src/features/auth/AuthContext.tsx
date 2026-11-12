import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api, setUnauthorizedHandler } from "../../lib/api";
import type { User } from "../../lib/types";
import { clearChatHistory } from "../agent/chatStorage";

type AuthStatus = "loading" | "signed_in" | "signed_out";

interface AuthState {
  status: AuthStatus;
  user: User | null;
  login: (input: { email: string; password: string }) => Promise<void>;
  signup: (input: { name: string; email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);

  const signOutLocally = useCallback(() => {
    setUser(null);
    setStatus("signed_out");
  }, []);

  const signIn = useCallback((next: User) => {
    setUser(next);
    setStatus("signed_in");
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(signOutLocally);
    // Any failure here (401 or server unreachable) means we cannot show the app: treat as signed out.
    api.me().then(({ user: current }) => signIn(current), signOutLocally);
    return () => setUnauthorizedHandler(null);
  }, [signIn, signOutLocally]);

  const value = useMemo<AuthState>(
    () => ({
      status,
      user,
      login: async (input) => signIn((await api.login(input)).user),
      signup: async (input) => signIn((await api.signup(input)).user),
      logout: async () => {
        await api.logout();
        clearChatHistory();
        signOutLocally();
      },
    }),
    [status, user, signIn, signOutLocally],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
