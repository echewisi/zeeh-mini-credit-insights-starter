#!/bin/bash

# Test script for the Credit Insights API
# This script demonstrates the complete workflow using sample data

set -e

BASE_URL="http://localhost:3000"
ADMIN_EMAIL="admin@test.com"
ADMIN_PASSWORD="password123"
SAMPLE_CSV="sample-data/sample-statement.csv"

echo "Starting Credit Insights API Test"
echo "=================================="

# Check if server is running
echo "📡 Checking if server is running..."
if ! curl -s "$BASE_URL/health" > /dev/null; then
    echo " Server is not running. Please start the server with: npm run dev"
    exit 1
fi
echo " Server is running"

# Create admin user
echo " Creating admin user..."
CREATE_USER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\",\"role\":\"ADMIN\"}" || echo "")

if echo "$CREATE_USER_RESPONSE" | grep -q "User already exists"; then
    echo " Admin user already exists"
elif echo "$CREATE_USER_RESPONSE" | grep -q "error"; then
    echo " Failed to create admin user: $CREATE_USER_RESPONSE"
    exit 1
else
    echo " Admin user created successfully"
fi

# Login to get token
echo " Logging in to get access token..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "Failed to get access token: $LOGIN_RESPONSE"
    exit 1
fi

echo " Login successful, token obtained"

# Upload CSV statement
echo " Uploading sample CSV statement..."
UPLOAD_RESPONSE=$(curl -s -X POST "$BASE_URL/statements/upload" \
    -H "Authorization: Bearer $TOKEN" \
    -F "csv=@$SAMPLE_CSV" \
    -F "sourceLabel=Sample Bank Statement")

STATEMENT_ID=$(echo "$UPLOAD_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

if [ -z "$STATEMENT_ID" ]; then
    echo "Failed to upload statement: $UPLOAD_RESPONSE"
    exit 1
fi

echo " Statement uploaded successfully (ID: $STATEMENT_ID)"

# Compute insights
echo "Computing financial insights..."
INSIGHTS_RESPONSE=$(curl -s -X POST "$BASE_URL/insights/run" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"statementId\":\"$STATEMENT_ID\"}")

INSIGHT_ID=$(echo "$INSIGHTS_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

if [ -z "$INSIGHT_ID" ]; then
    echo " Failed to compute insights: $INSIGHTS_RESPONSE"
    exit 1
fi

echo "Insights computed successfully (ID: $INSIGHT_ID)"

# Get insights details
echo " Retrieving insights details..."
INSIGHT_DETAILS=$(curl -s -X GET "$BASE_URL/insights/$INSIGHT_ID" \
    -H "Authorization: Bearer $TOKEN")

echo " Insights Summary:"
echo "$INSIGHT_DETAILS" | jq -r '.insight | "  Monthly Income Avg: ₦\(.monthlyIncomeAvg // 0)"'
echo "$INSIGHT_DETAILS" | jq -r '.insight | "  3-Month Inflow: ₦\(.inflow3m // 0)"'
echo "$INSIGHT_DETAILS" | jq -r '.insight | "  3-Month Outflow: ₦\(.outflow3m // 0)"'
echo "$INSIGHT_DETAILS" | jq -r '.insight | "  3-Month Net: ₦\(.net3m // 0)"'

# Test bureau check
echo "Testing credit bureau check..."
BUREAU_RESPONSE=$(curl -s -X POST "$BASE_URL/bureau/check" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"bvn":"12345678901"}')

BUREAU_ID=$(echo "$BUREAU_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

if [ -z "$BUREAU_ID" ]; then
    echo "Failed to perform bureau check: $BUREAU_RESPONSE"
    exit 1
fi

echo " Bureau check completed successfully (ID: $BUREAU_ID)"

# Display bureau results
echo " Bureau Report Summary:"
echo "$BUREAU_RESPONSE" | jq -r '.report | "  Credit Score: \(.score // "N/A")"'
echo "$BUREAU_RESPONSE" | jq -r '.report | "  Risk Band: \(.riskBand // "N/A")"'
echo "$BUREAU_RESPONSE" | jq -r '.report | "  Enquiries (6m): \(.enquiries6m // "N/A")"'
echo "$BUREAU_RESPONSE" | jq -r '.report | "  Defaults: \(.defaults // "N/A")"'
echo "$BUREAU_RESPONSE" | jq -r '.report | "  Open Loans: \(.openLoans // "N/A")"'

# Test audit log endpoints
echo "Testing audit log endpoints..."
echo " Getting audit summary..."
AUDIT_SUMMARY=$(curl -s -X GET "$BASE_URL/audit/summary" \
    -H "Authorization: Bearer $TOKEN")

echo " Audit Summary:"
echo "$AUDIT_SUMMARY" | jq -r '.data | "  Total Logs: \(.totalLogs)"'
echo "$AUDIT_SUMMARY" | jq -r '.data | "  Today: \(.todayLogs)"'
echo "$AUDIT_SUMMARY" | jq -r '.data | "  Last 7 Days: \(.last7DaysLogs)"'
echo "$AUDIT_SUMMARY" | jq -r '.data | "  Last 30 Days: \(.last30DaysLogs)"'

echo " Getting recent audit logs..."
AUDIT_LOGS=$(curl -s -X GET "$BASE_URL/audit/logs?limit=5" \
    -H "Authorization: Bearer $TOKEN")

echo " Recent Audit Actions:"
echo "$AUDIT_LOGS" | jq -r '.data[] | "  \(.action) - \(.targetType // "N/A") (\(.createdAt))"'

echo " Getting available audit actions..."
AUDIT_ACTIONS=$(curl -s -X GET "$BASE_URL/audit/actions" \
    -H "Authorization: Bearer $TOKEN")

echo " Available Audit Actions:"
echo "$AUDIT_ACTIONS" | jq -r '.data[] | "  - \(.)"'

echo ""
echo " All tests completed successfully!"
echo "=================================="
echo "Summary:"
echo "  - Statement uploaded: $STATEMENT_ID"
echo "  - Insights computed: $INSIGHT_ID"
echo "  - Bureau check: $BUREAU_ID"
echo "  - Audit logs tested"
echo ""
echo "🔗 API Documentation: http://localhost:3000/docs"
echo " Health Check: http://localhost:3000/health"
echo " Metrics: http://localhost:3000/metrics"
echo " Audit Logs: http://localhost:3000/audit/logs"

