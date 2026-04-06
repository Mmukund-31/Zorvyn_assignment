import path from 'path';
import swaggerJsdoc from 'swagger-jsdoc';
import { config } from './index';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Finance Backend API',
      version: '1.0.0',
      description:
        'Finance Data Processing and Access Control Backend. Provides role-based management of financial records and dashboard analytics.',
      contact: {
        name: 'Finance API',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.port}/api/v1`,
        description: 'Local development server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from POST /auth/login',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
            errors: { type: 'object', nullable: true },
          },
        },
        PaginationMeta: {
          type: 'object',
          properties: {
            page: { type: 'integer', example: 1 },
            limit: { type: 'integer', example: 20 },
            total: { type: 'integer', example: 100 },
            totalPages: { type: 'integer', example: 5 },
          },
        },
      },
    },
    security: [{ BearerAuth: [] }],
  },
  // Absolute path so swagger-jsdoc resolves correctly regardless of process.cwd()
  // __dirname here is src/config/, so we go up one level to reach src/modules/
  apis: [path.join(__dirname, '../modules/**/*.routes.ts')],
};

export const swaggerSpec = swaggerJsdoc(options);
