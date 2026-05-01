// Expense & Budget Visualizer - Main Application
// Single JavaScript file containing all application logic

'use strict';

// ============================================
// Custom Error Classes
// ============================================

class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.field = field;
    this.name = 'ValidationError';
  }
}

class StorageError extends Error {
  constructor(message, operation) {
    super(message);
    this.operation = operation;
    this.name = 'StorageError';
  }
}

class ChartError extends Error {
  constructor(message, chartType) {
    super(message);
    this.chartType = chartType;
    this.name = 'ChartError';
  }
}

class SerializationError extends Error {
  constructor(message, originalError) {
    super(message);
    this.name = 'SerializationError';
    this.originalError = originalError;
  }
}

class DeserializationError extends Error {
  constructor(message, originalError) {
    super(message);
    this.name = 'DeserializationError';
    this.originalError = originalError;
  }
}

// ============================================
// Transaction Manager
// ============================================

class TransactionManager {
  constructor() {
    this.transactions = [];
    this.storageKey = 'expenseTracker_transactions';
    this.version = '1.0';
  }

  /**
   * Add a new transaction with validation
   * @param {string} item - Item name (1-100 characters)
   * @param {number} amount - Positive amount with max 2 decimal places
   * @param {string} category - Category name (1-50 characters, letters/numbers/spaces/hyphens/ampersands)
   * @returns {string} Transaction ID
   */
  addTransaction(item, amount, category) {
    const transaction = {
      id: this.generateId(),
      item: item.trim(),
      amount: parseFloat(amount.toFixed(2)),
      category: category.toLowerCase(),
      timestamp: new Date().toISOString()
    };

    this.transactions.push(transaction);
    this.saveToStorage();
    return transaction.id;
  }

  /**
   * Delete transaction by ID
   * @param {string} id - Transaction ID to delete
   * @returns {boolean} Success status
   */
  deleteTransaction(id) {
    const initialLength = this.transactions.length;
    this.transactions = this.transactions.filter(t => t.id !== id);
    const success = this.transactions.length < initialLength;
    if (success) this.saveToStorage();
    return success;
  }

  /**
   * Get all transactions sorted by timestamp (newest first)
   * @returns {Array} Sorted transactions
   */
  getTransactions() {
    return [...this.transactions].sort((a, b) =>
      new Date(b.timestamp) - new Date(a.timestamp)
    );
  }

  /**
   * Save transactions to LocalStorage with versioning
   */
  saveToStorage() {
    try {
      const data = {
        transactions: this.transactions,
        version: this.version,
        lastUpdated: new Date().toISOString()
      };
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save to LocalStorage:', error);
      throw new StorageError('Failed to save transactions', 'save');
    }
  }

  /**
   * Load transactions from LocalStorage with error recovery
   */
  loadFromStorage() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) {
        this.transactions = [];
        return;
      }

      const data = JSON.parse(stored);

      // Validate data structure
      if (!data.transactions || !Array.isArray(data.transactions)) {
        throw new Error('Invalid transaction data structure');
      }

      // Migrate data if version mismatch
      if (data.version !== this.version) {
        this.transactions = this.migrateData(data.transactions, data.version);
      } else {
        this.transactions = data.transactions;
      }
    } catch (error) {
      console.warn('Failed to load from LocalStorage, using empty data:', error);
      this.transactions = [];
    }
  }

  /**
   * Generate unique transaction ID
   * @returns {string} Unique ID
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Clear all transactions
   */
  clearAll() {
    this.transactions = [];
    localStorage.removeItem(this.storageKey);
  }

  /**
   * Migrate data from older versions
   * @private
   */
  migrateData(oldTransactions, oldVersion) {
    // Handle data migration logic
    return oldTransactions.map(t => ({
      ...t,
      // Ensure all required fields exist
      id: t.id || this.generateId(),
      timestamp: t.timestamp || new Date().toISOString()
    }));
  }
}

// ============================================
// Form Validator
// ============================================

class FormValidator {
  constructor(formElement) {
    this.form = formElement;
    this.errors = new Map();
    this.setupEventListeners();
  }

  /**
   * Validate entire form
   * @returns {boolean} Form validity
   */
  validateForm() {
    this.clearErrors();

    const itemInput = this.form.querySelector('#item-name');
    const amountInput = this.form.querySelector('#amount');
    const categorySelect = this.form.querySelector('#category');

    let isValid = true;

    // Validate item name
    if (!this.validateItem(itemInput.value)) {
      this.showError('item-name', 'Item name must be 1-100 characters');
      isValid = false;
    }

    // Validate amount
    try {
      this.validateAmount(parseFloat(amountInput.value));
    } catch (error) {
      this.showError('amount', error.message);
      isValid = false;
    }

    // Validate category
    const categoryValue = categorySelect.value.trim();
    if (!this.validateCategory(categoryValue)) {
      this.showError('category', 'Category must be 1-50 characters and can only contain letters, numbers, spaces, hyphens, and ampersands');
      isValid = false;
    }

    return isValid;
  }

