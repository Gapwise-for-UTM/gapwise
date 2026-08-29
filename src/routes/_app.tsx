import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
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
import { loadPersonalItems } from "@/features/personal/persistence";
import { usePersonalItemCommands } from "@/features/personal/use-personal-item-commands";
import { useAppNavigation, type AppDestination } from "@/features/navigation/use-app-navigation";
import { useSelectedScheduleContext } from "@/features/schedule/use-selected-schedule-context";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TimetableGrid } from "@/components/TimetableGrid";
import { TimetableExportDialog } from "@/components/TimetableExportDialog";
import { TodaySummary } from "@/components/TodaySummary";
import { UploadPanel } from "@/components/UploadPanel";
import { UtmMonumentViewer } from "@/components/UtmMonumentViewer";
import { MobileMoreSheet } from "@/components/mobile/MobileMoreSheet";
import { MobileShell } from "@/components/mobile/MobileShell";
import { MobileTimetable } from "@/components/mobile/MobileTimetable";
import { MobileToday } from "@/components/mobile/MobileToday";
import { DesktopSidebar } from "@/components/DesktopSidebar";
import { useTodayState } from "@/features/today/use-today-state";
import { useIsMobile } from "@/hooks/use-mobile";

import { AccountStatus } from "@/features/auth/AccountStatus";
import { requestGapwiseSignIn } from "@/features/auth/sign-in-trigger";
import { useAuth } from "@/features/auth/use-auth";
import { CloudSyncControls } from "@/features/sync/CloudSyncControls";
import { ResidenceSettings } from "@/features/sync/ResidenceSettings";
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
import { useIntroDismissed, useTheme } from "@/hooks/use-preferences";
import { DEMO_MEETINGS } from "@/lib/demo-timetable";
import { emitClickSpark } from "@/lib/micro-interactions";
import type { Meeting } from "@/lib/timetable-types";
import { isEncryptedPrivateCloudAuthoritative } from "@/features/security/private-cloud-mode";
import { useEncryptedAutosave } from "@/features/sync/use-encrypted-autosave";
import { useAuthenticatedRestoration } from "@/features/sync/use-authenticated-restoration";
import { useGuestTimetableRestoration } from "@/features/sync/use-guest-timetable-restoration";
import { useTimetableCommands } from "@/features/timetable/use-timetable-commands";
import { AcademicWorkDialog } from "@/features/academic/AcademicWorkDialog";
import {
  EMPTY_ACADEMIC_STATE,
  createManualCoursework,
  type AcademicState,
} from "@/features/academic/state";
import { plannedWorkMeetings } from "@/features/academic/integration";
import { composeSchedule } from "@/lib/personal-scheduler";
import { getCampusAccessPoint } from "@/data/utm/campus-access-points";
import { UTM_RESIDENCES } from "@/data/utm/building-registry";

const DayRoute = lazy(() =>
  import("@/components/DayRoute").then((module) => ({ default: module.DayRoute })),
);
const EMPTY_MEETINGS: Meeting[] = [];

