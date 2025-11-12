const KEY = 'projects_data_v1';
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,8);

let data = { projects: [] };

function load(){ try{ const raw = localStorage.getItem(KEY); if(raw) data = JSON.parse(raw); }catch(e){console.error(e);} }
function save(){ localStorage.setItem(KEY, JSON.stringify(data)); }

// format date FR
function fmt(v){ const d = new Date(v); return d.toLocaleString('fr-FR', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }); }

// Projects list rendering (projects.html)
function renderProjectsList(){
	const container = $('#boards-container');
	if(!container) return;
	container.innerHTML = '';
	if(!data.projects.length){
		container.innerHTML = '<div class="empty">Aucun tableau. Cliquez sur + pour en créer un.</div>';
		return;
	}
	const grid = document.createElement('div');
	grid.className = 'projects-grid';
	data.projects.forEach(p=>{
		const card = document.createElement('div');
		card.className = 'card';
		card.onclick = (e)=>{ if(e.target.classList.contains('menu-btn')) return; window.location.href = `project-board.html?id=${p.id}`; };
		if(p.bg) card.innerHTML = `<div class="bg" style="background-image:url('${p.bg.replace(/'/g,"\\'")}')"></div>`;
		card.innerHTML += `<button class="menu-btn" data-id="${p.id}">⋯</button>
			<div class="title">${escapeHtml(p.title)}</div>
			<div class="meta">Créé ${fmt(p.createdAt)}${p.completedAt ? ' • Terminé ' + fmt(p.completedAt) : ''}</div>`;
		grid.appendChild(card);
	});
	container.appendChild(grid);

	// attach menu actions
	$$('.menu-btn').forEach(btn=>{
		btn.addEventListener('click', (ev)=>{
			ev.stopPropagation();
			const id = btn.getAttribute('data-id');
			showBoardModal(findProject(id));
		});
	});
}

// Helpers
function findProject(id){ return data.projects.find(x=>x.id===id); }
function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

// Modal logic (shared) for boards
function showBoardModal(project=null){
	const modal = $('#modal-board');
	if(!modal){
		console.warn('modal-board not found in DOM');
		return;
	}
	try {
		const boardIdEl = $('#board-id');
		const boardTitleEl = $('#board-title');
		const boardBgEl = $('#board-bg');
		const boardCompletedEl = $('#board-completed');
		const modalTitleEl = $('#board-modal-title');
		const delBtn = $('#board-delete');

		if(boardIdEl) boardIdEl.value = project ? project.id : '';
		if(boardTitleEl) boardTitleEl.value = project ? project.title : '';
		if(boardBgEl) boardBgEl.value = project ? (project.bg || '') : '';
		if(boardCompletedEl){
			boardCompletedEl.checked = !!(project && project.completedAt);
		}
		if(modalTitleEl) modalTitleEl.textContent = project ? 'Modifier tableau' : 'Nouveau tableau';
		if(delBtn) {
			if(project) delBtn.style.display = 'inline-block';
			else delBtn.style.display = 'none';
		}

		modal.classList.remove('hidden');
		if(boardTitleEl) boardTitleEl.focus();
	} catch (err) {
		console.error('Error showing board modal:', err);
		modal.classList.remove('hidden');
	}
}
function hideBoardModal(){
	const modal = $('#modal-board');
	if(modal) modal.classList.add('hidden');
	if($('#board-id')) $('#board-id').value = '';
	if($('#board-title')) $('#board-title').value = '';
	if($('#board-bg')) $('#board-bg').value = '';
	if($('#board-completed')) $('#board-completed').checked = false;
}

// CRUD (project) — ensure projects have categories
function createProject(obj){
	const p = {
		id: uid(),
		title: obj.title || 'Sans titre',
		bg: obj.bg || '',
		createdAt: Date.now(),
		completedAt: obj.completed ? Date.now() : null,
		categories: []
	};
	data.projects.push(p); save(); renderAll();
}
function updateProject(id, obj){
	const p = findProject(id); if(!p) return;
	p.title = obj.title || p.title;
	p.bg = obj.bg || '';
	if(obj.completed === true && !p.completedAt) p.completedAt = Date.now();
	if(obj.completed === false) p.completedAt = null;
	save(); renderAll();
}
function deleteProject(id){
	data.projects = data.projects.filter(p=>p.id!==id); save(); renderAll();
}

