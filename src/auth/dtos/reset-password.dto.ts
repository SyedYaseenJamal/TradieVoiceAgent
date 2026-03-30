import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ example: 'reset-token-123' })
  @IsNotEmpty()
  @IsString()
  token: string;

  @ApiProperty({ example: 'NewPassword123!' })
  @IsNotEmpty()
  @MinLength(8)
  newPassword: string;
}
