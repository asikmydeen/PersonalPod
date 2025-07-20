#!/usr/bin/env node

/**
 * Database initialization script
 * Creates the database and runs migrations
 */

const { Client } = require('pg');
const { spawn } = require('child_process');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbName = process.env.DB_NAME || 'personalpod';
const dbUser = process.env.DB_USER || 'postgres';
const dbPassword = process.env.DB_PASSWORD || '';
const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = process.env.DB_PORT || 5432;

async function createDatabase() {
  const client = new Client({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: 'postgres', // Connect to default postgres database
  });

  try {
    await client.connect();
    
    // Check if database exists
    const res = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName]
    );

    if (res.rows.length === 0) {
      // Create database
      await client.query(`CREATE DATABASE ${dbName}`);
      console.log(`✅ Database '${dbName}' created successfully`);
    } else {
      console.log(`ℹ️  Database '${dbName}' already exists`);
    }
  } catch (error) {
    console.error('❌ Error creating database:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

async function runMigrations() {
  return new Promise((resolve, reject) => {
    console.log('📦 Running database migrations...');
    
    const migrate = spawn('npm', ['run', 'migrate:up'], {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
      shell: true,
    });

    migrate.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Migrations completed successfully');
        resolve();
      } else {
        reject(new Error(`Migration process exited with code ${code}`));
      }
    });

    migrate.on('error', (error) => {
      reject(error);
    });
  });
}

async function main() {
  console.log('🚀 Initializing PersonalPod database...\n');
  
  try {
    // Create database
    await createDatabase();
    
    // Run migrations
    await runMigrations();
    
    console.log('\n✨ Database initialization completed successfully!');
    console.log(`📝 Connection string: postgresql://${dbUser}:****@${dbHost}:${dbPort}/${dbName}`);
  } catch (error) {
    console.error('\n❌ Database initialization failed:', error.message);
    process.exit(1);
  }
}

// Run the script
main();