async function main() {
  const url = 'https://cho-convicted-surgeon-advise.trycloudflare.com/health';
  const start = Date.now();
  try {
    const res = await fetch(url);
    console.log('HTTP status:', res.status, `in ${Date.now() - start}ms`);
    const txt = await res.text();
    console.log('Body:', txt);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

main().catch(console.error);