// Category CRUD inside a project
function createCategory(projectId, title){
	const p = findProject(projectId); if(!p) return;
	p.categories = p.categories || [];
	p.categories.push({ id: uid(), title: title || 'Nouvelle catégorie', tasks: [] });
	save(); renderAll();
}
function updateCategory(projectId, categoryId, title){
	const p = findProject(projectId); if(!p) return;
	const c = (p.categories || []).find(x=>x.id===categoryId); if(!c) return;
	c.title = title || c.title;
	save(); renderAll();
}
function deleteCategory(projectId, categoryId){
	const p = findProject(projectId); if(!p) return;
	p.categories = (p.categories || []).filter(x=>x.id!==categoryId);
	save(); renderAll();
}

// Render categories on board page (updated to render tasks and add-task button)
function renderCategoriesOnBoard(p){
	const container = document.getElementById('board-categories');
	if(!container) return;
	container.innerHTML = '';
	const cats = p.categories || [];
	if(!cats.length){
		container.innerHTML = '<div class="empty">Aucune catégorie. Cliquez sur + Catégorie pour en ajouter une.</div>';
		return;
	}
	const grid = document.createElement('div');
	grid.className = 'categories-grid';
	cats.forEach(c=>{
		const card = document.createElement('div');
		card.className = 'category-card';
		card.dataset.catId = c.id;
		card.innerHTML = `
			<button class="cat-menu" data-id="${c.id}" title="Plus">⋯</button>
			<div class="category-title">${escapeHtml(c.title)}</div>
			<div class="tasks-list" data-cat-id="${c.id}"></div>
			<button class="add-task-btn" data-cat-id="${c.id}">+ Tâche</button>
		`;
		grid.appendChild(card);
	});
	container.appendChild(grid);

	// attach menu handlers (edit/delete category)
	$$('.cat-menu').forEach(btn=>{
		btn.addEventListener('click', (ev)=>{
			ev.stopPropagation();
			const catId = btn.getAttribute('data-id');
			const params = new URLSearchParams(location.search);
			const pid = params.get('id');
			const p = findProject(pid);
			if(!p) return;
			const c = (p.categories||[]).find(x=>x.id===catId);
			showCategoryModalBoard(p.id, c);
		});
	});

	// render tasks for each category, attach task handlers and drag/drop
	cats.forEach(c=>{
		const listEl = container.querySelector(`.tasks-list[data-cat-id="${c.id}"]`);
		if(!listEl) return;
		listEl.innerHTML = '';
		(c.tasks || []).forEach(task=>{
			const ti = document.createElement('div');
			ti.className = 'task-item';
			ti.draggable = true;
			ti.dataset.taskId = task.id;
			// Only show checkbox and title
			ti.innerHTML = `
				<div class="left">
					<input type="checkbox" class="task-complete-toggle" ${task.completed ? 'checked' : ''} data-task-id="${task.id}">
					<div class="title">${escapeHtml(task.title)}</div>
				</div>
			`;
			// attach drag events
			ti.addEventListener('dragstart', (e)=>{
				const payload = JSON.stringify({ pid: p.id, fromCat: c.id, taskId: task.id });
				e.dataTransfer.setData('text/plain', payload);
				e.dataTransfer.effectAllowed = 'move';
				ti.classList.add('dragging');
			});
			ti.addEventListener('dragend', ()=> ti.classList.remove('dragging'));

			// checkbox complete toggle
			ti.querySelector('.task-complete-toggle').addEventListener('change', (ev)=>{
				const checked = !!ev.target.checked;
				updateTaskCompletion(p.id, c.id, task.id, checked);
			});

			// NEW: click on task-item (except on checkbox) shows details
			ti.addEventListener('click', (ev)=>{
				if(ev.target.classList.contains('task-complete-toggle')) return;
				showTaskDetailsModal(task, p.id, c.id);
			});

			listEl.appendChild(ti);
		});

		// attach dragover / drop handlers on category card area
		const catCard = container.querySelector(`.category-card[data-cat-id="${c.id}"]`);
		if(catCard){
			catCard.addEventListener('dragover', (e)=>{
				e.preventDefault();
				catCard.classList.add('drag-over');
			});
			catCard.addEventListener('dragleave', ()=> catCard.classList.remove('drag-over'));
			catCard.addEventListener('drop', (e)=>{
				e.preventDefault();
				catCard.classList.remove('drag-over');
				const raw = e.dataTransfer.getData('text/plain');
				if(!raw) return;
				let payload;
				try{ payload = JSON.parse(raw); } catch(err){ return; }
				const pid = payload.pid;
				const fromCat = payload.fromCat;
				const taskId = payload.taskId;
				const toCat = c.id;
				if(!pid || !taskId) return;
				if(fromCat === toCat) return; // no-op
				moveTask(pid, fromCat, toCat, taskId);
			});
		}
	});

	// add-task button handlers
	$$('.add-task-btn').forEach(btn=>{
		btn.addEventListener('click', (ev)=>{
			ev.stopPropagation();
			const catId = btn.getAttribute('data-cat-id');
			const params = new URLSearchParams(location.search);
			const pid = params.get('id');
			showTaskModalBoard(pid, catId, null);
		});
	});
}

