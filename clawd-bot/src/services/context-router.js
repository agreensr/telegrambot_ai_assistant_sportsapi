/**
 * Context Router
 * Time-based LLM and context switching based on daily schedule
 */

import logger from '../utils/logger.js';

class ContextRouter {
  constructor() {
    // All times in CST (America/Chicago)
    this.schedule = [
      {
        name: 'Trading Prep',
        mode: 'trading',
        model: 'gemma',
        start: { hour: 5, minute: 0 },
        end: { hour: 6, minute: 30 },
        description: 'NinjaTrader preparation and market analysis'
      },
      {
        name: 'Exercise',
        mode: 'fitness',
        model: 'llama',
        start: { hour: 7, minute: 15 },
        end: { hour: 8, minute: 15 },
        description: 'Workout and fitness coaching'
      },
      {
        name: 'Active Trading',
        mode: 'trading',
        model: 'gemma',
        start: { hour: 8, minute: 30 },
        end: { hour: 9, minute: 30 },
        description: 'Active trading and market monitoring'
      },
      {
        name: 'Productivity & Coding',
        mode: 'productivity',
        model: 'mistral',
        start: { hour: 9, minute: 30 },
        end: { hour: 14, minute: 0 },
        description: 'Software development and productivity'
      },
      {
        name: 'Sports Mode',
        mode: 'sports',
        model: 'llama',
        start: { hour: 14, minute: 0 },
        end: { hour: 5, minute: 0 }, // Wraps to next day
        description: 'Sports updates, scores, and odds'
      }
    ];

    // Manual override state
    this.manualOverride = null;
    this.autoModeEnabled = true;
  }

  /**
   * Get current time in configured timezone
   */
  getCurrentTime() {
    // Use CST (America/Chicago) from environment or default
    const timeZone = process.env.TZ || 'America/Chicago';
    const now = new Date();

    // Get time in the configured timezone
    const options = { timeZone, hour: 'numeric', minute: 'numeric', hour12: false };
    const timeString = now.toLocaleTimeString('en-US', options);
    const [hourStr, minuteStr] = timeString.split(':');

    return {
      hour: parseInt(hourStr, 10),
      minute: parseInt(minuteStr, 10),
      date: now
    };
  }

  /**
   * Convert time to minutes for comparison
   */
  timeToMinutes(hour, minute) {
    return hour * 60 + minute;
  }

  /**
   * Check if current time is within a scheduled block
   */
  isInTimeBlock(current, block) {
    const currentMinutes = this.timeToMinutes(current.hour, current.minute);
    const startMinutes = this.timeToMinutes(block.start.hour, block.start.minute);
    let endMinutes = this.timeToMinutes(block.end.hour, block.end.minute);

    // Handle wrap-around (e.g., 2 PM to 5 AM next day)
    if (endMinutes < startMinutes) {
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }

    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  /**
   * Get current context based on time
   */
  getCurrentContext() {
    // If manual override is active, use that
    if (this.manualOverride) {
      return this.manualOverride;
    }

    // If auto mode is disabled, return default
    if (!this.autoModeEnabled) {
      return {
        mode: 'trading',
        model: 'gemma',
        name: 'Manual Mode (Trading)',
        description: 'Auto-switching disabled'
      };
    }

    const current = this.getCurrentTime();

    // Find matching time block
    for (const block of this.schedule) {
      if (this.isInTimeBlock(current, block)) {
        return {
          mode: block.mode,
          model: block.model,
          name: block.name,
          description: block.description
        };
      }
    }

    // Default to sports mode if nothing matches
    return {
      mode: 'sports',
      model: 'llama',
      name: 'Sports Mode',
      description: 'Default mode'
    };
  }

  /**
   * Get context for a specific mode (manual override)
   */
  getContextForMode(mode) {
    const modeConfigs = {
      trading: { mode: 'trading', model: 'gemma', name: 'Trading Mode', description: 'Market analysis and trading' },
      fitness: { mode: 'fitness', model: 'llama', name: 'Fitness Mode', description: 'Workout and exercise coaching' },
      productivity: { mode: 'productivity', model: 'mistral', name: 'Productivity Mode', description: 'Coding and productivity' },
      sports: { mode: 'sports', model: 'llama', name: 'Sports Mode', description: 'Sports data and updates' }
    };

    return modeConfigs[mode] || modeConfigs.trading;
  }

  /**
   * Set manual mode override
   */
  setManualMode(mode) {
    const context = this.getContextForMode(mode);
    this.manualOverride = context;
    this.autoModeEnabled = false;
    logger.info(`Manual mode set: ${context.name} (${context.model})`);
    return context;
  }

  /**
   * Clear manual override and return to auto mode
   */
  clearManualMode() {
    this.manualOverride = null;
    this.autoModeEnabled = true;
    const current = this.getCurrentContext();
    logger.info(`Returned to auto mode: ${current.name} (${current.model})`);
    return current;
  }

  /**
   * Get current mode name
   */
  getCurrentModeName() {
    const context = this.getCurrentContext();
    return context.name;
  }

  /**
   * Get full schedule information
   */
  getSchedule() {
    const current = this.getCurrentTime();
    const currentMinutes = this.timeToMinutes(current.hour, current.minute);

    return this.schedule.map(block => {
      const startMinutes = this.timeToMinutes(block.start.hour, block.start.minute);
      let endMinutes = this.timeToMinutes(block.end.hour, block.end.minute);

      // Format times
      const formatTime = (h, m) => {
        const period = h >= 12 ? 'PM' : 'AM';
        const displayHour = h > 12 ? h - 12 : (h === 0 ? 12 : h);
        const displayMinute = m.toString().padStart(2, '0');
        return `${displayHour}:${displayMinute} ${period}`;
      };

      const startTime = formatTime(block.start.hour, block.start.minute);
      const endTime = formatTime(block.end.hour, block.end.minute);

      // Check if currently active
      const isActive = this.isInTimeBlock(current, block) && this.autoModeEnabled && !this.manualOverride;

      return {
        name: block.name,
        mode: block.mode,
        model: block.model,
        startTime,
        endTime,
        description: block.description,
        isActive
      };
    });
  }

  /**
   * Get status summary
   */
  getStatus() {
    const context = this.getCurrentContext();
    const current = this.getCurrentTime();

    return {
      currentMode: context.name,
      mode: context.mode,
      model: context.model,
      description: context.description,
      currentTime: `${current.hour.toString().padStart(2, '0')}:${current.minute.toString().padStart(2, '0')} CST`,
      autoModeEnabled: this.autoModeEnabled,
      manualOverride: !!this.manualOverride
    };
  }
}

export default new ContextRouter();
