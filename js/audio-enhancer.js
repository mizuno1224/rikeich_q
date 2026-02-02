/* js/audio-enhancer.js */

/**
 * 解説テキストを音声用に強化
 * 補足説明や注目点を明示しながら解説音声を生成
 */

/**
 * 解説テキストを教育的な音声用テキストに変換
 * @param {HTMLElement} container - 解説コンテナ
 * @returns {Array<{index: number, text: string, element: HTMLElement, heading: string}>} 強化されたテキストセクションの配列
 */
function enhanceExplanationForAudio(container) {
  var sections = [];
  var cards = container.querySelectorAll('.card');
  
  for (var i = 0; i < cards.length; i++) {
    var card = cards[i];
    
    // 見出しを取得
    var heading = card.querySelector('h3, h4');
    var headingText = heading ? heading.textContent.trim() : '';
    
    // セクションタイプを判定
    var sectionType = detectSectionType(card, headingText);
    
    // 本文を強化して取得
    var enhancedText = enhanceCardText(card, sectionType, headingText);
    
    if (enhancedText.trim()) {
      sections.push({
        index: i,
        text: enhancedText.trim(),
        element: card,
        heading: headingText,
        type: sectionType
      });
    }
  }
  
  // box-alertも追加（ポイントまとめ）
  var alertBoxes = container.querySelectorAll('.box-alert');
  for (var j = 0; j < alertBoxes.length; j++) {
    var alertBox = alertBoxes[j];
    var alertText = enhanceAlertBox(alertBox);
    if (alertText) {
      sections.push({
        index: sections.length,
        text: alertText,
        element: alertBox,
        heading: 'まとめ',
        type: 'summary'
      });
    }
  }
  
  return sections;
}

/**
 * カードのセクションタイプを判定
 * @param {HTMLElement} card - カード要素
 * @param {string} headingText - 見出しテキスト
 * @returns {string} セクションタイプ
 */
function detectSectionType(card, headingText) {
  if (headingText.indexOf('指針') !== -1 || headingText.indexOf('方針') !== -1) {
    return 'guidance';
  }
  if (headingText.indexOf('考え方') !== -1 || headingText.indexOf('解法') !== -1) {
    return 'explanation';
  }
  if (headingText.match(/^\(\d+\)/)) {
    return 'question';
  }
  if (card.querySelector('.box-note')) {
    return 'answer';
  }
  return 'general';
}

/**
 * カードのテキストを強化
 * @param {HTMLElement} card - カード要素
 * @param {string} sectionType - セクションタイプ
 * @param {string} headingText - 見出しテキスト
 * @returns {string} 強化されたテキスト
 */
function enhanceCardText(card, sectionType, headingText) {
  var text = '';
  
  // 見出しの処理
  if (headingText) {
    text += addSectionIntroduction(headingText, sectionType);
  }
  
  // 本文の処理
  var paragraphs = card.querySelectorAll('p');
  for (var i = 0; i < paragraphs.length; i++) {
    var p = paragraphs[i];
    var paragraphText = enhanceParagraph(p);
    if (paragraphText) {
      text += paragraphText + '。';
    }
  }
  
  // ハイライト要素の処理
  var highlights = card.querySelectorAll('.highlight');
  if (highlights.length > 0) {
    text += '特に注目すべき点として、';
    for (var j = 0; j < highlights.length; j++) {
      var highlight = highlights[j];
      var highlightText = highlight.textContent.trim();
      // 数式を変換
      var mathInHighlight = highlight.querySelectorAll('.MathJax, [class*="MathJax"]');
      for (var k = 0; k < mathInHighlight.length; k++) {
        var mathText = convertMathToText(mathInHighlight[k]);
        highlightText = highlightText.replace(mathInHighlight[k].textContent, mathText);
      }
      text += highlightText + 'があります。';
    }
  }
  
  // 太字要素の処理
  var strongElements = card.querySelectorAll('strong');
  if (strongElements.length > 0) {
    text += '重要なポイントとして、';
    for (var m = 0; m < strongElements.length; m++) {
      var strongText = strongElements[m].textContent.trim();
      // 親要素がpの場合は既に処理済みなのでスキップ
      if (strongElements[m].closest('p') === null) {
        text += strongText + '。';
      }
    }
  }
  
  // シミュレーションの補足
  var simEmbeds = card.querySelectorAll('.sim-embed');
  if (simEmbeds.length > 0) {
    text += '画面のシミュレーションをご覧ください。動きを確認しながら理解を深めましょう。';
  }
  
  // box-note（答え）の処理
  var boxNotes = card.querySelectorAll('.box-note');
  for (var n = 0; n < boxNotes.length; n++) {
    var noteText = enhanceBoxNote(boxNotes[n]);
    if (noteText) {
      text += noteText;
    }
  }
  
  return text;
}

