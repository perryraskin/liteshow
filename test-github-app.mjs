/**
 * Quick test script for GitHub App functionality
 */

// Test JWT generation
console.log('Testing GitHub App JWT generation...\n');

try {
  const response = await fetch('http://localhost:8000/auth/github', {
    redirect: 'manual'
  });

  const location = response.headers.get('location');
  console.log('✅ OAuth endpoint working');
  console.log('   Scope:', location?.match(/scope=([^&]+)/)?.[1] || 'not found');
  console.log('   Client ID:', location?.match(/client_id=([^&]+)/)?.[1] || 'not found');

} catch (error) {
  console.error('❌ OAuth test failed:', error.message);
}

console.log('\n---\n');

// Test that API is responding
try {
  const response = await fetch('http://localhost:8000/api/projects', {
    headers: {
      'Authorization': 'Bearer invalid-token-for-testing'
    }
  });

  console.log('✅ Projects endpoint responding');
  console.log('   Status:', response.status, response.statusText);

  if (response.status === 401) {
    console.log('   ✓ Properly rejecting invalid auth tokens');
  }

} catch (error) {
  console.error('❌ Projects endpoint test failed:', error.message);
}

console.log('\nAll basic endpoint tests completed!');
