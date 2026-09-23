import { env } from "cloudflare:workers";
import { ensureSchema, getSubtask, normalizeAssignee } from "../../tasks/store";
import { requirePassword } from "../../../password-auth";

type RouteContext = {
  params: Promise<{ subtaskId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  if (!(await requirePassword(request))) {
    return Response.json({ error: "Password required." }, { status: 401 });
  }

  await ensureSchema();

  const { subtaskId } = await context.params;
  const payload = (await request.json()) as {
    title?: string;
    assignee?: string;
    completed?: boolean;
  };
  const current = await getSubtask(subtaskId);

  if (!current) {
    return Response.json({ error: "Subtask not found." }, { status: 404 });
  }

  await env.DB.prepare(
    `
      UPDATE subtasks
      SET title = ?, assignee = ?, completed = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `
  )
    .bind(
      payload.title?.trim() ?? current.title,
      normalizeAssignee(payload.assignee ?? current.assignee),
      typeof payload.completed === "boolean"
        ? Number(payload.completed)
        : Number(current.completed),
      subtaskId
    )
    .run();

  return Response.json({ subtask: await getSubtask(subtaskId) });
}

export async function DELETE(request: Request, context: RouteContext) {
  if (!(await requirePassword(request))) {
    return Response.json({ error: "Password required." }, { status: 401 });
  }

  await ensureSchema();

  const { subtaskId } = await context.params;
  await env.DB.prepare("DELETE FROM subtasks WHERE id = ?").bind(subtaskId).run();

  return Response.json({ ok: true });
}
