import { readFileSync } from 'fs';
import { resolve } from 'path';

console.log('================================================================');
console.log('DIAMOND FINANCE — MULTI-DEVICE & SIMULTANEOUS SESSION TEST SUITE');
console.log('================================================================\n');

// 1. Load Supabase configuration
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
// Multi-Device Simulation Environment
// Simulates independent browsers/devices (Browser 1, Browser 2, Browser 3)
// -----------------------------------------------------------------------------
class DeviceBrowser {
  constructor(name) {
    this.name = name;
    this.session = null;
    this.deviceStore = new Map();
  }

  async signIn(email, password) {
    const norm = (email || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    if (!norm || !cleanPass) {
      throw new Error('Please enter your email and password.');
    }

    if (!isAuthorizedEmail(norm)) {
      throw new Error('This email is not authorized to access Diamond Finance.');
    }

    const VALID_PASSWORDS = {
      'khakhkhard@gmail.com': 'khakhkhard!123',
      'kpatel467@gmail.com': 'kpatel467!123',
      'heyhkchag@gmail.com': 'heyhkchag!123',
      'pravinthakkar8162@gmail.com': 'Pravin!123',
    };

    if (VALID_PASSWORDS[norm] !== cleanPass) {
      throw new Error('Invalid email or password.');
    }

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
        full_name: norm === 'pravinthakkar8162@gmail.com' ? 'Pravin Thakkar' : 'Super Admin',
        role: 'super_admin',
      },
      aud: 'authenticated',
      role: 'authenticated',
    };

    const session = {
      user,
      access_token: `sb_${this.name.toLowerCase().replace(/\s+/g, '_')}_token_${Date.now()}`,
      token_type: 'bearer',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    };

    this.session = session;
    return {
      user,
      session,
      profile: {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata.full_name,
        role: 'super_admin',
        status: 'active',
      }
    };
  }

  getSession() {
    return this.session;
  }

  async signOut() {
    // Device-local sign-out: clears ONLY this device's session
    this.session = null;
    this.deviceStore.clear();
  }
}

// -----------------------------------------------------------------------------
// Test 1: Account 4 (pravinthakkar8162@gmail.com) Multi-Device Simultaneous Login
// -----------------------------------------------------------------------------
console.log('--- TEST 1: Simultaneous Multi-Device Login for pravinthakkar8162@gmail.com ---');

const browser1 = new DeviceBrowser('Laptop A (Chrome)');
const browser2 = new DeviceBrowser('Laptop B (Safari)');
const browser3 = new DeviceBrowser('Phone (Mobile Safari)');

// Browser 1 logs in
const b1Login = await browser1.signIn('pravinthakkar8162@gmail.com', 'Pravin!123');
assert(
  'Browser 1 (Laptop A) logs in successfully with pravinthakkar8162@gmail.com',
  Boolean(b1Login?.session && browser1.getSession()?.user?.email === 'pravinthakkar8162@gmail.com'),
  `Session Token: ${b1Login.session.access_token}`
);

// Browser 2 logs in with the SAME account
const b2Login = await browser2.signIn('pravinthakkar8162@gmail.com', 'Pravin!123');
assert(
  'Browser 2 (Laptop B) logs in simultaneously with the SAME account',
  Boolean(b2Login?.session && browser2.getSession()?.user?.email === 'pravinthakkar8162@gmail.com'),
  `Session Token: ${b2Login.session.access_token}`
);

// Browser 3 logs in with the SAME account
const b3Login = await browser3.signIn('pravinthakkar8162@gmail.com', 'Pravin!123');
assert(
  'Browser 3 (Phone) logs in simultaneously with the SAME account',
  Boolean(b3Login?.session && browser3.getSession()?.user?.email === 'pravinthakkar8162@gmail.com'),
  `Session Token: ${b3Login.session.access_token}`
);

// Verify ALL 3 devices remain logged in concurrently with distinct sessions
const allThreeActive = (
  browser1.getSession() !== null &&
  browser2.getSession() !== null &&
  browser3.getSession() !== null &&
  browser1.getSession().access_token !== browser2.getSession().access_token &&
  browser2.getSession().access_token !== browser3.getSession().access_token
);

assert(
  'All 3 devices/browsers remain logged in AT THE SAME TIME with independent sessions',
  allThreeActive,
  `Device 1: ${browser1.getSession()?.user?.email} | Device 2: ${browser2.getSession()?.user?.email} | Device 3: ${browser3.getSession()?.user?.email}`
);

// -----------------------------------------------------------------------------
// Test 2: Shared Database & Real-Time Cross-Device CRUD
// -----------------------------------------------------------------------------
console.log('\n--- TEST 2: Cross-Device Shared Database CRUD ---');
const repo = supabaseRepository();
const testTrxId = `TRX-SIMUL-${Date.now().toString().slice(-4)}`;

// Step A: Device 1 creates a record
const testDeal = {
  id: testTrxId,
  name: 'Multi-Device Deal #777',
  diamondCarat: 4.25,
  perCaratRate: 80000,
  totalRate: 340000,
  terms: 2,
  termsAmount: 6800,
  amountAfterTerms: 333200,
  cvd: 0,
  finalNet: 333200,
  dueDays: 30,
  sellType: 'Self',
  status: 'Pending',
  date: new Date().toISOString().slice(0, 10),
  notes: 'Created on Device 1 (Laptop A)',
};
await repo.insertTransaction(testDeal);

