#!/usr/bin/env sh
# One command for assessors on macOS / Linux: installs, builds, starts the app on http://localhost:4000.
# Needs Node.js 20.12 or newer. Uses an embedded MongoDB unless MONGODB_URI is set in .env.
set -e
cd "$(dirname "$0")/.."
npm run setup
exec npm start
