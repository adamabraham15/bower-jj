import { authService } from '../src/services/supabaseClient';

async function main() {
  console.log('Testing authService.getLiveServerUrl()...');
  const start = Date.now();
  const url = await authService.getLiveServerUrl();
  console.log(`Resolved URL in ${Date.now() - start}ms:`, url);
}

main().catch(console.error);
