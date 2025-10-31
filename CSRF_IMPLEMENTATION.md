# CSRF Protection Implementation

This document describes how CSRF (Cross-Site Request Forgery) protection has been implemented in the OAuth 2.0 server.

## Overview

CSRF protection has been added to all sensitive endpoints that modify server state, including:
- `/oauth/token` - Token exchange
- `/oauth/token/refresh` - Token refresh
- `/oauth/authenticate` - User authentication
- `/oauth/validate` - Session validation
- `/oauth/logout` - User logout

## How It Works

1. **Token Generation**: The server provides a CSRF token endpoint at `/oauth/csrf-token`
2. **Token Storage**: CSRF secrets are stored in secure HTTP-only cookies
3. **Token Validation**: Protected endpoints validate the CSRF token before processing requests

## Usage

### 1. Get a CSRF Token

```bash
curl -X GET http://localhost:3000/oauth/csrf-token \
  -H "Content-Type: application/json" \
  -c cookies.txt
```

Response:
```json
{
  "csrf_token": "abc123...",
  "expires_in": 86400
}
```

### 2. Use the Token in Requests

Include the CSRF token in the `X-CSRF-Token` header:

```bash
curl -X POST http://localhost:3000/oauth/token \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: abc123..." \
  -b cookies.txt \
  -d '{
    "grant_type": "authorization_code",
    "code": "auth_code_here",
    "redirect_uri": "http://localhost:3001/redirect",
    "client_id": "your_client_id",
    "client_secret": "your_client_secret"
  }'
```

### 3. Alternative: Include in Request Body

You can also include the CSRF token in the request body as `_csrf`:

```bash
curl -X POST http://localhost:3000/oauth/token \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "_csrf": "abc123...",
    "grant_type": "authorization_code",
    "code": "auth_code_here",
    "redirect_uri": "http://localhost:3001/redirect",
    "client_id": "your_client_id",
    "client_secret": "your_client_secret"
  }'
```

## Client Implementation

### JavaScript/Browser

```javascript
// Get CSRF token
const csrfResponse = await fetch('/oauth/csrf-token', {
  credentials: 'include' // Include cookies
});
const { csrf_token } = await csrfResponse.json();

// Use token in subsequent requests
const tokenResponse = await fetch('/oauth/token', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrf_token
  },
  credentials: 'include',
  body: JSON.stringify({
    grant_type: 'authorization_code',
    code: 'auth_code_here',
    redirect_uri: 'http://localhost:3001/redirect',
    client_id: 'your_client_id',
    client_secret: 'your_client_secret'
  })
});
```

### Node.js

```javascript
const axios = require('axios');

// Configure axios to handle cookies
const client = axios.create({
  withCredentials: true
});

// Get CSRF token
const csrfResponse = await client.get('/oauth/csrf-token');
const { csrf_token } = csrfResponse.data;

// Use token in subsequent requests
const tokenResponse = await client.post('/oauth/token', {
  grant_type: 'authorization_code',
  code: 'auth_code_here',
  redirect_uri: 'http://localhost:3001/redirect',
  client_id: 'your_client_id',
  client_secret: 'your_client_secret'
}, {
  headers: {
    'X-CSRF-Token': csrf_token
  }
});
```

## Error Responses

### Missing CSRF Token
```json
{
  "error": "csrf_token_missing",
  "description": "CSRF token is required"
}
```

### Invalid CSRF Token
```json
{
  "error": "invalid_csrf_token",
  "description": "Invalid CSRF token"
}
```

### Missing CSRF Secret
```json
{
  "error": "csrf_secret_missing",
  "description": "CSRF secret is missing"
}
```

## Security Notes

1. **CSRF tokens expire after 24 hours**
2. **Cookies are HTTP-only and secure in production**
3. **SameSite=Strict policy is enforced**
4. **GET requests (like `/oauth/authorize`) don't require CSRF tokens**
5. **CSRF tokens are unique per session**

## Environment Variables

Add to your `.env` file:

```env
CSRF_SECRET=your-csrf-secret-key-here
```

If not provided, a default secret will be used (not recommended for production).