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
