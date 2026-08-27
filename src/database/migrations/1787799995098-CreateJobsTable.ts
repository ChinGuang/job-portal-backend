import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateJobsTable1787799995098 implements MigrationInterface {
  name = 'CreateJobsTable1787799995098';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."jobs_jobtype_enum" AS ENUM('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."jobs_status_enum" AS ENUM('DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "jobs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "employerProfileId" uuid NOT NULL, "title" character varying(255) NOT NULL, "description" text NOT NULL, "requirements" character varying array NOT NULL DEFAULT ARRAY[]::varchar[], "location" character varying(255) NOT NULL, "jobType" "public"."jobs_jobtype_enum" NOT NULL, "salaryMin" integer, "salaryMax" integer, "currency" character varying(3), "status" "public"."jobs_status_enum" NOT NULL DEFAULT 'DRAFT', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_cf0a6c42b72fcc7f7c237def345" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_jobs_employer_profile_id" ON "jobs" ("employerProfileId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "jobs" ADD CONSTRAINT "FK_dcd22c32845c8dcac1093190878" FOREIGN KEY ("employerProfileId") REFERENCES "employer_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "jobs" DROP CONSTRAINT "FK_dcd22c32845c8dcac1093190878"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_jobs_employer_profile_id"`,
    );
    await queryRunner.query(`DROP TABLE "jobs"`);
    await queryRunner.query(`DROP TYPE "public"."jobs_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."jobs_jobtype_enum"`);
  }
}
