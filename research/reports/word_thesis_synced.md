# Declaration

I, Pirabakaran Shakiththiyan, hereby declare that the thesis entitled “Smart Faculty Access and Student Assistant System (LECSTU)”, submitted to the Faculty of Computing and Technology, University of Kelaniya, in fulfilment of the requirements for the award of the degree of Bachelor of Science Honours in Computer Science, is the result of my own independent work carried out under the guidance and supervision of Mr.Kesavan Selvarajah. This work has not been submitted, in whole or in part, to any conference, journal, book, university, or other institution for the purpose of obtaining any degree, diploma, or other academic qualification. I confirm that all sources of information and ideas from other works have been properly acknowledged in accordance with accepted academic conventions.

Name of the Student: ___________________________
Student Number: _______________________________
Signature of the Student: _______________________
Date: __________________________________________

Name of the Supervisor: _________________________

Department: _____________________________________
Signature of the Supervisor: ______________________
Date: ____________________________________________

## Abstract

University students often have to get information about their timetable, staff, appointments, facilities and how to get around from systems or by asking people directly. This makes it take longer to do things. It is hard to stay on top of everyday university tasks. This project created a website and mobile app called LECSTU that brings all these things together in one place using artificial intelligence. LECSTU is a tool that lets people see different things depending on who they are it shows them their own timetable, when lecturers and halls are free lets them book appointments sends them messages right away helps them find their way around inside buildings using QR codes lets them talk to it in English and it even has a special chatbot that can answer questions, about the university.

The study adopted a Design Science Research approach in which the platform served both as the research artifact and as the experimental testbed. The ASR study measured word error rate and latency for local Whisper configurations and a Google cloud baseline on English academic utterances. The chatbot study used five-fold cross-validation and a held-out test to evaluate intent classification and entity extraction. A translation benchmark measured BLEU, semantic similarity, latency, and human adequacy/fluency over 100 academic sentence sets. Whisper medium produced the lowest English mean word error rate (0.0410), compared with 0.0806 for Google Speech-to-Text, but required substantially greater mean latency (14,018.39 ms versus 3,331.13 ms). The Rasa chatbot achieved cross-validated intent F1 of 0.904 and entity F1 of 0.953, supporting the chatbot hypothesis. The Marian-based translation engine completed 1,800 automated translations without runtime errors and achieved a mean human overall score of 3.76/5.0, but Tamil and Sinhala directions-especially Sinhala-to-Tamil-remained unreliable in practice and are not claimed as completed contributions.

The findings demonstrate the feasibility of integrating local AI services with a production-oriented university platform deployed at https://lecstu.com. The principal contribution is an integrated and reproducible research artifact that connects conversational and voice interfaces to live timetable, appointment, availability, and navigation services, rather than an isolated chatbot or a language-only prototype. A student usability study (*n* = 20, July 2026) reported mean SUS 60.53 (SD 14.45), significantly below the industry benchmark of 68 (*t*(18) = −2.26). Core features (timetable, halls, appointments) scored 4.7–4.9/5; voice and Tamil/Sinhala translation scored ~3.4–3.7/5, with timetable ease rated higher than voice ease (mean difference 1.39, paired *t*(17) = 4.57). All twenty participants would recommend the platform. RO-4 is supported by user satisfaction, SUS, and perceived efficiency ratings. Tamil and Sinhala speech and translation remain future research directions.

## Acknowledgement

I express my sincere gratitude to my research supervisor, Mr. Kesavan Selvarajah, Department of Applied Computing, Faculty of Computing and Technology, University of Kelaniya, for his continuous guidance, constructive feedback, and encouragement throughout the design, implementation, evaluation, and writing of this thesis. I gratefully acknowledge the Faculty of Computing and Technology and the Department of Computer Science, University of Kelaniya, for providing the academic environment, institutional context, and facilities that made the LECSTU platform and this research possible. I thank the technical staff of the Faculty for their assistance with computing resources, network access, and practical support during development, testing, and production hosting of the system. I also thank the 20 students of the Faculty who took part in the usability study and provided questionnaire feedback on https://lecstu.com. Finally, I thank my family and friends for their patience and support during this project.

## Abbreviations

AI                     -    Artificial Intelligence 
API                   -    Application Programming Interface

ASR                  -    Automatic Speech Recognition

BLEU                -   Bilingual Evaluation Understudy

CER                   -   Character Error Rate

CI/CD                -   Continuous Integration/Continuous Deployment

DSR                   -   Design Science Research

F1                       -   Harmonic mean of precision and recall

JWT                   -   JSON Web Token

LECSTU            -   Smart Faculty Access and Student Assistant System

NLU                   -   Natural Language Understanding

NLP                    -   Natural Language Processing

OCR                   -   Optical Character Recognition

PII                       -   Personally Identifiable Information

QR                      -   Quick Response

RBAC                 -   Role-Based Access Control

REST                  -   Representational State Transfer

SSE                     -   Server-Sent Events

STT                    -   Speech-to-Text

SUS                     -   System Usability Scale

TTS                     -   Text-to-Speech

UI/UX                 -   User Interface/User Experience

WCAG                -   Web Content Accessibility Guidelines

WER                   -    Word Error Rate

## Introduction

### 1.1 Background

Universities depend on timely access to academic and administrative information. A student may need to identify the location of a lecture hall, determine whether a lecturer is available, find a free room, view a timetable change, or book an appointment. In many institutions these tasks are distributed across web pages, notice boards, messaging groups, help desks, and separate information systems. Fragmentation increases the number of steps required to complete routine tasks and makes information difficult to locate consistently.

Conventional interfaces also assume that a user can type a correctly formed query, navigate menus, and interpret textual output. Voice input and conversational interaction can reduce some of these barriers when they are connected to live institutional data such as timetables, appointments, availability, notifications, and locations. A useful academic assistant must do more than answer static frequently asked questions.

Previous campus assistant applications and university chatbots show that mobile access and conversational support can improve the availability of student services [1], [2]. Voice-interactive student support has also been demonstrated as technically feasible [4]. Nevertheless, much existing work evaluates an isolated chatbot or a location-bound kiosk. It does not examine how speech recognition, domain-specific intent recognition, academic logistics, and indoor navigation can operate together within one deployable, testable platform.

This research addresses that integration gap through LECSTU. The system is a responsive web platform for students, lecturers, and administrators, supported by an Express/PostgreSQL application backend and Python AI microservices, deployed in production at https://lecstu.com. It provides authentication and RBAC, personalized timetables, staff and facility availability, appointment management, notifications, campus maps, graph-based indoor routing with QR positioning, English voice transcription, conversational academic assistance through Rasa custom actions, and an optional translation layer for Tamil and Sinhala UI text. The platform is primarily evaluated in English; Tamil and Sinhala speech and translation infrastructure were implemented but did not reach acceptable quality during this project cycle.

### 1.2 Research Problem

Students and faculty have no one AI platform to manage their daily academic logistics. Existing channels are often limited in features, dependent on text, or not connected to current institutional data. This may mean that users waste time searching for information or rely on staff to handle repetitive requests. Users with visual, motor or situational limitations may face an additional accessibility burden.

The ASR, chatbot and machine translation technologies are all available as separate products, but it is not clear if they are suitable for academic queries. Recognition quality can vary by language and accent, intent classifiers can confuse semantically adjacent tasks, translations can be fluent but change academic meaning and accurate models can still be impractical if their latency is high. The research problem is therefore both an engineering and an empirical problem: how can these components be integrated into one production-oriented academic platform, and how effectively do they support university tasks in the implemented setting?

### 1.3 Research Aim

### Objective of research is to design, develop and evaluate an AI based academic platform to improve accessibility of faculty details and student services in university setting.

### 1.4 Research Objectives

RO-1: Development and evaluation of an ASR system that supports academic voice queries in English, with Tamil and Sinhala being left for future research.

RO-2: Development and training of a domain-specific NLP chatbot which can perform academic intent recognition and entity extraction.

RO-3: Implementation and evaluation of the machine translation component using local MarianMT for translating academic material, while Tamil/Sinhala translation will be tested in the future.

RO-4: Evaluation of the impact of AI integration on performance, satisfaction, and accessibility using a usability study.

RO-5: Development of an academic production-ready platform that includes AI components, acting as the platform for the research.

### 1.5 Motivation

### The motivation for this research is both practical and academic.

### Practical motivation

Students and staff at the Faculty of Computing and Technology, University of Kelaniya, routinely depend on timetables, hall bookings, lecturer availability, appointments, and building navigation during a single academic day. These tasks are often spread across notice boards, PDF timetables, messaging groups, help desks, and separate web pages. That fragmentation wastes time, increases dependence on administrative staff for repetitive enquiries, and makes information harder to access for users who cannot conveniently type or navigate dense menus for example when moving between lecture halls or carrying materials on campus. A single platform that connects voice input, conversational queries, and indoor navigation to live institutional data can reduce these everyday barriers. Deploying such a system as a working web application, rather than a laboratory prototype alone, makes the research directly relevant to real university workflows.

Academic motivation

Prior studies demonstrate individual components campus apps, university chatbots, speech recognition, and indoor navigation but rarely evaluate them together within one reproducible, production-oriented artifact connected to live academic services. This project addresses that gap through Design Science Research: LECSTU is both the delivered system and the experimental testbed. The study also contributes empirical evidence on trade-offs among model accuracy, latency, privacy, and deployment complexity for domain-specific AI in higher education. Tamil and Sinhala support is acknowledged as an important extension direction, grounded in published low-resource language research, but the present thesis focuses on what was reliably achieved: English voice and chatbot interaction, integrated academic logistics, and graph-based indoor navigation.

### 1.6 Research Questions and Hypotheses



| ID | Research Question | Associated Hypothesis |
| --- | --- | --- |
| RQ-1 | How does Whisper compare with Google Speech-to-Text in WER and latency for English academic voice queries? | H1: Whisper Medium produces a lower WER than Google Speech-to-Text for English academic queries. |
| RQ-2 | Can a Rasa-based chatbot achieve acceptable precision and recall for academic intent classification and entity extraction? | H2: The chatbot achieves an F1-score of at least 0.85 for core academic intents. |
| RQ-3 | How does local MarianMT perform in automated and human evaluations for academic translation tasks? | H3: Local MarianMT achieves acceptable human-rated adequacy and fluency for English-centred academic directions. |
| RQ-4 | Does AI integration improve task completion time, user satisfaction, and accessibility for university users? | H4: AI-integrated features reduce the mean task completion time by at least 25% compared with manual navigation. |



### 1.7 Scope

The functional scope includes three roles-student, lecturer, administrator and covers user profiles, master and personalized timetables, hall and lecturer availability, appointments, real-time notifications, floor-plan maps, indoor navigation with QR positioning, English voice input, chatbot interaction, and optional Tamil/Sinhala UI translation. The primary operational language of the deployed platform is English. The empirical scope includes model quality and latency for English ASR, classification and extraction performance for NLU, automated and human translation evaluation, and student usability questionnaire evaluation (n = 20).

The study does not claim to replace all university information systems. It is a research prototype and integration testbed that has been deployed for demonstration and evaluation. The available ASR benchmark covers English only; Tamil and Sinhala ASR failed in the recorded run because of a processing dependency. Translation infrastructure exists, but Tamil/Sinhala output quality-especially Sinhala-to-Tamil was insufficient for reliable academic use. The usability study collected 20 student questionnaire sessions (meeting the preregistered target of 20). These boundaries are treated as limitations rather than concealed through extrapolation.

### 1.8 Significance and Contributions

Contributions from the research include:

1.An academically implemented platform for the study of AI interactions with live data on timetables, appointments, facilities, and navigation.

2.An English ASR benchmark structure for academic questions with a finetuning pipeline and dataset methodology that is also ready to be extended to Tamil and Sinhala

3.A Rasa NLU model for 11 academic intents and six entity types with integration of custom actions for live data access.

4.An AI-augmented graph-based indoor navigation system with A* route finding, QR code position tracking, floor changes, and natural language directions.

5.A pipeline for evaluation of translations with both automatic scores and human ratings, showing how Tamil/Sinhala language support still needs improvement.

6.Real-world example on the trade-offs between accuracy, latency, privacy and complexity of deployment in a university workflow.

### 1.9 The Layout of the Thesis

This thesis is structured to systematically present the development, evaluation, and implications of LECSTU (Smart Faculty Access and Student Assistant System)-an AI-integrated academic platform designed to unify timetables, staff and hall availability, appointments, real-time notifications, campus and indoor navigation, English voice input, and conversational academic assistance within a single production-deployed web application. The document is organized into six chapters, together with references and appendices, each addressing a specific aspect of the research. The following outlines the structure and purpose of each chapter:

1.Introduction introduces the research problem, outlining the significance of fragmented academic information access at universities and the need for an intelligent platform connected to live institutional data. It presents the background and context of the study, defines the research problem, states the aim and five research objectives (RO-1 to RO-5), explains the practical and academic motivation for the project at the Faculty of Computing and Technology, University of Kelaniya, and presents the research questions and hypotheses (RQ-1 to RQ-4, H1 to H4). It also defines the scope and limitations of the study, summarizes the six principal contributions of the LECSTU artifact, and provides this overview of the thesis structure.

2.Literature Review surveys existing studies on digital student support, university chatbots, automatic speech recognition, machine translation, campus and indoor navigation, and responsible AI. It reviews prior campus assistant applications [1], [2], voice-interactive student support systems [4], Whisper-based ASR [3], Rasa conversational agents [5], MarianMT and mBART translation models [6], [7], and graph-based pathfinding methods [8], [9]. It identifies gaps in existing work-particularly the lack of an integrated, deployable platform that connects AI components to live academic logistics and indoor navigation and positions the current research within the field.

3.Methodology describes the research design using Design Science Research (DSR), in which LECSTU serves as both the delivered artifact and the experimental testbed. It details system requirements and use cases for students, lecturers, and administrators; the monorepo architecture comprising a React/TypeScript frontend, Express/PostgreSQL backend, Python AI microservices, and Rasa chatbot; and the data model and security design. It explains the implementation of the ASR pipeline (Whisper and cloud baselines), Rasa NLU chatbot with custom actions, MarianMT translation service, and AI-assisted indoor navigation module (A* routing, QR positioning, and floor-plan graph construction). It also covers dataset preparation for ASR, NLU, and translation experiments; evaluation procedures and metrics (WER, F1, BLEU, semantic similarity, human ratings, and planned usability measures); software verification through Playwright tests; ethics and data protection; and validity and reproducibility measures.

4.Results and Analysis presents the empirical findings from the completed experiments and system testing. It reports English ASR benchmark results comparing Whisper configurations with Google Speech-to-Text, including word error rate and latency trade-offs; Rasa NLU evaluation results from five-fold cross-validation and held-out testing, including intent F1 of 0.904 and entity F1 of 0.953; MarianMT translation results across six language directions with automated BLEU and semantic similarity scores, together with human evaluation ratings from five blind raters; student usability questionnaire results (n = 20, mean SUS 60.53); and system and functional testing evidence, including production deployment at https://lecstu.com. It states the acceptance status of each hypothesis.

5.Discussion interprets the results in relation to the research questions and prior literature. It analyses the accuracy–latency trade-off in English ASR model selection; the strengths and operational weaknesses of the domain-specific Rasa chatbot, including intent confusion patterns between appointment and availability queries; the limitations of automated translation metrics and the uneven quality of Tamil/Sinhala directions; and the integrated contribution of connecting voice input, conversational AI, and graph-based indoor navigation to live timetable, appointment, and facility data. It discusses practical implications for hybrid local/cloud deployment, uncertainty handling, and accessibility, and documents eleven limitations and threats to validity.

6.Conclusions summarizes the key findings of the research, maps outcomes to each research objective (RO-1 to RO-5), and draws evidence-based conclusions about the feasibility of integrating AI into a production-oriented university platform. It reflects on how the results align with the project’s aims of improving access to faculty information and student services through voice, chatbot, and navigation features. It proposes recommendations and future work, including ongoing Tamil and Sinhala ASR and translation research supported by published corpora such as IISc-MILE Tamil (SLR127) [11] and Large Sinhala ASR (SLR52) [12], extension of usability evaluation to lecturer and administrator cohorts, indoor navigation validation across buildings, and security and accessibility audits.

The thesis also includes an IEEE-formatted References section and Appendices(A–I) containing requirements traceability, system design artifacts, selected code listings, ASR/chatbot/translation materials and results, usability study instruments, testing evidence, and user interface and deployment screenshots.

This structure ensures a logical progression from problem identification and motivation through literature review, artifact design, empirical evaluation, and interpretation to conclusions and future research directions, providing a comprehensive examination of LECSTU’s potential as an AI-integrated academic platform for university environments.

Figure 1-Fragmented channels vs. LECSTU unified platform

Fragmented university information channels consolidated into the LECSTU platform. Currently, students depend on separate systems for timetables, staff information, maps, and notices. LECSTU unifies these services in a single academic interface.

## Literature Review

### 2.1 Introduction

This chapter establishes the conceptual and empirical basis of the study. It reviews digital student support, conversational agents, speech recognition, machine translation, navigation, and responsible AI.

### 2.2 Digital Student Support and Campus Applications

Mobile and web applications can give students continuous access to academic services, but feature availability alone does not guarantee adoption. Sweidan  developed a student interactive assistant application with a chatbot during the COVID-19 period, illustrating how conversational access can complement conventional mobile features [1]. More recent reviews describe university chatbots as commonly focused on frequently asked questions, admissions, and basic service guidance [2]. These systems improve availability but may remain disconnected from transactional and time-dependent data.

For a campus application to be operationally useful, it should reduce fragmentation. A timetable query, for example, should return the authenticated student’s current data rather than a generic answer. An appointment query should respect lecturer availability and booking constraints. LECSTU therefore treats conversational AI as an access layer over academic services, not as a separate novelty feature.

### 2.3 Conversational Agents in Higher Education

Rule-based chatbots offer predictable responses but are limited by manually enumerated phrases and dialogue paths. Data-driven NLU pipelines classify user intent and extract entities such as a lecturer, course, day, time, building, or hall. Rasa was selected because it supports customizable on-premise NLU and dialogue components, domain data, custom actions, and controlled integration with private APIs [5]. This is relevant where queries contain institutional details that should not automatically be sent to a general cloud language model.

