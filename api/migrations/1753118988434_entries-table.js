/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Create entries table
  pgm.createTable('entries', {
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
    type: {
      type: 'entry_type',
      notNull: true,
    },
    title: {
      type: 'varchar(255)',
      notNull: true,
    },
    content: {
      type: 'text',
    },
    encrypted_content: {
      type: 'text',
    },
    is_encrypted: {
      type: 'boolean',
      default: false,
    },
    is_locked: {
      type: 'boolean',
      default: false,
    },
    status: {
      type: 'entry_status',
      notNull: true,
      default: 'active',
    },
    tags: {
      type: 'text[]',
      default: '{}',
    },
    metadata: {
      type: 'jsonb',
      default: '{}',
    },
    version: {
      type: 'integer',
      notNull: true,
      default: 1,
    },
    parent_id: {
      type: 'uuid',
      references: 'entries',
      onDelete: 'SET NULL',
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

  // Create indexes for entries table
  pgm.createIndex('entries', 'user_id');
  pgm.createIndex('entries', 'type');
  pgm.createIndex('entries', 'status');
  pgm.createIndex('entries', 'parent_id');
  pgm.createIndex('entries', ['user_id', 'status']);
  pgm.createIndex('entries', ['user_id', 'type']);
  pgm.createIndex('entries', 'created_at');
  pgm.createIndex('entries', 'updated_at');
  
  // Create GIN index for tags
  pgm.createIndex('entries', 'tags', { method: 'gin' });
  
  // Create GIN index for full-text search on title and content
  pgm.sql(`
    CREATE INDEX entries_search_idx ON entries 
    USING gin(to_tsvector('english', title || ' ' || COALESCE(content, '')))
  `);

  // Create entry_attachments table
  pgm.createTable('entry_attachments', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    entry_id: {
      type: 'uuid',
      notNull: true,
      references: 'entries',
      onDelete: 'CASCADE',
    },
    file_name: {
      type: 'varchar(255)',
      notNull: true,
    },
    file_size: {
      type: 'bigint',
      notNull: true,
    },
    mime_type: {
      type: 'varchar(100)',
      notNull: true,
    },
    storage_key: {
      type: 'text',
      notNull: true,
    },
    metadata: {
      type: 'jsonb',
      default: '{}',
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // Create indexes for entry_attachments
  pgm.createIndex('entry_attachments', 'entry_id');

  // Create entry_versions table for version control
  pgm.createTable('entry_versions', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    entry_id: {
      type: 'uuid',
      notNull: true,
      references: 'entries',
      onDelete: 'CASCADE',
    },
    version: {
      type: 'integer',
      notNull: true,
    },
    title: {
      type: 'varchar(255)',
      notNull: true,
    },
    content: {
      type: 'text',
    },
    encrypted_content: {
      type: 'text',
    },
    metadata: {
      type: 'jsonb',
      default: '{}',
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
    created_by: {
      type: 'uuid',
      notNull: true,
      references: 'users',
    },
  });

  // Create indexes for entry_versions
  pgm.createIndex('entry_versions', ['entry_id', 'version'], { unique: true });
  pgm.createIndex('entry_versions', 'created_at');

  // Apply updated_at trigger to entries table
  pgm.createTrigger('entries', 'update_entries_updated_at', {
    when: 'BEFORE',
    operation: 'UPDATE',
    function: 'update_updated_at_column',
    level: 'ROW',
  });
};

exports.down = (pgm) => {
  // Drop triggers
  pgm.dropTrigger('entries', 'update_entries_updated_at');

  // Drop tables
  pgm.dropTable('entry_versions');
  pgm.dropTable('entry_attachments');
  pgm.dropTable('entries');
};