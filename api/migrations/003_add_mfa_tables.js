exports.shorthands = undefined;

exports.up = (pgm) => {
  // Create user_mfa table
  pgm.createTable('user_mfa', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
      unique: true,
    },
    secret: {
      type: 'text',
      notNull: true,
    },
    enabled: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    backup_codes_generated_at: {
      type: 'timestamp with time zone',
    },
    last_used_at: {
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
  });

  // Create backup_codes table
  pgm.createTable('backup_codes', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    code_hash: {
      type: 'text',
      notNull: true,
    },
    used: {
      type: 'boolean',
      notNull: true,
      default: false,
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
  pgm.createIndex('user_mfa', 'user_id');
  pgm.createIndex('backup_codes', 'user_id');
  pgm.createIndex('backup_codes', ['user_id', 'code_hash']);

  // Add MFA fields to users table
  pgm.addColumns('users', {
    mfa_enabled: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    mfa_enforced: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
  });

  // Create trigger to update updated_at
  pgm.sql(`
    CREATE TRIGGER update_user_mfa_updated_at BEFORE UPDATE ON user_mfa
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  `);
};

exports.down = (pgm) => {
  // Drop triggers
  pgm.sql('DROP TRIGGER IF EXISTS update_user_mfa_updated_at ON user_mfa;');

  // Drop columns from users table
  pgm.dropColumns('users', ['mfa_enabled', 'mfa_enforced']);

  // Drop indexes
  pgm.dropIndex('backup_codes', ['user_id', 'code_hash']);
  pgm.dropIndex('backup_codes', 'user_id');
  pgm.dropIndex('user_mfa', 'user_id');

  // Drop tables
  pgm.dropTable('backup_codes');
  pgm.dropTable('user_mfa');
};