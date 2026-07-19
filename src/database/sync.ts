import { synchronize } from '@nozbe/watermelondb/sync';
import { Q } from '@nozbe/watermelondb';
import database from './index';
import { api } from '../services/apiClient';

/** Match server DIARY_RETENTION_DAYS: keep today + prior (n-1) days in local DB. */
const DIARY_LOCAL_RETENTION_DAYS = 15;

function diaryLocalCutoffYmd(): string {
  const d = new Date();
  d.setDate(d.getDate() - (DIARY_LOCAL_RETENTION_DAYS - 1));
  return d.toISOString().split('T')[0];
}

export async function sync() {
  await synchronize({
    database,
    pullChanges: async ({ lastPulledAt }) => {
      // 1. Fetch changes from backend
      try {await api.post('/log', { msg: 'Sync: pullChanges started', lastPulledAt }, { silent: true });} catch (e) {}
      // We need an endpoint that returns { changes: { diary_entries: { created, updated, deleted } }, timestamp }
      // We need an endpoint that returns { changes: { diary_entries: { created, updated, deleted } }, timestamp }
      // Since we might not have a dedicated sync endpoint yet, we will construct a valid response
      // from standard endpoints for now (or minimal implementation).

      const timestamp = Date.now();

      // Fetch User (Self) first to get class_section_id
      let userProfile = null;
      try {
        userProfile = await api.get<any>('/auth/me', undefined, { silent: true });
      } catch (e) {

      }

      // Fetch Diary
      // Use class_section_id from user profile if available (for students)
      const classSectionId = userProfile?.class_section_id || userProfile?.classId;
      // Always full-pull the retention window (updated_since = 0) instead of an
      // incremental delta. The dataset is tiny (~15 days for one class), and an
      // incremental sync silently drops entries whenever the client/server clocks
      // skew, a sync fires in the gap around an entry's creation, or the local DB
      // was cleared while lastPulledAt persisted — which showed up as diary
      // history appearing empty even though the entries exist on the server.
      // Upserting the full window every time is idempotent and self-healing.
      const diaryParams: any = {
        updated_since: '0',
        is_sync: 'true',
        // If student, filter by class
        ...(classSectionId ? { class_section_id: classSectionId } : {})
      };

      let diaryEntries: any[] = [];
      try {
        // If we have a class_section_id, we can fetch specific entries
        // Otherwise (e.g. teacher), it might fetch their created entries or all
        diaryEntries = await api.get<any[]>('/diary', diaryParams);
      } catch (e) {

      }

      return {
        changes: {
          diary_entries: {
            created: [], // If we can't distinguish, we can treat all as updated (upsert)
            updated: Array.isArray(diaryEntries) ? diaryEntries.map((d) => ({
              id: d.id,
              class_section_id: d.class_section_id,
              entry_date: new Date(d.entry_date).toISOString().split('T')[0],
              subject_id: d.subject_id,
              title: d.title,
              title_te: d.title_te,
              content: d.content,
              content_te: d.content_te,
              homework_due_date: d.homework_due_date,
              attachments: d.attachments,
              subject_name: d.subject_name,
              created_by: d.created_by,
              created_at: new Date(d.created_at).getTime(),
              updated_at: new Date(d.updated_at || d.created_at).getTime()
            })) : [],
            deleted: [] // We need a way to track deletions
          },
          users: {
            created: [],
            updated: userProfile ? [{
              id: userProfile.id,
              email: userProfile.email,
              first_name: userProfile.first_name,
              last_name: userProfile.last_name,
              display_name: userProfile.display_name,
              role: userProfile.role || userProfile.roles && userProfile.roles[0],
              photo_url: userProfile.photo_url,
              permissions: userProfile.permissions,
              class_section_id: userProfile.class_section_id || userProfile.classId
            }] : [],
            deleted: []
          }
        },
        timestamp
      };
    },
    pushChanges: async ({ changes }) => {
      // Push changes to backend
      // changes = { diary_entries: { created: [], updated: [], deleted: [] } }

      const { diary_entries } = changes as any;

      if (diary_entries) {
        // created
        for (const entry of diary_entries.created) {
          await api.post('/diary', entry);
        }
        // updated
        for (const entry of diary_entries.updated) {
          await api.put(`/diary/${entry.id}`, entry);
        }
        // deleted
        for (const id of diary_entries.deleted) {
          await api.delete(`/diary/${id}`);
        }
      }

      // Users are typically read-only or handled separately
    },
    // migrationsEnabledAtVersion: 1,
    sendCreatedAsUpdated: true
  });

  const minYmd = diaryLocalCutoffYmd();
  await database.write(async () => {
    const diary = database.collections.get('diary_entries');
    const stale = await diary.query(Q.where('entry_date', Q.lt(minYmd))).fetch();
    await Promise.all(stale.map((row) => row.destroyPermanently()));
  });
}