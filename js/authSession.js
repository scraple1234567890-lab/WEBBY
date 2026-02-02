import { supabase } from "./supabaseClient.js";

// Shared helper to prevent multiple scripts from calling
// supabase.auth.getSession() simultaneously.
//
// In some environments, concurrent getSession() calls can result in:
//   AbortError: signal is aborted without reason

let inFlightPromise = null;

function isAbortError(err) {
  if (!err) return false;
  if (err.name === "AbortError") return true;

  const message = typeof err.message === "string" ? err.message.toLowerCase() : "";
  return message.includes("signal is aborted") || message.includes("aborterror");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getSessionSafe({ retries = 1, retryDelayMs = 75 } = {}) {
  if (inFlightPromise) return inFlightPromise;

  inFlightPromise = (async () => {
    try {
      return await supabase.auth.getSession();
    } catch (err) {
      if (isAbortError(err) && retries > 0) {
        await sleep(retryDelayMs);
        inFlightPromise = null;
        return await getSessionSafe({ retries: retries - 1, retryDelayMs });
      }
      throw err;
    } finally {
      // Clear for future calls.
      if (inFlightPromise) {
        inFlightPromise = null;
      }
    }
  })();

  return inFlightPromise;
}

export function isAbortLikeError(err) {
  return isAbortError(err);
}
