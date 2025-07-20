import { logger } from '../utils/logger';
import * as AWS from 'aws-sdk';
import { config } from '../config';
import { emailTemplatesService } from './emailTemplates.service';

export interface EmailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

export class EmailService {
  private from: string;
  private ses: AWS.SES | null = null;

  constructor() {
    this.from = process.env.EMAIL_FROM || 'noreply@personalpod.com';
    
    // Initialize AWS SES if in production or if AWS credentials are configured
    if (process.env.NODE_ENV === 'production' || process.env.AWS_ACCESS_KEY_ID) {
      AWS.config.update({
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey,
        region: config.aws.region,
      });
      
      this.ses = new AWS.SES({
        apiVersion: '2010-12-01',
      });
    }
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      // Use AWS SES if available
      if (this.ses) {
        const params: AWS.SES.SendEmailRequest = {
          Source: this.from,
          Destination: {
            ToAddresses: [options.to],
          },
          Message: {
            Subject: {
              Data: options.subject,
              Charset: 'UTF-8',
            },
            Body: {},
          },
        };

        if (options.html) {
          params.Message.Body.Html = {
            Data: options.html,
            Charset: 'UTF-8',
          };
        }

        if (options.text) {
          params.Message.Body.Text = {
            Data: options.text,
            Charset: 'UTF-8',
          };
        }

        await this.ses.sendEmail(params).promise();
        logger.info(`Email sent successfully to: ${options.to}`);
      } else {
        // Fallback for development
        logger.info(`Email would be sent to: ${options.to}, Subject: ${options.subject}`);
        
        if (process.env.NODE_ENV === 'development') {
          console.log('\n=== Email Debug ===');
          console.log('To:', options.to);
          console.log('From:', this.from);
          console.log('Subject:', options.subject);
          if (options.html) {
            console.log('\nHTML Content:');
            console.log(options.html);
          }
          if (options.text) {
            console.log('\nText Content:');
            console.log(options.text);
          }
          console.log('==================\n');
        }
      }
    } catch (error) {
      logger.error('Failed to send email:', error);
      throw error;
    }
  }


  async sendWelcomeEmail(email: string, name: string): Promise<void> {
    const template = emailTemplatesService.getWelcomeEmail(name);
    
    await this.sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  async sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
    const template = emailTemplatesService.getPasswordResetEmail(resetToken);
    
    await this.sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  async sendEmailVerification(email: string, verificationToken: string, name?: string): Promise<void> {
    const template = emailTemplatesService.getEmailVerificationEmail(verificationToken, name);
    
    await this.sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  async sendEmailChangeNotification(oldEmail: string, newEmail: string): Promise<void> {
    const template = emailTemplatesService.getEmailChangeNotificationEmail(oldEmail, newEmail);
    
    // Send notification to old email
    await this.sendEmail({
      to: oldEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }
  
  async sendPasswordChangedNotification(email: string): Promise<void> {
    const template = emailTemplatesService.getPasswordChangedEmail(email);
    
    await this.sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }
}

export const emailService = new EmailService();