import process from 'node:process'

import { defineConfig } from 'drizzle-kit'

import './src/load-env.ts'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.pg.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL
      ?? 'postgres://webtools:webtools@localhost:5432/webtools',
  },
})
