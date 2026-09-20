import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  FileSpreadsheet,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  applyImport,
  aiSuggestMappings,
  listImportFields,
  listRecommendationOptions,
  parseImportFile,
  type ColumnMapping,
  type ImportField,
  type ImportStats,
  type ParseImportResult,
  type RecommendationMapping,
} from "@/lib/imports";
import { RECOMMENDATIONS } from "@/lib/templates";
import {
  TOUR_STEP,
  useOnboardingTour,
} from "@/contexts/OnboardingTourContext";

type WizardStep = "upload" | "parse" | "map" | "configure" | "complete";
type ImportWizardMode = "manual" | "ai";

const STEPS: { id: WizardStep; label: string }[] = [
  { id: "upload", label: "Upload" },
  { id: "parse", label: "Parse" },
  { id: "map", label: "Map Columns" },
  { id: "configure", label: "Configure" },
  { id: "complete", label: "Complete" },
];

type MappingRow = {
  id: string;
  sourceColumn: string;
  mapsTo: string | null;
  sample: string;
};

type RecommendationRow = {
  id: string;
  sourceValue: string;
  mapsTo: string | null;
};

function stepIndex(step: WizardStep) {
  return STEPS.findIndex((s) => s.id === step);
}

function defaultNameFromFile(filename: string) {
  return filename.replace(/\.(xlsx|xls|csv|tsv)$/i, "").trim() || "Imported Template";
}

function sampleForColumn(
  samples: Record<string, string[]> | undefined,
  column: string
) {
  const values = samples?.[column] || [];
  const first = values.find((v) => v && v.trim());
  return first?.trim() || "empty";
}

function groupFields(fields: ImportField[]) {
  const groups = new Map<string, ImportField[]>();
  for (const field of fields) {
    const list = groups.get(field.group) || [];
    list.push(field);
    groups.set(field.group, list);
  }
  return Array.from(groups.entries());
}

