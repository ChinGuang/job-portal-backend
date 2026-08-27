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

// Where an application stands in the hiring conversation:
//   SUBMITTED — the seeker has applied; nobody has looked yet.
//   REVIEWED  — the employer has triaged it.
//   OFFERED   — the employer has made an offer. Final.
//   REJECTED  — the employer has declined. Final.
//
// Only the seeker's half of that life is built here: an application is created
// as SUBMITTED and nothing moves it afterwards. The transitions, and the
// employer endpoint that drives them, belong to the employer review work.
export enum ApplicationStatus {
  SUBMITTED = 'SUBMITTED',
  REVIEWED = 'REVIEWED',
  OFFERED = 'OFFERED',
  REJECTED = 'REJECTED',
}

@Entity('applications')
// One application per seeker per listing. The constraint is the real guard
// against a double apply — a read before the write cannot rule out two
// concurrent requests — so the create path produces its 409 from this
// violation rather than from a check that races it.
//
// It is also the table's only unique constraint, which is what lets that path
// read a unique violation as "already applied" without inspecting the name.
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

  // RESTRICT, matching the listing's own relation to its employer: deleting a
  // listing sets ARCHIVED and never removes the row, precisely so that the
  // applications made against it keep pointing at something real.
  @ManyToOne(() => Job, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'jobId' })
  job?: Job;

  @Index('idx_applications_job_seeker_profile_id')
  @Column({ type: 'uuid', nullable: false })
  jobSeekerProfileId!: string;

  // RESTRICT here too: a seeker's records going away must not punch holes in
  // an employer's, so an application outlives any attempt to remove the
  // profile behind it.
  @ManyToOne(() => JobSeekerProfile, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'jobSeekerProfileId' })
  jobSeekerProfile?: JobSeekerProfile;

  @Column({ type: 'text', nullable: true })
  coverLetter?: string | null;

  // A snapshot taken at apply time, not a copy of the file: the value supplied
  // on the request, or the profile's résumé when the request named none. Never
  // null, because an application with no résumé behind it is refused outright.
  //
  // Storing the key rather than copying the object is a deliberate v1
  // trade-off: replacing a profile résumé changes what an employer sees on an
  // application that was already submitted.
  @Column({
    type: 'varchar',
    length: ApplicationLimit.RESUME_URL_MAX_LENGTH,
    nullable: false,
  })
  resumeUrl!: string;

  // Every application starts SUBMITTED; moving it on is the employer's doing.
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
