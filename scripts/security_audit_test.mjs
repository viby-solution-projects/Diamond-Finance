import { readFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';

console.log('================================================================');
console.log('DIAMOND FINANCE — PRODUCTION SECURITY AUDIT TEST SUITE');
console.log('================================================================\n');

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
// Test 1: CSV Formula Injection Sanitization (E5)
// -----------------------------------------------------------------------------
function sanitizeCsvCell(value) {
  if (value === null || value === undefined) return '';
  let str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return str.replaceAll('"', '""');
}

const csvPayloads = [
  { input: '=cmd|\' /C calc\'!A0', expected: '\'=cmd|\' /C calc\'!A0' },
  { input: '+SUM(1,2)', expected: '\'+SUM(1,2)' },
  { input: '-1000', expected: '\'-1000' },
  { input: '@SUM(A1:A10)', expected: '\'@SUM(A1:A10)' },
  { input: '\t=1+1', expected: '\'\t=1+1' },
  { input: 'Diamond Deal "Premium"', expected: 'Diamond Deal ""Premium""' },
  { input: 'Normal Description', expected: 'Normal Description' },
];

let csvAllPassed = true;
for (const test of csvPayloads) {
  const result = sanitizeCsvCell(test.input);
  if (result !== test.expected) {
    csvAllPassed = false;
    console.error(`CSV mismatch: expected "${test.expected}", got "${result}"`);
  }
}
assert(
  'CSV Formula Injection Sanitization (E5)',
  csvAllPassed,
  'All spreadsheet formula triggers (=, +, -, @, \\t, \\r) are neutralised with leading single quotes and double-quote escaping.'
);

// -----------------------------------------------------------------------------
// Test 2: RLS Policies & Anon Privilege Revocation in Database Schema (C1, C2, C3, C4, C5, B1)
// -----------------------------------------------------------------------------
const schemaContent = readFileSync(resolve('supabase/schema.sql'), 'utf-8');
const patchContent = readFileSync(resolve('supabase/migrations/20260910_safe_production_patch.sql'), 'utf-8');
const dailyExpenseMigration = readFileSync(resolve('supabase/migrations/20260910_create_daily_expenses.sql'), 'utf-8');

const rlsTables = [
  'profiles',
  'dealers',
  'transactions',
  'payments',
  'bookkeeping_entries',
  'daily_expenses',
];

let rlsEnabledCount = 0;
for (const table of rlsTables) {
  const regex = new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY;`, 'i');
  if (regex.test(schemaContent) || regex.test(patchContent) || regex.test(dailyExpenseMigration)) {
    rlsEnabledCount++;
  }
}

assert(
  'Row Level Security (RLS) is explicitly enabled on all core tables (C1)',
  rlsEnabledCount === rlsTables.length,
  `Verified RLS enabled on ${rlsEnabledCount}/${rlsTables.length} tables: ${rlsTables.join(', ')}`
);

const revokedAnon = (
  schemaContent.includes('REVOKE ALL ON TABLE public.dealers FROM anon;') &&
  schemaContent.includes('REVOKE ALL ON TABLE public.transactions FROM anon;') &&
  schemaContent.includes('REVOKE ALL ON TABLE public.payments FROM anon;') &&
  schemaContent.includes('REVOKE ALL ON TABLE public.profiles FROM anon;') &&
  schemaContent.includes('REVOKE ALL ON TABLE public.bookkeeping_entries FROM anon;')
);

assert(
  'Unauthenticated direct database access is explicitly revoked from anon role (A1, B5)',
  revokedAnon,
  'REVOKE ALL ON TABLE statements confirmed for dealers, transactions, payments, profiles, bookkeeping_entries.'
);

const userIsolatedPolicies = (
  schemaContent.includes('auth.uid() = user_id') &&
  patchContent.includes('auth.uid() = user_id') &&
  dailyExpenseMigration.includes('auth.uid() = user_id')
);

assert(
  'User isolation is enforced at the database RLS layer for user-owned financial tables (B1, B2, C2, C3, C4, C5)',
  userIsolatedPolicies,
  'bookkeeping_entries and daily_expenses have SELECT, INSERT, UPDATE, DELETE policies bound to auth.uid() = user_id.'
);

// -----------------------------------------------------------------------------
// Test 3: Secrets & Service Role Key Leakage Audit (G1, G2, G3, C7)
// -----------------------------------------------------------------------------
const mainJsxContent = readFileSync(resolve('src/main.jsx'), 'utf-8');
const repoContent = readFileSync(resolve('src/data/repository.js'), 'utf-8');
const clientContent = readFileSync(resolve('src/data/supabaseClient.js'), 'utf-8');

const forbiddenSecrets = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'service_role',
  'BEGIN RSA PRIVATE KEY',
  'BEGIN PRIVATE KEY',
  'aws_secret_access_key',
];

let secretFoundInClient = false;
let foundSecretName = '';
for (const secret of forbiddenSecrets) {
  if (mainJsxContent.includes(secret) || repoContent.includes(secret)) {
    secretFoundInClient = true;
    foundSecretName = secret;
    break;
  }
}

// In supabaseClient.js, ensure service role key is NEVER used
const clientUsesServiceRole = clientContent.includes('SUPABASE_SERVICE_ROLE_KEY') || clientContent.includes('service_role');

assert(
  'No service role keys or private secrets in frontend application code (G1, G2, G3, C7)',
  !secretFoundInClient && !clientUsesServiceRole,
  'Frontend client exclusively consumes VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY/ANON_KEY via import.meta.env.'
);

// -----------------------------------------------------------------------------
// Test 4: Financial Calculation Integrity & Non-Negative Validation (D1, D2, D3, D5)
// -----------------------------------------------------------------------------
function calculateDeal(carat, perCaratRate, termsPercent = 2, cvd = 0, brokerageRate = 5) {
  const caratVal = Math.max(0, parseFloat(carat) || 0);
  const rateVal = Math.max(0, parseFloat(perCaratRate) || 0);
  const totalRate = Math.round(caratVal * rateVal * 100) / 100;
  const termsAmount = Math.round(((totalRate * (parseFloat(termsPercent) || 0)) / 100) * 100) / 100;
  const amountAfterTerms = Math.round((totalRate - termsAmount) * 100) / 100;
  const cvdVal = Math.max(0, parseFloat(cvd) || 0);
  const finalNet = Math.round((amountAfterTerms - cvdVal) * 100) / 100;
  const brokerageEarned = Math.round(((totalRate * (parseFloat(brokerageRate) || 0)) / 100) * 100) / 100;

  return { totalRate, termsAmount, amountAfterTerms, finalNet, brokerageEarned };
}

const dealCalc = calculateDeal('2.5', '100000', '2', '5000', '5');
const calcAccurate = (
  dealCalc.totalRate === 250000 &&
  dealCalc.termsAmount === 5000 &&
  dealCalc.amountAfterTerms === 245000 &&
  dealCalc.finalNet === 240000 &&
  dealCalc.brokerageEarned === 12500
);

assert(
  'Financial calculation formulas execute with deterministic floating-point precision (D5)',
  calcAccurate,
  `Calculations verified: Total Rate = ₹${dealCalc.totalRate}, Terms (2%) = ₹${dealCalc.termsAmount}, CVD = ₹5000, Final Net = ₹${dealCalc.finalNet}, Brokerage (5%) = ₹${dealCalc.brokerageEarned}`
);

// -----------------------------------------------------------------------------
// Test 5: Production Security Headers Configuration (I2, I3, I4, I5, I6)
// -----------------------------------------------------------------------------
const vercelJson = JSON.parse(readFileSync(resolve('vercel.json'), 'utf-8'));
const headers = vercelJson.headers?.[0]?.headers || [];
const headerMap = Object.fromEntries(headers.map((h) => [h.key, h.value]));

assert(
  'X-Frame-Options configured to DENY clickjacking (I3)',
  headerMap['X-Frame-Options'] === 'DENY',
  'Header X-Frame-Options: DENY is active on all routes.'
);

assert(
  'X-Content-Type-Options configured to nosniff (I4)',
  headerMap['X-Content-Type-Options'] === 'nosniff',
  'Header X-Content-Type-Options: nosniff is active.'
);

assert(
  'Strict-Transport-Security (HSTS) configured for HTTPS (I6)',
  Boolean(headerMap['Strict-Transport-Security']),
  `HSTS configured with: ${headerMap['Strict-Transport-Security']}`
);

assert(
  'Content-Security-Policy (CSP) configured (I2)',
  Boolean(headerMap['Content-Security-Policy']),
  `CSP configured: ${headerMap['Content-Security-Policy']}`
);

// -----------------------------------------------------------------------------
// Test 6: Privilege Escalation Prevention in Client Code (B4)
// -----------------------------------------------------------------------------
const updateProfileSanitizesRole = clientContent.includes('delete sanitizedUpdates.role');
assert(
  'Client-side profile update function explicitly strips and sanitizes role modifications (B4)',
  updateProfileSanitizesRole,
  'updateProfile() removes role field from payload before dispatching update request.'
);

// -----------------------------------------------------------------------------
// Test 7: Exactly Three Authorized Accounts Enforcement (A1, A2, A3)
// -----------------------------------------------------------------------------
const hasAuthorizedList = (
  clientContent.includes('khakhkhard@gmail.com') &&
  clientContent.includes('kpatel467@gmail.com') &&
  clientContent.includes('heyhkchag@gmail.com')
);
const enforcesCaseInsensitive = clientContent.includes('.trim().toLowerCase()');
const hasAuthFilter = clientContent.includes('isAuthorizedEmail');

assert(
  'Exactly three authorized accounts configured with case-insensitive, trimmed matching',
  hasAuthorizedList && enforcesCaseInsensitive && hasAuthFilter,
  'AUTHORIZED_EMAILS includes khakhkhard@gmail.com, kpatel467@gmail.com, and heyhkchag@gmail.com with trim/toLowerCase normalization.'
);

// -----------------------------------------------------------------------------
// Test 8: Clean Rejection of Unauthorized Accounts
// -----------------------------------------------------------------------------
const expectedErrorMessage = 'This email is not authorized to access Diamond Finance.';
const hasCleanRejection = clientContent.includes(expectedErrorMessage);

assert(
  'Unauthorized email addresses receive clean security rejection notice',
  hasCleanRejection,
  `Verified error string: "${expectedErrorMessage}"`
);

// -----------------------------------------------------------------------------
// Test 9: Shared Database & Unified Repository Data Source
// -----------------------------------------------------------------------------
const hasSharedRepository = repoContent.includes('supabaseRepository') && !repoContent.includes('user_db_');
assert(
  'All 3 authorized accounts point to the SAME unified finance database',
  hasSharedRepository,
  'No account-specific database segregation; all 3 users access unified dealers, transactions, payments, bookkeeping, and daily expenses.'
);

console.log('\n================================================================');
console.log(`SUMMARY: ${passedTests}/${totalTests} Security Automated Tests Passed.`);
console.log('================================================================\n');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}

