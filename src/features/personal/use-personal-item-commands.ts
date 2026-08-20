import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import {
  createFixedPersonalItem,
  deletePersonalItem,
  movePersonalItem,
  resizePersonalItem,
  upsertPersonalItem,
} from "@/features/personal/operations";
import { savePersonalItems } from "@/features/personal/persistence";
import type { PersonalItem } from "@/lib/personal-types";
import type { Term, Weekday } from "@/lib/timetable-types";

export function usePersonalItemCommands(
  items: PersonalItem[],
  setItems: Dispatch<SetStateAction<PersonalItem[]>>,
) {
  const [editingItem, setEditingItem] = useState<PersonalItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const persist = useCallback(
    (next: PersonalItem[]) => {
      setItems(next);
      savePersonalItems(next);
    },
    [setItems],
  );
  const save = useCallback(
    (item: PersonalItem) => persist(upsertPersonalItem(items, item)),
    [items, persist],
  );
  const remove = useCallback(
    (id: string) => persist(deletePersonalItem(items, id)),
    [items, persist],
  );
  const openCreate = useCallback(() => {
    setEditingItem(null);
    setFormOpen(true);
  }, []);
  const openEdit = useCallback(
    (id: string) => {
      setEditingItem(items.find((item) => item.id === id) ?? null);
      setFormOpen(true);
    },
    [items],
  );
  const setOpen = useCallback((open: boolean) => {
    setFormOpen(open);
    if (!open) setEditingItem(null);
  }, []);
  const createAt = useCallback(
    (input: { term: Term; weekday: Weekday; startTime: number; endTime: number }) => {
      const timestamp = new Date().toISOString();
      const item = createFixedPersonalItem({
        ...input,
        id: `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp,
      });
      persist(upsertPersonalItem(items, item));
      setEditingItem(item);
      setFormOpen(true);
    },
    [items, persist],
  );
  const move = useCallback(
    (id: string, weekday: Weekday, startTime: number, endTime: number) => {
      const item = items.find((candidate) => candidate.id === id);
      if (!item) return;
      persist(
        upsertPersonalItem(
          items,
          movePersonalItem(item, weekday, startTime, endTime, new Date().toISOString()),
        ),
      );
    },
    [items, persist],
  );
  const resize = useCallback(
    (id: string, startTime: number, endTime: number) => {
      const item = items.find((candidate) => candidate.id === id);
      if (!item) return;
      persist(
        upsertPersonalItem(
          items,
          resizePersonalItem(item, startTime, endTime, new Date().toISOString()),
        ),
      );
    },
    [items, persist],
  );

  return {
    editingItem,
    formOpen,
    setOpen,
    save,
    remove,
    openCreate,
    openEdit,
    createAt,
    move,
    resize,
  };
}
