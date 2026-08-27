import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestWithJobSeekerProfile } from '../guards/job-seeker-profile.guard';

/**
 * The job seeker profile resolved by JobSeekerProfileGuard. Only meaningful on
 * a route that guard protects — without it there is nothing on the request.
 */
export const CurrentJobSeekerProfile = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx
      .switchToHttp()
      .getRequest<RequestWithJobSeekerProfile>();
    const profile = request.jobSeekerProfile;

    if (!profile) return null;
    return data ? profile[data as keyof typeof profile] : profile;
  },
);
