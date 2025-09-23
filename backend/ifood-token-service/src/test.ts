import dotenv from 'dotenv';
import { IFoodTokenService } from './ifoodTokenService';

// Load environment variables
dotenv.config();

async function testTokenService() {
  console.log('🧪 Starting iFood Token Service Test...\n');

  // Check environment variables
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing environment variables:');
    console.error('  - SUPABASE_URL:', !!supabaseUrl);
    console.error('  - SUPABASE_ANON_KEY:', !!supabaseKey);
    console.error('\n💡 Please check your .env file');
    process.exit(1);
  }

  // Test credentials (from JSON file)
  const testClientId = 'f133bf28-ff34-47c3-827d-dd2b662f0363';
  const testClientSecret = 'gh1x4aatcrge25wtv6j6qx9b1lqktt3vupjxijp10iodlojmj1vytvibqzgai5z0zjd3t5drhxij5ifwf1nlw09z06mt92rx149';
  const testUserId = '4bd7433f-bc74-471f-ac0d-7d631bd5038c';

  // Initialize service
  const service = new IFoodTokenService(supabaseUrl, supabaseKey);

  try {
    console.log('📊 Test Configuration:');
    console.log(`  - Client ID: ${testClientId.substring(0, 8)}...`);
    console.log(`  - User ID: ${testUserId.substring(0, 8)}...`);
    console.log(`  - Supabase URL: ${supabaseUrl}`);
    console.log('');

    // Test 1: Check existing token
    console.log('🔍 Test 1: Checking existing token...');
    const existingToken = await service.checkExistingToken(testClientId);
    if (existingToken) {
      console.log('✅ Found existing token:', {
        expires_at: existingToken.expires_at,
        user_id: existingToken.user_id.substring(0, 8) + '...'
      });
    } else {
      console.log('📭 No existing token found');
    }
    console.log('');

    // Test 2: Full token flow
    console.log('🎯 Test 2: Processing complete token request...');
    const result = await service.processTokenRequest(
      testClientId,
      testClientSecret,
      testUserId
    );

    console.log('📋 Result:');
    if (result.success) {
      console.log('✅ Success:', result.message);
      if (result.data) {
        console.log('📦 Data received:', {
          client_id: result.data.client_id?.substring(0, 8) + '...',
          has_access_token: !!result.data.access_token,
          expires_at: result.data.expires_at,
          user_id: result.data.user_id?.substring(0, 8) + '...'
        });
      }
    } else {
      console.log('❌ Failed:', result.error);
    }

  } catch (error: any) {
    console.error('❌ Test failed with error:', error.message || error);
  }

  console.log('\n🏁 Test completed!');
}

// Run test
testTokenService();