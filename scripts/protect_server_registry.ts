import { PostgresDatabaseRepository } from '../server/db/postgres';

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }
  const repo = new PostgresDatabaseRepository(dbUrl);
  await repo.queryWithRetry(`
    CREATE OR REPLACE FUNCTION protect_server_registry()
    RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.public_url LIKE '%scale-structural-minimize-mel%' THEN
        RETURN NULL;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_protect_server_registry ON public.server_registry;
    CREATE TRIGGER trg_protect_server_registry
    BEFORE INSERT OR UPDATE ON public.server_registry
    FOR EACH ROW EXECUTE FUNCTION protect_server_registry();
  `);

  console.log('Successfully installed protect_server_registry trigger in PostgreSQL.');
  
  // Set current primary immediately to the live tunnel on this machine
  await repo.queryWithRetry(`
    UPDATE public.server_registry
    SET public_url = 'https://instructors-dock-findings-period.trycloudflare.com', updated_at = NOW()
    WHERE id = 'primary';
  `);
  
  const check = await repo.queryWithRetry(`SELECT * FROM public.server_registry WHERE id = 'primary'`);
  console.log('Current server_registry row:', check.rows[0]);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
