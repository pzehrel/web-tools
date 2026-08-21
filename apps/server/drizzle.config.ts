import process from 'node:process'

import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL
      ?? 'postgres://webtools:webtools@localhost:5432/webtools',
  },
})
