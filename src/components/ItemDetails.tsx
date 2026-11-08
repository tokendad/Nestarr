import React, { useState, useRef, useEffect } from "react";
import type { Item, Location, Photo, EnrichedItemData, User } from "../lib/api";
import { getApiBaseUrl, enrichItem, uploadPhoto, fetchItemCollections, fetchCollections, addItemsToCollection, removeItemFromCollection } from "../lib/api";
import type { Collection } from "../lib/api";
import { formatPhotoType, formatCurrency, formatDate, formatDateTime, getLocationPath } from "../lib/utils";
import { RELATIONSHIP_LABELS, LIVING_TAG_NAME, DOCUMENT_TYPES, PHOTO_TYPES } from "../lib/constants";
import MaintenanceTab from "./MaintenanceTab";
import WarrantyTab from "./WarrantyTab";
import PhotoModal from "./PhotoModal";
import EnrichmentModal from "./EnrichmentModal";
import QRLabelPrint from "./QRLabelPrint";

interface ItemDetailsProps {
  item: Item;
  locations: Location[];
  allItems: Item[];
  onEdit: () => void;
  onDelete: () => Promise<void>;
  onClose: () => void;
  onPhotoUpdated: () => void;
  onCollectionUpdated?: () => void;
  currentUser?: User | null;
}

type TabType = 'details' | 'maintenance' | 'warranty' | 'collections';

// ─── CollectionsTab ───────────────────────────────────────────────────────────

interface CollectionsTabProps {
  itemId: string;
  currentUser: User | null;
  itemCollections: Collection[];
  setItemCollections: React.Dispatch<React.SetStateAction<Collection[]>>;
  collectionsLoading: boolean;
  setCollectionsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  allCollections: Collection[];
  setAllCollections: React.Dispatch<React.SetStateAction<Collection[]>>;
  showAddToCollection: boolean;
  setShowAddToCollection: React.Dispatch<React.SetStateAction<boolean>>;
  addingToCollection: boolean;
  setAddingToCollection: React.Dispatch<React.SetStateAction<boolean>>;
  removingFromCollection: string | null;
  setRemovingFromCollection: React.Dispatch<React.SetStateAction<string | null>>;
  collectionsError: string | null;
  setCollectionsError: React.Dispatch<React.SetStateAction<string | null>>;
  onCollectionUpdated?: () => void;
}