  /**
   * Validate item name
   * @param {string} item - Item name
   * @returns {boolean} Validity
   */
  validateItem(item) {
    const trimmed = item.trim();
    return trimmed.length >= 1 && trimmed.length <= 100;
  }

  /**
   * Validate amount with strict rules
   * @param {number} amount - Amount to validate
   * @throws {ValidationError} If validation fails
   */
  validateAmount(amount) {
    if (typeof amount !== 'number' || isNaN(amount)) {
      throw new ValidationError('Amount must be a number', 'amount');
    }

    if (amount <= 0) {
      throw new ValidationError('Amount must be positive', 'amount');
    }

    // Check decimal places
    const decimalPlaces = (amount.toString().split('.')[1] || '').length;
    if (decimalPlaces > 2) {
      throw new ValidationError('Amount can have maximum 2 decimal places', 'amount');
    }

    // Check reasonable maximum (prevent overflow)
    if (amount > 1000000) {
      throw new ValidationError('Amount cannot exceed $1,000,000', 'amount');
    }

    return true;
  }

  /**
   * Validate category selection
   * @param {string} category - Selected category
   * @returns {boolean} Validity
   */
  validateCategory(category) {
    const trimmedCategory = category.trim();
    // Kategori harus memiliki 1-50 karakter dan hanya boleh mengandung huruf, angka, dan spasi
    if (trimmedCategory.length < 1 || trimmedCategory.length > 50) {
      return false;
    }

    // Validasi karakter yang diperbolehkan: huruf, angka, spasi, dan beberapa simbol umum
    const validPattern = /^[a-zA-Z0-9\s\-&]+$/;
    return validPattern.test(trimmedCategory);
  }

  /**
   * Show error for specific field
   * @param {string} fieldId - Field ID
   * @param {string} message - Error message
   */
  showError(fieldId, message) {
    const field = this.form.querySelector(`#${fieldId}`);
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.id = `${fieldId}-error`;
    errorElement.textContent = message;
    errorElement.setAttribute('role', 'alert');
    errorElement.setAttribute('aria-live', 'polite');

    // Insert after field
    field.parentNode.insertBefore(errorElement, field.nextSibling);

    // Add error class to field
    field.classList.add('error');
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute('aria-describedby', `${fieldId}-error`);

    this.errors.set(fieldId, errorElement);
  }

  /**
   * Clear all errors
   */
  clearErrors() {
    this.errors.forEach((errorElement, fieldId) => {
      const field = this.form.querySelector(`#${fieldId}`);
      if (field) {
        field.classList.remove('error');
        field.removeAttribute('aria-invalid');
        field.removeAttribute('aria-describedby');
      }
      errorElement.remove();
    });
    this.errors.clear();
  }

  /**
   * Reset form to initial state
   */
  resetForm() {
    this.form.reset();
    this.clearErrors();

    // Focus on first field for accessibility
    const firstField = this.form.querySelector('input, select');
    if (firstField) firstField.focus();
  }

  /**
   * Setup real-time validation listeners
   * @private
   */
  setupEventListeners() {
    const amountInput = this.form.querySelector('#amount');
    const itemInput = this.form.querySelector('#item-name');

    // Real-time amount validation
    amountInput.addEventListener('input', () => {
      const value = amountInput.value;
      if (value) {
        try {
          this.validateAmount(parseFloat(value));
          this.clearFieldError('amount');
          amountInput.classList.remove('error');
          amountInput.setAttribute('aria-invalid', 'false');
        } catch (error) {
          this.showError('amount', error.message);
        }
      } else {
        this.clearFieldError('amount');
      }
    });

    // Real-time item validation
    itemInput.addEventListener('input', () => {
      if (itemInput.value.trim()) {
        if (this.validateItem(itemInput.value)) {
          this.clearFieldError('item-name');
          itemInput.classList.remove('error');
          itemInput.setAttribute('aria-invalid', 'false');
        } else {
          this.showError('item-name', 'Item name must be 1-100 characters');
        }
      } else {
        this.clearFieldError('item-name');
      }
    });
  }

  /**
   * Clear error for specific field
   * @private
   */
  clearFieldError(fieldId) {
    const errorElement = this.errors.get(fieldId);
    if (errorElement) {
      const field = this.form.querySelector(`#${fieldId}`);
      if (field) {
        field.classList.remove('error');
        field.removeAttribute('aria-invalid');
        field.removeAttribute('aria-describedby');
      }
      errorElement.remove();
      this.errors.delete(fieldId);
    }
  }
}

// ============================================
// Balance Calculator
// ============================================

class BalanceCalculator {
  constructor(displayElement) {
    this.display = displayElement;
    this.cache = new Map(); // Cache calculations for performance
    this.lastTotal = 0;
    this.animationFrame = null;
  }

