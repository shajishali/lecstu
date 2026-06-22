# Design and Evaluation of an AI-Integrated Academic Platform for Multilingual University Environments

## Smart Faculty Access and Student Assistant System (LECSTU)

**P. Shakiththiyan**  
**Student Registration Number: CS/2020/063**

Prepared under the supervision of  
**Mr. Kesavan Selvarajah**

Submitted in partial fulfilment of the requirements for the  
**Bachelor of Science Honours in Computer Science Degree**

Faculty of Computing and Technology  
University of Kelaniya  
Academic Year 2023/2024

> **DOCUMENT STATUS — WORKING THESIS DRAFT (21 June 2026):** This manuscript follows the supplied CSCI 43018 thesis template. Text supported by the proposal, implementation, and available experiment reports has been drafted. Items enclosed in `[[THESIS INSERT: ...]]` require evidence, an image, a confirmed value, or a personal detail before submission. Do not delete a placeholder until the referenced material has been inserted and verified.

---

# Declaration

I, P. Shakiththiyan, hereby declare that the thesis entitled “Design and Evaluation of an AI-Integrated Academic Platform for Multilingual University Environments,” submitted to the Faculty of Computing and Technology, University of Kelaniya, in fulfilment of the requirements for the award of the degree of Bachelor of Science Honours in Computer Science, is the result of my own independent work carried out under the guidance and supervision of Mr. Kesavan Selvarajah. This work has not been submitted, in whole or in part, to any conference, journal, book, university, or other institution for the purpose of obtaining any degree, diploma, or other academic qualification. I confirm that all sources of information and ideas from other works have been properly acknowledged in accordance with accepted academic conventions.

Name of the Student: P. Shakiththiyan  
Student Number: CS/2020/063  
Signature of the Student: ____________________  
Date: ____________________

Name of the Supervisor: Mr. Kesavan Selvarajah  
Department: [[THESIS INSERT: Supervisor’s official department]]  
Signature of the Supervisor: ____________________  
Date: ____________________

---

# Abstract

University students frequently obtain timetable, staff, appointment, facility, and navigation information through separate systems or manual enquiries. This fragmentation is particularly restrictive in multilingual environments, where text-only and monolingual interfaces can create additional barriers. This research designed, implemented, and evaluated LECSTU, a web- and mobile-responsive academic platform that combines academic logistics with multilingual artificial intelligence. The artifact integrates role-based access, personalized timetables, lecturer and hall availability, appointment booking, real-time notifications, campus and indoor navigation, automatic speech recognition (ASR), a domain-specific chatbot, and machine translation.

The study adopted a Design Science Research approach in which the platform served both as the research artifact and as the experimental testbed. The ASR study measured word error rate and latency for local Whisper configurations and a cloud baseline. The chatbot study used five-fold cross-validation and a held-out test to evaluate intent classification and entity extraction. The translation study measured BLEU, multilingual semantic similarity, and latency over 100 trilingual academic sentence sets. The available ASR run showed that Whisper medium produced the lowest English mean word error rate (0.0410), compared with 0.0806 for Google Speech-to-Text, but required substantially greater mean latency (14,018.39 ms versus 3,331.13 ms). Because Tamil and Sinhala outputs failed in that run, the multilingual ASR hypothesis remains unresolved. The Rasa chatbot achieved cross-validated intent F1 of 0.904 and entity F1 of 0.953, supporting the chatbot hypothesis. The Marian-based translation engine completed 1,800 translations without runtime errors; semantic similarity was strongest for English-to-Sinhala (0.8749) and English-to-Tamil (0.8612), while Sinhala-to-Tamil was weakest (0.3430). Cloud translation and human evaluation remain necessary for a definitive comparative conclusion.

The findings demonstrate the feasibility of integrating local AI services with a production-oriented university platform, while also showing that model quality, latency, language coverage, and privacy must be considered together. The principal contribution is an integrated and reproducible research artifact for evaluating multilingual academic assistance rather than an isolated chatbot. [[THESIS INSERT: After completing the usability study, add participant count, SUS score, task-time improvement, statistical test, effect size, and final conclusion for RQ-4. Keep the abstract within one page in the final Word document.]]

**Keywords:** academic assistant, multilingual AI, automatic speech recognition, Rasa, machine translation, indoor navigation, Design Science Research, higher education

---

# Acknowledgement

I express my sincere gratitude to my supervisor, Mr. Kesavan Selvarajah, for his guidance, constructive feedback, and encouragement throughout this research. I also thank the academic staff and students of the Faculty of Computing and Technology, University of Kelaniya, whose academic environment motivated the design of this system.

[[THESIS INSERT: Add the names of lecturers, technical staff, participants, friends, family members, funding bodies, laboratories, or organizations that should be acknowledged. Obtain permission before naming study participants.]]

---

# Table of Contents

[[THESIS INSERT: Generate the Table of Contents automatically in Microsoft Word after applying Heading 1–3 styles. Do not type page numbers manually.]]

# List of Tables

[[THESIS INSERT: Generate automatically after all captions, numbering, and page numbers are finalized.]]

# List of Figures

[[THESIS INSERT: Generate automatically after inserting and captioning the figures specified throughout this draft.]]

# List of Acronyms and Abbreviations

| Acronym | Meaning |
|---|---|
| AI | Artificial Intelligence |
| API | Application Programming Interface |
| ASR | Automatic Speech Recognition |
| BLEU | Bilingual Evaluation Understudy |
| CER | Character Error Rate |
| CI/CD | Continuous Integration/Continuous Deployment |
| DSR | Design Science Research |
| F1 | Harmonic mean of precision and recall |
| JWT | JSON Web Token |
| LECSTU | Smart Faculty Access and Student Assistant System |
| NLU | Natural Language Understanding |
| NLP | Natural Language Processing |
| OCR | Optical Character Recognition |
| PII | Personally Identifiable Information |
| QR | Quick Response |
| RBAC | Role-Based Access Control |
| REST | Representational State Transfer |
| SSE | Server-Sent Events |
| STT | Speech-to-Text |
| SUS | System Usability Scale |
| TTS | Text-to-Speech |
| UI/UX | User Interface/User Experience |
| WCAG | Web Content Accessibility Guidelines |
| WER | Word Error Rate |

---

# Chapter 1 — Introduction

## 1.1 Background

Universities depend on timely access to academic and administrative information. A student may need to identify the location of a lecture hall, determine whether a lecturer is available, find a free room, view a timetable change, or book an appointment. In many institutions these tasks are distributed across web pages, notice boards, messaging groups, help desks, and separate information systems. Fragmentation increases the number of steps required to complete routine tasks and makes information difficult to locate consistently.

The problem becomes more significant in multilingual university communities. A conventional interface assumes that a user can type a correctly formed query in the system’s main language, navigate menus, and interpret textual output. Voice input, multilingual translation, and conversational interaction can reduce some of these barriers. However, a useful academic assistant must do more than answer static frequently asked questions. It must connect language input to live institutional data such as timetables, appointments, availability, notifications, and locations.

