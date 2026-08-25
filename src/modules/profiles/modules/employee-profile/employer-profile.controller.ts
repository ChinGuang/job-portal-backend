import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
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
      user: {
        id: userId,
      },
    });
    return employerProfile;
  }
}
