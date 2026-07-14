import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://knsygfcykqszkkecnpdm.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_4PwonQtxav_MLmlKyX90Fg_YCRtIO6J";

export const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);