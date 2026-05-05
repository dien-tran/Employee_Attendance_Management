# User Stories — Employee Attendance Management System (EAMS)

> This document defines the detailed User Stories for the **3 core business flows** of the EAMS project.  
> Each story follows the format: **As a [Role], I want to [Action], so that [Benefit].**  
> Acceptance Criteria use the **"Whenever… then…"** pattern to describe expected system behavior.

---

## 1. Face Attendance (EMP-02)

### 1.1. Face Detection & Verification

As an **Employee**, I want to check in/check out by scanning my face through the camera so that the system can automatically record my attendance without manual input.

- Whenever the employee initiates a face scan (via camera stream or photo upload), then the system shall detect whether the image contains a valid human face.
- Whenever the submitted image does **not** contain a valid human face (e.g., a photo of an object, a blank image), then the system shall reject the request immediately and return a clear error message: *"No valid face detected. Please try again."*
- Whenever a valid face is detected, then the system shall preprocess the face image (alignment, normalization) before proceeding to the embedding step.
- Whenever the face is preprocessed, then the AI Service shall generate a face embedding vector (e.g., `0.12321...`) and perform a similarity search against the stored embeddings in the Vector Database.
- Whenever the AI Service returns a match result with `match: true` and a `confidence` score ≥ the configured threshold (e.g., 0.85), then the system shall identify the employee via the `metadata.id` linked to the MySQL `users.id`.
- Whenever the AI Service returns `match: false` or a `confidence` score below the threshold, then the system shall reject the attendance attempt and return: *"Face not recognized. Please contact your administrator."*

### 1.2. Attendance Recording (Check-in)

As an **Employee**, I want the system to record my check-in time automatically after my face is verified, so that I have an accurate attendance log for the day.

- Whenever the employee's face is successfully verified and no `attendance_record` exists for the current `work_date`, then the system shall create a new record in `attendance_records` with `check_in` set to the current timestamp and `status` determined by company rules (e.g., `present` if on time, `late` if after the configured start time).
- Whenever the employee's face is successfully verified and an `attendance_record` already exists for the current `work_date` with a `check_in` value but **no** `check_out` value, then the system shall update that record by setting `check_out` to the current timestamp.
- Whenever the employee's face is successfully verified and an `attendance_record` already exists for the current `work_date` with **both** `check_in` and `check_out` values already filled, then the system shall reject the request and return: *"Attendance for today has already been fully recorded."*
- Whenever an attendance record is created or updated, then the system shall also insert a raw event into the `attendance_logs` table with the `type` (`check_in` or `check_out`), `recorded_at`, `confidence`, and `method` (default: `face_scan`) for traceability.
- Whenever an attendance record is created or updated, then the `confidence` score returned by the AI Service shall be stored in both `attendance_records.confidence` and `attendance_logs.confidence`.

### 1.3. Attendance Status Determination

As an **Employee**, I want the system to automatically determine my attendance status (present, late, absent, half-day), so that I can see an accurate summary of my work discipline.

- Whenever the `check_in` time is **on or before** the configured company start time (e.g., 08:00 AM), then the `status` shall be set to `present`.
- Whenever the `check_in` time is **after** the configured company start time, then the `status` shall be set to `late`.
- Whenever only `check_in` is recorded and the employee does **not** perform `check_out` by end of day, then the `status` shall remain as-is but the `check_out` field stays `NULL` (Admin can review later).
- Whenever both `check_in` and `check_out` are recorded but total working hours are below the configured minimum (e.g., < 4 hours), then the `status` may be updated to `half-day` (if business rules allow).

---

## 2. Face Registration — Admin Flow (MGR-02)

### 2.1. Admin Authentication

As an **Admin**, I want to log into the system with my credentials, so that I can access the face registration and employee management features.

- Whenever the Admin submits valid `email` and `password` credentials, then the system shall authenticate the user, verify that `role = 'ADMIN'`, and return a valid JWT token.
- Whenever the Admin submits invalid credentials, then the system shall return a `401 Unauthorized` error: *"Invalid email or password."*
- Whenever a non-Admin user (role = `USER`) attempts to access Admin-only endpoints, then the system shall return a `403 Forbidden` error: *"You do not have permission to access this resource."*

