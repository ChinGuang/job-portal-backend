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
import { CurrentEmployerProfile } from '../profiles/decorators/current-employer-profile.decorator';
import { EmployerProfileGuard } from '../profiles/guards/employer-profile.guard';
import { ApplicationReviewListResponseDto } from './dto/application-review-list-response.dto';
import { ListJobApplicationsQueryDto } from './dto/list-job-applications-query.dto';
import { toApplicationReviewDto } from './mappers/application.mapper';
import { ApplicationRepoService } from './services/application-repo.service';

@ApiTags(SwaggerTag.APPLICATIONS)
@Controller('jobs/:jobId/applications')
@UseGuards(JwtAuthGuard, EmployerProfileGuard)
export class JobApplicationReviewController {
  constructor(
    private readonly applicationRepoService: ApplicationRepoService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List the applications sent to one of your listings',
    description:
      'The listing owner only. Every application on the listing, newest ' +
      'first, each with the cover letter it was sent with and the ' +
      "applicant's profile, so a reviewer can read the pile in one request. " +
      '`status` narrows the page to the applications still in play.',
  })
  @ApiResponse({ status: 200, type: ApplicationReviewListResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Malformed listing id or query parameters.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 403,
    description:
      'No employer profile, or the listing belongs to another company.',
  })
  @ApiResponse({ status: 404, description: 'Job listing not found.' })
  async findAll(
    @CurrentEmployerProfile('id') employerProfileId: string,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Query() query: ListJobApplicationsQueryDto,
  ): Promise<ApplicationReviewListResponseDto> {
    const { items, total } =
      await this.applicationRepoService.findAllForJobOwner(
        jobId,
        employerProfileId,
        query,
      );
    return { items: items.map(toApplicationReviewDto), total };
  }
}
