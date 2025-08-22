function safeLoadTasks(key = "tasks") {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn("Failed to parse tasks from localStorage — resetting.", err);
    localStorage.removeItem(key);
    return [];
  }
}

function safeSaveTasks(tasks, key = "tasks") {
  try {
    localStorage.setItem(key, JSON.stringify(tasks));
  } catch (err) {
    console.error("Failed to save tasks to localStorage:", err);
  }
}

// ===== Storage =====
let tasks = safeLoadTasks();

// ===== Elements =====
const taskList = document.querySelector(".task-list");
const addTaskForm = document.querySelector(".add-task") || document.querySelector(".task-input");
const addTaskBtn = document.querySelector("#addTaskBtn");

const searchBar = document.getElementById("searchBar");
const statusFilter = document.getElementById("statusFilter");
const dateFilter = document.getElementById("dateFilter");
const dayFilter = document.getElementById("dayFilter");
const priorityFilter = document.getElementById("priorityFilter");
const clearFiltersBtn = document.getElementById("clearFiltersBtn");

// ===== Utilities =====
function save() {
  safeSaveTasks(tasks);
}

function parseTaskDateTime(date, time) {
  // HTML date input -> 'YYYY-MM-DD', time -> 'HH:MM'
  if (!date) return NaN;
  return time ? new Date(`${date}T${time}`) : new Date(date);
}

const MAX_TIMEOUT = 2147483647; // approx 24.8 days

function scheduleReminder(task) {
  if (!task?.date || !task?.time) return;
  const taskDateTime = parseTaskDateTime(task.date, task.time);
  if (isNaN(taskDateTime.getTime())) return;

  const reminderTime = taskDateTime.getTime() - 15 * 60 * 1000;
  let delay = reminderTime - Date.now();

  if (delay <= 0) {
    // Already passed. If it passed recently you might notify immediately (optional).
    return;
  }

  // If delay is bigger than the max allowed timeout, schedule an intermediate re-check.
  if (delay > MAX_TIMEOUT) {
    // Re-check after MAX_TIMEOUT - 1 second to avoid overflow — this keeps us resilient while page is open.
    setTimeout(() => scheduleReminder(task), MAX_TIMEOUT - 1000);
    return;
  }

  setTimeout(() => {
    const msg = `15 minutes remaining for: ${task.title}`;
    if (Notification.permission === "granted") {
      new Notification("⏰ Task Reminder", { body: msg });
    } else {
      // Fallback alert; you could do an in-app banner instead for better UX
      alert(`⏰ ${msg}`);
    }
  }, delay);
}

// ===== Notification Permission on Load =====
document.addEventListener("DOMContentLoaded", () => {
  if ("Notification" in window) {
    if (Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission();
    }
  }

  renderTasks(tasks);

  // Schedule reminders for existing tasks
  tasks.forEach(t => scheduleReminder(t));
});

// ===== Add Task Handler (works for both form submit or button click) =====
function handleAdd(e) {
  if (e) e.preventDefault();

  const titleEl = document.querySelector("#task-title");
  const dateEl = document.querySelector("#task-date");
  const timeEl = document.querySelector("#task-time");
  const priorityEl = document.querySelector("#task-priority");

  const title = (titleEl?.value || "").trim();
  const date = dateEl?.value || "";
  const time = timeEl?.value || "";
  const priority = priorityEl?.value || "";

  if (!title) { alert("Please enter a task title."); return; }
  if (!priority) { alert("Please select a priority."); return; }

  const newTask = {
    // prefer crypto.randomUUID when available for uniqueness
    id: (crypto && crypto.randomUUID) ? crypto.randomUUID() : Date.now(),
    title,
    date,
    time,
    status: "Pending",
    priority
  };

  tasks.push(newTask);
  save();
  scheduleReminder(newTask);
  renderTasks(tasks);

  if (titleEl) titleEl.value = "";
  if (dateEl) dateEl.value = "";
  if (timeEl) timeEl.value = "";
  if (priorityEl) priorityEl.value = "";
}

