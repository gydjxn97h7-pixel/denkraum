"use client";
import { useCallback, useEffect, useState } from "react";

// ── Anthropic API key storage + validation ─────────────────────────────────────
// Foundation for optional AI features. The key lives in its OWN localStorage
// entry, deliberately separate from board state — so it is never part of the
// nodes/connections JSON and is therefore never written to a .dnkrm file or any
// PDF/MD export. It is never logged.

export const LS_AI_API_KEY = "denkraum_anthropic_api_key";

export function getApiKey(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(LS_AI_API_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setApiKey(key: string): void {
  try {
    localStorage.setItem(LS_AI_API_KEY, key);
  } catch {
    // private-mode / quota — non-critical
  }
}

export function clearApiKey(): void {
  try {
    localStorage.removeItem(LS_AI_API_KEY);
  } catch {
    // ignore
  }
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

// Reactive access to the stored key. `hasKey` is the gate future AI features
// use: render AI UI only when a key is present.
export function useApiKey() {
  const [apiKey, setKey] = useState("");

  // Hydrate from localStorage after mount — reading it during render would
  // break SSR and cause a hydration mismatch, so this setState-in-effect is
  // intentional and runs exactly once.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setKey(getApiKey());
  }, []);

  const save = useCallback((key: string) => {
    const trimmed = key.trim();
    if (trimmed) setApiKey(trimmed);
    else clearApiKey();
    setKey(trimmed);
  }, []);

  const clear = useCallback(() => {
    clearApiKey();
    setKey("");
  }, []);

  return { apiKey, hasKey: apiKey.length > 0, save, clear };
}
