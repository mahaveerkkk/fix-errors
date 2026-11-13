const mongoose = require('mongoose');

const appConfigSchema = new mongoose.Schema({
    latestVersion: { type: String, required: true },
    forceUpdate: { type: Boolean, default: false },
    updateUrl: { type: String, required: true },
    updateMessage: { type: String }
}, { timestamps: true });

// We only need one configuration document in the DB
module.exports = mongoose.model('AppConfig', appConfigSchema);
