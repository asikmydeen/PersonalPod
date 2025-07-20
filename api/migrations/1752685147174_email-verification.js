/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Create email_verifications table
  pgm.createTable('email_verifications', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    token: {
      type: 'varchar(255)',
      notNull: true,
      unique: true,
    },
    type: {
      type: 'varchar(50)',
      notNull: true,
      check: "type IN ('email_verification', 'password_reset')",
    },
    expires_at: {
      type: 'timestamp with time zone',
      notNull: true,
    },
    used_at: {
      type: 'timestamp with time zone',
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // Create indexes
  pgm.createIndex('email_verifications', 'user_id');
  pgm.createIndex('email_verifications', 'token');
  pgm.createIndex('email_verifications', ['type', 'user_id']);
  pgm.createIndex('email_verifications', 'expires_at');

  // Add email_verified column to users table if it doesn't exist
  pgm.addColumn('users', {
    email_verified: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    email_verified_at: {
      type: 'timestamp with time zone',
    },
  });

  // Create index on email_verified
  pgm.createIndex('users', 'email_verified');
};

exports.down = (pgm) => {
  // Drop indexes
  pgm.dropIndex('users', 'email_verified');
  
  // Drop columns from users table
  pgm.dropColumn('users', 'email_verified_at');
  pgm.dropColumn('users', 'email_verified');
  
  // Drop email_verifications table (indexes are dropped automatically)
  pgm.dropTable('email_verifications');
};