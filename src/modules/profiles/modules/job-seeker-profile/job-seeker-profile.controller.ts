import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Inject,
  ParseFilePipeBuilder,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SwaggerTag } from '../../../../common/constants/swagger';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import type { StorageService } from '../../../storage/storage.service.interface';
import { STORAGE_SERVICE } from '../../../storage/storage.tokens';
import { User } from '../../../users/entities/user.entity';
import { JobSeekerProfile } from '../../entities/profile.entity';
import { CreateJobSeekerProfileDto } from './dto/create-job-seeker-profile.dto';
import { JobSeekerProfileResponseDto } from './dto/job-seeker-profile-response.dto';
import { UpdateJobSeekerProfileDto } from './dto/update-job-seeker-profile.dto';
import { JobSeekerProfileService } from './services/job-seeker-profile.service';
import { ResumeFileTypeValidator } from './validators/resume-file-type.validator';

const MAX_RESUME_SIZE_BYTES = 5 * 1024 * 1024;
const RESUME_SIGNED_URL_TTL_SECONDS = 300;

@ApiTags(SwaggerTag.PROFILES)
@Controller('profiles/job-seeker')
@UseGuards(JwtAuthGuard)
export class JobSeekerProfileController {
  constructor(
    private readonly service: JobSeekerProfileService,
    @Inject(STORAGE_SERVICE)
    private readonly storageService: StorageService,
  ) {}

  // The stored resumeUrl is a private-bucket object path, not something a
  // client can fetch directly — this exchanges it for a short-lived signed
  // URL on every response that includes it, the moment before it goes out.
  private async toResponseDto(
    profile: JobSeekerProfile,
  ): Promise<JobSeekerProfileResponseDto> {
    const resumeUrl = profile.resumeUrl
      ? await this.storageService.createSignedUrl(
          profile.resumeUrl,
          RESUME_SIGNED_URL_TTL_SECONDS,
        )
      : null;

    return new JobSeekerProfileResponseDto({
      id: profile.id,
      userId: profile.userId,
      name: profile.name,
      headline: profile.headline,
      bio: profile.bio,
      phone: profile.phone,
      skills: profile.skills,
      yearsOfExperience: profile.yearsOfExperience,
      resumeUrl,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    });
  }

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
    return this.toResponseDto(profile);
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
    return this.toResponseDto(profile);
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
    return this.toResponseDto(profile);
  }

  @Post('resume')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_RESUME_SIZE_BYTES } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({
    summary: "Upload (or replace) the caller's résumé",
    description:
      'PDF, DOC, or DOCX only, 5 MB maximum. Replaces any existing résumé ' +
      "on the caller's job seeker profile.",
  })
  @ApiResponse({ status: 201, type: JobSeekerProfileResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid file type.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Profile not found.' })
  @ApiResponse({ status: 413, description: 'File exceeds 5 MB.' })
  async uploadResume(
    @CurrentUser() user: User,
    @UploadedFile(
      // Size is enforced by the FileInterceptor's own `limits.fileSize`
      // above (it rejects the stream before fully buffering an oversized
      // file, and returns 413) — a second size check here at the same
      // threshold would never fire, since anything the interceptor lets
      // through already satisfies it.
      new ParseFilePipeBuilder()
        .addValidator(new ResumeFileTypeValidator())
        .build({ errorHttpStatusCode: HttpStatus.BAD_REQUEST }),
    )
    file: Express.Multer.File,
  ): Promise<JobSeekerProfileResponseDto> {
    const profile = await this.service.uploadResume(user.id, file);
    return this.toResponseDto(profile);
  }
}
