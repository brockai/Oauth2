# OAuth 2.0 Server

<a href="https://oauth2.demo.fuelbadger.brockai.com/" target="_blank"><img src="https://img.shields.io/badge/OAuth_2_Console-Live_Demo-blue?style=for-the-badge&logo=react" alt="OAuth 2 Console"></a>
<a href="https://oauth2.api.fuelbadger.brockai.com/api-docs/" target="_blank"><img src="https://img.shields.io/badge/OAuth_2_API-Documentation-green?style=for-the-badge&logo=swagger" alt="OAuth 2 API"></a>

A complete OAuth 2.0 authorization server with multi-client support, tenant management, API key system, comprehensive logging, and admin management interface built with Node.js, Express, PostgreSQL, React, and Next.js.

## 🚀 Features

### **OAuth 2.0 Core**
- **Authorization Code Flow**
  - Authorization endpoint (`/oauth/authorize`)
  - Token endpoint (`/oauth/token`)
  - Refresh token support (`/oauth/token/refresh`)
  - Token introspection endpoint (`/oauth/introspect`) - RFC 7662 compliant
- **JWT-based access tokens**
- **Secure token storage and validation**

### **Multi-Client Management** 
- **CRUD operations** for OAuth clients
- **Client credentials management** (ID/Secret generation)
- **Redirect URI validation**
- **Client statistics and monitoring**
- **Application-tenant associations**

### **Multi-Tenant Architecture**
- **Tenant isolation** and management
- **Per-tenant user management**
- **Tenant-specific applications**
- **User role management** (admin/standard users)
- **Tenant statistics and analytics**

### **API Key Management System**
- **Database-driven API key storage** with secure hashing
- **Dynamic key generation** and management
- **Key validation and authentication**
- **Copy-to-clipboard functionality**
- **Usage tracking and monitoring**

### **Comprehensive Logging System**
- **Real-time API request/response logging**
- **Performance metrics** (response times, success rates)
- **Advanced filtering** (status codes, methods, endpoints, time periods)
- **Statistics dashboard** with visual indicators
- **Detailed log inspection** with modal views
- **Pagination and search capabilities**

### **Admin Management Interface**
- **Secure admin authentication**
- **Profile management** (username/password updates)
- **Bearer token generation** for Swagger API testing
- **Role-based access control**
- **Real-time dashboard** with key metrics
- **Dark/light theme support**

### **Security Features**
- **Rate limiting** on sensitive endpoints
- **Helmet security headers**
- **CORS protection** with configurable origins
- **Secure password hashing** with bcrypt
- **API key authentication**
- **Request validation and sanitization**
- **Comprehensive audit logging**

## Prerequisites

- Node.js 18+ 
- PostgreSQL 12+
- npm or yarn

## Installation

1. **Clone and setup the project:**
   ```bash
   cd Oauth2
   npm install
   cd client && npm install && cd ..
   ```

2. **Set up PostgreSQL database:**
   ```sql
   CREATE DATABASE oauth2_db;
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your database connection and secrets:
   
   **For Development (uses remote database):**
   ```
   DATABASE_URL=remote database uri and port
   JWT_SECRET=your-super-secret-jwt-key-here
   PORT=3000
   NODE_ENV=development
   # DB_MODE=demo  # Set to 'demo' to connect to demo database, leave unset for main database
   ```
   
   **For Production (create `.env.production`):**
   ```
   DATABASE_URL=remote database uri and port
   JWT_SECRET=your-super-secret-jwt-key-here
   PORT=3000
   NODE_ENV=production
   DB_MODE=main
   ```

4. **Run database migrations:**
   ```bash
   npm run migrate
   ```

## 🌐 Dual Environment Setup

This application supports dual environment deployment with both production and demo instances:

### **Environment Overview**

- **Production Environment**: Connects to the main database (`DB_MODE=main`)
  - Used for live application data and real user management
  - Available at: https://oauth2.console.fuelbadger.brockai.com

- **Demo Environment**: Connects to the demo database (`DB_MODE=demo`)  
  - Used for demonstrations, testing, and sandbox operations
  - Available at: https://oauth2.demo.fuelbadger.brockai.com
  - **Demo Admin Login:** demo / demo123 (automatically created during deployment)

### **Database Switching**

The application automatically switches databases based on the `DB_MODE` environment variable:

- **`DB_MODE=main`** (or unset): Connects to production database
- **`DB_MODE=demo`**: Connects to demo database with same schema but isolated data

### **Deployment Architecture**

Both environments share the same API server but maintain separate:
- Database connections (production vs demo databases)
- Client applications (separate Next.js instances)
- PM2 processes for isolation
- Environment configurations

### **Demo Database Synchronization**

The demo database automatically syncs its schema with the production database:
```bash
npm run sync-demo  # Recreates demo database with current schema
```

This ensures the demo environment always has the latest database structure while maintaining separate test data.

### **Demo Admin Account**

The demo environment automatically creates a demo admin account during deployment:
- **Username:** demo
- **Password:** demo123
- **Purpose:** Provides immediate access to demo the admin interface features
- **Auto-created:** Generated during every deployment to ensure availability

## Usage

### Start the servers

**Development mode (connects to remote database):**
```bash
# Terminal 1 - Start OAuth server
npm run dev

