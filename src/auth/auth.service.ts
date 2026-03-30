import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { User, UserDocument } from './schemas/user.schema';
import {
  RefreshToken,
  RefreshTokenDocument,
} from './schemas/refresh-token.schema';
import { RegisterDto } from './dtos/register.dto';
import { LoginDto } from './dtos/login.dto';
import { ForgotPasswordDto } from './dtos/forgot-password.dto';
import { ResetPasswordDto } from './dtos/reset-password.dto';
import { ChangePasswordDto } from './dtos/change-password.dto';
import { EmailService } from '../common/services/email.service';
import { generateToken, getExpiryDate } from './utils/token.util';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(RefreshToken.name)
    private readonly refreshTokenModel: Model<RefreshTokenDocument>,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

  // ─── REGISTER ─────────────────────────────────────────────────

  async register(dto: RegisterDto) {
    // Check if email already exists
    const existing = await this.userModel.findOne({ email: dto.email });
    if (existing) {
      throw new BadRequestException('Email already registered');
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(dto.password, 12);

    // Generate email verification token
    const emailVerificationToken = generateToken();

    // Create user
    const user = await this.userModel.create({
      ...dto,
      password: hashedPassword,
      emailVerificationToken,
    });

    // Send verification email (mock)
    await this.emailService.sendVerificationEmail(
      user.email,
      emailVerificationToken,
    );

    this.logger.log(`User registered: ${user.email}`);

    return {
      message:
        'Registration successful. Please check your email to verify your account.',
      userId: user._id,
    };
  }

  // ─── LOGIN ────────────────────────────────────────────────────

  async login(dto: LoginDto) {
    // Find user by email
    const user = await this.userModel.findOne({ email: dto.email });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Compare password
    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Generate access token (15 min)
    const accessToken = this.jwtService.sign({
      sub: user._id,
      email: user.email,
    });

    // Generate refresh token (7 days) and store in DB
    const refreshTokenValue = generateToken();
    await this.refreshTokenModel.create({
      userId: user._id,
      token: refreshTokenValue,
      expiresAt: getExpiryDate(7),
    });

    this.logger.log(`User logged in: ${user.email}`);

    return {
      accessToken,
      refreshToken: refreshTokenValue,
      user: {
        id: user._id,
        email: user.email,
        customerName: user.customerName,
        emailVerified: user.emailVerified,
      },
    };
  }

  // ─── LOGOUT ───────────────────────────────────────────────────

  async logout(refreshToken: string) {
    const token = await this.refreshTokenModel.findOne({
      token: refreshToken,
    });
    if (!token) {
      throw new BadRequestException('Invalid refresh token');
    }

    token.isRevoked = true;
    await token.save();

    return { message: 'Logged out successfully' };
  }

  // ─── REFRESH TOKEN ────────────────────────────────────────────

  async refreshToken(refreshTokenValue: string) {
    const storedToken = await this.refreshTokenModel.findOne({
      token: refreshTokenValue,
      isRevoked: false,
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired or invalid');
    }

    // Find the user
    const user = await this.userModel.findById(storedToken.userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Issue new access token
    const accessToken = this.jwtService.sign({
      sub: user._id,
      email: user.email,
    });

    return { accessToken };
  }

  // ─── EMAIL VERIFICATION ───────────────────────────────────────

  async verifyEmail(token: string) {
    const user = await this.userModel.findOne({
      emailVerificationToken: token,
    });

    if (!user) {
      throw new BadRequestException('Invalid verification token');
    }

    user.emailVerified = true;
    user.emailVerificationToken = null as any;
    await user.save();

    this.logger.log(`Email verified: ${user.email}`);

    return { message: 'Email verified successfully' };
  }

  // ─── FORGOT PASSWORD ──────────────────────────────────────────

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.userModel.findOne({ email: dto.email });
    if (!user) {
      // Don't reveal whether email exists
      return { message: 'If the email exists, a reset link has been sent.' };
    }

    const resetToken = generateToken();
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpiry = getExpiryDate(1); // 1 day
    await user.save();

    await this.emailService.sendPasswordResetEmail(user.email, resetToken);

    return { message: 'If the email exists, a reset link has been sent.' };
  }

  // ─── RESET PASSWORD ───────────────────────────────────────────

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.userModel.findOne({
      resetPasswordToken: dto.token,
    });

    if (!user || user.resetPasswordExpiry < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    user.password = await bcrypt.hash(dto.newPassword, 12);
    user.resetPasswordToken = null as any;
    user.resetPasswordExpiry = null as any;
    await user.save();

    this.logger.log(`Password reset for: ${user.email}`);

    return { message: 'Password reset successfully' };
  }

  // ─── CHANGE PASSWORD (AUTHENTICATED) ──────────────────────────

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isMatch = await bcrypt.compare(dto.oldPassword, user.password);
    if (!isMatch) {
      throw new BadRequestException('Old password is incorrect');
    }

    user.password = await bcrypt.hash(dto.newPassword, 12);
    await user.save();

    this.logger.log(`Password changed for: ${user.email}`);

    return { message: 'Password changed successfully' };
  }
}