// Task CRUD inside a category (ajout gestion fichiers)
function createTask(projectId, categoryId, obj){
	const p = findProject(projectId); if(!p) return;
	const c = (p.categories||[]).find(x=>x.id===categoryId); if(!c) return;
	c.tasks = c.tasks || [];
	const t = {
		id: uid(),
		title: obj.title || 'Sans titre',
		description: obj.description || '',
		createdAt: obj.createdAt || Date.now(),
		completed: false,
		completedAt: null,
		files: obj.files || []
	};
	c.tasks.push(t);
	save(); renderAll();
}
function updateTask(projectId, categoryId, taskId, obj){
	const p = findProject(projectId); if(!p) return;
	const c = (p.categories||[]).find(x=>x.id===categoryId); if(!c) return;
	const t = (c.tasks||[]).find(x=>x.id===taskId); if(!t) return;
	t.title = obj.title || t.title;
	t.description = obj.description || t.description;
	if(obj.files) t.files = obj.files;
	save(); renderAll();
}
function deleteTask(projectId, categoryId, taskId){
	const p = findProject(projectId); if(!p) return;
	const c = (p.categories||[]).find(x=>x.id===categoryId); if(!c) return;
	c.tasks = (c.tasks||[]).filter(x=>x.id!==taskId);
	save(); renderAll();
}
function moveTask(projectId, fromCategoryId, toCategoryId, taskId){
	const p = findProject(projectId); if(!p) return;
	const from = (p.categories||[]).find(x=>x.id===fromCategoryId);
	const to = (p.categories||[]).find(x=>x.id===toCategoryId);
	if(!from || !to) return;
	const idx = (from.tasks||[]).findIndex(x=>x.id===taskId);
	if(idx === -1) return;
	const [task] = from.tasks.splice(idx,1);
	// ensure categoryId remains logically tied (we don't store categoryId on task here, it's stored by containing array)
	to.tasks = to.tasks || [];
	to.tasks.push(task);
	save(); renderAll();
}

// Toggle completion helper for task (checkbox in list)
function updateTaskCompletion(projectId, categoryId, taskId, checked){
	const p = findProject(projectId); if(!p) return;
	const c = (p.categories||[]).find(x=>x.id===categoryId); if(!c) return;
	const t = (c.tasks||[]).find(x=>x.id===taskId); if(!t) return;
	t.completed = !!checked;
	t.completedAt = t.completed ? Date.now() : null;
	save(); renderAll();
}

// Category modal (board)
function showCategoryModalBoard(projectId, category = null){
	const modal = $('#modal-category-board');
	if(!modal) return;
	const idEl = $('#category-id-board');
	const titleEl = $('#category-title-board');
	const delBtn = $('#category-delete-board');
	if (idEl) idEl.value = category ? category.id : '';
	if (titleEl) titleEl.value = category ? category.title : '';
	$('#category-modal-title-board').textContent = category ? 'Modifier catégorie' : 'Nouvelle catégorie';
	modal.dataset.projectId = projectId;
	if (delBtn) delBtn.style.display = category ? 'inline-block' : 'none';
	modal.classList.remove('hidden');
	if (titleEl) titleEl.focus();
}
function hideCategoryModalBoard(){
	const modal = $('#modal-category-board');
	if(modal) modal.classList.add('hidden');
	if($('#category-id-board')) $('#category-id-board').value = '';
	if($('#category-title-board')) $('#category-title-board').value = '';
	if($('#category-delete-board')) $('#category-delete-board').style.display = 'none';
}

