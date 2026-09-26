import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

export interface AreaScope {
  id: number;
  scope_field: string;
  scope_value: string;
}

export interface User {
  id: number;
  username: string;
  role: string;
  role_label: string;
  is_active: boolean;
  permissions: string[];
  area_scopes: AreaScope[];
  candidate_id: number | null;
  created_at: string;
  last_login_at: string | null;
}

export interface Candidate {
  id: number;
  name: string;
  constituency_label: string | null;
  symbol_name: string | null;
  slogan: string | null;
  primary_color: string | null;
  accent_color: string | null;
  is_active: boolean;
  has_symbol_image: boolean;
  has_photo_image: boolean;
  created_at: string;
}

export interface RoleDef {
  id: number;
  key: string;
  label: string;
}

export interface Voter {
  id: number;
  serial_no: string | null;
  name: string;
  voter_no: string | null;
  father_name: string | null;
  mother_name: string | null;
  occupation: string | null;
  dob: string | null;
  gender: string | null;
  district: string | null;
  municipality: string | null;
  upazila: string | null;
  union_name: string | null;
  ward: string | null;
  area_no: string | null;
  area_name: string | null;
  address: string | null;
  upazila_folder: string | null;
  union_folder: string | null;
  area_folder: string | null;
  source_file: string | null;
  flag_reasons: string[];
  is_flagged: boolean;
  extra_fields: Record<string, string>;
  import_batch_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface VoterListResponse {
  items: Voter[];
  total: number;
  page: number;
  page_size: number;
}

export interface FieldDef {
  id: number;
  key: string;
  label: string;
  field_type: "text" | "number" | "date" | "boolean" | "select";
  options: string[] | null;
}

export interface ImportBatch {
  id: number;
  filename: string;
  imported_at: string;
  row_count: number;
  inserted_count: number;
  updated_count: number;
  error_count: number;
  status: string;
}

export interface ImportResult {
  import_batch_id: number;
  inserted: number;
  updated: number;
  errors: number;
  total_rows: number;
}

export interface StatsSummary {
  total_voters: number;
  flagged_count: number;
  by_ward: Record<string, number>;
  by_upazila: Record<string, number>;
  by_gender: Record<string, number>;
}

export interface BrowseEntry {
  name: string;
  path: string;
  type: "dir" | "pdf";
  size_mb?: number;
}

export interface BrowseResponse {
  path: string;
  parent: string | null;
  entries: BrowseEntry[];
}

export interface ConvertStatus {
  available: boolean;
  reason: string;
}

export interface ConvertProgress {
  page: number;
  total_pages: number;
  cell: number;
  total_cells: number;
  voters: number;
  elapsed: number;
}

export interface ConvertResult {
  total_voters: number;
  flagged: number;
  elapsed_minutes: number;
  excel_path: string | null;
}

export interface ConvertPreview {
  columns: { key: string; label: string }[];
  rows: Record<string, string>[];
  total: number;
  page: number;
  page_size: number;
}

export interface ConvertCommitResult {
  import_batch_id: number;
  inserted: number;
  updated: number;
  errors: number;
  total_rows: number;
}

export type ConvertJobStatus = "starting" | "running" | "cancelling" | "cancelled" | "done" | "error";

export interface ConvertActiveResponse {
  job_id: string | null;
  status?: ConvertJobStatus;
  progress?: ConvertProgress | null;
  result?: ConvertResult | null;
  error?: string | null;
}

export type BatchFileStatus = "pending" | "running" | "done" | "error" | "cancelled" | "skipped";

export interface BatchFileEntry {
  path: string;
  status: BatchFileStatus;
  total_voters?: number;
  flagged?: number;
  inserted?: number;
  updated?: number;
  elapsed_minutes?: number;
  excel_path?: string | null;
  error?: string;
}

export type BatchStatus = "running" | "cancelling" | "cancelled" | "done";

export interface BatchActiveResponse {
  batch_id: string | null;
  status?: BatchStatus;
  root?: string;
  total_files?: number;
  current_index?: number | null;
  current_progress?: ConvertProgress | null;
  files?: BatchFileEntry[];
  started_at?: string;
}

export interface PrintBatchSummary {
  id: number;
  label: string;
  voter_count: number;
  printed_count: number;
  distributed_count: number;
  created_at: string;
  printed_at: string | null;
}

export type PrintItemStatus = "pending" | "printed" | "distributed";

export interface PrintBatchItemOut {
  id: number;
  voter_id: number;
  name: string;
  voter_no: string | null;
  address: string | null;
  status: PrintItemStatus;
  distributed_at: string | null;
}

export interface PrintBatchDetail extends PrintBatchSummary {
  items: PrintBatchItemOut[];
}

export interface PublicLookupRequest {
  name: string;
  father_name: string;
  dob: string;
  mother_name?: string;
}

export interface PublicVoterOut {
  name: string;
  voter_no: string | null;
  serial_no: string | null;
  ward: string | null;
  upazila: string | null;
  union_name: string | null;
  area_name: string | null;
}

export interface PublicLookupResult {
  found: boolean;
  need_mother_name: boolean;
  voter: PublicVoterOut | null;
}

export interface ActivityLogEntry {
  id: number;
  user_id: number | null;
  username: string;
  action: string;
  detail: Record<string, unknown> | null;
  ip: string | null;
  created_at: string;
}

export interface ActivityLogResponse {
  items: ActivityLogEntry[];
  total: number;
  page: number;
  page_size: number;
}

export const VOTER_LABELS: Record<string, string> = {
  serial_no: "ক্রমিক নং",
  name: "নাম",
  voter_no: "ভোটার নং",
  father_name: "পিতার নাম",
  mother_name: "মাতার নাম",
  occupation: "পেশা",
  dob: "জন্ম তারিখ",
  gender: "লিঙ্গ",
  district: "জেলা",
  municipality: "পৌরসভা",
  upazila: "উপজেলা",
  union_name: "ইউনিয়ন/ওয়ার্ড",
  ward: "ওয়ার্ড নং",
  area_no: "এলাকা নং",
  area_name: "এলাকার নাম",
  address: "ঠিকানা",
};
