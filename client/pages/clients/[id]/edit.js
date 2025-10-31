import { useState, useEffect } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useRouter } from 'next/router';
import Layout from '../../../components/Layout';
import { clientsAPI, tenantsAPI } from '../../../lib/api';

export default function EditClient() {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const { id } = router.query;
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    redirect_uris: [''],
    grant_types: ['authorization_code'],
    scope: 'read',
    tenant_ids: []
  });
  const [tenants, setTenants] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [loadingClient, setLoadingClient] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && id) {
      loadClient();
      if (isAdmin()) {
        loadTenants();
      }
    }
  }, [user, id, isAdmin]);

  const loadClient = async () => {
    try {
      const response = await clientsAPI.getClient(id);
      const client = response.data;
      setFormData({
        name: client.name || '',
        description: client.description || '',
        redirect_uris: client.redirect_uris || [''],
        grant_types: client.grant_types || ['authorization_code'],
        scope: client.scope || 'read',
        tenant_ids: client.tenant_ids || []
      });

    } catch (error) {
      setError('Failed to load client data');
      console.error('Error loading client:', error);
    } finally {
      setLoadingClient(false);
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };


  const handleTenantChange = (tenantId, checked) => {
    setFormData(prev => ({
      ...prev,
      tenant_ids: checked
        ? [...prev.tenant_ids, tenantId]
        : prev.tenant_ids.filter(id => id !== tenantId)
    }));
  };


  const handleGrantTypeChange = (grantType, checked) => {
    setFormData(prev => ({
      ...prev,
      grant_types: checked
        ? [...prev.grant_types, grantType]
        : prev.grant_types.filter(type => type !== grantType)
    }));
  };

  const handleRedirectUriChange = (index, value) => {
    setFormData(prev => ({
      ...prev,
      redirect_uris: prev.redirect_uris.map((uri, i) => i === index ? value : uri)
    }));
  };

  const addRedirectUri = () => {
    setFormData(prev => ({
      ...prev,
      redirect_uris: [...prev.redirect_uris, '']
    }));
  };

  const removeRedirectUri = (index) => {
    if (formData.redirect_uris.length > 1) {
      setFormData(prev => ({
        ...prev,
        redirect_uris: prev.redirect_uris.filter((_, i) => i !== index)
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    console.log('Form submission - Current form data:', formData);
    console.log('Form submission - Selected tenant IDs:', formData.tenant_ids);

    try {
      const clientData = {
        ...formData,
        redirect_uris: formData.redirect_uris.filter(uri => uri.trim() !== '')
      };

      console.log('Sending client data to API:', clientData);

      // Update client basic information
      await clientsAPI.updateClient(id, clientData);

      // Handle tenant associations separately
      try {
        // First, remove all existing associations (clear all)
        const allTenantIds = tenants.map(t => t.id);
        if (allTenantIds.length > 0) {
          await clientsAPI.removeApplicationFromTenants(id, allTenantIds);
        }

        // Add new associations
        if (formData.tenant_ids && formData.tenant_ids.length > 0) {
          await clientsAPI.addApplicationToTenants(id, formData.tenant_ids);
        }
      } catch (tenantError) {
        console.error('Error managing tenant associations:', tenantError);
        // Don't fail the entire operation for tenant association errors
      }

      router.push(`/clients/${id}`);
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to update client');
      console.error('Error updating client:', error);
    } finally {
      setSubmitting(false);
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
          <div className="text-center text-gray-900 dark:text-white">Loading client...</div>
        </div>
      </Layout>
    );
  }

  const grantTypeOptions = [
    { value: 'authorization_code', label: 'Authorization Code' },
    { value: 'client_credentials', label: 'Client Credentials' },
    { value: 'refresh_token', label: 'Refresh Token' },
    { value: 'implicit', label: 'Implicit (deprecated)' },
    { value: 'password', label: 'Resource Owner Password Credentials' }
  ];

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Edit Client Application</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Update your OAuth 2.0 client application settings
          </p>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Basic Information</h3>

            <div className="grid grid-cols-1 gap-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Application Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="My Application"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={3}
                  value={formData.description}
                  onChange={handleChange}
                  className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Brief description of your application"
                />
              </div>

              <div>
                <label htmlFor="scope" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Default Scope *
                </label>
                <input
                  type="text"
                  id="scope"
                  name="scope"
                  required
                  value={formData.scope}
                  onChange={handleChange}
                  className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="read write"
                />
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Space-separated list of scopes (e.g., "read write profile")
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Redirect URIs</h3>
            <div className="space-y-3">
              {formData.redirect_uris.map((uri, index) => (
                <div key={index} className="flex space-x-2">
                  <input
                    type="url"
                    value={uri}
                    onChange={(e) => handleRedirectUriChange(index, e.target.value)}
                    className="flex-1 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="https://example.com/redirect"
                  />
                  <button
                    type="button"
                    onClick={() => removeRedirectUri(index)}
                    disabled={formData.redirect_uris.length === 1}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addRedirectUri}
                className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                + Add another redirect URI
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Grant Types</h3>
            <div className="space-y-2">
              {grantTypeOptions.map((option) => (
                <label key={option.value} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.grant_types.includes(option.value)}
                    onChange={(e) => handleGrantTypeChange(option.value, e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700"
                  />
                  <span className="ml-2 text-sm text-gray-900 dark:text-white">{option.label}</span>
                </label>
              ))}
            </div>
          </div>


          {isAdmin() && (
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Tenant Associations
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Select which tenants this application should be available to. If no tenants are selected, the application will be available to all tenants (global application).
              </p>
              <div className="space-y-3">
                {tenants.map((tenant) => (
                  <label key={tenant.id} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.tenant_ids.includes(tenant.id)}
                      onChange={(e) => handleTenantChange(tenant.id, e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700"
                    />
                    <div className="ml-3">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {tenant.name}
                      </span>
                      {tenant.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">{tenant.description}</p>
                      )}
                    </div>
                  </label>
                ))}
                {tenants.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                    No tenants available. The application will be available globally.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => router.push(`/clients/${id}`)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {submitting ? 'Updating...' : 'Update Client'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}