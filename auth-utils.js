import { auth, db } from "./firebase.js";
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
 * ユーザー名とパスワードでログインする (簡易実装)
 */
export const loginWithIdPass = async (userid, password) => {
  try {
    const adminRef = doc(db, "config", "admin");
    const adminSnap = await getDoc(adminRef);

    if (adminSnap.exists()) {
      const data = adminSnap.data();
      if (data.defaultUser === userid && data.defaultPass === password) {
        // ログイン成功
        localStorage.setItem("admin_mode", "true");
        localStorage.setItem("admin_user", userid);
        return true;
      }
    }
  } catch (error) {
    console.warn("ID/Pass 認証用のデータ取得に失敗しました:", error);
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
  // admin_mode が有効なら管理者とみなす
  if (localStorage.getItem("admin_mode") === "true") return true;

  if (!user) return false;

  try {
    // Google 認証ユーザー等のメールアドレス判定
    const adminRef = doc(db, "config", "admin");
    const adminSnap = await getDoc(adminRef);

    if (adminSnap.exists()) {
      const data = adminSnap.data();
      return data.authorizedEmails?.includes(user.email);
    }
  } catch (error) {
    console.warn(
      "管理者権限の確認に失敗しました（未ログインの可能性があります）:",
      error
    );
  }

  return false;
};
