import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Job } from '../jobs/entities/job.entity';
import { JobSeekerProfileModule } from '../profiles/modules/job-seeker-profile/job-seeker-profile.module';
import { StorageModule } from '../storage/storage.module';
import { ApplicationController } from './application.controller';
import { Application } from './entities/application.entity';
import { JobApplicationController } from './job-application.controller';
import { ApplicationRepoService } from './services/application-repo.service';

// `Job` is registered here rather than reached through the jobs module's
// service: "may this be applied to?" is an applications rule.
@Module({
  imports: [
    TypeOrmModule.forFeature([Application, Job]),
    JobSeekerProfileModule,
    // Applying never uploads, but does confirm a client-named key exists.
    StorageModule,
  ],
  providers: [ApplicationRepoService],
  controllers: [JobApplicationController, ApplicationController],
})
export class ApplicationModule {}
