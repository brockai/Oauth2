import { useState, useEffect } from 'react';
import { useAuth } from '../../../../hooks/useAuth';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../../../../components/Layout';
import { tenantUsersAPI, tenantsAPI } from '../../../../lib/api';

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

  useEffect(() => {
    if (!loading && !currentUser) {
      router.push('/login');
    }
  }, [currentUser, loading, router]);

  useEffect(() => {
    if (currentUser && tenant_id && user_id) {
      loadTenant();
      loadUser();
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
    } catch (error) {
      setError('User not found');
      console.error('Error loading user:', error);
    } finally {
      setLoadingUser(false);
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

  const toggleEmailVerified = async () => {
    try {
      await tenantUsersAPI.updateTenantUser(tenant_id, user_id, { email_verified: !user.email_verified });
      setUser({ ...user, email_verified: !user.email_verified });
    } catch (error) {
      alert('Error updating email verification status: ' + (error.response?.data?.error || error.message));
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
    if (window.confirm(`Are you sure you want to delete user "${user.username}"? This action is irreversible. Would you like to continue?`)) {
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
                <dd className="mt-1 flex items-center space-x-2">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    user.email_verified
                      ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
                      : 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                  }`}>
                    {user.email_verified ? 'Yes' : 'No'}
                  </span>
                  <button
                    onClick={toggleEmailVerified}
                    className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    {user.email_verified ? 'Mark Unverified' : 'Mark Verified'}
                  </button>
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