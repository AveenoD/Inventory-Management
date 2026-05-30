import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { d, fmt, sum } from "../lib/decimal.js";

/** Golden values from May 2026 Excel */
const EXCEL = {
  openingBalance: "910000.00",
  totalIncome: "127352.03",
  totalExpense: "1139.00",
  totalWithdrawal: "110500.00",
  totalDamage: "80.00",
  netProfit: "925633.03",
  rechargeTransferProfit: "49142.03",
  repairProfit: "39325.00",
  mobileProfit: "38885.00",
  extraIncome: "58576.00",
};

describe("dashboard formulas (Excel parity)", () => {
  it("computes total income (Excel B4 = A12+B12+C12, excludes extra)", () => {
    const totalIncome = d(EXCEL.rechargeTransferProfit)
      .plus(d(EXCEL.repairProfit))
      .plus(d(EXCEL.mobileProfit));
    expect(fmt(totalIncome)).toBe(EXCEL.totalIncome);
  });

  it("computes net profit", () => {
    const net = d(EXCEL.openingBalance)
      .plus(d(EXCEL.totalIncome))
      .minus(d(EXCEL.totalExpense))
      .minus(d(EXCEL.totalWithdrawal))
      .minus(d(EXCEL.totalDamage));
    expect(fmt(net)).toBe(EXCEL.netProfit);
  });

  it("recharge + transfer = 49142.03", () => {
    const rt = d("43718.22").plus(d("5423.81"));
    expect(fmt(rt)).toBe(EXCEL.rechargeTransferProfit);
  });

  it("cash portal balance (Sheet1 F7: uses repair/mobile gross sales)", () => {
    const bankBalance = d("91627");
    const cashPortal = d(EXCEL.openingBalance)
      .plus(d(EXCEL.rechargeTransferProfit))
      .plus(d("74490"))
      .plus(d("64417"))
      .plus(d(EXCEL.extraIncome))
      .minus(d(EXCEL.totalExpense))
      .minus(d(EXCEL.totalWithdrawal))
      .minus(d(EXCEL.totalDamage))
      .minus(bankBalance);
    expect(fmt(cashPortal)).toBe("953279.03");
  });

  it("grand total payment summary", () => {
    const cashPortal = d("953279.03");
    const bank = d("91627");
    const udhhar = d("29499");
    const party = d("44093");
    const grand = cashPortal.plus(bank).minus(udhhar).minus(party);
    expect(fmt(grand)).toBe("971314.03");
  });
});

describe("calculations", () => {
  it("money transfer row sum", () => {
    const row = {
      dmt99Dmt: 314.53,
      dmt99Aeps: 121.76,
      dmt99Nepal: 398.4,
      dmt99BillPay: 0,
      dmt99Qr: 0,
      dmt86Dmt: 224.94,
      dmt86Aeps: 20.73,
      dmt86Credit: 0,
      dmt86BillPay: 0,
      dmt86Wallet: 190,
      dmt86Qr: 16,
      dmt86Nepal: 0,
      imeAeps: 0,
      imeNepal: 0,
    };
    const total = Object.values(row).reduce(
      (a, v) => a.plus(new Decimal(v)),
      new Decimal(0),
    );
    expect(total.toFixed(2)).toBe("1286.36");
  });
});
