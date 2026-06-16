// ==========================================================================
// INTASIA CLIENTS - CRM APPLICATION LOGIC (app.js)
// ==========================================================================

// Predefined Audit & Dropdown Lists
const WEBSITE_STATUS_OPTIONS = [
  "No Website",
  "Poor Website",
  "Average Website",
  "Good Website",
  "Excellent Website",
  "Ecommerce Website",
  "Poor Ecommerce Website",
  "Website Not Working",
  "Slow Website",
  "Outdated Design",
  "No Mobile Optimization",
  "SEO Issues",
  "Broken Links",
  "Needs Redesign",
  "Needs Speed Optimization",
  "Needs SEO",
  "Landing Page Missing",
  "High Bounce Rate"
];

const SOCIAL_STATUS_OPTIONS = [
  "No Presence",
  "Poor Presence",
  "Average Presence",
  "Good Presence",
  "Excellent Presence",
  "Less Followers",
  "Many Posts Few Followers",
  "Inactive Page",
  "No Engagement",
  "Low Engagement",
  "Good Engagement",
  "No Branding",
  "Poor Branding",
  "Needs Content Strategy",
  "Needs Reels",
  "Needs Ads",
  "Needs Community Building"
];

const LEAD_STATUS_OPTIONS = [
  "Cold Lead",
  "Warm Lead",
  "Hot Lead",
  "Interested",
  "Follow Up Needed",
  "Meeting Scheduled",
  "Proposal Sent",
  "Negotiation",
  "Client Won",
  "Client Lost"
];

// App State
let clients = [];
let activeFilters = {
  websiteStatus: "",
  socialStatus: "",
  leadStatus: "",
  businessType: "",
  dateStart: "",
  dateEnd: "",
  searchQuery: ""
};

// ==========================================================================
// DATABASE / LOCAL STORAGE WRAPPER
// ==========================================================================
const CRM_DB = {
  load() {
    const data = localStorage.getItem("intasia_crm_clients");
    if (data) {
      try {
        clients = JSON.parse(data);
      } catch (e) {
        console.error("Error parsing LocalStorage data, resetting", e);
        clients = [];
      }
    } else {
      // Start with empty state as requested, or seed if user desires.
      clients = [];
    }
  },
  
  save() {
    localStorage.setItem("intasia_crm_clients", JSON.stringify(clients));
  },
  
  add(clientData) {
    const newClient = {
      id: "client_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9),
      dateAdded: new Date().toISOString().split('T')[0],
      timeline: [{
        date: new Date().toISOString().split('T')[0],
        note: "Added to INTASIA CRM database"
      }],
      ...clientData
    };
    clients.push(newClient);
    this.save();
    return newClient;
  },
  
  update(id, clientData) {
    const idx = clients.findIndex(c => c.id === id);
    if (idx !== -1) {
      // Retain timeline & dateAdded
      const prevClient = clients[idx];
      clients[idx] = {
        ...prevClient,
        ...clientData,
        timeline: prevClient.timeline || [{ date: prevClient.dateAdded, note: "Record initialized" }]
      };
      // Log update action in timeline if status changed
      if (prevClient.leadStatus !== clientData.leadStatus) {
        clients[idx].timeline.push({
          date: new Date().toISOString().split('T')[0],
          note: `Lead status updated from "${prevClient.leadStatus}" to "${clientData.leadStatus}"`
        });
      }
      this.save();
      return clients[idx];
    }
    return null;
  },
  
  delete(id) {
    const idx = clients.findIndex(c => c.id === id);
    if (idx !== -1) {
      clients.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  },
  
  logTimeline(id, noteText) {
    const client = clients.find(c => c.id === id);
    if (client) {
      if (!client.timeline) client.timeline = [];
      client.timeline.push({
        date: new Date().toISOString().split('T')[0],
        note: noteText
      });
      this.save();
      return true;
    }
    return false;
  }
};

// ==========================================================================
// DOM ELEMENTS & EVENTS INITIALIZATION
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
  // Load database
  CRM_DB.load();

  // Initialize Custom Searchable Dropdowns
  initSearchableDropdown("web-dropdown-container", "web-status-search", "web-options-list", WEBSITE_STATUS_OPTIONS);
  initSearchableDropdown("social-dropdown-container", "social-status-search", "social-options-list", SOCIAL_STATUS_OPTIONS);

  // Core UI Events
  setupCoreEvents();

  // Initial Render
  renderDashboard();
});

