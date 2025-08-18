// Test setup file
import dotenv from 'dotenv';
import { jest } from '@jest/globals';

// Load environment variables for testing
dotenv.config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/test_db';
process.env.BUREAU_API_URL = 'http://localhost:4000';
process.env.BUREAU_API_KEY = 'test-key';

// Global test timeout
jest.setTimeout(30000);

// Suppress console logs during tests (optional)
if (process.env.SUPPRESS_LOGS === 'true') {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
}

// Mock environment variables that might not be set in test environment
process.env.LOG_LEVEL = 'error';


