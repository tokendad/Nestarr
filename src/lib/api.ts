// V2.0: In unified container, API is served from the same origin
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ||
  "";  // Empty string means same origin

export interface LoginResponse {
  access_token: string;
  token_type: string;
  must_change_password?: boolean;  // Flag indicating user must change password
}

export interface Warranty {
  id?: string;
  type: 'manufacturer' | 'extended';
  provider?: string | null;
  policy_number?: string | null;
  duration_months?: number | null;
  expiration_date?: string | null;
  notes?: string | null;
}

export interface Photo {
  id: string;
  item_id: string;
  path: string;
  mime_type?: string | null;
  is_primary: boolean;
  is_data_tag: boolean;
  photo_type?: string | null;
  uploaded_at: string;
}

export interface Document {
  id: string;
  item_id: string;
  filename: string;
  mime_type?: string | null;
  path: string;
  document_type?: string | null;
  uploaded_at: string;
}

export interface Tag {
  id: string;
  name: string;
  is_predefined: boolean;
  created_at: string;
  updated_at: string;
}

export interface ContactInfo {
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
}

export interface MaintenanceTask {
  id: string;
  item_id: string;
  name: string;
  description?: string | null;
  next_due_date?: string | null;
  recurrence_type: 'none' | 'daily' | 'weekly' | 'bi_weekly' | 'monthly' | 'bi_monthly' | 'yearly' | 'custom_days';
  recurrence_interval?: number | null;
  color?: string;
  last_completed?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceTaskCreate {
  item_id: string;
  name: string;
  description?: string | null;
  next_due_date?: string | null;
  recurrence_type: 'none' | 'daily' | 'weekly' | 'bi_weekly' | 'monthly' | 'bi_monthly' | 'yearly' | 'custom_days';
  recurrence_interval?: number | null;
  color?: string;
  last_completed?: string | null;
}

export interface Item {
  id: number | string;
  name: string;
  description?: string | null;
  brand?: string | null;
  model_number?: string | null;
  serial_number?: string | null;
  purchase_date?: string | null;
  purchase_price?: number | null;
  estimated_value?: number | null;
  estimated_value_ai_date?: string | null;  // Date when AI estimated the value (MM/DD/YY format)
  estimated_value_user_date?: string | null;  // Date when user supplied the value (MM/DD/YY format)
  estimated_value_user_name?: string | null;  // Username who supplied the value
  retailer?: string | null;
  upc?: string | null;
  location_id?: number | string | null;
  warranties?: Warranty[];
  photos?: Photo[];
  documents?: Document[];
  tags?: Tag[];
  maintenance_tasks?: MaintenanceTask[];
  // Living item fields
  is_living?: boolean;
  birthdate?: string | null;
  contact_info?: ContactInfo | null;
  relationship_type?: string | null;
  is_current_user?: boolean;
  associated_user_id?: string | null;
  // Dynamic fields
  additional_info?: DynamicField[] | null;
  created_at?: string;
  updated_at?: string;
}

export interface DynamicField {
  label: string;
  value: string;
  type: 'text' | 'url' | 'date' | 'number' | 'boolean' | 'time' | 'multiline';
}

export interface ItemCreate {
  name: string;
  description?: string | null;
  brand?: string | null;
  model_number?: string | null;
  serial_number?: string | null;
  purchase_date?: string | null;
  purchase_price?: number | null;
  estimated_value?: number | null;
  estimated_value_ai_date?: string | null;  // Date when AI estimated the value (MM/DD/YY format)
  estimated_value_user_date?: string | null;  // Date when user supplied the value (MM/DD/YY format)
  estimated_value_user_name?: string | null;  // Username who supplied the value
  retailer?: string | null;
  upc?: string | null;
  location_id?: number | string | null;
  warranties?: Warranty[];
  tag_ids?: string[];
  // Living item fields
  is_living?: boolean;
  birthdate?: string | null;
  contact_info?: ContactInfo | null;
  relationship_type?: string | null;
  is_current_user?: boolean;
  associated_user_id?: string | null;
  // Dynamic fields
  additional_info?: DynamicField[] | null;
}

export interface LandlordInfo {
  name?: string;
  company?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}

export interface TenantInfo {
  name?: string;
  phone?: string;
  email?: string;
  lease_start?: string;
  lease_end?: string;
  rent_amount?: number;
  notes?: string;
}

export interface OwnerInfo {
  owner_name?: string;
  spouse_name?: string;
  contact_info?: string;
  notes?: string;
}

export interface PolicyHolder {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface InsuranceInfo {
  // Insurance Company Details
  company_name?: string;
  company_address?: string;
  company_email?: string;
  company_phone?: string;
  agent_name?: string;
  
  // Policy Details
  policy_number?: string;
  
  // Primary Policy Holder
  primary_holder?: PolicyHolder;
  
  // Additional Policy Holders
  additional_holders?: PolicyHolder[];
  
  // Property Details
  purchase_date?: string;
  purchase_price?: number;
  build_date?: string;
  
  // Legacy fields (kept for backward compatibility)
  contact_info?: string;
  coverage_amount?: number;
  notes?: string;
}

export interface Video {
  id: string;
  location_id: string;
  filename: string;
  mime_type?: string | null;
  path: string;
  video_type?: string | null;
  uploaded_at: string;
}

export interface LocationPhoto {
  id: string;
  location_id: string;
  filename: string;
  mime_type?: string | null;
  path: string;
  photo_type?: string | null;
  uploaded_at: string;
}

export interface Location {
  id: number | string;
  name: string;
  parent_id?: number | string | null;
  is_primary_location?: boolean;
  is_container?: boolean;
  location_category?: string | null;
  friendly_name?: string | null;
  description?: string | null;
  address?: string | null;
  owner_info?: OwnerInfo | null;
  landlord_info?: LandlordInfo | null;
  tenant_info?: TenantInfo | null;
  insurance_info?: InsuranceInfo | null;
  paint_info?: PaintEntry[] | null;
  estimated_property_value?: number | null;
  estimated_value_with_items?: number | null;
  location_type?: string | null;
  children?: Location[];
  videos?: Video[];
  location_photos?: LocationPhoto[];
}

export interface PaintEntry {
  id: string;
  surface: string;
  brand: string;
  product_line?: string;
  color_name?: string;
  color_code?: string;
  base_code?: string;
  finish?: string;
  vendor?: string;
  size?: string;
  date_mixed?: string;
  tint_formula?: string;
  barcode?: string;
  hex_color?: string;
  notes?: string;
}

export interface PaintLabelInfo {
  brand?: string | null;
  product_line?: string | null;
  color_name?: string | null;
  color_code?: string | null;
  base_code?: string | null;
  finish?: string | null;
  vendor?: string | null;
  size?: string | null;
  date_mixed?: string | null;
  tint_formula?: string | null;
  barcode?: string | null;
  raw_response?: string | null;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    if (res.status === 401) {
      window.dispatchEvent(new Event("auth:unauthorized"));
    }
    const text = await res.text();
    let message = text;
    try {
      const data = JSON.parse(text);
      message = (data.detail as string) || JSON.stringify(data);
    } catch {
      // ignore
    }
    const errorCode = res.headers.get("x-error-code");
    const err = new Error(message || `HTTP ${res.status}`) as Error & { code?: string };
    if (errorCode) err.code = errorCode;
    throw err;
  }
  return res.json() as Promise<T>;
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}

/**
 * Validate password meets requirements:
 * - Minimum 8 characters
 * - At least 1 number
 */
export function validatePassword(password: string): { isValid: boolean; error: string } {
  if (password.length < 8) {
    return { isValid: false, error: "Password must be at least 8 characters long" };
  }
  
  if (!/\d/.test(password)) {
    return { isValid: false, error: "Password must contain at least 1 number" };
  }
  
  return { isValid: true, error: "" };
}

export async function login(
  username: string,
  password: string
): Promise<LoginResponse> {
  const body = new URLSearchParams();
  body.set("username", username);
  body.set("password", password);

  const res = await fetch(`${API_BASE_URL}/api/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    credentials: 'include',
    body,
  });

  return handleResponse<LoginResponse>(res);
}

function authHeaders(): Record<string, string> {
  // Token is now stored in HttpOnly cookie, no need to get from localStorage
  // Cookies are automatically sent with fetch when credentials: 'include' is used
  return {};
}

/**
 * Helper function for authenticated fetch calls
 * Automatically includes HttpOnly cookies in requests
 */
function createFetchOptions(options?: RequestInit): RequestInit {
  return {
    ...options,
    credentials: 'include', // Include HttpOnly cookies
    headers: {
      "Accept": "application/json",
      ...authHeaders(),
      ...options?.headers,
    },
  };
}

export async function fetchItems(): Promise<Item[]> {
  const res = await fetch(`${API_BASE_URL}/api/items/`, createFetchOptions());
  return handleResponse<Item[]>(res);
}

export async function fetchLocations(): Promise<Location[]> {
  const res = await fetch(`${API_BASE_URL}/api/locations/`, createFetchOptions());
  return handleResponse<Location[]>(res);
}

export interface LocationCreate {
  name: string;
  parent_id?: string | null;
  is_primary_location?: boolean;
  is_container?: boolean;
  location_category?: string | null;
  friendly_name?: string | null;
  description?: string | null;
  address?: string | null;
  owner_info?: OwnerInfo | null;
  landlord_info?: LandlordInfo | null;
  tenant_info?: TenantInfo | null;
  insurance_info?: InsuranceInfo | null;
  paint_info?: PaintEntry[] | null;
  estimated_property_value?: number | null;
  estimated_value_with_items?: number | null;
  location_type?: string | null;
}

export async function createLocation(location: LocationCreate): Promise<Location> {
  const res = await fetch(`${API_BASE_URL}/api/locations/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(location),
  });
  return handleResponse<Location>(res);
}

