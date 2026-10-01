import { Migration } from '@medusajs/framework/mikro-orm/migrations'

export class Migration20260702161057 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "prisoner" ("id" text not null, "prison_id" text not null, "prisoner_id" text not null, "prisoner_first_name" text null, "prisoner_second_name" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "prisoner_pkey" primary key ("id"));`,
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_prisoner_deleted_at" ON "prisoner" ("deleted_at") WHERE deleted_at IS NULL;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "prisoner" cascade;`)
  }
}
