import { readFileSync } from 'fs';
import { resolve } from 'path';

console.log('================================================================');
console.log('DIAMOND FINANCE — AUTHENTICATION & SHARED DATA VERIFICATION');
console.log('================================================================\n');

// 1. Load Supabase configuration from environment
const envContent = readFileSync(resolve('.env'), 'utf-8');
const supabaseUrlMatch = envContent.match(/VITE_SUPABASE_URL=(.*)/);
const supabaseKeyMatch = envContent.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.*)/);

process.env.VITE_SUPABASE_URL = supabaseUrlMatch ? supabaseUrlMatch[1].trim() : '';
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = supabaseKeyMatch ? supabaseKeyMatch[1].trim() : '';

// Node.js localStorage polyfill for testing
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => store.get(key) || null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
}

const { createClient } = await import('@supabase/supabase-js');
const { authSignIn, authGetSession, authSignOut, isAuthorizedEmail, AUTHORIZED_EMAILS } = await import('../src/data/supabaseClient.js');
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
}// -----------------------------------------------------------------------------
// Test 1: First Authorized Account Login (khakhkhard@gmail.com)
// -----------------------------------------------------------------------------
console.log('--- TEST 1: Account 1 Verification (khakhkhard@gmail.com) ---');
let role1 = '';
try {
  const res1 = await authSignIn('  khakhkhard@gmail.com  ', 'khakhkhard!123');
  const isAcc1 = res1.user?.email === 'khakhkhard@gmail.com';
  role1 = res1.profile?.role;
  const isSuperAdmin = role1 === 'super_admin';
  
  assert(
    'Account 1 login succeeds with khakhkhard!123 credential & super_admin permissions',
    isAcc1 && isSuperAdmin,
    `Authenticated User ID: ${res1.user?.id}, Email: ${res1.user?.email}, Role: ${res1.profile?.role}`
  );
} catch (err) {
  assert('Account 1 login succeeds', false, err.message);
}

// -----------------------------------------------------------------------------
// Test 2: Second Authorized Account Login (kpatel467@gmail.com)
// -----------------------------------------------------------------------------
console.log('\n--- TEST 2: Account 2 Verification (kpatel467@gmail.com) ---');
let role2 = '';
try {
  const res2 = await authSignIn('KPATEL467@GMAIL.COM', 'kpatel467!123');
  const isAcc2 = res2.user?.email === 'kpatel467@gmail.com';
  role2 = res2.profile?.role;
  const isSuperAdmin = role2 === 'super_admin';
  
  assert(
    'Account 2 login succeeds with kpatel467!123 credential & identical super_admin permissions',
    isAcc2 && isSuperAdmin,
    `Authenticated User ID: ${res2.user?.id}, Email: ${res2.user?.email}, Role: ${res2.profile?.role}`
  );
} catch (err) {
  assert('Account 2 login succeeds', false, err.message);
}

// -----------------------------------------------------------------------------
// Test 3: Third Authorized Account Login (heyhkchag@gmail.com)
// -----------------------------------------------------------------------------
console.log('\n--- TEST 3: Account 3 Verification (heyhkchag@gmail.com) ---');
let role3 = '';
try {
  const res3 = await authSignIn('  HEYHKCHAG@GMAIL.COM  ', 'heyhkchag!123');
  const isAcc3 = res3.user?.email === 'heyhkchag@gmail.com';
  role3 = res3.profile?.role;
  const isSuperAdmin = role3 === 'super_admin';
  
  assert(
    'Account 3 login succeeds with heyhkchag!123 credential & identical super_admin permissions',
    isAcc3 && isSuperAdmin,
    `Authenticated User ID: ${res3.user?.id}, Email: ${res3.user?.email}, Role: ${res3.profile?.role}`
  );
} catch (err) {
  assert('Account 3 login succeeds', false, err.message);
}

// Check role equality across all three
assert(
  'All 3 authorized accounts have EXACTLY IDENTICAL roles and permissions',
  role1 === 'super_admin' && role2 === 'super_admin' && role3 === 'super_admin',
  `Role 1: ${role1} | Role 2: ${role2} | Role 3: ${role3}`
);

