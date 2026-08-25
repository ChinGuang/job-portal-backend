import { PartialType } from '@nestjs/swagger';
import { CreateEmployerProfileDto } from './create-employer-profile.dto';

export class UpdateEmployerProfileDto extends PartialType(
  CreateEmployerProfileDto,
) {}
