#!/bin/bash
export E2E_USER_EMAIL="charlesdunn2006@gmail.com"
export E2E_USER_PASSWORD="Kgrace0603!"
cd "$(dirname "$0")"
npx playwright test --reporter=list --timeout=20000 "$@"
