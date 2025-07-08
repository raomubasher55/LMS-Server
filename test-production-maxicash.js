const axios = require('axios');

// Test production MaxiCash configuration
const testProductionConfig = async () => {
  const merchantId = '79315b61-d285-4241-89ff-d91a9b76e326';
  const merchantPassword = '9b018bbace954b36998838c94e6b683c';
  
  console.log('=== Testing PRODUCTION MaxiCash Configuration ===');
  console.log('Merchant ID:', merchantId);
  console.log('Password:', merchantPassword ? 'SET' : 'MISSING');
  console.log('API URL:', 'https://api.maxicashapp.com');
  console.log('WebAPI URL:', 'https://webapi.maxicashapp.com');
  console.log('Gateway URL:', 'https://api.maxicashapp.com/PayEntryPost');
  
  try {
    // Test payment status check (similar to what the app does)
    console.log('\n=== Testing Payment Status Check ===');
    const response = await axios.post(
      'https://webapi.maxicashapp.com/Integration/CheckPaymentStatusByReference',
      {
        MerchantID: merchantId,
        MerchantPassword: merchantPassword,
        Reference: 'TEST_REF_' + Date.now(),
        TransactionID: ""
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ SUCCESS: MaxiCash API responded');
    console.log('Response:', response.data);
    
    if (response.data.ResponseStatus === 'success') {
      console.log('✅ Merchant credentials are VALID');
      console.log('✅ Production environment is CORRECT');
    } else {
      console.log('⚠️  Merchant credentials may have issues');
    }
    
  } catch (error) {
    console.log('❌ ERROR:', error.response?.data || error.message);
  }
  
  console.log('\n=== Test Complete ===');
};

testProductionConfig();