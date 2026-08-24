import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UserRepoService } from './services/user-repo.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UserRepoService],
  exports: [UserRepoService],
})
export class UserModule {}
