import { auth, googleProvider, db } from "./firebase.js";
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { checkIsAdmin } from "./auth-utils.js";

// タブコンテンツのフォールバック（Firestore にデータがない場合のみ表示）
const defaultTabData = {
  overview: `
    <div class="fade-in">
      <h2 style="font-size: 1.75rem; margin-bottom: 2rem;">プロジェクト概要</h2>
      <div style="background: white; padding: 2.5rem; border-radius: 1.25rem; border: 1px solid var(--border); text-align: center; color: var(--text-muted);">
        <p>コンテンツを読み込んでいます...</p>
      </div>
    </div>
  `,
  schedule: `
    <div class="fade-in">
      <h2 style="font-size: 1.75rem; margin-bottom: 2rem;">スケジュール</h2>
      <div style="background: white; padding: 2.5rem; border-radius: 1.25rem; border: 1px solid var(--border); text-align: center; color: var(--text-muted);">
        <p>コンテンツを読み込んでいます...</p>
      </div>
    </div>
  `,
  judges: `
    <div class="judge-section fade-in">
      <h2 style="font-size: 1.75rem; margin-bottom: 2rem; display: flex; align-items: center; gap: 0.75rem;">
        <span style="font-size: 1.5rem;">🔍</span> 審査員
      </h2>
      <div style="background: white; padding: 2.5rem; border-radius: 1.25rem; border: 1px solid var(--border); text-align: center; color: var(--text-muted);">
        <p>コンテンツを読み込んでいます...</p>
      </div>
    </div>
  `,
  updates: `
    <div class="fade-in">
      <h2 style="font-size: 1.75rem; margin-bottom: 2rem;">更新情報</h2>
      <div style="background: white; padding: 2.5rem; border-radius: 1.25rem; border: 1px solid var(--border); text-align: center; color: var(--text-muted);">
        <p>コンテンツを読み込んでいます...</p>
      </div>
    </div>
  `,
  prizes: `
    <div class="fade-in">
      <h2>プライズ</h2>
      <div style="background: white; padding: 2rem; border-radius: 1rem; border: 1px solid var(--border); text-align: center; color: var(--text-muted);">
        <p>コンテンツを読み込んでいます...</p>
      </div>
    </div>
  `,
  rules: `
    <div class="fade-in">
      <h2>ルール</h2>
      <div style="background: white; padding: 2rem; border-radius: 1rem; border: 1px solid var(--border); text-align: center; color: var(--text-muted);">
        <p>コンテンツを読み込んでいます...</p>
      </div>
    </div>
  `,
  projects: `
    <div class="fade-in">
      <h2>プロジェクト</h2>
      <div style="background: white; padding: 2rem; border-radius: 1rem; border: 1px solid var(--border); text-align: center; color: var(--text-muted);">
        <p>コンテンツを読み込んでいます...</p>
      </div>
    </div>
  `,
  faq: `
    <div class="fade-in">
      <h2>FAQ</h2>
      <div style="background: white; padding: 2rem; border-radius: 1rem; border: 1px solid var(--border); text-align: center; color: var(--text-muted);">
        <p>コンテンツを読み込んでいます...</p>
      </div>
    </div>
  `,
};

// デフォルトのヒーローデータ
const defaultHeroData = {
  title: "第3回 AI Agent Hackathon with Google Cloud",
  subtitle:
    "未来を創るAIエージェントの競演。Google Cloudのパワーを使い、次世代のソリューションを開発せよ。",
  ctaText: "今すぐ申し込む →",
};

// Firestore からコンテンツを取得（キャッシュ付き）
let contentCache = null;
const getContentFromFirestore = async () => {
  if (contentCache) return contentCache;

  try {
    const contentDoc = await getDoc(doc(db, "config", "content"));
    if (contentDoc.exists()) {
      contentCache = contentDoc.data();
      return contentCache;
    }
  } catch (error) {
    console.warn("Firestore からのコンテンツ取得に失敗:", error);
  }
  return null;
};

