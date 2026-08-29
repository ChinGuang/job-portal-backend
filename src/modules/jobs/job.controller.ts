import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { SwaggerTag } from '../../common/constants/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentEmployerProfile } from '../profiles/decorators/current-employer-profile.decorator';
import { EmployerProfileGuard } from '../profiles/guards/employer-profile.guard';
import { LOGO_SIGNED_URL_TTL_SECONDS } from '../profiles/modules/employee-profile/domain/logo-key';
import type { StorageService } from '../storage/storage.service.interface';
import { STORAGE_SERVICE } from '../storage/storage.tokens';
import { BrowseJobsQueryDto } from './dto/browse-jobs-query.dto';
import { CreateJobDto } from './dto/create-job.dto';
import { JobListResponseDto } from './dto/job-list-response.dto';
import { JobResponseDto } from './dto/job-response.dto';
import { ListMyJobsQueryDto } from './dto/list-my-jobs-query.dto';
import { PublicJobDetailResponseDto } from './dto/public-job-detail-response.dto';
import { UpdateJobStatusDto } from './dto/update-job-status.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { Job } from './entities/job.entity';
import { JobRepoService } from './services/job-repo.service';

function toResponseDto(job: Job): JobResponseDto {
  return plainToInstance(JobResponseDto, job, {
    excludeExtraneousValues: true,
  });
}

// Guards are declared per route rather than on the controller: `GET /jobs` and
// `GET /jobs/:id` land on this same path and are public, so a controller-wide
// employer guard would be a trap for whoever adds them.
@ApiTags(SwaggerTag.JOBS)
@Controller('jobs')
export class JobController {
  constructor(
    private readonly jobRepoService: JobRepoService,
    @Inject(STORAGE_SERVICE)
    private readonly storageService: StorageService,
  ) {}

  // The embedded company's logoUrl is a private-bucket object path, not a
  // fetchable URL — this exchanges it for a short-lived signed URL the moment
  // before the detail goes out, so even an anonymous visitor gets a working
  // link. Mirrors the owner-facing signing in EmployerProfileController.
  private async toPublicDetailDto(
    job: Job,
  ): Promise<PublicJobDetailResponseDto> {
    const dto = plainToInstance(PublicJobDetailResponseDto, job, {
      excludeExtraneousValues: true,
    });
    if (dto.employer?.logoUrl) {
      dto.employer.logoUrl = await this.storageService.createSignedUrl(
        dto.employer.logoUrl,
        LOGO_SIGNED_URL_TTL_SECONDS,
      );
    }
    return dto;
  }

  @Get()
  @ApiOperation({
    summary: 'Browse published job listings',
    description:
      'Open to anyone, with or without a token. Only `PUBLISHED` listings ' +
      'appear: a `CLOSED` one stays readable by its own link but is not ' +
      'offered here, because nobody can apply to it. `jobType`, `location` ' +
      'and `keyword` narrow the page and all three may be combined.',
  })
  @ApiResponse({ status: 200, type: JobListResponseDto })
  @ApiResponse({ status: 400, description: 'Malformed query parameters.' })
  async browse(
    @Query() query: BrowseJobsQueryDto,
  ): Promise<JobListResponseDto> {
    const { items, total } = await this.jobRepoService.findPublished(query);
    return { items: items.map(toResponseDto), total };
  }

  @Post()
  @UseGuards(JwtAuthGuard, EmployerProfileGuard)
  @ApiOperation({ summary: 'Create a job listing (always as a DRAFT)' })
  @ApiResponse({ status: 201, type: JobResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'No employer profile.' })
  async create(
    @CurrentEmployerProfile('id') employerProfileId: string,
    @Body() dto: CreateJobDto,
  ): Promise<JobResponseDto> {
    const job = await this.jobRepoService.create(employerProfileId, dto);
    return toResponseDto(job);
  }

