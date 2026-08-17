import { Link, Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarRange,
  CalendarClock,
  Download,
  FileCheck2,
  LayoutGrid,
  MapPinned,
  ShieldCheck,
  Trash2,
  Upload,
  Waypoints,
  X,
} from "lucide-react";
import { BubbleTabs } from "@/components/BubbleTabs";
import { GapPlan } from "@/components/GapPlan";
import PersonalItemForm from "@/components/PersonalItemForm";
import { loadPersonalItems, savePersonalItems } from "@/features/personal/persistence";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TimetableGrid } from "@/components/TimetableGrid";
import { TodaySummary } from "@/components/TodaySummary";
import { UploadPanel } from "@/components/UploadPanel";
import { UtmMonumentViewer } from "@/components/UtmMonumentViewer";
import { MobileMoreSheet } from "@/components/mobile/MobileMoreSheet";
import { MobileShell, type MobileTab } from "@/components/mobile/MobileShell";
import { MobileTimetable } from "@/components/mobile/MobileTimetable";
import { MobileToday } from "@/components/mobile/MobileToday";
import { useTodayState } from "@/features/today/use-today-state";
import { useIsMobile } from "@/hooks/use-mobile";

import { AccountStatus } from "@/features/auth/AccountStatus";
import { useAuth } from "@/features/auth/use-auth";
import { CloudSyncControls } from "@/features/sync/CloudSyncControls";
import { ResidenceSettings } from "@/features/sync/ResidenceSettings";
import { createScheduleTransitionPlanner } from "@/features/routing/transition";
import {
  DEFAULT_GAP_PREFERENCES,
  loadGapPreferences,
  sanitizeGapPreferences,
  saveGapPreferences,
} from "@/features/gaps/preferences";
import type { GapPreferences } from "@/features/gaps/types";
import {
  DEFAULT_USER_PREFERENCES,
  loadLocalUserPreferences,
  saveLocalUserPreferences,
  type UserPreferences,
} from "@/features/sync/preferences";
import { loadRememberedRecord, useIntroDismissed, useTheme } from "@/hooks/use-preferences";
import { DEMO_MEETINGS } from "@/lib/demo-timetable";
import { chooseDefaultTerm } from "@/lib/calendar-awareness";
import { findGaps } from "@/lib/gaps";
import { IcsParseError, MAX_ICS_FILE_BYTES, parseIcs } from "@/lib/ics-parser";
import { emitClickSpark } from "@/lib/micro-interactions";
import { TERMS, type Meeting, type Term } from "@/lib/timetable-types";
import { chooseRestoration, type RestorationState } from "@/features/sync/restoration";
import { cloudRestoration, isRestorationAbort } from "@/features/sync/cloud-restoration";
import { UTM_ROUTING_GRAPH } from "@/data/utm/campus";
import type { PrivateDataPayloadV1 } from "@/features/security/private-data";
import { isEncryptedPrivateCloudAuthoritative } from "@/features/security/private-cloud-mode";
import {
  clearPrivateCloudLocalUser,
  isEncryptedSyncOptedIn,
  saveEncryptedPrivateState,
} from "@/features/sync/encrypted-sync-service";
import {
  clearGuestTimetable,
  loadGuestTimetable,
  saveGuestTimetable,
  type GuestTimetableRestoration,
} from "@/features/security/guest-timetable";
import {
  isCloudRestoreSuppressed,
  setCloudRestoreSuppressed,
} from "@/features/sync/restore-preference";

const DayRoute = lazy(() =>
  import("@/components/DayRoute").then((module) => ({ default: module.DayRoute })),
);
const EMPTY_MEETINGS: Meeting[] = [];

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

type AppDestination = "home" | MobileTab;

const DESTINATION_PATHS = {
  home: "/",
  today: "/today",
  timetable: "/timetable",
  gaps: "/gaps",
  route: "/route",
} as const satisfies Record<AppDestination, string>;

function destinationFromPath(pathname: string): AppDestination {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (normalized === "/today") return "today";
  if (normalized === "/timetable") return "timetable";
  if (normalized === "/gaps") return "gaps";
  if (normalized === "/route") return "route";
  return "home";
}

const STEPS = [
  {
    title: "Export from ACORN",
    body: "Download your timetable as a .ics calendar file.",
    icon: Download,
  },
  {
    title: "Upload the .ics file",
    body: "It is parsed locally in your browser.",
    icon: FileCheck2,
  },
  {
    title: "Review your weekly gap plan",
    body: "See every gap, how long it is, and where you are.",
    icon: Waypoints,
  },
];

function ProductEmptyState({
  destination,
  loading,
  onImport,
  onDemo,
}: {
  destination: Exclude<AppDestination, "home" | "route">;
  loading: boolean;
  onImport: () => void;
  onDemo: () => void;
}) {
  const title =
    destination === "gaps"
      ? "Add a timetable to plan your gaps"
      : destination === "today"
        ? "Add a timetable to see today"
        : "Add your timetable";
  const description =
    destination === "gaps"
      ? "Gapwise needs your class times to identify useful windows between meetings."
      : destination === "today"
        ? "Import your ACORN calendar to see the next class, current gap, and leave-by guidance."
        : "Import your ACORN calendar to build a private weekly view on this device.";

  return (
    <section className="empty-state surface rise-in mx-auto flex max-w-2xl flex-col items-center p-8 text-center sm:p-12">
      <span className="empty-state-icon flex h-12 w-12 items-center justify-center rounded-2xl border border-accent/20 bg-accent/8">
        <CalendarRange className="h-6 w-6 text-accent" aria-hidden="true" />
      </span>
      <p className="eyebrow mt-5 text-accent">Private browser import</p>
      <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">{description}</p>
      <div className="mt-6 flex w-full max-w-sm flex-col gap-2 sm:flex-row sm:justify-center">
        <button
          type="button"
          disabled={loading}
          onClick={onImport}
          className="button-primary inline-flex min-h-11 items-center justify-center gap-2 px-4 text-sm font-semibold disabled:opacity-60"
        >
          <Upload className="h-4 w-4" aria-hidden="true" />
          {loading ? "Importing…" : "Import ACORN calendar"}
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={onDemo}
          className="button-secondary min-h-11 px-4 text-sm font-semibold disabled:opacity-60"
        >
          Try a demo
        </button>
      </div>
      <Link to="/" className="mt-5 text-sm font-semibold text-accent hover:underline">
        Back to Gapwise home
      </Link>
    </section>
  );
}

