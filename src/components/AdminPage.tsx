import React, { useState, useEffect, useCallback } from "react";
import NetworkDiscoveryWizard from "./onboarding/NetworkDiscoveryWizard";
import LocalLLMSettings from "./LocalLLMSettings";
import { STORAGE_KEYS } from "../lib/constants";
import {
  fetchUsers,
  updateUser,
  deleteUser,
  fetchLocations,
  updateUserLocationAccess,
  adminCreateUser,
  validatePassword,
  getLogSettings,
  updateLogSettings,
  deleteLogFiles,
  rotateLogsNow,
  getLogContent,
  getIssueReportData,
  getConfigStatus,
  getGoogleOAuthStatus,
  getGDriveStatus,
  connectGDrive,
  disconnectGDrive,
  createGDriveBackup,
  listGDriveBackups,
  deleteGDriveBackup,
  getAIStatus,
  updateAIScheduleSettings,
  runAIValuation,
  enrichFromDataTags,
  getAvailableUPCDatabases,
  getUPCDatabaseSettings,
  updateUPCDatabaseSettings,
  getAvailableAIProviders,
  getAIProviderSettings,
  updateAIProviderSettings,
  updateApiKeys,
  fetchGeminiModels,
  fetchPlugins,
  createPlugin,
  updatePlugin,
  deletePlugin,
  testPluginConnection,
  testAIConnection,
  getSystemSettings,
  updateSystemSettings,
  getCategoryAgentStatus,
  resetCategoryAgent,
  type User,
  type Location,
  type AdminUserCreate,
  type LogSettings,
  type LogFile,
  type IssueReportData,
  type ConfigStatusResponse,
  type GDriveStatus,
  type GDriveBackupResponse,
  type GDriveBackupFile,
  type AIStatusResponse,
  type AIValuationRunResponse,
  type AIEnrichmentRunResponse,
  type AvailableUPCDatabase,
  type UPCDatabaseConfig,
  type AvailableAIProvider,
  type AIProviderConfig,
  type Plugin,
  type PluginCreate,
  type PluginUpdate,
  type PluginConnectionTestResult,
  type AIConnectionTestResponse,
  type DynamicField,
  type GeminiModelInfo
} from "../lib/api";
import Status from "./Status";

interface AdminPageProps {
  onClose: () => void;
  currentUserId?: string;
  embedded?: boolean;
}

// Type definition for Google Identity Services OAuth2 code client
interface GoogleOAuth2CodeClient {
  requestCode: () => void;
}

interface GoogleOAuth2Config {
  client_id: string;
  scope: string;
  callback: (response: { code?: string }) => void;
}

interface GoogleOAuth2 {
  initCodeClient: (config: GoogleOAuth2Config) => GoogleOAuth2CodeClient;
}

interface GoogleAccounts {
  oauth2?: GoogleOAuth2;
}

interface GoogleWindow extends Window {
  google?: {
    accounts?: GoogleAccounts;
  };
}

type MainTabType = 'users' | 'logs' | 'server' | 'ai-settings' | 'plugins' | 'status' | 'custom-fields';
type UserSubTabType = 'all' | 'pending' | 'create';

