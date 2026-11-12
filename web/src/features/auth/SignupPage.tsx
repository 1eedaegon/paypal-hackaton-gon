import { Link, Navigate } from "react-router";
import { Button } from "../../components/Button";
import { TextField } from "../../components/Field";
import { MIN_PASSWORD_LENGTH, validateSignup } from "../../lib/validation";
import { useAuth } from "./AuthContext";
import { AuthLayout, FormError } from "./AuthLayout";
import { useAuthForm } from "./useAuthForm";

const LINK_CLASS = "font-medium text-accent underline underline-offset-4 hover:text-accent-strong";

export function SignupPage() {
  const { status, signup } = useAuth();
  const form = useAuthForm({
    initial: { name: "", email: "", password: "" },
    validate: validateSignup,
    submit: (values) =>
      signup({ name: values.name.trim(), email: values.email.trim(), password: values.password }),
  });

  if (status === "signed_in" && !form.pending) {
    return <Navigate to="/app" replace />;
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Set up in a minute. Your first invoice is one message away."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className={LINK_CLASS}>
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={form.onSubmit} noValidate className="flex flex-col gap-4">
        <TextField
          label="Your name"
          autoComplete="name"
          value={form.values.name}
          onValueChange={form.setField("name")}
          error={form.errors.name}
        />
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
          autoComplete="new-password"
          value={form.values.password}
          onValueChange={form.setField("password")}
          error={form.errors.password}
          hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        />
        <FormError message={form.formError} />
        <Button type="submit" variant="primary" pending={form.pending} pendingLabel="Creating account…">
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
