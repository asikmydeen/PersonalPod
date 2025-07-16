-- Migration: 002_create_indexes
-- Description: Create indexes for performance optimization
-- Date: 2025-01-16

-- Create indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_cognito_user_id ON users(cognito_user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active) WHERE is_active = true;

-- Create indexes for entries table
CREATE INDEX IF NOT EXISTS idx_entries_user_id ON entries(user_id);
CREATE INDEX IF NOT EXISTS idx_entries_category_id ON entries(category_id);
CREATE INDEX IF NOT EXISTS idx_entries_type ON entries(type);
CREATE INDEX IF NOT EXISTS idx_entries_status ON entries(status);
CREATE INDEX IF NOT EXISTS idx_entries_created_at ON entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entries_updated_at ON entries(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_entries_is_favorite ON entries(is_favorite) WHERE is_favorite = true;
CREATE INDEX IF NOT EXISTS idx_entries_user_type_status ON entries(user_id, type, status);
CREATE INDEX IF NOT EXISTS idx_entries_expires_at ON entries(expires_at) WHERE expires_at IS NOT NULL;

-- Create indexes for categories table
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_user_parent ON categories(user_id, parent_id);

-- Create indexes for tags table
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
CREATE INDEX IF NOT EXISTS idx_tags_usage_count ON tags(usage_count DESC);

-- Create indexes for entry_tags table
CREATE INDEX IF NOT EXISTS idx_entry_tags_tag_id ON entry_tags(tag_id);

-- Create indexes for attachments table
CREATE INDEX IF NOT EXISTS idx_attachments_entry_id ON attachments(entry_id);
CREATE INDEX IF NOT EXISTS idx_attachments_user_id ON attachments(user_id);
CREATE INDEX IF NOT EXISTS idx_attachments_mime_type ON attachments(mime_type);

-- Create indexes for search_metadata table
CREATE INDEX IF NOT EXISTS idx_search_metadata_entry_id ON search_metadata(entry_id);
CREATE INDEX IF NOT EXISTS idx_search_metadata_vector ON search_metadata USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_search_metadata_keywords ON search_metadata USING gin(keywords);

-- Create indexes for user_preferences table
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- Create indexes for sharing table
CREATE INDEX IF NOT EXISTS idx_sharing_entry_id ON sharing(entry_id);
CREATE INDEX IF NOT EXISTS idx_sharing_owner_id ON sharing(owner_id);
CREATE INDEX IF NOT EXISTS idx_sharing_shared_with_user_id ON sharing(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_sharing_share_token ON sharing(share_token);
CREATE INDEX IF NOT EXISTS idx_sharing_is_public ON sharing(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_sharing_expires_at ON sharing(expires_at) WHERE expires_at IS NOT NULL;

-- Create indexes for activity_logs table
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entry_id ON activity_logs(entry_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_created ON activity_logs(user_id, created_at DESC);

-- Insert migration record
INSERT INTO schema_migrations (version) VALUES ('002_create_indexes');