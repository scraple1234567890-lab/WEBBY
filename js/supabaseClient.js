import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

if (!SUPABASE_URL || !SUPABASE_URL.startsWith("http")) {
  throw new Error("Supabase URL invalid. Check js/config.js SUPABASE_URL (must be https://xxxx.supabase.co).");
}

if (!SUPABASE_PUBLISHABLE_KEY) {
  throw new Error("Supabase key missing. Check js/config.js SUPABASE_PUBLISHABLE_KEY.");
}

console.log("Supabase URL:", SUPABASE_URL);

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
