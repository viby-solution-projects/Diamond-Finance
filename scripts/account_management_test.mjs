import { readFileSync } from 'fs';
import { resolve } from 'path';

console.log('================================================================');
console.log('DIAMOND FINANCE — ACCOUNT MANAGEMENT & SECURITY LIFECYCLE TEST');
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
// Step 1: Login with Account 1 (khakhkhard@gmail.com)
// -----------------------------------------------------------------------------
console.log('--- STEP 1 & 2: Login with Account 1 & Account Settings ---');
const originalPass1 = 'Khakhkhar@123';
const newPass1 = 'NewKhaKh#Pass2026!';
const pass2 = 'KPatel@123';
const pass3 = 'HK@123';

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

// Test Profile update
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
    'Session cleared from local store'
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
// Step 7 & 8: Per-Account Independence (Account 2 & Account 3 unchanged)
// -----------------------------------------------------------------------------
console.log('\n--- STEP 7 & 8: Per-Account Password Independence ---');
try {
  const res2 = await authSignIn('kpatel467@gmail.com', pass2);
  assert(
    'Step 7: Account 2 logs in with its existing password (unaffected by Account 1 change)',
    res2?.user?.email === 'kpatel467@gmail.com' && res2?.profile?.role === 'super_admin',
    `Account 2 Email: ${res2.user?.email}, Role: ${res2.profile?.role}`
  );
} catch (err) {
  assert('Step 7: Account 2 existing password unaffected', false, err.message);
}

try {
  const res3 = await authSignIn('heyhkchag@gmail.com', pass3);
  assert(
    'Step 8: Account 3 logs in with its existing password (unaffected by Account 1 change)',
    res3?.user?.email === 'heyhkchag@gmail.com' && res3?.profile?.role === 'super_admin',
    `Account 3 Email: ${res3.user?.email}, Role: ${res3.profile?.role}`
  );
} catch (err) {
  assert('Step 8: Account 3 existing password unaffected', false, err.message);
}

// -----------------------------------------------------------------------------
// Step 9: Forgot Password flow
// -----------------------------------------------------------------------------
console.log('\n--- STEP 9: Forgot Password Recovery Flow ---');
try {
  const resetRes1 = await authResetPasswordForEmail('khakhkhard@gmail.com');
  assert(
    'Step 9a: Forgot Password triggers recovery for authorized email (Account 1)',
    resetRes1 === true,
    'Recovery email dispatch triggered via Supabase Auth'
  );
} catch (err) {
  assert('Step 9a: Forgot Password for authorized email', false, err.message);
}

try {
  await authResetPasswordForEmail('unauthorized.hacker@gmail.com');
  assert('Step 9b: Forgot Password blocks unauthorized email', false, 'Unauthorized email should be rejected');
} catch (err) {
  assert(
    'Step 9b: Forgot Password blocks unauthorized email',
    err.message.includes('not authorized'),
    `Blocked with message: "${err.message}"`
  );
}

// -----------------------------------------------------------------------------
// Step 10 & 11: Identical Permissions & Shared Diamond Finance Data
// -----------------------------------------------------------------------------
console.log('\n--- STEP 10 & 11: Identical super_admin Permissions & Shared Data Access ---');
const roles = [];
for (const email of AUTHORIZED_EMAILS) {
  const pass = email === 'khakhkhard@gmail.com' ? newPass1 : email === 'kpatel467@gmail.com' ? pass2 : pass3;
  const s = await authSignIn(email, pass);
  roles.push({ email, role: s.profile?.role });
}

const allSuperAdmin = roles.every(r => r.role === 'super_admin');
assert(
  'Step 10: All 3 accounts have identical super_admin permissions',
  allSuperAdmin,
  JSON.stringify(roles)
);

// Verify shared data access across accounts
try {
  const repo = supabaseRepository();
  const testTrxId = `TRX-MGMT-${Date.now().toString().slice(-4)}`;
  
  // Account 1 creates a transaction
  await authSignIn('khakhkhard@gmail.com', newPass1);
  await repo.insertTransaction({
    id: testTrxId,
    name: 'Account Mgmt Deal',
    diamondCarat: 7.2,
    perCaratRate: 45000,
    totalRate: 324000,
    terms: 1,
    termsAmount: 3240,
    amountAfterTerms: 320760,
    cvd: 0,
    finalNet: 320760,
    dueDays: 15,
    sellType: 'Self',
    status: 'Pending',
    date: new Date().toISOString().slice(0, 10),
    notes: 'Created by Account 1 with new password',
  });

  // Account 2 reads and updates
  await authSignIn('kpatel467@gmail.com', pass2);
  const dataAcc2 = await repo.loadAll();
  const foundByAcc2 = dataAcc2.transactions.some(t => t.id === testTrxId);
  await repo.updateTransaction(testTrxId, { status: 'Completed', notes: 'Verified and completed by Account 2' });

  // Account 3 reads the completed status
  await authSignIn('heyhkchag@gmail.com', pass3);
  const dataAcc3 = await repo.loadAll();
  const foundByAcc3 = dataAcc3.transactions.find(t => t.id === testTrxId);

  assert(
    'Step 11: All 3 accounts access and manipulate identical shared Diamond Finance data',
    foundByAcc2 && foundByAcc3?.status === 'Completed',
    `Record ${testTrxId} confirmed: Created by Account 1, updated by Account 2, read by Account 3`
  );
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