  /**
   * Calculate total balance from transactions
   * @param {Array} transactions - Array of transaction objects
   * @returns {number} Total balance
   */
  calculateTotal(transactions) {
    const cacheKey = transactions.map(t => t.id).join(',');

    // Return cached result if available
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Calculate total
    const total = transactions.reduce((sum, transaction) => {
      return sum + (transaction.amount || 0);
    }, 0);

    // Cache result
    this.cache.set(cacheKey, total);

    // Limit cache size
    if (this.cache.size > 100) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    return total;
  }

  /**
   * Update balance display with smooth animation
   * @param {number} total - Total balance to display
   */
  updateDisplay(total) {
    // Cancel any pending animation
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }

    // Use requestAnimationFrame for smooth updates
    this.animationFrame = requestAnimationFrame(() => {
      const formatted = this.formatCurrency(total);
      this.display.textContent = formatted;
      this.display.setAttribute('aria-live', 'polite');
      this.display.setAttribute('aria-atomic', 'true');

      // Add visual feedback for changes
      if (total !== this.lastTotal) {
        this.animateChange(total > this.lastTotal ? 'increase' : 'decrease');
        this.lastTotal = total;
      }
    });
  }

  /**
   * Format amount as currency
   * @param {number} amount - Amount to format
   * @returns {string} Formatted currency string
   */
  formatCurrency(amount) {
    // Use Intl.NumberFormat for proper localization
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    return formatter.format(amount);
  }

  /**
   * Animate balance change for visual feedback
   * @private
   */
  animateChange(direction) {
    this.display.classList.remove('balance-increase', 'balance-decrease');

    // Force reflow
    void this.display.offsetWidth;

    // Add animation class
    this.display.classList.add(`balance-${direction}`);

    // Remove class after animation completes
    setTimeout(() => {
      this.display.classList.remove(`balance-${direction}`);
    }, 600);
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get formatted balance for screen readers
   * @param {number} total - Total balance
   * @returns {string} Accessible description
   */
  getAccessibleDescription(total) {
    const formatted = this.formatCurrency(total);
    return `Total balance is ${formatted}`;
  }
}

// ============================================
// Chart Visualizer
// ============================================

class ChartVisualizer {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.chart = null;
    this.colorPalette = [
      '#4F46E5', // Indigo
      '#10B981', // Emerald
      '#8B5CF6', // Violet
      '#F59E0B', // Amber
      '#EF4444', // Red
      '#8B5CF6', // Purple
      '#06B6D4', // Cyan
      '#84CC16', // Lime
      '#F97316', // Orange
      '#EC4899', // Pink
      '#6366F1', // Indigo (light)
      '#14B8A6', // Teal
      '#F43F5E', // Rose
      '#A855F7', // Purple (light)
      '#3B82F6', // Blue
    ];
    this.colorMap = new Map(); // Untuk mapping kategori ke warna
    this.lastDataHash = '';
    this.debounceTimer = null;
  }

  /**
   * Get color for a category (dynamically assigned)
   * @param {string} category - Category name
   * @returns {string} Color hex code
   */
  getColorForCategory(category) {
    if (!this.colorMap.has(category)) {
      // Assign a color from the palette based on hash of category name
      const index = this.hashString(category) % this.colorPalette.length;
      this.colorMap.set(category, this.colorPalette[index]);
    }
    return this.colorMap.get(category);
  }

  /**
   * Simple string hash function
   * @param {string} str - String to hash
   * @returns {number} Hash code
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Create or update chart with transaction data
   * @param {Array} transactions - Array of transaction objects
   */
  updateChart(transactions) {
    // Debounce updates for performance
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this._updateChartImmediate(transactions);
    }, 100);
  }

  /**
   * Immediate chart update (called after debounce)
   * @private
   */
  _updateChartImmediate(transactions) {
    const categoryData = this.getCategoryData(transactions);
    const dataHash = JSON.stringify(categoryData);

    // Skip update if data hasn't changed
    if (dataHash === this.lastDataHash && this.chart) {
      return;
    }

    this.lastDataHash = dataHash;

    try {
      if (!this.chart) {
        this.createChart(categoryData);
      } else {
        this.updateChartData(categoryData);
      }
    } catch (error) {
      console.error('Chart update failed:', error);
      this.showChartFallback(transactions);
    }
  }

  /**
   * Create new chart instance
   * @param {Object} categoryData - Data for each category
   */
  createChart(categoryData) {
    // Ensure Chart.js is loaded
    if (typeof Chart === 'undefined') {
      throw new ChartError('Chart.js library not loaded', 'pie');
    }

    const ctx = this.canvas.getContext('2d');

    this.chart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: Object.keys(categoryData).map(cat =>
          cat.charAt(0).toUpperCase() + cat.slice(1)
        ),
        datasets: [{
          data: Object.values(categoryData),
          backgroundColor: Object.keys(categoryData).map(cat =>
            this.getColorForCategory(cat)
          ),
          borderWidth: 2,
          borderColor: '#FFFFFF'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 20,
              usePointStyle: true,
              font: {
                family: 'Inter, sans-serif',
                size: 14
              }
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.label || '';
                const value = context.raw || 0;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                return `${label}: ${value.toFixed(2)} (${percentage}%)`;
              }
            }
          }
        },
        animation: {
          duration: 500,
          easing: 'easeOutQuart'
        }
      }
    });

    // Make chart accessible
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', 'Spending distribution by category');
  }

  /**
   * Update existing chart with new data
   * @param {Object} categoryData - New category data
   */
  updateChartData(categoryData) {
    if (!this.chart) return;

    this.chart.data.labels = Object.keys(categoryData).map(cat =>
      cat.charAt(0).toUpperCase() + cat.slice(1)
    );
    this.chart.data.datasets[0].data = Object.values(categoryData);
    this.chart.data.datasets[0].backgroundColor = Object.keys(categoryData).map(cat =>
      this.getColorForCategory(cat)
    );

    this.chart.update('none'); // Update without animation for performance
  }

  /**
   * Get category totals from transactions
   * @param {Array} transactions - Array of transaction objects
   * @returns {Object} Category totals
   */
  getCategoryData(transactions) {
    const result = {};

    transactions.forEach(transaction => {
      const category = transaction.category.toLowerCase();
      if (!result[category]) {
        result[category] = 0;
      }
      result[category] += transaction.amount || 0;
    });

    // Round to 2 decimal places
    Object.keys(result).forEach(key => {
      result[key] = parseFloat(result[key].toFixed(2));
    });

    return result;
  }

  /**
   * Destroy chart instance
   */
  destroyChart() {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
      this.lastDataHash = '';
    }
  }

  /**
   * Show fallback when chart rendering fails
   * @param {Array} transactions - Transaction data
   */
  showChartFallback(transactions) {
    const categoryData = this.getCategoryData(transactions);
    const fallbackElement = document.createElement('div');
    fallbackElement.className = 'chart-fallback';
    fallbackElement.setAttribute('role', 'region');
    fallbackElement.setAttribute('aria-label', 'Spending summary (chart unavailable)');

    let html = '<h3>Spending Summary</h3><ul>';
    Object.entries(categoryData).forEach(([category, amount]) => {
      if (amount > 0) {
        html += `<li><span class="category-badge" style="background-color: ${this.getColorForCategory(category)}"></span>`;
        html += `${category.charAt(0).toUpperCase() + category.slice(1)}: ${amount.toFixed(2)}</li>`;
      }
    });

    if (Object.values(categoryData).every(v => v === 0)) {
      html += '<li>No spending data available</li>';
    }

    html += '</ul>';
    fallbackElement.innerHTML = html;

    // Replace canvas with fallback
    this.canvas.parentNode.replaceChild(fallbackElement, this.canvas);
  }

  /**
   * Resize chart for responsive design
   */
  resizeChart() {
    if (this.chart) {
      this.chart.resize();
    }
  }

  /**
   * Get chart as image data URL
   * @returns {string} Data URL or empty string
   */
  getChartAsImage() {
    if (!this.chart) return '';
    return this.canvas.toDataURL('image/png');
  }
}