Academic intents are frequently close in meaning. “Can I meet Dr. Silva tomorrow?” may request availability or imply a booking. “Where is Main Hall?” can refer to a building, a hall, or a route. A realistic evaluation should therefore report confusion patterns and per-class metrics, not accuracy alone. Five-fold cross-validation provides a more conservative estimate than a single favourable held-out split.

### 2.4 Automatic Speech Recognition for Voice Access

ASR converts speech into text that can be passed to the NLU layer. Whisper is trained on large-scale multilingual and multitask supervision and provides locally deployable model sizes with different accuracy and computational requirements [3]. Cloud ASR services offer managed infrastructure but introduce network dependency, recurring cost, and data-governance concerns.

WER is the conventional ASR measure and is computed as

S:Substitutions
          D:Deletions
            I:Insertions
           N:Number of words in the reference transcription

WER must be considered together with latency. A high-capacity model may minimize errors while producing a response too slowly for fluid interaction. For Tamil and Sinhala, prior work shows that low-resource ASR requires dedicated corpora and domain adaptation [11], [12]; this project implemented the pipeline in English and prepared finetuning datasets for future Tamil/Sinhala extension.

### 2.5 Machine Translation for Academic Content

Machine translation can support UI localisation and academic notices. Local transformer models can reduce dependence on cloud providers, whereas managed translation services may offer stronger infrastructure and broad training coverage. MarianMT provides neural translation models for particular language pairs, while mBART supports multilingual sequence-to-sequence tasks [6], [7].
BLEU measures n-gram overlap with a reference, but it can undervalue valid translations with different wording, especially for short sentences and morphologically rich languages. For this reason, the present study combines BLEU with multilingual embedding similarity, latency, and human adequacy and fluency ratings. In the implemented system, English remained the primary interface language; Tamil and Sinhala translation was evaluated experimentally but did not reach production quality for all directions.

### 2.6 Campus and Indoor Navigation

Outdoor campus maps are insufficient once a student enters a multi-floor building. Indoor navigation requires a representation of rooms, corridors, stairs, lifts, and connectors. Graph-based routing expresses locations as nodes and traversable links as weighted edges. A* uses a heuristic to prioritize promising routes, while Dijkstra’s algorithm provides a non-heuristic shortest-path alternative [8], [9]. QR codes provide a low-cost positioning mechanism because a scan can map a user to a known graph node without specialized radio infrastructure.

LECSTU combines floor-plan image analysis with an administrator-reviewed navigation graph. Image processing and OCR help seed rooms and corridors, but runtime route computation uses a persisted graph. This separation avoids repeatedly applying uncertain computer vision during every navigation request.

### 2.7 Accessibility, Privacy, and Responsible AI

Voice interfaces may improve access for users who cannot conveniently type or navigate dense menus, but voice is potentially identifying biometric data. Cloud processing may expose speech or text to third parties. Responsible deployment therefore requires explicit recording controls, informed consent for research recordings, data minimization, restricted access, and defined retention periods. Authentication, authorization, secure password hashing, rate limiting, validation, and audit records are also necessary because the platform handles schedules and appointments.
Accessibility is broader than multilingual output. Responsive design, keyboard access, clear labels, adequate contrast, error recovery, and compatibility with assistive technology should be evaluated against WCAG guidance [10].

Table 1- WCAG 2.2 accessibility audit summary



| Criterion | Description | Level | Result | Notes |
| --- | --- | --- | --- | --- |
| 1.1.1 | Non-text content | A | Partial | Logo and floor labels are present; map and route information are partly visual |
| 1.3.1 | Info and relationships | A | Partial | Forms are labelled; indoor tabs use ARIA roles |
| 1.4.1 | Use of colour | A | Partial | Route colours such as green, yellow, and red are supported with a text legend |
| 1.4.3 | Contrast minimum | AA | Partial | Forms are readable; some sidebar links require further contrast verification |
| 1.4.4 | Resize text | AA | Pass | Responsive layout worked at 200% zoom during spot checking |
| 2.1.1 | Keyboard | A | Partial | Core navigation works; maps and some icon buttons require improvement |
| 2.4.2 | Page titled | A | Pass | Document titles are set, for example, “LECSTU - Academic Platform” |
| 2.4.4 | Link purpose | A | Pass | Clear visible link text is used in authentication and navigation pages |
| 2.4.7 | Focus visible | AA | Partial | Input focus rings are visible; some icon controls need clearer focus indication |
| 3.3.1 | Error identification | A | Pass | Login and form errors are displayed using text messages |
| 3.3.2 | Labels or instructions | A | Pass | Email, password, search, and chat fields are properly labelled |
| 4.1.2 | Name, role, value | A | Partial | Chat and indoor navigation components are mostly accessible; password toggle is not fully labelled |



The audit found that LECSTU meets several foundational accessibility requirements particularly labelled authentication forms, visible error messages, responsive design, voice input as an alternative interaction mode, and structured ARIA on indoor navigation and the chat widget. Full WCAG 2.2 Level AA conformance was not claimed. Unresolved issues include icon-only controls without accessible names (password show/hide, mobile menu close), partial reliance on colour for route status on maps, and limited keyboard operability on Leaflet map interactions. Voice input improves access for users who cannot type easily, but it does not replace the need for perceivable and operable visual UI for deaf users or noisy environments.

### 2.8 Identified Research Gap

The literature demonstrates useful campus apps, university chatbots, voice assistants, ASR systems, and translation models. The missing element is a reproducibly evaluated platform that joins these capabilities to live academic logistics and indoor navigation in a deployable university setting. Existing studies tend to isolate a model or provide static FAQ interaction. They rarely compare AI quality and latency while also delivering end-to-end services such as timetables, appointments, and guided indoor routing.

LECSTU addresses this gap by using one artifact to evaluate component performance and system-level usability. The intended contribution is not a new foundation model; it is the design evidence, datasets, evaluation results, and integration knowledge required to make existing AI components useful within a university workflow. Tamil and Sinhala support is acknowledged as an important extension area, supported by published corpora and prior multilingual student-support research [4], [11], [12], but is treated as future work in this thesis because the implemented system did not achieve reliable quality in those languages.

### 2.9 Chapter Summary

The review supports the selection of customizable local AI components, multi-metric evaluation, graph-based navigation, and privacy-conscious architecture. It also establishes the need for end-to-end usability evidence. Chapter 3 describes how the artifact and evaluations were designed.

### 2.10 Literature Comparison Matrix

Table 2 summarizes peer-reviewed and primary empirical studies selected after the search procedure in Section 2.11. Symbols: Y = present or evaluated; P = partial or limited; - = not reported or not applicable. The final row positions LECSTU against the same dimensions for transparency.

Table 2-Literature comparison matrix (selected studies)



| Study (Year) | Context | Language | Chatbot | ASR | Translation | Live University Data | Navigation | Evaluation Metrics | Principal Limitation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sweidan et al. [1], 2021 | Android campus assistant during COVID-19 | English, Arabic | Yes | - | - | Partial | - | Adoption and usability survey | Feature-limited with weak transactional integration |
| Peyton et al. [2], 2025 | Systematic review of higher education chatbots | Multilingual | Yes | Partial | Partial | Partial | - | Thematic synthesis | Mostly FAQ-based or static bots; few live-data systems |
| Ralston et al. [4], 2020 | Multilingual voice-based student support | English and other languages | Yes | Yes | Yes, cloud-based | - | - | Accuracy and task completion | IBM Watson-based stack; no complete academic platform |
| Cao et al. [14], 2023 | Classroom small-group discourse ASR | English | - | Yes | - | - | - | WER, empty rate and downstream NLP | K–12 STEM setting; high WER under noisy conditions |
| Mejia et al. [15], 2024 | First-year adaptability chatbot in Peru | Spanish | Yes | - | - | - | - | Adaptability pre-test and post-test survey | No timetable, appointments or indoor routing |
| Arévalo-Cordovilla and Peña [16], 2026 | Predictive outreach using a WhatsApp bot | Spanish | Yes, LLM-based | - | - | Partial, LMS-based | - | AUC, response rate and latency | Messaging channel only; no maps or voice interface |
| Colbran et al. [17], 2026 | Student perspectives on a generative AI chatbot | English | Yes | - | - | Partial | - | Survey, usage analytics and UX | Policy and accuracy concerns; not integrated with logistical services |
| Madhavaraj et al. [11], 2022 | Tamil and Kannada low-resource ASR | Tamil, Kannada | - | Yes | - | - | - | WER and CER | Corpus and methodology study; no campus application |
| Kjartansson et al. [12], 2018 | Crowdsourced Sinhala speech corpus | Sinhala | - | Yes, dataset | - | - | - | Corpus size and recording hours | Dataset contribution only; no deployed student system |
| Radford et al. [3], 2023 | Whisper foundation ASR model | More than 99 languages | - | Yes, model | - | - | - | WER on general benchmarks | General-purpose model; not evaluated for university workflows |
| Junczys-Dowmunt et al. [6], 2018 | Marian neural machine translation engine | Language-pair specific | - | - | Yes, engine | - | - | BLEU and processing speed | Translation engine only; no academic-service integration |
| Liu et al. [7], 2020 | mBART multilingual machine translation | More than 50 languages | - | - | Yes, model | - | - | BLEU on machine translation benchmarks | General translation model with uneven performance for low-resource language pairs |
| Padmaja et al. [18], 2022 | Campus QR-based indoor and outdoor routing web application | English | - | - | - | Partial | Yes, QR codes and static maps | Functional prototype testing | Uses predefined CAD maps; no AI or live academic APIs |
| Yan et al. [19], 2022 | QR-based indoor navigation network | - | - | - | - | - | Yes, graph and QR nodes | Path-planning case study | Shopping mall context; not a higher education platform |
| Sushma and Ambareesh [20], 2017 | QR-based indoor navigation on iOS | English | - | - | - | - | Yes, QR codes and Google Maps | Prototype demonstration | iOS-only; no chatbot or institutional data integration |
| LECSTU, this work, 2026 | Integrated academic web platform | English with Tamil and Sinhala UI experiments | Yes | Yes, English | Partial, local Marian | Yes | Yes, A*, QR codes and multi-floor routing | WER, F1-score, BLEU, human MT ratings, SUS (60.53, n = 20) and WCAG audit | Tamil and Sinhala ASR are not production-ready |



The matrix shows that prior work typically optimizes one layer FAQ chatbots, voice demos, translation engines, or navigation prototypes-while rarely connecting them to authenticated timetables, appointments, hall availability, and indoor routing in one deployable artifact. LECSTU is positioned to address that integration gap; its limitations (English-first ASR, uneven Tamil/Sinhala translation, completed student questionnaire usability (n = 20)) are reported explicitly rather than extrapolated from component benchmarks alone.

## Methodology

### 3.1 Research Design

The study uses Design Science Research because its central activity is the construction and evaluation of an information-system artifact. The process consisted of problem identification, definition of objectives, artifact design and development, demonstration through university tasks, component evaluation, and communication of results. Quantitative experiments evaluate ASR, NLU, and translation. A mixed-method usability evaluation is planned to combine task measures with questionnaire ratings and qualitative feedback.

The independent variables include ASR engine/model, language, translation engine, language direction, and interaction mode. Dependent variables include WER, CER, latency, intent precision/recall/F1, entity precision/recall/F1, BLEU, semantic similarity, task-completion time, task success, SUS score, and participant feedback.

Figure 2:Design Science Research process

### 3.2 Requirements and Use Cases

Requirements were derived from the proposal’s identified problems and representative academic tasks. The principal use cases are:

- a student viewing a personalized timetable and receiving changes;

- a student finding an available hall or lecturer;

- a student booking, cancelling, or monitoring an appointment;

- a user locating a building, room, or office and following a multi-floor route;

- a user asking the academic chatbot using text or English speech;

- a user optionally viewing Tamil or Sinhala UI text through the translation layer; and

- an administrator managing timetables, buildings, floor plans, map markers, and navigation   graphs.

Figure 3:LECSTU use cases and actors

### 3.3 System Architecture

LECSTU is organized as a monorepo containing a React/TypeScript frontend, an Express/TypeScript REST backend, Python AI services, shared types, research datasets and scripts, and automated tests. PostgreSQL stores institutional and navigation data through Prisma ORM. The browser accesses only the Express API; the backend validates authorization and coordinates service calls. Python FastAPI services expose ASR (:8001), timetable extraction (:8002), floor-plan vision (:8003), indoor-navigation analysis (:8004), and translation capabilities. Rasa operates as the conversational service and uses custom actions to retrieve current information through authenticated backend endpoints. The platform is deployed in production at https://lecstu.com.

The frontend uses React 19, Vite, Tailwind CSS, React Router, Zustand, Axios, Leaflet, and reusable responsive components. The backend uses Express 5, Prisma 7, PostgreSQL, JWT, bcrypt, validation middleware, rate limiting, file upload handling, and SSE. This separation allows AI engines to change without rewriting the primary application.

Figure 4:LECSTU system architecture

Figure 5:Production deployment

### 3.4 Data Model and Security Design

The relational model includes users and roles, faculties, departments, courses, student groups, halls, lecturer offices, master timetables, appointments, notifications, buildings, floor plans, markers, navigation nodes and edges, QR codes, and navigation sessions. Composite indexes support timetable and appointment queries. The navigation graph persists analysed topology, enabling deterministic routing without rerunning image analysis.

Security controls include password hashing with bcrypt, JWT access control, role checks for student, lecturer, and administrator functions, request validation, CORS controls, rate limiting, protected uploads, and an API key for chatbot-to-backend actions. Password-reset tokens are time-limited and the reset endpoints are rate-limited.

Figure 6:Core entity–relationship model

### 3.5 AI Component Implementation

#### 3.5.1 ASR Pipeline

Audio is accepted through the voice interface, normalized, and sent to the ASR service. The service provides interchangeable Whisper, Google, Azure, and fine-tuned Whisper engines. Local pre-processing utilities support loading, resampling, and noise reduction. A transcription and timing metadata are returned to the client or forwarded to the chatbot.

The experiment compared Whisper tiny, base, small, medium, a fine-tuned tiny model, and Google’s English configuration in the available valid run. Whisper medium provides the strongest tested English WER but incurs the highest latency. Engine selection can therefore be based on deployment constraints rather than one metric. Tamil and Sinhala benchmark audio was prepared, but valid Tamil/Sinhala transcriptions were not produced in the recorded run because of a missing FFmpeg dependency; finetuning datasets for Tamil (IISc-MILE SLR127) and Sinhala (SLR52) were documented for future work [11], [12].

Listing 3.1 — Unified ASR dispatch (`ai-services/asr/asr_service.py`, excerpt)

SUPPORTED_LANGUAGES = ["en", "ta", "si"]

WHISPER_MODELS = ["tiny", "base", "small", "medium"]

def transcribe(audio_path, language="en", engine_name="whisper",

model_size=None, preprocess=True) -> dict:

# Returns { text, confidence, latency_ms, engine [, error] }

language = language.lower()[:2] if language else "en"

if language not in SUPPORTED_LANGUAGES:

language = "en"

processed_path = audio_path

if preprocess:

processed_path = normalize_audio(

audio_path, sample_rate=16000, channels=1, trim_silence=True)

if engine_name.lower() == "google":

from engines.google_engine import transcribe as google_transcribe

out = google_transcribe(processed_path, language)

elif engine_name.lower() in ("whisper-finetuned", "whisper_ft"):

from engines.whisper_finetuned_engine import transcribe as whisper_ft_transcribe

out = whisper_ft_transcribe(processed_path, language)

else:

from engines.whisper_engine import transcribe as whisper_transcribe

model = model_size or "base"

if model not in WHISPER_MODELS:

model = "base"

out = whisper_transcribe(processed_path, language, model)

out["engine"] = engine_name.lower()

return out  # latency_ms set inside each engine via time.perf_counter()

Source file:[ai-services/asr/asr_service.py]

Listing 3.1 shows the single-entry point used by the benchmark harness and the production voice interface. Incoming audio is optionally normalized to 16 kHz mono with silence trimming before dispatch. The `engine_name` parameter selects the backend: Google Cloud Speech-to-Text, a fine-tuned Whisper checkpoint, or by default a standard Whisper model size (`tiny` through `medium`). Invalid language codes fall back to English; Tamil (`ta`) and Sinhala (`si`) are accepted at the API layer but required FFmpeg-backed decoding for reliable batch runs. Each engine module measures wall-clock latency with `time.perf_counter()` around the provider call (model load plus `transcribe` for Whisper; API round-trip for Google) and returns `latency_ms` in the same dictionary as the transcript, enabling paired WER-latency comparison in Chapter 4. Credentials for cloud engines are read from environment variables only and are not embedded in source code. Temporary preprocessed files are deleted in a `finally` block after each request.

#### 3.5.2 Rasa Chatbot

The chatbot defines 11 intents: `ask_timetable`, `ask_hall_availability`, `ask_lecturer_availability`, `book_appointment`, `cancel_appointment`, `ask_directions`, `ask_office_location`, `greeting`, `goodbye`, `fallback`, and `out_of_scope`. Six entity types represent course, lecturer, hall, day, time, and building. The NLU pipeline uses a whitespace tokenizer, regex and lexical-syntactic features, word and character count-vector features, and a DIET classifier trained for 100 epochs. Dialogue policies combine memorization, rules, unexpected-intent handling, and TED.

Custom actions connect predicted intent and entities to current platform data. For example, a timetable query is resolved for the authenticated user, while a direction query invokes map search and route computation. This avoids storing volatile timetable or availability facts directly in training responses.

Figure 7:Chatbot query sequence

Listing 3.2 — Timetable custom action (`ai-services/chatbot/actions/actions.py`, excerpt)

def _api_headers(user_id: str) -> Dict[str, str]:

return {

"Content-Type": "application/json",

"X-Chatbot-Api-Key": CHATBOT_API_KEY,   # os.environ; not in client code

"X-Chatbot-User-Id": user_id,

}

def _dispatch_timetable_query(dispatcher, tracker, requested_day=None):

user_id = _get_user_id(tracker)  # metadata.user_id or logged-in sender_id

if not user_id:

dispatcher.utter_message(

text="Please log in to the platform to view your timetable.")

return []

try:

r = requests.get(

f"{PLATFORM_API_URL}/timetable/my",

headers=_api_headers(user_id),

timeout=10,

)

r.raise_for_status()

data = r.json()

if not data.get("success") or not data.get("data"):

dispatcher.utter_message(

text="I couldn't fetch your timetable. "

"Please try the My Timetable page.")

return []

tt = data["data"]

lines = _timetable_lines_from_grid(tt.get("grid"), requested_day)

