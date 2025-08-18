# Sample Data for Testing

This directory contains sample data files for testing the credit insights API.

## Files

### `sample-statement.csv`
A comprehensive bank statement CSV file with 31 days of transaction data including:

- **Income**: Monthly salary payments (₦500,000)
- **Expenses**: Various categories like groceries, transport, entertainment, utilities, etc.
- **Realistic amounts**: Nigerian Naira amounts typical for middle-income transactions
- **Proper categorization**: Descriptions that will be categorized by the insights engine

## Transaction Categories in Sample Data

The sample data includes transactions that will be categorized as:

- **Income**: "Salary Payment" transactions
- **Food & Dining**: "Grocery Store", "Restaurant" transactions  
- **Transportation**: "Uber", "Transport", "Gas Station", "Taxi", "Bus", "Train" transactions
- **Shopping**: "Amazon", "Online Shopping" transactions
- **Utilities**: "Utility Bill" transactions
- **Entertainment**: "Entertainment", "Movie", "Gaming", "Concert", "Sports" transactions
- **Other**: "Pharmacy" transactions

## Usage

### 1. Test CSV Upload
```bash
# Start the server
npm run dev

# Create admin user (first time)
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"password123","role":"ADMIN"}'

# Login to get token
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"password123"}'

# Upload the sample CSV (replace YOUR_TOKEN with actual token)
curl -X POST http://localhost:3000/statements/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "csv=@sample-data/sample-statement.csv" \
  -F "sourceLabel=Sample Bank Statement"
```

### 2. Test Insights Computation
```bash
# After uploading, compute insights (replace STATEMENT_ID with actual ID)
curl -X POST http://localhost:3000/insights/run \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"statementId":"STATEMENT_ID"}'
```

### 3. Test Bureau Check
```bash
# Test credit bureau check
curl -X POST http://localhost:3000/bureau/check \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bvn":"12345678901"}'
```

## Expected Insights Results

With this sample data, you should see:

- **Monthly Income Average**: ~₦500,000 (4 salary payments over ~1 month)
- **3-Month Inflow**: ₦2,000,000 (4 salary payments)
- **3-Month Outflow**: ~₦400,000+ (various expenses)
- **Spend Breakdown**: Categories like Food & Dining, Transportation, Shopping, etc.
- **Risk Flags**: Based on spending patterns and amounts

## Data Characteristics

- **Time Period**: January 1-31, 2024
- **Total Transactions**: 31
- **Income Transactions**: 4 salary payments
- **Expense Transactions**: 27 various expenses
- **Parse Success Rate**: Should be 100% (well-formatted data)
- **Realistic Nigerian Context**: Amounts and descriptions typical for Nigerian banking