Previous campus assistant applications and university chatbots show that mobile access and conversational support can improve the availability of student services [1], [2]. Voice-interactive multilingual student support has also been demonstrated as technically feasible [4]. Nevertheless, much existing work evaluates an isolated chatbot or a location-bound kiosk. It does not examine how multilingual speech, domain-specific intent recognition, translation, academic logistics, and indoor navigation can operate together within one testable platform.

This research addresses that integration gap through LECSTU. The system is a responsive web platform for students, lecturers, and administrators, supported by an Express/PostgreSQL application backend and Python AI microservices. It provides authentication and RBAC, personalized timetables, staff and facility availability, appointment management, notifications, campus maps, graph-based indoor routing, voice transcription, conversational academic assistance, and English–Tamil–Sinhala translation.

## 1.2 Research Problem

Students and staff lack a centralized, intelligent, and multilingual platform for managing routine academic logistics. Existing channels are often feature-limited, text-dependent, monolingual, or disconnected from current institutional data. Consequently, users may spend unnecessary time locating information or depend on staff for repetitive enquiries. Users with language, visual, motor, or situational constraints may experience an additional accessibility burden.

Although ASR, chatbot, and machine translation technologies are individually available, their suitability for multilingual academic queries cannot be assumed. Recognition quality can vary by language and accent; intent classifiers can confuse semantically adjacent tasks; translations can be fluent while altering academic meaning; and accurate models can still be impractical if their latency is high. The research problem is therefore both an engineering and an empirical problem: how can these components be integrated into one academic platform, and how effectively do they support multilingual university tasks?

## 1.3 Research Aim

The aim is to design, implement, and evaluate a scalable AI-integrated academic platform that improves access to faculty information and student services in a multilingual university environment.

## 1.4 Research Objectives

**RO-1:** Develop and evaluate an ASR pipeline supporting English, Tamil, and Sinhala academic voice queries.

**RO-2:** Design, train, and evaluate a domain-specific NLP chatbot capable of academic intent classification and entity extraction.

**RO-3:** Implement and comparatively evaluate machine translation approaches for English–Tamil–Sinhala academic content.

**RO-4:** Evaluate the effect of AI integration on task efficiency, user satisfaction, and accessibility through a usability study.

**RO-5:** Engineer a production-oriented academic platform that integrates the AI components and acts as the research testbed.

## 1.5 Research Questions and Hypotheses

| ID | Research question | Associated hypothesis |
|---|---|---|
| RQ-1 | How does Whisper compare with Google Speech-to-Text in WER and latency for multilingual academic voice queries? | H1: Whisper medium produces lower WER than Google for Tamil and Sinhala queries. |
| RQ-2 | Can a Rasa-based chatbot achieve acceptable precision and recall for academic intent classification and entity extraction? | H2: The chatbot achieves F1 ≥ 0.85 for core academic intents. |
| RQ-3 | How do cloud translation APIs compare with multilingual transformer models in quality and speed for English–Tamil–Sinhala pairs? | H3: Multilingual transformer models produce higher semantic similarity than cloud APIs for Tamil and Sinhala academic text. |
| RQ-4 | Does AI integration improve task completion time, satisfaction, and accessibility for university users? | H4: AI-integrated features reduce mean task completion time by at least 25% compared with manual navigation. |

## 1.6 Scope

The functional scope includes three roles—student, lecturer, and administrator—and covers user profiles, master and personalized timetables, hall and lecturer availability, appointments, real-time notifications, campus/floor-plan maps, indoor navigation, voice input, chatbot interaction, and translation. The linguistic scope is English, Tamil, and Sinhala. The empirical scope includes model quality and latency for ASR and translation, classification and extraction performance for NLU, and a planned task-based usability study.

The study does not claim to replace all university information systems. It is a research prototype and integration testbed. The available ASR dataset uses one speaker and synthetic/sample audio, the translation study has not yet included human ratings or cloud baselines, and the usability study has not yet been completed. These boundaries are treated as limitations rather than concealed through extrapolation.

## 1.7 Significance and Contributions

The research contributes:

1. an integrated academic platform that links AI interaction to live timetable, appointment, facility, and navigation data;
2. a reproducible multilingual ASR benchmark structure for academic queries;
3. an evaluated Rasa NLU model covering 11 academic intents and six entity types;
4. a trilingual academic translation corpus and automated evaluation pipeline covering six language directions;
5. an AI-assisted, graph-first indoor navigation module using A* routing, QR positioning, floor transitions, and natural-language directions; and
6. practical evidence about trade-offs among accuracy, latency, privacy, and deployment complexity.

## 1.8 Thesis Organization

Chapter 2 reviews university assistants, multilingual speech and translation, domain-specific chatbots, indoor navigation, and the identified gap. Chapter 3 describes the DSR methodology, artifact architecture, datasets, implementation, evaluation metrics, ethics, and validity measures. Chapter 4 presents currently available experimental and system-testing results. Chapter 5 interprets these results in relation to the questions and prior work. Chapter 6 summarizes contributions, limitations, conclusions, and future work.

[[THESIS INSERT — FIGURE 1.1: A one-page problem-context diagram showing fragmented current channels (help desk, timetable document, directory, maps, notices) converging into LECSTU’s unified student interface. Create as a clean vector figure; do not use a code screenshot.]]

---

# Chapter 2 — Literature Review

## 2.1 Introduction

This chapter establishes the conceptual and empirical basis of the study. It reviews digital student support, conversational agents, multilingual speech recognition, machine translation, navigation, and responsible AI. The review focuses on how these strands relate to an integrated academic platform and where existing approaches leave a research gap.

## 2.2 Digital Student Support and Campus Applications

Mobile and web applications can give students continuous access to academic services, but feature availability alone does not guarantee adoption. Sweidan *et al.* developed a student interactive assistant application with a chatbot during the COVID-19 period, illustrating how conversational access can complement conventional mobile features [1]. More recent reviews describe university chatbots as commonly focused on frequently asked questions, admissions, and basic service guidance [2]. These systems improve availability but may remain disconnected from transactional and time-dependent data.

For a campus application to be operationally useful, it should reduce fragmentation. A timetable query, for example, should return the authenticated student’s current data rather than a generic answer. An appointment query should respect lecturer availability and booking constraints. LECSTU therefore treats conversational AI as an access layer over academic services, not as a separate novelty feature.

## 2.3 Conversational Agents in Higher Education

Rule-based chatbots offer predictable responses but are limited by manually enumerated phrases and dialogue paths. Data-driven NLU pipelines classify user intent and extract entities such as a lecturer, course, day, time, building, or hall. Rasa was selected because it supports customizable on-premise NLU and dialogue components, domain data, custom actions, and controlled integration with private APIs [5]. This is relevant where queries contain institutional details that should not automatically be sent to a general cloud language model.

