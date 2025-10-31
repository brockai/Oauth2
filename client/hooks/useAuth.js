import { useState, useEffect, createContext, useContext } from 'react';
import { authAPI } from '../lib/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      authAPI.getMe()
        .then(response => {
          setUser(response.data);
        })
        .catch(() => {
          localStorage.removeItem('token');
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (credentials) => {
    const response = await authAPI.login(credentials);
    const { token, user } = response.data;

    localStorage.setItem('token', token);
    setUser(user);

    return response.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
  };

  // Helper functions to determine user type and permissions
  const isAdmin = () => {
    return user?.user_type === 'admin' && user?.is_admin === true;
  };

  const isTenantUser = () => {
    return user?.user_type === 'tenant';
  };

  const isTenantAdmin = () => {
    return user?.user_type === 'tenant' && user?.is_admin === true;
  };

  const hasAdminAccess = () => {
    return isAdmin() || isTenantAdmin();
  };

  const getTenantId = () => {
    return user?.tenant_id || null;
  };

  const getApiBasePath = () => {
    // Return the base path for API calls based on user type
    if (isAdmin()) {
      return '/admin';
    } else if (isTenantUser()) {
      return '/tenant';
    }
    return '/admin'; // Default to admin for backward compatibility
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      updateUser,
      loading,
      isAdmin,
      isTenantUser,
      isTenantAdmin,
      hasAdminAccess,
      getTenantId,
      getApiBasePath
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};