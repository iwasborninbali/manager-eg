/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

// import { onRequest } from "firebase-functions/v2/https"; // Удаляем
import * as logger from "firebase-functions/logger";
// import * as functions from "firebase-functions"; // Неправильный импорт
import * as functions from "firebase-functions/v1"; // Явный импорт v1
// import * as admin from "firebase-admin"; // Старый импорт
import admin from "firebase-admin"; // Новый импорт по умолчанию
import { getFirestore } from "firebase-admin/firestore"; // Импорт для Firestore
// Убираем импорты v2
// import { onDocumentWritten, FirestoreEvent, Change as ChangeV2 } from "firebase-functions/v2/firestore"; 
import { DocumentSnapshot } from "firebase-admin/firestore";
import { Change } from "firebase-functions"; // Change можно оставить так
// import { EventContext } from "firebase-functions/v1"; // Убираем, т.к. используем functions.EventContext
// import { region, EventContext, Change } from "firebase-functions"; // Неправильно
// import firestore from "firebase-functions/v1/firestore"; // Не нужно при импорте * as functions

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

// Инициализация Firebase Admin SDK
// Это позволяет функциям взаимодействовать с Firestore от имени сервисного аккаунта
admin.initializeApp();
// const db = admin.firestore(); // Старый способ получения db
const db = getFirestore(); // Новый способ получения db

/**
 * Интерфейс для данных счета (упрощенный, для функции)
 */
interface InvoiceData {
  projectId?: string;
  amount?: number;
  status?: string;
}

/**
 * Cloud Function v1, которая обновляет агрегированную сумму
 * не отмененных счетов в документе проекта при
 * создании, обновлении или удалении счета.
 * Использует v1 SDK.
 */
export const handleInvoiceWriteUpdateProjectV1 = functions
  .region("europe-west1") // Меняем регион на europe-west1 для теста
  .firestore.document("invoices/{invoiceId}")
  .onWrite(async (change: Change<DocumentSnapshot>, context: functions.EventContext) => { // Используем functions.EventContext
    const invoiceId = context.params.invoiceId; 

    const invoiceDataAfter = change.after.exists ? (change.after.data() as InvoiceData) : null;
    const invoiceDataBefore = change.before.exists ? (change.before.data() as InvoiceData) : null;

    const projectId = invoiceDataAfter?.projectId ?? invoiceDataBefore?.projectId;

    if (!projectId) {
      logger.log(`Invoice ${invoiceId} has no projectId. Skipping update.`);
      return; 
    }

    logger.log(`(v1) Detected change in invoice ${invoiceId} for project ${projectId}. Recalculating total.`);

    const invoicesQuery = db.collection("invoices")
      .where("projectId", "==", projectId)
      .where("status", "!=", "cancelled");

    let totalAmount = 0;
    try {
      const querySnapshot = await invoicesQuery.get();
      querySnapshot.forEach((doc) => {
        const data = doc.data() as InvoiceData;
        const amount = data.amount ?? 0;
        totalAmount += amount;
      });

      logger.log(`(v1) Recalculated total for project ${projectId}: ${totalAmount}`);

      const projectRef = db.collection("projects").doc(projectId);
      await projectRef.update({
        total_non_cancelled_invoice_amount: totalAmount,
      });

      logger.log(`(v1) Successfully updated total_non_cancelled_invoice_amount for project ${projectId} to ${totalAmount}.`);

    } catch (error) {
      logger.error(`(v1) Error updating total for project ${projectId}:`, error);
    }
  }
  );

// Можно добавить другие функции здесь, если они понадобятся
