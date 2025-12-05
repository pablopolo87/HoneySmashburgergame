const express = require('express');
const path = require('path');
const cors = require('cors');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// --- MongoDB Connection ---
// ¡IMPORTANTE! Usa una variable de entorno en Render para esto.
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
    retryWrites: true,
    retryReads: true,
    tls: true
});

let db;
let isConnected = false;

async function connectToMongo() {
    try {
        await client.connect();
        db = client.db('HoneySmashBurger');
        isConnected = true;
        console.log('Conectado exitosamente a MongoDB Atlas');
    } catch (err) {
        console.error('Error al conectar a MongoDB:', err);
        isConnected = false;
        setTimeout(connectToMongo, 5000);
    }
}

connectToMongo();

async function ensureCollections() {
    if (!db || !isConnected) {
        console.log('MongoDB aún no conectado, reintentando en 2s...');
        setTimeout(ensureCollections, 2000);
        return;
    }
    
    try {
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);
        
        if (!collectionNames.includes('codes')) {
            await db.createCollection('codes');
            console.log('Colección "codes" creada');
        }
        if (!collectionNames.includes('rankings')) {
            await db.createCollection('rankings');
            console.log('Colección "rankings" creada');
        }
        if (!collectionNames.includes('halloffame')) {
            await db.createCollection('halloffame');
            console.log('Colección "halloffame" creada');
        }
        console.log('Colecciones verificadas:', collectionNames);
    } catch (err) {
        console.error('Error al verificar colecciones:', err);
    }
}

setTimeout(ensureCollections, 2000);

// Middleware para verificar conexión a MongoDB
const checkMongoConnection = (req, res, next) => {
    if (!isConnected || !db) {
        return res.status(503).json({ error: 'Base de datos no disponible. Intenta de nuevo.' });
    }
    next();
};

// Endpoint para obtener el ranking desde MongoDB
app.get('/ranking', checkMongoConnection, async (req, res) => {
    try {
        const ranking = await db.collection('rankings').find().sort({ score: -1 }).limit(30).toArray();
        res.json(ranking);
    } catch (err) {
        console.error('Error al obtener el ranking:', err);
        res.status(500).json({ success: false, message: 'Error al leer el ranking.' });
    }
});

// Endpoint para obtener el Hall of Fame (histórico TOP 15)
app.get('/halloffame', checkMongoConnection, async (req, res) => {
    try {
        const halloffame = await db.collection('halloffame').find().sort({ score: -1 }).limit(15).toArray();
        
        if (halloffame.length === 0) {
            const topFromRanking = await db.collection('rankings').find().sort({ score: -1 }).limit(15).toArray();
            return res.json(topFromRanking);
        }
        
        res.json(halloffame);
    } catch (err) {
        console.error('Error al obtener el Hall of Fame:', err);
        res.status(500).json({ success: false, message: 'Error al leer el Hall of Fame.' });
    }
});

// Endpoint para validar un código de juego desde MongoDB
app.post('/api/validate-code', checkMongoConnection, async (req, res) => {
    const { code } = req.body;
    console.log('Received code for validation:', code);

    if (!code) {
        return res.status(400).json({ valid: false, message: 'No se ha proporcionado ningún código.' });
    }

    try {
        const foundCode = await db.collection('codes').findOne({ code: { $regex: `^${code}$`, $options: 'i' } });
        console.log('Result of findOne query:', foundCode);
        
        if (!foundCode) {
            return res.status(404).json({ valid: false, message: 'El código no existe.' });
        }
        
        if (foundCode.used) {
            console.log(`Código ${code} ya fue usado por ${foundCode.playerName}`);
            return res.status(403).json({ valid: false, message: 'Este código ya ha sido utilizado.' });
        }
        
        console.log(`Código ${code} validado correctamente`);
        res.json({ valid: true, message: 'Código válido. ¡Que comience la partida!' });
        
    } catch (err) {
        console.error('Error al validar el código:', err);
        res.status(500).json({ valid: false, message: 'Error interno del servidor.' });
    }
});