// ==========================================================================
// CORE UI EVENT HANDLERS
// ==========================================================================
function setupCoreEvents() {
  // Add Client Modal triggers
  document.getElementById("add-client-btn").addEventListener("click", () => openClientModal());
  document.getElementById("floating-add-btn").addEventListener("click", () => openClientModal());
  document.getElementById("empty-add-btn").addEventListener("click", () => openClientModal());
  
  // Close modals
  document.getElementById("modal-close-btn").addEventListener("click", closeClientModal);
  document.getElementById("modal-cancel-btn").addEventListener("click", closeClientModal);
  document.getElementById("detail-close-btn").addEventListener("click", closeDetailModal);
  document.getElementById("view-close-btn").addEventListener("click", closeDetailModal);

  // Close when clicking outside modal content
  document.querySelectorAll(".modal-backdrop").forEach(backdrop => {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) {
        closeClientModal();
        closeDetailModal();
      }
    });
  });

  // Modal Tab switching
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
      
      btn.classList.add("active");
      const paneId = btn.getAttribute("data-tab");
      document.getElementById(paneId).classList.add("active");
    });
  });

  // Form Submission
  document.getElementById("client-form").addEventListener("submit", handleFormSubmit);

  // Search & Filters Panel Toggle
  document.getElementById("toggle-filter-btn").addEventListener("click", () => {
    const panel = document.getElementById("filter-panel");
    panel.classList.toggle("hidden");
  });

  // Live Global Search
  document.getElementById("global-search").addEventListener("input", (e) => {
    activeFilters.searchQuery = e.target.value;
    renderDashboard();
  });

  // Filter actions
  document.getElementById("apply-filters-btn").addEventListener("click", () => {
    activeFilters.websiteStatus = document.getElementById("filter-website").value;
    activeFilters.socialStatus = document.getElementById("filter-social").value;
    activeFilters.leadStatus = document.getElementById("filter-lead").value;
    activeFilters.businessType = document.getElementById("filter-business-type").value.trim();
    activeFilters.dateStart = document.getElementById("filter-date-start").value;
    activeFilters.dateEnd = document.getElementById("filter-date-end").value;
    renderDashboard();
  });

  document.getElementById("clear-filters-btn").addEventListener("click", () => {
    document.getElementById("filter-website").value = "";
    document.getElementById("filter-social").value = "";
    document.getElementById("filter-lead").value = "";
    document.getElementById("filter-business-type").value = "";
    document.getElementById("filter-date-start").value = "";
    document.getElementById("filter-date-end").value = "";

    activeFilters = {
      websiteStatus: "",
      socialStatus: "",
      leadStatus: "",
      businessType: "",
      dateStart: "",
      dateEnd: "",
      searchQuery: document.getElementById("global-search").value
    };
    renderDashboard();
  });

  // Log Follow-up Button inside Detail Modal
  document.getElementById("log-followup-btn").addEventListener("click", handleLogFollowupAction);
  document.getElementById("followup-log-input").addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleLogFollowupAction();
  });

  // CSV Export/Import triggers
  document.getElementById("export-csv-btn").addEventListener("click", exportToCSV);
  document.getElementById("import-csv-file").addEventListener("change", handleCSVImport);

  // Alert bar closer
  document.getElementById("close-alert-btn").addEventListener("click", () => {
    document.getElementById("followup-alert-banner").classList.add("hidden");
  });
}

// ==========================================================================
// SEARCHABLE DROPDOWNS ENGINE
// ==========================================================================
function initSearchableDropdown(containerId, inputId, listId, options) {
  const container = document.getElementById(containerId);
  const input = document.getElementById(inputId);
  const list = document.getElementById(listId);

  // Render original options list
  function buildOptions(filterText = "") {
    list.innerHTML = "";
    const cleanFilter = filterText.trim().toLowerCase();
    let exactMatch = false;

    // Filter predefined items
    options.forEach(opt => {
      const match = opt.toLowerCase().includes(cleanFilter);
      if (opt.toLowerCase() === cleanFilter) exactMatch = true;

      if (match || cleanFilter === "") {
        const li = document.createElement("li");
        li.className = "dropdown-option";
        if (input.value === opt) li.classList.add("selected-option");
        li.textContent = opt;
        li.addEventListener("click", () => {
          input.value = opt;
          list.classList.add("hidden");
        });
        list.appendChild(li);
      }
    });

    // Custom option typing handler
    if (cleanFilter !== "" && !exactMatch) {
      const customLi = document.createElement("li");
      customLi.className = "dropdown-option custom-entry-option";
      customLi.textContent = `Use custom: "${filterText}"`;
      customLi.addEventListener("click", () => {
        input.value = filterText;
        list.classList.add("hidden");
      });
      list.appendChild(customLi);
    }
  }

  // Focus / Click input
  input.addEventListener("focus", () => {
    // Hide all other lists first
    document.querySelectorAll(".dropdown-options-list").forEach(el => el.classList.add("hidden"));
    buildOptions(input.value);
    list.classList.remove("hidden");
  });

  // Live filter typing
  input.addEventListener("input", (e) => {
    buildOptions(e.target.value);
  });

  // Click outside listener to collapse
  document.addEventListener("click", (e) => {
    if (!container.contains(e.target)) {
      list.classList.add("hidden");
    }
  });
}

