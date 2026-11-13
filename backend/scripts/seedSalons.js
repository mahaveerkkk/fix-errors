const mongoose = require('mongoose');
const Salon = require('../models/Salon');
const User = require('../models/User');
require('dotenv').config();

const seedSalons = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected');

        // create a dummy owner if needed, but for now just random ID
        const ownerId = new mongoose.Types.ObjectId();

        const dummySalon = {
            ownerId: ownerId,
            name: "Luxe Cuts & Spa",
            address: "Connaught Place, New Delhi",
            location: {
                lat: 28.6139,
                lng: 77.2090
            },
            status: 'open',
            services: [
                { name: "Haircut", price: 500, duration: 30 },
                { name: "Massage", price: 1200, duration: 60 }
            ],
            staff: [
                { name: "Rahul", role: "Barber" },
                { name: "Simran", role: "Stylist" }
            ],
            images: ["https://via.placeholder.com/300"],
            rating: 4.5,
            reviews: []
        };

        await Salon.create(dummySalon);
        console.log('✅ Dummy Salon Added!');
        process.exit();
    } catch (error) {
        console.error('Error seeding:', error);
        process.exit(1);
    }
};

seedSalons();
