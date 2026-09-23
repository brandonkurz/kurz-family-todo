import {
  createId,
  ensureSchema,
  listTasks,
  normalizeAssignee,
  seedIfNeeded,
} from "./store";
import { env } from "cloudflare:workers";
import { requirePassword } from "../../password-auth";

export async function GET(request: Request) {
  if (!(await requirePassword(request))) {
    return Response.json({ error: "Password required." }, { status: 401 });
  }

  await ensureSchema();
  await seedIfNeeded();

  return Response.json({ tasks: await listTasks() });
}

export async function POST(request: Request) {
  if (!(await requirePassword(request))) {
    return Response.json({ error: "Password required." }, { status: 401 });
  }

  await ensureSchema();

  const payload = (await request.json()) as {
    title?: string;
    category?: string;
    assignee?: string;
    dueDate?: string;
  };
  const title = payload.title?.trim() ?? "";

  if (!title) {
    return Response.json({ error: "Task title is required." }, { status: 400 });
  }

  const id = createId("task");
  await env.DB.prepare(
    "INSERT INTO tasks (id, title, category, assignee, due_date) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(
      id,
      title,
      payload.category?.trim() || "Home",
      normalizeAssignee(payload.assignee),
      payload.dueDate?.trim() ?? ""
    )
    .run();

  const task = (await listTasks()).find((item) => item.id === id);
  return Response.json({ task }, { status: 201 });
}
