# IID Construction Workflows A To Z

Updated: 2026-06-01

This document summarizes the IID construction workflows from job-packet intake through prefielding, tasking/pricing, purchase-order routing, and the unmapped post-PO work. It is written as the durable reference for the SharePoint sidebar quick link named `Workflows`.

Primary SharePoint site:

```text
https://quantaservices.sharepoint.com/sites/IIDConstruction
```

Primary SharePoint data surfaces:

| Surface | Role In Workflow |
| --- | --- |
| `Jobs` | Job-level record, assignee, prefielding PDF link, tasking sheet link, and operational job entry point. |
| `Structures` | Pole/structure records, job number, fielding status, source links, construction map links, schedule/assignment fields, prefield form links, and traffic-control details. |
| `Locations` | Dig-ticket coordinates, ticket numbers, structure/job matching, source PDF links, and Google Maps coordinate links. |
| `Documents` | Source job packets, construction maps, dig tickets, generated construction-map PDFs, prefielding PDFs, tasking sheets, purchase orders, and job folders. |
| `AI Automation Run Costs` | Managed-agent and model-run telemetry for cost, tokens, duration, and business context. |

This document avoids fixed SharePoint counters because live totals can change between automation runs. Refresh SharePoint before quoting production counts.

## 1000-Foot View

IID employees upload a job packet. Automation classifies the construction-map pages, extracts pole-level work, creates the SharePoint job records and folder structure, then scheduled runs enrich the job with dig-ticket coordinates. Field users receive a generated prefielding PDF with routes, source links, and forms. After prefielding, the tasking/pricing workbook is created, IID approves the work, IID releases purchase orders, purchase-order PDFs are routed into the correct job folder, and the remaining material-ordering and execution process is still being formalized.

The workflow should be designed around one consistent pattern:

1. Power Automate detects the event or schedule.
2. A managed agent runs a packaged skill.
3. The managed agent returns raw JSON only.
4. Deterministic scripts validate the JSON, write SharePoint records/files, and read back the result.
5. Field and office users work from the SharePoint `Jobs` list, generated PDFs, and the dashboard.

## Workflow In 10 Stages

### 1. IID Employees Upload The Job Packet

**Trigger:** IID job package PDFs are uploaded into the IID Construction SharePoint document library.

The package can contain cost proposal forms, construction map layouts, USA/Dig Alert tickets, material issue slips, permits, O-Calc pages, standards, and administrative pages. The workflow preserves the original file name, SharePoint source path, job number when available, and ticket number when available.

**System behavior:**

- Watch the relevant SharePoint library/folder path through Power Automate or a scheduled inventory.
- Avoid model calls on obvious skips such as standards-only pages, material slips, permits, or administrative cover pages.
- Maintain the original source PDF as the audit anchor.
- Route every downstream artifact back to the matching job folder.

**Primary outputs:**

- Source package remains in `Documents`.
- Candidate job number and source file metadata are available to the managed-agent workflow.

### 2. Classify The PDF As A Construction Map

**Trigger:** A candidate package needs construction-map extraction.

The managed construction-map agent runs the `iid-openai-extractor` skill. It classifies pages first, rejects hard negatives, renders construction-map pages at high resolution, and extracts pole-level work details using vision. Construction-map pages are not called circuit maps in business-facing language.

**System behavior:**

- Classify each page before extraction.
- Reject dig tickets, standards-only pages, admin pages, cover sheets, permits, material issue slips, and O-Calc pages for construction-map extraction.
- Extract structure IDs, job number, visible bubble codes, standards, pole replacement notes, conductor work, and construction notes.
- Return raw JSON only, with pole records under `final_structured_output.poles`.

**Primary outputs:**

- Structured construction-map JSON.
- Generated construction-map PDF containing the map pages and a compact used-item legend.

### 3. Create Jobs, Structures, And Job Folders

**Trigger:** Construction-map extraction succeeds.

Power Automate or the wrapper script uses the SharePoint relay to create or update the job record, structure records, and folder structure. This is a deterministic write step, not a model decision step.

**System behavior:**

- Create or update one `Jobs` row per job number.
- Create or update one `Structures` row per pole/structure where appropriate.
- Store job number, structure ID, fielding status, source links, construction map links, and generated artifact links.
- Ensure the document-library folder exists under the job folder path.
- Read back each created or updated record to verify the write.

**Primary outputs:**

- `Jobs` row.
- `Structures` rows.
- Job folder under `Documents`.
- Construction-map artifact links.

### 4. Run Scheduled Dig-Ticket Coordinate Automation

**Trigger:** Daily or scheduled automation scans for dig-ticket work.