### 2.2. Face Data Registration for New Employee

As an **Admin**, I want to register a new employee's face data by having them scan their face at the device, so that they can use face-based attendance going forward.

- Whenever the Admin selects the "Face Registration" function and initiates a face scan for a new employee, then the system shall capture the employee's face image via the camera.
- Whenever the face image is captured, then the AI Service shall generate a face embedding vector from the image.
- Whenever the embedding is generated, then the AI Service shall store the vector in the **Vector Database** with `metadata.id` set to the employee's `users.id` from MySQL, ensuring a permanent link between the face vector and the employee record.
- Whenever the vector is stored successfully in the Vector DB, then the Core Backend shall create or update a record in the `face_data` table in MySQL with:
  - `user_id` → the employee's MySQL `users.id`
  - `image_path` → the path/URL of the stored original face image
  - `embedding_ref` → the reference ID/key of the vector in the Vector DB
  - `registered_at` → the current timestamp
- Whenever the face data registration is complete, then the system shall return a success response to the Admin with the employee's name and registration confirmation.
- Whenever the Admin attempts to register face data for an employee who **already has** face data (i.e., a `face_data` record with the same `user_id` exists), then the system shall prompt whether to **overwrite** the existing data or **cancel** the operation.

### 2.3. Employee Information Entry

As an **Admin**, I want to fill in and save a new employee's profile information (name, email, phone, department, position), so that the employee record is complete in the system before or after face registration.

- Whenever the Admin submits the employee form with all required fields (`name`, `email`, `phone`, `password`, `department_id`), then the system shall create a new record in the `users` table with `role = 'USER'`, `is_active = TRUE`, and `password_hash` generated via bcrypt.
- Whenever the Admin submits an `email` or `phone` that already exists in the `users` table, then the system shall reject the request and return: *"An employee with this email/phone already exists."*
- Whenever the Admin creates a new employee **and** registers their face data in the same session, then both operations shall be wrapped in a **database transaction** to ensure atomicity — if face registration fails, the employee record shall be rolled back.

### 2.4. Update / Delete Face Data

As an **Admin**, I want to update or delete an employee's face data when their appearance changes significantly, so that the face recognition system remains accurate.

- Whenever the Admin triggers a face data update for an existing employee, then the system shall capture a new face image, generate a new embedding, replace the old vector in the Vector DB (same `metadata.id`), and update `face_data.embedding_ref`, `face_data.image_path`, and `face_data.updated_at` in MySQL.
- Whenever the Admin deletes an employee's face data, then the system shall remove the vector from the Vector DB **and** delete the corresponding `face_data` record from MySQL.
- Whenever face data is deleted, then the employee shall no longer be able to check in/out via face scan until new face data is registered.

---

## 3. AI Chatbot (EMP-05)

### 3.1. Chatbot Interaction

As an **Employee**, I want to chat with an AI-powered chatbot to quickly ask questions about my attendance and work information, so that I don't need to manually search through reports or contact HR.

- Whenever the employee sends a message to the chatbot, then the system shall forward the message to the AI Service (Python NLP) along with the employee's `user_id` (extracted from the JWT token) for context.
- Whenever the AI Service processes the message, then it shall return a natural language response that the system relays back to the employee in real time.
- Whenever the chatbot cannot understand the employee's question, then it shall respond with a helpful fallback message: *"I'm sorry, I didn't quite understand your question. You can ask me about your work days, late arrivals, or attendance summary."*

### 3.2. Work Day Inquiry

As an **Employee**, I want to ask the chatbot *"How many days did I work this month?"*, so that I can quickly know my total work days without opening the attendance report.

- Whenever the employee asks about their total work days for a given month (e.g., *"Tháng này làm bao nhiêu ngày?"* or *"How many days did I work this month?"*), then the AI Service shall query the `attendance_records` table:
  ```sql
  SELECT COUNT(*) AS work_days
  FROM attendance_records
  WHERE user_id = {employee_id}
    AND work_date BETWEEN {first_day_of_month} AND {last_day_of_month}
    AND status IN ('present', 'late')
  ```
