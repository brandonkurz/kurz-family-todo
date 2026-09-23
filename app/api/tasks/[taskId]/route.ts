import { env } from "cloudflare:workers";
import { ensureSchema, getTask, normalizeAssignee } from "../store";
import { requirePassword } from "../../../password-auth";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  if (!(await requirePassword(request))) {
    return Response.json({ error: "Password required." }, { status: 401 });
  }

  await ensureSchema();

  const { taskId } = await context.params;
  const payload = (await request.json()) as {
    title?: string;
    category?: string;
    assignee?: string;
    dueDate?: string;
    completed?: boolean;
  };
  const current = await getTask(taskId);

  if (!current) {
    return Response.json({ error: "Task not found." }, { status: 404 });
  }

  await env.DB.prepare(
    `
      UPDATE tasks
      SET title = ?, category = ?, assignee = ?, due_date = ?, completed = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `
  )
    .bind(
      payload.title?.trim() ?? current.title,
      payload.category?.trim() ?? current.category,
      normalizeAssignee(payload.assignee ?? current.assignee),
      payload.dueDate?.trim() ?? current.dueDate,
      typeof payload.completed === "boolean"
        ? Number(payload.completed)
        : Number(current.completed),
      taskId
    )
    .run();

  return Response.json({ task: await getTask(taskId) });
}

export async function DELETE(request: Request, context: RouteContext) {
  if (!(await requirePassword(request))) {
    return Response.json({ error: "Password required." }, { status: 401 });
  }

  await ensureSchema();

  const { taskId } = await context.params;
  await env.DB.batch([
    env.DB.prepare("DELETE FROM subtasks WHERE task_id = ?").bind(taskId),
    env.DB.prepare("DELETE FROM tasks WHERE id = ?").bind(taskId),
  ]);

  return Response.json({ ok: true });
}
