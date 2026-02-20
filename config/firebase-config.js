/**
 * Firebase設定（外部化）
 * 本番では環境変数やビルド時に差し替えてください。
 */
window.firebaseConfig = {
  apiKey: "AIzaSyBObf6A_NDje3mpW1qxsfrNGnikdeDQOsA",
  authDomain: "rikeich-q.firebaseapp.com",
  projectId: "rikeich-q",
  storageBucket: "rikeich-q.firebasestorage.app",
  messagingSenderId: "779478068459",
  appId: "1:779478068459:web:6f223b0116b2b2b08122ae"
};

/**
 * コンテンツ作成リクエストをスプレッドシートに記録する場合の Web アプリ URL。
 * Google Apps Script で「ウェブアプリとして導入」した URL を指定してください。
 * 空の場合は Firestore（content_requests）に保存します。
 * @example "https://script.google.com/macros/s/xxxxx/exec"
 */
window.contentRequestSpreadsheetUrl = "";
