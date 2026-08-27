import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SwaggerTag } from '../../common/constants/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentJobSeekerProfile } from '../profiles/decorators/current-job-seeker-profile.decorator';
import { JobSeekerProfileGuard } from '../profiles/guards/job-seeker-profile.guard';
import { ApplicationDetailResponseDto } from './dto/application-detail-response.dto';
import { ApplicationListResponseDto } from './dto/application-list-response.dto';
import {
  toApplicationDetailDto,
  toApplicationDto,
} from './dto/application-mapper';
import { ListMyApplicationsQueryDto } from './dto/list-my-applications-query.dto';
import { ApplicationRepoService } from './services/application-repo.service';

@ApiTags(SwaggerTag.APPLICATIONS)
@Controller('applications')
@UseGuards(JwtAuthGuard, JobSeekerProfileGuard)
export class ApplicationController {
  constructor(
    private readonly applicationRepoService: ApplicationRepoService,
  ) {}

  // Declared before `:id` so that "mine" is never read as an id.
  @Get('mine')
  @ApiOperation({
    summary: "List the caller's own applications, newest first",
    description:
      'Every application the caller has submitted, in every status, so they ' +
      'can track their search.',
  })
  @ApiResponse({ status: 200, type: ApplicationListResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'No job seeker profile.' })
  async findMine(
    @CurrentJobSeekerProfile('id') jobSeekerProfileId: string,
    @Query() query: ListMyApplicationsQueryDto,
  ): Promise<ApplicationListResponseDto> {
    const { items, total } =
      await this.applicationRepoService.findAllByJobSeeker(
        jobSeekerProfileId,
        query,
      );
    return { items: items.map(toApplicationDto), total };
  }

  @Get(':id')
  @ApiOperation({
    summary: "Open one of the caller's own applications",
    description:
      'Returns the application together with the listing it was for. ' +
      "Another seeker's application is a 404: an application is private to " +
      'the parties in it, so this endpoint will not confirm that one exists.',
  })
  @ApiResponse({ status: 200, type: ApplicationDetailResponseDto })
  @ApiResponse({ status: 400, description: 'Malformed id.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'No job seeker profile.' })
  @ApiResponse({
    status: 404,
    description: "Application not found, or not the caller's own.",
  })
  async findOne(
    @CurrentJobSeekerProfile('id') jobSeekerProfileId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApplicationDetailResponseDto> {
    const application = await this.applicationRepoService.findOwnedByJobSeeker(
      id,
      jobSeekerProfileId,
    );
    return toApplicationDetailDto(application);
  }
}