The coordinate workflow starts with a deterministic planner. It reads configured SharePoint package roots, existing `Locations`, and authoritative `Structures` so only missing coordinate work is extracted.

**System behavior:**

- Query the document library for standalone and embedded dig tickets.
- Skip standalone tickets whose ticket number already exists in `Locations`.
- Select embedded tickets only when the job has no standalone tickets and no existing location rows.
- Require the job to exist in `Structures` before coordinate extraction.
- Run native PDF text extraction first, then OCR or model fallback only when needed.

**Primary outputs:**

- Reconciliation plan.
- Extracted latitude/longitude rows.
- Updated `Locations` rows with source-file traceability.

### 5. Update Locations And Generate The Prefielding PDF

**Trigger:** The job has structures and coordinate evidence, or an existing prefielding PDF needs a metadata-driven refresh.

The prefielding workflow uses `Structures`, `Locations`, and `Jobs` to generate one field packet per eligible job.

**System behavior:**

- Match coordinates to structures when the ticket provides pole-specific locations.
- Preserve job-level or ticket-level coordinates when no structure-specific match is safe.
- Generate route-optimized Google Maps links where coordinates are valid.
- Add construction map links, construction package links, dig-ticket/source links, prefield form links, and coordinate status.
- Upload the PDF into the existing job folder.
- Update the `Jobs.Prefielding PDF` hyperlink and refreshed job metadata.

**Primary outputs:**

- Job-level prefielding PDF.
- Updated `Jobs` row.
- Field packet link ready for assignment.

### 6. Assign The Job And Complete Prefielding

**Trigger:** The job is ready for field review.

Somebody is assigned to the job for prefielding. They open the prefielding PDF, use extracted dig-ticket coordinates to locate the general area, and complete the linked prefielding forms.

**System behavior:**

- Use `Jobs` as the normal field starting point.
- Use `Structures` for structure-level status, assignee, schedule, foreman, map, traffic-control, and form details.
- Use `Locations` for coordinate and source-ticket audit.
- Update fielding status as forms and reviews are completed.

**Primary outputs:**

- Completed prefielding forms.
- Updated status/assignment fields.
- Field notes and exceptions tied back to job number and structure ID.

### 7. Build Tasking And Pricing For IID Approval

**Trigger:** The job has enough extracted construction-map and fielding evidence to price.

The tasking/pricing workflow converts construction-map evidence into the IID pricing workbook. It uses the `iid-tasking-sheet` skill and the packaged `IID PRICE SHEET template.xlsx`.

**System behavior:**

- Accept either the full managed-agent JSON or the inner `final_structured_output`.
- Write the job number into the invoice tab.
- Create one `STRUC (n)` tab per extracted pole.
- Map known standards to price-sheet rows.
- Use `Pole_replace=Yes` for removal.
- Flag unmapped standards, such as observed `PRIM420`, for review rather than silently pricing them.
- Upload the workbook to the matching job folder when publishing is enabled.
- Verify upload by reading back the file and updating the `Jobs.Tasking Sheet` link.

**Primary outputs:**

- Tasking/pricing workbook.
- IID approval package.
- Review notes for unmapped or ambiguous standards.

### 8. Receive And Route IID Purchase Orders

**Trigger:** IID or an internal forward sends purchase-order PDFs by email, including the Carlos Salgado seed case with subject `IID PO's`.

The recommended production pattern keeps Power Automate small. The Outlook trigger sends only the message pointer and metadata to a managed-agent wrapper. The managed-agent script retrieves attachments through the Outlook relay, expands Outlook item attachments when necessary, downloads nested PDFs, and gives each PDF to Opus 4.8 for job-number classification.

**System behavior:**

- Trigger on relevant Outlook email.
- Send one HTTP request with `messageId`, `internetMessageId`, subject, sender, received time, and `hasAttachments`.
- Download and expand attachments deterministically through the Outlook relay.
- Let Opus 4.8 identify the job number from trusted evidence.
- Validate that exactly one `300xxxxx` job candidate exists and that the SharePoint job folder exists.
- Upload only approved PO/requisition PDFs to `Jobs/Distribution/Job <job number>/`.
- Use the SharePoint relay typed `createFile` branch for PDF bytes to avoid corrupting files.
- Verify uploaded length, metadata, and hash when possible.
- Send ambiguous files to review instead of guessing.

**Primary outputs:**

- PO PDFs stored under the correct `Jobs/Distribution/Job <job number>/` folder.
- Review queue items for ambiguous, non-PO, duplicate, or unmatched attachments.

### 9. Order Materials And Execute Post-PO Work

**Trigger:** IID approves the tasking/pricing and releases purchase orders for materials.

