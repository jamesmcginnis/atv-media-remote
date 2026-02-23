/**
 * ATV Media Remote
 * Includes: Reordering, Mobile Support, Pressed Glow Effects, Connection Safety, and Remote Control.
 */

class AtvMediaRemote extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._timer = null;
    this._manualSelection = false;
    this._entity = null;
    this._remoteMode = false;
    this._lastVolume = null;
    this._volDebounce = null;
    this._volLastFired = null;
  }

  static getConfigElement() {
    return document.createElement("atv-media-remote-editor");
  }

  static getStubConfig() {
    return { entities: [], auto_switch: true, accent_color: '#007AFF', volume_accent: '#007AFF', title_color: '#ffffff', artist_color: '#ffffff', show_entity_selector: true };
  }

  setConfig(config) {
    if (!config.entities || config.entities.length === 0) throw new Error("Please define entities");
    this._config = {
      accent_color: '#007AFF',
      volume_accent: '#007AFF',
      title_color: '#ffffff',
      artist_color: '#ffffff',
      auto_switch: true,
      show_entity_selector: true,
      ...config
    };
    if (!this._entity) this._entity = this._config.entities[0];
  }

  set hass(hass) {
    this._hass = hass;
    if (!this.shadowRoot.innerHTML) {
      this.render();
      this.setupListeners();
    }

    if (this._config.auto_switch) {
      const activeEntity = this._config.entities.find(ent => hass.states[ent]?.state === 'playing');
      if (activeEntity && (this._entity !== activeEntity || !this._manualSelection)) {
        if (this._entity !== activeEntity) {
          this._entity = activeEntity;
          this._manualSelection = false;
        }
      }
    }

    const stateObj = hass.states[this._entity];
    if (stateObj) this.updateContent(stateObj);
  }

  connectedCallback() {
    this._timer = setInterval(() => this.updateLiveProgress(), 1000);
    this._alexaPulse = setInterval(() => {
      if (this._hass && this._hass.connected && this._entity && this._hass.states[this._entity]) {
        this._hass.callService('homeassistant', 'update_entity', { entity_id: this._entity }).catch(() => {});
      }
    }, 10000);
  }

  disconnectedCallback() {
    if (this._timer) clearInterval(this._timer);
    if (this._alexaPulse) clearInterval(this._alexaPulse);
  }

  getDeviceIcon(stateObj) {
    const name = (stateObj?.attributes?.friendly_name || "").toLowerCase();
    if (name.includes('tv')) return `<svg viewBox="0 0 24 24" width="120" height="120" fill="rgba(255,255,255,0.3)"><path d="M21,3H3C1.89,3 1,3.89 1,5V17A2,2 0 0,0 3,19H8V21H16V19H21A2,2 0 0,0 23,17V5C23,3.89 22.1,3 21,3M21,17H3V5H21V17Z"/></svg>`;
    return `<svg viewBox="0 0 24 24" width="120" height="120" fill="rgba(255,255,255,0.3)"><path d="M12,3V13.55C11.41,13.21 10.73,13 10,13C7.79,13 6,14.79 6,17C6,19.21 7.79,21 10,21C12.21,21 14,19.21 14,17V7H18V3H12Z"/></svg>`;
  }

  updateLiveProgress() {
    const state = this._hass?.states[this._entity];
    if (!state || state.state !== 'playing') return;
    const r = this.shadowRoot;
    const duration = state.attributes.media_duration;
    let pos = state.attributes.media_position;
    if (pos !== undefined && state.attributes.media_position_updated_at) {
      pos += (Date.now() - new Date(state.attributes.media_position_updated_at).getTime()) / 1000;
    }
    if (duration && pos !== undefined) {
      const percent = Math.min((pos / duration) * 100, 100);
      const fill = r.getElementById('progFill');
      if (fill) fill.style.width = `${percent}%`;
      const cur = r.getElementById('pCur');
      if (cur) cur.textContent = this.formatTime(pos);
    }
  }

  _toggleRemote() {
    this._remoteMode = !this._remoteMode;
    const r = this.shadowRoot;
    const overlay     = r.getElementById('remoteOverlay');
    const albumImg    = r.getElementById('albumImg');
    const mainPh      = r.getElementById('mainPlaceholder');
    const remoteBtn   = r.getElementById('remoteBtn');

    if (this._remoteMode) {
      overlay.classList.remove('hidden');
      albumImg.classList.add('hidden');
      mainPh.classList.add('hidden');
      remoteBtn.classList.add('remote-btn-active');
    } else {
      overlay.classList.add('hidden');
      remoteBtn.classList.remove('remote-btn-active');
      // Restore art to whatever state it should be
      const state = this._hass?.states[this._entity];
      if (state) {
        const isPlaying = state.state === 'playing';
        const artUrl    = state.attributes.entity_picture;
        if (isPlaying && artUrl) {
          albumImg.classList.remove('hidden');
          mainPh.classList.add('hidden');
        } else {
          albumImg.classList.add('hidden');
          mainPh.classList.remove('hidden');
        }
      }
    }
  }

  sendRemoteCommand(command) {
    // Apple TV (and many other devices) exposes a companion remote.* entity
    const remoteEntityId = this._entity.replace('media_player.', 'remote.');
    this._hass.callService('remote', 'send_command', {
      entity_id: remoteEntityId,
      command: command
    }).catch(() => {});
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        :host { display: block; --accent: #007AFF; --vol-accent: #007AFF; }
        ha-card {
          background: rgba(28, 28, 30, 0.72) !important;
          backdrop-filter: blur(40px) saturate(180%) !important;
          -webkit-backdrop-filter: blur(40px) saturate(180%) !important;
          color: #fff !important;
          border-radius: 24px !important;
          overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
          position: relative;
          border: 1px solid rgba(255, 255, 255, 0.18) !important;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4) !important;
          transition: all 0.3s ease;
        }
        .size-toggle {
          position: absolute; top: 12px; right: 12px; background: rgba(255, 255, 255, 0.15);
          border-radius: 50%; width: 32px; height: 32px; cursor: pointer; color: #fff; z-index: 10;
          display: flex; align-items: center; justify-content: center; transition: all 0.2s ease;
        }
        .size-toggle svg { width: 18px; height: 18px; }

        /* art wrapper — position:relative so overlay & remote-btn can be positioned inside */
        .art-wrapper { width: 100%; aspect-ratio: 1; background: linear-gradient(135deg, rgba(40,40,45,0.8), rgba(28,28,30,0.9)); display: flex; align-items: center; justify-content: center; overflow: hidden; cursor: pointer; position: relative; }
        .art-wrapper img { width: 100%; height: 100%; object-fit: cover; }

        .content { padding: 20px; display: flex; flex-direction: column; }
        .info-row { display: flex; align-items: center; gap: 15px; margin-bottom: 12px; }
        .mini-art { display: none; width: 54px; height: 54px; border-radius: 10px; overflow: hidden; background: rgba(40,40,45,0.6); display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,0.1); cursor: pointer; flex-shrink: 0; }
        .mini-art img { width: 100%; height: 100%; object-fit: cover; }
        .track-title { font-size: 19px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: -0.3px; color: #fff; }
        .track-artist { font-size: 15px; color: rgba(255,255,255,0.7); margin-bottom: 12px; font-weight: 400; }
        .progress-bar { height: 5px; background: rgba(255,255,255,0.12); border-radius: 3px; margin-bottom: 6px; cursor: pointer; overflow: hidden; }
        .progress-fill { height: 100%; background: var(--accent); width: 0%; border-radius: 3px; transition: width 0.3s ease; }
        .progress-times { display: flex; justify-content: space-between; font-size: 12px; color: rgba(255,255,255,0.5); font-variant-numeric: tabular-nums; }
        .controls { display: flex; justify-content: center; align-items: center; margin: 15px 0; gap: 16px; position: relative; }
        .play-btn svg { width: 44px; height: 44px; fill: #fff; }
        .nav-btn svg { width: 28px; height: 28px; fill: rgba(255,255,255,0.9); }
        .extra-btn svg { width: 24px; height: 24px; fill: rgba(255,255,255,0.5); }
        .extra-btn.active svg { fill: var(--accent); }
        button { background: none; border: none; cursor: pointer; padding: 0; display: flex; align-items: center; justify-content: center; transition: all 0.2s cubic-bezier(0.4,0,0.2,1); border-radius: 50%; }
        button.pressed { transform: scale(0.92); background: rgba(255,255,255,0.1); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); box-shadow: 0 0 20px rgba(255,255,255,0.2); }
        button.pressed svg { filter: drop-shadow(0 0 8px rgba(255,255,255,0.8)); }
        .volume-slider { width: 100%; height: 5px; accent-color: var(--vol-accent); margin-top: 10px; }
        .vol-section { display: contents; }
        .vol-icon { display: none; width: 18px; height: 18px; fill: rgba(255,255,255,0.5); cursor: pointer; }
        .selector { width: 100%; padding: 10px; background: rgba(58,58,60,0.6); color: #fff; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; margin-top: 15px; font-size: 13px; cursor: pointer; text-align: center; text-align-last: center; }
        .selector.hidden { display: none !important; }
        .selector-hidden .content { padding-bottom: 12px; }

        /* mini remote button — hidden in expanded view, visible in compact */
        .mini-remote-btn {
          display: none;
          width: 28px; height: 28px;
          border-radius: 50% !important;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.16) !important;
          cursor: pointer;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.2s ease;
          padding: 0;
        }
        .mini-remote-btn svg { width: 15px; height: 15px; fill: rgba(255,255,255,0.7); }
        .mini-remote-btn:active, .mini-remote-btn.pressed { background: rgba(255,255,255,0.18); transform: scale(0.9); }

        /* compact overrides */
        .mode-compact .art-wrapper { display: none; }
        .mode-compact .mini-art { display: flex; width: 44px; height: 44px; }
        .mode-compact .content { padding: 10px; gap: 2px; }
        .mode-compact .info-row { margin-bottom: 0; }
        .mode-compact .track-title { font-size: 14px; }
        .mode-compact .track-artist { font-size: 12px; margin-bottom: 0; }
        .mode-compact .controls { margin: 6px 0 2px 0; gap: 8px; justify-content: flex-start; padding-right: 38px; }
        .mode-compact .play-btn svg { width: 28px; height: 28px; }
        .mode-compact .nav-btn svg { width: 19px; height: 19px; }
        .mode-compact .vol-section { display: flex; align-items: center; flex: 1; margin-left: 6px; min-width: 0; }
        .mode-compact .vol-icon { display: block; flex-shrink: 0; }
        .mode-compact .volume-slider { margin-top: 0; flex: 1; margin-left: 5px; min-width: 40px; }
        .mode-compact .selector, .mode-compact .extra-btn, .mode-compact .progress-times { display: none; }
        .mode-compact .size-toggle { top: 8px; right: 8px; width: 28px; height: 28px; background: rgba(255,255,255,0.1); }
        .mode-compact .size-toggle svg { width: 14px; height: 14px; }
        .mode-compact .mini-remote-btn { display: flex; }

        .hidden { display: none !important; }
        .placeholder-svg { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }
        /* when entity selector is hidden, reduce bottom padding on the content area */
        .hide-selector .selector { display: none !important; }
        .hide-selector .content { padding-bottom: 8px; }

        /* ─── Remote toggle button (bottom-right of album art) ─── */
        .remote-toggle-btn {
          position: absolute;
          bottom: 12px;
          right: 12px;
          width: 36px;
          height: 36px;
          border-radius: 50% !important;
          background: rgba(0,0,0,0.45);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.22) !important;
          z-index: 5;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          padding: 0;
        }
        .remote-toggle-btn svg { width: 18px; height: 18px; fill: rgba(255,255,255,0.78); transition: fill 0.2s ease; }
        .remote-toggle-btn:active, .remote-toggle-btn.pressed { transform: scale(0.9); box-shadow: 0 0 16px rgba(255,255,255,0.2); }
        .remote-btn-active { background: rgba(255,255,255,0.2) !important; border-color: rgba(255,255,255,0.45) !important; }
        .remote-btn-active svg { fill: #fff !important; }
        /* hide in compact mode — no art wrapper visible */
        .mode-compact .remote-toggle-btn { display: none; }

        /* ─── Remote overlay (fills art-wrapper) ─── */
        .remote-overlay {
          position: absolute;
          inset: 0;
          background: rgba(22,22,24,0.97);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 4;
          cursor: default;
        }

        /* ─── Remote panel layout ─── */
        .remote-panel {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          width: 100%;
          height: 100%;
          padding: 14px 16px 52px;
        }

        /* Row 1 — Back + TV pill buttons, left-aligned together */
        .r-top-row {
          display: flex;
          width: 100%;
          justify-content: flex-start;
          align-items: center;
          gap: 10px;
        }
        .r-pill-btn {
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 5px;
          background: rgba(255,255,255,0.09);
          border: 1px solid rgba(255,255,255,0.14) !important;
          border-radius: 20px !important;
          padding: 8px 14px !important;
          cursor: pointer;
          color: rgba(255,255,255,0.88);
          font-size: 13px;
          font-weight: 500;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
          letter-spacing: -0.1px;
          transition: all 0.15s ease;
        }
        .r-pill-btn svg { width: 15px; height: 15px; fill: rgba(255,255,255,0.88); flex-shrink: 0; }
        .r-pill-btn:active, .r-pill-btn.pressed { background: rgba(255,255,255,0.18); transform: scale(0.94); box-shadow: 0 0 12px rgba(255,255,255,0.12); }
        /* Power button — red tint when device is on to show live state */
        .r-power-btn.r-power-on { background: rgba(255,59,48,0.18); border-color: rgba(255,59,48,0.4) !important; }
        .r-power-btn.r-power-on svg { fill: rgba(255,90,80,0.95); }
        .r-power-btn.r-power-on:active, .r-power-btn.r-power-on.pressed { background: rgba(255,59,48,0.28); box-shadow: 0 0 12px rgba(255,59,48,0.25); }

        /* ─── Clickpad — fills the available space now media row is removed ─── */
        .clickpad-wrap { display: flex; align-items: center; justify-content: center; width: 100%; flex: 1; }
        .clickpad {
          position: relative;
          width: 80%;
          aspect-ratio: 1 / 0.88;
          border-radius: 22px;
          background: linear-gradient(160deg, rgba(62,62,68,0.97) 0%, rgba(44,44,50,0.99) 100%);
          border: 1px solid rgba(255,255,255,0.10);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(0,0,0,0.3), 0 6px 28px rgba(0,0,0,0.45);
          overflow: hidden;
          flex-shrink: 0;
          user-select: none;
        }
        /* Directional zones — hit areas with arrow icons */
        .cp-dir {
          position: absolute;
          background: transparent;
          border: none !important;
          border-radius: 0 !important;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.12s ease;
          padding: 0;
          z-index: 2;
        }
        .cp-dir svg { fill: rgba(255,255,255,0.55); pointer-events: none; width: 34px; height: 34px; transition: fill 0.12s ease; }
        .cp-dir:active, .cp-dir.pressed { background: rgba(255,255,255,0.08); }
        .cp-dir:active svg, .cp-dir.pressed svg { fill: #fff; filter: drop-shadow(0 0 5px rgba(255,255,255,0.6)); }
        .cp-up    { top: 0; left: 0; right: 0; height: 36%; align-items: flex-start; padding-top: 14px; }
        .cp-down  { bottom: 0; left: 0; right: 0; height: 36%; align-items: flex-end; padding-bottom: 14px; }
        .cp-left  { top: 0; left: 0; bottom: 0; width: 30%; justify-content: flex-start; padding-left: 16px; }
        .cp-right { top: 0; right: 0; bottom: 0; width: 30%; justify-content: flex-end; padding-right: 16px; }
        /* Centre select — visually raised button in the middle */
        .cp-select {
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 34%;
          aspect-ratio: 1 / 1.05;
          border-radius: 10px !important;
          background: rgba(255,255,255,0.09);
          border: 1px solid rgba(255,255,255,0.16) !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 8px rgba(0,0,0,0.35);
          cursor: pointer;
          z-index: 3;
          transition: all 0.12s ease;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .cp-select:active, .cp-select.pressed {
          background: rgba(255,255,255,0.18);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.1), 0 0 14px rgba(255,255,255,0.15);
          transform: translate(-50%, -50%) scale(0.95);
        }
      </style>

      <ha-card id="cardOuter" class="mode-compact">
        <button class="size-toggle" id="modeBtn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
            <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
          </svg>
        </button>

        <div class="art-wrapper" id="artClick">
          <img id="albumImg">
          <div id="mainPlaceholder" class="placeholder-svg"></div>

          <!-- Remote toggle — visible only in expanded view, bottom-right of art -->
          <button class="remote-toggle-btn" id="remoteBtn">
            <svg viewBox="0 0 24 24"><path d="M17 5H7a5 5 0 0 0-5 5v4a5 5 0 0 0 5 5h10a5 5 0 0 0 5-5v-4a5 5 0 0 0-5-5zm-8 9H7v-2h2v2zm0-4H7V8h2v2zm4 6h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V6h2v2zm4 8h-2v-6h2v6z"/></svg>
          </button>

          <!-- Remote overlay — fills art area when active -->
          <div class="remote-overlay hidden" id="remoteOverlay">
            <div class="remote-panel">

              <!-- Row 1: Back + Home -->
              <div class="r-top-row">
                <button class="r-pill-btn" id="rMenu">
                  <svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
                  Back
                </button>
                <button class="r-pill-btn" id="rHome">
                  <svg viewBox="0 0 24 24"><path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/></svg>
                  TV
                </button>
                <button class="r-pill-btn r-power-btn" id="rPower">
                  <svg viewBox="0 0 24 24"><path d="M16.56,5.44L15.11,6.89C16.84,7.94 18,9.83 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12C6,9.83 7.16,7.94 8.88,6.88L7.44,5.44C5.36,6.88 4,9.28 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12C20,9.28 18.64,6.88 16.56,5.44M13,3H11V13H13V3Z"/></svg>
                  Power
                </button>
              </div>

              <!-- Touchpad — Apple Remote app style rounded rectangle -->
              <div class="clickpad-wrap">
                <div class="clickpad">
                  <button class="cp-dir cp-up" id="rUp">
                    <svg viewBox="0 0 24 24"><path d="M13,20H11V8L5.5,13.5L4.08,12.08L12,4.16L19.92,12.08L18.5,13.5L13,8V20Z"/></svg>
                  </button>
                  <button class="cp-dir cp-down" id="rDown">
                    <svg viewBox="0 0 24 24"><path d="M11,4H13V16L18.5,10.5L19.92,11.92L12,19.84L4.08,11.92L5.5,10.5L11,16V4Z"/></svg>
                  </button>
                  <button class="cp-dir cp-left" id="rLeft">
                    <svg viewBox="0 0 24 24"><path d="M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z"/></svg>
                  </button>
                  <button class="cp-dir cp-right" id="rRight">
                    <svg viewBox="0 0 24 24"><path d="M4,11V13H16L10.5,18.5L11.92,19.92L19.84,12L11.92,4.08L10.5,5.5L16,11H4Z"/></svg>
                  </button>
                  <button class="cp-select" id="rSelect"></button>
                </div>
              </div>

            </div>
          </div>
        </div>

        <div class="content">
          <div class="info-row">
            <div class="mini-art" id="miniArtClick">
              <img id="miniImg">
              <div id="miniPlaceholder" class="placeholder-svg"></div>
            </div>
            <div style="flex:1; overflow:hidden; padding-right: 25px;">
              <div class="track-title" id="tTitle">Loading...</div>
              <div class="track-artist" id="tArtist"></div>
            </div>
          </div>
          <div class="progress-bar" id="progWrap"><div class="progress-fill" id="progFill"></div></div>
          <div class="progress-times"><span id="pCur">0:00</span><span id="pTot">0:00</span></div>
          <div class="controls">
            <button class="extra-btn" id="btnShuffle"><svg viewBox="0 0 24 24"><path d="M14.83,13.41L13.42,14.82L16.55,17.95L14.5,20H20V14.5L17.96,16.54L14.83,13.41M14.5,4H20V9.5L17.96,7.46L5.41,20L4,18.59L16.54,6.04L14.5,4M10.59,9.17L5.41,4L4,5.41L9.17,10.58L10.59,9.17Z"/></svg></button>
            <button class="nav-btn" id="btnPrev"><svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg></button>
            <button class="play-btn" id="btnPlay"><svg viewBox="0 0 24 24" id="playIcon"></svg></button>
            <button class="nav-btn" id="btnNext"><svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg></button>
            <button class="extra-btn" id="btnRepeat"><svg viewBox="0 0 24 24" id="repeatIcon"></svg></button>
            <button class="mini-remote-btn" id="miniRemoteBtn">
              <svg viewBox="0 0 24 24"><path d="M17 5H7a5 5 0 0 0-5 5v4a5 5 0 0 0 5 5h10a5 5 0 0 0 5-5v-4a5 5 0 0 0-5-5zm-8 9H7v-2h2v2zm0-4H7V8h2v2zm4 6h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V6h2v2zm4 8h-2v-6h2v6z"/></svg>
            </button>
            <div class="vol-section">
              <svg class="vol-icon" id="volMuteBtn" viewBox="0 0 24 24"></svg>
              <input type="range" class="volume-slider" id="vSlider" min="0" max="100">
            </div>
          </div>
          <select class="selector" id="eSelector"></select>
        </div>
      </ha-card>
    `;
  }

  setupListeners() {
    const r = this.shadowRoot;

    const addPressEffect = (button) => {
      button.addEventListener('pointerdown', () => button.classList.add('pressed'));
      button.addEventListener('pointerup',   () => button.classList.remove('pressed'));
      button.addEventListener('pointerleave',() => button.classList.remove('pressed'));
    };

    // ── Existing listeners (unchanged) ──
    r.getElementById('modeBtn').onclick = () => r.getElementById('cardOuter').classList.toggle('mode-compact');

    // Art wrapper click opens more-info only when NOT in remote mode
    r.getElementById('artClick').onclick = () => { if (!this._remoteMode) this._openMoreInfo(); };
    r.getElementById('miniArtClick').onclick = () => this._openMoreInfo();

    r.getElementById('btnPlay').onclick    = () => this.call('media_play_pause');
    r.getElementById('btnPrev').onclick    = () => this.call('media_previous_track');
    r.getElementById('btnNext').onclick    = () => this.call('media_next_track');
    r.getElementById('btnShuffle').onclick = () => {
      const state = this._hass.states[this._entity];
      this.call('shuffle_set', { shuffle: !state.attributes.shuffle });
    };
    r.getElementById('btnRepeat').onclick  = () => {
      const state = this._hass.states[this._entity];
      const next = state.attributes.repeat === 'all' ? 'one' : state.attributes.repeat === 'one' ? 'off' : 'all';
      this.call('repeat_set', { repeat: next });
    };

    ['btnPlay','btnPrev','btnNext','btnShuffle','btnRepeat','modeBtn'].forEach(id => addPressEffect(r.getElementById(id)));

    const slider = r.getElementById('vSlider');

    slider.oninput = (e) => {
      const newLevel = parseFloat(e.target.value) / 100;
      const remoteEntityId = this._entity.replace('media_player.', 'remote.');
      const hasRemote = !!this._hass.states[remoteEntityId];

      if (hasRemote) {
        const prev = this._lastVolume !== null
          ? this._lastVolume
          : (this._hass.states[this._entity]?.attributes?.volume_level ?? 0.5);
        const delta = newLevel - prev;

        if (Math.abs(delta) > 0.008) {
          const cmd = delta > 0 ? 'volume_up' : 'volume_down';
          const now = Date.now();
          // Fire immediately on first move, then throttle to one command per 380ms
          if (!this._volLastFired || (now - this._volLastFired) >= 380) {
            if (this._volDebounce) { clearTimeout(this._volDebounce); this._volDebounce = null; }
            this._hass.callService('remote', 'send_command', {
              entity_id: remoteEntityId, command: cmd
            }).catch(() => {});
            this._volLastFired = now;
          } else {
            // Schedule a trailing command so the final drag position always lands
            if (this._volDebounce) clearTimeout(this._volDebounce);
            this._volDebounce = setTimeout(() => {
              this._hass.callService('remote', 'send_command', {
                entity_id: remoteEntityId, command: cmd
              }).catch(() => {});
              this._volLastFired = Date.now();
            }, 380 - (now - this._volLastFired));
          }
          this._lastVolume = newLevel;
        }
      } else {
        this.call('volume_set', { volume_level: newLevel });
        this._lastVolume = newLevel;
      }
    };
    r.getElementById('eSelector').onchange = (e) => {
      this._entity = e.target.value;
      this._manualSelection = true;
      this._lastVolume = null;
      this._volLastFired = null;
      if (this._volDebounce) { clearTimeout(this._volDebounce); this._volDebounce = null; }
      if (this._remoteMode) this._toggleRemote();
      this.updateContent(this._hass.states[this._entity]);
    };
    r.getElementById('progWrap').onclick = (e) => this.doSeek(e);

    // ── Remote toggle ──
    const remoteBtn = r.getElementById('remoteBtn');
    remoteBtn.onclick = (e) => { e.stopPropagation(); this._toggleRemote(); };
    addPressEffect(remoteBtn);

    // ── Mini remote button (compact mode) — expand card then open remote ──
    const miniRemoteBtn = r.getElementById('miniRemoteBtn');
    miniRemoteBtn.onclick = () => {
      const card = r.getElementById('cardOuter');
      if (card.classList.contains('mode-compact')) {
        card.classList.remove('mode-compact');
      }
      if (!this._remoteMode) {
        // Brief delay so art-wrapper is visible before overlay is applied
        requestAnimationFrame(() => this._toggleRemote());
      }
    };
    addPressEffect(miniRemoteBtn);

    // Prevent overlay clicks bubbling to art-wrapper (which would open more-info)
    r.getElementById('remoteOverlay').onclick = (e) => e.stopPropagation();

    // ── Remote control buttons ──
    const rCmd = (id, fn) => {
      const el = r.getElementById(id);
      if (!el) return;
      el.onclick = (e) => { e.stopPropagation(); fn(); };
      addPressEffect(el);
    };

    rCmd('rMenu',     () => this.sendRemoteCommand('menu'));
    rCmd('rHome',     () => this.sendRemoteCommand('home'));
    rCmd('rUp',       () => this.sendRemoteCommand('up'));
    rCmd('rDown',     () => this.sendRemoteCommand('down'));
    rCmd('rLeft',     () => this.sendRemoteCommand('left'));
    rCmd('rRight',    () => this.sendRemoteCommand('right'));
    rCmd('rSelect',   () => this.sendRemoteCommand('select'));
    rCmd('rPower',    () => {
      const state = this._hass.states[this._entity];
      const isOff  = state?.state === 'off' || state?.state === 'standby' || state?.state === 'unavailable';
      this.call(isOff ? 'turn_on' : 'turn_off');
    });
  }

  _openMoreInfo() {
    const event = new Event("hass-more-info", { bubbles: true, composed: true });
    event.detail = { entityId: this._entity };
    this.dispatchEvent(event);
  }

  call(svc, data = {}) {
    this._hass.callService('media_player', svc, { entity_id: this._entity, ...data });
  }

  doSeek(e) {
    const state = this._hass.states[this._entity];
    if (!state || !state.attributes.media_duration) return;
    const rect    = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    this.call('media_seek', { seek_position: state.attributes.media_duration * percent });
  }

  updateContent(state) {
    const r = this.shadowRoot;
    if (!state || !r) return;
    const isPlaying = state.state === 'playing';
    r.host.style.setProperty('--accent',     this._config.accent_color);
    r.host.style.setProperty('--vol-accent', this._config.volume_accent || this._config.accent_color);

    const titleEl  = r.getElementById('tTitle');
    const artistEl = r.getElementById('tArtist');
    titleEl.textContent  = state.attributes.media_title  || (isPlaying ? 'Music' : 'Idle');
    titleEl.style.color  = this._config.title_color  || '#ffffff';
    artistEl.textContent = state.attributes.media_artist || state.attributes.friendly_name || '';
    artistEl.style.color = this._config.artist_color || 'rgba(255,255,255,0.7)';

    // Show or hide entity selector
    const cardOuter = r.getElementById('cardOuter');
    if (this._config.show_entity_selector === false) {
      cardOuter.classList.add('hide-selector');
    } else {
      cardOuter.classList.remove('hide-selector');
    }

    r.getElementById('btnShuffle').classList.toggle('active', isPlaying && state.attributes.shuffle === true);
    const rep = state.attributes.repeat;
    r.getElementById('btnRepeat').classList.toggle('active', isPlaying && rep !== undefined && rep !== 'off');

    // Sync remote power button — lit red when device is on
    const rPowerBtn = r.getElementById('rPower');
    if (rPowerBtn) {
      const isOff = state.state === 'off' || state.state === 'standby' || state.state === 'unavailable';
      rPowerBtn.classList.toggle('r-power-on', !isOff);
    }
    r.getElementById('repeatIcon').innerHTML = rep === 'one'
      ? '<path d="M7,7H17V10L21,6L17,2V5H5V11H7V7M17,17H7V14L3,18L7,22V19H19V13H17V17M10.75,15V13H9.5V12L10.7,11.9V11H11.75V15H10.75Z"/>'
      : '<path d="M7,7H17V10L21,6L17,2V5H5V11H7V7M17,17H7V14L3,18L7,22V19H19V13H17V17Z"/>';

    const artUrl  = state.attributes.entity_picture;
    const mainImg = r.getElementById('albumImg');
    const miniImg = r.getElementById('miniImg');
    const mainPh  = r.getElementById('mainPlaceholder');
    const miniPh  = r.getElementById('miniPlaceholder');

    // Update mini-art regardless of remote mode
    if (isPlaying && artUrl) {
      miniImg.src = artUrl;
      miniImg.classList.remove('hidden');
      miniPh.classList.add('hidden');
    } else {
      miniImg.classList.add('hidden');
      miniPh.innerHTML = this.getDeviceIcon(state).replace('width="120" height="120"', 'width="24" height="24"');
      miniPh.classList.remove('hidden');
    }

    // Only touch main art when remote overlay is not active
    if (!this._remoteMode) {
      if (isPlaying && artUrl) {
        mainImg.src = artUrl;
        mainImg.classList.remove('hidden');
        mainPh.classList.add('hidden');
      } else {
        mainImg.classList.add('hidden');
        mainPh.innerHTML = this.getDeviceIcon(state);
        mainPh.classList.remove('hidden');
      }
    }

    r.getElementById('playIcon').innerHTML = isPlaying
      ? '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>'
      : '<path d="M8 5v14l11-7z"/>';
    r.getElementById('vSlider').value = (state.attributes.volume_level || 0) * 100;
    r.getElementById('pTot').textContent = this.formatTime(state.attributes.media_duration || 0);

    const sel = r.getElementById('eSelector');
    if (sel) {
      const showSel = this._config.show_entity_selector !== false;
      sel.classList.toggle('hidden', !showSel);
      r.getElementById('cardOuter').classList.toggle('selector-hidden', !showSel);
      if (showSel) {
        sel.innerHTML = (this._config.entities || []).map(ent => {
          const s = this._hass.states[ent];
          return `<option value="${ent}" ${ent === this._entity ? 'selected' : ''}>${s?.attributes?.friendly_name || ent}</option>`;
        }).join('');
      }
    }
  }

  formatTime(s) {
    if (!s || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60), rs = Math.floor(s % 60);
    return `${m}:${rs < 10 ? '0' : ''}${rs}`;
  }
}

class AtvMediaRemoteEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._initialized = false;
    this._searchTerm = "";
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._initialized) this.render();
  }

  setConfig(config) {
    this._config = config;
    if (this._initialized) this.updateUI();
  }

  updateUI() {
    const root = this.shadowRoot;
    if (!root) return;
    const colorInput = root.getElementById('accent_color');
    if (colorInput) colorInput.value = this._config.accent_color || '#007AFF';
    const volColorInput = root.getElementById('volume_accent');
    if (volColorInput) volColorInput.value = this._config.volume_accent || this._config.accent_color || '#007AFF';
    const titleColorInput = root.getElementById('title_color');
    if (titleColorInput) titleColorInput.value = this._config.title_color || '#ffffff';
    const artistColorInput = root.getElementById('artist_color');
    if (artistColorInput) artistColorInput.value = this._config.artist_color || '#ffffff';
    const autoSwitchInput = root.getElementById('auto_switch');
    if (autoSwitchInput) autoSwitchInput.checked = this._config.auto_switch !== false;
    const showSelectorInput = root.getElementById('show_entity_selector');
    if (showSelectorInput) showSelectorInput.checked = this._config.show_entity_selector !== false;
  }

  render() {
    if (!this._hass || !this._config) return;
    this._initialized = true;
    const selected = this._config.entities || [];
    const others = Object.keys(this._hass.states)
      .filter(e => e.startsWith('media_player.') && !selected.includes(e))
      .sort();
    const sortedList = [...selected, ...others];

    this.shadowRoot.innerHTML = `
      <style>
        .container { display: flex; flex-direction: column; gap: 18px; padding: 10px; color: var(--primary-text-color); font-family: sans-serif; }
        .row { display: flex; flex-direction: column; gap: 8px; }
        label { font-weight: bold; font-size: 14px; }
        input[type="text"], .checklist { width: 100%; background: var(--card-background-color); color: var(--primary-text-color); border: 1px solid #444; border-radius: 4px; }
        .checklist { max-height: 300px; overflow-y: auto; margin-top: 5px; -webkit-overflow-scrolling: touch; }
        .check-item { display: flex; align-items: center; padding: 8px 12px; border-bottom: 1px solid #333; background: var(--card-background-color); touch-action: none; }
        .dragging { opacity: 0.5; background: #444 !important; }
        .drag-handle { cursor: grab; padding: 10px; color: #888; font-size: 20px; user-select: none; }
        .toggle-row { display: flex; align-items: center; justify-content: space-between; }
        .color-section { display: flex; gap: 15px; }
        .color-item { flex: 1; display: flex; flex-direction: column; gap: 5px; }
        input[type="color"] { width: 100%; height: 40px; cursor: pointer; border: 1px solid #444; border-radius: 4px; background: none; }
      </style>
      <div class="container">
        <div class="color-section">
          <div class="color-item">
            <label>Main Accent</label>
            <input type="color" id="accent_color">
          </div>
          <div class="color-item">
            <label>Volume Accent</label>
            <input type="color" id="volume_accent">
          </div>
        </div>
        <div class="color-section">
          <div class="color-item">
            <label>Song Title</label>
            <input type="color" id="title_color">
          </div>
          <div class="color-item">
            <label>Song Artist</label>
            <input type="color" id="artist_color">
          </div>
        </div>
        <div class="row">
          <div class="toggle-row">
            <label>Auto Switch Entities</label>
            <input type="checkbox" id="auto_switch">
          </div>
        </div>
        <div class="row">
          <div class="toggle-row">
            <label>Show Media Player Selector</label>
            <input type="checkbox" id="show_entity_selector">
          </div>
        </div>
        <div class="row">
          <label>Manage & Reorder Media Players</label>
          <input type="text" id="search" placeholder="Filter entities...">
          <div class="checklist" id="entityList">
            ${sortedList.map(ent => {
              const isSelected = selected.includes(ent);
              return `
                <div class="check-item" data-id="${ent}" draggable="${isSelected}">
                  <div class="drag-handle">☰</div>
                  <input type="checkbox" ${isSelected ? 'checked' : ''}>
                  <span style="margin-left: 10px; flex: 1;">${this._hass.states[ent]?.attributes?.friendly_name || ent}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;

    this._setupSearch();
    this._setupReordering();
    this._setupListeners();
    this.updateUI();
  }

  _setupSearch() {
    const searchInput = this.shadowRoot.getElementById('search');
    searchInput.addEventListener('input', (e) => {
      this._searchTerm = e.target.value.toLowerCase();
      this.shadowRoot.querySelectorAll('.check-item').forEach(item => {
        item.style.display = item.textContent.toLowerCase().includes(this._searchTerm) ? 'flex' : 'none';
      });
    });
  }

  _setupReordering() {
    const list = this.shadowRoot.getElementById('entityList');
    let draggedItem = null;

    list.addEventListener('dragstart', (e) => {
      draggedItem = e.target.closest('.check-item');
      if (!draggedItem.querySelector('input').checked) { e.preventDefault(); return; }
      draggedItem.classList.add('dragging');
    });
    list.addEventListener('dragover', (e) => {
      e.preventDefault();
      const afterElement = this._getDragAfterElement(list, e.clientY);
      if (afterElement == null) list.appendChild(draggedItem);
      else list.insertBefore(draggedItem, afterElement);
    });
    list.addEventListener('dragend', () => {
      draggedItem.classList.remove('dragging');
      this._saveOrder();
    });
    list.addEventListener('touchstart', (e) => {
      if (e.target.classList.contains('drag-handle')) {
        draggedItem = e.target.closest('.check-item');
        if (!draggedItem.querySelector('input').checked) return;
        draggedItem.classList.add('dragging');
      }
    }, { passive: false });
    list.addEventListener('touchmove', (e) => {
      if (!draggedItem) return;
      e.preventDefault();
      const touch = e.touches[0];
      const afterElement = this._getDragAfterElement(list, touch.clientY);
      if (afterElement == null) list.appendChild(draggedItem);
      else list.insertBefore(draggedItem, afterElement);
    }, { passive: false });
    list.addEventListener('touchend', () => {
      if (!draggedItem) return;
      draggedItem.classList.remove('dragging');
      draggedItem = null;
      this._saveOrder();
    });
  }

  _getDragAfterElement(container, y) {
    const draggables = [...container.querySelectorAll('.check-item:not(.dragging)')];
    return draggables.reduce((closest, child) => {
      const box    = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) return { offset, element: child };
      else return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  _saveOrder() {
    const newOrder = Array.from(this.shadowRoot.querySelectorAll('.check-item'))
      .filter(i => i.querySelector('input').checked)
      .map(i => i.getAttribute('data-id'));
    this._updateConfig('entities', newOrder);
  }

  _setupListeners() {
    const root = this.shadowRoot;
    root.querySelectorAll('.check-item input').forEach(cb => { cb.onclick = () => this._saveOrder(); });
    root.getElementById('accent_color').oninput  = (e) => this._updateConfig('accent_color',  e.target.value);
    root.getElementById('volume_accent').oninput = (e) => this._updateConfig('volume_accent', e.target.value);
    root.getElementById('title_color').oninput   = (e) => this._updateConfig('title_color',   e.target.value);
    root.getElementById('artist_color').oninput  = (e) => this._updateConfig('artist_color',  e.target.value);
    root.getElementById('auto_switch').onchange  = (e) => this._updateConfig('auto_switch',   e.target.checked);
    root.getElementById('show_entity_selector').onchange = (e) => this._updateConfig('show_entity_selector', e.target.checked);
  }

  _updateConfig(key, value) {
    if (!this._config) return;
    const newConfig = { ...this._config, [key]: value };
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: newConfig }, bubbles: true, composed: true }));
  }
}

// FAIL-SAFE REGISTRATION
if (!customElements.get('atv-media-remote')) {
  customElements.define('atv-media-remote', AtvMediaRemote);
}
if (!customElements.get('atv-media-remote-editor')) {
  customElements.define('atv-media-remote-editor', AtvMediaRemoteEditor);
}

window.customCards = window.customCards || [];
if (!window.customCards.some(card => card.type === "atv-media-remote")) {
  window.customCards.push({
    type: "atv-media-remote",
    name: "ATV Media Remote",
    preview: true,
    description: "A sleek media player with device switching and visual editor."
  });
}
