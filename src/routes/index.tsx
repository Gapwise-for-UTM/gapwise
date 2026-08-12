import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarRange,
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
import {
  loadRememberedRecord,
  saveRemembered,
  useIntroDismissed,
  useTheme,
} from "@/hooks/use-preferences";
import { DEMO_MEETINGS } from "@/lib/demo-timetable";
import { chooseDefaultTerm } from "@/lib/calendar-awareness";
import { findGaps } from "@/lib/gaps";
import { IcsParseError, MAX_ICS_FILE_BYTES, parseIcs } from "@/lib/ics-parser";
import { emitClickSpark } from "@/lib/micro-interactions";
import { TERMS, type Meeting, type Term } from "@/lib/timetable-types";
import { chooseRestoration, type RestorationState } from "@/features/sync/restoration";
import { deserializeSchedule } from "@/features/sync/schedule-serialization";
import { cloudRestoration, isRestorationAbort } from "@/features/sync/cloud-restoration";
import { UTM_ROUTING_GRAPH } from "@/data/utm/campus";
import type { PrivateDataPayloadV1 } from "@/features/security/private-data";
import { isEncryptedPrivateCloudAuthoritative } from "@/features/security/private-cloud-mode";
import {
  isEncryptedSyncOptedIn,
  saveEncryptedPrivateState,
} from "@/features/sync/encrypted-sync-service";

const DayRoute = lazy(() =>
  import("@/components/DayRoute").then((module) => ({ default: module.DayRoute })),
);

const TITLE = "Gapwise for UTM — Smarter Campus Gaps";
const DESCRIPTION =
  "An independent student project for finding useful UTM timetable gaps and campus routes, with private browser parsing and optional cloud sync.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: Index,
});

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

