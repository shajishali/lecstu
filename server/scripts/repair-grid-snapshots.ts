import { repairAllTimetableDetailsFromGrids } from '../src/services/timetableRepairService';

repairAllTimetableDetailsFromGrids()
  .then((r) => {
    console.log(
      `Repaired ${r.repaired} grid(s), updated ${r.masterUpdated} master slot(s),` +
        ` linked ${r.lecturersLinked} lecturer(s) from FET codes.` +
        ` Still missing: ${r.stillMissingLecturer} lecturer, ${r.stillMissingHall} hall (not in FET source).`,
    );
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