if not lines:

lines = _timetable_lines_from_weekly(tt.get("weekly", {}), requested_day)

if not lines:

qual = f" for {requested_day.title()}" if requested_day else ""

dispatcher.utter_message(text=f"You have no classes{qual}.")

return []

msg = "Here's your timetable:\n\n" + "\n".join(lines[:15])

dispatcher.utter_message(text=msg)

except requests.RequestException:

logger.exception("Timetable API error")

dispatcher.utter_message(

text="I couldn't reach the timetable service. "

"Please try the My Timetable page.")

return []

Source file : [ai-services/chatbot/actions/actions.py]

Listing 3.2 illustrates how Rasa custom actions call live backend APIs instead of static training responses. Authentication: `_get_user_id` reads the student identifier from message metadata (injected by the React chat widget when the user is logged in) or from `sender_id`, rejecting guest sessions. Each request sends `X-Chatbot-Api-Key` (server-side secret from environment) and `X-Chatbot-User-Id` so the Express API can authorize chatbot traffic separately from browser JWT cookies while still scoping data to the correct student. Error handling: unauthenticated users receive a login prompt; HTTP failures and empty payloads are caught with `requests.RequestException` and `success` checks, logged server-side, and surfaced as short user-facing fallback messages that direct the student to the equivalent web page rather than exposing stack traces. Data path: `GET /api/timetable/my` returns the same FET grid snapshot used by the My Timetable UI; lines are filtered by the resolved weekday slot (`today`, `tomorrow`, or `MONDAY`–`SUNDAY`). Indoor direction actions (`action_get_directions`, `action_guide_to_room`) reuse `_api_headers` and the same try/except pattern to call `POST /api/navigation/query` and `GET /api/map/indoor-route`.

#### 3.5.3 Translation Pipeline

he translation service exposes local MarianMT, mBART-50, and optional Google/Azure adapters. The benchmark uses the same corpus, metric functions, logging format, and repeated-run structure for each engine. Pivot translation is used where a direct model is unavailable, which may compound errors and latency. The system records candidate text, reference, BLEU, embedding similarity, latency, language pair, category, engine, and run number. In production use, the platform defaults to English; Tamil and Sinhala UI translation is available but was not relied upon as a completed feature because output quality was inconsistent, especially for Sinhala-to-Tamil.

Listing 3.3 — Translation engine dispatch and Marian pivot logic (`ai-services/translation/`, excerpt)

# translation_service.py — unified entry point

SUPPORTED_ENGINES = ["google", "azure", "marian", "mbart"]

def translate(text, src_lang="en", tgt_lang="ta", engine="google") -> dict:

src, tgt = src_lang.lower()[:2], tgt_lang.lower()[:2]

eng = engine.lower()

if src == tgt:

return {"translated_text": text, "latency_ms": 0, "engine": eng}

if eng == "marian":

from engines.transformer_engine import translate_marian

return translate_marian(text, src, tgt)

if eng == "mbart":

from engines.mbart_engine import translate_mbart

return translate_mbart(text, src, tgt)

# google / azure: cloud_translator (all six pairs, single API call)

...

# transformer_engine.py — MarianMT direct models vs English pivot

EN_SI_MODEL = "Helsinki-NLP/opus-mt-en-inc"

SI_EN_MODEL = "Helsinki-NLP/opus-mt-inc-en"

EN_TA_MODEL = "Helsinki-NLP/opus-mt-en-mul"   # prefix >>tam<<

TA_EN_MODEL = "Helsinki-NLP/opus-mt-mul-en"

def translate_marian(text, src_lang, tgt_lang) -> dict:

pair = (src_lang.lower()[:2], tgt_lang.lower()[:2])

if pair == ("en", "si"):

translated, lat = _translate_with_model(EN_SI_MODEL, text, ">>sin<< ")

elif pair == ("si", "en"):

translated, lat = _translate_with_model(SI_EN_MODEL, text, None)

elif pair == ("en", "ta"):

translated, lat = _translate_with_model(EN_TA_MODEL, text, ">>tam<< ")

elif pair == ("ta", "en"):

translated, lat = _translate_with_model(TA_EN_MODEL, text, ">>tam<< ")

elif pair == ("ta", "si"):

t1, lat1 = _translate_with_model(TA_EN_MODEL, text, None)

t2, lat2 = _translate_with_model(EN_SI_MODEL, t1, ">>sin<< ")

translated, lat = t2, lat1 + lat2

else:  # ("si", "ta") — pivot Si → En → Ta

t1, lat1 = _translate_with_model(SI_EN_MODEL, text, None)

t2, lat2 = _translate_with_model(EN_TA_MODEL, t1, None)

translated, lat = t2, lat1 + lat2

return {"translated_text": translated, "latency_ms": round(lat, 2), "engine": "marian"}

Source files: [translation_service.py]

Table 3:Translation Model Configuration by Language Direction



| Direction | Mode | Helsinki-NLP Model(s) |
| --- | --- | --- |
| English → Tamil | Direct | opus-mt-en-mul with >>tam<< prefix |
| Tamil → English | Direct | opus-mt-mul-en |
| English → Sinhala | Direct | opus-mt-en-inc with >>sin<< prefix |
| Sinhala → English | Direct | opus-mt-inc-en |
| Tamil → Sinhala | Pivot via English | opus-mt-mul-en → opus-mt-en-inc |
| Sinhala → Tamil | Pivot via English | opus-mt-inc-en → opus-mt-en-mul |



Listing 3.3 shows how the translation microservice selects an engine at runtime. The `translate()` facade normalizes language codes, short-circuits identical source/target, and delegates to Marian, mBART, Google, or Azure adapters. MarianMT (used in the RO-3 benchmark) loads pair-specific Helsinki-NLP models lazily and caches pipelines in memory. Four directions have dedicated one-hop models; Tamil↔Sinhala has no direct Marian checkpoint in this deployment, so the service chains two English-centric hops and sums latency across both passes—an important confound when interpreting Sinhala→Tamil quality and delay in Chapter 4. mBART-50 follows the same direct/pivot split. Google/Azure adapters call the cloud API once per request for all six pairs (no application-level pivot). API keys are read from environment variables only. Errors return an empty `translated_text`, zero or partial `latency_ms`, and an `error` string without crashing the benchmark loop.

#### 3.5.4 Indoor Navigation

Administrators upload floor plans and review AI-assisted room/corridor detections. Approved nodes and edges are stored in PostgreSQL. At runtime, A* is the primary route algorithm and Dijkstra is the fall back. Cross-floor routes use stairs or lift nodes, and building connectors support multi-building routes. A QR code maps the user to a known node; the platform then returns route geometry, distance, estimated time, and step-by-step guidance. Natural-language requests such as “Take me to the cafeteria” are resolved through entity search and route computation.

Figure 8:Indoor navigation pipeline

Listing 3.4 — A* pathfinding core loop (`server/src/modules/indoor-navigation/pathfinding/astar.ts`, excerpt)

export function astar(

nodes: PathfindingNode[],

edges: PathfindingEdge[],

startId: string,

goalId: string

): string[] | null {

const byId = new Map(nodes.map((n) => [n.id, n]));

if (!byId.has(startId) || !byId.has(goalId)) return null;

const adj = buildAdjacency(nodes, edges);

const goal = byId.get(goalId)!;

const open = new Set<string>([startId]);

const cameFrom = new Map<string, string | null>();

const gScore = new Map<string, number>([[startId, 0]]);

const fScore = new Map<string, number>();

const start = byId.get(startId)!;

fScore.set(startId, euclidean(start.x, start.y, goal.x, goal.y));

while (open.size > 0) {

let current: string | null = null;

let bestF = Infinity;

for (const id of open) {

const f = fScore.get(id) ?? Infinity;

if (f < bestF) { bestF = f; current = id; }

}

if (!current) break;

if (current === goalId) return reconstructPath(cameFrom, goalId);

open.delete(current);

const gCur = gScore.get(current) ?? Infinity;

for (const neighbor of adj.get(current) || []) {

const tentative = gCur + neighbor.weight;

if (tentative >= (gScore.get(neighbor.nodeId) ?? Infinity)) continue;

cameFrom.set(neighbor.nodeId, current);

gScore.set(neighbor.nodeId, tentative);

const nb = byId.get(neighbor.nodeId)!;

fScore.set(

neighbor.nodeId,

tentative + euclidean(nb.x, nb.y, goal.x, goal.y)

);

open.add(neighbor.nodeId);

}

}

return null;

}

Sourcefile:[server/src/modules/indoornavigation/pathfinding/astar.ts]

Nodes carry floor-plan coordinates (`x`, `y` as percentages). `buildAdjacency` assigns each edge a non-negative weight-either an administrator-set value or Euclidean distance plus optional floor-transition and vertical-connector penalties. The algorithm maintains `gScore` (best known cost from the start) and `fScore(n) = gScore(n) + h(n)`, where h(n) is the straight-line Euclidean distance from node n to the goal in the same coordinate space.

Complexity: For a graph with V nodes and E edges, each iteration scans the open set linearly (`O(V)`), and each edge relaxation is `O(1)`, giving O(V² + E) in the worst case for this implementation. LECSTU building graphs are sparse and typically contain tens to low hundreds of nodes per floor, so runtime is negligible on the server. A priority-queue variant would improve to O(E log V) but was not required at this scale.

Heuristic admissibility.h is admissible (never overestimates shortest-path cost) when every edge weight is at least the geometric distance between its endpoints on the floor plan-which holds for default LECSTU weights because corridors cannot be shorter than a straight line in the plane. Additional penalties for floor changes or separate stair wells only increase true path cost, so they do not violate admissibility; they may make h loose on multi-floor routes but still optimistic. If A fails to reach the goal (disconnected subgraph or numeric edge cases), `findShortestPath` falls back to Dijkstra[9], which guarantees a shortest path when one exists.

### 3.6 Dataset Preparation

#### 3.6.1 ASR Dataset

The ASR benchmark corpus contains 150 scripted academic prompts(50 per language) with paired reference transcriptions in `research/datasets/asr/dataset_manifest.json`. Audio was generated for pipeline testing using Google Text-to-Speech (gTTS) via `scripts/create_tts_audio.py`, converted to 16 kHz mono PCM WAV. This is not a multi-speaker human-recorded corpus; demographic metadata was therefore not collected. Chapter 4 reports English-only valid benchmark results (50 utterances); Tamil and Sinhala runs failed in the recorded experiment because of a missing FFmpeg dependency during batch transcription.

Table 4:ASR benchmark dataset distribution



| Language | Speaker ID | Gender / Age Band | Category | n | Recording Condition | Total Duration (s) | Mean Duration (s) | Duration Range (s) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| English | S01 | N/A, synthetic TTS | Timetable | 10 | Clean; gTTS → 16 kHz mono WAV | 29.4 | 2.94 | 2.47–3.29 |
| English | S01 | N/A | Halls | 10 | Clean; gTTS | 29.1 | 2.91 | 2.40–3.53 |
| English | S01 | N/A | Appointments | 10 | Clean; gTTS | 31.2 | 3.12 | 2.59–3.67 |
| English | S01 | N/A | Directions | 10 | Clean; gTTS | 26.2 | 2.62 | 2.09–3.12 |
| English | S01 | N/A | General | 10 | Clean; gTTS | 26.4 | 2.64 | 1.87–3.53 |
| English subtotal | 1 speaker | - | All categories | 50 | - | 142.2 | 2.84 | 1.87–3.67 |
| Tamil | S01 | N/A, synthetic TTS | Timetable | 10 | Clean; gTTS | 32.8 | 3.28 | 2.95–3.94 |
| Tamil | S01 | N/A | Halls | 10 | Clean; gTTS | 36.1 | 3.61 | 3.05–4.01 |
| Tamil | S01 | N/A | Appointments | 10 | Clean; gTTS | 37.0 | 3.70 | 2.88–4.73 |
| Tamil | S01 | N/A | Directions | 10 | Clean; gTTS | 28.4 | 2.84 | 1.80–4.20 |
| Tamil | S01 | N/A | General | 10 | Clean; gTTS | 29.9 | 2.99 | 2.18–3.86 |
| Tamil subtotal | 1 speaker | - | All categories | 50 | - | 164.3 | 3.29 | 1.80–4.73 |
| Sinhala | S01 | N/A, synthetic TTS | Timetable | 10 | Clean; gTTS | 34.2 | 3.42 | 2.93–4.06 |
| Sinhala | S01 | N/A | Halls | 10 | Clean; gTTS | 32.4 | 3.24 | 2.28–3.94 |
| Sinhala | S01 | N/A | Appointments | 10 | Clean; gTTS | 38.6 | 3.86 | 2.98–5.26 |
| Sinhala | S01 | N/A | Directions | 10 | Clean; gTTS | 29.8 | 2.98 | 2.23–3.94 |
| Sinhala | S01 | N/A | General | 10 | Clean; gTTS | 30.8 | 3.08 | 1.94–4.68 |
| Sinhala subtotal | 1 speaker | - | All categories | 50 | - | 165.8 | 3.32 | 1.94–5.26 |
| Corpus total | S01 only | Not collected | 5 categories × 3 languages | 150 | Clean synthetic only | 472.4 | 3.15 | 1.80–5.26 |



Scope statement (thesis claim boundary). Table 4 supports pipeline and engine-comparison methodology for domain-specific academic phrases. It does not support claims about speaker diversity, campus noise, accent variation, or real microphone recordings. The target design in `METHODOLOGY.md` called for 3-5 consented speakers per language and clean/moderate conditions; that target was not met in the submitted artifact. RO-1 / H1 conclusions in this thesis are therefore limited to the English TTS subset reported in Chapter 4. Future work should replace gTTS audio with ethics-approved human recordings (and add moderate-noise replicates) before extending claims to Tamil, Sinhala, or production voice quality.

#### 3.6.2 NLU Dataset

NLU training data live in `ai-services/chatbot/data/nlu.yml` (production) with a separate held-out file `research/datasets/nlp/test_data.yml`. Five-fold cross-validation in Chapter 4 used the 11 core academic intents(416 examples at evaluation time; the training file has since grown to 508 utterances across 16 intents). Entity spans cover six types defined in `domain.yml`.

Table 5:NLU example counts by intent



| Intent | Training Examples in nlu.yml | 11-Intent CV Subset | CV Support at Evaluation Time† | Held-Out Examples in test_data.yml |
| --- | --- | --- | --- | --- |
| ask_timetable | 50 | 50 | 41 | 7 |
| ask_hall_availability | 34 | 34 | 34 | 7 |
| ask_lecturer_availability | 48 | 48 | 45 | 7 |
| book_appointment | 42 | 42 | 42 | 6 |
| cancel_appointment | 34 | 34 | 34 | 7 |
| ask_directions | 37 | 37 | 36 | 7 |
| ask_office_location | 37 | 37 | 36 | 7 |
| greeting | 35 | 35 | 35 | 7 |
| goodbye | 38 | 38 | 38 | 7 |
| fallback | 38 | 38 | 37 | 8 |
| out_of_scope | 38 | 38 | 38 | 8 |
| Subtotal: H2 / CV Intents | 431 | 431 | 416 | 78 |
| ask_todays_classes | 20 | - | - | - |
| guide_to_lecture_room | 25 | - | - | - |
| guide_to_next_class | 18 | - | - | - |
| affirm | 9 | - | - | - |
| deny | 5 | - | - | - |
| Grand Total | 508 | - | - | 78 |



Table 6:Entity annotation counts



| Entity Type | Training Annotations in nlu.yml | Training Utterances Containing ≥1 Span | Held-Out Annotations in test_data.yml | Entity Instances in 5-Fold CV‡ |
| --- | --- | --- | --- | --- |
| lecturer_name | 147 | 146 | 25 | 290 |
| day | 90 | 90 | 12 | 89 |
| building | 40 | 39 | 7 | 66 |
| hall_name | 39 | 39 | 4 | 37 |
| time | 28 | 28 | 6 | 28 |
| course_name | 12 | 12 | 3 | 18 |
| Total Spans | 356 | - | 57 | 528 |



Table 7:Duplicate and Paraphrase Leakage Checks for NLU Data



| Check | Procedure | Result |
| --- | --- | --- |
| Within-training exact duplicates | Case-insensitive count of identical full utterance strings in nlu.yml | 3 duplicated phrases were identified; these were removed or treated as negligible |
| Train–held-out exact overlap | Normalised lowercase string matching between nlu.yml and test_data.yml | 75 out of 78 held-out examples already appeared verbatim in the training data |
| Train–held-out template overlap | Entity values were replaced with placeholders, for example [Dr. Dias](lecturer_name) → (lecturer_name) | 77 out of 78 held-out patterns overlapped with training templates |
| Held-out-only utterances | Lines in test_data.yml that were absent from the training file | Only 3 held-out examples were unique, including two ask_lecturer_availability examples and one cancel_appointment example |
| Near-paraphrase review | Manual review of similar timetable-related wording, such as tomorrow, tomorrows, and friday variants | High lexical overlap was observed by design; no embedding-based deduplication was performed |



Interpretation:Cross-validation on the 416-example snapshot is the conservative generalization estimate reported for H2. The held-out file is not an independent test set in the strict sense: almost every line was also used for training, which largely explains the 100% intent accuracy on held-out evaluation in Chapter 4. Future work should rebuild `test_data.yml` with entirely new phrasings (and disjoint speakers/contexts if voice data are added) before treating held-out metrics as unbiased. An archived research split `research/datasets/nlp/training_data.yml` (316 examples) remains in the repository but is superseded by the current `data/nlu.yml` for deployment and evaluation.

#### 3.6.3 Translation Corpus

The parallel corpus comprises 100 aligned trilingual sentence sets (English, Tamil, Sinhala) stored in `research/datasets/translation/corpus_manifest.json`. The manifest lists 300 directed reference pairs (`en→ta`, `en→si`, `ta→si`). The Phase 9.3 benchmark expands each set to six directions** (including reverse pairs) at runtime via `build_sentence_lookup()` in `run_benchmark.py`, yielding 600 translation tasks per run** (×3 repetitions = 1,800 rows per engine in Chapter 4).

Table 8:Unique sentences by category



