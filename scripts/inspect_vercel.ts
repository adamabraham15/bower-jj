async function test() {
  const url = 'https://bower-jj.vercel.app/?_t=' + Date.now();
  const res = await fetch(url, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
    }
  });
  console.log('Status:', res.status);
  console.log('X-Vercel-Id:', res.headers.get('x-vercel-id'));
  console.log('Age:', res.headers.get('age'));
  console.log('X-Vercel-Cache:', res.headers.get('x-vercel-cache'));
  const text = await res.text();
  const m = text.match(/src="(\/assets\/index-[^"]+\.js)"/);
  console.log('JS Bundle:', m ? m[1] : 'none');
}
test();