export async function updateLocation(locationId: string, location: Partial<LocationCreate>): Promise<Location> {
  const res = await fetch(`${API_BASE_URL}/api/locations/${locationId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(location),
  });
  return handleResponse<Location>(res);
}

export async function deleteLocation(locationId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/locations/${locationId}`, {
    method: "DELETE",
    headers: {
      ...authHeaders(),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const data = JSON.parse(text);
      message = (data.detail as string) || JSON.stringify(data);
    } catch {
      // ignore
    }
    throw new Error(message || `HTTP ${res.status}`);
  }
}

export async function uploadLocationPhoto(
  locationId: string,
  file: File,
  photoType?: string
): Promise<LocationPhoto> {
  const formData = new FormData();
  formData.append("file", file);
  if (photoType) {
    formData.append("photo_type", photoType);
  }

  const res = await fetch(`${API_BASE_URL}/api/locations/${locationId}/photos`, {
    method: "POST",
    headers: {
      ...authHeaders(),
    },
    body: formData,
  });
  return handleResponse<LocationPhoto>(res);
}

export async function deleteLocationPhoto(locationId: string, photoId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/locations/${locationId}/photos/${photoId}`, {
    method: "DELETE",
    headers: {
      ...authHeaders(),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const data = JSON.parse(text);
      message = (data.detail as string) || JSON.stringify(data);
    } catch {
      // ignore
    }
    throw new Error(message || `HTTP ${res.status}`);
  }
}

export async function uploadLocationVideo(
  locationId: string,
  file: File,
  videoType?: string
): Promise<Video> {
  const formData = new FormData();
  formData.append("file", file);
  if (videoType) {
    formData.append("video_type", videoType);
  }

  const res = await fetch(`${API_BASE_URL}/api/locations/${locationId}/videos`, {
    method: "POST",
    headers: {
      ...authHeaders(),
    },
    body: formData,
  });
  return handleResponse<Video>(res);
}

export async function deleteLocationVideo(locationId: string, videoId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/locations/${locationId}/videos/${videoId}`, {
    method: "DELETE",
    headers: {
      ...authHeaders(),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const data = JSON.parse(text);
      message = (data.detail as string) || JSON.stringify(data);
    } catch {
      // ignore
    }
    throw new Error(message || `HTTP ${res.status}`);
  }
}

export async function createItem(item: ItemCreate): Promise<Item> {
  const res = await fetch(`${API_BASE_URL}/api/items/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(item),
  });
  return handleResponse<Item>(res);
}

export async function fetchItem(itemId: string): Promise<Item> {
  const res = await fetch(`${API_BASE_URL}/api/items/${itemId}`, {
    headers: {
      "Accept": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse<Item>(res);
}

export async function updateItem(itemId: string, item: Partial<ItemCreate>): Promise<Item> {
  const res = await fetch(`${API_BASE_URL}/api/items/${itemId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(item),
  });
  return handleResponse<Item>(res);
}

export async function deleteItem(itemId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/items/${itemId}`, {
    method: "DELETE",
    headers: {
      ...authHeaders(),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const data = JSON.parse(text);
      message = (data.detail as string) || JSON.stringify(data);
    } catch {
      // ignore
    }
    throw new Error(message || `HTTP ${res.status}`);
  }
}

export async function enrichItem(itemId: string): Promise<ItemEnrichmentResult> {
  const res = await fetch(`${API_BASE_URL}/api/items/${itemId}/enrich`, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse<ItemEnrichmentResult>(res);
}


// --- Bulk Operations ---

export interface BulkDeleteResponse {
  deleted_count: number;
  message: string;
}

export interface BulkUpdateTagsResponse {
  updated_count: number;
  message: string;
}

export interface BulkUpdateLocationResponse {
  updated_count: number;
  message: string;
}

export async function bulkDeleteItems(itemIds: string[]): Promise<BulkDeleteResponse> {
  const res = await fetch(`${API_BASE_URL}/api/items/bulk-delete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ item_ids: itemIds }),
  });
  return handleResponse<BulkDeleteResponse>(res);
}

export async function bulkUpdateTags(
  itemIds: string[],
  tagIds: string[],
  mode: "replace" | "add" | "remove" = "replace"
): Promise<BulkUpdateTagsResponse> {
  const res = await fetch(`${API_BASE_URL}/api/items/bulk-update-tags`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ item_ids: itemIds, tag_ids: tagIds, mode }),
  });
  return handleResponse<BulkUpdateTagsResponse>(res);
}

export async function bulkUpdateLocation(
  itemIds: string[],
  locationId: string | null
): Promise<BulkUpdateLocationResponse> {
  const res = await fetch(`${API_BASE_URL}/api/items/bulk-update-location`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ item_ids: itemIds, location_id: locationId }),
  });
  return handleResponse<BulkUpdateLocationResponse>(res);
}

export interface ApplicationStatus {
  name: string;
  version: string;
  status: string;
}

export interface DatabaseStatus {
  status: string;
  version?: string;
  version_full?: string;
  size?: string;
  size_bytes?: number;
  location?: string;
  latest_version?: string | null;
  is_version_current?: boolean | null;
  error?: string;
}

export interface SystemStatus {
  application: ApplicationStatus;
  database: DatabaseStatus;
}

export async function fetchStatus(): Promise<SystemStatus> {
  const res = await fetch(`${API_BASE_URL}/api/status`, {
    headers: {
      "Accept": "application/json",
    },
  });
  return handleResponse<SystemStatus>(res);
}

export async function uploadPhoto(
  itemId: string,
  file: File,
  photoType?: string,
  isPrimary: boolean = false,
  isDataTag: boolean = false
): Promise<Photo> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("is_primary", isPrimary.toString());
  formData.append("is_data_tag", isDataTag.toString());
  if (photoType) {
    formData.append("photo_type", photoType);
  }

  const res = await fetch(`${API_BASE_URL}/api/items/${itemId}/photos`, {
    method: "POST",
    headers: {
      ...authHeaders(),
    },
    body: formData,
  });
  return handleResponse<Photo>(res);
}

export async function deletePhoto(itemId: string, photoId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/items/${itemId}/photos/${photoId}`, {
    method: "DELETE",
    headers: {
      ...authHeaders(),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const data = JSON.parse(text);
      message = (data.detail as string) || JSON.stringify(data);
    } catch {
      // ignore
    }
    throw new Error(message || `HTTP ${res.status}`);
  }
}

export async function getPhoto(itemId: string, photoId: string): Promise<Photo> {
  const res = await fetch(`${API_BASE_URL}/api/items/${itemId}/photos/${photoId}`, {
    method: "GET",
    headers: {
      ...authHeaders(),
    },
  });
  return handleResponse<Photo>(res);
}

export interface PhotoUpdate {
  item_id?: string;
  is_primary?: boolean;
  is_data_tag?: boolean;
  photo_type?: string | null;
}

export async function updatePhoto(
  itemId: string,
  photoId: string,
  updates: PhotoUpdate
): Promise<Photo> {
  const res = await fetch(`${API_BASE_URL}/api/items/${itemId}/photos/${photoId}`, {
    method: "PATCH",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updates),
  });
  return handleResponse<Photo>(res);
}

export async function uploadDocument(
  itemId: string,
  file: File,
  documentType?: string
): Promise<Document> {
  const formData = new FormData();
  formData.append("file", file);
  if (documentType) {
    formData.append("document_type", documentType);
  }

  const res = await fetch(`${API_BASE_URL}/api/items/${itemId}/documents`, {
    method: "POST",
    headers: {
      ...authHeaders(),
    },
    body: formData,
  });
  return handleResponse<Document>(res);
}

export async function uploadDocumentFromUrl(
  itemId: string,
  url: string,
  documentType?: string
): Promise<Document> {
  const formData = new FormData();
  formData.append("url", url);
  if (documentType) {
    formData.append("document_type", documentType);
  }

  const res = await fetch(`${API_BASE_URL}/api/items/${itemId}/documents/from-url`, {
    method: "POST",
    headers: {
      ...authHeaders(),
    },
    body: formData,
  });
  return handleResponse<Document>(res);
}

export async function deleteDocument(itemId: string, documentId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/items/${itemId}/documents/${documentId}`, {
    method: "DELETE",
    headers: {
      ...authHeaders(),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const data = JSON.parse(text);
      message = (data.detail as string) || JSON.stringify(data);
    } catch {
      // ignore
    }
    throw new Error(message || `HTTP ${res.status}`);
  }
}

