import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiOperation,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SwaggerTag } from '../../common/constants/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { User } from '../users/entities/user.entity';

// Response DTO for Swagger schema definition
export class UserDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'User UUID from token sub',
  })
  id!: string;

  @ApiProperty({ example: 'user@example.com' })
  email!: string;
}

export class MeResponseDto {
  @ApiProperty({ type: UserDto })
  user!: UserDto;
}
@ApiTags(SwaggerTag.COMMON)
@Controller()
export class AuthController {
  constructor() {}

  @Get('/me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  @ApiResponse({
    status: 200,
    description: 'Returns the currently authenticated user profile.',
    type: MeResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized. Token missing, expired, or invalid.',
  })
  me(@CurrentUser() user: User) {
    return {
      user,
    };
  }
}