This section is acknowledged but not fully mapped in the reviewed workspace. The known business path is that purchase orders are received, materials are ordered, and additional execution steps occur after that. Those downstream steps need a formal inventory of owners, systems, documents, status fields, and exception rules.

**Recommended mapping work:**

- Identify who orders materials and where the order evidence lives.
- Define the material-order status fields required in `Jobs` or a separate list.
- Define whether PO line items need structure-level or job-level matching.
- Decide where vendor confirmations, delivery dates, backorders, substitutions, and receipts are stored.
- Define handoff criteria from material-ready to scheduling/construction.
- Define how final construction completion, closeout, and billing are represented.

**Primary outputs to design next:**

- Material order record.
- Vendor confirmation and delivery tracking.
- Construction scheduling handoff.
- Closeout and billing evidence.

### 10. Maintain Dashboards, Notifications, SOPs, And Run Control

**Trigger:** Any scheduled refresh, job state change, managed-agent run, or operator review.

The dashboard and monitoring layer keeps the workflow visible. SharePoint remains the system of record; GitHub Pages and role bundles are controlled views. Teams and Outlook can carry notifications, project context, and escalation loops.

**System behavior:**

- Refresh dashboard/map views from `Structures`, `Locations`, and `Jobs`.
- Use `Structures.ScheduleDate` as the first calendar source once it is populated.
- Use `Jobs.Prefielding PDF` as the job-level field packet link.
- Use `Locations` latitude/longitude and source-file links for map pins and traceability.
- Track model/runtime cost in `AI Automation Run Costs`.
- Send Outlook or Teams notifications for success, failure, review queue items, and operator prompts.
- Maintain SOPs and Jira scope for changes to the automation.

**Primary outputs:**

- Dashboard and map views.
- Run telemetry and cost records.
- Notifications.
- SOP and Jira updates.

## Critical Data Contracts

| Contract | Rule |
| --- | --- |
| Managed-agent final message | Raw JSON only. No Markdown fences, explanatory prose, or final `status: running` response. |
| Construction-map poles | Pole records must be under `final_structured_output.poles`. |
| SharePoint writes | Scripts must verify writes by reading back the created or updated record, file, folder, or navigation node. |
| PDF uploads | PDF bytes must use the SharePoint relay's typed file-create path or another verified binary-safe upload path. |
| PO routing | Upload only when exactly one job number is found, the job folder exists, and the PDF is a PO or requisition. |
| Ambiguity | Quarantine/review instead of guessing. |
| Source evidence | Preserve original PDF, source file path, ticket number, job number, and hash where possible. |

## Automation Ownership Boundaries

| Layer | Owns |
| --- | --- |
| Power Automate | Trigger, schedule, one HTTP call, and simple notification dispatch. |
| Managed agent | Classification, extraction, reasoning over PDF evidence, and raw JSON output. |
| Deterministic scripts | Attachment retrieval, SharePoint validation, file upload, folder lookup, duplicate handling, and read-back verification. |
| SharePoint | System of record for jobs, structures, locations, folders, field packets, and attachments. |
| Dashboard/GitHub Pages | Readable views and workflow documentation, not the source of record. |

## Known Gaps

| Gap | Impact | Next Decision |
| --- | --- | --- |
| Calendar fields are not populated in the reviewed snapshot. | Accurate calendar views are not production-ready. | Decide whether schedule dates live in `Structures`, Package Tracker, Events, or a dedicated schedule list. |
| SharePoint proposal workbooks had blank unit-cost fields. | Pricing still depends on the local price-sheet template and reviewed workbooks. | Confirm the authoritative price source. |
| `PRIM420` appears in extraction evidence but is not fully priced. | Tasking sheets need review notes for that standard. | Approve a pricing rule or row. |
| Post-PO material ordering is not mapped. | The workflow is clear through PO receipt but not through materials and execution. | Inventory owners, systems, fields, documents, and exception paths. |
| Dashboard role bundles are front-end controlled views. | They are not a server-side security boundary. | Do not publish raw sensitive exports unless intentionally approved. |

## Source Basis

This document is based on local IID workflow artifacts in `/Users/dszilagyi/Documents/PersonalAssistant`, including:

- `IID_FULL_WORKFLOW_SUMMARY.md`
- `output/iid_po_workflow/IID_PO_ROUTING_WORKFLOW.md`
- `iid-dashboard-calendar/data/sharepoint_inventory_summary.json`
- `IID_Construction_Tasking_Review/notes/tasking_file_review.md`
- `IID_Construction_Tasking_Review/bubble_vs_excel_pricing_crosswalk.md`