// ==========================================================================
// RENDERING & STATISTICS COMPUTATION
// ==========================================================================
function renderDashboard() {
  // 1. Filter clients
  const filtered = clients.filter(c => {
    // Search Query (matches name, business, notes, contacts)
    if (activeFilters.searchQuery) {
      const q = activeFilters.searchQuery.toLowerCase();
      const matchName = c.name?.toLowerCase().includes(q);
      const matchBiz = c.businessType?.toLowerCase().includes(q);
      const matchPhone = c.phone?.toLowerCase().includes(q);
      const matchEmail = c.email?.toLowerCase().includes(q);
      const matchNotes = c.notes?.toLowerCase().includes(q);
      const matchWeb = c.websiteStatus?.toLowerCase().includes(q);
      const matchSocial = c.socialStatus?.toLowerCase().includes(q);
      
      if (!matchName && !matchBiz && !matchPhone && !matchEmail && !matchNotes && !matchWeb && !matchSocial) {
        return false;
      }
    }

    // Website filter
    if (activeFilters.websiteStatus && c.websiteStatus !== activeFilters.websiteStatus) return false;
    
    // Social filter
    if (activeFilters.socialStatus && c.socialStatus !== activeFilters.socialStatus) return false;

    // Lead Status filter
    if (activeFilters.leadStatus && c.leadStatus !== activeFilters.leadStatus) return false;

    // Business Type filter (partial match)
    if (activeFilters.businessType && !c.businessType?.toLowerCase().includes(activeFilters.businessType.toLowerCase())) return false;

    // Date range filter
    if (activeFilters.dateStart && c.dateAdded < activeFilters.dateStart) return false;
    if (activeFilters.dateEnd && c.dateAdded > activeFilters.dateEnd) return false;

    return true;
  });

  // Sort: show newer additions first
  filtered.sort((a, b) => b.id.localeCompare(a.id));

  // 2. Render counts & tags
  renderActiveFilterTags();
  calculateStats();

  // 3. Render list views
  renderTable(filtered);
  renderMobileCards(filtered);
  renderRemindersSidebar();

  // Toggle Empty State illustration
  const emptyPanel = document.getElementById("empty-state-panel");
  const tableEl = document.getElementById("client-table-element");
  
  if (filtered.length === 0) {
    emptyPanel.classList.remove("hidden");
    tableEl.style.display = "none";
  } else {
    emptyPanel.classList.add("hidden");
    tableEl.style.display = "table";
  }

  // Update Visible badge
  document.getElementById("visible-count-badge").textContent = `${filtered.length} visible`;
}

function calculateStats() {
  const total = clients.length;
  
  const cold = clients.filter(c => c.leadStatus === "Cold Lead").length;
  const warm = clients.filter(c => c.leadStatus === "Warm Lead").length;
  const hot = clients.filter(c => c.leadStatus === "Hot Lead").length;

  const noWeb = clients.filter(c => c.websiteStatus === "No Website").length;
  
  // Poor social media: check against subset of negative audit tags
  const poorSocialKeywords = ["No Presence", "Poor Presence", "Inactive Page", "No Engagement", "Low Engagement", "Poor Branding"];
  const poorSocial = clients.filter(c => poorSocialKeywords.includes(c.socialStatus)).length;

  // Update DOM numbers
  document.getElementById("stat-total-clients").textContent = total;
  document.getElementById("stat-cold-leads").textContent = cold;
  document.getElementById("stat-warm-leads").textContent = warm;
  document.getElementById("stat-hot-leads").textContent = hot;
  document.getElementById("stat-no-website").textContent = noWeb;
  document.getElementById("stat-poor-social").textContent = poorSocial;

  // Highlight Overdue Follow-ups banner alerts
  const todayStr = new Date().toISOString().split('T')[0];
  const overdueCount = clients.filter(c => c.followUpDate && c.followUpDate < todayStr && c.leadStatus !== "Client Won" && c.leadStatus !== "Client Lost").length;
  
  const banner = document.getElementById("followup-alert-banner");
  const alertText = document.getElementById("followup-alert-text");
  
  if (overdueCount > 0) {
    banner.classList.remove("hidden");
    alertText.innerHTML = `Attention! You have <strong>${overdueCount}</strong> overdue client follow-up reminder${overdueCount > 1 ? 's' : ''}. Check the schedule list to take action.`;
    document.getElementById("aside-reminder-dot").classList.remove("hidden");
  } else {
    banner.classList.add("hidden");
    document.getElementById("aside-reminder-dot").classList.add("hidden");
  }
}

function renderActiveFilterTags() {
  const container = document.getElementById("active-filters-tags");
  container.innerHTML = "";

  const entries = [
    { key: "websiteStatus", label: "Web: " },
    { key: "socialStatus", label: "Social: " },
    { key: "leadStatus", label: "Lead: " },
    { key: "businessType", label: "Biz: " },
    { key: "dateStart", label: "From: " },
    { key: "dateEnd", label: "To: " }
  ];

  entries.forEach(item => {
    const val = activeFilters[item.key];
    if (val) {
      const tag = document.createElement("span");
      tag.className = "filter-tag";
      tag.innerHTML = `${item.label} <strong>${val}</strong>`;
      
      const close = document.createElement("span");
      close.className = "filter-tag-close";
      close.innerHTML = " &times;";
      close.addEventListener("click", () => {
        activeFilters[item.key] = "";
        
        // Reset DOM input fields
        if (item.key === "websiteStatus") document.getElementById("filter-website").value = "";
        if (item.key === "socialStatus") document.getElementById("filter-social").value = "";
        if (item.key === "leadStatus") document.getElementById("filter-lead").value = "";
        if (item.key === "businessType") document.getElementById("filter-business-type").value = "";
        if (item.key === "dateStart") document.getElementById("filter-date-start").value = "";
        if (item.key === "dateEnd") document.getElementById("filter-date-end").value = "";

        renderDashboard();
      });
      
      tag.appendChild(close);
      container.appendChild(tag);
    }
  });
}

