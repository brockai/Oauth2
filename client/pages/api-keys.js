import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { apiKeysAPI } from '../lib/api';

export default function ApiKeys() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [apiKeys, setApiKeys] = useState([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [newKeyData, setNewKeyData] = useState({ name: '', type: 'api_key' });
  const [showNewKey, setShowNewKey] = useState(null);
  const [bearerToken, setBearerToken] = useState(null);
  const [generatingBearer, setGeneratingBearer] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      loadApiKeys();
    }
  }, [user]);

  const loadApiKeys = async () => {
    try {
      const response = await apiKeysAPI.getApiKeys();
      setApiKeys(response.data);
    } catch (error) {
      console.error('Error loading API keys:', error);
    } finally {
      setLoadingKeys(false);
    }
  };

  const generateKey = async () => {
    setGeneratingKey(true);
    try {
      const response = await apiKeysAPI.generateNewKey(newKeyData);
      setShowNewKey(response.data);
      setNewKeyData({ name: '', type: 'api_key' });
      // Reload keys to show the updated environment-based keys
      await loadApiKeys();
    } catch (error) {
      console.error('Error generating API key:', error);
      alert('Error generating API key');
    } finally {
      setGeneratingKey(false);
    }
  };

  const copyApiKey = async (keyId) => {
    try {
      const response = await apiKeysAPI.getApiKeyValue(keyId);
      await navigator.clipboard.writeText(response.data.key);
      // Optional: Show a toast notification
      alert('API key copied to clipboard!');
    } catch (error) {
      console.error('Error copying API key:', error);
      alert('Error copying API key');
    }
  };

  const generateBearerToken = async () => {
    setGeneratingBearer(true);
    try {
      // Get current user's token (which is already a Bearer token)
      const token = localStorage.getItem('token');
      if (token) {
        setBearerToken(token);
        alert('Current Bearer token retrieved! Use this in Swagger docs.');
      } else {
        alert('No Bearer token found. Please log in again.');
      }
    } catch (error) {
      console.error('Error getting Bearer token:', error);
      alert('Error getting Bearer token');
    } finally {
      setGeneratingBearer(false);
    }
  };

  const copyBearerToken = async () => {
    if (bearerToken) {
      await navigator.clipboard.writeText(bearerToken);
      alert('Bearer token copied to clipboard!');
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">API Keys</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Generate and manage API keys and admin tokens for accessing the OAuth 2.0 server
          </p>
        </div>

        {/* Generate Bearer Token Section */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg mb-6">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
              🔐 Generate Bearer Token for Swagger Testing
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Get your current JWT Bearer token for testing protected endpoints in Swagger docs
            </p>
          </div>
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Use this token in <a href="http://localhost:3000/api-docs/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-500">Swagger docs</a> to test protected API endpoints.
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  This is your current JWT session token - different from API keys below.
                </p>
              </div>
              <button
                onClick={generateBearerToken}
                disabled={generatingBearer}
                className="ml-4 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
              >
                {generatingBearer ? 'Getting Token...' : 'Get Bearer Token'}
              </button>
            </div>
            
            {bearerToken && (
              <div className="mt-4 p-4 bg-green-50 dark:bg-green-900 rounded-md">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3 flex-1">
                    <h3 className="text-sm font-medium text-green-800 dark:text-green-200">
                      Bearer Token Ready!
                    </h3>
                    <div className="mt-2 text-sm text-green-700 dark:text-green-300">
                      <p className="mb-2">Copy this token and paste it into Swagger's "Authorize" dialog:</p>
                      <div className="bg-white dark:bg-gray-800 p-3 rounded border font-mono text-xs break-all">
                        {bearerToken}
                      </div>
                    </div>
                    <div className="mt-3 flex space-x-3">
                      <button
                        onClick={copyBearerToken}
                        className="text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1 hover:bg-gray-50 dark:hover:bg-gray-600"
                      >
                        Copy Token
                      </button>
                      <a
                        href="http://localhost:3000/api-docs/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md px-3 py-1"
                      >
                        Open Swagger
                      </a>
                      <button
                        onClick={() => setBearerToken(null)}
                        className="text-sm text-green-700 dark:text-green-300 hover:text-green-600 dark:hover:text-green-400"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Generate New Key Form */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg mb-8">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">
              Generate New API Key
            </h3>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-1">
              <div>
                <label htmlFor="keyType" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Key Type
                </label>
                <select
                  id="keyType"
                  value={newKeyData.type}
                  onChange={(e) => setNewKeyData({ ...newKeyData, type: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                >
                  <option value="api_key">API Key</option>
                  <option value="admin_token">Admin Token</option>
                </select>
              </div>
            </div>
            <div className="mt-4">
              <button
                onClick={generateKey}
                disabled={generatingKey}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {generatingKey ? 'Generating...' : 'Generate New Key'}
              </button>
            </div>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Generated keys will be automatically saved to your server's .env file.
            </p>
          </div>
        </div>

        {/* New Key Display */}
        {showNewKey && (
          <div className="bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 rounded-lg p-4 mb-8">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-medium text-green-800 dark:text-green-200">
                  {showNewKey.type === 'admin_token' ? 'Admin Token' : 'API Key'} Generated Successfully!
                </h3>
                <div className="mt-2 text-sm text-green-700 dark:text-green-300">
                  <p className="mb-2">{showNewKey.message}</p>
                  <p className="mb-2 font-semibold">Status:</p>
                  <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded border">
                    {showNewKey.status}
                  </div>
                  <p className="mt-2 mb-2 font-semibold">Generated Key:</p>
                  <div className="bg-white dark:bg-gray-800 p-3 rounded border font-mono text-xs break-all">
                    {showNewKey.key}
                  </div>
                  <p className="mt-2 text-xs text-green-600 dark:text-green-400">
                    Environment variable {showNewKey.envVar} has been automatically updated in your .env file.
                  </p>
                </div>
                <div className="mt-3 flex space-x-3">
                  <button
                    onClick={() => navigator.clipboard.writeText(showNewKey.key)}
                    className="text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1 hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    Copy Key
                  </button>
                  <button
                    onClick={() => setShowNewKey(null)}
                    className="text-sm text-green-700 dark:text-green-300 hover:text-green-600 dark:hover:text-green-400"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* API Keys List */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">
              Existing API Keys
            </h3>
            
            {loadingKeys ? (
              <div className="text-center py-4">
                <div className="text-gray-500 dark:text-gray-400">Loading API keys...</div>
              </div>
            ) : apiKeys.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Key Preview
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {apiKeys.map((key) => (
                      <tr key={key.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          {key.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            key.type === 'admin_token'
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-100'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100'
                          }`}>
                            {key.type === 'admin_token' ? 'Admin Token' : 'API Key'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">
                          {key.key_preview || `${key.id.substring(0, 8)}...`}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {key.source === 'environment' ? key.created_at : new Date(key.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            key.is_active
                              ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
                              : 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                          }`}>
                            {key.is_active ? 'Active' : 'Revoked'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => copyApiKey(key.id)}
                              className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                              title="Copy full API key"
                            >
                              Copy
                            </button>
                            {key.source === 'environment' ? (
                              <span className="text-gray-400 dark:text-gray-600">Environment Variable</span>
                            ) : (
                              key.is_active && (
                                <button
                                  onClick={() => revokeKey(key.id)}
                                  className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                >
                                  Revoke
                                </button>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 48 48">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012-2h14a2 2 0 012 2v0a2 2 0 01-2 2H17a2 2 0 01-2-2v0zM15 7v4a2 2 0 002 2h14a2 2 0 002-2V7M9 20h30" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No API keys</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Get started by creating your first API key.</p>
              </div>
            )}
          </div>
        </div>

        {/* Usage Information */}
        <div className="mt-8 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                API Key Usage
              </h3>
              <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>API Keys:</strong> Use for general API access with standard permissions</li>
                  <li><strong>Admin Tokens:</strong> Use for administrative operations and full system access</li>
                  <li>Include your key in the Authorization header: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">Authorization: Bearer YOUR_API_KEY</code></li>
                  <li>Keys cannot be recovered once dismissed - store them securely</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}