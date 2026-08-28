// src/modules/users/domain/user.entity.ts

import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  EmployerProfile,
  JobSeekerProfile,
} from '../../profiles/entities/profile.entity';

export enum AuthProvider {
  SUPABASE = 'SUPABASE',
}

// 1. Keep your core interfaces for type safety
export interface UserBase {
  id: string; // UUID v4
  email: string;
  provider: AuthProvider;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface SupabaseUser extends UserBase {
  provider: AuthProvider.SUPABASE;
  supabaseId: string;
}

// 2. TypeORM Entity implementing the SupabaseUser interface
@Entity('users')
export class User implements SupabaseUser {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', nullable: false })
  email!: string;

  @Column({
    type: 'enum',
    enum: AuthProvider,
    default: AuthProvider.SUPABASE,
  })
  provider!: AuthProvider.SUPABASE;

  @Index('idx_users_supabase_id', { unique: true })
  @Column({ type: 'varchar', nullable: false })
  supabaseId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;

  @OneToOne(() => EmployerProfile, (profile) => profile.user, {
    cascade: ['soft-remove'],
  })
  employerProfile?: EmployerProfile;

  @OneToOne(() => JobSeekerProfile, (profile) => profile.user, {
    cascade: ['soft-remove'],
  })
  jobseekerProfile?: JobSeekerProfile;
}
