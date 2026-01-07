import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { resolve } from "path";

const keyPath = resolve("serviceAccountKey.json");
const serviceAccount = JSON.parse(readFileSync(keyPath, "utf-8"));

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

async function checkAndAddAdmin() {
  const adminDoc = db.doc("config/admin");
  const snapshot = await adminDoc.get();
  const targetEmail = "kkitase@makaninlabs.com";

  if (!snapshot.exists) {
    console.log("admin document does not exist. creating...");
    await adminDoc.set({
      authorizedEmails: [targetEmail],
      createdAt: new Date().toISOString(),
    });
    console.log(`Added ${targetEmail} as the first admin.`);
  } else {
    const data = snapshot.data();
    console.log("Current authorized emails:", data.authorizedEmails);
    if (!data.authorizedEmails.includes(targetEmail)) {
      console.log(`Adding ${targetEmail} to authorized emails...`);
      const newEmails = [...data.authorizedEmails, targetEmail];
      await adminDoc.update({ authorizedEmails: newEmails });
      console.log("Update successful.");
    } else {
      console.log(`${targetEmail} is already an admin.`);
    }
  }
}

checkAndAddAdmin().catch(console.error);