// ==========================================================================
// DESKTOP TABLE RENDERER
// ==========================================================================
function renderTable(list) {
  const tbody = document.getElementById("client-table-body");
  tbody.innerHTML = "";

  list.forEach(c => {
    const tr = document.createElement("tr");
    tr.addEventListener("click", (e) => {
      // Prevent detail modal popup when clicking action buttons
      if (e.target.closest("button") || e.target.closest("a")) return;
      openDetailModal(c.id);
    });

    // 1. Client Info cell
    const nameTd = document.createElement("td");
    nameTd.innerHTML = `
      <div class="client-info-cell">
        <span class="client-name-bold">${escapeHTML(c.name)}</span>
        <span class="client-business-sub">${escapeHTML(c.businessType || "Unclassified")}</span>
      </div>
    `;

    // 2. Website status cell
    const webTd = document.createElement("td");
    const webBadgeClass = getWebsiteBadgeClass(c.websiteStatus);
    webTd.innerHTML = `<span class="badge ${webBadgeClass}">${escapeHTML(c.websiteStatus || "No Website")}</span>`;

    // 3. Social media status cell
    const socialTd = document.createElement("td");
    const socialBadgeClass = getSocialBadgeClass(c.socialStatus);
    socialTd.innerHTML = `<span class="badge ${socialBadgeClass}">${escapeHTML(c.socialStatus || "No Presence")}</span>`;

    // 4. Contact details cell
    const contactTd = document.createElement("td");
    contactTd.innerHTML = `
      <div class="contact-cell-row">
        ${c.phone ? `<a href="tel:${c.phone}" class="contact-cell-link" title="Call Client">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
          <span>${escapeHTML(c.phone)}</span>
        </a>` : ""}
        ${c.email ? `<a href="mailto:${c.email}" class="contact-cell-link" title="Email Client">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
          <span>${escapeHTML(c.email)}</span>
        </a>` : ""}
        <div class="contact-social-icons">
          ${c.websiteUrl ? `<a href="${c.websiteUrl}" target="_blank" class="social-circle-link" title="Visit Website"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg></a>` : ""}
          ${c.instagramLink ? `<a href="${c.instagramLink}" target="_blank" class="social-circle-link" title="Instagram Profile"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg></a>` : ""}
          ${c.facebookLink ? `<a href="${c.facebookLink}" target="_blank" class="social-circle-link" title="Facebook Page"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg></a>` : ""}
        </div>
      </div>
    `;

    // 5. Lead status cell
    const leadTd = document.createElement("td");
    const leadBadgeClass = getLeadBadgeClass(c.leadStatus);
    leadTd.innerHTML = `<span class="badge badge-lead ${leadBadgeClass}">${escapeHTML(c.leadStatus)}</span>`;

    // 6. Last follow up cell
    const followupTd = document.createElement("td");
    const scheduleDate = c.followUpDate || "Not Scheduled";
    const dateStatusBadge = getFollowUpDateBadge(scheduleDate, c.leadStatus);
    followupTd.innerHTML = `
      <div class="followup-alert-cell">
        <span class="followup-date-text">${scheduleDate}</span>
        ${dateStatusBadge ? `<span class="badge ${dateStatusBadge.class}">${dateStatusBadge.text}</span>` : ""}
      </div>
    `;

    // 7. Priority cell
    const priorityTd = document.createElement("td");
    const prioClass = getPriorityClass(c.priorityLevel);
    priorityTd.innerHTML = `<span class="badge ${prioClass}">${escapeHTML(c.priorityLevel || "Medium")}</span>`;

    // 8. Action buttons cell
    const actionTd = document.createElement("td");
    actionTd.className = "table-actions";
    
    const viewBtn = document.createElement("button");
    viewBtn.className = "btn-table";
    viewBtn.textContent = "View";
    viewBtn.addEventListener("click", () => openDetailModal(c.id));

    const editBtn = document.createElement("button");
    editBtn.className = "btn-table";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => openClientModal(c.id));

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn-table btn-table-delete";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => handleDeleteClient(c.id));

    actionTd.appendChild(viewBtn);
    actionTd.appendChild(editBtn);
    actionTd.appendChild(deleteBtn);

    tr.appendChild(nameTd);
    tr.appendChild(webTd);
    tr.appendChild(socialTd);
    tr.appendChild(contactTd);
    tr.appendChild(leadTd);
    tr.appendChild(followupTd);
    tr.appendChild(priorityTd);
    tr.appendChild(actionTd);

    tbody.appendChild(tr);
  });
}