// --- User APIs ---

export interface User {
  id: string;
  email: string;
  full_name?: string | null;
  role: string;
  is_approved: boolean;
  must_change_password?: boolean;  // User must change password on next login
  created_at: string;
  updated_at: string;
  allowed_location_ids?: string[] | null;
  api_key?: string | null;
  // AI Valuation Schedule Settings
  ai_schedule_enabled?: boolean;
  ai_schedule_interval_days?: number;
  ai_schedule_last_run?: string | null;
  // UPC Database Configuration
  upc_databases?: { id: string; enabled: boolean; api_key?: string | null }[] | null;
}

export interface UserCreate {
  email: string;
  password: string;
  full_name?: string | null;
}

export interface AdminUserCreate {
  email: string;
  password: string;  // Always required - temporary password when require_password_change is true
  full_name?: string | null;
  role?: string;
  is_approved?: boolean;
  require_password_change?: boolean;  // If true, user must change password on first login
}

export interface AIScheduleSettings {
  ai_schedule_enabled: boolean;
  ai_schedule_interval_days: number;
}

export interface AIValuationRunResponse {
  items_processed: number;
  items_updated: number;
  items_skipped: number;
  message: string;
  ai_schedule_last_run?: string | null;
}

export interface AIEnrichmentRunResponse {
  items_processed: number;
  items_updated: number;
  items_skipped: number;
  items_with_data_tags: number;
  quota_exceeded: boolean;
  message: string;
}

export async function registerUser(userCreate: UserCreate): Promise<User> {
  const res = await fetch(`${API_BASE_URL}/api/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(userCreate),
  });
  return handleResponse<User>(res);
}

export async function adminCreateUser(userCreate: AdminUserCreate): Promise<User> {
  const res = await fetch(`${API_BASE_URL}/api/users/admin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(userCreate),
  });
  return handleResponse<User>(res);
}

export async function getCurrentUser(): Promise<User> {
  const res = await fetch(`${API_BASE_URL}/api/users/me`, {
    headers: {
      "Accept": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse<User>(res);
}

export async function setPassword(newPassword: string): Promise<User> {
  const res = await fetch(`${API_BASE_URL}/api/users/me/set-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ new_password: newPassword }),
  });
  return handleResponse<User>(res);
}

export async function fetchUsers(): Promise<User[]> {
  const res = await fetch(`${API_BASE_URL}/api/users`, {
    headers: {
      "Accept": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse<User[]>(res);
}

export async function updateUser(userId: string, updates: Partial<{full_name: string, password: string, role: string, is_approved: boolean}>): Promise<User> {
  const res = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(updates),
  });
  return handleResponse<User>(res);
}

export async function deleteUser(userId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
    method: "DELETE",
    headers: {
      ...authHeaders(),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const data = JSON.parse(text);
      message = (data.detail as string) || JSON.stringify(data);
    } catch {
      // ignore
    }
    throw new Error(message || `HTTP ${res.status}`);
  }
}

export async function updateUserLocationAccess(userId: string, locationIds: string[]): Promise<User> {
  const res = await fetch(`${API_BASE_URL}/api/users/${userId}/locations`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ location_ids: locationIds }),
  });
  return handleResponse<User>(res);
}

export async function getUserLocationAccess(userId: string): Promise<Location[]> {
  const res = await fetch(`${API_BASE_URL}/api/users/${userId}/locations`, {
    headers: {
      "Accept": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse<Location[]>(res);
}

// Tag API functions
export async function fetchTags(): Promise<Tag[]> {
  const res = await fetch(`${API_BASE_URL}/api/tags/`, createFetchOptions());
  return handleResponse<Tag[]>(res);
}

export async function createTag(name: string): Promise<Tag> {
  const res = await fetch(`${API_BASE_URL}/api/tags/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ name, is_predefined: false }),
  });
  return handleResponse<Tag>(res);
}

export async function deleteTag(tagId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/tags/${tagId}`, {
    method: "DELETE",
    headers: {
      ...authHeaders(),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const data = JSON.parse(text);
      message = (data.detail as string) || JSON.stringify(data);
    } catch {
      // ignore
    }
    throw new Error(message || `HTTP ${res.status}`);
  }
}

// --- Encircle Import APIs ---

export interface EncircleImportResult {
  message: string;
  items_created: number;
  photos_attached: number;
  items_without_photos: number;
  locations_created: number;
  sublocations_created: number;
  parent_location_name: string | null;
  log: string[];
  warnings?: string[];
  quota_exceeded?: boolean;
}

export interface EncirclePreviewResult {
  parent_location_name: string | null;
}

export async function previewEncircle(xlsxFile: File): Promise<EncirclePreviewResult> {
  const formData = new FormData();
  formData.append("xlsx_file", xlsxFile);

  const res = await fetch(`${API_BASE_URL}/api/import/encircle/preview`, {
    method: "POST",
    headers: {
      ...authHeaders(),
    },
    body: formData,
  });

  return handleResponse<EncirclePreviewResult>(res);
}

export async function importEncircle(
  xlsxFile: File,
  images: File[],
  matchByName: boolean = true,
  parentLocationId: string | null = null,
  createParentFromFile: boolean = true
): Promise<EncircleImportResult> {
  const formData = new FormData();
  formData.append("xlsx_file", xlsxFile);
  formData.append("match_by_name", matchByName.toString());
  formData.append("create_parent_from_file", createParentFromFile.toString());
  
  if (parentLocationId) {
    formData.append("parent_location_id", parentLocationId);
  }
  
  for (const image of images) {
    formData.append("images", image);
  }

  const res = await fetch(`${API_BASE_URL}/api/import/encircle`, {
    method: "POST",
    headers: {
      ...authHeaders(),
    },
    body: formData,
  });

  return handleResponse<EncircleImportResult>(res);
}

// --- CSV Import ---

export interface CSVImportResult {
  message: string;
  items_created: number;
  photos_attached: number;
  photos_failed: number;
  locations_created: number;
  log: string[];
  warnings?: string[];
}

export async function importCSV(
  csvFile: File,
  parentLocationId: string | null = null,
  createLocations: boolean = true
): Promise<CSVImportResult> {
  const formData = new FormData();
  formData.append("csv_file", csvFile);
  formData.append("create_locations", createLocations.toString());
  
  if (parentLocationId) {
    formData.append("parent_location_id", parentLocationId);
  }

  const res = await fetch(`${API_BASE_URL}/api/import/csv`, {
    method: "POST",
    headers: {
      ...authHeaders(),
    },
    body: formData,
  });

  return handleResponse<CSVImportResult>(res);
}

// --- API Key Management ---

export async function generateApiKey(): Promise<User> {
  const res = await fetch(`${API_BASE_URL}/api/users/me/api-key`, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse<User>(res);
}

export async function revokeApiKey(): Promise<User> {
  const res = await fetch(`${API_BASE_URL}/api/users/me/api-key`, {
    method: "DELETE",
    headers: {
      "Accept": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse<User>(res);
}

// --- AI Detection APIs ---

export interface DetectedItem {
  name: string;
  description?: string | null;
  brand?: string | null;
  estimated_value?: number | null;
  confidence?: number | null;
  estimation_date?: string | null;  // Date when AI estimated the value (MM/DD/YY format)
  // Department 56 enrichment fields
  is_department_56?: boolean | null;
  series?: string | null;
  estimated_condition?: string | null;
  estimated_value_range?: string | null;
  is_limited_edition?: boolean | null;
  is_signed?: boolean | null;
}

export interface DetectionResult {
  items: DetectedItem[];
  raw_response?: string | null;
}

export interface AIStatusResponse {
  enabled: boolean;
  model?: string | null;
  plugins_enabled?: boolean;
  plugin_count?: number;
}

export interface DataTagInfo {
  manufacturer?: string | null;
  brand?: string | null;
  model_number?: string | null;
  serial_number?: string | null;
  production_date?: string | null;
  estimated_value?: number | null;
  estimation_date?: string | null;  // Date when AI estimated the value (MM/DD/YY format)
  additional_info?: Record<string, unknown> | null;
  raw_response?: string | null;
}

export interface BarcodeLookupResult {
  found: boolean;
  name?: string | null;
  description?: string | null;
  brand?: string | null;
  model_number?: string | null;
  estimated_value?: number | null;
  estimation_date?: string | null;  // Date when AI estimated the value (MM/DD/YY format)
  category?: string | null;
  raw_response?: string | null;
}

export interface EnrichedItemData {
  description?: string | null;
  brand?: string | null;
  model_number?: string | null;
  serial_number?: string | null;
  estimated_value?: number | null;
  estimated_value_ai_date?: string | null;
  confidence?: number | null;
  source: string;
}

export interface ItemEnrichmentResult {
  item_id: string;
  enriched_data: EnrichedItemData[];
  message: string;
}

export async function getAIStatus(): Promise<AIStatusResponse> {
  const res = await fetch(`${API_BASE_URL}/api/ai/status`, {
    headers: {
      "Accept": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse<AIStatusResponse>(res);
}

export async function detectItemsFromImage(file: File): Promise<DetectionResult> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE_URL}/api/ai/detect-items`, {
    method: "POST",
    headers: {
      ...authHeaders(),
    },
    body: formData,
  });
  return handleResponse<DetectionResult>(res);
}

