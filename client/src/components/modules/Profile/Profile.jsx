import React, { useState, useEffect, useRef, useCallback } from 'react';
import { UserIcon, MailIcon, PhoneIcon, BriefcaseIcon, CalendarIcon, ShieldIcon, XIcon, EditIcon } from '../../Icons';
import { API_BASE_URL, formatDate } from '../../../utils/helpers';
import axios from '../../../utils/api';
import './Profile.css';

const Profile = ({ currentUser, onClose, onPhotoUpdate }) => {
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
    const [saveStatus, setSaveStatus] = useState({ type: '', message: '' });
    const passwordSectionRef = useRef(null);

    // Photo upload state
    const [photoPreview, setPhotoPreview] = useState(null);
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const [photoStatus, setPhotoStatus] = useState({ type: '', message: '' });
    const photoInputRef = useRef(null);

    // Crop / reposition modal state (Circle viewport diameter = 280px)
    const PREVIEW_PX = 280;
    const [cropSrc, setCropSrc] = useState(null);
    const [isCropping, setIsCropping] = useState(false);
    const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
    const [cropScale, setCropScale] = useState(1);
    const previewCanvasRef = useRef(null);
    const loadedImgRef = useRef(null);
    const dragStartRef = useRef(null);
    const pinchStartRef = useRef(null);

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
            const response = await axios.get(`${API_BASE_URL}/api/profile`);
            if (response.data && isMounted) {
                setEmployeeData(response.data);
                if (response.data.profilePhoto) {
                    setPhotoPreview(response.data.profilePhoto);
                    onPhotoUpdate?.(response.data.profilePhoto);
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
        setSaveStatus({ type: '', message: '' });

        // Admin user has no real employee record — just update local state
        const isAdminUser = currentUser?.username === 'admin' || !employeeData?._id;
        if (isAdminUser) {
            setEmployeeData(prev => ({ ...(prev || {}), phone: formData.phone, email: formData.email }));
            setIsEditing(false);
            return;
        }

        setIsSaving(true);
        try {
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
                setSaveStatus({ type: 'error', message: 'Failed to update profile. Please try again.' });
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            setSaveStatus({ type: 'error', message: 'An error occurred while updating the profile.' });
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

    // ─── Photo Upload Helpers & Live Canvas Cropper ────────────────────────────

    /** Read a File into a data-URL */
    const readFile = (file) => new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = e => res(e.target.result);
        r.onerror = rej;
        r.readAsDataURL(file);
    });

    /** Draw live preview onto the circular canvas */
    const drawCropPreview = useCallback(() => {
        const canvas = previewCanvasRef.current;
        const img = loadedImgRef.current;
        if (!canvas || !img) return;

        const ctx = canvas.getContext('2d');
        const C = PREVIEW_PX;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Clear canvas with white background (prevents black background in exports/zoom-out)
        ctx.clearRect(0, 0, C, C);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, C, C);

        // Base scale covers the circle viewport completely when scale = 1.0
        const baseScale = Math.max(C / img.naturalWidth, C / img.naturalHeight);
        const s = baseScale * cropScale;

        // Draw centered with user drag offset
        ctx.save();
        ctx.translate(C / 2 + cropOffset.x, C / 2 + cropOffset.y);
        ctx.scale(s, s);
        ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
        ctx.restore();
    }, [cropOffset, cropScale, PREVIEW_PX]);

    // Redraw whenever crop modal is open or parameters change
    useEffect(() => {
        if (isCropping) {
            drawCropPreview();
            const raf = requestAnimationFrame(drawCropPreview);
            return () => cancelAnimationFrame(raf);
        }
    }, [isCropping, drawCropPreview]);

    /** Export high-resolution cropped square JPEG matching the live preview 1:1 */
    const buildCroppedBase64 = (offset, scale, outputPx = 400, quality = 0.9) => {
        const img = loadedImgRef.current;
        if (!img) throw new Error('Image not loaded');

        const C = PREVIEW_PX;
        const ratio = outputPx / C;
        const canvas = document.createElement('canvas');
        canvas.width = outputPx;
        canvas.height = outputPx;
        const ctx = canvas.getContext('2d');

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Fill background with clean white so zoomed-out images never show black
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, outputPx, outputPx);

        const baseScale = Math.max(C / img.naturalWidth, C / img.naturalHeight);
        const s = baseScale * scale;

        // Exact 1:1 scalar transform from the preview viewport to output resolution
        ctx.save();
        ctx.translate((C / 2 + offset.x) * ratio, (C / 2 + offset.y) * ratio);
        ctx.scale(s * ratio, s * ratio);
        ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
        ctx.restore();

        return canvas.toDataURL('image/jpeg', quality);
    };

    /** Open crop modal when user picks a file */
    const handlePhotoSelect = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (photoInputRef.current) photoInputRef.current.value = '';

        if (!file.type.startsWith('image/')) {
            setPhotoStatus({ type: 'error', message: 'Please select a valid image file.' });
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            setPhotoStatus({ type: 'error', message: 'Image must be under 10 MB.' });
            return;
        }

        setPhotoStatus({ type: '', message: '' });
        try {
            const dataUrl = await readFile(file);
            const img = new Image();
            img.onload = () => {
                loadedImgRef.current = img;
                setCropSrc(dataUrl);
                setCropOffset({ x: 0, y: 0 });
                setCropScale(1);
                setIsCropping(true);
            };
            img.onerror = () => {
                setPhotoStatus({ type: 'error', message: 'Could not load image.' });
            };
            img.src = dataUrl;
        } catch {
            setPhotoStatus({ type: 'error', message: 'Could not read file.' });
        }
    };

    /** Upload the cropped result to the server */
    const handleCropSave = async () => {
        setIsCropping(false);
        setIsUploadingPhoto(true);
        setPhotoStatus({ type: '', message: '' });
        try {
            const croppedBase64 = buildCroppedBase64(cropOffset, cropScale);
            setPhotoPreview(croppedBase64);
            setEmployeeData(prev => ({ ...(prev || {}), profilePhoto: croppedBase64 }));
            onPhotoUpdate?.(croppedBase64);

            const response = await axios.post(`${API_BASE_URL}/api/profile/photo`, { photo: croppedBase64 });
            if (response.data?.success) {
                setPhotoStatus({ type: 'success', message: 'Photo updated!' });
                setTimeout(() => setPhotoStatus({ type: '', message: '' }), 2500);
            } else {
                setPhotoStatus({ type: 'error', message: 'Failed to upload photo.' });
            }
        } catch (error) {
            const msg = error.response?.data?.message || 'Upload failed. Try again.';
            setPhotoStatus({ type: 'error', message: msg });
            setPhotoPreview(employeeData?.profilePhoto || null);
        } finally {
            setIsUploadingPhoto(false);
            setCropSrc(null);
        }
    };

    /** Remove the profile photo */
    const handleRemovePhoto = async () => {
        if (isUploadingPhoto) return;
        setIsUploadingPhoto(true);
        setPhotoStatus({ type: '', message: '' });
        try {
            const response = await axios.post(`${API_BASE_URL}/api/profile/photo`, { photo: null });
            if (response.data?.success !== false) {
                setPhotoPreview(null);
                setEmployeeData(prev => ({ ...(prev || {}), profilePhoto: null }));
                onPhotoUpdate?.(null);
                setPhotoStatus({ type: 'success', message: 'Photo removed.' });
                setTimeout(() => setPhotoStatus({ type: '', message: '' }), 2000);
            }
        } catch (error) {
            setPhotoStatus({ type: 'error', message: 'Failed to remove photo.' });
        } finally {
            setIsUploadingPhoto(false);
        }
    };

    /** Mouse drag handler for repositioning */
    const onCropMouseDown = (e) => {
        e.preventDefault();
        dragStartRef.current = { mx: e.clientX, my: e.clientY, ox: cropOffset.x, oy: cropOffset.y };
        const onMove = (ev) => {
            const { mx, my, ox, oy } = dragStartRef.current;
            setCropOffset({ x: ox + (ev.clientX - mx), y: oy + (ev.clientY - my) });
        };
        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    };

    /** Touch drag & pinch-to-zoom handler for touchscreens */
    const onCropTouchStart = (e) => {
        if (e.touches.length === 1) {
            const t = e.touches[0];
            dragStartRef.current = { mx: t.clientX, my: t.clientY, ox: cropOffset.x, oy: cropOffset.y };
            const onMove = (ev) => {
                if (ev.touches.length !== 1) return;
                const t2 = ev.touches[0];
                const { mx, my, ox, oy } = dragStartRef.current;
                setCropOffset({ x: ox + (t2.clientX - mx), y: oy + (t2.clientY - my) });
            };
            const onEnd = () => {
                window.removeEventListener('touchmove', onMove);
                window.removeEventListener('touchend', onEnd);
            };
            window.addEventListener('touchmove', onMove, { passive: false });
            window.addEventListener('touchend', onEnd);
        } else if (e.touches.length === 2) {
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            pinchStartRef.current = { dist, scale: cropScale };
            const onTouchMove = (ev) => {
                if (ev.touches.length === 2 && pinchStartRef.current) {
                    const currentDist = Math.hypot(
                        ev.touches[0].clientX - ev.touches[1].clientX,
                        ev.touches[0].clientY - ev.touches[1].clientY
                    );
                    const factor = currentDist / pinchStartRef.current.dist;
                    setCropScale(Math.min(3, Math.max(0.2, +(pinchStartRef.current.scale * factor).toFixed(3))));
                }
            };
            const onTouchEnd = () => {
                window.removeEventListener('touchmove', onTouchMove);
                window.removeEventListener('touchend', onTouchEnd);
            };
            window.addEventListener('touchmove', onTouchMove, { passive: false });
            window.addEventListener('touchend', onTouchEnd);
        }
    };

    const onCropWheel = (e) => {
        e.preventDefault();
        setCropScale(s => Math.min(3, Math.max(0.2, +(s - e.deltaY * 0.0015).toFixed(3))));
    };

    const onCropDoubleClick = () => {
        setCropOffset({ x: 0, y: 0 });
        setCropScale(1);
    };

    const handleAvatarClick = () => {
        photoInputRef.current?.click();
    };

    // ──────────────────────────────────────────────────────────────────────────

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

    const avatarInitials = (userData.name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

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
                        {/* Hidden file input */}
                        <input
                            ref={photoInputRef}
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={handlePhotoSelect}
                        />
                        <button
                            className={`profile-avatar-btn${isUploadingPhoto ? ' profile-avatar-uploading' : ''}${isEditing ? ' profile-avatar-editable' : ''}`}
                            onClick={isEditing ? handleAvatarClick : undefined}
                            title={isEditing ? 'Click to upload profile photo' : undefined}
                            disabled={!isEditing || isUploadingPhoto}
                            style={{ cursor: isEditing ? 'pointer' : 'default' }}
                        >
                            <div className="profile-avatar-large">
                                {photoPreview ? (
                                    <img
                                        src={photoPreview}
                                        alt="Profile"
                                        className="profile-avatar-img"
                                    />
                                ) : (
                                    <span>{avatarInitials}</span>
                                )}
                            </div>
                            {/* Camera overlay — only rendered when editing */}
                            {isEditing && (
                                <div className="profile-avatar-camera-overlay">
                                    {isUploadingPhoto ? (
                                        <div className="profile-upload-spinner"></div>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                                            <circle cx="12" cy="13" r="4"></circle>
                                        </svg>
                                    )}
                                </div>
                            )}
                        </button>
                        {photoStatus.message && (
                            <div className={`profile-photo-toast ${photoStatus.type === 'success' ? 'profile-photo-toast--success' : 'profile-photo-toast--error'}`}>
                                {photoStatus.message}
                            </div>
                        )}
                    </div>
                </div>

                {/* Remove photo link — only visible in edit mode */}
                {photoPreview && isEditing && !isUploadingPhoto && (
                    <div className="profile-remove-photo-row">
                        <button className="profile-remove-photo-btn" onClick={handleRemovePhoto}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '11px', height: '11px', marginRight: '4px' }}>
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6l-1 14H6L5 6"></path>
                                <path d="M10 11v6"></path>
                                <path d="M14 11v6"></path>
                                <path d="M9 6V4h6v2"></path>
                            </svg>
                            Remove photo
                        </button>
                    </div>
                )}

                <div className="profile-scroll-container">
                    <div className="profile-content">
                        {!isChangingPassword && (
                            <>
                                <div className="profile-info-main text-center">
                                    <h2 className="profile-name">{userData.name}</h2>
                                    {(currentUser?.username === 'admin' || (currentUser?.role || '').toLowerCase() === 'admin') && (
                                        <div className="profile-badge-container">
                                            <span className="profile-role-badge">
                                                <ShieldIcon className="w-3 h-3 mr-1" />
                                                {userData.role}
                                            </span>
                                        </div>
                                    )}
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
                                        {saveStatus.message && (
                                            <p className={`profile-save-status ${saveStatus.type === 'error' ? 'profile-save-status--error' : 'profile-save-status--success'}`}>
                                                {saveStatus.message}
                                            </p>
                                        )}
                                        <div className="profile-actions-row">
                                            <button
                                                className="profile-cancel-btn"
                                                onClick={() => { handleCancel(); setSaveStatus({ type: '', message: '' }); }}
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
                                        </div>
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

            {/* ─── Crop / Reposition Modal ─────────────────────────────────── */}
            {isCropping && cropSrc && (
                <div className="crop-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setIsCropping(false); setCropSrc(null); } }}>
                    <div className="crop-modal">
                        <div className="crop-modal-header">
                            <h3 className="crop-modal-title">Adjust Profile Photo</h3>
                            <p className="crop-modal-hint">Drag to move &middot; Scroll to zoom &middot; Double-click to center</p>
                        </div>

                        {/* Circular live preview viewport */}
                        <div
                            className="crop-preview-circle"
                            onMouseDown={onCropMouseDown}
                            onTouchStart={onCropTouchStart}
                            onWheel={onCropWheel}
                            onDoubleClick={onCropDoubleClick}
                            title="Drag to reposition, double-click to center"
                        >
                            <canvas
                                ref={previewCanvasRef}
                                width={PREVIEW_PX}
                                height={PREVIEW_PX}
                                className="crop-preview-canvas"
                            />
                            {/* Circle guide ring */}
                            <div className="crop-circle-ring"></div>
                        </div>

                        {/* Zoom control row with step buttons and slider */}
                        <div className="crop-zoom-row">
                            <button
                                type="button"
                                className="crop-zoom-step-btn"
                                onClick={() => setCropScale(s => Math.max(0.2, +(s - 0.1).toFixed(2)))}
                                title="Zoom out"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
                                    <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                    <line x1="8" y1="11" x2="14" y2="11"></line>
                                </svg>
                            </button>
                            <input
                                type="range"
                                className="crop-zoom-slider"
                                min="0.2" max="3" step="0.01"
                                value={cropScale}
                                onChange={(e) => setCropScale(parseFloat(e.target.value))}
                            />
                            <button
                                type="button"
                                className="crop-zoom-step-btn"
                                onClick={() => setCropScale(s => Math.min(3, +(s + 0.1).toFixed(2)))}
                                title="Zoom in"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
                                    <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                    <line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line>
                                </svg>
                            </button>
                        </div>

                        <div className="crop-modal-actions">
                            <button className="crop-cancel-btn" onClick={() => { setIsCropping(false); setCropSrc(null); }}>
                                Cancel
                            </button>
                            <button className="crop-save-btn" onClick={handleCropSave}>
                                Save Photo
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Profile;
