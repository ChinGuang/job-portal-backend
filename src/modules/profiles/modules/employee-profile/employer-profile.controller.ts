import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { EmployerProfile } from '../../entities/profile.entity';
import { CreateEmployerProfileDto } from './dto/create-employer-profile.dto';
import { EmployerProfileResponseDto } from './dto/employer-profile-response.dto';
import { UpdateEmployerProfileDto } from './dto/update-employer-profile.dto';
import { EmployerProfileRepoService } from './employer-profile-repo.service';

function toResponseDto(profile: EmployerProfile): EmployerProfileResponseDto {
  return plainToInstance(EmployerProfileResponseDto, profile, {
    excludeExtraneousValues: true,
  });
}

@Controller('/profiles/employer')
export class EmployerProfileController {
  constructor(
    private readonly employerProfileRepoService: EmployerProfileRepoService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async createProfile(
    @CurrentUser('id') userId: string,
    @Body() body: CreateEmployerProfileDto,
  ) {
    const employerProfile = await this.employerProfileRepoService.create({
      ...body,
      userId,
    });
    return employerProfile;
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async getProfile(
    @CurrentUser('id') userId: string,
  ): Promise<EmployerProfile> {
    return await this.employerProfileRepoService.readProfile(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch()
  @ApiOperation({ summary: "Update the caller's employer profile" })
  @ApiResponse({ status: 200, type: EmployerProfileResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Profile not found.' })
  async update(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateEmployerProfileDto,
  ): Promise<EmployerProfileResponseDto> {
    const profile = await this.employerProfileRepoService.update(userId, dto);
    return toResponseDto(profile);
  }
}
