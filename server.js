const express = require('express');
const path = require('path');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// --- MongoDB Connection ---
// ¡IMPORTANTE! Usa una variable de entorno en Render para esto.
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

let db;

async function connectToMongo() {
    try {
        await client.connect();
        db = client.db('HoneySmashBurger'); // Puedes nombrar tu base deatos como quieras
        console.log('Conectado exitosamente a MongoDB Atlas');
    } catch (err) {
        console.error('Error al conectar a MongoDB:', err);
        process.exit(1); // Si no se puede conectar, detiene el servidor
    }
}

connectToMongo();

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Endpoint para obtener el ranking desde MongoDB
app.get('/ranking', async (req, res) => {
    try {
        const ranking = await db.collection('rankings').find().sort({ score: -1 }).limit(20).toArray();
        res.json(ranking);
    } catch (err) {
        console.error('Error al obtener el ranking:', err);
        res.status(500).send('Error al leer el ranking.');
    }
});

// Endpoint para validar un código de juego desde MongoDB
app.post('/api/validate-code', async (req, res) => {
    const { code } = req.body;

    if (!code) {
        return res.status(400).json({ valid: false, message: 'No se ha proporcionado ningún código.' });
    }

    try {
        const foundCode = await db.collection('codes').findOne({ code: code });

        if (foundCode) {
            if (!foundCode.used) {
                res.json({ valid: true, message: 'Código válido.' });
            } else {
                res.status(403).json({ valid: false, message: 'Este código ya ha sido utilizado.' });
            }
        } else {
            res.status(404).json({ valid: false, message: 'El código no existe.' });
        }
    } catch (err) {
        console.error('Error al validar el código:', err);
        res.status(500).json({ valid: false, message: 'Error interno del servidor.' });
    }
});

// Endpoint para guardar la puntuación en MongoDB
app.post('/save-score', async (req, res) => {
    const { name, score, code, phone } = req.body; // Añadido 'phone'

    if (!name || name.trim() === '' || !code || typeof score !== 'number' || !phone) { // Añadida validación para 'phone'
        return res.status(400).send('Datos de puntuación no válidos o incompletos.');
    }

    try {
        const codeData = await db.collection('codes').findOne({ code: code });

        if (!codeData) {
            return res.status(404).send('El código proporcionado no es válido.');
        }
        if (codeData.used) {
            return res.status(403).send('Este código ya ha sido utilizado.');
        }

        // Marcar el código como usado
        const updateResult = await db.collection('codes').updateOne(
            { code: code },
            { $set: { used: true, usedDate: new Date(), playerName: name, score: score, playerPhone: phone } } // Añadido 'playerPhone'
        );

        if (updateResult.modifiedCount === 0) {
            return res.status(500).send('Error al actualizar el estado del código.');
        }

        // Guardar la puntuación en la colección de ranking
        const playerData = { name, score, phone, date: new Date() }; // Añadido 'phone'
        await db.collection('rankings').insertOne(playerData);

        res.send('Puntuación guardada y código actualizado correctamente.');

    } catch (err) {
        console.error('Error al guardar la puntuación:', err);
        res.status(500).send('Error al guardar la puntuación.');
    }
});

// Mantengo tu router de api.js por si lo usas para otras cosas
// const apiRouter = require('./api');
// app.use('/api', apiRouter);

app.listen(port, '0.0.0.0', () => {
    console.log(`==> NUEVA VERSIÓN: Servidor escuchando en el puerto ${port} <==`);
});