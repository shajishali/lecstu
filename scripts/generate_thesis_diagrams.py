"""
Generate thesis diagrams for LECSTU (Chapter 1 & Chapter 3).
Output: photos-for-thesis/ch1/ and photos-for-thesis/ch3/
"""
from __future__ import annotations

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_CH1 = ROOT / "photos-for-thesis" / "ch1"
OUT_CH3 = ROOT / "photos-for-thesis" / "ch3"
OUT_CH1.mkdir(parents=True, exist_ok=True)
OUT_CH3.mkdir(parents=True, exist_ok=True)

# Thesis-friendly palette
C_PRIMARY = "#1e40af"
C_SECONDARY = "#0f766e"
C_ACCENT = "#7c3aed"
C_WARN = "#b45309"
C_LIGHT = "#e0e7ff"
C_BOX = "#f8fafc"
C_BORDER = "#334155"
C_TEXT = "#0f172a"
C_ARROW = "#475569"


def save(fig, path: Path, dpi: int = 200) -> None:
    fig.savefig(path, dpi=dpi, bbox_inches="tight", facecolor="white", edgecolor="none")
    plt.close(fig)
    print(f"Created: {path}")


def box(ax, x, y, w, h, text, fc=C_BOX, ec=C_BORDER, fontsize=9, bold=False):
    patch = FancyBboxPatch(
        (x, y), w, h,
        boxstyle="round,pad=0.02,rounding_size=0.08",
        linewidth=1.2, edgecolor=ec, facecolor=fc,
    )
    ax.add_patch(patch)
    weight = "bold" if bold else "normal"
    ax.text(x + w / 2, y + h / 2, text, ha="center", va="center",
            fontsize=fontsize, color=C_TEXT, weight=weight, wrap=True)
    return patch


def arrow(ax, x1, y1, x2, y2, style="-|>", color=C_ARROW, lw=1.5):
    ax.add_patch(FancyArrowPatch(
        (x1, y1), (x2, y2),
        arrowstyle=style, mutation_scale=12,
        linewidth=lw, color=color, shrinkA=4, shrinkB=4,
    ))


def fig_1_1_problem_context():
    fig, ax = plt.subplots(figsize=(12, 6))
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 6)
    ax.axis("off")
    ax.set_title("Figure 1.1 — Fragmented channels vs. LECSTU unified platform",
                 fontsize=12, weight="bold", pad=12)

    ax.text(2.5, 5.5, "Current fragmented channels", ha="center", fontsize=10, weight="bold", color=C_WARN)
    sources = [
        ("Help desk", 0.4, 4.2),
        ("Timetable PDF", 0.4, 3.2),
        ("Staff directory", 0.4, 2.2),
        ("Campus map", 0.4, 1.2),
        ("Notice board / WhatsApp", 0.4, 0.2),
    ]
    for label, x, y in sources:
        box(ax, x, y, 2.2, 0.7, label, fc="#fef3c7", ec=C_WARN)

    box(ax, 8.2, 1.5, 3.2, 3.0, "LECSTU\nUnified student interface\n\n• Timetable\n• Appointments\n• Navigation\n• Chatbot / Voice",
        fc=C_LIGHT, ec=C_PRIMARY, fontsize=9, bold=True)

    for _, x, y in sources:
        arrow(ax, x + 2.2, y + 0.35, 8.2, 3.0)

    ax.text(6.0, 0.3, "Students spend extra time switching between disconnected systems",
            ha="center", fontsize=9, style="italic", color=C_ARROW)

    save(fig, OUT_CH1 / "fig-1-1-problem-context.png")


def fig_3_1_dsr_process():
    fig, ax = plt.subplots(figsize=(14, 3.5))
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 3.5)
    ax.axis("off")
    ax.set_title("Figure 3.1 — Design Science Research process (LECSTU)",
                 fontsize=12, weight="bold", pad=10)

    steps = [
        "Problem\nidentification",
        "Objectives",
        "Design",
        "Implementation",
        "Component\nevaluation",
        "Usability\nevaluation",
        "Refinement",
        "Communication",
    ]
    w, h = 1.35, 1.1
    y = 1.2
    xs = [0.3 + i * 1.65 for i in range(len(steps))]
    for i, (x, label) in enumerate(zip(xs, steps)):
        fc = C_LIGHT if i % 2 == 0 else "#ecfdf5"
        box(ax, x, y, w, h, label, fc=fc, ec=C_PRIMARY if i in (2, 4) else C_BORDER, fontsize=8)
        if i < len(steps) - 1:
            arrow(ax, x + w, y + h / 2, xs[i + 1], y + h / 2)

    save(fig, OUT_CH3 / "fig-3-1-dsr-process.png")


