import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../../components/Layout';
import { tenantsAPI, clientsAPI, tenantUsersAPI } from '../../lib/api';

export default function TenantDetail() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { tenant_id } = router.query;
  const [tenant, setTenant] = useState(null);
  const [applications, setApplications] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loadingTenant, setLoadingTenant] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && tenant_id) {
      loadTenant();
      loadTenantApplications();
      loadTenantUsers();
      loadStats();
    }
  }, [user, tenant_id]);

  const loadTenant = async () => {
    try {
      const response = await tenantsAPI.getTenant(tenant_id);
      setTenant(response.data);
    } catch (error) {
      setError('Tenant not found');
      console.error('Error loading tenant:', error);
    } finally {
      setLoadingTenant(false);
    }
  };

  const loadTenantApplications = async () => {
    try {
      const response = await clientsAPI.getClients(tenant_id);
      setApplications(response.data);
    } catch (error) {
      console.error('Error loading tenant applications:', error);
    }
  };

  const loadTenantUsers = async () => {
    try {
      const response = await tenantUsersAPI.getTenantUsers(tenant_id);
      setUsers(response.data);
    } catch (error) {
      console.error('Error loading tenant users:', error);
    }
  };

  const deleteUser = async (userId, username) => {
    if (window.confirm(`Are you sure you want to delete user "${username}"?`)) {
      try {
        await tenantUsersAPI.deleteTenantUser(tenant_id, userId);
        setUsers(users.filter(u => u.id !== userId));
      } catch (error) {
        alert('Error deleting user: ' + (error.response?.data?.error || error.message));
      }
    }
  };

  const toggleUserStatus = async (userId, currentStatus) => {
    try {
      await tenantUsersAPI.updateTenantUser(tenant_id, userId, { is_active: !currentStatus });
      setUsers(users.map(u => u.id === userId ? { ...u, is_active: !currentStatus } : u));
    } catch (error) {
      alert('Error updating user status: ' + (error.response?.data?.error || error.message));
    }
  };

  const loadStats = async () => {
    try {
      const response = await tenantsAPI.getTenantStats(tenant_id);
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const toggleStatus = async () => {
    try {
      await tenantsAPI.updateTenant(tenant_id, { is_active: !tenant.is_active });
      setTenant({ ...tenant, is_active: !tenant.is_active });
    } catch (error) {
      alert('Error updating status: ' + (error.response?.data?.error || error.message));
    }
  };

  const deleteTenant = async () => {
    if (window.confirm(`Are you sure you want to delete "${tenant.name}"? This will remove all associated applications.`)) {
      try {
        await tenantsAPI.deleteTenant(tenant_id);
        router.push('/tenants');
      } catch (error) {
        alert('Error deleting tenant: ' + (error.response?.data?.error || error.message));
      }
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-gray-900 dark:text-white">Loading...</div>
      </div>
    );
  }

  if (loadingTenant) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center text-gray-900 dark:text-white">Loading tenant...</div>
        </div>
      </Layout>
    );
  }

  if (error || !tenant) {
    return (
      <Layout>
        <div className="px-4 py-6 sm:px-0">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 dark:text-red-400">Tenant Not Found</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">The requested tenant could not be found.</p>
            <Link
              href="/tenants"
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-600 bg-blue-100 hover:bg-blue-200"
            >
              Back to Tenants
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{tenant.name}</h1>
              <p className="mt-2 text-gray-600 dark:text-gray-400">Tenant Organization Details</p>
            </div>
            <div className="flex space-x-3">
              <Link
                href={`/tenants/${tenant_id}/edit`}
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Edit
              </Link>
              <button
                onClick={toggleStatus}
                className={`inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                  tenant.is_active 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {tenant.is_active ? 'Deactivate' : 'Activate'}
              </button>
              <button
                onClick={deleteTenant}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Basic Information */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Basic Information</h3>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">{tenant.name}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</dt>
                <dd className="mt-1">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    tenant.is_active
                      ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
                      : 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                  }`}>
                    {tenant.is_active ? 'Active' : 'Inactive'}
                  </span>
                </dd>
              </div>
              {tenant.description && (
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Description</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">{tenant.description}</dd>
                </div>
              )}
              {tenant.domain && (
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Domain</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">{tenant.domain}</dd>
                </div>
              )}
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Created</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                  {new Date(tenant.created_at).toLocaleDateString()}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Updated</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                  {new Date(tenant.updated_at).toLocaleDateString()}
                </dd>
              </div>
            </dl>
          </div>

          {/* Associated Applications */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Associated Applications</h3>
              <Link
                href="/clients/new"
                className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Create New Application
              </Link>
            </div>
            {applications.length > 0 ? (
              <div className="space-y-3">
                {applications.map((app) => (
                  <div key={app.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-md">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{app.name}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 font-mono">{app.client_id}</div>
                      {app.description && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{app.description}</div>
                      )}
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        app.is_active
                          ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
                          : 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                      }`}>
                        {app.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <Link
                        href={`/clients/${app.id}`}
                        className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-gray-400 mb-4">No applications associated with this tenant</p>
                <Link
                  href="/clients/new"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-600 bg-blue-100 hover:bg-blue-200"
                >
                  Create First Application
                </Link>
              </div>
            )}
          </div>

          {/* Tenant Users */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Tenant Users</h3>
              <Link
                href={`/tenants/${tenant_id}/users/new`}
                className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Add User
              </Link>
            </div>
            {users.length > 0 ? (
              <div className="space-y-3">
                {users.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-md">
                    <div>
                      <div className="flex items-center space-x-2">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{user.username}</div>
                        {user.is_admin && (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-100">
                            Admin
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                      {(user.first_name || user.last_name) && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {user.first_name} {user.last_name}
                        </div>
                      )}
                      {user.last_login_at && (
                        <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          Last login: {new Date(user.last_login_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => toggleUserStatus(user.id, user.is_active)}
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          user.is_active
                            ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
                            : 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                        }`}
                      >
                        {user.is_active ? 'Active' : 'Inactive'}
                      </button>
                      <Link
                        href={`/tenants/${tenant_id}/users/${user.id}`}
                        className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        View
                      </Link>
                      <button
                        onClick={() => deleteUser(user.id, user.username)}
                        className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-gray-400 mb-4">No users in this tenant</p>
                <Link
                  href={`/tenants/${tenant_id}/users/new`}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-600 bg-blue-100 hover:bg-blue-200"
                >
                  Add First User
                </Link>
              </div>
            )}
          </div>

          {/* Usage Statistics */}
          {stats && (
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Usage Statistics</h3>
              <dl className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <div className="px-4 py-5 bg-gray-50 dark:bg-gray-700 overflow-hidden rounded-lg">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Total Applications</dt>
                  <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">{stats.total_clients || applications.length}</dd>
                </div>
                <div className="px-4 py-5 bg-gray-50 dark:bg-gray-700 overflow-hidden rounded-lg">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Active Applications</dt>
                  <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">{stats.active_clients || applications.filter(a => a.is_active).length}</dd>
                </div>
                <div className="px-4 py-5 bg-gray-50 dark:bg-gray-700 overflow-hidden rounded-lg">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Total Tokens</dt>
                  <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">{stats.total_tokens || 0}</dd>
                </div>
              </dl>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}