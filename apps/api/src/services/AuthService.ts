import { pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { SessionModel } from "../models/SessionModel.js";
import { UserModel, type UserDoc } from "../models/UserModel.js";

export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

const HASH_ITERATIONS = 310_000;
const HASH_BYTES = 32;
const HASH_ALGORITHM = "sha256";

export const SignupInputSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  name: z.string().optional(),
});

export const LoginInputSchema = z.object({
  email: z.string().email("Enter a valid email and password."),
  password: z.string().min(1, "Enter a valid email and password."),
});

export function NormalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function PublicUser(user: UserDoc & { _id: unknown }) {
  return {
    id: String(user._id),
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
  };
}

export async function AddUser(input: unknown) {
  const data = SignupInputSchema.parse(input);
  const email = NormalizeEmail(data.email);
  const name = data.name?.trim() || email.split("@")[0] || "Student";
  const passwordHash = HashPassword(data.password);

  try {
    const user = await UserModel.create({ email, name, passwordHash });
    return PublicUser(user);
  } catch (error) {
    if (IsDuplicateKey(error)) {
      throw new Error("An account with this email already exists.");
    }
    throw error;
  }
}

export async function CheckUserPassword(input: unknown) {
  const data = LoginInputSchema.parse(input);
  const user = await UserModel.findOne({ email: NormalizeEmail(data.email) });

  if (!user || !VerifyPassword(data.password, user.passwordHash)) {
    return null;
  }

  return PublicUser(user);
}

export async function AddSession(userId: string) {
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await SessionModel.create({ sessionId, userId, expiresAt });
  return { sessionId, expiresAt };
}

export async function GetUserBySession(sessionId: string) {
  if (!sessionId) return null;

  const session = await SessionModel.findOne({
    sessionId,
    expiresAt: { $gt: new Date() },
  });

  if (!session) return null;

  const user = await UserModel.findById(session.userId);
  return user ? PublicUser(user) : null;
}

export async function DeleteSession(sessionId: string) {
  if (!sessionId) return;
  await SessionModel.deleteOne({ sessionId });
}

function HashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = pbkdf2Sync(password, salt, HASH_ITERATIONS, HASH_BYTES, HASH_ALGORITHM).toString("base64url");
  return `pbkdf2_${HASH_ALGORITHM}$${HASH_ITERATIONS}$${salt}$${hash}`;
}

function VerifyPassword(password: string, stored: string) {
  const [method, iterationsRaw, salt, storedHash] = stored.split("$");
  if (method !== `pbkdf2_${HASH_ALGORITHM}` || !iterationsRaw || !salt || !storedHash) return false;

  const iterations = Number(iterationsRaw);
  if (!Number.isInteger(iterations) || iterations < 100_000) return false;

  const storedBuffer = Buffer.from(storedHash, "base64url");
  const derivedBuffer = pbkdf2Sync(password, salt, iterations, storedBuffer.length, HASH_ALGORITHM);
  if (derivedBuffer.length !== storedBuffer.length) return false;

  return timingSafeEqual(derivedBuffer, storedBuffer);
}

function IsDuplicateKey(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

