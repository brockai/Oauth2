import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../../components/Layout';
import { tenantUsersAPI, tenantsAPI, adminAPI } from '../../lib/api';

export default function UsersIndex() {
  const { user, loading, isTenantUser } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [superAdmins, setSuperAdmins] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingSuperAdmins, setLoadingSuperAdmins] = useState(true);
  const [selectedTenant, setSelectedTenant] = useState('');
  const [activeTab, setActiveTab] = useState('tenant-admins');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      if (isTenantUser()) {
        // Tenant users only see their own tenant's users
        loadTenantUsers();
      } else {
        // Admin users see all users across all tenants
        loadTenants();
        loadAllUsers();
        loadSuperAdmins();
      }
    }
  }, [user]);

  const loadTenants = async () => {
    try {
      const response = await tenantsAPI.getTenants();
      setTenants(response.data);
    } catch (error) {
      console.error('Error loading tenants:', error);
    }
  };

  const loadAllUsers = async () => {
    try {
      setLoadingUsers(true);
      const response = await tenantsAPI.getTenants();
      const allTenants = response.data;

      const allUsersPromises = allTenants.map(async (tenant) => {
        try {
          const userResponse = await tenantUsersAPI.getTenantUsers(tenant.id);
          return userResponse.data.map(user => ({
            ...user,
            tenant_name: tenant.name,
            tenant_id: tenant.id
          }));
        } catch (error) {
          console.error(`Error loading users for tenant ${tenant.id}:`, error);
          return [];
        }
      });

      const userArrays = await Promise.all(allUsersPromises);
      const allUsers = userArrays.flat();

      setUsers(allUsers);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadSuperAdmins = async () => {
    try {
      setLoadingSuperAdmins(true);
      const response = await adminAPI.getSuperAdmins();
      setSuperAdmins(response.data);
    } catch (error) {
      console.error('Error loading super admins:', error);
    } finally {
      setLoadingSuperAdmins(false);
    }
  };

  const loadTenantUsers = async () => {
    try {
      setLoadingUsers(true);
      // For tenant users, just load their own users without tenant ID
      const response = await tenantUsersAPI.getTenantUsers();
      const usersWithTenantInfo = response.data.map(user => ({
        ...user,
        tenant_name: user.tenant_name || 'Current Tenant', // Backend should provide this
        tenant_id: user.tenant_id || user.tenant_id // Backend should provide this
      }));
      setUsers(usersWithTenantInfo);
    } catch (error) {
      console.error('Error loading tenant users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const filteredUsers = selectedTenant 
    ? users.filter(user => user.tenant_id === selectedTenant)
    : users;

  const toggleUserStatus = async (tenantId, userId, currentStatus) => {
    try {
      await tenantUsersAPI.updateTenantUser(tenantId, userId, { is_active: !currentStatus });
      setUsers(users.map(u => 
        u.id === userId ? { ...u, is_active: !currentStatus } : u
      ));
    } catch (error) {
      alert('Error updating user status: ' + (error.response?.data?.error || error.message));
    }
  };

  const deleteUser = async (tenantId, userId, username) => {
    if (window.confirm(`Are you sure you want to delete user "${username}"?`)) {
      try {
        await tenantUsersAPI.deleteTenantUser(tenantId, userId);
        setUsers(users.filter(u => u.id !== userId));
      } catch (error) {
        alert('Error deleting user: ' + (error.response?.data?.error || error.message));
      }
    }
  };

  const deleteSystemAdmin = async (adminId, username) => {
    if (window.confirm(`Are you sure you want to delete system admin "${username}"?`)) {
      try {
        await adminAPI.deleteSuperAdmin(adminId);
        setSuperAdmins(superAdmins.filter(a => a.id !== adminId));
      } catch (error) {
        alert('Error deleting system admin: ' + (error.response?.data?.error || error.message));
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

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {isTenantUser() ? 'Tenant Users' : 'All Users'}
              </h1>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                {isTenantUser()
                  ? 'Manage users in your tenant'
                  : 'Manage users across all tenants'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Tabs - Only show for admin users */}
        {!isTenantUser() && (
          <div className="mb-6">
            <div className="border-b border-gray-200 dark:border-gray-700">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setActiveTab('tenant-admins')}
                  className={`${
                    activeTab === 'tenant-admins'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  Tenant Users
                  {!loadingUsers && (
                    <span className="ml-2 py-0.5 px-2 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-300">
                      {users.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('super-admins')}
                  className={`${
                    activeTab === 'super-admins'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  System Admins
                  {!loadingSuperAdmins && (
                    <span className="ml-2 py-0.5 px-2 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-300">
                      {superAdmins.length}
                    </span>
                  )}
                </button>
              </nav>
            </div>
          </div>
        )}

        {/* Filters - Only show for admin users on tenant-admins tab */}
        {!isTenantUser() && activeTab === 'tenant-admins' && (
          <div className="mb-6 flex items-center space-x-4">
            <div>
              <label htmlFor="tenant-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Filter by Tenant
              </label>
              <select
                id="tenant-filter"
                value={selectedTenant}
                onChange={(e) => setSelectedTenant(e.target.value)}
                className="block w-48 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">All Tenants</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 pt-6">
              Showing {filteredUsers.length} of {users.length} users
            </div>
          </div>
        )}

        {/* User count for tenant users */}
        {isTenantUser() && (
          <div className="mb-6 text-sm text-gray-500 dark:text-gray-400">
            Showing {users.length} users
          </div>
        )}

        {/* Users List */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          {/* Super Admins Tab Content */}
          {activeTab === 'super-admins' && !isTenantUser() ? (
            loadingSuperAdmins ? (
              <div className="p-8 text-center">
                <div className="text-gray-500 dark:text-gray-400">Loading system admins...</div>
              </div>
            ) : superAdmins.length > 0 ? (
              <div className="overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Username
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Admin
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Created At
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Updated At
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {superAdmins.map((admin) => (
                      <tr key={admin.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {admin.username}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            admin.is_admin
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-100'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                            {admin.is_admin ? 'System Admin' : 'User'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {new Date(admin.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {admin.updated_at ? new Date(admin.updated_at).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                          <Link
                            href={`/system-admins/${admin.id}`}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            View
                          </Link>
                          {admin.username !== 'admin' && (
                            <button
                              onClick={() => deleteSystemAdmin(admin.id, admin.username)}
                              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                            >
                              Delete
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center">
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No system admins found</h3>
              </div>
            )
          ) : loadingUsers ? (
            <div className="p-8 text-center">
              <div className="text-gray-500 dark:text-gray-400">Loading users...</div>
            </div>
          ) : (isTenantUser() ? users : filteredUsers).length > 0 ? (
            <div className="overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      User
                    </th>
                    {!isTenantUser() && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Tenant
                      </th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Last Login
                    </th>
                    {!isTenantUser() && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {(isTenantUser() ? users : filteredUsers).map((user) => (
                    <tr key={`${user.tenant_id}-${user.id}`} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {user.username}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {user.email}
                            </div>
                            {(user.first_name || user.last_name) && (
                              <div className="text-xs text-gray-400 dark:text-gray-500">
                                {user.first_name} {user.last_name}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      {!isTenantUser() && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Link
                            href={`/tenants/${user.tenant_id}`}
                            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            {user.tenant_name}
                          </Link>
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          user.is_admin
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-100'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {user.is_admin ? 'Admin' : 'User'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => toggleUserStatus(user.tenant_id, user.id, user.is_active)}
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            user.is_active
                              ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
                              : 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                          }`}
                        >
                          {user.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {user.last_login_at
                          ? new Date(user.last_login_at).toLocaleDateString()
                          : 'Never'
                        }
                      </td>
                      {!isTenantUser() && (
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                          <Link
                            href={`/tenants/${user.tenant_id}/users/${user.id}`}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            View
                          </Link>
                          <button
                            onClick={() => deleteUser(user.tenant_id, user.id, user.username)}
                            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                          >
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center">
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No tenant users found</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {selectedTenant
                  ? 'No users found for the selected tenant.'
                  : 'Get started by creating a tenant and adding users to it.'
                }
              </p>
              <div className="mt-6">
                <Link
                  href="/tenants"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Go to Tenants
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}