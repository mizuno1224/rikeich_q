/* js/text-extractor.js */

/**
 * 解説HTMLからテキストを抽出して読み上げ可能な形式に変換
 */

/**
 * 解説コンテナからテキストセクションを抽出
 * @param {HTMLElement} container - 解説コンテナ
 * @returns {Array<{index: number, text: string, element: HTMLElement, heading: string}>} テキストセクションの配列
 */
function extractExplanationText(container) {
  var sections = [];
  var cards = container.querySelectorAll('.card');
  
  for (var i = 0; i < cards.length; i++) {
    var card = cards[i];
    
    // 見出しを取得
    var heading = card.querySelector('h3, h4');
    var headingText = heading ? heading.textContent.trim() : '';
    
    // 本文を取得
    var paragraphs = card.querySelectorAll('p');
    var text = headingText ? headingText + '。' : '';
    
    for (var j = 0; j < paragraphs.length; j++) {
      var p = paragraphs[j];
      
      // MathJax数式を読み上げ可能なテキストに変換
      var mathElements = p.querySelectorAll('.MathJax, [class*="MathJax"]');
      var paragraphText = p.textContent;
      
      for (var k = 0; k < mathElements.length; k++) {
        var math = mathElements[k];
        var mathText = convertMathToText(math);
        paragraphText = paragraphText.replace(math.textContent, mathText);
      }
      
      // 不要な空白や改行を整理
      paragraphText = paragraphText.replace(/\s+/g, ' ').trim();
      
      if (paragraphText) {
        text += paragraphText + '。';
      }
    }
    
    // box-noteやbox-alertの内容も追加
    var noteBoxes = card.querySelectorAll('.box-note, .box-alert');
    for (var m = 0; m < noteBoxes.length; m++) {
      var noteText = noteBoxes[m].textContent.replace(/\s+/g, ' ').trim();
      if (noteText) {
        text += noteText + '。';
      }
    }
    
    if (text.trim()) {
      sections.push({
        index: i,
        text: text.trim(),
        element: card,
        heading: headingText
      });
    }
  }
  
  return sections;
}

/**
 * MathJax数式を読み上げ可能なテキストに変換
 * @param {HTMLElement} mathElement - MathJax要素
 * @returns {string} 読み上げ用テキスト
 */
function convertMathToText(mathElement) {
  var text = mathElement.textContent || mathElement.innerText || '';
  
  // 基本的な数式記号の変換
  text = text
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1分の$2')
    .replace(/\\frac/g, '分数')
    .replace(/\^(\d+)/g, '$1乗')
    .replace(/\^\{([^}]+)\}/g, '$1乗')
    .replace(/_(\d+)/g, '下付き$1')
    .replace(/_\{([^}]+)\}/g, '下付き$1')
    .replace(/\\sqrt\{([^}]+)\}/g, 'ルート$1')
    .replace(/\\sqrt/g, 'ルート')
    .replace(/\\pi/g, 'パイ')
    .replace(/\\theta/g, 'シータ')
    .replace(/\\alpha/g, 'アルファ')
    .replace(/\\beta/g, 'ベータ')
    .replace(/\\gamma/g, 'ガンマ')
    .replace(/\\Delta/g, 'デルタ')
    .replace(/\\lambda/g, 'ラムダ')
    .replace(/\\mu/g, 'ミュー')
    .replace(/\\sigma/g, 'シグマ')
    .replace(/=/g, 'イコール')
    .replace(/\+/g, 'プラス')
    .replace(/-/g, 'マイナス')
    .replace(/\*/g, 'かける')
    .replace(/\//g, 'わる')
    .replace(/</g, '小なり')
    .replace(/>/g, '大なり')
    .replace(/≤/g, '以下')
    .replace(/≥/g, '以上')
    .replace(/≠/g, '等しくない')
    .replace(/≈/g, '約')
    .replace(/∞/g, '無限大')
    .replace(/∑/g, 'シグマ')
    .replace(/∫/g, '積分')
    .replace(/∂/g, '偏微分')
    .replace(/∇/g, 'ナブラ')
    .replace(/\{/g, '')
    .replace(/\}/g, '')
    .replace(/\\/g, '')
    .trim();
  
  return text || '数式';
}

/**
 * テキストを読み上げ用に最適化
 * @param {string} text - 元のテキスト
 * @returns {string} 最適化されたテキスト
 */
function optimizeTextForSpeech(text) {
  // 不要な記号を削除
  text = text
    .replace(/[【】『』「」]/g, '')
    .replace(/[()（）]/g, '、')
    .replace(/[\[\]]/g, '')
    .replace(/…/g, '、')
    .replace(/…/g, '、')
    .replace(/\s+/g, ' ')
    .trim();
  
  return text;
}
