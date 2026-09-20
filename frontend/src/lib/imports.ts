import api from "./axios";

export type ImportField = {
  key: string;
  label: string;
  group: string;
};

export type ImportStats = {
  totalRows: number;
  estSections: number;
  estLineItems: number;
  estComments: number;
};

export type ColumnMapping = {
  sourceColumn: string;
  mapsTo: string | null;
};

export type RecommendationMapping = {
  sourceValue: string;
  mapsTo: string | null;
};

export type ParseImportResult = {
  importSessionId: string;
  sourceFileName: string;
  headers: string[];
  samples: Record<string, string[]>;
  stats: ImportStats;
  suggestedMappings: ColumnMapping[];
  recommendationValues: string[];
  suggestedRecommendationMappings: RecommendationMapping[];
};

export type ApplyImportResult = {
  templateId: string;
  templateName: string;
  importId: string;
  status: string;
  counts: {
    sections: number;
    lineItems: number;
    comments: number;
    images: number;
    warnings: number;
    totalRows: number;
  };
  warnings: Array<{
    code: string;
    message: string;
    severity: string;
    sourceRow?: number | null;
    sourceColumn?: string | null;
  }>;
};

export async function listImportFields(): Promise<ImportField[]> {
  const response = await api.get<ImportField[]>("/imports/fields");
  return response.data;
}

export async function listRecommendationOptions(): Promise<string[]> {
  const response = await api.get<{ values: string[] }>("/imports/recommendations");
  return response.data.values;
}

export async function parseImportFile(file: File): Promise<ParseImportResult> {
  const form = new FormData();
  form.append("file", file);
  const response = await api.post<ParseImportResult>("/imports/parse", form, {
    timeout: 120000,
    headers: { "Content-Type": "multipart/form-data" },
    transformRequest: [
      (data, headers) => {
        if (data instanceof FormData && headers) {
          delete headers["Content-Type"];
        }
        return data;
      },
    ],
  });
  return response.data;
}

export async function applyImport(payload: {
  importSessionId: string;
  mappings: ColumnMapping[];
  recommendationMappings?: RecommendationMapping[];
  templateName: string;
  description?: string;
}): Promise<ApplyImportResult> {
  const response = await api.post<ApplyImportResult>("/imports/apply", payload, {
    timeout: 300000,
  });
  return response.data;
}
