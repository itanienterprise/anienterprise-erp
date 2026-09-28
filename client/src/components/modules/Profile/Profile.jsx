import React, { useState, useEffect, useRef, useCallback } from 'react';
import { UserIcon, MailIcon, PhoneIcon, BriefcaseIcon, CalendarIcon, ShieldIcon, XIcon, EditIcon } from '../../Icons';
import { API_BASE_URL, formatDate } from '../../../utils/helpers';
import axios from '../../../utils/api';
import './Profile.css';

const Profile = ({ currentUser, onClose, onPhotoUpdate }) => {
    const [employeeData, setEmployeeData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showDrawer, setShowDrawer] = useState(false);
    const [drawerTab, setDrawerTab] = useState('info'); // 'info' | 'security'
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

    // Photo upload state
    const [photoPreview, setPhotoPreview] = useState(null);
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const [photoStatus, setPhotoStatus] = useState({ type: '', message: '' });
    const photoInputRef = useRef(null);
    const rawUploadedPhotoRef = useRef(null);

    // Crop / reposition modal state (Circle/Portrait viewport diameter = 280px)
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
                    onPhotoUpdate?.(response.data.profilePhoto, response.data.avatarPhoto);
                }
                let phone = response.data.phone || '';
                if (phone && !phone.startsWith('+880')) {
                    phone = '+880' + phone.replace(/^\+?880/, '');
                }
                setFormData({
                    phone: phone ? phone.substring(0, 14) : '+880',
                    email: response.data.email || ''
                });
            }
        } catch (error) {
            console.error('Error fetching employee details:', error);
        } finally {
            if (isMounted) setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setSaveStatus({ type: '', message: '' });
        setIsSaving(true);
        try {
            const response = await axios.put(`${API_BASE_URL}/api/profile`, {
                phone: formData.phone,
                email: formData.email
            });

            if (response.data?.success || (response.status >= 200 && response.status < 300)) {
                setEmployeeData(prev => ({
                    ...(prev || {}),
                    phone: formData.phone,
                    email: formData.email
                }));
                setSaveStatus({ type: 'success', message: 'Profile updated successfully!' });
                setTimeout(() => setSaveStatus({ type: '', message: '' }), 2500);
            } else {
                setSaveStatus({ type: 'error', message: 'Failed to update profile. Please try again.' });
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            setSaveStatus({ type: 'error', message: error.response?.data?.message || 'An error occurred while updating the profile.' });
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
                setPasswordStatus({ type: 'success', message: 'Password changed successfully!' });
                setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                setTimeout(() => {
                    setPasswordStatus({ type: '', message: '' });
                    setDrawerTab('info');
                }, 2000);
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

    const readFile = (file) => new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = e => res(e.target.result);
        r.onerror = rej;
        r.readAsDataURL(file);
    });

    const drawCropPreview = useCallback(() => {
        const canvas = previewCanvasRef.current;
        const img = loadedImgRef.current;
        if (!canvas || !img) return;

        const ctx = canvas.getContext('2d');
        const C = PREVIEW_PX;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        ctx.clearRect(0, 0, C, C);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, C, C);

        const baseScale = Math.max(C / img.naturalWidth, C / img.naturalHeight);
        const s = baseScale * cropScale;

        ctx.save();
        ctx.translate(C / 2 + cropOffset.x, C / 2 + cropOffset.y);
        ctx.scale(s, s);
        ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
        ctx.restore();
    }, [cropOffset, cropScale, PREVIEW_PX]);

    useEffect(() => {
        if (isCropping) {
            drawCropPreview();
            const raf = requestAnimationFrame(drawCropPreview);
            return () => cancelAnimationFrame(raf);
        }
    }, [isCropping, drawCropPreview]);

    const buildCroppedBase64 = (offset, scale, outputPx = 480, quality = 0.92) => {
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

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, outputPx, outputPx);

        const baseScale = Math.max(C / img.naturalWidth, C / img.naturalHeight);
        const s = baseScale * scale;

        ctx.save();
        ctx.translate((C / 2 + offset.x) * ratio, (C / 2 + offset.y) * ratio);
        ctx.scale(s * ratio, s * ratio);
        ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
        ctx.restore();

        return canvas.toDataURL('image/jpeg', quality);
    };

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

            // 1. Immediately set full uncropped photo on card & server
            rawUploadedPhotoRef.current = dataUrl;
            setPhotoPreview(dataUrl);
            setEmployeeData(prev => ({ ...(prev || {}), profilePhoto: dataUrl }));
            onPhotoUpdate?.(dataUrl, undefined);

            try {
                await axios.post(`${API_BASE_URL}/api/profile/photo`, { photo: dataUrl });
            } catch (err) {
                console.error('Failed to pre-save full photo:', err);
            }

            // 2. Open avatar positioning modal so user can zoom their face for the navbar circle
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

    const handleCropSave = async () => {
        setIsCropping(false);
        setIsUploadingPhoto(true);
        setPhotoStatus({ type: '', message: '' });
        try {
            const croppedBase64 = buildCroppedBase64(cropOffset, cropScale);
            
            // The card retains the full original photo
            const fullPhoto = rawUploadedPhotoRef.current || photoPreview;
            if (fullPhoto) {
                setPhotoPreview(fullPhoto);
            }
            setEmployeeData(prev => ({ ...(prev || {}), avatarPhoto: croppedBase64 }));
            
            // Only update navbar avatar with the crop; leave card with full photo
            onPhotoUpdate?.(fullPhoto || undefined, croppedBase64);

            const payload = rawUploadedPhotoRef.current
                ? { photo: rawUploadedPhotoRef.current, avatarPhoto: croppedBase64 }
                : { avatarPhoto: croppedBase64 };

            const response = await axios.post(`${API_BASE_URL}/api/profile/photo`, payload);
            if (response.data?.success) {
                setPhotoStatus({ type: 'success', message: 'Navbar avatar updated!' });
                setTimeout(() => setPhotoStatus({ type: '', message: '' }), 2500);
            } else {
                setPhotoStatus({ type: 'error', message: 'Failed to update photo.' });
            }
        } catch (error) {
            const msg = error.response?.data?.message || 'Upload failed. Try again.';
            setPhotoStatus({ type: 'error', message: msg });
        } finally {
            setIsUploadingPhoto(false);
            setCropSrc(null);
            rawUploadedPhotoRef.current = null;
        }
    };

    const handleRemovePhoto = async () => {
        if (isUploadingPhoto) return;
        setIsUploadingPhoto(true);
        setPhotoStatus({ type: '', message: '' });
        try {
            const response = await axios.post(`${API_BASE_URL}/api/profile/photo`, { photo: null });
            if (response.data?.success !== false) {
                setPhotoPreview(null);
                setEmployeeData(prev => ({ ...(prev || {}), profilePhoto: null, avatarPhoto: null }));
                onPhotoUpdate?.(null, null);
                setPhotoStatus({ type: 'success', message: 'Photo removed.' });
                setTimeout(() => setPhotoStatus({ type: '', message: '' }), 2000);
            }
        } catch (error) {
            setPhotoStatus({ type: 'error', message: 'Failed to remove photo.' });
        } finally {
            setIsUploadingPhoto(false);
        }
    };

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

    if (isLoading || !currentUser) {
        return (
            <div className="profile-overlay">
                <div className="profile-backdrop" onClick={onClose}></div>
                <div className="profile-card profile-loading-card">
                    {!currentUser ? (
                        <div className="text-center p-8 text-white">
                            <p className="font-medium text-white/80">Session expired. Please login again.</p>
                            <button onClick={onClose} className="mt-4 px-5 py-2 bg-white text-gray-900 rounded-full text-sm font-bold shadow-md">Close</button>
                        </div>
                    ) : (
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                    )}
                </div>
            </div>
        );
    }

    const userData = employeeData || {
        name: currentUser?.username === 'admin' ? 'Administrator' : (currentUser?.username || 'User'),
        role: currentUser?.role || 'Admin',
        department: currentUser?.department || 'Management',
        email: currentUser?.email || 'admin@ani-enterprise.com',
        phone: currentUser?.phone || '+880XXXXXXXXXX',
        designation: currentUser?.designation || 'System Administrator',
        employeeId: currentUser?.employeeId || 'ADMIN-001',
        joiningDate: currentUser?.joiningDate || '2024-01-01'
    };

    const initials = (userData.name || 'U')
        .split(' ')
        .filter(Boolean)
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);

    return (
        <div className="profile-overlay">
            {/* Backdrop */}
            <div className="profile-backdrop" onClick={onClose}></div>

            {/* Hidden file input for photo upload */}
            <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handlePhotoSelect}
            />

            {/* Main Portrait Profile Card */}
            <div className="profile-card-portrait">
                {/* Background Image / Studio Gradient */}
                {photoPreview ? (
                    <img
                        src={photoPreview}
                        alt={userData.name}
                        className="profile-portrait-bg"
                    />
                ) : (
                    <div className="profile-portrait-fallback">
                        <div className="profile-fallback-avatar">
                            <span>{initials}</span>
                        </div>
                    </div>
                )}

                {/* Bottom dark vignette & frosted glass overlay */}
                <div className="profile-portrait-vignette"></div>

                {/* Top Bar: Left = Employee ID, Right = Role Tag */}
                <div className="profile-top-bar">
                    {/* Employee ID Pill on Left */}
                    <div className="profile-role-pill" title="Employee ID">
                        <UserIcon className="w-3.5 h-3.5 mr-1.5 text-white/90" />
                        <span>{userData.employeeId || 'ID-01'}</span>
                    </div>

                    {/* Role Tag on Right */}
                    <div className="profile-role-pill" title="Role">
                        <ShieldIcon className="w-3.5 h-3.5 mr-1.5 text-white/90" />
                        <span>{userData.role || 'Member'}</span>
                    </div>
                </div>

                {/* Photo status toast notification */}
                {photoStatus.message && (
                    <div className={`profile-toast-floating ${photoStatus.type === 'success' ? 'profile-toast--success' : 'profile-toast--error'}`}>
                        {photoStatus.message}
                    </div>
                )}

                {/* Bottom Info Content (Always visible on card) */}
                <div className="profile-bottom-info">
                    {/* Name */}
                    <div className="profile-name-row">
                        <h2
                            className="profile-name-text"
                            style={{
                                fontSize: !userData.name ? '1.75rem' : userData.name.length > 25 ? '1.32rem' : userData.name.length > 18 ? '1.52rem' : '1.75rem'
                            }}
                            title={userData.name}
                        >
                            {userData.name}
                        </h2>
                    </div>

                    {/* Designation */}
                    <p className="profile-card-designation">{userData.designation || 'Specialist'}</p>

                    {/* Department */}
                    {userData.department && (
                        <p className="profile-card-dept">{userData.department}</p>
                    )}

                    {/* Bottom Row: Contact Info on Left, Details Button on Right */}
                    <div className="profile-bottom-row">
                        <div className="profile-contact-list">
                            <div className="profile-contact-row" title="Phone">
                                <span className="profile-contact-icon">
                                    <PhoneIcon className="w-3.5 h-3.5 text-white/75" />
                                </span>
                                <span>{userData.phone || 'N/A'}</span>
                            </div>
                            <div className="profile-contact-row" title="Email">
                                <span className="profile-contact-icon">
                                    <MailIcon className="w-3.5 h-3.5 text-white/75" />
                                </span>
                                <span className="profile-contact-email">{userData.email || 'N/A'}</span>
                            </div>
                        </div>

                        <button
                            type="button"
                            className="profile-pill-btn"
                            onClick={() => setShowDrawer(true)}
                        >
                            <span>Details</span>
                            <span className="profile-pill-plus">+</span>
                        </button>
                    </div>
                </div>

                {/* ─── Slide-Up Details & Edit Drawer ─────────────────────────── */}
                <div className={`profile-drawer ${showDrawer ? 'profile-drawer--open' : ''}`}>
                    {/* Drawer drag handle */}
                    <div className="profile-drawer-handle-bar" onClick={() => setShowDrawer(false)}>
                        <div className="profile-drawer-handle"></div>
                    </div>

                    {/* Drawer Header */}
                    <div className="profile-drawer-header">
                        <div>
                            <h3 className="profile-drawer-title">Profile Settings</h3>
                            <p className="profile-drawer-subtitle">{userData.name} &middot; {userData.role}</p>
                        </div>
                        <button
                            type="button"
                            className="profile-drawer-close-btn"
                            onClick={() => setShowDrawer(false)}
                            title="Back to Card"
                        >
                            <XIcon className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Drawer Tabs */}
                    <div className="profile-drawer-tabs">
                        <button
                            type="button"
                            className={`profile-drawer-tab ${drawerTab === 'info' ? 'profile-drawer-tab--active' : ''}`}
                            onClick={() => setDrawerTab('info')}
                        >
                            <UserIcon className="w-3.5 h-3.5 mr-1.5" />
                            Information
                        </button>
                        <button
                            type="button"
                            className={`profile-drawer-tab ${drawerTab === 'security' ? 'profile-drawer-tab--active' : ''}`}
                            onClick={() => setDrawerTab('security')}
                        >
                            <ShieldIcon className="w-3.5 h-3.5 mr-1.5" />
                            Security
                        </button>
                    </div>

                    {/* Drawer Content */}
                    <div className="profile-drawer-body">
                        {drawerTab === 'info' ? (
                            <div className="space-y-4">
                                {/* Readonly ERP Details Grid */}
                                <div className="profile-info-grid">
                                    <div className="profile-info-card">
                                        <span className="profile-info-label">Employee ID</span>
                                        <span className="profile-info-val">{userData.employeeId}</span>
                                    </div>
                                    <div className="profile-info-card">
                                        <span className="profile-info-label">Designation</span>
                                        <span className="profile-info-val">{userData.designation}</span>
                                    </div>
                                    <div className="profile-info-card">
                                        <span className="profile-info-label">Department</span>
                                        <span className="profile-info-val">{userData.department}</span>
                                    </div>
                                    <div className="profile-info-card">
                                        <span className="profile-info-label">Joined</span>
                                        <span className="profile-info-val">{formatDate(userData.joiningDate)}</span>
                                    </div>
                                </div>

                                {/* Editable Fields */}
                                <div className="profile-edit-group">
                                    <label className="profile-input-label">Phone Number</label>
                                    <div className="profile-input-wrapper">
                                        <PhoneIcon className="profile-input-icon" />
                                        <input
                                            type="text"
                                            className="profile-drawer-input"
                                            value={formData.phone}
                                            onChange={(e) => {
                                                let val = e.target.value;
                                                if (!val.startsWith('+880')) {
                                                    val = '+880' + val.replace(/^\+880?/, '');
                                                }
                                                if (val.length <= 14) {
                                                    setFormData({ ...formData, phone: val });
                                                }
                                            }}
                                            placeholder="+880XXXXXXXXXX"
                                            maxLength={14}
                                        />
                                    </div>
                                </div>

                                <div className="profile-edit-group">
                                    <label className="profile-input-label">Email Address</label>
                                    <div className="profile-input-wrapper">
                                        <MailIcon className="profile-input-icon" />
                                        <input
                                            type="email"
                                            className="profile-drawer-input"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            placeholder="name@example.com"
                                        />
                                    </div>
                                </div>

                                {saveStatus.message && (
                                    <p className={`profile-status-message ${saveStatus.type === 'error' ? 'profile-status--error' : 'profile-status--success'}`}>
                                        {saveStatus.message}
                                    </p>
                                )}

                                {/* Save Button */}
                                <button
                                    type="button"
                                    className="profile-submit-btn"
                                    onClick={handleSave}
                                    disabled={isSaving}
                                >
                                    {isSaving ? 'Saving...' : 'Save Details'}
                                </button>

                                {/* Photo Management in Drawer */}
                                <div className="profile-photo-options">
                                    <button
                                        type="button"
                                        className="profile-sub-btn"
                                        onClick={() => photoInputRef.current?.click()}
                                        disabled={isUploadingPhoto}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 mr-1.5">
                                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                                            <circle cx="12" cy="13" r="4"></circle>
                                        </svg>
                                        {photoPreview ? 'Change Photo' : 'Upload Photo'}
                                    </button>

                                    {photoPreview && (
                                        <button
                                            type="button"
                                            className="profile-sub-btn"
                                            onClick={() => {
                                                const img = new Image();
                                                img.onload = () => {
                                                    loadedImgRef.current = img;
                                                    setCropSrc(photoPreview);
                                                    setCropOffset({ x: 0, y: 0 });
                                                    setCropScale(1);
                                                    setIsCropping(true);
                                                };
                                                img.src = photoPreview;
                                            }}
                                            disabled={isUploadingPhoto}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 mr-1.5">
                                                <circle cx="12" cy="12" r="10"></circle>
                                                <circle cx="12" cy="10" r="3"></circle>
                                                <path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"></path>
                                            </svg>
                                            Adjust Navbar Avatar
                                        </button>
                                    )}

                                    {photoPreview && (
                                        <button
                                            type="button"
                                            className="profile-sub-btn profile-sub-btn--danger"
                                            onClick={handleRemovePhoto}
                                            disabled={isUploadingPhoto}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 mr-1.5">
                                                <polyline points="3 6 5 6 21 6"></polyline>
                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                            </svg>
                                            Remove Photo
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            /* Security Tab */
                            <form onSubmit={handlePasswordChange} className="space-y-4">
                                <div className="profile-edit-group">
                                    <label className="profile-input-label">Current Password</label>
                                    <input
                                        type="password"
                                        className="profile-drawer-input"
                                        value={passwordData.currentPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>

                                <div className="profile-edit-group">
                                    <label className="profile-input-label">New Password</label>
                                    <input
                                        type="password"
                                        className="profile-drawer-input"
                                        value={passwordData.newPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>

                                <div className="profile-edit-group">
                                    <label className="profile-input-label">Confirm New Password</label>
                                    <input
                                        type="password"
                                        className="profile-drawer-input"
                                        value={passwordData.confirmPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>

                                {passwordStatus.message && (
                                    <p className={`profile-status-message ${passwordStatus.type === 'error' ? 'profile-status--error' : 'profile-status--success'}`}>
                                        {passwordStatus.message}
                                    </p>
                                )}

                                <button
                                    type="submit"
                                    className="profile-submit-btn"
                                    disabled={isSaving}
                                >
                                    {isSaving ? 'Updating...' : 'Update Password'}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </div>

            {/* ─── Crop / Reposition Modal ─────────────────────────────────── */}
            {isCropping && cropSrc && (
                <div className="crop-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setIsCropping(false); setCropSrc(null); } }}>
                    <div className="crop-modal">
                        <div className="crop-modal-header">
                            <h3 className="crop-modal-title">Position Navbar Avatar</h3>
                            <p className="crop-modal-hint">Drag & zoom to position your face for the circular navbar avatar</p>
                        </div>

                        {/* Live preview viewport */}
                        <div
                            className="crop-preview-circle"
                            onMouseDown={onCropMouseDown}
                            onTouchStart={onCropTouchStart}
                            onWheel={onCropWheel}
                            onDoubleClick={onCropDoubleClick}
                            title="Drag to reposition, double-click to reset"
                        >
                            <canvas
                                ref={previewCanvasRef}
                                width={PREVIEW_PX}
                                height={PREVIEW_PX}
                                className="crop-preview-canvas"
                            />
                            <div className="crop-circle-ring"></div>
                        </div>

                        {/* Zoom control row */}
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
                                Save Avatar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Profile;
