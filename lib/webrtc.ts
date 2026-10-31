export type DescType = "offer" | "answer" | "ice";
export type PeerControl =
  | "video-request"
  | "video-accept"
  | "video-decline"
  | "video-end";

interface PeerCallbacks {
  onSignal: (type: DescType, payload: string) => void;
  onChat: (text: string) => void;
  onControl: (ctrl: PeerControl) => void;
  onRemoteStream: (stream: MediaStream | null) => void;
  onConnectionState: (state: RTCPeerConnectionState) => void;
  onChannelOpen: () => void;
  onChannelClose: () => void;
}

const MAX_CHAT_CHARS = 2000;
const MAX_FRAME = 16 * 1024;
// A "disconnected" link often heals on its own (brief Wi-Fi drop); give it a
// moment before forcing a new path.
const DISCONNECT_GRACE_MS = 4_000;
// ICE restarts let a call survive network changes (Wi-Fi ↔ mobile, VPN
// reconnects) and fall back to the TURN relay, without dropping the chat.
const MAX_ICE_RESTARTS = 3;

export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
];

export class PeerSession {
  private pc: RTCPeerConnection;
  private dc: RTCDataChannel | null = null;
  private readonly polite: boolean;
  private makingOffer = false;
  private ignoreOffer = false;
  private localStream: MediaStream | null = null;
  private closed = false;
  private readonly cb: PeerCallbacks;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private signalQueue: Promise<void> = Promise.resolve();
  private iceRestarts = 0;
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    initiator: boolean,
    cb: PeerCallbacks,
    iceServers: RTCIceServer[] = DEFAULT_ICE_SERVERS,
  ) {
    this.cb = cb;
    this.polite = !initiator;
    // "all" tries direct paths first and falls back to the TURN relay only
    // when they fail (VPNs, symmetric NATs, UDP-blocking firewalls).
    this.pc = new RTCPeerConnection({ iceServers, iceTransportPolicy: "all" });

    this.pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        this.cb.onSignal("ice", JSON.stringify(candidate));
      }
    };

    this.pc.onnegotiationneeded = async () => {
      try {
        this.makingOffer = true;
        await this.pc.setLocalDescription();
        if (this.pc.localDescription) {
          this.cb.onSignal("offer", JSON.stringify(this.pc.localDescription));
        }
      } catch {
        // Closed mid-negotiation; nothing to do.
      } finally {
        this.makingOffer = false;
      }
    };

    this.pc.ontrack = ({ streams }) => {
      this.cb.onRemoteStream(streams[0] ?? null);
    };

    this.pc.onconnectionstatechange = () => {
      const state = this.pc.connectionState;
      if (this.closed) return;
      if (state === "connected") {
        this.clearDisconnectTimer();
        this.iceRestarts = 0;
      } else if (state === "disconnected") {
        this.clearDisconnectTimer();
        this.disconnectTimer = setTimeout(() => {
          if (this.pc.connectionState === "disconnected") this.tryIceRestart();
        }, DISCONNECT_GRACE_MS);
      } else if (state === "failed") {
        this.clearDisconnectTimer();
        // Only report failure once every restart attempt is used up.
        if (this.tryIceRestart()) return;
      }
      this.cb.onConnectionState(state);
    };

    if (initiator) {
      this.dc = this.pc.createDataChannel("chat");
      this.wireDataChannel(this.dc);
    } else {
      this.pc.ondatachannel = (e) => {
        this.dc = e.channel;
        this.wireDataChannel(this.dc);
      };
    }
  }

  private wireDataChannel(dc: RTCDataChannel) {
    dc.onopen = () => this.cb.onChannelOpen();
    // The remote closing its RTCPeerConnection (hang-up, tab closed) closes
    // the channel long before ICE reports "failed".
    dc.onclose = () => {
      if (!this.closed) this.cb.onChannelClose();
    };
    dc.onmessage = (e) => {
      // The remote peer is an untrusted stranger: drop oversized frames.
      if (typeof e.data !== "string" || e.data.length > MAX_FRAME) return;
      try {
        const msg = JSON.parse(e.data);
        if (msg.t === "chat" && typeof msg.text === "string") {
          this.cb.onChat(msg.text.slice(0, MAX_CHAT_CHARS));
        } else if (msg.t === "ctrl" && typeof msg.ctrl === "string") {
          this.cb.onControl(msg.ctrl as PeerControl);
        }
      } catch {}
    };
  }

  // Signals must be applied strictly in arrival order: an ICE candidate or an
  // answer racing ahead of an in-flight setRemoteDescription breaks the
  // handshake, so every call is chained onto the previous one.
  handleSignal(type: DescType, payload: string): Promise<void> {
    this.signalQueue = this.signalQueue
      .then(() => this.applySignal(type, payload))
      .catch(() => {});
    return this.signalQueue;
  }

  private async applySignal(type: DescType, payload: string) {
    if (this.closed) return;
    const data = JSON.parse(payload);

    if (type === "ice") {
      if (!this.pc.remoteDescription) {
        this.pendingCandidates.push(data);
        return;
      }
      try {
        await this.pc.addIceCandidate(data);
      } catch {}
      return;
    }

    const desc = data as RTCSessionDescriptionInit;
    const offerCollision =
      desc.type === "offer" &&
      (this.makingOffer || this.pc.signalingState !== "stable");
    this.ignoreOffer = !this.polite && offerCollision;
    if (this.ignoreOffer) return;

    await this.pc.setRemoteDescription(desc);
    // Candidates can only be added once a remote description exists.
    await this.flushPendingCandidates();
    if (desc.type === "offer") {
      await this.pc.setLocalDescription();
      if (this.pc.localDescription) {
        this.cb.onSignal("answer", JSON.stringify(this.pc.localDescription));
      }
    }
  }

  private async flushPendingCandidates() {
    if (this.pendingCandidates.length === 0) return;
    const queued = this.pendingCandidates;
    this.pendingCandidates = [];
    for (const candidate of queued) {
      try {
        await this.pc.addIceCandidate(candidate);
      } catch {}
    }
  }

  sendChat(text: string): boolean {
    return this.safeSend({ t: "chat", text });
  }

  sendControl(ctrl: PeerControl) {
    this.safeSend({ t: "ctrl", ctrl });
  }

  // Returns false when the frame could not be handed to the data channel.
  private safeSend(obj: unknown): boolean {
    if (!this.dc || this.dc.readyState !== "open") return false;
    try {
      this.dc.send(JSON.stringify(obj));
      return true;
    } catch {
      return false;
    }
  }

  async startVideo(): Promise<MediaStream> {
    if (!this.localStream) {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        // Front camera on phones; `video: true` can pick the rear one.
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      for (const track of this.localStream.getTracks()) {
        this.pc.addTrack(track, this.localStream);
      }
    }
    return this.localStream;
  }

  stopVideo() {
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) track.stop();
      for (const sender of this.pc.getSenders()) {
        if (sender.track) {
          try {
            this.pc.removeTrack(sender);
          } catch {}
        }
      }
      this.localStream = null;
    }
  }

  // Gathers fresh candidates (including TURN relays) and renegotiates via
  // onnegotiationneeded; the data channel survives the restart.
  private tryIceRestart(): boolean {
    if (this.closed || this.iceRestarts >= MAX_ICE_RESTARTS) return false;
    this.iceRestarts++;
    try {
      this.pc.restartIce();
      return true;
    } catch {
      return false;
    }
  }

  private clearDisconnectTimer() {
    if (this.disconnectTimer) clearTimeout(this.disconnectTimer);
    this.disconnectTimer = null;
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.clearDisconnectTimer();
    this.stopVideo();
    if (this.dc) {
      try {
        this.dc.close();
      } catch {}
    }
    try {
      this.pc.close();
    } catch {}
  }
}
