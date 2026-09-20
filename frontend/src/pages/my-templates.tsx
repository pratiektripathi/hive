import { useMemo, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
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
import { SEED_TEMPLATES, type TemplateRow } from "@/lib/templates";

type SortKey = "updatedAt" | "name" | "createdAt";
type ViewMode = "list" | "grid";

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

function nextId() {
  return `template-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function MyTemplates() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<TemplateRow[]>(SEED_TEMPLATES);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

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

  const createTemplate = () => {
    navigate(`/templates/${nextId()}`, { state: { name: "Untitled Template" } });
  };

  const editTemplate = (template: TemplateRow) => {
    navigate(`/templates/${template.id}`, { state: { name: template.name } });
  };

  const duplicateTemplate = (template: TemplateRow) => {
    const now = new Date().toISOString();
    setTemplates((current) => [
      {
        ...template,
        id: nextId(),
        name: `${template.name} copy`,
        updatedAt: now,
        createdAt: now,
      },
      ...current,
    ]);
  };

  const deleteTemplate = (id: string) => {
    setTemplates((current) => current.filter((template) => template.id !== id));
  };

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
          <Button onClick={createTemplate} className="h-10 dark:font-bold">
            <Plus />
            Create Template
          </Button>
        </div>
      </div>

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
                          onDelete={() => deleteTemplate(template.id)}
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
                    No templates found.
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
                      onDelete={() => deleteTemplate(template.id)}
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
                No templates found.
              </CardContent>
            </Card>
          )}
        </div>
      )}
      </div>
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
