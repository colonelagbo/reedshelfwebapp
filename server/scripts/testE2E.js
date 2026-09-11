import { generateTOTP } from '../src/services/totp.js';

const API_BASE = 'http://localhost:5000/api';

async function run() {
  console.log('--- STARTING E2E VERIFICATION TEST ---');

  // Test 1: Health check
  console.log('\n[1/7] Testing API Health...');
  const healthRes = await fetch(`${API_BASE}/health`);
  const health = await healthRes.json();
  if (health.status !== 'healthy') throw new Error('Health check failed: ' + JSON.stringify(health));
  console.log('✓ API and Storage healthy:', health.supabaseStorage?.bucket);

  // Test 2: Standard registration & login
  console.log('\n[2/7] Testing User Registration...');
  const testEmail = `testuser_${Date.now()}@example.com`;
  const regRes = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'E2E Test User',
      email: testEmail,
      password: 'Password123!'
    })
  });
  const regData = await regRes.json();
  if (!regData.token) throw new Error('Registration failed: ' + JSON.stringify(regData));
  console.log('✓ Registered user:', regData.user.email, 'ID:', regData.user.id);
  const userToken = regData.token;

  // Test 3: Authenticator 2FA Setup & Activation
  console.log('\n[3/7] Testing TOTP 2FA Setup...');
  const setupRes = await fetch(`${API_BASE}/auth/2fa/setup`, {
    headers: { Authorization: `Bearer ${userToken}` }
  });
  const setupData = await setupRes.json();
  if (!setupData.secret || !setupData.qrCodeUrl) throw new Error('2FA setup failed: ' + JSON.stringify(setupData));
  console.log('✓ Generated 2FA secret and QR code URI:', setupData.secret);

  // Generate 6-digit TOTP code
  const totpCode = generateTOTP(setupData.secret);
  console.log('✓ Generated current TOTP code:', totpCode);

  // Enable 2FA
  const enableRes = await fetch(`${API_BASE}/auth/2fa/enable`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${userToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      secret: setupData.secret,
      code: totpCode
    })
  });
  const enableData = await enableRes.json();
  if (!enableData.success || (!enableData.user?.twoFactorEnabled && !enableData.user?.two_factor_enabled)) {
    throw new Error('2FA enable failed: ' + JSON.stringify(enableData));
  }
  console.log('✓ 2FA successfully activated for user!');

  // Test 4: Sign in with 2FA Challenge & Verification
  console.log('\n[4/7] Testing Login with 2FA Challenge...');
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: 'Password123!'
    })
  });
  const loginData = await loginRes.json();
  if (!loginData.require2FA || !loginData.tempToken) {
    throw new Error('Expected 2FA challenge on login: ' + JSON.stringify(loginData));
  }
  console.log('✓ Received 2FA challenge with tempToken:', loginData.tempToken.slice(0, 20) + '...');

  // Verify 2FA TOTP code on login
  const freshTotp = generateTOTP(setupData.secret);
  const verifyRes = await fetch(`${API_BASE}/auth/2fa/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tempToken: loginData.tempToken,
      code: freshTotp
    })
  });
  const verifyData = await verifyRes.json();
  if (!verifyData.token) throw new Error('2FA verify on login failed: ' + JSON.stringify(verifyData));
  console.log('✓ Successfully verified TOTP and authenticated user session!');

  // Test 5: Google Authentication (Sign up / Sign in)
  console.log('\n[5/7] Testing Google Sign-in / Sign-up...');
  const googleEmail = `google_reader_${Date.now()}@gmail.com`;
  const googleRes = await fetch(`${API_BASE}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: googleEmail,
      name: 'Google Reader',
      googleId: `google_oauth_${Date.now()}`,
      avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=GoogleReader'
    })
  });
  const googleData = await googleRes.json();
  if (!googleData.token || !googleData.user) throw new Error('Google auth failed: ' + JSON.stringify(googleData));
  console.log('✓ Google user authenticated:', googleData.user.email, 'ID:', googleData.user.id);
  const googleUserToken = googleData.token;

  // Test 6: Claim Admin Role & View All User Accounts
  console.log('\n[6/7] Testing Administrator Setup & View Accounts...');
  const claimRes = await fetch(`${API_BASE}/admin/claim-admin`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${googleUserToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      setupKey: 'ReedshelfAdmin2026!'
    })
  });
  const claimData = await claimRes.json();
  if (!claimData.user || claimData.user.role !== 'admin' || !claimData.token) {
    throw new Error('Admin claim failed: ' + JSON.stringify(claimData));
  }
  const adminToken = claimData.token;
  console.log('✓ User elevated to admin:', claimData.user.email, 'Role:', claimData.user.role);

  // Fetch all registered users
  const usersRes = await fetch(`${API_BASE}/admin/users`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const usersData = await usersRes.json();
  if (!Array.isArray(usersData.users)) throw new Error('Get users failed: ' + JSON.stringify(usersData));
  console.log(`✓ Retrieved ${usersData.users.length} total registered accounts!`);
  
  // Verify 2FA status and Google user status are visible
  const found2FAUser = usersData.users.find(u => u.email === testEmail);
  const foundGoogleUser = usersData.users.find(u => u.email === googleEmail);
  console.log('  -> 2FA User in table:', found2FAUser?.email, '2FA Enabled:', found2FAUser?.twoFactorEnabled);
  console.log('  -> Google User in table:', foundGoogleUser?.email, 'Google Account:', foundGoogleUser?.isGoogleUser);

  if (!found2FAUser?.twoFactorEnabled) throw new Error('Expected twoFactorEnabled to be true');
  if (!foundGoogleUser?.isGoogleUser) throw new Error('Expected isGoogleUser to be true');

  // Test 7: Book Upload and Library Retrieval
  console.log('\n[7/7] Testing Book Upload & Library Display...');
  const pdfHeader = `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000108 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n183\n%%EOF`;

  const title = `E2E Test Novel ${Date.now()}`;
  const author = 'Jane Doe';

  const formData = new FormData();
  formData.append('title', title);
  formData.append('author', author);
  formData.append('file', new Blob([pdfHeader], { type: 'application/pdf' }), 'test_book.pdf');

  const uploadRes = await fetch(`${API_BASE}/books/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${googleUserToken}`
    },
    body: formData
  });
  const uploadData = await uploadRes.json();
  const bookId = uploadData.book?.id || uploadData.id;
  if (!bookId) throw new Error('Upload failed: ' + JSON.stringify(uploadData));
  console.log('✓ Book uploaded successfully:', uploadData.title, 'ID:', bookId);

  // Verify book is returned in user's library
  const myBooksRes = await fetch(`${API_BASE}/books`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const myBooksData = await myBooksRes.json();
  const bookList = Array.isArray(myBooksData) ? myBooksData : (myBooksData.books || []);
  const uploadedInLibrary = bookList.find(b => b.id === bookId || b.title === title);
  if (!uploadedInLibrary) throw new Error('Uploaded book was NOT found in user library!');
  console.log('✓ Uploaded book immediately present in user library:', uploadedInLibrary.title);

  console.log('\n========================================');
  console.log('🎉 ALL 7 E2E VERIFICATION TESTS PASSED! 🎉');
  console.log('========================================');
}

run().catch((err) => {
  console.error('\n❌ E2E TEST FAILED:', err);
  process.exit(1);
});
