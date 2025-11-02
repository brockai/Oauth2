# OAuth2 Server Scripts

This directory contains utility scripts for managing the OAuth2 server.

## Admin User Creation

### create-admin.js

Creates a system administrator user who can manage all tenants.

**Usage:**
```bash
node scripts/create-admin.js <username> <password>
```

**Example:**
```bash
node scripts/create-admin.js superadmin mySecurePassword123
```

**Requirements:**
- Username must be at least 3 characters
- Password must be at least 6 characters  
- Username must be unique

**Admin Capabilities:**
- Manage all tenants (create, edit, delete)
- View all OAuth clients across tenants
- Manage API keys and access logs
- Access system admin dashboard
- Full system oversight

**Server Usage:**
After deployment, SSH into your server and run:
```bash
cd /var/www/oauth2.api/server
node scripts/create-admin.js your_admin_username your_secure_password
```

The script will create the admin user and display confirmation details.