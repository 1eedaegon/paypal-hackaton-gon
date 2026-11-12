import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router";
import { describeError } from "../../lib/errors";
import { hasErrors } from "../../lib/validation";
import type { FieldErrors } from "../../lib/validation";

interface AuthFormOptions<V extends Record<string, string>> {
  initial: V;
  validate: (values: V) => FieldErrors<Extract<keyof V, string>>;
  submit: (values: V) => Promise<void>;
}

/** Shared state machine for the login and signup forms: validate, submit, show the server error. */
export function useAuthForm<V extends Record<string, string>>({ initial, validate, submit }: AuthFormOptions<V>) {
  const navigate = useNavigate();
  const [values, setValues] = useState<V>(initial);
  const [errors, setErrors] = useState<FieldErrors<Extract<keyof V, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const setField = (field: keyof V) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const found = validate(values);
    setErrors(found);
    setFormError(null);
    if (hasErrors(found)) {
      return;
    }
    setPending(true);
    try {
      await submit(values);
      navigate("/app", { replace: true });
    } catch (error) {
      setFormError(describeError(error));
    } finally {
      setPending(false);
    }
  };

  return { values, errors, formError, pending, setField, onSubmit };
}
