const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});
console.log('Cloudinary initialized with Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME);

// Set up storage engine
let storage;

if (process.env.CLOUDINARY_CLOUD_NAME) {
    console.log('Using Cloudinary Storage');
    storage = new CloudinaryStorage({
        cloudinary: cloudinary,
        params: async (req, file) => {
            // Get folder from query param, default to 'smart-salon/misc'
            // Format: smart-salon/profiles or smart-salon/salons
            const folderName = req.query.folder ? `smart-salon/${req.query.folder}` : 'smart-salon/misc';
            return {
                folder: folderName,
                allowed_formats: ['jpg', 'png', 'jpeg', 'heic', 'webp', 'gif'],
                public_id: file.fieldname + '-' + Date.now(),
            };
        },
    });
} else {
    console.log('Using Local Storage (Cloudinary credentials missing)');

    // Ensure uploads directory exists
    const uploadDir = './uploads/';
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir);
    }

    storage = multer.diskStorage({
        destination: uploadDir,
        filename: function (req, file, cb) {
            cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
        }
    });
}

const deleteImage = async (imageUrl) => {
    try {
        if (!imageUrl || !imageUrl.includes('cloudinary.com')) return;

        // Extract public ID from URL
        // Example: https://res.cloudinary.com/cloudname/image/upload/v12345/folder/id.jpg
        const parts = imageUrl.split('/');
        const fileName = parts[parts.length - 1];
        const publicIdWithoutExt = fileName.split('.')[0];

        // Find the folder part (e.g., smart-salon/profiles)
        const uploadIndex = parts.indexOf('upload');
        const folderParts = parts.slice(uploadIndex + 2, parts.length - 1);
        const publicId = folderParts.length > 0
            ? `${folderParts.join('/')}/${publicIdWithoutExt}`
            : publicIdWithoutExt;

        console.log('Attempting to delete from Cloudinary:', publicId);
        const result = await cloudinary.uploader.destroy(publicId);
        return result;
    } catch (error) {
        console.error('Cloudinary Deletion Error:', error);
    }
};

module.exports = { cloudinary, storage, deleteImage };
