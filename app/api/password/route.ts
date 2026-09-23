import {
  passwordCookie,
  passwordIsCorrect,
  PASSWORD_COOKIE,
} from "../../password-auth";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as {
    password?: string;
  } | null;

  if (!payload?.password || !(await passwordIsCorrect(payload.password))) {
    return Response.json({ error: "Incorrect password." }, { status: 401 });
  }

  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": await passwordCookie(request) } }
  );
}

export async function DELETE() {
  return Response.json(
    { ok: true },
    {
      headers: {
        "Set-Cookie": `${PASSWORD_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
      },
    }
  );
}
