import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { User } from '../../users/entities/user.entity';
import { JobSeekerProfile } from '../entities/profile.entity';
import { JobSeekerProfileService } from '../modules/job-seeker-profile/services/job-seeker-profile.service';

const NEEDS_JOB_SEEKER_PROFILE =
  'You need a job seeker profile to do this. Create one at POST /profiles/job-seeker.';

export interface RequestWithJobSeekerProfile {
  user?: User;
  jobSeekerProfile?: JobSeekerProfile;
}

/**
 * The twin of EmployerProfileGuard: "is a job seeker" means a job seeker
 * profile exists, so this both enforces the capability and hands the resolved
 * profile to the handler. Being a guard, it answers before the validation
 * pipe, so a caller without one hears about the profile, not their body.
 */
@Injectable()
export class JobSeekerProfileGuard implements CanActivate {
  constructor(
    private readonly jobSeekerProfileService: JobSeekerProfileService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithJobSeekerProfile>();

    // Unreachable behind JwtAuthGuard, but no principal is a 401 while a
    // principal without the profile is a 403.
    const userId = request.user?.id;
    if (!userId) {
      throw new UnauthorizedException();
    }

    const profile =
      await this.jobSeekerProfileService.findByUserIdOrNull(userId);
    if (!profile) {
      throw new ForbiddenException(NEEDS_JOB_SEEKER_PROFILE);
    }

    request.jobSeekerProfile = profile;
    return true;
  }
}
