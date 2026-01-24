export default class WebRTC {
    constructor(signaling, config) {
        this.signaling = signaling;
        this.config = config || {
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        };
        this.pc = null;
        this.onTrack = null;
        this.onConnectionStateChange = null;
        this.videoSender = null;
    }

    createPeerConnection(sessionCode) {
        this.pc = new RTCPeerConnection(this.config);

        this.pc.onicecandidate = (e) => {
            if (e.candidate) {
                this.signaling.sendIceCandidate(sessionCode, e.candidate);
            }
        };

        this.pc.ontrack = (event) => {
            if (this.onTrack) this.onTrack(event.streams[0]);
        };

        this.pc.oniceconnectionstatechange = () => {
            if (this.onConnectionStateChange) this.onConnectionStateChange(this.pc.iceConnectionState);
        };

        this.pc.onconnectionstatechange = () => {
            // Optional: Handle generic connection state
        };

        return this.pc;
    }

    addTrack(stream) {
        if (!this.pc) return;
        stream.getTracks().forEach(track => {
            const sender = this.pc.addTrack(track, stream);
            if (track.kind === 'video') {
                this.videoSender = sender;
            }
        });
    }

    async createOffer(options = undefined) {
        if (!this.pc) throw new Error("PC not created");
        const offer = await this.pc.createOffer(options);
        await this.pc.setLocalDescription(offer);
        return offer;
    }

    async createAnswer() {
        if (!this.pc) throw new Error("PC not created");
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        return answer;
    }

    async setRemoteDescription(desc) {
        if (this.pc) await this.pc.setRemoteDescription(desc);
    }

    async addIceCandidate(candidate) {
        if (this.pc) {
            try {
                await this.pc.addIceCandidate(candidate);
            } catch (e) {
                console.error("Error adding ice candidate", e);
            }
        }
    }

    async applyEncodingParams(scale) {
        if (!this.videoSender) return;
        try {
            const params = this.videoSender.getParameters();
            if (!params.encodings || params.encodings.length === 0) {
                params.encodings = [{}];
            }
            params.encodings[0].scaleResolutionDownBy = scale;
            await this.videoSender.setParameters(params);
        } catch (e) {
            console.error("Error setting encoding params", e);
        }
    }

    async replaceVideoTrack(newTrack) {
        if (this.videoSender) {
            await this.videoSender.replaceTrack(newTrack);
        }
    }

    close() {
        if (this.pc) {
            this.pc.close();
            this.pc = null;
            this.videoSender = null;
        }
    }
}
