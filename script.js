document.addEventListener('DOMContentLoaded', () => {
    let params = new URLSearchParams(document.location.search);
    let API_TOKEN = params.get("token");
    const WORKER_URL = "https://calendrier-api.jordan-toulain.workers.dev";

    const dom = {
        body: document.body,
        notificationContainer: document.getElementById('notification-container'),

        projectView: document.getElementById('project-manager-view'),
        calendarView: document.getElementById('calendar-app-view'),
        upcomingTasksView: document.getElementById('upcoming-tasks-view'),
        upcomingTasksGrid: document.getElementById('upcoming-tasks-grid'),

        showProjectsBtn: document.getElementById('show-projects-btn'),
        showCalendarBtn: document.getElementById('show-calendar-btn'),
        showUpcomingTasksBtn: document.getElementById('show-upcoming-tasks-btn'),

        themeToggle: document.getElementById('theme-toggle'),

        newProjectForm: document.getElementById('new-project-form'),
        newProjectNameInput: document.getElementById('new-project-name'),
        projectList: document.getElementById('project-list'),
        noProjectSelectedView: document.getElementById('no-project-selected'),
        projectContentView: document.getElementById('project-content'),
        projectNameHeader: document.getElementById('project-name-text-header'),
        projectIconHeader: document.getElementById('project-icon-header'),
        deleteProjectBtn: document.getElementById('delete-project-btn'),
        projectDescriptionPreview: document.getElementById('project-description-preview'),
        projectTaskList: document.getElementById('task-list'),
        newTaskForm: document.getElementById('new-task-form'),
        newTaskTextInput: document.getElementById('new-task-text'),
        customizationModalBackdrop: document.getElementById('customization-modal-backdrop'),
        customizationModal: document.getElementById('customization-modal'),
        openCustomizationBtn: document.getElementById('open-customization-btn'),
        closeCustomizationBtn: document.getElementById('close-customization-btn'),
        projectIconInput: document.getElementById('project-icon-input'),
        projectColorInput: document.getElementById('project-color-input'),
        projectDescriptionInput: document.getElementById('project-description-input'),
        deleteModalBackdrop: document.getElementById('delete-modal-backdrop'),
        deleteConfirmModal: document.getElementById('delete-confirm-modal'),
        projectNameToDelete: document.getElementById('project-name-to-delete'),
        cancelDeleteBtn: document.getElementById('cancel-delete-btn'),
        confirmDeleteBtn: document.getElementById('confirm-delete-btn'),

        currentMonthYearEl: document.getElementById('current-month-year'),
        calendarDaysEl: document.getElementById('calendar-days'),
        calendarDayNamesEl: document.getElementById('calendar-day-names'),
        prevMonthBtn: document.getElementById('prev-month-btn'),
        nextMonthBtn: document.getElementById('next-month-btn'),
        taskModalBackdrop: document.getElementById('task-modal-backdrop'),
        taskModal: document.getElementById('task-modal'),
        dayTasksModalBackdrop: document.getElementById('day-tasks-modal-backdrop'),
        dayTasksModal: document.getElementById('day-tasks-modal'),
        confirmModalBackdrop: document.getElementById('confirm-modal-backdrop'),
        confirmModal: document.getElementById('confirm-modal'),
        taskForm: document.getElementById('task-form'),
        dayTasksList: document.getElementById('day-tasks-list'),
        dayTasksTitle: document.getElementById('day-tasks-title'),
        addTaskForDayBtn: document.getElementById('add-task-for-day-btn'),
        taskRecurrenceSelect: document.getElementById('task-recurrence-select'),
        taskRecurrenceEndTypeSelect: document.getElementById('task-recurrence-end-type-select'),
        recurrenceEndDetails: document.getElementById('recurrence-end-details'),
        taskRecurrenceEndDateInput: document.getElementById('task-recurrence-end-date-input'),
        taskRecurrenceEndCountInput: document.getElementById('task-recurrence-end-count-input'),
    };

    let currentView = 'projects';
    let projects = [], activeProjectId = null, projectToDeleteId = null;
    let calendarTasks = [], calendarCurrentDate = new Date(), currentOpenDate = null;
    const todayString = toLocalDateString(new Date());
    let debounceTimer;

    function showNotification(message, type = 'info', duration = 4000) {
        const notif = document.createElement('div');
        notif.className = `notification ${type}`;
        notif.textContent = message;
        dom.notificationContainer.appendChild(notif);
        setTimeout(() => {
            notif.remove();
        }, duration + 500); // +500ms pour l'animation de sortie
    }

    function switchView(viewName) {
        currentView = viewName;
        dom.projectView.classList.toggle('hidden', viewName !== 'projects');
        dom.calendarView.classList.toggle('hidden', viewName !== 'calendar');
        dom.upcomingTasksView.classList.toggle('hidden', viewName !== 'upcoming-tasks');

        dom.showProjectsBtn.classList.toggle('active', viewName === 'projects');
        dom.showCalendarBtn.classList.toggle('active', viewName === 'calendar');
        dom.showUpcomingTasksBtn.classList.toggle('active', viewName === 'upcoming-tasks');
        render();
    }

    const applyTheme = (theme) => {
        dom.body.dataset.theme = theme;
        dom.themeToggle.checked = theme === 'dark';
    };

    async function loadDataFromApi() {
        try {
            const response = await fetch(`${WORKER_URL}?token=${API_TOKEN}`);
            if (!response.ok) {
                const error = await response.json().catch(() => ({error: 'Réponse invalide du serveur'}));
                throw new Error(`Erreur HTTP ${response.status}: ${error.error}`);
            }
            const data = await response.json();
            projects = data.projects || [];
            calendarTasks = data.calendarTasks || [];
            projects.forEach(p => {
                if (p.icon === undefined) p.icon = '📁';
                if (p.color === undefined) p.color = '#4a90e2';
                if (p.description === undefined) p.description = '';
            });
            calendarTasks.forEach(t => {
                if (t.recurrenceEnd === undefined) t.recurrenceEnd = { type: 'never' };
            });
            showNotification("Données chargées avec succès.", "success");
        } catch (error) {
            console.error("Impossible de charger les données depuis l'API:", error);
            showNotification(error.message, "error");
        }
    }

    async function sendApiAction(action, payload) {
        showNotification("Sauvegarde en cours...", "info");
        try {
            const response = await fetch(`${WORKER_URL}?token=${API_TOKEN}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, payload })
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({error: 'Réponse invalide du serveur'}));
                throw new Error(errorData.error || `Erreur HTTP: ${response.status}`);
            }
            console.log(`Action '${action}' réussie.`);
            showNotification("Sauvegarde réussie !", "success");
            return true;
        } catch (error) {
            console.error(`Impossible d'exécuter l'action ${action}:`, error);
            showNotification(`Erreur de sauvegarde: ${error.message}`, 'error');
            return false;
        }
    }
    
    function saveProjects() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => sendApiAction('UPDATE_PROJECTS', projects), 1000);
    }

    function saveCalendarTasks() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => sendApiAction('UPDATE_CALENDAR_TASKS', calendarTasks), 1000);
    }
    
    function createProject(name) {
        const newProject = { id: `proj_${Date.now()}`, name, tasks: [], icon: '📁', color: '#4a90e2', description: '' };
        projects.push(newProject);
        setActiveProject(newProject.id);
        saveProjects();
    }
    function deleteProject(projectId) {
        const index = projects.findIndex(p => p.id === projectId);
        if (index === -1) return;
        const wasActive = activeProjectId === projectId;
        projects.splice(index, 1);
        if (wasActive) {
            let newActiveId = null;
            if (projects.length > 0) newActiveId = projects[index] ? projects[index].id : projects[index - 1]?.id;
            setActiveProject(newActiveId);
        } else {
                render();
        }
        saveProjects();
    }
    function updateProjectDetails(projectId, details) {
        const project = projects.find(p => p.id === projectId);
        if (project) {
            Object.assign(project, details);
            render();
            saveProjects();
        }
    }
    function moveProject(projectId, direction) {
        const index = projects.findIndex(p => p.id === projectId);
        if (index === -1) return;
        if (direction === 'up' && index > 0) {
            [projects[index - 1], projects[index]] = [projects[index], projects[index - 1]];
        } else if (direction === 'down' && index < projects.length - 1) {
            [projects[index + 1], projects[index]] = [projects[index], projects[index + 1]];
        }
        render();
        saveProjects();
    }
    function addProjectTask(projectId, text) {
        const project = projects.find(p => p.id === projectId);
        if (project) {
            project.tasks.push({ id: `task_${Date.now()}`, text, completed: false });
            renderProjectDetails();
            saveProjects();
        }
    }
    function deleteProjectTask(projectId, taskId) {
        const project = projects.find(p => p.id === projectId);
        if (project) {
            project.tasks = project.tasks.filter(t => t.id !== taskId);
            renderProjectDetails();
            saveProjects();
        }
    }
    function toggleProjectTaskCompleted(projectId, taskId) {
        const project = projects.find(p => p.id === projectId);
        if (project) {
            const task = project.tasks.find(t => t.id === taskId);
            if (task) {
                task.completed = !task.completed;
                renderProjectDetails();
                saveProjects();
            }
        }
    }
    function setActiveProject(projectId) {
        activeProjectId = projectId;
        localStorage.setItem('activeProjectId', projectId);
        render();
    }

    function toLocalDateString(date) { return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0]; }
    function fromLocalDateString(dateString) { return new Date(dateString); }
    
    const getTasksForDate = (date) => {
        const tasksForDay = [];
        const checkDate = new Date(date);
        checkDate.setHours(0, 0, 0, 0);

        calendarTasks.forEach(task => {
            if (!task.date) return;
            const taskStartDate = fromLocalDateString(task.date);
            taskStartDate.setHours(0, 0, 0, 0);
            
            if (taskStartDate > checkDate) return;

            let isOccurring = false;
            if (task.recurrence === 'none') {
                if (taskStartDate.getTime() === checkDate.getTime()) isOccurring = true;
            } else {
                if (task.recurrence === 'daily') isOccurring = true;
                else if (task.recurrence === 'weekly' && taskStartDate.getDay() === checkDate.getDay()) isOccurring = true;
                else if (task.recurrence === 'monthly' && taskStartDate.getDate() === checkDate.getDate()) isOccurring = true;
                else if (task.recurrence === 'yearly' && taskStartDate.getDate() === checkDate.getDate() && taskStartDate.getMonth() === checkDate.getMonth()) isOccurring = true;
            }

            if (isOccurring) {
                const end = task.recurrenceEnd || { type: 'never' };
                if (end.type === 'on_date' && end.value) {
                    const endDate = fromLocalDateString(end.value);
                    endDate.setHours(23, 59, 59, 999);
                    if (checkDate > endDate) isOccurring = false;
                } else if (end.type === 'after_count' && end.value) {
                    let occurrences = 0;
                    let tempDate = new Date(taskStartDate);
                    const countLimit = parseInt(end.value);

                    while (tempDate <= checkDate && occurrences <= countLimit) {
                        let isTempDateOccurrence = false;
                        if (task.recurrence === 'daily') isTempDateOccurrence = true;
                        else if (task.recurrence === 'weekly' && tempDate.getDay() === taskStartDate.getDay()) isTempDateOccurrence = true;
                        else if (task.recurrence === 'monthly' && tempDate.getDate() === taskStartDate.getDate()) isTempDateOccurrence = true;
                        else if (task.recurrence === 'yearly' && tempDate.getDate() === taskStartDate.getDate() && tempDate.getMonth() === taskStartDate.getMonth()) isTempDateOccurrence = true;
                        
                        if (isTempDateOccurrence) occurrences++;

                        if (task.recurrence === 'daily') tempDate.setDate(tempDate.getDate() + 1);
                        else if (task.recurrence === 'weekly') tempDate.setDate(tempDate.getDate() + 7);
                        else if (task.recurrence === 'monthly') tempDate.setMonth(tempDate.getMonth() + 1);
                        else if (task.recurrence === 'yearly') tempDate.setFullYear(tempDate.getFullYear() + 1);
                        else break; 
                    }
                    if (occurrences > countLimit) isOccurring = false;
                }
            }
            
            if (isOccurring) tasksForDay.push(task);
        });
        return tasksForDay;
    };

    function render() {
        if (currentView === 'projects') {
            renderProjectList();
            renderProjectDetails();
        } else if (currentView === 'calendar') {
            renderCalendar();
        } else if (currentView === 'upcoming-tasks') {
            renderUpcomingTasks();
        }
    }

    function renderProjectList() {
        dom.projectList.innerHTML = '';
        if (projects.length === 0) {
            dom.projectList.innerHTML = '<li style="color: var(--text-color-light); text-align: center; padding: 1rem;">Aucun projet.</li>';
            return;
        }
        projects.forEach((project, index) => {
            const li = document.createElement('li');
            li.className = 'project-item';
            li.dataset.projectId = project.id;
            li.style.setProperty('--project-color', project.color);
            if (project.id === activeProjectId) li.classList.add('active');
            li.innerHTML = `
                <div class="project-item-name">
                    <span>${project.icon}</span>
                    <span>${project.name}</span>
                </div>
                <div class="project-item-controls">
                    <button class="btn-icon" data-action="move-up" data-project-id="${project.id}" title="Monter" ${index === 0 ? 'disabled' : ''}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M7.41,15.41L12,10.83L16.59,15.41L18,14L12,8L6,14L7.41,15.41Z" fill="currentColor"/></svg>
                    </button>
                    <button class="btn-icon" data-action="move-down" data-project-id="${project.id}" title="Descendre" ${index === projects.length - 1 ? 'disabled' : ''}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z" fill="currentColor"/></svg>
                    </button>
                    <button class="btn-icon delete-btn" data-action="delete" data-project-id="${project.id}" title="Supprimer le projet">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z" fill="currentColor"/></svg>
                    </button>
                </div>`;
            li.addEventListener('click', (e) => {
                const action = e.target.closest('button')?.dataset.action;
                if (action) {
                    e.stopPropagation();
                    const id = e.target.closest('button').dataset.projectId;
                    if (action === 'move-up') moveProject(id, 'up');
                    else if (action === 'move-down') moveProject(id, 'down');
                    else if (action === 'delete') showDeleteModal(id);
                } else {
                    setActiveProject(project.id);
                }
            });
            dom.projectList.appendChild(li);
        });
    }

    function renderProjectDetails() {
        const activeProject = projects.find(p => p.id === activeProjectId);
        if (!activeProject) {
            dom.noProjectSelectedView.style.display = 'flex';
            dom.projectContentView.classList.add('hidden');
        } else {
            dom.noProjectSelectedView.style.display = 'none';
            dom.projectContentView.classList.remove('hidden');
            dom.projectNameHeader.textContent = activeProject.name;
            dom.projectIconHeader.textContent = activeProject.icon;
            dom.projectDescriptionPreview.innerHTML = marked.parse(activeProject.description || '<p><em>Aucune description.</em></p>');
            dom.projectIconInput.value = activeProject.icon;
            dom.projectColorInput.value = activeProject.color;
            dom.projectDescriptionInput.value = activeProject.description;
            dom.projectTaskList.innerHTML = '';
            if (activeProject.tasks.length === 0) {
                dom.projectTaskList.innerHTML = '<li style="color: var(--text-color-light); text-align: center; padding: 1rem;">Aucune tâche pour ce projet.</li>';
            } else {
                activeProject.tasks.slice().sort((a, b) => a.completed - b.completed).forEach(task => {
                    const li = document.createElement('li');
                    li.className = 'project-task-item';
                    if (task.completed) li.classList.add('completed');
                    li.innerHTML = `
                        <input type="checkbox" class="task-checkbox" data-task-id="${task.id}" ${task.completed ? 'checked' : ''}>
                        <span class="task-text">${task.text}</span>
                        <button class="btn-icon" style="margin-left: auto;" data-task-id="${task.id}">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z" fill="currentColor"/></svg>
                        </button>`;
                    li.querySelector('input[type="checkbox"]').addEventListener('change', (e) => toggleProjectTaskCompleted(activeProject.id, e.target.dataset.taskId));
                    li.querySelector('button').addEventListener('click', (e) => deleteProjectTask(activeProject.id, e.currentTarget.dataset.taskId));
                    dom.projectTaskList.appendChild(li);
                });
            }
        }
    }

    function renderCalendar() {
        dom.calendarDaysEl.innerHTML = '';
        const month = calendarCurrentDate.getMonth();
        const year = calendarCurrentDate.getFullYear();
        dom.currentMonthYearEl.textContent = `${calendarCurrentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`;
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        const lastDayOfPrevMonth = new Date(year, month, 0);
        const firstDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;
        const totalCellsForRender = firstDayOfWeek + lastDayOfMonth.getDate();
        const rows = Math.ceil(totalCellsForRender / 7);
        const cellsToAdd = (rows < 6 ? 6 : rows) * 7;
        for (let i = firstDayOfWeek; i > 0; i--) {
            const day = lastDayOfPrevMonth.getDate() - i + 1;
            dom.calendarDaysEl.innerHTML += createDayElement(day, new Date(year, month - 1, day), true);
        }
        for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
            dom.calendarDaysEl.innerHTML += createDayElement(i, new Date(year, month, i), false);
        }
        const remainingCells = cellsToAdd - totalCellsForRender;
        for (let i = 1; i <= remainingCells; i++) {
            dom.calendarDaysEl.innerHTML += createDayElement(i, new Date(year, month + 1, i), true);
        }
    }
    function createDayElement(dayNumber, date, isOtherMonth) {
        const dateString = toLocalDateString(date);
        const tasksOnDay = getTasksForDate(date);
        const isToday = dateString === todayString;
        let tasksHtml = '';
        if (tasksOnDay.length > 0) {
            tasksHtml = `<div class="calendar-task-list">
                ${tasksOnDay.slice(0, 2).map(t => 
                    `<div class="calendar-task-list-item" style="background-color:${t.color}33; border-left: 3px solid ${t.color};">${t.title}</div>`
                ).join('')}
                ${tasksOnDay.length > 2 ? `<div class="more-tasks">+ ${tasksOnDay.length - 2}</div>` : ''}
            </div>`;
        }
        return `<div class="calendar-day ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}" data-date="${dateString}">
                    <div class="day-number">${dayNumber}</div>
                    ${tasksHtml}
                </div>`;
    }
    function renderDayNames() {
        dom.calendarDayNamesEl.innerHTML = '';
        ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].forEach(name => {
            dom.calendarDayNamesEl.innerHTML += `<div class="calendar-day-name">${name}</div>`;
        });
    }
    function createCalendarTaskItemElement(task) {
        const logoHtml = task.logoUrl ? `<img src="${task.logoUrl}" alt="logo" class="task-logo" onerror="this.style.display='none'">` : '<div class="task-logo" style="width:0; margin-right:0;"></div>';
        const amountHtml = task.amount ? `<div class="task-amount">${parseFloat(task.amount).toFixed(2)} €</div>` : '';
        return `<div class="calendar-task-item" data-id="${task.id}">
                    <div class="task-color-bar" style="background-color: ${task.color};"></div>
                    ${logoHtml}
                    <div class="task-details">
                        <div class="task-title">${task.title}</div>
                        <div class="task-description">${task.description || ''}</div>
                    </div>
                    ${amountHtml}
                    <div class="calendar-task-actions"><button class="delete-calendar-task-btn" data-id="${task.id}">&#x1F5D1;</button></div>
                </div>`;
    }
    function renderUpcomingTasks() {
        dom.upcomingTasksGrid.innerHTML = '';
        const upcomingTasks = new Map();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        for (let i = 0; i < 365; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            const tasksOnDay = getTasksForDate(date);
            if (tasksOnDay.length > 0) {
                upcomingTasks.set(toLocalDateString(date), tasksOnDay);
            }
        }
        if (upcomingTasks.size === 0) {
            dom.upcomingTasksGrid.innerHTML = '<p style="text-align:center; padding: 2rem; color: var(--text-color-light); grid-column: 1 / -1;">Aucune tâche à venir.</p>';
            return;
        }
        [...upcomingTasks.entries()].sort((a,b) => a[0].localeCompare(b[0])).forEach(([dateString, tasks]) => {
            const date = fromLocalDateString(dateString);
            const diffTime = date.getTime() - today.getTime();
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

            let countdownText = '';
            if (diffDays === 0) {
                countdownText = "Aujourd'hui";
            } else {
                countdownText = `Dans ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
            }

            const dayGroupEl = document.createElement('div');
            dayGroupEl.className = 'task-day-group';
            
            dayGroupEl.innerHTML = `
                <div class="task-day-group-header">
                    <h3>${date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}</h3>
                    <span class="countdown-tag">${countdownText}</span>
                </div>
            `;
            
            tasks.forEach(task => { dayGroupEl.innerHTML += createCalendarTaskItemElement(task); });
            
            dom.upcomingTasksGrid.appendChild(dayGroupEl);
        });
    }

    function showModal(modal, backdrop) { backdrop.classList.remove('hidden'); modal.classList.remove('hidden'); }
    function hideModal(modal, backdrop) { backdrop.classList.add('hidden'); modal.classList.add('hidden'); }
    function showDeleteModal(projectId) {
        const project = projects.find(p => p.id === projectId);
        if(project) {
            projectToDeleteId = projectId;
            dom.projectNameToDelete.textContent = project.name;
            showModal(dom.deleteConfirmModal, dom.deleteModalBackdrop);
        }
    }
    function openCalendarTaskModal(dateString, task = null) {
        dom.taskForm.reset();
        document.getElementById('task-color-input').value = getComputedStyle(document.documentElement).getPropertyValue('--primary-color');
        if (task) {
            document.getElementById('modal-title').textContent = 'Modifier la Tâche';
            document.getElementById('task-id').value = task.id || '';
            document.getElementById('task-date').value = task.date || dateString;
            document.getElementById('task-title-input').value = task.title || '';
            document.getElementById('task-description-input').value = task.description || '';
            document.getElementById('task-color-input').value = task.color || '#4a90e2';
            document.getElementById('task-logo-input').value = task.logoUrl || '';
            document.getElementById('task-recurrence-select').value = task.recurrence || 'none';
            document.getElementById('task-amount-input').value = task.amount || '';
            const end = task.recurrenceEnd || { type: 'never' };
            dom.taskRecurrenceEndTypeSelect.value = end.type;
            dom.taskRecurrenceEndDateInput.value = end.type === 'on_date' ? end.value : '';
            dom.taskRecurrenceEndCountInput.value = end.type === 'after_count' ? end.value : '';
        } else {
            document.getElementById('modal-title').textContent = 'Ajouter une Tâche';
            document.getElementById('task-id').value = '';
            document.getElementById('task-date').value = dateString;
        }
        dom.taskRecurrenceEndTypeSelect.dispatchEvent(new Event('change'));
        showModal(dom.taskModal, dom.taskModalBackdrop);
    }
    function openDayTasksModal(dateString) {
        currentOpenDate = dateString;
        const date = fromLocalDateString(dateString);
        dom.dayTasksTitle.textContent = `Tâches du ${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`;
        const tasksOnDay = getTasksForDate(date);
        dom.dayTasksList.innerHTML = tasksOnDay.length > 0 ? tasksOnDay.map(task => `<li>${createCalendarTaskItemElement(task)}</li>`).join('') : '<li>Aucune tâche pour ce jour.</li>';
        showModal(dom.dayTasksModal, dom.dayTasksModalBackdrop);
    }
    function showConfirmModal(text, onConfirm) {
        document.getElementById('confirm-text').textContent = text;
        showModal(dom.confirmModal, dom.confirmModalBackdrop);
        const yesBtn = document.getElementById('confirm-btn-yes');
        const noBtn = document.getElementById('confirm-btn-no');
        const handleConfirm = () => { onConfirm(); cleanup(); };
        const handleCancel = () => cleanup();
        const cleanup = () => { 
            hideModal(dom.confirmModal, dom.confirmModalBackdrop); 
            yesBtn.removeEventListener('click', handleConfirm); 
            noBtn.removeEventListener('click', handleCancel); 
        };
        yesBtn.addEventListener('click', handleConfirm, { once: true });
        noBtn.addEventListener('click', handleCancel, { once: true });
    }

    dom.showProjectsBtn.addEventListener('click', () => switchView('projects'));
    dom.showCalendarBtn.addEventListener('click', () => switchView('calendar'));
    dom.showUpcomingTasksBtn.addEventListener('click', () => switchView('upcoming-tasks'));
    
    dom.themeToggle.addEventListener('change', () => {
        const newTheme = dom.themeToggle.checked ? 'dark' : 'light';
        localStorage.setItem('theme', newTheme);
        applyTheme(newTheme);
    });

    dom.newProjectForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = dom.newProjectNameInput.value.trim();
        if (name) { createProject(name); dom.newProjectNameInput.value = ''; }
    });
    dom.newTaskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = dom.newTaskTextInput.value.trim();
        if (text && activeProjectId) { addProjectTask(activeProjectId, text); dom.newTaskTextInput.value = ''; }
    });
    dom.deleteProjectBtn.addEventListener('click', () => { if(activeProjectId) showDeleteModal(activeProjectId); });
    dom.openCustomizationBtn.addEventListener('click', () => showModal(dom.customizationModal, dom.customizationModalBackdrop));
    dom.closeCustomizationBtn.addEventListener('click', () => hideModal(dom.customizationModal, dom.customizationModalBackdrop));
    dom.customizationModalBackdrop.addEventListener('click', () => hideModal(dom.customizationModal, dom.customizationModalBackdrop));
    dom.projectIconInput.addEventListener('blur', () => updateProjectDetails(activeProjectId, { icon: dom.projectIconInput.value }));
    dom.projectColorInput.addEventListener('input', () => updateProjectDetails(activeProjectId, { color: dom.projectColorInput.value }));
    dom.projectDescriptionInput.addEventListener('blur', () => updateProjectDetails(activeProjectId, { description: dom.projectDescriptionInput.value }));
    dom.cancelDeleteBtn.addEventListener('click', () => hideModal(dom.deleteConfirmModal, dom.deleteModalBackdrop));
    dom.deleteModalBackdrop.addEventListener('click', () => hideModal(dom.deleteConfirmModal, dom.deleteModalBackdrop));
    dom.confirmDeleteBtn.addEventListener('click', () => {
        if (projectToDeleteId) {
            deleteProject(projectToDeleteId);
            hideModal(dom.deleteConfirmModal, dom.deleteModalBackdrop);
        }
    });

    dom.prevMonthBtn.addEventListener('click', () => { calendarCurrentDate.setMonth(calendarCurrentDate.getMonth() - 1); renderCalendar(); });
    dom.nextMonthBtn.addEventListener('click', () => { calendarCurrentDate.setMonth(calendarCurrentDate.getMonth() + 1); renderCalendar(); });
    dom.calendarDaysEl.addEventListener('click', (e) => {
        const dayEl = e.target.closest('.calendar-day:not(.other-month)');
        if (dayEl) openDayTasksModal(dayEl.dataset.date);
    });
    dom.taskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const recurrenceEndType = dom.taskRecurrenceEndTypeSelect.value;
        let recurrenceEnd = { type: recurrenceEndType };
        if (recurrenceEndType === 'on_date') {
            recurrenceEnd.value = dom.taskRecurrenceEndDateInput.value;
        } else if (recurrenceEndType === 'after_count') {
            recurrenceEnd.value = dom.taskRecurrenceEndCountInput.value;
        }

        const taskData = {
            id: document.getElementById('task-id').value || `task_${Date.now()}`,
            date: document.getElementById('task-date').value,
            title: document.getElementById('task-title-input').value,
            description: document.getElementById('task-description-input').value,
            color: document.getElementById('task-color-input').value,
            logoUrl: document.getElementById('task-logo-input').value,
            recurrence: document.getElementById('task-recurrence-select').value,
            amount: document.getElementById('task-amount-input').value,
            recurrenceEnd: recurrenceEnd
        };
        const existingTaskIndex = calendarTasks.findIndex(t => t.id === taskData.id);
        if (existingTaskIndex > -1) {
            calendarTasks[existingTaskIndex] = taskData;
        } else {
            calendarTasks.push(taskData);
        }
        saveCalendarTasks();
        render();
        hideModal(dom.taskModal, dom.taskModalBackdrop);
    });
    
    dom.taskRecurrenceEndTypeSelect.addEventListener('change', (e) => {
        const type = e.target.value;
        const showRecurrenceOptions = dom.taskRecurrenceSelect.value !== 'none';
        dom.recurrenceEndDetails.classList.toggle('hidden', !showRecurrenceOptions || type === 'never');
        dom.taskRecurrenceEndDateInput.classList.toggle('hidden', !showRecurrenceOptions || type !== 'on_date');
        dom.taskRecurrenceEndCountInput.classList.toggle('hidden', !showRecurrenceOptions || type !== 'after_count');
    });
    dom.taskRecurrenceSelect.addEventListener('change', () => dom.taskRecurrenceEndTypeSelect.dispatchEvent(new Event('change')));

    dom.addTaskForDayBtn.addEventListener('click', () => {
        hideModal(dom.dayTasksModal, dom.dayTasksModalBackdrop);
        openCalendarTaskModal(currentOpenDate);
    });
    document.body.addEventListener('click', e => {
        const deleteButton = e.target.closest('.delete-calendar-task-btn');
        if (deleteButton) {
            const taskId = deleteButton.dataset.id;
            showConfirmModal('Êtes-vous sûr de vouloir supprimer cette tâche ?', () => {
                calendarTasks = calendarTasks.filter(t => t.id !== taskId);
                saveCalendarTasks();
                render();
                if (!dom.dayTasksModal.classList.contains('hidden') && currentOpenDate) {
                    openDayTasksModal(currentOpenDate);
                }
            });
        }
    });
    [dom.taskModal, dom.dayTasksModal].forEach(modal => {
        modal.querySelector('.close-button').addEventListener('click', () => hideModal(modal, modal.previousElementSibling));
        modal.previousElementSibling.addEventListener('click', () => hideModal(modal, modal.previousElementSibling));
    });
    dom.confirmModalBackdrop.addEventListener('click', () => hideModal(dom.confirmModal, dom.confirmModalBackdrop));

    async function init() {
        applyTheme(localStorage.getItem('theme') || 'light');
        
        await loadDataFromApi();
        
        const savedActiveId = localStorage.getItem('activeProjectId');
        if (savedActiveId && projects.some(p => p.id === savedActiveId)) {
            activeProjectId = savedActiveId;
        } else if (projects.length > 0) {
            activeProjectId = projects[0].id;
        } else {
            activeProjectId = null;
        }
        
        renderDayNames();

        switchView('projects');
    }
    init();
});