export const Route = createFileRoute("/_app")({
  component: AppLayout,
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
  const { theme, toggleTheme } = useTheme();
  const { dismissed, dismiss } = useIntroDismissed();
  const { user, loading: authLoading, error: authError } = useAuth();

  const [meetings, setMeetings] = useState<Meeting[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const {
    record: guestRestoration,
    setRecord: setGuestRestoration,
    remember,
    setRemember,
  } = useGuestTimetableRestoration();
  const [isDemo, setIsDemo] = useState(false);
  const [academic, setAcademic] = useState<AcademicState>(EMPTY_ACADEMIC_STATE);
  const [academicOpen, setAcademicOpen] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences>(loadLocalUserPreferences);
  const [gapPreferences, setGapPreferences] = useState<GapPreferences>(loadGapPreferences);
  const [personalItems, setPersonalItems] = useState<import("@/lib/personal-types").PersonalItem[]>(
    () => loadPersonalItems(),
  );
  const updateUserPreferences = useCallback((next: UserPreferences) => {
    setPreferences(saveLocalUserPreferences(next));
  }, []);
  const [isOnline, setIsOnline] = useState(
    typeof window !== "undefined" && "onLine" in navigator ? navigator.onLine : true,
  );
  const [isScrolled, setIsScrolled] = useState(false);
  const isMobile = useIsMobile();
  const [moreOpen, setMoreOpen] = useState(false);
  const [accountSettingsRequest, setAccountSettingsRequest] = useState(0);
  const [arrivalSettingsRequest, setArrivalSettingsRequest] = useState(0);
  const replacementInputRef = useRef<HTMLInputElement>(null);
  const authenticatedUserId = user?.id ?? null;
  const arrivalLabel =
    UTM_RESIDENCES.find((building) => building.code === preferences.residenceBuildingCode)?.code ??
    getCampusAccessPoint(preferences.campusAccessPointId)?.label ??
    "Campus arrival";
  const {
    destination,
    selectedBuildingCode,
    openedViews,
    mobileTab,
    view,
    navigateToday,
    showView,
    selectBuilding,
    openGapPlan,
    openDayRoute,
  } = useAppNavigation(Boolean(meetings?.length));
  const personalCommands = usePersonalItemCommands(personalItems, setPersonalItems);
  const {
    term,
    setTerm,
    terms,
    schedule: termMeetings,
    gaps,
    planTransition,
  } = useSelectedScheduleContext(meetings, personalItems);

  const {
    restoration,
    setRestoration,
    restorationMessage,
    setRestorationMessage,
    restoredSource,
    latestMeetings,
    lastEncryptedFingerprint,
    applyPrivateData,
  } = useAuthenticatedRestoration({
    authLoading,
    authError,
    userId: authenticatedUserId,
    guest: guestRestoration,
    meetings,
    setMeetings,
    setPersonalItems,
    setPreferences,
    setGapPreferences,
    setWarnings,
    setError,
    setIsDemo,
    setAcademic,
  });
  const timetableCommands = useTimetableCommands({
    meetings,
    setMeetings,
    setWarnings,
    setError,
    setLoading,
    remember,
    setRemember,
    setGuestRestoration,
    userId: authenticatedUserId,
    isDemo,
    setIsDemo,
    latestMeetings,
    restoredSource,
    setRestoration,
    setRestorationMessage,
    applyPrivateData,
  });

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
  }, [lastEncryptedFingerprint]);

  useEncryptedAutosave({
    userId: authenticatedUserId,
    meetings,
    personalItems,
    preferences,
    gapPreferences,
    academic,
    isDemo,
    isOnline,
    restoredFingerprint: lastEncryptedFingerprint,
    onFailure: () =>
      setRestorationMessage(
        "Encrypted local data was kept, but cloud sync could not finish. Try again when connected.",
      ),
  });

  function updateGapPreferences(next: GapPreferences) {
    const sanitized = sanitizeGapPreferences(next);
    setGapPreferences(sanitized);
    saveGapPreferences(sanitized);
  }

  const handleAccountDeleted = useCallback(
    (_clearLocal: boolean) => {
      setMeetings(null);
      latestMeetings.current = null;
      restoredSource.current = "none";
      setRestoration("no-cloud-data");
      setRestorationMessage(null);
      if (isEncryptedPrivateCloudAuthoritative) {
        setPersonalItems([]);
        setPreferences(DEFAULT_USER_PREFERENCES);
        setGapPreferences(DEFAULT_GAP_PREFERENCES);
        setAcademic(EMPTY_ACADEMIC_STATE);
        lastEncryptedFingerprint.current = null;
      }
    },
    [
      lastEncryptedFingerprint,
      latestMeetings,
      restoredSource,
      setRestoration,
      setRestorationMessage,
    ],
  );

  const timetableWithWork = useMemo(
    () => [...termMeetings, ...plannedWorkMeetings(academic, term)],
    [academic, term, termMeetings],
  );
  const exportMeetings = useMemo(
    () => [
      ...composeSchedule(meetings ?? EMPTY_MEETINGS, personalItems),
      ...terms.flatMap((availableTerm) => plannedWorkMeetings(academic, availableTerm)),
    ],
    [academic, meetings, personalItems, terms],
  );
  const { now: todayNow, state: todayState } = useTodayState({
    meetings: timetableWithWork,
    selectedTerm: term,
    preferences,
    gapPreferences,
    planTransition,
  });
  useEffect(() => {
    if (!isDemo || academic.coursework.length) return;
    const due = new Date();
    due.setDate(due.getDate() + 5);
    due.setHours(23, 59, 0, 0);
    setAcademic({
      ...EMPTY_ACADEMIC_STATE,
      coursework: [
        createManualCoursework({
          courseCode: "DEM101H5",
          title: "Problem Set",
          kind: "assignment",
          dueAt: due.toISOString(),
          estimatedMinutes: 180,
          priority: "normal",
        }),
      ],
    });
  }, [academic.coursework.length, isDemo]);

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
            onChange={timetableCommands.handleFileInputChange}
          />
          {restorationMessage ? (
            <p className="surface mb-4 p-4 text-sm text-muted-foreground">{restorationMessage}</p>
          ) : null}
          {!meetings && mobileTab !== "route" ? (
            <ProductEmptyState
              destination={mobileTab}
              loading={loading}
              onImport={() => replacementInputRef.current?.click()}
              onDemo={timetableCommands.loadDemo}
            />
          ) : null}
          {meetings && mobileTab === "today" ? (
            <MobileToday
              state={todayState}
              now={todayNow}
              selectedTerm={term}
              meetingCount={termMeetings.length}
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
              meetings={timetableWithWork}
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
                personalCommands.openCreate();
              }}
              onEditPersonal={personalCommands.openEdit}
              onDeletePersonal={personalCommands.remove}
              exportAction={<TimetableExportDialog meetings={exportMeetings} />}
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
            timetableCommands.confirmRemove();
          }}
          syncControls={
            meetings ? (
              <CloudSyncControls
                user={user}
                meetings={meetings}
                personalItems={personalItems}
                preferences={preferences}
                gapPreferences={gapPreferences}
                academic={academic}
                onLoad={timetableCommands.loadCloud}
                onLoadPrivate={timetableCommands.loadPrivate}
                restorationState={restoration}
              />
            ) : null
          }
        >
          <button
            type="button"
            onClick={() => {
              setMoreOpen(false);
              setAcademicOpen(true);
            }}
            className="button-secondary min-h-10 px-3 text-sm font-semibold"
          >
            Academic work
          </button>
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
            hasTimetable={Boolean(meetings?.length)}
            onOnboardingContinue={navigateToday}
            onOnboardingImport={() => replacementInputRef.current?.click()}
          />
        </MobileMoreSheet>
        <AcademicWorkDialog
          open={academicOpen}
          onOpenChange={setAcademicOpen}
          state={academic}
          onChange={setAcademic}
          meetings={timetableWithWork}
        />
        <PersonalItemForm
          open={personalCommands.formOpen}
          onOpenChange={personalCommands.setOpen}
          initial={personalCommands.editingItem}
          defaultTerm={term}
          onSave={personalCommands.save}
        />
      </>
    );
  }

  return (
    <div
      className={`app-shell min-h-screen bg-background text-foreground ${destination !== "home" ? "desktop-product-shell" : ""}`}
    >
      <Outlet />
      {destination !== "home" ? (
        <DesktopSidebar
          destination={destination}
          arrivalLabel={arrivalLabel}
          theme={theme}
          onOpenArrival={() => setArrivalSettingsRequest((request) => request + 1)}
          onOpenAccount={() => {
            if (user) setAccountSettingsRequest((request) => request + 1);
            else requestGapwiseSignIn();
          }}
          onToggleTheme={toggleTheme}
        />
      ) : null}
      <header
        className="app-nav desktop-app-header sticky top-0 z-30 border-b"
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
              openRequest={arrivalSettingsRequest}
            />
            <AccountStatus
              user={user}
              loading={authLoading}
              onAccountDeleted={handleAccountDeleted}
              hasTimetable={Boolean(meetings?.length)}
              onOnboardingContinue={navigateToday}
              onOnboardingImport={() => replacementInputRef.current?.click()}
              settingsRequest={accountSettingsRequest}
            />
          </div>
        </div>
      </header>

      <main
        className={`desktop-main mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 ${destination === "home" ? "landing-stage" : ""}`}
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
                    onFile={timetableCommands.importFile}
                    onDemo={timetableCommands.loadDemo}
                    loading={loading}
                    error={error}
                    remember={remember}
                    onRememberChange={timetableCommands.setRemembered}
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
                academic={academic}
                onLoad={timetableCommands.loadCloud}
                onLoadPrivate={timetableCommands.loadPrivate}
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
              onChange={timetableCommands.handleFileInputChange}
            />
            <ProductEmptyState
              destination={destination}
              loading={loading}
              onImport={() => replacementInputRef.current?.click()}
              onDemo={timetableCommands.loadDemo}
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

            <div className="desktop-page-heading rise-in flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-6">
              <div className="min-w-0">
                <p className="eyebrow text-accent">
                  {isDemo
                    ? "Sample data"
                    : destination === "timetable"
                      ? "Day timetable"
                      : destination === "gaps"
                        ? "Gap plan"
                        : destination === "route"
                          ? "Campus map"
                          : "Today overview"}
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
                  onChange={timetableCommands.handleFileInputChange}
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
                  onClick={timetableCommands.confirmRemove}
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
              meetings={timetableWithWork}
              selectedTerm={term}
              preferences={preferences}
              gapPreferences={gapPreferences}
              planTransition={planTransition}
              onOpenGapPlan={openGapPlan}
              onOpenDayRoute={openDayRoute}
            />

            <div className="desktop-view-controls mt-6 flex flex-wrap items-center gap-3">
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
                  if (next === "today") navigateToday();
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
                      meetings={timetableWithWork}
                      gaps={gaps}
                      headerAction={
                        <div className="flex gap-2">
                          <TimetableExportDialog meetings={exportMeetings} />
                          <button
                            type="button"
                            onClick={() => setAcademicOpen(true)}
                            className="button-secondary px-3 py-1.5 text-xs font-semibold"
                          >
                            Academic work
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              emitClickSpark(event);
                              personalCommands.openCreate();
                            }}
                            className="button-primary click-spark inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold"
                          >
                            Add personal
                          </button>
                        </div>
                      }
                      onRouteToMeeting={() => showView("route")}
                      onEditPersonal={personalCommands.openEdit}
                      onDeletePersonal={personalCommands.remove}
                      onCreatePersonal={({ weekday, startTime, endTime }) =>
                        personalCommands.createAt({
                          term,
                          weekday: weekday as import("@/lib/timetable-types").Weekday,
                          startTime,
                          endTime,
                        })
                      }
                      onMovePersonal={(id, weekday, startTime, endTime) =>
                        personalCommands.move(
                          id,
                          weekday as import("@/lib/timetable-types").Weekday,
                          startTime,
                          endTime,
                        )
                      }
                      onResizePersonal={personalCommands.resize}
                    />
                    <PersonalItemForm
                      open={personalCommands.formOpen}
                      onOpenChange={personalCommands.setOpen}
                      initial={personalCommands.editingItem}
                      defaultTerm={term}
                      onSave={personalCommands.save}
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
                academic={academic}
                onLoad={timetableCommands.loadCloud}
                onLoadPrivate={timetableCommands.loadPrivate}
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

      <AcademicWorkDialog
        open={academicOpen}
        onOpenChange={setAcademicOpen}
        state={academic}
        onChange={setAcademic}
        meetings={termMeetings}
      />

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
