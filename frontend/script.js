/**
 * Main Application Orchestrator & View Switcher
 */

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Enforce Authentication & Role
  if (!Auth.initProtection()) {
    return;
  }

  // 2. Setup Navigation Routing
  setupNavigation();

  // 3. Setup Mobile Sidebar
  setupMobileSidebar();

  // 4. Setup Departments Management
  setupDepartments();

  // 5. Setup Availability Checker
  setupAvailabilityChecker();

  // 6. Setup Settings Module
  setupSettings();

  // 7. Initial Module Boot
  const defaultTab = window.location.hash.replace('#', '') || 'dashboard';
  switchView(defaultTab);
});

/**
 * Handle sidebar navigation clicks
 */
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item[data-view]');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const viewName = item.getAttribute('data-view');
      switchView(viewName);
    });
  });

  // Logout button
  document.getElementById('btn-logout')?.addEventListener('click', () => {
    UI.confirm('Log Out', 'Are you sure you want to end your session?', () => {
      Auth.logout();
    });
  });
}

/**
 * Switch active view panel and update sidebar active state
 */
function switchView(viewName) {
  const panels = document.querySelectorAll('.view-panel');
  const navItems = document.querySelectorAll('.nav-item[data-view]');

  let targetPanel = document.getElementById(`view-${viewName}`);
  if (!targetPanel) {
    viewName = 'dashboard';
    targetPanel = document.getElementById('view-dashboard');
  }

  panels.forEach(p => p.classList.remove('active'));
  navItems.forEach(n => n.classList.remove('active'));

  targetPanel.classList.add('active');

  const activeNav = document.querySelector(`.nav-item[data-view="${viewName}"]`);
  if (activeNav) activeNav.classList.add('active');

  // Update Breadcrumb
  const breadcrumbEl = document.getElementById('breadcrumb-current');
  if (breadcrumbEl) {
    breadcrumbEl.textContent = viewName.charAt(0).toUpperCase() + viewName.slice(1).replace('-', ' ');
  }

  window.location.hash = viewName;

  // Initialize specific view when navigated
  if (viewName === 'dashboard') {
    if (window.Dashboard) Dashboard.init();
  } else if (viewName === 'rooms') {
    if (window.Rooms) Rooms.init();
  } else if (viewName === 'allocations') {
    if (window.Allocations) Allocations.init();
  } else if (viewName === 'timetable') {
    if (window.Timetable) Timetable.init();
  } else if (viewName === 'departments') {
    loadDepartmentsList();
  } else if (viewName === 'reports') {
    if (window.Reports) Reports.init();
  } else if (viewName === 'settings') {
    loadSettingsData();
  }

  // Close mobile sidebar if open
  document.getElementById('sidebar')?.classList.remove('open');
}

/**
 * Mobile sidebar toggle
 */
function setupMobileSidebar() {
  const toggleBtn = document.getElementById('mobile-menu-toggle');
  const sidebar = document.getElementById('sidebar');

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }
}

/**
 * Departments Management Module
 */
function setupDepartments() {
  const form = document.getElementById('dept-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('dept-form-id').value;
      const payload = {
        name: document.getElementById('dept-form-name').value.trim(),
        code: document.getElementById('dept-form-code').value.trim().toUpperCase(),
        head_name: document.getElementById('dept-form-head').value.trim(),
        email: document.getElementById('dept-form-email').value.trim(),
        phone: document.getElementById('dept-form-phone').value.trim(),
        description: document.getElementById('dept-form-desc').value.trim()
      };

      try {
        if (id) {
          await API.put(`/departments/${id}`, payload);
          UI.showToast('success', 'Department updated successfully.');
        } else {
          await API.post('/departments', payload);
          UI.showToast('success', 'Department created successfully.');
        }
        UI.closeModal('modal-dept');
        loadDepartmentsList();
      } catch (err) {
        UI.showToast('error', err.message || 'Failed to save department.');
      }
    });
  }
}

