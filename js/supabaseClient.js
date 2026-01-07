// NOTE: jsDelivr "+esm" has had breaking regressions for supabase-js in browsers.
// To keep login/logout stable without a bundler, we import from esm.sh and pin a v2 version.
// If you later switch to a bundler (Vite/Next/etc), replace this with: `import { createClient } from '@supabase/supabase-js'`.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

if (!SUPABASE_URL || !SUPABASE_URL.startsWith("http")) {
  throw new Error("Supabase URL invalid. Check js/config.js SUPABASE_URL (must be https://xxxx.supabase.co).");
}

if (!SUPABASE_ANON_KEY) {
  throw new Error("Supabase key missing. Check js/config.js SUPABASE_ANON_KEY.");
}

console.log("Supabase URL:", SUPABASE_URL);

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
