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
        detectSessionInUrl: true,
      }
    })
  : null;

/**
 * Authenticate with Supabase Auth and verify account status in profiles table.
 * Strictly verifies against Supabase Auth.
 */
export async function authSignIn(email, password) {
  const normalizedEmail = (email || '').trim().toLowerCase();
  const cleanPassword = (password || '').trim();

  if (!normalizedEmail || !cleanPassword) {
    throw new Error('Please enter your email and password.');
  }

  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase authentication is not configured. Please check your environment configuration.');
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password: cleanPassword,
  });

  if (error || !data?.user) {
    throw new Error('Invalid email or password.');
  }

  // Fetch profile to verify role and status
  let profile = null;
  try {
    const { data: profileData, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .maybeSingle();

    if (!profileErr && profileData) {
      profile = profileData;
    }
  } catch (err) {
    console.warn('Profile fetch warning:', err);
  }

  // If profile does not exist yet (e.g. before trigger), create fallback profile
  if (!profile) {
    profile = {
      id: data.user.id,
      email: data.user.email,
      full_name: data.user.user_metadata?.full_name || 'Staff Member',
      role: 'staff',
      status: 'active',
    };
  }

  // If account is disabled, immediately revoke session and reject
  if (profile.status === 'disabled') {
    await supabase.auth.signOut();
    throw new Error('Your account has been disabled. Please contact your administrator.');
  }

  return {
    user: data.user,
    session: data.session,
    profile,
  };
}

/**
 * Sign out and clear active session
 */
export async function authSignOut() {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Supabase signOut notice:', e);
    }
  }
}

/**
 * Restore active session and verify account status in profiles
 */
export async function authGetSession() {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data?.session?.user) {
      return null;
    }

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
  } catch (err) {
    console.warn('Session verification failed:', err);
    return null;
  }
}

/**
 * SUPER ADMIN: Fetch authorized users/profiles list from Supabase
 */
export async function fetchProfiles() {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('fetchProfiles error:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.warn('fetchProfiles failed:', err);
    return [];
  }
}

/**
 * SUPER ADMIN: Update profile details (Name, Status)
 */
export async function updateProfile(userId, updates) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.');
  }

  // Prevent modifying role to super_admin through normal update
  const sanitizedUpdates = { ...updates };
  delete sanitizedUpdates.role;
  sanitizedUpdates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('profiles')
    .update(sanitizedUpdates)
    .eq('id', userId)
    .select()
    .maybeSingle();

  if (error) {
    throw new Error('Unable to update user profile. Please try again.');
  }
  return data;
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
 * Invokes secure server-side Edge Function (or standard Supabase signUp if self-serve/direct)
 * strictly without placing the service_role key into the client bundle.
 */
export async function createAuthorizedUser({ fullName, email, temporaryPassword }) {
  const normalizedEmail = email.trim().toLowerCase();
  const trimmedName = fullName.trim();
  const enforcedRole = 'staff';

  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.');
  }

  // 1. First attempt call to secure backend edge function if deployed
  try {
    const { data, error } = await supabase.functions.invoke('create-user', {
      body: {
        email: normalizedEmail,
        password: temporaryPassword,
        full_name: trimmedName,
        role: enforcedRole,
      },
    });

    if (!error && data?.user) {
      return data;
    }
  } catch (err) {
    console.warn('Edge function invoke notice (falling back to direct client provisioning):', err);
  }

  // 2. Direct Auth User Creation via Supabase client (creates user & triggers profile insert)
  try {
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: temporaryPassword,
      options: {
        data: {
          full_name: trimmedName,
          role: enforcedRole,
        },
      },
    });

    if (signUpError) {
      if (signUpError.message?.toLowerCase().includes('already registered')) {
        throw new Error('A user with this email address already exists.');
      }
      throw new Error(signUpError.message || 'Unable to create user.');
    }

    if (signUpData?.user) {
      // Ensure profile record is updated with proper full_name and active status
      await supabase.from('profiles').upsert({
        id: signUpData.user.id,
        email: normalizedEmail,
        full_name: trimmedName,
        role: enforcedRole,
        status: 'active',
      });

      return {
        user: signUpData.user,
        profile: {
          id: signUpData.user.id,
          email: normalizedEmail,
          full_name: trimmedName,
          role: enforcedRole,
          status: 'active',
          created_at: new Date().toISOString(),
        }
      };
    }
  } catch (err) {
    throw err;
  }

  throw new Error('Unable to create user. Please check your Supabase Auth configuration.');
}