export async function parseDataTagImage(file: File): Promise<DataTagInfo> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE_URL}/api/ai/parse-data-tag`, {
    method: "POST",
    headers: {
      ...authHeaders(),
    },
    body: formData,
  });
  return handleResponse<DataTagInfo>(res);
}

export async function parsePaintLabel(file: File): Promise<PaintLabelInfo> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE_URL}/api/ai/parse-paint-label`, {
    method: "POST",
    headers: {
      ...authHeaders(),
    },
    credentials: "include",
    body: formData,
  });
  return handleResponse<PaintLabelInfo>(res);
}

export async function lookupBarcode(upc: string): Promise<BarcodeLookupResult> {
  const res = await fetch(`${API_BASE_URL}/api/ai/barcode-lookup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ upc }),
  });
  return handleResponse<BarcodeLookupResult>(res);
}

export interface BarcodeScanResult {
  found: boolean;
  upc?: string | null;
  raw_response?: string | null;
}

export interface QRScanResult {
  found: boolean;
  content?: string | null;
  raw_response?: string | null;
}

export async function scanBarcodeImage(file: File): Promise<BarcodeScanResult> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE_URL}/api/ai/scan-barcode`, {
    method: "POST",
    headers: {
      ...authHeaders(),
    },
    body: formData,
  });
  return handleResponse<BarcodeScanResult>(res);
}

