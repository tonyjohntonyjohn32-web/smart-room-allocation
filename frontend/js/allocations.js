/**
 * Room Allocation Management & Automated Recommendation Engine
 */

const Allocations = {
  allocationsData: [],
  recommendedData: null,

  async init() {
    this.bindEvents();
    await this.populateDropdowns();
    await this.loadAllocations();

    // Default dates to today
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('alloc-date');
    if (dateInput && !dateInput.value) dateInput.value = today;

    const recDateInput = document.getElementById('rec-date');
    if (recDateInput && !recDateInput.value) recDateInput.value = today;
  },

  bindEvents() {
    // Tab switching between Manual Allocation and Smart Recommendation
    const tabManual = document.getElementById('tab-alloc-manual');
    const tabSmart = document.getElementById('tab-alloc-smart');
    const panelManual = document.getElementById('panel-alloc-manual');
    const panelSmart = document.getElementById('panel-alloc-smart');

    if (tabManual && tabSmart && panelManual && panelSmart) {
      tabManual.addEventListener('click', () => {
        tabManual.classList.add('active');
        tabSmart.classList.remove('active');
        panelManual.style.display = 'block';
        panelSmart.style.display = 'none';
      });

      tabSmart.addEventListener('click', () => {
        tabSmart.classList.add('active');
        tabManual.classList.remove('active');
        panelSmart.style.display = 'block';
        panelManual.style.display = 'none';
      });
    }

    // Manual allocation form submit
    const manualForm = document.getElementById('manual-allocation-form');
    if (manualForm) {
      manualForm.addEventListener('submit', (e) => this.handleManualAllocate(e));
    }

    // Smart recommendation form submit
    const smartForm = document.getElementById('smart-recommendation-form');
    if (smartForm) {
      smartForm.addEventListener('submit', (e) => this.handleGenerateRecommendation(e));
    }

    // Filter controls for allocations table
    const searchInput = document.getElementById('alloc-search');
    if (searchInput) searchInput.addEventListener('input', () => this.filterAndRender());

    const statusFilter = document.getElementById('alloc-filter-status');
    if (statusFilter) statusFilter.addEventListener('change', () => this.filterAndRender());

    const dateFilter = document.getElementById('alloc-filter-date');
    if (dateFilter) dateFilter.addEventListener('change', () => this.filterAndRender());
  },

  async populateDropdowns() {
    try {
      const [deptRes, facultyRes, roomRes] = await Promise.all([
        API.get('/departments'),
        API.get('/auth/faculty'),
        API.get('/rooms')
      ]);

      if (deptRes.success && deptRes.departments) {
        const selects = [
          document.getElementById('alloc-department'),
          document.getElementById('rec-department'),
          document.getElementById('alloc-filter-dept')
        ];
        selects.forEach(sel => {
          if (!sel) return;
          const isFilter = sel.id.includes('filter');
          sel.innerHTML = (isFilter ? '<option value="">All Departments</option>' : '<option value="">-- Select Department --</option>') +
            deptRes.departments.map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('');
        });
      }

      if (facultyRes.success && facultyRes.faculty) {
        const fSelect = document.getElementById('alloc-faculty');
        const smartFSelect = document.getElementById('rec-faculty');
        const options = '<option value="">-- Select Faculty Member --</option>' +
          facultyRes.faculty.map(f => `<option value="${f.id}">${f.name} (${f.department_code || 'Faculty'})</option>`).join('');

        if (fSelect) fSelect.innerHTML = options;
        if (smartFSelect) smartFSelect.innerHTML = options;
      }

      if (roomRes.success && roomRes.data) {
        const rSelect = document.getElementById('alloc-room');
        if (rSelect) {
          rSelect.innerHTML = '<option value="">-- Select Room Manually --</option>' +
            roomRes.data.map(r => `<option value="${r.id}">${r.room_number} - ${r.room_name} (${r.building}, Cap: ${r.capacity})</option>`).join('');
        }
      }
    } catch (err) {
      console.error('Failed to populate allocation dropdowns:', err);
    }
  },

  async loadAllocations() {
    const tbody = document.getElementById('allocations-tbody');
    UI.showLoading(tbody);

    try {
      const res = await API.get('/allocations');
      if (res.success) {
        this.allocationsData = res.allocations;
        this.filterAndRender();
      }
    } catch (err) {
      UI.showToast('error', 'Failed to load allocations.');
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="8" class="empty-state">Failed to connect to allocations service.</td></tr>`;
      }
    }
  },

  filterAndRender() {
    const search = (document.getElementById('alloc-search')?.value || '').toLowerCase();
    const status = document.getElementById('alloc-filter-status')?.value || '';
    const date = document.getElementById('alloc-filter-date')?.value || '';

    const filtered = this.allocationsData.filter(a => {
      const matchSearch = !search ||
        a.subject.toLowerCase().includes(search) ||
        a.room_number.toLowerCase().includes(search) ||
        a.faculty_name.toLowerCase().includes(search) ||
        a.student_group.toLowerCase().includes(search);
      const matchStatus = !status || a.status === status;
      const matchDate = !date || a.allocation_date === date;

      return matchSearch && matchStatus && matchDate;
    });

    this.render(filtered);
  },

  render(data = null) {
    const allocations = data || this.allocationsData;
    const tbody = document.getElementById('allocations-tbody');
    if (!tbody) return;

    if (allocations.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="empty-state">
            <div class="empty-state-icon">📅</div>
            <h3>No Allocations Found</h3>
            <p>No room bookings match the chosen filter parameters.</p>
          </td>
        </tr>
      `;
      return;
    }

    const isAdmin = Auth.isAdmin();

    tbody.innerHTML = allocations.map(a => `
      <tr>
        <td><strong>${a.subject}</strong><br><small style="color: var(--color-text-muted);">${a.student_group}</small></td>
        <td><span class="badge badge-occupied">${a.room_number}</span><br><small>${a.building}</small></td>
        <td>${a.faculty_name}<br><small style="color: var(--color-text-muted);">${a.department_code || ''}</small></td>
        <td>${a.allocation_date}<br><small>${a.day_of_week}</small></td>
        <td><strong>${a.start_time} - ${a.end_time}</strong></td>
        <td>${a.expected_students} / ${a.room_capacity || '-'}</td>
        <td><span class="badge badge-${a.status}">${a.status}</span></td>
        <td>
          <div style="display: flex; gap: 0.35rem;">
            ${isAdmin && a.status === 'confirmed' ? `
              <button type="button" class="btn btn-secondary btn-sm" onclick="Allocations.cancelAllocation(${a.id}, '${a.subject}')">Cancel</button>
              <button type="button" class="btn btn-danger btn-sm" onclick="Allocations.deleteAllocationPermanent(${a.id})">Delete</button>
            ` : ''}
          </div>
        </td>
      </tr>
    `).join('');
  },

  async handleManualAllocate(e) {
    e.preventDefault();

    const payload = {
      room_id: parseInt(document.getElementById('alloc-room').value, 10),
      department_id: parseInt(document.getElementById('alloc-department').value, 10),
      faculty_id: parseInt(document.getElementById('alloc-faculty').value, 10),
      subject: document.getElementById('alloc-subject').value.trim(),
      academic_year: document.getElementById('alloc-year').value.trim(),
      semester: document.getElementById('alloc-semester').value.trim(),
      student_group: document.getElementById('alloc-group').value.trim(),
      allocation_date: document.getElementById('alloc-date').value,
      start_time: document.getElementById('alloc-start-time').value,
      end_time: document.getElementById('alloc-end-time').value,
      expected_students: parseInt(document.getElementById('alloc-students').value, 10),
      notes: document.getElementById('alloc-notes').value.trim()
    };

    try {
      const res = await API.post('/allocations', payload);
      if (res.success) {
        UI.showToast('success', 'Room allocated successfully!');
        document.getElementById('manual-allocation-form').reset();
        await this.loadAllocations();
        if (window.Dashboard) window.Dashboard.loadSummary();
      }
    } catch (err) {
      if (err.data && err.data.conflicts && err.data.conflicts.length > 0) {
        const topConflict = err.data.conflicts[0];
        UI.showToast('error', topConflict.message, 'Allocation Conflict Detected');
      } else {
        UI.showToast('error', err.message || 'Failed to allocate room.');
      }
    }
  },

  async handleGenerateRecommendation(e) {
    e.preventDefault();

    const resultBox = document.getElementById('recommendation-result-container');
    UI.showLoading(resultBox);

    const requiredEquipment = [];
    document.querySelectorAll('input[name="rec-equipment"]:checked').forEach(cb => {
      requiredEquipment.push(cb.value);
    });

    const payload = {
      date: document.getElementById('rec-date').value,
      start_time: document.getElementById('rec-start-time').value,
      end_time: document.getElementById('rec-end-time').value,
      expected_students: parseInt(document.getElementById('rec-students').value, 10),
      room_type: document.getElementById('rec-room-type').value || null,
      department_id: document.getElementById('rec-department').value || null,
      require_accessibility: document.getElementById('rec-accessibility')?.checked || false,
      required_equipment: requiredEquipment
    };

    try {
      const res = await API.post('/allocations/recommend', payload);
      if (res.success && res.recommended) {
        this.recommendedData = { ...res, requestPayload: payload };
        this.renderRecommendationResult(res);
      } else {
        resultBox.innerHTML = `
          <div class="empty-state" style="background: #ffffff; border: 1px dashed var(--color-border); border-radius: var(--radius-md); padding: 2rem;">
            <div class="empty-state-icon">⚠️</div>
            <h3>No Suitable Rooms Available</h3>
            <p>${res.explanation || 'All rooms either have overlapping bookings or insufficient capacity for this time slot.'}</p>
          </div>
        `;
      }
    } catch (err) {
      UI.showToast('error', err.message || 'Failed to generate room recommendation.');
      resultBox.innerHTML = '';
    }
  },

  renderRecommendationResult(data) {
    const container = document.getElementById('recommendation-result-container');
    const rec = data.recommended;
    const room = rec.room;
    const breakdown = rec.scoreBreakdown;

    const alternativesHtml = (data.alternatives || []).slice(0, 3).map(alt => `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.65rem 0.85rem; background: #ffffff; border: 1px solid var(--color-border); border-radius: var(--radius-sm); margin-bottom: 0.5rem; font-size: 0.85rem;">
        <div>
          <strong>${alt.room.room_number}</strong> (${alt.room.room_name}) • ${alt.room.building}
          <div style="font-size: 0.75rem; color: var(--color-text-muted);">Cap: ${alt.room.capacity} seats | Utilization: ${alt.utilizationRatio}%</div>
        </div>
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span class="badge" style="background: #eff6ff; color: #1e40af;">Score: ${alt.score}/100</span>
          ${Auth.isAdmin() ? `<button type="button" class="btn btn-secondary btn-sm" onclick="Allocations.bookCandidateRoom(${alt.room.id})">Allocate</button>` : ''}
        </div>
      </div>
    `).join('');

    container.innerHTML = `
      <div class="recommendation-box">
        <div class="rec-header">
          <div>
            <span class="badge badge-available" style="font-size: 0.8rem; margin-bottom: 0.35rem;">Optimal Match Found</span>
            <h2 style="font-size: 1.35rem;">${room.room_number}: ${room.room_name}</h2>
            <p style="font-size: 0.85rem;">${room.building} • Floor ${room.floor} • ${room.room_type} (Capacity: ${room.capacity})</p>
          </div>
          <div>
            <span class="rec-score-badge">★ Suitability: ${rec.score}/100</span>
          </div>
        </div>

        <div class="rec-explanation">
          💡 ${data.explanation}
        </div>

        <div class="score-breakdown-bar">
          <span class="score-item">Capacity Fit: ${breakdown.capacityScore}/35 pts (${rec.utilizationRatio}% fill)</span>
          <span class="score-item">Equipment Match: ${breakdown.equipmentScore}/25 pts</span>
          <span class="score-item">Room Type: ${breakdown.roomTypeScore}/20 pts</span>
          <span class="score-item">Department: ${breakdown.departmentScore}/10 pts</span>
          <span class="score-item">Accessibility: ${breakdown.accessibilityScore}/10 pts</span>
        </div>

        ${Auth.isAdmin() ? `
          <div style="display: flex; align-items: center; gap: 1rem; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #bfdbfe;">
            <button type="button" class="btn btn-success" style="font-size: 0.95rem; padding: 0.65rem 1.25rem;" onclick="Allocations.confirmRecommendedAllocation()">
              ✓ Confirm & Allocate Room ${room.room_number}
            </button>
            <span style="font-size: 0.8rem; color: var(--color-text-muted);">Instantly books this room with zero conflict risk.</span>
          </div>
        ` : `
          <div style="font-size: 0.85rem; color: var(--color-text-muted); margin-top: 0.5rem;">
            <em>Note: Faculty accounts can inspect recommendations. Contact an administrator or submit an allocation request to confirm booking.</em>
          </div>
        `}
      </div>

      ${data.alternatives && data.alternatives.length > 0 ? `
        <div style="margin-top: 1.25rem;">
          <h4 style="margin-bottom: 0.5rem; font-size: 0.9rem; color: var(--color-text-muted); text-transform: uppercase;">Alternative Available Rooms</h4>
          ${alternativesHtml}
        </div>
      ` : ''}

      ${data.excluded && data.excluded.length > 0 ? `
        <div style="margin-top: 1rem; font-size: 0.8rem; color: var(--color-text-subtle);">
          ℹ️ <em>${data.excluded.length} other rooms were excluded due to existing class schedules, active maintenance, or insufficient seating capacity.</em>
        </div>
      ` : ''}
    `;
  },

  async confirmRecommendedAllocation() {
    if (!this.recommendedData) return;
    const req = this.recommendedData.requestPayload;
    const room = this.recommendedData.recommended.room;

    const facultyId = document.getElementById('rec-faculty')?.value;
    const subject = document.getElementById('rec-subject')?.value?.trim();
    const group = document.getElementById('rec-group')?.value?.trim();

    if (!facultyId || !subject || !group) {
      UI.showToast('warning', 'Please provide Faculty, Subject, and Student Group in the form above to book this room.');
      return;
    }

    const payload = {
      room_id: room.id,
      department_id: req.department_id || room.department_id || 1,
      faculty_id: parseInt(facultyId, 10),
      subject,
      student_group: group,
      academic_year: '2025-2026',
      semester: 'Current Semester',
      allocation_date: req.date,
      start_time: req.start_time,
      end_time: req.end_time,
      expected_students: req.expected_students,
      notes: `Smart Auto-Allocated (Suitability Score: ${this.recommendedData.recommended.score}/100)`
    };

    try {
      const res = await API.post('/allocations', payload);
      if (res.success) {
        UI.showToast('success', `Room ${room.room_number} successfully allocated!`);
        document.getElementById('recommendation-result-container').innerHTML = '';
        await this.loadAllocations();
        if (window.Dashboard) window.Dashboard.loadSummary();
      }
    } catch (err) {
      UI.showToast('error', err.message || 'Failed to confirm allocation.');
    }
  },

  bookCandidateRoom(roomId) {
    // Switch to manual tab and preselect room and fields
    const roomSelect = document.getElementById('alloc-room');
    if (roomSelect) roomSelect.value = roomId;

    const req = this.recommendedData?.requestPayload;
    if (req) {
      document.getElementById('alloc-date').value = req.date;
      document.getElementById('alloc-start-time').value = req.start_time;
      document.getElementById('alloc-end-time').value = req.end_time;
      document.getElementById('alloc-students').value = req.expected_students;
      if (req.department_id) document.getElementById('alloc-department').value = req.department_id;
    }

    document.getElementById('tab-alloc-manual').click();
    UI.showToast('info', 'Candidate room selected. Fill course details and submit.');
  },

  cancelAllocation(id, subject) {
    UI.confirm(
      'Cancel Allocation',
      `Cancel the allocation for "${subject}"? The room will become available for other classes.`,
      async () => {
        try {
          await API.delete(`/allocations/${id}`);
          UI.showToast('success', 'Allocation cancelled.');
          await this.loadAllocations();
          if (window.Dashboard) window.Dashboard.loadSummary();
        } catch (err) {
          UI.showToast('error', err.message || 'Failed to cancel allocation.');
        }
      }
    );
  },

  deleteAllocationPermanent(id) {
    UI.confirm(
      'Delete Allocation Permanently',
      'Are you sure you want to permanently delete this allocation record from the database?',
      async () => {
        try {
          await API.delete(`/allocations/${id}`, { hard_delete: 'true' });
          UI.showToast('success', 'Allocation permanently deleted.');
          await this.loadAllocations();
          if (window.Dashboard) window.Dashboard.loadSummary();
        } catch (err) {
          UI.showToast('error', err.message || 'Failed to delete record.');
        }
      }
    );
  }
};

window.Allocations = Allocations;
