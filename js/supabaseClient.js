import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

// In some environments, Supabase requests can sporadically throw:
//   AbortError: signal is aborted without reason
// This is usually harmless (navigation) or transient (concurrent requests).
// We guard against it here so it doesn't break login or spam the console.

let isPageLeaving = false;
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    isPageLeaving = true;
  });
  window.addEventListener("beforeunload", () => {
    isPageLeaving = true;
  });

  // Suppress noisy AbortError unhandled rejections coming from dependency internals.
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event?.reason;
    if (isAbortLikeError(reason)) {
      event.preventDefault();
    }
  });
}

function isAbortLikeError(err) {
  if (!err) return false;
  if (err.name === "AbortError") return true;
  const msg = typeof err.message === "string" ? err.message.toLowerCase() : "";
  return msg.includes("aborterror") || msg.includes("signal is aborted");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resilientFetch(input, init = {}) {
  // Retry abort-like failures a couple of times (unless we're navigating away).
  const maxRetries = 2;
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fetch(input, init);
    } catch (err) {
      if (isAbortLikeError(err) && !isPageLeaving && attempt < maxRetries) {
        attempt += 1;
        // If a signal caused the abort, do not reuse it on retry.
        const nextInit = { ...init };
        if ("signal" in nextInit) delete nextInit.signal;
        await sleep(75 * attempt);
        init = nextInit;
        continue;
      }
      throw err;
    }
  }
}

if (!SUPABASE_URL || !SUPABASE_URL.startsWith("http")) {
  throw new Error("Supabase URL invalid. Check js/config.js SUPABASE_URL (must be https://xxxx.supabase.co).");
}

if (!SUPABASE_ANON_KEY) {
  throw new Error("Supabase key missing. Check js/config.js SUPABASE_ANON_KEY.");
}

console.log("Supabase URL:", SUPABASE_URL);

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: {
    fetch: resilientFetch,
  },
});
