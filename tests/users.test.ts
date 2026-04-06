import request from 'supertest';
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import app from '../src/app';

const prisma = new PrismaClient();

let adminToken: string;
let analystToken: string;
let viewerToken: string;
let targetUserId: string;
let adminUserId: string;

beforeAll(async () => {
  await prisma.$connect();

  // Clean previous runs
  await prisma.user.deleteMany({ where: { email: { endsWith: '@users-test.com' } } });

  const hash = await bcrypt.hash('password123', 12);

  const [admin, analyst, viewer, target] = await Promise.all([
    prisma.user.create({
      data: { name: 'Users Admin', email: 'admin@users-test.com', passwordHash: hash, role: Role.ADMIN },
    }),
    prisma.user.create({
      data: { name: 'Users Analyst', email: 'analyst@users-test.com', passwordHash: hash, role: Role.ANALYST },
    }),
    prisma.user.create({
      data: { name: 'Users Viewer', email: 'viewer@users-test.com', passwordHash: hash, role: Role.VIEWER },
    }),
    prisma.user.create({
      data: { name: 'Target User', email: 'target@users-test.com', passwordHash: hash, role: Role.VIEWER },
    }),
  ]);

  adminUserId = admin.id;
  targetUserId = target.id;

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
  await prisma.user.deleteMany({ where: { email: { endsWith: '@users-test.com' } } });
  await prisma.$disconnect();
});

describe('GET /api/v1/users', () => {
  it('ADMIN can list users', async () => {
    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeDefined();
    expect(typeof res.body.pagination.total).toBe('number');
  });

  it('response does not expose passwordHash', async () => {
    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`);

    const users: Array<Record<string, unknown>> = res.body.data;
    expect(users.every((u) => u.passwordHash === undefined)).toBe(true);
  });

  it('ANALYST cannot list users (403)', async () => {
    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${analystToken}`);

    expect(res.status).toBe(403);
  });

  it('VIEWER cannot list users (403)', async () => {
    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(403);
  });

  it('supports role filter', async () => {
    const res = await request(app)
      .get('/api/v1/users?role=VIEWER')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const users: Array<{ role: string }> = res.body.data;
    expect(users.every((u) => u.role === 'VIEWER')).toBe(true);
  });

  it('supports pagination', async () => {
    const res = await request(app)
      .get('/api/v1/users?page=1&limit=2')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
    expect(res.body.pagination.limit).toBe(2);
  });
});

describe('GET /api/v1/users/:id', () => {
  it('ADMIN can get a user by ID', async () => {
    const res = await request(app)
      .get(`/api/v1/users/${targetUserId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(targetUserId);
  });

  it('returns 404 for non-existent user', async () => {
    const res = await request(app)
      .get('/api/v1/users/nonexistent-id-xyz')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it('non-admin gets 403', async () => {
    const res = await request(app)
      .get(`/api/v1/users/${targetUserId}`)
      .set('Authorization', `Bearer ${analystToken}`);

    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/v1/users/:id/role', () => {
  it('ADMIN can change a user role', async () => {
    const res = await request(app)
      .patch(`/api/v1/users/${targetUserId}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'ANALYST' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('ANALYST');
  });

  it('ADMIN cannot change their own role', async () => {
    const res = await request(app)
      .patch(`/api/v1/users/${adminUserId}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'VIEWER' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for invalid role value', async () => {
    const res = await request(app)
      .patch(`/api/v1/users/${targetUserId}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'SUPERUSER' });

    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/v1/users/:id/status', () => {
  it('ADMIN can deactivate a user', async () => {
    const res = await request(app)
      .patch(`/api/v1/users/${targetUserId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.data.user.isActive).toBe(false);
  });

  it('deactivated user cannot log in', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'target@users-test.com', password: 'password123' });

    expect(loginRes.status).toBe(401);
    expect(loginRes.body.message).toMatch(/deactivated/i);
  });

  it('ADMIN can reactivate a user', async () => {
    const res = await request(app)
      .patch(`/api/v1/users/${targetUserId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: true });

    expect(res.status).toBe(200);
    expect(res.body.data.user.isActive).toBe(true);
  });

  it('ADMIN cannot change their own status', async () => {
    const res = await request(app)
      .patch(`/api/v1/users/${adminUserId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });

    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/v1/users/:id', () => {
  it('ADMIN can soft-delete a user', async () => {
    const res = await request(app)
      .delete(`/api/v1/users/${targetUserId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('deleted user is no longer findable', async () => {
    const res = await request(app)
      .get(`/api/v1/users/${targetUserId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it('deleted user cannot log in', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'target@users-test.com', password: 'password123' });

    expect(res.status).toBe(401);
  });

  it('ADMIN cannot delete their own account', async () => {
    const res = await request(app)
      .delete(`/api/v1/users/${adminUserId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
  });

  it('non-admin gets 403', async () => {
    const res = await request(app)
      .delete(`/api/v1/users/${targetUserId}`)
      .set('Authorization', `Bearer ${analystToken}`);

    expect(res.status).toBe(403);
  });
});
