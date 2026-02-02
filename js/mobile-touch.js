/* js/mobile-touch.js - モバイルタッチ操作の改善 */

(function() {
  'use strict';

  // タッチ操作の状態管理
  var touchState = {
    startX: 0,
    startY: 0,
    startTime: 0,
    isScrolling: false,
    threshold: 50, // スワイプ判定の閾値（px）
    timeThreshold: 300 // スワイプ判定の時間閾値（ms）
  };

  // ピンチズームの制御
  function preventPinchZoom(e) {
    if (e.touches.length > 1) {
      e.preventDefault();
    }
  }

  // スワイプジェスチャーの検出
  function handleTouchStart(e) {
    if (e.touches.length === 1) {
      touchState.startX = e.touches[0].clientX;
      touchState.startY = e.touches[0].clientY;
      touchState.startTime = Date.now();
      touchState.isScrolling = false;
    }
  }

  function handleTouchMove(e) {
    if (e.touches.length === 1 && touchState.startX !== 0) {
      var deltaX = Math.abs(e.touches[0].clientX - touchState.startX);
      var deltaY = Math.abs(e.touches[0].clientY - touchState.startY);
      
      // 縦スクロールの場合はスワイプとして扱わない
      if (deltaY > deltaX) {
        touchState.isScrolling = true;
      }
    }
  }

  function handleTouchEnd(e) {
    if (touchState.startX === 0 || touchState.isScrolling) {
      resetTouchState();
      return;
    }

    if (e.changedTouches.length === 1) {
      var endX = e.changedTouches[0].clientX;
      var endY = e.changedTouches[0].clientY;
      var deltaX = endX - touchState.startX;
      var deltaY = endY - touchState.startY;
      var deltaTime = Date.now() - touchState.startTime;

      // スワイプ判定
      if (deltaTime < touchState.timeThreshold) {
        var absDeltaX = Math.abs(deltaX);
        var absDeltaY = Math.abs(deltaY);

        if (absDeltaX > touchState.threshold && absDeltaX > absDeltaY) {
          // 横スワイプ
          if (deltaX > 0) {
            handleSwipeRight();
          } else {
            handleSwipeLeft();
          }
        } else if (absDeltaY > touchState.threshold && absDeltaY > absDeltaX) {
          // 縦スワイプ（下方向のみ）
          if (deltaY > 0) {
            // 下方向のスワイプは通常のスクロールとして扱う
          }
        }
      }
    }

    resetTouchState();
  }

  function resetTouchState() {
    touchState.startX = 0;
    touchState.startY = 0;
    touchState.startTime = 0;
    touchState.isScrolling = false;
  }

  // スワイプハンドラー（必要に応じてカスタマイズ）
  function handleSwipeLeft() {
    // 左スワイプ: 次の問題へ（実装が必要な場合）
    console.log('Swipe left detected');
  }

  function handleSwipeRight() {
    // 右スワイプ: 前の問題へ、または戻る
    var backButton = document.querySelector('.btn-back-circle');
    if (backButton) {
      backButton.click();
    }
  }

  // シミュレーションキャンバスのタッチ操作最適化
  function optimizeSimulationTouch() {
    var simEmbeds = document.querySelectorAll('.sim-embed');
    
    simEmbeds.forEach(function(simEmbed) {
      var canvas = simEmbed.querySelector('canvas');
      if (canvas) {
        // タッチイベントの最適化
        canvas.addEventListener('touchstart', function(e) {
          // シミュレーション内のタッチは通常の処理を許可
          e.stopPropagation();
        }, { passive: true });

        canvas.addEventListener('touchmove', function(e) {
          // シミュレーション内のドラッグを許可
          e.stopPropagation();
        }, { passive: false });

        canvas.addEventListener('touchend', function(e) {
          e.stopPropagation();
        }, { passive: true });
      }
    });
  }

  // タッチターゲットサイズの確認と調整
  function ensureTouchTargetSize() {
    var interactiveElements = document.querySelectorAll(
      'button, a, input[type="button"], input[type="submit"], .btn-reaction, .btn-sm, .tab-btn'
    );

    interactiveElements.forEach(function(element) {
      var rect = element.getBoundingClientRect();
      var minSize = 44; // 最小タッチターゲットサイズ（px）

      if (rect.width < minSize || rect.height < minSize) {
        // サイズが小さい場合は、視覚的なサイズを維持しつつタッチ領域を拡大
        element.style.minWidth = minSize + 'px';
        element.style.minHeight = minSize + 'px';
      }
    });
  }

  // 初期化
  function initMobileTouch() {
    // モバイルデバイスの検出
    var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                   (window.innerWidth <= 768);

    if (isMobile) {
      // ピンチズームの制御（シミュレーションエリア以外）
      document.addEventListener('touchstart', preventPinchZoom, { passive: false });
      document.addEventListener('touchmove', preventPinchZoom, { passive: false });

      // スワイプジェスチャーの検出（解説エリアのみ）
      var explanationArea = document.querySelector('.explanation-area');
      if (explanationArea) {
        explanationArea.addEventListener('touchstart', handleTouchStart, { passive: true });
        explanationArea.addEventListener('touchmove', handleTouchMove, { passive: true });
        explanationArea.addEventListener('touchend', handleTouchEnd, { passive: true });
      }

      // シミュレーションのタッチ操作最適化
      optimizeSimulationTouch();

      // タッチターゲットサイズの確保
      ensureTouchTargetSize();

      // 動的に追加される要素にも対応
      var observer = new MutationObserver(function(mutations) {
        optimizeSimulationTouch();
        ensureTouchTargetSize();
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  }

  // DOMContentLoaded時に初期化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileTouch);
  } else {
    initMobileTouch();
  }

  // リサイズ時にも再チェック
  window.addEventListener('resize', function() {
    ensureTouchTargetSize();
  }, { passive: true });

})();
