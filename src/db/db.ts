/**
 * The single IndexedDB connection, shared by both repos.
 *
 * Kept in its own module so scorecardsRepo and runsRepo open the database
 * exactly once between them. Two modules each holding their own `openDB`
 * promise would race on the version upgrade and one would get a blocked
 * transaction.
 */

import { openDB, type IDBPDatabase } from "idb";
import { DB_NAME, DB_VERSION, RUNS_STORE, SCORECARDS_STORE } from "./types";

/** The v1 store name, kept only so the upgrade can drop it. */
const LEGACY_RUBRICS_STORE = "rubrics";

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // v2: `rubrics` became `scorecards`, and the advanced format moved
        // under `content` behind a type discriminator. The old store is
        // dropped rather than migrated — nothing has shipped, there is no
        // production data, and a migration for data that never existed is a
        // liability rather than a safety net. A local dev row from the v1
        // session is not worth carrying a translation layer forever.
        if (db.objectStoreNames.contains(LEGACY_RUBRICS_STORE)) {
          db.deleteObjectStore(LEGACY_RUBRICS_STORE);
        }
        // Runs from v1 reference the old shape too, so they go with it.
        if (db.objectStoreNames.contains(RUNS_STORE)) {
          db.deleteObjectStore(RUNS_STORE);
        }

        if (!db.objectStoreNames.contains(SCORECARDS_STORE)) {
          const scorecards = db.createObjectStore(SCORECARDS_STORE, { keyPath: "id" });
          scorecards.createIndex("updatedAt", "updatedAt");
          // The library filters by type once more than one type exists.
          scorecards.createIndex("type", "type");
        }

        const runs = db.createObjectStore(RUNS_STORE, { keyPath: "id" });
        runs.createIndex("startedAt", "startedAt");
        // Run history is always read per-scorecard ("show me the last nine
        // times I ran this"), so that lookup gets an index rather than a
        // full-store scan filtered in JS.
        runs.createIndex("scorecardId", "scorecardId");
      },
    });
  }
  return dbPromise;
}
