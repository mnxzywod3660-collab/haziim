const SUPABASE_URL = "https://qotfbplwpmernvwpzalm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_f-rZ31A49z5wm5nyBiSLHA_8bLNoyzE";

const { createClient } = window.supabase;

supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
