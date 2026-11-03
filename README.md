# Hallo

**Hallo** is a real-time communication app that lets people discover and connect with strangers around the world through text chat and video calls.

The app features an interactive world map where each online user appears as a location marker. Users can select another person on the map, establish a connection, exchange messages, and start a video conversation without creating an account.

Hallo is designed around privacy and simplicity. It does not require user registration or maintain chat history. Presence coordination and WebRTC signaling are handled by the backend, while actual messaging and video communication happen directly between users through peer-to-peer connections.

**Live Demo:** [https://hallo-olive.vercel.app/](https://hallo-olive.vercel.app/)

---

## Features

- **Interactive World Map:** Discover online users through a live map powered by Mapbox GL JS.
- **Real-Time Presence:** See other active users and their approximate locations.
- **Anonymous Connections:** Connect with strangers without creating an account.
- **Text Messaging:** Exchange messages through a peer-to-peer WebRTC data channel.
- **Video Calling:** Start direct video conversations using WebRTC.
- **Privacy-Focused Communication:** Messages and video streams are transmitted directly between participants and are not stored by the application.
- **Randomized Map Positions:** User markers are placed approximately 1–3 km from their actual location to avoid exposing precise coordinates.
- **Lightweight Backend:** Uses HTTP polling for presence updates and signaling without requiring persistent WebSocket connections.

## Tech Stack

| Category | Technology |
|---|---|
| Frontend | Next.js, React, TypeScript |
| Styling | CSS |
| Interactive Map | Mapbox GL JS |
| Backend | Next.js API Routes |
| Database | PostgreSQL |
| ORM | Prisma |
| Communication | WebRTC |
| Signaling | HTTP Polling |
| Deployment | Vercel |

## Architecture

Hallo separates connection coordination from actual communication.

### 1. Presence and Signaling

The backend manages user presence, connection requests, and WebRTC signaling information.

- PostgreSQL stores transient presence and signaling data.
- Prisma handles database operations.
- HTTP polling retrieves updates from the server.
- No persistent WebSocket connection is required.

### 2. Peer-to-Peer Communication

Once two users establish a connection, communication happens directly between their browsers using WebRTC.

- Text messages travel through a WebRTC data channel.
- Audio and video use WebRTC media streams.
- The backend is not involved in transferring messages or media.

### 3. Interactive Map

Mapbox GL JS provides the geographical interface.

- Displays currently active users as map markers.
- Updates user presence through backend polling.
- Uses randomized marker positions to provide an additional layer of location privacy.

## Getting Started

### Prerequisites

- Node.js
- npm
- PostgreSQL database
- Mapbox access token

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd hallo
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Configure environment variables.

   Copy `.env.example` to `.env` and provide the required credentials:

   - PostgreSQL database connection string.
   - Mapbox access token.

4. Initialize the database:

   ```bash
   npx prisma db push
   ```

5. Start the development server:

   ```bash
   npm run dev
   ```

6. Open the application:

   ```text
   http://localhost:3000
   ```

## Testing the Application

Hallo requires two participants to test its communication features.

1. Open the application in two separate browser windows or profiles.
2. Allow location access in both browsers.
3. If testing locally, use browser DevTools → Sensors to simulate different geographical locations.
4. Wait for both users to appear on the map.
5. Select another user and establish a connection.
6. Accept the connection request.
7. Test text messaging and video calling.

**Network Compatibility:** WebRTC connections currently use STUN servers without TURN relay support. Some restrictive corporate networks and NAT configurations may prevent direct media connections.

## Privacy and Data Handling

Hallo is designed to minimize the information stored by the application.

- No user registration or permanent accounts.
- No persistent chat history.
- No server-side storage of message content or video streams.
- Presence and signaling information are stored transiently for connection coordination.
- Approximate randomized map positions help protect users' precise locations.

## Future Improvements

Potential areas for further development include:

- TURN server support for improved WebRTC connectivity.
- Improved presence detection and connection cleanup.
- More advanced user discovery and matching.
- Connection safety features and user reporting.
- Improved mobile responsiveness and video call controls.
- Additional performance and security improvements.

---

**Hallo** is an ongoing communication application focused on making spontaneous, anonymous conversations simple and accessible.
