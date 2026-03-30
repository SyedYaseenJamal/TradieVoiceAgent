import { Injectable, Logger } from '@nestjs/common';

/**
 * Mock email service.
 * In production, replace the console.log calls with a real
 * transporter (e.g., nodemailer + SMTP, SendGrid, AWS SES).
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const link = `http://localhost:5000/api/auth/verify-email?token=${token}`;
    this.logger.log(`[MOCK EMAIL] Verification email sent to ${email}`);
    this.logger.log(`[MOCK EMAIL] Verification link: ${link}`);
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const link = `http://localhost:5000/api/auth/reset-password?token=${token}`;
    this.logger.log(`[MOCK EMAIL] Password reset email sent to ${email}`);
    this.logger.log(`[MOCK EMAIL] Reset link: ${link}`);
  }
}
