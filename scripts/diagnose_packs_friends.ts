import fs from 'fs';

const content = fs.readFileSync('src/App.tsx', 'utf8');
content.split('\n').forEach((l, i) => {
  if (l.includes('FriendSummary')) {
    console.log(`${i + 1}: ${l.trim()}`);
  }
});
