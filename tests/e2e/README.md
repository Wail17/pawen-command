# E2E tests (Playwright)

## Setup (one-time)

```bash
npm install --save-dev @playwright/test
npx playwright install chromium
```

## Run

```bash
# Start dev server in another terminal
npm run dev

# In the test terminal, set creds then run
export E2E_BASE_URL=http://localhost:3000
export APP_PASSWORD=...
export ADMIN_PASSWORD=...
npm run test:e2e
```

Against Vercel prod:
```bash
export E2E_BASE_URL=https://pawen-command-center.vercel.app
# ...rest same
```

Each spec is idempotent and uses throwaway test data.
Flaky step retry is set to 1 on CI, 0 locally.
