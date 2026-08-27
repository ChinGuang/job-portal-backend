import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Job } from '../jobs/entities/job.entity';
import { JobSeekerProfileModule } from '../profiles/modules/job-seeker-profile/job-seeker-profile.module';
import { StorageModule } from '../storage/storage.module';
import { ApplicationController } from './application.controller';
import { Application } from './entities/application.entity';
import { JobApplicationController } from './job-application.controller';
import { ApplicationRepoService } from './services/application-repo.service';

/**
 * `Job` is registered here as a repository rather than reached through the
 * jobs module's service: applying asks one question of a listing — may this be
 * applied to? — and that question is an applications rule, not one the jobs
 * module should grow an owner-less read path to answer.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Application, Job]),
    JobSeekerProfileModule,
    // Applying never uploads, but it does have to confirm that a résumé key a
    // client named is really in the bucket.
    StorageModule,
  ],
  providers: [ApplicationRepoService],
  controllers: [JobApplicationController, ApplicationController],
})
export class ApplicationModule {}
