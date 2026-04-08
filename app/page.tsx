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

const STORAGE_KEY = "focusup-v1";

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
        setTimeout(() => setIsRunning(true), 300);
      }
    } else {
      setMode("focus");
      setTimeLeft(secondsFor("focus", settings));

      if (settings.autoStartFocus) {
        setTimeout(() => setIsRunning(true), 300);
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
    (completedFocusSessions % settings.sessionsUntilLongBreak || settings.sessionsUntilLongBreak);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl p-4 md:p-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
              Better than a basic Pomodoro
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">FocusUp</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              A cleaner focus timer with task planning, stats, and settings that
              actually make it useful day to day.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 text-sm">
            <StatCard label="Focus today" value={`${todayFocusMinutes} min`} />
            <StatCard
              label="Sessions done"
              value={String(completedFocusSessions)}
            />
            <StatCard label="Tasks done" value={String(doneCount)} />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="mb-6 flex rounded-2xl bg-slate-100 p-1">
              {[
                { key: "focus", label: "Focus" },
                { key: "short", label: "Short break" },
                { key: "long", label: "Long break" },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => switchMode(item.key as Mode)}
                  className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium transition ${
                    mode === item.key
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="mx-auto max-w-md text-center">
              <p className="mb-3 text-sm text-slate-500">
                {mode === "focus"
                  ? "Lock in on one thing"
                  : mode === "short"
                  ? "Take a quick reset"
                  : "Recharge properly"}
              </p>

              <div className="mb-6 text-7xl font-semibold tracking-tight md:text-8xl">
                {formatTime(timeLeft)}
              </div>

              <div className="mb-6 h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-slate-900 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="flex flex-wrap justify-center gap-3">
                <button
                  onClick={() => setIsRunning((v) => !v)}
                  className="rounded-2xl bg-slate-900 px-8 py-3 text-sm font-medium text-white hover:bg-slate-800"
                >
                  {isRunning ? "Pause" : "Start"}
                </button>
                <button
                  onClick={resetTimer}
                  className="rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Reset
                </button>
              </div>

              <div className="mt-8 grid grid-cols-2 gap-3 text-left">
                <MiniPanel
                  title="Current task"
                  value={activeTask?.text ?? "No active task"}
                  sub={`${activeTask?.completedPomodoros ?? 0}/${
                    activeTask?.estimated ?? 0
                  } sessions`}
                />
                <MiniPanel
                  title="Next long break"
                  value={`In ${sessionsUntilLong} focus session(s)`}
                  sub="Keeps your work blocks sustainable"
                />
              </div>
            </div>
          </section>

          <div className="space-y-6">
            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold">Task queue</h2>
                <button
                  onClick={() => setShowCompleted((v) => !v)}
                  className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  {showCompleted ? "Hide completed" : "Show completed"}
                </button>
              </div>

              <div className="mb-4 grid gap-3 md:grid-cols-[1fr_120px_96px]">
                <input
                  className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
                  placeholder="Add a task"
                  value={taskInput}
                  onChange={(e) => setTaskInput(e.target.value)}
                />
                <input
                  type="number"
                  min={1}
                  className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
                  placeholder="Pomodoros"
                  value={estimatedInput}
                  onChange={(e) => setEstimatedInput(e.target.value)}
                />
                <button
                  onClick={addTask}
                  className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Add
                </button>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <div className="mb-3 text-sm font-medium text-slate-700">
                    Active tasks
                  </div>
                  <div className="max-h-[340px] space-y-3 overflow-auto pr-1">
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
                  <div className="mb-3 text-sm font-medium text-slate-700">
                    Completed queue
                  </div>
                  {showCompleted ? (
                    <div className="max-h-[340px] space-y-3 overflow-auto pr-1">
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
                    <EmptyBox label="Completed queue is hidden." />
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-base font-semibold">Settings</h2>

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

              <div className="mt-5 space-y-4 rounded-2xl bg-slate-100 p-4">
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
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function MiniPanel({
  title,
  value,
  sub,
}: {
  title: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-100 p-4">
      <div className="text-xs text-slate-500">{title}</div>
      <div className="mt-1 font-medium text-slate-900">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{sub}</div>
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
        className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
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
  return (
    <div
      className={`rounded-2xl border p-4 ${
        completed ? "border-slate-200 bg-slate-50" : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <button onClick={onToggle} className="flex flex-1 items-start gap-3 text-left">
          <span
            className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs ${
              completed
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-slate-300 text-transparent"
            }`}
          >
            ✓
          </span>
          <div>
            <div
              className={`font-medium ${
                completed ? "text-slate-500 line-through" : "text-slate-900"
              }`}
            >
              {task.text}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {completed
                ? `Completed after ${task.completedPomodoros} pomodoro(s)`
                : `${task.completedPomodoros}/${task.estimated} pomodoros completed`}
            </div>
          </div>
        </button>

        <button
          onClick={onDelete}
          className="rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function EmptyBox({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
      {label}
    </div>
  );
}
