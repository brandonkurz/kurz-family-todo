import { env } from "cloudflare:workers";
import { createId, ensureSchema, getSubtask, normalizeAssignee } from "../../store";
import { requirePassword } from "../../../../password-auth";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  if (!(await requirePassword(request))) {
    return Response.json({ error: "Password required." }, { status: 401 });
  }

  await ensureSchema();

  const { taskId } = await context.params;
  const payload = (await request.json()) as {
    title?: string;
    assignee?: string;
  };
  const title = payload.title?.trim() ?? "";

  if (!title) {
    return Response.json(
      { error: "Subtask title is required." },
      { status: 400 }
    );
  }

  const id = createId("subtask");
  await env.DB.prepare(
    "INSERT INTO subtasks (id, task_id, title, assignee) VALUES (?, ?, ?, ?)"
  )
    .bind(id, taskId, title, normalizeAssignee(payload.assignee))
    .run();

  return Response.json({ subtask: await getSubtask(id) }, { status: 201 });
}
