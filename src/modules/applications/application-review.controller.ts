import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SwaggerTag } from '../../common/constants/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentEmployerProfile } from '../profiles/decorators/current-employer-profile.decorator';
import { EmployerProfileGuard } from '../profiles/guards/employer-profile.guard';
import { ApplicationResponseDto } from './dto/application-response.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';
import { toApplicationDto } from './mappers/application.mapper';
import { ApplicationRepoService } from './services/application-repo.service';

@ApiTags(SwaggerTag.APPLICATIONS)
@Controller('applications')
@UseGuards(JwtAuthGuard, EmployerProfileGuard)
export class ApplicationReviewController {
  constructor(
    private readonly applicationRepoService: ApplicationRepoService,
  ) {}

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Move an application along the hiring conversation',
    description:
      'The owner of the listing the application was sent to, only. ' +
      '`SUBMITTED` → `REVIEWED` → `OFFERED` | `REJECTED`; `OFFERED` and ' +
      '`REJECTED` are final, because both have already been told to the ' +
      "candidate. An application on another company's listing is a 404: " +
      'confirming it exists would say that someone applied somewhere. ' +
      'Deciding an application you submitted yourself is refused even on ' +
      'your own listing.',
  })
  @ApiResponse({ status: 200, type: ApplicationResponseDto })
  @ApiResponse({ status: 400, description: 'Malformed id or body.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 403,
    description: 'No employer profile, or the caller is the applicant.',
  })
  @ApiResponse({
    status: 404,
    description:
      "Application not found, or not on one of the caller's own listings.",
  })
  @ApiResponse({
    status: 409,
    description:
      'The application cannot move from where it stands to there, or ' +
      'someone else decided it first.',
  })
  async changeStatus(
    @CurrentUser('id') userId: string,
    @CurrentEmployerProfile('id') employerProfileId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateApplicationStatusDto,
  ): Promise<ApplicationResponseDto> {
    const application = await this.applicationRepoService.changeStatus(
      id,
      { employerProfileId, userId },
      dto.status,
    );
    return toApplicationDto(application);
  }
}