| Category | Sentences | Corpus Source | Review Status |
| --- | --- | --- | --- |
| Timetable | 20 | ASR-aligned sentences 001–050 and platform extension | 10 asr_aligned; 10 primary_draft |
| General | 30 | ASR halls category remapped and platform extension | 15 asr_aligned; 15 primary_draft |
| Appointment | 20 | ASR-aligned sentences and platform extension | 10 asr_aligned; 10 primary_draft |
| Navigation | 20 | ASR directions category remapped and platform extension | 10 asr_aligned; 10 primary_draft |
| Notification | 10 | Platform extension only, sentences 051–060 | 10 primary_draft |
| Total | 100 | 50 asr_corpus + 50 platform_extension | 50 asr_aligned; 50 primary_draft |



Table 9:Reference pairs by language direction



| Direction | Pairs in Manifest | Benchmark Tasks per Run | Categories |
| --- | --- | --- | --- |
| English → Tamil (en-ta) | 100 | 100 | 20 timetable, 30 general, 20 appointment, 20 navigation, 10 notification |
| Tamil → English (ta-en) | - | 100 | Same category mix; reference = English line from trilingual set |
| English → Sinhala (en-si) | 100 | 100 | Same category mix |
| Sinhala → English (si-en) | - | 100 | Same category mix; reference = English line from trilingual set |
| Tamil → Sinhala (ta-si) | 100 | 100 | Same category mix |
| Sinhala → Tamil (si-ta) | - | 100 | Same category mix |
| Total | 300 stored | 600 per run | 100 sentences × 6 directions |



Table 10:Sentence-length statistics



| Text | Unit | Mean | SD | Min | Max |
| --- | --- | --- | --- | --- | --- |
| English source | Words | 8.3 | 3.0 | 4 | 21 |
| Tamil reference | Characters | 52.8 | 22.0 | 16 | 120 |
| Sinhala reference | Characters | 42.3 | 17.5 | 15 | 100 |



Table 11:Authorship and verification of reference translations



| Sentence IDs | Source File | Reference Text Authorship | Verification Status | Status in review_log.json |
| --- | --- | --- | --- | --- |
| 001–050 | research/datasets/asr/utterances.yaml | Project investigator authored the English prompts and curated the paired Tamil/Sinhala lines for Phase 7.2 ASR and translation alignment | Recorded as asr_corpus alignment. The same trilingual file was used as ground truth for RO-1 and RO-3; no separate named secondary reviewer was logged | asr_aligned |
| 051–100 | research/datasets/translation/extra_sentences.yaml | Project investigator prepared the primary trilingual drafts for platform notifications, UI phrases, and extended academic sentences | Pending independent verification. review_log.json lists status: pending_native_review; independent native Tamil/Sinhala verification has not yet been signed off | primary_draft |



### 3.7 Evaluation Procedures and Metrics

#### 3.7.1 ASR Evaluation

Each audio item is transcribed by each configured engine. WER, CER, end-to-end latency, failure status, and configuration metadata are logged. Mean, median, standard deviation, confidence intervals, and paired significance tests are calculated where complete paired outputs exist. Effect size is reported using Cohen’s \(d\) when assumptions are appropriate.

#### 3.7.2 NLU Evaluation

Five-fold cross-validation evaluates generalization across splits. Precision, recall, F1, and accuracy are calculated for intent classification and entity extraction. Confusion matrices and error lists support qualitative diagnosis. The acceptance criterion for H2 is weighted intent F1 ≥ 0.85.

#### 3.7.3 Translation Evaluation

Each of 100 sentence sets is translated in six directions for three repetitions, producing 1,800 rows per engine. Quality is assessed using BLEU and cosine similarity between multilingual sentence embeddings. Latency and failures measure operational performance. Five blind human raters scored adequacy and fluency; inter-rater reliability was reported using Krippendorff’s alpha.

#### 3.7.4 Usability Evaluation

The planned study tests H4: AI-integrated features reduce mean task completion time by at least 25% compared with manual navigation, for paired tasks where both conditions apply. Design is within-subjects: each participant completes the same academic tasks under manual (menu/page navigation only) and AI-assisted (chatbot and/or voice) conditions on the production deployment at https://lecstu.com. Configuration is pinned in `research/research-config.yaml` (`usability` section): minimum 20 participants, 45-minute sessions, counterbalancing enabled, SUS + AI-trust + post-task satisfaction scales.Study status.

