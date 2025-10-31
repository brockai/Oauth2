# Tenant Role Implementation Guide

This document describes the new tenant role implementation that provides tenant-scoped access to data, ensuring tenant users can only access information related to their own tenant.

## Overview

The implementation adds a new set of tenant-scoped routes (`/tenant/*`) that enforce strict tenant data isolation, separate from the existing system admin routes (`/admin/*`).

## Authentication & Authorization Levels

### 1. System Admin (`user_type: 'admin'`)
- **Access**: ALL tenant data across the entire system
- **Routes**: `/admin/*`
- **Capabilities**: Full system administration, cross-tenant operations

### 2. Tenant Admin (`user_type: 'tenant'`, `is_tenant_admin: true`)
- **Access**: Only data within their assigned tenant
- **Routes**: `/tenant/*` (admin functions), `/admin/*` (limited, legacy)
- **Capabilities**: User management, application access within their tenant

### 3. Tenant User (`user_type: 'tenant'`, `is_tenant_admin: false`)
- **Access**: Only their own profile and tenant information (read-only)
- **Routes**: `/tenant/*` (limited functions)
- **Capabilities**: Profile management, view tenant applications/roles

## New Middleware

### `requireTenantScope`
- Ensures user is a tenant user with valid tenant_id
- Attaches `req.tenant_id` for controllers to use
- Used for general tenant-scoped access

### `requireTenantAdmin`
- Ensures user is a tenant admin within their tenant
- Attaches `req.tenant_id` for controllers to use
- Used for tenant administration functions

### `requireTenantOrSystemAdmin`
- Allows either system admin or tenant admin access
- If tenant admin, scopes to their tenant via `req.is_tenant_scoped`
- Used for backwards compatibility with existing admin routes

## New Routes (`/tenant/*`)

### Tenant Information
- `GET /tenant/info` - Get current tenant information (read-only)

### Profile Management
- `GET /tenant/profile` - Get current user profile
- `PUT /tenant/profile` - Update current user profile (including password)

### User Management (Tenant Admin Only)
- `GET /tenant/users` - List users in current tenant
- `POST /tenant/users` - Create user in current tenant
- `GET /tenant/users/:id` - Get specific user in current tenant
- `PUT /tenant/users/:id` - Update user in current tenant
- `DELETE /tenant/users/:id` - Delete user in current tenant

### Application Access (Read-Only)
- `GET /tenant/clients` - List OAuth clients accessible to current tenant
- `GET /tenant/clients/:id` - Get specific OAuth client
- `GET /tenant/clients/:id/roles` - List application roles for current tenant

### Audit Logs
- `GET /tenant/logs` - View API logs scoped to current tenant

## Data Isolation Implementation

### Database Queries
All tenant-scoped controllers filter queries by `tenant_id`:

```sql
-- Example: Only return users from the authenticated user's tenant
SELECT * FROM tenant_users WHERE tenant_id = $1

-- Example: Only return clients accessible to the tenant
SELECT oc.* FROM oauth_clients oc
JOIN tenant_applications ta ON oc.id = ta.application_id
WHERE ta.tenant_id = $1
```

### Controller Methods
New tenant-scoped methods added to existing controllers:

- **TenantUsersController**: `getCurrentUserProfile`, `updateCurrentUserProfile`, `getTenantScopedUsers`, etc.
- **ClientsController**: `getTenantScopedClients`, `getTenantScopedClient`
- **ApplicationRolesController**: `getTenantScopedRoles`
- **LogsController**: `getTenantScopedLogs`

## Security Features

### Tenant Data Isolation
- All queries include `WHERE tenant_id = $1` filters
- Cross-tenant data access is impossible through tenant routes
- Tenant admins cannot see or modify users from other tenants

### Profile Management Security
- Users can only modify their own profiles
- Email uniqueness enforced within tenant scope
- Password changes require current password verification
- Tenant admins cannot delete their own accounts

### Application Access Control
- Tenants can only see applications explicitly associated with their tenant
- Application roles are filtered by tenant access
- Logs show only activity related to tenant's applications

## Migration Path

### Existing System Admins
- Continue using `/admin/*` routes with full system access
- No changes required to existing workflows

### Existing Tenant Admins
- Can continue using `/admin/*` routes (with tenant filtering via middleware)
- **Recommended**: Migrate to `/tenant/*` routes for clearer security model
- `/admin/*` routes will apply tenant scoping automatically for tenant admins

### New Tenant Users
- Use `/tenant/*` routes exclusively
- Cannot access `/admin/*` routes

## Usage Examples

### Tenant Admin Managing Users
```bash
# List all users in their tenant
GET /tenant/users
Authorization: Bearer <tenant-admin-jwt>

# Create new user in their tenant
POST /tenant/users
Authorization: Bearer <tenant-admin-jwt>
{
  "username": "newuser",
  "email": "user@company.com",
  "password": "securepass123",
  "first_name": "John",
  "last_name": "Doe"
}
```

### Tenant User Managing Profile
```bash
# Get own profile
GET /tenant/profile
Authorization: Bearer <tenant-user-jwt>

# Update own profile
PUT /tenant/profile
Authorization: Bearer <tenant-user-jwt>
{
  "first_name": "Updated Name",
  "current_password": "oldpass",
  "new_password": "newpass123"
}
```

### Viewing Tenant Applications
```bash
# List applications accessible to tenant
GET /tenant/clients
Authorization: Bearer <tenant-user-jwt>

# View roles for specific application
GET /tenant/clients/app-uuid/roles
Authorization: Bearer <tenant-user-jwt>
```

## Testing Tenant Isolation

To verify proper tenant isolation:

1. Create users in different tenants
2. Authenticate as tenant admin from Tenant A
3. Attempt to access users from Tenant B via `/tenant/users`
4. Verify that only Tenant A users are returned
5. Attempt to access Tenant B user directly via `/tenant/users/tenant-b-user-id`
6. Verify 404 "User not found" response (proper isolation)

## Backwards Compatibility

- Existing `/admin/*` routes continue to work unchanged for system admins
- Tenant admins using `/admin/*` routes will have tenant scoping applied automatically
- No breaking changes to existing authentication flows
- JWT tokens remain compatible (contain `tenant_id` for tenant users)