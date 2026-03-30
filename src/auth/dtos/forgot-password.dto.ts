import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'tradie@example.com' })
  @IsNotEmpty()
  @IsEmail()
  email: string;
}
