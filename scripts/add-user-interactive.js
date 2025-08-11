#!/usr/bin/env node

/**
 * Interactive script for adding a new user to the database
 * Prompts for user details instead of hardcoding them
 * 
 * Usage: node scripts/add-user-interactive.js
 */

const bcrypt = require('bcryptjs');
const axios = require('axios');
const readline = require('readline');

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

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function to prompt for input
function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Helper function for hidden password input
function promptPassword(question) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    
    let password = '';
    stdin.on('data', (char) => {
      char = char.toString();
      
      if (char === '\n' || char === '\r' || char === '\u0004') {
        stdin.setRawMode(false);
        stdin.pause();
        stdout.write('\n');
        resolve(password);
      } else if (char === '\u0003') {
        // Ctrl+C
        process.exit();
      } else if (char === '\u007f' || char === '\b') {
        // Backspace
        if (password.length > 0) {
          password = password.slice(0, -1);
          stdout.clearLine();
          stdout.cursorTo(0);
          stdout.write(question + '*'.repeat(password.length));
        }
      } else {
        password += char;
        stdout.write('*');
      }
    });
  });
}

async function addUser() {
  try {
    console.log('=== Add New User to ChatSWE ===\n');
    
    // Prompt for user details
    const username = await prompt('Username: ');
    const password = await promptPassword('Password: ');
    const confirmPassword = await promptPassword('Confirm Password: ');
    
    if (password !== confirmPassword) {
      console.error('\nError: Passwords do not match!');
      process.exit(1);
    }
    
    const email = await prompt('Email (optional): ') || `${username}@example.com`;
    const firstName = await prompt('First Name: ');
    const lastName = await prompt('Last Name: ');
    const language = await prompt('Language (sv/en/uk) [default: sv]: ') || 'sv';
    
    // Hash the password
    console.log('\nHashing password...');
    const password_hash = await bcrypt.hash(password, 10);
    
    const newUser = {
      username,
      password_hash,
      email,
      first_name: firstName,
      last_name: lastName,
      system_prompt: '',
      theme: 'light',
      language,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    console.log(`\nAdding user: ${username}...`);
    
    const response = await nocodb.post(`/${USERS_TABLE_NAME}`, newUser);
    
    console.log('\n✅ User added successfully!');
    console.log('\nUser Details:');
    console.log(`- Username: ${username}`);
    console.log(`- Name: ${firstName} ${lastName}`);
    console.log(`- Email: ${email}`);
    console.log(`- Language: ${language}`);
    console.log('\nThe user can now log in to ChatSWE.');
    
  } catch (error) {
    if (error.response?.data?.msg?.includes('Duplicate entry')) {
      console.error('\n❌ Error: Username already exists!');
    } else if (error.response) {
      console.error('\n❌ Error adding user:', error.response.data);
    } else {
      console.error('\n❌ Error adding user:', error.message);
    }
  } finally {
    rl.close();
  }
}

// Run the script
addUser();