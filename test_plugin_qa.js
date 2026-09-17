/**
 * Automated QA Test Suite for plugin.js
 * Tests all helper functions, formatting functions, edge cases, and syntax check.
 */

const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { execSync } = require('child_process');

const PLUGIN_PATH = path.resolve(__dirname, 'plugin.js');

console.log('======================================================');
console.log('  OmniRoute plugin.js Comprehensive QA Test Suite');
console.log('======================================================\n');

// 1. Syntax Check via node --check
console.log('[STEP 1] Running syntax check: node --check plugin.js');
try {
  execSync(`node --check "${PLUGIN_PATH}"`, { stdio: 'pipe' });
  console.log('  PASSED: node --check plugin.js completed with 0 errors.\n');
} catch (err) {
  console.error('  FAILED: node --check failed:', err.message);
  process.exit(1);
}

// 2. Extract & instantiate helper functions from plugin.js
console.log('[STEP 2] Loading & extracting functions from plugin.js');
const source = fs.readFileSync(PLUGIN_PATH, 'utf8');

// Isolate helper code between '/* ─── helpers' and '/* ─── UI primitives'
const startMarker = '/* ─── helpers';
const endMarker = '/* ─── UI primitives';

const startIndex = source.indexOf(startMarker);
const endIndex = source.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.error('  FAILED: Could not locate helper functions section in plugin.js');
  process.exit(1);
}

// Transform `const ERR_TH` to `globalThis.ERR_TH` or export it so VM exposes it
const helpersCode = source.slice(startIndex, endIndex) + '\nglobalThis.ERR_TH = ERR_TH;\n';

const sandbox = {
  Date,
  Math,
  String,
  Number,
  Array,
  Object,
  RegExp,
  JSON,
  console,
};
sandbox.globalThis = sandbox;

vm.createContext(sandbox);
vm.runInContext(helpersCode, sandbox);

const {
  fmtUsd,
  fmtTokens,
  fmtPct,
  fmtMs,
  fmtTime,
  fmtDuration,
  maskToken,
  maskEmail,
  formatModelName,
  formatCountdown,
  getQuotaTone,
  statusBadge,
  errKey,
  ERR_TH,
} = sandbox;

console.log('  PASSED: Successfully loaded functions into sandbox environment.\n');

// Test Harness
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function assertTest(fnName, testDesc, actual, expected, condition) {
  totalTests++;
  const passed = condition !== undefined ? condition : (JSON.stringify(actual) === JSON.stringify(expected) || Object.is(actual, expected));
  if (passed) {
    passedTests++;
    console.log(`  [PASS] [${fnName}] ${testDesc}`);
    console.log(`         -> Output: ${JSON.stringify(actual)}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] [${fnName}] ${testDesc}`);
    console.error(`         -> Expected: ${JSON.stringify(expected)}`);
    console.error(`         -> Actual:   ${JSON.stringify(actual)}`);
    failures.push({ fnName, testDesc, actual, expected });
  }
}

console.log('[STEP 3] Executing Unit & Edge Case Tests');
console.log('------------------------------------------------------');

