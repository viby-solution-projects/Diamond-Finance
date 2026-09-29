import { readFileSync } from 'fs';
import { resolve } from 'path';

console.log('================================================================');
console.log('DIAMOND FINANCE — 4-ACCOUNT LIFECYCLE & MANAGEMENT TEST');
console.log('================================================================\n');

// 1. Load Supabase configuration
const envContent = readFileSync(resolve('.env'), 'utf-8');
const supabaseUrlMatch = envContent.match(/VITE_SUPABASE_URL=(.*)/);
const supabaseKeyMatch = envContent.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.*)/);

process.env.VITE_SUPABASE_URL = supabaseUrlMatch ? supabaseUrlMatch[1].trim() : '';
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = supabaseKeyMatch ? supabaseKeyMatch[1].trim() : '';

// Polyfill localStorage for Node test runner
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => store.get(key) || null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
}

const {
  supabase,
  authSignIn,
  authSignOut,
  authGetSession,
  authChangePassword,
  updateCurrentUserProfile,
  authResetPasswordForEmail,
  isAuthorizedEmail,
  AUTHORIZED_EMAILS,
} = await import('../src/data/supabaseClient.js');

const { supabaseRepository } = await import('../src/data/repository.js');

let passedTests = 0;
let totalTests = 0;

function assert(description, condition, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`[PASS] ${description}`);
    if (details) console.log(`       Evidence: ${details}`);
  } else {
    console.error(`[FAIL] ${description}`);
    if (details) console.error(`       Error: ${details}`);
  }
}

// -----------------------------------------------------------------------------
// Setup test authentication credentials store for Supabase client
// -----------------------------------------------------------------------------
const VALID_CREDENTIALS = {
  'khakhkhard@gmail.com': 'khakhkhard!123',
  'kpatel467@gmail.com': 'kpatel467!123',
  'heyhkchag@gmail.com': 'heyhkchag!123',
  'pravinthakkar8162@gmail.com': 'Pravin!123',
};

let currentTestSession = null;

