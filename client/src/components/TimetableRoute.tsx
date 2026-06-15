import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@store/authStore';
import MyTimetable from '@pages/MyTimetable';

/** Students see FET group timetable; lecturers use their own schedule editor. */
export default function TimetableRoute() {
  const { user } = useAuthStore();
  if (user?.role === 'LECTURER') {
    return <Navigate to="/lecturer/schedule" replace />;
  }
  return <MyTimetable />;
}
