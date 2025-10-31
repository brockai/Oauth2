const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const getApiKeys = async (req, res) => {
  try {
    const keys = [];
    
    // Check if API_KEY exists
    if (process.env.API_KEY) {
      keys.push({
        id: 'env_api_key',
        name: 'Environment API Key',
        key_preview: `${process.env.API_KEY.substring(0, 8)}...${process.env.API_KEY.substring(process.env.API_KEY.length - 4)}`,
        type: 'api_key',
        is_active: true,
        created_at: 'Set via environment variable',
        source: 'environment'
      });
    }
    
    // Check if ADMIN_TOKEN exists
    if (process.env.ADMIN_TOKEN) {
      keys.push({
        id: 'env_admin_token',
        name: 'Environment Admin Token',
        key_preview: `${process.env.ADMIN_TOKEN.substring(0, 8)}...${process.env.ADMIN_TOKEN.substring(process.env.ADMIN_TOKEN.length - 4)}`,
        type: 'admin_token',
        is_active: true,
        created_at: 'Set via environment variable',
        source: 'environment'
      });
    }
    
    res.json(keys);
  } catch (error) {
    console.error('Error fetching API keys:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateEnvFile = (envVar, newValue) => {
  try {
    const envPath = path.join(__dirname, '..', '.env');
    let envContent = '';
    
    // Read existing .env file if it exists
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // Parse existing environment variables
    const envLines = envContent.split('\n');
    let found = false;
    
    // Update existing variable or add comment if not found
    for (let i = 0; i < envLines.length; i++) {
      const line = envLines[i].trim();
      if (line.startsWith(`${envVar}=`) || line.startsWith(`#${envVar}=`)) {
        envLines[i] = `${envVar}=${newValue}`;
        found = true;
        break;
      }
    }
    
    // If variable not found, add it
    if (!found) {
      // Add after the API Keys comment or at the end
      const apiKeysCommentIndex = envLines.findIndex(line => 
        line.includes('# API Keys for external access')
      );
      
      if (apiKeysCommentIndex !== -1) {
        envLines.splice(apiKeysCommentIndex + 1, 0, `${envVar}=${newValue}`);
      } else {
        // Add API Keys section if it doesn't exist
        envLines.push('');
        envLines.push('# API Keys for external access');
        envLines.push(`${envVar}=${newValue}`);
      }
    }
    
    // Write back to file
    fs.writeFileSync(envPath, envLines.join('\n'));
    
    // Update process.env for immediate effect
    process.env[envVar] = newValue;
    
    return true;
  } catch (error) {
    console.error('Error updating .env file:', error);
    return false;
  }
};

const generateNewKey = async (req, res) => {
  try {
    const { type = 'api_key' } = req.body;

    if (!['api_key', 'admin_token'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type. Must be api_key or admin_token' });
    }

    // Generate a new key
    const newKey = crypto.randomBytes(32).toString('hex');
    const envVar = type === 'api_key' ? 'API_KEY' : 'ADMIN_TOKEN';
    
    // Update the .env file
    const updated = updateEnvFile(envVar, newKey);
    
    if (!updated) {
      return res.status(500).json({ error: 'Failed to update environment file' });
    }
    
    res.status(200).json({
      message: `New ${type.replace('_', ' ')} generated and saved to environment`,
      key: newKey,
      type: type,
      envVar: envVar,
      status: 'Environment variable updated successfully'
    });
  } catch (error) {
    console.error('Error generating new key:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const validateApiKey = (keyToValidate) => {
  try {
    // Check against API_KEY
    if (process.env.API_KEY && keyToValidate === process.env.API_KEY) {
      return {
        id: 'env_api_key',
        name: 'Environment API Key',
        type: 'api_key',
        is_active: true
      };
    }
    
    // Check against ADMIN_TOKEN
    if (process.env.ADMIN_TOKEN && keyToValidate === process.env.ADMIN_TOKEN) {
      return {
        id: 'env_admin_token',
        name: 'Environment Admin Token',
        type: 'admin_token',
        is_active: true
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error validating API key:', error);
    return null;
  }
};

const getApiKeyValue = async (req, res) => {
  try {
    const { id } = req.params;
    
    let keyValue = null;
    if (id === 'env_api_key' && process.env.API_KEY) {
      keyValue = process.env.API_KEY;
    } else if (id === 'env_admin_token' && process.env.ADMIN_TOKEN) {
      keyValue = process.env.ADMIN_TOKEN;
    }
    
    if (keyValue) {
      res.json({ key: keyValue });
    } else {
      res.status(404).json({ error: 'API key not found' });
    }
  } catch (error) {
    console.error('Error retrieving API key value:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getApiKeys,
  generateNewKey,
  getApiKeyValue,
  validateApiKey
};