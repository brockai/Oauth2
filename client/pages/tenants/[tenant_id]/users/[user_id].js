import { useState, useEffect } from 'react';
import { useAuth } from '../../../../hooks/useAuth';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../../../../components/Layout';
import { tenantUsersAPI, tenantsAPI, clientsAPI } from '../../../../lib/api';

export default function TenantUserDetail() {
  const { user: currentUser, loading } = useAuth();
  const router = useRouter();
  const { tenant_id, user_id } = router.query;
  const [tenant, setTenant] = useState(null);
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [tenantClients, setTenantClients] = useState([]);
  const [availableClientRoles, setAvailableClientRoles] = useState([]);
  const [userClientRoles, setUserClientRoles] = useState(user?.client_roles || []);

  useEffect(() => {
    if (!loading && !currentUser) {
      router.push('/login');
    }
  }, [currentUser, loading, router]);

  useEffect(() => {
    if (currentUser && tenant_id && user_id) {
      loadTenant();
      loadUser();
      loadTenantClients();
    }
  }, [currentUser, tenant_id, user_id]);

  const loadTenant = async () => {
    try {
      const response = await tenantsAPI.getTenant(tenant_id);
      setTenant(response.data);
    } catch (error) {
      console.error('Error loading tenant:', error);
    }
  };

  const loadUser = async () => {
    try {
      const response = await tenantUsersAPI.getTenantUser(tenant_id, user_id);
      setUser(response.data);
      setUserClientRoles(response.data.client_roles || []);
    } catch (error) {
      setError('User not found');
      console.error('Error loading user:', error);
    } finally {
      setLoadingUser(false);
    }
  };

  const loadTenantClients = async () => {
    try {
      const response = await clientsAPI.getClients(tenant_id);
      setTenantClients(response.data);

      // Extract all unique roles from tenant's clients
      const allRoles = [];
      response.data.forEach(client => {
        if (client.roles && client.roles.length > 0) {
          client.roles.forEach(role => {
            const roleObj = {
              id: typeof role === 'string' ? role : (role.id || role.name),
              name: typeof role === 'string' ? role : role.name,
              description: typeof role === 'string' ? `${role} role` : role.description,
              clientId: client.id,
              clientName: client.name
            };

            // Only add if not already exists
            if (!allRoles.find(r => r.id === roleObj.id && r.clientId === roleObj.clientId)) {
              allRoles.push(roleObj);
            }
          });
        }
      });

      setAvailableClientRoles(allRoles);
    } catch (error) {
      console.error('Error loading tenant clients:', error);
    }
  };

  const toggleUserStatus = async () => {
    try {
      await tenantUsersAPI.updateTenantUser(tenant_id, user_id, { is_active: !user.is_active });
      setUser({ ...user, is_active: !user.is_active });
    } catch (error) {
      alert('Error updating user status: ' + (error.response?.data?.error || error.message));
    }
  };

  const toggleAdminStatus = async () => {
    try {
      await tenantUsersAPI.updateTenantUser(tenant_id, user_id, { is_admin: !user.is_admin });
      setUser({ ...user, is_admin: !user.is_admin });
    } catch (error) {
      alert('Error updating admin status: ' + (error.response?.data?.error || error.message));
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    if (!newPassword) {
      alert('Please enter a new password');
      return;
    }

    try {
      await tenantUsersAPI.resetUserPassword(tenant_id, user_id, newPassword);
      alert('Password reset successfully');
      setShowPasswordReset(false);
      setNewPassword('');
    } catch (error) {
      alert('Error resetting password: ' + (error.response?.data?.error || error.message));
    }
  };

  const deleteUser = async () => {
    if (window.confirm(`Are you sure you want to delete user "${user.username}"?`)) {
      try {
        await tenantUsersAPI.deleteTenantUser(tenant_id, user_id);
        router.push(`/tenants/${tenant_id}`);
      } catch (error) {
        alert('Error deleting user: ' + (error.response?.data?.error || error.message));
      }
    }
  };

  const handleClientRoleChange = async (roleKey, checked) => {
    try {
      const newClientRoles = checked
        ? [...userClientRoles, roleKey]
        : userClientRoles.filter(r => r !== roleKey);

      await tenantUsersAPI.updateTenantUser(tenant_id, user_id, { client_roles: newClientRoles });
      setUserClientRoles(newClientRoles);
      setUser({ ...user, client_roles: newClientRoles });
    } catch (error) {
      alert('Error updating client roles: ' + (error.response?.data?.error || error.message));
    }
  };

  if (loading || !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-gray-900 dark:text-white">Loading...</div>
      </div>
    );
  }

  if (loadingUser) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center text-gray-900 dark:text-white">Loading user...</div>
        </div>
      </Layout>
    );
  }

  if (error || !user) {
    return (
      <Layout>
        <div className="px-4 py-6 sm:px-0">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 dark:text-red-400">User Not Found</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">The requested user could not be found.</p>
            <Link
              href={`/tenants/${tenant_id}`}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-600 bg-blue-100 hover:bg-blue-200"
            >
              Back to Tenant
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
          <nav className="flex" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-4">
              <li>
                <Link href="/tenants" className="text-gray-400 hover:text-gray-500">
                  Tenants
                </Link>
              </li>
              <li>
                <span className="text-gray-400">/</span>
              </li>
              <li>
                <Link href={`/tenants/${tenant_id}`} className="text-gray-400 hover:text-gray-500">
                  {tenant?.name || 'Tenant'}
                </Link>
              </li>
              <li>
                <span className="text-gray-400">/</span>
              </li>
              <li>
                <span className="text-gray-900 dark:text-white">Users</span>
              </li>
            </ol>
          </nav>

          <div className="mt-4 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{user.username}</h1>
              <p className="mt-2 text-gray-600 dark:text-gray-400">User Details</p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={toggleUserStatus}
                className={`inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                  user.is_active 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {user.is_active ? 'Deactivate' : 'Activate'}
              </button>
              <button
                onClick={() => setShowPasswordReset(!showPasswordReset)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Reset Password
              </button>
              <button
                onClick={deleteUser}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
              >
                Delete User
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* User Information */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">User Information</h3>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Username</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">{user.username}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">{user.email}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">First Name</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">{user.first_name || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Name</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">{user.last_name || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</dt>
                <dd className="mt-1">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    user.is_active
                      ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
                      : 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                  }`}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Role</dt>
                <dd className="mt-1 flex items-center space-x-2">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    user.is_admin
                      ? 'bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-100'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {user.is_admin ? 'Admin' : 'User'}
                  </span>
                  <button
                    onClick={toggleAdminStatus}
                    className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    {user.is_admin ? 'Remove Admin' : 'Make Admin'}
                  </button>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Email Verified</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                  {user.email_verified ? 'Yes' : 'No'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Login</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                  {user.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'Never'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Created</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                  {new Date(user.created_at).toLocaleDateString()}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Updated</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                  {new Date(user.updated_at).toLocaleDateString()}
                </dd>
              </div>
            </dl>
          </div>

          {/* Client Roles */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Client Roles</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Client-side roles derived from applications associated with this tenant. These roles are used for client-side authorization.
            </p>

            {availableClientRoles.length > 0 ? (
              <div className="space-y-4">
                {/* Group roles by client */}
                {tenantClients.map(client => {
                  const clientRoles = availableClientRoles.filter(role => role.clientId === client.id);
                  if (clientRoles.length === 0) return null;

                  return (
                    <div key={client.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                      <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                        <span className="text-blue-600 dark:text-blue-400">{client.name}</span>
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">({clientRoles.length} roles)</span>
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {clientRoles.map(role => {
                          const roleKey = `${client.id}:${role.id}`;
                          const isAssigned = userClientRoles.includes(roleKey);

                          return (
                            <label key={roleKey} className="relative flex items-start cursor-pointer">
                              <div className="flex items-center h-5">
                                <input
                                  type="checkbox"
                                  checked={isAssigned}
                                  onChange={(e) => handleClientRoleChange(roleKey, e.target.checked)}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700"
                                />
                              </div>
                              <div className="ml-3 text-sm">
                                <div className="font-medium text-gray-700 dark:text-gray-300">{role.name}</div>
                                {role.description && (
                                  <div className="text-gray-500 dark:text-gray-400">{role.description}</div>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* Summary of assigned roles */}
                {userClientRoles.length > 0 && (
                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900 rounded-md">
                    <h5 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                      Assigned Client Roles ({userClientRoles.length})
                    </h5>
                    <div className="flex flex-wrap gap-2">
                      {userClientRoles.map(roleKey => {
                        const [clientId, roleId] = roleKey.split(':');
                        const client = tenantClients.find(c => c.id === clientId);
                        const role = availableClientRoles.find(r => r.clientId === clientId && r.id === roleId);

                        return (
                          <span key={roleKey} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100">
                            {client?.name}: {role?.name || roleId}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  No client roles available
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Client roles are derived from applications associated with this tenant.
                  <Link href={`/tenants/${tenant_id}`} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 ml-1">
                    Manage tenant applications
                  </Link>
                </p>
              </div>
            )}
          </div>

          {/* Password Reset */}
          {showPasswordReset && (
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Reset Password</h3>
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    New Password
                  </label>
                  <input
                    type="password"
                    id="newPassword"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Enter new password"
                    required
                  />
                </div>
                <div className="flex space-x-3">
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Reset Password
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPasswordReset(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}