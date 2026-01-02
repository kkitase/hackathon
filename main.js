import { auth, googleProvider, db } from "./firebase.js";
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  doc,
  setDoc,
  serverTimestamp,
  getDoc,
  collection,
  getDocs,
  updateDoc,
  query,
  orderBy,
  arrayUnion,
  arrayRemove,
  increment,
  addDoc,
  onSnapshot,
  where,
  documentId,
} from "firebase/firestore";
import { checkIsAdmin } from "./auth-utils.js";

// ステータス表示名のマッピング
const getStatusLabel = (status) => {
  if (!status) return "";
  const labels = {
    pending: "書類確認中",
    accept: "受付完了",
    "1st_review": "一次審査中",
    "2nd_review": "二次審査中",
    finalist: "ファイナリスト",
    winner_grand: "最優秀賞",
    winner_excellence: "優秀賞",
    rejected: "落選",
    withdrawn: "辞退",
    others: "その他",
  };
  // マッピングにある場合はそれを返し、ない場合はそのまま（既に日本語の場合など）を返す
  return labels[status] || status;
};

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
  title: "ABC AI Hackathon",
  subtitle:
    "未来を創るAIエージェントを構築。Google の AI、Gemini や、Google Cloud を駆使し、次世代のアプリケーションを開発",
  ctaText: "参加登録",
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

// タブデータを取得するヘルパー（Firestore またはデフォルト）
const getTabData = async () => {
  const content = await getContentFromFirestore();
  const firestoreTabs = content?.tabs || {};
  // マージして欠けている部分はデフォルトを使用
  return { ...defaultTabData, ...firestoreTabs };
};

// 参加登録データの管理用
let currentUserParticipantData = null;

// DOM 要素（初期化は DOMContentLoaded で行う）
let contentArea = null;
let userAvatar = null;
let registerModal = null;
let registerForm = null;
let registerMessage = null;

