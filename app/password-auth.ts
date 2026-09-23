import { env } from "cloudflare:workers";

export const PASSWORD_COOKIE = "kurz_family_access";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function configuredPassword() {
  return (env as { SITE_PASSWORD?: string }).SITE_PASSWORD ?? "";
}

async function hash(value: string) {
  const bytes = new TextEncoder().encode(`kurz-family:${value}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

function readCookie(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;

  for (const cookie of cookieHeader.split(";")) {
    const [cookieName, ...valueParts] = cookie.trim().split("=");
    if (cookieName === name) return valueParts.join("=");
  }

  return null;
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;

  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return difference === 0;
}

export async function isPasswordAuthenticated(cookieHeader: string | null) {
  const password = configuredPassword();
  if (!password) return false;

  const cookieValue = readCookie(cookieHeader, PASSWORD_COOKIE);
  if (!cookieValue) return false;

  return constantTimeEqual(cookieValue, await hash(password));
}

export async function passwordIsCorrect(value: string) {
  const password = configuredPassword();
  if (!password) return false;

  const [attempt, expected] = await Promise.all([hash(value), hash(password)]);
  return constantTimeEqual(attempt, expected);
}

export async function passwordCookie(request: Request) {
  const password = configuredPassword();
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";

  return `${PASSWORD_COOKIE}=${await hash(password)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}${secure}`;
}

export async function requirePassword(request: Request) {
  return isPasswordAuthenticated(request.headers.get("cookie"));
}
