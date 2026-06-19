"use client";
import { useCallback, useSyncExternalStore } from "react";

// ── Anthropic API key storage + validation ─────────────────────────────────────
// Foundation for optional AI features. The key lives in its OWN localStorage
// entry, deliberately separate from board state — so it is never part of the
// nodes/connections JSON and is therefore never written to a .dnkrm file or any
// PDF/MD export. It is never logged.
//
// A single module-level store backs every useApiKey() consumer: one source of
// truth (so saving the key in the AI panel instantly flips hasKey everywhere),
// no per-component state, and localStorage is read once at module load — never
// on render.

export const LS_AI_API_KEY = "denkraum_anthropic_api_key";

function readLocal(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(LS_AI_API_KEY) ?? "";
  } catch {
    return "";
  }
}

// Cached current value + subscribers. Initialised once (client: one read).
let current = readLocal();
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};
const getSnapshot = () => current;
const getServerSnapshot = () => "";

export function getApiKey(): string {
  return current;
}

export function setApiKey(key: string): void {
  current = key;
  try {
    localStorage.setItem(LS_AI_API_KEY, key);
  } catch {
    // private-mode / quota — non-critical
  }
  emit();
}

export function clearApiKey(): void {
  current = "";
  try {
    localStorage.removeItem(LS_AI_API_KEY);
  } catch {
    // ignore
  }
  emit();
}

export type ValidateResult = {
  status: "valid" | "invalid" | "error";
  message: string;
};

// Confirm a key against the Anthropic API using the token-free models endpoint
// (an authenticated GET that costs nothing): 200 → valid, 401/403 → invalid,
// network/other → error. The SDK is loaded on demand so it stays out of the
// initial canvas bundle until the user actually validates. `dangerouslyAllow-
// Browser` is required for a direct browser call (the user supplies their own
// key locally; there is no server to proxy through).
export async function validateKey(key: string): Promise<ValidateResult> {
  const trimmed = key.trim();
  if (!trimmed) return { status: "invalid", message: "Enter an API key." };

  let Anthropic: typeof import("@anthropic-ai/sdk").default;
  try {
    ({ default: Anthropic } = await import("@anthropic-ai/sdk"));
  } catch {
    return {
      status: "error",
      message: "Couldn’t load the verifier — check your connection.",
    };
  }

  try {
    const client = new Anthropic({
      apiKey: trimmed,
      dangerouslyAllowBrowser: true,
    });
    await client.models.list();
    return { status: "valid", message: "Key is valid." };
  } catch (err) {
    if (
      err instanceof Anthropic.AuthenticationError ||
      err instanceof Anthropic.PermissionDeniedError
    ) {
      return { status: "invalid", message: "Invalid API key." };
    }
    if (err instanceof Anthropic.APIConnectionError) {
      return {
        status: "error",
        message: "Network error — check your connection.",
      };
    }
    if (err instanceof Anthropic.APIError) {
      return {
        status: "error",
        message: `Couldn’t verify the key (status ${err.status}).`,
      };
    }
    return { status: "error", message: "Network error — check your connection." };
  }
}

// Reactive access to the stored key, shared across all consumers. `hasKey` is
// the gate AI features use: render AI UI only when a key is present. Backed by
// useSyncExternalStore — no per-render localStorage, no duplicated state, and
// SSR-safe (server snapshot is empty; the client reconciles after hydration).
export function useApiKey() {
  const apiKey = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const save = useCallback((key: string) => {
    const trimmed = key.trim();
    if (trimmed) setApiKey(trimmed);
    else clearApiKey();
  }, []);

  const clear = useCallback(() => {
    clearApiKey();
  }, []);

  return { apiKey, hasKey: apiKey.length > 0, save, clear };
}