// ─── formatCountdown ─────────────────────────────────────────
console.log('\n--- Testing formatCountdown() ---');
{
  const now = Date.now();
  
  // Past time
  const pastTime = new Date(now - 60000).toISOString();
  assertTest('formatCountdown', 'Past time (1m ago)', formatCountdown(pastTime), '⏱ รีเซ็ตแล้ว');

  const pastExact = new Date(now - 1).toISOString();
  assertTest('formatCountdown', 'Past time (1ms ago)', formatCountdown(pastExact), '⏱ รีเซ็ตแล้ว');

  // 30s left (< 1 min)
  const left30s = new Date(now + 30 * 1000).toISOString();
  assertTest('formatCountdown', '30s left (< 1m remaining -> < 1m)', formatCountdown(left30s), '⏱ Resets in < 1m');

  // 5m left
  const left5m = new Date(now + 5 * 60 * 1000 + 1000).toISOString();
  assertTest('formatCountdown', '5m left', formatCountdown(left5m), '⏱ Resets in 5m');

  // 2h left (2h 15m)
  const left2h15m = new Date(now + (2 * 60 + 15) * 60 * 1000 + 1000).toISOString();
  assertTest('formatCountdown', '2h 15m left', formatCountdown(left2h15m), '⏱ Resets in 2h 15m');

  // 2h 0m left
  const left2h = new Date(now + 2 * 60 * 60 * 1000 + 1000).toISOString();
  assertTest('formatCountdown', '2h 0m left', formatCountdown(left2h), '⏱ Resets in 2h 0m');

  // 1d left (1d 2h)
  const left1d2h = new Date(now + (26 * 60) * 60 * 1000 + 1000).toISOString();
  assertTest('formatCountdown', '1d left (26h total -> 1d 2h)', formatCountdown(left1d2h), '⏱ Resets in 1d 2h');

  // 1d 0h left
  const left1d0h = new Date(now + 24 * 60 * 60 * 1000 + 1000).toISOString();
  assertTest('formatCountdown', '1d 0h left (24h total -> 1d 0h)', formatCountdown(left1d0h), '⏱ Resets in 1d 0h');

  // Invalid date
  assertTest('formatCountdown', 'Invalid date string "invalid-date"', formatCountdown('invalid-date'), null);
  assertTest('formatCountdown', 'Invalid date "2024-99-99T99:99:99"', formatCountdown('2024-99-99T99:99:99'), null);

  // Null & falsy values
  assertTest('formatCountdown', 'null input', formatCountdown(null), null);
  assertTest('formatCountdown', 'undefined input', formatCountdown(undefined), null);
  assertTest('formatCountdown', 'empty string input', formatCountdown(''), null);
}

// ─── statusBadge ─────────────────────────────────────────────
console.log('\n--- Testing statusBadge() ---');
{
  assertTest('statusBadge', 'Status 0 (in-flight / pending)', statusBadge(0), '🔄');
  assertTest('statusBadge', 'Status 200 (OK / Success)', statusBadge(200), '✅');
  assertTest('statusBadge', 'Status 201 (Created / 2xx)', statusBadge(201), '✅');
  assertTest('statusBadge', 'Status 204 (No Content / 2xx)', statusBadge(204), '✅');
  assertTest('statusBadge', 'Status 400 (Bad Request)', statusBadge(400), '❌ 400');
  assertTest('statusBadge', 'Status 401 (Unauthorized)', statusBadge(401), '❌ 401');
  assertTest('statusBadge', 'Status 404 (Not Found)', statusBadge(404), '❌ 404');
  assertTest('statusBadge', 'Status 500 (Internal Error)', statusBadge(500), '❌ 500');
  assertTest('statusBadge', 'Status undefined', statusBadge(undefined), '❌ undefined');
  assertTest('statusBadge', 'Status null', statusBadge(null), '❌ null');
}

// ─── fmtUsd ──────────────────────────────────────────────────
console.log('\n--- Testing fmtUsd() ---');
{
  assertTest('fmtUsd', 'Positive float (12.3456)', fmtUsd(12.3456), '$12.35');
  assertTest('fmtUsd', 'Zero (0)', fmtUsd(0), '$0.00');
  assertTest('fmtUsd', 'Negative float (-5.5)', fmtUsd(-5.5), '$-5.50');
  assertTest('fmtUsd', 'Small fraction (0.001)', fmtUsd(0.001), '$0.00');
  assertTest('fmtUsd', 'NaN', fmtUsd(NaN), '—');
  assertTest('fmtUsd', 'Infinity', fmtUsd(Infinity), '—');
  assertTest('fmtUsd', '-Infinity', fmtUsd(-Infinity), '—');
  assertTest('fmtUsd', 'null', fmtUsd(null), '—');
  assertTest('fmtUsd', 'undefined', fmtUsd(undefined), '—');
  assertTest('fmtUsd', 'String "12.34"', fmtUsd("12.34"), '—');
}

