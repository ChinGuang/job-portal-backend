import {
  Body,
  Controller,
  Delete,
  Get,
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
import { CreateJobDto } from './dto/create-job.dto';
import { JobListResponseDto } from './dto/job-list-response.dto';
import { JobResponseDto } from './dto/job-response.dto';
import { ListMyJobsQueryDto } from './dto/list-my-jobs-query.dto';
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
  constructor(private readonly jobRepoService: JobRepoService) {}

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
