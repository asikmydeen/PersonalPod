/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Enable extensions
  pgm.createExtension('uuid-ossp', { ifNotExists: true });
  pgm.createExtension('pgcrypto', { ifNotExists: true });
  pgm.createExtension('pg_trgm', { ifNotExists: true });

  // Create custom types
  pgm.createType('entry_type', ['note', 'password', 'document', 'bookmark', 'task', 'contact']);
  pgm.createType('entry_status', ['active', 'archived', 'deleted', 'draft']);
  pgm.createType('share_permission', ['read', 'write', 'admin']);
  pgm.createType('activity_action', ['create', 'update', 'delete', 'share', 'unshare', 'view', 'export']);

  // Create users table
  pgm.createTable('users', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    cognito_user_id: {
      type: 'varchar(255)',
      notNull: true,
      unique: true,
    },
    email: {
      type: 'varchar(255)',
      notNull: true,
      unique: true,
    },
    username: {
      type: 'varchar(100)',
      notNull: true,
      unique: true,
    },
    full_name: {
      type: 'varchar(255)',
    },
    avatar_url: {
      type: 'text',
    },
    is_active: {
      type: 'boolean',
      default: true,
    },
    is_verified: {
      type: 'boolean',
      default: false,
    },
    last_login_at: {
      type: 'timestamp with time zone',
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
    updated_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
    metadata: {
      type: 'jsonb',
      default: '{}',
    },
  });

  // Create indexes for users table
  pgm.createIndex('users', 'cognito_user_id');
  pgm.createIndex('users', 'email');
  pgm.createIndex('users', 'username');

  // Create user_passwords table for storing password hashes separately
  pgm.createTable('user_passwords', {
    user_id: {
      type: 'uuid',
      primaryKey: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    password_hash: {
      type: 'text',
      notNull: true,
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
    updated_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // Create refresh_tokens table
  pgm.createTable('refresh_tokens', {
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
      type: 'text',
      notNull: true,
      unique: true,
    },
    expires_at: {
      type: 'timestamp with time zone',
      notNull: true,
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // Create indexes for refresh_tokens
  pgm.createIndex('refresh_tokens', 'user_id');
  pgm.createIndex('refresh_tokens', 'token');
  pgm.createIndex('refresh_tokens', 'expires_at');

  // Create update_updated_at_column function
  pgm.createFunction(
    'update_updated_at_column',
    [],
    {
      returns: 'trigger',
      language: 'plpgsql',
    },
    `
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    `
  );

  // Apply updated_at triggers
  pgm.createTrigger('users', 'update_users_updated_at', {
    when: 'BEFORE',
    operation: 'UPDATE',
    function: 'update_updated_at_column',
    level: 'ROW',
  });

  pgm.createTrigger('user_passwords', 'update_user_passwords_updated_at', {
    when: 'BEFORE',
    operation: 'UPDATE',
    function: 'update_updated_at_column',
    level: 'ROW',
  });
};

exports.down = (pgm) => {
  // Drop triggers
  pgm.dropTrigger('user_passwords', 'update_user_passwords_updated_at');
  pgm.dropTrigger('users', 'update_users_updated_at');

  // Drop function
  pgm.dropFunction('update_updated_at_column', []);

  // Drop tables
  pgm.dropTable('refresh_tokens');
  pgm.dropTable('user_passwords');
  pgm.dropTable('users');

  // Drop types
  pgm.dropType('activity_action');
  pgm.dropType('share_permission');
  pgm.dropType('entry_status');
  pgm.dropType('entry_type');

  // Drop extensions
  pgm.dropExtension('pg_trgm');
  pgm.dropExtension('pgcrypto');
  pgm.dropExtension('uuid-ossp');
};