# Terminal 2 - Start Next.js client
npm run client
```

**Production mode:**
```bash
# Use production environment file
NODE_ENV=production npm start

# Build and start Next.js client
cd client && npm run build && npm start
```

### Access the application

**Development:**
- **OAuth Server:** http://localhost:3000
- **Admin Interface:** http://localhost:3001
- **Admin Login:** admin / admin123 (changeable via Profile page)
- **API Documentation:** http://localhost:3000/api-docs (Swagger UI)

**Production (Dual Environment Setup):**
- **Production Console:** https://oauth2.console.fuelbadger.brockai.com
  - **Admin Login:** admin / admin123 (changeable via Profile page)
- **Demo Console:** https://oauth2.demo.fuelbadger.brockai.com  
  - **Demo Admin Login:** demo / demo123 (for testing and demonstrations)
- **OAuth API Server:** https://oauth2.api.fuelbadger.brockai.com
- **API Documentation:** https://oauth2.api.fuelbadger.brockai.com/api-docs

### Admin Interface Navigation

The admin interface provides several management sections:

- **Dashboard** - Overview with statistics and quick actions
- **Applications** - OAuth client management 
- **Tenants** - Multi-tenant organization management
- **Users** - Per-tenant user management
- **API Keys** - Generate Bearer tokens for Swagger testing and manage database-stored API keys
- **Logs** - Comprehensive API request/response logging
- **Profile** - Update admin username and password

### Admin Token Authentication

For mobile apps and direct API access, use the simplified admin token endpoint:

```bash
curl -X POST http://localhost:3000/admin/token \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json"
```

This returns a JWT admin token:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 86400,
  "token_type": "Bearer"
}
```

Use this token for all subsequent API requests in the `Authorization: Bearer <token>` header.

### Token Introspection

To validate and inspect tokens, use the OAuth 2.0 compliant introspection endpoint:

```bash
curl -X POST http://localhost:3000/oauth/introspect \
  -H "Content-Type: application/json" \
  -d '{"token": "YOUR_TOKEN_HERE"}'
```

**Response for active admin token:**
```json
{
  "active": true,
  "scope": "admin",
  "username": "lori",
  "token_type": "Bearer",
  "exp": 1758220035,
  "iat": 1758133635,
  "nbf": 1758133635,
  "sub": "c35e9e83-f438-45cb-b082-b88b6806a51d",
  "aud": "oauth2-server",
  "iss": "oauth2-server",
  "user_type": "admin",
  "user_id": "c35e9e83-f438-45cb-b082-b88b6806a51d",
  "is_admin": true
}
```

**Response for invalid token:**
```json
{
  "active": false
}
```

The introspection endpoint follows RFC 7662 and supports both:
- **Admin/Tenant tokens** from `/admin/token` (validated via JWT signature)
- **OAuth access tokens** from `/oauth/token` (validated via database lookup)

## 🔐 Swagger API Testing & Authentication

### **Using Swagger UI for API Testing**

The OAuth2 server provides a comprehensive Swagger UI interface for testing all API endpoints:

**Swagger UI:** http://localhost:3000/api-docs/

### **Authentication Methods**

The API uses two different authentication methods:

#### **1. Bearer Token Authentication (Most Endpoints)**
Used for admin endpoints like `/admin/clients`, `/admin/tenants`, `/admin/logs`, etc.

