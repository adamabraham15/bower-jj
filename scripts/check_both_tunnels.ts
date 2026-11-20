async function check(name: string, url: string) {
  try {
    const res = await fetch(`${url}/metrics?token=bower-jj-internal-metrics-secret`);
    console.log(`=== ${name} (${url}) === HTTP ${res.status}`);
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`=== ${name} ERROR:`, err);
  }
}

async function main() {
  await check('Task 19792 (Years Charm)', 'https://years-charm-bills-walks.trycloudflare.com');
  await check('Mystery Server (Cho Convicted)', 'https://cho-convicted-surgeon-advise.trycloudflare.com');
}

main().catch(console.error);
