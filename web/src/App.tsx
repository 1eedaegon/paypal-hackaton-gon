import { Route, Routes } from "react-router";
import { ToastProvider } from "./components/Toast";
import { AuthProvider } from "./features/auth/AuthContext";
import { LoginPage } from "./features/auth/LoginPage";
import { RequireAuth } from "./features/auth/RequireAuth";
import { SignupPage } from "./features/auth/SignupPage";
import { LandingPage } from "./features/landing/LandingPage";
import { NotFoundPage } from "./features/NotFoundPage";
import { WorkspacePage } from "./features/workspace/WorkspacePage";

/** Routes and providers. The router itself is supplied by the caller so tests can use MemoryRouter. */
export function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route
            path="/app"
            element={
              <RequireAuth>
                <WorkspacePage />
              </RequireAuth>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </ToastProvider>
  );
}