export async function scanQRCodeImage(file: File): Promise<QRScanResult> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE_URL}/api/ai/scan-qr`, {
    method: "POST",
    headers: {
      ...authHeaders(),
    },
    body: formData,
  });
  return handleResponse<QRScanResult>(res);
}

// --- Multi-Database UPC Lookup ---

export interface MultiBarcodeLookupResult {
  found: boolean;
  source: string;  // The database that returned this result (e.g., 'gemini', 'upcdatabase')
  name?: string | null;
  description?: string | null;
  brand?: string | null;
  model_number?: string | null;
  estimated_value?: number | null;
  estimation_date?: string | null;
  category?: string | null;
  raw_response?: string | null;
  has_next_database: boolean;
  next_database_id?: string | null;
  next_database_name?: string | null;
}

export interface UPCDatabaseConfig {
  id: string;
  enabled: boolean;
  api_key?: string | null;
}

export interface AvailableUPCDatabase {
  id: string;
  name: string;
  description: string;
  requires_api_key: boolean;
  api_key_url?: string | null;
}

export interface AvailableUPCDatabasesResponse {
  databases: AvailableUPCDatabase[];
}

export interface AIProviderConfig {
  id: string;
  enabled: boolean;
  priority: number;
  api_key?: string | null;
}

export interface AvailableAIProvider {
  id: string;
  name: string;
  description: string;
  requires_api_key: boolean;
  api_key_url?: string | null;
}

export interface AvailableAIProvidersResponse {
  providers: AvailableAIProvider[];
}

export async function lookupBarcodeMulti(upc: string, databaseId?: string | null): Promise<MultiBarcodeLookupResult> {
  const res = await fetch(`${API_BASE_URL}/api/ai/barcode-lookup-multi`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ upc, database_id: databaseId || null }),
  });
  return handleResponse<MultiBarcodeLookupResult>(res);
}

export async function getAvailableUPCDatabases(): Promise<AvailableUPCDatabasesResponse> {
  const res = await fetch(`${API_BASE_URL}/api/ai/upc-databases`, {
    headers: {
      "Accept": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse<AvailableUPCDatabasesResponse>(res);
}

export async function getUPCDatabaseSettings(): Promise<{ upc_databases: UPCDatabaseConfig[] }> {
  const res = await fetch(`${API_BASE_URL}/api/users/me/upc-databases`, {
    headers: {
      "Accept": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse<{ upc_databases: UPCDatabaseConfig[] }>(res);
}

export async function updateUPCDatabaseSettings(upcDatabases: UPCDatabaseConfig[]): Promise<User> {
  const res = await fetch(`${API_BASE_URL}/api/users/me/upc-databases`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ upc_databases: upcDatabases }),
  });
  return handleResponse<User>(res);
}

export async function getAvailableAIProviders(): Promise<AvailableAIProvidersResponse> {
  const res = await fetch(`${API_BASE_URL}/api/ai/ai-providers`, {
    headers: {
      "Accept": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse<AvailableAIProvidersResponse>(res);
}

export async function getAIProviderSettings(): Promise<{ ai_providers: AIProviderConfig[] }> {
  const res = await fetch(`${API_BASE_URL}/api/users/me/ai-providers`, {
    headers: {
      "Accept": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse<{ ai_providers: AIProviderConfig[] }>(res);
}

export async function updateAIProviderSettings(aiProviders: AIProviderConfig[]): Promise<User> {
  const res = await fetch(`${API_BASE_URL}/api/users/me/ai-providers`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ ai_providers: aiProviders }),
  });
  return handleResponse<User>(res);
}

// --- AI Connection Test ---

export interface AIProviderTestResult {
  provider_id: string;
  provider_name: string;
  success: boolean;
  message: string;
  priority: number;
  is_plugin: boolean;
}

export interface AIConnectionTestResponse {
  overall_success: boolean;
  summary: string;
  results: AIProviderTestResult[];
  total_providers: number;
  working_providers: number;
  failed_providers: number;
}

export async function testAIConnection(): Promise<AIConnectionTestResponse> {
  const res = await fetch(`${API_BASE_URL}/api/ai/test-connection`, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse<AIConnectionTestResponse>(res);
}

// --- Google OAuth ---

export interface GoogleOAuthStatus {
  enabled: boolean;
  client_id?: string | null;
}

export interface GoogleAuthResponse {
  access_token: string;
  token_type: string;
  is_new_user: boolean;
}

export interface RegistrationStatus {
  enabled: boolean;
}

export async function getRegistrationStatus(): Promise<RegistrationStatus> {
  const res = await fetch(`${API_BASE_URL}/api/auth/registration/status`, {
    headers: {
      "Accept": "application/json",
    },
  });
  return handleResponse<RegistrationStatus>(res);
}

export async function getGoogleOAuthStatus(): Promise<GoogleOAuthStatus> {
  const res = await fetch(`${API_BASE_URL}/api/auth/google/status`, {
    headers: {
      "Accept": "application/json",
    },
  });
  return handleResponse<GoogleOAuthStatus>(res);
}

export async function googleAuth(credential: string): Promise<GoogleAuthResponse> {
  const res = await fetch(`${API_BASE_URL}/api/auth/google`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    credentials: 'include',
    body: JSON.stringify({ credential }),
  });
  return handleResponse<GoogleAuthResponse>(res);
}

// --- AI Schedule APIs ---

export async function getAIScheduleSettings(): Promise<AIScheduleSettings> {
  const res = await fetch(`${API_BASE_URL}/api/users/me/ai-schedule`, {
    headers: {
      "Accept": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse<AIScheduleSettings>(res);
}

export async function updateAIScheduleSettings(settings: AIScheduleSettings): Promise<User> {
  const res = await fetch(`${API_BASE_URL}/api/users/me/ai-schedule`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(settings),
  });
  return handleResponse<User>(res);
}

export async function runAIValuation(): Promise<AIValuationRunResponse> {
  const res = await fetch(`${API_BASE_URL}/api/ai/run-valuation`, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse<AIValuationRunResponse>(res);
}

export async function enrichFromDataTags(): Promise<AIEnrichmentRunResponse> {
  const res = await fetch(`${API_BASE_URL}/api/ai/enrich-from-data-tags`, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse<AIEnrichmentRunResponse>(res);
}

// --- Google Drive Backup APIs ---

export interface GDriveStatus {
  enabled: boolean;
  connected: boolean;
  last_backup: string | null;
}

export interface GDriveBackupResponse {
  success: boolean;
  message: string;
  backup_id?: string | null;
  backup_name?: string | null;
  backup_date?: string | null;
}

export interface GDriveBackupFile {
  id: string;
  name: string;
  created_time: string;
  size?: string | null;
}

export interface GDriveBackupList {
  backups: GDriveBackupFile[];
}

export async function getGDriveStatus(): Promise<GDriveStatus> {
  const res = await fetch(`${API_BASE_URL}/api/gdrive/status`, {
    headers: {
      "Accept": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse<GDriveStatus>(res);
}

export async function connectGDrive(code: string): Promise<GDriveStatus> {
  const res = await fetch(`${API_BASE_URL}/api/gdrive/connect`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ code }),
  });
  return handleResponse<GDriveStatus>(res);
}

export async function disconnectGDrive(): Promise<GDriveStatus> {
  const res = await fetch(`${API_BASE_URL}/api/gdrive/disconnect`, {
    method: "DELETE",
    headers: {
      "Accept": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse<GDriveStatus>(res);
}

export async function createGDriveBackup(): Promise<GDriveBackupResponse> {
  const res = await fetch(`${API_BASE_URL}/api/gdrive/backup`, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse<GDriveBackupResponse>(res);
}

export async function listGDriveBackups(): Promise<GDriveBackupList> {
  const res = await fetch(`${API_BASE_URL}/api/gdrive/backups`, {
    headers: {
      "Accept": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse<GDriveBackupList>(res);
}

export async function deleteGDriveBackup(backupId: string): Promise<GDriveBackupResponse> {
  const res = await fetch(`${API_BASE_URL}/api/gdrive/backups/${backupId}`, {
    method: "DELETE",
    headers: {
      "Accept": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse<GDriveBackupResponse>(res);
}

// --- Log Settings APIs ---

export interface LogSettings {
  rotation_type: string;  // "schedule" or "size"
  rotation_schedule_hours: number;  // Default 24 hours
  rotation_size_mb: number;  // Default 10 MB
  log_level: string;  // "info", "warn_error", "debug", or "trace"
  retention_days: number;  // Days to keep rotated logs
  auto_delete_enabled: boolean;  // Whether to auto-delete old logs
}

export interface LogFile {
  name: string;
  size_bytes: number;
  size_display: string;
  modified_at: string;
  log_type: string;  // "current", "rotated", "debug", "trace"
}

export interface LogSettingsResponse {
  settings: LogSettings;
  log_files: LogFile[];
}

export interface DeleteLogsResponse {
  deleted_count: number;
  message: string;
}

export interface RotateLogsResponse {
  message: string;
  rotated: boolean;
  rotated_file?: string;
}

export async function getLogSettings(): Promise<LogSettingsResponse> {
  const res = await fetch(`${API_BASE_URL}/api/logs/settings`, {
    headers: {
      "Accept": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse<LogSettingsResponse>(res);
}

export async function updateLogSettings(settings: LogSettings): Promise<LogSettingsResponse> {
  const res = await fetch(`${API_BASE_URL}/api/logs/settings`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(settings),
  });
  return handleResponse<LogSettingsResponse>(res);
}

export async function deleteLogFiles(fileNames: string[]): Promise<DeleteLogsResponse> {
  const res = await fetch(`${API_BASE_URL}/api/logs/files`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ file_names: fileNames }),
  });
  return handleResponse<DeleteLogsResponse>(res);
}

export async function rotateLogsNow(): Promise<RotateLogsResponse> {
  const res = await fetch(`${API_BASE_URL}/api/logs/rotate`, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse<RotateLogsResponse>(res);
}

export async function getLogFiles(): Promise<LogFile[]> {
  const res = await fetch(`${API_BASE_URL}/api/logs/files`, {
    headers: {
      "Accept": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse<LogFile[]>(res);
}

export interface LogContentResponse {
  file_name: string;
  content: string;
  truncated: boolean;
  total_lines: number;
  returned_lines: number;
}

export interface IssueReportData {
  app_version: string;
  database_type: string;
  database_version: string;
  log_level: string;
  error_logs: string;
  system_info: string;
  github_issue_url: string;
}

export async function getLogContent(fileName: string, lines: number = 100): Promise<LogContentResponse> {
  const res = await fetch(`${API_BASE_URL}/api/logs/content/${encodeURIComponent(fileName)}?lines=${lines}`, {
    headers: {
      "Accept": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse<LogContentResponse>(res);
}

export async function getIssueReportData(): Promise<IssueReportData> {
  const res = await fetch(`${API_BASE_URL}/api/logs/issue-report`, {
    headers: {
      "Accept": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse<IssueReportData>(res);
}

// --- Config Status APIs ---

export interface GeminiModel {
  id: string;
  name: string;
  description?: string;
}

export interface ConfigStatusResponse {
  google_oauth_configured: boolean;
  google_client_id: string | null;
  google_client_secret_masked: string | null;
  gemini_configured: boolean;
  gemini_api_key_masked: string | null;
  gemini_model: string | null;
  available_gemini_models: GeminiModel[] | null;
  gemini_from_env: boolean;
  gemini_model_from_env: boolean;
  google_from_env: boolean;
}

export interface ApiKeysUpdate {
  gemini_api_key?: string | null;
  gemini_model?: string | null;
  google_client_id?: string | null;
  google_client_secret?: string | null;
}

export interface ApiKeysUpdateResponse {
  success: boolean;
  message: string;
  gemini_configured: boolean;
  google_oauth_configured: boolean;
}

export async function getConfigStatus(): Promise<ConfigStatusResponse> {
  const res = await fetch(`${API_BASE_URL}/api/config-status`, {
    headers: {
      "Accept": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse<ConfigStatusResponse>(res);
}

export async function updateApiKeys(apiKeys: ApiKeysUpdate): Promise<ApiKeysUpdateResponse> {
  const res = await fetch(`${API_BASE_URL}/api/config-status/api-keys`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(apiKeys),
  });
  return handleResponse<ApiKeysUpdateResponse>(res);
}

export interface GeminiModelInfo {
  id: string;
  display_name: string;
}

export interface GeminiModelsApiResponse {
  models: GeminiModelInfo[];
  source: string;
}

export async function fetchGeminiModels(): Promise<GeminiModelsApiResponse> {
  const res = await fetch(`${API_BASE_URL}/api/ai/gemini-models`, {
    credentials: 'include',
    headers: { "Accept": "application/json", ...authHeaders() },
  });
  return handleResponse<GeminiModelsApiResponse>(res);
}

// --- Maintenance Task APIs ---

export async function fetchMaintenanceTasks(): Promise<MaintenanceTask[]> {
  const res = await fetch(`${API_BASE_URL}/api/maintenance/`, {
    headers: {
      "Accept": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse<MaintenanceTask[]>(res);
}

export async function fetchMaintenanceTasksForItem(itemId: string): Promise<MaintenanceTask[]> {
  const res = await fetch(`${API_BASE_URL}/api/maintenance/item/${itemId}`, {
    headers: {
      "Accept": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse<MaintenanceTask[]>(res);
}

export async function createMaintenanceTask(task: MaintenanceTaskCreate): Promise<MaintenanceTask> {
  const res = await fetch(`${API_BASE_URL}/api/maintenance/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(task),
  });
  return handleResponse<MaintenanceTask>(res);
}

