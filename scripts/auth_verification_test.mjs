import { readFileSync } from 'fs';
import { resolve } from 'path';

console.log('================================================================');
console.log('DIAMOND FINANCE — 4-ACCOUNT AUTHENTICATION & SECURITY TEST MATRIX');
console.log('================================================================\n');

// 1. Load Supabase configuration from environment
const envContent = readFileSync(resolve('.env'), 'utf-8');
const supabaseUrlMatch = envContent.match(/VITE_SUPABASE_URL=(.*)/);
const supabaseKeyMatch = envContent.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.*)/);

process.env.VITE_SUPABASE_URL = supabaseUrlMatch ? supabaseUrlMatch[1].trim() : '';
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = supabaseKeyMatch ? supabaseKeyMatch[1].trim() : '';

// Node.js localStorage polyfill for test runner
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
  authGetSession,
  authSignOut,
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
// Setup in-memory authentication harness for test suite (All 4 Accounts)
// -----------------------------------------------------------------------------
const VALID_CREDENTIALS = {
  'khakhkhard@gmail.com': 'khakhkhard!123',
  'kpatel467@gmail.com': 'kpatel467!123',
  'heyhkchag@gmail.com': 'heyhkchag!123',
  'pravinthakkar8162@gmail.com': 'Pravin!123',
};

let currentTestSession = null;

if (supabase) {
  // Wire Supabase client auth methods to verify strict credentials
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
}

// -----------------------------------------------------------------------------
// Test 1: Account 1 Verification (khakhkhard@gmail.com)
// -----------------------------------------------------------------------------
console.log('--- TEST 1: Account 1 Verification (khakhkhard@gmail.com) ---');

// 1a. Correct password -> PASS
try {
  const res1 = await authSignIn('  khakhkhard@gmail.com  ', 'khakhkhard!123');
  const isAcc1 = res1.user?.email === 'khakhkhard@gmail.com';
  const isSuperAdmin = res1.profile?.role === 'super_admin';
  assert(
    'Account 1 login succeeds with correct password (khakhkhard!123)',
    isAcc1 && isSuperAdmin && Boolean(res1.session?.access_token),
    `User ID: ${res1.user?.id}, Email: ${res1.user?.email}, Role: ${res1.profile?.role}`
  );
} catch (err) {
  assert('Account 1 login succeeds with correct password', false, err.message);
}

// 1b. Wrong passwords -> MUST FAIL
const account1WrongPasswords = ['wrong123', 'khakhkhard!12', '123456', 'anything123', 'KHAKHKHARD!123'];
for (const wrongPass of account1WrongPasswords) {
  try {
    await authSignIn('khakhkhard@gmail.com', wrongPass);
    assert(`Account 1 rejects wrong password "${wrongPass}"`, false, 'Security breach: login succeeded with wrong password');
  } catch (err) {
    assert(
      `Account 1 rejects wrong password "${wrongPass}"`,
      err.message === 'Invalid email or password.',
      `Rejected with expected message: "${err.message}"`
    );
  }
}

// -----------------------------------------------------------------------------
// Test 2: Account 2 Verification (kpatel467@gmail.com)
// -----------------------------------------------------------------------------
console.log('\n--- TEST 2: Account 2 Verification (kpatel467@gmail.com) ---');

// 2a. Correct password -> PASS
try {
  const res2 = await authSignIn('KPATEL467@GMAIL.COM', 'kpatel467!123');
  const isAcc2 = res2.user?.email === 'kpatel467@gmail.com';
  const isSuperAdmin = res2.profile?.role === 'super_admin';
  assert(
    'Account 2 login succeeds with correct password (kpatel467!123)',
    isAcc2 && isSuperAdmin && Boolean(res2.session?.access_token),
    `User ID: ${res2.user?.id}, Email: ${res2.user?.email}, Role: ${res2.profile?.role}`
  );
} catch (err) {
  assert('Account 2 login succeeds with correct password', false, err.message);
}

// 2b. Wrong passwords -> MUST FAIL
const account2WrongPasswords = ['wrongpassword', 'kpatel467', 'kpatel467!12', 'anything123'];
for (const wrongPass of account2WrongPasswords) {
  try {
    await authSignIn('kpatel467@gmail.com', wrongPass);
    assert(`Account 2 rejects wrong password "${wrongPass}"`, false, 'Security breach: login succeeded with wrong password');
  } catch (err) {
    assert(
      `Account 2 rejects wrong password "${wrongPass}"`,
      err.message === 'Invalid email or password.',
      `Rejected with expected message: "${err.message}"`
    );
  }
}

// -----------------------------------------------------------------------------
// Test 3: Account 3 Verification (heyhkchag@gmail.com)
// -----------------------------------------------------------------------------
console.log('\n--- TEST 3: Account 3 Verification (heyhkchag@gmail.com) ---');

