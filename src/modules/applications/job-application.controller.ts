import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SwaggerTag } from '../../common/constants/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentJobSeekerProfile } from '../profiles/decorators/current-job-seeker-profile.decorator';
import { JobSeekerProfileGuard } from '../profiles/guards/job-seeker-profile.guard';
import { JobSeekerProfile } from '../profiles/entities/profile.entity';
import { toApplicationDto } from './mappers/application.mapper';
import { ApplicationResponseDto } from './dto/application-response.dto';
import { CreateApplicationDto } from './dto/create-application.dto';
import { ApplicationRepoService } from './services/application-repo.service';

/**
 * Applying lives under the listing — it is something you do *to* a job — while
 * reading applications back lives under `/applications`, because by then the
 * application is the thing the seeker is looking at. Two paths, so two
 * controllers, rather than one controller answering on both.
 */
@ApiTags(SwaggerTag.APPLICATIONS)
@Controller('jobs/:jobId/applications')
@UseGuards(JwtAuthGuard, JobSeekerProfileGuard)
export class JobApplicationController {
  constructor(
    private readonly applicationRepoService: ApplicationRepoService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Apply to a published job listing',
    description:
      'Job seekers only. The cover letter is optional. The résumé recorded ' +
      'against the application is the one named by `resumeUrl`, falling back ' +
      "to the caller's profile résumé; no file is copied, so replacing the " +
      'profile résumé later changes what the employer sees here. Only a ' +
      '`PUBLISHED` listing accepts applications, and only one application ' +
      'per listing per seeker is allowed.',
  })
  @ApiResponse({ status: 201, type: ApplicationResponseDto })
  @ApiResponse({
    status: 400,
    description:
      'Malformed body, or no résumé on the request and none on the profile.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'No job seeker profile.' })
  @ApiResponse({
    status: 404,
    description: 'Job listing not found, or not publicly visible.',
  })
  @ApiResponse({
    status: 409,
    description:
      'Already applied to this listing, or the listing has stopped ' +
      'accepting applications.',
  })
  async create(
    @CurrentJobSeekerProfile() profile: JobSeekerProfile,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Body() dto: CreateApplicationDto,
  ): Promise<ApplicationResponseDto> {
    const application = await this.applicationRepoService.create(
      jobId,
      profile,
      dto,
    );
    return toApplicationDto(application);
  }
}
