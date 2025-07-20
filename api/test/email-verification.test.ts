import { emailService } from '../src/services/email.service';
import { emailTemplatesService } from '../src/services/emailTemplates.service';
import { verificationTokenService } from '../src/services/verificationToken.service';

// Test email templates
async function testEmailTemplates() {
  console.log('Testing Email Templates...\n');

  // Test Welcome Email
  const welcomeTemplate = emailTemplatesService.getWelcomeEmail('John');
  console.log('Welcome Email Subject:', welcomeTemplate.subject);
  console.log('Welcome Email Preview:', welcomeTemplate.text.substring(0, 200) + '...\n');

  // Test Verification Email
  const verificationTemplate = emailTemplatesService.getEmailVerificationEmail('test-token-123', 'Jane');
  console.log('Verification Email Subject:', verificationTemplate.subject);
  console.log('Verification Email Preview:', verificationTemplate.text.substring(0, 200) + '...\n');

  // Test Password Reset Email
  const resetTemplate = emailTemplatesService.getPasswordResetEmail('reset-token-456');
  console.log('Password Reset Email Subject:', resetTemplate.subject);
  console.log('Password Reset Email Preview:', resetTemplate.text.substring(0, 200) + '...\n');

  // Test Email Change Notification
  const changeTemplate = emailTemplatesService.getEmailChangeNotificationEmail('old@example.com', 'new@example.com');
  console.log('Email Change Subject:', changeTemplate.subject);
  console.log('Email Change Preview:', changeTemplate.text.substring(0, 200) + '...\n');
}

// Test email sending (will log to console in development)
async function testEmailSending() {
  console.log('Testing Email Sending (Console Output in Dev)...\n');

  try {
    // Test sending welcome email
    await emailService.sendWelcomeEmail('test@example.com', 'Test User');
    console.log('✓ Welcome email sent successfully\n');

    // Test sending verification email
    await emailService.sendEmailVerification('test@example.com', 'test-verification-token', 'Test User');
    console.log('✓ Verification email sent successfully\n');

    // Test sending password reset email
    await emailService.sendPasswordResetEmail('test@example.com', 'test-reset-token');
    console.log('✓ Password reset email sent successfully\n');

    // Test sending email change notification
    await emailService.sendEmailChangeNotification('old@example.com', 'new@example.com');
    console.log('✓ Email change notification sent successfully\n');

  } catch (error) {
    console.error('Error testing email sending:', error);
  }
}

// Test token generation
async function testTokenGeneration() {
  console.log('Testing Token Generation...\n');

  // Note: This requires database connection
  try {
    // Mock user ID for testing
    const testUserId = 'test-user-id-123';

    // Test email verification token
    const verificationToken = await verificationTokenService.createToken(testUserId, 'email_verification');
    console.log('Email Verification Token:', {
      id: verificationToken.id,
      userId: verificationToken.userId,
      type: verificationToken.type,
      tokenLength: verificationToken.token.length,
      expiresAt: verificationToken.expiresAt
    });

    // Test password reset token
    const resetToken = await verificationTokenService.createToken(testUserId, 'password_reset');
    console.log('\nPassword Reset Token:', {
      id: resetToken.id,
      userId: resetToken.userId,
      type: resetToken.type,
      tokenLength: resetToken.token.length,
      expiresAt: resetToken.expiresAt
    });

    // Test token validation
    const validatedToken = await verificationTokenService.validateToken(verificationToken.token, 'email_verification');
    console.log('\nToken Validation Success:', validatedToken.id === verificationToken.id);

  } catch (error) {
    console.error('Note: Token generation test requires database connection');
    console.error('Error:', error.message);
  }
}

// Run all tests
async function runTests() {
  console.log('=== PersonalPod Email Verification System Test ===\n');

  await testEmailTemplates();
  console.log('\n' + '='.repeat(50) + '\n');

  await testEmailSending();
  console.log('\n' + '='.repeat(50) + '\n');

  await testTokenGeneration();
  console.log('\n' + '='.repeat(50) + '\n');

  console.log('Testing complete!');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

export { testEmailTemplates, testEmailSending, testTokenGeneration };