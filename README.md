# 🚀 WebRTC P2P Screen Share

Système de partage d'écran WebRTC avec **connexion peer-to-peer directe**. Simple, rapide, sécurisé.

## 📋 Architecture

```
┌─────────────┐                    ┌─────────────┐
│  Serveur    │◄──── P2P Direct ───►│   Client    │
│  (Partage)  │    Flux vidéo      │  (Visionne) │
└──────┬──────┘                    └──────┬──────┘
       │                                  │
       │     Signalisation uniquement     │
       └──────────►┌──────────┐◄──────────┘
                   │  Serveur │
                   │  Node.js │
                   └──────────┘
```

## ✨ Fonctionnalités

- ✅ **Homepage** : Choix entre Serveur (partager) ou Client (visionner)
- ✅ **Changement de source** : Re-sélectionner écran/fenêtre/onglet pendant le partage
- ✅ **Partage d'écran P2P** : Flux vidéo direct entre les clients
- ✅ **Contrôle FPS et Qualité** : Ajustement dynamique des performances (5-60 FPS, 25%-100% résolution)
- ✅ **Mode plein écran** : Visualisation immersive avec raccourcis clavier (F) et double-clic
- ✅ **Interface moderne** : Design premium avec animations fluides et dark mode
- ✅ **Pas de NGINX** : Serveur Node.js standalone
- 📊 **Statistiques temps réel** : Type de connexion, débit, état ICE
- 🔒 **DTLS-SRTP** : Chiffrement automatique du flux
- 🐳 **Docker ready** : Déploiement en une commande

## 📁 Structure des fichiers

```
local-screen-sharing/
├── server.ts              # Serveur Node.js + Socket.IO (TypeScript)
├── package.json           # Dépendances
├── tsconfig.json          # Configuration TypeScript
├── Dockerfile             # Image Docker optimisée
├── docker-compose.yml     # Configuration Docker
├── .dockerignore          # Optimisation build
├── AGENTS.md              # Documentation technique pour agents IA
└── public/
    ├── index.html         # Homepage (choix serveur/client)
    ├── sender.html        # Page serveur (partage avec contrôles FPS/Scale)
    └── receiver.html      # Page client (visualisation plein écran)
```

## 🔧 Installation locale (développement)

### Prérequis

- Node.js 24+ (support de Typescript)
- npm installé

### Étapes

```bash
# 1. Créer la structure
mkdir -p local-screen-sharing/public
cd local-screen-sharing

# 2. Créer les fichiers (copier le contenu du projet)

# 3. Installer les dépendances
npm install

# 4. Démarrer le serveur (TypeScript compilé automatiquement)
npm start
```

Le serveur démarre sur http://localhost:3000

> **Note** : Le projet utilise TypeScript avec compilation automatique via `ts-node`

## 🐳 Déploiement Docker (Production)

### Option 1 : Docker simple

```bash
# Build de l'image
docker build -t local-screen-sharing .

# Lancement du conteneur
docker run -d -p 3000:3000 --name screen-sharing local-screen-sharing
```

### Option 2 : Docker Compose (recommandé)

```bash
# Démarrer
docker-compose up -d

# Vérifier les logs
docker-compose logs -f

# Vérifier la santé
docker-compose ps

# Arrêter
docker-compose down
```

## 🌐 Déploiement derrière reverse proxy

Le serveur fonctionne sur le port 3000 et peut être placé derrière n'importe quel reverse proxy.

### Traefik (exemple)

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.webrtc.rule=Host(`screen.votredomaine.com`)"
  - "traefik.http.routers.webrtc.entrypoints=websecure"
  - "traefik.http.routers.webrtc.tls.certresolver=letsencrypt"
  - "traefik.http.services.webrtc.loadbalancer.server.port=3000"
```

### Caddy (Caddyfile)

```
screen.votredomaine.com {
    reverse_proxy localhost:3000
}
```

### Nginx Proxy Manager

1. Ajoutez un nouveau Proxy Host
2. Domain: `screen.votredomaine.com`
3. Forward to: `localhost:3000`
4. Enable WebSocket Support ✅
5. SSL: Request Let's Encrypt certificate

## 🎯 Utilisation

### 1. Page d'accueil

Rendez-vous sur `https://screen.votredomaine.com/`

Vous avez deux options :

- **Serveur** : Partager votre écran
- **Client** : Visionner un écran partagé

### 2. Mode Serveur (partager)

1. Cliquez sur **Serveur**
2. **(Optionnel)** Ajustez les paramètres de performance :
   - **FPS** : Choisissez entre 5-60 images/seconde selon vos besoins
   - **Qualité** : Sélectionnez la résolution (25%-100%)
3. Cliquez sur **Partager mon écran**
4. Sélectionnez l'écran, fenêtre ou onglet à partager
5. Notez le **code à 4 caractères** (ex: `A1B2`)
6. Partagez ce code avec vos clients

**Pendant le partage :**

- 🎛️ **Ajuster FPS/Qualité** : Modifiez en temps réel sans déconnexion
- 🔄 **Changer la source** : Re-sélectionner écran/fenêtre/onglet
- ⛶ **Plein écran** : Bouton, touche F, ou double-clic
- ⏹️ **Arrêter** : Stopper le partage

### 3. Mode Client (visionner)

1. Cliquez sur **Client**
2. Entrez le **code de session** reçu
3. Cliquez sur **Connecter**
4. Le flux vidéo s'affiche en temps réel

## 🎨 Fonctionnalités avancées

### Changement de source en cours de partage

Le bouton **"Changer la source"** permet de :

- Passer d'un écran à une fenêtre
- Passer d'une fenêtre à un onglet
- Changer d'écran/fenêtre/onglet sans déconnecter le client

