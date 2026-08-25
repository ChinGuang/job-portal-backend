import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobSeekerProfile } from './entities/job-seeker-profile.entity';
import { JobSeekerProfileController } from './job-seeker-profile.controller';
import { EmployerProfileModule } from './modules/employee-profile/employer-profile.module';
import { JobSeekerProfileService } from './services/job-seeker-profile.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([JobSeekerProfile]),
    EmployerProfileModule,
  ],
  controllers: [JobSeekerProfileController],
  providers: [JobSeekerProfileService],
  exports: [JobSeekerProfileService, EmployerProfileModule],
})
export class ProfileModule {}
