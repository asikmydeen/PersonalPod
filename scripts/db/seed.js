#!/usr/bin/env node

const { Client } = require('pg');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

// Database connection configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'personalpod',
  password: process.env.DB_PASSWORD || 'devpassword',
  database: process.env.DB_NAME || 'personalpod_dev',
};

// Sample data
const users = [
  {
    id: uuidv4(),
    email: 'admin@example.com',
    username: 'admin',
    password: 'Admin123!',
    role: 'admin',
    is_verified: true,
  },
  {
    id: uuidv4(),
    email: 'user@example.com',
    username: 'testuser',
    password: 'User123!',
    role: 'user',
    is_verified: true,
  },
];

async function seedDatabase() {
  const client = new Client(dbConfig);

  try {
    await client.connect();
    console.log('Connected to database');

    // Create tables if they don't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        is_verified BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Clear existing data
    await client.query('TRUNCATE TABLE users CASCADE');
    console.log('Cleared existing data');

    // Insert users
    for (const user of users) {
      const passwordHash = await bcrypt.hash(user.password, 10);
      await client.query(
        `INSERT INTO users (id, email, username, password_hash, role, is_verified) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [user.id, user.email, user.username, passwordHash, user.role, user.is_verified]
      );
      console.log(`Created user: ${user.username}`);
    }

    console.log('Database seeding completed successfully');
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the seed function
seedDatabase();