import { db, DbSmsLog } from './db';
import { serverSendGuardianSms } from './server-session';

export interface SmsPayload {
  studentName: string;
  rollNumber: string;
  guardianPhone: string;
  quizTitle: string;
  score: number;
  totalPoints: number;
  rank: number;
  totalParticipants: number;
}

export class SmsGateway {
  static formatMessage(data: SmsPayload): string {
    return `[ফলাফল বার্তা]\nশ্রদ্ধেয় অভিভাবক, আপনার সন্তান ${data.studentName} (রোল: ${data.rollNumber}) "${data.quizTitle}" পরীক্ষায় ${data.score}/${data.totalPoints} পেয়ে ${data.totalParticipants} জনের মধ্যে ${data.rank}ম স্থান অর্জন করেছে।\n- অন্বেষা এক্সাম অ্যারেনা`;
  }

  static async sendGuardianScorecard(payload: SmsPayload): Promise<{ success: boolean; log: DbSmsLog }> {
    const messageText = this.formatMessage(payload);
    const cleanPhone = payload.guardianPhone.replace(/\D/g, '');
    let status: 'delivered' | 'queued' | 'failed' = 'queued';

    try {
      const serverRes = await serverSendGuardianSms({
        data: {
          guardianPhone: payload.guardianPhone,
          studentName: payload.studentName,
          rollNumber: payload.rollNumber,
          quizTitle: payload.quizTitle,
          score: payload.score,
          totalPoints: payload.totalPoints,
          rank: payload.rank,
          totalParticipants: payload.totalParticipants,
        },
      });
      if (serverRes.configured && serverRes.log) {
        status = serverRes.log.status;
        const localLog = db.logSms({
          recipientPhone: payload.guardianPhone,
          studentName: payload.studentName,
          rollNumber: payload.rollNumber,
          quizTitle: payload.quizTitle,
          score: payload.score,
          rank: payload.rank,
          messageText,
          status,
        });
        return { success: serverRes.success, log: localLog };
      }
    } catch {
      // Optional local key or offline queue fallback
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('onnesha_sms_token') : null;
    if (token && token.trim().length > 5) {
      try {
        const url = `https://api.greenweb.com.bd/api.php?token=${encodeURIComponent(token.trim())}&to=${encodeURIComponent(cleanPhone)}&message=${encodeURIComponent(messageText)}`;
        const response = await fetch(url, { method: 'GET' });
        if (response.ok) {
          const resText = (await response.text()).toLowerCase();
          status =
            resText.includes('ok') || resText.includes('success') || resText.includes('100')
              ? 'delivered'
              : 'queued';
        } else {
          status = 'failed';
        }
      } catch {
        status = 'queued';
      }
    } else {
      status = 'failed';
    }

    const log = db.logSms({
      recipientPhone: payload.guardianPhone,
      studentName: payload.studentName,
      rollNumber: payload.rollNumber,
      quizTitle: payload.quizTitle,
      score: payload.score,
      rank: payload.rank,
      messageText,
      status,
    });

    return { success: status !== 'failed', log };
  }

  static async sendBulkGuardianScorecards(
    payloads: SmsPayload[],
    onProgress?: (sent: number, total: number) => void
  ): Promise<{ totalSent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (let i = 0; i < payloads.length; i++) {
      const item = payloads[i];
      if (!item) continue;
      try {
        const res = await this.sendGuardianScorecard(item);
        if (res.success) {
          sent++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
      if (onProgress) {
        onProgress(i + 1, payloads.length);
      }
    }

    return { totalSent: sent, failed };
  }
}