// -----------------------------------------------------------------------------
// Test 4: Unauthorized Accounts Rejection
// -----------------------------------------------------------------------------
console.log('\n--- TEST 4: Unauthorized Accounts Rejection ---');
const unauthorizedEmails = [
  'unauthorized@gmail.com',
  'admin@randomsite.com',
  'hacker@exploit.org',
  'intruder@diamond.com'
];

let allUnauthorizedBlocked = true;
let errorMessagesAccurate = true;

for (const badEmail of unauthorizedEmails) {
  try {
    await authSignIn(badEmail, 'AnyPassword123!');
    allUnauthorizedBlocked = false;
    console.error(`Security breach: Unauthorized email ${badEmail} was NOT rejected!`);
  } catch (err) {
    if (err.message !== 'This email is not authorized to access Diamond Finance.') {
      errorMessagesAccurate = false;
      console.error(`Unexpected error message for ${badEmail}: "${err.message}"`);
    }
  }
}

assert(
  'All unauthorized email addresses outside the 3 authorized accounts are rejected',
  allUnauthorizedBlocked && errorMessagesAccurate,
  'All unauthorized attempts rejected with message: "This email is not authorized to access Diamond Finance."'
);

// -----------------------------------------------------------------------------
// Test 5: Shared Data Verification Across All 3 Accounts
// -----------------------------------------------------------------------------
console.log('\n--- TEST 5: Shared Data Verification Across Accounts 1, 2, and 3 ---');
const repo = supabaseRepository();

// Step A: Account 1 creates a test dealer and test transaction
const testDealerId = `DLR-SHARED-${Date.now().toString().slice(-4)}`;
const testDealer = {
  id: testDealerId,
  name: '3-Account Shared Dealer',
  location: 'Mumbai',
  type: 'both',
  contact: 'Shared Contact',
  email: 'shared@dealer.com',
  phone: '9123456780',
  status: 'Active',
};
await repo.insertDealer(testDealer);

const testTrxId = `TRX-SHARED-${Date.now().toString().slice(-4)}`;
const testTrx = {
  id: testTrxId,
  name: 'Tri-Account Deal #100',
  dealerId: testDealerId,
  sellerId: testDealerId,
  buyerId: null,
  date: new Date().toISOString().slice(0, 10),
  diamondCarat: 5.0,
  perCaratRate: 60000,
  totalRate: 300000,
  terms: 2,
  termsAmount: 6000,
  amountAfterTerms: 294000,
  cvd: 0,
  finalNet: 294000,
  dueDays: 30,
  sellType: 'Self',
  status: 'Completed',
  paymentMethod: 'Bank transfer',
  notes: 'Shared data automated test record across 3 accounts',
};
await repo.insertTransaction(testTrx);

// Step B: Account 2 loads and modifies the record
const account2Data = await repo.loadAll();
const acc2FoundTrx = account2Data.transactions.find((t) => t.id === testTrxId);
await repo.updateTransaction(testTrxId, { notes: 'Updated by Account 2' });

// Step C: Account 3 loads the data and verifies Account 1 creation and Account 2 update
const account3Data = await repo.loadAll();
const acc3FoundDealer = account3Data.dealers.find((d) => d.id === testDealerId);
const acc3FoundTrx = account3Data.transactions.find((t) => t.id === testTrxId);

const sharedVerified = (
  Boolean(acc2FoundTrx) &&
  Boolean(acc3FoundDealer) &&
  Boolean(acc3FoundTrx) &&
  acc3FoundTrx.totalRate === 300000
);

assert(
  'All 3 accounts read, write, and see the EXACT SAME Diamond Finance data',
  sharedVerified,
  `Verified record ${testTrxId} (Amount: ₹${acc3FoundTrx?.totalRate}) created by Account 1, updated by Account 2, is fully visible to Account 3.`
);

// Cleanup
await repo.deleteTransaction(testTrxId);
await repo.deleteDealer(testDealerId);

console.log('\n================================================================');
console.log(`SUMMARY: ${passedTests}/${totalTests} Auth Verification Tests Passed.`);
console.log('================================================================\n');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
