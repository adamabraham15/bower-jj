async function checkVercel() {
  const html = await fetch('https://bower-jj.vercel.app').then(r => r.text());
  console.log('HTML loaded, length:', html.length);
  const match = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
  if (match) {
    console.log('JS Bundle:', match[1]);
    const js = await fetch('https://bower-jj.vercel.app' + match[1]).then(r => r.text());
    console.log('Includes trycloudflare.com:', js.includes('trycloudflare.com'));
    const wsMatches = js.match(/(wss?:\/\/[^\s"',]+)/g);
    console.log('Configured WS URLs in bundle:', wsMatches);
  }
}
checkVercel();
