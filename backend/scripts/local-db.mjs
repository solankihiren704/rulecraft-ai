// Dev-only helper: runs a real, disposable local PostgreSQL instance using
// the `embedded-postgres` package, entirely inside this project folder
// (backend/.local-pgdata), so nobody needs Docker or a system Postgres
// install to develop or test this backend. Not used in production —
// production/staging point DATABASE_URL at a real managed Postgres.
import EmbeddedPostgres from 'embedded-postgres'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, '..', '.local-pgdata')
const alreadyInitialised = existsSync(path.join(dataDir, 'PG_VERSION'))

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'postgres',
  password: 'postgres',
  port: 55432,
  persistent: true,
})

const command = process.argv[2] ?? 'start'

if (command === 'start') {
  if (!alreadyInitialised) await pg.initialise()
  await pg.start()
  try {
    await pg.createDatabase('rulecraft_ai')
  } catch {
    // already exists — fine
  }
  console.log('Embedded Postgres ready at postgresql://postgres:postgres@localhost:55432/rulecraft_ai')
} else if (command === 'stop') {
  await pg.stop()
  console.log('Embedded Postgres stopped')
}
