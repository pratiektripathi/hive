export interface TemplateRow {
  id: string;
  name: string;
  sections: number;
  lineItems: number;
  updatedAt: string;
  createdAt: string;
}

export const SEED_TEMPLATES: TemplateRow[] = [
  {
    id: "internachi-commercial",
    name: "InterNACHI Commercial Template-2026-09-18",
    sections: 15,
    lineItems: 67,
    updatedAt: "2026-09-19T10:00:00.000Z",
    createdAt: "2026-09-18T12:00:00.000Z",
  },
  {
    id: "binsr-standard-2",
    name: "Binsr Standard Template 2.0",
    sections: 19,
    lineItems: 104,
    updatedAt: "2026-09-19T09:00:00.000Z",
    createdAt: "2026-09-18T12:00:00.000Z",
  },
];

export function getTemplateById(id: string | undefined) {
  if (!id) return undefined;
  return SEED_TEMPLATES.find((template) => template.id === id);
}
