import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateJobSeekerProfilesTable1787633937441 implements MigrationInterface {
  name = 'CreateJobSeekerProfilesTable1787633937441';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "job_seeker_profiles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "name" character varying(255) NOT NULL, "headline" character varying(255), "bio" text, "phone" character varying(30), "skills" character varying array NOT NULL DEFAULT ARRAY[]::varchar[], "years_of_experience" integer, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "REL_1eb680790c231155637d3d144e" UNIQUE ("userId"), CONSTRAINT "PK_9fabb6759237da3f1b8640bafa4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "job_seeker_profiles" ADD CONSTRAINT "FK_1eb680790c231155637d3d144e0" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "job_seeker_profiles" DROP CONSTRAINT "FK_1eb680790c231155637d3d144e0"`,
    );
    await queryRunner.query(`DROP TABLE "job_seeker_profiles"`);
  }
}
