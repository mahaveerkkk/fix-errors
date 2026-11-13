// Seed dummy reviews for testing
require('dotenv').config();
const mongoose = require('mongoose');

const Review = require('../models/Review');
const Salon = require('../models/Salon');
const User = require('../models/User');

const MONGO_URI = process.env.MONGO_URI;

const dummyReviews = [
    {
        rating: 5,
        comment: "Amazing experience! The staff was very professional and friendly. Highly recommended for anyone looking for quality service.",
        userName: "Priya Sharma"
    },
    {
        rating: 4,
        comment: "Good service overall. The salon is clean and well-maintained. Wait time was a bit long but worth it.",
        userName: "Rahul Verma"
    },
    {
        rating: 5,
        comment: "Best salon in the area! Love the modern equipment and skilled stylists. Will definitely come back.",
        userName: "Anjali Patel"
    },
    {
        rating: 4,
        comment: "Nice ambiance and courteous staff. Pricing is reasonable for the quality they offer.",
        userName: "Vikram Singh"
    },
    {
        rating: 5,
        comment: "Excellent haircut! The stylist understood exactly what I wanted. Very satisfied with the result.",
        userName: "Neha Gupta"
    },
    {
        rating: 3,
        comment: "Average experience. Service was okay but nothing exceptional. Could improve on timing.",
        userName: "Amit Kumar"
    },
    {
        rating: 5,
        comment: "Top-notch salon! The queue system is brilliant - no more waiting aimlessly. Love the app integration!",
        userName: "Sneha Reddy"
    },
    {
        rating: 4,
        comment: "Great haircut and beard trim. The hot towel service was relaxing. Will visit again.",
        userName: "Arjun Mehta"
    }
];

async function seedReviews() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Get first salon
        const salon = await Salon.findOne();
        if (!salon) {
            console.log('❌ No salon found. Please create a salon first.');
            process.exit(1);
        }
        console.log(`📍 Found salon: ${salon.name} (${salon._id})`);

        // Get or create dummy users for reviews
        let users = await User.find({ role: 'user' }).limit(8);

        if (users.length < 8) {
            console.log('Creating dummy users for reviews...');
            for (let i = users.length; i < 8; i++) {
                const newUser = new User({
                    name: dummyReviews[i].userName,
                    email: `user${i + 1}@test.com`,
                    phone: `98765432${i}0`,
                    role: 'user',
                    firebaseUid: `dummy_review_user_${i + 1}`
                });
                await newUser.save();
                users.push(newUser);
            }
        }

        // Clear existing reviews for this salon (optional)
        await Review.deleteMany({ salonId: salon._id });
        console.log('🗑️ Cleared existing reviews');

        // Add new reviews
        let totalRating = 0;
        for (let i = 0; i < dummyReviews.length; i++) {
            const review = new Review({
                salonId: salon._id,
                userId: users[i]._id,
                rating: dummyReviews[i].rating,
                comment: dummyReviews[i].comment,
                createdAt: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)) // Spread over last 8 days
            });
            await review.save();
            totalRating += dummyReviews[i].rating;
            console.log(`⭐ Added review from ${dummyReviews[i].userName}: ${dummyReviews[i].rating} stars`);
        }

        // Update salon rating
        const avgRating = totalRating / dummyReviews.length;
        salon.rating = avgRating;
        salon.reviewCount = dummyReviews.length;
        await salon.save();

        console.log(`\n✅ Added ${dummyReviews.length} reviews to ${salon.name}`);
        console.log(`⭐ Average Rating: ${avgRating.toFixed(1)}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

seedReviews();
