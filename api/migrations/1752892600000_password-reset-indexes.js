/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Add composite index for efficient rate limiting queries
  // This index helps with queries that check recent password reset attempts by user
  pgm.createIndex('email_verifications', ['user_id', 'type', 'created_at'], {
    name: 'idx_email_verifications_rate_limit',
    where: "type = 'password_reset'",
  });

  // Add index for cleanup queries
  pgm.createIndex('email_verifications', ['expires_at', 'used_at'], {
    name: 'idx_email_verifications_cleanup',
    where: 'used_at IS NOT NULL OR expires_at < CURRENT_TIMESTAMP',
  });
};

exports.down = (pgm) => {
  pgm.dropIndex('email_verifications', [], { name: 'idx_email_verifications_rate_limit' });
  pgm.dropIndex('email_verifications', [], { name: 'idx_email_verifications_cleanup' });
};