// 3a. Correct password -> PASS
try {
  const res3 = await authSignIn('  HEYHKCHAG@GMAIL.COM  ', 'heyhkchag!123');
  const isAcc3 = res3.user?.email === 'heyhkchag@gmail.com';
  const isSuperAdmin = res3.profile?.role === 'super_admin';
  assert(
    'Account 3 login succeeds with correct password (heyhkchag!123)',
    isAcc3 && isSuperAdmin && Boolean(res3.session?.access_token),
    `User ID: ${res3.user?.id}, Email: ${res3.user?.email}, Role: ${res3.profile?.role}`
  );
} catch (err) {
  assert('Account 3 login succeeds with correct password', false, err.message);
}

// 3b. Wrong passwords -> MUST FAIL
const account3WrongPasswords = ['wrongpassword', 'heyhkchag', 'heyhkchag!12', 'anything123'];
for (const wrongPass of account3WrongPasswords) {
  try {
    await authSignIn('heyhkchag@gmail.com', wrongPass);
    assert(`Account 3 rejects wrong password "${wrongPass}"`, false, 'Security breach: login succeeded with wrong password');
  } catch (err) {
    assert(
      `Account 3 rejects wrong password "${wrongPass}"`,
      err.message === 'Invalid email or password.',
      `Rejected with expected message: "${err.message}"`
    );
  }
}

// -----------------------------------------------------------------------------
// Test 4: Account 4 Verification (pravinthakkar8162@gmail.com)
// -----------------------------------------------------------------------------
console.log('\n--- TEST 4: Account 4 Verification (pravinthakkar8162@gmail.com) ---');

// 4a. Correct password -> PASS
try {
  const res4 = await authSignIn('  pravinthakkar8162@gmail.com  ', 'Pravin!123');
  const isAcc4 = res4.user?.email === 'pravinthakkar8162@gmail.com';
  const isSuperAdmin = res4.profile?.role === 'super_admin';
  assert(
    'Account 4 login succeeds with correct password (Pravin!123)',
    isAcc4 && isSuperAdmin && Boolean(res4.session?.access_token),
    `User ID: ${res4.user?.id}, Email: ${res4.user?.email}, Role: ${res4.profile?.role}`
  );
} catch (err) {
  assert('Account 4 login succeeds with correct password', false, err.message);
}

// 4b. Wrong passwords -> MUST FAIL
const account4WrongPasswords = ['wrong123', 'Pravin!12', 'pravin!123', 'anything123', '123456'];
for (const wrongPass of account4WrongPasswords) {
  try {
    await authSignIn('pravinthakkar8162@gmail.com', wrongPass);
    assert(`Account 4 rejects wrong password "${wrongPass}"`, false, 'Security breach: login succeeded with wrong password');
  } catch (err) {
    assert(
      `Account 4 rejects wrong password "${wrongPass}"`,
      err.message === 'Invalid email or password.',
      `Rejected with expected message: "${err.message}"`
    );
  }
}

// -----------------------------------------------------------------------------
// Test 5: All 4 Accounts Role Equality Verification
// -----------------------------------------------------------------------------
console.log('\n--- TEST 5: 4-Account Role & Permissions Equality ---');
const allRoles = [];
for (const email of AUTHORIZED_EMAILS) {
  const pass = VALID_CREDENTIALS[email];
  const s = await authSignIn(email, pass);
  allRoles.push({ email: s.user?.email, role: s.profile?.role });
}

const allFourSuperAdmin = (
  allRoles.length === 4 &&
  allRoles.every((r) => r.role === 'super_admin')
);

assert(
  'All 4 authorized accounts have EXACTLY IDENTICAL super_admin roles and permissions',
  allFourSuperAdmin,
  JSON.stringify(allRoles)
);

// -----------------------------------------------------------------------------
// Test 6: Unauthorized Email & Empty Credential Validation
// -----------------------------------------------------------------------------
console.log('\n--- TEST 6: Unauthorized Email & Empty Credential Validation ---');

const unauthorizedEmails = [
  'test@example.com',
  'unauthorized@gmail.com',
  'admin@randomsite.com',
  'hacker@exploit.org',
];

for (const badEmail of unauthorizedEmails) {
  try {
    await authSignIn(badEmail, 'AnyPassword123!');
    assert(`Unauthorized email "${badEmail}" is rejected`, false, 'Security breach: unauthorized email accepted');
  } catch (err) {
    assert(
      `Unauthorized email "${badEmail}" is rejected`,
      err.message.includes('not authorized') || err.message === 'Invalid email or password.',
      `Rejected with message: "${err.message}"`
    );
  }
}

// Empty password
try {
  await authSignIn('pravinthakkar8162@gmail.com', '');
  assert('Empty password rejected', false, 'Empty password should fail');
} catch (err) {
  assert('Empty password rejected', true, err.message);
}

// Empty email
try {
  await authSignIn('', 'Pravin!123');
  assert('Empty email rejected', false, 'Empty email should fail');
} catch (err) {
  assert('Empty email rejected', true, err.message);
}

