import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SwaggerTag } from '../../common/constants/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { User } from '../users/entities/user.entity';
import { CreateJobSeekerProfileDto } from './dto/create-job-seeker-profile.dto';
import { JobSeekerProfileResponseDto } from './dto/job-seeker-profile-response.dto';
import { UpdateJobSeekerProfileDto } from './dto/update-job-seeker-profile.dto';
import { JobSeekerProfile } from './entities/job-seeker-profile.entity';
import { JobSeekerProfileService } from './services/job-seeker-profile.service';

function toResponseDto(profile: JobSeekerProfile): JobSeekerProfileResponseDto {
  return new JobSeekerProfileResponseDto({
    id: profile.id,
    userId: profile.userId,
    name: profile.name,
    headline: profile.headline,
    bio: profile.bio,
    phone: profile.phone,
    skills: profile.skills,
    yearsOfExperience: profile.yearsOfExperience,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  });
}

@ApiTags(SwaggerTag.PROFILES)
@Controller('profiles/job-seeker')
@UseGuards(JwtAuthGuard)
export class JobSeekerProfileController {
  constructor(private readonly service: JobSeekerProfileService) {}

  @Post()
  @ApiOperation({ summary: "Create the caller's job seeker profile" })
  @ApiResponse({ status: 201, type: JobSeekerProfileResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 409, description: 'Profile already exists.' })
  async create(
    @CurrentUser() user: User,
    @Body() dto: CreateJobSeekerProfileDto,
  ): Promise<JobSeekerProfileResponseDto> {
    const profile = await this.service.create(user.id, dto);
    return toResponseDto(profile);
  }

  @Get()
  @ApiOperation({ summary: "Get the caller's job seeker profile" })
  @ApiResponse({ status: 200, type: JobSeekerProfileResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Profile not found.' })
  async findMine(
    @CurrentUser() user: User,
  ): Promise<JobSeekerProfileResponseDto> {
    const profile = await this.service.findByUserId(user.id);
    return toResponseDto(profile);
  }

  @Patch()
  @ApiOperation({ summary: "Update the caller's job seeker profile" })
  @ApiResponse({ status: 200, type: JobSeekerProfileResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Profile not found.' })
  async update(
    @CurrentUser() user: User,
    @Body() dto: UpdateJobSeekerProfileDto,
  ): Promise<JobSeekerProfileResponseDto> {
    const profile = await this.service.update(user.id, dto);
    return toResponseDto(profile);
  }
}
