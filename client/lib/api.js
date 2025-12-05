import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Helper function to get user info from localStorage token
const getUserFromToken = () => {
  const token = localStorage.getItem('token');
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload;
  } catch (e) {
    return null;
  }
};

// Helper function to determine API base path
const getApiBasePath = () => {
  const user = getUserFromToken();
  if (user?.user_type === 'admin' && user?.is_admin === true) {
    return '/admin';
  } else if (user?.user_type === 'tenant') {
    return '/tenant';
  }
  return '/admin'; // Default to admin for backward compatibility
};

export const authAPI = {
  login: (credentials) => {
    // Use demo endpoint if on demo hostname
    const isDemo = typeof window !== 'undefined' && window.location.hostname === 'oauth2.demo.brockai.com';
    const endpoint = isDemo ? '/admin/demo/login' : '/admin/login';
    return api.post(endpoint, credentials);
  },
  getMe: () => {
    const basePath = getApiBasePath();
    return api.get(`${basePath}/me`);
  },
  updateProfile: (data) => {
    const basePath = getApiBasePath();
    return api.put(`${basePath}/profile`, data);
  },
};

export const clientsAPI = {
  getClients: (tenantId) => {
    const basePath = getApiBasePath();
    const user = getUserFromToken();

    if (user?.user_type === 'tenant') {
      // For tenant users, use tenant-specific endpoint
      return api.get(`${basePath}/clients`);
    } else {
      // For admin users, use admin endpoint with optional tenant filter
      return api.get(`${basePath}/clients`, { params: tenantId ? { tenant_id: tenantId } : {} });
    }
  },
  getClient: (id) => {
    const basePath = getApiBasePath();
    return api.get(`${basePath}/clients/${id}`);
  },
  createClient: (data) => {
    const basePath = getApiBasePath();
    return api.post(`${basePath}/clients`, data);
  },
  updateClient: (id, data) => {
    const basePath = getApiBasePath();
    return api.put(`${basePath}/clients/${id}`, data);
  },
  deleteClient: (id) => {
    const basePath = getApiBasePath();
    return api.delete(`${basePath}/clients/${id}`);
  },
  regenerateSecret: (id) => {
    const basePath = getApiBasePath();
    return api.post(`${basePath}/clients/${id}/regenerate-secret`);
  },
  getClientStats: (id) => {
    const basePath = getApiBasePath();
    return api.get(`${basePath}/clients/${id}/stats`);
  },
  addApplicationToTenants: (id, tenantIds) => {
    // This is admin-only functionality
    return api.post(`/admin/clients/${id}/tenants`, { tenant_ids: tenantIds });
  },
  removeApplicationFromTenants: (id, tenantIds) => {
    // This is admin-only functionality
    return api.delete(`/admin/clients/${id}/tenants`, { data: { tenant_ids: tenantIds } });
  },
};

export const tenantsAPI = {
  getTenants: () => {
    const basePath = getApiBasePath();
    const user = getUserFromToken();

    if (user?.user_type === 'tenant') {
      // For tenant users, get their own tenant info and return as array
      return api.get(`${basePath}/info`).then(response => ({
        ...response,
        data: [response.data] // Wrap single tenant in array for consistency
      }));
    } else {
      // For admin users, get all tenants
      return api.get(`${basePath}/tenants`);
    }
  },
  getTenant: (id) => api.get(`/admin/tenants/${id}`),
  createTenant: (data) => api.post('/admin/tenants', data),
  updateTenant: (id, data) => api.put(`/admin/tenants/${id}`, data),
  deleteTenant: (id) => api.delete(`/admin/tenants/${id}`),
  getTenantStats: (id) => api.get(`/admin/tenants/${id}/stats`),
};

export const tenantUsersAPI = {
  getTenantUsers: (tenantId) => {
    const basePath = getApiBasePath();
    const user = getUserFromToken();

    if (user?.user_type === 'tenant') {
      // For tenant users, use tenant-scoped endpoint (no tenantId needed)
      return api.get(`${basePath}/users`);
    } else {
      // For admin users, use admin endpoint with explicit tenant ID
      return api.get(`${basePath}/tenants/${tenantId}/users`);
    }
  },
  getTenantUser: (tenantId, userId) => {
    const basePath = getApiBasePath();
    const user = getUserFromToken();

    if (user?.user_type === 'tenant') {
      // For tenant users, use tenant-scoped endpoint
      return api.get(`${basePath}/users/${userId}`);
    } else {
      // For admin users, use admin endpoint
      return api.get(`${basePath}/tenants/${tenantId}/users/${userId}`);
    }
  },
  createTenantUser: (tenantId, data) => {
    const basePath = getApiBasePath();
    const user = getUserFromToken();

    if (user?.user_type === 'tenant') {
      // For tenant users, use tenant-scoped endpoint
      return api.post(`${basePath}/users`, data);
    } else {
      // For admin users, use admin endpoint
      return api.post(`${basePath}/tenants/${tenantId}/users`, data);
    }
  },
  updateTenantUser: (tenantId, userId, data) => {
    const basePath = getApiBasePath();
    const user = getUserFromToken();

    if (user?.user_type === 'tenant') {
      // For tenant users, use tenant-scoped endpoint
      return api.put(`${basePath}/users/${userId}`, data);
    } else {
      // For admin users, use admin endpoint
      return api.put(`${basePath}/tenants/${tenantId}/users/${userId}`, data);
    }
  },
  deleteTenantUser: (tenantId, userId) => {
    const basePath = getApiBasePath();
    const user = getUserFromToken();

    if (user?.user_type === 'tenant') {
      // For tenant users, use tenant-scoped endpoint
      return api.delete(`${basePath}/users/${userId}`);
    } else {
      // For admin users, use admin endpoint
      return api.delete(`${basePath}/tenants/${tenantId}/users/${userId}`);
    }
  },
  resetUserPassword: (tenantId, userId, password) => {
    const basePath = getApiBasePath();
    const user = getUserFromToken();

    if (user?.user_type === 'tenant') {
      // This functionality may not be available for tenant users in tenant scope
      return api.post(`${basePath}/users/${userId}/reset-password`, { password });
    } else {
      // For admin users, use admin endpoint
      return api.post(`${basePath}/tenants/${tenantId}/users/${userId}/reset-password`, { password });
    }
  },
};

export const apiKeysAPI = {
  getApiKeys: () => api.get('/admin/api-keys'),
  generateNewKey: (data) => api.post('/admin/api-keys/generate', data),
  deleteApiKey: (id) => api.delete(`/admin/api-keys/${id}`),
  toggleApiKey: (id) => api.patch(`/admin/api-keys/${id}/toggle`),
};

export const logsAPI = {
  getLogs: (params) => {
    const basePath = getApiBasePath();
    return api.get(`${basePath}/logs`, { params });
  },
  getLogById: (id) => {
    const basePath = getApiBasePath();
    return api.get(`${basePath}/logs/${id}`);
  },
  getLogStats: (period) => {
    const basePath = getApiBasePath();
    return api.get(`${basePath}/logs/stats`, { params: { period } });
  },
};

export const adminAPI = {
  getSuperAdmins: () => api.get('/admin/system-admins'),
  getSuperAdmin: (id) => api.get(`/admin/system-admins/${id}`),
  resetAdminPassword: (id, password) => api.post(`/admin/system-admins/${id}/reset-password`, { password }),
  deleteSuperAdmin: (id) => api.delete(`/admin/system-admins/${id}`),
};

export default api;