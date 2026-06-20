/**
 * Integration test for Phase 12.3 password reset API.
 * Usage: npx tsx scripts/test-password-reset-api.ts [email]
 */
import 'dotenv/config';
import axios from 'axios';

const baseUrl = process.env.API_BASE_URL || 'http://localhost:5000/api';
const email = process.argv[2] || 'admin@kln.ac.lk';
const testPassword = 'ResetTest1';

async function main() {
  console.log('1. POST /auth/forgot-password');
  const forgot = await axios.post(`${baseUrl}/auth/forgot-password`, { email });
  console.log(forgot.data.message);

  console.log('\n2. Check API terminal or inbox for the 6-digit code, then run:');
  console.log(`   npx tsx scripts/test-password-reset-api.ts ${email} <CODE>`);
  const codeArg = process.argv[3];
  if (!codeArg) return;

  console.log('\n3. POST /auth/verify-reset-code');
  const verify = await axios.post(`${baseUrl}/auth/verify-reset-code`, { email, code: codeArg });
  console.log(verify.data);

  console.log('\n4. POST /auth/reset-password');
  const reset = await axios.post(`${baseUrl}/auth/reset-password`, {
    email,
    code: codeArg,
    newPassword: testPassword,
  });
  console.log(reset.data.message);
  console.log('\nPhase 12.3 API OK');
}

main().catch((err) => {
  console.error(err.response?.data || err.message);
  process.exit(1);
});
