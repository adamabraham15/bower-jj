async function test() {
  const js = await fetch('https://bower-jj.vercel.app/assets/index-Bt8rcGo4.js').then(r => r.text());
  const m = js.match(/\/assets\/packs\/[^"'\s]+/g);
  console.log('Pack assets referenced:', [...new Set(m)]);
  const idx = js.indexOf('BOWER JJ VAULT PACKS');
  if (idx !== -1) {
    console.log('Snippet around BOWER JJ VAULT PACKS:');
    console.log(js.substring(idx - 100, idx + 400));
  } else {
    console.log('BOWER JJ VAULT PACKS not found!');
  }
}
test();