// Attach add handlers robustly
if (addTaskForm && addTaskForm.tagName === "FORM") {
  addTaskForm.addEventListener("submit", handleAdd);
} else if (addTaskBtn) {
  addTaskBtn.addEventListener("click", handleAdd);
} else {
  const titleEl = document.querySelector("#task-title");
  titleEl?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleAdd(e);
  });
}

// ===== Render Tasks =====
function renderTasks(taskArray) {
  if (!taskList) return;
  taskList.innerHTML = "";

  if (!taskArray || taskArray.length === 0) {
    const p = document.createElement("p");
    p.className = "no-tasks";
    p.textContent = "No tasks match your filters";
    taskList.appendChild(p);
    return;
  }

  taskArray.forEach(task => {
    const li = document.createElement("li");

    // Info (built DOM-safe)
    const info = document.createElement("div");
    info.className = "task-info";

    const titleDiv = document.createElement("div");
    titleDiv.className = "task-title" + (task.status === "Completed" ? " completed" : "");
    titleDiv.textContent = task.title || "";

    const small = document.createElement("small");
    small.textContent = `${task.date || ""} ${task.time || ""} • ${task.status || ""} `;

    const prioritySpan = document.createElement("span");
    const prioClass = (task.priority || "").toString().toLowerCase();
    prioritySpan.className = `priority-badge priority-${prioClass || "none"}`;
    prioritySpan.textContent = task.priority || "-";

    small.appendChild(prioritySpan);
    info.appendChild(titleDiv);
    info.appendChild(small);

    // Actions
    const actions = document.createElement("div");
    actions.className = "task-actions";

    const doneBtn = document.createElement("button");
    doneBtn.type = "button";
    doneBtn.className = "complete";
    doneBtn.textContent = task.status === "Completed" ? "Undo" : "Done";
    doneBtn.setAttribute("aria-label", `${task.status === "Completed" ? "Mark pending" : "Mark completed"}: ${task.title || ""}`);

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "edit";
    editBtn.textContent = "Edit";
    editBtn.setAttribute("aria-label", `Edit: ${task.title || ""}`);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "delete";
    deleteBtn.textContent = "Delete";
    deleteBtn.setAttribute("aria-label", `Delete: ${task.title || ""}`);

    actions.append(doneBtn, editBtn, deleteBtn);
    li.append(info, actions);
    taskList.appendChild(li);

    // Done / Undo
    doneBtn.addEventListener("click", () => {
      task.status = task.status === "Completed" ? "Pending" : "Completed";
      save();
      renderTasks(tasks);
    });

    // Delete
    deleteBtn.addEventListener("click", () => {
      tasks = tasks.filter(t => t.id !== task.id);
      save();
      renderTasks(tasks);
    });

    // Inline Edit (construct safe DOM)
    editBtn.addEventListener("click", () => {
      const editBox = document.createElement("div");
      editBox.className = "task-edit";

      const inputTitle = document.createElement("input");
      inputTitle.type = "text";
      inputTitle.className = "edit-title";
      inputTitle.placeholder = "Title";
      inputTitle.value = task.title || "";

      const inputDate = document.createElement("input");
      inputDate.type = "date";
      inputDate.className = "edit-date";
      inputDate.value = task.date || "";

      const inputTime = document.createElement("input");
      inputTime.type = "time";
      inputTime.className = "edit-time";
      inputTime.value = task.time || "";

      const selectStatus = document.createElement("select");
      selectStatus.className = "edit-status";
      ["Pending", "Completed"].forEach(s => {
        const opt = document.createElement("option");
        opt.value = s;
        opt.textContent = s;
        if (task.status === s) opt.selected = true;
        selectStatus.appendChild(opt);
      });

      const selectPriority = document.createElement("select");
      selectPriority.className = "edit-priority";
      ["low", "medium", "high"].forEach(p => {
        const opt = document.createElement("option");
        opt.value = p;
        opt.textContent = p[0].toUpperCase() + p.slice(1);
        if ((task.priority || "").toLowerCase() === p) opt.selected = true;
        selectPriority.appendChild(opt);
      });

      const saveBtn = document.createElement("button");
      saveBtn.type = "button";
      saveBtn.className = "task-btn"; // ✅ same style as Add Task
      saveBtn.textContent = "Save";

      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "task-btn"; // ✅ same style as Add Task
      cancelBtn.textContent = "Cancel";


      // assemble
      editBox.append(inputTitle, inputDate, inputTime, selectStatus, selectPriority, saveBtn, cancelBtn);

      // Replace li content with editBox temporarily
      li.innerHTML = "";
      li.appendChild(editBox);

      cancelBtn.addEventListener("click", () => renderTasks(tasks));

      saveBtn.addEventListener("click", () => {
        const newTitle = inputTitle.value.trim();
        const newDate = inputDate.value;
        const newTime = inputTime.value;
        const newStatus = selectStatus.value;
        const newPriority = selectPriority.value;

        if (!newTitle) { alert("Title is required."); return; }
        if (!newPriority) { alert("Priority is required."); return; }

        const dateChanged = task.date !== newDate || task.time !== newTime;

        task.title = newTitle;
        task.date = newDate;
        task.time = newTime;
        task.status = newStatus;
        task.priority = newPriority;

        save();

        if (dateChanged) scheduleReminder(task);

        renderTasks(tasks);
      });
    });
  });
}

