import React, { useState, useEffect, useRef } from 'react';
import { ShieldIcon, CheckIcon, XIcon, PlusIcon } from '../../Icons';
import { API_BASE_URL } from '../../../utils/helpers';
import axios from '../../../utils/api';
import { MODULES_LIST, getDefaultPermissionsForRole } from '../../../utils/permissionHelper';

const RoleCreation = ({ setCurrentUser }) => {
    // Custom confirm modal state
    const [confirmModal, setConfirmModal] = useState(null); // { title: '', message: '', onConfirm: () => {}, type: 'danger' | 'warning' }
    const [alertMsg, setAlertMsg] = useState(null); // { type: 'success' | 'error', text: '' }

    // Dynamic Custom Roles State
    const [customRoles, setCustomRoles] = useState([]);
    const [newRoleName, setNewRoleName] = useState('');
    const [isCreatingRole, setIsCreatingRole] = useState(false);
    
    const [selectedCustomRole, setSelectedCustomRole] = useState(null);
    const [selectedStaticRole, setSelectedStaticRole] = useState(null);
    const [permissions, setPermissions] = useState({});
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchCustomRoles();
    }, []);

    const fetchCustomRoles = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/metadata?category=roles`);
            if (response.data) {
                setCustomRoles(response.data);
            }
        } catch (error) {
            console.error('Error fetching custom roles:', error);
        }
    };

    const selectCustomRoleForEditing = (cr) => {
        setSelectedCustomRole(cr);
        setSelectedStaticRole(null);
        setPermissions(cr.permissions || getDefaultPermissionsForRole('General Staff'));
        setAlertMsg(null);
    };

    const selectStaticRoleForEditing = (rName) => {
        setSelectedStaticRole(rName);
        setSelectedCustomRole(null);
        
        // Load custom override if exists, else static defaults
        const override = customRoles.find(cr => cr.name === rName);
        if (override) {
            setPermissions(override.permissions);
        } else {
            setPermissions(getDefaultPermissionsForRole(rName));
        }
        setAlertMsg(null);
    };

    const handleCreateRole = async (e) => {
        e.preventDefault();
        if (!newRoleName.trim()) return;

        setIsCreatingRole(true);
        setAlertMsg(null);

        try {
            // Determine default permissions for the new role: 
            // uses currently active matrix or standard General Staff defaults
            const templatePermissions = permissions && Object.keys(permissions).length > 0 
                ? permissions 
                : getDefaultPermissionsForRole('General Staff');

            const payload = {
                category: 'roles',
                name: newRoleName.trim(),
                permissions: templatePermissions
            };

            const response = await axios.post(`${API_BASE_URL}/api/metadata`, payload);
            if (response.data) {
                setCustomRoles(prev => [...prev, response.data]);
                setNewRoleName('');
                setAlertMsg({ type: 'success', text: `Custom role "${payload.name}" created successfully!` });
            }
        } catch (error) {
            console.error('Error creating custom role:', error);
            setAlertMsg({ 
                type: 'error', 
                text: error.response?.data?.message || 'Failed to create custom role. Please try again.' 
            });
        } finally {
            setIsCreatingRole(false);
        }
    };

    const handleDeleteRole = (roleId, roleName) => {
        setConfirmModal({
            title: 'Delete Custom Role?',
            message: `Are you sure you want to delete the custom role "${roleName}"? Employees currently assigned to this role will keep their current permissions, but this role option will be removed.`,
            type: 'danger',
            onConfirm: async () => {
                setAlertMsg(null);
                try {
                    await axios.delete(`${API_BASE_URL}/api/metadata/${roleId}`);
                    setCustomRoles(prev => prev.filter(r => r._id !== roleId));
                    if (selectedCustomRole?._id === roleId) {
                        setSelectedCustomRole(null);
                        setPermissions({});
                    }
                    setAlertMsg({ type: 'success', text: `Custom role "${roleName}" deleted successfully.` });
                } catch (error) {
                    console.error('Error deleting role:', error);
                    setAlertMsg({ type: 'error', text: 'Failed to delete custom role.' });
                }
            }
        });
    };

    const handlePermissionChange = (moduleKey, action) => {
        setPermissions(prev => {
            const modulePerms = prev[moduleKey] || { view: false, add: false, edit: false, delete: false, special: false };
            return {
                ...prev,
                [moduleKey]: {
                    ...modulePerms,
                    [action]: !modulePerms[action]
                }
            };
        });
    };

    const handleToggleAllModulePermissions = (moduleKey) => {
        const mod = MODULES_LIST.find(m => m.key === moduleKey);
        setPermissions(prev => {
            const modulePerms = prev[moduleKey] || { view: false, add: false, edit: false, delete: false, special: false };
            const anyChecked = Object.values(modulePerms).some(v => v);
            const newValue = !anyChecked;
            
            const updatedPerms = {
                view: newValue,
                add: newValue,
                edit: newValue,
                delete: newValue,
                special: newValue
            };

            if (mod && mod.specialLabels) {
                mod.specialLabels.forEach(sItem => {
                    updatedPerms[sItem.key] = newValue;
                });
            }

            return {
                ...prev,
                [moduleKey]: updatedPerms
            };
        });
    };

    const handleSaveAccess = async () => {
        setIsSaving(true);
        setAlertMsg(null);

        try {
            if (selectedCustomRole) {
                // Save updated custom role permissions to the DB
                const payload = {
                    category: 'roles',
                    name: selectedCustomRole.name,
                    permissions
                };
                const response = await axios.put(`${API_BASE_URL}/api/metadata/${selectedCustomRole._id}`, payload);
                if (response.data) {
                    setCustomRoles(prev => prev.map(r => r._id === selectedCustomRole._id ? response.data : r));
                    setSelectedCustomRole(null);
                    setPermissions({});
                    setAlertMsg({ type: 'success', text: `Default permissions for custom role "${payload.name}" saved successfully!` });
                    // Refresh session so sidebar updates immediately
                    try {
                        const sessionResp = await axios.get(`${API_BASE_URL}/api/auth/check`);
                        if (sessionResp.data?.authenticated && sessionResp.data?.user) {
                            const freshUser = sessionResp.data.user;
                            localStorage.setItem('currentUser', JSON.stringify(freshUser));
                            if (setCurrentUser) setCurrentUser(freshUser);
                        }
                    } catch (e) { /* non-critical */ }
                }
            } else if (selectedStaticRole) {
                // Save overridden default permissions for a system/static role
                const existingOverride = customRoles.find(cr => cr.name === selectedStaticRole);
                const payload = {
                    category: 'roles',
                    name: selectedStaticRole,
                    permissions
                };
                
                let response;
                if (existingOverride) {
                    response = await axios.put(`${API_BASE_URL}/api/metadata/${existingOverride._id}`, payload);
                } else {
                    response = await axios.post(`${API_BASE_URL}/api/metadata`, payload);
                }

                if (response.data) {
                    if (existingOverride) {
                        setCustomRoles(prev => prev.map(r => r._id === existingOverride._id ? response.data : r));
                    } else {
                        setCustomRoles(prev => [...prev, response.data]);
                    }
                    setSelectedStaticRole(null);
                    setPermissions({});
                    setAlertMsg({ type: 'success', text: `Default permissions for system role "${selectedStaticRole}" saved successfully!` });
                    // Refresh session so sidebar updates immediately
                    try {
                        const sessionResp = await axios.get(`${API_BASE_URL}/api/auth/check`);
                        if (sessionResp.data?.authenticated && sessionResp.data?.user) {
                            const freshUser = sessionResp.data.user;
                            localStorage.setItem('currentUser', JSON.stringify(freshUser));
                            if (setCurrentUser) setCurrentUser(freshUser);
                        }
                    } catch (e) { /* non-critical */ }
                }
            }
        } catch (error) {
            console.error('Error saving role permissions:', error);
            setAlertMsg({ 
                type: 'error', 
                text: error.response?.data?.message || 'Failed to save configuration. Please try again.' 
            });
        } finally {
            setIsSaving(false);
        }
    };

    const staticRolesList = ['Admin', 'Incharge', 'LC Manager', 'Sales Manager', 'Accounts Manager', 'Border Manager', 'Data Entry', 'General Staff'];

    return (
        <div className="flex-1 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent font-sans">
                        Role Creation & Permissions
                    </h1>
                    <p className="text-sm text-gray-500 mt-1 font-sans">
                        Create custom system access roles and customize their module-based default permission templates.
                    </p>
                </div>
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <ShieldIcon className="w-6 h-6" />
                </div>
            </div>

            {/* Global Alert */}
            {alertMsg && (
                <div className={`p-4 rounded-xl flex items-start space-x-3 text-sm font-sans animate-in fade-in slide-in-from-top-2 duration-200 ${alertMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
                    {alertMsg.type === 'success' ? <CheckIcon className="w-5 h-5 flex-shrink-0" /> : <XIcon className="w-5 h-5 flex-shrink-0" />}
                    <span>{alertMsg.text}</span>
                </div>
            )}

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                
                {/* Left Column: Role Creator & List */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-sm space-y-4">
                        <h2 className="text-base font-semibold text-gray-800 font-sans flex items-center">
                            <span className="w-1.5 h-4 bg-indigo-500 rounded-full mr-2"></span>
                            Create New Role
                        </h2>
                        
                        <form onSubmit={handleCreateRole} className="space-y-3">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Enter role name..."
                                    value={newRoleName}
                                    onChange={(e) => setNewRoleName(e.target.value)}
                                    className="flex-1 px-3.5 py-2 bg-gray-55 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm font-sans"
                                />
                                <button
                                    type="submit"
                                    disabled={isCreatingRole || !newRoleName.trim()}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-xs transition-all disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap font-sans flex items-center gap-1"
                                >
                                    <PlusIcon className="w-3.5 h-3.5" />
                                    Create
                                </button>
                            </div>
                            <p className="text-[10px] text-gray-400 font-sans leading-normal">
                                The new role will inherit whichever permissions are currently configured in the matrix table.
                            </p>
                        </form>

                        <div className="pt-4 border-t border-gray-50 space-y-2">
                            <p className="text-xs font-semibold text-gray-500 font-sans">Available System & Custom Roles:</p>
                            <div className="space-y-1.5 max-h-[350px] overflow-y-auto pr-1">
                                {/* Static System Roles */}
                                {staticRolesList.map(rName => {
                                    const isSel = selectedStaticRole === rName;
                                    return (
                                        <div 
                                            key={rName} 
                                            className={`flex items-center justify-between p-2 rounded-xl border transition-all ${
                                                isSel 
                                                    ? 'bg-blue-55 border-blue-200 shadow-sm ring-1 ring-blue-100' 
                                                    : 'bg-gray-50 border-gray-100 hover:border-gray-200'
                                            }`}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => selectStaticRoleForEditing(rName)}
                                                className={`text-xs font-semibold font-sans truncate text-left flex-1 hover:text-blue-700 transition-colors ${
                                                    isSel ? 'text-blue-700' : 'text-gray-700'
                                                }`}
                                            >
                                                {rName} <span className="text-[10px] text-gray-400 font-normal ml-1">(System)</span>
                                            </button>
                                            <ShieldIcon className="w-3.5 h-3.5 text-gray-400 mr-1" />
                                        </div>
                                    );
                                })}

                                {/* Custom Roles */}
                                {customRoles.map(cr => {
                                    const isSel = selectedCustomRole?._id === cr._id;
                                    if (staticRolesList.includes(cr.name)) return null;
                                    return (
                                        <div 
                                            key={cr._id} 
                                            className={`flex items-center justify-between p-2 rounded-xl border transition-all ${
                                                isSel 
                                                    ? 'bg-blue-55 border-blue-200 shadow-sm ring-1 ring-blue-100' 
                                                    : 'bg-gray-55 border-gray-100 hover:border-gray-200'
                                            }`}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => selectCustomRoleForEditing(cr)}
                                                className={`text-xs font-semibold font-sans truncate text-left flex-1 hover:text-blue-700 transition-colors ${
                                                    isSel ? 'text-blue-700' : 'text-gray-700'
                                                }`}
                                            >
                                                {cr.name} <span className="text-[10px] text-indigo-500 font-normal ml-1">(Custom)</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteRole(cr._id, cr.name)}
                                                className={`transition-colors p-1 cursor-pointer ${
                                                    isSel ? 'text-blue-400 hover:text-rose-600' : 'text-gray-400 hover:text-rose-600'
                                                }`}
                                                title="Delete custom role"
                                            >
                                                <XIcon className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Module-based Permissions Matrix */}
                <div className="lg:col-span-2">
                    {selectedCustomRole || selectedStaticRole ? (
                        <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-sm space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <h3 className="text-base font-semibold text-gray-800 font-sans flex items-center pb-3 border-b border-gray-100">
                                <span className="w-1.5 h-4 bg-blue-500 rounded-full mr-2"></span>
                                {selectedCustomRole ? `Default Permissions for Role: ${selectedCustomRole.name}` : `Default Permissions for System Role: ${selectedStaticRole}`}
                            </h3>
                            
                            <div className="overflow-x-auto rounded-xl border border-gray-100">
                                <table className="w-full text-left text-sm border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-xs font-semibold uppercase tracking-wider">
                                            <th className="px-4 py-3 font-sans">Module Name</th>
                                            <th className="px-3 py-3 text-center font-sans">View</th>
                                            <th className="px-3 py-3 text-center font-sans">Add</th>
                                            <th className="px-3 py-3 text-center font-sans">Edit</th>
                                            <th className="px-3 py-3 text-center font-sans">Delete</th>
                                            <th className="px-3 py-3 text-center font-sans">Special</th>
                                            <th className="px-3 py-3 text-center font-sans">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {MODULES_LIST.map(mod => {
                                            const mPerms = permissions[mod.key] || { view: false, add: false, edit: false, delete: false, special: false };
                                            return (
                                                <tr key={mod.key} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-4 py-3 font-medium text-gray-800 font-sans">{mod.label}</td>
                                                    
                                                    {/* View checkbox */}
                                                    <td className="px-3 py-3 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={!!mPerms.view}
                                                            onChange={() => handlePermissionChange(mod.key, 'view')}
                                                            className="w-4.5 h-4.5 rounded text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer"
                                                        />
                                                    </td>
                                                    
                                                    {/* Add checkbox */}
                                                    <td className="px-3 py-3 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={!!mPerms.add}
                                                            onChange={() => handlePermissionChange(mod.key, 'add')}
                                                            className="w-4.5 h-4.5 rounded text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer"
                                                        />
                                                    </td>

                                                    {/* Edit checkbox */}
                                                    <td className="px-3 py-3 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={!!mPerms.edit}
                                                            onChange={() => handlePermissionChange(mod.key, 'edit')}
                                                            className="w-4.5 h-4.5 rounded text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer"
                                                        />
                                                    </td>

                                                    {/* Delete checkbox */}
                                                    <td className="px-3 py-3 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={!!mPerms.delete}
                                                            onChange={() => handlePermissionChange(mod.key, 'delete')}
                                                            className="w-4.5 h-4.5 rounded text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer"
                                                        />
                                                    </td>

                                                    {/* Special checkbox */}
                                                    <td className="px-3 py-3 text-center">
                                                        {mod.specialLabels && Array.isArray(mod.specialLabels) ? (
                                                            <div className="flex items-center justify-center gap-4">
                                                                {mod.specialLabels.map(sItem => (
                                                                    <div key={sItem.key} className="flex flex-col items-center gap-0.5">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={!!mPerms[sItem.key]}
                                                                            onChange={() => handlePermissionChange(mod.key, sItem.key)}
                                                                            className="w-4.5 h-4.5 rounded text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer"
                                                                        />
                                                                        <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded whitespace-nowrap">
                                                                            {sItem.label}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : mod.specialLabel ? (
                                                            <div className="flex flex-col items-center gap-1">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={!!mPerms.special}
                                                                    onChange={() => handlePermissionChange(mod.key, 'special')}
                                                                    className="w-4.5 h-4.5 rounded text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer"
                                                                />
                                                                <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded whitespace-nowrap">
                                                                    {mod.specialLabel}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-300 font-sans font-medium select-none">-</span>
                                                        )}
                                                    </td>

                                                    {/* Actions: Toggle All */}
                                                    <td className="px-3 py-3 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleToggleAllModulePermissions(mod.key)}
                                                            className="text-xs text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-sans"
                                                        >
                                                            Toggle All
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="pt-4 border-t border-gray-50 flex justify-end">
                                <button
                                    type="button"
                                    onClick={handleSaveAccess}
                                    disabled={isSaving}
                                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm transition-all hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed flex items-center space-x-2 font-sans"
                                >
                                    {isSaving ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            <span>Saving...</span>
                                        </>
                                    ) : (
                                        <>
                                            <CheckIcon className="w-4 h-4" />
                                            <span>Save Role Permissions</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl border border-gray-200/80 p-12 text-center shadow-sm flex flex-col items-center justify-center min-h-[400px]">
                            <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center mb-4 animate-bounce">
                                <ShieldIcon className="w-8 h-8" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-800 font-sans">No Selection</h3>
                            <p className="text-sm text-gray-500 mt-2 max-w-sm mx-auto leading-relaxed font-sans">
                                Select a system or custom role from the left lookup panel to configure default permissions.
                            </p>
                        </div>
                    )}
                </div>

            </div>

            {/* Custom Confirm Modal */}
            {confirmModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
                    <div 
                        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
                        onClick={() => setConfirmModal(null)}
                    ></div>

                    <div className="relative bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 transform transition-all animate-in zoom-in-95 duration-200">
                        <div className="flex items-start space-x-4">
                            <div className={`p-3 rounded-xl flex-shrink-0 ${
                                confirmModal.type === 'danger' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'
                            }`}>
                                <ShieldIcon className="w-6 h-6" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-base font-bold text-gray-900 font-sans">{confirmModal.title}</h3>
                                <p className="text-sm text-gray-500 mt-2 font-sans leading-relaxed">{confirmModal.message}</p>
                            </div>
                        </div>

                        <div className="mt-6 flex items-center justify-end space-x-3">
                            <button
                                type="button"
                                onClick={() => setConfirmModal(null)}
                                className="px-4 py-2 bg-gray-55 hover:bg-gray-100 text-gray-700 rounded-xl text-sm font-medium transition-colors font-sans"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    confirmModal.onConfirm();
                                    setConfirmModal(null);
                                }}
                                className={`px-4 py-2 rounded-xl text-sm font-medium text-white transition-colors font-sans ${
                                    confirmModal.type === 'danger' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'
                                }`}
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RoleCreation;