Student questionnaire data were collected in July 2026 (20 Google Form responses on https://lecstu.com; export: `form-responses-students-2026-07-10.csv`). Demographics and questionnaire results are reported in Section 4.7.

Table 12:Ethics approval and governance



| Item | Detail |
| --- | --- |
| Institution | Faculty of Computing and Technology, University of Kelaniya |
| Ethics Procedure | University research-ethics review is required before the first data collection session. The ethics application will be submitted according to faculty graduate-research guidelines |
| Approval Reference | Pending — official approval number and approval date will be inserted after ethics board sign-off |
| Ethics Plan | research/usability-study/instruments/ethics_plan.md |
| Researcher Contact | P. Shakiththiyan, candidate |
| Supervisor Contact | Mr. Kesavan Selvarajah |
| Data Retention | Anonymized research data will be retained for the thesis duration plus one year, followed by secure deletion. Voice data and questionnaire personally identifiable information will not be retained indefinitely |
| Risks | Low risk. Participants complete voluntary academic tasks using a test account and may withdraw from the study without penalty |



Recruitment



| Aspect | Protocol |
| --- | --- |
| Method | Convenience sampling through faculty notice, lecturer referral, and direct invitation to students and staff who already use university IT services |
| Population | University of Kelaniya students, lecturers, and administrative staff who regularly need access to timetables, hall availability, appointment booking, or campus navigation |
| Target Sample Size | At least 20 completed sessions, approximately stratified as 10 students, 7 lecturers, and 3 administrative staff. The distribution may be adjusted while maintaining the minimum sample size |
| Compensation | No compensation will be provided. Participation is voluntary as an academic research contribution |
| Setting | Quiet laboratory or office environment with stable Wi-Fi. Participants will use either their own laptop or a provided device with Chrome or Edge browser |
| Account Setup | Pre-provisioned test role accounts will be used for student, lecturer, and admin roles. These accounts will include realistic timetable and appointment data, but no real student personally identifiable information will be included in shared logs |
| Pilot Testing | Two to three pilot sessions will be conducted to refine task wording, timing, and form clarity. Pilot participant IDs will be excluded from the primary H4 usability analysis |



Participant information sheet and informed consent

Before any timed task, each participant receives a Participant Information Sheet covering: study title and purpose (RO-4 / RQ-4); what participation involves (~45 min, manual + AI tasks, post-session questionnaire); data collected (coded ID, task times, ratings, optional comments); anonymization (P01, L01, …); storage on encrypted local media; right to withdraw; researcher and supervisor contacts.

Signed informed consent is obtained on paper before the session begins. The consent form includes the statements listed in `ethics_plan.md` 4 and 8 (voluntary participation, withdrawal without penalty, anonymized use for research only). Signed originals are stored in `research/usability-study/instruments/` (e.g. `consent_form_signed/`, not in Git). At questionnaire time, participants also tick a required consent checkbox (Form A3 / B3) in the Google Form as a secondary record.

Target demographic summary (recruitment plan)

Demographic fields are collected in Section 1 of the Google Form ([usabilityTestingContent.md](research/usability-study/usabilityTestingContent.md)).Table 3.4 lists planned strata for reporting in Chapter 4 after data collection -values are targets, not observed counts.

Table 13:Planned participant demographic fields and recruitment strata



| Field | Instrument | Planned Reporting |
| --- | --- | --- |
| Participant ID | Short answer using coded IDs, such as P01–Pnn, L01–Lnn, or A01–Ann | Reported by role group: students, lecturers, and administrative staff |
| Age range | Multiple choice: 18–21, 22–25, 26–30, 31+ | Frequency table |
| Programme or department | Multiple choice: CS, ET, CT, BS, Other | Used to describe participant spread across academic areas |
| Study year or designation | Students: Year 1–Year 4; Lecturers: Lecturer, Senior Lecturer, Head of Department; Admin: administrative role/category | Reported according to participant role |
| Technology familiarity | Likert scale from 1 to 5 | Mean ± standard deviation |
| Primary language | Multiple choice: English, Sinhala, Tamil, Mixed | Used to describe participant language background |
| Prior LECSTU use | Multiple choice: None, a few times, regular use | Treated as an experience-related covariate |



Exact tasks

Tasks are performed on https://lecstu.com using the participant’s assigned role account. Facilitator reads the scripted instruction; participant may ask one clarification question per task but not receive navigation hints.

Table 14:Student tasks (Form A / facilitator script)



| Task | Manual Condition: Start → End | AI Condition: Start → End | Paired for H4? |
| --- | --- | --- | --- |
| T1 — Next lecture | Open My Timetable → identify the next lecture scheduled for today | Ask chatbot: “What is my next lecture?” → correct lecture slot is shown | Yes |
| T2 — Free hall now | Open Hall Explorer → find any hall available at the current time | Ask by voice or chatbot: “Which hall is free now?” → available hall is returned | Yes |
| T3 — Book appointment | Open lecturer profile → use booking interface → submit appointment request | Use chatbot-assisted booking to request an appointment with the same lecturer | Yes |
| T4 — Indoor navigation | Open Find My Way → generate route to the next classroom | Use chatbot and guided indoor route to navigate to the same room | Yes |
| T4b — Outdoor map | Open campus map → locate the CS building manually | Ask by voice or chatbot for directions to the CS building | Yes |
| T5 — Sinhala/Tamil voice | Not applicable | Ask a question in Sinhala or Tamil using voice input | No; AI-only satisfaction metric |
| T6 — Language switch | Not applicable | Switch the UI language and view the timetable | No; AI-only satisfaction metric |



Table 15:Lecturer tasks (Form B / facilitator script)



| Task | Instruction Summary | Manual / AI Condition |
| --- | --- | --- |
| L1 — Teaching schedule | Confirm today’s teaching slots using My Timetable | Paired |
| L2 — Hall / room information | Check hall or room information related to teaching | Paired |
| L3 — Appointment request | View or respond to a student appointment request | Manual workflow; chatbot support optional in AI condition |
| L4 — Profile / availability update | Update profile details, office location, or busy time slot | Manual |
| L5 — Navigation | Use map or Find My Way to locate a teaching venue or office | Paired |
| L6 — Schedule query | Ask chatbot or voice assistant: “What is my schedule on Friday?” | AI-focused |
| L7 — Translation / multilingual UI | Test translation or Sinhala–Tamil interface, if applicable | AI only |



Counterbalancing

To reduce learning and fatigue effects (`research-config.yaml`: `counterbalance: true`):

1. Condition order (paired tasks T1–T4b / L1–L2 / L5):** Participants are assigned to Group A or Group B by sequential ID at recruitment.

- Group A: Manual block first, then AI block (tasks in fixed order T1 → T2 → T3 →   T4 → T4b).

- Group B:** AI block first, then Manual block (same task order within each block).

2. Role mix: Student and lecturer sessions use separate forms but the same A/B rule.

3. AI-only tasks (T5, T6):Administered after both blocks, in fixed order, so they do not bias paired timings.

4. Target balance: Approximately equal N in Groups A and B (±1).

Task timing: start, end, success, and error definitions

Timing is recorded by the facilitator on an observer sheet (automated frontend task timers are planned in Phase 10.1 but were not required for the preregistered protocol). All times in  seconds, one row per (participant, task, condition).

Table 16:Task Timing, Success, Failure, and Error Recording Definitions



| Event | Operational Definition |
| --- | --- |
| Start | The facilitator says “Begin” immediately after reading the task instruction. Timing starts when the participant first interacts with LECSTU for that task, such as clicking, tapping, typing, or pressing the microphone button |
| End: Success | The primary task outcome is verified correctly without facilitator hints. Examples include identifying the correct lecture slot, finding the correct available hall, receiving appointment submission confirmation, displaying the indoor route to the target room, or highlighting the correct building |
| End: Failure | The task is marked as failed if the participant abandons the task, asks the facilitator for the answer, exceeds the 180-second timeout, or completes the task with an incorrect outcome |
| Success Flag | Recorded as Y if the participant meets the success criterion correctly; recorded as N otherwise |
| Error Count | The facilitator records the number of recoverable mistakes made before success or failure, such as opening the wrong page, mis-clicking, needing to re-prompt the chatbot, or using unnecessary back-navigation |



Observer columns: `participant_id`, `task`, `condition` (Manual/AI), `time_seconds`, `success` (Y/N), `errors`, `notes`, `session_date`.

Questionnaires and scales

Table 17:Post-Task Questionnaire Structure and Measurement Purpose



| Section | Content | Purpose |
| --- | --- | --- |
| 1 | Participant ID, session date, consent, and demographic details | Recruitment accounting and participant background description |
| 2 | Per-task ease rating from 1-5, satisfaction rating from 1-5, and method used | Task-level user experience evaluation |
| 3 | System Usability Scale (SUS) - 10 standard items rated from 1-5; scored from 0–100 using the formula: odd items = score - 1, even items = 5 - score, total × 2.5 | Overall system usability measurement |
| 4 | AI Trust Scale - five items, with optional AI6 for lecturers | Measures user trust in voice recognition, chatbot responses, and translation features |
| 5 | Feature-specific ratings: F1-F10 for students and LF1-LF10 for lecturers | Component-level quality assessment |
| 6 | Open-ended comments and recommendation question | Qualitative feedback and user recommendation tendency |



Post-task instruments are Google Forms(email collection off); exports linked to a private Sheet then CSV in `raw-data/`. Two forms:Student andLecturer-full item text in [usabilityTestingContent.md](research/usability-study/usabilityTestingContent.md).

Accessibility-related items include AI5 (“AI features made the platform more accessible for me”) and task ease ratings; these complement the WCAG 2.2 audit (Section 3.7.5) but do not replace it.

Anonymized raw data and analysis

Table 18:Usability Study Data Storage and Version Control Plan



| Artifact | Location Relative to Repository Root | Git Status |
| --- | --- | --- |
| Google Form CSV exports | research/usability-study/raw-data/form-responses-*.csv | Ignored |
| Observer task times | research/usability-study/raw-data/task-times-*.csv | Ignored |
| Signed consent forms, paper-based | research/usability-study/instruments/ | Ignored |
| Master name–ID list | Private encrypted folder outside the repository | Never committed |
| Analysis output report | research/reports/usability_study_report.md | Committed after study |



Analysis procedure:

1. Load observer times and form CSVs; merge on `participant_id`.

2. Descriptive: mean, median, SD of completion time per task × condition; success rates; mean SUS (benchmark 68 = above average); AI-trust item means.

3.H4 test: For paired tasks T1T4b, compute per-participant mean time reduction \((t_\text{manual} - t_\text{AI}) / t_\text{manual}\). Accept H4 if mean reduction ≥25% with supporting inference: paired t-test when normality holds (ShapiroWilk on differences), else Wilcoxon signed-rank; report 95% CI and Cohen’s  d.

4. Secondary: role comparison (one-way ANOVA or Kruskal-Wallis on task times); Spearman correlation between AI trust and success; thematic c-oding of open responses (frequency + anonymized quotes).

Exclusion criteria

Table 19:Usability Study Exclusion and Data Handling Criteria



| Criterion | Action |
| --- | --- |
| Declined consent or withdrew mid-session | Destroy partial data and replace the recruitment slot |
| Participant aged below 18 without guardian approval | Do not recruit the participant |
| LECSTU core development team member | Exclude from the study due to conflict of interest |
| Unable to complete at least 4 of 6 paired student tasks, or at least 3 of 5 paired lecturer tasks, due to participant-related factors | Exclude from H4 primary analysis |
| Session aborted due to platform outage or account misconfiguration | Reschedule the session; exclude the session if less than 50% of tasks were completed |
| Pilot participants, first 2-3 IDs | Report separately and exclude from the confirmatory H4 test |
| Observer timing sheet incomplete or missing condition label | Exclude affected task rows; exclude the participant if more than two tasks are affected |



Paired t-test / Wilcoxon assumptions are checked on per-participant time differences; violations are reported with the non-parametric alternative.

#### 3.7.5 Accessibility Evaluation (WCAG 2.2)

Accessibility was assessed separately from the planned usability study using a targeted WCAG 2.2 audit on ten student-facing flows: login, registration, dashboard, timetable, hall availability, lecturer directory, appointments, campus map, indoor navigation, and chatbot/voice input. Methods included: (1) review of React components for labels, ARIA, and keyboard support; (2) manual keyboard-only traversal of authentication and navigation; (3) inspection of the production site at https://lecstu.com; and (4) mapping findings to selected Level A and Level AA success criteria [10]. Automated tools (axe DevTools or Lighthouse Accessibility) are recommended for supplementary evidence and screenshot archival.

Results are reported qualitatively as Pass, Partial, or Fail per criterion (Table 2.2 and Section 4.6.1). The audit supports design discussion and RO-4 accessibility planning but does not certify legal compliance. Detailed findings and remediation items are documented in [research/usability-study/WCAG_2_2_AUDIT.md](research/usability-study/WCAG_2_2_AUDIT.md).

### 3.8 Software Verification

Software verification combines production builds, dataset manifest validators, API security tests, and Playwright end-to-end (E2E) specifications. A consolidated run was executed on 9 July 2026 against a local production-like stack: PostgreSQL with seeded faculty data, Express API on port 5000, Vite dev client on port 5173 (Playwright `baseURL`), and successful `tsc` / `vite build` compilation beforehand. Code coverage was not measured in this repository.

Table 20:Final verification run summary (9 July 2026)



| Layer | Tool / Script | Version | Tests | Passed | Failed | Duration | Report |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Client and server build | tsc, Vite | TypeScript 5.9.3, Vite 7.3.1 | 2 builds | 2 | 0 | ~51 s | Build logs, local |
| ASR corpus manifest | validate_manifest.py | Python 3.13 | 1 validator | 1 | 0 | <1 s | stdout: 150 utterances OK |
| Translation corpus manifest | validate_manifest.py | Python 3.13 | 1 validator | 1 | 0 | <1 s | stdout: 300 pairs OK |
| Authentication / reset API | run-phase-12-6-tests.ts | Node.js 22.17.1, Prisma 7.4.0 | 10 | 10 | 0 | ~27 s | research/reports/software_verification_run_2026-07-09/README.md |
| Browser end-to-end testing | Playwright | Playwright 1.60.0, Chrome headless | 26 | 4 | 22 | 1,167 s (~19.4 min) | research/reports/software_verification_run_2026-07-09/playwright-results.json |



Environment: Windows 10 (build 26200), x64; repository root `D:\Reasearch\lecstu`; `server/.env` PostgreSQL; test student `testaint@lecstu.edu`. Archived console log, per-test summary, screenshots, videos, and traces: [research/reports/software_verification_run_2026-07-09/](research/reports/software_verification_run_2026-07-09/).

Playwright specifications (4 files, 26 tests):

Table 21:Browser End-to-End Test Results by Test File



| File | Focus | Result on 9 July 2026 |
| --- | --- | --- |
| tests/student-timetable.spec.ts | Y3 CS-AINT personalized timetable and 12 course-code checks | 1 / 17 passed; only the login test passed |
| tests/enrollment-timetable-sync.spec.ts | Profile enrollment update and timetable refresh | 1 / 4 passed; profile field update passed |
| tests/floor-plan-alignment.spec.ts | Indoor map coordinate alignment | 0 / 2 passed; tests failed due to timeouts |
| tests/password-reset-flow.spec.ts | Forgot password, reset link, and login UI flow | 2 / 3 passed; reset link and generic copy checks passed, but the full reset flow failed |



Failure diagnosis (honest). Most timetable failures stem from assertion drift: specs wait for subtitle text `in selected period` and group label `CS-Y3-AINT`, while the current UI renders `Student schedule: N slots · Class: Y3 AINT · …`. Floor-plan tests timed out before reaching the indoor navigation view (likely missing seed/building preconditions). The password-reset API suite passed 10/10; the UI end-to-end step failed on post-reset login visibility. These results support the claim that executable regression tests exist, but they do not currently certify full workflow green status -specs should be updated to match production UI copy and Phase 11 navigation seeds before thesis submission.

Static analysis: Server `npm run lint` (ESLint) was not executed in this run because the CLI was not on PATH; TypeScript compilation (`npm run build`) succeeded for both client and server. Lint remains a recommended pre-submission step.

Reproduction:

npm run build:server && npm run build:client

npm run dev:server    # terminal 1

npm run dev:client    # terminal 2

npx playwright test --reporter=list --reporter=json

cd server && npm run test:phase-12-6

### 3.9 Ethics and Data Protection

Human-subjects work in this project covers (i) the planned usability study (RO-4), (ii) translation human evaluation (five blind raters, completed), and (iii) future ethics-approved ASR recordings(not yet collected-the submitted ASR benchmark used gTTS synthetic audio, not participant voice). All live participant collection requires prior faculty/university ethics clearance. Operational platform data (registered users at https://lecstu.com) is governed separately by institutional IT and account policies; this section addresses research data only.

University ethics procedure and approval status

Table 22:Ethics Review Governance and Approval Status



| Item | Detail |
| --- | --- |
| Governing Body | Faculty of Computing and Technology (FCT), University of Kelaniya, through the graduate research ethics review process aligned with faculty BSc (Hons) project requirements. If required by faculty procedure for human-participant research, the application will be escalated to the University Ethics Review Committee |
| Application Timing | The ethics application and participant information sheet will be submitted before the first usability session or any new human voice recording |
| Approval Reference | Pending at thesis draft date, July 2026 — official approval number, committee name, and approval date will be inserted after sign-off |
| Approval Document Storage | research/usability-study/instruments/ethics_approval/ — PDF scan stored locally and not committed to Git |
| Supporting Plan | research/usability-study/instruments/ethics_plan.md |



Student usability questionnaires (n = 20) were collected under the study protocol in July 2026; formal ethics approval reference remains pending (see Table 23).

Research contacts

Table 23:Researcher, Supervisor, and Ethics Contact Information



| Role | Name | Contact |
| --- | --- | --- |
| Researcher / Candidate | P. Shakiththiyan, CS/2020/063 | Department of Computer Science, Faculty of Computing and Technology, University of Kelaniya |
| Supervisor | Mr. Kesavan Selvarajah | Department of Computer Science, Faculty of Computing and Technology, University of Kelaniya |
| Ethics Queries | FCT graduate research / faculty ethics coordinator | Faculty of Computing and Technology, University of Kelaniya, Kelaniya campus |



Participant information sheets and consent forms list the same researcher and supervisor contacts. Insert faculty email addresses in the final printed forms when confirmed with the department.

Informed consent and signed-form storage

Participation is voluntary; participants receive a Participant Information Sheet and sign a paper informed consent form before any timed usability task (Section 3.7.4). Google Form checkbox A3/B3 provides a secondary electronic acknowledgment; email collection on forms is disabled.

Table 24:Consent, Participant Information, and Ethics Document Storage Plan



| Document | Storage Location | Version Control |
| --- | --- | --- |
| Blank consent template | research/usability-study/instruments/consent_form.pdf | Template may be committed |
| Signed original consent forms | research/usability-study/instruments/consent_form_signed/ | Never committed to Git |
| Participant information sheet | research/usability-study/instruments/participant_information_sheet.pdf | Template only may be committed |
| Master name–coded ID list, for example P01, L01, etc. | Encrypted folder outside the public repository | Never committed |
| Ethics approval letter | research/usability-study/instruments/ethics_approval/ | Never committed |



Participants may withdraw without penalty at any time. On withdrawal, coded questionnaire exports and observer timing rows for that participant are removed from the analysis set and scheduled for deletion within 30 days.

Data minimization, storage, and encryption

Table 25:Data Classification, Storage, and Protection Plan



| Data Class | Examples | PII Risk | Storage | Protection |
| --- | --- | --- | --- | --- |
| Usability timings and questionnaires | task-times-*.csv, Google Form exports | Low to moderate, because age band, programme, role, and responses may indirectly identify participants | research/usability-study/raw-data/ | Coded participant IDs only; folder excluded from Git; stored on a BitLocker-encrypted research laptop or in an AES-encrypted archive, such as 7-Zip, on supervisor-approved media |
| Translation human ratings | ratings_*.csv | Low, because only rater codes are used | research/datasets/translation/human-eval/ | Only anonymized scores are committed; no rater names are stored in CSV files |
| ASR benchmark audio, current dataset | gTTS WAV files under research/datasets/asr/audio/ | None, because the current speech samples are synthetic | Local repository and backups | No biometric or human-speaker data included |
| Future consented voice recordings | Human speaker WAV files, if collected | High, because human voice is biometric data | research/datasets/asr/audio/ and related manifest files | Speaker codes only; encrypted local storage; not pushed to public Git |
| Production platform accounts | Timetables, appointments, user accounts | Operational user data | PostgreSQL database on Oracle Cloud VM | TLS through HTTPS, bcrypt password hashing, JWT-based access control, and role-based authorization |



Access control: raw participant-linked files are limited to the researcher and supervisor. Aggregated, anonymized statistics may appear in the thesis and `research/reports/`.

Retention and deletion (final policy -supersedes proposal)

The research proposal (Section 6) stated that raw audio saved for baseline evaluation could be held “in perpetuity” unless needed for system improvement. That wording is rejected in this thesis. The final policy minimizes retention:

Table 26:Data Retention and Deletion Plan



| Data | Retention Period | Deletion Method |
| --- | --- | --- |
| Usability raw data, including task times, questionnaire exports, and consent scans | Thesis completion + 12 months | Secure file deletion where available, or cryptographic erase of the encrypted storage volume. Deletion confirmation will be logged in ethics_plan.md |
| Withdrawn participant data | 30 days after withdrawal request | Removed from analysis immediately and deleted using the same secure deletion procedure |
| Translation rater sheets, including any paper notes | Same retention period as usability data | Paper records will be shredded; digital files will be securely deleted |
| gTTS ASR benchmark audio | Retained as a non-PII research artifact for reproducibility | May remain in the repository because it contains synthetic speech only and no human voice |
| Future human ASR recordings | Maximum of thesis completion + 12 months, unless separate written consent allows extended use | Human WAV files and related manifest rows will be securely deleted. Anonymized derivative results, such as WER tables, may be retained |
| Production server logs and voice buffers | Not retained for research by default; ephemeral processing will be used where possible | Temporary server files will be cleared, and no indefinite production voice archive will be maintained |



Voice input on the live platform requires an explicit user action (microphone press) and visible recording state; audio sent to ASR is processed for transcription and not archived indefinitely for research unless a separate consented study is running.

Cloud and third-party processing disclosure

Participants and consent forms must be told when data leaves the university device:

Table 27:Third-Party Services and Data Processing Summary



| Service | Purpose | Data Sent | When Used | Participant Impact |
| --- | --- | --- | --- | --- |
| Oracle Cloud, production VM | Hosts the live LECSTU platform at https://lecstu.com | Operational account data, timetables, and appointments | Production deployment | Usability testing uses test accounts; Oracle Cloud is not used as a research questionnaire processor |
| Google Forms | Collects usability questionnaire responses | Coded participant ID, demographic ranges, Likert-scale responses, and open comments | Post-session survey | Email collection is disabled; Google’s privacy policy applies |
| Google Cloud Speech-to-Text | Provides ASR benchmark baseline | Audio bytes | Optional engine in RO-1 ASR experiments | Not used in usability sessions by default |
| Google Cloud Translate | Provides translation benchmark baseline | Text sentences | Optional engine in RO-3 translation experiments | Used only with benchmark corpus text |
| Local Whisper / MarianMT / Rasa | Provides the default AI processing stack for ASR, translation, and chatbot/NLU services | Audio or text processed on the server/VM | Primary deployment path | Processing is performed on researcher-controlled infrastructure |



Cloud API keys are optional and disabled when not configured; benchmark scripts document which runs used cloud engines. Usability sessions are designed to run against the local or faculty-controlled stack so participant questionnaire content is not sent to translation/ASR cloud APIs unless explicitly disclosed and approved.

Risk summary

Table 28:Research Data Privacy Risks and Mitigation Measures



| Risk | Mitigation |
| --- | --- |
| Voice biometric identification | Only synthetic ASR data has been used to date. Any future human audio collection will require ethics approval, coded speaker IDs, encrypted storage, and limited retention |
| Questionnaire re-identification | Only age bands, programme/department, role, and coded participant IDs are collected. Real names are not entered in Google Forms, and the master name–ID list is kept offline |
| Repository leak | Sensitive folders such as raw-data/, consent_form_signed/, and ethics_approval/ are excluded using .gitignore and manual repository checks |
| Third-party cloud exposure | Third-party services are disclosed in the participant information sheet. Cloud use is minimized during human sessions, and local processing engines are preferred where possible |



Correction note.The proposal’s perpetual raw-audio retention clause is superseded by the 12-month post-thesis deletion rule above. Long-term retention of research outputs is limited to anonymized aggregates(tables, figures, WER/F1/BLEU reports), not raw voice or identifiable participant files.

### 3.10 Validity and Reproducibility

Internal validity is strengthened through common datasets, paired engine comparisons, repeated translation runs, structured logs, and cross-validation. Construct validity is improved by combining quality and latency metrics and by supplementing automated translation scores with planned human judgments. External validity is currently limited by one-speaker ASR data, a single institutional domain, and incomplete user evaluation. Reproducibility is supported by versioned scripts, manifests, configuration files, raw JSON results, and generated reports in the repository.

### 3.11 Chapter Summary

The methodology links artifact construction to four empirical questions. The next chapter reports only the results currently supported by saved experimental or test evidence and clearly identifies missing evaluations.

## Chapter 4 - Results and Analysis

### 4.1 Introduction

This chapter reports ASR, NLU, translation, and software-verification findings. Results are separated from planned work to prevent incomplete experiments from being interpreted as final evidence.

### 4.2 ASR Results

The analyzed run contained 350 attempted transcriptions across seven configurations. Three hundred were valid and 50 failed. The valid outputs covered English; Tamil and Sinhala results were unavailable because a processing dependency failed. Table 4.1 summarizes WER.

Table 29:English ASR WER by Configuration



| Configuration | Mean WER | Median | SD | N |
| --- | --- | --- | --- | --- |
| Whisper medium | 0.0410 | 0.0000 | 0.0882 | 50 |
| Whisper small | 0.0612 | 0.0000 | 0.1353 | 50 |
| Whisper base | 0.0743 | 0.0000 | 0.1342 | 50 |
| Google default | 0.0806 | 0.0000 | 0.1421 | 50 |
| Whisper tiny | 0.1045 | 0.0000 | 0.1814 | 50 |
| Fine-tuned Whisper tiny | 0.1092 | 0.0000 | 0.1967 | 50 |



Whisper medium achieved the lowest mean English WER, but Table 4.2 shows a large latency cost.

Table 30:English ASR latency by configuration



| Configuration | Mean Latency (ms) | Median (ms) | SD (ms) | N |
| --- | --- | --- | --- | --- |
| Fine-tuned Whisper tiny | 717.88 | 402.75 | 2,107.37 | 50 |
| Whisper tiny | 899.31 | 756.90 | 748.25 | 50 |
| Whisper base | 1,436.78 | 1,400.30 | 147.41 | 50 |
| Google default | 3,331.13 | 2,960.30 | 1,258.60 | 50 |
| Whisper small | 4,264.72 | 4,188.30 | 324.31 | 50 |
| Whisper medium | 14,018.39 | 13,564.35 | 1,530.03 | 50 |



Note: WER = Word Error Rate; SD = Standard Deviation; N = Number of test samples. Lower WER indicates better ASR performance.

The comparison of Whisper medium vs. Google default for English ASR WER yielded a p-value of 0.0678 and Cohen’s d=-0.3345. Although the Whisper medium has a lower mean WER than the Google default, this result was not statistically significant at the 0.05 significance level. The negative effect size indicates that the direction of the difference favoured Whisper medium, with small-to-moderate practical effect. However, the reported 95% CI for the mean difference, (-0.0782, -0.0009), does not contain zero, which seems inconsistent with the reported p-value. Therefore, statistical implementation and test definition should be revisited prior to final reporting.

H1 status: partially supported for English only. Whisper medium achieved the lowest mean English WER (0.0410) but was not statistically significant versus Google at α = 0.05 (*p* = 0.0678). Tamil and Sinhala evaluation was not completed in the recorded run and is deferred to future research.

Figures 4.1-4.4 - English ASR benchmark (experiment ID `20260310_052801`)

Figure 9:fig-4-1-wer_by_config.png

Figure 10:fig-4-2-wer_boxplot.png

Figure 11:fig-4-3-latency_by_config.png

Figure 12:fig-4-4-wer_vs_latency.png

#### 4.2.1 Required ASR extension (future work - not reported in this thesis)

The recorded benchmark (experiment `20260310_052801`) is English-only and uses gTTS synthetic speech from a single logical speaker (S01), not ethics-approved human recordings. Tamil and Sinhala rows failed because FFmpeg was unavailable during batch preprocessing (`error` field populated; `wer`/`cer` null). Tables 4.1-4.2 and Figures 4.1-4.4 therefore cannot support RO-1 claims for Tamil or Sinhala, nor for multi-speaker generalization. The following protocol is prescribed for a follow-on study (post-thesis extension or revised submission) and aligns with `research/datasets/asr/METHODOLOGY.md`, `research/research-config.yaml` (`random_seeds: [42, 123, 456]`, `num_repetitions: 3`), and the finetuning pipeline under `research/asr-finetuning/`.

Step 1 - Install and verify FFmpeg. Install FFmpeg on the benchmark host and confirm `ffmpeg -version` resolves from the same shell used by `ai-services/asr/asr_service.py` and `research/asr-benchmark/scripts/run_benchmark.py`. Re-run `python -c "import shutil;

print(shutil.which('ffmpeg'))"` before any multilingual batch. Without FFmpeg, Tamil/Sinhala WAV normalization and silence trimming fail and all non-English metrics remain invalid.

Step 2 -Record consented multi-speaker LECSTU audio (English, Tamil, Sinhala). After university ethics approval (Section 3.9), recruit 3–5 consented speakers per language (target mix of gender and Sri Lankan regional accent). Each speaker records the 50 domain prompts in `research/datasets/asr/utterances.yaml` under clean and moderate noise conditions where feasible (≥10 utterances per category per language). Audio: 16 kHz mono PCM WAV; native double-checked transcriptions; manifest fields `speaker_id`, `noise_level`, `duration_sec` per `METHODOLOGY.md` 5. Replace gTTS files under `research/datasets/asr/audio/{en,ta,si}/` and regenerate `dataset_manifest.json` via `scripts/generate_manifest_template.py` + validation (`validate_manifest.py`).

Step 3 - Finetune Whisper using public low-resource corpora [11], [12]. Domain adaptation follows the documented LECSTU pipeline:

1. Download IISc-MILE Tamil ASR (OpenSLR SLR127)[11] and Large Sinhala ASR (OpenSLR SLR52) [12].
2. Convert to LECSTU manifest format (`research/datasets/asr/scripts/convert_public_to_manifest.py`).
3. Merge LECSTU academic utterances with public manifests (`prepare_finetuning_manifests.py` →`finetuning/train_manifest.json`,`val_manifest.json`).
4. Train with `research/asr-finetuning/train_whisper.py` (LoRA on `base` or `small`; separate Tamil and Sinhala checkpoints, plus optional English academic adapter).
5. Register finetuned checkpoints in `ai-services/asr/` and the benchmark engine list.

Subword-aware Tamil modeling per Madhavaraj[11] and crowd-sourced Sinhala coverage per Kjartansson [12] provide the pretraining/finetuning prior; LECSTU prompts provide domain adaptation for campus vocabulary (hall names, timetable phrases).

Step 4 — Execute all engines on identical audio (≥3 runs). For each utterance in the updated manifest, run every configured engine on the same WAV file:



| Engine Group | Configurations Evaluated |
| --- | --- |
| Whisper | tiny, base, small, medium |
| Fine-tuned Whisper | tiny or base per language after the fine-tuning step |
| Cloud baseline | Google Speech-to-Text using English, Tamil, and Sinhala language codes |



Use `research/asr-benchmark/scripts/run_benchmark.py` with seeds 42, 123, 456 (three full passes). Log `wer`, `cer`, `latency_ms`, `error`, `engine`, `model`, `language`, `utterance_id`, `speaker_id`, `noise_level` to `research/asr-benchmark/results/asr_benchmark_*.json`. Identical audio means the same `audio_path` for every engine and run; only engine parameters vary.

Step 5 - Report language-wise descriptive metrics. For each `(language, engine, model)` aggregate valid rows only:

Table 31:ASR Evaluation Metrics



| Metric | Definition |
| --- | --- |
| Word Error Rate (WER) | Measures transcription error at word level by comparing the ASR output with the ground-truth transcript |
| Character Error Rate (CER) | Measures transcription error at character level. This is especially useful for Tamil and Sinhala because of their script structure and agglutinative morphology |
| Latency | Measures ASR response time using the mean, median, and standard deviation of latency_ms |
| Failure Rate | Percentage of test rows where an error was recorded or where wer was null, indicating unsuccessful transcription |
| N Valid | Number of successful transcriptions included in the final metric calculation |



Table 32:ASR Evaluation Result Reporting Template by Language and Engine



| Language | Engine | Mean WER | Mean CER | Mean Latency (ms) | Failure % | N Valid | vs Baseline p | Cohen’s d | 95% CI |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| English | Whisper medium | 0.0410 | Report | 14,018.39 | Report | 50 | 0.0678 | -0.3345 | (-0.0782, -0.0009) |
| English | Google default | 0.0806 | Report | 3,331.13 | Report | 50 | — | — | — |
| Tamil | Whisper medium | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| Tamil | Fine-tuned Whisper, SLR127 + LECSTU | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| Sinhala | Whisper medium | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| Sinhala | Fine-tuned Whisper, SLR52 + LECSTU | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |



Report speaker-stratified and noise-stratified subsets when N permits. Compare finetuned vs off-the-shelf Whisper and vs Google per language.

Step 6 - Inferential statistics. Run `research/asr-benchmark/scripts/analyze_benchmark.py` on the new result JSON. For each language and primary engine pair (e.g. finetuned vs Whisper medium on the same utterances):

Paired comparison on per-utterance WER or CER differences: Wilcoxon signed-rank if normality fails; paired t-test if Shapiro–Wilk on differences is acceptable at α = 0.05.

- Effect size: Cohen’s *d* on paired differences.

- Uncertainty:95% confidence intervals for mean WER/CER/latency differences.

- Multi-run variance: report SD across the three seed runs.

Acceptance for extending H1 to Tamil/Sinhala requires valid FFmpeg-backed metrics on human audio-not gTTS and statistically supported improvement or documented accuracy-latency trade-offs per language. Until Table 4.2a is populated, H1 remains partially supported (English synthetic subset only).

### 4.3 NLU Results

Five-fold cross-validation produced intent accuracy of 0.906, weighted F1 of 0.904, and precision of 0.917. Entity extraction achieved accuracy of 0.979, F1 of 0.953, and precision of 0.972. The held-out 77-example set produced 100% intent and entity results; because this is unusually high, cross-validation is treated as the more conservative estimate.

Table 33:NLU cross-validation summary



| Task | Accuracy | Precision | F1-Score |
| --- | --- | --- | --- |
| Intent classification | 0.906 | 0.917 | 0.904 |
| Entity extraction | 0.979 | 0.972 | 0.953 |



The strongest intent was `ask_office_location` (F1 0.986), while `out_of_scope` was weakest (F1 0.812). `book_appointment` and `ask_lecturer_availability` were confused because both often mention a lecturer and time. Direction and hall-availability queries overlapped when hall names occurred without clear routing language. For entities, `lecturer_name` reached F1 0.985, while `course_name` reached only 0.667 because recall was 0.500.

H2 is accepted:weighted intent F1 of 0.904 exceeded the defined 0.85 threshold. The result supports the use of Rasa for core academic intents, while the per-class analysis identifies where more training data and clearer dialogue handling are needed.

### 4.4 Translation Results

The Marian run evaluated 100 trilingual sentence sets in six directions and three repetitions, producing 1,800 rows with zero runtime errors. Table 4.5 summarizes automated quality.



| Direction | Mean BLEU | Mean Semantic  Similarity | N |
| --- | --- | --- | --- |
| English → Tamil | 0.0051 | 0.8612 | 300 |
| Tamil → English | 0.0419 | 0.5083 | 300 |
| English → Sinhala | 0.0108 | 0.8749 | 300 |
| Sinhala → English | 0.0782 | 0.6722 | 300 |
| Tamil → Sinhala | 0.0037 | 0.8433 | 300 |
| Sinhala → Tamil | 0.0000 | 0.3430 | 300 |



Table 4.5 - Local Marian translation quality

The disagreement between BLEU and semantic similarity is substantial. English-to-Sinhala, for example, has low lexical overlap (BLEU 0.0108) but high embedding similarity (0.8749). Embedding similarity alone is therefore insufficient: Sinhala-to-Tamil similarity of 0.3430 indicates that this direction is not reliable for academic use.



| Direction | Mean Latency (ms) | SD (ms) | N |
| --- | --- | --- | --- |
| English → Tamil | 1,589.1 | 901.5 | 300 |
| Tamil → English | 2,817.5 | 6,017.1 | 300 |
| English → Sinhala | 1,401.6 | 3,552.9 | 300 |
| Sinhala → English | 1,114.2 | 2,954.7 | 300 |
| Tamil → Sinhala | 2,252.4 | 4,985.3 | 300 |
| Sinhala → Tamil | 2,862.2 | 5,405.7 | 300 |



Table 4.6 - Local Marian translation latency

Large standard deviations indicate warm-up, outliers, local hardware variation, or pivot-path effects.

#### 4.4.1 Human Translation Evaluation

Five blind raters evaluated 180 MarianMT outputs using 1-5 Likert scales for fluency, adequacy, and overall quality. Mean scores were fluency 3.91, adequacy 3.94, and overall 3.76. Inter-rater reliability was substantial for fluency (Krippendorff’s α = 0.617) and moderate for adequacy (α = 0.590) and overall (α = 0.454). Semantic similarity correlated strongly with human overall scores (Pearson *r* = 0.8805, *p* < 0.001), whereas BLEU did not (Pearson *r* = 0.0782, *p* = 0.2967).

H3 status: partially addressed. The local Marian engine is operationally stable and received moderate-to-good human ratings in aggregate, but direction-level quality is uneven and Tamil/Sinhala pairs-especially Sinhala-to-Tamil- are not suitable for production academic use. Cloud API comparison remains deferred because Google/Azure credentials were unavailable during the benchmark run.

Figure 13:fig-4-8-bleu_by_pair.png

Figure 14:fig-4-9-similarity_by_pair.png

Figure 15:fig-4-10-latency_by_pair.png

Figure 16:extra-A-human_scores_boxplot.png

Figure 17:extra-B-automated_vs_human_scatter.png

### 4.5 System and Functional Testing

A consolidated verification run on 9 July 2026 exercised builds, corpus validators, Phase 12.6 API tests, and the full Playwright suite (see Table 3.7 and [software_verification_run_2026-07-09/README.md](research/reports/software_verification_run_2026-07-09/README.md)). The platform remains deployed to production at https://lecstu.com with HTTPS, PM2, PostgreSQL, and Prisma migrations.

Table 34:Software Verification Checklist and Automated Test Outcomes



| ID | Area | Result | Evidence |
| --- | --- | --- | --- |
| SV-01 | Production TypeScript builds, client and server | Pass | npm run build completed with exit code 0 |
| SV-02 | ASR dataset manifest integrity | Pass | Manifest validated with 150 utterances across 3 languages |
| SV-03 | Translation corpus manifest integrity | Pass | Manifest validated with 300 pairs from 100 trilingual sentence sets |
| SV-04 | Password-reset and authentication API, Phase 12.6 | 10 / 10 Pass | run-phase-12-6-tests.ts |
| SV-05 | E2E login to dashboard | Pass | student-timetable.spec.ts |
| SV-06 | E2E forgot-password link and generic email copy | Pass | password-reset-flow.spec.ts |
| SV-07 | E2E enrollment profile field synchronization | Pass | enrollment-timetable-sync.spec.ts |
| SV-08 | E2E personalized timetable and course regression, 17 tests | Fail | Failed due to UI subtitle selector drift |
| SV-09 | E2E enrollment to timetable slot-count validation, 3 tests | Fail | Failed due to subtitle selector issue and CS-Y3-AINT assertion mismatch |
| SV-10 | E2E floor-plan alignment, 2 tests | Fail | Timeout occurred before the indoor navigation view loaded |
| SV-11 | E2E full password-reset UI flow | Fail | Failed at the post-reset login step |
| Total Automated Checks | Playwright, API tests, and dataset validators | 38 checks | 16 passed, 22 failed; failures were mainly browser E2E related |



Interpretation. API-layer authentication and reset controls pass automated security tests. Core student login and partial enrollment update paths pass in the browser. Timetable display, indoor map alignment, and the complete reset UI flow require test maintenance (updated selectors, navigation seeds) before they can be reported as passing regression evidence. Code coverage was not measured. HTML Playwright report was not generated in this run; failure artifacts (screenshots, video, trace ZIP) are archived under `research/reports/software_verification_run_2026-07-09/artifacts/`.

Status key: Pass = automated evidence green; Fai = automated evidence red; Partial = some checks pass; Manual = exercised on https://lecstu.com or code review without automated script; NT = not tested in this thesis run



| Test ID | Requirement | Precondition | Steps | Expected Result | Actual Result | Status | Evidence File |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T-01 | Student authentication: login | testaint@lecstu.edu seeded; API and client running | Open /login → enter credentials → submit | Redirect to dashboard; JWT session established | Dashboard reached after login | Pass | tests/student-timetable.spec.ts; software_verification_run_2026-07-09/summary.txt |
| T-02 | RBAC: student blocked from admin routes | Student JWT | GET /api/admin/* or navigate to /admin as student | 403 or redirect; no admin data exposed | Middleware authorize() present on admin routes; no automated RBAC matrix run | NT | server/src/middleware/auth.ts |
| T-03 | RBAC: lecturer appointment actions | Lecturer account | Lecturer accepts or rejects student request | Only lecturer role can accept/reject requests | Route guards present; not executed in July suite | NT | server/src/routes/appointments.ts |
| T-04 | Personalized timetable: Y3 CS-AINT | Student enrolled in CS-Y3-AINT | Login → My Timetable → verify group and course codes | Subtitle shows class; 12 required courses visible | Login passed; timetable assertions failed due to text/selector drift | Fail | tests/student-timetable.spec.ts; artifacts folder |
| T-05 | Enrollment change → timetable refresh | Student profile page available | Change programme/year → open My Timetable | Slot count and class group update without hard refresh | Profile field update passed; slot-count tests failed on subtitle | Partial | tests/enrollment-timetable-sync.spec.ts |
| T-06 | Timetable conflict detection | Admin FET grid with overlapping slots | Create or submit conflicting hall/time slots | Conflict flagged; not published silently | Feature exists in admin UI; no automated conflict test | NT | Admin FET components |
| T-07 | Hall availability: current free halls | Halls seeded in DB | Open Hall Explorer or query “free now” | Free halls returned for current time | Implemented in production; no July Playwright spec | Manual | Production UI; chatbot intent ask_hall_availability |
| T-08 | Appointment booking lifecycle | Student and lecturer accounts | Book → lecturer approve → status notification | Status changes from pending to confirmed | Full workflow deployed; not in automated matrix | Manual | hosting-screenshots/; appointment routes |
| T-09 | SSE real-time notifications | Logged-in user; notification stream active | Trigger appointment/timetable event | Notification received without reload | SSE service and EventSource hook implemented; no automated SSE test | NT | notificationService.ts; useNotificationStream.ts |
| T-10 | Campus map: building search | Campus markers seeded | Open /map → search/select CS building | Building highlighted with popup | Deployed in production; not automated in July 2026 | Manual | photos-for-thesis/ch4-ui/ |
| T-11 | Indoor navigation: same-floor route | Floor graph and building data available | Find My Way → select room → start route | A* path and turn list displayed | Graph and A* implemented; E2E test timed out before route UI | Fail | floor-plan-alignment.spec.ts; astar.ts |
| T-12 | Indoor navigation: multi-floor route | Vertical links between floors in DB | Route across floors using stairs/lift connectors | Continuous path across floors | Connector service and vertical edges implemented; not E2E tested | NT | docs/indoor-navigation/ARCHITECTURE.md |
| T-13 | QR positioning: active navigation | QR markers at corridor nodes | Scan or simulate QR marker | User position snaps to node; route recalculates | Implemented for Phase 11; no automated QR test | Manual | docs/indoor-navigation/; production demo |
| T-14 | Voice → ASR → chatbot pipeline | English voice; ASR service running | Press mic → speak timetable query → chatbot responds | Transcript sent to Rasa; live timetable returned | English ASR benchmark passed; full browser voice E2E not run | Partial | asr_benchmark_report.md; asr_service.py |
| T-15 | Translation: UI language switch | MarianMT service running | Switch UI to Tamil/Sinhala → view timetable | Translated labels and readable content | Corpus benchmark completed with no runtime errors; UI switch not E2E tested | Partial | translation_automated_benchmark_report.md |
| T-16 | Password reset: unknown email | API running on :5000 | Submit forgot-password request with unregistered email | Generic success message; no account leak | Generic message returned | Pass | run-phase-12-6-tests.ts; password-reset-flow.spec.ts |
| T-17 | Password reset: wrong/expired code | Active user | Submit invalid or expired reset code | HTTP 400 with clear error | Both rejected with HTTP 400 | Pass | run-phase-12-6-tests.ts |
| T-18 | Password reset: full UI flow | Dev reset code or SMTP available | Forgot → enter code → new password → login | Login succeeds with new password | Forgot link passed; full UI chain failed after reset | Fail | password-reset-flow.spec.ts; Phase 12.6 API tests |
| T-19 | Password reset: same password rejected | Active user | Reset to current password | HTTP 400 | Rejected as expected | Pass | run-phase-12-6-tests.ts |
| T-20 | Responsive layout: mobile viewport | Chrome device emulation | Resize to mobile width → open dashboard/sidebar/timetable | Layout usable; no horizontal clipping | WCAG audit marked responsive layout as partial; sidebar close-button issue noted | Partial | WCAG_2_2_AUDIT.md |
| T-21 | Security: JWT and bcrypt storage | DB access and code access | Inspect auth middleware and password storage | No plaintext passwords; protected routes require JWT | Prisma, bcrypt, and JWT used in production configuration | Manual | password.ts; auth.ts |
| T-22 | Security: rate limiting | Server running | Burst login or forgot-password attempts | HTTP 429 after threshold | Rate limiters configured; not load-tested in July run | NT | rateLimit.ts; audit-phase-12-5-security.ts |
| T-23 | Error handling: invalid login | Wrong password | Submit login with invalid password | Inline error; no stack trace exposed | Standard login error UI observed; not in Playwright suite | Manual | Production /login inspection |
| T-24 | Error handling: chatbot out-of-scope | Rasa running | Send unrelated utterance | Clarification or out-of-scope response | out_of_scope intent evaluated in NLP report; not browser E2E tested | Partial | nlp_evaluation_report.md |
| T-25 | Floor-plan rendering: coordinate alignment | Indoor navigation page loads | Inspect image CSS and SVG overlay dimensions | SVG overlay aligns with floor image | Playwright timed out before assertions | Fail | floor-plan-alignment.spec.ts |
| T-26 | Production deployment smoke test | https://lecstu.com live | Check HTTPS login, PM2 processes, DB migrations | Site reachable; TLS valid | Deployed and used for demonstrations | Manual | problemFacedWhenHosting.md; hosting-screenshots/ |
| T-27 | Build integrity: client and server | Clean npm run build | Compile TypeScript and Vite production bundle | Exit code 0; no compile errors | Both builds succeeded | Pass | software_verification_run_2026-07-09/README.md |



**Matrix summary (Table 4.8):** 27 requirements catalogued — **7 Pass**, **4 Fail**, **5 Partial**, **6 Manual**, **5 NT**. Automated coverage is strongest for **authentication API security weakest for SSE, RBAC matrix, multi-floor routing, and QR. Expanding Playwright specs (updated timetable selectors, navigation seeds) and running `audit-phase-12-5-security.ts` would raise automated coverage before final submission.Recorded test run (9 July 2026):** Playwright 26 tests - 4 passed, 22 failed, 0 skipped, 1,167 s; Phase 12.6 API 10/10; builds 2/2; manifest validators 2/2. Browser: Chrome headless (Playwright 1.60.0); OS: Windows 10 build 26200; DB: local PostgreSQL seeded faculty data; coverage: not measured. Evidence: [software_verification_run_2026-07-09/](research/reports/software_verification_run_2026-07-09/) (JSON, console log, failure screenshots/traces - no HTML report generated).

### 4.6 User Interface Evidence

Figures 4.11-4.20 document the deployed student-facing interface. Image files are stored under [photos-for-thesis/ch4-ui/](photos-for-thesis/ch4-ui/). They were assembled in July 2026 from (i) production deployment screenshots in `hosting-screenshots/`, (ii) Playwright verification captures (`software_verification_run_2026-07-09/artifacts/`), and (iii) local registration/chatbot development shots. Figures 4.14 and 4.18 are interim views (dashboard navigation widget / indoor search panel) rather than dedicated full-page `/halls/availability` or active turn-by-turn route screens; replace with fresh https://lecstu.com captures before final print if examiners require page-exact evidence.

Figure 18:login-register.png

Figure 19:student-dashboard.png

Figure 20:timetable.png

Figure 21:timetable.png

Figure 22:Dashboard.png

#### 4.6.1 WCAG 2.2 Accessibility Audit

A targeted accessibility audit was completed in July 2026 on the production deployment. Table 4.9 reproduces the criterion-level summary; the full procedure and issue log appear in [research/usabilitystudy/WCAG_2_2_AUDIT.md](research/usabilitystudy/WCAG_2_2_AUDIT.md).



| Criterion | Level | Result | Principal Finding |
| --- | --- | --- | --- |
| 1.1.1 Non-text content | A | Partial | Images are labelled on login and map pages; however, route graphics remain partly visual |
| 1.3.1 Info and relationships | A | Partial | Forms use semantic labels, and indoor navigation tabs include ARIA roles |
| 1.4.1 Use of colour | A | Partial | Route legend text is provided, but colour still carries some status meaning |
| 1.4.3 Contrast minimum | AA | Partial | Forms passed spot checks, but sidebar link contrast requires further verification |
| 1.4.4 Resize text | AA | Pass | Layout remained usable when zoom level was increased |
| 2.1.1 Keyboard | A | Partial | Authentication and navigation areas are keyboard-accessible, but map interactions are mainly pointer-driven |
| 2.4.2 Page titled | A | Pass | Pages use consistent and meaningful document titles |
| 2.4.4 Link purpose | A | Pass | Links use descriptive visible text |
| 2.4.7 Focus visible | AA | Partial | Input focus indicators are visible, but some icon buttons have weak focus indication |
| 3.3.1 Error identification | A | Pass | Authentication errors are displayed using readable text messages |
| 3.3.2 Labels or instructions | A | Pass | Input fields, chat controls, and search controls are labelled |
| 4.1.2 Name, role, value | A | Partial | Chat and indoor navigation include ARIA support, but the password toggle is not fully named |



Unresolved issues (priority fixes): (A1) add `aria-label` to password show/hide control; (A2) label mobile sidebar close button; (A3) reduce colour-only route cues on maps; (A4) provide non-pointer building/room selection; (A5) verify sidebar contrast ratios. Voice and chatbot features improve practical access but do not alone satisfy WCAG for all user groups.

Evidence folder (axe/Lighthouse screenshots):[photos-for-thesis/appendix/wcag-audit/](photos-for-thesis/appendix/wcag-audit/)

### 4.7 Usability Results

#### 4.7.1 Study execution status

Twenty student usability questionnaires were collected in July 2026 after sessions on https://lecstu.com (`research/usability-study/raw-data/form-responses-students-2026-07-10.csv`), meeting the preregistered target of 20 participants. Analysis: `research/usability-study/scripts/analyze_usability.py` → `research/reports/usability_study_report.md` and `research/usability-study/results/usability_analysis.json`.

Sensitivity check. Four submissions used researcher- or system-associated email addresses (P11, P12, P26×2, P29). Excluding those rows yields n = 16, SUS mean **61.50** (SD 16.06); conclusions unchanged. Primary tables use all 20 exported rows.

#### 4.7.2 Participant demographics

Table 36:Participant demographics



| Field | Result |
| --- | --- |
| Role | Students: 20 |
| Age band | 18–21: 1; 22–25: 10; 26–30: 9 |
| Programme | CT: 11; CS: 4; ET: 3; BS: 2 |
| Study year | Year 1: 3; Year 2: 5; Year 3: 2; Year 4: 10 |
| Technology comfort (1–5) | Mean: 4.75; SD: 0.44 |
| Preferred language | English: 7; Mixed: 12; Tamil: 1 |



##### 4.7.3 Task completion, success, and timing

Table 37:Task completion and timing by mode



| Task | Ease Mean (SD) | n | Satisfaction Mean (SD) | n |
| --- | --- | --- | --- | --- |
| T1 — Next lecture | 4.85 (0.49) | 20 | 4.84 (0.50) | 19 |
| T2 — Free hall | 4.70 (0.57) | 20 | 4.75 (0.55) | 20 |
| T3 — Book appointment | 4.74 (0.56) | 19 | 4.67 (0.59) | 18 |
| T4 — Indoor navigation | 4.68 (0.48) | 19 | 4.53 (0.51) | 17 |
| T5 — Voice interaction (Tamil/Sinhala) | 3.44 (1.42) | 18 | 3.67 (1.50) | 18 |
| T6 — Language and timetable | 3.45 (1.32) | 20 | 3.50 (1.38) | 18 |



Overall perceived efficiency (T7, 1–5): faster than manual 4.63 (0.83), n = 19; easier than manual 4.79 (0.54), n = 19; would use again 18 yes / 1 no.

Within-subject (T1 ease vs T5 ease, n = 18):mean difference 1.39(SD 1.29), paired t(17) = 4.57.

#### 4.7.4 Questionnaire results (SUS, AI trust, accessibility)

Table 38:System Usability Scale (SUS)



| Metric | Value |
| --- | --- |
| Mean SUS score | 60.53 |
| Standard deviation (SD) | 14.45 |
| Score range | 37.5–85.0 |
| Comparison with benchmark score of 68 | t(18) = −2.26, statistically significant |



SUS items (raw 1–5): SUS1 4.75; SUS2 2.35; SUS3 4.80; SUS4 3.30; SUS5 4.30; SUS6 2.25**; SUS7 4.65; SUS8 2.80; SUS9 4.74; SUS10 3.35.

AI trust: AI1 3.35 (1.18); AI2 3.63 (0.90); AI3 3.30 (1.08); AI4 4.32 (0.75); AI5 4.42 (0.77).

Features: F1 4.80; F2 4.95; F3 4.80; F4 4.75; F5 4.75; F6 4.45; F8 4.20; F9 3.35; F10 3.60.

Recommendation:20/20 positive.

#### 4.7.5 Qualitative feedback

#### Positive: integrated platform; chatbot timetable help; lecturer/hall access; would recommend.

#### Improvement: voice unreliable; translation/language switching; indoor nav guidance; mobile app request.

#### Quotes:P05 - “Access denied for Voice input”; P06 -“language switching… not working”; P01 Tamil chatbox needs improvement.

#### 4.7.6 Data location after collection

Collected data and analysis artifacts are stored as follows:



| Artifact | Path |
| --- | --- |
| Google Form export | research/usability-study/raw-data/form-responses-students-2026-07-10.csv |
| Analysis script | research/usability-study/scripts/analyze_usability.py |
| JSON results | research/usability-study/results/usability_analysis.json |
| Report | research/reports/usability_study_report.md |



### 4.8 Chapter Summary

The available evidence supports H2 and confirms a working automated and human evaluation pipeline for translation. English ASR results reveal a clear accuracy-latency trade-off; H1 is partially supported for English but Tamil/Sinhala ASR remains future work. Translation infrastructure is complete, but Tamil/Sinhala quality is uneven and not claimed as a finished contribution. Usability questionnaires from 20 students report mean SUS 60.53 (SD 14.45), strong satisfaction with core features (paired t(17) = 4.57 for T1 vs T5 ease), and weaker voice/translation ratings (Section 4.7). Production deployment and indoor navigation integration are engineering outcomes that complement the AI evaluations reported above.

## Chapter 5 – Discussion

### 5.1 Interpretation of ASR Findings

Whisper medium’s English mean WER of 0.0410 was the best observed result, approximately half the Google baseline mean of 0.0806. Its mean latency was more than four times the Google value and about 19.5 times the fine-tuned tiny value. This illustrates why selecting a model solely by WER would be inappropriate for interactive use. A smaller model may provide a more acceptable conversational delay, while a larger model may suit asynchronous transcription.

The fine-tuned tiny model did not improve WER over the original tiny model in this run. Possible explanations include limited or synthetic fine-tuning data, too few training steps, mismatch between training and evaluation speech, or catastrophic specialization. The result should not be interpreted as evidence that fine-tuning is generally ineffective. It indicates that this specific training setup requires a stronger dataset and controlled ablation.

No conclusion about Tamil or Sinhala ASR is justified in this thesis. The English benchmark and finetuning pipeline are complete, and public corpora for Tamil and Sinhala adaptation have been identified [11], [12], but reliable multilingual voice input was not achieved in the deployed system. This limitation does not diminish the English voice-to-chatbot pathway, which is the primary implemented interaction mode.

### 5.2 Interpretation of Chatbot Findings

The cross-validated intent F1 of 0.904 and entity F1 of 0.953 show that a compact, domain-specific Rasa pipeline can support common academic tasks without sending every query to a general-purpose cloud model. This benefits privacy, predictable behavior, and integration with structured APIs. The result also validates the proposal’s decision to use a customizable framework.

Aggregate performance hides operational weaknesses. `out_of_scope` fell below the 0.85 target, and `course_name` extraction had recall of 0.500. Appointment and availability utterances share vocabulary, so the system should use clarification rather than acting on an uncertain classification. Similarly, the 100% held-out result may indicate that the split was too easy or contained near-duplicate patterns. A future user-utterance test set should be collected independently after model development.

### 5.3 Interpretation of Translation Findings

The translation system’s zero-error completion confirms engineering reliability for the tested run, but output quality varies strongly by direction. Automated similarity scores overstate quality for some pairs; human ratings (overall mean 3.76/5.0) confirm moderate usability in aggregate but do not justify deploying Sinhala-to-Tamil or other weak directions in production. Very low BLEU and high similarity should not automatically be described as good translation. Embedding similarity may reward topic overlap even when a time, negation, room number, or lecturer name is wrong. Such errors are disproportionately important in academic logistics.

For the implemented platform, English remains the authoritative interface language. Tamil and Sinhala translation should be treated as experimental until dedicated low-resource models, direct language-pair training, and larger verified corpora are incorporated in future research [6], [7], [11], [12].

### 5.4 Integrated Artifact Contribution

The strongest contribution is the connection between language interfaces and institutional operations. The chatbot can call current timetable, availability, appointment, and navigation services. Voice input can be routed through ASR to the same intent layer. Translation can wrap academic content, while QR and graph routing connect a spoken destination to a physical route. This architecture turns AI from a standalone demonstration into a set of interchangeable access mechanisms.

The graph-first navigation design is also significant. Computer vision assists an administrator during setup, but published routes use a reviewed database graph. This reduces runtime unpredictability and supports correction, auditing, and deterministic testing. A* provides efficient primary routing while Dijkstra offers a fallback and validation path.

### 5.5 Practical Implications

For deployment, a hybrid configuration is appropriate. Local Rasa and local translation/ASR options improve control and allow the platform to operate without sending every utterance to a third party. Cloud engines can remain optional baselines or fallbacks where consent and institutional policy allow them. Model selection should be configurable by language, device capability, network status, and task criticality.

The platform should also expose uncertainty. Low-confidence chatbot predictions should trigger clarification; translations of critical notices should display the source text; and route instructions should allow users to report an incorrect connector. Accessibility requires these recovery paths as much as it requires voice input.

Student usability questionnaires (n = 20) align with this: core logistics scored 4.7–4.9/5; voice/translation ~3.4–3.7/5; paired t(17) = 4.57 (T1 vs T5); SUS 60.53, t(18) = −2.26.

### 5.6 Limitations and Threats to Validity

The present study has the following limitations:

The present study has the following limitations:

1. The valid ASR benchmark covers English only; Tamil and Sinhala ASR evaluation and finetuning remain future work.

2. ASR audio is currently limited to one speaker and includes sample/synthetic recordings.

3. Hardware, model warm-up, caching, and network conditions need fuller control and reporting.

4. The NLU dataset was authored within the project and may not represent spontaneous user language.

5. The held-out NLU result may be inflated by pattern similarity or leakage and requires an independent audit.

6. Tamil/Sinhala translation quality is insufficient for reliable academic use in several directions.

7. Cloud translation baselines could not be executed because of API credential/rate-limit issues.

8. BLEU tokenization may be unsuitable for the tested short Tamil and Sinhala sentences.

9. The usability study used student questionnaires only (n=20); lecturer and administrator cohorts were outside this evaluation scope.

10. The artifact was developed for one university context, limiting institutional generalization.

11. Floor-plan OCR and graph accuracy have not been reported across a sufficiently diverse building set.

### 5.7 Chapter Summary

The results demonstrate technical feasibility and strong domain NLU performance. English ASR and the integrated platform-including production deployment, timetables, appointments, notifications, and indoor navigation are the primary completed contributions. Tamil and Sinhala speech and translation are not yet established at the same level but are supported by documented datasets and published low-resource language research for future extension. Student usability questionnaires indicate SUS 60.53 and high satisfaction with core logistics (4.7-4.9/5), with voice/translation lower (~3.4/5).

## Chapter 6 - Conclusions

### 6.1 Summary of the Research

This research designed and implemented LECSTU, an AI-integrated academic platform for university environments, deployed at https://lecstu.com. The artifact consolidates timetables, staff and hall availability, appointments, notifications, outdoor and indoor navigation with QR positioning, English speech recognition, conversational assistance through Rasa, and an optional translation layer. It uses a responsive React frontend, an Express/PostgreSQL backend, Rasa, and independently deployable Python AI microservices.

### 6.2 Alignment with Objectives

RO-1 was partially achieved: The ASR pipeline, dataset structure, English benchmark, analysis, and fine-tuned engine were implemented and deployed. Tamil/Sinhala ASR evaluation and multi-speaker validity remain future work, with finetuning datasets documented (SLR127, SLR52).

RO-2 was achieved for the defined dataset: The Rasa chatbot was trained and evaluated, exceeding the F1 acceptance threshold and exposing actionable error patterns. Custom actions connect intents to live timetable, appointment, availability, and navigation APIs.

RO-3 was partially achieved:The translation service, corpus, automated benchmark, and human evaluation were completed. Tamil/Sinhala output quality is uneven and not claimed as production-ready; cloud comparison remains deferred.

RO-4 was achieved: Twenty student usability questionnaires were collected (SUS mean 60.53, SD 14.45; core satisfaction 4.7-4.9/5; voice/translation ~3.4/5; 20/20 recommend; T7 means 4.63-4.79/5).

RO-5 was substantially achieved:A production-oriented platform integrates academic logistics and AI services, is publicly deployed, and includes automated tests for several critical workflows plus documented hosting procedures.

### 6.3 Conclusions Drawn from Current Evidence

The study concludes that a domain-specific, modular AI architecture can integrate voice and conversational interaction with live university services. Rasa provides acceptable intent and entity performance for the tested academic domain. The integrated platformtimetables, appointments, notifications, and indoor navigation-is the strongest engineering contribute-on. English ASR shows a material accuracy–latency trade-off: the most accurate tested model was also the slowest. Tamil and Sinhala speech and translation infrastructure exists but did not reach reliable quality in the deployed system. Twenty student usability responses support acceptable perceived usability and satisfaction with core features (SUS 60.53), with strong core-feature ratings and lower voice/translation ratings.

### 6.4 Closing Remarks

Detailed recommendations for the faculty, system maintainers, and follow-on research are presented in Chapter 7. They are derived from the limitations in Section 5.6 and the partial completion of RO-1 and RO-3.

### 6.5 Final Statement

LECSTU demonstrates how AI can be incorporated as an accountable interface to university services rather than as an isolated conversational feature. Its principal value lies in the integration of structured academic data, English voice and chatbot access, and physical indoor navigation within a reproducible, production-deployed research artifact. Tamil and Sinhala support remains an active research and development track, grounded in published low-resource language corpora and methods. Chapter 7 sets out the steps required to translate this technical foundation into inclusive, measurable benefit for students and staff.

## Chapter 7 — Recommendations

### 7.1 Introduction

This chapter translates the findings and limitations of Chapters 4-6 into actionable recommendations. They are addressed to three audiences: (1) the Faculty of Computing and Technology (FCT), University of Kelaniya, as institutional host of https://lecstu.com; (2) platform maintainers and developers responsible for the LECSTU monorepo; and (3) future researchers extending RO-1–RO-4. Recommendations are prioritized by impact on user safety, inclusion, and evidence quality-not by implementation convenience alone.

### 7.2 Recommendations for institutional deployment and adoption

Table 40:Recommendations for Institutional Pilot and Governance



| # | Recommendation | Rationale from This Thesis |
| --- | --- | --- |
| R-1 | Obtain formal ethics approval before any new participant data collection, including follow-on studies and human voice recordings. | The ethics reference is still pending, although student questionnaires involving 20 participants were collected under the study protocol. |
| R-2 | Pilot LECSTU with one degree programme, such as CS Year 3, using the seeded timetable data already available in the system. Expand the system only after timetable and appointment workflows are validated with academic staff. | End-to-end timetable tests failed because of user-interface drift, although production demonstrations were available. This indicates that regression testing coverage must be strengthened before a wider rollout. |
| R-3 | Assign a named faculty contact to maintain timetable master data, hall inventory and lecturer availability so that the chatbot and user interface remain aligned with official schedules. | LECSTU depends on live academic APIs. Outdated timetable or lecturer-availability data may reduce users’ trust in the chatbot and the overall platform. |
| R-4 | Communicate English as the supported production language until Tamil and Sinhala ASR and translation components satisfy the defined extension criteria. | English ASR is currently the only validated production pathway, while the quality of Tamil and Sinhala ASR and translation remains inconsistent. |
| R-5 | Conduct a short staff briefing explaining the chatbot’s supported scope, including timetables, halls, appointments and directions. Clearly state that it is not intended to provide general-purpose LLM advice. | The out_of_scope intent produced weaker cross-validation performance. Therefore, users should clearly understand the chatbot’s supported functions and task boundaries. |
| R-6 | Establish and document an institutional data-retention policy for platform accounts and align it with the research retention requirements, including retention until thesis completion plus 12 months for study data. | The thesis data-protection plan avoids the indefinite retention of voice recordings, questionnaire responses and personally identifiable information. The operational platform should follow the same privacy-focused approach. |



### 7.3 Recommendations for platform engineering and operations

Table 41:Technical Recommendations



| # | Recommendation | Rationale |
| --- | --- | --- |
| R-7 | Fix and maintain the Playwright end-to-end testing specifications, including timetable subtitle selectors, indoor-navigation seed data and the password-reset user-interface flow, so that Table 4.8 can present reliable regression evidence before the next release. | The July 2026 verification run recorded 22 failures out of 26 end-to-end tests, indicating that browser-level regression coverage is not yet stable. |
| R-8 | Install and verify FFmpeg on every ASR host and implement a startup health check that provides a clear failure message when FFmpeg is unavailable. | The recorded Tamil and Sinhala batch ASR test failed because the required audio-processing dependency was missing. |
| R-9 | Deploy Whisper Small or Whisper Base as the default model for interactive voice functions, while reserving Whisper Medium for offline or batch transcription where higher latency is acceptable. | The ASR evaluation demonstrated an accuracy–latency trade-off. Whisper Medium achieved better accuracy but required considerably more processing time. |
| R-10 | Add clarification prompts when Rasa confidence is low, particularly for appointment-related and availability-related intents. | Confusion was observed between closely related intents. Clarification prompts can therefore reduce incorrect intent routing and inappropriate responses. |
| R-11 | Display the original English text alongside translated user-interface content for critical notices, including timetable changes and appointment confirmations. | Translation errors relating to academic logistics may cause significant misunderstanding. Displaying the English source text provides users with a reliable fallback. |
| R-12 | Complete the WCAG remediation actions A1–A5 identified in Section 4.6.1, including password-toggle labelling, improvements to the sidebar-close control, keyboard accessibility for maps and a complete colour-contrast audit. | The accessibility audit identified only partial WCAG conformance. The availability of voice interaction alone does not ensure that the platform is accessible to all users. |
| R-13 | Execute audit-phase-12-5-security.ts and the rate-limit load tests before every major release, and archive the generated outputs in Appendix H. | Security tests had been scripted but were not executed during the July 2026 verification run. |
| R-14 | Publish indoor-navigation graphs only after administrator review and retain vision-generated or OCR-generated outputs as drafts until they have been manually verified. | LECSTU uses a graph-first indoor-navigation design, while the floor-plan end-to-end test timed out during the verification process. |
| R-15 | Implement monitoring and rollback mechanisms for PM2-managed services, including lecstu-api, Rasa and the action servers, with version-controlled application and model artifacts. | As LECSTU is deployed through lecstu.com, production reliability requires service monitoring, rollback support and version-controlled releases of software and machine-learning models. |



### 7.4 Recommendations for research and evaluation

Table 42:Research Evaluation and Future Validation Recommendations



| # | Recommendation | Rationale |
| --- | --- | --- |
| R-16 | Extend the usability evaluation to lecturer and administrator cohorts using the same questionnaire instruments applied to the student participants. | The student evaluation has been completed with 20 participants and produced a mean SUS score of 60.53. However, lecturer and administrator cohorts have not yet been evaluated. |
| R-17 | Rebuild the held-out NLU dataset using novel phrasings that are fully disjoint from nlu.yml, and report the resulting leakage-free performance metrics separately. | The current held-out dataset has substantial overlap with the training data, with 75 of the 78 held-out utterances also appearing in nlu.yml. This overlap may inflate the reported evaluation results. |
| R-18 | Collect spontaneous user utterances from anonymised and consented chatbot interaction logs to expand the NLU dataset beyond investigator-authored YAML examples. | Investigator-authored utterances may not accurately represent the natural language used by students and lecturers, creating a potential threat to internal and ecological validity. |
| R-19 | Replace the gTTS-generated ASR audio with ethics-approved, multi-speaker human recordings collected under clean and moderate-noise conditions before extending the H1 claims beyond English. | The current ASR evaluation corpus is synthetic. Therefore, strong claims about real-world Tamil and Sinhala ASR performance cannot yet be supported. |
| R-20 | Execute cloud-based translation baseline evaluations when API access becomes available, and report paired comparisons against Marian and mBART. | The cloud translation baseline evaluations were deferred. Consequently, the performance of the local translation models still requires comparison with established external services. |
| R-21 | Complete native-speaker review for translation sentences 051–100 and update review_log.json before citing the corpus quality in future publications. | These sentences are currently labelled as pending_native_review; therefore, the linguistic quality of the complete reference corpus has not yet been fully verified. |
| R-22 | Evaluate indoor navigation quantitatively using route optimality, QR-code snap error and user route-comprehension measures across at least two university buildings. | Chapter 4 does not currently present automated or quantitative performance metrics for the indoor-navigation component. |



### 7.5 Future work roadmap

Table 43:Prioritized Future Work



| Priority | Work Stream | Actions | Relationship to Research Objective |
| --- | --- | --- | --- |
| Medium | Staff usability | Extend the questionnaire-based usability evaluation to lecturer and administrator cohorts. | RO-4 |
| High | Testing and quality gates | Repair the Playwright end-to-end test specifications, update Table 4.8 with successful regression evidence and execute continuous-integration checks for every pull request. | RO-5 |
| High | Accessibility | Complete WCAG remediation actions A1–A5 and archive the resulting axe and Lighthouse accessibility reports. | RO-4 and accessibility planning |
| Medium | Tamil and Sinhala ASR | Install and verify FFmpeg, fine-tune the ASR models using SLR127 and SLR52, collect ethics-approved human voice recordings and report the findings according to Section 4.2.1. | RO-1 |
| Medium | Tamil and Sinhala machine translation | Evaluate direct Tamil–Sinhala translation models, verify the translation corpus and conduct human review of critical translated entities. | RO-3 |
| Medium | NLU robustness | Develop an independent leakage-free test dataset, improve the clarification user experience and increase course_name entity recall. | RO-2 |
| Medium | Indoor navigation | Validate routes across multiple university buildings and conduct a QR-based positioning accuracy study. | RO-5 |
| Lower | Operations | Add service monitoring, autoscaling, model rollback mechanisms and long-term adoption survey processes. | RO-5 |
| Lower | Generalisation | Pilot LECSTU in a second institution or faculty and conduct a comparative deployment study. | Beyond the current scope |



#### 7.5.1 Tamil and Sinhala extension — supporting literature

Future reporting on multilingual extension should cite the following foundational sources already used in this thesis:

Table 44:Literature Support for LECSTU AI Components



| Topic | Reference | Relevance to LECSTU |
| --- | --- | --- |
| Multilingual student voice support | [4] Ralston et al. | Provides prior evidence that multilingual academic voice interaction is feasible in student-support systems. |
| Whisper ASR foundation | [3] Radford et al. | Provides the foundation ASR model used in the LECSTU speech-recognition service and fine-tuning process. |
| Tamil ASR corpus | [11] IISc-MILE Tamil, SLR127 | Provides approximately 150 hours of Tamil speech data for ASR fine-tuning. |
| Sinhala ASR corpus | [12] Large Sinhala ASR corpus, SLR52 | Provides approximately 185,000 Sinhala utterances for Sinhala ASR fine-tuning. |
| Tamil and Kannada subword ASR | [13] Madhavaraj et al. | Supports the use of low-resource ASR methods for agglutinative languages such as Tamil. |
| Neural machine translation | [6] Marian | Supports the local neural machine translation engine used in the LECSTU platform. |
| Multilingual translation | [7] mBART | Provides an alternative multilingual translation model relevant to the LECSTU translation component. |



### 7.6 Chapter summary

## Chapter 7 recommends that FCT treat LECSTU as a research-backed pilot rather than a finished multilingual product: deploy English-first with clear scope, positive student questionnaire feedback (SUS 60.53, strong core-feature ratings), harden tests and accessibility, and pursue Tamil/Sinhala ASR and translation as a documented extension track. For maintainers, the highest-return engineering tasks are regression-test repair, FFmpeg-backed ASR reliability, and low-confidence chatbot handling. For researchers, independent NLU and navigation evaluation-and honest reporting of partial RO achievement-will strengthen the credibility of any follow-on publications built on this artifact.

## References

Reference status:Entries [1]–[4] originate from the supplied proposal and were normalized where sufficient details were available. Entries [5]–[10] are foundational technical sources appropriate to implemented methods. Before submission, verify every author, title, year, volume, issue, pages, DOI/URL, and access date against the original publication, and ensure every in-text citation has one matching IEEE entry. Replace weak web/blog sources from the proposal with peer-reviewed or official primary sources where possible..

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

[11] A. Madhavaraj, P. Bharathi, and A. G. Ramakrishnan, “Knowledge-driven subword grammar modeling for automatic speech recognition in Tamil and Kannada,” arXiv:2207.13333, 2022. [Dataset: IISc-MILE Tamil ASR Corpus, OpenSLR SLR127.]

[12] O. Kjartansson, S. Sarin, K. Pipatsrisawat, M. Jansche, and L. Ha, “Crowd-sourced speech corpora for Javanese, Sundanese, Sinhala, Nepali, and Bangladeshi Bengali,” in *Proc. 6th Intl. Workshop on Spoken Language Technologies for Under-Resourced Languages (SLTU)*, 2018, pp. 52–55, doi: 10.21437/SLTU.2018-11. [Dataset: Large Sinhala ASR, OpenSLR SLR52.]

[13] A. Madhavaraj, P. Bharathi, and A. G. Ramakrishnan, “Subword dictionary learning and segmentation techniques for automatic speech recognition in Tamil and Kannada,” arXiv:2207.13331, 2022.

[14] J. Cao, A. Ganesh, J. Z. Cai, R. Southwell, E. M. Perkoff, M. Regan, K. Kann, J. H. Martin, M. Palmer, and S. D’Mello, “A comparative analysis of automatic speech recognition errors in small group classroom discourse,” in *Proc. 31st ACM Conf. User Modeling, Adaptation and Personalization (UMAP ’23)*, 2023, pp. 250–262, doi: 10.1145/3565472.3595606.

[15] Y. A. O. Mejia, C. A. D. Navarro, N. E. Casildo-Bedón, and Y. E. R. Pezo, “Influence of a chatbot based on a conversational agent on the adaptability of first-year students of a Peruvian private university,” *Frontiers in Education*, vol. 9, 2024, Art. no. 1459303, doi: 10.3389/feduc.2024.1459303.

[16] F. E. Arévalo-Cordovilla and M. Peña, “Early detection and personalized academic support using a predictive chatbot for student success,” *PeerJ Computer Science*, vol. 12, 2026, Art. no. e3656, doi: 10.7717/peerj-cs.3656.

[17] S. Colbran, M. Jha, and C. Schiavone, “Understanding student perspectives on generative AI chatbots: a human-centred mixed-methods study in higher education,” *Int. J. Educational Technology in Higher Education*, vol. 23, no. 28, 2026, doi: 10.1186/s41239-026-00605-w.

[18] M. Padmaja, K. Geethasri, J. S. Kousik, M. Vaishnavi, B. K. Sai, and D. L. Nayak, “Campus routing using QR code,” *J. Phys.: Conf. Ser.*, vol. 2335, no. 1, 2022, Art. no. 012060, doi: 10.1088/1742-6596/2335/1/012060.

[19] J. Yan, J. Lee, S. Zlatanova, A. Diakité, and H. Kim, “Navigation network derivation for QR code-based indoor pedestrian path planning,” *Transactions in GIS*, vol. 26, no. 4, pp. 831–850, 2022, doi: 10.1111/tgis.12912.

[20] Sushma and S. Ambareesh, “Indoor navigation using QR code based on Google Maps for iOS,” in *Proc. Int. Conf. Communication and Signal Processing (ICCSP)*, 2017, pp. 1700–1705, doi: 10.1109/ICCSP.2017.8286682.

[21] E. Jiménez-García, J. Ruiz-Lázaro, S. Martínez-Requejo, and S. Redondo-Duarte, “Artificial intelligence and chatbots for sustainable higher education: a systematic review,” *RIED-Revista Iberoamericana de Educación a Distancia*, vol. 28, no. 2, pp. 81–104, 2025, doi: 10.5944/ried.28.2.43240.

[22] N. Abbas, J. Whitfield, E. Atwell, H. Bowman, T. Pickard, and A. Walker, “Here’s to the future: Conversational agents in higher education—a scoping review,” *Int. J. Educational Research Review*, vol. 8, 2023, Art. no. 102233, doi: 10.1016/j.ijer.2023.102233.

[23] D. Villajuan-Ayala *et al.*, “Systematic and bibliometric review on the impact of chatbots in higher education,” *Computación y Sistemas*, vol. 29, no. 4, 2025. [Online]. Available: https://cys.cic.ipn.mx/index.php/CyS/article/view/6116

## Appendices

Appendix A - ASR transcription entry point

Declaration: All voice input (benchmark and production) enters through one dispatcher that normalizes language, optionally preprocesses audio, and selects Whisper, Google, or Azure.

Source: `ai-services/asr/asr_service.py`

def transcribe(

audio_path: str,

language: str = "en",

engine_name: str = "whisper",

model_size: Optional[str] = None,

preprocess: bool = True,

) -> dict:

language = language.lower()[:2] if language else "en"

if language not in SUPPORTED_LANGUAGES:  # en, ta, si

language = "en"

if preprocess:

temp_path = normalize_audio(audio_path, sample_rate=16000, channels=1)

processed_path = temp_path

if engine_name.lower() == "google":

return google_transcribe(processed_path, language)

# default: Whisper tiny | base | small | medium

return whisper_transcribe(processed_path, language, model_size)

Appendix B -Rasa NLU pipeline

Declaration: Intent and entity recognition use DIETClassifier with character n-grams, which suits short academic queries (timetable, halls, appointments).

Source: `ai-services/chatbot/config.yml`

pipeline:

- name: WhitespaceTokenizer

- name: RegexFeaturizer

- name: LexicalSyntacticFeaturizer

- name: CountVectorsFeaturizer

- name: CountVectorsFeaturizer

analyzer: char_wb

min_ngram: 1

max_ngram: 4

- name: DIETClassifier

epochs: 100

entity_recognition: true

constrain_similarities: true

Appendix C - Chatbot live timetable action

Declaration: The chatbot does not store schedules in the model; it fetches the student’s current timetable from the Express API using chatbot authentication headers.

Source:`ai-services/chatbot/actions/actions.py`

r = requests.get(

f"{PLATFORM_API_URL}/timetable/my",

headers=_api_headers(user_id),  # X-Chatbot-Api-Key + X-Chatbot-User-Id

params={"_": int(datetime.now().timestamp())},

timeout=10,

)

r.raise_for_status()

data = r.json()

tt = data["data"]

lines = _timetable_lines_from_grid(tt.get("grid"), requested_day)

dispatcher.utter_message(text="Here's your timetable:\n\n" + "\n".join(lines[:15]))

Appendix D - Authentication and chatbot API key

Declaration. Browser clients use JWT; Rasa custom actions authenticate with a shared API key and the logged-in user id so the same REST layer serves both UI and chatbot.

Source: `server/src/middleware/auth.ts`

export async function authenticate(req: Request, _res: Response, next: NextFunction) {

const apiKey = req.headers['x-chatbot-api-key'] as string | undefined;

const chatbotUserId = req.headers['x-chatbot-user-id'] as string | undefined;

if (apiKey && chatbotUserId && apiKey === config.chatbot.apiKey) {

const user = await prisma.user.findUnique({

where: { id: chatbotUserId, isActive: true },

select: { id: true, email: true, role: true },

});

req.user = { userId: user!.id, email: user!.email, role: user!.role };

return next();

}

const token = req.cookies?.access_token

|| req.headers.authorization?.replace('Bearer ', '');

req.user = verifyAccessToken(token!);

next();

}

Appendix E - Personalized timetable API

Declaration. `GET /api/timetable/my` returns the role-specific schedule (student group or lecturer load) with optional cache bypass for chatbot freshness.

Source: `server/src/controllers/userTimetableController.ts`

```typescript

export async function getMyTimetable(req: Request, res: Response, next: NextFunction) {

const { userId, role } = req.user!;

const bypassCache = req.query._ !== undefined || req.query.refresh === '1';

const cached = bypassCache ? null : getCached(cacheKey);

if (cached) return res.json({ success: true, data: cached });

const data = role === 'STUDENT'

? await getStudentTimetable(userId)

: await getLecturerTimetable(userId);

setCached(cacheKey, data);

res.json({ success: true, data });

}

## Appendix F — Appointment booking with role checks

Declaration. Only authenticated students may create appointments; lecturers accept or reject through separate authorized routes on the same resource.

Source: `server/src/routes/appointments.ts`

router.use(authenticate);

router.post('/', authorize('STUDENT'), appointmentCreateRules, createAppointment);

router.get('/', listAppointments);

router.patch('/:id/accept', authorize('LECTURER'), acceptAppointment);

router.patch('/:id/reject', authorize('LECTURER'), rejectAppointment);

router.patch('/:id/admin-approve', authorize('ADMIN'), adminApproveAppointment);

```

Appendix G - MarianMT with Tamil–Sinhala pivot

Declaration. Direct Marian models cover English↔Tamil and English↔Sinhala; Tamil↔Sinhala is pivoted through English and latencies are summed—matching the RO-3 evaluation design.

Source: `ai-services/translation/engines/transformer_engine.py`

elif pair == ("ta", "si"):

# Pivot: Tamil → English → Sinhala

t1, lat1 = _translate_with_model(TA_EN_MODEL, text, None)

t2, lat2 = _translate_with_model(EN_SI_MODEL, t1, ">>sin<< ")

translated, lat = t2, lat1 + lat2

else:  # ("si", "ta")

t1, lat1 = _translate_with_model(SI_EN_MODEL, text, None)

t2, lat2 = _translate_with_model(EN_TA_MODEL, t1, None)

translated, lat = t2, lat1 + lat2

return {"translated_text": translated, "latency_ms": round(lat, 2), "engine": "marian"}

Appendix H - Indoor A* pathfinding

Declaration. Published indoor routes use A* on the reviewed navigation graph (nodes and weighted edges), not live computer-vision at query time.

Source: `server/src/modules/indoor-navigation/pathfinding/astar.ts`

export function astar(

nodes: PathfindingNode[],

edges: PathfindingEdge[],

startId: string,

goalId: string

): string[] | null {

const adj = buildAdjacency(nodes, edges);

// gScore = cost from start; fScore = g + Euclidean heuristic to goal

while (open.size > 0) {

const current = /* node with lowest fScore */;

if (current === goalId) return reconstructPath(cameFrom, goalId);

for (const neighbor of adj.get(current) || []) {

const tentative = gScore.get(current)! + neighbor.weight;

if (tentative < (gScore.get(neighbor.nodeId) ?? Infinity)) {

cameFrom.set(neighbor.nodeId, current);

gScore.set(neighbor.nodeId, tentative);

fScore.set(neighbor.nodeId, tentative + euclidean(/* … */, goal));

open.add(neighbor.nodeId);

}

}

}

return null;

}

