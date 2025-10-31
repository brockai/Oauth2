const { logApiCall } = require('../controllers/logs');
const { validateApiKey } = require('../controllers/apiKeys');
const jwt = require('jsonwebtoken');

const apiLoggerMiddleware = (req, res, next) => {
  const startTime = Date.now();

  // Store original end method
  const originalEnd = res.end;
  const originalJson = res.json;

  let responseBody = null;
  let apiKeyId = null;
  let clientId = null;
  let tenantId = null;

  // Determine API key used and extract tenant_id from JWT
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const apiKeyData = validateApiKey(token);
    if (apiKeyData) {
      apiKeyId = apiKeyData.id;
    } else {
      // Try to decode as JWT to get tenant_id
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.tenant_id) {
          tenantId = decoded.tenant_id;
        }
      } catch (err) {
        // Token is invalid or expired, ignore
      }
    }
  }

  // Extract client_id from request if present
  if (req.body && req.body.client_id) {
    clientId = req.body.client_id;
  } else if (req.query && req.query.client_id) {
    clientId = req.query.client_id;
  }

  // Override res.json to capture response body
  res.json = function(data) {
    responseBody = data;
    return originalJson.call(this, data);
  };

  // Override res.end to log the request
  res.end = function(chunk, encoding) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    // Determine if request was successful
    const success = res.statusCode >= 200 && res.statusCode < 400;
    
    // Prepare log data
    const logData = {
      method: req.method,
      endpoint: req.originalUrl || req.url,
      statusCode: res.statusCode,
      responseTime,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      apiKeyId,
      clientId,
      tenantId,
      requestBody: req.body,
      responseBody: responseBody || (chunk ? chunk.toString() : null),
      errorMessage: !success && responseBody ? responseBody.error || responseBody.message : null,
      success
    };

    // Log the API call asynchronously (don't block response)
    setImmediate(() => {
      logApiCall(logData);
    });

    // Call original end method
    originalEnd.call(this, chunk, encoding);
  };

  next();
};

// Middleware specifically for OAuth endpoints
const oauthLoggerMiddleware = (req, res, next) => {
  const startTime = Date.now();
  
  const originalEnd = res.end;
  const originalJson = res.json;
  
  let responseBody = null;
  let clientId = null;

  // Extract client_id from OAuth request
  if (req.body && req.body.client_id) {
    clientId = req.body.client_id;
  } else if (req.query && req.query.client_id) {
    clientId = req.query.client_id;
  }

  // Override res.json to capture response body
  res.json = function(data) {
    responseBody = data;
    return originalJson.call(this, data);
  };

  // Override res.end to log the OAuth request
  res.end = function(chunk, encoding) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    const success = res.statusCode >= 200 && res.statusCode < 400;
    
    const logData = {
      method: req.method,
      endpoint: req.originalUrl || req.url,
      statusCode: res.statusCode,
      responseTime,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      apiKeyId: null, // OAuth requests don't use API keys
      clientId,
      requestBody: req.body,
      responseBody: responseBody || (chunk ? chunk.toString() : null),
      errorMessage: !success && responseBody ? responseBody.error || responseBody.error_description : null,
      success
    };

    setImmediate(() => {
      logApiCall(logData);
    });

    originalEnd.call(this, chunk, encoding);
  };

  next();
};

module.exports = {
  apiLoggerMiddleware,
  oauthLoggerMiddleware
};