// タブデータを取得（Firestore 優先）
const getTabData = async () => {
  const firestoreContent = await getContentFromFirestore();
  if (firestoreContent && firestoreContent.tabs) {
    return firestoreContent.tabs;
  }
  return defaultTabData;
};

// Auth Functions
const login = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    console.log("Logged in:", user);

    try {
      // Firestore にユーザー情報を保存
      await setDoc(
        doc(db, "users", user.uid),
        {
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
          lastLogin: serverTimestamp(),
        },
        { merge: true }
      );
      console.log("User info saved to Firestore");
    } catch (dbError) {
      console.error("Firestore Error:", dbError);
      console.warn(
        "ユーザー情報の保存に失敗しました。Firestoreの設定を確認してください。"
      );
    }
  } catch (authError) {
    console.error("Login Error Details:", authError);
    if (authError.code === "auth/operation-not-allowed") {
      alert(
        "Google 認証が有効になっていません。Firebase Console で Authentication を有効にしてください。"
      );
    } else {
      alert(
        `ログインに失敗しました (${authError.code})。詳細はコンソールを確認してください。`
      );
    }
  }
};

const logout = async () => {
  try {
    await signOut(auth);
    console.log("Logged out");
  } catch (error) {
    console.error("Logout Error:", error);
  }
};

/**
 * 新しいサインインモーダル（2ステップ）を表示する
 */
