import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobSeekerProfile } from '../../entities/profile.entity';
import { JobSeekerProfileController } from './job-seeker-profile.controller';
import { JobSeekerProfileService } from './services/job-seeker-profile.service';

@Module({
  imports: [TypeOrmModule.forFeature([JobSeekerProfile])],
  controllers: [JobSeekerProfileController],
  providers: [JobSeekerProfileService],
  exports: [JobSeekerProfileService],
})
export class JobSeekerProfileModule {}