def fig_3_2_use_case():
    fig, ax = plt.subplots(figsize=(13, 8))
    ax.set_xlim(0, 13)
    ax.set_ylim(0, 8)
    ax.axis("off")
    ax.set_title("Figure 3.2 — LECSTU use cases and actors",
                 fontsize=12, weight="bold", pad=10)

    # System boundary
    boundary = FancyBboxPatch((2.8, 0.5), 7.4, 6.8, boxstyle="round,pad=0.02",
                             linewidth=1.5, edgecolor=C_PRIMARY, facecolor="#f1f5f9", linestyle="--")
    ax.add_patch(boundary)
    ax.text(6.5, 7.0, "LECSTU Platform", ha="center", fontsize=10, weight="bold", color=C_PRIMARY)

    use_cases = [
        ("View personalized\ntimetable", 3.2, 5.8),
        ("Book / manage\nappointments", 5.0, 5.8),
        ("Hall & lecturer\navailability", 6.8, 5.8),
        ("Campus & indoor\nnavigation", 3.2, 4.0),
        ("Chatbot queries\n(text / voice)", 5.0, 4.0),
        ("Admin: buildings,\ngraphs, timetables", 6.8, 4.0),
        ("Voice transcription\n(ASR)", 4.1, 2.2),
        ("UI translation\n(optional)", 6.0, 2.2),
    ]
    for label, x, y in use_cases:
        box(ax, x, y, 1.5, 0.9, label, fc="white", fontsize=7.5)

    actors = [
        ("Student", 0.6, 5.0, "stick"),
        ("Lecturer", 0.6, 3.5, "stick"),
        ("Administrator", 0.6, 2.0, "stick"),
        ("ASR Service", 11.2, 5.5, "rect"),
        ("Rasa Chatbot", 11.2, 4.0, "rect"),
        ("Translation", 11.2, 2.5, "rect"),
    ]
    for name, x, y, kind in actors:
        if kind == "stick":
            ax.plot([x + 0.3, x + 0.3], [y, y + 0.5], color=C_TEXT, lw=1.5)
            ax.add_patch(plt.Circle((x + 0.3, y + 0.65), 0.15, fc=C_BOX, ec=C_BORDER))
            ax.plot([x + 0.3, x + 0.1], [y + 0.35, y + 0.15], color=C_TEXT, lw=1.5)
            ax.plot([x + 0.3, x + 0.5], [y + 0.35, y + 0.15], color=C_TEXT, lw=1.5)
            ax.text(x + 0.3, y - 0.15, name, ha="center", fontsize=8, weight="bold")
            arrow(ax, x + 0.55, y + 0.4, 3.2, y + 0.4)
        else:
            box(ax, x, y, 1.3, 0.7, name, fc="#ede9fe", ec=C_ACCENT, fontsize=7.5)
            arrow(ax, x, y + 0.35, 7.5, 4.5)

    save(fig, OUT_CH3 / "fig-3-2-use-case.png")


def fig_3_3_system_architecture():
    fig, ax = plt.subplots(figsize=(12, 9))
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 9)
    ax.axis("off")
    ax.set_title("Figure 3.3 — LECSTU system architecture",
                 fontsize=12, weight="bold", pad=10)

    box(ax, 1.5, 7.6, 9.0, 0.9, "React 19 + TypeScript + Vite (Student / Lecturer / Admin UI)",
        fc=C_LIGHT, ec=C_PRIMARY, fontsize=9, bold=True)
    ax.text(10.8, 8.05, "REST / SSE", fontsize=8, color=C_ARROW)

    box(ax, 1.5, 5.8, 9.0, 1.2,
        "Express 5 + TypeScript REST API\nJWT · RBAC · Prisma ORM · Rate limiting · File uploads",
        fc="#ecfdf5", ec=C_SECONDARY, fontsize=9)

    box(ax, 1.5, 4.2, 4.0, 1.0, "PostgreSQL\n(users, timetables, appointments,\nbuildings, nav graphs, notifications)",
        fc="#fff7ed", ec=C_WARN, fontsize=8)

    services = [
        ("Rasa Chatbot\n(NLU + actions)", 6.0, 4.2),
        ("ASR :8001\nWhisper / Google", 6.0, 3.0),
        ("Translation\nMarianMT / mBART", 8.5, 4.2),
        ("Timetable Extract :8002\nPDF parsing", 8.5, 3.0),
        ("Floor-plan Vision :8003\nOpenCV + OCR", 6.0, 1.8),
        ("Indoor Nav Engine :8004\nGraph analysis", 8.5, 1.8),
    ]
    for label, x, y in services:
        box(ax, x, y, 2.2, 0.95, label, fc="white", ec=C_ACCENT, fontsize=7.5)

    box(ax, 1.5, 0.5, 9.0, 0.8, "Optional cloud: Google / Azure Speech & Translation APIs",
        fc="#f1f5f9", ec=C_BORDER, fontsize=8)

    arrow(ax, 6.0, 7.6, 6.0, 7.0)
    arrow(ax, 6.0, 5.8, 3.5, 5.2)
    arrow(ax, 6.0, 5.8, 7.1, 5.15)
    for x in (7.1, 9.6):
        arrow(ax, 6.0, 5.8, x, 4.7)

    save(fig, OUT_CH3 / "fig-3-3-system-architecture.png")