async function loadDepartmentsList() {
  const container = document.getElementById('departments-container');
  if (!container) return;
  UI.showLoading(container);

  try {
    const res = await API.get('/departments');
    if (res.success && res.departments) {
      if (res.departments.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No departments found.</p></div>';
        return;
      }

      const isAdmin = Auth.isAdmin();

      container.className = 'table-responsive';
      container.innerHTML = `
        <table class="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Department Name</th>
              <th>Head of Department</th>
              <th>Contact Email</th>
              <th>Rooms</th>
              <th>Faculty</th>
              <th>Active Classes</th>
              ${isAdmin ? '<th>Actions</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${res.departments.map(d => `
              <tr>
                <td><span class="badge" style="background: #eff6ff; color: #1e40af;">${d.code}</span></td>
                <td><strong>${d.name}</strong></td>
                <td>${d.head_name || '—'}</td>
                <td>${d.email || '—'}</td>
                <td>${d.room_count || 0}</td>
                <td>${d.faculty_count || 0}</td>
                <td>${d.active_allocations || 0}</td>
                ${isAdmin ? `
                  <td>
                    <div style="display: flex; gap: 0.35rem;">
                      <button type="button" class="btn btn-secondary btn-sm" onclick="editDepartment(${d.id})">Edit</button>
                      <button type="button" class="btn btn-danger btn-sm" onclick="deleteDepartment(${d.id}, '${d.name}')">Del</button>
                    </div>
                  </td>
                ` : ''}
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
  } catch (err) {
    UI.showToast('error', 'Could not load departments.');
  }
}

window.openAddDeptModal = () => {
  document.getElementById('dept-form').reset();
  document.getElementById('dept-form-id').value = '';
  document.getElementById('modal-dept-title').textContent = 'Add Department';
  UI.openModal('modal-dept');
};

window.editDepartment = async (id) => {
  try {
    const res = await API.get(`/departments/${id}`);
    if (res.success && res.department) {
      const d = res.department;
      document.getElementById('dept-form-id').value = d.id;
      document.getElementById('dept-form-name').value = d.name;
      document.getElementById('dept-form-code').value = d.code;
      document.getElementById('dept-form-head').value = d.head_name || '';
      document.getElementById('dept-form-email').value = d.email || '';
      document.getElementById('dept-form-phone').value = d.phone || '';
      document.getElementById('dept-form-desc').value = d.description || '';
      document.getElementById('modal-dept-title').textContent = `Edit Department ${d.code}`;
      UI.openModal('modal-dept');
    }
  } catch (e) {
    UI.showToast('error', 'Failed to fetch department info.');
  }
};

window.deleteDepartment = (id, name) => {
  UI.confirm('Delete Department', `Are you sure you want to delete department "${name}"?`, async () => {
    try {
      await API.delete(`/departments/${id}`);
      UI.showToast('success', `Department "${name}" deleted.`);
      loadDepartmentsList();
    } catch (err) {
      UI.showToast('error', err.message || 'Could not delete department.');
    }
  });
};

/**
 * Dedicated Availability Checker Module
 */
function setupAvailabilityChecker() {
  const form = document.getElementById('availability-check-form');
  const today = new Date().toISOString().split('T')[0];
  const dateInput = document.getElementById('avail-date');
  if (dateInput && !dateInput.value) dateInput.value = today;

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const resultsContainer = document.getElementById('availability-results');
      UI.showLoading(resultsContainer);

      const requiredEquipment = [];
      document.querySelectorAll('input[name="avail-equipment"]:checked').forEach(cb => {
        requiredEquipment.push(cb.value);
      });

      const params = {
        date: document.getElementById('avail-date').value,
        start_time: document.getElementById('avail-start-time').value,
        end_time: document.getElementById('avail-end-time').value,
        min_capacity: document.getElementById('avail-capacity').value || 0,
        room_type: document.getElementById('avail-type').value || '',
        equipment: requiredEquipment.length > 0 ? JSON.stringify(requiredEquipment) : ''
      };

      try {
        const res = await API.get('/rooms/availability', params);
        if (res.success) {
          renderAvailabilityResults(res, params);
        }
      } catch (err) {
        UI.showToast('error', err.message || 'Availability search failed.');
        resultsContainer.innerHTML = '';
      }
    });
  }
}