Academic intents are frequently close in meaning. “Can I meet Dr. Silva tomorrow?” may request availability or imply a booking. “Where is Main Hall?” can refer to a building, a hall, or a route. A realistic evaluation should therefore report confusion patterns and per-class metrics, not accuracy alone. Five-fold cross-validation provides a more conservative estimate than a single favorable held-out split.

## 2.4 Automatic Speech Recognition for Multilingual Access

ASR converts speech into text that can be passed to the NLU layer. Whisper is trained on large-scale multilingual and multitask supervision and provides locally deployable model sizes with different accuracy and computational requirements [3]. Cloud ASR services offer managed infrastructure but introduce network dependency, recurring cost, and data-governance concerns.

WER is the conventional ASR measure and is computed as

\[
WER = \frac{S + D + I}{N},
\]

where \(S\), \(D\), and \(I\) are substitutions, deletions, and insertions, and \(N\) is the number of words in the reference transcription. WER must be considered together with latency. A high-capacity model may minimize errors while producing a response too slowly for fluid interaction. Multilingual comparison also requires human speech from multiple speakers; synthetic speech or one speaker cannot establish population-level performance.

## 2.5 Multilingual Machine Translation

Machine translation enables academic notices, directions, and chatbot responses to cross language boundaries. Local transformer models can reduce dependence on cloud providers, whereas managed translation services may offer stronger infrastructure and broad training coverage. MarianMT provides neural translation models for particular language pairs, while mBART supports multilingual sequence-to-sequence tasks [6], [7].

BLEU measures n-gram overlap with a reference, but it can undervalue valid translations with different wording, especially for short sentences and morphologically rich languages. For this reason, the present study combines BLEU with multilingual embedding similarity, latency, and planned human adequacy and fluency ratings. No automated metric alone is treated as proof that a translation is safe for high-stakes academic content.

## 2.6 Campus and Indoor Navigation

Outdoor campus maps are insufficient once a student enters a multi-floor building. Indoor navigation requires a representation of rooms, corridors, stairs, lifts, and connectors. Graph-based routing expresses locations as nodes and traversable links as weighted edges. A* uses a heuristic to prioritize promising routes, while Dijkstra’s algorithm provides a non-heuristic shortest-path alternative [8], [9]. QR codes provide a low-cost positioning mechanism because a scan can map a user to a known graph node without specialized radio infrastructure.

LECSTU combines floor-plan image analysis with an administrator-reviewed navigation graph. Image processing and OCR help seed rooms and corridors, but runtime route computation uses a persisted graph. This separation avoids repeatedly applying uncertain computer vision during every navigation request.

## 2.7 Accessibility, Privacy, and Responsible AI

Voice interfaces may improve access for users who cannot conveniently type or navigate dense menus, but voice is potentially identifying biometric data. Cloud processing may expose speech or text to third parties. Responsible deployment therefore requires explicit recording controls, informed consent for research recordings, data minimization, restricted access, and defined retention periods. Authentication, authorization, secure password hashing, rate limiting, validation, and audit records are also necessary because the platform handles schedules and appointments.

Accessibility is broader than multilingual output. Responsive design, keyboard access, clear labels, adequate contrast, error recovery, and compatibility with assistive technology should be evaluated against WCAG guidance [10]. [[THESIS INSERT: Perform and document a WCAG 2.2 audit; insert tested success criteria and unresolved issues rather than claiming full compliance now.]]

## 2.8 Identified Research Gap

The literature demonstrates useful campus apps, university chatbots, multilingual voice assistants, ASR systems, and translation models. The missing element is a reproducibly evaluated platform that joins these capabilities to live academic logistics and indoor navigation in an English–Tamil–Sinhala setting. Existing studies tend to isolate a model or provide static FAQ interaction. They rarely compare AI quality and latency while also evaluating the end-to-end user task.

LECSTU addresses this gap by using one artifact to evaluate component performance and system-level usability. The intended contribution is not a new foundation model; it is the design evidence, datasets, evaluation results, and integration knowledge required to make existing AI components useful within a university workflow.

## 2.9 Chapter Summary

The review supports the selection of customizable local AI components, multi-metric evaluation, graph-based navigation, and privacy-conscious architecture. It also establishes the need for end-to-end usability evidence. Chapter 3 describes how the artifact and evaluations were designed.

[[THESIS INSERT — TABLE 2.1: Literature comparison matrix with at least 12 peer-reviewed studies. Columns: study/year, context, languages, chatbot, ASR, translation, live university data, navigation, evaluation metrics, limitation. The proposal supplies a starting set only; conduct and document a formal database search before submission.]]

[[THESIS INSERT — LITERATURE SEARCH RECORD: State databases (IEEE Xplore, ACM DL, Scopus/Web of Science, Google Scholar), search strings, date range, inclusion/exclusion criteria, duplicates removed, and final paper count. Add a PRISMA-style flow figure if the review is presented as systematic.]]

---

# Chapter 3 — Methodology

## 3.1 Research Design

The study uses Design Science Research because its central activity is the construction and evaluation of an information-system artifact. The process consisted of problem identification, definition of objectives, artifact design and development, demonstration through university tasks, component evaluation, and communication of results. Quantitative experiments evaluate ASR, NLU, and translation. A mixed-method usability evaluation is planned to combine task measures with questionnaire ratings and qualitative feedback.

The independent variables include ASR engine/model, language, translation engine, language direction, and interaction mode. Dependent variables include WER, CER, latency, intent precision/recall/F1, entity precision/recall/F1, BLEU, semantic similarity, task-completion time, task success, SUS score, and participant feedback.

[[THESIS INSERT — FIGURE 3.1: DSR process adapted to this project: problem → objectives → design → implementation → component evaluation → usability evaluation → refinement. Cite the DSR source used for the adaptation.]]

## 3.2 Requirements and Use Cases

Requirements were derived from the proposal’s identified problems and representative academic tasks. The principal use cases are:

- a student viewing a personalized timetable and receiving changes;
- a student finding an available hall or lecturer;
- a student booking, cancelling, or monitoring an appointment;
- a user locating a building, room, or office and following a multi-floor route;
- a user asking the academic chatbot using text or speech;
- a user translating academic content among English, Tamil, and Sinhala; and
- an administrator managing timetables, buildings, floor plans, map markers, and navigation graphs.

[[THESIS INSERT — FIGURE 3.2: UML use-case diagram with Student, Lecturer, Administrator, and external AI/cloud-service actors. Export from a diagram tool at print resolution.]]

## 3.3 System Architecture

LECSTU is organized as a monorepo containing a React/TypeScript frontend, an Express/TypeScript REST backend, Python AI services, shared types, research datasets and scripts, and automated tests. PostgreSQL stores institutional and navigation data through Prisma ORM. The browser accesses only the Express API; the backend validates authorization and coordinates service calls. Python FastAPI services expose ASR, translation, timetable extraction, floor-plan vision, and navigation-analysis capabilities. Rasa operates as the conversational service and uses custom actions to retrieve current information through authenticated backend endpoints.