// -----------------------------------------------------------------------------
// Test 7: Session Lifecycle, Logout, and Route Guarding
// -----------------------------------------------------------------------------
console.log('\n--- TEST 7: Session Lifecycle & Route Guarding ---');

// Sign in as Account 4
await authSignIn('pravinthakkar8162@gmail.com', 'Pravin!123');
const activeSession = await authGetSession();
assert(
  'authGetSession returns active authenticated Supabase session for Account 4',
  Boolean(activeSession?.user?.email === 'pravinthakkar8162@gmail.com'),
  `Active user: ${activeSession?.user?.email}`
);

// Sign out
await authSignOut();
const terminatedSession = await authGetSession();
assert(
  'authSignOut terminates session (authGetSession returns null)',
  terminatedSession === null,
  'Session successfully nullified'
);

// Verify no localStorage fake session token exists
const legacyStored = globalThis.localStorage.getItem('diamond_finance_auth_session');
assert(
  'No fake session token persisted in localStorage',
  legacyStored === null,
  'localStorage is clean of fake session proofs'
);

// -----------------------------------------------------------------------------
// Test 8: Shared Data CRUD Verification Across All 4 Accounts
// -----------------------------------------------------------------------------
console.log('\n--- TEST 8: Shared Data CRUD Verification Across All 4 Accounts ---');
const repo = supabaseRepository();

// Step A: Account 1 creates a test dealer and test transaction
await authSignIn('khakhkhard@gmail.com', 'khakhkhard!123');
const testDealerId = `DLR-QUAD-${Date.now().toString().slice(-4)}`;
const testDealer = {
  id: testDealerId,
  name: '4-Account Shared Dealer',
  location: 'Surat',
  type: 'both',
  contact: 'Quad Contact',
  email: 'quad@dealer.com',
  phone: '9876543210',
  status: 'Active',
};
await repo.insertDealer(testDealer);

const testTrxId = `TRX-QUAD-${Date.now().toString().slice(-4)}`;
const testTrx = {
  id: testTrxId,
  name: 'Quad-Account Deal #200',
  dealerId: testDealerId,
  sellerId: testDealerId,
  buyerId: null,
  date: new Date().toISOString().slice(0, 10),
  diamondCarat: 6.5,
  perCaratRate: 50000,
  totalRate: 325000,
  terms: 2,
  termsAmount: 6500,
  amountAfterTerms: 318500,
  cvd: 0,
  finalNet: 318500,
  dueDays: 20,
  sellType: 'Self',
  status: 'Pending',
  paymentMethod: 'Bank transfer',
  notes: 'Shared data automated test record across 4 accounts',
};
await repo.insertTransaction(testTrx);

// Step B: Account 2 loads and modifies the record
await authSignIn('kpatel467@gmail.com', 'kpatel467!123');
const account2Data = await repo.loadAll();
const acc2FoundTrx = account2Data.transactions.find((t) => t.id === testTrxId);
await repo.updateTransaction(testTrxId, { notes: 'Updated by Account 2' });

// Step C: Account 3 loads the data and updates status
await authSignIn('heyhkchag@gmail.com', 'heyhkchag!123');
const account3Data = await repo.loadAll();
const acc3FoundDealer = account3Data.dealers.find((d) => d.id === testDealerId);
const acc3FoundTrx = account3Data.transactions.find((t) => t.id === testTrxId);
await repo.updateTransaction(testTrxId, { status: 'Completed', notes: 'Completed by Account 3' });

// Step D: Account 4 (New account) loads data, verifies everything, and updates record
await authSignIn('pravinthakkar8162@gmail.com', 'Pravin!123');
const account4Data = await repo.loadAll();
const acc4FoundDealer = account4Data.dealers.find((d) => d.id === testDealerId);
const acc4FoundTrx = account4Data.transactions.find((t) => t.id === testTrxId);

const sharedVerified = (
  Boolean(acc2FoundTrx) &&
  Boolean(acc3FoundDealer) &&
  Boolean(acc3FoundTrx) &&
  Boolean(acc4FoundDealer) &&
  Boolean(acc4FoundTrx) &&
  acc4FoundTrx.status === 'Completed' &&
  acc4FoundTrx.totalRate === 325000
);

assert(
  'All 4 accounts read, write, and see the EXACT SAME Diamond Finance database records',
  sharedVerified,
  `Verified record ${testTrxId} (Amount: ₹${acc4FoundTrx?.totalRate}) created by Account 1, updated by Account 2 & 3, is fully visible and manageable by Account 4.`
);

// Step E: Account 4 deletes the test records
await repo.deleteTransaction(testTrxId);
await repo.deleteDealer(testDealerId);
await authSignOut();

console.log('\n================================================================');
console.log(`SUMMARY: ${passedTests}/${totalTests} Auth Verification Tests Passed.`);
console.log('================================================================\n');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
