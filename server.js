const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./config/swagger');
const csrfMiddleware = require('./middleware/csrf');
require('dotenv').config();

const oauthRoutes = require('./routes/oauth');
const adminRoutes = require('./routes/admin');
const tenantRoutes = require('./routes/tenant');
const { apiLoggerMiddleware } = require('./middleware/apiLogger');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https:", "data:"],
    },
  },
}));

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - Host: ${req.headers.host} - Origin: ${req.headers.origin}`);
  next();
});

// Demo detection middleware
const demoDetection = require('./middleware/demoDetection');
app.use(demoDetection);

// CORS configuration - Temporary wildcard for debugging
app.use(cors({
  origin: '*',
  credentials: false, // Must be false when origin is *
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-CSRF-Token']
}));

// Manual CORS headers as backup
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, X-CSRF-Token');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Rate limiting
const globalLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: { error: 'Too many requests from this IP' }
});

app.use(globalLimit);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parsing middleware (required for CSRF)
app.use(csrfMiddleware.cookieParser);

// Database mode detection middleware
app.use((req, res, next) => {
  const origin = req.get('origin') || req.get('referer') || '';
  
  // Check if request comes from demo domain
  if (origin.includes('oauth2.demo.brockai.com')) {
    process.env.DB_MODE = 'demo';
  } else {
    process.env.DB_MODE = 'main';
  }
  
  next();
});

// API logging middleware (should be after body parsing)
app.use(apiLoggerMiddleware);

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
  explorer: true,
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .auth-wrapper { 
      margin-bottom: 20px; 
      background-color: #f8f9fa;
      padding: 15px;
      border-radius: 5px;
      border: 1px solid #dee2e6;
    }
    .swagger-ui .authorization__btn { 
      color: white !important;
      font-weight: bold !important;
      font-size: 14px !important;
      padding: 8px 15px !important;
      border-radius: 4px !important;
      cursor: pointer !important;
    }
    .swagger-ui .authorization__btn.locked { 
      background-color: #dc3545 !important; 
      border-color: #dc3545 !important;
    }
    .swagger-ui .authorization__btn.unlocked { 
      background-color: #28a745 !important; 
      border-color: #28a745 !important;
    }
    .swagger-ui .auth-wrapper h4 {
      color: #495057 !important;
      margin-bottom: 10px !important;
      font-size: 16px !important;
    }
    .swagger-ui .operation-filter-input { margin-bottom: 20px; }
    .swagger-ui .scheme-container { 
      background-color: white;
      padding: 10px;
      margin-bottom: 10px;
      border-radius: 4px;
      border: 1px solid #dee2e6;
    }
  `,
  customSiteTitle: 'OAuth 2.0 Server API Documentation',
  swaggerOptions: {
    persistAuthorization: true,
    displayOperationId: false,
    filter: true,
    showExtensions: false,
    showCommonExtensions: false,
    defaultModelsExpandDepth: -1,
    defaultModelExpandDepth: 1,
    docExpansion: 'list',
    supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
    tryItOutEnabled: true,
    displayRequestDuration: true,
    showMutatedRequest: false,
    preauthorizeBasic: false,
    preauthorizeApiKey: false
  }
}));

// Health check endpoint
/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 version:
 *                   type: string
 *                   example: 1.0.0
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// OAuth 2.0 endpoints
app.use('/oauth', oauthRoutes);

// Admin endpoints (system admin access)
app.use('/admin', adminRoutes);

// Tenant endpoints (tenant-scoped access)
app.use('/tenant', tenantRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  
  // Don't expose internal errors in production
  if (process.env.NODE_ENV === 'production') {
    res.status(500).json({ error: 'Internal server error' });
  } else {
    res.status(500).json({ 
      error: 'Internal server error',
      details: err.message,
      stack: err.stack
    });
  }
});

// Graceful shutdown handler
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`OAuth 2.0 Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});