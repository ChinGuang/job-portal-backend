import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ user?: Record<string, unknown> | null }>();
    const user = request.user; // Set by SupabaseJwtStrategy.validate()

    if (!user) return null;
    return data ? user[data] : user;
  },
);
