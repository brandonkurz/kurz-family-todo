"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Assignee = "Brandon" | "Sarah" | "Both";

type Subtask = {
  id: string;
  taskId: string;
  title: string;
  assignee: Assignee;
  completed: boolean;
};

type Task = {
  id: string;
  title: string;
  category: string;
  assignee: Assignee;
  dueDate: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
  subtasks: Subtask[];
};

type TaskDraft = {
  title: string;
  category: string;
  assignee: Assignee;
  dueDate: string;
};

type ViewMode = "active" | "history";

const people: Assignee[] = ["Both", "Brandon", "Sarah"];
const categories = ["Home", "Kids", "Errands", "Bills", "Planning"];

const initialDraft: TaskDraft = {
  title: "",
  category: "Home",
  assignee: "Both",
  dueDate: "",
};

function todayLabel() {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date());
}

function completionFor(task: Task) {
  const total = task.subtasks.length || 1;
  const done = task.subtasks.length
    ? task.subtasks.filter((subtask) => subtask.completed).length
    : task.completed
      ? 1
      : 0;

  return Math.round((done / total) * 100);
}

function dueDateLabel(value: string) {
  if (!value) return "";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function activityDateLabel(value: string) {
  if (!value) return "";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function ownerClass(assignee: Assignee) {
  return `owner-badge owner-${assignee.toLowerCase()}`;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(payload?.error ?? "Something went wrong.");
  }

  return response.json() as Promise<T>;
}

export function TodoApp() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [draft, setDraft] = useState<TaskDraft>(initialDraft);
  const [filter, setFilter] = useState<Assignee>("Both");
  const [viewMode, setViewMode] = useState<ViewMode>("active");
  const [subtaskDrafts, setSubtaskDrafts] = useState<
    Record<string, { title: string; assignee: Assignee }>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    requestJson<{ tasks: Task[] }>("/api/tasks")
      .then((payload) => setTasks(payload.tasks))
      .catch((err: Error) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

  const activeTasks = useMemo(
    () => tasks.filter((task) => !task.completed),
    [tasks]
  );
  const completedTasks = useMemo(
    () =>
      tasks
        .filter((task) => task.completed)
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        ),
    [tasks]
  );

  const visibleTasks = useMemo(() => {
    const currentTasks = viewMode === "active" ? activeTasks : completedTasks;

    if (filter === "Both") {
      return currentTasks;
    }

    return currentTasks.filter(
      (task) =>
        task.assignee === filter ||
        task.assignee === "Both" ||
        task.subtasks.some((subtask) => subtask.assignee === filter)
    );
  }, [activeTasks, completedTasks, filter, viewMode]);

  const openTasks = activeTasks.length;
  const finishedTasks = completedTasks.length;
  const totalSubtasks = tasks.reduce((total, task) => total + task.subtasks.length, 0);
  const doneSubtasks = tasks.reduce(
    (total, task) =>
      total + task.subtasks.filter((subtask) => subtask.completed).length,
    0
  );

  async function refreshTasks() {
    const payload = await requestJson<{ tasks: Task[] }>("/api/tasks");
    setTasks(payload.tasks);
  }

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = draft.title.trim();

    if (!title) {
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      await requestJson<{ task: Task }>("/api/tasks", {
        method: "POST",
        body: JSON.stringify({ ...draft, title }),
      });
      setDraft(initialDraft);
      await refreshTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add task.");
    } finally {
      setIsSaving(false);
    }
  }

  async function updateTask(taskId: string, updates: Partial<Task>) {
    setError("");
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId ? { ...task, ...updates } : task
      )
    );

    try {
      await requestJson<{ task: Task }>(`/api/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      await refreshTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update task.");
      await refreshTasks();
    }
  }

  async function deleteTask(taskId: string) {
    setError("");
    setTasks((current) => current.filter((task) => task.id !== taskId));

    try {
      await requestJson<{ ok: true }>(`/api/tasks/${taskId}`, {
        method: "DELETE",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete task.");
      await refreshTasks();
    }
  }

  async function addSubtask(task: Task) {
    const draftForTask = subtaskDrafts[task.id] ?? {
      title: "",
      assignee: task.assignee === "Both" ? "Brandon" : task.assignee,
    };
    const title = draftForTask.title.trim();

    if (!title) {
      return;
    }

    setError("");

    try {
      await requestJson<{ subtask: Subtask }>(`/api/tasks/${task.id}/subtasks`, {
        method: "POST",
        body: JSON.stringify({ ...draftForTask, title }),
      });
      setSubtaskDrafts((current) => ({
        ...current,
        [task.id]: { ...draftForTask, title: "" },
      }));
      await refreshTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add subtask.");
    }
  }

  async function updateSubtask(subtaskId: string, updates: Partial<Subtask>) {
    setError("");
    setTasks((current) =>
      current.map((task) => ({
        ...task,
        subtasks: task.subtasks.map((subtask) =>
          subtask.id === subtaskId ? { ...subtask, ...updates } : subtask
        ),
      }))
    );

    try {
      await requestJson<{ subtask: Subtask }>(`/api/subtasks/${subtaskId}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      await refreshTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update subtask.");
      await refreshTasks();
    }
  }

  async function deleteSubtask(subtaskId: string) {
    setError("");
    setTasks((current) =>
      current.map((task) => ({
        ...task,
        subtasks: task.subtasks.filter((subtask) => subtask.id !== subtaskId),
      }))
    );

    try {
      await requestJson<{ ok: true }>(`/api/subtasks/${subtaskId}`, {
        method: "DELETE",
      });
      await refreshTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete subtask.");
      await refreshTasks();
    }
  }

  return (
    <main className="app-shell">
      <header className="family-header">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">K</span>
          <div>
            <p className="eyebrow">Shared household</p>
            <h1 id="page-title">Kurz family</h1>
          </div>
        </div>
        <p className="today-label">{todayLabel()}</p>
      </header>

      <section className="summary-strip" aria-labelledby="page-title">
        <div className="summary-intro">
          <p className="section-kicker">Family task list</p>
          <h2>What&apos;s on the list?</h2>
        </div>
        <div className="quick-stats" aria-label="Family task summary">
          <div>
            <strong>{openTasks}</strong>
            <span>open tasks</span>
          </div>
          <div>
            <strong>{finishedTasks}</strong>
            <span>finished tasks</span>
          </div>
          <div>
            <strong>{doneSubtasks}</strong>
            <span>of {totalSubtasks || 0} steps done</span>
          </div>
        </div>
      </section>

      <section className="planner-grid" aria-label="Family task planner">
        <form className="new-task-panel" onSubmit={addTask}>
          <div className="panel-heading">
            <span className="panel-icon" aria-hidden="true">+</span>
            <div>
              <p className="section-kicker">New task</p>
              <h2>Add something to the list</h2>
            </div>
          </div>

          <label>
            Task
            <input
              value={draft.title}
              onChange={(event) =>
                setDraft((current) => ({ ...current, title: event.target.value }))
              }
              placeholder="What needs doing?"
            />
          </label>

          <div className="form-row">
            <label>
              Owner
              <select
                value={draft.assignee}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    assignee: event.target.value as Assignee,
                  }))
                }
              >
                {people.map((person) => <option key={person}>{person}</option>)}
              </select>
            </label>

            <label>
              Category
              <select
                value={draft.category}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    category: event.target.value,
                  }))
                }
              >
                {categories.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </label>
          </div>

          <label>
            Due date <span className="optional-label">optional</span>
            <input
              type="date"
              value={draft.dueDate}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  dueDate: event.target.value,
                }))
              }
            />
          </label>

          <button className="primary-action" disabled={isSaving} type="submit">
            <span aria-hidden="true">+</span>
            {isSaving ? "Adding..." : "Add task"}
          </button>
        </form>

        <div className="task-board">
          <div className="board-toolbar">
            <div>
              <p className="section-kicker">Shared board</p>
              <h2>{viewMode === "active" ? "Today and upcoming" : "Finished tasks"}</h2>
            </div>
            <div className="toolbar-controls">
              <div className="view-tabs" aria-label="Choose task view">
                <button
                  aria-pressed={viewMode === "active"}
                  className={viewMode === "active" ? "active" : ""}
                  onClick={() => setViewMode("active")}
                  type="button"
                >
                  Active
                </button>
                <button
                  aria-pressed={viewMode === "history"}
                  className={viewMode === "history" ? "active" : ""}
                  onClick={() => setViewMode("history")}
                  type="button"
                >
                  History
                </button>
              </div>
              <div className="filter-tabs" aria-label="Filter by owner">
                {people.map((person) => (
                  <button
                    aria-pressed={filter === person}
                    className={filter === person ? "active" : ""}
                    key={person}
                    onClick={() => setFilter(person)}
                    type="button"
                  >
                    {person}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error ? <p className="error-message" role="alert">{error}</p> : null}
          {isLoading ? <p className="empty-state">Loading the family list...</p> : null}

          {!isLoading && visibleTasks.length === 0 ? (
            <p className="empty-state">
              {viewMode === "active"
                ? "Nothing open right now. Add a task or check history."
                : "No finished tasks yet. Completed tasks will show up here."}
            </p>
          ) : null}

          <div className="task-list">
            {visibleTasks.map((task) => {
              const isHistory = viewMode === "history";
              const subtaskDraft = subtaskDrafts[task.id] ?? {
                title: "",
                assignee: task.assignee === "Both" ? "Brandon" : task.assignee,
              };
              const percent = completionFor(task);
              const completedSteps = task.subtasks.filter(
                (subtask) => subtask.completed
              ).length;

              return (
                <article
                  className={task.completed ? "task-card task-complete" : "task-card"}
                  key={task.id}
                >
                  <div className="task-main">
                    <button
                      aria-label={
                        isHistory
                          ? `Restore ${task.title}`
                          : `Mark ${task.title} complete`
                      }
                      className={task.completed ? "check-button checked" : "check-button"}
                      onClick={() => updateTask(task.id, { completed: !task.completed })}
                      title={isHistory ? "Restore task" : "Finish task"}
                      type="button"
                    >
                      {task.completed ? "✓" : ""}
                    </button>

                    <div className="task-copy">
                      <div className="task-meta">
                        <span className="category-badge">{task.category}</span>
                        <span className={ownerClass(task.assignee)}>{task.assignee}</span>
                        {task.dueDate ? (
                          <span className="due-badge">Due {dueDateLabel(task.dueDate)}</span>
                        ) : null}
                        {isHistory ? (
                          <span className="history-badge">
                            Finished {activityDateLabel(task.updatedAt)}
                          </span>
                        ) : null}
                      </div>
                      <h3>{task.title}</h3>
                      <div className="progress-row">
                        <div className="progress-track" aria-label={`${percent}% complete`}>
                          <span style={{ width: `${percent}%` }} />
                        </div>
                        <span className="progress-label">
                          {task.subtasks.length
                            ? `${completedSteps}/${task.subtasks.length}`
                            : task.completed
                              ? "Done"
                              : "Open"}
                        </span>
                      </div>
                      {isHistory ? (
                        <button
                          className="restore-action"
                          onClick={() => updateTask(task.id, { completed: false })}
                          type="button"
                        >
                          Restore
                        </button>
                      ) : null}
                    </div>

                    <button
                      aria-label={`Delete ${task.title}`}
                      className="icon-action"
                      onClick={() => deleteTask(task.id)}
                      title="Delete task"
                      type="button"
                    >
                      ×
                    </button>
                  </div>

                  {task.subtasks.length ? (
                    <div className="subtask-list">
                      {task.subtasks.map((subtask) => (
                        <div className="subtask-row" key={subtask.id}>
                          {isHistory ? (
                            <span
                              aria-hidden="true"
                              className={subtask.completed ? "mini-check checked" : "mini-check"}
                            >
                              {subtask.completed ? "✓" : ""}
                            </span>
                          ) : (
                            <button
                              aria-label={
                                subtask.completed
                                  ? `Mark ${subtask.title} incomplete`
                                  : `Mark ${subtask.title} complete`
                              }
                              className={subtask.completed ? "mini-check checked" : "mini-check"}
                              onClick={() =>
                                updateSubtask(subtask.id, {
                                  completed: !subtask.completed,
                                })
                              }
                              type="button"
                            >
                              {subtask.completed ? "✓" : ""}
                            </button>
                          )}
                          <span className={subtask.completed ? "done" : ""}>
                            {subtask.title}
                          </span>
                          <strong className={ownerClass(subtask.assignee)}>
                            {subtask.assignee}
                          </strong>
                          {isHistory ? (
                            <span aria-hidden="true" />
                          ) : (
                            <button
                              aria-label={`Delete ${subtask.title}`}
                              className="subtask-delete"
                              onClick={() => deleteSubtask(subtask.id)}
                              title="Delete subtask"
                              type="button"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {isHistory ? null : (
                    <form
                      className="subtask-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void addSubtask(task);
                      }}
                    >
                      <input
                        aria-label={`New subtask for ${task.title}`}
                        value={subtaskDraft.title}
                        onChange={(event) =>
                          setSubtaskDrafts((current) => ({
                            ...current,
                            [task.id]: { ...subtaskDraft, title: event.target.value },
                          }))
                        }
                        placeholder="Add a smaller step"
                      />
                      <select
                        aria-label="Subtask owner"
                        value={subtaskDraft.assignee}
                        onChange={(event) =>
                          setSubtaskDrafts((current) => ({
                            ...current,
                            [task.id]: {
                              ...subtaskDraft,
                              assignee: event.target.value as Assignee,
                            },
                          }))
                        }
                      >
                        {people.map((person) => <option key={person}>{person}</option>)}
                      </select>
                      <button aria-label="Add subtask" title="Add subtask" type="submit">+</button>
                    </form>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
