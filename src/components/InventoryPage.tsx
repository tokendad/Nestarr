import React, { useState, useMemo, useCallback, useEffect } from "react";
import type { Item, Location, Tag, Video, LocationPhoto } from "../lib/api";
import { getLocationPath } from "../lib/utils";
import { 
  updateLocation, 
  createLocation, 
  deleteLocation,
  uploadLocationPhoto,
  deleteLocationPhoto,
  uploadLocationVideo,
  deleteLocationVideo,
  fetchLocations,
  getLocationCategories
} from "../lib/api";
import QRLabelPrint, { PRINT_MODE_OPTIONS, type PrintMode } from "./QRLabelPrint";
import InsuranceTab from "./InsuranceTab";
import LivingTab from "./LivingTab";

interface InventoryPageProps {
  items: Item[];
  locations: Location[];
  loading: boolean;
  itemsLoading: boolean;
  locationsLoading: boolean;
  onRefresh: () => void;
  onRefreshLocations: () => void;
  onItemClick: (item: Item) => void;
  onAddItem?: () => void;
  onImportEncircle?: () => void;
  onImportCSV?: () => void;
  onAIScan?: () => void;
  onBulkDelete?: (itemIds: string[]) => Promise<void>;
  onBulkUpdateTags?: (itemIds: string[], tagIds: string[], mode: "replace" | "add" | "remove") => Promise<void>;
  onBulkUpdateLocation?: (itemIds: string[], locationId: string | null) => Promise<void>;
  tags?: Tag[];
  isMobile?: boolean;
  initialLocationId?: string;
}

// Column configuration type
interface ColumnConfig {
  key: string;
  label: string;
  enabled: boolean;
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { key: "name", label: "Name", enabled: true },
  { key: "brand", label: "Brand", enabled: true },
  { key: "model_number", label: "Model", enabled: false },
  { key: "serial_number", label: "Serial", enabled: false },
  { key: "location", label: "Location", enabled: true },
  { key: "purchase_price", label: "Purchase Price", enabled: false },
  { key: "estimated_value", label: "Estimated Value", enabled: false },
  { key: "tags", label: "Tags", enabled: false },
];

const LOCATION_TYPES = [
  { value: "residential", label: "Residential" },
  { value: "commercial", label: "Commercial" },
  { value: "retail", label: "Retail" },
  { value: "industrial", label: "Industrial" },
  { value: "apartment_complex", label: "Apartment Complex" },
  { value: "condo", label: "Condo" },
  { value: "multi_family", label: "Multi-Family" },
  { value: "other", label: "Other" },
];

const SHOW_ALL_ITEMS = -1; // Special value to indicate showing all items
const MENU_BLUR_DELAY = 200; // Delay in ms before closing dropdown menu on blur

