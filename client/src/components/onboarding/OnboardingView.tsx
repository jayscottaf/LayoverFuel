import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/context/auth-context";
import { useOffline } from "@/hooks/use-offline";
import { getLocalDateString, getUserTimezone } from "@/components/travel/local-date";
import type { DashboardData } from "@/components/travel/api";
import { primaryButtonClass, textButtonClass } from "./controls";
import {
  STEPS,
  STEP_FIELDS,
  TOTAL_STEPS,
  clearProgress,
  emptyAnswers,
  firstInvalidStep,
  isStepValid,
  loadProgress,
  saveProgress,
  switchHeightUnit,
  switchWeightUnit,
  toPayload,
  type Answers,
  type FieldKey,
  type StepId,
} from "./onboarding-model";
import {
  AboutStep,
  ActivityStep,
  FoodStep,
  GoalStep,
  NameStep,
  ResultStep,
  ReviewStep,
  type StartingTargets,
} from "./steps";

const HEADING_ID = "ob-step-heading";
const REVIEW_INDEX = STEPS.indexOf("review");

const STEP_COPY: Record<StepId | "result", { title: string; subtitle: string }> = {
  name: {
    title: "What should we call you?",
    subtitle: "Setup takes about a minute. You can change any answer later in Profile.",
  },
  about: {
    title: "About you",
    subtitle: "These details estimate how much energy you use in a day.",
  },
  goal: {
    title: "What's your main goal?",
    subtitle: "This sets your starting calorie and protein targets.",
  },
  activity: {
    title: "How active is a typical week?",
    subtitle: "Count workouts and time on your feet. Pick the closest match.",
  },
  food: {
    title: "Any food preferences?",
    subtitle: "Optional. Meal ideas will respect what you choose.",
  },
  review: {
    title: "Review your details",
    subtitle: "Check everything looks right, then create your plan.",
  },
  result: {
    title: "Your starting targets",
    subtitle: "Your details are saved.",
  },
};

interface ProfileResponse {
  name?: string | null;
}

function describeSubmitError(err: unknown): string {
  const message = err instanceof Error ? err.message : "";
  const status = Number(message.split(":")[0]);
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You appear to be offline. Your answers are kept, so try again once you're connected.";
  }
  if (status === 400) return "Some details weren't accepted. Check your answers, then try again.";
  if (status === 401) return "Your session has ended. Sign out and sign back in to finish setup.";
  if (!status) return "We couldn't reach LayoverFuel. Your answers are kept, so you can try again.";
  return "Something went wrong on our side. Your answers are kept, so you can try again.";
}

function readTargets(data: DashboardData | undefined): StartingTargets | null {
  const m = data?.stats?.macros;
  if (!m) return null;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, v) : NaN);
  const t = { targetCalories: n(m.targetCalories), protein: n(m.protein), carbs: n(m.carbs), fat: n(m.fat) };
  if (Object.values(t).some(Number.isNaN) || t.targetCalories <= 0) return null;
  return t;
}

