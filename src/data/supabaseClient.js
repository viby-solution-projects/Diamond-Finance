import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || '';
const supabasePublishableKey = (
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY) ||
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
  ''
);

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabasePublishableKey && 
  !supabaseUrl.includes('placeholder') &&
  !supabaseUrl.includes('your-supabase')
);

// Single, persistent Supabase client instance
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
 * Fetch profile record for a given user ID directly from public.profiles
 */
export async function fetchUserProfile(userId) {
  if (!isSupabaseConfigured || !supabase || !userId) return null;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, business_name, role, status, created_at, updated_at')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Supabase profile fetch error:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Exception fetching user profile:', err);
    return null;
  }
}

/**
 * Authenticate with Supabase Auth and verify account status in profiles table.
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

  // Fetch verified profile from database
  let profile = await fetchUserProfile(data.user.id);

  // If profile query returned null, construct profile from authenticated user metadata without demoting super_admin
  if (!profile) {
    const metaRole = data.user.user_metadata?.role;
    profile = {
      id: data.user.id,
      email: data.user.email,
      full_name: data.user.user_metadata?.full_name || (data.user.email?.split('@')[0] || 'Your name'),
      role: metaRole || 'staff',
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
 * Password Reset: Send password reset instructions to user email via Supabase Auth
 */
export async function authResetPasswordForEmail(email) {
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error('Please enter your email address.');
  }

  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.');
  }

  const redirectTo = typeof window !== 'undefined' 
    ? `${window.location.origin}/login?type=recovery` 
    : undefined;

  const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo,
  });

  if (error) {
    console.error('Password reset request error:', error);
    throw new Error(error.message || 'Unable to send password reset email.');
  }

  return true;
}

/**
 * Password Update: Update password for current authenticated/recovery session
 */
export async function authUpdatePassword(newPassword) {
  const cleanPassword = (newPassword || '').trim();
  if (!cleanPassword || cleanPassword.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase.auth.updateUser({
    password: cleanPassword,
  });

  if (error) {
    console.error('Password update error:', error);
    throw new Error(error.message || 'Unable to update password.');
  }

  return data;
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
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData?.session?.user) {
      return null;
    }

    const user = sessionData.session.user;
    const profile = await fetchUserProfile(user.id);

    if (profile?.status === 'disabled') {
      await supabase.auth.signOut();
      return null;
    }

    const resolvedProfile = profile || {
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name || (user.email ? user.email.split('@')[0] : 'Your name'),
      role: user.user_metadata?.role || 'staff',
      status: 'active',
    };

    return {
      ...sessionData.session,
      profile: resolvedProfile,
    };
  } catch (err) {
    console.error('Session verification failed:', err);
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
      console.error('fetchProfiles error:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('fetchProfiles failed:', err);
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
    console.error('updateProfile error:', error);
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

  // 2. Direct Auth User Creation via Supabase client (triggers profile insert)
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