def fig_3_4_deployment():
    fig, ax = plt.subplots(figsize=(11, 7))
    ax.set_xlim(0, 11)
    ax.set_ylim(0, 7)
    ax.axis("off")
    ax.set_title("Figure 3.4 — Production deployment (https://lecstu.com)",
                 fontsize=12, weight="bold", pad=10)

    box(ax, 3.5, 6.0, 4.0, 0.7, "Browser / Mobile client", fc=C_LIGHT, ec=C_PRIMARY, fontsize=9)
    box(ax, 3.5, 4.8, 4.0, 0.7, "HTTPS — lecstu.com", fc="#dcfce7", ec=C_SECONDARY, fontsize=9, bold=True)
    box(ax, 3.5, 3.5, 4.0, 0.9, "Nginx reverse proxy\nSSL termination", fc="white", ec=C_BORDER, fontsize=8)
    box(ax, 1.0, 1.8, 3.2, 1.1, "Node.js + PM2\nExpress API\n(client build static)", fc="#ecfdf5", ec=C_SECONDARY, fontsize=8)
    box(ax, 4.4, 1.8, 3.2, 1.1, "PostgreSQL\n(academic + nav data)", fc="#fff7ed", ec=C_WARN, fontsize=8)
    box(ax, 7.8, 1.8, 2.5, 1.1, "Python AI services\nASR · Rasa · Translation\nVision · Indoor engine", fc="#ede9fe", ec=C_ACCENT, fontsize=7.5)

    arrow(ax, 5.5, 6.0, 5.5, 5.5)
    arrow(ax, 5.5, 4.8, 5.5, 4.4)
    arrow(ax, 5.5, 3.5, 2.6, 2.9)
    arrow(ax, 5.5, 3.5, 5.9, 2.9)
    arrow(ax, 5.5, 3.5, 9.0, 2.9)

    ax.text(5.5, 0.5, "Deployed research artifact — credentials and secrets not shown",
            ha="center", fontsize=8, style="italic", color=C_ARROW)

    save(fig, OUT_CH3 / "fig-3-4-deployment.png")


def fig_3_5_er_diagram():
    fig, ax = plt.subplots(figsize=(13, 9))
    ax.set_xlim(0, 13)
    ax.set_ylim(0, 9)
    ax.axis("off")
    ax.set_title("Figure 3.5 — Core entity–relationship model (LECSTU)",
                 fontsize=12, weight="bold", pad=10)

    entities = [
        ("User\n(role: ADMIN/LECTURER/STUDENT)", 0.5, 7.0, 2.0, 0.9),
        ("Department", 0.5, 5.5, 1.6, 0.7),
        ("Course", 0.5, 4.2, 1.4, 0.7),
        ("StudentGroup", 0.5, 2.8, 1.6, 0.7),
        ("MasterTimetable", 2.8, 5.5, 1.8, 0.8),
        ("Appointment", 2.8, 3.8, 1.6, 0.7),
        ("LectureHall", 2.8, 2.2, 1.5, 0.7),
        ("Notification", 5.2, 7.0, 1.6, 0.7),
        ("MapBuilding", 5.2, 5.2, 1.6, 0.7),
        ("FloorPlan", 5.2, 3.8, 1.5, 0.7),
        ("MapMarker", 5.2, 2.2, 1.4, 0.7),
        ("NavNode", 7.5, 5.2, 1.4, 0.7),
        ("NavEdge", 7.5, 3.8, 1.4, 0.7),
        ("NavQrCode", 7.5, 2.2, 1.5, 0.7),
        ("NavigationSession", 9.8, 4.5, 2.0, 0.8),
    ]
    for label, x, y, w, h in entities:
        box(ax, x, y, w, h, label, fontsize=7.5)

    relations = [
        (1.5, 7.45, 2.8, 5.9),   # User -> MasterTimetable
        (1.5, 7.2, 2.8, 4.15),    # User -> Appointment
        (1.5, 7.45, 5.2, 7.35),   # User -> Notification
        (1.3, 5.85, 1.3, 4.9),    # Dept -> Course
        (2.1, 3.15, 2.8, 2.55),   # StudentGroup -> LectureHall area
        (6.0, 5.55, 7.5, 5.55),   # MapBuilding -> NavNode
        (6.0, 4.15, 7.5, 4.15),   # FloorPlan -> NavEdge area
        (8.2, 5.2, 9.8, 4.9),     # Nav -> Session
        (1.5, 7.0, 9.8, 4.9),     # User -> Session
    ]
    for x1, y1, x2, y2 in relations:
        arrow(ax, x1, y1, x2, y2, style="-", lw=1.0)

    ax.text(6.5, 0.8, "Simplified view — full schema in Prisma (30+ models)",
            ha="center", fontsize=8, style="italic", color=C_ARROW)

    save(fig, OUT_CH3 / "fig-3-5-er-diagram.png")


