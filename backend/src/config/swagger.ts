import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Nexus Platform API',
      version: '1.0.0',
      description:
        'Investor & Entrepreneur Collaboration Platform - Auth, Profiles, Meetings, Video Signaling, Documents, and Payments.',
    },
    servers: [
      { url: 'http://localhost:5000/api', description: 'Local development' },
      { url: '/api', description: 'Current host (production)' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  // Scans these files for /** @swagger ... */ JSDoc blocks
  apis: ['./src/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
