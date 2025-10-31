import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../../components/Layout';
import { clientsAPI, tenantsAPI } from '../../lib/api';

export default function ClientDetail() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { id } = router.query;
  const [client, setClient] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [stats, setStats] = useState(null);
  const [loadingClient, setLoadingClient] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && id) {
      loadClient();
      loadStats();
      loadTenants();
    }
  }, [user, id]);

  const loadClient = async () => {
    try {
      const response = await clientsAPI.getClient(id);
      setClient(response.data);
    } catch (error) {
      setError('Application not found');
      console.error('Error loading client:', error);
    } finally {
      setLoadingClient(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await clientsAPI.getClientStats(id);
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadTenants = async () => {
    try {
      const response = await tenantsAPI.getTenants();
      setTenants(response.data);
    } catch (error) {
      console.error('Error loading tenants:', error);
    }
  };

  const regenerateSecret = async () => {
    if (window.confirm('Are you sure you want to regenerate the client secret? This will invalidate the current secret.')) {
      try {
        const response = await clientsAPI.regenerateSecret(id);
        alert(`New client secret: ${response.data.client_secret}\n\nPlease save this secret as it won't be shown again.`);
        loadClient(); // Refresh client data
      } catch (error) {
        alert('Error regenerating secret: ' + (error.response?.data?.error || error.message));
      }
    }
  };

  const toggleStatus = async () => {
    try {
      await clientsAPI.updateClient(id, { is_active: !client.is_active });
      setClient({ ...client, is_active: !client.is_active });
    } catch (error) {
      alert('Error updating status: ' + (error.response?.data?.error || error.message));
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-gray-900 dark:text-white">Loading...</div>
      </div>
    );
  }

  if (loadingClient) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center text-gray-900 dark:text-white">Loading application...</div>
        </div>
      </Layout>
    );
  }

  if (error || !client) {
    return (
      <Layout>
        <div className="px-4 py-6 sm:px-0">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 dark:text-red-400">Application Not Found</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">The requested application could not be found.</p>
            <Link
              href="/clients"
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-600 bg-blue-100 hover:bg-blue-200"
            >
              Back to Applications
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
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{client.name}</h1>
              <p className="mt-2 text-gray-600 dark:text-gray-400">OAuth 2.0 Application Details</p>
            </div>
            <div className="flex space-x-3">
              <Link
                href={`/clients/${id}/edit`}
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Edit
              </Link>
              <button
                onClick={toggleStatus}
                className={`inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                  client.is_active 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {client.is_active ? 'Deactivate' : 'Activate'}
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
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">{client.name}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</dt>
                <dd className="mt-1">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    client.is_active
                      ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
                      : 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                  }`}>
                    {client.is_active ? 'Active' : 'Inactive'}
                  </span>
                </dd>
              </div>
              {client.description && (
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Description</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">{client.description}</dd>
                </div>
              )}
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Created</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                  {new Date(client.created_at).toLocaleDateString()}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Updated</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                  {new Date(client.updated_at).toLocaleDateString()}
                </dd>
              </div>
            </dl>
          </div>

          {/* Client Credentials */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Client Credentials</h3>
              <button
                onClick={regenerateSecret}
                className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
              >
                Regenerate Secret
              </button>
            </div>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Client ID</dt>
                <dd className="mt-1 flex items-center space-x-2">
                  <code className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-sm font-mono text-gray-900 dark:text-white">
                    {client.client_id}
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText(client.client_id)}
                    className="px-3 py-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Copy
                  </button>
                </dd>
              </div>
            </dl>
          </div>

          {/* Configuration */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Configuration</h3>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Redirect URIs</dt>
                <dd className="mt-1 space-y-1">
                  {client.redirect_uris.map((uri, index) => (
                    <code key={index} className="block px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-sm font-mono text-gray-900 dark:text-white">
                      {uri}
                    </code>
                  ))}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Grant Types</dt>
                <dd className="mt-1">
                  {client.grant_types.map((type, index) => (
                    <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100 mr-2">
                      {type}
                    </span>
                  ))}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Scope</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">{client.scope}</dd>
              </div>
            </dl>
          </div>


          {/* Associated Tenants */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Associated Tenants</h3>
            {client.tenant_names && client.tenant_names.length > 0 ? (
              <div className="space-y-2">
                {client.tenant_names.map((tenantName, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                    <span className="text-sm text-gray-900 dark:text-white">{tenantName}</span>
                    <Link
                      href={`/tenants/${client.tenant_ids[index]}`}
                      className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      View Tenant
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                This application is not associated with any tenants (standalone application)
              </p>
            )}
          </div>

          {/* Usage Statistics */}
          {stats && (
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Usage Statistics</h3>
              <dl className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <div className="px-4 py-5 bg-gray-50 dark:bg-gray-700 overflow-hidden rounded-lg">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Total Tokens</dt>
                  <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">{stats.total_tokens}</dd>
                </div>
                <div className="px-4 py-5 bg-gray-50 dark:bg-gray-700 overflow-hidden rounded-lg">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Active Tokens</dt>
                  <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">{stats.active_tokens}</dd>
                </div>
                <div className="px-4 py-5 bg-gray-50 dark:bg-gray-700 overflow-hidden rounded-lg">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Auth Codes</dt>
                  <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">{stats.total_authorization_codes}</dd>
                </div>
              </dl>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}