// UI wiring for projects.html
function initProjectsPage(){
	load();
	renderProjectsList();
	// new button
	const add = $('#btn-add-board'); 
	if(add) add.addEventListener('click', ()=> showBoardModal(null));
	// modal handlers
	const form = $('#form-board');
	if(form){
		form.addEventListener('submit', (e)=>{
			e.preventDefault();
			const id = $('#board-id').value;
			const title = $('#board-title').value.trim();
			const bg = $('#board-bg').value.trim();
			const completed = !!$('#board-completed').checked;
			if(!title) return alert('Titre requis');
			if(id) updateProject(id,{title, bg, completed});
			else createProject({title, bg, completed});
			hideBoardModal();
		});
		const cancelBtn = $('#board-cancel');
		if(cancelBtn) cancelBtn.addEventListener('click', (e)=>{
			e.preventDefault();
			hideBoardModal();
		});
		const deleteBtn = $('#board-delete');
		if(deleteBtn) deleteBtn.addEventListener('click', ()=>{
			const id = $('#board-id').value;
			if(!id) return hideBoardModal();
			if(confirm('Supprimer ce tableau ?')){ deleteProject(id); hideBoardModal(); }
		});
	}
}

// Task modal show/hide (affiche les fichiers joints dans le modal d'édition)
function showTaskModalBoard(projectId, categoryId, task = null){
	const modal = $('#modal-task-board');
	if(!modal) return;
	$('#task-id-board').value = task ? task.id : '';
	$('#task-category-id-board').value = categoryId || projectId && categoryId ? categoryId : '';
	$('#task-title-board').value = task ? task.title : '';
	$('#task-desc-board').value = task ? task.description : '';
	$('#task-modal-title-board').textContent = task ? 'Modifier tâche' : 'Nouvelle tâche';
	if($('#task-delete-board')) $('#task-delete-board').style.display = task ? 'inline-block' : 'none';
	const filesInput = $('#task-files-board');
	if(filesInput) filesInput.value = '';
	modal.classList.remove('hidden');
	$('#task-title-board').focus();
}
function hideTaskModalBoard(){
	const modal = $('#modal-task-board');
	if(modal) modal.classList.add('hidden');
	if($('#task-id-board')) $('#task-id-board').value = '';
	if($('#task-category-id-board')) $('#task-category-id-board').value = '';
	if($('#task-title-board')) $('#task-title-board').value = '';
	if($('#task-desc-board')) $('#task-desc-board').value = '';
	if($('#task-delete-board')) $('#task-delete-board').style.display = 'none';
	if($('#task-files-board')) $('#task-files-board').value = '';
}

