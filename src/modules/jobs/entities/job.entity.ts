import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EmployerProfile } from '../../profiles/entities/profile.entity';

export enum JobType {
  FULL_TIME = 'FULL_TIME',
  PART_TIME = 'PART_TIME',
  CONTRACT = 'CONTRACT',
  INTERNSHIP = 'INTERNSHIP',
}

// The four statuses carry distinct meanings, and only two of them are publicly
// visible:
//   DRAFT     — not publicly visible, not applicable to.
//   PUBLISHED — publicly visible, accepting applications.
//   CLOSED    — publicly visible, not accepting applications.
//   ARCHIVED  — not publicly visible.
export enum JobStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  CLOSED = 'CLOSED',
  ARCHIVED = 'ARCHIVED',
}

@Entity('jobs')
export class Job {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_jobs_employer_profile_id')
  @Column({ type: 'uuid', nullable: false })
  employerProfileId!: string;

  // RESTRICT, not CASCADE: deleting a listing is a soft operation that sets
  // ARCHIVED and never removes the row, so application history survives.
  // Hard deletion is out of scope, so the destructive path should fail loudly
  // rather than quietly take listings with it.
  @ManyToOne(() => EmployerProfile, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'employerProfileId' })
  employerProfile?: EmployerProfile;

  @Column({ type: 'varchar', length: 255, nullable: false })
  title!: string;

  @Column({ type: 'text', nullable: false })
  description!: string;

  @Column({
    type: 'varchar',
    array: true,
    default: () => 'ARRAY[]::varchar[]',
  })
  requirements!: string[];

  @Column({ type: 'varchar', length: 255, nullable: false })
  location!: string;

  @Column({ type: 'enum', enum: JobType, nullable: false })
  jobType!: JobType;

  @Column({ type: 'int', nullable: true })
  salaryMin?: number | null;

  @Column({ type: 'int', nullable: true })
  salaryMax?: number | null;

  @Column({ type: 'varchar', length: 3, nullable: true })
  currency?: string | null;

  // A listing always starts life as a DRAFT; moving it on is a separate,
  // explicit status change.
  @Column({ type: 'enum', enum: JobStatus, default: JobStatus.DRAFT })
  status!: JobStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
