import { ApplicationStatus } from '../entities/application.entity';

const ALLOWED_TRANSITIONS: Readonly<
  Record<ApplicationStatus, readonly ApplicationStatus[]>
> = {
  [ApplicationStatus.SUBMITTED]: [ApplicationStatus.REVIEWED],
  [ApplicationStatus.REVIEWED]: [
    ApplicationStatus.OFFERED,
    ApplicationStatus.REJECTED,
  ],
  [ApplicationStatus.OFFERED]: [],
  [ApplicationStatus.REJECTED]: [],
};

export function canTransition(
  from: ApplicationStatus,
  to: ApplicationStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function isTerminal(status: ApplicationStatus): boolean {
  return (
    status === ApplicationStatus.OFFERED ||
    status === ApplicationStatus.REJECTED
  );
}