def fig_3_6_chatbot_sequence():
    fig, ax = plt.subplots(figsize=(12, 8))
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 8)
    ax.axis("off")
    ax.set_title("Figure 3.6 — Chatbot query sequence (text or voice)",
                 fontsize=12, weight="bold", pad=10)

    actors = ["User", "React UI", "ASR :8001", "Rasa", "Express API", "PostgreSQL"]
    xs = [0.8, 2.4, 4.0, 5.6, 7.4, 9.2]
    for name, x in zip(actors, xs):
        ax.text(x, 7.5, name, ha="center", fontsize=8, weight="bold")
        ax.plot([x, x], [0.8, 7.2], color=C_BORDER, linestyle="--", lw=0.8)

    messages = [
        (0, 1, 6.8, "1. Speech / text query"),
        (1, 2, 6.4, "2. Audio (optional)"),
        (2, 1, 6.0, "3. Transcript"),
        (1, 3, 5.5, "4. NLU request"),
        (3, 4, 5.0, "5. Custom action (API key)"),
        (4, 5, 4.5, "6. Query timetable / nav / availability"),
        (5, 4, 4.0, "7. Live data"),
        (4, 3, 3.5, "8. JSON response"),
        (3, 1, 3.0, "9. Bot utterance"),
        (1, 0, 2.5, "10. Display answer"),
    ]
    for fr, to, y, label in messages:
        color = C_PRIMARY if fr == 0 or to == 0 else C_ARROW
        ax.annotate(
            "", xy=(xs[to], y), xytext=(xs[fr], y),
            arrowprops=dict(arrowstyle="-|>", color=color, lw=1.2),
        )
        ax.text((xs[fr] + xs[to]) / 2, y + 0.12, label, ha="center", fontsize=7, color=C_TEXT)

    box(ax, 0.3, 1.0, 11.4, 0.9,
        "Example: \"When is my next lecture?\" → ask_timetable → fetch student timetable → personalized grid answer",
        fc="#f8fafc", ec=C_BORDER, fontsize=8)

    save(fig, OUT_CH3 / "fig-3-6-chatbot-sequence.png")


def fig_3_7_indoor_nav_pipeline():
    fig, ax = plt.subplots(figsize=(14, 4))
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 4)
    ax.axis("off")
    ax.set_title("Figure 3.7 — Indoor navigation pipeline",
                 fontsize=12, weight="bold", pad=10)

    steps = [
        "Floor-plan\nupload",
        "OCR / vision\nanalysis",
        "Admin\nreview",
        "Graph\npublish",
        "QR scan\nposition",
        "A* / Dijkstra\nrouting",
        "Map overlay\n+ turn-by-turn",
    ]
    w, h = 1.55, 1.0
    y = 1.5
    xs = [0.4 + i * 1.85 for i in range(len(steps))]
    for i, (x, label) in enumerate(zip(xs, steps)):
        fc = C_LIGHT if i < 4 else "#ecfdf5"
        ec = C_PRIMARY if i >= 4 else C_BORDER
        box(ax, x, y, w, h, label, fc=fc, ec=ec, fontsize=8)
        if i < len(steps) - 1:
            arrow(ax, x + w, y + h / 2, xs[i + 1], y + h / 2)

    ax.text(7.0, 0.5, "Runtime routing uses persisted NavNode + NavEdge (graph-first design)",
            ha="center", fontsize=8, style="italic", color=C_ARROW)

    save(fig, OUT_CH3 / "fig-3-7-indoor-nav-pipeline.png")


def main():
    fig_1_1_problem_context()
    fig_3_1_dsr_process()
    fig_3_2_use_case()
    fig_3_3_system_architecture()
    fig_3_4_deployment()
    fig_3_5_er_diagram()
    fig_3_6_chatbot_sequence()
    fig_3_7_indoor_nav_pipeline()
    print("\nAll thesis diagrams generated successfully.")


if __name__ == "__main__":
    main()
