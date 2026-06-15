import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { ItemCreate, Location, Tag, ContactInfo, DataTagInfo, AIStatusResponse, BarcodeLookupResult, BarcodeScanResult, Warranty, MultiBarcodeLookupResult, Photo, Document, DetectionResult, DynamicField } from "../lib/api";
import { uploadPhoto, fetchTags, createTag, parseDataTagImage, getAIStatus, lookupBarcode, scanBarcodeImage, lookupBarcodeMulti, getApiBaseUrl, detectItemsFromImage, predictCategory, submitCategoryFeedback } from "../lib/api";
import { formatPhotoType, getLocationPath, getFilenameFromUrl } from "../lib/utils";
import { PHOTO_TYPES, ALLOWED_PHOTO_MIME_TYPES, ALLOWED_DOCUMENT_MIME_TYPES, DOCUMENT_TYPES, LIVING_TAG_NAME, RELATIONSHIP_LABELS, RETAILERS, BRANDS, STORAGE_KEYS } from "../lib/constants";
import type { PhotoUpload, DocumentUpload } from "../lib/types";

// Tab type for the form
type TabId = "basic" | "tags" | "warranty" | "media" | "additional_info";

interface ItemFormProps {
  onSubmit: (item: ItemCreate, photos: PhotoUpload[], documents: DocumentUpload[]) => Promise<void>;
  onCancel: () => void;
  locations: Location[];
  initialData?: Partial<ItemCreate> & { tags?: Tag[]; warranties?: Warranty[]; photos?: Photo[]; documents?: Document[]; name?: string };
  isEditing?: boolean;
  currentUserId?: string;
  currentUserName?: string;
  initialPhotoFile?: File | null;
}

// Get current date in YYYY-MM-DD format for new items
const getCurrentDate = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

// Get current date in MM/DD/YY format for display
const getCurrentDisplayDate = () => {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const year = String(today.getFullYear()).slice(-2);
  return `${month}/${day}/${year}`;
};

