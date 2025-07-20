/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Drop the old is_verified column if it exists
  pgm.dropColumn('users', 'is_verified', { ifExists: true });
  
  // Ensure email_verified and email_verified_at columns exist with proper defaults
  pgm.addColumn('users', {
    email_verified: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    email_verified_at: {
      type: 'timestamp with time zone',
    },
  }, { ifNotExists: true });

  // Create index on email_verified if it doesn't exist
  pgm.createIndex('users', 'email_verified', { ifNotExists: true });
};

exports.down = (pgm) => {
  // Restore is_verified column
  pgm.addColumn('users', {
    is_verified: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
  });
  
  // Copy data from email_verified to is_verified
  pgm.sql('UPDATE users SET is_verified = email_verified');
  
  // Drop email verification columns
  pgm.dropColumn('users', 'email_verified_at');
  pgm.dropColumn('users', 'email_verified');
};