The frontend uses React 19, Vite, Tailwind CSS, React Router, Zustand, Axios, Leaflet, and reusable responsive components. The backend uses Express 5, Prisma 7, PostgreSQL, JWT, bcrypt, validation middleware, rate limiting, file upload handling, and SSE. This separation allows AI engines to change without rewriting the primary application.

[[THESIS INSERT — FIGURE 3.3: Final system architecture. Show React client; Express REST API; PostgreSQL; Rasa; ASR :8001; timetable extraction :8002; floor-plan vision :8003; indoor-navigation engine :8004; translation service; and optional Google/Azure APIs. Use arrows labelled REST, SSE, or database access.]]

[[THESIS INSERT — FIGURE 3.4: Deployment diagram showing the actual hosted services and URLs. Use the final production configuration from hosting documentation and hide secrets, tokens, database credentials, and internal keys.]]

## 3.4 Data Model and Security Design

The relational model includes users and roles, faculties, departments, courses, student groups, halls, lecturer offices, master timetables, appointments, notifications, buildings, floor plans, markers, navigation nodes and edges, QR codes, and navigation sessions. Composite indexes support timetable and appointment queries. The navigation graph persists analyzed topology, enabling deterministic routing without rerunning image analysis.

Security controls include password hashing with bcrypt, JWT access control, role checks for student, lecturer, and administrator functions, request validation, CORS controls, rate limiting, protected uploads, and an API key for chatbot-to-backend actions. Password-reset tokens are time-limited and the reset endpoints are rate-limited. [[THESIS INSERT: Add exact token expiry, hashing/storage method, tested rate limits, audit-log coverage, and a threat-model table based on the final configuration. Do not disclose real secrets.]]

[[THESIS INSERT — FIGURE 3.5: Final ER diagram exported from the Prisma schema. It must include cardinalities and navigation entities; the existing `docs/indoor-navigation/ER-DIAGRAM.md` can supply the navigation section.]]

## 3.5 AI Component Implementation

### 3.5.1 ASR Pipeline

Audio is accepted through the voice interface, normalized, and sent to the ASR service. The service provides interchangeable Whisper, Google, Azure, and fine-tuned Whisper engines. Local preprocessing utilities support loading, resampling, and noise reduction. A transcription and timing metadata are returned to the client or forwarded to the chatbot.

The experiment compared Whisper tiny, base, small, medium, a fine-tuned tiny model, and Google’s English configuration in the available valid run. Whisper medium provides the strongest tested English WER but incurs the highest latency. Engine selection can therefore be based on deployment constraints rather than one metric.

[[THESIS INSERT — CODE LISTING 3.1: A focused 20–35-line excerpt from `ai-services/asr/asr_service.py` showing engine selection and transcription timing. Remove boilerplate and secrets; explain the excerpt below the listing.]]

### 3.5.2 Rasa Chatbot

The chatbot defines 11 intents: `ask_timetable`, `ask_hall_availability`, `ask_lecturer_availability`, `book_appointment`, `cancel_appointment`, `ask_directions`, `ask_office_location`, `greeting`, `goodbye`, `fallback`, and `out_of_scope`. Six entity types represent course, lecturer, hall, day, time, and building. The NLU pipeline uses a whitespace tokenizer, regex and lexical-syntactic features, word and character count-vector features, and a DIET classifier trained for 100 epochs. Dialogue policies combine memorization, rules, unexpected-intent handling, and TED.

Custom actions connect predicted intent and entities to current platform data. For example, a timetable query is resolved for the authenticated user, while a direction query invokes map search and route computation. This avoids storing volatile timetable or availability facts directly in training responses.

[[THESIS INSERT — FIGURE 3.6: Chatbot sequence diagram: user speech/text → optional ASR → Rasa NLU → dialogue policy → custom action → Express API → PostgreSQL/navigation service → multilingual response.]]

[[THESIS INSERT — CODE LISTING 3.2: A representative custom action from `ai-services/chatbot/actions/actions.py`, preferably timetable or indoor directions. Include only the central logic and explain authentication/error handling.]]

### 3.5.3 Translation Pipeline

The translation service exposes local MarianMT, mBART-50, and optional Google/Azure adapters. The benchmark uses the same corpus, metric functions, logging format, and repeated-run structure for each engine. Pivot translation is used where a direct model is unavailable, which may compound errors and latency. The system records candidate text, reference, BLEU, embedding similarity, latency, language pair, category, engine, and run number.

[[THESIS INSERT — CODE LISTING 3.3: Engine selection and pivot-translation logic from `ai-services/translation/translation_service.py` or its engine classes. State which directions are direct and which are pivoted.]]

### 3.5.4 Indoor Navigation

Administrators upload floor plans and review AI-assisted room/corridor detections. Approved nodes and edges are stored in PostgreSQL. At runtime, A* is the primary route algorithm and Dijkstra is the fallback. Cross-floor routes use stairs or lift nodes, and building connectors support multi-building routes. A QR code maps the user to a known node; the platform then returns route geometry, distance, estimated time, and step-by-step guidance. Natural-language requests such as “Take me to the cafeteria” are resolved through entity search and route computation.

[[THESIS INSERT — FIGURE 3.7: Indoor-navigation pipeline: floor-plan upload → OCR/vision → admin correction → graph publication → QR position → A*/Dijkstra → map overlay and turn-by-turn directions.]]

[[THESIS INSERT — CODE LISTING 3.4: Core A* loop from the TypeScript navigation module, followed by a short complexity and heuristic-admissibility explanation.]]

## 3.6 Dataset Preparation

### 3.6.1 ASR Dataset

The ASR manifest contains 150 utterances: 50 per language across timetable, hall, appointment, direction, and general categories. Audio is 16 kHz mono and paired with a ground-truth transcription. The currently committed audio is organized under one speaker identifier (`S01`) and includes sample or synthetic material. This dataset validates the pipeline but is not sufficient for broad claims about accents, speakers, or campus noise.

[[THESIS INSERT — TABLE 3.1: Final ASR dataset distribution by language, speaker, gender/age band only where ethically approved, category, recording condition, and duration. Replace the present one-speaker data with consented human recordings or explicitly narrow the thesis claim.]]

### 3.6.2 NLU Dataset

Approximately 416 examples cover the 11 intents and six entity types. The evaluation used five-fold cross-validation and a separate 77-example held-out set. Training utterances contain variants of timetable, availability, appointment, office, and direction queries. A stratified split was used to preserve intent coverage.

[[THESIS INSERT — TABLE 3.2: Exact training and test example counts per intent and entity, generated from the final YAML files. Explain how duplicates and paraphrase leakage were checked.]]

### 3.6.3 Translation Corpus

