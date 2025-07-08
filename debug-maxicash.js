const axios = require('axios');
require('dotenv').config();

// Maxicash configuration
const MAXICASH_CONFIG = {
  merchantId: process.env.MAXICASH_MERCHANT_ID || '79315b61-d285-4241-89ff-d91a9b76e326',
  merchantPassword: process.env.MAXICASH_MERCHANT_PASSWORD || '9b018bbace954b36998838c94e6b683c',
  apiUrl: process.env.MAXICASH_API_URL || 'https://api.maxicashapp.com',
  webapiUrl: process.env.MAXICASH_WEBAPI_URL || 'https://webapi.maxicashapp.com',
  currency: process.env.MAXICASH_CURRENCY || 'USD',
  gatewayUrl: `${process.env.MAXICASH_API_URL || 'https://api.maxicashapp.com'}/PayEntryPost`
};

console.log('=== MAXICASH CREDENTIALS DEBUG ===');
console.log('Merchant ID:', MAXICASH_CONFIG.merchantId);
console.log('Merchant Password:', MAXICASH_CONFIG.merchantPassword ? '***SET***' : 'MISSING');
console.log('API URL:', MAXICASH_CONFIG.apiUrl);
console.log('WebAPI URL:', MAXICASH_CONFIG.webapiUrl);
console.log('Gateway URL:', MAXICASH_CONFIG.gatewayUrl);
console.log('Currency:', MAXICASH_CONFIG.currency);
console.log('=====================================');

// Test 1: Check if we can reach Maxicash API
async function testMaxicashConnectivity() {
  console.log('\n=== TEST 1: MAXICASH CONNECTIVITY ===');
  
  try {
    const response = await axios.get(MAXICASH_CONFIG.apiUrl, {
      timeout: 10000,
      validateStatus: function (status) {
        return status < 500; // Don't throw for 4xx errors
      }
    });
    
    console.log('✅ Maxicash API is reachable');
    console.log('Status:', response.status);
    console.log('Response:', response.data?.substring ? response.data.substring(0, 200) : response.data);
    
  } catch (error) {
    console.log('❌ Cannot reach Maxicash API');
    console.log('Error:', error.message);
    if (error.code) console.log('Error Code:', error.code);
  }
}

// Test 2: Test merchant credentials with a dummy payment status check
async function testMerchantCredentials() {
  console.log('\n=== TEST 2: MERCHANT CREDENTIALS ===');
  
  try {
    const testReference = 'TEST_' + Date.now();
    
    const response = await axios.post(
      `${MAXICASH_CONFIG.webapiUrl}/Integration/CheckPaymentStatusByReference`,
      {
        MerchantID: MAXICASH_CONFIG.merchantId,
        MerchantPassword: MAXICASH_CONFIG.merchantPassword,
        Reference: testReference,
        TransactionID: ""
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );
    
    console.log('✅ Merchant credentials accepted by Maxicash');
    console.log('Status:', response.status);
    console.log('Response:', response.data);
    
    // Even if payment not found, credentials are valid if we get a proper response
    if (response.data && response.data.ResponseStatus) {
      console.log('✅ API responded with valid structure');
      console.log('Response Status:', response.data.ResponseStatus);
      console.log('Response Message:', response.data.ResponseMessage || 'No message');
    }
    
  } catch (error) {
    console.log('❌ Merchant credentials test failed');
    console.log('Error:', error.message);
    if (error.response) {
      console.log('Response Status:', error.response.status);
      console.log('Response Data:', error.response.data);
    }
  }
}

// Test 3: Test gateway URL
async function testGatewayURL() {
  console.log('\n=== TEST 3: GATEWAY URL ===');
  
  try {
    const response = await axios.get(MAXICASH_CONFIG.gatewayUrl, {
      timeout: 10000,
      validateStatus: function (status) {
        return status < 500; // Don't throw for 4xx errors
      }
    });
    
    console.log('✅ Gateway URL is reachable');
    console.log('Status:', response.status);
    console.log('Response type:', typeof response.data);
    
  } catch (error) {
    console.log('❌ Cannot reach Gateway URL');
    console.log('Error:', error.message);
    if (error.code) console.log('Error Code:', error.code);
  }
}

// Test 4: Simulate payment form submission
async function testPaymentForm() {
  console.log('\n=== TEST 4: PAYMENT FORM SIMULATION ===');
  
  const testReference = 'TEST_' + Date.now();
  const testPaymentData = {
    PayType: 'MaxiCash',
    Amount: '100', // $1.00 in cents
    Currency: MAXICASH_CONFIG.currency,
    Phone: '+1234567890',
    Email: 'test@example.com',
    MerchantID: MAXICASH_CONFIG.merchantId,
    MerchantPassword: MAXICASH_CONFIG.merchantPassword,
    Language: 'en',
    Reference: testReference,
    accepturl: 'http://localhost:3001/payment/success',
    cancelurl: 'http://localhost:3001/payment/cancel',
    declineurl: 'http://localhost:3001/payment/failed',
    notifyurl: 'http://localhost:5000/api/payments/webhook'
  };
  
  console.log('Test payment data:');
  console.log('Reference:', testPaymentData.Reference);
  console.log('Amount:', testPaymentData.Amount);
  console.log('MerchantID:', testPaymentData.MerchantID);
  console.log('Currency:', testPaymentData.Currency);
  
  try {
    const response = await axios.post(
      MAXICASH_CONFIG.gatewayUrl,
      testPaymentData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000,
        validateStatus: function (status) {
          return status < 500; // Don't throw for 4xx errors
        }
      }
    );
    
    console.log('✅ Payment form submission successful');
    console.log('Status:', response.status);
    console.log('Response headers:', response.headers);
    console.log('Response data (first 500 chars):', 
      response.data?.substring ? response.data.substring(0, 500) : response.data);
    
  } catch (error) {
    console.log('❌ Payment form submission failed');
    console.log('Error:', error.message);
    if (error.response) {
      console.log('Response Status:', error.response.status);
      console.log('Response Data:', error.response.data?.substring ? 
        error.response.data.substring(0, 500) : error.response.data);
    }
  }
}

// Run all tests
async function runAllTests() {
  console.log('🔍 Starting Maxicash Integration Debug Tests...\n');
  
  await testMaxicashConnectivity();
  await testMerchantCredentials();
  await testGatewayURL();
  await testPaymentForm();
  
  console.log('\n✅ All tests completed!');
  console.log('\n📝 RECOMMENDATIONS:');
  console.log('1. Check if your Maxicash merchant account is active');
  console.log('2. Verify the merchant credentials with Maxicash support');
  console.log('3. Ensure you\'re using the correct environment (sandbox vs production)');
  console.log('4. Check if there are any IP restrictions on your merchant account');
  console.log('5. Verify the webhook URL is accessible from Maxicash servers');
}

// Run the debug script
runAllTests().catch(console.error);