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

  // Helper function to create admin user and get token
  const createAdminUser = async () => {
    const passwordHash = await bcrypt.hash('password123', 12);
    const adminUser = await prisma.user.create({
      data: {
        email: 'admin@test.com',
        passwordHash,
        role: 'ADMIN'
      }
    });

    const loginResponse = await request(app)
      .post('/auth/login')
      .send({
        email: 'admin@test.com',
        password: 'password123'
      });

    return {
      user: adminUser,
      token: loginResponse.body.token
    };
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
      // Step 1: Create admin user and get token
      const { user: adminUser, token } = await createAdminUser();
      
      expect(adminUser).toBeDefined();
      expect(adminUser.role).toBe('ADMIN');
      expect(token).toBeDefined();

      adminToken = token;
      userId = adminUser.id;

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

      expect(uploadResponse.status).toBe(201);
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

      const getBureauResponse = await request(app)
        .get(`/bureau/report/12345678901`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getBureauResponse.status).toBe(200);
      expect(getBureauResponse.body.report).toBeDefined();
      expect(getBureauResponse.body.report.id).toBe(bureauReportId);

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
      // Create admin user and upload statement for this test
      const { token } = await createAdminUser();
      
      const csvContent = `date,description,amount,balance
2024-01-01,Salary Payment - ABC Corp,500000,500000
2024-01-02,Grocery Store - Walmart,-25000,475000
2024-01-03,Uber Ride - Transport,-1500,473500
2024-01-04,Amazon Shopping - Electronics,-45000,428500
2024-01-05,Restaurant - Fine Dining,-8000,420500`;

      const uploadResponse = await request(app)
        .post('/statements/upload')
        .set('Authorization', `Bearer ${token}`)
        .field('sourceLabel', 'Test Statement')
        .attach('csv', Buffer.from(csvContent), 'test-statement.csv');

      expect(uploadResponse.status).toBe(201);
      const statementId = uploadResponse.body.statement.id;

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

      const expenses = transactions.filter(t => t.amount < 0);
      expect(expenses).toHaveLength(4);
      expect(expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0)).toBe(78000);
    });

    it('should validate insights computation accuracy', async () => {
      const { token } = await createAdminUser();
      
      const csvContent = `date,description,amount,balance
2024-01-01,Salary Payment - ABC Corp,500000,500000
2024-01-02,Grocery Store - Walmart,-25000,475000`;

      const uploadResponse = await request(app)
        .post('/statements/upload')
        .set('Authorization', `Bearer ${token}`)
        .field('sourceLabel', 'Test Statement')
        .attach('csv', Buffer.from(csvContent), 'test-statement.csv');

      const statementId = uploadResponse.body.statement.id;

      const insightsResponse = await request(app)
        .post('/insights/run')
        .set('Authorization', `Bearer ${token}`)
        .send({ statementId });

      expect(insightsResponse.status).toBe(200);
      const insight = insightsResponse.body.insight;

      expect(insight).toBeDefined();
      expect(insight?.monthlyIncomeAvg).toBe(500000); 
      expect(insight?.inflow3m).toBe(500000); 
      expect(insight?.outflow3m).toBe(25000); 
      expect(insight?.net3m).toBe(475000); 

      // Verify spend breakdown
      const spendBreakdown = insight?.spendBreakdown;
      expect(spendBreakdown).toBeDefined();
      expect(typeof spendBreakdown).toBe('object');

      const riskFlags = insight?.riskFlags;
      expect(riskFlags).toBeDefined();
      expect(typeof riskFlags.highSpending).toBe('boolean');
      expect(typeof riskFlags.negativeBalance).toBe('boolean');
    });

    it('should validate bureau report persistence', async () => {
      const { token } = await createAdminUser();
      
      const bureauResponse = await request(app)
        .post('/bureau/check')
        .set('Authorization', `Bearer ${token}`)
        .send({ bvn: '12345678901' });

      expect(bureauResponse.status).toBe(200);
      const bureauReport = bureauResponse.body.report;

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
      // Create admin user if not available
      let token = adminToken;
      if (!token) {
        const { token: newToken } = await createAdminUser();
        token = newToken;
      }

      const response = await request(app)
        .post('/insights/run')
        .set('Authorization', `Bearer ${token}`)
        .send({ statementId: 'invalid-id' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
    });

    it('should handle invalid BVN format', async () => {
      // Create admin user if not available
      let token = adminToken;
      if (!token) {
        const { token: newToken } = await createAdminUser();
        token = newToken;
      }

      const response = await request(app)
        .post('/bureau/check')
        .set('Authorization', `Bearer ${token}`)
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
      // Create admin user if not available
      let token = adminToken;
      if (!token) {
        const { token: newToken } = await createAdminUser();
        token = newToken;
      }

      // Create a regular user
      const regularUserResponse = await request(app)
        .post('/auth/register')
        .set('Authorization', `Bearer ${token}`)
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


