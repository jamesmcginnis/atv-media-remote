/**
 * ATV Media Remote
 * Includes: Reordering, Mobile Support, Pressed Glow Effects, MA Auto-Detection, HomePod Detection, and Remote Control.
 */
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
    this._maEntityIds = null;
    this._softMuteMap = {};
    this._preMuteMap  = {};
    this._lastSliderInput = 0;
  }

  static getConfigElement() {
    return document.createElement("atv-media-remote-editor");
  }

  static getStubConfig() {
    return { entities: [], auto_switch: true, accent_color: '#007AFF', volume_accent: '#007AFF', title_color: '#ffffff', artist_color: '#ffffff', button_color: '#ffffff', player_bg: '#1c1c1e', player_bg_opacity: 100, show_entity_selector: true, volume_control: 'slider', startup_mode: 'compact', volume_entity: '', ma_entities: [], show_vol_pct: true, vol_pct_color: 'rgba(255,255,255,0.45)', scroll_text: false, tmdb_api_key: '', remember_last_entity: false, video_lookup: 'auto', startup_volume: 35, entity_startup_volumes: {} };
  }

  setConfig(config) {
    if (!config.entities || config.entities.length === 0) throw new Error("Please define entities");
    const prevStartup = this._config?.startup_mode;
    this._config = {
      accent_color: '#007AFF',
      volume_accent: '#007AFF',
      title_color: '#ffffff',
      artist_color: '#ffffff',
      button_color: '#ffffff',
      player_bg: '#1c1c1e',
      player_bg_opacity: 100,
      auto_switch: true,
      show_entity_selector: true,
      volume_control: 'slider',
      startup_mode: 'compact',
      volume_entity: '',
      ma_entities: [],
      ma_entities: [],
      tmdb_api_key: '',
      remember_last_entity: false,
      video_lookup: 'auto',
      startup_volume: 35,
      entity_startup_volumes: {},
      ...config
    };
    if (!this._entity) {
      const saved = this._config.remember_last_entity && !this._config.auto_switch
        ? localStorage.getItem('atv_last_entity_' + (this._config.entities[0] || ''))
        : null;
      this._entity = (saved && this._config.entities.includes(saved)) ? saved : this._config.entities[0];
    }
    if (prevStartup !== undefined && prevStartup !== this._config.startup_mode && this.shadowRoot.innerHTML) {
      this._applyStartupMode();
    }
  }

  _applyStartupMode() {
    const cardOuter = this.shadowRoot.getElementById('cardOuter');
    if (!cardOuter) return;
    const mode = this._config.startup_mode || 'compact';
    cardOuter.classList.remove('mode-compact');
    if (this._remoteMode) {
      this._toggleRemote();
    }
    if (mode === 'compact') {
      cardOuter.classList.add('mode-compact');
    } else if (mode === 'remote') {
      requestAnimationFrame(() => this._toggleRemote());
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (!this.shadowRoot.innerHTML) {
      this.render();
      this.setupListeners();
      this._applyStartupMode();
      this._loadMAEntityRegistry(); // pre-warm so isMa is correct on first updateContent
      this._startupVolApplied = false; // will apply once on first playing state
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
      try {
        if (!this._hass?.connected || !this._entity) return;
        const state = this._hass.states[this._entity];
        if (!state) return;
        // Only refresh Alexa entities — they need a keep-alive; other devices don't
        const id = this._entity.toLowerCase();
        const name = (state.attributes?.friendly_name || '').toLowerCase();
        const isAlexa = id.includes('alexa') || name.includes('alexa') ||
                        (state.attributes?.platform || '').toLowerCase().includes('alexa');
        if (!isAlexa) return;
        this._hass.callService('homeassistant', 'update_entity', { entity_id: this._entity }).catch(() => {});
      } catch (_) {}
    }, 10000);
    requestAnimationFrame(() => this._applyStartupMode());
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
      const dd = r.getElementById('rAppsDropdown');
      if (dd) { dd.classList.add('hidden'); r.getElementById('rApps')?.classList.remove('r-apps-open'); }
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

  get _volEntity() {
    const ve = this._config?.volume_entity;
    return (ve && ve.trim()) ? ve.trim() : this._entity;
  }

  sendRemoteCommand(command) {
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
        :host { display: block; --accent: #007AFF; --vol-accent: #007AFF; --btn-color: rgba(255,255,255,0.9); --player-bg: transparent; }
        ha-card {
          background: var(--atv-card-bg, rgba(28, 28, 30, 0.72)) !important;
          backdrop-filter: blur(40px) saturate(180%) !important;
          -webkit-backdrop-filter: blur(40px) saturate(180%) !important;
          color: #fff !important;
          border-radius: 24px !important;
          overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
          position: relative;
          border: var(--atv-card-border, 1px solid rgba(255, 255, 255, 0.18)) !important;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4) !important;
          transition: all 0.3s ease;
        }
        /* Absolute resize btn — expanded mode only, top-right of card */
        .size-toggle-abs {
          position: absolute; top: 12px; right: 12px;
          background: rgba(255,255,255,0.15);
          border-radius: 50%; width: 32px; height: 32px; cursor: pointer; color: #fff; z-index: 10;
          display: flex; align-items: center; justify-content: center; transition: all 0.2s ease;
        }
        .size-toggle-abs svg { width: 16px; height: 16px; stroke: #fff; fill: none; }
        .size-toggle-abs:active, .size-toggle-abs.pressed { transform: scale(0.9); background: rgba(255,255,255,0.28); }

        .art-wrapper { width: 100%; aspect-ratio: 1; background: linear-gradient(135deg, rgba(40,40,45,0.8), rgba(28,28,30,0.9)); display: flex; align-items: center; justify-content: center; overflow: hidden; cursor: pointer; position: relative; -webkit-touch-callout: none; user-select: none; -webkit-user-select: none; }
        .art-wrapper img { width: 100%; height: 100%; object-fit: cover; -webkit-touch-callout: none; pointer-events: none; }

        .content { padding: 20px; display: flex; flex-direction: column; background: var(--player-bg); }
        .info-row { display: flex; align-items: center; gap: 15px; margin-bottom: 12px; padding-right: 44px; }
        /* Compact mode: no padding needed, resize btn not overlapping text area */
        .mode-compact .info-row { padding-right: 0; }
        .mini-art { display: none; width: 54px; height: 54px; border-radius: 10px; overflow: hidden; background: rgba(40,40,45,0.6); display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,0.1); cursor: pointer; flex-shrink: 0; }
        .mini-art img { width: 100%; height: 100%; object-fit: cover; }
        .track-title { font-size: 19px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: -0.3px; color: #fff; }
        .track-artist { font-size: 15px; color: rgba(255,255,255,0.7); margin-bottom: 12px; font-weight: 400; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        /* Volume percentage indicator */
        .vol-pct {
          font-size: 12px; font-weight: 500; font-variant-numeric: tabular-nums;
          color: var(--vol-pct-color, rgba(255,255,255,0.45));
          white-space: nowrap; flex-shrink: 0; letter-spacing: 0;
          display: none; position: absolute; right: 0; top: calc(50% - 9px);
          cursor: pointer; user-select: none; transition: opacity 0.2s;
          pointer-events: auto;
        }
        .vol-pct:active { opacity: 0.5; }
        .vol-pct svg { width: 16px; height: 16px; fill: var(--vol-pct-color, rgba(255,255,255,0.45)); display: block; }
        .show-vol-pct .vol-pct { display: block; }
        .mode-compact.show-vol-pct .vol-pct { right: 10px; }
        /* Scrolling text — continuous seamless marquee */
        @keyframes marquee-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .scroll-text #trackInfo { overflow: hidden; }
        .marquee-wrap {
          display: flex; white-space: nowrap; width: max-content;
          animation: marquee-scroll var(--marquee-dur, 12s) linear infinite;
        }
        .marquee-wrap span { padding-right: 64px; }
        .progress-bar { height: 5px; background: rgba(255,255,255,0.12); border-radius: 3px; margin-bottom: 6px; cursor: pointer; overflow: hidden; }
        .progress-fill { height: 100%; background: var(--accent); width: 0%; border-radius: 3px; transition: width 0.3s ease; }
        .progress-times { display: flex; justify-content: space-between; font-size: 12px; color: rgba(255,255,255,0.5); font-variant-numeric: tabular-nums; }
        .controls { display: flex; justify-content: center; align-items: center; margin: 15px 0; gap: 10px; position: relative; }
        .play-btn svg { width: 44px; height: 44px; fill: var(--btn-color); }
        .nav-btn svg { width: 28px; height: 28px; fill: var(--btn-color); }
        .extra-btn svg { width: 24px; height: 24px; fill: var(--btn-color); opacity: 0.5; }
        .extra-btn.active svg { fill: var(--accent); opacity: 1; }
        button { background: none; border: none; cursor: pointer; padding: 0; display: flex; align-items: center; justify-content: center; transition: all 0.2s cubic-bezier(0.4,0,0.2,1); border-radius: 50%; }
        button.pressed { transform: scale(0.92); background: rgba(255,255,255,0.1); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); box-shadow: 0 0 20px rgba(255,255,255,0.2); }
        button.pressed svg { filter: drop-shadow(0 0 8px rgba(255,255,255,0.8)); }
        svg.pressed { transform: scale(0.88); filter: drop-shadow(0 0 8px rgba(255,255,255,0.8)); transition: transform 0.1s ease, filter 0.1s ease; }
        /* Volume row — sits below controls on its own line */
        .vol-row { display: flex; align-items: center; gap: 8px; margin: 0 0 8px; }
        .vol-row .volume-slider { flex: 1; height: 5px; accent-color: var(--vol-accent); margin-top: 0; }
        .vol-icon { display: none; width: 18px; height: 18px; fill: rgba(255,255,255,0.5); cursor: pointer; }
        /* when button-mode is on, hide the vol-row instead */
        .vol-btn-mode .vol-row { display: none; }

        .vol-btn {
          display: none;
          cursor: pointer;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.2s cubic-bezier(0.4,0,0.2,1);
          padding: 0;
          background: none;
          border: none !important;
          border-radius: 50% !important;
        }
        .vol-btn svg { width: 24px; height: 24px; fill: var(--btn-color); opacity: 0.5; }
        .vol-btn:active, .vol-btn.pressed { transform: scale(0.92); background: rgba(255,255,255,0.1); box-shadow: 0 0 20px rgba(255,255,255,0.2); }
        .vol-btn:active svg, .vol-btn.pressed svg { fill: #fff; filter: drop-shadow(0 0 8px rgba(255,255,255,0.8)); }

        .vol-btn-mode .vol-btn { display: flex; }
        .vol-btn-mode .controls { justify-content: center; }
        .vol-btn-mode .vol-row { display: none; }
        /* ─── Speaker selector button (inline controls bar) ─── */
        .speaker-btn-wrap { position: relative; display: flex; align-items: center; justify-content: center; }
        #cardOuter.hide-selector .speaker-btn-wrap { display: none !important; }
        .speaker-btn svg { width: 24px; height: 24px; fill: var(--btn-color); }
        .speaker-btn:active svg, .speaker-btn.pressed svg { fill: var(--accent); }
        .mode-compact .speaker-btn svg { width: 20px; height: 20px; }

        /* Remote btn: hide for non-Apple-TV and for MA entities */
        #cardOuter.ma-entity .remote-toggle-btn { display: none !important; }
        #cardOuter.no-remote .remote-toggle-btn { display: none !important; }

        /* compact overrides */
        .mode-compact .art-wrapper { display: none; }
        .mode-compact .mini-art { display: flex; width: 44px; height: 44px; }
        .mode-compact .content { padding: 10px; display: flex; flex-direction: column; gap: 0; }
        .mode-compact .info-row { margin-bottom: 0; padding-right: 44px; }
        .mode-compact .track-title { font-size: 14px; }
        .mode-compact .track-artist { font-size: 12px; margin-bottom: 0; }
        .mode-compact .controls { margin: 6px 0 0 0; gap: 8px; justify-content: center; padding-right: 0; flex-wrap: wrap; }
        .mode-compact .play-btn svg { width: 28px; height: 28px; }
        .mode-compact .nav-btn svg { width: 19px; height: 19px; }
        .mode-compact .extra-btn svg { width: 20px; height: 20px; }
        .mode-compact .progress-bar { margin-top: 8px; }
        .mode-compact .progress-times { display: none; }
        .mode-compact .vol-row { margin: 10px 0 0; }

        .hidden { display: none !important; }
        .placeholder-svg { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }
        /* hide-selector hides the speaker-btn via #cardOuter.hide-selector rule above */

        /* ─── Music Assistant art-overlay browse button ─── */
        /* Permanently hidden — the controls-bar ma-ctrl-btn is used in all modes. */
        .ma-art-btn { display: none !important; }
        /* ─── Music Assistant inline controls-row button ─── */
        .ma-ctrl-btn {
          display: none;
          width: 28px; height: 28px; border-radius: 50% !important;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.16) !important;
          cursor: pointer; align-items: center; justify-content: center;
          flex-shrink: 0; transition: all 0.2s ease; padding: 0;
        }
        .ma-ctrl-btn svg { width: 15px; height: 15px; fill: rgba(255,255,255,0.78); }
        .ma-ctrl-btn:active, .ma-ctrl-btn.pressed { background: rgba(255,255,255,0.18); transform: scale(0.9); }
        /* MA ctrl btn: expanded mode MA entities only */
        #cardOuter.ma-entity:not(.mode-compact) .ma-ctrl-btn {
          display: flex !important;
          position: absolute;
          left: 0;
          top: calc(50% - 14px);
        }
        /* MA ctrl btn: compact mode MA entities only */
        #cardOuter.mode-compact.ma-entity .ma-ctrl-btn {
          display: flex !important;
          position: absolute;
          left: 10px;
          top: calc(50% - 14px);
        }

        /* ─── Music Assistant popup ─── */
        .ma-popup {
          position: absolute; inset: 0; z-index: 30;
          background: rgba(16,16,18,0.98);
          display: flex; flex-direction: column;
          opacity: 0; pointer-events: none;
          transition: opacity 0.22s ease;
          border-radius: 24px; overflow: hidden;
        }
        .ma-popup.visible { opacity: 1; pointer-events: all; }

        .ma-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 14px 0; flex-shrink: 0;
        }
        .ma-title { font-size: 15px; font-weight: 700; color: #fff; letter-spacing: -0.2px; }
        .ma-close {
          width: 28px; height: 28px; border-radius: 50% !important;
          background: rgba(255,255,255,0.1); border: none !important;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: all 0.15s ease; padding: 0; flex-shrink: 0;
        }
        .ma-close svg { width: 14px; height: 14px; fill: rgba(255,255,255,0.7); }
        .ma-close:active { background: rgba(255,255,255,0.22); transform: scale(0.9); }

        .ma-search-row {
          display: flex; gap: 8px; padding: 10px 14px 4px; flex-shrink: 0;
        }
        .ma-search-input {
          flex: 1; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.14);
          border-radius: 10px; padding: 8px 12px; color: #fff; font-size: 13px;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
          outline: none;
        }
        .ma-search-input::placeholder { color: rgba(255,255,255,0.3); }
        .ma-search-input:focus { border-color: rgba(255,255,255,0.3); background: rgba(255,255,255,0.12); }
        .ma-search-btn {
          background: #007AFF; border: none !important; border-radius: 10px !important;
          color: #fff; font-size: 13px; font-weight: 600; padding: 8px 14px;
          cursor: pointer; white-space: nowrap; transition: all 0.15s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
        }
        .ma-search-btn:active { background: #0062cc; transform: scale(0.96); }

        .ma-tabs {
          display: flex; overflow-x: auto; flex-shrink: 0;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          padding: 0 6px; scrollbar-width: none; gap: 2px; margin-top: 6px;
        }
        .ma-tabs::-webkit-scrollbar { display: none; }
        .ma-tab {
          padding: 10px 11px; font-size: 12px; font-weight: 600;
          color: rgba(255,255,255,0.38); white-space: nowrap; cursor: pointer;
          border-bottom: 2px solid transparent; transition: all 0.15s ease;
          background: none !important; border-radius: 0 !important; flex-shrink: 0;
        }
        .ma-tab.active { color: #fff; border-bottom-color: #007AFF; }
        .ma-tab:active { color: rgba(255,255,255,0.7); }

        .ma-content { flex: 1; overflow-y: auto; padding: 10px; }
        .ma-content::-webkit-scrollbar { width: 3px; }
        .ma-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 2px; }

        .ma-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }

        .ma-item {
          display: flex; flex-direction: column; cursor: pointer;
          border-radius: 10px; overflow: hidden;
          background: rgba(255,255,255,0.05);
          transition: transform 0.15s ease, background 0.15s ease;
        }
        .ma-item:active { transform: scale(0.94); background: rgba(255,255,255,0.1); }
        .ma-item-art {
          width: 100%; aspect-ratio: 1; background: rgba(35,35,40,0.9);
          display: flex; align-items: center; justify-content: center; overflow: hidden;
          position: relative;
        }
        .ma-item-art img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .ma-item-art svg { width: 38%; height: 38%; fill: rgba(255,255,255,0.18); }
        .ma-item-info { padding: 5px 6px 7px; }
        .ma-item-title { font-size: 11px; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ma-item-sub { font-size: 10px; color: rgba(255,255,255,0.38); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px; }

        .ma-loading { display: flex; align-items: center; justify-content: center; min-height: 100px; color: rgba(255,255,255,0.35); font-size: 13px; gap: 8px; }
        .ma-loading::before { content: ''; width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.15); border-top-color: #007AFF; border-radius: 50%; animation: ma-spin 0.8s linear infinite; }
        @keyframes ma-spin { to { transform: rotate(360deg); } }
        .ma-empty { display: flex; align-items: center; justify-content: center; min-height: 100px; color: rgba(255,255,255,0.3); font-size: 13px; text-align: center; padding: 20px; }
        .ma-error { display: flex; align-items: center; justify-content: center; min-height: 100px; color: rgba(255,100,100,0.7); font-size: 12px; text-align: center; padding: 20px; line-height: 1.5; }

        /* ─── Info popup (same structure as MA popup) ─── */
        .info-popup {
          position: absolute; inset: 0; z-index: 30;
          background: rgba(16,16,18,0.98);
          display: flex; flex-direction: column;
          opacity: 0; pointer-events: none;
          transition: opacity 0.22s ease;
          border-radius: 24px; overflow: hidden;
        }
        .info-popup.visible { opacity: 1; pointer-events: all; }

        .info-popup-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 14px 0; flex-shrink: 0;
        }
        .info-popup-title { font-size: 15px; font-weight: 700; color: #fff; letter-spacing: -0.2px; }
        .info-popup-close {
          width: 28px; height: 28px; border-radius: 50% !important;
          background: rgba(255,255,255,0.1); border: none !important;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: all 0.15s ease; padding: 0; flex-shrink: 0;
        }
        .info-popup-close svg { width: 14px; height: 14px; fill: rgba(255,255,255,0.7); }
        .info-popup-close:active { background: rgba(255,255,255,0.22); transform: scale(0.9); }

        .info-popup-content { flex: 1; overflow-y: auto; padding: 12px 14px 16px; }
        .info-popup-content::-webkit-scrollbar { width: 3px; }
        .info-popup-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 2px; }

        /* Loading / error states (reuse MA classes) */
        .info-loading { display: flex; align-items: center; justify-content: center; min-height: 120px; color: rgba(255,255,255,0.35); font-size: 13px; gap: 8px; }
        .info-loading::before { content: ''; width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.15); border-top-color: #007AFF; border-radius: 50%; animation: ma-spin 0.8s linear infinite; }
        .info-error { color: rgba(255,100,100,0.75); font-size: 12px; text-align: center; padding: 20px; line-height: 1.6; }
        .info-no-key { color: rgba(255,255,255,0.38); font-size: 12px; text-align: center; padding: 20px; line-height: 1.7; }
        .info-no-key a { color: #007AFF; text-decoration: none; }
        .info-no-key code { background: rgba(255,255,255,0.08); border-radius: 4px; padding: 1px 5px; font-size: 11px; }

        /* Info cards */
        .info-hero { display: flex; gap: 14px; margin-bottom: 14px; }
        .info-hero-art {
          width: 96px; height: 96px; flex-shrink: 0; border-radius: 10px; overflow: hidden;
          background: rgba(40,40,45,0.8); display: flex; align-items: center; justify-content: center;
        }
        .info-hero-art img { width: 100%; height: 100%; object-fit: cover; display: block; }
        a.info-hero-art { opacity: 1; transition: opacity 0.15s ease; }
        a.info-hero-art:hover { opacity: 0.75; }
        a.info-hero-art:active { opacity: 0.55; }
        .info-hero-art svg { width: 40px; height: 40px; fill: rgba(255,255,255,0.2); }
        .info-hero-meta { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 4px; min-width: 0; }
        .info-hero-title { font-size: 15px; font-weight: 700; color: #fff; letter-spacing: -0.3px; line-height: 1.25; }
        .info-hero-sub { font-size: 12px; color: rgba(255,255,255,0.55); }
        .info-hero-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
        .info-tag {
          font-size: 10px; font-weight: 600; color: rgba(255,255,255,0.65);
          background: rgba(255,255,255,0.09); border: 1px solid rgba(255,255,255,0.13);
          border-radius: 20px; padding: 2px 8px; letter-spacing: 0.2px;
        }

        .info-section-label { font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.35); letter-spacing: 0.6px; text-transform: uppercase; margin: 12px 0 6px; }
        .info-overview { font-size: 12px; color: rgba(255,255,255,0.62); line-height: 1.6; }
        /* TMDB percentage ring */
        .info-rating { display: flex; align-items: center; gap: 10px; margin-top: 6px; }
        .info-rating-ring { position: relative; width: 42px; height: 42px; flex-shrink: 0; }
        .info-rating-ring svg { width: 42px; height: 42px; transform: rotate(-90deg); }
        .info-rating-ring-bg  { fill: none; stroke: rgba(255,255,255,0.08); stroke-width: 3.5; }
        .info-rating-ring-arc { fill: none; stroke-width: 3.5; stroke-linecap: round; transition: stroke-dashoffset 0.6s ease; }
        .info-rating-ring-label {
          position: absolute; inset: 0;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
        }
        .info-rating-ring-pct  { font-size: 13px; font-weight: 700; color: #fff; line-height: 1; letter-spacing: -0.5px; }
        .info-rating-meta { display: flex; flex-direction: column; gap: 2px; }
        .info-rating-val   { font-size: 12px; font-weight: 600; color: #fff; }
        .info-rating-count { font-size: 10px; color: rgba(255,255,255,0.38); }

        /* Track listing */
        .info-tracklist { display: flex; flex-direction: column; gap: 1px; }
        .info-track, a.info-track {
          display: flex; align-items: center; gap: 10px; padding: 7px 4px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          border-radius: 6px; transition: background 0.15s ease;
        }
        .info-track:last-child, a.info-track:last-child { border-bottom: none; }
        .info-track-num { font-size: 11px; color: rgba(255,255,255,0.3); width: 18px; text-align: right; flex-shrink: 0; font-variant-numeric: tabular-nums; }
        .info-track-title { font-size: 12px; color: rgba(255,255,255,0.82); flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .info-track.playing .info-track-title, a.info-track.playing .info-track-title { color: var(--accent); font-weight: 600; }
        .info-track-dur { font-size: 11px; color: rgba(255,255,255,0.32); flex-shrink: 0; font-variant-numeric: tabular-nums; }

        /* Clickable track rows (MA available) */
        .info-track.ma-clickable, a.info-track.ma-clickable { cursor: pointer; }
        .info-track.ma-clickable:hover, a.info-track.ma-clickable:hover { background: rgba(255,255,255,0.07); }
        .info-track.ma-clickable:active, a.info-track.ma-clickable:active { background: rgba(255,255,255,0.13); transform: scale(0.98); }
        .info-track-play-hint {
          width: 14px; height: 14px; flex-shrink: 0; opacity: 0;
          transition: opacity 0.15s ease;
        }
        .info-track-play-hint svg { width: 14px; height: 14px; fill: var(--accent); display: block; }
        .info-track.ma-clickable:hover .info-track-play-hint, a.info-track.ma-clickable:hover .info-track-play-hint { opacity: 1; }

        /* ─── Track confirm overlay (inside infoPopup) ─── */
        .track-confirm {
          position: absolute; inset: 0; z-index: 10;
          background: rgba(12,12,14,0.92);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 20px 18px;
          opacity: 0; pointer-events: none;
          transition: opacity 0.2s ease;
          border-radius: 24px;
        }
        .track-confirm.visible { opacity: 1; pointer-events: all; }

        .track-confirm-close {
          position: absolute; top: 12px; right: 12px;
          width: 28px; height: 28px; border-radius: 50% !important;
          background: rgba(255,255,255,0.1); border: none !important;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: all 0.15s ease; padding: 0;
        }
        .track-confirm-close svg { width: 14px; height: 14px; fill: rgba(255,255,255,0.7); }
        .track-confirm-close:active { background: rgba(255,255,255,0.22); transform: scale(0.9); }

        .track-confirm-icon {
          width: 52px; height: 52px; border-radius: 50%;
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.12);
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 14px; flex-shrink: 0;
        }
        .track-confirm-icon svg { width: 24px; height: 24px; fill: var(--accent); }

        .track-confirm-label {
          font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.35);
          letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 8px;
        }
        .track-confirm-title {
          font-size: 16px; font-weight: 700; color: #fff; letter-spacing: -0.3px;
          text-align: center; line-height: 1.3; margin-bottom: 4px;
          max-width: 100%; overflow: hidden; text-overflow: ellipsis;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
        }
        .track-confirm-artist {
          font-size: 13px; color: rgba(255,255,255,0.5); margin-bottom: 16px;
          text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;
        }
        .track-confirm-speaker {
          display: flex; align-items: center; gap: 6px;
          background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1);
          border-radius: 20px; padding: 5px 12px; margin-bottom: 20px;
        }
        .track-confirm-speaker svg { width: 13px; height: 13px; fill: rgba(255,255,255,0.45); flex-shrink: 0; }
        .track-confirm-speaker-name { font-size: 12px; color: rgba(255,255,255,0.55); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 160px; }
        .track-confirm-btns { display: flex; gap: 10px; width: 100%; }
        .track-confirm-cancel {
          flex: 1; padding: 11px; border-radius: 12px !important;
          background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12) !important;
          color: rgba(255,255,255,0.7); font-size: 14px; font-weight: 600;
          cursor: pointer; font-family: inherit; transition: all 0.15s ease;
        }
        .track-confirm-cancel:active { background: rgba(255,255,255,0.15); transform: scale(0.97); }
        .track-confirm-play {
          flex: 2; padding: 11px; border-radius: 12px !important;
          background: var(--accent); border: none !important;
          color: #fff; font-size: 14px; font-weight: 700;
          cursor: pointer; font-family: inherit; transition: all 0.15s ease;
          display: flex; align-items: center; justify-content: center; gap: 6px;
        }
        .track-confirm-play svg { width: 14px; height: 14px; fill: #fff; }
        .track-confirm-play:active { opacity: 0.85; transform: scale(0.97); }
        .track-confirm-play:disabled { opacity: 0.5; cursor: default; }

        .track-confirm-searching {
          display: flex; flex-direction: column; align-items: center; gap: 10px;
          color: rgba(255,255,255,0.5); font-size: 13px;
        }
        .track-confirm-searching::before {
          content: ''; width: 22px; height: 22px;
          border: 2px solid rgba(255,255,255,0.15); border-top-color: var(--accent);
          border-radius: 50%; animation: ma-spin 0.8s linear infinite;
        }
        .track-confirm-result {
          font-size: 12px; text-align: center; line-height: 1.6; padding: 4px 0;
        }
        .track-confirm-result.success { color: rgba(100,220,100,0.85); }
        .track-confirm-result.error { color: rgba(255,100,100,0.8); }

        /* Cast row */
        .info-cast { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none; }
        .info-cast::-webkit-scrollbar { display: none; }
        .info-cast-item {
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          flex-shrink: 0; width: 56px; text-decoration: none;
          border-radius: 10px; padding: 5px 2px; margin: -5px -2px;
          transition: background 0.15s ease, transform 0.15s ease;
          cursor: pointer;
        }
        .info-cast-item:hover { background: rgba(255,255,255,0.07); }
        .info-cast-item:active { background: rgba(255,255,255,0.13); transform: scale(0.93); }
        .info-cast-item:hover .info-cast-photo { box-shadow: 0 0 0 2px var(--accent); }
        .info-cast-photo { width: 48px; height: 48px; border-radius: 50%; overflow: hidden; background: rgba(40,40,45,0.8); display: flex; align-items: center; justify-content: center; transition: box-shadow 0.15s ease; }
        .info-cast-photo img { width: 100%; height: 100%; object-fit: cover; }
        .info-cast-photo svg { width: 22px; height: 22px; fill: rgba(255,255,255,0.2); }
        .info-cast-name { font-size: 10px; color: rgba(255,255,255,0.55); text-align: center; line-height: 1.3; white-space: normal; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }

        /* External link */
        .info-ext-link {
          display: inline-flex; align-items: center; gap: 5px; margin-top: 14px;
          background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.14);
          border-radius: 8px; padding: 7px 12px; color: rgba(255,255,255,0.7);
          font-size: 12px; font-weight: 500; text-decoration: none; transition: all 0.15s ease;
          cursor: pointer;
        }
        .info-ext-link:active { background: rgba(255,255,255,0.14); transform: scale(0.96); }
        .info-ext-link svg { width: 12px; height: 12px; fill: rgba(255,255,255,0.5); }
        .info-back-btn {
          display: inline-flex; align-items: center; gap: 5px; margin-bottom: 12px;
          background: none; border: none; padding: 4px 2px; color: rgba(255,255,255,0.5);
          font-size: 12px; font-weight: 500; cursor: pointer; transition: color 0.15s ease;
        }
        .info-back-btn:hover { color: rgba(255,255,255,0.85); }
        .info-back-btn svg { width: 14px; height: 14px; fill: currentColor; flex-shrink: 0; }

        /* ─── Remote toggle button — controls bar, left side, mirrors vol-pct on right ─── */
        .remote-toggle-btn {
          display: none;
          width: 28px; height: 28px; border-radius: 50% !important;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.16) !important;
          cursor: pointer; align-items: center; justify-content: center;
          flex-shrink: 0; transition: all 0.2s ease; padding: 0;
        }
        .remote-toggle-btn svg { width: 15px; height: 15px; fill: rgba(255,255,255,0.78); transition: fill 0.2s ease; }
        .remote-toggle-btn:active, .remote-toggle-btn.pressed { background: rgba(255,255,255,0.18); transform: scale(0.9); }
        .remote-btn-active { background: rgba(255,255,255,0.2) !important; border-color: rgba(255,255,255,0.45) !important; }
        .remote-btn-active svg { fill: #fff !important; }
        /* Remote btn: expanded Apple TV only */
        #cardOuter:not(.mode-compact):not(.no-remote):not(.ma-entity) .remote-toggle-btn {
          display: flex !important;
          position: absolute;
          left: 0;
          top: calc(50% - 14px);
        }
        /* Remote btn: compact Apple TV only */
        #cardOuter.mode-compact:not(.no-remote):not(.ma-entity) .remote-toggle-btn {
          display: flex !important;
          position: absolute;
          left: 10px;
          top: calc(50% - 14px);
        }

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
        .r-power-btn.r-power-on { background: rgba(255,59,48,0.18); border-color: rgba(255,59,48,0.4) !important; }
        .r-power-btn.r-power-on svg { fill: rgba(255,90,80,0.95); }
        .r-power-btn.r-power-on:active, .r-power-btn.r-power-on.pressed { background: rgba(255,59,48,0.28); box-shadow: 0 0 12px rgba(255,59,48,0.25); }

        .r-apps-btn.r-apps-open { background: rgba(255,255,255,0.18); border-color: rgba(255,255,255,0.3) !important; }

        .r-apps-dropdown {
          position: absolute;
          top: 52px;
          left: 16px;
          right: 16px;
          background: rgba(36,36,40,0.98);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: 14px;
          z-index: 10;
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(0,0,0,0.55);
          max-height: 220px;
          overflow-y: auto;
        }
        .r-apps-dropdown.hidden { display: none; }
        .r-apps-dropdown::-webkit-scrollbar { width: 3px; }
        .r-apps-dropdown::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }
        .r-app-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 11px 16px;
          font-size: 14px;
          color: rgba(255,255,255,0.88);
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
          cursor: pointer;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          transition: background 0.1s ease;
        }
        .r-app-item:last-child { border-bottom: none; }
        .r-app-item:active, .r-app-item:hover { background: rgba(255,255,255,0.08); }
        .r-app-item svg { width: 16px; height: 16px; fill: rgba(255,255,255,0.45); flex-shrink: 0; }
        .r-app-item.r-app-active { color: #007AFF; }
        .r-app-item.r-app-active svg { fill: #007AFF; }

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

        <!-- Absolute resize btn (top-right, all modes) -->
        <button class="size-toggle-abs" id="modeBtnAbs">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
            <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
          </svg>
        </button>

        <div class="art-wrapper" id="artClick">
          <img id="albumImg">
          <div id="mainPlaceholder" class="placeholder-svg" style="pointer-events:none"></div>

          <!-- MA library browse — hidden, replaced by controls-bar button -->
          <button class="ma-art-btn" id="btnMABrowse" title="Music Assistant Library">
            <svg viewBox="0 0 24 24"><path d="M12,3V13.55C11.41,13.21 10.73,13 10,13C7.79,13 6,14.79 6,17C6,19.21 7.79,21 10,21C12.21,21 14,19.21 14,17V7H18V3H12Z"/></svg>
          </button>

          <!-- Remote overlay — fills art area when active -->
          <div class="remote-overlay hidden" id="remoteOverlay">
            <div class="remote-panel">

              <!-- Row 1: Back + Home + Apps + Power -->
              <div class="r-top-row">
                <button class="r-pill-btn" id="rMenu">
                  <svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
                  Back
                </button>
                <button class="r-pill-btn" id="rHome">
                  <svg viewBox="0 0 24 24"><path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/></svg>
                  TV
                </button>
                <button class="r-pill-btn r-apps-btn" id="rApps">
                  <svg viewBox="0 0 24 24"><path d="M4,4H10V10H4V4M14,4H20V10H14V4M4,14H10V20H4V14M14,14H20V20H14V14M16,16V18H18V16H16M6,6V8H8V6H6M6,16V18H8V16H6M16,6V8H18V6H16Z"/></svg>
                  Apps
                </button>
                <button class="r-pill-btn r-power-btn" id="rPower">
                  <svg viewBox="0 0 24 24"><path d="M16.56,5.44L15.11,6.89C16.84,7.94 18,9.83 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12C6,9.83 7.16,7.94 8.88,6.88L7.44,5.44C5.36,6.88 4,9.28 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12C20,9.28 18.64,6.88 16.56,5.44M13,3H11V13H13V3Z"/></svg>
                  Power
                </button>
              </div>

              <!-- Apps dropdown — shown below top row when Apps is tapped -->
              <div class="r-apps-dropdown hidden" id="rAppsDropdown"></div>

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
            <div style="flex:1; overflow:hidden;" id="trackInfo">
              <div class="track-title" id="tTitle">Loading...</div>
              <div class="track-artist" id="tArtist"></div>
            </div>
          </div>
          <div class="progress-bar" id="progWrap"><div class="progress-fill" id="progFill"></div></div>
          <div class="progress-times"><span id="pCur">0:00</span><span id="pTot">0:00</span></div>
          <div class="controls">
            <!-- Remote btn — both modes, Apple TV only, absolutely positioned left to mirror vol-pct -->
            <button class="remote-toggle-btn" id="remoteBtn" title="Remote Control">
              <svg viewBox="0 0 24 24"><path d="M17 5H7a5 5 0 0 0-5 5v4a5 5 0 0 0 5 5h10a5 5 0 0 0 5-5v-4a5 5 0 0 0-5-5zm-8 9H7v-2h2v2zm0-4H7V8h2v2zm4 6h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V6h2v2zm4 8h-2v-6h2v6z"/></svg>
            </button>
            <!-- MA library browse btn — both modes, MA entities only, absolutely positioned left -->
            <button class="ma-ctrl-btn" id="btnMABrowseControls" title="Music Assistant Library">
              <svg viewBox="0 0 24 24"><path d="M12,3V13.55C11.41,13.21 10.73,13 10,13C7.79,13 6,14.79 6,17C6,19.21 7.79,21 10,21C12.21,21 14,19.21 14,17V7H18V3H12Z"/></svg>
            </button>
            <!-- Speaker selector — icon button with native select overlaid on top -->
            <div class="speaker-btn-wrap" id="speakerBtnWrap">
              <button class="extra-btn speaker-btn" id="btnSpeaker" title="Select Speaker">
                <svg viewBox="0 0 24 24"><path d="M1,10V12A9,9 0 0,1 10,21H12C12,14.92 7.08,10 1,10M1,14V16A5,5 0 0,1 6,21H8A7,7 0 0,0 1,14M1,18V21H4A3,3 0 0,0 1,18M21,3H3C1.89,3 1,3.89 1,5V8H3V5H21V19H14V21H21A2,2 0 0,0 23,19V5C23,3.89 22.1,3 21,3Z"/></svg>
              </button>
              <select class="selector" id="eSelector" style="position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;"></select>
            </div>
            <button class="vol-btn" id="btnVolDown">
              <svg viewBox="0 0 24 24"><path d="M19 13H5v-2h14v2z"/></svg>
            </button>
            <button class="extra-btn" id="btnShuffle"><svg viewBox="0 0 24 24"><path d="M14.83,13.41L13.42,14.82L16.55,17.95L14.5,20H20V14.5L17.96,16.54L14.83,13.41M14.5,4H20V9.5L17.96,7.46L5.41,20L4,18.59L16.54,6.04L14.5,4M10.59,9.17L5.41,4L4,5.41L9.17,10.58L10.59,9.17Z"/></svg></button>
            <button class="nav-btn" id="btnPrev"><svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg></button>
            <button class="play-btn" id="btnPlay"><svg viewBox="0 0 24 24" id="playIcon"></svg></button>
            <button class="nav-btn" id="btnNext"><svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg></button>
            <button class="extra-btn" id="btnRepeat"><svg viewBox="0 0 24 24" id="repeatIcon"></svg></button>
            <button class="vol-btn" id="btnVolUp">
              <svg viewBox="0 0 24 24"><path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/></svg>
            </button>
            <span class="vol-pct" id="volPct"></span>
          </div>
          <!-- Volume row — full width below controls -->
          <div class="vol-row">
            <svg class="vol-icon" id="volMuteBtn" viewBox="0 0 24 24"></svg>
            <input type="range" class="volume-slider" id="vSlider" min="0" max="100">
          </div>
          <!-- Hidden select retained for JS entity-change compatibility -->

        </div>

        <!-- ─── Music Assistant Library Popup ─── -->
        <div class="ma-popup" id="maPopup">
          <div class="ma-header">
            <span class="ma-title">Music Library</span>
            <button class="ma-close" id="maClose">
              <svg viewBox="0 0 24 24"><path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/></svg>
            </button>
          </div>
          <!-- MA Search -->
          <div class="ma-search-row">
            <input class="ma-search-input" id="maSearchInput" type="text" placeholder="Search library…">
            <button class="ma-search-btn" id="maSearchBtn">Search</button>
          </div>
          <div class="ma-tabs" id="maTabs">
            <button class="ma-tab active" data-tab="playlist">Playlists</button>
            <button class="ma-tab" data-tab="artist">Artists</button>
            <button class="ma-tab" data-tab="album">Albums</button>
            <button class="ma-tab" data-tab="track">Songs</button>
            <button class="ma-tab" data-tab="radio">Radio</button>
            <button class="ma-tab" data-tab="favourites">Favourites</button>
          </div>
          <div class="ma-content" id="maContent">
            <div class="ma-loading">Loading</div>
          </div>
        </div>

        <!-- ─── Media Info Popup ─── -->
        <div class="info-popup" id="infoPopup">
          <div class="info-popup-header">
            <span class="info-popup-title" id="infoPopupTitle">Media Info</span>
            <button class="info-popup-close" id="infoClose">
              <svg viewBox="0 0 24 24"><path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/></svg>
            </button>
          </div>
          <div class="info-popup-content" id="infoContent">
            <div class="info-loading">Loading</div>
          </div>
          <!-- ─── Track play confirm overlay ─── -->
          <div class="track-confirm" id="trackConfirm">
            <button class="track-confirm-close" id="trackConfirmClose">
              <svg viewBox="0 0 24 24"><path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/></svg>
            </button>
            <div class="track-confirm-icon">
              <svg viewBox="0 0 24 24"><path d="M12,3V13.55C11.41,13.21 10.73,13 10,13C7.79,13 6,14.79 6,17C6,19.21 7.79,21 10,21C12.21,21 14,19.21 14,17V7H18V3H12Z"/></svg>
            </div>
            <div class="track-confirm-label">Play via Music Assistant</div>
            <div class="track-confirm-title" id="trackConfirmTitle"></div>
            <div class="track-confirm-artist" id="trackConfirmArtist"></div>
            <div class="track-confirm-speaker">
              <svg viewBox="0 0 24 24"><path d="M17,2H7A2,2 0 0,0 5,4V20A2,2 0 0,0 7,22H17A2,2 0 0,0 19,20V4A2,2 0 0,0 17,2M12,19A2,2 0 0,1 10,17A2,2 0 0,1 12,15A2,2 0 0,1 14,17A2,2 0 0,1 12,19M15,9H9V4H15V9Z"/></svg>
              <span class="track-confirm-speaker-name" id="trackConfirmSpeaker"></span>
            </div>
            <div id="trackConfirmBody">
              <div class="track-confirm-btns">
                <button class="track-confirm-cancel" id="trackConfirmCancel">Cancel</button>
                <button class="track-confirm-play" id="trackConfirmPlay">
                  <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  Play
                </button>
              </div>
            </div>
          </div>
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

    const toggleMode = () => r.getElementById('cardOuter').classList.toggle('mode-compact');
    r.getElementById('modeBtnAbs').onclick = toggleMode;

    const _hasArt = () => {
      const pic = this._hass?.states[this._entity]?.attributes?.entity_picture;
      if (!pic) return false;
      // For MA entities only show artwork (and open info popup) when actively playing
      if (_isMaEntity() && this._hass?.states[this._entity]?.state !== 'playing') return false;
      return true;
    };
    const _isMaEntity = () => {
      if (this._knownMaEntities?.has(this._entity)) return true;
      const state = this._hass?.states[this._entity];
      if (!state) return false;
      const attrs = state.attributes;
      const isMaByRegistry = this._maEntityIds !== null && this._maEntityIds.has(this._entity);
      const isMaByAttrs = 'mass_player_id' in attrs || 'mass_is_group' in attrs || 'mass_queue_index' in attrs || (attrs.platform && String(attrs.platform).toLowerCase().includes('music_assistant'));
      const isMaByEntityId = (this._entity || '').startsWith('media_player.mass_');
      const maEntities = Array.isArray(this._config.ma_entities) ? this._config.ma_entities : [];
      return isMaByRegistry || isMaByAttrs || isMaByEntityId || maEntities.includes(this._entity);
    };
    // Long press on art area → HA more-info; tap → existing behaviour
    const artEl = r.getElementById('artClick');
    let _artLongPressTimer = null;
    let _artLongPressed = false;
    const artLongPressStart = (e) => {
      _artLongPressed = false;
      _artLongPressTimer = setTimeout(() => {
        _artLongPressed = true;
        this.dispatchEvent(new Event('ll-custom', { bubbles: true, composed: true }));
        this.dispatchEvent(new CustomEvent('hass-more-info', {
          detail: { entityId: this._entity },
          bubbles: true, composed: true,
        }));
      }, 500);
    };
    const artLongPressEnd = () => clearTimeout(_artLongPressTimer);
    artEl.addEventListener('contextmenu', (e) => e.preventDefault());
    artEl.addEventListener('pointerdown', artLongPressStart);
    artEl.addEventListener('pointerup',   artLongPressEnd);
    artEl.addEventListener('pointercancel', artLongPressEnd);
    artEl.addEventListener('pointermove', artLongPressEnd);
    artEl.onclick = () => {
      if (_artLongPressed) { _artLongPressed = false; return; }
      if (this._remoteMode) return;
      if (_hasArt()) {
        this._openInfoPopup();
      } else if (_isMaEntity()) {
        this._openMABrowser();
      }
    };
    r.getElementById('miniArtClick').onclick = () => {
      if (!_hasArt()) return;
      const card = r.getElementById('cardOuter');
      if (card.classList.contains('mode-compact')) {
        card.classList.remove('mode-compact');
        setTimeout(() => this._openInfoPopup(), 320);
      } else {
        this._openInfoPopup();
      }
    };

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

    ['btnPlay','btnPrev','btnNext','btnShuffle','btnRepeat','modeBtnAbs'].forEach(id => addPressEffect(r.getElementById(id)));

    const sendVolCmd = (direction) => {
      const volEnt = this._volEntity;
      const state  = this._hass.states[volEnt];
      // Use volume_up/down services — remote.send_command maps incorrectly on
      // Apple TV + HomePod group (causes mute instead of volume change).
      this._hass.callService('media_player', direction > 0 ? 'volume_up' : 'volume_down', { entity_id: volEnt });

      // Optimistic UI update — HA won't push a new volume_level for Apple TV /
      // HomePod groups, so we maintain our own estimate and update the display now.
      const entityVol  = state?.attributes?.volume_level ?? null;
      const STEP       = 0.05; // HA default volume_up/down step
      // Seed from: last tracked → entity attribute → 50% default.
      // Using 0.5 as default means the first button press always produces a
      // visible percentage (55% on vol-up, 45% on vol-down) rather than staying at —.
      const knownLevel = this._lastVolume !== null
        ? this._lastVolume
        : (entityVol !== null ? entityVol : 0.5);

      {
        const newLevel = Math.min(1, Math.max(0, knownLevel + direction * STEP));
        this._lastVolume = newLevel;
        this._lastSliderInput = Date.now(); // suppress state-update from overwriting
        const root = this.shadowRoot;
        const sliderEl = root?.getElementById('vSlider');
        const volPctEl = root?.getElementById('volPct');
        if (sliderEl) sliderEl.value = newLevel * 100;
        if (volPctEl && !this._softMuteMap[volEnt]) volPctEl.textContent = Math.round(newLevel * 100) + '%';
      }
    };
    r.getElementById('btnVolUp').onclick   = () => sendVolCmd(1);
    r.getElementById('btnVolDown').onclick = () => sendVolCmd(-1);
    addPressEffect(r.getElementById('btnVolUp'));
    addPressEffect(r.getElementById('btnVolDown'));

    const slider = r.getElementById('vSlider');
    const volMuteBtn = r.getElementById('volMuteBtn');
    if (volMuteBtn) {
      volMuteBtn.onclick = () => this._toggleMute();
      addPressEffect(volMuteBtn);
    }

    slider.oninput = (e) => {
      const newLevel = parseFloat(e.target.value) / 100;
      const volPct = r.getElementById('volPct');
      if (volPct) volPct.textContent = Math.round(newLevel * 100) + '%';
      const volEnt = this._volEntity;
      const isMainEntity = volEnt === this._entity;
      const remoteEntityId = isMainEntity ? this._entity.replace('media_player.', 'remote.') : null;
      const hasRemote = remoteEntityId && !!this._hass.states[remoteEntityId];

      if (hasRemote) {
        const prev = this._lastVolume !== null
          ? this._lastVolume
          : (this._hass.states[this._entity]?.attributes?.volume_level ?? 0.5);
        const delta = newLevel - prev;

        if (Math.abs(delta) > 0.008) {
          const cmd = delta > 0 ? 'volume_up' : 'volume_down';
          const now = Date.now();
          if (!this._volLastFired || (now - this._volLastFired) >= 380) {
            if (this._volDebounce) { clearTimeout(this._volDebounce); this._volDebounce = null; }
            this._hass.callService('remote', 'send_command', {
              entity_id: remoteEntityId, command: cmd
            }).catch(() => {});
            this._volLastFired = now;
          } else {
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
        this._lastSliderInput = Date.now();
        const sliderState = this._hass.states[volEnt];
        if ((sliderState?.attributes?.supported_features ?? 0) & 4) {
          this._hass.callService('media_player', 'volume_set', { entity_id: volEnt, volume_level: newLevel });
        }
        this._lastVolume = newLevel;
      }
    };
    r.getElementById('eSelector').onchange = (e) => {
      this._entity = e.target.value;
      this._manualSelection = true;
      if (this._config.remember_last_entity && !this._config.auto_switch) {
        localStorage.setItem('atv_last_entity_' + (this._config.entities[0] || ''), this._entity);
      }
      this._lastVolume = null;
      this._historySeeding = false;
      this._startupVolApplied = false;
      this._lastSliderInput = 0;
      this._volLastFired = null;
      this._maRootCache = null;
      if (this._volDebounce) { clearTimeout(this._volDebounce); this._volDebounce = null; }
      if (this._remoteMode) this._toggleRemote();
      this.updateContent(this._hass.states[this._entity]);
    };
    r.getElementById('progWrap').onclick = (e) => this.doSeek(e);

    const remoteBtn = r.getElementById('remoteBtn');
    remoteBtn.onclick = (e) => {
      e.stopPropagation();
      const card = r.getElementById('cardOuter');
      if (card.classList.contains('mode-compact')) {
        // Expand first, then open remote on next frame
        card.classList.remove('mode-compact');
        if (!this._remoteMode) {
          requestAnimationFrame(() => this._toggleRemote());
        }
      } else {
        this._toggleRemote();
      }
    };
    addPressEffect(remoteBtn);

    r.getElementById('remoteOverlay').onclick = (e) => e.stopPropagation();

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

    const rAppsBtn      = r.getElementById('rApps');
    const rAppsDropdown = r.getElementById('rAppsDropdown');

    const closeApps = () => {
      rAppsDropdown.classList.add('hidden');
      rAppsBtn.classList.remove('r-apps-open');
    };

    const openApps = () => {
      const state      = this._hass.states[this._entity];
      const sources    = state?.attributes?.source_list || [];
      const current    = state?.attributes?.source || '';
      if (!sources.length) {
        rAppsDropdown.innerHTML = `<div class="r-app-item" style="color:rgba(255,255,255,0.4);cursor:default;">No apps available</div>`;
      } else {
        rAppsDropdown.innerHTML = sources.map(src => `
          <div class="r-app-item ${src === current ? 'r-app-active' : ''}" data-src="${src}">
            <svg viewBox="0 0 24 24"><path d="M8,5.14V19.14L19,12.14L8,5.14Z"/></svg>
            ${src}
          </div>`).join('');
        rAppsDropdown.querySelectorAll('.r-app-item[data-src]').forEach(item => {
          item.onclick = (e) => {
            e.stopPropagation();
            this.call('select_source', { source: item.dataset.src });
            closeApps();
          };
        });
      }
      rAppsDropdown.classList.remove('hidden');
      rAppsBtn.classList.add('r-apps-open');
    };

    rAppsBtn.onclick = (e) => {
      e.stopPropagation();
      rAppsDropdown.classList.contains('hidden') ? openApps() : closeApps();
    };
    addPressEffect(rAppsBtn);

    r.getElementById('remoteOverlay').addEventListener('click', (e) => {
      if (!rAppsBtn.contains(e.target) && !rAppsDropdown.contains(e.target)) closeApps();
    });

    // ── Music Assistant ──
    r.getElementById('btnMABrowse').onclick = (e) => {
      e.stopPropagation();
      const card = r.getElementById('cardOuter');
      if (card.classList.contains('mode-compact')) {
        card.classList.remove('mode-compact');
        requestAnimationFrame(() => this._openMABrowser());
      } else {
        this._openMABrowser();
      }
    };
    const speakerBtn = r.getElementById('btnSpeaker');
    addPressEffect(speakerBtn);

        r.getElementById('btnMABrowseControls').onclick = (e) => {
      e.stopPropagation();
      const card = r.getElementById('cardOuter');
      if (card.classList.contains('mode-compact')) {
        card.classList.remove('mode-compact');
        requestAnimationFrame(() => this._openMABrowser());
      } else {
        this._openMABrowser();
      }
    };
    addPressEffect(r.getElementById('btnMABrowseControls'));
    r.getElementById('maClose').onclick     = () => this._closeMABrowser();

    const maSearchInput = r.getElementById('maSearchInput');
    const maSearchBtn   = r.getElementById('maSearchBtn');
    maSearchBtn.onclick = () => this._searchMA(maSearchInput.value.trim());
    maSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._searchMA(maSearchInput.value.trim());
    });
    addPressEffect(r.getElementById('btnMABrowse'));

    r.querySelectorAll('.ma-tab').forEach(tab => {
      tab.onclick = () => {
        r.querySelectorAll('.ma-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this._loadMATab(tab.dataset.tab);
      };
    });

    // Close MA popup on backdrop click (outside grid)
    r.getElementById('maPopup').addEventListener('click', (e) => {
      if (e.target === r.getElementById('maPopup')) this._closeMABrowser();
    });

    // ── Info Button ──
    r.getElementById('infoClose').onclick = () => this._closeInfoPopup();
    r.getElementById('infoPopup').addEventListener('click', (e) => {
      if (e.target === r.getElementById('infoPopup')) this._closeInfoPopup();
    });

    // ── Track Confirm Overlay ──
    r.getElementById('trackConfirmClose').onclick  = () => this._hideTrackConfirm();
    r.getElementById('trackConfirmCancel').onclick = () => this._hideTrackConfirm();
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

  // Fetch entity registry once and build a Set of all MA-managed media_player entity_ids.
  // Uses WebSocket API (reliable in all modern HA versions).
  // Falls back to entity_id name pattern: MA always registers players as media_player.mass_*
  async _loadMAEntityRegistry() {
    if (this._maEntityIds !== null) return; // already loaded or in-flight
    this._maEntityIds = new Set(); // set immediately to block concurrent calls
    try {
      const result = await this._hass.connection.sendMessagePromise({
        type: 'config/entity_registry/list'
      });
      const entities = Array.isArray(result) ? result : (result && result.result ? result.result : []);
      entities.forEach(e => {
        if (e.platform === 'music_assistant' && e.entity_id && e.entity_id.startsWith('media_player.')) {
          this._maEntityIds.add(e.entity_id);
        }
      });
    } catch (err) {
      console.warn('[ATV] Registry fetch failed, using name-pattern fallback:', err);
      // MA always registers its media_player entities as media_player.mass_*
      if (this._hass && this._hass.states) {
        Object.keys(this._hass.states).forEach(eid => {
          if (eid.startsWith('media_player.mass_')) this._maEntityIds.add(eid);
        });
      }
    }
    // Re-run updateContent so the card reflects the correct MA state immediately
    const stateObj = this._hass && this._hass.states[this._entity];
    if (stateObj) this.updateContent(stateObj);
  }

  updateContent(state) {
    const r = this.shadowRoot;
    if (!state || !r) return;
    const isPlaying = state.state === 'playing';
    r.host.style.setProperty('--accent',     this._config.accent_color);
    r.host.style.setProperty('--vol-accent', this._config.volume_accent || this._config.accent_color);
    r.host.style.setProperty('--btn-color',  this._config.button_color  || '#ffffff');
    r.host.style.setProperty('--vol-pct-color', this._config.vol_pct_color || 'rgba(255,255,255,0.45)');
    const bgHex = this._config.player_bg || '#1c1c1e';
    const isTransparent = bgHex === '#000000';
    const hexToRgba = (hex) => {
      if (hex === '#000000') return 'transparent';
      const h = hex.replace('#','');
      if (h.length === 8) {
        const r = parseInt(h.substring(0,2),16);
        const g = parseInt(h.substring(2,4),16);
        const b = parseInt(h.substring(4,6),16);
        const a = parseInt(h.substring(6,8),16) / 255;
        return `rgba(${r},${g},${b},${a.toFixed(3)})`;
      }
      const bgOpacity = (this._config.player_bg_opacity != null ? this._config.player_bg_opacity : 100) / 100;
      const r = parseInt(h.substring(0,2),16);
      const g = parseInt(h.substring(2,4),16);
      const b = parseInt(h.substring(4,6),16);
      return `rgba(${r},${g},${b},${bgOpacity})`;
    };
    const resolvedBg = hexToRgba(bgHex);
    r.host.style.setProperty('--atv-card-bg', resolvedBg);
    r.host.style.setProperty('--player-bg', resolvedBg);
    r.host.style.setProperty('--atv-card-border',
      isTransparent ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(255,255,255,0.18)');

    const titleEl  = r.getElementById('tTitle');
    const artistEl = r.getElementById('tArtist');
    titleEl.style.color  = this._config.title_color  || '#ffffff';
    artistEl.style.color = this._config.artist_color || 'rgba(255,255,255,0.7)';
    this._applyScrollText(titleEl,  state.attributes.media_title  || (isPlaying ? 'Music' : 'Idle'));
    this._applyScrollText(artistEl, state.attributes.media_artist || state.attributes.friendly_name || '');

    r.getElementById('cardOuter').classList.toggle('vol-btn-mode', this._config.volume_control === 'buttons');

    const cardOuter = r.getElementById('cardOuter');
    if (this._config.show_entity_selector === false) {
      cardOuter.classList.add('hide-selector');
    } else {
      cardOuter.classList.remove('hide-selector');
    }

    // ── Music Assistant detection ──
    // Primary: entity registry lookup — reliable even when player is idle/off.
    // MA drops attributes like mass_player_id when not playing, so attribute-sniffing alone
    // fails for idle speakers. The registry always knows which platform owns an entity.
    // Fallback: live state attributes cover the window before the async registry call returns.
    // Legacy: ma_entities config list for backward-compat with old saved configs.
    if (this._maEntityIds === null) {
      this._loadMAEntityRegistry(); // async — will call updateContent again once loaded
    }
    const attrs = state.attributes;
    const isMaByRegistry = this._maEntityIds !== null && this._maEntityIds.has(this._entity);
    const isMaByAttrs = (
      'mass_player_id' in attrs ||
      'mass_is_group' in attrs  ||
      'mass_queue_index' in attrs ||
      (attrs.platform && String(attrs.platform).toLowerCase().includes('music_assistant'))
    );
    const isMaByEntityId = (this._entity || '').startsWith('media_player.mass_');
    const maEntities = Array.isArray(this._config.ma_entities) ? this._config.ma_entities : [];
    // Persist MA detection per entity — MA drops its attributes when paused/idle so we
    // remember any entity we've ever positively identified as MA to avoid false negatives.
    if (!this._knownMaEntities) this._knownMaEntities = new Set();
    if (isMaByRegistry || isMaByAttrs || isMaByEntityId || maEntities.includes(this._entity)) {
      this._knownMaEntities.add(this._entity);
    }
    const isMa = this._knownMaEntities.has(this._entity);
    r.getElementById('cardOuter').classList.toggle('ma-entity', isMa);

    // ── Remote button visibility — show only for Apple TVs ──
    // The apple_tv integration sets device_class='tv' for Apple TVs.
    // All other devices (HomePods, Alexa, Sonos, Chromecast, etc.) should not show the remote.
    // Fallback: entity_id or friendly_name containing 'apple_tv' or 'appletv'.
    const isAppleTV = (
      attrs.device_class === 'tv' ||
      (this._entity && (this._entity.toLowerCase().includes('apple_tv') || this._entity.toLowerCase().includes('appletv'))) ||
      (attrs.friendly_name && (attrs.friendly_name.toLowerCase().includes('apple tv') || attrs.friendly_name.toLowerCase().includes('appletv')))
    );
    cardOuter.classList.toggle('no-remote', !isAppleTV);
    if (!isAppleTV && this._remoteMode) this._toggleRemote();

    // ── Startup volume — applied once per card load or entity switch ──
    // Applies to all player types (MA, Apple TV, Alexa, etc.) — either a
    // Apply per-entity startup volume — only when the user has explicitly set one.
    if (!this._startupVolApplied && isPlaying) {
      this._startupVolApplied = true;
      const overrides = this._config.entity_startup_volumes || {};
      const perEntity = overrides[this._entity];
      if (perEntity != null) {
        this._applyDefaultVolume(this._volEntity, perEntity / 100);
      }
    }

    r.getElementById('btnShuffle').classList.toggle('active', isPlaying && state.attributes.shuffle === true);
    const rep = state.attributes.repeat;
    r.getElementById('btnRepeat').classList.toggle('active', isPlaying && rep !== undefined && rep !== 'off');

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

    if (artUrl) {
      miniImg.onerror = () => {
        miniImg.classList.add('hidden');
        miniPh.innerHTML = this.getDeviceIcon(state).replace('width="120" height="120"', 'width="24" height="24"');
        miniPh.classList.remove('hidden');
      };
      miniImg.src = artUrl;
      miniImg.classList.remove('hidden');
      miniPh.classList.add('hidden');
    } else {
      miniImg.classList.add('hidden');
      miniPh.innerHTML = this.getDeviceIcon(state).replace('width="120" height="120"', 'width="24" height="24"');
      miniPh.classList.remove('hidden');
    }

    if (!this._remoteMode) {
      const isMaForArt = r.getElementById('cardOuter').classList.contains('ma-entity');
      if (artUrl && (isPlaying || !isMaForArt)) {
        mainImg.onerror = () => {
          mainImg.classList.add('hidden');
          mainPh.innerHTML = this.getDeviceIcon(state);
          mainPh.classList.remove('hidden');
        };
        mainImg.src = artUrl;
        mainImg.classList.remove('hidden');
        mainPh.classList.add('hidden');
        r.getElementById('artClick').style.cursor = 'pointer';
      } else {
        mainImg.classList.add('hidden');
        if (isMaForArt) {
          mainPh.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;gap:14px;opacity:0.55">
              ${this.getDeviceIcon(state)}
              <div style="display:flex;align-items:center;gap:6px;font-size:12px;color:rgba(255,255,255,0.7);font-weight:500;letter-spacing:0.2px">
                <svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:currentColor;flex-shrink:0"><path d="M12,3V13.55C11.41,13.21 10.73,13 10,13C7.79,13 6,14.79 6,17C6,19.21 7.79,21 10,21C12.21,21 14,19.21 14,17V7H18V3H12Z"/></svg>
                Browse library
              </div>
            </div>`;
          r.getElementById('artClick').style.cursor = 'pointer';
        } else {
          mainPh.innerHTML = this.getDeviceIcon(state);
          r.getElementById('artClick').style.cursor = 'default';
        }
        mainPh.classList.remove('hidden');
      }
    }

    r.getElementById('playIcon').innerHTML = isPlaying
      ? '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>'
      : '<path d="M8 5v14l11-7z"/>';
    const volState = this._hass?.states[this._volEntity];
    // Resolve volume level — keep as null if the entity doesn't report it (e.g. Apple TV
    // routed to a HomePod group: HA can't read back the group's volume, so the attribute
    // is null/undefined rather than genuinely 0).
    const rawVolLevel = volState?.attributes?.volume_level ?? state.attributes.volume_level ?? null;
    const volKnown  = rawVolLevel !== null && rawVolLevel !== undefined;
    // When the entity doesn't report a volume (e.g. Apple TV + HomePod group) and we
    // don't yet have a tracked value, seed from HA history once so the display shows
    // the level last set by an automation/scene instead of showing —.
    if (!volKnown && this._lastVolume === null && !this._historySeeding) {
      this._historySeeding = true; // prevent multiple concurrent fetches
      const seedEnt = this._volEntity;
      this._seedVolumeFromHistory(seedEnt).finally(() => {
        // Allow re-seed if entity changes
        if (this._volEntity === seedEnt) this._historySeeding = false;
      });
    }
    // Prefer entity-reported level; fall back to our optimistic _lastVolume so the
    // display persists after + / - button presses even when HA can't read volume back.
    const volLevel  = volKnown ? rawVolLevel : (this._lastVolume ?? 0);
    const volDisplayKnown = volKnown || this._lastVolume !== null;
    const hasNativeMuteAttr = 'is_volume_muted' in (volState?.attributes ?? {});
    const nativeMuteSupported = hasNativeMuteAttr && !this._isAppleTVEntity(this._entity);
    const isMuted = nativeMuteSupported
      ? (volState?.attributes?.is_volume_muted ?? false)
      : (this._softMuteMap[this._volEntity] ?? false);
    const recentSliderInput = (Date.now() - this._lastSliderInput) < 3000;
    if (!recentSliderInput) {
      // Update slider only when we have a real value; don't snap to 0 on Apple TV + HomePod.
      if (volDisplayKnown) r.getElementById('vSlider').value = volLevel * 100;
    }
    const volPct = r.getElementById('volPct');
    if (volPct) {
      if (isMuted) {
        volPct.innerHTML = `<svg viewBox="0 0 24 24"><path d="M16.5 12A4.5 4.5 0 0 0 14 7.97V10.18L16.45 12.63C16.48 12.43 16.5 12.22 16.5 12M19 12C19 12.94 18.8 13.82 18.46 14.64L19.97 16.15C20.63 14.91 21 13.5 21 12C21 7.72 18.01 4.14 14 3.23V5.29C16.89 6.15 19 8.83 19 12M4.27 3L3 4.27L7.73 9H3V15H7L12 20V13.27L16.25 17.52C15.58 18.04 14.83 18.45 14 18.7V20.76C15.38 20.45 16.63 19.82 17.68 18.96L19.73 21L21 19.73L12 10.73M12 4L9.91 6.09L12 8.18V4Z"/></svg>`;
      } else if (!recentSliderInput) {
        volPct.textContent = volDisplayKnown ? Math.round(volLevel * 100) + '%' : '—';
      }
      volPct.onclick = () => this._toggleMute();
    }
    cardOuter.classList.toggle('show-vol-pct', this._config.show_vol_pct !== false);
    cardOuter.classList.toggle('scroll-text', this._config.scroll_text === true);
    r.getElementById('pTot').textContent = this.formatTime(state.attributes.media_duration || 0);

    const showSel = this._config.show_entity_selector !== false;
    r.getElementById('cardOuter').classList.toggle('hide-selector', !showSel);
    const speakerBtn = r.getElementById('btnSpeaker');
    const sel = r.getElementById('eSelector');
    const entities = this._config.entities || [];
    const speakerWrap = r.getElementById('speakerBtnWrap');
    if (speakerWrap) speakerWrap.style.display = (!showSel || entities.length < 2) ? 'none' : '';
    if (sel && showSel) {
      sel.innerHTML = entities.map(ent => {
        const s = this._hass.states[ent];
        return `<option value="${ent}" ${ent === this._entity ? 'selected' : ''}>${s?.attributes?.friendly_name || ent}</option>`;
      }).join('');
    }
  }

  _applyScrollText(el, text) {
    if (!el) return;
    const scrollOn = this._config.scroll_text === true;
    if (el._marqueeText === text && el._marqueeScroll === scrollOn) return;
    el._marqueeText = text;
    el._marqueeScroll = scrollOn;
    el.innerHTML = '';
    if (!scrollOn) { el.textContent = text; return; }
    // Set plain text first, then after layout check if it actually overflows
    el.textContent = text;
    requestAnimationFrame(() => {
      // If the element is gone or text changed, abort
      if (el._marqueeText !== text) return;
      const overflows = el.scrollWidth > el.clientWidth;
      if (!overflows) return; // text fits — leave as plain text
      // Build seamless duplicate: [text · · · text · · ·] animates by 50%
      const dur = Math.max(8, text.length * 0.3);
      el.innerHTML = '';
      const wrap = document.createElement('div');
      wrap.className = 'marquee-wrap';
      wrap.style.setProperty('--marquee-dur', dur + 's');
      for (let i = 0; i < 2; i++) {
        const s = document.createElement('span');
        s.textContent = text;
        wrap.appendChild(s);
      }
      el.appendChild(wrap);
    });
  }

  // Query HA history for the last recorded volume_level of the given entity.
  // Called once on first load when the entity doesn't report a current volume
  // (e.g. Apple TV routed to HomePod group). Seeds _lastVolume so the display
  // shows the correct level that was set by an automation, scene, or manual action.
  async _seedVolumeFromHistory(entityId) {
    try {
      const end   = new Date();
      const start = new Date(end.getTime() - 24 * 60 * 60 * 1000); // last 24 hours
      const url   = `history/period/${start.toISOString()}?filter_entity_id=${encodeURIComponent(entityId)}&end_time=${encodeURIComponent(end.toISOString())}&minimal_response=true&no_attributes=false`;
      const resp  = await this._hass.callApi('GET', url);
      // callApi returns parsed JSON; history is an array of arrays (one per entity)
      const series = Array.isArray(resp) ? resp[0] : null;
      if (!series || !series.length) return;

      // Walk backwards to find the most recent state with a volume_level
      for (let i = series.length - 1; i >= 0; i--) {
        const vol = series[i]?.attributes?.volume_level;
        if (vol !== null && vol !== undefined) {
          this._lastVolume = vol;
          // Update UI immediately
          const root = this.shadowRoot;
          const sliderEl = root?.getElementById('vSlider');
          const volPctEl = root?.getElementById('volPct');
          if (sliderEl) sliderEl.value = vol * 100;
          if (volPctEl && !this._softMuteMap[entityId]) {
            volPctEl.textContent = Math.round(vol * 100) + '%';
          }
          break;
        }
      }
    } catch (_) {
      // History API unavailable or insufficient permissions — fail silently
    }
  }

  // Set volume to a default level and update the card UI immediately.
  _applyDefaultVolume(entityId, level) {
    // SUPPORT_VOLUME_SET = bit 4 in HA supported_features bitmask.
    // Skip the call if unsupported to avoid "unknown error" on Apple TV etc.
    const state = this._hass?.states[entityId];
    const features = state?.attributes?.supported_features ?? 0;
    if (features & 4) {
      this._hass.callService('media_player', 'volume_set', {
        entity_id: entityId,
        volume_level: level
      });
    }
    // Always update UI optimistically so the display stays correct.
    this._lastVolume      = level;
    this._lastSliderInput = Date.now();
    const root    = this.shadowRoot;
    const slider  = root?.getElementById('vSlider');
    const volPct  = root?.getElementById('volPct');
    if (slider) slider.value = level * 100;
    if (volPct && !this._softMuteMap[entityId]) {
      volPct.textContent = Math.round(level * 100) + '%';
    }
  }

  _isAppleTVEntity(entityId) {
    const state = this._hass?.states[entityId];
    if (!state) return false;
    return state.attributes?.device_class === 'tv' ||
      entityId.toLowerCase().includes('apple_tv') ||
      entityId.toLowerCase().includes('appletv') ||
      (state.attributes?.friendly_name?.toLowerCase() || '').includes('apple tv');
  }

  _toggleMute() {
    const volEnt   = this._volEntity;
    const entState = this._hass?.states[volEnt];
    if (!entState) return;

    // Use same Apple TV detection as the slider: does a remote.* entity exist?
    const remoteEntityId = (volEnt === this._entity)
      ? this._entity.replace('media_player.', 'remote.') : null;
    const isAppleTV = !!(remoteEntityId && this._hass.states[remoteEntityId]);

    // Native mute: entity has is_volume_muted attribute AND is not Apple TV
    const hasNativeMute = ('is_volume_muted' in (entState.attributes ?? {})) && !isAppleTV;

    if (hasNativeMute) {
      // Alexa, Sonos, Chromecast — use HA mute service
      const currentlyMuted = entState.attributes.is_volume_muted ?? false;
      this._hass.callService('media_player', 'volume_mute', {
        entity_id: volEnt,
        is_volume_muted: !currentlyMuted
      });
    } else {
      // Soft-mute: Apple TV, HomePod, MA speakers/groups
      const softMuted = this._softMuteMap[volEnt] ?? false;
      if (!softMuted) {
        const sliderVol = this._lastVolume;
        const entityVol = entState.attributes?.volume_level ?? 0;
        const saveVol   = (sliderVol != null && sliderVol > 0) ? sliderVol
                        : (entityVol > 0)                      ? entityVol
                        : (this._preMuteMap[volEnt] ?? 0.5);
        this._preMuteMap[volEnt]  = saveVol;
        this._softMuteMap[volEnt] = true;
        if ((this._hass.states[volEnt]?.attributes?.supported_features ?? 0) & 4) {
          this._hass.callService('media_player', 'volume_set', { entity_id: volEnt, volume_level: 0 });
        }
      } else {
        this._softMuteMap[volEnt] = false;
        if ((this._hass.states[volEnt]?.attributes?.supported_features ?? 0) & 4) {
          this._hass.callService('media_player', 'volume_set', {
            entity_id: volEnt,
            volume_level: this._preMuteMap[volEnt] ?? 0.5
          });
        }
      }
    }
  }

  formatTime(s) {
    if (!s || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60), rs = Math.floor(s % 60);
    return `${m}:${rs < 10 ? '0' : ''}${rs}`;
  }

  // ══════════════════════════════════════════════
  //  MUSIC ASSISTANT
  // ══════════════════════════════════════════════

  _openMABrowser() {
    const r = this.shadowRoot;
    const popup = r.getElementById('maPopup');
    popup.classList.add('visible');
    const searchInput = r.getElementById('maSearchInput');
    if (searchInput) searchInput.value = '';
    this._maCurrentTab = 'playlist';
    r.querySelectorAll('.ma-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'playlist'));
    this._loadMATab('playlist');
  }

  async _searchMA(query) {
    if (!query) return;
    const content = this.shadowRoot.getElementById('maContent');
    content.innerHTML = '<div class="ma-loading">Searching</div>';
    // Deactivate tabs to show we're in search mode
    this.shadowRoot.querySelectorAll('.ma-tab').forEach(t => t.classList.remove('active'));

    const configEntryId = await this._getMAConfigEntryId();
    if (!configEntryId) {
      content.innerHTML = '<div class="ma-error">Music Assistant not found.</div>';
      return;
    }
    try {
      const msg = {
        type: 'call_service',
        domain: 'music_assistant',
        service: 'search',
        service_data: { config_entry_id: configEntryId, name: query, limit: 40 },
        return_response: true
      };
      const res = await this._hass.connection.sendMessagePromise(msg);
      const response = res && res.response;
      // Response is grouped by type: { tracks: [...], albums: [...], ... }
      const allItems = [];
      if (response && typeof response === 'object') {
        Object.entries(response).forEach(function(entry) {
          var mediaType = entry[0];
          var items = entry[1];
          if (Array.isArray(items)) {
            items.forEach(function(item) {
              item._tab = mediaType; // store type for play
              allItems.push(item);
            });
          }
        });
      }
      if (!allItems.length) {
        content.innerHTML = '<div class="ma-empty">No results for “' + query + '”</div>';
        return;
      }
      this._renderMAGrid(allItems, 'track', content);
    } catch(e) {
      console.error('[MA] search error:', e);
      content.innerHTML = '<div class="ma-error">Search failed.<br><small style="opacity:0.6">' + (e && e.message ? e.message : String(e)) + '</small></div>';
    }
  }

  _closeMABrowser() {
    this.shadowRoot.getElementById('maPopup').classList.remove('visible');
  }

  // ══════════════════════════════════════════════
  //  MEDIA INFO POPUP
  // ══════════════════════════════════════════════

  _openInfoPopup() {
    const r = this.shadowRoot;
    const popup = r.getElementById('infoPopup');
    popup.classList.add('visible');
    const state = this._hass?.states[this._entity];
    if (!state || state.state !== 'playing') {
      r.getElementById('infoContent').innerHTML = '<div class="info-error">Nothing is currently playing.</div>';
      return;
    }
    const type = this._detectMediaType(state);
    const attrs = state.attributes;

    if (type === 'music') {
      r.getElementById('infoPopupTitle').textContent = 'Album Info';
      this._fetchMusicInfo(attrs.media_artist || '', attrs.media_album_name || '', attrs.media_title || '', attrs.entity_picture || '');
    } else {
      // For all video content, pass the raw title and let _fetchVideoInfo
      // search both TV and movie on TMDB and pick the best match automatically.
      r.getElementById('infoPopupTitle').textContent = 'Media Info';
      const rawTitle = attrs.media_series_title || attrs.media_title || '';
      this._fetchVideoInfo(rawTitle);
    }
  }

  _closeInfoPopup() {
    this.shadowRoot.getElementById('infoPopup').classList.remove('visible');
    this._hideTrackConfirm();
  }

  _showTrackConfirm(trackTitle, artistName) {
    const r = this.shadowRoot;
    const overlay = r.getElementById('trackConfirm');
    if (!overlay) return;

    // Populate fields
    r.getElementById('trackConfirmTitle').textContent  = trackTitle;
    r.getElementById('trackConfirmArtist').textContent = artistName || '';

    const speakerName = this._hass?.states[this._entity]?.attributes?.friendly_name || this._entity;
    r.getElementById('trackConfirmSpeaker').textContent = speakerName;

    // Reset body to buttons
    r.getElementById('trackConfirmBody').innerHTML = `
      <div class="track-confirm-btns">
        <button class="track-confirm-cancel" id="trackConfirmCancel">Cancel</button>
        <button class="track-confirm-play" id="trackConfirmPlay">
          <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          Play
        </button>
      </div>`;
    r.getElementById('trackConfirmCancel').onclick = () => this._hideTrackConfirm();
    r.getElementById('trackConfirmPlay').onclick   = () => this._searchAndPlayTrackViaMA(trackTitle, artistName);

    overlay.classList.add('visible');
  }

  _hideTrackConfirm() {
    const overlay = this.shadowRoot.getElementById('trackConfirm');
    if (overlay) overlay.classList.remove('visible');
  }

  async _searchAndPlayTrackViaMA(trackTitle, artistName) {
    const r = this.shadowRoot;
    const body = r.getElementById('trackConfirmBody');
    if (!body) return;

    // Show searching state
    body.innerHTML = `<div class="track-confirm-searching">Searching Music Assistant…</div>`;

    const configEntryId = await this._getMAConfigEntryId();
    if (!configEntryId) {
      body.innerHTML = `<div class="track-confirm-result error">Music Assistant not found.<br>Check your integration is installed.</div>
        <div class="track-confirm-btns" style="margin-top:14px">
          <button class="track-confirm-cancel" id="trackConfirmCancel">Close</button>
        </div>`;
      r.getElementById('trackConfirmCancel').onclick = () => this._hideTrackConfirm();
      return;
    }

    try {
      const query = artistName ? `${trackTitle} ${artistName}` : trackTitle;
      const msg = {
        type: 'call_service',
        domain: 'music_assistant',
        service: 'search',
        service_data: { config_entry_id: configEntryId, name: query, media_type: 'track', limit: 10 },
        return_response: true
      };
      const res = await this._hass.connection.sendMessagePromise(msg);
      const response = res?.response || {};

      // Extract tracks from response (could be flat array or grouped object)
      let tracks = [];
      if (Array.isArray(response)) {
        tracks = response;
      } else if (Array.isArray(response.tracks)) {
        tracks = response.tracks;
      } else {
        // Search all keys for track-like items
        Object.values(response).forEach(v => {
          if (Array.isArray(v)) tracks.push(...v);
        });
      }

      // Score results: prefer exact or close title + artist match
      const norm = s => (s || '').toLowerCase().replace(/[''`]/g, "'").trim();
      const normTitle  = norm(trackTitle);
      const normArtist = norm(artistName);

      const scored = tracks.map(t => {
        const tTitle  = norm(t.name || t.title || '');
        const tArtist = norm((t.artists && t.artists[0]?.name) || (t.artist?.name) || '');
        let score = 0;
        if (tTitle === normTitle) score += 4;
        else if (tTitle.includes(normTitle) || normTitle.includes(tTitle)) score += 2;
        if (normArtist && tArtist) {
          if (tArtist === normArtist) score += 3;
          else if (tArtist.includes(normArtist) || normArtist.includes(tArtist)) score += 1;
        }
        return { t, score };
      }).sort((a, b) => b.score - a.score);

      const best = scored[0]?.t;

      if (!best) {
        body.innerHTML = `<div class="track-confirm-result error" style="margin-bottom:14px">
            "${trackTitle}" wasn't found in Music Assistant.<br>
            <span style="font-size:11px;opacity:0.7">It may not be available in your connected sources.</span>
          </div>
          <div class="track-confirm-btns">
            <button class="track-confirm-cancel" id="trackConfirmCancel">Close</button>
          </div>`;
        r.getElementById('trackConfirmCancel').onclick = () => this._hideTrackConfirm();
        return;
      }

      // Play the matched track
      const uri = best.uri || best.media_content_id;
      await this._hass.callService('music_assistant', 'play_media', {
        entity_id: this._entity,
        media_id: uri,
        media_type: 'track',
        enqueue: 'replace'
      });

      body.innerHTML = `<div class="track-confirm-result success" style="margin-bottom:14px">
          ✓ Playing now
        </div>
        <div class="track-confirm-btns">
          <button class="track-confirm-cancel" id="trackConfirmDone">Done</button>
        </div>`;
      r.getElementById('trackConfirmDone').onclick = () => {
        this._hideTrackConfirm();
        this._closeInfoPopup();
      };
    } catch (err) {
      console.error('[MA] track play error:', err);
      body.innerHTML = `<div class="track-confirm-result error" style="margin-bottom:14px">
          Something went wrong.<br>
          <span style="font-size:11px;opacity:0.7">${err?.message || String(err)}</span>
        </div>
        <div class="track-confirm-btns">
          <button class="track-confirm-cancel" id="trackConfirmCancel">Close</button>
        </div>`;
      r.getElementById('trackConfirmCancel').onclick = () => this._hideTrackConfirm();
    }
  }

  _detectMediaType(state) {
    const attrs = state?.attributes || {};
    const ct = (attrs.media_content_type || '').toLowerCase();

    // Config override — user explicitly chose tv or movie lookup
    const override = this._config?.video_lookup || 'auto';
    if (override === 'tv')    return 'tv';
    if (override === 'movie') return 'movie';

    const rawTitle = attrs.media_title || '';

    // "Series: Name - Episode Title" is a strong TV signal — check BEFORE content type
    // because some players (Plex etc.) tag TV movies like "Star Trek: Voyager - Dark Frontier"
    // with media_content_type = 'movie'.
    if (rawTitle.includes(' - ') && rawTitle.includes(':')) return 'tv';

    // Explicit content type
    if (ct === 'music' || ct === 'track') return 'music';
    if (ct === 'movie') return 'movie';
    if (ct === 'tvshow' || ct === 'episode' || ct === 'season') return 'tv';

    // Apple TV generic 'video' — disambiguate by attributes
    if (ct === 'video') {
      if (attrs.media_series_title || attrs.media_season != null || attrs.media_episode != null) return 'tv';
      return 'movie';
    }

    // Check all TV signals BEFORE music — streaming apps (Netflix, Prime, Disney+)
    // often set media_artist to the show/network name which would falsely trigger music
    if (attrs.media_series_title) return 'tv';
    if (attrs.media_season != null || attrs.media_episode != null) return 'tv';

    // Scan all available text fields for TV episode patterns.
    const allText = [rawTitle, attrs.media_album_name || ''].join(' ').toLowerCase();
    if (/season\s*\d|ep(isode|\.)?\s*\d|s\d{1,2}\s*[ex:]\s*e?\d|s\d{2}e\d{2}/.test(allText)) return 'tv';

    // Only return music if there are genuine music-specific attributes
    if (attrs.media_album_name) return 'music';

    return 'movie';
  }

  async _fetchMusicInfo(artist, album, trackTitle, entityPicture) {
    const content = this.shadowRoot.getElementById('infoContent');
    content.innerHTML = '<div class="info-loading">Looking up album</div>';

    if (!artist && !album && !trackTitle) {
      content.innerHTML = '<div class="info-error">No artist or track information available.</div>';
      return;
    }

    // Strip common suffixes that confuse Discogs:
    // "(2009 Remastered Version)", "(Remastered)", "[Live]", "(Deluxe Edition)" etc.
    const clean = (s) => (s || '')
      .replace(/\s*[\(\[]\s*(\d{4}\s*)?(remaster(ed)?|re-?master(ed)?|live|deluxe|edition|version|anniversary|bonus|extended|explicit|radio edit|single)[^\)\]]*[\)\]]/gi, '')
      .replace(/\s*-\s*(\d{4}\s*)?(remaster(ed)?|live( version)?|single( version)?)$/gi, '')
      .trim();

    let cleanArtist = clean(artist);
    const cleanAlbum  = clean(album);
    let cleanTrack  = clean(trackTitle);

    // Some sources (e.g. certain Music Assistant providers) return the combined
    // "Track Title - Artist Name" string in media_title with no separate artist.
    // If artist is missing and track contains " - ", try to parse artist out of it.
    if (!cleanArtist && cleanTrack.includes(' - ')) {
      const parts = cleanTrack.split(' - ');
      // Artist is usually the LAST segment e.g. "Safe and Sound - Shinedown"
      const possibleArtist = parts[parts.length - 1].trim();
      const possibleTrack  = parts.slice(0, parts.length - 1).join(' - ').trim();
      if (possibleArtist && possibleTrack) {
        cleanArtist = possibleArtist;
        cleanTrack  = possibleTrack;
      }
    }

    // Normalise for loose comparison: lowercase, strip all non-alphanumeric chars
    const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    // Detect cover/tribute/karaoke releases — these should never win when we know the artist
    const isCoverRelease = (result) => {
      const full = (result.title || '').toLowerCase();
      return /\b(cover|covers|tribute|tributes|karaoke|as made famous|in the style of)\b/.test(full);
    };

    // Extract every artist-like string from a result:
    // Discogs search stubs include a `title` formatted as "Artist - Release",
    // plus sometimes an `artist` array of objects with a `name` property.
    // We check both so that "Skunk Anansie - Paranoid & Sunburnt" and
    // [{name:"Skunk Anansie"}] both resolve correctly.
    const resultArtists = (result) => {
      const fromTitle = (result.title || '').split(' - ')[0];
      const fromArr   = Array.isArray(result.artist)
        ? result.artist.map(a => (typeof a === 'string' ? a : a?.name || '')).filter(Boolean)
        : [];
      return [fromTitle, ...fromArr];
    };

    // Score a Discogs result against our known artist.
    // Returns:
    //   4 = exact match in artist array field
    //   3 = exact match in title prefix
    //   2 = substring match in any artist source
    //   1 = no artist to compare (neutral)
    //   0 = no match found
    //  -5 = cover/tribute release
    const scoreResult = (result) => {
      if (isCoverRelease(result)) return -5;

      const a = norm(cleanArtist);
      if (!a) return 1;

      const artists = resultArtists(result);
      const normed  = artists.map(norm);

      // Exact match in the dedicated artist array gets highest priority
      if (Array.isArray(result.artist) && result.artist.length) {
        const arrNormed = result.artist.map(x => norm(typeof x === 'string' ? x : x?.name || ''));
        if (arrNormed.includes(a)) return 4;
        if (arrNormed.some(ra => ra.includes(a) || a.includes(ra))) return 3;
      }

      // Exact match in title prefix
      const titleArtist = norm(artists[0]);
      if (titleArtist === a) return 3;

      // Substring match anywhere
      if (normed.some(ra => ra.includes(a) || a.includes(ra))) return 2;

      return 0;
    };

    // Popularity bonus: releases with more community engagement are more likely to be
    // the canonical original release rather than an obscure pressing or bootleg.
    // `community_have` is the most reliably present count in search stubs.
    const popularityBonus = (result) => {
      const have = result.community?.have ?? 0;
      if (have > 5000) return 0.9;
      if (have > 1000) return 0.6;
      if (have > 200)  return 0.3;
      return 0;
    };

    // Return best-scoring result.
    // requireMatch=true:  reject if best score <= 0 (wrong artist or cover).
    // requireMatch=false: if we have a known artist, still reject score-0 results —
    //                     it is better to show "no results" than the wrong artist.
    const bestResult = (results, requireMatch = false) => {
      if (!results?.length) return null;
      const scored = results
        .map(r => ({ r, s: scoreResult(r) + popularityBonus(r) }))
        .sort((a, b) => b.s - a.s);
      const best = scored[0];
      // Always reject cover/tribute releases
      if (best.s < 0) return null;
      // Reject anything that couldn't match the artist, whether or not requireMatch
      if (cleanArtist && best.s < 1) return null;
      if (requireMatch && best.s <= 0) return null;
      return best.r;
    };

    const headers = { 'User-Agent': 'AtvMediaRemote/1.0' };

    // Cache results by artist+album+track so re-opening the same panel makes no extra API calls
    if (!this._discogsCache) this._discogsCache = new Map();
    const cacheKey = `${cleanArtist}|${cleanAlbum}|${cleanTrack}`;
    if (this._discogsCache.has(cacheKey)) {
      const cached = this._discogsCache.get(cacheKey);
      if (cached.type === 'info') {
        this._renderMusicInfo(content, cached.result, artist, trackTitle || album, entityPicture);
      } else if (cached.type === 'picker') {
        this._renderDiscogsPicker(content, cached.items, artist, trackTitle || album, entityPicture, headers);
      } else {
        content.innerHTML = cached.html;
      }
      return;
    }

    // Wrapper that checks for 429 rate-limit responses
    const discogsGet = async (url) => {
      const resp = await fetch(url, { headers });
      if (resp.status === 429) throw new Error('Rate limited — please wait a moment and try again');
      return resp;
    };

    // Collect unique candidates across all strategies into a pool, scored.
    // Deduplication by release ID so the same pressing doesn't appear twice.
    const seen   = new Set();
    const pool   = [];
    const addToPool = (results) => {
      for (const r of (results || [])) {
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        const s = scoreResult(r) + popularityBonus(r);
        if (s > 0) pool.push({ r, s });
      }
    };

    try {
      // Strategy 1: artist + album
      if (cleanArtist && cleanAlbum) {
        const resp = await discogsGet(
          `https://api.discogs.com/database/search?artist=${encodeURIComponent(cleanArtist)}&release_title=${encodeURIComponent(cleanAlbum)}&type=release&per_page=15`
        );
        if (resp.ok) addToPool((await resp.json()).results);
      }

      // Strategy 2: artist + track
      if (cleanArtist && cleanTrack && norm(cleanTrack) !== norm(cleanAlbum)) {
        const resp = await discogsGet(
          `https://api.discogs.com/database/search?artist=${encodeURIComponent(cleanArtist)}&track=${encodeURIComponent(cleanTrack)}&type=release&per_page=15`
        );
        if (resp.ok) addToPool((await resp.json()).results);
      }

      // Strategy 3: artist only
      if (cleanArtist && pool.length === 0) {
        const resp = await discogsGet(
          `https://api.discogs.com/database/search?artist=${encodeURIComponent(cleanArtist)}&type=release&per_page=15`
        );
        if (resp.ok) addToPool((await resp.json()).results);
      }

      // Strategy 4: artist + broader title search
      if (cleanArtist && (cleanAlbum || cleanTrack) && pool.length === 0) {
        const title = cleanAlbum || cleanTrack;
        const resp = await discogsGet(
          `https://api.discogs.com/database/search?artist=${encodeURIComponent(cleanArtist)}&release_title=${encodeURIComponent(title)}&type=release&per_page=25`
        );
        if (resp.ok) addToPool((await resp.json()).results);
      }

      // Strategy 5: track only — when artist is unknown
      if (!cleanArtist && cleanTrack && pool.length === 0) {
        const resp = await discogsGet(
          `https://api.discogs.com/database/search?track=${encodeURIComponent(cleanTrack)}&type=release&per_page=15`
        );
        if (resp.ok) addToPool((await resp.json()).results);
      }

      // Fallback: free-text search combining all available info — useful for radio
      // where structured searches fail due to slightly-off metadata.
      // Results go into a picker rather than auto-selecting to avoid wrong matches.
      if (!pool.length) {
        const q = [cleanArtist, cleanAlbum || cleanTrack].filter(Boolean).join(' ');
        if (q) {
          const resp = await discogsGet(
            `https://api.discogs.com/database/search?q=${encodeURIComponent(q)}&type=release&per_page=10`
          );
          if (resp.ok) {
            const data = await resp.json();
            const fallbackItems = (data.results || [])
              .filter(r => !isCoverRelease(r))
              .slice(0, 6)
              .map(r => ({ r, s: scoreResult(r) + popularityBonus(r) }));
            if (fallbackItems.length) {
              this._discogsCache.set(cacheKey, { type: 'picker', items: fallbackItems });
              this._renderDiscogsPicker(content, fallbackItems, artist, trackTitle || album, entityPicture, headers);
              return;
            }
          }
        }
        const display = [cleanArtist, cleanAlbum || cleanTrack].filter(Boolean).join(' — ');
        const noResultsHtml = `<div class="info-error">No results found on Discogs for "${display}".</div>`;
        this._discogsCache.set(cacheKey, { type: 'html', html: noResultsHtml });
        content.innerHTML = noResultsHtml;
        return;
      }

      // Sort pool by score descending
      pool.sort((a, b) => b.s - a.s);
      const best = pool[0];

      // High-confidence auto-select: top result has a clear artist match (score >= 3)
      // AND is comfortably ahead of the second result.
      // Low confidence: show a picker so the user can choose.
      const confident = best.s >= 3 && (pool.length === 1 || best.s - pool[1].s >= 1);

      if (!confident && pool.length > 1) {
        this._discogsCache.set(cacheKey, { type: 'picker', items: pool.slice(0, 6) });
        this._renderDiscogsPicker(content, pool.slice(0, 6), artist, trackTitle || album, entityPicture, headers);
        return;
      }

      const result = best.r;

      // Render a first pass immediately
      this._renderMusicInfo(content, result, artist, trackTitle || album, entityPicture);

      // Fetch full release for tracklist + community rating
      if (result.id) {
        const resourceUrl = result.resource_url || `https://api.discogs.com/releases/${result.id}`;
        fetch(resourceUrl, { headers })
          .then(r => r.json())
          .then(full => {
            const merged = { ...result };
            const tracks = (full.tracklist || []).filter(t => !t.type_ || t.type_ === 'track' || t.type_ === 'index');
            if (tracks.length) merged.tracklist = tracks;
            if (full.community) merged.community = full.community;
            this._discogsCache.set(cacheKey, { type: 'info', result: merged });
            this._renderMusicInfo(content, merged, artist, trackTitle || album, entityPicture);
          })
          .catch(() => {
            // Full release failed — cache the stub so at least we don't re-fetch strategies
            this._discogsCache.set(cacheKey, { type: 'info', result });
          });
      } else {
        this._discogsCache.set(cacheKey, { type: 'info', result });
      }

    } catch (err) {
      content.innerHTML = `<div class="info-error">Failed to load Discogs info.<br><small style="opacity:0.6">${err.message}</small></div>`;
    }
  }

  _injectBackButton(content, onBack) {
    const btn = document.createElement('button');
    btn.className = 'info-back-btn';
    btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg> Back';
    btn.addEventListener('click', onBack);
    content.insertBefore(btn, content.firstChild);
  }

  _renderDiscogsPicker(content, candidates, artist, album, entityPicture, headers) {
    if (!this._discogsArtCache) this._discogsArtCache = new Map();

    const makePlaceholder = (idx) => {
      const d = document.createElement('div');
      d.className = 'dp-art';
      if (idx !== undefined) d.dataset.idx = idx;
      d.style.cssText = 'width:56px;height:56px;border-radius:6px;background:rgba(255,255,255,0.06);flex-shrink:0;display:flex;align-items:center;justify-content:center';
      d.innerHTML = '<svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:rgba(255,255,255,0.2)"><path d="M12,3A9,9 0 0,0 3,12A9,9 0 0,0 12,21A9,9 0 0,0 21,12A9,9 0 0,0 21,12A9,9 0 0,0 12,3M12,5A7,7 0 0,1 19,12A7,7 0 0,1 12,19A7,7 0 0,1 5,12A7,7 0 0,1 12,5M12,7A5,5 0 0,0 7,12A5,5 0 0,0 12,17A5,5 0 0,0 17,12A5,5 0 0,0 12,7M12,9A3,3 0 0,1 15,12A3,3 0 0,1 12,15A3,3 0 0,1 9,12A3,3 0 0,1 12,9Z"/></svg>';
      return d;
    };

    const itemsHtml = candidates.map((item, i) => {
      const r    = item.r;
      const parts = (r.title || '').split(' - ');
      const releaseArtist = parts[0] || '';
      const releaseTitle  = parts.slice(1).join(' - ') || r.title || '';
      const year    = r.year || '';
      const formats = (r.format || []).slice(0, 2).join(', ');
      const label   = (r.label && r.label[0]) ? r.label[0] : '';
      const thumb   = r.thumb || r.cover_image || (r.id && this._discogsArtCache.get(r.id)) || '';
      // img tag uses a data-idx placeholder src; real src set below to avoid onerror HTML escaping issues
      const imgHtml = thumb
        ? `<img class="dp-art" data-idx="${i}" data-src="${thumb}" alt="" style="width:56px;height:56px;object-fit:cover;border-radius:6px;flex-shrink:0">`
        : `<span class="dp-art-placeholder" data-idx="${i}"></span>`;
      const meta = [year, formats, label].filter(Boolean).join(' · ');
      return `<div class="discogs-pick-item" data-idx="${i}"
          style="display:flex;align-items:center;gap:12px;padding:10px 8px;border-radius:10px;cursor:pointer;transition:background 0.15s ease;border-bottom:1px solid rgba(255,255,255,0.05)">
          ${imgHtml}
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${releaseTitle || r.title}</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${releaseArtist}</div>
            ${meta ? `<div style="font-size:10px;color:rgba(255,255,255,0.3);margin-top:2px">${meta}</div>` : ''}
          </div>
          <svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:rgba(255,255,255,0.25);flex-shrink:0"><path d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z"/></svg>
        </div>`;
    }).join('');

    content.innerHTML = `
      <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.35);letter-spacing:0.6px;text-transform:uppercase;margin-bottom:8px">Which release?</div>
      <div>${itemsHtml}</div>`;

    // Replace span placeholders with real placeholder divs
    content.querySelectorAll('.dp-art-placeholder').forEach(span => {
      span.replaceWith(makePlaceholder(span.dataset.idx));
    });

    // Wire up img src and onerror via JS (avoids HTML attribute escaping issues)
    content.querySelectorAll('img.dp-art[data-src]').forEach(img => {
      img.onerror = () => img.replaceWith(makePlaceholder(img.dataset.idx));
      img.src = img.dataset.src;
    });

    // Lazy-load artwork for items that had no thumb in the search stub
    candidates.forEach((item, i) => {
      if (item.r.thumb || item.r.cover_image || (item.r.id && this._discogsArtCache.has(item.r.id))) return;
      const url = item.r.resource_url || (item.r.id ? `https://api.discogs.com/releases/${item.r.id}` : null);
      if (!url) return;
      fetch(url, { headers })
        .then(r => r.ok ? r.json() : null)
        .then(full => {
          if (!full) return;
          const imgUrl = full.images?.[0]?.uri || full.images?.[0]?.resource_url || '';
          if (!imgUrl) return;
          if (item.r.id) this._discogsArtCache.set(item.r.id, imgUrl);
          const el = content.querySelector(`.dp-art[data-idx="${i}"]`);
          if (!el) return;
          const img = document.createElement('img');
          img.className = 'dp-art';
          img.dataset.idx = String(i);
          img.src = imgUrl;
          img.alt = '';
          img.style.cssText = 'width:56px;height:56px;object-fit:cover;border-radius:6px;flex-shrink:0';
          img.onerror = () => img.replaceWith(makePlaceholder(i));
          el.replaceWith(img);
        })
        .catch(() => {});
    });

    content.querySelectorAll('.discogs-pick-item').forEach(el => {
      el.addEventListener('mouseenter', () => el.style.background = 'rgba(255,255,255,0.06)');
      el.addEventListener('mouseleave', () => el.style.background = '');
      el.addEventListener('click', () => {
        const result = candidates[parseInt(el.dataset.idx)].r;
        let abortController = null;
        const goBack = () => {
          if (abortController) abortController.abort();
          this._renderDiscogsPicker(content, candidates, artist, album, entityPicture, headers);
        };
        if (!this._discogsReleaseCache) this._discogsReleaseCache = new Map();
        // If we already fetched the full release, render immediately with tracks
        if (result.id && this._discogsReleaseCache.has(result.id)) {
          const merged = this._discogsReleaseCache.get(result.id);
          this._renderMusicInfo(content, merged, artist, album, entityPicture);
          this._injectBackButton(content, goBack);
          return;
        }
        this._renderMusicInfo(content, result, artist, album, entityPicture);
        this._injectBackButton(content, goBack);
        // Fetch full release details and re-render with merged data
        if (result.id) {
          abortController = new AbortController();
          const resourceUrl = result.resource_url || `https://api.discogs.com/releases/${result.id}`;
          fetch(resourceUrl, { headers, signal: abortController.signal })
            .then(r => {
              if (r.status === 429) throw new Error('rate_limited');
              if (!r.ok) throw new Error('fetch_failed');
              return r.json();
            })
            .then(full => {
              const merged = { ...result };
              // Filter out heading entries (Side A / Side B markers) — keep only actual tracks
              const tracks = (full.tracklist || []).filter(t => !t.type_ || t.type_ === 'track' || t.type_ === 'index');
              if (tracks.length) merged.tracklist = tracks;
              if (full.community) merged.community = full.community;
              this._discogsReleaseCache.set(result.id, merged);
              this._renderMusicInfo(content, merged, artist, album, entityPicture);
              this._injectBackButton(content, goBack);
            })
            .catch(err => {
              if (err.name === 'AbortError') return;
              // Show a small inline error below the album info rather than silently failing
              const existingBack = content.querySelector('.info-back-btn');
              const notice = document.createElement('div');
              notice.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.35);margin-top:8px;padding:0 2px';
              notice.textContent = err.message === 'rate_limited'
                ? 'Tracklist unavailable — Discogs rate limit reached. Try again in a moment.'
                : 'Tracklist unavailable — could not load full release details.';
              if (existingBack) existingBack.insertAdjacentElement('afterend', notice);
              else content.appendChild(notice);
            });
        }
      });
    });
  }

  _renderMusicInfo(content, result, artist, album, entityPicture) {
    // Use the artwork already loaded in the media player — no auth needed
    const artUrl     = entityPicture || '';
    const title      = result.title || `${artist} — ${album}`;
    const year       = result.year || '';
    const label      = (result.label && result.label[0]) ? result.label[0] : '';
    const genres     = [...(result.genre || []), ...(result.style || [])].slice(0, 5);
    const country    = result.country || '';
    const discogsUrl = result.uri ? `https://www.discogs.com${result.uri}` : '';
    const tracklist  = result.tracklist || [];

    // Discogs community rating — present on full release objects
    const rating      = result.community?.rating?.average;
    const ratingCount = result.community?.rating?.count;

    const state = this._hass?.states[this._entity];
    const currentTrack = state?.attributes?.media_title || '';

    // Check if MA is available for clickable tracks
    const isMaEntity = this._maEntityIds && this._maEntityIds.has(this._entity);

    const artHtml = artUrl && discogsUrl
      ? `<a href="${discogsUrl}" target="_blank" rel="noopener" style="display:block;cursor:pointer;opacity:1;transition:opacity 0.15s ease" onmouseover="this.style.opacity='0.75'" onmouseout="this.style.opacity='1'" onmousedown="this.style.opacity='0.55'" onmouseup="this.style.opacity='0.75'"><img src="${artUrl}" alt="" style="display:block;width:100%;height:100%;object-fit:cover" onerror="this.parentElement.style.display='none';this.parentElement.nextElementSibling.style.display='flex'"></a>`
      : artUrl
        ? `<img src="${artUrl}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
        : '';
    const artFallback = `<svg viewBox="0 0 24 24" style="${artUrl ? 'display:none' : ''}"><path d="M12,3V13.55C11.41,13.21 10.73,13 10,13C7.79,13 6,14.79 6,17C6,19.21 7.79,21 10,21C12.21,21 14,19.21 14,17V7H18V3H12Z"/></svg>`;

    const tagsHtml = genres.map(g => `<span class="info-tag">${g}</span>`).join('');
    const metaItems = [year, label, country].filter(Boolean);

    // Render filled/half/empty stars for a rating out of 5
    const ratingHtml = rating
      ? (() => {
          const avg        = parseFloat(rating);
          const formatted  = avg.toFixed(2);
          const countLabel = ratingCount ? ratingCount.toLocaleString() + ' ratings' : '';
          // Build 5 SVG stars with precise fill percentage per star
          const starsHtml = Array.from({ length: 5 }, (_, i) => {
            const fill = Math.min(1, Math.max(0, avg - i)); // 0–1 fill for this star
            const pct  = Math.round(fill * 100);
            const id   = `dsg-star-${i}-${Math.random().toString(36).slice(2,6)}`;
            return `<svg viewBox="0 0 24 24" width="13" height="13" style="flex-shrink:0">
              <defs>
                <linearGradient id="${id}" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="${pct}%" stop-color="#FFD60A"/>
                  <stop offset="${pct}%" stop-color="rgba(255,255,255,0.18)"/>
                </linearGradient>
              </defs>
              <path fill="url(#${id})" d="M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z"/>
            </svg>`;
          }).join('');
          return `<div class="info-rating" style="margin-top:5px;gap:4px;flex-wrap:wrap">
            <div style="display:flex;align-items:center;gap:2px">${starsHtml}</div>
            <span class="info-rating-val" style="font-size:12px">${formatted}</span>
            ${countLabel ? `<span class="info-rating-count">(${countLabel})</span>` : ''}
          </div>`;
        })()
      : '';

    const maHintHtml = isMaEntity && tracklist.length
      ? `<div style="font-size:10px;color:rgba(255,255,255,0.25);margin-bottom:4px;letter-spacing:0.2px">Tap a track to play via Music Assistant</div>`
      : '';

    const tracklistHtml = tracklist.length
      ? `<div class="info-section-label">Tracklist</div>
         ${maHintHtml}
         <div class="info-tracklist">
           ${tracklist.map((t, i) => {
             // Use normalised comparison: strip punctuation/case/brackets so that
             // "Safe and Sound" matches "Safe And Sound (Remastered)" etc.
             const normStr = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
             const isPlaying = currentTrack && t.title &&
               (normStr(t.title) === normStr(currentTrack) ||
                normStr(currentTrack).includes(normStr(t.title)) ||
                normStr(t.title).includes(normStr(currentTrack)));
             const maClass = isMaEntity ? ' ma-clickable' : '';
             const playHint = isMaEntity
               ? `<span class="info-track-play-hint"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>`
               : '';
             // Only link to Discogs for non-MA entities — MA tracks are clickable for playback instead
             const trackUrl = (!isMaEntity && discogsUrl) ? `${discogsUrl}#track-${i + 1}` : '';
             const inner = `<span class="info-track-num">${t.position || (i + 1)}</span>
               <span class="info-track-title">${t.title || ''}</span>
               ${playHint}
               ${t.duration ? `<span class="info-track-dur">${t.duration}</span>` : ''}`;
             return trackUrl
               ? `<a class="info-track${isPlaying ? ' playing' : ''}" href="${trackUrl}" target="_blank" rel="noopener" data-track-title="${(t.title || '').replace(/"/g, '&quot;')}" data-track-artist="${artist.replace(/"/g, '&quot;')}" style="text-decoration:none">${inner}</a>`
               : `<div class="info-track${isPlaying ? ' playing' : ''}${maClass}" data-track-title="${(t.title || '').replace(/"/g, '&quot;')}" data-track-artist="${artist.replace(/"/g, '&quot;')}">${inner}</div>`;
           }).join('')}
         </div>`
      : '';

    const linkHtml = discogsUrl
      ? `<a class="info-ext-link" href="${discogsUrl}" target="_blank" rel="noopener">
           <svg viewBox="0 0 24 24"><path d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z"/></svg>
           View on Discogs
         </a>`
      : '';

    content.innerHTML = `
      <div class="info-hero">
        <div class="info-hero-art">${artHtml}${artFallback}</div>
        <div class="info-hero-meta">
          <div class="info-hero-title">${title}</div>
          ${metaItems.length ? `<div class="info-hero-sub">${metaItems.join(' · ')}</div>` : ''}
          ${ratingHtml}
          ${tagsHtml ? `<div class="info-hero-tags">${tagsHtml}</div>` : ''}
        </div>
      </div>
      ${tracklistHtml}
      ${linkHtml}
    `;

    // Wire up clickable track rows if MA is available
    if (isMaEntity) {
      content.querySelectorAll('.info-track.ma-clickable').forEach(row => {
        row.addEventListener('click', () => {
          const trackTitle  = row.dataset.trackTitle;
          const trackArtist = row.dataset.trackArtist;
          if (trackTitle) this._showTrackConfirm(trackTitle, trackArtist || artist);
        });
      });
    }
  }

  async _fetchVideoInfo(title) {
    const content = this.shadowRoot.getElementById('infoContent');
    const tmdbKey = this._config.tmdb_api_key || '';

    if (!tmdbKey) {
      content.innerHTML = `<div class="info-no-key">
        <strong style="color:rgba(255,255,255,0.7);display:block;margin-bottom:6px;">TMDB API Key Required</strong>
        Add a free TMDB API key to your card config as <code>tmdb_api_key</code> to show
        TV &amp; movie information.<br><br>
        Get a free key at <a href="https://www.themoviedb.org/settings/api" target="_blank">themoviedb.org</a>
        — free for personal use.
      </div>`;
      return;
    }

    if (!title) {
      content.innerHTML = '<div class="info-error">No title information available.</div>';
      return;
    }

    // Strip "Series: Name - Episode Title" down to just "Series: Name"
    // e.g. "Star Trek: Voyager - Dark Frontier" → "Star Trek: Voyager"
    let searchTitle = title;
    if (title.includes(' - ') && title.includes(':')) {
      searchTitle = title.split(' - ')[0].trim();
    }

    // Strip trailing year in parentheses e.g. "Interstellar (2014)" → "Interstellar"
    const yearMatch = searchTitle.match(/\s*\((\d{4})\)\s*$/);
    const cleanedTitle = yearMatch ? searchTitle.replace(yearMatch[0], '').trim() : searchTitle;
    const titleYear    = yearMatch ? yearMatch[1] : null;

    content.innerHTML = '<div class="info-loading">Looking up media</div>';

    const base    = 'https://api.themoviedb.org/3';
    const imgBase = 'https://image.tmdb.org/t/p/w300';
    const isBearer = tmdbKey.startsWith('ey');
    const tmdbFetch = (url) => fetch(
      isBearer ? url : `${url}${url.includes('?') ? '&' : '?'}api_key=${tmdbKey}`,
      isBearer ? { headers: { Authorization: `Bearer ${tmdbKey}` } } : {}
    );

    // Scoring: how well does a result name match the search title?
    const norm  = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const qNorm = norm(cleanedTitle);
    const nameScore = (name) => {
      const n = norm(name);
      if (n === qNorm)                              return 4;
      if (n.startsWith(qNorm) || qNorm.startsWith(n)) return 3;
      if (n.includes(qNorm)   || qNorm.includes(n))   return 2;
      return 0;
    };

    try {
      // Search TV and movie simultaneously
      const [tvResp, mvResp] = await Promise.all([
        tmdbFetch(`${base}/search/tv?query=${encodeURIComponent(cleanedTitle)}&page=1`),
        tmdbFetch(`${base}/search/movie?query=${encodeURIComponent(cleanedTitle)}&page=1${titleYear ? '&year=' + titleYear : ''}`)
      ]);

      const tvResults = tvResp.ok ? ((await tvResp.json()).results || []) : [];
      const mvResults = mvResp.ok ? ((await mvResp.json()).results || []) : [];

      // Score each result — integer name score + tiny popularity tiebreaker
      const scored = (results, nameKey) => results
        .map(r => ({ r, s: nameScore(r[nameKey]), pop: r.popularity || 0 }))
        .filter(x => x.s > 0)
        .sort((a, b) => b.s - a.s || b.pop - a.pop);

      const tvScored = scored(tvResults, 'name');
      const mvScored = scored(mvResults, 'title');

      if (!tvScored.length && !mvScored.length) {
        content.innerHTML = `<div class="info-error">No results found on TMDB for "${cleanedTitle}".</div>`;
        return;
      }

      const bestTV = tvScored[0] || null;
      const bestMV = mvScored[0] || null;
      const tvScore = bestTV ? bestTV.s : 0;
      const mvScore = bestMV ? bestMV.s : 0;

      // When both TV and movie have equally strong matches (e.g. "Passengers", "Legend")
      // show a mixed picker so the user can choose rather than guessing wrong.
      const ambiguous = bestTV && bestMV && tvScore === mvScore;

      if (ambiguous) {
        // Build a combined list: top 3 movies first (more likely what's playing),
        // then top 3 TV shows — user can scroll and pick
        const pickerItems = [
          ...mvScored.slice(0, 3).map(x => ({ ...x, kind: 'movie' })),
          ...tvScored.slice(0, 3).map(x => ({ ...x, kind: 'tv' }))
        ];
        this._renderMediaPicker(content, pickerItems, imgBase, tmdbFetch, base);
        return;
      }

      if (mvScore > tvScore && bestMV) {
        // Movie wins clearly
        const movie = bestMV.r;
        let cast = [];
        try {
          const credResp = await tmdbFetch(`${base}/movie/${movie.id}/credits`);
          if (credResp.ok) cast = ((await credResp.json()).cast || []).slice(0, 8);
        } catch (_) {}
        this._renderMovieInfo(content, movie, cast, imgBase);
      } else if (bestTV) {
        // TV wins clearly — if multiple shows share the top score show a picker
        const topShows = tvScored.filter(x => x.s === tvScore).slice(0, 6).map(x => x.r);
        if (topShows.length > 1) {
          this._renderTVPicker(content, topShows, null, null, imgBase, tmdbFetch, base);
        } else {
          await this._loadTVShow(bestTV.r, null, null, imgBase, tmdbFetch, base, content);
        }
      } else {
        // Only movies found
        const movie = bestMV.r;
        let cast = [];
        try {
          const credResp = await tmdbFetch(`${base}/movie/${movie.id}/credits`);
          if (credResp.ok) cast = ((await credResp.json()).cast || []).slice(0, 8);
        } catch (_) {}
        this._renderMovieInfo(content, movie, cast, imgBase);
      }

    } catch (err) {
      content.innerHTML = `<div class="info-error">Failed to load TMDB info.<br><small style="opacity:0.6">${err.message}</small></div>`;
    }
  }

  _tmdbRatingRing(pct, voteCount) {
    // pct is 0-100. Colour: green >= 70, yellow >= 50, muted red below 50.
    const colour = pct >= 70 ? '#A8D64B'   // lime-green matching card aesthetic
                 : pct >= 50 ? '#C8B420'   // warm gold
                 :             '#C0504A';  // muted red
    const r = 17;
    const circ = 2 * Math.PI * r;  // ≈ 106.8
    const dash = (pct / 100) * circ;
    const gap  = circ - dash;
    // Track label: show vote count compactly
    const countLabel = voteCount
      ? (parseInt(voteCount.replace(/,/g,'')) >= 1000
          ? (parseInt(voteCount.replace(/,/g,'')) / 1000).toFixed(0) + 'k'
          : voteCount) + ' votes'
      : 'TMDB';
    return `<div class="info-rating">
      <div class="info-rating-ring">
        <svg viewBox="0 0 42 42">
          <circle class="info-rating-ring-bg"  cx="21" cy="21" r="${r}"/>
          <circle class="info-rating-ring-arc" cx="21" cy="21" r="${r}"
            stroke="${colour}"
            stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}"/>
        </svg>
        <div class="info-rating-ring-label">
          <span class="info-rating-ring-pct">${pct}</span>
        </div>
      </div>
      <div class="info-rating-meta">
        <span class="info-rating-val">User Score</span>
        <span class="info-rating-count">${countLabel}</span>
      </div>
    </div>`;
  }

  _renderTVInfo(content, show, cast, seasons, firstEps, imgBase, tmdbFetch, base) {
    const year      = show.first_air_date ? show.first_air_date.split('-')[0] : '';
    const voteCount = show.vote_count ? show.vote_count.toLocaleString() : '';
    const tmdbUrl   = `https://www.themoviedb.org/tv/${show.id}`;

    const artFallback = `<svg viewBox="0 0 24 24"><path d="M21,3H3C1.89,3 1,3.89 1,5V17A2,2 0 0,0 3,19H8V21H16V19H21A2,2 0 0,0 23,17V5C23,3.89 22.1,3 21,3M21,17H3V5H21V17Z"/></svg>`;
    const entityArt = this._hass?.states[this._entity]?.attributes?.entity_picture || '';
    const heroArtHtml = entityArt
      ? `<img src="${entityArt}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">${artFallback}`
      : artFallback;

    const ratingPct  = show.vote_average ? Math.round(show.vote_average * 10) : 0;
    const ratingHtml = ratingPct ? this._tmdbRatingRing(ratingPct, show.vote_count?.toLocaleString() || '') : '';

    const genreMap = {28:'Action',12:'Adventure',16:'Animation',35:'Comedy',80:'Crime',99:'Documentary',18:'Drama',10751:'Family',14:'Fantasy',36:'History',27:'Horror',10402:'Music',9648:'Mystery',10749:'Romance',878:'Sci-Fi',53:'Thriller',10752:'War',37:'Western',10759:'Action & Adventure',10762:'Kids',10763:'News',10764:'Reality',10765:'Sci-Fi & Fantasy',10766:'Soap',10767:'Talk',10768:'War & Politics'};
    const genreTags = ((show.genres || show.genre_ids || []).slice(0, 3).map(g => {
      const label = typeof g === 'object' ? g.name : genreMap[g];
      return label ? `<span class="info-tag">${label}</span>` : '';
    })).join('');

    const numSeasons = seasons.length;
    const metaItems = [year, numSeasons ? `${numSeasons} season${numSeasons !== 1 ? 's' : ''}` : ''].filter(Boolean);

    const overviewHtml = show.overview
      ? `<div class="info-section-label">About</div><div class="info-overview">${show.overview}</div>` : '';

    const CAST_INITIAL = 12;
    const buildCastItems = (members) => members.map(c => `
      <a class="info-cast-item" href="https://www.themoviedb.org/person/${c.id}" target="_blank" rel="noopener">
        <div class="info-cast-photo">
          ${c.profile_path
            ? `<img src="${imgBase + c.profile_path}" alt="${c.name}">`
            : `<svg viewBox="0 0 24 24"><path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/></svg>`}
        </div>
        <div class="info-cast-name">${c.name}</div>
      </a>`).join('');
    const castHtml = cast.length
      ? `<div class="info-section-label">Cast</div>
         <div class="info-cast" id="castGrid">${buildCastItems(cast.slice(0, CAST_INITIAL))}</div>
         ${cast.length > CAST_INITIAL
           ? `<button id="castViewMore" style="display:block;margin:6px auto 0;padding:5px 16px;border-radius:20px;border:1px solid rgba(255,255,255,0.2);background:transparent;color:rgba(255,255,255,0.6);font-size:11px;cursor:pointer">
                View all ${cast.length} cast members
              </button>`
           : ''}` : '';

    // Season tabs (skip season 0 = specials)
    const seasonTabsHtml = seasons.length > 1
      ? `<div class="tv-season-tabs" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
           ${seasons.map(s => `
             <button class="tv-season-tab${s.season_number === (seasons[0]?.season_number) ? ' active' : ''}"
               data-season="${s.season_number}"
               style="padding:4px 10px;border-radius:20px;border:1px solid rgba(255,255,255,0.15);background:${s.season_number === seasons[0]?.season_number ? 'rgba(255,255,255,0.15)' : 'transparent'};color:rgba(255,255,255,0.7);font-size:11px;cursor:pointer">
               S${s.season_number}
             </button>`).join('')}
         </div>` : '';

    // Build episode rows — each links to the TMDB episode page
    // ep.season_number is included in every episode object returned by the season endpoint
    const buildEpRows = (eps) => eps.map(ep => {
      const still = ep.still_path ? `<img src="${imgBase + ep.still_path}" alt="" style="width:72px;height:44px;object-fit:cover;border-radius:5px;flex-shrink:0">` : `<div style="width:72px;height:44px;border-radius:5px;background:rgba(255,255,255,0.05);flex-shrink:0"></div>`;
      const epRating = ep.vote_average ? Math.round(ep.vote_average * 10) : '';
      const airDate  = ep.air_date ? ep.air_date.split('-')[0] : '';
      const epUrl    = 'https://www.themoviedb.org/tv/' + show.id + '/season/' + ep.season_number + '/episode/' + ep.episode_number;
      return '<a class="tv-ep-row" href="' + epUrl + '" target="_blank" rel="noopener" style="display:flex;gap:10px;align-items:flex-start;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.05);text-decoration:none;cursor:pointer">'
        + still
        + '<div style="flex:1;min-width:0">'
        + '<div style="font-size:12px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + ep.episode_number + '. ' + (ep.name || 'Episode ' + ep.episode_number) + '</div>'
        + '<div style="font-size:10px;color:rgba(255,255,255,0.35);margin-top:1px">' + [airDate, epRating ? epRating + ' score' : ''].filter(Boolean).join(' · ') + '</div>'
        + (ep.overview ? '<div style="font-size:10px;color:rgba(255,255,255,0.4);margin-top:3px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;line-height:1.4">' + ep.overview + '</div>' : '')
        + '</div>'
        + '<svg viewBox="0 0 24 24" style="width:12px;height:12px;fill:rgba(255,255,255,0.2);flex-shrink:0;align-self:center"><path d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z"/></svg>'
        + '</a>';
    }).join('');

    content.innerHTML = `
      <div class="info-hero">
        <a class="info-hero-art" href="${tmdbUrl}" target="_blank" rel="noopener" style="cursor:pointer;flex-shrink:0;text-decoration:none;display:block">${heroArtHtml}</a>
        <div class="info-hero-meta">
          <div class="info-hero-title">${show.name}</div>
          ${metaItems.length ? `<div class="info-hero-sub">${metaItems.join(' · ')}</div>` : ''}
          ${ratingHtml}
          ${genreTags ? `<div class="info-hero-tags">${genreTags}</div>` : ''}
        </div>
      </div>
      ${overviewHtml}
      ${castHtml}
      <div class="info-section-label">Episodes</div>
      ${seasonTabsHtml}
      <div class="tv-ep-list">${buildEpRows(firstEps)}</div>
      <a class="info-ext-link" href="${tmdbUrl}" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24"><path d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z"/></svg>
        View on TMDB
      </a>
    `;

    // Wire cast View More button
    const castMoreBtn = content.getElementById ? content.getElementById('castViewMore') : content.querySelector('#castViewMore');
    if (castMoreBtn) {
      castMoreBtn.addEventListener('click', () => {
        const grid = content.querySelector('#castGrid');
        if (grid) grid.innerHTML = buildCastItems(cast);
        castMoreBtn.remove();
      });
    }

    // Wire season tab clicks — fetch that season on demand
    content.querySelectorAll('.tv-season-tab').forEach(btn => {
      btn.addEventListener('click', async () => {
        content.querySelectorAll('.tv-season-tab').forEach(b => {
          b.style.background = 'transparent';
          b.classList.remove('active');
        });
        btn.style.background = 'rgba(255,255,255,0.15)';
        btn.classList.add('active');
        const sNum = parseInt(btn.dataset.season);
        const epList = content.querySelector('.tv-ep-list');
        epList.innerHTML = '<div class="info-loading" style="padding:12px 0">Loading episodes</div>';
        try {
          const sResp = await tmdbFetch(`${base}/tv/${show.id}/season/${sNum}`);
          if (sResp.ok) {
            const eps = (await sResp.json()).episodes || [];
            epList.innerHTML = buildEpRows(eps);
          }
        } catch (_) {
          epList.innerHTML = '<div class="info-error">Could not load episodes.</div>';
        }
      });
    });
  }

  _renderMovieInfo(content, movie, cast, imgBase) {
    const year      = movie.release_date ? movie.release_date.split('-')[0] : '';
    const voteCount = movie.vote_count ? movie.vote_count.toLocaleString() : '';
    const overview  = movie.overview || '';
    const tmdbUrl   = `https://www.themoviedb.org/movie/${movie.id}`;

    const artFallback = `<svg viewBox="0 0 24 24"><path d="M18,4L20,8H17L15,4H13L15,8H12L10,4H8L10,8H7L5,4H4A2,2 0 0,0 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V4H18Z"/></svg>`;
    const entityArt = this._hass?.states[this._entity]?.attributes?.entity_picture || '';
    const heroArtHtml = entityArt
      ? `<img src="${entityArt}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">${artFallback}`
      : artFallback;

    const ratingPct  = movie.vote_average ? Math.round(movie.vote_average * 10) : 0;
    const ratingHtml = ratingPct ? this._tmdbRatingRing(ratingPct, voteCount) : '';

    const genreMap = {28:'Action',12:'Adventure',16:'Animation',35:'Comedy',80:'Crime',99:'Documentary',18:'Drama',10751:'Family',14:'Fantasy',36:'History',27:'Horror',10402:'Music',9648:'Mystery',10749:'Romance',878:'Science Fiction',53:'Thriller',10752:'War',37:'Western'};
    const genreTags = (movie.genre_ids || []).slice(0, 3)
      .map(id => genreMap[id] ? `<span class="info-tag">${genreMap[id]}</span>` : '').join('');

    const overviewHtml = overview
      ? `<div class="info-section-label">Synopsis</div><div class="info-overview">${overview}</div>` : '';

    const castHtml = cast.length
      ? `<div class="info-section-label">Cast</div>
         <div class="info-cast">
           ${cast.map(c => `
             <a class="info-cast-item" href="https://www.themoviedb.org/person/${c.id}" target="_blank" rel="noopener">
               <div class="info-cast-photo">
                 ${c.profile_path
                   ? `<img src="${imgBase + c.profile_path}" alt="${c.name}">`
                   : `<svg viewBox="0 0 24 24"><path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/></svg>`}
               </div>
               <div class="info-cast-name">${c.name}</div>
             </a>`).join('')}
         </div>` : '';

    content.innerHTML = `
      <div class="info-hero">
        <a class="info-hero-art" href="${tmdbUrl}" target="_blank" rel="noopener" style="cursor:pointer;flex-shrink:0;text-decoration:none;display:block">${heroArtHtml}</a>
        <div class="info-hero-meta">
          <div class="info-hero-title">${movie.title}</div>
          ${year ? `<div class="info-hero-sub">${year}</div>` : ''}
          ${ratingHtml}
          ${genreTags ? `<div class="info-hero-tags">${genreTags}</div>` : ''}
        </div>
      </div>
      ${overviewHtml}
      ${castHtml}
      <a class="info-ext-link" href="${tmdbUrl}" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24"><path d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z"/></svg>
        View on TMDB
      </a>
    `;
  }

  // Fetches full TV show details + cast + first season, then renders
  async _loadTVShow(show, _season, _episode, imgBase, tmdbFetch, base, content) {
    content.innerHTML = '<div class="info-loading">Loading show info</div>';

    // Fetch full show details (includes seasons array with episode counts)
    let fullShow = show;
    try {
      const detResp = await tmdbFetch(`${base}/tv/${show.id}`);
      if (detResp.ok) fullShow = await detResp.json();
    } catch (_) {}

    // aggregate_credits covers every actor across every episode — far more complete
    // than /credits which only returns series regulars
    let cast = [];
    try {
      const credResp = await tmdbFetch(`${base}/tv/${show.id}/aggregate_credits`);
      if (credResp.ok) {
        const data = await credResp.json();
        // Sort by total episode count descending so leads appear first
        cast = (data.cast || []).sort((a, b) =>
          (b.total_episode_count || 0) - (a.total_episode_count || 0)
        );
      }
    } catch (_) {}

    // Fetch season 1 episodes by default (skip season 0 = specials)
    const seasons = (fullShow.seasons || []).filter(s => s.season_number > 0);
    const firstSeason = seasons[0];
    let firstEps = [];
    if (firstSeason) {
      try {
        const sResp = await tmdbFetch(`${base}/tv/${show.id}/season/${firstSeason.season_number}`);
        if (sResp.ok) firstEps = ((await sResp.json()).episodes || []);
      } catch (_) {}
    }

    this._renderTVInfo(content, fullShow, cast, seasons, firstEps, imgBase, tmdbFetch, base);
  }

  // Shows a mixed TV + movie picker when both score equally (e.g. single-word titles)
  _renderMediaPicker(content, items, imgBase, tmdbFetch, base) {
    const tvIcon  = `<svg viewBox="0 0 24 24" style="width:11px;height:11px;fill:currentColor;flex-shrink:0"><path d="M21,3H3C1.89,3 1,3.89 1,5V17A2,2 0 0,0 3,19H8V21H16V19H21A2,2 0 0,0 23,17V5C23,3.89 22.1,3 21,3M21,17H3V5H21V17Z"/></svg>`;
    const mvIcon  = `<svg viewBox="0 0 24 24" style="width:11px;height:11px;fill:currentColor;flex-shrink:0"><path d="M18,4L20,8H17L15,4H13L15,8H12L10,4H8L10,8H7L5,4H4A2,2 0 0,0 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V4H18Z"/></svg>`;

    const itemsHtml = items.map((item, i) => {
      const r    = item.r;
      const name = item.kind === 'tv' ? r.name : r.title;
      const year = item.kind === 'tv'
        ? (r.first_air_date || '').split('-')[0]
        : (r.release_date  || '').split('-')[0];
      const tmdbItemUrl = item.kind === 'tv'
        ? `https://www.themoviedb.org/tv/${r.id}`
        : `https://www.themoviedb.org/movie/${r.id}`;
      const poster = r.poster_path
        ? `<a href="${tmdbItemUrl}" target="_blank" rel="noopener" style="display:block;flex-shrink:0;border-radius:5px;overflow:hidden;opacity:1;transition:opacity 0.15s ease" onmouseover="this.style.opacity='0.75'" onmouseout="this.style.opacity='1'"><img src="${imgBase + r.poster_path}" alt="" style="width:40px;height:56px;object-fit:cover;display:block"></a>`
        : `<div style="width:40px;height:56px;border-radius:5px;background:rgba(255,255,255,0.06);flex-shrink:0"></div>`;
      const badge = `<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 6px;border-radius:10px;font-size:10px;font-weight:600;background:${item.kind === 'movie' ? 'rgba(0,122,255,0.25)' : 'rgba(88,86,214,0.25)'};color:${item.kind === 'movie' ? '#60aeff' : '#a78bfa'}">${item.kind === 'movie' ? mvIcon : tvIcon} ${item.kind === 'movie' ? 'Movie' : 'TV Series'}</span>`;
      return `<div class="media-pick-item" data-idx="${i}"
          style="display:flex;align-items:center;gap:12px;padding:10px 8px;border-radius:10px;cursor:pointer;transition:background 0.15s ease;border-bottom:1px solid rgba(255,255,255,0.05)">
          ${poster}
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name}</div>
            <div style="display:flex;align-items:center;gap:6px;margin-top:3px">${badge}${year ? `<span style="font-size:11px;color:rgba(255,255,255,0.4)">${year}</span>` : ''}</div>
            ${r.overview ? `<div style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:3px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;line-height:1.4">${r.overview}</div>` : ''}
          </div>
          <svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:rgba(255,255,255,0.25);flex-shrink:0"><path d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z"/></svg>
        </div>`;
    }).join('');

    content.innerHTML = `
      <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.35);letter-spacing:0.6px;text-transform:uppercase;margin-bottom:8px">Which did you mean?</div>
      <div>${itemsHtml}</div>`;

    content.querySelectorAll('.media-pick-item').forEach(el => {
      el.addEventListener('mouseenter', () => el.style.background = 'rgba(255,255,255,0.06)');
      el.addEventListener('mouseleave', () => el.style.background = '');
      el.addEventListener('click', async () => {
        const item = items[parseInt(el.dataset.idx)];
        const goBack = () => this._renderMediaPicker(content, items, imgBase, tmdbFetch, base);
        if (item.kind === 'tv') {
          await this._loadTVShow(item.r, null, null, imgBase, tmdbFetch, base, content);
          this._injectBackButton(content, goBack);
        } else {
          content.innerHTML = '<div class="info-loading">Loading movie info</div>';
          let cast = [];
          try {
            const credResp = await tmdbFetch(`${base}/movie/${item.r.id}/credits`);
            if (credResp.ok) cast = ((await credResp.json()).cast || []).slice(0, 8);
          } catch (_) {}
          this._renderMovieInfo(content, item.r, cast, imgBase);
          this._injectBackButton(content, goBack);
        }
      });
    });
  }

  // Shows a list of matching series for the user to pick from
  _renderTVPicker(content, shows, season, episode, imgBase, tmdbFetch, base) {
    const itemsHtml = shows.map((show, i) => {
      const year = show.first_air_date ? show.first_air_date.split('-')[0] : '';
      const tvItemUrl = `https://www.themoviedb.org/tv/${show.id}`;
      const poster = show.poster_path
        ? `<a href="${tvItemUrl}" target="_blank" rel="noopener" style="display:block;flex-shrink:0;border-radius:5px;overflow:hidden;opacity:1;transition:opacity 0.15s ease" onmouseover="this.style.opacity='0.75'" onmouseout="this.style.opacity='1'"><img src="${imgBase + show.poster_path}" alt="" style="width:40px;height:56px;object-fit:cover;display:block"></a>`
        : `<div style="width:40px;height:56px;border-radius:5px;background:rgba(255,255,255,0.06);flex-shrink:0;display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:rgba(255,255,255,0.2)"><path d="M21,3H3C1.89,3 1,3.89 1,5V17A2,2 0 0,0 3,19H8V21H16V19H21A2,2 0 0,0 23,17V5C23,3.89 22.1,3 21,3M21,17H3V5H21V17Z"/></svg></div>`;
      return `
        <div class="tv-pick-item" data-idx="${i}"
          style="display:flex;align-items:center;gap:12px;padding:10px 8px;border-radius:10px;cursor:pointer;transition:background 0.15s ease;border-bottom:1px solid rgba(255,255,255,0.05)">
          ${poster}
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${show.name}</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:2px">${year}${show.vote_average ? ' · ' + Math.round(show.vote_average * 10) : ''}</div>
            ${show.overview ? `<div style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:3px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;line-height:1.4">${show.overview}</div>` : ''}
          </div>
          <svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:rgba(255,255,255,0.25);flex-shrink:0"><path d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z"/></svg>
        </div>`;
    }).join('');

    content.innerHTML = `
      <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.35);letter-spacing:0.6px;text-transform:uppercase;margin-bottom:8px">Select Series</div>
      <div>${itemsHtml}</div>
    `;

    // Wire up click handlers
    content.querySelectorAll('.tv-pick-item').forEach(el => {
      el.addEventListener('mouseenter', () => el.style.background = 'rgba(255,255,255,0.06)');
      el.addEventListener('mouseleave', () => el.style.background = '');
      el.addEventListener('click', () => {
        const show = shows[parseInt(el.dataset.idx)];
        const goBack = () => this._renderTVPicker(content, shows, season, episode, imgBase, tmdbFetch, base);
        this._loadTVShow(show, season, episode, imgBase, tmdbFetch, base, content)
          .then(() => this._injectBackButton(content, goBack));
      });
    });
  }

  async _loadMATab(tab) {
    this._maCurrentTab = tab;
    const content = this.shadowRoot.getElementById('maContent');
    content.innerHTML = '<div class="ma-loading">Loading</div>';
    const configEntryId = await this._getMAConfigEntryId();
    if (!configEntryId) {
      content.innerHTML = '<div class="ma-error">Music Assistant integration not found.<br><small style="opacity:0.6">Make sure the MA integration is installed and loaded in HA.</small></div>';
      return;
    }
    const tabTypeMap = { playlist:'playlist', artist:'artist', album:'album', track:'track', radio:'radio', favourites:'track' };
    const mediaType = tabTypeMap[tab] || 'track';
    const isFav = tab === 'favourites';
    try {
      const msg = {
        type: 'call_service',
        domain: 'music_assistant',
        service: 'get_library',
        service_data: { config_entry_id: configEntryId, media_type: mediaType, limit: 100, ...(isFav ? { favorite: true } : {}) },
        return_response: true
      };
      const res = await this._hass.connection.sendMessagePromise(msg);
      const items = res?.response?.items || [];
      if (!items.length) {
        content.innerHTML = '<div class="ma-empty">No ' + tab + 's found in your library.</div>';
        return;
      }
      this._renderMAGrid(items, tab, content);
    } catch (e) {
      console.error('[MA] get_library error:', e);
      content.innerHTML = '<div class="ma-error">Could not load library.<br><small style="opacity:0.6">' + (e && e.message ? e.message : String(e)) + '</small></div>';
    }
  }

  async _getMAConfigEntryId() {
    if (this._maConfigEntryId) return this._maConfigEntryId;
    try {
      // Modern HA: use WebSocket
      const result = await this._hass.connection.sendMessagePromise({
        type: 'config_entries/get',
        domain: 'music_assistant'
      });
      const entries = Array.isArray(result) ? result : (result && result.result ? result.result : []);
      const maEntry = entries.find(function(e) { return e.domain === 'music_assistant' && e.state === 'loaded'; });
      this._maConfigEntryId = maEntry ? maEntry.entry_id : null;
      return this._maConfigEntryId;
    } catch (e) {
      try {
        // Fallback: REST API (older HA)
        const entries = await this._hass.callApi('GET', 'config/config_entries/entry');
        const maEntry = entries.find(function(e) { return e.domain === 'music_assistant' && e.state === 'loaded'; });
        this._maConfigEntryId = maEntry ? maEntry.entry_id : null;
        return this._maConfigEntryId;
      } catch (e2) {
        console.error('[MA] Failed to get MA config entry:', e2);
        return null;
      }
    }
  }

  _maImgUrl(item) {
    if (typeof item.image === 'string' && item.image) return item.image;
    if (item.image && item.image.path) return item.image.path;
    if (item.thumbnail) return item.thumbnail;
    return null;
  }

  _maItemSvg(tab) {
    var icons = {
      playlist:   '<path d="M15,6H3V8H15V6M15,10H3V12H15V10M3,16H11V14H3V16M17,6V14.18C16.69,14.07 16.35,14 16,14A3,3 0 0,0 13,17A3,3 0 0,0 16,20A3,3 0 0,0 19,17V8H22V6H17Z"/>',
      artist:     '<path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M7.07,18.28C7.5,17.38 10.12,16.5 12,16.5C13.88,16.5 16.5,17.38 16.93,18.28C15.57,19.36 13.86,20 12,20C10.14,20 8.43,19.36 7.07,18.28M12,6C10.06,6 8.5,7.56 8.5,9.5C8.5,11.44 10.06,13 12,13C13.94,13 15.5,11.44 15.5,9.5C15.5,7.56 13.94,6 12,6Z"/>',
      album:      '<path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,10A2,2 0 0,1 14,12A2,2 0 0,1 12,14A2,2 0 0,1 10,12A2,2 0 0,1 12,10Z"/>',
      track:      '<path d="M12,3V13.55C11.41,13.21 10.73,13 10,13C7.79,13 6,14.79 6,17C6,19.21 7.79,21 10,21C12.21,21 14,19.21 14,17V7H18V3H12Z"/>',
      radio:      '<path d="M6.18,15.64A2.18,2.18 0 0,1 8.36,17.82C8.36,19 7.38,20 6.18,20C4.98,20 4,19 4,17.82A2.18,2.18 0 0,1 6.18,15.64Z"/>',
      favourites: '<path d="M12,21.35L10.55,20.03C5.4,15.36 2,12.27 2,8.5C2,5.41 4.42,3 7.5,3C9.24,3 10.91,3.81 12,5.08C13.09,3.81 14.76,3 16.5,3C19.58,3 22,5.41 22,8.5C22,12.27 18.6,15.36 13.45,20.03L12,21.35Z"/>',
    };
    return icons[tab] || icons.track;
  }

  _renderMAGrid(items, tab, container) {
    var self = this;
    var grid = document.createElement('div');
    grid.className = 'ma-grid';
    items.forEach(function(item) {
      var imgUrl = self._maImgUrl(item);
      var title = item.name || item.title || '—';
      var sub = (item.artists ? item.artists.map(function(a){return a.name;}).join(', ') : '') || (item.owner ? item.owner.name : '') || '';
      var el = document.createElement('div');
      el.className = 'ma-item';
      el.innerHTML =
        '<div class="ma-item-art">' +
        (imgUrl ? '<img src="' + imgUrl + '" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' : '') +
        '<svg viewBox="0 0 24 24" style="display:' + (imgUrl ? 'none' : 'flex') + '">' + self._maItemSvg(tab) + '</svg>' +
        '</div>' +
        '<div class="ma-item-info">' +
        '<div class="ma-item-title">' + title + '</div>' +
        (sub ? '<div class="ma-item-sub">' + sub + '</div>' : '') +
        '</div>';
      el.onclick = function() { self._playMAItem(item, tab); };
      grid.appendChild(el);
    });
    container.innerHTML = '';
    container.appendChild(grid);
  }

  _playMAItem(item, tab) {
    var uri = item.uri || item.media_content_id;
    var mediaType = item.media_type || tab;
    var self = this;
    this._hass.callService('music_assistant', 'play_media', {
      entity_id: this._entity,
      media_id: uri,
      media_type: mediaType,
      enqueue: 'replace'
    }).catch(function() {
      self._hass.callService('media_player', 'play_media', {
        entity_id: self._entity,
        media_content_id: uri,
        media_content_type: mediaType
      });
    });
    this._closeMABrowser();
  }


}

class AtvMediaRemoteEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._initialized = false;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._initialized) this.render();
  }

  setConfig(config) {
    this._config = config;
    // Once the editor is rendered, never re-render from setConfig.
    // All DOM state (search filter, checkboxes, vol toggles) is managed directly.
    if (!this._initialized && this._hass) this.render();
  }

  updateUI() {
    const root = this.shadowRoot;
    if (!root) return;
    // Sync colour cards
    this.shadowRoot.querySelectorAll('.colour-card').forEach(card => {
      const key       = card.dataset.key;
      const savedVal  = this._config[key] || '';
      const swatchVal = savedVal || card.querySelector('.colour-hex').placeholder;
      card.querySelector('.colour-swatch-preview').style.background = swatchVal;
      card.querySelector('.colour-dot').style.background            = swatchVal;
      card.querySelector('input[type=color]').value = /^#[0-9a-fA-F]{6}$/.test(swatchVal) ? swatchVal : swatchVal.substring(0,7);
      card.querySelector('.colour-hex').value = savedVal;
    });
    const autoSwitchInput = root.getElementById('auto_switch');
    if (autoSwitchInput) autoSwitchInput.checked = this._config.auto_switch !== false;
    const rememberRow = root.getElementById('remember_last_entity_row');
    const rememberInput = root.getElementById('remember_last_entity');
    if (rememberInput) rememberInput.checked = this._config.remember_last_entity === true;
    if (rememberRow) rememberRow.style.display = this._config.auto_switch !== false ? 'none' : '';
    const showSelectorInput = root.getElementById('show_entity_selector');
    if (showSelectorInput) showSelectorInput.checked = this._config.show_entity_selector !== false;
    const volBtnInput = root.getElementById('volume_control_btn');
    if (volBtnInput) volBtnInput.checked = this._config.volume_control === 'buttons';
    const showVolPctInput = root.getElementById('show_vol_pct');
    if (showVolPctInput) showVolPctInput.checked = this._config.show_vol_pct !== false;
    const scrollTextInput = root.getElementById('scroll_text');
    if (scrollTextInput) scrollTextInput.checked = this._config.scroll_text === true;
    const startupMode = this._config.startup_mode || 'compact';
    ['compact','maximised','remote'].forEach(v => {
      const el = root.getElementById('sm_' + v);
      if (el) el.checked = startupMode === v;
    });
    const volEntityInput = root.getElementById('volume_entity');
    if (volEntityInput) volEntityInput.value = this._config.volume_entity || '';
    const tmdbInput = root.getElementById('tmdb_api_key');
    if (tmdbInput) tmdbInput.value = this._config.tmdb_api_key || '';

  }

  render() {
    if (!this._hass || !this._config) return;
    this._initialized = true;
    const selected = this._config.entities || [];
    const others = Object.keys(this._hass.states)
      .filter(e => e.startsWith('media_player.') && !selected.includes(e) && this._hass.states[e] != null)
      .sort();
    const sortedList = [...selected, ...others];

    this.shadowRoot.innerHTML = `
      <style>
        .container { display: flex; flex-direction: column; gap: 20px; padding: 12px; color: var(--primary-text-color); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #888; margin-bottom: 2px; }
        .card-block { background: var(--card-background-color); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; overflow: hidden; }

        /* ── Colour pickers — leopard style ── */
        .colour-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .colour-card {
          border: 1px solid var(--divider-color, rgba(0,0,0,0.12));
          border-radius: 10px;
          overflow: hidden;
          cursor: pointer;
          transition: box-shadow 0.15s, border-color 0.15s;
          position: relative;
        }
        .colour-card:hover {
          box-shadow: 0 2px 10px rgba(0,0,0,0.12);
          border-color: var(--primary-color, #007AFF);
        }
        .colour-swatch {
          height: 44px; width: 100%;
          display: block; position: relative;
        }
        .colour-swatch input[type="color"] {
          position: absolute; inset: 0;
          width: 100%; height: 100%;
          opacity: 0; cursor: pointer; border: none; padding: 0;
        }
        .colour-swatch-preview { position: absolute; inset: 0; pointer-events: none; }
        .colour-swatch::before {
          content: ''; position: absolute; inset: 0;
          background-image:
            linear-gradient(45deg, #ccc 25%, transparent 25%),
            linear-gradient(-45deg, #ccc 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #ccc 75%),
            linear-gradient(-45deg, transparent 75%, #ccc 75%);
          background-size: 8px 8px;
          background-position: 0 0, 0 4px, 4px -4px, -4px 0px;
          opacity: 0.3; pointer-events: none;
        }
        .colour-info {
          padding: 6px 8px 7px;
          background: var(--card-background-color, #fff);
        }
        .colour-label {
          font-size: 11px; font-weight: 700;
          color: var(--primary-text-color); letter-spacing: 0.02em; margin-bottom: 1px;
        }
        .colour-desc {
          font-size: 10px; color: var(--secondary-text-color, #6b7280);
          margin-bottom: 4px; line-height: 1.3;
        }
        .colour-hex-row { display: flex; align-items: center; gap: 4px; }
        .colour-dot {
          width: 12px; height: 12px; border-radius: 50%;
          border: 1px solid rgba(0,0,0,0.15); flex-shrink: 0;
        }
        .colour-hex {
          flex: 1; font-size: 11px; font-family: monospace;
          border: none; background: none;
          color: var(--secondary-text-color, #6b7280);
          padding: 0; width: 0; min-width: 0;
        }
        .colour-hex:focus { outline: none; color: var(--primary-text-color); }
        .colour-edit-icon {
          opacity: 0; transition: opacity 0.15s;
          color: var(--secondary-text-color); font-size: 14px; line-height: 1;
        }
        .colour-card:hover .colour-edit-icon { opacity: 1; }

        /* Toggle rows */
        .toggle-list { display: flex; flex-direction: column; }
        .toggle-item { display: flex; align-items: center; justify-content: space-between; padding: 13px 16px; border-bottom: 1px solid rgba(255,255,255,0.06); min-height: 52px; }
        .toggle-item:last-child { border-bottom: none; }
        .toggle-label { font-size: 14px; font-weight: 500; flex: 1; padding-right: 12px; }
        /* iOS toggle switch */
        .toggle-switch { position: relative; width: 51px; height: 31px; flex-shrink: 0; }
        .toggle-switch input { opacity: 0; width: 0; height: 0; position: absolute; }
        .toggle-track {
          position: absolute; inset: 0; border-radius: 31px;
          background: rgba(120,120,128,0.32); cursor: pointer;
          transition: background 0.25s ease;
        }
        .toggle-track::after {
          content: ''; position: absolute;
          width: 27px; height: 27px; border-radius: 50%;
          background: #fff; top: 2px; left: 2px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          transition: transform 0.25s ease;
        }
        .toggle-switch input:checked + .toggle-track { background: #34C759; }
        .toggle-switch input:checked + .toggle-track::after { transform: translateX(20px); }

        /* Segmented control */
        .segmented { display: flex; background: rgba(118,118,128,0.2); border-radius: 9px; padding: 2px; gap: 2px; }
        .segmented input[type="radio"] { display: none; }
        .segmented label {
          flex: 1; text-align: center; padding: 8px 4px; font-size: 13px; font-weight: 500;
          border-radius: 7px; cursor: pointer; color: var(--primary-text-color);
          transition: all 0.2s ease; white-space: nowrap;
        }
        .segmented input[type="radio"]:checked + label {
          background: #007AFF; color: #ffffff;
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        }

        /* Select dropdowns */
        .select-row { padding: 12px 16px; display: flex; flex-direction: column; gap: 6px; }
        .select-row label { font-size: 14px; font-weight: 500; }
        .select-row .hint { font-size: 11px; color: #888; margin-top: -2px; }
        select {
          width: 100%; background: var(--card-background-color); color: var(--primary-text-color);
          border: 1px solid rgba(255,255,255,0.12); border-radius: 8px;
          padding: 10px 12px; font-size: 14px; cursor: pointer; -webkit-appearance: none;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23888' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 12px center;
          padding-right: 32px;
        }

        /* Entity list */
        input[type="text"] { width: 100%; box-sizing: border-box; background: var(--card-background-color); color: var(--primary-text-color); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; padding: 10px 12px; font-size: 14px; }
        .checklist { max-height: 300px; overflow-y: auto; -webkit-overflow-scrolling: touch; }
        .check-item { display: flex; align-items: center; padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.06); background: var(--card-background-color); touch-action: none; min-height: 48px; }
        .check-item:last-child { border-bottom: none; }
        .dragging { opacity: 0.5; background: #444 !important; }
        .drag-handle { cursor: grab; padding: 8px; color: #888; font-size: 20px; user-select: none; flex-shrink: 0; }
        .check-item .toggle-switch { width: 44px; height: 26px; flex-shrink: 0; margin-left: auto; }
        .check-item .toggle-switch input:checked + .toggle-track::after { transform: translateX(18px); }
        .check-item .toggle-track::after { width: 22px; height: 22px; }
        .check-item .toggle-track { border-radius: 26px; }
        .check-item input[type="checkbox"] { display: none; }
      </style>
      <div class="container">

        <!-- Entity List -->
        <div>
          <div class="section-title">Manage & Reorder Media Players</div>
          <div class="card-block">
            <div style="padding:10px 12px 0;">
              <input type="text" id="search" placeholder="Filter entities...">
            </div>
            <div class="checklist" id="entityList">
              ${sortedList.map(ent => {
                const isSelected = selected.includes(ent);
                return `
                  <div class="check-item" data-id="${ent}" draggable="${isSelected}" style="flex-wrap:wrap;gap:4px">
                    <div class="drag-handle"><svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:#888;display:block;"><path d="M9,3H11V5H9V3M13,3H15V5H13V3M9,7H11V9H9V7M13,7H15V9H13V7M9,11H11V13H9V11M13,11H15V13H13V11M9,15H11V17H9V15M13,15H15V17H13V15M9,19H11V21H9V19M13,19H15V21H13V21V19Z"/></svg></div>
                    <span style="margin-left:10px;flex:1;font-size:14px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${this._hass.states[ent]?.attributes?.friendly_name || ent}</span>
                    ${(() => {
                      if (!isSelected) return '<div class="entity-vol-wrap" style="display:none"></div>';
                      const hasVol = (this._config.entity_startup_volumes || {})[ent] != null;
                      const volVal = hasVol ? (this._config.entity_startup_volumes || {})[ent] : '';
                      return `<div class="entity-vol-wrap" style="display:flex;align-items:center;gap:6px;padding:2px 0">
                        <span style="font-size:11px;color:rgba(255,255,255,0.45);white-space:nowrap">Startup vol</span>
                        <label class="toggle-switch" style="width:36px;height:22px;flex-shrink:0">
                          <input type="checkbox" class="entity-vol-toggle" data-ent="${ent}" ${hasVol ? 'checked' : ''}>
                          <span class="toggle-track" style="border-radius:22px"></span>
                        </label>
                        <input type="number" class="entity-vol-input" data-ent="${ent}"
                          min="0" max="100" step="1"
                          value="${volVal}"
                          placeholder="35"
                          style="display:${hasVol ? 'block' : 'none'};width:44px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:4px 6px;color:#fff;font-size:12px;font-family:inherit;text-align:center;outline:none">
                        <span class="entity-vol-pct" style="display:${hasVol ? 'inline' : 'none'};font-size:11px;color:rgba(255,255,255,0.45)">%</span>
                      </div>`;
                    })()}
                    <label class="toggle-switch" style="flex-shrink:0">
                      <input type="checkbox" ${isSelected ? 'checked' : ''}>
                      <span class="toggle-track"></span>
                    </label>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>

        <!-- Toggles -->
        <div>
          <div class="section-title">Options</div>
          <div class="card-block">
            <div class="toggle-list">
              <div class="toggle-item">
                <span class="toggle-label">Auto Switch to Playing Device</span>
                <label class="toggle-switch"><input type="checkbox" id="auto_switch"><span class="toggle-track"></span></label>
              </div>
              <div class="toggle-item" id="remember_last_entity_row">
                <span class="toggle-label">Remember Last Selected Speaker</span>
                <label class="toggle-switch"><input type="checkbox" id="remember_last_entity"><span class="toggle-track"></span></label>
              </div>
              <div class="toggle-item">
                <span class="toggle-label">Show Media Player Selector</span>
                <label class="toggle-switch"><input type="checkbox" id="show_entity_selector"><span class="toggle-track"></span></label>
              </div>
              <div class="toggle-item">
                <span class="toggle-label">Use Volume Buttons</span>
                <label class="toggle-switch"><input type="checkbox" id="volume_control_btn"><span class="toggle-track"></span></label>
              </div>
              <div class="toggle-item">
                <span class="toggle-label">Show Volume Percentage</span>
                <label class="toggle-switch"><input type="checkbox" id="show_vol_pct"><span class="toggle-track"></span></label>
              </div>
              <div class="toggle-item">
                <span class="toggle-label">Scroll Long Track / Artist Text</span>
                <label class="toggle-switch"><input type="checkbox" id="scroll_text"><span class="toggle-track"></span></label>
              </div>
            </div>
          </div>
        </div>

        <!-- Startup View -->
        <div>
          <div class="section-title">Startup View</div>
          <div class="card-block" style="padding:12px;">
            <div class="segmented">
              <input type="radio" name="startup_mode" id="sm_compact" value="compact"><label for="sm_compact">Compact</label>
              <input type="radio" name="startup_mode" id="sm_maximised" value="maximised"><label for="sm_maximised">Maximised</label>
              <input type="radio" name="startup_mode" id="sm_remote" value="remote"><label for="sm_remote">Remote</label>
            </div>
          </div>
        </div>

        <!-- Volume Entity -->
        <div>
          <div class="section-title">Volume Entity</div>
          <div class="card-block">
            <div class="select-row">
              <div class="hint">Optional — route volume control to a different device</div>
              <select id="volume_entity">
                <option value="">— Same as active media player —</option>
                ${Object.keys(this._hass.states)
                  .filter(e => e.startsWith('media_player.') && this._hass.states[e] != null)
                  .sort()
                  .map(e => {
                    const name = this._hass.states[e]?.attributes?.friendly_name || e;
                    return `<option value="${e}">${name}</option>`;
                  }).join('')}
              </select>
            </div>
          </div>
        </div>

        <!-- Colours -->
        <div>
          <div class="section-title">Colours</div>
          <div class="card-block" style="padding:10px;">
            <div class="colour-grid" id="colour-grid"></div>
          </div>
        </div>

        <!-- Media Info API Keys -->
        <div>
          <div class="section-title">Media Info</div>
          <div class="card-block">
            <div class="hint" style="margin-bottom:10px;line-height:1.5">
              Tap album/poster art to show media info. Music uses Discogs (no key needed). TV &amp; movies use TMDB — add a free key below.
            </div>
            <div class="select-row" style="flex-direction:column;gap:6px;">
              <label style="font-size:12px;font-weight:600;color:rgba(255,255,255,0.55);">TMDB API Key <span style="font-weight:400;opacity:0.6">(required for TV &amp; movies)</span></label>
              <input type="text" id="tmdb_api_key" placeholder="TMDB v3 API key…"
                style="background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:8px 10px;color:#fff;font-size:12px;font-family:inherit;outline:none;width:100%">
              <div class="hint">Free key at <a href="https://www.themoviedb.org/settings/api" target="_blank" style="color:#007AFF">themoviedb.org</a> — instant approval for personal use.</div>
            </div>

          </div>
        </div>

      </div>
    `;
    this._setupSearch();
    this._setupReordering();

    // ── Build colour cards (leopard style) ──────────────────────────
    const COLOUR_FIELDS = [
      { key: 'accent_color',  label: 'Main Accent',      desc: 'Progress bar, active icons, highlights', default: '#007AFF', maxlen: 7 },
      { key: 'volume_accent', label: 'Volume Accent',    desc: 'Volume slider track colour',              default: '#007AFF', maxlen: 7 },
      { key: 'title_color',   label: 'Song Title',       desc: 'Track title text colour',                 default: '#ffffff', maxlen: 7 },
      { key: 'artist_color',  label: 'Song Artist',      desc: 'Artist name text colour',                 default: '#ffffff', maxlen: 7 },
      { key: 'button_color',  label: 'Button Colour',    desc: 'Media control icon colour',               default: '#ffffff', maxlen: 7 },
      { key: 'vol_pct_color', label: 'Volume % Colour',  desc: 'Volume percentage badge colour',          default: '#ffffff', maxlen: 7 },
      { key: 'player_bg',     label: 'Player Background',desc: '#000000 = transparent. 8-digit hex for partial opacity — e.g. #1c1c1e80', default: '#1c1c1e', maxlen: 9 },
    ];
    const grid = this.shadowRoot.getElementById('colour-grid');
    for (const field of COLOUR_FIELDS) {
      const savedVal  = this._config[field.key] || '';
      const swatchVal = savedVal || field.default;
      const card = document.createElement('div');
      card.className   = 'colour-card';
      card.dataset.key = field.key;
      card.innerHTML = `
        <label class="colour-swatch">
          <div class="colour-swatch-preview" style="background:${swatchVal}"></div>
          <input type="color" value="${/^#[0-9a-fA-F]{6}$/.test(swatchVal) ? swatchVal : swatchVal.substring(0,7)}">
        </label>
        <div class="colour-info">
          <div class="colour-label">${field.label}</div>
          <div class="colour-desc">${field.desc}</div>
          <div class="colour-hex-row">
            <div class="colour-dot" style="background:${swatchVal}"></div>
            <input class="colour-hex" type="text" value="${savedVal}"
              maxlength="${field.maxlen}" placeholder="${field.default}" spellcheck="false">
            <span class="colour-edit-icon">✎</span>
          </div>
        </div>`;
      const nativePicker = card.querySelector('input[type=color]');
      const hexInput     = card.querySelector('.colour-hex');
      const preview      = card.querySelector('.colour-swatch-preview');
      const dot          = card.querySelector('.colour-dot');
      const apply = (val) => {
        preview.style.background = val;
        dot.style.background     = val;
        if (/^#[0-9a-fA-F]{6}$/.test(val)) nativePicker.value = val;
        hexInput.value = val;
        this._updateConfig(field.key, val);
      };
      nativePicker.addEventListener('input',  () => apply(nativePicker.value));
      nativePicker.addEventListener('change', () => apply(nativePicker.value));
      hexInput.addEventListener('input', () => {
        const v = hexInput.value.trim();
        if (/^#[0-9a-fA-F]{6}$/.test(v) || /^#[0-9a-fA-F]{8}$/.test(v)) apply(v);
      });
      hexInput.addEventListener('blur', () => {
        const cur = this._config[field.key] || field.default;
        if (!/^#[0-9a-fA-F]{6,8}$/.test(hexInput.value.trim())) hexInput.value = cur;
      });
      hexInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') hexInput.blur(); });
      grid.appendChild(card);
    }

    this._setupListeners();
    this.updateUI();
  }

  _setupSearch() {
    const searchInput = this.shadowRoot.getElementById('search');
    searchInput.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase();
      this.shadowRoot.querySelectorAll('.check-item').forEach(item => {
        item.style.display = item.textContent.toLowerCase().includes(term) ? 'flex' : 'none';
      });
    });
  }

  _setupReordering() {
    const list = this.shadowRoot.getElementById('entityList');
    let draggedItem = null;

    list.addEventListener('dragstart', (e) => {
      draggedItem = e.target.closest('.check-item');
      if (!draggedItem.querySelector('label.toggle-switch input[type="checkbox"]:not(.entity-vol-toggle)')?.checked) { e.preventDefault(); return; }
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
        if (!draggedItem.querySelector('label.toggle-switch input[type="checkbox"]:not(.entity-vol-toggle)')?.checked) return;
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
      .filter(i => i.querySelector('label.toggle-switch input[type="checkbox"]:not(.entity-vol-toggle)')?.checked)
      .map(i => i.getAttribute('data-id'));
    this._updateConfig('entities', newOrder);
  }

  _setupListeners() {
    const root = this.shadowRoot;
    const list = root.getElementById('entityList');
    root.querySelectorAll('.check-item label.toggle-switch input[type="checkbox"]:not(.entity-vol-toggle)').forEach(cb => {
      cb.onchange = () => {
        const item = cb.closest('.check-item');
        if (!item) return;
        item.draggable = cb.checked;

        // Move newly-checked item to just after the last currently-checked item,
        // keeping selected entities at the top without triggering a re-render.
        if (cb.checked) {
          const allItems = Array.from(list.querySelectorAll('.check-item'));
          const lastChecked = allItems.filter(i => {
            const c = i.querySelector('label.toggle-switch input[type="checkbox"]:not(.entity-vol-toggle)');
            return c && c.checked && i !== item;
          }).pop();
          if (lastChecked) lastChecked.after(item);
          else list.prepend(item);
        }

        // Show/hide vol wrap
        const volWrap = item.querySelector('.entity-vol-wrap');
        if (volWrap) {
          volWrap.style.display = cb.checked ? 'flex' : 'none';
        }
        this._saveOrder();
      };
    });

    // Per-entity startup volume toggle — show/hide number input
    list.addEventListener('change', (e) => {
      const toggle = e.target.closest('.entity-vol-toggle');
      if (toggle) {
        const ent = toggle.dataset.ent;
        const row = toggle.closest('.entity-vol-wrap');
        const numInput = row.querySelector('.entity-vol-input');
        const pctLabel = row.querySelector('.entity-vol-pct');
        const overrides = { ...(this._config.entity_startup_volumes || {}) };
        if (toggle.checked) {
          numInput.style.display = 'block';
          pctLabel.style.display = 'inline';
          const n = Math.min(100, Math.max(0, parseInt(numInput.value) || 35));
          numInput.value = n;
          overrides[ent] = n;
        } else {
          numInput.style.display = 'none';
          pctLabel.style.display = 'none';
          numInput.value = '';
          delete overrides[ent];
        }
        this._updateConfig('entity_startup_volumes', overrides);
        return;
      }

      // Per-entity startup volume number input
      const input = e.target.closest('.entity-vol-input');
      if (!input) return;
      const ent = input.dataset.ent;
      const val = input.value.trim();
      const overrides = { ...(this._config.entity_startup_volumes || {}) };
      if (val === '') {
        delete overrides[ent];
      } else {
        const n = Math.min(100, Math.max(0, parseInt(val) || 0));
        overrides[ent] = n;
        input.value = n;
      }
      this._updateConfig('entity_startup_volumes', overrides);
    });
    root.getElementById('auto_switch').onchange = (e) => {
      this._updateConfig('auto_switch', e.target.checked);
      const row = root.getElementById('remember_last_entity_row');
      if (row) row.style.display = e.target.checked ? 'none' : '';
    };
    const rememberEl = root.getElementById('remember_last_entity');
    if (rememberEl) rememberEl.onchange = (e) => this._updateConfig('remember_last_entity', e.target.checked);
    root.getElementById('show_entity_selector').onchange = (e) => this._updateConfig('show_entity_selector', e.target.checked);
    root.getElementById('volume_control_btn').onchange   = (e) => this._updateConfig('volume_control', e.target.checked ? 'buttons' : 'slider');
    root.getElementById('show_vol_pct').onchange         = (e) => this._updateConfig('show_vol_pct', e.target.checked);
    root.getElementById('scroll_text').onchange          = (e) => this._updateConfig('scroll_text',   e.target.checked);
    ['compact','maximised','remote'].forEach(v => {
      const el = root.getElementById('sm_' + v);
      if (el) el.onchange = () => this._updateConfig('startup_mode', v);
    });
    root.getElementById('volume_entity').onchange = (e) => this._updateConfig('volume_entity', e.target.value);
    root.getElementById('tmdb_api_key').oninput = (e) => this._updateConfig('tmdb_api_key', e.target.value.trim());
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
    description: "A sleek media player with MA support, HomePod detection, device switching, and remote control."
  });
}
