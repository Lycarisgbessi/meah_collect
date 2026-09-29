// ============================================================
// Mailer — sorties e-mails applicatives (E1..E12).
// En l'absence de configuration SMTP, les messages sont tracés
// dans la console serveur (journal) — JAMAIS renvoyés au client.
// Brancher un vrai transporteur (SMTP/Nodemailer…) ici en production.
// ============================================================

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

const FROM = process.env.MAIL_FROM || "MEAH COLLECT <no-reply@meahcollect.fr>";

export async function sendMail(msg: MailMessage): Promise<void> {
  if (process.env.SMTP_URL) {
    // Point de branchement transporteur réel (non inclus dans ce périmètre).
    console.warn("[mailer] SMTP_URL défini mais aucun transporteur configuré — message tracé dans le journal.");
  }
  // Traçage serveur : unique canal de sortie en mode démonstration.
  console.log(`[mailer] → ${msg.to}\n[mailer] De : ${FROM}\n[mailer] Objet : ${msg.subject}\n[mailer] ${msg.text.replace(/\n/g, "\n[mailer] ")}\n`);
}