/**
 * 段落を強化
 * @param {HTMLElement} paragraph - 段落要素
 * @returns {string} 強化されたテキスト
 */
function enhanceParagraph(paragraph) {
  var text = paragraph.textContent;
  
  // MathJax数式を変換
  var mathElements = paragraph.querySelectorAll('.MathJax, [class*="MathJax"]');
  for (var i = 0; i < mathElements.length; i++) {
    var math = mathElements[i];
    var mathText = convertMathToText(math);
    // 数式の前後に補足を追加
    var beforeMath = 'この数式、';
    var afterMath = 'を確認してください。';
    text = text.replace(math.textContent, beforeMath + mathText + afterMath);
  }
  
  // ハイライト要素を処理
  var highlights = paragraph.querySelectorAll('.highlight');
  for (var j = 0; j < highlights.length; j++) {
    var highlight = highlights[j];
    var highlightText = highlight.textContent.trim();
    // ハイライトの前後に補足を追加
    var enhancedHighlight = '特に重要な「' + highlightText + '」という概念に注目してください。';
    text = text.replace(highlight.textContent, enhancedHighlight);
  }
  
  // 太字要素を処理
  var strongElements = paragraph.querySelectorAll('strong');
  for (var k = 0; k < strongElements.length; k++) {
    var strong = strongElements[k];
    var strongText = strong.textContent.trim();
    // 太字の前後に補足を追加
    var enhancedStrong = '重要な「' + strongText + '」です。';
    text = text.replace(strong.textContent, enhancedStrong);
  }
  
  // 不要な空白を整理
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}

/**
 * セクションの導入文を追加
 * @param {string} headingText - 見出しテキスト
 * @param {string} sectionType - セクションタイプ
 * @returns {string} 導入文付きの見出し
 */
function addSectionIntroduction(headingText, sectionType) {
  var introduction = '';
  
  switch (sectionType) {
    case 'guidance':
      introduction = '解法の指針について説明します。' + headingText + '。';
      break;
    case 'explanation':
      introduction = '考え方について詳しく解説します。' + headingText + '。';
      break;
    case 'question':
      introduction = headingText + 'について解説します。';
      break;
    case 'answer':
      introduction = '答えについて説明します。' + headingText + '。';
      break;
    default:
      introduction = headingText + '。';
  }
  
  return introduction;
}

/**
 * box-noteを強化
 * @param {HTMLElement} boxNote - box-note要素
 * @returns {string} 強化されたテキスト
 */
function enhanceBoxNote(boxNote) {
  var text = '答えは、';
  
  // strong要素（「答え：」など）を除外
  var content = boxNote.cloneNode(true);
  var strongElements = content.querySelectorAll('strong');
  for (var i = 0; i < strongElements.length; i++) {
    strongElements[i].remove();
  }
  
  var noteText = content.textContent.trim();
  
  // MathJax数式を変換
  var mathElements = content.querySelectorAll('.MathJax, [class*="MathJax"]');
  for (var j = 0; j < mathElements.length; j++) {
    var mathText = convertMathToText(mathElements[j]);
    noteText = noteText.replace(mathElements[j].textContent, mathText);
  }
  
  text += noteText + 'となります。';
  
  return text;
}

/**
 * box-alertを強化
 * @param {HTMLElement} alertBox - box-alert要素
 * @returns {string} 強化されたテキスト
 */
function enhanceAlertBox(alertBox) {
  var text = '最後に、重要なポイントをまとめます。';
  
  var heading = alertBox.querySelector('h3');
  if (heading) {
    text += heading.textContent.trim() + '。';
  }
  
  var listItems = alertBox.querySelectorAll('li');
  if (listItems.length > 0) {
    text += 'ポイントは以下の通りです。';
    for (var i = 0; i < listItems.length; i++) {
      text += '第一に、' + listItems[i].textContent.trim() + '。';
    }
  }
  
  return text;
}

/**
 * 数式を含むテキストを強化
 * @param {string} text - 元のテキスト
 * @param {HTMLElement} context - コンテキスト要素
 * @returns {string} 強化されたテキスト
 */
function enhanceMathExpressions(text, context) {
  // 数式の前後に補足説明を追加
  // この関数は必要に応じて拡張可能
  return text;
}
