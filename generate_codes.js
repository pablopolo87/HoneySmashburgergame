
const { MongoClient } = require('mongodb');
require('dotenv').config();

// --- Configuration ---
// Make sure you have a .env file with your MONGODB_URI
const uri = process.env.MONGODB_URI;
const dbName = 'HoneySmashBurger'; // The database name from your server.js
const collectionName = 'codes'; // The collection name for codes
const numberOfCodesToGenerate = 1000;
const codePrefix = 'HONEY-';

/**
 * Generates a random 5-digit alphanumeric string.
 * Using alphanumeric to increase the number of possible combinations and avoid collisions.
 */
function generateRandomCodePart() {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < 5; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Main function to generate and insert codes into MongoDB.
 */
async function generateCodes() {
    if (!uri) {
        console.error('Error: MONGODB_URI is not defined.');
        console.error('Please create a .env file in the same directory with your MongoDB connection string.');
        console.error('Example .env file content:');
        console.error('MONGODB_URI="mongodb+srv://user:password@cluster.mongodb.net/yourDbName?retryWrites=true&w=majority"');
        process.exit(1);
    }

    const client = new MongoClient(uri);

    try {
        // Connect to the MongoDB cluster
        await client.connect();
        console.log('Successfully connected to MongoDB Atlas.');

        const db = client.db(dbName);
        const codesCollection = db.collection(collectionName);

        console.log(`Generating ${numberOfCodesToGenerate} new codes...`);

        const newCodes = [];
        for (let i = 0; i < numberOfCodesToGenerate; i++) {
            const newCode = {
                code: `${codePrefix}${generateRandomCodePart()}`,
                used: false,
                playerName: null,
                playerPhone: null,
                score: null,
                createdDate: new Date()
            };
            newCodes.push(newCode);
        }

        // Insert the generated codes into the database
        const result = await codesCollection.insertMany(newCodes, { ordered: false });
        console.log(`${result.insertedCount} new codes were successfully inserted.`);
        console.log('You can now see these codes in your MongoDB Atlas "codes" collection.');

    } catch (err) {
        console.error('An error occurred while generating codes:', err);
    } finally {
        // Ensures that the client will close when you finish/error
        await client.close();
        console.log('MongoDB connection closed.');
    }
}

// Run the generation script
generateCodes();
