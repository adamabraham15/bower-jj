import fs from 'fs';
import path from 'path';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const OWNER = 'adamabraham15';
const REPO = 'bower-jj';
const HEADERS = {
  'Authorization': `Bearer ${GITHUB_TOKEN}`,
  'User-Agent': 'BowerJJ-Deployer',
  'Accept': 'application/vnd.github+json'
};

async function ghFetch(url: string, options: any = {}) {
  const fullUrl = url.startsWith('http') ? url : `https://api.github.com${url}`;
  const res = await fetch(fullUrl, {
    ...options,
    headers: { ...HEADERS, ...(options.headers || {}) }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`GitHub API error ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

function getFilesToCommit(dir: string, baseDir: string = dir): string[] {
  const result: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

    // Ignore patterns
    if (
      relPath.startsWith('node_modules') ||
      relPath.startsWith('dist') ||
      relPath.startsWith('.git') ||
      relPath === '.env' ||
      relPath.includes('db.json.backup') ||
      relPath.endsWith('.tmp')
    ) {
      continue;
    }

    if (entry.isDirectory()) {
      result.push(...getFilesToCommit(fullPath, baseDir));
    } else {
      result.push(relPath);
    }
  }

  return result;
}

async function main() {
  if (!GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN environment variable is required');
  }

  console.log(`Checking repository ${OWNER}/${REPO}...`);
  let repoExists = false;
  try {
    await ghFetch(`/repos/${OWNER}/${REPO}`);
    repoExists = true;
    console.log(`Repository ${OWNER}/${REPO} exists.`);
  } catch {
    console.log(`Creating repository ${OWNER}/${REPO}...`);
    await ghFetch('/user/repos', {
      method: 'POST',
      body: JSON.stringify({
        name: REPO,
        description: 'BOWER JJ — Production-Grade Competitive Online Euchre Multiplayer',
        private: false,
        auto_init: true
      })
    });
    console.log(`Repository created.`);
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`Fetching ref heads/main...`);
  const refData = await ghFetch(`/repos/${OWNER}/${REPO}/git/refs/heads/main`);
  const latestCommitSha = refData.object.sha;
  console.log(`Latest commit SHA: ${latestCommitSha}`);

  const files = getFilesToCommit(process.cwd());
  console.log(`Uploading ${files.length} files as blobs...`);

  const treeItems: any[] = [];
  let uploaded = 0;

  for (const file of files) {
    const fullPath = path.join(process.cwd(), file);
    const content = fs.readFileSync(fullPath);
    const isBinary = content.includes(0);

    const blobData = await ghFetch(`/repos/${OWNER}/${REPO}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({
        content: content.toString(isBinary ? 'base64' : 'utf8'),
        encoding: isBinary ? 'base64' : 'utf-8'
      })
    });

    treeItems.push({
      path: file,
      mode: '100644',
      type: 'blob',
      sha: blobData.sha
    });

    uploaded++;
    if (uploaded % 20 === 0 || uploaded === files.length) {
      console.log(`Uploaded ${uploaded}/${files.length} files...`);
    }
  }

  console.log(`Creating Git tree with ${treeItems.length} entries...`);
  const treeData = await ghFetch(`/repos/${OWNER}/${REPO}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({
      base_tree: latestCommitSha,
      tree: treeItems
    })
  });
  console.log(`Created tree: ${treeData.sha}`);

  console.log(`Creating commit...`);
  const commitData = await ghFetch(`/repos/${OWNER}/${REPO}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({
      message: 'feat: Initial production staging release of BOWER JJ (Stage 4.6)',
      tree: treeData.sha,
      parents: [latestCommitSha]
    })
  });
  console.log(`Created commit: ${commitData.sha}`);

  console.log(`Updating ref heads/main...`);
  await ghFetch(`/repos/${OWNER}/${REPO}/git/refs/heads/main`, {
    method: 'PATCH',
    body: JSON.stringify({
      sha: commitData.sha,
      force: true
    })
  });

  console.log(`\nSUCCESS! Repository updated: https://github.com/${OWNER}/${REPO}`);
}

main().catch(err => {
  console.error('Fatal error pushing to GitHub:', err);
  process.exit(1);
});
