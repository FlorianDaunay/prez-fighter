/**
 * Peer-to-peer link over WebRTC (PeerJS; the public broker only does signalling).
 * Two data channels: "ctl" (reliable, menus) and "game" (unreliable, inputs every frame).
 */
import Peer, { type DataConnection } from "peerjs";
import type { RollbackPacket } from "./rollback";

export const PROTOCOL_VERSION = 1;
const PREFIX = "prezfighter-v1";
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type CtlMessage =
  | { t: "hello"; v: number; name: string }
  | { t: "welcome"; v: number; name: string }
  | { t: "reject"; reason: "version" | "full" }
  | { t: "pick"; char: number; locked: boolean }
  /** Sent when entering the lobby: the peer answers with its current pick. */
  | { t: "sync" }
  | { t: "start"; seed: number; chars: [number, number]; stage: string; rounds: number; time: number }
  | { t: "started" }
  | { t: "toSelect" }
  | { t: "ping"; at: number }
  | { t: "pong"; at: number }
  | { t: "bye" };

export type LinkStatus = "idle" | "opening" | "waiting" | "connecting" | "connected" | "closed" | "error";

export interface LinkEvents {
  status: (s: LinkStatus, detail?: string) => void;
  ctl: (m: CtlMessage) => void;
  game: (p: RollbackPacket) => void;
}

export function randomCode(): string {
  let c = "";
  const buf = new Uint32Array(5);
  crypto.getRandomValues(buf);
  for (const n of buf) c += CODE_CHARS[n % CODE_CHARS.length];
  return c;
}

export class OnlineLink {
  peer: Peer | null = null;
  private ctlConn: DataConnection | null = null;
  private gameConn: DataConnection | null = null;
  isHost = false;
  code = "";
  status: LinkStatus = "idle";
  rtt = 0;
  remoteName = "";
  private pingTimer = 0;
  private lastSeen = 0;

  constructor(public handlers: LinkEvents, private name: string) {}

  private setStatus(s: LinkStatus, detail?: string) {
    this.status = s;
    this.handlers.status(s, detail);
  }

  host(code = randomCode()): Promise<string> {
    this.isHost = true;
    this.code = code;
    this.setStatus("opening");
    return new Promise((resolve, reject) => {
      const peer = new Peer(`${PREFIX}-${code}`, { debug: 0 });
      this.peer = peer;
      peer.on("open", () => {
        this.setStatus("waiting");
        resolve(code);
      });
      peer.on("connection", (conn) => this.accept(conn));
      peer.on("error", (err: Error & { type?: string }) => {
        if (err.type === "unavailable-id") {
          peer.destroy();
          this.host().then(resolve, reject);
          return;
        }
        this.setStatus("error", err.type ?? err.message);
        reject(err);
      });
      peer.on("disconnected", () => {
        if (this.status === "waiting") peer.reconnect();
      });
    });
  }

  private accept(conn: DataConnection) {
    if (conn.label === "game") {
      if (this.gameConn && this.gameConn.open) return conn.close();
      this.gameConn = conn;
      conn.on("data", (d) => this.onGame(d));
      return;
    }
    if (this.ctlConn && this.ctlConn.open) {
      conn.on("open", () => {
        conn.send({ t: "reject", reason: "full" } satisfies CtlMessage);
        setTimeout(() => conn.close(), 300);
      });
      return;
    }
    this.ctlConn = conn;
    this.wireCtl(conn);
  }

  join(code: string): Promise<void> {
    this.isHost = false;
    this.code = code.toUpperCase().trim();
    this.setStatus("connecting");
    return new Promise((resolve, reject) => {
      const peer = new Peer({ debug: 0 });
      this.peer = peer;
      const timeout = setTimeout(() => {
        this.setStatus("error", "timeout");
        reject(new Error("timeout"));
      }, 15000);
      peer.on("open", () => {
        const target = `${PREFIX}-${this.code}`;
        const ctl = peer.connect(target, { label: "ctl", reliable: true, serialization: "json" });
        this.ctlConn = ctl;
        this.wireCtl(ctl, () => {
          clearTimeout(timeout);
          const game = peer.connect(target, { label: "game", reliable: false, serialization: "json" });
          this.gameConn = game;
          game.on("data", (d) => this.onGame(d));
          resolve();
        });
      });
      peer.on("error", (err: Error & { type?: string }) => {
        clearTimeout(timeout);
        this.setStatus("error", err.type === "peer-unavailable" ? "introuvable" : err.type ?? err.message);
        reject(err);
      });
    });
  }

  private wireCtl(conn: DataConnection, onOpen?: () => void) {
    conn.on("open", () => {
      if (!this.isHost) this.sendCtl({ t: "hello", v: PROTOCOL_VERSION, name: this.name });
      onOpen?.();
      this.lastSeen = performance.now();
      this.pingTimer = window.setInterval(() => {
        this.sendCtl({ t: "ping", at: performance.now() });
        if (performance.now() - this.lastSeen > 8000 && this.status === "connected") this.setStatus("closed", "perdu");
      }, 1000);
    });
    conn.on("data", (d) => {
      if ((d as { _g?: number })._g) return this.onGame(d);
      const m = d as CtlMessage;
      this.lastSeen = performance.now();
      if (m.t === "ping") return this.sendCtl({ t: "pong", at: m.at });
      if (m.t === "pong") {
        this.rtt = performance.now() - m.at;
        return;
      }
      if (m.t === "hello") {
        if (m.v !== PROTOCOL_VERSION) {
          this.sendCtl({ t: "reject", reason: "version" });
          return;
        }
        this.remoteName = m.name;
        this.sendCtl({ t: "welcome", v: PROTOCOL_VERSION, name: this.name });
        this.setStatus("connected");
      } else if (m.t === "welcome") {
        this.remoteName = m.name;
        this.setStatus("connected");
      } else if (m.t === "reject") {
        this.setStatus("error", m.reason === "version" ? "version différente" : "salon plein");
      } else if (m.t === "bye") {
        this.setStatus("closed", "parti");
      }
      this.handlers.ctl(m);
    });
    conn.on("close", () => {
      if (this.status !== "error") this.setStatus("closed", "fermé");
    });
  }

  private onGame(d: unknown) {
    this.lastSeen = performance.now();
    this.handlers.game(d as RollbackPacket);
  }

  sendCtl(m: CtlMessage) {
    if (this.ctlConn?.open) this.ctlConn.send(m);
  }

  sendGame(p: RollbackPacket) {
    if (this.gameConn?.open) this.gameConn.send(p);
    else if (this.ctlConn?.open) this.ctlConn.send({ ...p, _g: 1 });
  }

  leave() {
    try {
      this.sendCtl({ t: "bye" });
    } catch {
      /* ignore */
    }
    clearInterval(this.pingTimer);
    setTimeout(() => this.peer?.destroy(), 100);
    this.setStatus("closed");
  }
}