// プロジェクト一覧をレンダリングする
const renderProjectList = async () => {
  contentArea.innerHTML = `
    <div class="fade-in">
      <h2 style="font-size: 1.75rem; margin-bottom: 2rem;">プロジェクト一覧</h2>
      <div id="project-list-container" class="judge-grid">
        <div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
          <p class="text-muted">読み込み中...</p>
        </div>
      </div>
    </div>
  `;

  const container = document.getElementById("project-list-container");
  const user = auth.currentUser;

  try {
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
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 3rem; background: white; border-radius: 1rem; border: 1px solid var(--border);">
          <p class="text-muted">登録されているプロジェクトはまだありません。</p>
        </div>
      `;
      return;
    }

    container.innerHTML = "";

    // 自分のプロジェクトを特定して先頭に持ってくる
    const myIndex = user
      ? participants.findIndex((p) => p.email === user.email)
      : -1;
    if (myIndex > -1) {
      const myData = participants.splice(myIndex, 1)[0];
      participants.unshift(myData);
      currentUserParticipantData = myData;
    } else {
      currentUserParticipantData = null;
    }

    participants.forEach((p, index) => {
      const isMine = user && p.email === user.email;
      const card = document.createElement("div");
      card.className = "judge-card"; // 既存のカードスタイルを流用
      card.style.opacity = "0";
      card.style.transform = "translateY(20px)";
      card.style.background = isMine ? "rgba(59, 130, 246, 0.05)" : "white";
      card.style.border = isMine
        ? "2px solid var(--primary)"
        : "1px solid var(--border)";

      const statusLabel = getStatusLabel(p.status);

      card.innerHTML = `
        <div class="judge-info" style="padding: 1.5rem;">
          <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 1rem; flex-wrap: wrap;">
            ${
              isMine
                ? '<span style="display: inline-block; padding: 0.25rem 0.75rem; background: var(--grad-main); color: white; border-radius: 99px; font-size: 0.75rem; font-weight: 800;">あなたのプロジェクト</span>'
                : ""
            }
            ${
              statusLabel
                ? `<span style="display: inline-block; padding: 0.25rem 0.75rem; background: #ef4444; color: white; border-radius: 99px; font-size: 0.75rem; font-weight: 800;">${statusLabel}</span>`
                : ""
            }
          </div>
          <h3 style="font-size: 1.25rem; margin-bottom: 0.75rem; color: var(--text-main);">${
            p.projectName || "プロジェクト名"
          }</h3>
          <div style="margin-bottom: 1rem; font-size: 0.875rem; line-height: 1.6;">
            <p style="color: var(--text-muted); margin-bottom: 0.25rem;">
              <strong style="color: var(--text-main);">チーム名:</strong> ${
                p.teamName || "未定"
              }
            </p>
            <p style="color: var(--text-muted); margin-bottom: 0.25rem;">
              <strong style="color: var(--text-main);">人数:</strong> ${
                p.teamSize === "メンバー募集中"
                  ? '<span style="color: #f59e0b; font-weight: bold;">メンバ募集中</span>'
                  : p.teamSize || "未定"
              }
            </p>
            <p style="color: var(--text-muted); margin-bottom: 0.25rem;">
              <strong style="color: var(--text-main);">代表者:</strong> ${
                p.name
              }（${p.company}）
            </p>
            <p style="color: var(--text-muted);">
              <strong style="color: var(--text-main);">概要:</strong>
              ${
                p.motivation
                  ? p.motivation.length > 60
                    ? p.motivation.substring(0, 60) + "..."
                    : p.motivation
                  : ""
              }
            </p>
          </div>
          <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 1rem;">
            ${
              p.slideUrl
                ? `<a href="${p.slideUrl}" target="_blank" class="btn btn-secondary" style="padding: 0.5rem 1rem; font-size: 0.875rem;">スライドを見る</a>`
                : '<span class="text-muted" style="font-size: 0.875rem;">スライド未提出</span>'
            }
            ${
              isMine
                ? `<button class="btn btn-primary edit-my-project-btn" style="padding: 0.5rem 1rem; font-size: 0.875rem;">編集する</button>`
                : ""
            }
          </div>

          <div class="project-stats" id="stats-${p.id}">
            <div class="stat-item">
              <span id="like-count-${p.id}">${p.likeCount || 0}人がいいね</span>
            </div>
            <div class="stat-item">
              <span id="comment-count-${p.id}">コメント ${
        p.commentCount || 0
      }件</span>
            </div>
          </div>

          <div class="project-actions">
            <button class="action-btn like-btn ${
              user && p.likes?.includes(user.email) ? "active" : ""
            }" data-id="${p.id}">
              <span>${
                user && p.likes?.includes(user.email)
                  ? "👍 いいね済み"
                  : "👍 いいね！"
              }</span>
            </button>
            <button class="action-btn comment-btn" data-id="${p.id}">
              <span>💬 コメントする</span>
            </button>
          </div>
        </div>
      `;

      container.appendChild(card);

      // アニメーション適用
      setTimeout(() => {
        card.style.transition = "all 0.6s cubic-bezier(0.22, 1, 0.36, 1)";
        card.style.opacity = "1";
        card.style.transform = "translateY(0)";
      }, 50 * index);

      if (isMine) {
        const editBtn = card.querySelector(".edit-my-project-btn");
        if (editBtn) {
          editBtn.onclick = () => {
            openRegisterModalForEdit(p);
          };
        }
      }

      // いいね数ボタン
      const likeCountText = card.querySelector(
        `#like-count-${CSS.escape(p.id)}`
      );
      if (likeCountText) {
        likeCountText.onclick = () => {
          openLikeListModal(p.id);
        };
      }

      // いいねボタン
      card.querySelector(".like-btn").onclick = (e) => {
        const docId = e.currentTarget.getAttribute("data-id");
        toggleLike(docId);
      };

      // コメント数ボタン
      const commentCountText = card.querySelector(
        `#comment-count-${CSS.escape(p.id)}`
      );
      if (commentCountText) {
        commentCountText.onclick = () => {
          openCommentModal(p.id, p.projectName || p.teamName);
        };
      }

      // コメントボタン
      card.querySelector(".comment-btn").onclick = (e) => {
        const docId = e.currentTarget.getAttribute("data-id");
        openCommentModal(docId, p.projectName || p.teamName);
      };
    });
  } catch (error) {
    console.error("Project list rendering error:", error);
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem; background: #fee2e2; border-radius: 1rem; border: 1px solid #f87171; color: #b91c1c;">
        <p>プロジェクト一覧の表示に失敗しました。ブラウザのコンソールで詳細を確認してください。</p>
      </div>
    `;
  }
};

// 編集モードでモーダルを開く
const openRegisterModalForEdit = (data) => {
  const title = document.getElementById("register-modal-title");
  const submitBtn = document.getElementById("register-submit-btn");
  const withdrawBtn = document.getElementById("register-withdraw-btn");

  if (title) title.textContent = "登録情報の編集";
  if (submitBtn) submitBtn.textContent = "更新する";
  if (withdrawBtn) withdrawBtn.style.display = "inline-flex";

  // フォームに値をセット
  const form = document.getElementById("register-form");
  if (form) {
    form.lastName.value = data.lastName || "";
    form.firstName.value = data.firstName || "";
    form.company.value = data.company || "";
    form.organization.value = data.organization || "";
    form.role.value = data.role || "";
    form.email.value = data.email || "";
    form.motivation.value = data.motivation || "";
    form.projectName.value = data.projectName || "";
    form.teamName.value = data.teamName || "";
    form.teamSize.value =
      data.teamSize === "未定"
        ? "undecided"
        : data.teamSize === "メンバー募集中"
        ? "recruiting"
        : data.teamSize || "";
    form.slideUrl.value = data.slideUrl || "";

    if (data.dataConsent === "yes") {
      document.getElementById("consent-yes").checked = true;
    } else {
      document.getElementById("consent-no").checked = true;
    }

    // メールアドレスは変更不可にする（主キーのため）
    form.email.readOnly = true;
    form.email.style.background = "#f1f5f9";

    // ステータスバッジの表示
    const statusBadge = document.getElementById("register-modal-status");
    if (statusBadge) {
      const statusLabel = getStatusLabel(data.status);
      if (statusLabel) {
        statusBadge.textContent = statusLabel;
        statusBadge.style.display = "inline-flex";
      } else {
        statusBadge.style.display = "none";
      }
    }
  }

  registerModal.style.display = "flex";
  document.body.style.overflow = "hidden";
};

// ======================
// いいね・コメント ロジック
// ======================

// いいねトグル
const toggleLike = async (docId) => {
  const user = auth.currentUser;
  if (!user) {
    showSignInModal();
    return;
  }

  const docRef = doc(db, "participants", docId);
  try {
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return;

    const data = docSnap.data();
    const likes = data.likes || [];
    const isLiked = likes.includes(user.email);

    if (isLiked) {
      // いいねを解除
      const likedBy = data.likedBy || {};
      delete likedBy[user.email.replace(/\./g, "_")];
      await updateDoc(docRef, {
        likes: arrayRemove(user.email),
        likeCount: increment(-1),
        likedBy: likedBy,
      });
    } else {
      // いいねを追加（displayNameも保存）
      const emailKey = user.email.replace(/\./g, "_");
      await updateDoc(docRef, {
        likes: arrayUnion(user.email),
        likeCount: increment(1),
        [`likedBy.${emailKey}`]: user.displayName || "匿名ユーザー",
      });
    }

    // UIの即時更新（再レンダリングを待たずに数字を変える）
    const countSpan = document.getElementById(`like-count-${docId}`);
    const likeBtn = document.querySelector(
      `.like-btn[data-id="${CSS.escape(docId)}"]`
    );
    if (countSpan) {
      const currentCount = parseInt(countSpan.textContent) || 0;
      countSpan.textContent = `${
        isLiked ? currentCount - 1 : currentCount + 1
      }人がいいね`;
    }
    if (likeBtn) {
      likeBtn.classList.toggle("active");
      const span = likeBtn.querySelector("span");
      if (span) {
        span.textContent = isLiked ? "👍 いいね！" : "👍 いいね済み";
      }
    }
  } catch (error) {
    console.error("Like error:", error);
  }
};

let activeDocId = null;
let commentUnsubscribe = null;

// コメントモーダルを開く
const openCommentModal = (docId, projectName) => {
  activeDocId = docId;
  const modal = document.getElementById("comment-modal");
  const title = document.getElementById("comment-modal-title");
  const commentList = document.getElementById("comment-list");
  const userAvatar = document.getElementById("current-user-comment-avatar");

  if (title) title.textContent = `${projectName} へのコメント`;
  if (commentList)
    commentList.innerHTML = '<p class="text-muted">読み込み中...</p>';

  // 自分のアバター設定
  if (userAvatar && auth.currentUser) {
    userAvatar.textContent = auth.currentUser.displayName
      ? auth.currentUser.displayName.charAt(0)
      : "?";
  }

  // リアルタイム更新の購読
  if (commentUnsubscribe) commentUnsubscribe();
  const q = query(
    collection(db, "participants", docId, "comments"),
    orderBy("createdAt", "asc")
  );

  commentUnsubscribe = onSnapshot(q, (snapshot) => {
    if (commentList) {
      if (snapshot.empty) {
        commentList.innerHTML =
          '<p class="text-muted" style="text-align: center; padding: 1rem;">まだコメントはありません</p>';
      } else {
        commentList.innerHTML = "";
        snapshot.forEach((doc) => {
          const c = doc.data();
          const div = document.createElement("div");
          div.className = "comment-item";
          const initial = c.userName ? c.userName.charAt(0) : "?";
          const date = c.createdAt
            ? new Date(c.createdAt.toDate()).toLocaleString()
            : "たった今";

          div.innerHTML = `
            <div class="comment-avatar">${initial}</div>
            <div class="comment-bubble">
              <div class="comment-user-info">
                <span class="comment-user">${c.userName || "ユーザー"}</span>
              </div>
              <div class="comment-content">${c.content}</div>
              <div class="comment-date">${date}</div>
            </div>
          `;
          commentList.appendChild(div);
        });
        // 最下部へスクロール
        commentList.scrollTop = commentList.scrollHeight;
      }
    }
  });

  if (modal) modal.style.display = "flex";
  document.body.style.overflow = "hidden";
};

// いいねしたユーザー一覧を表示
const openLikeListModal = async (docId) => {
  const modal = document.getElementById("like-list-modal");
  const listContainer = document.getElementById("like-user-list");
  if (!modal || !listContainer) return;

  listContainer.innerHTML =
    '<div style="padding: 2rem; text-align: center;"><p class="text-muted">読み込み中...</p></div>';
  modal.style.display = "flex";
  document.body.style.overflow = "hidden";

  try {
    const docRef = doc(db, "participants", docId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return;

    const data = docSnap.data();
    const emails = data.likes || [];

    if (emails.length === 0) {
      listContainer.innerHTML =
        '<div style="padding: 2rem; text-align: center;"><p class="text-muted">まだいいねがありません</p></div>';
      return;
    }

    // likedBy マップからユーザー名を取得（新形式）
    const likedBy = data.likedBy || {};

    listContainer.innerHTML = "";
    emails.slice(0, 30).forEach((email) => {
      const emailKey = email.replace(/\./g, "_");
      const displayName = likedBy[emailKey] || email.split("@")[0];
      const initial = displayName.charAt(0).toUpperCase();
      const div = document.createElement("div");
      div.className = "like-user-item";
      div.innerHTML = `
        <div class="like-user-avatar">${initial}</div>
        <div class="like-user-info">
          <span class="like-user-name">${displayName}</span>
        </div>
      `;
      listContainer.appendChild(div);
    });

    if (emails.length > 30) {
      const moreDiv = document.createElement("div");
      moreDiv.style.padding = "1rem";
      moreDiv.style.textAlign = "center";
      moreDiv.style.fontSize = "0.875rem";
      moreDiv.style.color = "var(--text-muted)";
      moreDiv.textContent = `他 ${emails.length - 30} 人`;
      listContainer.appendChild(moreDiv);
    }
  } catch (error) {
    console.error("Fetch likes users error:", error);
    listContainer.innerHTML =
      '<div style="padding: 2rem; text-align: center; color: #ef4444;">情報の取得に失敗しました</div>';
  }
};

// コメント投稿
const submitComment = async () => {
  const user = auth.currentUser;
  const commentText = document.getElementById("comment-text");
  if (!user || !activeDocId || !commentText || !commentText.value.trim())
    return;

  const content = commentText.value.trim();
  const docId = activeDocId;

  try {
    const commentData = {
      userEmail: user.email,
      userName: user.displayName || "匿名",
      content: content,
      createdAt: serverTimestamp(),
    };

    // 自分の参加者データがあれば会社名・役割を追加
    if (currentUserParticipantData) {
      commentData.company = currentUserParticipantData.company || "";
      commentData.role = currentUserParticipantData.role || "";
    }

    await addDoc(
      collection(db, "participants", docId, "comments"),
      commentData
    );

    // コメント数を増やす
    await updateDoc(doc(db, "participants", docId), {
      commentCount: increment(1),
    });

    commentText.value = "";
    commentText.style.height = "auto";
    const submitBtn = document.getElementById("submit-comment-btn");
    if (submitBtn) submitBtn.disabled = true;
  } catch (error) {
    console.error("Comment submit error:", error);
    alert("コメントの投稿に失敗しました。");
  }
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
  contentArea = document.getElementById("tab-content");
  const loginBtn = document.getElementById("login-btn");
  const userProfile = document.getElementById("user-profile");
  userAvatar = document.getElementById("user-avatar");
  const adminLink = document.getElementById("admin-link");
  const menuToggle = document.getElementById("menu-toggle");
  const drawerClose = document.getElementById("drawer-close");
  const mobileDrawer = document.getElementById("mobile-drawer");
  const drawerOverlay = document.getElementById("drawer-overlay");

  // モーダル要素の初期化
  registerModal = document.getElementById("register-modal");
  registerForm = document.getElementById("register-form");
  registerMessage = document.getElementById("register-message");
  const registerModalBtn = document.getElementById("register-modal-btn");
  const registerModalClose = document.getElementById("register-modal-close");
  const registerCancelBtn = document.getElementById("register-cancel-btn");

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

        // 参加登録状況を確認
        try {
          const pDoc = await getDoc(doc(db, "participants", user.email));
          if (pDoc.exists()) {
            currentUserParticipantData = { id: pDoc.id, ...pDoc.data() };
            // ボタンの文言を変更
            const heroCta =
              document.getElementById("hero-cta") ||
              document.getElementById("register-modal-btn");
            if (heroCta) heroCta.textContent = "登録情報確認";
            if (registerBtnHeader)
              registerBtnHeader.textContent = "登録情報確認";
          } else {
            currentUserParticipantData = null;
          }
        } catch (e) {
          console.warn("参加情報の取得に失敗:", e);
        }
      }
    } else {
      currentUserParticipantData = null;
      if (authBtnHeader) authBtnHeader.style.display = "inline-flex";
      if (userProfile) userProfile.style.display = "none";
      if (adminLink) adminLink.style.display = "none";
      const logoutBtnHeader = document.getElementById("logout-btn-header");
      if (logoutBtnHeader) logoutBtnHeader.style.display = "none";
      if (registerBtnHeader) registerBtnHeader.textContent = "参加登録";

      const heroCta = document.getElementById("hero-cta");
      if (heroCta) heroCta.textContent = defaultHeroData.ctaText;
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
      // ヒーローセクションのボタンクリックをシミュレート
      const registerHeroBtn =
        document.getElementById("hero-cta") ||
        document.getElementById("register-modal-btn");
      if (registerHeroBtn) {
        registerHeroBtn.click();
      }
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
      if (currentUserParticipantData) {
        heroCta.textContent = "登録情報確認";
        heroCta.style.display = "inline-block";
      } else if (hero.ctaText) {
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
    if (tabName === "projects") {
      await renderProjectList();
    } else if (currentData[tabName]) {
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
  }, 50);

  // ===========================
  // 参加登録モーダルのイベント設定
  // ===========================

  // モーダルを開く（認証チェック付き）
  registerModalBtn?.addEventListener("click", () => {
    // 認証状態を確認
    const user = auth.currentUser;

    if (!user) {
      // 未ログインの場合はサインインボタンをクリック
      const authBtn = document.getElementById("auth-btn-header");
      if (authBtn) {
        authBtn.click();
      }
      return;
    }

    // 既に登録済みかチェック
    if (currentUserParticipantData) {
      openRegisterModalForEdit(currentUserParticipantData);
      return;
    }

    // ログイン済みの場合はモーダルを開く
    // タイトルとボタンをリセット
    const title = document.getElementById("register-modal-title");
    const submitBtn = document.getElementById("register-submit-btn");
    const withdrawBtn = document.getElementById("register-withdraw-btn");
    if (title) title.textContent = "ハッカソン参加登録";
    if (submitBtn) submitBtn.textContent = "登録する";
    if (withdrawBtn) withdrawBtn.style.display = "none";

    // フォームの状態をリセット（編集モードの残骸を消す）
    if (registerForm && registerForm.email) {
      registerForm.email.readOnly = false;
      registerForm.email.style.background = "";
    }

    registerModal.style.display = "flex";
    document.body.style.overflow = "hidden";

    // メールアドレスを自動入力
    const emailInput = document.getElementById("reg-email");
    if (emailInput && user.email) {
      emailInput.value = user.email;
    }
  });

  // モーダルを閉じる
  const closeRegisterModal = () => {
    if (registerModal) registerModal.style.display = "none";
    document.body.style.overflow = "";
    if (registerForm) {
      registerForm.reset();
      if (registerForm.email) {
        registerForm.email.readOnly = false;
        registerForm.email.style.background = "";
      }
    }
    if (registerMessage) registerMessage.style.display = "none";
    // 取り下げボタンを非表示に戻す
    const withdrawBtn = document.getElementById("register-withdraw-btn");
    if (withdrawBtn) withdrawBtn.style.display = "none";
    // 送信ボタンの状態をリセット
    const submitBtn = document.getElementById("register-submit-btn");
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "登録する";
    }
  };

  registerModalClose?.addEventListener("click", closeRegisterModal);
  registerCancelBtn?.addEventListener("click", closeRegisterModal);

  // 取り下げボタン
  const registerWithdrawBtn = document.getElementById("register-withdraw-btn");
  registerWithdrawBtn?.addEventListener("click", async () => {
    if (!currentUserParticipantData) return;

    const confirmed = confirm(
      "本当に登録を取り下げますか？この操作は元に戻せません。"
    );
    if (!confirmed) return;

    try {
      const { deleteDoc } = await import("firebase/firestore");
      await deleteDoc(
        doc(db, "participants", currentUserParticipantData.email)
      );

      currentUserParticipantData = null;

      // ヒーローセクションとヘッダーのボタンをリセット
      const heroCta = document.getElementById("hero-cta");
      const registerBtnHeader = document.getElementById("register-btn-header");
      if (heroCta) heroCta.textContent = defaultHeroData.ctaText;
      if (registerBtnHeader) registerBtnHeader.textContent = "参加登録";

      if (registerMessage) {
        registerMessage.textContent = "登録を取り下げました。";
        registerMessage.style.display = "block";
        registerMessage.style.color = "#ef4444";
        registerMessage.style.backgroundColor = "#fee2e2";
        registerMessage.style.padding = "1rem";
        registerMessage.style.borderRadius = "0.5rem";
        registerMessage.style.marginTop = "1rem";
      }

      // 2秒後にモーダルを閉じる
      setTimeout(() => {
        closeRegisterModal();
        // プロジェクトタブにいる場合は再読み込み
        if (document.querySelector(".tab-btn[data-tab='projects'].active")) {
          renderProjectList();
        }
      }, 2000);
    } catch (error) {
      console.error("Withdraw error:", error);
      if (registerMessage) {
        registerMessage.textContent = "取り下げに失敗しました。";
        registerMessage.style.display = "block";
        registerMessage.style.color = "#ef4444";
      }
    }
  });

  // オーバーレイクリックで閉じる
  registerModal
    ?.querySelector(".modal-overlay")
    ?.addEventListener("click", closeRegisterModal);

  // フォーム送信
  registerForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const submitBtn = document.getElementById("register-submit-btn");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "送信中...";
    }

    try {
      // フォームデータを取得
      const formData = new FormData(registerForm);
      const lastName = formData.get("lastName")?.trim() || "";
      const firstName = formData.get("firstName")?.trim() || "";
      const name = `${lastName} ${firstName}`; // 姓名を結合
      const teamSizeValue = formData.get("teamSize");

      const data = {
        name,
        lastName,
        firstName,
        email: formData.get("email")?.trim().toLowerCase() || "",
        company: formData.get("company")?.trim() || "",
        organization: formData.get("organization")?.trim() || "",
        role: formData.get("role")?.trim() || "",
        motivation: formData.get("motivation")?.trim() || "",
        projectName: formData.get("projectName")?.trim() || "",
        teamName: formData.get("teamName")?.trim() || "",
        teamSize:
          teamSizeValue === "undecided"
            ? "未定"
            : teamSizeValue === "recruiting"
            ? "メンバー募集中"
            : teamSizeValue
            ? teamSizeValue
            : null,
        slideUrl: formData.get("slideUrl")?.trim() || "",
        dataConsent: formData.get("dataConsent") || "no",
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // 必須項目のバリデーション（役職は任意）
      if (
        !lastName ||
        !firstName ||
        !data.email ||
        !data.company ||
        !data.organization
      ) {
        throw new Error("必須項目を全て入力してください。");
      }

      // メールアドレス形式チェック
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        throw new Error("有効なメールアドレスを入力してください。");
      }

      // 既存データの有無で処理を分岐
      const participantsRef = doc(db, "participants", data.email);

      if (currentUserParticipantData) {
        // 更新処理
        delete data.createdAt; // 作成日は維持
        await updateDoc(participantsRef, data);
        // 更新後のデータで currentUserParticipantData を即座に更新
        currentUserParticipantData = { ...currentUserParticipantData, ...data };
        if (registerMessage)
          registerMessage.textContent = "登録情報を更新しました！";
      } else {
        // 新規登録処理
        // 重複チェック
        const existingDoc = await getDoc(participantsRef);
        if (existingDoc.exists()) {
          throw new Error("このメールアドレスは既に登録されています。");
        }
        await setDoc(participantsRef, data);
        // 新規登録時も currentUserParticipantData を設定
        currentUserParticipantData = { email: data.email, ...data };
        if (registerMessage)
          registerMessage.textContent = "参加登録が完了しました！";
      }

      if (registerMessage) {
        registerMessage.style.display = "block";
        registerMessage.style.color = "#10b981";
        registerMessage.style.backgroundColor = "#d1fae5";
        registerMessage.style.padding = "1rem";
        registerMessage.style.borderRadius = "0.5rem";
        registerMessage.style.marginTop = "1rem";
      }

      // 成功時に一覧を再読み込み（プロジェクトタブにいる場合）
      if (
        currentUserParticipantData ||
        document.querySelector(".tab-btn[data-tab='projects'].active")
      ) {
        await renderProjectList();
      }

      // 3秒後にモーダルを閉じる
      setTimeout(() => {
        closeRegisterModal();
      }, 3000);
    } catch (error) {
      console.error("Registration error:", error);
      if (registerMessage) {
        registerMessage.textContent =
          error.message ||
          "登録中にエラーが発生しました。もう一度お試しください。";
        registerMessage.style.display = "block";
        registerMessage.style.color = "#ef4444";
        registerMessage.style.backgroundColor = "#fee2e2";
        registerMessage.style.padding = "1rem";
        registerMessage.style.borderRadius = "0.5rem";
        registerMessage.style.marginTop = "1rem";
      }

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "登録する";
      }
    }
  });

  // コメントモーダル関連イベント
  const commentModal = document.getElementById("comment-modal");
  const commentModalClose = document.getElementById("comment-modal-close");
  const commentText = document.getElementById("comment-text");
  const submitCommentBtn = document.getElementById("submit-comment-btn");

  if (commentModalClose) {
    commentModalClose.onclick = () => {
      if (commentModal) commentModal.style.display = "none";
      document.body.style.overflow = "auto";
      if (commentUnsubscribe) {
        commentUnsubscribe();
        commentUnsubscribe = null;
      }
    };
  }

  const likeListModal = document.getElementById("like-list-modal");
  const likeListModalClose = document.getElementById("like-list-modal-close");

  if (likeListModalClose) {
    likeListModalClose.onclick = () => {
      if (likeListModal) likeListModal.style.display = "none";
      document.body.style.overflow = "auto";
    };
  }

  window.onclick = (e) => {
    const registerModal = document.getElementById("register-modal");
    if (e.target === commentModal) {
      if (commentModalClose) commentModalClose.click();
    } else if (e.target === registerModal) {
      closeRegisterModal();
    } else if (e.target === likeListModal) {
      if (likeListModalClose) likeListModalClose.click();
    }
  };

  if (commentText) {
    commentText.addEventListener("input", () => {
      commentText.style.height = "auto";
      commentText.style.height = commentText.scrollHeight + "px";
      if (submitCommentBtn) {
        submitCommentBtn.disabled = !commentText.value.trim();
      }
    });
  }

  if (submitCommentBtn) {
    submitCommentBtn.onclick = () => {
      submitComment();
    };
  }
});
