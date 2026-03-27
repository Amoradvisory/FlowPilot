import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/public';

const PUBLIC_SUPABASE_URL = env.PUBLIC_SUPABASE_URL;
const PUBLIC_SUPABASE_ANON_KEY = env.PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(PUBLIC_SUPABASE_URL && PUBLIC_SUPABASE_ANON_KEY);

export const supabase = isSupabaseConfigured
	? createClient(PUBLIC_SUPABASE_URL as string, PUBLIC_SUPABASE_ANON_KEY as string, {
			auth: {
				persistSession: true,
				autoRefreshToken: true,
				detectSessionInUrl: true
			}
		})
	: null;
