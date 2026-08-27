import { MigrationInterface, QueryRunner } from 'typeorm';

// Generated against the Application entity, then trimmed to it. The generator
// also emitted unrelated `employer_profiles` column rewrites — pre-existing
// drift between that entity and the migration that created it, and destructive
// (DROP COLUMN / ADD COLUMN) if applied to a populated table. Reconciling that
// is its own change; this one only adds the applications table.
export class CreateApplicationsTable1787817703567 implements MigrationInterface {
  name = 'CreateApplicationsTable1787817703567';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."applications_status_enum" AS ENUM('SUBMITTED', 'REVIEWED', 'OFFERED', 'REJECTED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "applications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "jobId" uuid NOT NULL, "jobSeekerProfileId" uuid NOT NULL, "coverLetter" text, "resumeUrl" character varying(1024) NOT NULL, "status" "public"."applications_status_enum" NOT NULL DEFAULT 'SUBMITTED', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_applications_job_id_job_seeker_profile_id" UNIQUE ("jobId", "jobSeekerProfileId"), CONSTRAINT "PK_938c0a27255637bde919591888f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_applications_job_id" ON "applications" ("jobId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_applications_job_seeker_profile_id" ON "applications" ("jobSeekerProfileId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "applications" ADD CONSTRAINT "FK_f6ebb8bc5061068e4dd97df3c77" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "applications" ADD CONSTRAINT "FK_3ad3e5a0efe4ddfef234678f8eb" FOREIGN KEY ("jobSeekerProfileId") REFERENCES "job_seeker_profiles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "applications" DROP CONSTRAINT "FK_3ad3e5a0efe4ddfef234678f8eb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "applications" DROP CONSTRAINT "FK_f6ebb8bc5061068e4dd97df3c77"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_applications_job_seeker_profile_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_applications_job_id"`);
    await queryRunner.query(`DROP TABLE "applications"`);
    await queryRunner.query(`DROP TYPE "public"."applications_status_enum"`);
  }
}
