import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { DatabaseIcon, DownloadIcon, UploadIcon, RotateCcwIcon, TrashIcon, XIcon, SearchIcon, CheckIcon, BoxIcon } from '../../Icons';
import { API_BASE_URL } from '../../../utils/helpers';
import axios from '../../../utils/api';

const dbName = 'erp_backup_db';
const storeName = 'settings';

const getDirHandle = () => {
  return new Promise((resolve) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(storeName);
    };
    request.onsuccess = (e) => {
      const db = e.target.result;
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const getReq = store.get('directory_handle');
      getReq.onsuccess = () => resolve(getReq.result || null);
      getReq.onerror = () => resolve(null);
    };
    request.onerror = () => resolve(null);
  });
};

const saveDirHandle = (handle) => {
  return new Promise((resolve) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(storeName);
    };
    request.onsuccess = (e) => {
      const db = e.target.result;
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.put(handle, 'directory_handle');
      tx.oncomplete = () => resolve(true);
    };
    request.onerror = () => resolve(false);
  });
};

// Fallback modules list in case API fails or is loading
const FALLBACK_MODULES = [
  { key: 'pi', label: 'PI Management', description: 'Proforma Invoices & Packing Lists', models: ['PI', 'PackingList'], totalRecords: 0 },
  { key: 'ipManagement', label: 'IP Management', description: 'Import Permissions', models: ['IpRecord'], totalRecords: 0 },
  { key: 'lcManagement', label: 'LC Management', description: 'LCs, Gate Passes, LC Expenses & Margin Returns', models: ['LCManagement', 'LCGatePass', 'LCExpense', 'MarginReturn'], totalRecords: 0 },
  { key: 'sales', label: 'Sales', description: 'General & Border Sales records', models: ['Sale'], totalRecords: 0 },
  { key: 'purchase', label: 'Purchase & Receive', description: 'Purchases & Goods Receipts', models: ['Purchase', 'PurchaseReceive'], totalRecords: 0 },
  { key: 'stockWarehouse', label: 'Stock & Warehouses', description: 'Stock, Baselines, Warehouses & Damage records', models: ['Stock', 'StockBaseline', 'Warehouse', 'Damage'], totalRecords: 0 },
  { key: 'customer', label: 'Customers', description: 'Customer profiles & balances', models: ['Customer'], totalRecords: 0 },
  { key: 'supplier', label: 'Suppliers', description: 'Supplier directory & balances', models: ['Supplier'], totalRecords: 0 },
  { key: 'port', label: 'Ports', description: 'Ports of loading / discharge', models: ['Port'], totalRecords: 0 },
  { key: 'importerExporter', label: 'Importers & Exporters', description: 'Registered Importers & Exporters', models: ['Importer', 'Exporter'], totalRecords: 0 },
  { key: 'product', label: 'Products', description: 'Product catalog & categories', models: ['Product'], totalRecords: 0 },
  { key: 'bank', label: 'Banks', description: 'Bank accounts & configurations', models: ['Bank'], totalRecords: 0 },
  { key: 'cnf', label: 'C&F Management', description: 'C&F Agents & payment transactions', models: ['CnF', 'CnFPayment'], totalRecords: 0 },
  { key: 'insurance', label: 'Insurance', description: 'Insurance policies & payments', models: ['Insurance', 'InsurancePayment'], totalRecords: 0 },
  { key: 'costOfGoods', label: 'Cost of Goods', description: 'COG sheets & cost calculations', models: ['CostOfGoods'], totalRecords: 0 },
  { key: 'employees', label: 'HRMS & Users', description: 'Employees & system users', models: ['Employee', 'User'], totalRecords: 0 },
  { key: 'returns', label: 'Returns', description: 'Sales & purchase returns', models: ['Return'], totalRecords: 0 },
  { key: 'trSetup', label: 'TR Setup', description: 'TR setups & configurations', models: ['TRSetup'], totalRecords: 0 },
  { key: 'activityLogs', label: 'Activity & Notifications', description: 'Audit logs & notification history', models: ['ActivityLog', 'Notification'], totalRecords: 0 },
  { key: 'systemSettings', label: 'System Settings', description: 'Meta data & backup settings', models: ['MetaData', 'BackupSetting'], totalRecords: 0 }
];

