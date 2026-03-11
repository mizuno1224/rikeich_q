========================================
docs/gemini/ — アーカイブ（参考用）
========================================

このフォルダは、以前の「Gemini 経由で解説を生成し、Cursor で保存・マニフェスト更新」するワークフロー用のプロンプト・ひな型を残したものです。

【現在の運用】
・解説は Cursor 単体で、問題画像を読み取り 0 から生成する。
・長い問題（入試大問など）は小分けして依頼し、増築することで質を上げる。
・詳細は docs/gemini-workflow.md および .cursor/rules/cursor-explanation-from-images.mdc を参照。

【このフォルダのファイル】
・custom-instruction.txt, step1〜4.txt, template.html, rules.txt, cursor-prompt.txt, import.html
・上記は参考用に残してあり、新規の解説作成では使用しない。

【Gem で解説 HTML を生成して流し込む場合】
・explanation-format-instruction.html … Gem に渡す「形式指示＋サンプル」用 HTML。
  冒頭の HTML コメントに「Gem への指示」がまとまっており、この形式で出力すれば
  data/explanations/ にそのまま流し込める。シミュ・画像は「差し込み用プレースホルダ」
  を置き、後から Cursor や手作業で p5.js や <img>/<figure> を差し込む。
