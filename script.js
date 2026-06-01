const stages = [
  {
    id: "1",
    title: "IID employees upload the job packet",
    status: "Live intake",
    owner: "SharePoint + Power Automate",
    summary: "The workflow starts when an IID job package containing proposal forms, construction map layouts, tickets, standards, and administrative pages lands in the IID Construction document library.",
    automation: [
      "Watch the relevant SharePoint document-library folder.",
      "Preserve original file name, source path, job number, and ticket number when available.",
      "Skip obvious non-extraction pages before spending model calls."
    ],
    outputs: [
      "Source package in Documents.",
      "Candidate job metadata.",
      "Audit path for downstream artifacts."
    ],
    guardrail: "The source PDF remains the anchor for every downstream SharePoint record, generated PDF, and review item."
  },
  {
    id: "2",
    title: "Classify the PDF as a construction map",
    status: "Managed",
    owner: "iid-openai-extractor",
    summary: "The construction-map agent classifies pages, rejects hard negatives, extracts pole-level work, and returns the structured JSON used to create records.",
    automation: [
      "Classify every page before extraction.",
      "Render construction-map pages at high resolution.",
      "Extract structure IDs, standards, bubble codes, replacement notes, and conductor work."
    ],
    outputs: [
      "Raw JSON with final_structured_output.poles.",
      "Generated construction-map PDF.",
      "Used-item legend."
    ],
    guardrail: "The managed-agent final answer must be raw JSON only so Power Automate can parse it directly."
  },
  {
    id: "3",
    title: "Create Jobs, Structures, and job folders",
    status: "Deterministic",
    owner: "SharePoint relay scripts",
    summary: "Validated extraction results become SharePoint list rows and document-library folders. This write step is handled by scripts, not by model judgment.",
    automation: [
      "Create or update one Jobs row per job number.",
      "Create or update Structures rows for extracted poles.",
      "Ensure the matching job folder exists."
    ],
    outputs: [
      "Jobs row.",
      "Structures rows.",
      "Job folder and construction-map links."
    ],
    guardrail: "Every SharePoint write must be verified by reading back the created or updated component."
  },
  {
    id: "4",
    title: "Run scheduled dig-ticket coordinate automation",
    status: "Scheduled",
    owner: "iid-dig-ticket-extractor",
    summary: "A daily or scheduled reconciliation scans for missing dig-ticket coordinates and selects only eligible work.",
    automation: [
      "Compare source PDFs against existing Locations and Structures.",
      "Skip ticket numbers already present in Locations.",
      "Use native PDF text first, then OCR/model fallback when required."
    ],
    outputs: [
      "Reconciliation plan.",
      "Latitude/longitude extraction targets.",
      "Location rows with ticket/source links."
    ],
    guardrail: "Do not invent structure IDs for work-area coordinates that are not tied to a specific pole."
  },
  {
    id: "5",
    title: "Update Locations and generate the prefielding PDF",
    status: "Live",
    owner: "Prefielding publisher",
    summary: "Structures and Locations are merged into a field packet with routes, source links, construction maps, and prefielding form links.",
    automation: [
      "Match coordinates to structures where the ticket supports it.",
      "Build route-optimized Google Maps links.",
      "Upload the generated PDF and update the Jobs row."
    ],
    outputs: [
      "Prefielding PDF.",
      "Jobs.Prefielding PDF hyperlink.",
      "Input-count snapshots."
    ],
    guardrail: "Route coordinates should be validated and obvious outliers removed before publishing field routes."
  },
  {
    id: "6",
    title: "Assign the job and complete prefielding",
    status: "Operational",
    owner: "Field users + supervisors",
    summary: "The assigned person opens the prefielding PDF, uses the extracted coordinates to find the work area, and completes the linked forms.",
    automation: [
      "Use Jobs as the normal field starting point.",
      "Use Structures for status, schedule, foreman, fielder, map, and form details.",
      "Use Locations for coordinate/source-ticket audit."
    ],
    outputs: [
      "Completed prefield forms.",
      "Updated fielding status.",
      "Exceptions tied to job and structure."
    ],
    guardrail: "Escalations should include job number, structure ID when applicable, source file or ticket, affected SharePoint row/link, and screenshot evidence when helpful."
  },
  {
    id: "7",
    title: "Build tasking/pricing for IID approval",
    status: "Managed",
    owner: "iid-tasking-sheet",
    summary: "The tasking workflow converts construction-map evidence into the IID price-sheet workbook and flags unmapped standards for review.",
    automation: [
      "Write the job number into the invoice tab.",
      "Create one STRUC tab per extracted pole.",
      "Map known standards to price rows and upload the workbook when enabled."
    ],
    outputs: [
      "Tasking/pricing workbook.",
      "Jobs.Tasking Sheet link.",
      "Review notes for unmapped standards."
    ],
    guardrail: "Map bubbles and Excel pricing rows are related but not the same system; pricing must use approved standard mappings."
  },
  {
    id: "8",
    title: "Receive and route IID purchase orders",
    status: "Designed",
    owner: "Outlook relay + Opus 4.8 + SharePoint relay",
    summary: "The PO flow receives an email, downloads direct and nested Outlook attachments, asks Opus 4.8 to identify the job number, and uploads the PDF into the matching job folder.",
    automation: [
      "Power Automate sends the Outlook message pointer, not hand-built attachment branches.",
      "The managed-agent script retrieves attachments through the Outlook relay.",
      "The uploader validates one job folder and uses the binary-safe SharePoint createFile path."
    ],
    outputs: [
      "PO PDFs in Jobs/Distribution/Job <job number>/.",
      "Hash/length verification when possible.",
      "Review queue entries for ambiguity."
    ],
    guardrail: "Fail closed. It is better to quarantine a PO than upload it to the wrong job folder."
  },
  {
    id: "9",
    title: "Order materials and execute post-PO work",
    status: "Gap",
    owner: "Needs process owner",
    summary: "The known business path continues through material ordering, delivery tracking, construction scheduling, completion, closeout, and billing, but that section has not been fully mapped.",
    automation: [
      "Identify material-order owners and systems.",
      "Define material order, delivery, backorder, and substitution fields.",
      "Define the material-ready handoff into scheduling and construction."
    ],
    outputs: [
      "Material order records.",
      "Vendor confirmations.",
      "Delivery and closeout evidence."
    ],
    guardrail: "Do not automate this section until the owners, status fields, and exception paths are explicit."
  },
  {
    id: "10",
    title: "Maintain dashboards, notifications, SOPs, and run control",
    status: "Control loop",
    owner: "Dashboard/export + operators",
    summary: "Dashboard, map, Teams/Outlook notifications, cost telemetry, SOPs, and Jira scope keep the workflow visible and maintainable.",
    automation: [
      "Refresh dashboard/map views from Structures, Locations, and Jobs.",
      "Track managed-agent costs and run telemetry.",
      "Notify operators about success, failures, and review queue items."
    ],
    outputs: [
      "Dashboard and map views.",
      "Run cost records.",
      "SOP and Jira updates."
    ],
    guardrail: "GitHub Pages and role bundles are views; SharePoint remains the system of record."
  }
];

