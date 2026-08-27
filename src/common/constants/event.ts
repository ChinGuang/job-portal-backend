export enum EventName {
  EMPLOYER_PROFILE_SOFT_DELETED = 'employer_profile.soft_delete',
}

export interface EmployerProfileSoftDeleteEvent {
  id: string;
}