export default function ManualCsvImport({
  mode = "manual",
}: {
  mode?: ImportWizardMode;
}) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isAiMode = mode === "ai";
  const { run: tourRunning, stepIndex: tourStepIndex, advanceStep } =
    useOnboardingTour();

  const [step, setStep] = useState<WizardStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [owned, setOwned] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiBanner, setAiBanner] = useState<string | null>(null);
  const [aiUsed, setAiUsed] = useState(false);
  const [fields, setFields] = useState<ImportField[]>([]);
  const [recommendationOptions, setRecommendationOptions] = useState<string[]>([
    ...RECOMMENDATIONS,
  ]);
  const [parsed, setParsed] = useState<ParseImportResult | null>(null);
  const [mappingRows, setMappingRows] = useState<MappingRow[]>([]);
  const [recommendationRows, setRecommendationRows] = useState<RecommendationRow[]>(
    []
  );
  const [templateName, setTemplateName] = useState("");
  const [description, setDescription] = useState("");
  const [applying, setApplying] = useState(false);
  const [resultTemplateId, setResultTemplateId] = useState<string | null>(null);
  const [resultCounts, setResultCounts] = useState<ImportStats | null>(null);
  const [importExtra, setImportExtra] = useState<{
    comments: number;
    images: number;
    warnings: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [catalog, recommendations] = await Promise.all([
          listImportFields(),
          listRecommendationOptions().catch(() => [...RECOMMENDATIONS]),
        ]);
        if (!cancelled) {
          setFields(catalog);
          setRecommendationOptions(recommendations);
        }
      } catch {
        if (!cancelled) setError("Failed to load import field catalog.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const currentStepNumber = stepIndex(step) + 1;
  const progressValue = (currentStepNumber / STEPS.length) * 100;
  const mappableFields = useMemo(
    () => fields.filter((field) => field.key !== "skip"),
    [fields]
  );
  const fieldGroups = useMemo(() => groupFields(mappableFields), [mappableFields]);
  const fieldLabelByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const field of mappableFields) map.set(field.key, field.label);
    return map;
  }, [mappableFields]);

  const usedMapsTo = useMemo(() => {
    const used = new Set<string>();
    for (const row of mappingRows) {
      if (row.mapsTo) used.add(row.mapsTo);
    }
    return used;
  }, [mappingRows]);

  const mappedSourceColumns = useMemo(
    () => new Set(mappingRows.map((row) => row.sourceColumn)),
    [mappingRows]
  );

  const unmappedColumns = useMemo(() => {
    if (!parsed) return [];
    return parsed.headers.filter((header) => !mappedSourceColumns.has(header));
  }, [parsed, mappedSourceColumns]);

  const canContinueUpload = Boolean(file) && owned;

  const acceptFile = useCallback(
    (next: File | null) => {
      if (!next) return;
      const lower = next.name.toLowerCase();
      if (!/\.(csv|tsv|xlsx|xls)$/.test(lower)) {
        setError("Please select a CSV or Excel file (.csv, .xlsx, .xls).");
        return;
      }
      setError(null);
      setFile(next);
      setTemplateName(defaultNameFromFile(next.name));

      if (tourRunning && tourStepIndex === TOUR_STEP.IMPORT_UPLOAD) {
        advanceStep();
      }
    },
    [tourRunning, tourStepIndex, advanceStep]
  );

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) acceptFile(dropped);
  };

  const runParse = async () => {
    if (!file) return;
    setError(null);
    setAiBanner(null);
    setAiUsed(false);
    setStep("parse");
    try {
      const result = await parseImportFile(file);
      let mappings = result.suggestedMappings;
      let recommendationMappings = result.suggestedRecommendationMappings || [];

      if (isAiMode) {
        try {
          const ai = await aiSuggestMappings(result.importSessionId);
          mappings = ai.suggestedMappings;
          recommendationMappings = ai.suggestedRecommendationMappings || [];
          setAiUsed(Boolean(ai.usedAi));
          if (ai.usedAi) {
            setAiBanner(
              ai.reasoningSummary ||
                "Mappings suggested by AI — review and continue."
            );
          } else {
            setAiBanner(
              ai.reasoningSummary ||
                "AI unavailable — using automatic heuristics. Review mappings before importing."
            );
          }
        } catch {
          setAiBanner(
            "AI suggest failed — using automatic heuristics. Review mappings before importing."
          );
        }
      }

      setParsed(result);
      setTemplateName(defaultNameFromFile(result.sourceFileName));
      setMappingRows(
        mappings
          .filter((mapping) => mapping.mapsTo && mapping.mapsTo !== "skip")
          .map((mapping, index) => ({
            id: `${index}-${mapping.sourceColumn}`,
            sourceColumn: mapping.sourceColumn,
            mapsTo: mapping.mapsTo,
            sample: sampleForColumn(result.samples, mapping.sourceColumn),
          }))
      );
      setRecommendationRows(
        recommendationMappings.map((mapping, index) => ({
          id: `rec-${index}-${mapping.sourceValue}`,
          sourceValue: mapping.sourceValue,
          mapsTo: mapping.mapsTo,
        }))
      );
      setStep("map");
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to parse file.";
      setError(typeof detail === "string" ? detail : "Failed to parse file.");
      setStep("upload");
    }
  };

  const updateMapping = (id: string, mapsTo: string | null) => {
    setMappingRows((rows) =>
      rows.map((row) => (row.id === id ? { ...row, mapsTo } : row))
    );
  };

  const removeMapping = (id: string) => {
    setMappingRows((rows) => rows.filter((row) => row.id !== id));
  };

  const addUnmappedColumn = (sourceColumn: string) => {
    if (!parsed || !sourceColumn || mappedSourceColumns.has(sourceColumn)) return;
    setMappingRows((rows) => [
      ...rows,
      {
        id: `${Date.now()}-${sourceColumn}`,
        sourceColumn,
        mapsTo: null,
        sample: sampleForColumn(parsed.samples, sourceColumn),
      },
    ]);
  };

  const updateRecommendationMapping = (id: string, mapsTo: string | null) => {
    setRecommendationRows((rows) =>
      rows.map((row) => (row.id === id ? { ...row, mapsTo } : row))
    );
  };

  const removeRecommendationMapping = (id: string) => {
    setRecommendationRows((rows) => rows.filter((row) => row.id !== id));
  };

  const runApply = async () => {
    if (!parsed) return;
    const name = templateName.trim();
    if (!name) {
      setError("Template name is required.");
      return;
    }
    setApplying(true);
    setError(null);
    try {
      const mappings: ColumnMapping[] = mappingRows.map((row) => ({
        sourceColumn: row.sourceColumn,
        mapsTo: row.mapsTo,
      }));
      const recommendationMappings: RecommendationMapping[] = recommendationRows.map(
        (row) => ({
          sourceValue: row.sourceValue,
          mapsTo: row.mapsTo,
        })
      );
      const result = await applyImport({
        importSessionId: parsed.importSessionId,
        mappings,
        recommendationMappings,
        templateName: name,
        description: description.trim() || undefined,
        importMethod: isAiMode ? (aiUsed ? "ai" : "hybrid") : "parser",
      });
      setResultTemplateId(result.templateId);
      setResultCounts({
        totalRows: result.counts.totalRows,
        estSections: result.counts.sections,
        estLineItems: result.counts.lineItems,
        estComments: result.counts.comments,
      });
      setImportExtra({
        comments: result.counts.comments,
        images: result.counts.images,
        warnings: result.counts.warnings,
      });
      setStep("complete");
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Import failed.";
      setError(typeof detail === "string" ? detail : "Import failed.");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="relative flex shrink-0 items-center px-2 py-1">
        <Button
          type="button"
          variant="outline"
          className="relative z-10 h-8"
          onClick={() => navigate("/templates")}
        >
          <ChevronLeft />
          Templates
        </Button>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-36">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="size-5 shrink-0" />
            <h1 className="text-xl font-normal leading-none">
              {isAiMode ? "AI-Powered Import" : "Manual CSV Import"}
            </h1>
          </div>
        </div>
      </header>
      <Separator />

      <div className="mx-auto mt-5 w-full max-w-5xl px-3">
        <p className="mb-4 text-sm text-muted-foreground">
          {isAiMode
            ? "Upload your CSV or Excel file. AI suggests column mappings on the server — review them, then import."
            : "Upload your CSV or Excel file and map each column to a template field."}
        </p>

        {aiBanner ? (
          <div className="mb-4 rounded-md border border-violet-300 bg-violet-50 px-3 py-2 text-sm text-violet-900 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-100">
            {aiBanner}
          </div>
        ) : null}
        <div className="mb-6 rounded-lg border bg-card p-4">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Import Progress</span>
            <span>
              {currentStepNumber}/{STEPS.length}
            </span>
          </div>
          <Progress value={progressValue} className="h-2" />
          <div className="mt-3 grid grid-cols-5 gap-2 text-center text-[11px] sm:text-xs">
            {STEPS.map((item, index) => {
              const active = index === stepIndex(step);
              const done = index < stepIndex(step);
              return (
                <div
                  key={item.id}
                  className={cn(
                    "truncate font-medium",
                    active && "text-primary",
                    done && "text-foreground",
                    !active && !done && "text-muted-foreground"
                  )}
                >
                  {item.label}
                </div>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

      {step === "upload" && (
        <div className="flex flex-1 flex-col">
          <div
            className={cn(
              "flex flex-1 flex-col items-center justify-center rounded-lg border-2 border-dashed bg-card px-6 py-16 text-center transition-colors",
              dragging
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25"
            )}
            data-tour="import-upload"
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <Upload className="mb-4 size-12 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Upload Your Data File</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Drop your CSV or Excel file (.csv, .xlsx, .xls). You&apos;ll map each
              column to a template field in the next step.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
              <span>Drop your file here or</span>
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
              >
                Select File
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,.xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                className="hidden"
                onChange={(event) => acceptFile(event.target.files?.[0] || null)}
              />
            </div>
            {file && (
              <p className="mt-4 text-sm font-medium text-foreground">
                Selected: {file.name}
              </p>
            )}
          </div>

          <label
            className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-900/50 dark:bg-amber-950/30"
            data-tour="import-confirm"
          >
            <Checkbox
              checked={owned}
              onCheckedChange={(value) => {
                const next = value === true;
                setOwned(next);
                if (
                  next &&
                  tourRunning &&
                  tourStepIndex === TOUR_STEP.IMPORT_CONFIRM
                ) {
                  advanceStep();
                }
              }}
              className="mt-0.5"
            />
            <span>
              I confirm that I own or have authorization to use this template.
            </span>
          </label>

          <div className="mt-6 flex items-center justify-between gap-3">
            <Button type="button" variant="outline" onClick={() => navigate("/templates")}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!canContinueUpload}
              onClick={runParse}
              data-tour="import-continue"
            >
              Continue to Mapping
              <ArrowRight className="ml-1.5 size-4" />
            </Button>
          </div>
        </div>
      )}

      {step === "parse" && (
        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border bg-card px-6 py-20 text-center">
          <Loader2 className="mb-4 size-12 animate-spin text-primary" />
          <h2 className="text-lg font-semibold">Parsing your file...</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Reading your columns and preparing sensible starting mappings for you to
            review.
          </p>
          {file && (
            <p className="mt-4 text-sm text-muted-foreground">
              Processing {file.name}
            </p>
          )}
        </div>
      )}

      {step === "map" && parsed && (
        <div className="flex flex-1 flex-col">
          <div className="mb-4 grid grid-cols-3 gap-3">
            {[
              { label: "Total Rows", value: parsed.stats.totalRows },
              { label: "Est. Sections", value: parsed.stats.estSections },
              { label: "Est. Line Items", value: parsed.stats.estLineItems },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-lg border bg-card px-4 py-3 text-center"
              >
                <div className="text-2xl font-semibold tabular-nums">{card.value}</div>
                <div className="text-xs text-muted-foreground">{card.label}</div>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-lg border bg-card">
            <div className="border-b px-4 py-3">
              <h2 className="font-semibold">Column Mapping</h2>
              <p className="text-xs text-muted-foreground">
                Photos and captions map to the images table. Remote photo URLs are
                downloaded; the local file is stored in image URL and the original
                source is kept in import URL.
              </p>
            </div>
            <div className="hidden grid-cols-[1.2fr_auto_1.2fr_0.9fr_auto] gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground sm:grid">
              <span>Source Column</span>
              <span />
              <span>Maps To</span>
              <span>Sample Value</span>
              <span className="text-right">Actions</span>
            </div>
            <div className="max-h-[48vh] divide-y overflow-auto">
              {mappingRows.map((row) => (
                <div
                  key={row.id}
                  className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-[1.2fr_auto_1.2fr_0.9fr_auto] sm:items-center sm:gap-3"
                >
                  <Select
                    value={row.sourceColumn}
                    onValueChange={(value) => {
                      setMappingRows((rows) =>
                        rows.map((item) =>
                          item.id === row.id
                            ? {
                                ...item,
                                sourceColumn: value,
                                sample: sampleForColumn(parsed.samples, value),
                              }
                            : item
                        )
                      );
                    }}
                  >
                    <SelectTrigger className="w-full min-w-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[row.sourceColumn, ...unmappedColumns].map((header) => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="hidden justify-center text-muted-foreground sm:flex">
                    →
                  </div>

                  <Select
                    value={row.mapsTo ?? undefined}
                    onValueChange={(value) => updateMapping(row.id, value)}
                  >
                    <SelectTrigger className="w-full min-w-0">
                      <SelectValue
                        placeholder="Select field"
                        aria-label={
                          row.mapsTo
                            ? fieldLabelByKey.get(row.mapsTo) || row.mapsTo
                            : "Select field"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {fieldGroups.map(([group, groupFieldsList]) => (
                        <SelectGroup key={group}>
                          <SelectLabel>{group}</SelectLabel>
                          {groupFieldsList.map((field) => {
                            const taken =
                              usedMapsTo.has(field.key) && row.mapsTo !== field.key;
                            return (
                              <SelectItem
                                key={field.key}
                                value={field.key}
                                disabled={taken}
                              >
                                {field.label}
                              </SelectItem>
                            );
                          })}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="truncate rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    {row.sample}
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove mapping"
                      onClick={() => removeMapping(row.id)}
                    >
                      <Trash2 className="size-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {unmappedColumns.length > 0 && (
              <div className="border-t px-4 py-3">
                <Select
                  key={unmappedColumns.join("\0")}
                  onValueChange={(value) => {
                    if (value) addUnmappedColumn(value);
                  }}
                >
                  <SelectTrigger className="w-full max-w-sm border-dashed bg-background">
                    <SelectValue placeholder="+ Add unmapped column..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Unmapped CSV Columns</SelectLabel>
                      {unmappedColumns.map((header) => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {recommendationRows.length > 0 && (
            <div className="mt-4 overflow-hidden rounded-lg border bg-card">
              <div className="border-b px-4 py-3">
                <h2 className="font-semibold">Recommendation Mapping</h2>
                <p className="text-xs text-muted-foreground">
                  Map Excel recommendation values to Hive recommendation options.
                  Closest matches are pre-selected.
                </p>
              </div>
              <div className="hidden grid-cols-[1.2fr_auto_1.4fr_auto] gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground sm:grid">
                <span>Excel Value</span>
                <span />
                <span>Maps To</span>
                <span className="text-right">Actions</span>
              </div>
              <div className="max-h-[36vh] divide-y overflow-auto">
                {recommendationRows.map((row) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-[1.2fr_auto_1.4fr_auto] sm:items-center sm:gap-3"
                  >
                    <div className="truncate rounded-md border bg-muted/30 px-3 py-2 text-sm">
                      {row.sourceValue}
                    </div>
                    <div className="hidden justify-center text-muted-foreground sm:flex">
                      →
                    </div>
                    <Select
                      value={row.mapsTo ?? undefined}
                      onValueChange={(value) =>
                        updateRecommendationMapping(row.id, value)
                      }
                    >
                      <SelectTrigger className="w-full min-w-0">
                        <SelectValue placeholder="Select recommendation" />
                      </SelectTrigger>
                      <SelectContent>
                        {recommendationOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Remove recommendation mapping"
                        onClick={() => removeRecommendationMapping(row.id)}
                      >
                        <Trash2 className="size-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between gap-3">
            <Button type="button" variant="outline" onClick={() => setStep("upload")}>
              Back
            </Button>
            <Button
              type="button"
              onClick={() => setStep("configure")}
              data-tour="import-continue-map"
            >
              Continue
              <ArrowRight className="ml-1.5 size-4" />
            </Button>
          </div>
        </div>
      )}

      {step === "configure" && parsed && (
        <div className="flex flex-1 flex-col">
          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold">Configure Import</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Name your template and confirm the import summary before creating it.
            </p>

            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="template-name">Template name</Label>
                <Input
                  id="template-name"
                  value={templateName}
                  onChange={(event) => setTemplateName(event.target.value)}
                  placeholder="Imported Template"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-description">Description (optional)</Label>
                <Input
                  id="template-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Imported from Spectora export"
                />
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Rows", value: parsed.stats.totalRows },
                { label: "Sections", value: parsed.stats.estSections },
                { label: "Line Items", value: parsed.stats.estLineItems },
                {
                  label: "Mapped columns",
                  value: mappingRows.filter((row) => row.mapsTo).length,
                },
              ].map((card) => (
                <div
                  key={card.label}
                  className="rounded-lg border bg-muted/20 px-3 py-3 text-center"
                >
                  <div className="text-xl font-semibold tabular-nums">{card.value}</div>
                  <div className="text-xs text-muted-foreground">{card.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between gap-3">
            <Button type="button" variant="outline" onClick={() => setStep("map")}>
              Back
            </Button>
            <Button
              type="button"
              disabled={applying || !templateName.trim()}
              onClick={runApply}
              data-tour="import-create"
            >
              {applying ? (
                <>
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  Create Template
                  <ArrowRight className="ml-1.5 size-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {step === "complete" && resultTemplateId && (
        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border bg-card px-6 py-16 text-center">
          <CheckCircle2 className="mb-4 size-14 text-primary" />
          <h2 className="text-xl font-semibold">Import complete</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{templateName}</span> was
            created from {parsed?.sourceFileName}.
          </p>
          {resultCounts && (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Sections", value: resultCounts.estSections },
                { label: "Line Items", value: resultCounts.estLineItems },
                { label: "Comments", value: importExtra?.comments ?? 0 },
                { label: "Images", value: importExtra?.images ?? 0 },
              ].map((card) => (
                <div
                  key={card.label}
                  className="rounded-lg border px-4 py-3 text-center"
                >
                  <div className="text-xl font-semibold tabular-nums">{card.value}</div>
                  <div className="text-xs text-muted-foreground">{card.label}</div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/templates")}
            >
              Back to templates
            </Button>
            <Button
              type="button"
              onClick={() =>
                navigate(`/templates/${resultTemplateId}`, {
                  state: { name: templateName },
                })
              }
              data-tour="import-open"
            >
              Open template
            </Button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
