# Local Screen Sharing

## 📋 Vue d'ensemble

**Type de projet** : Application de partage d'écran WebRTC peer-to-peer  
**Stack technique** : Node.js + Express + Socket.IO + WebRTC + Alpine.js  
**Architecture** : Client-serveur avec signalisation centralisée, flux média P2P

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Browser (Serveur)          Node.js Server          Browser (Client) │
│  ┌──────────────┐          ┌──────────────┐        ┌──────────────┐ │
│  │ sender.html  │◄────────►│  server.ts   │◄──────►│receiver.html │ │
│  │              │ Socket.IO│              │Socket.IO│              │ │
│  │ - Capture    │          │ - Routing    │        │ - Playback   │ │
│  │ - WebRTC PC  │          │ - Sessions   │        │ - WebRTC PC  │ │
│  │ - Preview    │          │ - SDP/ICE    │        │ - Stats      │ │
│  │ - Alpine.js  │          │ - Reconnect  │        │ - Alpine.js  │ │
│  └──────┬───────┘          └──────────────┘        └──────┬───────┘ │
│         │                                                  │         │
│         └──────────────── P2P Direct ─────────────────────┘         │
│                      (Flux vidéo uniquement)                        │
└─────────────────────────────────────────────────────────────────────┘
```

## 📁 Structure des fichiers

```
webrtc-p2p/
├── server.ts                 # Serveur de signalisation (TypeScript)
├── package.json              # Dépendances npm
├── Dockerfile               # Container Docker
├── docker-compose.yml       # Orchestration
├── .dockerignore            # Exclusions build
├── README.md                # Documentation utilisateur
├── AGENTS.md                # Ce fichier
└── public/
    ├── index.html           # Homepage (choix serveur/client)
    ├── sender.html          # Interface serveur (partage)
    └── receiver.html        # Interface client (visualisation)
    ├── css/
    │   └── style.css         # Styles globaux
    └── js/
        ├── sender.js         # Logique UI émetteur (Alpine)
        ├── receiver.js       # Logique UI récepteur (Alpine)
        └── modules/
            ├── Signaling.js  # Abstraction Socket.IO
            └── WebRTC.js     # Abstraction RTCPeerConnection