// ==========================================================================
// MOBILE CARDS GRID RENDERER
// ==========================================================================
function renderMobileCards(list) {
  const container = document.getElementById("client-cards-grid");
  container.innerHTML = "";

  list.forEach(c => {
    const card = document.createElement("div");
    card.className = "client-mobile-card";
    card.addEventListener("click", (e) => {
      if (e.target.closest("button") || e.target.closest("a")) return;
      openDetailModal(c.id);
    });

    const webBadge = getWebsiteBadgeClass(c.websiteStatus);
    const socialBadge = getSocialBadgeClass(c.socialStatus);
    const leadBadge = getLeadBadgeClass(c.leadStatus);
    const prioBadge = getPriorityClass(c.priorityLevel);
    const dateBadge = getFollowUpDateBadge(c.followUpDate, c.leadStatus);

    card.innerHTML = `
      <div class="card-header-row">
        <div>
          <h3 class="client-name-bold" style="font-size: 1rem;">${escapeHTML(c.name)}</h3>
          <small style="color: #71717A; font-weight: 500;">${escapeHTML(c.businessType || "Unspecified")}</small>
        </div>
        <span class="badge badge-lead ${leadBadge}">${escapeHTML(c.leadStatus)}</span>
      </div>

      <div class="card-body-row">
        <div>
          <span>Website Audit</span>
          <span class="badge ${webBadge}" style="align-self: flex-start; margin-top: 2px;">${escapeHTML(c.websiteStatus || "No Website")}</span>
        </div>
        <div>
          <span>Social Media</span>
          <span class="badge ${socialBadge}" style="align-self: flex-start; margin-top: 2px;">${escapeHTML(c.socialStatus || "No Presence")}</span>
        </div>
        <div>
          <span>Follow-up Date</span>
          <span style="font-weight: 500; font-size: 0.8rem; margin-top: 2px;">
            ${escapeHTML(c.followUpDate || "Not Set")}
            ${dateBadge ? `<span class="badge ${dateBadge.class}" style="font-size:0.65rem; padding: 1px 4px; display:inline-block;">${dateBadge.text}</span>` : ""}
          </span>
        </div>
        <div>
          <span>Priority Level</span>
          <span class="badge ${prioBadge}" style="align-self: flex-start; margin-top: 2px;">${escapeHTML(c.priorityLevel || "Medium")}</span>
        </div>
      </div>

      <div class="card-footer-row">
        <button class="btn btn-secondary btn-sm edit-card-btn">Edit</button>
        <button class="btn btn-secondary-outline btn-sm delete-card-btn" style="color: var(--color-danger); border-color: rgba(239,68,68,0.2);">Delete</button>
        <button class="btn btn-accent btn-sm view-card-btn">View Profile</button>
      </div>
    `;

    // Bind footer button actions
    card.querySelector(".edit-card-btn").addEventListener("click", () => openClientModal(c.id));
    card.querySelector(".delete-card-btn").addEventListener("click", () => handleDeleteClient(c.id));
    card.querySelector(".view-card-btn").addEventListener("click", () => openDetailModal(c.id));

    container.appendChild(card);
  });
}

// ==========================================================================
// REMINDERS SIDEBAR SYSTEM
// ==========================================================================
function renderRemindersSidebar() {
  const listContainer = document.getElementById("schedule-list");
  listContainer.innerHTML = "";

  const todayStr = new Date().toISOString().split('T')[0];

  // Filter out won/lost if followups completed, show scheduled
  const activeReminders = clients.filter(c => c.followUpDate && c.leadStatus !== "Client Won" && c.leadStatus !== "Client Lost");
  
  // Sort by date (oldest first to emphasize overdue items)
  activeReminders.sort((a, b) => a.followUpDate.localeCompare(b.followUpDate));

  if (activeReminders.length === 0) {
    listContainer.innerHTML = `<div class="reminder-empty">All follow-ups complete! No pending reminders.</div>`;
    return;
  }

  activeReminders.forEach(c => {
    const item = document.createElement("div");
    item.className = "reminder-item";
    item.addEventListener("click", () => openDetailModal(c.id));

    const badgeInfo = getFollowUpDateBadge(c.followUpDate, c.leadStatus);
    let tagClass = "tag-green";
    let tagText = "Upcoming";

    if (badgeInfo) {
      if (badgeInfo.text === "Overdue") {
        tagClass = "tag-red";
        tagText = "Overdue";
      } else if (badgeInfo.text === "Today") {
        tagClass = "tag-orange";
        tagText = "Today";
      }
    }

    item.innerHTML = `
      <div class="reminder-header">
        <span class="reminder-name">${escapeHTML(c.name)}</span>
        <span class="reminder-tag ${tagClass}">${tagText}</span>
      </div>
      <div class="reminder-meta">
        <span>${escapeHTML(c.businessType || "Business")}</span>
        <span style="font-weight: 600;">${escapeHTML(c.followUpDate)}</span>
      </div>
    `;
    listContainer.appendChild(item);
  });
}

