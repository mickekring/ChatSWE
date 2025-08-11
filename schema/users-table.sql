-- Users table schema for NocoDB
-- You can create this table in NocoDB's UI or import this schema

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  system_prompt TEXT,
  theme VARCHAR(20) DEFAULT 'light',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on username for faster lookups
CREATE INDEX idx_username ON users(username);

-- Sample data (password is 'kring' for user 'micke')
-- Password hash: $2a$10$xQx5Y6Z8vKJH5N6Z8vKJH5N6Z8vKJH5N6Z8vKJH5N6Z8vKJH5N6Z8
-- Note: Generate a real password hash using bcrypt