Thesis Figures 4.11–4.20 (populated July 2026)

Files:
  fig-4-11-login-register.png      — registration flow (dev-fix02)
  fig-4-12-student-dashboard.png   — production dashboard (dev-fix12)
  fig-4-13-timetable.png           — My Timetable (Playwright Jul 2026)
  fig-4-14-hall-availability.png   — INTERIM dashboard view; replace with /halls/availability
  fig-4-15-lecturer-directory.png  — lecturer profile (dev-fix18)
  fig-4-16-appointment-notification.png — notifications dropdown (Playwright Jul 2026)
  fig-4-17-campus-map.png          — indoor nav entry on dashboard (dev-fix09)
  fig-4-18-indoor-guided-route.png — INTERIM place search panel (dev-fix10)
  fig-4-19-chatbot-live.png        — chatbot widget (phase8-06)
  fig-4-20-voice-translation.png     — language selector + chat (dev-fix12)

Re-capture from production:
  npx playwright test tests/capture-thesis-ui.spec.ts
  THESIS_CAPTURE_URL=https://lecstu.com
