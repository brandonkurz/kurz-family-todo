import { env } from "cloudflare:workers";

export type Assignee = "Brandon" | "Sarah" | "Both";

export type TaskRecord = {
  id: string;
  title: string;
  category: string;
  assignee: Assignee;
  dueDate: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
  subtasks: SubtaskRecord[];
};

export type SubtaskRecord = {
  id: string;
  taskId: string;
  title: string;
  assignee: Assignee;
  completed: boolean;
};

type RawTask = {
  id: string;
  title: string;
  category: string;
  assignee: Assignee;
  due_date: string;
  completed: number;
  created_at: string;
  updated_at: string;
};

type RawSubtask = {
  id: string;
  task_id: string;
  title: string;
  assignee: Assignee;
  completed: number;
};

const seedTasks = [
  {
    id: "task-family-calendar",
    title: "Plan the week together",
    category: "Planning",
    assignee: "Both" as Assignee,
    subtasks: [
      { id: "sub-calendar-brandon", title: "Add Brandon commitments", assignee: "Brandon" as Assignee },
      { id: "sub-calendar-sarah", title: "Add Sarah commitments", assignee: "Sarah" as Assignee },
    ],
  },
  {
    id: "task-groceries",
    title: "Restock groceries",
    category: "Errands",
    assignee: "Brandon" as Assignee,
    subtasks: [
      { id: "sub-groceries-list", title: "Make the grocery list", assignee: "Sarah" as Assignee },
      { id: "sub-groceries-shop", title: "Pick up the order", assignee: "Brandon" as Assignee },
    ],
  },
  {
    id: "task-bills",
    title: "Review household bills",
    category: "Bills",
    assignee: "Sarah" as Assignee,
    subtasks: [
      { id: "sub-bills-check", title: "Check recurring charges", assignee: "Sarah" as Assignee },
    ],
  },
];

function db() {
  if (!env.DB) {
    throw new Error("The shared task database is not available yet.");
  }

  return env.DB;
}

export function normalizeAssignee(value: unknown): Assignee {
  return value === "Brandon" || value === "Sarah" || value === "Both"
    ? value
    : "Both";
}

export function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export async function ensureSchema() {
  const database = db();

  await database.batch([
    database.prepare(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'Home',
        assignee TEXT NOT NULL DEFAULT 'Both',
        due_date TEXT NOT NULL DEFAULT '',
        completed INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    database.prepare(`
      CREATE TABLE IF NOT EXISTS subtasks (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        title TEXT NOT NULL,
        assignee TEXT NOT NULL DEFAULT 'Both',
        completed INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      )
    `),
    database.prepare(
      "CREATE INDEX IF NOT EXISTS subtasks_task_id_idx ON subtasks (task_id)"
    ),
  ]);
}

export async function seedIfNeeded() {
  const database = db();
  const count = await database
    .prepare("SELECT COUNT(*) as count FROM tasks")
    .first<{ count: number }>();

  if ((count?.count ?? 0) > 0) {
    return;
  }

  const statements = seedTasks.flatMap((task) => [
    database
      .prepare(
        "INSERT INTO tasks (id, title, category, assignee) VALUES (?, ?, ?, ?)"
      )
      .bind(task.id, task.title, task.category, task.assignee),
    ...task.subtasks.map((subtask) =>
      database
        .prepare(
          "INSERT INTO subtasks (id, task_id, title, assignee) VALUES (?, ?, ?, ?)"
        )
        .bind(subtask.id, task.id, subtask.title, subtask.assignee)
    ),
  ]);

  await database.batch(statements);
}

export async function listTasks(): Promise<TaskRecord[]> {
  const database = db();
  const taskRows = await database
    .prepare("SELECT * FROM tasks ORDER BY completed ASC, created_at DESC")
    .all<RawTask>();
  const subtaskRows = await database
    .prepare("SELECT * FROM subtasks ORDER BY created_at ASC")
    .all<RawSubtask>();
  const subtasksByTask = new Map<string, SubtaskRecord[]>();

  for (const row of subtaskRows.results ?? []) {
    const subtask: SubtaskRecord = {
      id: row.id,
      taskId: row.task_id,
      title: row.title,
      assignee: row.assignee,
      completed: Boolean(row.completed),
    };
    subtasksByTask.set(row.task_id, [
      ...(subtasksByTask.get(row.task_id) ?? []),
      subtask,
    ]);
  }

  return (taskRows.results ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    category: row.category,
    assignee: row.assignee,
    dueDate: row.due_date,
    completed: Boolean(row.completed),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    subtasks: subtasksByTask.get(row.id) ?? [],
  }));
}

export async function getTask(taskId: string) {
  return (await listTasks()).find((task) => task.id === taskId) ?? null;
}

export async function getSubtask(subtaskId: string) {
  const row = await db()
    .prepare("SELECT * FROM subtasks WHERE id = ?")
    .bind(subtaskId)
    .first<RawSubtask>();

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    taskId: row.task_id,
    title: row.title,
    assignee: row.assignee,
    completed: Boolean(row.completed),
  };
}
