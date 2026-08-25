import { PartialType } from '@nestjs/swagger';
import { CreateEmployerProfileDto } from './create-employer-profile.dto';

export class UpdateJobSeekerProfileDto extends PartialType(
  CreateEmployerProfileDto,
) {}
