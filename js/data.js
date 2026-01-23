/* js/data.js */

// --- 1. MathJax Config ---
window.MathJax = {
  tex: {
    inlineMath: [["$", "$"], ["\\(", "\\)"]],
    displayMath: [["$$", "$$"]],
  },
  svg: { fontCache: "global" },
};

// --- 2. Firebase Config ---
window.appFirebaseConfig = {
  // ... (既存設定) ...
};