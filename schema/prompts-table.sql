-- Prompts table schema for NocoDB
-- Create this table in NocoDB's UI or import this schema

CREATE TABLE prompts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create index on user_id for faster lookups
CREATE INDEX idx_prompts_user_id ON prompts(user_id);

-- Create index on user_id + is_default for finding default prompt
CREATE INDEX idx_prompts_user_default ON prompts(user_id, is_default);

-- Sample data for existing users
-- Default prompt for user 1 (micke) - you can modify this content
INSERT INTO prompts (user_id, name, content, is_default) VALUES 
(1, 'Default', 'You are a helpful AI assistant. Be concise and accurate in your responses.', TRUE);

-- Default prompt for user 2 (carl)
INSERT INTO prompts (user_id, name, content, is_default) VALUES 
(2, 'Default', 'You are a helpful AI assistant. Be concise and accurate in your responses.', TRUE);