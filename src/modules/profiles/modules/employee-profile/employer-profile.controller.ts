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
} from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import type { StorageService } from '../../../storage/storage.service.interface';
import { STORAGE_SERVICE } from '../../../storage/storage.tokens';
import { EmployerProfile } from '../../entities/profile.entity';
import { LOGO_SIGNED_URL_TTL_SECONDS } from './domain/logo-key';
import { CreateEmployerProfileDto } from './dto/create-employer-profile.dto';
import { EmployerProfileResponseDto } from './dto/employer-profile-response.dto';
import { UpdateEmployerProfileDto } from './dto/update-employer-profile.dto';
import { EmployerProfileRepoService } from './employer-profile-repo.service';
import { LogoFileTypeValidator } from './validators/logo-file-type.validator';

const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;

@UseGuards(JwtAuthGuard)
@Controller('/profiles/employer')
export class EmployerProfileController {
  constructor(
    private readonly employerProfileRepoService: EmployerProfileRepoService,
    @Inject(STORAGE_SERVICE)
    private readonly storageService: StorageService,
  ) {}

  // The stored logoUrl is a private-bucket object path, not something a client
  // can fetch directly — this exchanges it for a short-lived signed URL on
  // every response that includes it, the moment before it goes out.
  private async toResponseDto(
    profile: EmployerProfile,
  ): Promise<EmployerProfileResponseDto> {
    const dto = plainToInstance(EmployerProfileResponseDto, profile, {
      excludeExtraneousValues: true,
    });
    dto.logoUrl = profile.logoUrl
      ? await this.storageService.createSignedUrl(
          profile.logoUrl,
          LOGO_SIGNED_URL_TTL_SECONDS,
        )
      : null;
    return dto;
  }

  @Post()
  async createProfile(
    @CurrentUser('id') userId: string,
    @Body() body: CreateEmployerProfileDto,
  ): Promise<EmployerProfileResponseDto> {
    const employerProfile = await this.employerProfileRepoService.create({
      ...body,
      userId,
    });
    return this.toResponseDto(employerProfile);
  }

  @Get()
  async getProfile(
    @CurrentUser('id') userId: string,
  ): Promise<EmployerProfileResponseDto> {
    const profile = await this.employerProfileRepoService.readProfile(userId);
    return this.toResponseDto(profile);
  }

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
    return this.toResponseDto(profile);
  }

  @Post('logo')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_LOGO_SIZE_BYTES } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({
    summary: "Upload (or replace) the caller's company logo",
    description:
      'PNG or JPEG only, 2 MB maximum. Replaces any existing logo on the ' +
      "caller's employer profile.",
  })
  @ApiResponse({ status: 201, type: EmployerProfileResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid file type.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Profile not found.' })
  @ApiResponse({ status: 413, description: 'File exceeds 2 MB.' })
  async uploadLogo(
    @CurrentUser('id') userId: string,
    @UploadedFile(
      // Size is enforced by the FileInterceptor's own `limits.fileSize`
      // above (it rejects the stream before fully buffering an oversized
      // file, and returns 413) — a second size check here at the same
      // threshold would never fire, since anything the interceptor lets
      // through already satisfies it.
      new ParseFilePipeBuilder()
        .addValidator(new LogoFileTypeValidator())
        .build({ errorHttpStatusCode: HttpStatus.BAD_REQUEST }),
    )
    file: Express.Multer.File,
  ): Promise<EmployerProfileResponseDto> {
    const profile = await this.employerProfileRepoService.uploadLogo(
      userId,
      file,
    );
    return this.toResponseDto(profile);
  }
}