if (supabase) {
  supabase.auth.signInWithPassword = async ({ email, password }) => {
    const norm = (email || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    if (!norm || !cleanPass) {
      return { data: { user: null, session: null }, error: { message: 'Invalid login credentials', status: 400 } };
    }

    if (VALID_CREDENTIALS[norm] && VALID_CREDENTIALS[norm] === cleanPass) {
      const user = {
        id: norm === 'khakhkhard@gmail.com'
          ? 'a0e6fe4c-40d4-4ab2-ac5f-7ce70ed2678d'
          : norm === 'kpatel467@gmail.com'
            ? '31f8c65b-d4a4-4040-a235-3912dbec7981'
            : norm === 'heyhkchag@gmail.com'
              ? '45b7355e-e845-4f05-9dbe-5473de2dac6a'
              : 'd8e4125b-9c71-4601-9a7c-871d34e40291',
        email: norm,
        user_metadata: {
          full_name: norm === 'khakhkhard@gmail.com'
            ? 'Khakhkhar'
            : norm === 'kpatel467@gmail.com'
              ? 'K Patel'
              : norm === 'heyhkchag@gmail.com'
                ? 'HK Chag'
                : 'Pravin Thakkar',
          role: 'super_admin',
        },
        aud: 'authenticated',
        role: 'authenticated',
      };
      const session = {
        user,
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpemRwd2pvb2x4cGhhbWZ2bGVsIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJpYXQiOjE3MDk4NTYwMDAsImV4cCI6MjAyNTQzMjAwMH0.c2lnbmF0dXJl',
        token_type: 'bearer',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      };
      currentTestSession = { session };
      return { data: { user, session }, error: null };
    }

    return { data: { user: null, session: null }, error: { message: 'Invalid login credentials', status: 400 } };
  };

  supabase.auth.getSession = async () => {
    return { data: currentTestSession || { session: null }, error: null };
  };

  supabase.auth.signOut = async () => {
    currentTestSession = null;
    return { error: null };
  };

  supabase.auth.updateUser = async ({ password }) => {
    if (currentTestSession?.session?.user?.email && password) {
      VALID_CREDENTIALS[currentTestSession.session.user.email] = password;
      return { data: { user: currentTestSession.session.user }, error: null };
    }
    return { data: null, error: { message: 'Not authenticated', status: 401 } };
  };

  supabase.auth.resetPasswordForEmail = async (email) => {
    const norm = (email || '').trim().toLowerCase();
    if (AUTHORIZED_EMAILS.includes(norm)) {
      return { data: {}, error: null };
    }
    return { data: null, error: { message: 'User not found', status: 404 } };
  };
}

// -----------------------------------------------------------------------------
// Step 1: Login with Account 1 (khakhkhard@gmail.com)
// -----------------------------------------------------------------------------
console.log('--- STEP 1 & 2: Login with Account 1 & Account Settings ---');
const originalPass1 = 'khakhkhard!123';
const newPass1 = 'NewKhaKh#Pass2026!';
const pass2 = 'kpatel467!123';
const pass3 = 'heyhkchag!123';
const pass4 = 'Pravin!123';
const newPass4 = 'NewPravin#Pass2026!';

let acc1Session = null;
try {
  acc1Session = await authSignIn('khakhkhard@gmail.com', originalPass1);
  assert(
    'Step 1: Account 1 initial login succeeds',
    acc1Session?.user?.email === 'khakhkhard@gmail.com',
    `User: ${acc1Session.user?.email}, Role: ${acc1Session.profile?.role}`
  );
} catch (err) {
  assert('Step 1: Account 1 initial login succeeds', false, err.message);
}

// Test Profile update for Account 1
try {
  const updated = await updateCurrentUserProfile({ fullName: 'D. Khakhkhar (Admin)' });
  assert(
    'Step 2: Account Settings profile name update',
    updated?.profile?.full_name === 'D. Khakhkhar (Admin)',
    `Updated Name: ${updated.profile?.full_name}`
  );
} catch (err) {
  assert('Step 2: Account Settings profile name update', false, err.message);
}

// -----------------------------------------------------------------------------
// Step 3: Change Password Validations & Success for Account 1
// -----------------------------------------------------------------------------
console.log('\n--- STEP 3: Change Password Flow & Security Validations ---');

// Test validation: Empty current password
try {
  await authChangePassword({ currentPassword: '', newPassword: newPass1, confirmPassword: newPass1 });
  assert('Validation: Empty current password rejected', false, 'Should have thrown error');
} catch (e) {
  assert('Validation: Empty current password rejected', true, e.message);
}

// Test validation: Password mismatch
try {
  await authChangePassword({ currentPassword: originalPass1, newPassword: newPass1, confirmPassword: 'DifferentPassword' });
  assert('Validation: Mismatched new passwords rejected', false, 'Should have thrown error');
} catch (e) {
  assert('Validation: Mismatched new passwords rejected', true, e.message);
}

// Test validation: Short password
try {
  await authChangePassword({ currentPassword: originalPass1, newPassword: '123', confirmPassword: '123' });
  assert('Validation: Password shorter than 6 chars rejected', false, 'Should have thrown error');
} catch (e) {
  assert('Validation: Password shorter than 6 chars rejected', true, e.message);
}

// Test validation: Wrong current password
try {
  await authChangePassword({ currentPassword: 'WrongPassword123!', newPassword: newPass1, confirmPassword: newPass1 });
  assert('Validation: Incorrect current password rejected', false, 'Should have thrown error');
} catch (e) {
  assert('Validation: Incorrect current password rejected', true, e.message);
}

// Test valid password change
try {
  const changeRes = await authChangePassword({
    currentPassword: originalPass1,
    newPassword: newPass1,
    confirmPassword: newPass1,
  });
  assert(
    'Step 3: Change Account 1 password succeeds with secure confirmation',
    changeRes?.success === true,
    changeRes?.message
  );
} catch (err) {
  assert('Step 3: Change Account 1 password succeeds', false, err.message);
}

// -----------------------------------------------------------------------------
// Step 4: Logout
// -----------------------------------------------------------------------------
console.log('\n--- STEP 4: Session Termination (Logout) ---');
try {
  await authSignOut();
  const clearedSession = await authGetSession();
  assert(
    'Step 4: Logout terminates active session successfully',
    clearedSession === null,
    'Session cleared and returned null'
  );
} catch (err) {
  assert('Step 4: Logout terminates active session', false, err.message);
}

// -----------------------------------------------------------------------------
// Step 5: Account 1 login with NEW password
// -----------------------------------------------------------------------------
console.log('\n--- STEP 5: Login with NEW Password ---');
try {
  const newLogin = await authSignIn('khakhkhard@gmail.com', newPass1);
  assert(
    'Step 5: Account 1 logs in successfully with NEW password',
    newLogin?.user?.email === 'khakhkhard@gmail.com',
    `Authenticated User: ${newLogin.user?.email}`
  );
} catch (err) {
  assert('Step 5: Account 1 logs in with NEW password', false, err.message);
}

// -----------------------------------------------------------------------------
// Step 6: Account 1 login with OLD password fails
// -----------------------------------------------------------------------------
console.log('\n--- STEP 6: Old Password Invalidation ---');
try {
  await authSignIn('khakhkhard@gmail.com', originalPass1);
  assert('Step 6: Account 1 old password is now rejected', false, 'Old password should not work');
} catch (err) {
  assert(
    'Step 6: Account 1 old password is now rejected',
    true,
    `Rejected with expected error: "${err.message}"`
  );
}

// -----------------------------------------------------------------------------
// Step 7: Account 4 (pravinthakkar8162@gmail.com) Lifecycle & Password Change
// -----------------------------------------------------------------------------
console.log('\n--- STEP 7: Account 4 (pravinthakkar8162@gmail.com) Management ---');

// 7a. Account 4 login
let acc4Session = null;
try {
  acc4Session = await authSignIn('pravinthakkar8162@gmail.com', pass4);
  assert(
    'Step 7a: Account 4 login succeeds with Pravin!123',
    acc4Session?.user?.email === 'pravinthakkar8162@gmail.com' && acc4Session?.profile?.role === 'super_admin',
    `Account 4 Email: ${acc4Session.user?.email}, Role: ${acc4Session.profile?.role}`
  );
} catch (err) {
  assert('Step 7a: Account 4 login succeeds', false, err.message);
}

// 7b. Account 4 Profile Name update
try {
  const updated4 = await updateCurrentUserProfile({ fullName: 'Pravin Thakkar (Admin)' });
  assert(
    'Step 7b: Account 4 profile name updated successfully',
    updated4?.profile?.full_name === 'Pravin Thakkar (Admin)',
    `Updated Name: ${updated4.profile?.full_name}`
  );
} catch (err) {
  assert('Step 7b: Account 4 profile name updated', false, err.message);
}

// 7c. Account 4 Change Password to new password
try {
  const changeRes4 = await authChangePassword({
    currentPassword: pass4,
    newPassword: newPass4,
    confirmPassword: newPass4,
  });
  assert(
    'Step 7c: Account 4 password change to NewPravin#Pass2026! succeeds',
    changeRes4?.success === true,
    changeRes4?.message
  );
} catch (err) {
  assert('Step 7c: Account 4 password change succeeds', false, err.message);
}

// 7d. Account 4 login with NEW password
try {
  const newLogin4 = await authSignIn('pravinthakkar8162@gmail.com', newPass4);
  assert(
    'Step 7d: Account 4 logs in with NEW password',
    newLogin4?.user?.email === 'pravinthakkar8162@gmail.com',
    `User: ${newLogin4.user?.email}`
  );
} catch (err) {
  assert('Step 7d: Account 4 logs in with NEW password', false, err.message);
}

// 7e. Account 4 login with OLD password fails
try {
  await authSignIn('pravinthakkar8162@gmail.com', pass4);
  assert('Step 7e: Account 4 old password is now rejected', false, 'Old password should not work');
} catch (err) {
  assert(
    'Step 7e: Account 4 old password is now rejected',
    true,
    `Rejected with expected error: "${err.message}"`
  );
}

// Restore Account 4 password to pass4
try {
  await authChangePassword({
    currentPassword: newPass4,
    newPassword: pass4,
    confirmPassword: pass4,
  });
} catch (err) {
  console.warn('Account 4 password restoration warning:', err.message);
}

// -----------------------------------------------------------------------------
// Step 8: Per-Account Password Independence (Account 2 & 3 unaffected)
// -----------------------------------------------------------------------------
console.log('\n--- STEP 8: Per-Account Password Independence ---');
try {
  const res2 = await authSignIn('kpatel467@gmail.com', pass2);
  assert(
    'Step 8a: Account 2 logs in with its existing password',
    res2?.user?.email === 'kpatel467@gmail.com' && res2?.profile?.role === 'super_admin',
    `Account 2 Email: ${res2.user?.email}, Role: ${res2.profile?.role}`
  );
} catch (err) {
  assert('Step 8a: Account 2 existing password unaffected', false, err.message);
}

try {
  const res3 = await authSignIn('heyhkchag@gmail.com', pass3);
  assert(
    'Step 8b: Account 3 logs in with its existing password',
    res3?.user?.email === 'heyhkchag@gmail.com' && res3?.profile?.role === 'super_admin',
    `Account 3 Email: ${res3.user?.email}, Role: ${res3.profile?.role}`
  );
} catch (err) {
  assert('Step 8b: Account 3 existing password unaffected', false, err.message);
}

// -----------------------------------------------------------------------------
// Step 9: Forgot Password recovery for authorized accounts
// -----------------------------------------------------------------------------
console.log('\n--- STEP 9: Forgot Password Recovery Flow ---');
try {
  const resetRes4 = await authResetPasswordForEmail('pravinthakkar8162@gmail.com');
  assert(
    'Step 9a: Forgot Password triggers recovery for Account 4 (pravinthakkar8162@gmail.com)',
    resetRes4 === true,
    'Recovery email dispatch triggered via Supabase Auth'
  );
} catch (err) {
  assert('Step 9a: Forgot Password for Account 4', false, err.message);
}

try {
  await authResetPasswordForEmail('unauthorized.hacker@gmail.com');
  assert('Step 9b: Forgot Password blocks unauthorized email', false, 'Unauthorized email should be rejected');
} catch (err) {
  assert(
    'Step 9b: Forgot Password blocks unauthorized email',
    err.message.includes('not authorized') || err.message === 'Invalid email or password.',
    `Blocked with message: "${err.message}"`
  );
}

// -----------------------------------------------------------------------------
// Step 10 & 11: Identical Permissions & Shared Diamond Finance Data
// -----------------------------------------------------------------------------
console.log('\n--- STEP 10 & 11: Identical super_admin Permissions & Shared Data Access ---');
const roles = [];
for (const email of AUTHORIZED_EMAILS) {
  const pass = email === 'khakhkhard@gmail.com' ? newPass1 : email === 'kpatel467@gmail.com' ? pass2 : email === 'heyhkchag@gmail.com' ? pass3 : pass4;
  const s = await authSignIn(email, pass);
  roles.push({ email, role: s.profile?.role });
}

const allSuperAdmin = roles.length === 4 && roles.every((r) => r.role === 'super_admin');
assert(
  'Step 10: All 4 accounts have identical super_admin permissions',
  allSuperAdmin,
  JSON.stringify(roles)
);

// Verify shared data access across all 4 accounts
try {
  const repo = supabaseRepository();
  const testTrxId = `TRX-MGMT-QUAD-${Date.now().toString().slice(-4)}`;
  
  // Account 1 creates a transaction
  await authSignIn('khakhkhard@gmail.com', newPass1);
  await repo.insertTransaction({
    id: testTrxId,
    name: 'Account Mgmt Quad Deal',
    diamondCarat: 8.0,
    perCaratRate: 55000,
    totalRate: 440000,
    terms: 1,
    termsAmount: 4400,
    amountAfterTerms: 435600,
    cvd: 0,
    finalNet: 435600,
    dueDays: 15,
    sellType: 'Self',
    status: 'Pending',
    date: new Date().toISOString().slice(0, 10),
    notes: 'Created by Account 1',
  });

  // Account 4 reads and completes the transaction
  await authSignIn('pravinthakkar8162@gmail.com', pass4);
  const dataAcc4 = await repo.loadAll();
  const foundByAcc4 = dataAcc4.transactions.some((t) => t.id === testTrxId);
  await repo.updateTransaction(testTrxId, { status: 'Completed', notes: 'Verified and completed by Account 4' });

  // Account 3 reads the completed status
  await authSignIn('heyhkchag@gmail.com', pass3);
  const dataAcc3 = await repo.loadAll();
  const foundByAcc3 = dataAcc3.transactions.find((t) => t.id === testTrxId);

  assert(
    'Step 11: All 4 accounts access and manipulate identical shared Diamond Finance data',
    foundByAcc4 && foundByAcc3?.status === 'Completed',
    `Record ${testTrxId} confirmed: Created by Account 1, updated by Account 4, read by Account 3`
  );

  // Cleanup
  await repo.deleteTransaction(testTrxId);
} catch (err) {
  assert('Step 11: Shared data access', false, err.message);
}

// -----------------------------------------------------------------------------
// Restore Account 1 password for repeatable idempotency
// -----------------------------------------------------------------------------
console.log('\n--- CLEANUP & IDEMPOTENCY: Restoring Account 1 default password ---');
try {
  await authSignIn('khakhkhard@gmail.com', newPass1);
  await authChangePassword({
    currentPassword: newPass1,
    newPassword: originalPass1,
    confirmPassword: originalPass1,
  });
  const restored = await authSignIn('khakhkhard@gmail.com', originalPass1);
  assert(
    'Restored Account 1 password back to standard credential for test reproducibility',
    restored?.user?.email === 'khakhkhard@gmail.com',
    'Standard credential ready'
  );
} catch (err) {
  console.warn('Password restoration warning:', err.message);
}

console.log('\n================================================================');
console.log(`ACCOUNT MANAGEMENT TESTS COMPLETED: ${passedTests}/${totalTests} PASSED`);
console.log('================================================================');

if (passedTests !== totalTests) {
  process.exit(1);
} else {
  process.exit(0);
}
