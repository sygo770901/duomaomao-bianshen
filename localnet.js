// 只給自動化測試用（網址加 ?net=local）：用 BroadcastChannel 模擬 PeerJS，讓同一個瀏覽器的多個分頁互連。
// 正式遊戲一律走 PeerJS（WebRTC）。
const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('ph-localnet') : null;
const peers = new Map();
const deliver = m => {
  if (m?.type === 'rooms') { try { localStorage.setItem('ph-local-rooms', JSON.stringify(m.rooms || {})); window.dispatchEvent(new CustomEvent('ph-local-rooms')); } catch {} return; }
  const p = peers.get(m.to); if (p) p._recv(m);
};
bc && (bc.onmessage = e => deliver(e.data));
window.__localnetIn = deliver; // 測試工具可從別的瀏覽器分身轉送訊息進來
const post = m => window.__relay ? window.__relay(m) : bc.postMessage(m);
class Emitter { constructor() { this._h = {}; } on(k, f) { (this._h[k] ||= []).push(f); return this; } _emit(k, ...a) { (this._h[k] || []).forEach(f => f(...a)); } }
class LocalConn extends Emitter {
  constructor(owner, remote) { super(); this.owner = owner; this.peer = remote; this.open = false; }
  send(data) { if (this.open) post({ to: this.peer, from: this.owner.id, type: 'data', data }); }
  close() { if (!this.open) return; this.open = false; post({ to: this.peer, from: this.owner.id, type: 'close' }); this._emit('close'); }
}
export class LocalPeer extends Emitter {
  constructor(id) { super(); if (typeof id !== 'string') id = 'L' + Math.random().toString(36).slice(2, 10);
    this.id = id; this.conns = new Map(); peers.set(id, this); setTimeout(() => this._emit('open', id), 50);
    addEventListener('pagehide', () => this.destroy()); }
  connect(remote) { const c = new LocalConn(this, remote); this.conns.set(remote, c);
    post({ to: remote, from: this.id, type: 'hello' });
    c._t = setTimeout(() => { if (!c.open) this._emit('error', { type: 'peer-unavailable' }); }, 2500); return c; }
  _recv(m) {
    let c = this.conns.get(m.from);
    if (m.type === 'hello') { c = new LocalConn(this, m.from); this.conns.set(m.from, c); c.open = true; this._emit('connection', c);
      post({ to: m.from, from: this.id, type: 'ack' }); setTimeout(() => c._emit('open'), 0); }
    else if (m.type === 'ack' && c) { clearTimeout(c._t); c.open = true; c._emit('open'); }
    else if (m.type === 'data' && c?.open) c._emit('data', structuredClone(m.data));
    else if (m.type === 'close' && c?.open) { c.open = false; c._emit('close'); }
  }
  destroy() { for (const c of this.conns.values()) c.close(); peers.delete(this.id); }
}
