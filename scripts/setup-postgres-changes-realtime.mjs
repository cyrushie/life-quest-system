process.loadEnvFile(".env");

const { PrismaClient } = await import("@prisma/client");

const prisma = new PrismaClient();

const realtimeTables = [
  "Notification",
  "GuildMessage",
  "Friendship",
  "GuildMembership",
  "UserStats",
  "DailyLog",
  "Guild",
];

const policyStatements = [
  `alter table "Notification" enable row level security;`,
  `drop policy if exists "lqs_realtime_notification_select" on "Notification";`,
  `create policy "lqs_realtime_notification_select" on "Notification"
    for select
    to authenticated
    using ("userId" = auth.uid()::text);`,

  `alter table "GuildMessage" enable row level security;`,
  `drop policy if exists "lqs_realtime_guild_message_select" on "GuildMessage";`,
  `create policy "lqs_realtime_guild_message_select" on "GuildMessage"
    for select
    to authenticated
    using (
      exists (
        select 1
        from "GuildMembership" membership
        where membership."guildId" = "GuildMessage"."guildId"
          and membership."userId" = auth.uid()::text
      )
    );`,

  `alter table "Friendship" enable row level security;`,
  `drop policy if exists "lqs_realtime_friendship_select" on "Friendship";`,
  `create policy "lqs_realtime_friendship_select" on "Friendship"
    for select
    to authenticated
    using ("requesterId" = auth.uid()::text or "addresseeId" = auth.uid()::text);`,

  `alter table "GuildMembership" enable row level security;`,
  `drop policy if exists "lqs_realtime_guild_membership_select" on "GuildMembership";`,
  `create policy "lqs_realtime_guild_membership_select" on "GuildMembership"
    for select
    to authenticated
    using (true);`,

  `alter table "UserStats" enable row level security;`,
  `drop policy if exists "lqs_realtime_user_stats_select" on "UserStats";`,
  `create policy "lqs_realtime_user_stats_select" on "UserStats"
    for select
    to authenticated
    using (true);`,

  `alter table "DailyLog" enable row level security;`,
  `drop policy if exists "lqs_realtime_daily_log_select" on "DailyLog";`,
  `create policy "lqs_realtime_daily_log_select" on "DailyLog"
    for select
    to authenticated
    using (true);`,

  `alter table "Guild" enable row level security;`,
  `drop policy if exists "lqs_realtime_guild_select" on "Guild";`,
  `create policy "lqs_realtime_guild_select" on "Guild"
    for select
    to authenticated
    using (true);`,

  `grant select on "Notification" to authenticated;`,
  `grant select on "GuildMessage" to authenticated;`,
  `grant select on "Friendship" to authenticated;`,
  `grant select on "GuildMembership" to authenticated;`,
  `grant select on "UserStats" to authenticated;`,
  `grant select on "DailyLog" to authenticated;`,
  `grant select on "Guild" to authenticated;`,
];

try {
  const publicationRows = await prisma.$queryRawUnsafe(
    `select tablename
     from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'`,
  );

  const published = new Set(publicationRows.map((row) => row.tablename));

  for (const table of realtimeTables) {
    await prisma.$executeRawUnsafe(
      `alter table "${table}" replica identity full;`,
    );

    if (!published.has(table)) {
      await prisma.$executeRawUnsafe(
        `alter publication supabase_realtime add table "public"."${table}";`,
      );
    }
  }

  for (const statement of policyStatements) {
    await prisma.$executeRawUnsafe(statement);
  }

  const summary = await prisma.$queryRawUnsafe(
    `select c.relname,
            c.relrowsecurity,
            exists (
              select 1
              from pg_publication_tables p
              where p.pubname = 'supabase_realtime'
                and p.schemaname = 'public'
                and p.tablename = c.relname
            ) as in_publication
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname in ('Notification','GuildMessage','Friendship','GuildMembership','UserStats','DailyLog','Guild')
     order by c.relname`,
  );

  console.log(JSON.stringify(summary, null, 2));
} finally {
  await prisma.$disconnect();
}