export async function updateMaintenanceTask(taskId: string, task: MaintenanceTaskCreate): Promise<MaintenanceTask> {
  const res = await fetch(`${API_BASE_URL}/api/maintenance/${taskId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(task),
  });
  return handleResponse<MaintenanceTask>(res);
}

export async function deleteMaintenanceTask(taskId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/maintenance/${taskId}`, {
    method: "DELETE",
    headers: {
      ...authHeaders(),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const data = JSON.parse(text);
      message = (data.detail as string) || JSON.stringify(data);
    } catch {
      // ignore
    }
    throw new Error(message || `HTTP ${res.status}`);
  }
}

// --- Plugin APIs ---

export interface Plugin {
  id: string;
  name: string;
  description?: string | null;
  plugin_type: string;
  endpoint_url: string;
  api_key?: string | null;
  config?: Record<string, unknown> | null;
  enabled: boolean;
  use_for_ai_scan: boolean;
  supports_image_processing: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface PluginCreate {
  name: string;
  description?: string | null;
  plugin_type?: string;
  endpoint_url: string;
  api_key?: string | null;
  config?: Record<string, unknown> | null;
  enabled?: boolean;
  use_for_ai_scan?: boolean;
  supports_image_processing?: boolean;
  priority?: number;
}

export interface PluginUpdate {
  name?: string;
  description?: string | null;
  endpoint_url?: string;
  api_key?: string | null;
  config?: Record<string, unknown> | null;
  enabled?: boolean;
  use_for_ai_scan?: boolean;
  supports_image_processing?: boolean;
  priority?: number;
}

export interface PluginConnectionTestResult {
  success: boolean;
  message: string;
  status_code?: number | null;
}

export async function fetchPlugins(): Promise<Plugin[]> {
  const res = await fetch(`${API_BASE_URL}/api/plugins/`, {
    headers: {
      "Accept": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse<Plugin[]>(res);
}

export async function getPlugin(pluginId: string): Promise<Plugin> {
  const res = await fetch(`${API_BASE_URL}/api/plugins/${pluginId}`, {
    headers: {
      "Accept": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse<Plugin>(res);
}

export async function createPlugin(plugin: PluginCreate): Promise<Plugin> {
  const res = await fetch(`${API_BASE_URL}/api/plugins/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(plugin),
  });
  return handleResponse<Plugin>(res);
}

export async function updatePlugin(pluginId: string, plugin: PluginUpdate): Promise<Plugin> {
  const res = await fetch(`${API_BASE_URL}/api/plugins/${pluginId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(plugin),
  });
  return handleResponse<Plugin>(res);
}

export async function deletePlugin(pluginId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/plugins/${pluginId}`, {
    method: "DELETE",
    headers: {
      ...authHeaders(),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const data = JSON.parse(text);
      message = (data.detail as string) || JSON.stringify(data);
    } catch {
      // ignore
    }
    throw new Error(message || `HTTP ${res.status}`);
  }
}

// --- System Settings APIs ---

export interface SystemSettings {
  id: number;
  gemini_api_key?: string | null;
  gemini_model?: string | null;
  google_client_id?: string | null;
  google_client_secret?: string | null;
  custom_location_categories?: string[] | null;
  updated_at: string;
}

export interface SystemSettingsUpdate {
  gemini_api_key?: string | null;
  gemini_model?: string | null;
  google_client_id?: string | null;
  google_client_secret?: string | null;
  custom_location_categories?: string[] | null;
}

export async function getSystemSettings(): Promise<SystemSettings> {
  const res = await fetch(`${API_BASE_URL}/api/settings/`, {
    headers: {
      "Accept": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse<SystemSettings>(res);
}

export async function updateSystemSettings(settings: SystemSettingsUpdate): Promise<SystemSettings> {
  const res = await fetch(`${API_BASE_URL}/api/settings/`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(settings),
  });
  return handleResponse<SystemSettings>(res);
}

export async function getLocationCategories(): Promise<string[]> {
  const res = await fetch(`${API_BASE_URL}/api/settings/location-categories`, {
    headers: {
      "Accept": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse<string[]>(res);
}

export async function testPluginConnection(pluginId: string): Promise<PluginConnectionTestResult> {
  const res = await fetch(`${API_BASE_URL}/api/plugins/${pluginId}/test`, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse<PluginConnectionTestResult>(res);
}

// --- Media Management APIs ---

export interface MediaStats {
  total_photos: number;
  total_videos: number;
  total_storage_bytes: number;
  total_storage_mb: number;
  directories: string[];
}

export interface MediaItem {
  id: string;
  type: 'photo' | 'video' | 'location_photo';
  path: string;
  mime_type?: string | null;
  uploaded_at: string;
  item_id?: string | null;
  item_name?: string | null;
  location_id?: string | null;
  location_name?: string | null;
  is_primary?: boolean;
  is_data_tag?: boolean;
  photo_type?: string | null;
  filename?: string;
  video_type?: string | null;
  thumbnail_path?: string | null;
}

export interface MediaListResponse {
  items: MediaItem[];
  total: number;
  page: number;
  pages: number;
}

export async function getMediaStats(): Promise<MediaStats> {
  const res = await fetch(`${API_BASE_URL}/api/media/stats`, {
    headers: {
      "Accept": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse<MediaStats>(res);
}

export async function listMedia(
  locationFilter?: string,
  mediaType?: 'photo' | 'video',
  unassignedOnly?: boolean,
  page: number = 1,
  limit: number = 50
): Promise<MediaListResponse> {
  const params = new URLSearchParams();
  if (locationFilter) params.append('location_filter', locationFilter);
  if (mediaType) params.append('media_type', mediaType);
  if (unassignedOnly) params.append('unassigned_only', 'true');
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  
  const url = `${API_BASE_URL}/api/media/list${params.toString() ? '?' + params.toString() : ''}`;
  const res = await fetch(url, {
    headers: {
      "Accept": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse<MediaListResponse>(res);
}

// --- OIDC Auth ---

export interface OIDCStatus {
  enabled: boolean;
  provider_name: string;
  button_text: string;
}

export interface OIDCLoginResponse {
  authorization_url: string;
}

export interface OIDCCallbackResponse {
  access_token: string;
  token_type: string;
  is_new_user: boolean;
}

export async function getOIDCStatus(): Promise<OIDCStatus> {
  const res = await fetch(`${API_BASE_URL}/api/auth/oidc/status`, {
    headers: {
      "Accept": "application/json",
    },
  });
  return handleResponse<OIDCStatus>(res);
}

export async function getOIDCLoginUrl(redirectUri: string): Promise<OIDCLoginResponse> {
  const res = await fetch(`${API_BASE_URL}/api/auth/oidc/login?redirect_uri=${encodeURIComponent(redirectUri)}`, {
    headers: {
      "Accept": "application/json",
    },
  });
  return handleResponse<OIDCLoginResponse>(res);
}

export async function oidcCallback(code: string, redirectUri: string): Promise<OIDCCallbackResponse> {
  const res = await fetch(`${API_BASE_URL}/api/auth/oidc/callback?code=${code}&redirect_uri=${encodeURIComponent(redirectUri)}`, {
    method: "POST",
    headers: {
      "Accept": "application/json",
    },
    credentials: 'include',
  });
  return handleResponse<OIDCCallbackResponse>(res);
}



export async function bulkDeleteMedia(mediaIds: string[], mediaTypes: string[]): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/media/bulk-delete`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ media_ids: mediaIds, media_types: mediaTypes }),
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const data = JSON.parse(text);
      message = (data.detail as string) || JSON.stringify(data);
    } catch {
      // ignore
    }
    throw new Error(message || `HTTP ${res.status}`);
  }
}

export async function updateMedia(
  mediaId: string,
  mediaType: string,
  updates: {
    item_id?: string;
    photo_type?: string;
    unassign?: boolean;
  }
): Promise<MediaItem> {
  const params = new URLSearchParams();
  params.append('media_type', mediaType);
  if (updates.item_id) params.append('item_id', updates.item_id);
  if (updates.photo_type !== undefined) params.append('photo_type', updates.photo_type);
  if (updates.unassign) params.append('unassign', 'true');
  
  const res = await fetch(`${API_BASE_URL}/api/media/${mediaId}?${params.toString()}`, {
    method: "PATCH",
    headers: {
      "Accept": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse<MediaItem>(res);
}

// ====================================
// NIIMBOT Printer API
// ====================================

export interface PrinterConfig {
  enabled: boolean;
  model: string;
  connection_type: string;
  bluetooth_type?: string | null;
  address?: string | null;
  density: number;
  label_width?: number | null;
  label_height?: number | null;
  label_length_mm?: number | null;
  print_direction?: string | null;
}

export interface PrinterModel {
  value: string;
  label: string;
  max_width: number;
}

export interface PrintLabelRequest {
  // Location-based printing
  location_id?: string;
  location_name?: string;
  // Item-based printing (NEW)
  item_id?: string;
  item_name?: string;
  // Common fields
  is_container?: boolean;
  label_length_mm?: number;  // Per-print label length override (mm)
}

export interface PrinterResponse {
  success: boolean;
  message: string;
}

export async function getPrinterConfig(): Promise<PrinterConfig> {
  const res = await fetch(`${API_BASE_URL}/api/printer/config`, {
    headers: {
      "Accept": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse<PrinterConfig>(res);
}

export async function updatePrinterConfig(config: PrinterConfig): Promise<PrinterResponse> {
  const res = await fetch(`${API_BASE_URL}/api/printer/config`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(config),
  });
  return handleResponse<PrinterResponse>(res);
}

export async function printLabel(request: PrintLabelRequest): Promise<PrinterResponse> {
  const res = await fetch(`${API_BASE_URL}/api/printer/print-label`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(request),
  });
  return handleResponse<PrinterResponse>(res);
}

export async function printTestLabel(): Promise<PrinterResponse> {
  const res = await fetch(`${API_BASE_URL}/api/printer/print-test-label`, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse<PrinterResponse>(res);
}

export async function testPrinterConnection(config: PrinterConfig): Promise<PrinterResponse> {
  const res = await fetch(`${API_BASE_URL}/api/printer/test-connection`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(config),
  });
  return handleResponse<PrinterResponse>(res);
}

export async function getPrinterModels(): Promise<{ models: PrinterModel[] }> {
  const res = await fetch(`${API_BASE_URL}/api/printer/models`, {
    headers: {
      "Accept": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse<{ models: PrinterModel[] }>(res);
}

// ====================================
// System Printer (CUPS) API
// ====================================

export interface SystemPrinter {
  name: string;
  info: string;
  location: string;
  make_model: string;
  state: number;
  state_message: string;
  is_default: boolean;
  accepting_jobs: boolean;
}

export interface SystemPrinterAvailability {
  available: boolean;
  message: string;
}

export async function checkSystemPrintersAvailable(): Promise<SystemPrinterAvailability> {
  const res = await fetch(`${API_BASE_URL}/api/printer/system/available`, {
    headers: {
      "Accept": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse<SystemPrinterAvailability>(res);
}

export async function getSystemPrinters(): Promise<SystemPrinter[]> {
  const res = await fetch(`${API_BASE_URL}/api/printer/system/printers`, {
    headers: {
      "Accept": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse<SystemPrinter[]>(res);
}

export async function printToSystemPrinter(
  printerName: string,
  locationId: string
): Promise<PrinterResponse> {
  const res = await fetch(`${API_BASE_URL}/api/printer/system/print-location`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({
      printer_name: printerName,
      location_id: locationId,
    }),
  });
  return handleResponse<PrinterResponse>(res);
}

export async function printItemToSystemPrinter(
  printerName: string,
  itemId: string
): Promise<PrinterResponse> {
  const res = await fetch(`${API_BASE_URL}/api/printer/system/print-item`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({
      printer_name: printerName,
      item_id: itemId,
    }),
  });
  return handleResponse<PrinterResponse>(res);
}

// ============================================================================
// Phase 2D: Printer and Label Profile Management
// ============================================================================

export interface PrinterProfile {
  id: string;
  name: string;
  model: string;
  connection_type: string;
  bluetooth_type?: string | null;
  address?: string | null;
  printhead_width_px: number;
  dpi: number;
  print_direction: string;
  max_width_mm: number;
  max_length_mm: number;
  is_enabled: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface PrinterProfileCreate {
  name: string;
  model: string;
  connection_type: string;
  bluetooth_type?: string;
  address?: string;
  default_density?: number;
}

export interface LabelProfile {
  id: string;
  name: string;
  description?: string;
  width_mm: number;
  length_mm: number;
  is_default: boolean;
  is_custom: boolean;
  created_at: string;
  updated_at: string;
}

export interface LabelProfileCreate {
  name: string;
  description?: string;
  width_mm: number;
  length_mm: number;
}

export interface LabelProfileUpdate {
  name?: string;
  description?: string;
  width_mm?: number;
  length_mm?: number;
}

export interface ActivePrinterConfig {
  id: string;
  printer_profile: PrinterProfile;
  label_profile: LabelProfile;
  density: number;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// Printer Profile API Functions
export async function getPrinterProfiles(): Promise<PrinterProfile[]> {
  const res = await fetch(`${API_BASE_URL}/api/printer/profiles/printer`, {
    headers: {
      "Accept": "application/json",
      ...authHeaders(),
    },
    credentials: 'include',
  });
  return handleResponse<PrinterProfile[]>(res);
}

export async function createPrinterProfile(profile: PrinterProfileCreate): Promise<PrinterProfile> {
  const res = await fetch(`${API_BASE_URL}/api/printer/profiles/printer`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...authHeaders(),
    },
    credentials: 'include',
    body: JSON.stringify(profile),
  });
  return handleResponse<PrinterProfile>(res);
}

export async function deletePrinterProfile(profileId: string): Promise<{ status: string; id: string }> {
  const res = await fetch(`${API_BASE_URL}/api/printer/profiles/printer/${profileId}`, {
    method: "DELETE",
    headers: {
      "Accept": "application/json",
      ...authHeaders(),
    },
    credentials: 'include',
  });
  return handleResponse<{ status: string; id: string }>(res);
}

// Label Profile API Functions
export async function getLabelProfiles(): Promise<LabelProfile[]> {
  const res = await fetch(`${API_BASE_URL}/api/printer/profiles/label`, {
    headers: {
      "Accept": "application/json",
      ...authHeaders(),
    },
    credentials: 'include',
  });
  return handleResponse<LabelProfile[]>(res);
}

export async function createLabelProfile(profile: LabelProfileCreate): Promise<LabelProfile> {
  const res = await fetch(`${API_BASE_URL}/api/printer/profiles/label`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...authHeaders(),
    },
    credentials: 'include',
    body: JSON.stringify(profile),
  });
  return handleResponse<LabelProfile>(res);
}

export async function updateLabelProfile(profileId: string, profile: LabelProfileUpdate): Promise<LabelProfile> {
  const res = await fetch(`${API_BASE_URL}/api/printer/profiles/label/${profileId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...authHeaders(),
    },
    credentials: 'include',
    body: JSON.stringify(profile),
  });
  return handleResponse<LabelProfile>(res);
}

export async function deleteLabelProfile(profileId: string): Promise<{ status: string; id: string }> {
  const res = await fetch(`${API_BASE_URL}/api/printer/profiles/label/${profileId}`, {
    method: "DELETE",
    headers: {
      "Accept": "application/json",
      ...authHeaders(),
    },
    credentials: 'include',
  });
  return handleResponse<{ status: string; id: string }>(res);
}

// Printer Configuration API Functions
export async function getActivePrinterConfig(): Promise<ActivePrinterConfig> {
  const res = await fetch(`${API_BASE_URL}/api/printer/config/active`, {
    headers: {
      "Accept": "application/json",
      ...authHeaders(),
    },
    credentials: 'include',
  });
  return handleResponse<ActivePrinterConfig>(res);
}

export async function activatePrinterConfig(printerId: string, labelId: string): Promise<ActivePrinterConfig> {
  const res = await fetch(`${API_BASE_URL}/api/printer/config/activate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...authHeaders(),
    },
    credentials: 'include',
    body: JSON.stringify({
      printer_profile_id: printerId,
      label_profile_id: labelId,
    }),
  });
  return handleResponse<ActivePrinterConfig>(res);
}

// --- Category Agent APIs ---

export async function predictCategory(name: string, description: string): Promise<{
  series?: string;
  confidence?: number;
  model_version?: number;
  training_samples?: number;
} | null> {
  const response = await fetch(`${API_BASE_URL}/api/agents/categorize/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', "Accept": "application/json", ...authHeaders() },
    body: JSON.stringify({ name, description }),
    credentials: 'include',
  });
  if (!response.ok) return null;
  const data = await response.json();
  return Object.keys(data).length > 0 ? data : null;
}

export async function submitCategoryFeedback(feedback: {
  item_id?: string | null;
  input_text: string;
  predicted_series?: string | null;
  accepted_series: string;
  was_override: boolean;
  user_action: 'ACCEPTED' | 'REJECTED';
}): Promise<void> {
  await fetch(`${API_BASE_URL}/api/agents/categorize/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', "Accept": "application/json", ...authHeaders() },
    body: JSON.stringify(feedback),
    credentials: 'include',
  });
}

export async function getCategoryAgentStatus(): Promise<{
  training_samples: number;
  model_version: number;
  last_trained_at?: string;
  series_distribution?: Record<string, number>;
} | null> {
  const response = await fetch(`${API_BASE_URL}/api/agents/categorize/status`, {
    headers: { "Accept": "application/json", ...authHeaders() },
    credentials: 'include',
  });
  if (!response.ok) return null;
  return response.json();
}

export async function resetCategoryAgent(): Promise<void> {
  await fetch(`${API_BASE_URL}/api/agents/categorize/reset`, {
    method: 'DELETE',
    headers: { "Accept": "application/json", ...authHeaders() },
    credentials: 'include',
  });
}

// ─── Collections ──────────────────────────────────────────────────────────────

export interface CollectionSharedProperties {
  vendor?: string;
  category?: string;
  notes?: string;
  custom_fields?: Array<{ label: string; value: string; type: string }>;
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  parent_id?: string | null;
  color?: string | null;
  icon?: string | null;
  cover_image_path?: string | null;
  shared_properties?: CollectionSharedProperties | null;
  item_count: number;
  sub_collection_count: number;
  created_at: string;
  updated_at: string;
}

export interface CollectionDetail extends Collection {
  parent?: Collection | null;
  children: Collection[];
  created_by?: string | null;
}

export interface CollectionTreeNode extends Collection {
  children: CollectionTreeNode[];
  total_item_count: number;
}

export interface CollectionCreate {
  name: string;
  description?: string;
  parent_id?: string | null;
  color?: string;
  icon?: string;
  shared_properties?: CollectionSharedProperties;
}

export interface CollectionUpdate {
  name?: string;
  description?: string;
  parent_id?: string | null;
  color?: string;
  icon?: string;
  shared_properties?: CollectionSharedProperties;
}

export interface CollectionMembershipResult {
  added: number;
  already_members: string[];
}

export async function fetchCollections(parentId?: string | null): Promise<Collection[]> {
  const params = new URLSearchParams();
  if (parentId !== undefined && parentId !== null) params.set('parent_id', parentId);
  const res = await fetch(`${API_BASE_URL}/api/collections/?${params}`, { credentials: 'include' });
  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new Event('auth:unauthorized'));
    throw new Error('Failed to fetch collections');
  }
  return res.json();
}

export async function fetchAllCollections(): Promise<Collection[]> {
  const res = await fetch(`${API_BASE_URL}/api/collections/tree`, { credentials: 'include' });
  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new Event('auth:unauthorized'));
    throw new Error('Failed to fetch collections tree');
  }
  const tree: CollectionTreeNode[] = await res.json();
  const flat: Collection[] = [];
  function flatten(nodes: CollectionTreeNode[]) {
    for (const n of nodes) {
      flat.push(n);
      if (n.children?.length) flatten(n.children);
    }
  }
  flatten(tree);
  return flat;
}

export async function fetchCollectionTree(): Promise<CollectionTreeNode[]> {
  const res = await fetch(`${API_BASE_URL}/api/collections/tree`, { credentials: 'include' });
  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new Event('auth:unauthorized'));
    throw new Error('Failed to fetch collection tree');
  }
  return res.json();
}

export async function fetchCollectionDetail(id: string): Promise<CollectionDetail> {
  const res = await fetch(`${API_BASE_URL}/api/collections/${id}`, { credentials: 'include' });
  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new Event('auth:unauthorized'));
    throw new Error('Failed to fetch collection');
  }
  return res.json();
}

export async function createCollection(data: CollectionCreate): Promise<CollectionDetail> {
  const res = await fetch(`${API_BASE_URL}/api/collections/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new Event('auth:unauthorized'));
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).detail || 'Failed to create collection');
  }
  return res.json();
}

export async function updateCollection(id: string, data: CollectionUpdate): Promise<CollectionDetail> {
  const res = await fetch(`${API_BASE_URL}/api/collections/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new Event('auth:unauthorized'));
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).detail || 'Failed to update collection');
  }
  return res.json();
}

