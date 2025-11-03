#!/usr/bin/env node

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../database/connection');

/**
 * Script to create an admin user for managing all tenants
 * Usage: node scripts/create-admin.js <username> <password>
 */

async function createAdminUser(username, password) {
    try {
        // Validate input
        if (!username || !password) {
            console.error('Error: Username and password are required');
            console.log('Usage: node scripts/create-admin.js <username> <password>');
            process.exit(1);
        }

        if (username.length < 3) {
            console.error('Error: Username must be at least 3 characters long');
            process.exit(1);
        }

        if (password.length < 6) {
            console.error('Error: Password must be at least 6 characters long');
            process.exit(1);
        }

        // Check if username already exists
        const existingUser = await db.query(
            'SELECT id, username FROM users WHERE username = $1',
            [username]
        );

        if (existingUser.rows.length > 0) {
            console.error(`Error: Username '${username}' already exists`);
            process.exit(1);
        }

        // Hash the password
        console.log('Hashing password...');
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Create the admin user
        console.log(`Creating admin user '${username}'...`);
        const result = await db.query(
            `INSERT INTO users (id, username, password_hash, is_admin, created_at, updated_at)
             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             RETURNING id, username, is_admin, created_at`,
            [uuidv4(), username, passwordHash, true]
        );

        const newAdmin = result.rows[0];

        console.log('✅ Admin user created successfully!');
        console.log('📋 Admin Details:');
        console.log(`   ID: ${newAdmin.id}`);
        console.log(`   Username: ${newAdmin.username}`);
        console.log(`   Admin: ${newAdmin.is_admin}`);
        console.log(`   Created: ${newAdmin.created_at}`);
        console.log('');
        console.log('🔐 Login Information:');
        console.log(`   Username: ${newAdmin.username}`);
        console.log(`   Password: [HIDDEN]`);
        console.log('');
        console.log('📝 Admin Capabilities:');
        console.log('   • Manage all tenants');
        console.log('   • Create, edit, and delete tenants');
        console.log('   • View all OAuth clients across tenants');
        console.log('   • Manage API keys and access logs');
        console.log('   • Access system admin dashboard');

    } catch (error) {
        console.error('❌ Error creating admin user:', error.message);
        if (error.code === '23505') { // PostgreSQL unique violation
            console.error('The username already exists in the database');
        }
        process.exit(1);
    } finally {
        await db.pool.end();
    }
}

// Get command line arguments
const args = process.argv.slice(2);
const username = args[0];
const password = args[1];

// Show usage if no arguments provided
if (args.length === 0) {
    console.log('📝 Admin User Creation Script');
    console.log('');
    console.log('This script creates a system administrator user who can manage all tenants.');
    console.log('');
    console.log('Usage:');
    console.log('  node scripts/create-admin.js <username> <password>');
    console.log('');
    console.log('Example:');
    console.log('  node scripts/create-admin.js superadmin mySecurePassword123');
    console.log('');
    console.log('Requirements:');
    console.log('  • Username must be at least 3 characters');
    console.log('  • Password must be at least 6 characters');
    console.log('  • Username must be unique');
    process.exit(0);
}

// Create the admin user
createAdminUser(username, password);