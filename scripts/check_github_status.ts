async function main() {
  const token = process.env.GITHUB_TOKEN;
  const headers = {
    Authorization: `Bearer ${token}`,
    'User-Agent': 'node-fetch',
    Accept: 'application/vnd.github.v3+json',
  };

  const res = await fetch('https://api.github.com/repos/adamabraham15/bower-jj/commits?per_page=5', { headers });
  const commits = (await res.json()) as any[];
  console.log('Recent commits:');
  for (const c of commits) {
    console.log(c.sha.slice(0, 7), c.commit.message.split('\n')[0]);
    const checkRes = await fetch(`https://api.github.com/repos/adamabraham15/bower-jj/commits/${c.sha}/check-runs`, { headers });
    const checks = (await checkRes.json()) as any;
    if (checks.check_runs && checks.check_runs.length > 0) {
      for (const cr of checks.check_runs) {
        console.log(`  check: ${cr.name} | status: ${cr.status} | conclusion: ${cr.conclusion} | ${cr.html_url || cr.details_url}`);
      }
    } else {
      console.log('  no check runs');
    }
    const statusRes = await fetch(`https://api.github.com/repos/adamabraham15/bower-jj/commits/${c.sha}/statuses`, { headers });
    const statuses = (await statusRes.json()) as any[];
    if (statuses && statuses.length > 0) {
      for (const st of statuses) {
        console.log(`  status: ${st.context} | state: ${st.state} | ${st.target_url}`);
      }
    }
  }
}

main().catch(console.error);