// ==========================================================================
// CLIENT EDIT / ADD FLOW
// ==========================================================================
function openClientModal(clientId = null) {
  const form = document.getElementById("client-form");
  form.reset();

  // Reset tab to general
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
  document.querySelector('.tab-btn[data-tab="tab-general"]').classList.add("active");
  document.getElementById("tab-general").classList.add("active");

  const title = document.getElementById("modal-title");
  const idInput = document.getElementById("client-id");

  // Pre-populate fields if editing
  if (clientId) {
    title.textContent = "Edit Client Profile";
    const c = clients.find(item => item.id === clientId);
    if (c) {
      idInput.value = c.id;
      document.getElementById("client-name").value = c.name || "";
      document.getElementById("business-type").value = c.businessType || "";
      document.getElementById("lead-status").value = c.leadStatus || "Warm Lead";
      document.getElementById("phone-number").value = c.phone || "";
      document.getElementById("email-address").value = c.email || "";
      document.getElementById("website-url").value = c.websiteUrl || "";
      document.getElementById("instagram-link").value = c.instagramLink || "";
      document.getElementById("facebook-link").value = c.facebookLink || "";
      document.getElementById("follow-up-date").value = c.followUpDate || "";
      document.getElementById("priority-level").value = c.priorityLevel || "Medium";
      
      // Customs/Audits
      document.getElementById("web-status-search").value = c.websiteStatus || "";
      document.getElementById("social-status-search").value = c.socialStatus || "";
      document.getElementById("audit-report").value = c.auditReport || "";
      document.getElementById("pain-points").value = c.painPoints || "";
      document.getElementById("recommended-services").value = c.recommendedServices || "";
      document.getElementById("budget-notes").value = c.budgetNotes || "";
      document.getElementById("notes").value = c.notes || "";
    }
  } else {
    title.textContent = "Add New Client";
    idInput.value = "";
    // Default next follow up date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById("follow-up-date").value = tomorrow.toISOString().split('T')[0];
  }

  document.getElementById("client-modal").classList.remove("hidden");
}

function closeClientModal() {
  document.getElementById("client-modal").classList.add("hidden");
}

function handleFormSubmit(e) {
  e.preventDefault();

  const id = document.getElementById("client-id").value;
  
  const clientData = {
    name: document.getElementById("client-name").value.trim(),
    businessType: document.getElementById("business-type").value.trim(),
    leadStatus: document.getElementById("lead-status").value,
    phone: document.getElementById("phone-number").value.trim(),
    email: document.getElementById("email-address").value.trim(),
    websiteUrl: document.getElementById("website-url").value.trim(),
    instagramLink: document.getElementById("instagram-link").value.trim(),
    facebookLink: document.getElementById("facebook-link").value.trim(),
    followUpDate: document.getElementById("follow-up-date").value,
    priorityLevel: document.getElementById("priority-level").value,
    
    // Audits
    websiteStatus: document.getElementById("web-status-search").value.trim() || "No Website",
    socialStatus: document.getElementById("social-status-search").value.trim() || "No Presence",
    auditReport: document.getElementById("audit-report").value.trim(),
    painPoints: document.getElementById("pain-points").value.trim(),
    recommendedServices: document.getElementById("recommended-services").value.trim(),
    budgetNotes: document.getElementById("budget-notes").value.trim(),
    notes: document.getElementById("notes").value.trim()
  };

  if (id) {
    CRM_DB.update(id, clientData);
  } else {
    CRM_DB.add(clientData);
  }

  closeClientModal();
  renderDashboard();
}

function handleDeleteClient(clientId) {
  const c = clients.find(item => item.id === clientId);
  if (!c) return;

  if (confirm(`Are you sure you want to permanently delete the profile for "${c.name}"?`)) {
    CRM_DB.delete(clientId);
    renderDashboard();
    closeDetailModal(); // Close detail view if open
  }
}

// ==========================================================================
// CLIENT DETAIL (VIEW PROFILE) PAGE / MODAL
// ==========================================================================
let currentViewClientId = null;

function openDetailModal(clientId) {
  const c = clients.find(item => item.id === clientId);
  if (!c) return;

  currentViewClientId = clientId;

  // Header Title details
  document.getElementById("view-client-name").textContent = c.name;
  document.getElementById("view-business-badge").textContent = c.businessType || "Unclassified";
  
  // Lead Badge
  const leadBadge = document.getElementById("view-lead-badge");
  leadBadge.textContent = c.leadStatus;
  leadBadge.className = `badge badge-lead ${getLeadBadgeClass(c.leadStatus)}`;
  
  // Priority Badge
  const prioBadge = document.getElementById("view-priority-badge");
  prioBadge.textContent = `${c.priorityLevel || "Medium"} Priority`;
  prioBadge.className = `badge badge-priority ${getPriorityClass(c.priorityLevel)}`;

  // Audits cards
  document.getElementById("view-web-status").textContent = c.websiteStatus || "No Website";
  document.getElementById("view-web-status").className = `status-indicator-label ${getWebsiteBadgeClass(c.websiteStatus)}`;
  document.getElementById("view-web-report").textContent = c.auditReport || "No detailed website report logged.";

  document.getElementById("view-social-status").textContent = c.socialStatus || "No Presence";
  document.getElementById("view-social-status").className = `status-indicator-label ${getSocialBadgeClass(c.socialStatus)}`;
  document.getElementById("view-social-report").textContent = c.auditReport || "No detailed social statistics logged.";

  // Agency report block
  document.getElementById("view-pain-points").textContent = c.painPoints || "No pain points specified.";
  document.getElementById("view-recommended").textContent = c.recommendedServices || "No services recommended yet.";
  document.getElementById("view-budget").textContent = c.budgetNotes || "Not specified";
  document.getElementById("view-date-added").textContent = c.dateAdded || "Not set";
  document.getElementById("view-detailed-notes").textContent = c.notes || "No additional comments added.";

  // Contact details sidebar
  document.getElementById("view-phone").textContent = c.phone || "No phone recorded";
  document.getElementById("view-email").textContent = c.email || "No email recorded";

  // Contact Links (Web, Instagram, Facebook)
  setupSocialButtonLink("view-web-link", c.websiteUrl);
  setupSocialButtonLink("view-instagram-link", c.instagramLink);
  setupSocialButtonLink("view-facebook-link", c.facebookLink);

  // Follow up Widget
  const followUpEl = document.getElementById("view-followup-date");
  followUpEl.textContent = c.followUpDate || "Not Scheduled";
  
  const followUpBadge = document.getElementById("view-followup-badge");
  const badgeInfo = getFollowUpDateBadge(c.followUpDate, c.leadStatus);
  if (badgeInfo) {
    followUpBadge.textContent = badgeInfo.text;
    followUpBadge.className = `badge ${badgeInfo.class}`;
    followUpBadge.style.display = "inline-flex";
  } else {
    followUpBadge.style.display = "none";
  }

  // Clear logging field
  document.getElementById("followup-log-input").value = "";

  // Render Timeline/History
  renderTimeline(c.timeline);

  // Edit Button action inside view page
  // Replace previous listeners to prevent duplicates
  const editBtn = document.getElementById("view-edit-btn");
  const newEditBtn = editBtn.cloneNode(true);
  editBtn.parentNode.replaceChild(newEditBtn, editBtn);
  newEditBtn.addEventListener("click", () => {
    closeDetailModal();
    openClientModal(c.id);
  });

  document.getElementById("detail-modal").classList.remove("hidden");
}

