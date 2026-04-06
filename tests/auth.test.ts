import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '../src/app';

const prisma = new PrismaClient();

beforeAll(async () => {
  await prisma.$connect();
  // Clean test users
  await prisma.user.deleteMany({ where: { email: { contains: '@test.com' } } });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: '@test.com' } } });
  await prisma.$disconnect();
});

describe('POST /api/v1/auth/register', () => {
  it('creates a new user and returns a token', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Test User',
      email: 'register@test.com',
      password: 'password123',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.role).toBe('VIEWER');
    expect(res.body.data.user.passwordHash).toBeUndefined(); // never expose hash
  });

  it('returns 409 for duplicate email', async () => {
    await request(app).post('/api/v1/auth/register').send({
      name: 'Dup User',
      email: 'dup@test.com',
      password: 'password123',
    });

    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Dup User',
      email: 'dup@test.com',
      password: 'password123',
    });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for missing fields', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'incomplete@test.com' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors).toBeDefined();
  });

  it('returns 400 for invalid email', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Bad Email',
      email: 'not-an-email',
      password: 'password123',
    });

    expect(res.status).toBe(400);
    expect(res.body.errors?.email).toBeDefined();
  });
});

describe('POST /api/v1/auth/login', () => {
  beforeAll(async () => {
    await request(app).post('/api/v1/auth/register').send({
      name: 'Login User',
      email: 'login@test.com',
      password: 'password123',
    });
  });

  it('returns a token for valid credentials', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'login@test.com',
      password: 'password123',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
  });

  it('returns 401 for wrong password', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'login@test.com',
      password: 'wrongpassword',
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 for non-existent email', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'nobody@test.com',
      password: 'password123',
    });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/auth/me', () => {
  let token: string;

  beforeAll(async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Me User',
      email: 'me@test.com',
      password: 'password123',
    });
    token = res.body.data.token;
  });

  it('returns the current user profile', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('me@test.com');
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 with an invalid token', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer invalidtoken');
    expect(res.status).toBe(401);
  });
});
