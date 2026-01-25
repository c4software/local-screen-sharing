import Alpine from 'https://cdn.jsdelivr.net/npm/alpinejs@3.13.3/dist/module.esm.js'
import Signaling from './modules/Signaling.js';
import WebRTC from './modules/WebRTC.js';

Alpine.data('receiver', () => ({
    status: 'disconnected', // disconnected, connecting, connected
    statusText: 'Déconnecté',
    code: '',
    codeDigits: ['', '', '', ''],
    isConnected: false,
    signaling: null,
    webrtc: null,
    sessionCode: '',

    init() {
        this.signaling = new Signaling();
        this.setupSignalingListeners();

        // Raccourcis clavier (F)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'f' || e.key === 'F') this.toggleFullscreen();
        });

        // Clean up fullscreen orientation on exit
        document.addEventListener('fullscreenchange', () => {
            if (!document.fullscreenElement && screen.orientation && screen.orientation.unlock) {
                screen.orientation.unlock();
            }
        });
    },

    setupSignalingListeners() {
        this.signaling.connect();

        this.signaling.on('receive-offer', async ({ offer }) => {
            if (!this.webrtc) return;
            try {
                await this.webrtc.setRemoteDescription(offer);
                const answer = await this.webrtc.createAnswer();
                this.signaling.sendAnswer(this.sessionCode, answer);
            } catch (e) {
                console.error('Error handling offer', e);
            }
        });

        this.signaling.on('receive-ice-candidate', async ({ candidate }) => {
            if (this.webrtc) {
                await this.webrtc.addIceCandidate(candidate);
            }
        });

        this.signaling.on('session-joined', () => {
            this.updateStatus('connecting', 'En attente du flux...');
        });

        this.signaling.on('sender-disconnected', () => {
            this.updateStatus('disconnected', 'Serveur déconnecté');
            this.disconnect(false);
        });

        this.signaling.on('error', ({ message }) => {
            alert('Erreur: ' + message);
            this.updateStatus('disconnected', 'Erreur');
            this.disconnect();
        });
    },

    updateStatus(type, text) {
        this.status = type;
        this.statusText = text;
    },

    connect() {
        this.updateCodeFromDigits();
        this.code = this.code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
        const code = this.code.trim().toUpperCase();
        if (code.length !== 4) {
            alert('Le code doit faire 4 caractères');
            return;
        }

        this.sessionCode = code;
        this.updateStatus('connecting', 'Connexion...');

        this.webrtc = new WebRTC(this.signaling);
        this.webrtc.createPeerConnection(this.sessionCode);

        this.webrtc.onTrack = (stream) => {
            this.$refs.remoteVideo.srcObject = stream;
            this.isConnected = true;
            this.updateStatus('connected', 'Connecté');
        };

        this.webrtc.onConnectionStateChange = (state) => {
            if (state === 'connected') this.updateStatus('connected', 'Connecté (P2P)');
            else if (state === 'disconnected') this.updateStatus('disconnected', 'Déconnecté');
            else if (state === 'failed') this.updateStatus('disconnected', 'Échec');
        };

        this.signaling.joinSession(this.sessionCode);
    },

    disconnect(fullReset = true) {
        if (this.webrtc) {
            this.webrtc.close();
            this.webrtc = null;
        }
        this.$refs.remoteVideo.srcObject = null;
        this.isConnected = false;

        if (fullReset) {
            this.updateStatus('disconnected', 'Déconnecté');
            this.code = '';
            this.codeDigits = ['', '', '', ''];
            this.focusInput(0);
        }
    },

    toggleFullscreen() {
        const wrapper = this.$refs.videoWrapper;
        if (!document.fullscreenElement) {
            wrapper.requestFullscreen().catch(console.error);
            if (screen.orientation && screen.orientation.lock) {
                screen.orientation.lock('landscape').catch(() => { });
            }
        } else {
            document.exitFullscreen();
        }
    },

    handleCodeInput(index, event) {
        const raw = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        const chars = raw.split('');

        if (!chars.length) {
            this.codeDigits[index] = '';
            this.updateCodeFromDigits();
            event.target.value = '';
            return;
        }

        this.codeDigits[index] = chars.shift();

        let cursor = index + 1;
        while (chars.length && cursor < 4) {
            this.codeDigits[cursor] = chars.shift();
            cursor += 1;
        }

        this.updateCodeFromDigits();
        event.target.value = this.codeDigits[index];

        const nextIndex = Math.min(index + 1, 3);
        if (this.codeDigits[index]) {
            this.focusInput(nextIndex);
        }
    },

    handleBackspace(index) {
        if (this.codeDigits[index]) {
            this.codeDigits[index] = '';
            this.updateCodeFromDigits();
            return;
        }

        if (index > 0) {
            this.codeDigits[index - 1] = '';
            this.updateCodeFromDigits();
            this.focusInput(index - 1);
        }
    },

    handlePaste(event) {
        const pasted = (event.clipboardData?.getData('text') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
        if (!pasted) return;
        event.preventDefault();

        this.codeDigits = pasted.split('').concat(['', '', '', '']).slice(0, 4);
        this.updateCodeFromDigits();

        const nextIndex = Math.min(pasted.length, 3);
        this.focusInput(nextIndex);
    },

    updateCodeFromDigits() {
        this.code = this.codeDigits.join('').slice(0, 4);
    },

    focusInput(index) {
        this.$nextTick(() => {
            const el = this.$root.querySelector(`[data-code-index="${index}"]`);
            if (el) {
                el.focus();
                el.select();
            }
        });
    }
}));

Alpine.start();
