// server.js - Serveur Node.js avec Express + WebSocket
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Servir les fichiers statiques
app.use(express.static('public'));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/sender', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'sender.html'));
});

app.get('/receiver', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'receiver.html'));
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', sessions: sessions.size });
});

// Stockage des sessions actives
const sessions = new Map();

// Validation du code de session (4 caractères alphanumériques)
function isValidSessionCode(code) {
    return typeof code === 'string' && /^[A-Z0-9]{4}$/i.test(code);
}

io.on('connection', (socket) => {
    console.log(`[${socket.id}] Client connecté`);

    // Émetteur : créer une session
    socket.on('create-session', ({ sessionCode }) => {
        if (!isValidSessionCode(sessionCode)) {
            socket.emit('error', { message: 'Code de session invalide (4 caractères alphanumériques requis)' });
            return;
        }
        console.log(`[${socket.id}] Création session: ${sessionCode}`);

        sessions.set(sessionCode, {
            senderId: socket.id,
            senderOffer: null,
            senderCandidates: [],
            receiverId: null,
            receiverAnswer: null,
            receiverCandidates: []
        });

        socket.join(sessionCode);
        socket.emit('session-created', { sessionCode });
    });

    // Émetteur : envoyer l'offre SDP
    socket.on('send-offer', ({ sessionCode, offer }) => {
        console.log(`[${socket.id}] Offre SDP pour session ${sessionCode}`);

        const session = sessions.get(sessionCode);
        if (session && session.senderId === socket.id) {
            session.senderOffer = offer;

            if (session.receiverId) {
                io.to(session.receiverId).emit('receive-offer', { offer });
            }
        }
    });

    // ICE candidates (peer-to-peer)
    socket.on('send-ice-candidate', ({ sessionCode, candidate }) => {
        const session = sessions.get(sessionCode);
        if (!session) return;

        if (session.senderId === socket.id) {
            session.senderCandidates.push(candidate);
            if (session.receiverId) {
                io.to(session.receiverId).emit('receive-ice-candidate', { candidate });
            }
        } else if (session.receiverId === socket.id) {
            session.receiverCandidates.push(candidate);
            io.to(session.senderId).emit('receive-ice-candidate', { candidate });
        }
    });

    // Récepteur : rejoindre une session
    socket.on('join-session', ({ sessionCode }) => {
        if (!isValidSessionCode(sessionCode)) {
            socket.emit('error', { message: 'Code de session invalide (4 caractères alphanumériques requis)' });
            return;
        }
        console.log(`[${socket.id}] Tentative de connexion à session: ${sessionCode}`);

        const session = sessions.get(sessionCode);
        if (!session) {
            socket.emit('error', { message: 'Session non trouvée' });
            return;
        }

        session.receiverId = socket.id;
        socket.join(sessionCode);

        if (session.senderOffer) {
            socket.emit('receive-offer', { offer: session.senderOffer });
        }

        session.senderCandidates.forEach(candidate => {
            socket.emit('receive-ice-candidate', { candidate });
        });

        socket.emit('session-joined', { sessionCode });

        // Notifier l'émetteur qu'un récepteur s'est connecté
        io.to(session.senderId).emit('receiver-connected');

        console.log(`[${socket.id}] Connecté à session ${sessionCode}`);
    });

    // Récepteur : envoyer la réponse SDP
    socket.on('send-answer', ({ sessionCode, answer }) => {
        console.log(`[${socket.id}] Réponse SDP pour session ${sessionCode}`);

        const session = sessions.get(sessionCode);
        if (session && session.receiverId === socket.id) {
            session.receiverAnswer = answer;
            io.to(session.senderId).emit('receive-answer', { answer });

            session.receiverCandidates.forEach(candidate => {
                io.to(session.senderId).emit('receive-ice-candidate', { candidate });
            });
        }
    });

    // Déconnexion
    socket.on('disconnect', () => {
        console.log(`[${socket.id}] Client déconnecté`);

        for (const [code, session] of sessions.entries()) {
            if (session.senderId === socket.id) {
                console.log(`Session ${code} fermée (émetteur déconnecté)`);
                if (session.receiverId) {
                    io.to(session.receiverId).emit('sender-disconnected');
                }
                sessions.delete(code);
            } else if (session.receiverId === socket.id) {
                console.log(`Récepteur déconnecté de session ${code}`);
                session.receiverId = null;
                io.to(session.senderId).emit('receiver-disconnected');
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║  🚀 Serveur WebRTC P2P démarré                            ║
║                                                            ║
║  📡 Port: ${PORT}                                            ║
║  🏠 Homepage: http://0.0.0.0:${PORT}/                        ║
║  ❤️  Health: http://0.0.0.0:${PORT}/health                   ║
║                                                            ║
║  ⚡ Le flux vidéo transite en PEER-TO-PEER                ║
║     Ce serveur sert UNIQUEMENT à la signalisation          ║
╚════════════════════════════════════════════════════════════╝
    `);
});