The translation manifest contains 300 bilingual entries corresponding to 100 trilingual sentence sets. It covers the six directions `en-ta`, `ta-en`, `en-si`, `si-en`, `ta-si`, and `si-ta` across timetable, appointment, navigation, notification, and general categories. Validation scripts check identifiers, language fields, and completeness.

[[THESIS INSERT — TABLE 3.3: Corpus counts by category and language direction, plus sentence-length statistics. State who authored and verified each reference translation.]]

## 3.7 Evaluation Procedures and Metrics

### 3.7.1 ASR Evaluation

Each audio item is transcribed by each configured engine. WER, CER, end-to-end latency, failure status, and configuration metadata are logged. Mean, median, standard deviation, confidence intervals, and paired significance tests are calculated where complete paired outputs exist. Effect size is reported using Cohen’s \(d\) when assumptions are appropriate.

### 3.7.2 NLU Evaluation

Five-fold cross-validation evaluates generalization across splits. Precision, recall, F1, and accuracy are calculated for intent classification and entity extraction. Confusion matrices and error lists support qualitative diagnosis. The acceptance criterion for H2 is weighted intent F1 ≥ 0.85.

\[
Precision=\frac{TP}{TP+FP},\qquad Recall=\frac{TP}{TP+FN},\qquad
F1=2\frac{Precision\times Recall}{Precision+Recall}.
\]

### 3.7.3 Translation Evaluation

Each of 100 sentence sets is translated in six directions for three repetitions, producing 1,800 rows per engine. Quality is assessed using BLEU and cosine similarity between multilingual sentence embeddings. Latency and failures measure operational performance. Planned human raters will independently score adequacy and fluency; inter-rater reliability will be reported using an appropriate statistic such as weighted Cohen’s kappa or Krippendorff’s alpha.

### 3.7.4 Usability Evaluation

The planned study uses at least 20 volunteer students, lecturers, and administrative staff. Participants complete representative tasks using conventional menu navigation and AI-assisted interaction. Measures include completion time, success, errors, SUS, accessibility ratings, and comments. Participant order should be counterbalanced to reduce learning effects. Paired data should be analyzed using a paired-samples *t*-test where assumptions hold or the Wilcoxon signed-rank test otherwise, with confidence intervals and effect sizes.

[[THESIS INSERT — USABILITY PROTOCOL: Add ethics approval/reference, recruitment method, participant information sheet, signed consent, demographic summary, exact tasks, counterbalancing method, start/end event definitions, questionnaire, anonymized raw-data location, analysis script, and exclusion criteria.]]

## 3.8 Software Verification

Playwright end-to-end tests cover personalized timetable display, enrollment-to-timetable synchronization, floor-plan alignment, and password-reset flow. Component-specific research scripts validate manifests and generate structured results. Build and lint commands support static verification. [[THESIS INSERT: Run the complete final test suite in a clean production-like environment and insert tool versions, date, environment, total tests, passes, failures, duration, coverage if measured, and links to archived reports.]]

## 3.9 Ethics and Data Protection

Participation is voluntary and requires informed consent. Participant identifiers are coded (for example, P01), raw voice files are not named with real identities, and research data access is restricted. Raw participant data must remain outside the public repository. Participants may withdraw without penalty. Voice recording begins only through an explicit user action and is visibly indicated. The intended retention period is the research duration plus one year, followed by secure deletion.

[[THESIS INSERT: Confirm the university ethics procedure and approval number before collecting participant data. Insert researcher/supervisor contact details, storage encryption method, deletion procedure, cloud-processing disclosure, and signed-form storage location. Resolve the proposal’s contradictory statement about retaining raw audio “in perpetuity”; the final policy should minimize retention.]]

## 3.10 Validity and Reproducibility

Internal validity is strengthened through common datasets, paired engine comparisons, repeated translation runs, structured logs, and cross-validation. Construct validity is improved by combining quality and latency metrics and by supplementing automated translation scores with planned human judgments. External validity is currently limited by one-speaker ASR data, a single institutional domain, and incomplete user evaluation. Reproducibility is supported by versioned scripts, manifests, configuration files, raw JSON results, and generated reports in the repository.

## 3.11 Chapter Summary

The methodology links artifact construction to four empirical questions. The next chapter reports only the results currently supported by saved experimental or test evidence and clearly identifies missing evaluations.

---

# Chapter 4 — Results and Analysis

## 4.1 Introduction

This chapter reports ASR, NLU, translation, and software-verification findings. Results are separated from planned work to prevent incomplete experiments from being interpreted as final evidence.

## 4.2 ASR Results

The analyzed run contained 350 attempted transcriptions across seven configurations. Three hundred were valid and 50 failed. The valid outputs covered English; Tamil and Sinhala results were unavailable because a processing dependency failed. Table 4.1 summarizes WER.

**Table 4.1 — English ASR WER by configuration**

| Configuration | Mean WER | Median | SD | N |
|---|---:|---:|---:|---:|
| Whisper medium | **0.0410** | 0.0000 | 0.0882 | 50 |
| Whisper small | 0.0612 | 0.0000 | 0.1353 | 50 |
| Whisper base | 0.0743 | 0.0000 | 0.1342 | 50 |
| Google default | 0.0806 | 0.0000 | 0.1421 | 50 |
| Whisper tiny | 0.1045 | 0.0000 | 0.1814 | 50 |
| Fine-tuned Whisper tiny | 0.1092 | 0.0000 | 0.1967 | 50 |

Whisper medium achieved the lowest mean English WER, but Table 4.2 shows a large latency cost.

**Table 4.2 — English ASR latency by configuration**

| Configuration | Mean latency (ms) | Median (ms) | SD (ms) | N |
|---|---:|---:|---:|---:|
| Fine-tuned Whisper tiny | **717.88** | 402.75 | 2,107.37 | 50 |
| Whisper tiny | 899.31 | 756.90 | 748.25 | 50 |
| Whisper base | 1,436.78 | 1,400.30 | 147.41 | 50 |
| Google default | 3,331.13 | 2,960.30 | 1,258.60 | 50 |
| Whisper small | 4,264.72 | 4,188.30 | 324.31 | 50 |
| Whisper medium | 14,018.39 | 13,564.35 | 1,530.03 | 50 |

For Whisper medium versus Google English WER, the reported test produced *p* = 0.0678 and Cohen’s \(d=-0.3345\). At \(\alpha=0.05\), this was not statistically significant, despite the lower sample mean. The 95% interval for the reported difference was (-0.0782, -0.0009); this apparent mismatch with the *p*-value should be audited against the analysis implementation and test definition before final submission.

**H1 status: unresolved.** H1 specifically concerns Tamil and Sinhala, for which no valid comparative result was produced.

[[THESIS INSERT — FIGURES 4.1–4.4: Insert the existing `wer_by_config.png`, `wer_boxplot.png`, `latency_by_config.png`, and `wer_vs_latency.png`. Regenerate them after the full multilingual rerun. Captions must state experiment ID, sample size, error bars, hardware, and whether warm-up was excluded.]]

