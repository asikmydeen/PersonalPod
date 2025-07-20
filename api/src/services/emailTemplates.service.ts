import { config } from '../config';

export interface EmailTemplate {
  html: string;
  text: string;
  subject: string;
}

export class EmailTemplatesService {
  private readonly frontendUrl: string;
  private readonly currentYear: number;

  constructor() {
    this.frontendUrl = config.frontend.url;
    this.currentYear = new Date().getFullYear();
  }

  /**
   * Get base HTML template wrapper
   */
  private getBaseHtmlTemplate(content: string, preheader: string = ''): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PersonalPod</title>
    <!--[if mso]>
    <noscript>
        <xml>
            <o:OfficeDocumentSettings>
                <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
        </xml>
    </noscript>
    <![endif]-->
    <style>
        @media screen and (max-width: 600px) {
            .container { width: 100% !important; }
            .content { padding: 20px !important; }
            .button { width: 100% !important; text-align: center !important; }
        }
    </style>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #333333; background-color: #f7f7f7;">
    <!-- Preheader text -->
    <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">
        ${preheader}
    </div>
    
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f7f7f7;">
        <tr>
            <td align="center" style="padding: 40px 0;">
                <table class="container" role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                        <td align="center" style="padding: 30px 0; background-color: #4F46E5; border-radius: 8px 8px 0 0;">
                            <h1 style="margin: 0; font-size: 28px; font-weight: bold; color: #ffffff;">PersonalPod</h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td class="content" style="padding: 40px 30px;">
                            ${content}
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td align="center" style="padding: 30px; background-color: #f8f9fa; border-radius: 0 0 8px 8px; border-top: 1px solid #e9ecef;">
                            <p style="margin: 0 0 10px; font-size: 14px; color: #6c757d;">
                                © ${this.currentYear} PersonalPod. All rights reserved.
                            </p>
                            <p style="margin: 0; font-size: 12px; color: #6c757d;">
                                You received this email because you have an account with PersonalPod.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
  }

  /**
   * Generate button HTML
   */
  private getButtonHtml(text: string, url: string, backgroundColor: string = '#4F46E5'): string {
    return `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
        <tr>
          <td style="border-radius: 4px; background-color: ${backgroundColor};">
            <a href="${url}" target="_blank" style="display: inline-block; padding: 14px 30px; font-size: 16px; font-weight: bold; color: #ffffff; text-decoration: none; border-radius: 4px;">
              ${text}
            </a>
          </td>
        </tr>
      </table>`;
  }

  /**
   * Welcome email template
   */
  getWelcomeEmail(name: string): EmailTemplate {
    const displayName = name || 'there';
    
    const htmlContent = `
      <h2 style="margin: 0 0 20px; font-size: 24px; font-weight: bold; color: #333333;">
        Welcome to PersonalPod, ${displayName}!
      </h2>
      <p style="margin: 0 0 20px;">
        Thank you for creating an account. We're excited to have you join our community.
      </p>
      <p style="margin: 0 0 30px;">
        PersonalPod is your secure, personal data vault where you can store and manage all your important information in one place.
      </p>
      
      <h3 style="margin: 0 0 15px; font-size: 18px; font-weight: bold; color: #333333;">
        Getting Started
      </h3>
      <ul style="margin: 0 0 30px; padding-left: 20px; color: #555555;">
        <li style="margin-bottom: 10px;">Store your passwords securely</li>
        <li style="margin-bottom: 10px;">Save important documents</li>
        <li style="margin-bottom: 10px;">Organize your notes and ideas</li>
        <li style="margin-bottom: 10px;">Keep track of bookmarks and contacts</li>
      </ul>
      
      ${this.getButtonHtml('Go to Dashboard', `${this.frontendUrl}/dashboard`)}
      
      <p style="margin: 30px 0 0; font-size: 14px; color: #6c757d;">
        If you have any questions, feel free to reach out to our support team.
      </p>`;
    
    const textContent = `Welcome to PersonalPod, ${displayName}!

Thank you for creating an account. We're excited to have you join our community.

PersonalPod is your secure, personal data vault where you can store and manage all your important information in one place.

Getting Started:
- Store your passwords securely
- Save important documents
- Organize your notes and ideas
- Keep track of bookmarks and contacts

Get started: ${this.frontendUrl}/dashboard

If you have any questions, feel free to reach out to our support team.

© ${this.currentYear} PersonalPod. All rights reserved.`;
    
    return {
      subject: 'Welcome to PersonalPod!',
      html: this.getBaseHtmlTemplate(htmlContent, 'Welcome to PersonalPod! Get started with your personal data vault.'),
      text: textContent,
    };
  }

  /**
   * Email verification template
   */
  getEmailVerificationEmail(verificationToken: string, name?: string): EmailTemplate {
    const verifyUrl = `${this.frontendUrl}/verify-email?token=${verificationToken}`;
    const displayName = name || 'there';
    
    const htmlContent = `
      <h2 style="margin: 0 0 20px; font-size: 24px; font-weight: bold; color: #333333;">
        Verify Your Email Address
      </h2>
      <p style="margin: 0 0 20px;">Hi ${displayName},</p>
      <p style="margin: 0 0 30px;">
        Thanks for signing up for PersonalPod! Please confirm your email address by clicking the button below:
      </p>
      
      ${this.getButtonHtml('Verify Email Address', verifyUrl)}
      
      <p style="margin: 30px 0 20px; font-size: 14px; color: #6c757d;">
        Or copy and paste this link into your browser:
      </p>
      <p style="margin: 0 0 30px; font-size: 14px; word-break: break-all; color: #4F46E5;">
        ${verifyUrl}
      </p>
      
      <hr style="border: none; border-top: 1px solid #e9ecef; margin: 30px 0;">
      
      <p style="margin: 0 0 10px; font-size: 14px; color: #6c757d;">
        <strong>Why verify?</strong>
      </p>
      <p style="margin: 0 0 20px; font-size: 14px; color: #6c757d;">
        Verifying your email helps us ensure the security of your account and enables important notifications.
      </p>
      
      <p style="margin: 0; font-size: 14px; color: #dc3545;">
        <strong>Note:</strong> This link will expire in 24 hours.
      </p>`;
    
    const textContent = `Verify Your Email Address

Hi ${displayName},

Thanks for signing up for PersonalPod! Please confirm your email address by visiting the link below:

${verifyUrl}

Why verify?
Verifying your email helps us ensure the security of your account and enables important notifications.

Note: This link will expire in 24 hours.

© ${this.currentYear} PersonalPod. All rights reserved.`;
    
    return {
      subject: 'Verify Your Email - PersonalPod',
      html: this.getBaseHtmlTemplate(htmlContent, 'Please verify your email address for PersonalPod'),
      text: textContent,
    };
  }

  /**
   * Password reset email template
   */
  getPasswordResetEmail(resetToken: string, userEmail?: string): EmailTemplate {
    const resetUrl = `${this.frontendUrl}/reset-password?token=${resetToken}`;
    const timestamp = new Date().toLocaleString();
    
    const htmlContent = `
      <h2 style="margin: 0 0 20px; font-size: 24px; font-weight: bold; color: #333333;">
        Password Reset Request
      </h2>
      <p style="margin: 0 0 30px;">
        We received a request to reset your password for your PersonalPod account. Click the button below to create a new password:
      </p>
      
      ${this.getButtonHtml('Reset Password', resetUrl)}
      
      <p style="margin: 30px 0 20px; font-size: 14px; color: #6c757d;">
        Or copy and paste this link into your browser:
      </p>
      <p style="margin: 0 0 30px; font-size: 14px; word-break: break-all; color: #4F46E5;">
        <a href="${resetUrl}" style="color: #4F46E5; text-decoration: none;">${resetUrl}</a>
      </p>
      
      <hr style="border: none; border-top: 1px solid #e9ecef; margin: 30px 0;">
      
      <div style="background-color: #fff5f5; border-left: 4px solid #dc3545; padding: 15px; margin: 0 0 20px; border-radius: 4px;">
        <p style="margin: 0 0 10px; font-size: 14px; color: #dc3545;">
          <strong>⚠️ Important Security Information:</strong>
        </p>
        <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #6c757d;">
          <li style="margin-bottom: 5px;">This link will expire in <strong>1 hour</strong></li>
          <li style="margin-bottom: 5px;">This link can only be used <strong>once</strong></li>
          <li style="margin-bottom: 5px;">Request made at: <strong>${timestamp}</strong></li>
          <li style="margin-bottom: 5px;">If you didn't request this, your account is still secure</li>
          <li style="margin-bottom: 5px;">Your password won't change until you create a new one</li>
        </ul>
      </div>
      
      <div style="background-color: #e7f3ff; border-left: 4px solid #2196F3; padding: 15px; margin: 0 0 20px; border-radius: 4px;">
        <p style="margin: 0 0 10px; font-size: 14px; color: #1976D2;">
          <strong>🔒 Security Tips:</strong>
        </p>
        <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #555555;">
          <li style="margin-bottom: 5px;">Use a strong, unique password</li>
          <li style="margin-bottom: 5px;">Never share your password with anyone</li>
          <li style="margin-bottom: 5px;">Enable two-factor authentication for extra security</li>
        </ul>
      </div>
      
      <p style="margin: 0; font-size: 14px; color: #6c757d; text-align: center;">
        If you're having trouble with the button above, copy and paste the URL into your web browser.
      </p>`;
    
    const textContent = `Password Reset Request

We received a request to reset your password for your PersonalPod account. Visit the link below to create a new password:

${resetUrl}

Important Security Information:
- This link will expire in 1 hour
- This link can only be used once
- Request made at: ${timestamp}
- If you didn't request this, your account is still secure
- Your password won't change until you create a new one

Security Tips:
- Use a strong, unique password
- Never share your password with anyone
- Enable two-factor authentication for extra security

If you're having trouble clicking the link, copy and paste the URL into your web browser.

© ${this.currentYear} PersonalPod. All rights reserved.`;
    
    return {
      subject: 'Password Reset Request - PersonalPod',
      html: this.getBaseHtmlTemplate(htmlContent, 'Reset your PersonalPod password'),
      text: textContent,
    };
  }

  /**
   * Email change notification template
   */
  getEmailChangeNotificationEmail(oldEmail: string, newEmail: string): EmailTemplate {
    const htmlContent = `
      <h2 style="margin: 0 0 20px; font-size: 24px; font-weight: bold; color: #333333;">
        Email Address Changed
      </h2>
      <p style="margin: 0 0 30px;">
        This is to confirm that your email address has been changed.
      </p>
      
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 4px; margin: 0 0 30px;">
        <p style="margin: 0 0 10px; font-size: 14px;">
          <strong>Old email:</strong> ${oldEmail}
        </p>
        <p style="margin: 0; font-size: 14px;">
          <strong>New email:</strong> ${newEmail}
        </p>
      </div>
      
      <div style="background-color: #fff5f5; border-left: 4px solid #dc3545; padding: 15px; margin: 0 0 30px;">
        <p style="margin: 0 0 10px; color: #dc3545;">
          <strong>Didn't make this change?</strong>
        </p>
        <p style="margin: 0;">
          If you didn't request this change, please contact our support team immediately. Your account security is important to us.
        </p>
      </div>
      
      ${this.getButtonHtml('Contact Support', `${this.frontendUrl}/support`, '#dc3545')}`;
    
    const textContent = `Email Address Changed

This is to confirm that your email address has been changed.

Old email: ${oldEmail}
New email: ${newEmail}

Didn't make this change?
If you didn't request this change, please contact our support team immediately at ${this.frontendUrl}/support. Your account security is important to us.

© ${this.currentYear} PersonalPod. All rights reserved.`;
    
    return {
      subject: 'Email Address Changed - PersonalPod',
      html: this.getBaseHtmlTemplate(htmlContent, 'Your PersonalPod email address has been changed'),
      text: textContent,
    };
  }

  /**
   * Password changed notification template
   */
  getPasswordChangedEmail(email: string): EmailTemplate {
    const timestamp = new Date().toLocaleString();
    const deviceInfo = 'Web Browser'; // In a real implementation, you might pass device/browser info
    
    const htmlContent = `
      <h2 style="margin: 0 0 20px; font-size: 24px; font-weight: bold; color: #333333;">
        Password Changed Successfully
      </h2>
      <p style="margin: 0 0 30px;">
        Your PersonalPod password has been changed successfully. As a security measure, you have been logged out of all devices.
      </p>
      
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 4px; margin: 0 0 30px;">
        <h3 style="margin: 0 0 15px; font-size: 16px; font-weight: bold;">Change Details:</h3>
        <p style="margin: 0 0 10px; font-size: 14px;">
          <strong>Account:</strong> ${email}
        </p>
        <p style="margin: 0 0 10px; font-size: 14px;">
          <strong>Changed at:</strong> ${timestamp}
        </p>
        <p style="margin: 0; font-size: 14px;">
          <strong>Device:</strong> ${deviceInfo}
        </p>
      </div>
      
      <div style="background-color: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 0 0 20px; border-radius: 4px;">
        <p style="margin: 0 0 10px; font-size: 14px; color: #155724;">
          <strong>✓ What happens next:</strong>
        </p>
        <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #155724;">
          <li style="margin-bottom: 5px;">All your sessions have been terminated</li>
          <li style="margin-bottom: 5px;">You'll need to log in again with your new password</li>
          <li style="margin-bottom: 5px;">Any remember me sessions have been cleared</li>
        </ul>
      </div>
      
      <div style="background-color: #fff5f5; border-left: 4px solid #dc3545; padding: 15px; margin: 0 0 30px; border-radius: 4px;">
        <p style="margin: 0 0 10px; color: #dc3545;">
          <strong>⚠️ Didn't change your password?</strong>
        </p>
        <p style="margin: 0 0 15px;">
          If you didn't make this change, your account may be compromised. Take these steps immediately:
        </p>
        <ol style="margin: 0; padding-left: 20px; font-size: 14px; color: #6c757d;">
          <li style="margin-bottom: 5px;">Reset your password using the button below</li>
          <li style="margin-bottom: 5px;">Check your account for any unauthorized activity</li>
          <li style="margin-bottom: 5px;">Enable two-factor authentication</li>
          <li style="margin-bottom: 5px;">Contact our support team</li>
        </ol>
      </div>
      
      ${this.getButtonHtml('Reset Password Now', `${this.frontendUrl}/forgot-password`, '#dc3545')}
      
      <p style="margin: 30px 0 0; font-size: 14px; color: #6c757d; text-align: center;">
        For additional security, consider enabling two-factor authentication in your account settings.
      </p>`;
    
    const textContent = `Password Changed Successfully

Your PersonalPod password has been changed successfully. As a security measure, you have been logged out of all devices.

Change Details:
- Account: ${email}
- Changed at: ${timestamp}
- Device: ${deviceInfo}

What happens next:
- All your sessions have been terminated
- You'll need to log in again with your new password
- Any remember me sessions have been cleared

Didn't change your password?
If you didn't make this change, your account may be compromised. Take these steps immediately:
1. Reset your password at ${this.frontendUrl}/forgot-password
2. Check your account for any unauthorized activity
3. Enable two-factor authentication
4. Contact our support team

For additional security, consider enabling two-factor authentication in your account settings.

© ${this.currentYear} PersonalPod. All rights reserved.`;
    
    return {
      subject: 'Password Changed - PersonalPod',
      html: this.getBaseHtmlTemplate(htmlContent, 'Your PersonalPod password has been changed'),
      text: textContent,
    };
  }

  /**
   * Account deactivated email template
   */
  getAccountDeactivatedEmail(email: string): EmailTemplate {
    const htmlContent = `
      <h2 style="margin: 0 0 20px; font-size: 24px; font-weight: bold; color: #333333;">
        Account Deactivated
      </h2>
      <p style="margin: 0 0 30px;">
        Your PersonalPod account has been deactivated as requested.
      </p>
      
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 4px; margin: 0 0 30px;">
        <h3 style="margin: 0 0 10px; font-size: 16px; font-weight: bold;">What this means:</h3>
        <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #555555;">
          <li style="margin-bottom: 5px;">You can no longer sign in to your account</li>
          <li style="margin-bottom: 5px;">Your data is preserved but not accessible</li>
          <li style="margin-bottom: 5px;">You can reactivate your account anytime within 30 days</li>
          <li style="margin-bottom: 5px;">After 30 days, your account and data will be permanently deleted</li>
        </ul>
      </div>
      
      <p style="margin: 0 0 20px;">
        If you change your mind, you can reactivate your account by signing in within the next 30 days.
      </p>
      
      ${this.getButtonHtml('Reactivate Account', `${this.frontendUrl}/login`)}
      
      <p style="margin: 30px 0 0; font-size: 14px; color: #6c757d;">
        We're sorry to see you go. If you have any feedback about your experience, we'd love to hear from you.
      </p>`;
    
    const textContent = `Account Deactivated

Your PersonalPod account has been deactivated as requested.

What this means:
- You can no longer sign in to your account
- Your data is preserved but not accessible
- You can reactivate your account anytime within 30 days
- After 30 days, your account and data will be permanently deleted

If you change your mind, you can reactivate your account by signing in at ${this.frontendUrl}/login within the next 30 days.

We're sorry to see you go. If you have any feedback about your experience, we'd love to hear from you.

© ${this.currentYear} PersonalPod. All rights reserved.`;
    
    return {
      subject: 'Account Deactivated - PersonalPod',
      html: this.getBaseHtmlTemplate(htmlContent, 'Your PersonalPod account has been deactivated'),
      text: textContent,
    };
  }
}

export const emailTemplatesService = new EmailTemplatesService();