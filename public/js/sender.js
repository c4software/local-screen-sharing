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

    init() {
        this.signaling = new Signaling();
        this.setupSignalingListeners();
    },

    setupSignalingListeners() {
        this.signaling.connect();

        this.signaling.on('session-created', ({ sessionCode }) => {
            this.sessionCode = sessionCode;
            this.isSessionActive = true;
            this.updateStatus('warning', 'En attente...');
        });

        this.signaling.on('receiver-connected', () => {
            this.updateStatus('connected', 'Client connecté');
        });

        this.signaling.on('request-offer', async () => {
            if (!this.webrtc || !this.isSessionActive) return;
            try {
                const offer = await this.webrtc.createOffer({ iceRestart: true });
                this.signaling.sendOffer(this.sessionCode, offer);
            } catch (e) {
                console.error('Error creating restart offer', e);
            }
        });

        this.signaling.on('receive-answer', async ({ answer }) => {
            if (this.webrtc) {
                await this.webrtc.setRemoteDescription(answer);
                this.updateStatus('connected', 'En diffusion');
            }
        });

        this.signaling.on('receive-ice-candidate', async ({ candidate }) => {
            if (this.webrtc) {
                await this.webrtc.addIceCandidate(candidate);
            }
        });

        this.signaling.on('receiver-disconnected', () => {
            this.updateStatus('warning', 'Client déconnecté');
        });

        this.signaling.on('error', ({ message }) => {
            alert('Erreur: ' + message);
            this.stopSharing();
        });
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
            this.updateStatus('warning', 'Connexion...');
            const code = Math.random().toString(36).substring(2, 6).toUpperCase();

            this.stream = await navigator.mediaDevices.getDisplayMedia({
                video: this.getVideoConstraints(),
                audio: false
            });

            // Set preview
            this.$refs.preview.srcObject = this.stream;

            // Handle stream end
            this.stream.getVideoTracks()[0].onended = () => this.stopSharing();

            // Setup WebRTC
            this.webrtc = new WebRTC(this.signaling);
            this.webrtc.createPeerConnection(code);

            this.webrtc.onConnectionStateChange = (state) => {
                if (state === 'connected' || state === 'completed') {
                    this.updateStatus('connected', 'Connecté (P2P)');
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

        } catch (err) {
            console.error(err);
            this.updateStatus('inactive', 'Inactif'); // Reset if cancelled
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
    },

    async changeSource() {
        try {
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

            newVideoTrack.onended = () => this.stopSharing();

            if (this.webrtc) {
                await this.webrtc.replaceVideoTrack(newVideoTrack);
                await this.webrtc.applyEncodingParams(parseFloat(this.scale));
            }

        } catch (e) {
            console.log("Change source cancelled", e);
        }
    },

    updateFps() {
        if (this.stream) {
            const track = this.stream.getVideoTracks()[0];
            if (track) {
                track.applyConstraints({ frameRate: { max: parseInt(this.fps) } })
                    .catch(e => console.log(e));
            }
        }
    },

    updateScale() {
        if (this.webrtc) {
            this.webrtc.applyEncodingParams(parseFloat(this.scale));
        }
    }
}));

Alpine.start();
