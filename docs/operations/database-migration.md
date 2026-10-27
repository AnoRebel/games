# Data migration to the `games` identifiers

The product was renamed from Card Games to Games. Stored data moves from the
`card-games` / `cg` identifiers to `games` once, automatically. This page
covers what happens, how to back up first, how to recover, and how to roll
back.

## Server database

The default database moves from `data/card-games.db` to `data/games.db`.

**When:** at server start, before anything opens the database. Every database
user waits for the migration, so no writer is active while it runs.

**What it does:**

1. Takes a consistent backup of the legacy database —
   `data/card-games.db.backup-<timestamp>` — with `VACUUM INTO`, which
   includes committed rows still in the write-ahead log.
2. Copies the legacy database to `data/games.db.tmp` the same way.
3. Verifies the copy: `PRAGMA integrity_check` must report `ok`, and the
   `results` and `room_snapshots` row counts must match the legacy database.
4. Writes `data/games.db.migrated.json` (source, backup path, row counts, time).
5. Renames the verified copy to `data/games.db`.

`data/card-games.db` and the backup are left in place.

**Outcomes:**

| Data directory                                   | Result                                                                  |
| ------------------------------------------------ | ----------------------------------------------------------------------- |
| neither database                                 | nothing to do; `games.db` is created on first use                       |
| only `games.db`                                  | nothing to do                                                           |
| `games.db` + `games.db.migrated.json`            | migration already done; nothing to do                                   |
| only `card-games.db` (or an interrupted attempt) | migrated as above                                                       |
| both databases, no completion marker             | **refused** — the database stays unavailable and the conflict is logged |

On a refused conflict the server keeps running (rooms work in memory), but the
leaderboard and restart-survival snapshots report themselves unavailable until
the conflict is resolved. Nothing is overwritten and no empty database is
started.

**Explicit connections:** when `NUXT_LIBSQL_URL` is set (a remote libsql/Turso
URL or an explicit `file:` path) the migration does nothing — that setting stays
authoritative.

### Before deploying

1. Stop the running server (or deploy as a replacement, not alongside it).
2. Copy the data volume, or at least `data/card-games.db` and any
   `card-games.db-wal` / `-shm` files next to it.

### Resolving a conflict

Both `data/card-games.db` and `data/games.db` exist, but no migration was
recorded. Decide which database holds the data you want:

- keep `games.db`: move `card-games.db` (and its `-wal`/`-shm` files) out of the
  data directory and restart;
- keep `card-games.db`: move `games.db` out of the data directory and restart —
  the migration then runs normally.

### Recovering

A backup is an ordinary SQLite file. To restore it, stop the server, replace
`data/games.db` with a copy of the backup, delete `data/games.db-wal` and
`data/games.db-shm` if present, and start the server.

### Rolling back

Rolling back the code does not move data back. After the migration, new
results and room snapshots are written to `data/games.db` only; the legacy
database is a snapshot from migration time, not a live replica. To roll back:

1. Stop the server so nothing writes to either database.
2. Bring post-migration writes back into the legacy database if you need them,
   for example:

   ```sh
   sqlite3 data/card-games.db \
     "ATTACH 'data/games.db' AS g;
      INSERT OR IGNORE INTO results
        (game_id, match_id, player_id, player_name, won, score, rank_metric, played_at)
        SELECT game_id, match_id, player_id, player_name, won, score, rank_metric, played_at
        FROM g.results;"
   ```

   (`results` is unique per match and player, so this never duplicates a play.
   Columns added after the migration are not part of the legacy table.)

3. Deploy the previous version, which reads `data/card-games.db`.

Alternatively restore `data/card-games.db` from the backup to return to the
state at migration time, accepting the loss of later plays.

## Browser data

Each player's browser migrates its own data on their first visit after the
update. The site keeps the same origin (`card-games.anorebel.net` keeps
serving the same deployment as `games.anorebel.net`) because browser storage
belongs to an origin; moving between origins needs its own transfer.

- Local and session storage keys `cg:*` are copied to `games:*` where the new
  key is still empty, so newer values are never overwritten. The locale cookie
  is copied the same way.
- The IndexedDB database `card-games` (results, uploaded images, saved games) is
  copied into `games` in a single transaction, compared record by record, and
  only then marked complete. The legacy database is kept as a recovery copy and
  is never created just to check whether it exists.
- Re-running is safe: an interrupted copy either wrote nothing or everything,
  and verification recognises an already-copied database, so nothing is
  duplicated.
- If the new database already holds different data, or the browser runs out of
  storage, the player sees a notice with **Try again**, and for a conflict
  **Keep current data**. Games don't start, and results aren't recorded, until
  the migration has settled.