const ItemForm: React.FC<ItemFormProps> = ({
  onSubmit,
  onCancel,
  locations,
  initialData,
  isEditing = false,
  currentUserId,
  currentUserName,
  initialPhotoFile = null,
}) => {
  const [formData, setFormData] = useState<ItemCreate>({
    name: initialData?.name || "",
    description: initialData?.description || "",
    brand: initialData?.brand || "",
    model_number: initialData?.model_number || "",
    serial_number: initialData?.serial_number || "",
    purchase_date: initialData?.purchase_date || (!isEditing ? getCurrentDate() : ""),
    purchase_price: initialData?.purchase_price || undefined,
    estimated_value: initialData?.estimated_value || undefined,
    estimated_value_ai_date: initialData?.estimated_value_ai_date || undefined,
    estimated_value_user_date: initialData?.estimated_value_user_date || undefined,
    estimated_value_user_name: initialData?.estimated_value_user_name || undefined,
    retailer: initialData?.retailer || "",
    upc: initialData?.upc || "",
    location_id: initialData?.location_id || null,
    tag_ids: initialData?.tags?.map(t => t.id) || [],
    // Living item fields
    is_living: initialData?.is_living || false,
    birthdate: initialData?.birthdate || "",
    contact_info: initialData?.contact_info || null,
    relationship_type: initialData?.relationship_type || "",
    is_current_user: initialData?.is_current_user || false,
    associated_user_id: initialData?.associated_user_id || null,
    // Dynamic fields - Prepopulate with "Related URL" and "Notes" for new items if empty
    additional_info: initialData?.additional_info || (isEditing ? [] : [
      { label: "Related URL", value: "", type: "url" },
      { label: "Notes", value: "", type: "text" }
    ]),
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<PhotoUpload[]>([]);
  const [documents, setDocuments] = useState<DocumentUpload[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [newTagName, setNewTagName] = useState("");
  // Custom Fields Presets
  const [presetFields, setPresetFields] = useState<DynamicField[]>([]);
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const presetMenuRef = useRef<HTMLDivElement>(null);

  // Retailer autocomplete state
  const [showRetailerSuggestions, setShowRetailerSuggestions] = useState(false);
  const retailerInputRef = useRef<HTMLInputElement>(null);
  const retailerDropdownRef = useRef<HTMLDivElement>(null);
  
  // Brand autocomplete state
  const [showBrandSuggestions, setShowBrandSuggestions] = useState(false);
  const brandInputRef = useRef<HTMLInputElement>(null);
  const brandDropdownRef = useRef<HTMLDivElement>(null);

  // Photo upload refs
  const photoUploadRef = useRef<HTMLInputElement>(null);
  const cameraUploadRef = useRef<HTMLInputElement>(null);
  
  // Document URL state
  const [documentUrlManual, setDocumentUrlManual] = useState("");
  const [documentUrlAttachment, setDocumentUrlAttachment] = useState("");
  
  // AI Data Tag scanning state
  const [aiStatus, setAIStatus] = useState<AIStatusResponse | null>(null);
  const [scanningDataTag, setScanningDataTag] = useState(false);
  const [dataTagResult, setDataTagResult] = useState<DataTagInfo | null>(null);
  const dataTagInputRef = useRef<HTMLInputElement>(null);
  
  // Barcode lookup state - now supports multi-database with accept/reject flow
  const [lookingUpBarcode, setLookingUpBarcode] = useState(false);
  const [barcodeResult, setBarcodeResult] = useState<MultiBarcodeLookupResult | null>(null);
  const [currentUpcForLookup, setCurrentUpcForLookup] = useState<string>("");  // Track UPC for reject flow
  
  // Barcode scanning state (mobile camera)
  const [scanningBarcode, setScanningBarcode] = useState(false);
  const barcodeScanInputRef = useRef<HTMLInputElement>(null);

  // AI Photo Detection state (camera-to-AI processing)
  const [detectingFromPhoto, setDetectingFromPhoto] = useState(false);
  const [photoDetectionResult, setPhotoDetectionResult] = useState<DetectionResult | null>(null);

  // Category Agent suggestion state
  const [aiSeriesSuggestion, setAiSeriesSuggestion] = useState<{
    series?: string;
    confidence?: number;
    model_version?: number;
    training_samples?: number;
  } | null>(null);
  const [aiSuggestionDismissed, setAiSuggestionDismissed] = useState(false);
  const [aiSuggestionApplied, setAiSuggestionApplied] = useState(false);
  const aiDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tab state for non-mobile view
  const [activeTab, setActiveTab] = useState<TabId>("basic");

  // Warranty state
  const [warranties, setWarranties] = useState<Warranty[]>(
    initialData?.warranties || []
  );

  // Existing photos from the server (when editing)
  const [existingPhotos, setExistingPhotos] = useState<Photo[]>(
    initialData?.photos || []
  );

  // Existing documents from the server (when editing)
  const [existingDocuments, setExistingDocuments] = useState<Document[]>(
    initialData?.documents || []
  );

  // Get the primary photo from existing photos for header display
  // Priority order: 1) Photos explicitly marked as is_primary, 2) Photos with 'default' type, 3) null
  const primaryPhoto = useMemo(() => {
    return existingPhotos.find(p => p.is_primary) || existingPhotos.find(p => p.photo_type === PHOTO_TYPES.DEFAULT) || null;
  }, [existingPhotos]);

  // Memoize the Living tag ID to avoid recalculating on every render
  const livingTagId = useMemo(() => {
    const livingTag = availableTags.find(t => t.name === LIVING_TAG_NAME);
    return livingTag?.id || null;
  }, [availableTags]);

  // Check if Living tag is selected (memoized)
  const isLivingItemSelected = useMemo(() => {
    if (!livingTagId) return false;
    return (formData.tag_ids || []).includes(livingTagId);
  }, [livingTagId, formData.tag_ids]);

  // Load tags and AI status on mount
  useEffect(() => {
    fetchTags()
      .then(setAvailableTags)
      .catch(err => console.error("Failed to load tags:", err));
    
    // Check AI status for data tag scanning feature
    getAIStatus()
      .then(setAIStatus)
      .catch(() => setAIStatus({ enabled: false }));

    // Load custom field presets
    const savedPresets = localStorage.getItem(STORAGE_KEYS.CUSTOM_FIELDS_TEMPLATE);
    if (savedPresets) {
      try {
        setPresetFields(JSON.parse(savedPresets));
      } catch (e) {
        console.error("Failed to parse custom field presets", e);
      }
    }

    // If an initial photo file is passed, add it to the photos state
    if (initialPhotoFile) {
      const preview = URL.createObjectURL(initialPhotoFile);
      setPhotos([{ file: initialPhotoFile, preview, type: PHOTO_TYPES.DEFAULT }]);
    }
  }, []);

  // Close preset menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (presetMenuRef.current && !presetMenuRef.current.contains(event.target as Node)) {
        setShowPresetMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close retailer/brand suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        retailerDropdownRef.current && 
        !retailerDropdownRef.current.contains(event.target as Node) &&
        !retailerInputRef.current?.contains(event.target as Node)
      ) {
        setShowRetailerSuggestions(false);
      }
      
      if (
        brandDropdownRef.current && 
        !brandDropdownRef.current.contains(event.target as Node) &&
        !brandInputRef.current?.contains(event.target as Node)
      ) {
        setShowBrandSuggestions(false);
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      photos.forEach((photo) => URL.revokeObjectURL(photo.preview));
    };
  }, [photos]);

  // Debounced Category Agent prediction: fires 600ms after name or description changes
  useEffect(() => {
    // Skip prediction for living items (people/pets/plants) — not D56 collectibles
    if (formData.is_living) return;

    const name = formData.name?.trim() || '';
    const description = (formData.description || '').trim();

    // Need at least a name to predict
    if (!name) {
      setAiSeriesSuggestion(null);
      setAiSuggestionDismissed(false);
      return;
    }

    // Clear any pending debounce
    if (aiDebounceRef.current) clearTimeout(aiDebounceRef.current);

    aiDebounceRef.current = setTimeout(async () => {
      try {
        const result = await predictCategory(name, description);
        if (result && result.series) {
          setAiSeriesSuggestion(result);
          // Reset dismiss/apply state whenever a new prediction comes in
          setAiSuggestionDismissed(false);
          setAiSuggestionApplied(false);
        } else {
          setAiSeriesSuggestion(null);
        }
      } catch {
        // Silent fail — prediction is best-effort
        setAiSeriesSuggestion(null);
      }
    }, 600);

    return () => {
      if (aiDebounceRef.current) clearTimeout(aiDebounceRef.current);
    };
  }, [formData.name, formData.description, formData.is_living]);

  // Update is_living flag and clear irrelevant fields when switching between living/non-living modes.
  // This is intentional behavior: Living items (people, pets, plants) don't have purchase dates, 
  // brands, etc., while non-living items don't have birthdates, relationships, or contact info.
  // The field clearing ensures clean data and prevents confusion.
  useEffect(() => {
    if (isLivingItemSelected !== formData.is_living) {
      setFormData(prev => ({
        ...prev,
        is_living: isLivingItemSelected,
        // Clear non-living fields when switching to living mode
        ...(isLivingItemSelected ? {
          purchase_date: "",
          purchase_price: undefined,
          brand: "",
          model_number: "",
          serial_number: "",
          retailer: "",
          upc: "",
        } : {
          // Clear living fields when switching to non-living mode
          birthdate: "",
          contact_info: null,
          relationship_type: "",
          is_current_user: false,
          associated_user_id: null,
        })
      }));
    }
  }, [isLivingItemSelected, formData.is_living]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData((prev) => {
      const updates: Partial<ItemCreate> = {
        [name]:
          type === "checkbox"
            ? checked
            : name === "purchase_price" || name === "estimated_value"
            ? value === ""
              ? undefined
              : parseFloat(value)
            : name === "location_id"
            ? value === ""
              ? null
              : value
            : value,
      };
      
      // When user changes the estimated value, clear AI date and set user info
      if (name === "estimated_value") {
        updates.estimated_value_ai_date = undefined;
        // Only set user info if there's a value
        if (value !== "") {
          updates.estimated_value_user_date = getCurrentDisplayDate();
          updates.estimated_value_user_name = currentUserName || "Unknown";
        } else {
          updates.estimated_value_user_date = undefined;
          updates.estimated_value_user_name = undefined;
        }
      }
      
      return { ...prev, ...updates };
    });
  };

  const handleRetailerSelect = (retailer: string) => {
    setFormData(prev => ({ ...prev, retailer }));
    setShowRetailerSuggestions(false);
  };

  const handleBrandSelect = (brand: string) => {
    setFormData(prev => ({ ...prev, brand }));
    setShowBrandSuggestions(false);
  };

  const handleContactInfoChange = (field: keyof ContactInfo, value: string) => {
    setFormData(prev => ({
      ...prev,
      contact_info: value 
        ? { ...prev.contact_info, [field]: value } 
        : { ...prev.contact_info, [field]: null }
    }));
  };

  const handleIsCurrentUserChange = (checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      is_current_user: checked,
      relationship_type: checked ? "self" : prev.relationship_type,
      // When unchecking, clear the associated_user_id since the item is no longer associated with the current user
      associated_user_id: checked ? (currentUserId || null) : null,
    }));
  };

  // Dynamic Field Handlers
  const handleDynamicFieldChange = (index: number, field: keyof DynamicField, value: string) => {
    setFormData(prev => {
      const updatedInfo = [...(prev.additional_info || [])];
      updatedInfo[index] = { ...updatedInfo[index], [field]: value };
      return { ...prev, additional_info: updatedInfo };
    });
  };

  const addDynamicField = () => {
    setFormData(prev => ({
      ...prev,
      additional_info: [...(prev.additional_info || []), { label: "", value: "", type: "text" }]
    }));
  };

  const addPresetField = (preset: DynamicField) => {
    setFormData(prev => ({
      ...prev,
      additional_info: [...(prev.additional_info || []), { ...preset, value: preset.value || "" }]
    }));
    setShowPresetMenu(false);
  };

  const removeDynamicField = (index: number) => {
    setFormData(prev => {
      const updatedInfo = [...(prev.additional_info || [])];
      updatedInfo.splice(index, 1);
      return { ...prev, additional_info: updatedInfo };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // Sanitize form data before submission:
      // Convert empty strings to null for fields that expect dates or UUIDs
      // to prevent Pydantic validation errors on the backend
      const sanitizedData: ItemCreate = {
        ...formData,
        purchase_date: formData.purchase_date === '' ? null : formData.purchase_date,
        birthdate: formData.birthdate === '' ? null : formData.birthdate,
        location_id: formData.location_id === '' ? null : formData.location_id,
        associated_user_id: formData.associated_user_id === '' ? null : formData.associated_user_id,
        warranties: warranties.length > 0 ? warranties : undefined,
      };
      await onSubmit(sanitizedData, photos, documents);

      // Fire-and-forget Category Agent feedback (only if a suggestion was shown)
      if (aiSeriesSuggestion?.series) {
        const seriesField = (formData.additional_info || []).find(f => f.label === 'Series');
        const acceptedSeries = seriesField?.value || formData.name;
        const wasAccepted = aiSuggestionApplied && !aiSuggestionDismissed;
        submitCategoryFeedback({
          input_text: `${formData.name} ${formData.description || ''}`.trim(),
          predicted_series: aiSeriesSuggestion.series,
          accepted_series: acceptedSeries,
          was_override: !wasAccepted,
          user_action: wasAccepted ? 'ACCEPTED' : 'REJECTED',
        }).catch(() => {/* silent */});
      }
    } catch (err: any) {
      setError(err.message || "Failed to save item");
    } finally {
      setLoading(false);
    }
  };

  // Category Agent: apply suggested series as a dynamic "Series" field
  const handleApplyAiSuggestion = useCallback(() => {
    if (!aiSeriesSuggestion?.series) return;
    const seriesValue = aiSeriesSuggestion.series;
    setFormData(prev => {
      const existing = [...(prev.additional_info || [])];
      const idx = existing.findIndex(f => f.label === 'Series');
      if (idx >= 0) {
        existing[idx] = { ...existing[idx], value: seriesValue };
      } else {
        existing.unshift({ label: 'Series', value: seriesValue, type: 'text' });
      }
      return { ...prev, additional_info: existing };
    });
    setAiSuggestionApplied(true);
    setAiSuggestionDismissed(false);
  }, [aiSeriesSuggestion]);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const files = e.target.files;
    if (!files) return;

    const newPhotos: PhotoUpload[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // Validate file type
      if (ALLOWED_PHOTO_MIME_TYPES.includes(file.type)) {
        const preview = URL.createObjectURL(file);
        newPhotos.push({ file, preview, type });
      } else {
        const allowedTypes = ALLOWED_PHOTO_MIME_TYPES.map(mt => mt.replace('image/', '')).join(', ').toUpperCase();
        setError(`Invalid file type: ${file.name}. Allowed types: ${allowedTypes}`);
      }
    }

    // For default, data_tag, and profile types, only one photo is allowed
    // Remove any existing photos of the same type before adding new ones
    if (type === PHOTO_TYPES.DEFAULT || type === PHOTO_TYPES.DATA_TAG || type === PHOTO_TYPES.PROFILE) {
      setPhotos((prev) => {
        // Revoke URLs for photos being removed
        prev.filter(p => p.type === type).forEach(p => URL.revokeObjectURL(p.preview));
        // Remove existing photos of this type and add new one
        return [...prev.filter(p => p.type !== type), ...newPhotos];
      });
    } else {
      setPhotos((prev) => [...prev, ...newPhotos]);
    }

    // Auto-trigger AI detection for default/primary photo if AI is enabled and not editing
    if (type === PHOTO_TYPES.DEFAULT && !isEditing && aiStatus?.enabled && newPhotos.length > 0) {
      const file = newPhotos[0].file;
      setDetectingFromPhoto(true);
      setError(null);
      setPhotoDetectionResult(null);

      try {
        const result = await detectItemsFromImage(file);
        if (result.items.length > 0) {
          // Set the result to show the accept/reject dialog
          setPhotoDetectionResult(result);
        }
      } catch (err: any) {
        // Don't show error for failed AI detection - user can still fill form manually
        console.warn("AI detection failed:", err.message);
      } finally {
        setDetectingFromPhoto(false);
      }
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  const handleTagToggle = (tagId: string) => {
    setFormData(prev => {
      const currentTags = prev.tag_ids || [];
      const isSelected = currentTags.includes(tagId);
      return {
        ...prev,
        tag_ids: isSelected
          ? currentTags.filter(id => id !== tagId)
          : [...currentTags, tagId]
      };
    });
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    
    try {
      const tag = await createTag(newTagName.trim());
      setAvailableTags(prev => [...prev, tag]);
      setFormData(prev => ({
        ...prev,
        tag_ids: [...(prev.tag_ids || []), tag.id]
      }));
      setNewTagName("");
    } catch (err: any) {
      setError(err.message || "Failed to create tag");
    }
  };

  // Handle data tag scan - triggers file input
  const handleDataTagScan = () => {
    dataTagInputRef.current?.click();
  };

  // Handle data tag file selection and AI parsing
  const handleDataTagFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !files[0]) return;
    
    const file = files[0];
    if (!ALLOWED_PHOTO_MIME_TYPES.includes(file.type)) {
      setError("Please select a valid image file (JPEG, PNG, GIF, or WebP)");
      return;
    }
    
    // Also add this as the data tag photo
    const preview = URL.createObjectURL(file);
    setPhotos((prev) => {
      // Revoke URLs for existing data tag photos
      prev.filter(p => p.type === PHOTO_TYPES.DATA_TAG).forEach(p => URL.revokeObjectURL(p.preview));
      // Remove existing data tag photos and add new one
      return [...prev.filter(p => p.type !== PHOTO_TYPES.DATA_TAG), { file, preview, type: PHOTO_TYPES.DATA_TAG }];
    });
    
    // Parse the data tag with AI
    setScanningDataTag(true);
    setError(null);
    setDataTagResult(null);
    
    try {
      const result = await parseDataTagImage(file);
      setDataTagResult(result);
    } catch (err: any) {
      setError(err.message || "Failed to parse data tag image");
    } finally {
      setScanningDataTag(false);
      // Reset the input so the same file can be selected again
      if (dataTagInputRef.current) {
        dataTagInputRef.current.value = "";
      }
    }
  };

  // Apply parsed data tag info to form fields
  const applyDataTagInfo = (info: DataTagInfo) => {
    setFormData(prev => ({
      ...prev,
      brand: info.brand || info.manufacturer || prev.brand,
      model_number: info.model_number || prev.model_number,
      serial_number: info.serial_number || prev.serial_number,
      // Only apply estimated value if it's provided by AI and there's no existing value
      estimated_value: info.estimated_value ?? prev.estimated_value,
      // Set AI date if value came from AI, otherwise preserve existing value
      estimated_value_ai_date: info.estimated_value ? info.estimation_date : prev.estimated_value_ai_date,
      // Clear user date if value came from AI
      estimated_value_user_date: info.estimated_value ? undefined : prev.estimated_value_user_date,
      estimated_value_user_name: info.estimated_value ? undefined : prev.estimated_value_user_name,
    }));
    setDataTagResult(null);
  };

  // Dismiss data tag result without applying
  const dismissDataTagResult = () => {
    setDataTagResult(null);
  };

  // Apply AI photo detection result to form fields
  // User stays on form to review and add more information
  const applyPhotoDetectionResult = () => {
    if (!photoDetectionResult || photoDetectionResult.items.length === 0) return;
    
    // Use the first detected item
    const item = photoDetectionResult.items[0];
    setFormData(prev => {
      // Check if we should apply the AI estimated value
      const shouldApplyAIValue = prev.estimated_value === undefined && item.estimated_value != null;
      
      return {
        ...prev,
        name: item.name || prev.name,
        description: item.description || prev.description,
        brand: item.brand || prev.brand,
        // Only apply estimated value if it's provided by AI and there's no existing value
        estimated_value: prev.estimated_value !== undefined ? prev.estimated_value : item.estimated_value,
        // Set AI date only if we're applying the AI value
        estimated_value_ai_date: shouldApplyAIValue ? item.estimation_date : prev.estimated_value_ai_date,
        // Clear user date only if we're applying the AI value
        estimated_value_user_date: shouldApplyAIValue ? undefined : prev.estimated_value_user_date,
        estimated_value_user_name: shouldApplyAIValue ? undefined : prev.estimated_value_user_name,
      };
    });
    // Dismiss the detection result dialog - user can now review and add more info
    setPhotoDetectionResult(null);
  };

  // Dismiss photo detection result without applying
  const dismissPhotoDetectionResult = () => {
    setPhotoDetectionResult(null);
  };

  // Handle barcode lookup - uses multi-database flow
  const handleBarcodeLookup = async (databaseId?: string | null) => {
    const upc = databaseId ? currentUpcForLookup : formData.upc?.trim();
    if (!upc) {
      setError("Please enter a UPC/barcode to look up");
      return;
    }
    
    setLookingUpBarcode(true);
    setError(null);
    setBarcodeResult(null);
    setCurrentUpcForLookup(upc);  // Store for reject flow
    
    try {
      const result = await lookupBarcodeMulti(upc, databaseId);
      setBarcodeResult(result);
    } catch (err: any) {
      setError(err.message || "Failed to look up barcode");
    } finally {
      setLookingUpBarcode(false);
    }
  };

  // Handle "Try Next Database" when user rejects current result
  const handleTryNextDatabase = async () => {
    if (!barcodeResult?.next_database_id) {
      // No more databases - show not found message
      setError("Product not found in any configured database. Please enter details manually.");
      setBarcodeResult(null);
      return;
    }
    
    // Look up from the next database
    await handleBarcodeLookup(barcodeResult.next_database_id);
  };

  // Apply barcode lookup result to form fields
  const applyBarcodeResult = (result: MultiBarcodeLookupResult) => {
    setFormData(prev => ({
      ...prev,
      name: result.name || prev.name,
      description: result.description || prev.description,
      brand: result.brand || prev.brand,
      model_number: result.model_number || prev.model_number,
      // Only apply estimated value if it's provided by AI and there's no existing value
      estimated_value: result.estimated_value ?? prev.estimated_value,
      // Set AI date if value came from AI, otherwise preserve existing value
      estimated_value_ai_date: result.estimated_value ? result.estimation_date : prev.estimated_value_ai_date,
      // Clear user date if value came from AI
      estimated_value_user_date: result.estimated_value ? undefined : prev.estimated_value_user_date,
      estimated_value_user_name: result.estimated_value ? undefined : prev.estimated_value_user_name,
    }));
    setBarcodeResult(null);
    setCurrentUpcForLookup("");
  };

  // Dismiss barcode result without applying (reject)
  const dismissBarcodeResult = () => {
    setBarcodeResult(null);
    setCurrentUpcForLookup("");
  };

  // Handle barcode scan - triggers file input (mobile camera)
  const handleBarcodeScan = () => {
    barcodeScanInputRef.current?.click();
  };

  // Handle barcode image capture and AI parsing
  const handleBarcodeScanFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !files[0]) return;
    
    const file = files[0];
    if (!ALLOWED_PHOTO_MIME_TYPES.includes(file.type)) {
      setError("Please select a valid image file (JPEG, PNG, GIF, or WebP)");
      return;
    }
    
    // Parse the barcode from the image
    setScanningBarcode(true);
    setError(null);
    setBarcodeResult(null);
    
    try {
      const result = await scanBarcodeImage(file);
      if (result.found && result.upc) {
        // Update the UPC field with the scanned value
        const scannedUpc = result.upc;  // Capture in local variable for closure
        setFormData(prev => ({
          ...prev,
          upc: scannedUpc
        }));
        setCurrentUpcForLookup(scannedUpc);
        
        // Automatically look up product info for the scanned barcode using multi-database flow
        setScanningBarcode(false);  // Update state to show we're now looking up
        setLookingUpBarcode(true);
        
        try {
          const lookupResult = await lookupBarcodeMulti(scannedUpc);
          setBarcodeResult(lookupResult);  // Show results for user to accept/reject
        } catch (lookupErr: any) {
          // If lookup fails, we still have the UPC in the field
          setError(lookupErr.message || "Barcode scanned but product lookup failed");
        } finally {
          setLookingUpBarcode(false);
        }
      } else {
        setError("Could not read barcode from image. Please try again with a clearer photo.");
        setScanningBarcode(false);
      }
    } catch (err: any) {
      setError(err.message || "Failed to scan barcode image");
      setScanningBarcode(false);
    } finally {
      // Reset the input so the same file can be selected again
      if (barcodeScanInputRef.current) {
        barcodeScanInputRef.current.value = "";
      }
    }
  };

  // Warranty handlers
  const addWarranty = (type: 'manufacturer' | 'extended') => {
    setWarranties(prev => [...prev, { type }]);
  };

  const removeWarranty = (index: number) => {
    setWarranties(prev => prev.filter((_, i) => i !== index));
  };

  const updateWarranty = <K extends keyof Warranty>(
    index: number,
    field: K,
    value: Warranty[K]
  ) => {
    setWarranties(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Document handlers
  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const files = e.target.files;
    if (!files) return;

    const newDocuments: DocumentUpload[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // Validate file type
      if (ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type)) {
        newDocuments.push({ file, type });
      } else {
        setError(`Invalid file type: ${file.name}. Allowed types: PDF, TXT`);
      }
    }

    setDocuments((prev) => [...prev, ...newDocuments]);
  };

  const handleDocumentUrlAdd = (type: string) => {
    const url = type === DOCUMENT_TYPES.MANUAL ? documentUrlManual : documentUrlAttachment;
    
    if (!url.trim()) {
      setError("Please enter a URL");
      return;
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch (e) {
      setError("Please enter a valid URL");
      return;
    }

    // Add URL-based document
    setDocuments((prev) => [...prev, { url, type }]);
    
    // Clear the input
    if (type === DOCUMENT_TYPES.MANUAL) {
      setDocumentUrlManual("");
    } else {
      setDocumentUrlAttachment("");
    }
    setError(null);
  };

  const removeDocument = (index: number) => {
    setDocuments((prev) => {
      const updated = [...prev];
      updated.splice(index, 1);
      return updated;
    });
  };

  const livingMode = isLivingItemSelected;

  // Render content for Tab 1: Basic Item Information
  const renderBasicInfoTab = () => (
    <div className="tab-content">
      {/* Name and Description - Always visible */}
      <div className="form-group">
        <label htmlFor="name">Name *</label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          disabled={loading}
          placeholder={livingMode ? "Person/Pet/Plant name" : "Item name"}
        />
      </div>

      <div className="form-group">
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          name="description"
          value={formData.description || ""}
          onChange={handleChange}
          rows={3}
          disabled={loading}
          placeholder={livingMode ? "Notes about this person, pet, or plant" : "Item description"}
        />
      </div>

      {/* Category Agent AI Suggestion Badge */}
      {!livingMode &&
        aiSeriesSuggestion?.series &&
        (aiSeriesSuggestion.confidence ?? 0) >= 0.70 &&
        !aiSuggestionDismissed && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              flexWrap: 'wrap',
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              background: 'color-mix(in srgb, var(--color-primary, #6c63ff) 10%, var(--bg-card, #fff))',
              border: '1px solid color-mix(in srgb, var(--color-primary, #6c63ff) 30%, transparent)',
              marginBottom: '0.75rem',
              fontSize: '0.82rem',
            }}
          >
            <span style={{ color: 'var(--color-primary, #6c63ff)', fontWeight: 600 }}>
              🤖 AI suggests:
            </span>
            <span style={{ fontStyle: 'italic', color: 'var(--text-primary, inherit)' }}>
              &ldquo;{aiSeriesSuggestion.series}&rdquo;
            </span>
            <span style={{ color: 'var(--text-muted)', marginLeft: '0.1rem' }}>
              ({Math.round((aiSeriesSuggestion.confidence ?? 0) * 100)}% confidence)
            </span>
            {aiSuggestionApplied ? (
              <span style={{ color: 'var(--color-success, #4caf50)', fontWeight: 500, marginLeft: '0.25rem' }}>
                ✓ Applied
              </span>
            ) : (
              <button
                type="button"
                onClick={handleApplyAiSuggestion}
                disabled={loading}
                style={{
                  padding: '0.2rem 0.6rem',
                  borderRadius: '4px',
                  border: '1px solid var(--color-primary, #6c63ff)',
                  background: 'var(--color-primary, #6c63ff)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  marginLeft: '0.25rem',
                }}
              >
                Apply
              </button>
            )}
            <button
              type="button"
              onClick={() => setAiSuggestionDismissed(true)}
              disabled={loading}
              aria-label="Dismiss AI suggestion"
              style={{
                padding: '0.2rem 0.5rem',
                borderRadius: '4px',
                border: '1px solid var(--border-color, #ccc)',
                background: 'transparent',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.78rem',
                marginLeft: 'auto',
              }}
            >
              Dismiss
            </button>
          </div>
        )}

      {/* Living Item Fields */}
      {livingMode && (
        <div className="form-section living-section">
          <h3>Living Item Details</h3>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="relationship_type">Relationship</label>
              <select
                id="relationship_type"
                name="relationship_type"
                value={formData.relationship_type || ""}
                onChange={handleChange}
                disabled={loading || formData.is_current_user}
              >
                <option value="">-- Select Relationship --</option>
                {Object.entries(RELATIONSHIP_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="birthdate">Birthdate</label>
              <input
                type="date"
                id="birthdate"
                name="birthdate"
                value={formData.birthdate || ""}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
          </div>

          {currentUserId && (
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.is_current_user || false}
                  onChange={(e) => handleIsCurrentUserChange(e.target.checked)}
                  disabled={loading}
                />
                <span>This is me (associate with my account)</span>
              </label>
            </div>
          )}

          <div className="form-section contact-section">
            <h4>Contact Information</h4>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="contact_phone">Phone</label>
                <input
                  type="tel"
                  id="contact_phone"
                  value={formData.contact_info?.phone || ""}
                  onChange={(e) => handleContactInfoChange('phone', e.target.value)}
                  disabled={loading}
                  placeholder="Phone number"
                />
              </div>

              <div className="form-group">
                <label htmlFor="contact_email">Email</label>
                <input
                  type="email"
                  id="contact_email"
                  value={formData.contact_info?.email || ""}
                  onChange={(e) => handleContactInfoChange('email', e.target.value)}
                  disabled={loading}
                  placeholder="Email address"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="contact_address">Address</label>
              <input
                type="text"
                id="contact_address"
                value={formData.contact_info?.address || ""}
                onChange={(e) => handleContactInfoChange('address', e.target.value)}
                disabled={loading}
                placeholder="Address"
              />
            </div>

            <div className="form-group">
              <label htmlFor="contact_notes">Contact Notes</label>
              <textarea
                id="contact_notes"
                value={formData.contact_info?.notes || ""}
                onChange={(e) => handleContactInfoChange('notes', e.target.value)}
                rows={2}
                disabled={loading}
                placeholder="Additional contact notes"
              />
            </div>
          </div>
        </div>
      )}

      {/* Non-Living Item Fields */}
      {!livingMode && (
        <>
          <div className="form-row">
            <div className="form-group" style={{ position: 'relative' }}>
              <label htmlFor="brand">Brand</label>
              <input
                ref={brandInputRef}
                type="text"
                id="brand"
                name="brand"
                value={formData.brand || ""}
                onChange={(e) => {
                  handleChange(e);
                  setShowBrandSuggestions(true);
                }}
                onFocus={() => setShowBrandSuggestions(true)}
                disabled={loading}
                autoComplete="off"
                placeholder="Select or type brand..."
              />
              {showBrandSuggestions && (
                <div 
                  ref={brandDropdownRef}
                  className="brand-dropdown"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 10,
                    maxHeight: '200px',
                    overflowY: 'auto',
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-panel)',
                    borderRadius: '0 0 0.5rem 0.5rem',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                  }}
                >
                  {/* Option to add new brand if filtered list doesn't match exact */}
                  {formData.brand && !BRANDS.some(b => b.toLowerCase() === formData.brand?.toLowerCase()) && (
                    <div
                      className="brand-option add-new"
                      onClick={() => handleBrandSelect(formData.brand || "")}
                      style={{
                        padding: '0.5rem 0.75rem',
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--border-panel)',
                        color: 'var(--accent)',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated-softer)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <span>+</span> Add "{formData.brand}"
                    </div>
                  )}
                  
                  {BRANDS.filter(b => 
                    !formData.brand || 
                    b.toLowerCase().includes(formData.brand.toLowerCase())
                  ).slice(0, 50).map(brand => (
                    <div
                      key={brand}
                      className="brand-option"
                      onClick={() => handleBrandSelect(brand)}
                      style={{
                        padding: '0.5rem 0.75rem',
                        cursor: 'pointer',
                        transition: 'background 0.1s',
                        borderBottom: '1px solid var(--border-subtle)'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated-softer)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      {brand}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="model_number">Model Number</label>
              <input
                type="text"
                id="model_number"
                name="model_number"
                value={formData.model_number || ""}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="serial_number">Serial Number</label>
              <input
                type="text"
                id="serial_number"
                name="serial_number"
                value={formData.serial_number || ""}
                onChange={handleChange}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="upc">UPC / Barcode</label>
              <div className="upc-input-wrapper">
                <input
                  type="text"
                  id="upc"
                  name="upc"
                  value={formData.upc || ""}
                  onChange={handleChange}
                  disabled={loading || lookingUpBarcode || scanningBarcode}
                  placeholder="Enter UPC/barcode"
                />
                {aiStatus?.enabled && (
                  <>
                    {/* Hidden file input for barcode camera scanning */}
                    <input
                      type="file"
                      ref={barcodeScanInputRef}
                      accept="image/*"
                      capture="environment"
                      onChange={handleBarcodeScanFileChange}
                      disabled={loading || scanningBarcode}
                      style={{ display: "none" }}
                    />
                    <button
                      type="button"
                      className="btn-outline btn-barcode-scan"
                      onClick={handleBarcodeScan}
                      disabled={loading || scanningBarcode}
                      title="Scan barcode with camera"
                    >
                      {scanningBarcode ? "🔄" : "📷"}
                    </button>
                    <button
                      type="button"
                      className="btn-outline btn-barcode-lookup"
                      onClick={() => handleBarcodeLookup()}
                      disabled={loading || lookingUpBarcode || !formData.upc?.trim()}
                      title="Look up product info from UPC/barcode"
                    >
                      {lookingUpBarcode ? "🔄 Looking up..." : "🔍 UPC Lookup"}
                    </button>
                  </>
                )}
              </div>
              {aiStatus?.enabled && (
                <span className="help-text">Tap 📷 to scan barcode and auto-lookup product info</span>
              )}
            </div>
          </div>

          {/* Barcode Lookup Results - Multi-Database with Accept/Reject Flow */}
          {barcodeResult && (
            <div className="barcode-lookup-result">
              {barcodeResult.found ? (
                <>
                  <h4>📦 Product Found</h4>
                  <div className="barcode-result-source">
                    <span className="source-label">Source:</span>
                    <span className="source-value">
                      {barcodeResult.source === 'gemini' ? '🤖 Gemini AI' : 
                       barcodeResult.source === 'upcdatabase' ? '📚 UPC Database' : 
                       barcodeResult.source}
                    </span>
                  </div>
                  <div className="barcode-result-fields">
                    {barcodeResult.name && (
                      <div className="barcode-result-field">
                        <span className="field-label">Product:</span>
                        <span className="field-value">{barcodeResult.name}</span>
                      </div>
                    )}
                    {barcodeResult.brand && (
                      <div className="barcode-result-field">
                        <span className="field-label">Brand:</span>
                        <span className="field-value">{barcodeResult.brand}</span>
                      </div>
                    )}
                    {barcodeResult.model_number && (
                      <div className="barcode-result-field">
                        <span className="field-label">Model:</span>
                        <span className="field-value">{barcodeResult.model_number}</span>
                      </div>
                    )}
                    {barcodeResult.category && (
                      <div className="barcode-result-field">
                        <span className="field-label">Category:</span>
                        <span className="field-value">{barcodeResult.category}</span>
                      </div>
                    )}
                    {barcodeResult.description && (
                      <div className="barcode-result-field">
                        <span className="field-label">Description:</span>
                        <span className="field-value">{barcodeResult.description}</span>
                      </div>
                    )}
                    {barcodeResult.estimated_value != null && (
                      <div className="barcode-result-field">
                        <span className="field-label">Est. Value:</span>
                        <span className="field-value">${barcodeResult.estimated_value.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                  <div className="barcode-result-actions">
                    {barcodeResult.has_next_database && (
                      <button
                        type="button"
                        className="btn-outline"
                        onClick={handleTryNextDatabase}
                        disabled={lookingUpBarcode}
                        title={`Try ${barcodeResult.next_database_name || 'next database'}`}
                      >
                        {lookingUpBarcode ? "🔄 Checking..." : `Try ${barcodeResult.next_database_name || 'Next'}`}
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={dismissBarcodeResult}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => applyBarcodeResult(barcodeResult)}
                    >
                      Accept
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h4>❌ Product Not Found</h4>
                  <div className="barcode-result-source">
                    <span className="source-label">Searched:</span>
                    <span className="source-value">
                      {barcodeResult.source === 'gemini' ? '🤖 Gemini AI' : 
                       barcodeResult.source === 'upcdatabase' ? '📚 UPC Database' : 
                       barcodeResult.source}
                    </span>
                  </div>
                  <p className="no-result-message">
                    Could not identify a product for this UPC/barcode in this database.
                  </p>
                  <div className="barcode-result-actions">
                    {barcodeResult.has_next_database ? (
                      <>
                        <button
                          type="button"
                          className="btn-outline"
                          onClick={dismissBarcodeResult}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={handleTryNextDatabase}
                          disabled={lookingUpBarcode}
                        >
                          {lookingUpBarcode ? "🔄 Checking..." : `Try ${barcodeResult.next_database_name || 'Next Database'}`}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn-outline"
                        onClick={dismissBarcodeResult}
                      >
                        Enter Details Manually
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Photo Detection Results - AI-powered item detection from camera photo */}
          {photoDetectionResult && photoDetectionResult.items.length > 0 && (
            <div className="barcode-lookup-result">
              <h4>📸 Item Detected from Photo</h4>
              <p className="help-text">AI detected an item from your photo. Accept to pre-fill the form, then review and add any missing details.</p>
              <div className="barcode-result-fields">
                {photoDetectionResult.items[0].name && (
                  <div className="barcode-result-field">
                    <span className="field-label">Item Name:</span>
                    <span className="field-value">{photoDetectionResult.items[0].name}</span>
                  </div>
                )}
                {photoDetectionResult.items[0].description && (
                  <div className="barcode-result-field">
                    <span className="field-label">Description:</span>
                    <span className="field-value">{photoDetectionResult.items[0].description}</span>
                  </div>
                )}
                {photoDetectionResult.items[0].brand && (
                  <div className="barcode-result-field">
                    <span className="field-label">Brand:</span>
                    <span className="field-value">{photoDetectionResult.items[0].brand}</span>
                  </div>
                )}
                {photoDetectionResult.items[0].estimated_value != null && (
                  <div className="barcode-result-field">
                    <span className="field-label">Est. Value:</span>
                    <span className="field-value">${photoDetectionResult.items[0].estimated_value.toLocaleString()}</span>
                  </div>
                )}
                {photoDetectionResult.items[0].confidence != null && (
                  <div className="barcode-result-field">
                    <span className="field-label">Confidence:</span>
                    <span className="field-value">{Math.round(photoDetectionResult.items[0].confidence * 100)}%</span>
                  </div>
                )}
              </div>
              <div className="barcode-result-actions">
                <button
                  type="button"
                  className="btn-outline"
                  onClick={dismissPhotoDetectionResult}
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={applyPhotoDetectionResult}
                >
                  Accept & Continue Editing
                </button>
              </div>
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="purchase_date">Purchase Date</label>
              <input
                type="date"
                id="purchase_date"
                name="purchase_date"
                value={formData.purchase_date || ""}
                onChange={handleChange}
                disabled={loading}
              />
            </div>

            <div className="form-group" style={{ position: 'relative' }}>
              <label htmlFor="retailer">Retailer</label>
              <input
                ref={retailerInputRef}
                type="text"
                id="retailer"
                name="retailer"
                value={formData.retailer || ""}
                onChange={(e) => {
                  handleChange(e);
                  setShowRetailerSuggestions(true);
                }}
                onFocus={() => setShowRetailerSuggestions(true)}
                disabled={loading}
                autoComplete="off"
                placeholder="Select or type retailer..."
              />
              {showRetailerSuggestions && (
                <div 
                  ref={retailerDropdownRef}
                  className="retailer-dropdown"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 10,
                    maxHeight: '200px',
                    overflowY: 'auto',
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-panel)',
                    borderRadius: '0 0 0.5rem 0.5rem',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                  }}
                >
                  {/* Option to add new retailer if filtered list doesn't match exact */}
                  {formData.retailer && !RETAILERS.some(r => r.toLowerCase() === formData.retailer?.toLowerCase()) && (
                    <div
                      className="retailer-option add-new"
                      onClick={() => handleRetailerSelect(formData.retailer || "")}
                      style={{
                        padding: '0.5rem 0.75rem',
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--border-panel)',
                        color: 'var(--accent)',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated-softer)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <span>+</span> Add "{formData.retailer}"
                    </div>
                  )}
                  
                  {RETAILERS.filter(r => 
                    !formData.retailer || 
                    r.toLowerCase().includes(formData.retailer.toLowerCase())
                  ).slice(0, 50).map(retailer => (
                    <div
                      key={retailer}
                      className="retailer-option"
                      onClick={() => handleRetailerSelect(retailer)}
                      style={{
                        padding: '0.5rem 0.75rem',
                        cursor: 'pointer',
                        transition: 'background 0.1s',
                        borderBottom: '1px solid var(--border-subtle)'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated-softer)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      {retailer}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="purchase_price">Purchase Price</label>
              <input
                type="number"
                id="purchase_price"
                name="purchase_price"
                value={formData.purchase_price ?? ""}
                onChange={handleChange}
                step="0.01"
                min="0"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="estimated_value">Estimated Value</label>
              <input
                type="number"
                id="estimated_value"
                name="estimated_value"
                value={formData.estimated_value ?? ""}
                onChange={handleChange}
                step="0.01"
                min="0"
                disabled={loading}
              />
              {formData.estimated_value_ai_date && (
                <span className="help-text ai-estimate-note">
                  ℹ️ AI best guess on date: {formData.estimated_value_ai_date}
                </span>
              )}
              {formData.estimated_value_user_date && formData.estimated_value_user_name && (
                <span className="help-text user-estimate-note">
                  ℹ️ User supplied value by {formData.estimated_value_user_name} on date: {formData.estimated_value_user_date}
                </span>
              )}
            </div>
          </div>
        </>
      )}

      {/* Location - Always visible */}
      <div className="form-group">
        <label htmlFor="location_id">Location</label>
        <select
          id="location_id"
          name="location_id"
          value={formData.location_id?.toString() || ""}
          onChange={handleChange}
          disabled={loading}
        >
          <option value="">-- No Location --</option>
          {locations.map((location) => (
            <option key={location.id} value={location.id.toString()}>
              {getLocationPath(location.id, locations)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  // Render content for Tags Tab
  const renderTagsTab = () => (
    <div className="tab-content">
      <div className="form-section">
        <h3>Tags</h3>
        <p className="help-text">Select "Living" tag for people, pets, plants, or other living things</p>
        <div className="tags-selection">
          {availableTags.map((tag) => (
            <label key={tag.id} className="tag-checkbox">
              <input
                type="checkbox"
                checked={(formData.tag_ids || []).includes(tag.id)}
                onChange={() => handleTagToggle(tag.id)}
                disabled={loading}
              />
              <span className={tag.is_predefined ? "tag-predefined" : "tag-custom"}>
                {tag.name}
              </span>
            </label>
          ))}
        </div>
        <div className="new-tag-input">
          <input
            type="text"
            placeholder="Create new tag..."
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleCreateTag())}
            disabled={loading}
          />
          <button
            type="button"
            onClick={handleCreateTag}
            disabled={loading || !newTagName.trim()}
            className="btn-outline"
          >
            Add Tag
          </button>
        </div>
      </div>
    </div>
  );

  // Render content for Tab 2: Warranty Information
  const renderWarrantyTab = () => (
    <div className="tab-content">
      <div className="form-section">
        <h3>Warranty Information</h3>
        <p className="help-text">Add manufacturer or extended warranty information for this item</p>
        
        {warranties.map((warranty, index) => (
          <div key={index} className="warranty-form-item">
            <div className="warranty-header">
              <h4>{warranty.type === 'manufacturer' ? '🏭 Manufacturer Warranty' : '📋 Extended Warranty'}</h4>
              <button
                type="button"
                className="btn-outline btn-small btn-danger-outline"
                onClick={() => removeWarranty(index)}
                disabled={loading}
              >
                Remove
              </button>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>Provider / Company</label>
                <input
                  type="text"
                  value={warranty.provider || ""}
                  onChange={(e) => updateWarranty(index, 'provider', e.target.value || null)}
                  disabled={loading}
                  placeholder="Warranty provider name"
                />
              </div>
              <div className="form-group">
                <label>Policy Number</label>
                <input
                  type="text"
                  value={warranty.policy_number || ""}
                  onChange={(e) => updateWarranty(index, 'policy_number', e.target.value || null)}
                  disabled={loading}
                  placeholder="Policy or contract number"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Duration (months)</label>
                <input
                  type="number"
                  value={warranty.duration_months ?? ""}
                  onChange={(e) => updateWarranty(index, 'duration_months', e.target.value ? parseInt(e.target.value) : null)}
                  disabled={loading}
                  min="0"
                  placeholder="Duration in months"
                />
              </div>
              <div className="form-group">
                <label>Expiration Date</label>
                <input
                  type="date"
                  value={warranty.expiration_date || ""}
                  onChange={(e) => updateWarranty(index, 'expiration_date', e.target.value || null)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Notes</label>
              <textarea
                value={warranty.notes || ""}
                onChange={(e) => updateWarranty(index, 'notes', e.target.value || null)}
                disabled={loading}
                rows={2}
                placeholder="Additional warranty notes, phone numbers, contact info..."
              />
            </div>
          </div>
        ))}

        <div className="warranty-add-buttons">
          <button
            type="button"
            className="btn-outline"
            onClick={() => addWarranty('manufacturer')}
            disabled={loading}
          >
            + Add Manufacturer Warranty
          </button>
          <button
            type="button"
            className="btn-outline"
            onClick={() => addWarranty('extended')}
            disabled={loading}
          >
            + Add Extended Warranty
          </button>
        </div>
      </div>

      {/* Warranty Photos */}
      <div className="form-section">
        <h3>Warranty Photos</h3>
        <div className="photo-type-upload">
          <label htmlFor="photo-warranty">Warranty Documents</label>
          <input
            type="file"
            id="photo-warranty"
            accept="image/*"
            capture="environment"
            onChange={(e) => handlePhotoChange(e, PHOTO_TYPES.WARRANTY)}
            disabled={loading}
            multiple
          />
          <span className="help-text">Take photos or browse from device</span>
        </div>
        
        {/* Show warranty photo previews */}
        {photos.filter(p => p.type === PHOTO_TYPES.WARRANTY).length > 0 && (
          <div className="photo-previews">
            <h4>Warranty Photos ({photos.filter(p => p.type === PHOTO_TYPES.WARRANTY).length})</h4>
            <div className="photo-preview-grid">
              {photos.map((photo, index) => 
                photo.type === PHOTO_TYPES.WARRANTY && (
                  <div key={index} className="photo-preview-item">
                    <img src={photo.preview} alt={`Warranty ${index + 1}`} />
                    <div className="photo-preview-info">
                      <span className="photo-type-badge">{formatPhotoType(photo.type)}</span>
                      <button
                        type="button"
                        className="remove-photo-btn"
                        onClick={() => removePhoto(index)}
                        disabled={loading}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Render content for Tab 3: Media (All Photos)
  const renderMediaTab = () => {
    // Helper function to get filename from path
    const getFilenameFromPath = (path: string): string => {
      return path.split('/').pop() || path;
    };

    // Helper function to get photo type label for display
    const getPhotoTypeLabel = (photo: Photo): string => {
      if (photo.is_primary) return 'Primary';
      if (photo.is_data_tag) return 'Data Tag';
      return formatPhotoType(photo.photo_type || 'optional');
    };

    const handlePhotoTypeChange = (index: number, newType: string) => {
      setPhotos(prev => {
        const updated = [...prev];
        updated[index].type = newType;
        return updated;
      });
    };
    
    return (
      <div className="tab-content">
        {/* Existing Photos Section - Only show when editing and there are existing photos */}
        {isEditing && existingPhotos.length > 0 && (
          <div className="form-section">
            <h3>Current Photos</h3>
            <p className="help-text">View and manage existing photos for this item</p>
            <div className="existing-photos-grid">
              {existingPhotos.map((photo) => (
                <div key={photo.id} className="existing-photo-item">
                  <img 
                    src={`${getApiBaseUrl()}${photo.path}`}
                    alt={getFilenameFromPath(photo.path)}
                    className="existing-photo-image"
                  />
                  <div className="existing-photo-info">
                    <span className="photo-type-badge">{getPhotoTypeLabel(photo)}</span>
                    <span className="photo-filename" title={getFilenameFromPath(photo.path)}>
                      {getFilenameFromPath(photo.path)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="form-section">
          <h3>{isEditing ? 'Add New Photos' : 'Photos'}</h3>
          
          {/* Generic Photo Upload Section */}
          <div className="photo-upload-section" style={{ 
            background: 'var(--bg-elevated-softer)', 
            padding: '1rem', 
            borderRadius: '8px', 
            border: '1px solid var(--border-panel)' 
          }}>
            <p className="help-text" style={{margin: '0 0 0.75rem 0'}}>Add photos to your item. You can classify each photo after uploading.</p>
            <input
              type="file"
              ref={photoUploadRef}
              accept="image/*"
              multiple
              onChange={(e) => handlePhotoChange(e, PHOTO_TYPES.OPTIONAL)}
              style={{ display: 'none' }}
            />
             <input
              type="file"
              ref={cameraUploadRef}
              accept="image/*"
              capture="environment"
              onChange={(e) => handlePhotoChange(e, PHOTO_TYPES.OPTIONAL)}
              style={{ display: 'none' }}
            />
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="button" className="btn-outline" onClick={() => cameraUploadRef.current?.click()}>
                📷 Take Photo
              </button>
              <button type="button" className="btn-outline" onClick={() => photoUploadRef.current?.click()}>
                📁 Upload File(s)
              </button>
            </div>
          </div>

          {photos.length > 0 && (
            <div className="photo-previews" style={{marginTop: '1.5rem'}}>
              <h4>New Photos to Upload ({photos.length})</h4>
              <div className="photo-preview-grid">
                {photos.map((photo, index) => (
                  <div key={index} className="photo-preview-item" style={{height: 'auto', display: 'flex', flexDirection: 'column'}}>
                    <img src={photo.preview} alt={`Preview ${index + 1}`} style={{ flexShrink: 0 }} />
                    <div className="photo-preview-info" style={{ position: 'static', padding: '0.5rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%'}}>
                         <span className="photo-type-badge">{formatPhotoType(photo.type)}</span>
                         <button
                          type="button"
                          className="remove-photo-btn"
                          onClick={() => removePhoto(index)}
                          disabled={loading}
                        >
                          ✕
                        </button>
                      </div>
                      <select 
                        value={photo.type} 
                        onChange={(e) => handlePhotoTypeChange(index, e.target.value)}
                        style={{width: '100%', padding: '0.25rem', fontSize: '0.75rem'}}
                      >
                        <option value={PHOTO_TYPES.OPTIONAL}>Optional</option>
                        <option value={PHOTO_TYPES.DEFAULT}>Primary</option>
                        <option value={PHOTO_TYPES.DATA_TAG}>Data Tag</option>
                        <option value={PHOTO_TYPES.RECEIPT}>Receipt</option>
                        <option value={PHOTO_TYPES.WARRANTY}>Warranty</option>
                        {livingMode && <option value={PHOTO_TYPES.PROFILE}>Profile</option>}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render content for Additional Information Tab (formerly Manuals)
  const renderAdditionalInfoTab = () => {
    // Helper function to format file size
    const formatFileSize = (bytes: number): string => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    // Helper function to get document type label
    const getDocumentTypeLabel = (docType: string | null | undefined): string => {
      if (docType === DOCUMENT_TYPES.MANUAL) return 'Manual';
      if (docType === DOCUMENT_TYPES.ATTACHMENT) return 'Attachment';
      return 'Document';
    };

    // Filter existing documents by type
    const existingManuals = existingDocuments.filter(d => d.document_type === DOCUMENT_TYPES.MANUAL);
    const existingAttachments = existingDocuments.filter(d => d.document_type !== DOCUMENT_TYPES.MANUAL);

    return (
      <div className="tab-content">
        {/* Dynamic Fields Section */}
        <div className="form-section" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
          <h3>Additional Details</h3>
          <p className="help-text">Add custom fields from defined templates.</p>
          
          <div className="dynamic-fields-container" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
            {formData.additional_info?.map((field, index) => (
              <div key={index} className="dynamic-field-row" style={{ 
                display: 'flex', 
                gap: '0.5rem', 
                alignItems: 'flex-start',
                padding: '0.75rem',
                backgroundColor: 'var(--bg-elevated-softer)',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-subtle)'
              }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      placeholder="Label"
                      value={field.label}
                      readOnly
                      disabled={true}
                      style={{ 
                        flex: 1, 
                        fontSize: '0.85rem', 
                        padding: '0.4rem', 
                        backgroundColor: '#f0f0f0', 
                        cursor: 'not-allowed',
                        color: 'var(--text-secondary)'
                      }}
                    />
                    <select
                      value={field.type}
                      disabled={true}
                      style={{ 
                        width: '120px', 
                        fontSize: '0.85rem', 
                        padding: '0.4rem', 
                        backgroundColor: '#f0f0f0', 
                        cursor: 'not-allowed',
                        color: 'var(--text-secondary)'
                      }}
                    >
                      <option value="text">Text</option>
                      <option value="multiline">MultiLine</option>
                      <option value="url">URL</option>
                      <option value="date">Date</option>
                      <option value="time">Time</option>
                      <option value="number">Number</option>
                      <option value="boolean">Boolean</option>
                    </select>
                  </div>
                  
                  {field.type === 'multiline' ? (
                    <textarea
                      placeholder="Value"
                      value={field.value}
                      onChange={(e) => handleDynamicFieldChange(index, 'value', e.target.value)}
                      disabled={loading}
                      rows={3}
                      style={{ width: '100%', fontSize: '0.9rem', padding: '0.4rem', fontFamily: 'inherit' }}
                    />
                  ) : field.type === 'boolean' ? (
                    <select
                      value={field.value}
                      onChange={(e) => handleDynamicFieldChange(index, 'value', e.target.value)}
                      disabled={loading}
                      style={{ width: '100%', fontSize: '0.9rem', padding: '0.4rem' }}
                    >
                      <option value="">-- Select --</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  ) : (
                    <input
                      type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'time' ? 'time' : 'text'}
                      placeholder="Value"
                      value={field.value}
                      onChange={(e) => handleDynamicFieldChange(index, 'value', e.target.value)}
                      disabled={loading}
                      style={{ width: '100%', fontSize: '0.9rem', padding: '0.4rem' }}
                    />
                  )}
                </div>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => removeDynamicField(index)}
                  disabled={loading}
                  style={{ padding: '0.4rem 0.6rem', marginTop: '0.2rem' }}
                  title="Remove field"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem', position: 'relative' }}>
            {presetFields.length > 0 ? (
              <div ref={presetMenuRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => setShowPresetMenu(!showPresetMenu)}
                  disabled={loading}
                  title="Add field from defined templates"
                >
                  + Add Field
                </button>
                {showPresetMenu && (
                  <div className="preset-menu" style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    zIndex: 100,
                    minWidth: '200px',
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-panel)',
                    borderRadius: '0.5rem',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                    marginTop: '0.25rem',
                    maxHeight: '300px',
                    overflowY: 'auto'
                  }}>
                    {presetFields.map((preset, i) => (
                      <button
                        key={i}
                        type="button"
                        className="preset-option"
                        onClick={() => addPresetField(preset)}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          padding: '0.5rem 0.75rem',
                          background: 'none',
                          border: 'none',
                          borderBottom: '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                          color: 'var(--text-primary)',
                          fontSize: '0.9rem'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-elevated-softer)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        {preset.label} <span style={{ opacity: 0.6, fontSize: '0.8rem' }}>({preset.type})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ 
                fontSize: '0.85rem', 
                color: 'var(--text-secondary)',
                padding: '0.5rem',
                backgroundColor: 'var(--bg-elevated-softer)',
                borderRadius: '4px'
              }}>
                No custom field templates defined. Please configure them in the Admin Panel &gt; Custom Fields.
              </div>
            )}
          </div>
        </div>

        {/* Existing Documents Section - Only show when editing and there are existing documents */}
        {isEditing && existingDocuments.length > 0 && (
          <div className="form-section">
            <h3>Current Documents</h3>
            <p className="help-text">View existing manuals and attachments for this item</p>
            
            {existingManuals.length > 0 && (
              <div className="documents-subsection">
                <h4>📖 Manuals ({existingManuals.length})</h4>
                <div className="documents-list">
                  {existingManuals.map((doc) => (
                    <div key={doc.id} className="document-item">
                      <a 
                        href={`${getApiBaseUrl()}${doc.path}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="document-link"
                      >
                        {doc.mime_type === 'application/pdf' ? '📄' : '📝'} {doc.filename}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {existingAttachments.length > 0 && (
              <div className="documents-subsection">
                <h4>📎 Attachments ({existingAttachments.length})</h4>
                <div className="documents-list">
                  {existingAttachments.map((doc) => (
                    <div key={doc.id} className="document-item">
                      <a 
                        href={`${getApiBaseUrl()}${doc.path}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="document-link"
                      >
                        {doc.mime_type === 'application/pdf' ? '📄' : '📝'} {doc.filename}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="form-section">
          <h3>{isEditing && existingDocuments.length > 0 ? 'Add New Documents' : 'Documents'}</h3>
          
          <div className="document-upload-section">
            <div className="document-type-upload">
              <label htmlFor="doc-manual">User Guides & Service Manuals</label>
              <input
                type="file"
                id="doc-manual"
                accept=".pdf,.txt,application/pdf,text/plain"
                onChange={(e) => handleDocumentChange(e, DOCUMENT_TYPES.MANUAL)}
                disabled={loading}
                multiple
              />
              <span className="help-text">Upload PDF or TXT files (user guides, service manuals, instructions)</span>
              
              <div className="document-url-input">
                <label htmlFor="doc-manual-url">Or add from URL:</label>
                <div className="url-input-group">
                  <input
                    type="text"
                    id="doc-manual-url"
                    placeholder="https://example.com/manual.pdf"
                    value={documentUrlManual}
                    onChange={(e) => setDocumentUrlManual(e.target.value)}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => handleDocumentUrlAdd(DOCUMENT_TYPES.MANUAL)}
                    disabled={loading || !documentUrlManual.trim()}
                    className="add-url-btn"
                  >
                    Add URL
                  </button>
                </div>
              </div>
            </div>

            <div className="document-type-upload">
              <label htmlFor="doc-attachment">Other Attachments</label>
              <input
                type="file"
                id="doc-attachment"
                accept=".pdf,.txt,application/pdf,text/plain"
                onChange={(e) => handleDocumentChange(e, DOCUMENT_TYPES.ATTACHMENT)}
                disabled={loading}
                multiple
              />
              <span className="help-text">Upload other PDF or TXT documents</span>
              
              <div className="document-url-input">
                <label htmlFor="doc-attachment-url">Or add from URL:</label>
                <div className="url-input-group">
                  <input
                    type="text"
                    id="doc-attachment-url"
                    placeholder="https://example.com/document.pdf"
                    value={documentUrlAttachment}
                    onChange={(e) => setDocumentUrlAttachment(e.target.value)}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => handleDocumentUrlAdd(DOCUMENT_TYPES.ATTACHMENT)}
                    disabled={loading || !documentUrlAttachment.trim()}
                    className="add-url-btn"
                  >
                    Add URL
                  </button>
                </div>
              </div>
            </div>
          </div>

          {documents.length > 0 && (
            <div className="document-previews">
              <h4>New Documents to Upload ({documents.length})</h4>
              <div className="document-preview-list">
                {documents.map((doc, index) => {
                  // Extract filename safely using utility function
                  const displayName = doc.file ? doc.file.name : (doc.url ? getFilenameFromUrl(doc.url) : 'Unknown');
                  
                  return (
                    <div key={index} className="document-preview-item">
                      <div className="document-preview-info">
                        <span className="document-icon">
                          {doc.file ? (doc.file.type === 'application/pdf' ? '📄' : '📝') : '🔗'}
                        </span>
                        <span className="document-name">{displayName}</span>
                        {doc.file && <span className="document-size">{formatFileSize(doc.file.size)}</span>}
                        {doc.url && <span className="document-source">From URL</span>}
                        <span className="document-type-badge">{getDocumentTypeLabel(doc.type)}</span>
                      </div>
                      <button
                        type="button"
                        className="remove-document-btn"
                        onClick={() => removeDocument(index)}
                        disabled={loading}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content modal-content-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header modal-header-with-photo">
          <div className="modal-header-left">
            {isEditing && primaryPhoto && (
              <img 
                src={`${getApiBaseUrl()}${primaryPhoto.path}`}
                alt={initialData?.name || "Item"}
                className="modal-header-photo"
              />
            )}
            <h2>{isEditing ? (initialData?.name || "Edit Item") : livingMode ? "Add Living Item" : "Add New Item"}</h2>
          </div>
          <button className="modal-close" onClick={onCancel}>
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="item-form item-form-tabbed">
          {error && <div className="error-banner">{error}</div>}
          
          {/* Tab Navigation - Only show for non-living items */}
          {!livingMode && (
            <div className="tab-navigation">
              <button
                type="button"
                className={`tab-button ${activeTab === 'basic' ? 'active' : ''}`}
                onClick={() => setActiveTab('basic')}
              >
                📋 Basic Info
              </button>
              <button
                type="button"
                className={`tab-button ${activeTab === 'tags' ? 'active' : ''}`}
                onClick={() => setActiveTab('tags')}
              >
                🏷️ Tags
              </button>
              <button
                type="button"
                className={`tab-button ${activeTab === 'warranty' ? 'active' : ''}`}
                onClick={() => setActiveTab('warranty')}
              >
                🛡️ Warranty
              </button>
              <button
                type="button"
                className={`tab-button ${activeTab === 'media' ? 'active' : ''}`}
                onClick={() => setActiveTab('media')}
              >
                📷 Media
              </button>
              <button
                type="button"
                className={`tab-button ${activeTab === 'additional_info' ? 'active' : ''}`}
                onClick={() => setActiveTab('additional_info')}
              >
                ℹ️ Additional Info
              </button>
            </div>
          )}

          {/* Tab Content */}
          <div className="tab-panels">
            {livingMode ? (
              // For living items, show all content without tabs (including tags)
              <>
                {renderBasicInfoTab()}
                {/* Tags section for living items */}
                <div className="form-section">
                  <h3>Tags</h3>
                  <p className="help-text">Select "Living" tag for people, pets, plants, or other living things</p>
                  <div className="tags-selection">
                    {availableTags.map((tag) => (
                      <label key={tag.id} className="tag-checkbox">
                        <input
                          type="checkbox"
                          checked={(formData.tag_ids || []).includes(tag.id)}
                          onChange={() => handleTagToggle(tag.id)}
                          disabled={loading}
                        />
                        <span className={tag.is_predefined ? "tag-predefined" : "tag-custom"}>
                          {tag.name}
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className="new-tag-input">
                    <input
                      type="text"
                      placeholder="Create new tag..."
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleCreateTag())}
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={handleCreateTag}
                      disabled={loading || !newTagName.trim()}
                      className="btn-outline"
                    >
                      Add Tag
                    </button>
                  </div>
                </div>
                <div className="form-section">
                  <h3>Photos</h3>
                  <div className="photo-upload-section">
                    <div className="photo-type-upload">
                      <label htmlFor="photo-profile-living">Profile Picture</label>
                      <input
                        type="file"
                        id="photo-profile-living"
                        accept="image/*"
                        capture="user"
                        onChange={(e) => handlePhotoChange(e, PHOTO_TYPES.PROFILE)}
                        disabled={loading}
                      />
                      <span className="help-text">Take photo or browse from device</span>
                    </div>

                    <div className="photo-type-upload">
                      <label htmlFor="photo-optional-living">Additional Photos</label>
                      <input
                        type="file"
                        id="photo-optional-living"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => handlePhotoChange(e, PHOTO_TYPES.OPTIONAL)}
                        disabled={loading}
                        multiple
                      />
                      <span className="help-text">Take photos or browse from device</span>
                    </div>
                  </div>

                  {photos.length > 0 && (
                    <div className="photo-previews">
                      <h4>Selected Photos ({photos.length})</h4>
                      <div className="photo-preview-grid">
                        {photos.map((photo, index) => (
                          <div key={index} className="photo-preview-item">
                            <img src={photo.preview} alt={`Preview ${index + 1}`} />
                            <div className="photo-preview-info">
                              <span className="photo-type-badge">{formatPhotoType(photo.type)}</span>
                              <button
                                type="button"
                                className="remove-photo-btn"
                                onClick={() => removePhoto(index)}
                                disabled={loading}
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              // For non-living items, use tabbed interface
              <>
                {activeTab === 'basic' && renderBasicInfoTab()}
                {activeTab === 'tags' && renderTagsTab()}
                {activeTab === 'warranty' && renderWarrantyTab()}
                {activeTab === 'media' && renderMediaTab()}
                {activeTab === 'additional_info' && renderAdditionalInfoTab()}
              </>
            )}
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn-outline"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Saving..." : isEditing ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ItemForm;
