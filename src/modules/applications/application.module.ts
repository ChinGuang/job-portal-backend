import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Job } from '../jobs/entities/job.entity';
import { JobModule } from '../jobs/job.module';
import { EmployerProfileModule } from '../profiles/modules/employee-profile/employer-profile.module';
import { JobSeekerProfileModule } from '../profiles/modules/job-seeker-profile/job-seeker-profile.module';
import { StorageModule } from '../storage/storage.module';
import { ApplicationReviewController } from './application-review.controller';
import { ApplicationController } from './application.controller';
import { Application } from './entities/application.entity';
import { JobApplicationReviewController } from './job-application-review.controller';
import { JobApplicationController } from './job-application.controller';
import { ApplicationRepoService } from './services/application-repo.service';

// `Job` is registered here rather than reached through the jobs module's
// service: "may this be applied to?" is an applications rule. JobModule comes
// in alongside it for the question that is *not* ours — who owns a listing —
// so the answer, and its status code, stay in one place.
@Module({
  imports: [
    TypeOrmModule.forFeature([Application, Job]),
    JobModule,
    JobSeekerProfileModule,
    // The employer capability guard on the review routes resolves a profile.
    EmployerProfileModule,
    // Applying never uploads, but does confirm a client-named key exists.
    StorageModule,
  ],
  providers: [ApplicationRepoService],
  controllers: [
    JobApplicationController,
    JobApplicationReviewController,
    ApplicationController,
    ApplicationReviewController,
  ],
})
export class ApplicationModule {}