function closeDetailModal() {
  document.getElementById("detail-modal").classList.add("hidden");
  currentViewClientId = null;
}

function setupSocialButtonLink(elementId, linkUrl) {
  const btn = document.getElementById(elementId);
  if (linkUrl) {
    btn.setAttribute("href", linkUrl);
    btn.removeAttribute("disabled");
    btn.style.opacity = "1";
    btn.style.pointerEvents = "auto";
  } else {
    btn.removeAttribute("href");
    btn.setAttribute("disabled", "true");
    btn.style.opacity = "0.3";
    btn.style.pointerEvents = "none";
  }
}

function renderTimeline(timelineArray = []) {
  const container = document.getElementById("timeline-container");
  container.innerHTML = "";

  if (timelineArray.length === 0) {
    container.innerHTML = `<div class="timeline-empty" style="font-size:0.75rem; color:#A1A1AA;">No activity logged.</div>`;
    return;
  }

  // Sort timeline chronologically descending (newest activity at the top)
  const sortedTimeline = [...timelineArray].sort((a, b) => b.date.localeCompare(a.date));

  sortedTimeline.forEach(event => {
    const el = document.createElement("div");
    el.className = "timeline-event";
    el.innerHTML = `
      <span class="event-date">${event.date}</span>
      <span class="event-content">${escapeHTML(event.note)}</span>
    `;
    container.appendChild(el);
  });
}

function handleLogFollowupAction() {
  const input = document.getElementById("followup-log-input");
  const text = input.value.trim();
  
  if (!text || !currentViewClientId) return;

  // Append history
  CRM_DB.logTimeline(currentViewClientId, text);
  
  // Refresh detail window timeline
  const updatedClient = clients.find(c => c.id === currentViewClientId);
  if (updatedClient) {
    renderTimeline(updatedClient.timeline);
  }

  input.value = "";
  renderDashboard(); // Refresh background tables & counts
}

