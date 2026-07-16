# LECSTU — WCAG 2.2 Accessibility Audit

**Date:** July 2026  
**Platform:** https://lecstu.com (production)  
**Standard:** W3C Web Content Accessibility Guidelines (WCAG) 2.2, Level A and selected Level AA criteria [10]  
**Scope:** Primary student workflows (not full admin back-office audit)

---

## 1. Method

| Step | Description |
|---|---|
| 1 | Selected ten representative pages/flows (login through chatbot/voice). |
| 2 | Reviewed React component source for semantic HTML, ARIA, labels, and keyboard patterns. |
| 3 | Inspected production login page with browser accessibility tree (Chrome, July 2026). |
| 4 | Performed manual keyboard-only navigation on login, sidebar navigation, and chat widget. |
| 5 | Recommended supplementary automated scan: axe DevTools or Lighthouse Accessibility on each page (save screenshots to `photos-for-thesis/appendix/wcag-audit/`). |

**Pages / flows audited**

1. Login (`/login`)  
2. Registration (`/register`)  
3. Student dashboard (`/dashboard`)  
4. Timetable (`/timetable`)  
5. Hall availability (`/halls/availability`)  
6. Lecturer directory (`/lecturers`)  
7. Appointment booking (`/appointments`)  
8. Campus map (`/map`)  
9. Indoor guided navigation (`/navigate`, `/guided-map`)  
10. Chatbot and voice input (floating widget)

---

## 2. Summary

LECSTU implements several accessibility features appropriate for a research prototype: labelled login fields, visible form errors, responsive layout, focus rings on many inputs, voice input as an alternative to typing, and ARIA usage on indoor navigation (tabs, dialogs, turn-by-turn panel) and the chat widget. A targeted WCAG 2.2 review did **not** find evidence of full Level AA compliance. Main gaps are icon-only controls without accessible names, map/route information conveyed partly through colour, and incomplete keyboard coverage on complex map and mobile UI components.

**Overall:** Partial conformance on selected criteria — suitable for thesis reporting with documented limitations, not for claiming full WCAG compliance.

---

## 3. Results by criterion

| WCAG 2.2 | Criterion | Level | Result | Evidence / notes |
|---|---|---|---|---|
| 1.1.1 | Non-text Content | A | **Partial** | Logo has `alt="LECSTU"`. Floor-plan images use floor labels. Lecturer avatars use empty `alt=""`. Map route relies on coloured lines; text legend exists on indoor views but map markers are not fully described to assistive tech. |
| 1.3.1 | Info and Relationships | A | **Partial** | Login labels linked with `htmlFor`/`id`. Indoor guide uses `role="tablist"`, `role="tab"`, `aria-selected`. Some admin tables and map overlays lack full semantic structure. |
| 1.4.1 | Use of Color | A | **Partial** | Indoor route uses green/yellow/red path indicators; accompanying text legend on `IndoorRouteMapView` mitigates but route state is still partly colour-dependent. |
| 1.4.3 | Contrast (Minimum) | AA | **Partial** | Primary UI uses dark text on light backgrounds on login/forms (good). Sidebar uses `text-slate-400` on dark blue — some nav items may fall below 4.5:1; verify with contrast checker before final submission. |
| 1.4.4 | Resize Text | AA | **Pass** | Responsive Tailwind layout; manual zoom to 200% did not break login layout in spot check. |
| 2.1.1 | Keyboard | A | **Partial** | Login, links, and main nav reachable by Tab. Chat open/close and voice buttons have `aria-label`. Password show/hide button lacks accessible name. Mobile sidebar close (`X`) lacks `aria-label`. Leaflet map pan/zoom primarily mouse/touch. |
| 2.4.2 | Page Titled | A | **Pass** | Production pages expose document title (e.g. “LECSTU - Academic Platform”). |
| 2.4.4 | Link Purpose | A | **Pass** | Nav links and auth links use visible text (“Register”, “Forgot password?”). |
| 2.4.7 | Focus Visible | AA | **Partial** | Form inputs use `focus:ring-2`. Some icon-only buttons have weak or no visible focus indicator. |
| 3.3.1 | Error Identification | A | **Pass** | Login shows red alert with message for validation and auth errors (`AlertCircle` + text). |
| 3.3.2 | Labels or Instructions | A | **Pass** | Login email/password labelled; campus search has `aria-label`; chat/voice controls labelled. |
| 4.1.2 | Name, Role, Value | A | **Partial** | Chat widget and indoor navigation expose roles/names. Production login snapshot showed unlabelled password visibility toggle (button with no accessible name). |

**Legend:** Pass = met for audited pages; Partial = met in some areas or needs fix; Fail = not met (none marked Fail at criterion level; issues captured under Partial).

---

## 4. Unresolved issues (future work)

| ID | Issue | WCAG | Suggested fix |
|---|---|---|---|
| A1 | Password show/hide button has no `aria-label` | 4.1.2, 2.4.6 | Add `aria-label="Show password"` / `"Hide password"` in `Login.tsx` and similar auth pages |
| A2 | Mobile menu close button (X) unlabelled | 4.1.2 | Add `aria-label="Close menu"` on sidebar close control |
| A3 | Map route status relies on colour | 1.4.1 | Ensure step list always states status in text; add patterns/icons not colour-only |
| A4 | Leaflet map not fully keyboard-operable | 2.1.1 | Provide text search + list alternative for building/room selection |
| A5 | Sidebar inactive link contrast | 1.4.3 | Increase contrast of `text-slate-400` nav items on primary background |
| A6 | Tamil/Sinhala UI translation quality poor | (usability) | Not a WCAG tooling issue; affects real-world access for Tamil/Sinhala users |

---

## 5. Relation to usability study (RO-4)

The planned usability questionnaire includes accessibility-related Likert items (ease of reading, task completion without mouse-only dependence). WCAG audit provides **technical** accessibility evidence; usability study provides **user-perceived** accessibility evidence. Together they support RO-4 without claiming legal compliance.

---

## 6. Thesis citation

Full audit report: `research/usability-study/WCAG_2_2_AUDIT.md`  
Screenshots (optional): `photos-for-thesis/appendix/wcag-audit/`
