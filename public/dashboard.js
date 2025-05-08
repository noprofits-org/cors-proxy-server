// dashboard.js - JavaScript for CORS Proxy Monitoring Dashboard

// Configuration
const CONFIG = {
    // Updated to match your Vercel deployment URL
    apiBaseUrl: 'https://cors-proxy-xi-ten.vercel.app/api',
    refreshInterval: 30000, // Auto-refresh every 30 seconds
    maxTableRows: 100,      // Maximum rows to display in the table
    chartColors: {
        blue: 'rgba(52, 152, 219, 0.8)',
        lightBlue: 'rgba(52, 152, 219, 0.2)',
        green: 'rgba(46, 204, 113, 0.8)',
        orange: 'rgba(243, 156, 18, 0.8)',
        red: 'rgba(231, 76, 60, 0.8)',
        purple: 'rgba(155, 89, 182, 0.8)',
        gray: 'rgba(149, 165, 166, 0.8)'
    }
};

// Chart instances
let trafficChart = null;
let domainsChart = null;
let methodsChart = null;

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', () => {
    // Initialize charts
    initializeCharts();
    
    // Load initial data
    refreshData();
    
    // Set up event listeners
    document.getElementById('refresh-btn').addEventListener('click', refreshData);
    document.getElementById('timeframe').addEventListener('change', refreshData);
    document.getElementById('domain-filter').addEventListener('input', debounce(refreshData, 500));
    
    // Set up auto-refresh
    setInterval(refreshData, CONFIG.refreshInterval);
});

// Initialize all charts
function initializeCharts() {
    // Traffic over time chart
    const trafficCtx = document.getElementById('traffic-chart').getContext('2d');
    trafficChart = new Chart(trafficCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Requests',
                data: [],
                backgroundColor: CONFIG.chartColors.lightBlue,
                borderColor: CONFIG.chartColors.blue,
                borderWidth: 2,
                tension: 0.2,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    }
                }
            }
        }
    });
    
    // Top domains chart
    const domainsCtx = document.getElementById('domains-chart').getContext('2d');
    domainsChart = new Chart(domainsCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Requests',
                data: [],
                backgroundColor: [
                    CONFIG.chartColors.blue,
                    CONFIG.chartColors.green,
                    CONFIG.chartColors.orange,
                    CONFIG.chartColors.purple,
                    CONFIG.chartColors.red
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    }
                }
            }
        }
    });
    
    // HTTP methods chart
    const methodsCtx = document.getElementById('methods-chart').getContext('2d');
    methodsChart = new Chart(methodsCtx, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [
                    CONFIG.chartColors.blue,
                    CONFIG.chartColors.green,
                    CONFIG.chartColors.orange,
                    CONFIG.chartColors.purple,
                    CONFIG.chartColors.red
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right'
                }
            }
        }
    });
}

// Fetch log data from the API
async function fetchLogs() {
    try {
        const timeframe = document.getElementById('timeframe').value;
        const domainFilter = document.getElementById('domain-filter').value.trim();
        
        let url = `${CONFIG.apiBaseUrl}/logs`;
        
        // Add query parameters if needed
        const params = new URLSearchParams();
        if (timeframe && timeframe !== '0') {
            params.append('timeframe', timeframe);
        }
        if (domainFilter) {
            params.append('domain', domainFilter);
        }
        
        if (params.toString()) {
            url += `?${params.toString()}`;
        }
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error fetching logs:', error);
        // Show error message on dashboard
        alert(`Failed to fetch log data: ${error.message}`);
        return { logs: [] };
    }
}

// Refresh all dashboard data
async function refreshData() {
    const data = await fetchLogs();
    
    if (!data || !data.logs) {
        return;
    }
    
    // Update summary statistics
    updateSummaryStats(data.logs);
    
    // Update charts
    updateTrafficChart(data.logs);
    updateDomainsChart(data.logs);
    updateMethodsChart(data.logs);
    
    // Update requests table
    updateRequestsTable(data.logs);
}

// Update the summary statistics card
function updateSummaryStats(logs) {
    const totalRequests = logs.length;
    
    // Calculate average response time
    let totalResponseTime = 0;
    logs.forEach(log => {
        totalResponseTime += log.responseTime;
    });
    const avgResponseTime = totalRequests > 0 ? Math.round(totalResponseTime / totalRequests) : 0;
    
    // Calculate success rate (2xx and 3xx status codes)
    const successfulRequests = logs.filter(log => log.responseStatus < 400).length;
    const successRate = totalRequests > 0 ? Math.round((successfulRequests / totalRequests) * 100) : 0;
    
    // Calculate total data transferred
    let totalData = 0;
    logs.forEach(log => {
        totalData += log.responseSize;
    });
    
    // Convert bytes to human-readable format
    const totalDataFormatted = formatBytes(totalData);
    
    // Update the DOM
    document.getElementById('total-requests').textContent = totalRequests;
    document.getElementById('avg-response-time').textContent = `${avgResponseTime}ms`;
    document.getElementById('success-rate').textContent = `${successRate}%`;
    document.getElementById('total-data').textContent = totalDataFormatted;
}

