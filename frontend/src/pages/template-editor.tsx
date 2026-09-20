import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  AirVent,
  AlignJustify,
  Armchair,
  ArrowUpDown,
  Bath,
  Bed,
  BetweenVerticalEnd,
  BookOpen,
  BrickWall,
  BrickWallFire,
  Building2,
  Calendar,
  Car,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleMinus,
  CircleOff,
  ClipboardList,
  CookingPot,
  Copy,
  Cylinder,
  Download,
  Droplets,
  Fence,
  FileText,
  Flame,
  Hash,
  Home,
  LampDesk,
  Layers,
  Leaf,
  Loader2,
  PanelTop,
  Pencil,
  PenLine,
  Plug,
  Plus,
  Refrigerator,
  Scissors,
  Snowflake,
  Sofa,
  SquareCheck,
  Table,
  Toilet,
  Trash2,
  TriangleAlert,
  Warehouse,
  Wand2,
  WashingMachine,
  Waves,
  Wind,
  Wrench,
  Zap,
  Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  RichTextEditor,
  type RichTextValue,
} from "@/components/rich-text-editor";
import { cn } from "@/lib/utils";
import {
  RECOMMENDATIONS,
  assistCommentWithAi,
  deleteCommentImage,
  downloadBlob,
  exportTemplate,
  getTemplate,
  listTemplates,
  resolveImageUrl,
  saveTemplate,
  updateCommentImageCaption,
  uploadCommentImage,
  type CommentDefaultPhoto,
  type CommentType,
  type DefectCategory,
  type TemplateComment,
  type TemplateExportFormat,
  type TemplateItem,
  type TemplateRow,
  type TemplateSection,
} from "@/lib/templates";

const EMPTY_SOP: RichTextValue = [{ type: "p", children: [{ text: "" }] }];

