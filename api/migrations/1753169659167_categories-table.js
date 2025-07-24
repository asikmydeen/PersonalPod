/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Create categories table
  pgm.createTable('categories', {
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
    name: {
      type: 'varchar(100)',
      notNull: true,
    },
    description: {
      type: 'text',
    },
    color: {
      type: 'varchar(7)', // Hex color code
    },
    icon: {
      type: 'varchar(50)', // Icon name or emoji
    },
    parent_id: {
      type: 'uuid',
      references: 'categories',
      onDelete: 'CASCADE',
    },
    path: {
      type: 'text',
      notNull: true,
      comment: 'Materialized path for efficient tree queries',
    },
    level: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    display_order: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    is_active: {
      type: 'boolean',
      notNull: true,
      default: true,
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
    updated_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // Create indexes for categories table
  pgm.createIndex('categories', 'user_id');
  pgm.createIndex('categories', 'parent_id');
  pgm.createIndex('categories', ['user_id', 'is_active']);
  pgm.createIndex('categories', ['user_id', 'parent_id']);
  pgm.createIndex('categories', 'path');
  
  // Create GIN index for path queries
  pgm.sql(`
    CREATE INDEX categories_path_gin_idx ON categories 
    USING gin(path gin_trgm_ops)
  `);
  
  // Unique constraint for name within user and parent
  pgm.createConstraint('categories', 'unique_category_name_per_user_parent', {
    unique: ['user_id', 'parent_id', 'name'],
  });

  // Create function to update path when parent changes
  pgm.sql(`
    CREATE OR REPLACE FUNCTION update_category_path() RETURNS TRIGGER AS $$
    DECLARE
      parent_path TEXT;
    BEGIN
      IF NEW.parent_id IS NULL THEN
        NEW.path = NEW.id::TEXT;
        NEW.level = 0;
      ELSE
        SELECT path, level + 1 INTO parent_path, NEW.level
        FROM categories
        WHERE id = NEW.parent_id;
        
        IF parent_path IS NULL THEN
          RAISE EXCEPTION 'Parent category not found';
        END IF;
        
        NEW.path = parent_path || '/' || NEW.id::TEXT;
      END IF;
      
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Create trigger for path update
  pgm.createTrigger('categories', 'update_category_path_trigger', {
    when: 'BEFORE',
    operation: ['INSERT', 'UPDATE'],
    function: 'update_category_path',
    level: 'ROW',
    condition: 'OLD.parent_id IS DISTINCT FROM NEW.parent_id',
  });

  // Apply updated_at trigger
  pgm.createTrigger('categories', 'update_categories_updated_at', {
    when: 'BEFORE',
    operation: 'UPDATE',
    function: 'update_updated_at_column',
    level: 'ROW',
  });

  // Create entry_categories junction table for many-to-many relationship
  pgm.createTable('entry_categories', {
    entry_id: {
      type: 'uuid',
      notNull: true,
      references: 'entries',
      onDelete: 'CASCADE',
    },
    category_id: {
      type: 'uuid',
      notNull: true,
      references: 'categories',
      onDelete: 'CASCADE',
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // Create composite primary key
  pgm.createConstraint('entry_categories', 'entry_categories_pkey', {
    primaryKey: ['entry_id', 'category_id'],
  });

  // Create indexes for entry_categories
  pgm.createIndex('entry_categories', 'entry_id');
  pgm.createIndex('entry_categories', 'category_id');
};

exports.down = (pgm) => {
  // Drop triggers
  pgm.dropTrigger('categories', 'update_categories_updated_at');
  pgm.dropTrigger('categories', 'update_category_path_trigger');
  
  // Drop function
  pgm.sql('DROP FUNCTION IF EXISTS update_category_path()');
  
  // Drop tables
  pgm.dropTable('entry_categories');
  pgm.dropTable('categories');
};