```

## 🔧 Composants principaux

### 1. `server.ts` - Serveur de signalisation

**Rôle** : Échanger les SDP et ICE candidates entre pairs  
**Port** : 3000 (configurable via ENV)  
**Dépendances** : Express, Socket.IO

#### Routes HTTP

```javascript
GET  /              → index.html (homepage)
GET  /sender        → sender.html (serveur)
GET  /receiver      → receiver.html (client)
GET  /health        → { status, sessions } (healthcheck)
```

#### Événements Socket.IO

**Émetteur (serveur) → Signaling**

- `create-session` : Créer une session avec code
- `send-offer` : Envoyer SDP offer
- `send-ice-candidate` : Envoyer ICE candidate

**Récepteur (client) → Signaling**

- `join-session` : Rejoindre une session via code
- `send-answer` : Envoyer SDP answer
- `send-ice-candidate` : Envoyer ICE candidate

**Signaling → Émetteur/Récepteur**

- `session-created` : Confirmation création session
- `session-joined` : Confirmation connexion session
- `receive-offer` : Recevoir SDP offer
- `receive-answer` : Recevoir SDP answer
- `receive-ice-candidate` : Recevoir ICE candidate
- `receiver-connected` : Notification connexion client
- `receiver-disconnected` : Notification déconnexion client
- `sender-disconnected` : Notification déconnexion serveur
- `request-offer` : Demande de renégociation (reconnexion)
- `error` : Erreur (session non trouvée, etc.)

#### Structure de session

```javascript
{
  senderId: string,              // Socket ID de l'émetteur
  senderOffer: RTCSessionDescription | null,
  senderCandidates: RTCIceCandidate[],
  receiverId: string | null,     // Socket ID du récepteur
  receiverAnswer: RTCSessionDescription | null,
  receiverCandidates: RTCIceCandidate[]
}
```

### 2. `public/index.html` - Homepage

**Rôle** : Point d'entrée, choix serveur/client  
**Dépendances** : Aucune (HTML/CSS/JS pur)  
**Navigation** :

- Bouton "Serveur" → `/sender`
- Bouton "Client" → `/receiver`

### 3. `public/sender.html` + `public/js/sender.js` - Interface serveur

**Rôle** : Capturer et partager l'écran  
**Dépendances** : Socket.IO client, Alpine.js

#### Fonctionnalités

1. **Partage initial** : `getDisplayMedia()` → Sélection écran/fenêtre/onglet
2. **Changement de source** : `replaceTrack()` → Re-sélection sans déconnexion
3. **Preview local** : `<video>` avec `srcObject`
4. **Gestion arrêt** : Détection `track.onended` (bouton Chrome)

#### Modules principaux

- `Signaling` : gestion des événements Socket.IO
- `WebRTC` : gestion de `RTCPeerConnection` et paramètres d’encodage

#### Flux WebRTC (émetteur)

```
1. getDisplayMedia() → stream
2. pc.addTrack(track, stream)
3. pc.createOffer() → offer
4. pc.setLocalDescription(offer)
5. socket.emit('send-offer', { sessionCode, offer })
6. Attendre answer du récepteur
7. pc.setRemoteDescription(answer)
8. Connexion P2P établie
```

#### Reconnexion (émetteur)

```
1. Le serveur émet request-offer quand un récepteur se (re)connecte
2. L’émetteur crée une nouvelle offer avec iceRestart
3. socket.emit('send-offer', { sessionCode, offer })
```

### 4. `public/receiver.html` + `public/js/receiver.js` - Interface client

**Rôle** : Recevoir et afficher le flux vidéo  
**Dépendances** : Socket.IO client, Alpine.js

#### Fonctionnalités

1. **Connexion via code** : Input 4 caractères → `join-session`
2. **Réception flux** : `pc.ontrack` → `<video srcObject>`
3. **Statistiques** : `pc.getStats()` → Débit, type connexion

#### Modules principaux

- `Signaling` : gestion des événements Socket.IO
- `WebRTC` : gestion de `RTCPeerConnection`

#### Flux WebRTC (récepteur)

```
1. socket.emit('join-session', { sessionCode })
2. Recevoir offer du serveur
3. pc.setRemoteDescription(offer)
4. pc.createAnswer() → answer
5. pc.setLocalDescription(answer)
6. socket.emit('send-answer', { sessionCode, answer })
7. pc.ontrack → Afficher stream
8. Connexion P2P établie
```

## 🔄 Séquence complète d'une session

```
SERVEUR                  SIGNALING              CLIENT
  │                         │                      │
  │ create-session          │                      │
  ├────────────────────────►│                      │
  │ session-created         │                      │
  │◄────────────────────────┤                      │
  │                         │                      │
  │ send-offer (SDP)        │                      │
  ├────────────────────────►│                      │
  │                         │                      │
    │                         │    join-session      │
  │                         │◄─────────────────────┤
  │                         │ session-joined       │
  │                         ├─────────────────────►│
    │                         │ request-offer        │
    │                         ├─────────────────────►│
    │ send-offer (SDP)        │                      │
    ├────────────────────────►│                      │
    │                         │ receive-offer        │
    │                         ├─────────────────────►│
  │                         │                      │
  │                         │  send-answer (SDP)   │
  │ receive-answer          │◄─────────────────────┤
  │◄────────────────────────┤                      │
  │                         │                      │
  │ send-ice-candidate      │                      │
  ├────────────────────────►│ receive-ice-candidate│
  │                         ├─────────────────────►│
  │                         │                      │
  │                         │  send-ice-candidate  │
  │ receive-ice-candidate   │◄─────────────────────┤
  │◄────────────────────────┤                      │
  │                         │                      │
  ╞═══════════════════════════════════════════════╡
  │        CONNEXION P2P ÉTABLIE (LAN/WAN)        │
  │        Le serveur de signalisation            │
  │        n'est plus utilisé pour le flux        │
  ╞═══════════════════════════════════════════════╡
  │                                                │
  │◄────────── FLUX VIDÉO DIRECT ────────────────►│
  │                                                │
```

## 🎯 Tâches courantes pour agents

### Modifier le style de l'interface

**Fichiers concernés** : `public/css/style.css`

Chaque fichier HTML contient son CSS inline. Rechercher :

- `body { ... }` pour le fond
- `.btn-primary { ... }` pour les boutons
- `.container { ... }` pour les cartes

### Ajouter une fonctionnalité WebRTC

**Fichiers concernés** : `public/js/sender.js`, `public/js/receiver.js`, `public/js/modules/WebRTC.js`

1. Modifier le `RTCPeerConnection` (variable `pc`)
2. Ajouter des événements `pc.onXXX`
3. Mettre à jour la signalisation si nécessaire

Exemple : Ajouter l'audio

```javascript
// sender.html
stream = await navigator.mediaDevices.getDisplayMedia({
  video: true,
  audio: true, // ← Modifier ici
});
```

### Modifier la logique de session

**Fichier concerné** : `server.ts`

- Stockage : `const sessions = new Map()`
- Création : Event `create-session`
- Connexion : Event `join-session`
- Nettoyage : Event `disconnect`

### Ajouter une route HTTP

**Fichier concerné** : `server.ts`

```javascript
app.get("/nouvelle-route", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "fichier.html"));
});
```

### Modifier le code de session

**Fichier concerné** : `public/js/sender.js`

```javascript
const sessionCode = Math.random().toString(36).substring(2, 6).toUpperCase();
// Modifier la longueur ou le format
```

## 🐛 Débogage

### Activer les logs WebRTC

Ajouter dans `sender.html` ou `receiver.html` :

```javascript
pc.addEventListener("icegatheringstatechange", () => {
  console.log("ICE Gathering:", pc.iceGatheringState);
});

