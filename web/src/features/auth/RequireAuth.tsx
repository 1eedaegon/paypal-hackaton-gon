import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { FullPageStatus } from "../../components/FullPageStatus";
import { useAuth } from "./AuthContext";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === "loading") {
    return <FullPageStatus label="Opening your workspace" />;
  }
  if (status === "signed_out") {
    return <Navigate to="/login" replace />;
  }
  return children;
}