- Whenever the query returns the result, then the chatbot shall respond with a clear, human-readable answer, e.g., *"You have worked 18 days this month (as of April 24, 2026)."*
- Whenever the employee specifies a different month (e.g., *"How many days did I work in March?"*), then the chatbot shall adjust the date range accordingly.

### 3.3. Late Arrival Inquiry

As an **Employee**, I want to ask the chatbot *"How many minutes was I late today?"*, so that I can be aware of my punctuality.

- Whenever the employee asks about their late arrival (e.g., *"Tôi đi trễ mấy phút hôm nay?"* or *"How late was I today?"*), then the AI Service shall query:
  ```sql
  SELECT check_in, status
  FROM attendance_records
  WHERE user_id = {employee_id}
    AND work_date = CURDATE()
  ```
- Whenever the employee's `check_in` time is **after** the configured company start time, then the chatbot shall calculate the difference in minutes and respond, e.g., *"You were 12 minutes late today. You checked in at 08:12 AM."*
- Whenever the employee's `check_in` time is **on or before** the configured company start time, then the chatbot shall respond: *"You were on time today! You checked in at 07:55 AM."*
- Whenever no `attendance_record` exists for the current date, then the chatbot shall respond: *"No attendance record found for today. You haven't checked in yet."*

### 3.4. General Attendance Summary

As an **Employee**, I want to ask the chatbot about my overall attendance summary (total late days, total absent days), so that I have a quick overview of my attendance performance.

- Whenever the employee asks about their attendance summary (e.g., *"How many times was I late this month?"*), then the AI Service shall query:
  ```sql
  SELECT status, COUNT(*) AS count
  FROM attendance_records
  WHERE user_id = {employee_id}
    AND work_date BETWEEN {first_day_of_month} AND {last_day_of_month}
  GROUP BY status
  ```
- Whenever the query returns results, then the chatbot shall respond with a structured summary, e.g., *"This month: 15 days present, 3 days late, 1 day absent."*

---

## Appendix: Data Store Reference

> This section provides a quick reference for the data stores involved in the 3 core flows above.

| Store | Technology | Purpose | Key Fields |
|---|---|---|---|
| **RDBMS** | MySQL | Employee profiles, attendance records, face metadata, audit logs | `users.id`, `name`, `age`, `department`, `work_day`, etc. |
| **Vector DB** | AI Service (Python) | Face embedding storage & similarity search | `user_id` (metadata), `name` (metadata), embedding vector |

### Data Flow Summary

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FACE ATTENDANCE FLOW                        │
│                                                                     │
│  Camera → Detect Face → Preprocess → Embedding (AI) → Vector Search │
│           ↓ (reject if not human)                    ↓              │
│                                              Match found?           │
│                                          Yes ↓         ↓ No        │
│                                     Record in MySQL   Reject        │
│                                  (attendance_records)               │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                       ADMIN FACE REGISTRATION                       │
│                                                                     │
│  Admin Login → Select Face Registration → Employee Scans Face       │
│                                            ↓                        │
│                                    AI: Generate Embedding            │
│                                            ↓                        │
│                          Store in Vector DB (metadata.id = MySQL ID) │
│                                            ↓                        │
│                          Admin fills Employee Info → Save to MySQL   │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                          AI CHATBOT FLOW                            │
│                                                                     │
│  Employee asks question → AI NLP processes → Query MySQL             │
│       "How many days?"      ↓                    ↓                  │
│       "Late how many min?"  Parse intent    SELECT FROM              │
│                              ↓             attendance_records        │
│                       Generate Response → Return to Employee         │
└─────────────────────────────────────────────────────────────────────┘
```

---

> **Note:** The remaining features (`EMP-01: Login`, `EMP-03: History`, `EMP-04: Dashboard`, `MGR-01: Employee CRUD`, `MGR-03: Update/Delete Face`, `MGR-04: Company Dashboard`) will be added in subsequent iterations.
