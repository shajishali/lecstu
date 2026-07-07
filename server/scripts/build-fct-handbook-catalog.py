"""
Build fct-handbook-catalog.json from FCT student handbook (2022) course tables.
The PDF is scanned; this file encodes pathway course data read from handbook pages 22-48.

Usage: python scripts/build-fct-handbook-catalog.py
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "data" / "handbook-extract" / "fct-handbook-catalog.json"


def entry(
    code: str,
    title: str,
    program: str,
    year: int,
    pathway: str = "",
    req: str = "COMPULSORY",
    credits: int | None = None,
) -> dict:
    return {
        "code": code,
        "title": title,
        "programCode": program,
        "studyYear": year,
        "pathwayCode": pathway,
        "requirementType": req,
        **({"credits": credits} if credits is not None else {}),
    }


def cs_pathway_y3_y4(pathway: str, pathway_num: int, rows: list[tuple]) -> list[dict]:
    """rows: (code, title, credits, sem1_p1..p5 or sem2, requirement char per pathway)"""
    out: list[dict] = []
    for row in rows:
        code, title, credits, req_flag = row[0], row[1], row[2], row[2 + pathway_num]
        if req_flag in ("C", "O"):
            out.append(
                entry(
                    code,
                    title,
                    "CS",
                    3 if "310" in code or "320" in code else 4,
                    pathway,
                    "COMPULSORY" if req_flag == "C" else "OPTIONAL",
                    credits,
                )
            )
    return out


# CS pathway index: 1=CSEC, 2=DSCI, 3=AINT, 4=SCOM (Scientific Computing — not offered), 5=SPCS
# Row tuple: (code, title, credits, P1, P2, P3, P4, P5) — P4 column ignored in collect_cs()
CS_PATHWAYS = {
    "CSEC": 1,
    "DSCI": 2,
    "AINT": 3,
    "SPCS": 5,
}


def cs_common(year: int, code: str, title: str, credits: int, req: str) -> dict:
    """B.Sc. CS common units (all pathways) — Years 1 and 2."""
    return entry(code, title, "CS", year, "", req, credits)


CS_COMMON_Y1 = [
    cs_common(1, "CSCI 11014", "Mathematics for Computer Science – I", 4, "COMPULSORY"),
    cs_common(1, "CSCI 11023", "Fundamentals of Statistics", 3, "COMPULSORY"),
    cs_common(1, "CSCI 11032", "Structured Programming – I", 2, "COMPULSORY"),
    cs_common(1, "CSCI 11042", "Fundamentals of Digital Electronics", 2, "COMPULSORY"),
    cs_common(1, "CSCI 11052", "Web Fundamentals", 2, "COMPULSORY"),
    cs_common(1, "CSCI 11062", "Introduction to Database Management Systems", 2, "COMPULSORY"),
    cs_common(1, "CSCI 11072", "Foundations in Computer Science", 2, "OPTIONAL"),
    cs_common(1, "DELT 13302", "English for Computing and Technology", 2, "COMPULSORY"),
    cs_common(1, "CSCI 12013", "Mathematics for Computer Science – II", 3, "COMPULSORY"),
    cs_common(1, "CSCI 12022", "Probability Distribution and Applications", 2, "COMPULSORY"),
    cs_common(1, "CSCI 12033", "Computer Architecture & Design", 3, "COMPULSORY"),
    cs_common(1, "CSCI 12042", "Structured Programming – II", 2, "COMPULSORY"),
    cs_common(1, "CSCI 12052", "Fundamentals of Operating Systems", 2, "COMPULSORY"),
    cs_common(1, "CSCI 12063", "Web Programming", 3, "COMPULSORY"),
]

CS_COMMON_Y2 = [
    cs_common(2, "CSCI 21013", "Statistical Inference", 3, "COMPULSORY"),
    cs_common(2, "CSCI 21023", "Data Communication and Networks", 3, "COMPULSORY"),
    cs_common(2, "CSCI 21033", "Data Structures and Algorithms", 3, "COMPULSORY"),
    cs_common(2, "CSCI 21042", "Software Engineering", 2, "COMPULSORY"),
    cs_common(2, "CSCI 21052", "Object-Oriented Programming – I", 2, "COMPULSORY"),
    cs_common(2, "CSCI 21062", "Advanced Database Management Systems", 2, "COMPULSORY"),
    cs_common(2, "CSCI 23072", "Group Project", 2, "COMPULSORY"),
    cs_common(2, "DELT 21212", "English for the World", 2, "COMPULSORY"),
    cs_common(2, "MGMT 21012", "Principles of Management", 2, "COMPULSORY"),
    cs_common(2, "CSCI 22012", "Statistics for Decision Making", 2, "COMPULSORY"),
    cs_common(2, "CSCI 22022", "Advanced Operating Systems", 2, "COMPULSORY"),
    cs_common(2, "CSCI 22032", "Object-Oriented Analysis and Design", 2, "COMPULSORY"),
    cs_common(2, "CSCI 22042", "Visual Programming", 2, "COMPULSORY"),
    cs_common(2, "CSCI 22052", "Introduction to Artificial Intelligence", 2, "COMPULSORY"),
    cs_common(2, "CSCI 22062", "Introduction to Cyber Security", 2, "COMPULSORY"),
    cs_common(2, "CSCI 22072", "Mobile Application Development", 2, "OPTIONAL"),
    cs_common(2, "CSCI 22082", "Object-Oriented Programming – II", 2, "COMPULSORY"),
    cs_common(2, "MGMT 22012", "Human Resource Management", 2, "COMPULSORY"),
]

CS_Y3_SEM1 = [
    ("CSCI 31014", "Mathematics for Computer Science III", 4, "C", "C", "C", "C", "C"),
    ("CSCI 31022", "Machine Learning and Pattern Recognition", 2, "O", "C", "C", "C", "C"),
    ("CSCI 31032", "Theory of Programming Languages", 2, "O", "O", "O", "O", "C"),
    ("CSCI 31042", "Advanced Data Structures and Algorithms", 2, "O", "C", "O", "O", "O"),
    ("CSCI 31052", "Project Management", 2, "O", "O", "O", "O", "O"),
    ("CSCI 31062", "Semantic Web and Ontological Modeling", 2, "-", "O", "O", "O", "O"),
    ("CSCI 31072", "Python Programming", 2, "O", "C", "O", "O", "O"),
    ("CSCI 31082", "Systems and Network Administration", 2, "C", "O", "O", "O", "O"),
    ("CSEC 31012", "Applied Cryptography", 2, "C", "-", "-", "-", "O"),
    ("CSEC 31022", "Data and Systems Security", 2, "C", "-", "-", "-", "O"),
    ("AINT 31012", "Natural Language Processing", 2, "-", "O", "C", "-", "O"),
    ("AINT 31022", "Deductive Reasoning and Logic Programming", 2, "-", "-", "C", "O", "C"),
    ("DELT 33212", "English for Professional Purposes", 2, "C", "C", "C", "C", "C"),
    ("MGMT 31012", "Introduction to Entrepreneurship", 2, "C", "C", "C", "C", "C"),
]

CS_Y3_SEM2 = [
    ("CSCI 32012", "Theory of Automation", 2, "C", "C", "C", "C", "C"),
    ("CSCI 32022", "Human Computer Interaction", 2, "C", "C", "C", "C", "C"),
    ("CSCI 32032", "Research Methodology and Scientific Communication", 2, "C", "C", "C", "C", "C"),
    ("CSCI 32042", "Social and Professional Issues", 2, "C", "C", "C", "C", "C"),
    ("CSCI 32052", "Distributed Systems & Cloud Computing", 2, "C", "O", "O", "C", "O"),
    ("CSCI 32062", "Computer Graphics", 2, "O", "O", "C", "C", "C"),
    ("CSCI 32073", "Introduction to Game Development", 3, "-", "-", "O", "O", "O"),
    ("CSCI 32083", "Stochastic Processes", 3, "O", "C", "O", "O", "O"),
    ("CSCI 32092", "Data Mining and Warehousing", 2, "O", "C", "O", "O", "O"),
    ("CSEC 32012", "Wireless Communications and Networking", 2, "C", "O", "O", "O", "O"),
    ("CSEC 32022", "Advanced Computer Communication and Networking", 2, "C", "-", "-", "O", "O"),
    ("CSEC 32032", "Network Security", 2, "C", "-", "-", "-", "O"),
    ("DSCI 32012", "Advanced Database Applications", 2, "O", "C", "O", "O", "C"),
    ("AINT 32012", "Digital Image Processing and Computer Vision", 2, "-", "-", "C", "O", "O"),
    ("AINT 32022", "Complex Systems & Agent Technology", 2, "-", "O", "C", "-", "O"),
    ("SCOM 32012", "Parallel Computing", 2, "O", "O", "O", "O", "O"),
]

CS_Y4 = [
    ("CSCI 43018", "Research Project", 8, "C", "C", "C", "C", "C"),
    ("CSCI 44026", "Industrial Training", 6, "C", "C", "C", "C", "C"),
    ("CSCI 44032", "Mobile Computing", 2, "O", "O", "O", "O", "O"),
    ("CSCI 44042", "Theory of Computability and Complexity", 2, "-", "-", "O", "O", "O"),
    ("CSCI 44052", "Software Quality and Automation", 2, "-", "-", "-", "-", "O"),
    ("CSCI 44062", "Software Architecture and Design", 2, "-", "-", "-", "-", "O"),
    ("CSCI 44072", "Computer Modelling and Simulation", 2, "-", "-", "O", "O", "O"),
    ("CSCI 44082", "Emerging Technologies in Computing", 2, "O", "O", "O", "O", "O"),
    ("CSCI 44092", "Enterprise Application Development", 2, "O", "O", "O", "O", "O"),
    ("CSCI 44103", "Advanced Compilers", 3, "-", "-", "-", "-", "O"),
    ("CSCI 44112", "Introduction to Quantum Computing", 2, "O", "O", "O", "O", "O"),
    ("CSEC 44012", "Internet of Things", 2, "C", "O", "O", "O", "O"),
    ("CSEC 44022", "Information Security Management and Auditing", 2, "C", "-", "-", "-", "O"),
    ("CSEC 44032", "Cyber Crime and Forensics", 2, "C", "O", "-", "O", "O"),
    ("CSEC 44042", "Security Analytics", 2, "C", "-", "-", "-", "O"),
    ("CSEC 44052", "Cyber Laws and Standards", 2, "O", "O", "-", "O", "O"),
    ("CSEC 44062", "Ethical Hacking and Vulnerability Analysis", 2, "C", "-", "-", "-", "-"),
    ("CSEC 44072", "Secure Software Engineering", 2, "C", "-", "-", "-", "O"),
    ("CSEC 44082", "Information & Coding Theory", 2, "O", "-", "-", "-", "-"),
    ("CSEC 44092", "Mobile & IOT Security", 2, "O", "-", "-", "-", "-"),
    ("CSEC 44102", "Advanced Cryptography", 2, "O", "-", "-", "-", "-"),
    ("DSCI 44012", "Python for Data Science", 2, "-", "C", "O", "-", "O"),
    ("DSCI 44022", "Data Visualization", 2, "-", "C", "-", "-", "-"),
    ("DSCI 44033", "Big Data Analytics", 3, "-", "C", "-", "-", "-"),
    ("DSCI 44042", "NoSQL Databases", 2, "-", "O", "-", "-", "O"),
    ("DSCI 44052", "Time Series Analysis for Data Science", 2, "-", "C", "O", "O", "O"),
    ("DSCI 44062", "Big data Architecture & Management", 2, "-", "O", "O", "-", "O"),
    ("DSCI 44072", "Geographical Information Systems", 2, "-", "O", "-", "-", "-"),
    ("AINT 44012", "Artificial Neural Networks", 2, "O", "O", "C", "O", "O"),
    ("AINT 44022", "Fuzzy Logic", 2, "O", "O", "C", "O", "O"),
    ("AINT 44032", "Deep Learning", 2, "-", "O", "C", "-", "O"),
    ("AINT 44042", "Machine Translation", 2, "-", "-", "C", "-", "-"),
    ("AINT 44052", "Intelligent Autonomous Robotics", 2, "-", "-", "C", "O", "O"),
    ("AINT 44062", "Computational Cognitive Science", 2, "-", "-", "O", "-", "-"),
    ("AINT 44072", "Introduction to Virtual Reality", 2, "-", "-", "O", "O", "O"),
    ("SCOM 44012", "High Performance Computing", 2, "O", "O", "O", "C", "O"),
]


def collect_cs() -> list[dict]:
    items: list[dict] = list(CS_COMMON_Y1) + list(CS_COMMON_Y2)
    for pathway, num in CS_PATHWAYS.items():
        for row in CS_Y3_SEM1 + CS_Y3_SEM2:
            flag = row[3 + num - 1]
            if flag in ("C", "O"):
                year = 3
                items.append(
                    entry(
                        row[0],
                        row[1],
                        "CS",
                        year,
                        pathway,
                        "COMPULSORY" if flag == "C" else "OPTIONAL",
                        row[2],
                    )
                )
        for row in CS_Y4:
            flag = row[3 + num - 1]
            if flag in ("C", "O"):
                items.append(
                    entry(
                        row[0],
                        row[1],
                        "CS",
                        4,
                        pathway,
                        "COMPULSORY" if flag == "C" else "OPTIONAL",
                        row[2],
                    )
                )
    return items


def ct_pathway(pathway: str, year: int, courses: list[tuple[str, str, int]]) -> list[dict]:
    return [entry(c, t, "CT", year, pathway, "COMPULSORY", cr) for c, t, cr in courses]


def ct_common(year: int, code: str, title: str, credits: int, req: str) -> dict:
    """BICT common units (all pathways) - Years 1 and 2."""
    return entry(code, title, "CT", year, "", req, credits)


# BICT Honours - common course units (handbook page 22)
CT_COMMON_Y1 = [
    ct_common(1, "GTEC 11013", "Mathematics for Technology - 1", 3, "COMPULSORY"),
    ct_common(1, "GTEC 11023", "Physics for Technology I", 3, "COMPULSORY"),
    ct_common(1, "GTEC 13032", "Projects in Technology I", 2, "COMPULSORY"),
    ct_common(1, "GTEC 11041", "Engineering Drawing with CAD I", 1, "COMPULSORY"),
    ct_common(1, "GTEC 11071", "Physics for Technology Laboratory I", 1, "OPTIONAL"),
    ct_common(1, "CTEC 11052", "Structured Programming I", 2, "COMPULSORY"),
    ct_common(1, "CTEC 11063", "Computer Systems Organization", 3, "COMPULSORY"),
    ct_common(1, "DELT 13522", "English for Computing & Technology", 2, "COMPULSORY"),
    ct_common(1, "GTEC 12013", "Mathematics for Technology - II", 3, "COMPULSORY"),
    ct_common(1, "GTEC 12023", "Physics for Technology II", 3, "COMPULSORY"),
    ct_common(1, "GTEC 12033", "Fundamental Practices in Technology", 3, "COMPULSORY"),
    ct_common(1, "GTEC 12041", "Engineering Drawing with CAD II", 1, "OPTIONAL"),
    ct_common(1, "GTEC 12062", "Statistics for Technology", 2, "COMPULSORY"),
    ct_common(1, "GTEC 12081", "Physics for Technology Laboratory II", 1, "OPTIONAL"),
    ct_common(1, "CTEC 12052", "Data Communication and Networking", 2, "COMPULSORY"),
    ct_common(1, "CTEC 12073", "Structured Programming II", 3, "COMPULSORY"),
]

CT_COMMON_Y2 = [
    ct_common(2, "GTEC 21023", "Fundamentals of Electronics", 3, "COMPULSORY"),
    ct_common(2, "GTEC 23032", "Projects in Technology II", 2, "COMPULSORY"),
    ct_common(2, "GTEC 21043", "Mathematics for Technology III", 3, "COMPULSORY"),
    ct_common(2, "CTEC 21042", "Web Programming I", 2, "COMPULSORY"),
    ct_common(2, "CTEC 21052", "Introduction to Cyber Security", 2, "COMPULSORY"),
    ct_common(2, "CTEC 21063", "Database Systems", 3, "COMPULSORY"),
    ct_common(2, "LNPR 21072", "Japanese Language - I", 2, "OPTIONAL"),
    ct_common(2, "DELT 21512", "English for the World", 2, "COMPULSORY"),
    ct_common(2, "GTEC 22033", "Mathematics for Technology - IV", 3, "COMPULSORY"),
    ct_common(2, "CTEC 22023", "Data Structures & Algorithms", 3, "COMPULSORY"),
    ct_common(2, "CTEC 22032", "Software Engineering", 2, "COMPULSORY"),
    ct_common(2, "CTEC 22043", "Object Oriented Programming", 3, "COMPULSORY"),
    ct_common(2, "CTEC 22053", "Computer Architecture & Operating Systems", 3, "COMPULSORY"),
    ct_common(2, "CTEC 22061", "Systems and Network Laboratory", 1, "COMPULSORY"),
    ct_common(2, "DELT 22552", "English for Technology", 2, "COMPULSORY"),
    ct_common(2, "LNPR 22072", "Japanese Language - II", 2, "OPTIONAL"),
]


def collect_ct() -> list[dict]:
    return (
        CT_COMMON_Y1
        + CT_COMMON_Y2
        + ct_pathway("CTNT", 3, CT_CTNT_Y3)
        + ct_pathway("CTNT", 4, CT_CTNT_Y4)
        + ct_pathway("GANI", 3, CT_GANI_Y3)
        + ct_pathway("GANI", 4, CT_GANI_Y4)
        + ct_pathway("SWST", 3, CT_SWST_Y3)
        + ct_pathway("SWST", 4, CT_SWST_Y4)
    )

CT_CTNT_Y3 = [
    ("CTEC 31013", "Web Programming II", 3),
    ("CTEC 31023", "Mobile Application Development", 3),
    ("CTEC 31032", "ICT for Business", 2),
    ("CTEC 31042", "Python Programming", 2),
    ("CTNT 31012", "Introduction to Telecommunication", 2),
    ("CTNT 31022", "Wireless and Mobile Communication", 2),
    ("ENPR 31042", "Principles and Practices of Management and Technology Management", 2),
    ("GTEC 32012", "Project Management", 2),
    ("CTEC 32023", "Internet of Things", 3),
    ("CTNT 32012", "Optical Fibre Communications and Satellite Communications", 2),
    ("CTNT 32032", "Virtualization and Cloud Computing", 2),
    ("CTNT 32042", "Advanced Communication Networks", 2),
    ("CTNT 32051", "Cyber Security Laboratory", 1),
    ("CTNT 32062", "Mobile Computing", 2),
]

CT_CTNT_Y4 = [
    ("CTEC 41016", "Industrial Training", 6),
    ("CTEC 43018", "Project", 8),
    ("CTNT 44021", "Advanced Networking Laboratory", 1),
    ("CTNT 44032", "Network and System Administration", 2),
    ("CTNT 44042", "Advanced Wireless and Mobile Communication", 2),
    ("CTNT 44053", "Network and Information Security", 3),
    ("CTNT 44062", "Security Management", 2),
    ("CTNT 44073", "Distributed Computing", 3),
    ("ENPR 44043", "Entrepreneurship and Small Business Management", 3),
]

CT_GANI_Y3 = [
    ("CTEC 31013", "Web Programming II", 3),
    ("CTEC 31023", "Mobile Application Development", 3),
    ("CTEC 31032", "ICT for Business", 2),
    ("GANI 31012", "Data Structures for Game Development", 2),
    ("GANI 31022", "Introduction to 3D Modelling", 2),
    ("GANI 31032", "Game Design and Development", 2),
    ("ENPR 31042", "Principles and Practices of Management and Technology Management", 2),
    ("GTEC 32012", "Project Management", 2),
    ("CTEC 32012", "Human Computer Interaction", 2),
    ("GANI 32013", "Advanced 3D Modelling Workshop", 3),
    ("GANI 32024", "Mathematics for Modelling and Rendering", 4),
    ("GANI 32033", "Animation for Game Development", 3),
]

CT_GANI_Y4 = [
    ("CTEC 41016", "Industrial Training", 6),
    ("CTEC 43018", "Project", 8),
    ("CTEC 44022", "Software and Hardware Optimization Techniques", 2),
    ("GANI 44033", "3D Games Prototyping", 3),
    ("GANI 44043", "Real-Time 3D Techniques for Games", 3),
    ("GANI 44053", "Fundamentals of Virtual Reality", 3),
    ("GANI 44062", "Motion Graphics Workshop", 2),
    ("ENPR 44043", "Entrepreneurship and Small Business Management", 3),
]

CT_SWST_Y3 = [
    ("CTEC 31013", "Web Programming II", 3),
    ("CTEC 31023", "Mobile Application Development", 3),
    ("CTEC 31032", "ICT for Business", 2),
    ("CTEC 31042", "Python Programming", 2),
    ("SWST 31022", "Requirements Engineering", 2),
    ("SWST 31032", "Applied Information Systems", 2),
    ("ENPR 31042", "Principles and Practices of Management and Technology Management", 2),
    ("GTEC 32012", "Project Management", 2),
    ("CTEC 32012", "Human Computer Interaction", 2),
    ("SWST 32012", "System Analysis and Design", 2),
    ("SWST 32022", "Quality Assurance", 2),
    ("SWST 32033", "Advanced Databases", 3),
    ("SWST 32043", "Software Architecture and Concepts", 3),
]

CT_SWST_Y4 = [
    ("CTEC 41016", "Industrial Training", 6),
    ("CTEC 43018", "Project", 8),
    ("CTEC 44022", "Software and Hardware Optimization Techniques", 2),
    ("SWST 44022", "Applied Internet-of-Things", 2),
    ("SWST 44032", "Scientific Communication", 2),
    ("SWST 44042", "Speech Interfaces", 2),
    ("SWST 44053", "Software Modelling", 3),
    ("SWST 44062", "Enterprise Application Development", 2),
    ("ENPR 44043", "Entrepreneurship and Small Business Management", 3),
]


def et_row(pathway: str, year: int, code: str, title: str, credits: int, req: str) -> dict:
    return entry(code, title, "ET", year, pathway, req, credits)


def et_common(year: int, code: str, title: str, credits: int, req: str) -> dict:
    """BET common units (all pathways) - Years 1 and 2."""
    return entry(code, title, "ET", year, "", req, credits)


# BET Honours - common course units (handbook)
ET_COMMON_Y1 = [
    et_common(1, "GTEC 11013", "Mathematics for Technology – 1", 3, "COMPULSORY"),
    et_common(1, "GTEC 11023", "Physics for Technology I", 3, "COMPULSORY"),
    et_common(1, "GTEC 11041", "Engineering Drawing with CAD I", 1, "COMPULSORY"),
    et_common(1, "ETEC 11052", "Introduction to programming for Technology", 2, "COMPULSORY"),
    et_common(1, "ETEC 11063", "Chemistry for Technology", 3, "COMPULSORY"),
    et_common(1, "GTEC 11071", "Physics for Technology Laboratory I", 1, "COMPULSORY"),
    et_common(1, "GTEC 13032", "Projects in Technology I", 2, "COMPULSORY"),
    et_common(1, "DELT 13522", "English for Computing & Technology", 2, "COMPULSORY"),
    et_common(1, "GTEC 12013", "Mathematics for Technology – II", 3, "COMPULSORY"),
    et_common(1, "GTEC 12023", "Physics for Technology II", 3, "COMPULSORY"),
    et_common(1, "GTEC 12033", "Fundamental Practices in Technology", 3, "COMPULSORY"),
    et_common(1, "GTEC 12041", "Engineering Drawing with CAD II", 1, "COMPULSORY"),
    et_common(1, "ETEC 12051", "Engineering Workshop", 1, "COMPULSORY"),
    et_common(1, "GTEC 12062", "Statistics for Technology", 2, "COMPULSORY"),
    et_common(1, "ETEC 12071", "Chemistry for Technology Laboratory", 1, "COMPULSORY"),
    et_common(1, "GTEC 12081", "Physics for Technology Laboratory II", 1, "COMPULSORY"),
]

ET_COMMON_Y2 = [
    et_common(2, "GTEC 21013", "Applied Calculus - I", 3, "COMPULSORY"),
    et_common(2, "GTEC 21023", "Fundamentals of Electronics", 3, "COMPULSORY"),
    et_common(2, "GTEC 23032", "Projects in Technology II", 2, "COMPULSORY"),
    et_common(2, "ETEC 21043", "Engineering Materials -I", 3, "COMPULSORY"),
    et_common(2, "ETEC 21053", "Manufacturing Processes", 3, "COMPULSORY"),
    et_common(2, "ETEC 21062", "Object Oriented Programming for Engineering Technology", 2, "OPTIONAL"),
    et_common(2, "LNPR 21072", "Japanese Language – I", 2, "OPTIONAL"),
    et_common(2, "DELT 21512", "English for the World", 2, "COMPULSORY"),
    et_common(2, "GTEC 22013", "Applied Calculus- II", 3, "COMPULSORY"),
    et_common(2, "GTEC 22023", "Sustainable Technology Systems", 3, "COMPULSORY"),
    et_common(2, "ETEC 22033", "Applied Thermodynamics", 3, "COMPULSORY"),
    et_common(2, "ETEC 22042", "Electric Circuits and Electric Machines", 2, "COMPULSORY"),
    et_common(2, "ETEC 22053", "Industrial Control Systems", 3, "COMPULSORY"),
    et_common(2, "ETEC 22063", "Mechanics of Materials", 3, "COMPULSORY"),
    et_common(2, "DELT 22552", "English for Technology", 2, "COMPULSORY"),
    et_common(2, "LNPR 22072", "Japanese Language -II", 2, "OPTIONAL"),
]


def collect_et() -> list[dict]:
    return (
        ET_COMMON_Y1
        + ET_COMMON_Y2
        + ET_ETIA_Y3
        + ET_ETIA_Y4
        + ET_ETMP_Y3
        + ET_ETMP_Y4
        + ET_ETST_Y3
        + ET_ETST_Y4
    )


ET_ETIA_Y3 = [
    et_row("ETIA", 3, "ETEC 31013", "Programming in Python for Engineering Technology", 3, "OPTIONAL"),
    et_row("ETIA", 3, "ETEC 31023", "Fluid Mechanics and Fluid Systems", 3, "COMPULSORY"),
    et_row("ETIA", 3, "ETEC 31033", "Mechanics of Machines", 3, "COMPULSORY"),
    et_row("ETIA", 3, "ENPR 31042", "Principles and Practices of Technology management", 2, "COMPULSORY"),
    et_row("ETIA", 3, "ETIA 31413", "Introduction to Industrial Automation", 3, "COMPULSORY"),
    et_row("ETIA", 3, "ETIA 31423", "Introduction to Microprocessors and Embedded systems", 3, "COMPULSORY"),
    et_row("ETIA", 3, "ETEC 32012", "Machine Design with Computer Aided Design", 2, "COMPULSORY"),
    et_row("ETIA", 3, "ETEC 32022", "Manufacturing Systems and Computer Integrated Manufacturing", 2, "COMPULSORY"),
    et_row("ETIA", 3, "ENPR 33033", "Innovations to Market", 3, "COMPULSORY"),
    et_row("ETIA", 3, "GCPR 32041", "Professional Ethics and Practices", 1, "COMPULSORY"),
    et_row("ETIA", 3, "ETIA 32413", "Introduction to Robotics in Manufacturing", 3, "COMPULSORY"),
    et_row("ETIA", 3, "ETIA 32423", "Process Instrumentation and Control", 3, "COMPULSORY"),
    et_row("ETIA", 3, "ETIA 32433", "Industrial Automation Networks", 3, "COMPULSORY"),
    et_row("ETIA", 3, "ETIA 32443", "Embedded systems and Applications", 3, "COMPULSORY"),
]

ET_ETIA_Y4 = [
    et_row("ETIA", 4, "GTEC 41016", "Industrial Training", 6, "COMPULSORY"),
    et_row("ETIA", 4, "ETEC 43018", "Capstone Project", 8, "COMPULSORY"),
    et_row("ETIA", 4, "GCPR 44022", "Occupational Health and Safety", 2, "COMPULSORY"),
    et_row("ETIA", 4, "ENPR 44033", "Total Productive Maintenance (TPM)", 3, "OPTIONAL"),
    et_row("ETIA", 4, "ENPR 44043", "Entrepreneurship and Small Business Management", 3, "COMPULSORY"),
    et_row("ETIA", 4, "ENPR 44052", "Lean/Six Sigma Management", 2, "COMPULSORY"),
    et_row("ETIA", 4, "ETIA 44413", "Computer Integrated Manufacturing", 3, "COMPULSORY"),
    et_row("ETIA", 4, "ETIA 44423", "Industrial Motion Control", 3, "COMPULSORY"),
    et_row("ETIA", 4, "ETIA 44433", "Computer Aided Manufacturing with Lab", 3, "COMPULSORY"),
]

ET_ETMP_Y3 = [
    et_row("ETMP", 3, "ETEC 31013", "Programming in Python for Engineering Technology", 3, "OPTIONAL"),
    et_row("ETMP", 3, "ETEC 31023", "Fluid Mechanics and Fluid Systems", 3, "COMPULSORY"),
    et_row("ETMP", 3, "ETEC 31033", "Mechanics of Machines", 3, "COMPULSORY"),
    et_row("ETMP", 3, "ENPR 31042", "Principles and Practices of Technology management", 2, "COMPULSORY"),
    et_row("ETMP", 3, "ETMP 31213", "Chemical Process Technology", 3, "COMPULSORY"),
    et_row("ETMP", 3, "ETMP 31223", "Engineering Materials - II", 3, "COMPULSORY"),
    et_row("ETMP", 3, "ETEC 32012", "Machine Design with Computer Aided Design", 2, "COMPULSORY"),
    et_row("ETMP", 3, "ETEC 32022", "Manufacturing Systems and Computer Integrated Manufacturing", 2, "COMPULSORY"),
    et_row("ETMP", 3, "ENPR 33033", "Innovations to Market", 3, "COMPULSORY"),
    et_row("ETMP", 3, "GCPR 32041", "Professional Ethics and Practices", 1, "COMPULSORY"),
    et_row("ETMP", 3, "ETMP 32213", "Science of Engineering Materials", 3, "COMPULSORY"),
    et_row("ETMP", 3, "ETMP 32223", "Materials Processes in Industry- I", 3, "COMPULSORY"),
    et_row("ETMP", 3, "ETMP 32233", "Nanoscience and Nanomaterials", 3, "COMPULSORY"),
    et_row("ETMP", 3, "ETMP 32243", "Integrated Computational Materials Engineering", 3, "COMPULSORY"),
]

ET_ETMP_Y4 = [
    et_row("ETMP", 4, "GTEC 41016", "Industrial Training", 6, "COMPULSORY"),
    et_row("ETMP", 4, "ETEC 43018", "Capstone Project", 8, "COMPULSORY"),
    et_row("ETMP", 4, "GCPR 44022", "Occupational Health and Safety", 2, "COMPULSORY"),
    et_row("ETMP", 4, "ENPR 44033", "Total Productive Maintenance (TPM)", 3, "OPTIONAL"),
    et_row("ETMP", 4, "ENPR 44043", "Entrepreneurship and Small Business Management", 3, "COMPULSORY"),
    et_row("ETMP", 4, "ENPR 44052", "Lean/Six Sigma Management", 2, "COMPULSORY"),
    et_row("ETMP", 4, "ETMP 44213", "Materials Processes in Industry -- II", 3, "COMPULSORY"),
    et_row("ETMP", 4, "ETMP 44223", "Novel Engineering Materials and Next Generation Devices", 3, "COMPULSORY"),
    et_row("ETMP", 4, "ETMP 44233", "Materials Characterization and Testing Laboratory", 3, "COMPULSORY"),
]

ET_ETST_Y3 = [
    et_row("ETST", 3, "ETEC 31013", "Programming in Python for Engineering Technology", 3, "OPTIONAL"),
    et_row("ETST", 3, "ETEC 31023", "Fluid Mechanics and Fluid Systems", 3, "COMPULSORY"),
    et_row("ETST", 3, "ETEC 31033", "Mechanics of Machines", 3, "COMPULSORY"),
    et_row("ETST", 3, "ENPR 31042", "Principles and Practices of Technology management", 2, "COMPULSORY"),
    et_row("ETST", 3, "ETST 31613", "Hydrology and hydrogeology with lab", 3, "COMPULSORY"),
    et_row("ETST", 3, "ETST 31623", "Conventional and Alternative Energy Resources", 3, "COMPULSORY"),
    et_row("ETST", 3, "ETEC 32012", "Machine Design with Computer Aided Design", 2, "COMPULSORY"),
    et_row("ETST", 3, "ETEC 32022", "Manufacturing Systems and Computer Integrated Manufacturing", 2, "COMPULSORY"),
    et_row("ETST", 3, "ENPR 33033", "Innovations to Market", 3, "COMPULSORY"),
    et_row("ETST", 3, "GCPR 32041", "Professional Ethics and Practices", 1, "COMPULSORY"),
    et_row("ETST", 3, "ETST 32613", "Energy Storage Technologies with Lab", 3, "COMPULSORY"),
    et_row("ETST", 3, "ETST 32623", "Water and Wastewater Treatment", 3, "COMPULSORY"),
    et_row("ETST", 3, "ETST 32633", "Soil and Solid Waste Treatment", 3, "COMPULSORY"),
    et_row("ETST", 3, "ETST 32643", "Air and Air Pollution Control", 3, "COMPULSORY"),
]

ET_ETST_Y4 = [
    et_row("ETST", 4, "GTEC 41016", "Industrial Training", 6, "COMPULSORY"),
    et_row("ETST", 4, "ETEC 43018", "Capstone Project", 8, "COMPULSORY"),
    et_row("ETST", 4, "GCPR 44022", "Occupational Health and Safety", 2, "COMPULSORY"),
    et_row("ETST", 4, "ENPR 44033", "Total Productive Maintenance (TPM)", 3, "OPTIONAL"),
    et_row("ETST", 4, "ENPR 44043", "Entrepreneurship and Small Business Management", 3, "COMPULSORY"),
    et_row("ETST", 4, "ENPR 44052", "Lean/Six Sigma Management", 2, "COMPULSORY"),
    et_row("ETST", 4, "ETST 44613", "Monitoring and Assessment of Sustainability", 3, "COMPULSORY"),
    et_row("ETST", 4, "ETST 44623", "Sustainable Facilities and Operations", 3, "COMPULSORY"),
    et_row("ETST", 4, "ETST 44633", "Geographical Information Systems for Sustainability with Laboratory", 3, "COMPULSORY"),
]


def dedupe(entries: list[dict]) -> list[dict]:
    seen: set[str] = set()
    out: list[dict] = []
    for e in entries:
        key = f"{e['programCode']}|{e['studyYear']}|{e.get('pathwayCode','')}|{e['code']}"
        if key in seen:
            continue
        seen.add(key)
        out.append(e)
    return out


def main() -> None:
    entries = dedupe(
        collect_cs()
        + collect_ct()
        + collect_et()
    )

    payload = {
        "source": "fct-student-handbook-22 (curated from scanned PDF pages 22-48)",
        "extractedAt": datetime.now(timezone.utc).isoformat(),
        "entries": entries,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {len(entries)} catalog entries -> {OUT}")


if __name__ == "__main__":
    main()
