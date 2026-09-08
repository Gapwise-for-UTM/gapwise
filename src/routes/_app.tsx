import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarRange,
  CalendarClock,
  LayoutGrid,
  MapPinned,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { BubbleTabs } from "@/components/BubbleTabs";
import { GapPlan } from "@/components/GapPlan";
import { MarketingLanding } from "@/components/MarketingLanding";
import { loadPersonalItems } from "@/features/personal/persistence";
import { useAppNavigation, type AppDestination } from "@/features/navigation/use-app-navigation";
import { useSelectedScheduleContext } from "@/features/schedule/use-selected-schedule-context";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TimetableGrid } from "@/components/TimetableGrid";
import { TodaySummary } from "@/components/TodaySummary";
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
import { queueGapPlanSelection } from "@/features/gaps/selection";
import {
  DEFAULT_USER_PREFERENCES,
  loadLocalUserPreferences,
  saveLocalUserPreferences,
  type UserPreferences,
} from "@/features/sync/preferences";
import { useIntroDismissed, useTheme } from "@/hooks/use-preferences";
import { DEMO_MEETINGS } from "@/lib/demo-timetable";
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
import { getCampusAccessPoint } from "@/data/utm/campus-access-points";
import { UTM_RESIDENCES } from "@/data/utm/building-registry";

const DayRoute = lazy(() =>
  import("@/components/DayRoute").then((module) => ({ default: module.DayRoute })),
);
const EMPTY_MEETINGS: Meeting[] = [];

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

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
        : "Import your ACORN calendar to build your weekly view.";

  return (
    <section className="empty-state surface rise-in mx-auto flex max-w-2xl flex-col items-center p-8 text-center sm:p-12">
      <span className="empty-state-icon flex h-12 w-12 items-center justify-center rounded-xl border border-accent/20 bg-accent/8">
        <CalendarRange className="h-6 w-6 text-accent" aria-hidden="true" />
      </span>
      <p className="eyebrow mt-5 text-accent">Timetable import</p>
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
  const {
    term,
    setTerm,
    terms,
    schedule: termMeetings,
    gaps,
    planTransition,
  } = useSelectedScheduleContext(meetings);

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
    const updateScrollState = () => setIsScrolled(window.scrollY > 10);
    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollState);
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
    onFailure: () => setRestorationMessage("Sync paused. Changes are saved on this device."),
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
      ...(meetings ?? EMPTY_MEETINGS),
      ...terms.flatMap((availableTerm) => plannedWorkMeetings(academic, availableTerm)),
    ],
    [academic, meetings, terms],
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
              onOpenGapPlan={(gap) => {
                queueGapPlanSelection(gap.id);
                openGapPlan();
              }}
              onRouteToMeeting={() => {
                openDayRoute();
              }}
              exportAction={null}
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
            meetings={exportMeetings}
            term={term}
            preferences={preferences}
            planTransition={planTransition}
          />
        </MobileMoreSheet>
        <AcademicWorkDialog
          open={academicOpen}
          onOpenChange={setAcademicOpen}
          state={academic}
          onChange={setAcademic}
          meetings={timetableWithWork}
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
              meetings={exportMeetings}
              term={term}
              preferences={preferences}
              planTransition={planTransition}
            />
          </div>
        </div>
      </header>

      <main
        className={`desktop-main mx-auto max-w-7xl px-4 sm:px-6 ${
          destination === "home" ? "landing-stage py-0" : "py-6 sm:py-8"
        }`}
      >
        {(authLoading || guestRestoration === null || restoration === "checking-cloud") &&
        !meetings &&
        destination !== "route" ? (
          <div className="py-16" role="status" aria-live="polite">
            <div className="h-4 w-36 animate-pulse rounded bg-muted" />
            <div className="mt-4 h-24 max-w-xl animate-pulse rounded-lg bg-muted" />
            <span className="sr-only">Checking for your timetable…</span>
          </div>
        ) : destination === "home" ? (
          <MarketingLanding
            isOnline={isOnline}
            onFile={timetableCommands.importFile}
            onDemo={timetableCommands.loadDemo}
            loading={loading}
            error={error}
            remember={remember}
            onRememberChange={timetableCommands.setRemembered}
            rememberAvailable={!authenticatedUserId}
          />
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
              <div className="surface mb-5 flex items-start justify-between gap-4 bg-secondary/50 p-3.5">
                <p className="text-sm text-muted-foreground">
                  Use <strong className="text-foreground">Today</strong>,{" "}
                  <strong className="text-foreground">Timetable</strong>,{" "}
                  <strong className="text-foreground">Gap plan</strong>, and{" "}
                  <strong className="text-foreground">Day route</strong> to move through your week.
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

            <div className="desktop-page-heading rise-in flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-5">
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
                <h1 className="mt-1 font-display text-3xl font-medium tracking-[-0.045em] sm:text-4xl">
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
              <div className="surface mt-5 border-accent/40 p-4">
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

            <div className="desktop-view-controls mt-5 flex flex-wrap items-center gap-3">
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

            <div className="mt-5">
              {destination === "today" ? null : termMeetings.length === 0 &&
                destination !== "route" ? (
                <div className="empty-state surface flex flex-col items-center p-9 text-center sm:p-12">
                  <span className="empty-state-icon flex h-11 w-11 items-center justify-center rounded-xl border border-accent/20 bg-accent/8">
                    <CalendarRange className="h-5 w-5 text-accent" aria-hidden="true" />
                  </span>
                  <h2 className="mt-4 font-display text-lg font-semibold tracking-tight">
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
                          <button
                            type="button"
                            onClick={() => setAcademicOpen(true)}
                            className="button-secondary px-3 py-1.5 text-xs font-semibold"
                          >
                            Academic work
                          </button>
                        </div>
                      }
                      onRouteToMeeting={() => showView("route")}
                      onOpenGap={(gap) => {
                        queueGapPlanSelection(gap.id);
                        openGapPlan();
                      }}
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

            <div className="mt-5">
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
            className="status-toast surface fixed bottom-4 left-1/2 z-40 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 px-4 py-3 text-sm"
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

      {destination === "home" ? (
        <footer className="border-t border-border">
          <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-7 text-xs text-muted-foreground sm:px-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <p className="flex items-center gap-2 font-display font-semibold text-foreground">
                <img src="/logo-mark.svg" alt="" aria-hidden="true" className="h-4 w-4" />
                Gapwise <span className="font-normal text-muted-foreground">Built for UTM</span>
              </p>
              <nav aria-label="Gapwise ecosystem" className="flex flex-wrap gap-x-4 gap-y-2">
                <Link to="/about" className="hover:text-foreground">
                  About
                </Link>
                <Link to="/ai" className="hover:text-foreground">
                  AI
                </Link>
                <a href="https://docs.gapwise.ca" className="hover:text-foreground">
                  Docs
                </a>
                <a href="https://data.gapwise.ca" className="hover:text-foreground">
                  Data
                </a>
                <a href="https://status.gapwise.ca" className="hover:text-foreground">
                  Status
                </a>
                <Link to="/support" className="hover:text-foreground">
                  Support
                </Link>
                <a
                  href="https://github.com/Gapwise-for-UTM/gapwise"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-foreground"
                >
                  GitHub
                </a>
              </nav>
            </div>
          </div>
        </footer>
      ) : null}
    </div>
  );
}
