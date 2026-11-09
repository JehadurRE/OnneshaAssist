cmdbc# Onnesha Assessment Arena

An institutional live examination, regional roster verification, and merit evaluation platform for academies, training centers, and competitive exam cohorts.

## Language

### Identity & Organization

**Region**:
A geographical or administrative command zone (such as Dhaka Range, Chattogram Range, or a district center) to which enrolled candidates belong and by which exam sessions and merit lists are segmented.
_Avoid_: Zone, branch, group, division

**Candidate**:
An enrolled examinee registered in the institutional roster under a specific Region with a verified full name, unique Roll Number, and registered Mobile Number.
_Avoid_: Player, student, user, gamer, nickname

**Roll Number**:
The unique institutional or cadet identifier assigned to a Candidate within the roster (e.g., `2026-101`).
_Avoid_: Student ID, user ID, code

**Seat Lock**:
A cryptographic session binding (`seatToken`) that locks a Candidate's identity to a single active device within an Exam Session, preventing anyone else from joining or submitting answers under that Candidate's identity unless unlocked by the Host.
_Avoid_: Duplicate check, session lock

**Host**:
An authenticated instructor, examiner, or invigilator who launches an Exam Session, monitors the Proctor Pulse, controls question progression, and publishes the Merit Gazette.
_Avoid_: Admin, teacher, game master, controller

### Assessment & Evaluation

**Exam Session**:
A live, PIN-gated examination room created from a Quiz, progressing through `lobby`, `countdown`, `question`, `chart`, `leaderboard`, and `podium` phases.
_Avoid_: Game, room, match

**Proctor Incident**:
A timestamped security event recorded when a Candidate switches browser tabs or loses window focus during an active Exam Session, transmitted to the Host and triggering automatic suspension upon reaching the threshold.
_Avoid_: Cheat log, warning, violation

**Merit Gazette**:
The official post-examination ranking report detailing overall and Region-wise candidate scores, accuracy percentages, negative marking deductions, and qualification status.
_Avoid_: Scoreboard, high scores, results list

**Verifiable Certificate**:
A tamper-evident digital credential issued to a Candidate upon completing an Exam Session, identified by a deterministic Certificate Number (`ONN-<PIN>-<ROLL>`) and publicly verifiable via URL/QR.
_Avoid_: Award, badge, diploma
