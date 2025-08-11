// Script to create initial prompts for existing users
// Run with: node scripts/init-prompts.js

const axios = require('axios')

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Database configuration from environment variables
const NOCODB_API_URL = process.env.NOCODB_API_URL;
const NOCODB_API_TOKEN = process.env.NOCODB_API_TOKEN;
const NOCODB_BASE_NAME = process.env.NOCODB_BASE_NAME;

// Check required environment variables
if (!NOCODB_API_URL || !NOCODB_API_TOKEN || !NOCODB_BASE_NAME) {
  console.error('Error: Missing required environment variables.');
  console.error('Please ensure .env.local contains NOCODB_API_URL, NOCODB_API_TOKEN, and NOCODB_BASE_NAME');
  process.exit(1);
}

async function createInitialPrompts() {
  try {
    // Default prompts for both users
    const prompts = [
      // Prompts for user 1 (micke)
      {
        user_id: 1,
        name: 'Default prompt',
        content: 'You are a helpful AI assistant. Be concise and accurate in your responses.',
        is_default: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        user_id: 1,
        name: 'Creative Writer',
        content: 'You are a creative writing assistant. Help with storytelling, character development, and creative ideas. Use vivid descriptions and engaging language.',
        is_default: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        user_id: 1,
        name: 'Code Assistant',
        content: 'You are a programming expert. Provide clean, well-documented code examples with explanations. Focus on best practices and efficient solutions.',
        is_default: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      
      // Prompts for user 2 (carl)
      {
        user_id: 2,
        name: 'Default prompt',
        content: 'You are a helpful AI assistant. Be concise and accurate in your responses.',
        is_default: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        user_id: 2,
        name: 'Business Advisor',
        content: 'You are a business consultant with expertise in strategy, marketing, and operations. Provide practical, actionable advice for business challenges.',
        is_default: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ]
    
    for (const prompt of prompts) {
      const response = await axios.post(
        `${NOCODB_API_URL}/api/v1/db/data/v1/${NOCODB_BASE_NAME}/prompts`,
        prompt,
        {
          headers: {
            'xc-token': NOCODB_API_TOKEN,
            'Content-Type': 'application/json'
          }
        }
      )
      
      console.log(`✅ Created prompt "${prompt.name}" for user ${prompt.user_id}`)
    }
    
    console.log('🎉 All initial prompts created successfully!')
    
  } catch (error) {
    if (error.response) {
      console.error('Error:', error.response.data)
    } else {
      console.error('Error creating prompts:', error.message)
    }
  }
}

createInitialPrompts()