**Easy Method - Via Admin Interface:**
1. Go to **http://localhost:3001/api-keys**
2. Click **"Get Bearer Token"** in the top section
3. Click **"Copy Token"** 
4. Click **"Open Swagger"** or go to Swagger UI
5. Click the **🔓 "Authorize"** button
6. Paste the JWT token (no "Bearer " prefix needed)
7. Click **"Authorize"** then **"Close"**
8. Test any protected endpoint!

**Manual Method - Via Login:**
1. Use `POST /admin/login` with `admin`/`admin123`
2. Copy the `token` from the response
3. Use it in Swagger's "Authorize" dialog

#### **2. API Key Authentication (Specific Endpoints)**
Used for endpoints like `POST /admin/token` that require the `x-api-key` header.

**To use API Key endpoints:**
1. Generate an API key from **http://localhost:3001/api-keys**
2. In Swagger, add `x-api-key` header manually when testing these endpoints

### **Token Types Explained**

- **🔐 JWT Bearer Tokens**: Session-based authentication for most admin endpoints
  - Generated by login or retrieved via admin interface
  - Format: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
  - Use in: Swagger's "Authorize" dialog

- **🔑 Database API Keys**: Dynamic keys for specific operations  
  - Generated and stored securely in the database
  - Format: Long alphanumeric strings
  - Use in: `x-api-key` header

## 📚 API Endpoints

### OAuth 2.0 Endpoints

- `GET /oauth/authorize` - Authorization endpoint
- `POST /oauth/token` - Token endpoint
- `POST /oauth/token/refresh` - Refresh token endpoint
- `POST /oauth/introspect` - Token introspection endpoint (RFC 7662)

### Admin Authentication

- `POST /admin/login` - Admin authentication
- `POST /admin/token` - Generate admin token (API key protected)
- `GET /admin/me` - Get current admin user
- `PUT /admin/profile` - Update admin profile (username/password)

### Client Management

- `GET /admin/clients` - List all clients
- `POST /admin/clients` - Create new client
- `GET /admin/clients/:id` - Get client details
- `PUT /admin/clients/:id` - Update client
- `DELETE /admin/clients/:id` - Delete client
- `POST /admin/clients/:id/regenerate-secret` - Regenerate client secret
- `GET /admin/clients/:id/stats` - Get client statistics
- `POST /admin/clients/:id/tenants` - Associate client with tenants
- `DELETE /admin/clients/:id/tenants` - Remove client from tenants

### Tenant Management

- `GET /admin/tenants` - List all tenants
- `POST /admin/tenants` - Create new tenant
- `GET /admin/tenants/:id` - Get tenant details
- `PUT /admin/tenants/:id` - Update tenant
- `DELETE /admin/tenants/:id` - Delete tenant
- `GET /admin/tenants/:id/stats` - Get tenant statistics

### Tenant User Management

- `GET /admin/tenants/:tenant_id/users` - List tenant users
- `POST /admin/tenants/:tenant_id/users` - Create tenant user
- `GET /admin/tenants/:tenant_id/users/:user_id` - Get tenant user
- `PUT /admin/tenants/:tenant_id/users/:user_id` - Update tenant user
- `DELETE /admin/tenants/:tenant_id/users/:user_id` - Delete tenant user
- `POST /admin/tenants/:tenant_id/users/:user_id/reset-password` - Reset user password

### API Key Management

- `GET /admin/api-keys` - List API keys
- `POST /admin/api-keys/generate` - Generate new API key
- `DELETE /admin/api-keys/:id` - Delete API key
- `PATCH /admin/api-keys/:id/toggle` - Toggle API key active status

### Logging & Monitoring

- `GET /admin/logs` - Get API logs (with filtering and pagination)
- `GET /admin/logs/stats` - Get API log statistics
- `GET /admin/logs/:id` - Get specific log entry

### Health Check

- `GET /health` - Server health status

## 🗄️ Database Schema

The application uses the following PostgreSQL tables:

### **Core OAuth Tables**
- `users` - Admin users with authentication
- `oauth_clients` - OAuth client applications  
- `authorization_codes` - Temporary authorization codes
- `access_tokens` - Access tokens with expiration
- `refresh_tokens` - Refresh tokens for token renewal

### **Multi-Tenant Architecture**
- `tenants` - Tenant organizations
- `tenant_users` - Users within specific tenants
- `client_tenants` - Many-to-many relationship between clients and tenants