function richTextFromPlain(text: string | null | undefined): RichTextValue {
  const raw = (text || "").trim();
  if (!raw) return EMPTY_SOP;
  const paragraphs = raw.split(/\n{2,}|\r\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (!paragraphs.length) return EMPTY_SOP;
  return paragraphs.map((paragraph) => ({
    type: "p",
    children: [{ text: paragraph.replace(/\n/g, " ") }],
  }));
}

function plainFromRichText(value: RichTextValue | undefined | null): string {
  if (!value || !Array.isArray(value)) return "";
  const parts: string[] = [];
  const walk = (nodes: unknown[]) => {
    for (const node of nodes) {
      if (!node || typeof node !== "object") continue;
      const record = node as { text?: string; children?: unknown[]; type?: string };
      if (typeof record.text === "string" && record.text) parts.push(record.text);
      if (Array.isArray(record.children)) walk(record.children);
      if (record.type === "p" || record.type === "h1" || record.type === "h2") {
        parts.push("\n");
      }
    }
  };
  walk(value);
  return parts.join("").replace(/\n{3,}/g, "\n\n").trim();
}
const SECTION_ICONS = [
  { id: "none", label: "No Icon", Icon: CircleOff },
  { id: "report", label: "Report", Icon: FileText },
  { id: "clipboard", label: "Inspection", Icon: ClipboardList },
  { id: "home", label: "Home", Icon: Home },
  { id: "roof", label: "Roof", Icon: PanelTop },
  { id: "flame", label: "Flame", Icon: Flame },
  { id: "chimney", label: "Chimney", Icon: BrickWallFire },
  { id: "building", label: "Building", Icon: Building2 },
  { id: "wall", label: "Wall", Icon: BrickWall },
  { id: "car", label: "Car", Icon: Car },
  { id: "garage", label: "Garage", Icon: Warehouse },
  { id: "layers", label: "Structure", Icon: Layers },
  { id: "stairs", label: "Stairs", Icon: BetweenVerticalEnd },
  { id: "snowflake", label: "Snowflake", Icon: Snowflake },
  { id: "droplets", label: "Plumbing", Icon: Droplets },
  { id: "pipe", label: "Pipe", Icon: Cylinder },
  { id: "zap", label: "Electrical", Icon: Zap },
  { id: "socket", label: "Socket", Icon: Plug },
  { id: "wind", label: "Ventilation", Icon: Wind },
  { id: "exhaust", label: "Exhaust", Icon: AirVent },
  { id: "fridge", label: "Fridge", Icon: Refrigerator },
  { id: "cooktop", label: "Cook Top", Icon: CookingPot },
  { id: "washing-machine", label: "Washing Machine", Icon: WashingMachine },
  { id: "toilet", label: "Toilet", Icon: Toilet },
  { id: "towel-holder", label: "Towel Holder", Icon: Bath },
  { id: "bed", label: "Bed", Icon: Bed },
  { id: "sofa", label: "Sofa", Icon: Sofa },
  { id: "chair", label: "Chair", Icon: Armchair },
  { id: "dining-table", label: "Dining Table", Icon: Table },
  { id: "computer-table", label: "Computer Table", Icon: LampDesk },
  { id: "books", label: "Books", Icon: BookOpen },
  { id: "fence", label: "Fence", Icon: Fence },
  { id: "swimming-pool", label: "Swimming Pool", Icon: Waves },
  { id: "grass", label: "Grass", Icon: Leaf },
  { id: "wrench", label: "Wrench", Icon: Wrench },
  { id: "scissors", label: "Scissors", Icon: Scissors },
] as const;

function getSectionIcon(id: string) {
  return SECTION_ICONS.find((item) => item.id === id)?.Icon ?? CircleOff;
}

type SectionEditorDraft = {
  id: string;
  title: string;
  icon: string;
  standardsOfPractice: RichTextValue;
  reminders: RichTextValue;
  mode: "create" | "edit";
};

type ItemEditorDraft = {
  id: string;
  title: string;
  reminders: RichTextValue;
  mode: "create" | "edit";
};

type CommentEditorDraft = {
  id: string;
  type: CommentType;
  answerFormat: string;
  choices: string;
  name: string;
  category: DefectCategory;
  recommendation: string;
  defaultChecked: boolean;
  defaultValue: string;
  defaultValue2: string;
  defaultLocation: string;
  defaultText: RichTextValue;
  nameError: boolean;
};

const ANSWER_FORMATS = [
  { id: "checkbox", label: "Checkbox (i.e. Yes/No, Present/Not Present)" },
  { id: "multiple", label: "Multiple Choices (i.e. checkboxes)" },
  { id: "date", label: "Date" },
  { id: "number", label: "Number" },
  { id: "numeric-range", label: "Numeric Range" },
  { id: "signature", label: "Signature" },
  { id: "text", label: "Text" },
] as const;

const DEFECT_ANSWER_FORMATS = ANSWER_FORMATS.filter(
  (format) => format.id === "checkbox" || format.id === "multiple"
);

const DEFECT_CATEGORIES: {
  id: DefectCategory;
  label: string;
  Icon: typeof Wrench;
  activeClass: string;
}[] = [
  {
    id: "low",
    label: "Low",
    Icon: Wrench,
    activeClass: "border-emerald-600 bg-emerald-600 text-white",
  },
  {
    id: "medium",
    label: "Medium",
    Icon: CircleMinus,
    activeClass: "border-amber-500 bg-amber-500 text-white",
  },
  {
    id: "high",
    label: "High",
    Icon: TriangleAlert,
    activeClass: "border-red-600 bg-red-600 text-white",
  },
];

const COMMENT_GROUPS: { type: CommentType; label: string }[] = [
  { type: "info", label: "Informational" },
  { type: "limit", label: "Limitations" },
  { type: "defect", label: "Defects" },
];

const COMMENT_TYPE_ICON_COLOR: Record<CommentType, string> = {
  info: "text-emerald-600",
  limit: "text-orange-500",
  defect: "text-red-600",
};

function CommentFormatIcon({
  format,
  type,
}: {
  format?: string;
  type: CommentType;
}) {
  const colorClass = COMMENT_TYPE_ICON_COLOR[type];
  const className = cn("size-4 shrink-0", colorClass);
  switch (format) {
    case "multiple":
      return <AlignJustify className={className} aria-hidden="true" />;
    case "date":
      return <Calendar className={className} aria-hidden="true" />;
    case "number":
    case "numeric-range":
      return <Hash className={className} aria-hidden="true" />;
    case "signature":
      return <PenLine className={className} aria-hidden="true" />;
    case "text":
      return (
        <span
          aria-hidden="true"
          className={cn(
            "flex size-4 shrink-0 items-center justify-center text-[15px] leading-none font-semibold",
            colorClass
          )}
        >
          A
        </span>
      );
    case "checkbox":
    default:
      return <SquareCheck className={className} aria-hidden="true" />;
  }
}

function templateNameFromLocation(state: unknown) {
  if (
    typeof state === "object" &&
    state &&
    "name" in state &&
    typeof state.name === "string" &&
    state.name.trim()
  ) {
    return state.name;
  }
  return "Template";
}

function duplicatedSectionFromLocation(state: unknown): TemplateSection | undefined {
  if (typeof state !== "object" || !state || !("duplicatedSection" in state)) {
    return undefined;
  }
  return (state as { duplicatedSection?: TemplateSection }).duplicatedSection;
}

function duplicatedItemFromLocation(state: unknown): {
  item: TemplateItem;
  sectionId?: string;
} | undefined {
  if (typeof state !== "object" || !state || !("duplicatedItem" in state)) {
    return undefined;
  }
  const payload = state as {
    duplicatedItem?: TemplateItem;
    targetSectionId?: string;
  };
  if (!payload.duplicatedItem) return undefined;
  return {
    item: payload.duplicatedItem,
    sectionId: payload.targetSectionId,
  };
}

function duplicatedCommentsFromLocation(state: unknown): {
  comments: TemplateComment[];
  sectionId?: string;
  itemId?: string;
} | undefined {
  if (typeof state !== "object" || !state) return undefined;
  const payload = state as {
    duplicatedComment?: TemplateComment;
    duplicatedComments?: TemplateComment[];
    targetSectionId?: string;
    targetItemId?: string;
  };
  const comments = payload.duplicatedComments?.length
    ? payload.duplicatedComments
    : payload.duplicatedComment
      ? [payload.duplicatedComment]
      : [];
  if (!comments.length) return undefined;
  return {
    comments,
    sectionId: payload.targetSectionId,
    itemId: payload.targetItemId,
  };
}

function nextId(_prefix?: string) {
  return crypto.randomUUID();
}

function cloneComment(comment: TemplateComment): TemplateComment {
  return { ...comment, id: nextId(), defaultPhotos: [] };
}

function cloneItem(item: TemplateItem): TemplateItem {
  return {
    ...item,
    id: nextId(),
    comments: item.comments.map((comment) => cloneComment(comment)),
  };
}

function insertItem(
  list: TemplateSection[],
  sectionId: string,
  item: TemplateItem,
  afterId?: string
) {
  return list.map((section) => {
    if (section.id !== sectionId) return section;
    const items = [...section.items];
    const index = afterId ? items.findIndex((row) => row.id === afterId) : -1;
    items.splice(index >= 0 ? index + 1 : items.length, 0, item);
    return { ...section, items };
  });
}

function insertComment(
  list: TemplateSection[],
  sectionId: string,
  itemId: string,
  comment: TemplateComment,
  afterId?: string
) {
  return insertComments(list, sectionId, itemId, [comment], afterId);
}

function insertComments(
  list: TemplateSection[],
  sectionId: string,
  itemId: string,
  commentsToInsert: TemplateComment[],
  afterId?: string
) {
  if (!commentsToInsert.length) return list;
  return list.map((section) => {
    if (section.id !== sectionId) return section;
    return {
      ...section,
      items: section.items.map((item) => {
        if (item.id !== itemId) return item;
        const comments = [...item.comments];
        const index = afterId ? comments.findIndex((row) => row.id === afterId) : -1;
        comments.splice(index >= 0 ? index + 1 : comments.length, 0, ...commentsToInsert);
        return { ...item, comments };
      }),
    };
  });
}

function removeItem(list: TemplateSection[], sectionId: string, itemId: string) {
  return list.map((section) =>
    section.id === sectionId
      ? { ...section, items: section.items.filter((item) => item.id !== itemId) }
      : section
  );
}

function removeComment(
  list: TemplateSection[],
  sectionId: string,
  itemId: string,
  commentId: string
) {
  return removeComments(list, sectionId, itemId, [commentId]);
}

function removeComments(
  list: TemplateSection[],
  sectionId: string,
  itemId: string,
  commentIds: string[]
) {
  const idSet = new Set(commentIds);
  return list.map((section) => {
    if (section.id !== sectionId) return section;
    return {
      ...section,
      items: section.items.map((item) =>
        item.id === itemId
          ? { ...item, comments: item.comments.filter((comment) => !idSet.has(comment.id)) }
          : item
      ),
    };
  });
}

function cloneSection(section: TemplateSection): TemplateSection {
  return {
    ...section,
    id: nextId(),
    items: section.items.map((item) => cloneItem(item)),
  };
}

function templateChoices(
  templates: TemplateRow[],
  templateId: string | undefined,
  currentName: string
) {
  const choices = templates.map((template) => ({
    id: template.id,
    name: template.id === templateId ? currentName : template.name,
  }));
  if (templateId && !choices.some((choice) => choice.id === templateId)) {
    choices.unshift({ id: templateId, name: currentName });
  }
  return choices;
}

type DragKind = "section" | "item" | "comment";
type DeleteKind = "section" | "item" | "comment";

type PendingDelete = {
  kind: DeleteKind;
  id: string;
  name: string;
  ids?: string[];
};

function deleteDialogCopy(pending: PendingDelete) {
  if (pending.kind === "section") {
    return {
      title: "Delete section?",
      description: `This will also delete all items and comments in “${pending.name}”. This cannot be undone.`,
    };
  }
  if (pending.kind === "item") {
    return {
      title: "Delete item?",
      description: `This will also delete all comments in “${pending.name}”. This cannot be undone.`,
    };
  }
  if (pending.ids && pending.ids.length > 1) {
    return {
      title: "Delete comments?",
      description: `This will permanently delete ${pending.ids.length} comments. This cannot be undone.`,
    };
  }
  return {
    title: "Delete comment?",
    description: `This will permanently delete “${pending.name}”. This cannot be undone.`,
  };
}

function reorderById<T extends { id: string }>(list: T[], fromId: string, toId: string) {
  const from = list.findIndex((row) => row.id === fromId);
  const to = list.findIndex((row) => row.id === toId);
  if (from < 0 || to < 0 || from === to) return list;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

function parseChoiceList(value?: string) {
  if (!value?.trim()) return [];
  return value
    .split(",")
    .map((choice) => choice.trim())
    .filter(Boolean);
}

function joinChoiceList(choices: string[]) {
  return choices
    .map((choice) => choice.trim())
    .filter(Boolean)
    .join(", ");
}

function reorderCommentsByType(
  comments: TemplateComment[],
  type: CommentType,
  fromId: string,
  toId: string
) {
  const typed = comments.filter((comment) => comment.type === type);
  const reordered = reorderById(typed, fromId, toId);
  let index = 0;
  return comments.map((comment) =>
    comment.type === type ? reordered[index++] : comment
  );
}

export default function TemplateEditor() {
  const { templateId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const initialName = templateNameFromLocation(location.state);
  const [title, setTitle] = useState(initialName);
  const [draft, setDraft] = useState(initialName);
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [sections, setSections] = useState<TemplateSection[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string | undefined>();
  const [selectedItemId, setSelectedItemId] = useState<string | undefined>();
  const [availableTemplates, setAvailableTemplates] = useState<TemplateRow[]>([]);
  const [transferSections, setTransferSections] = useState<TemplateSection[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkedCommentIds, setCheckedCommentIds] = useState<string[]>([]);
  const [dragging, setDragging] = useState<{ kind: DragKind; id: string } | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const skipClickAfterDrag = useRef(false);
  const skipNextSave = useRef(true);
  const [sectionEditor, setSectionEditor] = useState<SectionEditorDraft | null>(null);
  const [itemEditor, setItemEditor] = useState<ItemEditorDraft | null>(null);
  const [commentEditor, setCommentEditor] = useState<CommentEditorDraft | null>(null);
  const [duplicatingSection, setDuplicatingSection] = useState<TemplateSection | null>(null);
  const [duplicatingItem, setDuplicatingItem] = useState<TemplateItem | null>(null);
  const [movingItem, setMovingItem] = useState<TemplateItem | null>(null);
  const [duplicatingComments, setDuplicatingComments] = useState<TemplateComment[]>([]);
  const [movingComments, setMovingComments] = useState<TemplateComment[]>([]);
  const [duplicateToTemplateId, setDuplicateToTemplateId] = useState(
    templateId || "current"
  );
  const [duplicateCommentSectionId, setDuplicateCommentSectionId] = useState<string>();
  const [duplicateCommentItemId, setDuplicateCommentItemId] = useState<string>();
  const [duplicateItemSectionId, setDuplicateItemSectionId] = useState<string>();
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [expandedCommentId, setExpandedCommentId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const commentInputRef = useRef<HTMLInputElement>(null);
  const [sectionsCollapsed, setSectionsCollapsed] = useState(false);
  const [itemsCollapsed, setItemsCollapsed] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async (format: TemplateExportFormat) => {
    if (!templateId || exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      const blob = await exportTemplate(templateId, format);
      const safeName = (title || "template").replace(/[^\w.\- ]+/g, "").trim() || "template";
      const extension = format === "xlsx" ? "xlsx" : format;
      downloadBlob(blob, `${safeName}.${extension}`);
    } catch {
      setExportError("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const startRowDrag = (kind: DragKind, id: string, event: DragEvent) => {
    if ((event.target as HTMLElement).closest("[data-no-drag]")) {
      event.preventDefault();
      return;
    }
    skipClickAfterDrag.current = true;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);
    setDragging({ kind, id });
  };

  const endRowDrag = () => {
    setDragging(null);
    setOverId(null);
  };

  const onRowClick = (action: () => void) => {
    if (skipClickAfterDrag.current) {
      skipClickAfterDrag.current = false;
      return;
    }
    action();
  };

  useEffect(() => {
    let cancelled = false;
    listTemplates()
      .then((rows) => {
        if (!cancelled) setAvailableTemplates(rows);
      })
      .catch(() => {
        if (!cancelled) setAvailableTemplates([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!templateId) {
      setLoadError("Missing template id.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      skipNextSave.current = true;
      try {
        const detail = await getTemplate(templateId);
        if (cancelled) return;

        let nextSections = detail.sections ?? [];
        const incomingSection = duplicatedSectionFromLocation(location.state);
        const incomingItem = duplicatedItemFromLocation(location.state);
        const incomingComments = duplicatedCommentsFromLocation(location.state);

        if (incomingSection) {
          nextSections = [incomingSection, ...nextSections];
          setSelectedSectionId(incomingSection.id);
          setSelectedItemId(incomingSection.items[0]?.id);
        } else if (incomingItem) {
          const sectionId = incomingItem.sectionId || nextSections[0]?.id;
          if (sectionId) {
            nextSections = insertItem(nextSections, sectionId, incomingItem.item);
            setSelectedSectionId(sectionId);
            setSelectedItemId(incomingItem.item.id);
          }
        } else if (incomingComments) {
          const sectionId = incomingComments.sectionId || nextSections[0]?.id;
          const itemId =
            incomingComments.itemId ||
            nextSections.find((section) => section.id === sectionId)?.items[0]?.id ||
            nextSections[0]?.items[0]?.id;
          if (sectionId && itemId) {
            nextSections = insertComments(
              nextSections,
              sectionId,
              itemId,
              incomingComments.comments
            );
            setSelectedSectionId(sectionId);
            setSelectedItemId(itemId);
          }
        } else {
          setSelectedSectionId(nextSections[0]?.id);
          setSelectedItemId(nextSections[0]?.items[0]?.id);
        }

        const nameFromState = templateNameFromLocation(location.state);
        const nextTitle =
          nameFromState !== "Template" ? nameFromState : detail.name || "Template";
        setTitle(nextTitle);
        setDraft(nextTitle);
        setEditing(false);
        setSections(nextSections);
        setCheckedCommentIds([]);
        setDuplicateToTemplateId(templateId);

        if (incomingSection || incomingItem || incomingComments) {
          skipNextSave.current = false;
        }
      } catch {
        if (!cancelled) {
          setLoadError("Failed to load template.");
          setSections([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [templateId, location.state]);

  useEffect(() => {
    if (loading || !templateId) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    const handle = window.setTimeout(() => {
      void saveTemplate(templateId, { name: title, sections }).catch(() => {
        // Keep editing; transient save errors shouldn't block further saves.
      });
    }, 400);
    return () => window.clearTimeout(handle);
  }, [sections, title, templateId, loading]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  useEffect(() => {
    if (editingCommentId) {
      commentInputRef.current?.focus();
      commentInputRef.current?.select();
    }
  }, [editingCommentId]);

  const selectedSection = useMemo(
    () => sections.find((section) => section.id === selectedSectionId),
    [sections, selectedSectionId]
  );
  const selectedItem = useMemo(
    () => selectedSection?.items.find((item) => item.id === selectedItemId),
    [selectedSection, selectedItemId]
  );

  const resolveTransferSections = async (destinationId: string) => {
    const currentId = templateId || "current";
    if (destinationId === currentId) {
      setTransferSections(sections);
      return sections;
    }
    try {
      const detail = await getTemplate(destinationId);
      setTransferSections(detail.sections);
      return detail.sections;
    } catch {
      setTransferSections([]);
      return [];
    }
  };

  const startEdit = () => {
    setDraft(title);
    setEditing(true);
  };

  const commitEdit = () => {
    const next = draft.trim();
    if (next) setTitle(next);
    else setDraft(title);
    setEditing(false);
  };

  const cancelEdit = () => {
    setDraft(title);
    setEditing(false);
  };

  const selectSection = (sectionId: string) => {
    const section = sections.find((row) => row.id === sectionId);
    setSelectedSectionId(sectionId);
    setSelectedItemId(section?.items[0]?.id);
    setCheckedCommentIds([]);
    setEditingCommentId(null);
    setExpandedCommentId(null);
  };

  const selectItem = (itemId: string) => {
    setSelectedItemId(itemId);
    setCheckedCommentIds([]);
    setEditingCommentId(null);
    setExpandedCommentId(null);
  };

  const openNewSectionEditor = () => {
    setSectionEditor({
      id: nextId(),
      title: "",
      icon: "layers",
      standardsOfPractice: EMPTY_SOP,
      reminders: EMPTY_SOP,
      mode: "create",
    });
  };

  const openNewItemEditor = () => {
    if (!selectedSection) return;
    setItemEditor({
      id: nextId(),
      title: "",
      reminders: EMPTY_SOP,
      mode: "create",
    });
  };

  const moveSection = (fromId: string, toId: string) => {
    setSections((current) => reorderById(current, fromId, toId));
  };

  const moveItem = (fromId: string, toId: string) => {
    if (!selectedSection) return;
    setSections((current) =>
      current.map((section) =>
        section.id === selectedSection.id
          ? { ...section, items: reorderById(section.items, fromId, toId) }
          : section
      )
    );
  };

  const moveComment = (type: CommentType, fromId: string, toId: string) => {
    if (!selectedSection || !selectedItem) return;
    setSections((current) =>
      current.map((section) =>
        section.id === selectedSection.id
          ? {
              ...section,
              items: section.items.map((item) =>
                item.id === selectedItem.id
                  ? {
                      ...item,
                      comments: reorderCommentsByType(item.comments, type, fromId, toId),
                    }
                  : item
              ),
            }
          : section
      )
    );
  };

  const openNewCommentEditor = (type: CommentType) => {
    if (!selectedSection || !selectedItem) return;
    setCommentEditor({
      id: nextId(),
      type,
      answerFormat: "checkbox",
      choices: "",
      name: "",
      category: "high",
      recommendation: "No Recommendation",
      defaultChecked: false,
      defaultValue: "",
      defaultValue2: "",
      defaultLocation: "",
      defaultText: EMPTY_SOP,
      nameError: false,
    });
  };

  const saveCommentEditor = () => {
    if (!commentEditor || !selectedSection || !selectedItem) return;
    const nextName = commentEditor.name.trim();
    if (!nextName) {
      setCommentEditor({ ...commentEditor, nameError: true });
      return;
    }
    const isDefect = commentEditor.type === "defect";
    const isCheckbox = commentEditor.answerFormat === "checkbox";
    const isNumber = commentEditor.answerFormat === "number";
    const isRange = commentEditor.answerFormat === "numeric-range";
    const comment: TemplateComment = {
      id: commentEditor.id,
      name: nextName,
      type: commentEditor.type,
      answerFormat: commentEditor.answerFormat,
      answerChoices:
        commentEditor.answerFormat === "multiple" ? commentEditor.choices.trim() || undefined : undefined,
      unitChoices:
        !isDefect && (isNumber || isRange)
          ? commentEditor.choices.trim() || undefined
          : undefined,
      category: isDefect ? commentEditor.category : undefined,
      recommendation: isDefect ? commentEditor.recommendation : undefined,
      defaultChecked: isCheckbox ? commentEditor.defaultChecked : undefined,
      defaultValue:
        !isDefect && (isNumber || isRange)
          ? commentEditor.defaultValue.trim() || undefined
          : undefined,
      defaultValue2:
        !isDefect && isRange ? commentEditor.defaultValue2.trim() || undefined : undefined,
      defaultLocation: commentEditor.defaultLocation.trim() || undefined,
      defaultText: commentEditor.defaultText,
    };
    setSections((current) =>
      current.map((section) =>
        section.id === selectedSection.id
          ? {
              ...section,
              items: section.items.map((item) =>
                item.id === selectedItem.id
                  ? { ...item, comments: [...item.comments, comment] }
                  : item
              ),
            }
          : section
      )
    );
    window.setTimeout(() => {
      setCommentEditor(null);
      setExpandedCommentId(comment.id);
    }, 0);
  };

  const updateComment = (commentId: string, patch: Partial<TemplateComment>) => {
    if (!selectedSection || !selectedItem) return;
    setSections((current) =>
      current.map((section) =>
        section.id === selectedSection.id
          ? {
              ...section,
              items: section.items.map((item) =>
                item.id === selectedItem.id
                  ? {
                      ...item,
                      comments: item.comments.map((row) =>
                        row.id === commentId ? { ...row, ...patch } : row
                      ),
                    }
                  : item
              ),
            }
          : section
      )
    );
  };

  const toggleComment = (commentId: string, checked: boolean) => {
    setCheckedCommentIds((current) =>
      checked ? [...current, commentId] : current.filter((id) => id !== commentId)
    );
  };

  const startCommentEdit = (comment: TemplateComment) => {
    setEditingCommentId(comment.id);
    setCommentDraft(comment.name);
  };

  const commitCommentEdit = () => {
    if (!editingCommentId || !selectedSection || !selectedItem) {
      setEditingCommentId(null);
      return;
    }
    const next = commentDraft.trim();
    if (next) {
      setSections((current) =>
        current.map((section) =>
          section.id === selectedSection.id
            ? {
                ...section,
                items: section.items.map((item) =>
                  item.id === selectedItem.id
                    ? {
                        ...item,
                        comments: item.comments.map((comment) =>
                          comment.id === editingCommentId
                            ? { ...comment, name: next }
                            : comment
                        ),
                      }
                    : item
                ),
              }
            : section
        )
      );
    }
    setEditingCommentId(null);
  };

  const cancelCommentEdit = () => {
    setEditingCommentId(null);
    setCommentDraft("");
  };

  const requestDelete = (kind: DeleteKind, id: string, name: string) => {
    setPendingDelete({ kind, id, name });
  };

  const requestDeleteComments = (comments: TemplateComment[]) => {
    if (!comments.length) return;
    setPendingDelete({
      kind: "comment",
      id: comments[0].id,
      name: comments[0].name,
      ids: comments.map((comment) => comment.id),
    });
  };

  const deleteSection = (sectionId: string) => {
    const index = sections.findIndex((section) => section.id === sectionId);
    const next = sections.filter((section) => section.id !== sectionId);
    setSections(next);
    if (selectedSectionId === sectionId) {
      const fallback = next[Math.min(index, Math.max(next.length - 1, 0))];
      setSelectedSectionId(fallback?.id);
      setSelectedItemId(fallback?.items[0]?.id);
      setCheckedCommentIds([]);
      setEditingCommentId(null);
      setExpandedCommentId(null);
    }
  };

  const deleteItem = (itemId: string) => {
    if (!selectedSection) return;
    const index = selectedSection.items.findIndex((item) => item.id === itemId);
    const nextItems = selectedSection.items.filter((item) => item.id !== itemId);
    setSections((current) =>
      current.map((section) =>
        section.id === selectedSection.id ? { ...section, items: nextItems } : section
      )
    );
    if (selectedItemId === itemId) {
      const fallback = nextItems[Math.min(index, Math.max(nextItems.length - 1, 0))];
      setSelectedItemId(fallback?.id);
      setCheckedCommentIds([]);
      setEditingCommentId(null);
      setExpandedCommentId(null);
    }
  };

  const deleteComments = (commentIds: string[]) => {
    if (!selectedSection || !selectedItem || !commentIds.length) return;
    const idSet = new Set(commentIds);
    if (editingCommentId && idSet.has(editingCommentId)) {
      setEditingCommentId(null);
    }
    if (expandedCommentId && idSet.has(expandedCommentId)) {
      setExpandedCommentId(null);
    }
    setCheckedCommentIds((current) => current.filter((id) => !idSet.has(id)));
    setSections((current) =>
      removeComments(current, selectedSection.id, selectedItem.id, commentIds)
    );
  };

  const deleteComment = (commentId: string) => {
    deleteComments([commentId]);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    if (pendingDelete.kind === "section") deleteSection(pendingDelete.id);
    if (pendingDelete.kind === "item") deleteItem(pendingDelete.id);
    if (pendingDelete.kind === "comment") {
      deleteComments(pendingDelete.ids?.length ? pendingDelete.ids : [pendingDelete.id]);
    }
    setPendingDelete(null);
  };

  const toggleGroup = (type: CommentType, comments: TemplateComment[]) => {
    const ids = comments.map((comment) => comment.id);
    const allChecked = ids.every((id) => checkedCommentIds.includes(id));
    setCheckedCommentIds((current) =>
      allChecked
        ? current.filter((id) => !ids.includes(id))
        : [...new Set([...current, ...ids])]
    );
  };

  const openSectionEditor = (section: TemplateSection) => {
    setSectionEditor({
      id: section.id,
      title: section.title,
      icon: section.icon,
      standardsOfPractice: section.standardsOfPractice ?? EMPTY_SOP,
      reminders: section.reminders ?? EMPTY_SOP,
      mode: "edit",
    });
  };

  const saveSectionEditor = () => {
    if (!sectionEditor) return;
    const nextTitle = sectionEditor.title.trim();

    if (sectionEditor.mode === "create") {
      const section: TemplateSection = {
        id: sectionEditor.id,
        title: nextTitle || "New Section",
        icon: sectionEditor.icon,
        items: [],
        standardsOfPractice: sectionEditor.standardsOfPractice,
        reminders: sectionEditor.reminders,
      };
      setSections((current) => [...current, section]);
      setSelectedSectionId(section.id);
      setSelectedItemId(undefined);
      setCheckedCommentIds([]);
      setEditingCommentId(null);
      window.setTimeout(() => setSectionEditor(null), 0);
      return;
    }

    setSections((current) =>
      current.map((section) =>
        section.id === sectionEditor.id
          ? {
              ...section,
              title: nextTitle || section.title,
              icon: sectionEditor.icon,
              standardsOfPractice: sectionEditor.standardsOfPractice,
              reminders: sectionEditor.reminders,
            }
          : section
      )
    );
    window.setTimeout(() => setSectionEditor(null), 0);
  };

  const openDuplicateSection = (section: TemplateSection) => {
    setDuplicateToTemplateId(templateId || "current");
    setTransferSections(sections);
    setDuplicatingSection(section);
  };

  const destinationName = (destinationId: string) =>
    availableTemplates.find((template) => template.id === destinationId)?.name || "Template";

  const duplicateSection = () => {
    if (!duplicatingSection) return;
    const copy = cloneSection(duplicatingSection);
    const destinationId = duplicateToTemplateId;
    const currentId = templateId || "current";

    if (destinationId === currentId) {
      setSections((current) => {
        const index = current.findIndex((section) => section.id === duplicatingSection.id);
        const next = [...current];
        next.splice(index < 0 ? next.length : index + 1, 0, copy);
        return next;
      });
      setSelectedSectionId(copy.id);
      setSelectedItemId(copy.items[0]?.id);
      setCheckedCommentIds([]);
    } else {
      navigate(`/templates/${destinationId}`, {
        state: { name: destinationName(destinationId), duplicatedSection: copy },
      });
    }
    setDuplicatingSection(null);
  };

  const openItemEditor = (item: TemplateItem) => {
    setItemEditor({
      id: item.id,
      title: item.title,
      reminders: item.reminders ?? EMPTY_SOP,
      mode: "edit",
    });
  };

  const saveItemEditor = () => {
    if (!itemEditor || !selectedSection) return;
    const nextTitle = itemEditor.title.trim();

    if (itemEditor.mode === "create") {
      const item: TemplateItem = {
        id: itemEditor.id,
        title: nextTitle || "New Item",
        comments: [],
        reminders: itemEditor.reminders,
      };
      setSections((current) =>
        current.map((section) =>
          section.id === selectedSection.id
            ? { ...section, items: [...section.items, item] }
            : section
        )
      );
      setSelectedItemId(item.id);
      setCheckedCommentIds([]);
      setEditingCommentId(null);
      window.setTimeout(() => setItemEditor(null), 0);
      return;
    }

    setSections((current) =>
      current.map((section) =>
        section.id === selectedSection.id
          ? {
              ...section,
              items: section.items.map((item) =>
                item.id === itemEditor.id
                  ? {
                      ...item,
                      title: nextTitle || item.title,
                      reminders: itemEditor.reminders,
                    }
                  : item
              ),
            }
          : section
      )
    );
    window.setTimeout(() => setItemEditor(null), 0);
  };

  const openItemTransfer = (item: TemplateItem, mode: "duplicate" | "move") => {
    const currentId = templateId || "current";
    setDuplicateToTemplateId(currentId);
    setTransferSections(sections);
    setDuplicateItemSectionId(selectedSectionId);
    if (mode === "move") {
      setMovingItem(item);
      setDuplicatingItem(null);
    } else {
      setDuplicatingItem(item);
      setMovingItem(null);
    }
  };

  const changeDuplicateItemTemplate = async (id: string) => {
    setDuplicateToTemplateId(id);
    const nextSections = await resolveTransferSections(id);
    setDuplicateItemSectionId(nextSections[0]?.id);
  };

  const duplicateItem = () => {
    if (!duplicatingItem || !duplicateItemSectionId) return;
    const copy = cloneItem(duplicatingItem);
    const destinationId = duplicateToTemplateId;
    const currentId = templateId || "current";

    if (destinationId === currentId) {
      setSections((current) =>
        insertItem(
          current,
          duplicateItemSectionId,
          copy,
          duplicateItemSectionId === selectedSectionId ? duplicatingItem.id : undefined
        )
      );
      setSelectedSectionId(duplicateItemSectionId);
      setSelectedItemId(copy.id);
      setCheckedCommentIds([]);
    } else {
      navigate(`/templates/${destinationId}`, {
        state: {
          name: destinationName(destinationId),
          duplicatedItem: copy,
          targetSectionId: duplicateItemSectionId,
        },
      });
    }
    closeItemTransfer();
  };

  const closeItemTransfer = () => {
    window.setTimeout(() => {
      setDuplicatingItem(null);
      setMovingItem(null);
    }, 0);
  };

  const closeCommentTransfer = () => {
    window.setTimeout(() => {
      setDuplicatingComments([]);
      setMovingComments([]);
    }, 0);
  };

  const relocateItem = () => {
    if (!movingItem || !duplicateItemSectionId || !selectedSectionId) return;
    const destinationId = duplicateToTemplateId;
    const currentId = templateId || "current";
    const sourceSectionId = selectedSectionId;
    const destSectionId = duplicateItemSectionId;

    if (destinationId === currentId) {
      if (destSectionId !== sourceSectionId) {
        setSections((current) =>
          insertItem(removeItem(current, sourceSectionId, movingItem.id), destSectionId, movingItem)
        );
        setSelectedSectionId(destSectionId);
        setSelectedItemId(movingItem.id);
        setCheckedCommentIds([]);
        setEditingCommentId(null);
      }
    } else {
      navigate(`/templates/${destinationId}`, {
        state: {
          name: destinationName(destinationId),
          duplicatedItem: movingItem,
          targetSectionId: destSectionId,
        },
      });
    }
    closeItemTransfer();
  };

  const openCommentTransfer = (
    comments: TemplateComment | TemplateComment[],
    mode: "duplicate" | "move"
  ) => {
    const list = Array.isArray(comments) ? comments : [comments];
    if (!list.length) return;
    const currentId = templateId || "current";
    setDuplicateToTemplateId(currentId);
    setTransferSections(sections);
    setDuplicateCommentSectionId(selectedSectionId);
    setDuplicateCommentItemId(selectedItemId);
    if (mode === "move") {
      setMovingComments(list);
      setDuplicatingComments([]);
    } else {
      setDuplicatingComments(list);
      setMovingComments([]);
    }
  };

  const changeDuplicateCommentTemplate = async (id: string) => {
    setDuplicateToTemplateId(id);
    const nextSections = await resolveTransferSections(id);
    setDuplicateCommentSectionId(nextSections[0]?.id);
    setDuplicateCommentItemId(nextSections[0]?.items[0]?.id);
  };

  const changeDuplicateCommentSection = (id: string) => {
    const currentId = templateId || "current";
    const nextSections =
      duplicateToTemplateId === currentId ? sections : transferSections;
    const nextSection = nextSections.find((section) => section.id === id);
    setDuplicateCommentSectionId(id);
    setDuplicateCommentItemId(nextSection?.items[0]?.id);
  };

  const duplicateComment = () => {
    if (!duplicatingComments.length || !duplicateCommentSectionId || !duplicateCommentItemId) {
      return;
    }
    const copies = duplicatingComments.map(cloneComment);
    const destinationId = duplicateToTemplateId;
    const currentId = templateId || "current";

    if (destinationId === currentId) {
      setSections((current) =>
        insertComments(
          current,
          duplicateCommentSectionId,
          duplicateCommentItemId,
          copies,
          duplicateCommentItemId === selectedItemId
            ? duplicatingComments[duplicatingComments.length - 1]?.id
            : undefined
        )
      );
      setSelectedSectionId(duplicateCommentSectionId);
      setSelectedItemId(duplicateCommentItemId);
      setCheckedCommentIds([]);
    } else {
      navigate(`/templates/${destinationId}`, {
        state: {
          name: destinationName(destinationId),
          duplicatedComments: copies,
          targetSectionId: duplicateCommentSectionId,
          targetItemId: duplicateCommentItemId,
        },
      });
    }
    closeCommentTransfer();
  };

  const relocateComment = () => {
    if (
      !movingComments.length ||
      !duplicateCommentSectionId ||
      !duplicateCommentItemId ||
      !selectedSectionId ||
      !selectedItemId
    ) {
      return;
    }
    const destinationId = duplicateToTemplateId;
    const currentId = templateId || "current";
    const sourceSectionId = selectedSectionId;
    const sourceItemId = selectedItemId;
    const destSectionId = duplicateCommentSectionId;
    const destItemId = duplicateCommentItemId;
    const samePlace = destSectionId === sourceSectionId && destItemId === sourceItemId;
    const ids = movingComments.map((comment) => comment.id);

    if (destinationId === currentId) {
      if (!samePlace) {
        setSections((current) =>
          insertComments(
            removeComments(current, sourceSectionId, sourceItemId, ids),
            destSectionId,
            destItemId,
            movingComments
          )
        );
        setSelectedSectionId(destSectionId);
        setSelectedItemId(destItemId);
        setCheckedCommentIds((current) => current.filter((id) => !ids.includes(id)));
        setEditingCommentId(null);
      }
    } else {
      navigate(`/templates/${destinationId}`, {
        state: {
          name: destinationName(destinationId),
          duplicatedComments: movingComments,
          targetSectionId: destSectionId,
          targetItemId: destItemId,
        },
      });
    }
    closeCommentTransfer();
  };

  const currentTemplateKey = templateId || "current";
  const commentDuplicateSections =
    duplicateToTemplateId === currentTemplateKey ? sections : transferSections;
  const commentDuplicateItems =
    commentDuplicateSections.find((section) => section.id === duplicateCommentSectionId)
      ?.items ?? [];
  const templateSelectOptions = templateChoices(availableTemplates, templateId, title);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Loading template...
      </div>
    );
  }

  if (loadError && sections.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
        <p>{loadError}</p>
        <Button variant="outline" onClick={() => navigate("/templates")}>
          Back to templates
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
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
          <div className="pointer-events-auto flex w-full max-w-2xl items-center justify-center gap-2">
            <FileText className="size-5 shrink-0" />
            {editing ? (
              <Input
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={commitEdit}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitEdit();
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    cancelEdit();
                  }
                }}
                aria-label="Template name"
                className="h-8 w-full min-w-0 text-center text-xl font-normal"
              />
            ) : (
              <>
                <h1 className="text-center text-xl font-normal leading-snug text-pretty">
                  {title}
                </h1>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 text-muted-foreground"
                  aria-label="Edit template name"
                  onClick={startEdit}
                >
                  <Pencil />
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="relative z-10 ml-auto flex items-center gap-2">
          {exportError ? (
            <span className="hidden text-xs text-destructive sm:inline">{exportError}</span>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="h-8"
                disabled={!templateId || exporting}
              >
                {exporting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                Export
                <ChevronDown className="size-4 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => void handleExport("json")}>
                Export JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void handleExport("xlsx")}>
                Export Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void handleExport("csv")}>
                Export CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <Separator />

      <div
        className={cn(
          "grid min-h-0 flex-1 transition-[grid-template-columns] duration-200",
          sectionsCollapsed && itemsCollapsed && "grid-cols-[2.75rem_2.75rem_1fr]",
          sectionsCollapsed && !itemsCollapsed && "grid-cols-[2.75rem_25%_1fr]",
          !sectionsCollapsed && itemsCollapsed && "grid-cols-[25%_2.75rem_1fr]",
          !sectionsCollapsed && !itemsCollapsed && "grid-cols-[25%_25%_1fr]"
        )}
      >
        <section className="flex min-h-0 min-w-0 flex-col border-r">
          {sectionsCollapsed ? (
            <CollapsedPane
              label="Sections"
              tourId="collapse-sections"
              onExpand={() => setSectionsCollapsed(false)}
            />
          ) : (
            <>
              <PaneHeader
                onToggleCollapse={() => setSectionsCollapsed(true)}
                collapseLabel="Collapse sections"
                tourId="collapse-sections"
              >
                Sections
              </PaneHeader>
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto py-1">
                {sections.map((section) => {
                  const selected = section.id === selectedSectionId;
                  const Icon = getSectionIcon(section.icon);
                  const isOver =
                    dragging?.kind === "section" &&
                    overId === section.id &&
                    dragging.id !== section.id;
                  return (
                    <div
                      key={section.id}
                      draggable
                      onClick={() => onRowClick(() => selectSection(section.id))}
                      onDragStart={(event) => startRowDrag("section", section.id, event)}
                      onDragEnd={endRowDrag}
                      onDragOver={(event) => {
                        if (dragging?.kind !== "section") return;
                        event.preventDefault();
                        setOverId(section.id);
                      }}
                      onDragLeave={() => {
                        setOverId((current) => (current === section.id ? null : current));
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (dragging?.kind === "section") {
                          moveSection(dragging.id, section.id);
                        }
                        endRowDrag();
                      }}
                      className={cn(
                        "group flex w-full cursor-grab items-center gap-2 px-3 py-2 text-left text-sm active:cursor-grabbing",
                        selected ? "bg-muted font-bold" : "hover:bg-muted/60",
                        isOver && "border-t-2 border-orange-500"
                      )}
                      role="listitem"
                      aria-label={section.title}
                    >
                      <DragHandle visible={dragging?.id === section.id} />
                      <Icon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 whitespace-normal break-words leading-snug">
                        {section.title}
                      </span>
                      <span
                        className={cn(
                          "ml-auto shrink-0 items-center",
                          selected ? "flex" : "hidden group-hover:flex"
                        )}
                      >
                        <RowIconButton
                          label={`Edit ${section.title}`}
                          onClick={() => openSectionEditor(section)}
                        >
                          <Pencil />
                        </RowIconButton>
                        <RowIconButton
                          label={`Duplicate ${section.title}`}
                          onClick={() => openDuplicateSection(section)}
                        >
                          <Copy />
                        </RowIconButton>
                        <RowIconButton
                          label={`Delete ${section.title}`}
                          onClick={() => requestDelete("section", section.id, section.title)}
                        >
                          <Trash2 />
                        </RowIconButton>
                      </span>
                    </div>
                  );
                })}
                <div className="mt-3 flex justify-center pb-4">
                  <Button type="button" variant="outline" size="sm" onClick={openNewSectionEditor}>
                    <Plus />
                    Section
                  </Button>
                </div>
              </div>
            </>
          )}
        </section>

        <section className="flex min-h-0 min-w-0 flex-col border-r">
          {itemsCollapsed ? (
            <CollapsedPane
              label="Items"
              tourId="collapse-items"
              onExpand={() => setItemsCollapsed(false)}
            />
          ) : (
            <>
              <PaneHeader
                onToggleCollapse={() => setItemsCollapsed(true)}
                collapseLabel="Collapse items"
                tourId="collapse-items"
              >
                Items
              </PaneHeader>
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto py-1">
                {selectedSection?.items.length ? (
                  selectedSection.items.map((item) => {
                    const selected = item.id === selectedItemId;
                    const isOver =
                      dragging?.kind === "item" &&
                      overId === item.id &&
                      dragging.id !== item.id;
                    return (
                      <div
                        key={item.id}
                        draggable
                        onClick={() => onRowClick(() => selectItem(item.id))}
                        onDragStart={(event) => startRowDrag("item", item.id, event)}
                        onDragEnd={endRowDrag}
                        onDragOver={(event) => {
                          if (dragging?.kind !== "item") return;
                          event.preventDefault();
                          setOverId(item.id);
                        }}
                        onDragLeave={() => {
                          setOverId((current) => (current === item.id ? null : current));
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          if (dragging?.kind === "item") {
                            moveItem(dragging.id, item.id);
                          }
                          endRowDrag();
                        }}
                        className={cn(
                          "group flex w-full cursor-grab items-center gap-2 px-3 py-2 text-left text-sm active:cursor-grabbing",
                          selected ? "bg-muted font-bold text-foreground" : "hover:bg-muted/60",
                          isOver && "border-t-2 border-orange-500"
                        )}
                        role="listitem"
                        aria-label={item.title}
                      >
                        <DragHandle visible={dragging?.id === item.id} />
                        <span className="min-w-0 flex-1 whitespace-normal break-words leading-snug">
                          {item.title}
                        </span>
                        <span
                          className={cn(
                            "ml-auto shrink-0 items-center",
                            selected ? "flex" : "hidden group-hover:flex"
                          )}
                        >
                          <RowIconButton
                            label={`Edit ${item.title}`}
                            onClick={() => openItemEditor(item)}
                          >
                            <Pencil />
                          </RowIconButton>
                          <RowIconButton
                            label={`Duplicate ${item.title}`}
                            onClick={() => openItemTransfer(item, "duplicate")}
                          >
                            <Copy />
                          </RowIconButton>
                          <RowIconButton
                            label={`Move ${item.title}`}
                            onClick={() => openItemTransfer(item, "move")}
                          >
                            <MoveTreeIcon />
                          </RowIconButton>
                          <RowIconButton
                            label={`Delete ${item.title}`}
                            onClick={() => requestDelete("item", item.id, item.title)}
                          >
                            <Trash2 />
                          </RowIconButton>
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <p className="px-3 py-6 text-sm text-muted-foreground">
                    Select a section to see its items.
                  </p>
                )}
                {selectedSection ? (
                  <div className="mt-3 flex justify-center pb-4">
                    <Button type="button" variant="outline" size="sm" onClick={openNewItemEditor}>
                      <Plus />
                      Item
                    </Button>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </section>

        <section className="flex min-h-0 min-w-0 flex-col bg-muted/20">
          <PaneHeader>Comments</PaneHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {selectedItem ? (
              <div className="flex flex-col gap-8">
                {COMMENT_GROUPS.map((group) => {
                  const comments = selectedItem.comments.filter(
                    (comment) => comment.type === group.type
                  );
                  const allChecked =
                    comments.length > 0 &&
                    comments.every((comment) => checkedCommentIds.includes(comment.id));
                  const selectedComments = comments.filter((comment) =>
                    checkedCommentIds.includes(comment.id)
                  );
                  return (
                    <div key={group.type}>
                      <div className="mb-3 flex items-center gap-2">
                        <h3 className="text-sm font-medium tracking-[0.18em] text-muted-foreground uppercase">
                          {group.label}
                        </h3>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="ml-auto"
                          onClick={() => openNewCommentEditor(group.type)}
                        >
                          <Plus />
                          New
                        </Button>
                      </div>
                      <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                        <label className="flex items-center gap-2">
                          <Checkbox
                            checked={allChecked}
                            disabled={!comments.length}
                            onCheckedChange={() => toggleGroup(group.type, comments)}
                          />
                          Select All
                        </label>
                        <span data-no-drag className="flex">
                          <RowIconButton
                            label="Duplicate selected comments"
                            disabled={!selectedComments.length}
                            onClick={() => openCommentTransfer(selectedComments, "duplicate")}
                          >
                            <Copy />
                          </RowIconButton>
                          <RowIconButton
                            label="Move selected comments"
                            disabled={!selectedComments.length}
                            onClick={() => openCommentTransfer(selectedComments, "move")}
                          >
                            <MoveTreeIcon />
                          </RowIconButton>
                          <RowIconButton
                            label="Delete selected comments"
                            disabled={!selectedComments.length}
                            onClick={() => requestDeleteComments(selectedComments)}
                          >
                            <Trash2 />
                          </RowIconButton>
                        </span>
                      </div>
                      <div className="flex flex-col gap-2">
                        {comments.map((comment) => {
                          const isOver =
                            dragging?.kind === "comment" &&
                            overId === comment.id &&
                            dragging.id !== comment.id;
                          const isEditingName = editingCommentId === comment.id;
                          const isExpanded = expandedCommentId === comment.id;
                          return (
                            <div
                              key={comment.id}
                              onDragOver={(event) => {
                                if (dragging?.kind !== "comment") return;
                                event.preventDefault();
                                setOverId(comment.id);
                              }}
                              onDragLeave={() => {
                                setOverId((current) =>
                                  current === comment.id ? null : current
                                );
                              }}
                              onDrop={(event) => {
                                event.preventDefault();
                                if (dragging?.kind === "comment") {
                                  moveComment(group.type, dragging.id, comment.id);
                                }
                                endRowDrag();
                              }}
                              className={cn(
                                "rounded-md border bg-card shadow-xs",
                                isOver && "border-t-2 border-orange-500"
                              )}
                              role="listitem"
                              aria-label={comment.name}
                              aria-expanded={isExpanded}
                            >
                              <div
                                draggable={!isEditingName}
                                onDragStart={(event) =>
                                  startRowDrag("comment", comment.id, event)
                                }
                                onDragEnd={endRowDrag}
                                onClick={() => {
                                  if (isEditingName) return;
                                  onRowClick(() =>
                                    setExpandedCommentId((current) =>
                                      current === comment.id ? null : comment.id
                                    )
                                  );
                                }}
                                className={cn(
                                  "group flex items-center gap-3 px-3 py-2.5",
                                  isEditingName
                                    ? "cursor-text"
                                    : "cursor-grab active:cursor-grabbing"
                                )}
                              >
                                <DragHandle visible={dragging?.id === comment.id} />
                                <div className="flex min-w-0 flex-1 items-center gap-3">
                                  <span
                                    data-no-drag
                                    className="flex items-center"
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    <Checkbox
                                      checked={checkedCommentIds.includes(comment.id)}
                                      onCheckedChange={(value) =>
                                        toggleComment(comment.id, value === true)
                                      }
                                    />
                                  </span>
                                  <CommentFormatIcon
                                    format={comment.answerFormat}
                                    type={comment.type}
                                  />
                                  {isEditingName ? (
                                    <Input
                                      ref={commentInputRef}
                                      data-no-drag
                                      value={commentDraft}
                                      onChange={(event) => setCommentDraft(event.target.value)}
                                      onBlur={commitCommentEdit}
                                      onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                          event.preventDefault();
                                          commitCommentEdit();
                                        }
                                        if (event.key === "Escape") {
                                          event.preventDefault();
                                          cancelCommentEdit();
                                        }
                                      }}
                                      aria-label="Comment name"
                                      className="h-8 flex-1 font-medium"
                                    />
                                  ) : (
                                    <span className="min-w-0 flex-1 whitespace-normal break-words leading-snug font-medium">
                                      {comment.name}
                                    </span>
                                  )}
                                </div>
                                <span className="flex shrink-0">
                                  <RowIconButton
                                    label={`Edit ${comment.name}`}
                                    onClick={() => startCommentEdit(comment)}
                                  >
                                    <Pencil />
                                  </RowIconButton>
                                  <RowIconButton
                                    label={`Duplicate ${comment.name}`}
                                    onClick={() => openCommentTransfer(comment, "duplicate")}
                                  >
                                    <Copy />
                                  </RowIconButton>
                                  <RowIconButton
                                    label={`Move ${comment.name}`}
                                    onClick={() => openCommentTransfer(comment, "move")}
                                  >
                                    <MoveTreeIcon />
                                  </RowIconButton>
                                  <RowIconButton
                                    label={`Delete ${comment.name}`}
                                    onClick={() =>
                                      requestDelete("comment", comment.id, comment.name)
                                    }
                                  >
                                    <Trash2 />
                                  </RowIconButton>
                                </span>
                              </div>
                              {isExpanded ? (
                                <div
                                  data-no-drag
                                  className="border-t px-4 py-4"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <CommentExpandedPanel
                                    templateId={templateId}
                                    sectionTitle={selectedSection?.title || ""}
                                    itemTitle={selectedItem?.title || ""}
                                    comment={comment}
                                    onChange={(patch) => updateComment(comment.id, patch)}
                                    onEnsureSaved={async () => {
                                      if (!templateId) return;
                                      await saveTemplate(templateId, {
                                        name: title,
                                        sections,
                                      });
                                    }}
                                  />
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="py-6 text-sm text-muted-foreground">
                Select an item to see its comments.
              </p>
            )}
          </div>
        </section>
      </div>

      <EditSectionDialog
        draft={sectionEditor}
        onDraftChange={setSectionEditor}
        onClose={() => setSectionEditor(null)}
        onSave={saveSectionEditor}
      />
      <DuplicateSectionDialog
        open={Boolean(duplicatingSection)}
        title="Duplicate Section"
        description="This will create a copy of this section, along with all items and comments within it. Please be patient, as large sections may take several seconds."
        helperText="You may choose to send the duplicated section to another template:"
        selectLabel="Duplicate to template:"
        templates={templateSelectOptions}
        selectedTemplateId={duplicateToTemplateId}
        onTemplateChange={setDuplicateToTemplateId}
        onClose={() => setDuplicatingSection(null)}
        onDuplicate={duplicateSection}
      />
      <DuplicateItemDialog
        open={Boolean(duplicatingItem || movingItem)}
        mode={movingItem ? "move" : "duplicate"}
        templates={templateSelectOptions}
        sections={commentDuplicateSections}
        selectedTemplateId={duplicateToTemplateId}
        selectedSectionId={duplicateItemSectionId}
        onTemplateChange={changeDuplicateItemTemplate}
        onSectionChange={setDuplicateItemSectionId}
        onClose={() => {
          setDuplicatingItem(null);
          setMovingItem(null);
        }}
        onConfirm={movingItem ? relocateItem : duplicateItem}
      />
      <EditItemDialog
        draft={itemEditor}
        onDraftChange={setItemEditor}
        onClose={() => setItemEditor(null)}
        onSave={saveItemEditor}
      />
      <AddCommentDialog
        draft={commentEditor}
        sectionTitle={selectedSection?.title || ""}
        itemTitle={selectedItem?.title || ""}
        onDraftChange={setCommentEditor}
        onClose={() => setCommentEditor(null)}
        onSave={saveCommentEditor}
      />
      <DuplicateCommentDialog
        open={duplicatingComments.length > 0 || movingComments.length > 0}
        mode={movingComments.length ? "move" : "duplicate"}
        count={movingComments.length || duplicatingComments.length}
        templates={templateSelectOptions}
        sections={commentDuplicateSections}
        items={commentDuplicateItems}
        selectedTemplateId={duplicateToTemplateId}
        selectedSectionId={duplicateCommentSectionId}
        selectedItemId={duplicateCommentItemId}
        onTemplateChange={changeDuplicateCommentTemplate}
        onSectionChange={changeDuplicateCommentSection}
        onItemChange={setDuplicateCommentItemId}
        onClose={() => {
          setDuplicatingComments([]);
          setMovingComments([]);
        }}
        onConfirm={movingComments.length ? relocateComment : duplicateComment}
      />
      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingDelete ? deleteDialogCopy(pendingDelete).title : "Delete?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete ? deleteDialogCopy(pendingDelete).description : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PaneHeader({
  children,
  onToggleCollapse,
  collapseLabel,
  tourId,
}: {
  children: string;
  onToggleCollapse?: () => void;
  collapseLabel?: string;
  tourId?: string;
}) {
  if (onToggleCollapse) {
    return (
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-label={collapseLabel ?? `Collapse ${children}`}
        data-tour={tourId}
        className="relative flex h-11 w-full shrink-0 cursor-pointer items-center justify-center border-b px-8 transition-colors hover:bg-muted/60"
      >
        <h2 className="text-sm font-medium tracking-[0.28em] text-muted-foreground uppercase">
          {children}
        </h2>
        <span className="absolute right-1 flex size-7 items-center justify-center text-muted-foreground">
          <ChevronLeft className="size-4" />
        </span>
      </button>
    );
  }

  return (
    <div className="relative flex h-11 shrink-0 items-center justify-center border-b px-8">
      <h2 className="text-sm font-medium tracking-[0.28em] text-muted-foreground uppercase">
        {children}
      </h2>
    </div>
  );
}

function CollapsedPane({
  label,
  onExpand,
  tourId,
}: {
  label: string;
  onExpand: () => void;
  tourId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onExpand}
      aria-label={`Expand ${label}`}
      data-tour={tourId}
      className="flex h-full w-full flex-col items-center justify-center gap-3 py-4 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
    >
      <ChevronRight className="size-4 shrink-0" />
      <span className="text-sm font-medium tracking-[0.28em] uppercase [writing-mode:vertical-rl] rotate-180">
        {label}
      </span>
    </button>
  );
}

function DragHandle({ visible }: { visible: boolean }) {
  return (
    <span
      className={cn(
        "pointer-events-none flex size-4 shrink-0 items-center justify-center text-orange-500",
        visible ? "opacity-100" : "opacity-0 group-hover:opacity-100"
      )}
    >
      <ArrowUpDown className="size-4" />
    </span>
  );
}

function MoveTreeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="5" r="2" />
      <circle cx="6" cy="19" r="2" />
      <circle cx="12" cy="19" r="2" />
      <circle cx="18" cy="19" r="2" />
      <path d="M12 7v4" />
      <path d="M6 15v-4h12v4" />
      <path d="M12 11v4" />
    </svg>
  );
}

function RowIconButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: ReactNode;
  label: string;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      data-no-drag
      disabled={disabled}
      className="size-7 text-muted-foreground"
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.(event);
      }}
    >
      {children}
    </Button>
  );
}

function ChoiceListEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string;
  onChange: (values: string[]) => void;
}) {
  const [drafts, setDrafts] = useState(() => parseChoiceList(value));
  const [adding, setAdding] = useState(false);
  const [newValue, setNewValue] = useState("");
  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDrafts(parseChoiceList(value));
  }, [value]);

  useEffect(() => {
    if (adding) addInputRef.current?.focus();
  }, [adding]);

  const commitAt = (index: number, next: string) => {
    const trimmed = next.trim();
    const updated = drafts
      .map((choice, currentIndex) => (currentIndex === index ? trimmed : choice))
      .filter(Boolean);
    setDrafts(updated);
    onChange(updated);
  };

  const commitNew = () => {
    const trimmed = newValue.trim();
    setAdding(false);
    setNewValue("");
    if (!trimmed) return;
    const updated = [...drafts, trimmed];
    setDrafts(updated);
    onChange(updated);
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-3">
        {drafts.map((choice, index) => (
          <label key={`${choice}-${index}`} className="flex min-w-0 items-center gap-2">
            <span className="border-input size-4 shrink-0 rounded-[4px] border" />
            <input
              value={choice}
              onChange={(event) => {
                const next = drafts.slice();
                next[index] = event.target.value;
                setDrafts(next);
              }}
              onBlur={(event) => commitAt(index, event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  (event.target as HTMLInputElement).blur();
                }
              }}
              aria-label={`${label} ${index + 1}`}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </label>
        ))}
      </div>
      {adding ? (
        <label className="flex max-w-xs items-center gap-2">
          <span className="border-input size-4 shrink-0 rounded-[4px] border" />
          <input
            ref={addInputRef}
            value={newValue}
            onChange={(event) => setNewValue(event.target.value)}
            onBlur={commitNew}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitNew();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                setAdding(false);
                setNewValue("");
              }
            }}
            placeholder="New choice"
            aria-label="New choice"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </label>
      ) : (
        <button
          type="button"
          className="text-primary flex w-fit items-center gap-2 text-sm font-medium tracking-wide uppercase"
          onClick={() => setAdding(true)}
        >
          <span className="bg-primary text-primary-foreground flex size-5 items-center justify-center rounded-full">
            <Plus className="size-3" />
          </span>
          Add Choice
        </button>
      )}
    </div>
  );
}

function CommentExpandedPanel({
  templateId,
  sectionTitle = "",
  itemTitle = "",
  comment,
  onChange,
  onEnsureSaved,
}: {
  templateId?: string;
  sectionTitle?: string;
  itemTitle?: string;
  comment: TemplateComment;
  onChange: (patch: Partial<TemplateComment>) => void;
  onEnsureSaved?: () => Promise<void>;
}) {
  const isMultiple = comment.answerFormat === "multiple";
  const isCheckbox = !comment.answerFormat || comment.answerFormat === "checkbox";
  const isNumber = comment.answerFormat === "number";
  const isRange = comment.answerFormat === "numeric-range";
  const isUnit = isNumber || isRange;
  const isDefect = comment.type === "defect";
  const photos = comment.defaultPhotos ?? [];

  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<CommentDefaultPhoto | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<CommentDefaultPhoto | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoCaption, setPhotoCaption] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const runEditWithAi = async () => {
    if (aiBusy) return;
    setAiBusy(true);
    setAiError(null);
    try {
      const choices =
        isMultiple
          ? comment.answerChoices || ""
          : isUnit
            ? comment.unitChoices || ""
            : "";
      const result = await assistCommentWithAi({
        mode: "edit",
        sectionTitle,
        itemTitle,
        commentType: comment.type,
        answerFormat: comment.answerFormat || "checkbox",
        name: comment.name,
        choices,
        defaultText: plainFromRichText(comment.defaultText),
        category: comment.category,
        recommendation: comment.recommendation || "",
      });
      if (result.status === "unavailable" || result.status === "rejected") {
        setAiError(result.message || "AI is unavailable right now.");
        return;
      }
      const patch: Partial<TemplateComment> = {};
      if (result.name) patch.name = result.name;
      if (result.defaultText) patch.defaultText = richTextFromPlain(result.defaultText);
      if (isMultiple && result.choices != null) patch.answerChoices = result.choices;
      if (isUnit && result.choices != null) patch.unitChoices = result.choices;
      if (isDefect) {
        if (result.category) patch.category = result.category;
        if (result.recommendation) patch.recommendation = result.recommendation;
      }
      onChange(patch);
    } catch {
      setAiError("AI edit failed. Please try again.");
    } finally {
      setAiBusy(false);
    }
  };

  const openAddPhoto = () => {
    setEditingPhoto(null);
    setPhotoFile(null);
    setPhotoCaption("");
    setPhotoError(null);
    setPhotoDialogOpen(true);
  };

  const openEditPhoto = (photo: CommentDefaultPhoto) => {
    setEditingPhoto(photo);
    setPhotoFile(null);
    setPhotoCaption(photo.imageCaption ?? "");
    setPhotoError(null);
    setPhotoDialogOpen(true);
  };

  const closePhotoDialog = () => {
    if (photoBusy) return;
    setPhotoDialogOpen(false);
    setEditingPhoto(null);
    setPhotoFile(null);
    setPhotoCaption("");
    setPhotoError(null);
  };

  const savePhotoDialog = async () => {
    if (!templateId) {
      setPhotoError("Save the template before adding photos.");
      return;
    }
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      if (onEnsureSaved) {
        await onEnsureSaved();
      }
      if (editingPhoto) {
        const updated = await updateCommentImageCaption(
          templateId,
          editingPhoto.id,
          photoCaption
        );
        onChange({
          defaultPhotos: photos.map((photo) =>
            photo.id === updated.id ? { ...photo, ...updated } : photo
          ),
        });
      } else {
        if (!photoFile) {
          setPhotoError("Choose an image file.");
          setPhotoBusy(false);
          return;
        }
        const created = await uploadCommentImage(
          templateId,
          comment.id,
          photoFile,
          photoCaption
        );
        onChange({ defaultPhotos: [...photos, created] });
      }
      setPhotoDialogOpen(false);
      setEditingPhoto(null);
      setPhotoFile(null);
      setPhotoCaption("");
    } catch (error) {
      const detail =
        error &&
        typeof error === "object" &&
        "response" in error &&
        error.response &&
        typeof error.response === "object" &&
        "data" in error.response &&
        error.response.data &&
        typeof error.response.data === "object" &&
        "detail" in error.response.data
          ? String((error.response.data as { detail: unknown }).detail)
          : null;
      setPhotoError(
        detail ||
          (editingPhoto ? "Failed to update caption." : "Failed to upload image.")
      );
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = async (photo: CommentDefaultPhoto) => {
    if (!templateId) return;
    try {
      await deleteCommentImage(templateId, photo.id);
      onChange({
        defaultPhotos: photos.filter((row) => row.id !== photo.id),
      });
    } catch {
      setPhotoError("Failed to delete image.");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {isMultiple || isCheckbox ? (
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            className="w-fit bg-green-700 text-white hover:bg-green-800"
            disabled={aiBusy}
            onClick={() => void runEditWithAi()}
          >
            {aiBusy ? <Loader2 className="animate-spin" /> : <Wand2 />}
            Edit using AI
          </Button>
          {aiError ? <p className="text-sm text-destructive">{aiError}</p> : null}
        </div>
      ) : null}
      {isCheckbox ? (
        <label className="flex w-fit items-center gap-2 text-sm">
          <Checkbox
            checked={comment.defaultChecked === true}
            onCheckedChange={(value) => onChange({ defaultChecked: value === true })}
          />
          Default to checked?
        </label>
      ) : null}
      {isMultiple ? (
        <ChoiceListEditor
          label="Answer Choices"
          value={comment.answerChoices}
          onChange={(choices) =>
            onChange({ answerChoices: joinChoiceList(choices) || undefined })
          }
        />
      ) : null}
      {isUnit ? (
        <div className="border-input flex flex-col rounded-md border px-3 py-2 shadow-xs">
          <Label
            htmlFor={`unit-choices-${comment.id}`}
            className="text-muted-foreground mb-1 font-normal"
          >
            Unit Type Choices (comma-separated)
          </Label>
          <textarea
            id={`unit-choices-${comment.id}`}
            value={comment.unitChoices ?? ""}
            onChange={(event) =>
              onChange({ unitChoices: event.target.value || undefined })
            }
            placeholder="kg, lbs"
            className={cn(
              "placeholder:text-muted-foreground flex min-h-[72px] w-full resize-y bg-transparent text-sm outline-none"
            )}
          />
        </div>
      ) : null}
      {isUnit ? (
        <div className="flex flex-col gap-1">
          <Label
            htmlFor={`default-value-${comment.id}`}
            className="text-muted-foreground font-normal"
          >
            Default Value
          </Label>
          <input
            id={`default-value-${comment.id}`}
            value={comment.defaultValue ?? ""}
            onChange={(event) => onChange({ defaultValue: event.target.value })}
            className="w-full border-0 border-b border-input bg-transparent py-2 text-sm outline-none focus-visible:border-foreground"
          />
        </div>
      ) : null}
      {isRange ? (
        <div className="flex flex-col gap-1">
          <Label
            htmlFor={`default-value-2-${comment.id}`}
            className="text-muted-foreground font-normal"
          >
            Default Value 2
          </Label>
          <input
            id={`default-value-2-${comment.id}`}
            value={comment.defaultValue2 ?? ""}
            onChange={(event) => onChange({ defaultValue2: event.target.value })}
            className="w-full border-0 border-b border-input bg-transparent py-2 text-sm outline-none focus-visible:border-foreground"
          />
        </div>
      ) : null}
      {isDefect ? (
        <>
          <div
            className="grid grid-cols-3 overflow-hidden rounded-md border"
            role="radiogroup"
            aria-label="Comment category"
          >
            {DEFECT_CATEGORIES.map((category) => {
              const selected = (comment.category ?? "high") === category.id;
              return (
                <button
                  key={category.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={category.label}
                  className={cn(
                    "flex h-12 items-center justify-center border-r last:border-r-0",
                    selected
                      ? category.activeClass
                      : "bg-muted/40 text-muted-foreground hover:bg-muted"
                  )}
                  onClick={() => onChange({ category: category.id })}
                >
                  <category.Icon className="size-5" />
                </button>
              );
            })}
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">Recommendation</p>
            <Select
              value={comment.recommendation ?? "No Recommendation"}
              onValueChange={(recommendation) => onChange({ recommendation })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a recommendation" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {RECOMMENDATIONS.map((recommendation) => (
                  <SelectItem key={recommendation} value={recommendation}>
                    {recommendation}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      ) : null}
      <div className="relative flex flex-col gap-1">
        <Label
          htmlFor={`default-location-${comment.id}`}
          className="text-muted-foreground font-normal"
        >
          Default Location
        </Label>
        <input
          id={`default-location-${comment.id}`}
          value={comment.defaultLocation ?? ""}
          onChange={(event) => onChange({ defaultLocation: event.target.value })}
          aria-label="Default Location"
          className="w-full border-0 border-b border-input bg-transparent py-2 pr-8 text-sm outline-none focus-visible:border-foreground"
        />
        <Pencil className="pointer-events-none absolute right-0 bottom-2 size-4 text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">Default Text</p>
        <RichTextEditor
          key={comment.id}
          value={comment.defaultText ?? EMPTY_SOP}
          onChange={(defaultText) => onChange({ defaultText })}
          placeholder="Enter text here"
          className="min-h-[180px]"
        />
      </div>

      <div className="flex flex-col gap-3">
        {photos.length ? (
          <>
            <p className="text-sm text-muted-foreground">Default Photos</p>
            <div className="flex flex-wrap gap-4">
              {photos.map((photo) => (
                <div key={photo.id} className="w-36">
                  <div className="group relative overflow-hidden rounded-md border bg-muted/30">
                    <button
                      type="button"
                      className="block w-full cursor-zoom-in"
                      aria-label={`View ${photo.imageCaption || "default photo"} full size`}
                      onClick={() => setPreviewPhoto(photo)}
                    >
                      <img
                        src={resolveImageUrl(photo.imageUrl, photo.importImageUrl)}
                        alt={photo.imageCaption || "Default photo"}
                        className="aspect-[4/3] w-full object-cover"
                      />
                    </button>
                    <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        className="rounded-md bg-white p-1.5 text-foreground shadow-lg ring-1 ring-black/10 hover:bg-white"
                        aria-label="Edit caption"
                        onClick={(event) => {
                          event.stopPropagation();
                          openEditPhoto(photo);
                        }}
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        className="rounded-md bg-white p-1.5 text-destructive shadow-lg ring-1 ring-black/10 hover:bg-white"
                        aria-label="Delete photo"
                        onClick={(event) => {
                          event.stopPropagation();
                          void removePhoto(photo);
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {photo.imageCaption || "Untitled"}
                  </p>
                </div>
              ))}
            </div>
          </>
        ) : null}
        {photoError ? (
          <p className="text-sm text-destructive" role="alert">
            {photoError}
          </p>
        ) : null}
        <div className="flex justify-end">
          <Button
            type="button"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={openAddPhoto}
            disabled={!templateId}
          >
            <Camera />
            ADD DEFAULT PHOTO
          </Button>
        </div>
      </div>

      <Dialog
        open={photoDialogOpen}
        onOpenChange={(open) => {
          if (!open) closePhotoDialog();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-center sm:text-center">
            <DialogTitle className="text-foreground tracking-[0.18em] uppercase">
              {editingPhoto ? "Edit Default Photo" : "Add a Default Photo"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {editingPhoto
                ? "Update the caption for this default photo."
                : "This photo will automatically be included for this comment in your reports."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {!editingPhoto ? (
              <Input
                type="file"
                accept="image/*"
                onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)}
                disabled={photoBusy}
                className="text-foreground file:mr-3 file:rounded-md file:bg-muted file:px-3 file:py-1 file:text-foreground dark:bg-muted/40 dark:file:bg-background"
              />
            ) : (
              <img
                src={resolveImageUrl(editingPhoto.imageUrl, editingPhoto.importImageUrl)}
                alt={editingPhoto.imageCaption || "Default photo"}
                className="max-h-48 w-full rounded-md border border-border object-contain"
              />
            )}
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor={`photo-caption-${comment.id}`}
                className="text-muted-foreground font-normal"
              >
                Caption
              </Label>
              <Input
                id={`photo-caption-${comment.id}`}
                value={photoCaption}
                onChange={(event) => setPhotoCaption(event.target.value)}
                placeholder="Caption"
                disabled={photoBusy}
              />
            </div>
            {photoError ? (
              <p className="text-sm text-destructive" role="alert">
                {photoError}
              </p>
            ) : null}
          </div>
          <DialogFooter className="sm:justify-center">
            <Button
              type="button"
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={photoBusy || (!editingPhoto && !photoFile)}
              onClick={() => void savePhotoDialog()}
            >
              {photoBusy ? "Saving..." : "SAVE"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(previewPhoto)}
        onOpenChange={(open) => {
          if (!open) setPreviewPhoto(null);
        }}
      >
        <DialogContent className="max-w-[min(96vw,56rem)] border-none bg-transparent p-0 shadow-none sm:max-w-[min(96vw,56rem)]">
          <DialogHeader className="sr-only">
            <DialogTitle>
              {previewPhoto?.imageCaption || "Default photo"}
            </DialogTitle>
            <DialogDescription>Full size photo preview</DialogDescription>
          </DialogHeader>
          {previewPhoto ? (
            <img
              src={resolveImageUrl(previewPhoto.imageUrl, previewPhoto.importImageUrl)}
              alt={previewPhoto.imageCaption || "Default photo"}
              className="max-h-[85vh] w-full rounded-lg object-contain shadow-2xl"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DuplicateSectionDialog({
  open,
  title,
  description,
  helperText,
  selectLabel,
  templates,
  selectedTemplateId,
  onTemplateChange,
  onClose,
  onDuplicate,
}: {
  open: boolean;
  title: string;
  description: string;
  helperText: string;
  selectLabel: string;
  templates: { id: string; name: string }[];
  selectedTemplateId: string;
  onTemplateChange: (id: string) => void;
  onClose: () => void;
  onDuplicate: () => void;
}) {
  const selectId = `${title.toLowerCase().replace(/\s+/g, "-")}-template`;
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">{helperText}</p>
          <div className="flex flex-col gap-2">
            <Label htmlFor={selectId} className="text-muted-foreground font-normal">
              {selectLabel}
            </Label>
            <Select value={selectedTemplateId} onValueChange={onTemplateChange}>
              <SelectTrigger id={selectId} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="sm:justify-start">
          <Button type="button" onClick={onDuplicate}>
            Duplicate
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditSectionDialog({
  draft,
  onDraftChange,
  onClose,
  onSave,
}: {
  draft: SectionEditorDraft | null;
  onDraftChange: (draft: SectionEditorDraft) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Dialog open={Boolean(draft)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-sm font-medium tracking-[0.28em] text-muted-foreground uppercase">
            {draft?.mode === "create" ? "Add Section" : "Edit Section"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {draft?.mode === "create"
              ? "Add a section name, icon, standards of practice, and reminders."
              : "Edit the section name, icon, standards of practice, and reminders."}
          </DialogDescription>
        </DialogHeader>
        {draft ? (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <Label htmlFor="section-name" className="text-muted-foreground font-normal">
                Section Name
              </Label>
              <Input
                id="section-name"
                value={draft.title}
                onChange={(event) =>
                  onDraftChange({ ...draft, title: event.target.value })
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="section-icon" className="text-muted-foreground font-normal">
                Icon
              </Label>
              <Select
                value={draft.icon}
                onValueChange={(icon) => onDraftChange({ ...draft, icon })}
              >
                <SelectTrigger id="section-icon" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SECTION_ICONS.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      <item.Icon />
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-muted-foreground font-normal">
                Standards of Practice
              </Label>
              <RichTextEditor
                key={`${draft.id}-sop`}
                value={draft.standardsOfPractice}
                onChange={(standardsOfPractice) =>
                  onDraftChange({ ...draft, standardsOfPractice })
                }
                placeholder="Enter standards of practice for this section"
                className="min-h-[220px]"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-muted-foreground font-normal">Reminders</Label>
              <RichTextEditor
                key={`${draft.id}-reminders`}
                value={draft.reminders}
                onChange={(reminders) => onDraftChange({ ...draft, reminders })}
                placeholder="Enter reminders for yourself for this section (accessible in the mobile app)"
                className="min-h-[220px]"
              />
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={onSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DuplicateItemDialog({
  open,
  mode = "duplicate",
  templates,
  sections,
  selectedTemplateId,
  selectedSectionId,
  onTemplateChange,
  onSectionChange,
  onClose,
  onConfirm,
}: {
  open: boolean;
  mode?: "duplicate" | "move";
  templates: { id: string; name: string }[];
  sections: TemplateSection[];
  selectedTemplateId: string;
  selectedSectionId?: string;
  onTemplateChange: (id: string) => void;
  onSectionChange: (id: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const isMove = mode === "move";
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isMove ? "Move Item" : "Duplicate Item"}</DialogTitle>
          <DialogDescription>
            {isMove
              ? "This will move this item, along with all comments within it."
              : "This will create a copy of this item, along with all comments within it."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-5">
          <p className="text-sm text-muted-foreground">
            {isMove
              ? "You may choose to send this item to another section in any template:"
              : "You may choose to send the duplicated item to another section in any template:"}
          </p>
          <div className="flex flex-col gap-2">
            <Label htmlFor="duplicate-item-template" className="text-muted-foreground font-normal">
              Template:
            </Label>
            <Select value={selectedTemplateId} onValueChange={onTemplateChange}>
              <SelectTrigger id="duplicate-item-template" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="duplicate-item-section" className="text-muted-foreground font-normal">
              {isMove ? "Move to section:" : "Duplicate to section:"}
            </Label>
            <Select
              value={selectedSectionId}
              onValueChange={onSectionChange}
              disabled={!sections.length}
            >
              <SelectTrigger id="duplicate-item-section" className="w-full">
                <SelectValue placeholder="Select a section" />
              </SelectTrigger>
              <SelectContent>
                {sections.map((section) => (
                  <SelectItem key={section.id} value={section.id}>
                    {section.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="sm:justify-start">
          <Button type="button" onClick={onConfirm} disabled={!selectedSectionId}>
            {isMove ? "Move" : "Duplicate"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DuplicateCommentDialog({
  open,
  mode = "duplicate",
  count = 1,
  templates,
  sections,
  items,
  selectedTemplateId,
  selectedSectionId,
  selectedItemId,
  onTemplateChange,
  onSectionChange,
  onItemChange,
  onClose,
  onConfirm,
}: {
  open: boolean;
  mode?: "duplicate" | "move";
  count?: number;
  templates: { id: string; name: string }[];
  sections: TemplateSection[];
  items: TemplateItem[];
  selectedTemplateId: string;
  selectedSectionId?: string;
  selectedItemId?: string;
  onTemplateChange: (id: string) => void;
  onSectionChange: (id: string) => void;
  onItemChange: (id: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const isMove = mode === "move";
  const many = (count ?? 1) > 1;
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isMove
              ? many
                ? "Move Comments"
                : "Move Comment"
              : many
                ? "Duplicate Comments"
                : "Duplicate Comment"}
          </DialogTitle>
          <DialogDescription>
            {isMove
              ? many
                ? `This will move ${count} comments.`
                : "This will move this comment."
              : many
                ? `This will create copies of ${count} comments.`
                : "This will create a copy of this comment."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-5">
          <p className="text-sm text-muted-foreground">
            {isMove
              ? many
                ? "You may choose to send these comments to another item:"
                : "You may choose to send this comment to another item:"
              : many
                ? "You may choose to send the duplicated comments to another item:"
                : "You may choose to send the duplicated comment to another item:"}
          </p>
          <div className="flex flex-col gap-2">
            <Label htmlFor="duplicate-comment-template" className="text-muted-foreground font-normal">
              Template:
            </Label>
            <Select value={selectedTemplateId} onValueChange={onTemplateChange}>
              <SelectTrigger id="duplicate-comment-template" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="duplicate-comment-section" className="text-muted-foreground font-normal">
              {isMove ? "Move to section:" : "Duplicate to section:"}
            </Label>
            <Select
              value={selectedSectionId}
              onValueChange={onSectionChange}
              disabled={!sections.length}
            >
              <SelectTrigger id="duplicate-comment-section" className="w-full">
                <SelectValue placeholder="Select a section" />
              </SelectTrigger>
              <SelectContent>
                {sections.map((section) => (
                  <SelectItem key={section.id} value={section.id}>
                    {section.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="duplicate-comment-item" className="text-muted-foreground font-normal">
              {isMove ? "Move to item:" : "Duplicate to item:"}
            </Label>
            <Select
              value={selectedItemId}
              onValueChange={onItemChange}
              disabled={!items.length}
            >
              <SelectTrigger id="duplicate-comment-item" className="w-full">
                <SelectValue placeholder="Select an item" />
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="sm:justify-start">
          <Button type="button" onClick={onConfirm} disabled={!selectedSectionId || !selectedItemId}>
            {isMove ? "Move" : "Duplicate"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditItemDialog({
  draft,
  onDraftChange,
  onClose,
  onSave,
}: {
  draft: ItemEditorDraft | null;
  onDraftChange: (draft: ItemEditorDraft) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Dialog open={Boolean(draft)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-sm font-medium tracking-[0.28em] text-muted-foreground uppercase">
            {draft?.mode === "create" ? "Add Item" : "Edit Item"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {draft?.mode === "create"
              ? "Add an item name and reminders."
              : "Edit the item name and reminders."}
          </DialogDescription>
        </DialogHeader>
        {draft ? (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <Label htmlFor="item-name" className="text-muted-foreground font-normal">
                Item Name
              </Label>
              <Input
                id="item-name"
                value={draft.title}
                onChange={(event) =>
                  onDraftChange({ ...draft, title: event.target.value })
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-muted-foreground font-normal">Reminders</Label>
              <RichTextEditor
                key={draft.id}
                value={draft.reminders}
                onChange={(reminders) => onDraftChange({ ...draft, reminders })}
                placeholder="Put notes for yourself here - you will be able to refer to them in the mobile app. Use them to make sure you don't miss anything or to remind yourself of easy-to-miss items."
                className="min-h-[220px]"
              />
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={onSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddCommentDialog({
  draft,
  sectionTitle = "",
  itemTitle = "",
  onDraftChange,
  onClose,
  onSave,
}: {
  draft: CommentEditorDraft | null;
  sectionTitle?: string;
  itemTitle?: string;
  onDraftChange: (draft: CommentEditorDraft) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const isDefect = draft?.type === "defect";
  const answerFormats = isDefect ? DEFECT_ANSWER_FORMATS : ANSWER_FORMATS;
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const runGenerateWithAi = async () => {
    if (!draft || aiBusy) return;
    if (!draft.name.trim()) {
      onDraftChange({ ...draft, nameError: true });
      return;
    }
    setAiBusy(true);
    setAiError(null);
    try {
      const result = await assistCommentWithAi({
        mode: "generate",
        sectionTitle,
        itemTitle,
        commentType: draft.type,
        answerFormat: draft.answerFormat,
        name: draft.name.trim(),
        choices: draft.choices,
        defaultText: plainFromRichText(draft.defaultText),
        category: draft.category,
        recommendation: draft.recommendation,
      });
      if (result.status === "unavailable" || result.status === "rejected") {
        setAiError(result.message || "AI is unavailable right now.");
        return;
      }
      onDraftChange({
        ...draft,
        name: result.name || draft.name,
        choices: result.choices ?? draft.choices,
        defaultText: result.defaultText
          ? richTextFromPlain(result.defaultText)
          : draft.defaultText,
        category: (result.category as DefectCategory) || draft.category,
        recommendation: result.recommendation || draft.recommendation,
        nameError: false,
      });
    } catch {
      setAiError("AI generate failed. Please try again.");
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <Dialog open={Boolean(draft)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-sm font-medium tracking-[0.28em] text-muted-foreground uppercase">
            Add a New Comment
          </DialogTitle>
          <DialogDescription>
            This new comment will be saved to your template and available as an add-on to any new
            report.
          </DialogDescription>
        </DialogHeader>
        {draft ? (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Label htmlFor="comment-answer-format" className="text-muted-foreground font-normal">
                  Answer Format
                </Label>
                <Select
                  value={draft.answerFormat}
                  onValueChange={(answerFormat) => onDraftChange({ ...draft, answerFormat })}
                >
                  <SelectTrigger id="comment-answer-format" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {answerFormats.map((format) => (
                      <SelectItem key={format.id} value={format.id}>
                        {format.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <Button
                  type="button"
                  className="shrink-0 bg-green-700 text-white hover:bg-green-800"
                  disabled={aiBusy}
                  onClick={() => void runGenerateWithAi()}
                >
                  {aiBusy ? <Loader2 className="animate-spin" /> : <Wand2 />}
                  Generate using AI
                </Button>
                {aiError ? (
                  <p className="max-w-[220px] text-xs text-destructive">{aiError}</p>
                ) : null}
              </div>
            </div>
            {draft.answerFormat === "multiple" ||
            (!isDefect &&
              (draft.answerFormat === "number" || draft.answerFormat === "numeric-range")) ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="comment-choices" className="text-muted-foreground font-normal">
                  {draft.answerFormat === "multiple"
                    ? "Answer Choices (comma-separated)"
                    : "Unit Type Choices (comma-separated)"}
                </Label>
                <textarea
                  id="comment-choices"
                  value={draft.choices}
                  onChange={(event) => onDraftChange({ ...draft, choices: event.target.value })}
                  placeholder={
                    draft.answerFormat === "multiple" ? "Concrete, Wood, Metal" : "kg, lbs"
                  }
                  className={cn(
                    "placeholder:text-muted-foreground dark:bg-input/30 border-input flex min-h-[96px] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none",
                    "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                  )}
                />
              </div>
            ) : null}
            <div className="flex flex-col gap-2">
              <Label htmlFor="comment-name" className="text-muted-foreground font-normal">
                Name
              </Label>
              <Input
                id="comment-name"
                value={draft.name}
                aria-invalid={draft.nameError || undefined}
                onChange={(event) =>
                  onDraftChange({
                    ...draft,
                    name: event.target.value,
                    nameError: false,
                  })
                }
              />
              {draft.nameError ? (
                <p className="text-sm text-destructive">The name field is required.</p>
              ) : null}
            </div>
            {draft.answerFormat === "checkbox" ? (
              <label className="flex w-fit items-center gap-2 text-sm">
                <Checkbox
                  checked={draft.defaultChecked}
                  onCheckedChange={(value) =>
                    onDraftChange({ ...draft, defaultChecked: value === true })
                  }
                />
                Default to checked?
              </label>
            ) : null}
            {!isDefect &&
            (draft.answerFormat === "number" || draft.answerFormat === "numeric-range") ? (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="comment-default-value" className="text-muted-foreground font-normal">
                    Default Value
                  </Label>
                  <Input
                    id="comment-default-value"
                    value={draft.defaultValue}
                    onChange={(event) =>
                      onDraftChange({ ...draft, defaultValue: event.target.value })
                    }
                  />
                </div>
                {draft.answerFormat === "numeric-range" ? (
                  <div className="flex flex-col gap-2">
                    <Label
                      htmlFor="comment-default-value-2"
                      className="text-muted-foreground font-normal"
                    >
                      Default Value 2
                    </Label>
                    <Input
                      id="comment-default-value-2"
                      value={draft.defaultValue2}
                      onChange={(event) =>
                        onDraftChange({ ...draft, defaultValue2: event.target.value })
                      }
                    />
                  </div>
                ) : null}
              </>
            ) : null}
            {isDefect ? (
              <>
                <div
                  className="grid grid-cols-3 overflow-hidden rounded-md border"
                  role="radiogroup"
                  aria-label="Comment category"
                >
                  {DEFECT_CATEGORIES.map((category) => {
                    const selected = draft.category === category.id;
                    return (
                      <button
                        key={category.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={category.label}
                        className={cn(
                          "flex h-12 items-center justify-center border-r last:border-r-0",
                          selected
                            ? category.activeClass
                            : "bg-muted/40 text-muted-foreground hover:bg-muted"
                        )}
                        onClick={() => onDraftChange({ ...draft, category: category.id })}
                      >
                        <category.Icon className="size-5" />
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="comment-recommendation" className="text-muted-foreground font-normal">
                    Recommendation
                  </Label>
                  <Select
                    value={draft.recommendation}
                    onValueChange={(recommendation) =>
                      onDraftChange({ ...draft, recommendation })
                    }
                  >
                    <SelectTrigger id="comment-recommendation" className="w-full">
                      <SelectValue placeholder="Select a recommendation" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {RECOMMENDATIONS.map((recommendation) => (
                        <SelectItem key={recommendation} value={recommendation}>
                          {recommendation}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : null}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="comment-location" className="text-muted-foreground font-normal">
                  Default Location
                </Label>
                <Pencil className="size-3.5 text-muted-foreground" />
              </div>
              <Input
                id="comment-location"
                value={draft.defaultLocation}
                onChange={(event) =>
                  onDraftChange({ ...draft, defaultLocation: event.target.value })
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-muted-foreground font-normal">Default Text</Label>
              <RichTextEditor
                key={draft.id}
                value={draft.defaultText}
                onChange={(defaultText) => onDraftChange({ ...draft, defaultText })}
                placeholder="Enter text here"
                className="min-h-[220px]"
              />
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={onSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
