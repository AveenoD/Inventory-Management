"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useMonthId } from "@/hooks/use-month";
import { daysInMonth } from "@/lib/days";
import { EditableGrid } from "@/components/editable-grid";

type ExpenseRow = {
  date: string;
  salaryDescription: string;
  salaryAmount: number;
  teaDescription: string;
  teaAmount: number;
  shopExpDescription: string;
  shopExpAmount: number;
};

type DamageRow = {
  date: string;
  accessoriesDescription: string;
  accessoriesAmount: number;
  repairingDescription: string;
  repairingAmount: number;
};

export default function ExpensesPage() {
  const params = useParams();
  const year = parseInt(String(params.year), 10);
  const monthNum = parseInt(String(params.month), 10);
  const monthId = useMonthId(year, monthNum);
  const qc = useQueryClient();
  const dates = daysInMonth(year, monthNum);

  const emptyExpense = dates.map((date) => ({
    date,
    salaryDescription: "",
    salaryAmount: 0,
    teaDescription: "",
    teaAmount: 0,
    shopExpDescription: "",
    shopExpAmount: 0,
  }));

  const emptyDamage = dates.map((date) => ({
    date,
    accessoriesDescription: "",
    accessoriesAmount: 0,
    repairingDescription: "",
    repairingAmount: 0,
  }));

  if (!monthId) return <p>Month not found</p>;

  return (
    <div>
      <h2>Shop Expenses & Damage</h2>
      <h3>Expenses</h3>
      <EditableGrid
        dates={dates}
        columns={[
          { key: "salaryDescription", label: "Salary desc", type: "text" },
          { key: "salaryAmount", label: "Salary" },
          { key: "teaDescription", label: "Tea desc", type: "text" },
          { key: "teaAmount", label: "Tea" },
          { key: "shopExpDescription", label: "Shop desc", type: "text" },
          { key: "shopExpAmount", label: "Shop exp" },
        ]}
        initialRows={emptyExpense}
        onSave={async (rows) => {
          await api.bulkShopExpense(monthId, rows);
          qc.invalidateQueries({ queryKey: ["dashboard", monthId] });
        }}
      />
      <h3 style={{ marginTop: "2rem" }}>Damage & Loss</h3>
      <EditableGrid
        dates={dates}
        columns={[
          { key: "accessoriesDescription", label: "Acc desc", type: "text" },
          { key: "accessoriesAmount", label: "Acc amt" },
          { key: "repairingDescription", label: "Repair desc", type: "text" },
          { key: "repairingAmount", label: "Repair amt" },
        ]}
        initialRows={emptyDamage}
        onSave={async (rows) => {
          await api.bulkDamage(monthId, rows);
          qc.invalidateQueries({ queryKey: ["dashboard", monthId] });
        }}
      />
    </div>
  );
}
