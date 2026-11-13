const multer = require('multer');
const { storage } = require('../utils/cloudinary');

// Init upload
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
}).single('image');

exports.uploadImage = (req, res) => {
    upload(req, res, (err) => {
        if (err) {
            return res.status(400).json({ error: err.message || err });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No file selected!' });
        }
        // Return the file path (Cloudinary URL or local path)
        const filePath = req.file.path || `/uploads/${req.file.filename}`;

        res.status(200).json({
            message: 'File uploaded!',
            filePath: filePath
        });
    });
};
