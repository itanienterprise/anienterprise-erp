import React, { useState, useEffect, useRef } from 'react';
import { DatabaseIcon, DownloadIcon, UploadIcon, RotateCcwIcon, TrashIcon, XIcon } from '../../Icons';
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

    // Modal state
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const [restoreTarget, setRestoreTarget] = useState(null); // { type: 'local' | 'uploaded', filename?: string }

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

    // We removed local auto-download polling loop from here as it is now globally handled in App.jsx.

    useEffect(() => {
        fetchSettingsAndFiles();
    }, []);

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

    const handleTakeBackup = async () => {
        setIsBackingUp(true);
        setErrorMessage('');
        setSuccessMessage('');
        try {
            const response = await axios.get(`${API_BASE_URL}/api/backup-database`);
            const backupObj = response.data;
            
            const dateStr = new Date().toISOString().slice(0, 10);
            const timeStr = new Date().toTimeString().slice(0, 8).replace(/:/g, '-');
            const filename = `ani_erp_backup_${dateStr}_${timeStr}.json`;

            const blob = new Blob([JSON.stringify(backupObj, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            setSuccessMessage(`Backup completed successfully! Saved as ${filename}`);
            if (addNotification) {
                addNotification('System Backup', 'Database backup downloaded successfully.', ['admin'], [], true);
            }
            // Refresh list of files in case of server side copies
            fetchSettingsAndFiles();
        } catch (error) {
            console.error('Backup error:', error);
            setErrorMessage(error.response?.data?.message || 'Error occurred while taking database backup.');
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

    const handleRestoreClick = (type, filename = '') => {
        setRestoreTarget({ type, filename });
        setConfirmText('');
        setShowConfirmModal(true);
    };

    const executeRestore = async () => {
        if (confirmText !== 'RESTORE') {
            setErrorMessage('Confirmation keyword mismatch. Please type "RESTORE" exactly.');
            return;
        }

        setIsRestoring(true);
        setShowConfirmModal(false);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            let response;
            if (restoreTarget.type === 'uploaded') {
                response = await axios.post(`${API_BASE_URL}/api/restore-database`, fileData);
            } else {
                response = await axios.post(`${API_BASE_URL}/api/backup-files/${restoreTarget.filename}/restore`);
            }

            if (response.data.success) {
                setSuccessMessage('Database restored successfully! Reloading page to apply changes...');
                if (addNotification) {
                    addNotification('System Restore', 'Database has been restored successfully.', ['admin'], [], true);
                }
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            } else {
                setErrorMessage(response.data.message || 'Failed to restore database.');
            }
        } catch (error) {
            console.error('Restore error:', error);
            setErrorMessage(error.response?.data?.message || 'Error occurred while restoring the database.');
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
                        Admin utility to configure automated schedules, download backups, or restore database states.
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
                {/* Take Backup Card */}
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all duration-300">
                    <div className="space-y-4">
                        <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                            <DownloadIcon className="w-6 h-6" />
                        </div>
                        <h2 className="text-lg font-bold text-gray-900">Take System Backup</h2>
                        <p className="text-sm text-gray-500 leading-relaxed">
                            Export the entire MongoDB state as a single JSON file. This includes all products, stocks, sales history, employee listings, bank transactions, and customer records.
                        </p>
                    </div>

                    <div className="mt-8">
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
                                    Backing up system...
                                </>
                            ) : (
                                <>
                                    <DownloadIcon className="w-5 h-5 mr-2" />
                                    Download System Backup
                                </>
                            )}
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
                            Upload a previously exported database JSON file. This will overwrite the current system collections.
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
                                        className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                                    >
                                        <XIcon className="w-4 h-4" />
                                    </button>
                                </div>

                                {fileData && fileData.data && (
                                    <div className="border-t border-gray-200 pt-3">
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Detected Collections</p>
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
                                    className="w-full mt-2 flex items-center justify-center px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium text-sm transition-all shadow-sm"
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
                                                className="w-full px-3 py-2 border border-dashed border-blue-300 bg-blue-50/20 hover:bg-blue-50 text-blue-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
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
                                className="w-full flex items-center justify-center px-4 py-3 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 text-white rounded-xl font-medium text-sm transition-all shadow-sm active:scale-[0.98]"
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
                                                className="text-blue-600 hover:text-blue-800 text-xs font-semibold hover:underline"
                                            >
                                                Download
                                            </button>
                                            <button
                                                onClick={() => handleRestoreClick('local', file.filename)}
                                                className="text-amber-600 hover:text-amber-800 text-xs font-semibold hover:underline"
                                            >
                                                Restore
                                            </button>
                                            <button
                                                onClick={() => handleDeleteFile(file.filename)}
                                                className="text-red-600 hover:text-red-800 text-xs font-semibold hover:underline"
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
                        Database restoration overwrites all current database records with the contents of the backup file. Any changes made to the system after the backup was taken will be lost. Ensure you have downloaded a current backup before restoring.
                    </p>
                </div>
            </div>

            {/* Confirm Restoring Modal */}
            {showConfirmModal && (
                <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setShowConfirmModal(false)}></div>
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl p-6 max-w-md w-full relative z-10 animate-in zoom-in duration-200">
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-900">Confirm System Restoration</h3>
                            <p className="text-sm text-gray-500 leading-relaxed">
                                {restoreTarget?.type === 'local' ? (
                                    <>
                                        Are you sure you want to restore the system state from the backup file <strong className="text-gray-900">{restoreTarget.filename}</strong>?
                                    </>
                                ) : (
                                    <>
                                        Are you sure you want to restore the system state from the uploaded file?
                                    </>
                                )}
                            </p>
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
                                    className="flex-1 px-4 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl font-medium text-sm transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={executeRestore}
                                    disabled={confirmText !== 'RESTORE'}
                                    className={`flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white rounded-xl font-medium text-sm transition-all ${
                                        confirmText !== 'RESTORE' ? 'cursor-not-allowed' : ''
                                    }`}
                                >
                                    Overwrite System Data
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BackupRestore;