const tabs = document.querySelectorAll("[data-tab]");
const panels = document.querySelectorAll("[data-panel]");
const stageList = document.querySelector(".stage-list");
const detailTitle = document.querySelector("[data-detail-title]");
const detailSummary = document.querySelector("[data-detail-summary]");
const detailAutomation = document.querySelector("[data-detail-automation]");
const detailOutputs = document.querySelector("[data-detail-outputs]");
const detailGuardrail = document.querySelector("[data-detail-guardrail]");
const detailStatus = document.querySelector("[data-detail-status]");
const detailOwner = document.querySelector("[data-detail-owner]");
const mapNodes = document.querySelectorAll("[data-stage]");

function setActiveTab(name) {
  tabs.forEach((tab) => {
    const active = tab.dataset.tab === name;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  });

  panels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.panel === name);
  });
}

function classForStatus(status) {
  const normalized = status.toLowerCase();
  if (normalized.includes("gap")) return "gap";
  if (normalized.includes("designed") || normalized.includes("operational") || normalized.includes("control")) return "partial";
  return "";
}

function renderList(root, items) {
  root.innerHTML = "";
  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    root.appendChild(li);
  });
}

function setStage(id) {
  const stage = stages.find((item) => item.id === String(id)) || stages[0];

  document.querySelectorAll(".stage-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.stageButton === stage.id);
  });

  mapNodes.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.stage === stage.id);
  });

  detailTitle.textContent = `${stage.id}. ${stage.title}`;
  detailSummary.textContent = stage.summary;
  detailStatus.textContent = stage.status;
  detailStatus.className = `status-pill ${classForStatus(stage.status)}`;
  detailOwner.textContent = stage.owner;
  renderList(detailAutomation, stage.automation);
  renderList(detailOutputs, stage.outputs);
  detailGuardrail.textContent = stage.guardrail;
}

function buildStageList() {
  stageList.innerHTML = stages.map((stage) => `
    <button class="stage-button" type="button" data-stage-button="${stage.id}">
      <span>Stage ${stage.id}</span>
      ${stage.title}
    </button>
  `).join("");

  document.querySelectorAll("[data-stage-button]").forEach((button) => {
    button.addEventListener("click", () => setStage(button.dataset.stageButton));
  });
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => setActiveTab(tab.dataset.tab));
});

mapNodes.forEach((button) => {
  button.addEventListener("click", () => {
    setActiveTab("drilldown");
    setStage(button.dataset.stage);
  });
});

buildStageList();
setStage("1");
