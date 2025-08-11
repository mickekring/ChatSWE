/**
 * Example script for adding a new user to the database
 * 
 * SECURITY NOTE: Never commit actual user credentials to git!
 * 
 * Usage:
 * 1. Copy this file to add-[username]-user.js (this will be gitignored)
 * 2. Update the user details below
 * 3. Run: node scripts/add-[username]-user.js
 */

const bcrypt = require('bcryptjs');
const axios = require('axios');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Database configuration from environment variables
const NOCODB_API_URL = process.env.NOCODB_API_URL;
const NOCODB_API_TOKEN = process.env.NOCODB_API_TOKEN;
const NOCODB_BASE_NAME = process.env.NOCODB_BASE_NAME;
const USERS_TABLE_NAME = 'users';

// Check required environment variables
if (!NOCODB_API_URL || !NOCODB_API_TOKEN || !NOCODB_BASE_NAME) {
  console.error('Error: Missing required environment variables.');
  console.error('Please ensure .env.local contains NOCODB_API_URL, NOCODB_API_TOKEN, and NOCODB_BASE_NAME');
  process.exit(1);
}

// Create axios instance with default config
const nocodb = axios.create({
  baseURL: `${NOCODB_API_URL}/api/v1/db/data/v1/${NOCODB_BASE_NAME}`,
  headers: {
    'xc-token': NOCODB_API_TOKEN,
    'Content-Type': 'application/json'
  }
});

async function addUser() {
  try {
    // UPDATE THESE VALUES WITH ACTUAL USER DATA
    const USERNAME = 'example_username';  // CHANGE THIS
    const PASSWORD = 'example_password';  // CHANGE THIS
    const EMAIL = 'user@example.com';     // CHANGE THIS
    const FIRST_NAME = 'First';           // CHANGE THIS
    const LAST_NAME = 'Last';             // CHANGE THIS
    
    // Hash the password
    const password_hash = await bcrypt.hash(PASSWORD, 10);
    
    const newUser = {
      username: USERNAME,
      password_hash,
      email: EMAIL,
      first_name: FIRST_NAME,
      last_name: LAST_NAME,
      system_prompt: '',
      theme: 'light',
      language: 'sv',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    console.log(`Adding user: ${USERNAME}`);
    
    const response = await nocodb.post(`/${USERS_TABLE_NAME}`, newUser);
    
    console.log('User added successfully:', response.data);
    console.log('\nLogin credentials:');
    console.log(`Username: ${USERNAME}`);
    console.log(`Password: [hidden for security]`);
  } catch (error) {
    if (error.response) {
      console.error('Error adding user:', error.response.data);
    } else {
      console.error('Error adding user:', error.message);
    }
  }
}

// Run the script
addUser();