// ─── fmtTokens ───────────────────────────────────────────────
console.log('\n--- Testing fmtTokens() ---');
{
  assertTest('fmtTokens', 'Millions (1,500,000)', fmtTokens(1500000), '1.5M');
  assertTest('fmtTokens', 'Millions boundary (1,000,000)', fmtTokens(1000000), '1.0M');
  assertTest('fmtTokens', 'Thousands (2,450)', fmtTokens(2450), '2.5k');
  assertTest('fmtTokens', 'Thousands boundary (1,000)', fmtTokens(1000), '1.0k');
  assertTest('fmtTokens', 'Hundreds (999)', fmtTokens(999), '999');
  assertTest('fmtTokens', 'Zero (0)', fmtTokens(0), '0');
  assertTest('fmtTokens', 'Rounding float (12.6)', fmtTokens(12.6), '13');
  assertTest('fmtTokens', 'NaN', fmtTokens(NaN), '—');
  assertTest('fmtTokens', 'Infinity', fmtTokens(Infinity), '—');
  assertTest('fmtTokens', 'null', fmtTokens(null), '—');
  assertTest('fmtTokens', 'undefined', fmtTokens(undefined), '—');
  assertTest('fmtTokens', 'String "5000"', fmtTokens("5000"), '—');
}

// ─── fmtPct ──────────────────────────────────────────────────
console.log('\n--- Testing fmtPct() ---');
{
  assertTest('fmtPct', 'Float percentage (99.56)', fmtPct(99.56), '99.6%');
  assertTest('fmtPct', '100 percent (100)', fmtPct(100), '100.0%');
  assertTest('fmtPct', 'Zero (0)', fmtPct(0), '0.0%');
  assertTest('fmtPct', 'NaN', fmtPct(NaN), '—');
  assertTest('fmtPct', 'Infinity', fmtPct(Infinity), '—');
  assertTest('fmtPct', 'null', fmtPct(null), '—');
  assertTest('fmtPct', 'undefined', fmtPct(undefined), '—');
  assertTest('fmtPct', 'String "50%"', fmtPct("50%"), '—');
}

// ─── fmtMs ───────────────────────────────────────────────────
console.log('\n--- Testing fmtMs() ---');
{
  assertTest('fmtMs', 'Milliseconds (< 1000ms: 450)', fmtMs(450), '450ms');
  assertTest('fmtMs', 'Zero ms (0)', fmtMs(0), '0ms');
  assertTest('fmtMs', 'Seconds (>= 1000ms: 1500)', fmtMs(1500), '1.5s');
  assertTest('fmtMs', 'Seconds boundary (1000)', fmtMs(1000), '1.0s');
  assertTest('fmtMs', 'Rounding float ms (450.7)', fmtMs(450.7), '451ms');
  assertTest('fmtMs', 'NaN', fmtMs(NaN), '—');
  assertTest('fmtMs', 'Infinity', fmtMs(Infinity), '—');
  assertTest('fmtMs', 'null', fmtMs(null), '—');
  assertTest('fmtMs', 'undefined', fmtMs(undefined), '—');
}

// ─── fmtTime ─────────────────────────────────────────────────
console.log('\n--- Testing fmtTime() ---');
{
  const dateObj = new Date(2026, 8, 17, 14, 5, 9); // Sep 17 2026 14:05:09
  const iso = dateObj.toISOString();
  const expectedFormatted = `14:05:09`;
  assertTest('fmtTime', 'Valid date ISO (14:05:09 local)', fmtTime(iso), expectedFormatted);

  assertTest('fmtTime', 'Invalid date string', fmtTime('invalid-iso-string'), '—');
  assertTest('fmtTime', 'null', fmtTime(null), '—');
  assertTest('fmtTime', 'undefined', fmtTime(undefined), '—');
  assertTest('fmtTime', 'empty string', fmtTime(''), '—');
}

// ─── fmtDuration ─────────────────────────────────────────────
console.log('\n--- Testing fmtDuration() ---');
{
  assertTest('fmtDuration', 'Milliseconds (< 1000ms: 320)', fmtDuration(320), '320ms');
  assertTest('fmtDuration', 'Seconds (>= 1000ms: 2500)', fmtDuration(2500), '2.5s');
  assertTest('fmtDuration', 'Seconds (1000ms)', fmtDuration(1000), '1.0s');
  assertTest('fmtDuration', 'Zero (0)', fmtDuration(0), '0ms');
  assertTest('fmtDuration', 'NaN', fmtDuration(NaN), '—');
  assertTest('fmtDuration', 'Infinity', fmtDuration(Infinity), '—');
  assertTest('fmtDuration', 'null', fmtDuration(null), '—');
  assertTest('fmtDuration', 'undefined', fmtDuration(undefined), '—');
}

