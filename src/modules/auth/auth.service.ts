import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma';
import { signToken } from '../../lib/jwt';
import { AppError } from '../../utils/AppError';
import { RegisterInput, LoginInput } from './auth.schema';

const SALT_ROUNDS = 12;

function sanitizeUser(user: { id: string; email: string; name: string; role: string; isActive: boolean; createdAt: Date }) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

export async function registerUser(input: RegisterInput) {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (existing) {
    throw new AppError('An account with this email already exists.', 409);
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
    },
  });

  const token = signToken({ sub: user.id, role: user.role });

  return { user: sanitizeUser(user), token };
}

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  // Use constant-time comparison to prevent timing attacks that could
  // reveal whether an email exists in the system
  const dummyHash = '$2a$12$invalidhashfortimingprotection000000000000000000000000';
  const passwordValid = user
    ? await bcrypt.compare(input.password, user.passwordHash)
    : await bcrypt.compare(input.password, dummyHash);

  if (!user || !passwordValid) {
    throw new AppError('Invalid email or password.', 401);
  }

  if (!user.isActive) {
    throw new AppError('Your account has been deactivated. Contact an administrator.', 401);
  }

  if (user.deletedAt !== null) {
    throw new AppError('This account no longer exists.', 401);
  }

  const token = signToken({ sub: user.id, role: user.role });

  return { user: sanitizeUser(user), token };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new AppError('User not found.', 404);
  }

  return user;
}
