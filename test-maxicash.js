const axios = require('axios');

// Test MaxiCash credentials
const testCredentials = async () => {
  const merchantId = '79315b61-d285-4241-89ff-d91a9b76e326';
  const merchantPassword = '9b018bbace954b36998838c94e6b683c';
  
  console.log('Testing MaxiCash credentials...');
  console.log('Merchant ID:', merchantId);
  console.log('Password:', merchantPassword ? 'SET' : 'MISSING');
  
  try {
    // Test with testbed
    console.log('\n=== Testing TESTBED Environment ===');
    const testbedResponse = await axios.post(
      'https://webapi-testbed.maxicashapp.com/Integration/CheckPaymentStatusByReference',
      {
        MerchantID: merchantId,
        MerchantPassword: merchantPassword,
        Reference: 'TEST_REF_123',
        TransactionID: ""
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Testbed Response:', testbedResponse.data);
    
  } catch (error) {
    console.log('Testbed Error:', error.response?.data || error.message);
  }
  
  try {
    // Test with production
    console.log('\n=== Testing PRODUCTION Environment ===');
    const prodResponse = await axios.post(
      'https://webapi.maxicashapp.com/Integration/CheckPaymentStatusByReference',
      {
        MerchantID: merchantId,
        MerchantPassword: merchantPassword,
        Reference: 'TEST_REF_123',
        TransactionID: ""
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Production Response:', prodResponse.data);
    
  } catch (error) {
    console.log('Production Error:', error.response?.data || error.message);
  }
  
  console.log('\n=== Test Complete ===');
};

testCredentials();