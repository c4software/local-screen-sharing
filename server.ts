// server.ts - Serveur Node.js avec Express + WebSocket
import express, { type Request, type Response } from 'express';
import { createServer } from 'http';
import { Server, type Socket } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Types WebRTC (définis manuellement car absents côté serveur)
interface RTCSessionDescriptionInit {
    type: 'offer' | 'answer' | 'pranswer' | 'rollback';
    sdp?: string;
}

interface RTCIceCandidateInit {
    candidate?: string;
    sdpMLineIndex?: number | null;
    sdpMid?: string | null;
    usernameFragment?: string | null;
}

// Types pour les événements Socket.io
interface ServerToClientEvents {
    'session-created': (data: { sessionCode: string }) => void;
    'session-joined': (data: { sessionCode: string }) => void;
    'receive-offer': (data: { offer: RTCSessionDescriptionInit }) => void;
    'receive-answer': (data: { answer: RTCSessionDescriptionInit }) => void;
    'receive-ice-candidate': (data: { candidate: RTCIceCandidateInit }) => void;
    'receiver-connected': () => void;
    'receiver-disconnected': () => void;
    'sender-disconnected': () => void;
    'error': (data: { message: string }) => void;
}

interface ClientToServerEvents {
    'create-session': (data: { sessionCode: string }) => void;
    'join-session': (data: { sessionCode: string }) => void;
    'send-offer': (data: { sessionCode: string; offer: RTCSessionDescriptionInit }) => void;
    'send-answer': (data: { sessionCode: string; answer: RTCSessionDescriptionInit }) => void;
    'send-ice-candidate': (data: { sessionCode: string; candidate: RTCIceCandidateInit }) => void;
}

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

// Types pour les sessions
interface Session {
    senderId: string;
    senderOffer: RTCSessionDescriptionInit | null;
    senderCandidates: RTCIceCandidateInit[];
    receiverId: string | null;
    receiverAnswer: RTCSessionDescriptionInit | null;
    receiverCandidates: RTCIceCandidateInit[];
}

type SessionCode = string;

// Servir les fichiers statiques
app.use(express.static('public'));

// Routes
app.get('/', (_req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/sender', (_req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, 'public', 'sender.html'));
});

app.get('/receiver', (_req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, 'public', 'receiver.html'));
});

app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', sessions: sessions.size });
});

// Stockage des sessions actives
const sessions = new Map<SessionCode, Session>();

// Validation du code de session (4 caractères alphanumériques)
function isValidSessionCode(code: unknown): code is SessionCode {
    return typeof code === 'string' && /^[A-Z0-9]{4}$/i.test(code);
}

io.on('connection', (socket: TypedSocket) => {
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
httpServer.listen(Number(PORT), '0.0.0.0', () => {
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
