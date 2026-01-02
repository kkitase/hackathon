import { auth, db, storage } from "./firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
} from "firebase/firestore";
import {
  checkIsAdmin,
  loginWithIdPass,
  logoutAdmin,
  checkNeedsSetup,
} from "./auth-utils.js";
import { signInWithPopup } from "firebase/auth";
import { googleProvider } from "./firebase.js";

/**
 * 軽量 Markdown パーサー
 * 対応: 見出し, 太字, イタリック, リンク, リスト, 改行
 */
const parseMarkdown = (text) => {
  if (!text) return "";
  return (
    text
      // 見出し（##, ###）
      .replace(
        /^### (.+)$/gm,
        '<h4 style="margin: 1rem 0 0.5rem; color: var(--primary);">$1</h4>'
      )
      .replace(
        /^## (.+)$/gm,
        '<h3 style="margin: 1.5rem 0 0.75rem; font-size: 1.25rem;">$1</h3>'
      )
      // 太字とイタリック
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      // リンク
      .replace(
        /\[(.+?)\]\((.+?)\)/g,
        '<a href="$2" target="_blank" rel="noopener" style="color: var(--primary);">$1</a>'
      )
      // リスト（- で始まる行）
      .replace(/^- (.+)$/gm, '<li style="margin-left: 1.5rem;">$1</li>')
      // 改行
      .replace(/\n\n/g, '</p><p style="margin: 1rem 0;">')
      .replace(/\n/g, "<br>")
  );
};