[[THESIS INSERT — REQUIRED ASR RERUN: Install/verify FFmpeg; record multiple consented English, Tamil, and Sinhala speakers in quiet and campus-noise conditions; execute all engines on identical audio for at least three runs; report language-wise WER/CER/latency, failure rate, paired tests, confidence intervals, and effect sizes.]]

## 4.3 NLU Results

Five-fold cross-validation produced intent accuracy of 0.906, weighted F1 of 0.904, and precision of 0.917. Entity extraction achieved accuracy of 0.979, F1 of 0.953, and precision of 0.972. The held-out 77-example set produced 100% intent and entity results; because this is unusually high, cross-validation is treated as the more conservative estimate.

**Table 4.3 — NLU cross-validation summary**

| Task | Accuracy | Precision | F1 |
|---|---:|---:|---:|
| Intent classification | 0.906 | 0.917 | 0.904 |
| Entity extraction | 0.979 | 0.972 | 0.953 |

The strongest intent was `ask_office_location` (F1 0.986), while `out_of_scope` was weakest (F1 0.812). `book_appointment` and `ask_lecturer_availability` were confused because both often mention a lecturer and time. Direction and hall-availability queries overlapped when hall names occurred without clear routing language. For entities, `lecturer_name` reached F1 0.985, while `course_name` reached only 0.667 because recall was 0.500.

**H2 is accepted:** weighted intent F1 of 0.904 exceeded the defined 0.85 threshold. The result supports the use of Rasa for core academic intents, while the per-class analysis identifies where more training data and clearer dialogue handling are needed.

[[THESIS INSERT — FIGURES 4.5–4.7: Insert cross-validated intent confusion matrix, entity confusion matrix, and intent histogram from `research/nlp-evaluation/results/cv-5fold/`. Ensure axes and labels remain legible at thesis print size.]]

[[THESIS INSERT — TABLE 4.4: Include the complete per-intent precision, recall, F1, and support table from the NLP report. Add 5–10 anonymized error examples and corrected labels in a separate qualitative table.]]

## 4.4 Translation Results

The Marian run evaluated 100 trilingual sentence sets in six directions and three repetitions, producing 1,800 rows with zero runtime errors. Table 4.4 summarizes quality.

**Table 4.5 — Local Marian translation quality**

| Direction | Mean BLEU | Mean semantic similarity | N |
|---|---:|---:|---:|
| English → Tamil | 0.0051 | 0.8612 | 300 |
| Tamil → English | 0.0419 | 0.5083 | 300 |
| English → Sinhala | 0.0108 | **0.8749** | 300 |
| Sinhala → English | **0.0782** | 0.6722 | 300 |
| Tamil → Sinhala | 0.0037 | 0.8433 | 300 |
| Sinhala → Tamil | 0.0000 | 0.3430 | 300 |

The disagreement between BLEU and semantic similarity is substantial. English-to-Sinhala, for example, has low lexical overlap (BLEU 0.0108) but high embedding similarity (0.8749). This may reflect valid paraphrase, tokenization limitations, reference quality, or an embedding model that is insufficiently sensitive to a meaning-changing error. Human assessment is required to distinguish these explanations.

**Table 4.6 — Local Marian translation latency**

| Direction | Mean latency (ms) | SD (ms) | N |
|---|---:|---:|---:|
| English → Tamil | 1,589.1 | 901.5 | 300 |
| Tamil → English | 2,817.5 | 6,017.1 | 300 |
| English → Sinhala | 1,401.6 | 3,552.9 | 300 |
| Sinhala → English | **1,114.2** | 2,954.7 | 300 |
| Tamil → Sinhala | 2,252.4 | 4,985.3 | 300 |
| Sinhala → Tamil | 2,862.2 | 5,405.7 | 300 |

Large standard deviations indicate warm-up, outliers, local hardware variation, or pivot-path effects. Median and percentile latency should therefore be included in the final analysis.

**H3 status: unresolved.** The hypothesis compares local transformers with cloud services, but Google/Azure credentials were unavailable and the cloud run was not executed. Human adequacy and fluency assessment is also outstanding.

[[THESIS INSERT — FIGURES 4.8–4.10: Generate grouped charts for BLEU, semantic similarity, and latency by language direction and engine after cloud results are available. Include confidence intervals and separate direct from pivot translation.]]

[[THESIS INSERT — TABLE 4.7: Human translation evaluation with adequacy, fluency, critical-error rate, inter-rater reliability, and representative error categories. Highlight Sinhala→Tamil for manual inspection.]]

## 4.5 System and Functional Testing

The repository contains Playwright specifications for student timetable display, enrollment synchronization, floor-plan alignment, and password-reset flow. These demonstrate that critical workflows have executable tests. However, a final consolidated run report was not available as thesis evidence at the time of drafting.

[[THESIS INSERT — TABLE 4.8: Final test matrix. Columns: test ID, requirement, precondition, steps, expected result, actual result, status, evidence file. Include authentication/RBAC, timetable conflicts, hall availability, appointments, SSE notifications, map search, same-/multi-floor routes, QR positioning, voice-to-chatbot flow, translation, password reset, responsive layout, security, and error cases.]]

[[THESIS INSERT — TEST VALUES: Record total automated tests, passed, failed, skipped, execution date, browser/OS, server build, database seed, duration, and coverage. Attach the HTML test report or screenshots as Appendix evidence. Never replace failed values with planned values.]]

## 4.6 User Interface Evidence

[[THESIS INSERT — FIGURES 4.11–4.20: Capture consistent, high-resolution screenshots with sample/private data anonymized: (1) login/registration, (2) student dashboard, (3) personalized timetable, (4) hall availability, (5) lecturer directory/profile, (6) appointment booking and live notification, (7) campus map, (8) indoor guided route with floor transition, (9) chatbot conversation using live data, and (10) voice/translation interface. Each caption must explain the research-relevant feature, not merely name the page.]]

## 4.7 Usability Results

[[THESIS INSERT — DO NOT INVENT: Participant demographics; completion/success by task and mode; mean/median task time; percentage improvement; SUS item and total scores; accessibility ratings; statistical test, p-value, confidence interval, effect size; qualitative themes and anonymized quotations. Then accept, reject, or retain H4 based on the preregistered 25% criterion.]]

## 4.8 Chapter Summary

The available evidence supports H2 and confirms a working automated evaluation pipeline for translation. English ASR results reveal a clear accuracy–latency trade-off, but H1 cannot be tested without the missing Tamil and Sinhala runs. H3 lacks a cloud comparison and human evaluation, and H4 lacks participant results. These distinctions shape the discussion in Chapter 5.

---

# Chapter 5 — Discussion

## 5.1 Interpretation of ASR Findings