function CollectionsTab({
  itemId,
  currentUser,
  itemCollections,
  setItemCollections,
  collectionsLoading,
  setCollectionsLoading,
  allCollections,
  setAllCollections,
  showAddToCollection,
  setShowAddToCollection,
  addingToCollection,
  setAddingToCollection,
  removingFromCollection,
  setRemovingFromCollection,
  collectionsError,
  setCollectionsError,
  onCollectionUpdated,
}: CollectionsTabProps) {
  const [selectedCollectionId, setSelectedCollectionId] = useState('');
  const canEdit = currentUser?.role === 'admin' || currentUser?.role === 'editor';

  useEffect(() => {
    setCollectionsLoading(true);
    setCollectionsError(null);
    fetchItemCollections(itemId)
      .then(data => setItemCollections(data))
      .catch(e => setCollectionsError(e instanceof Error ? e.message : 'Failed to load collections'))
      .finally(() => setCollectionsLoading(false));
  }, [itemId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpenAddModal = async () => {
    setCollectionsError(null);
    try {
      const all = await fetchCollections();
      setAllCollections(all);
      setSelectedCollectionId('');
      setShowAddToCollection(true);
    } catch (e: unknown) {
      setCollectionsError(e instanceof Error ? e.message : 'Failed to load collections');
    }
  };

  const handleAdd = async () => {
    if (!selectedCollectionId) return;
    setAddingToCollection(true);
    setCollectionsError(null);
    try {
      await addItemsToCollection(selectedCollectionId, [itemId]);
      const updated = await fetchItemCollections(itemId);
      setItemCollections(updated);
      setShowAddToCollection(false);
      onCollectionUpdated?.();
    } catch (e: unknown) {
      setCollectionsError(e instanceof Error ? e.message : 'Failed to add to collection');
    } finally {
      setAddingToCollection(false);
    }
  };

  const handleRemove = async (collectionId: string) => {
    setRemovingFromCollection(collectionId);
    setCollectionsError(null);
    try {
      await removeItemFromCollection(collectionId, itemId);
      setItemCollections(prev => prev.filter(c => c.id !== collectionId));
      onCollectionUpdated?.();
    } catch (e: unknown) {
      setCollectionsError(e instanceof Error ? e.message : 'Failed to remove from collection');
    } finally {
      setRemovingFromCollection(null);
    }
  };

  // Filter out already-member collections
  const memberIds = new Set(itemCollections.map(c => c.id));
  const available = allCollections.filter(c => !memberIds.has(c.id));

  return (
    <div className="item-details">
      <div className="details-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Collections</h3>
          {canEdit && (
            <button className="btn-outline" style={{ fontSize: 12 }} onClick={handleOpenAddModal}>
              + Add to Collection
            </button>
          )}
        </div>

        {collectionsError && (
          <div className="error-message" style={{ marginBottom: 10 }}>{collectionsError}</div>
        )}

        {collectionsLoading ? (
          <div style={{ color: '#888', padding: '12px 0' }}>Loading…</div>
        ) : itemCollections.length === 0 ? (
          <div style={{ color: '#888', padding: '12px 0' }}>
            This item is not in any collections yet.
          </div>
        ) : (
          <div>
            {itemCollections.map(col => (
              <div
                key={col.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '7px 10px',
                  borderRadius: 6,
                  marginBottom: 6,
                  background: `${col.color ?? '#457B9D'}11`,
                  borderLeft: `3px solid ${col.color ?? '#457B9D'}`,
                }}
              >
                <span style={{ fontSize: 18 }}>{col.icon ?? '🗂️'}</span>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{col.name}</span>
                {canEdit && (
                  <button
                    className="btn-outline"
                    style={{ fontSize: 12, padding: '2px 7px', color: '#c0392b', borderColor: '#c0392b' }}
                    onClick={() => handleRemove(col.id)}
                    disabled={removingFromCollection === col.id}
                    title={`Remove from ${col.name}`}
                  >
                    {removingFromCollection === col.id ? '…' : '× Remove'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add to collection picker */}
      {showAddToCollection && (
        <div className="modal-overlay" onClick={() => setShowAddToCollection(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2>Add to Collection</h2>
              <button className="modal-close" onClick={() => setShowAddToCollection(false)}>×</button>
            </div>
            <div style={{ padding: '16px 0' }}>
              {available.length === 0 ? (
                <p style={{ color: '#888' }}>This item is already in all available collections.</p>
              ) : (
                <>
                  <label htmlFor="collection-pick" style={{ fontSize: 14, fontWeight: 500 }}>
                    Select a collection
                  </label>
                  <select
                    id="collection-pick"
                    className="form-input"
                    value={selectedCollectionId}
                    onChange={e => setSelectedCollectionId(e.target.value)}
                    style={{ marginTop: 8 }}
                  >
                    <option value="">— Choose —</option>
                    {available.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.icon ? `${c.icon} ` : ''}{c.name}
                      </option>
                    ))}
                  </select>
                  {collectionsError && (
                    <div className="error-message" style={{ marginTop: 8 }}>{collectionsError}</div>
                  )}
                </>
              )}
            </div>
            <div className="collection-modal-footer" style={{ padding: '0 0 8px' }}>
              <button className="btn-outline" onClick={() => setShowAddToCollection(false)}>Cancel</button>
              {available.length > 0 && (
                <button
                  className="btn-primary"
                  onClick={handleAdd}
                  disabled={!selectedCollectionId || addingToCollection}
                >
                  {addingToCollection ? 'Adding…' : 'Add'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const ItemDetails: React.FC<ItemDetailsProps> = ({
  item,
  locations,
  allItems,
  onEdit,
  onDelete,
  onClose,
  onPhotoUpdated,
  onCollectionUpdated,
  currentUser,
}) => {
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('details');
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [enrichmentError, setEnrichmentError] = useState<string | null>(null);
  const [enrichmentData, setEnrichmentData] = useState<EnrichedItemData[] | null>(null);
  const [showQRPrint, setShowQRPrint] = useState(false);

  // Collections tab state
  const [itemCollections, setItemCollections] = useState<Collection[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [allCollections, setAllCollections] = useState<Collection[]>([]);
  const [showAddToCollection, setShowAddToCollection] = useState(false);
  const [addingToCollection, setAddingToCollection] = useState(false);
  const [removingFromCollection, setRemovingFromCollection] = useState<string | null>(null);
  const [collectionsError, setCollectionsError] = useState<string | null>(null);
  
  // Photo upload state
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showPhotoTypeModal, setShowPhotoTypeModal] = useState(false);
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const location = locations.find(
    (loc) => loc.id.toString() === item.location_id?.toString()
  );

  // Check if this is a living item - prefer the is_living flag as the source of truth,
  // but also check tags for backward compatibility
  const isLivingItem = item.is_living === true || 
    (item.is_living === undefined && (item.tags?.some(tag => tag.name === LIVING_TAG_NAME) ?? false));
  const isVehicleItem = item.is_vehicle === true;

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this item?")) {
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      await onDelete();
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete item");
      setDeleting(false);
    }
  };

  const handleEnrich = async () => {
    setEnriching(true);
    setEnrichmentError(null);
    setEnrichmentData(null);

    try {
      const result = await enrichItem(item.id.toString());
      if (result.enriched_data && result.enriched_data.length > 0) {
        setEnrichmentData(result.enriched_data);
      } else {
        setEnrichmentError(result.message || "No enrichment data available");
      }
    } catch (err: any) {
      setEnrichmentError(err.message || "Failed to enrich item data");
    } finally {
      setEnriching(false);
    }
  };

  const getRelationshipLabel = (type: string | null | undefined): string => {
    if (!type) return "—";
    return RELATIONSHIP_LABELS[type] || type;
  };

  // Handle file selection from camera or file input
  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setShowPhotoTypeModal(true);
      setPhotoUploadError(null);
    }
    // Reset input value so same file can be selected again
    event.target.value = '';
  };

  // Handle photo upload with selected type
  const handlePhotoUpload = async (photoType: string, isPrimary: boolean, isDataTag: boolean) => {
    if (!selectedFile) return;

    setUploadingPhoto(true);
    setPhotoUploadError(null);

    try {
      await uploadPhoto(item.id.toString(), selectedFile, photoType, isPrimary, isDataTag);
      setShowPhotoTypeModal(false);
      setSelectedFile(null);
      onPhotoUpdated(); // Refresh the item data to show new photo
    } catch (err: any) {
      setPhotoUploadError(err.message || "Failed to upload photo");
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Cancel photo upload
  const handleCancelPhotoUpload = () => {
    setShowPhotoTypeModal(false);
    setSelectedFile(null);
    setPhotoUploadError(null);
  };

  return (
    <section className="panel item-details-panel">
      <div className="panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0 }}>{item.name}</h2>
          {isVehicleItem && (
            <span className="tag-badge predefined" style={{ fontSize: '0.78rem' }}>Vehicle</span>
          )}
        </div>
        <button className="modal-close" onClick={onClose}>
          ✕
        </button>
      </div>
      
      {deleteError && <div className="error-banner">{deleteError}</div>}
      
      <div className="item-details-tabs">
        <button
          className={`tab-button ${activeTab === 'details' ? 'active' : ''}`}
          onClick={() => setActiveTab('details')}
        >
          Details
        </button>
        <button
          className={`tab-button ${activeTab === 'maintenance' ? 'active' : ''}`}
          onClick={() => setActiveTab('maintenance')}
        >
          Maintenance
        </button>
        {!isLivingItem && (
          <button
            className={`tab-button ${activeTab === 'warranty' ? 'active' : ''}`}
            onClick={() => setActiveTab('warranty')}
          >
            🛡️ Warranty
            {(item.warranties?.some(w => {
              if (!w.expiration_date) return false;
              const days = Math.ceil((new Date(w.expiration_date).getTime() - Date.now()) / 86_400_000);
              return days >= 0 && days <= 90;
            })) && <span className="warranty-tab-badge" aria-label="warranty alert">!</span>}
          </button>
        )}
        <button
          className={`tab-button ${activeTab === 'collections' ? 'active' : ''}`}
          onClick={() => setActiveTab('collections')}
        >
          🗂️ Collections
        </button>
      </div>

      {activeTab === 'details' && (
      <div className="item-details">
          <div className="details-section">
            <h3>Basic Information</h3>
            <div className="details-grid">
              <div className="detail-item">
                <span className="detail-label">Name:</span>
                <span className="detail-value">{item.name}</span>
              </div>
              {item.description && (
                <div className="detail-item full-width">
                  <span className="detail-label">Description:</span>
                  <span className="detail-value">{item.description}</span>
                </div>
              )}
              {/* Non-living item fields */}
              {!isLivingItem && (
                <>
                  {item.brand && (
                    <div className="detail-item">
                      <span className="detail-label">{isVehicleItem ? "Make:" : "Brand:"}</span>
                      <span className="detail-value">{item.brand}</span>
                    </div>
                  )}
                  {item.model_number && (
                    <div className="detail-item">
                      <span className="detail-label">{isVehicleItem ? "Model:" : "Model Number:"}</span>
                      <span className="detail-value">{item.model_number}</span>
                    </div>
                  )}
                  {!isVehicleItem && item.serial_number && (
                    <div className="detail-item">
                      <span className="detail-label">Serial Number:</span>
                      <span className="detail-value">{item.serial_number}</span>
                    </div>
                  )}
                  {isVehicleItem && item.vin && (
                    <div className="detail-item">
                      <span className="detail-label">VIN:</span>
                      <span className="detail-value">{item.vin}</span>
                    </div>
                  )}
                  {!isVehicleItem && item.upc && (
                    <div className="detail-item">
                      <span className="detail-label">UPC:</span>
                      <span className="detail-value">{item.upc}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {isVehicleItem && (
            <div className="details-section">
              <h3>Vehicle Details</h3>
              <div className="details-grid">
                {item.vehicle_year != null && (
                  <div className="detail-item">
                    <span className="detail-label">Year:</span>
                    <span className="detail-value">{item.vehicle_year}</span>
                  </div>
                )}
                {item.license_plate && (
                  <div className="detail-item">
                    <span className="detail-label">License Plate:</span>
                    <span className="detail-value">{item.license_plate}</span>
                  </div>
                )}
                {item.mileage != null && !isNaN(Number(item.mileage)) && (
                  <div className="detail-item">
                    <span className="detail-label">Mileage:</span>
                    <span className="detail-value">{Number(item.mileage).toLocaleString()} mi</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Living Item Details Section */}
          {isLivingItem && (
            <div className="details-section living-details">
              <h3>Living Item Details</h3>
              <div className="details-grid">
                {item.relationship_type && (
                  <div className="detail-item">
                    <span className="detail-label">Relationship:</span>
                    <span className="detail-value">{getRelationshipLabel(item.relationship_type)}</span>
                  </div>
                )}
                {item.birthdate && (
                  <div className="detail-item">
                    <span className="detail-label">Birthdate:</span>
                    <span className="detail-value">{formatDate(item.birthdate)}</span>
                  </div>
                )}
                {item.is_current_user && (
                  <div className="detail-item">
                    <span className="detail-label">Account Link:</span>
                    <span className="detail-value">✓ Associated with my account</span>
                  </div>
                )}
              </div>
              
              {item.contact_info && (
                <div className="contact-info-section">
                  <h4>Contact Information</h4>
                  <div className="details-grid">
                    {item.contact_info.phone && (
                      <div className="detail-item">
                        <span className="detail-label">Phone:</span>
                        <span className="detail-value">{item.contact_info.phone}</span>
                      </div>
                    )}
                    {item.contact_info.email && (
                      <div className="detail-item">
                        <span className="detail-label">Email:</span>
                        <span className="detail-value">{item.contact_info.email}</span>
                      </div>
                    )}
                    {item.contact_info.address && (
                      <div className="detail-item full-width">
                        <span className="detail-label">Address:</span>
                        <span className="detail-value">{item.contact_info.address}</span>
                      </div>
                    )}
                    {item.contact_info.notes && (
                      <div className="detail-item full-width">
                        <span className="detail-label">Notes:</span>
                        <span className="detail-value">{item.contact_info.notes}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Purchase Information - only show for non-living items */}
          {!isLivingItem && (
            <div className="details-section">
              <h3>Purchase Information</h3>
              <div className="details-grid">
                {item.purchase_date && (
                  <div className="detail-item">
                    <span className="detail-label">Purchase Date:</span>
                    <span className="detail-value">{formatDate(item.purchase_date)}</span>
                  </div>
                )}
                {item.retailer && (
                  <div className="detail-item">
                    <span className="detail-label">Retailer:</span>
                    <span className="detail-value">{item.retailer}</span>
                  </div>
                )}
                {item.purchase_price != null && !isNaN(Number(item.purchase_price)) && (
                  <div className="detail-item">
                    <span className="detail-label">Purchase Price:</span>
                    <span className="detail-value">{formatCurrency(Number(item.purchase_price))}</span>
                  </div>
                )}
                {item.estimated_value != null && !isNaN(Number(item.estimated_value)) && (
                  <div className="detail-item">
                    <span className="detail-label">Estimated Value:</span>
                    <span className="detail-value">{formatCurrency(Number(item.estimated_value))}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Additional Information (Dynamic Fields) */}
          {item.additional_info && item.additional_info.length > 0 && (
            <div className="details-section">
              <h3>Additional Information</h3>
              <div className="details-grid">
                {item.additional_info.map((field, index) => (
                  <div key={index} className={`detail-item ${['text', 'multiline', 'url'].includes(field.type) && field.value.length > 50 ? 'full-width' : ''}`}>
                    <span className="detail-label">{field.label}:</span>
                    <span className="detail-value">
                      {field.type === 'url' ? (
                        <a href={field.value.startsWith('http') ? field.value : `https://${field.value}`} target="_blank" rel="noopener noreferrer" className="detail-link">
                          {field.value}
                        </a>
                      ) : field.type === 'date' ? (
                        formatDate(field.value)
                      ) : field.type === 'boolean' ? (
                        field.value === 'true' ? 'Yes' : 'No'
                      ) : field.type === 'multiline' ? (
                        <span style={{ whiteSpace: 'pre-wrap' }}>{field.value}</span>
                      ) : (
                        field.value
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="details-section">
            <h3>Location</h3>
            <div className="details-grid">
              <div className="detail-item">
                <span className="detail-label">Location:</span>
                <span className="detail-value">{getLocationPath(item.location_id, locations)}</span>
              </div>
            </div>
          </div>

          {item.tags && item.tags.length > 0 && (
            <div className="details-section">
              <h3>Tags</h3>
              <div className="item-tags">
                {item.tags.map(tag => (
                  <span key={tag.id} className={`tag-badge ${tag.is_predefined ? 'predefined' : ''}`}>
                    {tag.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Photos/Images Section - Always show, even if empty */}
          <div className="details-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3>{isLivingItem ? "Photos" : "Images"}</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {/* Hidden file inputs */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileSelected}
                  style={{ display: 'none' }}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelected}
                  style={{ display: 'none' }}
                />
                <button
                  className="btn-outline"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  title="Add image from camera"
                >
                  📷 Camera
                </button>
                <button
                  className="btn-outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  title="Add image from file"
                >
                  🖼️ File
                </button>
              </div>
            </div>
            
            {item.photos && item.photos.length > 0 ? (
              <div className="photos-grid">
                {item.photos.map((photo) => {
                  let badgeText = formatPhotoType(photo.photo_type);
                  if (photo.is_primary) badgeText = 'Primary';
                  else if (photo.is_data_tag) badgeText = 'Data Tag';
                  else if (photo.photo_type === 'profile') badgeText = 'Profile';
                  
                  return (
                    <div 
                      key={photo.id} 
                      className="photo-item clickable"
                      onClick={() => setSelectedPhoto(photo)}
                      style={{ cursor: 'pointer' }}
                    >
                      <img 
                        src={`${getApiBaseUrl()}${photo.path}`} 
                        alt={`${item.name} - ${badgeText}`}
                        className="item-photo"
                      />
                      <span className="photo-badge">{badgeText}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                No images yet. Use the buttons above to add images.
              </p>
            )}
          </div>

          {item.documents && item.documents.filter(doc => doc.document_type === DOCUMENT_TYPES.MANUAL).length > 0 && (
            <div className="details-section">
              <h3>Manuals</h3>
              <div className="documents-list">
                {item.documents.filter(doc => doc.document_type === DOCUMENT_TYPES.MANUAL).map((doc) => (
                  <div key={doc.id} className="document-item">
                    <a 
                      href={`${getApiBaseUrl()}${doc.path}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="document-link"
                    >
                      {doc.mime_type === 'application/pdf' ? '📄' : '📝'} {doc.filename}
                    </a>
                    <span className="document-date">
                      Uploaded: {formatDate(doc.uploaded_at)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {item.documents && item.documents.filter(doc => doc.document_type !== DOCUMENT_TYPES.MANUAL).length > 0 && (
            <div className="details-section">
              <h3>Attachments</h3>
              <div className="documents-list">
                {item.documents.filter(doc => doc.document_type !== DOCUMENT_TYPES.MANUAL).map((doc) => (
                  <div key={doc.id} className="document-item">
                    <a 
                      href={`${getApiBaseUrl()}${doc.path}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="document-link"
                    >
                      📎 {doc.filename}
                    </a>
                    <span className="document-date">
                      Uploaded: {formatDate(doc.uploaded_at)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'maintenance' && (
        <div className="item-details">
          <MaintenanceTab itemId={item.id.toString()} />
        </div>
      )}

      {activeTab === 'warranty' && (
        <div className="item-details">
          <WarrantyTab item={item} onUpdate={onPhotoUpdated} />
        </div>
      )}

      {activeTab === 'collections' && (
        <CollectionsTab
          itemId={item.id.toString()}
          currentUser={currentUser ?? null}
          itemCollections={itemCollections}
          setItemCollections={setItemCollections}
          collectionsLoading={collectionsLoading}
          setCollectionsLoading={setCollectionsLoading}
          allCollections={allCollections}
          setAllCollections={setAllCollections}
          showAddToCollection={showAddToCollection}
          setShowAddToCollection={setShowAddToCollection}
          addingToCollection={addingToCollection}
          setAddingToCollection={setAddingToCollection}
          removingFromCollection={removingFromCollection}
          setRemovingFromCollection={setRemovingFromCollection}
          collectionsError={collectionsError}
          setCollectionsError={setCollectionsError}
          onCollectionUpdated={onCollectionUpdated}
        />
      )}

      <div className="panel-actions">
        <button
          className="btn-danger"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? "Deleting..." : "Delete"}
        </button>
        <button
          className="btn-outline"
          onClick={() => setShowQRPrint(true)}
          title="Print a QR label for this item"
        >
          🖨️ Print Label
        </button>
        <button
          className="btn-outline"
          onClick={handleEnrich}
          disabled={enriching}
          style={{ marginLeft: "auto" }}
        >
          {enriching ? "Enriching..." : "Enrich Data"}
        </button>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button className="btn-outline" onClick={onClose}>
            Close
          </button>
          <button className="btn-primary" onClick={onEdit}>
            Edit
          </button>
        </div>
      </div>

      {/* Photo Modal */}
      {selectedPhoto && (
        <PhotoModal
          photo={selectedPhoto}
          allItems={allItems}
          onClose={() => setSelectedPhoto(null)}
          onPhotoUpdated={onPhotoUpdated}
        />
      )}

      {/* Enrichment Modal */}
      {enrichmentData && (
        <EnrichmentModal
          item={item}
          enrichmentData={enrichmentData}
          onClose={() => setEnrichmentData(null)}
          onItemUpdated={onPhotoUpdated}
        />
      )}

      {/* Enrichment Error Message */}
      {enrichmentError && !enriching && (
        <div className="modal-overlay" onClick={() => setEnrichmentError(null)}>
          <section className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Enrichment Error</h2>
              <button className="modal-close" onClick={() => setEnrichmentError(null)}>
                ✕
              </button>
            </div>
            <p>{enrichmentError}</p>
            <div className="modal-actions">
              <button className="btn-outline" onClick={() => setEnrichmentError(null)}>
                Close
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Photo Type Selection Modal */}
      {showPhotoTypeModal && selectedFile && (
        <PhotoTypeSelectionModal
          file={selectedFile}
          onUpload={handlePhotoUpload}
          onCancel={handleCancelPhotoUpload}
          uploading={uploadingPhoto}
          error={photoUploadError}
          isLivingItem={isLivingItem}
        />
      )}

      {/* QR Label Print Modal */}
      {showQRPrint && (
        <QRLabelPrint
          item={item}
          onClose={() => setShowQRPrint(false)}
        />
      )}
    </section>
  );
};

// Photo Type Selection Modal Component
interface PhotoTypeSelectionModalProps {
  file: File;
  onUpload: (photoType: string, isPrimary: boolean, isDataTag: boolean) => void;
  onCancel: () => void;
  uploading: boolean;
  error: string | null;
  isLivingItem: boolean;
}

const PhotoTypeSelectionModal: React.FC<PhotoTypeSelectionModalProps> = ({
  file,
  onUpload,
  onCancel,
  uploading,
  error,
  isLivingItem,
}) => {
  const [photoType, setPhotoType] = useState<string>(isLivingItem ? PHOTO_TYPES.PROFILE : PHOTO_TYPES.DEFAULT);
  const [isPrimary, setIsPrimary] = useState(false);
  const [isDataTag, setIsDataTag] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  // Create preview URL when component mounts
  React.useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleSubmit = () => {
    onUpload(photoType, isPrimary, isDataTag);
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <section className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h2>Configure Photo</h2>
          <button className="modal-close" onClick={onCancel} disabled={uploading}>
            ✕
          </button>
        </div>
        
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Image Preview */}
          {previewUrl && (
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <img 
                src={previewUrl} 
                alt="Preview" 
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: '300px', 
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)'
                }} 
              />
            </div>
          )}

          {error && (
            <div className="error-banner">{error}</div>
          )}

          {/* Photo Type Selection */}
          <div className="form-group">
            <label htmlFor="photo-type">Photo Type:</label>
            <select
              id="photo-type"
              value={photoType}
              onChange={(e) => setPhotoType(e.target.value)}
              disabled={uploading}
              style={{ width: '100%', padding: '0.5rem' }}
            >
              {isLivingItem ? (
                <>
                  <option value={PHOTO_TYPES.PROFILE}>Profile</option>
                  <option value={PHOTO_TYPES.OPTIONAL}>Additional Photo</option>
                </>
              ) : (
                <>
                  <option value={PHOTO_TYPES.DEFAULT}>Default/Primary</option>
                  <option value={PHOTO_TYPES.DATA_TAG}>Data Tag</option>
                  <option value={PHOTO_TYPES.RECEIPT}>Receipt</option>
                  <option value={PHOTO_TYPES.WARRANTY}>Warranty</option>
                  <option value={PHOTO_TYPES.OPTIONAL}>Additional Photo</option>
                </>
              )}
            </select>
          </div>

          {/* Photo Flags */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isPrimary}
                onChange={(e) => setIsPrimary(e.target.checked)}
                disabled={uploading}
              />
              <span>Set as Primary Photo</span>
            </label>

            {!isLivingItem && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isDataTag}
                  onChange={(e) => setIsDataTag(e.target.checked)}
                  disabled={uploading}
                />
                <span>Mark as Data Tag</span>
              </label>
            )}
          </div>
        </div>

        <div className="modal-actions">
          <button 
            className="btn-outline" 
            onClick={onCancel}
            disabled={uploading}
          >
            Cancel
          </button>
          <button 
            className="btn-primary" 
            onClick={handleSubmit}
            disabled={uploading}
          >
            {uploading ? 'Uploading...' : 'Upload Photo'}
          </button>
        </div>
      </section>
    </div>
  );
};

export default ItemDetails;
