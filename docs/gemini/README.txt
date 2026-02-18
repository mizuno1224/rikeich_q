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
