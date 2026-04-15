# workerd-issue-6583

Minimal repro for a `workerd` / Cloudflare Vitest pool crash on macOS arm64.

https://github.com/cloudflare/workerd/issues/6583

## Commands

```bash
bun install
bun run test:sqlite
```

Optional: test with a locally built `workerd`:

```bash
MINIFLARE_WORKERD_PATH=/absolute/path/to/workerd bun run test:sqlite
```

## Expected

The test should pass and report one successful test.

## Actual

On the affected setup, the Cloudflare pool worker crashes before test execution
with:

```text
Error: [vitest-pool]: Worker cloudflare-pool emitted error.
Caused by: Error: Worker exited unexpectedly
```

and often:

```text
Received signal #11: Segmentation fault: 11
```

## Commands

Passing control test:

```bash
bunx vitest run --max-workers=1 --no-isolate src/control.test.ts
```

Crashing repro:

```bash
bun run test:sqlite
```

Equivalent direct command:

```bash
bunx vitest run --max-workers=1 --no-isolate src/node-sqlite.test.ts
```

## Expected

The `node:sqlite` test should pass and report one successful test.

## Actual

The Cloudflare pool worker exits before any test executes:

```text
*** Received signal #11: Segmentation fault: 11
Error: [vitest-pool]: Worker cloudflare-pool emitted error.
Caused by: Error: Worker exited unexpectedly

Test Files   (1)
     Tests  no tests
    Errors  1 error
```

## Minimal crashing test

```ts
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
```

## Additional checks

- This is not Bun-specific. The broader crash also reproduces when invoking
  Vitest via `node ./node_modules/vitest/vitest.mjs ...`.
- Pointing Miniflare at a locally built `workerd` binary did not change the
  behavior.

Example:

```bash
MINIFLARE_WORKERD_PATH=/absolute/path/to/workerd \
  bun run test:sqlite
```

still crashes with the same worker-pool error and segfault.

## Native trace from source-built `workerd`

I attached LLDB to the spawned `workerd` process and reproduced the crash using
a local source build. The process stopped with:

```text
EXC_BAD_ACCESS (code=2, address=0x16a6f3fe0)
```

Top of stack:

```text
libc++abi.dylib`operator new
workerd`kj::_::HeapArrayDisposer::allocateImpl
workerd`kj::heapString(char const*, unsigned long)
workerd`kj::heapString(kj::ArrayPtr<char const>)
workerd`kj::Path::evalPart
workerd`kj::Path::evalImpl
workerd`kj::PathPtr::eval
workerd`workerd::jsg::ModuleRegistryImpl<...>::resolve
workerd`workerd::jsg::ModuleRegistryImpl<...>::resolve
workerd`workerd::jsg::ModuleRegistryImpl<...>::resolve
    ...
```

The `resolve(...)` frame repeats deeply, which makes this look like a module
resolution/path evaluation problem inside `workerd`, triggered by the
`node:sqlite` import path under the Vitest pool.
