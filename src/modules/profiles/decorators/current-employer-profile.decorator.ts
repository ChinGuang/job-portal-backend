import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestWithEmployerProfile } from '../guards/employer-profile.guard';

/**
 * The employer profile resolved by EmployerProfileGuard. Only meaningful on a
 * route that guard protects — without it there is nothing on the request.
 */
export const CurrentEmployerProfile = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithEmployerProfile>();
    const profile = request.employerProfile;

    if (!profile) return null;
    return data ? profile[data as keyof typeof profile] : profile;
  },
);
