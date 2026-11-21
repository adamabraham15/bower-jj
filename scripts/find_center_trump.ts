import fs from 'fs';
import path from 'path';

function search(dir: string) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, f.name);
    if (f.isDirectory() && !f.name.startsWith('.') && f.name !== 'node_modules' && f.name !== 'dist') {
      search(full);
    } else if (f.isFile() && (f.name.endsWith('.tsx') || f.name.endsWith('.ts'))) {
      const content = fs.readFileSync(full, 'utf8');
      const lines = content.split('\n');
      lines.forEach((l, i) => {
        if (
          (l.includes('trump') || l.includes('Trump')) &&
          (l.includes('center') || l.includes('middle') || l.includes('SUIT_SYMBOLS') || l.includes('tableFelt') || l.includes('SUIT_ICONS'))
        ) {
          console.log(`${full}:${i + 1}: ${l.trim()}`);
        }
      });
    }
  }
}

search('src');
