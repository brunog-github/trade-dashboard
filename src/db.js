// db.js
import Dexie from "https://unpkg.com/dexie@3.2.4/dist/dexie.mjs";

class TradingDB extends Dexie {
  constructor() {
    super("TradingDashboardDB");
    // Apenas definimos as chaves que usaremos para busca/filtro
    this.version(1).stores({
      trades: "++id, date, ticker, type, category",
    });
  }
}

export const db = new TradingDB();
