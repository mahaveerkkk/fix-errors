require('dotenv').config();
const Razorpay = require('razorpay');

const testRazorpay = async () => {
    console.log('Testing Razorpay Connection...');
    console.log('Key ID:', process.env.RAZORPAY_KEY_ID ? 'Loaded ✅' : 'Missing ❌');
    console.log('Key Secret:', process.env.RAZORPAY_KEY_SECRET ? 'Loaded ✅' : 'Missing ❌');

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        console.error('❌ Keys missing in .env');
        return;
    }

    const instance = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    try {
        const order = await instance.orders.create({
            amount: 50000, // 500 INR
            currency: "INR",
            receipt: "receipt#1",
            notes: {
                key1: "value3",
                key2: "value2"
            }
        });
        console.log('✅ Success! Order Created:', order);
    } catch (error) {
        console.error('❌ Razorpay Error:', error);
    }
};

testRazorpay();
