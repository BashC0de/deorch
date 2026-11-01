-- DeOrch PostgreSQL initialization
-- Runs once on first container start

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Set default timezone
ALTER DATABASE deorch SET timezone TO 'UTC';
