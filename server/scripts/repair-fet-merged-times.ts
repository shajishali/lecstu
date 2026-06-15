import { repairFetMergedSlotTimes } from '../src/services/timetableRepairService';

repairFetMergedSlotTimes()
  .then((r) => {
    console.log(`Done. Updated ${r.updated}, deactivated ${r.deactivated}. Restart dev server if it is running.`);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
