import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { SwaggerTag } from '../../common/constants/swagger';
import { CurrentEmployerProfile } from '../../common/decorators/current-employer-profile.decorator';
import { EmployerProfileGuard } from '../../common/guards/employer-profile.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateJobDto } from './dto/create-job.dto';
import { JobListResponseDto } from './dto/job-list-response.dto';
import { JobResponseDto } from './dto/job-response.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { Job } from './entities/job.entity';
import { JobRepoService } from './services/job-repo.service';

function toResponseDto(job: Job): JobResponseDto {
  return plainToInstance(JobResponseDto, job, {
    excludeExtraneousValues: true,
  });
}

@ApiTags(SwaggerTag.JOBS)
@Controller('jobs')
@UseGuards(JwtAuthGuard, EmployerProfileGuard)
export class JobController {
  constructor(private readonly jobRepoService: JobRepoService) {}

  @Post()
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
  @ApiOperation({
    summary: "List all of the caller's own listings, in every status",
  })
  @ApiResponse({ status: 200, type: JobListResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'No employer profile.' })
  async findMine(
    @CurrentEmployerProfile('id') employerProfileId: string,
  ): Promise<JobListResponseDto> {
    const { items, total } =
      await this.jobRepoService.findAllByEmployer(employerProfileId);
    return { items: items.map(toResponseDto), total };
  }

  @Patch(':id')
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
}