// Update the traffic over time chart
function updateTrafficChart(logs) {
    // Group requests by time intervals
    const timeIntervals = {};
    
    // Determine appropriate interval based on timeframe
    const timeframe = parseInt(document.getElementById('timeframe').value, 10);
    let intervalMinutes;
    
    if (timeframe === 0 || timeframe > 1440) {
        // All time or more than a day - use hours
        intervalMinutes = 60;
    } else if (timeframe > 180) {
        // More than 3 hours - use 30 minute intervals
        intervalMinutes = 30;
    } else if (timeframe > 60) {
        // More than 1 hour - use 10 minute intervals
        intervalMinutes = 10;
    } else {
        // Less than an hour - use 5 minute intervals
        intervalMinutes = 5;
    }
    
    // Round down timestamps to the nearest interval
    logs.forEach(log => {
        const timestamp = new Date(log.timestamp);
        // Round down to nearest interval
        timestamp.setMinutes(Math.floor(timestamp.getMinutes() / intervalMinutes) * intervalMinutes);
        timestamp.setSeconds(0);
        timestamp.setMilliseconds(0);
        
        const timeKey = timestamp.toISOString();
        if (!timeIntervals[timeKey]) {
            timeIntervals[timeKey] = 0;
        }
        timeIntervals[timeKey]++;
    });
    
    // Sort timestamps
    const sortedTimestamps = Object.keys(timeIntervals).sort();
    
    // Prepare chart data
    const labels = sortedTimestamps.map(timestamp => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    });
    
    const data = sortedTimestamps.map(timestamp => timeIntervals[timestamp]);
    
    // Update chart
    trafficChart.data.labels = labels;
    trafficChart.data.datasets[0].data = data;
    trafficChart.update();
}

// Update the top domains chart
function updateDomainsChart(logs) {
    // Extract domains from target URLs
    const domains = {};
    
    logs.forEach(log => {
        try {
            const url = new URL(log.targetUrl);
            const domain = url.hostname;
            
            if (!domains[domain]) {
                domains[domain] = 0;
            }
            domains[domain]++;
        } catch (e) {
            // Skip invalid URLs
        }
    });
    
    // Sort domains by request count (descending)
    const sortedDomains = Object.entries(domains)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10); // Show top 10 domains
    
    // Prepare chart data
    const labels = sortedDomains.map(([domain]) => domain);
    const data = sortedDomains.map(([, count]) => count);
    
    // Update chart
    domainsChart.data.labels = labels;
    domainsChart.data.datasets[0].data = data;
    domainsChart.update();
}

// Update the HTTP methods chart
function updateMethodsChart(logs) {
    // Count requests by method
    const methods = {};
    
    logs.forEach(log => {
        const method = log.method;
        if (!methods[method]) {
            methods[method] = 0;
        }
        methods[method]++;
    });
    
    // Sort methods by request count (descending)
    const sortedMethods = Object.entries(methods)
        .sort((a, b) => b[1] - a[1]);
    
    // Prepare chart data
    const labels = sortedMethods.map(([method]) => method);
    const data = sortedMethods.map(([, count]) => count);
    
    // Update chart
    methodsChart.data.labels = labels;
    methodsChart.data.datasets[0].data = data;
    methodsChart.update();
}

// Update the recent requests table
function updateRequestsTable(logs) {
    const tableBody = document.getElementById('requests-table-body');
    
    // Clear existing rows
    tableBody.innerHTML = '';
    
    // Sort logs by timestamp (newest first)
    const sortedLogs = [...logs].sort((a, b) => {
        return new Date(b.timestamp) - new Date(a.timestamp);
    }).slice(0, CONFIG.maxTableRows);
    
    // Add new rows
    sortedLogs.forEach(log => {
        const row = document.createElement('tr');
        
        // Extract domain from URL
        let domain = '';
        try {
            const url = new URL(log.targetUrl);
            domain = url.hostname;
        } catch (e) {
            domain = log.targetUrl;
        }
        
        // Determine status class
        let statusClass = '';
        if (log.responseStatus < 300) {
            statusClass = 'status-success';
        } else if (log.responseStatus < 400) {
            statusClass = 'status-redirect';
        } else {
            statusClass = 'status-error';
        }
        
        // Format timestamp
        const timestamp = new Date(log.timestamp);
        const formattedTime = timestamp.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
        });
        
        // Build row HTML
        row.innerHTML = `
            <td>${formattedTime}</td>
            <td>${log.method}</td>
            <td title="${log.targetUrl}">${domain}</td>
            <td><span class="status ${statusClass}">${log.responseStatus}</span></td>
            <td>${log.responseTime}ms</td>
            <td>${formatBytes(log.responseSize)}</td>
        `;
        
        tableBody.appendChild(row);
    });
}

// Helper function to format bytes to a human-readable format
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

// Helper function to debounce function calls
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}