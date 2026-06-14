const mongoose = require('mongoose');
const Notification = require('../src/models/Notification');
const { decryptData } = require('../src/utils/encryption');

function decryptRecord(r) {
    if (!r) return null;
    let d = decryptData(r.data);
    if (d && d.data && typeof d.data === 'string' && !d.title) {
        try { d = decryptData(d.data); } catch (e) {}
    }
    return { ...d, _id: r._id, createdAt: r.createdAt.toISOString() };
}

mongoose.connect('mongodb://127.0.0.1:27017/erp_db').then(async () => {
    const rawNotifications = await Notification.find({});
    console.log(`Total notifications found: ${rawNotifications.length}`);
    
    rawNotifications.forEach((n, idx) => {
        const d = decryptRecord(n);
        console.log(`${idx + 1}. [${d.createdAt}] Title: ${d.title} | Message: ${d.message} | Users: ${JSON.stringify(d.users)} | Roles: ${JSON.stringify(d.roles)}`);
    });
    
    process.exit(0);
});
