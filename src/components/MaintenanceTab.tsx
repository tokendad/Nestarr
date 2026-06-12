import React, { useState, useEffect } from "react";
import type { MaintenanceTask, MaintenanceTaskCreate, MaintenanceRecord, MaintenanceRecordCreate } from "../lib/api";
import {
  fetchMaintenanceTasksForItem,
  createMaintenanceTask,
  updateMaintenanceTask,
  deleteMaintenanceTask,
  fetchRepairLog,
  createRepairRecord,
  updateRepairRecord,
  deleteRepairRecord,
} from "../lib/api";
import { formatDate } from "../lib/utils";

interface MaintenanceTabProps {
  itemId: string;
}

const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'One-time' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'bi_weekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'bi_monthly', label: 'Bi-monthly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'custom_days', label: 'Custom (days)' },
];

const DEFAULT_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
];

const MaintenanceTab: React.FC<MaintenanceTabProps> = ({ itemId }) => {
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formRecurrence, setFormRecurrence] = useState<MaintenanceTaskCreate['recurrence_type']>('none');
  const [formInterval, setFormInterval] = useState<number>(1);
  const [formColor, setFormColor] = useState(DEFAULT_COLORS[0]);

  useEffect(() => {
    loadTasks();
  }, [itemId]);

  const loadTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMaintenanceTasksForItem(itemId);
      setTasks(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load maintenance tasks');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormDueDate('');
    setFormRecurrence('none');
    setFormInterval(1);
    setFormColor(DEFAULT_COLORS[0]);
    setEditingTaskId(null);
  };

  const handleAdd = () => {
    setShowAddForm(true);
    resetForm();
  };

  const handleEdit = (task: MaintenanceTask) => {
    setEditingTaskId(task.id);
    setFormName(task.name);
    setFormDescription(task.description || '');
    setFormDueDate(task.next_due_date || '');
    setFormRecurrence(task.recurrence_type);
    setFormInterval(task.recurrence_interval || 1);
    setFormColor(task.color || DEFAULT_COLORS[0]);
    setShowAddForm(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      alert('Please enter a task name');
      return;
    }

    const taskData: MaintenanceTaskCreate = {
      item_id: itemId,
      name: formName.trim(),
      description: formDescription.trim() || null,
      next_due_date: formDueDate || null,
      recurrence_type: formRecurrence,
      recurrence_interval: formRecurrence === 'custom_days' ? formInterval : null,
      color: formColor,
      last_completed: null,
    };

    try {
      if (editingTaskId) {
        await updateMaintenanceTask(editingTaskId, taskData);
      } else {
        await createMaintenanceTask(taskData);
      }
      await loadTasks();
      resetForm();
      setShowAddForm(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save task');
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this maintenance task?')) {
      return;
    }

    try {
      await deleteMaintenanceTask(taskId);
      await loadTasks();
    } catch (err: any) {
      setError(err.message || 'Failed to delete task');
    }
  };

  const handleMarkComplete = async (task: MaintenanceTask) => {
    const today = new Date().toISOString().split('T')[0];
    
    const taskData: MaintenanceTaskCreate = {
      item_id: itemId,
      name: task.name,
      description: task.description,
      next_due_date: calculateNextDueDate(today, task.recurrence_type, task.recurrence_interval),
      recurrence_type: task.recurrence_type,
      recurrence_interval: task.recurrence_interval,
      color: task.color,
      last_completed: today,
    };

    try {
      await updateMaintenanceTask(task.id, taskData);
      await loadTasks();
    } catch (err: any) {
      setError(err.message || 'Failed to mark task as complete');
    }
  };

  const calculateNextDueDate = (
    fromDate: string,
    recurrence: MaintenanceTaskCreate['recurrence_type'],
    interval?: number | null
  ): string | null => {
    if (recurrence === 'none') return null;

    const date = new Date(fromDate);
    
    // Store original day for month/year calculations
    const originalDay = date.getDate();

    switch (recurrence) {
      case 'daily':
        date.setDate(date.getDate() + 1);
        break;
      case 'weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'bi_weekly':
        date.setDate(date.getDate() + 14);
        break;
      case 'monthly': {
        // Handle month boundaries properly
        const targetMonth = date.getMonth() + 1;
        date.setMonth(targetMonth);
        // Adjust if day doesn't exist in new month (e.g., Jan 31 -> Feb 28/29)
        if (date.getDate() < originalDay) {
          date.setDate(0); // Set to last day of previous month
        }
        break;
      }
      case 'bi_monthly': {
        // Handle month boundaries properly
        const targetMonth = date.getMonth() + 2;
        date.setMonth(targetMonth);
        // Adjust if day doesn't exist in new month
        if (date.getDate() < originalDay) {
          date.setDate(0); // Set to last day of previous month
        }
        break;
      }
      case 'yearly': {
        date.setFullYear(date.getFullYear() + 1);
        // Handle leap year edge case (Feb 29)
        if (date.getMonth() !== new Date(fromDate).getMonth()) {
          date.setDate(0); // Move to Feb 28
        }
        break;
      }
      case 'custom_days': {
        const days = interval && interval > 0 ? interval : 1;
        date.setDate(date.getDate() + days);
        break;
      }
    }

    return date.toISOString().split('T')[0];
  };

  if (loading) {
    return <div className="maintenance-tab loading">Loading maintenance tasks...</div>;
  }

  return (
    <div className="maintenance-tab">
      {error && <div className="error-banner">{error}</div>}

      <div className="maintenance-header">
        <h3>Maintenance Schedule</h3>
        {!showAddForm && (
          <button className="btn-primary" onClick={handleAdd}>
            + Add Task
          </button>
        )}
      </div>

      {showAddForm && (
        <div className="maintenance-form">
          <h4>{editingTaskId ? 'Edit Task' : 'Add New Task'}</h4>
          <div className="form-grid">
            <div className="form-field">
              <label>Task Name *</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Oil change, Filter replacement"
              />
            </div>

            <div className="form-field">
              <label>Description</label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Additional details about this task"
                rows={2}
              />
            </div>

            <div className="form-field">
              <label>Next Due Date</label>
              <input
                type="date"
                value={formDueDate}
                onChange={(e) => setFormDueDate(e.target.value)}
              />
            </div>

            <div className="form-field">
              <label>Recurrence</label>
              <select
                value={formRecurrence}
                onChange={(e) => setFormRecurrence(e.target.value as MaintenanceTaskCreate['recurrence_type'])}
              >
                {RECURRENCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {formRecurrence === 'custom_days' && (
              <div className="form-field">
                <label>Interval (days)</label>
                <input
                  type="number"
                  min="1"
                  value={formInterval}
                  onChange={(e) => setFormInterval(parseInt(e.target.value) || 1)}
                />
              </div>
            )}

            <div className="form-field">
              <label>Color</label>
              <div className="color-picker">
                {DEFAULT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`color-swatch ${formColor === color ? 'selected' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormColor(color)}
                    title={color}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button className="btn-outline" onClick={() => { resetForm(); setShowAddForm(false); }}>
              Cancel
            </button>
            <button className="btn-primary" onClick={handleSave}>
              {editingTaskId ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      )}

      <div className="maintenance-list">
        {tasks.length === 0 && !showAddForm && (
          <div className="empty-state">
            <p>No maintenance tasks scheduled for this item.</p>
            <p>Click "Add Task" to create a maintenance schedule.</p>
          </div>
        )}

        {tasks.map((task) => (
          <div key={task.id} className="maintenance-task" style={{ borderLeftColor: task.color }}>
            <div className="task-header">
              <div className="task-info">
                <h4>{task.name}</h4>
                {task.description && <p className="task-description">{task.description}</p>}
              </div>
              <div className="task-actions">
                <button
                  className="btn-icon"
                  onClick={() => handleMarkComplete(task)}
                  title="Mark as complete"
                >
                  ✓
                </button>
                <button
                  className="btn-icon"
                  onClick={() => handleEdit(task)}
                  title="Edit task"
                >
                  ✎
                </button>
                <button
                  className="btn-icon btn-danger"
                  onClick={() => handleDelete(task.id)}
                  title="Delete task"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="task-details">
              <div className="task-detail">
                <span className="detail-label">Recurrence:</span>
                <span className="detail-value">
                  {RECURRENCE_OPTIONS.find((o) => o.value === task.recurrence_type)?.label || task.recurrence_type}
                  {task.recurrence_type === 'custom_days' && task.recurrence_interval && (
                    <> ({task.recurrence_interval} days)</>
                  )}
                </span>
              </div>

              {task.next_due_date && (
                <div className="task-detail">
                  <span className="detail-label">Next Due:</span>
                  <span className="detail-value">{formatDate(task.next_due_date)}</span>
                </div>
              )}

              {task.last_completed && (
                <div className="task-detail">
                  <span className="detail-label">Last Completed:</span>
                  <span className="detail-value">{formatDate(task.last_completed)}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <RepairHistorySection itemId={itemId} />
    </div>
  );
};

const formatCost = (cost: number | string | null | undefined): string | null => {
  if (cost === null || cost === undefined || cost === '') return null;
  const num = typeof cost === 'string' ? parseFloat(cost) : cost;
  if (isNaN(num)) return null;
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};

interface RepairHistorySectionProps {
  itemId: string;
}

const RepairHistorySection: React.FC<RepairHistorySectionProps> = ({ itemId }) => {
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formDate, setFormDate] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formParts, setFormParts] = useState('');
  const [formCost, setFormCost] = useState('');

  useEffect(() => {
    loadRecords();
  }, [itemId]);

  const loadRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRepairLog(itemId);
      setRecords(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load repair history');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormDate('');
    setFormDescription('');
    setFormParts('');
    setFormCost('');
    setEditingRecordId(null);
  };

  const handleAdd = () => {
    resetForm();
    setFormDate(new Date().toISOString().split('T')[0]);
    setShowForm(true);
  };

  const handleEdit = (record: MaintenanceRecord) => {
    setEditingRecordId(record.id);
    setFormDate(record.date);
    setFormDescription(record.description);
    setFormParts(record.parts || '');
    setFormCost(record.cost !== null && record.cost !== undefined ? String(record.cost) : '');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formDescription.trim()) {
      alert('Please describe what was done');
      return;
    }
    if (!formDate) {
      alert('Please enter the repair date');
      return;
    }

    const costValue = formCost.trim() === '' ? null : parseFloat(formCost);
    if (costValue !== null && (isNaN(costValue) || costValue < 0)) {
      alert('Please enter a valid cost');
      return;
    }

    const recordData: MaintenanceRecordCreate = {
      item_id: itemId,
      date: formDate,
      description: formDescription.trim(),
      parts: formParts.trim() || null,
      cost: costValue,
    };

    try {
      if (editingRecordId) {
        await updateRepairRecord(editingRecordId, recordData);
      } else {
        await createRepairRecord(recordData);
      }
      await loadRecords();
      resetForm();
      setShowForm(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save repair record');
    }
  };

  const handleDelete = async (recordId: string) => {
    if (!confirm('Are you sure you want to delete this repair record?')) {
      return;
    }

    try {
      await deleteRepairRecord(recordId);
      await loadRecords();
    } catch (err: any) {
      setError(err.message || 'Failed to delete repair record');
    }
  };

  const totalCost = records.reduce((sum, r) => {
    const num = typeof r.cost === 'string' ? parseFloat(r.cost) : r.cost;
    return sum + (num && !isNaN(num) ? num : 0);
  }, 0);

  if (loading) {
    return <div className="repair-history loading">Loading repair history...</div>;
  }

  return (
    <div className="repair-history">
      {error && <div className="error-banner">{error}</div>}

      <div className="maintenance-header">
        <h3>
          Repair History
          {totalCost > 0 && (
            <span className="repair-total"> Total: {formatCost(totalCost)}</span>
          )}
        </h3>
        {!showForm && (
          <button className="btn-primary" onClick={handleAdd}>
            + Log Repair
          </button>
        )}
      </div>

      {showForm && (
        <div className="maintenance-form">
          <h4>{editingRecordId ? 'Edit Repair Record' : 'Log a Repair'}</h4>
          <div className="form-grid">
            <div className="form-field">
              <label>Date *</label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
              />
            </div>

            <div className="form-field">
              <label>What was done *</label>
              <input
                type="text"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="e.g., Oil change, brake pad replacement"
              />
            </div>

            <div className="form-field">
              <label>Parts Replaced</label>
              <textarea
                value={formParts}
                onChange={(e) => setFormParts(e.target.value)}
                placeholder="e.g., Fram PH3614 oil filter, Mobil 1 5W-30 5qt"
                rows={2}
              />
            </div>

            <div className="form-field">
              <label>Cost ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formCost}
                onChange={(e) => setFormCost(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="form-actions">
            <button className="btn-outline" onClick={() => { resetForm(); setShowForm(false); }}>
              Cancel
            </button>
            <button className="btn-primary" onClick={handleSave}>
              {editingRecordId ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      )}

      <div className="repair-list">
        {records.length === 0 && !showForm && (
          <div className="empty-state">
            <p>No repairs logged for this item.</p>
            <p>Click "Log Repair" to record work that was done.</p>
          </div>
        )}

        {records.map((record) => (
          <div key={record.id} className="repair-record">
            <div className="task-header">
              <div className="task-info">
                <div className="repair-record-top">
                  <span className="repair-date">{formatDate(record.date)}</span>
                  {formatCost(record.cost) && (
                    <span className="repair-cost">{formatCost(record.cost)}</span>
                  )}
                </div>
                <h4>{record.description}</h4>
                {record.parts && (
                  <p className="task-description">Parts: {record.parts}</p>
                )}
              </div>
              <div className="task-actions">
                <button
                  className="btn-icon"
                  onClick={() => handleEdit(record)}
                  title="Edit record"
                >
                  ✎
                </button>
                <button
                  className="btn-icon btn-danger"
                  onClick={() => handleDelete(record.id)}
                  title="Delete record"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MaintenanceTab;