### **Logging & Monitoring**
- `api_logs` - Comprehensive API request/response logging
  - Request/response data, performance metrics
  - IP addresses, user agents, API key tracking
  - Success/failure status and error messages

### **API Key Management**
- `api_keys` - Database-stored API keys with secure hashing
  - Key names, types, creation/usage timestamps
  - Secure bcrypt hashing for key validation
  - Active status tracking and management

## 🔒 Security Considerations

### **Production Deployment**
- **Change default admin credentials** immediately after setup
- **Use strong JWT secrets** (minimum 32 characters, randomly generated)
- **Enable HTTPS** in production with proper SSL certificates
- **Configure proper CORS origins** - avoid using `*` in production
- **Set secure environment variables** with proper file permissions (600)

### **API Security**
- **API key rotation** - regenerate keys periodically
- **Monitor API usage** through the comprehensive logging system
- **Review rate limiting settings** for your traffic patterns
- **Validate all redirect URIs** for OAuth clients
- **Use secure password policies** (minimum 6 characters, consider complexity requirements)

### **Database Security**
- **Use connection pooling** with proper limits
- **SSL connections** are enabled for remote database connections in production
- **Regular database backups** with encryption
- **Monitor database performance** and query logs

### **Monitoring & Auditing**
- **Review API logs regularly** for suspicious activity
- **Monitor failed authentication attempts**
- **Set up alerts** for unusual traffic patterns
- **Regular security audits** of the codebase and dependencies
- **Keep dependencies updated** (run `npm audit` regularly)

## 🔧 Development & Troubleshooting

### **Common Issues**

**Port conflicts:**
```bash
# Kill processes on ports 3000/3001
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
```

**Database connection issues:**
```bash
# Check PostgreSQL service
brew services list | grep postgresql
brew services start postgresql

# Verify database exists
psql -U postgres -c "SELECT datname FROM pg_database WHERE datname='oauth2_db';"
```

**Environment variables not loading:**
```bash
# Ensure .env file exists and has correct permissions
ls -la .env
chmod 600 .env
```

### **Development Commands**

```bash
# Development mode (both servers)
npm run dev          # OAuth server (port 3000)
npm run client       # Next.js client (port 3001)

# Production build
npm run build        # Build OAuth server
cd client && npm run build  # Build Next.js client

# Database operations
npm run migrate      # Run migrations
npm run sync-demo    # Sync demo database with production schema
npm run create-demo-admin  # Create demo admin user (demo/demo123)

# Testing and linting
npm test             # Run tests (if available)
npm run lint         # Run linting (if available)

# Environment testing
DB_MODE=demo npm run dev     # Test with demo database
DB_MODE=main npm run dev     # Test with production database (default)
```

### **Deployment Configuration**

The application uses GitHub Actions for automated deployment to both environments. Required secrets:

**Production Database:**
- `DATABASE_URL` - Production database connection string
- `JWT_SECRET` - Production JWT secret key

**Demo Database:**  
- `DATABASE_DEMO_URL` - Demo database connection string
- `DB_DEMO_NAME` - Demo database name
- `DB_DEMO_USER` - Demo database username  
- `DB_DEMO_PASSWORD` - Demo database password
- `JWT_DEMO_SECRET` - Demo JWT secret key

**Shared Configuration:**
- `SSH_HOST`, `SSH_USERNAME`, `SSH_PRIVATE_KEY` - Deployment server access
- `NEXT_PUBLIC_API_URL` - API server URL for client applications

### **Monitoring & Debugging**

- **API Logs:** Check the Logs tab in admin interface for real-time API monitoring
- **Console Logs:** Server logs are displayed in the terminal during development
- **Database Logs:** Monitor PostgreSQL logs for query performance
- **Performance:** Use the statistics in the admin dashboard to monitor system performance
- **Swagger Testing:** Use the Bearer token generator in API Keys page for easy endpoint testing

### **Authentication Testing**

**Bearer Token Issues:**
- If Swagger shows "Invalid or expired token", get a fresh Bearer token from the admin interface
- Ensure you're using JWT Bearer tokens (not API keys) for most endpoints
- Check that the token hasn't expired (tokens are session-based)

**API Key Issues:**
- For endpoints requiring `x-api-key` header, generate an API key from the API Keys page
- These are different from Bearer tokens and are used for specific operations

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details