Whisper medium’s English mean WER of 0.0410 was the best observed result, approximately half the Google baseline mean of 0.0806. Its mean latency was more than four times the Google value and about 19.5 times the fine-tuned tiny value. This illustrates why selecting a model solely by WER would be inappropriate for interactive use. A smaller model may provide a more acceptable conversational delay, while a larger model may suit asynchronous transcription.

The fine-tuned tiny model did not improve WER over the original tiny model in this run. Possible explanations include limited or synthetic fine-tuning data, too few training steps, mismatch between training and evaluation speech, or catastrophic specialization. The result should not be interpreted as evidence that fine-tuning is generally ineffective. It indicates that this specific training setup requires a stronger dataset and controlled ablation.

No conclusion about Tamil or Sinhala is justified. This is especially important because multilingual accessibility is central to the research problem. The failed outputs and one-speaker dataset are not minor implementation details; they directly constrain the validity of RQ-1.

## 5.2 Interpretation of Chatbot Findings

The cross-validated intent F1 of 0.904 and entity F1 of 0.953 show that a compact, domain-specific Rasa pipeline can support common academic tasks without sending every query to a general-purpose cloud model. This benefits privacy, predictable behavior, and integration with structured APIs. The result also validates the proposal’s decision to use a customizable framework.

Aggregate performance hides operational weaknesses. `out_of_scope` fell below the 0.85 target, and `course_name` extraction had recall of 0.500. Appointment and availability utterances share vocabulary, so the system should use clarification rather than acting on an uncertain classification. Similarly, the 100% held-out result may indicate that the split was too easy or contained near-duplicate patterns. A future user-utterance test set should be collected independently after model development.

## 5.3 Interpretation of Translation Findings

The translation system’s zero-error completion confirms engineering reliability for the tested run, but output quality varies strongly by direction. The comparatively high similarity for English-to-Tamil, English-to-Sinhala, and Tamil-to-Sinhala suggests that the system can preserve broad semantic content in these directions. Sinhala-to-Tamil is clearly problematic and may accumulate errors through pivot translation.

Very low BLEU and high similarity should not automatically be described as good translation. Embedding similarity may reward topic overlap even when a time, negation, room number, or lecturer name is wrong. Such errors are disproportionately important in academic logistics. Human reviewers must therefore score both overall adequacy and critical entities such as dates, times, course codes, and locations.

## 5.4 Integrated Artifact Contribution

The strongest contribution is the connection between language interfaces and institutional operations. The chatbot can call current timetable, availability, appointment, and navigation services. Voice input can be routed through ASR to the same intent layer. Translation can wrap academic content, while QR and graph routing connect a spoken destination to a physical route. This architecture turns AI from a standalone demonstration into a set of interchangeable access mechanisms.

The graph-first navigation design is also significant. Computer vision assists an administrator during setup, but published routes use a reviewed database graph. This reduces runtime unpredictability and supports correction, auditing, and deterministic testing. A* provides efficient primary routing while Dijkstra offers a fallback and validation path.

## 5.5 Practical Implications

For deployment, a hybrid configuration is appropriate. Local Rasa and local translation/ASR options improve control and allow the platform to operate without sending every utterance to a third party. Cloud engines can remain optional baselines or fallbacks where consent and institutional policy allow them. Model selection should be configurable by language, device capability, network status, and task criticality.

The platform should also expose uncertainty. Low-confidence chatbot predictions should trigger clarification; translations of critical notices should display the source text; and route instructions should allow users to report an incorrect connector. Accessibility requires these recovery paths as much as it requires voice input.

## 5.6 Limitations and Threats to Validity

The present study has the following limitations:

1. The valid ASR benchmark covers English only, despite the multilingual research question.
2. ASR audio is currently limited to one speaker and includes sample/synthetic recordings.
3. Hardware, model warm-up, caching, and network conditions need fuller control and reporting.
4. The NLU dataset was authored within the project and may not represent spontaneous user language.
5. The held-out NLU result may be inflated by pattern similarity or leakage and requires an independent audit.
6. Translation cloud baselines and human judgments are incomplete.
7. BLEU tokenization may be unsuitable for the tested short Tamil and Sinhala sentences.
8. The usability study is incomplete, so H4 and end-to-end benefit remain untested.
9. The artifact was developed for one university context, limiting institutional generalization.
10. Floor-plan OCR and graph accuracy have not been reported across a sufficiently diverse building set.

## 5.7 Chapter Summary

The results demonstrate technical feasibility and strong domain NLU performance but do not yet establish the full multilingual and user-level claims. The system’s modularity allows those missing evaluations to be completed without redesigning the artifact.

---

# Chapter 6 — Conclusions

## 6.1 Summary of the Research

This research designed and implemented LECSTU, an AI-integrated academic platform for multilingual university environments. The artifact consolidates timetables, staff and hall availability, appointments, notifications, outdoor and indoor navigation, speech recognition, conversational assistance, and translation. It uses a responsive React frontend, an Express/PostgreSQL backend, Rasa, and independently deployable Python AI services.

## 6.2 Alignment with Objectives

**RO-1 was partially achieved.** The ASR pipeline, dataset structure, benchmark, analysis, and fine-tuned engine were implemented. English comparisons were produced, but Tamil/Sinhala evaluation and multi-speaker validity remain incomplete.

**RO-2 was achieved for the defined dataset.** The Rasa chatbot was trained and evaluated, exceeding the F1 acceptance threshold and exposing actionable error patterns.

**RO-3 was partially achieved.** The translation service, trilingual corpus, and local automated benchmark were completed. Cloud comparison and human evaluation remain outstanding.

**RO-4 is not yet empirically achieved.** Ethics planning exists, but participant-based usability evidence must be collected before the objective or H4 can be claimed.

**RO-5 was substantially achieved.** A production-oriented platform integrates the targeted academic and AI services, with automated tests for several critical workflows and documented hosting procedures.

## 6.3 Conclusions Drawn from Current Evidence

The study concludes that a domain-specific, modular AI architecture can integrate multilingual interaction with live university services. Rasa provides acceptable intent and entity performance for the tested academic domain. Local translation is operational but uneven across directions, and automated metrics are insufficient for final quality claims. ASR model choice involves a material accuracy–latency trade-off: the most accurate tested English model was also the slowest. The evidence does not yet justify concluding that the system improves user task efficiency or that it performs adequately across all three target languages.

## 6.4 Recommendations and Future Work

Future work should prioritize:

1. completing a multi-speaker, noise-controlled multilingual ASR benchmark;
2. collecting independent, naturally phrased chatbot test queries and auditing split leakage;
3. running identical Google/Azure translation baselines and conducting blinded human evaluation;
4. completing the approved, counterbalanced usability study with at least 20 participants;
5. expanding Sinhala–Tamil direct models and evaluating preservation of critical entities;
6. measuring indoor-route correctness, path optimality, QR positioning success, and instruction comprehension across multiple buildings;
7. completing WCAG 2.2 and security audits;
8. testing scalability, failure recovery, monitoring, and model/version rollback in production; and
9. evaluating long-term adoption and usefulness beyond laboratory tasks.