Appendix I -QR positioning during active navigation

Declaration. Scanning a corridor QR resolves the user to a graph node and can recalculate the remaining route from that position.

Source :`server/src/modules/indoor-navigation/controllers/indoorNavController.ts`

/ POST /indoor-nav/position/qr */

export async function postQrPosition(req: Request, res: Response, next: NextFunction) {

const code = (req.body?.code as string)?.trim();

const position = await resolvePosition('QR_CODE', code);

if (!position) throw new AppError('Unknown or inactive QR code', 404);

const prior = await getActiveSession(userId, node.buildingId);

if (reroute && prior?.destinationNodeId) {

const { formatted } = await computeRouteRequest({

buildingId: node.buildingId,

fromNodeId: position.nodeId,

// destination from active session

});

// update session step index and return new path

}

}

Appendix J - Production deployment screenshots

Purpose: Appendices A–I show *how* key modules are implemented. Appendix J shows that the same artifact runs as a **live production stack** on Oracle Cloud (https://lecstu.com): Node API under PM2, Nginx reverse proxy, PostgreSQL, and HTTPS. Screenshots are operational evidence for RO-5; they are **not** student UI demos (those are Figures 4.11–4.20).

Figure 25: LECSTU project root on the production server

Figure 26: Production runtime versions (Node.js, npm, and PM2)

Figure 27: Active PostgreSQL database service on the host

Figure 28: Valid Nginx reverse-proxy configuration and service status

Figure 29: PM2-managed LECSTU processes

Figure 30: Express API health response

Figure 31: Recent production API logs from PM2.

Figure 32: Host listening ports for HTTP, HTTPS, and the API

Figure 33: Server disk space and memory usage

Figure 34: Live LECSTU site over HTTPS (`https://lecstu.com