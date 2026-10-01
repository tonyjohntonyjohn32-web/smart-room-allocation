/**
 * Dashboard Analytics and Chart.js Visualizations
 */

const Dashboard = {
  charts: {},

  async init() {
    await this.loadSummary();
    await this.loadCharts();
    await this.loadRecentActivity();
  },

  async loadSummary() {
    try {
      const res = await API.get('/dashboard/summary');
      if (res.success && res.stats) {
        document.getElementById('stat-total-rooms').textContent = res.stats.totalRooms;
        document.getElementById('stat-available-rooms').textContent = res.stats.availableRooms;
        document.getElementById('stat-occupied-rooms').textContent = res.stats.occupiedRooms;
        document.getElementById('stat-total-allocations').textContent = res.stats.totalAllocations;
        document.getElementById('stat-total-departments').textContent = res.stats.totalDepartments;
        document.getElementById('stat-utilization-rate').textContent = `${res.stats.utilizationRate}%`;

        // Render maintenance alerts if present
        const alertBanner = document.getElementById('maintenance-alert-banner');
        if (alertBanner) {
          if (res.alerts && res.alerts.maintenance && res.alerts.maintenance.length > 0) {
            const list = res.alerts.maintenance.map(m => 
              `<strong>${m.room_number}</strong> (${m.building}): ${m.reason}`
            ).join(' | ');
            alertBanner.innerHTML = `
              <div style="background-color: var(--color-warning-bg); border: 1px solid var(--color-warning-border); color: var(--color-warning-text); padding: 0.75rem 1rem; border-radius: var(--radius-sm); margin-bottom: 1.5rem; font-size: 0.85rem; display: flex; align-items: center; gap: 0.5rem;">
                <span>⚠️</span>
                <div><strong>Maintenance Notice:</strong> ${list}</div>
              </div>
            `;
            alertBanner.style.display = 'block';
          } else {
            alertBanner.style.display = 'none';
          }
        }
      }
    } catch (err) {
      console.error('Failed to load dashboard summary:', err);
    }
  },

  async loadCharts() {
    if (typeof Chart === 'undefined') {
      console.warn('Chart.js not loaded. Skipping chart initialization.');
      return;
    }

    try {
      const [occupancyRes, utilRes] = await Promise.all([
        API.get('/dashboard/occupancy'),
        API.get('/dashboard/utilization')
      ]);

      // 1. Occupancy Doughnut Chart
      const ctxOcc = document.getElementById('chart-occupancy');
      if (ctxOcc && occupancyRes.chartData) {
        if (this.charts.occupancy) this.charts.occupancy.destroy();
        this.charts.occupancy = new Chart(ctxOcc, {
          type: 'doughnut',
          data: occupancyRes.chartData,
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
            },
            cutout: '70%'
          }
        });
      }

      // 2. Building Utilization Bar Chart
      const ctxBuilding = document.getElementById('chart-building');
      if (ctxBuilding && utilRes.buildingUtilization) {
        if (this.charts.building) this.charts.building.destroy();
        this.charts.building = new Chart(ctxBuilding, {
          type: 'bar',
          data: utilRes.buildingUtilization,
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } }
            },
            scales: {
              y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
              x: { grid: { display: false } }
            }
          }
        });
      }

      // 3. Department Distribution Chart
      const ctxDept = document.getElementById('chart-departments');
      if (ctxDept && utilRes.departmentDistribution) {
        if (this.charts.dept) this.charts.dept.destroy();
        this.charts.dept = new Chart(ctxDept, {
          type: 'bar',
          data: utilRes.departmentDistribution,
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
              x: { grid: { display: false } }
            }
          }
        });
      }

      // 4. Weekly Usage Trend Line Chart
      const ctxWeek = document.getElementById('chart-weekly');
      if (ctxWeek && utilRes.weeklyUsage) {
        if (this.charts.weekly) this.charts.weekly.destroy();
        this.charts.weekly = new Chart(ctxWeek, {
          type: 'line',
          data: utilRes.weeklyUsage,
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { stepSize: 1 } },
              x: { grid: { display: false } }
            }
          }
        });
      }
    } catch (err) {
      console.error('Failed to render dashboard charts:', err);
    }
  },

  async loadRecentActivity() {
    try {
      const res = await API.get('/dashboard/recent-allocations');
      if (res.success) {
        // Render Recent Allocations Table
        const tbody = document.getElementById('recent-allocations-tbody');
        if (tbody) {
          if (!res.recentAllocations || res.recentAllocations.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No allocations scheduled yet.</td></tr>`;
          } else {
            tbody.innerHTML = res.recentAllocations.map(a => `
              <tr>
                <td><strong>${a.subject}</strong></td>
                <td><span class="badge badge-occupied">${a.room_number}</span></td>
                <td>${a.faculty_name}</td>
                <td>${a.allocation_date}</td>
                <td>${a.start_time} - ${a.end_time}</td>
                <td><span class="badge badge-${a.status}">${a.status}</span></td>
              </tr>
            `).join('');
          }
        }

        // Render Upcoming Classes feed
        const upcomingContainer = document.getElementById('upcoming-classes-container');
        if (upcomingContainer) {
          if (!res.upcomingClasses || res.upcomingClasses.length === 0) {
            upcomingContainer.innerHTML = `<p class="empty-state">No upcoming classes scheduled today.</p>`;
          } else {
            upcomingContainer.innerHTML = res.upcomingClasses.map(c => `
              <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.65rem 0; border-bottom: 1px solid var(--color-border-subtle);">
                <div>
                  <div style="font-weight: 600; font-size: 0.85rem; color: var(--color-text-main);">${c.subject}</div>
                  <div style="font-size: 0.75rem; color: var(--color-text-muted);">${c.room_number} • ${c.faculty_name} (${c.student_group})</div>
                </div>
                <div style="text-align: right;">
                  <div style="font-weight: 700; font-size: 0.8rem; color: var(--color-primary);">${c.start_time}</div>
                  <div style="font-size: 0.7rem; color: var(--color-text-subtle);">${c.allocation_date}</div>
                </div>
              </div>
            `).join('');
          }
        }
      }
    } catch (err) {
      console.error('Failed to load recent activity:', err);
    }
  }
};

window.Dashboard = Dashboard;
