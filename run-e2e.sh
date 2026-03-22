#!/bin/bash
cd /Users/charlesdunn/short-go-app
export E2E_BASE_URL="https://short-go-app-git-dev-shortgoequinechiro-9122s-projects.vercel.app"
npx playwright test e2e/full-app.spec.ts --grep "Public Pages" --reporter=list --project=chromium --timeout=15000 2>&1 | tail -20