export function OnboardingView() {
  const { logout, checkAuth } = useAuth();
  const { isOffline } = useOffline();
  const queryClient = useQueryClient();

  const [initial] = useState(() => {
    const saved = loadProgress();
    if (!saved) return { answers: emptyAnswers(), step: 0, nameEdited: false };
    // Never restore past a step that still needs an answer.
    const blocker = firstInvalidStep(saved.answers);
    const maxStep = blocker ? STEPS.indexOf(blocker) : REVIEW_INDEX;
    return { ...saved, step: Math.min(saved.step, maxStep) };
  });

  const [answers, setAnswers] = useState<Answers>(initial.answers);
  const [step, setStep] = useState<number>(initial.step);
  const [nameEdited, setNameEdited] = useState(initial.nameEdited);
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [returnToReview, setReturnToReview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [starting, setStarting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  const stepId: StepId = STEPS[step];

  // ---- Prefill name from the account (tolerates failure) ----
  const profile = useQuery<ProfileResponse>({
    queryKey: ["/api/user/profile"],
    queryFn: async () => (await apiRequest("GET", "/api/user/profile")).json() as Promise<ProfileResponse>,
    retry: false,
  });
  const profileName = profile.data?.name?.trim() ?? "";
  useEffect(() => {
    if (!profileName || nameEdited) return;
    setAnswers(a => (a.name ? a : { ...a, name: profileName.slice(0, 80) }));
  }, [profileName, nameEdited]);

  // ---- Persist in-progress answers for reloads ----
  useEffect(() => {
    if (done) return;
    saveProgress({ answers, step, nameEdited });
  }, [answers, step, nameEdited, done]);

  // ---- Move focus to the new heading on every step change ----
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    scrollRef.current?.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [step, done]);

  // ---- Starting targets after success ----
  const today = useMemo(() => getLocalDateString(), [done]);
  const timezone = useMemo(() => getUserTimezone(), []);
  const targetsQuery = useQuery<DashboardData>({
    queryKey: ["onboarding-starting-targets", today, timezone],
    queryFn: async () => {
      const qs = new URLSearchParams({ date: today, timezone }).toString();
      return (await apiRequest("GET", `/api/dashboard?${qs}`)).json() as Promise<DashboardData>;
    },
    enabled: done,
    retry: 1,
  });
  const targets = readTargets(targetsQuery.data);

  // ---- Actions ----
  const update = useCallback((patch: Partial<Answers> | ((a: Answers) => Answers)) => {
    setAnswers(a => (typeof patch === "function" ? patch(a) : { ...a, ...patch }));
  }, []);

  const touch = useCallback((field: FieldKey) => setTouched(t => (t[field] ? t : { ...t, [field]: true })), []);
  const shows = (field: FieldKey) => Boolean(touched[field]);

  const goTo = (index: number) => {
    setStep(Math.min(Math.max(index, 0), REVIEW_INDEX));
  };

  const submit = async () => {
    if (submitting) return;
    const payload = toPayload(answers);
    if (!payload) {
      const blocker = firstInvalidStep(answers);
      if (blocker) {
        setTouched(t => ({ ...t, ...Object.fromEntries(STEP_FIELDS[blocker].map(f => [f, true])) }));
        goTo(STEPS.indexOf(blocker));
      }
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await apiRequest("POST", "/api/onboarding/complete", payload);
      clearProgress();
      setDone(true);
      void queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
    } catch (err) {
      setSubmitError(describeSubmitError(err));
    } finally {
      setSubmitting(false);
    }
  };

  /** Continue from the current step, using `next` when a choice was just made. */
  const advance = (next: Answers = answers) => {
    if (stepId === "review") {
      void submit();
      return;
    }
    if (!isStepValid(stepId, next)) {
      setTouched(t => ({ ...t, ...Object.fromEntries(STEP_FIELDS[stepId].map(f => [f, true])) }));
      return;
    }
    if (returnToReview) {
      const blocker = firstInvalidStep(next);
      goTo(blocker ? STEPS.indexOf(blocker) : REVIEW_INDEX);
      if (!blocker) setReturnToReview(false);
      return;
    }
    goTo(step + 1);
  };

  const start = async () => {
    setStarting(true);
    try {
      await checkAuth();
    } finally {
      setStarting(false);
    }
  };

  const primaryAction = () => {
    if (done) {
      if (!isOffline && !starting) void start();
      return;
    }
    advance();
  };

  const signOut = async () => {
    setSigningOut(true);
    clearProgress();
    try {
      await logout();
    } catch {
      // Leave either way; the login screen re-checks the session.
    }
    window.location.assign("/");
  };

  const onFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    primaryAction();
  };

  const onFormKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    if (e.target instanceof HTMLInputElement) {
      e.preventDefault();
      primaryAction();
    }
  };

  // ---- Derived UI state ----
  const copy = STEP_COPY[done ? "result" : stepId];
  const stepValid = isStepValid(stepId, answers);
  const primaryDisabled = done
    ? starting || isOffline
    : stepId === "review"
      ? !stepValid || submitting || isOffline
      : !stepValid;
  const primaryLabel = done
    ? "Start using LayoverFuel"
    : stepId === "review"
      ? "Create my plan"
      : returnToReview
        ? "Back to review"
        : "Continue";
  const busy = (done && starting) || (stepId === "review" && submitting);
  const busyLabel = done ? "Opening LayoverFuel" : "Creating your plan";
  const progressNow = done ? TOTAL_STEPS : step + 1;

  let content: ReactNode;
  if (done) {
    content = (
      <ResultStep
        targets={targets}
        loading={!targets && !isOffline && (targetsQuery.isPending || targetsQuery.isFetching)}
        failed={targetsQuery.isError || (targetsQuery.isSuccess && !targets)}
        isOffline={isOffline}
        onRetry={() => void targetsQuery.refetch()}
      />
    );
  } else {
    switch (stepId) {
      case "name":
        content = (
          <NameStep
            answers={answers}
            update={update}
            shows={shows}
            touch={touch}
            profileLoading={profile.isLoading}
            onNameEdited={() => setNameEdited(true)}
          />
        );
        break;
      case "about":
        content = (
          <AboutStep
            answers={answers}
            update={update}
            shows={shows}
            touch={touch}
            onHeightUnit={u => setAnswers(a => switchHeightUnit(a, u))}
            onWeightUnit={u => setAnswers(a => switchWeightUnit(a, u))}
          />
        );
        break;
      case "goal":
        content = (
          <GoalStep
            labelledBy={HEADING_ID}
            value={answers.fitnessGoal}
            onChange={v => update({ fitnessGoal: v })}
            onEnter={v => advance({ ...answers, fitnessGoal: v })}
          />
        );
        break;
      case "activity":
        content = (
          <ActivityStep
            labelledBy={HEADING_ID}
            value={answers.activityLevel}
            onChange={v => update({ activityLevel: v })}
            onEnter={v => advance({ ...answers, activityLevel: v })}
          />
        );
        break;
      case "food":
        content = <FoodStep answers={answers} update={update} labelledBy={HEADING_ID} />;
        break;
      case "review":
        content = (
          <ReviewStep
            answers={answers}
            isOffline={isOffline}
            submitError={submitError}
            submitting={submitting}
            onRetry={() => void submit()}
            onEdit={index => {
              setSubmitError(null);
              setReturnToReview(true);
              goTo(index);
            }}
          />
        );
        break;
    }
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-background text-foreground">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto scroll-touch">
        <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-4 pt-safe">
          <header className="pt-3 md:pt-10">
            <div className="flex items-center justify-between gap-3">
              <span className="text-lg font-semibold tracking-normal">LayoverFuel</span>
              <button
                type="button"
                onClick={() => void signOut()}
                disabled={signingOut || submitting}
                className={`${textButtonClass} -mr-2`}
              >
                {signingOut ? "Signing out" : "Sign out"}
              </button>
            </div>

            <div className="mt-2 flex min-h-11 items-center justify-between gap-3">
              {!done && step > 0 ? (
                <button
                  type="button"
                  onClick={() => goTo(step - 1)}
                  disabled={submitting}
                  className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  Back
                </button>
              ) : (
                <span aria-hidden="true" />
              )}
              <p className="text-sm text-muted-foreground tabular">
                {done ? "Setup complete" : `Step ${step + 1} of ${TOTAL_STEPS}`}
              </p>
            </div>

            <div
              role="progressbar"
              aria-label="Setup progress"
              aria-valuemin={0}
              aria-valuemax={TOTAL_STEPS}
              aria-valuenow={progressNow}
              aria-valuetext={done ? "Setup complete" : `Step ${step + 1} of ${TOTAL_STEPS}`}
              className="mt-1 h-1 overflow-hidden rounded-full bg-track"
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${(progressNow / TOTAL_STEPS) * 100}%` }}
              />
            </div>
          </header>

          <main className="flex flex-1 flex-col md:flex-none">
            <form
              noValidate
              onSubmit={onFormSubmit}
              onKeyDown={onFormKeyDown}
              aria-labelledby={HEADING_ID}
              className="flex flex-1 flex-col md:flex-none"
            >
              <div className="flex-1 pb-6 pt-6 md:flex-none md:pt-8">
                <h1
                  id={HEADING_ID}
                  ref={headingRef}
                  tabIndex={-1}
                  className="text-2xl font-semibold tracking-normal focus:outline-none"
                >
                  {copy.title}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">{copy.subtitle}</p>
                <div className="mt-6">{content}</div>
              </div>

              <div className="sticky bottom-0 -mx-4 border-t bg-background px-4 pb-safe md:static md:mx-0 md:border-0 md:px-0">
                <div className="py-3 md:pb-12 md:pt-0">
                  <button type="submit" disabled={primaryDisabled} aria-busy={busy || undefined} className={primaryButtonClass}>
                    {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    {busy ? busyLabel : primaryLabel}
                  </button>
                  {busy && (
                    <span className="sr-only" role="status">
                      {busyLabel}
                    </span>
                  )}
                  {done && isOffline && (
                    <p className="mt-2 text-center text-xs text-muted-foreground">Reconnect to continue.</p>
                  )}
                </div>
              </div>
            </form>
          </main>
        </div>
      </div>
    </div>
  );
}
