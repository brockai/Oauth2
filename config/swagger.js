const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'OAuth 2.0 Server API',
      version: '1.0.0',
      description: `A complete OAuth 2.0 authorization server with multi-client and multi-tenant support.

## Authentication

Most endpoints require Bearer token authentication. To authenticate:

1. **Login**: Use POST /admin/login with your admin credentials
2. **Get Token**: Copy the \`token\` from the login response
3. **Authorize**: Click the 🔓 "Authorize" button above and paste your token

## API Keys

Some endpoints (like POST /admin/token) require API key authentication via the \`x-api-key\` header instead of Bearer tokens.

## Access Levels

- **🔒 System Admin**: Full access to all tenant data via \`/admin/*\` endpoints (Bearer token authentication)
- **🏢 Tenant Admin**: Access to own tenant data only via \`/tenant/*\` endpoints (Bearer token authentication)
- **👤 Tenant User**: Access to own profile and tenant info via \`/tenant/*\` endpoints (Bearer token authentication)`,
      contact: {
        name: 'API Support',
        email: 'support@brockai.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT Bearer token obtained from POST /admin/login. Format: just paste the token value (no "Bearer " prefix needed). Supports both system admin and tenant user tokens.'
        },
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
          description: 'API key for admin token generation'
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication information is missing or invalid',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: {
                    type: 'string',
                    example: 'Access token required'
                  }
                }
              }
            }
          }
        },
        TenantAccessError: {
          description: 'Tenant access required or insufficient tenant permissions',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: {
                    type: 'string',
                    example: 'Tenant admin access required'
                  }
                }
              }
            }
          }
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'User ID'
            },
            username: {
              type: 'string',
              description: 'Username'
            },
            is_admin: {
              type: 'boolean',
              description: 'Whether user has admin privileges'
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp'
            }
          }
        },
        OAuthClient: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Client ID'
            },
            client_id: {
              type: 'string',
              description: 'OAuth client identifier'
            },
            name: {
              type: 'string',
              description: 'Client application name'
            },
            description: {
              type: 'string',
              description: 'Client description'
            },
            redirect_uris: {
              type: 'array',
              items: {
                type: 'string',
                format: 'uri'
              },
              description: 'Allowed redirect URIs'
            },
            grant_types: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['authorization_code', 'refresh_token']
              },
              description: 'Supported grant types'
            },
            scope: {
              type: 'string',
              description: 'Default scope for the client'
            },
            is_active: {
              type: 'boolean',
              description: 'Whether client is active'
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp'
            }
          }
        },
        TokenResponse: {
          type: 'object',
          properties: {
            access_token: {
              type: 'string',
              description: 'The access token'
            },
            token_type: {
              type: 'string',
              enum: ['Bearer'],
              description: 'Token type'
            },
            expires_in: {
              type: 'integer',
              description: 'Token expiration in seconds'
            },
            refresh_token: {
              type: 'string',
              description: 'Refresh token for getting new access tokens'
            },
            scope: {
              type: 'string',
              description: 'Granted scope'
            }
          }
        },
        TenantUser: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'User ID'
            },
            username: {
              type: 'string',
              description: 'Username'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Email address'
            },
            first_name: {
              type: 'string',
              description: 'First name'
            },
            last_name: {
              type: 'string',
              description: 'Last name'
            },
            is_active: {
              type: 'boolean',
              description: 'Whether user account is active'
            },
            is_admin: {
              type: 'boolean',
              description: 'Whether user has tenant admin privileges'
            },
            email_verified: {
              type: 'boolean',
              description: 'Whether email is verified'
            },
            last_login_at: {
              type: 'string',
              format: 'date-time',
              description: 'Last login timestamp'
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp'
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp'
            },
            roles: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/UserRole'
              },
              description: 'User role assignments'
            }
          }
        },
        UserRole: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Role ID'
            },
            role_name: {
              type: 'string',
              description: 'Role name'
            },
            role_description: {
              type: 'string',
              description: 'Role description'
            },
            permissions: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Role permissions'
            },
            assigned_at: {
              type: 'string',
              format: 'date-time',
              description: 'Role assignment timestamp'
            },
            expires_at: {
              type: 'string',
              format: 'date-time',
              description: 'Role expiration timestamp'
            },
            assignment_active: {
              type: 'boolean',
              description: 'Whether role assignment is active'
            },
            application_name: {
              type: 'string',
              description: 'Application name'
            },
            application_id: {
              type: 'string',
              format: 'uuid',
              description: 'Application ID'
            }
          }
        },
        TenantInfo: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Tenant ID'
            },
            name: {
              type: 'string',
              description: 'Tenant name'
            },
            description: {
              type: 'string',
              description: 'Tenant description'
            },
            domain: {
              type: 'string',
              description: 'Tenant domain'
            },
            is_active: {
              type: 'boolean',
              description: 'Whether tenant is active'
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp'
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message'
            }
          }
        }
      }
    },
    security: [],
    tags: [
      {
        name: 'OAuth 2.0',
        description: 'OAuth 2.0 authorization endpoints (Public - No authentication required)'
      },
      {
        name: 'OAuth 2.0 User Auth',
        description: 'OAuth 2.0 user authentication endpoints (Public - No authentication required)'
      },
      {
        name: 'Admin Auth',
        description: 'Admin authentication endpoints (Public - No authentication required)'
      },
      {
        name: 'Admin Token',
        description: 'Admin token generation (🔑 Requires API Key Authentication)'
      },
      {
        name: 'Admin',
        description: 'Admin management (🔒 Requires Bearer Token Authentication)'
      },
      {
        name: 'Clients',
        description: 'OAuth client management (🔒 Requires Bearer Token Authentication)'
      },
      {
        name: 'Tenants',
        description: 'Tenant management (🔒 Requires Bearer Token Authentication)'
      },
      {
        name: 'Tenant Users',
        description: 'Tenant user management (🔒 Requires Bearer Token Authentication)'
      },
      {
        name: 'API Keys',
        description: 'API key management (🔒 Requires Bearer Token Authentication)'
      },
      {
        name: 'Logs',
        description: 'API logging and monitoring (🔒 Requires Bearer Token Authentication)'
      },
      {
        name: 'Tenant',
        description: 'Tenant information (🏢 Requires Bearer Token Authentication)'
      },
      {
        name: 'Tenant Profile',
        description: 'Tenant user profile management (👤 Requires Bearer Token Authentication)'
      },
      {
        name: 'Tenant User Management',
        description: 'Tenant user administration (🏢 Requires Bearer Token Authentication)'
      },
      {
        name: 'Tenant Clients',
        description: 'Tenant OAuth clients (🏢 Requires Bearer Token Authentication)'
      },
      {
        name: 'Tenant Logs',
        description: 'Tenant API logs (🏢 Requires Bearer Token Authentication)'
      },
      {
        name: 'Health',
        description: 'System health and status (Public - No authentication required)'
      }
    ]
  },
  apis: ['./routes/*.js', './controllers/*.js', './server.js']
};

const specs = swaggerJsdoc(options);
module.exports = specs;