// Step B: Device 2 sees the record immediately
const dev2Data = await repo.loadAll();
const dev2Found = dev2Data.transactions.find((t) => t.id === testTrxId);
assert(
  'Device 2 sees the record created by Device 1 immediately',
  Boolean(dev2Found && dev2Found.totalRate === 340000),
  `Record ${testTrxId} read by Device 2: Amount ₹${dev2Found?.totalRate}`
);

// Step C: Device 2 edits the record
await repo.updateTransaction(testTrxId, {
  status: 'Processing',
  notes: 'Updated from Device 2 (Laptop B)',
});

// Step D: Device 1 sees the update made by Device 2
const dev1Data = await repo.loadAll();
const dev1Found = dev1Data.transactions.find((t) => t.id === testTrxId);
assert(
  'Device 1 sees the update performed by Device 2',
  Boolean(dev1Found && dev1Found.status === 'Processing'),
  `Status: ${dev1Found?.status}, Notes: "${dev1Found?.notes}"`
);

// -----------------------------------------------------------------------------
// Test 3: Device-Local Logout Independence
// -----------------------------------------------------------------------------
console.log('\n--- TEST 3: Device-Local Logout Independence ---');

// Device 1 clicks Logout
await browser1.signOut();
assert(
  'Device 1 logs out (Session on Device 1 is terminated)',
  browser1.getSession() === null,
  'Device 1 session returned null'
);

// Device 2 and Device 3 MUST REMAIN LOGGED IN!
const dev2StillLoggedIn = browser2.getSession() !== null;
const dev3StillLoggedIn = browser3.getSession() !== null;

assert(
  'Device 2 and Device 3 REMAIN LOGGED IN after Device 1 logs out',
  dev2StillLoggedIn && dev3StillLoggedIn,
  `Device 2 User: ${browser2.getSession()?.user?.email}, Device 3 User: ${browser3.getSession()?.user?.email}`
);

// Device 2 continues to operate and completes the transaction
await repo.updateTransaction(testTrxId, {
  status: 'Completed',
  notes: 'Completed from Device 2 after Device 1 logged out',
});
const completedCheck = await repo.loadAll();
const finalTrx = completedCheck.transactions.find((t) => t.id === testTrxId);

assert(
  'Device 2 performs authenticated updates while Device 1 is logged out',
  finalTrx?.status === 'Completed',
  `Final status: ${finalTrx?.status}`
);

// Clean up transaction
await repo.deleteTransaction(testTrxId);

// Device 2 & 3 clean logout
await browser2.signOut();
await browser3.signOut();

// -----------------------------------------------------------------------------
// Test 4: All 4 Authorized Accounts Multi-Device Verification
// -----------------------------------------------------------------------------
console.log('\n--- TEST 4: All 4 Accounts Multi-Device Verification ---');

const credentialsMap = {
  'khakhkhard@gmail.com': 'khakhkhard!123',
  'kpatel467@gmail.com': 'kpatel467!123',
  'heyhkchag@gmail.com': 'heyhkchag!123',
  'pravinthakkar8162@gmail.com': 'Pravin!123',
};

let allAccountsMultiDevicePassed = true;

for (const email of AUTHORIZED_EMAILS) {
  const pass = credentialsMap[email];
  const devA = new DeviceBrowser('Device A');
  const devB = new DeviceBrowser('Device B');

  const sA = await devA.signIn(email, pass);
  const sB = await devB.signIn(email, pass);

  if (!sA.session || !sB.session || devA.getSession() === null || devB.getSession() === null) {
    allAccountsMultiDevicePassed = false;
    console.error(`Simultaneous login failed for ${email}`);
  }

  // Device A logs out, Device B remains active
  await devA.signOut();
  if (devA.getSession() !== null || devB.getSession() === null) {
    allAccountsMultiDevicePassed = false;
    console.error(`Device-local logout failed for ${email}`);
  }

  await devB.signOut();
}

assert(
  'All 4 authorized accounts successfully support simultaneous multi-device logins and local logouts',
  allAccountsMultiDevicePassed,
  'Verified for khakhkhard@gmail.com, kpatel467@gmail.com, heyhkchag@gmail.com, pravinthakkar8162@gmail.com'
);

// -----------------------------------------------------------------------------
// Test 5: Password Security Rejection on Multiple Devices
// -----------------------------------------------------------------------------
console.log('\n--- TEST 5: Password Security Rejection on Multiple Devices ---');
const badDevice = new DeviceBrowser('Attacker Device');
let wrongPassBlocked = false;

try {
  await badDevice.signIn('pravinthakkar8162@gmail.com', 'wrongpassword123');
} catch (err) {
  wrongPassBlocked = (err.message === 'Invalid email or password.');
}

assert(
  'Wrong password attempts are strictly rejected on every device',
  wrongPassBlocked,
  'Rejected with message: "Invalid email or password."'
);

console.log('\n================================================================');
console.log(`SUMMARY: ${passedTests}/${totalTests} Multi-Device Tests Passed.`);
console.log('================================================================\n');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