// ==== Filter Tasks with Priority ====
function startOfDay(d) { const nd = new Date(d); nd.setHours(0, 0, 0, 0); return nd; }
function endOfDay(d) { const nd = new Date(d); nd.setHours(23, 59, 59, 999); return nd; }

function filterTasks() {
  const searchText = (searchBar?.value || "").toLowerCase();
  const statusVal = statusFilter?.value || "all";
  const dateVal = dateFilter?.value || "";
  const dayVal = dayFilter?.value || "all";
  const priorityVal = priorityFilter?.value || "all";

  const filtered = tasks.filter(task => {
    const title = (task.title || "").toLowerCase();
    const matchesSearch = title.includes(searchText);

    const matchesStatus = statusVal === "all" || (task.status || "").toLowerCase() === statusVal.toLowerCase();

    const matchesDate = dateVal === "" || task.date === dateVal;

    const matchesDay = (() => {
      if (dayVal === "all") return true;
      if (!task.date) return false;
      const taskDate = parseTaskDateTime(task.date, task.time || "00:00");
      if (isNaN(taskDate)) return false;

      const today = new Date();
      const startToday = startOfDay(today);

      if (dayVal === "today") {
        return startOfDay(taskDate).getTime() === startToday.getTime();
      }
      if (dayVal === "tomorrow") {
        const tomorrow = new Date(startToday);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return startOfDay(taskDate).getTime() === tomorrow.getTime();
      }
      if (dayVal === "week") {
        const weekEnd = endOfDay(new Date(startToday.getFullYear(), startToday.getMonth(), startToday.getDate() + 7));
        return taskDate >= startToday && taskDate <= weekEnd;
      }
      return true;
    })();

    const matchesPriority = priorityVal === "all" || (task.priority || "").toLowerCase() === priorityVal.toLowerCase();

    return matchesSearch && matchesStatus && matchesDate && matchesDay && matchesPriority;
  });

  renderTasks(filtered);

  if (filtered.length === 0 && taskList) {
    const activeFilters = [];
    if (statusVal !== "all") activeFilters.push(`Status: ${statusVal}`);
    if (dateVal) activeFilters.push(`Date: ${dateVal}`);
    if (dayVal !== "all") activeFilters.push(`Day: ${dayVal}`);
    if (priorityVal !== "all") activeFilters.push(`Priority: ${priorityVal}`);

    taskList.innerHTML = `<p class="no-tasks">No tasks with these filters → ${activeFilters.join(", ")}</p>`;
  }
}

// ==== Attach Filter Events (guard nulls) ====
[searchBar, statusFilter, dateFilter, dayFilter, priorityFilter].filter(Boolean).forEach(el => {
  el.addEventListener("input", filterTasks);
});

// ==== Clear Filters ====
clearFiltersBtn?.addEventListener("click", () => {
  if (searchBar) searchBar.value = "";
  if (statusFilter) statusFilter.value = "all";
  if (dateFilter) dateFilter.value = "";
  if (dayFilter) dayFilter.value = "all";
  if (priorityFilter) priorityFilter.value = "all";
  renderTasks(tasks);
});
