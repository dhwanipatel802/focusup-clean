"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Mode = "focus" | "short" | "long";

type Task = {
  id: string;
  text: string;
  done: boolean;
  estimated: number;
  completedPomodoros: number;
};

type Settings = {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  sessionsUntilLongBreak: number;
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
};

const STORAGE_KEY = "focusup-premium-v2";

const DEFAULTS: Settings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsUntilLongBreak: 4,
  autoStartBreaks: false,
  autoStartFocus: false,
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function secondsFor(mode: Mode, settings: Settings) {
  if (mode === "focus") return settings.focusMinutes * 60;
  if (mode === "short") return settings.shortBreakMinutes * 60;
  return settings.longBreakMinutes * 60;
}

function formatTime(totalSeconds: number) {
  const mins = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
}

function modeLabel(mode: Mode) {
  if (mode === "focus") return "Focus";
  if (mode === "short") return "Short Break";
  return "Long Break";
}

export default function Page() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [mode, setMode] = useState<Mode>("focus");
  const [timeLeft, setTimeLeft] = useState(secondsFor("focus", DEFAULTS));
  const [isRunning, setIsRunning] = useState(false);
  const [completedFocusSessions, setCompletedFocusSessions] = useState(0);
  const [todayFocusMinutes, setTodayFocusMinutes] = useState(0);
  const [taskInput, setTaskInput] = useState("");
  const [estimatedInput, setEstimatedInput] = useState("1");
  const [showCompleted, setShowCompleted] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([
    {
      id: uid(),
      text: "Finish homepage draft",
      done: false,
      estimated: 3,
      completedPomodoros: 1,
    },
    {
      id: uid(),
      text: "Review product notes",
      done: false,
      estimated: 2,
      completedPomodoros: 0,
    },
  ]);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      const savedSettings = parsed.settings ?? DEFAULTS;
      const savedMode = parsed.mode ?? "focus";

      setSettings(savedSettings);
      setMode(savedMode);
      setTimeLeft(parsed.timeLeft ?? secondsFor(savedMode, savedSettings));
      setCompletedFocusSessions(parsed.completedFocusSessions ?? 0);
      setTodayFocusMinutes(parsed.todayFocusMinutes ?? 0);
      setTasks(parsed.tasks ?? []);
      setShowCompleted(parsed.showCompleted ?? true);
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        settings,
        mode,
        timeLeft,
        completedFocusSessions,
        todayFocusMinutes,
        tasks,
        showCompleted,
      })
    );
  }, [
    settings,
    mode,
    timeLeft,
    completedFocusSessions,
    todayFocusMinutes,
    tasks,
    showCompleted,
  ]);

  useEffect(() => {
    if (!isRunning) return;

    const timer = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          handleComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isRunning, mode, settings, completedFocusSessions]);

  useEffect(() => {
    document.title = `${formatTime(timeLeft)} • FocusUp`;
  }, [timeLeft]);

  function playChime() {
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio(
          "data:audio/wav;base64,UklGRlQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YTAAAAAAAP//AAD//wAA//8AAP//AAD//wAA"
        );
      }
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    } catch {}
  }

  function handleComplete() {
    playChime();
    setIsRunning(false);

    if (mode === "focus") {
      const newCompleted = completedFocusSessions + 1;
      setCompletedFocusSessions(newCompleted);
      setTodayFocusMinutes((prev) => prev + settings.focusMinutes);

      setTasks((prev) => {
        const firstUndone = prev.find((t) => !t.done);
        if (!firstUndone) return prev;
        return prev.map((t) =>
          t.id === firstUndone.id
            ? { ...t, completedPomodoros: t.completedPomodoros + 1 }
            : t
        );
      });

      const nextMode =
        newCompleted % settings.sessionsUntilLongBreak === 0
          ? "long"
          : "short";

      setMode(nextMode);
      setTimeLeft(secondsFor(nextMode, settings));

      if (settings.autoStartBreaks) {
        setTimeout(() => setIsRunning(true), 250);
      }
    } else {
      setMode("focus");
      setTimeLeft(secondsFor("focus", settings));

      if (settings.autoStartFocus) {
        setTimeout(() => setIsRunning(true), 250);
      }
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setTimeLeft(secondsFor(next, settings));
    setIsRunning(false);
  }

  function resetTimer() {
    setTimeLeft(secondsFor(mode, settings));
    setIsRunning(false);
  }

  function updateSetting<K extends keyof Settings>(
    key: K,
    value: Settings[K]
  ) {
    const next = { ...settings, [key]: value };
    setSettings(next);
    setTimeLeft(secondsFor(mode, next));
    setIsRunning(false);
  }

  function addTask() {
    if (!taskInput.trim()) return;

    setTasks((prev) => [
      {
        id: uid(),
        text: taskInput.trim(),
        done: false,
        estimated: Math.max(1, Number(estimatedInput) || 1),
        completedPomodoros: 0,
      },
      ...prev,
    ]);

    setTaskInput("");
    setEstimatedInput("1");
  }

  const progress = useMemo(() => {
    const total = secondsFor(mode, settings);
    return ((total - timeLeft) / total) * 100;
  }, [timeLeft, mode, settings]);

  const activeTask = tasks.find((t) => !t.done);
  const doneCount = tasks.filter((t) => t.done).length;
  const pendingTasks = tasks.filter((t) => !t.done);
  const completedTasks = tasks.filter((t) => t.done);

  const sessionsUntilLong =
    settings.sessionsUntilLongBreak -
    (completedFocusSessions % settings.sessionsUntilLongBreak ||
      settings.sessionsUntilLongBreak);

  const focusRingColor =
    mode === "focus"
      ? "from-slate-900 to-slate-700"
      : mode === "short"
      ? "from-sky-700 to-sky-500"
      : "from-violet-700 to-violet-500";

  const modePillClass =
    mode === "focus"
      ? "bg-slate-900 text-white"
      : mode === "short"
      ? "bg-sky-600 text-white"
      : "bg-violet-600 text-white";

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#ffffff, #f8fafc_40%, #eef2ff_100%)] text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-10">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium text-slate-600 backdrop-blur">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              Premium focus workspace
            </div>
            <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
              FocusUp
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
              A calmer, better-looking Pomodoro app with task planning, cleaner
              stats, and a workflow you’d actually want open all day.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Focus today" value={`${todayFocusMinutes}m`} />
            <StatCard
              label="Sessions"
              value={String(completedFocusSessions)}
            />
            <StatCard label="Done" value={String(doneCount)} />
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[32px] border border-white/70 bg-white/80 p-5 shadow-[0_10px_40px_rgba(15,23,42,0.08)] backdrop-blur md:p-7">
            <div className="mb-6 flex flex-wrap gap-2">
              {(["focus", "short", "long"] as Mode[]).map((item) => {
                const active = mode === item;
                return (
                  <button
                    key={item}
                    onClick={() => switchMode(item)}
                    className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                      active
                        ? modePillClass
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {modeLabel(item)}
                  </button>
                );
              })}
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-[28px] bg-slate-950 p-6 text-white md:p-8">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <div className="text-sm text-slate-300">
                      {mode === "focus"
                        ? "Deep work block"
                        : mode === "short"
                        ? "Quick reset"
                        : "Long recharge"}
                    </div>
                    <div className="mt-1 text-xl font-semibold">
                      {modeLabel(mode)}
                    </div>
                  </div>
                  <div
                    className={`rounded-full bg-gradient-to-br ${focusRingColor} px-3 py-1 text-xs font-medium`}
                  >
                    {isRunning ? "Live" : "Paused"}
                  </div>
                </div>

                <div className="mb-6 text-center">
                  <div className="text-[72px] font-semibold tracking-tight md:text-[96px]">
                    {formatTime(timeLeft)}
                  </div>
                  <div className="mt-2 text-sm text-slate-400">
                    {activeTask
                      ? `Current task: ${activeTask.text}`
                      : "No active task selected"}
                  </div>
                </div>

                <div className="mb-6">
                  <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${focusRingColor} transition-all`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap justify-center gap-3">
                  <button
                    onClick={() => setIsRunning((v) => !v)}
                    className="rounded-2xl bg-white px-8 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
                  >
                    {isRunning ? "Pause" : "Start"}
                  </button>
                  <button
                    onClick={resetTimer}
                    className="rounded-2xl border border-slate-700 bg-slate-900 px-6 py-3 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <MiniCard
                  title="Current task"
                  value={activeTask?.text ?? "No active task"}
                  sub={`${activeTask?.completedPomodoros ?? 0}/${
                    activeTask?.estimated ?? 0
                  } pomodoros completed`}
                />
                <MiniCard
                  title="Next long break"
                  value={`In ${sessionsUntilLong} focus session(s)`}
                  sub="Keeps your work blocks sustainable"
                />
                <MiniCard
                  title="Mode settings"
                  value={`${settings.focusMinutes}/${settings.shortBreakMinutes}/${settings.longBreakMinutes}`}
                  sub="Focus / short / long break minutes"
                />
              </div>
            </div>
          </section>

          <div className="space-y-6">
            <section className="rounded-[32px] border border-white/70 bg-white/80 p-5 shadow-[0_10px_40px_rgba(15,23,42,0.08)] backdrop-blur md:p-7">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Task board</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Plan what matters, then work through it cleanly.
                  </p>
                </div>
                <button
                  onClick={() => setShowCompleted((v) => !v)}
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  {showCompleted ? "Hide completed" : "Show completed"}
                </button>
              </div>

              <div className="mb-5 grid gap-3 md:grid-cols-[1fr_140px_100px]">
                <input
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500"
                  placeholder="Add a task"
                  value={taskInput}
                  onChange={(e) => setTaskInput(e.target.value)}
                />
                <input
                  type="number"
                  min={1}
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500"
                  placeholder="Pomodoros"
                  value={estimatedInput}
                  onChange={(e) => setEstimatedInput(e.target.value)}
                />
                <button
                  onClick={addTask}
                  className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Add
                </button>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <div>
                  <div className="mb-3 text-sm font-semibold text-slate-700">
                    Active
                  </div>
                  <div className="max-h-[360px] space-y-3 overflow-auto pr-1">
                    {pendingTasks.length ? (
                      pendingTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          completed={false}
                          onToggle={() =>
                            setTasks((prev) =>
                              prev.map((t) =>
                                t.id === task.id ? { ...t, done: !t.done } : t
                              )
                            )
                          }
                          onDelete={() =>
                            setTasks((prev) =>
                              prev.filter((t) => t.id !== task.id)
                            )
                          }
                        />
                      ))
                    ) : (
                      <EmptyBox label="No active tasks right now." />
                    )}
                  </div>
                </div>

                <div>
                  <div className="mb-3 text-sm font-semibold text-slate-700">
                    Completed
                  </div>
                  {showCompleted ? (
                    <div className="max-h-[360px] space-y-3 overflow-auto pr-1">
                      {completedTasks.length ? (
                        completedTasks.map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            completed
                            onToggle={() =>
                              setTasks((prev) =>
                                prev.map((t) =>
                                  t.id === task.id ? { ...t, done: !t.done } : t
                                )
                              )
                            }
                            onDelete={() =>
                              setTasks((prev) =>
                                prev.filter((t) => t.id !== task.id)
                              )
                            }
                          />
                        ))
                      ) : (
                        <EmptyBox label="No completed tasks yet." />
                      )}
                    </div>
                  ) : (
                    <EmptyBox label="Completed tasks are hidden." />
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-[32px] border border-white/70 bg-white/80 p-5 shadow-[0_10px_40px_rgba(15,23,42,0.08)] backdrop-blur md:p-7">
              <div className="mb-5">
                <h2 className="text-lg font-semibold">Settings</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Shape the timer around how you actually work.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <SettingNumber
                  label="Focus minutes"
                  value={settings.focusMinutes}
                  onChange={(v) => updateSetting("focusMinutes", v)}
                />
                <SettingNumber
                  label="Short break"
                  value={settings.shortBreakMinutes}
                  onChange={(v) => updateSetting("shortBreakMinutes", v)}
                />
                <SettingNumber
                  label="Long break"
                  value={settings.longBreakMinutes}
                  onChange={(v) => updateSetting("longBreakMinutes", v)}
                />
                <SettingNumber
                  label="Sessions until long break"
                  value={settings.sessionsUntilLongBreak}
                  onChange={(v) => updateSetting("sessionsUntilLongBreak", v)}
                />
              </div>

              <div className="mt-5 space-y-4 rounded-[24px] bg-slate-100 p-4">
                <ToggleRow
                  label="Auto-start breaks"
                  description="Jump into breaks automatically after focus sessions."
                  checked={settings.autoStartBreaks}
                  onChange={(v) => updateSetting("autoStartBreaks", v)}
                />
                <ToggleRow
                  label="Auto-start focus"
                  description="Start the next focus block automatically after breaks."
                  checked={settings.autoStartFocus}
                  onChange={(v) => updateSetting("autoStartFocus", v)}
                />
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[98px] rounded-[24px] border border-white/70 bg-white/80 px-4 py-4 text-center shadow-[0_8px_24px_rgba(15,23,42,0.06)] backdrop-blur">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function MiniCard({
  title,
  value,
  sub,
}: {
  title: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {title}
      </div>
      <div className="mt-2 text-base font-semibold text-slate-900">{value}</div>
      <div className="mt-1 text-sm text-slate-500">{sub}</div>
    </div>
  );
}

function SettingNumber({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="grid gap-2">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <input
        type="number"
        min={1}
        value={value}
        onChange={(e) => onChange(Math.max(1, Number(e.target.value) || 1))}
        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500"
      />
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="font-medium text-slate-900">{label}</div>
        <div className="text-sm text-slate-500">{description}</div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 rounded-full transition ${
          checked ? "bg-slate-900" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
            checked ? "left-6" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}

function TaskCard({
  task,
  completed,
  onToggle,
  onDelete,
}: {
  task: Task;
  completed: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const pct = Math.min(
    100,
    Math.round((task.completedPomodoros / Math.max(1, task.estimated)) * 100)
  );

  return (
    <div
      className={`rounded-[24px] border p-4 transition ${
        completed
          ? "border-slate-200 bg-slate-50"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <button onClick={onToggle} className="flex flex-1 items-start gap-3 text-left">
          <span
            className={`mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold ${
              completed
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-slate-300 text-transparent"
            }`}
          >
            ✓
          </span>

          <div className="min-w-0 flex-1">
            <div
              className={`font-medium ${
                completed ? "text-slate-500 line-through" : "text-slate-900"
              }`}
            >
              {task.text}
            </div>

            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${
                  completed ? "bg-emerald-500" : "bg-slate-900"
                }`}
                style={{ width: `${completed ? 100 : pct}%` }}
              />
            </div>

            <div className="mt-2 text-xs text-slate-500">
              {completed
                ? `Completed after ${task.completedPomodoros} pomodoro(s)`
                : `${task.completedPomodoros}/${task.estimated} pomodoros completed`}
            </div>
          </div>
        </button>

        <button
          onClick={onDelete}
          className="rounded-lg px-2 py-1 text-sm text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function EmptyBox({ label }: { label: string }) {
  return (
    <div className="rounded-[24px] border border-dashed border-slate-300 bg-white/60 p-5 text-sm text-slate-500">
      {label}
    </div>
  );
}