  // Declared before `:id` routes so that "mine" is never read as an id.
  @Get('mine')
  @UseGuards(JwtAuthGuard, EmployerProfileGuard)
  @ApiOperation({
    summary: "List all of the caller's own listings, in every status",
  })
  @ApiResponse({ status: 200, type: JobListResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'No employer profile.' })
  async findMine(
    @CurrentEmployerProfile('id') employerProfileId: string,
    @Query() query: ListMyJobsQueryDto,
  ): Promise<JobListResponseDto> {
    const { items, total } = await this.jobRepoService.findAllByEmployer(
      employerProfileId,
      query,
    );
    return { items: items.map(toResponseDto), total };
  }

  // Declared after `mine` so that route never falls through to this one, and
  // before the authenticated `:id` routes purely to keep the public pair
  // readable together.
  @Get(':id')
  @ApiOperation({
    summary: 'Open one job listing, with the company behind it',
    description:
      'Open to anyone. A `CLOSED` listing is returned so that a candidate ' +
      'following an old link learns the role has ended; a `DRAFT` or ' +
      '`ARCHIVED` one is a 404, because to a visitor it does not exist.',
  })
  @ApiResponse({ status: 200, type: PublicJobDetailResponseDto })
  @ApiResponse({ status: 400, description: 'Malformed id.' })
  @ApiResponse({ status: 404, description: 'Job listing not found.' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PublicJobDetailResponseDto> {
    const job = await this.jobRepoService.findPubliclyVisible(id);
    return this.toPublicDetailDto(job);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, EmployerProfileGuard)
  @ApiOperation({ summary: "Edit the content of one of the caller's listings" })
  @ApiResponse({ status: 200, type: JobResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 403,
    description: "No employer profile, or another company's listing.",
  })
  @ApiResponse({ status: 404, description: 'Job listing not found.' })
  @ApiResponse({
    status: 409,
    description: 'The listing is archived and can no longer be edited.',
  })
  async update(
    @CurrentEmployerProfile('id') employerProfileId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateJobDto,
  ): Promise<JobResponseDto> {
    const job = await this.jobRepoService.update(id, employerProfileId, dto);
    return toResponseDto(job);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, EmployerProfileGuard)
  @ApiOperation({
    summary: "Move one of the caller's listings along its lifecycle",
    description:
      '`DRAFT` → `PUBLISHED` publishes a listing and `PUBLISHED` → `CLOSED` ' +
      'stops it accepting applications while it stays publicly readable. ' +
      'Archiving is done with `DELETE /jobs/:id`.',
  })
  @ApiResponse({ status: 200, type: JobResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 403,
    description: "No employer profile, or another company's listing.",
  })
  @ApiResponse({ status: 404, description: 'Job listing not found.' })
  @ApiResponse({
    status: 409,
    description: 'The listing cannot move to that status from its current one.',
  })
  async changeStatus(
    @CurrentEmployerProfile('id') employerProfileId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateJobStatusDto,
  ): Promise<JobResponseDto> {
    const job = await this.jobRepoService.changeStatus(
      id,
      employerProfileId,
      dto.status,
    );
    return toResponseDto(job);
  }

  // Returns the archived listing rather than 204: "deleting" here means the
  // listing moved to ARCHIVED, and handing back the row says so plainly.
  @Delete(':id')
  @UseGuards(JwtAuthGuard, EmployerProfileGuard)
  @ApiOperation({
    summary: "Delete one of the caller's listings by archiving it",
    description:
      'A soft operation: the listing becomes `ARCHIVED` and stops being ' +
      'publicly visible, but the row is never removed, so application ' +
      'history survives. Archiving an archived listing changes nothing.',
  })
  @ApiResponse({ status: 200, type: JobResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 403,
    description: "No employer profile, or another company's listing.",
  })
  @ApiResponse({ status: 404, description: 'Job listing not found.' })
  async remove(
    @CurrentEmployerProfile('id') employerProfileId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<JobResponseDto> {
    const job = await this.jobRepoService.archive(id, employerProfileId);
    return toResponseDto(job);
  }
}
