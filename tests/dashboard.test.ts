import request from 'supertest';
import { PrismaClient, Role, RecordType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import app from '../src/app';

const prisma = new PrismaClient();

let adminToken: string;
let analystToken: string;
let viewerToken: string;

beforeAll(async () => {
  await prisma.$connect();

  // Clean previous runs
  await prisma.financialRecord.deleteMany({ where: { title: { startsWith: '[DASH-TEST]' } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: '@dash-test.com' } } });
  await prisma.category.deleteMany({ where: { name: { startsWith: 'DashTest' } } });

  const hash = await bcrypt.hash('password123', 12);

  const [admin, analyst, viewer] = await Promise.all([
    prisma.user.create({
      data: { name: 'Dash Admin', email: 'admin@dash-test.com', passwordHash: hash, role: Role.ADMIN },
    }),
    prisma.user.create({
      data: { name: 'Dash Analyst', email: 'analyst@dash-test.com', passwordHash: hash, role: Role.ANALYST },
    }),
    prisma.user.create({
      data: { name: 'Dash Viewer', email: 'viewer@dash-test.com', passwordHash: hash, role: Role.VIEWER },
    }),
  ]);

  // Seed categories
  const [incCat, expCat] = await Promise.all([
    prisma.category.create({ data: { name: 'DashTest Income', type: RecordType.INCOME } }),
    prisma.category.create({ data: { name: 'DashTest Expense', type: RecordType.EXPENSE } }),
  ]);

  // Seed records for meaningful dashboard data
  await prisma.financialRecord.createMany({
    data: [
      {
        title: '[DASH-TEST] Income Jan',
        amount: 10000,
        type: RecordType.INCOME,
        categoryId: incCat.id,
        createdById: analyst.id,
        date: new Date('2024-01-15'),
      },
      {
        title: '[DASH-TEST] Expense Jan',
        amount: 4000,
        type: RecordType.EXPENSE,
        categoryId: expCat.id,
        createdById: analyst.id,
        date: new Date('2024-01-20'),
      },
      {
        title: '[DASH-TEST] Income Feb',
        amount: 8000,
        type: RecordType.INCOME,
        categoryId: incCat.id,
        createdById: admin.id,
        date: new Date('2024-02-10'),
      },
    ],
  });

  // Obtain tokens
  const [adminRes, analystRes, viewerRes] = await Promise.all([
    request(app).post('/api/v1/auth/login').send({ email: admin.email, password: 'password123' }),
    request(app).post('/api/v1/auth/login').send({ email: analyst.email, password: 'password123' }),
    request(app).post('/api/v1/auth/login').send({ email: viewer.email, password: 'password123' }),
  ]);

  adminToken = adminRes.body.data.token;
  analystToken = analystRes.body.data.token;
  viewerToken = viewerRes.body.data.token;
});

afterAll(async () => {
  await prisma.financialRecord.deleteMany({ where: { title: { startsWith: '[DASH-TEST]' } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: '@dash-test.com' } } });
  await prisma.category.deleteMany({ where: { name: { startsWith: 'DashTest' } } });
  await prisma.$disconnect();
});

describe('GET /api/v1/dashboard/summary', () => {
  it('returns summary data for ADMIN', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { data } = res.body;
    expect(typeof data.totalIncome).toBe('string');
    expect(typeof data.totalExpenses).toBe('string');
    expect(typeof data.netBalance).toBe('string');
    expect(typeof data.recordCount).toBe('number');
    expect(data.recordCount).toBeGreaterThan(0);
  });

  it('returns summary data for ANALYST (own records only)', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${analystToken}`);

    expect(res.status).toBe(200);
    // Analyst created 2 records (income 10000, expense 4000)
    expect(parseFloat(res.body.data.totalIncome)).toBeGreaterThanOrEqual(10000);
    expect(parseFloat(res.body.data.totalExpenses)).toBeGreaterThanOrEqual(4000);
  });

  it('returns 403 for VIEWER', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/dashboard/summary');
    expect(res.status).toBe(401);
  });

  it('supports date range filter', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/summary?startDate=2024-01-01&endDate=2024-01-31')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });

  it('amounts are strings not numbers (precision guarantee)', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${adminToken}`);

    const { totalIncome, totalExpenses, netBalance } = res.body.data;
    // Must be strings so JavaScript Number precision loss doesn't occur
    expect(typeof totalIncome).toBe('string');
    expect(typeof totalExpenses).toBe('string');
    expect(typeof netBalance).toBe('string');
  });
});

describe('GET /api/v1/dashboard/trends', () => {
  it('returns monthly trends for ADMIN', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/trends')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('trend entries have month, income, expense fields', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/trends?startDate=2024-01-01&endDate=2024-12-31')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    if (res.body.data.length > 0) {
      const entry = res.body.data[0];
      expect(entry).toHaveProperty('month');
      expect(entry).toHaveProperty('income');
      expect(entry).toHaveProperty('expense');
    }
  });

  it('returns 403 for VIEWER', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/trends')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/dashboard/categories', () => {
  it('returns category breakdown for ADMIN', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/categories')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);

    if (res.body.data.length > 0) {
      const entry = res.body.data[0];
      expect(entry).toHaveProperty('categoryId');
      expect(entry).toHaveProperty('categoryName');
      expect(entry).toHaveProperty('type');
      expect(entry).toHaveProperty('total');
      expect(entry).toHaveProperty('count');
    }
  });

  it('supports type filter', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/categories?type=INCOME')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const allIncome = res.body.data.every((r: { type: string }) => r.type === 'INCOME');
    expect(allIncome).toBe(true);
  });

  it('returns 403 for VIEWER', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/categories')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/dashboard/recent', () => {
  it('returns recent records for ADMIN', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/recent')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('VIEWER can access recent activity', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/recent')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
  });

  it('respects the limit param', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/recent?limit=2')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/dashboard/recent');
    expect(res.status).toBe(401);
  });
});
