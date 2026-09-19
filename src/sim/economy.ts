// Treasury: single balance, spend/canAfford. Income arrives in VS-3 (taxes).
import { COSTS } from './tuning/costs.js';

export class Economy {
  balance: number;

  constructor(start: number = COSTS.startBalance) {
    this.balance = Math.floor(start);
  }

  canAfford(cost: number): boolean {
    return this.balance >= cost;
  }

  spend(cost: number): boolean {
    if (cost < 0 || !this.canAfford(cost)) return false;
    this.balance -= Math.floor(cost);
    return true;
  }

  add(amount: number): void {
    this.balance += Math.floor(amount);
  }
}
