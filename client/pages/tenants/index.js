import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../../components/Layout';
import { tenantsAPI } from '../../lib/api';

export default function Tenants() {
  const { user, loading, isTenantUser, getTenantId } = useAuth();
  const router = useRouter();
  const [tenants, setTenants] = useState([]);
  const [loadingTenants, setLoadingTenants] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      loadTenants();
    }
  }, [user]);

  const loadTenants = async () => {
    try {
      const response = await tenantsAPI.getTenants();
      let tenantsData = response.data;

      // For tenant users, filter to only show their own tenant
      if (isTenantUser()) {
        const userTenantId = getTenantId();
        tenantsData = tenantsData.filter(tenant => tenant.id === userTenantId);
      }

      setTenants(tenantsData);
    } catch (error) {
      console.error('Error loading tenants:', error);
    } finally {
      setLoadingTenants(false);
    }
  };

  const handleDelete = async (tenantId, tenantName) => {
    if (window.confirm(`Are you sure you want to delete "${tenantName}"?`)) {
      try {
        await tenantsAPI.deleteTenant(tenantId);
        setTenants(tenants.filter(t => t.id !== tenantId));
      } catch (error) {
        alert('Error deleting tenant: ' + (error.response?.data?.error || error.message));
      }
    }
  };

  const toggleStatus = async (tenantId, currentStatus) => {
    try {
      await tenantsAPI.updateTenant(tenantId, { is_active: !currentStatus });
      setTenants(tenants.map(t => 
        t.id === tenantId ? { ...t, is_active: !currentStatus } : t
      ));
    } catch (error) {
      alert('Error updating tenant: ' + (error.response?.data?.error || error.message));
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
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Tenants</h1>
            <p className="mt-2 text-sm text-gray-700 dark:text-gray-400">
              Manage your multi-tenant organizations
            </p>
          </div>
          {!isTenantUser() && (
            <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
              <Link
                href="/tenants/new"
                className="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Add Tenant
              </Link>
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-col">
          <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
              <div className="overflow-hidden shadow ring-1 ring-black dark:ring-gray-600 ring-opacity-5 md:rounded-lg">
                {loadingTenants ? (
                  <div className="text-center py-12 text-gray-900 dark:text-white">Loading tenants...</div>
                ) : tenants.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500 dark:text-gray-400">No tenants found</p>
                    {!isTenantUser() && (
                      <Link
                        href="/tenants/new"
                        className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-600 bg-blue-100 hover:bg-blue-200"
                      >
                        Create your first tenant
                      </Link>
                    )}
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Tenant ID
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Domain
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Created
                        </th>
                        <th className="relative px-6 py-3">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {tenants.map((tenant) => (
                        <tr key={tenant.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {tenant.name}
                              </div>
                              {tenant.description && (
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                  {tenant.description}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-mono text-gray-900 dark:text-white">
                              {tenant.id}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 dark:text-white">
                              {tenant.domain || '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => toggleStatus(tenant.id, tenant.is_active)}
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                tenant.is_active
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {tenant.is_active ? 'Active' : 'Inactive'}
                            </button>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {new Date(tenant.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <Link
                              href={`/tenants/${tenant.id}`}
                              className="text-blue-600 hover:text-blue-900 mr-4"
                            >
                              View
                            </Link>
                            <Link
                              href={`/clients?tenant_id=${tenant.id}`}
                              className="text-blue-600 hover:text-blue-900 mr-4"
                            >
                              Applications
                            </Link>
                            {!isTenantUser() && (
                              <button
                                onClick={() => handleDelete(tenant.id, tenant.name)}
                                className="text-red-600 hover:text-red-900"
                              >
                                Delete
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}