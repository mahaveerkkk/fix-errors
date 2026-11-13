const mongoose = require('mongoose');
const Salon = require('./models/Salon');
require('dotenv').config();

const checkSalons = async () => {
    try {
        console.log("Connecting to DB...");
        // Fallback to local if env missing (just a guess, but loopback might work)
        const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartsalon'; 
        
        await mongoose.connect(uri);
        console.log('Connected!');
        
        const salons = await Salon.find({});
        console.log(`Total Salons Found: ${salons.length}`);
        
        if (salons.length === 0) {
            console.log("DB IS EMPTY. Creating a seed salon...");
            const newSalon = new Salon({
                name: "Luxe Premium Salon",
                address: "Connaught Place, New Delhi",
                location: { lat: 28.6304, lng: 77.2177 }, // Central Delhi
                status: 'open',
                ownerId: new mongoose.Types.ObjectId(), // Fake owner
                services: [
                    { name: "Haircut", price: 500, duration: 30, category: "Hair" },
                    { name: "Facial", price: 1200, duration: 60, category: "Face" }
                ],
                images: ["https://images.unsplash.com/photo-1560066984-138dadb4c035?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60"],
                rating: 4.8,
                reviewsCount: 120
            });
            await newSalon.save();
            console.log("Seed Salon Created: Luxe Premium Salon");
        } else {
            salons.forEach(s => {
                console.log(`- ${s.name} (${s.status}) [Lat: ${s.location?.lat}, Lng: ${s.location?.lng}]`);
            });
        }

        process.exit();
    } catch (error) {
        console.error("DB Error:", error);
        process.exit(1);
    }
};

checkSalons();
