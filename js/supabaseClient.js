import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://apfchzqeuuxsvutervja.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_um3GXmNltcHQYRThIQFbxQ_RGxosoL7";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
