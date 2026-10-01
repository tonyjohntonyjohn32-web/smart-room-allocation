/**
 * Reports, Analytics, and Data Export Module
 */

const Reports = {
  currentReport: 'room-utilization',

  async init() {
    this.bindEvents();
    await this.loadReport();
  },

  bindEvents() {
    const reportSelect = document.getElementById('report-type-select');
    if (reportSelect) {
      reportSelect.addEventListener('change', (e) => {
        this.currentReport = e.target.value;
        this.loadReport();
      });
    }

    document.getElementById('btn-report-refresh')?.addEventListener('click', () => {
      this.loadReport();
    });

    document.getElementById('btn-report-export')?.addEventListener('click', () => {
      window.location.href = `/api/reports/export?type=allocations`;
    });

    document.getElementById('btn-report-print')?.addEventListener('click', () => {
      window.print();
    });
  },

  async loadReport() {
    const container = document.getElementById('report-content-container');
    UI.showLoading(container);

    try {
      let endpoint = '';
      switch (this.currentReport) {
        case 'room-utilization':
          endpoint = '/reports/room-utilization';
          break;
        case 'department-allocations':
          endpoint = '/reports/department-allocations';
          break;
        case 'building-utilization':
          endpoint = '/reports/building-utilization';
          break;
        case 'unused-rooms':
          endpoint = '/reports/unused-rooms';
          break;
        case 'maintenance':
          endpoint = '/reports/maintenance';
          break;
        case 'capacity-efficiency':
          endpoint = '/reports/capacity-efficiency';
          break;
        default:
          endpoint = '/reports/room-utilization';
      }

      const res = await API.get(endpoint);
      if (res.success) {
        this.renderReport(res);
      }
    } catch (err) {
      UI.showToast('error', 'Failed to generate report.');
      container.innerHTML = '<div class="empty-state"><p>Error connecting to report service.</p></div>';
    }
  },

  renderReport(res) {
    const container = document.getElementById('report-content-container');
    if (!container) return;

    const data = res.data || [];
    const reportName = res.reportName || 'Institutional Report';
    const timestamp = new Date(res.generatedAt || Date.now()).toLocaleString();

    let tableHeaders = '';
    let tableRows = '';

    if (this.currentReport === 'room-utilization') {
      tableHeaders = `
        <th>Room #</th>
        <th>Name</th>
        <th>Building</th>
        <th>Type</th>
        <th>Capacity</th>
        <th>Total Bookings</th>
        <th>Student Attendees</th>
        <th>Avg Seat Utilization</th>
      `;
      tableRows = data.map(r => `
        <tr>
          <td><strong>${r.room_number}</strong></td>
          <td>${r.room_name}</td>
          <td>${r.building}</td>
          <td>${r.room_type}</td>
          <td>${r.capacity}</td>
          <td>${r.total_bookings}</td>
          <td>${r.total_student_attendees}</td>
          <td>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <div style="flex: 1; height: 6px; background: #e2e8f0; border-radius: 999px; overflow: hidden;">
                <div style="width: ${Math.min(100, r.avg_seat_utilization || 0)}%; height: 100%; background: var(--color-primary);"></div>
              </div>
              <span style="font-weight: 700; font-size: 0.78rem;">${r.avg_seat_utilization || 0}%</span>
            </div>
          </td>
        </tr>
      `).join('');
    } else if (this.currentReport === 'department-allocations') {
      tableHeaders = `
        <th>Department Code</th>
        <th>Department Name</th>
        <th>Total Allocations</th>
        <th>Rooms Utilized</th>
        <th>Active Faculty</th>
        <th>Total Students Scheduled</th>
      `;
      tableRows = data.map(d => `
        <tr>
          <td><span class="badge" style="background:#eff6ff; color:#1e40af;">${d.department_code}</span></td>
          <td><strong>${d.department_name}</strong></td>
          <td><strong>${d.total_allocations}</strong></td>
          <td>${d.distinct_rooms_used}</td>
          <td>${d.faculty_active}</td>
          <td>${d.total_students_scheduled}</td>
        </tr>
      `).join('');
    } else if (this.currentReport === 'building-utilization') {
      tableHeaders = `
        <th>Building</th>
        <th>Total Rooms</th>
        <th>Total Seating Capacity</th>
        <th>Total Allocations</th>
        <th>Seat Efficiency</th>
      `;
      tableRows = data.map(b => `
        <tr>
          <td><strong>${b.building}</strong></td>
          <td>${b.total_rooms}</td>
          <td>${b.total_seat_capacity}</td>
          <td>${b.total_allocations}</td>
          <td><strong>${b.avg_seat_efficiency || 0}%</strong></td>
        </tr>
      `).join('');
    } else if (this.currentReport === 'unused-rooms') {
      tableHeaders = `
        <th>Room #</th>
        <th>Name</th>
        <th>Building</th>
        <th>Floor</th>
        <th>Type</th>
        <th>Capacity</th>
        <th>Status</th>
      `;
      tableRows = data.map(r => `
        <tr>
          <td><strong>${r.room_number}</strong></td>
          <td>${r.room_name}</td>
          <td>${r.building}</td>
          <td>${r.floor}</td>
          <td>${r.room_type}</td>
          <td>${r.capacity}</td>
          <td><span class="badge badge-${r.status}">${r.status}</span></td>
        </tr>
      `).join('');
    } else if (this.currentReport === 'maintenance') {
      tableHeaders = `
        <th>Room #</th>
        <th>Building</th>
        <th>Start Date</th>
        <th>End Date</th>
        <th>Reason / Work Order</th>
        <th>Status</th>
      `;
      tableRows = data.map(m => `
        <tr>
          <td><strong>${m.room_number}</strong></td>
          <td>${m.building}</td>
          <td>${m.start_date}</td>
          <td>${m.end_date}</td>
          <td>${m.reason}</td>
          <td><span class="badge badge-${m.status}">${m.status}</span></td>
        </tr>
      `).join('');
    } else if (this.currentReport === 'capacity-efficiency') {
      tableHeaders = `
        <th>Subject</th>
        <th>Room</th>
        <th>Capacity</th>
        <th>Expected Students</th>
        <th>Unused Seats</th>
        <th>Utilization Efficiency</th>
      `;
      tableRows = data.map(c => `
        <tr>
          <td><strong>${c.subject}</strong><br><small>${c.student_group}</small></td>
          <td>${c.room_number}</td>
          <td>${c.capacity}</td>
          <td>${c.expected_students}</td>
          <td>${c.unused_seats}</td>
          <td>
            <span class="badge" style="${c.utilization_pct < 50 ? 'background: #fef2f2; color: #b91c1c;' : 'background: #f0fdf4; color: #15803d;'}">
              ${c.utilization_pct}%
            </span>
          </td>
        </tr>
      `).join('');
    }

    container.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; border-bottom: 1px solid var(--color-border); padding-bottom: 0.75rem;">
        <div>
          <h2 style="font-size: 1.25rem;">${reportName}</h2>
          <p style="font-size: 0.8rem; color: var(--color-text-muted);">Generated: ${timestamp} • Records: ${data.length}</p>
        </div>
      </div>

      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>${tableHeaders}</tr>
          </thead>
          <tbody>
            ${data.length > 0 ? tableRows : `<tr><td colspan="8" class="empty-state">No records found for this report.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  }
};

window.Reports = Reports;
