import { useCallback, useState } from "react";
import { useToast } from "../components/Toast";
import { describeError, isApiError } from "./errors";

/**
 * Runs one async task at a time, exposes `pending` for the button, and surfaces any failure
 * as a toast. Resolves to true on success. 401s are handled globally (redirect to /login).
 */
export function useAsyncAction() {
  const [pending, setPending] = useState(false);
  const toast = useToast();

  const run = useCallback(
    async (task: () => Promise<void>): Promise<boolean> => {
      setPending(true);
      try {
        await task();
        return true;
      } catch (error) {
        if (!isApiError(error, "unauthorized")) {
          toast.error(describeError(error));
        }
        return false;
      } finally {
        setPending(false);
      }
    },
    [toast],
  );

  return { pending, run };
}
