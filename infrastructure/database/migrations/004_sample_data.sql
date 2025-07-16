-- Migration: 004_sample_data
-- Description: Insert sample data for testing
-- Date: 2025-01-16
-- NOTE: This migration should only be run in development/testing environments

-- Sample users
INSERT INTO users (id, cognito_user_id, email, username, full_name, is_active, is_verified) VALUES
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'cognito-user-001', 'john.doe@example.com', 'johndoe', 'John Doe', true, true),
    ('b2c3d4e5-f6a7-8901-bcde-f23456789012', 'cognito-user-002', 'jane.smith@example.com', 'janesmith', 'Jane Smith', true, true),
    ('c3d4e5f6-a7b8-9012-cdef-345678901234', 'cognito-user-003', 'bob.wilson@example.com', 'bobwilson', 'Bob Wilson', true, false);

-- Sample categories
INSERT INTO categories (id, user_id, name, slug, description, color, icon, sort_order) VALUES
    -- John's categories
    ('d4e5f6a7-b8c9-0123-defa-456789012345', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Personal', 'personal', 'Personal notes and thoughts', '#3B82F6', 'user', 1),
    ('e5f6a7b8-c9d0-1234-efab-567890123456', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Work', 'work', 'Work-related documents', '#10B981', 'briefcase', 2),
    ('f6a7b8c9-d0e1-2345-fabc-678901234567', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Projects', 'projects', 'Project documentation', '#8B5CF6', 'folder', 3),
    ('a7b8c9d0-e1f2-3456-abcd-789012345678', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Finance', 'finance', 'Financial records', '#F59E0B', 'dollar-sign', 4),
    -- Jane's categories
    ('b8c9d0e1-f2a3-4567-bcde-890123456789', 'b2c3d4e5-f6a7-8901-bcde-f23456789012', 'Recipes', 'recipes', 'Cooking recipes', '#EF4444', 'utensils', 1),
    ('c9d0e1f2-a3b4-5678-cdef-901234567890', 'b2c3d4e5-f6a7-8901-bcde-f23456789012', 'Travel', 'travel', 'Travel plans and memories', '#06B6D4', 'map-pin', 2);

-- Sample tags
INSERT INTO tags (id, user_id, name, slug, color) VALUES
    -- John's tags
    ('d0e1f2a3-b4c5-6789-defa-012345678901', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Important', 'important', '#DC2626'),
    ('e1f2a3b4-c5d6-7890-efab-123456789012', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Todo', 'todo', '#F59E0B'),
    ('f2a3b4c5-d6e7-8901-fabc-234567890123', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Idea', 'idea', '#10B981'),
    ('a3b4c5d6-e7f8-9012-abcd-345678901234', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Reference', 'reference', '#3B82F6'),
    -- Jane's tags
    ('b4c5d6e7-f8a9-0123-bcde-456789012345', 'b2c3d4e5-f6a7-8901-bcde-f23456789012', 'Favorite', 'favorite', '#EC4899'),
    ('c5d6e7f8-a9b0-1234-cdef-567890123456', 'b2c3d4e5-f6a7-8901-bcde-f23456789012', 'Quick', 'quick', '#8B5CF6');

-- Sample entries
INSERT INTO entries (id, user_id, category_id, type, status, title, content, is_favorite, metadata) VALUES
    -- John's entries
    ('d6e7f8a9-b0c1-2345-defa-678901234567', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'd4e5f6a7-b8c9-0123-defa-456789012345', 'note', 'active', 
     'Meeting Notes - Q1 Planning', 
     E'# Q1 Planning Meeting\n\n## Attendees\n- John Doe\n- Sarah Johnson\n- Mike Chen\n\n## Action Items\n1. Review budget proposals\n2. Set quarterly goals\n3. Schedule follow-up meetings\n\n## Key Decisions\n- Launch new product line in March\n- Increase marketing budget by 20%', 
     true, 
     '{"meeting_date": "2025-01-15", "attendees": ["John Doe", "Sarah Johnson", "Mike Chen"]}'::jsonb),
    
    ('e7f8a9b0-c1d2-3456-efab-789012345678', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'e5f6a7b8-c9d0-1234-efab-567890123456', 'password', 'active', 
     'Company VPN Access', 
     NULL, 
     false, 
     '{"username": "john.doe", "url": "https://vpn.company.com", "notes": "2FA enabled"}'::jsonb),
    
    ('f8a9b0c1-d2e3-4567-fabc-890123456789', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'f6a7b8c9-d0e1-2345-fabc-678901234567', 'document', 'active', 
     'Project Roadmap 2025', 
     'Strategic roadmap for all projects in 2025...', 
     true, 
     '{"document_type": "roadmap", "version": "1.0", "last_reviewed": "2025-01-10"}'::jsonb),
    
    ('a9b0c1d2-e3f4-5678-abcd-901234567890', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'e5f6a7b8-c9d0-1234-efab-567890123456', 'bookmark', 'active', 
     'React Documentation', 
     'Official React documentation for reference', 
     false, 
     '{"url": "https://react.dev", "tags": ["development", "frontend", "javascript"]}'::jsonb),
    
    ('b0c1d2e3-f4a5-6789-bcde-012345678901', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'd4e5f6a7-b8c9-0123-defa-456789012345', 'task', 'active', 
     'Prepare presentation for client meeting', 
     'Create slides covering Q4 results and Q1 projections', 
     false, 
     '{"due_date": "2025-01-20", "priority": "high", "completed": false}'::jsonb),
    
    -- Jane's entries
    ('c1d2e3f4-a5b6-7890-cdef-123456789012', 'b2c3d4e5-f6a7-8901-bcde-f23456789012', 'b8c9d0e1-f2a3-4567-bcde-890123456789', 'note', 'active', 
     'Grandma''s Chocolate Chip Cookies', 
     E'## Ingredients\n- 2 1/4 cups all-purpose flour\n- 1 tsp baking soda\n- 1 tsp salt\n- 1 cup butter, softened\n- 3/4 cup granulated sugar\n- 3/4 cup packed brown sugar\n- 2 large eggs\n- 2 tsp vanilla extract\n- 2 cups chocolate chips\n\n## Instructions\n1. Preheat oven to 375°F\n2. Mix dry ingredients\n3. Cream butter and sugars\n4. Add eggs and vanilla\n5. Combine wet and dry ingredients\n6. Fold in chocolate chips\n7. Bake for 9-11 minutes', 
     true, 
     '{"cuisine": "American", "prep_time": "15 minutes", "cook_time": "10 minutes", "servings": 48}'::jsonb),
    
    ('d2e3f4a5-b6c7-8901-defa-234567890123', 'b2c3d4e5-f6a7-8901-bcde-f23456789012', 'c9d0e1f2-a3b4-5678-cdef-901234567890', 'note', 'active', 
     'Paris Trip Itinerary', 
     E'# Paris - April 2025\n\n## Day 1\n- Arrive at CDG\n- Check in at Hotel Le Marais\n- Evening: Eiffel Tower\n\n## Day 2\n- Morning: Louvre Museum\n- Afternoon: Seine River Cruise\n- Evening: Dinner at Le Comptoir\n\n## Day 3\n- Versailles day trip\n\n## Day 4\n- Montmartre & Sacré-Cœur\n- Shopping at Champs-Élysées', 
     false, 
     '{"trip_dates": {"start": "2025-04-15", "end": "2025-04-20"}, "budget": 2500, "currency": "EUR"}'::jsonb);

-- Sample entry-tag relationships
INSERT INTO entry_tags (entry_id, tag_id) VALUES
    ('d6e7f8a9-b0c1-2345-defa-678901234567', 'd0e1f2a3-b4c5-6789-defa-012345678901'), -- Meeting Notes - Important
    ('d6e7f8a9-b0c1-2345-defa-678901234567', 'e1f2a3b4-c5d6-7890-efab-123456789012'), -- Meeting Notes - Todo
    ('e7f8a9b0-c1d2-3456-efab-789012345678', 'd0e1f2a3-b4c5-6789-defa-012345678901'), -- VPN Access - Important
    ('f8a9b0c1-d2e3-4567-fabc-890123456789', 'a3b4c5d6-e7f8-9012-abcd-345678901234'), -- Project Roadmap - Reference
    ('a9b0c1d2-e3f4-5678-abcd-901234567890', 'a3b4c5d6-e7f8-9012-abcd-345678901234'), -- React Docs - Reference
    ('b0c1d2e3-f4a5-6789-bcde-012345678901', 'e1f2a3b4-c5d6-7890-efab-123456789012'), -- Presentation Task - Todo
    ('c1d2e3f4-a5b6-7890-cdef-123456789012', 'b4c5d6e7-f8a9-0123-bcde-456789012345'), -- Cookie Recipe - Favorite
    ('c1d2e3f4-a5b6-7890-cdef-123456789012', 'c5d6e7f8-a9b0-1234-cdef-567890123456'); -- Cookie Recipe - Quick

-- Sample user preferences
INSERT INTO user_preferences (user_id, preference_key, preference_value) VALUES
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'theme', '"dark"'::jsonb),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'language', '"en"'::jsonb),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'notifications', '{"email": true, "push": false, "digest": "weekly"}'::jsonb),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'default_view', '"grid"'::jsonb),
    ('b2c3d4e5-f6a7-8901-bcde-f23456789012', 'theme', '"light"'::jsonb),
    ('b2c3d4e5-f6a7-8901-bcde-f23456789012', 'language', '"en"'::jsonb),
    ('b2c3d4e5-f6a7-8901-bcde-f23456789012', 'notifications', '{"email": true, "push": true, "digest": "daily"}'::jsonb);

-- Sample sharing
INSERT INTO sharing (entry_id, owner_id, shared_with_user_id, permission, share_token) VALUES
    ('d6e7f8a9-b0c1-2345-defa-678901234567', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'b2c3d4e5-f6a7-8901-bcde-f23456789012', 'read', 'share_token_001'),
    ('f8a9b0c1-d2e3-4567-fabc-890123456789', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', NULL, 'read', 'share_token_002');

-- Sample attachments
INSERT INTO attachments (entry_id, user_id, file_name, file_size, mime_type, s3_key, s3_bucket) VALUES
    ('f8a9b0c1-d2e3-4567-fabc-890123456789', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'roadmap-2025.pdf', 2048576, 'application/pdf', 'users/a1b2c3d4-e5f6-7890-abcd-ef1234567890/attachments/roadmap-2025.pdf', 'personalpod-attachments'),
    ('c1d2e3f4-a5b6-7890-cdef-123456789012', 'b2c3d4e5-f6a7-8901-bcde-f23456789012', 'cookies.jpg', 1024768, 'image/jpeg', 'users/b2c3d4e5-f6a7-8901-bcde-f23456789012/attachments/cookies.jpg', 'personalpod-attachments');

-- Insert migration record
INSERT INTO schema_migrations (version) VALUES ('004_sample_data');