// ============================================
// Data Serializer/Parser
// ============================================

class DataSerializer {
  constructor() {
    this.currentVersion = '1.0';
    this.schema = {
      transactions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', pattern: '^[a-zA-Z0-9-_]+' },
            item: { type: 'string', minLength: 1, maxLength: 100 },
            amount: { type: 'number', minimum: 0, maximum: 1000000 },
            category: { type: 'string', minLength: 1, maxLength: 50, pattern: '^[a-zA-Z0-9\\s\\-&]+' },
            timestamp: { type: 'string', format: 'date-time' }
          },
          required: ['id', 'item', 'amount', 'category', 'timestamp']
        }
      },
      version: { type: 'string', pattern: '^\\d+\\.\\d+' },
      lastUpdated: { type: 'string', format: 'date-time' }
    };
  }

  /**
   * Serialize transactions to JSON with validation
   * @param {Array} transactions - Transaction array
   * @returns {string} JSON string
   * @throws {ValidationError} If data validation fails
   */
  serialize(transactions) {
    // Validate transactions before serialization
    this.validateTransactions(transactions);

    const data = {
      transactions: transactions,
      version: this.currentVersion,
      lastUpdated: new Date().toISOString()
    };

    try {
      return JSON.stringify(data, null, 2);
    } catch (error) {
      throw new SerializationError('Failed to serialize transactions', error);
    }
  }

  /**
   * Deserialize JSON string to transactions with error recovery
   * @param {string} jsonString - JSON string from LocalStorage
   * @returns {Array} Transaction array
   */
  deserialize(jsonString) {
    if (!jsonString || jsonString.trim() === '') {
      return [];
    }

    try {
      const data = JSON.parse(jsonString);

      // Validate JSON structure
      if (!this.validateJSONStructure(data)) {
        console.warn('Invalid JSON structure, returning empty array');
        return [];
      }

      // Handle version migration if needed
      if (data.version !== this.currentVersion) {
        return this.migrateData(data.transactions, data.version);
      }

      // Validate and clean transaction data
      return this.validateAndCleanTransactions(data.transactions);

    } catch (error) {
      console.error('Failed to deserialize JSON:', error);
      throw new DeserializationError('Failed to parse transaction data', error);
    }
  }

  /**
   * Validate JSON structure against schema
   * @param {Object} data - Parsed JSON data
   * @returns {boolean} Validity
   */
  validateJSONStructure(data) {
    if (!data || typeof data !== 'object') return false;
    if (!data.transactions || !Array.isArray(data.transactions)) return false;
    if (!data.version || typeof data.version !== 'string') return false;
    return true;
  }

  /**
   * Validate transaction array
   * @param {Array} transactions - Transaction array
   * @throws {ValidationError} If validation fails
   */
  validateTransactions(transactions) {
    if (!Array.isArray(transactions)) {
      throw new ValidationError('Transactions must be an array', 'transactions');
    }

    transactions.forEach((transaction, index) => {
      // Check required fields
      const requiredFields = ['id', 'item', 'amount', 'category', 'timestamp'];
      requiredFields.forEach(field => {
        if (!transaction.hasOwnProperty(field)) {
          throw new ValidationError(
            `Transaction at index ${index} missing required field: ${field}`,
            `transaction.${index}.${field}`
          );
        }
      });

      // Validate field types and constraints
      if (typeof transaction.item !== 'string' || transaction.item.trim().length === 0) {
        throw new ValidationError(
          `Transaction at index ${index} has invalid item name`,
          `transaction.${index}.item`
        );
      }

      if (typeof transaction.amount !== 'number' || isNaN(transaction.amount)) {
        throw new ValidationError(
          `Transaction at index ${index} has invalid amount`,
          `transaction.${index}.amount`
        );
      }

      if (transaction.amount < 0 || transaction.amount > 1000000) {
        throw new ValidationError(
          `Transaction at index ${index} amount out of range (0-1,000,000)`,
          `transaction.${index}.amount`
        );
      }

      // Validate category format (1-50 characters, letters/numbers/spaces/hyphens/ampersands)
      const trimmedCategory = transaction.category.trim();
      if (trimmedCategory.length < 1 || trimmedCategory.length > 50) {
        throw new ValidationError(
          `Transaction at index ${index} category must be 1-50 characters`,
          `transaction.${index}.category`
        );
      }

      const validPattern = /^[a-zA-Z0-9\s\-&]+$/;
      if (!validPattern.test(trimmedCategory)) {
        throw new ValidationError(
          `Transaction at index ${index} category can only contain letters, numbers, spaces, hyphens, and ampersands`,
          `transaction.${index}.category`
        );
      }
    });
  }

  /**
   * Validate and clean transaction data
   * @param {Array} transactions - Raw transaction data
   * @returns {Array} Cleaned transaction array
   */
  validateAndCleanTransactions(transactions) {
    if (!Array.isArray(transactions)) return [];

    return transactions
      .filter(transaction => {
        // Basic type checking
        if (!transaction || typeof transaction !== 'object') return false;

        // Check required fields exist
        const hasRequiredFields = ['id', 'item', 'amount', 'category', 'timestamp']
          .every(field => transaction.hasOwnProperty(field));
        if (!hasRequiredFields) return false;

        // Type validation
        if (typeof transaction.item !== 'string') return false;
        if (typeof transaction.amount !== 'number' || isNaN(transaction.amount)) return false;
        if (typeof transaction.category !== 'string') return false;

        // Value validation
        if (transaction.item.trim().length === 0) return false;
        if (transaction.amount < 0 || transaction.amount > 1000000) return false;

        // Validate category format (1-50 characters, letters/numbers/spaces/hyphens/ampersands)
        const trimmedCategory = transaction.category.trim();
        if (trimmedCategory.length < 1 || trimmedCategory.length > 50) return false;

        const validPattern = /^[a-zA-Z0-9\s\-&]+$/;
        if (!validPattern.test(trimmedCategory)) return false;

        return true;
      })
      .map(transaction => ({
        // Ensure consistent format
        id: String(transaction.id),
        item: transaction.item.trim(),
        amount: parseFloat(transaction.amount.toFixed(2)),
        category: transaction.category.toLowerCase(),
        timestamp: transaction.timestamp || new Date().toISOString()
      }));
  }

  /**
   * Migrate data from older versions
   * @param {Array} oldTransactions - Old transaction data
   * @param {string} oldVersion - Old version string
   * @returns {Array} Migrated transactions
   */
  migrateData(oldTransactions, oldVersion) {
    console.log(`Migrating data from version ${oldVersion} to ${this.currentVersion}`);

    // For now, just validate and clean the data
    // In a real application, this would handle specific migration logic
    return this.validateAndCleanTransactions(oldTransactions);
  }

  /**
   * Handle corrupted data recovery
   * @param {string} jsonString - Corrupted JSON string
   * @returns {Array} Recovered transactions or empty array
   */
  handleCorruption(jsonString) {
    console.warn('Attempting to recover corrupted data');

    try {
      // Try to extract valid JSON using regex
      const jsonMatch = jsonString.match(/\{.*\}/s);
      if (jsonMatch) {
        const recovered = JSON.parse(jsonMatch[0]);
        if (recovered.transactions && Array.isArray(recovered.transactions)) {
          return this.validateAndCleanTransactions(recovered.transactions);
        }
      }
    } catch (error) {
      console.error('Data recovery failed:', error);
    }

    // Return empty array if recovery fails
    return [];
  }

  /**
   * Test round-trip property: serialize → deserialize = original
   * @param {Array} transactions - Original transactions
   * @returns {boolean} Round-trip success
   */
  testRoundTrip(transactions) {
    try {
      const serialized = this.serialize(transactions);
      const deserialized = this.deserialize(serialized);

      // Compare ignoring timestamps and IDs (which may be regenerated)
      const normalizedOriginal = transactions.map(t => ({
        item: t.item.trim(),
        amount: parseFloat(t.amount.toFixed(2)),
        category: t.category.toLowerCase()
      }));

      const normalizedDeserialized = deserialized.map(t => ({
        item: t.item.trim(),
        amount: parseFloat(t.amount.toFixed(2)),
        category: t.category.toLowerCase()
      }));

      return JSON.stringify(normalizedOriginal) === JSON.stringify(normalizedDeserialized);
    } catch (error) {
      console.error('Round-trip test failed:', error);
      return false;
    }
  }
}

