import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestWithJobSeekerProfile } from '../guards/job-seeker-profile.guard';

/** The profile resolved by JobSeekerProfileGuard; null without that guard. */
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
