// Environment variable validation utilities
// Provides secure validation of required environment variables with proper error handling

/**
 * Gets a required environment variable and throws an error if it's missing or empty
 * @param name - The environment variable name
 * @param description - Human-readable description for better error messages
 * @returns The environment variable value
 * @throws Error if the variable is missing or empty
 */
export function requireEnvVar(name: string, description?: string): string {
  const value = process.env[name]
  
  if (!value || value.trim() === '') {
    const desc = description ? ` (${description})` : ''
    throw new Error(`Missing required environment variable: ${name}${desc}`)
  }
  
  return value.trim()
}

/**
 * Gets an optional environment variable with a default value
 * @param name - The environment variable name
 * @param defaultValue - Default value to use if env var is missing
 * @returns The environment variable value or default
 */
export function getEnvVar(name: string, defaultValue: string): string {
  const value = process.env[name]
  return value && value.trim() !== '' ? value.trim() : defaultValue
}

/**
 * Gets the JWT secret with proper validation
 * @returns The JWT secret
 * @throws Error if JWT_SECRET is not set
 */
export function getJWTSecret(): string {
  return requireEnvVar('JWT_SECRET', 'Required for JWT token signing and verification')
}

/**
 * Gets the Berget AI configuration with proper validation
 * @returns Object containing Berget AI config
 * @throws Error if required Berget AI env vars are missing
 */
export function getBergetAIConfig() {
  return {
    apiKey: requireEnvVar('BERGET_API_KEY', 'Required for Berget AI API access'),
    baseUrl: getEnvVar('BERGET_API_BASE_URL', 'https://api.berget.ai/v1')
  }
}

/**
 * Gets the NocoDB configuration with proper validation
 * @returns Object containing NocoDB config
 * @throws Error if required NocoDB env vars are missing
 */
export function getNocoDBConfig() {
  return {
    apiUrl: requireEnvVar('NOCODB_API_URL', 'Required for NocoDB database access'),
    apiToken: requireEnvVar('NOCODB_API_TOKEN', 'Required for NocoDB API authentication'),
    baseName: requireEnvVar('NOCODB_BASE_NAME', 'Required for NocoDB base/project name')
  }
}

/**
 * Gets the MCP configuration with proper validation
 * @returns Object containing MCP config
 * @throws Error if required MCP env vars are missing
 */
export function getMCPConfig() {
  return {
    serverUrl: requireEnvVar('MCP_SERVER_URL', 'Required for MCP server connection'),
    authToken: getEnvVar('MCP_AUTH_TOKEN', '') // Optional auth token
  }
}