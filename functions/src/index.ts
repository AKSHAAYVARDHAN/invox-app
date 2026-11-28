import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret, defineString } from 'firebase-functions/params';

initializeApp();

const db = getFirestore();
const trendzSchedulerSecret = defineSecret('TRENDZ_SCHEDULER_SECRET');
const trendzSchedulerTargetUrl = defineString('TRENDZ_SCHEDULER_TARGET_URL', {
  default: '',
  description: 'Base URL of the INVOX server hosting /api/internal/trendz/scheduled-ingest',
});

type ReputationAction = 'post' | 'project' | 'comment' | 'like' | 'follow' | 'application';

const reputationWeights: Record<ReputationAction, { knowledge: number; contribution: number; innovation: number; collaboration: number }> = {
  post: { knowledge: 3, contribution: 4, innovation: 1, collaboration: 0 },
  project: { knowledge: 2, contribution: 5, innovation: 5, collaboration: 1 },
  comment: { knowledge: 1, contribution: 2, innovation: 0, collaboration: 2 },
  like: { knowledge: 0, contribution: 1, innovation: 0, collaboration: 1 },
  follow: { knowledge: 0, contribution: 0, innovation: 0, collaboration: 2 },
  application: { knowledge: 1, contribution: 1, innovation: 1, collaboration: 3 },
};

const requireAuth = (uid?: string) => {
  if (!uid) {
    throw new HttpsError('unauthenticated', 'You must be signed in to perform this action.');
  }

  return uid;
};

