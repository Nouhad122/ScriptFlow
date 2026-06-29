/**
 * Database connection singleton.
 *
 * @libsql/client is the async SQLite client already installed in this project.
 * It uses a file: URL scheme for local databases. The client is created once
 * and reused across all database calls — creating a new client per request
 * would open multiple file handles to the same SQLite file.
 *
 * WHY PATH RESOLUTION:
 *   env.databasePath is a relative path ('./data/scriptflow.db').
 *   @libsql/client needs either a file: URL with an absolute path or a relative
 *   path from CWD. We resolve to absolute and normalize backslashes so this
 *   works correctly on Windows (path.resolve returns C:\... on Windows, but
 *   file: URLs require forward slashes).
 *
 * WHY mkdirSync:
 *   @libsql/client creates the database file but does NOT create the parent
 *   directory if it doesn't exist. The data/ directory is gitignored (*.db
 *   rule covers the file, the empty directory is never committed). We create
 *   it here so the server starts cleanly on a fresh clone without manual setup.
 */

import { createClient, type Client } from '@libsql/client';
import { mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { env } from '../config/env';

let _client: Client | null = null;

export function getDb(): Client {
  if (!_client) {
    const absolutePath = resolve(env.databasePath);
    mkdirSync(dirname(absolutePath), { recursive: true });

    const url = `file:${absolutePath.replace(/\\/g, '/')}`;
    _client = createClient({ url });
  }
  return _client;
}
