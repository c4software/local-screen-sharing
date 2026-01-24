export default class Signaling {
    constructor() {
        // io() vient du script socket.io.js chargé dans le HTML
        this.socket = null;
        this.listeners = new Map();
    }

    connect() {
        this.socket = io();

        this.socket.on('connect', () => this.emit('connect'));
        this.socket.on('disconnect', () => this.emit('disconnect'));
        this.socket.on('error', (err) => this.emit('error', err));

        const events = [
            'session-created', 'session-joined',
            'receive-offer', 'receive-answer',
            'receive-ice-candidate',
            'receiver-connected', 'receiver-disconnected', 'sender-disconnected',
            'request-offer'
        ];

        events.forEach(event => {
            this.socket.on(event, (data) => this.emit(event, data));
        });
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).delete(callback);
        }
    }

    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(cb => cb(data));
        }
    }

    createSession(sessionCode) {
        if (this.socket) this.socket.emit('create-session', { sessionCode });
    }

    joinSession(sessionCode) {
        if (this.socket) this.socket.emit('join-session', { sessionCode });
    }

    sendOffer(sessionCode, offer) {
        if (this.socket) this.socket.emit('send-offer', { sessionCode, offer });
    }

    sendAnswer(sessionCode, answer) {
        if (this.socket) this.socket.emit('send-answer', { sessionCode, answer });
    }

    sendIceCandidate(sessionCode, candidate) {
        if (this.socket) this.socket.emit('send-ice-candidate', { sessionCode, candidate });
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }
}
