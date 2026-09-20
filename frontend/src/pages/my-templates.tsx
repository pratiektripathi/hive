import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpDown,
  ChevronRight,
  Copy,
  FileText,
  LayoutGrid,
  List,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import {
  CreateTemplateDialog,
  type CreateTemplateMode,
} from "@/components/create-template-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  copyTemplate,
  createTemplate,
  deleteTemplate,
  listTemplates,
  type TemplateRow,
} from "@/lib/templates";

type SortKey = "updatedAt" | "name" | "createdAt";
type ViewMode = "list" | "grid";

const DELETE_CONFIRM_WORD = "delete";

const SORT_LABELS: Record<SortKey, string> = {
  updatedAt: "Last edited",
  name: "Name",
  createdAt: "Created",
};

function formatRelative(iso: string) {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return formatCreated(iso);
}

function formatCreated(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function MyTemplates() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<TemplateRow | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const canConfirmDelete =
    deleteConfirmText.trim().toLowerCase() === DELETE_CONFIRM_WORD;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const rows = await listTemplates();
        if (!cancelled) setTemplates(rows);
      } catch {
        if (!cancelled) setError("Failed to load templates.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredTemplates = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = needle
      ? templates.filter((template) => template.name.toLowerCase().includes(needle))
      : [...templates];

    rows.sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name);
      return new Date(b[sortKey]).getTime() - new Date(a[sortKey]).getTime();
    });

    return rows;
  }, [query, sortKey, templates]);

  const handleCreateSelect = async (mode: CreateTemplateMode) => {
    // Only "Create from Scratch" / Start Building creates a template for now.
    // AI and manual import will get their own flows later.
    if (mode !== "scratch") {
      setError("Import options are coming soon. Use Start Building to create from scratch.");
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const created = await createTemplate("Untitled Template");
      setCreateDialogOpen(false);
      navigate(`/templates/${created.id}`, {
        state: { name: created.name, createMode: mode },
      });
    } catch {
      setError("Failed to create template.");
    } finally {
      setCreating(false);
    }
  };

  const editTemplate = (template: TemplateRow) => {
    navigate(`/templates/${template.id}`, { state: { name: template.name } });
  };

  const duplicateTemplate = async (template: TemplateRow) => {
    try {
      const copied = await copyTemplate(template.id);
      setTemplates((current) => [
        {
          id: copied.id,
          name: copied.name,
          sections: copied.sections.length,
          lineItems: copied.sections.reduce((sum, section) => sum + section.items.length, 0),
          updatedAt: copied.updatedAt,
          createdAt: copied.createdAt,
        },
        ...current,
      ]);
    } catch {
      setError("Failed to duplicate template.");
    }
  };

  const openDeleteDialog = (template: TemplateRow) => {
    setPendingDelete(template);
    setDeleteConfirmText("");
    setError(null);
  };

  const closeDeleteDialog = () => {
    if (deleting) return;
    setPendingDelete(null);
    setDeleteConfirmText("");
  };

  const confirmDeleteTemplate = async () => {
    if (!pendingDelete || !canConfirmDelete) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteTemplate(pendingDelete.id);
      setTemplates((current) =>
        current.filter((template) => template.id !== pendingDelete.id)
      );
      setPendingDelete(null);
      setDeleteConfirmText("");
    } catch {
      setError("Failed to delete template.");
    } finally {
      setDeleting(false);
    }
  };

  const emptyMessage = loading
    ? "Loading templates..."
    : error
      ? error
      : templates.length === 0
        ? "No templates yet. Create your first template."
        : "No templates found.";

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="flex items-center gap-2 px-2 py-1">
        <FileText className="size-5" />
        <h1 className="text-xl font-normal leading-none">My Templates</h1>
      </header>
      <Separator />

      <div className="mt-5 flex flex-col gap-3 px-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search templates..."
            className="h-10 rounded-md pl-9"
          />
        </div>
        <div className="flex h-10 items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-10 text-muted-foreground">
                <ArrowUpDown />
                {SORT_LABELS[sortKey]}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSortKey("updatedAt")}>
                Last edited
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortKey("name")}>Name</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortKey("createdAt")}>
                Created
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex h-10 overflow-hidden rounded-md border">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn("h-full w-10 rounded-none", viewMode === "list" && "bg-muted")}
              onClick={() => setViewMode("list")}
              aria-label="List view"
            >
              <List />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn("h-full w-10 rounded-none border-l", viewMode === "grid" && "bg-muted")}
              onClick={() => setViewMode("grid")}
              aria-label="Grid view"
            >
              <LayoutGrid />
            </Button>
          </div>
          <Button
            onClick={() => {
              setError(null);
              setCreateDialogOpen(true);
            }}
            className="h-10 dark:font-bold"
          >
            <Plus />
            Create Template
          </Button>
        </div>
      </div>

      {error ? (
        <p className="mt-3 px-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <CreateTemplateDialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          if (!creating) setCreateDialogOpen(open);
        }}
        onSelect={handleCreateSelect}
        busy={creating}
      />

      <div className="px-3">
      {viewMode === "list" ? (
        <div className="mt-5 overflow-hidden rounded-xl border">
          <Table>
            <TableHeader className="bg-muted/60">
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-28">Sections</TableHead>
                <TableHead className="w-32">Line Items</TableHead>
                <TableHead className="w-32">Last Edited</TableHead>
                <TableHead className="w-36">Created</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTemplates.length ? (
                filteredTemplates.map((template) => (
                  <TableRow
                    key={template.id}
                    className="cursor-pointer"
                    onClick={() => editTemplate(template)}
                  >
                    <TableCell className="font-medium">{template.name}</TableCell>
                    <TableCell className="text-muted-foreground">{template.sections}</TableCell>
                    <TableCell className="text-muted-foreground">{template.lineItems}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatRelative(template.updatedAt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatCreated(template.createdAt)}
                    </TableCell>
                    <TableCell
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <TemplateActions
                          onEdit={() => editTemplate(template)}
                          onDuplicate={() => duplicateTemplate(template)}
                          onDelete={() => openDeleteDialog(template)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground"
                          aria-label={`Edit ${template.name}`}
                          onClick={() => editTemplate(template)}
                        >
                          <ChevronRight />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredTemplates.length ? (
            filteredTemplates.map((template) => (
              <Card
                key={template.id}
                className="cursor-pointer"
                onClick={() => editTemplate(template)}
              >
                <CardHeader>
                  <CardTitle className="text-base leading-snug">{template.name}</CardTitle>
                  <CardAction onClick={(event) => event.stopPropagation()}>
                    <TemplateActions
                      onEdit={() => editTemplate(template)}
                      onDuplicate={() => duplicateTemplate(template)}
                      onDelete={() => openDeleteDialog(template)}
                    />
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-2 gap-3 text-sm text-muted-foreground">
                    <div>
                      <dt>Sections</dt>
                      <dd className="font-medium text-foreground">{template.sections}</dd>
                    </div>
                    <div>
                      <dt>Line Items</dt>
                      <dd className="font-medium text-foreground">{template.lineItems}</dd>
                    </div>
                    <div>
                      <dt>Last Edited</dt>
                      <dd>{formatRelative(template.updatedAt)}</dd>
                    </div>
                    <div>
                      <dt>Created</dt>
                      <dd>{formatCreated(template.createdAt)}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="col-span-full">
              <CardContent className="py-12 text-center text-muted-foreground">
                {emptyMessage}
              </CardContent>
            </Card>
          )}
        </div>
      )}
      </div>

      <Dialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) closeDeleteDialog();
        }}
      >
        <DialogContent showCloseButton={!deleting}>
          <DialogHeader>
            <DialogTitle>Delete template?</DialogTitle>
            <DialogDescription>
              This permanently deletes{" "}
              <span className="font-medium text-foreground">
                {pendingDelete?.name ?? "this template"}
              </span>{" "}
              and cannot be undone. Type{" "}
              <span className="font-medium text-foreground">{DELETE_CONFIRM_WORD}</span>{" "}
              to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="delete-template-confirm">Confirmation</Label>
            <Input
              id="delete-template-confirm"
              value={deleteConfirmText}
              onChange={(event) => setDeleteConfirmText(event.target.value)}
              placeholder={DELETE_CONFIRM_WORD}
              autoComplete="off"
              disabled={deleting}
              onKeyDown={(event) => {
                if (event.key === "Enter" && canConfirmDelete && !deleting) {
                  event.preventDefault();
                  void confirmDeleteTemplate();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeDeleteDialog}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!canConfirmDelete || deleting}
              onClick={() => void confirmDeleteTemplate()}
            >
              {deleting ? "Deleting..." : "Delete template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TemplateActions({
  onEdit,
  onDuplicate,
  onDelete,
}: {
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground"
          aria-label="Template actions"
        >
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>
          <Pencil />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDuplicate}>
          <Copy />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
