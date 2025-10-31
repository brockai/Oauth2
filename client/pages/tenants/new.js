import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { tenantsAPI, clientsAPI } from '../../lib/api';

export default function NewTenant() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tenantData, setTenantData] = useState({
    name: '',
    description: '',
    domain: ''
  });
  const [createClient, setCreateClient] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState('');
  const [existingApplications, setExistingApplications] = useState([]);
  const [clientData, setClientData] = useState({
    name: '',
    description: '',
    redirect_uris: [''],
    scope: 'read'
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      loadExistingApplications();
    }
  }, [user]);

  const loadExistingApplications = async () => {
    try {
      const response = await clientsAPI.getClients();
      setExistingApplications(response.data || []);
    } catch (error) {
      console.error('Error loading applications:', error);
    }
  };

  const handleTenantChange = (e) => {
    const { name, value } = e.target;
    setTenantData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleClientChange = (e) => {
    const { name, value } = e.target;
    setClientData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleRedirectUriChange = (index, value) => {
    const newUris = [...clientData.redirect_uris];
    newUris[index] = value;
    setClientData(prev => ({
      ...prev,
      redirect_uris: newUris
    }));
  };

  const addRedirectUri = () => {
    setClientData(prev => ({
      ...prev,
      redirect_uris: [...prev.redirect_uris, '']
    }));
  };

  const removeRedirectUri = (index) => {
    if (clientData.redirect_uris.length > 1) {
      const newUris = clientData.redirect_uris.filter((_, i) => i !== index);
      setClientData(prev => ({
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
      if (!tenantData.name.trim()) {
        throw new Error('Tenant name is required');
      }

      if (createClient) {
        if (!clientData.name.trim()) {
          throw new Error('Application name is required when creating an application');
        }
        const filteredUris = clientData.redirect_uris.filter(uri => uri.trim());
        if (filteredUris.length === 0) {
          throw new Error('At least one redirect URI is required for the application');
        }
      }

      // Create tenant first
      const tenantResponse = await tenantsAPI.createTenant({
        name: tenantData.name.trim(),
        description: tenantData.description.trim() || undefined,
        domain: tenantData.domain.trim() || undefined
      });

      let clientSecret = null;
      let successMessage = 'Tenant created successfully!';
      
      // Create new application if requested
      if (createClient) {
        const filteredUris = clientData.redirect_uris.filter(uri => uri.trim());
        const clientResponse = await clientsAPI.createClient({
          name: clientData.name.trim(),
          description: clientData.description.trim() || undefined,
          redirect_uris: filteredUris,
          scope: clientData.scope.trim() || 'read',
          tenant_ids: [tenantResponse.data.id]
        });
        clientSecret = clientResponse.data.client_secret;
        successMessage = `Tenant and new application created successfully!\n\nClient ID: ${clientResponse.data.client_id}\nClient Secret: ${clientSecret}\n\nPlease save the client secret as it won't be shown again.`;
      }
      
      // Associate with existing application if selected
      if (selectedApplication) {
        await clientsAPI.addApplicationToTenants(selectedApplication, [tenantResponse.data.id]);
        if (!createClient) {
          const appName = existingApplications.find(app => app.id === selectedApplication)?.name || 'application';
          successMessage = `Tenant created and associated with ${appName}!`;
        }
      }
      
      alert(successMessage);
      
      router.push('/tenants');
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Create New Tenant</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Add a new tenant organization</p>
        </div>

        <div className="max-w-4xl">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Tenant Information Section */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Tenant Information</h3>
              <div className="space-y-6">
                <div>
                  <label htmlFor="tenant-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Tenant Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    id="tenant-name"
                    required
                    value={tenantData.name}
                    onChange={handleTenantChange}
                    className="mt-1 block w-full px-3 py-2 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Organization Name"
                  />
                </div>

                <div>
                  <label htmlFor="tenant-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Description
                  </label>
                  <textarea
                    name="description"
                    id="tenant-description"
                    rows={3}
                    value={tenantData.description}
                    onChange={handleTenantChange}
                    className="mt-1 block w-full px-3 py-2 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Optional description of the tenant organization"
                  />
                </div>

                <div>
                  <label htmlFor="tenant-domain" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Domain
                  </label>
                  <input
                    type="text"
                    name="domain"
                    id="tenant-domain"
                    value={tenantData.domain}
                    onChange={handleTenantChange}
                    className="mt-1 block w-full px-3 py-2 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="example.com"
                  />
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Optional domain associated with this tenant
                  </p>
                </div>
              </div>
            </div>

            {/* Application Association Options */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 space-y-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Application Association (Optional)</h3>
              
              {/* Associate existing application */}
              {existingApplications.length > 0 && (
                <div>
                  <label htmlFor="existing-application" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Associate with existing application
                  </label>
                  <select
                    id="existing-application"
                    value={selectedApplication}
                    onChange={(e) => setSelectedApplication(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Select an application (optional)</option>
                    {existingApplications.map((app) => (
                      <option key={app.id} value={app.id}>
                        {app.name} ({app.client_id})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Optionally select an existing application to associate with this tenant
                  </p>
                </div>
              )}
              
              {/* Create new application toggle */}
              <div className={existingApplications.length > 0 ? "border-t border-gray-200 dark:border-gray-700 pt-4" : ""}>
                <div className="flex items-center">
                  <input
                    id="create-client"
                    type="checkbox"
                    checked={createClient}
                    onChange={(e) => setCreateClient(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="create-client" className="ml-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Create a new application for this tenant
                  </label>
                </div>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Optionally create a new OAuth application and associate it with this tenant
                </p>
              </div>
            </div>

            {/* Client Information Section */}
            {createClient && (
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Application</h3>
                <div className="space-y-6">
                  <div>
                    <label htmlFor="client-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Application Name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      id="client-name"
                      required={createClient}
                      value={clientData.name}
                      onChange={handleClientChange}
                      className="mt-1 block w-full px-3 py-2 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="My Application"
                    />
                  </div>

                  <div>
                    <label htmlFor="client-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Application Description
                    </label>
                    <textarea
                      name="description"
                      id="client-description"
                      rows={3}
                      value={clientData.description}
                      onChange={handleClientChange}
                      className="mt-1 block w-full px-3 py-2 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Optional description of your application"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Redirect URIs *
                    </label>
                    {clientData.redirect_uris.map((uri, index) => (
                      <div key={index} className="flex mb-2">
                        <input
                          type="url"
                          value={uri}
                          onChange={(e) => handleRedirectUriChange(index, e.target.value)}
                          placeholder="https://example.com/redirect"
                          className="flex-1 px-3 py-2 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                        {clientData.redirect_uris.length > 1 && (
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
                    <label htmlFor="client-scope" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Scope
                    </label>
                    <input
                      type="text"
                      name="scope"
                      id="client-scope"
                      value={clientData.scope}
                      onChange={handleClientChange}
                      className="mt-1 block w-full px-3 py-2 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="read write"
                    />
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Space-separated list of scopes this client can request
                    </p>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-md">{error}</div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => router.push('/tenants')}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {submitting ? 'Creating...' : (() => {
                  if (createClient && selectedApplication) {
                    return 'Create Tenant, Application & Associate Existing';
                  } else if (createClient) {
                    return 'Create Tenant & Application';
                  } else if (selectedApplication) {
                    return 'Create Tenant & Associate Application';
                  } else {
                    return 'Create Tenant';
                  }
                })()}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}