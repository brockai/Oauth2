import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../../components/Layout';
import { clientsAPI, tenantsAPI } from '../../lib/api';

export default function Clients() {
  const { user, loading, isTenantUser, getTenantId } = useAuth();
  const router = useRouter();
  const [clients, setClients] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [selectedTenant, setSelectedTenant] = useState('');
  const [loadingClients, setLoadingClients] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      // For tenant users, set their tenant ID as default and only option
      if (isTenantUser()) {
        const userTenantId = getTenantId();
        setSelectedTenant(userTenantId ? userTenantId.toString() : '');
        setTenants([]);
      } else {
        loadTenants();
      }
      loadClients();
    }
  }, [user]);

  useEffect(() => {
    // Check for tenant_id from URL query (only for non-tenant users)
    if (!isTenantUser()) {
      const { tenant_id } = router.query;
      if (tenant_id) {
        setSelectedTenant(tenant_id);
      }
    }
  }, [router.query]);

  useEffect(() => {
    if (user && selectedTenant !== undefined) {
      loadClients();
    }
  }, [user, selectedTenant]);

  const loadTenants = async () => {
    try {
      const response = await tenantsAPI.getTenants();
      setTenants(response.data);
    } catch (error) {
      console.error('Error loading tenants:', error);
    }
  };

  const loadClients = async () => {
    try {
      // For tenant users, always filter by their tenant ID
      const tenantFilter = isTenantUser() ? getTenantId() : (selectedTenant || undefined);
      const response = await clientsAPI.getClients(tenantFilter);
      setClients(response.data);
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoadingClients(false);
    }
  };

  const handleDelete = async (clientId, clientName) => {
    if (window.confirm(`Are you sure you want to delete "${clientName}"?`)) {
      try {
        await clientsAPI.deleteClient(clientId);
        setClients(clients.filter(c => c.id !== clientId));
      } catch (error) {
        alert('Error deleting client: ' + (error.response?.data?.error || error.message));
      }
    }
  };

  const toggleStatus = async (clientId, currentStatus) => {
    try {
      await clientsAPI.updateClient(clientId, { is_active: !currentStatus });
      setClients(clients.map(c => 
        c.id === clientId ? { ...c, is_active: !currentStatus } : c
      ));
    } catch (error) {
      alert('Error updating client: ' + (error.response?.data?.error || error.message));
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        {!isTenantUser() && (
          <div className="mb-6">
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <label htmlFor="tenant-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Filter by Tenant
                </label>
                <select
                  id="tenant-filter"
                  value={selectedTenant}
                  onChange={(e) => setSelectedTenant(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">All Tenants</option>
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">OAuth Applications</h1>
            <p className="mt-2 text-sm text-gray-700 dark:text-gray-400">
              Manage your OAuth 2.0 applications
            </p>
          </div>
          <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
            <Link
              href="/clients/new"
              className="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Add Application
            </Link>
          </div>
        </div>

        <div className="mt-8 flex flex-col">
          <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
              <div className="overflow-hidden shadow ring-1 ring-black dark:ring-gray-600 ring-opacity-5 md:rounded-lg">
                {loadingClients ? (
                  <div className="text-center py-12 text-gray-900 dark:text-white">Loading applications...</div>
                ) : clients.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500 dark:text-gray-400">No applications found</p>
                    <Link
                      href="/clients/new"
                      className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-600 bg-blue-100 hover:bg-blue-200"
                    >
                      Create your first application
                    </Link>
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-gray-300">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Client ID
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Tenants
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
                      {clients.map((client) => (
                        <tr key={client.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {client.name}
                              </div>
                              {client.description && (
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                  {client.description}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 dark:text-white font-mono">
                              {client.client_id}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 dark:text-white">
                              {client.tenant_names && client.tenant_names.length > 0 ? (
                                <div className="space-y-1">
                                  {client.tenant_names.slice(0, 2).map((name, index) => (
                                    <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100">
                                      {name}
                                    </span>
                                  ))}
                                  {client.tenant_names.length > 2 && (
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                      +{client.tenant_names.length - 2} more
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-500 dark:text-gray-400 italic">No tenants</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => toggleStatus(client.id, client.is_active)}
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                client.is_active
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {client.is_active ? 'Active' : 'Inactive'}
                            </button>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {new Date(client.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <Link
                              href={`/clients/${client.id}`}
                              className="text-blue-600 hover:text-blue-900 mr-4"
                            >
                              View
                            </Link>
                            <Link
                              href={`/clients/${client.id}/edit`}
                              className="text-blue-600 hover:text-blue-900 mr-4"
                            >
                              Edit
                            </Link>
                            <button
                              onClick={() => handleDelete(client.id, client.name)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Delete
                            </button>
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