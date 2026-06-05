import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

initializeApp();

const db = getFirestore();

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
