import { Module } from '@nestjs/common';
import { EmployerProfileModule } from './modules/employee-profile/employer-profile.module';

@Module({
  imports: [EmployerProfileModule],
  exports: [EmployerProfileModule],
})
export class ProfileModule {}
