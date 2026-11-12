import { Link, Navigate } from "react-router";
import { Button } from "../../components/Button";
import { TextField } from "../../components/Field";
import { validateLogin } from "../../lib/validation";
import { useAuth } from "./AuthContext";
import { AuthLayout, FormError } from "./AuthLayout";
import { useAuthForm } from "./useAuthForm";

const LINK_CLASS = "font-medium text-accent underline underline-offset-4 hover:text-accent-strong";

export function LoginPage() {
  const { status, login } = useAuth();
  const form = useAuthForm({
    initial: { email: "", password: "" },
    validate: validateLogin,
    submit: (values) => login({ email: values.email.trim(), password: values.password }),
  });

  if (status === "signed_in" && !form.pending) {
    return <Navigate to="/app" replace />;
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to see what's outstanding and what your agent suggests next."
      footer={
        <>
          New to Duely?{" "}
          <Link to="/signup" className={LINK_CLASS}>
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={form.onSubmit} noValidate className="flex flex-col gap-4">
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={form.values.email}
          onValueChange={form.setField("email")}
          error={form.errors.email}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={form.values.password}
          onValueChange={form.setField("password")}
          error={form.errors.password}
        />
        <FormError message={form.formError} />
        <Button type="submit" variant="primary" pending={form.pending} pendingLabel="Logging in…">
          Log in
        </Button>
      </form>
    </AuthLayout>
  );
}
