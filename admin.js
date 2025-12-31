import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
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
      <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center;">
        <div style="background: white; padding: 2rem; border-radius: 1rem; max-width: 400px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);">
          <h3 style="margin-bottom: 1rem; color: #ef4444; font-size: 1.25rem;">${title}</h3>
          <p style="margin-bottom: 1.5rem; color: #374151; line-height: 1.6;">${message}</p>
          <button id="modal-close-btn" style="width: 100%; padding: 0.75rem; background: var(--grad-main); color: white; border: none; border-radius: 0.5rem; font-size: 1rem; cursor: pointer;">閉じる</button>
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
      notice: "",
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
                <p style="margin-bottom: 1.5rem;">${d.description}</p>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-top: 2rem;">
                    <div style="padding: 1.5rem; background: var(--background); border-radius: 1rem;">
                        <h4 style="margin-bottom: 0.5rem; color: var(--primary);">テーマ</h4>
                        <p style="font-size: 0.9375rem;">${d.theme}</p>
                    </div>
                    <div style="padding: 1.5rem; background: var(--background); border-radius: 1rem;">
                        <h4 style="margin-bottom: 0.5rem; color: var(--primary);">対象技術</h4>
                        <p style="font-size: 0.9375rem;">${d.tech}</p>
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
                    <p style="color: var(--text-muted); font-size: 0.9375rem;">${
                      item.description
                    }</p>
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
                    <div class="judge-avatar" style="background-image: url('${j.avatar}'); background-size: cover;"></div>
                    <div class="judge-info">
                        <h3>${j.name}</h3>
                        <p class="judge-title">${j.title}</p>
                        <p class="judge-bio">${j.bio}</p>
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
                <div style="background: white; padding: 1.5rem; border-radius: 1rem; border: 1px solid var(--border); display: flex; align-items: center; gap: 1rem;">
                    <span style="font-size: 0.8125rem; color: var(--primary); font-weight: 700; background: rgba(59, 130, 246, 0.1); padding: 0.25rem 0.75rem; border-radius: 999px; flex-shrink: 0;">${u.tag}</span>
                    <span style="font-size: 0.875rem; color: var(--text-muted); flex-shrink: 0;">${u.date}</span>
                    <span style="font-weight: 500;">${u.text}</span>
                </div>`
                  )
                  .join("")}
            </div>
        </div>`;

  const generatePrizesHtml = (items) => `
        <div class="fade-in">
            <h2 style="font-size: 1.75rem; margin-bottom: 2rem;">プライズ</h2>
            <div style="display: grid; gap: 1.5rem;">
                ${items
                  .map(
                    (p) => `
                <div style="background: white; padding: 2rem; border-radius: 1rem; border: 1px solid var(--border);">
                    <h3 style="color: var(--primary); margin-bottom: 0.5rem;">${p.title}</h3>
                    <p>${p.description}</p>
                </div>`
                  )
                  .join("")}
            </div>
        </div>`;

  const generateRulesHtml = (items) => `
        <div class="fade-in">
            <h2 style="font-size: 1.75rem; margin-bottom: 2rem;">ルール</h2>
            <ul style="background: white; padding: 2rem; border-radius: 1rem; border: 1px solid var(--border); list-style: disc; padding-left: 3rem;">
                ${items
                  .map(
                    (r) => `<li style="margin-bottom: 0.75rem;">${r.text}</li>`
                  )
                  .join("")}
            </ul>
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
                <div style="background: white; padding: 1.5rem; border-radius: 1rem; border: 1px solid var(--border);">
                    <h4 style="margin-bottom: 0.5rem; color: var(--primary);">Q. ${f.question}</h4>
                    <p>A. ${f.answer}</p>
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
    hasChanges = true;
    updateSaveButtonState();
  };

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
                    </div>
                    <div class="form-group">
                        <label>注意書き（ボタン下のテキスト）</label>
                        <input type="text" class="form-input" id="field-hero-notice" value="${h.notice}" />
                    </div>`;
        break;
      case "overview":
        html = `
                    <div class="form-group">
                        <label>説明文</label>
                        <textarea class="form-input form-textarea" id="field-description" style="min-height: 100px;">${data.overview.description}</textarea>
                    </div>
                    <div class="form-group">
                        <label>テーマ</label>
                        <input type="text" class="form-input" id="field-theme" value="${data.overview.theme}" />
                    </div>
                    <div class="form-group">
                        <label>対象技術</label>
                        <input type="text" class="form-input" id="field-tech" value="${data.overview.tech}" />
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
                        <textarea class="form-input field-desc" style="min-height: 60px;" placeholder="説明">${
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
                        <textarea class="form-input field-bio" style="min-height: 60px;" placeholder="プロフィール">${j.bio}</textarea>
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
                        <div style="display: grid; grid-template-columns: 100px 1fr 150px; gap: 1rem; margin-bottom: 1rem;">
                            <input type="text" class="form-input field-tag" value="${
                              u.tag
                            }" placeholder="タグ" />
                            <input type="text" class="form-input field-text" value="${
                              u.text
                            }" placeholder="内容" />
                            <input type="date" class="form-input field-date" value="${toInputFormat(
                              u.date
                            )}" />
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
                        <input type="text" class="form-input field-text" value="${r.text}" placeholder="ルール項目" />
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
                        <input type="text" class="form-input field-question" value="${f.question}" placeholder="質問" style="margin-bottom: 1rem;" />
                        <textarea class="form-input field-answer" style="min-height: 60px;" placeholder="回答">${f.answer}</textarea>
                        <hr style="margin: 1.5rem 0; border: none; border-top: 1px solid var(--border);" />
                    </div>`
          )
          .join("")}</div>
                    <button type="button" id="add-faq-item" class="btn" style="background: #e2e8f0; color: var(--text-main);">+ FAQを追加</button>`;
        break;
      case "social":
        const s = data.social || {
          ogTitle: "",
          ogDescription: "",
          ogImage: "",
        };
        html = `
            <div class="form-group">
                <label>SNS用タイトル (og:title)</label>
                <input type="text" class="form-input" id="field-social-title" value="${s.ogTitle}" />
            </div>
            <div class="form-group">
                <label>SNS用説明文 (og:description)</label>
                <textarea class="form-input" id="field-social-desc" style="min-height: 80px;">${s.ogDescription}</textarea>
            </div>
            <div class="form-group">
                <label>SNS用画像 (og:image) URL</label>
                <div style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1rem;">
                    <input type="text" class="form-input" id="field-social-image" value="${s.ogImage}" placeholder="https://example.com/image.jpg" />
                    <div class="social-image-preview" style="width: 240px; height: 126px; border-radius: 0.5rem; background: #e2e8f0; background-image: url('${s.ogImage}'); background-size: cover; background-position: center; border: 1px solid var(--border); flex-shrink: 0;"></div>
                    <p style="font-size: 0.75rem; color: var(--text-muted);">1200x630px 推奨。画像の直接リンクを入力してください。</p>
                </div>
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

    // 入力フィールドに変更検知を設定
    formContainer.querySelectorAll("input, textarea").forEach((el) => {
      el.addEventListener("input", markChanged);
    });
    formContainer.querySelectorAll('input[type="checkbox"]').forEach((el) => {
      el.addEventListener("change", markChanged);
    });

    // 画像アップロードの処理（共通化または追加）
    const handleImageUpload = (fileInput, hiddenInputId, previewClass) => {
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
          // OGPは 1200x630 が一般的だが、ここではプレビュー用にリサイズ
          const width = hiddenInputId === "field-social-image" ? 1200 : 150;
          const height = hiddenInputId === "field-social-image" ? 630 : 150;
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");

          // 中心を切り抜き or フィット
          if (hiddenInputId === "field-social-image") {
            // アスペクト比を維持してカバー
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

          // 修正点: ブロック内の要素を優先的に探す（複数項目ある場合に対応）
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
    };

    formContainer
      .querySelectorAll(".field-avatar-file")
      .forEach((input) => handleImageUpload(input, "", "avatar-preview"));
    const socialInput = document.getElementById("field-social-image-file");
    if (socialInput)
      handleImageUpload(
        socialInput,
        "field-social-image",
        "social-image-preview"
      );

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
          notice: document.getElementById("field-hero-notice")?.value || "",
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
        ].map((block) => ({
          date:
            toDisplayFormat(block.querySelector(".field-date")?.value) || "",
          title: block.querySelector(".field-title")?.value || "",
          description: block.querySelector(".field-desc")?.value || "",
          active: block.querySelector(".field-active")?.checked || false,
        }));
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
        ].map((block) => ({
          tag: block.querySelector(".field-tag")?.value || "",
          text: block.querySelector(".field-text")?.value || "",
          date:
            toDisplayFormat(block.querySelector(".field-date")?.value) || "",
        }));
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
          question: block.querySelector(".field-question")?.value || "",
          answer: block.querySelector(".field-answer")?.value || "",
        }));
        break;
      case "social":
        data.social = {
          ogTitle: document.getElementById("field-social-title")?.value || "",
          ogDescription:
            document.getElementById("field-social-desc")?.value || "",
          ogImage: document.getElementById("field-social-image")?.value || "",
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