const BackupRestore = ({ addNotification }) => {
    const [isBackingUp, setIsBackingUp] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [backupFile, setBackupFile] = useState(null);
    const [fileData, setFileData] = useState(null);
    
    // Auto backup settings state
    const [settings, setSettings] = useState({
        enabled: false,
        schedule: 'daily',
        time: '02:00',
        dayOfWeek: 0,
        dayOfMonth: 1,
        lastRun: null
    });
    const [isSavingSettings, setIsSavingSettings] = useState(false);

    // Local files state
    const [savedFiles, setSavedFiles] = useState([]);
    const [isLoadingFiles, setIsLoadingFiles] = useState(false);

    // Module-based backup state
    const [availableModules, setAvailableModules] = useState(FALLBACK_MODULES);
    const [isLoadingModules, setIsLoadingModules] = useState(false);
    const [showModuleModal, setShowModuleModal] = useState(false);
    const [selectedModuleKeys, setSelectedModuleKeys] = useState(new Set());
    const [moduleSearchQuery, setModuleSearchQuery] = useState('');

    // Restore Modal & Selective Restore state
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const [restoreTarget, setRestoreTarget] = useState(null); // { type: 'local' | 'uploaded', filename?: string }
    const [restoreDetectedCollections, setRestoreDetectedCollections] = useState({}); // { [modelName]: count }
    const [selectedRestoreModels, setSelectedRestoreModels] = useState(new Set());
    const [isLoadingRestorePreview, setIsLoadingRestorePreview] = useState(false);

    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const fileInputRef = useRef(null);

    const [autoDownload, setAutoDownload] = useState(() => {
        return localStorage.getItem('auto_download_backups') === 'true';
    });

    const [selectedFolderName, setSelectedFolderName] = useState('');

    useEffect(() => {
        getDirHandle().then(handle => {
            if (handle) {
                setSelectedFolderName(handle.name);
            }
        });
    }, []);

    useEffect(() => {
        localStorage.setItem('auto_download_backups', autoDownload);
    }, [autoDownload]);

    const handleToggleAutoDownload = async (checked) => {
        setAutoDownload(checked);
        if (checked) {
            try {
                const filesRes = await axios.get(`${API_BASE_URL}/api/backup-files`);
                const currentFiles = Array.isArray(filesRes.data) ? filesRes.data : [];
                const currentFilenames = currentFiles.map(f => f.filename);
                localStorage.setItem('downloaded_backup_files', JSON.stringify(currentFilenames));
            } catch (e) {
                console.error('Failed to initialize downloaded registry:', e);
            }
        }
    };

    const handleSelectFolder = async () => {
        try {
            if (!window.showDirectoryPicker) {
                alert('Your browser does not support local folder selection. Please use Google Chrome or Microsoft Edge.');
                return;
            }
            const handle = await window.showDirectoryPicker({
                mode: 'readwrite'
            });
            await saveDirHandle(handle);
            setSelectedFolderName(handle.name);
            if (addNotification) {
                addNotification('Backup Settings', `Folder "${handle.name}" selected for auto-downloads.`, ['admin'], [], true);
            }
        } catch (err) {
            console.error('Error selecting folder:', err);
        }
    };

    useEffect(() => {
        fetchSettingsAndFiles();
        fetchModules();
    }, []);

    const fetchModules = async () => {
        setIsLoadingModules(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/api/backup-modules`);
            if (res.data?.success && Array.isArray(res.data.modules)) {
                setAvailableModules(res.data.modules);
            }
        } catch (error) {
            console.error('Error fetching backup modules:', error);
        } finally {
            setIsLoadingModules(false);
        }
    };

    const fetchSettingsAndFiles = async () => {
        setIsLoadingFiles(true);
        try {
            const settingsRes = await axios.get(`${API_BASE_URL}/api/backup-settings`);
            if (settingsRes.data) {
                setSettings(settingsRes.data);
            }
            const filesRes = await axios.get(`${API_BASE_URL}/api/backup-files`);
            const files = Array.isArray(filesRes.data) ? filesRes.data : [];
            setSavedFiles(files);

            // Pre-populate registry on load if it does not exist
            if (!localStorage.getItem('downloaded_backup_files')) {
                const currentFilenames = files.map(f => f.filename);
                localStorage.setItem('downloaded_backup_files', JSON.stringify(currentFilenames));
            }
        } catch (error) {
            console.error('Error fetching backup configuration:', error);
        } finally {
            setIsLoadingFiles(false);
        }
    };

    // Full system backup download
    const handleTakeBackup = async () => {
        setIsBackingUp(true);
        setErrorMessage('');
        setSuccessMessage('');
        try {
            const response = await axios.get(`${API_BASE_URL}/api/backup-database`);
            const backupObj = response.data;
            
            const dateStr = new Date().toISOString().slice(0, 10);
            const timeStr = new Date().toTimeString().slice(0, 8).replace(/:/g, '-');
            const filename = `ani_erp_backup_full_${dateStr}_${timeStr}.json`;

            const blob = new Blob([JSON.stringify(backupObj, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            setSuccessMessage(`Full system backup completed successfully! Saved as ${filename}`);
            if (addNotification) {
                addNotification('System Backup', 'Full database backup downloaded successfully.', ['admin'], [], true);
            }
            fetchSettingsAndFiles();
        } catch (error) {
            console.error('Backup error:', error);
            setErrorMessage(error.response?.data?.message || 'Error occurred while taking database backup.');
        } finally {
            setIsBackingUp(false);
        }
    };

    // Module-based backup download
    const handleTakeModuleBackup = async () => {
        if (selectedModuleKeys.size === 0) {
            setErrorMessage('Please select at least one module to backup.');
            return;
        }

        setIsBackingUp(true);
        setErrorMessage('');
        setSuccessMessage('');
        try {
            const keysArray = Array.from(selectedModuleKeys);
            const modulesParam = keysArray.join(',');
            const response = await axios.get(`${API_BASE_URL}/api/backup-database?modules=${encodeURIComponent(modulesParam)}`);
            const backupObj = response.data;
            
            const dateStr = new Date().toISOString().slice(0, 10);
            const timeStr = new Date().toTimeString().slice(0, 8).replace(/:/g, '-');
            const moduleNameSuffix = keysArray.length === 1 ? keysArray[0] : `${keysArray.length}_modules`;
            const filename = `ani_erp_backup_${moduleNameSuffix}_${dateStr}_${timeStr}.json`;

            const blob = new Blob([JSON.stringify(backupObj, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            setShowModuleModal(false);
            setSuccessMessage(`Module backup completed successfully! Saved as ${filename}`);
            if (addNotification) {
                addNotification('System Backup', `Module backup (${keysArray.length} modules) downloaded successfully.`, ['admin'], [], true);
            }
            fetchSettingsAndFiles();
        } catch (error) {
            console.error('Module backup error:', error);
            setErrorMessage(error.response?.data?.message || 'Error occurred while taking module backup.');
        } finally {
            setIsBackingUp(false);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
            setErrorMessage('Invalid file type. Please upload a valid JSON backup file.');
            setBackupFile(null);
            setFileData(null);
            return;
        }

        setErrorMessage('');
        setSuccessMessage('');
        setBackupFile(file);

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target.result);
                if (!json.data || typeof json.data !== 'object') {
                    throw new Error('Invalid backup file structure. Missing "data" payload.');
                }
                setFileData(json);
            } catch (err) {
                setErrorMessage('Failed to parse backup file: ' + err.message);
                setBackupFile(null);
                setFileData(null);
            }
        };
        reader.readAsText(file);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) {
            handleFileChange({ target: { files: [file] } });
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    // Open selective restore modal for uploaded or saved file
    const handleRestoreClick = async (type, filename = '') => {
        setRestoreTarget({ type, filename });
        setConfirmText('');
        setErrorMessage('');
        setIsLoadingRestorePreview(true);
        setShowConfirmModal(true);

        try {
            if (type === 'uploaded') {
                if (fileData && fileData.data) {
                    const counts = {};
                    Object.keys(fileData.data).forEach(col => {
                        counts[col] = Array.isArray(fileData.data[col]) ? fileData.data[col].length : 0;
                    });
                    setRestoreDetectedCollections(counts);
                    setSelectedRestoreModels(new Set(Object.keys(counts)));
                } else {
                    setRestoreDetectedCollections({});
                    setSelectedRestoreModels(new Set());
                }
            } else {
                // Saved server file: fetch JSON to inspect its collections
                const res = await axios.get(`${API_BASE_URL}/api/backup-files/${filename}`);
                if (res.data?.data) {
                    const counts = {};
                    Object.keys(res.data.data).forEach(col => {
                        counts[col] = Array.isArray(res.data.data[col]) ? res.data.data[col].length : 0;
                    });
                    setRestoreDetectedCollections(counts);
                    setSelectedRestoreModels(new Set(Object.keys(counts)));
                } else {
                    setRestoreDetectedCollections({});
                    setSelectedRestoreModels(new Set());
                }
            }
        } catch (err) {
            console.error('Error inspecting backup file for restore:', err);
            setErrorMessage('Failed to inspect backup file details.');
        } finally {
            setIsLoadingRestorePreview(false);
        }
    };

    const toggleRestoreModel = (modelName) => {
        setSelectedRestoreModels(prev => {
            const next = new Set(prev);
            if (next.has(modelName)) {
                next.delete(modelName);
            } else {
                next.add(modelName);
            }
            return next;
        });
    };

    const toggleSelectAllRestoreModels = () => {
        const allKeys = Object.keys(restoreDetectedCollections);
        if (selectedRestoreModels.size === allKeys.length) {
            setSelectedRestoreModels(new Set());
        } else {
            setSelectedRestoreModels(new Set(allKeys));
        }
    };

    const executeRestore = async () => {
        if (confirmText !== 'RESTORE') {
            setErrorMessage('Confirmation keyword mismatch. Please type "RESTORE" exactly.');
            return;
        }

        if (selectedRestoreModels.size === 0) {
            setErrorMessage('Please select at least one collection to restore.');
            return;
        }

        setIsRestoring(true);
        setShowConfirmModal(false);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            let response;
            const modelsToRestore = Array.from(selectedRestoreModels);

            if (restoreTarget.type === 'uploaded') {
                if (!backupFile) {
                    setErrorMessage('Please select a backup file first.');
                    return;
                }
                const formData = new FormData();
                formData.append('backupFile', backupFile);
                formData.append('selectedModels', JSON.stringify(modelsToRestore));

                response = await axios.post(`${API_BASE_URL}/api/restore-database-upload`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    timeout: 600000
                });
            } else {
                response = await axios.post(`${API_BASE_URL}/api/backup-files/${restoreTarget.filename}/restore`, {
                    selectedModels: modelsToRestore
                }, {
                    timeout: 600000
                });
            }

            if (response.data.success) {
                setSuccessMessage(response.data.message || 'Database restored successfully! Reloading page to apply changes...');
                if (addNotification) {
                    addNotification('System Restore', `Restored ${modelsToRestore.length} collection(s) successfully.`, ['admin'], [], true);
                }
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            } else {
                setErrorMessage(response.data.message || 'Failed to restore database.');
            }
        } catch (error) {
            console.error('Restore error:', error);
            const serverMsg = error.response?.data?.message || (typeof error.response?.data === 'string' && !error.response.data.startsWith('<') ? error.response.data : '');
            setErrorMessage(serverMsg || error.message || 'Error occurred while restoring the database.');
        } finally {
            setIsRestoring(false);
        }
    };

    const handleDeleteFile = async (filename) => {
        if (!window.confirm(`Are you sure you want to delete backup file "${filename}" from the server?`)) return;
        
        setErrorMessage('');
        setSuccessMessage('');
        try {
            await axios.delete(`${API_BASE_URL}/api/backup-files/${filename}`);
            setSuccessMessage(`Backup file "${filename}" deleted successfully.`);
            fetchSettingsAndFiles();
        } catch (error) {
            console.error('Delete error:', error);
            setErrorMessage(error.response?.data?.message || 'Failed to delete backup file.');
        }
    };

    const handleDownloadSavedFile = async (filename) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/backup-files/${filename}`);
            const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download error:', error);
            setErrorMessage('Failed to download backup file.');
        }
    };

    const handleSaveSettings = async (e) => {
        e.preventDefault();
        setIsSavingSettings(true);
        setErrorMessage('');
        setSuccessMessage('');
        try {
            const payload = {
                ...settings,
                timezoneOffset: new Date().getTimezoneOffset()
            };
            const response = await axios.post(`${API_BASE_URL}/api/backup-settings`, payload);
            setSettings(response.data);
            setSuccessMessage('Auto-backup schedule saved successfully.');
            if (addNotification) {
                addNotification('Backup Settings', 'Auto-backup schedule updated successfully.', ['admin'], [], true);
            }
        } catch (error) {
            console.error('Settings save error:', error);
            setErrorMessage(error.response?.data?.message || 'Failed to save auto-backup settings.');
        } finally {
            setIsSavingSettings(false);
        }
    };

    const clearSelectedFile = () => {
        setBackupFile(null);
        setFileData(null);
        setErrorMessage('');
        setSuccessMessage('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Filter modules for custom backup modal
    const filteredModules = useMemo(() => {
        if (!moduleSearchQuery.trim()) return availableModules;
        const q = moduleSearchQuery.toLowerCase();
        return availableModules.filter(m =>
            m.label.toLowerCase().includes(q) ||
            m.description.toLowerCase().includes(q) ||
            (m.models && m.models.some(modelName => modelName.toLowerCase().includes(q)))
        );
    }, [availableModules, moduleSearchQuery]);

    const toggleModuleSelection = (key) => {
        setSelectedModuleKeys(prev => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    const toggleSelectAllModules = () => {
        if (selectedModuleKeys.size === availableModules.length) {
            setSelectedModuleKeys(new Set());
        } else {
            setSelectedModuleKeys(new Set(availableModules.map(m => m.key)));
        }
    };

    const totalSelectedRecords = useMemo(() => {
        return availableModules
            .filter(m => selectedModuleKeys.has(m.key))
            .reduce((sum, m) => sum + (m.totalRecords || 0), 0);
    }, [availableModules, selectedModuleKeys]);

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-gray-200">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center">
                        <DatabaseIcon className="w-7 h-7 text-blue-600 mr-2.5" />
                        Backup & Restore Database
                    </h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Admin utility to take full or module-based backups, restore specific modules, or configure automated schedules.
                    </p>
                </div>
            </div>

            {/* Error and Success Banners */}
            {errorMessage && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 animate-in slide-in-from-top duration-200">
                    <p className="font-semibold">Error</p>
                    <p className="mt-1">{errorMessage}</p>
                </div>
            )}
            {successMessage && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-600 animate-in slide-in-from-top duration-200">
                    <p className="font-semibold">Success</p>
                    <p className="mt-1">{successMessage}</p>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Take Backup Card (Full & Module Based) */}
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all duration-300">
                    <div className="space-y-4">
                        <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                            <DownloadIcon className="w-6 h-6" />
                        </div>
                        <h2 className="text-lg font-bold text-gray-900">Take System Backup</h2>
                        <p className="text-sm text-gray-500 leading-relaxed">
                            Export your ERP data as a structured JSON file. You can download the complete database or selectively export specific modules (PI, LC, Sales, Inventory, etc.).
                        </p>
                    </div>

                    <div className="mt-8 space-y-3">
                        <button
                            onClick={handleTakeBackup}
                            disabled={isBackingUp || isRestoring}
                            className={`w-full flex items-center justify-center px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-all shadow-sm active:scale-[0.98] ${
                                (isBackingUp || isRestoring) ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                        >
                            {isBackingUp ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Exporting data...
                                </>
                            ) : (
                                <>
                                    <DownloadIcon className="w-5 h-5 mr-2" />
                                    Download Full Backup
                                </>
                            )}
                        </button>

                        <button
                            onClick={() => {
                                setShowModuleModal(true);
                                fetchModules();
                            }}
                            disabled={isBackingUp || isRestoring}
                            className="w-full flex items-center justify-center px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl font-medium text-sm transition-all shadow-xs active:scale-[0.98] cursor-pointer"
                        >
                            <BoxIcon className="w-4 h-4 mr-2" />
                            Module-Based Backup...
                        </button>
                    </div>
                </div>

                {/* Upload & Restore Card */}
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all duration-300">
                    <div className="space-y-4">
                        <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                            <UploadIcon className="w-6 h-6" />
                        </div>
                        <h2 className="text-lg font-bold text-gray-900">Upload & Restore</h2>
                        <p className="text-sm text-gray-500 leading-relaxed">
                            Upload a previously exported database or module JSON file. You can choose to restore all or only selected collections.
                        </p>
                    </div>

                    <div className="mt-6 flex-1 flex flex-col justify-end">
                        {!backupFile ? (
                            <div
                                onDrop={handleDrop}
                                onDragOver={handleDragOver}
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/20 transition-all duration-200"
                            >
                                <UploadIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                                <p className="text-xs font-semibold text-gray-700">Click to upload or drag & drop</p>
                                <p className="text-[11px] text-gray-500 mt-1">JSON Backup Files Only</p>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    accept=".json"
                                    className="hidden"
                                />
                            </div>
                        ) : (
                            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
                                <div className="flex items-start justify-between">
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-gray-900 truncate">{backupFile.name}</p>
                                        <p className="text-[10px] text-gray-500 mt-0.5">{(backupFile.size / 1024).toFixed(2)} KB</p>
                                    </div>
                                    <button
                                        onClick={clearSelectedFile}
                                        className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 cursor-pointer"
                                    >
                                        <XIcon className="w-4 h-4" />
                                    </button>
                                </div>

                                {fileData && fileData.data && (
                                    <div className="border-t border-gray-200 pt-3">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Detected Collections</p>
                                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                                {Object.keys(fileData.data).length} total
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 max-h-24 overflow-y-auto pr-1">
                                            {Object.keys(fileData.data).map((col) => (
                                                <div key={col} className="flex justify-between items-center text-xs py-0.5 border-b border-gray-100">
                                                    <span className="text-gray-600 truncate">{col}</span>
                                                    <span className="font-semibold text-gray-900">{fileData.data[col]?.length || 0}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <button
                                    onClick={() => handleRestoreClick('uploaded')}
                                    disabled={isBackingUp || isRestoring}
                                    className="w-full mt-2 flex items-center justify-center px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium text-sm transition-all shadow-sm cursor-pointer"
                                >
                                    <RotateCcwIcon className="w-4 h-4 mr-2" />
                                    Restore Database...
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Auto-Backup Settings Card */}
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300">
                    <form onSubmit={handleSaveSettings} className="space-y-4 flex flex-col h-full justify-between">
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold text-gray-900">Auto-Backup Schedule</h2>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.enabled}
                                        onChange={(e) => setSettings(prev => ({ ...prev, enabled: e.target.checked }))}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                            </div>
                            <p className="text-sm text-gray-500 leading-relaxed mb-4">
                                Automatically save a backup of the system database to the server at a scheduled interval.
                            </p>

                             {settings.enabled && (
                                <div className="mb-4 space-y-3">
                                    <div className="flex items-center justify-between p-3 bg-blue-50/50 border border-blue-100 rounded-xl">
                                        <span className="text-xs font-bold text-blue-900">Auto-Download to Browser</span>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={autoDownload}
                                                onChange={(e) => handleToggleAutoDownload(e.target.checked)}
                                                className="sr-only peer"
                                            />
                                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                        </label>
                                    </div>
                                    {autoDownload && (
                                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                                            <span className="text-xs font-bold text-slate-700">Auto-Download Local Directory</span>
                                            <button
                                                type="button"
                                                onClick={handleSelectFolder}
                                                className="w-full px-3 py-2 border border-dashed border-blue-300 bg-blue-50/20 hover:bg-blue-50 text-blue-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9l-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                </svg>
                                                {selectedFolderName ? `Change (Target: ${selectedFolderName})` : 'Select Target Local Folder...'}
                                            </button>
                                            <p className="text-[10px] text-gray-400">Backups will save directly to this folder silently.</p>
                                            {!window.showDirectoryPicker && (
                                                 <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[10px] text-amber-700 space-y-1 mt-2">
                                                     <p className="font-bold">Folder selection requires a Secure Context (HTTPS or localhost).</p>
                                                     <p>If you are accessing the ERP via an IP address (e.g. 192.168.x.x), you can enable it in Chrome/Edge:</p>
                                                     <ol className="list-decimal list-inside space-y-0.5 ml-1">
                                                         <li>Go to: <code className="bg-amber-100 px-1 rounded font-mono select-all text-[9px]">chrome://flags/#unsafely-treat-insecure-origin-as-secure</code></li>
                                                         <li>Enable the flag and add your address (e.g. <code className="bg-amber-100 px-1 rounded font-mono text-[9px]">http://192.168.1.100:3000</code>) to the text box.</li>
                                                         <li>Relaunch the browser.</li>
                                                     </ol>
                                                 </div>
                                             )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {settings.enabled && (
                                <div className="space-y-4">
                                    {/* Interval */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Backup Interval</label>
                                        <select
                                            value={settings.schedule}
                                            onChange={(e) => setSettings(prev => ({ ...prev, schedule: e.target.value }))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="daily">Everyday (Daily)</option>
                                            <option value="weekly">Weekly</option>
                                            <option value="monthly">Monthly</option>
                                        </select>
                                    </div>

                                    {/* Day of Week for Weekly */}
                                    {settings.schedule === 'weekly' && (
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Day of Week</label>
                                            <select
                                                value={settings.dayOfWeek}
                                                onChange={(e) => setSettings(prev => ({ ...prev, dayOfWeek: parseInt(e.target.value) }))}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value="0">Sunday</option>
                                                <option value="1">Monday</option>
                                                <option value="2">Tuesday</option>
                                                <option value="3">Wednesday</option>
                                                <option value="4">Thursday</option>
                                                <option value="5">Friday</option>
                                                <option value="6">Saturday</option>
                                            </select>
                                        </div>
                                    )}

                                    {/* Day of Month for Monthly */}
                                    {settings.schedule === 'monthly' && (
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Day of Month</label>
                                            <select
                                                value={settings.dayOfMonth}
                                                onChange={(e) => setSettings(prev => ({ ...prev, dayOfMonth: parseInt(e.target.value) }))}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                                                    <option key={day} value={day}>{day}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {/* Time */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Time (HH:MM)</label>
                                        <input
                                            type="time"
                                            value={settings.time}
                                            onChange={(e) => setSettings(prev => ({ ...prev, time: e.target.value }))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>

                                    {settings.lastRun && (
                                        <p className="text-[11px] text-gray-500 italic mt-2">
                                            Last run: {new Date(settings.lastRun).toLocaleString()}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="mt-8">
                            <button
                                type="submit"
                                disabled={isSavingSettings}
                                className="w-full flex items-center justify-center px-4 py-3 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 text-white rounded-xl font-medium text-sm transition-all shadow-sm active:scale-[0.98] cursor-pointer"
                            >
                                {isSavingSettings ? 'Saving Settings...' : 'Save Schedule Settings'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Saved Backups on Server */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Saved Auto Backups on Server</h2>
                        <p className="text-xs text-gray-500 mt-0.5">List of automatically or locally scheduled backup files saved on the server container. The system keeps the 10 most recent backups.</p>
                    </div>
                </div>

                <div className="mt-4 overflow-x-auto">
                    {isLoadingFiles ? (
                        <div className="py-8 text-center text-gray-500 text-sm">Loading saved backup files...</div>
                    ) : savedFiles.length === 0 ? (
                        <div className="py-8 text-center text-gray-400 text-sm">No backup files found on the server.</div>
                    ) : (
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left font-bold text-gray-700 uppercase tracking-wider text-xs">File Name</th>
                                    <th className="px-4 py-3 text-left font-bold text-gray-700 uppercase tracking-wider text-xs">Size</th>
                                    <th className="px-4 py-3 text-left font-bold text-gray-700 uppercase tracking-wider text-xs">Created Date</th>
                                    <th className="px-4 py-3 text-right font-bold text-gray-700 uppercase tracking-wider text-xs">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {savedFiles.map((file) => (
                                    <tr key={file.filename} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3 font-semibold text-gray-900 truncate max-w-xs">{file.filename}</td>
                                        <td className="px-4 py-3 text-gray-600">{(file.size / 1024).toFixed(2)} KB</td>
                                        <td className="px-4 py-3 text-gray-500">{new Date(file.createdAt).toLocaleString()}</td>
                                        <td className="px-4 py-3 text-right space-x-2.5">
                                            <button
                                                onClick={() => handleDownloadSavedFile(file.filename)}
                                                className="text-blue-600 hover:text-blue-800 text-xs font-semibold hover:underline cursor-pointer"
                                            >
                                                Download
                                            </button>
                                            <button
                                                onClick={() => handleRestoreClick('local', file.filename)}
                                                className="text-amber-600 hover:text-amber-800 text-xs font-semibold hover:underline cursor-pointer"
                                            >
                                                Restore...
                                            </button>
                                            <button
                                                onClick={() => handleDeleteFile(file.filename)}
                                                className="text-red-600 hover:text-red-800 text-xs font-semibold hover:underline cursor-pointer"
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Warn Alert Box */}
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start space-x-3">
                <span className="text-amber-500 text-lg mt-0.5 font-bold">⚠️</span>
                <div>
                    <h3 className="text-sm font-bold text-amber-900">Warning: Proceed with Extreme Caution</h3>
                    <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                        Database restoration overwrites the records of the selected collections with the contents of the backup file. Any changes made to those collections after the backup was created will be permanently replaced. Ensure you have a recent full backup before performing any restoration.
                    </p>
                </div>
            </div>

            {/* Module-Based Backup Selection Modal */}
            {showModuleModal && typeof document !== 'undefined' && document.body && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setShowModuleModal(false)}></div>
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl p-6 max-w-2xl w-full relative z-10 animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                                    <BoxIcon className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">Module-Based Backup</h3>
                                    <p className="text-xs text-gray-500">Select which business modules to include in your backup file.</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowModuleModal(false)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                            >
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Search & Quick Toggles */}
                        <div className="py-3.5 space-y-2.5 border-b border-gray-100">
                            <div className="relative">
                                <SearchIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Search modules or collections..."
                                    value={moduleSearchQuery}
                                    onChange={(e) => setModuleSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div className="flex items-center justify-between text-xs">
                                <span className="text-gray-500 font-medium">
                                    <strong className="text-blue-600 font-bold">{selectedModuleKeys.size}</strong> of {availableModules.length} modules selected ({totalSelectedRecords.toLocaleString()} records)
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={toggleSelectAllModules}
                                        className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                                    >
                                        {selectedModuleKeys.size === availableModules.length ? 'Deselect All' : 'Select All'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Module Grid List */}
                        <div className="flex-1 overflow-y-auto py-3 space-y-2 pr-1">
                            {isLoadingModules ? (
                                <div className="py-12 text-center text-gray-400 text-sm">Loading module information...</div>
                            ) : filteredModules.length === 0 ? (
                                <div className="py-12 text-center text-gray-400 text-sm">No matching modules found.</div>
                            ) : (
                                filteredModules.map((mod) => {
                                    const isSelected = selectedModuleKeys.has(mod.key);
                                    return (
                                        <div
                                            key={mod.key}
                                            onClick={() => toggleModuleSelection(mod.key)}
                                            className={`p-3 rounded-xl border transition-all cursor-pointer select-none flex items-center justify-between gap-3 ${
                                                isSelected
                                                    ? 'bg-blue-50/50 border-blue-300 ring-1 ring-blue-100'
                                                    : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
                                            }`}
                                        >
                                            <div className="flex items-start gap-3 min-w-0">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => {}} // Handled by outer container click
                                                    className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer pointer-events-none"
                                                />
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-bold text-gray-900 truncate">{mod.label}</span>
                                                        <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                                                            {mod.models?.join(', ')}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 mt-0.5 truncate">{mod.description}</p>
                                                </div>
                                            </div>

                                            <div className="shrink-0 text-right">
                                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                                                    isSelected ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                    {(mod.totalRecords || 0).toLocaleString()} records
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
                            <button
                                type="button"
                                onClick={() => setShowModuleModal(false)}
                                className="px-4 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl font-medium text-sm transition-all cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleTakeModuleBackup}
                                disabled={selectedModuleKeys.size === 0 || isBackingUp}
                                className="flex items-center justify-center px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-xl font-medium text-sm transition-all shadow-sm active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed"
                            >
                                {isBackingUp ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Generating Backup...
                                    </>
                                ) : (
                                    <>
                                        <DownloadIcon className="w-4 h-4 mr-2" />
                                        Download Backup ({selectedModuleKeys.size} {selectedModuleKeys.size === 1 ? 'module' : 'modules'})
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Confirm Restoring Modal with Selective Module Choice */}
            {showConfirmModal && typeof document !== 'undefined' && document.body && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setShowConfirmModal(false)}></div>
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl p-6 max-w-lg w-full relative z-10 animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                        <div className="space-y-4 flex-1 overflow-y-auto pr-1">
                            <div className="flex items-start justify-between">
                                <h3 className="text-lg font-bold text-gray-900">Confirm System Restoration</h3>
                                <button onClick={() => setShowConfirmModal(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                                    <XIcon className="w-5 h-5" />
                                </button>
                            </div>

                            <p className="text-sm text-gray-500 leading-relaxed">
                                {restoreTarget?.type === 'local' ? (
                                    <>
                                        Restoring from server file <strong className="text-gray-900">{restoreTarget.filename}</strong>.
                                    </>
                                ) : (
                                    <>
                                        Restoring from uploaded file <strong className="text-gray-900">{backupFile?.name}</strong>.
                                    </>
                                )}
                            </p>

                            {/* Selective Collections to Restore */}
                            <div className="border border-gray-200 rounded-xl p-3 bg-gray-50/50 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                                        Select Collections to Restore ({selectedRestoreModels.size} of {Object.keys(restoreDetectedCollections).length})
                                    </span>
                                    {Object.keys(restoreDetectedCollections).length > 0 && (
                                        <button
                                            type="button"
                                            onClick={toggleSelectAllRestoreModels}
                                            className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer"
                                        >
                                            {selectedRestoreModels.size === Object.keys(restoreDetectedCollections).length ? 'Deselect All' : 'Select All'}
                                        </button>
                                    )}
                                </div>

                                {isLoadingRestorePreview ? (
                                    <div className="py-4 text-center text-xs text-gray-400">Inspecting backup file...</div>
                                ) : Object.keys(restoreDetectedCollections).length === 0 ? (
                                    <div className="py-3 text-center text-xs text-gray-400">No collections detected in this backup.</div>
                                ) : (
                                    <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                                        {Object.entries(restoreDetectedCollections).map(([col, count]) => {
                                            const isChecked = selectedRestoreModels.has(col);
                                            return (
                                                <label
                                                    key={col}
                                                    className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer select-none transition-colors ${
                                                        isChecked ? 'bg-white border-blue-200 shadow-2xs' : 'bg-gray-100/50 border-gray-200 opacity-60'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={() => toggleRestoreModel(col)}
                                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                        />
                                                        <span className="font-semibold text-gray-900 truncate">{col}</span>
                                                    </div>
                                                    <span className="text-gray-500 font-medium shrink-0">{count} records</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
                                <p className="font-bold">Notice:</p>
                                <p>Only the <strong>{selectedRestoreModels.size} selected collection(s)</strong> will be overwritten in the database. Any collections left unchecked will remain intact.</p>
                            </div>

                            <p className="text-sm text-gray-500 leading-relaxed">
                                To confirm, please type <strong className="text-red-600 select-all">RESTORE</strong> in the input field below.
                            </p>
                            <input
                                type="text"
                                placeholder="Type RESTORE to confirm"
                                value={confirmText}
                                onChange={(e) => setConfirmText(e.target.value)}
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                            />
                            <div className="flex space-x-3 pt-2">
                                <button
                                    onClick={() => setShowConfirmModal(false)}
                                    className="flex-1 px-4 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl font-medium text-sm transition-all cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={executeRestore}
                                    disabled={confirmText !== 'RESTORE' || selectedRestoreModels.size === 0}
                                    className={`flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white rounded-xl font-medium text-sm transition-all cursor-pointer ${
                                        confirmText !== 'RESTORE' || selectedRestoreModels.size === 0 ? 'cursor-not-allowed' : ''
                                    }`}
                                >
                                    Overwrite Selected Data ({selectedRestoreModels.size})
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default BackupRestore;