// ─── maskToken ───────────────────────────────────────────────
console.log('\n--- Testing maskToken() ---');
{
  assertTest('maskToken', 'Long token (> 12 chars: oma_1234567890abcdef)', maskToken('oma_1234567890abcdef'), 'oma_1234…cdef');
  assertTest('maskToken', '13 chars token (1234567890abc)', maskToken('1234567890abc'), '12345678…0abc');
  assertTest('maskToken', '12 chars token (123456789012)', maskToken('123456789012'), '12345…');
  assertTest('maskToken', 'Short token (<= 12 chars: oma_12345)', maskToken('oma_12345'), 'oma_1…');
  assertTest('maskToken', 'null', maskToken(null), '—');
  assertTest('maskToken', 'undefined', maskToken(undefined), '—');
  assertTest('maskToken', 'empty string', maskToken(''), '—');
}

// ─── maskEmail ───────────────────────────────────────────────
console.log('\n--- Testing maskEmail() ---');
{
  assertTest('maskEmail', 'Standard email (alice@example.com -> ali***@*******.com)', maskEmail('alice@example.com'), 'ali***@*******.com');
  assertTest('maskEmail', 'Long username (developer@company.co.uk -> dev******@*******.co.uk)', maskEmail('developer@company.co.uk'), 'dev******@*******.co.uk');
  assertTest('maskEmail', 'Short username (ab@domain.com -> ab***@******.com)', maskEmail('ab@domain.com'), 'ab***@******.com');
  assertTest('maskEmail', '1-char username (x@y.org -> x***@***.org)', maskEmail('x@y.org'), 'x***@***.org');
  assertTest('maskEmail', 'No domain dot (user@localhost -> use***@localhost)', maskEmail('user@localhost'), 'use***@localhost');
  assertTest('maskEmail', 'Non-email string (no @)', maskEmail('notanemail'), 'notanemail');
  assertTest('maskEmail', 'Multiple @ symbols', maskEmail('a@b@c.com'), 'a@b@c.com');
  assertTest('maskEmail', 'null', maskEmail(null), '');
  assertTest('maskEmail', 'undefined', maskEmail(undefined), '');
  assertTest('maskEmail', 'non-string (123)', maskEmail(123), '');
}

// ─── formatModelName ─────────────────────────────────────────
console.log('\n--- Testing formatModelName() ---');
{
  assertTest('formatModelName', 'claude-3-5-sonnet', formatModelName('claude-3-5-sonnet'), 'Claude 3 5 Sonnet');
  assertTest('formatModelName', 'gpt-4o', formatModelName('gpt-4o'), 'GPT 4o');
  assertTest('formatModelName', 'o1-mini', formatModelName('o1-mini'), 'O1 Mini');
  assertTest('formatModelName', 'o3-preview', formatModelName('o3-preview'), 'O3 Preview');
  assertTest('formatModelName', 'deepseek_chat', formatModelName('deepseek_chat'), 'Deepseek Chat');
  assertTest('formatModelName', 'custom-llm-api-sdk-model', formatModelName('custom-llm-api-sdk-model'), 'Custom LLM API SDK Model');
  assertTest('formatModelName', 'null', formatModelName(null), '—');
  assertTest('formatModelName', 'undefined', formatModelName(undefined), '—');
  assertTest('formatModelName', 'empty string', formatModelName(''), '—');
  assertTest('formatModelName', 'non-string (123)', formatModelName(123), '—');
}

