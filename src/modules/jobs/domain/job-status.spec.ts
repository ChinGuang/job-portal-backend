import { JobStatus } from '../entities/job.entity';
import {
  acceptsApplications,
  canTransition,
  isPubliclyVisible,
} from './job-status';

const EVERY_STATUS = Object.values(JobStatus);

describe('job status rules', () => {
  describe('canTransition', () => {
    it.each([
      [JobStatus.DRAFT, JobStatus.PUBLISHED],
      [JobStatus.PUBLISHED, JobStatus.CLOSED],
    ])('allows %s → %s', (from, to) => {
      expect(canTransition(from, to)).toBe(true);
    });

    it.each([
      // Publishing is the only way out of a draft.
      [JobStatus.DRAFT, JobStatus.CLOSED],
      // Archiving is DELETE's job, never the status endpoint's.
      [JobStatus.DRAFT, JobStatus.ARCHIVED],
      [JobStatus.PUBLISHED, JobStatus.ARCHIVED],
      [JobStatus.CLOSED, JobStatus.ARCHIVED],
      // Nothing returns to draft.
      [JobStatus.PUBLISHED, JobStatus.DRAFT],
      [JobStatus.CLOSED, JobStatus.DRAFT],
      // Closed is the end of the road for a live listing; archived is the end
      // of the road entirely.
      [JobStatus.CLOSED, JobStatus.PUBLISHED],
      [JobStatus.ARCHIVED, JobStatus.PUBLISHED],
      [JobStatus.ARCHIVED, JobStatus.CLOSED],
      [JobStatus.ARCHIVED, JobStatus.DRAFT],
    ])('refuses %s → %s', (from, to) => {
      expect(canTransition(from, to)).toBe(false);
    });

    it.each(EVERY_STATUS)('refuses %s → itself', (status) => {
      expect(canTransition(status, status)).toBe(false);
    });
  });

  describe('isPubliclyVisible', () => {
    it('shows published and closed listings', () => {
      expect(isPubliclyVisible(JobStatus.PUBLISHED)).toBe(true);
      expect(isPubliclyVisible(JobStatus.CLOSED)).toBe(true);
    });

    it('hides drafts and archived listings', () => {
      expect(isPubliclyVisible(JobStatus.DRAFT)).toBe(false);
      expect(isPubliclyVisible(JobStatus.ARCHIVED)).toBe(false);
    });
  });

  describe('acceptsApplications', () => {
    it('accepts applications only while published', () => {
      expect(acceptsApplications(JobStatus.PUBLISHED)).toBe(true);
    });

    it.each([JobStatus.DRAFT, JobStatus.CLOSED, JobStatus.ARCHIVED])(
      'refuses applications to a %s listing',
      (status) => {
        expect(acceptsApplications(status)).toBe(false);
      },
    );
  });

  it('closed listings are readable but unapplicable', () => {
    // The pairing is the whole reason CLOSED exists as a separate status.
    expect(isPubliclyVisible(JobStatus.CLOSED)).toBe(true);
    expect(acceptsApplications(JobStatus.CLOSED)).toBe(false);
  });
});
