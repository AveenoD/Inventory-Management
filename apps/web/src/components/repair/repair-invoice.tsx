"use client";

import { useRef } from "react";
import type { RepairJobDto } from "@sk-mobile/shared";
import { Download, Printer, Share2 } from "lucide-react";
import { amountInWords, formatMoney } from "@/lib/format";

function formatInvoiceDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type Props = {
  job: RepairJobDto;
  shopName?: string;
  logoDataUrl?: string | null;
  showActions?: boolean;
};

export function RepairInvoiceView({ job, shopName = "SK Mobile Shop", logoDataUrl = null, showActions = true }: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  function handlePrint() {
    window.print();
  }

  async function handleShare() {
    const amount = job.customerCharge || job.salePrice;
    const text = [
      `${shopName}`,
      `Repair Invoice: ${job.id.slice(0, 8).toUpperCase()}`,
      `Date: ${formatInvoiceDate(job.date)}`,
      `Customer: ${job.customerName ?? "Walk-in"}`,
      "",
      `Device: ${job.device}`,
      `Issue: ${job.issueDescription}`,
      "",
      `Total Charge: ${formatMoney(amount)}`,
    ]
      .filter(Boolean)
      .join("\n");

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Repair Invoice ${job.id.slice(0, 8).toUpperCase()}`.trim(),
          text,
        });
        return;
      } catch {
        /* user cancelled */
      }
    }
    await navigator.clipboard.writeText(text);
    alert("Invoice copied to clipboard");
  }

  const amount = job.customerCharge || job.salePrice;

  return (
    <div className="invoice-page">
      {showActions && (
        <div className="invoice-toolbar no-print">
          <button type="button" className="invoice-action primary" onClick={handlePrint}>
            <Download size={17} />
            Download PDF
          </button>
          <button type="button" className="invoice-action" onClick={handlePrint}>
            <Printer size={17} />
            Print
          </button>
          <button type="button" className="invoice-action" onClick={handleShare}>
            <Share2 size={17} />
            Share
          </button>
        </div>
      )}

      <div className="invoice-paper" ref={printRef}>
        {/* Header band */}
        <div className="inv-header">
          <div className="inv-header-inner">
            <div className="inv-brand">
              {logoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoDataUrl} alt="" className="inv-logo" />
              ) : (
                <div className="inv-logo-fallback">
                  <span>SK</span>
                </div>
              )}
              <div className="inv-brand-text">
                <h1>{shopName}</h1>
              </div>
            </div>
            <div className="inv-header-right">
              <div className="inv-badge">Repair Invoice</div>
              <div className="inv-number">{job.id.slice(0, 8).toUpperCase()}</div>
            </div>
          </div>
        </div>

        {/* Meta boxes */}
        <div className="inv-meta-grid">
          <div className="inv-meta-box">
            <div className="inv-meta-box-title">Bill To</div>
            <div className="inv-meta-box-value">
              {job.customerName ?? "Walk-in Customer"}
              {job.customerPhone && <div style={{ fontSize: "0.8rem", color: "#64748b" }}>{job.customerPhone}</div>}
            </div>
          </div>
          <div className="inv-meta-box">
            <div className="inv-meta-box-title">Date</div>
            <div className="inv-meta-box-value">{formatInvoiceDate(job.date)}</div>
          </div>
          <div className="inv-meta-box">
            <div className="inv-meta-box-title">Device</div>
            <div className="inv-meta-box-value">
              {job.device ?? "—"}
            </div>
          </div>
          <div className="inv-meta-box">
            <div className="inv-meta-box-title">Status</div>
            <div className="inv-meta-box-value">
              <span className="inv-pay-pill">{job.status === "DELIVERED" ? "Delivered" : "Pending Pickup"}</span>
            </div>
          </div>
        </div>

        {/* Items table */}
        <div className="inv-table-wrap">
          <table className="inv-table">
            <thead>
              <tr>
                <th className="col-sno">#</th>
                <th className="col-item">Description</th>
                <th className="col-amt right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="col-sno">1</td>
                <td className="col-item">Repair Service: {job.device} - {job.issueDescription}</td>
                <td className="col-amt right">{formatMoney(amount).replace("₹", "")}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Bottom: words + totals */}
        <div className="inv-bottom">
          <div className="inv-words">
            <span className="inv-words-label">Amount in words</span>
            <p>{amountInWords(amount)}</p>
          </div>
          <div className="inv-totals-box">
            <div className="inv-total-line grand">
              <span>Grand Total</span>
              <span>{formatMoney(amount)}</span>
            </div>
          </div>
        </div>

        <div className="inv-footer">
          <div className="inv-footer-left">
            <p className="inv-thanks">Thank you for your business!</p>
            <p className="inv-tagline">We appreciate your trust in {shopName}.</p>
          </div>
          <div className="inv-sign">
            <div className="inv-sign-line" />
            <span>Authorized Signatory</span>
          </div>
        </div>

        <div className="inv-watermark">Original Copy</div>
      </div>
    </div>
  );
}
