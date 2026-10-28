import Database from "better-sqlite3";
import { pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type DbAuthUser = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
};

type UserRow = {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  created_at: string;
};

type SessionRow = {
  id: string;
  user_id: string;
  expires_at: string;
};

export const AUTH_COOKIE = "butler_session";
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

const HASH_ITERATIONS = 310_000;
const HASH_BYTES = 32;
const HASH_ALGORITHM = "sha256";

let db: Database.Database | null = null;

function sqlitePath() {
  const configured = process.env.BUTLER_SQLITE_PATH?.trim();
  if (configured) return path.resolve(configured);
  return path.join(process.cwd(), "data", "butler.sqlite");
}

function getDb() {
  if (db) return db;
  const file = sqlitePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const nextDb = new Database(file);
  nextDb.pragma("journal_mode = WAL");
  nextDb.pragma("foreign_keys = ON");
  nextDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
  `);
  db = nextDb;
  return nextDb;
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function publicUser(row: UserRow): DbAuthUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: row.created_at,
  };
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = pbkdf2Sync(password, salt, HASH_ITERATIONS, HASH_BYTES, HASH_ALGORITHM).toString("base64url");
  return `pbkdf2_${HASH_ALGORITHM}$${HASH_ITERATIONS}$${salt}$${hash}`;
}

function verifyPassword(password: string, stored: string) {
  const [method, iterationsRaw, salt, storedHash] = stored.split("$");
  if (method !== `pbkdf2_${HASH_ALGORITHM}` || !iterationsRaw || !salt || !storedHash) return false;
  const iterations = Number(iterationsRaw);
  if (!Number.isInteger(iterations) || iterations < 100_000) return false;

  const storedBuffer = Buffer.from(storedHash, "base64url");
  const derivedBuffer = pbkdf2Sync(password, salt, iterations, storedBuffer.length, HASH_ALGORITHM);
  if (derivedBuffer.length !== storedBuffer.length) return false;
  return timingSafeEqual(derivedBuffer, storedBuffer);
}

export function createUser(email: string, password: string, name?: string) {
  const cleanEmail = normalizeEmail(email);
  const cleanName = name?.trim() || cleanEmail.split("@")[0] || "Student";
  const id = randomUUID();
  const passwordHash = hashPassword(password);
  const database = getDb();

  database
    .prepare("INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)")
    .run(id, cleanEmail, cleanName, passwordHash);

  const row = database.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow;
  return publicUser(row);
}

export function authenticateUser(email: string, password: string) {
  const row = getDb()
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(normalizeEmail(email)) as UserRow | undefined;
  if (!row || !verifyPassword(password, row.password_hash)) return null;
  return publicUser(row);
}

export function createSession(userId: string) {
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  getDb()
    .prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)")
    .run(id, userId, expiresAt);
  return { id, expiresAt };
}

export function getUserForSession(sessionId: string | undefined) {
  if (!sessionId) return null;
  const now = new Date().toISOString();
  const row = getDb()
    .prepare(
      `SELECT users.*
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.id = ? AND sessions.expires_at > ?`,
    )
    .get(sessionId, now) as UserRow | undefined;
  return row ? publicUser(row) : null;
}

export function deleteSession(sessionId: string | undefined) {
  if (!sessionId) return;
  getDb().prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
}

export function deleteExpiredSessions() {
  getDb().prepare("DELETE FROM sessions WHERE expires_at <= ?").run(new Date().toISOString());
}
