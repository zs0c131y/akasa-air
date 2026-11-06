@echo off
rem One command for assessors on Windows: installs, builds, starts the app on http://localhost:4000.
rem Needs Node.js 20.12 or newer. Uses an embedded MongoDB unless MONGODB_URI is set in .env.
setlocal
cd /d "%~dp0.."
call npm.cmd run setup || exit /b 1
call npm.cmd start
