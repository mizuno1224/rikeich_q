/* js/audio-player.js */

/**
 * 解説音声プレーヤー
 * ブラウザ標準のWeb Speech APIを使用
 */

function ExplanationAudioPlayer(container) {
  this.container = container;
  this.synthesis = null;
  this.currentUtterance = null;
  this.currentSection = 0;
  this.sections = [];
  this.isPlaying = false;
  this.onSectionChange = null;
  
  // Web Speech APIの初期化
  if ('speechSynthesis' in window) {
    this.synthesis = window.speechSynthesis;
    
    // 音声リストの読み込みを待つ（Chrome等で必要）
    if (this.synthesis.getVoices().length === 0) {
      var self = this;
      this.synthesis.addEventListener('voiceschanged', function() {
        self.onVoicesReady();
      }, { once: true });
    } else {
      this.onVoicesReady();
    }
  } else {
    console.warn('Web Speech API is not supported in this browser');
  }
}

/**
 * 音声リストが準備できたときの処理
 */
ExplanationAudioPlayer.prototype.onVoicesReady = function() {
  // 日本語音声を探す
  var voices = this.synthesis.getVoices();
  var japaneseVoice = null;
  
  for (var i = 0; i < voices.length; i++) {
    var voice = voices[i];
    if (voice.lang.startsWith('ja')) {
      japaneseVoice = voice;
      // より自然な音声を優先
      if (voice.name.indexOf('Google') !== -1 || voice.name.indexOf('Enhanced') !== -1) {
        break;
      }
    }
  }
  
  this.japaneseVoice = japaneseVoice;
};

/**
 * 解説セクションから音声を再生
 * @param {Array} sections - テキストセクションの配列
 */
ExplanationAudioPlayer.prototype.play = function(sections) {
  if (!this.synthesis) {
    this.showError('このブラウザでは音声再生に対応していません');
    return;
  }
  
  this.sections = sections;
  this.currentSection = 0;
  this.isPlaying = true;
  this.updateUI();
  
  this.playSection(0);
};

/**
 * 指定されたセクションを再生
 * @param {number} index - セクションのインデックス
 */
ExplanationAudioPlayer.prototype.playSection = function(index) {
  if (index >= this.sections.length) {
    // すべてのセクションを再生完了
    this.isPlaying = false;
    this.updateUI();
    this.highlightSection(-1);
    return;
  }
  
  var section = this.sections[index];
  this.currentSection = index;
  
  // セクションにスクロール
  this.scrollToSection(index);
  this.highlightSection(index);
  
  // テキストを最適化
  var text = optimizeTextForSpeech(section.text);
  
  // 音声を生成
  var utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ja-JP';
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;
  
  if (this.japaneseVoice) {
    utterance.voice = this.japaneseVoice;
  }
  
  var self = this;
  
  utterance.onend = function() {
    // 次のセクションを再生
    self.playSection(index + 1);
  };
  
  utterance.onerror = function(event) {
    console.error('Speech synthesis error:', event.error);
    self.showError('音声の再生に失敗しました: ' + event.error);
    self.isPlaying = false;
    self.updateUI();
  };
  
  this.currentUtterance = utterance;
  this.synthesis.speak(utterance);
};

/**
 * 指定セクションにスクロール
 * @param {number} index - セクションのインデックス
 */
ExplanationAudioPlayer.prototype.scrollToSection = function(index) {
  if (this.sections[index] && this.sections[index].element) {
    var element = this.sections[index].element;
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  }
};

/**
 * セクションをハイライト
 * @param {number} index - セクションのインデックス
 */
ExplanationAudioPlayer.prototype.highlightSection = function(index) {
  // 既存のハイライトを削除
  for (var i = 0; i < this.sections.length; i++) {
    if (this.sections[i].element) {
      this.sections[i].element.classList.remove('audio-playing');
    }
  }
  
  // 現在のセクションをハイライト
  if (index >= 0 && this.sections[index] && this.sections[index].element) {
    this.sections[index].element.classList.add('audio-playing');
  }
};

/**
 * 再生を一時停止
 */
ExplanationAudioPlayer.prototype.pause = function() {
  if (this.synthesis && this.isPlaying) {
    this.synthesis.pause();
    this.isPlaying = false;
    this.updateUI();
  }
};

/**
 * 再生を再開
 */
ExplanationAudioPlayer.prototype.resume = function() {
  if (this.synthesis && !this.isPlaying && this.currentUtterance) {
    this.synthesis.resume();
    this.isPlaying = true;
    this.updateUI();
  }
};

/**
 * 再生を停止
 */
ExplanationAudioPlayer.prototype.stop = function() {
  if (this.synthesis) {
    this.synthesis.cancel();
  }
  this.isPlaying = false;
  this.currentSection = 0;
  this.currentUtterance = null;
  this.highlightSection(-1);
  this.updateUI();
};

/**
 * UIを更新
 */
ExplanationAudioPlayer.prototype.updateUI = function() {
  var playButton = document.getElementById('audio-play-btn');
  var pauseButton = document.getElementById('audio-pause-btn');
  var stopButton = document.getElementById('audio-stop-btn');
  var progressBar = document.getElementById('audio-progress');
  
  if (playButton) {
    playButton.style.display = this.isPlaying ? 'none' : 'inline-block';
  }
  if (pauseButton) {
    pauseButton.style.display = this.isPlaying ? 'inline-block' : 'none';
  }
  if (stopButton) {
    stopButton.disabled = !this.isPlaying && this.currentSection === 0;
  }
  
  // 進捗バーの更新
  if (progressBar && this.sections.length > 0) {
    var progress = ((this.currentSection + 1) / this.sections.length) * 100;
    progressBar.style.width = progress + '%';
  }
};

/**
 * エラーメッセージを表示
 * @param {string} message - エラーメッセージ
 */
ExplanationAudioPlayer.prototype.showError = function(message) {
  var errorDiv = document.getElementById('audio-error');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(function() {
      errorDiv.style.display = 'none';
    }, 5000);
  } else {
    alert(message);
  }
};
