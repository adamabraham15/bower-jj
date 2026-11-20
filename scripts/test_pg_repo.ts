import { PostgresDatabaseRepository } from '../server/db/postgres';

const connectionString = 'postgresql://euchre_app.luqyiarxemhreuxfuzwz:7321ae0e-4b4d-4237-aa77-973b7a9b0bb3@aws-1-us-west-2.pooler.supabase.com:6543/postgres';

async function main() {
  const pgRepo = new PostgresDatabaseRepository(connectionString);
  const userId = '940b48d0-3291-4902-a09b-d1d792ad6c27'; // Turkeysub

  console.log('Testing pgRepo methods for Turkeysub...');
  const user = await pgRepo.getUserById(userId);
  console.log('User:', user?.username, 'level:', user?.level, 'packs:', user?.unopenedPacksCount);

  const collection = await pgRepo.getCollectionState(userId);
  console.log('Collection unopenedPacksCount:', collection?.unopenedPacksCount);
  console.log('Cards count:', collection?.cards?.length);

  const friends = await pgRepo.getFriendsSummary(userId);
  console.log('Friends count:', friends?.length);
  for (const f of friends) {
    console.log(' - Friend:', f.username, f.userId, 'isOnline:', f.isOnline);
  }

  await pgRepo.close();
}

main().catch(console.error);