// Admin Logic with Form-based Editing
document.addEventListener("DOMContentLoaded", () => {
  const navButtons = document.querySelectorAll(".admin-nav-btn");
  const pageTitle = document.getElementById("page-title");
  const formContainer = document.getElementById("form-container");
  const saveBtn = document.getElementById("save-btn");
  const resetBtn = document.getElementById("reset-btn");
  const saveStatus = document.getElementById("save-status");

  let currentTab = "hero";
  let hasChanges = false;

  // カスタムモーダルダイアログを表示
  const showModal = (title, message) => {
    // 既存モーダルを削除
    const existingModal = document.getElementById("custom-modal");
    if (existingModal) existingModal.remove();

    const modal = document.createElement("div");
    modal.id = "custom-modal";
    modal.innerHTML = `
      <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); z-index: 9999; display: flex; align-items: center; justify-content: center;">
        <div style="background: white; padding: 2rem; border-radius: 1.5rem; max-width: 400px; box-shadow: var(--shadow-lg); border: 1px solid var(--border);">
          <h3 style="margin-bottom: 1rem; color: #ef4444; font-size: 1.25rem; font-family: 'Outfit', sans-serif; font-weight: 800;">${title}</h3>
          <p style="margin-bottom: 1.5rem; color: var(--text-main); line-height: 1.6;">${message}</p>
          <button id="modal-close-btn" class="btn btn-primary" style="width: 100%;">閉じる</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    document
      .getElementById("modal-close-btn")
      .addEventListener("click", () => modal.remove());
  };

  // 日付フォーマット変換 (YYYY.MM.DD <-> YYYY-MM-DD)
  const toInputFormat = (dateStr) => {
    if (!dateStr) return "";
    return dateStr.replace(/\./g, "-");
  };
  const toDisplayFormat = (dateStr) => {
    if (!dateStr) return "";
    return dateStr.replace(/-/g, ".");
  };

  // 初期データ（Firestore にデータがない場合のフォールバック）
  const initialData = {
    hero: {
      title: "",
      subtitle: "",
      ctaText: "",
    },
    overview: {
      title: "",
      description: "",
      theme: "",
      tech: "",
    },
    schedule: [],
    judges: [],
    updates: [],
    prizes: [],
    rules: [],
    projects: [],
    faq: [],
    social: {
      ogTitle: "",
      ogDescription: "",
      ogImage: "",
      allowIndexing: false,
    },
  };

  // Firestore からデータ構造を取得（Firestore 優先）
  const loadStructuredData = async () => {
    try {
      // Firestore からコンテンツを取得
      const contentDoc = await getDoc(doc(db, "config", "data"));
      if (contentDoc.exists()) {
        return contentDoc.data();
      }
    } catch (error) {
      console.warn("Firestore からのデータ取得に失敗:", error);
    }

    // フォールバック: 初期データを返す
    return initialData;
  };

  // データを HTML に変換（表示用）
  const syncTabsData = async () => {
    const data = await loadStructuredData();
    const tabsHtml = {
      overview: generateOverviewHtml(data.overview || initialData.overview),
      schedule: generateScheduleHtml(data.schedule || initialData.schedule),
      judges: generateJudgesHtml(data.judges || initialData.judges),
      updates: generateUpdatesHtml(data.updates || initialData.updates),
      prizes: generatePrizesHtml(data.prizes || initialData.prizes),
      rules: generateRulesHtml(data.rules || initialData.rules),
      projects: generateProjectsHtml(data.projects || initialData.projects),
      faq: generateFaqHtml(data.faq || initialData.faq),
    };
    return tabsHtml;
  };

  // HTML生成関数群
  const generateOverviewHtml = (d) => `
        <div class="fade-in">
            <h2 style="font-size: 1.75rem; margin-bottom: 2rem;">プロジェクト概要</h2>
            <div style="background: white; padding: 2.5rem; border-radius: 1.25rem; border: 1px solid var(--border); line-height: 1.8;">
                <div style="margin-bottom: 1.5rem;">${parseMarkdown(
                  d.description
                )}</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-top: 2rem;">
                    <div style="padding: 1.5rem; background: var(--background); border-radius: 1rem;">
                        <h4 style="margin-bottom: 0.5rem; color: var(--primary);">テーマ</h4>
                        <div style="font-size: 0.9375rem;">${parseMarkdown(
                          d.theme
                        )}</div>
                    </div>
                    <div style="padding: 1.5rem; background: var(--background); border-radius: 1rem;">
                        <h4 style="margin-bottom: 0.5rem; color: var(--primary);">対象技術</h4>
                        <div style="font-size: 0.9375rem;">${parseMarkdown(
                          d.tech
                        )}</div>
                    </div>
                </div>
            </div>
        </div>`;

  const generateScheduleHtml = (items) => `
        <div class="fade-in">
            <h2 style="font-size: 1.75rem; margin-bottom: 2rem;">スケジュール</h2>
            <div class="timeline" style="position: relative; padding-left: 2rem;">
                <div style="position: absolute; left: 0; top: 0; bottom: 0; width: 2px; background: var(--border);"></div>
                ${items
                  .map(
                    (item) => `
                <div style="margin-bottom: 3rem; position: relative;">
                    <div style="position: absolute; left: -2.35rem; top: 0.25rem; width: 12px; height: 12px; border-radius: 50%; background: ${
                      item.active ? "var(--primary)" : "var(--border)"
                    }; border: 3px solid white; ${
                      item.active
                        ? "box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);"
                        : ""
                    }"></div>
                    <div style="font-weight: 800; color: ${
                      item.active ? "var(--primary)" : "var(--text-muted)"
                    }; margin-bottom: 0.5rem;">${item.date}</div>
                    <h4 style="font-size: 1.125rem; margin-bottom: 0.5rem;">${
                      item.title
                    }</h4>
                    <p style="color: var(--text-muted); font-size: 0.9375rem;">${parseMarkdown(
                      item.description
                    )}</p>
                </div>`
                  )
                  .join("")}
            </div>
        </div>`;

  const generateJudgesHtml = (items) => `
        <div class="judge-section fade-in">
            <h2 style="font-size: 1.75rem; margin-bottom: 2rem; display: flex; align-items: center; gap: 0.75rem;">
                <span style="font-size: 1.5rem;">🔍</span> 審査員
            </h2>
            <div class="judge-grid">
                ${items
                  .map(
                    (j) => `
                <div class="judge-card">
                    <div class="judge-avatar" style="background-image: url('${
                      j.avatar
                    }'); background-size: cover;"></div>
                    <div class="judge-info">
                        <h3>${j.name}</h3>
                        <p class="judge-title">${j.title}</p>
                        <p class="judge-bio">${parseMarkdown(j.bio)}</p>
                    </div>
                </div>`
                  )
                  .join("")}
            </div>
        </div>`;

  const generateUpdatesHtml = (items) => `
        <div class="fade-in">
            <h2 style="font-size: 1.75rem; margin-bottom: 2rem;">更新情報</h2>
            <div style="display: flex; flex-direction: column; gap: 1rem;">
                ${items
                  .map(
                    (u) => `
                <div style="background: white; padding: 1.5rem; border-radius: 1rem; border: 1px solid var(--border); display: flex; align-items: flex-start; gap: 1rem;">
                    <span style="font-size: 0.875rem; color: var(--text-muted); flex-shrink: 0;">${
                      u.date
                    }</span>
                    <span style="font-weight: 500;">${parseMarkdown(
                      u.text
                    )}</span>
                </div>`
                  )
                  .join("")}
            </div>
        </div>`;

  const generatePrizesHtml = (items) => `
        <div class="fade-in">
            <h2 style="font-size: 1.75rem; margin-bottom: 2rem;">プライズ</h2>
            <div class="judge-grid">
                ${items
                  .map(
                    (p) => `
                <div style="background: white; padding: 2rem; border-radius: 1rem; border: 1px solid var(--border);">
                    <h3 style="color: var(--primary); margin-bottom: 0.5rem;">${
                      p.title
                    }</h3>
                    <div style="font-size: 0.9375rem; line-height: 1.6;">${parseMarkdown(
                      p.description
                    )}</div>
                </div>`
                  )
                  .join("")}
            </div>
        </div>`;

  const generateRulesHtml = (items) => `
        <div class="fade-in">
            <h2 style="font-size: 1.75rem; margin-bottom: 2rem;">ルール</h2>
            <div style="background: white; padding: 2rem; border-radius: 1rem; border: 1px solid var(--border);">
                ${items
                  .map(
                    (r) =>
                      `<div style="margin-bottom: 1rem; line-height: 1.6;">${parseMarkdown(
                        r.text
                      )}</div>`
                  )
                  .join("")}
            </div>
        </div>`;

  const generateProjectsHtml = (items) => `
        <div class="fade-in">
            <h2 style="font-size: 1.75rem; margin-bottom: 2rem;">プロジェクト</h2>
            <div style="background: white; padding: 2rem; border-radius: 1rem; border: 1px solid var(--border);">
                ${
                  items.length
                    ? items.map((p) => `<p>${p.name}</p>`).join("")
                    : '<p style="color: var(--text-muted);">まだプロジェクトは登録されていません。</p>'
                }
            </div>
        </div>`;

  const generateFaqHtml = (items) => `
        <div class="fade-in">
            <h2 style="font-size: 1.75rem; margin-bottom: 2rem;">FAQ</h2>
            <div style="display: flex; flex-direction: column; gap: 1rem;">
                ${items
                  .map(
                    (f) => `
                <div style="background: white; padding: 1.5rem; border-radius: 1rem; border: 1px solid var(--border); line-height: 1.6;">
                    ${parseMarkdown(
                      f.content || `## ${f.question || ""}\n\n${f.answer || ""}`
                    )}
                </div>`
                  )
                  .join("")}
            </div>
        </div>`;

  // 保存ボタンの状態更新
  const updateSaveButtonState = () => {
    if (hasChanges) {
      saveBtn.style.background = "var(--grad-main)";
      saveBtn.style.opacity = "1";
      saveBtn.disabled = false;
      saveStatus.textContent = "未保存の変更があります";
      saveStatus.style.color = "#f59e0b";
    } else {
      saveBtn.style.background = "#e2e8f0";
      saveBtn.style.opacity = "0.6";
      saveBtn.disabled = true;
      saveStatus.textContent = "保存済み";
      saveStatus.style.color = "#10b981";
    }
  };

  // フォーム入力監視
  const markChanged = () => {
    // 即時保存が行われるタブではグローバルの「未保存の変更」フラグを立てない
    if (currentTab === "projects" || currentTab === "admins") return;
    hasChanges = true;
    updateSaveButtonState();
  };

  formContainer.addEventListener("input", markChanged);
  formContainer.addEventListener("change", markChanged);

  // フォームをレンダリング
  const renderForm = async (tabName) => {
    const data = await loadStructuredData();
    let html = "";

    switch (tabName) {
      case "hero":
        const h = data.hero || {
          title: "",
          subtitle: "",
          ctaText: "",
          notice: "",
        };
        html = `
                    <div class="form-group">
                        <label>メインタイトル</label>
                        <input type="text" class="form-input" id="field-hero-title" value="${h.title}" />
                    </div>
                    <div class="form-group">
                        <label>サブタイトル（キャッチコピー）</label>
                        <textarea class="form-input" id="field-hero-subtitle" style="min-height: 80px;">${h.subtitle}</textarea>
                    </div>
                    <div class="form-group">
                        <label>CTAボタンのテキスト</label>
                        <input type="text" class="form-input" id="field-hero-cta" value="${h.ctaText}" />
                    </div>`;
        break;
      case "overview":
        html = `
                    <div class="form-group">
                        <label>説明文（Markdown対応）</label>
                        <textarea class="form-input form-textarea" id="field-description" style="min-height: 100px;">${data.overview.description}</textarea>
                    </div>
                    <div class="form-group">
                        <label>テーマ（Markdown対応）</label>
                        <textarea class="form-input form-textarea" id="field-theme" style="min-height: 100px;">${data.overview.theme}</textarea>
                    </div>
                    <div class="form-group">
                        <label>対象技術（Markdown対応）</label>
                        <textarea class="form-input form-textarea" id="field-tech" style="min-height: 100px;">${data.overview.tech}</textarea>
                    </div>`;
        break;
      case "schedule":
        html = `<div id="schedule-items">${data.schedule
          .map(
            (item, i) => `
                    <div class="item-block" data-index="${i}">
                        <div style="display: grid; grid-template-columns: 150px 1fr; gap: 1rem; margin-bottom: 1rem;">
                            <input type="date" class="form-input field-date" value="${toInputFormat(
                              item.date
                            )}" />
                            <input type="text" class="form-input field-title" value="${
                              item.title
                            }" placeholder="タイトル" />
                        </div>
                        <textarea class="form-input field-desc" style="min-height: 60px;" placeholder="説明（Markdown対応）">${
                          item.description
                        }</textarea>
                        <label style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem; font-size: 0.875rem;">
                            <input type="checkbox" class="field-active" ${
                              item.active ? "checked" : ""
                            } /> アクティブ（現在進行中）
                        </label>
                        <hr style="margin: 1.5rem 0; border: none; border-top: 1px solid var(--border);" />
                    </div>`
          )
          .join("")}</div>
                    <button type="button" id="add-schedule-item" class="btn" style="background: #e2e8f0; color: var(--text-main);">+ 項目を追加</button>`;
        break;
      case "judges":
        html = `<div id="judge-items">${data.judges
          .map(
            (j, i) => `
                    <div class="item-block" data-index="${i}">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                            <input type="text" class="form-input field-name" value="${j.name}" placeholder="名前" />
                            <input type="text" class="form-input field-title" value="${j.title}" placeholder="肩書き" />
                        </div>
                        <div style="display: flex; gap: 1rem; align-items: flex-start; margin-bottom: 1rem;">
                            <div class="avatar-preview" style="width: 80px; height: 80px; border-radius: 50%; background: #e2e8f0; background-image: url('${j.avatar}'); background-size: cover; background-position: center; flex-shrink: 0;"></div>
                            <div style="flex: 1;">
                                <label class="upload-btn" style="display: inline-block; padding: 0.5rem 1rem; background: #e2e8f0; border-radius: 0.5rem; cursor: pointer; font-size: 0.875rem; margin-bottom: 0.5rem;">
                                    📁 画像を選択
                                    <input type="file" class="field-avatar-file" accept="image/jpeg,image/png,image/gif,image/webp" style="display: none;" />
                                </label>
                                <input type="hidden" class="field-avatar" value="${j.avatar}" />
                                <p style="font-size: 0.75rem; color: var(--text-muted);">JPEG, PNG, GIF, WebP（最大2MB）</p>
                            </div>
                        </div>
                        <textarea class="form-input field-bio" style="min-height: 60px;" placeholder="プロフィール（Markdown対応）">${j.bio}</textarea>
                        <hr style="margin: 1.5rem 0; border: none; border-top: 1px solid var(--border);" />
                    </div>`
          )
          .join("")}</div>
                    <button type="button" id="add-judge-item" class="btn" style="background: #e2e8f0; color: var(--text-main);">+ 審査員を追加</button>`;
        break;
      case "updates":
        html = `<div id="update-items">${data.updates
          .map(
            (u, i) => `
                    <div class="item-block" data-index="${i}">
                        <div style="display: grid; grid-template-columns: 150px 1fr; gap: 1rem; margin-bottom: 1rem;">
                            <input type="date" class="form-input field-date" value="${toInputFormat(
                              u.date
                            )}" />
                            <input type="text" class="form-input field-text" value="${
                              u.text
                            }" placeholder="内容" />
                        </div>
                        <hr style="margin: 1rem 0; border: none; border-top: 1px solid var(--border);" />
                    </div>`
          )
          .join("")}</div>
                    <button type="button" id="add-update-item" class="btn" style="background: #e2e8f0; color: var(--text-main);">+ 更新情報を追加</button>`;
        break;
      case "prizes":
        html = `<div id="prize-items">${data.prizes
          .map(
            (p, i) => `
                    <div class="item-block" data-index="${i}">
                        <input type="text" class="form-input field-title" value="${p.title}" placeholder="賞のタイトル" style="margin-bottom: 1rem;" />
                        <textarea class="form-input field-desc" style="min-height: 60px;" placeholder="詳細">${p.description}</textarea>
                        <hr style="margin: 1.5rem 0; border: none; border-top: 1px solid var(--border);" />
                    </div>`
          )
          .join("")}</div>
                    <button type="button" id="add-prize-item" class="btn" style="background: #e2e8f0; color: var(--text-main);">+ 賞を追加</button>`;
        break;
      case "rules":
        html = `<div id="rule-items">${data.rules
          .map(
            (r, i) => `
                    <div class="item-block" data-index="${i}">
                        <textarea class="form-input field-text form-textarea" style="min-height: 80px;" placeholder="ルール項目（Markdown対応）">${r.text}</textarea>
                        <hr style="margin: 1rem 0; border: none; border-top: 1px solid var(--border);" />
                    </div>`
          )
          .join("")}</div>
                    <button type="button" id="add-rule-item" class="btn" style="background: #e2e8f0; color: var(--text-main);">+ ルールを追加</button>`;
        break;
      case "faq":
        html = `<div id="faq-items">${data.faq
          .map(
            (f, i) => `
                    <div class="item-block" data-index="${i}">
                        <label style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: 0.5rem; display: block;">FAQ項目（Markdown対応）</label>
                        <textarea class="form-input field-content form-textarea" style="min-height: 120px;" placeholder="## 質問タイトル\n\n回答の内容をここに記述...">${
                          f.content ||
                          `## ${f.question || ""}\n\n${f.answer || ""}`
                        }</textarea>
                        <hr style="margin: 1.5rem 0; border: none; border-top: 1px solid var(--border);" />
                    </div>`
          )
          .join("")}</div>
                    <button type="button" id="add-faq-item" class="btn" style="background: #e2e8f0; color: var(--text-main);">+ FAQを追加</button>`;
        break;
      case "social":
        const s = {
          ogTitle: data.social?.ogTitle || "",
          ogDescription: data.social?.ogDescription || "",
          ogImage: data.social?.ogImage || "",
          allowIndexing: data.social?.allowIndexing === true,
        };
        html = `
            <div class="form-group">
                <label>SNS用タイトル (og:title)</label>
                <input type="text" class="form-input" id="field-social-title" value="${
                  s.ogTitle
                }" />
            </div>
            <div class="form-group">
                <label>SNS用説明文 (og:description)</label>
                <textarea class="form-input" id="field-social-desc" style="min-height: 80px;">${
                  s.ogDescription
                }</textarea>
            </div>
            <div class="form-group">
                <label>SNS用画像 (og:image) URL / アップロード</label>
                <div style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1rem;">
                    <div style="display: flex; gap: 0.5rem;">
                        <input type="text" class="form-input" id="field-social-image" value="${
                          s.ogImage
                        }" placeholder="https://example.com/image.jpg" />
                        <label class="btn" style="background: var(--grad-main); color: white; cursor: pointer; white-space: nowrap; display: flex; align-items: center; justify-content: center;">
                            アップロード
                            <input type="file" id="field-social-image-file" accept="image/*" style="display: none;" />
                        </label>
                    </div>
                    <div class="social-image-preview" style="width: 240px; height: 126px; border-radius: 0.5rem; background: #e2e8f0; background-image: url('${
                      s.ogImage
                    }'); background-size: cover; background-position: center; border: 1px solid var(--border); flex-shrink: 0;"></div>
                    <p style="font-size: 0.75rem; color: var(--text-muted);">1200x630px 推奨。ファイルをアップロードすると自動的に URL がセットされます。</p>
                </div>
            </div>
            <div class="form-group" style="border-top: 1px solid var(--border); padding-top: 1.5rem; margin-top: 1rem;">
                <label style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer;">
                    <input type="checkbox" id="field-allow-indexing" ${
                      s.allowIndexing ? "checked" : ""
                    } style="width: 1.25rem; height: 1.25rem;" />
                    <span>検索エンジンに公開する</span>
                </label>
                <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem;">
                    有効にすると、Google などの検索エンジンにインデックスされます。<br>
                    無効の場合、robots.txt により全てのクローラーをブロックします。
                </p>
            </div>`;
        break;
      case "admins":
        const adminSnap = await getDoc(doc(db, "config", "admin"));
        const adminData = adminSnap.exists()
          ? adminSnap.data()
          : { authorizedEmails: [] };

        const maskEmail = (email) => {
          if (!email || !email.includes("@")) return email;
          const [user, domain] = email.split("@");
          const maskStr = (str) => {
            if (str.length <= 2) return str[0] + "*";
            return (
              str[0] +
              "*".repeat(Math.max(0, str.length - 2)) +
              str[str.length - 1]
            );
          };
          return `${maskStr(user)}@${maskStr(domain)}`;
        };

        html = `
            <div class="form-group">
                <label>特権管理者（Googleアカウントのメールアドレス）</label>
                <div id="admin-email-list" style="margin-bottom: 1.5rem;">
                    ${adminData.authorizedEmails
                      .map(
                        (email) => `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--background); border-radius: 0.5rem; margin-bottom: 0.5rem;">
                            <span>${maskEmail(email)}</span>
                            <button type="button" class="delete-admin-btn btn-sm" data-email="${email}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; background: #fee2e2; color: #ef4444; border: 1px solid #fecaca; border-radius: 0.25rem; cursor: pointer;">削除</button>
                        </div>
                    `
                      )
                      .join("")}
                    ${
                      adminData.authorizedEmails.length === 0
                        ? '<p style="color: var(--text-muted); font-size: 0.875rem;">登録された管理ユーザーはいません。</p>'
                        : ""
                    }
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <input type="email" id="new-admin-email" class="form-input" placeholder="example@gmail.com" />
                    <button type="button" id="add-admin-email-btn" class="btn btn-primary" style="white-space: nowrap;">追加</button>
                </div>
                <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 1rem;">※追加されたメールアドレスを持つGoogleユーザーは、この管理画面にアクセス可能になります。</p>
            </div>
        `;
        break;
      default:
        html = "<p>準備中...</p>";
    }

    formContainer.innerHTML = html;

    formContainer
      .querySelectorAll(".field-avatar-file")
      .forEach((input) => handleImageUpload(input, "", "avatar-preview"));

    // プロジェクト（旧参加者）リストの表示制御
    if (tabName === "projects") {
      renderParticipantsList();
      // プロジェクトタブでは標準の保存・リセットボタンを非表示にする（管理動線が異なるため）
      document.querySelector(".admin-actions").style.display = "none";
    } else {
      document.querySelector(".admin-actions").style.display = "flex";
    }

    const socialInput = document.getElementById("field-social-image-file");
    if (socialInput) {
      socialInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const { ref, uploadBytes, getDownloadURL } = await import(
          "firebase/storage"
        );
        const fileName = `ogp/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, fileName);

        const statusLabel = e.target.parentElement;
        const originalText = statusLabel.textContent;
        statusLabel.textContent = "アップ中...";
        statusLabel.style.pointerEvents = "none";

        try {
          const snapshot = await uploadBytes(storageRef, file);
          const downloadURL = await getDownloadURL(snapshot.ref);

          const urlInput = document.getElementById("field-social-image");
          const preview = document.querySelector(".social-image-preview");

          if (urlInput) urlInput.value = downloadURL;
          if (preview) preview.style.backgroundImage = `url('${downloadURL}')`;

          markChanged();
          statusLabel.textContent = "完了！";
          setTimeout(() => {
            statusLabel.textContent = originalText;
            statusLabel.style.pointerEvents = "auto";
          }, 2000);
        } catch (err) {
          console.error("Upload failed:", err);
          alert("アップロードに失敗しました。");
          statusLabel.textContent = originalText;
          statusLabel.style.pointerEvents = "auto";
        }
      });
    }

    // 画像アップロードの処理
    function handleImageUpload(fileInput, hiddenInputId, previewClass) {
      fileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const maxSize = 2 * 1024 * 1024;
        if (file.size > maxSize) {
          showModal("サイズエラー", "画像サイズは2MB以下にしてください。");
          e.target.value = "";
          return;
        }

        const img = new Image();
        const reader = new FileReader();
        reader.onload = (event) => {
          img.src = event.target.result;
        };
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const width = hiddenInputId === "field-social-image" ? 1200 : 150;
          const height = hiddenInputId === "field-social-image" ? 630 : 150;
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");

          if (hiddenInputId === "field-social-image") {
            const scale = Math.max(width / img.width, height / img.height);
            const x = width / 2 - (img.width / 2) * scale;
            const y = height / 2 - (img.height / 2) * scale;
            ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
          } else {
            const minDim = Math.min(img.width, img.height);
            const sx = (img.width - minDim) / 2;
            const sy = (img.height - minDim) / 2;
            ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, width, height);
          }

          const compressedBase64 = canvas.toDataURL("image/jpeg", 0.8);
          const itemBlock = fileInput.closest(".item-block");
          const hiddenInput = hiddenInputId
            ? document.getElementById(hiddenInputId)
            : itemBlock?.querySelector(".field-avatar");
          const preview =
            hiddenInputId && !itemBlock
              ? document.querySelector(`.${previewClass}`)
              : itemBlock?.querySelector(`.${previewClass}`);

          if (hiddenInput) hiddenInput.value = compressedBase64;
          if (preview)
            preview.style.backgroundImage = `url('${compressedBase64}')`;
          markChanged();
        };
        reader.readAsDataURL(file);
      });
    }

    // 追加ボタンのイベント設定

    // 追加ボタンのイベント設定
    setupAddButtons(tabName);

    // 管理者追加ボタンの個別設定
    if (tabName === "admins") {
      const addAdminBtn = document.getElementById("add-admin-email-btn");
      const emailInput = document.getElementById("new-admin-email");
      if (addAdminBtn && emailInput) {
        addAdminBtn.addEventListener("click", async () => {
          const email = emailInput.value.trim();
          if (!email || !email.includes("@")) {
            showModal("入力エラー", "有効なメールアドレスを入力してください。");
            return;
          }
          try {
            await updateDoc(doc(db, "config", "admin"), {
              authorizedEmails: arrayUnion(email),
            });

            // メール通知用のドキュメントを Firestore に追加 (Trigger Email 連携用)
            try {
              await setDoc(doc(db, "mail", `notify_${Date.now()}`), {
                to: email,
                message: {
                  subject: "管理者権限が付与されました | AI Agent Hackathon",
                  html: `
                                <h2>管理者権限の付与通知</h2>
                                <p>AI Agent Hackathon の管理画面へのアクセス権限が付与されました。</p>
                                <p>以下のリンクよりログインしてご確認ください。</p>
                                <p><a href="https://${window.location.hostname}">サイトへ移動</a></p>
                            `,
                },
              });
            } catch (err) {
              console.warn(
                "Notification document creation failed (non-critical):",
                err
              );
            }

            showModal(
              "成功",
              `${email} を管理者に登録し、通知を送信しました。`
            );
            await renderForm("admins");
          } catch (err) {
            console.error("Admin addition failed:", err);
            alert(
              "管理者情報の更新に失敗しました。Firestoreの権限設定を確認してください。"
            );
          }
        });
      }

      // 削除ボタンのイベント設定
      formContainer.querySelectorAll(".delete-admin-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const email = btn.getAttribute("data-email");
          if (confirm(`管理者 ${email} を削除してもよろしいですか？`)) {
            try {
              await updateDoc(doc(db, "config", "admin"), {
                authorizedEmails: arrayRemove(email),
              });
              showModal("成功", `${email} を管理者リストから削除しました。`);
              await renderForm("admins");
            } catch (err) {
              console.error("Admin deletion failed:", err);
              alert("管理者の削除に失敗しました。");
            }
          }
        });
      });
    }

    // Social 画像 URL 入力時のプレビュー同期
    const socialImageUrlInput = document.getElementById("field-social-image");
    if (socialImageUrlInput) {
      socialImageUrlInput.addEventListener("input", () => {
        const url = socialImageUrlInput.value.trim();
        const preview = document.querySelector(".social-image-preview");
        if (preview) {
          preview.style.backgroundImage = url ? `url('${url}')` : "none";
        }
      });
    }

    hasChanges = false;
    updateSaveButtonState();
  };

  // 追加ボタンの設定
  const setupAddButtons = (tabName) => {
    const addBtn = formContainer.querySelector(
      `#add-${
        tabName === "judges"
          ? "judge"
          : tabName === "updates"
          ? "update"
          : tabName === "prizes"
          ? "prize"
          : tabName === "rules"
          ? "rule"
          : tabName === "faq"
          ? "faq"
          : tabName
      }-item`
    );
    if (addBtn) {
      addBtn.addEventListener("click", async () => {
        const data = await loadStructuredData();
        switch (tabName) {
          case "schedule":
            if (!data.schedule) data.schedule = [];
            data.schedule.push({
              date: "",
              title: "",
              description: "",
              active: false,
            });
            break;
          case "judges":
            if (!data.judges) data.judges = [];
            data.judges.push({ name: "", title: "", bio: "", avatar: "" });
            break;
          case "updates":
            if (!data.updates) data.updates = [];
            data.updates.push({ tag: "", text: "", date: "" });
            break;
          case "prizes":
            if (!data.prizes) data.prizes = [];
            data.prizes.push({ title: "", description: "" });
            break;
          case "rules":
            if (!data.rules) data.rules = [];
            data.rules.push({ text: "" });
            break;
          case "faq":
            if (!data.faq) data.faq = [];
            data.faq.push({ question: "", answer: "" });
            break;
        }
        // Firestore に保存（一時的に）
        try {
          await setDoc(
            doc(db, "config", "data"),
            { ...data, updatedAt: serverTimestamp() },
            { merge: true }
          );
        } catch (err) {
          console.warn("Firestore 保存に失敗:", err);
        }
        renderForm(tabName);
        markChanged();
      });
    }
  };

  // 現在のフォームからデータを収集
  const collectFormData = async () => {
    const data = await loadStructuredData();

    switch (currentTab) {
      case "hero":
        data.hero = {
          title: document.getElementById("field-hero-title")?.value || "",
          subtitle: document.getElementById("field-hero-subtitle")?.value || "",
          ctaText: document.getElementById("field-hero-cta")?.value || "",
        };
        break;
      case "overview":
        data.overview = {
          title: document.getElementById("field-title")?.value || "",
          description:
            document.getElementById("field-description")?.value || "",
          theme: document.getElementById("field-theme")?.value || "",
          tech: document.getElementById("field-tech")?.value || "",
        };
        break;
      case "schedule":
        data.schedule = [
          ...formContainer.querySelectorAll("#schedule-items .item-block"),
        ]
          .map((block) => ({
            date:
              toDisplayFormat(block.querySelector(".field-date")?.value) || "",
            title: block.querySelector(".field-title")?.value || "",
            description: block.querySelector(".field-desc")?.value || "",
            active: block.querySelector(".field-active")?.checked || false,
          }))
          // 日付順（昇順）でソート
          .sort((a, b) => {
            const dateA = a.date.replace(/\./g, "-");
            const dateB = b.date.replace(/\./g, "-");
            return dateA.localeCompare(dateB);
          });
        break;
      case "judges":
        data.judges = [
          ...formContainer.querySelectorAll("#judge-items .item-block"),
        ].map((block) => ({
          name: block.querySelector(".field-name")?.value || "",
          title: block.querySelector(".field-title")?.value || "",
          bio: block.querySelector(".field-bio")?.value || "",
          avatar: block.querySelector(".field-avatar")?.value || "",
        }));
        break;
      case "updates":
        data.updates = [
          ...formContainer.querySelectorAll("#update-items .item-block"),
        ]
          .map((block) => ({
            text: block.querySelector(".field-text")?.value || "",
            date:
              toDisplayFormat(block.querySelector(".field-date")?.value) || "",
          }))
          // 日付順（降順：新しい順）でソート
          .sort((a, b) => {
            // YYYY.MM.DD または YYYY/MM/DD を YYYY-MM-DD に統一
            const dateA = a.date.replace(/[./]/g, "-");
            const dateB = b.date.replace(/[./]/g, "-");
            return dateB.localeCompare(dateA);
          });
        break;
      case "prizes":
        data.prizes = [
          ...formContainer.querySelectorAll("#prize-items .item-block"),
        ].map((block) => ({
          title: block.querySelector(".field-title")?.value || "",
          description: block.querySelector(".field-desc")?.value || "",
        }));
        break;
      case "rules":
        data.rules = [
          ...formContainer.querySelectorAll("#rule-items .item-block"),
        ].map((block) => ({
          text: block.querySelector(".field-text")?.value || "",
        }));
        break;
      case "faq":
        data.faq = [
          ...formContainer.querySelectorAll("#faq-items .item-block"),
        ].map((block) => ({
          content: block.querySelector(".field-content")?.value || "",
        }));
        break;
      case "social":
        data.social = {
          ogTitle: document.getElementById("field-social-title")?.value || "",
          ogDescription:
            document.getElementById("field-social-desc")?.value || "",
          ogImage: document.getElementById("field-social-image")?.value || "",
          allowIndexing:
            document.getElementById("field-allow-indexing")?.checked || false,
        };
        break;
    }
    return data;
  };

  // ナビゲーション
  navButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (hasChanges && !confirm("未保存の変更があります。破棄しますか？"))
        return;

      navButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentTab = btn.getAttribute("data-target");
      pageTitle.textContent = `${btn.textContent}の編集`;

      // タブ切り替え時に「未保存の変更」フラグをリセット
      hasChanges = false;
      updateSaveButtonState();

      await renderForm(currentTab);
    });
  });

  // 保存
  saveBtn.addEventListener("click", async () => {
    try {
      const data = await collectFormData();

      // タブ用 HTML を生成
      const tabsData = {
        overview: generateOverviewHtml(data.overview || {}),
        schedule: generateScheduleHtml(data.schedule || []),
        judges: generateJudgesHtml(data.judges || []),
        updates: generateUpdatesHtml(data.updates || []),
        prizes: generatePrizesHtml(data.prizes || []),
        rules: generateRulesHtml(data.rules || []),
        projects: generateProjectsHtml(data.projects || []),
        faq: generateFaqHtml(data.faq || []),
      };

      // Firestore に生データを保存（管理画面用）
      try {
        await setDoc(
          doc(db, "config", "data"),
          {
            ...data,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        console.log("Firestore data sync successful");
      } catch (err) {
        console.error("Firestore data sync failed:", err);
      }

      // Firestore にタブ HTML を保存（クライアント読み込み用）
      try {
        await setDoc(
          doc(db, "config", "content"),
          {
            hero: data.hero || {},
            tabs: tabsData,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        console.log("Firestore content sync successful");
      } catch (err) {
        console.error("Firestore content sync failed:", err);
      }

      // Firestore に OGP 設定を同期 (SSR 用)
      if (data.social) {
        try {
          await setDoc(
            doc(db, "config", "ogp"),
            {
              ogTitle: data.social.ogTitle || "",
              ogDescription: data.social.ogDescription || "",
              ogImage: data.social.ogImage || "",
              allowIndexing: data.social.allowIndexing || false,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
          console.log("Firestore OGP sync successful");
        } catch (err) {
          console.error("Firestore OGP sync failed:", err);
        }
      }

      hasChanges = false;
      updateSaveButtonState();

      saveStatus.textContent = "保存しました！";
      saveStatus.style.color = "#10b981";
    } catch (error) {
      showModal("保存エラー", "保存に失敗しました: " + error.message);
      saveStatus.textContent = "保存失敗";
      saveStatus.style.color = "#ef4444";
    }
  });

  // リセット
  resetBtn.addEventListener("click", async () => {
    if (confirm("初期状態に戻しますか？（すべてのデータが失われます）")) {
      // Firestore のデータをリセット
      try {
        await setDoc(doc(db, "config", "data"), initialData);
        console.log("Firestore data reset successful");
      } catch (err) {
        console.error("Firestore reset failed:", err);
      }

      await renderForm(currentTab);
    }
  });

  // 初期化
  (async () => {
    // データベースが空の場合の警告（初回セットアップ用）
    const needsSetup = await checkNeedsSetup();
    if (needsSetup) {
      console.warn(
        "Firestoreに管理者情報が見つかりません。セットアップが必要です。"
      );
    }

    const loginOverlay = document.getElementById("login-overlay");
    const loginForm = document.getElementById("login-form");
    const googleLoginBtn = document.getElementById("google-login-btn");

    // ID/Pass ログイン処理
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const userid = document.getElementById("login-userid").value;
      const pass = document.getElementById("login-pass").value;

      const success = await loginWithIdPass(userid, pass);
      if (success) {
        loginOverlay.style.display = "none";
        await syncTabsData();
        await renderForm(currentTab);
      } else {
        alert("IDまたはパスワードが正しくありません。");
      }
    });

    // Google ログイン処理
    googleLoginBtn.addEventListener("click", async () => {
      try {
        await signInWithPopup(auth, googleProvider);
      } catch (err) {
        alert("Google ログインに失敗しました: " + err.message);
      }
    });

    onAuthStateChanged(auth, async (user) => {
      // カスタム admin_mode か Google 認証ユーザーかをチェック
      const isAdmin = await checkIsAdmin(user);

      if (!isAdmin) {
        loginOverlay.style.display = "flex";
        return;
      }

      // ログイン成功
      loginOverlay.style.display = "none";
      await syncTabsData();
      await renderForm(currentTab);
    });
  })();

  // 参加者リストのレンダリング
  async function renderParticipantsList() {
    formContainer.innerHTML =
      '<div class="admin-loading">参加者データを読み込み中...</div>';

    try {
      const { collection, getDocs, orderBy, query } = await import(
        "firebase/firestore"
      );
      const q = query(
        collection(db, "participants"),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);

      const participants = [];
      querySnapshot.forEach((doc) => {
        participants.push({ id: doc.id, ...doc.data() });
      });

      if (participants.length === 0) {
        formContainer.innerHTML =
          '<p style="text-align: center; color: var(--text-muted); padding: 3rem;">参加者はまだ登録されていません。</p>';
        return;
      }

      const statusLabels = {
        書類確認中: "書類確認中",
        受付完了: "受付完了",
        一次審査中: "一次審査中",
        二次審査中: "二次審査中",
        ファイナリスト: "ファイナリスト",
        入賞者: "入賞者",
        落選: "落選",
        辞退: "辞退",
        その他: "その他",
      };

      let html = `
        <div style="margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center;">
          <h3 style="font-size: 1.125rem; font-weight: 700;">登録者一覧 (${participants.length}名)</h3>
          <button id="export-csv-btn" class="btn btn-sm" style="background: #e2e8f0; color: var(--text-main); font-weight: 600;">CSVエクスポート</button>
        </div>
        <div style="overflow-x: auto; background: white; border-radius: 0.75rem; border: 1px solid var(--border);">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.875rem;">
            <thead>
              <tr style="background: #f8fafc; border-bottom: 1px solid var(--border); text-align: left;">
                <th style="padding: 1rem;">氏名 / 所属</th>
                <th style="padding: 1rem;">チーム / 人数</th>
                <th style="padding: 1rem;">ステータス</th>
                <th style="padding: 1rem;">スライド / 同意</th>
                <th style="padding: 1rem;">登録日</th>
                <th style="padding: 1rem;">操作</th>
              </tr>
            </thead>
            <tbody>
      `;

      participants.forEach((p) => {
        const createdAt = p.createdAt?.toDate
          ? p.createdAt.toDate().toLocaleDateString("ja-JP")
          : "-";
        html += `
          <tr style="border-bottom: 1px solid var(--border);">
            <td style="padding: 1rem;">
              <div style="font-weight: 700; color: var(--text-main);">${
                p.name || "-"
              }</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${
                p.company || "-"
              }<br>${p.organization || "-"}</div>
              <div style="font-size: 0.75rem; margin-top: 0.25rem;"><a href="mailto:${
                p.email
              }" style="color: var(--primary); text-decoration: none;">${
          p.email
        }</a></div>
            </td>
            <td style="padding: 1rem;">
              <div style="font-weight: 600;">${p.teamName || "個人"}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${
                p.teamSize || "-"
              }</div>
            </td>
            <td style="padding: 1rem;">
              <select class="status-select" data-id="${
                p.id
              }" style="padding: 0.4rem; border-radius: 0.4rem; border: 1px solid var(--border); background: white; font-size: 0.75rem;">
                ${Object.entries(statusLabels)
                  .map(
                    ([val, label]) => `
                  <option value="${val}" ${
                      p.status === val ? "selected" : ""
                    }>${label}</option>
                `
                  )
                  .join("")}
              </select>
            </td>
            <td style="padding: 1rem;">
              <div style="margin-bottom: 0.25rem;">
                ${
                  p.slideUrl
                    ? `<a href="${p.slideUrl}" target="_blank" style="color: var(--primary); font-size: 0.75rem;">📄 スライド</a>`
                    : '<span style="color: #cbd5e1; font-size: 0.75rem;">なし</span>'
                }
              </div>
              <div style="font-size: 0.75rem; color: ${
                p.dataConsent === "yes" ? "#10b981" : "#ef4444"
              }; font-weight: 600;">
                同意: ${p.dataConsent === "yes" ? "はい" : "いいえ"}
              </div>
            </td>
            <td style="padding: 1rem; color: var(--text-muted); font-size: 0.75rem;">${createdAt}</td>
            <td style="padding: 1rem;">
              <div style="display: flex; gap: 0.5rem;">
                <button class="edit-btn btn-sm" data-id="${
                  p.id
                }" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; background: #f1f5f9; color: var(--text-main); border: 1px solid var(--border); border-radius: 0.25rem; cursor: pointer;">編集</button>
                <button class="delete-btn btn-sm" data-id="${
                  p.id
                }" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; background: #fee2e2; color: #ef4444; border: 1px solid #fecaca; border-radius: 0.25rem; cursor: pointer;">削除</button>
              </div>
            </td>
          </tr>
        `;
      });

      html += `</tbody></table></div>`;
      formContainer.innerHTML = html;

      // ステータス変更イベント
      formContainer.querySelectorAll(".status-select").forEach((select) => {
        select.addEventListener("change", async (e) => {
          const id = e.target.getAttribute("data-id");
          const newStatus = e.target.value;
          try {
            const { doc, updateDoc, serverTimestamp } = await import(
              "firebase/firestore"
            );
            await updateDoc(doc(db, "participants", id), {
              status: newStatus,
              updatedAt: serverTimestamp(),
            });
            console.log(`Status updated for ${id}: ${newStatus}`);

            // 即時保存の成功を表示
            saveStatus.textContent = "保存しました！";
            saveStatus.style.color = "#10b981";
            setTimeout(() => {
              if (!hasChanges) {
                saveStatus.textContent = "保存済み";
                saveStatus.style.color = "#10b981";
              }
            }, 2000);
          } catch (err) {
            console.error("Status update failed:", err);
            alert("ステータスの更新に失敗しました。");
          }
        });
      });

      // 編集ボタンイベント
      formContainer.querySelectorAll(".edit-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-id");
          const participant = participants.find((p) => p.id === id);
          if (participant) openEditModal(participant);
        });
      });

      // 削除ボタンイベント
      formContainer.querySelectorAll(".delete-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const id = btn.getAttribute("data-id");
          if (
            confirm(
              "この参加データを削除してもよろしいですか？この操作は取り消せません。"
            )
          ) {
            try {
              const { doc, deleteDoc } = await import("firebase/firestore");
              await deleteDoc(doc(db, "participants", id));
              renderParticipantsList();
            } catch (err) {
              console.error("Delete failed:", err);
              alert("削除に失敗しました。");
            }
          }
        });
      });

      // CSVエクスポート
      document
        .getElementById("export-csv-btn")
        ?.addEventListener("click", () => {
          const header = [
            "氏名",
            "姓",
            "名",
            "メール",
            "会社名",
            "所属組織",
            "役職",
            "チーム名",
            "チーム人数",
            "提出スライド",
            "個人情報同意",
            "ステータス",
            "登録日",
          ];
          const rows = participants.map((p) => [
            p.name || "",
            p.lastName || "",
            p.firstName || "",
            p.email || "",
            p.company || "",
            p.organization || "",
            p.role || "",
            p.teamName || "",
            p.teamSize || "",
            p.slideUrl || "",
            p.dataConsent || "",
            statusLabels[p.status] || p.status,
            p.createdAt?.toDate
              ? p.createdAt.toDate().toLocaleString("ja-JP")
              : "",
          ]);

          const csvContent = [header, ...rows]
            .map((e) =>
              e
                .map((field) => `"${String(field).replace(/"/g, '""')}"`)
                .join(",")
            )
            .join("\n");

          const blob = new Blob(["\uFEFF" + csvContent], {
            type: "text/csv;charset=utf-8;",
          });
          const link = document.createElement("a");
          const url = URL.createObjectURL(blob);
          link.setAttribute("href", url);
          link.setAttribute(
            "download",
            `participants_${new Date().toISOString().split("T")[0]}.csv`
          );
          link.style.visibility = "hidden";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        });
    } catch (err) {
      console.error("Participants load failed:", err);
      formContainer.innerHTML = `<p style="color: #ef4444; padding: 2rem;">エラーが発生しました: ${err.message}</p>`;
    }
  }

  // 編集モーダルの表示
  function openEditModal(p) {
    const modal = document.createElement("div");
    modal.id = "edit-participant-modal";
    modal.className = "modal";
    modal.style.display = "flex";
    modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content" style="max-height: 90vh; overflow-y: auto;">
        <div class="modal-header">
          <h2>参加者情報の編集</h2>
          <button class="modal-close" id="edit-modal-close">&times;</button>
        </div>
        <form id="edit-participant-form" class="register-form">
          <div class="form-row">
            <div class="form-group">
              <label>姓</label>
              <input type="text" name="lastName" value="${
                p.lastName || ""
              }" required />
            </div>
            <div class="form-group">
              <label>名</label>
              <input type="text" name="firstName" value="${
                p.firstName || ""
              }" required />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>会社名</label>
              <input type="text" name="company" value="${
                p.company || ""
              }" required />
            </div>
            <div class="form-group">
              <label>所属組織</label>
              <input type="text" name="organization" value="${
                p.organization || ""
              }" required />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>役職</label>
              <input type="text" name="role" value="${p.role || ""}" required />
            </div>
            <div class="form-group">
              <label>メールアドレス</label>
              <input type="email" name="email" value="${
                p.email || ""
              }" required />
            </div>
          </div>
          <div class="form-group">
            <label>参加動機</label>
            <textarea name="motivation" rows="3">${
              p.motivation || ""
            }</textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>チーム名</label>
              <input type="text" name="teamName" value="${p.teamName || ""}" />
            </div>
            <div class="form-group">
              <label>チーム人数</label>
              <select name="teamSize">
                <option value="">選択してください</option>
                <option value="undecided" ${
                  p.teamSize === "undecided" ? "selected" : ""
                }>未定</option>
                ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
                  .map(
                    (n) =>
                      `<option value="${n}" ${
                        p.teamSize == n ? "selected" : ""
                      }>${n}人</option>`
                  )
                  .join("")}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>提出スライド URL</label>
            <input type="url" name="slideUrl" value="${
              p.slideUrl || ""
            }" placeholder="https://..." />
          </div>
          <div class="consent-group">
            <div style="padding: 1rem; background: #f8f9fa; border-radius: 0.5rem; margin-bottom: 1rem;">
              <p style="font-size: 0.875rem; line-height: 1.6; color: var(--text-main); margin: 0 0 1rem 0;">
                ご記入いただいたご登録情報は、協賛パートナーへ提供される場合がございます。お客様のご情報は、各社から商品、サービス、セミナー等に関するご案内をお送りするために使用いたします。個人情報は各社の個人情報保護ポリシーに則って適切に扱われます。
              </p>
              <div style="display: flex; gap: 2rem; align-items: center;">
                <label style="display: inline-flex; align-items: center; cursor: pointer; gap: 0.5rem;">
                  <input type="radio" name="dataConsent" value="yes" ${
                    p.dataConsent === "yes" ? "checked" : ""
                  } required />
                  <span>はい</span>
                </label>
                <label style="display: inline-flex; align-items: center; cursor: pointer; gap: 0.5rem;">
                  <input type="radio" name="dataConsent" value="no" ${
                    p.dataConsent === "no" ? "checked" : ""
                  } required />
                  <span>いいえ</span>
                </label>
              </div>
            </div>
          </div>
          <div class="form-actions" style="margin-top: 2rem;">
            <button type="button" class="btn btn-secondary" id="edit-modal-cancel">キャンセル</button>
            <button type="submit" class="btn btn-primary">更新する</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    modal.querySelector("#edit-modal-close").onclick = closeModal;
    modal.querySelector("#edit-modal-cancel").onclick = closeModal;
    modal.querySelector(".modal-overlay").onclick = closeModal;

    modal.querySelector("#edit-participant-form").onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const updates = {
        lastName: formData.get("lastName"),
        firstName: formData.get("firstName"),
        name: `${formData.get("lastName")} ${formData.get("firstName")}`,
        company: formData.get("company"),
        organization: formData.get("organization"),
        role: formData.get("role"),
        email: formData.get("email"),
        motivation: formData.get("motivation"),
        teamName: formData.get("teamName"),
        teamSize: formData.get("teamSize"),
        slideUrl: formData.get("slideUrl"),
        dataConsent: formData.get("dataConsent"),
        updatedAt: serverTimestamp(),
      };

      try {
        const { doc, updateDoc } = await import("firebase/firestore");
        await updateDoc(doc(db, "participants", p.id), updates);
        closeModal();
        renderParticipantsList();
      } catch (err) {
        console.error("Update failed:", err);
        alert("更新に失敗しました。");
      }
    };
  }

  // ログアウトボタンの追加（DASHBOARD タイトルの横など）
  const dashboardTitle = document.querySelector(".admin-sidebar h2");
  if (dashboardTitle) {
    const logoutBtn = document.createElement("button");
    logoutBtn.textContent = "Logout";
    logoutBtn.className = "btn";
    logoutBtn.style.cssText =
      "margin-top: 1rem; padding: 0.25rem 0.5rem; font-size: 0.75rem; background: #fee2e2; color: #ef4444; border: 1px solid #fecaca;";
    logoutBtn.onclick = logoutAdmin;
    dashboardTitle.after(logoutBtn);
  }
});
