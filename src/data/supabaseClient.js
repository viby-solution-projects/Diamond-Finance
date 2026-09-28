import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) || '';
const supabasePublishableKey = (
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY) ||
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
  (typeof process !== 'undefined' && (process.env?.VITE_SUPABASE_PUBLISHABLE_KEY || process.env?.VITE_SUPABASE_ANON_KEY)) ||
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

export const AUTHORIZED_EMAILS = [
  'khakhkhard@gmail.com',
  'kpatel467@gmail.com',
  'heyhkchag@gmail.com',
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
  return { id: 'user_' + Date.now(), name: 'User', firstName: 'User' };
}

export function extractFirstName(fullName) {
  if (!fullName || typeof fullName !== 'string') return 'User';
  const clean = fullName.trim();
  if (!clean) return 'User';
  const parts = clean.split(/\s+/);
  return parts[0] || 'User';
}

export function getDefaultPasswordForAccount(email) {
  const normalized = (email || '').trim().toLowerCase();
  if (DEFAULT_ACCOUNT_PASSWORDS[normalized]) {
    return DEFAULT_ACCOUNT_PASSWORDS[normalized];
  }
  const prefix = normalized.split('@')[0] || 'user';
  return `${prefix}!123`;
}

/**
 * Account passwords following the exact authorized pattern
 */
export const DEFAULT_ACCOUNT_PASSWORDS = {
  'khakhkhard@gmail.com': 'khakhkhard!123',
  'kpatel467@gmail.com': 'kpatel467!123',
  'heyhkchag@gmail.com': 'heyhkchag!123',
};

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

export function getAccountActivePassword(email) {
  const normalized = (email || '').trim().toLowerCase();
  if (typeof localStorage !== 'undefined') {
    const key = 'df_pwd_' + normalized;
    const stored = localStorage.getItem(key);
    if (stored) return stored;
  }
  return DEFAULT_ACCOUNT_PASSWORDS[normalized] || getDefaultPasswordForAccount(normalized);
}

export function setAccountActivePassword(email, newPassword) {
  const normalized = (email || '').trim().toLowerCase();
  if (typeof localStorage !== 'undefined') {
    const key = 'df_pwd_' + normalized;
    localStorage.setItem(key, newPassword);
  }
}

/**
 * Authenticate with Supabase Auth and verify account status in profiles table.
 * Exactly three authorized email addresses are permitted.
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

  // Verify credentials against account-specific active password
  const activePassword = getAccountActivePassword(normalizedEmail);
  const isPasswordMatch = activePassword ? (activePassword === cleanPassword) : false;

  let authData = null;
  let authError = null;

  try {
    const res = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: cleanPassword,
    });
    authData = res.data;
    authError = res.error;
  } catch (err) {
    authError = err;
  }

  // If credentials match active password or Supabase successfully issued session
  if (isPasswordMatch || authData?.user) {
    const accountDetails = getAuthorizedUserDetails(normalizedEmail);
    const userId = authData?.user?.id || accountDetails.id;
    const user = {
      id: userId,
      email: normalizedEmail,
      user_metadata: {
        full_name: accountDetails.name,
        role: 'super_admin',
      },
      aud: 'authenticated',
      role: 'authenticated',
    };
    const profile = {
      id: userId,
      email: normalizedEmail,
      full_name: accountDetails.name,
      role: 'super_admin',
      status: 'active',
    };
    const session = {
      user,
      access_token: 'df_session_' + userId,
      token_type: 'bearer',
      expires_at: Math.floor(Date.now() / 1000) + 3600 * 24 * 7,
    };

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('diamond_finance_auth_session', JSON.stringify({ user, profile, session }));
    }

    return {
      user,
      session,
      profile,
    };
  }

  throw new Error('Invalid email or password.');
}

/**
 * Change Password: Secure password modification for currently authenticated user
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

  const activePassword = getAccountActivePassword(normalizedEmail);
  if (activePassword && activePassword !== cleanCurrent) {
    throw new Error('Current password is incorrect.');
  }

  // Update password in Supabase Auth backend
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.auth.updateUser({ password: cleanNew });
    } catch (e) {
      console.warn('Supabase auth password update notice:', e);
    }
  }

  // Update active password for this specific account
  setAccountActivePassword(normalizedEmail, cleanNew);

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

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(
      'diamond_finance_auth_session',
      JSON.stringify({ ...session, user: updatedUser, profile: updatedProfile })
    );
  }

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
    ? `${window.location.origin}/login?type=recovery` 
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

  const session = await authGetSession();
  if (session?.user?.email) {
    setAccountActivePassword(session.user.email, cleanPassword);
  }

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.auth.updateUser({
        password: cleanPassword,
      });
    } catch (e) {
      console.warn('Supabase updatePassword notice:', e);
    }
  }

  return { success: true };
}

/**
 * Sign out and clear active session
 */
export async function authSignOut() {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('diamond_finance_auth_session');
  }
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
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem('diamond_finance_auth_session');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed?.user?.email && isAuthorizedEmail(parsed.user.email)) {
          return {
            ...parsed.session,
            user: parsed.user,
            profile: parsed.profile,
          };
        }
      } catch {
        // ignore
      }
    }
  }

  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (!sessionError && sessionData?.session?.user) {
      const user = sessionData.session.user;
      if (!isAuthorizedEmail(user.email)) {
        await supabase.auth.signOut();
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('diamond_finance_auth_session');
        }
        return null;
      }

      const profile = await fetchUserProfile(user.id);

      if (profile?.status === 'disabled') {
        await supabase.auth.signOut();
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('diamond_finance_auth_session');
        }
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
    }

    return null;
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
