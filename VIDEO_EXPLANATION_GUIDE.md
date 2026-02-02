# AI音声による解説動画作成ガイド

このドキュメントは、解説アプリにAI音声による解説動画機能を追加する方法を説明します。

## 📋 目次

1. [概要](#概要)
2. [実装方法の比較](#実装方法の比較)
3. [推奨実装方法](#推奨実装方法)
4. [詳細実装手順](#詳細実装手順)
5. [使用可能なTTSサービス](#使用可能なttsサービス)
6. [動画生成の実装](#動画生成の実装)
7. [統合方法](#統合方法)

---

## 概要

### 実現可能な機能

✅ **AI音声による解説動画の自動生成**
- 解説HTMLのテキストから音声を生成
- 画面操作（スクロール、ハイライト）と音声を同期
- 動画ファイルとして保存・再生

✅ **主な用途**
- 生徒が通学中に聞ける音声解説
- 視覚的な動画解説の提供
- アクセシビリティの向上

### 技術的な実現可能性

**✅ 完全に実現可能です**

現在の技術で以下の方法が利用可能：
1. **ブラウザベースの実装**（クライアントサイド）
2. **サーバーサイドの実装**（Firebase Functions等）
3. **ハイブリッド実装**（推奨）

---

## 実装方法の比較

### 方法1: ブラウザベース（クライアントサイド）

**メリット:**
- サーバーコストが不要
- リアルタイム生成が可能
- プライバシー保護（データが外部に送信されない）

**デメリット:**
- ブラウザの制約がある
- 品質が限定的
- 処理が重い

**使用技術:**
- Web Speech API（ブラウザ標準）
- MediaRecorder API（画面録画）
- Canvas API（動画生成）

### 方法2: サーバーサイド（Firebase Functions）

**メリット:**
- 高品質な音声生成
- 複数のTTSサービスを選択可能
- バッチ処理が可能

**デメリット:**
- サーバーコストが発生
- 生成に時間がかかる
- 実装が複雑

**使用技術:**
- Google Cloud Text-to-Speech
- Azure Text-to-Speech
- OpenAI TTS API
- FFmpeg（動画生成）

### 方法3: ハイブリッド（推奨）

**メリット:**
- 両方のメリットを活用
- 柔軟な実装が可能
- 段階的な実装が可能

**実装方針:**
- 音声生成：サーバーサイド（高品質）
- 動画生成：クライアントサイドまたはサーバーサイド

---

## 推奨実装方法

### フェーズ1: シンプルな音声再生機能

まずは音声のみの機能を実装し、その後動画機能を追加します。

**実装内容:**
1. 解説テキストの抽出
2. TTS APIで音声生成
3. 音声プレーヤーの追加
4. 再生とスクロールの同期

### フェーズ2: 動画生成機能

音声機能が動作したら、動画生成機能を追加します。

**実装内容:**
1. 画面操作の記録
2. 音声と画面の同期
3. 動画ファイルの生成
4. 動画の保存と再生

---

## 詳細実装手順

### ステップ1: 音声生成機能の追加

#### 1.1 解説テキストの抽出

```javascript
// js/video-generator.js を新規作成

/**
 * 解説HTMLからテキストを抽出
 * @param {HTMLElement} container - 解説コンテナ
 * @returns {Array<{text: string, element: HTMLElement}>} テキストと要素のペア
 */
function extractExplanationText(container) {
  const sections = [];
  const cards = container.querySelectorAll('.card');
  
  cards.forEach((card, index) => {
    // 見出しを取得
    const heading = card.querySelector('h3, h4');
    const headingText = heading ? heading.textContent.trim() : '';
    
    // 本文を取得（数式は読み上げ用テキストに変換）
    const paragraphs = card.querySelectorAll('p');
    let text = headingText ? headingText + '。' : '';
    
    paragraphs.forEach(p => {
      // MathJax数式を読み上げ可能なテキストに変換
      const mathElements = p.querySelectorAll('.MathJax');
      let paragraphText = p.textContent;
      
      mathElements.forEach(math => {
        const mathText = convertMathToText(math);
        paragraphText = paragraphText.replace(math.textContent, mathText);
      });
      
      text += paragraphText.trim() + '。';
    });
    
    if (text) {
      sections.push({
        index: index,
        text: text,
        element: card,
        heading: headingText
      });
    }
  });
  
  return sections;
}

/**
 * MathJax数式を読み上げ可能なテキストに変換
 * @param {HTMLElement} mathElement - MathJax要素
 * @returns {string} 読み上げ用テキスト
 */
function convertMathToText(mathElement) {
  // 簡単な変換例
  const text = mathElement.textContent;
  return text
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1分の$2')
    .replace(/\^(\d+)/g, '$1乗')
    .replace(/_(\d+)/g, '下付き$1')
    .replace(/\\sqrt\{([^}]+)\}/g, 'ルート$1')
    .replace(/\\pi/g, 'パイ')
    .replace(/\\theta/g, 'シータ')
    .replace(/\\alpha/g, 'アルファ')
    .replace(/\\beta/g, 'ベータ')
    .replace(/\\gamma/g, 'ガンマ')
    .replace(/=/g, 'イコール')
    .replace(/\+/g, 'プラス')
    .replace(/-/g, 'マイナス')
    .replace(/\*/g, 'かける')
    .replace(/\//g, 'わる');
}
```

#### 1.2 TTS APIの統合

```javascript
// js/tts-service.js を新規作成

/**
 * TTSサービス（複数のプロバイダーに対応）
 */
class TTSService {
  constructor(provider = 'browser') {
    this.provider = provider;
    this.synthesis = null;
    
    if (provider === 'browser' && 'speechSynthesis' in window) {
      this.synthesis = window.speechSynthesis;
    }
  }
  
  /**
   * テキストを音声に変換
   * @param {string} text - 読み上げるテキスト
   * @param {Object} options - オプション
   * @returns {Promise<Blob>} 音声データ
   */
  async synthesize(text, options = {}) {
    const defaultOptions = {
      lang: 'ja-JP',
      pitch: 1.0,
      rate: 1.0,
      volume: 1.0,
      voice: null
    };
    
    const opts = { ...defaultOptions, ...options };
    
    switch (this.provider) {
      case 'browser':
        return this.synthesizeBrowser(text, opts);
      case 'google':
        return this.synthesizeGoogle(text, opts);
      case 'openai':
        return this.synthesizeOpenAI(text, opts);
      default:
        throw new Error(`Unknown TTS provider: ${this.provider}`);
    }
  }
  
  /**
   * ブラウザ標準のWeb Speech APIを使用
   */
  synthesizeBrowser(text, options) {
    return new Promise((resolve, reject) => {
      if (!this.synthesis) {
        reject(new Error('Speech synthesis not supported'));
        return;
      }
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = options.lang;
      utterance.pitch = options.pitch;
      utterance.rate = options.rate;
      utterance.volume = options.volume;
      
      // 日本語音声を選択
      const voices = this.synthesis.getVoices();
      const japaneseVoice = voices.find(v => 
        v.lang.startsWith('ja') && v.name.includes('Japanese')
      );
      if (japaneseVoice) {
        utterance.voice = japaneseVoice;
      }
      
      // 音声データを取得するため、MediaRecorderを使用
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const mediaStreamDestination = audioContext.createMediaStreamDestination();
      const mediaRecorder = new MediaRecorder(mediaStreamDestination.stream);
      const chunks = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        resolve(blob);
      };
      
      // 注意: ブラウザのWeb Speech APIは直接Blobを返せないため、
      // 実際の実装ではサーバーサイドのTTSを使用することを推奨
      
      utterance.onend = () => {
        mediaRecorder.stop();
      };
      
      utterance.onerror = (e) => {
        reject(new Error('Speech synthesis failed: ' + e.error));
      };
      
      this.synthesis.speak(utterance);
      mediaRecorder.start();
    });
  }
  
  /**
   * Google Cloud Text-to-Speech APIを使用
   * （Firebase Functions経由）
   */
  async synthesizeGoogle(text, options) {
    const response = await fetch('/api/tts/google', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: text,
        languageCode: 'ja-JP',
        voiceName: 'ja-JP-Wavenet-A', // または 'ja-JP-Neural2-A'
        audioEncoding: 'MP3',
        pitch: options.pitch,
        speakingRate: options.rate
      })
    });
    
    if (!response.ok) {
      throw new Error('TTS API request failed');
    }
    
    return await response.blob();
  }
  
  /**
   * OpenAI TTS APIを使用
   */
  async synthesizeOpenAI(text, options) {
    const response = await fetch('/api/tts/openai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: text,
        model: 'tts-1',
        voice: 'alloy', // 'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'
        speed: options.rate
      })
    });
    
    if (!response.ok) {
      throw new Error('OpenAI TTS API request failed');
    }
    
    return await response.blob();
  }
}
```

#### 1.3 音声プレーヤーの追加

```javascript
// js/audio-player.js を新規作成

/**
 * 解説音声プレーヤー
 */
class ExplanationAudioPlayer {
  constructor(container) {
    this.container = container;
    this.audioElement = null;
    this.currentSection = 0;
    this.sections = [];
    this.isPlaying = false;
    this.audioBlobs = [];
  }
  
  /**
   * 解説セクションから音声を生成して再生
   */
  async generateAndPlay(sections) {
    this.sections = sections;
    this.audioBlobs = [];
    
    // 各セクションの音声を生成
    const ttsService = new TTSService('google'); // または 'openai'
    
    try {
      showLoading('音声を生成しています...');
      
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        const audioBlob = await ttsService.synthesize(section.text, {
          lang: 'ja-JP',
          rate: 1.0
        });
        this.audioBlobs.push(audioBlob);
      }
      
      // 音声を結合
      const combinedAudio = await this.combineAudioBlobs(this.audioBlobs);
      this.playAudio(combinedAudio);
      
      hideLoading();
    } catch (error) {
      console.error('Audio generation failed:', error);
      showError('音声の生成に失敗しました');
      hideLoading();
    }
  }
  
  /**
   * 複数の音声Blobを結合
   */
  async combineAudioBlobs(blobs) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffers = [];
    
    for (const blob of blobs) {
      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      audioBuffers.push(audioBuffer);
    }
    
    // 結合
    const totalLength = audioBuffers.reduce((sum, buf) => sum + buf.length, 0);
    const combinedBuffer = audioContext.createBuffer(
      audioBuffers[0].numberOfChannels,
      totalLength,
      audioBuffers[0].sampleRate
    );
    
    let offset = 0;
    for (const buffer of audioBuffers) {
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        combinedBuffer.getChannelData(channel).set(
          buffer.getChannelData(channel),
          offset
        );
      }
      offset += buffer.length;
    }
    
    // AudioBufferをBlobに変換
    return this.audioBufferToBlob(combinedBuffer);
  }
  
  /**
   * AudioBufferをBlobに変換
   */
  audioBufferToBlob(audioBuffer) {
    // WAV形式でエクスポート
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    
    const length = audioBuffer.length;
    const buffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
    const view = new DataView(buffer);
    
    // WAVヘッダー
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * numberOfChannels * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, length * numberOfChannels * 2, true);
    
    // 音声データ
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }
    
    return new Blob([buffer], { type: 'audio/wav' });
  }
  
  /**
   * 音声を再生
   */
  playAudio(audioBlob) {
    const url = URL.createObjectURL(audioBlob);
    this.audioElement = new Audio(url);
    
    this.audioElement.addEventListener('play', () => {
      this.isPlaying = true;
      this.updateUI();
    });
    
    this.audioElement.addEventListener('pause', () => {
      this.isPlaying = false;
      this.updateUI();
    });
    
    this.audioElement.addEventListener('ended', () => {
      this.isPlaying = false;
      this.updateUI();
    });
    
    this.audioElement.addEventListener('timeupdate', () => {
      this.syncScroll();
    });
    
    this.audioElement.play();
  }
  
  /**
   * スクロールと音声を同期
   */
  syncScroll() {
    if (!this.audioElement || this.sections.length === 0) return;
    
    const currentTime = this.audioElement.currentTime;
    const totalDuration = this.audioElement.duration;
    const progress = currentTime / totalDuration;
    
    // 現在のセクションを特定
    let accumulatedDuration = 0;
    for (let i = 0; i < this.sections.length; i++) {
      const sectionDuration = this.audioBlobs[i] ? 
        (this.audioBlobs[i].size / 16000) * 8 : 0; // 概算
      accumulatedDuration += sectionDuration;
      
      if (currentTime <= accumulatedDuration) {
        if (this.currentSection !== i) {
          this.currentSection = i;
          this.scrollToSection(i);
        }
        break;
      }
    }
  }
  
  /**
   * 指定セクションにスクロール
   */
  scrollToSection(index) {
    if (this.sections[index] && this.sections[index].element) {
      this.sections[index].element.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
      
      // ハイライト表示
      this.highlightSection(index);
    }
  }
  
  /**
   * セクションをハイライト
   */
  highlightSection(index) {
    // 既存のハイライトを削除
    this.sections.forEach(section => {
      section.element.classList.remove('audio-playing');
    });
    
    // 現在のセクションをハイライト
    if (this.sections[index]) {
      this.sections[index].element.classList.add('audio-playing');
    }
  }
  
  /**
   * UIを更新
   */
  updateUI() {
    const playButton = document.getElementById('audio-play-btn');
    const pauseButton = document.getElementById('audio-pause-btn');
    
    if (playButton) playButton.style.display = this.isPlaying ? 'none' : 'inline';
    if (pauseButton) pauseButton.style.display = this.isPlaying ? 'inline' : 'none';
  }
  
  pause() {
    if (this.audioElement) {
      this.audioElement.pause();
    }
  }
  
  resume() {
    if (this.audioElement) {
      this.audioElement.play();
    }
  }
  
  stop() {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
    }
    this.isPlaying = false;
    this.updateUI();
  }
}
```

---

## 使用可能なTTSサービス

### 1. Google Cloud Text-to-Speech（推奨）

**メリット:**
- 高品質な日本語音声
- 自然な発音
- Firebaseとの統合が容易

**料金:**
- 最初の100万文字/月は無料
- その後 $4.00 / 100万文字

**実装例:**
```javascript
// Firebase Functions
const textToSpeech = require('@google-cloud/text-to-speech');
const client = new textToSpeech.TextToSpeechClient();

exports.generateTTS = functions.https.onCall(async (data, context) => {
  const request = {
    input: { text: data.text },
    voice: { 
      languageCode: 'ja-JP',
      name: 'ja-JP-Wavenet-A',
      ssmlGender: 'NEUTRAL'
    },
    audioConfig: { 
      audioEncoding: 'MP3',
      speakingRate: data.rate || 1.0
    }
  };
  
  const [response] = await client.synthesizeSpeech(request);
  return response.audioContent.toString('base64');
});
```

### 2. OpenAI TTS API

**メリット:**
- 非常に自然な音声
- シンプルなAPI
- 複数の音声スタイル

**料金:**
- $15.00 / 100万文字

**実装例:**
```javascript
const response = await fetch('https://api.openai.com/v1/audio/speech', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${OPENAI_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'tts-1',
    input: text,
    voice: 'alloy',
    speed: 1.0
  })
});
```

### 3. Azure Text-to-Speech

**メリット:**
- 高品質
- カスタム音声対応

**料金:**
- 最初の50万文字/月は無料
- その後 $15.00 / 100万文字

### 4. ブラウザ標準（Web Speech API）

**メリット:**
- 無料
- 追加設定不要

**デメリット:**
- 品質が限定的
- ブラウザ依存
- 音声データの取得が困難

---

## 動画生成の実装

### 方法1: MediaRecorder API（ブラウザ録画）

```javascript
// js/video-recorder.js

class ExplanationVideoRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.audioPlayer = null;
  }
  
  /**
   * 解説動画を録画
   */
  async startRecording(container, audioPlayer) {
    this.audioPlayer = audioPlayer;
    
    // 画面キャプチャを取得
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { 
        mediaSource: 'screen',
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: true
    });
    
    // MediaRecorderで録画
    this.mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9'
    });
    
    this.recordedChunks = [];
    
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };
    
    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
      this.downloadVideo(blob);
    };
    
    // 音声再生と同時に録画開始
    this.mediaRecorder.start();
    audioPlayer.resume();
    
    // 音声終了時に録画停止
    audioPlayer.audioElement.addEventListener('ended', () => {
      this.stopRecording();
    });
  }
  
  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }
  
  downloadVideo(blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `explanation-${Date.now()}.webm`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
```

### 方法2: Canvas + FFmpeg（サーバーサイド）

より高品質な動画を生成する場合は、サーバーサイドでFFmpegを使用します。

```javascript
// Firebase Functions
const ffmpeg = require('fluent-ffmpeg');
const { Storage } = require('@google-cloud/storage');

exports.generateVideo = functions.https.onCall(async (data, context) => {
  // 1. 音声ファイルを取得
  const audioBuffer = Buffer.from(data.audioBase64, 'base64');
  
  // 2. 画面キャプチャ画像を取得（事前に保存）
  const screenshots = data.screenshots; // Base64画像の配列
  
  // 3. FFmpegで動画を生成
  const outputPath = `/tmp/output-${Date.now()}.mp4`;
  
  await new Promise((resolve, reject) => {
    ffmpeg()
      .input(audioBuffer)
      .inputFPS(1)
      .inputFormat('mp3')
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions([
        '-pix_fmt yuv420p',
        '-r 30'
      ])
      .on('end', resolve)
      .on('error', reject)
      .save(outputPath);
  });
  
  // 4. 動画をアップロード
  const storage = new Storage();
  const bucket = storage.bucket('your-bucket-name');
  await bucket.upload(outputPath);
  
  return { videoUrl: `gs://your-bucket-name/${outputPath}` };
});
```

---

## 統合方法

### viewer.htmlへの統合

```html
<!-- viewer.html に追加 -->
<div class="audio-controls" style="position: fixed; bottom: 20px; right: 20px; z-index: 1000;">
  <button id="audio-generate-btn" class="btn-audio">🎤 音声生成</button>
  <button id="audio-play-btn" class="btn-audio" style="display: none;">▶️ 再生</button>
  <button id="audio-pause-btn" class="btn-audio" style="display: none;">⏸️ 一時停止</button>
  <button id="video-record-btn" class="btn-audio">📹 動画録画</button>
</div>
```

```javascript
// js/viewer.js に追加

let audioPlayer = null;
let videoRecorder = null;

document.addEventListener('DOMContentLoaded', () => {
  // ... 既存のコード ...
  
  // 音声生成ボタン
  const generateBtn = document.getElementById('audio-generate-btn');
  if (generateBtn) {
    generateBtn.addEventListener('click', async () => {
      const container = document.getElementById('text-target');
      const sections = extractExplanationText(container);
      
      audioPlayer = new ExplanationAudioPlayer(container);
      await audioPlayer.generateAndPlay(sections);
    });
  }
  
  // 動画録画ボタン
  const recordBtn = document.getElementById('video-record-btn');
  if (recordBtn) {
    recordBtn.addEventListener('click', async () => {
      if (!audioPlayer) {
        alert('まず音声を生成してください');
        return;
      }
      
      videoRecorder = new ExplanationVideoRecorder();
      const container = document.getElementById('text-target');
      await videoRecorder.startRecording(container, audioPlayer);
    });
  }
});
```

### CSSの追加

```css
/* css/viewer.css に追加 */

.audio-controls {
  display: flex;
  gap: 10px;
  background: white;
  padding: 15px;
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.btn-audio {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  background: #3b82f6;
  color: white;
  cursor: pointer;
  font-size: 14px;
}

.btn-audio:hover {
  background: #2563eb;
}

.card.audio-playing {
  background: #fef3c7;
  border-left: 4px solid #f59e0b;
  transition: background 0.3s;
}
```

---

## 実装の優先順位

### フェーズ1: 音声再生機能（1-2週間）
1. テキスト抽出機能
2. TTS API統合（Google Cloud TTS推奨）
3. 音声プレーヤー
4. スクロール同期

### フェーズ2: 動画生成機能（2-3週間）
1. MediaRecorder API実装
2. 音声と画面の同期
3. 動画ダウンロード機能

### フェーズ3: 高度な機能（1-2週間）
1. 動画のクラウド保存
2. 動画の共有機能
3. 品質の最適化

---

## コスト見積もり

### Google Cloud TTS
- **無料枠**: 100万文字/月
- **追加**: $4.00 / 100万文字
- **例**: 1問題あたり約2000文字 → 500問題/月まで無料

### ストレージ（動画）
- **Firebase Storage**: $0.026 / GB/月
- **動画サイズ**: 約10MB/問題（5分動画想定）
- **100問題**: 約1GB → $0.026/月

---

## まとめ

✅ **AI音声による解説動画は完全に実現可能です**

**推奨実装:**
1. **音声生成**: Google Cloud Text-to-Speech（高品質・低コスト）
2. **動画生成**: MediaRecorder API（簡単）またはFFmpeg（高品質）
3. **統合**: 既存のviewer.htmlに統合

**次のステップ:**
1. Firebase FunctionsでTTS APIを実装
2. 音声プレーヤーを追加
3. 動画録画機能を追加

実装を開始する場合は、どの部分から始めますか？
