import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUsersTable1787647838099 implements MigrationInterface {
    name = 'CreateUsersTable1787647838099'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "employer_profiles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "companyName" character varying NOT NULL, "websiteUrl" character varying, "logoUrl" character varying, "industry" character varying, "companySize" character varying, "description" character varying, "address" character varying, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "userId" uuid, CONSTRAINT "REL_9800cae27bdc0b9cbbc16e1556" UNIQUE ("userId"), CONSTRAINT "PK_efb68f1f0020cb3b6facedde218" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "employer_profiles" ADD CONSTRAINT "FK_9800cae27bdc0b9cbbc16e1556a" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "employer_profiles" DROP CONSTRAINT "FK_9800cae27bdc0b9cbbc16e1556a"`);
        await queryRunner.query(`DROP TABLE "employer_profiles"`);
    }

}
