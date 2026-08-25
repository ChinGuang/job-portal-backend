import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageModule } from '../storage/storage.module';
import { JobSeekerProfile } from './entities/job-seeker-profile.entity';
import { JobSeekerProfileController } from './job-seeker-profile.controller';
import { JobSeekerProfileService } from './services/job-seeker-profile.service';

@Module({
  imports: [TypeOrmModule.forFeature([JobSeekerProfile]), StorageModule],
  controllers: [JobSeekerProfileController],
  providers: [JobSeekerProfileService],
  exports: [JobSeekerProfileService],
})
export class ProfileModule {}
