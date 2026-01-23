/* js/pointer.js */

class LaserPointer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    
    this.ctx = this.canvas.getContext('2d');
    
    // ストローク管理
    this.strokes = [];
    this.isDrawing = false;
    
    // 設定
    this.color = '#f43f5e'; // レーザー色
    this.fadeDelay = 1000;  // 書き終わってから消え始めるまで(ms)
    this.fadeDuration = 500; // フェードアウト時間(ms)
    
    // 状態管理
    this.lastInputTime = 0;
    this.opacity = 0;
    this.state = 'idle';

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.addGlobalEvents();

    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  addGlobalEvents() {
    const handleStart = (e) => {
      if (this.shouldDraw(e)) {
        // ★重要: スクロールを防止して描画を開始
        e.preventDefault();
        this.startStroke(e.clientX, e.clientY);
      }
    };

    const handleMove = (e) => {
      if (this.isDrawing) {
        e.preventDefault();
        if (e.pointerType === 'mouse' && e.buttons === 0) {
          this.endStroke();
          return;
        }
        this.addPoint(e.clientX, e.clientY);
      }
    };

    const handleEnd = () => this.endStroke();

    // Pointer Events API (Windowレベルでキャッチ)
    window.addEventListener('pointerdown', handleStart, { passive: false });
    window.addEventListener('pointermove', handleMove, { passive: false });
    window.addEventListener('pointerup', handleEnd);
    window.addEventListener('pointercancel', handleEnd);
  }

  shouldDraw(e) {
    // ★変更: bodyに 'pointer-active' クラスがある時だけ描画
    const isActive = document.body.classList.contains('pointer-active');
    if (!isActive) return false;

    // ペン または マウスのみ (マルチタッチ誤動作防止のためタッチは除外推奨だが、指で書きたい場合は許可する)
    // ここではペンとマウス、および明示的な指タッチを許可
    return (e.pointerType === 'pen' || e.pointerType === 'mouse' || e.pointerType === 'touch');
  }

  startStroke(x, y) {
    this.isDrawing = true;
    this.lastInputTime = Date.now();
    
    if (this.state === 'fading' || this.state === 'idle') {
      this.state = 'active';
      this.opacity = 1.0;
      if (this.strokes.length > 0 && this.opacity <= 0.05) {
        this.strokes = [];
      }
    }
    this.strokes.push([{ x, y }]);
  }

  addPoint(x, y) {
    this.lastInputTime = Date.now();
    const currentStroke = this.strokes[this.strokes.length - 1];
    if (!currentStroke) return;

    const lastPt = currentStroke[currentStroke.length - 1];
    const dist = Math.hypot(lastPt.x - x, lastPt.y - y);
    if (dist > 2) {
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
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const now = Date.now();

    if (this.state === 'active') {
      if (!this.isDrawing && (now - this.lastInputTime > this.fadeDelay)) {
        this.state = 'fading';
      }
    } else if (this.state === 'fading') {
      const timeSinceFadeStart = now - (this.lastInputTime + this.fadeDelay);
      const progress = timeSinceFadeStart / this.fadeDuration;
      this.opacity = 1.0 - progress;

      if (this.opacity <= 0) {
        this.opacity = 0;
        this.strokes = [];
        this.state = 'idle';
      }
    }

    if (this.strokes.length > 0 && this.opacity > 0) {
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
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