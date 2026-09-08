import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || '';
const supabasePublishableKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY) || '';

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
const PROFILES_LOCAL_KEY = 'diamond-finance-profiles-local';

const initialLocalProfiles = [
  {
    id: 'admin-user-id',
    email: 'admin@diamondfinance.com',
    full_name: 'Super Admin',
    role: 'super_admin',
    status: 'active',
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: 'demo-user-id',
    email: 'jordan@diamond.com',
    full_name: 'Jordan Davis',
    role: 'staff',
    status: 'active',
    created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
  },
  {
    id: 'staff-2-id',
    email: 'sarah.chen@diamond.com',
    full_name: 'Sarah Chen',
    role: 'staff',
    status: 'active',
    created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
  }
];

function getLocalProfiles() {
  try {
    const raw = localStorage.getItem(PROFILES_LOCAL_KEY);
    if (!raw) {
      localStorage.setItem(PROFILES_LOCAL_KEY, JSON.stringify(initialLocalProfiles));
      return initialLocalProfiles;
    }
    return JSON.parse(raw);
  } catch {
    return initialLocalProfiles;
  }
}

function saveLocalProfiles(profiles) {
  try {
    localStorage.setItem(PROFILES_LOCAL_KEY, JSON.stringify(profiles));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Authenticate with Supabase Auth and verify account status in profiles table.
 */
export async function authSignIn(email, password) {
  const normalizedEmail = (email || '').trim().toLowerCase();

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error || !data?.user) {
        throw new Error('Invalid email or password.');
      }

      // Fetch profile to verify role and status
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileErr) {
        console.warn('Profile fetch warning:', profileErr);
      }

      // If account is disabled, immediately revoke session
      if (profile && profile.status === 'disabled') {
        await supabase.auth.signOut();
        throw new Error('Your account has been disabled. Please contact your administrator.');
      }

      const mergedProfile = profile || {
        id: data.user.id,
        email: data.user.email,
        full_name: data.user.user_metadata?.full_name || 'Staff Member',
        role: 'staff',
        status: 'active',
      };

      return {
        user: data.user,
        session: data.session,
        profile: mergedProfile,
      };
    } catch (err) {
      if (err.message && err.message.includes('disabled')) {
        throw err;
      }
      throw new Error('Invalid email or password.');
    }
  }

  // Fallback demo/offline authentication
  const profiles = getLocalProfiles();
  const matchingProfile = profiles.find((p) => p.email.toLowerCase() === normalizedEmail);

  if (matchingProfile && matchingProfile.status === 'disabled') {
    throw new Error('Your account has been disabled. Please contact your administrator.');
  }

  const role = matchingProfile?.role || (normalizedEmail.includes('admin') ? 'super_admin' : 'staff');
  const fullName = matchingProfile?.full_name || (role === 'super_admin' ? 'Super Admin' : 'Jordan Davis');

  const mockUser = {
    id: matchingProfile?.id || (role === 'super_admin' ? 'admin-user-id' : 'demo-user-id'),
    email: normalizedEmail,
    user_metadata: { full_name: fullName },
  };

  const mockProfile = {
    id: mockUser.id,
    email: normalizedEmail,
    full_name: fullName,
    role,
    status: 'active',
  };

  const mockSession = { user: mockUser, access_token: 'mock-token', profile: mockProfile };
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(mockSession));
  return { user: mockUser, session: mockSession, profile: mockProfile };
}

/**
 * Sign out and clear cached auth state
 */
export async function authSignOut() {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Supabase sign out error:', e);
    }
  }
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

/**
 * Restore active session and verify account status
 */
export async function authGetSession() {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (!error && data?.session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.session.user.id)
          .maybeSingle();

        if (profile?.status === 'disabled') {
          await supabase.auth.signOut();
          return null;
        }

        const mergedProfile = profile || {
          id: data.session.user.id,
          email: data.session.user.email,
          full_name: data.session.user.user_metadata?.full_name || 'Staff Member',
          role: 'staff',
          status: 'active',
        };

        return {
          ...data.session,
          profile: mergedProfile,
        };
      }
    } catch (err) {
      console.warn('Session verification failed:', err);
      return null;
    }
  }

  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    
    // Check if status in local profiles was disabled
    if (parsed?.profile?.id) {
      const profiles = getLocalProfiles();
      const currentProfile = profiles.find((p) => p.id === parsed.profile.id);
      if (currentProfile?.status === 'disabled') {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        return null;
      }
      if (currentProfile) {
        parsed.profile = currentProfile;
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * SUPER ADMIN: Fetch authorized users/profiles list
 */
export async function fetchProfiles() {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data;
      }
    } catch (err) {
      console.warn('fetchProfiles remote error:', err);
    }
  }

  return getLocalProfiles();
}

/**
 * SUPER ADMIN: Update profile details (Name, Status)
 */
export async function updateProfile(userId, updates) {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (data) return data;
  }

  // Update local fallback store
  const profiles = getLocalProfiles();
  const updated = profiles.map((p) => (p.id === userId ? { ...p, ...updates } : p));
  saveLocalProfiles(updated);
  return updated.find((p) => p.id === userId);
}

/**
 * SUPER ADMIN: Toggle user status (active / disabled)
 */
export async function toggleUserStatus(userId, currentStatus) {
  const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
  return updateProfile(userId, { status: newStatus });
}

/**
 * SUPER ADMIN: Create authorized staff user
 * Note: Privileged Supabase Auth user creation securely calls server-side endpoint/Edge Function
 * without exposing the service_role key to the frontend.
 */
export async function createAuthorizedUser({ fullName, email, temporaryPassword, role = 'staff' }) {
  const normalizedEmail = email.trim().toLowerCase();
  const enforcedRole = 'staff'; // Enforce Staff only - no additional super admins allowed

  if (isSupabaseConfigured && supabase) {
    try {
      // Attempt call to secure backend edge function if configured
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: normalizedEmail,
          password: temporaryPassword,
          full_name: fullName.trim(),
          role: enforcedRole,
        },
      });

      if (!error && data?.user) {
        return data;
      }
    } catch (err) {
      console.warn('Edge function not available, creating profile entry:', err);
    }
  }

  // Local / Database fallback profile record
  const newProfile = {
    id: `user-${Date.now()}`,
    email: normalizedEmail,
    full_name: fullName.trim(),
    role: enforcedRole,
    status: 'active',
    created_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('profiles').upsert(newProfile);
    } catch (e) {
      console.warn('Direct profile upsert error:', e);
    }
  }

  const profiles = getLocalProfiles();
  profiles.unshift(newProfile);
  saveLocalProfiles(profiles);
  return { profile: newProfile };
}