// Board page logic
function initBoardPage(){
	load();
	const params = new URLSearchParams(location.search);
	const id = params.get('id');
	const p = findProject(id);
	const titleDisplay = document.getElementById('board-title-display');
	if(!p){
		if (titleDisplay) titleDisplay.textContent = 'Tableau introuvable';
		return;
	}
	// render basic info
	if (titleDisplay) titleDisplay.textContent = p.title;
	const createdEl = document.getElementById('board-created');
	if (createdEl) createdEl.textContent = fmt(p.createdAt);
	const completedEl = document.getElementById('board-completed');
	if (completedEl) completedEl.textContent = p.completedAt ? 'Terminé ' + fmt(p.completedAt) : '';
	const bgEl = document.getElementById('board-bg');
	if (p.bg && bgEl) bgEl.style.backgroundImage = `url('${p.bg.replace(/'/g,"\\'")}')`;

	// render categories area
	renderCategoriesOnBoard(p);

	// add category button
	const addCatBtn = document.getElementById('btn-add-category-board');
	if(addCatBtn){
		addCatBtn.onclick = ()=>{
			showCategoryModalBoard(p.id, null);
		};
	}

	// form handlers for category modal
	const formCat = $('#form-category-board');
	if(formCat){
		formCat.onsubmit = (e)=>{
			e.preventDefault();
			const modal = $('#modal-category-board');
			const pid = modal ? modal.dataset.projectId : p.id;
			const cid = $('#category-id-board').value;
			const title = $('#category-title-board').value.trim();
			if(!title) return alert('Titre requis');
			if(cid){
				updateCategory(pid, cid, title);
			} else {
				createCategory(pid, title);
			}
			hideCategoryModalBoard();
		};
		$('#category-cancel-board').onclick = ()=> hideCategoryModalBoard();
		$('#category-delete-board').onclick = ()=>{
			const modal = $('#modal-category-board');
			const pid = modal ? modal.dataset.projectId : p.id;
			const cid = $('#category-id-board').value;
			if(!cid) return hideCategoryModalBoard();
			if(confirm('Supprimer cette catégorie ?')){ deleteCategory(pid, cid); hideCategoryModalBoard(); }
		};
	}

	// edit & complete buttons on board page
	$('#btn-edit-board')?.addEventListener('click', ()=> showBoardModal(p));
	$('#btn-toggle-complete')?.addEventListener('click', ()=>{
		if(p.completedAt){
			if(confirm('Marquer comme non-terminé ?')){ p.completedAt = null; save(); initBoardPage(); renderAll(); }
		} else {
			if(confirm('Marquer comme terminé ?')){ p.completedAt = Date.now(); save(); initBoardPage(); renderAll(); }
		}
	});

	// form handlers for board modal
	const formBoard = $('#form-board');
	if(formBoard){
		formBoard.onsubmit = (e)=>{
			e.preventDefault();
			const idf = $('#board-id').value;
			const title = $('#board-title').value.trim();
			const bg = $('#board-bg').value.trim();
			const completed = !!$('#board-completed').checked;
			if(!title) return alert('Titre requis');
			if(idf) updateProject(idf,{title,bg,completed});
			hideBoardModal();
			initBoardPage();
		};
		$('#board-cancel').onclick = ()=> hideBoardModal();
		$('#board-delete').onclick = ()=>{
			const idf = $('#board-id').value;
			if(!idf) return hideBoardModal();
			if(confirm('Supprimer ce tableau ?')){ deleteProject(idf); hideBoardModal(); window.location.href='projects.html'; }
		};
	}

	// form handlers for task modal
	(function attachTaskModalHandlers(){
		const form = $('#form-task-board');
		if(!form) return;
		form.onsubmit = async (e)=>{
			e.preventDefault();
			const pid = p.id;
			const cid = $('#task-category-id-board').value;
			const tid = $('#task-id-board').value;
			const title = $('#task-title-board').value.trim();
			const desc = $('#task-desc-board').value.trim();
			const filesInput = $('#task-files-board');
			let files = [];
			if(filesInput && filesInput.files.length){
				files = await Promise.all(Array.from(filesInput.files).map(file => {
					return new Promise(resolve => {
						const reader = new FileReader();
						reader.onload = () => resolve({ name: file.name, type: file.type, data: reader.result });
						reader.readAsDataURL(file);
					});
				}));
			}
			if(!title) return alert('Titre requis');
			if(tid){
				updateTask(pid, cid, tid, { title, description: desc, files });
			} else {
				createTask(pid, cid, { title, description: desc, createdAt: Date.now(), files });
			}
			hideTaskModalBoard();
		};
		$('#task-cancel-board').onclick = ()=> hideTaskModalBoard();
		$('#task-delete-board').onclick = ()=>{
			const pid = p.id;
			const cid = $('#task-category-id-board').value;
			const tid = $('#task-id-board').value;
			if(!tid) return hideTaskModalBoard();
			if(confirm('Supprimer cette tâche ?')){ deleteTask(pid, cid, tid); hideTaskModalBoard(); }
		};
	})();
}

// Render all helper (used after mutations)
function renderAll(){
	if(document.getElementById('boards-container')) renderProjectsList();
	if(document.getElementById('board-title-display') && new URL(location).pathname.endsWith('project-board.html')) initBoardPage();
}

// Helper: markdown rendering for details modal (support [ ] and -)
function renderTaskDetailsMarkdown(md) {
	md = String(md || '');
	// Convert [x] or [X] to checked, disabled checkbox
	md = md.replace(/\[\s*[xX]\s*\]/g, '<input type="checkbox" checked disabled style="width:18px;height:18px;margin-right:8px;vertical-align:middle;">');
	// Convert [ ] to unchecked, disabled checkbox
	md = md.replace(/\[\s*\]/g, '<input type="checkbox" disabled style="width:18px;height:18px;margin-right:8px;vertical-align:middle;">');
	// Convert "- " at start of line to <li>
	md = md.replace(/(^|\n)-\s+/g, function(match) {
		return match.replace('- ', '\n<li>');
	});
	// Use marked for markdown (handles lists, line breaks)
	return window.marked ? marked.parse(md, { breaks: true }) : md.replace(/\n/g, '<br>');
}

