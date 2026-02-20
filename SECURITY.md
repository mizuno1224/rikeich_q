# セキュリティ・一般公開時の注意

一般公開する際に実施済みの対応と、運用時の注意点です。

---

## 公開API・外部連携の整理

### 外部に公開されているもの（意図どおり）
- **Firebase（Firestore）**: クライアント用の API キーは `config/firebase-config.js` にあり、ブラウザに読み込まれます。Firebase の仕様上、このキーは「公開前提」で、**実際の保護は Firestore セキュリティルールで行います**。秘密の API キーやサービスアカウント鍵は含まれていません。
- **静的リソース**: HTML / CSS / JS / JSON（`data/` 以下）はホスティングで配信されるだけです。サーバー側の隠し API はありません。

### 外部に公開していないもの
- 管理者・テスト画面（admin.html / test.html）は**ハブのメインには出さず**、フッターの「スタッフ用」から staff.html 経由でのみ案内しています。URL を直接知っていればアクセスは可能なので、必要に応じて Firebase Authentication 等で保護を検討してください。

---

## 実施済みの対応

### 1. ハブの公開範囲
- ハブ（hub.html）のメインでは**生徒画面・教員画面のみ**を表示しています。
- 管理者画面・テスト画面は **staff.html** に集約し、フッターの「スタッフ用」リンクからのみたどれるようにしています。

### 2. Firestore セキュリティルール
- **student_logs** のみ利用可能で、それ以外のコレクションはすべて拒否です。
- **student_logs** の書き込みは次のように制限しています。
  - 許可するフィールドのみ: `userId`, `contentId`, `cardIndex`, `reaction`, `memo`, `timestamp`
  - 各フィールドの型・長さ制限（例: memo は 10000 文字以内など）
  - **削除は禁止**（`allow delete: if false`）
- ルールの反映: `firebase deploy --only firestore:rules` を実行してください。未デプロイの場合は Firebase コンソールのルールが有効なままです。
- **読み取り**: 現状は全員可（管理画面から参照するため）。Firebase Authentication 導入後は、`allow read: if request.auth != null` などに変更することを推奨します。

### 3. Firebase 設定の一元化
- `config/firebase-config.js` を唯一の設定源とし、admin.html からもここを参照するようにしています。API キー等の重複記載を避け、変更漏れを防ぎます。

### 4. セキュリティヘッダー（firebase.json）
- 全レスポンスに以下を付与しています。
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN`
  - `Referrer-Policy: strict-origin-when-cross-origin`

### 5. エラー表示のエスケープ
- viewer のエラーメッセージは `escapeHtml()` を通してから表示しており、表示内容由来の XSS を抑止しています。解説 HTML は自前の静的ファイルのみ読み込む想定です。

### 6. 公開ページの表記
- 広告枠や about ページに、一般利用者向けでない管理者向け表記を出さないようにしています。

---

## 運用時の推奨

### Firebase API キー・アプリの制限
- クライアント用 API キーは公開されてもよい前提ですが、悪用を減らすため [Firebase コンソール](https://console.firebase.google.com/) の「プロジェクトの設定」→「一般」→「アプリ」で **HTTP リファラー等のアプリの制限** を設定することを推奨します。

### student_logs の読み取り制限（推奨）
- 現状、Firestore のルール上は誰でも **student_logs** を読み取れます。個人情報を入れない運用であればリスクは下がりますが、より厳格にする場合は **Firebase Authentication** を導入し、管理画面のみログイン済みユーザーに限定したうえで、ルールを `allow read: if request.auth != null` に変更することを推奨します。

### 解説 HTML の更新
- 解説ページ（`data/explanations/` 以下）は静的 HTML をそのまま表示しています。不特定多数が編集できる仕組みにしない限り、同一オリジンの信頼できるコンテンツのみが表示されます。

### 定期的な確認
- Firebase の「使用量と請求」「Authentication」「Firestore」で不審な利用がないか、定期的に確認することを推奨します。

---

## 一般公開前のチェックリスト

- [ ] `firebase deploy --only firestore:rules` でルールを反映した
- [ ] Firebase コンソールで API キーにリファラー制限等を設定した（推奨）
- [ ] 本番用ドメインでスタッフ用・管理画面の URL を必要最小限の関係者のみで共有した
- [ ] student_logs に個人を特定できる情報を保存しない運用にしている（または Auth で read 制限を検討した）