export async function deleteCollection(id: string, cascade?: boolean): Promise<void> {
  const url = cascade
    ? `${API_BASE_URL}/api/collections/${id}?cascade=true`
    : `${API_BASE_URL}/api/collections/${id}`;
  const res = await fetch(url, { method: 'DELETE', credentials: 'include' });
  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new Event('auth:unauthorized'));
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).detail || 'Failed to delete collection');
  }
}

export async function fetchCollectionItems(
  id: string,
  recursive?: boolean,
): Promise<{ collection: Collection; items: Item[]; total: number }> {
  const params = new URLSearchParams();
  if (recursive) params.set('recursive', 'true');
  const res = await fetch(`${API_BASE_URL}/api/collections/${id}/items?${params}`, { credentials: 'include' });
  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new Event('auth:unauthorized'));
    throw new Error('Failed to fetch collection items');
  }
  return res.json();
}

export async function addItemsToCollection(
  collectionId: string,
  itemIds: string[],
): Promise<CollectionMembershipResult> {
  const res = await fetch(`${API_BASE_URL}/api/collections/${collectionId}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ item_ids: itemIds }),
  });
  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new Event('auth:unauthorized'));
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).detail || 'Failed to add items to collection');
  }
  return res.json();
}

export async function removeItemFromCollection(collectionId: string, itemId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/collections/${collectionId}/items/${itemId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new Event('auth:unauthorized'));
    throw new Error('Failed to remove item from collection');
  }
}

export async function fetchItemCollections(itemId: string): Promise<Collection[]> {
  const res = await fetch(`${API_BASE_URL}/api/items/${itemId}/collections`, { credentials: 'include' });
  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new Event('auth:unauthorized'));
    throw new Error('Failed to fetch item collections');
  }
  return res.json();
}

// ─── Onboarding / Setup helpers ─────────────────────────────────────────────

export interface SetupStatus {
  setup_required: boolean;
}

export async function checkSetupStatus(): Promise<SetupStatus> {
  const res = await fetch(`${API_BASE_URL}/api/auth/setup/status`);
  return handleResponse<SetupStatus>(res);
}

export interface FirstAdminPayload {
  email: string;
  full_name: string;
  password: string;
}

export async function createFirstAdmin(payload: FirstAdminPayload): Promise<User> {
  const res = await fetch(`${API_BASE_URL}/api/users/setup/first-admin`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return handleResponse<User>(res);
}

export interface HomeSetupPayload {
  home_name: string;
  rooms: { name: string; location_category?: string }[];
}

export interface HomeSetupResult {
  home_id: string;
  home_name: string;
  rooms_created: number;
}

export async function createHomeSetup(payload: HomeSetupPayload): Promise<HomeSetupResult> {
  const res = await fetch(`${API_BASE_URL}/api/onboarding/home`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return handleResponse<HomeSetupResult>(res);
}

export async function getPendingUsers(): Promise<User[]> {
  const res = await fetch(`${API_BASE_URL}/api/users/pending`, {
    headers: { "Accept": "application/json", ...authHeaders() },
    credentials: "include",
  });
  return handleResponse<User[]>(res);
}

export async function approveUser(userId: string): Promise<User> {
  const res = await fetch(`${API_BASE_URL}/api/users/${userId}/approve`, {
    method: "POST",
    headers: { "Accept": "application/json", ...authHeaders() },
    credentials: "include",
  });
  return handleResponse<User>(res);
}

export async function rejectUser(userId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/users/${userId}/reject`, {
    method: "POST",
    headers: { "Accept": "application/json", ...authHeaders() },
    credentials: "include",
  });
  return handleResponse<void>(res);
}

