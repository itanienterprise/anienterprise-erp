import React, { useState, useEffect, useRef } from 'react';
import { UserIcon, MailIcon, PhoneIcon, BriefcaseIcon, CalendarIcon, ShieldIcon, XIcon, EditIcon, CheckIcon } from '../../Icons';
import { API_BASE_URL, formatDate } from '../../../utils/helpers';
import axios from '../../../utils/api';
import './Profile.css';

const Profile = ({ currentUser, onClose }) => {
    const [employeeData, setEmployeeData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        phone: '',
        email: ''
    });
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [passwordStatus, setPasswordStatus] = useState({ type: '', message: '' });
    const [isSaving, setIsSaving] = useState(false);
    const passwordSectionRef = useRef(null);

    useEffect(() => {
        if (isChangingPassword && passwordSectionRef.current) {
            passwordSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [isChangingPassword]);

    useEffect(() => {
        let isMounted = true;
        if (currentUser) {
            fetchEmployeeDetails(isMounted);
        } else {
            setIsLoading(false);
        }
        return () => { isMounted = false; };
    }, [currentUser]);

    const fetchEmployeeDetails = async (isMounted) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/employees`);
            if (response.data && isMounted) {
                const employees = response.data;

                // Find current logged in employee
                const currentEmp = employees.find(e => e.employeeId === currentUser.username);
                if (currentEmp) {
                    setEmployeeData(currentEmp);
                }
            }
        } catch (error) {
            console.error('Error fetching employee details:', error);
        } finally {
            if (isMounted) setIsLoading(false);
        }
    };

    const handleEdit = () => {
        let phone = userData.phone || '';
        if (!phone.startsWith('+880')) {
            phone = '+880' + phone.replace(/^\+?880/, '');
        }
        setFormData({
            phone: phone.substring(0, 14),
            email: userData.email || ''
        });
        setIsEditing(true);
    };

    const handleCancel = () => {
        setIsEditing(false);
    };

    const handleSave = async () => {
        if (!employeeData) {
            alert('Cannot update profile: No associated employee record found for this account.');
            setIsEditing(false);
            return;
        }

        setIsSaving(true);
        try {
            // Prepare updated employee record
            const updatedEmployee = {
                ...employeeData,
                phone: formData.phone,
                email: formData.email
            };

            const response = await axios.put(`${API_BASE_URL}/api/employees/${employeeData._id}`, updatedEmployee);

            if (response.status >= 200 && response.status < 300) {
                setEmployeeData(updatedEmployee);
                setIsEditing(false);
            } else {
                alert('Failed to update profile. Please try again.');
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            alert('An error occurred while updating the profile.');
        } finally {
            setIsSaving(false);
        }
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        setPasswordStatus({ type: '', message: '' });

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setPasswordStatus({ type: 'error', message: 'Passwords do not match' });
            return;
        }

        if (passwordData.newPassword.length < 6) {
            setPasswordStatus({ type: 'error', message: 'Password must be at least 6 characters' });
            return;
        }

        setIsSaving(true);
        try {
            const response = await axios.post(`${API_BASE_URL}/api/auth/change-password`, {
                username: currentUser.username,
                currentPassword: passwordData.currentPassword,
                newPassword: passwordData.newPassword
            });

            if (response.status >= 200 && response.status < 300) {
                setPasswordStatus({ type: 'success', message: 'Password changed successfully' });
                setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                setTimeout(() => setIsChangingPassword(false), 2000);
            } else {
                setPasswordStatus({ type: 'error', message: response.data.message || 'Failed to change password' });
            }
        } catch (error) {
            console.error('Error changing password:', error);
            const errorMessage = error.response?.data?.message || 'Server error';
            setPasswordStatus({ type: 'error', message: errorMessage });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading || !currentUser) {
        return (
            <div className="profile-overlay">
                <div className="profile-backdrop" onClick={onClose}></div>
                <div className="profile-card profile-loading">
                    {!currentUser ? (
                        <div className="text-center p-8">
                            <p className="text-gray-500 font-medium">Session expired. Please login again.</p>
                            <button onClick={onClose} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold">Close</button>
                        </div>
                    ) : (
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    )}
                </div>
            </div>
        );
    }

    const userData = employeeData || {
        name: currentUser?.username === 'admin' ? 'Administrator' : (currentUser?.username || 'User'),
        role: currentUser?.role || 'Admin',
        department: 'Management',
        email: 'admin@ani-enterprise.com',
        phone: '+880XXXXXXXXXX',
        designation: 'System Administrator',
        employeeId: 'ADMIN-001',
        joiningDate: '2024-01-01'
    };

    return (
        <div className="profile-overlay">
            <div className="profile-backdrop" onClick={onClose}></div>
            <div className="profile-card">
                <div className="profile-header">
                    <div className="profile-cover"></div>
                    <button onClick={onClose} className="profile-close-btn">
                        <XIcon className="w-5 h-5" />
                    </button>
                    <div className="profile-avatar-container">
                        <div className="profile-avatar-large">
                            {userData.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)}
                        </div>
                    </div>
                </div>

                <div className="profile-scroll-container">
                    <div className="profile-content">
                        {!isChangingPassword && (
                            <>
                                <div className="profile-info-main text-center">
                                    <h2 className="profile-name">{userData.name}</h2>
                                    <div className="profile-badge-container">
                                        <span className="profile-role-badge">
                                            <ShieldIcon className="w-3 h-3 mr-1" />
                                            {userData.role}
                                        </span>
                                    </div>
                                    <p className="profile-designation">{userData.designation}</p>
                                </div>

                                <div className="profile-details-grid">
                                    <div className="profile-detail-item">
                                        <div className="profile-detail-icon"><UserIcon className="w-4 h-4" /></div>
                                        <div className="profile-detail-text">
                                            <p className="profile-detail-label">Employee ID</p>
                                            <p className="profile-detail-value">{userData.employeeId}</p>
                                        </div>
                                    </div>
                                    <div className="profile-detail-item">
                                        <div className="profile-detail-icon"><BriefcaseIcon className="w-4 h-4" /></div>
                                        <div className="profile-detail-text">
                                            <p className="profile-detail-label">Department</p>
                                            <p className="profile-detail-value">{userData.department}</p>
                                        </div>
                                    </div>
                                    <div className="profile-detail-item">
                                        <div className="profile-detail-icon"><PhoneIcon className="w-4 h-4" /></div>
                                        <div className="profile-detail-text">
                                            <p className="profile-detail-label">Phone</p>
                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    className="profile-edit-input"
                                                    value={formData.phone}
                                                    onChange={(e) => {
                                                        let value = e.target.value;
                                                        if (!value.startsWith('+880')) {
                                                            value = '+880' + value.replace(/^\+880?/, '');
                                                        }
                                                        if (value.length <= 14) {
                                                            setFormData({ ...formData, phone: value });
                                                        }
                                                    }}
                                                    placeholder="+880XXXXXXXXXX"
                                                    maxLength={14}
                                                />
                                            ) : (
                                                <p className="profile-detail-value">{userData.phone}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="profile-detail-item">
                                        <div className="profile-detail-icon"><MailIcon className="w-4 h-4" /></div>
                                        <div className="profile-detail-text">
                                            <p className="profile-detail-label">Email</p>
                                            {isEditing ? (
                                                <input
                                                    type="email"
                                                    className="profile-edit-input"
                                                    value={formData.email}
                                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                    placeholder="Email Address"
                                                />
                                            ) : (
                                                <p className="profile-detail-value">{userData.email || 'N/A'}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="profile-detail-item col-span-2">
                                        <div className="profile-detail-icon"><CalendarIcon className="w-4 h-4" /></div>
                                        <div className="profile-detail-text">
                                            <p className="profile-detail-label">Joining Date</p>
                                            <p className="profile-detail-value">{formatDate(userData.joiningDate)}</p>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {isChangingPassword ? (
                            <div ref={passwordSectionRef} className="profile-password-section animate-in fade-in slide-in-from-top-4 duration-300">
                                <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center">
                                    <ShieldIcon className="w-4 h-4 mr-2 text-blue-500" />
                                    Change Password
                                </h3>
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Current Password</label>
                                        <input
                                            type="password"
                                            className="profile-edit-input"
                                            value={passwordData.currentPassword}
                                            onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                            placeholder="••••••••"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">New Password</label>
                                        <input
                                            type="password"
                                            className="profile-edit-input"
                                            value={passwordData.newPassword}
                                            onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                            placeholder="••••••••"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Confirm New Password</label>
                                        <input
                                            type="password"
                                            className="profile-edit-input"
                                            value={passwordData.confirmPassword}
                                            onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                            placeholder="••••••••"
                                        />
                                    </div>

                                    {passwordStatus.message && (
                                        <p className={`text-xs font-medium ${passwordStatus.type === 'success' ? 'text-green-600' : 'text-red-500'} animate-in fade-in duration-200`}>
                                            {passwordStatus.message}
                                        </p>
                                    )}

                                    <div className="flex space-x-3 pt-2">
                                        <button
                                            className="profile-cancel-btn flex-1"
                                            onClick={() => {
                                                setIsChangingPassword(false);
                                                setPasswordStatus({ type: '', message: '' });
                                            }}
                                            disabled={isSaving}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            className="profile-save-btn flex-1"
                                            onClick={handlePasswordChange}
                                            disabled={isSaving}
                                        >
                                            {isSaving ? 'Updating...' : 'Update Password'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="profile-actions">
                                {isEditing ? (
                                    <>
                                        <button
                                            className="profile-cancel-btn"
                                            onClick={handleCancel}
                                            disabled={isSaving}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            className="profile-save-btn"
                                            onClick={handleSave}
                                            disabled={isSaving}
                                        >
                                            {isSaving ? 'Saving...' : 'Save Changes'}
                                        </button>
                                    </>
                                ) : (
                                    <div className="flex flex-col space-y-3 w-full">
                                        <button
                                            className="profile-edit-btn"
                                            onClick={handleEdit}
                                        >
                                            <EditIcon className="w-4 h-4 mr-2" />
                                            Update Profile
                                        </button>
                                        <button
                                            className="profile-password-btn"
                                            onClick={() => setIsChangingPassword(true)}
                                        >
                                            <ShieldIcon className="w-4 h-4 mr-2" />
                                            Change Password
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Profile;
