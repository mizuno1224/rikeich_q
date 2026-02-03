/* js/pointer.js */

function getScrollParent(el) {
  while (el && el !== document.body) {
    const s = getComputedStyle(el);
    const overflow = s.overflow + s.overflowY + s.overflowX;
    if (/auto|scroll|overlay/.test(overflow)) return el;
    el = el.parentElement;
  }
  return document.documentElement;
}

class LaserPointer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;

    this.ctx = this.canvas.getContext("2d");
    this.container = this.canvas.parentElement;
    this.scrollParent = this.container ? getScrollParent(this.container) : document.documentElement;

    this.strokes = [];
    this.isDrawing = false;
    this.penStrokeActive = false;

    this.color = "#f43f5e";
    this.fadeDelay = 1000;
    this.fadeDuration = 500;

    this.lastInputTime = 0;
    this.opacity = 0;
    this.state = "idle";

    this.resize();
    window.addEventListener("resize", () => this.resize());
    if (this.container) {
      const ro = new ResizeObserver(() => this.resize());
      ro.observe(this.container);
    }
    this.addGlobalEvents();

    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  /** ビューポート座標を解説コンテンツ座標に変換（スクロールに張り付く） */
  clientToContent(clientX, clientY) {
    if (!this.container) return { x: clientX, y: clientY };
    const rect = this.container.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    // スクロール親がこのコンテナの直親（例: viewer-container）ならスクロール量を足す
    const isDirectScrollContent = this.scrollParent && this.container.parentElement === this.scrollParent;
    const scrollLeft = (isDirectScrollContent && this.scrollParent.scrollLeft) || 0;
    const scrollTop = (isDirectScrollContent && this.scrollParent.scrollTop) || 0;
    return {
      x: x + scrollLeft,
      y: y + scrollTop,
    };
  }

  resize() {
    if (!this.canvas || !this.container) return;
    const w = this.container.scrollWidth || this.container.offsetWidth || 800;
    const h = this.container.scrollHeight || this.container.offsetHeight || 600;
    this.contentWidth = w;
    this.contentHeight = h;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = w + "px";
    this.canvas.style.height = h + "px";
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  clear() {
    this.strokes = [];
    this.isDrawing = false;
    this.state = "idle";
    this.opacity = 0;
    const w = this.contentWidth != null ? this.contentWidth : this.canvas.width;
    const h = this.contentHeight != null ? this.contentHeight : this.canvas.height;
    this.ctx.clearRect(0, 0, w, h);
  }

  isPointerMode() {
    return document.body.classList.contains("pointer-active");
  }

  isPenEvent(e) {
    return e.pointerType === "pen";
  }

  addGlobalEvents() {
    const handleStart = (e) => {
      if (!this.isPointerMode()) return;
      // ポインターモード時はタッチペンの操作でスクロールさせない（画面ズレ防止）
      if (this.isPenEvent(e)) {
        e.preventDefault();
      }
      if (this.shouldDraw(e)) {
        this.penStrokeActive = true;
        const target = e.target && e.target.setPointerCapture ? e.target : document.body;
        try {
          if (typeof target.setPointerCapture === "function") target.setPointerCapture(e.pointerId);
        } catch (err) {}
        this.activePointerId = e.pointerId;
        this.startStroke(e.clientX, e.clientY);
      }
    };

    const handleMove = (e) => {
      if (!this.isPointerMode()) return;
      // タッチペンの移動は常にスクロールを抑止（描画専用・画面ズレ防止）
      if (this.isPenEvent(e)) {
        e.preventDefault();
      }
      if (this.isDrawing && e.pointerId === this.activePointerId) {
        if (e.pointerType === "mouse" && e.buttons === 0) {
          this.endStroke();
          this.activePointerId = null;
          return;
        }
        this.addPoint(e.clientX, e.clientY);
      }
    };

    const handleEnd = (e) => {
      if (this.isPointerMode() && this.isPenEvent(e)) e.preventDefault();
      if (e.pointerId === this.activePointerId) {
        this.endStroke();
        this.activePointerId = null;
        this.penStrokeActive = false;
      }
    };

    const handleCancel = (e) => {
      if (this.isPointerMode() && this.isPenEvent(e)) e.preventDefault();
      if (e.pointerId === this.activePointerId) {
        this.endStroke();
        this.activePointerId = null;
        this.penStrokeActive = false;
      }
    };

    // タッチがスタイラスか（Safari: touchType "stylus" / "eraser"）
    const isStylusTouch = (e) => {
      const list = (e.type === "touchend" || e.type === "touchcancel") ? e.changedTouches : (e.touches || []);
      if (!list.length) return false;
      for (let i = 0; i < list.length; i++) {
        const t = list[i];
        if (t.touchType === "stylus" || t.touchType === "eraser") return true;
      }
      return false;
    };

    // ポインターモード時: スタイラスの touch を抑止。左端スワイプ（戻る）も抑止
    const LEFT_EDGE_PX = 80;
    const isLeftEdge = (e) => {
      const list = e.touches && e.touches.length ? e.touches : e.changedTouches;
      if (!list || !list.length) return false;
      return list[0].clientX < LEFT_EDGE_PX;
    };
    // 左端で始まったタッチの identifier を保持し、move/end まで抑止（解説ページで戻るジェスチャー完全廃止）
    let leftEdgeTouchIds = new Set();
    const handleTouchStart = (e) => {
      if (this.isPointerMode() && isStylusTouch(e)) { e.preventDefault(); return; }
      if (isLeftEdge(e)) {
        const list = e.changedTouches && e.changedTouches.length ? e.changedTouches : e.touches;
        if (list) {
          for (let i = 0; i < list.length; i++) {
            if (list[i].clientX < LEFT_EDGE_PX) leftEdgeTouchIds.add(list[i].identifier);
          }
        }
        e.preventDefault();
      }
    };
    const isLeftEdgeTouch = (e) => {
      const check = (list) => {
        if (!list || !list.length) return false;
        for (let i = 0; i < list.length; i++) {
          if (leftEdgeTouchIds.has(list[i].identifier)) return true;
        }
        return false;
      };
      return check(e.touches) || check(e.changedTouches);
    };
    const handleTouchMove = (e) => {
      if (this.isPointerMode() && isStylusTouch(e)) { e.preventDefault(); return; }
      if (isLeftEdgeTouch(e)) e.preventDefault();
    };
    const handleTouchEnd = (e) => {
      if (this.isPointerMode() && isStylusTouch(e)) { e.preventDefault(); return; }
      if (isLeftEdgeTouch(e)) e.preventDefault();
      if (e.changedTouches) {
        for (let i = 0; i < e.changedTouches.length; i++) {
          leftEdgeTouchIds.delete(e.changedTouches[i].identifier);
        }
      }
    };

    const capture = { passive: false, capture: true };
    window.addEventListener("pointerdown", handleStart, capture);
    window.addEventListener("pointermove", handleMove, capture);
    window.addEventListener("pointerup", handleEnd, capture);
    window.addEventListener("pointercancel", handleCancel, capture);
    document.addEventListener("touchstart", handleTouchStart, capture);
    document.addEventListener("touchmove", handleTouchMove, capture);
    document.addEventListener("touchend", handleTouchEnd, capture);
    document.addEventListener("touchcancel", handleTouchEnd, capture);
  }

  shouldDraw(e) {
    const isActive = document.body.classList.contains("pointer-active");
    if (!isActive) return false;

    // タッチペンのときのみポインターで描画。指タッチは反応させずスクロールに使う
    if (e.pointerType === "pen") return true;
    // PCではマウスでも描画可能
    if (e.pointerType === "mouse") return true;
    return false;
  }

  startStroke(clientX, clientY) {
    const { x, y } = this.clientToContent(clientX, clientY);
    this.isDrawing = true;
    this.lastInputTime = Date.now();

    if (this.state === "fading" || this.state === "idle") {
      this.state = "active";
      this.opacity = 1.0;
      if (this.strokes.length > 0 && this.opacity <= 0.05) {
        this.strokes = [];
      }
    }
    this.strokes.push([{ x, y }]);
  }

  addPoint(clientX, clientY) {
    const { x, y } = this.clientToContent(clientX, clientY);
    this.lastInputTime = Date.now();
    const currentStroke = this.strokes[this.strokes.length - 1];
    if (!currentStroke) return;

    const lastPt = currentStroke[currentStroke.length - 1];
    const dist = Math.hypot(lastPt.x - x, lastPt.y - y);
    // タッチペン・タッチデバイスは点が粗いので閾値を下げてなめらかに
    const minDist = 1;
    if (dist >= minDist) {
      currentStroke.push({ x, y });
    }
  }

  endStroke() {
    if (this.isDrawing) {
      this.isDrawing = false;
      this.lastInputTime = Date.now();
    }
  }

  loop() {
    const w = this.contentWidth != null ? this.contentWidth : this.canvas.width;
    const h = this.contentHeight != null ? this.contentHeight : this.canvas.height;
    this.ctx.clearRect(0, 0, w, h);
    const now = Date.now();

    if (this.state === "active") {
      if (!this.isDrawing && now - this.lastInputTime > this.fadeDelay) {
        this.state = "fading";
      }
    } else if (this.state === "fading") {
      const timeSinceFadeStart = now - (this.lastInputTime + this.fadeDelay);
      const progress = timeSinceFadeStart / this.fadeDuration;
      this.opacity = 1.0 - progress;

      if (this.opacity <= 0) {
        this.opacity = 0;
        this.strokes = [];
        this.state = "idle";
      }
    }

    if (this.strokes.length > 0 && this.opacity > 0) {
      this.ctx.lineCap = "round";
      this.ctx.lineJoin = "round";
      this.ctx.shadowBlur = 8;
      this.ctx.shadowColor = this.color;
      this.ctx.strokeStyle = `rgba(244, 63, 94, ${this.opacity})`;
      this.ctx.lineWidth = 4;

      this.ctx.beginPath();
      for (const stroke of this.strokes) {
        if (stroke.length < 2) continue;
        this.ctx.moveTo(stroke[0].x, stroke[0].y);
        for (let i = 1; i < stroke.length - 2; i++) {
          const p1 = stroke[i];
          const p2 = stroke[i + 1];
          const mx = (p1.x + p2.x) / 2;
          const my = (p1.y + p2.y) / 2;
          this.ctx.quadraticCurveTo(p1.x, p1.y, mx, my);
        }
        const last = stroke[stroke.length - 1];
        const secondLast = stroke[stroke.length - 2];
        if (stroke.length > 2) {
          this.ctx.quadraticCurveTo(secondLast.x, secondLast.y, last.x, last.y);
        } else {
          this.ctx.lineTo(last.x, last.y);
        }
      }
      this.ctx.stroke();
    }
    requestAnimationFrame(this.loop);
  }
}
