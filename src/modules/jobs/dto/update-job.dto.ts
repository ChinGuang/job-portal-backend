import { PartialType } from '@nestjs/swagger';
import { CreateJobDto } from './create-job.dto';

// Content edits only. `status` is deliberately absent: moving a listing
// through its lifecycle is a separate, explicit operation, so a `status` in
// the body is rejected by the whitelisting validation pipe.
export class UpdateJobDto extends PartialType(CreateJobDto) {}
