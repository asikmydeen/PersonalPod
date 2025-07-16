-- Migration: 003_create_triggers
-- Description: Create triggers for automatic data maintenance
-- Date: 2025-01-16

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at 
    BEFORE UPDATE ON categories
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_entries_updated_at 
    BEFORE UPDATE ON entries
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at 
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sharing_updated_at 
    BEFORE UPDATE ON sharing
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to update tag usage count
CREATE OR REPLACE FUNCTION update_tag_usage_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE tags SET usage_count = usage_count + 1 WHERE id = NEW.tag_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE tags SET usage_count = usage_count - 1 WHERE id = OLD.tag_id;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Apply tag usage count trigger
CREATE TRIGGER update_tag_usage_count_trigger
    AFTER INSERT OR DELETE ON entry_tags
    FOR EACH ROW 
    EXECUTE FUNCTION update_tag_usage_count();

-- Create function to update search vector
CREATE OR REPLACE FUNCTION update_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    -- Only process if content is not encrypted
    IF NEW.is_encrypted = false THEN
        INSERT INTO search_metadata (entry_id, search_vector)
        VALUES (NEW.id, to_tsvector('english', COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.content, '')))
        ON CONFLICT (entry_id) DO UPDATE
        SET search_vector = to_tsvector('english', COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.content, '')),
            last_indexed_at = CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply search vector trigger
CREATE TRIGGER update_search_vector_trigger
    AFTER INSERT OR UPDATE OF title, content ON entries
    FOR EACH ROW 
    WHEN (NEW.is_encrypted = false)
    EXECUTE FUNCTION update_search_vector();

-- Create function to generate slug from name
CREATE OR REPLACE FUNCTION generate_slug(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN lower(
        regexp_replace(
            regexp_replace(
                regexp_replace(
                    input_text,
                    '[^a-zA-Z0-9\s-]', '', 'g'  -- Remove special characters
                ),
                '\s+', '-', 'g'  -- Replace spaces with hyphens
            ),
            '-+', '-', 'g'  -- Replace multiple hyphens with single hyphen
        )
    );
END;
$$ language 'plpgsql';

-- Create function to auto-generate category slug
CREATE OR REPLACE FUNCTION auto_generate_category_slug()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := generate_slug(NEW.name);
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply category slug trigger
CREATE TRIGGER auto_generate_category_slug_trigger
    BEFORE INSERT OR UPDATE OF name ON categories
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_category_slug();

-- Create function to auto-generate tag slug
CREATE OR REPLACE FUNCTION auto_generate_tag_slug()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := generate_slug(NEW.name);
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply tag slug trigger
CREATE TRIGGER auto_generate_tag_slug_trigger
    BEFORE INSERT OR UPDATE OF name ON tags
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_tag_slug();

-- Create function to log user activity
CREATE OR REPLACE FUNCTION log_entry_activity()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO activity_logs (user_id, entry_id, action, metadata)
        VALUES (NEW.user_id, NEW.id, 'create', jsonb_build_object('entry_type', NEW.type));
    ELSIF TG_OP = 'UPDATE' THEN
        -- Only log if significant fields changed
        IF OLD.title != NEW.title OR OLD.content IS DISTINCT FROM NEW.content OR OLD.status != NEW.status THEN
            INSERT INTO activity_logs (user_id, entry_id, action, metadata)
            VALUES (NEW.user_id, NEW.id, 'update', jsonb_build_object(
                'changed_fields', 
                CASE 
                    WHEN OLD.title != NEW.title THEN ARRAY['title']
                    ELSE ARRAY[]::text[]
                END ||
                CASE 
                    WHEN OLD.content IS DISTINCT FROM NEW.content THEN ARRAY['content']
                    ELSE ARRAY[]::text[]
                END ||
                CASE 
                    WHEN OLD.status != NEW.status THEN ARRAY['status']
                    ELSE ARRAY[]::text[]
                END
            ));
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO activity_logs (user_id, entry_id, action, metadata)
        VALUES (OLD.user_id, OLD.id, 'delete', jsonb_build_object('entry_type', OLD.type));
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Apply activity logging trigger
CREATE TRIGGER log_entry_activity_trigger
    AFTER INSERT OR UPDATE OR DELETE ON entries
    FOR EACH ROW
    EXECUTE FUNCTION log_entry_activity();

-- Insert migration record
INSERT INTO schema_migrations (version) VALUES ('003_create_triggers');