## 6.5 Final Statement

LECSTU demonstrates how AI can be incorporated as an accountable interface to university services rather than as an isolated conversational feature. Its principal value lies in the integration of structured academic data, multilingual interaction, and physical navigation within a reproducible research artifact. Completing the outstanding multilingual and participant evaluations will determine whether that technical promise translates into measurable inclusion and efficiency.

---

# References

> **Reference status:** Entries [1]–[4] originate from the supplied proposal and were normalized where sufficient details were available. Entries [5]–[10] are foundational technical sources appropriate to implemented methods. Before submission, verify every author, title, year, volume, issue, pages, DOI/URL, and access date against the original publication, and ensure every in-text citation has one matching IEEE entry. Replace weak web/blog sources from the proposal with peer-reviewed or official primary sources where possible.

[1] S. Z. Sweidan, S. S. Abu Laban, N. A. Alnaimat, and K. A. Darabkh, “SIAAA-C: A student interactive assistant Android application with chatbot during COVID-19 pandemic,” *Computer Applications in Engineering Education*, vol. 29, no. 6, 2021, doi: 10.1002/cae.22419.

[2] K. Peyton, S. Unnikrishnan, and B. Mulligan, “A review of university chatbots for student support: FAQs and beyond,” *Discover Education*, vol. 4, no. 1, 2025, doi: 10.1007/s44217-025-00397-7.

[3] A. Radford *et al.*, “Robust speech recognition via large-scale weak supervision,” in *Proc. 40th International Conference on Machine Learning*, 2023, pp. 28492–28518.

[4] K. Ralston, Y. Chen, H. Isah, and F. Zulkernine, “A voice interactive multilingual student support system using IBM Watson,” arXiv:2001.00471, 2020.

[5] Rasa Technologies GmbH, “Rasa documentation.” [[THESIS INSERT: Cite the exact archived documentation version used (Rasa 3.6+) with URL and access date.]]

[6] M. Junczys-Dowmunt *et al.*, “Marian: Fast neural machine translation in C++,” in *Proc. ACL 2018, System Demonstrations*, 2018, pp. 116–121.

[7] Y. Liu *et al.*, “Multilingual denoising pre-training for neural machine translation,” *Transactions of the Association for Computational Linguistics*, vol. 8, pp. 726–742, 2020.

[8] P. E. Hart, N. J. Nilsson, and B. Raphael, “A formal basis for the heuristic determination of minimum cost paths,” *IEEE Transactions on Systems Science and Cybernetics*, vol. 4, no. 2, pp. 100–107, 1968.

[9] E. W. Dijkstra, “A note on two problems in connexion with graphs,” *Numerische Mathematik*, vol. 1, pp. 269–271, 1959.

[10] World Wide Web Consortium, “Web Content Accessibility Guidelines (WCAG) 2.2,” W3C Recommendation, 2023. [[THESIS INSERT: Add official URL and access date.]]

[[THESIS INSERT — EXPANDED BIBLIOGRAPHY: The final literature review should contain approximately 25–40 relevant, verified sources, emphasizing peer-reviewed work on higher-education chatbots, multilingual ASR for low-resource languages, Tamil/Sinhala NLP, machine-translation evaluation, indoor navigation, usability/SUS, DSR, accessibility, and privacy. Add citations while writing; do not append sources that are never cited.]]

---

# Appendices

## Appendix A — Requirements and Traceability

[[THESIS INSERT: Requirements traceability matrix mapping each functional/non-functional requirement to RO/RQ, implementation module, API/UI evidence, and test ID.]]

## Appendix B — System Design Artifacts

[[THESIS INSERT: Full use-case diagram, ER diagram, API summary, deployment diagram, sequence diagrams, and database schema excerpt.]]

## Appendix C — Selected Code Listings

[[THESIS INSERT: Include only research-relevant excerpts: ASR engine adapter, Rasa custom action, translation metric/engine selection, A* routing, and security/RBAC middleware. Each listing needs filename, commit hash, explanation, and permission/license note for third-party code. Do not paste entire source files.]]

## Appendix D — ASR Materials and Results

[[THESIS INSERT: Final utterance list, dataset manifest summary, recording protocol, participant consent reference, hardware, full per-language results, statistical outputs, and regenerated plots. Raw identifying audio should not be embedded in the thesis.]]

## Appendix E — Chatbot Materials and Results

[[THESIS INSERT: Intent/entity definitions, example training utterances, final pipeline configuration, complete cross-validation report, confusion matrices, and anonymized error analysis.]]

## Appendix F — Translation Materials and Results

[[THESIS INSERT: Corpus construction and verification protocol, example sentence sets, engine/model versions, direct/pivot directions, complete automated results, human-rating form, inter-rater analysis, and error taxonomy.]]

## Appendix G — Usability Study

[[THESIS INSERT: Ethics approval, participant information sheet, consent form, task sheet, pre/post questionnaires, SUS instrument usage note, anonymized participant summary, analysis procedure, complete results, and thematic coding scheme.]]

## Appendix H — Testing Evidence

[[THESIS INSERT: Final automated test report, manual test matrix, browser/device matrix, performance/security/accessibility reports, failure screenshots, fixes, and rerun evidence.]]

## Appendix I — User Interface and Deployment Evidence

[[THESIS INSERT: Numbered screenshots of student, lecturer, and administrator workflows; production architecture; CI/CD or deployment logs; health checks; and anonymized demo credentials if the university permits them. Blur emails, tokens, database URLs, and personal records.]]

---

# Final Submission Checklist (remove this section from the submitted thesis)

- [ ] Confirm the final title, candidate name format, supervisor title/name, department, and academic year.
- [ ] Complete all `[[THESIS INSERT: ...]]` items or explicitly retain them as documented limitations.
- [ ] Complete ethics approval before collecting new participant data.
- [ ] Rerun multilingual ASR with human, multi-speaker audio and a fixed FFmpeg environment.
- [ ] Run cloud translation baselines and blinded human translation evaluation.
- [ ] Conduct and analyze the usability study; update Abstract, Chapters 4–6, and H4.
- [ ] Run the entire automated/manual test suite and archive evidence.
- [ ] Capture anonymized, consistent-resolution UI screenshots.
- [ ] Expand and verify the literature review and IEEE reference list.
- [ ] Audit all numerical claims against raw JSON/report artifacts.
- [ ] Resolve the ASR p-value/confidence-interval inconsistency.
- [ ] Apply the official Word template’s styles, margins, caption numbering, page breaks, and pagination.
- [ ] Generate the Table of Contents, List of Tables, and List of Figures automatically.
- [ ] Run spelling/grammar, plagiarism/similarity, citation, accessibility, and supervisor reviews.
- [ ] Remove this checklist, the document-status note, and extraction/source working files from the final submission package.
