import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { config } from './config';
import { swaggerSpec } from './config/swagger';
import { errorHandler } from './middleware/errorHandler';
import { AppError } from './utils/AppError';
import { generalLimiter } from './lib/rateLimiters';

import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';
import recordsRoutes from './modules/records/records.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import categoriesRoutes from './modules/categories/categories.routes';

const app = express();

// --- Security & utility middleware ---
app.use(helmet());
app.use(
  cors({
    origin: config.cors.origin,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json());
app.use(morgan(config.isDev ? 'dev' : 'combined'));

// --- API Documentation ---
app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api/v1/docs.json', (_req, res) => {
  res.json(swaggerSpec);
});

// --- Health check (no auth required) ---
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- API Routes ---
app.use('/api/v1', generalLimiter);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/records', recordsRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/categories', categoriesRoutes);

// --- 404 handler (must come after all routes) ---
app.use((_req, _res, next) => {
  next(new AppError('The requested resource was not found.', 404));
});

// --- Global error handler (must be last) ---
app.use(errorHandler);

export default app;
