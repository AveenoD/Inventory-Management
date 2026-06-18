"use client";

import { useRef } from "react";
import type { SaleInvoiceDto } from "@sk-mobile/shared";
import { Download, MapPin, Phone, Printer, Share2 } from "lucide-react";
import { amountInWords, formatMoney } from "@/lib/format";

function paymentLabel(method: string) {
  if (method === "CASH") return "Cash";
  if (method === "UPI") return "UPI";
  if (method === "CARD") return "Card";
  return method;
}

function formatInvoiceDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type Props = {
  invoice: SaleInvoiceDto;
  showActions?: boolean;
};

export function SaleInvoiceView({ invoice, showActions = true }: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const { sale } = invoice;
  const warrantyBody = sale.warrantyNote?.trim() || invoice.warrantyText?.trim() || null;
  const hasDiscount = parseFloat(sale.discount) > 0;
  const itemCount = sale.lines.reduce((sum, l) => sum + l.quantity, 0);

  function handlePrint() {
    window.print();
  }

  async function handleShare() {
    const lines = sale.lines
      .map((l) => `${l.productName} ×${l.quantity} — ${formatMoney(l.lineTotal)}`)
      .join("\n");
    const text = [
      `${invoice.shopName}`,
      `Invoice: ${sale.invoiceNo ?? sale.id.slice(0, 8)}`,
      `Date: ${formatInvoiceDate(sale.date)}`,
      `Customer: ${sale.customerName ?? "Walk-in"}`,
      "",
      lines,
      "",
      `Total: ${formatMoney(sale.total)}`,
      warrantyBody ? `\nWarranty:\n${warrantyBody}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Invoice ${sale.invoiceNo ?? ""}`.trim(),
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
              {invoice.logoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={invoice.logoDataUrl} alt="" className="inv-logo" />
              ) : (
                <div className="inv-logo-fallback">
                  <span>SK</span>
                </div>
              )}
              <div className="inv-brand-text">
                <h1>{invoice.shopName}</h1>
                {invoice.address && (
                  <p className="inv-contact">
                    <MapPin size={13} strokeWidth={2.2} />
                    <span>{invoice.address}</span>
                  </p>
                )}
                {invoice.phone && (
                  <p className="inv-contact">
                    <Phone size={13} strokeWidth={2.2} />
                    <span>{invoice.phone}</span>
                  </p>
                )}
              </div>
            </div>
            <div className="inv-header-right">
              <div className="inv-badge">Tax Invoice</div>
              <div className="inv-number">{sale.invoiceNo ?? "—"}</div>
            </div>
          </div>
        </div>

        {/* Meta boxes */}
        <div className="inv-meta-grid">
          <div className="inv-meta-box">
            <div className="inv-meta-box-title">Bill To</div>
            <div className="inv-meta-box-value">{sale.customerName ?? "Walk-in Customer"}</div>
          </div>
          <div className="inv-meta-box">
            <div className="inv-meta-box-title">Invoice Date</div>
            <div className="inv-meta-box-value">{formatInvoiceDate(sale.date)}</div>
          </div>
          <div className="inv-meta-box">
            <div className="inv-meta-box-title">Payment Mode</div>
            <div className="inv-meta-box-value">
              <span className="inv-pay-pill">{paymentLabel(sale.paymentMethod)}</span>
            </div>
          </div>
          <div className="inv-meta-box">
            <div className="inv-meta-box-title">Items</div>
            <div className="inv-meta-box-value">
              {itemCount} {itemCount === 1 ? "item" : "items"}
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
                <th className="col-qty right">Qty</th>
                <th className="col-rate right">Rate (₹)</th>
                <th className="col-amt right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {sale.lines.map((line, i) => (
                <tr key={line.id}>
                  <td className="col-sno">{i + 1}</td>
                  <td className="col-item">{line.productName}</td>
                  <td className="col-qty right">{line.quantity}</td>
                  <td className="col-rate right">{formatMoney(line.unitPrice).replace("₹", "")}</td>
                  <td className="col-amt right">{formatMoney(line.lineTotal).replace("₹", "")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bottom: words + totals */}
        <div className="inv-bottom">
          <div className="inv-words">
            <span className="inv-words-label">Amount in words</span>
            <p>{amountInWords(sale.total)}</p>
          </div>
          <div className="inv-totals-box">
            <div className="inv-total-line">
              <span>Subtotal</span>
              <span>{formatMoney(sale.subtotal)}</span>
            </div>
            {hasDiscount && (
              <div className="inv-total-line discount">
                <span>Discount</span>
                <span>- {formatMoney(sale.discount)}</span>
              </div>
            )}
            <div className="inv-total-line grand">
              <span>Grand Total</span>
              <span>{formatMoney(sale.total)}</span>
            </div>
          </div>
        </div>

        {warrantyBody && (
          <div className="inv-warranty">
            <div className="inv-warranty-head">
              <span className="inv-warranty-icon">✦</span>
              Warranty &amp; Guarantee
            </div>
            <div className="inv-warranty-text">{warrantyBody}</div>
          </div>
        )}

        <div className="inv-footer">
          <div className="inv-footer-left">
            <p className="inv-thanks">Thank you for your business!</p>
            <p className="inv-tagline">We appreciate your trust in {invoice.shopName}.</p>
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
