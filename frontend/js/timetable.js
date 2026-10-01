/**
 * Interactive Timetable Scheduler Module
 */

const Timetable = {
  currentView: 'weekly',
  currentDate: new Date(),
  timetableData: null,

  // Standard college time slots
  timeSlots: [
    { start: '08:30', end: '09:30', label: '08:30 - 09:30' },
    { start: '09:30', end: '10:30', label: '09:30 - 10:30' },
    { start: '10:30', end: '11:30', label: '10:30 - 11:30' },
    { start: '11:30', end: '12:30', label: '11:30 - 12:30' },
    { start: '12:30', end: '13:30', label: '12:30 - 01:30 (Lunch Break)' },
    { start: '13:30', end: '14:30', label: '01:30 - 02:30' },
    { start: '14:30', end: '15:30', label: '02:30 - 03:30' },
    { start: '15:30', end: '16:30', label: '03:30 - 04:30' },
    { start: '16:30', end: '17:30', label: '04:30 - 05:30' }
  ],

  daysOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],

  async init() {
    this.bindEvents();
    await this.populateFilters();
    await this.loadTimetable();
  },

  bindEvents() {
    document.getElementById('btn-tt-prev')?.addEventListener('click', () => {
      this.shiftDate(-7);
    });

    document.getElementById('btn-tt-next')?.addEventListener('click', () => {
      this.shiftDate(7);
    });

    document.getElementById('btn-tt-today')?.addEventListener('click', () => {
      this.currentDate = new Date();
      this.loadTimetable();
    });

    document.getElementById('tt-date-picker')?.addEventListener('change', (e) => {
      if (e.target.value) {
        this.currentDate = new Date(e.target.value);
        this.loadTimetable();
      }
    });

    document.getElementById('tt-view-select')?.addEventListener('change', (e) => {
      this.currentView = e.target.value;
      this.loadTimetable();
    });

    document.getElementById('tt-filter-room')?.addEventListener('change', () => this.loadTimetable());
    document.getElementById('tt-filter-faculty')?.addEventListener('change', () => this.loadTimetable());
    document.getElementById('tt-filter-dept')?.addEventListener('change', () => this.loadTimetable());

    document.getElementById('btn-tt-print')?.addEventListener('click', () => {
      window.print();
    });

    document.getElementById('btn-tt-export-csv')?.addEventListener('click', () => {
      window.location.href = '/api/reports/export?type=allocations';
    });
  },

  shiftDate(days) {
    this.currentDate.setDate(this.currentDate.getDate() + days);
    this.loadTimetable();
  },

  async populateFilters() {
    try {
      const [roomsRes, facultyRes, deptsRes] = await Promise.all([
        API.get('/rooms'),
        API.get('/auth/faculty'),
        API.get('/departments')
      ]);

      const rSelect = document.getElementById('tt-filter-room');
      if (rSelect && roomsRes.success) {
        rSelect.innerHTML = '<option value="">All Rooms</option>' +
          roomsRes.data.map(r => `<option value="${r.id}">${r.room_number} (${r.room_type})</option>`).join('');
      }

      const fSelect = document.getElementById('tt-filter-faculty');
      if (fSelect && facultyRes.success) {
        fSelect.innerHTML = '<option value="">All Faculty</option>' +
          facultyRes.faculty.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
      }

      const dSelect = document.getElementById('tt-filter-dept');
      if (dSelect && deptsRes.success) {
        dSelect.innerHTML = '<option value="">All Departments</option>' +
          deptsRes.departments.map(d => `<option value="${d.id}">${d.code}</option>`).join('');
      }
    } catch (e) {
      console.error('Failed to populate timetable filters:', e);
    }
  },

  async loadTimetable() {
    const container = document.getElementById('timetable-grid-container');
    UI.showLoading(container);

    const dateStr = this.currentDate.toISOString().split('T')[0];
    const datePicker = document.getElementById('tt-date-picker');
    if (datePicker) datePicker.value = dateStr;

    const roomId = document.getElementById('tt-filter-room')?.value;
    const facultyId = document.getElementById('tt-filter-faculty')?.value;
    const deptId = document.getElementById('tt-filter-dept')?.value;

    try {
      const res = await API.get('/timetable', {
        view: this.currentView,
        date: dateStr,
        room_id: roomId,
        faculty_id: facultyId,
        department_id: deptId
      });

      if (res.success) {
        this.timetableData = res;
        this.updateHeaderRange(res.meta);
        this.renderGrid(res);
      }
    } catch (err) {
      UI.showToast('error', 'Failed to load timetable schedule.');
      container.innerHTML = '<div class="empty-state"><p>Could not load timetable from server.</p></div>';
    }
  },

  updateHeaderRange(meta) {
    const rangeLabel = document.getElementById('tt-range-label');
    if (rangeLabel && meta) {
      rangeLabel.textContent = `${meta.startDate}  to  ${meta.endDate}`;
    }
  },

  renderGrid(data) {
    const container = document.getElementById('timetable-grid-container');
    if (!container) return;

    const allocations = data.allocations || [];
    const maintenance = data.maintenance || [];

    // Table header columns
    const columns = this.daysOfWeek;

    let html = `
      <div class="timetable-container">
        <table class="timetable-grid">
          <thead>
            <tr>
              <th class="time-col">Time Slot</th>
              ${columns.map(day => `<th>${day}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
    `;

    for (const slot of this.timeSlots) {
      const isLunch = slot.label.includes('Lunch');

      html += `
        <tr>
          <td class="time-col">${slot.label}</td>
          ${columns.map(day => {
            if (isLunch) {
              return `<td style="background-color: #fafaf9; text-align: center; color: var(--color-text-subtle); font-size: 0.75rem;">— Recess —</td>`;
            }

            // Find matching allocations for this day and slot interval
            const matched = allocations.filter(a => {
              // Match day
              if (a.day_of_week !== day) return false;
              // Check interval overlap: existing.start < slot.end && existing.end > slot.start
              return a.start_time < slot.end && a.end_time > slot.start;
            });

            const cellsContent = matched.map(m => `
              <div class="timetable-entry" style="border-left-color: ${m.color.border}; background-color: ${m.color.bg};" onclick="Timetable.showClassModal(${m.id})">
                <div class="entry-subject" style="color: ${m.color.text};">${m.subject}</div>
                <div class="entry-meta">
                  <strong>${m.room_number}</strong> • ${m.faculty_name} (${m.student_group})
                </div>
                <div style="font-size: 0.68rem; color: var(--color-text-muted); margin-top: 0.15rem;">
                  ⏱️ ${m.start_time} - ${m.end_time}
                </div>
              </div>
            `).join('');

            return `<td>${cellsContent}</td>`;
          }).join('')}
        </tr>
      `;
    }

    html += `
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = html;
  },

  async showClassModal(allocId) {
    try {
      const res = await API.get(`/allocations/${allocId}`);
      if (res.success && res.allocation) {
        const a = res.allocation;
        const body = document.getElementById('class-details-body');
        if (body) {
          body.innerHTML = `
            <div style="margin-bottom: 1.25rem;">
              <span class="badge badge-occupied" style="font-size: 0.8rem;">${a.room_number} (${a.building})</span>
              <h2 style="font-size: 1.35rem; margin-top: 0.4rem;">${a.subject}</h2>
              <p>${a.department_name} • ${a.academic_year} (${a.semester})</p>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.25rem; font-size: 0.85rem;">
              <div><strong>Faculty:</strong> ${a.faculty_name}</div>
              <div><strong>Student Group:</strong> ${a.student_group}</div>
              <div><strong>Date & Day:</strong> ${a.allocation_date} (${a.day_of_week})</div>
              <div><strong>Time Range:</strong> ${a.start_time} - ${a.end_time}</div>
              <div><strong>Attendance Expectation:</strong> ${a.expected_students} Students</div>
              <div><strong>Room Capacity:</strong> ${a.room_capacity} Seats</div>
            </div>

            ${a.notes ? `
              <div style="font-size: 0.85rem; background: var(--color-bg-subtle); padding: 0.75rem; border-radius: var(--radius-sm); margin-bottom: 1rem;">
                <strong>Notes:</strong> ${a.notes}
              </div>
            ` : ''}
          `;
          UI.openModal('modal-class-details');
        }
      }
    } catch (e) {
      UI.showToast('error', 'Could not fetch class schedule details.');
    }
  }
};

window.Timetable = Timetable;