// ============================================
// Main Application
// ============================================

(function () {
  'use strict';

  // DOM Elements
  const expenseForm = document.getElementById('expense-form');
  const transactionsList = document.getElementById('transactions-list');
  const balanceDisplay = document.querySelector('.balance-amount');
  const chartCanvas = document.getElementById('spending-chart');
  const sortSelect = document.getElementById('sort-by');

  // Initialize components
  const transactionManager = new TransactionManager();
  const formValidator = new FormValidator(expenseForm);
  const balanceCalculator = new BalanceCalculator(balanceDisplay);
  const chartVisualizer = new ChartVisualizer(chartCanvas);
  const dataSerializer = new DataSerializer();

  // Sorting state
  let currentSort = 'newest'; // Default sort: newest first

  // Event Listeners
  expenseForm.addEventListener('submit', handleFormSubmit);
  sortSelect.addEventListener('change', handleSortChange);

  // Delete all button
  const deleteAllBtn = document.getElementById('delete-all-btn');
  if (deleteAllBtn) {
    deleteAllBtn.addEventListener('click', handleDeleteAll);
  }

  // Theme toggle
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', handleThemeToggle);
  }

  // Initialization
  function init() {
    // Initialize theme
    initTheme();

    transactionManager.loadFromStorage();

    // Jika tidak ada data, tambahkan beberapa contoh untuk testing
    if (transactionManager.transactions.length === 0) {
      addSampleTransactions();
    }

    updateUI();
  }

  // Handle sort change
  function handleSortChange() {
    currentSort = sortSelect.value;
    updateUI();
  }

  // Handle delete all transactions
  function handleDeleteAll() {
    const transactionCount = transactionManager.transactions.length;

    if (transactionCount === 0) {
      showTemporaryMessage('No transactions to delete');
      return;
    }

    // Validation: confirm with user
    const confirmMessage = `Are you sure you want to delete all ${transactionCount} transactions? This action cannot be undone.`;

    if (confirm(confirmMessage)) {
      // Double validation for safety
      const doubleCheck = confirm(`Final warning: This will permanently delete ${transactionCount} transactions. Click OK to proceed.`);

      if (doubleCheck) {
        transactionManager.clearAll();
        showTemporaryMessage(`Successfully deleted ${transactionCount} transactions`);
        updateUI();
      } else {
        showTemporaryMessage('Delete cancelled');
      }
    }
  }

  // Handle theme toggle
  function handleThemeToggle() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', newTheme);
    updateThemeIcon(newTheme);

    // Save preference to localStorage
    localStorage.setItem('expenseTracker_theme', newTheme);

    showTemporaryMessage(`Switched to ${newTheme} theme`);
  }

  // Update theme icon based on current theme
  function updateThemeIcon(theme) {
    const themeIcon = document.querySelector('.theme-icon');
    if (!themeIcon) return;

    themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    themeIcon.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  }

  // Initialize theme from localStorage or system preference
  function initTheme() {
    const savedTheme = localStorage.getItem('expenseTracker_theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    let theme = 'light'; // default

    if (savedTheme) {
      theme = savedTheme;
    } else if (systemPrefersDark) {
      theme = 'dark';
    }

    document.documentElement.setAttribute('data-theme', theme);
    updateThemeIcon(theme);
  }

  // Add sample transactions for testing
  function addSampleTransactions() {
    const sampleTransactions = [
      { item: 'Lunch at Restaurant', amount: 25.50, category: 'Food' },
      { item: 'Gasoline', amount: 45.00, category: 'Transport' },
      { item: 'Movie Tickets', amount: 30.00, category: 'Entertainment' },
      { item: 'Groceries', amount: 85.75, category: 'Shopping' },
      { item: 'Uber Ride', amount: 18.50, category: 'Transport' },
      { item: 'Coffee', amount: 5.50, category: 'Food' },
      { item: 'Concert Tickets', amount: 120.00, category: 'Entertainment' },
      { item: 'Monthly Bills', amount: 150.00, category: 'Bills' },
      { item: 'Dinner', amount: 42.30, category: 'Food' },
      { item: 'Video Game', amount: 59.99, category: 'Entertainment' },
      { item: 'Gym Membership', amount: 35.00, category: 'Health & Fitness' },
      { item: 'Books', amount: 28.50, category: 'Education' },
      { item: 'Phone Bill', amount: 65.00, category: 'Bills' },
      { item: 'Clothing', amount: 89.99, category: 'Shopping' },
      { item: 'Medical Checkup', amount: 120.00, category: 'Healthcare' }
    ];

    sampleTransactions.forEach(transaction => {
      transactionManager.addTransaction(
        transaction.item,
        transaction.amount,
        transaction.category
      );
    });
  }

  function handleFormSubmit(event) {
    event.preventDefault();

    if (formValidator.validateForm()) {
      const item = document.getElementById('item-name').value;
      const amount = parseFloat(document.getElementById('amount').value);
      const category = document.getElementById('category').value;

      transactionManager.addTransaction(item, amount, category);
      updateUI();
      formValidator.resetForm();
    }
  }

  function updateUI() {
    const allTransactions = transactionManager.getTransactions();

    // Filter transactions based on current sort selection
    let displayTransactions = [...allTransactions];

    if (currentSort.startsWith('category-')) {
      const targetCategory = currentSort.replace('category-', '');
      displayTransactions = allTransactions.filter(t =>
        t.category.toLowerCase() === targetCategory.toLowerCase()
      );
    }

    // Update transaction list
    renderTransactions(displayTransactions);

    // Update balance (only for displayed transactions)
    const total = balanceCalculator.calculateTotal(displayTransactions);
    balanceCalculator.updateDisplay(total);

    // Update chart (only for displayed transactions)
    chartVisualizer.updateChart(displayTransactions);

    // Update category sort options (use all transactions)
    populateCategorySortOptions(allTransactions);

    // Update delete all button state
    const deleteAllBtn = document.getElementById('delete-all-btn');
    if (deleteAllBtn) {
      deleteAllBtn.disabled = allTransactions.length === 0;
      deleteAllBtn.setAttribute('aria-disabled', allTransactions.length === 0);
    }

    // Save to storage
    transactionManager.saveToStorage();
  }

  function renderTransactions(transactions) {
    if (!transactionsList) return;

    // Clear existing transactions
    transactionsList.innerHTML = '';

    if (transactions.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'empty-transactions';

      // Check if filtering by category
      if (currentSort.startsWith('category-')) {
        const categoryName = currentSort.replace('category-', '');
        const displayName = categoryName.charAt(0).toUpperCase() + categoryName.slice(1);
        emptyMessage.textContent = `No transactions in ${displayName} category.`;
      } else {
        emptyMessage.textContent = 'No transactions yet. Add your first expense!';
      }

      emptyMessage.setAttribute('role', 'status');
      emptyMessage.setAttribute('aria-live', 'polite');
      transactionsList.appendChild(emptyMessage);
      return;
    }

    // Sort transactions based on current sort selection
    const sortedTransactions = sortTransactions([...transactions], currentSort);

    // Tampilkan SEMUA transaksi (bukan hanya 5 terbaru)
    // Create transaction items
    sortedTransactions.forEach(transaction => {
      const transactionElement = document.createElement('div');
      transactionElement.className = 'transaction-item';
      transactionElement.setAttribute('data-id', transaction.id);
      transactionElement.setAttribute('role', 'listitem');

      const formattedAmount = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(transaction.amount);

      // Get category icon or display text
      const getCategoryIcon = (category) => {
        const categoryLower = category.toLowerCase();
        const icons = {
          // Default categories
          food: '🍔',
          transport: '🚗',
          fun: '🎮',
          // Common custom categories
          shopping: '🛍️',
          bills: '📋',
          healthcare: '🏥',
          education: '📚',
          entertainment: '🎬',
          groceries: '🛒',
          dining: '🍽️',
          travel: '✈️',
          clothing: '👕',
          gifts: '🎁',
          home: '🏠',
          car: '🚙',
          phone: '📱',
          internet: '🌐',
          utilities: '💡',
          insurance: '🛡️',
          savings: '💰',
          investment: '📈',
          charity: '❤️',
          hobby: '🎨',
          sports: '⚽',
          pet: '🐕',
          beauty: '💄',
          electronics: '📱'
        };

        // Check for exact match
        if (icons[categoryLower]) {
          return icons[categoryLower];
        }

        // Check for partial matches
        if (categoryLower.includes('food') || categoryLower.includes('restaurant') || categoryLower.includes('dining')) {
          return '🍔';
        }
        if (categoryLower.includes('transport') || categoryLower.includes('car') || categoryLower.includes('bus') || categoryLower.includes('taxi')) {
          return '🚗';
        }
        if (categoryLower.includes('fun') || categoryLower.includes('entertain') || categoryLower.includes('movie') || categoryLower.includes('game')) {
          return '🎮';
        }
        if (categoryLower.includes('shop') || categoryLower.includes('buy') || categoryLower.includes('purchase')) {
          return '🛍️';
        }
        if (categoryLower.includes('bill') || categoryLower.includes('payment') || categoryLower.includes('fee')) {
          return '📋';
        }
        if (categoryLower.includes('health') || categoryLower.includes('medical') || categoryLower.includes('doctor')) {
          return '🏥';
        }
        if (categoryLower.includes('educat') || categoryLower.includes('school') || categoryLower.includes('course')) {
          return '📚';
        }

        // Default icon
        return '📝';
      };

      transactionElement.innerHTML = `
            <div class="transaction-content">
                <span class="transaction-item-name">${escapeHtml(transaction.item)}</span>
                <span class="transaction-category">
                    ${getCategoryIcon(transaction.category)} ${transaction.category}
                </span>
                <span class="transaction-amount">${formattedAmount}</span>
            </div>
            <button class="delete-btn" aria-label="Delete ${escapeHtml(transaction.item)} transaction" title="Delete transaction">
                ×
            </button>
        `;

      // Add delete event listener
      const deleteBtn = transactionElement.querySelector('.delete-btn');
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Delete "${transaction.item}" transaction?`)) {
          if (transactionManager.deleteTransaction(transaction.id)) {
            updateUI();
            // Show temporary success message
            showTemporaryMessage(`${transaction.item} deleted successfully`);
          }
        }
      });

      transactionsList.appendChild(transactionElement);
    });

    // Tambahkan counter untuk menunjukkan jumlah transaksi
    if (transactions.length > 0) {
      const counterElement = document.createElement('div');
      counterElement.className = 'transaction-counter';
      counterElement.innerHTML = `Total: <span class="highlight">${transactions.length}</span> transactions`;
      counterElement.setAttribute('role', 'status');
      counterElement.setAttribute('aria-live', 'polite');
      transactionsList.appendChild(counterElement);
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Helper function to show temporary message
  function showTemporaryMessage(message) {
    // Check if message container exists, create if not
    let messageContainer = document.querySelector('.temp-message');
    if (!messageContainer) {
      messageContainer = document.createElement('div');
      messageContainer.className = 'temp-message';
      document.querySelector('.container').insertBefore(
        messageContainer,
        document.querySelector('.main-content')
      );
    }

    messageContainer.textContent = message;
    messageContainer.classList.add('show');

    setTimeout(() => {
      messageContainer.classList.remove('show');
    }, 3000);
  }

  // Get unique categories from transactions
  function getUniqueCategories(transactions) {
    const categories = new Set();
    transactions.forEach(t => {
      if (t.category && t.category.trim()) {
        categories.add(t.category.toLowerCase());
      }
    });
    return Array.from(categories).sort();
  }

  // Populate category sort options
  function populateCategorySortOptions(transactions) {
    const sortSelect = document.getElementById('sort-by');
    if (!sortSelect) return;

    // Remove existing category options (keep static ones: newest, oldest, amount-asc, amount-desc)
    const staticOptions = ['newest', 'oldest', 'amount-asc', 'amount-desc'];
    const optionsToRemove = [];

    for (let i = 0; i < sortSelect.options.length; i++) {
      const option = sortSelect.options[i];
      if (!staticOptions.includes(option.value)) {
        optionsToRemove.push(option);
      }
    }

    // Remove in reverse order to avoid index issues
    optionsToRemove.reverse().forEach(option => {
      sortSelect.removeChild(option);
    });

    // Add category-specific options
    const categories = getUniqueCategories(transactions);
    categories.forEach(category => {
      const displayName = category.charAt(0).toUpperCase() + category.slice(1);
      const option = document.createElement('option');
      option.value = `category-${category}`;
      option.textContent = `Category: ${displayName}`;
      sortSelect.appendChild(option);
    });
  }

  // Sort transactions based on selected criteria
  function sortTransactions(transactions, sortBy) {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return transactions;
    }

    // Create a copy to avoid mutating the original array
    const sorted = [...transactions];

    switch (sortBy) {
      case 'newest':
        // Already sorted by TransactionManager.getTransactions(), just return as-is
        return sorted;

      case 'oldest':
        // Oldest first
        return sorted.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      case 'amount-asc':
        // Amount low to high
        return sorted.sort((a, b) => a.amount - b.amount);

      case 'amount-desc':
        // Amount high to low
        return sorted.sort((a, b) => b.amount - a.amount);

      default:
        // Default to newest first
        return sorted.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }
  }

  // Start application
  init();
})();