import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { clientsAPI, tenantsAPI } from '../../lib/api';

export default function NewClient() {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
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
  const [createdClient, setCreatedClient] = useState(null);

  useEffect(() => {
    if (user && isAdmin()) {
      loadTenants();
    }
  }, [user, isAdmin]);

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


  const handleRedirectUriChange = (index, value) => {
    const newUris = [...formData.redirect_uris];
    newUris[index] = value;
    setFormData(prev => ({
      ...prev,
      redirect_uris: newUris
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
      const newUris = formData.redirect_uris.filter((_, i) => i !== index);
      setFormData(prev => ({
        ...prev,
        redirect_uris: newUris
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      // tenant selection is now optional

      const filteredUris = formData.redirect_uris.filter(uri => uri.trim());
      if (filteredUris.length === 0) {
        throw new Error('At least one redirect URI is required');
      }

      const clientData = {
        ...formData,
        redirect_uris: filteredUris
      };

      const response = await clientsAPI.createClient(clientData);
      
      // Show client details on form instead of redirecting
      setCreatedClient({
        client_id: response.data.client_id,
        client_secret: response.data.client_secret,
        name: response.data.name
      });
    } catch (error) {
      setError(error.response?.data?.error || error.message);
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

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Create New Application</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Add a new OAuth 2.0 application</p>
        </div>

        <div className="max-w-2xl">
          {createdClient ? (
            // Show success state with client details
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0">
                  <svg className="h-8 w-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-medium text-green-800 dark:text-green-200">
                    Application Created Successfully!
                  </h3>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Your OAuth 2.0 application "{createdClient.name}" has been created.
                  </p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                    Client ID
                  </label>
                  <div className="flex items-center space-x-2">
                    <code className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-green-300 dark:border-green-600 rounded-md text-sm font-mono text-gray-900 dark:text-white">
                      {createdClient.client_id}
                    </code>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(createdClient.client_id)}
                      className="px-3 py-2 text-sm text-green-700 dark:text-green-300 hover:text-green-900 dark:hover:text-green-100"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                    Client Secret
                  </label>
                  <div className="flex items-center space-x-2">
                    <code className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-green-300 dark:border-green-600 rounded-md text-sm font-mono text-gray-900 dark:text-white">
                      {createdClient.client_secret}
                    </code>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(createdClient.client_secret)}
                      className="px-3 py-2 text-sm text-green-700 dark:text-green-300 hover:text-green-900 dark:hover:text-green-100"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="mt-2 text-sm text-green-700 dark:text-green-300 font-medium">
                    ⚠️ Please save this client secret as it won't be shown again.
                  </p>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setCreatedClient(null)}
                  className="px-4 py-2 text-sm font-medium text-green-700 dark:text-green-300 bg-white dark:bg-gray-700 border border-green-300 dark:border-green-600 rounded-md hover:bg-green-50 dark:hover:bg-green-900/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  Create Another
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/clients')}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  View All Applications
                </button>
              </div>
            </div>
          ) : (
            // Show creation form
            <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Name *
              </label>
              <input
                type="text"
                name="name"
                id="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="My Application"
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Description
              </label>
              <textarea
                name="description"
                id="description"
                rows={3}
                value={formData.description}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Optional description of your application"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Redirect URIs *
              </label>
              {formData.redirect_uris.map((uri, index) => (
                <div key={index} className="flex mb-2">
                  <input
                    type="url"
                    value={uri}
                    onChange={(e) => handleRedirectUriChange(index, e.target.value)}
                    placeholder="https://example.com/redirect"
                    className="flex-1 px-3 py-2 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  {formData.redirect_uris.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRedirectUri(index)}
                      className="ml-2 px-3 py-2 text-sm text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addRedirectUri}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800"
              >
                + Add another redirect URI
              </button>
            </div>

            <div>
              <label htmlFor="scope" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Scope
              </label>
              <input
                type="text"
                name="scope"
                id="scope"
                value={formData.scope}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="read write"
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Space-separated list of scopes this client can request
              </p>
            </div>

            {isAdmin() && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Associated Tenants
                </label>
                <div className="space-y-3">
                  {tenants.map((tenant) => (
                    <div key={tenant.id} className="relative flex items-start">
                      <div className="flex items-center h-5">
                        <input
                          id={`tenant-${tenant.id}`}
                          type="checkbox"
                          checked={formData.tenant_ids.includes(tenant.id)}
                          onChange={(e) => handleTenantChange(tenant.id, e.target.checked)}
                          className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                        />
                      </div>
                      <div className="ml-3 text-sm">
                        <label htmlFor={`tenant-${tenant.id}`} className="font-medium text-gray-700 dark:text-gray-300">
                          {tenant.name}
                        </label>
                        {tenant.description && (
                          <p className="text-gray-500 dark:text-gray-400">{tenant.description}</p>
                        )}
                        {tenant.domain && (
                          <p className="text-gray-500 dark:text-gray-400 text-xs">Domain: {tenant.domain}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Select which tenants this application will be available to. Leave empty to create a standalone application.
                </p>
              </div>
            )}


            {error && (
              <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-md">{error}</div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => router.push('/clients')}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {submitting ? 'Creating...' : 'Create Application'}
              </button>
            </div>
          </form>
          )}
        </div>
      </div>
    </Layout>
  );
}