// ==========================================================================
// CSV IMPORT & EXPORT SERVICE
// ==========================================================================
function exportToCSV() {
  if (clients.length === 0) {
    alert("There are no client records to export.");
    return;
  }

  // Header row matching fields requested
  const headers = [
    "Client Name", "Business Type", "Website Status", "Social Media Status", 
    "Phone Number", "Email", "Website URL", "Instagram Link", "Facebook Link", 
    "Lead Status", "Next Follow-Up Date", "Priority Level", "Date Added", 
    "Budget Notes", "Pain Points", "Recommended Services", "Internal Notes", "Audit Report"
  ];

  let csvContent = headers.map(h => `"${h.replace(/"/g, '""')}"`).join(",") + "\n";

  clients.forEach(c => {
    const row = [
      c.name || "",
      c.businessType || "",
      c.websiteStatus || "",
      c.socialStatus || "",
      c.phone || "",
      c.email || "",
      c.websiteUrl || "",
      c.instagramLink || "",
      c.facebookLink || "",
      c.leadStatus || "Warm Lead",
      c.followUpDate || "",
      c.priorityLevel || "Medium",
      c.dateAdded || "",
      c.budgetNotes || "",
      c.painPoints || "",
      c.recommendedServices || "",
      c.notes || "",
      c.auditReport || ""
    ];

    csvContent += row.map(val => `"${val.replace(/"/g, '""')}"`).join(",") + "\n";
  });

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `intasia_clients_export_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function handleCSVImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    const text = evt.target.result;
    const importedRows = parseCSV(text);
    
    if (importedRows.length <= 1) {
      alert("Invalid or empty CSV file uploaded.");
      return;
    }

    const headers = importedRows[0].map(h => h.trim().toLowerCase());
    
    // Mapping keys helper
    let successCount = 0;
    
    for (let i = 1; i < importedRows.length; i++) {
      const row = importedRows[i];
      if (row.length === 0 || (row.length === 1 && row[0] === "")) continue;

      // Extract details by searching header matches
      const client = {
        name: getCSVValue(headers, row, ["client name", "name", "client / business name"]) || "Imported Lead",
        businessType: getCSVValue(headers, row, ["business type", "business", "type"]) || "",
        websiteStatus: getCSVValue(headers, row, ["website status", "website audit status", "web status"]) || "No Website",
        socialStatus: getCSVValue(headers, row, ["social media status", "social status", "social media"]) || "No Presence",
        phone: getCSVValue(headers, row, ["phone number", "phone", "tel"]) || "",
        email: getCSVValue(headers, row, ["email address", "email", "mail"]) || "",
        websiteUrl: getCSVValue(headers, row, ["website url", "website", "url"]) || "",
        instagramLink: getCSVValue(headers, row, ["instagram link", "instagram"]) || "",
        facebookLink: getCSVValue(headers, row, ["facebook link", "facebook"]) || "",
        leadStatus: getCSVValue(headers, row, ["lead status", "status"]) || "Cold Lead",
        followUpDate: getCSVValue(headers, row, ["next follow-up date", "followup date", "follow up date"]) || new Date().toISOString().split('T')[0],
        priorityLevel: getCSVValue(headers, row, ["priority level", "priority"]) || "Medium",
        budgetNotes: getCSVValue(headers, row, ["budget notes", "budget"]) || "",
        painPoints: getCSVValue(headers, row, ["pain points", "painpoints"]) || "",
        recommendedServices: getCSVValue(headers, row, ["recommended marketing services", "recommended services", "services"]) || "",
        notes: getCSVValue(headers, row, ["internal notes", "notes", "notes & history"]) || "",
        auditReport: getCSVValue(headers, row, ["audit report", "report", "audit overview"]) || ""
      };

      // Add record to memory
      CRM_DB.add(client);
      successCount++;
    }

    alert(`Successfully imported ${successCount} client records!`);
    renderDashboard();
    e.target.value = ""; // Reset file selector
  };

  reader.readAsText(file);
}

// Custom CSV Parser to handle double-quotes and commas properly
function parseCSV(text) {
  const lines = [];
  let row = [""];
  let insideQuote = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuote && nextChar === '"') {
        // Escaped quote
        row[row.length - 1] += '"';
        i++; // skip next quote
      } else {
        // Toggle quote block
        insideQuote = !insideQuote;
      }
    } else if (char === ',' && !insideQuote) {
      row.push("");
    } else if ((char === '\r' || char === '\n') && !insideQuote) {
      if (char === '\r' && nextChar === '\n') i++; // skip extra newline chars
      lines.push(row);
      row = [""];
    } else {
      row[row.length - 1] += char;
    }
  }
  
  if (row.length > 1 || row[0] !== "") {
    lines.push(row);
  }
  
  return lines;
}

function getCSVValue(headers, row, potentialNames) {
  for (const name of potentialNames) {
    const idx = headers.indexOf(name);
    if (idx !== -1 && idx < row.length) {
      return row[idx].trim();
    }
  }
  return "";
}

// ==========================================================================
// COLOR HELPER METHODS & UTILS
// ==========================================================================
function getWebsiteBadgeClass(status) {
  if (!status) return "status-neutral";
  const st = status.toLowerCase();
  if (st.includes("excellent") || st.includes("good") || st.includes("ecommerce")) return "status-good";
  if (st.includes("average") || st.includes("needs redesigned") || st.includes("needs red")) return "status-average";
  return "status-poor"; // Slow, poor, broken, none, SEO issues
}

function getSocialBadgeClass(status) {
  if (!status) return "status-neutral";
  const st = status.toLowerCase();
  if (st.includes("excellent") || st.includes("good") || st.includes("engagement")) return "status-good";
  if (st.includes("average") || st.includes("followers")) return "status-average";
  return "status-poor"; // Inactive, no presence, low branding, reels needed
}

function getLeadBadgeClass(status) {
  switch (status) {
    case "Cold Lead": return "lead-cold";
    case "Warm Lead": return "lead-warm";
    case "Hot Lead": return "lead-hot";
    case "Client Won": return "lead-won";
    case "Client Lost": return "lead-lost";
    default: return "lead-cold";
  }
}

function getPriorityClass(prio) {
  switch (prio) {
    case "High": return "priority-high";
    case "Medium": return "priority-medium";
    case "Low": return "priority-low";
    default: return "priority-medium";
  }
}

function getFollowUpDateBadge(dateStr, leadStatus) {
  if (!dateStr || leadStatus === "Client Won" || leadStatus === "Client Lost") return null;

  const todayStr = new Date().toISOString().split('T')[0];
  if (dateStr < todayStr) {
    return { text: "Overdue", class: "followup-badge-overdue" };
  } else if (dateStr === todayStr) {
    return { text: "Today", class: "followup-badge-today" };
  } else {
    return { text: "Upcoming", class: "followup-badge-upcoming" };
  }
}

function escapeHTML(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
