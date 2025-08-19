import dotenv from 'dotenv';
import { jest } from '@jest/globals';

dotenv.config({ path: '.env' });

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/zeeh';
process.env.BUREAU_API_URL = 'http://localhost:4000';
process.env.BUREAU_API_KEY = 'test-key';

jest.setTimeout(30000);

if (process.env.SUPPRESS_LOGS === 'true') {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
}

process.env.LOG_LEVEL = 'error';


