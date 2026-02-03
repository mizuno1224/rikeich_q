/* js/error-handler.js - 統一エラーハンドリング・リトライ・トースト */

/**
 * ネットワークリクエストをリトライ付きで実行（指数バックオフ）
 * @param {string} url - リクエストURL
 * @param {RequestInit} [options] - fetchオプション
 * @param {number} [retries=3] - リトライ回数
 * @returns {Promise<Response>}
 */
async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      if (i === retries - 1) throw error;
      const delay = Math.pow(2, i) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("Max retries exceeded");
}

/**
 * ユーザー向けトースト通知を表示
 * @param {string} message - 表示メッセージ
 * @param {boolean} [isError=false] - エラー表示とするか
 */
function showToast(message, isError = false) {
  let container = document.getElementById("app-toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "app-toast-container";
    container.className = "app-toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = "app-toast " + (isError ? "app-toast-error" : "");
  toast.setAttribute("role", "alert");
  toast.textContent = message;
  container.appendChild(toast);
  const remove = () => {
    toast.classList.add("app-toast-hide");
    setTimeout(() => toast.remove(), 300);
  };
  setTimeout(remove, 4000);
  toast.addEventListener("click", remove);
}

/**
 * 統一エラーハンドラー：ログ・ユーザー通知
 */
class ErrorHandler {
  /**
   * @param {Error} error - 発生したエラー
   * @param {string} [context=''] - コンテキスト名（例: 'loadMaterial'）
   */
  static handle(error, context = "") {
    const prefix = context ? `[${context}] ` : "";
    console.error(prefix, error);
    this.showUserNotification(error);
    if (typeof window.errorTracker === "function") {
      window.errorTracker(error, context);
    }
  }

  static showUserNotification(error) {
    const message = this.getUserFriendlyMessage(error);
    showToast(message, true);
  }

  /**
   * エラーメッセージをユーザー向けに変換
   * @param {Error} error
   * @returns {string}
   */
  static getUserFriendlyMessage(error) {
    const msg = (error && error.message) ? String(error.message).toLowerCase() : "";
    if (msg.includes("not found") || msg.includes("404")) {
      return "問題・ファイルが見つかりませんでした。";
    }
    if (msg.includes("network") || msg.includes("failed to fetch") || msg.includes("load failed")) {
      return "ネットワークエラーが発生しました。接続を確認してください。";
    }
    if (msg.includes("parse") || msg.includes("json")) {
      return "データの読み込みに失敗しました。";
    }
    if (msg.includes("403") || msg.includes("401")) {
      return "アクセスが拒否されました。";
    }
    return "エラーが発生しました。しばらくしてから再度お試しください。";
  }
}

/**
 * ローディングオーバーレイを表示
 * @param {string} [message='読み込み中...'] - 表示メッセージ
 * @returns {HTMLElement} オーバーレイ要素（removeで非表示）
 */
function showLoading(message = "読み込み中...") {
  const loader = document.createElement("div");
  loader.className = "loading-overlay";
  loader.setAttribute("aria-live", "polite");
  loader.setAttribute("aria-busy", "true");
  loader.innerHTML = `
    <div class="loading-spinner" aria-hidden="true"></div>
    <p class="loading-message">${escapeHtml(message)}</p>
  `;
  document.body.appendChild(loader);
  return loader;
}

/**
 * ローディングオーバーレイを非表示
 * @param {HTMLElement} loader - showLoadingの戻り値
 */
function hideLoading(loader) {
  if (loader && loader.parentNode) {
    loader.classList.add("loading-overlay-hide");
    setTimeout(() => loader.remove(), 300);
  }
}

/**
 * HTMLエスケープ（XSS対策）
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (str == null) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/**
 * 信頼できないHTMLをサニタイズ（タグをエスケープ）
 * @param {string} str
 * @returns {string}
 */
function sanitizeHTML(str) {
  return escapeHtml(str);
}
