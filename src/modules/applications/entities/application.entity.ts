import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { ApplicationLimit } from '../../../common/constants/application';
import { Job } from '../../jobs/entities/job.entity';
import { JobSeekerProfile } from '../../profiles/entities/profile.entity';

// SUBMITTED -> REVIEWED -> OFFERED | REJECTED. Only SUBMITTED is reachable
// here; the transitions belong to the employer review work.
export enum ApplicationStatus {
  SUBMITTED = 'SUBMITTED',
  REVIEWED = 'REVIEWED',
  OFFERED = 'OFFERED',
  REJECTED = 'REJECTED',
}

@Entity('applications')
// The table's only unique constraint, so the create path can read any unique
// violation as "already applied".
@Unique('uq_applications_job_id_job_seeker_profile_id', [
  'jobId',
  'jobSeekerProfileId',
])
export class Application {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_applications_job_id')
  @Column({ type: 'uuid', nullable: false })
  jobId!: string;

  // RESTRICT: deleting a listing sets ARCHIVED and keeps the row, so an
  // application always points at something real.
  @ManyToOne(() => Job, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'jobId' })
  job?: Job;

  @Index('idx_applications_job_seeker_profile_id')
  @Column({ type: 'uuid', nullable: false })
  jobSeekerProfileId!: string;

  // RESTRICT: a seeker leaving must not punch holes in an employer's records.
  @ManyToOne(() => JobSeekerProfile, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'jobSeekerProfileId' })
  jobSeekerProfile?: JobSeekerProfile;

  @Column({ type: 'text', nullable: true })
  coverLetter?: string | null;

  // A storage key snapshotted at apply time, not a copy of the file. The v1
  // trade-off: replacing a profile résumé changes what an employer sees on an
  // application already submitted.
  @Column({
    type: 'varchar',
    length: ApplicationLimit.RESUME_URL_MAX_LENGTH,
    nullable: false,
  })
  resumeUrl!: string;

  @Column({
    type: 'enum',
    enum: ApplicationStatus,
    default: ApplicationStatus.SUBMITTED,
  })
  status!: ApplicationStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
