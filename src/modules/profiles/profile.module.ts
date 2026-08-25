import { Module } from '@nestjs/common';
import { EmployerProfileModule } from './modules/employee-profile/employer-profile.module';
import { JobSeekerProfileModule } from './modules/job-seeker-profile/job-seeker-profile.module';

@Module({
  imports: [JobSeekerProfileModule, EmployerProfileModule],
  exports: [JobSeekerProfileModule, EmployerProfileModule],
})
export class ProfileModule {}
