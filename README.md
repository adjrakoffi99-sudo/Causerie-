# Causerie

Version de base prête pour Render.

## Démarrage local
1. Créer une base PostgreSQL.
2. Exécuter `backend/schema.sql`.
3. Dans `backend`, installer les dépendances: `npm install`.
4. Définir `DATABASE_URL` et `JWT_SECRET`.
5. Lancer: `npm start`.

## Render
Le fichier `render.yaml` crée le service Web et PostgreSQL.
Le frontend est servi par le backend.

## Musique
Les fichiers audio ajoutés sont conservés localement dans IndexedDB du navigateur/appareil. Ils restent disponibles après fermeture et réouverture sur le même appareil/navigateur.

## Important
Cette base fournit l'authentification, la recherche d'utilisateurs et les messages via API. Les appels audio/vidéo et le temps réel Socket.IO nécessitent une étape supplémentaire avec WebRTC/Socket.IO si on veut les activer réellement.