function Index() {
  const { theme, toggleTheme } = useTheme();
  const { dismissed, dismiss } = useIntroDismissed();
  const { user, loading: authLoading, error: authError } = useAuth();

  const [meetings, setMeetings] = useState<Meeting[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(false);
  const [term, setTerm] = useState<Term>("Fall");
  const [view, setView] = useState<"timetable" | "gaps" | "route">("timetable");
  const [openedViews, setOpenedViews] = useState({ gaps: false, route: false });
  const [isDemo, setIsDemo] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences>(loadLocalUserPreferences);
  const [gapPreferences, setGapPreferences] = useState<GapPreferences>(loadGapPreferences);
  const [editingPersonal, setEditingPersonal] = useState<
    import("@/lib/personal-types").PersonalItem | null
  >(null);
  const [localRecord] = useState(() => {
    if (typeof window === "undefined") return null;
    const stored = loadRememberedRecord<unknown>();
    if (!stored.record) return { remember: stored.remember, record: null };
    try {
      return {
        remember: stored.remember,
        record: {
          data: deserializeSchedule(stored.record.data),
          updatedAt: stored.record.updatedAt,
        },
      };
    } catch {
      return { remember: stored.remember, record: null };
    }
  });
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
  const [mobileTab, setMobileTab] = useState<MobileTab>("today");
  const [moreOpen, setMoreOpen] = useState(false);
  const restoredSource = useRef<"memory" | "local" | "cloud" | "none">("none");
  const latestMeetings = useRef<Meeting[] | null>(meetings);
  const mounted = useRef(false);
  const requestVersion = useRef(0);
  const requestedUser = useRef<string | null>(null);
  const previousUser = useRef<string | null>(null);
  const replacementInputRef = useRef<HTMLInputElement>(null);
  const lastEncryptedFingerprint = useRef<string | null>(null);
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
    const updateScrollState = () => setIsScrolled(window.scrollY > 10);
    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollState);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const setOnline = () => setIsOnline(true);
    const setOffline = () => setIsOnline(false);
    window.addEventListener("online", setOnline);
    window.addEventListener("offline", setOffline);
    return () => {
      window.removeEventListener("online", setOnline);
      window.removeEventListener("offline", setOffline);
    };
  }, []);

  useEffect(() => {
    setRemember(localRecord?.remember ?? false);
  }, [localRecord]);

  useEffect(() => {
    if (authLoading) {
      setRestoration("waiting-for-auth");
      return;
    }
    const userId = authenticatedUserId;
    if (!userId) {
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
      const choice = chooseRestoration(
        restoredSource.current === "memory" ? currentMeetings : null,
        localRecord?.record ?? null,
        null,
      );
      if (choice.meetings && choice.source !== "memory") {
        latestMeetings.current = choice.meetings;
        setMeetings(choice.meetings);
      }
      restoredSource.current = choice.source;
      setRestoration(authError ? "failed" : choice.state);
      setRestorationMessage(
        authError
          ? "We couldn't restore your signed-in session. Cloud restore is unavailable."
          : null,
      );
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
        const legacyLocal =
          isEncryptedPrivateCloudAuthoritative && cloud?.privateData
            ? null
            : (localRecord?.record ?? null);
        const choice = chooseRestoration(memory, legacyLocal, cloud);
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
        const choice = chooseRestoration(memory, localRecord?.record ?? null, null);
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
  }, [applyPrivateData, authLoading, authError, authenticatedUserId, localRecord]);

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
    if (
      !isEncryptedPrivateCloudAuthoritative ||
      !authenticatedUserId ||
      meetings === null ||
      isDemo ||
      !isOnline ||
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

  // Combine academic meetings with personal items for planning/visualization
  const termMeetings = useMemo(() => {
    const academic = (meetings ?? []).filter((m) => m.term === term);
    // convert fixed personal items in the selected term into meeting-like objects for display
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

  // helper to persist personal items
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
          `Timetable updated · ${changes.length ? changes.join(" · ") : "no meeting changes"}`,
        );
      } else {
        setRestorationMessage(null);
      }
      setWarnings(result.warnings);
      setIsDemo(false);
      saveRemembered(remember, remember ? result.meetings : null);
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

  function clearTimetable() {
    setMeetings(null);
    latestMeetings.current = null;
    restoredSource.current = "none";
    setRestoration("no-cloud-data");
    setRestorationMessage(null);
    setWarnings([]);
    setError(null);
    setIsDemo(false);
    saveRemembered(remember, null);
  }

  function loadCloudTimetable(cloudMeetings: Meeting[]) {
    setMeetings(cloudMeetings);
    latestMeetings.current = cloudMeetings;
    setWarnings([]);
    setError(null);
    setIsDemo(false);
    saveRemembered(remember, remember ? cloudMeetings : null);
    restoredSource.current = "cloud";
    setRestoration("restored-cloud");
  }

  function loadPrivateData(payload: PrivateDataPayloadV1) {
    applyPrivateData(payload);
    restoredSource.current = "cloud";
    setRestoration("restored-cloud");
    setRestorationMessage(null);
  }

  function handleRemember(value: boolean) {
    setRemember(value);
    saveRemembered(value, value && !isDemo ? meetings : null);
  }

  function updateGapPreferences(next: GapPreferences) {
    const sanitized = sanitizeGapPreferences(next);
    setGapPreferences(sanitized);
    saveGapPreferences(sanitized);
  }

  const showView = useCallback((nextView: "timetable" | "gaps" | "route") => {
    if (nextView !== "timetable") {
      setOpenedViews((current) => (current[nextView] ? current : { ...current, [nextView]: true }));
    }
    setView(nextView);
  }, []);

  const openGapPlan = useCallback(() => showView("gaps"), [showView]);
  const openDayRoute = useCallback(() => showView("route"), [showView]);

  const { now: todayNow, state: todayState } = useTodayState({
    meetings: termMeetings,
    selectedTerm: term,
    preferences,
    gapPreferences,
    planTransition,
  });

  if (isMobile && meetings) {
    return (
      <>
        <MobileShell
          tab={mobileTab}
          onTabChange={(nextTab) => {
            setMobileTab(nextTab);
            if (nextTab === "timetable") showView("timetable");
            if (nextTab === "route") showView("route");
            if (nextTab === "gaps") showView("gaps");
          }}
          onOpenMore={() => setMoreOpen(true)}
          moreOpen={moreOpen}
        >
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
          {mobileTab === "today" ? (
            <MobileToday
              state={todayState}
              now={todayNow}
              selectedTerm={term}
              meetingCount={termMeetings.length}
              gapCount={gaps.length}
              isDemo={isDemo}
              onOpenGapPlan={() => {
                openGapPlan();
                setMobileTab("gaps");
              }}
              onOpenDayRoute={() => {
                openDayRoute();
                setMobileTab("route");
              }}
            />
          ) : null}
          {mobileTab === "timetable" ? (
            <TimetableGrid
              meetings={termMeetings}
              onRouteToMeeting={() => {
                openDayRoute();
                setMobileTab("route");
              }}
            />
          ) : null}
          {mobileTab === "gaps" ? (
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
                meetings={meetings}
                term={term}
                onTermChange={setTerm}
                preferences={preferences}
                onPreferencesChange={updateUserPreferences}
                user={user}
                planTransition={planTransition}
              />
            </Suspense>
          ) : null}
        </MobileShell>
        <MobileMoreSheet
          open={moreOpen}
          onOpenChange={setMoreOpen}
          loading={loading}
          onUpdateTimetable={() => replacementInputRef.current?.click()}
          onRemoveTimetable={() => {
            if (window.confirm("Remove this timetable from this browser?")) {
              setMoreOpen(false);
              clearTimetable();
            }
          }}
        >
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <ResidenceSettings
            user={user}
            preferences={preferences}
            onPreferencesChange={updateUserPreferences}
          />
          <AccountStatus user={user} loading={authLoading} />
        </MobileMoreSheet>
      </>
    );
  }

  return (
    <div className="app-shell min-h-screen bg-background text-foreground">
      <header
        className="app-nav sticky top-0 z-30 border-b"
        data-scrolled={isScrolled ? "true" : "false"}
      >
        <div className="mx-auto flex min-h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <a
            href="/"
            aria-label="Gapwise for UTM home"
            className="group flex min-w-0 items-center gap-3"
          >
            <img
              src="/logo-mark.svg"
              alt=""
              aria-hidden="true"
              className="h-7 w-7 shrink-0 transition-transform duration-300 group-hover:scale-105"
            />
            <div className="min-w-0">
              <p className="truncate font-display text-base font-semibold tracking-[-0.025em]">
                Gapwise <span className="text-accent">for UTM</span>
              </p>
            </div>
          </a>

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
      <PlaceholderRemoved onAccountDeleted={(clearLocal) => {
                const retainedLocal = clearLocal
                  ? null
                  : loadRememberedRecord<Meeting[]>().record?.data;
                setMeetings(retainedLocal?.length ? retainedLocal : null);
                latestMeetings.current = retainedLocal?.length ? retainedLocal : null;
                restoredSource.current = retainedLocal?.length ? "local" : "none";
                setRestoration(retainedLocal?.length ? "restored-local" : "no-cloud-data");
                setRestorationMessage(null);
                if (isEncryptedPrivateCloudAuthoritative) {
                  setPersonalItems([]);
                  setPreferences(DEFAULT_USER_PREFERENCES);
                  setGapPreferences(DEFAULT_GAP_PREFERENCES);
                  lastEncryptedFingerprint.current = null;
                }
              }}
            />
          </div>
        </div>
      </header>

      <main
        className={`mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 ${!meetings ? "landing-stage" : ""}`}
      >
        {!meetings ? <div className="topography-field" aria-hidden="true" /> : null}
        {(authLoading || restoration === "checking-cloud") && !meetings ? (
          <div className="py-16" role="status" aria-live="polite">
            <div className="h-4 w-36 animate-pulse rounded bg-muted" />
            <div className="mt-4 h-24 max-w-xl animate-pulse rounded-xl bg-muted" />
            <span className="sr-only">Checking for your timetable…</span>
          </div>
        ) : !meetings ? (
          <>
            <div className="landing-bento rise-in">
              <section className="bento-cell hero-surface flex min-h-[24rem] flex-col p-7 text-hero-foreground sm:p-10 lg:col-span-7 lg:min-h-[26rem] lg:p-12">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="inline-flex w-fit items-center gap-2 rounded-lg border border-hero-accent/25 bg-hero-muted/35 px-3 py-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-hero-accent" aria-hidden="true" />
                    <span className="eyebrow">Private by design</span>
                  </p>
                  <span className="eyebrow text-hero-foreground/45">UTM campus utility</span>
                </div>

                <h1 className="mt-10 max-w-[13ch] text-balance font-display text-[2.65rem] font-medium leading-[0.98] tracking-[-0.055em] sm:text-[4.15rem]">
                  Make every gap on campus count.
                </h1>

                <p className="mt-6 max-w-[34rem] text-[0.95rem] leading-7 text-hero-foreground/68 sm:text-base">
                  Turn your ACORN export into a precise weekly timetable, useful gap plan, and
                  route-aware guide for moving across UTM.
                </p>

                <div className="mt-auto grid gap-3 pt-10 text-xs text-hero-foreground/58 sm:grid-cols-2">
                  <p className="flex items-center gap-2 border-t border-hero-foreground/10 pt-3">
                    <span className="h-1.5 w-1.5 rounded-full bg-hero-accent" aria-hidden="true" />
                    Original .ics files never leave your device
                  </p>
                  <p className="flex items-center gap-2 border-t border-hero-foreground/10 pt-3">
                    <span className="h-1.5 w-1.5 rounded-full bg-hero-accent" aria-hidden="true" />
                    Built around the UTM campus
                  </p>
                </div>
              </section>

              <section className="bento-cell flex flex-col justify-center p-6 sm:p-8 lg:col-span-5 lg:row-span-2 lg:p-10">
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
                  />
                  <p className="mt-8 border-t border-border pt-5 text-center font-mono text-[0.625rem] uppercase leading-relaxed tracking-[0.13em] text-muted-foreground">
                    Independent student project · Not affiliated with U of T
                  </p>
                </div>
              </section>

              <section className="bento-cell min-h-[17rem] p-5 sm:p-6 lg:col-span-7">
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
                    <UtmMonumentViewer
                      compact
                      className="border-accent/20 bg-hero-muted/25 bg-none"
                    />
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
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-accent/20 bg-accent/8 text-accent">
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
                <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight sm:text-3xl">
                  {isDemo ? "Demo timetable" : "Your timetable"}
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
                  onClick={() => {
                    if (window.confirm("Remove this timetable from this browser?"))
                      clearTimetable();
                  }}
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
                    value: "timetable" as const,
                    ariaLabel: "Weekly timetable",
                    label: (
                      <span>
                        <span className="hidden sm:inline">Weekly </span>timetable
                      </span>
                    ),
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
                value={view}
                onChange={showView}
                className="w-full sm:w-[30rem]"
              />
            </div>

            <div className="mt-6">
              {termMeetings.length === 0 ? (
                <div className="surface flex flex-col items-center p-10 text-center sm:p-14">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary">
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
                  <div hidden={view !== "timetable"}>
                    <TimetableGrid
                      meetings={termMeetings}
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
            className="glass-panel fixed bottom-4 left-1/2 z-40 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 rounded-lg px-4 py-3 text-sm"
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
              University of Toronto.
            </p>
          </div>
          <p className="eyebrow self-end text-muted-foreground">Built for UTM students</p>
        </div>
      </footer>
    </div>
  );
}