function renderAvailabilityResults(res, query) {
  const container = document.getElementById('availability-results');
  if (!container) return;

  const rooms = res.rooms || [];
  const isAdmin = Auth.isAdmin();

  container.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem;">
      <div>
        <h3>Availability Results for ${query.date} (${query.start_time} - ${query.end_time})</h3>
        <p style="font-size: 0.85rem;">Found <strong>${res.availableCount} Available</strong> and <strong>${res.occupiedCount} Occupied / In Maintenance</strong></p>
      </div>
    </div>

    <div class="rooms-grid">
      ${rooms.map(r => `
        <div class="room-card" style="${!r.isAvailable ? 'opacity: 0.75; background: #fafaf9;' : ''}">
          <div>
            <div class="room-card-header">
              <span class="room-num">${r.room_number}</span>
              <span class="badge ${r.isAvailable ? 'badge-available' : 'badge-cancelled'}">
                ${r.isAvailable ? 'Available' : 'Unavailable'}
              </span>
            </div>
            <div class="room-card-name">${r.room_name}</div>
            <div class="room-details-list">
              <span>📍 ${r.building} • Floor ${r.floor}</span>
              <span>🏷️ ${r.room_type} • <strong>${r.capacity} Seats</strong></span>
              ${r.conflicts && r.conflicts.length > 0 ? `
                <div style="color: var(--color-danger); font-size: 0.75rem; background: var(--color-danger-bg); padding: 0.4rem; border-radius: var(--radius-sm); margin-top: 0.35rem;">
                  ⚠️ ${r.conflicts[0].message}
                </div>
              ` : ''}
            </div>
          </div>

          <div class="room-card-actions">
            ${r.isAvailable && isAdmin ? `
              <button type="button" class="btn btn-primary btn-sm" onclick="quickBookFromAvailability(${r.id}, '${r.room_number}', '${query.date}', '${query.start_time}', '${query.end_time}')">
                Allocate Now
              </button>
            ` : ''}
            <button type="button" class="btn btn-secondary btn-sm" onclick="Rooms.viewDetails(${r.id})">Details</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

window.quickBookFromAvailability = (roomId, roomNumber, date, start, end) => {
  switchView('allocations');
  document.getElementById('alloc-room').value = roomId;
  document.getElementById('alloc-date').value = date;
  document.getElementById('alloc-start-time').value = start;
  document.getElementById('alloc-end-time').value = end;
  document.getElementById('tab-alloc-manual').click();
  UI.showToast('info', `Room ${roomNumber} pre-selected for ${start}-${end}. Complete course details.`);
};

/**
 * Settings Module
 */
function setupSettings() {
  // Institutional Settings Form (Admin Only)
  const settingsForm = document.getElementById('settings-form');
  if (settingsForm) {
    settingsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        institution_name: document.getElementById('setting-name').value.trim(),
        institution_code: document.getElementById('setting-code').value.trim(),
        academic_year: document.getElementById('setting-year').value.trim(),
        current_semester: document.getElementById('setting-semester').value.trim(),
        working_hours_start: document.getElementById('setting-start').value,
        working_hours_end: document.getElementById('setting-end').value,
        default_slot_duration: document.getElementById('setting-duration').value
      };

      try {
        await API.put('/settings', payload);
        UI.showToast('success', 'Settings updated successfully.');
      } catch (err) {
        UI.showToast('error', err.message || 'Failed to update settings.');
      }
    });
  }

  // Password Change Form
  const passwordForm = document.getElementById('password-change-form');
  if (passwordForm) {
    passwordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentPassword = document.getElementById('pwd-current').value;
      const newPassword = document.getElementById('pwd-new').value;
      const confirmPassword = document.getElementById('pwd-confirm').value;

      if (newPassword !== confirmPassword) {
        UI.showToast('error', 'New passwords do not match.');
        return;
      }

      try {
        await API.post('/auth/change-password', { currentPassword, newPassword });
        UI.showToast('success', 'Password updated successfully!');
        passwordForm.reset();
      } catch (err) {
        UI.showToast('error', err.message || 'Failed to change password.');
      }
    });
  }
}

async function loadSettingsData() {
  try {
    const res = await API.get('/settings');
    if (res.success && res.settings) {
      const s = res.settings;
      if (document.getElementById('setting-name')) document.getElementById('setting-name').value = s.institution_name || '';
      if (document.getElementById('setting-code')) document.getElementById('setting-code').value = s.institution_code || '';
      if (document.getElementById('setting-year')) document.getElementById('setting-year').value = s.academic_year || '';
      if (document.getElementById('setting-semester')) document.getElementById('setting-semester').value = s.current_semester || '';
      if (document.getElementById('setting-start')) document.getElementById('setting-start').value = s.working_hours_start || '08:30';
      if (document.getElementById('setting-end')) document.getElementById('setting-end').value = s.working_hours_end || '17:30';
      if (document.getElementById('setting-duration')) document.getElementById('setting-duration').value = s.default_slot_duration || '60';
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
}
