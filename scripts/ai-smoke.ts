// Manual smoke test for runAgent against a real LLM provider.
// Prereqs:
//   - bunx convex dev running against your dev deployment
//   - Admin profile exists for your dev user
//   - aiConfigs row inserted with a real apiKey for purpose 'chat-summary'
//   - aiPrompts row inserted for purpose 'chat-summary'
//
// Run: bunx tsx scripts/ai-smoke.ts
//
// This file exists for human verification. It is not part of CI and uses
// real tokens — keep usage minimal.
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api';

async function main() {
  const url = process.env.CONVEX_URL;
  if (!url) {
    console.error('Set CONVEX_URL to your dev deployment URL.');
    process.exit(1);
  }
  const client = new ConvexHttpClient(url);
  // Insert a smoke action wrapper in convex/ai/runAgent.ts (commented below)
  // and call it here. For now, document the procedure:
  console.log('Smoke procedure:');
  console.log('1. Seed aiConfigs and aiPrompts via the Convex dashboard.');
  console.log('2. Call a feature action that wraps runAgent (defined in spec A).');
  console.log('3. Inspect the latest aiInvocations row for status=success.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
