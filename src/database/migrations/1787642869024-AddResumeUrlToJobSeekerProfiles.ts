import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddResumeUrlToJobSeekerProfiles1787642869024 implements MigrationInterface {
  name = 'AddResumeUrlToJobSeekerProfiles1787642869024';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "job_seeker_profiles" ADD "resume_url" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "job_seeker_profiles" DROP COLUMN "resume_url"`,
    );
  }
}
