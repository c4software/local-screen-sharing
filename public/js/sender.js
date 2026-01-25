import Alpine from 'https://cdn.jsdelivr.net/npm/alpinejs@3.13.3/dist/module.esm.js'
import Signaling from './modules/Signaling.js';
import WebRTC from './modules/WebRTC.js';

Alpine.data('sender', () => ({
    status: 'inactive', // inactive, warning, connected
    statusText: 'Inactif',
    sessionCode: '----',
    isSessionActive: false,
    fps: 30,
    scale: 2,
    stream: null,
    signaling: null,
    webrtc: null,
    isSupported: !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia),
    notification: null,

    init() {
        this.signaling = new Signaling();
        this.setupSignalingListeners();
    },

    setupSignalingListeners() {
        this.signaling.connect();

        this.signaling.on('session-created', ({ sessionCode }) => {
            this.sessionCode = sessionCode;
            this.isSessionActive = true;
            this.updateStatus('warning', "En attente d'une connexion client...");
            this.showNotification('Code de session généré. Partagez-le avec vos participants.', 'success');
        });

        this.signaling.on('receiver-connected', () => {
            this.updateStatus('connected', 'Participant connecté');
            this.showNotification('Un participant vient de se connecter', 'success');
        });

        this.signaling.on('request-offer', async () => {
            if (!this.webrtc || !this.isSessionActive) return;
            try {
                const offer = await this.webrtc.createOffer({ iceRestart: true });
                this.signaling.sendOffer(this.sessionCode, offer);
                this.showNotification('Rétablissement de la connexion...', 'info');
            } catch (e) {
                console.error('Error creating restart offer', e);
                this.showNotification('Erreur : impossible de rétablir la connexion', 'error');
            }
        });

        this.signaling.on('receive-answer', async ({ answer }) => {
            if (this.webrtc) {
                await this.webrtc.setRemoteDescription(answer);
                this.updateStatus('connected', 'Diffusion active');
            }
        });

        this.signaling.on('receive-ice-candidate', async ({ candidate }) => {
            if (this.webrtc) {
                await this.webrtc.addIceCandidate(candidate);
            }
        });

        this.signaling.on('receiver-disconnected', () => {
            this.updateStatus('warning', "En attente d'une connexion client...");
            this.showNotification("Le participant s'est déconnecté", 'warning');
        });

        this.signaling.on('error', ({ message }) => {
            this.showNotification('Erreur serveur : ' + message, 'error');
            this.stopSharing();
        });
    },

    showNotification(message, type = 'info') {
        this.notification = { message, type };
        setTimeout(() => { this.notification = null; }, 4000);
    },

    updateStatus(type, text) {
        this.status = type;
        this.statusText = text;
    },

    getVideoConstraints() {
        return {
            frameRate: { max: parseInt(this.fps) }
        };
    },

    async startSharing() {
        try {
            this.updateStatus('warning', 'Sélectionnez une source...');
            const code = Math.random().toString(36).substring(2, 6).toUpperCase();

            this.stream = await navigator.mediaDevices.getDisplayMedia({
                video: this.getVideoConstraints(),
                audio: false
            });

            // Set preview
            this.$refs.preview.srcObject = this.stream;

            // Handle stream end
            this.stream.getVideoTracks()[0].onended = () => {
                this.showNotification("Partage d'écran arrêté", 'info');
                this.stopSharing();
            };

            // Setup WebRTC
            this.webrtc = new WebRTC(this.signaling);
            this.webrtc.createPeerConnection(code);

            this.webrtc.onConnectionStateChange = (state) => {
                if (state === 'connected' || state === 'completed') {
                    this.updateStatus('connected', 'Diffusion active (P2P)');
                }
            };

            this.webrtc.addTrack(this.stream);

            // Apply initial scale
            await this.webrtc.applyEncodingParams(parseFloat(this.scale));

            // Create offer
            const offer = await this.webrtc.createOffer();

            // Signaling
            // We send create-session AFTER getting the stream to ensure success
            this.signaling.createSession(code);
            this.signaling.sendOffer(code, offer);

            this.showNotification("Partage d'écran actif. Attendez une connexion client.", 'success');

        } catch (err) {
            if (err.name === 'NotAllowedError') {
                this.showNotification("Vous avez refusé l'accès au partage d'écran", 'error');
            } else if (err.name === 'NotFoundError') {
                this.showNotification('Aucun écran disponible pour le partage', 'error');
            } else {
                this.showNotification('Erreur lors du démarrage du partage: ' + err.message, 'error');
            }
            this.updateStatus('inactive', 'Inactif');
        }
    },

    stopSharing() {
        if (this.stream) {
            this.stream.getTracks().forEach(t => t.stop());
            this.stream = null;
        }
        if (this.webrtc) {
            this.webrtc.close();
            this.webrtc = null;
        }

        this.$refs.preview.srcObject = null;
        this.isSessionActive = false;
        this.updateStatus('inactive', 'Inactif');
        this.sessionCode = '----';
        this.showNotification("Partage d'écran arrêté", 'info');
    },

    async changeSource() {
        try {
            this.showNotification('Sélectionnez une nouvelle source...', 'info');
            const newStream = await navigator.mediaDevices.getDisplayMedia({
                video: this.getVideoConstraints(),
                audio: false
            });

            const newVideoTrack = newStream.getVideoTracks()[0];

            if (this.stream) {
                this.stream.getTracks().forEach(t => t.stop());
            }
            this.stream = newStream;
            this.$refs.preview.srcObject = newStream;

            newVideoTrack.onended = () => {
                this.showNotification("Source d'écran fermée", 'info');
                this.stopSharing();
            };

            if (this.webrtc) {
                await this.webrtc.replaceVideoTrack(newVideoTrack);
                await this.webrtc.applyEncodingParams(parseFloat(this.scale));
                this.showNotification("Source d'écran changée avec succès", 'success');
            }

        } catch (e) {
            if (e.name === 'NotAllowedError') {
                this.showNotification('Changement de source annulé', 'warning');
            } else {
                console.log("Change source error", e);
                this.showNotification('Erreur lors du changement de source', 'error');
            }
        }
    },

    updateFps() {
        if (this.stream) {
            const track = this.stream.getVideoTracks()[0];
            if (track) {
                track.applyConstraints({ frameRate: { max: parseInt(this.fps) } })
                    .then(() => {
                        this.showNotification(`Débit ajusté à ${this.fps} FPS`, 'info');
                    })
                    .catch(e => console.log(e));
            }
        }
    },

    updateScale() {
        if (this.webrtc) {
            this.webrtc.applyEncodingParams(parseFloat(this.scale));
            this.showNotification('Résolution mise à jour', 'info');
        }
    }
}));

Alpine.start();
