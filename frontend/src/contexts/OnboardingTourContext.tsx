import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  hasAutoStartedTourThisSession,
  hasCompletedTour,
  markTourAutoStartedThisSession,
  markTourCompleted,
} from "@/lib/onboarding";

export const TOUR_STEP = {
  NAV_TEMPLATES: 0,
  CREATE_TEMPLATE: 1,
  MANUAL_IMPORT: 2,
  IMPORT_UPLOAD: 3,
  IMPORT_CONFIRM: 4,
  IMPORT_CONTINUE_UPLOAD: 5,
  IMPORT_CONTINUE_MAP: 6,
  IMPORT_CREATE: 7,
  IMPORT_OPEN: 8,
  COLLAPSE_ITEMS: 9,
  COLLAPSE_SECTIONS: 10,
  ENJOY: 11,
} as const;

export const TOUR_STEP_COUNT = 12;

type OnboardingTourContextValue = {
  run: boolean;
  stepIndex: number;
  setStepIndex: (index: number) => void;
  startTour: () => void;
  stopTour: (markComplete?: boolean) => void;
  advanceStep: () => void;
};

const OnboardingTourContext = createContext<OnboardingTourContextValue | undefined>(
  undefined
);

function isTemplateEditorPath(pathname: string): boolean {
  return (
    pathname.startsWith("/templates/") &&
    !pathname.startsWith("/templates/import/")
  );
}

export function OnboardingTourProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const autoStartScheduled = useRef(false);

  const stopTour = useCallback(
    (markComplete = true) => {
      setRun(false);
      if (markComplete && user?.id) {
        markTourCompleted(user.id);
      }
    },
    [user?.id]
  );

  const startTour = useCallback(() => {
    setStepIndex(TOUR_STEP.NAV_TEMPLATES);
    setRun(true);
    if (location.pathname !== "/templates") {
      navigate("/templates");
    }
  }, [location.pathname, navigate]);

  const advanceStep = useCallback(() => {
    setStepIndex((current) => {
      if (current >= TOUR_STEP_COUNT - 1) {
        return current;
      }
      return current + 1;
    });
  }, []);

  useEffect(() => {
    if (!user?.id || autoStartScheduled.current) return;
    if (hasCompletedTour(user.id)) return;
    if (hasAutoStartedTourThisSession()) return;

    autoStartScheduled.current = true;
    markTourAutoStartedThisSession();
    const timer = window.setTimeout(() => {
      setStepIndex(TOUR_STEP.NAV_TEMPLATES);
      setRun(true);
      if (location.pathname !== "/templates") {
        navigate("/templates");
      }
    }, 400);

    return () => window.clearTimeout(timer);
  }, [user?.id, location.pathname, navigate]);

  useEffect(() => {
    if (!run) return;

    const { pathname } = location;

    // After choosing Manual Import, land on the upload step.
    // Do not advance further — wait until a file is selected.
    if (
      pathname === "/templates/import/manual" &&
      stepIndex <= TOUR_STEP.MANUAL_IMPORT
    ) {
      setStepIndex(TOUR_STEP.IMPORT_UPLOAD);
      return;
    }

    // After opening the imported template, continue with editor tips.
    if (
      isTemplateEditorPath(pathname) &&
      stepIndex >= TOUR_STEP.IMPORT_OPEN &&
      stepIndex < TOUR_STEP.COLLAPSE_ITEMS
    ) {
      setStepIndex(TOUR_STEP.COLLAPSE_ITEMS);
    }
  }, [location.pathname, run, stepIndex]);

  const value = useMemo(
    () => ({
      run,
      stepIndex,
      setStepIndex,
      startTour,
      stopTour,
      advanceStep,
    }),
    [run, stepIndex, startTour, stopTour, advanceStep]
  );

  return (
    <OnboardingTourContext.Provider value={value}>
      {children}
    </OnboardingTourContext.Provider>
  );
}

export function useOnboardingTour(): OnboardingTourContextValue {
  const context = useContext(OnboardingTourContext);
  if (!context) {
    throw new Error("useOnboardingTour must be used within OnboardingTourProvider");
  }
  return context;
}
