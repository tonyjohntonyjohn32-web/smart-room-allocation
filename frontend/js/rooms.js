/**
 * Room Management & Facility Viewer Module
 */

const Rooms = {
  currentView: 'grid', // 'grid' or 'table'
  roomsData: [],

  async init() {
    this.bindEvents();
    await this.loadDepartmentsDropdown();
    await this.loadRooms();
  },

  bindEvents() {
    const searchInput = document.getElementById('rooms-search');
    if (searchInput) {
      searchInput.addEventListener('input', () => this.filterAndRender());
    }

    const buildingFilter = document.getElementById('rooms-filter-building');
    if (buildingFilter) {
      buildingFilter.addEventListener('change', () => this.filterAndRender());
    }

    const typeFilter = document.getElementById('rooms-filter-type');
    if (typeFilter) {
      typeFilter.addEventListener('change', () => this.filterAndRender());
    }

    const statusFilter = document.getElementById('rooms-filter-status');
    if (statusFilter) {
      statusFilter.addEventListener('change', () => this.filterAndRender());
    }

    const viewToggleGrid = document.getElementById('btn-view-grid');
    const viewToggleTable = document.getElementById('btn-view-table');

    if (viewToggleGrid && viewToggleTable) {
      viewToggleGrid.addEventListener('click', () => {
        this.currentView = 'grid';
        viewToggleGrid.classList.add('active');
        viewToggleTable.classList.remove('active');
        this.render();
      });

      viewToggleTable.addEventListener('click', () => {
        this.currentView = 'table';
        viewToggleTable.classList.add('active');
        viewToggleGrid.classList.remove('active');
        this.render();
      });
    }

    // Add room form submit handler
    const roomForm = document.getElementById('room-form');
    if (roomForm) {
      roomForm.addEventListener('submit', (e) => this.handleSaveRoom(e));
    }
  },

  async loadDepartmentsDropdown() {
    try {
      const res = await API.get('/departments');
      if (res.success && res.departments) {
        const select = document.getElementById('room-form-department');
        if (select) {
          select.innerHTML = '<option value="">-- College Central / Unassigned --</option>' +
            res.departments.map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('');
        }
      }
    } catch (e) {
      console.error('Failed to load departments dropdown:', e);
    }
  },

  async loadRooms() {
    const container = document.getElementById('rooms-container');
    UI.showLoading(container);

    try {
      const res = await API.get('/rooms');
      if (res.success) {
        this.roomsData = res.data;
        this.populateBuildingFilterOptions();
        this.filterAndRender();
      }
    } catch (err) {
      UI.showToast('error', 'Failed to load rooms list.');
      if (container) {
        container.innerHTML = `<div class="empty-state"><p>Error connecting to backend.</p></div>`;
      }
    }
  },

  populateBuildingFilterOptions() {
    const select = document.getElementById('rooms-filter-building');
    if (!select) return;
    const buildings = [...new Set(this.roomsData.map(r => r.building))];
    const currentVal = select.value;
    select.innerHTML = '<option value="">All Buildings</option>' +
      buildings.map(b => `<option value="${b}">${b}</option>`).join('');
    select.value = currentVal;
  },

  filterAndRender() {
    const search = (document.getElementById('rooms-search')?.value || '').toLowerCase();
    const building = document.getElementById('rooms-filter-building')?.value || '';
    const type = document.getElementById('rooms-filter-type')?.value || '';
    const status = document.getElementById('rooms-filter-status')?.value || '';

    const filtered = this.roomsData.filter(r => {
      const matchSearch = !search ||
        r.room_number.toLowerCase().includes(search) ||
        r.room_name.toLowerCase().includes(search) ||
        (r.description && r.description.toLowerCase().includes(search));
      const matchBuilding = !building || r.building === building;
      const matchType = !type || r.room_type === type;
      const matchStatus = !status || r.status === status;

      return matchSearch && matchBuilding && matchType && matchStatus;
    });

    this.render(filtered);
  },

  render(data = null) {
    const rooms = data || this.roomsData;
    const container = document.getElementById('rooms-container');
    if (!container) return;

    if (rooms.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-state-icon">🏛️</div>
          <h3>No Rooms Found</h3>
          <p>Try adjusting your search query or filter criteria.</p>
        </div>
      `;
      return;
    }

    const isAdmin = Auth.isAdmin();

    if (this.currentView === 'grid') {
      container.className = 'rooms-grid';
      container.innerHTML = rooms.map(r => {
        const equipPills = (r.equipment || []).map(eq => `<span class="tag-pill">${eq}</span>`).join('');
        return `
          <div class="room-card">
            <div>
              <div class="room-card-header">
                <span class="room-num">${r.room_number}</span>
                <span class="badge badge-${r.status}">${r.status}</span>
              </div>
              <div class="room-card-name">${r.room_name}</div>
              
              <div class="room-details-list">
                <span>📍 <strong>${r.building}</strong> • Floor ${r.floor}</span>
                <span>🏷️ ${r.room_type} • <strong>${r.capacity} Seats</strong></span>
                <span>♿ ${r.accessibility || 'Standard'}</span>
                ${r.department_code ? `<span>🏢 ${r.department_name} (${r.department_code})</span>` : ''}
              </div>

              ${equipPills ? `<div style="margin-bottom: 0.75rem;">${equipPills}</div>` : ''}
            </div>

            <div class="room-card-actions">
              <button type="button" class="btn btn-secondary btn-sm" onclick="Rooms.viewDetails(${r.id})">Details</button>
              ${isAdmin ? `
                <button type="button" class="btn btn-secondary btn-sm" onclick="Rooms.editRoom(${r.id})">Edit</button>
                <button type="button" class="btn btn-danger btn-sm" onclick="Rooms.deleteRoom(${r.id}, '${r.room_number}')">Delete</button>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');
    } else {
      // Table View
      container.className = 'table-responsive';
      container.innerHTML = `
        <table class="data-table">
          <thead>
            <tr>
              <th>Room #</th>
              <th>Name</th>
              <th>Building</th>
              <th>Floor</th>
              <th>Type</th>
              <th>Capacity</th>
              <th>Status</th>
              <th>Accessibility</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rooms.map(r => `
              <tr>
                <td><strong>${r.room_number}</strong></td>
                <td>${r.room_name}</td>
                <td>${r.building}</td>
                <td>${r.floor}</td>
                <td>${r.room_type}</td>
                <td><strong>${r.capacity}</strong></td>
                <td><span class="badge badge-${r.status}">${r.status}</span></td>
                <td>${r.accessibility || 'Standard'}</td>
                <td>
                  <div style="display: flex; gap: 0.35rem;">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="Rooms.viewDetails(${r.id})">View</button>
                    ${isAdmin ? `
                      <button type="button" class="btn btn-secondary btn-sm" onclick="Rooms.editRoom(${r.id})">Edit</button>
                      <button type="button" class="btn btn-danger btn-sm" onclick="Rooms.deleteRoom(${r.id}, '${r.room_number}')">Del</button>
                    ` : ''}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
  },

  openAddModal() {
    const form = document.getElementById('room-form');
    if (form) form.reset();
    document.getElementById('room-form-id').value = '';
    document.getElementById('modal-room-title').textContent = 'Add New Room';
    UI.openModal('modal-room');
  },

  async editRoom(id) {
    try {
      const res = await API.get(`/rooms/${id}`);
      if (res.success && res.room) {
        const r = res.room;
        document.getElementById('room-form-id').value = r.id;
        document.getElementById('room-form-number').value = r.room_number;
        document.getElementById('room-form-name').value = r.room_name;
        document.getElementById('room-form-building').value = r.building;
        document.getElementById('room-form-floor').value = r.floor;
        document.getElementById('room-form-type').value = r.room_type;
        document.getElementById('room-form-capacity').value = r.capacity;
        document.getElementById('room-form-department').value = r.department_id || '';
        document.getElementById('room-form-accessibility').value = r.accessibility || 'Standard';
        document.getElementById('room-form-status').value = r.status || 'available';
        document.getElementById('room-form-description').value = r.description || '';

        // Uncheck all equipment checkboxes then check matches
        const checkboxes = document.querySelectorAll('input[name="room-equipment"]');
        checkboxes.forEach(cb => {
          cb.checked = (r.equipment || []).includes(cb.value);
        });

        document.getElementById('modal-room-title').textContent = `Edit Room ${r.room_number}`;
        UI.openModal('modal-room');
      }
    } catch (err) {
      UI.showToast('error', 'Could not load room details for editing.');
    }
  },

  async handleSaveRoom(e) {
    e.preventDefault();
    const id = document.getElementById('room-form-id').value;

    const equipment = [];
    document.querySelectorAll('input[name="room-equipment"]:checked').forEach(cb => {
      equipment.push(cb.value);
    });

    const payload = {
      room_number: document.getElementById('room-form-number').value.trim(),
      room_name: document.getElementById('room-form-name').value.trim(),
      building: document.getElementById('room-form-building').value.trim(),
      floor: parseInt(document.getElementById('room-form-floor').value, 10),
      room_type: document.getElementById('room-form-type').value,
      capacity: parseInt(document.getElementById('room-form-capacity').value, 10),
      department_id: document.getElementById('room-form-department').value || null,
      accessibility: document.getElementById('room-form-accessibility').value,
      status: document.getElementById('room-form-status').value,
      description: document.getElementById('room-form-description').value.trim(),
      equipment
    };

    try {
      if (id) {
        await API.put(`/rooms/${id}`, payload);
        UI.showToast('success', 'Room updated successfully.');
      } else {
        await API.post('/rooms', payload);
        UI.showToast('success', 'Room created successfully.');
      }

      UI.closeModal('modal-room');
      await this.loadRooms();
      if (window.Dashboard) window.Dashboard.loadSummary();
    } catch (err) {
      UI.showToast('error', err.message || 'Failed to save room.');
    }
  },

  deleteRoom(id, roomNumber) {
    UI.confirm(
      'Delete Room',
      `Are you sure you want to delete room "${roomNumber}"? This action cannot be undone.`,
      async () => {
        try {
          await API.delete(`/rooms/${id}`);
          UI.showToast('success', `Room ${roomNumber} deleted.`);
          await this.loadRooms();
          if (window.Dashboard) window.Dashboard.loadSummary();
        } catch (err) {
          UI.showToast('error', err.message || 'Failed to delete room.');
        }
      }
    );
  },

  async viewDetails(id) {
    try {
      const res = await API.get(`/rooms/${id}`);
      if (res.success && res.room) {
        const r = res.room;
        const detailsContainer = document.getElementById('room-details-body');
        if (!detailsContainer) return;

        const equipPills = (r.equipment || []).map(eq => `<span class="tag-pill">${eq}</span>`).join(' ') || 'None';
        const upcomingRows = (res.upcomingAllocations || []).map(a => `
          <tr>
            <td>${a.allocation_date}</td>
            <td>${a.start_time} - ${a.end_time}</td>
            <td><strong>${a.subject}</strong></td>
            <td>${a.faculty_name}</td>
          </tr>
        `).join('') || '<tr><td colspan="4" class="empty-state">No upcoming allocations for this room.</td></tr>';

        detailsContainer.innerHTML = `
          <div style="margin-bottom: 1.25rem;">
            <h2>${r.room_number}: ${r.room_name}</h2>
            <p>${r.building} • Floor ${r.floor} • <span class="badge badge-${r.status}">${r.status}</span></p>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.25rem; font-size: 0.85rem;">
            <div><strong>Type:</strong> ${r.room_type}</div>
            <div><strong>Capacity:</strong> ${r.capacity} seats</div>
            <div><strong>Accessibility:</strong> ${r.accessibility || 'Standard'}</div>
            <div><strong>Department:</strong> ${r.department_name || 'Central College Facility'}</div>
          </div>

          <div style="margin-bottom: 1.25rem;">
            <strong>Available Equipment:</strong>
            <div style="margin-top: 0.35rem;">${equipPills}</div>
          </div>

          ${r.description ? `
            <div style="margin-bottom: 1.25rem; font-size: 0.85rem; color: var(--color-text-muted); background: var(--color-bg-subtle); padding: 0.75rem; border-radius: var(--radius-sm);">
              ${r.description}
            </div>
          ` : ''}

          <h4 style="margin-bottom: 0.5rem;">Upcoming Scheduled Classes</h4>
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Subject</th>
                  <th>Faculty</th>
                </tr>
              </thead>
              <tbody>${upcomingRows}</tbody>
            </table>
          </div>
        `;

        UI.openModal('modal-room-details');
      }
    } catch (err) {
      UI.showToast('error', 'Could not fetch room details.');
    }
  }
};

window.Rooms = Rooms;