// Modal task details (affiche les fichiers joints)
function showTaskDetailsModal(task, projectId, categoryId) {
	const modal = document.getElementById('modal-task-details-board');
	if (!modal) return;
	const titleEl = document.getElementById('task-details-title-board');
	const descEl = document.getElementById('task-details-desc-board');
	const filesEl = document.getElementById('task-details-files-board');
	const createdEl = document.getElementById('task-details-created-board');
	const completedEl = document.getElementById('task-details-completed-board');
	const statusEl = document.getElementById('task-details-status-board');
	const editBtn = document.getElementById('task-details-edit-board');
	const delBtn = document.getElementById('task-details-del-board');
	if (titleEl) titleEl.textContent = task.title || '';
	if (descEl) descEl.innerHTML = renderTaskDetailsMarkdown(task.description || '');
	// Affichage des fichiers joints
	if (filesEl) {
		if (task.files && task.files.length) {
			filesEl.innerHTML = '<div style="margin-bottom:4px;font-weight:600;color:#b6e3b6">Documents :</div>' +
				task.files.map(f =>
				 `<a href="${f.data}" download="${f.name}" target="_blank" style="display:inline-block;margin-right:10px;color:var(--accent);text-decoration:underline">${f.name}</a>`
				).join('');
		} else {
			filesEl.innerHTML = '';
		}
	}
	if (createdEl) createdEl.textContent = task.createdAt ? fmt(task.createdAt) : '';
	if (completedEl) completedEl.textContent = task.completedAt ? fmt(task.completedAt) : '';
	if (statusEl) statusEl.textContent = task.completed ? 'Complétée' : 'En cours';
	if (editBtn) {
		editBtn.onclick = ()=> {
			hideTaskDetailsModal();
			showTaskModalBoard(projectId, categoryId, task);
		};
	}
	if (delBtn) {
		delBtn.onclick = ()=> {
			hideTaskDetailsModal();
			if(confirm('Supprimer cette tâche ?')) deleteTask(projectId, categoryId, task.id);
		};
	}
	modal.classList.remove('hidden');
}
function hideTaskDetailsModal() {
	const modal = document.getElementById('modal-task-details-board');
	if (modal) modal.classList.add('hidden');
}

// Expose to global scope ONCE at the end of the file
window.showBoardModal = showBoardModal;
window.hideBoardModal = hideBoardModal;
window.showCategoryModalBoard = showCategoryModalBoard;
window.hideCategoryModalBoard = hideCategoryModalBoard;
window.showTaskModalBoard = showTaskModalBoard;
window.hideTaskModalBoard = hideTaskModalBoard;
window.showTaskDetailsModal = showTaskDetailsModal;
window.hideTaskDetailsModal = hideTaskDetailsModal;
window.initProjectsPage = initProjectsPage;
window.initBoardPage = initBoardPage;

// Boot
document.addEventListener('DOMContentLoaded', ()=>{
	// Ensure + Nouveau always opens modal (fallback)
	const globalAdd = document.getElementById('btn-add-board');
	if (globalAdd) globalAdd.addEventListener('click', ()=> showBoardModal(null));

	// Nouveau : fallback global pour le bouton + Catégorie sur la page du tableau
	const globalAddCategory = document.getElementById('btn-add-category-board');
	if (globalAddCategory) {
		globalAddCategory.addEventListener('click', (e) => {
			// try to get project id from URL and open the category modal
			const params = new URLSearchParams(location.search);
			const pid = params.get('id');
			if (!pid) {
				// nothing to do if we don't know the project
				console.warn('Aucun id de projet trouvé dans l\'URL pour ajouter une catégorie.');
				return;
			}
			showCategoryModalBoard(pid, null);
		});
	}

	if(document.getElementById('boards-container')) initProjectsPage();
	if(document.getElementById('board-title-display') && new URL(location).pathname.endsWith('project-board.html')) initBoardPage();
});