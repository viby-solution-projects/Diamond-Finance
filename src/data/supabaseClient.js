import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (
  (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_SUPABASE_URL || '')) ||
  (typeof process !== 'undefined' && process.env && (process.env.VITE_SUPABASE_URL || '')) ||
  'https://yizdpwjoolxphamfvlel.supabase.co'
);

const supabasePublishableKey = (
  (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '')) ||
  (typeof process !== 'undefined' && process.env && (process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '')) ||
  'sb_publishable_6aHzKTbIJu-Vnfa5qynwZw_D9KHWX-m'
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

export const AUTHORIZED_EMAILS = [
  'khakhkhard@gmail.com',
  'kpatel467@gmail.com',
  'heyhkchag@gmail.com',
  'pravinthakkar8162@gmail.com',
];

export function isAuthorizedEmail(email) {
  const normalized = (email || '').trim().toLowerCase();
  return AUTHORIZED_EMAILS.includes(normalized);
}

export function getAuthorizedUserDetails(email) {
  const normalized = (email || '').trim().toLowerCase();
  if (normalized === 'khakhkhard@gmail.com') {
    return { id: 'a0e6fe4c-40d4-4ab2-ac5f-7ce70ed2678d', name: 'Khakhkhar', firstName: 'Khakhkhar' };
  }
  if (normalized === 'kpatel467@gmail.com') {
    return { id: '31f8c65b-d4a4-4040-a235-3912dbec7981', name: 'K Patel', firstName: 'KPatel' };
  }
  if (normalized === 'heyhkchag@gmail.com') {
    return { id: '45b7355e-e845-4f05-9dbe-5473de2dac6a', name: 'HK Chag', firstName: 'HK' };
  }
  if (normalized === 'pravinthakkar8162@gmail.com') {
    return { id: 'd8e4125b-9c71-4601-9a7c-871d34e40291', name: 'Pravin Thakkar', firstName: 'Pravin' };
  }
  return { id: 'user_' + Date.now(), name: 'User', firstName: 'User' };
}

export function extractFirstName(fullName) {
  if (!fullName || typeof fullName !== 'string') return 'User';
  const clean = fullName.trim();
  if (!clean) return 'User';
  const parts = clean.split(/\s+/);
  return parts[0] || 'User';
}

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
 * Exactly three authorized email addresses are permitted.
 * Real password verification is strictly performed by Supabase Auth backend.
 */
export async function authSignIn(email, password) {
  const normalizedEmail = (email || '').trim().toLowerCase();
  const cleanPassword = (password || '').trim();

  if (!normalizedEmail || !cleanPassword) {
    throw new Error('Please enter your email and password.');
  }

  // Strict authorization rule: Only authorized emails are allowed
  if (!isAuthorizedEmail(normalizedEmail)) {
    throw new Error('This email is not authorized to access Diamond Finance.');
  }

  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase authentication is not configured. Please check your environment configuration.');
  }

  // Pure Supabase Auth verification
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password: cleanPassword,
  });

  if (error || !data?.session || !data?.user) {
    throw new Error('Invalid email or password.');
  }

  // Ensure returned authenticated user belongs to the authorized whitelist
  if (!isAuthorizedEmail(data.user.email)) {
    await supabase.auth.signOut({ scope: 'local' });
    throw new Error('This email is not authorized to access Diamond Finance.');
  }

  // Fetch verified profile from database
  const profile = await fetchUserProfile(data.user.id);

  if (profile?.status === 'disabled') {
    await supabase.auth.signOut({ scope: 'local' });
    throw new Error('Account is disabled. Please contact the administrator.');
  }

  const accountDetails = getAuthorizedUserDetails(data.user.email);
  const resolvedProfile = profile ? {
    ...profile,
    role: 'super_admin',
    status: 'active',
  } : {
    id: data.user.id,
    email: data.user.email,
    full_name: data.user.user_metadata?.full_name || accountDetails.name,
    role: 'super_admin',
    status: 'active',
  };

  return {
    user: data.user,
    session: data.session,
    profile: resolvedProfile,
  };
}

