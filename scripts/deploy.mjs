#!/usr/bin/env node
// Deploy to Vercel production + update all custom aliases
import { execSync } from 'child_process';

const ALIASES = [
  'sykss-agency.vercel.app',
];

function run(cmd) {
  console.log(`> ${cmd}`);
  return execSync(cmd, { stdio: 'inherit' });
}

// Step 1: Deploy and capture output
console.log('=== Deploying to production ===');
let deployOutput;
try {
  deployOutput = execSync('npx -y vercel@latest deploy --prod --yes', {
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'inherit'],
  });
} catch (e) {
  // vercel deploy may exit non-zero but still succeed with output
  deployOutput = e.stdout || '';
}

console.log(deployOutput);

// HARD FAIL on any deploy error — `vercel deploy` writes a JSON blob and
// keeps going instead of throwing. Without this guard the script would
// silently alias the OLD deployment + run the migration against stale
// code. Catches:
//   - BUILD_ERROR ("readyState":"ERROR")
//   - deploy_failed (config errors like maxDuration over plan cap)
//   - any line starting with "Error:"
const hasBuildError = /"readyState":\s*"ERROR"/.test(deployOutput) || /BUILD_ERROR/.test(deployOutput);
const hasDeployError = /"status":\s*"error"/.test(deployOutput) || /"reason":\s*"deploy_failed"/.test(deployOutput);
const hasInlineError = /^Error:/m.test(deployOutput);
if (hasBuildError || hasDeployError || hasInlineError) {
  console.error('\n[deploy] DEPLOYMENT FAILED. Not aliasing, not migrating.');
  if (hasBuildError) console.error('[deploy] reason: build error');
  if (hasDeployError) console.error('[deploy] reason: deploy/config error (check maxDuration vs plan cap, env vars, etc.)');
  console.error('[deploy] Run `npx vercel inspect <url> --logs` for details.');
  process.exit(1);
}

// Step 2: Extract deployment URL from output
// Look for "Production: https://xxx.vercel.app" or "Aliased: https://xxx.vercel.app"
const urlMatch = deployOutput.match(/Production:\s+(https:\/\/[^\s]+\.vercel\.app)/);
const deployUrl = urlMatch?.[1]?.replace('https://', '') || 'pawen-command-center.vercel.app';

console.log(`\nProduction URL: ${deployUrl}`);

// Step 3: Update aliases
for (const alias of ALIASES) {
  console.log(`\nUpdating alias: ${alias} -> ${deployUrl}`);
  try {
    run(`npx -y vercel@latest alias set ${deployUrl} ${alias}`);
    console.log(`OK: ${alias} now points to ${deployUrl}`);
  } catch (err) {
    console.error(`Failed to update alias ${alias}:`, err.message);
  }
}

// Step 4: Run DB migrations against the live deployment.
// runMigrations is idempotent (CREATE TABLE IF NOT EXISTS everywhere) so
// hitting it on every deploy is cheap and means a fresh schema change
// (e.g. the pipeline_jobs table) ships in lockstep with the code that
// depends on it. No more "deployed but the table doesn't exist" 500s.
const MIGRATE_HOST = ALIASES[0] || deployUrl;
const ADMIN_TOKEN = process.env.ADMIN_PASSWORD || process.env.ADMIN_TOKEN;
if (!ADMIN_TOKEN) {
  console.warn('\n[migrate] ADMIN_PASSWORD not set in shell — skipping auto-migrate.');
  console.warn('[migrate] Run manually: curl -X POST -H "x-admin-token: $ADMIN_PASSWORD" https://' + MIGRATE_HOST + '/api/admin/db-migrate');
} else {
  console.log(`\n=== Running DB migrations against https://${MIGRATE_HOST} ===`);
  try {
    const out = execSync(
      `curl -sS -X POST -H "x-admin-token: ${ADMIN_TOKEN}" https://${MIGRATE_HOST}/api/admin/db-migrate`,
      { encoding: 'utf8' },
    );
    console.log(out);
    try {
      const parsed = JSON.parse(out);
      if (!parsed.ok) {
        console.error('[migrate] Migration returned ok=false. Investigate before relying on new tables.');
        process.exitCode = 1;
      } else {
        console.log(`[migrate] Applied: ${(parsed.applied || []).join(', ') || '(no changes)'}`);
      }
    } catch {
      console.warn('[migrate] Could not parse migration response; check the body above.');
    }
  } catch (err) {
    console.error('[migrate] Auto-migrate failed:', err.message);
    console.error('[migrate] Run manually before users hit the new endpoints.');
    process.exitCode = 1;
  }
}

console.log('\nDone!');
