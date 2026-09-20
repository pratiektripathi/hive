import {
  Brain,
  Check,
  FileText,
  Plus,
  Sparkles,
  Upload,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type CreateTemplateMode = "ai-import" | "manual-import" | "scratch";

type CreateTemplateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (mode: CreateTemplateMode) => void;
  busy?: boolean;
};

const OPTIONS: {
  mode: CreateTemplateMode;
  title: string;
  description: string;
  features: string[];
  buttonLabel: string;
  recommended?: boolean;
  icon: typeof Brain;
  iconWrapClass: string;
  iconClass: string;
  buttonIcon: typeof Wand2;
  cardClass?: string;
  buttonClass?: string;
  buttonVariant?: "default" | "outline";
}[] = [
  {
    mode: "ai-import",
    title: "AI-Powered Import",
    description:
      "Upload your CSV or Excel file and let AI smartly import your template.",
    features: [
      "CSV & Excel support",
      "Smart field mapping",
      "Automatic structure",
    ],
    buttonLabel: "Start AI Import",
    recommended: true,
    icon: Brain,
    iconWrapClass: "bg-violet-100 dark:bg-violet-950/50",
    iconClass: "text-violet-600 dark:text-violet-400",
    buttonIcon: Wand2,
    cardClass:
      "border-violet-300 bg-violet-50/80 dark:border-violet-500 dark:bg-violet-950/40",
    buttonClass:
      "bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-600 dark:text-white dark:hover:bg-violet-500",
    buttonVariant: "default",
  },
  {
    mode: "manual-import",
    title: "Manual CSV Import",
    description:
      "Import from CSV or Excel and map every column yourself — no AI, fully deterministic",
    features: ["Full mapping control", "Defect levels, tags & variables"],
    buttonLabel: "Manual Import",
    icon: Upload,
    iconWrapClass: "bg-sky-100 dark:bg-sky-950/50",
    iconClass: "text-sky-600 dark:text-sky-400",
    buttonIcon: FileText,
    cardClass: "border-border bg-card dark:border-slate-600",
    buttonClass:
      "border-border bg-secondary text-secondary-foreground hover:bg-secondary/80 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700",
    buttonVariant: "outline",
  },
  {
    mode: "scratch",
    title: "Create from Scratch",
    description: "Build your template manually using our intuitive form builder",
    features: ["Full customization", "Step-by-step builder", "Complete control"],
    buttonLabel: "Start Building",
    icon: Plus,
    iconWrapClass: "bg-emerald-100 dark:bg-emerald-950/50",
    iconClass: "text-emerald-600 dark:text-emerald-400",
    buttonIcon: Plus,
    cardClass: "border-border bg-card dark:border-slate-600",
    buttonClass:
      "border-border bg-secondary text-secondary-foreground hover:bg-secondary/80 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700",
    buttonVariant: "outline",
  },
];

export function CreateTemplateDialog({
  open,
  onOpenChange,
  onSelect,
  busy = false,
}: CreateTemplateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-4xl"
        showCloseButton
      >
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle>Create Template</DialogTitle>
          <DialogDescription>
            Choose how you want to create your new template.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 pt-2 sm:grid-cols-3">
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            const ButtonIcon = option.buttonIcon;

            return (
              <div
                key={option.mode}
                className={cn(
                  "relative flex flex-col rounded-xl border bg-card p-5 text-center text-card-foreground",
                  option.cardClass,
                  option.recommended && "pt-7"
                )}
              >
                {option.recommended && (
                  <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-violet-600 px-2.5 py-0.5 text-xs font-medium text-white">
                    <Sparkles className="size-3" />
                    Recommended
                  </span>
                )}

                <div
                  className={cn(
                    "mx-auto mb-4 flex size-12 items-center justify-center rounded-full",
                    option.iconWrapClass
                  )}
                >
                  <Icon className={cn("size-6", option.iconClass)} />
                </div>

                <h3 className="text-base font-semibold text-foreground">
                  {option.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {option.description}
                </p>

                <ul className="mx-auto mt-4 flex w-fit flex-1 flex-col gap-2 text-left text-sm text-muted-foreground">
                  {option.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  type="button"
                  variant={option.buttonVariant}
                  className={cn("mt-5 w-full", option.buttonClass)}
                  disabled={busy}
                  onClick={() => onSelect(option.mode)}
                >
                  <ButtonIcon />
                  {busy && option.mode === "scratch"
                    ? "Creating..."
                    : option.buttonLabel}
                </Button>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
