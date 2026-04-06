import request from 'supertest';
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import app from '../src/app';

const prisma = new PrismaClient();

let adminToken: string;
let analystToken: string;
let viewerToken: string;
let categoryId: string;
let recordId: string;

beforeAll(async () => {
  await prisma.$connect();

  // Clean up from previous test runs
  await prisma.financialRecord.deleteMany({ where: { title: { startsWith: '[TEST]' } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: '@records-test.com' } } });
  await prisma.category.deleteMany({ where: { name: 'Test Category' } });

  const hash = await bcrypt.hash('password123', 12);

  const [admin, analyst, viewer] = await Promise.all([
    prisma.user.create({
      data: { name: 'Test Admin', email: 'admin@records-test.com', passwordHash: hash, role: Role.ADMIN },
    }),
    prisma.user.create({
      data: { name: 'Test Analyst', email: 'analyst@records-test.com', passwordHash: hash, role: Role.ANALYST },
    }),
    prisma.user.create({
      data: { name: 'Test Viewer', email: 'viewer@records-test.com', passwordHash: hash, role: Role.VIEWER },
    }),
  ]);

  const category = await prisma.category.create({
    data: { name: 'Test Category', type: 'EXPENSE' },
  });
  categoryId = category.id;

  // Get tokens
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
  await prisma.financialRecord.deleteMany({ where: { title: { startsWith: '[TEST]' } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: '@records-test.com' } } });
  await prisma.category.deleteMany({ where: { name: 'Test Category' } });
  await prisma.$disconnect();
});

describe('POST /api/v1/records — create', () => {
  it('allows ANALYST to create a record', async () => {
    const res = await request(app)
      .post('/api/v1/records')
      .set('Authorization', `Bearer ${analystToken}`)
      .send({
        title: '[TEST] Office supplies',
        amount: 150.5,
        type: 'EXPENSE',
        categoryId,
        date: '2024-03-15',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.record.amount).toBe('150.5000'); // string, not number
    recordId = res.body.data.record.id;
  });

  it('allows ADMIN to create a record', async () => {
    const res = await request(app)
      .post('/api/v1/records')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: '[TEST] Admin record',
        amount: 1000,
        type: 'EXPENSE',
        categoryId,
        date: '2024-03-20',
      });

    expect(res.status).toBe(201);
  });

  it('returns 403 for VIEWER role', async () => {
    const res = await request(app)
      .post('/api/v1/records')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        title: '[TEST] Viewer record',
        amount: 50,
        type: 'EXPENSE',
        categoryId,
        date: '2024-03-15',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for negative amount', async () => {
    const res = await request(app)
      .post('/api/v1/records')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: '[TEST] Bad amount',
        amount: -100,
        type: 'EXPENSE',
        categoryId,
        date: '2024-03-15',
      });

    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid type', async () => {
    const res = await request(app)
      .post('/api/v1/records')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: '[TEST] Bad type',
        amount: 100,
        type: 'INVALID',
        categoryId,
        date: '2024-03-15',
      });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/records — list', () => {
  it('returns records for ADMIN', async () => {
    const res = await request(app)
      .get('/api/v1/records')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.pagination).toBeDefined();
  });

  it('returns only own records for ANALYST', async () => {
    const res = await request(app)
      .get('/api/v1/records')
      .set('Authorization', `Bearer ${analystToken}`);

    expect(res.status).toBe(200);
    // All returned records should belong to the analyst
    const createdByIds = res.body.data.map((r: { createdBy: { email: string } }) => r.createdBy.email);
    expect(createdByIds.every((email: string) => email === 'analyst@records-test.com')).toBe(true);
  });

  it('supports pagination', async () => {
    const res = await request(app)
      .get('/api/v1/records?page=1&limit=1')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(1);
    expect(res.body.pagination.limit).toBe(1);
  });

  it('supports type filter', async () => {
    const res = await request(app)
      .get('/api/v1/records?type=EXPENSE')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.every((r: { type: string }) => r.type === 'EXPENSE')).toBe(true);
  });

  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/v1/records');
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/v1/records/:id', () => {
  it('allows ADMIN to soft-delete a record', async () => {
    const res = await request(app)
      .delete(`/api/v1/records/${recordId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });

  it('hides soft-deleted record from list', async () => {
    const res = await request(app)
      .get('/api/v1/records')
      .set('Authorization', `Bearer ${adminToken}`);

    const ids = res.body.data.map((r: { id: string }) => r.id);
    expect(ids).not.toContain(recordId);
  });

  it('returns 403 for ANALYST trying to delete', async () => {
    // Create a record first
    const createRes = await request(app)
      .post('/api/v1/records')
      .set('Authorization', `Bearer ${analystToken}`)
      .send({
        title: '[TEST] To delete by analyst',
        amount: 10,
        type: 'EXPENSE',
        categoryId,
        date: '2024-03-15',
      });

    const id = createRes.body.data.record.id;

    const deleteRes = await request(app)
      .delete(`/api/v1/records/${id}`)
      .set('Authorization', `Bearer ${analystToken}`);

    expect(deleteRes.status).toBe(403);
  });
});
