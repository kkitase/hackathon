import { auth, db } from "../../dev/hackathon-builder/firebase.js";
import { doc, getDoc, setDoc } from "firebase/firestore";

/**
 * 管理者の初期設定が必要かどうかをチェックする
 */
export const checkNeedsSetup = async () => {
  try {
    const adminRef = doc(db, "config", "admin");
    const adminSnap = await getDoc(adminRef);
    return !adminSnap.exists();
  } catch (error) {
    console.warn("管理者設定の確認中にエラー（権限不足など）が発生しました。");
    return false;
  }
};

/**
 * ユーザー名とパスワードでログインする (Firebase Auth 連携版)
 */
export const loginWithIdPass = async (userid, password) => {
  try {
    const { signInWithEmailAndPassword } = await import("firebase/auth");

    // システム管理者の場合は仮想的なメールアドレスに変換
    const email = userid.includes("@") ? userid : `${userid}@admin.local`;

    await signInWithEmailAndPassword(auth, email, password);

    // ログイン成功
    localStorage.setItem("admin_mode", "true");
    localStorage.setItem("admin_user", userid);
    return true;
  } catch (error) {
    console.error("ID/Pass 認証に失敗しました:", error);
  }
  return false;
};

/**
 * ログアウト処理
 */
export const logoutAdmin = async () => {
  await auth.signOut();
  localStorage.removeItem("admin_mode");
  localStorage.removeItem("admin_user");
  window.location.reload();
};

/**
 * ユーザーが管理者かどうかを判定する
 */
export const checkIsAdmin = async (user) => {
  // admin_mode が有効なら管理者とみなす（ID/Password ログイン直後など）
  if (localStorage.getItem("admin_mode") === "true") {
    return true;
  }

  if (!user) return false;

  try {
    // Firestore から管理者情報を取得
    const adminRef = doc(db, "config", "admin");
    const adminSnap = await getDoc(adminRef);

    if (adminSnap.exists()) {
      const data = adminSnap.data();

      // ブートストラップユーザーか、許可されたメールアドレスかを判定
      const isBootstrap = user.email === data.bootstrapEmail;
      const isAuthorized = data.authorizedEmails?.includes(user.email);

      if (isBootstrap || isAuthorized) {
        // セッションを維持するためにフラグをセット
        localStorage.setItem("admin_mode", "true");
        localStorage.setItem("admin_user", user.email || "admin");
        return true;
      }
    }
  } catch (error) {
    console.warn(
      "管理者権限の確認中にエラーが発生しました。ログイン直後の場合は admin_mode フラグによりアクセスが許可される場合があります:",
      error
    );
    // すでに localStorage にセットされている場合は true を返しているため、ここでは false で良い
  }

  return false;
};
