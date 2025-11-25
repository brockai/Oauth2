const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../database/connection');

const getApiKeys = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, key_preview, type, is_active, created_at, updated_at, last_used_at FROM api_keys ORDER BY created_at DESC'
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching API keys:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


const generateNewKey = async (req, res) => {
  try {
    const { name, type = 'api_key' } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    if (!['api_key', 'admin_token'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type. Must be api_key or admin_token' });
    }

    // Generate a new key
    const newKey = crypto.randomBytes(32).toString('hex');
    const keyPreview = `${newKey.substring(0, 8)}...${newKey.substring(newKey.length - 4)}`;
    
    // Hash the key for storage
    const saltRounds = 10;
    const keyHash = await bcrypt.hash(newKey, saltRounds);
    
    // Store in database
    const result = await db.query(
      'INSERT INTO api_keys (name, key_hash, key_preview, type) VALUES ($1, $2, $3, $4) RETURNING id, name, key_preview, type, is_active, created_at',
      [name, keyHash, keyPreview, type]
    );
    
    res.status(201).json({
      message: `New ${type.replace('_', ' ')} generated successfully`,
      key: newKey,
      api_key: result.rows[0],
      warning: 'Store this key securely - it will not be shown again'
    });
  } catch (error) {
    console.error('Error generating new key:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const validateApiKey = async (keyToValidate) => {
  try {
    // Get all active API keys from database
    const result = await db.query(
      'SELECT id, name, key_hash, type, is_active FROM api_keys WHERE is_active = true'
    );
    
    // Check each key
    for (const apiKey of result.rows) {
      const isValid = await bcrypt.compare(keyToValidate, apiKey.key_hash);
      if (isValid) {
        // Update last_used_at timestamp
        await db.query(
          'UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1',
          [apiKey.id]
        );
        
        return {
          id: apiKey.id,
          name: apiKey.name,
          type: apiKey.type,
          is_active: apiKey.is_active
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error validating API key:', error);
    return null;
  }
};

const deleteApiKey = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      'DELETE FROM api_keys WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'API key not found' });
    }
    
    res.json({ message: 'API key deleted successfully' });
  } catch (error) {
    console.error('Error deleting API key:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const toggleApiKey = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      'UPDATE api_keys SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'API key not found' });
    }
    
    res.json({
      message: `API key ${result.rows[0].is_active ? 'activated' : 'deactivated'} successfully`,
      api_key: result.rows[0]
    });
  } catch (error) {
    console.error('Error toggling API key:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getApiKeys,
  generateNewKey,
  deleteApiKey,
  toggleApiKey,
  validateApiKey
};