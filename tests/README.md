# Testing Guide

This directory contains comprehensive tests for the Credit Insights API.


## Test Categories

### 1. Unit Tests (`tests/unit/`)
- **Income Detection**: Tests for identifying and calculating income patterns
- **Spend Buckets**: Tests for transaction categorization and spending analysis
- **Bureau Client**: Tests for retry logic, timeouts, and error handling

### 2. Integration Tests (`tests/integration/`)
- **Happy Path**: Complete workflow from user creation to insights computation
- **Data Validation**: CSV parsing accuracy and insights computation
- **Error Handling**: Graceful handling of invalid inputs and edge cases
- **Security**: Authentication and role-based access control

### 3. Mock Services (`tests/mocks/`)
- **Bureau Mock**: Simulates credit bureau API with rate limiting and errors

## Running Tests

### All Tests
```bash
npm test
```

### Unit Tests Only
```bash
npm run test:unit
```

### Integration Tests Only
```bash
npm run test:integration
```

### Watch Mode (Development)
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

### CI Mode
```bash
npm run test:ci
```

## Test Configuration

### Jest Configuration (`jest.config.ts`)
- **ESM Support**: Configured for ES modules
- **Coverage**: 70% threshold for branches, functions, lines, and statements
- **Timeout**: 30 seconds for integration tests
- **Environment**: Node.js test environment

### Test Setup (`tests/setup.ts`)
- **Environment Variables**: Loads test-specific configuration
- **Database**: Uses test database URL
- **Mock Services**: Configures mock bureau API
- **Logging**: Suppresses console output during tests

## Test Data

### Sample Data Generation
The `TestHelpers` class provides utilities for:
- Creating test users with JWT tokens
- Generating sample CSV content
- Creating test statements with transactions
- Cleaning up test data

### Mock Prisma Client
For unit tests, use `TestHelpers.createMockPrisma()` to mock database operations.

## Test Coverage

### Current Coverage Targets
- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

### Coverage Reports
- **Text**: Console output
- **HTML**: Detailed coverage in `coverage/` directory
- **LCOV**: For CI/CD integration

## Best Practices

### 1. Test Isolation
- Each test should be independent
- Use `beforeEach` and `afterEach` for cleanup
- Mock external dependencies

### 2. Descriptive Test Names
- Use clear, descriptive test names
- Group related tests with `describe` blocks
- Test one specific behavior per test

### 3. Assertions
- Test both positive and negative cases
- Verify error messages and status codes
- Check data integrity and relationships

### 4. Mocking
- Mock external services (Prisma, HTTP clients)
- Use realistic test data
- Test error conditions with mocks

## Troubleshooting

### Common Issues

#### 1. ES Module Errors
```bash
# Ensure Jest is configured for ESM
npm run test:unit
```

#### 2. Database Connection Issues
```bash
# Check test database configuration
# Ensure test database is running
```

#### 3. Timeout Errors
```bash
# Increase timeout for slow tests
# Check for hanging promises or async operations
```

#### 4. Mock Service Issues
```bash
# Ensure mock bureau is running on port 4000
# Check mock service configuration
```

### Debug Mode
```bash
# Run tests with verbose output
npm test -- --verbose

# Run specific test file
npm test -- tests/unit/insightsService.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="income detection"
```

## CI/CD Integration

### GitHub Actions
Tests run automatically on:
- Push to main/master branch
- Pull requests
- Manual workflow dispatch

### Test Commands in CI
```yaml
- run: npm ci
- run: npm run test:ci
```

### Coverage Reports
Coverage reports are generated and can be integrated with:
- Codecov
- SonarQube
- GitHub Code Scanning


