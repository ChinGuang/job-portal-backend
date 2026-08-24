import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthProvider, User } from '../entities/user.entity';

/**
 * The pair that identifies a mirrored user, however it arrived — from token
 * claims or from a Supabase webhook payload.
 */
export interface SupabaseUserIdentity {
  supabaseId: string;
  email: string;
}

@Injectable()
export class UserRepoService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Lazy provisioning: a valid token whose `sub` has no local row creates one.
   * A soft-deleted user is never resurrected — the deleted row is detected
   * before any provisioning happens, and null is returned so the guard
   * rejects the token.
   */
  async findOrCreateFromToken(
    identity: SupabaseUserIdentity,
  ): Promise<User | null> {
    const existing = await this.userRepository.findOne({
      where: { supabaseId: identity.supabaseId },
      withDeleted: true,
    });

    if (existing?.deletedAt) {
      return null;
    }

    await this.upsertBySupabaseId(identity);

    return this.userRepository.findOne({
      where: { supabaseId: identity.supabaseId },
    });
  }

  /**
   * Idempotent upsert keyed on the Supabase id. Only email and provider are
   * written, so a soft-deleted row keeps its `deletedAt`.
   */
  async upsertBySupabaseId(identity: SupabaseUserIdentity): Promise<void> {
    // Conflict target must be a unique constraint.
    await this.userRepository.upsert(
      {
        supabaseId: identity.supabaseId,
        email: identity.email,
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
