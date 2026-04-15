import { describe, expect, it } from 'vitest'
import { DatabaseSync } from 'node:sqlite'

describe('node:sqlite under cloudflare vitest pool', () => {
  it('opens an in-memory database', () => {
    const db = new DatabaseSync(':memory:')
    db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT NOT NULL)')
    db.exec("INSERT INTO t (name) VALUES ('ok')")
    const row = db.prepare('SELECT name FROM t').get() as { name: string }
    expect(row.name).toBe('ok')
  })
})
