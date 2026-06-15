const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        const mongoURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/school_management";
        
        console.log("📡 Connecting to MongoDB...");
        console.log(`📍 URI: ${mongoURI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')}`);
        
        // Remove deprecated options - they are now default in Mongoose 6+
        const conn = await mongoose.connect(mongoURI);
        
        console.log(`✅ MongoDB Connected: ${conn.connection.host}:${conn.connection.port || 27017}`);
        console.log(`📊 Database Name: ${conn.connection.name}`);
        
        // Handle connection events
        mongoose.connection.on('error', (err) => {
            console.error('❌ MongoDB connection error:', err);
        });
        
        mongoose.connection.on('disconnected', () => {
            console.log('⚠️ MongoDB disconnected, attempting to reconnect...');
        });
        
        mongoose.connection.on('reconnected', () => {
            console.log('✅ MongoDB reconnected');
        });
        
        return conn;
    } catch (error) {
        console.error("❌ MongoDB Connection Error:", error.message);
        console.log("🔄 Will retry connection in 5 seconds...");
        
        // Retry connection after 5 seconds
        setTimeout(() => {
            connectDB();
        }, 5000);
        
        return null;
    }
};

module.exports = connectDB;