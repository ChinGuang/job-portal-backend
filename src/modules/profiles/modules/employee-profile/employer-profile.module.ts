import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployerProfile } from '../../entities/profile.entity';
import { EmployerProfileSubscriber } from '../../subscribers/profile.subscriber';
import { EmployerProfileRepoService } from './employer-profile-repo.service';
import { EmployerProfileController } from './employer-profile.controller';

@Module({
  imports: [TypeOrmModule.forFeature([EmployerProfile])],
  providers: [EmployerProfileRepoService, EmployerProfileSubscriber],
  controllers: [EmployerProfileController],
  exports: [EmployerProfileRepoService],
})
export class EmployerProfileModule {}
