import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export interface IEmployerProfile {
  id: string; // UUID v4
  user: User; // Foreign Key -> User.id (One-to-One)
  companyName: string;
  websiteUrl?: string;
  logoUrl?: string;
  industry?: string;
  companySize?: string; // e.g., "1-10", "11-50"
  description?: string;
  address?: string;
  createdAt: Date;
  updatedAt: Date;
}

@Entity('employer_profiles')
export class EmployerProfile implements IEmployerProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => User)
  @JoinColumn()
  user!: User;

  @Column({ type: 'varchar', nullable: false })
  companyName!: string;

  @Column({ type: 'varchar', nullable: true })
  websiteUrl?: string | undefined;

  @Column({ type: 'varchar', nullable: true })
  logoUrl?: string | undefined;

  @Column({ type: 'varchar', nullable: true })
  industry?: string | undefined;

  @Column({ type: 'varchar', nullable: true })
  companySize?: string | undefined;

  @Column({ type: 'varchar', nullable: true })
  description?: string | undefined;

  @Column({ type: 'varchar', nullable: true })
  address?: string | undefined;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}

@Entity('job_seeker_profiles')
export class JobSeekerProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  userId!: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ type: 'varchar', length: 255, nullable: false })
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  headline?: string | null;

  @Column({ type: 'text', nullable: true })
  bio?: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone?: string | null;

  @Column({
    type: 'varchar',
    array: true,
    default: () => 'ARRAY[]::varchar[]',
  })
  skills!: string[];

  @Column({ type: 'int', name: 'years_of_experience', nullable: true })
  yearsOfExperience?: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
