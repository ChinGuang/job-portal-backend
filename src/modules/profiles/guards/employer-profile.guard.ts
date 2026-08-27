import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { User } from '../../users/entities/user.entity';
import { EmployerProfile } from '../entities/profile.entity';
import { EmployerProfileRepoService } from '../modules/employee-profile/employer-profile-repo.service';

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
 * Being a guard, it answers before the validation pipe: a caller with no
 * employer profile is told about the profile rather than about a malformed
 * body. It lives in the profiles module rather than `common/` because the
 * capability it derives is a fact about a profile.
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

    // Unreachable behind JwtAuthGuard, but the two failures are different
    // rules: no principal is a 401, a principal without the profile is a 403.
    const userId = request.user?.id;
    if (!userId) {
      throw new UnauthorizedException();
    }

    const profile = await this.employerProfileRepoService.findByUserId(userId);
    if (!profile) {
      throw new ForbiddenException(NEEDS_EMPLOYER_PROFILE);
    }

    request.employerProfile = profile;
    return true;
  }
}
