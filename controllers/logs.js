const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const getLogs = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      status,
      method,
      endpoint,
      success,
      api_key_id,
      start_date,
      end_date
    } = req.query;

    const offset = (page - 1) * limit;
    let whereConditions = [];
    let queryParams = [];
    let paramCount = 0;

    // Build WHERE conditions based on filters
    if (status) {
      paramCount++;
      whereConditions.push(`al.status_code = $${paramCount}`);
      queryParams.push(parseInt(status));
    }

    if (method) {
      paramCount++;
      whereConditions.push(`al.method = $${paramCount}`);
      queryParams.push(method.toUpperCase());
    }

    if (endpoint) {
      paramCount++;
      whereConditions.push(`al.endpoint ILIKE $${paramCount}`);
      queryParams.push(`%${endpoint}%`);
    }

    if (success !== undefined) {
      paramCount++;
      whereConditions.push(`al.success = $${paramCount}`);
      queryParams.push(success === 'true');
    }

    if (api_key_id) {
      paramCount++;
      whereConditions.push(`al.api_key_id = $${paramCount}`);
      queryParams.push(api_key_id);
    }

    if (start_date) {
      paramCount++;
      whereConditions.push(`al.timestamp >= $${paramCount}`);
      queryParams.push(start_date);
    }

    if (end_date) {
      paramCount++;
      whereConditions.push(`al.timestamp <= $${paramCount}`);
      queryParams.push(end_date);
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) 
      FROM api_logs al
      LEFT JOIN tenants t ON al.tenant_id = t.id
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery, queryParams);
    const totalLogs = parseInt(countResult.rows[0].count);

    // Get paginated logs
    paramCount++;
    const limitParam = paramCount;
    paramCount++;
    const offsetParam = paramCount;
    
    const logsQuery = `
      SELECT 
        al.id,
        al.timestamp,
        al.method,
        al.endpoint,
        al.status_code,
        al.response_time,
        al.ip_address,
        al.user_agent,
        al.api_key_id,
        al.client_id,
        al.tenant_id,
        al.success,
        al.error_message,
        al.created_at,
        t.name as tenant_name,
        t.domain as tenant_subdomain
      FROM api_logs al
      LEFT JOIN tenants t ON al.tenant_id = t.id
      ${whereClause}
      ORDER BY al.timestamp DESC
      LIMIT $${limitParam} OFFSET $${offsetParam}
    `;
    
    queryParams.push(parseInt(limit), offset);
    const logsResult = await pool.query(logsQuery, queryParams);

    res.json({
      logs: logsResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalLogs,
        pages: Math.ceil(totalLogs / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getLogById = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        al.*,
        t.name as tenant_name,
        t.domain as tenant_subdomain
      FROM api_logs al
      LEFT JOIN tenants t ON al.tenant_id = t.id
      WHERE al.id = $1
    `;
    
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Log entry not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching log by ID:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getLogStats = async (req, res) => {
  try {
    const { period = '24h' } = req.query;
    
    let timeCondition = '';
    switch (period) {
      case '1h':
        timeCondition = "timestamp >= NOW() - INTERVAL '1 hour'";
        break;
      case '24h':
        timeCondition = "timestamp >= NOW() - INTERVAL '24 hours'";
        break;
      case '7d':
        timeCondition = "timestamp >= NOW() - INTERVAL '7 days'";
        break;
      case '30d':
        timeCondition = "timestamp >= NOW() - INTERVAL '30 days'";
        break;
      default:
        timeCondition = "timestamp >= NOW() - INTERVAL '24 hours'";
    }

    const statsQuery = `
      SELECT 
        COUNT(*) as total_requests,
        COUNT(CASE WHEN success = true THEN 1 END) as successful_requests,
        COUNT(CASE WHEN success = false THEN 1 END) as failed_requests,
        AVG(response_time) as avg_response_time,
        COUNT(DISTINCT api_key_id) as unique_api_keys,
        COUNT(DISTINCT ip_address) as unique_ips
      FROM api_logs
      WHERE ${timeCondition}
    `;

    const statusCodesQuery = `
      SELECT 
        status_code,
        COUNT(*) as count
      FROM api_logs
      WHERE ${timeCondition}
      GROUP BY status_code
      ORDER BY count DESC
    `;

    const endpointsQuery = `
      SELECT 
        endpoint,
        COUNT(*) as count,
        AVG(response_time) as avg_response_time
      FROM api_logs
      WHERE ${timeCondition}
      GROUP BY endpoint
      ORDER BY count DESC
      LIMIT 10
    `;

    const [statsResult, statusCodesResult, endpointsResult] = await Promise.all([
      pool.query(statsQuery),
      pool.query(statusCodesQuery),
      pool.query(endpointsQuery)
    ]);

    res.json({
      period,
      stats: statsResult.rows[0],
      status_codes: statusCodesResult.rows,
      top_endpoints: endpointsResult.rows
    });
  } catch (error) {
    console.error('Error fetching log stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const logApiCall = async (logData) => {
  try {
    const {
      method,
      endpoint,
      statusCode,
      responseTime,
      ipAddress,
      userAgent,
      apiKeyId,
      clientId,
      tenantId,
      requestBody,
      responseBody,
      errorMessage,
      success
    } = logData;

    const query = `
      INSERT INTO api_logs (
        method, endpoint, status_code, response_time, ip_address,
        user_agent, api_key_id, client_id, tenant_id, request_body, response_body,
        error_message, success
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id
    `;

    const values = [
      method,
      endpoint,
      statusCode,
      responseTime,
      ipAddress,
      userAgent,
      apiKeyId,
      clientId,
      tenantId,
      requestBody ? JSON.stringify(requestBody) : null,
      responseBody ? JSON.stringify(responseBody) : null,
      errorMessage,
      success
    ];

    await pool.query(query, values);
  } catch (error) {
    console.error('Error logging API call:', error);
    // Don't throw error to avoid breaking the main API flow
  }
};

// Tenant-scoped logs method
const getTenantScopedLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, status, method, endpoint, success, start_date, end_date, tenantId } = req.query;

    const offset = (page - 1) * limit;

    // Use tenantId parameter if provided, otherwise use authenticated tenant
    const targetTenantId = tenantId || req.tenant_id;

    // Base query with tenant scope - only show logs for this tenant's applications
    // Join with oauth_clients and tenant_applications to filter by tenant
    let whereClause = `WHERE (al.tenant_id = $1 OR oc.id IN (
      SELECT application_id FROM tenant_applications WHERE tenant_id = $1
    ))`;
    let queryParams = [targetTenantId];
    let paramCount = 1;

    // Add filters
    if (status) {
      paramCount++;
      whereClause += ` AND al.status_code = $${paramCount}`;
      queryParams.push(parseInt(status));
    }

    if (method) {
      paramCount++;
      whereClause += ` AND al.method = $${paramCount}`;
      queryParams.push(method.toUpperCase());
    }

    if (endpoint) {
      paramCount++;
      whereClause += ` AND al.endpoint ILIKE $${paramCount}`;
      queryParams.push(`%${endpoint}%`);
    }

    if (success !== undefined) {
      paramCount++;
      whereClause += ` AND al.success = $${paramCount}`;
      queryParams.push(success === 'true');
    }

    if (start_date) {
      paramCount++;
      whereClause += ` AND al.timestamp >= $${paramCount}`;
      queryParams.push(start_date);
    }

    if (end_date) {
      paramCount++;
      whereClause += ` AND al.timestamp <= $${paramCount}`;
      queryParams.push(end_date);
    }

    // Count total logs for this tenant
    const countQuery = `
      SELECT COUNT(*)
      FROM api_logs al
      LEFT JOIN oauth_clients oc ON al.client_id = oc.client_id
      LEFT JOIN tenants t ON al.tenant_id = t.id
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery, queryParams);
    const totalLogs = parseInt(countResult.rows[0].count);

    // Get paginated logs
    const limitParam = paramCount + 1;
    const offsetParam = paramCount + 2;
    const logsQuery = `
      SELECT
        al.id,
        al.timestamp AT TIME ZONE 'UTC' as timestamp,
        al.method,
        al.endpoint,
        al.status_code,
        al.response_time,
        al.ip_address,
        al.user_agent,
        al.tenant_id,
        al.success,
        al.error_message,
        al.created_at,
        oc.name as application_name,
        t.name as tenant_name,
        t.domain as tenant_subdomain
      FROM api_logs al
      LEFT JOIN oauth_clients oc ON al.client_id = oc.client_id
      LEFT JOIN tenants t ON al.tenant_id = t.id
      ${whereClause}
      ORDER BY al.timestamp DESC
      LIMIT $${limitParam} OFFSET $${offsetParam}
    `;

    queryParams.push(parseInt(limit), offset);
    const logsResult = await pool.query(logsQuery, queryParams);

    res.json({
      logs: logsResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalLogs,
        pages: Math.ceil(totalLogs / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching tenant scoped logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getTenantScopedLogStats = async (req, res) => {
  try {
    const { period = '24h', tenantId } = req.query;

    // Use tenantId parameter if provided, otherwise use authenticated tenant
    const targetTenantId = tenantId || req.tenant_id;

    let timeCondition = '';
    switch (period) {
      case '1h':
        timeCondition = "AND timestamp >= NOW() - INTERVAL '1 hour'";
        break;
      case '24h':
        timeCondition = "AND timestamp >= NOW() - INTERVAL '24 hours'";
        break;
      case '7d':
        timeCondition = "AND timestamp >= NOW() - INTERVAL '7 days'";
        break;
      case '30d':
        timeCondition = "AND timestamp >= NOW() - INTERVAL '30 days'";
        break;
      default:
        timeCondition = "AND timestamp >= NOW() - INTERVAL '24 hours'";
    }

    const statsQuery = `
      SELECT
        COUNT(*) as total_requests,
        COUNT(CASE WHEN al.success = true THEN 1 END) as successful_requests,
        COUNT(CASE WHEN al.success = false THEN 1 END) as failed_requests,
        AVG(al.response_time) as avg_response_time,
        COUNT(DISTINCT al.api_key_id) as unique_api_keys,
        COUNT(DISTINCT al.ip_address) as unique_ips
      FROM api_logs al
      LEFT JOIN oauth_clients oc ON al.client_id = oc.client_id
      WHERE (al.tenant_id = $1 OR oc.id IN (
        SELECT application_id FROM tenant_applications WHERE tenant_id = $1
      )) ${timeCondition}
    `;

    const statusCodesQuery = `
      SELECT
        al.status_code,
        COUNT(*) as count
      FROM api_logs al
      LEFT JOIN oauth_clients oc ON al.client_id = oc.client_id
      WHERE (al.tenant_id = $1 OR oc.id IN (
        SELECT application_id FROM tenant_applications WHERE tenant_id = $1
      )) ${timeCondition}
      GROUP BY al.status_code
      ORDER BY count DESC
    `;

    const endpointsQuery = `
      SELECT
        al.endpoint,
        COUNT(*) as count,
        AVG(al.response_time) as avg_response_time
      FROM api_logs al
      LEFT JOIN oauth_clients oc ON al.client_id = oc.client_id
      WHERE (al.tenant_id = $1 OR oc.id IN (
        SELECT application_id FROM tenant_applications WHERE tenant_id = $1
      )) ${timeCondition}
      GROUP BY al.endpoint
      ORDER BY count DESC
      LIMIT 10
    `;

    const [statsResult, statusCodesResult, endpointsResult] = await Promise.all([
      pool.query(statsQuery, [targetTenantId]),
      pool.query(statusCodesQuery, [targetTenantId]),
      pool.query(endpointsQuery, [targetTenantId])
    ]);

    res.json({
      period,
      stats: statsResult.rows[0],
      status_codes: statusCodesResult.rows,
      top_endpoints: endpointsResult.rows
    });
  } catch (error) {
    console.error('Error fetching tenant scoped log stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getLogs,
  getLogById,
  getTenantScopedLogs,
  getTenantScopedLogStats,
  getLogStats,
  logApiCall
};