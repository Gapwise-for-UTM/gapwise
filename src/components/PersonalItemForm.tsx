import { useEffect, useState, ChangeEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PersonalItem, PersonalCategory } from "@/lib/personal-types";
import { WEEKDAYS, TERMS, formatTime, Weekday, Term } from "@/lib/timetable-types";

function minutesFromString(t: string) {
  const parts = t.split(":");
  const h = Number(parts[0] ?? 0);
  const m = Number(parts[1] ?? 0);
  return h * 60 + (m || 0);
}

export default function PersonalItemForm({
  open,
  onOpenChange,
  initial,
  defaultTerm,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: PersonalItem | null;
  defaultTerm: Term;
  onSave: (item: PersonalItem) => void;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<PersonalCategory>("Personal");
  const [term, setTerm] = useState<Term>(defaultTerm);
  const [weekday, setWeekday] = useState<Weekday>(WEEKDAYS[0] as Weekday);
  const [start, setStart] = useState("12:00");
  const [end, setEnd] = useState("13:00");
  const [notes, setNotes] = useState("");
  const [color, setColor] = useState("#5b21b6");

  useEffect(() => {
    if (initial) {
      setTitle(initial.title);
      setCategory(initial.category);
      setTerm(initial.term);
      setWeekday(initial.weekday);
      setStart(formatTime(initial.startTime ?? 12 * 60).slice(0, -3));
      setEnd(formatTime(initial.endTime ?? 13 * 60).slice(0, -3));
      setNotes(initial.notes ?? "");
      setColor(initial.color ?? "#5b21b6");
    } else {
      setTitle("");
      setCategory("Personal");
      setTerm(defaultTerm);
      setWeekday(WEEKDAYS[0] as Weekday);
      setStart("12:00");
      setEnd("13:00");
      setNotes("");
      setColor("#5b21b6");
    }
  }, [defaultTerm, initial, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-panel max-w-md bg-card/75 personal-item-form">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit personal item" : "Add personal item"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <label className="flex flex-col">
            <span className="text-xs text-muted-foreground">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </label>
          <label className="flex flex-col">
            <span className="text-xs text-muted-foreground">Category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as PersonalCategory)}
              className="mt-1 rounded-md border border-input bg-background px-3 py-2 text-foreground appearance-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {[
                "Study",
                "Food",
                "Exercise",
                "Club",
                "Work",
                "Commute",
                "Appointment",
                "Break",
                "Personal",
                "Other",
              ].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col">
            <span className="text-xs text-muted-foreground">Description</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col">
              <span className="text-xs text-muted-foreground">Day</span>
              <select
                value={weekday}
                onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                  setWeekday(e.target.value as Weekday)
                }
                className="mt-1 rounded-md border border-input bg-background px-3 py-2 text-foreground appearance-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {WEEKDAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col">
              <span className="text-xs text-muted-foreground">Term</span>
              <select
                value={term}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setTerm(e.target.value as Term)}
                className="mt-1 rounded-md border border-input bg-background px-3 py-2 text-foreground appearance-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {TERMS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-2">
            <label className="flex flex-col">
              <span className="text-xs text-muted-foreground">Color</span>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 py-0 text-foreground appearance-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </label>
            <div className="flex flex-col justify-end">
              <span className="text-xs text-muted-foreground">&nbsp;</span>
              <div className="mt-1 h-11 rounded-md border border-input bg-[var(--color-background)]" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col">
              <span className="text-xs text-muted-foreground">Start</span>
              <input
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="mt-1 rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring appearance-none"
              />
            </label>
            <label className="flex flex-col">
              <span className="text-xs text-muted-foreground">End</span>
              <input
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="mt-1 rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring appearance-none"
              />
            </label>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="button-secondary px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                const now = new Date().toISOString();
                const item: PersonalItem = {
                  id: initial?.id ?? `p-${Date.now().toString(36)}`,
                  title: title || "Personal",
                  category,
                  term,
                  weekday,
                  startTime: minutesFromString(start),
                  endTime: minutesFromString(end),
                  locationBuildingCode: null,
                  locationRoom: null,
                  locationText: null,
                  notes: notes || null,
                  color,
                  flexibility: { kind: "fixed" },
                  createdAt: initial?.createdAt ?? now,
                  updatedAt: now,
                };
                onSave(item);
                onOpenChange(false);
              }}
              className="button-primary px-4 py-2 text-sm font-semibold"
            >
              Save
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
