import request from 'supertest';
import { createServer } from '../../src/server.js';
import { PrismaClient } from '@prisma/client';
import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

describe('Credit Insights API - Happy Path Integration', () => {
  let app: any;
  let adminToken: string;
  let userId: string;
  let statementId: string;
  let insightId: string;
  let bureauReportId: string;

  // Shared test data
  const testData = {
    adminEmail: 'admin@test.com',
    adminPassword: 'password123',
    userEmail: 'user@test.com',
    userPassword: 'password123',
    testBVN: '12345678901'
  };

  beforeAll(async () => {
    app = createServer();
    
    // Clean up test data - handle case where tables might not exist
    try {
      await prisma.auditLog.deleteMany();
      await prisma.insight.deleteMany();
      await prisma.transaction.deleteMany();
      await prisma.statement.deleteMany();
      await prisma.bureauReport.deleteMany();
      await prisma.user.deleteMany();
    } catch (error) {
      // Tables might not exist yet, that's okay
      console.log('Tables not ready for cleanup, continuing...');
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Complete Workflow', () => {
    it('should complete the entire credit insights workflow', async () => {
      // Step 1: Create admin user directly in database (bypass auth for first admin)
      const passwordHash = await bcrypt.hash('password123', 12);
      const adminUser = await prisma.user.create({
        data: {
          email: 'admin@test.com',
          passwordHash,
          role: 'ADMIN'
        }
      });

      expect(adminUser).toBeDefined();
      expect(adminUser.role).toBe('ADMIN');

      // Step 2: Login as admin
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'password123'
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.token).toBeDefined();
      adminToken = loginResponse.body.token;
      userId = loginResponse.body.user.id;

      // Step 3: Upload CSV statement
      const csvContent = `date,description,amount,balance
2024-01-01,Salary Payment - ABC Corp,500000,500000
2024-01-02,Grocery Store - Walmart,-25000,475000
2024-01-03,Uber Ride - Transport,-1500,473500
2024-01-04,Amazon Shopping - Electronics,-45000,428500
2024-01-05,Restaurant - Fine Dining,-8000,420500`;

      const uploadResponse = await request(app)
        .post('/statements/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('sourceLabel', 'Test Statement')
        .attach('csv', Buffer.from(csvContent), 'test-statement.csv');

      expect(uploadResponse.status).toBe(200);
      expect(uploadResponse.body.statement).toBeDefined();
      expect(uploadResponse.body.transactions).toHaveLength(5);
      statementId = uploadResponse.body.statement.id;

      // Step 4: Compute insights
      const insightsResponse = await request(app)
        .post('/insights/run')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ statementId });

      expect(insightsResponse.status).toBe(200);
      expect(insightsResponse.body.insight).toBeDefined();
      expect(insightsResponse.body.insight.statementId).toBe(statementId);
      insightId = insightsResponse.body.insight.id;

      // Step 5: Retrieve insights
      const getInsightsResponse = await request(app)
        .get(`/insights/${insightId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getInsightsResponse.status).toBe(200);
      expect(getInsightsResponse.body.insight).toBeDefined();
      expect(getInsightsResponse.body.insight.monthlyIncomeAvg).toBeGreaterThan(0);
      expect(getInsightsResponse.body.insight.inflow3m).toBeGreaterThan(0);
      expect(getInsightsResponse.body.insight.outflow3m).toBeGreaterThan(0);

      // Step 6: Perform bureau check
      const bureauResponse = await request(app)
        .post('/bureau/check')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ bvn: '12345678901' });

      expect(bureauResponse.status).toBe(200);
      expect(bureauResponse.body.report).toBeDefined();
      expect(bureauResponse.body.report.bvn).toBe('12345678901');
      bureauReportId = bureauResponse.body.report.id;

      // Step 7: Retrieve bureau report
      const getBureauResponse = await request(app)
        .get(`/bureau/report/12345678901`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getBureauResponse.status).toBe(200);
      expect(getBureauResponse.body.report).toBeDefined();
      expect(getBureauResponse.body.report.id).toBe(bureauReportId);

      // Step 8: Verify audit logs were created
      const auditLogsResponse = await request(app)
        .get('/audit/logs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(auditLogsResponse.status).toBe(200);
      expect(auditLogsResponse.body.data).toBeDefined();
      expect(auditLogsResponse.body.data.length).toBeGreaterThan(0);

      // Verify specific audit events
      const auditActions = auditLogsResponse.body.data.map((log: any) => log.action);
      expect(auditActions).toContain('USER_CREATED');
      expect(auditActions).toContain('USER_LOGIN');
      expect(auditActions).toContain('STATEMENT_UPLOADED');
      expect(auditActions).toContain('INSIGHTS_COMPUTED');
      expect(auditActions).toContain('BUREAU_CREDIT_CHECK');
    });
  });

  describe('Data Validation', () => {
    it('should validate CSV parsing accuracy', async () => {
      // Skip if main workflow didn't complete
      if (!statementId) {
        console.log('Skipping CSV validation - statementId not available');
        return;
      }

      const statement = await prisma.statement.findUnique({
        where: { id: statementId }
      });

      expect(statement).toBeDefined();
      expect(statement?.rowCount).toBe(5);
      expect(statement?.parseSuccessRate).toBe(100);

      const transactions = await prisma.transaction.findMany({
        where: { statementId }
      });

      expect(transactions).toHaveLength(5);
      
      // Verify first transaction (salary)
      const salaryTx = transactions.find(t => t.amount > 0);
      expect(salaryTx).toBeDefined();
      expect(salaryTx?.amount).toBe(500000);
      expect(salaryTx?.description).toContain('Salary');

      // Verify expense transactions
      const expenses = transactions.filter(t => t.amount < 0);
      expect(expenses).toHaveLength(4);
      expect(expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0)).toBe(78000);
    });

    it('should validate insights computation accuracy', async () => {
      // Skip if main workflow didn't complete
      if (!insightId) {
        console.log('Skipping insights validation - insightId not available');
        return;
      }

      const insight = await prisma.insight.findUnique({
        where: { id: insightId }
      });

      expect(insight).toBeDefined();
      expect(insight?.monthlyIncomeAvg).toBe(500000); // Single month
      expect(insight?.inflow3m).toBe(500000); // Single salary payment
      expect(insight?.outflow3m).toBe(78000); // Total expenses
      expect(insight?.net3m).toBe(422000); // 500000 - 78000

      // Verify spend breakdown
      const spendBreakdown = insight?.spendBreakdownJson as any[];
      expect(spendBreakdown).toBeDefined();
      expect(spendBreakdown.length).toBeGreaterThan(0);

      // Verify risk flags
      const riskFlags = insight?.riskFlagsJson as any;
      expect(riskFlags).toBeDefined();
      expect(typeof riskFlags.highSpending).toBe('boolean');
      expect(typeof riskFlags.negativeBalance).toBe('boolean');
    });

    it('should validate bureau report persistence', async () => {
      // Skip if main workflow didn't complete
      if (!bureauReportId) {
        console.log('Skipping bureau validation - bureauReportId not available');
        return;
      }

      const bureauReport = await prisma.bureauReport.findUnique({
        where: { id: bureauReportId }
      });

      expect(bureauReport).toBeDefined();
      expect(bureauReport?.bvn).toBe('12345678901');
      expect(bureauReport?.score).toBeGreaterThan(0);
      expect(bureauReport?.riskBand).toBeDefined();
      expect(bureauReport?.enquiries6m).toBeGreaterThanOrEqual(0);
      expect(bureauReport?.defaults).toBeGreaterThanOrEqual(0);
      expect(bureauReport?.openLoans).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid statement ID gracefully', async () => {
      // Skip if admin token not available
      if (!adminToken) {
        console.log('Skipping invalid statement test - adminToken not available');
        return;
      }

      const response = await request(app)
        .post('/insights/run')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ statementId: 'invalid-id' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBeDefined();
    });

    it('should handle invalid BVN format', async () => {
      // Skip if admin token not available
      if (!adminToken) {
        console.log('Skipping invalid BVN test - adminToken not available');
        return;
      }

      const response = await request(app)
        .post('/bureau/check')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ bvn: '123' }); // Too short

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('should enforce authentication on protected endpoints', async () => {
      const response = await request(app)
        .get('/audit/logs');

      expect(response.status).toBe(401);
    });

    it('should enforce role-based access control', async () => {
      // Skip if admin token not available
      if (!adminToken) {
        console.log('Skipping RBAC test - adminToken not available');
        return;
      }

      // Create a regular user
      const regularUserResponse = await request(app)
        .post('/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'user@test.com',
          password: 'password123',
          role: 'USER'
        });

      expect(regularUserResponse.status).toBe(201);

      // Login as regular user
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: 'user@test.com',
          password: 'password123'
        });

      const userToken = loginResponse.body.token;

      // Try to access admin-only endpoint
      const auditResponse = await request(app)
        .get('/audit/logs')
        .set('Authorization', `Bearer ${userToken}`);

      expect(auditResponse.status).toBe(403);
    });
  });
});