export const createNotification = onCall(async request => {
  const senderId = requireAuth(request.auth?.uid);
  const { recipientId, type, title, body, targetType, targetId } = request.data ?? {};

  if (!recipientId || !type || !title) {
    throw new HttpsError('invalid-argument', 'recipientId, type, and title are required.');
  }

  const notificationRef = await db.collection('notifications').add({
    recipientId,
    senderId,
    type,
    title,
    body: body ?? '',
    targetType: targetType ?? null,
    targetId: targetId ?? null,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { id: notificationRef.id };
});

export const recalculateReputation = onCall(async request => {
  const callerId = requireAuth(request.auth?.uid);
  const targetUid = request.data?.uid ?? callerId;

  if (targetUid !== callerId) {
    const caller = await db.collection('users').doc(callerId).get();
    const role = caller.data()?.role;

    if (role !== 'admin' && role !== 'moderator') {
      throw new HttpsError('permission-denied', 'Only moderators can recalculate another user reputation.');
    }
  }

  const [posts, projects, comments, likes, follows, applications] = await Promise.all([
    db.collection('posts').where('authorId', '==', targetUid).count().get(),
    db.collection('projects').where('authorId', '==', targetUid).count().get(),
    db.collection('comments').where('authorId', '==', targetUid).count().get(),
    db.collection('likes').where('userId', '==', targetUid).count().get(),
    db.collection('follows').where('followerId', '==', targetUid).count().get(),
    db.collection('applications').where('applicantId', '==', targetUid).count().get(),
  ]);

  const counts: Record<ReputationAction, number> = {
    post: posts.data().count,
    project: projects.data().count,
    comment: comments.data().count,
    like: likes.data().count,
    follow: follows.data().count,
    application: applications.data().count,
  };

  const reputation = Object.entries(counts).reduce(
    (total, [action, count]) => {
      const weight = reputationWeights[action as ReputationAction];
      return {
        knowledge: total.knowledge + weight.knowledge * count,
        contribution: total.contribution + weight.contribution * count,
        innovation: total.innovation + weight.innovation * count,
        collaboration: total.collaboration + weight.collaboration * count,
      };
    },
    { knowledge: 0, contribution: 0, innovation: 0, collaboration: 0 },
  );

  await db.collection('users').doc(targetUid).set({
    reputation,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return { ok: true };
});

export const generateTrendSummary = onCall(async request => {
  requireAuth(request.auth?.uid);
  const { trendId } = request.data ?? {};

  if (!trendId) {
    throw new HttpsError('invalid-argument', 'trendId is required.');
  }

  const trendRef = db.collection('trendz').doc(trendId);
  const trend = await trendRef.get();

  if (!trend.exists) {
    throw new HttpsError('not-found', 'Trendz item not found.');
  }

  const data = trend.data() ?? {};
  const sourceText = `${data.title ?? ''}. ${data.summary ?? ''} ${data.fullContent ?? ''}`.trim();
  const summary = sourceText.length > 280 ? `${sourceText.slice(0, 277)}...` : sourceText;

  await trendRef.set({
    aiSummary: summary,
    summarizedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return { summary };
});

/**
 * Phase 08.1: Automated Trendz Ingestion Cloud Scheduler Function.
 * Runs every 15 minutes (UTC), checks Firestore `/trendAutomation/config` and `/trendAutomation/state`,
 * respects enabled/paused state, configured interval, and active distributed lock leases,
 * and triggers the single unified backend pipeline (`/api/internal/trendz/scheduled-ingest`).
 * Automation remains disabled by default until explicitly enabled by an administrator.
 */
export const scheduledTrendzIngestion = onSchedule(
  {
    schedule: 'every 15 minutes',
    timeZone: 'UTC',
    timeoutSeconds: 300,
    memory: '512MiB',
    retryCount: 0,
    secrets: [trendzSchedulerSecret],
  },
  async () => {
    const nowMs = Date.now();
    const [configSnap, stateSnap] = await Promise.all([
      db.collection('trendAutomation').doc('config').get(),
      db.collection('trendAutomation').doc('state').get(),
    ]);

    const config = configSnap.exists ? (configSnap.data() as Record<string, any>) : null;
    if (!config || config.enabled !== true) {
      console.log('[TRENDZ_CLOUD_SCHEDULER] Automation is disabled or unconfigured; skipping tick.');
      return;
    }

    const state = stateSnap.exists ? (stateSnap.data() as Record<string, any>) : null;
    const intervalMinutes = Math.min(1440, Math.max(5, Number(config.intervalMinutes || 15)));

    // Fast-path interval check before making any outbound HTTP call
    if (state?.lastExecutionAtIso) {
      const lastMs = Date.parse(String(state.lastExecutionAtIso));
      if (!Number.isNaN(lastMs) && nowMs - lastMs + 10_000 < intervalMinutes * 60_000) {
        console.log('[TRENDZ_CLOUD_SCHEDULER] Configured interval has not elapsed; skipping tick.');
        return;
      }
    }

    // Fast-path distributed lock check
    if (state?.locked === true && state?.lockExpiresAtIso) {
      const expiresMs = Date.parse(String(state.lockExpiresAtIso));
      if (!Number.isNaN(expiresMs) && expiresMs > nowMs) {
        console.log(`[TRENDZ_CLOUD_SCHEDULER] Active lock held by ${state.lockRunId || 'unknown'}; skipping.`);
        return;
      }
    }

    const baseUrl = (trendzSchedulerTargetUrl.value() || process.env.TRENDZ_SCHEDULER_TARGET_URL || '').trim().replace(/\/+$/, '');
    const secret = (trendzSchedulerSecret.value() || '').trim();
    if (!baseUrl || !secret) {
      console.warn('[TRENDZ_CLOUD_SCHEDULER] Missing TRENDZ_SCHEDULER_TARGET_URL or TRENDZ_SCHEDULER_SECRET; cannot invoke backend.');
      return;
    }

    const endpoint = `${baseUrl}/api/internal/trendz/scheduled-ingest`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 240_000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-Trendz-Scheduler-Secret': secret,
        },
        body: JSON.stringify({
          source: 'firebase_cloud_scheduler',
          scheduledAtIso: new Date(nowMs).toISOString(),
        }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.error(`[TRENDZ_CLOUD_SCHEDULER] Backend returned HTTP ${response.status}:`, body?.error || 'Unknown error');
        return;
      }
      console.log(
        `[TRENDZ_CLOUD_SCHEDULER] Tick completed: executed=${Boolean(body?.executed)}, skippedReason=${body?.skippedReason || 'none'}, runId=${body?.run?.id || 'none'}`
      );
    } catch (err: any) {
      console.error('[TRENDZ_CLOUD_SCHEDULER] Failed to invoke scheduled backend endpoint:', err?.message || err);
    } finally {
      clearTimeout(timer);
    }
  }
);

