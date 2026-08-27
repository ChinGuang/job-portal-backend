import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { EmployerProfile } from '../../modules/profiles/entities/profile.entity';
import { EmployerProfileRepoService } from '../../modules/profiles/modules/employee-profile/employer-profile-repo.service';
import { User } from '../../modules/users/entities/user.entity';

const NEEDS_EMPLOYER_PROFILE =
  'You need an employer profile to do this. Create one at POST /profiles/employer.';

export interface RequestWithEmployerProfile {
  user?: User;
  employerProfile?: EmployerProfile;
}

/**
 * The employer capability check. There is no role column — "is an employer"
 * means an employer profile exists for the caller — so this guard both
 * enforces the capability and hands the resolved profile to the handler,
 * sparing it a second lookup.
 *
 * Runs after JwtAuthGuard and, being a guard, before the validation pipe: a
 * caller with no employer profile is told about the profile rather than about
 * a malformed body.
 */
@Injectable()
export class EmployerProfileGuard implements CanActivate {
  constructor(
    private readonly employerProfileRepoService: EmployerProfileRepoService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithEmployerProfile>();

    const userId = request.user?.id;
    if (!userId) {
      throw new ForbiddenException(NEEDS_EMPLOYER_PROFILE);
    }

    const profile = await this.employerProfileRepoService.findByUserId(userId);
    if (!profile) {
      throw new ForbiddenException(NEEDS_EMPLOYER_PROFILE);
    }

    request.employerProfile = profile;
    return true;
  }
}
