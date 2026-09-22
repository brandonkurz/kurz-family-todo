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
  subtasks: Subtask[];
};

type TaskDraft = {
  title: string;
  category: string;
  assignee: Assignee;
  dueDate: string;
};

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

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [draft, setDraft] = useState<TaskDraft>(initialDraft);
  const [filter, setFilter] = useState<Assignee>("Both");
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

  const visibleTasks = useMemo(() => {
    if (filter === "Both") {
      return tasks;
    }

    return tasks.filter(
      (task) =>
        task.assignee === filter ||
        task.assignee === "Both" ||
        task.subtasks.some((subtask) => subtask.assignee === filter)
    );
  }, [filter, tasks]);

  const openTasks = tasks.filter((task) => !task.completed).length;
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
      <section className="hero-panel" aria-labelledby="page-title">
        <div>
          <p className="date-label">{todayLabel()}</p>
          <h1 id="page-title">Kurz Family To Do List</h1>
          <p className="hero-copy">
            A calm shared board for the two of you to capture the week, split
            bigger jobs into subtasks, and keep Brandon and Sarah clear on who
            owns what.
          </p>
        </div>

        <div className="quick-stats" aria-label="Family task summary">
          <div>
            <strong>{openTasks}</strong>
            <span>open tasks</span>
          </div>
          <div>
            <strong>{doneSubtasks}/{totalSubtasks || 0}</strong>
            <span>subtasks done</span>
          </div>
        </div>
      </section>

      <section className="planner-grid" aria-label="Family task planner">
        <form className="new-task-panel" onSubmit={addTask}>
          <div>
            <p className="section-kicker">Add a task</p>
            <h2>What needs doing?</h2>
          </div>

          <label>
            Task
            <input
              value={draft.title}
              onChange={(event) =>
                setDraft((current) => ({ ...current, title: event.target.value }))
              }
              placeholder="Plan weekend groceries"
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
                {people.map((person) => (
                  <option key={person}>{person}</option>
                ))}
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
            Due date
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
            {isSaving ? "Adding..." : "Add task"}
          </button>
        </form>

        <div className="task-board">
          <div className="board-toolbar">
            <div>
              <p className="section-kicker">Shared board</p>
              <h2>Today and upcoming</h2>
            </div>
            <div className="filter-tabs" aria-label="Filter by owner">
              {people.map((person) => (
                <button
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

          {error ? <p className="error-message">{error}</p> : null}
          {isLoading ? <p className="empty-state">Loading the family list...</p> : null}

          {!isLoading && visibleTasks.length === 0 ? (
            <p className="empty-state">Nothing here yet. Add the first task.</p>
          ) : null}

          <div className="task-list">
            {visibleTasks.map((task) => {
              const subtaskDraft = subtaskDrafts[task.id] ?? {
                title: "",
                assignee: task.assignee === "Both" ? "Brandon" : task.assignee,
              };
              const percent = completionFor(task);

              return (
                <article className="task-card" key={task.id}>
                  <div className="task-main">
                    <button
                      aria-label={
                        task.completed
                          ? `Mark ${task.title} incomplete`
                          : `Mark ${task.title} complete`
                      }
                      className={task.completed ? "check-button checked" : "check-button"}
                      onClick={() =>
                        updateTask(task.id, { completed: !task.completed })
                      }
                      type="button"
                    >
                      {task.completed ? "✓" : ""}
                    </button>

                    <div className="task-copy">
                      <div className="task-meta">
                        <span>{task.category}</span>
                        <span>{task.assignee}</span>
                        {task.dueDate ? <span>Due {task.dueDate}</span> : null}
                      </div>
                      <h3>{task.title}</h3>
                      <div
                        className="progress-track"
                        aria-label={`${percent}% complete`}
                      >
                        <span style={{ width: `${percent}%` }} />
                      </div>
                    </div>

                    <button
                      aria-label={`Delete ${task.title}`}
                      className="text-action"
                      onClick={() => deleteTask(task.id)}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>

                  <div className="subtask-list">
                    {task.subtasks.map((subtask) => (
                      <div className="subtask-row" key={subtask.id}>
                        <button
                          aria-label={
                            subtask.completed
                              ? `Mark ${subtask.title} incomplete`
                              : `Mark ${subtask.title} complete`
                          }
                          className={
                            subtask.completed ? "mini-check checked" : "mini-check"
                          }
                          onClick={() =>
                            updateSubtask(subtask.id, {
                              completed: !subtask.completed,
                            })
                          }
                          type="button"
                        >
                          {subtask.completed ? "✓" : ""}
                        </button>
                        <span className={subtask.completed ? "done" : ""}>
                          {subtask.title}
                        </span>
                        <strong>{subtask.assignee}</strong>
                        <button
                          aria-label={`Delete ${subtask.title}`}
                          className="subtask-delete"
                          onClick={() => deleteSubtask(subtask.id)}
                          type="button"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="subtask-form">
                    <input
                      aria-label={`New subtask for ${task.title}`}
                      value={subtaskDraft.title}
                      onChange={(event) =>
                        setSubtaskDrafts((current) => ({
                          ...current,
                          [task.id]: {
                            ...subtaskDraft,
                            title: event.target.value,
                          },
                        }))
                      }
                      placeholder="Add a subtask"
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
                      {people.map((person) => (
                        <option key={person}>{person}</option>
                      ))}
                    </select>
                    <button onClick={() => addSubtask(task)} type="button">
                      Add
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
