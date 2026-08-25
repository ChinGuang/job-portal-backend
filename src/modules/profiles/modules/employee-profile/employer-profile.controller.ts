import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { EmployerProfile } from '../../entities/profile.entity';
import { CreateEmployerProfileDto } from './dto/create-employer-profile.dto';
import { EmployerProfileRepoService } from './employer-profile-repo.service';

@Controller('/profiles/employer')
export class EmployerProfileController {
  constructor(
    private readonly employerProfileRepoService: EmployerProfileRepoService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async createProfile(
    @CurrentUser('id') userId: string,
    @Body() body: CreateEmployerProfileDto,
  ) {
    const employerProfile = await this.employerProfileRepoService.create({
      ...body,
      userId,
    });
    return employerProfile;
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async getProfile(
    @CurrentUser('id') userId: string,
  ): Promise<EmployerProfile> {
    return await this.employerProfileRepoService.readProfile(userId);
  }
}
