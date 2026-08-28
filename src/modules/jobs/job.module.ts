import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployerProfileModule } from '../profiles/modules/employee-profile/employer-profile.module';
import { Job } from './entities/job.entity';
import { JobController } from './job.controller';
import { JobRepoService } from './services/job-repo.service';

@Module({
  imports: [TypeOrmModule.forFeature([Job]), EmployerProfileModule],
  providers: [JobRepoService],
  controllers: [JobController],
  exports: [JobRepoService],
})
export class JobModule {}
