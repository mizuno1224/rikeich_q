#!/usr/bin/env node
/**
 * 解説ページ自動追加スクリプト
 * 
 * 使用方法:
 * node scripts/add-explanation.js <html-file-path> <json-content>
 * 
 * 例:
 * node scripts/add-explanation.js "data/explanations/textbook_basic/01/01/test.html" '{"id":"test","title":"テスト問題","explanationPath":"data/explanations/textbook_basic/01/01/test.html"}'
 */

const fs = require('fs');
const path = require('path');

// コマンドライン引数の取得
const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('使用方法: node scripts/add-explanation.js <html-content> <json-content> [html-file-path]');
  console.error('');
  console.error('引数:');
  console.error('  html-content: 解説HTMLの内容（文字列またはファイルパス）');
  console.error('  json-content: 登録用JSONの内容（文字列またはファイルパス）');
  console.error('  html-file-path: HTMLファイルの保存先パス（JSONから自動判定される場合は省略可）');
  process.exit(1);
}

const htmlInput = args[0];
const jsonInput = args[1];
const htmlFilePath = args[2] || null;

// HTMLコンテンツの読み込み
let htmlContent;
if (fs.existsSync(htmlInput) && fs.statSync(htmlInput).isFile()) {
  htmlContent = fs.readFileSync(htmlInput, 'utf-8');
} else {
  htmlContent = htmlInput;
}

// JSONコンテンツの読み込み
let jsonContent;
if (fs.existsSync(jsonInput) && fs.statSync(jsonInput).isFile()) {
  jsonContent = fs.readFileSync(jsonInput, 'utf-8');
} else {
  jsonContent = jsonInput;
}

// JSONのパース
let metaData;
try {
  // コードブロックを除去
  jsonContent = jsonContent
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  metaData = JSON.parse(jsonContent);
} catch (e) {
  console.error('JSONパースエラー:', e.message);
  console.error('JSON内容:', jsonContent);
  process.exit(1);
}

// explanationPathの確認
if (!metaData.explanationPath) {
  console.error('エラー: explanationPathがJSONに含まれていません');
  process.exit(1);
}

// HTMLファイルの保存先パスを決定
const targetHtmlPath = htmlFilePath || metaData.explanationPath;
const targetDir = path.dirname(targetHtmlPath);

// ディレクトリの作成
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
  console.log(`✓ ディレクトリを作成しました: ${targetDir}`);
}

// HTMLファイルの保存
try {
  // HTMLコードブロックを除去
  htmlContent = htmlContent
    .replace(/```html/gi, '')
    .replace(/```/g, '')
    .trim();
  
  fs.writeFileSync(targetHtmlPath, htmlContent, 'utf-8');
  console.log(`✓ HTMLファイルを保存しました: ${targetHtmlPath}`);
} catch (e) {
  console.error('HTMLファイル保存エラー:', e.message);
  process.exit(1);
}

// マニフェストの更新
const pathParts = metaData.explanationPath.split('/');
const expIndex = pathParts.indexOf('explanations');
if (expIndex === -1) {
  console.error('エラー: 無効なパス形式（explanationsが見つかりません）');
  process.exit(1);
}

const matId = pathParts[expIndex + 1];
const manifestPath = path.join(__dirname, '..', 'data', 'manifest.json');
const materialsPath = path.join(__dirname, '..', 'data', 'materials', `${matId}.json`);

// manifest.jsonの読み込み
let manifestData;
try {
  manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
} catch (e) {
  console.error('manifest.json読み込みエラー:', e.message);
  process.exit(1);
}

// 教材の確認
const material = manifestData.find(m => m.id === matId);
if (!material) {
  console.error(`エラー: 教材ID "${matId}" がmanifest.jsonに見つかりません`);
  process.exit(1);
}

// materials JSONの読み込み
let materialsData;
try {
  materialsData = JSON.parse(fs.readFileSync(materialsPath, 'utf-8'));
} catch (e) {
  console.error(`${matId}.json読み込みエラー:`, e.message);
  process.exit(1);
}

// パスから科目・分野を特定
const innerSegments = pathParts.slice(expIndex + 2, pathParts.length - 1);
const fileName = pathParts[pathParts.length - 1];

let firstSegment = innerSegments[0];
let targetSubject = materialsData.subjects.find(s => s.folderName === firstSegment);

// 科目が見つからない場合の処理
if (!targetSubject) {
  const emptySubject = materialsData.subjects.find(s => s.folderName === '');
  if (emptySubject) {
    targetSubject = emptySubject;
  } else {
    // 新規科目を作成
    targetSubject = {
      subjectName: firstSegment || '標準',
      folderName: firstSegment || '',
      fields: []
    };
    materialsData.subjects.push(targetSubject);
    console.log(`✓ 新規科目を作成しました: ${targetSubject.subjectName}`);
  }
}

// 分野の特定
let folderIds = '';
if (targetSubject.folderName && targetSubject.folderName !== '') {
  folderIds = innerSegments.slice(1).join('/');
} else {
  folderIds = innerSegments.join('/');
}

let targetField = targetSubject.fields.find(f => f.folderId === folderIds);

// 分野が見つからない場合の処理
if (folderIds && !targetField) {
  targetField = {
    fieldName: `新規分野 ${folderIds}`,
    folderId: folderIds,
    problems: []
  };
  targetSubject.fields.push(targetField);
  console.log(`✓ 新規分野を作成しました: ${targetField.fieldName}`);
} else if (!folderIds && !targetField) {
  targetField = {
    fieldName: '標準',
    folderId: '',
    problems: []
  };
  targetSubject.fields.push(targetField);
  console.log(`✓ 標準分野を作成しました`);
}

// 問題の追加または更新
const existingProbIndex = targetField.problems.findIndex(p => String(p.id) === String(metaData.id));

const newProbData = {
  id: metaData.id,
  title: metaData.title,
  desc: metaData.desc || '',
  explanationPath: metaData.explanationPath
};

if (existingProbIndex !== -1) {
  targetField.problems[existingProbIndex] = newProbData;
  console.log(`✓ 既存の問題を更新しました: ${metaData.title}`);
} else {
  targetField.problems.push(newProbData);
  console.log(`✓ 新規問題を追加しました: ${metaData.title}`);
}

// materials JSONの保存
try {
  fs.writeFileSync(materialsPath, JSON.stringify(materialsData, null, 2), 'utf-8');
  console.log(`✓ マニフェストを更新しました: ${materialsPath}`);
} catch (e) {
  console.error('マニフェスト保存エラー:', e.message);
  process.exit(1);
}

console.log('');
console.log('✓ 処理が完了しました！');
console.log(`  問題ID: ${metaData.id}`);
console.log(`  タイトル: ${metaData.title}`);
console.log(`  保存先: ${targetHtmlPath}`);