pc.addEventListener("signalingstatechange", () => {
  console.log("Signaling:", pc.signalingState);
});
```

### Voir les ICE candidates

```javascript
pc.onicecandidate = (e) => {
  if (e.candidate) {
    console.log("Candidate:", {
      type: e.candidate.type,
      protocol: e.candidate.protocol,
      address: e.candidate.address,
      port: e.candidate.port,
    });
  }
};
```

### Voir les statistiques WebRTC

```javascript
setInterval(async () => {
  const stats = await pc.getStats();
  stats.forEach((report) => {
    if (report.type === "inbound-rtp") {
      console.log("Inbound RTP:", report);
    }
  });
}, 1000);
```

## 🔒 Points de sécurité

### HTTPS obligatoire en production

WebRTC nécessite HTTPS sauf sur `localhost`. Le serveur de signalisation peut être HTTP, mais les pages doivent être servies en HTTPS.

### Pas de validation de code de session

⚠️ **Actuellement** : Aucune authentification sur les codes de session  
**Pour ajouter** : Système de tokens, expiration, limite de tentatives

### Pas de limite de connexions

⚠️ **Actuellement** : Illimité  
**Pour ajouter** : Rate limiting sur Socket.IO

## 📊 Métriques importantes

### Côté serveur (Node.js)

- Nombre de sessions actives : `sessions.size`
- Connexions Socket.IO : `io.engine.clientsCount`

### Côté client (WebRTC)

- Type de connexion : `report.type === 'candidate-pair'`
- Débit vidéo : `report.bytesSent` / `report.bytesReceived`
- Packets perdus : `report.packetsLost`

## 🔄 Modifications fréquentes

### Changer le port du serveur

**Fichier** : `docker-compose.yml` ou variable d'environnement

```yaml
environment:
  - PORT=8080 # Au lieu de 3000

ports:
  - "8080:8080" # Au lieu de 3000:3000
```

### Modifier le serveur STUN

**Fichiers** : `sender.html` et `receiver.html`

```javascript
pc = new RTCPeerConnection({
  iceServers: [
    { urls: "stun:stun.example.com:19302" }, // Modifier ici
  ],
});
```

### Ajouter un serveur TURN (pour NAT strict)

```javascript
pc = new RTCPeerConnection({
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: "turn:turn.example.com:3478",
      username: "user",
      credential: "pass",
    },
  ],
});
```

### Limiter la résolution vidéo

**Fichier** : `sender.html`

```javascript
stream = await navigator.mediaDevices.getDisplayMedia({
  video: {
    width: { max: 1920 },
    height: { max: 1080 },
    frameRate: { max: 30 },
  },
  audio: false,
});
```

## 📝 Conventions de code

### JavaScript

- **Variables** : `camelCase`
- **Constantes** : `UPPER_CASE` (si vraiment constantes)
- **Fonctions** : `camelCase`
- **Async/await** : Préféré à `.then()`

### HTML/CSS

- **Classes CSS** : `kebab-case`
- **IDs** : `camelCase`
- **Inline styles** : Éviter (utiliser classes)

### Socket.IO events

- **Format** : `kebab-case`
- **Exemples** : `create-session`, `send-offer`, `receive-answer`

## 🚀 Tests rapides

### Tester en local

```bash
npm start
# Ouvrir http://localhost:3000
# Serveur : Nouvel onglet privé
# Client : Onglet normal
```

### Tester avec Docker

```bash
docker-compose up --build
# Ouvrir http://localhost:3000
```

### Tester la signalisation

```javascript
// Console navigateur (serveur)
socket.emit("create-session", { sessionCode: "TEST" });

// Console navigateur (client)
socket.emit("join-session", { sessionCode: "TEST" });
```

## 🎓 Ressources

- [WebRTC API](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [Socket.IO Docs](https://socket.io/docs/)
- [getDisplayMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia)
- [RTCPeerConnection](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection)
- [replaceTrack](https://developer.mozilla.org/en-US/docs/Web/API/RTCRtpSender/replaceTrack)

---

**Dernière mise à jour** : Compatible avec la version actuelle du projet  
**Questions** : Consulter README.md pour la documentation utilisateur