function AppLayout() {
  const navigate = useNavigate();
  const routerLocation = useRouterState({ select: (state) => state.location });
  const destination = destinationFromPath(routerLocation.pathname);
  const selectedBuildingCode =
    destination === "route" && typeof routerLocation.search["building"] === "string"
      ? routerLocation.search["building"]
      : null;
  const { theme, toggleTheme } = useTheme();
  const { dismissed, dismiss } = useIntroDismissed();
  const { user, loading: authLoading, error: authError } = useAuth();

  const [meetings, setMeetings] = useState<Meeting[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(false);
  const [term, setTerm] = useState<Term>("Fall");
  const [openedViews, setOpenedViews] = useState({ gaps: false, route: false });
  const [isDemo, setIsDemo] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences>(loadLocalUserPreferences);
  const [gapPreferences, setGapPreferences] = useState<GapPreferences>(loadGapPreferences);
  const [editingPersonal, setEditingPersonal] = useState<
    import("@/lib/personal-types").PersonalItem | null
  >(null);
  const [guestRestoration, setGuestRestoration] = useState<GuestTimetableRestoration | null>(null);
  const [restoration, setRestoration] = useState<RestorationState>("waiting-for-auth");
  const [restorationMessage, setRestorationMessage] = useState<string | null>(null);
  const [personalItems, setPersonalItems] = useState<import("@/lib/personal-types").PersonalItem[]>(
    () => loadPersonalItems(),
  );
  const [showAddPersonal, setShowAddPersonal] = useState(false);
  const updateUserPreferences = useCallback((next: UserPreferences) => {
    setPreferences(saveLocalUserPreferences(next));
  }, []);
  const [isOnline, setIsOnline] = useState(
    typeof window !== "undefined" && "onLine" in navigator ? navigator.onLine : true,
  );
  const [isScrolled, setIsScrolled] = useState(false);
  const isMobile = useIsMobile();
  const [moreOpen, setMoreOpen] = useState(false);
  const restoredSource = useRef<"memory" | "local" | "cloud" | "none">("none");
  const latestMeetings = useRef<Meeting[] | null>(meetings);
  const mounted = useRef(false);
  const requestVersion = useRef(0);
  const requestedUser = useRef<string | null>(null);
  const previousUser = useRef<string | null>(null);
  const replacementInputRef = useRef<HTMLInputElement>(null);
  const lastEncryptedFingerprint = useRef<string | null>(null);
  const allowInitialHomeRedirect = useRef(destination === "home");
  const authenticatedUserId = user?.id ?? null;
  const planTransition = useMemo(
    () => createScheduleTransitionPlanner(UTM_ROUTING_GRAPH, meetings ?? []),
    [meetings],
  );

  latestMeetings.current = meetings;

  const applyPrivateData = useCallback((payload: PrivateDataPayloadV1) => {
    latestMeetings.current = payload.schedule;
    setMeetings(payload.schedule);
    setPersonalItems(payload.personalItems);
    setPreferences(payload.preferences);
    setGapPreferences(payload.gapPreferences);
    setWarnings([]);
    setError(null);
    setIsDemo(false);
    lastEncryptedFingerprint.current = JSON.stringify(payload);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setIsScrolled(window.scrollY > 10);
      return;
    }
    let frame = 0;
    let previousScrolled = false;
    const updateScrollState = () => {
      frame = 0;
      const scrollY = Math.min(window.scrollY, 4_000);
      document.documentElement.style.setProperty("--parallax-far", `${scrollY * -0.012}px`);
      document.documentElement.style.setProperty("--parallax-field", `${scrollY * -0.035}px`);
      document.documentElement.style.setProperty("--parallax-glow", `${scrollY * 0.008}px`);
      const nextScrolled = scrollY > 10;
      if (nextScrolled !== previousScrolled) {
        previousScrolled = nextScrolled;
        setIsScrolled(nextScrolled);
      }
    };
    const requestUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updateScrollState);
    };
    updateScrollState();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    return () => {
      window.removeEventListener("scroll", requestUpdate);
      if (frame) window.cancelAnimationFrame(frame);
      document.documentElement.style.removeProperty("--parallax-far");
      document.documentElement.style.removeProperty("--parallax-field");
      document.documentElement.style.removeProperty("--parallax-glow");
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const setOnline = () => {
      lastEncryptedFingerprint.current = null;
      setIsOnline(true);
    };
    const setOffline = () => setIsOnline(false);
    window.addEventListener("online", setOnline);
    window.addEventListener("offline", setOffline);
    return () => {
      window.removeEventListener("online", setOnline);
      window.removeEventListener("offline", setOffline);
    };
  }, []);

  useEffect(() => {
    // Remove retired plaintext storage before checking the encrypted guest record.
    loadRememberedRecord<unknown>();
    let active = true;
    void loadGuestTimetable()
      .then((record) => {
        if (!active) return;
        setGuestRestoration(record);
        setRemember(record.remember);
      })
      .catch(() => {
        if (!active) return;
        setGuestRestoration({ remember: false, meetings: null, updatedAt: null });
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (authLoading || guestRestoration === null) {
      setRestoration("waiting-for-auth");
      return;
    }
    const userId = authenticatedUserId;
    if (!userId) {
      const returningFromAccount = previousUser.current !== null;
      cloudRestoration.cancel(previousUser.current);
      requestVersion.current += 1;
      requestedUser.current = null;
      let currentMeetings = latestMeetings.current;
      if (
        previousUser.current &&
        (restoredSource.current === "cloud" || isEncryptedPrivateCloudAuthoritative)
      ) {
        currentMeetings = null;
        latestMeetings.current = null;
        setMeetings(null);
        if (isEncryptedPrivateCloudAuthoritative) {
          setPersonalItems([]);
          setPreferences(DEFAULT_USER_PREFERENCES);
          setGapPreferences(DEFAULT_GAP_PREFERENCES);
          lastEncryptedFingerprint.current = null;
        }
      }
      previousUser.current = null;
      const guestRecord = guestRestoration.meetings
        ? {
            data: guestRestoration.meetings,
            updatedAt: guestRestoration.updatedAt,
          }
        : null;
      const choice = chooseRestoration(
        restoredSource.current === "memory" ? currentMeetings : null,
        guestRecord,
        null,
      );
      if (choice.meetings && choice.source !== "memory") {
        latestMeetings.current = choice.meetings;
        setMeetings(choice.meetings);
      }
      restoredSource.current = choice.source;
      setRestoration(authError ? "failed" : choice.state);
      if (authError) {
        setRestorationMessage(
          "We couldn't restore your signed-in session. Cloud restore is unavailable.",
        );
      } else if (returningFromAccount) {
        setRestorationMessage(null);
      }
      return;
    }

    if (previousUser.current !== userId) {
      cloudRestoration.cancel(previousUser.current);
      requestVersion.current += 1;
      requestedUser.current = null;
      if (
        previousUser.current &&
        (restoredSource.current === "cloud" || isEncryptedPrivateCloudAuthoritative)
      ) {
        latestMeetings.current = null;
        setMeetings(null);
        if (isEncryptedPrivateCloudAuthoritative) {
          setPersonalItems([]);
          setPreferences(DEFAULT_USER_PREFERENCES);
          setGapPreferences(DEFAULT_GAP_PREFERENCES);
          lastEncryptedFingerprint.current = null;
        }
      }
      previousUser.current = userId;
    }

    if (isCloudRestoreSuppressed(userId)) {
      requestedUser.current = userId;
      setRestoration("no-cloud-data");
      setRestorationMessage(
        "Automatic cloud restore is paused on this browser. Use Load private data when you want it back.",
      );
      return;
    }

    if (latestMeetings.current?.length && restoredSource.current === "memory") {
      setRestoration("restored-memory");
      return;
    }
    if (requestedUser.current === userId) return;
    requestedUser.current = userId;
    const version = ++requestVersion.current;
    setRestoration("checking-cloud");
    setRestorationMessage(null);
    void cloudRestoration
      .restore(userId)
      .then((cloud) => {
        if (
          !mounted.current ||
          requestVersion.current !== version ||
          previousUser.current !== userId
        )
          return;
        const memory = restoredSource.current === "memory" ? latestMeetings.current : null;
        const choice = chooseRestoration(memory, null, cloud);
        if (choice.meetings && choice.source !== "memory") {
          latestMeetings.current = choice.meetings;
          setMeetings(choice.meetings);
        }
        if (choice.source === "cloud" && cloud?.privateData) {
          applyPrivateData(cloud.privateData);
        }
        restoredSource.current = choice.source;
        setRestoration(choice.state);
        if (choice.state === "cloud-version-available") {
          setRestorationMessage("A cloud version is available; your local timetable was kept.");
        } else if (choice.source === "cloud" && cloud?.persistentKeys === false) {
          setRestorationMessage(
            "Encrypted data restored. This browser cannot persist non-extractable keys, so another broker check will be needed after reload.",
          );
        }
      })
      .catch((restoreError: unknown) => {
        if (isRestorationAbort(restoreError)) return;
        if (
          !mounted.current ||
          requestVersion.current !== version ||
          previousUser.current !== userId
        )
          return;
        const memory = restoredSource.current === "memory" ? latestMeetings.current : null;
        const choice = chooseRestoration(memory, null, null);
        if (choice.meetings && choice.source !== "memory") {
          latestMeetings.current = choice.meetings;
          setMeetings(choice.meetings);
        }
        restoredSource.current = choice.source;
        setRestoration("failed");
        setRestorationMessage(
          "We couldn't restore your cloud timetable. Your local timetable is unchanged.",
        );
      });
  }, [applyPrivateData, authLoading, authError, authenticatedUserId, guestRestoration]);

  const terms = useMemo(() => {
    if (!meetings) return [] as Term[];
    return TERMS.filter((t) => meetings.some((m) => m.term === t));
  }, [meetings]);

  useEffect(() => {
    if (terms.length > 0 && !terms.includes(term)) setTerm(terms[0]!);
  }, [terms, term]);

  useEffect(() => {
    if (meetings?.length) setTerm(chooseDefaultTerm(meetings, new Date()));
  }, [meetings]);

  useEffect(() => {
    if (!allowInitialHomeRedirect.current) return;
    if (destination !== "home") {
      allowInitialHomeRedirect.current = false;
      return;
    }
    if (!meetings?.length) return;
    allowInitialHomeRedirect.current = false;
    void navigate({ to: "/timetable", replace: true });
  }, [destination, meetings, navigate]);

  useEffect(() => {
    if (
      !isEncryptedPrivateCloudAuthoritative ||
      !authenticatedUserId ||
      meetings === null ||
      isDemo ||
      !isEncryptedSyncOptedIn(authenticatedUserId)
    ) {
      return;
    }
    const input = { schedule: meetings, personalItems, preferences, gapPreferences };
    const fingerprint = JSON.stringify({ schemaVersion: 1, ...input });
    if (fingerprint === lastEncryptedFingerprint.current) return;
    const timeout = window.setTimeout(() => {
      lastEncryptedFingerprint.current = fingerprint;
      void saveEncryptedPrivateState(authenticatedUserId, input, {
        requireExistingOptIn: true,
        localOnly: !isOnline,
      }).catch(() => {
        if (lastEncryptedFingerprint.current === fingerprint) {
          lastEncryptedFingerprint.current = null;
        }
        setRestorationMessage(
          "Encrypted local data was kept, but cloud sync could not finish. Try again when connected.",
        );
      });
    }, 750);
    return () => window.clearTimeout(timeout);
  }, [authenticatedUserId, gapPreferences, isDemo, isOnline, meetings, personalItems, preferences]);

  const termMeetings = useMemo(() => {
    const academic = (meetings ?? []).filter((m) => m.term === term);
    const personalAsMeetings = personalItems
      .filter((p) => p.term === term && p.flexibility.kind === "fixed")
      .map((p) => ({
        id: p.id,
        courseCode: p.title,
        activityType: "OTHER" as const,
        sectionCode: "PERSONAL",
        courseName: p.category,
        startTime: p.startTime ?? 0,
        endTime: p.endTime ?? 0,
        weekday: p.weekday,
        buildingCode: p.locationBuildingCode ?? null,
        room: p.locationRoom ?? null,
        term: p.term,
        locationUnknown: !(p.locationBuildingCode || p.locationRoom),
        notes: p.notes ?? undefined,
        color: p.color ?? undefined,
      })) as Meeting[];
    return [...academic, ...personalAsMeetings];
  }, [meetings, personalItems, term]);

  const gaps = useMemo(
    () =>
      findGaps(
        (meetings ?? []).concat(
          personalItems
            .filter((p) => p.term === term && p.flexibility.kind === "fixed")
            .map((p) => ({
              id: p.id,
              courseCode: p.title,
              activityType: "OTHER" as const,
              sectionCode: "PERSONAL",
              courseName: p.category,
              startTime: p.startTime ?? 0,
              endTime: p.endTime ?? 0,
              weekday: p.weekday,
              buildingCode: p.locationBuildingCode ?? null,
              room: p.locationRoom ?? null,
              term: p.term,
              locationUnknown: !(p.locationBuildingCode || p.locationRoom),
            })) as Meeting[],
        ),
        term,
      ),
    [meetings, personalItems, term],
  );

  const persistPersonal = (next: typeof personalItems) => {
    setPersonalItems(next);
    try {
      savePersonalItems(next);
    } catch {
      // ignore
    }
  };

  const addOrUpdatePersonal = (item: import("@/lib/personal-types").PersonalItem) => {
    const existing = personalItems.find((p) => p.id === item.id);
    if (existing) {
      persistPersonal(personalItems.map((p) => (p.id === item.id ? item : p)));
    } else {
      persistPersonal([...personalItems, item]);
    }
  };

  const deletePersonal = (id: string) => {
    persistPersonal(personalItems.filter((p) => p.id !== id));
  };

  async function handleFile(file: File) {
    const previousMeetings = latestMeetings.current;
    setError(null);
    if (!/\.ics$/i.test(file.name) && file.type !== "text/calendar") {
      const message = "That file type isn't supported. Please choose a .ics calendar file.";
      if (previousMeetings?.length) setRestorationMessage(`Update failed · ${message}`);
      else setError(message);
      return;
    }
    if (file.size > MAX_ICS_FILE_BYTES) {
      const message = "That calendar is too large. Please choose an .ics file under 2 MB.";
      if (previousMeetings?.length) setRestorationMessage(`Update failed · ${message}`);
      else setError(message);
      return;
    }
    setRestorationMessage(null);
    setLoading(true);
    try {
      const text = await file.text();
      const result = parseIcs(text);
      let persistenceWarning: string | null = null;
      if (remember && !authenticatedUserId) {
        try {
          await saveGuestTimetable(result.meetings);
          setGuestRestoration({
            remember: true,
            meetings: result.meetings,
            updatedAt: new Date().toISOString(),
          });
        } catch {
          setRemember(false);
          persistenceWarning =
            "This browser could not keep an encrypted device copy. Your open timetable is unchanged.";
        }
      }
      setMeetings(result.meetings);
      latestMeetings.current = result.meetings;
      restoredSource.current = "memory";
      setRestoration("restored-memory");
      if (previousMeetings?.length) {
        const previousById = new Map(previousMeetings.map((meeting) => [meeting.id, meeting]));
        const nextIds = new Set(result.meetings.map((meeting) => meeting.id));
        const added = result.meetings.filter((meeting) => !previousById.has(meeting.id)).length;
        const removed = previousMeetings.filter((meeting) => !nextIds.has(meeting.id)).length;
        const changed = result.meetings.filter((meeting) => {
          const previous = previousById.get(meeting.id);
          return previous && JSON.stringify(previous) !== JSON.stringify(meeting);
        }).length;
        const changes = [
          added ? `${added} added` : null,
          removed ? `${removed} removed` : null,
          changed ? `${changed} updated` : null,
        ].filter(Boolean);
        setRestorationMessage(
          persistenceWarning ??
            `Timetable updated · ${changes.length ? changes.join(" · ") : "no meeting changes"}`,
        );
      } else {
        setRestorationMessage(persistenceWarning);
      }
      setWarnings(result.warnings);
      setIsDemo(false);
    } catch (err) {
      const message =
        err instanceof IcsParseError
          ? err.message
          : "Something went wrong while reading that calendar. Try exporting it from ACORN again.";
      if (previousMeetings?.length) {
        setRestorationMessage(`Update failed · ${message}`);
      } else {
        setMeetings(null);
        latestMeetings.current = null;
        restoredSource.current = "none";
        setWarnings([]);
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  function loadDemo() {
    setError(null);
    setWarnings([]);
    setMeetings(DEMO_MEETINGS);
    latestMeetings.current = DEMO_MEETINGS;
    restoredSource.current = "memory";
    setRestoration("restored-memory");
    setRestorationMessage(null);
    setIsDemo(true);
  }

  function clearTimetableView() {
    setMeetings(null);
    latestMeetings.current = null;
    restoredSource.current = "none";
    setRestoration("no-cloud-data");
    setRestorationMessage(null);
    setWarnings([]);
    setError(null);
    setIsDemo(false);
  }

  async function removeTimetableFromBrowser() {
    try {
      if (authenticatedUserId) {
        await clearPrivateCloudLocalUser(authenticatedUserId);
        setCloudRestoreSuppressed(authenticatedUserId, true);
      } else {
        await clearGuestTimetable();
        setGuestRestoration({ remember: false, meetings: null, updatedAt: null });
        setRemember(false);
      }
      clearTimetableView();
    } catch {
      setRestorationMessage(
        "This browser could not clear its encrypted local copy, so the timetable was left in place.",
      );
    }
  }

  function confirmRemoveTimetable() {
    const cloudNote = authenticatedUserId
      ? " Your encrypted cloud copy will remain available from Load private data."
      : "";
    if (
      window.confirm(
        `Remove this timetable and its encrypted local copy from this browser?${cloudNote}`,
      )
    ) {
      void removeTimetableFromBrowser();
    }
  }

  function loadCloudTimetable(cloudMeetings: Meeting[]) {
    setMeetings(cloudMeetings);
    latestMeetings.current = cloudMeetings;
    setWarnings([]);
    setError(null);
    setIsDemo(false);
    if (authenticatedUserId) setCloudRestoreSuppressed(authenticatedUserId, false);
    restoredSource.current = "cloud";
    setRestoration("restored-cloud");
  }

  function loadPrivateData(payload: PrivateDataPayloadV1) {
    if (authenticatedUserId) setCloudRestoreSuppressed(authenticatedUserId, false);
    applyPrivateData(payload);
    restoredSource.current = "cloud";
    setRestoration("restored-cloud");
    setRestorationMessage(null);
  }

  function handleRemember(value: boolean) {
    setRemember(value);
    if (authenticatedUserId) return;
    setRestorationMessage(
      value ? "Setting up encrypted device restore…" : "Removing the encrypted device copy…",
    );
    void (value ? saveGuestTimetable(isDemo ? null : meetings) : clearGuestTimetable())
      .then(() => {
        setGuestRestoration({
          remember: value,
          meetings: value && !isDemo ? meetings : null,
          updatedAt: value && meetings && !isDemo ? new Date().toISOString() : null,
        });
        setRestorationMessage(
          value
            ? "Encrypted device restore is on for this browser."
            : "Encrypted device restore is off and its local copy was removed.",
        );
      })
      .catch(() => {
        setRemember(!value);
        setRestorationMessage("Secure device storage is unavailable in this browser.");
      });
  }

  function updateGapPreferences(next: GapPreferences) {
    const sanitized = sanitizeGapPreferences(next);
    setGapPreferences(sanitized);
    saveGapPreferences(sanitized);
  }

  const showView = useCallback(
    (nextView: "timetable" | "gaps" | "route") => {
      if (nextView !== "timetable") {
        setOpenedViews((current) =>
          current[nextView] ? current : { ...current, [nextView]: true },
        );
      }
      void navigate({ to: DESTINATION_PATHS[nextView] });
    },
    [navigate],
  );

  useEffect(() => {
    if (destination !== "gaps" && destination !== "route") return;
    setOpenedViews((current) =>
      current[destination] ? current : { ...current, [destination]: true },
    );
  }, [destination]);

  const selectBuilding = useCallback(
    (code: string | null) => {
      if (code === null && selectedBuildingCode === null) return;
      void navigate({
        to: "/route",
        search: code ? { building: code } : {},
        replace: destination === "route",
        resetScroll: false,
      });
    },
    [destination, navigate, selectedBuildingCode],
  );

  const openGapPlan = useCallback(() => showView("gaps"), [showView]);
  const openDayRoute = useCallback(() => showView("route"), [showView]);

  const handleAccountDeleted = useCallback((_clearLocal: boolean) => {
    setMeetings(null);
    latestMeetings.current = null;
    restoredSource.current = "none";
    setRestoration("no-cloud-data");
    setRestorationMessage(null);
    if (isEncryptedPrivateCloudAuthoritative) {
      setPersonalItems([]);
      setPreferences(DEFAULT_USER_PREFERENCES);
      setGapPreferences(DEFAULT_GAP_PREFERENCES);
      lastEncryptedFingerprint.current = null;
    }
  }, []);

  const { now: todayNow, state: todayState } = useTodayState({
    meetings: termMeetings,
    selectedTerm: term,
    preferences,
    gapPreferences,
    planTransition,
  });

  const mobileTab: MobileTab = destination === "home" ? "today" : destination;
  const view: "timetable" | "gaps" | "route" =
    destination === "gaps" || destination === "route" ? destination : "timetable";

  if (isMobile && destination !== "home") {
    return (
      <>
        <Outlet />
        <MobileShell tab={mobileTab} onOpenMore={() => setMoreOpen(true)} moreOpen={moreOpen}>
          <input
            ref={replacementInputRef}
            type="file"
            accept=".ics,text/calendar"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
              event.target.value = "";
            }}
          />
          {restorationMessage ? (
            <p className="surface mb-4 p-4 text-sm text-muted-foreground">{restorationMessage}</p>
          ) : null}
          {!meetings && mobileTab !== "route" ? (
            <ProductEmptyState
              destination={mobileTab}
              loading={loading}
              onImport={() => replacementInputRef.current?.click()}
              onDemo={loadDemo}
            />
          ) : null}
          {meetings && mobileTab === "today" ? (
            <MobileToday
              state={todayState}
              now={todayNow}
              selectedTerm={term}
              meetingCount={meetings.length}
              gapCount={gaps.length}
              isDemo={isDemo}
              onOpenGapPlan={() => {
                openGapPlan();
              }}
              onOpenDayRoute={() => {
                openDayRoute();
              }}
            />
          ) : null}
          {meetings && mobileTab === "timetable" ? (
            <MobileTimetable
              meetings={termMeetings}
              term={term}
              terms={terms}
              gaps={gaps}
              onTermChange={setTerm}
              onOpenGapPlan={() => {
                openGapPlan();
              }}
              onRouteToMeeting={() => {
                openDayRoute();
              }}
              onAddPersonal={() => {
                setEditingPersonal(null);
                setShowAddPersonal(true);
              }}
              onEditPersonal={(id) => {
                const item = personalItems.find((personal) => personal.id === id) ?? null;
                setEditingPersonal(item);
                setShowAddPersonal(true);
              }}
              onDeletePersonal={deletePersonal}
            />
          ) : null}
          {meetings && mobileTab === "gaps" ? (
            <div className="dot-field">
              <GapPlan
                gaps={gaps}
                preferences={preferences}
                gapPreferences={gapPreferences}
                onGapPreferencesChange={updateGapPreferences}
                planTransition={planTransition}
                user={user}
                term={term}
              />
            </div>
          ) : null}
          {mobileTab === "route" ? (
            <Suspense
              fallback={
                <div
                  className="surface h-96 animate-pulse p-6 text-sm text-muted-foreground"
                  role="status"
                >
                  Loading the route map…
                </div>
              }
            >
              <DayRoute
                meetings={meetings ?? EMPTY_MEETINGS}
                term={term}
                onTermChange={setTerm}
                preferences={preferences}
                onPreferencesChange={updateUserPreferences}
                user={user}
                planTransition={planTransition}
                selectedBuildingCode={selectedBuildingCode}
                onSelectBuilding={selectBuilding}
              />
            </Suspense>
          ) : null}
        </MobileShell>
        <MobileMoreSheet
          open={moreOpen}
          onOpenChange={setMoreOpen}
          loading={loading}
          canRemove={Boolean(meetings)}
          onUpdateTimetable={() => replacementInputRef.current?.click()}
          onRemoveTimetable={() => {
            setMoreOpen(false);
            confirmRemoveTimetable();
          }}
          syncControls={
            meetings ? (
              <CloudSyncControls
                user={user}
                meetings={meetings}
                personalItems={personalItems}
                preferences={preferences}
                gapPreferences={gapPreferences}
                onLoad={loadCloudTimetable}
                onLoadPrivate={loadPrivateData}
                restorationState={restoration}
              />
            ) : null
          }
        >
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <ResidenceSettings
            user={user}
            preferences={preferences}
            onPreferencesChange={updateUserPreferences}
          />
          <AccountStatus
            user={user}
            loading={authLoading}
            onAccountDeleted={handleAccountDeleted}
          />
        </MobileMoreSheet>
        <PersonalItemForm
          open={showAddPersonal}
          onOpenChange={(open) => {
            setShowAddPersonal(open);
            if (!open) setEditingPersonal(null);
          }}
          initial={editingPersonal}
          defaultTerm={term}
          onSave={addOrUpdatePersonal}
        />
      </>
    );
  }

  return (
    <div className="app-shell min-h-screen bg-background text-foreground">
      <Outlet />
      <header
        className="app-nav sticky top-0 z-30 border-b"
        data-scrolled={isScrolled ? "true" : "false"}
      >
        <div className="mx-auto flex min-h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            to="/"
            aria-label="Gapwise for UTM home"
            className="brand-lockup group flex min-w-0 items-center gap-3"
          >
            <span className="brand-mark-shell">
              <img src="/logo-mark.svg" alt="" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="flex items-center gap-2 truncate font-display text-base font-semibold tracking-[-0.035em]">
                Gapwise <span className="brand-utm-pill">UTM</span>
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <ResidenceSettings
              user={user}
              preferences={preferences}
              onPreferencesChange={updateUserPreferences}
            />
            <AccountStatus
              user={user}
              loading={authLoading}
              onAccountDeleted={handleAccountDeleted}
            />
          </div>
        </div>
      </header>

      <main
        className={`mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 ${destination === "home" ? "landing-stage" : ""}`}
      >
        {destination === "home" ? <div className="topography-field" aria-hidden="true" /> : null}
        {(authLoading || guestRestoration === null || restoration === "checking-cloud") &&
        !meetings &&
        destination !== "route" ? (
          <div className="py-16" role="status" aria-live="polite">
            <div className="h-4 w-36 animate-pulse rounded bg-muted" />
            <div className="mt-4 h-24 max-w-xl animate-pulse rounded-xl bg-muted" />
            <span className="sr-only">Checking for your timetable…</span>
          </div>
        ) : destination === "home" ? (
          <>
            <div className="landing-bento rise-in">
              <section className="bento-cell bento-hero flex flex-col p-7 text-hero-foreground sm:p-11 lg:col-span-7 lg:p-14">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="hero-kicker">
                    <ShieldCheck className="h-3.5 w-3.5 text-hero-accent" aria-hidden="true" />
                    <span className="eyebrow">Private by design</span>
                  </p>
                  <span className="eyebrow text-hero-foreground/52">Built for UTM</span>
                </div>

                <h1 className="hero-title mt-12 font-display sm:mt-14">
                  Make every <span className="hero-word">gap</span> on campus count.
                </h1>

                <p className="relative mt-7 max-w-[35rem] text-[0.96rem] leading-7 text-hero-foreground/70 sm:text-[1.05rem] sm:leading-8">
                  Turn your ACORN export into a precise weekly timetable, useful gap plan, and
                  route-aware guide for moving across UTM.
                </p>

                <div className="hero-proof relative mt-auto pt-12 text-xs text-hero-foreground/62">
                  <p className="flex items-center gap-2.5">
                    <span className="hero-proof-dot" aria-hidden="true" />
                    Original .ics files never leave your device
                  </p>
                  <p className="flex items-center gap-2.5">
                    <span className="hero-proof-dot" aria-hidden="true" />
                    Campus-aware routes, room to room
                  </p>
                </div>
              </section>

              <section className="bento-cell upload-card flex flex-col justify-center p-6 sm:p-9 lg:col-span-5 lg:row-span-2 lg:p-11">
                <div className="mx-auto w-full max-w-md">
                  {!isOnline ? (
                    <div className="glass-panel mb-6 rounded-xl p-5 text-left text-foreground">
                      <p className="font-semibold">You’re offline</p>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        Gapwise can still parse ACORN .ics files locally and display any timetable
                        you have already loaded. Some map tiles may not be available until your
                        device reconnects.
                      </p>
                    </div>
                  ) : null}
                  <UploadPanel
                    variant="hero"
                    onFile={handleFile}
                    onDemo={loadDemo}
                    loading={loading}
                    error={error}
                    remember={remember}
                    onRememberChange={handleRemember}
                    rememberAvailable={!authenticatedUserId}
                  />
                  <p className="mt-8 border-t border-border pt-5 text-center font-mono text-[0.625rem] uppercase leading-relaxed tracking-[0.13em] text-muted-foreground">
                    Independent student project · Not affiliated with U of T
                  </p>
                </div>
              </section>

              <section className="bento-cell landmark-card min-h-[18rem] p-5 sm:p-7 lg:col-span-7">
                <div className="grid h-full gap-5 sm:grid-cols-[minmax(12rem,0.7fr)_minmax(0,1.3fr)] sm:items-center">
                  <div className="relative z-10">
                    <p className="eyebrow text-accent">A familiar landmark</p>
                    <h2 className="mt-3 max-w-[13ch] text-xl font-medium tracking-tight">
                      Designed for the campus you actually cross.
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      Route context is grounded in UTM buildings, entrances, and indoor transitions.
                    </p>
                    <p className="mt-5 flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-[0.11em] text-muted-foreground">
                      <Waypoints className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                      Mississauga · Ontario
                    </p>
                  </div>
                  <div>
                    <UtmMonumentViewer compact className="model-stage bg-none" />
                    <p className="mt-2 text-center text-[0.68rem] text-muted-foreground">
                      Drag to rotate · scroll or pinch to zoom
                    </p>
                  </div>
                </div>
              </section>

              {STEPS.map((step, i) => {
                const StepIcon = step.icon;
                return (
                  <article
                    key={step.title}
                    data-step={`0${i + 1}`}
                    className={`bento-cell bento-step p-5 sm:p-6 ${
                      i === 0 ? "lg:col-span-5" : i === 1 ? "lg:col-span-4" : "lg:col-span-3"
                    }`}
                  >
                    <span className="step-icon-shell">
                      <StepIcon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <h2 className="mt-7 max-w-[18rem] font-display text-base font-medium tracking-tight">
                      {step.title}
                    </h2>
                    <p className="mt-1.5 max-w-[20rem] text-sm leading-6 text-muted-foreground">
                      {step.body}
                    </p>
                  </article>
                );
              })}
            </div>

            <div className="mt-6">
              <CloudSyncControls
                user={user}
                meetings={meetings}
                personalItems={personalItems}
                preferences={preferences}
                gapPreferences={gapPreferences}
                onLoad={loadCloudTimetable}
                onLoadPrivate={loadPrivateData}
                restorationState={restoration}
              />
            </div>
          </>
        ) : !meetings && destination !== "route" ? (
          <>
            <input
              ref={replacementInputRef}
              id="product-ics-file"
              type="file"
              accept=".ics,text/calendar"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
                event.target.value = "";
              }}
            />
            <ProductEmptyState
              destination={destination}
              loading={loading}
              onImport={() => replacementInputRef.current?.click()}
              onDemo={loadDemo}
            />
          </>
        ) : !meetings ? (
          <>
            <section className="rise-in mb-5">
              <p className="eyebrow text-accent">UTM campus explorer</p>
              <h1 className="mt-2 font-display text-3xl font-medium tracking-[-0.045em] sm:text-4xl">
                Find your way around campus
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Search or select a mapped UTM building. You can explore campus without uploading a
                timetable.
              </p>
            </section>
            <Suspense
              fallback={
                <div className="surface h-96 animate-pulse p-6 text-sm text-muted-foreground">
                  Loading the campus explorer…
                </div>
              }
            >
              <DayRoute
                meetings={EMPTY_MEETINGS}
                term={term}
                onTermChange={setTerm}
                preferences={preferences}
                onPreferencesChange={updateUserPreferences}
                user={user}
                planTransition={planTransition}
                selectedBuildingCode={selectedBuildingCode}
                onSelectBuilding={selectBuilding}
              />
            </Suspense>
          </>
        ) : (
          <>
            {!dismissed ? (
              <div className="surface mb-6 flex items-start justify-between gap-4 bg-secondary/50 p-4">
                <p className="text-sm text-muted-foreground">
                  Switch between <strong className="text-foreground">Weekly timetable</strong>,{" "}
                  <strong className="text-foreground">Gap plan</strong>, and{" "}
                  <strong className="text-foreground">Day route</strong>. Verified route data is
                  used where available; estimates are labelled.
                </p>
                <button
                  type="button"
                  onClick={dismiss}
                  aria-label="Dismiss instructions"
                  className="rounded-md p-1 text-muted-foreground hover:bg-secondary"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ) : null}

            <div className="rise-in flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-6">
              <div className="min-w-0">
                <p className="eyebrow text-muted-foreground">
                  {isDemo ? "Sample data" : "Campus day plan"}
                </p>
                <h1 className="mt-1.5 font-display text-3xl font-medium tracking-[-0.045em] sm:text-4xl">
                  {destination === "today"
                    ? "Today"
                    : destination === "gaps"
                      ? "Gap plan"
                      : destination === "route"
                        ? "Campus route"
                        : isDemo
                          ? "Demo timetable"
                          : "Your timetable"}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {termMeetings.length} meetings in {term} · {gaps.length} gaps detected
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto">
                <input
                  ref={replacementInputRef}
                  type="file"
                  accept=".ics,text/calendar"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleFile(file);
                    event.target.value = "";
                  }}
                />
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => replacementInputRef.current?.click()}
                  className="button-primary inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold disabled:opacity-60"
                >
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  {loading ? "Updating…" : "Update timetable"}
                </button>
                <button
                  type="button"
                  onClick={confirmRemoveTimetable}
                  aria-label="Remove timetable"
                  title="Remove timetable"
                  className="button-secondary inline-flex h-10 w-10 items-center justify-center text-muted-foreground hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            {warnings.length > 0 ? (
              <div className="surface mt-6 border-accent/40 p-4">
                <h2 className="text-sm font-semibold">A few things to double-check</h2>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <TodaySummary
              meetings={meetings}
              selectedTerm={term}
              preferences={preferences}
              gapPreferences={gapPreferences}
              planTransition={planTransition}
              onOpenGapPlan={openGapPlan}
              onOpenDayRoute={openDayRoute}
            />

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {terms.length > 1 ? (
                <BubbleTabs
                  label="Term"
                  items={terms.map((item) => ({ value: item, label: item }))}
                  value={term}
                  onChange={setTerm}
                  compact
                  className="w-full sm:w-44"
                />
              ) : null}

              <BubbleTabs
                label="View mode"
                items={[
                  {
                    value: "today" as const,
                    label: "Today",
                    icon: <CalendarClock className="h-4 w-4 shrink-0" aria-hidden="true" />,
                  },
                  {
                    value: "timetable" as const,
                    ariaLabel: "Weekly timetable",
                    label: "Timetable",
                    icon: <LayoutGrid className="h-4 w-4 shrink-0" aria-hidden="true" />,
                  },
                  {
                    value: "gaps" as const,
                    label: "Gap plan",
                    icon: <CalendarRange className="h-4 w-4 shrink-0" aria-hidden="true" />,
                  },
                  {
                    value: "route" as const,
                    label: "Day route",
                    icon: <MapPinned className="h-4 w-4 shrink-0" aria-hidden="true" />,
                  },
                ]}
                value={destination}
                onChange={(next) => {
                  if (next === "today") void navigate({ to: "/today" });
                  else showView(next);
                }}
                className="w-full sm:w-[36rem]"
              />
            </div>

            <div className="mt-6">
              {destination === "today" ? null : termMeetings.length === 0 &&
                destination !== "route" ? (
                <div className="empty-state surface flex flex-col items-center p-10 text-center sm:p-14">
                  <span className="empty-state-icon flex h-12 w-12 items-center justify-center rounded-2xl border border-accent/20 bg-accent/8">
                    <CalendarRange className="h-6 w-6 text-accent" aria-hidden="true" />
                  </span>
                  <h2 className="mt-5 font-display text-lg font-semibold tracking-tight">
                    Nothing scheduled in {term}
                  </h2>
                  <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                    This export doesn&apos;t contain any {term} term meetings. Try another term tab
                    or upload a different ACORN export.
                  </p>
                </div>
              ) : (
                <>
                  <div hidden={destination !== "timetable"}>
                    <TimetableGrid
                      meetings={termMeetings}
                      gaps={gaps}
                      headerAction={
                        <button
                          type="button"
                          onClick={(event) => {
                            emitClickSpark(event);
                            setShowAddPersonal(true);
                          }}
                          className="button-primary click-spark inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold"
                        >
                          Add personal
                        </button>
                      }
                      onRouteToMeeting={() => showView("route")}
                      onEditPersonal={(id) => {
                        const it = personalItems.find((p) => p.id === id) ?? null;
                        setEditingPersonal(it);
                        setShowAddPersonal(true);
                      }}
                      onDeletePersonal={(id) => deletePersonal(id)}
                      onCreatePersonal={({ weekday, startTime, endTime }) => {
                        const id = `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
                        const item: import("@/lib/personal-types").PersonalItem = {
                          id,
                          title: "New",
                          category: "Personal",
                          term: term,
                          weekday: weekday as import("@/lib/timetable-types").Weekday,
                          startTime,
                          endTime,
                          locationBuildingCode: null,
                          locationRoom: null,
                          locationText: null,
                          notes: null,
                          color: "#5b21b6",
                          flexibility: { kind: "fixed" },
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString(),
                        };
                        addOrUpdatePersonal(item);
                        setEditingPersonal(item);
                        setShowAddPersonal(true);
                      }}
                      onMovePersonal={(id, weekday, startTime, endTime) => {
                        const it = personalItems.find((p) => p.id === id);
                        if (!it) return;
                        const updated = {
                          ...it,
                          weekday: weekday as import("@/lib/timetable-types").Weekday,
                          startTime,
                          endTime,
                          updatedAt: new Date().toISOString(),
                        };
                        addOrUpdatePersonal(updated);
                      }}
                      onResizePersonal={(id, startTime, endTime) => {
                        const it = personalItems.find((p) => p.id === id);
                        if (!it) return;
                        const updated = {
                          ...it,
                          startTime,
                          endTime,
                          updatedAt: new Date().toISOString(),
                        };
                        addOrUpdatePersonal(updated);
                      }}
                    />
                    <PersonalItemForm
                      open={showAddPersonal}
                      onOpenChange={(open) => {
                        setShowAddPersonal(open);
                        if (!open) setEditingPersonal(null);
                      }}
                      initial={editingPersonal}
                      defaultTerm={term}
                      onSave={(item) => addOrUpdatePersonal(item)}
                    />
                  </div>
                  {openedViews.gaps ? (
                    <div className="dot-field" hidden={view !== "gaps"}>
                      <GapPlan
                        gaps={gaps}
                        preferences={preferences}
                        gapPreferences={gapPreferences}
                        onGapPreferencesChange={updateGapPreferences}
                        planTransition={planTransition}
                        user={user}
                        term={term}
                      />
                    </div>
                  ) : null}
                  {openedViews.route ? (
                    <div hidden={view !== "route"}>
                      <Suspense
                        fallback={
                          <div
                            className="surface h-96 animate-pulse p-6 text-sm text-muted-foreground"
                            role="status"
                          >
                            Loading the route map…
                          </div>
                        }
                      >
                        <DayRoute
                          meetings={meetings}
                          term={term}
                          onTermChange={setTerm}
                          preferences={preferences}
                          onPreferencesChange={updateUserPreferences}
                          user={user}
                          planTransition={planTransition}
                          selectedBuildingCode={selectedBuildingCode}
                          onSelectBuilding={selectBuilding}
                        />
                      </Suspense>
                    </div>
                  ) : null}
                </>
              )}
            </div>

            <div className="mt-6">
              <CloudSyncControls
                user={user}
                meetings={meetings}
                personalItems={personalItems}
                preferences={preferences}
                gapPreferences={gapPreferences}
                onLoad={loadCloudTimetable}
                onLoadPrivate={loadPrivateData}
                restorationState={restoration}
              />
            </div>
          </>
        )}
        {restorationMessage ? (
          <div
            className="status-toast glass-panel fixed bottom-4 left-1/2 z-40 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 rounded-xl px-4 py-3 text-sm"
            role="status"
          >
            <span>{restorationMessage}</span>
            <button
              type="button"
              className="font-semibold"
              onClick={() => setRestorationMessage(null)}
              aria-label="Dismiss message"
            >
              ×
            </button>
          </div>
        ) : null}
      </main>

      <footer className="mt-4 border-t border-border bg-card/30">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 text-sm text-muted-foreground sm:grid-cols-[minmax(0,1fr)_auto] sm:px-6">
          <div className="min-w-0 space-y-2">
            <p className="inline-flex items-center gap-2 font-medium text-foreground">
              <Upload className="h-4 w-4 text-accent" aria-hidden="true" />
              Your calendar is parsed in your browser. Cloud sync is optional.
            </p>
            <p className="max-w-xl leading-relaxed">
              Gapwise for UTM is an independent student project and is not affiliated with the
              University of Toronto. It is free, open-source software on{" "}
              <a
                href="https://github.com/andrewmuratov/gapwise"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-foreground underline decoration-border underline-offset-4 hover:text-accent"
              >
                GitHub
              </a>{" "}
              under the{" "}
              <a
                href="https://github.com/andrewmuratov/gapwise/blob/main/LICENSE"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-foreground underline decoration-border underline-offset-4 hover:text-accent"
              >
                MIT License
              </a>
              .
            </p>
          </div>
          <p className="eyebrow self-end text-muted-foreground">Built for UTM students</p>
        </div>
      </footer>
    </div>
  );
}
