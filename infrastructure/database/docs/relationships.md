# Database Relationships Documentation

## Entity Relationship Diagram

```
┌─────────────┐
│   USERS     │
├─────────────┤
│ id (PK)     │
│ cognito_id  │
│ email       │
│ username    │
└─────────────┘
      │
      │ 1:N
      ├────────────────┬──────────────┬─────────────┬──────────────┬───────────────┐
      ▼                ▼              ▼             ▼              ▼               ▼
┌─────────────┐  ┌─────────────┐  ┌──────────┐  ┌────────────┐  ┌─────────────┐  ┌───────────────┐
│  ENTRIES    │  │ CATEGORIES  │  │   TAGS   │  │USER_PREFS  │  │  SHARING    │  │ACTIVITY_LOGS  │
├─────────────┤  ├─────────────┤  ├──────────┤  ├────────────┤  ├─────────────┤  ├───────────────┤
│ id (PK)     │  │ id (PK)     │  │ id (PK)  │  │ id (PK)    │  │ id (PK)     │  │ id (PK)       │
│ user_id(FK) │  │ user_id(FK) │  │ user_id  │  │ user_id    │  │ owner_id    │  │ user_id (FK)  │
│ category_id │  │ parent_id   │  │ name     │  │ pref_key   │  │ entry_id    │  │ entry_id (FK) │
│ type        │  │ name        │  │ slug     │  │ pref_value │  │ shared_with │  │ action        │
│ title       │  │ slug        │  └──────────┘  └────────────┘  │ permission  │  │ metadata      │
│ content     │  └─────────────┘        │                       │ token       │  └───────────────┘
└─────────────┘         │               │                       └─────────────┘
      │                 │               │                              │
      │                 └───────────────┘                              │
      │                         │                                      │
      │                         ▼                                      │
      │                  ┌─────────────┐                              │
      │                  │ ENTRY_TAGS  │                              │
      │                  ├─────────────┤                              │
      │                  │entry_id(FK) │◄─────────────────────────────┘
      │                  │tag_id (FK)  │
      │                  └─────────────┘
      │
      ├────────────────┬───────────────┐
      ▼                ▼               ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────────┐
│ ATTACHMENTS │  │SEARCH_META  │  │ SHARING (cont)  │
├─────────────┤  ├─────────────┤  ├─────────────────┤
│ id (PK)     │  │ id (PK)     │  │ shared_with_user│
│ entry_id    │  │ entry_id    │  │ shared_with_email│
│ user_id     │  │ search_vec  │  └─────────────────┘
│ s3_key      │  │ keywords    │
└─────────────┘  └─────────────┘
```

## Relationship Types

### One-to-Many (1:N) Relationships

1. **Users → Entries**
   - One user can have many entries
   - Each entry belongs to exactly one user
   - Cascade delete: When user is deleted, all entries are deleted

2. **Users → Categories**
   - One user can have many categories
   - Each category belongs to exactly one user
   - Cascade delete enforced

3. **Users → Tags**
   - One user can have many tags
   - Each tag belongs to exactly one user
   - Cascade delete enforced

4. **Categories → Entries**
   - One category can contain many entries
   - Each entry can belong to zero or one category
   - Set null on category deletion

5. **Entries → Attachments**
   - One entry can have many attachments
   - Each attachment belongs to exactly one entry
   - Cascade delete enforced

6. **Entries → Search Metadata**
   - One entry has one search metadata record
   - One-to-one relationship enforced by unique constraint
   - Cascade delete enforced

7. **Categories → Categories** (Self-referential)
   - One category can have many subcategories
   - Each category can have zero or one parent
   - Cascade delete for hierarchy

### Many-to-Many (M:N) Relationships

1. **Entries ↔ Tags** (via entry_tags)
   - One entry can have many tags
   - One tag can be applied to many entries
   - Junction table: entry_tags
   - Cascade delete from both sides

### Special Relationships

1. **Sharing Relationships**
   - Owner (user) shares entry with another user
   - Can share with registered users or via email/token
   - Multiple sharing records per entry possible
   - Different permission levels

2. **Activity Logs**
   - References both user and entry
   - Entry reference can be null (for deleted entries)
   - Maintains historical record

## Foreign Key Constraints

### Cascade Actions

1. **CASCADE DELETE**:
   - `users` → `entries`: Delete all entries when user deleted
   - `users` → `categories`: Delete all categories when user deleted
   - `users` → `tags`: Delete all tags when user deleted
   - `entries` → `attachments`: Delete all attachments when entry deleted
   - `entries` → `search_metadata`: Delete search data when entry deleted
   - `entries` → `entry_tags`: Remove all tag associations when entry deleted
   - `tags` → `entry_tags`: Remove all entry associations when tag deleted
   - `categories` → `categories`: Delete subcategories when parent deleted

2. **SET NULL**:
   - `categories` → `entries`: Set category_id to NULL when category deleted
   - `entries` → `activity_logs`: Set entry_id to NULL when entry deleted

3. **RESTRICT** (Implicit):
   - `users` → `sharing`: Cannot delete user if they have shared entries

## Index Strategy for Relationships

### Foreign Key Indexes
All foreign key columns are indexed for join performance:
- `entries.user_id`
- `entries.category_id`
- `categories.user_id`
- `categories.parent_id`
- `tags.user_id`
- `entry_tags.entry_id`
- `entry_tags.tag_id`
- `attachments.entry_id`
- `attachments.user_id`
- `sharing.entry_id`
- `sharing.owner_id`
- `sharing.shared_with_user_id`

### Composite Indexes
For common query patterns:
- `entries(user_id, type, status)`: User's entries by type and status
- `categories(user_id, parent_id)`: User's category hierarchy
- `activity_logs(user_id, created_at)`: User's activity timeline

## Query Patterns

### Common Joins

1. **Get entries with categories and tags**:
```sql
SELECT e.*, c.name as category_name, 
       array_agg(t.name) as tags
FROM entries e
LEFT JOIN categories c ON e.category_id = c.id
LEFT JOIN entry_tags et ON e.id = et.entry_id
LEFT JOIN tags t ON et.tag_id = t.id
WHERE e.user_id = ?
GROUP BY e.id, c.name;
```

2. **Get shared entries for a user**:
```sql
SELECT e.*, s.permission, u.username as owner_name
FROM sharing s
JOIN entries e ON s.entry_id = e.id
JOIN users u ON s.owner_id = u.id
WHERE s.shared_with_user_id = ?
  AND s.expires_at > NOW();
```

3. **Get category hierarchy**:
```sql
WITH RECURSIVE category_tree AS (
  SELECT id, name, parent_id, 0 as level
  FROM categories
  WHERE user_id = ? AND parent_id IS NULL
  UNION ALL
  SELECT c.id, c.name, c.parent_id, ct.level + 1
  FROM categories c
  JOIN category_tree ct ON c.parent_id = ct.id
)
SELECT * FROM category_tree ORDER BY level, name;
```

## Data Integrity Rules

1. **User Isolation**: Users can only access their own data (enforced at API level)
2. **Tag Usage**: Automatically tracked via triggers
3. **Search Sync**: Search vectors updated automatically on content changes
4. **Slug Uniqueness**: Enforced per user for categories and tags
5. **Sharing Permissions**: Hierarchical (admin > write > read)
6. **Entry Status**: Soft deletes using status field
7. **Audit Trail**: All modifications logged automatically