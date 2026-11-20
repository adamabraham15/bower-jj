import fs from 'fs';

function checkJson(file: string) {
  if (!fs.existsSync(file)) {
    console.log(`File ${file} does not exist.`);
    return;
  }
  const content = fs.readFileSync(file, 'utf8');
  try {
    const data = JSON.parse(content);
    console.log(`=== ${file} ===`);
    console.log('Total users:', Object.keys(data.users || {}).length);
    for (const [id, u] of Object.entries(data.users || {})) {
      const user = u as any;
      if (user.username === 'Turkeysub' || user.email === 'adam.abraham.15@gmail.com' || id === '940b48d0-3291-4902-a09b-d1d792ad6c27') {
        console.log('Found user in JSON:');
        console.log('ID:', id);
        console.log('Username:', user.username);
        console.log('Level:', user.level);
        console.log('UnopenedPacksCount:', user.unopenedPacksCount);
        console.log('Collection unopenedPacksCount:', user.collectionState?.unopenedPacksCount);
        console.log('Friends in JSON:', user.friends);
      }
    }
  } catch (err) {
    console.error(`Error parsing ${file}:`, err);
  }
}

checkJson('data/db.json');
checkJson('server/data/db.json');
checkJson('data/db.backup.json');
