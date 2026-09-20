import api from "./axios";
import conf from "../conf/conf";
import type { RichTextValue } from "@/components/rich-text-editor";

export type CommentType = "info" | "limit" | "defect";
export type DefectCategory = "low" | "medium" | "high";

export type CommentDefaultPhoto = {
  id: string;
  imageUrl: string;
  importImageUrl?: string | null;
  imageCaption?: string;
  sortOrder?: number;
};

export type TemplateComment = {
  id: string;
  name: string;
  type: CommentType;
  answerFormat?: string;
  answerChoices?: string;
  unitChoices?: string;
  category?: DefectCategory;
  recommendation?: string;
  defaultChecked?: boolean;
  defaultValue?: string;
  defaultValue2?: string;
  defaultLocation?: string;
  defaultText?: RichTextValue;
  defaultPhotos?: CommentDefaultPhoto[];
};

export type TemplateItem = {
  id: string;
  title: string;
  comments: TemplateComment[];
  reminders?: RichTextValue;
};

export type TemplateSection = {
  id: string;
  title: string;
  icon: string;
  items: TemplateItem[];
  standardsOfPractice?: RichTextValue;
  reminders?: RichTextValue;
};

export interface TemplateRow {
  id: string;
  name: string;
  sections: number;
  lineItems: number;
  updatedAt: string;
  createdAt: string;
}

export interface TemplateDetail {
  id: string;
  name: string;
  updatedAt: string;
  createdAt: string;
  sections: TemplateSection[];
}

export const RECOMMENDATIONS = [
  "No Recommendation",
  "Appliance Repair",
  "Builder",
  "Cabinet Contractor",
  "Carpentry Contractor",
  "Carpet Cleaner",
  "Chimney Repair Contractor",
  "Chimney Sweep",
  "Cleaning Service",
  "Concrete Contractor",
  "Countertop Contractor",
  "Deck Contractor",
  "DIY",
  "Door Repair and Installation Contractor",
  "Driveway Contractor",
  "Drywall Contractor",
  "Electrical Contractor",
  "Environmental Contractor",
  "Fence Contractor",
  "Fireplace Contractor",
  "Fire Suppression Contractor",
  "Flooring Contractor",
  "Foundation Contractor",
  "Garage Door Contractor",
  "General Contractor",
  "Grading Contractor",
  "Gutter Contractor",
  "Handyman",
  "Handyman/DIY",
  "Heating and Cooling Contractor",
  "Home Energy Contractor",
  "Homeowners Association",
  "HVAC Professional",
  "Inquire With Seller",
  "Insulation Contractor",
  "Landscaping Contractor",
  "Lawncare Professional",
  "Masonry, Concrete, Brick & Stone",
  "Masonry Contractor",
  "Masonry Restoration Contractor",
  "Mold Inspector",
  "Mold Remediation Contractor",
  "Monitor",
  "Painting Contractor",
  "Pest Control Pro",
  "Plumbing Contractor",
  "Professional Engineer",
  "Professional Locksmith",
  "Qualified Professional",
  "Radon Mitigation Specialist",
  "Roofing Professional",
  "Septic System Contractor",
  "Sheet Metal Contractor",
  "Siding Contractor",
  "Solar Panel Contractor",
  "Structural Engineer",
  "Stucco Repair Contractor",
  "Swimming Pool / Spa Contractor",
  "Tile Contractor",
  "Tree Service",
  "Utility Company",
  "Waterproofing Contractor",
  "Well Service Contractor",
  "Window Repair and Installation Contractor",
] as const;

export async function listTemplates(): Promise<TemplateRow[]> {
  const response = await api.get<TemplateRow[]>("/templates/");
  return response.data;
}

export async function getTemplate(id: string): Promise<TemplateDetail> {
  const response = await api.get<TemplateDetail>(`/templates/${id}`);
  return response.data;
}

export async function createTemplate(name: string): Promise<TemplateRow> {
  const response = await api.post<TemplateRow>("/templates/", { name });
  return response.data;
}

export async function saveTemplate(
  id: string,
  payload: { name: string; sections: TemplateSection[] }
): Promise<TemplateDetail> {
  const response = await api.put<TemplateDetail>(`/templates/${id}`, payload);
  return response.data;
}

export async function deleteTemplate(id: string): Promise<void> {
  await api.delete(`/templates/${id}`);
}

export async function copyTemplate(
  id: string,
  name?: string
): Promise<TemplateDetail> {
  const response = await api.post<TemplateDetail>(`/templates/${id}/copy`, {
    name,
  });
  return response.data;
}

export function resolveImageUrl(
  path: string | undefined | null,
  importImageUrl?: string | null
): string {
  const candidate =
    path && !path.startsWith("import:")
      ? path
      : importImageUrl || path || "";
  if (!candidate || candidate.startsWith("import:")) return "";
  if (/^https?:\/\//i.test(candidate)) return candidate;
  const origin = conf.baseURL.replace(/\/api\/?$/, "");
  return `${origin}${candidate.startsWith("/") ? candidate : `/${candidate}`}`;
}

export async function uploadCommentImage(
  templateId: string,
  commentId: string,
  file: File,
  caption: string
): Promise<CommentDefaultPhoto> {
  const form = new FormData();
  form.append("file", file);
  form.append("caption", caption);
  const response = await api.post<CommentDefaultPhoto>(
    `/templates/${templateId}/comments/${commentId}/images`,
    form,
    {
      headers: { "Content-Type": "multipart/form-data" },
      transformRequest: [
        (data, headers) => {
          if (data instanceof FormData && headers) {
            // Let the browser set multipart boundary; default axios JSON Content-Type breaks uploads.
            delete headers["Content-Type"];
          }
          return data;
        },
      ],
    }
  );
  return response.data;
}

export async function updateCommentImageCaption(
  templateId: string,
  imageId: string,
  imageCaption: string
): Promise<CommentDefaultPhoto> {
  const response = await api.patch<CommentDefaultPhoto>(
    `/templates/${templateId}/images/${imageId}`,
    { imageCaption }
  );
  return response.data;
}

export async function deleteCommentImage(
  templateId: string,
  imageId: string
): Promise<void> {
  await api.delete(`/templates/${templateId}/images/${imageId}`);
}