/**
 * Change Password: Secure password modification for currently authenticated user
 * Verifies current password using Supabase Auth before applying new password.
 */
export async function authChangePassword({ currentPassword, newPassword, confirmPassword }) {
  const session = await authGetSession();
  if (!session?.user?.email) {
    throw new Error('You must be signed in to change your password.');
  }

  const normalizedEmail = session.user.email.trim().toLowerCase();
  const cleanCurrent = (currentPassword || '').trim();
  const cleanNew = (newPassword || '').trim();
  const cleanConfirm = (confirmPassword || '').trim();

  if (!cleanCurrent) {
    throw new Error('Please enter your current password.');
  }
  if (!cleanNew) {
    throw new Error('Please enter your new password.');
  }
  if (cleanNew.length < 6) {
    throw new Error('New password must be at least 6 characters long.');
  }
  if (cleanNew !== cleanConfirm) {
    throw new Error('New password and confirmation do not match.');
  }

  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase authentication is not configured.');
  }

  // Verify current password via Supabase Auth
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password: cleanCurrent,
  });

  if (verifyError) {
    throw new Error('Current password is incorrect.');
  }

  // Update password in Supabase Auth backend
  const { error: updateError } = await supabase.auth.updateUser({
    password: cleanNew,
  });

  if (updateError) {
    throw new Error(updateError.message || 'Unable to update password.');
  }

  return { success: true, message: 'Password changed successfully.' };
}

/**
 * Update current user's profile information (Name)
 */
export async function updateCurrentUserProfile({ fullName }) {
  const session = await authGetSession();
  if (!session?.user) {
    throw new Error('You must be signed in to update your profile.');
  }

  const trimmedName = (fullName || '').trim();
  if (!trimmedName) {
    throw new Error('Please enter your name.');
  }

  const updatedUser = {
    ...session.user,
    user_metadata: {
      ...session.user.user_metadata,
      full_name: trimmedName,
    },
  };

  const updatedProfile = {
    ...session.profile,
    full_name: trimmedName,
    updated_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('profiles').update({
        full_name: trimmedName,
        updated_at: new Date().toISOString(),
      }).eq('id', session.user.id);
    } catch (e) {
      console.warn('Profile name remote sync notice:', e);
    }
  }

  return { user: updatedUser, profile: updatedProfile };
}

/**
 * Password Reset: Send password reset instructions to user email via Supabase Auth
 */
export async function authResetPasswordForEmail(email) {
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error('Please enter your email address.');
  }

  if (!isAuthorizedEmail(normalizedEmail)) {
    throw new Error('This email is not authorized to access Diamond Finance.');
  }

  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.');
  }

  const redirectTo = typeof window !== 'undefined' 
    ? `${window.location.origin}/?type=recovery` 
    : undefined;

  const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo,
  });

  if (error) {
    if (error.status === 429 || error.message?.toLowerCase().includes('rate limit')) {
      return true;
    }
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

  return { success: true, data };
}

/**
 * Sign out and clear active session locally on this device.
 * Uses scope: 'local' so other devices and browsers remain logged in simultaneously.
 */
export async function authSignOut() {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      console.warn('Supabase signOut notice:', e);
    }
  }
}

/**
 * Restore active session from Supabase Auth and verify account status in profiles
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
    if (!isAuthorizedEmail(user.email)) {
      await supabase.auth.signOut({ scope: 'local' });
      return null;
    }

    const profile = await fetchUserProfile(user.id);

    if (profile?.status === 'disabled') {
      await supabase.auth.signOut({ scope: 'local' });
      return null;
    }

    const accountDetails = getAuthorizedUserDetails(user.email);
    const resolvedProfile = profile ? {
      ...profile,
      role: 'super_admin',
      status: 'active',
    } : {
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name || accountDetails.name,
      role: 'super_admin',
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
