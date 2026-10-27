# Create Rota — Deployment Guide

## Overview
Create Rota is structured to allow independent deployment of the frontend (e.g. Vercel, Netlify, Cloudflare Pages) and the backend (e.g. Render, Fly.io, Railway, AWS ECS).

## Environment Variables
The application reads configuration exclusively from environment variables:
- `DATABASE_URL`: Connection string for PostgreSQL (`postgresql+psycopg://user:password@host:port/dbname`).
- `SECRET_KEY`: High-entropy 32+ character random string.
- `CORS_ORIGINS`: Comma-separated list of allowed frontend origins (e.g. `https://app.createrota.com`).
- `EMAIL_PROVIDER`: Provider mode (`smtp`, `sendgrid`, `console`).
- `ENVIRONMENT`: Set to `production` in production environments.

## Database Migrations
Migrations are managed with Alembic. Before starting the API in production, execute:
```bash
alembic upgrade head
```

## Health & Readiness Checks
The API exposes:
- `GET /api/v1/health`: Checks system health, version, database connectivity, and timestamp.