const InventoryPage: React.FC<InventoryPageProps> = ({
  items,
  locations,
  loading,
  itemsLoading,
  locationsLoading,
  onRefresh,
  onRefreshLocations,
  onItemClick,
  onAddItem,
  onImportEncircle,
  onImportCSV,
  onAIScan,
  onBulkDelete,
  onBulkUpdateTags,
  onBulkUpdateLocation,
  tags = [],
  isMobile = false,
  initialLocationId,
}) => {
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [itemLimit, setItemLimit] = useState<number>(10);
  const [locationCategories, setLocationCategories] = useState<string[]>([
    "Primary",
    "Out-building",
    "Room",
    "Floor",
    "Exterior",
    "Garage",
    "Shed",
    "Container"
  ]);

  useEffect(() => {
    async function loadCategories() {
      try {
        const categories = await getLocationCategories();
        if (categories && categories.length > 0) {
          setLocationCategories(categories);
        }
      } catch (error) {
        console.error("Failed to load location categories:", error);
      }
    }
    loadCategories();
  }, []);

  // Deep-link: open a location's settings panel when initialLocationId is provided
  useEffect(() => {
    if (!initialLocationId || locationsLoading || !locations.length) return;
    const target = locations.find((l) => l.id.toString() === initialLocationId);
    if (target) {
      setShowLocationSettings(target);
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search
      );
    }
  }, [initialLocationId, locations, locationsLoading]);

  const [showImportMenu, setShowImportMenu] = useState(false);
  const [columns, setColumns] = useState<ColumnConfig[]>(
    () => {
      const saved = localStorage.getItem("NesVentory_itemColumns");
      return saved ? JSON.parse(saved) : DEFAULT_COLUMNS;
    }
  );
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [showLocationSettings, setShowLocationSettings] = useState<Location | "create" | null>(null);
  const [editFormData, setEditFormData] = useState<any>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<"delete" | "updateTags" | "updateLocation" | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [tagUpdateMode, setTagUpdateMode] = useState<"replace" | "add" | "remove">("add");
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  // Track the location navigation path for breadcrumb navigation
  const [locationPath, setLocationPath] = useState<Location[]>([]);
  const [showDeleteLocationConfirm, setShowDeleteLocationConfirm] = useState(false);
  // QR Label printing
  const [showQRPrint, setShowQRPrint] = useState<Location | null>(null);
  const [printModeFromEdit, setPrintModeFromEdit] = useState<PrintMode>("qr_with_items");
  // Location Settings tabs
  const [locationSettingsTab, setLocationSettingsTab] = useState<"details" | "media" | "insurance" | "living">("details");
  // Media upload/display state
  const [locationPhotos, setLocationPhotos] = useState<LocationPhoto[]>([]);
  const [locationVideos, setLocationVideos] = useState<Video[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // Helper to check if showLocationSettings is a Location (not "create")
  const isEditingLocation = (loc: Location | "create" | null): loc is Location => {
    return loc !== null && loc !== "create";
  };

  // Get all descendant IDs of a location (for circular reference prevention)
  const getDescendantIds = useCallback((locationId: string | number): Set<string> => {
    const descendants = new Set<string>();
    const findDescendants = (parentId: string) => {
      locations.forEach(loc => {
        if (loc.parent_id?.toString() === parentId) {
          const locIdStr = loc.id.toString();
          descendants.add(locIdStr);
          findDescendants(locIdStr);
        }
      });
    };
    findDescendants(locationId.toString());
    return descendants;
  }, [locations]);

  // Build hierarchical location list for parent dropdown
  // Shows all locations with indentation, excluding self and descendants (circular ref prevention)
  const getParentOptions = useMemo(() => {
    const options: { id: string; label: string; depth: number }[] = [];

    // Build tree structure for proper ordering
    const buildOptions = (parentId: string | null, depth: number) => {
      const children = locations.filter(loc =>
        parentId === null
          ? (loc.is_primary_location || !loc.parent_id)
          : loc.parent_id?.toString() === parentId
      );

      // Sort by name for consistent ordering
      children.sort((a, b) => (a.friendly_name || a.name).localeCompare(b.friendly_name || b.name));

      children.forEach(loc => {
        options.push({
          id: loc.id.toString(),
          label: loc.friendly_name || loc.name,
          depth
        });
        buildOptions(loc.id.toString(), depth + 1);
      });
    };

    buildOptions(null, 0);
    return options;
  }, [locations]);

  // Filter parent options to exclude self and descendants (when editing)
  const availableParentOptions = useMemo(() => {
    if (showLocationSettings === "create") {
      return getParentOptions;
    }
    if (!isEditingLocation(showLocationSettings)) {
      return getParentOptions;
    }
    const editingId = showLocationSettings.id.toString();
    const descendantIds = getDescendantIds(showLocationSettings.id);
    return getParentOptions.filter(opt =>
      opt.id !== editingId && !descendantIds.has(opt.id)
    );
  }, [getParentOptions, showLocationSettings, getDescendantIds]);

  // Get the location being edited in settings modal (if any)
  const editingLocation = isEditingLocation(showLocationSettings) ? showLocationSettings : null;

  // Get child locations for a given parent ID
  const getChildLocations = useCallback((parentId: string | number | null): Location[] => {
    if (parentId === null) {
      // Return top-level locations (those without a parent)
      return locations.filter(loc => !loc.parent_id);
    }
    return locations.filter(loc => loc.parent_id?.toString() === parentId.toString());
  }, [locations]);

  // Get the current location (last in path)
  const currentLocation = locationPath.length > 0 ? locationPath[locationPath.length - 1] : null;

  // Get locations to display in the current panel
  const currentPanelLocations = useMemo(() => {
    if (currentLocation === null) {
      return getChildLocations(null);
    }
    return getChildLocations(currentLocation.id);
  }, [getChildLocations, currentLocation]);

  // Get items for location
  const getItemsAtLocation = useCallback((locationId: string | number | null): Item[] => {
    if (locationId === null) {
      return items;
    }
    // Get all descendant location IDs
    const getDescendantIds = (locId: string | number): Set<string | number> => {
      const ids = new Set<string | number>([locId]);
      const children = locations.filter(loc => loc.parent_id?.toString() === locId.toString());
      children.forEach(child => {
        const childIds = getDescendantIds(child.id);
        childIds.forEach(id => ids.add(id));
      });
      return ids;
    };
    const targetIds = getDescendantIds(locationId);
    return items.filter(item => item.location_id && targetIds.has(item.location_id));
  }, [items, locations]);

  // Filter items based on selected location and limit
  const filteredItems = useMemo(() => {
    const locationItems = selectedLocation 
      ? getItemsAtLocation(selectedLocation.id)
      : items;
    
    // Sort by newest first (created_at descending)
    const sorted = locationItems.slice().sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });

    // Return all items if limit is set to show all, otherwise slice to limit
    return itemLimit === SHOW_ALL_ITEMS ? sorted : sorted.slice(0, itemLimit);
  }, [items, selectedLocation, getItemsAtLocation, itemLimit]);

  // Toggle column visibility
  const toggleColumn = (key: string) => {
    const newColumns = columns.map(col => 
      col.key === key ? { ...col, enabled: !col.enabled } : col
    );
    setColumns(newColumns);
    localStorage.setItem("NesVentory_itemColumns", JSON.stringify(newColumns));
  };

  // Get enabled columns
  const enabledColumns = columns.filter(col => col.enabled);

  // Handler to navigate to a location
  const handleLocationClick = (location: Location) => {
    // Prevent adding duplicate if already current location
    if (currentLocation?.id?.toString() === location.id.toString()) {
      return;
    }
    setLocationPath([...locationPath, location]);
    setSelectedLocation(location);
  };

  // Handler to navigate back to a specific level in the breadcrumb
  const handleBreadcrumbClick = (index: number) => {
    if (index < 0) {
      setLocationPath([]);
      setSelectedLocation(null);
    } else {
      const newPath = locationPath.slice(0, index + 1);
      setLocationPath(newPath);
      setSelectedLocation(newPath[newPath.length - 1]);
    }
  };

  // Bulk operation handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItemIds(new Set(filteredItems.map(item => item.id.toString())));
    } else {
      setSelectedItemIds(new Set());
    }
  };

  const handleSelectItem = (itemId: string, checked: boolean) => {
    const newSelected = new Set(selectedItemIds);
    if (checked) {
      newSelected.add(itemId);
    } else {
      newSelected.delete(itemId);
    }
    setSelectedItemIds(newSelected);
  };

  const visibleSelectedIds = useMemo(() => {
    const filteredIds = new Set(filteredItems.map(item => item.id.toString()));
    return new Set(Array.from(selectedItemIds).filter(id => filteredIds.has(id)));
  }, [filteredItems, selectedItemIds]);

  const isAllSelected = filteredItems.length > 0 && filteredItems.every(item => selectedItemIds.has(item.id.toString()));
  const isSomeSelected = visibleSelectedIds.size > 0;

  const handleBulkActionConfirm = async () => {
    if (!bulkAction || visibleSelectedIds.size === 0) return;
    
    setBulkActionLoading(true);
    try {
      const itemIds = Array.from(visibleSelectedIds);
      
      if (bulkAction === "delete" && onBulkDelete) {
        await onBulkDelete(itemIds);
      } else if (bulkAction === "updateTags" && onBulkUpdateTags) {
        await onBulkUpdateTags(itemIds, Array.from(selectedTagIds), tagUpdateMode);
      } else if (bulkAction === "updateLocation" && onBulkUpdateLocation) {
        await onBulkUpdateLocation(itemIds, selectedLocationId);
      }
      
      setSelectedItemIds(new Set());
      setBulkAction(null);
      setSelectedTagIds(new Set());
      setSelectedLocationId(null);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleCancelBulkAction = () => {
    setBulkAction(null);
    setSelectedTagIds(new Set());
    setSelectedLocationId(null);
  };

  const handleTagToggle = (tagId: string) => {
    const newSelected = new Set(selectedTagIds);
    if (newSelected.has(tagId)) {
      newSelected.delete(tagId);
    } else {
      newSelected.add(tagId);
    }
    setSelectedTagIds(newSelected);
  };

  // Location card component for browse locations section
  const LocationCard: React.FC<{ loc: Location }> = ({ loc }) => {
    const itemCount = getItemsAtLocation(loc.id).length;
    const childCount = getChildLocations(loc.id).length;

    return (
      <div
        className="location-bubble"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.5rem 1rem",
          margin: "0.25rem",
          borderRadius: "2rem",
          background: "rgba(78, 205, 196, 0.2)",
          border: "1px solid rgba(78, 205, 196, 0.5)",
          cursor: "pointer",
          fontSize: "0.875rem",
        }}
        onClick={() => handleLocationClick(loc)}
      >
        <span>{loc.friendly_name || loc.name}</span>
        {loc.is_primary_location && (
          <span style={{
            fontSize: "0.625rem",
            backgroundColor: "#4ecdc4",
            color: "#fff",
            padding: "0.125rem 0.25rem",
            borderRadius: "3px",
          }}>
            HOME
          </span>
        )}
        {childCount > 0 && (
          <span 
            style={{ 
              fontSize: "0.75rem", 
              opacity: 0.8,
              backgroundColor: "rgba(0,0,0,0.2)",
              padding: "0.125rem 0.375rem",
              borderRadius: "1rem"
            }}
            role="img"
            aria-label={`${childCount} sub-location${childCount !== 1 ? 's' : ''}`}
          >
            📁 {childCount}
          </span>
        )}
        {itemCount > 0 && (
          <span 
            style={{ 
              fontSize: "0.75rem", 
              opacity: 0.8,
              backgroundColor: "rgba(0,0,0,0.2)",
              padding: "0.125rem 0.375rem",
              borderRadius: "1rem"
            }}
            role="img"
            aria-label={`${itemCount} item${itemCount !== 1 ? 's' : ''}`}
          >
            📦 {itemCount}
          </span>
        )}
        <button
          className="btn-icon-small"
          onClick={(e) => {
            e.stopPropagation();
            setShowQRPrint(loc);
          }}
          title="Print Label"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "0.25rem",
            display: "flex",
            alignItems: "center",
            fontSize: "1rem",
          }}
        >
          🖨️
        </button>
        <button
          className="btn-icon-small"
          onClick={(e) => {
            e.stopPropagation();
            setShowLocationSettings(loc);
            setLocationSettingsTab("details"); // Reset to details tab
            setEditFormData({
              name: loc.name,
              friendly_name: loc.friendly_name || "",
              location_type: loc.location_type || "",
              parent_id: loc.parent_id?.toString() || "",
              is_primary_location: loc.is_primary_location || false,
              is_container: loc.is_container || false,
              location_category: loc.location_category || (loc.is_primary_location ? "Primary" : loc.is_container ? "Container" : "Room"),
              description: loc.description || "",
              address: loc.address || "",
              estimated_property_value: loc.estimated_property_value?.toString() ?? "",
              estimated_value_with_items: loc.estimated_value_with_items?.toString() ?? "",
            });
            // Load media for the location
            setLocationPhotos(loc.location_photos || []);
            setLocationVideos(loc.videos || []);
          }}
          title="Location Settings"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "0.25rem",
            display: "flex",
            alignItems: "center",
            fontSize: "1rem",
          }}
        >
          ⚙️
        </button>
      </div>
    );
  };

  const handleLocationUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showLocationSettings) return;

    try {
      // Convert string values to proper types for API
      const propertyValue = editFormData.estimated_property_value === "" ? null : parseFloat(editFormData.estimated_property_value);
      const valueWithItems = editFormData.estimated_value_with_items === "" ? null : parseFloat(editFormData.estimated_value_with_items);
      
      const locationData = {
        name: editFormData.name,
        friendly_name: editFormData.friendly_name || null,
        location_type: editFormData.location_type === "" ? null : editFormData.location_type,
        parent_id: editFormData.parent_id === "" ? null : editFormData.parent_id,
        is_primary_location: editFormData.is_primary_location || false,
        is_container: editFormData.is_container || false,
        description: editFormData.description || null,
        address: editFormData.address || null,
        estimated_property_value: propertyValue !== null && !isNaN(propertyValue) ? propertyValue : null,
        estimated_value_with_items: valueWithItems !== null && !isNaN(valueWithItems) ? valueWithItems : null,
        // These fields are required by the API but not yet supported in the form UI
        owner_info: null,
        landlord_info: null,
        tenant_info: null,
        insurance_info: null,
      };
      
      if (showLocationSettings === "create") {
        await createLocation(locationData);
      } else {
        await updateLocation(showLocationSettings.id.toString(), locationData);
      }
      
      setShowLocationSettings(null);
      setEditFormData(null);
      onRefreshLocations();
    } catch (err: any) {
      alert(`Failed to ${showLocationSettings === "create" ? "create" : "update"} location: ${err.message}`);
    }
  };

  const handleLocationDelete = async () => {
    if (!showLocationSettings || showLocationSettings === "create") return;
    
    try {
      await deleteLocation(showLocationSettings.id.toString());
      setShowDeleteLocationConfirm(false);
      setShowLocationSettings(null);
      setEditFormData(null);
      onRefreshLocations();
    } catch (err: any) {
      alert(`Failed to delete location: ${err.message}`);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!showLocationSettings || showLocationSettings === "create") return;
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingMedia(true);
    try {
      const locationId = showLocationSettings.id.toString();
      for (const file of Array.from(files)) {
        const photo = await uploadLocationPhoto(locationId, file);
        setLocationPhotos(prev => [...prev, photo]);
      }
      // Refresh locations to get updated data
      onRefreshLocations();
    } catch (err: any) {
      alert(`Failed to upload photo: ${err.message}`);
    } finally {
      setUploadingMedia(false);
      // Reset the input so the same file can be selected again
      e.target.value = "";
    }
  };

  const handlePhotoDelete = async (photoId: string) => {
    if (!showLocationSettings || showLocationSettings === "create") return;
    if (!confirm("Are you sure you want to delete this photo?")) return;

    try {
      const locationId = showLocationSettings.id.toString();
      await deleteLocationPhoto(locationId, photoId);
      setLocationPhotos(prev => prev.filter(p => p.id !== photoId));
      onRefreshLocations();
    } catch (err: any) {
      alert(`Failed to delete photo: ${err.message}`);
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!showLocationSettings || showLocationSettings === "create") return;
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingMedia(true);
    try {
      const locationId = showLocationSettings.id.toString();
      for (const file of Array.from(files)) {
        const video = await uploadLocationVideo(locationId, file);
        setLocationVideos(prev => [...prev, video]);
      }
      // Refresh locations to get updated data
      onRefreshLocations();
    } catch (err: any) {
      alert(`Failed to upload video: ${err.message}`);
    } finally {
      setUploadingMedia(false);
      // Reset the input so the same file can be selected again
      e.target.value = "";
    }
  };

  const handleVideoDelete = async (videoId: string) => {
    if (!showLocationSettings || showLocationSettings === "create") return;
    if (!confirm("Are you sure you want to delete this video?")) return;

    try {
      const locationId = showLocationSettings.id.toString();
      await deleteLocationVideo(locationId, videoId);
      setLocationVideos(prev => prev.filter(v => v.id !== videoId));
      onRefreshLocations();
    } catch (err: any) {
      alert(`Failed to delete video: ${err.message}`);
    }
  };

  return (
    <>
      {/* Stats Section */}
      <div className="cards-grid">
        <div className="card">
          <div className="card-label">Total Items</div>
          <div className="card-value">{items.length}</div>
          <div className="card-footnote">All tracked possessions</div>
        </div>
        <div className="card">
          <div className="card-label">Locations</div>
          <div className="card-value">{locations.length}</div>
          <div className="card-footnote">Homes, rooms, shelves</div>
        </div>
        <div className="card">
          <div className="card-label">Status</div>
          <div className="card-value status-ok">Healthy</div>
          <div className="card-footnote">API reachable</div>
        </div>
      </div>

      {/* Locations Section */}
      <section className="panel" style={{ marginTop: "1rem" }}>
        <div className="panel-header">
          <h2>Browse Locations</h2>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              className="btn-outline"
              onClick={() => {
                setLocationPath([]);
                setSelectedLocation(null);
              }}
              disabled={locationPath.length === 0}
            >
              All Locations
            </button>
            <button
              className="btn-outline"
              onClick={onRefreshLocations}
              disabled={locationsLoading}
            >
              {locationsLoading ? "Refreshing..." : "Refresh"}
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                setShowLocationSettings("create");
                setLocationSettingsTab("details"); // Always start on details tab for new locations
                setEditFormData({
                  name: "",
                  friendly_name: "",
                  location_type: "",
                  parent_id: "",
                  is_primary_location: false,
                  is_container: false,
                  location_category: "Room", // Default
                  description: "",
                  address: "",
                  estimated_property_value: "",
                  estimated_value_with_items: "",
                });
                // Clear media for new location
                setLocationPhotos([]);
                setLocationVideos([]);
              }}
            >
              Add Location
            </button>
          </div>
        </div>
        {locationsLoading && <p className="muted">Loading locations...</p>}
        
        {/* Breadcrumb navigation */}
        {!locationsLoading && (
          <div style={{
            padding: "0.75rem 1rem",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "0.5rem",
            borderBottom: "1px solid var(--border-subtle)"
          }}>
            <button
              style={{
                background: locationPath.length === 0 ? "rgba(78, 205, 196, 0.2)" : "transparent",
                border: "none",
                color: "var(--text)",
                cursor: "pointer",
                padding: "0.25rem 0.5rem",
                borderRadius: "0.25rem",
                fontSize: "0.875rem",
              }}
              onClick={() => handleBreadcrumbClick(-1)}
            >
              All Locations
            </button>
            {locationPath.map((loc, index) => (
              <React.Fragment key={loc.id}>
                <span style={{ color: "var(--muted)" }}>›</span>
                <button
                  style={{
                    background: index === locationPath.length - 1 ? "rgba(78, 205, 196, 0.2)" : "transparent",
                    border: "none",
                    color: "var(--text)",
                    cursor: "pointer",
                    padding: "0.25rem 0.5rem",
                    borderRadius: "0.25rem",
                    fontSize: "0.875rem",
                  }}
                  onClick={() => handleBreadcrumbClick(index)}
                >
                  {loc.friendly_name || loc.name}
                </button>
              </React.Fragment>
            ))}
          </div>
        )}

        {!locationsLoading && currentPanelLocations.length === 0 && (
          <p className="muted" style={{ padding: "1rem" }}>
            {currentLocation 
              ? "No sub-locations in this location."
              : "No locations yet."}
          </p>
        )}
        {!locationsLoading && currentPanelLocations.length > 0 && (
          <div style={{ padding: "1rem", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {currentPanelLocations.map(loc => (
              <LocationCard key={loc.id} loc={loc} />
            ))}
          </div>
        )}
      </section>

      {/* Items Section */}
      <section className="panel" style={{ marginTop: "1rem" }}>
        <div className="panel-header panel-header-left">
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
            {isSomeSelected && (
              <>
                <button 
                  className="btn-danger" 
                  onClick={() => setBulkAction("delete")}
                  disabled={itemsLoading}
                >
                  Delete ({visibleSelectedIds.size})
                </button>
                <button 
                  className="btn-outline" 
                  onClick={() => setBulkAction("updateTags")}
                  disabled={itemsLoading}
                >
                  Update Tags ({visibleSelectedIds.size})
                </button>
                <button 
                  className="btn-outline" 
                  onClick={() => setBulkAction("updateLocation")}
                  disabled={itemsLoading}
                >
                  Update Location ({visibleSelectedIds.size})
                </button>
                <div style={{ width: "1px", height: "1.5rem", background: "var(--border-subtle)", margin: "0 0.25rem" }} />
              </>
            )}
            <label style={{ fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              Show:
              <select
                value={itemLimit}
                onChange={(e) => setItemLimit(Number(e.target.value))}
                style={{ padding: "0.25rem 0.5rem" }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={SHOW_ALL_ITEMS}>All</option>
              </select>
            </label>
            <button
              className="btn-outline"
              onClick={() => setShowColumnSelector(!showColumnSelector)}
            >
              Columns
            </button>
            <button
              className="btn-outline"
              onClick={onRefresh}
              disabled={itemsLoading}
            >
              {itemsLoading ? "Refreshing..." : "Refresh"}
            </button>
            {onAIScan && (
              <button className="btn-outline" onClick={onAIScan}>
                📷 AI Scan
              </button>
            )}
            {(onImportEncircle || onImportCSV) && (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <button 
                  className="btn-outline" 
                  onClick={() => setShowImportMenu(!showImportMenu)}
                  onBlur={() => setTimeout(() => setShowImportMenu(false), MENU_BLUR_DELAY)}
                >
                  📥 Import {showImportMenu ? '▲' : '▼'}
                </button>
                {showImportMenu && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '4px',
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                    zIndex: 1000,
                    minWidth: '180px',
                    overflow: 'hidden'
                  }}>
                    {onImportCSV && (
                      <button
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '10px 16px',
                          textAlign: 'left',
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          fontSize: '14px',
                          color: 'var(--text)',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-elevated-softer)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        onClick={() => {
                          setShowImportMenu(false);
                          onImportCSV();
                        }}
                      >
                        📄 Import from CSV
                      </button>
                    )}
                    {onImportEncircle && (
                      <button
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '10px 16px',
                          textAlign: 'left',
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          fontSize: '14px',
                          color: 'var(--text)',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-elevated-softer)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        onClick={() => {
                          setShowImportMenu(false);
                          onImportEncircle();
                        }}
                      >
                        📦 Import from Encircle
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            {onAddItem && (
              <button className="btn-primary" onClick={onAddItem}>
                Add Item
              </button>
            )}
          </div>
          <h2>
            Items
            {selectedLocation && ` in ${selectedLocation.friendly_name || selectedLocation.name}`}
          </h2>
        </div>

        {/* Column Selector */}
        {showColumnSelector && (
          <div style={{
            padding: "1rem",
            background: "rgba(78, 205, 196, 0.1)",
            borderRadius: "0.5rem",
            marginBottom: "1rem",
          }}>
            <h3 style={{ fontSize: "0.9rem", marginBottom: "0.75rem" }}>Select Columns to Display</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {columns.map(col => (
                <label key={col.key} style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                  <input
                    type="checkbox"
                    checked={col.enabled}
                    onChange={() => toggleColumn(col.key)}
                  />
                  <span>{col.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="table-wrapper">
          <table className="items-table">
            <thead>
              <tr>
                <th style={{ width: "2.5rem" }}>
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    disabled={filteredItems.length === 0}
                  />
                </th>
                {enabledColumns.map(col => (
                  <th key={col.key}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 && !itemsLoading && (
                <tr>
                  <td colSpan={enabledColumns.length + 1} className="empty-row">
                    {selectedLocation 
                      ? "No items in this location."
                      : "No items yet."}
                  </td>
                </tr>
              )}
              {filteredItems.map((item) => {
                const itemIdStr = item.id.toString();
                return (
                  <tr
                    key={item.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => onItemClick(item)}
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedItemIds.has(itemIdStr)}
                        onChange={(e) => handleSelectItem(itemIdStr, e.target.checked)}
                      />
                    </td>
                    {enabledColumns.map(col => {
                      if (col.key === "name") return <td key={col.key}>{item.name}</td>;
                      if (col.key === "brand") return <td key={col.key}>{item.brand || "—"}</td>;
                      if (col.key === "model_number") return <td key={col.key}>{item.model_number || "—"}</td>;
                      if (col.key === "serial_number") return <td key={col.key}>{item.serial_number || "—"}</td>;
                      if (col.key === "location") return <td key={col.key}>{getLocationPath(item.location_id, locations)}</td>;
                      if (col.key === "purchase_price") return (
                        <td key={col.key}>
                          {item.purchase_price != null ? `$${item.purchase_price.toLocaleString()}` : "—"}
                        </td>
                      );
                      if (col.key === "estimated_value") return (
                        <td key={col.key}>
                          {item.estimated_value != null ? `$${item.estimated_value.toLocaleString()}` : "—"}
                        </td>
                      );
                      if (col.key === "tags") return (
                        <td key={col.key}>
                          {item.tags && item.tags.length > 0 
                            ? item.tags.map(t => t.name).join(", ")
                            : "—"}
                        </td>
                      );
                      return <td key={col.key}>—</td>;
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Location Settings Modal */}
      {showLocationSettings && (
        <div className="modal-overlay" onClick={() => setShowLocationSettings(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{showLocationSettings === "create" ? "Add New Location" : "Location Settings"}</h2>
              <button className="modal-close" onClick={() => setShowLocationSettings(null)}>
                ✕
              </button>
            </div>

            {/* Tabs - only show for existing locations */}
            {showLocationSettings !== "create" && (
              <div className="item-details-tabs">
                <button
                  type="button"
                  className={`tab-button ${locationSettingsTab === "details" ? "active" : ""}`}
                  onClick={() => setLocationSettingsTab("details")}
                >
                  Details
                </button>
                <button
                  type="button"
                  className={`tab-button ${locationSettingsTab === "media" ? "active" : ""}`}
                  onClick={() => setLocationSettingsTab("media")}
                >
                  Media
                </button>
                {/* Insurance tab - only show for primary locations */}
                {editingLocation?.is_primary_location && (
                  <button
                    type="button"
                    className={`tab-button ${locationSettingsTab === "insurance" ? "active" : ""}`}
                    onClick={() => setLocationSettingsTab("insurance")}
                  >
                    🏠 Insurance
                  </button>
                )}
                {/* Living tab - only show for primary locations */}
                {(editingLocation?.location_category === "Primary" || editingLocation?.is_primary_location) && (
                  <button
                    type="button"
                    className={`tab-button ${locationSettingsTab === "living" ? "active" : ""}`}
                    onClick={() => setLocationSettingsTab("living")}
                  >
                    👥 Living
                  </button>
                )}
              </div>
            )}

            {/* Details Tab */}
            {locationSettingsTab === "details" && (
            <form onSubmit={handleLocationUpdate} className="item-form">
              <div className="form-group">
                <label htmlFor="name">Name *</label>
                <input
                  type="text"
                  id="name"
                  value={editFormData?.name || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  required
                  placeholder="e.g., Living Room, Main House, Unit 101"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="friendly_name">Friendly Name</label>
                  <input
                    type="text"
                    id="friendly_name"
                    value={editFormData?.friendly_name || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, friendly_name: e.target.value })}
                    placeholder="e.g., Our Home, Beach House"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="location_category">Category</label>
                  <select
                    id="location_category"
                    value={editFormData?.location_category || ""}
                    onChange={(e) => {
                      const category = e.target.value;
                      let isPrimary = false;
                      let isContainer = false;
                      
                      if (category === "Primary") isPrimary = true;
                      else if (category === "Container") isContainer = true;
                      
                      setEditFormData({ 
                        ...editFormData, 
                        location_category: category,
                        is_primary_location: isPrimary,
                        is_container: isContainer,
                        // Reset if not primary
                        location_type: isPrimary ? editFormData.location_type : "",
                        address: isPrimary ? editFormData.address : ""
                      });
                    }}
                  >
                    {locationCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Show Type and Address ONLY if Primary */}
              {editFormData?.location_category === "Primary" && (
                <>
                  <div className="form-group">
                    <label htmlFor="location_type">Location Type</label>
                    <select
                      id="location_type"
                      value={editFormData?.location_type || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, location_type: e.target.value })}
                    >
                      <option value="">-- Select Type --</option>
                      {LOCATION_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="address">Address</label>
                    <input
                      type="text"
                      id="address"
                      value={editFormData?.address || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                      placeholder="Full street address"
                    />
                  </div>
                </>
              )}

              <div className="form-group">
                <label htmlFor="parent_id">Parent Location</label>
                <select
                  id="parent_id"
                  value={editFormData?.parent_id || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, parent_id: e.target.value })}
                >
                  <option value="">-- No Parent (Top Level) --</option>
                  {availableParentOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {"—".repeat(opt.depth)}{opt.depth > 0 ? " " : ""}{opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Print Label Section - Show when editing */}
              {showLocationSettings !== "create" && (
                <div className="form-group" style={{ 
                  marginTop: "1rem", 
                  padding: "1rem", 
                  borderRadius: "0.5rem",
                  background: "rgba(78, 205, 196, 0.1)",
                  border: "1px solid rgba(78, 205, 196, 0.3)"
                }}>
                  <label style={{ fontWeight: 500, marginBottom: "0.5rem", display: "block" }}>
                    🖨️ Print Label
                  </label>
                  <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end" }}>
                    <div style={{ flex: 1 }}>
                      <select
                        id="printMode"
                        value={printModeFromEdit}
                        onChange={(e) => setPrintModeFromEdit(e.target.value as PrintMode)}
                        style={{ width: "100%" }}
                      >
                        {PRINT_MODE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={() => {
                        if (isEditingLocation(showLocationSettings)) {
                          setShowQRPrint(showLocationSettings);
                        }
                      }}
                      style={{ whiteSpace: "nowrap" }}
                    >
                      🖨️ Print
                    </button>
                  </div>
                  <span className="help-text" style={{ marginTop: "0.5rem", display: "block" }}>
                    Print a label for this container with your selected content
                  </span>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  value={editFormData?.description || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  rows={3}
                  placeholder="Description of the location"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="estimated_property_value">Estimated Property Value</label>
                  <input
                    type="number"
                    id="estimated_property_value"
                    value={editFormData?.estimated_property_value ?? ""}
                    onChange={(e) => setEditFormData({ 
                      ...editFormData, 
                      estimated_property_value: e.target.value 
                    })}
                    step="0.01"
                    min="0"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="estimated_value_with_items">Value with Items</label>
                  <input
                    type="number"
                    id="estimated_value_with_items"
                    value={editFormData?.estimated_value_with_items ?? ""}
                    onChange={(e) => setEditFormData({ 
                      ...editFormData, 
                      estimated_value_with_items: e.target.value 
                    })}
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>

              <div className="form-actions">
                {showLocationSettings !== "create" && (
                  <button
                    type="button"
                    className="btn-danger"
                    onClick={() => setShowDeleteLocationConfirm(true)}
                    style={{ marginRight: "auto" }}
                  >
                    Delete
                  </button>
                )}
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => setShowLocationSettings(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {showLocationSettings === "create" ? "Create" : "Save"}
                </button>
              </div>
            </form>
            )}

            {/* Media Tab */}
            {locationSettingsTab === "media" && showLocationSettings !== "create" && (
              <div className="item-form" style={{ padding: "1.5rem" }}>
                <div style={{ marginBottom: "2rem" }}>
                  <h3 style={{ marginBottom: "1rem", fontSize: "1.1rem", fontWeight: 600 }}>📸 Photos</h3>
                  
                  <div style={{ marginBottom: "1rem" }}>
                    <label htmlFor="photo-upload" className="btn-primary" style={{ cursor: "pointer", display: "inline-block" }}>
                      {uploadingMedia ? "Uploading..." : "Upload Photos"}
                      <input
                        id="photo-upload"
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handlePhotoUpload}
                        disabled={uploadingMedia}
                        style={{ display: "none" }}
                      />
                    </label>
                  </div>

                  {locationPhotos.length === 0 ? (
                    <p style={{ color: "var(--text-muted)", fontStyle: "italic" }}>
                      No photos uploaded yet. Add photos to document this location.
                    </p>
                  ) : (
                    <div style={{ 
                      display: "grid", 
                      gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", 
                      gap: "1rem" 
                    }}>
                      {locationPhotos.map((photo) => (
                        <div key={photo.id} style={{ 
                          position: "relative", 
                          borderRadius: "0.5rem", 
                          overflow: "hidden",
                          border: "1px solid var(--border-color)"
                        }}>
                          <img
                            src={photo.path}
                            alt={photo.filename}
                            style={{ 
                              width: "100%", 
                              height: "150px", 
                              objectFit: "cover",
                              display: "block"
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handlePhotoDelete(photo.id)}
                            style={{
                              position: "absolute",
                              top: "0.5rem",
                              right: "0.5rem",
                              background: "rgba(220, 38, 38, 0.9)",
                              color: "white",
                              border: "none",
                              borderRadius: "50%",
                              width: "28px",
                              height: "28px",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "1.1rem",
                              fontWeight: "bold"
                            }}
                            title="Delete photo"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h3 style={{ marginBottom: "1rem", fontSize: "1.1rem", fontWeight: 600 }}>🎥 Videos</h3>
                  
                  <div style={{ marginBottom: "1rem" }}>
                    <label htmlFor="video-upload" className="btn-primary" style={{ cursor: "pointer", display: "inline-block" }}>
                      {uploadingMedia ? "Uploading..." : "Upload Videos"}
                      <input
                        id="video-upload"
                        type="file"
                        accept="video/*"
                        multiple
                        onChange={handleVideoUpload}
                        disabled={uploadingMedia}
                        style={{ display: "none" }}
                      />
                    </label>
                  </div>

                  {locationVideos.length === 0 ? (
                    <p style={{ color: "var(--text-muted)", fontStyle: "italic" }}>
                      No videos uploaded yet. Add videos to document this location.
                    </p>
                  ) : (
                    <div style={{ 
                      display: "grid", 
                      gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", 
                      gap: "1rem" 
                    }}>
                      {locationVideos.map((video) => (
                        <div key={video.id} style={{ 
                          position: "relative", 
                          borderRadius: "0.5rem", 
                          overflow: "hidden",
                          border: "1px solid var(--border-color)"
                        }}>
                          <video
                            src={video.path}
                            controls
                            style={{ 
                              width: "100%", 
                              height: "200px", 
                              objectFit: "cover",
                              display: "block",
                              background: "#000"
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleVideoDelete(video.id)}
                            style={{
                              position: "absolute",
                              top: "0.5rem",
                              right: "0.5rem",
                              background: "rgba(220, 38, 38, 0.9)",
                              color: "white",
                              border: "none",
                              borderRadius: "50%",
                              width: "28px",
                              height: "28px",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "1.1rem",
                              fontWeight: "bold",
                              zIndex: 1
                            }}
                            title="Delete video"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="form-actions" style={{ marginTop: "2rem" }}>
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => setShowLocationSettings(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            {/* Insurance Tab - Only for primary locations */}
            {locationSettingsTab === "insurance" && editingLocation?.is_primary_location && (
              <div style={{ maxHeight: "70vh", overflowY: "auto", padding: "0.5rem" }}>
                <InsuranceTab 
                  location={editingLocation} 
                  items={items} 
                  allLocations={locations} 
                  onUpdate={() => {
                    onRefreshLocations();
                    setShowLocationSettings(null);
                  }} 
                />
              </div>
            )}
            {/* Living Tab - Only for primary locations */}
            {locationSettingsTab === "living" && (editingLocation?.location_category === "Primary" || editingLocation?.is_primary_location) && (
              <div style={{ maxHeight: "70vh", overflowY: "auto", padding: "0.5rem" }}>
                <LivingTab
                  location={editingLocation}
                  onUpdate={() => {
                    onRefreshLocations();
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Location Confirmation Modal */}
      {showDeleteLocationConfirm && showLocationSettings !== "create" && (
        <div className="modal-overlay" onClick={() => setShowDeleteLocationConfirm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirm Delete Location</h2>
              <button className="modal-close" onClick={() => setShowDeleteLocationConfirm(false)}>✕</button>
            </div>
            <div style={{ padding: "1.5rem" }}>
              <p>Are you sure you want to delete this location?</p>
              <p style={{ marginTop: "0.5rem" }}>
                All items in this location will be moved to its parent location.
              </p>
              <p style={{ color: "var(--danger)", marginTop: "0.5rem" }}>This action cannot be undone.</p>
            </div>
            <div className="form-actions">
              <button className="btn-outline" onClick={() => setShowDeleteLocationConfirm(false)}>
                Cancel
              </button>
              <button className="btn-danger" onClick={handleLocationDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {bulkAction === "delete" && (
        <div className="modal-overlay" onClick={handleCancelBulkAction}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirm Bulk Delete</h2>
              <button className="modal-close" onClick={handleCancelBulkAction}>✕</button>
            </div>
            <div style={{ padding: "1.5rem" }}>
              <p>Are you sure you want to delete {visibleSelectedIds.size} item{visibleSelectedIds.size !== 1 ? 's' : ''}?</p>
              <p style={{ color: "var(--danger)", marginTop: "0.5rem" }}>This action cannot be undone.</p>
            </div>
            <div className="form-actions">
              <button className="btn-outline" onClick={handleCancelBulkAction} disabled={bulkActionLoading}>
                Cancel
              </button>
              <button className="btn-danger" onClick={handleBulkActionConfirm} disabled={bulkActionLoading}>
                {bulkActionLoading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Update Tags Modal */}
      {bulkAction === "updateTags" && (
        <div className="modal-overlay" onClick={handleCancelBulkAction}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Update Tags for {visibleSelectedIds.size} Item{visibleSelectedIds.size !== 1 ? 's' : ''}</h2>
              <button className="modal-close" onClick={handleCancelBulkAction}>✕</button>
            </div>
            <div style={{ padding: "1.5rem" }}>
              <div className="form-group">
                <label>Mode</label>
                <select
                  value={tagUpdateMode}
                  onChange={(e) => setTagUpdateMode(e.target.value as "replace" | "add" | "remove")}
                  style={{ width: "100%", padding: "0.5rem" }}
                >
                  <option value="add">Add Tags</option>
                  <option value="remove">Remove Tags</option>
                  <option value="replace">Replace Tags</option>
                </select>
              </div>
              <div className="form-group">
                <label>Select Tags</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.5rem" }}>
                  {tags.map(tag => (
                    <label key={tag.id} style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                      <input
                        type="checkbox"
                        checked={selectedTagIds.has(tag.id.toString())}
                        onChange={() => handleTagToggle(tag.id.toString())}
                      />
                      <span>{tag.name}</span>
                    </label>
                  ))}
                  {tags.length === 0 && (
                    <p style={{ color: "var(--muted)" }}>No tags available</p>
                  )}
                </div>
              </div>
            </div>
            <div className="form-actions">
              <button className="btn-outline" onClick={handleCancelBulkAction} disabled={bulkActionLoading}>
                Cancel
              </button>
              <button 
                className="btn-primary" 
                onClick={handleBulkActionConfirm} 
                disabled={bulkActionLoading || selectedTagIds.size === 0}
              >
                {bulkActionLoading ? "Updating..." : "Update"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Update Location Modal */}
      {bulkAction === "updateLocation" && (
        <div className="modal-overlay" onClick={handleCancelBulkAction}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Update Location for {visibleSelectedIds.size} Item{visibleSelectedIds.size !== 1 ? 's' : ''}</h2>
              <button className="modal-close" onClick={handleCancelBulkAction}>✕</button>
            </div>
            <div style={{ padding: "1.5rem" }}>
              <div className="form-group">
                <label>Select Location</label>
                <select
                  value={selectedLocationId || ""}
                  onChange={(e) => setSelectedLocationId(e.target.value || null)}
                  style={{ width: "100%", padding: "0.5rem" }}
                >
                  <option value="">No Location</option>
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id.toString()}>
                      {getLocationPath(loc.id, locations)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-actions">
              <button className="btn-outline" onClick={handleCancelBulkAction} disabled={bulkActionLoading}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleBulkActionConfirm} disabled={bulkActionLoading}>
                {bulkActionLoading ? "Updating..." : "Update"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Label Print Modal */}
      {showQRPrint && (
        <QRLabelPrint
          location={showQRPrint}
          items={items.filter(item => item.location_id?.toString() === showQRPrint.id.toString())}
          onClose={() => setShowQRPrint(null)}
          initialPrintMode={printModeFromEdit}
        />
      )}
    </>
  );
};

export default InventoryPage;