// ── Network Discovery ────────────────────────────────────────────────────────

export interface DiscoveredDevice {
  ip: string;
  mac: string | null;
  hostname: string | null;
  manufacturer: string | null;
  os_guess: string | null;
  open_ports: number[];
  services: string[];
  device_type_guess: string | null;
  existing_item_id: string | null;
  existing_item_name: string | null;
}

export interface NetworkScanResponse {
  subnet_scanned: string;
  scan_duration_seconds: number;
  devices_found: number;
  devices: DiscoveredDevice[];
  scan_method: string;
  error: string | null;
}

export interface NetworkImportDevice {
  action: "create" | "update" | "skip";
  device: DiscoveredDevice;
  item_id?: string;
  item_name?: string;
  location_id?: string;  // per-device room override
}

export interface NetworkImportRequest {
  location_id: string;
  devices: NetworkImportDevice[];
}

export interface NetworkImportResponse {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export async function scanNetwork(subnet?: string): Promise<NetworkScanResponse> {
  const res = await fetch(`${API_BASE_URL}/api/network/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json", ...authHeaders() },
    credentials: "include",
    body: JSON.stringify({ subnet: subnet || null }),
  });
  return handleResponse<NetworkScanResponse>(res);
}

export async function importNetworkDevices(req: NetworkImportRequest): Promise<NetworkImportResponse> {
  const res = await fetch(`${API_BASE_URL}/api/network/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json", ...authHeaders() },
    credentials: "include",
    body: JSON.stringify(req),
  });
  return handleResponse<NetworkImportResponse>(res);
}


