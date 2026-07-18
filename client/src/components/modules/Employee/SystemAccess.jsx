import React, { useState, useEffect, useRef } from 'react';
import { UserIcon, SearchIcon, ChevronDownIcon, EyeIcon, ShieldIcon, CheckIcon, RefreshIcon, XIcon } from '../../Icons';
import { API_BASE_URL } from '../../../utils/helpers';
import axios from '../../../utils/api';
import { MODULES_LIST, getDefaultPermissionsForRole } from '../../../utils/permissionHelper';

const SystemAccess = ({ currentUser, setCurrentUser }) => {
    const [employees, setEmployees] = useState([]);
    const [filteredEmployees, setFilteredEmployees] = useState([]);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    
    // Config form state
    const [role, setRole] = useState('General Staff');
    const [status, setStatus] = useState('Active');
    const [permissions, setPermissions] = useState({});
    const [isSaving, setIsSaving] = useState(false);
    const [alertMsg, setAlertMsg] = useState(null); // { type: 'success' | 'error', text: '' }

    // Password fields state
    const [customPassword, setCustomPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [passwordAlert, setPasswordAlert] = useState(null); // { type: 'success' | 'error', text: '', newPass?: string }
    const [copiedPassword, setCopiedPassword] = useState(false);

    // Custom confirm modal state
    const [confirmModal, setConfirmModal] = useState(null); // { title: '', message: '', onConfirm: () => {}, type: 'danger' | 'warning' | 'info' }

    // Dynamic Custom Roles State (needed for the role dropdown selection)
    const [customRoles, setCustomRoles] = useState([]);

    const suggestionsRef = useRef(null);
    const roleDropdownRef = useRef(null);
    const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);

    useEffect(() => {
        fetchEmployees();
        fetchCustomRoles();
    }, []);

    // Close suggestions and dropdowns on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (suggestionsRef.current && !suggestionsRef.current.contains(e.target)) {
                setShowSuggestions(false);
            }
            if (roleDropdownRef.current && !roleDropdownRef.current.contains(e.target)) {
                setRoleDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchEmployees = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/employees`);
            if (response.data) {
                setEmployees(response.data);
            }
        } catch (error) {
            console.error('Error fetching employees:', error);
        }
    };

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

    const handleSearchChange = (e) => {
        const query = e.target.value;
        setSearchQuery(query);
        if (query.trim() === '') {
            setFilteredEmployees([]);
            setShowSuggestions(false);
        } else {
            const lower = query.toLowerCase();
            const filtered = employees.filter(emp => 
                (emp.name && emp.name.toLowerCase().includes(lower)) ||
                (emp.employeeId && emp.employeeId.toLowerCase().includes(lower)) ||
                (emp.designation && emp.designation.toLowerCase().includes(lower))
            );
            setFilteredEmployees(filtered);
            setShowSuggestions(true);
        }
    };

    const selectEmployee = (emp) => {
        setSelectedEmployee(emp);
        setRole(emp.role || 'General Staff');
        setStatus(emp.status || 'Active');
        
        // Merge role defaults with stored custom permissions.
        // This ensures newly-added modules get their role-default values
        // even if the stored permissions object pre-dates those modules.
        const roleDefaults = getDefaultPermissionsForRole(emp.role || 'General Staff');
        const merged = emp.permissions && Object.keys(emp.permissions).length > 0
            ? { ...roleDefaults, ...emp.permissions }
            : roleDefaults;
        setPermissions(merged);
        
        setSearchQuery(`${emp.name} (${emp.employeeId})`);
        setShowSuggestions(false);
        setAlertMsg(null);
        setPasswordAlert(null);
        setCustomPassword('');
    };

    const clearSelection = () => {
        setSelectedEmployee(null);
        setSearchQuery('');
        setAlertMsg(null);
        setPasswordAlert(null);
        setCustomPassword('');
        setPermissions({});
    };

    const handleRoleSelect = (selectedRole) => {
        setRole(selectedRole);
        setRoleDropdownOpen(false);
        
        // Custom confirmation modal instead of window.confirm
        setConfirmModal({
            title: 'Reset Permissions?',
            message: `Would you like to reset this employee's permissions to the default settings for the "${selectedRole}" role?`,
            type: 'warning',
            onConfirm: () => {
                // Check if it's a custom role OR overridden system role
                const customRoleObj = customRoles.find(cr => cr.name === selectedRole);
                if (customRoleObj) {
                    setPermissions(customRoleObj.permissions);
                } else {
                    setPermissions(getDefaultPermissionsForRole(selectedRole));
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
        if (!selectedEmployee) return;
        setIsSaving(true);
        setAlertMsg(null);

        try {
            // Save updated employee access configurations and permissions
            const updatedData = {
                ...selectedEmployee,
                role,
                status,
                permissions
            };

            const response = await axios.put(`${API_BASE_URL}/api/employees/${selectedEmployee._id}`, updatedData);
            if (response.data) {
                // Update local lists
                const updatedList = employees.map(emp => emp._id === selectedEmployee._id ? { ...emp, role, status, permissions } : emp);
                setEmployees(updatedList);
                setSelectedEmployee({ ...selectedEmployee, role, status, permissions });
                setAlertMsg({ type: 'success', text: 'System access configuration saved successfully!' });

                // Refresh the current logged-in user's permissions in React state
                // so sidebar/access gates update immediately without needing re-login
                try {
                    const sessionResp = await axios.get(`${API_BASE_URL}/api/auth/check`);
                    if (sessionResp.data?.authenticated && sessionResp.data?.user) {
                        const freshUser = sessionResp.data.user;
                        localStorage.setItem('currentUser', JSON.stringify(freshUser));
                        if (setCurrentUser) setCurrentUser(freshUser);
                    }
                } catch (e) {
                    // Non-critical: session refresh failed, sidebar may need manual refresh
                    console.warn('Session refresh after save failed:', e);
                }
            }
        } catch (error) {
            console.error('Error saving access configuration:', error);
            setAlertMsg({ 
                type: 'error', 
                text: error.response?.data?.message || 'Failed to save configuration. Please try again.' 
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleAutoResetPassword = () => {
        if (!selectedEmployee) return;
        setPasswordAlert(null);

        // Custom confirmation modal instead of window.confirm
        setConfirmModal({
            title: 'Reset Password?',
            message: `Are you sure you want to reset the login password for ${selectedEmployee.name}? This will generate a new random credential.`,
            type: 'danger',
            onConfirm: async () => {
                setIsChangingPassword(true);
                try {
                    const response = await axios.post(`${API_BASE_URL}/api/employees/${selectedEmployee._id}/reset-password`);
                    if (response.data && response.data.newPassword) {
                        setPasswordAlert({ 
                            type: 'success', 
                            text: 'Password reset successful! Copy the new generated password below:',
                            newPass: response.data.newPassword
                        });
                    }
                } catch (error) {
                    console.error('Error resetting password:', error);
                    setPasswordAlert({ 
                        type: 'error', 
                        text: error.response?.data?.message || 'Failed to reset password.' 
                    });
                } finally {
                    setIsChangingPassword(false);
                }
            }
        });
    };

    const handleChangePasswordCustom = async (e) => {
        e.preventDefault();
        if (!selectedEmployee) return;
        if (customPassword.trim().length < 4) {
            setPasswordAlert({ type: 'error', text: 'Password must be at least 4 characters long.' });
            return;
        }

        setPasswordAlert(null);
        setIsChangingPassword(true);

        try {
            const response = await axios.post(`${API_BASE_URL}/api/employees/${selectedEmployee._id}/change-password`, {
                newPassword: customPassword
            });
            if (response.data && response.data.success) {
                setPasswordAlert({ type: 'success', text: 'Password updated successfully!' });
                setCustomPassword('');
            }
        } catch (error) {
            console.error('Error changing custom password:', error);
            setPasswordAlert({ 
                type: 'error', 
                text: error.response?.data?.message || 'Failed to update password.' 
            });
        } finally {
            setIsChangingPassword(false);
        }
    };

    const handleCopyPassword = (pass) => {
        navigator.clipboard.writeText(pass);
        setCopiedPassword(true);
        setTimeout(() => setCopiedPassword(false), 2000);
    };

    const staticRolesList = ['Admin', 'Incharge', 'LC Manager', 'Sales Manager', 'Accounts Manager', 'Border Manager', 'Data Entry', 'General Staff'];
    // Merge static roles with dynamic custom roles
    const rolesList = [...staticRolesList, ...customRoles.map(cr => cr.name)];

    return (
        <div className="flex-1 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent font-sans">
                        System Access Control
                    </h1>
                    <p className="text-sm text-gray-500 mt-1 font-sans">
                        Configure roles, login permissions, granular module-based rights, and manage credentials for employees.
                    </p>
                </div>
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                    <ShieldIcon className="w-6 h-6" />
                </div>
            </div>

            {/* Global Success / Error Message banner */}
            {alertMsg && (
                <div className={`p-4 rounded-xl flex items-start space-x-3 text-sm font-sans animate-in fade-in slide-in-from-top-2 duration-200 ${alertMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
                    {alertMsg.type === 'success' ? <CheckIcon className="w-5 h-5 flex-shrink-0" /> : <XIcon className="w-5 h-5 flex-shrink-0" />}
                    <span>{alertMsg.text}</span>
                </div>
            )}

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                
                {/* Left Column: Search, Access Config, and Credentials & Security */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Select Employee Card */}
                    <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-sm space-y-4">
                        <h2 className="text-base font-semibold text-gray-800 font-sans flex items-center">
                            <span className="w-1.5 h-4 bg-blue-500 rounded-full mr-2"></span>
                            Select Employee
                        </h2>
                        
                        <div className="relative" ref={suggestionsRef}>
                            <div className="relative">
                                <SearchIcon className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search by name, ID..."
                                    value={searchQuery}
                                    onChange={handleSearchChange}
                                    onFocus={() => setShowSuggestions(true)}
                                    className="w-full pl-10 pr-10 py-2.5 bg-gray-55 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm font-sans"
                                />
                                {searchQuery && (
                                    <button 
                                        onClick={clearSelection}
                                        className="absolute right-3.5 top-3 text-gray-400 hover:text-gray-600"
                                    >
                                        <XIcon className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            {/* Suggestions List */}
                            {showSuggestions && filteredEmployees.length > 0 && (
                                <div className="absolute z-50 w-full mt-1.5 bg-white border border-gray-100 rounded-xl shadow-xl max-h-60 overflow-y-auto py-1 divide-y divide-gray-100">
                                    {filteredEmployees.map(emp => (
                                        <button
                                            key={emp._id}
                                            onClick={() => selectEmployee(emp)}
                                            className="w-full px-4 py-3 text-left hover:bg-blue-50/50 transition-colors flex items-center justify-between"
                                        >
                                            <div>
                                                <p className="text-sm font-semibold text-gray-800 font-sans">{emp.name}</p>
                                                <p className="text-xs text-gray-500 mt-0.5 font-sans">{emp.designation} • {emp.department}</p>
                                            </div>
                                            <span className="text-xs bg-gray-100 text-gray-600 font-mono px-2 py-1 rounded">
                                                {emp.employeeId}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {showSuggestions && searchQuery && filteredEmployees.length === 0 && (
                                <div className="absolute z-50 w-full mt-1.5 bg-white border border-gray-100 rounded-xl shadow-xl p-4 text-center text-sm text-gray-500 font-sans">
                                    No employees found
                                </div>
                            )}
                        </div>

                        {/* Recent / Helper Info */}
                        {!selectedEmployee && (
                            <div className="pt-4 border-t border-gray-50">
                                <p className="text-xs text-gray-400 leading-relaxed font-sans">
                                    Start typing an employee's name or ID above to view and modify their portal permissions, de-activate system login access, or reset user passwords.
                                </p>
                            </div>
                        )}
                    </div>

                    {selectedEmployee && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            
                            {/* Selected Employee Summary Card */}
                            <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                                <div className="absolute -right-10 -bottom-10 opacity-10">
                                    <ShieldIcon className="w-40 h-40" />
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex items-center space-x-4">
                                        <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-md">
                                            <UserIcon className="w-6 h-6 text-blue-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold font-sans">{selectedEmployee.name}</h3>
                                            <p className="text-xs text-slate-300 mt-0.5 font-sans">{selectedEmployee.designation} • {selectedEmployee.department}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-row items-center gap-3">
                                        <div className="text-right">
                                            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-sans">Username / ID</p>
                                            <p className="text-sm font-mono font-bold text-blue-400">{selectedEmployee.employeeId}</p>
                                        </div>
                                        <div className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider font-sans ${status === 'Active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                            {status}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Access Configuration Panel */}
                            <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-sm space-y-6">
                                <h3 className="text-base font-semibold text-gray-800 font-sans flex items-center pb-3 border-b border-gray-100">
                                    <span className="w-1.5 h-4 bg-indigo-500 rounded-full mr-2"></span>
                                    Access Configuration
                                </h3>

                                <div className="space-y-4">
                                    {/* Role Configuration */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-gray-700 font-sans">System Access Role</label>
                                        <div className="relative" ref={roleDropdownRef}>
                                            <button
                                                type="button"
                                                onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
                                                className="w-full px-4 py-2.5 bg-gray-55 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm text-gray-800 text-left flex items-center justify-between font-sans"
                                            >
                                                <span>{role}</span>
                                                <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${roleDropdownOpen ? 'rotate-180' : ''}`} />
                                            </button>
                                            {roleDropdownOpen && (
                                                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-56 overflow-y-auto py-1">
                                                    {rolesList.map(opt => (
                                                        <button
                                                            key={opt}
                                                            type="button"
                                                            onClick={() => handleRoleSelect(opt)}
                                                            className={`w-full px-4 py-2 text-left text-sm transition-colors font-sans ${role === opt ? 'bg-blue-55 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-55'}`}
                                                        >
                                                            {opt}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Login Enabled/Disabled Status */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-gray-700 font-sans">Login Permission</label>
                                        <div className="flex items-center space-x-3 mt-1.5">
                                            <button
                                                type="button"
                                                onClick={() => setStatus(status === 'Active' ? 'Inactive' : 'Active')}
                                                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${status === 'Active' ? 'bg-emerald-500' : 'bg-gray-200'}`}
                                            >
                                                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${status === 'Active' ? 'translate-x-5' : 'translate-x-0'}`} />
                                            </button>
                                            <span className={`text-sm font-medium font-sans ${status === 'Active' ? 'text-emerald-600 font-bold' : 'text-gray-500'}`}>
                                                {status === 'Active' ? 'Enabled (Active)' : 'Disabled (Deactivated)'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-gray-50 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={handleSaveAccess}
                                        disabled={isSaving}
                                        className="w-full justify-center px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm transition-all hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed flex items-center space-x-2 font-sans"
                                    >
                                        {isSaving ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                <span>Saving...</span>
                                            </>
                                        ) : (
                                            <>
                                                <CheckIcon className="w-4 h-4" />
                                                <span>Save Access Details</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Credentials & Security Panel */}
                            <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-sm space-y-6">
                                <h3 className="text-base font-semibold text-gray-800 font-sans flex items-center pb-3 border-b border-gray-100">
                                    <span className="w-1.5 h-4 bg-emerald-500 rounded-full mr-2"></span>
                                    Credentials & Security
                                </h3>

                                {passwordAlert && (
                                    <div className={`p-4 rounded-xl flex flex-col space-y-2 text-sm font-sans ${passwordAlert.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-rose-50 text-rose-800 border border-rose-100'}`}>
                                        <div className="flex items-start space-x-3">
                                            {passwordAlert.type === 'success' ? <CheckIcon className="w-5 h-5 flex-shrink-0" /> : <XIcon className="w-5 h-5 flex-shrink-0" />}
                                            <span>{passwordAlert.text}</span>
                                        </div>
                                        {passwordAlert.newPass && (
                                            <div className="flex items-center justify-between bg-white border border-emerald-200 rounded-lg p-2.5 mt-2 font-mono text-base font-bold text-gray-900 shadow-sm animate-pulse">
                                                <span>{passwordAlert.newPass}</span>
                                                <button
                                                    onClick={() => handleCopyPassword(passwordAlert.newPass)}
                                                    className={`px-2.5 py-1 text-xs rounded font-sans cursor-pointer transition-colors ${copiedPassword ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-600 text-white hover:bg-emerald-75'}`}
                                                >
                                                    {copiedPassword ? 'Copied!' : 'Copy'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="space-y-6">
                                    {/* Auto Reset Password */}
                                    <div className="space-y-3">
                                        <h4 className="text-sm font-semibold text-gray-700 font-sans">Option 1: Auto-generate Password</h4>
                                        <p className="text-xs text-gray-400 leading-relaxed font-sans">
                                            Click below to automatically generate a secure, random password. Copy it as it is shown only once.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={handleAutoResetPassword}
                                            disabled={isChangingPassword}
                                            className="w-full justify-center px-5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl font-semibold text-xs tracking-wide uppercase transition-all flex items-center space-x-2 disabled:opacity-60 disabled:cursor-not-allowed font-sans"
                                        >
                                            <RefreshIcon className="w-4 h-4" />
                                            <span>Auto-Generate Password</span>
                                        </button>
                                    </div>

                                    <div className="border-t border-gray-100 pt-4"></div>

                                    {/* Manual Set Password */}
                                    <form onSubmit={handleChangePasswordCustom} className="space-y-3">
                                        <h4 className="text-sm font-semibold text-gray-700 font-sans">Option 2: Set Custom Password</h4>
                                        <p className="text-xs text-gray-400 leading-relaxed font-sans">
                                            Manually specify a password for the employee (minimum 4 characters).
                                        </p>
                                        <div className="space-y-3">
                                            <div className="relative">
                                                <input
                                                    type={showPassword ? "text" : "password"}
                                                    placeholder="Enter custom password"
                                                    value={customPassword}
                                                    onChange={(e) => setCustomPassword(e.target.value)}
                                                    disabled={isChangingPassword}
                                                    className="w-full pl-4 pr-10 py-2.5 bg-gray-55 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm font-sans"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-3.5 top-3 text-gray-400 hover:text-gray-600 cursor-pointer"
                                                >
                                                    <EyeIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <button
                                                type="submit"
                                                disabled={isChangingPassword || !customPassword}
                                                className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-xs transition-all disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap font-sans"
                                            >
                                                Set Custom Password
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Column: Module-based Permissions Matrix */}
                <div className="lg:col-span-2">
                    {selectedEmployee ? (
                        <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-sm space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <h3 className="text-base font-semibold text-gray-800 font-sans flex items-center pb-3 border-b border-gray-100">
                                <span className="w-1.5 h-4 bg-blue-500 rounded-full mr-2"></span>
                                Module-based Permissions
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
                                            <span>Save Access & Permissions</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl border border-gray-200/80 p-12 text-center shadow-sm flex flex-col items-center justify-center min-h-[400px]">
                            <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mb-4 animate-bounce">
                                <ShieldIcon className="w-8 h-8" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-800 font-sans">No Selection</h3>
                            <p className="text-sm text-gray-500 mt-2 max-w-sm mx-auto leading-relaxed font-sans">
                                Select an employee from the left lookup panel to configure individual module permissions, roles, and credentials.
                            </p>
                        </div>
                    )}
                </div>

            </div>

            {/* Custom Premium Confirm Modal */}
            {confirmModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div 
                        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
                        onClick={() => setConfirmModal(null)}
                    ></div>

                    {/* Modal Content */}
                    <div className="relative bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 transform transition-all animate-in zoom-in-95 duration-200">
                        <div className="flex items-start space-x-4">
                            <div className={`p-3 rounded-xl flex-shrink-0 ${
                                confirmModal.type === 'danger' ? 'bg-rose-50 text-rose-600' :
                                confirmModal.type === 'warning' ? 'bg-amber-50 text-amber-600' :
                                'bg-blue-50 text-blue-600'
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
                                    confirmModal.type === 'danger' ? 'bg-rose-600 hover:bg-rose-700' :
                                    confirmModal.type === 'warning' ? 'bg-amber-600 hover:bg-amber-700' :
                                    'bg-blue-600 hover:bg-blue-700'
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

export default SystemAccess;