Cette fonctionnalité utilise `replaceTrack()` de WebRTC pour remplacer la piste vidéo sans recréer la connexion P2P.

### Contrôle dynamique de la qualité

**Paramètres FPS (Images par seconde)** :
- 60 FPS : Fluide, idéal pour vidéos et animations
- 30 FPS : Standard, balance performance/qualité
- 15 FPS : Économique, pour documents et présentations
- 5 FPS : Diaporama, consommation minimale

**Paramètres de Résolution** :
- 100% : Qualité originale maximale
- 75% : Haute qualité avec réduction de bande passante
- 50% : Recommandé, excellent compromis
- 25% : Léger, pour connexions limitées

Les paramètres peuvent être ajustés **en temps réel** pendant le partage sans interruption de la connexion.

### Mode plein écran

Plusieurs méthodes pour activer le plein écran :
- Bouton **⛶** dans les contrôles vidéo
- Double-clic sur la vidéo
- Touche **F** du clavier

En mode plein écran, les contrôles s'affichent automatiquement au survol.

## 📊 Monitoring

### Logs Docker

```bash
# Logs en temps réel
docker-compose logs -f

# Dernières 100 lignes
docker-compose logs --tail=100

# Logs d'un conteneur spécifique
docker logs webrtc-p2p-signaling
```

### Health Check

```bash
# Via curl
curl http://localhost:3000/health

# Réponse attendue
{"status":"ok","sessions":0}
```

### Métriques dans le navigateur

Ouvrez la console (F12) pour voir :

- Les ICE candidates (host, srflx, relay)
- Le type de connexion établie
- Les statistiques WebRTC (débit, latence)

## ⚡ Performance

- **Latence** : 20-100ms selon le réseau
- **Débit** : Adaptatif (WebRTC ajuste automatiquement)
- **CPU serveur** : < 1% (pas de transcodage)
- **RAM serveur** : ~50MB par instance
- **Connexions simultanées** : Illimité (signalisation légère)

## 🐛 Dépannage

### Le flux ne s'affiche pas

1. Vérifier que HTTPS est activé (WebRTC nécessite HTTPS sauf localhost)
2. Ouvrir la console et vérifier les ICE candidates
3. Vérifier que le code de session est correct
4. S'assurer qu'aucun firewall ne bloque les ports UDP

### Erreur "Session non trouvée"

- Le serveur doit partager son écran **avant** que le client ne se connecte
- Vérifier que le code est exact (4 caractères)
- Redémarrer le serveur si les sessions sont corrompues

### Le changement de source ne fonctionne pas

- Assurez-vous que la connexion P2P est établie
- Vérifiez dans la console qu'aucune erreur n'apparaît
- Si le problème persiste, arrêtez et redémarrez le partage

### Pas de candidates relay/srflx

C'est normal ! Le système utilise un STUN Google public :

- **host** : Connexion LAN directe (meilleure)
- **srflx** : Via NAT avec STUN (bonne)
- **relay** : Via TURN (non configuré par défaut)

## 🔒 Sécurité

### Chiffrement

- ✅ **DTLS-SRTP** : Flux vidéo chiffré automatiquement par WebRTC
- ✅ **HTTPS** : Recommandé pour la page web (obligatoire en production)
- ✅ **Sandbox navigateur** : Protection contre l'injection de code

### Bonnes pratiques

- Utilisez HTTPS en production
- Limitez l'accès au serveur de signalisation si nécessaire
- Les codes de session sont éphémères (supprimés à la déconnexion)
- Ajoutez une authentification si vous exposez publiquement

## 🎓 Points techniques

### Pourquoi Node.js ?

✅ **Léger** : Serveur minimal, < 100 lignes de code  
✅ **Socket.IO** : WebSocket mature avec fallback automatique  
✅ **Rapide** : Event-driven, parfait pour la signalisation  
✅ **Écosystème** : Standard pour WebRTC (utilisé par Discord, Slack, Zoom)  
✅ **Docker** : Image Alpine < 150MB

### Peer-to-peer vs Serveur

Le flux vidéo **ne peut pas** transiter par le serveur car :

1. WebRTC établit une connexion **peer-to-peer directe**
2. Le serveur n'a **aucun accès** aux pistes média
3. La signalisation (SDP/ICE) ne contient **pas** les données vidéo
4. Après connexion, le serveur peut être **arrêté** sans interrompre le flux

### replaceTrack() pour changer de source

La méthode `replaceTrack()` permet de :

- Remplacer une piste vidéo sans recréer la connexion P2P
- Éviter la déconnexion/reconnexion
- Maintenir la session active côté client

```javascript
const videoTrack = stream.getVideoTracks()[0];
const sender = pc.getSenders().find((s) => s.track.kind === "video");
await sender.replaceTrack(videoTrack);
```

### Optimisation de la performance

**Contrôle FPS dynamique** :
```javascript
// Capture avec FPS configurable
stream = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: { max: fps } },
    audio: false
});

// Ajustement en temps réel
await videoTrack.applyConstraints({ frameRate: { max: fps } });
```

**Réduction de résolution (Scale)** :
```javascript
// Appliqué via encodingParameters
const params = sender.getParameters();
params.encodings[0].scaleResolutionDownBy = scale; // 1, 1.33, 2, ou 4
await sender.setParameters(params);
```

Ces optimisations permettent d'adapter la consommation de bande passante en fonction de la qualité réseau.

## 📚 Ressources

- [Documentation WebRTC](https://webrtc.org/)
- [Socket.IO Docs](https://socket.io/docs/)
- [Docker Docs](https://docs.docker.com/)
- [MDN WebRTC API](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [MDN replaceTrack()](https://developer.mozilla.org/en-US/docs/Web/API/RTCRtpSender/replaceTrack)

## 📄 License

MIT
