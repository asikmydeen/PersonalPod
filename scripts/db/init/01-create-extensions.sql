-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enable full text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Enable PostGIS for geospatial data (optional)
-- CREATE EXTENSION IF NOT EXISTS postgis;