// Endpoint para guardar la puntuación en MongoDB
app.post('/save-score', checkMongoConnection, async (req, res) => {
    const { name, score, code, phone } = req.body;

    if (!name || name.trim() === '' || !code || typeof score !== 'number' || !phone) {
        return res.status(400).json({ success: false, message: 'Datos de puntuación no válidos o incompletos.' });
    }

    try {
        const codeData = await db.collection('codes').findOne({ code: { $regex: `^${code}$`, $options: 'i' } });

        if (!codeData) {
            console.error(`Código ${code} no encontrado al intentar guardar puntuación`);
            return res.status(404).json({ success: false, message: 'El código proporcionado no es válido.' });
        }
        
        if (codeData.used) {
            console.error(`Código ${code} ya fue utilizado previamente`);
            return res.status(403).json({ success: false, message: 'Este código ya ha sido utilizado.' });
        }

        // Marcar el código como usado y actualizar datos
        const updateResult = await db.collection('codes').updateOne(
            { code: codeData.code },
            { $set: { used: true, usedDate: new Date(), playerName: name, score: score, playerPhone: phone } }
        );

        if (updateResult.modifiedCount === 0) {
            console.error(`Error al actualizar código ${code}`);
            return res.status(500).json({ success: false, message: 'Error al actualizar el estado del código.' });
        }

        // Guardar la puntuación en la colección de ranking
        const playerData = { name, score, phone, date: new Date(), code: code };
        await db.collection('rankings').insertOne(playerData);

        // Actualizar Hall of Fame si es necesario (mantiene TOP 15 histórico)
        try {
            const existingEntry = await db.collection('halloffame').findOne({ code: code });
            const lowestInHallOfFame = await db.collection('halloffame').find().sort({ score: 1 }).limit(1).toArray();
            const hallofameCount = await db.collection('halloffame').countDocuments();
            
            if (existingEntry) {
                if (score > existingEntry.score) {
                    await db.collection('halloffame').updateOne(
                        { code: code },
                        { $set: { name, score, phone, date: new Date() } }
                    );
                    console.log(`Hall of Fame actualizado: ${name} - ${score} puntos`);
                }
            } else if (hallofameCount < 15 || (lowestInHallOfFame.length > 0 && score > lowestInHallOfFame[0].score)) {
                await db.collection('halloffame').insertOne({ name, score, phone, date: new Date(), code: code });
                if (hallofameCount >= 15) {
                    await db.collection('halloffame').deleteOne({ _id: lowestInHallOfFame[0]._id });
                }
                console.log(`Hall of Fame actualizado: ${name} - ${score} puntos`);
            }
        } catch (halloffameErr) {
            console.error('Error al actualizar Hall of Fame:', halloffameErr);
        }
        
        console.log(`Puntuación guardada: ${name} - ${score} puntos (Código: ${code})`);
        res.json({ success: true, message: 'Puntuación guardada y código actualizado correctamente.', score: score, name: name });

    } catch (err) {
        console.error('Error al guardar la puntuación:', err);
        res.status(500).json({ success: false, message: 'Error al guardar la puntuación.' });
    }
});

// Endpoint para limpiar ranking y garantizar que el TOP 15 histórico esté en Hall of Fame
app.post('/cleanup-ranking', checkMongoConnection, async (req, res) => {
    const cleanupSecret = process.env.CLEANUP_SECRET;
    const providedSecret = req.headers['x-cleanup-secret'] || req.body?.secret;
    
    if (!cleanupSecret || providedSecret !== cleanupSecret) {
        return res.status(401).json({ success: false, message: 'Acceso no autorizado. Token inválido.' });
    }
    
    try {
        const top15Rankings = await db.collection('rankings').find().sort({ score: -1 }).limit(15).toArray();
        
        for (const player of top15Rankings) {
            const existingEntry = await db.collection('halloffame').findOne({ code: player.code });
            const lowestInHallOfFame = await db.collection('halloffame').find().sort({ score: 1 }).limit(1).toArray();
            const hallofameCount = await db.collection('halloffame').countDocuments();
            
            if (existingEntry) {
                if (player.score > existingEntry.score) {
                    await db.collection('halloffame').updateOne(
                        { code: player.code },
                        { $set: { name: player.name, score: player.score, phone: player.phone, date: new Date() } }
                    );
                    console.log(`Hall of Fame actualizado (cleanup): ${player.name} - ${player.score} puntos`);
                }
            } else if (hallofameCount < 15 || (lowestInHallOfFame.length > 0 && player.score > lowestInHallOfFame[0].score)) {
                await db.collection('halloffame').insertOne({ name: player.name, score: player.score, phone: player.phone, date: new Date(), code: player.code });
                if (hallofameCount >= 15) {
                    await db.collection('halloffame').deleteOne({ _id: lowestInHallOfFame[0]._id });
                }
                console.log(`Hall of Fame añadido (cleanup): ${player.name} - ${player.score} puntos`);
            }
        }
        
        const deleteResult = await db.collection('rankings').deleteMany({});
        console.log(`Ranking limpiado. ${deleteResult.deletedCount} registros eliminados. Hall of Fame ahora contiene el TOP 15 histórico.`);
        
        res.json({ success: true, message: `Ranking limpiado exitosamente. ${top15Rankings.length} jugadores verificados en Hall of Fame.`, playersProcessed: top15Rankings.length });
    } catch (err) {
        console.error('Error al limpiar el ranking:', err);
        res.status(500).json({ success: false, message: 'Error al limpiar el ranking.' });
    }
});

// Mantengo tu router de api.js por si lo usas para otras cosas
// const apiRouter = require('./api');
// app.use('/api', apiRouter);

app.listen(port, '0.0.0.0', () => {
    console.log(`==> NUEVA VERSIÓN: Servidor escuchando en el puerto ${port} <==`);
});
