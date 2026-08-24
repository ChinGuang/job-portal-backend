import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthProvider, User } from '../entities/user.entity';

@Injectable()
export class UserRepoService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findOrCreateFromToken(claims: {
    id: string;
    email: string;
  }): Promise<User | null> {
    // 1. Perform atomic upsert (conflict target must be a unique constraint)
    await this.userRepository.upsert(
      {
        supabaseId: claims.id,
        email: claims.email,
        provider: AuthProvider.SUPABASE,
      },
      {
        conflictPaths: ['supabaseId'],
        skipUpdateIfNoValuesChanged: true,
      },
    );

    // 2. Return the existing or newly inserted record
    return this.userRepository.findOne({
      where: { supabaseId: claims.id },
    });
  }

  async upsertFromWebhook(record: {
    supabaseId: string;
    email: string;
  }): Promise<void> {
    // Only touches email/provider, so a soft-deleted row's deletedAt is left untouched.
    await this.userRepository.upsert(
      {
        supabaseId: record.supabaseId,
        email: record.email,
        provider: AuthProvider.SUPABASE,
      },
      {
        conflictPaths: ['supabaseId'],
        skipUpdateIfNoValuesChanged: true,
      },
    );
  }

  async softDeleteBySupabaseId(supabaseId: string): Promise<void> {
    await this.userRepository.softDelete({ supabaseId });
  }
}
