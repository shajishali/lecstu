import app from './app';
import { config } from './config';
import { startReminderJob } from './services/appointmentReminderService';
import {
  repairAllTimetableDetailsFromGrids,
  repairFetMergedSlotTimes,
} from './services/timetableRepairService';
import { invalidateAll as invalidateTimetableCache } from './services/timetableCache';

const start = async () => {
  try {
    try {
      const { updated, deactivated } = await repairFetMergedSlotTimes();
      if (updated > 0 || deactivated > 0) {
        console.log(`[LECSTU] Timetable repair: ${updated} updated, ${deactivated} deactivated`);
      }
      const details = await repairAllTimetableDetailsFromGrids();
      if (details.repaired > 0 || details.masterUpdated > 0) {
        console.log(
          `[LECSTU] Timetable details repair: ${details.repaired} grid(s), ${details.masterUpdated} slot(s) updated` +
            (details.stillMissingLecturer || details.stillMissingHall
              ? ` (${details.stillMissingLecturer} without lecturer, ${details.stillMissingHall} without hall in source)`
              : ''),
        );
      }
    } catch (err) {
      console.warn('[LECSTU] Timetable repair skipped:', err);
    }
    invalidateTimetableCache();

    app.listen(config.port, () => {
      console.log(`[LECSTU] Server running on http://localhost:${config.port}`);
      console.log(`[LECSTU] Environment: ${config.nodeEnv}`);
      startReminderJob();
    });
  } catch (error) {
    console.error('[LECSTU] Failed to start server:', error);
    process.exit(1);
  }
};

start();