const showSignInModal = () => {
  const existing = document.getElementById("auth-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "auth-modal";
  modal.className = "custom-modal-overlay";

  const renderStep1 = () => {
    modal.innerHTML = `
      <div class="custom-modal-content">
        <button class="modal-close-btn">&times;</button>
        <h2 class="modal-title">申し込み前にサインインをお願いします</h2>
        <p class="modal-subtitle">To register for events.</p>
        <div class="modal-actions">
          <button id="auth-google-btn" class="btn-auth-google">Google Account でサインインする</button>
          <button id="auth-email-trigger" class="btn-auth-outline">他のメールアドレスでサインインする</button>
        </div>
        <p class="modal-footer">Privacy Policy</p>
      </div>
    `;
    setupEvents();
  };

  const renderStep2 = () => {
    modal.innerHTML = `
      <div class="custom-modal-content">
        <button class="modal-close-btn">&times;</button>
        <h2 class="modal-title">アカウントを作成する</h2>
        <div class="modal-form">
          <div class="form-group">
            <label>メールアドレスをご記入ください</label>
            <input type="email" id="auth-email-input" placeholder="email@example.com">
          </div>
          <div class="form-group">
            <label>パスワードをご記入ください *</label>
            <input type="password" id="auth-pass-input" placeholder="••••••••">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>名 *</label>
              <input type="text" id="auth-first-name" placeholder="名">
            </div>
            <div class="form-group">
              <label>姓 *</label>
              <input type="text" id="auth-last-name" placeholder="姓">
            </div>
          </div>
          <div class="form-footer-actions">
            <button id="auth-back" class="btn-link">戻る</button>
            <button id="auth-next" class="btn-primary-blue">次へ</button>
          </div>
        </div>
        <p class="modal-footer">Privacy Policy</p>
      </div>
    `;
    setupEventsStep2();
  };

  const setupEvents = () => {
    modal.querySelector(".modal-close-btn").onclick = () => modal.remove();
    modal.querySelector("#auth-google-btn").onclick = () => {
      login();
      modal.remove();
    };
    modal.querySelector("#auth-email-trigger").onclick = () => renderStep2();
  };

  const setupEventsStep2 = () => {
    modal.querySelector(".modal-close-btn").onclick = () => modal.remove();
    modal.querySelector("#auth-back").onclick = () => renderStep1();
    modal.querySelector("#auth-next").onclick = () => {
      const email = modal.querySelector("#auth-email-input").value;
      if (email) {
        alert("アカウント作成機能は近日公開予定です！");
      }
    };
  };

  renderStep1();
  document.body.appendChild(modal);
};

const showAdminLoginModal = () => {
  // 既存のモーダルを削除
  const existing = document.getElementById("admin-login-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "admin-login-modal";
  modal.style = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
        display: flex; align-items: center; justify-content: center; z-index: 10000;
        font-family: 'Inter', sans-serif;
    `;

  modal.innerHTML = `
        <div style="background: white; padding: 2.5rem; border-radius: 1.5rem; width: 100%; max-width: 400px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);">
            <h2 style="margin-bottom: 1.5rem; font-size: 1.5rem; font-weight: 800; color: var(--text-main);">Admin Access</h2>
            <div style="margin-bottom: 1.25rem;">
                <label style="display: block; font-size: 0.875rem; font-weight: 600; color: var(--text-muted); margin-bottom: 0.5rem;">User ID</label>
                <input type="text" id="admin-uid-input" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 0.75rem; font-size: 1rem;" placeholder="userid">
            </div>
            <div style="margin-bottom: 2rem; position: relative;">
                <label style="display: block; font-size: 0.875rem; font-weight: 600; color: var(--text-muted); margin-bottom: 0.5rem;">Password</label>
                <div style="position: relative;">
                    <input type="password" id="admin-pw-input" style="width: 100%; padding: 0.75rem; padding-right: 3rem; border: 1px solid var(--border); border-radius: 0.75rem; font-size: 1rem;" placeholder="••••••••">
                    <button id="toggle-pw-btn" style="position: absolute; right: 0.75rem; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--text-muted); font-size: 0.75rem; font-weight: 600;">表示</button>
                </div>
            </div>
            <div style="display: flex; gap: 1rem;">
                <button id="close-modal-btn" style="flex: 1; padding: 0.875rem; background: #f1f5f9; border: none; border-radius: 0.75rem; font-weight: 600; color: var(--text-muted); cursor: pointer;">キャンセル</button>
                <button id="submit-login-btn" style="flex: 1; padding: 0.875rem; background: var(--grad-main); color: white; border: none; border-radius: 0.75rem; font-weight: 600; cursor: pointer;">OK</button>
            </div>
        </div>
    `;

  document.body.appendChild(modal);

  const uidInput = document.getElementById("admin-uid-input");
  const pwInput = document.getElementById("admin-pw-input");
  const toggleBtn = document.getElementById("toggle-pw-btn");
  const submitBtn = document.getElementById("submit-login-btn");
  const closeBtn = document.getElementById("close-modal-btn");

  toggleBtn.addEventListener("click", () => {
    const isShown = pwInput.type === "text";
    pwInput.type = isShown ? "password" : "text";
    toggleBtn.textContent = isShown ? "表示" : "隠す";
  });

  submitBtn.addEventListener("click", () => {
    loginAdmin(uidInput.value, pwInput.value);
  });

  closeBtn.addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });

  uidInput.focus();
};

document.addEventListener("DOMContentLoaded", () => {
  const tabButtons = document.querySelectorAll(".tab-btn");
  const contentArea = document.getElementById("tab-content");
  const loginBtn = document.getElementById("login-btn");
  const userProfile = document.getElementById("user-profile");
  const userAvatar = document.getElementById("user-avatar");
  const adminLink = document.getElementById("admin-link");
  const menuToggle = document.getElementById("menu-toggle");
  const drawerClose = document.getElementById("drawer-close");
  const mobileDrawer = document.getElementById("mobile-drawer");
  const drawerOverlay = document.getElementById("drawer-overlay");

  const toggleDrawer = (show) => {
    mobileDrawer.classList.toggle("active", show);
    drawerOverlay.classList.toggle("active", show);
    document.body.style.overflow = show ? "hidden" : "";
  };

  if (menuToggle)
    menuToggle.addEventListener("click", () => toggleDrawer(true));
  if (drawerClose)
    drawerClose.addEventListener("click", () => toggleDrawer(false));
  if (drawerOverlay)
    drawerOverlay.addEventListener("click", () => toggleDrawer(false));

  // Auth State Observer
  onAuthStateChanged(auth, async (user) => {
    const isAdminMode = localStorage.getItem("admin_mode") === "true";

    const authBtnHeader = document.getElementById("auth-btn-header");
    const userProfile = document.getElementById("user-profile");
    const registerBtnHeader = document.getElementById("register-btn-header");
    const adminLink = document.getElementById("admin-link");

    if (user || isAdminMode) {
      if (authBtnHeader) authBtnHeader.style.display = "none";
      if (userProfile) userProfile.style.display = "flex";

      const logoutBtnHeader = document.getElementById("logout-btn-header");
      if (logoutBtnHeader) logoutBtnHeader.style.display = "inline-flex";

      if (isAdminMode) {
        if (userAvatar) {
          userAvatar.style.backgroundImage = "none";
          userAvatar.style.backgroundColor = "var(--primary)";
        }
        if (adminLink) adminLink.style.display = "inline-flex";
      } else {
        if (userAvatar)
          userAvatar.style.backgroundImage = `url('${user.photoURL}')`;
        const isAdmin = await checkIsAdmin(user);
        if (adminLink)
          adminLink.style.display = isAdmin ? "inline-flex" : "none";
      }
    } else {
      if (authBtnHeader) authBtnHeader.style.display = "inline-flex";
      if (userProfile) userProfile.style.display = "none";
      if (adminLink) adminLink.style.display = "none";
      const logoutBtnHeader = document.getElementById("logout-btn-header");
      if (logoutBtnHeader) logoutBtnHeader.style.display = "none";
    }
  });

  const authBtnHeader = document.getElementById("auth-btn-header");
  if (authBtnHeader) {
    authBtnHeader.addEventListener("click", (e) => {
      e.preventDefault();
      showSignInModal();
    });
  }

  const registerBtnHeader = document.getElementById("register-btn-header");
  if (registerBtnHeader) {
    registerBtnHeader.addEventListener("click", (e) => {
      e.preventDefault();
      alert("申し込みページへ移動します。");
    });
  }

  const logoutBtnHeader = document.getElementById("logout-btn-header");
  if (logoutBtnHeader) {
    logoutBtnHeader.addEventListener("click", (e) => {
      e.preventDefault();
      localStorage.removeItem("admin_mode");
      logout();
    });
  }

  // ヒーローセクションの反映処理（Firestore から取得）
  const loadHeroData = async () => {
    const heroContent = document.querySelector(".hero-content");
    const heroTitle = document.getElementById("hero-title");
    const heroSubtitle = document.getElementById("hero-subtitle");
    const heroCta = document.getElementById("hero-cta");

    // Firestore からコンテンツを取得
    const content = await getContentFromFirestore();
    const hero = content?.hero || defaultHeroData;

    if (heroTitle) {
      heroTitle.innerHTML = hero.title || defaultHeroData.title;
    }
    if (heroSubtitle) {
      heroSubtitle.textContent = hero.subtitle || defaultHeroData.subtitle;
    }
    // CTA ボタン（テキストが設定されている場合のみ表示）
    if (heroCta) {
      if (hero.ctaText) {
        heroCta.textContent = hero.ctaText;
        heroCta.style.display = "inline-block";
      } else {
        heroCta.style.display = "none";
      }
    }

    // データ読み込み完了後にヒーローコンテンツを表示
    if (heroContent) {
      heroContent.style.opacity = "1";
    }
  };

  // OGP データの読み込み（タイトルとメタタグを Firestore から設定）
  const loadSocialData = async () => {
    try {
      const ogpDoc = await getDoc(doc(db, "config", "ogp"));
      if (ogpDoc.exists()) {
        const ogp = ogpDoc.data();

        // タイトルを設定
        if (ogp.ogTitle) {
          document.title = ogp.ogTitle;
          const ogTitleTag = document.getElementById("meta-og-title");
          if (ogTitleTag) ogTitleTag.setAttribute("content", ogp.ogTitle);
        }

        // 説明を設定
        if (ogp.ogDescription) {
          const ogDescTag = document.getElementById("meta-og-description");
          if (ogDescTag) ogDescTag.setAttribute("content", ogp.ogDescription);
        }

        // 画像を設定
        if (ogp.ogImage) {
          const ogImageTag = document.getElementById("meta-og-image");
          if (ogImageTag) ogImageTag.setAttribute("content", ogp.ogImage);
        }
      }
    } catch (error) {
      console.warn("OGP データの読み込みに失敗:", error);
    }
  };

  const switchTab = async (tabName) => {
    const currentData = await getTabData();
    // Update Buttons (Header & Drawer)
    const allTabBtns = document.querySelectorAll(".tab-btn");
    allTabBtns.forEach((btn) => {
      if (btn.getAttribute("data-tab") === tabName) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    // Update Content
    if (currentData[tabName]) {
      contentArea.innerHTML = currentData[tabName];
      // Re-apply animations for new elements
      const newCards = contentArea.querySelectorAll(".judge-card");
      newCards.forEach((card, index) => {
        card.style.opacity = "0";
        card.style.transform = "translateY(20px)";
        setTimeout(() => {
          card.style.transition = "all 0.6s cubic-bezier(0.22, 1, 0.36, 1)";
          card.style.opacity = "1";
          card.style.transform = "translateY(0)";
        }, 100 * index);
      });
    } else {
      contentArea.innerHTML = `
                <div style="text-align: center; padding: 4rem; color: var(--text-muted);">
                    <p style="font-size: 2rem; margin-bottom: 1rem;">🚧</p>
                    <p>このセクションは現在準備中です。(${tabName})</p>
                </div>
            `;
    }

    // データ読み込み完了後にタブコンテンツを表示
    contentArea.style.opacity = "1";
  };

  const allTabBtns = document.querySelectorAll(".tab-btn");
  allTabBtns.forEach((button) => {
    button.addEventListener("click", async () => {
      const tabName = button.getAttribute("data-tab");
      await switchTab(tabName);
      // ドロワー内のボタンなら閉じる
      if (button.closest(".mobile-drawer")) {
        toggleDrawer(false);
      }
    });
  });

  // 初期化処理を非同期で行う
  (async () => {
    await loadHeroData();
    await loadSocialData();
    // 最初のタブを表示（審査員がデフォルト）
    await switchTab("overview");
  })();

  // Add scroll effect to header
  const header = document.querySelector("header");
  window.addEventListener("scroll", () => {
    if (window.scrollY > 20) {
      header.style.boxShadow = "var(--shadow-md)";
      header.style.padding = "2px 0";
    } else {
      header.style.boxShadow = "none";
      header.style.padding = "0";
    }
  });

  // Initial load animations
  const initialElements = document.querySelectorAll(".hero > *");
  initialElements.forEach((el, index) => {
    el.style.opacity = "0";
    el.style.transform = "translateY(20px)";
    setTimeout(() => {
      el.style.transition = "all 0.6s cubic-bezier(0.22, 1, 0.36, 1)";
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    }, 100 * index);
  });

  /**
   * メニューが溢れているかチェックし、ハンバーガーメニューに切り替える
   */
  const checkMenuOverflow = () => {
    const tabsNav = document.querySelector(".tabs-nav");
    const menuToggle = document.getElementById("menu-toggle");

    if (!tabsNav || !menuToggle) return;

    // 一旦リセット
    tabsNav.style.display = "flex";
    menuToggle.style.display = "none";

    // メニュー幅をチェック
    const isOverflowing = tabsNav.scrollWidth > tabsNav.clientWidth + 20;

    if (isOverflowing || window.innerWidth < 1200) {
      tabsNav.style.display = "none";
      menuToggle.style.display = "block";
    } else {
      tabsNav.style.display = "flex";
      menuToggle.style.display = "none";
    }

    const navLinks = document.querySelector(".nav-links");
    if (navLinks) navLinks.classList.add("ready");
  };

  window.addEventListener("resize", checkMenuOverflow);
  // 初期リサイズ実行
  setTimeout(() => {
    checkMenuOverflow();
    updateMetaTags();
  }, 50);
});
