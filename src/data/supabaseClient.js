import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabasePublishableKey && 
  !supabaseUrl.includes('placeholder') &&
  !supabaseUrl.includes('your-supabase')
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      }
    })
  : null;

const AUTH_STORAGE_KEY = 'diamond-finance-auth-session';

export async function authSignIn(email, password) {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  // Fallback demo session when Supabase env is not yet configured
  const mockUser = {
    id: 'demo-user-id',
    email: email || 'jordan@diamond.com',
    user_metadata: { full_name: 'Jordan Davis' }
  };
  const mockSession = { user: mockUser, access_token: 'mock-token' };
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(mockSession));
  return { user: mockUser, session: mockSession };
}

export async function authSignUp(email, password, fullName = 'Jordan Davis') {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName }
      }
    });
    if (error) throw error;
    return data;
  }

  const mockUser = {
    id: 'demo-user-id',
    email,
    user_metadata: { full_name: fullName }
  };
  const mockSession = { user: mockUser, access_token: 'mock-token' };
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(mockSession));
  return { user: mockUser, session: mockSession };
}

export async function authSignOut() {
  if (isSupabaseConfigured && supabase) {
    await supabase.auth.signOut();
  }
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export async function authGetSession() {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.auth.getSession();
    if (!error && data?.session) return data.session;
  }

  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}
