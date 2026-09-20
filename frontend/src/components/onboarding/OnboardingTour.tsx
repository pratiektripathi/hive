import { useEffect, useMemo } from "react";
import {
  ACTIONS,
  EVENTS,
  Joyride,
  ORIGIN,
  STATUS,
  type EventData,
  type Controls,
  type Step,
} from "react-joyride";
import {
  TOUR_STEP,
  TOUR_STEP_COUNT,
  useOnboardingTour,
} from "@/contexts/OnboardingTourContext";

const ACTION_STEP_INDEXES = new Set<number>([
  TOUR_STEP.NAV_TEMPLATES,
  TOUR_STEP.CREATE_TEMPLATE,
  // MANUAL_IMPORT + IMPORT_UPLOAD: route / file-select own advancement
  TOUR_STEP.IMPORT_CONTINUE_UPLOAD,
  TOUR_STEP.IMPORT_CONTINUE_MAP,
  TOUR_STEP.IMPORT_CREATE,
  TOUR_STEP.IMPORT_OPEN,
  TOUR_STEP.COLLAPSE_ITEMS,
  TOUR_STEP.COLLAPSE_SECTIONS,
]);

/** Steps that navigate away — route sync owns the next index; skip click advance. */
const ROUTE_OWNED_ADVANCE = new Set<number>([TOUR_STEP.MANUAL_IMPORT]);

function buildSteps(): Step[] {
  const actionOptions = {
    skipBeacon: true,
    blockTargetInteraction: false,
    disableFocusTrap: true,
    overlayClickAction: false as const,
    buttons: ["skip", "primary"] as Step["buttons"],
    targetWaitTimeout: 120_000,
    locale: {
      skip: "Skip tour",
      next: "Next",
      last: "Done",
    },
  };

  const infoOptions = {
    skipBeacon: true,
    blockTargetInteraction: false,
    disableFocusTrap: true,
    overlayClickAction: false as const,
    buttons: ["back", "skip", "primary"] as Step["buttons"],
    targetWaitTimeout: 30_000,
    locale: {
      skip: "Skip tour",
      next: "Next",
      last: "Done",
      back: "Back",
    },
  };

  return [
    {
      target: '[data-tour="nav-templates"]',
      title: "My Templates",
      content:
        "Start here. Click My Templates to open your template library.",
      placement: "right",
      ...actionOptions,
      buttons: ["skip"],
    },
    {
      target: '[data-tour="create-template"]',
      title: "Create a template",
      content: "Click Create Template to choose how you want to import.",
      placement: "bottom",
      ...actionOptions,
      buttons: ["skip"],
    },
    {
      target: '[data-tour="create-mode-manual"]',
      title: "Manual import",
      content:
        "Choose Manual Import to upload a CSV or Excel file and map columns yourself.",
      placement: "left",
      ...actionOptions,
      buttons: ["skip"],
    },
    {
      target: '[data-tour="import-upload"]',
      title: "Upload your file",
      content:
        "Select or drop your CSV or Excel file. The tour continues after a file is uploaded.",
      placement: "bottom",
      ...actionOptions,
      buttons: ["skip"],
    },
    {
      target: '[data-tour="import-confirm"]',
      title: "Confirm ownership",
      content:
        "Check this box to confirm you own or are authorized to use this data.",
      placement: "top",
      ...actionOptions,
      buttons: ["skip"],
    },
    {
      target: '[data-tour="import-continue"]',
      title: "Continue to mapping",
      content: "Click Continue to Mapping to proceed to column mapping.",
      placement: "top",
      ...actionOptions,
      buttons: ["skip"],
    },
    {
      target: '[data-tour="import-continue-map"]',
      title: "Review column mapping",
      content:
        "Adjust any column mappings if needed, then click Continue.",
      placement: "top",
      ...actionOptions,
      buttons: ["skip"],
      targetWaitTimeout: 180_000,
    },
    {
      target: '[data-tour="import-create"]',
      title: "Name and create",
      content: "Give your template a name, then click Create Template.",
      placement: "top",
      ...actionOptions,
      buttons: ["skip"],
    },
    {
      target: '[data-tour="import-open"]',
      title: "Open your template",
      content: "Import is done. Click Open template to explore the editor.",
      placement: "top",
      ...actionOptions,
      buttons: ["skip"],
      targetWaitTimeout: 180_000,
    },
    {
      target: '[data-tour="collapse-items"]',
      title: "Collapse items",
      content:
        "Click the Items header to collapse the items pane and free up space.",
      placement: "right",
      ...actionOptions,
      buttons: ["skip"],
    },
    {
      target: '[data-tour="collapse-sections"]',
      title: "Collapse sections",
      content:
        "Click the Sections header to collapse the sections pane the same way.",
      placement: "right",
      ...actionOptions,
      buttons: ["skip"],
    },
    {
      target: "body",
      title: "You're all set",
      content: "Enjoy the app — explore templates, edit content, and build your workflow.",
      placement: "center",
      ...infoOptions,
      buttons: ["primary"],
      locale: {
        last: "Done",
      },
    },
  ];
}

export function OnboardingTour() {
  const { run, stepIndex, setStepIndex, stopTour, advanceStep } =
    useOnboardingTour();

  const steps = useMemo(() => buildSteps(), []);

  useEffect(() => {
    if (!run) return;
    if (!ACTION_STEP_INDEXES.has(stepIndex)) return;
    if (ROUTE_OWNED_ADVANCE.has(stepIndex)) return;

    const step = steps[stepIndex];
    if (!step || typeof step.target !== "string") return;

    const selector = step.target;

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest(selector)) return;

      window.setTimeout(() => {
        if (stepIndex >= TOUR_STEP_COUNT - 1) {
          stopTour(true);
          return;
        }
        advanceStep();
      }, 280);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [run, stepIndex, steps, advanceStep, stopTour]);

  const handleEvent = (data: EventData, _controls: Controls) => {
    const { type, action, index, status, origin } = data;

    if (type === EVENTS.TOUR_END || status === STATUS.FINISHED) {
      stopTour(true);
      return;
    }

    if (status === STATUS.SKIPPED || action === ACTIONS.SKIP) {
      stopTour(true);
      return;
    }

    if (
      type === EVENTS.STEP_AFTER &&
      (action === ACTIONS.CLOSE || origin === ORIGIN.BUTTON_CLOSE)
    ) {
      if (ACTION_STEP_INDEXES.has(index)) {
        return;
      }
      stopTour(true);
      return;
    }

    if (type !== EVENTS.STEP_AFTER) return;

    if (action === ACTIONS.NEXT || action === ACTIONS.CLOSE) {
      if (index >= TOUR_STEP_COUNT - 1) {
        stopTour(true);
        return;
      }
      setStepIndex(index + 1);
      return;
    }

    if (action === ACTIONS.PREV) {
      setStepIndex(Math.max(0, index - 1));
    }
  };

  return (
    <Joyride
      continuous
      run={run}
      stepIndex={stepIndex}
      steps={steps}
      scrollToFirstStep
      onEvent={handleEvent}
      options={{
        skipBeacon: true,
        overlayClickAction: false,
        blockTargetInteraction: false,
        primaryColor: "#0f172a",
        zIndex: 10000,
        showProgress: true,
      }}
    />
  );
}
