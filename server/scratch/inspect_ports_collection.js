const mongoose = require('mongoose');
const Port = require('../src/models/Port');
const { decryptData } = require('../src/utils/encryption');

mongoose.connect('mongodb://127.0.0.1:27017/erp_db').then(async () => {
    const rawPorts = await Port.find({});
    const ports = rawPorts.map(r => {
        try {
            return { ...decryptData(r.data), _id: r._id };
        } catch (e) {
            return { data: r.data, _id: r._id };
        }
    });
    console.log("Ports in Port collection:");
    ports.forEach(p => {
        console.log(`ID: ${p._id} | Name: "${p.name}" | Code: "${p.code}" | Location: "${p.location}"`);
    });
    process.exit(0);
});
