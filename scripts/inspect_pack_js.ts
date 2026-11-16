async function test() {
  const js = await fetch('https://bower-jj.vercel.app/assets/index-Cipy5D5l.js').then(r => r.text());
  console.log('Has tearProgress:', js.includes('tearProgress'));
  console.log('Has fill-emerald-800:', js.includes('fill-emerald-800'));
  console.log('Has TEAR:', js.includes('TEAR'));
  console.log('Has Swipe finger across:', js.includes('Swipe finger across'));
}
test();
