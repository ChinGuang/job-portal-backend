import { ApplicationStatus } from '../entities/application.entity';

// The hiring conversation, as the moves available from each status.
//
// SUBMITTED -> REVIEWED -> OFFERED | REJECTED, and nothing else:
//   - SUBMITTED goes nowhere but REVIEWED. A decision taken without triage is
//     one nobody on the employer's team can account for, so the machine makes
//     the triage step happen rather than trusting it to.
//   - OFFERED and REJECTED have no exits. Both have been communicated to a
//     candidate, and an outcome that can be taken back is not an outcome.
//   - Nothing returns to SUBMITTED. A reviewed application has been read, and
//     calling it unread again would misdescribe it.
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

/**
 * Whether an application may move from `from` to `to`.
 *
 * A status is never a legal move to itself: a no-op transition means the
 * employer has lost track of where the application stands, and saying so is
 * more useful than silently succeeding.
 */
export function canTransition(
  from: ApplicationStatus,
  to: ApplicationStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Whether the candidate has already been told the outcome. */
export function isTerminal(status: ApplicationStatus): boolean {
  return (
    status === ApplicationStatus.OFFERED ||
    status === ApplicationStatus.REJECTED
  );
}