const AdminPage: React.FC<AdminPageProps> = ({ onClose, currentUserId, embedded = false }) => {
  // Main tab state
  const [mainTab, setMainTab] = useState<MainTabType>('users');
  
  // Custom Fields state
  const [customFields, setCustomFields] = useState<DynamicField[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CUSTOM_FIELDS_TEMPLATE);
    return saved ? JSON.parse(saved) : [
      { label: "Related URL", value: "", type: "url" },
      { label: "Notes", value: "", type: "text" }
    ];
  });
  const [customFieldsSuccess, setCustomFieldsSuccess] = useState<string | null>(null);

  // Location Categories state
  const [locationCategories, setLocationCategories] = useState<string[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [categoriesSuccess, setCategoriesSuccess] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState("");

  // User management states
  const [users, setUsers] = useState<User[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingLocationUserId, setEditingLocationUserId] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<string>("");
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [updateError, setUpdateError] = useState<string | null>(null);
  
  // User sub-tab state
  const [userSubTab, setUserSubTab] = useState<UserSubTabType>("all");
  
  // Create user form state
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createFullName, setCreateFullName] = useState("");
  const [createRole, setCreateRole] = useState("viewer");
  const [createApproved, setCreateApproved] = useState(true);
  const [createRequirePasswordChange, setCreateRequirePasswordChange] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [passwordValidationError, setPasswordValidationError] = useState<string | null>(null);
  
  // Pending user approval role selections (userId -> role)
  const [pendingRoles, setPendingRoles] = useState<Record<string, string>>({});

  // Log settings states
  const [logSettings, setLogSettings] = useState<LogSettings>({
    rotation_type: "schedule",
    rotation_schedule_hours: 24,
    rotation_size_mb: 10,
    log_level: "info",
    retention_days: 30,
    auto_delete_enabled: false
  });
  const [logFiles, setLogFiles] = useState<LogFile[]>([]);
  const [logLoading, setLogLoading] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);
  const [logSuccess, setLogSuccess] = useState<string | null>(null);
  const [logSaving, setLogSaving] = useState(false);
  const [selectedLogFiles, setSelectedLogFiles] = useState<string[]>([]);
  
  // Issue report states
  const [issueReportLoading, setIssueReportLoading] = useState(false);
  const [githubIssueUrl, setGithubIssueUrl] = useState<string | null>(null);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [viewingLogContent, setViewingLogContent] = useState<string | null>(null);
  const [logContentData, setLogContentData] = useState<string>("");
  const [logContentLoading, setLogContentLoading] = useState(false);
  
  // Server settings states
  const [configStatus, setConfigStatus] = useState<ConfigStatusResponse | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [showGoogleClientId, setShowGoogleClientId] = useState(false);
  const [showGoogleSecret, setShowGoogleSecret] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverSuccess, setServerSuccess] = useState<string | null>(null);
  
  // API Keys editing states
  const [editingGeminiKey, setEditingGeminiKey] = useState(false);
  const [geminiApiKeyInput, setGeminiApiKeyInput] = useState("");
  const [geminiModelInput, setGeminiModelInput] = useState("");
  const [geminiModels, setGeminiModels] = useState<GeminiModelInfo[]>([]);
  const [geminiModelsLoading, setGeminiModelsLoading] = useState(false);
  const [geminiModelsLoaded, setGeminiModelsLoaded] = useState(false);
  const [geminiModelsError, setGeminiModelsError] = useState<string | null>(null);
  const [geminiModelFallback, setGeminiModelFallback] = useState(false);
  const [editingGoogleOAuth, setEditingGoogleOAuth] = useState(false);
  const [googleClientIdInput, setGoogleClientIdInput] = useState("");
  const [googleSecretInput, setGoogleSecretInput] = useState("");
  const [apiKeysSaving, setApiKeysSaving] = useState(false);
  
  // Google Drive states
  const [gdriveStatus, setGdriveStatus] = useState<GDriveStatus | null>(null);
  const [gdriveConnecting, setGdriveConnecting] = useState(false);
  const [gdriveBackingUp, setGdriveBackingUp] = useState(false);
  const [gdriveBackupResult, setGdriveBackupResult] = useState<GDriveBackupResponse | null>(null);
  const [gdriveBackups, setGdriveBackups] = useState<GDriveBackupFile[]>([]);
  const [gdriveBackupsLoading, setGdriveBackupsLoading] = useState(false);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  
  // AI states
  const [aiStatus, setAiStatus] = useState<AIStatusResponse | null>(null);
  const [aiScheduleEnabled, setAiScheduleEnabled] = useState(false);
  const [aiScheduleInterval, setAiScheduleInterval] = useState(7);
  const [aiScheduleLastRun, setAiScheduleLastRun] = useState<string | null>(null);
  const [aiScheduleSaving, setAiScheduleSaving] = useState(false);
  const [aiValuationRunning, setAiValuationRunning] = useState(false);
  const [aiValuationResult, setAiValuationResult] = useState<AIValuationRunResponse | null>(null);
  const [aiEnrichmentRunning, setAiEnrichmentRunning] = useState(false);
  const [aiEnrichmentResult, setAiEnrichmentResult] = useState<AIEnrichmentRunResponse | null>(null);
  
  // UPC Database states
  const [availableUpcDatabases, setAvailableUpcDatabases] = useState<AvailableUPCDatabase[]>([]);
  const [upcDatabases, setUpcDatabases] = useState<UPCDatabaseConfig[]>([]);
  const [upcDatabasesLoading, setUpcDatabasesLoading] = useState(false);
  const [upcDatabasesSaving, setUpcDatabasesSaving] = useState(false);
  const [upcSaveSuccess, setUpcSaveSuccess] = useState(false);
  const [editingUpcDb, setEditingUpcDb] = useState<string | null>(null);
  const [editingApiKey, setEditingApiKey] = useState("");
  
  // AI Provider states
  const [availableAiProviders, setAvailableAiProviders] = useState<AvailableAIProvider[]>([]);
  const [aiProviders, setAiProviders] = useState<AIProviderConfig[]>([]);
  const [aiProvidersLoading, setAiProvidersLoading] = useState(false);
  const [aiProvidersSaving, setAiProvidersSaving] = useState(false);
  const [aiProvidersSaveSuccess, setAiProvidersSaveSuccess] = useState(false);
  const [editingAiProvider, setEditingAiProvider] = useState<string | null>(null);
  const [editingProviderApiKey, setEditingProviderApiKey] = useState("");
  const [aiProvidersError, setAiProvidersError] = useState<string | null>(null);
  const [aiProvidersSuccess, setAiProvidersSuccess] = useState<string | null>(null);

  // AI Connection Test states
  const [aiTestLoading, setAiTestLoading] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<AIConnectionTestResponse | null>(null);

  // Plugin states
  const [showNetworkScan, setShowNetworkScan] = useState(false);
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [pluginsLoading, setPluginsLoading] = useState(false);
  const [pluginsError, setPluginsError] = useState<string | null>(null);
  const [editingPlugin, setEditingPlugin] = useState<string | null>(null);
  const [pluginFormData, setPluginFormData] = useState<Partial<PluginCreate>>({});
  const [pluginFormError, setPluginFormError] = useState<string | null>(null);
  const [pluginFormSuccess, setPluginFormSuccess] = useState<string | null>(null);
  const [showPluginApiKey, setShowPluginApiKey] = useState<Record<string, boolean>>({});
  const [testingConnection, setTestingConnection] = useState<Record<string, boolean>>({});
  const [connectionTestResults, setConnectionTestResults] = useState<Record<string, PluginConnectionTestResult | null>>({});

  // Category Agent states
  const [categoryAgentStatus, setCategoryAgentStatus] = useState<{
    training_samples: number;
    model_version: number;
    last_trained_at?: string;
    series_distribution?: Record<string, number>;
  } | null>(null);
  const [categoryAgentLoading, setCategoryAgentLoading] = useState(false);
  const [categoryAgentError, setCategoryAgentError] = useState<string | null>(null);
  const [categoryAgentResetting, setCategoryAgentResetting] = useState(false);
  const [categoryAgentResetSuccess, setCategoryAgentResetSuccess] = useState<string | null>(null);


  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const [usersData, locationsData] = await Promise.all([
        fetchUsers(),
        fetchLocations()
      ]);
      setUsers(usersData);
      setLocations(locationsData);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load data";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  async function loadLogSettings() {
    setLogLoading(true);
    setLogError(null);
    try {
      const response = await getLogSettings();
      setLogSettings(response.settings);
      setLogFiles(response.log_files);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load log settings";
      setLogError(errorMessage);
    } finally {
      setLogLoading(false);
    }
  }

  async function loadConfigStatus() {
    setConfigLoading(true);
    setServerError(null);
    try {
      const [status, aiStatusResult, gdriveStatusResult, googleOAuthStatus] = await Promise.all([
        getConfigStatus(),
        getAIStatus().catch(() => null),
        getGDriveStatus().catch(() => null),
        getGoogleOAuthStatus().catch(() => null)
      ]);
      setConfigStatus(status);
      if (status.gemini_configured) {
        loadGeminiModels(status);
      }
      setAiStatus(aiStatusResult);
      if (gdriveStatusResult) {
        setGdriveStatus(gdriveStatusResult);
      }
      if (googleOAuthStatus?.client_id) {
        setGoogleClientId(googleOAuthStatus.client_id);
      }
      // Load UPC databases
      loadUpcDatabases();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load server settings";
      setServerError(errorMessage);
      setConfigStatus(null);
    } finally {
      setConfigLoading(false);
    }
  }
  
  async function loadGeminiModels(freshConfigStatus?: typeof configStatus) {
    setGeminiModelsLoading(true);
    setGeminiModelsError(null);
    setGeminiModelFallback(false);
    const effectiveStatus = freshConfigStatus ?? configStatus;
    try {
      const result = await fetchGeminiModels();
      setGeminiModels(result.models);
      if (!geminiModelInput && effectiveStatus?.gemini_model) {
        const found = result.models.find(m => m.id === effectiveStatus.gemini_model);
        if (found) setGeminiModelInput(effectiveStatus.gemini_model);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch model list";
      setGeminiModelsError(message);
      setGeminiModelFallback(true);
    } finally {
      setGeminiModelsLoading(false);
      setGeminiModelsLoaded(true);
    }
  }

  async function loadUpcDatabases() {
    setUpcDatabasesLoading(true);
    try {
      const [available, userSettings] = await Promise.all([
        getAvailableUPCDatabases(),
        getUPCDatabaseSettings()
      ]);
      setAvailableUpcDatabases(available.databases);
      if (userSettings.upc_databases && userSettings.upc_databases.length > 0) {
        setUpcDatabases(userSettings.upc_databases);
      } else {
        // Default configuration
        setUpcDatabases(available.databases.map(db => ({
          id: db.id,
          enabled: true,
          api_key: null
        })));
      }
    } catch {
      // Silently fail
    } finally {
      setUpcDatabasesLoading(false);
    }
  }
  
  async function loadAiProviders() {
    setAiProvidersLoading(true);
    try {
      const [available, userSettings] = await Promise.all([
        getAvailableAIProviders(),
        getAIProviderSettings()
      ]);
      setAvailableAiProviders(available.providers);
      if (userSettings.ai_providers && userSettings.ai_providers.length > 0) {
        setAiProviders(userSettings.ai_providers);
      } else {
        // Default configuration - first provider enabled, others disabled
        setAiProviders(available.providers.map((provider, index) => ({
          id: provider.id,
          enabled: index === 0,  // First provider in list enabled by default
          priority: index + 1,
          api_key: null
        })));
      }
    } catch (err: unknown) {
      // Log error for debugging
      const errorMessage = err instanceof Error ? err.message : "Failed to load AI providers";
      console.error("Error loading AI providers:", errorMessage);
      setAiProvidersError(errorMessage);
    } finally {
      setAiProvidersLoading(false);
    }
  }
  
  async function loadGDriveBackups() {
    if (!gdriveStatus?.connected) return;
    setGdriveBackupsLoading(true);
    try {
      const result = await listGDriveBackups();
      setGdriveBackups(result.backups);
    } catch {
      // Silently fail
    } finally {
      setGdriveBackupsLoading(false);
    }
  }

  async function loadPlugins() {
    setPluginsLoading(true);
    setPluginsError(null);
    try {
      const pluginsData = await fetchPlugins();
      setPlugins(pluginsData);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load plugins";
      setPluginsError(errorMessage);
    } finally {
      setPluginsLoading(false);
    }
  }

  async function loadCategoryAgentStatus() {
    setCategoryAgentLoading(true);
    setCategoryAgentError(null);
    try {
      const status = await getCategoryAgentStatus();
      setCategoryAgentStatus(status);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load Category Agent status";
      setCategoryAgentError(errorMessage);
    } finally {
      setCategoryAgentLoading(false);
    }
  }

  async function handleResetCategoryAgent() {
    if (!window.confirm("Reset the Category Agent? This will delete all training data and cannot be undone.")) return;
    setCategoryAgentResetting(true);
    setCategoryAgentResetSuccess(null);
    setCategoryAgentError(null);
    try {
      await resetCategoryAgent();
      setCategoryAgentResetSuccess("Category Agent reset successfully. Training data cleared.");
      await loadCategoryAgentStatus();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to reset Category Agent";
      setCategoryAgentError(errorMessage);
    } finally {
      setCategoryAgentResetting(false);
    }
  }

  async function loadLocationCategories() {
    setCategoriesLoading(true);
    setCategoriesError(null);
    try {
      const settings = await getSystemSettings();
      if (settings.custom_location_categories && settings.custom_location_categories.length > 0) {
        setLocationCategories(settings.custom_location_categories);
      } else {
        // Default categories
        setLocationCategories([
          "Primary",
          "Out-building",
          "Room",
          "Floor",
          "Exterior",
          "Garage",
          "Shed",
          "Container"
        ]);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load location categories";
      setCategoriesError(errorMessage);
    } finally {
      setCategoriesLoading(false);
    }
  }

  async function handleSaveCategories(categories: string[]) {
    setCategoriesLoading(true);
    setCategoriesError(null);
    setCategoriesSuccess(null);
    try {
      await updateSystemSettings({ custom_location_categories: categories });
      setLocationCategories(categories);
      setCategoriesSuccess("Location categories saved successfully!");
      setTimeout(() => setCategoriesSuccess(null), 3000);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save location categories";
      setCategoriesError(errorMessage);
    } finally {
      setCategoriesLoading(false);
    }
  }

  function handleAddCategory() {
    if (!newCategory.trim()) return;
    if (locationCategories.includes(newCategory.trim())) {
      setCategoriesError("Category already exists");
      return;
    }
    const updated = [...locationCategories, newCategory.trim()];
    handleSaveCategories(updated);
    setNewCategory("");
  }

  function handleRemoveCategory(category: string) {
    if (confirm(`Are you sure you want to remove "${category}"? Note: Existing locations with this category will keep it, but it won't be available for new selection.`)) {
      const updated = locationCategories.filter(c => c !== category);
      handleSaveCategories(updated);
    }
  }

  function handleResetCategories() {
    if (confirm("Reset to default categories? This will overwrite your custom list.")) {
      handleSaveCategories([
        "Primary",
        "Out-building",
        "Room",
        "Floor",
        "Exterior",
        "Garage",
        "Shed",
        "Container"
      ]);
    }
  }

  async function handleTestConnection(pluginId: string) {
    setTestingConnection(prev => ({ ...prev, [pluginId]: true }));
    setConnectionTestResults(prev => ({ ...prev, [pluginId]: null }));
    try {
      const result = await testPluginConnection(pluginId);
      setConnectionTestResults(prev => ({ ...prev, [pluginId]: result }));
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to test connection";
      setConnectionTestResults(prev => ({ 
        ...prev, 
        [pluginId]: { 
          success: false, 
          message: errorMessage,
          status_code: null 
        } 
      }));
    } finally {
      setTestingConnection(prev => ({ ...prev, [pluginId]: false }));
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (mainTab === 'logs') {
      loadLogSettings();
    }
    if (mainTab === 'server') {
      loadConfigStatus();
    }
    if (mainTab === 'ai-settings') {
      loadAiProviders();
      loadConfigStatus(); // Also load config status for Gemini key display
    }
    if (mainTab === 'plugins') {
      loadPlugins();
      loadCategoryAgentStatus();
    }
    if (mainTab === 'custom-fields') {
      loadLocationCategories();
    }
  }, [mainTab]);

  async function handleRoleChange(userId: string, role: string) {
    setUpdateError(null);
    try {
      const updatedUser = await updateUser(userId, { role });
      setUsers(users.map(u => u.id === userId ? updatedUser : u));
      setEditingUserId(null);
      setNewRole("");
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setUpdateError(`Failed to update role: ${errorMessage}`);
    }
  }

  async function handleLocationAccessChange(userId: string) {
    setUpdateError(null);
    try {
      const updatedUser = await updateUserLocationAccess(userId, selectedLocations);
      setUsers(users.map(u => u.id === userId ? updatedUser : u));
      setEditingLocationUserId(null);
      setSelectedLocations([]);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setUpdateError(`Failed to update location access: ${errorMessage}`);
    }
  }

  async function handleApproveUser(userId: string, role: string) {
    setUpdateError(null);
    try {
      const updatedUser = await updateUser(userId, { is_approved: true, role });
      setUsers(users.map(u => u.id === userId ? updatedUser : u));
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setUpdateError(`Failed to approve user: ${errorMessage}`);
    }
  }

  async function handleRejectUser(userId: string) {
    setUpdateError(null);
    try {
      // For now, we'll just leave them unapproved. In the future, you might want to delete the user.
      const updatedUser = await updateUser(userId, { is_approved: false });
      setUsers(users.map(u => u.id === userId ? updatedUser : u));
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setUpdateError(`Failed to update user: ${errorMessage}`);
    }
  }

  async function handleDeleteUser(userId: string, userEmail: string) {
    // Check if trying to delete own account
    if (currentUserId && userId === currentUserId) {
      setUpdateError("Cannot delete your own account");
      return;
    }
    
    // Confirm deletion
    if (!window.confirm(`Are you sure you want to delete user "${userEmail}"? This action cannot be undone.`)) {
      return;
    }
    
    setUpdateError(null);
    try {
      await deleteUser(userId);
      setUsers(users.filter(u => u.id !== userId));
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setUpdateError(`Failed to delete user: ${errorMessage}`);
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setUpdateError(null);
    setCreateSuccess(null);
    setPasswordValidationError(null);
    
    if (!createEmail) {
      setUpdateError("Email is required");
      return;
    }
    
    // Password is always required - either as permanent or temporary
    if (!createPassword) {
      if (createRequirePasswordChange) {
        setUpdateError("Temporary password is required. User will be forced to change it on first login.");
      } else {
        setUpdateError("Password is required");
      }
      return;
    }
    
    // Validate password (we know it exists due to check above)
    const validation = validatePassword(createPassword);
    if (!validation.isValid) {
      setPasswordValidationError(validation.error);
      return;
    }
    
    setCreateLoading(true);
    try {
      const newUser: AdminUserCreate = {
        email: createEmail,
        password: createPassword,
        full_name: createFullName || undefined,
        role: createRole,
        is_approved: createApproved,
        require_password_change: createRequirePasswordChange,
      };
      const createdUser = await adminCreateUser(newUser);
      setUsers([...users, createdUser]);
      setCreateEmail("");
      setCreatePassword("");
      setCreateFullName("");
      setCreateRole("viewer");
      setCreateApproved(true);
      setCreateRequirePasswordChange(false);
      setPasswordValidationError(null);
      setCreateSuccess(`User "${createdUser.email}" created successfully!`);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setUpdateError(`Failed to create user: ${errorMessage}`);
    } finally {
      setCreateLoading(false);
    }
  }

  function startEditRole(userId: string, currentRole: string) {
    setEditingUserId(userId);
    setNewRole(currentRole);
    setEditingLocationUserId(null);
  }

  function startEditLocations(userId: string, currentLocationIds: string[] | null | undefined) {
    setEditingLocationUserId(userId);
    setSelectedLocations(currentLocationIds || []);
    setEditingUserId(null);
  }

  function cancelEdit() {
    setEditingUserId(null);
    setEditingLocationUserId(null);
    setNewRole("");
    setSelectedLocations([]);
  }

  function handleLocationToggle(locationId: string) {
    if (selectedLocations.includes(locationId)) {
      setSelectedLocations(selectedLocations.filter(id => id !== locationId));
    } else {
      setSelectedLocations([...selectedLocations, locationId]);
    }
  }

  // Log settings handlers
  async function handleSaveLogSettings() {
    setLogSaving(true);
    setLogError(null);
    setLogSuccess(null);
    try {
      const response = await updateLogSettings(logSettings);
      setLogSettings(response.settings);
      setLogFiles(response.log_files);
      setLogSuccess("Log settings saved successfully!");
      setTimeout(() => setLogSuccess(null), 3000);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save log settings";
      setLogError(errorMessage);
    } finally {
      setLogSaving(false);
    }
  }

  async function handleDeleteSelectedLogs() {
    if (selectedLogFiles.length === 0) return;
    
    if (!window.confirm(`Are you sure you want to delete ${selectedLogFiles.length} log file(s)? This cannot be undone.`)) {
      return;
    }
    
    setLogError(null);
    setLogSuccess(null);
    try {
      const response = await deleteLogFiles(selectedLogFiles);
      setLogSuccess(response.message);
      setSelectedLogFiles([]);
      await loadLogSettings();
      setTimeout(() => setLogSuccess(null), 3000);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to delete log files";
      setLogError(errorMessage);
    }
  }

  async function handleRotateLogs() {
    setLogError(null);
    setLogSuccess(null);
    try {
      const response = await rotateLogsNow();
      setLogSuccess(response.message);
      await loadLogSettings();
      setTimeout(() => setLogSuccess(null), 3000);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to rotate logs";
      setLogError(errorMessage);
    }
  }

  function handleLogFileToggle(fileName: string) {
    if (selectedLogFiles.includes(fileName)) {
      setSelectedLogFiles(selectedLogFiles.filter(f => f !== fileName));
    } else {
      setSelectedLogFiles([...selectedLogFiles, fileName]);
    }
  }

  function handleSelectAllLogFiles() {
    if (selectedLogFiles.length === logFiles.length) {
      setSelectedLogFiles([]);
    } else {
      setSelectedLogFiles(logFiles.map(f => f.name));
    }
  }

  // Issue report handlers
  async function handleOpenGitHubIssue() {
    setIssueReportLoading(true);
    setLogError(null);
    setGithubIssueUrl(null);
    setPopupBlocked(false);

    const POPUP_BLOCKED_MESSAGE = "Popup blocked by browser. Please use the link below to open the GitHub issue.";

    try {
      const reportData = await getIssueReportData();

      // Validate that the URL is properly formatted and is a GitHub URL to prevent XSS
      let validatedUrl: URL;
      try {
        validatedUrl = new URL(reportData.github_issue_url);
        if (!validatedUrl.href.startsWith('https://github.com/')) {
          throw new Error('URL must be a GitHub URL');
        }
      } catch {
        throw new Error('Invalid GitHub URL received from server');
      }

      // Store the URL in case popup is blocked
      setGithubIssueUrl(validatedUrl.href);

      // Open the GitHub issue URL directly
      const newWindow = window.open(validatedUrl.href, '_blank');

      if (!newWindow) {
        // Popup was blocked
        setPopupBlocked(true);
        setLogError(POPUP_BLOCKED_MESSAGE);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to generate issue report";
      setLogError(errorMessage);
    } finally {
      setIssueReportLoading(false);
    }
  }

  async function handleViewLogContent(fileName: string) {
    setLogContentLoading(true);
    setLogError(null);
    try {
      const response = await getLogContent(fileName, 200);
      setLogContentData(response.content);
      setViewingLogContent(fileName);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load log content";
      setLogError(errorMessage);
    } finally {
      setLogContentLoading(false);
    }
  }

  function handleCloseLogContent() {
    setViewingLogContent(null);
    setLogContentData("");
  }

  // Google Drive handlers
  const handleGDriveCallback = useCallback(async (response: { code?: string }) => {
    if (!response.code) {
      setServerError("Google Drive authorization failed");
      setGdriveConnecting(false);
      return;
    }

    try {
      const result = await connectGDrive(response.code);
      setGdriveStatus(result);
      setServerSuccess("Google Drive connected successfully!");
      setTimeout(() => setServerSuccess(null), 3000);
      // Load backups after connecting
      if (result.connected) {
        loadGDriveBackups();
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to connect Google Drive";
      setServerError(errorMessage);
    } finally {
      setGdriveConnecting(false);
    }
  }, []);

  async function handleConnectGDrive() {
    if (!googleClientId) {
      setServerError("Google OAuth is not configured");
      return;
    }

    setGdriveConnecting(true);
    setServerError(null);

    try {
      const googleWindow = window as GoogleWindow;
      if (!googleWindow.google?.accounts?.oauth2) {
        // Load Google Identity Services script
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://accounts.google.com/gsi/client';
          script.async = true;
          script.defer = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
          document.head.appendChild(script);
        });
      }

      // Initialize OAuth2 code client
      const client = (window as GoogleWindow).google?.accounts?.oauth2?.initCodeClient({
        client_id: googleClientId,
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: handleGDriveCallback,
      });

      if (client) {
        client.requestCode();
      } else {
        throw new Error('Failed to initialize Google OAuth client');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to start Google Drive authorization";
      setServerError(errorMessage);
      setGdriveConnecting(false);
    }
  }

  async function handleDisconnectGDrive() {
    try {
      const result = await disconnectGDrive();
      setGdriveStatus(result);
      setGdriveBackups([]);
      setServerSuccess("Google Drive disconnected");
      setTimeout(() => setServerSuccess(null), 3000);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to disconnect Google Drive";
      setServerError(errorMessage);
    }
  }

  async function handleBackupToGDrive() {
    setGdriveBackingUp(true);
    setServerError(null);
    setGdriveBackupResult(null);
    try {
      const result = await createGDriveBackup();
      setGdriveBackupResult(result);
      setServerSuccess(`Backup created: ${result.backup_name}`);
      setTimeout(() => setServerSuccess(null), 5000);
      // Refresh backups list
      loadGDriveBackups();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create backup";
      setServerError(errorMessage);
    } finally {
      setGdriveBackingUp(false);
    }
  }

  async function handleDeleteGDriveBackup(backupId: string) {
    if (!confirm("Are you sure you want to delete this backup?")) return;
    
    try {
      await deleteGDriveBackup(backupId);
      setGdriveBackups(prev => prev.filter(b => b.id !== backupId));
      setServerSuccess("Backup deleted");
      setTimeout(() => setServerSuccess(null), 3000);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to delete backup";
      setServerError(errorMessage);
    }
  }

  // AI Valuation handlers
  async function handleSaveAISchedule() {
    setAiScheduleSaving(true);
    setServerError(null);
    try {
      await updateAIScheduleSettings({
        ai_schedule_enabled: aiScheduleEnabled,
        ai_schedule_interval_days: aiScheduleInterval
      });
      setServerSuccess("AI schedule settings saved!");
      setTimeout(() => setServerSuccess(null), 3000);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save AI schedule settings";
      setServerError(errorMessage);
    } finally {
      setAiScheduleSaving(false);
    }
  }

  async function handleRunAIValuation() {
    setAiValuationRunning(true);
    setServerError(null);
    setAiValuationResult(null);
    try {
      const result = await runAIValuation();
      setAiValuationResult(result);
      if (result.ai_schedule_last_run) {
        setAiScheduleLastRun(result.ai_schedule_last_run);
      }
      setServerSuccess(result.message);
      setTimeout(() => setServerSuccess(null), 5000);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to run AI valuation";
      setServerError(errorMessage);
    } finally {
      setAiValuationRunning(false);
    }
  }

  async function handleRunAIEnrichment() {
    setAiEnrichmentRunning(true);
    setServerError(null);
    setAiEnrichmentResult(null);
    try {
      const result = await enrichFromDataTags();
      setAiEnrichmentResult(result);
      setServerSuccess(result.message);
      setTimeout(() => setServerSuccess(null), 5000);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to run AI enrichment";
      setServerError(errorMessage);
    } finally {
      setAiEnrichmentRunning(false);
    }
  }

  // UPC Database handlers
  async function handleSaveUpcDatabases() {
    setUpcDatabasesSaving(true);
    setServerError(null);
    setUpcSaveSuccess(false);
    try {
      await updateUPCDatabaseSettings(upcDatabases);
      setUpcSaveSuccess(true);
      setTimeout(() => setUpcSaveSuccess(false), 3000);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save UPC database settings";
      setServerError(errorMessage);
    } finally {
      setUpcDatabasesSaving(false);
    }
  }

  function handleUpcDatabaseToggle(dbId: string, enabled: boolean) {
    setUpcDatabases(prev => 
      prev.map(db => db.id === dbId ? { ...db, enabled } : db)
    );
  }

  function handleUpcDatabaseApiKeyEdit(dbId: string) {
    const db = upcDatabases.find(d => d.id === dbId);
    setEditingUpcDb(dbId);
    setEditingApiKey(db?.api_key || "");
  }

  function handleUpcDatabaseApiKeySave() {
    if (editingUpcDb) {
      setUpcDatabases(prev => 
        prev.map(db => db.id === editingUpcDb ? { ...db, api_key: editingApiKey || null } : db)
      );
      setEditingUpcDb(null);
      setEditingApiKey("");
    }
  }

  function handleUpcDatabaseApiKeyCancel() {
    setEditingUpcDb(null);
    setEditingApiKey("");
  }

  function moveUpcDatabaseUp(index: number) {
    if (index > 0) {
      const newDatabases = [...upcDatabases];
      [newDatabases[index - 1], newDatabases[index]] = [newDatabases[index], newDatabases[index - 1]];
      setUpcDatabases(newDatabases);
    }
  }

  function moveUpcDatabaseDown(index: number) {
    if (index < upcDatabases.length - 1) {
      const newDatabases = [...upcDatabases];
      [newDatabases[index], newDatabases[index + 1]] = [newDatabases[index + 1], newDatabases[index]];
      setUpcDatabases(newDatabases);
    }
  }

  function getUpcDatabaseInfo(dbId: string): AvailableUPCDatabase | undefined {
    return availableUpcDatabases.find(db => db.id === dbId);
  }
  
  // AI Provider handlers
  async function handleSaveAiProviders() {
    setAiProvidersSaving(true);
    setAiProvidersError(null);
    setAiProvidersSaveSuccess(false);
    try {
      await updateAIProviderSettings(aiProviders);
      setAiProvidersSaveSuccess(true);
      setAiProvidersSuccess("AI provider settings saved successfully!");
      setTimeout(() => {
        setAiProvidersSaveSuccess(false);
        setAiProvidersSuccess(null);
      }, 3000);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save AI provider settings";
      setAiProvidersError(errorMessage);
    } finally {
      setAiProvidersSaving(false);
    }
  }

  function handleAiProviderToggle(providerId: string, enabled: boolean) {
    setAiProviders(prev => 
      prev.map(p => p.id === providerId ? { ...p, enabled } : p)
    );
  }

  function handleAiProviderApiKeyEdit(providerId: string) {
    const provider = aiProviders.find(p => p.id === providerId);
    setEditingAiProvider(providerId);
    setEditingProviderApiKey(provider?.api_key || "");
  }

  function handleAiProviderApiKeySave() {
    if (editingAiProvider) {
      setAiProviders(prev => 
        prev.map(p => p.id === editingAiProvider ? { ...p, api_key: editingProviderApiKey || null } : p)
      );
      setEditingAiProvider(null);
      setEditingProviderApiKey("");
    }
  }

  function handleAiProviderApiKeyCancel() {
    setEditingAiProvider(null);
    setEditingProviderApiKey("");
  }

  function handleAiProviderPriorityChange(providerId: string, priority: number) {
    setAiProviders(prev => 
      prev.map(p => p.id === providerId ? { ...p, priority } : p)
    );
  }

  function getAiProviderInfo(providerId: string): AvailableAIProvider | undefined {
    return availableAiProviders.find(p => p.id === providerId);
  }

  async function handleTestAIConnection() {
    setAiTestLoading(true);
    setAiTestResult(null);
    setAiProvidersError(null);
    try {
      const result = await testAIConnection();
      setAiTestResult(result);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to test AI connection";
      setAiProvidersError(errorMessage);
    } finally {
      setAiTestLoading(false);
    }
  }

  function formatLastRun(dateStr: string | null | undefined): string {
    if (!dateStr) return "Never";
    try {
      const date = new Date(dateStr);
      return date.toLocaleString();
    } catch {
      return "Unknown";
    }
  }

  // API Keys handlers
  async function handleSaveGeminiApiKey() {
    setApiKeysSaving(true);
    setServerError(null);
    try {
      await updateApiKeys({ 
        gemini_api_key: geminiApiKeyInput || null,
        gemini_model: geminiModelInput || null
      });
      setServerSuccess("Gemini settings updated successfully!");
      setEditingGeminiKey(false);
      setGeminiApiKeyInput("");
      setGeminiModelInput("");
      await loadConfigStatus(); // Refresh status (triggers loadGeminiModels internally)
      setTimeout(() => setServerSuccess(null), 3000);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update Gemini settings";
      setServerError(errorMessage);
    } finally {
      setApiKeysSaving(false);
    }
  }

  async function handleSaveGoogleOAuth() {
    setApiKeysSaving(true);
    setServerError(null);
    try {
      await updateApiKeys({ 
        google_client_id: googleClientIdInput || null,
        google_client_secret: googleSecretInput || null
      });
      setServerSuccess("Google OAuth settings updated successfully!");
      setEditingGoogleOAuth(false);
      setGoogleClientIdInput("");
      setGoogleSecretInput("");
      await loadConfigStatus(); // Refresh status
      setTimeout(() => setServerSuccess(null), 3000);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update Google OAuth settings";
      setServerError(errorMessage);
    } finally {
      setApiKeysSaving(false);
    }
  }

  function handleCancelGeminiEdit() {
    setEditingGeminiKey(false);
    setGeminiApiKeyInput("");
    setGeminiModelInput("");
    setGeminiModelsError(null);
    setGeminiModelFallback(false);
  }

  function handleCancelGoogleOAuthEdit() {
    setEditingGoogleOAuth(false);
    setGoogleClientIdInput("");
    setGoogleSecretInput("");
  }

  // Clear errors on tab change
  function handleMainTabChange(tab: MainTabType) {
    setError(null);
    setUpdateError(null);
    setLogError(null);
    setLogSuccess(null);
    setServerError(null);
    setServerSuccess(null);
    setAiProvidersError(null);
    setAiProvidersSuccess(null);
    setCustomFieldsSuccess(null);
    setMainTab(tab);
  }

  // Custom Fields handlers
  function handleSaveCustomFields() {
    localStorage.setItem(STORAGE_KEYS.CUSTOM_FIELDS_TEMPLATE, JSON.stringify(customFields));
    setCustomFieldsSuccess("Custom fields template saved successfully!");
    setTimeout(() => setCustomFieldsSuccess(null), 3000);
  }

  function handleCustomFieldChange(index: number, field: keyof DynamicField, value: string) {
    const updatedFields = [...customFields];
    updatedFields[index] = { ...updatedFields[index], [field]: value };
    setCustomFields(updatedFields);
  }

  function addCustomField() {
    setCustomFields([...customFields, { label: "", value: "", type: "text" }]);
  }

  function removeCustomField(index: number) {
    const updatedFields = [...customFields];
    updatedFields.splice(index, 1);
    setCustomFields(updatedFields);
  }

  // Filter to only show primary/main locations for access control
  const primaryLocations = locations.filter(loc => 
    loc.is_primary_location || !loc.parent_id
  );

  // Filter users by approval status
  const approvedUsers = users.filter(u => u.is_approved);
  const pendingUsers = users.filter(u => !u.is_approved);

  // Render Status tab content
  const renderStatusTab = () => (
    <div className="tab-content">
      <Status />
    </div>
  );

  // Render Custom Fields tab content
  const renderCustomFieldsTab = () => (
    <div className="tab-content">
      {/* Location Categories Section */}
      <div className="form-section" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none', marginBottom: '2rem' }}>
        <h3>Custom Location Categories</h3>
        <p className="help-text">Manage the list of available location categories (e.g., Room, Garage, Container).</p>
        
        {categoriesLoading && <p>Loading categories...</p>}
        {categoriesError && <p className="error-message">{categoriesError}</p>}
        {categoriesSuccess && (
          <div className="success-message" style={{ marginBottom: "1rem" }}>
            {categoriesSuccess}
          </div>
        )}

        <div className="dynamic-fields-container" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
          {locationCategories.map((category) => (
            <div key={category} style={{ 
              display: 'flex', 
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 0.75rem',
              backgroundColor: 'var(--bg-elevated-softer)',
              borderRadius: '2rem',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.9rem'
            }}>
              <span>{category}</span>
              <button
                type="button"
                onClick={() => handleRemoveCategory(category)}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: 'var(--muted)',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: '1.1rem',
                  lineHeight: 1
                }}
                title="Remove category"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input
            type="text"
            placeholder="New Category Name"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
            style={{ maxWidth: "250px" }}
          />
          <button
            type="button"
            className="btn-primary"
            onClick={handleAddCategory}
            disabled={!newCategory.trim()}
          >
            + Add
          </button>
          <button
            type="button"
            className="btn-outline"
            onClick={handleResetCategories}
            style={{ marginLeft: "auto", fontSize: "0.85rem" }}
          >
            Reset to Defaults
          </button>
        </div>
      </div>

      <div className="form-section" style={{ paddingTop: '2rem', borderTop: '1px solid var(--border-subtle)' }}>
        <h3>Custom Field Templates (Items)</h3>
        <p className="help-text">Define default custom fields that will appear for new items. (Currently stored locally in browser)</p>
        
        {customFieldsSuccess && (
          <div style={{ 
            backgroundColor: "#d1fae5", 
            color: "#065f46", 
            padding: "0.75rem", 
            borderRadius: "4px",
            marginBottom: "1rem"
          }}>
            {customFieldsSuccess}
          </div>
        )}

        <div className="dynamic-fields-container" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
          {customFields.map((field, index) => (
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
                    placeholder="Label (e.g. Related URL)"
                    value={field.label}
                    onChange={(e) => handleCustomFieldChange(index, 'label', e.target.value)}
                    style={{ flex: 1, fontSize: '0.85rem', padding: '0.4rem' }}
                  />
                  <select
                    value={field.type}
                    onChange={(e) => handleCustomFieldChange(index, 'type', e.target.value as any)}
                    style={{ width: "120px", fontSize: '0.85rem', padding: '0.4rem' }}
                  >
                    <option value="text">Single Line Text</option>
                    <option value="multiline">MultiLine Text</option>
                    <option value="url">URL</option>
                    <option value="date">Date</option>
                    <option value="time">Time</option>
                    <option value="number">Integer/Number</option>
                    <option value="boolean">Boolean (Yes/No)</option>
                  </select>
                </div>
                <input
                  type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                  placeholder="Default Value (Optional)"
                  value={field.value}
                  onChange={(e) => handleCustomFieldChange(index, 'value', e.target.value)}
                  style={{ width: '100%', fontSize: '0.9rem', padding: '0.4rem' }}
                />
              </div>
              <button
                type="button"
                className="btn-danger"
                onClick={() => removeCustomField(index)}
                style={{ padding: '0.4rem 0.6rem', marginTop: '0.2rem' }}
                title="Remove field"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            className="btn-outline"
            onClick={addCustomField}
          >
            + Add Field Template
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSaveCustomFields}
            style={{ marginLeft: "auto" }}
          >
            Save Templates
          </button>
        </div>
      </div>
    </div>
  );

  // Render user admin tab content
  const renderUserAdminTab = () => (
    <>
      {/* User Sub-Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "0.5rem" }}>
        <button
          className={userSubTab === "all" ? "btn-primary" : "btn-outline"}
          onClick={() => setUserSubTab("all")}
          style={{ fontSize: "0.875rem" }}
        >
          All Users ({approvedUsers.length})
        </button>
        <button
          className={userSubTab === "pending" ? "btn-primary" : "btn-outline"}
          onClick={() => setUserSubTab("pending")}
          style={{ fontSize: "0.875rem", position: "relative" }}
        >
          Pending Approval ({pendingUsers.length})
          {pendingUsers.length > 0 && (
            <span style={{
              position: "absolute",
              top: "-8px",
              right: "-8px",
              backgroundColor: "#ff6b6b",
              color: "#fff",
              borderRadius: "50%",
              width: "20px",
              height: "20px",
              fontSize: "0.75rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              {pendingUsers.length}
            </span>
          )}
        </button>
        <button
          className={userSubTab === "create" ? "btn-primary" : "btn-outline"}
          onClick={() => setUserSubTab("create")}
          style={{ fontSize: "0.875rem" }}
        >
          Create User
        </button>
      </div>
      
      {loading && <p>Loading users...</p>}
      {error && <p className="error-message">{error}</p>}
      {updateError && <p className="error-message">{updateError}</p>}
      {createSuccess && <p style={{ color: "var(--success)", marginBottom: "1rem" }}>{createSuccess}</p>}
      
      {/* Create User Sub-Tab */}
      {!loading && !error && userSubTab === "create" && (
        <form onSubmit={handleCreateUser} style={{ maxWidth: "500px" }}>
          <div className="form-group">
            <label htmlFor="create-email">Email *</label>
            <input
              id="create-email"
              type="email"
              value={createEmail}
              onChange={(e) => setCreateEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <input
                type="checkbox"
                checked={createRequirePasswordChange}
                onChange={(e) => {
                  setCreateRequirePasswordChange(e.target.checked);
                  setPasswordValidationError(null);
                }}
              />
              Set password on Login
            </label>
            <small style={{ color: "var(--muted)", fontSize: "0.875rem", display: "block", marginBottom: "0.5rem" }}>
              When enabled, user must change the temporary password on first login
            </small>
          </div>
          <div className="form-group">
            <label htmlFor="create-password">
              {createRequirePasswordChange ? "Temporary Password *" : "Password *"}
            </label>
            <input
              id="create-password"
              type="password"
              value={createPassword}
              onChange={(e) => {
                setCreatePassword(e.target.value);
                setPasswordValidationError(null);
              }}
              required
              autoComplete="new-password"
              minLength={8}
            />
            {passwordValidationError && (
              <small style={{ color: "var(--error, #dc3545)", fontSize: "0.875rem", display: "block", marginTop: "0.25rem" }}>
                {passwordValidationError}
              </small>
            )}
            <small style={{ color: "var(--muted)", fontSize: "0.875rem", display: "block", marginTop: "0.25rem" }}>
              {createRequirePasswordChange 
                ? "Temporary password - user will be forced to change on first login. Must be at least 8 characters with 1 number." 
                : "Must be at least 8 characters with 1 number"}
            </small>
          </div>
          <div className="form-group">
            <label htmlFor="create-fullname">Full Name</label>
            <input
              id="create-fullname"
              type="text"
              value={createFullName}
              onChange={(e) => setCreateFullName(e.target.value)}
              autoComplete="name"
            />
          </div>
          <div className="form-group">
            <label htmlFor="create-role">Role</label>
            <select
              id="create-role"
              value={createRole}
              onChange={(e) => setCreateRole(e.target.value)}
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="form-group">
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="checkbox"
                checked={createApproved}
                onChange={(e) => setCreateApproved(e.target.checked)}
              />
              Pre-approved (user can log in immediately)
            </label>
          </div>
          <button type="submit" className="btn-primary" disabled={createLoading}>
            {createLoading ? "Creating..." : "Create User"}
          </button>
        </form>
      )}
      
      {/* Pending Users Sub-Tab */}
      {!loading && !error && userSubTab === "pending" && (
        <div className="table-wrapper">
          {pendingUsers.length === 0 ? (
            <p style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}>
              No pending users to approve
            </p>
          ) : (
            <table className="items-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Full Name</th>
                  <th>Registered</th>
                  <th>Set Role & Approve</th>
                </tr>
              </thead>
              <tbody>
                {pendingUsers.map((user) => (
                  <tr key={user.id}>
                    <td>{user.email}</td>
                    <td>{user.full_name || "—"}</td>
                    <td>{new Date(user.created_at).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                        <select
                          value={pendingRoles[user.id] || "viewer"}
                          onChange={(e) => setPendingRoles({ ...pendingRoles, [user.id]: e.target.value })}
                          style={{ padding: "0.25rem" }}
                        >
                          <option value="viewer">Viewer</option>
                          <option value="editor">Editor</option>
                          <option value="admin">Admin</option>
                        </select>
                        <button
                          className="btn-primary"
                          onClick={() => handleApproveUser(user.id, pendingRoles[user.id] || "viewer")}
                          style={{ fontSize: "0.875rem", padding: "0.25rem 0.5rem" }}
                        >
                          Approve
                        </button>
                        <button
                          className="btn-outline"
                          onClick={() => handleDeleteUser(user.id, user.email)}
                          style={{ fontSize: "0.875rem", padding: "0.25rem 0.5rem", color: "#ff6b6b", borderColor: "#ff6b6b" }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      
      {/* All Users Sub-Tab */}
      {!loading && !error && userSubTab === "all" && (
        <div className="table-wrapper">
          <table className="items-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Full Name</th>
                <th>Role</th>
                <th>Status</th>
                <th>Location Access</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {approvedUsers.map((user) => (
                <tr key={user.id}>
                  <td>{user.email}</td>
                  <td>{user.full_name || "—"}</td>
                  <td>
                    {editingUserId === user.id ? (
                      <select
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value)}
                        style={{ padding: "0.25rem" }}
                      >
                        <option value="admin">Admin</option>
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    ) : (
                      <span style={{ 
                        padding: "0.25rem 0.5rem",
                        borderRadius: "4px",
                        backgroundColor: user.role === "admin" ? "#ff6b6b" : user.role === "editor" ? "#4ecdc4" : "#95e1d3",
                        color: "#fff",
                        fontSize: "0.875rem",
                        fontWeight: "500"
                      }}>
                        {user.role}
                      </span>
                    )}
                  </td>
                  <td>
                    <span style={{ 
                      padding: "0.25rem 0.5rem",
                      borderRadius: "4px",
                      backgroundColor: user.is_approved ? "#4ecdc4" : "#ffcc00",
                      color: user.is_approved ? "#fff" : "#333",
                      fontSize: "0.875rem",
                      fontWeight: "500"
                    }}>
                      {user.is_approved ? "Active" : "Pending"}
                    </span>
                  </td>
                  <td>
                    {editingLocationUserId === user.id ? (
                      <div style={{ maxHeight: "150px", overflowY: "auto", padding: "0.5rem", border: "1px solid var(--border-subtle)", borderRadius: "4px" }}>
                        {primaryLocations.length === 0 ? (
                          <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--muted)" }}>No locations available</p>
                        ) : (
                          primaryLocations.map(loc => (
                            <label key={loc.id.toString()} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                              <input
                                type="checkbox"
                                checked={selectedLocations.includes(loc.id.toString())}
                                onChange={() => handleLocationToggle(loc.id.toString())}
                              />
                              <span style={{ fontSize: "0.875rem" }}>{loc.friendly_name || loc.name}</span>
                            </label>
                          ))
                        )}
                        <p style={{ margin: "0.5rem 0 0", fontSize: "0.75rem", color: "var(--muted)" }}>
                          Empty = access to all locations
                        </p>
                      </div>
                    ) : (
                      <span style={{ fontSize: "0.875rem" }}>
                        {user.allowed_location_ids && user.allowed_location_ids.length > 0 
                          ? `${user.allowed_location_ids.length} location(s)` 
                          : "All locations"}
                      </span>
                    )}
                  </td>
                  <td>{new Date(user.created_at).toLocaleDateString()}</td>
                  <td>
                    {editingUserId === user.id ? (
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                          className="btn-primary"
                          onClick={() => handleRoleChange(user.id, newRole)}
                          style={{ fontSize: "0.875rem", padding: "0.25rem 0.5rem" }}
                        >
                          Save
                        </button>
                        <button
                          className="btn-outline"
                          onClick={cancelEdit}
                          style={{ fontSize: "0.875rem", padding: "0.25rem 0.5rem" }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : editingLocationUserId === user.id ? (
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                          className="btn-primary"
                          onClick={() => handleLocationAccessChange(user.id)}
                          style={{ fontSize: "0.875rem", padding: "0.25rem 0.5rem" }}
                        >
                          Save
                        </button>
                        <button
                          className="btn-outline"
                          onClick={cancelEdit}
                          style={{ fontSize: "0.875rem", padding: "0.25rem 0.5rem" }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        <button
                          className="btn-outline"
                          onClick={() => startEditRole(user.id, user.role)}
                          style={{ fontSize: "0.875rem", padding: "0.25rem 0.5rem" }}
                        >
                          Change Role
                        </button>
                        <button
                          className="btn-outline"
                          onClick={() => startEditLocations(user.id, user.allowed_location_ids)}
                          style={{ fontSize: "0.875rem", padding: "0.25rem 0.5rem" }}
                        >
                          Edit Access
                        </button>
                        {currentUserId !== user.id && (
                          <button
                            className="btn-outline"
                            onClick={() => handleDeleteUser(user.id, user.email)}
                            style={{ 
                              fontSize: "0.875rem", 
                              padding: "0.25rem 0.5rem", 
                              color: "#ff6b6b", 
                              borderColor: "#ff6b6b" 
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );

  // Render log settings tab content
  const renderLogSettingsTab = () => (
    <div className="tab-content">
      {logLoading && <p>Loading log settings...</p>}
      {logError && <p className="error-message">{logError}</p>}
      {logSuccess && <p style={{ color: "var(--success)", marginBottom: "1rem" }}>{logSuccess}</p>}
      
      {!logLoading && (
        <>
          {/* Log Rotation Settings */}
          <div className="form-group" style={{ paddingBottom: "1rem", marginBottom: "1rem", borderBottom: "1px solid var(--border-subtle)" }}>
            <label>🔄 Log Rotation</label>
            <small style={{ color: "var(--muted)", fontSize: "0.875rem", display: "block", marginBottom: "0.75rem" }}>
              Configure how log files are rotated. Default is 24-hour schedule rotation.
            </small>
            
            <div style={{ marginBottom: "0.75rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <input
                  type="radio"
                  name="rotation_type"
                  value="schedule"
                  checked={logSettings.rotation_type === "schedule"}
                  onChange={() => setLogSettings({ ...logSettings, rotation_type: "schedule" })}
                />
                <span>Rotate by schedule</span>
              </label>
              {logSettings.rotation_type === "schedule" && (
                <div style={{ marginLeft: "1.5rem", marginBottom: "0.5rem" }}>
                  <label htmlFor="rotation_schedule_hours" style={{ fontSize: "0.85rem", marginRight: "0.5rem" }}>
                    Rotate every:
                  </label>
                  <select
                    id="rotation_schedule_hours"
                    value={logSettings.rotation_schedule_hours}
                    onChange={(e) => setLogSettings({ ...logSettings, rotation_schedule_hours: parseInt(e.target.value) })}
                    style={{ padding: "0.25rem" }}
                  >
                    <option value={12}>12 hours</option>
                    <option value={24}>24 hours (default)</option>
                    <option value={48}>48 hours</option>
                    <option value={168}>7 days</option>
                  </select>
                </div>
              )}
              
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  type="radio"
                  name="rotation_type"
                  value="size"
                  checked={logSettings.rotation_type === "size"}
                  onChange={() => setLogSettings({ ...logSettings, rotation_type: "size" })}
                />
                <span>Rotate by size</span>
              </label>
              {logSettings.rotation_type === "size" && (
                <div style={{ marginLeft: "1.5rem", marginTop: "0.5rem" }}>
                  <label htmlFor="rotation_size_mb" style={{ fontSize: "0.85rem", marginRight: "0.5rem" }}>
                    Rotate when file exceeds:
                  </label>
                  <select
                    id="rotation_size_mb"
                    value={logSettings.rotation_size_mb}
                    onChange={(e) => setLogSettings({ ...logSettings, rotation_size_mb: parseInt(e.target.value) })}
                    style={{ padding: "0.25rem" }}
                  >
                    <option value={5}>5 MB</option>
                    <option value={10}>10 MB (default)</option>
                    <option value={25}>25 MB</option>
                    <option value={50}>50 MB</option>
                    <option value={100}>100 MB</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Log Level Settings */}
          <div className="form-group" style={{ paddingBottom: "1rem", marginBottom: "1rem", borderBottom: "1px solid var(--border-subtle)" }}>
            <label>📊 Log Level</label>
            <small style={{ color: "var(--muted)", fontSize: "0.875rem", display: "block", marginBottom: "0.75rem" }}>
              Set the logging verbosity level. Higher levels include more detailed information.
            </small>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  type="radio"
                  name="log_level"
                  value="info"
                  checked={logSettings.log_level === "info" || logSettings.log_level === "warn_error"}
                  onChange={() => setLogSettings({ ...logSettings, log_level: "info" })}
                />
                <span><strong>Info</strong> - Operations, warnings, and errors (recommended for production)</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  type="radio"
                  name="log_level"
                  value="debug"
                  checked={logSettings.log_level === "debug"}
                  onChange={() => setLogSettings({ ...logSettings, log_level: "debug" })}
                />
                <span><strong>Debug</strong> - Detailed operation info for troubleshooting</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  type="radio"
                  name="log_level"
                  value="trace"
                  checked={logSettings.log_level === "trace"}
                  onChange={() => setLogSettings({ ...logSettings, log_level: "trace" })}
                />
                <span><strong>Trace</strong> - Full verbose logging including request details (development only)</span>
              </label>
            </div>
          </div>

          {/* Log Retention Settings */}
          <div className="form-group" style={{ paddingBottom: "1rem", marginBottom: "1rem", borderBottom: "1px solid var(--border-subtle)" }}>
            <label>🗑️ Log Retention</label>
            <small style={{ color: "var(--muted)", fontSize: "0.875rem", display: "block", marginBottom: "0.75rem" }}>
              Configure automatic deletion of old rotated log files.
            </small>
            
            <div style={{ marginBottom: "0.75rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <input
                  type="checkbox"
                  checked={logSettings.auto_delete_enabled}
                  onChange={(e) => setLogSettings({ ...logSettings, auto_delete_enabled: e.target.checked })}
                />
                <span>Enable automatic deletion of old log files</span>
              </label>
              
              {logSettings.auto_delete_enabled && (
                <div style={{ marginLeft: "1.5rem" }}>
                  <label htmlFor="retention_days" style={{ fontSize: "0.85rem", marginRight: "0.5rem" }}>
                    Delete logs older than:
                  </label>
                  <select
                    id="retention_days"
                    value={logSettings.retention_days}
                    onChange={(e) => setLogSettings({ ...logSettings, retention_days: parseInt(e.target.value) })}
                    style={{ padding: "0.25rem" }}
                  >
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                    <option value={30}>30 days (default)</option>
                    <option value={60}>60 days</option>
                    <option value={90}>90 days</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Save Settings Button */}
          <div style={{ marginBottom: "1.5rem" }}>
            <button
              className="btn-primary"
              onClick={handleSaveLogSettings}
              disabled={logSaving}
              style={{ width: "100%" }}
            >
              {logSaving ? "Saving..." : "💾 Save Log Settings"}
            </button>
          </div>

          {/* Log Files Management */}
          <div className="form-group">
            <label>📁 Log Files</label>
            <small style={{ color: "var(--muted)", fontSize: "0.875rem", display: "block", marginBottom: "0.75rem" }}>
              Manage existing log files. Log files are stored in /app/data/logs.
            </small>
            
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <button
                className="btn-outline"
                onClick={handleRotateLogs}
                style={{ fontSize: "0.85rem" }}
              >
                🔄 Rotate Now
              </button>
              <button
                className="btn-outline"
                onClick={loadLogSettings}
                style={{ fontSize: "0.85rem" }}
              >
                ↻ Refresh
              </button>
              {selectedLogFiles.length > 0 && (
                <button
                  className="btn-outline"
                  onClick={handleDeleteSelectedLogs}
                  style={{ fontSize: "0.85rem", color: "var(--danger)", borderColor: "var(--danger)" }}
                >
                  🗑️ Delete Selected ({selectedLogFiles.length})
                </button>
              )}
            </div>
            
            {logFiles.length === 0 ? (
              <div style={{ 
                backgroundColor: "var(--bg-elevated-softer)", 
                border: "1px solid var(--border-subtle)", 
                borderRadius: "4px", 
                padding: "1rem",
                textAlign: "center",
                color: "var(--muted)"
              }}>
                No log files found. Log files will appear here once generated.
              </div>
            ) : (
              <div className="table-wrapper" style={{ maxHeight: "250px" }}>
                <table className="items-table compact">
                  <thead>
                    <tr>
                      <th style={{ width: "40px" }}>
                        <input
                          type="checkbox"
                          checked={selectedLogFiles.length === logFiles.length && logFiles.length > 0}
                          onChange={handleSelectAllLogFiles}
                        />
                      </th>
                      <th>File Name</th>
                      <th>Type</th>
                      <th>Size</th>
                      <th>Modified</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logFiles.map((file) => (
                      <tr key={file.name}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedLogFiles.includes(file.name)}
                            onChange={() => handleLogFileToggle(file.name)}
                          />
                        </td>
                        <td style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{file.name}</td>
                        <td>
                          <span style={{ 
                            padding: "0.15rem 0.4rem",
                            borderRadius: "4px",
                            backgroundColor: file.log_type === "current" ? "#4ecdc4" : 
                                            file.log_type === "debug" ? "#f59e0b" : 
                                            file.log_type === "trace" ? "#8b5cf6" : "#6b7280",
                            color: "#fff",
                            fontSize: "0.75rem",
                            fontWeight: "500"
                          }}>
                            {file.log_type}
                          </span>
                        </td>
                        <td style={{ fontSize: "0.85rem" }}>{file.size_display}</td>
                        <td style={{ fontSize: "0.85rem" }}>{new Date(file.modified_at).toLocaleString()}</td>
                        <td>
                          <button
                            className="btn-outline"
                            onClick={() => handleViewLogContent(file.name)}
                            style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                            disabled={logContentLoading}
                          >
                            👁️ View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            {/* Log file naming convention info */}
            <div style={{ 
              marginTop: "1rem",
              padding: "0.75rem",
              backgroundColor: "var(--bg-elevated-softer)",
              borderRadius: "0.5rem",
              fontSize: "0.8rem",
              color: "var(--muted)"
            }}>
              <strong>Log file naming convention:</strong>
              <ul style={{ margin: "0.25rem 0 0 1rem", padding: 0 }}>
                <li><code>nestarr.log</code> - Current active log</li>
                <li><code>nestarr.log.[date]</code> - Rotated log</li>
                <li><code>nestarr.log.debug</code> - Debug log</li>
                <li><code>nestarr.log.trace</code> - Trace log</li>
              </ul>
            </div>
          </div>

          {/* Report Issue to GitHub */}
          <div className="form-group" style={{ marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid var(--border-subtle)" }}>
            <label>🐛 Report Issue to GitHub</label>
            <small style={{ color: "var(--muted)", fontSize: "0.875rem", display: "block", marginBottom: "0.75rem" }}>
              If you encounter errors or issues, you can quickly create a GitHub issue with system details and logs automatically included.
            </small>
            
            <div style={{ 
              backgroundColor: "var(--bg-elevated-softer)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "0.5rem",
              padding: "1rem"
            }}>
              <p style={{ margin: "0 0 0.75rem 0", fontSize: "0.85rem" }}>
                This will open a new GitHub issue on the Nestarr repository with:
              </p>
              <ul style={{ margin: "0 0 1rem 1rem", padding: 0, fontSize: "0.85rem" }}>
                <li>System information (app version, database type, platform)</li>
                <li>Current log settings configuration</li>
                <li>Instructions to upload log files if needed</li>
              </ul>
              <button
                className="btn-primary"
                onClick={handleOpenGitHubIssue}
                disabled={issueReportLoading}
                style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
              >
                {issueReportLoading ? "Generating..." : "🐙 Open GitHub Issue"}
              </button>
              
              {/* Fallback link shown when browser popup blocker prevents automatic window opening */}
              {githubIssueUrl && popupBlocked && (
                <div style={{ 
                  marginTop: "0.75rem", 
                  padding: "0.75rem", 
                  backgroundColor: "#fff3e0",
                  border: "1px solid #ffb74d",
                  borderRadius: "0.5rem"
                }}>
                  <a 
                    href={githubIssueUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ 
                      color: "#e65100",
                      textDecoration: "underline",
                      fontSize: "0.875rem",
                      fontWeight: "500"
                    }}
                  >
                    Click here to open the GitHub issue
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Log Content Viewer Modal */}
          {viewingLogContent && (
            <div className="modal-overlay" style={{ zIndex: 1100 }}>
              <div className="modal-content" style={{ maxWidth: "800px", maxHeight: "80vh" }}>
                <div className="modal-header">
                  <h2>📄 {viewingLogContent}</h2>
                  <button className="modal-close" onClick={handleCloseLogContent}>×</button>
                </div>
                {logContentLoading ? (
                  <p>Loading log content...</p>
                ) : (
                  <>
                    <div style={{
                      backgroundColor: "#0d1117",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "0.5rem",
                      padding: "1rem",
                      maxHeight: "400px",
                      overflowY: "auto",
                      fontFamily: "monospace",
                      fontSize: "0.75rem",
                      lineHeight: "1.5",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                      color: "#c9d1d9"
                    }}>
                      {logContentData || "No content available"}
                    </div>
                    <div className="modal-actions">
                      <button
                        className="btn-outline"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(logContentData);
                            setLogSuccess("Log content copied to clipboard!");
                            setTimeout(() => setLogSuccess(null), 3000);
                          } catch {
                            setLogError("Failed to copy to clipboard. Please select and copy manually.");
                            setTimeout(() => setLogError(null), 3000);
                          }
                        }}
                      >
                        📋 Copy to Clipboard
                      </button>
                      <button className="btn-outline" onClick={handleCloseLogContent}>
                        Close
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  // Render server settings tab content
  const renderServerSettingsTab = () => (
    <div className="tab-content">
      {configLoading && <p>Loading server configuration...</p>}
      
      {!configLoading && (
        <>
          {/* Google OAuth / Google Drive Settings */}
          <div className="form-group" style={{ paddingBottom: "1rem", marginBottom: "1rem", borderBottom: "1px solid var(--border-subtle)" }}>
            <label>☁️ Google OAuth Configuration</label>
            <small style={{ color: "var(--muted)", fontSize: "0.875rem", display: "block", marginBottom: "0.75rem" }}>
              Configure Google OAuth credentials to enable "Sign in with Google" and Google Drive backup.
              {configStatus?.google_from_env ? " Configured via environment variables (read-only)." : " Configure below or in your .env file."}
            </small>
            
            {/* Status Indicator */}
            <div style={{ 
              backgroundColor: configStatus?.google_oauth_configured ? "#e8f5e9" : "#fff3e0", 
              border: `1px solid ${configStatus?.google_oauth_configured ? "#81c784" : "#ffb74d"}`, 
              borderRadius: "4px", 
              padding: "0.75rem",
              marginBottom: "1rem"
            }}>
              <strong style={{ color: configStatus?.google_oauth_configured ? "#2e7d32" : "#e65100" }}>
                {configStatus?.google_oauth_configured ? "✓ Configured" : "⚠️ Not Configured"}
                {configStatus?.google_from_env && " (via environment)"}
              </strong>
              {!configStatus?.google_oauth_configured && !configStatus?.google_from_env && (
                <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.875rem", color: "#e65100" }}>
                  Configure below or set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your environment.
                </p>
              )}
            </div>
            
            {/* Editing mode for Google OAuth */}
            {editingGoogleOAuth && !configStatus?.google_from_env ? (
              <div style={{ marginBottom: "1rem", padding: "1rem", backgroundColor: "var(--bg-elevated-softer)", borderRadius: "0.5rem" }}>
                <div style={{ marginBottom: "0.75rem" }}>
                  <label style={{ fontSize: "0.85rem", marginBottom: "0.25rem", display: "block" }}>
                    Google Client ID
                  </label>
                  <input
                    type="text"
                    value={googleClientIdInput}
                    onChange={(e) => setGoogleClientIdInput(e.target.value)}
                    placeholder="Enter Google Client ID"
                    style={{ width: "100%", fontFamily: "monospace" }}
                  />
                </div>
                <div style={{ marginBottom: "0.75rem" }}>
                  <label style={{ fontSize: "0.85rem", marginBottom: "0.25rem", display: "block" }}>
                    Google Client Secret
                  </label>
                  <input
                    type="password"
                    value={googleSecretInput}
                    onChange={(e) => setGoogleSecretInput(e.target.value)}
                    placeholder="Enter Google Client Secret"
                    style={{ width: "100%", fontFamily: "monospace" }}
                  />
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleSaveGoogleOAuth}
                    disabled={apiKeysSaving}
                  >
                    {apiKeysSaving ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={handleCancelGoogleOAuthEdit}
                    disabled={apiKeysSaving}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Google Client ID Display */}
                <div style={{ marginBottom: "0.75rem" }}>
                  <label style={{ fontSize: "0.85rem", marginBottom: "0.25rem", display: "block" }}>
                    Google Client ID
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <input
                      type={showGoogleClientId ? "text" : "password"}
                      value={configStatus?.google_client_id || "Not configured"}
                      readOnly
                      style={{ 
                        flex: 1, 
                        backgroundColor: "var(--bg-elevated-softer)", 
                        color: "var(--text-primary)", 
                        fontFamily: "monospace",
                        cursor: "not-allowed"
                      }}
                    />
                    {configStatus?.google_client_id && (
                      <button
                        type="button"
                        className="btn-outline"
                        onClick={() => setShowGoogleClientId(!showGoogleClientId)}
                        style={{ padding: "0.5rem", minWidth: "60px" }}
                        aria-label={showGoogleClientId ? "Hide Client ID" : "Show Client ID"}
                        title={showGoogleClientId ? "Hide" : "Show"}
                      >
                        {showGoogleClientId ? "👁️" : "👁️‍🗨️"}
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Google Client Secret Display */}
                <div style={{ marginBottom: "0.75rem" }}>
                  <label style={{ fontSize: "0.85rem", marginBottom: "0.25rem", display: "block" }}>
                    Google Client Secret
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <input
                      type="password"
                      value={showGoogleSecret ? (configStatus?.google_client_secret_masked || "Not configured") : (configStatus?.google_client_secret_masked ? "••••••••••••" : "Not configured")}
                      readOnly
                      style={{ 
                        flex: 1, 
                        backgroundColor: "var(--bg-elevated-softer)", 
                        color: "var(--text-primary)", 
                        fontFamily: "monospace",
                        cursor: "not-allowed"
                      }}
                    />
                    {configStatus?.google_client_secret_masked && (
                      <button
                        type="button"
                        className="btn-outline"
                        onClick={() => setShowGoogleSecret(!showGoogleSecret)}
                        style={{ padding: "0.5rem", minWidth: "60px" }}
                        aria-label={showGoogleSecret ? "Hide Client Secret" : "Show Client Secret"}
                        title={showGoogleSecret ? "Hide" : "Show"}
                      >
                        {showGoogleSecret ? "👁️" : "👁️‍🗨️"}
                      </button>
                    )}
                  </div>
                  <small style={{ color: "var(--muted)", fontSize: "0.75rem", display: "block", marginTop: "0.25rem" }}>
                    Secret is partially masked for security
                  </small>
                </div>
                
                {/* Edit button - only show if not from env */}
                {!configStatus?.google_from_env && (
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => setEditingGoogleOAuth(true)}
                    style={{ marginBottom: "0.75rem" }}
                  >
                    ✏️ {configStatus?.google_oauth_configured ? "Edit" : "Configure"} Google OAuth
                  </button>
                )}
              </>
            )}
            
            <div style={{
              padding: "0.75rem",
              backgroundColor: "var(--bg-elevated-softer)",
              borderRadius: "0.5rem",
              fontSize: "0.8rem",
              color: "var(--muted)"
            }}>
              <strong>How to configure:</strong>
              <ol style={{ margin: "0.5rem 0 0 1rem", padding: 0 }}>
                <li>Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>Google Cloud Console</a></li>
                <li>Create OAuth 2.0 Client ID (Web application)</li>
                <li>Add your domain to Authorized JavaScript origins</li>
                <li>Enable the Google Drive API</li>
                <li>Enter the credentials above or set them in .env</li>
              </ol>
            </div>
          </div>

          {/* Google Drive Backup Section */}
          {configStatus?.google_oauth_configured && (
            <div className="form-group" style={{ paddingBottom: "1rem", marginBottom: "1rem", borderBottom: "1px solid var(--border-subtle)" }}>
              <label>💾 Google Drive Backup</label>
              <small style={{ color: "var(--muted)", fontSize: "0.875rem", display: "block", marginBottom: "0.75rem" }}>
                Backup the entire Nestarr database to Google Drive. This is a system-wide backup.
              </small>
              
              {serverError && (
                <div style={{ backgroundColor: "#ffebee", border: "1px solid #ef5350", borderRadius: "4px", padding: "0.75rem", marginBottom: "1rem", color: "#c62828" }}>
                  {serverError}
                </div>
              )}
              
              {serverSuccess && (
                <div style={{ backgroundColor: "#e8f5e9", border: "1px solid #81c784", borderRadius: "4px", padding: "0.75rem", marginBottom: "1rem", color: "#2e7d32" }}>
                  {serverSuccess}
                </div>
              )}
              
              {/* Connection Status */}
              <div style={{ 
                backgroundColor: gdriveStatus?.connected ? "#e8f5e9" : "#fff3e0", 
                border: `1px solid ${gdriveStatus?.connected ? "#81c784" : "#ffb74d"}`, 
                borderRadius: "4px", 
                padding: "0.75rem",
                marginBottom: "1rem"
              }}>
                <strong style={{ color: gdriveStatus?.connected ? "#2e7d32" : "#e65100" }}>
                  {gdriveStatus?.connected ? "✓ Connected to Google Drive" : "⚠️ Not Connected"}
                </strong>
                {gdriveStatus?.last_backup && (
                  <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.875rem" }}>
                    Last backup: {formatLastRun(gdriveStatus.last_backup)}
                  </p>
                )}
              </div>
              
              {/* Connect/Disconnect Buttons */}
              <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
                {!gdriveStatus?.connected ? (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleConnectGDrive}
                    disabled={gdriveConnecting}
                    style={{ flex: 1 }}
                  >
                    {gdriveConnecting ? "Connecting..." : "🔗 Connect Google Drive"}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={handleBackupToGDrive}
                      disabled={gdriveBackingUp}
                      style={{ flex: 1 }}
                    >
                      {gdriveBackingUp ? "Backing up..." : "💾 Create Backup Now"}
                    </button>
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={handleDisconnectGDrive}
                      style={{ color: "#d32f2f", borderColor: "#d32f2f" }}
                    >
                      Disconnect
                    </button>
                  </>
                )}
              </div>
              
              {/* Backup List */}
              {gdriveStatus?.connected && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                    <strong style={{ fontSize: "0.9rem" }}>Existing Backups</strong>
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={loadGDriveBackups}
                      disabled={gdriveBackupsLoading}
                      style={{ fontSize: "0.8rem", padding: "0.25rem 0.5rem" }}
                    >
                      {gdriveBackupsLoading ? "Loading..." : "↻ Refresh"}
                    </button>
                  </div>
                  
                  {gdriveBackups.length === 0 ? (
                    <p style={{ color: "var(--muted)", fontSize: "0.875rem", textAlign: "center", padding: "1rem" }}>
                      No backups found. Create your first backup above.
                    </p>
                  ) : (
                    <div style={{ maxHeight: "200px", overflowY: "auto", border: "1px solid var(--border-subtle)", borderRadius: "4px" }}>
                      {gdriveBackups.map(backup => (
                        <div key={backup.id} style={{ 
                          display: "flex", 
                          justifyContent: "space-between", 
                          alignItems: "center", 
                          padding: "0.5rem 0.75rem",
                          borderBottom: "1px solid var(--border-subtle)"
                        }}>
                          <div>
                            <div style={{ fontSize: "0.875rem", fontWeight: 500 }}>{backup.name}</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                              {new Date(backup.created_time).toLocaleString()}
                              {backup.size && ` • ${backup.size} bytes`}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn-outline"
                            onClick={() => handleDeleteGDriveBackup(backup.id)}
                            style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem", color: "#d32f2f", borderColor: "#d32f2f" }}
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* AI Valuation Settings */}
          {configStatus?.gemini_configured && (
            <div className="form-group" style={{ paddingBottom: "1rem", marginBottom: "1rem", borderBottom: "1px solid var(--border-subtle)" }}>
              <label>🤖 AI Valuation Settings</label>
              <small style={{ color: "var(--muted)", fontSize: "0.875rem", display: "block", marginBottom: "0.75rem" }}>
                Configure automatic AI-powered item valuation. This uses the Gemini API to estimate values for all items.
              </small>
              
              {/* Schedule Settings */}
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                  <input
                    type="checkbox"
                    checked={aiScheduleEnabled}
                    onChange={(e) => setAiScheduleEnabled(e.target.checked)}
                  />
                  <span>Enable scheduled AI valuation</span>
                </label>
                
                {aiScheduleEnabled && (
                  <div style={{ marginLeft: "1.5rem", marginBottom: "0.75rem" }}>
                    <label htmlFor="ai-interval" style={{ fontSize: "0.85rem", marginRight: "0.5rem" }}>
                      Run every:
                    </label>
                    <select
                      id="ai-interval"
                      value={aiScheduleInterval}
                      onChange={(e) => setAiScheduleInterval(parseInt(e.target.value))}
                      style={{ padding: "0.25rem" }}
                    >
                      <option value={1}>Daily</option>
                      <option value={7}>Weekly</option>
                      <option value={14}>Every 2 weeks</option>
                      <option value={30}>Monthly</option>
                    </select>
                  </div>
                )}
                
                <button
                  type="button"
                  className="btn-outline"
                  onClick={handleSaveAISchedule}
                  disabled={aiScheduleSaving}
                  style={{ marginTop: "0.5rem" }}
                >
                  {aiScheduleSaving ? "Saving..." : "Save Schedule Settings"}
                </button>
              </div>
              
              {/* Last Run Info */}
              <div style={{ 
                backgroundColor: "var(--bg-elevated-softer)", 
                borderRadius: "4px", 
                padding: "0.75rem",
                marginBottom: "1rem"
              }}>
                <p style={{ margin: 0, fontSize: "0.875rem" }}>
                  <strong>Last valuation run:</strong> {formatLastRun(aiScheduleLastRun)}
                </p>
              </div>
              
              {/* Manual Run Buttons */}
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleRunAIValuation}
                  disabled={aiValuationRunning}
                >
                  {aiValuationRunning ? "Running valuation..." : "▶️ Run AI Valuation Now"}
                </button>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={handleRunAIEnrichment}
                  disabled={aiEnrichmentRunning}
                >
                  {aiEnrichmentRunning ? "Enriching..." : "📷 Enrich from Data Tags"}
                </button>
              </div>
              
              {/* Results */}
              {aiValuationResult && (
                <div style={{ 
                  backgroundColor: "#e8f5e9", 
                  border: "1px solid #81c784", 
                  borderRadius: "4px", 
                  padding: "0.75rem",
                  marginTop: "1rem"
                }}>
                  <strong style={{ color: "#2e7d32" }}>Valuation Complete</strong>
                  <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.875rem" }}>
                    Processed: {aiValuationResult.items_processed} | 
                    Updated: {aiValuationResult.items_updated} | 
                    Skipped: {aiValuationResult.items_skipped}
                  </p>
                </div>
              )}
              
              {aiEnrichmentResult && (
                <div style={{ 
                  backgroundColor: aiEnrichmentResult.quota_exceeded ? "#fff3e0" : "#e8f5e9", 
                  border: `1px solid ${aiEnrichmentResult.quota_exceeded ? "#ffb74d" : "#81c784"}`, 
                  borderRadius: "4px", 
                  padding: "0.75rem",
                  marginTop: "1rem"
                }}>
                  <strong style={{ color: aiEnrichmentResult.quota_exceeded ? "#e65100" : "#2e7d32" }}>
                    Enrichment {aiEnrichmentResult.quota_exceeded ? "Stopped (Quota)" : "Complete"}
                  </strong>
                  <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.875rem" }}>
                    Items with data tags: {aiEnrichmentResult.items_with_data_tags} | 
                    Updated: {aiEnrichmentResult.items_updated}
                  </p>
                </div>
              )}
            </div>
          )}
          
          {/* UPC Database Configuration */}
          <div className="form-group" style={{ paddingBottom: "1rem", marginBottom: "1rem", borderBottom: "1px solid var(--border-subtle)" }}>
            <label>📊 UPC Database Priority</label>
            <small style={{ color: "var(--muted)", fontSize: "0.875rem", display: "block", marginBottom: "0.5rem" }}>
              Configure the order and API keys for UPC product lookup databases. Higher items are tried first.
            </small>
            
            {upcDatabasesLoading ? (
              <div style={{ 
                backgroundColor: "#e3f2fd", 
                border: "1px solid #64b5f6", 
                borderRadius: "4px", 
                padding: "0.75rem",
                marginBottom: "0.5rem"
              }}>
                Loading UPC database settings...
              </div>
            ) : (
              <>
                {/* Database List */}
                <div style={{ 
                  border: "1px solid var(--border-subtle)", 
                  borderRadius: "4px",
                  marginBottom: "0.75rem"
                }}>
                  {upcDatabases.map((db, index) => {
                    const dbInfo = getUpcDatabaseInfo(db.id);
                    const isEditing = editingUpcDb === db.id;
                    
                    return (
                      <div 
                        key={db.id}
                        style={{
                          padding: "0.75rem",
                          borderBottom: index < upcDatabases.length - 1 ? "1px solid var(--border-subtle)" : "none",
                          backgroundColor: db.enabled ? "transparent" : "var(--bg-elevated-softer)"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          {/* Priority Controls */}
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <button
                              type="button"
                              onClick={() => moveUpcDatabaseUp(index)}
                              disabled={index === 0}
                              style={{ 
                                padding: "2px 4px", 
                                fontSize: "0.7rem",
                                opacity: index === 0 ? 0.3 : 1,
                                cursor: index === 0 ? "not-allowed" : "pointer"
                              }}
                              className="btn-outline"
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              onClick={() => moveUpcDatabaseDown(index)}
                              disabled={index === upcDatabases.length - 1}
                              style={{ 
                                padding: "2px 4px", 
                                fontSize: "0.7rem",
                                opacity: index === upcDatabases.length - 1 ? 0.3 : 1,
                                cursor: index === upcDatabases.length - 1 ? "not-allowed" : "pointer"
                              }}
                              className="btn-outline"
                            >
                              ▼
                            </button>
                          </div>
                          
                          {/* Enable/Disable Toggle */}
                          <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                            <input
                              type="checkbox"
                              checked={db.enabled}
                              onChange={(e) => handleUpcDatabaseToggle(db.id, e.target.checked)}
                              style={{ marginRight: "0.5rem" }}
                            />
                          </label>
                          
                          {/* Database Info */}
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 500, fontSize: "0.9rem" }}>
                              {index + 1}. {dbInfo?.name || db.id}
                            </div>
                            <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                              {dbInfo?.description}
                            </div>
                          </div>
                          
                          {/* API Key Status/Edit */}
                          {dbInfo?.requires_api_key && (
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              {isEditing ? (
                                <>
                                  <input
                                    type="password"
                                    value={editingApiKey}
                                    onChange={(e) => setEditingApiKey(e.target.value)}
                                    placeholder="Enter API key"
                                    style={{ width: "150px", fontSize: "0.8rem" }}
                                  />
                                  <button
                                    type="button"
                                    className="btn-primary"
                                    onClick={handleUpcDatabaseApiKeySave}
                                    style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-outline"
                                    onClick={handleUpcDatabaseApiKeyCancel}
                                    style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <>
                                  <span style={{ 
                                    fontSize: "0.75rem", 
                                    color: db.api_key ? "#2e7d32" : "#e65100",
                                    backgroundColor: db.api_key ? "#e8f5e9" : "#fff3e0",
                                    padding: "0.125rem 0.5rem",
                                    borderRadius: "4px"
                                  }}>
                                    {db.api_key ? "Key Set" : "No Key"}
                                  </span>
                                  <button
                                    type="button"
                                    className="btn-outline"
                                    onClick={() => handleUpcDatabaseApiKeyEdit(db.id)}
                                    style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                                  >
                                    {db.api_key ? "Edit" : "Add Key"}
                                  </button>
                                  {dbInfo.api_key_url && (
                                    <a
                                      href={dbInfo.api_key_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{ 
                                        fontSize: "0.75rem", 
                                        color: "var(--accent)",
                                        textDecoration: "none"
                                      }}
                                    >
                                      Get Key →
                                    </a>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Save Button */}
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSaveUpcDatabases}
                  disabled={upcDatabasesSaving}
                  style={{ width: "100%" }}
                >
                  {upcDatabasesSaving ? "Saving..." : upcSaveSuccess ? "✓ Saved!" : "Save UPC Database Settings"}
                </button>
              </>
            )}
          </div>
          
          {/* Refresh Button */}
          <div style={{ marginTop: "1.5rem" }}>
            <button
              type="button"
              className="btn-outline"
              onClick={loadConfigStatus}
              disabled={configLoading}
              style={{ width: "100%" }}
            >
              {configLoading ? "Loading..." : "↻ Refresh Configuration Status"}
            </button>
          </div>
        </>
      )}
    </div>
  );

  const renderAISettingsTab = () => (
    <div className="tab-content">
      {aiProvidersLoading && <p>Loading AI providers...</p>}
      {aiProvidersError && <p className="error-message">{aiProvidersError}</p>}
      {aiProvidersSuccess && <p style={{ color: "var(--success)", marginBottom: "1rem" }}>{aiProvidersSuccess}</p>}
      
      {!aiProvidersLoading && (
        <>
          {/* AI Provider Configuration */}
          <div className="form-group" style={{ paddingBottom: "1rem", marginBottom: "1rem" }}>
            <label>🤖 AI Provider Settings</label>
            <small style={{ color: "var(--muted)", fontSize: "0.875rem", display: "block", marginBottom: "0.75rem" }}>
              Configure AI providers for intelligent features like barcode lookup, image analysis, and item valuation. 
              Each provider can be enabled/disabled and prioritized (lower number = higher priority).
            </small>
            
            {/* Provider List */}
            <div style={{ 
              border: "1px solid var(--border-subtle)", 
              borderRadius: "4px",
              marginBottom: "0.75rem"
            }}>
              {aiProviders
                .sort((a, b) => a.priority - b.priority)
                .map((provider, index) => {
                const providerInfo = getAiProviderInfo(provider.id);
                const isEditing = editingAiProvider === provider.id;
                
                return (
                  <div 
                    key={provider.id}
                    style={{
                      padding: "0.75rem",
                      borderBottom: index < aiProviders.length - 1 ? "1px solid var(--border-subtle)" : "none",
                      backgroundColor: provider.enabled ? "transparent" : "var(--bg-elevated-softer)"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                      {/* Enable/Disable Toggle */}
                      <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={provider.enabled}
                          onChange={(e) => handleAiProviderToggle(provider.id, e.target.checked)}
                          style={{ marginRight: "0.5rem" }}
                        />
                      </label>
                      
                      {/* Provider Info */}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500, fontSize: "0.95rem", marginBottom: "0.25rem" }}>
                          {providerInfo?.name || provider.id}
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                          {providerInfo?.description}
                        </div>
                      </div>
                      
                      {/* Priority Input */}
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <label style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Priority:</label>
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={provider.priority}
                          onChange={(e) => handleAiProviderPriorityChange(provider.id, parseInt(e.target.value) || 1)}
                          style={{ width: "60px", fontSize: "0.85rem", padding: "0.25rem" }}
                        />
                      </div>
                    </div>
                    
                    {/* API Key Section */}
                    {providerInfo?.requires_api_key && (
                      <div style={{ marginTop: "0.5rem", marginLeft: "1.5rem" }}>
                        {isEditing ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <input
                              type="password"
                              value={editingProviderApiKey}
                              onChange={(e) => setEditingProviderApiKey(e.target.value)}
                              placeholder={`Enter API key for ${providerInfo.name}`}
                              style={{ flex: 1, fontSize: "0.85rem" }}
                            />
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={handleAiProviderApiKeySave}
                              style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className="btn-outline"
                              onClick={handleAiProviderApiKeyCancel}
                              style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span style={{ 
                              fontSize: "0.75rem", 
                              color: provider.api_key ? "#2e7d32" : "#e65100",
                              backgroundColor: provider.api_key ? "#e8f5e9" : "#fff3e0",
                              padding: "0.25rem 0.5rem",
                              borderRadius: "4px"
                            }}>
                              {provider.api_key ? "✓ API Key Configured" : "⚠ No API Key"}
                            </span>
                            <button
                              type="button"
                              className="btn-outline"
                              onClick={() => handleAiProviderApiKeyEdit(provider.id)}
                              style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                            >
                              {provider.api_key ? "Edit Key" : "Add Key"}
                            </button>
                            {providerInfo.api_key_url && (
                              <a
                                href={providerInfo.api_key_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ 
                                  fontSize: "0.75rem", 
                                  color: "var(--accent)",
                                  textDecoration: "none"
                                }}
                              >
                                Get API Key →
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Special handling for Gemini - show model configuration */}
                    {provider.id === 'gemini' && (
                      <div style={{ marginTop: "0.5rem", marginLeft: "1.5rem" }}>
                        {/* Gemini API Key Input when editing */}
                        {editingGeminiKey && !configStatus?.gemini_from_env && (
                          <div style={{ marginBottom: "0.75rem" }}>
                            <label style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", marginBottom: "0.25rem" }}>
                              Gemini API Key:
                            </label>
                            <input
                              type="password"
                              value={geminiApiKeyInput}
                              onChange={(e) => setGeminiApiKeyInput(e.target.value)}
                              placeholder="Enter Gemini API Key (leave blank to keep current)"
                              style={{ width: "100%", fontFamily: "monospace", fontSize: "0.85rem", padding: "0.5rem" }}
                            />
                            <small style={{ color: "var(--muted)", fontSize: "0.7rem", display: "block", marginTop: "0.25rem" }}>
                              Leave blank to keep existing API key
                            </small>
                          </div>
                        )}
                        
                        {/* Display API key status when not editing */}
                        {!editingGeminiKey && (
                          <div style={{ marginBottom: "0.5rem" }}>
                            <label style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", marginBottom: "0.25rem" }}>
                              API Key Status:
                            </label>
                            <span style={{ 
                              fontSize: "0.75rem", 
                              color: configStatus?.gemini_configured ? "#2e7d32" : "#e65100",
                              backgroundColor: configStatus?.gemini_configured ? "#e8f5e9" : "#fff3e0",
                              padding: "0.25rem 0.5rem",
                              borderRadius: "4px",
                              display: "inline-block"
                            }}>
                              {configStatus?.gemini_configured ? "✓ Configured" : "⚠ Not Configured"}
                              {configStatus?.gemini_from_env && " (via environment)"}
                            </span>
                          </div>
                        )}
                        
                        {/* Gemini Model Selection */}
                        <div style={{ marginBottom: "0.5rem" }}>
                          <label style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", marginBottom: "0.25rem" }}>
                            Gemini Model:
                          </label>
                          {editingGeminiKey ? (
                            <div>
                              {/* Hint when no API key is configured yet */}
                              {!configStatus?.gemini_configured && !geminiModelsLoaded && !geminiModelsLoading && (
                                <small style={{ color: "var(--muted)", fontSize: "0.75rem", display: "block", padding: "0.5rem 0" }}>
                                  Save your API key first to load the available model list.
                                </small>
                              )}

                              {/* Loading state */}
                              {geminiModelsLoading && (
                                <div style={{ fontSize: "0.8rem", color: "var(--muted)", padding: "0.5rem 0" }}>
                                  Fetching available models...
                                </div>
                              )}

                              {/* Loaded — show dropdown */}
                              {!geminiModelsLoading && !geminiModelFallback && geminiModels.length > 0 && (
                                <>
                                  <select
                                    value={geminiModelInput || configStatus?.gemini_model || ""}
                                    onChange={(e) => setGeminiModelInput(e.target.value)}
                                    style={{ width: "100%", padding: "0.5rem", fontSize: "0.85rem" }}
                                    disabled={configStatus?.gemini_model_from_env}
                                  >
                                    <option value="" disabled>-- Select a model --</option>
                                    {configStatus?.gemini_model &&
                                     !geminiModels.find(m => m.id === configStatus.gemini_model) && (
                                      <option value={configStatus.gemini_model}>
                                        {configStatus.gemini_model} (current — not in live list)
                                      </option>
                                    )}
                                    {geminiModels.map((model) => (
                                      <option key={model.id} value={model.id}>
                                        {model.display_name}
                                      </option>
                                    ))}
                                  </select>
                                  <small style={{ color: "var(--muted)", fontSize: "0.7rem", marginTop: "0.25rem", display: "block" }}>
                                    {geminiModels.length} models available · Filtered for text generation
                                  </small>
                                </>
                              )}

                              {/* Error / Fallback — manual text input */}
                              {!geminiModelsLoading && geminiModelsLoaded && (geminiModelFallback || geminiModels.length === 0) && (
                                <>
                                  {geminiModelsError && (
                                    <div style={{ fontSize: "0.75rem", color: "#e65100", marginBottom: "0.25rem" }}>
                                      Could not load model list: {geminiModelsError}
                                    </div>
                                  )}
                                  <input
                                    type="text"
                                    value={geminiModelInput || configStatus?.gemini_model || ""}
                                    onChange={(e) => setGeminiModelInput(e.target.value)}
                                    placeholder="e.g. gemini-2.0-flash-exp"
                                    disabled={configStatus?.gemini_model_from_env}
                                    style={{ width: "100%", padding: "0.5rem", fontSize: "0.85rem", fontFamily: "monospace" }}
                                  />
                                  <small style={{ color: "var(--muted)", fontSize: "0.7rem", marginTop: "0.25rem", display: "block" }}>
                                    Enter the model ID manually
                                  </small>
                                  <button
                                    type="button"
                                    className="btn-outline"
                                    onClick={loadGeminiModels}
                                    style={{ fontSize: "0.7rem", marginTop: "0.25rem" }}
                                  >
                                    Retry
                                  </button>
                                </>
                              )}

                              {configStatus?.gemini_model_from_env && (
                                <small style={{ color: "var(--muted)", fontSize: "0.7rem", display: "block", marginTop: "0.25rem" }}>
                                  Model is set via GEMINI_MODEL environment variable (read-only)
                                </small>
                              )}
                            </div>
                          ) : (
                            <div>
                              <div style={{
                                fontSize: "0.85rem",
                                padding: "0.5rem",
                                backgroundColor: "var(--bg-elevated-softer)",
                                borderRadius: "4px",
                                marginBottom: "0.25rem"
                              }}>
                                {configStatus?.gemini_configured && configStatus?.gemini_model ? (
                                  geminiModels.find(m => m.id === configStatus.gemini_model)?.display_name || configStatus.gemini_model
                                ) : (
                                  "Not configured"
                                )}
                              </div>
                              {configStatus?.gemini_configured && configStatus?.gemini_model && (
                                <small style={{ color: "var(--muted)", fontSize: "0.7rem", display: "block" }}>
                                  {configStatus?.gemini_model_from_env && "Set via GEMINI_MODEL environment variable"}
                                </small>
                              )}
                              {configStatus?.gemini_configured && !configStatus?.gemini_model_from_env && (
                                <button
                                  type="button"
                                  className="btn-outline"
                                  onClick={loadGeminiModels}
                                  disabled={geminiModelsLoading}
                                  style={{ fontSize: "0.7rem", marginTop: "0.25rem" }}
                                >
                                  {geminiModelsLoading ? "Refreshing..." : "Refresh Model List"}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        
                        {/* Edit button for Gemini config */}
                        {!isEditing && !editingGeminiKey && !configStatus?.gemini_from_env && (
                          <button
                            type="button"
                            className="btn-outline"
                            onClick={() => {
                              setEditingGeminiKey(true);
                              setGeminiApiKeyInput("");
                              setGeminiModelInput(configStatus?.gemini_model || "");
                            }}
                            style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem", marginTop: "0.5rem" }}
                          >
                            ✏️ {configStatus?.gemini_configured ? "Edit" : "Configure"} Gemini Settings
                          </button>
                        )}
                        
                        {/* Save/Cancel buttons when editing Gemini */}
                        {editingGeminiKey && !configStatus?.gemini_from_env && (
                          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={handleSaveGeminiApiKey}
                              disabled={apiKeysSaving}
                              style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                            >
                              {apiKeysSaving ? "Saving..." : "Save Gemini Config"}
                            </button>
                            <button
                              type="button"
                              className="btn-outline"
                              onClick={handleCancelGeminiEdit}
                              disabled={apiKeysSaving}
                              style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                        
                        {/* Configuration instructions */}
                        <div style={{ 
                          marginTop: "0.75rem",
                          padding: "0.5rem",
                          backgroundColor: "var(--bg-elevated-softer)",
                          borderRadius: "0.25rem",
                          fontSize: "0.7rem",
                          color: "var(--muted)"
                        }}>
                          <strong>Gemini Configuration:</strong>
                          <ul style={{ margin: "0.25rem 0 0 1rem", padding: 0 }}>
                            <li>Get your API key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>Google AI Studio</a></li>
                            <li>Select your preferred model from the dropdown</li>
                            <li>Or set GEMINI_API_KEY and GEMINI_MODEL in your .env file</li>
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* Save Button */}
            <button
              type="button"
              className="btn-primary"
              onClick={handleSaveAiProviders}
              disabled={aiProvidersSaving}
              style={{ width: "100%", marginBottom: "0.75rem" }}
            >
              {aiProvidersSaving ? "Saving..." : aiProvidersSaveSuccess ? "✓ Saved!" : "Save AI Provider Settings"}
            </button>

            {/* Test AI Button */}
            <button
              type="button"
              className="btn-outline"
              onClick={handleTestAIConnection}
              disabled={aiTestLoading}
              style={{ width: "100%", marginBottom: "1rem" }}
            >
              {aiTestLoading ? "Testing AI Connections..." : "Test AI Connections"}
            </button>

            {/* Test Results */}
            {aiTestResult && (
              <div style={{
                marginBottom: "1rem",
                padding: "1rem",
                borderRadius: "0.5rem",
                backgroundColor: aiTestResult.overall_success ? "rgba(46, 125, 50, 0.1)" : "rgba(211, 47, 47, 0.1)",
                border: `1px solid ${aiTestResult.overall_success ? "rgba(46, 125, 50, 0.3)" : "rgba(211, 47, 47, 0.3)"}`
              }}>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  marginBottom: "0.75rem"
                }}>
                  <span style={{ fontSize: "1.2rem" }}>
                    {aiTestResult.overall_success ? "✓" : "✗"}
                  </span>
                  <strong style={{ color: aiTestResult.overall_success ? "#2e7d32" : "#d32f2f" }}>
                    {aiTestResult.summary}
                  </strong>
                </div>

                {/* Detailed Results */}
                {aiTestResult.results.length > 0 && (
                  <div style={{ marginTop: "0.5rem" }}>
                    {aiTestResult.results.map((result, index) => (
                      <div
                        key={result.provider_id}
                        style={{
                          padding: "0.5rem",
                          marginBottom: index < aiTestResult.results.length - 1 ? "0.5rem" : 0,
                          backgroundColor: "var(--bg-elevated-softer)",
                          borderRadius: "0.25rem",
                          borderLeft: `3px solid ${result.success ? "#2e7d32" : "#d32f2f"}`
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                          <span style={{ fontSize: "0.85rem" }}>
                            {result.success ? "✓" : "✗"}
                          </span>
                          <strong style={{ fontSize: "0.85rem" }}>
                            {result.provider_name}
                          </strong>
                          {result.is_plugin && (
                            <span style={{
                              fontSize: "0.65rem",
                              padding: "0.1rem 0.3rem",
                              backgroundColor: "var(--accent)",
                              color: "white",
                              borderRadius: "3px"
                            }}>
                              Plugin
                            </span>
                          )}
                          <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>
                            Priority: {result.priority}
                          </span>
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginLeft: "1.25rem" }}>
                          {result.message}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Clear Results Button */}
                <button
                  type="button"
                  onClick={() => setAiTestResult(null)}
                  style={{
                    marginTop: "0.75rem",
                    padding: "0.25rem 0.5rem",
                    fontSize: "0.75rem",
                    backgroundColor: "transparent",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "4px",
                    cursor: "pointer",
                    color: "var(--muted)"
                  }}
                >
                  Clear Results
                </button>
              </div>
            )}

            {/* Local / OpenAI-compatible LLM provider (issue #560) */}
            <LocalLLMSettings />

            {/* Help Text */}
            <div style={{
              padding: "0.75rem",
              backgroundColor: "var(--bg-elevated-softer)",
              borderRadius: "0.5rem",
              fontSize: "0.85rem",
              color: "var(--muted)"
            }}>
              <strong>How AI providers work:</strong>
              <ul style={{ margin: "0.5rem 0 0 1.5rem", padding: 0 }}>
                <li>Enabled providers are used in priority order (lower number = higher priority)</li>
                <li>For barcode lookups, the system tries each enabled provider until one succeeds</li>
                <li>API keys are stored securely and used to authenticate requests</li>
                <li>Disable providers you don't need to reduce unnecessary API calls</li>
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderPluginsTab = () => (
    <div className="admin-section">
      <h3>Plugin Management</h3>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
        Configure custom LLM plugins for AI-powered features like data tag parsing and barcode lookup.
      </p>

      {/* Network Discovery card */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        padding: '1rem 1.25rem',
        border: '1px solid var(--border-color, #e5e7eb)',
        borderRadius: '10px',
        background: 'var(--card-bg, #fff)',
        marginBottom: '1.5rem',
        gap: '1rem',
      }}>
        <div>
          <h4 style={{ margin: '0 0 0.25rem', fontWeight: 600 }}>🔍 Network Discovery</h4>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-secondary, #6b7280)' }}>
            Scan your local network to automatically discover and import connected devices
            (computers, cameras, IoT devices, routers) into your inventory.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowNetworkScan(true)}
          style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          Scan Network
        </button>
      </div>

      {/* Plugin system deprecation banner — always visible, non-dismissible */}
      <div className="info-banner" style={{ marginBottom: '1.25rem', display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
        <span style={{ flexShrink: 0 }}>⚠️</span>
        <div>
          <strong>The Plugin system is deprecated</strong> and will be removed in a future major release.
          The functionality originally provided by external plugins is now available through the
          built-in <strong>Category Agent</strong> and <strong>Gemini AI</strong> provider (Admin → AI Settings).
          Existing plugins will continue to function until removal — no action is required right now.
        </div>
      </div>

      {pluginsError && (
        <div className="error-message" style={{ marginBottom: '1rem' }}>
          {pluginsError}
        </div>
      )}

      {pluginFormError && (
        <div className="error-message" style={{ marginBottom: '1rem' }}>
          {pluginFormError}
        </div>
      )}

      {pluginFormSuccess && (
        <div className="success-message" style={{ marginBottom: '1rem' }}>
          {pluginFormSuccess}
        </div>
      )}

      {/* Add New Plugin Form */}
      {editingPlugin === 'new' && (
        <div className="panel" style={{ marginBottom: '1.5rem' }}>
          <div className="panel-header">
            <h4>Add New Plugin</h4>
          </div>
          <div className="panel-content">
            <div className="form-group">
              <label>Plugin Name *</label>
              <input
                type="text"
                value={pluginFormData.name || ''}
                onChange={(e) => setPluginFormData({ ...pluginFormData, name: e.target.value })}
                placeholder="e.g., Nestarr Custom LLM"
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                value={pluginFormData.description || ''}
                onChange={(e) => setPluginFormData({ ...pluginFormData, description: e.target.value })}
                placeholder="Description of what this plugin does"
                rows={2}
              />
            </div>

            <div className="form-group">
              <label>Endpoint URL *</label>
              <input
                type="text"
                value={pluginFormData.endpoint_url || ''}
                onChange={(e) => setPluginFormData({ ...pluginFormData, endpoint_url: e.target.value })}
                placeholder="http://192.168.1.100:8002 or http://container-name:8002"
              />
              <small className="help-text">
                Docker users: Use host machine IP (e.g., "http://192.168.1.100:8002") or container name. Do NOT use "localhost".<br />
                For Plugin-Nesventory-LLM: Ensure you're running the latest version for full AI scan support.
              </small>
            </div>

            <div className="form-group">
              <label>API Key (optional)</label>
              <input
                type="password"
                value={pluginFormData.api_key || ''}
                onChange={(e) => setPluginFormData({ ...pluginFormData, api_key: e.target.value })}
                placeholder="API key for authentication"
              />
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={pluginFormData.enabled !== false}
                  onChange={(e) => setPluginFormData({ ...pluginFormData, enabled: e.target.checked })}
                />
                {' '}Enabled
              </label>
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={pluginFormData.use_for_ai_scan || false}
                  onChange={(e) => setPluginFormData({ ...pluginFormData, use_for_ai_scan: e.target.checked })}
                />
                {' '}Use for AI Scan Operations
              </label>
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={pluginFormData.supports_image_processing ?? true}
                  onChange={(e) => setPluginFormData({ ...pluginFormData, supports_image_processing: e.target.checked })}
                />
                {' '}Supports Image Processing
              </label>
            </div>

            <div className="form-group">
              <label>Priority (lower = higher priority)</label>
              <input
                type="number"
                value={pluginFormData.priority || 100}
                onChange={(e) => setPluginFormData({ ...pluginFormData, priority: parseInt(e.target.value, 10) || 100 })}
                min={1}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                className="btn-primary"
                onClick={async () => {
                  setPluginFormError(null);
                  setPluginFormSuccess(null);
                  if (!pluginFormData.name || !pluginFormData.endpoint_url) {
                    setPluginFormError('Name and Endpoint URL are required');
                    return;
                  }
                  try {
                    await createPlugin(pluginFormData as PluginCreate);
                    setPluginFormSuccess('Plugin created successfully');
                    setEditingPlugin(null);
                    setPluginFormData({});
                    loadPlugins();
                  } catch (err) {
                    setPluginFormError(err instanceof Error ? err.message : 'Failed to create plugin');
                  }
                }}
              >
                Create Plugin
              </button>
              <button
                className="btn-outline"
                onClick={() => {
                  setEditingPlugin(null);
                  setPluginFormData({});
                  setPluginFormError(null);
                  setPluginFormSuccess(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Plugin Button */}
      {!editingPlugin && (
        <button
          className="btn-primary"
          onClick={() => {
            setEditingPlugin('new');
            setPluginFormData({ enabled: true, priority: 100 });
            setPluginFormError(null);
            setPluginFormSuccess(null);
          }}
          style={{ marginBottom: '1.5rem' }}
        >
          + Add Plugin
        </button>
      )}

      {/* Plugins List */}
      {pluginsLoading ? (
        <p>Loading plugins...</p>
      ) : plugins.length === 0 ? (
        <p style={{ color: 'var(--color-text-secondary)' }}>
          No plugins configured. Add a plugin to get started.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {plugins.map((plugin) => (
            <div key={plugin.id} className="panel">
              <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: 0 }}>{plugin.name}</h4>
                  {plugin.description && (
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
                      {plugin.description}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <span
                    style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '1rem',
                      fontSize: '0.85rem',
                      backgroundColor: plugin.enabled ? 'var(--color-success-bg, #d4edda)' : 'var(--color-warning-bg, #fff3cd)',
                      color: plugin.enabled ? 'var(--color-success, #155724)' : 'var(--color-warning, #856404)',
                    }}
                  >
                    {plugin.enabled ? '✓ Enabled' : '○ Disabled'}
                  </span>
                  {plugin.use_for_ai_scan && (
                    <span
                      style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '1rem',
                        fontSize: '0.85rem',
                        backgroundColor: 'var(--color-info-bg, #d1ecf1)',
                        color: 'var(--color-info, #0c5460)',
                      }}
                    >
                      🤖 AI Scan
                    </span>
                  )}
                  {plugin.supports_image_processing && (
                    <span
                      style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '1rem',
                        fontSize: '0.85rem',
                        backgroundColor: 'var(--color-info-bg, #e7f3ff)',
                        color: 'var(--color-info, #004085)',
                      }}
                    >
                      🖼️ Image Processing
                    </span>
                  )}
                </div>
              </div>
              <div className="panel-content">
                {editingPlugin === plugin.id ? (
                  <>
                    <div className="form-group">
                      <label>Plugin Name *</label>
                      <input
                        type="text"
                        value={pluginFormData.name || plugin.name}
                        onChange={(e) => setPluginFormData({ ...pluginFormData, name: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label>Description</label>
                      <textarea
                        value={pluginFormData.description ?? plugin.description ?? ''}
                        onChange={(e) => setPluginFormData({ ...pluginFormData, description: e.target.value })}
                        rows={2}
                      />
                    </div>

                    <div className="form-group">
                      <label>Endpoint URL *</label>
                      <input
                        type="text"
                        value={pluginFormData.endpoint_url || plugin.endpoint_url}
                        onChange={(e) => setPluginFormData({ ...pluginFormData, endpoint_url: e.target.value })}
                        placeholder="http://192.168.1.100:8002 or http://container-name:8002"
                      />
                      <small className="help-text">
                        Docker users: Use host machine IP (e.g., "http://192.168.1.100:8002") or container name. Do NOT use "localhost".<br />
                        For Plugin-Nesventory-LLM: Ensure you're running the latest version for full AI scan support.
                      </small>
                    </div>

                    <div className="form-group">
                      <label>API Key (leave blank to keep current)</label>
                      <input
                        type="password"
                        value={pluginFormData.api_key ?? ''}
                        onChange={(e) => setPluginFormData({ ...pluginFormData, api_key: e.target.value })}
                        placeholder="Enter new API key or leave blank"
                      />
                    </div>

                    <div className="form-group">
                      <label>
                        <input
                          type="checkbox"
                          checked={pluginFormData.enabled !== undefined ? pluginFormData.enabled : plugin.enabled}
                          onChange={(e) => setPluginFormData({ ...pluginFormData, enabled: e.target.checked })}
                        />
                        {' '}Enabled
                      </label>
                    </div>

                    <div className="form-group">
                      <label>
                        <input
                          type="checkbox"
                          checked={pluginFormData.use_for_ai_scan !== undefined ? pluginFormData.use_for_ai_scan : plugin.use_for_ai_scan}
                          onChange={(e) => setPluginFormData({ ...pluginFormData, use_for_ai_scan: e.target.checked })}
                        />
                        {' '}Use for AI Scan Operations
                      </label>
                    </div>

                    <div className="form-group">
                      <label>
                        <input
                          type="checkbox"
                          checked={pluginFormData.supports_image_processing !== undefined ? pluginFormData.supports_image_processing : plugin.supports_image_processing}
                          onChange={(e) => setPluginFormData({ ...pluginFormData, supports_image_processing: e.target.checked })}
                        />
                        {' '}Supports Image Processing
                      </label>
                    </div>

                    <div className="form-group">
                      <label>Priority</label>
                      <input
                        type="number"
                        value={pluginFormData.priority !== undefined ? pluginFormData.priority : plugin.priority}
                        onChange={(e) => setPluginFormData({ ...pluginFormData, priority: parseInt(e.target.value, 10) || 100 })}
                        min={1}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                      <button
                        className="btn-primary"
                        onClick={async () => {
                          setPluginFormError(null);
                          setPluginFormSuccess(null);
                          try {
                            const updateData: PluginUpdate = {};
                            if (pluginFormData.name !== undefined) updateData.name = pluginFormData.name;
                            if (pluginFormData.description !== undefined) updateData.description = pluginFormData.description;
                            if (pluginFormData.endpoint_url !== undefined) updateData.endpoint_url = pluginFormData.endpoint_url;
                            if (pluginFormData.api_key !== undefined && pluginFormData.api_key !== '') updateData.api_key = pluginFormData.api_key;
                            if (pluginFormData.enabled !== undefined) updateData.enabled = pluginFormData.enabled;
                            if (pluginFormData.use_for_ai_scan !== undefined) updateData.use_for_ai_scan = pluginFormData.use_for_ai_scan;
                            if (pluginFormData.priority !== undefined) updateData.priority = pluginFormData.priority;

                            await updatePlugin(plugin.id, updateData);
                            setPluginFormSuccess('Plugin updated successfully');
                            setEditingPlugin(null);
                            setPluginFormData({});
                            loadPlugins();
                          } catch (err) {
                            setPluginFormError(err instanceof Error ? err.message : 'Failed to update plugin');
                          }
                        }}
                      >
                        Save Changes
                      </button>
                      <button
                        className="btn-outline"
                        onClick={() => {
                          setEditingPlugin(null);
                          setPluginFormData({});
                          setPluginFormError(null);
                          setPluginFormSuccess(null);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.5rem 1rem', fontSize: '0.95rem' }}>
                      <strong>Endpoint:</strong>
                      <span style={{ wordBreak: 'break-all' }}>{plugin.endpoint_url}</span>
                      
                      <strong>API Key:</strong>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {plugin.api_key ? (
                          <>
                            <code style={{ flex: 1 }}>
                              {showPluginApiKey[plugin.id] ? plugin.api_key : '••••••••••••••••'}
                            </code>
                            <button
                              className="btn-outline"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                              onClick={() => setShowPluginApiKey({ ...showPluginApiKey, [plugin.id]: !showPluginApiKey[plugin.id] })}
                            >
                              {showPluginApiKey[plugin.id] ? '🙈 Hide' : '👁️ Show'}
                            </button>
                          </>
                        ) : (
                          <span style={{ color: 'var(--color-text-secondary)' }}>Not configured</span>
                        )}
                      </div>
                      
                      <strong>Priority:</strong>
                      <span>{plugin.priority}</span>
                      
                      <strong>Created:</strong>
                      <span>{new Date(plugin.created_at).toLocaleString()}</span>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                      <button
                        className="btn-outline"
                        onClick={() => {
                          setEditingPlugin(plugin.id);
                          setPluginFormData({});
                          setPluginFormError(null);
                          setPluginFormSuccess(null);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn-outline"
                        onClick={() => handleTestConnection(plugin.id)}
                        disabled={testingConnection[plugin.id]}
                      >
                        {testingConnection[plugin.id] ? '⏳ Testing...' : '🔌 Test Connection'}
                      </button>
                      <button
                        className="btn-outline"
                        style={{ color: 'var(--color-danger, #dc3545)' }}
                        onClick={async () => {
                          if (!confirm(`Are you sure you want to delete the plugin "${plugin.name}"?`)) return;
                          setPluginFormError(null);
                          setPluginFormSuccess(null);
                          try {
                            await deletePlugin(plugin.id);
                            setPluginFormSuccess('Plugin deleted successfully');
                            loadPlugins();
                          } catch (err) {
                            setPluginFormError(err instanceof Error ? err.message : 'Failed to delete plugin');
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>

                    {/* Display connection test result */}
                    {connectionTestResults[plugin.id] && (
                      <div 
                        style={{ 
                          marginTop: '1rem',
                          padding: '0.75rem',
                          borderRadius: '0.25rem',
                          backgroundColor: connectionTestResults[plugin.id]?.success 
                            ? 'var(--color-success-bg, #d4edda)' 
                            : 'var(--color-danger-bg, #f8d7da)',
                          color: connectionTestResults[plugin.id]?.success 
                            ? 'var(--color-success, #155724)' 
                            : 'var(--color-danger, #721c24)',
                          fontSize: '0.9rem'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '1.2rem' }}>
                            {connectionTestResults[plugin.id]?.success ? '✅' : '❌'}
                          </span>
                          <div>
                            <strong>
                              {connectionTestResults[plugin.id]?.success ? 'Connection Successful' : 'Connection Failed'}
                            </strong>
                            <div style={{ marginTop: '0.25rem' }}>
                              {connectionTestResults[plugin.id]?.message}
                              {connectionTestResults[plugin.id]?.status_code && (
                                <span> (HTTP {connectionTestResults[plugin.id]?.status_code})</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Category Agent Status Card ─────────────────────────────── */}
      <div className="panel" style={{ marginTop: '2rem' }}>
        <div className="panel-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h4 style={{ margin: 0 }}>🤖 Department 56 Category Agent</h4>
          <button
            type="button"
            className="btn-outline"
            onClick={loadCategoryAgentStatus}
            disabled={categoryAgentLoading}
            style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem' }}
          >
            {categoryAgentLoading ? 'Loading…' : '↻ Refresh'}
          </button>
        </div>
        <div className="panel-content">
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1rem', fontSize: '0.875rem' }}>
            Built-in machine-learning agent that predicts the Department 56 series for inventory items.
            It learns from user feedback over time.
          </p>

          {categoryAgentError && (
            <div className="error-message" style={{ marginBottom: '1rem' }}>
              {categoryAgentError}
            </div>
          )}

          {categoryAgentResetSuccess && (
            <div className="success-message" style={{ marginBottom: '1rem' }}>
              {categoryAgentResetSuccess}
            </div>
          )}

          {categoryAgentLoading && !categoryAgentStatus ? (
            <p style={{ color: 'var(--text-muted)' }}>Loading status…</p>
          ) : categoryAgentStatus ? (
            <div>
              {/* Key metrics row */}
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--color-primary, #6c63ff)' }}>
                    {categoryAgentStatus.training_samples.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Training Samples</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--color-primary, #6c63ff)' }}>
                    v{categoryAgentStatus.model_version}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Model Version</div>
                </div>
                {categoryAgentStatus.last_trained_at && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1rem', fontWeight: 600 }}>
                      {new Date(categoryAgentStatus.last_trained_at).toLocaleDateString(undefined, {
                        year: 'numeric', month: 'short', day: 'numeric',
                      })}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Last Trained</div>
                  </div>
                )}
              </div>

              {/* Series distribution */}
              {categoryAgentStatus.series_distribution &&
                Object.keys(categoryAgentStatus.series_distribution).length > 0 && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <h5 style={{ marginBottom: '0.6rem', fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Series Distribution
                    </h5>
                    {(() => {
                      const dist = categoryAgentStatus.series_distribution!;
                      const total = Object.values(dist).reduce((s, v) => s + v, 0) || 1;
                      return Object.entries(dist)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 12)
                        .map(([series, count]) => {
                          const pct = Math.round((count / total) * 100);
                          return (
                            <div key={series} style={{ marginBottom: '0.35rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.15rem' }}>
                                <span>{series}</span>
                                <span style={{ color: 'var(--text-muted)' }}>{count} ({pct}%)</span>
                              </div>
                              <div style={{ height: '6px', borderRadius: '3px', background: 'var(--border-color, #e0e0e0)', overflow: 'hidden' }}>
                                <div style={{
                                  height: '100%',
                                  width: `${pct}%`,
                                  borderRadius: '3px',
                                  background: 'var(--color-primary, #6c63ff)',
                                  transition: 'width 0.4s ease',
                                }} />
                              </div>
                            </div>
                          );
                        });
                    })()}
                  </div>
                )}

              {/* Reset button */}
              <div style={{ borderTop: '1px solid var(--border-color, #e0e0e0)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-outline btn-danger-outline"
                  onClick={handleResetCategoryAgent}
                  disabled={categoryAgentResetting}
                  style={{ fontSize: '0.85rem' }}
                >
                  {categoryAgentResetting ? 'Resetting…' : '🗑️ Reset Agent'}
                </button>
                <span style={{ marginLeft: '0.75rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Deletes all training data. Cannot be undone.
                </span>
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              No status available. The Category Agent may not be configured on the server.
            </p>
          )}
        </div>
      </div>
    </div>
  );

  const content = (
    <>
      {!embedded && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2>Admin Panel</h2>
          <button className="btn-outline" onClick={onClose}>
            Close
          </button>
        </div>
      )}
      {embedded && (
        <section className="panel">
          <div className="panel-header">
            <h2>Admin Panel</h2>
          </div>
        </section>
      )}
      
      {/* Main Tab Navigation */}
      <div className="tab-navigation" style={embedded ? { marginTop: "1rem" } : undefined}>
        <button
          type="button"
          className={`tab-button ${mainTab === 'users' ? 'active' : ''}`}
          onClick={() => handleMainTabChange('users')}
        >
          👥 User Admin
        </button>
        <button
          type="button"
          className={`tab-button ${mainTab === 'logs' ? 'active' : ''}`}
          onClick={() => handleMainTabChange('logs')}
        >
          📋 Log Settings
        </button>
        <button
          type="button"
          className={`tab-button ${mainTab === 'server' ? 'active' : ''}`}
          onClick={() => handleMainTabChange('server')}
        >
          ⚙️ Server Settings
        </button>
        <button
          type="button"
          className={`tab-button ${mainTab === 'ai-settings' ? 'active' : ''}`}
          onClick={() => handleMainTabChange('ai-settings')}
        >
          🤖 AI Settings
        </button>
        <button
          type="button"
          className={`tab-button ${mainTab === 'plugins' ? 'active' : ''}`}
          onClick={() => handleMainTabChange('plugins')}
        >
          🧩 Plugins
        </button>
        <button
          type="button"
          className={`tab-button ${mainTab === 'status' ? 'active' : ''}`}
          onClick={() => handleMainTabChange('status')}
        >
          🚦 Service Status
        </button>
        <button
          type="button"
          className={`tab-button ${mainTab === 'custom-fields' ? 'active' : ''}`}
          onClick={() => handleMainTabChange('custom-fields')}
        >
          📝 Custom Fields
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-panels">
        {mainTab === 'users' && renderUserAdminTab()}
        {mainTab === 'logs' && renderLogSettingsTab()}
        {mainTab === 'server' && renderServerSettingsTab()}
        {mainTab === 'ai-settings' && renderAISettingsTab()}
        {mainTab === 'plugins' && renderPluginsTab()}
        {mainTab === 'status' && renderStatusTab()}
        {mainTab === 'custom-fields' && renderCustomFieldsTab()}
      </div>
    </>
  );

  if (embedded) {
    return (
      <>
        <div>{content}</div>
        {showNetworkScan && (
          <NetworkDiscoveryWizard
            locations={locations}
            onComplete={() => setShowNetworkScan(false)}
            onSkip={() => setShowNetworkScan(false)}
          />
        )}
      </>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: "1100px", maxHeight: "90vh", overflowY: "auto" }}>
        {content}
      </div>
      {showNetworkScan && (
        <NetworkDiscoveryWizard
          locations={locations}
          onComplete={() => setShowNetworkScan(false)}
          onSkip={() => setShowNetworkScan(false)}
        />
      )}
    </div>
  );
};

export default AdminPage;
