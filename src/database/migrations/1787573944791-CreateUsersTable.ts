import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsersTable1787573944791 implements MigrationInterface {
  name = 'CreateUsersTable1787573944791';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "UQ_46a570d4ae0901b4971840999ed"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "UQ_46a570d4ae0901b4971840999ed" UNIQUE ("supabaseId")`,
    );
  }
}