// ─── getQuotaTone ────────────────────────────────────────────
console.log('\n--- Testing getQuotaTone() ---');
{
  const redTone = { text: 'text-red-500', bar: 'bg-red-500' };
  const amberTone = { text: 'text-amber-500', bar: 'bg-amber-500' };
  const emeraldTone = { text: 'text-emerald-500', bar: 'bg-emerald-500' };
  const fallbackTone = { text: 'text-(--ui-text-tertiary)', bar: 'bg-(--ui-stroke-secondary)' };

  assertTest('getQuotaTone', '0% (critical <= 20)', getQuotaTone(0), redTone);
  assertTest('getQuotaTone', '15% (critical <= 20)', getQuotaTone(15), redTone);
  assertTest('getQuotaTone', '20% boundary (critical <= 20)', getQuotaTone(20), redTone);
  assertTest('getQuotaTone', '21% (warning <= 50)', getQuotaTone(21), amberTone);
  assertTest('getQuotaTone', '50% boundary (warning <= 50)', getQuotaTone(50), amberTone);
  assertTest('getQuotaTone', '51% (healthy > 50)', getQuotaTone(51), emeraldTone);
  assertTest('getQuotaTone', '100% (healthy > 50)', getQuotaTone(100), emeraldTone);
  assertTest('getQuotaTone', 'null (fallback)', getQuotaTone(null), fallbackTone);
  assertTest('getQuotaTone', 'undefined (fallback)', getQuotaTone(undefined), fallbackTone);
  assertTest('getQuotaTone', 'NaN (fallback)', getQuotaTone(NaN), fallbackTone);
  assertTest('getQuotaTone', 'Infinity (fallback)', getQuotaTone(Infinity), fallbackTone);
}

// ─── errKey & ERR_TH ─────────────────────────────────────────
console.log('\n--- Testing errKey() & ERR_TH ---');
{
  assertTest('errKey', 'String "no-token"', errKey('no-token'), 'no-token');
  assertTest('errKey', 'Error("no-token")', errKey(new Error('no-token')), 'no-token');
  assertTest('errKey', 'String "network"', errKey('network'), 'network');
  assertTest('errKey', 'Error("network")', errKey(new Error('network')), 'network');
  assertTest('errKey', 'String "http-401"', errKey('http-401'), 'http-401');
  assertTest('errKey', 'Error("http-401")', errKey(new Error('http-401')), 'http-401');
  assertTest('errKey', 'Error("http-403")', errKey(new Error('http-403')), 'http-403');
  assertTest('errKey', 'Error("http-404")', errKey(new Error('http-404')), 'http-404');
  assertTest('errKey', 'Error("http-500")', errKey(new Error('http-500')), 'http-500');
  assertTest('errKey', 'Error("http-502 Bad Gateway")', errKey(new Error('http-502 Bad Gateway')), 'http-502');
  assertTest('errKey', 'Unrecognized error string ("fetch failed")', errKey('fetch failed'), 'network');
  assertTest('errKey', 'Unrecognized Error object', errKey(new Error('something unknown')), 'network');
  assertTest('errKey', 'null', errKey(null), 'network');
  assertTest('errKey', 'undefined', errKey(undefined), 'network');

  // Verify ERR_TH mappings
  assertTest('ERR_TH', 'no-token Thai message', ERR_TH['no-token'], 'ยังไม่ได้ตั้ง accessToken');
  assertTest('ERR_TH', 'network Thai message', ERR_TH['network'], 'ต่อ OmniRoute ไม่ได้ (ปิดอยู่?)');
  assertTest('ERR_TH', 'http-401 Thai message', ERR_TH['http-401'], '401 token ผิด/หมดอายุ');
  assertTest('ERR_TH', 'http-403 Thai message', ERR_TH['http-403'], '403 สิทธิ์ไม่พอ');
  assertTest('ERR_TH', 'http-404 Thai message', ERR_TH['http-404'], '404 path ผิด');
  assertTest('ERR_TH', 'http-500 Thai message', ERR_TH['http-500'], '500 server error');
}

// ─── Summary ─────────────────────────────────────────────────
console.log('\n======================================================');
console.log(`  QA Test Suite Results: ${passedTests}/${totalTests} Passed (${Math.round((passedTests / totalTests) * 100)}%)`);
if (failedTests > 0) {
  console.log(`  FAILURES: ${failedTests}`);
  failures.forEach((f, i) => {
    console.log(`    ${i + 1}. [${f.fnName}] ${f.testDesc} (Expected: ${JSON.stringify(f.expected)}, Actual: ${JSON.stringify(f.actual)})`);
  });
  process.exit(1);
} else {
  console.log('  ALL TESTS PASSED WITH ZERO FAILURES! ✅');
  console.log('======================================================\n');
  process.exit(0);
}
